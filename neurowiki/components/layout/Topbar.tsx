'use client'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/': 'Home',
  '/wiki': 'Browse Wiki',
  '/ingest': 'Add Source',
  '/search': 'Search & Ask',
  '/graph': 'Knowledge Graph',
}

export function Topbar() {
  const pathname = usePathname()
  const title = pageTitles[pathname] || 'Wiki Page'

  return (
    <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-sm border-b border-white/5 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button className="lg:hidden" style={{ color: 'rgba(225,224,204,0.5)' }}>
          <Menu size={18} />
        </button>
        <span className="text-[11px] tracking-[0.2em] uppercase" style={{ color: 'rgba(225,224,204,0.4)' }}>
          {title}
        </span>
      </div>
      <span className="text-[10px]" style={{ color: 'rgba(225,224,204,0.3)' }}>
        NeuroWiki · AI-Powered
      </span>
    </header>
  )
}
