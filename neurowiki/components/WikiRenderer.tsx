'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
}

function transformWikilinks(content: string) {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_, name) => {
    const slug = slugify(name)
    return `[${name}](/wiki/${slug})`
  })
}

export function WikiRenderer({ content }: { content: string }) {
  const transformed = transformWikilinks(content)
  return (
    <div className="wiki-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <Link href={href || '#'} className="text-primary underline decoration-primary/20 underline-offset-4 hover:decoration-primary/80 transition-all duration-200">
              {children}
            </Link>
          ),
        }}
      >
        {transformed}
      </ReactMarkdown>
    </div>
  )
}
