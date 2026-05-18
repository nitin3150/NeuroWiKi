import { NextRequest } from 'next/server'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import pdfParse from 'pdf-parse'
import { createSource, createLog } from '@/lib/db-helpers'
import { runIngestAgent } from '@/lib/agents/ingest-agent'
import { runConsistencyCheck } from '@/lib/agents/consistency-agent'
import { hydra } from '@/lib/hydra'

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()
  let sourceText = ''
  let sourceTitle = 'Manual Text Entry'
  let urlStr: string | null = null

  // Since we want to parse the body asynchronously inside the stream, we read it first.
  const body = await req.json()
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: string) => controller.enqueue(encoder.encode(msg + '\n'))
      
      try {
        const { text, url } = body

        // 1. If URL: scrape with Readability -> get clean text + title
        if (url) {
          send("Reading source...")
          urlStr = (url as string) ?? null
          const response = await fetch(url)
          if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`)

          const contentType = response.headers.get('content-type') ?? ''

          if (contentType.includes('application/pdf')) {
            const buffer = await response.arrayBuffer()
            const data = await pdfParse(Buffer.from(buffer))
            sourceText = data.text
            sourceTitle = (data.info?.Title as string) || new URL(url).pathname.split('/').pop() || 'PDF Document'
            if (!sourceText.trim()) throw new Error('PDF appears to have no extractable text (may be scanned image).')
          } else {
            const html = await response.text()
            const doc = new JSDOM(html, { url })
            const reader = new Readability(doc.window.document)
            const article = reader.parse()
            if (article) {
              sourceText = article.textContent || ''
              sourceTitle = article.title || 'Extracted Article'
            } else {
              throw new Error('Readability failed to parse the page.')
            }
          }
        } else if (text) {
          sourceText = text
        } else {
          throw new Error('Must provide either text or url')
        }

        if (!sourceText.trim()) {
          throw new Error('Source text is empty')
        }

        send("Saving source to local database...")
        // 2. Save to sources table (SQLite)
        const source = createSource({
          url: urlStr,
          title: sourceTitle,
          raw_content: sourceText,
          processed: 0
        })

        console.log(`[ingest] source=${source.id} title="${sourceTitle}" length=${sourceText.length}`)
        send("AI is analyzing content...")
        // 3. Run runIngestAgent() — stores pages in HydraDB
        const result = await runIngestAgent(sourceText, source.id)

        send("Storing logs...")
        // 4. Save log entry
        createLog({
          source_id: source.id,
          pages_created: result.pagesCreated,
          pages_updated: 0,
          message: `Successfully created ${result.pagesCreated} pages.`
        })

        send("Checking consistency...")
        let allExistingSlugs: string[] = []
        try {
          const res = (await hydra.fetch.listData({
            tenant_id: 'default',
            kind: 'knowledge',
            page: 1,
            page_size: 100,
          })) as any
          const items: any[] = res?.sources ?? []
          allExistingSlugs = items.map((item: any) => (item.document_metadata?.slug as string) || item.id)
        } catch (e) {
          console.warn("Failed to fetch all slugs for consistency check", e)
        }
        
        const newSlugs = result.pages.map(n => n.slug)
        const existingSlugs = allExistingSlugs.filter(slug => !newSlugs.includes(slug))

        const consistency = await runConsistencyCheck(
          result.pages,
          existingSlugs.slice(0, 20)
        )

        const warningMessage = result.pages.some(p => !p.indexed)
          ? 'Some pages may still be indexing. Wait 30s before querying.'
          : null
        
        send(JSON.stringify({
          final: true,
          pagesCreated: result.pagesCreated,
          pages: result.pages,
          warning: warningMessage,
          consistency: {
            contradictionsFound: consistency.contradictions,
            pagesAutoUpdated: consistency.updated,
            pagesFlaggedForReview: consistency.flagged,
          }
        }))
        controller.close()
      } catch (error: any) {
        console.error('[ingest] Error:', error?.stack ?? error)
        send(JSON.stringify({ error: error.message || 'Unknown error occurred' }))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
