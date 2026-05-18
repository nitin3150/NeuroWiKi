'use client'
import { useEffect, useState } from 'react'
import { Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FadeUp } from '@/components/animations/FadeUp'
import { WordsPullUp } from '@/components/animations/WordsPullUp'

interface Source {
  id: number; title: string; url: string | null
  raw_content: string; processed: number; created_at: string
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [reingesting, setReingesting] = useState<number | null>(null)

  const load = () => {
    fetch('/api/sources').then(r => r.json()).then(setSources).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    await fetch(`/api/sources/${id}`, { method: 'DELETE' })
    toast.success('Source deleted')
    setSources(s => s.filter(x => x.id !== id))
  }

  const handleReingest = async (source: Source) => {
    setReingesting(source.id)
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: source.raw_content }),
      })
      const data = await res.json()
      toast.success(`Re-ingested: ${data.pagesCreated} pages created`)
    } catch {
      toast.error('Re-ingest failed')
    } finally {
      setReingesting(null)
    }
  }

  return (
    <div className="bg-black min-h-screen px-6 md:px-10 py-12">
      <h1 className="font-medium mb-2" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#E1E0CC' }}>
        <WordsPullUp text="Source Manager" />
      </h1>
      <FadeUp delay={0.3}>
        <p className="mb-10 font-serif-italic text-lg" style={{ color: 'rgba(222,219,200,0.45)' }}>
          Everything you've fed the wiki.
        </p>
      </FadeUp>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin" style={{ color: 'rgba(222,219,200,0.3)' }} />
        </div>
      ) : sources.length === 0 ? (
        <p className="text-sm text-center py-20" style={{ color: 'rgba(222,219,200,0.3)' }}>
          No sources yet.
        </p>
      ) : (
        <div className="space-y-2">
          {sources.map((source, i) => (
            <FadeUp key={source.id} delay={i * 0.05}>
              <div
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#E1E0CC' }}>
                    {source.title || 'Untitled'}
                  </p>
                  {source.url && (
                    <p className="text-[10px] truncate mt-0.5" style={{ color: 'rgba(222,219,200,0.3)' }}>
                      {source.url}
                    </p>
                  )}
                  <p className="text-[9px] mt-1" style={{ color: 'rgba(222,219,200,0.2)' }}>
                    {source.raw_content.slice(0, 80)}...
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleReingest(source)}
                    disabled={reingesting === source.id}
                    className="p-2 rounded-lg hover:bg-white/5 transition"
                    title="Re-ingest"
                  >
                    {reingesting === source.id
                      ? <Loader2 size={14} className="animate-spin" style={{ color: 'rgba(222,219,200,0.4)' }} />
                      : <RefreshCw size={14} style={{ color: 'rgba(222,219,200,0.4)' }} />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(source.id)}
                    className="p-2 rounded-lg hover:bg-red-950/30 transition"
                    title="Delete"
                  >
                    <Trash2 size={14} style={{ color: 'rgba(200,80,80,0.6)' }} />
                  </button>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      )}
    </div>
  )
}
