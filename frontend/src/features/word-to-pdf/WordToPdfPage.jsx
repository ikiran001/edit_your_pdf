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
import { extractDocxPlainText, CLIENT_DOCX_MAX_BYTES } from './extractDocxPlainText.js'
import { buildDraftPdfBlob } from './buildDraftPdfFromPlainText.js'

const WORD_TO_PDF_TOOL = ANALYTICS_TOOL.word_to_pdf
const DOC_TITLE = docTitleForPath('/tools/word-to-pdf')

const MAX_MB = Math.round(CLIENT_DOCX_MAX_BYTES / (1024 * 1024))

/** @typedef {'empty_text' | 'size_limit' | 'parse_error' | 'client_error'} WordToPdfFailReason */

function triggerDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export default function WordToPdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [busy, setBusy] = useState(false)
  const [busyPhase, setBusyPhase] = useState(null)
  const [failure, setFailure] = useState(
    /** @type {{ reason: WordToPdfFailReason, message?: string } | null} */
    null
  )
  const [successHint, setSuccessHint] = useState(null)

  useToolEngagement(WORD_TO_PDF_TOOL, true)

  useEffect(() => {
    document.title = DOC_TITLE
    pageView('/tools/word-to-pdf', DOC_TITLE)
  }, [])

  useEffect(() => {
    if (!successHint) return
    const t = window.setTimeout(() => setSuccessHint(null), 9000)
    return () => window.clearTimeout(t)
  }, [successHint])

  const failClosed = useCallback((reason, message) => {
    trackEvent('word_to_pdf_failed', { reason })
    setFailure({ reason, message })
  }, [])

  const onDocx = useCallback(
    async (file) => {
      if (!file) return

      setFailure(null)
      setSuccessHint(null)
      setBusy(true)
      setBusyPhase('read')

      try {
        if (file.size > CLIENT_DOCX_MAX_BYTES) {
          failClosed('size_limit', `This file is larger than ${MAX_MB} MB. Try a smaller .docx or split the document.`)
          return
        }

        const buf = await file.arrayBuffer()
        let text
        try {
          text = await extractDocxPlainText(buf)
        } catch (e) {
          console.warn('[word-to-pdf] docx extract failed:', e)
          failClosed(
            'parse_error',
            'Could not read this .docx (corrupt file, password-protected, or not a real Word document). Try saving again from Word or LibreOffice.'
          )
          trackErrorOccurred(WORD_TO_PDF_TOOL, e?.message || 'extract_failed')
          return
        }

        if (!String(text || '').trim()) {
          failClosed('empty_text')
          return
        }

        setBusyPhase('pdf')
        let pdfBlob
        let numPages = 1
        try {
          const out = await buildDraftPdfBlob(text)
          pdfBlob = out.blob
          numPages = out.numPages
        } catch (e) {
          console.warn('[word-to-pdf] pdf build failed:', e)
          failClosed('client_error', e?.message === 'empty_text' ? 'No text to put in the PDF.' : 'Could not build the PDF in your browser.')
          trackErrorOccurred(WORD_TO_PDF_TOOL, e?.message || 'pdf_build_failed')
          return
        }

        const base = (file.name || 'document').replace(/\.docx$/i, '') || 'document'
        const outName = `${base}.pdf`

        trackEvent('word_to_pdf_path', { path: 'client' })

        await runWithSignInForDownload(async () => {
          setFailure(null)
          triggerDownloadBlob(pdfBlob, outName)
          setSuccessHint(
            `“${outName}” should appear in your downloads. Draft PDF — open it and compare to your Word file; tables and complex layout are not preserved.`
          )
            trackFileDownloaded({
              tool: WORD_TO_PDF_TOOL,
              file_size: pdfBlob.size / 1024,
              total_pages: numPages,
            })
          trackToolCompleted(WORD_TO_PDF_TOOL, true)
        })
      } catch (e) {
        if (e?.code === 'EYP_AUTH_CANCELLED') {
          setFailure({
            reason: 'client_error',
            message:
              'Sign-in was dismissed. Your PDF was ready but not downloaded. Sign in when prompted, or convert again.',
          })
          return
        }
        if (e?.code === 'EYP_AUTH_LOADING') {
          setFailure({ reason: 'client_error', message: e.message || 'Still checking sign-in. Try again in a moment.' })
          return
        }
        trackErrorOccurred(WORD_TO_PDF_TOOL, e?.message || 'convert_failed')
        setFailure({ reason: 'client_error', message: e?.message || 'Conversion failed.' })
      } finally {
        setBusy(false)
        setBusyPhase(null)
      }
    },
    [failClosed, runWithSignInForDownload]
  )

  const onDocxFiles = useCallback(
    (files) => {
      const file = files?.[0]
      if (!file) return
      const name = (file.name || '').toLowerCase()
      const okType =
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        name.endsWith('.docx')
      if (!okType) {
        setFailure({ reason: 'client_error', message: 'Please choose a .docx file.' })
        setSuccessHint(null)
        return
      }
      void onDocx(file)
    },
    [onDocx]
  )

  return (
    <ToolPageShell
      title="Word to PDF"
      subtitle="Draft PDF in your browser — your .docx is not uploaded for conversion (sign-in or analytics may still use your network)."
    >
      <div className="mx-auto max-w-xl space-y-4">
        <p className="m-0 rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100">
          <span className="font-medium">Fast, private draft:</span> we read your .docx in this tab (via JSZip + XML)
          and build a simple PDF with pdf-lib. This is <strong>not</strong> a full Word/LibreOffice layout — tables,
          images, and exact fonts are not reproduced. For pixel-perfect output, export PDF from Word or use a server
          converter elsewhere.
        </p>

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
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple={false}
          disabled={false}
          busy={busy}
          onFiles={onDocxFiles}
          label={busy ? 'Building your PDF…' : 'Drop your .docx here, or click to choose a file'}
          hint={`Microsoft Word .docx only — up to about ${MAX_MB} MB. Draft output — complex layouts are not preserved.`}
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
                {busyPhase === 'read' ? 'Reading your Word document…' : 'Writing PDF in your browser…'}
              </span>
            </p>
            <p className="m-0 text-xs leading-relaxed text-sky-900/85 dark:text-sky-100/85">
              No round-trip to a converter cloud — typical documents finish in seconds on this device.
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            If you are <strong>not signed in</strong>, we prepare your PDF first, then ask you to <strong>sign in</strong>{' '}
            before download when accounts are enabled.
          </p>
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
              {failure.reason === 'empty_text' ? (
                <p className="m-0">
                  No readable text was found in this .docx — it may be empty, image-only, or use features we do not
                  parse yet. Try exporting a simpler document or use{' '}
                  <strong className="font-semibold">Print → Save as PDF</strong> from Word for full fidelity.
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
          Need to tweak an existing PDF?{' '}
          <Link
            to="/tools/edit-pdf"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400"
          >
            Open Edit PDF
          </Link>
          . Reverse direction?{' '}
          <Link
            to="/tools/pdf-to-word"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400"
          >
            PDF to Word
          </Link>{' '}
          (also builds a draft in your browser).
        </p>
      </div>

      <ToolFeatureSeoSection toolId="word-to-pdf" />
    </ToolPageShell>
  )
}
