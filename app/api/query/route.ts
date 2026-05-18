import { hydra } from '@/lib/hydra'
import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const { question } = await req.json()
  if (!question?.trim()) return Response.json({ error: 'No question' }, { status: 400 })

  // Strategy 1: Try graph-aware recall first (uses entity relationships)
  let contextPages: any[] = []
  let recallStrategy = 'vector'

  try {
    const graphRecall = await (hydra as any).recall({
      query: question,
      limit: 8,
      graph_context: true,   // uses graph relationships not just vector similarity
    })
    
    if (graphRecall?.results?.length > 0) {
      contextPages = graphRecall.results
      recallStrategy = 'graph_context'
    }
  } catch {
    // Graph recall failed, fall back to vector
  }

  // Strategy 2: Fall back to pure vector if graph returned nothing
  if (contextPages.length === 0) {
    try {
      const vectorRecall = await (hydra as any).recall({
        query: question,
        limit: 6,
      })
      contextPages = vectorRecall?.results || []
      recallStrategy = 'vector_fallback'
    } catch {
      // Both failed — fall back to SQLite keyword search
      const { getAllPages } = await import('@/lib/db-helpers')
      const allPages = getAllPages()
      const words = question.toLowerCase().split(' ').filter((w: string) => w.length > 3)
      contextPages = allPages
        .filter((p: any) => words.some((w: string) => 
          p.title?.toLowerCase().includes(w) || 
          p.summary?.toLowerCase().includes(w)
        ))
        .slice(0, 6)
        .map((p: any) => ({ content: p.content, metadata: p }))
      recallStrategy = 'sqlite_fallback'
    }
  }

  // Log the query for observability
  db.prepare(`
    INSERT INTO query_logs 
    (question, pages_considered, pages_used, recall_strategy)
    VALUES (?, ?, ?, ?)
  `).run(question, contextPages.length, contextPages.length, recallStrategy)

  if (contextPages.length === 0) {
    return Response.json({
      error: 'No relevant pages found in wiki. Add more sources first.',
      strategy: recallStrategy
    }, { status: 404 })
  }

  const context = contextPages
    .map((r: { content?: string; metadata?: { title?: string } }, i: number) => 
      `[Page ${i + 1}${r.metadata?.title ? ` — ${r.metadata.title}` : ''}]:\n${r.content || ''}`
    )
    .join('\n\n---\n\n')

  const systemPrompt = `You are a wiki assistant that ONLY answers from the provided wiki pages.
Never use outside knowledge.
Always cite which page your answer comes from using format: (Source: Page N — Title)
If the answer is not in the wiki, say "This isn't covered in the wiki yet. Try adding more sources."
Keep answers concise and factual.`

  const stream = streamText({
    model: google('gemini-2.0-flash'),
    system: systemPrompt,
    prompt: `Question: ${question}\n\nWiki context:\n${context}`,
    maxOutputTokens: 600,
  })

  return stream.toTextStreamResponse()
}
