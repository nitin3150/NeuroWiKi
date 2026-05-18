'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import Link from 'next/link'

const TYPES = ['concept', 'person', 'place', 'event', 'tool', 'organization'] as const

export default function EditPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const [page, setPage] = useState<{ title: string; content: string; summary: string; type: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/wiki/${slug}`)
      .then(r => r.json())
      .then(d => setPage(d.page))
  }, [slug])

  const handleSave = useCallback(async () => {
    if (!page || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/wiki/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(page),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast.success('Page saved')
      router.push(`/wiki/${slug}`)
    } catch (e: any) {
      setError(e.message)
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }, [page, saving, slug, router])

  // Cmd+S / Ctrl+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave])

  if (!page) return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <Loader2 className="animate-spin" style={{ color: 'rgba(222,219,200,0.4)' }} />
    </div>
  )

  return (
    <div className="bg-black min-h-screen px-6 md:px-12 py-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href={`/wiki/${slug}`}
            className="flex items-center gap-1.5 text-[10px] tracking-wider uppercase transition-opacity hover:opacity-100"
            style={{ color: 'rgba(222,219,200,0.35)' }}>
            <ArrowLeft size={11} /> Back
          </Link>
          <h1 className="text-lg font-medium" style={{ color: '#E1E0CC' }}>Edit page</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] tracking-wider hidden sm:block" style={{ color: 'rgba(222,219,200,0.2)' }}>
            ⌘S to save
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#DEDBC8] text-black font-medium text-sm px-4 py-2 rounded-full hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-950/30 border border-red-900/50 rounded-xl px-4 py-3">
          <p className="text-[11px] text-red-300">{error}</p>
        </div>
      )}

      <div className="space-y-5">
        {/* Title + Type row */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4">
          <div>
            <label className="text-[10px] tracking-[0.3em] uppercase block mb-2"
              style={{ color: 'rgba(222,219,200,0.35)' }}>Title</label>
            <input
              value={page.title}
              onChange={e => setPage({ ...page, title: e.target.value })}
              className="w-full bg-[#111] border border-white/8 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/20 transition"
              style={{ color: '#DEDBC8' }}
            />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.3em] uppercase block mb-2"
              style={{ color: 'rgba(222,219,200,0.35)' }}>Type</label>
            <select
              value={page.type}
              onChange={e => setPage({ ...page, type: e.target.value })}
              className="w-full bg-[#111] border border-white/8 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/20 transition appearance-none cursor-pointer"
              style={{ color: '#DEDBC8' }}
            >
              {TYPES.map(t => (
                <option key={t} value={t} style={{ background: '#111' }}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div>
          <label className="text-[10px] tracking-[0.3em] uppercase block mb-2"
            style={{ color: 'rgba(222,219,200,0.35)' }}>Summary</label>
          <input
            value={page.summary || ''}
            onChange={e => setPage({ ...page, summary: e.target.value })}
            placeholder="One-sentence description..."
            className="w-full bg-[#111] border border-white/8 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/20 transition"
            style={{ color: '#DEDBC8' }}
          />
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] tracking-[0.3em] uppercase"
              style={{ color: 'rgba(222,219,200,0.35)' }}>Content — Markdown</label>
            <span className="text-[9px]" style={{ color: 'rgba(222,219,200,0.2)' }}>
              {page.content.split(/\s+/).filter(Boolean).length} words
            </span>
          </div>
          <textarea
            value={page.content}
            onChange={e => setPage({ ...page, content: e.target.value })}
            rows={24}
            className="w-full bg-[#111] border border-white/8 rounded-xl px-4 py-4 text-sm outline-none focus:border-white/20 transition font-mono resize-y"
            style={{ color: 'rgba(222,219,200,0.85)', lineHeight: 1.8, minHeight: '420px' }}
          />
        </div>
      </div>
    </div>
  )
}
