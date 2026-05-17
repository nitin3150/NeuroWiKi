'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Brain, BookOpen, Plus, Search, Network } from 'lucide-react'
import { useEffect, useState } from 'react'

const navItems = [
  { label: 'Home', href: '/', icon: Brain },
  { label: 'Browse Wiki', href: '/wiki', icon: BookOpen },
  { label: 'Add Source', href: '/ingest', icon: Plus },
  { label: 'Search & Ask', href: '/search', icon: Search },
  { label: 'Knowledge Graph', href: '/graph', icon: Network },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-56 bg-black border-r border-white/5 flex-col z-40">
      <div className="p-6 border-b border-white/5">
        <span className="text-xs tracking-[0.3em] uppercase" style={{ color: '#DEDBC8' }}>
          N · W
        </span>
        <p className="text-[9px] tracking-widest opacity-30 mt-1 uppercase">NeuroWiki</p>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-5 py-2.5 text-[11px] tracking-wider uppercase transition-all duration-200 border-l-2 ${
                active
                  ? 'border-[#DEDBC8] text-[#DEDBC8]'
                  : 'border-transparent hover:text-[#DEDBC8]'
              }`}
              style={{ color: active ? '#DEDBC8' : 'rgba(225,224,204,0.4)' }}
            >
              <Icon size={13} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-5 border-t border-white/5">
        <p className="text-[9px] tracking-[0.3em] uppercase mb-3" style={{ color: 'rgba(225,224,204,0.3)' }}>
          Recent
        </p>
        <RecentPages />
      </div>
    </aside>
  )
}

function RecentPages() {
  const [recent, setRecent] = useState<{ slug: string; title: string }[]>([])

  useEffect(() => {
    fetch('/api/wiki', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        // Data format returned by our API is { pages: [...] }
        const pages = data.pages || []
        setRecent(pages.slice(0, 5))
      })
      .catch(() => {})
  }, [])

  if (recent.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {recent.map((p) => (
        <Link
          key={p.slug}
          href={`/wiki/${p.slug}`}
          className="text-[10px] truncate transition-all duration-200"
          style={{ color: 'rgba(225,224,204,0.4)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#DEDBC8')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(225,224,204,0.4)')}
        >
          {p.title}
        </Link>
      ))}
    </div>
  )
}
