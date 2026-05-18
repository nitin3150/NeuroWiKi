'use client'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function BackButton() {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === '/') return null

  return (
    <button
      onClick={() => router.back()}
      className="fixed top-[60px] left-7 z-30 flex items-center gap-2 text-[10px] tracking-wider uppercase transition-opacity hover:opacity-100"
      style={{ color: 'rgba(222,219,200,0.35)' }}
    >
      <ArrowLeft size={11} />
      Back
    </button>
  )
}
