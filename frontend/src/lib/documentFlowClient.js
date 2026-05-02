import { apiUrl } from './apiBase.js'

/**
 * POST multipart form (single file) to a document-flow endpoint; returns Blob on success.
 * @param {string} endpoint — e.g. `/document-flow/convert-pdf-to-xlsx`
 * @param {File} file
 * @param {string} [fieldName]
 */
export async function postDocumentFlowFile(endpoint, file, fieldName = 'file') {
  const fd = new FormData()
  fd.append(fieldName, file)
  const r = await fetch(apiUrl(endpoint), {
    method: 'POST',
    body: fd,
    credentials: 'include',
  })
  const ct = r.headers.get('content-type') || ''
  if (!r.ok) {
    if (ct.includes('application/json')) {
      const j = await r.json().catch(() => ({}))
      const msg = j.message || j.error || r.statusText
      const err = new Error(typeof msg === 'string' ? msg : 'Request failed')
      err.code = j.error
      throw err
    }
    const t = await r.text().catch(() => '')
    throw new Error(t || r.statusText || 'Request failed')
  }
  if (ct.includes('application/json')) {
    return r.json()
  }
  return r.blob()
}

/**
 * POST JSON to document-flow translate endpoint.
 * @param {{ q: string, source?: string, target?: string }} body
 * @returns {Promise<{ translatedText: string }>}
 */
export async function postDocumentFlowTranslate(body) {
  const r = await fetch(apiUrl('/document-flow/translate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    const err = new Error(j.message || j.error || r.statusText)
    err.code = j.error
    throw err
  }
  return j
}
