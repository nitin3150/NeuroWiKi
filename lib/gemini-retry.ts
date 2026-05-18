function isQuotaError(err: unknown): boolean {
  const msg = (err as any)?.message ?? (err as any)?.toString() ?? ''
  const status = (err as any)?.status ?? (err as any)?.statusCode ?? 0
  return status === 429 || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')
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

      const backoff = [15000, 30000, 45000][i] ?? 45000
      console.warn(`[gemini-retry] Quota error hit. Retry attempt ${i + 1}/${MAX_RETRIES} - waiting ${backoff / 1000}s before retrying. Error: ${(err as any)?.message || err}`)
      await new Promise(r => setTimeout(r, backoff))
    }
  }

  if (isQuotaError(lastErr)) {
    throw new Error(`AI quota reached after 3 retry attempts. Last error: ${(lastErr as any)?.message || lastErr}`)
  }
  throw lastErr
}
