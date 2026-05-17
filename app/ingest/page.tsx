'use client'
import { useState } from 'react'
import { WordsPullUp } from '@/components/animations/WordsPullUp'
import { FadeUp } from '@/components/animations/FadeUp'
import { TypeBadge } from '@/components/TypeBadge'
import Link from 'next/link'
import { ArrowRight, Check, Circle, Loader2 } from 'lucide-react'

type Step = { label: string; status: 'pending' | 'active' | 'done' }
type ResultPage = { slug: string; title: string; type: string; isNew: boolean }

const INITIAL_STEPS: Step[] = [
  { label: 'Reading source...', status: 'pending' },
  { label: 'AI is analyzing content...', status: 'pending' },
  { label: 'Writing wiki pages...', status: 'pending' },
  { label: 'Linking to knowledge graph...', status: 'pending' },
  { label: 'Indexing in progress...', status: 'pending' },
]

export default function IngestPage() {
  const [tab, setTab] = useState<'text' | 'url'>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS)
  const [results, setResults] = useState<ResultPage[]>([])
  const [done, setDone] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const advanceStep = (index: number) => {
    setSteps(prev => prev.map((s, i) => ({
      ...s,
      status: i < index ? 'done' : i === index ? 'active' : 'pending'
    })))
  }

  const handleSubmit = async () => {
    const content = tab === 'text' ? text : url
    if (!content.trim()) return

    setLoading(true)
    setDone(false)
    setWarning(null)
    setResults([])
    setSteps(INITIAL_STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })))

    try {
      setTimeout(() => advanceStep(1), 800)
      setTimeout(() => advanceStep(2), 1800)

      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tab === 'text' ? { text: content } : { url: content }),
      })

      advanceStep(3)
      setTimeout(() => advanceStep(4), 1000)
      
      const textResponse = await res.text()
      const lines = textResponse.split('\n').filter(Boolean)

      // Find the final JSON payload (last parseable line with `final` or `error`)
      let data: any = null
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(lines[i])
          if (parsed.final || parsed.error) { data = parsed; break }
        } catch { /* non-JSON status line, skip */ }
      }

      if (!data) {
        setError('Ingest failed: no response from server')
        setLoading(false)
        return
      }

      if (data.error) {
        setError(`Ingest failed: ${data.error}`)
        setLoading(false)
        return
      }

      setTimeout(() => {
        setSteps(prev => prev.map(s => ({ ...s, status: 'done' })))
        setResults(data.pages || [])
        if (data.warning) setWarning(data.warning)
        setDone(true)
        setLoading(false)
      }, 600)
    } catch (e: any) {
      setError(`Ingest failed: ${e?.message || 'Unknown error'}`)
      setLoading(false)
    }
  }

  return (
    <div className="bg-black min-h-screen flex flex-col items-center pt-16 px-4 pb-20">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="font-medium leading-[0.9]"
            style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', color: '#E1E0CC' }}>
            <WordsPullUp text="Feed the wiki." />
          </h1>
          <FadeUp delay={0.4}>
            <p className="text-base mt-4" style={{ color: 'rgba(222,219,200,0.45)' }}>
              Paste text or a URL. The AI does the rest.
            </p>
          </FadeUp>
        </div>

        {/* Tabs */}
        <FadeUp delay={0.5}>
          <div className="flex gap-6 mb-6 border-b border-white/5">
            {(['text', 'url'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-3 text-[11px] tracking-wider uppercase transition-all duration-200 border-b-2 -mb-[1px] ${
                  tab === t ? 'border-[#DEDBC8]' : 'border-transparent'
                }`}
                style={{ color: tab === t ? '#DEDBC8' : 'rgba(222,219,200,0.35)' }}
              >
                {t === 'text' ? 'Paste Text' : 'From URL'}
              </button>
            ))}
          </div>
        </FadeUp>

        {/* Input */}
        <FadeUp delay={0.6}>
          {tab === 'text' ? (
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste an article, your notes, a research paper — anything..."
              className="w-full bg-[#0a0a0a] border border-white/8 rounded-2xl p-5 text-sm outline-none resize-none min-h-[220px] transition-all duration-200 focus:border-white/20"
              style={{ color: 'rgba(222,219,200,0.8)', lineHeight: 1.7 }}
            />
          ) : (
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#0a0a0a] border border-white/8 rounded-2xl px-5 py-4 text-sm outline-none transition-all duration-200 focus:border-white/20"
              style={{ color: 'rgba(222,219,200,0.8)' }}
            />
          )}
        </FadeUp>

        {/* Submit / Progress */}
        <FadeUp delay={0.7}>
          {!loading && !done && (
            <button
              onClick={handleSubmit}
              className="group mt-4 w-full flex items-center justify-between bg-[#DEDBC8] rounded-full px-5 py-3 transition-all duration-300 hover:opacity-90"
            >
              <span className="text-black font-medium text-sm">Add to Wiki</span>
              <div className="bg-black rounded-full w-9 h-9 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <ArrowRight size={15} color="#DEDBC8" />
              </div>
            </button>
          )}

          {loading && (
            <div className="mt-6 space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  {step.status === 'done' && <Check size={12} className="text-emerald-400 flex-shrink-0" />}
                  {step.status === 'active' && <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: '#DEDBC8' }} />}
                  {step.status === 'pending' && <Circle size={12} className="flex-shrink-0" style={{ color: 'rgba(255,255,255,0.15)' }} />}
                  <span className="text-xs transition-all duration-300" style={{
                    color: step.status === 'done'
                      ? 'rgba(222,219,200,0.3)'
                      : step.status === 'active'
                      ? '#DEDBC8'
                      : 'rgba(222,219,200,0.2)'
                  }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </FadeUp>

        {/* Error */}
        {error && (
          <div className="mt-6 bg-red-950/30 border border-red-900/50 rounded-xl p-3 flex items-start gap-3">
            <span className="text-red-500 text-xs mt-0.5">✗</span>
            <p className="text-[11px] text-red-200/80 leading-relaxed font-mono">{error}</p>
          </div>
        )}

        {/* Results */}
        {done && results.length > 0 && (
          <div className="mt-8">
            <p className="text-[9px] tracking-[0.3em] uppercase mb-4" style={{ color: 'rgba(222,219,200,0.3)' }}>
              Pages Created
            </p>
            {warning && (
              <div className="mb-4 bg-amber-950/30 border border-amber-900/50 rounded-xl p-3 flex items-start gap-3">
                <span className="text-amber-500 text-xs mt-0.5">⚠️</span>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  {warning}
                </p>
              </div>
            )}
            <div className="space-y-2">
              {results.map((page, i) => (
                <FadeUp key={page.slug} delay={i * 0.08}>
                  <Link href={`/wiki/${page.slug}`}>
                    <div className="bg-[#151515] rounded-xl p-4 flex items-center gap-3 hover:bg-[#1a1a1a] transition-all duration-200">
                      <TypeBadge type={page.type} />
                      <span className="text-sm flex-1" style={{ color: '#E1E0CC' }}>{page.title}</span>
                      <span className={`text-[9px] rounded-full px-2 py-0.5 ${
                        page.isNew ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                      }`}>
                        {page.isNew ? 'new' : 'updated'}
                      </span>
                      <span className="text-xs" style={{ color: 'rgba(222,219,200,0.3)' }}>→</span>
                    </div>
                  </Link>
                </FadeUp>
              ))}
            </div>
            <FadeUp delay={0.3}>
              <button
                onClick={() => { setDone(false); setText(''); setUrl('') }}
                className="mt-6 text-[11px] tracking-wider uppercase transition-opacity hover:opacity-100"
                style={{ color: 'rgba(222,219,200,0.35)' }}
              >
                + Add another source
              </button>
            </FadeUp>
          </div>
        )}
      </div>
    </div>
  )
}
