import { useCallback, useState } from 'react'
import JSZip from 'jszip'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { pdfToJpegBlobs } from './pdfToJpgCore.js'

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export default function PdfToJpgPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [scale, setScale] = useState(2)

  const onPdf = useCallback(
    async (files) => {
      const file = files[0]
      if (!file || file.type !== 'application/pdf') return
      setError(null)
      setBusy(true)
      const base = file.name.replace(/\.pdf$/i, '') || 'document'
      try {
        const buf = await file.arrayBuffer()
        const blobs = await pdfToJpegBlobs(buf, { scale, quality: 0.92 })
        const zip = new JSZip()
        blobs.forEach((blob, idx) => {
          zip.file(`page-${String(idx + 1).padStart(3, '0')}.jpg`, blob)
        })
        const zblob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(zblob, `${base}-pages.zip`)
      } catch (e) {
        console.error(e)
        setError(e?.message || 'Conversion failed')
      } finally {
        setBusy(false)
      }
    },
    [scale]
  )

  return (
    <ToolPageShell title="PDF to JPG" subtitle="Export every page as JPEG in one ZIP.">
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/60">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <span>Render scale</span>
          <select
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            disabled={busy}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
          </select>
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Higher scale = sharper images, larger files. Processing stays in your browser.
        </p>
      </div>
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={onPdf}
        label={busy ? 'Converting…' : 'Drop a PDF here or click to browse'}
      />
      {busy && (
        <div className="mt-6 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      )}
    </ToolPageShell>
  )
}
