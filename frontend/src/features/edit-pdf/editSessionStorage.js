const KEY = 'eyp_edit_session_v1'

/**
 * @returns {{ sessionId: string, downloadToken: string | null, fileName?: string | null } | null}
 */
export function readPersistedEditSession() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    if (!j || typeof j.sessionId !== 'string' || !j.sessionId) return null
    return {
      sessionId: j.sessionId,
      downloadToken: typeof j.downloadToken === 'string' ? j.downloadToken : null,
      fileName: typeof j.fileName === 'string' && j.fileName.trim() ? j.fileName.trim() : null,
    }
  } catch {
    return null
  }
}

/** @param {{ sessionId: string, downloadToken?: string | null, fileName?: string | null } | null} s */
export function persistEditSession(s) {
  try {
    if (!s?.sessionId) {
      sessionStorage.removeItem(KEY)
      return
    }
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        sessionId: s.sessionId,
        downloadToken: s.downloadToken || null,
        fileName: typeof s.fileName === 'string' && s.fileName.trim() ? s.fileName.trim() : null,
      })
    )
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPersistedEditSession() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
