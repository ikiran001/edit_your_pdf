import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { apiUrl, isApiBaseConfigured } from '../../lib/apiBase.js'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import {
  pageView,
  trackErrorOccurred,
  trackFileDownloaded,
  trackToolCompleted,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { docTitleForPath } from '../../shared/constants/branding.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'

const PDF_TO_WORD_TOOL = ANALYTICS_TOOL.pdf_to_word
const DOC_TITLE = docTitleForPath('/tools/pdf-to-word')

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
  const [capsStatus, setCapsStatus] = useState(() =>
    import.meta.env.PROD && !isApiBaseConfigured() ? 'error' : 'loading'
  )
  const [caps, setCaps] = useState(null)
  const [loadError, setLoadError] = useState(() =>
    import.meta.env.PROD && !isApiBaseConfigured()
      ? 'This production build does not know your API URL. Rebuild the frontend with VITE_API_BASE_URL set to your API origin (same value you use for Edit PDF / other tools), e.g. https://your-api.onrender.com'
      : null
  )
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [successHint, setSuccessHint] = useState(null)

  useToolEngagement(PDF_TO_WORD_TOOL, true)

  useEffect(() => {
    document.title = DOC_TITLE
    pageView('/tools/pdf-to-word', DOC_TITLE)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (import.meta.env.PROD && !isApiBaseConfigured()) return
    ;(async () => {
      try {
        const r = await fetch(apiUrl('/document-flow/capabilities'))
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j?.error || r.statusText)
        if (!cancelled) {
          setCaps(j)
          setCapsStatus('ready')
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e?.message ||
              'Could not load /document-flow/capabilities from the API. If the site is static hosting, set VITE_API_BASE_URL when building.'
          )
          setCapsStatus('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!successHint) return
    const t = window.setTimeout(() => setSuccessHint(null), 9000)
    return () => window.clearTimeout(t)
  }, [successHint])

  const onPdf = useCallback(
    async (file) => {
      if (!file) return
      if (import.meta.env.PROD && !isApiBaseConfigured()) {
        setActionError('Set VITE_API_BASE_URL when building the frontend so uploads reach your API.')
        return
      }
      setActionError(null)
      setSuccessHint(null)
      setBusy(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const r = await fetch(apiUrl('/document-flow/convert-pdf-to-docx'), {
          method: 'POST',
          body: fd,
          signal: AbortSignal.timeout(600_000),
        })
        if (!r.ok) {
          const ct = r.headers.get('content-type') || ''
          let detail = r.statusText
          if (ct.includes('application/json')) {
            const j = await r.json().catch(() => ({}))
            detail = j?.message || j?.error || detail
          } else {
            const t = await r.text().catch(() => '')
            if (t && t.length < 500) detail = t
          }
          throw new Error(detail || `HTTP ${r.status}`)
        }
        const blob = await r.blob()
        const base = (file.name || 'document').replace(/\.pdf$/i, '') || 'document'
        const outName = `${base}.docx`

        await runWithSignInForDownload(
          async () => {
            setActionError(null)
            triggerDownloadBlob(blob, outName)
            setSuccessHint(
              `“${outName}” should appear in your downloads. If nothing happens, allow downloads for this site or check the toolbar.`
            )
            trackFileDownloaded({
              tool: PDF_TO_WORD_TOOL,
              file_size: blob.size / 1024,
              total_pages: 1,
            })
            trackToolCompleted(PDF_TO_WORD_TOOL, true)
          },
          {
            onAuthLoading: () =>
              setActionError(
                'Checking sign-in… If you are not logged in, you will be asked to sign in before the Word file downloads.'
              ),
          }
        )
      } catch (e) {
        if (e?.code === 'EYP_AUTH_CANCELLED') {
          setActionError(
            'Sign-in was dismissed. Your file was converted, but the Word document was not downloaded. Sign in when prompted to download, or convert again.'
          )
          return
        }
        if (e?.code === 'EYP_AUTH_LOADING') {
          setActionError(e.message || 'Still checking sign-in. Try again in a moment.')
          return
        }
        trackErrorOccurred(PDF_TO_WORD_TOOL, e?.message || 'convert_pdf_failed')
        let msg = e?.message || 'Conversion failed'
        if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
          msg =
            'Conversion timed out in the browser. Very large PDFs can take several minutes — try a smaller file or try again.'
        } else if (/Failed to fetch|NetworkError|load failed|CORS/i.test(msg)) {
          msg =
            'Could not reach the API from this site. Confirm GitHub Actions rebuilt the site after setting VITE_API_BASE_URL, and that the API allows your domain (CORS). Open /document-flow/capabilities on the API host in a new tab to verify it is up.'
        }
        setActionError(msg)
      } finally {
        setBusy(false)
      }
    },
    [runWithSignInForDownload]
  )

  const onPdfFiles = useCallback(
    (files) => {
      const file = files?.[0]
      if (!file) return
      const name = (file.name || '').toLowerCase()
      const okType = file.type === 'application/pdf' || name.endsWith('.pdf')
      if (!okType) {
        setActionError('Please choose a PDF file.')
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
      subtitle="Turn a PDF into an editable Word document — upload here, download a .docx when it’s ready."
    >
      <div className="mx-auto max-w-xl space-y-4">
        {loadError && (
          <p
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            {loadError}
          </p>
        )}

        {capsStatus === 'loading' && (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 px-6 py-8 dark:border-zinc-700 dark:bg-zinc-900/50">
            <p className="mb-5 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Checking converter…
            </p>
            <div className="space-y-2.5" aria-hidden>
              <div className="mx-auto h-2.5 max-w-[min(100%,14rem)] rounded-full bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-700" />
              <div className="mx-auto h-2.5 max-w-[min(100%,20rem)] rounded-full bg-zinc-200/90 motion-safe:animate-pulse dark:bg-zinc-600/90" />
              <div className="mx-auto h-2.5 max-w-[min(100%,11rem)] rounded-full bg-zinc-200/80 motion-safe:animate-pulse dark:bg-zinc-700/80" />
            </div>
          </div>
        )}

        {capsStatus === 'ready' && caps?.pdfToDocx ? (
          <>
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
              hint="PDF only — up to about 52 MB. Complex layouts may change when opened in Word; review before sharing."
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
                  <span className="font-medium">Working on your Word file…</span>
                </p>
                <p className="m-0 text-xs leading-relaxed text-sky-900/85 dark:text-sky-100/85">
                  Converting with <strong>LibreOffice</strong> on this server. Large PDFs can take a few minutes — please
                  keep this tab open.
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                If you are <strong>not signed in</strong>, we convert your file first, then ask you to <strong>sign in</strong>{' '}
                before the .docx downloads (same as other download tools when accounts are enabled). Files stay on the line
                while converting — keep this tab open.
              </p>
            )}
          </>
        ) : capsStatus === 'ready' && !caps?.pdfToDocx ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-6 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300">
            <p className="m-0 font-medium text-zinc-900 dark:text-zinc-100">PDF → Word not configured</p>
            <p className="mt-2 mb-0">
              Your API answered, but PDF → Word needs{' '}
              <code className="rounded bg-zinc-200 px-1 font-mono text-xs dark:bg-zinc-800">SOFFICE_PATH</code> set to your
              LibreOffice <code className="font-mono text-xs">soffice</code> binary on <strong>that</strong> server (same as
              Edit PDF’s PDF → Word export). Gotenberg is not used for this direction. Redeploy the API after setting the
              variable.
            </p>
          </div>
        ) : null}

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

        {actionError && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-start sm:justify-between dark:border-red-900 dark:bg-red-950/50 dark:text-red-100"
          >
            <p className="m-0 flex-1 leading-relaxed">{actionError}</p>
            <button
              type="button"
              className="shrink-0 self-end rounded-lg border border-red-300/80 bg-white/90 px-3 py-1.5 text-xs font-medium text-red-900 shadow-sm hover:bg-red-50 dark:border-red-800 dark:bg-red-950/80 dark:text-red-100 dark:hover:bg-red-900/60"
              onClick={() => setActionError(null)}
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
          </Link>
          . Edit text in place on a PDF?{' '}
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
