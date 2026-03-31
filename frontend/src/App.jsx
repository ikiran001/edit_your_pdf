import { useCallback, useEffect, useState } from 'react'
import LandingPage from './components/LandingPage'
import PdfEditor from './components/PdfEditor'
import { pageView } from './lib/analytics.js'
import { apiUrl, isApiBaseConfigured } from './lib/apiBase'

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    pageView(sessionId ? '/edit' : '/', sessionId ? 'Edit PDF' : 'Edit Your PDF')
  }, [sessionId])

  const onFileSelected = useCallback(async (file) => {
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
        /* non-JSON e.g. HTML error page */
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
      setSessionId(data.sessionId)
    } catch (e) {
      console.error(e)
      if (e.message === 'NO_API_BASE' || (import.meta.env.PROD && !isApiBaseConfigured())) {
        alert(
          'Upload blocked: no backend URL in this build.\n\n' +
            'GitHub → Settings → Secrets → Actions → add VITE_API_BASE_URL = https://your-api.onrender.com\n' +
            'Then re-run workflow "Deploy frontend to GitHub Pages".'
        )
      } else if (e.name === 'TypeError' && String(e.message).toLowerCase().includes('fetch')) {
        alert(
          `Cannot reach the API:\n${uploadUrl}\n\n` +
            '• Open that URL in a browser — you should not get a blank error.\n' +
            '• API must use HTTPS.\n' +
            '• On Render free tier, first request after sleep can take ~1 min.\n' +
            '• Check CORS on the server (this app uses your API URL from VITE_API_BASE_URL).'
        )
      } else {
        alert(e.message || 'Upload failed')
      }
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [])

  if (!sessionId) {
    return (
      <LandingPage
        onFileSelected={onFileSelected}
        loading={uploading}
        uploadProgress={uploadProgress}
      />
    )
  }

  return (
    <PdfEditor
      key={sessionId}
      sessionId={sessionId}
      onBack={() => setSessionId(null)}
    />
  )
}
