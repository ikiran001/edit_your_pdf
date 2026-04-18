import { apiUrl } from '../../lib/apiBase.js'

const EDIT_TOOL_KEY = 'edit_pdf'

/** @param {string} tool */
export function libraryToolLabel(tool) {
  const t = String(tool || EDIT_TOOL_KEY)
  if (t === 'edit_pdf') return 'Edit PDF'
  if (t === 'scan_to_pdf') return 'Scan to PDF'
  if (t === 'word_to_pdf') return 'Word to PDF'
  return t.replace(/_/g, ' ')
}

/**
 * @param {{ getFreshIdToken: () => Promise<string|null>, sessionId: string, fileName?: string, tool?: string }} p
 */
export async function registerUserSessionOnServer({ getFreshIdToken, sessionId, fileName, tool }) {
  const token = await getFreshIdToken()
  if (!token) return { ok: false, status: 0, error: 'no_token' }
  try {
    const res = await fetch(apiUrl('/user-sessions/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionId,
        fileName: fileName || 'document.pdf',
        tool: tool || EDIT_TOOL_KEY,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = data?.message || data?.error || `HTTP ${res.status}`
      return { ok: false, status: res.status, error: err, libraryIndexed: false }
    }
    return { ok: true, status: res.status, libraryIndexed: Boolean(data.libraryIndexed) }
  } catch (e) {
    return { ok: false, status: 0, error: e?.message || 'network_error', libraryIndexed: false }
  }
}

/**
 * @param {{ getFreshIdToken: () => Promise<string|null> }} p
 * @returns {Promise<{ ok: true, documents: Array<{ id: string, sessionId: string, fileName: string, tool: string, updatedAt: Date | null, createdAt: Date | null }> } | { ok: false, status: number, error: string }>}
 */
export async function fetchUserLibraryFromServer({ getFreshIdToken }) {
  const token = await getFreshIdToken()
  if (!token) return { ok: false, status: 0, error: 'no_token' }
  try {
    const res = await fetch(apiUrl('/user-sessions/library'), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      return {
        ok: false,
        status: res.status,
        error:
          'The library URL did not return JSON (often the browser is calling the static site, not your Render API). Set GitHub secret VITE_API_BASE_URL to your API origin and redeploy, or ensure pdfpilot-api-config.js is deployed.',
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data?.message || data?.error || `HTTP ${res.status}`,
      }
    }
    if (!Array.isArray(data.documents)) {
      return {
        ok: false,
        status: res.status,
        error:
          'Unexpected API response (no documents array). Point VITE_API_BASE_URL / pdfpilot-api-config.js at your Node API on Render, not pdfpilot.pro.',
      }
    }
    const raw = data.documents
    const documents = raw.map((row, i) => ({
      id: row.sessionId || String(i),
      sessionId: String(row.sessionId || ''),
      fileName: typeof row.fileName === 'string' ? row.fileName : 'document.pdf',
      tool: typeof row.tool === 'string' ? row.tool : EDIT_TOOL_KEY,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
      createdAt: row.createdAt ? new Date(row.createdAt) : null,
    }))
    const adminConfigured = data.adminConfigured !== false
    return {
      ok: true,
      documents,
      adminConfigured,
      serverMessage: typeof data.message === 'string' ? data.message : '',
    }
  } catch (e) {
    return { ok: false, status: 0, error: e?.message || 'network_error' }
  }
}

/**
 * @param {{ getFreshIdToken: () => Promise<string|null>, sessionId: string }} p
 */
export async function deleteUserSessionOnServer({ getFreshIdToken, sessionId }) {
  const token = await getFreshIdToken()
  if (!token) return { ok: false, status: 0, error: 'no_token' }
  try {
    const res = await fetch(apiUrl(`/user-sessions/${encodeURIComponent(sessionId)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok && res.status !== 404) {
      const data = await res.json().catch(() => ({}))
      return {
        ok: false,
        status: res.status,
        error: data?.message || data?.error || `HTTP ${res.status}`,
      }
    }
    return { ok: true, status: res.status }
  } catch (e) {
    return { ok: false, status: 0, error: e?.message || 'network_error' }
  }
}

/**
 * Registers session ownership on disk and library row in Firestore (server-side Admin).
 *
 * @param {{
 *   getFreshIdToken: () => Promise<string|null>
 *   user: { uid: string }
 *   sessionId: string
 *   fileName?: string
 *   tool?: string
 * }} p
 */
export async function syncUserLibraryEntry(p) {
  const { getFreshIdToken, user, sessionId, fileName, tool } = p
  if (!user?.uid || !sessionId) return
  const server = await registerUserSessionOnServer({
    getFreshIdToken,
    sessionId,
    fileName,
    tool,
  })
  if (!server.ok) {
    console.warn('[userLibrary] register failed:', server.error)
  } else if (server.libraryIndexed === false) {
    console.warn(
      '[userLibrary] Session saved on server but library index skipped — enable Firestore on the Firebase project and ensure the Admin service account can write to Firestore.'
    )
  }
}
