import { NextRequest, NextResponse } from 'next/server'
import { hydra } from '@/lib/hydra'
import { upsertPageLinks } from '@/lib/db-helpers'
import { findExistingPage } from '@/lib/agents/absorb-agent'

async function connectPageToGraph(
  islandSlug: string,
  islandSlugs: Set<string>
): Promise<{ connected: boolean; linkedTo?: string }> {
  const existing = await findExistingPage(islandSlug)
  if (!existing || !existing.content) return { connected: false }

  // Find related pages outside the island
  const related = await hydra.recall.fullRecall({
    tenant_id: 'default',
    query: `${existing.title} ${existing.summary}`,
    max_results: 8,
  }) as any

  const candidates = (related?.sources ?? [])
    .map((s: any) => ({ id: s.id, title: s.title ?? s.id }))
    .filter((s: any) => !islandSlugs.has(s.id) && s.id !== islandSlug)
    .slice(0, 3)

  if (candidates.length === 0) return { connected: false }

  const best = candidates[0]

  // Append See Also section — no AI needed, no rate limit risk
  const alreadyLinked = existing.content.includes(`[[${best.id}]]`)
  const updatedContent = alreadyLinked
    ? existing.content
    : existing.content.trimEnd() + `\n\n## See Also\n- [[${best.id}]]`

  await hydra.upload.knowledge({
    tenant_id: 'default',
    upsert: true,
    app_knowledge: JSON.stringify([{
      tenant_id: 'default',
      sub_tenant_id: 'default',
      id: islandSlug,
      title: existing.title,
      type: 'document',
      content: { markdown: updatedContent },
      document_metadata: {
        category: existing.type,
        summary: existing.summary,
        slug: islandSlug,
        verifiedAt: new Date().toISOString(),
      },
    }]),
  })

  upsertPageLinks(islandSlug, [best.id])

  return { connected: true, linkedTo: best.title }
}

export async function POST(req: NextRequest) {
  try {
    const { slugs } = await req.json()
    if (!slugs?.length) return NextResponse.json({ error: 'slugs required' }, { status: 400 })

    const islandSlugs = new Set<string>(slugs)
    const results: Array<{ slug: string; connected: boolean; linkedTo?: string }> = []

    for (const slug of slugs) {
      const result = await connectPageToGraph(slug, islandSlugs)
      results.push({ slug, ...result })
    }

    const connected = results.filter(r => r.connected).length
    return NextResponse.json({ ok: true, connected, total: slugs.length, results })
  } catch (error: any) {
    console.error('[fix-islands]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
