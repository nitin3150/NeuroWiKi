import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const sources = db.prepare('SELECT * FROM sources ORDER BY created_at DESC').all()
    return NextResponse.json(sources)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
