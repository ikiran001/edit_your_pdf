import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { apiUrl } from '../lib/apiBase'
import { usePagesHistory } from '../hooks/usePagesHistory'
import Toolbar from './Toolbar'
import ThumbnailSidebar from './ThumbnailSidebar'
import PdfPageCanvas from './PdfPageCanvas'
import TextFormatToolbar from './TextFormatToolbar'
import { defaultTextFormat, formatFromTextBlock } from '../lib/textFormatDefaults'

/** Strip client-only fields before sending edits to the API / pdf-lib. */
function toServerItem(it) {
  const rest = { ...it }
  delete rest.id
  delete rest.fontSizeCss
  delete rest.lineWidthCss
  return rest
}

function buildEditsPayload(pagesItems) {
  const pages = Object.entries(pagesItems)
    .map(([key, list]) => ({
      pageIndex: Number(key),
      items: (list || []).map(toServerItem),
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
    const items = (g.items || []).map((it) => ({
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
  const [saveHint, setSaveHint] = useState(null)
  /** When true, server runs pdf.js text find + pdf-lib redraw (real PDF text edit). */
  const [applyTextSwap, setApplyTextSwap] = useState(true)
  /** Bumped after a successful save so pdf.js refetches (edited.pdf) instead of a cached original. */
  const [pdfBust, setPdfBust] = useState(0)
  const pageRefs = useRef([])
  const scrollRef = useRef(null)
  const pagesItemsRef = useRef({})
  const nativeTextEditsRef = useRef([])
  const [nativeTextEdits, setNativeTextEdits] = useState([])
  /** Single source of truth for on-canvas text: block id → latest string (survives re-parse / re-render). */
  const [blockTextOverrides, setBlockTextOverrides] = useState({})
  const [textFormat, setTextFormat] = useState(defaultTextFormat)
  const textFormatRef = useRef(textFormat)
  textFormatRef.current = textFormat
  const [editTextMode, setEditTextMode] = useState(true)
  const [inlineTextEditorOpen, setInlineTextEditorOpen] = useState(false)

  useEffect(() => {
    if (!editTextMode) setInlineTextEditorOpen(false)
  }, [editTextMode])
  const { pagesItems, commit, undo, redo, canUndo, canRedo, reset } = usePagesHistory({})
  pagesItemsRef.current = pagesItems
  nativeTextEditsRef.current = nativeTextEdits

  const numPages = pdfDoc?.numPages ?? 0

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
      commit((prev) => {
        const cur = prev[pageIndex] || []
        const next = typeof updater === 'function' ? updater(cur) : updater
        return { ...prev, [pageIndex]: next }
      })
    },
    [commit]
  )

  const pageNodes = useMemo(() => {
    if (!pdfDoc) return null
    return Array.from({ length: numPages }, (_, i) => i)
  }, [pdfDoc, numPages])

  const addNativeTextEdit = useCallback((pageIndex, payload) => {
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
    } = payload
    const key = `${pageIndex}:${pdf.x}:${pdf.y}:${pdf.baseline}`
    const prev = nativeTextEditsRef.current
    const rest = prev.filter((e) => e.key !== key)
    const next = [
      ...rest,
      {
        key,
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
      },
    ]
    if (blockId) {
      setBlockTextOverrides((prev) => (prev[blockId] === text ? prev : { ...prev, [blockId]: text }))
    }
    // Keep ref in sync immediately so “Download” in the same gesture as textarea blur still sends edits.
    nativeTextEditsRef.current = next
    setNativeTextEdits(next)
  }, [])

  const persistPdfToServer = async () => {
    const edits = buildEditsPayload(pagesItemsRef.current)
    const nativePayload = nativeTextEditsRef.current
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
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
        applyTextSwap,
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
      // eslint-disable-next-line no-console
      console.debug('[save] /edit ok', res.status)
    }
  }

  const reloadPdfFromServer = () => {
    setPdfDoc(null)
    setPdfBust((v) => v + 1)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveHint(null)
    try {
      await persistPdfToServer()
      reloadPdfFromServer()
      setSaveHint('Saved — edits are stored for this session.')
      window.setTimeout(() => setSaveHint(null), 4000)
    } catch (e) {
      console.error(e)
      alert(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
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
      setSaveHint(null)
    } catch (e) {
      console.error(e)
      alert(e.message || 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-600">{loadError}</p>
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
      <div className="flex min-h-svh items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Loading PDF…</span>
      </div>
    )
  }

  return (
    <div className="flex h-svh flex-col bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        editTextMode={editTextMode}
        onEditTextModeChange={setEditTextMode}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onSave={handleSave}
        onDownload={handleDownload}
        saving={saving}
        downloading={downloading}
        applyTextSwap={applyTextSwap}
        onApplyTextSwapChange={setApplyTextSwap}
      />
      {saveHint && (
        <div
          role="status"
          className="border-b border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          {saveHint}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <ThumbnailSidebar
          pdfDoc={pdfDoc}
          numPages={numPages}
          activePage={activePage}
          onSelectPage={setActivePage}
          pageRefs={pageRefs}
        />
        <div
          ref={scrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-6"
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
          {!activeTool && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100"
            >
              <p className="m-0 font-medium">Select a tool first</p>
              <p className="mt-1 mb-0 text-amber-900/90 dark:text-amber-100/90">
                Use <strong>Edit text</strong> to change existing PDF wording (matched size), or{' '}
                <strong>Text</strong> / <strong>Draw</strong> / <strong>Highlight</strong> /{' '}
                <strong>Rectangle</strong> for markup. Edits to existing text apply when you click{' '}
                <strong>Save PDF</strong> (store on server) or <strong>Download PDF</strong> (save + file). Optional bulk swap “PDF editor” → “PDF love” uses the checkbox.
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
                      items={pagesItems[i] || []}
                      onUpdateItems={updatePage(i)}
                      blockTextOverrides={blockTextOverrides}
                      sessionNativeTextEdits={nativeTextEdits}
                      onNativeTextEdit={(payload) => addNativeTextEdit(i, payload)}
                      textFormat={textFormat}
                      textFormatRef={textFormatRef}
                      editTextMode={editTextMode}
                      onInlineEditorActiveChange={setInlineTextEditorOpen}
                      onBeginNativeTextEdit={(block) =>
                        setTextFormat((prev) => formatFromTextBlock(block, prev))
                      }
                    />
                  )}
                </LazyPageLoader>
              </div>
            ))}
          </div>
        </div>
        {activeTool === 'editText' && editTextMode && inlineTextEditorOpen && (
          <TextFormatToolbar
            format={textFormat}
            onChange={setTextFormat}
            disabled={false}
          />
        )}
      </div>
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
