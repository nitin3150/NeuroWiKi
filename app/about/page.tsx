'use client'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { ArrowUpRight } from 'lucide-react'

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode, delay?: number, className?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function ScaleIn({ children, delay = 0, className = '' }: { children: React.ReactNode, delay?: number, className?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-[#DEDBC8]">
      
      {/* Section 1 — Motto Hero */}
      <section className="pt-32 pb-20 px-6 text-center max-w-4xl mx-auto">
        <FadeUp delay={0.15}>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-6">Our Motto</p>
        </FadeUp>
        
        <FadeUp delay={0.3}>
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-light leading-[0.95] mb-8">
            <span className="block mb-2">Don't just retrieve.</span>
            <span className="block font-serif italic text-5xl md:text-6xl lg:text-[5.5rem]">Compile.</span>
          </h1>
        </FadeUp>
        
        <FadeUp delay={0.45}>
          <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Normal AI forgets everything the moment the chat ends. NeuroWiki compiles your sources into a persistent, interlinked knowledge base — once, and forever.
          </p>
        </FadeUp>
      </section>

      {/* Section 2 — Problem / Solution */}
      <section className="bg-[#101010] py-24 px-6 border-y border-white/5">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
          
          {/* Left: The Problem */}
          <ScaleIn delay={0.1}>
            <div className="flex flex-col gap-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest">The Problem</p>
              <p className="text-xl text-gray-300 leading-relaxed font-light">
                Standard RAG re-derives knowledge from scratch on every query. It's expensive, slow, and stateless. Andrej Karpathy called it out — we built the fix.
              </p>
            </div>
          </ScaleIn>
          
          {/* Right: The Solution */}
          <ScaleIn delay={0.3}>
            <div className="flex flex-col gap-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest">The Solution</p>
              <p className="text-xl text-gray-300 leading-relaxed font-light">
                Add any source — URL, PDF, or raw text. Gemini reads it, extracts verified knowledge, checks for contradictions, and weaves it into your living wiki. It grows smarter with everything you add.
              </p>
            </div>
          </ScaleIn>
          
        </div>
      </section>

      {/* Section 3 — Tech */}
      <section className="py-24 px-6 text-center max-w-4xl mx-auto">
        <FadeUp delay={0.1}>
          <p className="text-gray-500 text-sm mb-4">Powered by</p>
        </FadeUp>
        
        <FadeUp delay={0.25}>
          <p className="text-2xl md:text-3xl font-light text-gray-300 mb-10">
            Gemini 2.0 Flash · HydraDB · Next.js 15 · Cloud Run
          </p>
        </FadeUp>
        
        <FadeUp delay={0.4}>
          <a
            href="https://github.com/SyedArmanAli2003/NeuroWiKi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-white/10 rounded-full px-6 py-3 text-sm text-[#DEDBC8] hover:bg-white/5 transition-colors group"
          >
            Read the full architecture on GitHub
            <ArrowUpRight size={16} className="text-gray-400 group-hover:text-[#DEDBC8] transition-colors" />
          </a>
        </FadeUp>
      </section>

    </div>
  )
}
