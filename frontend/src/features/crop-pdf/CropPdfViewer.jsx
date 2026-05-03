import { useCallback, useEffect, useRef, useState } from 'react'
import ThumbnailSidebar from '../../components/ThumbnailSidebar.jsx'
import CropRectOverlay from '../../components/tool-pdf/CropRectOverlay.jsx'
import FloatingPdfChrome from '../../components/tool-pdf/FloatingPdfChrome.jsx'
import { loadPdfDocument } from '../../components/tool-pdf/pdfDocumentLoader.js'

/**
 * @param {{
 *   file: File,
 *   pageScope: 'all' | 'current',
 *   sharedCrop: { l: number, t: number, w: number, h: number },
 *   setSharedCrop: (r: { l: number, t: number, w: number, h: number }) => void,
 *   draftCrop: { l: number, t: number, w: number, h: number },
 *   setDraftCrop: React.Dispatch<React.SetStateAction<{ l: number, t: number, w: number, h: number }>>,
 *   activePage: number,
 *   setActivePage: React.Dispatch<React.SetStateAction<number>>,
 *   busy: boolean,
 *   savedPageIndices: number[],
 * }} props
 */
export default function CropPdfViewer({
  file,
  pageScope,
  sharedCrop,
  setSharedCrop,
  draftCrop,
  setDraftCrop,
  activePage,
  setActivePage,
  busy,
  savedPageIndices,
}) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [loadErr, setLoadErr] = useState(null)
  const [zoomFactor, setZoomFactor] = useState(1)
  const [viewport, setViewport] = useState(null)
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const renderTaskRef = useRef(null)
  const pageRefs = useRef([])
  const [wrapW, setWrapW] = useState(640)

  const displayCrop = pageScope === 'all' ? sharedCrop : draftCrop

  const setDisplayCrop = useCallback(
    (r) => {
      if (pageScope === 'all') {
        setSharedCrop(r)
      } else {
        setDraftCrop(r)
      }
    },
    [pageScope, setDraftCrop, setSharedCrop]
  )

  useEffect(() => {
    if (!file) return undefined
    let cancelled = false
    let pdf = null
    ;(async () => {
      try {
        const buf = await file.arrayBuffer()
        pdf = await loadPdfDocument(buf)
        if (cancelled) {
          await pdf.destroy().catch(() => {})
          return
        }
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setLoadErr(null)
      } catch (e) {
        if (!cancelled) setLoadErr(e?.message || 'Could not load PDF')
      }
    })()
    return () => {
      cancelled = true
      pdf?.destroy().catch(() => {})
    }
  }, [file])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (w && w > 120) setWrapW(Math.min(960, Math.floor(w - 32)))
    })
    ro.observe(el)
    const w = el.getBoundingClientRect().width
    if (w > 120) setWrapW(Math.min(960, Math.floor(w - 32)))
    return () => ro.disconnect()
  }, [pdfDoc])

  useEffect(() => {
    if (!pdfDoc || numPages < 1) return undefined
    let cancelled = false
    ;(async () => {
      const page = await pdfDoc.getPage(activePage + 1)
      if (cancelled) return
      const base = page.getViewport({ scale: 1 })
      const fitScale = wrapW / base.width
      const scale = fitScale * zoomFactor
      const vp = page.getViewport({ scale })
      setViewport(vp)

      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = vp.width
      canvas.height = vp.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          /* ignore */
        }
      }
      const task = page.render({ canvasContext: ctx, viewport: vp })
      renderTaskRef.current = task
      try {
        await task.promise
      } catch (e) {
        if (e?.name !== 'RenderingCancelledException') console.warn(e)
      }
    })()

    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          /* ignore */
        }
      }
    }
  }, [pdfDoc, activePage, numPages, wrapW, zoomFactor])

  const zoomIn = () => setZoomFactor((z) => Math.min(3, Math.round((z * 1.12) * 100) / 100))
  const zoomOut = () => setZoomFactor((z) => Math.max(0.5, Math.round((z / 1.12) * 100) / 100))
  const fitWidth = () => setZoomFactor(1)

  if (loadErr) {
    return <p className="text-sm text-red-600 dark:text-red-400">{loadErr}</p>
  }
  if (!pdfDoc) {
    return <p className="text-sm text-zinc-500">Loading preview…</p>
  }

  const zoomPct = Math.round(zoomFactor * 100)

  return (
    <div className="flex min-h-0 w-full flex-1 gap-0">
      <ThumbnailSidebar
        pdfDoc={pdfDoc}
        numPages={numPages}
        activePage={activePage}
        onSelectPage={setActivePage}
        pageRefs={pageRefs}
        scrollIntoViewOnSelect={false}
        className="min-h-0 max-h-[min(70vh,720px)]"
        savedPageIndices={pageScope === 'current' ? savedPageIndices : []}
      />
      <div className="flex min-h-[min(70vh,720px)] min-w-0 flex-1 flex-col bg-zinc-200/40 dark:bg-zinc-900/40">
        <div
          ref={wrapRef}
          className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto p-3 md:p-4"
        >
          <div
            ref={(el) => {
              pageRefs.current[activePage] = el
            }}
            className="relative inline-block shadow-lg ring-1 ring-zinc-300/80 dark:ring-zinc-600"
          >
            <canvas
              ref={canvasRef}
              className="block max-w-full bg-white dark:bg-zinc-100"
              style={{ verticalAlign: 'top' }}
            />
            {viewport ? (
              <CropRectOverlay rect={displayCrop} onChange={setDisplayCrop} disabled={busy} />
            ) : null}
          </div>
        </div>
        <FloatingPdfChrome
          fileName={file.name}
          pageIndex={activePage}
          numPages={numPages}
          onPrev={() => setActivePage((p) => Math.max(0, p - 1))}
          onNext={() => setActivePage((p) => Math.min(numPages - 1, p + 1))}
          zoomPct={zoomPct}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFitWidth={fitWidth}
          disabled={busy}
        />
      </div>
    </div>
  )
}
