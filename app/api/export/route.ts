import JSZip from 'jszip'
import { db } from '@/lib/db'

export async function GET() {
  const pages = db.prepare('SELECT * FROM pages').all() as any[]
  const zip = new JSZip()
  const folder = zip.folder('neurowiki-export')!

  for (const page of pages) {
    const frontmatter = [
      '---',
      `title: ${page.title}`,
      `slug: ${page.slug}`,
      `type: ${page.type}`,
      `summary: ${page.summary || ''}`,
      `updated: ${page.updated_at || new Date().toISOString()}`,
      '---',
      '',
    ].join('\n')
    folder.file(`${page.slug}.md`, frontmatter + (page.content || ''))
  }

  const blob = await zip.generateAsync({ type: 'nodebuffer' })

  return new Response(blob, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="neurowiki-export.zip"',
    },
  })
}
