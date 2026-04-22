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
  /** loading | ready | error — avoids showing “converter not configured” before we know, or on fetch failure */
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
  /** Short-lived confirmation after a successful conversion + download trigger. */
  const [successHint, setSuccessHint] = useState(null)

  useToolEngagement(WORD_TO_PDF_TOOL, true)

  useEffect(() => {
    document.title = DOC_TITLE
    pageView('/tools/word-to-pdf', DOC_TITLE)
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

  const onDocx = useCallback(async (file) => {
    if (!file) return
    if (import.meta.env.PROD && !isApiBaseConfigured()) {
      setActionError(
        'Set VITE_API_BASE_URL when building the frontend so uploads reach your API.'
      )
      return
    }
    setActionError(null)
    setSuccessHint(null)
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      /* Server may retry Gotenberg cold starts (502/503/504); allow several minutes before the browser gives up. */
      const r = await fetch(apiUrl('/document-flow/convert-docx-to-pdf'), {
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
      const base = (file.name || 'document').replace(/\.docx$/i, '') || 'document'
      const outName = `${base}.pdf`
      triggerDownloadBlob(blob, outName)
      setSuccessHint(
        `“${outName}” should appear in your downloads. If nothing happens, allow downloads for this site or check the toolbar.`
      )
      trackFileDownloaded({
        tool: WORD_TO_PDF_TOOL,
        file_size: blob.size / 1024,
        total_pages: 1,
      })
      trackToolCompleted(WORD_TO_PDF_TOOL, true)
    } catch (e) {
      trackErrorOccurred(WORD_TO_PDF_TOOL, e?.message || 'convert_docx_failed')
      let msg = e?.message || 'Conversion failed'
      if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
        msg =
          'Conversion timed out in the browser. If you use Gotenberg, the service may still be cold-starting—try again in a minute or add more RAM. If you use LibreOffice on the API, very large .docx files can also exceed the client wait — try a smaller file or increase timeout.'
      } else if (/Failed to fetch|NetworkError|load failed|CORS/i.test(msg)) {
        msg =
          'Could not reach the API from this site. Confirm GitHub Actions rebuilt the site after setting VITE_API_BASE_URL, and that the API allows your domain (CORS). Open /document-flow/capabilities on the API host in a new tab to verify it is up.'
      } else if (/50[234]|Bad Gateway|Gateway|ECONNRESET/i.test(msg)) {
        msg +=
          ' If conversion goes through Gotenberg, repeated gateway errors often mean that service is out of memory or sleeping—use gotenberg/gotenberg:8-libreoffice and a larger Render plan, or switch to SOFFICE_PATH on the API server.'
      }
      setActionError(msg)
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
      subtitle="Turn a Word document into a PDF in one step — upload here, download when it’s ready."
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

        {capsStatus === 'ready' && caps?.docxToPdf ? (
          <>
            {caps?.docxToPdfFallbackLibreOffice && caps?.gotenbergHealthHint ? (
              <p className="m-0 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100">
                <span className="font-medium">You’re all set.</span> Conversion runs on this app’s server. An optional
                backup service is temporarily unavailable — that only affects automatic failover, not this upload.
              </p>
            ) : null}
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
              label={busy ? 'Converting your document…' : 'Drop your .docx here, or click to choose a file'}
              hint="Microsoft Word .docx only — up to about 52 MB. Complex layouts may shift slightly in the PDF."
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
                  <span className="font-medium">Working on your PDF…</span>
                </p>
                <p className="m-0 text-xs leading-relaxed text-sky-900/85 dark:text-sky-100/85">
                {caps?.docxToPdfViaSoffice &&
                (!caps?.docxToPdfViaGotenberg ||
                  !caps?.gotenbergReachable ||
                  caps?.docxToPdfFallbackLibreOffice) ? (
                  <>
                    Converting with <strong>LibreOffice</strong> on this server. Large documents can take a few
                    minutes — please keep this tab open.
                  </>
                ) : caps?.docxToPdfViaSoffice && caps?.docxToPdfViaGotenberg && caps?.gotenbergReachable ? (
                  <>
                    The API tries <strong>LibreOffice</strong> on this server first; if that fails it falls back to
                    your <strong>Gotenberg</strong> service (which may need <strong>30–90 seconds</strong> to wake after
                    idle). Please keep this tab open.
                  </>
                ) : (
                  <>
                    The converter runs on a <strong>separate</strong> cloud service. After idle it may need{' '}
                    <strong>30–90 seconds</strong> to wake up; the API retries automatically. Please keep this tab open.
                  </>
                )}
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                Files stay on the line while converting — you can leave this tab open and grab the download when it
                appears.
                {caps?.docxToPdfViaSoffice && !caps?.docxToPdfViaGotenberg ? (
                  <>
                    {' '}
                    Runs on <strong>this app’s server</strong> (no extra “converter” site to manage).
                  </>
                ) : null}
              </p>
            )}
          </>
        ) : capsStatus === 'ready' && !caps?.docxToPdf ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-6 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300">
            <p className="m-0 font-medium text-zinc-900 dark:text-zinc-100">Converter not configured</p>
            {caps?.gotenbergSameHostAsApi ? (
              <p className="mt-2 mb-0 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <strong className="font-medium">GOTENBERG_URL must not be this API’s URL.</strong> It has to be
                your separate <strong>Gotenberg</strong> service (another{' '}
                <code className="font-mono text-xs">*.onrender.com</code> URL). A mistaken self-URL causes
                “404” on convert because Express does not expose Gotenberg’s routes.
              </p>
            ) : null}
            {caps?.gotenbergHealthHint ? (
              <p className="mt-2 mb-0 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
                {caps.gotenbergHealthHint}
              </p>
            ) : null}
            <p className="mt-2 mb-0">
              Your API answered, but Word → PDF is off on <strong>that</strong> server. Either set{' '}
              <code className="rounded bg-zinc-200 px-1 font-mono text-xs dark:bg-zinc-800">SOFFICE_PATH</code> to
              your LibreOffice <code className="font-mono text-xs">soffice</code> binary so conversion runs on the API
              (same variable as PDF → Word), <strong>or</strong> set{' '}
              <code className="rounded bg-zinc-200 px-1 font-mono text-xs dark:bg-zinc-800">GOTENBERG_URL</code>{' '}
              (full <code className="font-mono text-xs">https://…</code> base URL to a separate Gotenberg service) or{' '}
              <code className="font-mono text-xs">GOTENBERG_HOSTPORT</code>, then redeploy. With both set, the API
              tries LibreOffice first and uses Gotenberg only if that fails. Render Blueprint:{' '}
              <code className="font-mono text-xs">render.yaml</code> can wire{' '}
              <code className="font-mono text-xs">GOTENBERG_URL</code> when service names match; otherwise paste the URL
              under Environment. See{' '}
              <a
                className="text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400"
                href="https://gotenberg.dev/"
                target="_blank"
                rel="noreferrer"
              >
                Gotenberg
              </a>
              . Local dev: <code className="font-mono text-xs">docker-compose.document-flow.yml</code>.
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
