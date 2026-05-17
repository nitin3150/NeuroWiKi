import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { hydra } from '@/lib/hydra'

const ContradictionSchema = z.object({
  contradictions: z.array(z.object({
    existingPageSlug: z.string(),
    existingClaim: z.string(),
    newClaim: z.string(),
    severity: z.enum(['minor', 'major', 'critical']),
    recommendation: z.enum(['update_existing', 'add_note', 'flag_for_review']),
    suggestedUpdate: z.string().optional(),
  })),
  stalePagesSlug: z.array(z.string()),
  consistencyScore: z.number().min(0).max(100),
})

async function getPageBySlug(slug: string) {
  try {
    const res = await hydra.fetch.listData({
      tenant_id: 'default',
      kind: 'knowledge',
      source_ids: [slug],
    }) as any
    const item = (res?.sources ?? [])[0]
    if (item) {
      return {
        slug,
        title: item.title || '',
        content: item.content?.markdown || item.content?.text || '',
        type: item.document_metadata?.category || 'concept',
        summary: item.document_metadata?.summary || '',
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch page ${slug} for consistency check:`, error)
  }
  return null
}

async function upsertPage(page: any) {
  await hydra.upload.knowledge({
    tenant_id: 'default',
    app_knowledge: JSON.stringify([{
      tenant_id: 'default',
      sub_tenant_id: 'default',
      id: page.slug,
      title: page.title,
      type: 'document',
      content: { markdown: page.content },
      document_metadata: {
        category: page.type,
        summary: page.summary,
        slug: page.slug,
        updated_at: page.updated_at,
      },
    }])
  })
}

export async function runConsistencyCheck(
  newPages: Array<{ slug: string; title: string; content: string }>,
  existingPageSlugs: string[]
): Promise<{
  contradictions: number
  updated: number
  flagged: string[]
}> {
  // Get existing pages that are topically related
  const relatedPages = []
  for (const slug of existingPageSlugs.slice(0, 15)) {
    const page = await getPageBySlug(slug)
    if (page) relatedPages.push(page)
  }
  
  if (relatedPages.length === 0 || newPages.length === 0) {
    return { contradictions: 0, updated: 0, flagged: [] }
  }

  const prompt = `
You are a knowledge base consistency checker.

NEW PAGES JUST INGESTED:
${newPages.map(p => `[${p.title}]\n${p.content}`).join('\n\n---\n\n')}

EXISTING WIKI PAGES:
${relatedPages.map(p => `[${p.title}] (slug: ${p.slug})\n${p.content}`).join('\n\n---\n\n')}

Tasks:
1. Find any factual contradictions between new pages and existing pages
2. Identify existing pages that are now stale or outdated
3. Rate the overall consistency score (100 = perfect, 0 = major conflicts)
4. For each contradiction, suggest whether to update the existing page or flag for review

Be conservative — only flag genuine contradictions, not just different phrasings.
Return JSON only.
`

  const { object } = await generateObject({
    model: google('gemini-2.5-flash'),
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    schema: ContradictionSchema,
    prompt,
  })

  const flagged: string[] = []
  let updated = 0

  for (const contradiction of object.contradictions) {
    if (contradiction.severity === 'critical' || contradiction.severity === 'major') {
      flagged.push(contradiction.existingPageSlug)
    }

    if (
      contradiction.recommendation === 'update_existing' &&
      contradiction.suggestedUpdate &&
      contradiction.severity !== 'critical'
    ) {
      const existing = await getPageBySlug(contradiction.existingPageSlug)
      if (existing) {
        await upsertPage({
          ...existing,
          content: existing.content + `\n\n> **Updated:** ${contradiction.suggestedUpdate}`,
          updated_at: new Date().toISOString(),
        })
        updated++
      }
    }
  }

  return {
    contradictions: object.contradictions.length,
    updated,
    flagged,
  }
}
