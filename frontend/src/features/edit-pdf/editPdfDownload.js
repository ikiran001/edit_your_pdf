import { apiUrl } from '../../lib/apiBase.js'

/**
 * When true (Vite env at build time), Edit PDF skips anonymous download attempts and opens the
 * sign-in modal for signed-out users. Pair with Render env `DOWNLOAD_AUTH_ENABLED=true` and
 * `DOWNLOAD_FIRST_ANONYMOUS=false` so the API does not accept unauthenticated downloads.
 */
export function isRequireSignInForEditPdfDownload() {
  const v = String(import.meta.env.VITE_REQUIRE_SIGN_IN_FOR_EDIT_PDF_DOWNLOAD ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

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
