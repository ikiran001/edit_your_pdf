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
    try {
      if (import.meta.env.PROD && !isApiBaseConfigured()) {
        throw new Error('NO_API_BASE')
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
        throw new Error(
          data.error ||
            `HTTP ${status} ${statusText}\nURL: ${uploadUrl}${hint ? `\n${hint}` : ''}`
        )
      }
      if (!data.sessionId) {
        throw new Error(`No sessionId from API.\nURL: ${uploadUrl}\nResponse: ${text.slice(0, 200)}`)
      }
      setUploadProgress(100)
      return data.sessionId
    } catch (e) {
      if (e.message === 'NO_API_BASE' || (import.meta.env.PROD && !isApiBaseConfigured())) {
        alert(
          'Upload blocked: no backend URL in this build.\n\n' +
            'GitHub: Settings - Secrets - Actions - VITE_API_BASE_URL = https://your-api.onrender.com\n' +
            'Then re-run Deploy frontend to GitHub Pages.'
        )
      } else if (e.name === 'TypeError' && String(e.message).toLowerCase().includes('fetch')) {
        alert(
          `Cannot reach the API:\n${uploadUrl}\n\nCheck HTTPS, CORS, and that the API is awake.`
        )
      } else {
        alert(e.message || 'Upload failed')
      }
      throw e
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [])

  return { upload, uploading, uploadProgress }
}
