import { NextResponse } from 'next/server'
import { hydra } from '@/lib/hydra'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    let response: any = {}
    try {
      response = (await hydra.fetch.listData({
        tenant_id: 'default',
        kind: 'knowledge',
        page: 1,
        page_size: 100,
      })) as any
    } catch (e: any) {
      if (e.message?.includes('Tenant default does not exist') || e.status === 404) {
        console.warn('Tenant default does not exist yet.')
      } else {
        throw e
      }
    }

    const items: any[] = response?.sources ?? []

    const pages = items.map((item: any) => ({
      slug: (item.document_metadata?.slug as string) || item.id,
      title: (item.title as string) || '',
      type: (item.document_metadata?.category as string) || 'concept',
      summary: (item.document_metadata?.summary as string) || '',
      created_at: (item.timestamp as string) || '',
    }))

    return NextResponse.json({ pages })
  } catch (error: any) {
    console.error('Error fetching wiki pages:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
