'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { WordsPullUp } from '@/components/animations/WordsPullUp'
import { FadeUp } from '@/components/animations/FadeUp'
import { TypeBadge } from '@/components/TypeBadge'
import Link from 'next/link'
import { Search, Sparkles, BookmarkPlus, Check } from 'lucide-react'

interface Page { slug: string; title: string; summary: string; type: string }

export default function SearchPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'search' | 'ask'>('search')
  const [query, setQuery] = useState('')
  const [pages, setPages] = useState<Page[]>([])
  const [filtered, setFiltered] = useState<Page[]>([])
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/wiki').then(r => r.json()).then(data => setPages(data.pages || []))
  }, [])

  useEffect(() => {
    if (mode === 'search' && query.trim()) {
      const q = query.toLowerCase()
      setFiltered(pages.filter(p =>
        p.title?.toLowerCase().includes(q) || p.summary?.toLowerCase().includes(q)
      ))
    } else {
      setFiltered([])
    }
  }, [query, pages, mode])

  const handleAsk = async () => {
    if (!query.trim()) return
    setLoading(true)
    setAnswer('')
    setSaved(false)

    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query }),
    })

    if (!res.ok) {
      const err = await res.json()
      setAnswer(err.error || 'Something went wrong.')
      setLoading(false)
      return
    }

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) return

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      setAnswer(prev => prev + decoder.decode(value))
    }
    setLoading(false)
  }

  const saveToWiki = async () => {
    if (!answer || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/wiki/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, answer }),
      })
      const data = await res.json()
      if (data.slug) {
        setSaved(true)
        setTimeout(() => router.push(`/wiki/${data.slug}`), 800)
      }
    } catch {
      // silent fail
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-black min-h-screen">
      <div className="flex flex-col items-center pt-20 px-4">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-medium leading-[0.9]"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', color: '#E1E0CC' }}>
            <WordsPullUp text="What do you know?" />
          </h1>
        </div>

        {/* Mode toggle */}
        <FadeUp delay={0.3}>
          <div className="flex gap-1 mb-6 bg-[#111] rounded-full p-1">
            {(['search', 'ask'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setAnswer(''); inputRef.current?.focus() }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] tracking-wider uppercase transition-all duration-200 ${mode === m ? 'bg-[#DEDBC8] text-black' : ''}`}
                style={{ color: mode === m ? '#000' : 'rgba(222,219,200,0.4)' }}
              >
                {m === 'search' ? <Search size={11} /> : <Sparkles size={11} />}
                {m === 'search' ? 'Search' : 'Ask AI'}
              </button>
            ))}
          </div>
        </FadeUp>

        {/* Search bar */}
        <FadeUp delay={0.4} className="w-full max-w-xl">
          <div className="flex items-center gap-3 bg-[#0f0f0f] border border-white/10 rounded-full px-5 py-3.5 focus-within:border-white/20 transition-all duration-200">
            {mode === 'search'
              ? <Search size={14} style={{ color: 'rgba(222,219,200,0.3)' }} />
              : <Sparkles size={14} style={{ color: 'rgba(222,219,200,0.3)' }} />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && mode === 'ask' && handleAsk()}
              placeholder={mode === 'search' ? 'Search your wiki...' : 'Ask anything about your wiki...'}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: '#DEDBC8' }}
              autoFocus
            />
            {mode === 'ask' && (
              <button
                onClick={handleAsk}
                className="bg-[#DEDBC8] text-black text-[10px] font-medium px-3 py-1 rounded-full hover:opacity-90 transition"
              >
                Ask
              </button>
            )}
          </div>
        </FadeUp>

        {/* Search results */}
        {mode === 'search' && filtered.length > 0 && (
          <div className="w-full max-w-xl mt-4 space-y-2">
            {filtered.map((page, i) => (
              <FadeUp key={page.slug} delay={i * 0.05}>
                <Link href={`/wiki/${page.slug}`}>
                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-4 hover:border-white/15 transition-all duration-200">
                    <div className="flex items-center gap-2 mb-2">
                      <TypeBadge type={page.type} />
                    </div>
                    <h3 className="text-sm font-medium mb-1" style={{ color: '#E1E0CC' }}>{page.title}</h3>
                    <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: 'rgba(222,219,200,0.4)' }}>
                      {page.summary}
                    </p>
                  </div>
                </Link>
              </FadeUp>
            ))}
          </div>
        )}

        {/* AI Answer */}
        {mode === 'ask' && (answer || loading) && (
          <FadeUp delay={0.1} className="w-full max-w-xl mt-6">
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-8">
              <p className="text-[9px] tracking-[0.3em] uppercase mb-5" style={{ color: 'rgba(222,219,200,0.3)' }}>
                Answer
              </p>
              {loading && !answer && (
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#DEDBC8] animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s`, opacity: 0.6 }} />
                  ))}
                </div>
              )}
              {answer && (
                <>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'rgba(222,219,200,0.8)' }}>
                    {answer}
                  </p>
                  {!loading && (
                    <button
                      onClick={saveToWiki}
                      disabled={saving || saved}
                      className="mt-6 flex items-center gap-2 text-[10px] px-4 py-2 rounded-full border border-white/15 hover:border-white/30 transition disabled:opacity-50"
                      style={{ color: saved ? '#4ade80' : 'rgba(222,219,200,0.6)' }}
                    >
                      {saved
                        ? <><Check size={11} /> Saved — navigating...</>
                        : saving
                        ? 'Saving...'
                        : <><BookmarkPlus size={11} /> Save to Wiki</>
                      }
                    </button>
                  )}
                </>
              )}
            </div>
          </FadeUp>
        )}

      </div>
    </div>
  )
}
