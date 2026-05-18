'use client'
import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { WordsPullUp } from '@/components/animations/WordsPullUp'
import { FadeUp } from '@/components/animations/FadeUp'
import { TypeBadge } from '@/components/TypeBadge'
import Link from 'next/link'
import { ArrowRight, Check, Circle, Loader2, Paperclip, X } from 'lucide-react'

type Step = { label: string; status: 'pending' | 'active' | 'done' }
type ResultPage = { slug: string; title: string; type: string; isNew: boolean }

const INITIAL_STEPS: Step[] = [
  { label: 'Reading source...', status: 'pending' },
  { label: 'AI is analyzing content...', status: 'pending' },
  { label: 'Writing wiki pages...', status: 'pending' },
  { label: 'Linking to knowledge graph...', status: 'pending' },
  { label: 'Indexing in progress...', status: 'pending' },
]

const ACCEPTED = '.pdf,.txt,.md,.docx'

export default function IngestPage() {
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS)
  const [results, setResults] = useState<ResultPage[]>([])
  const [done, setDone] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const advanceStep = (index: number) => {
    setSteps(prev => prev.map((s, i) => ({
      ...s,
      status: i < index ? 'done' : i === index ? 'active' : 'pending'
    })))
  }

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...arr.filter(f => !existing.has(f.name + f.size))]
    })
    setInput('')
    setError(null)
  }

  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index))

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }, [])

  const handleSubmit = async () => {
    if (!files.length && !input.trim()) return

    setLoading(true)
    setDone(false)
    setWarning(null)
    setResults([])
    setError(null)
    setSteps(INITIAL_STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })))
    toast.loading('Processing source...', { id: 'ingest' })

    try {
      setTimeout(() => advanceStep(1), 800)
      setTimeout(() => advanceStep(2), 1800)

      let res: Response

      if (files.length > 0) {
        const formData = new FormData()
        files.forEach(f => formData.append('file', f))
        res = await fetch('/api/ingest', { method: 'POST', body: formData })
      } else {
        const lines = input.trim().split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
        const urls = lines.filter(l => /^https?:\/\//.test(l))
        const isMultiUrl = urls.length > 1
        const isSingleUrl = urls.length === 1 && lines.length === 1
        res = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isMultiUrl ? { urls } :
            isSingleUrl ? { url: urls[0] } :
            { text: input.trim() }
          ),
        })
      }

      advanceStep(3)
      setTimeout(() => advanceStep(4), 1000)

      const textResponse = await res.text()
      const lines = textResponse.split('\n').filter(Boolean)

      let data: any = null
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(lines[i])
          if (parsed.final || parsed.error) { data = parsed; break }
        } catch { /* skip */ }
      }

      if (!data) {
        toast.error('Ingest failed: no response from server', { id: 'ingest' })
        setError('Ingest failed: no response from server')
        setLoading(false)
        return
      }
      if (data.error) {
        toast.error(`Ingest failed: ${data.error}`, { id: 'ingest' })
        setError(`Ingest failed: ${data.error}`)
        setLoading(false)
        return
      }

      setTimeout(() => {
        setSteps(prev => prev.map(s => ({ ...s, status: 'done' })))
        setResults(data.pages || [])
        if (data.warning) {
          setWarning(data.warning)
          toast.warning(data.warning, { id: 'ingest' })
        } else {
          toast.success(`${data.pagesCreated || data.pages?.length || 0} pages created successfully`, { id: 'ingest' })
        }
        setDone(true)
        setLoading(false)
        setFiles([])
      }, 600)
    } catch (e: any) {
      const msg = e?.message || 'Unknown error'
      toast.error(`Ingest failed: ${msg}`, { id: 'ingest' })
      setError(`Ingest failed: ${msg}`)
      setLoading(false)
    }
  }

  const reset = () => {
    setDone(false)
    setInput('')
    setFiles([])
    setError(null)
    setWarning(null)
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
              Paste text, drop a URL, or upload a file.
            </p>
          </FadeUp>
        </div>

        <FadeUp delay={0.5}>
          {/* Drop zone wrapper */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className="relative rounded-2xl transition-all duration-200"
            style={{
              border: `1px solid ${dragging ? 'rgba(222,219,200,0.4)' : 'rgba(255,255,255,0.08)'}`,
              background: dragging ? 'rgba(222,219,200,0.03)' : '#0a0a0a',
            }}
          >
            {files.length > 0 ? (
              /* File chips list */
              <div className="px-5 py-4 space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Paperclip size={12} style={{ color: 'rgba(222,219,200,0.4)' }} />
                    <span className="text-sm flex-1 truncate" style={{ color: '#DEDBC8' }}>{f.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 shrink-0" style={{ color: 'rgba(222,219,200,0.35)' }}>
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                    <button onClick={() => removeFile(i)}>
                      <X size={12} style={{ color: 'rgba(222,219,200,0.35)' }} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Paste text, a URL (https://...), or drop a file below..."
                className="w-full bg-transparent px-5 pt-5 pb-3 text-sm outline-none resize-none min-h-[180px]"
                style={{ color: 'rgba(222,219,200,0.8)', lineHeight: 1.7 }}
              />
            )}

            {/* File drop footer */}
            <div
              className="border-t px-5 py-3 flex items-center justify-between"
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}
            >
              <span className="text-[10px] tracking-wider" style={{ color: 'rgba(222,219,200,0.2)' }}>
                {dragging ? 'Drop to upload' : 'PDF · TXT · MD · DOCX'}
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-[10px] tracking-wider uppercase transition-opacity hover:opacity-100"
                style={{ color: 'rgba(222,219,200,0.35)' }}
              >
                <Paperclip size={10} /> Upload file
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="hidden"
              onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = '' }}
            />
          </div>
        </FadeUp>

        {/* Submit / Progress */}
        <FadeUp delay={0.6}>
          {!loading && (
            <button
              onClick={handleSubmit}
              disabled={!files.length && !input.trim()}
              className="group mt-4 w-full flex items-center justify-between bg-[#DEDBC8] rounded-full px-5 py-3 transition-all duration-300 hover:opacity-90 disabled:opacity-30"
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
                onClick={reset}
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
