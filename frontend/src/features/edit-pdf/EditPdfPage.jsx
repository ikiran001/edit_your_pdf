import { useEffect, useState } from 'react'
import EditPdfSessionFlow from './EditPdfSessionFlow.jsx'
import { pageView } from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import { usePdfSessionUpload } from './usePdfSessionUpload.js'
import { docTitleForPath } from '../../shared/constants/branding.js'

const EDIT_TOOL = ANALYTICS_TOOL.edit_pdf
const EDIT_DOC_TITLE = docTitleForPath('/tools/edit-pdf')

export default function EditPdfPage() {
  const [sessionId, setSessionId] = useState(null)
  const { upload, uploading, uploadProgress } = usePdfSessionUpload()

  useToolEngagement(EDIT_TOOL, Boolean(sessionId))

  useEffect(() => {
    document.title = EDIT_DOC_TITLE
    const path = sessionId ? '/tools/edit-pdf/editor' : '/tools/edit-pdf'
    pageView(path, EDIT_DOC_TITLE)
  }, [sessionId])

  return (
    <EditPdfSessionFlow
      sessionId={sessionId}
      setSessionId={setSessionId}
      upload={upload}
      uploading={uploading}
      uploadProgress={uploadProgress}
    />
  )
}
