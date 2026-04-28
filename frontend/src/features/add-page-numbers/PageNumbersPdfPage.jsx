import { useEffect, useMemo, useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
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
import { resolvePageIndices } from '../../lib/watermarkPdfCore.js'
import { parsePageRangeInput } from '../../lib/pdfMergeSplitCore.js'
import { formatPageNumberText } from '../../lib/pageNumbersLayout.js'
import { applyPageNumbersToPdf } from '../../lib/pageNumbersPdfCore.js'
import PageNumbersPreviewCard from './PageNumbersPreviewCard.jsx'
import '../../lib/pdfjs.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'

const TOOL = ANALYTICS_TOOL.page_numbers_pdf

const GRID_ZOOM_MIN = 0.45
const GRID_ZOOM_MAX = 1.65
const GRID_ZOOM_STEP = 0.1

const MARGIN_PRESETS = [
  { id: 'recommended', label: 'Recommended (36 pt)', pts: 36 },
  { id: 'comfortable', label: 'Comfortable (48 pt)', pts: 48 },
  { id: 'tight', label: 'Tight (24 pt)', pts: 24 },
]

/** @type {{ row: number, col: number, label: string }[]} */
const GRID_CELLS = [
  { row: 0, col: 0, label: 'Top left' },
  { row: 0, col: 1, label: 'Top center' },
  { row: 0, col: 2, label: 'Top right' },
  { row: 1, col: 0, label: 'Middle left' },
  { row: 1, col: 1, label: 'Middle center' },
  { row: 1, col: 2, label: 'Middle right' },
  { row: 2, col: 0, label: 'Bottom left' },
  { row: 2, col: 1, label: 'Bottom center' },
  { row: 2, col: 2, label: 'Bottom right' },
]

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

export default function PageNumbersPdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfBytes, setPdfBytes] = useState(null)
  /** @type {import('pdfjs-dist').PDFDocumentProxy | null} */
  const [pdfDoc, setPdfDoc] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [gridZoom, setGridZoom] = useState(1)

  const [layoutMode, setLayoutMode] = useState('single')
  const [gridRow, setGridRow] = useState(2)
  const [gridCol, setGridCol] = useState(1)
  const [marginPreset, setMarginPreset] = useState('recommended')

  const [pageScope, setPageScope] = useState('all')
  const [pageRangeInput, setPageRangeInput] = useState('1')
  const [firstNumber, setFirstNumber] = useState(1)

  const [numberFormat, setNumberFormat] = useState('plain')
  const [fontSize, setFontSize] = useState(11)
  const [colorHex, setColorHex] = useState('#334155')
  const [bold, setBold] = useState(false)

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState(null)
  const [successHint, setSuccessHint] = useState(null)
  const [rangeHint, setRangeHint] = useState(null)

  useToolEngagement(TOOL, true)

  const marginPts = MARGIN_PRESETS.find((m) => m.id === marginPreset)?.pts ?? 36

  useEffect(() => {
    if (!pdfFile) {
      setPdfBytes(null)
      setPdfDoc(null)
      setNumPages(0)
      return undefined
    }
    let cancelled = false
    let doc = null
    ;(async () => {
      try {
        const raw = await pdfFile.arrayBuffer()
        if (cancelled) return
        const master = new Uint8Array(raw)
        setPdfBytes(master)
        const task = getDocument({ data: master.slice() })
        doc = await task.promise
        if (cancelled) {
          doc.destroy()
          return
        }
        setPdfDoc(doc)
        setNumPages(doc.numPages)
        markFunnelUpload(TOOL)
        trackFileUploaded({
          file_type: 'pdf',
          file_size: pdfFile.size / 1024,
          tool: TOOL,
        })
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Could not open this PDF.')
          trackErrorOccurred(TOOL, e?.message || 'pdf_open')
        }
      }
    })()
    return () => {
      cancelled = true
      if (doc) doc.destroy()
    }
  }, [pdfFile])

  const validateRange = useMemo(() => {
    if (pageScope !== 'range' || !numPages) return { ok: true, count: numPages }
    try {
      parsePageRangeInput(pageRangeInput, numPages)
      const idx = resolvePageIndices('range', pageRangeInput, numPages)
      return { ok: true, count: idx.length }
    } catch (e) {
      return { ok: false, message: e?.message || 'Invalid page range' }
    }
  }, [pageScope, pageRangeInput, numPages])

  const folioByPhysicalPage = useMemo(() => {
    const m = new Map()
    if (!numPages || !pdfDoc) return m
    if (pageScope === 'range' && !validateRange.ok) return m
    try {
      const indices = resolvePageIndices(pageScope, pageRangeInput, numPages)
      const fn = Math.max(1, Math.floor(Number(firstNumber)) || 1)
      let fmt = numberFormat
      if (fmt !== 'page-n' && fmt !== 'page-n-of-m') fmt = 'plain'
      indices.forEach((idx0, i) => {
        m.set(idx0 + 1, formatPageNumberText(fmt, fn + i, numPages))
      })
    } catch {
      /* invalid range while typing */
    }
    return m
  }, [
    numPages,
    pdfDoc,
    pageScope,
    pageRangeInput,
    firstNumber,
    numberFormat,
    validateRange.ok,
  ])

  useEffect(() => {
    if (pageScope === 'range' && numPages && !validateRange.ok) {
      setRangeHint(validateRange.message)
    } else {
      setRangeHint(null)
    }
  }, [pageScope, pageRangeInput, numPages, validateRange])

  const onPdfFiles = (files) => {
    const f = files?.[0]
    if (!f) return
    setPdfFile(f)
    setError(null)
    setSuccessHint(null)
  }

  const selectGridCell = (row, col) => {
    setGridRow(row)
    setGridCol(col)
  }

  const runApply = async () => {
    if (!pdfFile || !pdfBytes?.length) {
      setError('Upload a PDF first.')
      return
    }
    if (pageScope === 'range' && !validateRange.ok) {
      setError(validateRange.message)
      return
    }
    const fn = Math.max(1, Math.floor(Number(firstNumber)) || 1)
    if (fn < 1) {
      setError('First number must be at least 1.')
      return
    }

    setBusy(true)
    setError(null)
    setSuccessHint(null)
    setProgress({ done: 0, total: 0 })
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()

    try {
      await runWithSignInForDownload(
        async () => {
          const indices = resolvePageIndices(pageScope, pageRangeInput, numPages)
          setProgress({ done: 0, total: indices.length })
          const u8 = await applyPageNumbersToPdf(pdfBytes, {
            layoutMode,
            gridRow,
            gridCol,
            marginPts,
            pageScope,
            pageRangeInput: pageScope === 'range' ? pageRangeInput : '',
            firstNumber: fn,
            numberFormat,
            fontSize,
            colorHex,
            bold,
            onProgress: (done, total) => setProgress({ done, total }),
          })
          const base = pdfFile.name.replace(/\.pdf$/i, '') || 'document'
          downloadUint8(u8, `${base}-numbered.pdf`)
          trackToolCompleted(TOOL, true)
          trackFileDownloaded({
            tool: TOOL,
            file_size: u8.byteLength / 1024,
            total_pages: numPages,
          })
          trackProcessingTime(
            TOOL,
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          )
          setSuccessHint('Numbered PDF downloaded successfully.')
          window.setTimeout(() => setSuccessHint(null), 6000)
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
        trackErrorOccurred(TOOL, e?.message || 'page_numbers_failed')
        setError(e?.message || 'Could not add page numbers.')
      }
    } finally {
      setBusy(false)
      setProgress({ done: 0, total: 0 })
    }
  }

  return (
    <ToolPageShell
      title="Add page numbers"
      subtitle="Stamp page numbers in your browser — single-page layout or facing spreads with outer margins."
    >
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={onPdfFiles}
        label={busy ? 'Working…' : pdfFile ? pdfFile.name : 'Drop your PDF here or click to browse'}
      />

      {numPages > 0 && (
        <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {numPages} page{numPages === 1 ? '' : 's'} loaded
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100"
        >
          {error}
        </div>
      )}
      {successHint && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          {successHint}
        </div>
      )}

      {numPages > 0 && pdfBytes && pdfDoc && (
        <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,1.08fr)] lg:gap-8 lg:items-start">
          <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Page layout</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              <strong className="font-medium text-zinc-700 dark:text-zinc-300">Facing pages:</strong> odd pages use
              the outer-right band; even pages use the outer-left band at the same vertical position (book-style).
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="pn-layout"
                  checked={layoutMode === 'single'}
                  disabled={busy}
                  onChange={() => setLayoutMode('single')}
                  className="text-indigo-600"
                />
                Single page
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="pn-layout"
                  checked={layoutMode === 'facing'}
                  disabled={busy}
                  onChange={() => setLayoutMode('facing')}
                  className="text-indigo-600"
                />
                Facing pages
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Position</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {layoutMode === 'facing'
                ? 'Tap a cell to choose the vertical band (top, middle, or bottom row). Columns do not affect horizontal placement in facing mode.'
                : 'Choose where numbers appear on each page.'}
            </p>
            <div
              className="mt-3 inline-grid grid-cols-3 gap-2"
              role="group"
              aria-label={layoutMode === 'facing' ? 'Vertical band for page numbers' : 'Page number position'}
            >
              {GRID_CELLS.map((cell) => {
                const selected = gridRow === cell.row && gridCol === cell.col
                return (
                  <button
                    key={`${cell.row}-${cell.col}`}
                    type="button"
                    disabled={busy}
                    onClick={() => selectGridCell(cell.row, cell.col)}
                    aria-label={cell.label}
                    aria-pressed={selected}
                    title={cell.label}
                    className={`flex h-11 w-full min-w-[4.5rem] items-center justify-center rounded-xl border text-xs font-medium transition sm:h-12 ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500/30 dark:border-cyan-500 dark:bg-cyan-950/40 dark:text-cyan-100'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300'
                    }`}
                  >
                    <span className="pointer-events-none h-2 w-2 rounded-full bg-current opacity-70" aria-hidden />
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Margin</h3>
            <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Offset from page edge
              <select
                value={marginPreset}
                onChange={(e) => setMarginPreset(e.target.value)}
                disabled={busy}
                className="mt-1 w-full max-w-md rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              >
                {MARGIN_PRESETS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Pages to number</h3>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="pn-scope"
                  checked={pageScope === 'all'}
                  disabled={busy}
                  onChange={() => setPageScope('all')}
                  className="text-indigo-600"
                />
                All pages
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="pn-scope"
                  checked={pageScope === 'range'}
                  disabled={busy}
                  onChange={() => setPageScope('range')}
                  className="text-indigo-600"
                />
                Page range
              </label>
            </div>
            <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              First displayed number
              <input
                type="number"
                min={1}
                value={firstNumber}
                onChange={(e) => setFirstNumber(Number(e.target.value))}
                disabled={busy}
                className="mt-1 w-full max-w-[12rem] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            {pageScope === 'range' ? (
              <div className="mt-3">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Range (1-based)
                  <input
                    type="text"
                    value={pageRangeInput}
                    onChange={(e) => setPageRangeInput(e.target.value)}
                    disabled={busy || !numPages}
                    placeholder="e.g. 1-3, 5, 8-10"
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
                {rangeHint ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{rangeHint}</p>
                ) : numPages ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {validateRange.ok ? `${validateRange.count} page(s) will be numbered.` : ''}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Text format</h3>
            <select
              value={numberFormat}
              onChange={(e) => setNumberFormat(e.target.value)}
              disabled={busy}
              className="mt-3 w-full max-w-md rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            >
              <option value="plain">Page number only (1, 2, 3…)</option>
              <option value="page-n">Page N</option>
              <option value="page-n-of-m">Page N of M (M = total pages in file)</option>
            </select>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Font size (pt)
                <input
                  type="number"
                  min={6}
                  max={120}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Color
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  disabled={busy}
                  className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-zinc-300 dark:border-zinc-600"
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={bold}
                  disabled={busy}
                  onChange={(e) => setBold(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 dark:border-zinc-600"
                />
                Bold (Helvetica Bold)
              </label>
            </div>
          </section>

          <button
            type="button"
            disabled={
              busy ||
              !pdfFile ||
              !pdfBytes?.length ||
              !numPages ||
              (pageScope === 'range' && !validateRange.ok)
            }
            onClick={runApply}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Adding… {progress.total ? `${progress.done}/${progress.total}` : ''}
              </>
            ) : (
              'Add page numbers'
            )}
          </button>
          </div>

          <aside className="mt-8 space-y-3 lg:mt-0 lg:sticky lg:top-4">
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-4">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Grid zoom</span>
              <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-600 dark:bg-zinc-900">
                <button
                  type="button"
                  disabled={busy || gridZoom <= GRID_ZOOM_MIN + 1e-6}
                  onClick={() =>
                    setGridZoom((z) =>
                      Math.max(GRID_ZOOM_MIN, Math.round((z - GRID_ZOOM_STEP) * 100) / 100)
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  title="Zoom out (see more pages)"
                  aria-label="Zoom out page grid"
                >
                  <ZoomOut className="h-5 w-5" strokeWidth={2.25} />
                </button>
                <span className="min-w-[3rem] text-center text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                  {Math.round(gridZoom * 100)}%
                </span>
                <button
                  type="button"
                  disabled={busy || gridZoom >= GRID_ZOOM_MAX - 1e-6}
                  onClick={() =>
                    setGridZoom((z) =>
                      Math.min(GRID_ZOOM_MAX, Math.round((z + GRID_ZOOM_STEP) * 100) / 100)
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  title="Zoom in"
                  aria-label="Zoom in page grid"
                >
                  <ZoomIn className="h-5 w-5" strokeWidth={2.25} />
                </button>
              </div>
              <button
                type="button"
                disabled={busy || Math.abs(gridZoom - 1) < 1e-4}
                onClick={() => setGridZoom(1)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 underline-offset-2 hover:underline disabled:opacity-35 dark:text-cyan-400"
              >
                100%
              </button>
            </div>

            <div className="max-h-[min(88vh,1400px)] w-full overflow-auto rounded-2xl border border-zinc-200/90 bg-zinc-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-950/40 sm:p-3">
              <div
                className="inline-block min-w-full transition-[transform,width] duration-200 ease-out"
                style={{
                  transform: `scale(${gridZoom})`,
                  transformOrigin: 'top left',
                  width: `${(100 / gridZoom).toFixed(4)}%`,
                }}
              >
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))]">
                  {Array.from({ length: numPages }, (_, i) => {
                    const p = i + 1
                    return (
                      <PageNumbersPreviewCard
                        key={p}
                        pdfDoc={pdfDoc}
                        pageIndex1Based={p}
                        folioText={folioByPhysicalPage.get(p) ?? null}
                        layoutMode={layoutMode}
                        gridRow={gridRow}
                        gridCol={gridCol}
                        marginPts={marginPts}
                        fontSize={fontSize}
                        colorHex={colorHex}
                        bold={bold}
                        disabled={busy}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Live preview approximates folio placement; the downloaded PDF is final.
            </p>
          </aside>
        </div>
      )}

      <ToolFeatureSeoSection toolId="add-page-numbers" />
    </ToolPageShell>
  )
}
