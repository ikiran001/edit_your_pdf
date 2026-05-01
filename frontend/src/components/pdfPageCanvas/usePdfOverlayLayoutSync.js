import { useLayoutEffect } from 'react'

/**
 * Keep the overlay’s CSS box and bitmap size locked to the PDF canvas.
 * Without this, `w-full` / `h-full` on the overlay can diverge from the scaled
 * PDF canvas so pointer events miss the overlay and tools feel “broken”.
 */
export function usePdfOverlayLayoutSync({
  pdfPage,
  ready,
  nativeEdit,
  pdfCanvasRef,
  overlayRef,
  metaRef,
  setCanvasLayout,
  paintOverlay,
}) {
  useLayoutEffect(() => {
    const pdf = pdfCanvasRef.current
    const overlay = overlayRef.current
    if (!pdf || !overlay || !ready) return

    let cancelled = false
    const sync = () => {
      if (cancelled) return
      const cw = pdf.clientWidth
      const ch = pdf.clientHeight
      if (cw < 2 || ch < 2) return
      metaRef.current = {
        ...metaRef.current,
        cssW: cw,
        cssH: ch,
        bmpW: pdf.width || 1,
        bmpH: pdf.height || 1,
      }
      setCanvasLayout({
        cssW: cw,
        cssH: ch,
        bmpW: pdf.width || 1,
        bmpH: pdf.height || 1,
      })
      overlay.style.width = `${cw}px`
      overlay.style.height = `${ch}px`
      overlay.width = pdf.width
      overlay.height = pdf.height
      paintOverlay()
    }

    sync()
    // Flex/grid layout often settles after the first frame; retry so the overlay matches the PDF canvas.
    const id1 = requestAnimationFrame(() => sync())
    let idInner = 0
    const id2 = requestAnimationFrame(() => {
      idInner = requestAnimationFrame(() => sync())
    })
    const ro = new ResizeObserver(() => sync())
    ro.observe(pdf)
    return () => {
      cancelled = true
      cancelAnimationFrame(id1)
      cancelAnimationFrame(id2)
      cancelAnimationFrame(idInner)
      ro.disconnect()
    }
    /* Re-sync when inline edit opens/closes — toolbar reflow / overflow can change CSS vs bitmap mapping for one frame. */
  }, [pdfPage, ready, paintOverlay, nativeEdit, pdfCanvasRef, overlayRef, metaRef, setCanvasLayout])
}
