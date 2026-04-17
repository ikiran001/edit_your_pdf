import { useCallback, useEffect, useRef, useState } from 'react'

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

function clientToNorm(e, wrap) {
  const r = wrap.getBoundingClientRect()
  if (r.width < 1 || r.height < 1) return { nx: 0, ny: 0 }
  return {
    nx: clamp01((e.clientX - r.left) / r.width),
    ny: clamp01((e.clientY - r.top) / r.height),
  }
}

/**
 * Full-screen crop step after capture. `norm` is top-left origin, 0–1 relative to image.
 * @param {{ open: boolean, sourceCanvas: HTMLCanvasElement | null, onCancel: () => void, onApply: (norm: { nx: number, ny: number, nw: number, nh: number }) => void | Promise<void> }} props
 */
export default function ScanCropModal({ open, sourceCanvas, onCancel, onApply }) {
  const wrapRef = useRef(null)
  const displayRef = useRef(null)
  const [norm, setNorm] = useState({ nx: 0, ny: 0, nw: 1, nh: 1 })
  const [applying, setApplying] = useState(false)
  const dragRef = useRef(null)
  const normRef = useRef(norm)
  normRef.current = norm

  useEffect(() => {
    if (!open || !sourceCanvas) return
    setNorm({ nx: 0, ny: 0, nw: 1, nh: 1 })
    setApplying(false)
    dragRef.current = null
    const c = displayRef.current
    if (c) {
      c.width = sourceCanvas.width
      c.height = sourceCanvas.height
      const ctx = c.getContext('2d')
      if (ctx) ctx.drawImage(sourceCanvas, 0, 0)
    }
  }, [open, sourceCanvas])

  useEffect(() => {
    if (!open) return undefined
    const end = () => {
      dragRef.current = null
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  const onOverlayPointerDown = useCallback((e) => {
    if (!wrapRef.current || e.button !== 0) return
    const n = normRef.current
    const wrap = wrapRef.current
    const r = wrap.getBoundingClientRect()
    const { nx: mx, ny: my } = clientToNorm(e, wrap)
    const brx = r.left + (n.nx + n.nw) * r.width
    const bry = r.top + (n.ny + n.nh) * r.height
    const brHit = Math.hypot(e.clientX - brx, e.clientY - bry) < 44
    const inBox =
      mx >= n.nx - 0.01 &&
      mx <= n.nx + n.nw + 0.01 &&
      my >= n.ny - 0.01 &&
      my <= n.ny + n.nh + 0.01
    if (brHit) {
      dragRef.current = { kind: 'br', startNorm: { ...n }, startPtr: { mx, my } }
    } else if (inBox) {
      dragRef.current = { kind: 'move', startNorm: { ...n }, startPtr: { mx, my } }
    } else {
      return
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const onOverlayPointerMove = useCallback(
    (e) => {
      const d = dragRef.current
      if (!d || !wrapRef.current) return
      const { nx: mx, ny: my } = clientToNorm(e, wrapRef.current)
      if (d.kind === 'move') {
        const dnx = mx - d.startPtr.mx
        const dny = my - d.startPtr.my
        const nw = d.startNorm.nw
        const nh = d.startNorm.nh
        let nx = d.startNorm.nx + dnx
        let ny = d.startNorm.ny + dny
        nx = clamp01(nx)
        ny = clamp01(ny)
        if (nx + nw > 1) nx = 1 - nw
        if (ny + nh > 1) ny = 1 - nh
        if (nx < 0) nx = 0
        if (ny < 0) ny = 0
        setNorm({ nx, ny, nw, nh })
      } else if (d.kind === 'br') {
        let nw = d.startNorm.nw + (mx - d.startPtr.mx)
        let nh = d.startNorm.nh + (my - d.startPtr.my)
        nw = Math.max(0.06, Math.min(1 - d.startNorm.nx, nw))
        nh = Math.max(0.06, Math.min(1 - d.startNorm.ny, nh))
        setNorm({ nx: d.startNorm.nx, ny: d.startNorm.ny, nw, nh })
      }
    },
    []
  )

  const onOverlayPointerUp = useCallback((e) => {
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const handleApply = async () => {
    setApplying(true)
    try {
      await onApply(norm)
    } finally {
      setApplying(false)
    }
  }

  if (!open || !sourceCanvas) return null

  const { nx, ny, nw, nh } = norm
  const iw = sourceCanvas.width
  const ih = sourceCanvas.height
  const cropPxW = Math.round(nw * iw)
  const cropPxH = Math.round(nh * ih)

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-crop-title"
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <h2 id="scan-crop-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Crop page
        </h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-200">
            1 Capture
          </span>
          <span className="text-zinc-400">→</span>
          <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-white dark:bg-indigo-500">
            2 Crop
          </span>
          <span className="text-zinc-400">→</span>
          <span className="rounded-md bg-zinc-200 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            3 Review
          </span>
        </p>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Drag the frame to move it. Drag the bottom-right corner to resize (large touch target). Then
          apply — auto-trim and contrast run after this crop.
        </p>

        <div className="mt-4 flex justify-center">
          <div ref={wrapRef} className="relative inline-block max-w-full">
            <canvas
              ref={displayRef}
              className="pointer-events-none block max-h-[min(70vh,560px)] max-w-full bg-zinc-900/20"
            />
            <div
              className="absolute inset-0 touch-none"
              onPointerDown={onOverlayPointerDown}
              onPointerMove={onOverlayPointerMove}
              onPointerUp={onOverlayPointerUp}
              onPointerCancel={onOverlayPointerUp}
            >
              {/* dim outside crop */}
              <div
                className="pointer-events-none absolute bg-black/45"
                style={{ left: 0, top: 0, width: '100%', height: `${ny * 100}%` }}
              />
              <div
                className="pointer-events-none absolute bg-black/45"
                style={{
                  left: 0,
                  top: `${(ny + nh) * 100}%`,
                  width: '100%',
                  height: `${(1 - ny - nh) * 100}%`,
                }}
              />
              <div
                className="pointer-events-none absolute bg-black/45"
                style={{
                  left: 0,
                  top: `${ny * 100}%`,
                  width: `${nx * 100}%`,
                  height: `${nh * 100}%`,
                }}
              />
              <div
                className="pointer-events-none absolute bg-black/45"
                style={{
                  left: `${(nx + nw) * 100}%`,
                  top: `${ny * 100}%`,
                  width: `${(1 - nx - nw) * 100}%`,
                  height: `${nh * 100}%`,
                }}
              />
              {/* crop box */}
              <div
                className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
                style={{
                  left: `${nx * 100}%`,
                  top: `${ny * 100}%`,
                  width: `${nw * 100}%`,
                  height: `${nh * 100}%`,
                }}
              >
                <div
                  className="absolute bottom-0 right-0 h-5 w-5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-sm border-2 border-white bg-indigo-600 shadow"
                  title="Resize (corner has a large touch target)"
                />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
          Crop area: {Math.round(nw * 100)}% × {Math.round(nh * 100)}% of frame · about {cropPxW} ×{' '}
          {cropPxH}px
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={applying}
              onClick={() => setNorm({ nx: 0, ny: 0, nw: 1, nh: 1 })}
              className="fx-focus-ring rounded-lg border border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Reset to full frame
            </button>
            <button
              type="button"
              disabled={applying}
              onClick={onCancel}
              className="fx-focus-ring rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
          <button
            type="button"
            disabled={applying}
            onClick={() => void handleApply()}
            className="fx-focus-ring min-h-11 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {applying ? 'Applying…' : 'Apply & add page'}
          </button>
        </div>
      </div>
    </div>
  )
}
