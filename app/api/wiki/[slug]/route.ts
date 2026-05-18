import { NextRequest, NextResponse } from 'next/server'
import { hydra } from '@/lib/hydra'
import { db } from '@/lib/db'

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

    const page = {
      slug: (meta.slug as string) || pageSource.id,
      title: parsedDoc?.title || pageSource.title || 'Unknown Title',
      type: (meta.category as string) || 'concept',
      summary: (meta.summary as string) || '',
      content,
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

