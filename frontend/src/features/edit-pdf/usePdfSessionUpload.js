import { useCallback, useState } from 'react'
import { apiUrl, isApiBaseConfigured } from '../../lib/apiBase'

/**
 * Upload PDF to backend session (Edit PDF tool only). Keeps logic out of routing shell.
 */
export function usePdfSessionUpload() {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const upload = useCallback(async (file) => {
    setUploading(true)
    setUploadProgress(0)
    const uploadUrl = apiUrl('/upload')
    const MAX_UPLOAD_BYTES = 52 * 1024 * 1024
    try {
      if (import.meta.env.PROD && !isApiBaseConfigured()) {
        throw new Error('NO_API_BASE')
      }
      if (file && file.size > MAX_UPLOAD_BYTES) {
        throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 52 MB.`)
      }
      if (file && file.type && file.type !== 'application/pdf') {
        throw new Error('Only PDF files are supported.')
      }
      const fd = new FormData()
      fd.append('file', file)
      const xhr = new XMLHttpRequest()
      const { status, statusText, text } = await new Promise((resolve, reject) => {
        xhr.open('POST', uploadUrl, true)
        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) return
          const pct = Math.min(100, Math.max(0, Math.round((ev.loaded / ev.total) * 100)))
          setUploadProgress(pct)
        }
        xhr.onerror = () => reject(new TypeError('Network request failed'))
        xhr.onload = () =>
          resolve({
            status: xhr.status,
            statusText: xhr.statusText,
            text: xhr.responseText || '',
          })
        xhr.send(fd)
      })
      let data = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        /* ignore */
      }
      if (status < 200 || status >= 300) {
        const hint = text && !data.error ? text.replace(/<[^>]+>/g, ' ').slice(0, 280).trim() : ''
        const proxy502 =
          status === 502 &&
          !isApiBaseConfigured() &&
          (uploadUrl === '/upload' || uploadUrl.startsWith('/'))
            ? '\n\nThe Vite dev server proxies /upload to http://localhost:3001. Start the API in another terminal:\n  cd backend && npm run dev\n\nOr from the repo root: npm run dev'
            : ''
        throw new Error(
          data.error ||
            `HTTP ${status} ${statusText}\nURL: ${uploadUrl}${hint ? `\n${hint}` : ''}${proxy502}`
        )
      }
      if (!data.sessionId) {
        throw new Error(`No sessionId from API.\nURL: ${uploadUrl}\nResponse: ${text.slice(0, 200)}`)
      }
      setUploadProgress(100)
      const filename =
        typeof data.filename === 'string' && data.filename.trim()
          ? data.filename.trim()
          : 'document.pdf'
      return {
        sessionId: data.sessionId,
        downloadToken: typeof data.downloadToken === 'string' ? data.downloadToken : null,
        filename,
      }
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [])

  return { upload, uploading, uploadProgress }
}
