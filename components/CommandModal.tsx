'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { BookOpen, Plus, Network, ShieldCheck, Search, X } from 'lucide-react'

interface Page {
  slug: string
  title: string
  type: string
  summary?: string
}

const quickLinks = [
  { label: 'Browse Wiki',     href: '/wiki',   icon: BookOpen },
  { label: 'Add Source',      href: '/ingest', icon: Plus },
  { label: 'Knowledge Graph', href: '/graph',  icon: Network },
  { label: 'Wiki Health',     href: '/audit',  icon: ShieldCheck },
  { label: 'Search & Ask',    href: '/search', icon: Search },
]

export function CommandModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery]       = useState('')
  const [allPages, setAllPages] = useState<Page[]>([])
  const [results, setResults]   = useState<Page[]>([])

  // Fetch pages once when modal first opens
  useEffect(() => {
    if (open && allPages.length === 0) {
      fetch('/api/wiki')
        .then(r => r.json())
        .then((d: any) => setAllPages(Array.isArray(d) ? d : (d.pages ?? [])))
        .catch(() => {})
    }
    if (open) setQuery('')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live filter
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const q = query.toLowerCase()
    setResults(
      allPages
        .filter(p =>
          p.title.toLowerCase().includes(q) ||
          (p.summary ?? '').toLowerCase().includes(q)
        )
        .slice(0, 6)
    )
  }, [query, allPages])

  // ESC to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{   opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[18vh] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4"
          >
            <div
              className="w-full rounded-2xl overflow-hidden"
              style={{
                background: '#0f0f0f',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
              }}
            >
              {/* Input row */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
                <Search size={15} style={{ color: 'rgba(222,219,200,0.3)', flexShrink: 0 }} />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search wiki pages..."
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: '#DEDBC8' }}
                />
                <button onClick={onClose} aria-label="Close">
                  <X size={13} style={{ color: 'rgba(222,219,200,0.3)' }} />
                </button>
              </div>

              {/* Results list */}
              <div className="max-h-80 overflow-y-auto">
                {query && results.length > 0 && (
                  <div className="p-2">
                    <p className="text-[9px] tracking-[0.3em] uppercase px-2 py-1.5"
                       style={{ color: 'rgba(222,219,200,0.25)' }}>
                      Pages
                    </p>
                    {results.map(page => (
                      <Link
                        key={page.slug}
                        href={`/wiki/${page.slug}`}
                        onClick={onClose}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <BookOpen size={13} style={{ color: 'rgba(222,219,200,0.3)', flexShrink: 0 }} />
                        <div className="min-w-0">
                          <p className="text-sm truncate" style={{ color: '#E1E0CC' }}>
                            {page.title}
                          </p>
                          {page.summary && (
                            <p className="text-[10px] truncate mt-0.5"
                               style={{ color: 'rgba(222,219,200,0.35)' }}>
                              {page.summary}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {query && results.length === 0 && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm" style={{ color: 'rgba(222,219,200,0.3)' }}>
                      No pages found for &quot;{query}&quot;
                    </p>
                    <Link
                      href={`/search?q=${encodeURIComponent(query)}`}
                      onClick={onClose}
                      className="mt-3 inline-flex items-center gap-1.5 text-[11px] transition-opacity hover:opacity-80"
                      style={{ color: 'rgba(222,219,200,0.5)' }}
                    >
                      <Search size={11} />
                      Ask your wiki instead →
                    </Link>
                  </div>
                )}

                {!query && (
                  <div className="p-2">
                    <p className="text-[9px] tracking-[0.3em] uppercase px-2 py-1.5"
                       style={{ color: 'rgba(222,219,200,0.25)' }}>
                      Quick Navigation
                    </p>
                    {quickLinks.map(({ label, href, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={onClose}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <Icon size={13} style={{ color: 'rgba(222,219,200,0.3)' }} />
                        <span className="text-sm" style={{ color: 'rgba(222,219,200,0.7)' }}>
                          {label}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer hints */}
              <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4">
                <span className="text-[9px]" style={{ color: 'rgba(222,219,200,0.2)' }}>
                  ESC to close
                </span>
                <span className="text-[9px]" style={{ color: 'rgba(222,219,200,0.2)' }}>
                  ↵ to open
                </span>
                <span className="ml-auto text-[9px]" style={{ color: 'rgba(222,219,200,0.15)' }}>
                  ⌘K
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
