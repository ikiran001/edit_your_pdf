import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { buildTextRuns } from '../lib/pdfTextRuns'
import { hexLuminance, sampleBackgroundColorHex, sampleInkColorHex } from '../lib/sampleCanvasInkColor'
import { buildPageTextItemBlocks } from '../lib/textLayerManager'
import { editorFontFamilyWithPdfHint } from '../lib/editorUnicodeFonts'
import {
  cssAnnotPreviewFontStack,
  cssDisplayFontFromPdf,
  defaultTextFormat,
  formatFromTextBlock,
  mapPdfFontNameToServer,
  mergePdfStyleHints,
} from '../lib/textFormatDefaults'
import { sessionNativeMetaForBlock } from '../lib/sessionNativeTextMatch.js'
import { defaultPlacementForPng } from '../features/sign-pdf/signPdfGeometry.js'
import { trackSignaturePlaced } from '../lib/analytics.js'

const RENDER_SCALE = 1.35
const MAX_DRAW_POINTS = 1000
const MAX_ANNOT_TEXT_PER_PAGE = 50
const MAX_ANNOT_TEXT_LENGTH = 2000
const MAX_SIGN_PER_PAGE = 10

const ANNOT_SCOPE_EVENT = 'pdf-editor-annot-scope'

/** Raw or data-URL base64 → PNG bytes for placement sizing. */
function rawBase64ToUint8(b64) {
  const s = String(b64 || '')
    .replace(/^data:image\/png;base64,/i, '')
    .trim()
  if (!s) return null
  try {
    const bin = atob(s)
    const u8 = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
    return u8
  } catch {
    return null
  }
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

/** Added text is drawn with no fill in the viewer and on export — PDF shows through. */
const ANNOT_TEXT_DISPLAY_BG = 'transparent'

function normalizeHexForColorInput(c) {
  const s = String(c || '#000000').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const a = s.slice(1)
    return `#${a[0]}${a[0]}${a[1]}${a[1]}${a[2]}${a[2]}`
  }
  return '#000000'
}

function seedFormatFromAnnotTextItem(it) {
  const base = defaultTextFormat()
  if (!it || it.type !== 'text') return base
  const cssN = Math.max(6, Math.min(144, Number(it.fontSizeCss) || 14))
  return {
    ...base,
    fontSizeCss: cssN,
    color: normalizeHexForColorInput(it.color),
    bold: !!it.bold,
    italic: !!it.italic,
    underline: !!it.underline,
    fontFamily:
      typeof it.fontFamily === 'string' && it.fontFamily.trim() ? it.fontFamily.trim() : base.fontFamily,
    align: typeof it.align === 'string' && it.align ? it.align : base.align,
  }
}

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
 * contentEditable must not use `{item.text}` as React children: any parent re-render
 * (e.g. Text format syncing font size/color via patchAnnotItem) resets the DOM and
 * wipes in-progress typing or stacks visual state. Seed text once per open instead.
 */
/** iLovePDF-style: red circle X, overlaps top-right of the blue text frame */
function TextAnnotBoxDeleteBtn({ onDelete }) {
  return (
    <button
      type="button"
      data-pdf-annot-delete-skip-blur
      aria-label="Delete text"
      className="absolute -right-2 -top-2 z-[6] flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-red-500 text-[17px] font-light leading-none text-white shadow-md hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDelete()
      }}
    >
      ×
    </button>
  )
}

function AnnotTextContentEditable({
  item,
  fontSizePx,
  color,
  bold,
  italic,
  underline,
  fontFamily,
  align,
  editorRef,
  onCommit,
}) {
  /* Seed DOM once per mount. Omitting item.text from deps avoids resetting when Text format sync patches font/color. */
  useLayoutEffect(() => {
    const el = editorRef.current
    if (!el) return
    el.textContent = item.text ?? ''
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps -- see comment above

  const fontStack = cssAnnotPreviewFontStack(fontFamily || 'Helvetica')

  return (
    <div
      ref={(el) => {
        editorRef.current = el
      }}
      contentEditable
      suppressContentEditableWarning
      data-pdf-annot-editor
      className="pdf-annot-inline-editor inline-block min-h-[1.5rem] w-max max-w-[min(18rem,calc(100vw-2rem))] cursor-text select-text rounded-sm border-0 py-0 pl-0 pr-2 font-sans outline-none"
      style={{
        fontSize: `${fontSizePx}px`,
        /* Keep in sync with ANNOT_UI_LINE_HEIGHT in backend applyEdits.js */
        lineHeight: 1.35,
        color,
        background: 'transparent',
        backgroundColor: ANNOT_TEXT_DISPLAY_BG,
        caretColor: '#2563eb',
        minWidth: '2ch',
        fontWeight: bold ? 700 : 400,
        fontStyle: italic ? 'italic' : 'normal',
        textDecoration: underline ? 'underline' : 'none',
        textDecorationLine: underline ? 'underline' : 'none',
        fontFamily: fontStack,
        textAlign: align || 'left',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onInput={(e) => {
        const el = e.currentTarget
        if ((el.innerText ?? '').length > MAX_ANNOT_TEXT_LENGTH) {
          const sel = window.getSelection()
          const range = sel?.getRangeAt(0)
          el.innerText = (el.innerText ?? '').slice(0, MAX_ANNOT_TEXT_LENGTH)
          if (range) {
            try {
              sel.removeAllRanges()
              range.collapse(false)
              sel.addRange(range)
            } catch { /* ignore */ }
          }
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          const el = editorRef.current
          onCommit(item.id, el?.innerText ?? '')
        }
      }}
    />
  )
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
  onRevertNativeTextEdit,
  /** Parent SSOT: stable block id → display string (from pdf.js once, then overrides). */
  blockTextOverrides = {},
  /** Server-persisted native edits; used so display text is the saved string, not pdf.js duplicate concat. */
  sessionNativeTextEdits = [],
  textFormat,
  textFormatRef,
  onBeginNativeTextEdit,
  editTextMode = true,
  onInlineEditorActiveChange,
  /** When set, Text format sidebar syncs font size + color to this annotation. */
  formatSyncTarget = null,
  onClearAnnotFormatTarget,
  onAddedTextCommitted,
  /** Register Done/Reset handlers: `(pageIndex, payload | null) => void`. */
  onTextBoxOverlayActionsChange,
  /** Raw PNG base64 (no `data:` prefix) for signature placement; empty disables. */
  signatureImageBase64 = '',
}) {
  const pdfCanvasRef = useRef(null)
  const overlayRef = useRef(null)
  const metaRef = useRef({ pdfW: 1, pdfH: 1, cssW: 1, cssH: 1, bmpW: 1, bmpH: 1 })
  const [ready, setReady] = useState(false)
  /** CSS box + bitmap size for scaling text layer (canvas px ↔ layout px). */
  const [canvasLayout, setCanvasLayout] = useState({ cssW: 0, cssH: 0, bmpW: 1, bmpH: 1 })
  const [textDraft, setTextDraft] = useState(null)
  const textDraftRef = useRef(null)
  const draftInputRef = useRef(null)
  const textDraftDragRef = useRef(null)
  const [sigDraft, setSigDraft] = useState(null)
  const sigDraftRef = useRef(null)
  const sigDraftDragRef = useRef(null)
  const sigDraftWrapRef = useRef(null)
  const [sigDefaultBox, setSigDefaultBox] = useState(null)
  const dragRef = useRef(null)
  const drawPointsRef = useRef(null)
  const [textRuns, setTextRuns] = useState([])
  const baseTextBlocks = useMemo(
    () => buildPageTextItemBlocks(textRuns, pageIndex),
    [textRuns, pageIndex]
  )

  const textBlocks = useMemo(() => {
    const o = blockTextOverrides || {}
    return baseTextBlocks.map((b) => {
      const meta = sessionNativeMetaForBlock(b, pageIndex, sessionNativeTextEdits)
      let str = b.str
      if (meta?.text != null) str = meta.text
      if (Object.prototype.hasOwnProperty.call(o, b.id)) str = o[b.id]
      return { ...b, str }
    })
  }, [baseTextBlocks, blockTextOverrides, pageIndex, sessionNativeTextEdits])
  const textBlocksRef = useRef(textBlocks)
  const [nativeEdit, setNativeEdit] = useState(null)
  const nativeEditRef = useRef(null)
  const nativeEditorElRef = useRef(null)
  /** Stable id for this line across save/reload so native edits replace instead of stack. */
  const nativeEditSlotIdRef = useRef(null)
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

  const textAnnotItems = useMemo(
    () => (items || []).filter((it) => it.type === 'text' && !it.rasterizedInPdf),
    [items]
  )
  const signatureAnnotItems = useMemo(
    () => (items || []).filter((it) => it.type === 'signature' && !it.rasterizedInPdf),
    [items]
  )
  const [selectedAnnotId, setSelectedAnnotId] = useState(null)
  const [editingAnnotId, setEditingAnnotId] = useState(null)
  const [annotDragVisual, setAnnotDragVisual] = useState(null)
  const annotDragRef = useRef(null)
  const annotEditorRef = useRef(null)
  const annotEditBaselineRef = useRef('')
  const editingAnnotIdRef = useRef(null)

  const annotLayerInteractive =
    !tool || tool === 'text' || tool === 'editText' || tool === 'signature'

  useLayoutEffect(() => {
    editingAnnotIdRef.current = editingAnnotId
  }, [editingAnnotId])

  useLayoutEffect(() => {
    textDraftRef.current = textDraft
  }, [textDraft])

  useLayoutEffect(() => {
    sigDraftRef.current = sigDraft
  }, [sigDraft])

  useLayoutEffect(() => {
    if (!sigDraft) return
    try {
      sigDraftWrapRef.current?.focus({ preventScroll: true })
    } catch {
      /* ignore */
    }
  }, [sigDraft])

  useLayoutEffect(() => {
    nativeEditRef.current = nativeEdit
  }, [nativeEdit])

  useLayoutEffect(() => {
    textBlocksRef.current = textBlocks
  }, [textBlocks])

  const patchAnnotItem = useCallback(
    (id, partial) => {
      onUpdateItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...partial } : it)))
    },
    [onUpdateItems]
  )

  useEffect(() => {
    if (
      !formatSyncTarget ||
      formatSyncTarget.pageIndex !== pageIndex ||
      formatSyncTarget.itemId !== selectedAnnotId ||
      !selectedAnnotId
    ) {
      return
    }
    const it = items.find((x) => x.id === selectedAnnotId && x.type === 'text')
    if (!it) return
    const fmt = textFormatRef?.current ?? textFormat ?? defaultTextFormat()
    const cssN = Math.max(6, Math.min(144, Number(fmt.fontSizeCss) || 14))
    const { pdfW } = metaRef.current
    const cv = pdfCanvasRef.current
    const bmpW =
      cv && cv.width > 0 ? cv.width : metaRef.current.bmpW > 0 ? metaRef.current.bmpW : 1
    const fontSizePt = Math.max(4, Math.min(144, cssN * (pdfW / bmpW)))
    const nextColor = normalizeHexForColorInput(String(fmt.color || '#000000').trim())
    const curColor = normalizeHexForColorInput(String(it.color || '#000000').trim())
    const nextFam = String(fmt.fontFamily || 'Helvetica').trim()
    const curFam = String(it.fontFamily || 'Helvetica').trim()
    const nextAlign = String(fmt.align || 'left')
    const curAlign = String(it.align || 'left')
    const nb = !!fmt.bold
    const ni = !!fmt.italic
    const nu = !!fmt.underline
    const cb = !!it.bold
    const ci = !!it.italic
    const cu = !!it.underline
    const ptOk = Math.abs(Number(it.fontSize || 0) - fontSizePt) < 0.05
    if (
      it.fontSizeCss === cssN &&
      ptOk &&
      curColor.toLowerCase() === nextColor.toLowerCase() &&
      cb === nb &&
      ci === ni &&
      cu === nu &&
      curFam === nextFam &&
      curAlign === nextAlign
    ) {
      return
    }
    patchAnnotItem(selectedAnnotId, {
      fontSizeCss: cssN,
      fontSize: fontSizePt,
      color: nextColor,
      bold: nb,
      italic: ni,
      underline: nu,
      fontFamily: nextFam,
      align: nextAlign,
    })
  }, [textFormat, formatSyncTarget, pageIndex, selectedAnnotId, items, textFormatRef, patchAnnotItem])

  const selectAnnot = useCallback(
    (id, opts = {}) => {
      window.dispatchEvent(new CustomEvent(ANNOT_SCOPE_EVENT, { detail: { pageIndex } }))
      editingAnnotIdRef.current = null
      setEditingAnnotId(null)
      setSelectedAnnotId(id)
      const it = items.find((x) => x.id === id && x.type === 'text')
      if (it && opts.notifyFormat && onAddedTextCommitted) {
        onAddedTextCommitted({
          pageIndex,
          itemId: id,
          seedFormat: seedFormatFromAnnotTextItem(it),
        })
      }
      if (it && opts.openEditor) {
        editingAnnotIdRef.current = id
        setEditingAnnotId(id)
      }
    },
    [pageIndex, items, onAddedTextCommitted]
  )

  useEffect(() => {
    const onScope = (e) => {
      if (e.detail?.pageIndex === pageIndex) return
      setSelectedAnnotId(null)
      editingAnnotIdRef.current = null
      setEditingAnnotId(null)
      setAnnotDragVisual(null)
      annotDragRef.current = null
      sigDraftDragRef.current = null
      sigDraftRef.current = null
      setSigDraft(null)
    }
    window.addEventListener(ANNOT_SCOPE_EVENT, onScope)
    return () => window.removeEventListener(ANNOT_SCOPE_EVENT, onScope)
  }, [pageIndex])

  const commitAnnotEdit = useCallback(
    (id, raw) => {
      if (editingAnnotIdRef.current !== id) return
      editingAnnotIdRef.current = null
      const v = String(raw ?? '')
        .replace(/\r\n/g, '\n')
        .trim()
      if (!v) {
        onUpdateItems((prev) => prev.filter((it) => it.id !== id))
        setSelectedAnnotId(null)
        setEditingAnnotId(null)
        return
      }
      patchAnnotItem(id, { text: v })
      setEditingAnnotId(null)
    },
    [onUpdateItems, patchAnnotItem]
  )

  useLayoutEffect(() => {
    if (!editingAnnotId) return
    const it = items.find((x) => x.id === editingAnnotId && x.type === 'text')
    annotEditBaselineRef.current = it?.text ?? ''
  }, [editingAnnotId, items])

  const removeTextAnnot = useCallback(
    (id) => {
      onUpdateItems((prev) => prev.filter((x) => x.id !== id))
      setSelectedAnnotId(null)
      editingAnnotIdRef.current = null
      setEditingAnnotId(null)
      if (formatSyncTarget?.pageIndex === pageIndex && formatSyncTarget?.itemId === id) {
        onClearAnnotFormatTarget?.()
      }
    },
    [onUpdateItems, formatSyncTarget, pageIndex, onClearAnnotFormatTarget]
  )

  useLayoutEffect(() => {
    if (!editingAnnotId) return
    const el = annotEditorRef.current
    if (!el) return
    el.focus()
    try {
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    } catch {
      /* ignore */
    }
  }, [editingAnnotId])

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

    for (const it of items) {
      if (it.type === 'text') continue
      if (it.rasterizedInPdf) continue
      drawItem(it)
    }

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
    /* pdfW/pdfH = page size in PDF points. cssW/cssH must match on-screen canvas (set in layout sync), not bitmap px. */
    metaRef.current = {
      ...metaRef.current,
      pdfW: base.width,
      pdfH: base.height,
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
      metaRef.current = {
        ...metaRef.current,
        cssW: cw,
        cssH: ch,
        bmpW: pdf.width || 1,
        bmpH: pdf.height || 1,
      }
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
      window.dispatchEvent(new CustomEvent(ANNOT_SCOPE_EVENT, { detail: { pageIndex } }))
      setSelectedAnnotId(null)
      setEditingAnnotId(null)
      setTextDraft({ nx: n.nx, ny: n.ny })
      e.preventDefault()
      return
    }

    if (tool === 'signature') {
      if (!signatureImageBase64 || !sigDefaultBox) {
        e.preventDefault()
        return
      }
      const { nw, nh } = sigDefaultBox
      let nx = clamp01(n.nx - nw / 2)
      let ny = clamp01(n.ny - nh / 2)
      nx = Math.min(nx, 1 - nw)
      ny = Math.min(ny, 1 - nh)
      window.dispatchEvent(new CustomEvent(ANNOT_SCOPE_EVENT, { detail: { pageIndex } }))
      setSelectedAnnotId(null)
      setEditingAnnotId(null)
      setSigDraft({ nx, ny, nw, nh })
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
      if (dx * dx + dy * dy > 0.000004 && drawPointsRef.current.length < MAX_DRAW_POINTS) {
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

  const commitText = useCallback(
    (value) => {
      if (!textDraftRef.current) return
      const draft = textDraftRef.current
      const fmt = textFormatRef?.current ?? textFormat ?? defaultTextFormat()
      const cssN = Math.max(6, Math.min(144, Number(fmt.fontSizeCss) || 14))
      textDraftRef.current = null
      textDraftDragRef.current = null
      setTextDraft(null)
      const v = String(value ?? '').trim().slice(0, MAX_ANNOT_TEXT_LENGTH)
      if (!v) return
      const textAnnotCount = items.filter((it) => it.type === 'text').length
      if (textAnnotCount >= MAX_ANNOT_TEXT_PER_PAGE) return
      const el = pdfCanvasRef.current
      const { pdfW, cssW: metaCssW } = metaRef.current
      const bmpW =
        el && el.width > 0 ? el.width : metaRef.current.bmpW > 0 ? metaRef.current.bmpW : 1
      const fontSizePt = Math.max(4, Math.min(144, cssN * (pdfW / bmpW)))
      /* Capture box width before draft is cleared — used for server-side alignment. */
      const draftBoxW = draftInputRef.current?.offsetWidth ?? 0
      const nw = metaCssW > 0 && draftBoxW > 0 ? draftBoxW / metaCssW : 0
      const id = crypto.randomUUID()
      onUpdateItems((prev) => [
        ...prev,
        {
          id,
          type: 'text',
          x: draft.nx,
          y: draft.ny,
          nw: nw > 0 ? nw : undefined,
          text: v,
          fontSize: fontSizePt,
          fontSizeCss: cssN,
          color: normalizeHexForColorInput(String(fmt.color || '#000000').trim()),
          backgroundHex: 'transparent',
          bold: !!fmt.bold,
          italic: !!fmt.italic,
          underline: !!fmt.underline,
          fontFamily: String(fmt.fontFamily || 'Helvetica').trim(),
          align: String(fmt.align || 'left'),
        },
      ])
      /* `selectAnnot` reads `items` synchronously — the new row is not in props yet, so openEditor/notify would no-op. */
      window.dispatchEvent(new CustomEvent(ANNOT_SCOPE_EVENT, { detail: { pageIndex } }))
      setSelectedAnnotId(id)
      editingAnnotIdRef.current = id
      setEditingAnnotId(id)
      onAddedTextCommitted?.({
        pageIndex,
        itemId: id,
        seedFormat: { ...defaultTextFormat(), ...fmt, fontSizeCss: cssN },
      })
    },
    [onUpdateItems, textFormat, textFormatRef, onAddedTextCommitted, pageIndex]
  )

  const cancelSigDraft = useCallback(() => {
    sigDraftDragRef.current = null
    sigDraftRef.current = null
    setSigDraft(null)
  }, [])

  const commitSigPlacement = useCallback(() => {
    if (!sigDraftRef.current || !signatureImageBase64) return
    const d = sigDraftRef.current
    sigDraftDragRef.current = null
    sigDraftRef.current = null
    setSigDraft(null)
    const count = (items || []).filter((it) => it.type === 'signature').length
    if (count >= MAX_SIGN_PER_PAGE) return
    const id = crypto.randomUUID()
    onUpdateItems((prev) => [
      ...prev,
      {
        id,
        type: 'signature',
        x: d.nx,
        y: d.ny,
        w: d.nw,
        h: d.nh,
        imageBase64: signatureImageBase64,
      },
    ])
    trackSignaturePlaced(pageIndex + 1)
    window.dispatchEvent(new CustomEvent(ANNOT_SCOPE_EVENT, { detail: { pageIndex } }))
    setSelectedAnnotId(id)
  }, [items, signatureImageBase64, onUpdateItems, pageIndex])

  useEffect(() => {
    let cancelled = false
    if (tool !== 'signature' || !signatureImageBase64 || !pdfPage) {
      setSigDefaultBox(null)
      return undefined
    }
    const u8 = rawBase64ToUint8(signatureImageBase64)
    if (!u8?.length) {
      setSigDefaultBox(null)
      return undefined
    }
    ;(async () => {
      try {
        const box = await defaultPlacementForPng(
          u8,
          () => pdfPage.getViewport({ scale: 1 }),
          pageIndex
        )
        if (!cancelled) setSigDefaultBox(box)
      } catch {
        if (!cancelled) setSigDefaultBox({ nx: 0.25, ny: 0.7, nw: 0.2, nh: 0.08 })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tool, signatureImageBase64, pdfPage, pageIndex])

  useEffect(() => {
    if (!onTextBoxOverlayActionsChange) return
    if (textDraft) {
      onTextBoxOverlayActionsChange(pageIndex, {
        done: () => commitText(draftInputRef.current?.value ?? ''),
        reset: () => {
          textDraftDragRef.current = null
          textDraftRef.current = null
          setTextDraft(null)
        },
      })
      return () => onTextBoxOverlayActionsChange(pageIndex, null)
    }
    if (sigDraft) {
      onTextBoxOverlayActionsChange(pageIndex, {
        done: () => commitSigPlacement(),
        reset: () => cancelSigDraft(),
      })
      return () => onTextBoxOverlayActionsChange(pageIndex, null)
    }
    if (editingAnnotId) {
      onTextBoxOverlayActionsChange(pageIndex, {
        done: () => {
          const id = editingAnnotIdRef.current
          const el = annotEditorRef.current
          if (id != null && el) commitAnnotEdit(id, el.innerText ?? '')
        },
        reset: () => {
          const el = annotEditorRef.current
          if (el) el.textContent = annotEditBaselineRef.current
          editingAnnotIdRef.current = null
          setEditingAnnotId(null)
        },
      })
      return () => onTextBoxOverlayActionsChange(pageIndex, null)
    }
    onTextBoxOverlayActionsChange(pageIndex, null)
    return undefined
  }, [
    textDraft,
    editingAnnotId,
    onTextBoxOverlayActionsChange,
    pageIndex,
    commitText,
    commitAnnotEdit,
    sigDraft,
    commitSigPlacement,
    cancelSigDraft,
  ])

  useEffect(() => {
    if (!selectedAnnotId && !editingAnnotId && !textDraft && !sigDraft) return
    const onDocDown = (e) => {
      const t = e.target
      if (textDraft && !t.closest?.('[data-pdf-annot-draft]')) {
        commitText(draftInputRef.current?.value ?? '')
        return
      }
      if (sigDraft && !t.closest?.('[data-pdf-sig-draft]')) {
        commitSigPlacement()
        return
      }
      if (t.closest?.('[data-pdf-annot-text-root]')) return
      if (t.closest?.('[data-pdf-sig-annot-root]')) return
      if (t.closest?.('[data-pdf-annot-toolbar]')) return
      if (t.closest?.('[data-pdf-annot-draft]')) return
      if (t.closest?.('[data-pdf-sig-draft]')) return
      if (t.closest?.('[data-pdf-inline-editor-root]')) return
      if (t.closest?.('[data-text-format-panel]')) return
      if (t.closest?.('[data-pdf-edits-sidebar]')) return
      if (editingAnnotId) {
        const el = annotEditorRef.current
        const id = editingAnnotIdRef.current
        if (el && id != null) commitAnnotEdit(id, el.innerText ?? '')
        return
      }
      const prevSel = selectedAnnotId
      setSelectedAnnotId(null)
      if (
        prevSel &&
        formatSyncTarget?.pageIndex === pageIndex &&
        formatSyncTarget?.itemId === prevSel
      ) {
        onClearAnnotFormatTarget?.()
      }
    }
    document.addEventListener('pointerdown', onDocDown, true)
    return () => document.removeEventListener('pointerdown', onDocDown, true)
  }, [
    textDraft,
    sigDraft,
    selectedAnnotId,
    editingAnnotId,
    formatSyncTarget,
    pageIndex,
    onClearAnnotFormatTarget,
    commitText,
    commitAnnotEdit,
    commitSigPlacement,
  ])

  const onDraftDragPointerDown = useCallback((e) => {
    if (!e.isPrimary || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const d0 = textDraftRef.current
    if (!d0) return
    const { cssW, cssH } = metaRef.current
    if (cssW < 1 || cssH < 1) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    textDraftDragRef.current = {
      pointerId: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: d0.nx,
      oy: d0.ny,
    }
  }, [])

  const onDraftDragPointerMove = useCallback((e) => {
    const drag = textDraftDragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    const { cssW, cssH } = metaRef.current
    if (cssW < 1 || cssH < 1) return
    const nx = clamp01(drag.ox + (e.clientX - drag.sx) / cssW)
    const ny = clamp01(drag.oy + (e.clientY - drag.sy) / cssH)
    setTextDraft((prev) => (prev ? { ...prev, nx, ny } : null))
  }, [])

  const onDraftDragPointerUp = useCallback((e) => {
    const drag = textDraftDragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    textDraftDragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const onSigDraftGripPointerDown = useCallback((e) => {
    if (!e.isPrimary || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const d0 = sigDraftRef.current
    if (!d0) return
    const { cssW, cssH } = metaRef.current
    if (cssW < 1 || cssH < 1) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    sigDraftDragRef.current = {
      pointerId: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: d0.nx,
      oy: d0.ny,
    }
  }, [])

  const onSigDraftDragPointerMove = useCallback((e) => {
    const drag = sigDraftDragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    const { cssW, cssH } = metaRef.current
    if (cssW < 1 || cssH < 1) return
    const d0 = sigDraftRef.current
    if (!d0) return
    let nx = clamp01(drag.ox + (e.clientX - drag.sx) / cssW)
    let ny = clamp01(drag.oy + (e.clientY - drag.sy) / cssH)
    nx = Math.min(nx, 1 - d0.nw)
    ny = Math.min(ny, 1 - d0.nh)
    setSigDraft((prev) => (prev ? { ...prev, nx, ny } : null))
  }, [])

  const onSigDraftDragPointerUp = useCallback((e) => {
    const drag = sigDraftDragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    sigDraftDragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (tool === 'text') return
    textDraftDragRef.current = null
    textDraftRef.current = null
    setTextDraft(null)
  }, [tool])

  useEffect(() => {
    if (tool === 'signature') return
    sigDraftDragRef.current = null
    sigDraftRef.current = null
    setSigDraft(null)
    setSigDefaultBox(null)
  }, [tool])

  const { cssW: cw, cssH: ch, bmpW, bmpH } = canvasLayout
  const sx = bmpW > 0 ? cw / bmpW : 1
  const sy = bmpH > 0 ? ch / bmpH : 1

  const overlayActive = tool && tool !== 'editText'

  const showTextLayer = editTextMode && tool === 'editText' && ready

  const openNativeEditorForBlock = useCallback(
    (block) => {
      const id = block.id
      if (nativeEditRef.current?.block?.id === id) return
      if (nativeSyncTimerRef.current != null) {
        window.clearTimeout(nativeSyncTimerRef.current)
        nativeSyncTimerRef.current = null
      }
      const meta = sessionNativeMetaForBlock(block, pageIndex, sessionNativeTextEdits)
      nativeEditSlotIdRef.current =
        typeof meta?.slotId === 'string' && meta.slotId.length >= 8
          ? meta.slotId
          : typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `ns-${Date.now()}-${Math.random().toString(36).slice(2)}`
      nativeOpenBaselineStrRef.current =
        block.str ?? textBlocksRef.current.find((b) => b.id === id)?.str ?? ''
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
      let maskFillHex = '#ffffff'
      if (cv?.width && block.width > 0 && block.height > 0) {
        maskFillHex = sampleBackgroundColorHex(cv, block.left, block.top, block.width, block.height)
      }

      /*
       * Contrast safety: if the sampled ink colour is too close to the background
       * (WCAG contrast ratio < 2.5), the text would be nearly invisible after saving.
       * Correct by choosing a strongly contrasting colour instead.
       * This handles the case where dark-background white text is incorrectly sampled
       * as a dark/blue colour (e.g. navy text on navy background → invisible).
       */
      if (sampleColorHex) {
        const bgLum  = hexLuminance(maskFillHex)
        const inkLum = hexLuminance(sampleColorHex)
        const lighter = Math.max(bgLum, inkLum)
        const darker  = Math.min(bgLum, inkLum)
        const ratio   = (lighter + 0.05) / (darker + 0.05)
        if (ratio < 2.5) {
          sampleColorHex = bgLum < 0.4 ? '#ffffff' : '#000000'
        }
      }

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
          _maskColorHexSeed: maskFillHex,
        })
      } catch (err) {
        console.error('formatFromTextBlock failed', err)
        onBeginNativeTextEdit?.(block, {
          sampleColorHex: sampleColorHex ?? undefined,
          layoutHint,
          _maskColorHexSeed: maskFillHex,
        })
      }
      setNativeEdit({ block, maskFillHex })
    },
    [onBeginNativeTextEdit, pageIndex, sessionNativeTextEdits, textFormat, textFormatRef]
  )

  /** Capture format once when edit opens only (`nativeEdit` deps — not `textFormat`, or toggling B/I/U would reset baseline). */
  useLayoutEffect(() => {
    if (!nativeEdit) {
      nativeOpenBaselineFormatRef.current = null
      nativeOpenBaselinePdfFontSizeRef.current = null
      nativeEditSlotIdRef.current = null
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
    const readStr = () =>
      textBlocksRef.current.find((b) => b.id === id)?.str ?? nativeEdit.block.str ?? ''
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

    const cv = pdfCanvasRef.current
    const editing = nativeEditRef.current
    let maskColor
    if (fmt.maskColorMode === 'manual' && /^#[0-9a-fA-F]{6}$/.test(fmt.maskColorHex || '')) {
      maskColor = fmt.maskColorHex
    } else if (
      editing?.block?.id === block.id &&
      typeof editing.maskFillHex === 'string' &&
      editing.maskFillHex
    ) {
      maskColor = editing.maskFillHex
    } else if (cv?.width && block.width > 0 && block.height > 0) {
      maskColor = sampleBackgroundColorHex(cv, block.left, block.top, block.width, block.height)
    } else {
      maskColor = '#ffffff'
    }

    let slotId = nativeEditSlotIdRef.current
    if (!slotId) {
      slotId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `ns-${Date.now()}-${Math.random().toString(36).slice(2)}`
      nativeEditSlotIdRef.current = slotId
    }
    return {
      blockId: block.id,
      slotId,
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

  /**
   * Push toolbar-only changes (B/I/U, colour, font size …) immediately so they are always
   * captured in `nativeTextEditsRef` before a Save/Download that might happen within the
   * 280ms keystroke-debounce window. The debounced sync is still responsible for keystroke
   * content; this effect handles format-only changes.
   */
  useEffect(() => {
    if (!nativeEdit) return
    const el = nativeEditorElRef.current
    if (!el) return
    const raw = el.innerText ?? ''
    const openFmt = nativeOpenBaselineFormatRef.current
    const curFmt = snapshotNativeFormat(textFormatRef?.current ?? defaultTextFormat())
    const textSame =
      normalizeNativeCompare(raw) === normalizeNativeCompare(nativeOpenBaselineStrRef.current)
    const formatSame = openFmt && nativeFormatSnapshotsEqual(openFmt, curFmt)
    if (textSame && formatSame) return
    /* Cancel any pending debounced keystroke sync — this immediate call supersedes it. */
    if (nativeSyncTimerRef.current != null) {
      window.clearTimeout(nativeSyncTimerRef.current)
      nativeSyncTimerRef.current = null
    }
    onNativeTextEdit?.(buildNativePayload(nativeEdit.block, raw))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textFormat]) // intentionally only textFormat — nativeEdit/buildNativePayload are stable refs here

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
      const { block } = current
      const baseline = nativeOpenBaselineStrRef.current
      const openFmt = nativeOpenBaselineFormatRef.current
      const textSame = normalizeNativeCompare(value) === normalizeNativeCompare(baseline)
      const curFmt = snapshotNativeFormat(textFormatRef?.current ?? defaultTextFormat())
      const formatSame = openFmt && nativeFormatSnapshotsEqual(openFmt, curFmt)
      /* Build payload BEFORE clearing refs so buildNativePayload reads nativeOpenBaselineFormatRef
         (needed for sizeToolbarTouched) and nativeEditRef (needed for maskFillHex). */
      const payload = (!textSame || !formatSame) ? buildNativePayload(block, value) : null
      /* Clear state after payload is captured. useLayoutEffect([nativeEdit]) handles ref cleanup. */
      nativeEditRef.current = null
      nativeOpenBaselineStrRef.current = ''
      nativeOpenBaselineFormatRef.current = null
      setNativeEdit(null)
      if (payload) {
        onNativeTextEdit?.(payload)
      }
    },
    [onNativeTextEdit, buildNativePayload, flushNativeSyncTimer]
  )

  useEffect(() => {
    if (tool === 'editText') return
    if (!nativeEditRef.current) return
    const el = nativeEditorElRef.current
    commitNativeEdit(el?.innerText ?? '')
  }, [tool, commitNativeEdit])

  /** Discard the current native edit and restore the block to its original PDF text. */
  const revertNativeEdit = useCallback(() => {
    if (nativeBlurTimerRef.current) {
      window.clearTimeout(nativeBlurTimerRef.current)
      nativeBlurTimerRef.current = null
    }
    flushNativeSyncTimer()
    const current = nativeEditRef.current
    if (!current) return
    const { block } = current
    const originalStr = nativeOpenBaselineStrRef.current
    nativeEditRef.current = null
    nativeOpenBaselineStrRef.current = ''
    nativeOpenBaselineFormatRef.current = null
    setNativeEdit(null)
    /* Restore the editor element text for instant UI feedback before React re-render. */
    const el = nativeEditorElRef.current
    if (el) el.innerText = originalStr
    onRevertNativeTextEdit?.(block.id, nativeEditSlotIdRef.current)
    nativeEditSlotIdRef.current = null
  }, [onRevertNativeTextEdit, flushNativeSyncTimer])

  /** Click outside textarea / format panel commits (canvas is not focusable — blur alone is unreliable). */
  useEffect(() => {
    if (!nativeEdit) return
    const onDocPointerDown = (e) => {
      const t = e.target
      if (t.closest?.('[data-pdf-inline-editor-root]')) return
      if (t.closest?.('[data-text-format-panel]')) return
      if (t.closest?.('[data-pdf-edits-sidebar]')) return
      if (t.closest?.('[data-pdf-annot-text-root]')) return
      if (t.closest?.('[data-pdf-sig-annot-root]')) return
      if (t.closest?.('[data-pdf-annot-toolbar]')) return
      if (t.closest?.('[data-pdf-annot-draft]')) return
      if (t.closest?.('[data-pdf-sig-draft]')) return
      /* Let line tap targets handle the event in the target phase (iPad / iOS WebKit). */
      if (t.closest?.('[data-pdf-text-line-tap]')) return
      const el = nativeEditorElRef.current
      if (el && nativeEditRef.current) {
        commitNativeEdit(el.innerText ?? '')
      }
    }
    document.addEventListener('pointerdown', onDocPointerDown, true)
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true)
  }, [nativeEdit, commitNativeEdit])

  /** Parent removed this slot (sidebar ✕) or cleared the session — close inline editor without re-committing. */
  useEffect(() => {
    const onSlotRemoved = (e) => {
      const sid = e.detail?.slotId
      if (typeof sid !== 'string' || sid.length < 8) return
      if (nativeEditSlotIdRef.current !== sid) return
      if (nativeBlurTimerRef.current) {
        window.clearTimeout(nativeBlurTimerRef.current)
        nativeBlurTimerRef.current = null
      }
      flushNativeSyncTimer()
      nativeEditRef.current = null
      nativeOpenBaselineStrRef.current = ''
      nativeOpenBaselineFormatRef.current = null
      nativeOpenBaselinePdfFontSizeRef.current = null
      nativeEditSlotIdRef.current = null
      setNativeEdit(null)
    }
    const onSessionCleared = () => {
      if (!nativeEditRef.current) return
      if (nativeBlurTimerRef.current) {
        window.clearTimeout(nativeBlurTimerRef.current)
        nativeBlurTimerRef.current = null
      }
      flushNativeSyncTimer()
      nativeEditRef.current = null
      nativeOpenBaselineStrRef.current = ''
      nativeOpenBaselineFormatRef.current = null
      nativeOpenBaselinePdfFontSizeRef.current = null
      nativeEditSlotIdRef.current = null
      setNativeEdit(null)
    }
    document.addEventListener('pdfpilot-remove-native-slot', onSlotRemoved)
    document.addEventListener('pdfpilot-native-session-cleared', onSessionCleared)
    return () => {
      document.removeEventListener('pdfpilot-remove-native-slot', onSlotRemoved)
      document.removeEventListener('pdfpilot-native-session-cleared', onSessionCleared)
    }
  }, [flushNativeSyncTimer])

  const annotPointerDown = (e, it) => {
    if (!annotLayerInteractive || !e.isPrimary || e.button !== 0) return
    e.stopPropagation()
    if (editingAnnotId === it.id) return
    annotDragRef.current = {
      id: it.id,
      sx: e.clientX,
      sy: e.clientY,
      ox: it.x,
      oy: it.y,
      moved: false,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  /** Drag handle while inline-editing (editingAnnotId blocks `annotPointerDown` on the glyph). */
  const beginAnnotTextDrag = (e, it) => {
    if (!annotLayerInteractive || !e.isPrimary || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    annotDragRef.current = {
      id: it.id,
      sx: e.clientX,
      sy: e.clientY,
      ox: it.x,
      oy: it.y,
      moved: false,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const annotPointerMove = (e, it) => {
    const d = annotDragRef.current
    if (!d || d.id !== it.id) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved && dx * dx + dy * dy > 25) d.moved = true
    if (d.moved) setAnnotDragVisual({ id: it.id, dx, dy })
  }

  const endAnnotDrag = (e, it) => {
    const d = annotDragRef.current
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (!d || d.id !== it.id) {
      setAnnotDragVisual(null)
      return
    }
    annotDragRef.current = null
    const W = cw
    const H = ch
    if (d.moved && W > 0 && H > 0) {
      const nx = clamp01(d.ox + (e.clientX - d.sx) / W)
      const ny = clamp01(d.oy + (e.clientY - d.sy) / H)
      patchAnnotItem(it.id, { x: nx, y: ny })
      selectAnnot(it.id, { notifyFormat: true, openEditor: false })
    } else if (!d.moved && editingAnnotIdRef.current !== it.id) {
      selectAnnot(it.id, {
        notifyFormat: it.type === 'text',
        openEditor: it.type === 'text',
      })
    }
    setAnnotDragVisual(null)
  }

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
      {textAnnotItems.length > 0 && ready && cw > 0 && ch > 0 && (
        <div
          className={`pointer-events-none absolute left-0 top-0 ${
            annotLayerInteractive ? 'z-[35]' : 'z-[4]'
          }`}
          style={{ width: cw, height: ch }}
        >
          {textAnnotItems.map((it) => {
            const isSel = selectedAnnotId === it.id
            const isEdit = editingAnnotId === it.id
            const dx = annotDragVisual?.id === it.id ? annotDragVisual.dx : 0
            const dy = annotDragVisual?.id === it.id ? annotDragVisual.dy : 0
            const fs = Math.max(8, Math.min(144, (it.fontSizeCss ?? 14) * sx))
            const color = it.color || '#000000'
            const fmtToolbar = textFormat ?? defaultTextFormat()
            const annotSyncs =
              formatSyncTarget?.pageIndex === pageIndex && formatSyncTarget?.itemId === it.id
            const decor = annotSyncs
              ? {
                  bold: !!fmtToolbar.bold,
                  italic: !!fmtToolbar.italic,
                  underline: !!fmtToolbar.underline,
                  fontFamily: fmtToolbar.fontFamily || 'Helvetica',
                  align: fmtToolbar.align || 'left',
                }
              : {
                  bold: !!it.bold,
                  italic: !!it.italic,
                  underline: !!it.underline,
                  fontFamily: it.fontFamily || 'Helvetica',
                  align: it.align || 'left',
                }
            const annotFontStack = cssAnnotPreviewFontStack(decor.fontFamily)
            return (
              <div
                key={it.id}
                data-pdf-annot-text-root
                className="pointer-events-auto absolute"
                style={{
                  left: it.x * cw + dx,
                  top: it.y * ch + dy,
                  maxWidth: `min(${Math.max(0, cw * (1 - it.x))}px, 100vw)`,
                }}
              >
                {isEdit ? (
                  <div
                    className="relative inline-flex max-w-full cursor-default rounded-md shadow-sm ring-2 ring-blue-600"
                    style={{ backgroundColor: ANNOT_TEXT_DISPLAY_BG }}
                  >
                    {/*
                      Strip sits above the box (out of flow) so `it.y` = top of first text line — matches PDF origin.
                    */}
                    <div
                      role="separator"
                      aria-label="Drag to move"
                      title="Drag to move"
                      className="absolute bottom-full left-0 right-0 z-[5] mb-0.5 h-2.5 cursor-grab rounded-sm border border-blue-600/30 bg-blue-600/10 active:cursor-grabbing dark:bg-blue-500/15"
                      onPointerDown={(e) => beginAnnotTextDrag(e, it)}
                      onPointerMove={(e) => annotPointerMove(e, it)}
                      onPointerUp={(e) => endAnnotDrag(e, it)}
                      onPointerCancel={(e) => endAnnotDrag(e, it)}
                    />
                    {annotLayerInteractive && (
                      <TextAnnotBoxDeleteBtn onDelete={() => removeTextAnnot(it.id)} />
                    )}
                    <AnnotTextContentEditable
                      key={`${it.id}__annot-ed`}
                      item={it}
                      fontSizePx={fs}
                      color={color}
                      bold={decor.bold}
                      italic={decor.italic}
                      underline={decor.underline}
                      fontFamily={decor.fontFamily}
                      align={decor.align}
                      editorRef={annotEditorRef}
                      onCommit={commitAnnotEdit}
                    />
                  </div>
                ) : (
                    <div
                      className={[
                      'relative inline-block w-max max-w-full',
                      annotLayerInteractive ? 'cursor-grab active:cursor-grabbing' : '',
                      isSel && annotLayerInteractive ? 'rounded-md shadow-sm ring-2 ring-blue-600' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                      style={
                        isSel && annotLayerInteractive
                          ? { backgroundColor: ANNOT_TEXT_DISPLAY_BG }
                          : undefined
                      }
                  >
                    {isSel && annotLayerInteractive && (
                      <TextAnnotBoxDeleteBtn onDelete={() => removeTextAnnot(it.id)} />
                    )}
                    <div
                      role="text"
                      className={`inline-block max-w-full touch-none whitespace-pre-wrap break-words font-sans select-none ${
                        isSel && annotLayerInteractive ? 'border-0 py-0 pl-0 pr-1' : 'border border-transparent px-0 py-0'
                      }`}
                      style={{
                        fontSize: `${fs}px`,
                        /* Keep in sync with ANNOT_UI_LINE_HEIGHT in backend applyEdits.js (annot baseline). */
                        lineHeight: 1.35,
                        color,
                        backgroundColor: ANNOT_TEXT_DISPLAY_BG,
                        fontWeight: decor.bold ? 700 : 400,
                        fontStyle: decor.italic ? 'italic' : 'normal',
                        textDecoration: decor.underline ? 'underline' : 'none',
                        textDecorationLine: decor.underline ? 'underline' : 'none',
                        fontFamily: annotFontStack,
                        textAlign: decor.align || 'left',
                      }}
                      onPointerDown={(e) => annotPointerDown(e, it)}
                      onPointerMove={(e) => annotPointerMove(e, it)}
                      onPointerUp={(e) => endAnnotDrag(e, it)}
                      onPointerCancel={(e) => endAnnotDrag(e, it)}
                      onDoubleClick={(e) => {
                        if (!annotLayerInteractive) return
                        e.stopPropagation()
                        selectAnnot(it.id, { notifyFormat: true, openEditor: true })
                      }}
                    >
                      {it.text}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {signatureAnnotItems.length > 0 && ready && cw > 0 && ch > 0 && (
        <div
          className={`pointer-events-none absolute left-0 top-0 ${
            annotLayerInteractive ? 'z-[34]' : 'z-[3]'
          }`}
          style={{ width: cw, height: ch }}
        >
          {signatureAnnotItems.map((it) => {
            const isSel = selectedAnnotId === it.id
            const dx = annotDragVisual?.id === it.id ? annotDragVisual.dx : 0
            const dy = annotDragVisual?.id === it.id ? annotDragVisual.dy : 0
            const raw = String(it.imageBase64 || '').replace(/^data:image\/png;base64,/i, '')
            const src = raw ? `data:image/png;base64,${raw}` : ''
            return (
              <div
                key={it.id}
                data-pdf-sig-annot-root
                className="pointer-events-auto absolute"
                style={{
                  left: it.x * cw + dx,
                  top: it.y * ch + dy,
                  width: it.w * cw,
                  height: it.h * ch,
                }}
              >
                <div
                  className={[
                    'relative h-full w-full',
                    annotLayerInteractive ? 'cursor-grab active:cursor-grabbing' : '',
                    isSel && annotLayerInteractive ? 'rounded-md ring-2 ring-blue-600' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onPointerDown={(e) => annotPointerDown(e, it)}
                  onPointerMove={(e) => annotPointerMove(e, it)}
                  onPointerUp={(e) => endAnnotDrag(e, it)}
                  onPointerCancel={(e) => endAnnotDrag(e, it)}
                >
                  {isSel && annotLayerInteractive && (
                    <TextAnnotBoxDeleteBtn onDelete={() => removeTextAnnot(it.id)} />
                  )}
                  {src ? (
                    <img
                      alt=""
                      src={src}
                      draggable={false}
                      className="pointer-events-none h-full w-full object-contain"
                    />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {showTextLayer && cw > 0 && ch > 0 && (
        <div
          role="group"
          aria-label="PDF text — tap a line to edit"
          className="pointer-events-none absolute left-0 top-0 z-[30]"
          style={{
            width: cw,
            height: ch,
            overflow: nativeEdit ? 'visible' : undefined,
          }}
        >
          {[...textBlocks].reverse().map((block) => {
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
                  <>
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
                  {/* Revert action bar — only shown when there is an existing edit to undo */}
                  {nativeEditSlotIdRef.current && (
                    <div
                      data-pdf-inline-editor-root
                      className="absolute left-0 top-full z-[10] mt-0.5 flex items-center gap-1"
                    >
                      <button
                        type="button"
                        title="Revert to original PDF text"
                        onMouseDown={(e) => {
                          /* Prevent blur on the contentEditable before we can act */
                          e.preventDefault()
                          revertNativeEdit()
                        }}
                        className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 shadow-sm hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200 dark:hover:bg-amber-800/80"
                      >
                        Revert
                      </button>
                    </div>
                  )}
                  </>
                ) : (
                  <button
                    key={`${block.id}__idle`}
                    type="button"
                    data-pdf-text-line-tap
                    aria-label="Edit PDF text"
                    title="Tap to edit"
                    className={`pdf-text-layer-hit pdf-text-layer-tap-target absolute inset-0 z-[1] overflow-hidden border bg-transparent p-0 font-inherit outline-none transition-[border-color,background-color] duration-150 select-none ${
                      hoverBlockId === block.id
                        ? 'border border-dashed border-[#ccc]'
                        : 'border border-transparent'
                    }`}
                    style={{ color: 'transparent', caretColor: 'transparent', touchAction: 'manipulation' }}
                    onPointerEnter={() => setHoverBlockId(block.id)}
                    onPointerLeave={() =>
                      setHoverBlockId((id) => (id === block.id ? null : id))
                    }
                    onPointerDown={(e) => {
                      if (!e.isPrimary) return
                      if (e.pointerType === 'mouse' && e.button !== 0) return
                      e.stopPropagation()
                      const cur = nativeEditRef.current
                      if (cur && cur.block.id !== block.id) {
                        const ed = nativeEditorElRef.current
                        commitNativeEdit(ed?.innerText ?? '')
                      }
                      /* iPad / iOS WebKit (incl. Chrome) often skips click on overlay buttons; always use pointerdown. */
                      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                        e.preventDefault()
                      }
                      openNativeEditorForBlock(block)
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      const cur = nativeEditRef.current
                      if (cur && cur.block.id !== block.id) {
                        const ed = nativeEditorElRef.current
                        commitNativeEdit(ed?.innerText ?? '')
                      }
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
      {tool === 'editText' && ready && textDiag?.error && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 z-[5] rounded bg-red-100/95 px-2 py-1 text-center text-[11px] text-red-900 dark:bg-red-950/90 dark:text-red-200">
          Could not detect text on this page. Try a text-based PDF.
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
      {tool === 'text' && ready && textDiag?.scanned && textDiag.count === 0 && !textDiag.error && (
        <div className="pointer-events-none absolute inset-x-0 top-1 z-[5] rounded bg-amber-100/95 px-2 py-1 text-center text-[11px] text-amber-950 dark:bg-amber-950/90 dark:text-amber-100">
          This page has no selectable text (likely a scan). You can still Add Text on top of it.
        </div>
      )}
      {tool === 'signature' &&
        ready &&
        !signatureImageBase64 &&
        !sigDraft && (
          <div className="pointer-events-none absolute inset-x-0 top-1 z-[5] rounded bg-amber-100/95 px-2 py-1 text-center text-[11px] text-amber-950 dark:bg-amber-950/90 dark:text-amber-100">
            Create a signature first (dialog should open automatically).
          </div>
        )}
      {sigDraft &&
        cw > 0 &&
        signatureImageBase64 &&
        (() => {
          const raw = String(signatureImageBase64).replace(/^data:image\/png;base64,/i, '')
          const src = raw ? `data:image/png;base64,${raw}` : ''
          return (
            <div
              ref={sigDraftWrapRef}
              data-pdf-sig-draft
              tabIndex={0}
              className="absolute z-[50] cursor-default overflow-visible rounded-md ring-2 ring-blue-600 outline-none"
              style={{
                left: sigDraft.nx * cw,
                top: sigDraft.ny * ch,
                width: sigDraft.nw * cw,
                height: sigDraft.nh * ch,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelSigDraft()
                }
              }}
            >
              <div
                role="separator"
                aria-label="Drag to move"
                title="Drag to move"
                className="absolute bottom-full left-0 right-0 z-[5] mb-0.5 h-2.5 cursor-grab rounded-sm border border-blue-600/30 bg-blue-600/10 active:cursor-grabbing dark:bg-blue-500/15"
                onPointerDown={onSigDraftGripPointerDown}
                onPointerMove={onSigDraftDragPointerMove}
                onPointerUp={onSigDraftDragPointerUp}
                onPointerCancel={onSigDraftDragPointerUp}
              />
              <TextAnnotBoxDeleteBtn onDelete={cancelSigDraft} />
              <div className="relative h-full w-full">
                {src ? (
                  <img
                    alt=""
                    src={src}
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                ) : null}
              </div>
            </div>
          )
        })()}
      {textDraft && cw > 0 && (() => {
        const draftFmt = textFormat ?? defaultTextFormat()
        const draftFsCss = Math.max(8, Math.min(144, Number(draftFmt.fontSizeCss) || 14))
        const draftPx = Math.max(8, Math.min(144, draftFsCss * sx))
        const draftFont = cssAnnotPreviewFontStack(draftFmt.fontFamily)
        const cancelDraft = () => {
          textDraftDragRef.current = null
          textDraftRef.current = null
          setTextDraft(null)
        }
        const onDraftGripPointerDown = (e) => {
          if (!e.isPrimary || e.button !== 0) return
          e.preventDefault()
          e.stopPropagation()
          onDraftDragPointerDown(e)
        }
        return (
          <div
            data-pdf-annot-draft
            className="absolute z-[50] inline-block max-w-[min(22rem,calc(100vw-1.25rem))] cursor-default overflow-visible rounded-md shadow-md ring-2 ring-blue-600"
            style={{
              left: textDraft.nx * cw,
              top: textDraft.ny * ch,
              backgroundColor: ANNOT_TEXT_DISPLAY_BG,
            }}
          >
            <div
              role="separator"
              aria-label="Drag to move"
              title="Drag to move"
              className="absolute bottom-full left-0 right-0 z-[5] mb-0.5 h-2.5 cursor-grab rounded-sm border border-blue-600/30 bg-blue-600/10 active:cursor-grabbing dark:bg-blue-500/15"
              onPointerDown={onDraftGripPointerDown}
              onPointerMove={onDraftDragPointerMove}
              onPointerUp={onDraftDragPointerUp}
              onPointerCancel={onDraftDragPointerUp}
            />
            <TextAnnotBoxDeleteBtn onDelete={cancelDraft} />
            <div className="px-0 pb-2 pt-0">
              <input
                ref={draftInputRef}
                data-pdf-annot-draft-input
                autoFocus
                placeholder="Type text…"
                maxLength={MAX_ANNOT_TEXT_LENGTH}
                className="pdf-annot-draft-input min-w-0 max-w-full cursor-text rounded-sm border-0 py-0 pl-0 pr-2 text-zinc-900 outline-none placeholder:text-zinc-500"
                style={{
                  fontSize: `${draftPx}px`,
                  lineHeight: 1.35, /* match ANNOT_UI_LINE_HEIGHT in backend applyEdits.js */
                  color: normalizeHexForColorInput(draftFmt.color || '#000000'),
                  fontFamily: draftFont,
                  fontWeight: draftFmt.bold ? 700 : 400,
                  fontStyle: draftFmt.italic ? 'italic' : 'normal',
                  textDecoration: draftFmt.underline ? 'underline' : 'none',
                  textAlign: draftFmt.align || 'left',
                  caretColor: '#2563eb',
                  background: 'transparent',
                  backgroundColor: 'transparent',
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    cancelDraft()
                  }
                }}
              />
            </div>
          </div>
        )
      })()}
    </div>
  )
}
