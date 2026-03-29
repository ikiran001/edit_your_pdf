import { useCallback, useEffect, useState } from 'react'
import LandingPage from './components/LandingPage'
import PdfEditor from './components/PdfEditor'
import { pageView } from './lib/analytics.js'
import { apiUrl, isApiBaseConfigured } from './lib/apiBase'

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    pageView(sessionId ? '/edit' : '/', sessionId ? 'Edit PDF' : 'Edit Your PDF')
  }, [sessionId])

  const onFileSelected = useCallback(async (file) => {
    setUploading(true)
    const uploadUrl = apiUrl('/upload')
    try {
      if (import.meta.env.PROD && !isApiBaseConfigured()) {
        throw new Error('NO_API_BASE')
      }
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(uploadUrl, { method: 'POST', body: fd })
      const text = await res.text()
      let data = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        /* non-JSON e.g. HTML error page */
      }
      if (!res.ok) {
        const hint = text && !data.error ? text.replace(/<[^>]+>/g, ' ').slice(0, 280).trim() : ''
        throw new Error(
          data.error ||
            `HTTP ${res.status} ${res.statusText}\nURL: ${uploadUrl}${hint ? `\n${hint}` : ''}`
        )
      }
      if (!data.sessionId) {
        throw new Error(`No sessionId from API.\nURL: ${uploadUrl}\nResponse: ${text.slice(0, 200)}`)
      }
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
    }
  }, [])

  if (!sessionId) {
    return <LandingPage onFileSelected={onFileSelected} loading={uploading} />
  }

  return (
    <PdfEditor
      key={sessionId}
      sessionId={sessionId}
      onBack={() => setSessionId(null)}
    />
  )
}
