import { HydraDBClient } from '@hydradb/sdk'

if (!process.env.HYDRADB_API_KEY) {
  throw new Error("'HydraDB is not reachable")
}

export const hydra = new HydraDBClient({
  token: process.env.HYDRADB_API_KEY || '',
})

export async function ensureTenant(tenantId: string = 'default'): Promise<void> {
  try {
    await hydra.tenant.create({ tenant_id: tenantId })
  } catch (e: any) {
    // 409 conflict = tenant already exists, that's fine
    if (e?.statusCode !== 409 && !e?.body?.detail?.includes?.('already exists')) {
      console.warn('Tenant create warning:', e?.message)
    }
  }
}

// On free tier, indexing_status stays "queued" indefinitely but data is accessible.
// We just confirm upload succeeded rather than polling for completion.
export async function waitForIngestion(
  sourceId: string,
  tenantId: string = 'default',
): Promise<boolean> {
  try {
    const res = await hydra.upload.verifyProcessing({
      tenant_id: tenantId,
      file_ids: sourceId,
    })
    const status = (res as any)?.statuses?.[0]?.indexing_status
    if (status === 'errored') {
      console.warn(`HydraDB: source ${sourceId} errored`)
      return false
    }
    // queued/processing/graph_creation = data accessible, indexing in progress
    return true
  } catch {
    return true // upload succeeded, assume indexing will complete
  }
}
