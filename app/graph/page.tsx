'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { WordsPullUp } from '@/components/animations/WordsPullUp'
import Link from 'next/link'
import { X } from 'lucide-react'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

const TYPE_COLORS: Record<string, string> = {
  concept: '#7C65D4',
  person: '#34A87E',
  place: '#D4965A',
  event: '#C45A5A',
  tool: '#8B5AD4',
  organization: '#5A8BD4',
  default: '#888880',
}

interface GraphNode { id: string; slug: string; title: string; type: string; summary: string; connections: number; x?: number; y?: number }
interface GraphLink { source: string; target: string }
interface SelectedNode { slug: string; title: string; type: string; summary?: string }

export default function GraphPage() {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] })
  const [selected, setSelected] = useState<SelectedNode | null>(null)
  const [loading, setLoading] = useState(true)
  const fgRef = useRef<unknown>(null)

  useEffect(() => {
    fetch('/api/graph').then(r => r.json()).then(data => {
      setGraphData(data)
      setLoading(false)
    })
  }, [])

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelected({ slug: node.slug, title: node.title, type: node.type, summary: node.summary })
  }, [])

  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D) => {
    const color = TYPE_COLORS[node.type] || TYPE_COLORS.default
    const size = 4 + (node.connections || 1) * 1.2

    ctx.beginPath()
    ctx.arc(node.x as number, node.y as number, size, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()

    ctx.font = `${Math.max(8, size * 0.9)}px sans-serif`
    ctx.fillStyle = 'rgba(222,219,200,0.7)'
    ctx.textAlign = 'center'
    ctx.fillText(node.title?.slice(0, 20), node.x as number, (node.y as number) + size + 9)
  }, [])

  return (
    <div className="bg-black h-screen overflow-hidden relative">

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <p className="text-[11px] tracking-widest uppercase animate-pulse" style={{ color: 'rgba(222,219,200,0.3)' }}>
            Building graph...
          </p>
        </div>
      )}

      {/* Graph */}
      {!loading && (
        <ForceGraph2D
          ref={fgRef as any}
          graphData={graphData}
          backgroundColor="#000000"
          nodeCanvasObject={paintNode as (node: unknown, ctx: CanvasRenderingContext2D) => void}
          nodeCanvasObjectMode={() => 'replace'}
          linkColor={() => 'rgba(222,219,200,0.06)'}
          linkWidth={1}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleColor={() => 'rgba(222,219,200,0.4)'}
          onNodeClick={handleNodeClick as (node: unknown) => void}
          cooldownTicks={100}
        />
      )}

      {/* Top left overlay */}
      <div className="absolute top-20 left-7 z-10 pointer-events-none">
        <p className="text-sm font-semibold" style={{ color: 'rgba(222,219,200,0.8)' }}>NeuroWiki Graph</p>
        <p className="text-xs font-medium mt-0.5" style={{ color: 'rgba(222,219,200,0.5)' }}>
          {graphData?.nodes?.length ?? 0} pages · {graphData?.links?.length ?? 0} connections
        </p>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur rounded-xl p-3">
        {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
          <div key={type} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[10px] capitalize" style={{ color: 'rgba(222,219,200,0.5)' }}>{type}</span>
          </div>
        ))}
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <p className="text-[9px] tracking-wider" style={{ color: 'rgba(222,219,200,0.2)' }}>
          Scroll to zoom · Drag to explore · Click to open
        </p>
      </div>

      {/* Selected node popup */}
      {selected && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 w-72 bg-[#101010] border border-white/10 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <span className={`text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full ${
              selected.type === 'person' ? 'bg-emerald-950 text-emerald-300' :
              selected.type === 'concept' ? 'bg-indigo-950 text-indigo-300' :
              'bg-zinc-900 text-zinc-400'
            }`}>{selected.type}</span>
            <button onClick={() => setSelected(null)}>
              <X size={14} style={{ color: 'rgba(222,219,200,0.4)' }} />
            </button>
          </div>
          <h3 className="text-base font-medium mb-2" style={{ color: '#E1E0CC' }}>{selected.title}</h3>
          {selected.summary && (
            <p className="text-[11px] mb-3 leading-relaxed" style={{ color: 'rgba(222,219,200,0.5)' }}>{selected.summary}</p>
          )}
          <Link
            href={`/wiki/${selected.slug}`}
            className="text-[11px] tracking-wider uppercase transition-opacity hover:opacity-100"
            style={{ color: 'rgba(222,219,200,0.5)' }}
          >
            Open page →
          </Link>
        </div>
      )}
    </div>
  )
}
