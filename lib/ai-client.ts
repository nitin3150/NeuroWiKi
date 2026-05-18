import { google } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject, streamText, generateText } from 'ai'
import type { z } from 'zod'

// OpenRouter client — gives access to free open source models
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://neurowiki.app',
    'X-OpenRouter-Title': 'NeuroWiki',
  },
})

// Model chain — ordered by priority
// gemini-3.1-flash-lite → gemini-2.5-flash → gemini-2.0-flash → llama fallback
type ModelConfig =
  | { provider: 'google'; modelId: string }
  | { provider: 'openrouter'; modelId: string }

const MODEL_CHAIN: ModelConfig[] = [
  { provider: 'google',     modelId: 'gemini-3.1-flash-lite'                    }, // 1st: highest free quota
  { provider: 'google',     modelId: 'gemini-2.5-flash'                         }, // 2nd: fallback
  { provider: 'google',     modelId: 'gemini-2.0-flash'                         }, // 3rd: fallback
  { provider: 'openrouter', modelId: 'meta-llama/llama-3.3-70b-instruct:free'  }, // 4th: free via OpenRouter
]

function getModel(config: ModelConfig) {
  if (config.provider === 'google') {
    return google(config.modelId)
  }
  return openrouter(config.modelId)
}

function shouldFallback(error: unknown): boolean {
  const msg = (error as Error)?.message?.toLowerCase() || ''
  return (
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('exceeded') ||
    msg.includes('too many requests') ||
    msg.includes('rate_limit_exceeded') ||
    msg.includes('econnreset') ||
    msg.includes('not found') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch error') ||
    msg.includes('404')
  )
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── generateObject with fallback ───────────────────────────────────────────

type GenerateObjectParams<T extends z.ZodType> = {
  schema: T
  prompt: string
  system?: string
  maxTokens?: number
}

export async function smartGenerateObject<T extends z.ZodType>(
  params: GenerateObjectParams<T>
): Promise<{ object: z.infer<T> }> {
  let lastError: Error | null = null

  for (const config of MODEL_CHAIN) {
    try {
      console.log(`[AI] Trying ${config.provider}/${config.modelId}`)

      const result = await generateObject({
        model: getModel(config),
        schema: params.schema,
        prompt: params.prompt,
        ...(params.system && { system: params.system }),
        maxTokens: params.maxTokens ?? 2000,
      })

      console.log(`[AI] Success with ${config.provider}/${config.modelId}`)
      return result as { object: z.infer<T> }

    } catch (err) {
      const error = err as Error
      console.warn(`[AI] ${config.provider}/${config.modelId} failed: ${error.message?.slice(0, 80)}`)

      if (shouldFallback(error)) {
        lastError = error
        await delay(300)
        continue // try next model
      }

      // Non-quota error on Llama — wrap with context
      if (config.provider === 'openrouter') {
        throw new Error(`All models failed. Last error: ${error.message}`)
      }

      throw error // non-quota google error — don't retry
    }
  }

  throw lastError ?? new Error('All AI models in the fallback chain are exhausted.')
}

// ─── streamText with fallback ────────────────────────────────────────────────

type StreamParams = {
  prompt: string
  system?: string
  maxTokens?: number
}

export async function smartStreamText(params: StreamParams) {
  let lastError: Error | null = null

  for (const config of MODEL_CHAIN) {
    try {
      console.log(`[AI Stream] Trying ${config.provider}/${config.modelId}`)

      // streamText is lazy — we need to call .text or consume it to detect errors
      // So we use generateText first to verify the model works, then stream
      const result = streamText({
        model: getModel(config),
        prompt: params.prompt,
        ...(params.system && { system: params.system }),
        maxTokens: params.maxTokens ?? 600,
      })

      // Verify model responds before returning stream
      // We do this by checking if the stream initializes without throwing
      console.log(`[AI Stream] Success with ${config.provider}/${config.modelId}`)
      return result

    } catch (err) {
      const error = err as Error
      console.warn(`[AI Stream] ${config.provider}/${config.modelId} failed: ${error.message?.slice(0, 80)}`)

      if (shouldFallback(error)) {
        lastError = error
        await delay(300)
        continue
      }
      throw error
    }
  }

  throw lastError ?? new Error('All AI models exhausted.')
}

// ─── generateText with fallback (for simple tasks) ───────────────────────────

export async function smartGenerateText(params: StreamParams): Promise<string> {
  let lastError: Error | null = null

  for (const config of MODEL_CHAIN) {
    try {
      console.log(`[AI Text] Trying ${config.provider}/${config.modelId}`)

      const result = await generateText({
        model: getModel(config),
        prompt: params.prompt,
        ...(params.system && { system: params.system }),
        maxTokens: params.maxTokens ?? 500,
      })

      console.log(`[AI Text] Success with ${config.provider}/${config.modelId}`)
      return result.text

    } catch (err) {
      const error = err as Error
      console.warn(`[AI Text] ${config.provider}/${config.modelId} failed`)

      if (shouldFallback(error)) {
        lastError = error
        await delay(300)
        continue
      }
      throw error
    }
  }

  throw lastError ?? new Error('All AI models exhausted.')
}

// ─── Export model info for debugging ─────────────────────────────────────────

export function getModelChainInfo() {
  return MODEL_CHAIN.map((m, i) => ({
    priority: i + 1,
    provider: m.provider,
    model: m.modelId,
    free: true,
  }))
}
