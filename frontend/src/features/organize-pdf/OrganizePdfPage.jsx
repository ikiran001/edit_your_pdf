import { useCallback, useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
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
import { buildOrganizedPdf, exportOrganizedSinglePagePdfs } from '../../lib/organizePdfCore.js'
import '../../lib/pdfjs.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'
import OrganizePageGrid from './OrganizePageGrid.jsx'

const TOOL = ANALYTICS_TOOL.organize_pdf

const GRID_ZOOM_MIN = 0.45
const GRID_ZOOM_MAX = 1.65
const GRID_ZOOM_STEP = 0.1

function makePageId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function signatureForPages(pages) {
  return JSON.stringify(pages.map((p) => ({ s: p.sourceIndex, r: p.rotationDelta || 0 })))
}

function baselineFromCount(n) {
  return Array.from({ length: n }, (_, sourceIndex) => ({ sourceIndex, rotationDelta: 0 }))
}

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

export default function OrganizePdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [file, setFile] = useState(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pages, setPages] = useState([])
  const [baselineSig, setBaselineSig] = useState('')
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [successHint, setSuccessHint] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [multiSelect, setMultiSelect] = useState(false)
  const [gridZoom, setGridZoom] = useState(1)
  const [exportSelectedOpen, setExportSelectedOpen] = useState(false)

  useToolEngagement(TOOL, true)

  const dirty = useMemo(() => {
    if (!baselineSig) return false
    return signatureForPages(pages) !== baselineSig
  }, [pages, baselineSig])

  /** Selected thumbnails in current grid order (for export subset). */
  const selectedPagesOrdered = useMemo(() => {
    if (!selectedIds.size) return []
    return pages.filter((p) => selectedIds.has(p.id))
  }, [pages, selectedIds])

  useEffect(() => {
    if (!exportSelectedOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setExportSelectedOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exportSelectedOpen])

  useEffect(() => {
    if (!file) {
      setPdfDoc(null)
      setPages([])
      setBaselineSig('')
      setGridZoom(1)
      setSelectedIds(new Set())
      setExportSelectedOpen(false)
      setError(null)
      return undefined
    }

    let cancelled = false
    let loadedDoc = null

    const run = async () => {
      setLoadingDoc(true)
      setError(null)
      setPdfDoc(null)
      setPages([])
      setBaselineSig('')
      setSelectedIds(new Set())
      try {
        const u8 = new Uint8Array(await file.arrayBuffer())
        if (cancelled) return
        const task = getDocument({ data: u8 })
        loadedDoc = await task.promise
        if (cancelled) {
          loadedDoc.destroy()
          return
        }
        const n = loadedDoc.numPages
        if (n < 1) throw new Error('This PDF has no pages to organize.')
        const model = baselineFromCount(n)
        const sig = JSON.stringify(model.map((row) => ({ s: row.sourceIndex, r: row.rotationDelta })))
        const initial = model.map((row) => ({
          id: makePageId(),
          sourceIndex: row.sourceIndex,
          rotationDelta: row.rotationDelta,
        }))
        setPdfDoc(loadedDoc)
        setPages(initial)
        setBaselineSig(sig)
        setGridZoom(1)
        markFunnelUpload(TOOL)
        trackFileUploaded({
          file_type: 'pdf',
          file_size: file.size / 1024,
          tool: TOOL,
        })
      } catch (e) {
        if (!cancelled) {
          const msg =
            e?.name === 'PasswordException'
              ? 'This PDF is password-protected. Unlock it first, then try again.'
              : e?.message || 'We could not read this PDF. Try another file.'
          setError(msg)
          trackErrorOccurred(TOOL, e?.message || 'pdf_load_failed')
          if (loadedDoc) {
            loadedDoc.destroy()
            loadedDoc = null
          }
        }
      } finally {
        if (!cancelled) setLoadingDoc(false)
      }
    }

    run()
    return () => {
      cancelled = true
      if (loadedDoc) loadedDoc.destroy()
    }
  }, [file])

  const onFiles = useCallback((files) => {
    const next = files[0]
    if (!next) return
    if (next.type !== 'application/pdf' && !/\.pdf$/i.test(next.name)) {
      setError('Please choose a PDF file.')
      return
    }
    setSuccessHint(null)
    setFile(next)
  }, [])

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const deletePage = useCallback((id) => {
    setPages((prev) => prev.filter((p) => p.id !== id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const deleteSelected = useCallback(() => {
    if (!selectedIds.size) return
    setPages((prev) => prev.filter((p) => !selectedIds.has(p.id)))
    setSelectedIds(new Set())
  }, [selectedIds])

  const rotateLeft = useCallback((id) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, rotationDelta: ((((p.rotationDelta || 0) - 90) % 360) + 360) % 360 }
          : p
      )
    )
  }, [])

  const rotateRight = useCallback((id) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotationDelta: ((p.rotationDelta || 0) + 90) % 360 } : p))
    )
  }, [])

  const resetChanges = useCallback(() => {
    if (!baselineSig) return
    const parsed = JSON.parse(baselineSig)
    setPages(
      parsed.map((row) => ({
        id: makePageId(),
        sourceIndex: row.s,
        rotationDelta: row.r,
      }))
    )
    setSelectedIds(new Set())
  }, [baselineSig])

  const applyAndDownload = async () => {
    if (!file || !pages.length) {
      setError('Load a PDF and keep at least one page to download.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccessHint(null)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      await runWithSignInForDownload(
        async () => {
          const ordered = pages.map((p) => ({
            sourceIndex: p.sourceIndex,
            rotationDelta: p.rotationDelta || 0,
          }))
          const u8 = await buildOrganizedPdf(file, ordered)
          const base = file.name.replace(/\.pdf$/i, '') || 'document'
          downloadUint8(u8, `${base}-organized.pdf`)
          trackToolCompleted(TOOL, true)
          trackFileDownloaded({
            tool: TOOL,
            file_size: u8.byteLength / 1024,
            total_pages: pages.length,
          })
          const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          trackProcessingTime(TOOL, elapsed)
          setSuccessHint('Your organized PDF downloaded successfully.')
          window.setTimeout(() => setSuccessHint(null), 5000)
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
        trackErrorOccurred(TOOL, e?.message || 'organize_failed')
        setError(e?.message || 'Could not build the PDF. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  const runExportSelected = async (mode) => {
    if (!file || selectedPagesOrdered.length === 0) {
      setError('Select one or more pages to export.')
      return
    }
    setExportSelectedOpen(false)
    setBusy(true)
    setError(null)
    setSuccessHint(null)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const ordered = selectedPagesOrdered.map((p) => ({
      sourceIndex: p.sourceIndex,
      rotationDelta: p.rotationDelta || 0,
    }))
    const base = file.name.replace(/\.pdf$/i, '') || 'document'
    try {
      await runWithSignInForDownload(
        async () => {
          let successHintMsg = ''
          if (mode === 'single') {
            const u8 = await buildOrganizedPdf(file, ordered)
            downloadUint8(u8, `${base}-selected.pdf`)
            trackToolCompleted(TOOL, true)
            trackFileDownloaded({
              tool: TOOL,
              file_size: u8.byteLength / 1024,
              total_pages: ordered.length,
              export_mode: 'selected_single_pdf',
            })
            successHintMsg = 'Selected pages downloaded as one PDF.'
          } else {
            const parts = await exportOrganizedSinglePagePdfs(file, ordered)
            if (parts.length === 1) {
              downloadUint8(parts[0], `${base}-selected-page-1.pdf`)
            } else {
              const zip = new JSZip()
              parts.forEach((u8, i) => {
                zip.file(`selected-page-${i + 1}.pdf`, u8)
              })
              const blob = await zip.generateAsync({ type: 'blob' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${base}-selected-pages.zip`
              a.rel = 'noopener'
              a.click()
              URL.revokeObjectURL(url)
            }
            trackToolCompleted(TOOL, true)
            trackFileDownloaded({
              tool: TOOL,
              file_size: parts.reduce((s, u) => s + u.byteLength, 0) / 1024,
              total_pages: parts.length,
              export_mode: 'selected_separate_pdfs',
            })
            successHintMsg =
              parts.length === 1
                ? 'Selected page downloaded.'
                : 'Selected pages downloaded as a ZIP of PDFs.'
          }
          const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          trackProcessingTime(TOOL, elapsed)
          setSuccessHint(successHintMsg)
          window.setTimeout(() => setSuccessHint(null), 5000)
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
        trackErrorOccurred(TOOL, e?.message || 'organize_selected_export_failed')
        setError(e?.message || 'Could not export selected pages. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  const selectedCount = selectedIds.size
  const docReady = Boolean(file && pdfDoc && baselineSig)
  const noPagesLeft = docReady && pages.length === 0
  const showGrid = docReady && pages.length > 0

  return (
    <ToolPageShell
      title="Organize PDF Pages"
      subtitle="Rearrange, rotate, or remove pages — all in your browser."
    >
      <FileDropzone
        accept="application/pdf"
        disabled={busy || loadingDoc}
        onFiles={onFiles}
        label={loadingDoc ? 'Loading PDF…' : busy ? 'Working…' : 'Drop a PDF here or click to browse'}
      />

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

      <ToolFeatureSeoSection toolId="organize-pdf" />

      {loadingDoc && (
        <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">Preparing page previews…</p>
      )}

      {noPagesLeft && (
        <div
          role="status"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          Every page was removed. Use <strong>Reset changes</strong> to restore, or upload a different PDF.
        </div>
      )}

      {docReady && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center gap-3 lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
            {showGrid ? (
              <>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={multiSelect}
                    onChange={(e) => {
                      setMultiSelect(e.target.checked)
                      if (!e.target.checked) setSelectedIds(new Set())
                    }}
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
                  />
                  Select multiple pages
                </label>
                {multiSelect && selectedCount > 0 ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setExportSelectedOpen(true)}
                      className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-900 transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-100 dark:hover:bg-indigo-950"
                    >
                      Download selected…
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={deleteSelected}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100 dark:hover:bg-red-950/80"
                    >
                      Delete selected ({selectedCount})
                    </button>
                  </>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={resetChanges}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Reset changes
            </button>
            </div>
            {showGrid ? (
              <div
                className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700 sm:border-t-0 sm:pt-0 lg:border-l lg:pl-4"
                role="group"
                aria-label="Grid zoom"
              >
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
            ) : null}
          </div>

          {showGrid ? (
            <div
              className="max-h-[min(88vh,1400px)] w-full overflow-auto rounded-2xl border border-zinc-200/90 bg-zinc-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-950/40 sm:p-3"
            >
              <div
                className="inline-block min-w-full transition-[transform,width] duration-200 ease-out"
                style={{
                  transform: `scale(${gridZoom})`,
                  transformOrigin: 'top left',
                  width: `${(100 / gridZoom).toFixed(4)}%`,
                }}
              >
                <OrganizePageGrid
                  pdfDoc={pdfDoc}
                  pages={pages}
                  setPages={setPages}
                  disabled={busy}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  multiSelectEnabled={multiSelect}
                  onRotateLeft={rotateLeft}
                  onRotateRight={rotateRight}
                  onDeletePage={deletePage}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-700 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {pages.length} page{pages.length === 1 ? '' : 's'} in output order
            </p>
            <button
              type="button"
              disabled={busy || !file || pages.length === 0}
              onClick={applyAndDownload}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              {busy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Building PDF…
                </span>
              ) : (
                'Apply Changes & Download PDF'
              )}
            </button>
          </div>
        </div>
      )}
      {exportSelectedOpen ? (
        <div
          className="fixed inset-0 z-[280] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setExportSelectedOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="organize-export-selected-title"
            className="w-full max-w-md rounded-t-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2
              id="organize-export-selected-title"
              className="m-0 text-base font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Export selected pages
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              <strong>{selectedCount}</strong> page{selectedCount === 1 ? '' : 's'} in current grid order (rotations
              apply).
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void runExportSelected('single')}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Single PDF
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runExportSelected('separate')}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                Separate PDFs {selectedCount > 1 ? '(ZIP)' : ''}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setExportSelectedOpen(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ToolPageShell>
  )
}
