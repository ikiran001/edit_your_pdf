import { useCallback, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { Trash2 } from 'lucide-react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import {
  compressPdfBytes,
  normalizeCompressionLevel,
} from '../../lib/pdfCompressCore.js'

const TOOL = ANALYTICS_TOOL.compress_pdf

const LEVEL_INFO = {
  low: {
    label: 'Low',
    hint: 'Light rewrite; best when you want minimal structural change.',
  },
  medium: {
    label: 'Medium',
    hint: 'Balanced: enables object streams (often smaller).',
  },
  high: {
    label: 'High',
    hint: 'Copies pages into a fresh document; can remove overhead.',
  },
}

function formatBytes(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function pctSaved(original, compressed) {
  if (!original || original <= 0 || compressed == null) return null
  return Math.round((1 - compressed / original) * 100)
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
  const [items, setItems] = useState([])
  const [level, setLevel] = useState('medium')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

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
  }

  const runCompress = async () => {
    if (!items.length) {
      setError('Add at least one PDF.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const next = []
      for (const it of items) {
        const buf = new Uint8Array(await it.file.arrayBuffer())
        const out = await compressPdfBytes(buf, normalizedLevel)
        next.push({
          ...it,
          compressedSize: out.byteLength,
          compressedBytes: out,
        })
      }
      setItems(next)
      setSuccess('Compression finished. Review sizes below, then download.')
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Could not compress PDF(s).')
    } finally {
      setBusy(false)
    }
  }

  const downloadOne = (it) => {
    if (!it.compressedBytes) return
    const blob = new Blob([it.compressedBytes], { type: 'application/pdf' })
    downloadBlob(blob, outputName(it.file.name))
  }

  const downloadAll = async () => {
    const ready = items.filter((x) => x.compressedBytes)
    if (!ready.length) return
    if (ready.length === 1) {
      downloadOne(ready[0])
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
  }

  const totalOriginal = items.reduce((s, x) => s + (x.originalSize || 0), 0)
  const totalCompressed = items.every((x) => x.compressedSize != null)
    ? items.reduce((s, x) => s + (x.compressedSize || 0), 0)
    : null
  const totalSavedPct =
    totalCompressed != null ? pctSaved(totalOriginal, totalCompressed) : null

  return (
    <ToolPageShell
      title="Compress PDF"
      subtitle="Shrink PDFs in your browser. Pick a level, compare sizes, then download or grab a ZIP for batches."
    >
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          {success}
        </div>
      )}

      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Uses pdf-lib locally. How much smaller files get depends on the PDF; some may only change
        slightly.
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
                      prev.map((x) => ({ ...x, compressedSize: null, compressedBytes: null }))
                    )
                    setSuccess(null)
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

      <FileDropzone
        accept="application/pdf"
        multiple
        disabled={busy}
        onFiles={addFiles}
        label={busy ? 'Compressing…' : 'Drop PDFs here or click to add (batch supported)'}
      />

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
                  const saved = pctSaved(it.originalSize, it.compressedSize)
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
                        {saved == null ? (
                          '—'
                        ) : saved >= 0 ? (
                          <span className="text-emerald-700 dark:text-emerald-400">{saved}%</span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400" title="Output can be larger after rewrite">
                            +{Math.abs(saved)}% larger
                          </span>
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
                      {totalSavedPct == null ? (
                        '—'
                      ) : totalSavedPct >= 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {totalSavedPct}%
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">
                          +{Math.abs(totalSavedPct)}% larger
                        </span>
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
                onClick={() => downloadAll()}
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
