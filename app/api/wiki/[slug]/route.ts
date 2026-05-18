import { NextRequest, NextResponse } from 'next/server'
import { hydra, ensureTenant, waitForIngestion } from '@/lib/hydra'
import { db } from '@/lib/db'
import { upsertPageHealth, upsertPageLinks, getSourceById } from '@/lib/db-helpers'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  // In Next.js 15 dynamic params are async
  const { slug } = await context.params

  try {
    // 1. Find the page — booleanRecall returns RetrievalResult: { sources, chunks, ... }
    const searchResponse = await hydra.recall.booleanRecall({
      tenant_id: 'default',
      query: slug,
      operator: 'and',
    })

    // sources is any[] — find exact slug match in additional_metadata
    const sources: any[] = searchResponse.sources ?? []
    let pageSource =
      sources.find(
        (s) => (s.additional_metadata?.slug as string) === slug || s.id === slug
      ) ?? sources[0] ?? null

    // Fallback: also check chunks
    if (!pageSource) {
      const chunk = (searchResponse.chunks ?? []).find(
        (c) => c.source_id === slug
      )
      if (chunk) {
        pageSource = {
          id: chunk.source_id,
          title: chunk.source_title,
          additional_metadata: chunk.additional_metadata ?? undefined,
          metadata: chunk.metadata ?? undefined,
        }
      }
    }

    if (!pageSource) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    // chunk_content is the full raw JSON document — extract markdown from it
    const extractMarkdown = (chunkContent: string): string => {
      try {
        const doc = JSON.parse(chunkContent)
        return doc?.content?.markdown ?? ''
      } catch {
        return chunkContent
      }
    }

    const chunks = (searchResponse.chunks ?? []).filter((c) => c.source_id === pageSource.id)
    const firstChunk = chunks[0]
    const parsedDoc = firstChunk ? (() => { try { return JSON.parse(firstChunk.chunk_content) } catch { return null } })() : null

    const content = parsedDoc?.content?.markdown
      || chunks.map((c) => extractMarkdown(c.chunk_content)).filter(Boolean).join('\n\n')
      || ''

    const meta = parsedDoc?.document_metadata ?? pageSource.additional_metadata ?? {}

    // Resolve sources: page metadata stores sourceId; SQLite has full source records
    const sourceIds: number[] = []
    const rawSourceId = meta.sourceId ?? meta.source_id
    if (rawSourceId !== undefined && rawSourceId !== null) {
      const n = typeof rawSourceId === 'number' ? rawSourceId : parseInt(String(rawSourceId), 10)
      if (!isNaN(n)) sourceIds.push(n)
    }

    const pageSources = sourceIds
      .map((id) => getSourceById(id))
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => ({ title: s.title ?? 'Source', url: s.url ?? undefined }))

    const page = {
      slug: (meta.slug as string) || pageSource.id,
      title: parsedDoc?.title || pageSource.title || 'Unknown Title',
      type: (meta.category as string) || 'concept',
      summary: (meta.summary as string) || '',
      content,
      sources: pageSources,
      created_at: parsedDoc?.timestamp || pageSource.timestamp || '',
    }
    // 2. Fetch related pages using fullRecall — also returns RetrievalResult
    const relatedResponse = await hydra.recall.fullRecall({
      tenant_id: 'default',
      query: page.title,
      max_results: 6,
      graph_context: true,
    })

    const relatedPages = (relatedResponse.sources ?? [])
      .filter(
        (s) => ((s.additional_metadata?.slug as string) || s.id) !== page.slug
      )
      .slice(0, 5)
      .map((s: any) => ({
        slug: (s.additional_metadata?.slug as string) || s.id,
        title: s.title ?? 'Unknown',
        summary: (s.additional_metadata?.summary as string) || '',
        type: (s.additional_metadata?.category as string) || 'concept',
      }))

    // 3. Backlinks: pages that [[wikilink]] to this slug
    const backlinkRows = db.prepare(`
      SELECT pl.source_slug, p.title
      FROM page_links pl
      LEFT JOIN pages p ON p.slug = pl.source_slug
      WHERE pl.target_slug = ?
    `).all(slug) as Array<{ source_slug: string; title: string | null }>

    const backlinks = backlinkRows.map(r => ({
      slug: r.source_slug,
      title: r.title ?? r.source_slug,
    }))

    return NextResponse.json({ page, relatedPages, backlinks })
  } catch (error: any) {
    console.error(`Error fetching page ${slug}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { title, content, summary, type } = await req.json()

  try {
    await ensureTenant('default')

    const cleanedContent = content.replace(/^#\s+.+\n+/, '')

    const uploadResponse = await hydra.upload.knowledge({
      tenant_id: 'default',
      upsert: true,
      app_knowledge: JSON.stringify([
        {
          tenant_id: 'default',
          sub_tenant_id: 'default',
          id: slug,
          title,
          type: 'document',
          content: { markdown: `# ${title}\n\n${cleanedContent}` },
          document_metadata: {
            category: type ?? 'concept',
            summary: summary ?? '',
            slug,
            verified: true,
            verifiedAt: new Date().toISOString(),
            manuallyEdited: true,
          },
        },
      ]),
    }) as any

    const realSourceId = uploadResponse?.results?.[0]?.source_id ?? slug
    const ready = await waitForIngestion(realSourceId, 'default')

    upsertPageHealth({
      slug,
      title,
      type: type ?? 'concept',
      summary: summary ?? '',
      confidence: ready ? 100 : 60,
      stale_reason: ready ? undefined : 'Indexing may be incomplete',
      hydra_doc_id: realSourceId,
    })

    // Refresh wikilink graph from new content
    db.prepare(`DELETE FROM page_links WHERE source_slug = ?`).run(slug)
    const linkedSlugs = [...cleanedContent.matchAll(/\[\[([^\]]+)\]\]/g)].map((m: any) => m[1].trim())
    if (linkedSlugs.length) upsertPageLinks(slug, linkedSlugs)

    return NextResponse.json({ page: { slug, title, content: cleanedContent, summary, type } })
  } catch (error: any) {
    console.error(`Error updating page ${slug}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

