import { NextRequest } from 'next/server'
import { extract } from '@extractus/article-extractor'
import { createSource, createLog } from '@/lib/db-helpers'
import { runIngestAgent } from '@/lib/agents/ingest-agent'
import { runConsistencyCheck } from '@/lib/agents/consistency-agent'
import { hydra } from '@/lib/hydra'

// ---------------------------------------------------------------------------
// Robust URL scraper — tries article-extractor first, falls back to raw fetch
// ---------------------------------------------------------------------------
async function scrapeUrl(url: string): Promise<{ title: string; text: string }> {
  try {
    // Method 1: article-extractor (handles most news/blog sites)
    const article = await extract(url, {}, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NeuroWiki/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    if (article?.content && article.content.length > 200) {
      const text = article.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      return { title: article.title || url, text }
    }
  } catch (e) {
    console.warn('article-extractor failed, trying raw fetch:', e)
  }

  // Method 2: raw fetch + basic HTML strip
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NeuroWiki/1.0)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(10000),
  })
  const html = await res.text()
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : url

  if (cleaned.length < 100) throw new Error(`Page content too short after scraping: ${url}`)
  return { title, text: cleaned.slice(0, 8000) }
}

// ---------------------------------------------------------------------------
// POST /api/ingest  — text or URL
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()
  let sourceText = ''
  let sourceTitle = 'Manual Text Entry'
  let urlStr: string | null = null

  const body = await req.json()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: string) => controller.enqueue(encoder.encode(msg + '\n'))

      try {
        const { text, url } = body

        if (url) {
          send('Reading source...')
          urlStr = url as string
          const scraped = await scrapeUrl(urlStr)
          sourceText = scraped.text
          sourceTitle = scraped.title
        } else if (text) {
          sourceText = text
        } else {
          throw new Error('Must provide either text or url')
        }

        if (!sourceText.trim()) throw new Error('Source text is empty')

        send('Saving source to local database...')
        const source = createSource({
          url: urlStr,
          title: sourceTitle,
          raw_content: sourceText,
          processed: 0,
        })

        send('AI is analyzing content...')
        const result = await runIngestAgent(sourceText, source.id)

        send('Storing logs...')
        createLog({
          source_id: source.id,
          pages_created: result.pagesCreated,
          pages_updated: 0,
          message: `Successfully created ${result.pagesCreated} pages.`,
        })

        send('Checking consistency...')
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
          console.warn('Failed to fetch all slugs for consistency check', e)
        }

        const newSlugs = result.pages.map(n => n.slug)
        const existingSlugs = allExistingSlugs.filter(slug => !newSlugs.includes(slug))
        const consistency = await runConsistencyCheck(result.pages, existingSlugs.slice(0, 20))

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
          },
        }))
        controller.close()
      } catch (error: any) {
        send(JSON.stringify({ error: error.message || 'Unknown error occurred' }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}

