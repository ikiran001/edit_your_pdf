import { useCallback, useState } from 'react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import {
  trackErrorOccurred,
  trackFileDownloaded,
  trackToolCompleted,
  trackProcessingTime,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { CLIENT_PDF_MAX_BYTES } from '../pdf-to-word/extractPdfText.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'
import RedactWorkspace from './RedactWorkspace.jsx'
import { applyRedactionsToPdf } from './applyRedactPdf.js'

const TOOL = ANALYTICS_TOOL.redact_pdf

function downloadUint8(u8, name) {
  const blob = new Blob([u8], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export default function RedactPdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [marks, setMarks] = useState(
    /** @type {Array<{ id: string, pageIndex: number, nx: number, ny: number, nw: number, nh: number, staged?: boolean }>} */ (
      []
    )
  )

  useToolEngagement(TOOL, true)

  const onPdf = useCallback((files) => {
    const f = files?.[0]
    if (!f) return
    if (f.size > CLIENT_PDF_MAX_BYTES) {
      setError(`PDF must be under ${Math.round(CLIENT_PDF_MAX_BYTES / (1024 * 1024))} MB.`)
      return
    }
    setError(null)
    setMarks([])
    setFile(f)
  }, [])

  const runRedact = async () => {
    if (!file) return
    const toBurn = marks
    if (toBurn.length === 0) {
      setError('Add at least one redaction box before downloading.')
      return
    }
    setBusy(true)
    setError(null)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      await runWithSignInForDownload(
        async () => {
          const u8 = await applyRedactionsToPdf(
            file,
            toBurn.map(({ pageIndex, nx, ny, nw, nh }) => ({ pageIndex, nx, ny, nw, nh }))
          )
          const base = (file.name || 'document').replace(/\.pdf$/i, '') || 'document'
          downloadUint8(u8, `${base}-redacted.pdf`)
          trackToolCompleted(TOOL, true)
          trackFileDownloaded({ tool: TOOL, file_size: u8.byteLength / 1024, total_pages: undefined })
          const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          trackProcessingTime(TOOL, elapsed)
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
        trackErrorOccurred(TOOL, e?.message || 'redact_failed')
        setError(e?.message || 'Could not redact PDF.')
      }
    } finally {
      setBusy(false)
    }
  }

  const regionCount = marks.length

  return (
    <ToolPageShell
      title="Redact PDF"
      subtitle="Draw redaction boxes in your browser, then download. Underlying text may still exist under ink for strict compliance."
      contentMaxWidth="wide"
    >
      {!file ? (
        <FileDropzone
          accept="application/pdf,.pdf"
          disabled={busy}
          onFiles={onPdf}
          label="Drop a PDF here"
        />
      ) : null}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}

      {file ? (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/40">
            <RedactWorkspace
              key={`${file.name}-${file.size}-${file.lastModified}`}
              file={file}
              marks={marks}
              setMarks={setMarks}
              busy={busy}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/80">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <strong>{regionCount}</strong> redaction region{regionCount === 1 ? '' : 's'}
            </p>
            <button
              type="button"
              disabled={busy || regionCount < 1}
              onClick={runRedact}
              className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Applying…' : 'Redact'}
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">→</span>
            </button>
          </div>

          <p className="text-xs text-amber-900 dark:text-amber-200/90">
            This draws opaque black ink. Underlying text may still exist in the PDF — use a dedicated legal redaction
            workflow when compliance requires removal of hidden text.
          </p>
        </div>
      ) : null}
    </ToolPageShell>
  )
}
