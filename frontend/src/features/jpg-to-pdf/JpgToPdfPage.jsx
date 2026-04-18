import { useCallback, useRef, useState } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
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
import { imagesToPdfBytes } from './jpgToPdfCore.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'

const MERGE_TOOL = ANALYTICS_TOOL.merge_pdf

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

export default function JpgToPdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [dragId, setDragId] = useState(null)
  const funnelMarkedRef = useRef(false)
  const [fileReadyHint, setFileReadyHint] = useState(null)

  useToolEngagement(MERGE_TOOL, true)

  const addFiles = useCallback((files) => {
    const imageFiles = files.filter(
      (f) =>
        f.type.startsWith('image/jpeg') ||
        f.type.startsWith('image/jpg') ||
        f.type.startsWith('image/png')
    )
    if (imageFiles.length) {
      if (!funnelMarkedRef.current) {
        funnelMarkedRef.current = true
        markFunnelUpload(MERGE_TOOL)
      }
      const batchKb = imageFiles.reduce((s, f) => s + f.size, 0) / 1024
      trackFileUploaded({
        file_type: 'image',
        file_size: batchKb,
        tool: MERGE_TOOL,
      })
    }
    setItems((prev) => [
      ...prev,
      ...imageFiles.map((file) => ({
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

  const buildPdf = async () => {
    if (!items.length) return
    setError(null)
    setFileReadyHint(null)
    setBusy(true)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      await runWithSignInForDownload(
        async () => {
          const ordered = items.map((x) => x.file)
          const bytes = await imagesToPdfBytes(ordered)
          downloadUint8(bytes, 'images.pdf')
          trackToolCompleted(MERGE_TOOL, true)
          trackFileDownloaded({
            tool: MERGE_TOOL,
            file_size: bytes.byteLength / 1024,
            total_pages: ordered.length,
          })
          const elapsed =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          trackProcessingTime(MERGE_TOOL, elapsed)
          setFileReadyHint(MSG.fileReady)
          window.setTimeout(() => setFileReadyHint(null), 6000)
        },
        { onAuthLoading: () => setError('Still checking sign-in… try again in a moment.') }
      )
    } catch (e) {
      if (e?.code === 'EYP_AUTH_CANCELLED') {
        /* dismissed */
      } else if (e?.code === 'EYP_AUTH_LOADING') {
        setError(e.message || 'Still checking sign-in.')
      } else {
        console.error(e)
        trackErrorOccurred(MERGE_TOOL, e?.message || 'build_pdf_failed')
        setError(e?.message || 'Could not build PDF')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolPageShell title="JPG to PDF" subtitle="Combine images in order. Drag rows to reorder.">
      <FileDropzone
        accept="image/jpeg,image/jpg,image/png"
        multiple
        disabled={busy}
        onFiles={addFiles}
        label="Drop images here or click (JPEG, PNG, WebP)"
      />
      {items.length === 0 && (
        <p className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
          No images yet. Drop files above or tap the zone — order is preserved for your PDF.
        </p>
      )}
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
      <ToolFeatureSeoSection toolId="jpg-to-pdf" />
      {items.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Page order</h3>
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
            onClick={buildPdf}
            className="mt-6 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 disabled:opacity-50 sm:w-auto sm:px-10"
          >
            {busy ? MSG.finalizingPdf : 'Download PDF'}
          </button>
        </div>
      )}
    </ToolPageShell>
  )
}
