const KEY = 'eyp_pending_download_v1'

/**
 * @param {{ kind: 'edit', sessionId: string } | null} data
 */
export function writePendingDownload(data) {
  try {
    if (!data?.sessionId) {
      sessionStorage.removeItem(KEY)
      return
    }
    sessionStorage.setItem(KEY, JSON.stringify({ ...data, t: Date.now() }))
  } catch {
    /* ignore */
  }
}

/** @returns {{ kind: string, sessionId: string, t?: number } | null} */
export function readPendingDownload() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    if (!j || typeof j.sessionId !== 'string') return null
    return j
  } catch {
    return null
  }
}

export function clearPendingDownload() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
