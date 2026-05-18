import { NextRequest } from 'next/server'
import { extract } from '@extractus/article-extractor'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { createSource, createLog, processReindexQueue } from '@/lib/db-helpers'
import { runIngestAgent } from '@/lib/agents/ingest-agent'
import { runConsistencyCheck } from '@/lib/agents/consistency-agent'
import { hydra } from '@/lib/hydra'

// ---------------------------------------------------------------------------
// File parser — supports PDF, DOCX, TXT, MD
// ---------------------------------------------------------------------------
async function parseFile(file: File): Promise<{ text: string; title: string }> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const mime = file.type
  const name = file.name

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    const data = await pdfParse(buffer)
    if (!data.text.trim()) throw new Error(`${name}: PDF has no extractable text (may be scanned image).`)
    return { text: data.text, title: (data.info?.Title as string) || name.replace(/\.pdf$/i, '') }
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer })
    return { text: result.value, title: name.replace(/\.docx$/i, '') }
  }

  if (mime === 'text/plain' || name.endsWith('.txt') || name.endsWith('.md')) {
    return { text: buffer.toString('utf-8'), title: name.replace(/\.(txt|md)$/i, '') }
  }

  throw new Error(`Unsupported file type: ${name}`)
}

// ---------------------------------------------------------------------------
// URL scraper — tries article-extractor first, falls back to raw fetch
// ---------------------------------------------------------------------------
async function scrapeUrl(url: string): Promise<{ title: string; text: string }> {
  // Method 1: article-extractor (handles most news/blog/wiki sites)
  try {
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
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`)
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
// POST /api/ingest — supports text, url/urls (array), and file uploads
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: 'API key not configured' }, { status: 500 })
  }
  const encoder = new TextEncoder()
  const contentType = req.headers.get('content-type') ?? ''
  let body: any = {}
  let uploadedFiles: File[] = []

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    uploadedFiles = formData.getAll('file') as File[]
  } else {
    body = await req.json()
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: string) => controller.enqueue(encoder.encode(msg + '\n'))

      // Best-effort: drain reindex queue from previous failed ingest runs
      processReindexQueue(async () => null)

      try {
        const { text, url } = body
        let allPages: any[] = []
        let totalCreated = 0
        let hasIndexingWarning = false

        // ── Branch 1: File uploads ──────────────────────────────────────────
        if (uploadedFiles.length > 0) {
          send(`Reading ${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}...`)
          const parsed = await Promise.all(uploadedFiles.map(parseFile))
          send(`AI is analyzing ${uploadedFiles.length} document${uploadedFiles.length > 1 ? 's' : ''} in parallel...`)

          for (let i = 0; i < parsed.length; i++) {
            const { text: fileText, title } = parsed[i]
            send(`Processing file ${i + 1} of ${parsed.length}: ${title}...`)
            if (!fileText.trim()) throw new Error(`File "${title}" appears to be empty.`)
            const source = createSource({ url: null, title, raw_content: fileText, processed: 0 })
            const result = await runIngestAgent(fileText, source.id)
            createLog({ source_id: source.id, pages_created: result.pagesCreated, pages_updated: 0, message: `Successfully created ${result.pagesCreated} pages.` })
            allPages = allPages.concat(result.pages)
            totalCreated += result.pagesCreated
            if (result.pages.some((p: any) => !p.indexed)) hasIndexingWarning = true
          }

        // ── Branch 2: URLs ──────────────────────────────────────────────────
        } else {
          const { urls } = body
          const urlList: string[] = urls?.length ? urls : url ? [url] : []

          if (urlList.length > 0) {
            send(`Fetching ${urlList.length} URL${urlList.length > 1 ? 's' : ''}...`)
            const urlErrors: string[] = []

            for (let i = 0; i < urlList.length; i++) {
              const u = urlList[i]
              send(`Processing source ${i + 1} of ${urlList.length}...`)
              try {
                const response = await fetch(u, { signal: AbortSignal.timeout(15000) })
                if (!response.ok) throw new Error(`Failed to fetch ${u}: ${response.statusText}`)
                const respContentType = response.headers.get('content-type') ?? ''
                let sourceText = ''
                let sourceTitle = ''

                if (respContentType.includes('application/pdf')) {
                  // Direct PDF URL
                  const buffer = await response.arrayBuffer()
                  const data = await pdfParse(Buffer.from(buffer))
                  sourceText = data.text
                  sourceTitle = (data.info?.Title as string) || new URL(u).pathname.split('/').pop() || 'PDF Document'
                  if (!sourceText.trim()) throw new Error(`PDF at ${u} has no extractable text.`)
                } else {
                  // HTML page — use article-extractor with raw fetch fallback
                  const scraped = await scrapeUrl(u)
                  sourceText = scraped.text
                  sourceTitle = scraped.title
                }

                const source = createSource({ url: u, title: sourceTitle, raw_content: sourceText, processed: 0 })
                const result = await runIngestAgent(sourceText, source.id)
                createLog({ source_id: source.id, pages_created: result.pagesCreated, pages_updated: 0, message: `Successfully created ${result.pagesCreated} pages.` })
                allPages = allPages.concat(result.pages)
                totalCreated += result.pagesCreated
                if (result.pages.some((p: any) => !p.indexed)) hasIndexingWarning = true
              } catch (e: any) {
                urlErrors.push(`${u}: ${e.message}`)
              }
            }

            if (urlErrors.length > 0 && allPages.length === 0) {
              throw new Error(urlErrors.join(' | '))
            }
            if (urlErrors.length > 0) hasIndexingWarning = true

          // ── Branch 3: Plain text ──────────────────────────────────────────
          } else if (text) {
            if (!text.trim()) throw new Error('Source text is empty')
            send('Saving source to local database...')
            const source = createSource({ url: null, title: 'Manual Text Entry', raw_content: text, processed: 0 })
            send('AI is analyzing content...')
            const result = await runIngestAgent(text, source.id)
            send('Storing logs...')
            createLog({ source_id: source.id, pages_created: result.pagesCreated, pages_updated: 0, message: `Successfully created ${result.pagesCreated} pages.` })
            allPages = result.pages
            totalCreated = result.pagesCreated
            hasIndexingWarning = result.pages.some((p: any) => !p.indexed)
          } else {
            throw new Error('Must provide text, url, or a file')
          }
        }

        // ── Consistency check ───────────────────────────────────────────────
        send('Checking consistency...')
        let allExistingSlugs: string[] = []
        try {
          const res = (await hydra.fetch.listData({ tenant_id: 'default', kind: 'knowledge', page: 1, page_size: 100 })) as any
          const items: any[] = res?.sources ?? []
          allExistingSlugs = items.map((item: any) => (item.document_metadata?.slug as string) || item.id)
        } catch (e) {
          console.warn('Failed to fetch slugs for consistency check', e)
        }

        const newSlugs = allPages.map((p: any) => p.slug)
        const existingSlugs = allExistingSlugs.filter(s => !newSlugs.includes(s))
        const consistency = await runConsistencyCheck(allPages, existingSlugs.slice(0, 20))

        send(JSON.stringify({
          final: true,
          pagesCreated: totalCreated,
          pages: allPages,
          warning: hasIndexingWarning ? 'Some pages may still be indexing. Wait 30s before querying.' : null,
          consistency: {
            contradictionsFound: consistency.contradictions,
            pagesAutoUpdated: consistency.updated,
            pagesFlaggedForReview: consistency.flagged,
          },
        }))
        controller.close()
      } catch (error: any) {
        console.error('[ingest] Error:', error?.stack ?? error)
        const msg = (error as Error).message || ''

        if (msg.includes('exhausted') || msg.includes('quota') || msg.includes('429')) {
          send(JSON.stringify({
            error: 'All AI models are rate-limited right now. Please wait 1 minute and try again.',
            code: 'QUOTA_EXHAUSTED',
            retryAfter: 60,
          }))
        } else {
          send(JSON.stringify({
            error: `Ingest failed: ${msg.slice(0, 200)}`,
            code: 'INGEST_ERROR',
          }))
        }
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
