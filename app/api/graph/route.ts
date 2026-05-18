import { NextResponse } from 'next/server'
import { hydra } from '@/lib/hydra'
import { getAllPageLinks } from '@/lib/db-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Source of truth: HydraDB (survives SQLite wipes)
    let items: any[] = []
    try {
      const res = (await hydra.fetch.listData({
        tenant_id: 'default',
        kind: 'knowledge',
        page: 1,
        page_size: 100,
      })) as any
      items = res?.sources ?? []
    } catch (e: any) {
      if (!e.message?.includes('Tenant default does not exist') && e.status !== 404) throw e
    }

    const nodes = items.map((item: any) => {
      const meta = item.document_metadata ?? {}
      return {
        id: (meta.slug as string) || (item.id as string),
        slug: (meta.slug as string) || (item.id as string),
        title: (item.title as string) ?? '',
        type: (meta.category as string) || 'concept',
        summary: (meta.summary as string) ?? '',
        sourceId: (meta.sourceId as string) ?? null, // SQLite source_id stored at ingest
        connections: 0,
      }
    })

    const slugSet = new Set(nodes.map((n) => n.id))

    // Layer 1: wikilink edges from SQLite (Gemini-written [[...]] refs)
    const rawLinks = getAllPageLinks()
    const wikilinkEdges = rawLinks
      .filter((l) => slugSet.has(l.source_slug) && slugSet.has(l.target_slug))
      .map((l) => ({ source: l.source_slug, target: l.target_slug, kind: 'wikilink' as const }))

    // Layer 2: co-source edges via document_metadata.sourceId from HydraDB
    // Pages sharing the same sourceId came from the same ingest — they're related
    const bySource = new Map<string, string[]>()
    for (const n of nodes) {
      if (!n.sourceId) continue
      const group = bySource.get(n.sourceId) ?? []
      group.push(n.id)
      bySource.set(n.sourceId, group)
    }
    const coSourceEdges: Array<{ source: string; target: string; kind: 'co-source' }> = []
    for (const group of bySource.values()) {
      if (group.length < 2) continue
      // Star topology: hub → siblings avoids O(n²) edge clutter
      const [hub, ...siblings] = group
      for (const sibling of siblings) {
        coSourceEdges.push({ source: hub, target: sibling, kind: 'co-source' })
      }
    }

    // Deduplicate: drop co-source if wikilink already covers that pair
    const wikilinkPairs = new Set(wikilinkEdges.map((e) => `${e.source}|${e.target}`))
    const dedupedCoSource = coSourceEdges.filter(
      (e) =>
        !wikilinkPairs.has(`${e.source}|${e.target}`) &&
        !wikilinkPairs.has(`${e.target}|${e.source}`)
    )

    const links = [...wikilinkEdges, ...dedupedCoSource]

    // Degree count for node sizing
    const connCount = new Map<string, number>()
    for (const l of links) {
      connCount.set(l.source, (connCount.get(l.source) ?? 0) + 1)
      connCount.set(l.target, (connCount.get(l.target) ?? 0) + 1)
    }

    // Strip internal sourceId before sending to client
    const clientNodes = nodes.map(({ sourceId: _s, ...rest }) => ({
      ...rest,
      connections: connCount.get(rest.id) ?? 0,
    }))

    console.log(`[graph] ${clientNodes.length} nodes | ${wikilinkEdges.length} wikilink + ${dedupedCoSource.length} co-source = ${links.length} links`)
    return NextResponse.json({ nodes: clientNodes, links })
  } catch (error: any) {
    console.error('Error generating graph:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

