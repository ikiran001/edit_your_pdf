import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
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

  const onDocx = useCallback(async (file) => {
    if (!file) return
    if (import.meta.env.PROD && !isApiBaseConfigured()) {
      setActionError(
        'Set VITE_API_BASE_URL when building the frontend so uploads reach your API.'
      )
      return
    }
    setActionError(null)
    setBusy(true)
    try {
      await runWithSignInForDownload(
        async () => {
          const fd = new FormData()
          fd.append('file', file)
          /* Server may retry Gotenberg cold starts (502/503/504); allow several minutes before the browser gives up. */
          const r = await fetch(apiUrl('/document-flow/convert-docx-to-pdf'), {
            method: 'POST',
            body: fd,
            signal: AbortSignal.timeout(600_000),
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
        },
        { onAuthLoading: () => setActionError('Still checking sign-in… try again in a moment.') }
      )
    } catch (e) {
      if (e?.code === 'EYP_AUTH_CANCELLED') {
        /* dismissed */
      } else if (e?.code === 'EYP_AUTH_LOADING') {
        setActionError(e.message || 'Still checking sign-in.')
      } else {
        trackErrorOccurred(WORD_TO_PDF_TOOL, e?.message || 'convert_docx_failed')
        let msg = e?.message || 'Conversion failed'
        if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
          msg =
            'Conversion timed out in the browser. The server may still be waking the converter—try again in a minute, or upgrade your Gotenberg instance on Render (more RAM / paid plan).'
        } else if (/50[234]|Bad Gateway|Gateway|ECONNRESET/i.test(msg)) {
          msg +=
            ' Repeated gateway errors usually mean the Gotenberg service is out of memory or sleeping—use gotenberg/gotenberg:8-libreoffice and a larger Render plan for that service.'
        }
        setActionError(msg)
      }
    } finally {
      setBusy(false)
    }
  }, [runWithSignInForDownload])

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

        {capsStatus === 'loading' && (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            Checking converter…
          </p>
        )}

        {capsStatus === 'ready' && caps?.docxToPdf ? (
          <>
            <FileDropzone
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple={false}
              disabled={busy}
              onFiles={onDocxFiles}
              label={busy ? 'Converting…' : 'Drop your Word file here or click to browse'}
            />
            {busy ? (
              <p className="rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-center text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-100">
                The converter runs on a <strong>separate</strong> cloud service. After idle it may need{' '}
                <strong>30–90 seconds</strong> to wake up; the API retries automatically. Please keep this tab
                open.
              </p>
            ) : (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                One <strong>.docx</strong> at a time (Microsoft Word or compatible). Layout may shift slightly
                in the PDF.
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
              Your API answered, but Word → PDF is off on <strong>that</strong> server: set{' '}
              <code className="rounded bg-zinc-200 px-1 font-mono text-xs dark:bg-zinc-800">GOTENBERG_URL</code>{' '}
              (full <code className="font-mono text-xs">https://…</code> base URL to Gotenberg) or{' '}
              <code className="font-mono text-xs">GOTENBERG_HOSTPORT</code> in the environment of the{' '}
              <strong>Node API</strong> process, then redeploy. With Render Blueprints,{' '}
              <code className="font-mono text-xs">render.yaml</code> wires{' '}
              <code className="font-mono text-xs">GOTENBERG_URL</code> from the Gotenberg service only if your
              Render service <strong>names</strong> match <code className="font-mono text-xs">render.yaml</code>{' '}
              (API <code className="font-mono text-xs">name</code> = your{' '}
              <code className="font-mono text-xs">*.onrender.com</code> service name, plus{' '}
              <code className="font-mono text-xs">pdfpilot-gotenberg</code>); otherwise paste your Gotenberg URL
              manually under Environment. See{' '}
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
