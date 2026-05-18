import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { HoverSidebar } from '@/components/layout/HoverSidebar'
import { BackButton } from '@/components/layout/BackButton'
import { Topbar } from '@/components/layout/Topbar'
import { PageNav } from '@/components/layout/PageNav'
import { PageTransition } from '@/components/PageTransition'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'NeuroWiki',
  description: 'Your personal AI-powered Wikipedia',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        <HoverSidebar />
        <Topbar />
        <BackButton />
        <PageNav />
        <main className="min-h-screen flex flex-col">
          <PageTransition>
            <div className="flex-1">
              {children}
            </div>
          </PageTransition>
          <Footer />
        </main>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background:   '#151515',
              border:       '1px solid rgba(255,255,255,0.08)',
              color:        '#E1E0CC',
              fontSize:     '12px',
              borderRadius: '12px',
            },
          }}
        />
      </body>
    </html>
  )
}
