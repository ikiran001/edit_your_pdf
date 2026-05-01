import { useCallback, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { Trash2 } from 'lucide-react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import { trackEvent } from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import {
  compressPdfBytes,
  normalizeCompressionLevel,
} from '../../lib/pdfCompressCore.js'
import { getResolvedApiBase } from '../../lib/apiBase.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'

const TOOL = ANALYTICS_TOOL.compress_pdf

const LEVEL_INFO = {
  low: {
    label: 'Low',
    hint: 'qpdf only — lighter rewrite; smallest CPU use.',
  },
  medium: {
    label: 'Medium',
    hint: 'qpdf + Ghostscript /ebook — strong shrink on scans & mixed PDFs.',
  },
  high: {
    label: 'High',
    hint: 'qpdf + Ghostscript /screen — maximum size reduction (may soften images).',
  },
}

function formatBytes(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

/** @returns {{ text: string, tone: 'good' | 'warn' | 'muted' } | null} */
function savedPctDisplay(original, compressed) {
  if (!original || original <= 0 || compressed == null) return null
  const pct = (1 - compressed / original) * 100
  if (pct < -0.0001) {
    const q = Math.abs(pct)
    return {
      text: `+${q < 10 ? q.toFixed(1) : Math.round(q)}% larger`,
      tone: 'warn',
    }
  }
  if (pct <= 0) return { text: '0%', tone: 'muted' }
  if (pct < 1) return { text: `${pct.toFixed(2)}%`, tone: 'good' }
  if (pct < 10) return { text: `${pct.toFixed(1)}%`, tone: 'good' }
  return { text: `${Math.round(pct)}%`, tone: 'good' }
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

function outputName(originalName) {
  const base = originalName.replace(/\.pdf$/i, '') || 'document'
  return `${base}-compressed.pdf`
}

export default function CompressPdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [items, setItems] = useState([])
  const [level, setLevel] = useState('medium')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  /** True when qpdf API was not used (browser-only pdf-lib path — sizes often unchanged). */
  const [usedFallbackOnly, setUsedFallbackOnly] = useState(false)

  const prodApiMissing = import.meta.env.PROD && !getResolvedApiBase()

  useToolEngagement(TOOL, true)

  const normalizedLevel = useMemo(() => normalizeCompressionLevel(level), [level])

  const addFiles = useCallback((files) => {
    const pdfs = [...files].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
    if (!pdfs.length) {
      setError('Add at least one PDF file.')
      return
    }
    setError(null)
    setSuccess(null)
    setUsedFallbackOnly(false)
    setItems((prev) => {
      const seen = new Set(prev.map((p) => `${p.file.name}-${p.file.size}`))
      const next = [...prev]
      for (const file of pdfs) {
        const key = `${file.name}-${file.size}`
        if (seen.has(key)) continue
        seen.add(key)
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          originalSize: file.size,
          compressedSize: null,
          compressedBytes: null,
        })
      }
      return next
    })
  }, [])

  const remove = (id) => {
    setItems((prev) => prev.filter((x) => x.id !== id))
    setSuccess(null)
    setUsedFallbackOnly(false)
  }

  const runCompress = async () => {
    if (!items.length) {
      setError('Add at least one PDF.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    setUsedFallbackOnly(false)
    try {
      const next = []
      for (const it of items) {
        const buf = new Uint8Array(await it.file.arrayBuffer())
        const out = await compressPdfBytes(buf, normalizedLevel, { fileName: it.file.name })
        next.push({
          ...it,
          compressedSize: out.bytes.byteLength,
          compressedBytes: out.bytes,
          compressedVia: out.via,
        })
      }
      setItems(next)
      const anyFallback = next.some((x) => x.compressedVia === 'fallback')
      setUsedFallbackOnly(anyFallback)
      const paths = next.map((x) => x.compressedVia || 'fallback')
      const mode =
        paths.every((p) => p === 'api')
          ? 'api_only'
          : paths.every((p) => p === 'fallback')
            ? 'fallback_only'
            : 'mixed'
      trackEvent('compress_pdf_path', { mode })
      if (anyFallback) {
        setSuccess(
          'Done — but the server compressor (qpdf) was not used, so sizes may not drop. For real compression: run the backend locally (port 3001) or set VITE_API_BASE_URL on your production build.'
        )
      } else {
        setSuccess('Compression finished. Review sizes below, then download.')
      }
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Could not compress PDF(s).')
    } finally {
      setBusy(false)
    }
  }

  const downloadAll = useCallback(async () => {
    const ready = items.filter((x) => x.compressedBytes)
    if (!ready.length) return
    try {
      await runWithSignInForDownload(
        async () => {
          if (ready.length === 1) {
            const it = ready[0]
            if (!it.compressedBytes) return
            const blob = new Blob([it.compressedBytes], { type: 'application/pdf' })
            downloadBlob(blob, outputName(it.file.name))
            return
          }
          const zip = new JSZip()
          const used = new Set()
          ready.forEach((it) => {
            const base = it.file.name.replace(/\.pdf$/i, '') || 'document'
            let candidate = `${base}-compressed.pdf`
            let n = 1
            while (used.has(candidate)) {
              n += 1
              candidate = `${base}-${n}-compressed.pdf`
            }
            used.add(candidate)
            zip.file(candidate, it.compressedBytes)
          })
          const blob = await zip.generateAsync({ type: 'blob' })
          downloadBlob(blob, 'compressed-pdfs.zip')
        },
        { onAuthLoading: () => setError('Still checking sign-in… try again in a moment.') }
      )
    } catch (e) {
      if (e?.code === 'EYP_AUTH_CANCELLED') return
      if (e?.code === 'EYP_AUTH_LOADING') {
        setError(e.message || 'Still checking sign-in.')
      } else {
        console.error(e)
        setError(e?.message || 'Download failed.')
      }
    }
  }, [items, runWithSignInForDownload])

  const totalOriginal = items.reduce((s, x) => s + (x.originalSize || 0), 0)
  const totalCompressed = items.every((x) => x.compressedSize != null)
    ? items.reduce((s, x) => s + (x.compressedSize || 0), 0)
    : null
  const totalSavedDisplay =
    totalCompressed != null && totalOriginal > 0
      ? savedPctDisplay(totalOriginal, totalCompressed)
      : null

  return (
    <ToolPageShell
      title="Compress PDF"
      subtitle="Server: qpdf plus Ghostscript on Medium/High for real size cuts. Pick a level, compare sizes, then download."
    >
      <FileDropzone
        accept="application/pdf"
        multiple
        disabled={busy}
        onFiles={addFiles}
        label={busy ? 'Compressing…' : 'Drop PDFs here or click to add (batch supported)'}
      />
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            usedFallbackOnly
              ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100'
          }`}
        >
          {success}
        </div>
      )}
      {prodApiMissing && (
        <div
          role="note"
          className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-100"
        >
          <strong className="font-semibold">Production:</strong> this static build has no API base URL. Compress
          will use the browser fallback only (often <strong className="font-semibold">no size change</strong>
          ). Set <code className="rounded bg-rose-100/90 px-1 font-mono text-xs dark:bg-rose-900/80">VITE_API_BASE_URL</code>{' '}
          to your deployed API (same as Edit PDF / OCR) and redeploy.
        </div>
      )}
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        The API runs <strong className="font-semibold text-zinc-800 dark:text-zinc-100">qpdf</strong> first,
        then <strong className="font-semibold text-zinc-800 dark:text-zinc-100">Ghostscript</strong> on{' '}
        <strong className="font-semibold">Medium</strong> / <strong className="font-semibold">High</strong> for
        real downsampling (needs backend + Ghostscript). Low = qpdf only. Without the API (
        <code className="rounded bg-zinc-200/80 px-1 text-xs dark:bg-zinc-700">VITE_API_BASE_URL</code>
        ), the browser falls back to pdf-lib — sizes rarely move much.
      </p>

      <fieldset className="mb-6 rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
        <legend className="px-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Compression level
        </legend>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {(['low', 'medium', 'high']).map((key) => (
            <label
              key={key}
              className={`flex cursor-pointer flex-1 flex-col rounded-xl border px-3 py-2 text-sm transition ${
                level === key
                  ? 'border-indigo-500 bg-indigo-50/80 dark:border-cyan-500 dark:bg-indigo-950/40'
                  : 'border-zinc-200 hover:border-indigo-300 dark:border-zinc-600'
              }`}
            >
              <span className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                <input
                  type="radio"
                  name="compress-level"
                  value={key}
                  checked={level === key}
                  onChange={() => {
                    setLevel(key)
                    setItems((prev) =>
                      prev.map((x) => ({
                        ...x,
                        compressedSize: null,
                        compressedBytes: null,
                        compressedVia: undefined,
                      }))
                    )
                    setSuccess(null)
                    setUsedFallbackOnly(false)
                  }}
                  className="text-indigo-600"
                />
                {LEVEL_INFO[key].label}
              </span>
              <span className="mt-1 pl-6 text-xs text-zinc-500 dark:text-zinc-400">
                {LEVEL_INFO[key].hint}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <ToolFeatureSeoSection toolId="compress-pdf" />

      {items.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white/80 shadow-inner dark:border-zinc-700 dark:bg-zinc-900/50">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">File</th>
                  <th className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                    Original
                  </th>
                  <th className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                    Compressed
                  </th>
                  <th className="hidden px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-400 sm:table-cell">
                    Saved
                  </th>
                  <th className="w-12 px-2 py-3" aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const saved = savedPctDisplay(it.originalSize, it.compressedSize)
                  return (
                    <tr
                      key={it.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                    >
                      <td className="max-w-[200px] truncate px-4 py-2 font-medium text-zinc-800 dark:text-zinc-200">
                        {it.file.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {formatBytes(it.originalSize)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {it.compressedSize != null ? formatBytes(it.compressedSize) : '—'}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-2 sm:table-cell">
                        {!saved ? (
                          '—'
                        ) : saved.tone === 'warn' ? (
                          <span className="text-amber-700 dark:text-amber-400" title="Output can be larger after rewrite">
                            {saved.text}
                          </span>
                        ) : saved.tone === 'muted' ? (
                          <span className="text-zinc-500 dark:text-zinc-400">{saved.text}</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">{saved.text}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => remove(it.id)}
                          disabled={busy}
                          className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40"
                          aria-label="Remove file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {items.length > 1 && (
                <tfoot>
                  <tr className="border-t border-zinc-200 bg-zinc-50/80 font-medium dark:border-zinc-700 dark:bg-zinc-900/80">
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">Total</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {formatBytes(totalOriginal)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {totalCompressed != null ? formatBytes(totalCompressed) : '—'}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {!totalSavedDisplay ? (
                        '—'
                      ) : totalSavedDisplay.tone === 'warn' ? (
                        <span className="text-amber-700 dark:text-amber-400">{totalSavedDisplay.text}</span>
                      ) : totalSavedDisplay.tone === 'muted' ? (
                        <span className="text-zinc-500 dark:text-zinc-400">{totalSavedDisplay.text}</span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400">{totalSavedDisplay.text}</span>
                      )}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              disabled={busy}
              onClick={runCompress}
              className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Compressing…
                </span>
              ) : (
                'Compress'
              )}
            </button>

            {items.some((x) => x.compressedBytes) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void downloadAll()}
                className="rounded-xl border border-indigo-200 bg-white px-8 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/40 dark:bg-zinc-900 dark:text-cyan-300 dark:hover:bg-indigo-950/50"
              >
                {items.filter((x) => x.compressedBytes).length === 1
                  ? 'Download compressed PDF'
                  : 'Download ZIP'}
              </button>
            )}
          </div>
        </div>
      )}
    </ToolPageShell>
  )
}
