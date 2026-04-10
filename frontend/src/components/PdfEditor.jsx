import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { apiUrl } from '../lib/apiBase'
import ThemeToggle from '../shared/components/ThemeToggle.jsx'
import EditorOnboardingBanner from '../shared/components/EditorOnboardingBanner.jsx'
import EditPdfShortcutsModal from '../shared/components/EditPdfShortcutsModal.jsx'
import Toolbar from './Toolbar'
import ThumbnailSidebar from './ThumbnailSidebar'
import PdfPageCanvas from './PdfPageCanvas'
import TextFormatToolbar from './TextFormatToolbar'
import { defaultTextFormat, formatFromPlacedTextItem, formatFromTextBlock } from '../lib/textFormatDefaults'
import {
  trackErrorOccurred,
  trackFileDownloaded,
  trackProcessingTime,
  trackToolCompleted,
} from '../lib/analytics.js'
import { MSG } from '../shared/constants/branding.js'
import {
  LEGACY_PLACED_TEXT_WIDGET_TOP_OFFSET_CSS,
  PLACED_TEXT_BASELINE_FRAC,
} from '../lib/placedTextConstants.js'

const EDIT_TOOL = 'edit_pdf'

/** Stable ref for pages with no annotations — avoids `|| []` creating a new array every render (infinite layout loops in PlacedTextAnnotations). */
const EMPTY_PAGE_ITEMS = []

const ONBOARDING_STORAGE_KEY = 'pdfpilot_editor_onboarding_dismissed'

function readEditorOnboardingVisible() {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}

/** Client-only: PDF already contains this snapshot; next save must white it out before redraw. */
function snapshotPlacedTextLastBake(it) {
  if (!it || it.type !== 'text') return null
  return {
    x: it.x,
    y: it.y,
    pdfX: it.pdfX,
    pdfBaselineY: it.pdfBaselineY,
    text: it.text,
    fontSize: it.fontSize,
    fontSizeCss: it.fontSizeCss,
    fontFamily: it.fontFamily,
    bold: it.bold,
    italic: it.italic,
    underline: it.underline,
    rotationDeg: it.rotationDeg,
    placementV2: it.placementV2,
  }
}

function toServerTextGeometry(snap, pageCssH) {
  if (!snap || typeof snap !== 'object') return null
  const rest = { ...snap }
  if (
    rest.placementV2 !== true &&
    Number.isFinite(pageCssH) &&
    pageCssH > 1
  ) {
    const y = Number(rest.y)
    if (Number.isFinite(y)) {
      rest.y = Math.min(
        0.999,
        Math.max(0, y + LEGACY_PLACED_TEXT_WIDGET_TOP_OFFSET_CSS / pageCssH)
      )
      rest.placementV2 = true
    }
  }
  return rest
}

/**
 * Strip client-only fields before sending edits to the API / pdf-lib.
 * @param {number} [pageCssH] — page canvas CSS height for legacy `type: 'text'` Y correction
 */
function toServerItem(it, pageCssH) {
  const rest = { ...it }
  delete rest.id
  delete rest.fontSizeCss
  delete rest.lineWidthCss
  delete rest.textBakedInEditorPdf
  delete rest.placedTextLastBake
  delete rest.erasePlacedTextAt
  if (rest.type === 'text' && it.placedTextLastBake) {
    const g = toServerTextGeometry(it.placedTextLastBake, pageCssH)
    if (g) {
      rest.erasePlacedTextAt = {
        x: g.x,
        y: g.y,
        text: g.text,
        fontSize: g.fontSize,
        fontFamily: g.fontFamily,
        bold: g.bold,
        italic: g.italic,
        underline: g.underline,
        rotationDeg: g.rotationDeg,
        placementV2: g.placementV2,
      }
    }
  }
  if (
    rest.type === 'text' &&
    rest.pdfX == null &&
    rest.pdfBaselineY == null &&
    it.placementV2 !== true &&
    Number.isFinite(pageCssH) &&
    pageCssH > 1
  ) {
    const y = Number(rest.y)
    if (Number.isFinite(y)) {
      rest.y = Math.min(
        0.999,
        Math.max(0, y + LEGACY_PLACED_TEXT_WIDGET_TOP_OFFSET_CSS / pageCssH)
      )
      rest.placementV2 = true
    }
  }
  return rest
}

/** Any of these on a placed-text patch means the server PDF is stale until the next save. */
const PLACED_TEXT_PATCH_BAKE_KEYS = new Set([
  'x',
  'y',
  'pdfX',
  'pdfBaselineY',
  'text',
  'fontFamily',
  'fontSize',
  'fontSizeCss',
  'bold',
  'italic',
  'underline',
  'align',
  'color',
  'opacity',
  'rotationDeg',
])

function placedTextPatchInvalidatesBakedPdf(patch) {
  if (!patch || typeof patch !== 'object') return false
  for (const k of Object.keys(patch)) {
    if (PLACED_TEXT_PATCH_BAKE_KEYS.has(k)) return true
  }
  return false
}

function buildEditsPayload(pagesItems, pageHeights) {
  const ph = pageHeights && typeof pageHeights === 'object' ? pageHeights : {}
  const pages = Object.entries(pagesItems)
    .map(([key, list]) => ({
      pageIndex: Number(key),
      items: (list || []).map((it) => toServerItem(it, ph[Number(key)])),
    }))
    .filter((g) => Number.isFinite(g.pageIndex) && g.items.length > 0)
    .sort((a, b) => a.pageIndex - b.pageIndex)
  return { pages }
}

function cloneEditorSlice(pagesItems, nativeTextEdits, blockTextOverrides) {
  try {
    return {
      p: structuredClone(pagesItems ?? {}),
      n: structuredClone(nativeTextEdits ?? []),
      o: { ...(blockTextOverrides ?? {}) },
    }
  } catch {
    return {
      p: JSON.parse(JSON.stringify(pagesItems ?? {})),
      n: JSON.parse(JSON.stringify(nativeTextEdits ?? [])),
      o: { ...(blockTextOverrides ?? {}) },
    }
  }
}

/** Restore usePagesHistory.present from server `edits` payload (re-adds client-only ids). */
function editsPayloadToPresentMap(edits) {
  const out = {}
  for (const g of edits?.pages || []) {
    if (!Number.isFinite(g.pageIndex)) continue
    const items = (g.items || []).map((it) => {
      const base = {
        ...it,
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }
      if (it.type === 'text') {
        return {
          ...base,
          textBakedInEditorPdf: true,
          placedTextLastBake: snapshotPlacedTextLastBake(base),
        }
      }
      return base
    })
    out[String(g.pageIndex)] = items
  }
  return out
}

export default function PdfEditor({ sessionId, onBack }) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [loadError, setLoadError] = useState(null)
  /** Default to Edit text so Word-style editing works without an extra click. */
  const [activeTool, setActiveTool] = useState('editText')
  const [activePage, setActivePage] = useState(0)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [saveHint, setSaveHint] = useState(null)
  /** Bumped after a successful save so pdf.js refetches (edited.pdf) instead of a cached original. */
  const [pdfBust, setPdfBust] = useState(0)
  const pageRefs = useRef([])
  /** Latest `ch` per page from PdfPageCanvas — needed to correct legacy text `y` on export. */
  const pageCssHeightRef = useRef({})
  const scrollRef = useRef(null)
  const [pagesItems, setPagesItems] = useState({})
  const pagesItemsRef = useRef({})
  const nativeTextEditsRef = useRef([])
  const blockOverridesRef = useRef({})
  const [nativeTextEdits, setNativeTextEdits] = useState([])
  /** Unified undo: annotations (incl. Add Text) + native line edits + block overrides. */
  const editorUndoPastRef = useRef([])
  const editorRedoFutureRef = useRef([])
  const [editorHistTick, setEditorHistTick] = useState(0)
  const autosaveTimerRef = useRef(null)
  /** Single source of truth for on-canvas text: block id → latest string (survives re-parse / re-render). */
  const [blockTextOverrides, setBlockTextOverrides] = useState({})
  const [textFormat, setTextFormat] = useState(defaultTextFormat)
  const textFormatRef = useRef(textFormat)
  textFormatRef.current = textFormat
  const [editTextMode, setEditTextMode] = useState(true)
  const [inlineTextEditorOpen, setInlineTextEditorOpen] = useState(false)
  /** Add Text (`type: 'text'`) annotation selected for drag + format toolbar. */
  const [selectedPlacedTextId, setSelectedPlacedTextId] = useState(null)
  const placedTextMetaRef = useRef({ id: null, pageIndex: -1, fontRatio: 1 })
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(readEditorOnboardingVisible)
  const [toastMessage, setToastMessage] = useState(null)
  const toastTimerRef = useRef(null)

  useEffect(() => {
    if (!editTextMode) setInlineTextEditorOpen(false)
  }, [editTextMode])

  const handlePlacedTextSelectInfo = useCallback((info) => {
    if (!info) {
      placedTextMetaRef.current = { id: null, pageIndex: -1, fontRatio: 1 }
      setSelectedPlacedTextId(null)
      return
    }
    placedTextMetaRef.current = {
      id: info.id,
      pageIndex: info.pageIndex,
      fontRatio: info.fontRatio,
    }
    setSelectedPlacedTextId(info.id)
    setTextFormat(formatFromPlacedTextItem(info.item))
  }, [])

  useEffect(() => {
    if (inlineTextEditorOpen) {
      setSelectedPlacedTextId(null)
      placedTextMetaRef.current = { id: null, pageIndex: -1, fontRatio: 1 }
    }
  }, [inlineTextEditorOpen])

  useEffect(() => {
    if (!selectedPlacedTextId) return
    const onDoc = (e) => {
      const t = e.target
      if (t.closest?.('[data-pdf-placed-text-root]')) return
      if (t.closest?.('[data-text-format-panel]')) return
      if (t.closest?.('[data-pdf-inline-editor-root]')) return
      /* Save/Download: keep selection until click completes so contentEditable stays mounted; persist flushes then sync clears. */
      if (t.closest?.('[data-pdf-session-actions]')) return
      /* Other chrome (tools, theme): commit draft from DOM first — otherwise unmount drops edits (e.g. Kiran → Kiran Jadhav). */
      if (t.closest?.('[data-pdf-editor-chrome]')) {
        document.dispatchEvent(new CustomEvent('pdfpilot-flush-placed-text'))
        setSelectedPlacedTextId(null)
        placedTextMetaRef.current = { id: null, pageIndex: -1, fontRatio: 1 }
        return
      }
      document.dispatchEvent(new CustomEvent('pdfpilot-flush-placed-text'))
      setSelectedPlacedTextId(null)
      placedTextMetaRef.current = { id: null, pageIndex: -1, fontRatio: 1 }
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [selectedPlacedTextId])
  pagesItemsRef.current = pagesItems
  nativeTextEditsRef.current = nativeTextEdits
  blockOverridesRef.current = blockTextOverrides

  const pushEditorUndoSnapshot = useCallback(() => {
    editorUndoPastRef.current.push(
      cloneEditorSlice(pagesItemsRef.current, nativeTextEditsRef.current, blockOverridesRef.current)
    )
    if (editorUndoPastRef.current.length > 80) {
      editorUndoPastRef.current = editorUndoPastRef.current.slice(-80)
    }
    editorRedoFutureRef.current = []
    setEditorHistTick((t) => t + 1)
  }, [])

  void editorHistTick
  const canUndo = editorUndoPastRef.current.length > 0
  const canRedo = editorRedoFutureRef.current.length > 0

  const applyEditorSnapshot = useCallback((snap) => {
    setPagesItems(snap.p)
    setNativeTextEdits(snap.n)
    nativeTextEditsRef.current = snap.n
    setBlockTextOverrides(snap.o)
    blockOverridesRef.current = snap.o
  }, [])

  const undo = useCallback(() => {
    const past = editorUndoPastRef.current
    if (past.length === 0) return
    const snap = past.pop()
    const cur = cloneEditorSlice(pagesItemsRef.current, nativeTextEditsRef.current, blockOverridesRef.current)
    editorRedoFutureRef.current.unshift(cur)
    if (editorRedoFutureRef.current.length > 80) {
      editorRedoFutureRef.current = editorRedoFutureRef.current.slice(0, 80)
    }
    flushSync(() => {
      applyEditorSnapshot(snap)
    })
    setEditorHistTick((t) => t + 1)
  }, [applyEditorSnapshot])

  const redo = useCallback(() => {
    const fut = editorRedoFutureRef.current
    if (fut.length === 0) return
    const snap = fut.shift()
    const cur = cloneEditorSlice(pagesItemsRef.current, nativeTextEditsRef.current, blockOverridesRef.current)
    editorUndoPastRef.current.push(cur)
    flushSync(() => {
      applyEditorSnapshot(snap)
    })
    setEditorHistTick((t) => t + 1)
  }, [applyEditorSnapshot])

  const numPages = pdfDoc?.numPages ?? 0

  const showToast = useCallback((msg) => {
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    setToastMessage(msg)
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null)
      toastTimerRef.current = null
    }, 2200)
  }, [])

  useEffect(
    () => () => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current)
    },
    []
  )

  const dismissOnboarding = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowOnboarding(false)
  }, [])

  const handleUndo = useCallback(() => {
    if (!canUndo) return
    undo()
    showToast(MSG.undoToast)
  }, [canUndo, undo, showToast])

  const handleRedo = useCallback(() => {
    if (!canRedo) return
    redo()
    showToast(MSG.redoToast)
  }, [canRedo, redo, showToast])

  useEffect(() => {
    if (!pdfDoc) return
    const onKey = (e) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLElement) {
        const tag = t.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (t.isContentEditable || t.closest('[contenteditable="true"]')) return
      }
      e.preventDefault()
      setShortcutsOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pdfDoc])

  useEffect(() => {
    if (!shortcutsOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setShortcutsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcutsOpen])

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    const pdfUrl =
      pdfBust > 0
        ? apiUrl(`/pdf/${sessionId}?v=${pdfBust}`)
        : apiUrl(`/pdf/${sessionId}`)
    ;(async () => {
      try {
        const task = getDocument({ url: pdfUrl, withCredentials: false })
        const [doc, stRes] = await Promise.all([
          task.promise,
          fetch(apiUrl(`/editor-state/${encodeURIComponent(sessionId)}`))
            .then((r) => (r.ok ? r.json() : { nativeTextEdits: [], edits: { pages: [] } }))
            .catch(() => ({ nativeTextEdits: [], edits: { pages: [] } })),
        ])
        if (cancelled) return
        setPdfDoc(doc)

        const natives = stRes.nativeTextEdits || []
        nativeTextEditsRef.current = natives
        setNativeTextEdits(natives)
        const over = {}
        for (const e of natives) {
          if (e.blockId) over[e.blockId] = e.text ?? ''
        }
        setBlockTextOverrides(over)

        editorUndoPastRef.current = []
        editorRedoFutureRef.current = []
        setEditorHistTick((t) => t + 1)
        if (stRes.edits?.pages?.length) {
          setPagesItems(editsPayloadToPresentMap(stRes.edits))
        } else {
          setPagesItems({})
        }
      } catch (e) {
        if (!cancelled) setLoadError(e?.message || 'Failed to load PDF')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId, pdfBust])

  const loadErrorTracked = useRef(null)
  useEffect(() => {
    if (loadError && loadError !== loadErrorTracked.current) {
      loadErrorTracked.current = loadError
      trackErrorOccurred(EDIT_TOOL, loadError)
    }
    if (!loadError) loadErrorTracked.current = null
  }, [loadError])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !numPages) return
    const onScroll = () => {
      const boxes = pageRefs.current.map((n) => {
        if (!n) return Infinity
        const r = n.getBoundingClientRect()
        const top = r.top - el.getBoundingClientRect().top
        return Math.abs(top - 24)
      })
      let best = 0
      let bestD = boxes[0]
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i] < bestD) {
          bestD = boxes[i]
          best = i
        }
      }
      setActivePage(best)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [numPages])

  const updatePage = useCallback(
    (pageIndex) => (updater) => {
      pushEditorUndoSnapshot()
      setPagesItems((prev) => {
        const cur = prev[pageIndex] || []
        const next = typeof updater === 'function' ? updater(cur) : updater
        return { ...prev, [pageIndex]: next }
      })
    },
    [pushEditorUndoSnapshot]
  )

  const reportPageCssHeight = useCallback((pageIndex, cssH) => {
    if (Number.isFinite(pageIndex) && Number.isFinite(cssH) && cssH > 1) {
      pageCssHeightRef.current[pageIndex] = cssH
    }
  }, [])

  const patchPagePlacedText = useCallback(
    (pageIndex, id, patch, opts) => {
      const mergeOne = (it) => {
        if (it.id !== id || it.type !== 'text' || !patch) return it
        const hasPdfPos = patch.pdfX != null || patch.pdfBaselineY != null
        const hasNormPos = patch.x != null || patch.y != null
        const hasPos = hasPdfPos || hasNormPos
        let next
        if (!hasPos) {
          next = { ...it, ...patch }
        } else if (hasPdfPos) {
          next = { ...it, ...patch, placementV2: true }
        } else {
          const h = pageCssHeightRef.current[pageIndex] || 0
          const leg = LEGACY_PLACED_TEXT_WIDGET_TOP_OFFSET_CSS
          const withoutPdf = { ...it }
          delete withoutPdf.pdfX
          delete withoutPdf.pdfBaselineY
          if (it.placementV2 === true || h <= 1) {
            next = { ...withoutPdf, ...patch, placementV2: true }
          } else {
            next = {
              ...withoutPdf,
              ...patch,
              placementV2: true,
              x: patch.x != null ? Number(patch.x) : it.x,
              y:
                patch.y != null
                  ? Number(patch.y) + leg / h
                  : Number(it.y) + leg / h,
            }
          }
        }
        if (placedTextPatchInvalidatesBakedPdf(patch)) {
          next = { ...next, textBakedInEditorPdf: false }
        }
        return next
      }
      if (opts?.live) {
        setPagesItems((prev) => {
          const cur = prev[pageIndex] || []
          const next = cur.map(mergeOne)
          return { ...prev, [pageIndex]: next }
        })
        return
      }
      updatePage(pageIndex)((prev) => prev.map(mergeOne))
    },
    [updatePage]
  )

  const applyTextFormat = useCallback(
    (fmt) => {
      setTextFormat(fmt)
      const m = placedTextMetaRef.current
      if (!m.id || m.pageIndex < 0) return
      const fontSize = Math.max(8, Math.min(144, (fmt.fontSizeCss ?? 14) * m.fontRatio))
      updatePage(m.pageIndex)((prev) =>
        prev.map((it) => {
          if (it.id !== m.id || it.type !== 'text') return it
          const oldFs = Math.max(4, Math.min(144, Number(it.fontSize) || 12))
          let pdfBaselineY = it.pdfBaselineY
          if (
            Number.isFinite(it.pdfX) &&
            Number.isFinite(it.pdfBaselineY) &&
            fontSize !== oldFs
          ) {
            const topPdf = it.pdfBaselineY + oldFs * PLACED_TEXT_BASELINE_FRAC
            pdfBaselineY = topPdf - fontSize * PLACED_TEXT_BASELINE_FRAC
          }
          return {
            ...it,
            fontFamily: fmt.fontFamily,
            fontSizeCss: fmt.fontSizeCss,
            fontSize,
            pdfBaselineY,
            bold: fmt.bold,
            italic: fmt.italic,
            underline: fmt.underline,
            align: fmt.align,
            color: fmt.color,
            opacity: fmt.opacity,
            rotationDeg: fmt.rotationDeg,
            textBakedInEditorPdf: false,
          }
        })
      )
    },
    [updatePage]
  )

  const pageNodes = useMemo(() => {
    if (!pdfDoc) return null
    return Array.from({ length: numPages }, (_, i) => i)
  }, [pdfDoc, numPages])

  const cancelScheduledAutosave = useCallback(() => {
    if (autosaveTimerRef.current != null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
  }, [])

  const persistPdfToServer = useCallback(async () => {
    document.dispatchEvent(new CustomEvent('pdfpilot-flush-text-draft'))
    document.dispatchEvent(new CustomEvent('pdfpilot-flush-placed-text'))
    const edits = buildEditsPayload(pagesItemsRef.current, pageCssHeightRef.current)
    const nativePayload = nativeTextEditsRef.current
    if (import.meta.env.DEV) {
      console.debug('[save] POST /edit', {
        annotationPages: edits.pages?.length ?? 0,
        nativeTextEdits: nativePayload.length,
        sampleNative: nativePayload[0]
          ? { key: nativePayload[0].key, textLen: (nativePayload[0].text || '').length }
          : null,
      })
    }
    const res = await fetch(apiUrl('/edit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        edits,
        applyTextSwap: false,
        nativeTextEdits: nativePayload,
      }),
    })
    const raw = await res.text()
    let errMsg = ''
    try {
      const j = JSON.parse(raw)
      errMsg = [j.error, j.details].filter(Boolean).join('\n') || ''
    } catch {
      if (!res.ok) errMsg = raw.slice(0, 200) || res.statusText
    }
    if (!res.ok) {
      throw new Error(
        errMsg ||
          `Save failed (${res.status}). Is the API running on port 3001?`
      )
    }
    if (import.meta.env.DEV) {
      console.debug('[save] /edit ok', res.status)
    }
  }, [sessionId])

  /** Bump PDF URL only — do not null `pdfDoc` (that unmounts the whole editor and drops text-layer UX). */
  const reloadPdfFromServer = useCallback(() => {
    setPdfBust((v) => v + 1)
  }, [])

  /** After persist + PDF reload, the canvas shows drawn text — hide duplicate DOM until the user selects an item. */
  const syncPlacedTextWithBakedPdf = useCallback(() => {
    placedTextMetaRef.current = { id: null, pageIndex: -1, fontRatio: 1 }
    setSelectedPlacedTextId(null)
    setPagesItems((prev) => {
      const out = {}
      for (const [k, list] of Object.entries(prev)) {
        out[k] = list.map((it) =>
          it?.type === 'text'
            ? {
                ...it,
                textBakedInEditorPdf: true,
                placedTextLastBake: snapshotPlacedTextLastBake(it),
              }
            : it
        )
      }
      return out
    })
  }, [])

  const addNativeTextEdit = useCallback(
    (pageIndex, payload) => {
      const {
        blockId,
        pdf,
        norm,
        text,
        fontSize,
        fontFamily,
        bold,
        italic,
        underline,
        align,
        color,
        opacity,
        rotationDeg,
        maskColor,
      } = payload
      const spatialKey = `${pageIndex}:${pdf.x}:${pdf.y}:${pdf.baseline}`
      const stableKey = blockId ? `p${pageIndex}:bid:${blockId}` : spatialKey
      const prev = nativeTextEditsRef.current
      const rest = prev.filter((e) => {
        if (blockId && e.blockId === blockId) return false
        if (!blockId && e.key === spatialKey) return false
        return true
      })
      const next = [
        ...rest,
        {
          key: stableKey,
          blockId: blockId || undefined,
          pageIndex,
          x: pdf.x,
          y: pdf.y,
          w: pdf.w,
          h: pdf.h,
          baseline: pdf.baseline,
          fontSize: fontSize ?? pdf.fontSize,
          norm,
          text,
          fontFamily,
          bold,
          italic,
          underline,
          align,
          color,
          opacity,
          rotationDeg,
          maskColor,
        },
      ]
      if (blockId) {
        setBlockTextOverrides((prev) => (prev[blockId] === text ? prev : { ...prev, [blockId]: text }))
      }
      // Keep ref in sync immediately so “Download” in the same gesture as textarea blur still sends edits.
      nativeTextEditsRef.current = next
      setNativeTextEdits(next)
    },
    []
  )

  const handleSave = async () => {
    cancelScheduledAutosave()
    setSaving(true)
    setSaveHint(null)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      await persistPdfToServer()
      reloadPdfFromServer()
      syncPlacedTextWithBakedPdf()
      setSaveHint(MSG.savedSession)
      window.setTimeout(() => setSaveHint(null), 5000)
      trackToolCompleted(EDIT_TOOL, true)
      const elapsed =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
      trackProcessingTime(EDIT_TOOL, elapsed)
    } catch (e) {
      console.error(e)
      trackErrorOccurred(EDIT_TOOL, e?.message || 'save_failed')
      alert(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async () => {
    cancelScheduledAutosave()
    setDownloading(true)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      await persistPdfToServer()
      const dl = await fetch(
        apiUrl(`/download?sessionId=${encodeURIComponent(sessionId)}`)
      )
      if (!dl.ok) throw new Error('Download failed')
      const blob = await dl.blob()
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = 'edited.pdf'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(href)

      reloadPdfFromServer()
      syncPlacedTextWithBakedPdf()
      setSaveHint(MSG.fileReady)
      window.setTimeout(() => setSaveHint(null), 6000)
      trackToolCompleted(EDIT_TOOL, true)
      trackFileDownloaded({
        tool: EDIT_TOOL,
        file_size: blob.size / 1024,
        total_pages: numPages,
      })
      const elapsed =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
      trackProcessingTime(EDIT_TOOL, elapsed)
    } catch (e) {
      console.error(e)
      trackErrorOccurred(EDIT_TOOL, e?.message || 'download_failed')
      alert(e.message || 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  if (loadError) {
    return (
      <div className="relative flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <div className="fixed right-4 top-4 z-[200]">
          <ThemeToggle />
        </div>
        <p className="text-red-600 dark:text-red-400">{loadError}</p>
        <button
          type="button"
          className="rounded-lg bg-zinc-200 px-4 py-2 text-sm dark:bg-zinc-700"
          onClick={onBack}
        >
          Back
        </button>
      </div>
    )
  }

  if (!pdfDoc) {
    return (
      <div className="relative flex min-h-svh items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950">
        <div className="fixed right-4 top-4 z-[200]">
          <ThemeToggle />
        </div>
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{MSG.loadingPdf}</span>
      </div>
    )
  }

  return (
    <div className="flex h-svh flex-col bg-zinc-100/95 text-zinc-900 dark:bg-zinc-950/80 dark:text-zinc-100">
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        editTextMode={editTextMode}
        onEditTextModeChange={setEditTextMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onSave={handleSave}
        onDownload={handleDownload}
        saving={saving}
        downloading={downloading}
        onShortcutsClick={() => setShortcutsOpen(true)}
      />
      {saveHint && (
        <div
          role="status"
          className="border-b border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          {saveHint}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <ThumbnailSidebar
          pdfDoc={pdfDoc}
          numPages={numPages}
          activePage={activePage}
          onSelectPage={setActivePage}
          pageRefs={pageRefs}
        />
        <div
          ref={scrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-4"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            >
              ← New upload
            </button>
            <span className="text-sm text-zinc-500">
              Session <code className="text-xs">{sessionId.slice(0, 8)}…</code>
            </span>
          </div>
          {showOnboarding && <EditorOnboardingBanner onDismiss={dismissOnboarding} />}
          <p className="mb-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {MSG.editorSessionPrivacyLine}
          </p>
          {!activeTool && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100"
            >
              <p className="m-0 font-medium">Select a tool first</p>
              <p className="mt-1 mb-0 text-amber-900/90 dark:text-amber-100/90">
                Use <strong>Edit text</strong> to change existing PDF wording (matched size), or{' '}
                <strong>Add Text</strong> / <strong>Draw</strong> / <strong>Highlight</strong> /{' '}
                <strong>Rectangle</strong> for markup. When you finish a line (click outside or press{' '}
                <kbd className="rounded bg-amber-200/80 px-1 dark:bg-amber-900/50">Ctrl+Enter</kbd>
                ), your text is saved to this session automatically — no need to press{' '}
                <strong>Save PDF</strong> first. Use <strong>Save PDF</strong> or{' '}
                <strong>Download PDF</strong> anytime for a full sync or file download.
              </p>
            </div>
          )}
          <div className="flex flex-col items-center gap-8 pb-24">
            {pageNodes?.map((i) => (
              <div
                key={i}
                ref={(el) => {
                  pageRefs.current[i] = el
                }}
                className="w-full max-w-4xl"
              >
                <div className="mb-2 text-sm font-medium text-zinc-500">Page {i + 1}</div>
                <LazyPageLoader pdfDoc={pdfDoc} pageIndex={i} scrollRef={scrollRef}>
                  {(page) => (
                    <PdfPageCanvas
                      pdfPage={page}
                      pageIndex={i}
                      tool={activeTool}
                      items={pagesItems[i] ?? EMPTY_PAGE_ITEMS}
                      onUpdateItems={updatePage(i)}
                      blockTextOverrides={blockTextOverrides}
                      sessionNativeTextEdits={nativeTextEdits}
                      onNativeTextEdit={(payload) => addNativeTextEdit(i, payload)}
                      textFormat={textFormat}
                      textFormatRef={textFormatRef}
                      editTextMode={editTextMode}
                      onInlineEditorActiveChange={setInlineTextEditorOpen}
                      onPushUndoSnapshot={pushEditorUndoSnapshot}
                      selectedPlacedTextId={selectedPlacedTextId}
                      onSelectPlacedTextInfo={handlePlacedTextSelectInfo}
                      onPatchPlacedText={(id, patch, opts) =>
                        patchPagePlacedText(i, id, patch, opts)
                      }
                      onPlacedTextDragStart={pushEditorUndoSnapshot}
                      onReportPageCssHeight={reportPageCssHeight}
                      onBeginNativeTextEdit={(block, extras) => {
                        if (extras?.presetFormat) {
                          setTextFormat(extras.presetFormat)
                          return
                        }
                        setTextFormat((prev) =>
                          formatFromTextBlock(
                            block,
                            prev,
                            extras?.sampleColorHex,
                            extras?.layoutHint
                          )
                        )
                      }}
                    />
                  )}
                </LazyPageLoader>
              </div>
            ))}
          </div>
        </div>
        {((editTextMode && inlineTextEditorOpen) || selectedPlacedTextId != null) && (
          <TextFormatToolbar
            format={textFormat}
            onChange={applyTextFormat}
            disabled={false}
          />
        )}
      </div>
      <EditPdfShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {toastMessage && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[290] max-w-[min(90vw,20rem)] -translate-x-1/2 rounded-lg border border-zinc-200 bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white shadow-lg dark:border-zinc-600 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {toastMessage}
        </div>
      )}
    </div>
  )
}

/** Loads page PDF.js proxy only after the page wrapper is near the viewport (scroll root). */
function LazyPageLoader({ pdfDoc, pageIndex, scrollRef, children }) {
  const [shouldLoad, setShouldLoad] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const root = scrollRef?.current ?? null
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setShouldLoad(true)
      },
      { root, rootMargin: '400px 0px', threshold: 0 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [scrollRef])

  return (
    <div ref={wrapRef} className="w-full">
      {shouldLoad ? (
        <PageLoader pdfDoc={pdfDoc} pageIndex={pageIndex}>
          {children}
        </PageLoader>
      ) : (
        <div className="flex min-h-[45vh] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white/60 text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
          Scroll to load this page…
        </div>
      )}
    </div>
  )
}

/** Loads a single PDFPageProxy so PdfPageCanvas stays focused on rendering. */
function PageLoader({ pdfDoc, pageIndex, children }) {
  const [page, setPage] = useState(null)
  useEffect(() => {
    let cancelled = false
    pdfDoc.getPage(pageIndex + 1).then((p) => {
      if (!cancelled) setPage(p)
    })
    return () => {
      cancelled = true
    }
  }, [pdfDoc, pageIndex])
  if (!page) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-white shadow dark:bg-zinc-900">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }
  return children(page)
}
