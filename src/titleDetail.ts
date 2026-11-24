// TODO: Validate
import { storeBackend } from "./storeBackend"
import type { StoreMetadata } from "./storeStock"
import type { StoreTitleDetail } from "./storeTypes"

type PendingDetail = {
  resolve: (detail: StoreTitleDetail) => void
  reject: (error: unknown) => void
}

const pending = new Map<string, PendingDetail[]>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

// TODO: Validate
/**
 * Download the details for a batch of titles and resolve each waiting caller,
 * rejecting those whose title is missing or when the call fails.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const requestBatch = async (batch: Map<string, PendingDetail[]>) => {
  try {
    const details = await storeBackend().fetchTitleDetails([...batch.keys()])
    const byId = new Map(details.map((detail) => [detail.id, detail]))
    for (const [titleId, waiting] of batch) {
      const detail = byId.get(titleId)
      for (const { resolve, reject } of waiting) {
        if (detail) {
          resolve(detail)
        } else {
          reject(new Error(`Title ${titleId} was not found`))
        }
      }
    }
  } catch (error) {
    for (const waiting of batch.values()) {
      for (const { reject } of waiting) reject(error)
    }
  }
}

// TODO: Validate
/**
 * Send every pending title detail request in batches of up to 100 titles.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const flush = () => {
  flushTimer = null
  const entries = [...pending.entries()]
  pending.clear()
  for (let start = 0; start < entries.length; start += 100) {
    requestBatch(new Map(entries.slice(start, start + 100)))
  }
}

// TODO: Validate
/**
 * Return the title's detail, queueing the request briefly so requests made
 * together are downloaded in one batch.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const loadTitleDetail = (titleId: string) =>
  new Promise<StoreTitleDetail>((resolve, reject) => {
    pending.set(titleId, [...(pending.get(titleId) ?? []), { resolve, reject }])
    if (flushTimer === null) flushTimer = setTimeout(flush, 20)
  })

// TODO: Validate
/**
 * Return the title's detail with the source or TMDB information, as chosen,
 * merged over it.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const fetchTitleDetail = async (
  titleId: string,
  metadata: StoreMetadata,
) => {
  const detail = await loadTitleDetail(titleId)
  return { ...detail, ...detail[metadata] }
}
