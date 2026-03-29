import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { buildTextRuns, hitTestTextRunNearest } from '../lib/pdfTextRuns'

const RENDER_SCALE = 1.35

/**
 * Renders one PDF page with pdf.js and an interaction overlay.
 * Annotations use normalized coords (0–1, top-left origin) for pdf-lib on the server.
 */
export default function PdfPageCanvas({
  pdfPage,
  tool,
  items,
  onUpdateItems,
  onNativeTextEdit,
}) {
  const wrapRef = useRef(null)
  const pdfCanvasRef = useRef(null)
  const overlayRef = useRef(null)
  const metaRef = useRef({ pdfW: 1, pdfH: 1, cssW: 1, cssH: 1 })
  const [ready, setReady] = useState(false)
  const [textDraft, setTextDraft] = useState(null)
  const [, bump] = useState(0)
  const dragRef = useRef(null)
  const drawPointsRef = useRef(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const [textRuns, setTextRuns] = useState([])
  const textRunsRef = useRef([])
  textRunsRef.current = textRuns
  const [nativeEdit, setNativeEdit] = useState(null)
  const [textDiag, setTextDiag] = useState(null)

  const paintOverlay = useCallback((draftBox, draftLinePts) => {
    const overlay = overlayRef.current
    const pdfCv = pdfCanvasRef.current
    if (!overlay || !pdfCv || !pdfCv.width) return
    overlay.width = pdfCv.width
    overlay.height = pdfCv.height
    const ctx = overlay.getContext('2d')
    const w = overlay.width
    const h = overlay.height
    ctx.clearRect(0, 0, w, h)

    const drawItem = (it) => {
      switch (it.type) {
        case 'draw': {
          const pts = it.points || []
          if (pts.length < 2) break
          ctx.strokeStyle = it.color || '#111827'
          ctx.lineWidth = Math.max(1, it.lineWidthCss ?? 2)
          ctx.lineJoin = 'round'
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(pts[0].nx * w, pts[0].ny * h)
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].nx * w, pts[i].ny * h)
          }
          ctx.stroke()
          break
        }
        case 'highlight': {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.35)'
          ctx.fillRect(it.x * w, it.y * h, it.w * w, it.h * h)
          break
        }
        case 'rect': {
          ctx.strokeStyle = it.strokeColor || '#2563eb'
          ctx.lineWidth = Math.max(1, it.lineWidthCss ?? 2)
          ctx.strokeRect(it.x * w, it.y * h, it.w * w, it.h * h)
          break
        }
        case 'text': {
          ctx.fillStyle = it.color || '#111827'
          const fs = Math.max(10, it.fontSizeCss ?? 14)
          ctx.font = `${fs}px system-ui, sans-serif`
          ctx.textBaseline = 'top'
          ctx.fillText(it.text || '', it.x * w, it.y * h)
          break
        }
        default:
          break
      }
    }

    for (const it of itemsRef.current) drawItem(it)

    if (draftLinePts && draftLinePts.length >= 2) {
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(draftLinePts[0].nx * w, draftLinePts[0].ny * h)
      for (let i = 1; i < draftLinePts.length; i++) {
        ctx.lineTo(draftLinePts[i].nx * w, draftLinePts[i].ny * h)
      }
      ctx.stroke()
    }

    if (draftBox) {
      const x = Math.min(draftBox.x0, draftBox.x1) * w
      const y = Math.min(draftBox.y0, draftBox.y1) * h
      const rw = Math.abs(draftBox.x1 - draftBox.x0) * w
      const rh = Math.abs(draftBox.y1 - draftBox.y0) * h
      if (draftBox.mode === 'highlight') {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.35)'
        ctx.fillRect(x, y, rw, rh)
      } else {
        ctx.strokeStyle = '#2563eb'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, rw, rh)
      }
    }
  }, [])

  useEffect(() => {
    if (!pdfPage) return
    let cancelled = false
    const canvas = pdfCanvasRef.current
    const scale = RENDER_SCALE
    const viewport = pdfPage.getViewport({ scale })
    const base = pdfPage.getViewport({ scale: 1 })
    metaRef.current = {
      pdfW: base.width,
      pdfH: base.height,
      cssW: viewport.width,
      cssH: viewport.height,
    }
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    const task = pdfPage.render({ canvasContext: ctx, viewport })
    task.promise
      .then(() => {
        if (cancelled) return
        setReady(true)
      })
      .catch((e) => {
        if (cancelled) return
        if (e?.name === 'RenderingCancelledException') return
        console.error(e)
      })
    return () => {
      cancelled = true
      try {
        task.cancel()
      } catch {
        /* ignore */
      }
      setReady(false)
    }
  }, [pdfPage])

  // After the page has painted once, rebuild text runs (avoids racing an unready canvas in some cases).
  useEffect(() => {
    if (!pdfPage || !ready) return
    let cancelled = false
    const viewport = pdfPage.getViewport({ scale: RENDER_SCALE })
    pdfPage
      .getTextContent()
      .then((tc) => {
        if (cancelled) return
        const runs = buildTextRuns(viewport, tc)
        setTextRuns(runs)
        setTextDiag({ count: runs.length, scanned: true })
      })
      .catch(() => {
        if (!cancelled) {
          setTextRuns([])
          setTextDiag({ count: 0, scanned: true, error: true })
        }
      })
    return () => {
      cancelled = true
      setTextRuns([])
      setTextDiag(null)
    }
  }, [pdfPage, ready])

  useEffect(() => {
    if (tool !== 'editText') setNativeEdit(null)
  }, [tool])

  useEffect(() => {
    if (!ready) return
    paintOverlay()
  }, [ready, items, paintOverlay])

  /**
   * Keep the overlay’s CSS box and bitmap size locked to the PDF canvas.
   * Without this, `w-full` / `h-full` on the overlay can diverge from the scaled
   * PDF canvas so pointer events miss the overlay and tools feel “broken”.
   */
  useLayoutEffect(() => {
    const pdf = pdfCanvasRef.current
    const overlay = overlayRef.current
    if (!pdf || !overlay || !ready) return

    let cancelled = false
    const sync = () => {
      if (cancelled) return
      const cw = pdf.clientWidth
      const ch = pdf.clientHeight
      if (cw < 2 || ch < 2) return
      overlay.style.width = `${cw}px`
      overlay.style.height = `${ch}px`
      overlay.width = pdf.width
      overlay.height = pdf.height
      paintOverlay()
      bump((n) => n + 1)
    }

    sync()
    // Flex/grid layout often settles after the first frame; retry so the overlay matches the PDF canvas.
    const id1 = requestAnimationFrame(() => sync())
    let idInner = 0
    const id2 = requestAnimationFrame(() => {
      idInner = requestAnimationFrame(() => sync())
    })
    const ro = new ResizeObserver(() => sync())
    ro.observe(pdf)
    return () => {
      cancelled = true
      cancelAnimationFrame(id1)
      cancelAnimationFrame(id2)
      cancelAnimationFrame(idInner)
      ro.disconnect()
    }
  }, [pdfPage, ready, paintOverlay])

  const normPoint = (e) => {
    const overlay = overlayRef.current
    if (!overlay) return null
    const r = overlay.getBoundingClientRect()
    if (r.width < 1 || r.height < 1 || !overlay.width || !overlay.height) return null
    const scaleX = overlay.width / r.width
    const scaleY = overlay.height / r.height
    const x = (e.clientX - r.left) * scaleX
    const y = (e.clientY - r.top) * scaleY
    const w = overlay.width
    const h = overlay.height
    if (x < 0 || y < 0 || x > w || y > h) return null
    return { nx: x / w, ny: y / h, x, y }
  }

  const onPointerDown = (e) => {
    if (!tool || !ready) return
    if (tool === 'editText') return
    const n = normPoint(e)
    if (!n) return

    if (tool === 'text') {
      setTextDraft({ nx: n.nx, ny: n.ny })
      e.preventDefault()
      return
    }

    if (tool === 'draw') {
      drawPointsRef.current = [{ nx: n.nx, ny: n.ny }]
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
      return
    }

    if (tool === 'highlight' || tool === 'rect') {
      dragRef.current = { mode: tool, x0: n.nx, y0: n.ny, x1: n.nx, y1: n.ny }
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
    }
  }

  const onPointerMove = (e) => {
    if (tool === 'editText') return
    if (tool === 'draw' && drawPointsRef.current) {
      const n = normPoint(e)
      if (!n) return
      const last = drawPointsRef.current[drawPointsRef.current.length - 1]
      const dx = n.nx - last.nx
      const dy = n.ny - last.ny
      if (dx * dx + dy * dy > 0.000004) {
        drawPointsRef.current.push({ nx: n.nx, ny: n.ny })
        paintOverlay(null, drawPointsRef.current)
      }
      e.preventDefault()
      return
    }

    if (dragRef.current) {
      const n = normPoint(e)
      if (!n) return
      dragRef.current.x1 = n.nx
      dragRef.current.y1 = n.ny
      paintOverlay({
        mode: dragRef.current.mode,
        x0: dragRef.current.x0,
        y0: dragRef.current.y0,
        x1: dragRef.current.x1,
        y1: dragRef.current.y1,
      })
      e.preventDefault()
    }
  }

  const onPointerUp = (e) => {
    if (tool === 'editText') return
    if (tool === 'draw' && drawPointsRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const pts = drawPointsRef.current
      drawPointsRef.current = null
      if (pts && pts.length > 1) {
        const { pdfW, cssW } = metaRef.current
        const ratio = pdfW / cssW
        onUpdateItems((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'draw',
            points: pts,
            color: '#111827',
            strokeWidth: Math.max(0.5, 2 * ratio),
            lineWidthCss: 2,
          },
        ])
      }
      paintOverlay()
      e.preventDefault()
      return
    }

    if (dragRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const d = dragRef.current
      dragRef.current = null
      const x = Math.min(d.x0, d.x1)
      const y = Math.min(d.y0, d.y1)
      const w = Math.abs(d.x1 - d.x0)
      const h = Math.abs(d.y1 - d.y0)
      if (w < 0.005 || h < 0.005) {
        paintOverlay()
        return
      }
      if (d.mode === 'highlight') {
        onUpdateItems((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'highlight',
            x,
            y,
            w,
            h,
            color: '#fff176',
            opacity: 0.35,
          },
        ])
      } else {
        const { pdfW, cssW } = metaRef.current
        const ratio = pdfW / cssW
        onUpdateItems((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'rect',
            x,
            y,
            w,
            h,
            strokeColor: '#2563eb',
            strokeWidth: Math.max(0.5, 2 * ratio),
            lineWidthCss: 2,
          },
        ])
      }
      paintOverlay()
      e.preventDefault()
    }
  }

  const commitText = (value) => {
    if (!textDraft) return
    const v = value.trim()
    setTextDraft(null)
    if (!v) return
    const { pdfW, cssW } = metaRef.current
    const ratio = pdfW / cssW
    onUpdateItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'text',
        x: textDraft.nx,
        y: textDraft.ny,
        text: v,
        fontSize: Math.max(8, 14 * ratio),
        fontSizeCss: 14,
        color: '#111827',
      },
    ])
  }

  const cv = pdfCanvasRef.current
  const cw = cv?.clientWidth ?? 0
  const ch = cv?.clientHeight ?? 0

  const overlayActive = tool && tool !== 'editText'

  const openNativeEditorForRun = useCallback((run, pdfEl) => {
    const r = pdfEl.getBoundingClientRect()
    const sx = r.width / pdfEl.width
    const sy = r.height / pdfEl.height
    setNativeEdit({
      run,
      leftCss: run.left * sx,
      topCss: run.top * sy,
      widthCss: Math.max(run.width * sx, 64),
      heightCss: Math.max(run.height * sy, (run.fontSizePx * sx) * 1.35),
      fontSizeCss: Math.max(10, run.fontSizePx * sx),
    })
  }, [])

  const onEditTextPointerDown = useCallback(
    (e) => {
      if (tool !== 'editText' || !ready) return
      const pdf = pdfCanvasRef.current
      const runs = textRunsRef.current
      if (!pdf || runs.length === 0) return
      const r = pdf.getBoundingClientRect()
      if (r.width < 2 || r.height < 2 || !pdf.width || !pdf.height) return
      const bx = (e.clientX - r.left) * (pdf.width / r.width)
      const by = (e.clientY - r.top) * (pdf.height / r.height)
      const run = hitTestTextRunNearest(runs, bx, by)
      if (!run) return
      e.preventDefault()
      e.stopPropagation()
      openNativeEditorForRun(run, pdf)
    },
    [tool, ready, openNativeEditorForRun]
  )

  const commitNativeEdit = (value) => {
    if (!nativeEdit) {
      setNativeEdit(null)
      return
    }
    const { run } = nativeEdit
    setNativeEdit(null)
    if (value === run.str) return
    onNativeTextEdit?.({ pdf: run.pdf, norm: run.norm, text: value })
  }

  return (
    <div ref={wrapRef} className="relative block w-full max-w-full shadow-md">
      <canvas
        ref={pdfCanvasRef}
        className="relative z-0 block h-auto w-full max-w-full touch-none bg-white"
      />
      <canvas
        ref={overlayRef}
        className={`absolute left-0 top-0 touch-none ${
          overlayActive ? 'z-10 cursor-crosshair' : 'pointer-events-none z-[1]'
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {tool === 'editText' && ready && (
        <div
          role="application"
          aria-label="Click PDF text to edit"
          className="absolute inset-0 z-[20] cursor-text touch-none"
          style={{ touchAction: 'none' }}
          onPointerDown={onEditTextPointerDown}
        />
      )}
      {tool === 'editText' && ready && !textDiag?.scanned && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 z-[5] rounded bg-zinc-200/90 px-2 py-1 text-center text-[11px] text-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-300">
          Detecting text on this page…
        </div>
      )}
      {tool === 'editText' &&
        ready &&
        textDiag?.scanned &&
        textDiag.count === 0 &&
        !textDiag.error && (
          <div className="pointer-events-none absolute inset-x-0 bottom-1 z-[5] rounded bg-amber-100/95 px-2 py-1 text-center text-[11px] text-amber-950 dark:bg-amber-950/90 dark:text-amber-100">
            No selectable text on this page (try a text-based PDF, not a scan).
          </div>
        )}
      {nativeEdit && (
        <textarea
          key={`${nativeEdit.run.pdf.x}-${nativeEdit.run.pdf.y}-${nativeEdit.run.pdf.baseline}`}
          autoFocus
          className="absolute z-[30] resize-none rounded border-2 border-indigo-500 bg-white/98 p-1 text-zinc-900 shadow-lg outline-none dark:bg-zinc-900 dark:text-zinc-50"
          style={{
            left: nativeEdit.leftCss,
            top: nativeEdit.topCss,
            width: nativeEdit.widthCss,
            minHeight: nativeEdit.heightCss,
            fontSize: `${nativeEdit.fontSizeCss}px`,
            lineHeight: 1.2,
            fontFamily: 'system-ui, sans-serif',
          }}
          defaultValue={nativeEdit.run.str}
          onBlur={(e) => commitNativeEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              setNativeEdit(null)
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
        />
      )}
      {textDraft && cw > 0 && (
        <input
          autoFocus
          className="absolute z-20 min-w-[120px] rounded border border-indigo-400 bg-white/95 px-2 py-1 text-sm shadow dark:bg-zinc-900"
          style={{
            left: textDraft.nx * cw,
            top: textDraft.ny * ch,
          }}
          placeholder="Type text…"
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitText(e.currentTarget.value)
            }
            if (e.key === 'Escape') setTextDraft(null)
          }}
        />
      )}
    </div>
  )
}
