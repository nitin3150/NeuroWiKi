'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { WordsPullUp } from '@/components/animations/WordsPullUp'
import { FadeUp } from '@/components/animations/FadeUp'
import { TypeBadge } from '@/components/TypeBadge'
import { Onboarding } from '@/components/Onboarding'

export default function Home() {
  const [pages, setPages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/wiki')
      .then((res) => res.json())
      .then((data) => {
        if (data.pages) {
          // Take last 6 pages
          setPages(data.pages.slice(0, 6))
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to fetch pages', err)
        setLoading(false)
      })
  }, [])

  return (
    <div className="w-full min-h-screen bg-black">
      <Onboarding />
      {/* FIX 4 — HERO SECTION WRAPPER */}
      <section className="w-full h-screen p-3 sm:p-4 md:p-5 lg:p-6">
        <div className="relative w-full h-full rounded-2xl md:rounded-[2rem] overflow-hidden bg-black">
          
          {/* Video — BOTTOM layer */}
          <video
            autoPlay loop muted playsInline preload="none"
            className="absolute inset-0 w-full h-full object-cover object-center"
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4"
          />

          {/* Noise — MIDDLE layer */}
          <div
            className="noise-overlay absolute inset-0 pointer-events-none mix-blend-overlay"
            style={{ opacity: 0.7 }}
          />

          {/* Gradient — ABOVE noise */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/30 via-transparent to-black/70" />

          {/* FIX 3 — NAVBAR PILL */}
          <nav className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
            <div className="bg-black rounded-b-2xl md:rounded-b-3xl px-4 py-2 md:px-7 md:py-2.5 flex items-center gap-4 sm:gap-6 md:gap-10">
              {[
                { label: 'Browse', href: '/wiki' },
                { label: 'Add Source', href: '/ingest' },
                { label: 'Search', href: '/search' },
                { label: 'Graph', href: '/graph' },
                { label: 'About', href: '/' },
              ].map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="text-[10px] sm:text-xs tracking-wider whitespace-nowrap transition-colors duration-200"
                  style={{ color: 'rgba(225, 224, 204, 0.75)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.color = '#E1E0CC'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.color = 'rgba(225, 224, 204, 0.75)'
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>

          {/* Hero content — bottom aligned */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 md:p-8 lg:p-10">
            
            {/* FIX 2 — CORRECTED GRID LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 items-end gap-4 lg:gap-6">
              
              {/* LEFT — heading takes more columns */}
              <div className="col-span-1 lg:col-span-7 xl:col-span-8">
                <div className="relative">
                  {/* FIX 1 — CORRECTED FONT SIZES */}
                  <WordsPullUp
                    text="NeuroWiki"
                    className="font-medium leading-[0.85] tracking-[-0.07em] text-[15vw] sm:text-[13vw] md:text-[11vw] lg:text-[9vw] xl:text-[8.5vw] 2xl:text-[8vw]"
                    style={{ color: '#E1E0CC' }}
                  />
                  <sup style={{
                    position: 'absolute',
                    top: '0.4em',
                    right: '-0.15em',
                    fontSize: '0.2em',
                    color: '#E1E0CC',
                    lineHeight: 1,
                  }}>*</sup>
                </div>
              </div>

              {/* RIGHT — description + button */}
              <div className="col-span-1 lg:col-span-5 xl:col-span-4 flex flex-col gap-3 sm:gap-4 lg:pb-3">
                
                {/* Description */}
                <FadeUp delay={0.5}>
                  <p
                    className="text-xs sm:text-sm leading-[1.3] max-w-sm"
                    style={{ color: 'rgba(222,219,200,0.7)' }}
                  >
                    Your ideas, your sources — one living, breathing, 
                    AI-built encyclopedia that grows smarter with everything you add.
                  </p>
                </FadeUp>

                {/* Stats */}
                <FadeUp delay={0.6}>
                  <p
                    className="text-[9px] sm:text-[10px] tracking-wider"
                    style={{ color: 'rgba(222,219,200,0.35)' }}
                  >
                    {pages.length} pages · AI-powered
                  </p>
                </FadeUp>

                {/* CTA Button */}
                <FadeUp delay={0.7}>
                  <Link
                    href="/ingest"
                    className="group inline-flex items-center gap-2 bg-[#DEDBC8] rounded-full pl-4 pr-1 py-1 w-fit hover:gap-3 transition-all duration-300"
                  >
                    <span className="text-black font-medium text-sm sm:text-base whitespace-nowrap">
                      Start building
                    </span>
                    <div className="bg-black rounded-full w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                      <ArrowRight size={14} color="#DEDBC8" />
                    </div>
                  </Link>
                </FadeUp>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* FIX 6 — RECENTLY ADDED SECTION */}
      <section className="bg-black pt-16 sm:pt-20 pb-16 px-5 sm:px-6 md:px-8">
        <p
          className="text-[9px] sm:text-[10px] tracking-[0.3em] uppercase mb-6 sm:mb-8"
          style={{ color: 'rgba(222,219,200,0.3)' }}
        >
          RECENTLY ADDED
        </p>

        {!loading && pages.length > 0 && (
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {pages.map((page, index) => (
              <FadeUp key={page.slug} delay={index * 0.08} className="flex-shrink-0">
                <Link
                  href={`/wiki/${page.slug}`}
                  className="block w-52 sm:w-60 md:w-64 bg-[#101010] rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-transparent hover:border-white/10 transition-all duration-300 cursor-pointer h-full group"
                >
                  <TypeBadge type={page.type} />
                  <h3
                    className="text-sm sm:text-base font-medium mt-2 sm:mt-3 mb-1 leading-tight"
                    style={{ color: '#E1E0CC' }}
                  >
                    {page.title}
                  </h3>
                  <p
                    className="text-[10px] sm:text-[11px] leading-relaxed line-clamp-3"
                    style={{ color: 'rgba(222,219,200,0.45)' }}
                  >
                    {page.summary || 'No summary available for this page.'}
                  </p>
                  <p
                    className="text-[8px] sm:text-[9px] mt-3 sm:mt-4"
                    style={{ color: 'rgba(222,219,200,0.25)' }}
                  >
                    {new Date(page.created_at || Date.now()).toLocaleDateString()}
                  </p>
                </Link>
              </FadeUp>
            ))}
          </div>
        )}

        {!loading && pages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 w-full text-center">
            <span
              className="font-bold leading-none mb-2"
              style={{ fontSize: 'clamp(4rem, 15vw, 8rem)', color: 'rgba(255,255,255,0.04)' }}
            >
              0
            </span>
            <p className="text-sm" style={{ color: 'rgba(222,219,200,0.35)' }}>
              Your wiki is empty.
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(222,219,200,0.2)' }}>
              Add a source to begin.
            </p>
            
            {/* FIX 5 — EMPTY STATE BUTTON */}
            <Link
              href="/ingest"
              className="mt-6 inline-flex items-center gap-2 bg-[#DEDBC8] rounded-full pl-4 pr-1 py-1 hover:opacity-90 transition-opacity"
            >
              <span className="text-black font-medium text-sm">
                Add your first source
              </span>
              <div className="bg-black rounded-full w-8 h-8 flex items-center justify-center">
                <ArrowRight size={13} color="#DEDBC8" />
              </div>
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
