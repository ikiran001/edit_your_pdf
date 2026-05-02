import { useCallback, useRef } from 'react'

const MIN = 0.02
const HANDLE = 12

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * Gray mask outside crop; draggable/resizable inner rect. Coordinates are normalized 0–1
 * from the top-left of the page canvas (same as pdf.js viewport, rotation 0).
 *
 * @param {{
 *   rect: { l: number, t: number, w: number, h: number },
 *   onChange: (r: { l: number, t: number, w: number, h: number }) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function CropRectOverlay({ rect, onChange, disabled }) {
  const dragRef = useRef(null)

  const toDeltaNorm = useCallback((dxPx, dyPx, wrapW, wrapH) => {
    return { dx: dxPx / Math.max(wrapW, 1), dy: dyPx / Math.max(wrapH, 1) }
  }, [])

  const onPointerDownBox = (e) => {
    if (disabled || e.target.closest('[data-crop-handle]')) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      kind: 'move',
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ol: rect.l,
      ot: rect.t,
    }
  }

  const onPointerDownHandle = (e, mode) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      kind: 'resize',
      mode,
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      start: { ...rect },
    }
  }

  const onPointerMove = (e, wrapW, wrapH) => {
    const d = dragRef.current
    if (!d || d.pid !== e.pointerId) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    const { dx: ndx, dy: ndy } = toDeltaNorm(dx, dy, wrapW, wrapH)

    if (d.kind === 'move') {
      let nl = d.ol + ndx
      let nt = d.ot + ndy
      nl = clamp(nl, 0, 1 - rect.w)
      nt = clamp(nt, 0, 1 - rect.h)
      onChange({ l: nl, t: nt, w: rect.w, h: rect.h })
      return
    }

    const s = d.start
    let { l, t, w, h } = s
    const m = d.mode

    switch (m) {
      case 'e':
        w = clamp(s.w + ndx, MIN, 1 - s.l)
        break
      case 's':
        h = clamp(s.h + ndy, MIN, 1 - s.t)
        break
      case 'w': {
        const nl = clamp(s.l + ndx, 0, s.l + s.w - MIN)
        w = s.l + s.w - nl
        l = nl
        break
      }
      case 'n': {
        const nt = clamp(s.t + ndy, 0, s.t + s.h - MIN)
        h = s.t + s.h - nt
        t = nt
        break
      }
      case 'ne': {
        w = clamp(s.w + ndx, MIN, 1 - s.l)
        const nt = clamp(s.t + ndy, 0, s.t + s.h - MIN)
        h = s.t + s.h - nt
        t = nt
        break
      }
      case 'nw': {
        const nl = clamp(s.l + ndx, 0, s.l + s.w - MIN)
        w = s.l + s.w - nl
        l = nl
        const nt = clamp(s.t + ndy, 0, s.t + s.h - MIN)
        h = s.t + s.h - nt
        t = nt
        break
      }
      case 'se':
        w = clamp(s.w + ndx, MIN, 1 - s.l)
        h = clamp(s.h + ndy, MIN, 1 - s.t)
        break
      case 'sw': {
        const nl = clamp(s.l + ndx, 0, s.l + s.w - MIN)
        w = s.l + s.w - nl
        l = nl
        h = clamp(s.h + ndy, MIN, 1 - s.t)
        break
      }
      default:
        break
    }

    l = clamp(l, 0, 1 - MIN)
    t = clamp(t, 0, 1 - MIN)
    w = clamp(w, MIN, 1 - l)
    h = clamp(h, MIN, 1 - t)
    onChange({ l, t, w, h })
  }

  const onPointerUp = (e) => {
    const d = dragRef.current
    if (d && d.pid === e.pointerId) {
      dragRef.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
  }

  const { l, t, w, h } = rect

  return (
    <div className="crop-overlay-wrap pointer-events-none absolute inset-0 z-20">
      <div className="relative h-full w-full">
        {/* dim outside */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 bg-zinc-900/45"
          style={{ height: `${t * 100}%` }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-zinc-900/45"
          style={{ height: `${(1 - t - h) * 100}%` }}
        />
        <div
          className="pointer-events-none absolute left-0 bg-zinc-900/45"
          style={{ top: `${t * 100}%`, width: `${l * 100}%`, height: `${h * 100}%` }}
        />
        <div
          className="pointer-events-none absolute right-0 bg-zinc-900/45"
          style={{ top: `${t * 100}%`, width: `${(1 - l - w) * 100}%`, height: `${h * 100}%` }}
        />

        {/* selection */}
        <div
          className={`pointer-events-auto absolute z-10 border-2 border-sky-500 shadow-[0_0_0_1px_rgba(255,255,255,0.6)] ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-move'
          }`}
          style={{
            left: `${l * 100}%`,
            top: `${t * 100}%`,
            width: `${w * 100}%`,
            height: `${h * 100}%`,
            touchAction: 'none',
          }}
          onPointerDown={onPointerDownBox}
          onPointerMove={(e) => {
            const r = e.currentTarget.closest('.crop-overlay-wrap')
            const rw = r?.clientWidth ?? 1
            const rh = r?.clientHeight ?? 1
            onPointerMove(e, rw, rh)
          }}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {!disabled
            ? ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  data-crop-handle
                  className="absolute z-20 -m-1.5 h-3 w-3 rounded-full border-2 border-white bg-sky-500 shadow-md"
                  style={{
                    ...handlePos(mode),
                    cursor: `${mode}-resize`,
                    touchAction: 'none',
                  }}
                  aria-label={`Resize ${mode}`}
                  onPointerDown={(e) => onPointerDownHandle(e, mode)}
                  onPointerMove={(e) => {
                    const r = e.currentTarget.closest('.crop-overlay-wrap')
                    const rw = r?.clientWidth ?? 1
                    const rh = r?.clientHeight ?? 1
                    onPointerMove(e, rw, rh)
                  }}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                />
              ))
            : null}
        </div>
      </div>
    </div>
  )
}

function handlePos(mode) {
  const o = HANDLE / 2
  switch (mode) {
    case 'nw':
      return { left: -o, top: -o }
    case 'n':
      return { left: '50%', top: -o, transform: 'translateX(-50%)' }
    case 'ne':
      return { right: -o, top: -o }
    case 'e':
      return { right: -o, top: '50%', transform: 'translateY(-50%)' }
    case 'se':
      return { right: -o, bottom: -o }
    case 's':
      return { left: '50%', bottom: -o, transform: 'translateX(-50%)' }
    case 'sw':
      return { left: -o, bottom: -o }
    case 'w':
      return { left: -o, top: '50%', transform: 'translateY(-50%)' }
    default:
      return {}
  }
}
