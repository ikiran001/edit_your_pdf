import { useCallback, useState, useEffect } from 'react'
import LandingPage from '../../components/LandingPage.jsx'
import PdfEditor from '../../components/PdfEditor.jsx'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import {
  markFunnelUpload,
  pageView,
  trackErrorOccurred,
  trackFileUploaded,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import { usePdfSessionUpload } from './usePdfSessionUpload.js'

const EDIT_TOOL = ANALYTICS_TOOL.edit_pdf

export default function EditPdfPage() {
  const [sessionId, setSessionId] = useState(null)
  const { upload, uploading, uploadProgress } = usePdfSessionUpload()

  useToolEngagement(EDIT_TOOL, Boolean(sessionId))

  useEffect(() => {
    pageView(sessionId ? '/tools/edit-pdf/editor' : '/tools/edit-pdf', sessionId ? 'Edit PDF' : 'Edit PDF upload')
  }, [sessionId])

  const onFileSelected = useCallback(
    async (file) => {
      try {
        const sid = await upload(file)
        markFunnelUpload(EDIT_TOOL)
        trackFileUploaded({
          file_type: 'pdf',
          file_size: file.size / 1024,
          tool: EDIT_TOOL,
        })
        setSessionId(sid)
      } catch (e) {
        trackErrorOccurred(EDIT_TOOL, e?.message || 'upload_failed')
      }
    },
    [upload]
  )

  if (!sessionId) {
    return (
      <ToolPageShell title="Edit PDF" subtitle="Upload, then annotate and edit text in the browser.">
        <LandingPage
          embeddedInToolShell
          analyticsTool={EDIT_TOOL}
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
