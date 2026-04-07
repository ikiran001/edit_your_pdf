import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { buildTextRuns } from '../lib/pdfTextRuns'
import { sampleBackgroundColorHex, sampleInkColorHex } from '../lib/sampleCanvasInkColor'
import { buildPageTextBlocks } from '../lib/textLayerManager'
import { editorFontFamilyWithPdfHint } from '../lib/editorUnicodeFonts'
import {
  cssDisplayFontFromPdf,
  defaultTextFormat,
  formatFromTextBlock,
  mapPdfFontNameToServer,
  mergePdfStyleHints,
} from '../lib/textFormatDefaults'

const RENDER_SCALE = 1.35

/** Hex #RGB / #RRGGBB → rgba() for translucent highlights (no solid blocks). */
function hexToRgba(hex, opacity) {
  const h = String(hex || '#facc15').replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const n = parseInt(full, 16)
  if (!Number.isFinite(n)) return `rgba(250, 204, 21, ${opacity})`
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  let a = Number(opacity)
  if (!Number.isFinite(a)) a = 0.35
  a = Math.min(1, Math.max(0.05, a))
  return `rgba(${r},${g},${b},${a})`
}

/** Normalize for comparing contenteditable value vs baseline (opening string). */
function normalizeNativeCompare(s) {
  return String(s ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim()
}

function snapshotNativeFormat(f) {
  const fmt = f ?? defaultTextFormat()
  return {
    bold: !!fmt.bold,
    italic: !!fmt.italic,
    underline: !!fmt.underline,
    align: String(fmt.align || 'left'),
    color: String(fmt.color || '#000000')
      .trim()
      .toLowerCase(),
    opacity: Number(fmt.opacity ?? 1),
    rotationDeg: Number(fmt.rotationDeg ?? 0),
    fontFamily: String(fmt.fontFamily || 'Helvetica'),
    fontSizeCss: Number(fmt.fontSizeCss) || 14,
  }
}

function nativeFormatSnapshotsEqual(a, b) {
  if (!a || !b) return false
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.align === b.align &&
    a.color === b.color &&
    a.opacity === b.opacity &&
    a.rotationDeg === b.rotationDeg &&
    a.fontFamily === b.fontFamily &&
    a.fontSizeCss === b.fontSizeCss
  )
}

/**
 * Find persisted native replacement for this line (block ids can change after reload; PDF x/y/baseline are stable).
 */
function sessionNativeStringForBlock(block, pageIndex, sessionNatives) {
  if (!sessionNatives?.length) return null
  const bx = Number(block.pdf?.x)
  const by = Number(block.pdf?.y)
  const bb = Number(block.pdf?.baseline)
  if (!Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bb)) return null
  const eps = 1.5
  for (const n of sessionNatives) {
    if (Number(n.pageIndex) !== pageIndex) continue
    const nx = Number(n.x)
    const ny = Number(n.y)
    const nb = Number(n.baseline)
    if (
      Number.isFinite(nx) &&
      Number.isFinite(ny) &&
      Number.isFinite(nb) &&
      Math.abs(nx - bx) < eps &&
      Math.abs(ny - by) < eps &&
      Math.abs(nb - bb) < eps
    ) {
      return n.text != null ? String(n.text) : null
    }
  }
  return null
}

/**
 * Renders one PDF page with pdf.js and an interaction overlay.
 * Annotations use normalized coords (0–1, top-left origin) for pdf-lib on the server.
 */
export default function PdfPageCanvas({
  pdfPage,
  pageIndex = 0,
  tool,
  items,
  onUpdateItems,
  onNativeTextEdit,
  /** Parent SSOT: stable block id → display string (from pdf.js once, then overrides). */
  blockTextOverrides = {},
  /** Server-persisted native edits; used so display text is the saved string, not pdf.js duplicate concat. */
  sessionNativeTextEdits = [],
  textFormat,
  textFormatRef,
  onBeginNativeTextEdit,
  editTextMode = true,
  onInlineEditorActiveChange,
}) {
  const pdfCanvasRef = useRef(null)
  const overlayRef = useRef(null)
  const metaRef = useRef({ pdfW: 1, pdfH: 1, cssW: 1, cssH: 1 })
  const [ready, setReady] = useState(false)
  /** CSS box + bitmap size for scaling text layer (canvas px ↔ layout px). */
  const [canvasLayout, setCanvasLayout] = useState({ cssW: 0, cssH: 0, bmpW: 1, bmpH: 1 })
  const [textDraft, setTextDraft] = useState(null)
  const dragRef = useRef(null)
  const drawPointsRef = useRef(null)
  const [textRuns, setTextRuns] = useState([])
  const baseTextBlocks = useMemo(
    () => buildPageTextBlocks(textRuns, pageIndex),
    [textRuns, pageIndex]
  )

  const textBlocks = useMemo(() => {
    const o = blockTextOverrides || {}
    return baseTextBlocks.map((b) => {
      const fromSession = sessionNativeStringForBlock(b, pageIndex, sessionNativeTextEdits)
      let str = b.str
      if (fromSession != null) str = fromSession
      if (Object.prototype.hasOwnProperty.call(o, b.id)) str = o[b.id]
      return { ...b, str }
    })
  }, [baseTextBlocks, blockTextOverrides, pageIndex, sessionNativeTextEdits])
  const textBlocksRef = useRef(textBlocks)
  const [nativeEdit, setNativeEdit] = useState(null)
  const nativeEditRef = useRef(null)
  const nativeEditorElRef = useRef(null)
  const nativeBlurTimerRef = useRef(null)
  /** Debounce parent `onNativeTextEdit` so typing does not re-render the whole page every key. */
  const nativeSyncTimerRef = useRef(null)
  /** String shown when the inline editor opened — skip parent updates if unchanged (avoids stacking duplicate drawText on save). */
  const nativeOpenBaselineStrRef = useRef('')
  /** Toolbar snapshot at open — so bold/italic/underline-only edits still persist when text is unchanged. */
  const nativeOpenBaselineFormatRef = useRef(null)
  /** PDF user-space font size from the text item (`block.pdf.fontSize`) — authoritative for saved output. */
  const nativeOpenBaselinePdfFontSizeRef = useRef(null)
  const [hoverBlockId, setHoverBlockId] = useState(null)

  useEffect(() => {
    nativeEditRef.current = nativeEdit
  }, [nativeEdit])

  useLayoutEffect(() => {
    textBlocksRef.current = textBlocks
  }, [textBlocks])

  /** Toolbar B / I / U (and related) must apply even when onInput does not run — push to the live contenteditable. */
  useLayoutEffect(() => {
    if (!nativeEdit) return
    const el = nativeEditorElRef.current
    if (!el) return
    const f = textFormatRef?.current ?? textFormat ?? defaultTextFormat()
    const b = nativeEdit.block
    el.style.fontFamily = editorFontFamilyWithPdfHint(
      cssDisplayFontFromPdf(b.pdfFontFamily, f.fontFamily)
    )
    el.style.fontWeight = f.bold ? '700' : '400'
    el.style.fontStyle = f.italic ? 'italic' : 'normal'
    el.style.textDecoration = f.underline ? 'underline' : 'none'
    el.style.textDecorationLine = f.underline ? 'underline' : 'none'
    el.style.textAlign = f.align || 'left'
    el.style.color = f.color || '#000000'
    el.style.opacity = String(f.opacity ?? 1)
    el.style.whiteSpace = 'pre-wrap'
    el.style.overflowWrap = 'break-word'
    el.style.backgroundColor = nativeEdit.maskFillHex || '#ffffff'
  }, [nativeEdit, textFormat])

  const [textDiag, setTextDiag] = useState(null)

  const paintOverlay = useCallback((draftBox, draftLinePts) => {
    const overlay = overlayRef.current
    const pdfCv = pdfCanvasRef.current
    if (!overlay || !pdfCv || !pdfCv.width) return
    overlay.width = pdfCv.width
    overlay.height = pdfCv.height
    const ctx = overlay.getContext('2d', { alpha: true })
    if (!ctx) return
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
          const hiOp = Number(it.opacity)
          const op = Number.isFinite(hiOp) ? Math.min(1, Math.max(0.05, hiOp)) : 0.35
          ctx.fillStyle = hexToRgba(it.color, op)
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

    for (const it of items) drawItem(it)

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
        ctx.fillStyle = hexToRgba('#facc15', 0.35)
        ctx.fillRect(x, y, rw, rh)
      } else {
        ctx.strokeStyle = '#2563eb'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, rw, rh)
      }
    }
  }, [items])

  /* Single pipeline: render page → then extract text. Avoids ready flicker and races where a
   * cancelled render leaves a partial canvas (torn underlines) while getTextContent runs again. */
  useEffect(() => {
    if (!pdfPage) return
    let cancelled = false
    const canvas = pdfCanvasRef.current
    if (!canvas) return
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
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) {
      setTextDiag({ count: 0, scanned: true, error: true })
      setReady(true)
      return () => {}
    }
    const task = pdfPage.render({ canvasContext: ctx, viewport })

    task.promise
      .then(() => {
        if (cancelled) return null
        return pdfPage.getTextContent()
      })
      .then((tc) => {
        if (cancelled || tc == null) return
        const runs = buildTextRuns(viewport, tc)
        setTextRuns(runs)
        setTextDiag({ count: runs.length, scanned: true })
        setReady(true)
      })
      .catch((e) => {
        if (cancelled) return
        if (e?.name === 'RenderingCancelledException') return
        console.error(e)
        setTextRuns([])
        setTextDiag({ count: 0, scanned: true, error: true })
        setReady(true)
      })

    return () => {
      cancelled = true
      try {
        task.cancel()
      } catch {
        /* ignore */
      }
      const c = pdfCanvasRef.current
      const cx = c?.getContext?.('2d')
      if (c && cx && c.width > 0 && c.height > 0) {
        cx.setTransform(1, 0, 0, 1, 0, 0)
        cx.fillStyle = '#ffffff'
        cx.fillRect(0, 0, c.width, c.height)
      }
      setReady(false)
      setTextRuns([])
      setTextDiag(null)
    }
  }, [pdfPage])

  useEffect(() => {
    if (tool !== 'editText' || !editTextMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- exit inline editor when tool/mode off
      setNativeEdit(null)
    }
  }, [tool, editTextMode])

  useEffect(() => {
    onInlineEditorActiveChange?.(!!nativeEdit)
  }, [nativeEdit, onInlineEditorActiveChange])

  useEffect(() => {
    return () => {
      if (nativeBlurTimerRef.current) window.clearTimeout(nativeBlurTimerRef.current)
      if (nativeSyncTimerRef.current) window.clearTimeout(nativeSyncTimerRef.current)
    }
  }, [])

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
      setCanvasLayout({
        cssW: cw,
        cssH: ch,
        bmpW: pdf.width || 1,
        bmpH: pdf.height || 1,
      })
      overlay.style.width = `${cw}px`
      overlay.style.height = `${ch}px`
      overlay.width = pdf.width
      overlay.height = pdf.height
      paintOverlay()
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

  const { cssW: cw, cssH: ch, bmpW, bmpH } = canvasLayout
  const sx = bmpW > 0 ? cw / bmpW : 1
  const sy = bmpH > 0 ? ch / bmpH : 1
  const overlayActive = tool && tool !== 'editText'

  const showTextLayer = editTextMode && tool === 'editText' && ready

  const openNativeEditorForBlock = useCallback(
    (block) => {
      if (nativeSyncTimerRef.current != null) {
        window.clearTimeout(nativeSyncTimerRef.current)
        nativeSyncTimerRef.current = null
      }
      const id = block.id
      nativeOpenBaselineStrRef.current =
        textBlocksRef.current.find((b) => b.id === id)?.str ?? ''
      const pdfFs = Number(block.pdf?.fontSize)
      nativeOpenBaselinePdfFontSizeRef.current =
        Number.isFinite(pdfFs) && pdfFs > 0 ? pdfFs : null
      const cv = pdfCanvasRef.current
      let sampleColorHex = null
      if (cv?.width) {
        sampleColorHex = sampleInkColorHex(
          cv,
          block.left + block.width * 0.5,
          block.top + block.height * 0.5
        )
      }
      const { pdfW, cssW } = metaRef.current
      const pdfToCssScale = cssW > 0 ? pdfW / cssW : 1
      const layoutHint = Number.isFinite(pdfToCssScale) && pdfToCssScale > 0 ? { pdfToCssScale } : undefined
      const prevFmt = textFormatRef?.current ?? textFormat ?? defaultTextFormat()
      try {
        const presetFormat = formatFromTextBlock(
          block,
          prevFmt,
          sampleColorHex ?? undefined,
          layoutHint
        )
        onBeginNativeTextEdit?.(block, {
          sampleColorHex: sampleColorHex ?? undefined,
          presetFormat,
          layoutHint,
        })
      } catch (err) {
        console.error('formatFromTextBlock failed', err)
        onBeginNativeTextEdit?.(block, {
          sampleColorHex: sampleColorHex ?? undefined,
          layoutHint,
        })
      }
      let maskFillHex = '#ffffff'
      if (cv?.width && block.width > 0 && block.height > 0) {
        maskFillHex = sampleBackgroundColorHex(cv, block.left, block.top, block.width, block.height)
      }
      setNativeEdit({ block, maskFillHex })
    },
    [onBeginNativeTextEdit, textFormat, textFormatRef]
  )

  /** Capture format once when edit opens only (`nativeEdit` deps — not `textFormat`, or toggling B/I/U would reset baseline). */
  useLayoutEffect(() => {
    if (!nativeEdit) {
      nativeOpenBaselineFormatRef.current = null
      nativeOpenBaselinePdfFontSizeRef.current = null
      return
    }
    nativeOpenBaselineFormatRef.current = snapshotNativeFormat(
      textFormatRef?.current ?? textFormat ?? defaultTextFormat()
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot only on open/close; textFormat on that render is correct
  }, [nativeEdit])

  /**
   * Seed from `textBlocksRef` (latest overrides), not `nativeEdit.block.str` (stale snapshot).
   * One rAF pass for focus if the keyed node mounts after the first layout read.
   */
  useLayoutEffect(() => {
    if (!nativeEdit) return
    const id = nativeEdit.block.id
    const readStr = () => textBlocksRef.current.find((b) => b.id === id)?.str ?? ''
    const str = readStr()
    const el = nativeEditorElRef.current
    if (el && nativeEditRef.current?.block?.id === id && el.textContent !== str) {
      el.textContent = str
    }
    const raf = requestAnimationFrame(() => {
      if (nativeEditRef.current?.block?.id !== id) return
      const el2 = nativeEditorElRef.current
      if (!el2) return
      const latest = readStr()
      if (el2.textContent !== latest) el2.textContent = latest
      el2.focus()
      try {
        const sel = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(el2)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      } catch {
        /* ignore */
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [nativeEdit])

  const buildNativePayload = useCallback((block, text) => {
    const fmt = textFormatRef?.current ?? textFormat ?? defaultTextFormat()
    const { pdfW, cssW } = metaRef.current
    const ratio = cssW > 0 ? pdfW / cssW : 1
    const curSnap = snapshotNativeFormat(fmt)
    const openFmt = nativeOpenBaselineFormatRef.current
    const openPdfFs = nativeOpenBaselinePdfFontSizeRef.current

    const sizeToolbarTouched = !!(openFmt && openFmt.fontSizeCss !== curSnap.fontSizeCss)
    const pdfFontSizeFromCss = Math.max(4, Math.min(144, (fmt.fontSizeCss || 14) * ratio))
    const pdfFontSize =
      !sizeToolbarTouched && openPdfFs != null && Number.isFinite(openPdfFs) && openPdfFs > 0
        ? Math.max(4, Math.min(144, openPdfFs))
        : pdfFontSizeFromCss

    const bioTouched =
      !openFmt ||
      openFmt.bold !== curSnap.bold ||
      openFmt.italic !== curSnap.italic ||
      openFmt.fontFamily !== curSnap.fontFamily
    const fromHints = mergePdfStyleHints(block.pdfFontFamily || '')
    const bold = bioTouched ? !!fmt.bold : !!(block.sourceBold || fromHints.bold)
    const italic = bioTouched ? !!fmt.italic : !!(block.sourceItalic || fromHints.italic)
    const fontFamily = bioTouched
      ? String(fmt.fontFamily || 'Helvetica')
      : String(block.serverFontFamily || mapPdfFontNameToServer(block.pdfFontFamily))

    const decorTouched = !openFmt || openFmt.underline !== curSnap.underline
    const underline = decorTouched
      ? !!fmt.underline
      : !!(block.sourceUnderline || fromHints.underline)

    const alignTouched = openFmt && openFmt.align !== curSnap.align
    const align = alignTouched ? fmt.align || 'left' : curSnap.align || fmt.align || 'left'

    let maskColor = '#ffffff'
    const cv = pdfCanvasRef.current
    const editing = nativeEditRef.current
    if (
      editing?.block?.id === block.id &&
      typeof editing.maskFillHex === 'string' &&
      editing.maskFillHex
    ) {
      maskColor = editing.maskFillHex
    } else if (cv?.width && block.width > 0 && block.height > 0) {
      maskColor = sampleBackgroundColorHex(cv, block.left, block.top, block.width, block.height)
    }

    return {
      blockId: block.id,
      pdf: block.pdf,
      norm: block.norm,
      text,
      fontSize: pdfFontSize,
      fontFamily,
      bold,
      italic,
      underline,
      align,
      color: fmt.color || '#000000',
      opacity: fmt.opacity ?? 1,
      rotationDeg: fmt.rotationDeg ?? 0,
      maskColor,
    }
  }, [textFormat, textFormatRef])

  const flushNativeSyncTimer = useCallback(() => {
    if (nativeSyncTimerRef.current != null) {
      window.clearTimeout(nativeSyncTimerRef.current)
      nativeSyncTimerRef.current = null
    }
  }, [])

  const scheduleNativeSync = useCallback(
    (block) => {
      const blockId = block.id
      if (nativeSyncTimerRef.current != null) window.clearTimeout(nativeSyncTimerRef.current)
      nativeSyncTimerRef.current = window.setTimeout(() => {
        nativeSyncTimerRef.current = null
        if (nativeEditRef.current?.block?.id !== blockId) return
        const el = nativeEditorElRef.current
        if (!el) return
        const raw = el.innerText ?? ''
        const textSame =
          normalizeNativeCompare(raw) === normalizeNativeCompare(nativeOpenBaselineStrRef.current)
        const openFmt = nativeOpenBaselineFormatRef.current
        const curFmt = snapshotNativeFormat(textFormatRef?.current ?? defaultTextFormat())
        const formatSame = openFmt && nativeFormatSnapshotsEqual(openFmt, curFmt)
        if (textSame && formatSame) return
        onNativeTextEdit?.(buildNativePayload(block, raw))
      }, 280)
    },
    [onNativeTextEdit, buildNativePayload]
  )

  /** Push toolbar-only changes (B/I/U, color, …) to parent even if the string never changed. */
  useEffect(() => {
    if (!nativeEdit) return
    scheduleNativeSync(nativeEdit.block)
  }, [textFormat, nativeEdit, scheduleNativeSync])

  /** Toolbar “Insert symbol” dispatches this so Unicode (₹, ✓, …) lands in the active editor. */
  useEffect(() => {
    if (!nativeEdit) return
    const onIns = (e) => {
      const t = e.detail?.text
      if (typeof t !== 'string' || !t) return
      const el = nativeEditorElRef.current
      const block = nativeEditRef.current?.block
      if (!el || !block) return
      el.focus()
      try {
        document.execCommand('insertText', false, t)
      } catch {
        el.textContent = (el.textContent ?? '') + t
      }
      scheduleNativeSync(block)
    }
    document.addEventListener('pdfpilot-native-insert', onIns)
    return () => document.removeEventListener('pdfpilot-native-insert', onIns)
  }, [nativeEdit, scheduleNativeSync])

  const commitNativeEdit = useCallback(
    (value) => {
      if (nativeBlurTimerRef.current) {
        window.clearTimeout(nativeBlurTimerRef.current)
        nativeBlurTimerRef.current = null
      }
      flushNativeSyncTimer()
      const current = nativeEditRef.current
      if (!current) {
        setNativeEdit(null)
        return
      }
      nativeEditRef.current = null
      const { block } = current
      setNativeEdit(null)
      const baseline = nativeOpenBaselineStrRef.current
      nativeOpenBaselineStrRef.current = ''
      const openFmt = nativeOpenBaselineFormatRef.current
      nativeOpenBaselineFormatRef.current = null
      const textSame = normalizeNativeCompare(value) === normalizeNativeCompare(baseline)
      const curFmt = snapshotNativeFormat(textFormatRef?.current ?? defaultTextFormat())
      const formatSame = openFmt && nativeFormatSnapshotsEqual(openFmt, curFmt)
      if (textSame && formatSame) {
        return
      }
      onNativeTextEdit?.(buildNativePayload(block, value))
    },
    [onNativeTextEdit, buildNativePayload, flushNativeSyncTimer]
  )

  /** Click outside textarea / format panel commits (canvas is not focusable — blur alone is unreliable). */
  useEffect(() => {
    if (!nativeEdit) return
    const onDocPointerDown = (e) => {
      const t = e.target
      if (t.closest?.('[data-pdf-inline-editor-root]')) return
      if (t.closest?.('[data-text-format-panel]')) return
      const el = nativeEditorElRef.current
      if (el && nativeEditRef.current) {
        commitNativeEdit(el.innerText ?? '')
      }
    }
    document.addEventListener('pointerdown', onDocPointerDown, true)
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true)
  }, [nativeEdit, commitNativeEdit])

  return (
    <div className="relative block w-full max-w-full shadow-md">
      <canvas
        ref={pdfCanvasRef}
        className={`relative z-0 block h-auto w-full max-w-full touch-none bg-white ${
          showTextLayer ? 'pointer-events-none' : ''
        }`}
      />
      <canvas
        ref={overlayRef}
        className={`absolute left-0 top-0 touch-none bg-transparent ${
          overlayActive ? 'z-10 cursor-crosshair' : 'pointer-events-none z-[1]'
        }`}
        style={{ background: 'transparent' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {showTextLayer && cw > 0 && ch > 0 && (
        <div
          role="group"
          aria-label="PDF text — tap a line to edit"
          className="pointer-events-none absolute left-0 top-0 z-[15]"
          style={{
            width: cw,
            height: ch,
            overflow: nativeEdit ? 'visible' : undefined,
          }}
        >
          {textBlocks.map((block) => {
            const isEditing = nativeEdit?.block?.id === block.id
            const w = Math.max(block.width * sx, 4)
            const h = Math.max(block.height * sy, Math.max(10, block.fontSizePx * sy * 1.15))
            const left = block.left * sx
            const top = block.top * sy
            /* Viewport font size (pdf.js space) → CSS px on screen: same scale as left/top (avoids huge/blurry text). */
            const fmt = textFormat ?? defaultTextFormat()
            const viewportFont = fmt.fontSizeCss ?? block.fontSizePx
            const editorFontCssPx = Math.max(6, Math.min(240, viewportFont * sx))
            const rotDeg = fmt.rotationDeg ?? 0
            const editFontFamily = editorFontFamilyWithPdfHint(
              cssDisplayFontFromPdf(block.pdfFontFamily, fmt.fontFamily)
            )
            const editorLineHeightPx = Math.max(14, Math.round(editorFontCssPx * 1.2))
            /* PDF block box can be shorter than one rendered line (line-height + border); without this the
               contenteditable overflows vertically and always shows a scrollbar. */
            const wrapperMinH = isEditing
              ? Math.max(h, editorLineHeightPx + 4)
              : h
            /* No scrollbars: wrap inside PDF width and grow height; overflow stays hidden. */
            const wrapperStyle = isEditing
              ? {
                  left,
                  top,
                  width: w,
                  minHeight: wrapperMinH,
                  height: 'auto',
                  zIndex: 2,
                }
              : { left, top, width: w, minHeight: wrapperMinH, height: wrapperMinH }
            return (
              <div
                key={block.id}
                className="pointer-events-auto absolute touch-manipulation"
                style={wrapperStyle}
                title={isEditing ? undefined : 'Tap to edit'}
                data-text-block-id={block.id}
              >
                {isEditing ? (
                  <div
                    key={`${block.id}__editing`}
                    ref={(el) => {
                      nativeEditorElRef.current = el
                    }}
                    role="textbox"
                    tabIndex={0}
                    contentEditable
                    suppressContentEditableWarning
                    data-pdf-inline-editor-root
                    className="pdf-text-layer-editor relative z-[1] box-border cursor-text select-text overflow-hidden rounded-sm border border-solid border-[#4A90E2] outline-none transition-[border-color,background-color] duration-150"
                    style={{
                      colorScheme: 'light',
                      backgroundColor: nativeEdit?.maskFillHex || '#ffffff',
                      fontSize: `${editorFontCssPx}px`,
                      lineHeight: editorLineHeightPx + 'px',
                      fontFamily: editFontFamily,
                      fontWeight: fmt.bold ? 700 : 400,
                      fontStyle: fmt.italic ? 'italic' : 'normal',
                      textDecoration: fmt.underline ? 'underline' : 'none',
                      textAlign: fmt.align,
                      color: fmt.color,
                      opacity: fmt.opacity ?? 1,
                      transform: rotDeg ? `rotate(${rotDeg}deg)` : 'none',
                      transformOrigin: rotDeg ? 'top left' : undefined,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'break-word',
                    }}
                    onFocus={() => {
                      if (nativeBlurTimerRef.current) {
                        window.clearTimeout(nativeBlurTimerRef.current)
                        nativeBlurTimerRef.current = null
                      }
                    }}
                    onBlur={(e) => {
                      const related = e.relatedTarget
                      if (
                        related &&
                        typeof related.closest === 'function' &&
                        related.closest('[data-text-format-panel]')
                      ) {
                        nativeBlurTimerRef.current = window.setTimeout(() => {
                          nativeBlurTimerRef.current = null
                          e.currentTarget.focus({ preventScroll: true })
                        }, 0)
                        return
                      }
                      if (nativeBlurTimerRef.current) window.clearTimeout(nativeBlurTimerRef.current)
                      nativeBlurTimerRef.current = window.setTimeout(() => {
                        nativeBlurTimerRef.current = null
                        if (!nativeEditRef.current) return
                        const el = nativeEditorElRef.current
                        commitNativeEdit(el?.innerText ?? '')
                      }, 0)
                    }}
                    onInput={(e) => {
                      const el = e.currentTarget
                      const f = textFormat ?? defaultTextFormat()
                      const vfs = f.fontSizeCss ?? block.fontSizePx
                      el.style.colorScheme = 'light'
                      el.style.backgroundColor =
                        nativeEditRef.current?.maskFillHex || '#ffffff'
                      el.style.fontSize = `${Math.max(6, Math.min(240, vfs * sx))}px`
                      el.style.fontFamily = editorFontFamilyWithPdfHint(
                        cssDisplayFontFromPdf(block.pdfFontFamily, f.fontFamily)
                      )
                      el.style.color = f.color
                      el.style.fontWeight = f.bold ? '700' : '400'
                      el.style.fontStyle = f.italic ? 'italic' : 'normal'
                      el.style.textDecoration = f.underline ? 'underline' : 'none'
                      const lh = Math.max(14, Math.round(Math.max(6, Math.min(240, vfs * sx)) * 1.2))
                      el.style.lineHeight = `${lh}px`
                      el.style.whiteSpace = 'pre-wrap'
                      el.style.overflowWrap = 'break-word'
                      scheduleNativeSync(block)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        if (nativeBlurTimerRef.current) {
                          window.clearTimeout(nativeBlurTimerRef.current)
                          nativeBlurTimerRef.current = null
                        }
                        flushNativeSyncTimer()
                        nativeOpenBaselineStrRef.current = ''
                        nativeEditRef.current = null
                        setNativeEdit(null)
                        return
                      }
                      if (e.key === 'Enter' && e.ctrlKey) {
                        e.preventDefault()
                        commitNativeEdit(e.currentTarget.innerText ?? '')
                        e.currentTarget.blur()
                      }
                    }}
                  />
                ) : (
                  <button
                    key={`${block.id}__idle`}
                    type="button"
                    aria-label="Edit PDF text"
                    title="Tap to edit"
                    className={`pdf-text-layer-hit pdf-text-layer-tap-target absolute inset-0 z-[1] overflow-hidden border bg-transparent p-0 font-inherit outline-none transition-[border-color,background-color] duration-150 select-none ${
                      hoverBlockId === block.id
                        ? 'border border-dashed border-[#ccc]'
                        : 'border border-transparent'
                    }`}
                    style={{ color: 'transparent', caretColor: 'transparent' }}
                    onPointerEnter={() => setHoverBlockId(block.id)}
                    onPointerLeave={() =>
                      setHoverBlockId((id) => (id === block.id ? null : id))
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      openNativeEditorForBlock(block)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openNativeEditorForBlock(block)
                      }
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
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
      {textDraft && cw > 0 && (
        <input
          autoFocus
          className="absolute z-20 min-w-[120px] rounded border-2 border-indigo-500 bg-transparent px-2 py-1 text-sm text-zinc-900 shadow-none placeholder:text-zinc-500 dark:border-indigo-400 dark:text-zinc-100 dark:placeholder:text-zinc-400"
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
