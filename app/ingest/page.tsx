'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { WordsPullUp } from '@/components/animations/WordsPullUp'
import { FadeUp } from '@/components/animations/FadeUp'
import { TypeBadge } from '@/components/TypeBadge'
import Link from 'next/link'
import { ArrowRight, Check, Circle, Loader2, Paperclip, X } from 'lucide-react'

type LogEntry = {
  id: number
  pages_created: number
  pages_updated: number
  message: string | null
  created_at: string
  source_title: string | null
  source_url: string | null
}

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
  const [tab, setTab] = useState<'single' | 'bulk'>('single')
  const [bulkUrls, setBulkUrls] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS)
  const [results, setResults] = useState<ResultPage[]>([])
  const [done, setDone] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  const [history, setHistory] = useState<LogEntry[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/logs?limit=10').then(r => r.json()).then(d => setHistory(d.logs || []))
  }, [])

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

  const messageToStep = (msg: string): number | null => {
    const m = msg.toLowerCase()
    if (m.includes('ai is analyzing') || m.includes('analyzing')) return 1
    if (m.includes('processing') || m.includes('storing logs') || m.includes('writing')) return 2
    if (m.includes('checking') || m.includes('consistency')) return 3
    return null
  }

  const handleSubmit = async () => {
    if (!files.length && !input.trim()) return

    setLoading(true)
    setDone(false)
    setWarning(null)
    setResults([])
    setError(null)
    setRetryAfter(null)
    setSteps(INITIAL_STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })))
    toast.loading('Processing source...', { id: 'ingest' })

    try {
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

      // Read stream incrementally — advance steps on real API messages
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let data: any = null

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n')
          buffer = parts.pop() ?? ''

          for (const line of parts) {
            if (!line.trim()) continue
            try {
              const parsed = JSON.parse(line)
              if (parsed.final || parsed.error) data = parsed
            } catch {
              const step = messageToStep(line)
              if (step !== null) advanceStep(step)
            }
          }
        }
        // flush remaining buffer
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer)
            if (parsed.final || parsed.error) data = parsed
          } catch {}
        }
      }

      if (!data) {
        toast.error('Ingest failed: no response from server', { id: 'ingest' })
        setError('Ingest failed: no response from server')
        setLoading(false)
        return
      }
      if (data.error) {
        const isQuota = data.error.includes('quota') || data.error.includes('429') || data.error.includes('busy')
        const displayError = isQuota
          ? 'AI is a little busy right now. Please wait ~30 seconds and try again.'
          : `Ingest failed: ${data.error}`
        toast.error(displayError, { id: 'ingest' })
        setError(displayError)
        if (data.retryAfter) setRetryAfter(data.retryAfter)
        setLoading(false)
        return
      }

      // Show step 4 briefly before marking all done
      advanceStep(4)
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
        fetch('/api/logs?limit=10').then(r => r.json()).then(d => setHistory(d.logs || []))
      }, 600)
    } catch (e: any) {
      const msg = e?.message || 'Unknown error'
      toast.error(`Ingest failed: ${msg}`, { id: 'ingest' })
      setError(`Ingest failed: ${msg}`)
      setLoading(false)
    }
  }

  const handleBulkSubmit = async () => {
    const urls = bulkUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'))
    if (urls.length === 0) { toast.error('No valid URLs found'); return }
    if (urls.length > 10) { toast.error('Maximum 10 URLs at once'); return }
    
    setLoading(true)
    const allResults: ResultPage[] = []
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      toast.loading(`Processing ${i + 1}/${urls.length}: ${new URL(url).hostname}`, { id: 'bulk' })
      try {
        const res = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const textResponse = await res.text()
        const respLines = textResponse.split('\n').filter(Boolean)
        let data: any = null
        for (let j = respLines.length - 1; j >= 0; j--) {
          try {
            const parsed = JSON.parse(respLines[j])
            if (parsed.final || parsed.error) { data = parsed; break }
          } catch { /* skip */ }
        }
        if (data?.error) throw new Error(data.error)
        allResults.push(...(data?.pages || []))
      } catch {
        toast.error(`Failed: ${url}`)
      }
    }
    
    toast.dismiss('bulk')
    toast.success(`Done: ${allResults.length} pages created across ${urls.length} sources`)
    setResults(allResults)
    setDone(true)
    setLoading(false)
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

        <FadeUp delay={0.45}>
          <div className="flex justify-center mb-6">
            <div className="flex gap-1 p-1 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {(['single', 'bulk'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setTab(m)}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] tracking-wider uppercase transition-all duration-200"
                  style={{
                    background: tab === m ? '#DEDBC8' : 'transparent',
                    color: tab === m ? '#000' : 'rgba(222,219,200,0.4)',
                  }}
                >
                  {m === 'single' ? 'Text / File' : 'Bulk URLs'}
                </button>
              ))}
            </div>
          </div>
        </FadeUp>

        <FadeUp delay={0.5}>
          {tab === 'single' ? (
            /* Drop zone wrapper */
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
          ) : (
            <div>
              <textarea
                value={bulkUrls}
                onChange={e => setBulkUrls(e.target.value)}
                placeholder={"https://example.com/article-1\nhttps://example.com/article-2\nhttps://example.com/article-3"}
                className="w-full bg-[#0a0a0a] border border-white/8 rounded-2xl p-5 text-sm outline-none min-h-[160px] resize-none font-mono focus:border-white/20 transition"
                style={{ color: 'rgba(222,219,200,0.7)', lineHeight: 1.8 }}
              />
              <p className="text-[10px] mt-2" style={{ color: 'rgba(222,219,200,0.25)' }}>
                One URL per line. Ingested in parallel.
              </p>
            </div>
          )}
        </FadeUp>

        {/* Submit / Progress */}
        <FadeUp delay={0.6}>
          {!loading && (
            <button
              onClick={tab === 'bulk' ? handleBulkSubmit : handleSubmit}
              disabled={tab === 'single' ? (!files.length && !input.trim()) : !bulkUrls.trim()}
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
            <div className="flex-1">
              <p className="text-[11px] text-red-200/80 leading-relaxed font-mono">{error}</p>
              {retryAfter && (
                <p className="text-[10px] text-amber-400/70 mt-1">Retry in {retryAfter}s...</p>
              )}
            </div>
            {(error.includes('busy') || error.includes('quota')) && (
              <button
                onClick={tab === 'bulk' ? handleBulkSubmit : handleSubmit}
                className="text-[10px] px-3 py-1 rounded-full border border-red-500/40 text-red-400 hover:bg-red-500/10 transition shrink-0"
              >
                Retry
              </button>
            )}
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
        {/* Ingest history */}
        {history.length > 0 && (
          <div className="mt-16 border-t pt-10" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[9px] tracking-[0.3em] uppercase mb-5" style={{ color: 'rgba(222,219,200,0.3)' }}>
              Recent Ingestions
            </p>
            <div className="space-y-2">
              {history.map(log => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] truncate" style={{ color: '#DEDBC8' }}>
                      {log.source_title || log.source_url || 'Manual text'}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(222,219,200,0.35)' }}>
                      {log.pages_created > 0 && `${log.pages_created} created`}
                      {log.pages_created > 0 && log.pages_updated > 0 && ' · '}
                      {log.pages_updated > 0 && `${log.pages_updated} updated`}
                      {log.pages_created === 0 && log.pages_updated === 0 && 'No pages'}
                    </p>
                  </div>
                  <span className="text-[9px] shrink-0" style={{ color: 'rgba(222,219,200,0.2)' }}>
                    {new Date(log.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
