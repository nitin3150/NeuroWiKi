'use client'
import { useState } from 'react'
import { WordsPullUp } from '@/components/animations/WordsPullUp'
import { FadeUp } from '@/components/animations/FadeUp'
import { TypeBadge } from '@/components/TypeBadge'
import Link from 'next/link'
import { ArrowRight, Check, Circle, Loader2, Upload } from 'lucide-react'

type Step = { label: string; status: 'pending' | 'active' | 'done' }
type ResultPage = { slug: string; title: string; type: string; isNew: boolean }
type Tab = 'text' | 'url' | 'file'

const INITIAL_STEPS: Step[] = [
  { label: 'Reading source...', status: 'pending' },
  { label: 'AI is analyzing content...', status: 'pending' },
  { label: 'Writing wiki pages...', status: 'pending' },
  { label: 'Linking to knowledge graph...', status: 'pending' },
  { label: 'Indexing in progress...', status: 'pending' },
]

const TAB_LABELS: Record<Tab, string> = {
  text: 'Paste Text',
  url: 'From URL',
  file: 'Upload File',
}

export default function IngestPage() {
  const [tab, setTab] = useState<Tab>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS)
  const [results, setResults] = useState<ResultPage[]>([])
  const [done, setDone] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const advanceStep = (index: number) => {
    setSteps(prev => prev.map((s, i) => ({
      ...s,
      status: i < index ? 'done' : i === index ? 'active' : 'pending',
    })))
  }

  // ── Text / URL streaming submit ───────────────────────────────────────────
  const handleTextUrlSubmit = async () => {
    const content = tab === 'text' ? text : url
    if (!content.trim()) return

    setLoading(true)
    setDone(false)
    setWarning(null)
    setErrorMsg(null)
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
      const finalLine = lines[lines.length - 1]
      const data = JSON.parse(finalLine)

      if (data.error) {
        setErrorMsg(data.error)
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
    } catch (e) {
      console.error(e)
      setErrorMsg('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  // ── File upload submit ────────────────────────────────────────────────────
  const handleFileSubmit = async () => {
    if (!file) return

    setLoading(true)
    setDone(false)
    setWarning(null)
    setErrorMsg(null)
    setResults([])
    setSteps(INITIAL_STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })))

    try {
      setTimeout(() => advanceStep(1), 600)
      setTimeout(() => advanceStep(2), 1400)

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/ingest/pdf', { method: 'POST', body: formData })

      advanceStep(3)
      setTimeout(() => advanceStep(4), 800)

      const data = await res.json()

      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Failed to process file')
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
    } catch (e) {
      console.error(e)
      setErrorMsg('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleSubmit = () => {
    if (tab === 'file') return handleFileSubmit()
    return handleTextUrlSubmit()
  }

  const canSubmit =
    !loading && !done &&
    ((tab === 'text' && text.trim()) ||
     (tab === 'url' && url.trim()) ||
     (tab === 'file' && file !== null))

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
              Paste text, drop a URL, or upload a file. The AI does the rest.
            </p>
          </FadeUp>
        </div>

        {/* Tabs */}
        <FadeUp delay={0.5}>
          <div className="flex gap-6 mb-6 border-b border-white/5">
            {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-3 text-[11px] tracking-wider uppercase transition-all duration-200 border-b-2 -mb-[1px] ${
                  tab === t ? 'border-[#DEDBC8]' : 'border-transparent'
                }`}
                style={{ color: tab === t ? '#DEDBC8' : 'rgba(222,219,200,0.35)' }}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        </FadeUp>

        {/* Input */}
        <FadeUp delay={0.6}>
          {tab === 'text' && (
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste an article, your notes, a research paper — anything..."
              className="w-full bg-[#0a0a0a] border border-white/8 rounded-2xl p-5 text-sm outline-none resize-none min-h-[220px] transition-all duration-200 focus:border-white/20"
              style={{ color: 'rgba(222,219,200,0.8)', lineHeight: 1.7 }}
            />
          )}

          {tab === 'url' && (
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#0a0a0a] border border-white/8 rounded-2xl px-5 py-4 text-sm outline-none transition-all duration-200 focus:border-white/20"
              style={{ color: 'rgba(222,219,200,0.8)' }}
            />
          )}

          {tab === 'file' && (
            <div
              className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 hover:bg-white/[0.02]"
              style={{ borderColor: file ? 'rgba(222,219,200,0.4)' : 'rgba(255,255,255,0.08)' }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const dropped = e.dataTransfer.files[0]
                if (dropped) setFile(dropped)
              }}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf,.txt,.md"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div>
                  <p className="text-sm font-medium" style={{ color: '#E1E0CC' }}>{file.name}</p>
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(222,219,200,0.4)' }}>
                    {(file.size / 1024).toFixed(1)} KB · click to change
                  </p>
                </div>
              ) : (
                <div>
                  <Upload
                    size={24}
                    className="mx-auto mb-3"
                    style={{ color: 'rgba(222,219,200,0.3)' }}
                  />
                  <p className="text-sm" style={{ color: 'rgba(222,219,200,0.5)' }}>
                    Drop PDF, TXT, or MD file here
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(222,219,200,0.25)' }}>
                    or click to browse
                  </p>
                </div>
              )}
            </div>
          )}
        </FadeUp>

        {/* Error message */}
        {errorMsg && !loading && (
          <FadeUp delay={0}>
            <div className="mt-4 bg-red-950/30 border border-red-900/50 rounded-xl p-3">
              <p className="text-[11px] text-red-300/80 leading-relaxed">{errorMsg}</p>
            </div>
          </FadeUp>
        )}

        {/* Submit / Progress */}
        <FadeUp delay={0.7}>
          {canSubmit && (
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
                      : 'rgba(222,219,200,0.2)',
                  }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </FadeUp>

        {/* Results */}
        {done && results.length > 0 && (
          <div className="mt-8">
            <p className="text-[9px] tracking-[0.3em] uppercase mb-4" style={{ color: 'rgba(222,219,200,0.3)' }}>
              Pages Created
            </p>
            {warning && (
              <div className="mb-4 bg-amber-950/30 border border-amber-900/50 rounded-xl p-3 flex items-start gap-3">
                <span className="text-amber-500 text-xs mt-0.5">⚠️</span>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">{warning}</p>
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
                onClick={() => { setDone(false); setText(''); setUrl(''); setFile(null); setErrorMsg(null) }}
                className="mt-6 text-[11px] tracking-wider uppercase transition-opacity hover:opacity-100"
                style={{ color: 'rgba(222,219,200,0.35)' }}
              >
                + Add another source
              </button>
            </FadeUp>
          </div>
        )}

        {done && results.length === 0 && (
          <FadeUp delay={0}>
            <div className="mt-6 bg-amber-950/30 border border-amber-900/50 rounded-xl p-4 text-center">
              <p className="text-sm text-amber-200/80">No pages were generated. The source may be too short or the AI couldn&apos;t extract enough facts.</p>
              <button
                onClick={() => { setDone(false); setErrorMsg(null) }}
                className="mt-3 text-[11px] tracking-wider uppercase text-amber-400/60 hover:text-amber-400 transition-colors"
              >
                Try again
              </button>
            </div>
          </FadeUp>
        )}

      </div>
    </div>
  )
}
