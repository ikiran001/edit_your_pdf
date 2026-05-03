import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import {
  pageView,
  trackErrorOccurred,
  trackEvent,
  trackFileDownloaded,
  trackToolCompleted,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { docTitleForPath } from '../../shared/constants/branding.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'
import { extractPdfPlainText, CLIENT_PDF_MAX_BYTES, CLIENT_PDF_MAX_PAGES } from './extractPdfText.js'
import { buildMinimalDocxBlob } from './buildMinimalDocx.js'

const PDF_TO_WORD_TOOL = ANALYTICS_TOOL.pdf_to_word
const DOC_TITLE = docTitleForPath('/tools/pdf-to-word')

/** Too little extracted text — typical scan / image-only PDF */
const CLIENT_MIN_TEXT_CHARS = 14

const MAX_MB = Math.round(CLIENT_PDF_MAX_BYTES / (1024 * 1024))

/** @typedef {'insufficient_text' | 'size_limit' | 'page_limit' | 'client_error'} PdfToWordFailReason */

function triggerDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export default function PdfToWordPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [busy, setBusy] = useState(false)
  const [busyPhase, setBusyPhase] = useState(null)
  /** Discriminated UI for errors (OCR link when scan-like). */
  const [failure, setFailure] = useState(
    /** @type {{ reason: PdfToWordFailReason, message?: string } | null} */
    null
  )
  const [successHint, setSuccessHint] = useState(null)
  const [signInNotice, setSignInNotice] = useState(null)

  useToolEngagement(PDF_TO_WORD_TOOL, true)

  useEffect(() => {
    document.title = DOC_TITLE
    pageView('/tools/pdf-to-word', DOC_TITLE)
  }, [])

  useEffect(() => {
    if (!successHint) return
    const t = window.setTimeout(() => setSuccessHint(null), 9000)
    return () => window.clearTimeout(t)
  }, [successHint])

  const failClosed = useCallback((reason, message) => {
    trackEvent('pdf_to_word_failed', { reason })
    setFailure({ reason, message })
  }, [])

  const onPdf = useCallback(
    async (file) => {
      if (!file) return

      setFailure(null)
      setSignInNotice(null)
      setSuccessHint(null)
      setBusy(true)
      setBusyPhase('client')

      try {
        if (file.size > CLIENT_PDF_MAX_BYTES) {
          failClosed('size_limit', `This PDF is larger than ${MAX_MB} MB. Split it or use a smaller file.`)
          return
        }

        const buf = await file.arrayBuffer()
        let extracted
        try {
          extracted = await extractPdfPlainText(buf)
        } catch (e) {
          console.warn('[pdf-to-word] PDF.js extraction failed:', e)
          failClosed('client_error', 'Could not read this PDF in your browser. Try a smaller file or a different PDF.')
          trackErrorOccurred(PDF_TO_WORD_TOOL, e?.message || 'extract_failed')
          return
        }

        const { text, numPages } = extracted
        const pageCount = Math.max(1, numPages)

        if (numPages > CLIENT_PDF_MAX_PAGES) {
          failClosed(
            'page_limit',
            `This PDF has more than ${CLIENT_PDF_MAX_PAGES} pages. Split it into smaller files and try again.`
          )
          return
        }

        if (text.trim().length < CLIENT_MIN_TEXT_CHARS) {
          failClosed('insufficient_text')
          return
        }

        let blob
        try {
          blob = await buildMinimalDocxBlob(text)
        } catch (e) {
          if (e?.message === 'empty_text') {
            failClosed('insufficient_text')
            return
          }
          console.warn('[pdf-to-word] docx build failed:', e)
          failClosed('client_error', 'Could not build a Word file from this PDF. Try a smaller or simpler file.')
          trackErrorOccurred(PDF_TO_WORD_TOOL, e?.message || 'docx_build_failed')
          return
        }

        const base = (file.name || 'document').replace(/\.pdf$/i, '') || 'document'
        const outName = `${base}.docx`

        await runWithSignInForDownload(
          async () => {
            setFailure(null)
            setSignInNotice(null)
            triggerDownloadBlob(blob, outName)
            try {
              trackEvent('pdf_to_word_path', { path: 'client' })
              setSuccessHint(
                `“${outName}” was built on your device — the PDF was not uploaded for conversion. Open in Word for formatting tweaks.`
              )
              trackFileDownloaded({
                tool: PDF_TO_WORD_TOOL,
                file_size: blob.size / 1024,
                total_pages: pageCount,
              })
              trackToolCompleted(PDF_TO_WORD_TOOL, true)
            } catch (analyticsErr) {
              console.warn('[pdf-to-word] analytics:', analyticsErr)
            }
          },
          {
            onAuthLoading: () => {
              setSignInNotice(
                'Checking sign-in… If you are not logged in, you will be asked to sign in before the Word file downloads.'
              )
            },
          }
        )
      } catch (e) {
        if (e?.code === 'EYP_AUTH_CANCELLED') {
          setSignInNotice(null)
          setFailure({
            reason: 'client_error',
            message:
              'Sign-in was dismissed. Your Word file was not downloaded. Sign in when prompted to download, or convert again.',
          })
          return
        }
        if (e?.code === 'EYP_AUTH_LOADING') {
          setFailure({ reason: 'client_error', message: e.message || 'Still checking sign-in. Try again in a moment.' })
          return
        }
        trackErrorOccurred(PDF_TO_WORD_TOOL, e?.message || 'convert_pdf_failed')
        failClosed('client_error', e?.message || 'Conversion failed. Try a smaller PDF.')
      } finally {
        setBusy(false)
        setBusyPhase(null)
        setSignInNotice(null)
      }
    },
    [failClosed, runWithSignInForDownload]
  )

  const onPdfFiles = useCallback(
    (files) => {
      const file = files?.[0]
      if (!file) return
      const name = (file.name || '').toLowerCase()
      const okType = file.type === 'application/pdf' || name.endsWith('.pdf')
      if (!okType) {
        setFailure({ reason: 'client_error', message: 'Please choose a PDF file.' })
        setSuccessHint(null)
        return
      }
      void onPdf(file)
    },
    [onPdf]
  )

  return (
    <ToolPageShell
      title="PDF to Word"
      subtitle="Convert to .docx in your browser — your PDF is not uploaded for conversion (sign-in or analytics may still use your network)."
    >
      <div className="mx-auto max-w-xl space-y-4">
        <ol className="m-0 flex list-none flex-wrap items-center justify-center gap-2 px-0 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <li className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-200">
            1 · Upload
          </li>
          <li aria-hidden className="text-zinc-400 dark:text-zinc-600">
            →
          </li>
          <li
            className={`rounded-full px-2.5 py-1 ${
              busy
                ? 'bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-100'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
          >
            2 · Convert
          </li>
          <li aria-hidden className="text-zinc-400 dark:text-zinc-600">
            →
          </li>
          <li className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            3 · Download
          </li>
        </ol>
        <FileDropzone
          accept=".pdf,application/pdf"
          multiple={false}
          disabled={false}
          busy={busy}
          onFiles={onPdfFiles}
          label={busy ? 'Converting your PDF…' : 'Drop your PDF here, or click to choose a file'}
          hint={`PDFs up to ${MAX_MB} MB and ${CLIENT_PDF_MAX_PAGES} pages. Draft output — complex layouts may simplify.`}
          hideAcceptTypes
        />
        {busy ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-center text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-100"
          >
            <p className="m-0 mb-2 inline-flex items-center justify-center gap-2">
              <span
                className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-sky-600 border-t-transparent motion-safe:animate-spin dark:border-cyan-400 dark:border-t-transparent"
                aria-hidden
              />
              <span className="font-medium">
                {busyPhase === 'client' ? 'Building Word in your browser…' : 'Working…'}
              </span>
            </p>
            <p className="m-0 text-xs leading-relaxed text-sky-900/85 dark:text-sky-100/85">
              Draft .docx may simplify formatting; review in Microsoft Word or LibreOffice.
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            If you are <strong>not signed in</strong>, we prepare your file first, then ask you to <strong>sign in</strong>{' '}
            before download when accounts are enabled.{' '}
            <Link className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400" to="/tools/ocr-pdf">
              OCR PDF
            </Link>{' '}
            adds searchable text to scanned documents before you convert here.
          </p>
        )}

        {signInNotice && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-sky-200 bg-sky-50/95 px-4 py-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
          >
            <p className="m-0">{signInNotice}</p>
          </div>
        )}

        {successHint && (
          <div
            role="status"
            className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50"
          >
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
              strokeWidth={2}
              aria-hidden
            />
            <p className="m-0 flex-1 leading-relaxed">{successHint}</p>
          </div>
        )}

        {failure && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-start sm:justify-between dark:border-red-900 dark:bg-red-950/50 dark:text-red-100"
          >
            <div className="m-0 flex-1 leading-relaxed">
              {failure.reason === 'insufficient_text' ? (
                <p className="m-0">
                  Little or no selectable text was found — scanned PDFs are usually images without a text layer.{' '}
                  <Link
                    className="font-medium text-indigo-700 underline-offset-2 hover:underline dark:text-cyan-400"
                    to="/tools/ocr-pdf"
                  >
                    Open OCR PDF
                  </Link>{' '}
                  to create a searchable PDF, then try PDF to Word again. Or{' '}
                  <Link className="font-medium text-indigo-700 underline-offset-2 hover:underline dark:text-cyan-400" to="/tools/edit-pdf">
                    Edit PDF
                  </Link>{' '}
                  for light fixes.
                </p>
              ) : (
                <p className="m-0">{failure.message || 'Conversion failed.'}</p>
              )}
            </div>
            <button
              type="button"
              className="shrink-0 self-end rounded-lg border border-red-300/80 bg-white/90 px-3 py-1.5 text-xs font-medium text-red-900 shadow-sm hover:bg-red-50 dark:border-red-800 dark:bg-red-950/80 dark:text-red-100 dark:hover:bg-red-900/60"
              onClick={() => setFailure(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Need the reverse?{' '}
          <Link
            to="/tools/word-to-pdf"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400"
          >
            Word to PDF
          </Link>{' '}
          (draft .pdf in your browser). Edit text in place?{' '}
          <Link
            to="/tools/edit-pdf"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400"
          >
            Open Edit PDF
          </Link>
          .
        </p>
      </div>

      <ToolFeatureSeoSection toolId="pdf-to-word" />
    </ToolPageShell>
  )
}
