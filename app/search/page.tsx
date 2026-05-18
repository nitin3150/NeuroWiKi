'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Search, Sparkles, Clock, Copy, Check, Clipboard, BookmarkPlus, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FadeUp } from '@/components/animations/FadeUp'
import { TypeBadge } from '@/components/TypeBadge'
import { WordsPullUp } from '@/components/animations/WordsPullUp'

interface Page { slug: string; title: string; summary: string; type: string }

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} style={{ background: 'rgba(222,219,200,0.2)', color: '#E1E0CC', borderRadius: '2px' }}>
        {part}
      </mark>
    ) : part
  )
}

const MAX_HISTORY = 5

export default function SearchPage() {
  const [mode, setMode] = useState<'search' | 'ask'>('search')
  const [query, setQuery] = useState('')
  const [allPages, setAllPages] = useState<Page[]>([])
  const [filtered, setFiltered] = useState<Page[]>([])
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [savingToWiki, setSavingToWiki] = useState(false)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load pages + history
  useEffect(() => {
    fetch('/api/wiki').then(r => r.json()).then(data => setAllPages(data.pages || [])).catch(() => {})
    try {
      const saved = localStorage.getItem('nw-query-history')
      if (saved) setHistory(JSON.parse(saved))
    } catch {}
  }, [])

  // Filter pages
  useEffect(() => {
    if (mode !== 'search' || !query.trim()) { setFiltered([]); return }
    const q = query.toLowerCase()
    setFiltered(
      allPages
        .filter(p =>
          p.title.toLowerCase().includes(q) ||
          (p.summary || '').toLowerCase().includes(q)
        )
        .slice(0, 8)
    )
  }, [query, allPages, mode])

  const saveToHistory = (q: string) => {
    const next = [q, ...history.filter(h => h !== q)].slice(0, MAX_HISTORY)
    setHistory(next)
    localStorage.setItem('nw-query-history', JSON.stringify(next))
  }

  const handleAsk = async (q = query) => {
    if (!q.trim()) return
    setQuery(q)
    setLoading(true)
    setAnswer('')
    setSavedSlug(null)
    saveToHistory(q)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('No body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (chunk) setAnswer(prev => prev + chunk)
      }
    } catch (err) {
      toast.error('Search failed. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToWiki = async () => {
    if (!answer || !query || savingToWiki) return
    setSavingToWiki(true)
    try {
      const res = await fetch('/api/wiki/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, answer })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSavedSlug(data.slug)
      toast.success('Successfully compiled into Wiki!')
    } catch (e: any) {
      toast.error(e.message || 'Failed to compile to Wiki')
    } finally {
      setSavingToWiki(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(answer)
    setCopied(true)
    toast.success('Answer copied')
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setQuery(text)
      inputRef.current?.focus()
    } catch {
      toast.error('Could not read clipboard')
    }
  }

  return (
    <div className="bg-black min-h-screen">
      <div className="flex flex-col items-center pt-16 px-4 pb-20">

        <div className="text-center mb-10">
          <h1 className="font-medium leading-[0.9]"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', color: '#E1E0CC' }}>
            <WordsPullUp text="What do you know?" />
          </h1>
        </div>

        {/* Mode toggle */}
        <FadeUp delay={0.3}>
          <div className="flex gap-1 mb-5 p-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {(['search', 'ask'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setAnswer(''); setFiltered([]) }}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] tracking-wider uppercase transition-all duration-200"
                style={{
                  background: mode === m ? '#DEDBC8' : 'transparent',
                  color: mode === m ? '#000' : 'rgba(222,219,200,0.4)',
                }}
              >
                {m === 'search' ? <Search size={11} /> : <Sparkles size={11} />}
                {m === 'search' ? 'Search' : 'Ask AI'}
              </button>
            ))}
          </div>
        </FadeUp>

        {/* Search bar */}
        <FadeUp delay={0.4} className="w-full max-w-xl">
          <div
            className="flex items-center gap-3 px-5 py-3.5 rounded-full transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            onFocus={() => {}}
          >
            {mode === 'search'
              ? <Search size={14} style={{ color: 'rgba(222,219,200,0.3)', flexShrink: 0 }} />
              : <Sparkles size={14} style={{ color: 'rgba(222,219,200,0.3)', flexShrink: 0 }} />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && mode === 'ask' && handleAsk()}
              placeholder={mode === 'search' ? 'Search your wiki...' : 'Ask anything...'}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: '#DEDBC8' }}
              autoFocus
            />
            {/* Paste button */}
            <button
              onClick={handlePaste}
              className="opacity-30 hover:opacity-70 transition-opacity flex-shrink-0"
              title="Paste from clipboard"
            >
              <Clipboard size={13} color="#DEDBC8" />
            </button>
            {mode === 'ask' && (
              <button
                onClick={() => handleAsk()}
                disabled={loading || !query.trim()}
                className="bg-[#DEDBC8] text-black text-[10px] font-medium px-3 py-1.5 rounded-full hover:opacity-90 transition disabled:opacity-40 flex-shrink-0"
              >
                Ask
              </button>
            )}
          </div>
        </FadeUp>

        {/* Search results with highlighting */}
        {mode === 'search' && filtered.length > 0 && (
          <div className="w-full max-w-xl mt-3 space-y-2">
            {filtered.map((page, i) => (
              <FadeUp key={page.slug} delay={i * 0.04}>
                <Link href={`/wiki/${page.slug}`}>
                  <div
                    className="rounded-2xl p-4 hover:bg-white/4 transition-all duration-200"
                    style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <TypeBadge type={page.type} />
                    </div>
                    <h3 className="text-sm font-medium mb-1" style={{ color: '#E1E0CC' }}>
                      {highlightText(page.title, query)}
                    </h3>
                    <p className="text-[11px] leading-relaxed line-clamp-2"
                      style={{ color: 'rgba(222,219,200,0.4)' }}>
                      {highlightText(page.summary || '', query)}
                    </p>
                  </div>
                </Link>
              </FadeUp>
            ))}
          </div>
        )}

        {mode === 'search' && query && filtered.length === 0 && (
          <FadeUp delay={0.1} className="w-full max-w-xl mt-4 text-center py-8">
            <p className="text-sm" style={{ color: 'rgba(222,219,200,0.3)' }}>
              No pages found. Try switching to Ask AI mode.
            </p>
          </FadeUp>
        )}

        {/* Query history */}
        {mode === 'ask' && !query && history.length > 0 && (
          <FadeUp delay={0.2} className="w-full max-w-xl mt-4">
            <p className="text-[9px] tracking-[0.3em] uppercase mb-3"
              style={{ color: 'rgba(222,219,200,0.25)' }}>
              Recent questions
            </p>
            <div className="space-y-1">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => handleAsk(h)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left hover:bg-white/4 transition-colors group"
                >
                  <Clock size={12} style={{ color: 'rgba(222,219,200,0.25)', flexShrink: 0 }} />
                  <span className="text-[12px] truncate group-hover:opacity-100 transition-opacity"
                    style={{ color: 'rgba(222,219,200,0.5)' }}>
                    {h}
                  </span>
                </button>
              ))}
            </div>
          </FadeUp>
        )}

        {/* AI Answer */}
        {mode === 'ask' && (answer || loading) && (
          <FadeUp delay={0.1} className="w-full max-w-xl mt-6">
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[9px] tracking-[0.3em] uppercase"
                  style={{ color: 'rgba(222,219,200,0.25)' }}>Answer</p>
                {answer && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-[10px] hover:opacity-100 transition-opacity"
                    style={{ color: 'rgba(222,219,200,0.35)' }}
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>

              {loading && !answer && (
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{
                        background: '#DEDBC8',
                        opacity: 0.5,
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              {answer && (
                <p
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'rgba(222,219,200,0.8)' }}
                >
                  {answer}
                </p>
              )}
            </div>

            {!loading && answer && (
              <FadeUp delay={0.2} className="mt-4">
                <div className="bg-[#111] border border-white/5 rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: '#E1E0CC' }}>
                        Save as Wiki Page
                      </p>
                      <p className="text-[11px] leading-relaxed max-w-[80%]" style={{ color: 'rgba(222,219,200,0.45)' }}>
                        Compile this Q&A into a permanent node in your knowledge graph.
                      </p>
                    </div>
                    {savedSlug ? (
                      <Link
                        href={`/wiki/${savedSlug}`}
                        className="flex items-center gap-1.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 px-4 py-2 rounded-full text-[11px] font-medium tracking-wide hover:bg-emerald-900/40 transition-colors"
                      >
                        View Page <ArrowRight size={12} />
                      </Link>
                    ) : (
                      <button
                        onClick={handleSaveToWiki}
                        disabled={savingToWiki}
                        className="flex items-center gap-2 bg-[#DEDBC8] text-black px-4 py-2 rounded-full text-[11px] font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {savingToWiki ? (
                          <><Loader2 size={12} className="animate-spin" /> Saving...</>
                        ) : (
                          <><BookmarkPlus size={13} /> Compile to Wiki</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </FadeUp>
            )}

            {answer && (
              <FadeUp delay={0.2}>
                <button
                  onClick={() => { setAnswer(''); setQuery(''); inputRef.current?.focus() }}
                  className="mt-3 text-[11px] tracking-wider uppercase hover:opacity-100 transition-opacity"
                  style={{ color: 'rgba(222,219,200,0.3)' }}
                >
                  Ask another question
                </button>
              </FadeUp>
            )}
          </FadeUp>
        )}
      </div>
    </div>
  )
}
