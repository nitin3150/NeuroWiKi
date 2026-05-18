import JSZip from 'jszip'
import { db } from '@/lib/db'
import { hydra } from '@/lib/hydra'

function extractMarkdown(chunkContent: string): string {
  try {
    const doc = JSON.parse(chunkContent)
    return doc?.content?.markdown ?? ''
  } catch {
    // chunk_content is plain text, not JSON — use as-is
    return chunkContent
  }
}

export async function GET() {
  const pages = db.prepare('SELECT slug, title, type, summary, updated_at FROM pages').all() as Array<{
    slug: string
    title: string
    type: string
    summary: string | null
    updated_at: string
  }>

  const zip = new JSZip()
  const folder = zip.folder('neurowiki-export')!

  for (const page of pages) {
    let content = ''

    try {
      const res = await hydra.recall.booleanRecall({
        tenant_id: 'default',
        query: page.slug,
        operator: 'and',
      }) as any

      const sources: any[] = res?.sources ?? []
      const match =
        sources.find((s: any) => s.additional_metadata?.slug === page.slug || s.id === page.slug) ??
        sources[0]

      if (match) {
        const chunks: any[] = (res?.chunks ?? []).filter((c: any) => c.source_id === match.id)
        const firstChunk = chunks[0]
        const parsedDoc = firstChunk
          ? (() => { try { return JSON.parse(firstChunk.chunk_content) } catch { return null } })()
          : null

        content = parsedDoc?.content?.markdown
          || chunks.map(c => extractMarkdown(c.chunk_content)).filter(Boolean).join('\n\n')
          || ''
      }
    } catch (e) {
      console.warn(`[export] Failed to fetch content for ${page.slug}:`, e)
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

    // Strip leading heading if it duplicates the title (ingest writes "# Title\n\n...")
    const body = content.replace(/^#\s+.+\n+/, '')

    folder.file(`${page.slug}.md`, frontmatter + body)
  }

  const buffer = await zip.generateAsync({ type: 'uint8array' })

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="neurowiki-export.zip"',
    },
  })
}
