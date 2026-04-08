import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import {
  parsePageRangeInput,
  splitPdfByRanges,
  splitPdfEveryPage,
} from '../../lib/pdfMergeSplitCore.js'

const TOOL = ANALYTICS_TOOL.split_pdf

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

export default function SplitPdfPage() {
  const [file, setFile] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [extractAll, setExtractAll] = useState(false)
  const [rangeText, setRangeText] = useState('1-3, 4-5')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useToolEngagement(TOOL, true)

  const onPdfChosen = async (files) => {
    const f = files[0]
    if (!f || (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name))) {
      setError('Choose a valid PDF file.')
      return
    }
    setError(null)
    setSuccess(null)
    setFile(f)
    try {
      const buf = await f.arrayBuffer()
      const doc = await PDFDocument.load(new Uint8Array(buf), { ignoreEncryption: true })
      setPageCount(doc.getPageCount())
    } catch (e) {
      console.error(e)
      setFile(null)
      setPageCount(0)
      setError(e?.message || 'Could not read PDF.')
    }
  }

  const runSplit = async () => {
    if (!file) {
      setError('Upload a PDF first.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      if (extractAll) {
        const parts = await splitPdfEveryPage(file)
        if (parts.length === 1) {
          downloadUint8(parts[0], 'page-1.pdf')
        } else {
          const zip = new JSZip()
          parts.forEach((u8, i) => {
            zip.file(`page-${i + 1}.pdf`, u8)
          })
          const blob = await zip.generateAsync({ type: 'blob' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'split-pages.zip'
          a.rel = 'noopener'
          a.click()
          URL.revokeObjectURL(url)
        }
        setSuccess(
          parts.length === 1
            ? 'Downloaded one PDF.'
            : `Downloaded ZIP with ${parts.length} PDFs.`
        )
      } else {
        const groups = parsePageRangeInput(rangeText, pageCount)
        const parts = await splitPdfByRanges(file, groups)
        if (parts.length === 1) {
          downloadUint8(parts[0], 'split.pdf')
          setSuccess('Downloaded split.pdf.')
        } else {
          const zip = new JSZip()
          parts.forEach((u8, i) => {
            zip.file(`split-${i + 1}.pdf`, u8)
          })
          const blob = await zip.generateAsync({ type: 'blob' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'split-output.zip'
          a.rel = 'noopener'
          a.click()
          URL.revokeObjectURL(url)
          setSuccess(`Downloaded ZIP with ${parts.length} PDFs.`)
        }
      }
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Could not split PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolPageShell
      title="Split PDF"
      subtitle="Split by page ranges or extract every page. Processing stays in your browser."
    >
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={onPdfChosen}
        label={file ? file.name : 'Drop one PDF here or click to browse'}
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
      <ToolFeatureSeoSection toolId="split-pdf" />

      {file && pageCount > 0 && (
        <div className="mt-8 space-y-6 rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-inner dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This file has <strong>{pageCount}</strong> page{pageCount === 1 ? '' : 's'}.
          </p>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 rounded border-zinc-300"
              checked={extractAll}
              onChange={(e) => setExtractAll(e.target.checked)}
            />
            <span className="text-sm text-zinc-800 dark:text-zinc-200">
              Extract all pages (one PDF per page, packaged as ZIP if more than one)
            </span>
          </label>

          {!extractAll && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Split by page range
              </label>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Comma-separated ranges, 1-based (e.g. <code className="text-xs">1-3, 5, 7-8</code>).
                Each range becomes one PDF.
              </p>
              <textarea
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                disabled={busy}
                rows={3}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                placeholder="1-3, 4-6"
              />
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={runSplit}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 disabled:opacity-50 sm:w-auto sm:px-10"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Splitting…
              </span>
            ) : (
              'Split PDF'
            )}
          </button>
        </div>
      )}
    </ToolPageShell>
  )
}
