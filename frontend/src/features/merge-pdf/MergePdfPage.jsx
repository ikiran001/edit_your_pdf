import { useCallback, useState } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { mergePdfsToUint8 } from '../../lib/pdfMergeSplitCore.js'

const TOOL = ANALYTICS_TOOL.pdf_merge

function downloadUint8(u8, name) {
  const blob = new Blob([u8], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export default function MergePdfPage() {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [dragId, setDragId] = useState(null)

  useToolEngagement(TOOL, true)

  const addFiles = useCallback((files) => {
    const pdfs = [...files].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
    if (!pdfs.length) {
      setError('Add at least one PDF file.')
      return
    }
    setError(null)
    setSuccess(null)
    setItems((prev) => [
      ...prev,
      ...pdfs.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
      })),
    ])
  }, [])

  const remove = (id) => setItems((prev) => prev.filter((x) => x.id !== id))

  const onDragStart = (id) => setDragId(id)
  const onDragOver = (e) => e.preventDefault()
  const onDropOn = (targetId) => {
    if (dragId == null || dragId === targetId) return
    setItems((prev) => {
      const a = prev.findIndex((x) => x.id === dragId)
      const b = prev.findIndex((x) => x.id === targetId)
      if (a < 0 || b < 0) return prev
      const next = [...prev]
      const [m] = next.splice(a, 1)
      next.splice(b, 0, m)
      return next
    })
    setDragId(null)
  }

  const merge = async () => {
    if (!items.length) {
      setError('Add at least one PDF to merge.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const ordered = items.map((x) => x.file)
      const out = await mergePdfsToUint8(ordered)
      downloadUint8(out, 'merged.pdf')
      setSuccess('Merged PDF downloaded as merged.pdf.')
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Could not merge PDFs.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolPageShell
      title="Merge PDF"
      subtitle="Combine multiple PDFs in order. All processing runs in your browser."
    >
      <FileDropzone
        accept="application/pdf"
        multiple
        disabled={busy}
        onFiles={addFiles}
        label={busy ? 'Merging…' : 'Drop PDFs here or click to add'}
      />
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
      <ToolFeatureSeoSection toolId="merge-pdf" />

      {items.length > 0 && (
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-inner dark:border-zinc-700 dark:bg-zinc-900/50">
          <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Merge order</h3>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">Drag rows to reorder.</p>
          <ul className="space-y-2">
            {items.map((it, idx) => (
              <li
                key={it.id}
                draggable
                onDragStart={() => onDragStart(it.id)}
                onDragOver={onDragOver}
                onDrop={() => onDropOn(it.id)}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
              >
                <GripVertical className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
                <span className="w-8 text-center text-xs font-medium text-zinc-500">{idx + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">
                  {it.file.name}
                </span>
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={merge}
            className="mt-6 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 disabled:opacity-50 sm:w-auto sm:px-10"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Merging…
              </span>
            ) : (
              'Merge PDFs'
            )}
          </button>
        </div>
      )}
    </ToolPageShell>
  )
}
