import { generateObject, NoObjectGeneratedError } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { hydra, ensureTenant, waitForIngestion } from '../hydra'
import { upsertPageHealth, upsertPageLinks, getAllPages } from '../db-helpers'

export interface IngestResult {
  pagesCreated: number
  pages: Array<{ slug: string; title: string; content: string; isNew: boolean; indexed: boolean }>
}

async function verifyClaims(
  page: { content: string; sourceSentences: string[] },
  sourceText: string
): Promise<boolean> {
  for (const sentence of page.sourceSentences) {
    const words = sentence.toLowerCase().split(' ').filter(w => w.length > 4)
    if (words.length === 0) continue
    const matches = words.filter(w => sourceText.toLowerCase().includes(w))
    const matchRate = matches.length / words.length
    if (matchRate < 0.6) {
      console.warn(`Possible hallucination detected: "${sentence}" not found in source`)
      return false
    }
  }
  return true
}

export async function runIngestAgent(
  sourceText: string,
  sourceId: number,
  tenantId: string = 'default'
): Promise<IngestResult> {
  // Ensure tenant exists before any operations
  await ensureTenant(tenantId)

  // Step 1: Fetch existing pages for the prompt
  let existingPages: any[] = []
  try {
    const res = (await hydra.fetch.listData({
      tenant_id: tenantId,
      kind: 'knowledge',
      page: 1,
      page_size: 100,
    })) as any
    const items: any[] = res?.sources ?? []
    existingPages = items.map((item: any) => ({
      slug: (item.document_metadata?.slug as string) || item.id,
      title: item.title || '',
      summary: (item.document_metadata?.summary as string) || '',
    }))
  } catch (e: any) {
    const is404 = e?.statusCode === 404 || e?.body?.detail?.error_code === 'NOT_FOUND'
    if (!is404) console.warn("Failed to fetch existing pages for prompt index", e)
  }

  // Step 2 — Generate pages with Gemini
  const result = await generateObject({
    model: google('gemini-2.5-flash'),
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    schema: z.object({
      pages: z.array(
        z.object({
          slug: z.string().describe('lowercase-hyphenated'),
          title: z.string(),
          type: z.enum(['concept', 'person', 'place', 'event', 'tool', 'organization']),
          summary: z.string(),
          content: z.string().describe('150-300 word markdown, encyclopedic style'),
          sourceSentences: z.array(z.string()).min(1).max(5),
        })
      ),
    }),
    prompt: `You are a strict knowledge wiki compiler with zero tolerance for hallucination.

SOURCE TEXT (this is the ONLY source of truth):
"""
${sourceText.slice(0, 6000)}
"""

EXISTING WIKI INDEX:
${existingPages.map(p => `- ${p.slug}: ${p.title} — ${p.summary}`).join('\n')}

Rules you MUST follow:
1. ONLY include claims that are EXPLICITLY stated in the source text above
2. NEVER infer connections that aren't directly stated
3. Every factual sentence in content must correspond to something in the source
4. If something is uncertain, write "According to this source..." not as fact
5. Do NOT include information you know from training — only from the source text
6. Create 2-5 wiki pages about key concepts from this specific source
7. Use [[wikilinks]] to link to related pages by their slug

Return JSON with a "pages" key containing an array. Each page must include:
- slug: lowercase-hyphenated
- title: human readable
- type: concept | person | place | event | tool | organization
- summary: one sentence from the source
- content: 150-300 word markdown — only facts from the source
- sourceSentences: array of 2-5 exact quotes (under 20 words each)
  from the source text that back up the main claims in this page
`,
  }).catch((err: unknown) => {
    if (NoObjectGeneratedError.isInstance(err)) {
      console.error('[ingest] Raw Gemini response:', (err as any).text)
      console.error('[ingest] Cause:', (err as any).cause?.message)
    }
    throw err
  })

  const pages: Array<{ slug: string; title: string; content: string; isNew: boolean; indexed: boolean }> = []
  let pagesCreated = 0

  // Collect existing hydra_doc_ids to forcefully relate new pages to them
  const existingHydraIds = getAllPages()
    .map((p) => p.hydra_doc_id)
    .filter((id): id is string => !!id)

  // Track real source IDs of pages uploaded in this batch for sibling cross-linking
  const batchHydraIds: string[] = []

  // Step 3 — Verify and Store each page in HydraDB as Knowledge
  for (const page of result.object.pages) {
    try {
      const isVerified = await verifyClaims(page, sourceText)
      if (!isVerified) {
        console.warn(`Skipping page ${page.slug} — claims could not be verified against source`)
        continue
      }

      // All existing pages + siblings already uploaded this batch
      const cortexSourceIds = [...existingHydraIds, ...batchHydraIds].filter(Boolean)

      const uploadResponse = await hydra.upload.knowledge({
        tenant_id: tenantId,
        upsert: true,
        app_knowledge: JSON.stringify([
          {
            tenant_id: tenantId,
            sub_tenant_id: 'default',
            id: page.slug,
            title: page.title,
            type: 'document',
            content: {
              markdown: `# ${page.title}\n\n${page.content}`,
            },
            document_metadata: {
              category: page.type,
              summary: page.summary,
              sourceSentences: page.sourceSentences,
              verified: true,
              verifiedAt: new Date().toISOString(),
              sourceId: sourceId.toString(),
              slug: page.slug,
            },
            ...(cortexSourceIds.length > 0 && {
              relations: { cortex_source_ids: cortexSourceIds },
            }),
          },
        ]),
      }) as any

      // Use real source_id from upload response for status polling
      const realSourceId = uploadResponse?.results?.[0]?.source_id ?? page.slug
      batchHydraIds.push(realSourceId)
      const ready = await waitForIngestion(realSourceId, tenantId)

      upsertPageHealth({
        slug: page.slug,
        title: page.title,
        type: page.type,
        summary: page.summary,
        source_id: sourceId,
        confidence: ready ? 100 : 60,
        stale_reason: ready ? undefined : 'Indexing may be incomplete',
        hydra_doc_id: realSourceId,
      })

      // Parse [[wikilinks]] from content and store graph edges in SQLite
      const linkedSlugs = [...page.content.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1].trim())
      if (linkedSlugs.length) upsertPageLinks(page.slug, linkedSlugs)

      pages.push({
        slug: page.slug,
        title: page.title,
        content: page.content,
        isNew: true,
        indexed: ready,
      })
      pagesCreated++
    } catch (error: any) {
      console.error(`Failed to ingest page ${page.slug}:`, error?.body ?? error?.message)
    }
  }

  return { pagesCreated, pages }
}
