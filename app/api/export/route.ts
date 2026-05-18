import JSZip from 'jszip'
import { db } from '@/lib/db'
import { hydra } from '@/lib/hydra'

function extractMarkdown(chunkContent: string): string {
  try {
    const doc = JSON.parse(chunkContent)
    return doc?.content?.markdown ?? ''
  } catch {
    return chunkContent
  }
}

async function fetchPageContent(slug: string): Promise<string> {
  const res = await hydra.recall.booleanRecall({
    tenant_id: 'default',
    query: slug,
    operator: 'and',
  }) as any

  const sources: any[] = res?.sources ?? []
  const match =
    sources.find((s: any) => s.additional_metadata?.slug === slug || s.id === slug) ??
    sources[0]

  if (!match) return ''

  const chunks: any[] = (res?.chunks ?? []).filter((c: any) => c.source_id === match.id)
  const firstChunk = chunks[0]
  const parsedDoc = firstChunk
    ? (() => { try { return JSON.parse(firstChunk.chunk_content) } catch { return null } })()
    : null

  return parsedDoc?.content?.markdown
    || chunks.map(c => extractMarkdown(c.chunk_content)).filter(Boolean).join('\n\n')
    || ''
}

export async function GET() {
  const pages = db.prepare('SELECT slug, title, type, summary, updated_at FROM pages').all() as Array<{
    slug: string
    title: string
    type: string
    summary: string | null
    updated_at: string
  }>

  // Fetch all page content from HydraDB in parallel
  const contentResults = await Promise.allSettled(
    pages.map(p => fetchPageContent(p.slug))
  )

  const zip = new JSZip()
  const folder = zip.folder('neurowiki-export')!

  pages.forEach((page, i) => {
    const result = contentResults[i]
    const rawContent = result.status === 'fulfilled' ? result.value : ''
    if (result.status === 'rejected') {
      console.warn(`[export] Failed to fetch content for ${page.slug}:`, result.reason)
    }

    const frontmatter = [
      '---',
      `title: "${page.title}"`,
      `slug: ${page.slug}`,
      `type: ${page.type}`,
      `summary: "${(page.summary ?? '').replace(/"/g, "'")}"`,
      `updated: ${page.updated_at ?? new Date().toISOString()}`,
      '---',
      '',
    ].join('\n')

    // Strip leading heading — ingest writes "# Title\n\n..." which duplicates frontmatter title
    const body = rawContent.replace(/^#\s+.+\n+/, '')

    folder.file(`${page.slug}.md`, frontmatter + body)
  })

  const buffer = await zip.generateAsync({ type: 'uint8array' })

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="neurowiki-export.zip"',
    },
  })
}
