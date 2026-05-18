'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, BookOpen, Plus, Search,
  Network, ShieldCheck, User, X, Database
} from 'lucide-react'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'Home', href: '/', icon: Brain },
  { label: 'Browse Wiki', href: '/wiki', icon: BookOpen },
  { label: 'Add Source', href: '/ingest', icon: Plus },
  { label: 'Source Manager', href: '/sources', icon: Database },
  { label: 'Search & Ask', href: '/search', icon: Search },
  { label: 'Knowledge Graph', href: '/graph', icon: Network },
  { label: 'Wiki Health', href: '/audit', icon: ShieldCheck },
]

export function HoverSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnterZone = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(true)
  }

  const handleMouseLeavePanel = () => {
    timerRef.current = setTimeout(() => {
      setOpen(false)
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
                <Link
                  href="/about"
                  onClick={() => setOpen(false)}
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
                </Link>
              </nav>

            {/* Footer */}
            <div className="p-5 border-t border-white/5">
              <p className="text-[9px] tracking-wider opacity-20 uppercase">
                Hover left edge to open
              </p>
            </div>
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
            onClick={() => { setOpen(false) }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
