import { useCallback, useState } from 'react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import {
  markFunnelUpload,
  trackErrorOccurred,
  trackFileDownloaded,
  trackFileUploaded,
  trackProcessingTime,
  trackToolCompleted,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { MSG } from '../../shared/constants/branding.js'
import { extractPdfPlainText, CLIENT_PDF_MAX_BYTES } from '../pdf-to-word/extractPdfText.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'

const TOOL = ANALYTICS_TOOL.pdf_to_text

function downloadTextFile(text, baseName) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${baseName}.txt`
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export default function PdfToTextPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [hint, setHint] = useState(null)

  useToolEngagement(TOOL, true)

  const onPdf = useCallback(
    async (files) => {
      const file = files[0]
      if (!file || file.type !== 'application/pdf') return
      if (file.size > CLIENT_PDF_MAX_BYTES) {
        setError(`Choose a PDF under ${Math.round(CLIENT_PDF_MAX_BYTES / (1024 * 1024))} MB for this browser tool.`)
        return
      }
      setError(null)
      setHint(null)
      setBusy(true)
      const base = file.name.replace(/\.pdf$/i, '') || 'document'
      markFunnelUpload(TOOL)
      trackFileUploaded({
        file_type: 'pdf',
        file_size: file.size / 1024,
        tool: TOOL,
      })
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      try {
        await runWithSignInForDownload(
          async () => {
            const buf = await file.arrayBuffer()
            const { text, numPages } = await extractPdfPlainText(buf)
            const trimmed = text.trim()
            if (!trimmed) {
              setHint(
                'No selectable text was found. Scanned PDFs need OCR first — try the OCR PDF tool, then export text here.'
              )
            }
            downloadTextFile(text || '', `${base}-extracted`)
            trackToolCompleted(TOOL, true)
            trackFileDownloaded({
              tool: TOOL,
              file_size: (text?.length || 0) / 1024,
              total_pages: numPages,
            })
            const elapsed =
              (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
            trackProcessingTime(TOOL, elapsed)
            setHint((prev) => prev || MSG.fileReady)
            window.setTimeout(() => setHint(null), 8000)
          },
          { onAuthLoading: () => setError('Still checking sign-in… try again in a moment.') }
        )
      } catch (e) {
        if (e?.code === 'EYP_AUTH_CANCELLED') {
          /* dismissed */
        } else if (e?.code === 'EYP_AUTH_LOADING') {
          setError(e.message || 'Still checking sign-in.')
        } else {
          console.error(e)
          trackErrorOccurred(TOOL, e?.message || 'extract_failed')
          setError(e?.message || 'Could not extract text')
        }
      } finally {
        setBusy(false)
      }
    },
    [runWithSignInForDownload]
  )

  return (
    <ToolPageShell
      title="PDF to text"
      subtitle="Download plain text (.txt) from digital PDFs — processed locally in your browser."
    >
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={onPdf}
        label={busy ? MSG.processingFile : 'Drop a PDF here or click to browse'}
      />
      <p className="mb-6 mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        Works best on PDFs that already contain text. Image-only scans produce an empty file until you run OCR
        elsewhere.
      </p>
      {hint && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          {hint}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}
      <ToolFeatureSeoSection toolId="pdf-to-text" />
      {busy && (
        <div className="mt-6 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      )}
    </ToolPageShell>
  )
}
