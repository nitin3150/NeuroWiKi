import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50)

  const rows = db.prepare(`
    SELECT l.id, l.pages_created, l.pages_updated, l.message, l.created_at,
           s.title as source_title, s.url as source_url
    FROM logs l
    LEFT JOIN sources s ON s.id = l.source_id
    ORDER BY l.created_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: number
    pages_created: number
    pages_updated: number
    message: string | null
    created_at: string
    source_title: string | null
    source_url: string | null
  }>

  return Response.json({ logs: rows })
}
