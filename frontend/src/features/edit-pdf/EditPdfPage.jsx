import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import EditPdfSessionFlow from './EditPdfSessionFlow.jsx'
import { pageView } from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import { usePdfSessionUpload } from './usePdfSessionUpload.js'
import { docTitleForPath } from '../../shared/constants/branding.js'
import {
  clearPersistedEditSession,
  persistEditSession,
  readPersistedEditSession,
} from './editSessionStorage.js'

const EDIT_TOOL = ANALYTICS_TOOL.edit_pdf
const EDIT_DOC_TITLE = docTitleForPath('/tools/edit-pdf')

function isEditPdfEditorPath(pathname) {
  const p = (pathname || '').replace(/\/+$/, '') || '/'
  return p.endsWith('/edit-pdf/editor')
}

export default function EditPdfPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [editSession, setEditSession] = useState(() =>
    isEditPdfEditorPath(location.pathname) ? readPersistedEditSession() : null
  )
  const { upload, uploading, uploadProgress } = usePdfSessionUpload()

  const sessionId = editSession?.sessionId ?? null

  useToolEngagement(EDIT_TOOL, Boolean(sessionId))

  useEffect(() => {
    persistEditSession(editSession)
  }, [editSession])

  useEffect(() => {
    if (!isEditPdfEditorPath(location.pathname)) return
    if (editSession?.sessionId) return
    navigate('/tools/edit-pdf', { replace: true })
  }, [location.pathname, editSession?.sessionId, navigate])

  useEffect(() => {
    if (!editSession?.sessionId) return
    if (isEditPdfEditorPath(location.pathname)) return
    navigate('/tools/edit-pdf/editor', { replace: true })
  }, [editSession?.sessionId, location.pathname, navigate])

  useEffect(() => {
    document.title = EDIT_DOC_TITLE
    const path = sessionId ? '/tools/edit-pdf/editor' : '/tools/edit-pdf'
    pageView(path, EDIT_DOC_TITLE)
  }, [sessionId])

  const setEditSessionAndClearStorage = (next) => {
    setEditSession(next)
    if (!next) clearPersistedEditSession()
  }

  const leaveEditor = () => {
    setEditSessionAndClearStorage(null)
    navigate('/tools/edit-pdf', { replace: true })
  }

  return (
    <EditPdfSessionFlow
      editSession={editSession}
      setEditSession={setEditSessionAndClearStorage}
      onLeaveEditor={leaveEditor}
      upload={upload}
      uploading={uploading}
      uploadProgress={uploadProgress}
    />
  )
}
