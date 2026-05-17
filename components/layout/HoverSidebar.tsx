'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, BookOpen, Plus, Search,
  Network, ShieldCheck, User, X
} from 'lucide-react'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'Home', href: '/', icon: Brain },
  { label: 'Browse Wiki', href: '/wiki', icon: BookOpen },
  { label: 'Add Source', href: '/ingest', icon: Plus },
  { label: 'Search & Ask', href: '/search', icon: Search },
  { label: 'Knowledge Graph', href: '/graph', icon: Network },
  { label: 'Wiki Health', href: '/audit', icon: ShieldCheck },
]

export function HoverSidebar() {
  const [open, setOpen] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const pathname = usePathname()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnterZone = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(true)
  }

  const handleMouseLeavePanel = () => {
    timerRef.current = setTimeout(() => {
      setOpen(false)
      setShowAbout(false)
    }, 300)
  }

  const handleMouseEnterPanel = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  return (
    <>
      {/* Invisible hover trigger zone — left edge 20px wide */}
      <div
        className="fixed left-0 top-0 w-5 h-full z-50"
        onMouseEnter={handleMouseEnterZone}
      />

      <AnimatePresence>
        {!open && (
          <motion.div
            className="fixed left-0 top-1/2 -translate-y-1/2 z-50 
                       w-0.5 h-16 rounded-full"
            style={{ background: 'rgba(222,219,200,0.2)' }}
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            onMouseEnter={handleMouseEnterZone}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-0 top-0 h-full w-64 z-50 flex flex-col"
            style={{
              background: 'rgba(8, 8, 8, 0.97)',
              backdropFilter: 'blur(20px)',
              borderRight: '1px solid rgba(255,255,255,0.06)',
            }}
            onMouseEnter={handleMouseEnterPanel}
            onMouseLeave={handleMouseLeavePanel}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <span className="text-xs tracking-[0.3em] uppercase"
                  style={{ color: '#DEDBC8' }}>
                  N · W
                </span>
                <p className="text-[9px] tracking-widest opacity-30 mt-0.5 uppercase">
                  NeuroWiki
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="opacity-30 hover:opacity-70 transition-opacity"
              >
                <X size={14} color="#DEDBC8" />
              </button>
            </div>

            {/* Navigation */}
            {!showAbout && (
              <nav className="flex-1 py-4 overflow-y-auto">
                {navItems.map(({ label, href, icon: Icon }) => {
                  const active = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-5 py-3 
                                 text-[11px] tracking-wider uppercase 
                                 transition-all duration-200 border-l-2
                                 hover:bg-white/3"
                      style={{
                        borderLeftColor: active ? '#DEDBC8' : 'transparent',
                        color: active
                          ? '#DEDBC8'
                          : 'rgba(225,224,204,0.4)',
                      }}
                      onMouseEnter={e => {
                        if (!active)
                          (e.currentTarget as HTMLElement).style.color = '#DEDBC8'
                      }}
                      onMouseLeave={e => {
                        if (!active)
                          (e.currentTarget as HTMLElement).style.color = 'rgba(225,224,204,0.4)'
                      }}
                    >
                      <Icon size={13} />
                      {label}
                    </Link>
                  )
                })}

                {/* About button */}
                <button
                  onClick={() => setShowAbout(true)}
                  className="w-full flex items-center gap-3 px-5 py-3 
                             text-[11px] tracking-wider uppercase 
                             transition-all duration-200 border-l-2 
                             border-transparent hover:bg-white/3 mt-4
                             border-t border-t-white/5"
                  style={{ color: 'rgba(225,224,204,0.4)' }}
                  onMouseEnter={e =>
                    ((e.currentTarget as HTMLElement).style.color = '#DEDBC8')
                  }
                  onMouseLeave={e =>
                    ((e.currentTarget as HTMLElement).style.color = 'rgba(225,224,204,0.4)')
                  }
                >
                  <User size={13} />
                  About This Project
                </button>
              </nav>
            )}

            {/* About Panel */}
            {showAbout && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 p-6 overflow-y-auto"
              >
                <button
                  onClick={() => setShowAbout(false)}
                  className="text-[10px] tracking-wider uppercase mb-6 
                             flex items-center gap-2 transition-opacity 
                             hover:opacity-100"
                  style={{ color: 'rgba(222,219,200,0.4)' }}
                >
                  ← Back
                </button>

                <p className="text-[9px] tracking-[0.3em] uppercase mb-3"
                  style={{ color: 'rgba(222,219,200,0.3)' }}>
                  About
                </p>

                <h3 className="text-base font-medium mb-3"
                  style={{ color: '#E1E0CC' }}>
                  NeuroWiki
                </h3>

                <p className="text-[11px] leading-relaxed mb-4"
                  style={{ color: 'rgba(222,219,200,0.55)' }}>
                  An AI-powered personal Wikipedia that compiles your 
                  sources into a living, interlinked knowledge base. 
                  Built for the hackathon — inspired by Karpathy's 
                  LLM Wiki pattern.
                </p>

                <div className="space-y-2 mb-6">
                  {[
                    'Next.js 15 + TypeScript',
                    'Google Gemini 2.0 Flash',
                    'HydraDB Knowledge Graph',
                    'Framer Motion',
                    'Cloud Run deployment',
                  ].map(tech => (
                    <div key={tech} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-[#DEDBC8] opacity-40" />
                      <span className="text-[10px]"
                        style={{ color: 'rgba(222,219,200,0.45)' }}>
                        {tech}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/5 pt-4 space-y-3">
                  <p className="text-[9px] tracking-[0.3em] uppercase"
                    style={{ color: 'rgba(222,219,200,0.3)' }}>
                    Author
                  </p>
                  <p className="text-sm font-medium"
                    style={{ color: '#E1E0CC' }}>
                    Your Name
                  </p>
                  <a
                    href="https://github.com/YOUR_USERNAME/neurowiki"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 
                               text-[10px] tracking-wider 
                               transition-opacity hover:opacity-100"
                    style={{ color: 'rgba(222,219,200,0.5)' }}
                  >
                    github.com/YOUR_USERNAME/neurowiki
                  </a>
                </div>
              </motion.div>
            )}

            {/* Footer */}
            {!showAbout && (
              <div className="p-5 border-t border-white/5">
                <p className="text-[9px] tracking-wider opacity-20 uppercase">
                  Hover left edge to open
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop when open */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.3)' }}
            onClick={() => { setOpen(false); setShowAbout(false) }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
