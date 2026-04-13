import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { apiUrl } from '../lib/apiBase'
import { usePagesHistory } from '../hooks/usePagesHistory'
import ThemeToggle from '../shared/components/ThemeToggle.jsx'
import EditorOnboardingBanner from '../shared/components/EditorOnboardingBanner.jsx'
import EditPdfShortcutsModal from '../shared/components/EditPdfShortcutsModal.jsx'
import Toolbar from './Toolbar'
import ThumbnailSidebar from './ThumbnailSidebar'
import EditsSidebar from './EditsSidebar'
import PdfPageCanvas from './PdfPageCanvas'
import TextFormatToolbar from './TextFormatToolbar'
import { defaultTextFormat, formatFromTextBlock } from '../lib/textFormatDefaults'
import {
  nativeTextRecordsAreSameSlot,
  dedupeAnnotTextItemsBySlot,
  dedupeNativeTextEditRecords,
} from '../lib/nativeTextOverlap.js'
import {
  trackErrorOccurred,
  trackFileDownloaded,
  trackProcessingTime,
  trackToolCompleted,
} from '../lib/analytics.js'
import { MSG } from '../shared/constants/branding.js'

const EDIT_TOOL = 'edit_pdf'

/** Stable when `pagesItems[i]` is missing — inline `[]` would be a new reference every render and break `commitText` / overlay effects in PdfPageCanvas. */
const EMPTY_PAGE_ANNOT_ITEMS = []

const ONBOARDING_STORAGE_KEY = 'pdfpilot_editor_onboarding_dismissed'

function readEditorOnboardingVisible() {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}

/** Strip client-only fields before sending edits to the API / pdf-lib. Keep `id` for server merge. */
function toServerItem(it) {
  const rest = { ...it }
  delete rest.fontSizeCss
  delete rest.lineWidthCss
  return rest
}

function buildEditsPayload(pagesItems) {
  const pages = Object.entries(pagesItems)
    .map(([key, list]) => ({
      pageIndex: Number(key),
      items: dedupeAnnotTextItemsBySlot(list || []).map(toServerItem),
    }))
    .filter((g) => Number.isFinite(g.pageIndex) && g.items.length > 0)
    .sort((a, b) => a.pageIndex - b.pageIndex)
  return { pages }
}

/** Restore usePagesHistory.present from server `edits` payload (re-adds client-only ids). */
function editsPayloadToPresentMap(edits) {
  const out = {}
  for (const g of edits?.pages || []) {
    if (!Number.isFinite(g.pageIndex)) continue
    const items = dedupeAnnotTextItemsBySlot(g.items || []).map((it) => ({
      ...it,
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }))
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
  /** True while POST /edit + PDF reload after edits-list remove / clear (keeps UI in sync with file). */
  const [editingListSync, setEditingListSync] = useState(false)
  const [saveHint, setSaveHint] = useState(null)
  const [errorHint, setErrorHint] = useState(null)
  const errorHintTimerRef = useRef(null)
  /** Bumped after a successful save so pdf.js refetches (edited.pdf) instead of a cached original. */
  const [pdfBust, setPdfBust] = useState(0)
  const pageRefs = useRef([])
  const scrollRef = useRef(null)
  const pagesItemsRef = useRef({})
  const nativeTextEditsRef = useRef([])
  const [nativeTextEdits, setNativeTextEdits] = useState([])
  const autosaveTimerRef = useRef(null)
  /** Single source of truth for on-canvas text: block id → latest string (survives re-parse / re-render). */
  const [blockTextOverrides, setBlockTextOverrides] = useState({})
  const [textFormat, setTextFormat] = useState(defaultTextFormat)
  const textFormatRef = useRef(textFormat)
  textFormatRef.current = textFormat
  const [editTextMode, setEditTextMode] = useState(true)
  const [inlineTextEditorOpen, setInlineTextEditorOpen] = useState(false)
  /** After placing “Add Text”, keep Text format sidebar open for styling (in addition to native line edit). */
  const [addedTextFormatOpen, setAddedTextFormatOpen] = useState(false)
  const [annotFormatTarget, setAnnotFormatTarget] = useState(null)
  /** Done / Reset for add-text draft or placed-text edit (driven by PdfPageCanvas). */
  const [textBoxOverlayActions, setTextBoxOverlayActions] = useState(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(readEditorOnboardingVisible)
  const [toastMessage, setToastMessage] = useState(null)
  const toastTimerRef = useRef(null)
  const [zoom, setZoom] = useState(1.0)
  const zoomIn  = useCallback(() => setZoom((z) => Math.min(2.0, Math.round((z + 0.25) * 100) / 100)), [])
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100)), [])

  const showErrorHint = useCallback((msg) => {
    if (errorHintTimerRef.current != null) {
      window.clearTimeout(errorHintTimerRef.current)
      errorHintTimerRef.current = null
    }
    setErrorHint(msg)
    errorHintTimerRef.current = window.setTimeout(() => {
      setErrorHint(null)
      errorHintTimerRef.current = null
    }, 8000)
  }, [])

  useEffect(
    () => () => {
      if (errorHintTimerRef.current != null) window.clearTimeout(errorHintTimerRef.current)
    },
    []
  )

  useEffect(() => {
    if (!editTextMode) setInlineTextEditorOpen(false)
  }, [editTextMode])

  useEffect(() => {
    if (!editTextMode) {
      setAddedTextFormatOpen(false)
      setAnnotFormatTarget(null)
    }
  }, [editTextMode])

  const clearAnnotFormatUi = useCallback(() => {
    setAnnotFormatTarget(null)
    setAddedTextFormatOpen(false)
  }, [])

  useEffect(() => {
    if (activeTool !== 'text') return
    setInlineTextEditorOpen(false)
    clearAnnotFormatUi()
  }, [activeTool, clearAnnotFormatUi])

  const handleTextBoxOverlayActions = useCallback((pageIndex, payload) => {
    setTextBoxOverlayActions((prev) => {
      if (payload == null) {
        return prev?.pageIndex === pageIndex ? null : prev
      }
      return { pageIndex, done: payload.done, reset: payload.reset }
    })
  }, [])

  const handleAddedTextCommitted = useCallback(({ pageIndex, itemId, seedFormat }) => {
    setAnnotFormatTarget({ pageIndex, itemId })
    setTextFormat((prev) => ({ ...prev, ...seedFormat }))
    setAddedTextFormatOpen(true)
    setActiveTool('editText')
    setEditTextMode(true)
  }, [])
  const { pagesItems, commit, undo, redo, canUndo, canRedo, reset } = usePagesHistory({})
  pagesItemsRef.current = pagesItems
  nativeTextEditsRef.current = nativeTextEdits

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
            .then((r) => (r.ok ? r.json() : { nativeTextEdits: [], edits: { pages: [] }, _hydrationFailed: true }))
            .catch(() => ({ nativeTextEdits: [], edits: { pages: [] }, _hydrationFailed: true })),
        ])
        if (cancelled) return
        setPdfDoc(doc)

        if (stRes._hydrationFailed) {
          showErrorHint('Could not reload saved edits — your previous inline text changes may not be visible.')
        }
        const natives = dedupeNativeTextEditRecords(stRes.nativeTextEdits || [])
        nativeTextEditsRef.current = natives
        setNativeTextEdits(natives)
        const over = {}
        for (const e of natives) {
          if (e.blockId) over[e.blockId] = e.text ?? ''
        }
        setBlockTextOverrides(over)

        if (stRes.edits?.pages?.length) {
          reset(editsPayloadToPresentMap(stRes.edits))
        } else {
          reset({})
        }
      } catch (e) {
        if (!cancelled) setLoadError(e?.message || 'Failed to load PDF')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId, reset, pdfBust])

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

  /** Stable per-page updaters — `updatePage(i)` returned a new fn each render and broke PdfPageCanvas `commitText` deps → overlay effect loop. */
  const pageItemUpdaters = useMemo(() => {
    if (!pdfDoc || numPages < 1) return null
    return Array.from({ length: numPages }, (_, pageIndex) => (updater) => {
      commit((prev) => {
        const cur = prev[pageIndex] ?? []
        const next = typeof updater === 'function' ? updater(cur) : updater
        return { ...prev, [pageIndex]: next }
      })
    })
  }, [commit, pdfDoc, numPages])

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

  /**
   * Debounced autosave: fires 45 s after the last edit change.
   * Only triggers when there is at least one edit (native or annotation).
   * Errors are swallowed silently — autosave is best-effort.
   */
  useEffect(() => {
    const hasNative = nativeTextEdits.length > 0
    const hasAnnot = Object.values(pagesItems).some((arr) => arr && arr.length > 0)
    if (!hasNative && !hasAnnot) return
    if (autosaveTimerRef.current != null) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(async () => {
      autosaveTimerRef.current = null
      try {
        await persistPdfToServer()
        setSaveHint('Auto-saved')
        window.setTimeout(() => setSaveHint(null), 4000)
      } catch {
        /* best-effort — do not surface autosave errors to the user */
      }
    }, 45_000)
    return () => {
      if (autosaveTimerRef.current != null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [nativeTextEdits, pagesItems]) // eslint-disable-line react-hooks/exhaustive-deps

  const persistPdfToServer = useCallback(async (opts = {}) => {
    const pagesMap = opts.pagesItemsOverride ?? pagesItemsRef.current
    const nativePayload =
      opts.nativeTextEditsOverride !== undefined
        ? opts.nativeTextEditsOverride
        : nativeTextEditsRef.current
    const edits = buildEditsPayload(pagesMap)
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
        ...(opts.replaceSessionAnnotations ? { replaceSessionAnnotations: true } : {}),
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

  const reloadPdfFromServer = useCallback(() => {
    setPdfDoc(null)
    setPdfBust((v) => v + 1)
  }, [])

  /**
   * Blur any open inline native editor so PdfPageCanvas commits, then wait for timers / React
   * before persist reads nativeTextEditsRef.
   */
  const commitActiveInlineEditor = useCallback(async () => {
    const editorEl = document.querySelector(
      '[data-pdf-inline-editor-root][contenteditable="true"]'
    )
    if (editorEl instanceof HTMLElement) {
      editorEl.blur()
    }
    await new Promise((r) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.setTimeout(r, 64)
        })
      })
    })
  }, [])

  const addNativeTextEdit = useCallback(
    (pageIndex, payload) => {
      const {
        blockId,
        slotId: payloadSlotId,
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
      const key = `${pageIndex}:${pdf.x}:${pdf.y}:${pdf.baseline}`
      const effectiveSlotId =
        typeof payloadSlotId === 'string' && payloadSlotId.length >= 8
          ? payloadSlotId
          : typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `slot-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const prev = nativeTextEditsRef.current
      const incoming = {
        norm,
        x: pdf.x,
        y: pdf.y,
        baseline: pdf.baseline,
        w: pdf.w,
        h: pdf.h,
      }
      const rest = prev.filter((e) => {
        if (Number(e.pageIndex) !== Number(pageIndex)) return true
        if (typeof e.slotId === 'string' && e.slotId.length >= 8 && e.slotId === effectiveSlotId) {
          return false
        }
        if (e.key === key) return false
        if (nativeTextRecordsAreSameSlot(e, incoming)) return false
        return true
      })
      const next = [
        ...rest,
        {
          blockId: typeof blockId === 'string' && blockId.length ? blockId : undefined,
          key,
          slotId: effectiveSlotId,
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

  /** Remove a native text edit by slotId, restoring the block to its original PDF text. */
  const revertNativeTextEdit = useCallback((blockId, slotId) => {
    const prev = nativeTextEditsRef.current
    const next = prev.filter(
      (e) => !(typeof slotId === 'string' && slotId.length >= 8 && e.slotId === slotId)
    )
    nativeTextEditsRef.current = next
    setNativeTextEdits(next)
    const bid =
      typeof blockId === 'string' && blockId.length
        ? blockId
        : prev.find((e) => e.slotId === slotId)?.blockId
    if (bid) {
      setBlockTextOverrides((prevOvr) => {
        if (!(bid in prevOvr)) return prevOvr
        const n = { ...prevOvr }
        delete n[bid]
        return n
      })
    }
  }, [])

  /** Remove a native line edit from the session list (e.g. Edits sidebar ✕). */
  const removeNativeTextEditBySlot = useCallback(
    async (slotId) => {
      if (typeof slotId !== 'string' || slotId.length < 8) return
      cancelScheduledAutosave()
      setEditingListSync(true)
      try {
        /* Flush any open inline editor first, or its blur commit would fight this removal. */
        await commitActiveInlineEditor()
        const prev = nativeTextEditsRef.current
        const victim = prev.find((e) => e.slotId === slotId)
        if (!victim) return
        const next = prev.filter((e) => e.slotId !== slotId)
        nativeTextEditsRef.current = next
        setNativeTextEdits(next)
        const bid = victim.blockId
        if (bid) {
          setBlockTextOverrides((prevOvr) => {
            if (!(bid in prevOvr)) return prevOvr
            const n = { ...prevOvr }
            delete n[bid]
            return n
          })
        }
        document.dispatchEvent(
          new CustomEvent('pdfpilot-remove-native-slot', { detail: { slotId } })
        )
        await persistPdfToServer({ nativeTextEditsOverride: next })
        reloadPdfFromServer()
      } catch (e) {
        console.error(e)
        showErrorHint(
          e?.message || 'Could not update the PDF after removing that edit. Try Save PDF.'
        )
      } finally {
        setEditingListSync(false)
      }
    },
    [
      cancelScheduledAutosave,
      commitActiveInlineEditor,
      persistPdfToServer,
      reloadPdfFromServer,
      showErrorHint,
    ]
  )

  const removeAnnotationItem = useCallback(
    async (pageIndex, itemId) => {
      if (typeof itemId !== 'string' || !itemId.length) return
      cancelScheduledAutosave()
      setEditingListSync(true)
      try {
        await commitActiveInlineEditor()
        const prev = pagesItemsRef.current
        const list = prev[pageIndex] ?? []
        const filtered = list.filter((it) => it.id !== itemId)
        if (filtered.length === list.length) return
        const nextPages = { ...prev, [pageIndex]: filtered }
        commit((p) => {
          const l = p[pageIndex] ?? []
          const f = l.filter((it) => it.id !== itemId)
          if (f.length === l.length) return p
          return { ...p, [pageIndex]: f }
        })
        await persistPdfToServer({ pagesItemsOverride: nextPages })
        reloadPdfFromServer()
      } catch (e) {
        console.error(e)
        showErrorHint(
          e?.message || 'Could not update the PDF after removing that markup. Try Save PDF.'
        )
      } finally {
        setEditingListSync(false)
      }
    },
    [
      commit,
      cancelScheduledAutosave,
      commitActiveInlineEditor,
      persistPdfToServer,
      reloadPdfFromServer,
      showErrorHint,
    ]
  )

  const handleClearAllEdits = useCallback(() => {
    if (
      nativeTextEdits.length === 0 &&
      !Object.values(pagesItems).some((arr) => arr && arr.length > 0)
    ) {
      return
    }
    if (
      !window.confirm(
        'Remove all edits in this session? This cannot be undone (use Undo before clearing if you change your mind).'
      )
    ) {
      return
    }
    cancelScheduledAutosave()
    void (async () => {
      setEditingListSync(true)
      try {
        await commitActiveInlineEditor()
        nativeTextEditsRef.current = []
        setNativeTextEdits([])
        setBlockTextOverrides({})
        reset({})
        clearAnnotFormatUi()
        setTextBoxOverlayActions(null)
        document.dispatchEvent(new CustomEvent('pdfpilot-native-session-cleared'))
        await persistPdfToServer({
          pagesItemsOverride: {},
          nativeTextEditsOverride: [],
          replaceSessionAnnotations: true,
        })
        reloadPdfFromServer()
        showToast('All edits cleared')
      } catch (e) {
        console.error(e)
        showErrorHint(
          e?.message || 'Could not clear the PDF on the server. Try Save PDF or reload the page.'
        )
      } finally {
        setEditingListSync(false)
      }
    })()
  }, [
    nativeTextEdits.length,
    pagesItems,
    cancelScheduledAutosave,
    reset,
    clearAnnotFormatUi,
    showToast,
    commitActiveInlineEditor,
    persistPdfToServer,
    reloadPdfFromServer,
    showErrorHint,
  ])

  const handleSave = async () => {
    cancelScheduledAutosave()
    await commitActiveInlineEditor()
    setSaving(true)
    setSaveHint(null)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      await persistPdfToServer()
      clearAnnotFormatUi()
      setTextBoxOverlayActions(null)
      reset({})
      reloadPdfFromServer()
      setSaveHint(MSG.savedSession)
      window.setTimeout(() => setSaveHint(null), 5000)
      trackToolCompleted(EDIT_TOOL, true)
      const elapsed =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
      trackProcessingTime(EDIT_TOOL, elapsed)
    } catch (e) {
      console.error(e)
      trackErrorOccurred(EDIT_TOOL, e?.message || 'save_failed')
      showErrorHint(e.message || 'Save failed — check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async () => {
    cancelScheduledAutosave()
    await commitActiveInlineEditor()
    setDownloading(true)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      await persistPdfToServer()
      clearAnnotFormatUi()
      setTextBoxOverlayActions(null)
      reset({})
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
      showErrorHint(e.message || 'Download failed — check your connection and try again.')
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
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
      />
      {saveHint && (
        <div
          role="status"
          className="border-b border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          {saveHint}
        </div>
      )}
      {errorHint && (
        <div
          role="alert"
          className="flex items-center justify-between border-b border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-900 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200"
        >
          <span>{errorHint}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="ml-3 shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
            onClick={() => setErrorHint(null)}
          >
            ✕
          </button>
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
                className="w-full"
                style={{ maxWidth: `${Math.round(896 * zoom)}px` }}
              >
                <div className="mb-2 text-sm font-medium text-zinc-500">Page {i + 1}</div>
                <LazyPageLoader pdfDoc={pdfDoc} pageIndex={i} scrollRef={scrollRef}>
                  {(page) => (
                    <PdfPageCanvas
                      pdfPage={page}
                      pageIndex={i}
                      tool={activeTool}
                      items={pagesItems[i] ?? EMPTY_PAGE_ANNOT_ITEMS}
                      onUpdateItems={pageItemUpdaters[i]}
                      blockTextOverrides={blockTextOverrides}
                      sessionNativeTextEdits={nativeTextEdits}
                      onNativeTextEdit={(payload) => addNativeTextEdit(i, payload)}
                      onRevertNativeTextEdit={revertNativeTextEdit}
                      textFormat={textFormat}
                      textFormatRef={textFormatRef}
                      editTextMode={editTextMode}
                      onInlineEditorActiveChange={setInlineTextEditorOpen}
                      formatSyncTarget={annotFormatTarget}
                      onClearAnnotFormatTarget={clearAnnotFormatUi}
                      onAddedTextCommitted={handleAddedTextCommitted}
                      onTextBoxOverlayActionsChange={handleTextBoxOverlayActions}
                      onBeginNativeTextEdit={(block, extras) => {
                        if (extras?.presetFormat && !extras?._maskColorHexSeed) {
                          setTextFormat(extras.presetFormat)
                          return
                        }
                        setTextFormat((prev) => {
                          const next = formatFromTextBlock(
                            block,
                            prev,
                            extras?.sampleColorHex,
                            extras?.layoutHint
                          )
                          /* Seed manual colour picker with auto-sampled bg — user can override immediately. */
                          if (extras?._maskColorHexSeed && (prev.maskColorMode ?? 'auto') === 'auto') {
                            next.maskColorHex = extras._maskColorHexSeed
                          }
                          return next
                        })
                      }}
                    />
                  )}
                </LazyPageLoader>
              </div>
            ))}
          </div>
        </div>
        <EditsSidebar
          nativeTextEdits={nativeTextEdits}
          pagesItems={pagesItems}
          numPages={numPages}
          onRemoveNative={removeNativeTextEditBySlot}
          onRemoveAnnot={removeAnnotationItem}
          onClearAll={handleClearAllEdits}
          onSave={handleSave}
          onDownload={handleDownload}
          saving={saving}
          downloading={downloading}
          listSyncing={editingListSync}
        />
        {((activeTool === 'editText' &&
          editTextMode &&
          (inlineTextEditorOpen || addedTextFormatOpen || annotFormatTarget != null)) ||
          activeTool === 'text' ||
          textBoxOverlayActions != null) && (
          <TextFormatToolbar
            format={textFormat}
            onChange={setTextFormat}
            disabled={false}
            overlayActions={
              textBoxOverlayActions
                ? { done: textBoxOverlayActions.done, reset: textBoxOverlayActions.reset }
                : null
            }
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
