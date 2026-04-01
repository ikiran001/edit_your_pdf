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

function SignatureBoxOverlay({
  placement,
  previewUrl,
  canvasEl,
  viewport,
  onChange,
  onRemove,
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
      className="pointer-events-auto absolute z-30 border-2 border-indigo-500 bg-transparent shadow-lg ring-2 ring-indigo-400/40"
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
  registerPageNode,
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
      className="relative mx-auto mb-8 w-full max-w-full shadow-md ring-1 ring-zinc-200 dark:ring-zinc-700"
      style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined }}
    >
      <div className="relative w-full">
        <canvas
          ref={(el) => {
            canvasRef.current = el
            setCanvasForOverlay(el)
          }}
          className="block h-auto w-full bg-white dark:bg-zinc-100"
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
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <p className="border-t border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        Page {pageIndex + 1}
      </p>
    </div>
  )
}

/**
 * @param {{
 *  file: File,
 *  signaturePng: Uint8Array | null,
 *  placements: Placement[],
 *  setPlacements: (p: Placement[] | ((prev: Placement[]) => Placement[])) => void,
 *  focusedPageIndex: number,
 *  setFocusedPageIndex: (n: number) => void,
 * }} props
 */
const SignPdfViewer = forwardRef(function SignPdfViewer(
  { file, signaturePreviewUrl, placements, setPlacements, focusedPageIndex, setFocusedPageIndex },
  ref
) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [maxWidth, setMaxWidth] = useState(560)
  const [loadErr, setLoadErr] = useState(null)
  const containerRef = useRef(null)
  const pageNodesRef = useRef(new Map())

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

  useEffect(() => {
    const nodes = pageNodesRef.current
    if (nodes.size === 0 || numPages === 0) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0.15)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (hit?.target?.dataset?.pageIndex != null) {
          setFocusedPageIndex(Number(hit.target.dataset.pageIndex))
        }
      },
      { threshold: [0.1, 0.25, 0.5] }
    )
    for (let i = 0; i < numPages; i++) {
      const n = nodes.get(i)
      if (n) io.observe(n)
    }
    return () => io.disconnect()
  }, [numPages, setFocusedPageIndex])

  const registerPageNode = useCallback((pageIndex, el) => {
    if (el) {
      el.dataset.pageIndex = String(pageIndex)
      pageNodesRef.current.set(pageIndex, el)
    } else {
      pageNodesRef.current.delete(pageIndex)
    }
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
    },
    [setPlacements]
  )

  /** Same viewport math as canvas render — for embedding coordinates */
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
          registerPageNode={registerPageNode}
        />
      ))}
      <p className="text-center text-xs text-zinc-400">Focused page for new signatures: {focusedPageIndex + 1}</p>
    </div>
  )
})

SignPdfViewer.displayName = 'SignPdfViewer'

export default SignPdfViewer
