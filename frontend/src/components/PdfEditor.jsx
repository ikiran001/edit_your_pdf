import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDocument } from 'pdfjs-dist'
import { usePagesHistory } from '../hooks/usePagesHistory'
import Toolbar from './Toolbar'
import ThumbnailSidebar from './ThumbnailSidebar'
import PdfPageCanvas from './PdfPageCanvas'

/** Strip client-only fields before sending edits to the API / pdf-lib. */
function toServerItem(it) {
  const { id, fontSizeCss, lineWidthCss, ...rest } = it
  return rest
}

function buildEditsPayload(pagesItems) {
  const pages = Object.keys(pagesItems)
    .map(Number)
    .sort((a, b) => a - b)
    .map((pageIndex) => ({
      pageIndex,
      items: (pagesItems[pageIndex] || []).map(toServerItem),
    }))
    .filter((g) => g.items.length > 0)
  return { pages }
}

export default function PdfEditor({ sessionId, onBack }) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [activeTool, setActiveTool] = useState(null)
  const [activePage, setActivePage] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const pageRefs = useRef([])
  const scrollRef = useRef(null)
  const { pagesItems, commit, undo, redo, canUndo, canRedo, reset } = usePagesHistory({})

  const numPages = pdfDoc?.numPages ?? 0

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    const pdfUrl = `/pdf/${sessionId}`
    ;(async () => {
      try {
        const task = getDocument({ url: pdfUrl, withCredentials: false })
        const doc = await task.promise
        if (cancelled) return
        setPdfDoc(doc)
        reset({})
      } catch (e) {
        if (!cancelled) setLoadError(e?.message || 'Failed to load PDF')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId, reset])

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

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const edits = buildEditsPayload(pagesItems)
      const res = await fetch('/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, edits }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Edit failed')
      window.location.href = `/download?sessionId=${encodeURIComponent(sessionId)}`
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
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onDownload={handleDownload}
        downloading={downloading}
      />
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
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-6"
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
                <PageLoader pdfDoc={pdfDoc} pageIndex={i}>
                  {(page) => (
                    <PdfPageCanvas
                      pdfPage={page}
                      tool={activeTool}
                      items={pagesItems[i] || []}
                      onUpdateItems={updatePage(i)}
                    />
                  )}
                </PageLoader>
              </div>
            ))}
          </div>
        </div>
      </div>
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
