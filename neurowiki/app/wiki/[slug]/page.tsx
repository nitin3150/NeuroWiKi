import { WikiRenderer } from '@/components/WikiRenderer'
import { TypeBadge } from '@/components/TypeBadge'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

async function getPage(slug: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/wiki/${slug}`, {
      cache: 'no-store'
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function WikiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getPage(slug)
  if (!data) notFound()

  const { page, relatedPages = [] } = data

  return (
    <div className="bg-black min-h-screen">
      {/* Hero bar */}
      <div className="py-12 px-8 md:px-16 border-b border-white/5">
        <Link href="/wiki" className="inline-flex items-center gap-2 text-[10px] tracking-wider uppercase mb-6 transition-opacity hover:opacity-100"
          style={{ color: 'rgba(222,219,200,0.4)' }}>
          <ArrowLeft size={12} /> All Pages
        </Link>
        <div className="mb-3">
          <TypeBadge type={page.type} />
        </div>
        <h1 className="font-medium leading-[0.9] mb-4"
          style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', color: '#E1E0CC' }}>
          {page.title}
        </h1>
        {page.summary && (
          <p className="font-serif-italic text-lg max-w-2xl" style={{ color: 'rgba(222,219,200,0.55)' }}>
            {page.summary}
          </p>
        )}
      </div>

      {/* Two column layout */}
      <div className="px-8 md:px-16 py-12 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-12">

        {/* Main content */}
        <div>
          <WikiRenderer content={page.content} />

          {/* Sources */}
          {page.sources?.length > 0 && (
            <div className="mt-12 pt-8 border-t border-white/5">
              <p className="text-[9px] tracking-[0.3em] uppercase mb-4" style={{ color: 'rgba(222,219,200,0.3)' }}>
                Built From
              </p>
              <div className="flex flex-wrap gap-2">
                {page.sources.map((s: { title: string; url?: string }, i: number) => (
                  <span key={i} className="bg-[#181818] rounded-full px-3 py-1 text-[10px]"
                    style={{ color: 'rgba(222,219,200,0.5)' }}>
                    {s.title || 'Source'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-24 space-y-8 h-fit">
          {relatedPages?.length > 0 && (
            <div>
              <p className="text-[9px] tracking-[0.3em] uppercase mb-3" style={{ color: 'rgba(222,219,200,0.3)' }}>
                Related Pages
              </p>
              <div className="space-y-2">
                {relatedPages.map((r: { slug: string; title: string; type: string }) => (
                  <Link key={r.slug} href={`/wiki/${r.slug}`}
                    className="flex items-center gap-2 py-1.5 group">
                    <TypeBadge type={r.type} />
                    <span className="text-[11px] transition-opacity group-hover:opacity-100"
                      style={{ color: 'rgba(222,219,200,0.5)' }}>
                      {r.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase mb-3" style={{ color: 'rgba(222,219,200,0.3)' }}>
              Last Updated
            </p>
            <p className="text-[11px]" style={{ color: 'rgba(222,219,200,0.4)' }}>
              {new Date(page.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
