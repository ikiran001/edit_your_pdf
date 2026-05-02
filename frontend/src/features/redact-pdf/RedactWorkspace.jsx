import { useCallback, useEffect, useRef, useState } from 'react'
import ThumbnailSidebar from '../../components/ThumbnailSidebar.jsx'
import FloatingPdfChrome from '../../components/tool-pdf/FloatingPdfChrome.jsx'
import RedactMarksOverlay from '../../components/tool-pdf/RedactMarksOverlay.jsx'
import { loadPdfDocument } from '../../components/tool-pdf/pdfDocumentLoader.js'

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const MIN_D = 0.015

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function isEditableTarget(el) {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable
}

/**
 * @param {{
 *   file: File,
 *   marks: Array<{ id: string, pageIndex: number, nx: number, ny: number, nw: number, nh: number, staged?: boolean }>,
 *   setMarks: React.Dispatch<React.SetStateAction<any[]>>,
 *   busy: boolean,
 * }} props
 */
export default function RedactWorkspace({ file, marks, setMarks, busy }) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [activePage, setActivePage] = useState(0)
  const [loadErr, setLoadErr] = useState(null)
  const [zoomFactor, setZoomFactor] = useState(1)
  const [wrapW, setWrapW] = useState(640)
  const [draft, setDraft] = useState(/** @type {{ nx: number, ny: number, nw: number, nh: number } | null} */ (null))
  const [canUndo, setCanUndo] = useState(false)
  const dragRef = useRef(null)
  const undoStackRef = useRef(/** @type {typeof marks[][]} */ ([]))

  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const wrapOuterRef = useRef(null)
  const renderTaskRef = useRef(null)
  const pageRefs = useRef([])

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
    const el = wrapOuterRef.current
    if (!el) return undefined
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (w && w > 120) setWrapW(Math.min(920, Math.floor(w - 24)))
    })
    ro.observe(el)
    const w = el.getBoundingClientRect().width
    if (w > 120) setWrapW(Math.min(920, Math.floor(w - 24)))
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

  const undoLast = useCallback(() => {
    const stack = undoStackRef.current
    if (stack.length < 1) return
    const prev = stack.pop()
    if (prev) setMarks(prev)
    setCanUndo(stack.length > 0)
  }, [setMarks])

  useEffect(() => {
    const onKey = (e) => {
      if (busy) return
      if (!e.key || e.key.toLowerCase() !== 'z') return
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      if (isEditableTarget(/** @type {HTMLElement} */ (e.target))) return
      if (undoStackRef.current.length < 1) return
      e.preventDefault()
      undoLast()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, undoLast])

  const pageMarks = marks.filter((m) => m.pageIndex === activePage)
  const displayRects = pageMarks.map((m) => ({
    id: m.id,
    nx: m.nx,
    ny: m.ny,
    nw: m.nw,
    nh: m.nh,
    staged: m.staged,
  }))

  const normFromClient = useCallback((clientX, clientY) => {
    const wrap = wrapRef.current
    if (!wrap) return { nx: 0, ny: 0 }
    const r = wrap.getBoundingClientRect()
    return {
      nx: clamp((clientX - r.left) / Math.max(r.width, 1), 0, 1),
      ny: clamp((clientY - r.top) / Math.max(r.height, 1), 0, 1),
    }
  }, [])

  const onOverlayPointerDown = (e) => {
    if (busy) return
    e.preventDefault()
    const { nx, ny } = normFromClient(e.clientX, e.clientY)
    dragRef.current = { pid: e.pointerId, sx: nx, sy: ny }
    setDraft(null)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onOverlayPointerMove = (e) => {
    const d = dragRef.current
    if (!d || d.pid !== e.pointerId) return
    const { nx, ny } = normFromClient(e.clientX, e.clientY)
    const l = Math.min(d.sx, nx)
    const t = Math.min(d.sy, ny)
    const w = Math.abs(nx - d.sx)
    const h = Math.abs(ny - d.sy)
    setDraft({ nx: l, ny: t, nw: w, nh: h })
  }

  const onOverlayPointerUp = (e) => {
    const d = dragRef.current
    if (!d || d.pid !== e.pointerId) return
    dragRef.current = null
    setDraft(null)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const { nx, ny } = normFromClient(e.clientX, e.clientY)
    const l = Math.min(d.sx, nx)
    const t = Math.min(d.sy, ny)
    const w = Math.abs(nx - d.sx)
    const h = Math.abs(ny - d.sy)
    if (w >= MIN_D && h >= MIN_D) {
      setMarks((prev) => {
        undoStackRef.current.push([...prev])
        if (undoStackRef.current.length > 50) undoStackRef.current.shift()
        return [
          ...prev,
          { id: uid(), pageIndex: activePage, nx: l, ny: t, nw: w, nh: h, staged: false },
        ]
      })
      setCanUndo(true)
    }
  }

  const zoomIn = () => setZoomFactor((z) => Math.min(3, Math.round(z * 1.12 * 100) / 100))
  const zoomOut = () => setZoomFactor((z) => Math.max(0.5, Math.round((z / 1.12) * 100) / 100))
  const fitWidth = () => setZoomFactor(1)
  const zoomPct = Math.round(zoomFactor * 100)

  if (loadErr) {
    return <p className="text-sm text-red-600 dark:text-red-400">{loadErr}</p>
  }
  if (!pdfDoc) {
    return <p className="text-sm text-zinc-500">Loading preview…</p>
  }

  const overlayPointer = 'pointer-events-auto touch-none'

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 xl:flex-row xl:gap-0">
      <ThumbnailSidebar
        pdfDoc={pdfDoc}
        numPages={numPages}
        activePage={activePage}
        onSelectPage={setActivePage}
        pageRefs={pageRefs}
        scrollIntoViewOnSelect={false}
      />

      <div className="flex min-h-[min(70vh,720px)] min-w-0 flex-1 flex-col bg-zinc-200/40 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/95 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/95">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Drag on the page to draw redaction boxes. Scroll to move around. Undo with the button or ⌘Z / Ctrl+Z.
          </span>
        </div>

        <div
          ref={wrapOuterRef}
          className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto p-3"
        >
          <div
            ref={(el) => {
              wrapRef.current = el
              pageRefs.current[activePage] = el
            }}
            className="relative inline-block shadow-lg ring-1 ring-zinc-300/80 dark:ring-zinc-600"
          >
            <canvas
              ref={canvasRef}
              className="block bg-white dark:bg-zinc-100"
              style={{ verticalAlign: 'top' }}
            />
            <RedactMarksOverlay rects={displayRects} draft={draft} eraseMode={false} />
            <div
              className={`absolute inset-0 z-30 ${overlayPointer}`}
              style={{ cursor: 'crosshair' }}
              onPointerDown={onOverlayPointerDown}
              onPointerMove={onOverlayPointerMove}
              onPointerUp={onOverlayPointerUp}
              onPointerCancel={onOverlayPointerUp}
            />
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

      <aside className="flex w-full shrink-0 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 xl:w-[300px]">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Redact PDF</h2>

        <button
          type="button"
          disabled={busy || !canUndo}
          onClick={undoLast}
          className="w-full rounded-xl border border-zinc-300 bg-zinc-50 py-2.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          Undo last box
        </button>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Draw rectangles on the page to mark areas to black out. Use <strong className="text-zinc-700 dark:text-zinc-300">Undo</strong> or{' '}
          <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1 font-mono text-[10px] dark:border-zinc-600 dark:bg-zinc-800">⌘Z</kbd> /{' '}
          <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1 font-mono text-[10px] dark:border-zinc-600 dark:bg-zinc-800">Ctrl+Z</kbd> if you
          mis-draw. Finalize with Redact below.
        </p>
      </aside>
    </div>
  )
}
