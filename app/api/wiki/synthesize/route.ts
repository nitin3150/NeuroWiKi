import { NextRequest, NextResponse } from 'next/server'
import { hydra, ensureTenant, waitForIngestion } from '@/lib/hydra'
import { upsertPageHealth, upsertPageLinks } from '@/lib/db-helpers'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

export async function POST(req: NextRequest) {
  try {
    const { question, answer, sourceChunks } = await req.json()
    if (!question?.trim() || !answer?.trim()) {
      return NextResponse.json({ error: 'question and answer required' }, { status: 400 })
    }

    await ensureTenant('default')

    const slug = `synthesis-${slugify(question.slice(0, 40))}`
    const title = question.length > 60 ? question.slice(0, 57) + '...' : question

    const sources = (sourceChunks ?? [])
      .slice(0, 5)
      .map((c: any, i: number) => `${i + 1}. ${c.source_title ?? 'Source ' + (i + 1)}`)
      .join('\n')

    const content = `## Question\n${question}\n\n## Answer\n${answer}${sources ? `\n\n## Sources\n${sources}` : ''}`

    const uploadResponse = await hydra.upload.knowledge({
      tenant_id: 'default',
      upsert: true,
      app_knowledge: JSON.stringify([{
        tenant_id: 'default',
        sub_tenant_id: 'default',
        id: slug,
        title,
        type: 'document',
        content: { markdown: `# ${title}\n\n${content}` },
        document_metadata: {
          category: 'synthesis',
          summary: answer.slice(0, 200),
          slug,
          synthesizedAt: new Date().toISOString(),
        },
      }]),
    }) as any

    const realSourceId = uploadResponse?.results?.[0]?.source_id ?? slug
    const ready = await waitForIngestion(realSourceId, 'default')

    upsertPageHealth({
      slug,
      title,
      type: 'synthesis',
      summary: answer.slice(0, 200),
      confidence: ready ? 100 : 60,
      hydra_doc_id: realSourceId,
    })

    // Extract any [[wikilinks]] from the answer
    const linkedSlugs = [...answer.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1].trim())
    if (linkedSlugs.length) upsertPageLinks(slug, linkedSlugs)

    return NextResponse.json({ slug, title, ok: true })
  } catch (error: any) {
    console.error('[synthesize] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
