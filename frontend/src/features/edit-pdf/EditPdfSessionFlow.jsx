import { useCallback, useState } from 'react'
import LandingPage from '../../components/LandingPage.jsx'
import PdfEditor from '../../components/PdfEditor.jsx'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { syncUserLibraryEntry } from '../my-documents/userLibrary.js'
import {
  markFunnelUpload,
  trackErrorOccurred,
  trackFileUploaded,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'

const EDIT_TOOL = ANALYTICS_TOOL.edit_pdf

/**
 * @param {{ sessionId: string, downloadToken?: string | null } | null} editSession
 * @param {(s: { sessionId: string, downloadToken?: string | null } | null) => void} setEditSession
 * @param {() => void} props.onLeaveEditor Clear session and return to upload (toolbar Back).
 */
export default function EditPdfSessionFlow({
  editSession,
  setEditSession,
  onLeaveEditor,
  upload,
  uploading,
  uploadProgress,
}) {
  const [uploadError, setUploadError] = useState(null)
  const { user, getFreshIdToken } = useAuth()

  const onFileSelected = useCallback(
    async (file) => {
      setUploadError(null)
      try {
        const res = await upload(file)
        markFunnelUpload(EDIT_TOOL)
        trackFileUploaded({
          file_type: 'pdf',
          file_size: file.size / 1024,
          tool: EDIT_TOOL,
        })
        const fileName = res.filename || file?.name || 'document.pdf'
        setEditSession({
          sessionId: res.sessionId,
          downloadToken: res.downloadToken || null,
          fileName,
        })
        if (user) {
          void syncUserLibraryEntry({
            getFreshIdToken,
            user,
            sessionId: res.sessionId,
            fileName,
            tool: 'edit_pdf',
          })
        }
      } catch (e) {
        trackErrorOccurred(EDIT_TOOL, e?.message || 'upload_failed')
        setUploadError(e?.message || 'Upload failed. Please try again.')
      }
    },
    [upload, setEditSession, user, getFreshIdToken]
  )

  const sessionId = editSession?.sessionId ?? null

  if (!sessionId) {
    return (
      <ToolPageShell title="Edit PDF" subtitle="Upload, then annotate and edit text in the browser.">
        {uploadError && (
          <div
            role="alert"
            className="mx-auto mb-4 flex max-w-lg items-center justify-between rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200"
          >
            <span>{uploadError}</span>
            <button
              type="button"
              aria-label="Dismiss"
              className="ml-3 shrink-0 text-red-500 hover:text-red-700 dark:text-red-400"
              onClick={() => setUploadError(null)}
            >
              ✕
            </button>
          </div>
        )}
        <LandingPage
          embeddedInToolShell
          analyticsTool={EDIT_TOOL}
          onFileSelected={onFileSelected}
          loading={uploading}
          uploadProgress={uploadProgress}
        />
        <ToolFeatureSeoSection toolId="edit-pdf" />
      </ToolPageShell>
    )
  }

  return (
    <PdfEditor
      key={sessionId}
      sessionId={sessionId}
      originalFileName={editSession?.fileName || 'document.pdf'}
      downloadToken={editSession?.downloadToken ?? null}
      onDownloadTokenConsumed={() =>
        setEditSession((prev) =>
          prev ? { ...prev, downloadToken: null } : prev
        )
      }
      onBack={onLeaveEditor}
    />
  )
}
