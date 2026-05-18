import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id, 10)
    db.prepare('DELETE FROM sources WHERE id = ?').run(id)
    return NextResponse.json({ deleted: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
