import { useState } from 'react'
import { apiUrl, isApiBaseConfigured } from '../../lib/apiBase'
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
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'

const OCR_TOOL = ANALYTICS_TOOL.ocr_pdf

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export default function OcrPdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fileReadyHint, setFileReadyHint] = useState(null)
  const [ocrMetaHint, setOcrMetaHint] = useState(null)

  useToolEngagement(OCR_TOOL, true)

  const runOcr = async () => {
    if (!file) {
      setError('Choose a PDF first.')
      return
    }
    if (import.meta.env.PROD && !isApiBaseConfigured()) {
      setError('OCR needs the online document service, which is not available from this build. Try again later.')
      return
    }

    setBusy(true)
    setError(null)
    setFileReadyHint(null)
    setOcrMetaHint(null)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()

    try {
      await runWithSignInForDownload(
        async () => {
          const fd = new FormData()
          fd.append('file', file)

          const res = await fetch(apiUrl('/ocr-pdf'), { method: 'POST', body: fd, credentials: 'include' })
          const contentType = res.headers.get('Content-Type') || ''

          if (!res.ok) {
            let msg = res.statusText || 'Request failed'
            if (contentType.includes('application/json')) {
              try {
                const j = await res.json()
                if (j?.error) msg = typeof j.error === 'string' ? j.error : j.message || msg
                if (typeof j?.message === 'string' && j.message) msg = j.message
              } catch {
                /* ignore */
              }
            } else if (res.status === 404) {
              msg = 'OCR is not available from this site right now. Try again later.'
            } else {
              try {
                const t = await res.text()
                const trimmed = t?.trim?.() ?? ''
                if (trimmed && trimmed.length < 800 && !trimmed.startsWith('<')) {
                  msg = trimmed
                }
              } catch {
                /* ignore */
              }
            }
            trackErrorOccurred(OCR_TOOL, msg || `http_${res.status}`)
            setError(msg)
            return
          }

          if (!contentType.includes('application/pdf')) {
            const text = await res.text()
            console.warn('[ocr-pdf] unexpected response:', contentType, text.slice(0, 200))
            trackErrorOccurred(OCR_TOOL, 'unexpected_response_type')
            setError('The service did not return a PDF. Try again later.')
            return
          }

          const truncated = res.headers.get('X-OCR-Truncated') === 'yes'
          const pageCount = res.headers.get('X-OCR-Page-Count')
          const originalPages = res.headers.get('X-OCR-Original-Pages')
          if (truncated && pageCount && originalPages) {
            setOcrMetaHint(
              `Processed first ${pageCount} of ${originalPages} pages (server limit). Download and run again on the rest if needed.`
            )
          } else if (pageCount) {
            setOcrMetaHint(`Processed ${pageCount} page${pageCount === '1' ? '' : 's'}.`)
          }

          const blob = await res.blob()
          const base = (file.name || 'document').replace(/\.pdf$/i, '')
          const safe = base.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'document'
          downloadBlob(blob, `${safe}-ocr.pdf`)
          setFileReadyHint(MSG.fileReady)
          window.setTimeout(() => setFileReadyHint(null), 6000)
          trackToolCompleted(OCR_TOOL, true)
          trackFileDownloaded({
            tool: OCR_TOOL,
            file_size: blob.size / 1024,
          })
          const elapsed =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          trackProcessingTime(OCR_TOOL, elapsed)
        },
        { onAuthLoading: () => setError('Still checking sign-in… try again in a moment.') }
      )
    } catch (e) {
      if (e?.code === 'EYP_AUTH_CANCELLED') {
        /* dismissed */
      } else if (e?.code === 'EYP_AUTH_LOADING') {
        setError(e.message || 'Still checking sign-in.')
      } else {
        console.error('[ocr-pdf]', e)
        trackErrorOccurred(
          OCR_TOOL,
          e?.message === 'Failed to fetch' ? 'fetch_failed' : e?.message || 'ocr_failed'
        )
        setError(
          e?.message === 'Failed to fetch'
            ? 'Could not reach the server. Check your connection and try again.'
            : e?.message || 'OCR failed'
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolPageShell
      title="OCR PDF"
      subtitle="Turn scanned pages into searchable text (server uses ocrmypdf + Tesseract). Download a new PDF, then open it in Edit PDF if you want to change wording."
    >
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={(f) => {
          const next = f[0]
          if (next) {
            markFunnelUpload(OCR_TOOL)
            trackFileUploaded({
              file_type: 'pdf',
              file_size: next.size / 1024,
              tool: OCR_TOOL,
            })
          }
          setFile(next)
          setFileReadyHint(null)
          setOcrMetaHint(null)
        }}
        label={file ? file.name : 'Drop PDF here (scans or photos of documents)'}
      />
      {fileReadyHint && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          {fileReadyHint}
        </div>
      )}
      {ocrMetaHint && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-200"
        >
          {ocrMetaHint}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}
      <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        Large files may take several minutes. Password-protected PDFs are not supported here — use{' '}
        <strong>Unlock PDF</strong> first. Up to <strong>40 pages</strong> per run by default.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={runOcr}
        className="mt-6 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
      >
        {busy ? MSG.processingFile : 'Run OCR and download'}
      </button>
      <ToolFeatureSeoSection toolId="ocr-pdf" />
      <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
        OCR runs on our servers with searchable-text output. For best results on scans, use clear, upright pages.
      </p>
    </ToolPageShell>
  )
}
