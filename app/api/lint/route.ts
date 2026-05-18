import { NextRequest, NextResponse } from 'next/server'
import { runLintSweep } from '@/lib/agents/lint-agent'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const report = await runLintSweep()
    return NextResponse.json(report)
  } catch (error: any) {
    console.error('[lint] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { slug, action } = await req.json()
    if (!slug || !action) {
      return NextResponse.json({ error: 'slug and action required' }, { status: 400 })
    }

    if (action === 'mark_stale') {
      const { markPageStale } = await import('@/lib/db-helpers')
      markPageStale(slug, 'Manually flagged via lint sweep')
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
