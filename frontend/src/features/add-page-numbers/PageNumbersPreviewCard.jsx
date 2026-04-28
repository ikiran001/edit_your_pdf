import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import LazyPdfPageThumbnail from '../organize-pdf/LazyPdfPageThumbnail.jsx'
import { estimateTextWidthPx, xyFacing, xySingle } from '../../lib/pageNumbersLayout.js'

/**
 * Gallery-style thumbnail + placement marker (dot) + optional folio text overlay.
 * @param {import('pdfjs-dist').PDFDocumentProxy | null} props.pdfDoc
 * @param {number} props.pageIndex1Based
 * @param {string | null} props.folioText
 * @param {'single'|'facing'} props.layoutMode
 * @param {boolean} [props.markerOnly] — prefer dot marker like reference UI (default true)
 */
export default function PageNumbersPreviewCard({
  pdfDoc,
  pageIndex1Based,
  folioText,
  layoutMode,
  gridRow,
  gridCol,
  marginPts,
  fontSize,
  colorHex,
  bold,
  disabled,
  markerOnly = true,
}) {
  const wrapRef = useRef(null)
  const [dims, setDims] = useState(null)
  const [cw, setCw] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!pdfDoc || !pageIndex1Based) {
      setDims(null)
      return undefined
    }
    ;(async () => {
      try {
        const page = await pdfDoc.getPage(pageIndex1Based)
        const baseRot = page.rotate || 0
        const rotation = ((baseRot % 360) + 360) % 360
        const vp = page.getViewport({ scale: 1, rotation })
        if (!cancelled) setDims({ pw: vp.width, ph: vp.height })
      } catch {
        if (!cancelled) setDims(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pdfDoc, pageIndex1Based])

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => {
      setCw(el.clientWidth || 0)
    })
    ro.observe(el)
    setCw(el.clientWidth || 0)
    return () => ro.disconnect()
  }, [pdfDoc, pageIndex1Based])

  let overlay = null
  if (folioText && dims?.pw > 0 && dims?.ph > 0) {
    const { pw, ph } = dims
    const fs = Math.min(120, Math.max(6, Number(fontSize) || 11))
    const margin = Math.min(144, Math.max(8, Number(marginPts) || 36))
    const tw = estimateTextWidthPx(folioText, fs, Boolean(bold))
    const { x, y } =
      layoutMode === 'facing'
        ? xyFacing(gridRow, pw, ph, margin, fs, tw, pageIndex1Based)
        : xySingle(gridRow, gridCol, pw, ph, margin, fs, tw)

    const leftPct = (x / pw) * 100
    const bottomPct = (y / ph) * 100
    const scale = cw > 0 ? cw / pw : 1
    const displayPx = Math.max(6, fs * scale)

    overlay = (
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-lg" aria-hidden>
        {/* Corner marker — matches reference “dot at placement” UX */}
        <span
          className="absolute h-2.5 w-2.5 rounded-full bg-rose-600 shadow-md ring-2 ring-white/95 dark:bg-rose-500 dark:ring-zinc-900/80"
          style={{
            left: `${leftPct}%`,
            bottom: `${bottomPct}%`,
            transform: 'translate(-40%, 35%)',
          }}
          title={folioText}
        />
        {!markerOnly ? (
          <span
            style={{
              position: 'absolute',
              left: `${leftPct}%`,
              bottom: `${bottomPct}%`,
              fontSize: `${displayPx}px`,
              fontWeight: bold ? 700 : 400,
              color: colorHex || '#334155',
              whiteSpace: 'nowrap',
              lineHeight: 1,
              transform: 'translateY(0.2em)',
              maxWidth: '95%',
              textShadow: '0 0 2px rgba(255,255,255,0.85), 0 0 4px rgba(255,255,255,0.45)',
            }}
          >
            {folioText}
          </span>
        ) : (
          <span className="sr-only">{folioText}</span>
        )}
      </div>
    )
  }

  const skipped = folioText == null

  return (
    <article
      className={`flex w-[min(280px,78vw)] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-white shadow-md ring-1 ring-zinc-200/80 transition-opacity dark:bg-zinc-900 dark:ring-zinc-700/90 ${
        skipped ? 'opacity-[0.52]' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200/90 bg-zinc-50/95 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/90">
        <span className="min-w-0 truncate text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
          Page {pageIndex1Based}
        </span>
        {skipped ? (
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Skip
          </span>
        ) : null}
      </div>

      <div ref={wrapRef} className={`relative p-2 ${disabled ? 'opacity-60' : ''}`}>
        <LazyPdfPageThumbnail pdfDoc={pdfDoc} pageIndex1Based={pageIndex1Based} extraRotation={0} />
        {overlay}
      </div>
    </article>
  )
}
