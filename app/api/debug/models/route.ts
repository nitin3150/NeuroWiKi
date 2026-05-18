import { getModelChainInfo } from '@/lib/ai-client'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return Response.json({ error: 'Dev only' }, { status: 403 })
  }
  return Response.json({
    modelChain: getModelChainInfo(),
    env: {
      googleKeySet: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      openrouterKeySet: !!process.env.OPENROUTER_API_KEY,
    }
  })
}
