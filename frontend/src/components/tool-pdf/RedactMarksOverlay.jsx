/**
 * Renders staged (amber) and confirmed (black) redaction boxes plus optional draft rectangle.
 *
 * @typedef {{ id: string, nx: number, ny: number, nw: number, nh: number, staged?: boolean }} RedactRect
 *
 * @param {{
 *   rects: RedactRect[],
 *   draft: { nx: number, ny: number, nw: number, nh: number } | null,
 *   eraseMode?: boolean,
 *   onEraseId?: (id: string) => void,
 * }} props
 */
export default function RedactMarksOverlay({ rects, draft, eraseMode, onEraseId }) {
  return (
    <div
      className={`absolute inset-0 z-20 ${
        eraseMode ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {rects.map((r) => (
        <div
          key={r.id}
          role={eraseMode ? 'button' : undefined}
          tabIndex={eraseMode ? 0 : undefined}
          className={`absolute border-2 ${
            r.staged
              ? 'border-amber-400 bg-amber-400/30'
              : 'border-zinc-900 bg-black/90 dark:border-zinc-100'
          } ${eraseMode ? 'cursor-pointer' : ''}`}
          style={{
            left: `${r.nx * 100}%`,
            top: `${r.ny * 100}%`,
            width: `${r.nw * 100}%`,
            height: `${r.nh * 100}%`,
          }}
          onPointerDown={(e) => {
            if (!eraseMode || !onEraseId) return
            e.stopPropagation()
            e.preventDefault()
            onEraseId(r.id)
          }}
        />
      ))}
      {draft ? (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-red-500 bg-red-500/15"
          style={{
            left: `${draft.nx * 100}%`,
            top: `${draft.ny * 100}%`,
            width: `${draft.nw * 100}%`,
            height: `${draft.nh * 100}%`,
          }}
        />
      ) : null}
    </div>
  )
}
