import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { apiUrl } from '../../lib/apiBase.js'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import {
  pageView,
  trackErrorOccurred,
  trackFileDownloaded,
  trackToolCompleted,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { docTitleForPath } from '../../shared/constants/branding.js'

const WORD_TO_PDF_TOOL = ANALYTICS_TOOL.word_to_pdf
const DOC_TITLE = docTitleForPath('/tools/word-to-pdf')

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
  const [caps, setCaps] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  useToolEngagement(WORD_TO_PDF_TOOL, true)

  useEffect(() => {
    document.title = DOC_TITLE
    pageView('/tools/word-to-pdf', DOC_TITLE)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(apiUrl('/document-flow/capabilities'))
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j?.error || r.statusText)
        if (!cancelled) setCaps(j)
      } catch (e) {
        if (!cancelled) {
          setLoadError(e?.message || 'Could not reach the API')
          setCaps({ docxToPdf: false, pdfToDocx: false })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onDocx = useCallback(async (file) => {
    if (!file) return
    setActionError(null)
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(apiUrl('/document-flow/convert-docx-to-pdf'), {
        method: 'POST',
        body: fd,
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j?.message || j?.error || r.statusText)
      }
      const blob = await r.blob()
      const base = (file.name || 'document').replace(/\.docx$/i, '') || 'document'
      triggerDownloadBlob(blob, `${base}.pdf`)
      trackFileDownloaded({
        tool: WORD_TO_PDF_TOOL,
        file_size: blob.size / 1024,
        total_pages: 1,
      })
      trackToolCompleted(WORD_TO_PDF_TOOL, true)
    } catch (e) {
      trackErrorOccurred(WORD_TO_PDF_TOOL, e?.message || 'convert_docx_failed')
      setActionError(e?.message || 'Conversion failed')
    } finally {
      setBusy(false)
    }
  }, [])

  const onDocxFiles = useCallback(
    (files) => {
      const file = files?.[0]
      if (!file) return
      const name = (file.name || '').toLowerCase()
      const okType =
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        name.endsWith('.docx')
      if (!okType) {
        setActionError('Please choose a .docx file.')
        return
      }
      void onDocx(file)
    },
    [onDocx]
  )

  return (
    <ToolPageShell
      title="Word to PDF"
      subtitle="Upload a .docx file and download a PDF. Your file is sent to this app’s API for conversion."
    >
      <div className="space-y-4">
        {loadError && (
          <p
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            {loadError}
          </p>
        )}

        {caps?.docxToPdf ? (
          <>
            <FileDropzone
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple={false}
              disabled={busy}
              onFiles={onDocxFiles}
              label={busy ? 'Converting…' : 'Drop your Word file here or click to browse'}
            />
            <p className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
              One <strong>.docx</strong> at a time (Microsoft Word or compatible). Layout may shift
              slightly in the PDF.
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-6 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300">
            <p className="m-0 font-medium text-zinc-900 dark:text-zinc-100">Converter not configured</p>
            <p className="mt-2 mb-0">
              The API needs a reachable{' '}
              <a
                className="text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400"
                href="https://gotenberg.dev/"
                target="_blank"
                rel="noreferrer"
              >
                Gotenberg
              </a>{' '}
              instance: set <code className="rounded bg-zinc-200 px-1 font-mono text-xs dark:bg-zinc-800">GOTENBERG_URL</code>{' '}
              (full URL) on the server, or deploy with the repo{' '}
              <code className="font-mono text-xs">render.yaml</code> so production gets{' '}
              <code className="font-mono text-xs">GOTENBERG_HOSTPORT</code> automatically. For local dev, see{' '}
              <code className="font-mono text-xs">docker-compose.document-flow.yml</code>.
            </p>
          </div>
        )}

        {actionError && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100"
          >
            {actionError}
          </p>
        )}

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Need to tweak text or markup on an existing PDF?{' '}
          <Link
            to="/tools/edit-pdf"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400"
          >
            Open Edit PDF
          </Link>
          .
        </p>
      </div>

      <ToolFeatureSeoSection toolId="word-to-pdf" />
    </ToolPageShell>
  )
}
