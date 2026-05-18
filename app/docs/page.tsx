'use client'

import { WordsPullUp } from '@/components/animations/WordsPullUp'
import { FadeUp } from '@/components/animations/FadeUp'
import { Brain, Plus, Search, Network, ShieldCheck, Database } from 'lucide-react'

export default function DocsPage() {
  const steps = [
    {
      icon: Plus,
      title: '1. Add Source (Ingest)',
      desc: 'Paste a URL, drop a PDF/Word file, or paste raw text. The AI agent will read the source and automatically generate structured Wiki pages (concepts, people, events).',
    },
    {
      icon: Brain,
      title: '2. Review the Magic',
      desc: 'The AI checks for factual consistency against existing pages and extracts exact sentences to cite its sources, preventing hallucinations.',
    },
    {
      icon: Search,
      title: '3. Search & Ask',
      desc: 'Ask questions about your knowledge base. The assistant uses a mixture of graph-aware and vector recall to find the exact pages to answer your question.',
    },
    {
      icon: Network,
      title: '4. Knowledge Graph',
      desc: 'View your growing wiki as an interactive 2D node graph. Watch how concepts naturally interconnect based on the uploaded sources.',
    },
    {
      icon: ShieldCheck,
      title: '5. Wiki Health',
      desc: 'Run a linting sweep to find "orphaned" pages (no links), "islands" (disconnected groups), and missing concepts that should be documented.',
    },
    {
      icon: Database,
      title: '6. Manage Sources',
      desc: 'View all sources that have been uploaded, and delete or re-sync them as needed.',
    },
  ]

  return (
    <div className="min-h-screen pt-24 px-6 md:px-12 max-w-4xl mx-auto pb-32">
      <div className="mb-16">
        <h1 className="text-4xl md:text-6xl font-medium tracking-tight" style={{ color: '#E1E0CC' }}>
          <WordsPullUp text="How to Use NeuroWiki" />
        </h1>
        <FadeUp delay={0.2}>
          <p className="text-lg mt-6 leading-relaxed" style={{ color: 'rgba(222,219,200,0.6)' }}>
            NeuroWiki is an intelligent, self-organizing knowledge base. Instead of writing pages manually, you feed it sources and let the AI build the wiki for you.
          </p>
        </FadeUp>
      </div>

      <div className="space-y-8">
        {steps.map((step, i) => (
          <FadeUp key={i} delay={0.3 + i * 0.1}>
            <div 
              className="p-6 rounded-2xl border flex flex-col md:flex-row gap-6 items-start"
              style={{ 
                background: 'rgba(255,255,255,0.02)', 
                borderColor: 'rgba(255,255,255,0.06)' 
              }}
            >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#DEDBC8' }}
              >
                <step.icon size={20} className="text-black" />
              </div>
              <div>
                <h3 className="text-xl font-medium mb-3" style={{ color: '#E1E0CC' }}>
                  {step.title}
                </h3>
                <p className="leading-relaxed" style={{ color: 'rgba(222,219,200,0.5)' }}>
                  {step.desc}
                </p>
              </div>
            </div>
          </FadeUp>
        ))}
      </div>

      <FadeUp delay={0.9}>
        <div 
          className="mt-16 p-8 rounded-2xl border"
          style={{ 
            background: 'rgba(222,219,200,0.05)', 
            borderColor: 'rgba(222,219,200,0.1)' 
          }}
        >
          <h3 className="text-xl font-medium mb-4" style={{ color: '#E1E0CC' }}>Under the Hood</h3>
          <p className="leading-relaxed" style={{ color: 'rgba(222,219,200,0.6)' }}>
            NeuroWiki uses a sophisticated multi-model fallback chain spanning both Google Gemini and OpenRouter (Llama models). When you upload a source, it handles chunking, citation generation, graph linkage, and anomaly detection completely autonomously.
          </p>
        </div>
      </FadeUp>
    </div>
  )
}
