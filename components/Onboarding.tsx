'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Plus, BookOpen, Search, ArrowRight, X } from 'lucide-react'

const steps = [
  {
    icon: Plus,
    title: 'Add a source',
    description:
      'Paste any URL, text, or upload a PDF. The AI reads it and builds interlinked wiki pages automatically.',
    cta: 'Add Source',
    href: '/ingest',
  },
  {
    icon: BookOpen,
    title: 'Browse your wiki',
    description:
      'Every page is interlinked. Click any [[wikilink]] to explore related concepts across your knowledge base.',
    cta: 'Browse Wiki',
    href: '/wiki',
  },
  {
    icon: Search,
    title: 'Ask your wiki anything',
    description:
      'The AI answers questions using only your knowledge base — no hallucination, always cited.',
    cta: 'Try Search',
    href: '/search',
  },
]

export function Onboarding() {
  const [visible, setVisible] = useState(false)
  const [step,    setStep]    = useState(0)

  useEffect(() => {
    try {
      const done = localStorage.getItem('nw-onboarded')
      if (!done) setVisible(true)
    } catch {
      // localStorage unavailable (SSR guard)
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem('nw-onboarded', '1') } catch { /* noop */ }
    setVisible(false)
  }

  const { icon: Icon, title, description, cta, href } = steps[step]

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            <div
              className="w-full max-w-md rounded-3xl p-8 relative"
              style={{
                background: '#0f0f0f',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.9)',
              }}
            >
              {/* Dismiss */}
              <button
                onClick={dismiss}
                className="absolute top-4 right-4 transition-opacity opacity-30 hover:opacity-70"
                aria-label="Close onboarding"
              >
                <X size={16} color="#DEDBC8" />
              </button>

              {/* Progress bar */}
              <div className="flex gap-1.5 mb-8">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className="h-0.5 flex-1 rounded-full transition-all duration-300"
                    style={{
                      background: i <= step
                        ? '#DEDBC8'
                        : 'rgba(222,219,200,0.15)',
                    }}
                  />
                ))}
              </div>

              {/* Step content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{   opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                    style={{ background: 'rgba(222,219,200,0.08)' }}
                  >
                    <Icon size={22} style={{ color: '#DEDBC8' }} />
                  </div>

                  <h2
                    className="text-2xl font-medium mb-3"
                    style={{ color: '#E1E0CC' }}
                  >
                    {title}
                  </h2>
                  <p
                    className="text-sm leading-relaxed mb-8"
                    style={{ color: 'rgba(222,219,200,0.55)' }}
                  >
                    {description}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-3">
                    {step < steps.length - 1 ? (
                      <>
                        <button
                          onClick={() => setStep(s => s + 1)}
                          className="flex-1 bg-[#DEDBC8] text-black font-medium text-sm py-2.5 rounded-full hover:opacity-90 transition flex items-center justify-center gap-2"
                        >
                          Next <ArrowRight size={14} />
                        </button>
                        <button
                          onClick={dismiss}
                          className="px-4 text-[11px] rounded-full border border-white/10 hover:border-white/25 transition"
                          style={{ color: 'rgba(222,219,200,0.4)' }}
                        >
                          Skip
                        </button>
                      </>
                    ) : (
                      <Link
                        href={href}
                        onClick={dismiss}
                        className="flex-1 bg-[#DEDBC8] text-black font-medium text-sm py-2.5 rounded-full hover:opacity-90 transition flex items-center justify-center gap-2"
                      >
                        {cta} <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
