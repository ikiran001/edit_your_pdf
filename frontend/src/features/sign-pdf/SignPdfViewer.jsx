import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const MIN_N = 0.05
const HANDLE = 28

/**
 * @typedef {{ id: string, pageIndex: number, nx: number, ny: number, nw: number, nh: number }} Placement
 */

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

/** Pick the page row with the largest visible area in the browser viewport (reliable vs IntersectionObserver when several pages peek in). */
function pageIndexWithLargestVisibleArea(pageNodesMap, numPages) {
  let best = 0
  let bestArea = -1
  const vw = window.innerWidth
  const vh = window.innerHeight
  for (let i = 0; i < numPages; i++) {
    const el = pageNodesMap.get(i)
    if (!el) continue
    const r = el.getBoundingClientRect()
    const ix = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0))
    const iy = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))
    const area = ix * iy
    if (area > bestArea) {
      bestArea = area
      best = i
    }
  }
  return best
}

function SignatureBoxOverlay({
  placement,
  previewUrl,
  canvasEl,
  viewport,
  onChange,
  onRemove,
  isSelected,
  onSelect,
  onMoveEnd,
}) {
  const dragRef = useRef(null)

  const toNormDelta = useCallback(
    (dxPx, dyPx) => {
      if (!canvasEl || !viewport) return { dx: 0, dy: 0 }
      const r = canvasEl.getBoundingClientRect()
      const sx = viewport.width / Math.max(r.width, 1)
      const sy = viewport.height / Math.max(r.height, 1)
      return { dx: (dxPx * sx) / viewport.width, dy: (dyPx * sy) / viewport.height }
    },
    [canvasEl, viewport]
  )

  const onPointerDownDrag = (e) => {
    if (e.target.closest('[data-resize-handle]') || e.target.closest('[data-sig-close]')) return
    e.preventDefault()
    onSelect?.(placement.id)
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      kind: 'move',
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: placement.nx,
      oy: placement.ny,
    }
  }

  const onPointerDownResize = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect?.(placement.id)
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      kind: 'resize',
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ow: placement.nw,
      oh: placement.nh,
      ox: placement.nx,
      oy: placement.ny,
    }
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d || d.pid !== e.pointerId) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    const { dx: ndx, dy: ndy } = toNormDelta(dx, dy)

    if (d.kind === 'move') {
      const nw = placement.nw
      const nh = placement.nh
      const nx = clamp(d.ox + ndx, 0, 1 - nw)
      const ny = clamp(d.oy + ndy, 0, 1 - nh)
      onChange({ ...placement, nx, ny })
    } else {
      let nw = clamp(d.ow + ndx, MIN_N, 1 - d.ox)
      let nh = clamp(d.oh + ndy, MIN_N, 1 - d.oy)
      nw = clamp(nw, MIN_N, 1 - placement.nx)
      nh = clamp(nh, MIN_N, 1 - placement.ny)
      onChange({ ...placement, nw, nh })
    }
  }

  const onPointerUp = (e) => {
    const d = dragRef.current
    if (d && d.pid === e.pointerId) {
      if (d.kind === 'move' && onMoveEnd) {
        onMoveEnd(placement, e.clientX, e.clientY)
      }
      dragRef.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div
      className={`pointer-events-auto absolute z-30 border-2 bg-transparent shadow-lg ring-2 ${
        isSelected
          ? 'border-cyan-500 ring-cyan-400/50'
          : 'border-indigo-500 ring-indigo-400/40'
      }`}
      style={{
        left: `${placement.nx * 100}%`,
        top: `${placement.ny * 100}%`,
        width: `${placement.nw * 100}%`,
        height: `${placement.nh * 100}%`,
        cursor: 'move',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDownDrag}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="flex h-full w-full items-center justify-center overflow-hidden bg-transparent p-0.5">
        <img
          src={previewUrl}
          alt=""
          className="max-h-full max-w-full select-none bg-transparent object-contain"
          style={{ background: 'transparent' }}
          draggable={false}
        />
      </div>
      <button
        data-sig-close
        type="button"
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={(ev) => {
          ev.stopPropagation()
          ev.preventDefault()
          onRemove(placement.id)
        }}
        className="absolute -right-1 -top-1 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-zinc-900 text-sm font-bold text-white shadow-md hover:bg-red-600 dark:border-zinc-700"
        aria-label="Remove signature"
      >
        ×
      </button>
      <div
        data-resize-handle
        className="absolute bottom-0 right-0 z-40 flex items-end justify-end rounded-tl bg-white/90 p-1 dark:bg-zinc-900/90"
        style={{ width: HANDLE, height: HANDLE, cursor: 'nwse-resize' }}
        onPointerDown={onPointerDownResize}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="h-3 w-3 rounded-sm border-b-2 border-r-2 border-indigo-600" />
      </div>
    </div>
  )
}

function PdfPageRow({
  pageIndex,
  pdfDoc,
  maxWidth,
  signaturePreviewUrl,
  placements,
  onPlacementChange,
  onRemovePlacement,
  onPlacementMoveEnd,
  registerPageNode,
  registerPageCanvas,
  isFocusPage,
  selectedPlacementId,
  onSelectPlacement,
}) {
  const canvasRef = useRef(null)
  const [canvasForOverlay, setCanvasForOverlay] = useState(null)
  const renderTaskRef = useRef(null)
  const [viewport, setViewport] = useState(null)

  useEffect(() => {
    if (!pdfDoc || !maxWidth) return undefined

    let cancelled = false
    ;(async () => {
      const page = await pdfDoc.getPage(pageIndex + 1)
      if (cancelled) return
      const base = page.getViewport({ scale: 1 })
      const scale = maxWidth / base.width
      const vp = page.getViewport({ scale })
      setViewport(vp)

      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = vp.width
      canvas.height = vp.height

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          /* ignore */
        }
      }
      const task = page.render({ canvasContext: ctx, viewport: vp })
      renderTaskRef.current = task
      try {
        await task.promise
      } catch (e) {
        if (e?.name !== 'RenderingCancelledException') console.warn(e)
      }
    })()

    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          /* ignore */
        }
      }
    }
  }, [pdfDoc, pageIndex, maxWidth])

  const pagePlacements = placements.filter((p) => p.pageIndex === pageIndex)

  return (
    <div
      ref={(el) => registerPageNode(pageIndex, el)}
      className={`relative mx-auto mb-8 w-full max-w-full shadow-md ring-2 transition-shadow dark:ring-zinc-700 ${
        isFocusPage
          ? 'ring-indigo-500 dark:ring-indigo-500'
          : 'ring-zinc-200 dark:ring-zinc-700'
      }`}
      style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined }}
    >
      <div className="relative w-full">
        <canvas
          ref={(el) => {
            canvasRef.current = el
            registerPageCanvas(pageIndex, el)
            setCanvasForOverlay(el)
          }}
          className="sign-pdf-page-canvas block h-auto w-full bg-white dark:bg-zinc-100"
          style={{ verticalAlign: 'top' }}
        />
        {viewport && signaturePreviewUrl && canvasForOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-20">
            <div className="relative h-full w-full min-h-[1px] min-w-[1px]">
              {pagePlacements.map((p) => (
                <SignatureBoxOverlay
                  key={p.id}
                  placement={p}
                  previewUrl={signaturePreviewUrl}
                  canvasEl={canvasForOverlay}
                  viewport={viewport}
                  onChange={onPlacementChange}
                  onRemove={onRemovePlacement}
                  onMoveEnd={onPlacementMoveEnd}
                  isSelected={selectedPlacementId === p.id}
                  onSelect={onSelectPlacement}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <p className="border-t border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        Page {pageIndex + 1}
        {pagePlacements.length > 0 ? ` · ${pagePlacements.length} signature${pagePlacements.length === 1 ? '' : 's'}` : ''}
      </p>
    </div>
  )
}

/**
 * @param {{
 *  file: File,
 *  signaturePreviewUrl: string | null,
 *  placements: Placement[],
 *  setPlacements: (p: Placement[] | ((prev: Placement[]) => Placement[])) => void,
 *  focusedPageIndex: number,
 *  setFocusedPageIndex: (n: number) => void,
 *  selectedPlacementId: string | null,
 *  onSelectPlacement: (id: string | null) => void,
 * }} props
 */
const SignPdfViewer = forwardRef(function SignPdfViewer(
  {
    file,
    signaturePreviewUrl,
    placements,
    setPlacements,
    focusedPageIndex,
    setFocusedPageIndex,
    selectedPlacementId,
    onSelectPlacement,
  },
  ref
) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [maxWidth, setMaxWidth] = useState(560)
  const [loadErr, setLoadErr] = useState(null)
  const containerRef = useRef(null)
  const pageNodesRef = useRef(new Map())
  const pageCanvasRef = useRef(new Map())

  useEffect(() => {
    if (!file) {
      return undefined
    }
    let cancelled = false
    const holder = { pdf: null }
    ;(async () => {
      try {
        const buf = await file.arrayBuffer()
        const data = new Uint8Array(buf)
        const pdf = await getDocument({ data }).promise
        holder.pdf = pdf
        if (cancelled) {
          await pdf.destroy().catch(() => {})
          return
        }
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setLoadErr(null)
      } catch (e) {
        if (!cancelled) setLoadErr(e?.message || 'Could not load PDF')
      }
    })()
    return () => {
      cancelled = true
      holder.pdf?.destroy().catch(() => {})
    }
  }, [file])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (w && w > 80) setMaxWidth(Math.min(920, Math.floor(w)))
    })
    ro.observe(el)
    const w = el.getBoundingClientRect().width
    if (w > 80) setMaxWidth(Math.min(920, Math.floor(w)))
    return () => ro.disconnect()
  }, [pdfDoc])

  const updateFocusFromViewport = useCallback(() => {
    if (numPages <= 0) return
    const next = pageIndexWithLargestVisibleArea(pageNodesRef.current, numPages)
    setFocusedPageIndex(next)
  }, [numPages, setFocusedPageIndex])

  useEffect(() => {
    if (numPages === 0) return undefined
    updateFocusFromViewport()
    window.addEventListener('scroll', updateFocusFromViewport, true)
    window.addEventListener('resize', updateFocusFromViewport)
    return () => {
      window.removeEventListener('scroll', updateFocusFromViewport, true)
      window.removeEventListener('resize', updateFocusFromViewport)
    }
  }, [numPages, updateFocusFromViewport])

  const registerPageNode = useCallback((pageIndex, el) => {
    if (el) {
      el.dataset.pageIndex = String(pageIndex)
      pageNodesRef.current.set(pageIndex, el)
    } else {
      pageNodesRef.current.delete(pageIndex)
    }
  }, [])

  const registerPageCanvas = useCallback((pageIndex, el) => {
    if (el) pageCanvasRef.current.set(pageIndex, el)
    else pageCanvasRef.current.delete(pageIndex)
  }, [])

  const onPlacementChange = useCallback(
    (next) => {
      setPlacements((prev) => prev.map((p) => (p.id === next.id ? next : p)))
    },
    [setPlacements]
  )

  const onRemovePlacement = useCallback(
    (id) => {
      setPlacements((prev) => prev.filter((p) => p.id !== id))
      onSelectPlacement((prevSel) => (prevSel === id ? null : prevSel))
    },
    [setPlacements, onSelectPlacement]
  )

  /** After a move, if pointer released over another page’s canvas, reparent and rebase position. */
  const onPlacementMoveEnd = useCallback(
    (placement, clientX, clientY) => {
      let targetPage = null
      for (let i = 0; i < numPages; i++) {
        const canvas = pageCanvasRef.current.get(i)
        if (!canvas) continue
        const r = canvas.getBoundingClientRect()
        if (
          clientX >= r.left &&
          clientX <= r.right &&
          clientY >= r.top &&
          clientY <= r.bottom
        ) {
          targetPage = i
          break
        }
      }
      if (targetPage === null || targetPage === placement.pageIndex) return

      const canvas = pageCanvasRef.current.get(targetPage)
      if (!canvas) return
      const r = canvas.getBoundingClientRect()
      const nw = placement.nw
      const nh = placement.nh
      let nx = (clientX - r.left) / Math.max(r.width, 1) - nw / 2
      let ny = (clientY - r.top) / Math.max(r.height, 1) - nh / 2
      nx = clamp(nx, 0, 1 - nw)
      ny = clamp(ny, 0, 1 - nh)

      setPlacements((prev) =>
        prev.map((p) => (p.id === placement.id ? { ...p, pageIndex: targetPage, nx, ny } : p))
      )
    },
    [numPages, setPlacements]
  )

  const getViewportForPage = useCallback(
    async (pageIndex) => {
      if (!pdfDoc) return null
      const page = await pdfDoc.getPage(pageIndex + 1)
      const base = page.getViewport({ scale: 1 })
      const scale = maxWidth / base.width
      return page.getViewport({ scale })
    },
    [pdfDoc, maxWidth]
  )

  useImperativeHandle(ref, () => ({ getViewportForPage, maxWidth }), [getViewportForPage, maxWidth])

  if (loadErr) {
    return <p className="text-sm text-red-600 dark:text-red-400">{loadErr}</p>
  }

  if (!pdfDoc) {
    return <p className="text-sm text-zinc-500">Loading preview…</p>
  }

  return (
    <div ref={containerRef} className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Add / paste on page:</span>
        {Array.from({ length: numPages }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setFocusedPageIndex(i)
              pageNodesRef.current.get(i)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
            className={`min-w-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              focusedPageIndex === i
                ? 'bg-indigo-600 text-white shadow-md'
                : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {Array.from({ length: numPages }, (_, i) => (
        <PdfPageRow
          key={i}
          pageIndex={i}
          pdfDoc={pdfDoc}
          maxWidth={maxWidth}
          signaturePreviewUrl={signaturePreviewUrl}
          placements={placements}
          onPlacementChange={onPlacementChange}
          onRemovePlacement={onRemovePlacement}
          onPlacementMoveEnd={onPlacementMoveEnd}
          registerPageNode={registerPageNode}
          registerPageCanvas={registerPageCanvas}
          isFocusPage={focusedPageIndex === i}
          selectedPlacementId={selectedPlacementId}
          onSelectPlacement={onSelectPlacement}
        />
      ))}
      <p className="text-center text-xs text-zinc-400">
        New signatures and paste go on the highlighted page (ring). Scroll updates the active page; you can also pick a
        page above. Drag a signature and release over another page to move it there.
      </p>
    </div>
  )
})

SignPdfViewer.displayName = 'SignPdfViewer'

export default SignPdfViewer
