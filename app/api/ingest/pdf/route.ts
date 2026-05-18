import { NextRequest, NextResponse } from 'next/server'
import { createSource, createLog } from '@/lib/db-helpers'
import { runIngestAgent } from '@/lib/agents/ingest-agent'
import { runConsistencyCheck } from '@/lib/agents/consistency-agent'
import { hydra } from '@/lib/hydra'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
    const isTxt = file.type === 'text/plain' || file.name.endsWith('.txt')
    const isMd  = file.type === 'text/markdown' || file.name.endsWith('.md')

    if (!isPdf && !isTxt && !isMd) {
      return NextResponse.json(
        { error: 'Only PDF, TXT, and MD files are supported' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let text = ''

    if (isPdf) {
      // Use require() for pdf-parse — it's a CommonJS module with no .default export
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const pdfData = await pdfParse(buffer)
      text = pdfData.text
    } else {
      text = buffer.toString('utf-8')
    }

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract meaningful text from file (too short)' },
        { status: 400 }
      )
    }

    // Truncate to stay within model context limits
    const truncated = text.slice(0, 12000)

    // Save source record
    const source = createSource({
      url: null,
      title: file.name,
      raw_content: truncated,
      processed: 0,
    })

    // Run ingest agent
    const result = await runIngestAgent(truncated, source.id)

    // Log result
    createLog({
      source_id: source.id,
      pages_created: result.pagesCreated,
      pages_updated: 0,
      message: `File upload: created ${result.pagesCreated} pages from ${file.name}.`,
    })

    // Consistency check
    let allExistingSlugs: string[] = []
    try {
      const listRes = (await hydra.fetch.listData({
        tenant_id: 'default',
        kind: 'knowledge',
        page: 1,
        page_size: 100,
      })) as any
      const items: any[] = listRes?.results ?? listRes?.data ?? listRes?.items ?? []
      allExistingSlugs = items.map((item: any) => (item.additional_metadata?.slug as string) || item.id)
    } catch (e) {
      console.warn('Failed to fetch slugs for consistency check', e)
    }

    const newSlugs = result.pages.map(p => p.slug)
    const existingSlugs = allExistingSlugs.filter(s => !newSlugs.includes(s))
    const consistency = await runConsistencyCheck(result.pages, existingSlugs.slice(0, 20))

    const warningMessage = result.pages.some(p => !p.indexed)
      ? 'Some pages may still be indexing. Wait 30s before querying.'
      : null

    return NextResponse.json({
      sourceId: source.id,
      fileName: file.name,
      pagesCreated: result.pagesCreated,
      pages: result.pages,
      warning: warningMessage,
      consistency: {
        contradictionsFound: consistency.contradictions,
        pagesAutoUpdated: consistency.updated,
        pagesFlaggedForReview: consistency.flagged,
      },
    })
  } catch (error) {
    console.error('PDF ingest error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process file' },
      { status: 500 }
    )
  }
}
