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

const REPAIR_TOOL = ANALYTICS_TOOL.repair_pdf

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export default function RepairPdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fileReadyHint, setFileReadyHint] = useState(null)

  useToolEngagement(REPAIR_TOOL, true)

  const repair = async () => {
    if (!file) {
      setError('Choose a PDF first.')
      return
    }
    if (import.meta.env.PROD && !isApiBaseConfigured()) {
      setError(
        'Repair needs the online document service, which is not available from this build. Try again later.'
      )
      return
    }

    setBusy(true)
    setError(null)
    setFileReadyHint(null)
    const inputLabel = file.name || '(unnamed.pdf)'
    console.log('[repair-pdf] input file:', inputLabel, 'size:', file.size)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()

    try {
      await runWithSignInForDownload(
        async () => {
          const fd = new FormData()
          fd.append('file', file)
          if (password.trim()) {
            fd.append('password', password)
          }

          const url = apiUrl('/repair-pdf')
          const res = await fetch(url, { method: 'POST', body: fd, credentials: 'include' })

          const contentType = res.headers.get('Content-Type') || ''

          if (!res.ok) {
            let msg = res.statusText || 'Request failed'
            if (contentType.includes('application/json')) {
              try {
                const j = await res.json()
                if (j?.error) msg = j.error
              } catch {
                /* ignore */
              }
            }
            console.warn('[repair-pdf] request failed:', res.status, msg)
            trackErrorOccurred(REPAIR_TOOL, msg || `http_${res.status}`)
            setError(msg)
            return
          }

          if (!contentType.includes('application/pdf')) {
            const text = await res.text()
            console.warn('[repair-pdf] unexpected response:', contentType, text.slice(0, 200))
            trackErrorOccurred(REPAIR_TOOL, 'unexpected_response_type')
            setError('Server did not return a PDF. Is the API running with qpdf installed?')
            return
          }

          const blob = await res.blob()
          const outName = `repaired_${Date.now()}.pdf`
          console.log('[repair-pdf] output file:', outName, 'bytes:', blob.size)
          downloadBlob(blob, outName)
          setFileReadyHint(MSG.fileReady)
          window.setTimeout(() => setFileReadyHint(null), 6000)
          trackToolCompleted(REPAIR_TOOL, true)
          trackFileDownloaded({
            tool: REPAIR_TOOL,
            file_size: blob.size / 1024,
          })
          const elapsed =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          trackProcessingTime(REPAIR_TOOL, elapsed)
        },
        { onAuthLoading: () => setError('Still checking sign-in… try again in a moment.') }
      )
    } catch (e) {
      if (e?.code === 'EYP_AUTH_CANCELLED') {
        /* dismissed */
      } else if (e?.code === 'EYP_AUTH_LOADING') {
        setError(e.message || 'Still checking sign-in.')
      } else {
        console.error('[repair-pdf]', e)
        trackErrorOccurred(
          REPAIR_TOOL,
          e?.message === 'Failed to fetch' ? 'fetch_failed' : e?.message || 'repair_failed'
        )
        setError(
          e?.message === 'Failed to fetch'
            ? 'Could not reach the server. Check your connection and try again.'
            : e?.message || 'Could not repair PDF'
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolPageShell
      title="Repair PDF"
      subtitle="Rewrite a damaged or malformed PDF through qpdf on your API — normalization first, then a page rebuild if needed."
    >
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={(f) => {
          const next = f[0]
          if (next) {
            markFunnelUpload(REPAIR_TOOL)
            trackFileUploaded({
              file_type: 'pdf',
              file_size: next.size / 1024,
              tool: REPAIR_TOOL,
            })
          }
          setFile(next)
          setFileReadyHint(null)
        }}
        label={file ? file.name : 'Drop PDF here'}
      />
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
      <div className="mt-6 max-w-md">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Open password (optional)
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          placeholder="Only if the PDF is encrypted"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Encrypted files need the same password you use to open them in a reader.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={repair}
        className="mt-6 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
      >
        {busy ? MSG.processingFile : 'Repair and download'}
      </button>
      <ToolFeatureSeoSection toolId="repair-pdf" />
      <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
        Repair runs on your configured API with{' '}
        <a
          className="text-indigo-600 underline dark:text-indigo-400"
          href="https://qpdf.readthedocs.io/"
          target="_blank"
          rel="noopener noreferrer"
        >
          qpdf
        </a>
        . It cannot fix every corrupted file; severe damage may still need desktop tools.
      </p>
    </ToolPageShell>
  )
}
