'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { WordsPullUp } from '@/components/animations/WordsPullUp'
import { FadeUp } from '@/components/animations/FadeUp'
import { TypeBadge } from '@/components/TypeBadge'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const TYPES = ['All', 'concept', 'person', 'place', 'event', 'tool', 'organization']

interface Page {
  slug: string
  title: string
  summary: string
  type: string
  updated_at: string
}

function PageCard({ page, index }: { page: Page; index: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      initial={{ scale: 0.97, opacity: 0 }}
      animate={isInView ? { scale: 1, opacity: 1 } : {}}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/wiki/${page.slug}`}>
        <div className="bg-[#212121] rounded-2xl p-5 cursor-pointer hover:bg-[#282828] hover:-translate-y-0.5 transition-all duration-200 h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <TypeBadge type={page.type} />
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>#{index + 1}</span>
          </div>
          <h3 className="text-base font-medium mb-2" style={{ color: '#E1E0CC' }}>{page.title}</h3>
          <p className="text-[11px] leading-relaxed line-clamp-3 mb-4 flex-1" style={{ color: 'rgba(222,219,200,0.45)' }}>
            {page.summary}
          </p>
          <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-[9px]" style={{ color: 'rgba(222,219,200,0.3)' }}>
              {new Date(page.updated_at).toLocaleDateString()}
            </span>
            <span className="text-[11px]" style={{ color: 'rgba(222,219,200,0.3)' }}>→</span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export default function WikiBrowserPage() {
  const [pages, setPages] = useState<Page[]>([])
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/wiki').then(r => r.json()).then(data => {
      setPages(data.pages || [])
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  const filtered = pages.filter(p => {
    const matchType = filter === 'All' || p.type === filter
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.summary?.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div className="bg-black min-h-screen flex flex-col">
      <div className="py-16 px-8 border-b border-white/5">
        <h1 className="font-medium leading-[0.9]" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', color: '#E1E0CC' }}>
          <WordsPullUp text="Everything you know." />
        </h1>
        <FadeUp delay={0.3}>
          <p className="font-serif-italic text-xl mt-3" style={{ color: 'rgba(222,219,200,0.5)' }}>
            Compiled. Connected. Yours.
          </p>
        </FadeUp>
      </div>

      <div className="sticky top-[49px] z-20 bg-black/90 backdrop-blur-sm border-b border-white/5 px-8 py-3 flex items-center gap-3 flex-wrap">
        {TYPES.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`text-[10px] tracking-wider uppercase px-3 py-1 rounded-full border transition-all duration-200 ${
              filter === type
                ? 'bg-[#DEDBC8] border-[#DEDBC8] text-black'
                : 'border-white/10 hover:border-white/30'
            }`}
            style={{ color: filter === type ? '#000' : 'rgba(222,219,200,0.5)' }}
          >
            {type}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter pages..."
          className="ml-auto bg-transparent border-b border-white/10 text-[11px] px-2 py-1 outline-none w-40"
          style={{ color: '#DEDBC8' }}
        />
      </div>

      <div className="p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 items-start">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[#212121] rounded-2xl p-5 animate-pulse h-48" />
            ))
          : filtered.length === 0
          ? <div className="col-span-full text-center py-20 flex flex-col items-center justify-center h-64">
              <p className="text-sm" style={{ color: 'rgba(222,219,200,0.3)' }}>No pages found.</p>
            </div>
          : filtered.map((page, i) => <PageCard key={page.slug} page={page} index={i} />)
        }
      </div>
    </div>
  )
}
