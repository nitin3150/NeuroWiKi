import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { hydra } from '@/lib/hydra'

export interface ExistingPage {
  slug: string
  title: string
  content: string
  summary: string
  type: string
  sourceSentences: string[]
}

const MergeSchema = z.object({
  content: z.string().describe('Merged markdown, encyclopedic style'),
  summary: z.string().describe('Updated one sentence summary'),
  sourceSentences: z.array(z.string()).describe(
    'Array combining ALL previous source sentences PLUS new exact quotes from the new source backing new claims'
  ),
})

export async function findExistingPage(
  slug: string,
  tenantId: string = 'default'
): Promise<ExistingPage | null> {
  try {
    const res = await hydra.recall.booleanRecall({
      tenant_id: tenantId,
      query: slug,
      operator: 'and',
    }) as any
    const sources: any[] = res?.sources ?? []
    const match = sources.find(
      (s) => (s.additional_metadata?.slug ?? s.id) === slug
    )
    if (!match) return null

    // Try to recover sourceSentences from stored metadata
    const meta = match.additional_metadata ?? {}
    const rawSentences = meta.sourceSentences
    const sourceSentences: string[] = Array.isArray(rawSentences) ? rawSentences : []

    return {
      slug,
      title: match.title ?? '',
      content: match.description ?? match.content?.markdown ?? '',
      summary: meta.summary ?? '',
      type: meta.category ?? 'concept',
      sourceSentences,
    }
  } catch {
    return null
  }
}

export async function absorbIntoExisting(
  existingPage: ExistingPage,
  newPage: { title: string; content: string; sourceSentences: string[] },
  sourceText: string,
  availableSlugs: string[] = []
): Promise<{ content: string; summary: string; sourceSentences: string[] }> {
  const existingCitations = existingPage.sourceSentences.length > 0
    ? existingPage.sourceSentences.map(s => `- "${s}"`).join('\n')
    : '- None'

  const slugList = availableSlugs.length > 0
    ? availableSlugs.join(', ')
    : '(no slugs available — do not add wikilinks)'

  const { object } = await generateObject({
    model: google('gemini-2.5-flash'),
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    schema: MergeSchema,
    prompt: `You are an expert wiki editor updating an existing knowledge base page with new information.

=== EXISTING PAGE STATE ===
Summary: ${existingPage.summary}
Content:
"""
${existingPage.content}
"""
Existing Citations (MUST BE RETAINED in output):
${existingCitations}

=== NEW INFORMATION EXTRACTED ===
"""
${newPage.content}
"""

=== NEW RAW SOURCE TEXT (GROUND TRUTH FOR NEW CLAIMS) ===
"""
${sourceText.slice(0, 4000)}
"""

=== AVAILABLE WIKI LINKS ===
You may ONLY create new [[wikilinks]] using these exact slugs:
${slugList}

=== MERGE RULES ===
1. PRESERVE FACTS: Keep existing facts unless explicitly contradicted by the new source text.
2. CONTRADICTION HANDLING: If the new source explicitly updates or contradicts the existing page, prioritize the new source but frame chronologically (e.g., "Previously X; as of [context], Y").
3. NO HALLUCINATION: Every new sentence MUST trace to the new raw source text above.
4. NO DUPLICATION: Weave new facts naturally — do not repeat existing information.
5. WIKILINKS: Preserve all existing [[wikilinks]]. Only add NEW wikilinks if the slug appears in the AVAILABLE WIKI LINKS list.
6. CITATIONS: Your 'sourceSentences' output MUST include ALL existing citations listed above PLUS 1-4 new exact quotes from the new raw source text backing newly added claims.

Return unified content, updated summary, and combined sourceSentences.`,
  })

  return {
    content: object.content,
    summary: object.summary,
    sourceSentences: object.sourceSentences,
  }
}
