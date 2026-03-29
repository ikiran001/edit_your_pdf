import { useCallback, useState } from 'react'
import LandingPage from './components/LandingPage'
import PdfEditor from './components/PdfEditor'
import { apiUrl } from './lib/apiBase'

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
      alert(e.message || 'Upload failed. Is the API running on port 3001?')
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
