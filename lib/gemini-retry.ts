function isQuotaError(err: unknown): boolean {
  const msg = (err as any)?.message ?? (err as any)?.toString() ?? ''
  const status = (err as any)?.status ?? (err as any)?.statusCode ?? 0
  return status === 429 || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')
}

function parseRetryAfterMs(err: unknown): number {
  const msg = (err as any)?.message ?? (err as any)?.toString() ?? ''
  // Gemini errors: "Please retry after 28 seconds" / "retry in 30s" / "retryDelay: \"35s\""
  const match = msg.match(/retry(?:\s+after|(?:\s+in)?)[\s:\"]*(\d+(?:\.\d+)?)\s*s/i)
  if (match) return Math.ceil(parseFloat(match[1])) * 1000
  return 0
}

export async function withGeminiRetry<T>(fn: () => Promise<T>): Promise<T> {
  const MAX_RETRIES = 3
  let lastErr: unknown

  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isQuotaError(err) || i === MAX_RETRIES) break

      // Use the API-specified delay if present, otherwise exponential: 15s → 30s → 60s
      const apiDelay = parseRetryAfterMs(err)
      const backoff = apiDelay || ([15000, 30000, 60000][i] ?? 60000)
      console.warn(`[gemini-retry] Quota hit, waiting ${backoff / 1000}s (attempt ${i + 1}/${MAX_RETRIES})`)
      await new Promise(r => setTimeout(r, backoff))
    }
  }

  if (isQuotaError(lastErr)) {
    throw new Error('AI quota reached — please wait a moment and try again.')
  }
  throw lastErr
}
