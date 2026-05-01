import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, memo } from 'react'
import { flushSync } from 'react-dom'
import { hexLuminance, sampleBackgroundColorHex, sampleInkColorHex } from '../lib/sampleCanvasInkColor'
import {
  buildPageTextItemBlocks,
  horizontalOverlapRatio,
  verticalOverlapRatio,
} from '../lib/textLayerManager'
import { editorFontFamilyWithPdfHint } from '../lib/editorUnicodeFonts'
import {
  cssAnnotPreviewFontStack,
  cssDisplayFontFromPdf,
  defaultTextFormat,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  formatFromTextBlock,
  mapPdfFontNameToServer,
  mergePdfStyleHints,
} from '../lib/textFormatDefaults'
import { sessionNativeMetaForBlock } from '../lib/sessionNativeTextMatch.js'
import { defaultPlacementForPng } from '../features/sign-pdf/signPdfGeometry.js'
import { trackSignaturePlaced } from '../lib/analytics.js'
import { resolveTextDraftNormSize } from '../lib/textDraftLayout.js'
import {
  ADD_TEXT_DRAFT_DEFAULT_FONT_CSS,
  ANNOT_SCOPE_EVENT,
  ANNOT_TEXT_DISPLAY_BG,
  ANNOT_UI_LINE_HEIGHT,
  MAX_ANNOT_TEXT_LENGTH,
  MAX_ANNOT_TEXT_PER_PAGE,
  MAX_DRAW_POINTS,
  MAX_SIGN_PER_PAGE,
  TEXT_DRAFT_CHAR_ADVANCE_EM,
  TEXT_DRAFT_H_PADDING_PX,
  TEXT_DRAFT_INITIAL_CHAR_COLUMNS,
} from './pdfPageCanvas/constants.js'
import {
  AnnotTextContentEditable,
  TextAnnotBoxDeleteBtn,
} from './pdfPageCanvas/PdfPageCanvasInlineEditors.jsx'
import { paintAnnotationItemsOnContext } from './pdfPageCanvas/paintAnnotationOverlay.js'
import {
  clamp01,
  nativeEditorFillCss,
  nativeFormatSnapshotsEqual,
  nativeInlineEditorMetrics,
  normalizeHexForColorInput,
  normalizeNativeCompare,
  normalizePlacedAnnotDraftText,
  rawBase64ToUint8,
  seedFormatFromAnnotTextItem,
  snapPlacedAnnotToNativeGrid,
  snapshotNativeFormat,
} from './pdfPageCanvas/helpers.js'
import { usePdfOverlayLayoutSync } from './pdfPageCanvas/usePdfOverlayLayoutSync.js'
import { usePdfPageRenderPipeline } from './pdfPageCanvas/usePdfPageRenderPipeline.js'

/**
 * Renders one PDF page with pdf.js and an interaction overlay.
 * Annotations use normalized coords (0–1, top-left origin) for pdf-lib on the server.
 */
function PdfPageCanvas({
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
  /** Updates toolbar text format while resizing Add Text draft (font size tracks box height). */
  onTextFormatChange = null,
  onBeginNativeTextEdit,
  editTextMode = true,
  /** `(pageIndex, isOpen) => void` — parent must not treat “closed” from another page as global off. */
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
  const textDraftSyncRafRef = useRef(null)
  const textDraftImeComposingRef = useRef(false)
  /** True while the add-text draft textarea has no characters (show subtle “Aa” size preview). */
  const [textDraftBodyEmpty, setTextDraftBodyEmpty] = useState(true)
  const syncTextDraftBoxFromTextareaRef = useRef(() => {})
  const [sigDraft, setSigDraft] = useState(null)
  const sigDraftRef = useRef(null)
  const sigDraftDragRef = useRef(null)
  const sigDraftResizeRef = useRef(null)
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

  /**
   * DOM stacking order for hit targets: later siblings paint on top and win hit-testing.
   * Sort by descending top so deeper lines render first (under) and shallower lines last (on top).
   * Ascending top (old behaviour) put the lower line on top and it stole taps from the line above.
   */
  const textBlocksPaintOrder = useMemo(() => {
    return [...textBlocks].sort((a, b) => {
      const dt = b.top - a.top
      if (Math.abs(dt) > 0.75) return dt
      const dl = a.left - b.left
      if (Math.abs(dl) > 0.75) return dl
      const ia = Number.isFinite(a.pdfTextItemIndex) ? a.pdfTextItemIndex : 0
      const ib = Number.isFinite(b.pdfTextItemIndex) ? b.pdfTextItemIndex : 0
      return ia - ib
    })
  }, [textBlocks])

  /**
   * Tighten **idle** hit targets between vertically neighbouring lines (same column) so a large
   * fontSize-based box does not overlap the line above — taps then hit the intended row.
   * Inline editing reuses the same vertical band so the mask fill does not cover neighbour rows / rules.
   */
  const nativeTextHitClipById = useMemo(() => {
    const list = [...textBlocks].sort((a, b) => {
      const dt = a.top - b.top
      if (Math.abs(dt) > 0.75) return dt
      return a.left - b.left
    })
    /** pdf.js viewport top per block — do not move idle hit boxes too far below real glyph tops. */
    const origTopById = new Map(list.map((b) => [b.id, b.top]))
    /** @type {Map<string, { top: number, bottom: number }>} */
    const m = new Map()
    for (const b of list) {
      m.set(b.id, { top: b.top, bottom: b.top + b.height })
    }
    const nudgeOnce = () => {
      let changed = false
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i]
        const b = list[i + 1]
        if (horizontalOverlapRatio(a, b) < 0.06) continue
        const ca = m.get(a.id)
        const cb = m.get(b.id)
        if (!ca || !cb) continue
        const ah = ca.bottom - ca.top
        const bh = cb.bottom - cb.top
        const gap = cb.top - ca.bottom
        const ov = verticalOverlapRatio(
          { top: ca.top, height: ah },
          { top: cb.top, height: bh }
        )
        if (gap > Math.min(ah, bh) * 0.5 && ov < 0.04) continue

        const ySplit = (ca.bottom + cb.top) * 0.5
        const newABottom = Math.max(ca.top + 2, Math.min(ca.bottom, ySplit))
        const newBTopUncapped = Math.min(cb.bottom - 2, Math.max(cb.top, ySplit))
        /*
         * Uncapped, ySplit can sit well inside the lower line’s pdf bbox when the upper line’s box
         * is tall — idle “Tap to edit” chrome then starts below cap height and looks misaligned.
         * Allow only a modest downward shift from the original pdf top; overlap passes then shrink
         * the upper line’s bottom further instead.
         */
        const bPdfTop = origTopById.get(b.id) ?? cb.top
        const maxLowerShift = Math.min(12, Math.max(2.5, bh * 0.32))
        const newBTop = Math.max(cb.top, Math.min(newBTopUncapped, bPdfTop + maxLowerShift))
        if (newABottom < ca.bottom - 0.05) {
          ca.bottom = newABottom
          changed = true
        }
        if (newBTop > cb.top + 0.05) {
          cb.top = newBTop
          changed = true
        }
      }
      return changed
    }
    let guard = 0
    while (guard < 8 && nudgeOnce()) guard += 1
    return m
  }, [textBlocks])

  const textBlocksRef = useRef(textBlocks)
  const [nativeEdit, setNativeEdit] = useState(null)
  const nativeEditRef = useRef(null)
  const nativeEditorElRef = useRef(null)
  /** Stable id for this line across save/reload so native edits replace instead of stack. */
  const nativeEditSlotIdRef = useRef(null)
  const nativeBlurTimerRef = useRef(null)
  /** Debounce parent `onNativeTextEdit` so typing does not re-render the whole page every key. */
  const nativeSyncTimerRef = useRef(null)
  /** Last payload JSON we pushed from the toolbar-format sync effect — stops feedback loops (#185). */
  const lastToolbarNativePayloadSigRef = useRef(null)
  /** String shown when the inline editor opened — skip parent updates if unchanged (avoids stacking duplicate drawText on save). */
  const nativeOpenBaselineStrRef = useRef('')
  /** Toolbar snapshot at open — so bold/italic/underline-only edits still persist when text is unchanged. */
  const nativeOpenBaselineFormatRef = useRef(null)
  /** Toolbar `fontSizeCss` at open — denominator for live size scaling (bitmap-consistent; see `formatFromTextBlock`). */
  const nativeOpenToolbarFontCssRef = useRef(null)
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
  const itemsRef = useRef(items)
  useLayoutEffect(() => {
    itemsRef.current = items
  }, [items])
  const [selectedAnnotId, setSelectedAnnotId] = useState(null)
  const selectedAnnotIdRef = useRef(null)
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
    selectedAnnotIdRef.current = selectedAnnotId
  }, [selectedAnnotId])

  useLayoutEffect(() => {
    textDraftRef.current = textDraft
  }, [textDraft])

  useEffect(() => {
    if (!textDraft) {
      setTextDraftBodyEmpty(true)
      return
    }
    const id = requestAnimationFrame(() => {
      const v = draftInputRef.current?.value ?? ''
      setTextDraftBodyEmpty(v.length === 0)
    })
    return () => cancelAnimationFrame(id)
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
      const v = normalizePlacedAnnotDraftText(raw)
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
    el.focus({ preventScroll: true })
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
    const { cssW: cwL, cssH: chL, bmpW: bwL, bmpH: bhL } = canvasLayout
    const sxL = bwL > 0 ? cwL / bwL : 1
    const syL = bhL > 0 ? chL / bhL : 1
    const clipRow = nativeTextHitClipById.get(b.id)
    const effTopPdf = clipRow?.top ?? b.top
    const effBotPdf = clipRow?.bottom ?? b.top + b.height
    const idleHCssL = Math.max(10, (effBotPdf - effTopPdf) * syL)
    const toolbarOpen =
      nativeOpenToolbarFontCssRef.current ??
      Math.max(1, Number(f.fontSizeCss) || Number(b.fontSizePx) || 12)
    const { editorFontCssPx, lineHeightPx } = nativeInlineEditorMetrics(b, f, toolbarOpen, sxL, syL)
    el.style.fontSize = `${editorFontCssPx}px`
    el.style.lineHeight = `${lineHeightPx}px`
    el.style.letterSpacing = 'normal'
    el.style.wordSpacing = 'normal'
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
    /* Match single-line PDF items: pre-wrap + narrow pdf.js width forces "Financial Year" to break at the space. */
    el.style.whiteSpace = 'pre'
    el.style.overflowWrap = 'normal'
    el.style.maxHeight = `${idleHCssL}px`
    el.style.maxWidth = '100%'
    el.style.overflow = 'hidden'
    el.style.backgroundColor = nativeEditorFillCss(nativeEdit.maskFillHex, f)
  }, [nativeEdit, textFormat, canvasLayout, nativeTextHitClipById])

  const [textDiag, setTextDiag] = useState(null)

  usePdfPageRenderPipeline({
    pdfPage,
    pdfCanvasRef,
    metaRef,
    setTextRuns,
    setTextDiag,
    setReady,
  })

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
    paintAnnotationItemsOnContext(ctx, w, h, items, draftLinePts, draftBox)
  }, [items])

  useEffect(() => {
    if (tool !== 'editText' || !editTextMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- exit inline editor when tool/mode off
      setNativeEdit(null)
    }
  }, [tool, editTextMode])

  useEffect(() => {
    onInlineEditorActiveChange?.(pageIndex, !!nativeEdit)
  }, [nativeEdit, onInlineEditorActiveChange, pageIndex])

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

  usePdfOverlayLayoutSync({
    pdfPage,
    ready,
    nativeEdit,
    pdfCanvasRef,
    overlayRef,
    metaRef,
    setCanvasLayout,
    paintOverlay,
  })

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
      if (typeof onTextFormatChange === 'function') {
        onTextFormatChange((prev) => ({
          ...prev,
          fontSizeCss: ADD_TEXT_DRAFT_DEFAULT_FONT_CSS,
        }))
      }
      const { cssW: W, cssH: H, bmpW } = metaRef.current
      if (W >= 1 && H >= 1) {
        const fsCss = Math.max(
          FONT_SIZE_MIN,
          Math.min(FONT_SIZE_MAX, ADD_TEXT_DRAFT_DEFAULT_FONT_CSS)
        )
        const sx0 = bmpW > 0 ? W / bmpW : 1
        /* One-line strip sized to this font so the frame matches the text, not a generic card. */
        const linePx = Math.max(10, fsCss * sx0 * ANNOT_UI_LINE_HEIGHT)
        const nh = Math.min(0.2, Math.max(0.016, (linePx + 4) / H))
        const layoutFsPx = fsCss * sx0
        const wPx =
          TEXT_DRAFT_INITIAL_CHAR_COLUMNS * layoutFsPx * TEXT_DRAFT_CHAR_ADVANCE_EM +
          TEXT_DRAFT_H_PADDING_PX
        const nw = Math.min(0.62, Math.max(0.018, wPx / W))
        setTextDraft({
          nx: n.nx,
          ny: n.ny,
          nw,
          nh,
          baseNh: nh,
          baseFontCss: fsCss,
        })
      } else {
        setTextDraft({ nx: n.nx, ny: n.ny, nw: 0.048, nh: 0.034, baseNh: 0.034, baseFontCss: 14 })
      }
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
      if (textDraftSyncRafRef.current != null) {
        cancelAnimationFrame(textDraftSyncRafRef.current)
        textDraftSyncRafRef.current = null
      }
      if (!textDraftImeComposingRef.current) {
        flushSync(() => {
          syncTextDraftBoxFromTextareaRef.current?.()
        })
      }
      const draft = textDraftRef.current
      if (!draft) return
      const fmt = textFormatRef?.current ?? textFormat ?? defaultTextFormat()
      const cssN = Math.max(
        FONT_SIZE_MIN,
        Math.min(FONT_SIZE_MAX, Number(fmt.fontSizeCss) || 14)
      )
      textDraftRef.current = null
      textDraftDragRef.current = null
      setTextDraft(null)
      const v = normalizePlacedAnnotDraftText(value)
      if (!v) return
      const textAnnotCount = items.filter((it) => it.type === 'text').length
      if (textAnnotCount >= MAX_ANNOT_TEXT_PER_PAGE) return
      const el = pdfCanvasRef.current
      const { pdfW, cssW: metaCssW } = metaRef.current
      const bmpW =
        el && el.width > 0 ? el.width : metaRef.current.bmpW > 0 ? metaRef.current.bmpW : 1
      const fontSizePt = Math.max(4, Math.min(144, cssN * (pdfW / bmpW)))
      /* `nw` / `fontSizeCss` match viewer layout; export uses the same line step (`ANNOT_UI_LINE_HEIGHT`) as backend/applyEdits.js. */
      /* Capture box width before draft is cleared — used for server-side alignment. */
      const draftBoxW =
        typeof draft.nw === 'number' && draft.nw > 0
          ? draft.nw * metaCssW
          : draftInputRef.current?.offsetWidth ?? 0
      const nw =
        typeof draft.nw === 'number' && draft.nw > 0
          ? draft.nw
          : metaCssW > 0 && draftBoxW > 0
            ? draftBoxW / metaCssW
            : 0
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

  useEffect(() => {
    if (!selectedAnnotId || editingAnnotId != null || textDraft || sigDraft) return
    const onKey = (e) => {
      const key = e.key
      if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown') return
      const id = selectedAnnotIdRef.current
      if (!id) return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement)
        return
      if (
        t instanceof HTMLElement &&
        (t.isContentEditable || t.closest?.('[contenteditable="true"]'))
      ) {
        return
      }
      if (t instanceof HTMLElement && t.closest?.('[data-pdf-inline-editor-root]')) return
      const prevSnap = itemsRef.current || []
      const it0 = prevSnap.find(
        (x) => x.id === id && (x.type === 'text' || x.type === 'signature') && !x.rasterizedInPdf
      )
      if (!it0 || typeof it0.x !== 'number' || typeof it0.y !== 'number') return
      const step = e.shiftKey ? 0.0025 : 0.01
      let dx = 0
      let dy = 0
      if (key === 'ArrowLeft') dx = -step
      if (key === 'ArrowRight') dx = step
      if (key === 'ArrowUp') dy = -step
      if (key === 'ArrowDown') dy = step
      e.preventDefault()
      onUpdateItems((prev) => {
        const it = prev.find(
          (x) => x.id === id && (x.type === 'text' || x.type === 'signature') && !x.rasterizedInPdf
        )
        if (!it || typeof it.x !== 'number' || typeof it.y !== 'number') return prev
        let nx = clamp01(it.x + dx)
        let ny = clamp01(it.y + dy)
        const sn = snapPlacedAnnotToNativeGrid(textBlocksRef.current, it, nx, ny, metaRef.current.pdfH)
        nx = sn.x
        ny = sn.y
        return prev.map((x) => (x.id === id ? { ...x, x: nx, y: ny } : x))
      })
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [selectedAnnotId, editingAnnotId, textDraft, sigDraft, onUpdateItems])

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

  const clampAnnotFontCss = useCallback((n) => {
    return Math.round(Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, n)))
  }, [])

  /** Grow/shrink draft `nw`/`nh` from textarea metrics: `pre` = no soft wrap; width must be collapsed to read intrinsic `scrollWidth` (with `w-full`, scrollWidth often equals the box). */
  const syncTextDraftBoxFromTextarea = useCallback(() => {
    if (textDraftImeComposingRef.current) return
    const ta = draftInputRef.current
    const draft = textDraftRef.current
    if (!ta || !draft) return
    const { cssW: W, cssH: H, bmpW } = metaRef.current
    if (W < 1 || H < 1) return
    const fmt = textFormatRef?.current ?? textFormat ?? defaultTextFormat()
    const fsCss = Math.max(
      FONT_SIZE_MIN,
      Math.min(FONT_SIZE_MAX, Number(fmt.fontSizeCss) || 14)
    )
    const sx0 = bmpW > 0 ? W / bmpW : 1
    const emptyMinWpx =
      TEXT_DRAFT_INITIAL_CHAR_COLUMNS * fsCss * sx0 * TEXT_DRAFT_CHAR_ADVANCE_EM +
      TEXT_DRAFT_H_PADDING_PX
    /* Tight horizontal slack — match placed-text look; ring + caret only (no corner resize control). */
    const hPad = 14
    const vPad = 8
    const savedW = ta.style.width
    ta.style.width = '0px'
    const intrinsicSw = ta.scrollWidth
    ta.style.width = savedW || ''
    ta.style.height = '0px'
    const scrollH = ta.scrollHeight
    ta.style.height = `${scrollH}px`
    const hasText = Boolean(String(ta.value ?? '').length)
    const typedFloorPx = Math.max(8, Math.ceil(fsCss * sx0) + 4)
    const wantWpx = hasText
      ? Math.max(typedFloorPx + hPad, Math.ceil(intrinsicSw) + hPad + 2)
      : emptyMinWpx
    const wantHpx = scrollH + vPad
    const { nw: newNw, nh: newNh } = resolveTextDraftNormSize({
      wantWpx,
      wantHpx,
      W,
      H,
      nx: draft.nx,
      ny: draft.ny,
      nwFloor: draft.nwFloor,
    })
    const ew = 2 / W
    const eh = 2 / H
    if (Math.abs(newNw - draft.nw) < ew && Math.abs(newNh - draft.nh) < eh) {
      return
    }
    setTextDraft((prev) => (prev ? { ...prev, nw: newNw, nh: newNh } : null))
  }, [textFormat, textFormatRef])

  useLayoutEffect(() => {
    syncTextDraftBoxFromTextareaRef.current = syncTextDraftBoxFromTextarea
  }, [syncTextDraftBoxFromTextarea])

  const scheduleTextDraftBoxSync = useCallback(() => {
    if (textDraftImeComposingRef.current) return
    if (textDraftSyncRafRef.current != null) return
    textDraftSyncRafRef.current = requestAnimationFrame(() => {
      textDraftSyncRafRef.current = null
      syncTextDraftBoxFromTextarea()
    })
  }, [syncTextDraftBoxFromTextarea])

  const onSigDraftResizePointerDown = useCallback((e) => {
    if (!e.isPrimary || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const d0 = sigDraftRef.current
    if (!d0?.nw || !d0?.nh) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    sigDraftResizeRef.current = {
      pointerId: e.pointerId,
      startCx: e.clientX,
      startCy: e.clientY,
      startNw: d0.nw,
      startNh: d0.nh,
      nx: d0.nx,
      ny: d0.ny,
    }
  }, [])

  const onSigDraftResizePointerMove = useCallback((e) => {
    const d = sigDraftResizeRef.current
    if (!d || e.pointerId !== d.pointerId) return
    const { cssW: W, cssH: H } = metaRef.current
    if (W < 1 || H < 1) return
    const dWpx = e.clientX - d.startCx
    const dHpx = e.clientY - d.startCy
    const w0 = Math.max(12, d.startNw * W)
    const h0 = Math.max(12, d.startNh * H)
    const scale = 1 + Math.max(dWpx / w0, dHpx / h0)
    const sc = Math.max(0.25, Math.min(5, scale))
    let newNw = d.startNw * sc
    let newNh = d.startNh * sc
    newNw = Math.min(Math.max(0.04, newNw), 1 - d.nx - 0.01)
    newNh = Math.min(Math.max(0.025, newNh), 1 - d.ny - 0.01)
    setSigDraft((prev) => (prev ? { ...prev, nw: newNw, nh: newNh } : null))
  }, [])

  const onSigDraftResizePointerUp = useCallback((e) => {
    const d = sigDraftResizeRef.current
    if (!d || e.pointerId !== d.pointerId) return
    sigDraftResizeRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const annotResizeRef = useRef(null)

  const onPlacedAnnotResizePointerDown = useCallback((e, it, kind) => {
    if (!e.isPrimary || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const { cssW: W, cssH: H, pdfW, bmpW } = metaRef.current
    if (W < 1 || H < 1) return
    const sx = bmpW > 0 ? W / bmpW : 1
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (kind === 'sig') {
      annotResizeRef.current = {
        kind: 'sig',
        id: it.id,
        pointerId: e.pointerId,
        startCx: e.clientX,
        startCy: e.clientY,
        startW: it.w,
        startH: it.h,
        ox: it.x,
        oy: it.y,
      }
    } else {
      const fsCss = Math.max(
        FONT_SIZE_MIN,
        Math.min(FONT_SIZE_MAX, Number(it.fontSizeCss) || 14)
      )
      const lines = Math.max(1, String(it.text || '').split('\n').length)
      const startNh = Math.min(
        0.48,
        Math.max(0.03, ((fsCss * sx * ANNOT_UI_LINE_HEIGHT) / H) * lines)
      )
      const startNw = Number(it.nw) > 0 ? it.nw : Math.min(0.55, Math.max(0.1, 0.22))
      annotResizeRef.current = {
        kind: 'text',
        id: it.id,
        pointerId: e.pointerId,
        startCx: e.clientX,
        startCy: e.clientY,
        startNw,
        startNh,
        startFontCss: fsCss,
        ox: it.x,
        oy: it.y,
        pdfW: pdfW > 0 ? pdfW : 612,
        bmpW: bmpW > 0 ? bmpW : 1,
      }
    }
  }, [])

  const onPlacedAnnotResizePointerMove = useCallback(
    (e) => {
      const d = annotResizeRef.current
      if (!d || e.pointerId !== d.pointerId) return
      const { cssW: W, cssH: H } = metaRef.current
      if (W < 1 || H < 1) return
      const dWpx = e.clientX - d.startCx
      const dHpx = e.clientY - d.startCy
      if (d.kind === 'sig') {
        const w0 = Math.max(12, d.startW * W)
        const h0 = Math.max(12, d.startH * H)
        const scale = 1 + Math.max(dWpx / w0, dHpx / h0)
        const sc = Math.max(0.25, Math.min(5, scale))
        let nw = d.startW * sc
        let nh = d.startH * sc
        nw = Math.min(Math.max(0.04, nw), 1 - d.ox - 0.01)
        nh = Math.min(Math.max(0.025, nh), 1 - d.oy - 0.01)
        patchAnnotItem(d.id, { w: nw, h: nh })
      } else {
        const w0 = Math.max(12, d.startNw * W)
        const h0 = Math.max(12, d.startNh * H)
        const scale = 1 + Math.max(dWpx / w0, dHpx / h0)
        const sc = Math.max(0.35, Math.min(4, scale))
        let newNw = d.startNw * sc
        let newNh = d.startNh * sc
        newNw = Math.min(Math.max(0.06, newNw), 1 - d.ox - 0.02)
        newNh = Math.min(Math.max(0.03, newNh), 1 - d.oy - 0.02)
        const nextCss = clampAnnotFontCss((d.startFontCss * newNh) / d.startNh)
        const nextPt = Math.max(4, Math.min(144, (nextCss * d.pdfW) / d.bmpW))
        patchAnnotItem(d.id, { nw: newNw, fontSizeCss: nextCss, fontSize: nextPt })
      }
    },
    [clampAnnotFontCss, patchAnnotItem]
  )

  const onPlacedAnnotResizePointerUp = useCallback((e) => {
    const d = annotResizeRef.current
    if (!d || e.pointerId !== d.pointerId) return
    annotResizeRef.current = null
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
    if (sigDraftResizeRef.current) return
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
    if (textDraftSyncRafRef.current != null) {
      cancelAnimationFrame(textDraftSyncRafRef.current)
      textDraftSyncRafRef.current = null
    }
    textDraftImeComposingRef.current = false
    textDraftRef.current = null
    setTextDraft(null)
  }, [tool])

  useEffect(() => {
    if (tool === 'signature') return
    sigDraftDragRef.current = null
    sigDraftResizeRef.current = null
    sigDraftRef.current = null
    setSigDraft(null)
    setSigDefaultBox(null)
  }, [tool])

  const { cssW: cw, cssH: ch, bmpW, bmpH } = canvasLayout
  const sxRaw = bmpW > 0 ? cw / bmpW : 1
  const syRaw = bmpH > 0 ? ch / bmpH : 1
  /*
   * When the canvas CSS box matches the bitmap aspect (normal case), sx and sy should match.
   * Rounding on clientHeight vs width-derived height can differ by a subpixel ratio; using one
   * scale for both axes keeps the text layer aligned with the rasterized page.
   */
  let sx = sxRaw
  let sy = syRaw
  if (bmpW > 0 && bmpH > 0 && cw > 0 && ch > 0) {
    const rel = Math.abs(sxRaw - syRaw) / Math.max(sxRaw, syRaw)
    if (rel < 0.012) {
      sx = sy = (sxRaw + syRaw) / 2
    }
  }

  useLayoutEffect(() => {
    if (!textDraft) return
    syncTextDraftBoxFromTextarea()
  }, [
    textDraft?.nx,
    textDraft?.ny,
    textDraft?.nw,
    textDraft?.nh,
    textFormat?.fontSizeCss,
    textFormat?.fontFamily,
    textFormat?.bold,
    textFormat?.italic,
    textFormat?.underline,
    textFormat?.align,
    cw,
    bmpW,
    syncTextDraftBoxFromTextarea,
  ])

  /**
   * Resolve which text block contains the click at `(clientX, clientY)`.
   * Uses the same clipped idle bands the hit targets use, so dense layouts do not route a click to
   * a neighbour because of DOM stacking or z-index. Falls back to the tapped button’s `block` only
   * when the cursor sits outside every clipped band (e.g. a tall letter above its tight band).
   *
   * @param {number} clientX
   * @param {number} clientY
   * @param {Record<string, unknown>} fallbackBlock
   */
  const resolveBlockUnderClient = useCallback(
    (clientX, clientY, fallbackBlock) => {
      const overlay = overlayRef.current
      const blocks = textBlocksRef.current
      if (!overlay || !blocks?.length) return fallbackBlock
      const r = overlay.getBoundingClientRect()
      if (r.width < 1 || r.height < 1 || !overlay.width || !overlay.height) return fallbackBlock
      const scaleX = overlay.width / r.width
      const scaleY = overlay.height / r.height
      const px = (clientX - r.left) * scaleX
      const py = (clientY - r.top) * scaleY

      /* Pass 1: strict containment inside the clipped idle band (the hit rect the user sees).
       * Upper bounds are EXCLUSIVE so the shared boundary between two adjacent blocks belongs to
       * the LOWER block only. This prevents a click at the exact clip midpoint from matching the
       * upper block (causing it to re-open after the lower block was already opened by pointerdown). */
      let strict = null
      let strictArea = Infinity
      for (const b of blocks) {
        const clip = nativeTextHitClipById.get(b.id)
        const bt = clip?.top ?? b.top
        const bb = clip?.bottom ?? b.top + b.height
        const bl = b.left
        const br = b.left + b.width
        if (px < bl || px >= br) continue
        if (py < bt || py >= bb) continue
        /* Tie-break: prefer the smallest containing rect (the most specific line). */
        const a = Math.max(1, (br - bl) * Math.max(1, bb - bt))
        if (a < strictArea) {
          strict = b
          strictArea = a
        }
      }
      if (strict) return strict

      /* Pass 2: nearest-by-band with a small vertical slop, biased to horizontal containment. */
      let near = null
      let nearScore = Infinity
      const slop = Math.max(4, (r.height > 0 ? overlay.height / r.height : 1) * 4)
      for (const b of blocks) {
        const bl = b.left
        const br = b.left + b.width
        if (px < bl - slop || px > br + slop) continue
        const clip = nativeTextHitClipById.get(b.id)
        const bt = clip?.top ?? b.top
        const bb = clip?.bottom ?? b.top + b.height
        let vd
        if (py < bt) vd = bt - py
        else if (py > bb) vd = py - bb
        else vd = 0
        if (vd > slop) continue
        const hd = px < bl ? bl - px : px > br ? px - br : 0
        const score = vd * 4 + hd
        if (score < nearScore) {
          nearScore = score
          near = b
        }
      }
      return near ?? fallbackBlock
    },
    [nativeTextHitClipById]
  )

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
      const prevFmt = textFormatRef?.current ?? defaultTextFormat()
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
        nativeOpenToolbarFontCssRef.current = Math.max(
          1,
          Number(presetFormat.fontSizeCss) || Number(block.fontSizePx) || 12
        )
        onBeginNativeTextEdit?.(block, {
          sampleColorHex: sampleColorHex ?? undefined,
          presetFormat,
          layoutHint,
          _maskColorHexSeed: maskFillHex,
        })
      } catch (err) {
        console.error('formatFromTextBlock failed', err)
        nativeOpenToolbarFontCssRef.current = Math.max(1, Number(block.fontSizePx) || 12)
        onBeginNativeTextEdit?.(block, {
          sampleColorHex: sampleColorHex ?? undefined,
          layoutHint,
          _maskColorHexSeed: maskFillHex,
        })
      }
      lastToolbarNativePayloadSigRef.current = null
      setNativeEdit({ block, maskFillHex })
    },
    [onBeginNativeTextEdit, pageIndex, sessionNativeTextEdits, textFormatRef]
  )

  /** Capture format once when edit opens only (`nativeEdit` deps — not `textFormat`, or toggling B/I/U would reset baseline). */
  useLayoutEffect(() => {
    if (!nativeEdit) {
      nativeOpenBaselineFormatRef.current = null
      nativeOpenToolbarFontCssRef.current = null
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
      /* preventScroll: otherwise the browser scrolls the scroll root to “show” the editor and the PDF/zoom feel misaligned. */
      el2.focus({ preventScroll: true })
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
    const fmt = textFormatRef?.current ?? defaultTextFormat()
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
  }, [textFormatRef])

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
      }, 450)
    },
    [onNativeTextEdit, buildNativePayload]
  )

  /**
   * Push toolbar-only changes (B/I/U, colour, font size …) immediately so they are always
   * captured in `nativeTextEditsRef` before a Save/Download that might happen within the
   * keystroke-debounce window. The debounced sync is still responsible for keystroke
   * content; this effect handles format-only changes.
   *
   * `buildNativePayload` is kept **stable** (reads `textFormatRef` only) so this effect is not
   * re-entered via dependency churn — that caused React #185 (max update depth) when clicking
   * into native text edit in production.
   */
  useEffect(() => {
    if (!nativeEdit) {
      lastToolbarNativePayloadSigRef.current = null
      return
    }
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
    const payload = buildNativePayload(nativeEdit.block, raw)
    const sig = JSON.stringify(payload)
    if (sig === lastToolbarNativePayloadSigRef.current) return
    lastToolbarNativePayloadSigRef.current = sig
    onNativeTextEdit?.(payload)
  }, [textFormat, nativeEdit, buildNativePayload, onNativeTextEdit])

  /** Toolbar “Insert symbol” dispatches this so Unicode (₹, ✓, …) lands in the active editor. */
  useEffect(() => {
    if (!nativeEdit) return
    const onIns = (e) => {
      const t = e.detail?.text
      if (typeof t !== 'string' || !t) return
      const el = nativeEditorElRef.current
      const block = nativeEditRef.current?.block
      if (!el || !block) return
      el.focus({ preventScroll: true })
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

  /**
   * Commit the currently-open editor (if any) and open `nextBlock` for editing. Declared after
   * `commitNativeEdit` + `openNativeEditorForBlock` so their `const` bindings are initialized —
   * otherwise the `useCallback` deps array trips a TDZ ReferenceError on render.
   */
  const switchEditorToBlockIfDifferent = useCallback(
    (nextBlock) => {
      const cur = nativeEditRef.current
      if (cur && cur.block.id !== nextBlock.id) {
        const ed = nativeEditorElRef.current
        commitNativeEdit(ed?.innerText ?? '')
      }
      openNativeEditorForBlock(nextBlock)
    },
    [commitNativeEdit, openNativeEditorForBlock]
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

  /* Toolbar Done/Reset when `textBoxOverlayActions` did not register (fallback dispatches these). */
  useEffect(() => {
    if (!nativeEdit) return
    const onToolbarDone = () => {
      const el = nativeEditorElRef.current
      commitNativeEdit(el?.innerText ?? '')
    }
    const onToolbarReset = () => {
      revertNativeEdit()
    }
    document.addEventListener('pdfpilot-native-overlay-done', onToolbarDone)
    document.addEventListener('pdfpilot-native-overlay-reset', onToolbarReset)
    return () => {
      document.removeEventListener('pdfpilot-native-overlay-done', onToolbarDone)
      document.removeEventListener('pdfpilot-native-overlay-reset', onToolbarReset)
    }
  }, [nativeEdit, commitNativeEdit, revertNativeEdit])

  /* After `commitNativeEdit` / `revertNativeEdit` so dependency arrays do not hit TDZ. */
  useLayoutEffect(() => {
    if (!onTextBoxOverlayActionsChange) return
    if (textDraft) {
      onTextBoxOverlayActionsChange(pageIndex, {
        done: () => commitText(draftInputRef.current?.value ?? ''),
        reset: () => {
          if (textDraftSyncRafRef.current != null) {
            cancelAnimationFrame(textDraftSyncRafRef.current)
            textDraftSyncRafRef.current = null
          }
          textDraftDragRef.current = null
          textDraftImeComposingRef.current = false
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
    if (nativeEdit) {
      onTextBoxOverlayActionsChange(pageIndex, {
        done: () => {
          const el = nativeEditorElRef.current
          commitNativeEdit(el?.innerText ?? '')
        },
        reset: () => revertNativeEdit(),
      })
      return () => onTextBoxOverlayActionsChange(pageIndex, null)
    }
    onTextBoxOverlayActionsChange(pageIndex, null)
    return undefined
  }, [
    textDraft,
    editingAnnotId,
    nativeEdit,
    onTextBoxOverlayActionsChange,
    pageIndex,
    commitText,
    commitAnnotEdit,
    commitNativeEdit,
    revertNativeEdit,
    sigDraft,
    commitSigPlacement,
    cancelSigDraft,
  ])

  /** Click outside textarea / format panel commits (canvas is not focusable — blur alone is unreliable). */
  useEffect(() => {
    if (!nativeEdit) return
    const onDocPointerDown = (e) => {
      const t = e.target
      /*
       * Defensive re-route: if the click happens to land inside the currently-editing contenteditable
       * but the cursor is actually over a different text block (DOM stacking / overlapping wrappers on
       * dense layouts), commit the current edit and open the block truly under the cursor — *before*
       * the native caret jumps inside this editor.
       */
      if (t.closest?.('[data-pdf-inline-editor-root]')) {
        /*
         * Revert button click: skip coordinate re-routing entirely — the user
         * explicitly wants to revert, not switch editors. Let the button's own
         * onMouseDown handle it without interference.
         */
        if (t.closest?.('[data-pdf-revert-button]')) return
        const editing = nativeEditRef.current?.block
        if (editing) {
          const under = resolveBlockUnderClient(e.clientX, e.clientY, editing)
          if (under && under.id !== editing.id) {
            e.preventDefault()
            e.stopPropagation()
            const el = nativeEditorElRef.current
            commitNativeEdit(el?.innerText ?? '')
            openNativeEditorForBlock(under)
            return
          }
        }
        return
      }
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
  }, [nativeEdit, commitNativeEdit, openNativeEditorForBlock, resolveBlockUnderClient])

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
    if (e.target instanceof Element && e.target.closest?.('[data-pdf-annot-resize]')) return
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
    if (e.target instanceof Element && e.target.closest?.('[data-pdf-annot-resize]')) return
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
      let nx = clamp01(d.ox + (e.clientX - d.sx) / W)
      let ny = clamp01(d.oy + (e.clientY - d.sy) / H)
      if (it.type === 'text' || it.type === 'signature') {
        const sn = snapPlacedAnnotToNativeGrid(
          textBlocksRef.current,
          it,
          nx,
          ny,
          metaRef.current.pdfH
        )
        nx = sn.x
        ny = sn.y
      }
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
                    title="Drag the padded edge to move — click the text to edit"
                    className="relative box-border inline-flex max-w-full cursor-grab rounded-md p-1.5 shadow-sm ring-2 ring-blue-600 active:cursor-grabbing"
                    style={{ backgroundColor: ANNOT_TEXT_DISPLAY_BG }}
                    onPointerDown={(e) => {
                      if (!annotLayerInteractive || !e.isPrimary || e.button !== 0) return
                      if (!(e.target instanceof Element)) return
                      if (e.target.closest('[data-pdf-annot-editor]')) return
                      if (e.target.closest('[data-pdf-annot-delete-skip-blur]')) return
                      if (e.target.closest('[data-pdf-annot-resize]')) return
                      beginAnnotTextDrag(e, it)
                    }}
                    onPointerMove={(e) => annotPointerMove(e, it)}
                    onPointerUp={(e) => endAnnotDrag(e, it)}
                    onPointerCancel={(e) => endAnnotDrag(e, it)}
                  >
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
                    {isSel && annotLayerInteractive && !isEdit && (
                      <button
                        type="button"
                        data-pdf-annot-resize="se"
                        aria-label="Resize text box"
                        title="Drag to resize — text size scales with the box"
                        className="absolute bottom-0 right-0 z-20 h-3.5 w-3.5 cursor-nwse-resize rounded-br-md border border-blue-600 bg-white/95 shadow touch-none dark:bg-zinc-900/95"
                        onPointerDown={(e) => onPlacedAnnotResizePointerDown(e, it, 'text')}
                        onPointerMove={onPlacedAnnotResizePointerMove}
                        onPointerUp={onPlacedAnnotResizePointerUp}
                        onPointerCancel={onPlacedAnnotResizePointerUp}
                      />
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
                  {isSel && annotLayerInteractive && (
                    <button
                      type="button"
                      data-pdf-annot-resize="se"
                      aria-label="Resize signature"
                      title="Drag to resize — image scales with the box"
                      className="absolute bottom-0 right-0 z-20 h-3.5 w-3.5 cursor-nwse-resize rounded-br-md border border-blue-600 bg-white/95 shadow touch-none dark:bg-zinc-900/95"
                      onPointerDown={(e) => onPlacedAnnotResizePointerDown(e, it, 'sig')}
                      onPointerMove={onPlacedAnnotResizePointerMove}
                      onPointerUp={onPlacedAnnotResizePointerUp}
                      onPointerCancel={onPlacedAnnotResizePointerUp}
                    />
                  )}
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
          {textBlocksPaintOrder.map((block) => {
            const isEditing = nativeEdit?.block?.id === block.id
            const w = Math.max(block.width * sx, 4)
            const left = block.left * sx
            /*
             * Idle taps: use vertically clipped bands between neighbours so a heading-sized min-height
             * does not paint a hit target into the line above (which then won DOM hit-testing).
             * Editing keeps full pdf quad + font-based min height so the contenteditable still fits.
             */
            const clipRow = nativeTextHitClipById.get(block.id)
            const effTopPdf = clipRow?.top ?? block.top
            const effBotPdf = clipRow?.bottom ?? block.top + block.height
            const idleTopCss = effTopPdf * sy
            const idleHCss = Math.max(10, (effBotPdf - effTopPdf) * sy)
            const fmt = textFormat ?? defaultTextFormat()
            let editorFontCssPx = 12
            let lineHeightPx = 14
            if (isEditing) {
              const toolbarOpen =
                nativeOpenToolbarFontCssRef.current ??
                Math.max(1, Number(fmt.fontSizeCss) || Number(block.fontSizePx) || 12)
              const m = nativeInlineEditorMetrics(block, fmt, toolbarOpen, sx, sy)
              editorFontCssPx = m.editorFontCssPx
              lineHeightPx = m.lineHeightPx
            }
            const rotDeg = fmt.rotationDeg ?? 0
            const editFontFamily = editorFontFamilyWithPdfHint(
              cssDisplayFontFromPdf(block.pdfFontFamily, fmt.fontFamily)
            )
            /* Line box tracks pdf.js bbox height (scaled) and grows with toolbar font-size via `lineHeightPx`. */
            const wrapperMinH = isEditing
              ? Math.max(
                  lineHeightPx + 6,
                  Math.round((Number(block.height) || lineHeightPx) * (sy > 0 ? sy : 1))
                )
              : idleHCss
            /*
             * Idle: clipped hit band + pdf.js quad width.
             * Editing: minWidth = quad width (often under-estimates rendered ink vs substitute fonts).
             * width max-content lets one logical line stay horizontal like the PDF; maxWidth caps at canvas.
             */
            const editorMaxW = Math.max(w, Math.max(0, cw - left - 4))
            const wCell = Math.max(w, 4)
            const wrapperStyle = isEditing
              ? {
                  left,
                  /* Same vertical band as idle taps so the mask does not paint into neighbour rows / rules. */
                  top: idleTopCss,
                  width: wCell,
                  minWidth: wCell,
                  maxWidth: Math.min(editorMaxW, wCell),
                  minHeight: Math.min(wrapperMinH, idleHCss + 2),
                  height: 'auto',
                }
              : {
                  left,
                  top: idleTopCss,
                  width: w,
                  minHeight: idleHCss,
                  height: idleHCss,
                }
            return (
              <div
                key={block.id}
                className="absolute touch-manipulation pointer-events-none"
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
                    className="pdf-text-layer-editor pointer-events-auto relative z-[1] box-border cursor-text select-text overflow-x-visible overflow-y-visible rounded-sm border border-solid border-[#4A90E2] outline-none transition-[border-color,background-color] duration-150"
                    style={{
                      colorScheme: 'light',
                      backgroundColor: nativeEditorFillCss(nativeEdit?.maskFillHex, fmt),
                      fontSize: `${editorFontCssPx}px`,
                      lineHeight: `${lineHeightPx}px`,
                      letterSpacing: 'normal',
                      wordSpacing: 'normal',
                      fontFamily: editFontFamily,
                      fontWeight: fmt.bold ? 700 : 400,
                      fontStyle: fmt.italic ? 'italic' : 'normal',
                      textDecoration: fmt.underline ? 'underline' : 'none',
                      textAlign: fmt.align,
                      color: fmt.color,
                      opacity: fmt.opacity ?? 1,
                      transform: rotDeg ? `rotate(${rotDeg}deg)` : 'none',
                      transformOrigin: rotDeg ? 'top left' : undefined,
                      whiteSpace: 'pre',
                      overflowWrap: 'normal',
                      wordBreak: 'normal',
                      maxHeight: idleHCss,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      padding: 0,
                      margin: 0,
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
                      const f = textFormatRef?.current ?? textFormat ?? defaultTextFormat()
                      const ov = overlayRef.current
                      const r = ov?.getBoundingClientRect()
                      const bw = ov?.width > 0 ? ov.width : metaRef.current.bmpW || 1
                      const bh = ov?.height > 0 ? ov.height : metaRef.current.bmpH || 1
                      const cwIn = r && r.width > 0 ? r.width : metaRef.current.cssW || 1
                      const chIn = r && r.height > 0 ? r.height : metaRef.current.cssH || 1
                      const sxIn = bw > 0 ? cwIn / bw : 1
                      const syIn = bh > 0 ? chIn / bh : 1
                      const toolbarOpen =
                        nativeOpenToolbarFontCssRef.current ??
                        Math.max(1, Number(f.fontSizeCss) || Number(block.fontSizePx) || 12)
                      const { editorFontCssPx: fsPx, lineHeightPx: lhPx } = nativeInlineEditorMetrics(
                        block,
                        f,
                        toolbarOpen,
                        sxIn,
                        syIn
                      )
                      el.style.colorScheme = 'light'
                      el.style.backgroundColor = nativeEditorFillCss(
                        nativeEditRef.current?.maskFillHex,
                        f
                      )
                      el.style.fontSize = `${fsPx}px`
                      el.style.lineHeight = `${lhPx}px`
                      el.style.letterSpacing = 'normal'
                      el.style.wordSpacing = 'normal'
                      el.style.fontFamily = editorFontFamilyWithPdfHint(
                        cssDisplayFontFromPdf(block.pdfFontFamily, f.fontFamily)
                      )
                      el.style.color = f.color
                      el.style.fontWeight = f.bold ? '700' : '400'
                      el.style.fontStyle = f.italic ? 'italic' : 'normal'
                      el.style.textDecoration = f.underline ? 'underline' : 'none'
                      el.style.whiteSpace = 'pre'
                      el.style.overflowWrap = 'normal'
                      el.style.wordBreak = 'normal'
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
                  {/* Revert action bar — floated to the right of the editing contenteditable
                      so it never extends below the block's own vertical bounds and cannot
                      physically overlap the idle tap-button of a nearby line below.
                      `data-pdf-revert-button` lets the document capture handler skip
                      coordinate-based re-routing for clicks on this button. */}
                  {nativeEditSlotIdRef.current && (
                    <div
                      data-pdf-inline-editor-root
                      data-pdf-revert-button
                      className="pointer-events-none absolute right-0 top-0 z-[10] flex translate-x-full items-center pl-1"
                    >
                      <button
                        type="button"
                        title="Revert to original PDF text"
                        onMouseDown={(e) => {
                          /* Prevent blur on the contentEditable before we can act */
                          e.preventDefault()
                          revertNativeEdit()
                        }}
                        className="pointer-events-auto whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 shadow-sm hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200 dark:hover:bg-amber-800/80"
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
                    className={`pdf-text-layer-hit pdf-text-layer-tap-target pointer-events-auto absolute inset-0 z-[1] overflow-hidden border bg-transparent p-0 font-inherit outline-none transition-[border-color,background-color] duration-150 select-none ${
                      hoverBlockId === block.id
                        ? 'border border-dashed border-[#ccc]'
                        : 'border border-transparent'
                    }`}
                    style={{
                      color: 'transparent',
                      caretColor: 'transparent',
                      touchAction: 'manipulation',
                    }}
                    onPointerEnter={() => setHoverBlockId(block.id)}
                    onPointerLeave={() =>
                      setHoverBlockId((id) => (id === block.id ? null : id))
                    }
                    onPointerDown={(e) => {
                      if (!e.isPrimary) return
                      if (e.pointerType === 'mouse' && e.button !== 0) return
                      e.stopPropagation()
                      /*
                       * Each idle button represents exactly one block. Use `block` directly —
                       * no coordinate resolution needed here. Coordinate re-routing is only
                       * required in the document capture handler (for the rare case where the
                       * editing contenteditable itself covers a neighbour's position).
                       * iPad / iOS WebKit often skips click on overlay buttons; always act on pointerdown.
                       */
                      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                        e.preventDefault()
                      }
                      switchEditorToBlockIfDifferent(block)
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      /*
                       * Do NOT call resolveBlockUnderClient here. By the time `click` fires, React
                       * has already re-rendered (pointerdown opened B's editor, A became idle). A
                       * fresh coordinate lookup at this point can land on the clip-band boundary and
                       * return the WRONG block (the one we just committed), causing it to re-open.
                       * The button's own `block` is always the correct target for a click event.
                       */
                      switchEditorToBlockIfDifferent(block)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        switchEditorToBlockIfDifferent(block)
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
              <button
                type="button"
                data-pdf-annot-resize="se"
                aria-label="Resize signature"
                title="Drag corner to resize"
                className="absolute bottom-0 right-0 z-20 h-3.5 w-3.5 cursor-nwse-resize rounded-br-md border border-blue-600 bg-white/95 shadow touch-none dark:bg-zinc-900/95"
                onPointerDown={onSigDraftResizePointerDown}
                onPointerMove={onSigDraftResizePointerMove}
                onPointerUp={onSigDraftResizePointerUp}
                onPointerCancel={onSigDraftResizePointerUp}
              />
            </div>
          )
        })()}
      {textDraft && cw > 0 && (() => {
        const draftFmt = textFormat ?? defaultTextFormat()
        const draftFsCss = Math.max(
          FONT_SIZE_MIN,
          Math.min(FONT_SIZE_MAX, Number(draftFmt.fontSizeCss) || 14)
        )
        const draftPx = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, draftFsCss * sx))
        const draftFont = cssAnnotPreviewFontStack(draftFmt.fontFamily)
        const boxWpx = textDraft.nw > 0 ? textDraft.nw * cw : undefined
        const boxMinHpx = textDraft.nh > 0 ? textDraft.nh * ch : undefined
        const lineHpx = draftPx * ANNOT_UI_LINE_HEIGHT + 6
        const draftTaMaxH =
          typeof boxMinHpx === 'number' && boxMinHpx > 0
            ? Math.max(lineHpx, boxMinHpx - 2)
            : undefined
        const cancelDraft = () => {
          if (textDraftSyncRafRef.current != null) {
            cancelAnimationFrame(textDraftSyncRafRef.current)
            textDraftSyncRafRef.current = null
          }
          textDraftDragRef.current = null
          textDraftImeComposingRef.current = false
          textDraftRef.current = null
          setTextDraft(null)
        }
        const onDraftChromePointerDown = (e) => {
          if (!e.isPrimary || e.button !== 0) return
          if (!(e.target instanceof Element)) return
          if (e.target.closest('[data-pdf-annot-draft-input]') || e.target.closest('textarea')) return
          if (e.target.closest('[data-pdf-annot-delete-skip-blur]')) return
          e.preventDefault()
          e.stopPropagation()
          onDraftDragPointerDown(e)
        }
        return (
          <div
            data-pdf-annot-draft
            title="Drag the edge to move. Ctrl+Enter to place."
            className={`absolute z-[50] box-border flex min-h-0 cursor-grab flex-col overflow-visible rounded-sm p-0.5 ring-1 ring-blue-600/90 active:cursor-grabbing dark:ring-blue-500/90 ${
              boxWpx ? '' : 'max-w-[min(22rem,calc(100vw-1.25rem))]'
            }`}
            style={{
              left: textDraft.nx * cw,
              top: textDraft.ny * ch,
              width: boxWpx,
              ...(typeof boxMinHpx === 'number' && boxMinHpx > 0
                ? { height: boxMinHpx, minHeight: boxMinHpx }
                : { minHeight: boxMinHpx }),
              backgroundColor: ANNOT_TEXT_DISPLAY_BG,
            }}
            onPointerDown={onDraftChromePointerDown}
            onPointerMove={onDraftDragPointerMove}
            onPointerUp={onDraftDragPointerUp}
            onPointerCancel={onDraftDragPointerUp}
          >
            <TextAnnotBoxDeleteBtn onDelete={cancelDraft} />
            <div className="relative flex h-full min-h-0 flex-col justify-center px-0 py-0">
              {textDraftBodyEmpty ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-0 z-0 select-none"
                  style={{
                    fontSize: `${draftPx}px`,
                    lineHeight: ANNOT_UI_LINE_HEIGHT,
                    fontFamily: draftFont,
                    fontWeight: draftFmt.bold ? 700 : 400,
                    fontStyle: draftFmt.italic ? 'italic' : 'normal',
                    textDecoration: draftFmt.underline ? 'underline' : 'none',
                    color: normalizeHexForColorInput(draftFmt.color || '#000000'),
                    opacity: 0.22,
                  }}
                >
                  Aa
                </span>
              ) : null}
              <textarea
                ref={draftInputRef}
                data-pdf-annot-draft-input
                dir="auto"
                rows={1}
                autoFocus
                title="Enter for a new line. Ctrl+Enter or Command+Enter to place."
                aria-label="Add text on the page. Press Enter for a new line. Control+Enter or Command+Enter to place text."
                maxLength={MAX_ANNOT_TEXT_LENGTH}
                className="pdf-annot-draft-input relative z-[1] box-border min-h-0 w-full min-w-0 resize-none cursor-text whitespace-pre break-normal rounded-none border-0 py-0 pl-0 pr-0.5 pb-0.5 text-zinc-900 outline-none"
                style={{
                  fontSize: `${draftPx}px`,
                  lineHeight: ANNOT_UI_LINE_HEIGHT,
                  maxHeight: draftTaMaxH != null ? `${draftTaMaxH}px` : undefined,
                  overflowX: 'hidden',
                  overflowY: 'auto',
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
                onInput={() => {
                  setTextDraftBodyEmpty(!(draftInputRef.current?.value ?? '').length)
                  scheduleTextDraftBoxSync()
                }}
                onCompositionStart={() => {
                  textDraftImeComposingRef.current = true
                }}
                onCompositionEnd={() => {
                  textDraftImeComposingRef.current = false
                  syncTextDraftBoxFromTextarea()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    cancelDraft()
                    return
                  }
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    commitText(draftInputRef.current?.value ?? '')
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

const PdfPageCanvasMemo = memo(PdfPageCanvas)
PdfPageCanvasMemo.displayName = 'PdfPageCanvas'
export default PdfPageCanvasMemo
