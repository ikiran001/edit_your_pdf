import { useCallback, useState } from 'react'
import JSZip from 'jszip'
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
import { pdfToPngBlobs } from './pdfToPngCore.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'
import { CLIENT_PDF_MAX_BYTES } from '../pdf-to-word/extractPdfText.js'

const TOOL = ANALYTICS_TOOL.pdf_to_png

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export default function PdfToPngPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fileReadyHint, setFileReadyHint] = useState(null)
  const [scale, setScale] = useState(2)

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
      setFileReadyHint(null)
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
            const blobs = await pdfToPngBlobs(buf, { scale })
            const zip = new JSZip()
            blobs.forEach((blob, idx) => {
              zip.file(`page-${String(idx + 1).padStart(3, '0')}.png`, blob)
            })
            const zblob = await zip.generateAsync({ type: 'blob' })
            downloadBlob(zblob, `${base}-pages.zip`)
            trackToolCompleted(TOOL, true)
            trackFileDownloaded({
              tool: TOOL,
              file_size: zblob.size / 1024,
              total_pages: blobs.length,
            })
            const elapsed =
              (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
            trackProcessingTime(TOOL, elapsed)
            setFileReadyHint(MSG.fileReady)
            window.setTimeout(() => setFileReadyHint(null), 6000)
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
          trackErrorOccurred(TOOL, e?.message || 'conversion_failed')
          setError(e?.message || 'Conversion failed')
        }
      } finally {
        setBusy(false)
      }
    },
    [scale, runWithSignInForDownload]
  )

  return (
    <ToolPageShell title="PDF to PNG" subtitle="Export every page as PNG in one ZIP — lossless images in your browser.">
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={onPdf}
        label={busy ? MSG.processingFile : 'Drop a PDF here or click to browse'}
      />
      <div className="mb-6 mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/60">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <span>Render scale</span>
          <select
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            disabled={busy}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
          </select>
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Higher scale = sharper PNGs and larger ZIP files. Nothing is uploaded off your device.
        </p>
      </div>
      {fileReadyHint && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          {fileReadyHint}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}
      <ToolFeatureSeoSection toolId="pdf-to-png" />
      {busy && (
        <div className="mt-6 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      )}
    </ToolPageShell>
  )
}
