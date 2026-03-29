import { useCallback, useState } from 'react'
import LandingPage from './components/LandingPage'
import PdfEditor from './components/PdfEditor'
import { apiUrl, isApiBaseConfigured } from './lib/apiBase'

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const [uploading, setUploading] = useState(false)

  const onFileSelected = useCallback(async (file) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(apiUrl('/upload'), { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setSessionId(data.sessionId)
    } catch (e) {
      console.error(e)
      if (import.meta.env.PROD && !isApiBaseConfigured()) {
        alert(
          'Upload failed: GitHub Pages only hosts this page — it cannot run the PDF API.\n\n' +
            'Fix:\n' +
            '1) Deploy backend/ on Render, Railway, Fly.io, etc. (HTTPS URL).\n' +
            '2) GitHub repo → Settings → Secrets and variables → Actions → New secret:\n' +
            '   Name: VITE_API_BASE_URL\n' +
            '   Value: https://your-api.example.com  (no trailing slash)\n' +
            '3) Actions → "Deploy frontend to GitHub Pages" → Run workflow again.\n\n' +
            'Locally: run backend on port 3001 and use npm run dev (no secret needed).'
        )
      } else {
        alert(
          e.message ||
            'Upload failed. Is the API running? For github.io, set VITE_API_BASE_URL (see README).'
        )
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
