/**
 * Floating dark bar at the bottom of the viewer (crop / redact style).
 */
export default function FloatingPdfChrome({
  fileName,
  pageIndex,
  numPages,
  onPrev,
  onNext,
  zoomPct,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  /** Optional: rotate view (0,90,180,270) */
  rotation = 0,
  onRotate,
  disabled,
}) {
  const canPrev = pageIndex > 0
  const canNext = pageIndex < numPages - 1

  return (
    <div className="pointer-events-auto mx-auto mt-2 flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-zinc-600/80 bg-zinc-800/95 px-3 py-2 text-xs text-zinc-100 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || !canPrev}
          onClick={onPrev}
          className="rounded-lg p-1.5 hover:bg-zinc-700 disabled:opacity-30"
          aria-label="Previous page"
        >
          ◀
        </button>
        <button
          type="button"
          disabled={disabled || !canNext}
          onClick={onNext}
          className="rounded-lg p-1.5 hover:bg-zinc-700 disabled:opacity-30"
          aria-label="Next page"
        >
          ▶
        </button>
        <span className="min-w-[3.5rem] tabular-nums text-zinc-300">
          {numPages > 0 ? `${pageIndex + 1} / ${numPages}` : '—'}
        </span>
      </div>
      <div className="h-5 w-px bg-zinc-600" aria-hidden />
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={onZoomOut}
          className="rounded-lg px-2 py-1 hover:bg-zinc-700"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="min-w-[3.25rem] text-center tabular-nums text-zinc-200">{zoomPct}%</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onZoomIn}
          className="rounded-lg px-2 py-1 hover:bg-zinc-700"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onFitWidth}
          className="rounded-lg px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-zinc-700"
          title="Fit width"
        >
          Fit
        </button>
      </div>
      {onRotate ? (
        <>
          <div className="h-5 w-px bg-zinc-600" aria-hidden />
          <button
            type="button"
            disabled={disabled}
            onClick={onRotate}
            className="rounded-lg px-2 py-1 text-[11px] hover:bg-zinc-700"
            title="Rotate view"
          >
            ⟳ {rotation}°
          </button>
        </>
      ) : null}
      {fileName ? (
        <>
          <div className="h-5 w-px bg-zinc-600" aria-hidden />
          <span className="max-w-[12rem] truncate text-[11px] text-zinc-400" title={fileName}>
            {fileName}
          </span>
        </>
      ) : null}
    </div>
  )
}
