import { NextRequest } from 'next/server'
import { getStalePages, getFlaggedPages, getAllPages, getAllPageLinks } from '@/lib/db-helpers'
import { hydra } from '@/lib/hydra'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const staleDays = parseInt(url.searchParams.get('staleDays') || '30', 10)
  const skipDrift = url.searchParams.get('skipDrift') === '1'

  const stale = getStalePages(staleDays)
  const flagged = getFlaggedPages()
  const all = getAllPages()

  const pageSlugSet = new Set(all.map(p => p.slug))
  const missingPages = [...new Set(
    getAllPageLinks()
      .map(l => l.target_slug.toLowerCase().replace(/\s+/g, '-'))
      .filter(slug => !pageSlugSet.has(slug))
  )]

  const base = {
    totalPages: all.length,
    stalePages: stale.length,
    flaggedPages: flagged.length,
    healthScore: Math.round(((all.length - stale.length - flagged.length) / Math.max(all.length, 1)) * 100),
    stale: stale.map(p => ({ slug: p.slug, title: p.title, last_validated: p.last_validated })),
    flagged: flagged.map(p => ({ slug: p.slug, title: p.title, stale_reason: p.stale_reason, confidence: p.confidence })),
    missingPages: missingPages.slice(0, 20),
    missingCount: missingPages.length,
  }

  // Return SQLite-only stats immediately when skipDrift=1
  if (skipDrift) {
    return Response.json({ ...base, syncWarning: null })
  }

  // Full drift check against HydraDB
  let hydraCount = 0
  let syncWarning = null
  try {
    const res = await hydra.fetch.listData({
      tenant_id: 'default',
      kind: 'knowledge',
      page: 1,
      page_size: 100,
    }) as any
    hydraCount = (res?.sources ?? []).length

    if (hydraCount > all.length) {
      syncWarning = `Database drift detected: HydraDB contains ${hydraCount} pages but local SQLite index only has ${all.length}. Ingestion may have crashed before indexing finished.`
    } else if (hydraCount < all.length) {
      syncWarning = `Database drift detected: SQLite index contains ${all.length} pages but HydraDB only has ${hydraCount}.`
    }
  } catch (e: any) {
    const is404 = e?.statusCode === 404 || e?.body?.detail?.error_code === 'NOT_FOUND'
    if (!is404) console.error('Failed to reconcile with HydraDB', e)
  }

  const displayTotal = hydraCount > all.length ? hydraCount : all.length

  return Response.json({
    ...base,
    totalPages: displayTotal,
    healthScore: Math.round(((displayTotal - stale.length - flagged.length) / Math.max(displayTotal, 1)) * 100),
    syncWarning,
  })
}
