import { useCallback, useState } from 'react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import {
  trackErrorOccurred,
  trackFileDownloaded,
  trackToolCompleted,
  trackProcessingTime,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { CLIENT_PDF_MAX_BYTES } from '../pdf-to-word/extractPdfText.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'
import CropPdfViewer from './CropPdfViewer.jsx'
import { applyCropPdf } from './applyCropPdf.js'

const TOOL = ANALYTICS_TOOL.crop_pdf

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

function defaultCrop() {
  return { l: 0.05, t: 0.05, w: 0.9, h: 0.9 }
}

export default function CropPdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [file, setFile] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [pageScope, setPageScope] = useState(/** @type {'all' | 'current'} */ ('current'))
  const [activePage, setActivePage] = useState(0)
  const [sharedCrop, setSharedCrop] = useState(defaultCrop)
  const [cropsByPage, setCropsByPage] = useState(
    /** @type {Record<number, { l: number, t: number, w: number, h: number }>} */ ({})
  )

  useToolEngagement(TOOL, true)

  const onPdf = useCallback(
    async (files) => {
      const f = files[0]
      if (!f || (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name))) {
        setError('Choose a valid PDF.')
        return
      }
      if (f.size > CLIENT_PDF_MAX_BYTES) {
        setError(`Choose a PDF under ${Math.round(CLIENT_PDF_MAX_BYTES / (1024 * 1024))} MB.`)
        return
      }
      setError(null)
      setSharedCrop(defaultCrop())
      setCropsByPage({})
      setActivePage(0)
      setFile(f)
      try {
        const { PDFDocument } = await import('pdf-lib')
        const doc = await PDFDocument.load(new Uint8Array(await f.arrayBuffer()), { ignoreEncryption: true })
        setPageCount(doc.getPageCount())
      } catch (e) {
        setFile(null)
        setPageCount(0)
        setError(e?.message || 'Could not read PDF.')
      }
    },
    []
  )

  const resetAll = () => {
    setSharedCrop(defaultCrop())
    setCropsByPage({})
  }

  const runCrop = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      await runWithSignInForDownload(
        async () => {
          const u8 = await applyCropPdf(file, {
            scope: pageScope,
            activePageIndex: activePage,
            sharedCrop,
            cropsByPage,
          })
          const base = (file.name || 'document').replace(/\.pdf$/i, '') || 'document'
          downloadUint8(u8, `${base}-cropped.pdf`)
          trackToolCompleted(TOOL, true)
          trackFileDownloaded({
            tool: TOOL,
            file_size: u8.byteLength / 1024,
            total_pages: pageCount,
          })
          const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          trackProcessingTime(TOOL, elapsed)
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
        trackErrorOccurred(TOOL, e?.message || 'crop_failed')
        setError(e?.message || 'Could not crop PDF.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolPageShell
      title="Crop PDF"
      subtitle="Drag the crop area on the preview, then download. Sets the PDF crop box (viewing area)."
      contentMaxWidth="wide"
    >
      {!file ? (
        <FileDropzone
          accept="application/pdf"
          disabled={busy}
          onFiles={onPdf}
          label="Drop one PDF here or click to browse"
        />
      ) : null}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}

      {file && pageCount > 0 ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/40">
            <CropPdfViewer
              file={file}
              pageScope={pageScope}
              sharedCrop={sharedCrop}
              setSharedCrop={setSharedCrop}
              cropsByPage={cropsByPage}
              setCropsByPage={setCropsByPage}
              activePage={activePage}
              setActivePage={setActivePage}
              busy={busy}
            />
          </div>

          <aside className="flex w-full shrink-0 flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 lg:w-[320px]">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Crop PDF</h2>
              <div className="mt-3 flex gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100">
                <span className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden>
                  ⓘ
                </span>
                <p>Click and drag the crop box to move it. Drag the blue handles to resize.</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Pages</span>
              <button
                type="button"
                onClick={resetAll}
                disabled={busy}
                className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
              >
                Reset all
              </button>
            </div>
            <fieldset className="space-y-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="crop-scope"
                  checked={pageScope === 'all'}
                  onChange={() => setPageScope('all')}
                  disabled={busy}
                  className="h-4 w-4 accent-emerald-600"
                />
                <span>All pages (same crop)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="crop-scope"
                  checked={pageScope === 'current'}
                  onChange={() => setPageScope('current')}
                  disabled={busy}
                  className="h-4 w-4 accent-emerald-600"
                />
                <span>Current page only</span>
              </label>
            </fieldset>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              This updates the crop box only. Other pages stay unchanged when &quot;Current page only&quot; is selected.
            </p>

            <div className="mt-auto flex justify-end pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={runCrop}
                className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Cropping…' : 'Crop PDF'}
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">→</span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </ToolPageShell>
  )
}
