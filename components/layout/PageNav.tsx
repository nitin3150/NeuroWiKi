'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Command } from 'lucide-react'
import { useState, useEffect } from 'react'
import { CommandModal } from '@/components/CommandModal'

const routeLabels: Record<string, string> = {
  '/wiki':         'Browse Wiki',
  '/ingest':       'Add Source',
  '/search':       'Search & Ask',
  '/graph':        'Knowledge Graph',
  '/audit':        'Wiki Health',
  '/auth/signin':  'Sign In',
  '/auth/signup':  'Sign Up',
}

function getBreadcrumbs(pathname: string) {
  if (pathname === '/') return []

  const crumbs: { label: string; href: string }[] = [
    { label: 'NeuroWiki', href: '/' },
  ]

  // Wiki detail page: /wiki/some-slug
  if (pathname.startsWith('/wiki/') && pathname !== '/wiki/') {
    const slug  = pathname.replace('/wiki/', '')
    const label = slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
    crumbs.push({ label: 'Browse Wiki', href: '/wiki' })
    crumbs.push({ label, href: pathname })
    return crumbs
  }

  const label = routeLabels[pathname]
  if (label) crumbs.push({ label, href: pathname })
  return crumbs
}

export function PageNav() {
  const pathname               = usePathname()
  const [cmdOpen, setCmdOpen]  = useState(false)
  const breadcrumbs            = getBreadcrumbs(pathname)

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Hide on home page
  if (pathname === '/') return null

  return (
    <>
      <nav
        className="sticky top-0 z-30 flex items-center justify-between px-5 py-3"
        style={{
          background:    'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(16px)',
          borderBottom:  '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <div key={crumb.href} className="flex items-center gap-2 min-w-0">
              {i > 0 && (
                <span
                  className="text-[10px] flex-shrink-0"
                  style={{ color: 'rgba(255,255,255,0.15)' }}
                >
                  /
                </span>
              )}
              {i === breadcrumbs.length - 1 ? (
                <span
                  className="text-[11px] tracking-wider truncate max-w-[200px]"
                  style={{ color: 'rgba(222,219,200,0.7)' }}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-[11px] tracking-wider flex-shrink-0 hover:opacity-80 transition-opacity"
                  style={{ color: 'rgba(222,219,200,0.35)' }}
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* ⌘K trigger button */}
        <button
          id="cmd-k-trigger"
          onClick={() => setCmdOpen(true)}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-white/5"
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            color:  'rgba(222,219,200,0.35)',
          }}
          aria-label="Open command palette"
        >
          <Search size={11} />
          <span className="text-[10px]">Search</span>
          <span
            className="text-[9px] tracking-widest ml-1 flex items-center gap-0.5"
            style={{ color: 'rgba(222,219,200,0.2)' }}
          >
            <Command size={9} />K
          </span>
        </button>
      </nav>

      <CommandModal open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  )
}
