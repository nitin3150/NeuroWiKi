'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { WordsPullUp } from '@/components/animations/WordsPullUp'
import { FadeUp } from '@/components/animations/FadeUp'

type LintReport = {
  orphans: Array<{ slug: string; title: string }>
  islands: Array<{ slugs: string[]; titles: string[] }>
  gaps: Array<{ entity: string; mentionedIn: string[] }>
  stale: Array<{ slug: string; title: string; type: string; daysSince: number }>
  missingLinks: Array<{ fromSlug: string; mentionedEntity: string }>
  score: number
  totalPages: number
  incrementalPages: number
}

export default function AuditPage() {
  const [audit, setAudit] = useState<{
    totalPages: number
    stalePages: number
    flaggedPages: number
    healthScore: number
    syncWarning: string | null
    stale: Array<{ slug: string; title: string; last_validated: string }>
    flagged: Array<{ slug: string; title: string; stale_reason: string; confidence: number }>
  } | null>(null)

  const [lint, setLint] = useState<LintReport | null>(null)
  const [lintLoading, setLintLoading] = useState(false)
  const [lintError, setLintError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/audit').then(r => r.json()).then(setAudit)
  }, [])

  const runLint = async () => {
    setLintLoading(true)
    setLintError(null)
    try {
      const res = await fetch('/api/lint')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setLint(data)
    } catch (e: any) {
      setLintError(e.message)
    } finally {
      setLintLoading(false)
    }
  }

  return (
    <div className="bg-black min-h-screen p-8 pt-16">
      <h1 className="font-medium mb-2"
        style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', color: '#E1E0CC' }}>
        <WordsPullUp text="Wiki Health." />
      </h1>
      <FadeUp delay={0.3}>
        <p className="font-serif-italic text-lg mb-12" style={{ color: 'rgba(222,219,200,0.5)' }}>
          What needs pruning. What needs updating.
        </p>
      </FadeUp>

      {audit && (
        <>
          {audit.syncWarning && (
            <FadeUp delay={0.35}>
              <div className="mb-8 bg-amber-950/30 border border-amber-900/50 rounded-xl p-4 flex items-start gap-3">
                <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                <p className="text-xs text-amber-200/80 leading-relaxed">{audit.syncWarning}</p>
              </div>
            </FadeUp>
          )}

          {/* Health score */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-12">
            {[
              { label: 'Total Pages', value: audit.totalPages },
              { label: 'Health Score', value: `${audit.healthScore}%` },
              { label: 'Stale Pages', value: audit.stalePages },
              { label: 'Flagged Pages', value: audit.flaggedPages },
            ].map((stat, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className="bg-[#111] rounded-2xl p-5">
                  <p className="text-[9px] tracking-[0.3em] uppercase mb-2"
                    style={{ color: 'rgba(222,219,200,0.3)' }}>{stat.label}</p>
                  <p className="text-3xl font-medium" style={{ color: '#E1E0CC' }}>{stat.value}</p>
                </div>
              </FadeUp>
            ))}
          </div>

          {/* Stale pages */}
          {audit.stale.length > 0 && (
            <div className="mb-8">
              <p className="text-[9px] tracking-[0.3em] uppercase mb-4"
                style={{ color: 'rgba(222,219,200,0.3)' }}>
                STALE PAGES (not validated in 30+ days)
              </p>
              <div className="space-y-2">
                {audit.stale.map(page => (
                  <div key={page.slug}
                    className="bg-[#111] rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm" style={{ color: '#E1E0CC' }}>{page.title}</p>
                      <p className="text-[10px] mt-1" style={{ color: 'rgba(222,219,200,0.35)' }}>
                        Last validated: {new Date(page.last_validated).toLocaleDateString()}
                      </p>
                    </div>
                    <Link href={`/wiki/${page.slug}`}
                      className="text-[10px] px-3 py-1 rounded-full border border-white/10 hover:border-white/30 transition"
                      style={{ color: 'rgba(222,219,200,0.5)' }}>
                      Review →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flagged pages */}
          {audit.flagged.length > 0 && (
            <div className="mb-12">
              <p className="text-[9px] tracking-[0.3em] uppercase mb-4"
                style={{ color: 'rgba(222,219,200,0.3)' }}>
                FLAGGED FOR REVIEW
              </p>
              <div className="space-y-2">
                {audit.flagged.map(page => (
                  <div key={page.slug}
                    className="bg-red-950/20 border border-red-900/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm" style={{ color: '#E1E0CC' }}>{page.title}</p>
                      <span className="text-[9px] px-2 py-0.5 bg-red-950 text-red-400 rounded-full">
                        confidence: {page.confidence}%
                      </span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'rgba(222,219,200,0.45)' }}>
                      {page.stale_reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Lint Sweep */}
      <div className="mt-4">
        <div className="flex items-center gap-4 mb-6">
          <p className="text-[9px] tracking-[0.3em] uppercase"
            style={{ color: 'rgba(222,219,200,0.3)' }}>
            DEEP LINT SWEEP
          </p>
          <button
            onClick={runLint}
            disabled={lintLoading}
            className="flex items-center gap-2 text-[10px] px-4 py-2 rounded-full border border-white/15 hover:border-white/30 transition disabled:opacity-50"
            style={{ color: '#E1E0CC' }}
          >
            {lintLoading
              ? <><Loader2 size={10} className="animate-spin" /> Scanning...</>
              : 'Run Lint Sweep'
            }
          </button>
        </div>

        {lintError && (
          <p className="text-[11px] text-red-400 mb-4">{lintError}</p>
        )}

        {lint && (
          <div className="space-y-8">
            {/* Score */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Lint Score', value: `${lint.score}%` },
                { label: 'Orphans', value: lint.orphans.length },
                { label: 'Islands', value: lint.islands.length },
                { label: 'Knowledge Gaps', value: lint.gaps.length },
              ].map((s, i) => (
                <div key={i} className="bg-[#111] rounded-2xl p-4">
                  <p className="text-[9px] tracking-[0.3em] uppercase mb-1"
                    style={{ color: 'rgba(222,219,200,0.3)' }}>{s.label}</p>
                  <p className="text-2xl font-medium" style={{ color: '#E1E0CC' }}>{s.value}</p>
                </div>
              ))}
            </div>
            {lint.incrementalPages < lint.totalPages && (
              <p className="text-[10px] mt-2" style={{ color: 'rgba(222,219,200,0.3)' }}>
                Gap analysis ran on {lint.incrementalPages} pages updated since last sweep (incremental mode)
              </p>
            )}

            {/* Orphans */}
            {lint.orphans.length > 0 && (
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase mb-3"
                  style={{ color: 'rgba(222,219,200,0.3)' }}>
                  ORPHAN PAGES (no inbound links)
                </p>
                <div className="space-y-2">
                  {lint.orphans.map(o => (
                    <div key={o.slug} className="bg-[#111] rounded-xl p-4 flex items-center justify-between">
                      <p className="text-sm" style={{ color: '#E1E0CC' }}>{o.title || o.slug}</p>
                      <Link href={`/wiki/${o.slug}`}
                        className="text-[10px] px-3 py-1 rounded-full border border-white/10 hover:border-white/30 transition"
                        style={{ color: 'rgba(222,219,200,0.5)' }}>
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Islands — disconnected clusters */}
            {lint.islands.length > 0 && (
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase mb-3"
                  style={{ color: 'rgba(222,219,200,0.3)' }}>
                  ISOLATED ISLANDS (clusters disconnected from main graph)
                </p>
                <div className="space-y-2">
                  {lint.islands.map((island, i) => (
                    <div key={i} className="bg-amber-950/15 border border-amber-900/25 rounded-xl p-4">
                      <p className="text-[10px] mb-2" style={{ color: 'rgba(222,219,200,0.4)' }}>
                        {island.slugs.length} pages — no path to main cluster
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {island.slugs.map((slug, j) => (
                          <Link key={slug} href={`/wiki/${slug}`}
                            className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 hover:border-white/25 transition"
                            style={{ color: '#E1E0CC' }}>
                            {island.titles[j] || slug}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Knowledge gaps */}
            {lint.gaps.length > 0 && (
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase mb-3"
                  style={{ color: 'rgba(222,219,200,0.3)' }}>
                  KNOWLEDGE GAPS (entities mentioned but no page)
                </p>
                <div className="space-y-2">
                  {lint.gaps.map((g, i) => (
                    <div key={i} className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4">
                      <p className="text-sm mb-1" style={{ color: '#E1E0CC' }}>{g.entity}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(222,219,200,0.4)' }}>
                        Mentioned in: {g.mentionedIn.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing links */}
            {lint.missingLinks.length > 0 && (
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase mb-3"
                  style={{ color: 'rgba(222,219,200,0.3)' }}>
                  MISSING WIKILINKS
                </p>
                <div className="space-y-2">
                  {lint.missingLinks.slice(0, 10).map((m, i) => (
                    <div key={i} className="bg-[#111] rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[10px]" style={{ color: 'rgba(222,219,200,0.5)' }}>
                          In <Link href={`/wiki/${m.fromSlug}`} className="underline">{m.fromSlug}</Link>
                        </p>
                        <p className="text-sm" style={{ color: '#E1E0CC' }}>
                          "{m.mentionedEntity}" not linked
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stale (type-aware) */}
            {lint.stale.length > 0 && (
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase mb-3"
                  style={{ color: 'rgba(222,219,200,0.3)' }}>
                  STALE PAGES (exceeded type-based decay threshold)
                </p>
                <div className="space-y-2">
                  {lint.stale.map((p, i) => (
                    <div key={i} className="bg-[#111] rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm" style={{ color: '#E1E0CC' }}>{p.title || p.slug}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(222,219,200,0.35)' }}>
                          {p.type} · {p.daysSince}d since validation
                        </p>
                      </div>
                      <Link href={`/wiki/${p.slug}`}
                        className="text-[10px] px-3 py-1 rounded-full border border-white/10 hover:border-white/30 transition"
                        style={{ color: 'rgba(222,219,200,0.5)' }}>
                        Review →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lint.orphans.length === 0 && lint.islands.length === 0 && lint.gaps.length === 0 && lint.stale.length === 0 && lint.missingLinks.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-4" style={{ color: 'rgba(255,255,255,0.1)' }}>✓</p>
                <p className="text-sm" style={{ color: 'rgba(222,219,200,0.4)' }}>
                  Wiki passes lint. No orphans, islands, gaps, or stale pages.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
