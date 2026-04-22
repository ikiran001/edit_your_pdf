import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { apiUrl } from '../lib/apiBase'
import { usePagesHistory } from '../hooks/usePagesHistory'
import ThemeToggle from '../shared/components/ThemeToggle.jsx'
import AccountMenu from '../shared/components/AccountMenu.jsx'
import EditorOnboardingBanner from '../shared/components/EditorOnboardingBanner.jsx'
import EditPdfShortcutsModal from '../shared/components/EditPdfShortcutsModal.jsx'
import DownloadCompleteModal from '../shared/components/DownloadCompleteModal.jsx'
import Toolbar from './Toolbar'
import SignatureCreationModal from '../features/sign-pdf/SignatureCreationModal.jsx'
import { uint8ToBase64 } from '../features/sign-pdf/signPdfGeometry.js'
import ThumbnailSidebar from './ThumbnailSidebar'
import EditsSidebar from './EditsSidebar'
import PdfPageCanvas from './PdfPageCanvas'
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
import { useAuth } from '../auth/AuthContext.jsx'
import { useSubscription } from '../subscription/SubscriptionContext.jsx'
import UpgradePlanModal from '../subscription/UpgradePlanModal.jsx'
import ContinueDownloadModal from '../auth/ContinueDownloadModal.jsx'
import {
  clearPendingDownload,
  readPendingDownload,
  writePendingDownload,
} from '../auth/pendingDownloadStorage.js'
import { isFirebaseClientConfigured } from '../auth/firebaseClient.js'
import { getFirebaseAuthErrorHint } from '../lib/firebase.js'
import { persistEditSession } from '../features/edit-pdf/editSessionStorage.js'
import { fetchEditPdfDownload } from '../features/edit-pdf/editPdfDownload.js'
import {
  duplicateUserSessionOnServer,
  suggestLibraryDuplicateFileName,
  syncUserLibraryEntry,
} from '../features/my-documents/userLibrary.js'
import { setFeedbackPromptAfterDownload } from '../lib/reviewPromptStorage.js'

const EDIT_TOOL = 'edit_pdf'

/** Page column width at zoom 1.0; higher zoom uses explicit width so the page can grow past the viewport (horizontal scroll). */
const EDITOR_PAGE_BASE_CSS_PX = 896
const EDITOR_ZOOM_MIN = 0.5
const EDITOR_ZOOM_MAX = 4

/** Stable when `pagesItems[i]` is missing — inline `[]` would be a new reference every render and break `commitText` / overlay effects in PdfPageCanvas. */
const EMPTY_PAGE_ANNOT_ITEMS = []

const ONBOARDING_STORAGE_KEY = 'pdfpilot_editor_onboarding_dismissed'

const NAMED_COPY_SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function hintForSaveError(message) {
  const m = String(message || '').toLowerCase()
  if (
    m.includes('ocr') ||
    m.includes('scanned') ||
    m.includes('image-only') ||
    m.includes('image only') ||
    m.includes('no text') ||
    m.includes('extractable text') ||
    m.includes('raster') ||
    m.includes('bitmap')
  ) {
    return 'This PDF may be mostly images or scans. Editing works best when text is selectable in another PDF viewer. Run OCR elsewhere, then upload again.'
  }
  if (m.includes('timeout') || m.includes('network') || m.includes('failed to fetch')) {
    return 'We could not reach the server. Check your connection and try Save PDF again.'
  }
  return String(message || 'Save failed — check your connection and try again.')
}

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
  delete rest.rasterizedInPdf
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

/** Restore usePagesHistory.present from server `edits` payload (stable ids; hide overlays already in PDF). */
function editsPayloadToPresentMap(edits) {
  const out = {}
  for (const g of edits?.pages || []) {
    if (!Number.isFinite(g.pageIndex)) continue
    const items = dedupeAnnotTextItemsBySlot(g.items || []).map((it) => ({
      ...it,
      id:
        typeof it.id === 'string' && it.id.length > 0
          ? it.id
          : typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      /* Baked into edited.pdf — skip HTML/canvas overlay so text is not drawn twice. */
      rasterizedInPdf: true,
    }))
    out[String(g.pageIndex)] = items
  }
  return out
}

export default function PdfEditor({
  sessionId,
  onBack,
  /** Original upload filename for Saved PDFs (library). */
  originalFileName = 'document.pdf',
  downloadToken = null,
  onDownloadTokenConsumed,
  /** After a successful “named copy”, parent switches to the new `sessionId` (see POST /user-sessions/duplicate). */
  onSessionFork = null,
}) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [loadError, setLoadError] = useState(null)
  /** Default to Edit text so Word-style editing works without an extra click. */
  const [activeTool, setActiveTool] = useState('editText')
  const [activePage, setActivePage] = useState(0)
  const [saving, setSaving] = useState(false)
  const [namedCopyBusy, setNamedCopyBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
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
  const lastServerSaveAtRef = useRef(0)
  const lastEditAtRef = useRef(0)
  const [nativeTextEdits, setNativeTextEdits] = useState([])
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const autosaveTimerRef = useRef(null)
  /** Single source of truth for on-canvas text: block id → latest string (survives re-parse / re-render). */
  const [blockTextOverrides, setBlockTextOverrides] = useState({})
  const [textFormat, setTextFormat] = useState(defaultTextFormat)
  const textFormatRef = useRef(textFormat)
  textFormatRef.current = textFormat
  const [editTextMode, setEditTextMode] = useState(true)
  const [inlineTextEditorOpen, setInlineTextEditorOpen] = useState(false)
  /** After placing “Add Text”, keep Text format bar open for styling (in addition to native line edit). */
  const [addedTextFormatOpen, setAddedTextFormatOpen] = useState(false)
  const [annotFormatTarget, setAnnotFormatTarget] = useState(null)
  /** Done / Reset for add-text draft or placed-text edit (driven by PdfPageCanvas). */
  const [textBoxOverlayActions, setTextBoxOverlayActions] = useState(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [downloadCompleteModal, setDownloadCompleteModal] = useState(null)
  const [downloadAuthModalOpen, setDownloadAuthModalOpen] = useState(false)
  const [downloadAuthBusy, setDownloadAuthBusy] = useState(false)
  const [downloadAuthError, setDownloadAuthError] = useState(null)
  const [downloadAuthSuccess, setDownloadAuthSuccess] = useState(null)
  const pendingResumeAfterAuthRef = useRef(false)
  const postAuthResumeLockRef = useRef(false)
  /** Prevents duplicate POST /download when both the modal OAuth handler and the resume effect run. */
  const executePostAuthDownloadInFlightRef = useRef(false)
  const [showOnboarding, setShowOnboarding] = useState(readEditorOnboardingVisible)
  const [toastMessage, setToastMessage] = useState(null)
  const toastTimerRef = useRef(null)
  const [zoom, setZoom] = useState(1.0)
  const zoomIn = useCallback(
    () => setZoom((z) => Math.min(EDITOR_ZOOM_MAX, Math.round((z + 0.25) * 100) / 100)),
    []
  )
  const zoomOut = useCallback(
    () => setZoom((z) => Math.max(EDITOR_ZOOM_MIN, Math.round((z - 0.25) * 100) / 100)),
    []
  )
  /** When true, POST /edit asks the server to flatten AcroForm fields into static content. */
  const [flattenFormsOnSave, setFlattenFormsOnSave] = useState(true)
  const flattenFormsOnSaveRef = useRef(true)
  flattenFormsOnSaveRef.current = flattenFormsOnSave
  /** PNG bytes from the modal; used for new placements. */
  const [signaturePng, setSignaturePng] = useState(null)
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)

  const {
    user,
    loading: authLoading,
    getFreshIdToken,
    signInWithGooglePopup,
    requestPasswordResetEmail,
    signInWithEmailPassword,
    signUpWithEmailPassword,
  } = useAuth()
  const { refresh: refreshSubscription } = useSubscription()

  useEffect(() => {
    if (!user || !sessionId) return
    void syncUserLibraryEntry({
      getFreshIdToken,
      user,
      sessionId,
      fileName: originalFileName,
      tool: 'edit_pdf',
    })
  }, [user, sessionId, getFreshIdToken, originalFileName])

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

  const textFormatInline = useMemo(() => {
    const showStrip =
      (activeTool === 'editText' && editTextMode) ||
      activeTool === 'text' ||
      textBoxOverlayActions != null
    if (!showStrip) return null
    const activelyEditing =
      Boolean(textBoxOverlayActions) ||
      (activeTool === 'editText' &&
        editTextMode &&
        (inlineTextEditorOpen || addedTextFormatOpen || annotFormatTarget != null))
    return {
      format: textFormat,
      onChange: setTextFormat,
      disabled: !activelyEditing,
      overlayActions: textBoxOverlayActions
        ? { done: textBoxOverlayActions.done, reset: textBoxOverlayActions.reset }
        : null,
    }
  }, [
    activeTool,
    editTextMode,
    inlineTextEditorOpen,
    addedTextFormatOpen,
    annotFormatTarget,
    textBoxOverlayActions,
    textFormat,
  ])

  const { pagesItems, commit, undo, redo, canUndo, canRedo, reset } = usePagesHistory({})
  pagesItemsRef.current = pagesItems
  nativeTextEditsRef.current = nativeTextEdits

  const numPages = pdfDoc?.numPages ?? 0

  const signatureImageBase64 = useMemo(() => {
    if (signaturePng?.length) return uint8ToBase64(signaturePng)
    for (const k of Object.keys(pagesItems || {})) {
      const list = pagesItems[k] || []
      const found = list.find((it) => it?.type === 'signature' && it.imageBase64)
      if (found?.imageBase64) {
        return String(found.imageBase64).replace(/^data:image\/png;base64,/i, '')
      }
    }
    return ''
  }, [signaturePng, pagesItems])

  const canPlaceSignature = Boolean(signatureImageBase64)

  const onToolbarTool = useCallback(
    (t) => {
      if (t === 'signature' && !canPlaceSignature) {
        setSignatureModalOpen(true)
        return
      }
      setActiveTool(t)
    },
    [canPlaceSignature]
  )

  const handleSignatureModalDone = useCallback((pngBytes) => {
    setSignaturePng(pngBytes)
    setSignatureModalOpen(false)
    setActiveTool('signature')
  }, [])

  const handleSignatureModalClose = useCallback(() => {
    setSignatureModalOpen(false)
  }, [])

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

  const editorHasUnpersistedEdits = useCallback(() => {
    const hasNative = nativeTextEditsRef.current.length > 0
    const hasAnnot = Object.values(pagesItemsRef.current).some((arr) => arr && arr.length > 0)
    if (!hasNative && !hasAnnot) return false
    return lastEditAtRef.current > lastServerSaveAtRef.current
  }, [])

  const handleBackClick = useCallback(() => {
    if (editorHasUnpersistedEdits()) {
      if (
        !window.confirm(
          'Leave the editor? Unsaved changes may be lost. Use Save PDF first if you want them on the server.'
        )
      ) {
        return
      }
    }
    onBack()
  }, [onBack, editorHasUnpersistedEdits])

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
        window.setTimeout(() => {
          if (cancelled) return
          const now = Date.now()
          lastServerSaveAtRef.current = now
          lastEditAtRef.current = now
        }, 0)
      } catch (e) {
        if (!cancelled) setLoadError(e?.message || 'Failed to load PDF')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId, reset, pdfBust, showErrorHint])

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
        /* Let server replace session-edits.json with this snapshot so “Add Text” removals persist. */
        ...(opts.annotationsAuthoritative === false ? {} : { annotationsAuthoritative: true }),
        flattenForms:
          typeof opts.flattenForms === 'boolean' ? opts.flattenForms : flattenFormsOnSaveRef.current,
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
    const syncedAt = Date.now()
    setLastSavedAt(syncedAt)
    lastServerSaveAtRef.current = syncedAt
  }, [sessionId])

  useEffect(() => {
    if (!pdfDoc) return
    lastEditAtRef.current = Date.now()
  }, [pdfDoc, nativeTextEdits, pagesItems])

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!pdfDoc) return
      const hasNative = nativeTextEditsRef.current.length > 0
      const hasAnnot = Object.values(pagesItemsRef.current).some((arr) => arr && arr.length > 0)
      if (!hasNative && !hasAnnot) return
      if (lastEditAtRef.current <= lastServerSaveAtRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [pdfDoc])

  const reloadPdfFromServer = useCallback(() => {
    setPdfDoc(null)
    setPdfBust((v) => v + 1)
  }, [])

  const finalizeDownloadFromBlob = useCallback(
    async (blob, t0, { usedAnonymousToken }) => {
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
      setDownloadCompleteModal({ fileName: 'edited.pdf', fileSizeBytes: blob.size })
      trackToolCompleted(EDIT_TOOL, true)
      trackFileDownloaded({
        tool: EDIT_TOOL,
        file_size: blob.size / 1024,
        total_pages: numPages,
      })
      setFeedbackPromptAfterDownload()
      const elapsed =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
      trackProcessingTime(EDIT_TOOL, elapsed)
      if (usedAnonymousToken && typeof onDownloadTokenConsumed === 'function') {
        onDownloadTokenConsumed()
      }
    },
    [reloadPdfFromServer, numPages, onDownloadTokenConsumed]
  )

  const runAuthenticatedDownload = useCallback(
    async () => {
      const idToken = user ? await getFreshIdToken().catch(() => null) : null
      if (user && !idToken) {
        return {
          ok: false,
          message: 'Could not refresh your session. Try again in a moment.',
        }
      }
      const anonTok = user ? null : downloadToken
      const r = await fetchEditPdfDownload({
        sessionId,
        downloadToken: anonTok,
        idToken,
      })
      if (r.ok) {
        return { ok: true, blob: r.blob, usedAnonymousToken: Boolean(anonTok) }
      }
      if (r.status === 503 && r.errPayload?.error === 'download_auth_misconfigured') {
        return {
          ok: false,
          message: 'Downloads are temporarily unavailable. Please try again later.',
        }
      }
      if (r.status === 401 && r.errPayload?.error === 'download_auth_required') {
        return { ok: false, needsAuth: true }
      }
      if (r.status === 403 && r.errPayload?.error === 'download_limit_exceeded') {
        return { ok: false, needsUpgrade: true, errPayload: r.errPayload }
      }
      const msg =
        (r.errPayload && (r.errPayload.message || r.errPayload.error)) ||
        (r.status === 401 ? 'Download was blocked. Try again.' : 'Download failed')
      return { ok: false, message: String(msg) }
    },
    [sessionId, downloadToken, user, getFreshIdToken]
  )

  const executePostAuthDownload = useCallback(async () => {
    if (executePostAuthDownloadInFlightRef.current) return
    executePostAuthDownloadInFlightRef.current = true
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      const idToken = await getFreshIdToken()
      if (!idToken) {
        throw new Error('Could not refresh your session. Please try signing in again.')
      }
      await persistPdfToServer()
      clearAnnotFormatUi()
      setTextBoxOverlayActions(null)
      const r = await fetchEditPdfDownload({
        sessionId,
        downloadToken: null,
        idToken,
      })
      if (!r.ok) {
        if (r.status === 403 && r.errPayload?.error === 'download_limit_exceeded') {
          const err = new Error('download_limit_exceeded')
          err.code = 'DOWNLOAD_LIMIT_EXCEEDED'
          err.payload = r.errPayload
          throw err
        }
        const msg =
          r.errPayload?.message || r.errPayload?.error || 'Download failed after sign-in.'
        throw new Error(String(msg))
      }
      await finalizeDownloadFromBlob(r.blob, t0, { usedAnonymousToken: false })
      setDownloadAuthModalOpen(false)
      setDownloadAuthError(null)
      setDownloadAuthSuccess(null)
      clearPendingDownload()
      pendingResumeAfterAuthRef.current = false
    } finally {
      executePostAuthDownloadInFlightRef.current = false
    }
  }, [
    sessionId,
    getFreshIdToken,
    persistPdfToServer,
    clearAnnotFormatUi,
    finalizeDownloadFromBlob,
  ])

  useEffect(() => {
    if (authLoading || !user || !pdfDoc) return
    const pending = readPendingDownload()
    if (!pending || pending.kind !== 'edit' || pending.sessionId !== sessionId) return
    if (postAuthResumeLockRef.current) return
    postAuthResumeLockRef.current = true
    void (async () => {
      setDownloading(true)
      setDownloadAuthError(null)
      try {
        await executePostAuthDownload()
      } catch (e) {
        console.error(e)
        trackErrorOccurred(EDIT_TOOL, e?.message || 'download_resume_failed')
        clearPendingDownload()
        if (e?.code === 'DOWNLOAD_LIMIT_EXCEEDED') {
          setUpgradeModalOpen(true)
          setDownloadAuthModalOpen(false)
          setDownloadAuthError(null)
        } else {
          setDownloadAuthError(e?.message || 'Could not complete download. Try again.')
          setDownloadAuthModalOpen(true)
        }
      } finally {
        postAuthResumeLockRef.current = false
        setDownloading(false)
      }
    })()
  }, [authLoading, user, pdfDoc, sessionId, executePostAuthDownload])

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
      reloadPdfFromServer()
      setSaveHint(MSG.savedSession)
      window.setTimeout(() => setSaveHint(null), 5000)
      trackToolCompleted(EDIT_TOOL, true)
      const elapsed =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
      trackProcessingTime(EDIT_TOOL, elapsed)
      if (user) {
        void syncUserLibraryEntry({
          getFreshIdToken,
          user,
          sessionId,
          fileName: originalFileName,
          tool: 'edit_pdf',
        })
      }
    } catch (e) {
      console.error(e)
      trackErrorOccurred(EDIT_TOOL, e?.message || 'save_failed')
      showErrorHint(hintForSaveError(e?.message))
    } finally {
      setSaving(false)
    }
  }

  const namedCopyUiEnabled = Boolean(user) && typeof onSessionFork === 'function'

  const handleNamedCopy = useCallback(async () => {
    if (!user || typeof onSessionFork !== 'function') return
    const suggestion = suggestLibraryDuplicateFileName(originalFileName)
    const entered = window.prompt(
      'Name for this copy (shown in My Documents).\nWe save your PDF first, then open the new copy.',
      suggestion
    )
    if (entered === null) return
    const trimmed = String(entered).trim()
    const fileName = trimmed.length > 0 ? trimmed : suggestion
    cancelScheduledAutosave()
    setNamedCopyBusy(true)
    try {
      await commitActiveInlineEditor()
      await persistPdfToServer()
      const dup = await duplicateUserSessionOnServer({
        getFreshIdToken,
        sourceSessionId: sessionId,
        fileName,
      })
      if (!dup.ok) {
        const msg =
          dup.error === 'admin_unavailable'
            ? 'Named copy needs Firebase Admin on the API (for local dev, set FIREBASE_SERVICE_ACCOUNT_JSON).'
            : String(dup.error || 'Could not create a named copy.')
        throw new Error(msg)
      }
      if (!NAMED_COPY_SESSION_ID_RE.test(dup.newSessionId)) {
        throw new Error('Unexpected server response when creating a named copy.')
      }
      if (dup.libraryIndexed === false) {
        console.warn('[PdfEditor] Named copy created but Firestore library index may be skipped.')
      }
      showToast(`Opening copy: ${dup.fileName}`)
      onSessionFork({ sessionId: dup.newSessionId, fileName: dup.fileName })
    } catch (e) {
      console.error(e)
      trackErrorOccurred(EDIT_TOOL, e?.message || 'named_copy_failed')
      showErrorHint(String(e?.message || 'Could not create a named copy.'))
    } finally {
      setNamedCopyBusy(false)
    }
  }, [
    user,
    onSessionFork,
    originalFileName,
    cancelScheduledAutosave,
    commitActiveInlineEditor,
    persistPdfToServer,
    getFreshIdToken,
    sessionId,
    showToast,
    showErrorHint,
  ])

  const dismissDownloadAuthModal = useCallback(() => {
    if (downloadAuthBusy) return
    setDownloadAuthModalOpen(false)
    setDownloadAuthError(null)
    setDownloadAuthSuccess(null)
    pendingResumeAfterAuthRef.current = false
    clearPendingDownload()
  }, [downloadAuthBusy])

  const runPopupOauthThenDownload = useCallback(
    async (signInFn) => {
      setDownloadAuthBusy(true)
      setDownloadAuthError(null)
      setDownloadAuthSuccess(null)
      try {
        await signInFn()
        setDownloading(true)
        await executePostAuthDownload()
      } catch (e) {
        console.error(e)
        const code = e?.code || ''
        if (code === 'DOWNLOAD_LIMIT_EXCEEDED') {
          setUpgradeModalOpen(true)
          setDownloadAuthError(null)
        } else if (code === 'auth/popup-blocked') {
          setDownloadAuthError(
            'Your browser blocked the sign-in window. Allow popups for this site, then try “Continue with Google” again.'
          )
        } else if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
          setDownloadAuthError(null)
        } else {
          setDownloadAuthError(
            getFirebaseAuthErrorHint(e) ||
              e?.message ||
              'We could not connect. Check your network and try again.'
          )
        }
        trackErrorOccurred(EDIT_TOOL, e?.message || 'oauth_failed')
      } finally {
        setDownloading(false)
        setDownloadAuthBusy(false)
      }
    },
    [executePostAuthDownload]
  )

  const runPasswordResetForDownload = useCallback(
    async (email) => {
      setDownloadAuthBusy(true)
      setDownloadAuthError(null)
      setDownloadAuthSuccess(null)
      try {
        await requestPasswordResetEmail(email)
        setDownloadAuthSuccess(
          'If an account exists for that email, we sent reset instructions. Check your inbox and spam folder. After you set a new password, sign in here with email and password.'
        )
      } catch (e) {
        console.error(e)
        setDownloadAuthError(
          getFirebaseAuthErrorHint(e) || e?.message || 'Could not send reset email.'
        )
        trackErrorOccurred(EDIT_TOOL, e?.message || 'password_reset_failed')
      } finally {
        setDownloadAuthBusy(false)
      }
    },
    [requestPasswordResetEmail]
  )

  const handleDownload = async () => {
    cancelScheduledAutosave()
    await commitActiveInlineEditor()
    setDownloading(true)
    setDownloadAuthError(null)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      await persistPdfToServer()
      clearAnnotFormatUi()
      setTextBoxOverlayActions(null)

      if (authLoading) {
        showErrorHint('Still checking sign-in… wait a moment, then tap Download PDF again.')
        return
      }

      /**
       * When Firebase Auth is live, require a signed-in user before hitting /download so we never
       * flash a failed anonymous request. Work is already persisted above; pending intent lets the
       * resume effect (or modal OAuth) finish the download after sign-in.
       */
      if (!user && isFirebaseClientConfigured()) {
        pendingResumeAfterAuthRef.current = true
        writePendingDownload({ kind: 'edit', sessionId })
        persistEditSession({ sessionId, downloadToken, fileName: originalFileName })
        setDownloadAuthSuccess(null)
        setDownloadAuthModalOpen(true)
        return
      }

      const result = await runAuthenticatedDownload()
      if (result.ok) {
        await finalizeDownloadFromBlob(result.blob, t0, {
          usedAnonymousToken: result.usedAnonymousToken,
        })
        return
      }
      if (result.needsUpgrade) {
        setUpgradeModalOpen(true)
        return
      }
      if (result.needsAuth) {
        if (!isFirebaseClientConfigured()) {
          showErrorHint(
            'Secure download is not set up in this build yet. If you are the site owner, configure Firebase (see backend .env.example) and redeploy.'
          )
          return
        }
        pendingResumeAfterAuthRef.current = true
        writePendingDownload({ kind: 'edit', sessionId })
        persistEditSession({ sessionId, downloadToken, fileName: originalFileName })
        setDownloadAuthSuccess(null)
        setDownloadAuthModalOpen(true)
        return
      }
      if (result.message) {
        showErrorHint(result.message)
      }
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
      <div
        id="site-main"
        tabIndex={-1}
        className="relative flex min-h-svh scroll-mt-24 flex-col items-center justify-center gap-4 p-6 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 dark:focus-visible:ring-cyan-400/35"
      >
        <div className="fixed right-4 top-4 z-[200] flex items-center gap-2">
          <AccountMenu compact />
          <ThemeToggle />
        </div>
        <p className="text-red-600 dark:text-red-400">{loadError}</p>
        <button
          type="button"
          className="fx-focus-ring rounded-lg bg-zinc-200 px-4 py-2.5 text-sm font-medium transition hover:bg-zinc-300 active:scale-[0.98] dark:bg-zinc-700 dark:hover:bg-zinc-600"
          onClick={handleBackClick}
        >
          Back
        </button>
      </div>
    )
  }

  if (!pdfDoc) {
    return (
      <div
        id="site-main"
        tabIndex={-1}
        className="relative flex min-h-svh scroll-mt-24 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 py-10 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 dark:bg-zinc-950 dark:focus-visible:ring-cyan-400/35"
      >
        <div className="fixed right-4 top-4 z-[200] flex items-center gap-2">
          <AccountMenu compact />
          <ThemeToggle />
        </div>
        <p className="sr-only">{MSG.loadingPdf}</p>
        <div className="w-full max-w-md space-y-3" aria-hidden>
          <div className="h-9 rounded-lg bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800 animate-pulse" />
          <div className="h-[min(42vh,360px)] rounded-xl bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-3 flex-1 rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800 animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800 animate-pulse" />
          </div>
        </div>
        <span className="text-sm text-zinc-600 dark:text-zinc-400" aria-hidden>
          {MSG.loadingPdf}
        </span>
      </div>
    )
  }

  return (
    <div
      id="site-main"
      tabIndex={-1}
      className="flex h-svh scroll-mt-24 flex-col bg-zinc-100/95 text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/35 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus-visible:ring-cyan-400/25"
    >
      <Toolbar
        activeTool={activeTool}
        onToolChange={onToolbarTool}
        editTextMode={editTextMode}
        onEditTextModeChange={setEditTextMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        showSaveDownload={false}
        onShortcutsClick={() => setShortcutsOpen(true)}
        zoom={zoom}
        zoomMin={EDITOR_ZOOM_MIN}
        zoomMax={EDITOR_ZOOM_MAX}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        flattenFormsOnSave={flattenFormsOnSave}
        onFlattenFormsOnSaveChange={setFlattenFormsOnSave}
        textFormatInline={textFormatInline}
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
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto px-3 py-3 md:px-6 md:py-4"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBackClick}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            >
              ← New upload
            </button>
            <span className="text-sm text-zinc-500">
              Session <code className="text-xs">{sessionId.slice(0, 8)}…</code>
            </span>
          </div>
          {showOnboarding && (
            <EditorOnboardingBanner
              onDismiss={dismissOnboarding}
              onOpenShortcuts={() => setShortcutsOpen(true)}
            />
          )}
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
                <strong>Add Text</strong> / <strong>Signature</strong> / <strong>Draw</strong> /{' '}
                <strong>Highlight</strong> / <strong>Rectangle</strong> for markup. When you finish a line (click outside or press{' '}
                <kbd className="rounded bg-amber-200/80 px-1 dark:bg-amber-900/50">Ctrl+Enter</kbd>
                ), your text is saved to this session automatically — no need to press{' '}
                <strong>Save PDF</strong> first. Use <strong>Save PDF</strong> or{' '}
                <strong>Download PDF</strong> in the <strong>Edits</strong> panel (side) anytime for a
                full sync or file download. For fillable forms, leave{' '}
                <strong>Flatten forms on save</strong> checked in the toolbar so viewers
                do not tint fields blue; turn it off only if you need the downloaded PDF to stay
                editable as a form.
              </p>
            </div>
          )}
          <div className="mx-auto flex w-max flex-col items-center gap-8 pb-24">
            {pageNodes?.map((i) => (
              <div
                key={i}
                ref={(el) => {
                  pageRefs.current[i] = el
                }}
                className="shrink-0"
                style={{ width: `${Math.round(EDITOR_PAGE_BASE_CSS_PX * zoom)}px` }}
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
                      signatureImageBase64={signatureImageBase64}
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
          authLoading={authLoading}
          listSyncing={editingListSync}
          lastSavedAt={lastSavedAt}
          namedCopyEnabled={namedCopyUiEnabled}
          userSignedIn={Boolean(user)}
          namedCopyBusy={namedCopyBusy}
          onNamedCopy={handleNamedCopy}
        />
      </div>
      <SignatureCreationModal
        open={signatureModalOpen}
        onClose={handleSignatureModalClose}
        onDone={handleSignatureModalDone}
      />
      <EditPdfShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <DownloadCompleteModal
        open={Boolean(downloadCompleteModal)}
        onClose={() => setDownloadCompleteModal(null)}
        fileName={downloadCompleteModal?.fileName ?? 'edited.pdf'}
        fileSizeBytes={downloadCompleteModal?.fileSizeBytes ?? 0}
      />
      <ContinueDownloadModal
        open={downloadAuthModalOpen}
        busy={downloadAuthBusy || downloading}
        errorHint={downloadAuthError}
        successHint={downloadAuthSuccess}
        onDismiss={dismissDownloadAuthModal}
        onGooglePopup={() => runPopupOauthThenDownload(signInWithGooglePopup)}
        onAuthMessage={(msg) => {
          if (msg == null) setDownloadAuthError(null)
          else {
            setDownloadAuthError(msg)
            setDownloadAuthSuccess(null)
          }
        }}
        onEmailSignIn={(email, password) =>
          runPopupOauthThenDownload(() => signInWithEmailPassword(email, password))
        }
        onEmailSignUp={(payload) =>
          runPopupOauthThenDownload(() => signUpWithEmailPassword(payload))
        }
        onSendPasswordReset={(email) => runPasswordResetForDownload(email)}
      />

      <UpgradePlanModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        onPaid={() => void refreshSubscription()}
      />

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
      <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3 shadow dark:border-zinc-700 dark:bg-zinc-900">
        <div className="h-4 w-2/5 rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800 animate-pulse" />
        <div className="h-36 w-full rounded-md bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800/80 animate-pulse" />
        <div className="h-3 w-3/5 rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800 animate-pulse" />
      </div>
    )
  }
  return children(page)
}
