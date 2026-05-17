'use client'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { WordsPullUp } from '@/components/animations/WordsPullUp'
import { FadeUp } from '@/components/animations/FadeUp'
import { TypeBadge } from '@/components/TypeBadge'
import { useEffect, useState } from 'react'

interface Page {
  slug: string
  title: string
  summary: string
  type: string
  updated_at: string
}

export default function HomePage() {
  const [pages, setPages] = useState<Page[]>([])
  const [stats, setStats] = useState({ pages: 0, sources: 0 })

  useEffect(() => {
    fetch('/api/wiki').then(r => r.json()).then(data => {
      const fetchedPages = data.pages || []
      setPages(fetchedPages.slice(0, 6))
      setStats({ pages: fetchedPages.length, sources: 0 })
    }).catch(() => {})
  }, [])

  return (
    <div className="bg-black min-h-screen">

      {/* HERO */}
      <section className="h-screen p-4 md:p-6">
        <div className="relative w-full h-full rounded-2xl md:rounded-[2rem] overflow-hidden bg-black">

          {/* Background gradient */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 20% 50%, rgba(120,80,255,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(200,180,120,0.05) 0%, transparent 60%), #000'
          }} />

          {/* Noise overlay */}
          <div className="noise-overlay absolute inset-0 opacity-[0.5] mix-blend-overlay pointer-events-none" />

          {/* Gradient fade bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />

          {/* Top nav pill */}
          <nav className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-black rounded-b-2xl px-6 py-2.5 flex items-center gap-8">
              {['Browse', 'Add Source', 'Search', 'Graph'].map(item => (
                <Link
                  key={item}
                  href={item === 'Browse' ? '/wiki' : item === 'Add Source' ? '/ingest' : item === 'Search' ? '/search' : '/graph'}
                  className="text-[10px] sm:text-xs tracking-wider uppercase transition-all duration-200"
                  style={{ color: 'rgba(225,224,204,0.6)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#E1E0CC')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(225,224,204,0.6)')}
                >
                  {item}
                </Link>
              ))}
            </div>
          </nav>

          {/* Hero content — bottom aligned */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <div className="grid grid-cols-12 items-end gap-4">

              {/* Giant heading */}
              <div className="col-span-12 lg:col-span-8">
                <h1 className="font-medium leading-[0.85] tracking-[-0.07em]"
                  style={{ fontSize: 'clamp(5rem, 18vw, 16rem)', color: '#E1E0CC' }}>
                  <WordsPullUp text="NeuroWiki" />
                </h1>
              </div>

              {/* Right side */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 pb-2">
                <FadeUp delay={0.5}>
                  <p className="text-xs sm:text-sm leading-[1.3]" style={{ color: 'rgba(222,219,200,0.6)' }}>
                    Your ideas. Your sources. One living, breathing, AI-built encyclopedia.
                  </p>
                </FadeUp>

                <FadeUp delay={0.6}>
                  <p className="text-[10px] tracking-wider" style={{ color: 'rgba(222,219,200,0.35)' }}>
                    {stats.pages} pages · AI-powered
                  </p>
                </FadeUp>

                <FadeUp delay={0.7}>
                  <Link href="/ingest"
                    className="group inline-flex items-center gap-2 bg-[#DEDBC8] rounded-full px-4 py-2.5 w-fit transition-all duration-300 hover:gap-3">
                    <span className="text-black font-medium text-sm">Start building</span>
                    <div className="bg-black rounded-full w-8 h-8 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      <ArrowRight size={14} color="#DEDBC8" />
                    </div>
                  </Link>
                </FadeUp>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RECENT PAGES */}
      <section className="py-20 px-8">
        <FadeUp>
          <p className="text-[10px] tracking-[0.3em] uppercase mb-8" style={{ color: 'rgba(222,219,200,0.3)' }}>
            Recently Added
          </p>
        </FadeUp>

        {pages.length === 0 ? (
          <FadeUp delay={0.2}>
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-6xl font-bold mb-4" style={{ color: 'rgba(255,255,255,0.04)' }}>0</p>
              <p className="text-sm mb-2" style={{ color: 'rgba(222,219,200,0.4)' }}>Your wiki is empty.</p>
              <p className="text-xs mb-6" style={{ color: 'rgba(222,219,200,0.25)' }}>Add a source to begin building your knowledge base.</p>
              <Link href="/ingest"
                className="bg-[#DEDBC8] text-black text-xs font-medium px-5 py-2.5 rounded-full hover:opacity-90 transition">
                Add your first source →
              </Link>
            </div>
          </FadeUp>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {pages.map((page, i) => (
              <Link key={page.slug} href={`/wiki/${page.slug}`} style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="w-64 flex-shrink-0 bg-[#101010] rounded-2xl p-5 border border-transparent hover:border-white/10 transition-all duration-300 cursor-pointer">
                  <TypeBadge type={page.type} />
                  <h3 className="text-base font-medium mt-3 mb-1" style={{ color: '#E1E0CC' }}>{page.title}</h3>
                  <p className="text-[11px] leading-relaxed line-clamp-3" style={{ color: 'rgba(222,219,200,0.45)' }}>
                    {page.summary}
                  </p>
                  <p className="text-[9px] mt-4" style={{ color: 'rgba(222,219,200,0.25)' }}>
                    {new Date(page.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
