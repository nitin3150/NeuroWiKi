import { hydra } from '@/lib/hydra'
import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const { question } = await req.json()
  if (!question?.trim()) return Response.json({ error: 'No question' }, { status: 400 })

  let contextChunks: any[] = []
  let recallStrategy = 'vector'

  // Strategy 1: graph-aware recall
  try {
    const res = await hydra.recall.fullRecall({
      tenant_id: 'default',
      query: question,
      max_results: 8,
      graph_context: true,
    })
    if (res?.chunks && res.chunks.length > 0) {
      contextChunks = res.chunks
      recallStrategy = 'graph_context'
    }
  } catch {
    // fall through to vector
  }

  // Strategy 2: pure vector recall
  if (contextChunks.length === 0) {
    try {
      const res = await hydra.recall.fullRecall({
        tenant_id: 'default',
        query: question,
        max_results: 6,
      })
      contextChunks = res?.chunks ?? []
      recallStrategy = 'vector_fallback'
    } catch {
      // fall through to SQLite
    }
  }

  // Strategy 3: SQLite keyword search
  if (contextChunks.length === 0) {
    const { getAllPages } = await import('@/lib/db-helpers')
    const allPages = getAllPages()
    const words = question.toLowerCase().split(' ').filter((w: string) => w.length > 3)
    contextChunks = allPages
      .filter((p: any) => words.some((w: string) =>
        p.title?.toLowerCase().includes(w) ||
        p.summary?.toLowerCase().includes(w)
      ))
      .slice(0, 6)
      .map((p: any) => ({ chunk_content: p.content, source_title: p.title }))
    recallStrategy = 'sqlite_fallback'
  }

  db.prepare(`
    INSERT INTO query_logs (question, pages_considered, pages_used, recall_strategy)
    VALUES (?, ?, ?, ?)
  `).run(question, contextChunks.length, contextChunks.length, recallStrategy)

  if (contextChunks.length === 0) {
    return Response.json({
      error: 'No relevant pages found in wiki. Add more sources first.',
      strategy: recallStrategy
    }, { status: 404 })
  }

  const context = contextChunks
    .map((c: any, i: number) =>
      `[Page ${i + 1}${c.source_title ? ` — ${c.source_title}` : ''}]:\n${c.chunk_content || c.content || ''}`
    )
    .join('\n\n---\n\n')

  const systemPrompt = `You are a wiki assistant that ONLY answers from the provided wiki pages.
Never use outside knowledge.
Always cite which page your answer comes from using format: (Source: Page N — Title)
If the answer is not in the wiki, say "This isn't covered in the wiki yet. Try adding more sources."
Keep answers concise and factual.`

  const stream = streamText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    prompt: `Question: ${question}\n\nWiki context:\n${context}`,
    maxOutputTokens: 600,
  })

  return stream.toTextStreamResponse()
}
