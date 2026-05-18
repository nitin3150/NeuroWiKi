'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Brain, BookOpen, Plus, Search, Network, ShieldCheck } from 'lucide-react'

const navItems = [
  { label: 'Home', href: '/', icon: Brain },
  { label: 'Wiki', href: '/wiki', icon: BookOpen },
  { label: 'Add Source', href: '/ingest', icon: Plus },
  { label: 'Search & Ask', href: '/search', icon: Search },
  { label: 'Graph', href: '/graph', icon: Network },
  { label: 'Health', href: '/audit', icon: ShieldCheck },
]

export function Topbar() {
  const pathname = usePathname()
  if (pathname === '/') return null

  return (
    <header className="sticky top-0 z-30 bg-black/90 backdrop-blur-sm border-b border-white/5 px-6 py-0 flex items-center justify-between h-12">
      <Link href="/" className="text-[13px] tracking-[0.15em] uppercase font-semibold" style={{ color: '#DEDBC8' }}>
        NeuroWiki
      </Link>

      <nav className="flex items-center gap-1">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] tracking-wider uppercase transition-all duration-200"
              style={{
                color: active ? '#DEDBC8' : 'rgba(222,219,200,0.35)',
                background: active ? 'rgba(222,219,200,0.08)' : 'transparent',
              }}
            >
              <Icon size={10} />
              {label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
