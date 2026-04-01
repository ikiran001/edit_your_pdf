import { useCallback, useState } from 'react'
import LandingPage from '../../components/LandingPage.jsx'
import PdfEditor from '../../components/PdfEditor.jsx'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import { pageView } from '../../lib/analytics.js'
import { useEffect } from 'react'
import { usePdfSessionUpload } from './usePdfSessionUpload.js'

export default function EditPdfPage() {
  const [sessionId, setSessionId] = useState(null)
  const { upload, uploading, uploadProgress } = usePdfSessionUpload()

  useEffect(() => {
    pageView(sessionId ? '/tools/edit-pdf/editor' : '/tools/edit-pdf', sessionId ? 'Edit PDF' : 'Edit PDF upload')
  }, [sessionId])

  const onFileSelected = useCallback(
    async (file) => {
      try {
        const sid = await upload(file)
        setSessionId(sid)
      } catch {
        /* alert in hook */
      }
    },
    [upload]
  )

  if (!sessionId) {
    return (
      <ToolPageShell title="Edit PDF" subtitle="Upload, then annotate and edit text in the browser.">
        <LandingPage
          embeddedInToolShell
          onFileSelected={onFileSelected}
          loading={uploading}
          uploadProgress={uploadProgress}
        />
      </ToolPageShell>
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
