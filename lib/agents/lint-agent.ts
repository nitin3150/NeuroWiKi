import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { hydra } from '@/lib/hydra'
import {
  getAllPages,
  getAllPageLinks,
  getLastLintTime,
  getPagesUpdatedSince,
  recordLintSweep,
} from '@/lib/db-helpers'

export interface LintReport {
  orphans: Array<{ slug: string; title: string }>
  islands: Array<{ slugs: string[]; titles: string[] }>
  gaps: Array<{ entity: string; mentionedIn: string[] }>
  stale: Array<{ slug: string; title: string; type: string; daysSince: number }>
  missingLinks: Array<{ fromSlug: string; mentionedEntity: string }>
  score: number
  totalPages: number
  incrementalPages: number
}

// Fix 3: type-aware decay — fast-moving knowledge rots faster
const DECAY_DAYS: Record<string, number> = {
  event: 365,
  person: 365,
  place: 365,
  concept: 90,
  organization: 30,
  tool: 30,
  synthesis: 14,
}
const DEFAULT_DECAY_DAYS = 60

const GapSchema = z.object({
  gaps: z.array(z.object({
    entity: z.string(),
    mentionedIn: z.array(z.string()),
  })),
  missingLinks: z.array(z.object({
    fromSlug: z.string(),
    mentionedEntity: z.string(),
  })),
})

// Fix 2: BFS over undirected adjacency to find weakly connected components
function findConnectedComponents(
  slugs: string[],
  links: Array<{ source_slug: string; target_slug: string }>
): string[][] {
  const adj = new Map<string, Set<string>>()
  for (const slug of slugs) adj.set(slug, new Set())

  for (const link of links) {
    if (adj.has(link.source_slug)) adj.get(link.source_slug)!.add(link.target_slug)
    if (adj.has(link.target_slug)) adj.get(link.target_slug)!.add(link.source_slug)
  }

  const visited = new Set<string>()
  const components: string[][] = []

  for (const slug of slugs) {
    if (visited.has(slug)) continue
    const component: string[] = []
    const queue = [slug]
    visited.add(slug)
    while (queue.length > 0) {
      const node = queue.shift()!
      component.push(node)
      for (const neighbor of (adj.get(node) ?? [])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    components.push(component)
  }

  return components
}

export async function runLintSweep(tenantId: string = 'default'): Promise<LintReport> {
  // Fetch all pages from HydraDB (nodes)
  let hydraPages: Array<{ slug: string; title: string; content: string }> = []
  try {
    const res = await hydra.fetch.listData({
      tenant_id: tenantId,
      kind: 'knowledge',
      page: 1,
      page_size: 100,
    }) as any
    hydraPages = (res?.sources ?? []).map((item: any) => ({
      slug: (item.document_metadata?.slug as string) || item.id,
      title: item.title ?? '',
      content: item.description ?? item.content?.markdown ?? '',
    }))
  } catch {
    // empty wiki — all metrics will be zero
  }

  const slugSet = new Set(hydraPages.map(p => p.slug))
  const slugToTitle = new Map(hydraPages.map(p => [p.slug, p.title]))

  // ── Fix 2: Connected component island detection ────────────────────────────
  const allLinks = getAllPageLinks().filter(
    l => slugSet.has(l.source_slug) && slugSet.has(l.target_slug)
  )
  const components = findConnectedComponents([...slugSet], allLinks)

  // Largest component = main cluster. All others are islands.
  const mainCluster = components.reduce(
    (biggest, comp) => comp.length > biggest.length ? comp : biggest,
    [] as string[]
  )
  const mainClusterSet = new Set(mainCluster)

  // Single-node islands that have zero links = classic orphans
  const orphans = components
    .filter(c => c.length === 1 && !mainClusterSet.has(c[0]))
    .map(c => ({ slug: c[0], title: slugToTitle.get(c[0]) ?? c[0] }))

  // Multi-node disconnected clusters = islands
  const islands = components
    .filter(c => c.length > 1 && !c.some(s => mainClusterSet.has(s)))
    .map(c => ({
      slugs: c,
      titles: c.map(s => slugToTitle.get(s) ?? s),
    }))

  // ── Fix 3: Type-aware stale detection ─────────────────────────────────────
  const sqlitePages = getAllPages()
  const now = Date.now()
  const stale = sqlitePages
    .filter(p => {
      const decayDays = DECAY_DAYS[p.type] ?? DEFAULT_DECAY_DAYS
      const thresholdMs = decayDays * 24 * 60 * 60 * 1000
      return (now - new Date(p.last_validated).getTime()) > thresholdMs
    })
    .map(p => ({
      slug: p.slug,
      title: p.title,
      type: p.type,
      daysSince: Math.floor((now - new Date(p.last_validated).getTime()) / (24 * 60 * 60 * 1000)),
    }))

  // ── Fix 1: Incremental gap analysis — only pages updated since last sweep ──
  let gaps: LintReport['gaps'] = []
  let missingLinks: LintReport['missingLinks'] = []
  let incrementalPages = 0

  if (hydraPages.length > 0) {
    try {
      const lastSweep = getLastLintTime()
      const existingSlugs = [...slugSet].join(', ')

      // Determine which pages to send to Gemini
      let pagesToAnalyze = hydraPages
      if (lastSweep) {
        const updatedSlugs = new Set(
          getPagesUpdatedSince(lastSweep).map(p => p.slug)
        )
        // Filter hydraPages to only those updated since last sweep
        const incremental = hydraPages.filter(p => updatedSlugs.has(p.slug))
        // Fall back to all pages if nothing changed (first run after existing wiki)
        if (incremental.length > 0) pagesToAnalyze = incremental
      }

      incrementalPages = pagesToAnalyze.length

      const pageIndex = pagesToAnalyze
        .map(p => `[${p.slug}] ${p.title}:\n${p.content.slice(0, 400)}`)
        .join('\n\n---\n\n')

      const { object } = await generateObject({
        model: google('gemini-2.5-flash'),
        providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
        schema: GapSchema,
        prompt: `You are a wiki health auditor. Analyze the PAGES BEING ANALYZED below for:
1. "gaps": entities (people, concepts, places, tools) mentioned in multiple analyzed pages but with NO dedicated page in the existing slug list
2. "missingLinks": places where a significant entity is mentioned as plain text but NOT wrapped in [[wikilinks]]

EXISTING PAGES (all valid slugs in the wiki):
${existingSlugs}

PAGES BEING ANALYZED (new/updated since last sweep):
${pageIndex}

Rules:
- gaps: only report entities that appear in 2+ analyzed pages AND are absent from existing slug list
- missingLinks: only flag entities significant enough to warrant a dedicated page
- Be conservative — only flag clear cases
- fromSlug must be one of the slugs in PAGES BEING ANALYZED`,
      })

      gaps = object.gaps.filter(g => !slugSet.has(g.entity.toLowerCase().replace(/\s+/g, '-')))
      missingLinks = object.missingLinks.filter(m => slugSet.has(m.fromSlug))
    } catch (e) {
      console.warn('[lint] Gap analysis failed:', e)
    }
  }

  const totalIssues = orphans.length + islands.length + stale.length + gaps.length
  const total = hydraPages.length
  const score = total === 0 ? 100 : Math.max(0, Math.round(((total - totalIssues) / total) * 100))

  // Record this sweep so next run is incremental
  recordLintSweep(incrementalPages, totalIssues)

  return { orphans, islands, gaps, stale, missingLinks, score, totalPages: total, incrementalPages }
}
