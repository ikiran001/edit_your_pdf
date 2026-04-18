import { apiUrl } from '../../lib/apiBase.js'

/**
 * @param {{ sessionId: string, downloadToken?: string | null, idToken?: string | null }} p
 * @returns {Promise<{ ok: true, blob: Blob } | { ok: false, status: number, errPayload: object | null }>}
 */
export async function fetchEditPdfDownload({ sessionId, downloadToken, idToken }) {
  const q = new URLSearchParams({ sessionId })
  if (downloadToken) q.set('downloadToken', downloadToken)
  const headers = {}
  if (idToken) headers.Authorization = `Bearer ${idToken}`
  const res = await fetch(apiUrl(`/download?${q}`), { headers })
  if (!res.ok) {
    let errPayload = null
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      try {
        errPayload = await res.json()
      } catch {
        errPayload = null
      }
    } else {
      try {
        await res.text()
      } catch {
        /* ignore */
      }
    }
    return { ok: false, status: res.status, errPayload }
  }
  const blob = await res.blob()
  return { ok: true, blob }
}
