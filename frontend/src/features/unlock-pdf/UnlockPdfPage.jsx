import { useState } from 'react'
import { apiUrl, isApiBaseConfigured } from '../../lib/apiBase'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
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

const UNLOCK_TOOL = ANALYTICS_TOOL.unlock_pdf

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export default function UnlockPdfPage() {
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useToolEngagement(UNLOCK_TOOL, true)

  const unlock = async () => {
    if (!file) {
      setError('Choose a PDF first.')
      return
    }
    if (!password) {
      setError('Enter the document password.')
      return
    }
    if (import.meta.env.PROD && !isApiBaseConfigured()) {
      setError(
        'Unlock PDF requires the API (qpdf on the server). Set VITE_API_BASE_URL for production builds, or run locally with the backend on port 3001.'
      )
      return
    }

    setBusy(true)
    setError(null)
    const inputLabel = file.name || '(unnamed.pdf)'
    console.log('[unlock-pdf] input file:', inputLabel, 'size:', file.size)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('password', password)

      const url = apiUrl('/unlock-pdf')
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
        if (res.status === 401) {
          console.warn('[unlock-pdf] password validation: FAILED')
        } else {
          console.warn('[unlock-pdf] request failed:', res.status, msg)
        }
        trackErrorOccurred(UNLOCK_TOOL, msg || `http_${res.status}`)
        setError(msg)
        return
      }

      if (!contentType.includes('application/pdf')) {
        const text = await res.text()
        console.warn('[unlock-pdf] unexpected response:', contentType, text.slice(0, 200))
        trackErrorOccurred(UNLOCK_TOOL, 'unexpected_response_type')
        setError('Server did not return a PDF. Is the API running with qpdf installed?')
        return
      }

      const blob = await res.blob()
      const outName = `unlocked_${Date.now()}.pdf`
      console.log('[unlock-pdf] password validation: OK')
      console.log('[unlock-pdf] output file:', outName, 'bytes:', blob.size)
      downloadBlob(blob, outName)
      trackToolCompleted(UNLOCK_TOOL, true)
      trackFileDownloaded({
        tool: UNLOCK_TOOL,
        file_size: blob.size / 1024,
      })
      const elapsed =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
      trackProcessingTime(UNLOCK_TOOL, elapsed)
    } catch (e) {
      console.error('[unlock-pdf]', e)
      trackErrorOccurred(
        UNLOCK_TOOL,
        e?.message === 'Failed to fetch' ? 'fetch_failed' : e?.message || 'unlock_failed'
      )
      setError(e?.message === 'Failed to fetch' ? 'Could not reach the API. Start the backend (port 3001) or check your network.' : e?.message || 'Could not unlock PDF')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolPageShell title="Unlock PDF" subtitle="Decrypt with the document password and download a copy with encryption removed (server uses qpdf).">
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={(f) => {
          const next = f[0]
          if (next) {
            markFunnelUpload(UNLOCK_TOOL)
            trackFileUploaded({
              file_type: 'pdf',
              file_size: next.size / 1024,
              tool: UNLOCK_TOOL,
            })
          }
          setFile(next)
        }}
        label={file ? file.name : 'Drop encrypted PDF here'}
      />
      <div className="mt-6 max-w-md">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          placeholder="Document password"
        />
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={unlock}
        className="mt-6 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
      >
        {busy ? 'Unlocking…' : 'Unlock and download'}
      </button>
      <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
        The PDF is decrypted and rewritten on the server with{' '}
        <a
          className="text-indigo-600 underline dark:text-indigo-400"
          href="https://qpdf.sourceforge.io/"
          target="_blank"
          rel="noopener noreferrer"
        >
          qpdf
        </a>{' '}
        (must be installed where the API runs). Production sites need a hosted API with qpdf on PATH.
      </p>
    </ToolPageShell>
  )
}
