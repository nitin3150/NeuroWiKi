'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { X, Loader2, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-black">
      <Loader2 className="animate-spin" size={20}
        style={{ color: 'rgba(222,219,200,0.4)' }} />
    </div>
  ),
})

const TYPE_COLORS: Record<string, string> = {
  concept: '#7C65D4',
  person: '#34A87E',
  place: '#D4965A',
  event: '#C45A5A',
  tool: '#8B5AD4',
  organization: '#5A8BD4',
}
const DEFAULT_COLOR = '#555550'

// Module-level stable callbacks (avoid inline arrows that re-init ForceGraph2D internals)
const CANVAS_MODE_REPLACE = () => 'replace' as const
const LINK_COLOR = () => 'rgba(222,219,200,0.3)'
const PARTICLE_COLOR = () => 'rgba(222,219,200,0.7)'

interface GraphNode {
  id: string; slug: string; title: string
  type: string; connections: number; x?: number; y?: number
}
interface GraphLink { source: string; target: string; label?: string }

export default function GraphPage() {
  const [rawData, setRawData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({
    nodes: [], links: []
  })
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(Object.keys(TYPE_COLORS)))
  const [nodeSearch, setNodeSearch] = useState('')
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [hoveredLink, setHoveredLink] = useState<GraphLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const containerRef = useRef<HTMLDivElement>(null)
  // Refs mirror state so paintNode reads latest values without changing identity
  const searchRef = useRef('')
  const selectedRef = useRef<GraphNode | null>(null)
  useEffect(() => { searchRef.current = nodeSearch.toLowerCase() }, [nodeSearch])
  useEffect(() => { selectedRef.current = selected }, [selected])

  useEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }
    updateDims()
    window.addEventListener('resize', updateDims)
    return () => window.removeEventListener('resize', updateDims)
  }, [])

  useEffect(() => {
    fetch('/api/graph')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => {
        const nodes = (data.nodes || []).filter((n: GraphNode) => n.id && n.title)
        const nodeIds = new Set(nodes.map((n: GraphNode) => n.id))
        const links = (data.links || []).filter((l: GraphLink) =>
          l.source && l.target &&
          nodeIds.has(String(l.source)) &&
          nodeIds.has(String(l.target))
        )
        setRawData({ nodes, links })
        // Initialize all types as active
        const types = new Set(nodes.map((n: GraphNode) => n.type).filter(Boolean))
        setActiveTypes(types as Set<string>)
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  // Filtered graph data — depends ONLY on rawData + activeTypes.
  // Search must NOT alter graphData (would tear apart D3 simulation each keystroke);
  // search is a paint-time concern handled in paintNode via dimming.
  const graphData = useMemo(() => {
    const visibleNodes = rawData.nodes.filter(n => activeTypes.has(n.type || 'concept'))
    const visibleIds = new Set(visibleNodes.map(n => n.id))
    const links = rawData.links.filter(l => {
      const sId = String(typeof l.source === 'object' ? (l.source as GraphNode).id : l.source)
      const tId = String(typeof l.target === 'object' ? (l.target as GraphNode).id : l.target)
      return visibleIds.has(sId) && visibleIds.has(tId)
    })
    return { nodes: visibleNodes, links }
  }, [rawData, activeTypes])

  // Single source of truth for node radius — paint AND hit area use this
  const nodeRadius = useCallback((node: GraphNode): number => {
    return Math.max(4, Math.min(4 + (node.connections || 1) * 1.8, 18))
  }, [])

  // Stable identity — reads search/selected from refs so prop never changes.
  const paintNode = useCallback((
    node: GraphNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number
  ) => {
    const color = TYPE_COLORS[node.type] || DEFAULT_COLOR
    const size = nodeRadius(node)
    const x = node.x ?? 0
    const y = node.y ?? 0
    const q = searchRef.current
    const searching = q.length > 0
    const isMatch = searching && node.title.toLowerCase().includes(q)
    const isDimmed = searching && !isMatch

    if (isMatch) {
      ctx.beginPath()
      ctx.arc(x, y, size + 6, 0, 2 * Math.PI)
      const gradient = ctx.createRadialGradient(x, y, size, x, y, size + 6)
      gradient.addColorStop(0, color + '90')
      gradient.addColorStop(1, color + '00')
      ctx.fillStyle = gradient
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(x, y, size, 0, 2 * Math.PI)
    ctx.fillStyle = isMatch ? color : isDimmed ? color + '20' : color + 'CC'
    ctx.fill()

    if (selectedRef.current?.id === node.id) {
      ctx.beginPath()
      ctx.arc(x, y, size + 3, 0, 2 * Math.PI)
      ctx.strokeStyle = '#DEDBC8'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    if (!isDimmed && (globalScale > 0.5 || (node.connections || 1) > 2 || isMatch)) {
      const fontSize = Math.max(9, 11 / globalScale)
      ctx.font = `${fontSize}px Almarai, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = isMatch ? 'rgba(222,219,200,0.95)' : 'rgba(222,219,200,0.65)'
      ctx.fillText(
        (node.title || '').slice(0, 18),
        x,
        y + size + 3
      )
    }
  }, [nodeRadius])

  // Hit area — uses the same radius as visual to keep clicks aligned
  const paintNodePointerArea = useCallback((
    node: GraphNode,
    color: string,
    ctx: CanvasRenderingContext2D
  ) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, nodeRadius(node), 0, 2 * Math.PI)
    ctx.fill()
  }, [nodeRadius])

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelected(node)
  }, [])

  const handleLinkHover = useCallback((link: GraphLink | null) => {
    setHoveredLink(link)
  }, [])

  const handleBackgroundClick = useCallback(() => {
    setSelected(null)
  }, [])

  const toggleType = (type: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) { next.delete(type) } else { next.add(type) }
      return next
    })
  }

  if (error) return (
    <div className="flex flex-col items-center justify-center h-screen bg-black gap-4">
      <p className="text-sm" style={{ color: 'rgba(222,219,200,0.4)' }}>Graph error: {error}</p>
      <button onClick={() => window.location.reload()}
        className="text-[11px] px-4 py-2 rounded-full border border-white/10 hover:border-white/30 transition"
        style={{ color: 'rgba(222,219,200,0.5)' }}>
        Retry
      </button>
    </div>
  )

  return (
    <div ref={containerRef} className="bg-black w-full h-screen overflow-hidden relative">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="animate-spin mx-auto mb-3" size={22}
              style={{ color: 'rgba(222,219,200,0.4)' }} />
            <p className="text-[10px] tracking-widest uppercase"
              style={{ color: 'rgba(222,219,200,0.3)' }}>Building graph...</p>
          </div>
        </div>
      ) : rawData.nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-sm" style={{ color: 'rgba(222,219,200,0.35)' }}>
            No pages yet. Add sources first.
          </p>
          <Link href="/ingest"
            className="bg-[#DEDBC8] text-black text-sm font-medium px-5 py-2.5 rounded-full hover:opacity-90 transition">
            Add Source →
          </Link>
        </div>
      ) : (
        <ForceGraph2D
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#000000"
          nodeCanvasObject={paintNode as unknown as (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => void}
          nodeCanvasObjectMode={CANVAS_MODE_REPLACE}
          nodePointerAreaPaint={paintNodePointerArea as unknown as (node: object, color: string, ctx: CanvasRenderingContext2D) => void}
          linkColor={LINK_COLOR}
          linkWidth={1.5}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleSpeed={0.004}
          linkDirectionalParticleColor={PARTICLE_COLOR}
          onNodeClick={handleNodeClick as unknown as (node: object) => void}
          onBackgroundClick={handleBackgroundClick}
          onLinkHover={handleLinkHover as unknown as (link: object | null) => void}
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      )}

      {/* TOP: Node search */}
      {!loading && rawData.nodes.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Search size={12} style={{ color: 'rgba(222,219,200,0.4)' }} />
            <input
              value={nodeSearch}
              onChange={e => setNodeSearch(e.target.value)}
              placeholder="Find a node..."
              className="bg-transparent outline-none text-[11px] w-36"
              style={{ color: '#DEDBC8' }}
            />
            {nodeSearch && (
              <button onClick={() => setNodeSearch('')}>
                <X size={11} style={{ color: 'rgba(222,219,200,0.4)' }} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      {!loading && (
        <div className="absolute top-4 left-4 pointer-events-none">
          <p className="text-xs font-medium" style={{ color: 'rgba(222,219,200,0.45)' }}>
            NeuroWiki Graph
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(222,219,200,0.2)' }}>
            {graphData.nodes.length} pages · {graphData.links.length} connections
          </p>
        </div>
      )}

      {/* Legend + Type filters */}
      {!loading && rawData.nodes.length > 0 && (
        <div
          className="absolute top-4 right-4 rounded-xl p-3"
          style={{
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p className="text-[8px] tracking-[0.3em] uppercase mb-2"
            style={{ color: 'rgba(222,219,200,0.25)' }}>Filter</p>
          {Object.entries(TYPE_COLORS).map(([type, color]) => {
            const count = rawData.nodes.filter(n => n.type === type).length
            if (count === 0) return null
            const active = activeTypes.has(type)
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className="flex items-center gap-2 py-0.5 w-full group transition-opacity"
                style={{ opacity: active ? 1 : 0.3 }}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: color }} />
                <span className="text-[10px] capitalize flex-1 text-left"
                  style={{ color: 'rgba(222,219,200,0.6)' }}>
                  {type}
                </span>
                <span className="text-[9px]"
                  style={{ color: 'rgba(222,219,200,0.25)' }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Edge label on link hover */}
      <AnimatePresence>
        {hoveredLink && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full pointer-events-none"
            style={{
              background: 'rgba(0,0,0,0.85)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <p className="text-[11px]" style={{ color: 'rgba(222,219,200,0.7)' }}>
              {(() => {
                const s = typeof hoveredLink.source === 'object'
                  ? (hoveredLink.source as GraphNode).title
                  : rawData.nodes.find(n => n.id === String(hoveredLink.source))?.title || String(hoveredLink.source)
                const t = typeof hoveredLink.target === 'object'
                  ? (hoveredLink.target as GraphNode).title
                  : rawData.nodes.find(n => n.id === String(hoveredLink.target))?.title || String(hoveredLink.target)
                return `${s} → ${t}`
              })()}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint */}
      {!loading && rawData.nodes.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <p className="text-[9px] tracking-wider" style={{ color: 'rgba(222,219,200,0.15)' }}>
            Scroll to zoom · Drag to explore · Click to open
          </p>
        </div>
      )}

      {/* Selected node popup */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-6 right-6 w-72 rounded-2xl p-5 z-20"
            style={{
              background: 'rgba(14,14,14,0.97)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <span
                className="text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full"
                style={{ background: '#1a1a1a', color: 'rgba(222,219,200,0.55)' }}
              >
                {selected.type}
              </span>
              <button onClick={() => setSelected(null)} className="opacity-40 hover:opacity-100 transition">
                <X size={13} color="#DEDBC8" />
              </button>
            </div>
            <h3 className="text-base font-medium mb-1" style={{ color: '#E1E0CC' }}>
              {selected.title}
            </h3>
            <p className="text-[10px] mb-3" style={{ color: 'rgba(222,219,200,0.3)' }}>
              {selected.connections || 0} connections
            </p>
            <Link
              href={`/wiki/${selected.slug}`}
              className="text-[11px] tracking-wider uppercase hover:opacity-100 transition-opacity"
              style={{ color: 'rgba(222,219,200,0.5)' }}
            >
              Open page →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
