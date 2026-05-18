import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-[#0a0a0a] border-t border-white/5 pt-16 pb-8 px-6 md:px-10 mt-auto">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Column 1: Brand */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              NeuroWiki<span className="text-[#DEDBC8]">*</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed pr-4">
              Your sources. Your knowledge. One living, AI-built encyclopedia that never forgets — and knows when it's wrong.
            </p>
          </div>

          {/* Column 2: Product */}
          <div className="flex flex-col gap-4">
            <h3 className="text-white font-medium text-[11px] tracking-wider uppercase">Product</h3>
            <div className="flex flex-col gap-3">
              <Link href="/wiki" className="text-sm text-gray-400 hover:text-[#DEDBC8] transition-colors w-fit">Browse Wiki</Link>
              <Link href="/ingest" className="text-sm text-gray-400 hover:text-[#DEDBC8] transition-colors w-fit">Add Source</Link>
              <Link href="/search" className="text-sm text-gray-400 hover:text-[#DEDBC8] transition-colors w-fit">Search & Ask</Link>
              <Link href="/graph" className="text-sm text-gray-400 hover:text-[#DEDBC8] transition-colors w-fit">Graph View</Link>
            </div>
          </div>

          {/* Column 3: Project */}
          <div className="flex flex-col gap-4">
            <h3 className="text-white font-medium text-[11px] tracking-wider uppercase">Project</h3>
            <div className="flex flex-col gap-3">
              <a href="https://github.com/SyedArmanAli2003/NeuroWiKi" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-[#DEDBC8] transition-colors w-fit">GitHub</a>
              <a href="https://github.com/SyedArmanAli2003/NeuroWiKi#readme" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-[#DEDBC8] transition-colors w-fit">README</a>
              <a href="https://github.com/SyedArmanAli2003/NeuroWiKi" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-[#DEDBC8] transition-colors w-fit">Architecture</a>
              <a href="https://github.com/SyedArmanAli2003/NeuroWiKi/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-[#DEDBC8] transition-colors w-fit">MIT License</a>
            </div>
          </div>

          {/* Column 4: Built with */}
          <div className="flex flex-col gap-4">
            <h3 className="text-white font-medium text-[11px] tracking-wider uppercase">Built with</h3>
            <div className="flex flex-col gap-3">
              <span className="text-sm text-gray-400 hover:text-[#DEDBC8] transition-colors w-fit cursor-default">Next.js 15</span>
              <span className="text-sm text-gray-400 hover:text-[#DEDBC8] transition-colors w-fit cursor-default">Gemini 2.0 Flash</span>
              <span className="text-sm text-gray-400 hover:text-[#DEDBC8] transition-colors w-fit cursor-default">HydraDB</span>
              <span className="text-sm text-gray-400 hover:text-[#DEDBC8] transition-colors w-fit cursor-default">Google Cloud Run</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            © 2026 NeuroWiki · MIT License
          </p>
          <a
            href="https://github.com/SyedArmanAli2003/NeuroWiKi"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#DEDBC8] transition-colors"
          >
            View on GitHub <ArrowUpRight size={12} />
          </a>
        </div>
      </div>
    </footer>
  )
}
