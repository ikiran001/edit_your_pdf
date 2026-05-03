import { useEffect, useMemo, useRef } from 'react'

/**
 * Renders small page previews; clicking scrolls the main view to that page.
 */
export default function ThumbnailSidebar({
  pdfDoc,
  numPages,
  activePage,
  onSelectPage,
  pageRefs,
  /** When false, only `onSelectPage` runs (no scrollIntoView). Use for single-page preview tools. */
  scrollIntoViewOnSelect = true,
  /** Merged onto the root aside (e.g. `max-h-[…] min-h-0` so the list scrolls inside the viewport). */
  className = '',
  /** 0-based page indices that have a saved crop (optional UI hint). */
  savedPageIndices = [],
}) {
  const savedSet = useMemo(() => new Set(savedPageIndices), [savedPageIndices])
  return (
    <aside
      className={`hidden w-36 shrink-0 overflow-y-auto border-r border-indigo-200/50 bg-zinc-50/95 p-2 md:block dark:border-indigo-500/15 dark:bg-zinc-950/90 ${className}`.trim()}
    >
      <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-wider text-indigo-600 dark:text-cyan-500/80">
        Pages
      </div>
      <ul className="flex flex-col gap-2">
        {Array.from({ length: numPages }, (_, i) => (
          <li key={i}>
            <ThumbnailItem
              pdfDoc={pdfDoc}
              pageIndex={i}
              active={activePage === i}
              saved={savedSet.has(i)}
              onSelect={() => {
                onSelectPage(i)
                if (scrollIntoViewOnSelect) {
                  pageRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            />
          </li>
        ))}
      </ul>
    </aside>
  )
}

function ThumbnailItem({ pdfDoc, pageIndex, active, saved = false, onSelect }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let renderTask = null
    ;(async () => {
      if (!pdfDoc || !canvasRef.current) return
      const page = await pdfDoc.getPage(pageIndex + 1)
      if (cancelled) return
      const scale = 0.18
      const vp = page.getViewport({ scale })
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      canvas.width = vp.width
      canvas.height = vp.height
      renderTask = page.render({ canvasContext: ctx, viewport: vp })
      try {
        await renderTask.promise
      } catch {
        /* RenderingCancelledException etc. */
      }
    })()
    return () => {
      cancelled = true
      try {
        renderTask?.cancel()
      } catch {
        /* ignore */
      }
    }
  }, [pdfDoc, pageIndex])

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full rounded-lg border p-1 text-left transition ${
        active
          ? 'border-indigo-500 ring-2 ring-indigo-300'
          : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-600'
      }`}
    >
      {saved ? (
        <span
          className="absolute right-1 top-1 z-10 h-2 w-2 rounded-full bg-emerald-500 shadow ring-1 ring-white dark:ring-zinc-900"
          title="Crop saved for this page"
          aria-hidden
        />
      ) : null}
      <canvas ref={canvasRef} className="mx-auto block max-h-40 w-auto rounded bg-white shadow-sm" />
      <span className="mt-1 block text-center text-[11px] text-zinc-600 dark:text-zinc-400">
        {pageIndex + 1}
      </span>
    </button>
  )
}
