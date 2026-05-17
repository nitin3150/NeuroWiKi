import { NextResponse } from 'next/server'
import { hydra } from '@/lib/hydra'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    let listResponse: any = {}
    try {
      listResponse = (await hydra.fetch.listData({
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

    const items: any[] = listResponse?.sources ?? []

    const nodes = items.map((item: any) => ({
      id: (item.document_metadata?.slug as string) || (item.id as string),
      slug: (item.document_metadata?.slug as string) || (item.id as string),
      title: (item.title as string) ?? '',
      type: (item.document_metadata?.category as string) || 'concept',
    }))

    // 2. Build edges from the context graph
    const links: Array<{ source: string; target: string; label?: string }> = []

    await Promise.all(
      nodes.map(async (node) => {
        try {
          const relationData = await hydra.fetch.graphRelationsBySourceId({
            tenant_id: 'default',
            source_id: node.id,
          })

          for (const triplet of relationData.relations) {
            if (!triplet) continue
            const t = triplet as any
            // Use the entity names as IDs since they correspond to source titles
            const targetId = t.target.entity_id || t.target.name
            if (targetId) {
              const label = t.relations[0]?.relation_type ?? ''
              links.push({ source: node.id, target: targetId, label })
            }
          }
        } catch (e) {
          // Non-fatal: some nodes may have no relations yet
          console.warn(`No graph relations for ${node.id}`)
        }
      })
    )

    return NextResponse.json({ nodes, links })
  } catch (error: any) {
    console.error('Error generating graph:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

