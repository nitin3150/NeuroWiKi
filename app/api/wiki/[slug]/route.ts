import { NextRequest, NextResponse } from 'next/server'
import { hydra } from '@/lib/hydra'

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
        (c) => (c.additional_metadata?.slug as string) === slug || c.source_id === slug
      )
      if (chunk) {
        // Synthesise a minimal SourceInfo from the chunk
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

    const page = {
      slug: (pageSource.additional_metadata?.slug as string) || pageSource.id,
      title: pageSource.title ?? 'Unknown Title',
      type: (pageSource.additional_metadata?.category as string) || 'concept',
      summary: (pageSource.additional_metadata?.summary as string) || '',
      content: pageSource.description ?? '',
      created_at: pageSource.timestamp ?? '',
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

    return NextResponse.json({ page, relatedPages })
  } catch (error: any) {
    console.error(`Error fetching page ${slug}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

