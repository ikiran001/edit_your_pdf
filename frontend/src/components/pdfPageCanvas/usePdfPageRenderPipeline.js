import { useEffect } from 'react'
import { buildTextRuns } from '../../lib/pdfTextRuns.js'
import { computePdfRenderScale } from './renderScale.js'

/**
 * Single pipeline: render page → then extract text. Avoids ready flicker and races where a
 * cancelled render leaves a partial canvas (torn underlines) while getTextContent runs again.
 */
export function usePdfPageRenderPipeline({
  pdfPage,
  pdfCanvasRef,
  metaRef,
  setTextRuns,
  setTextDiag,
  setReady,
}) {
  useEffect(() => {
    if (!pdfPage) return
    let cancelled = false
    const canvas = pdfCanvasRef.current
    if (!canvas) return
    const base = pdfPage.getViewport({ scale: 1 })
    const scale = computePdfRenderScale(base.width, base.height)
    const viewport = pdfPage.getViewport({ scale })
    /* pdfW/pdfH = page size in PDF points. cssW/cssH must match on-screen canvas (set in layout sync), not bitmap px. */
    metaRef.current = {
      ...metaRef.current,
      pdfW: base.width,
      pdfH: base.height,
    }
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) {
      setTextDiag({ count: 0, scanned: true, error: true })
      setReady(true)
      return () => {}
    }
    const task = pdfPage.render({ canvasContext: ctx, viewport })

    task.promise
      .then(() => {
        if (cancelled) return null
        return pdfPage.getTextContent()
      })
      .then((tc) => {
        if (cancelled || tc == null) return
        const runs = buildTextRuns(viewport, tc)
        setTextRuns(runs)
        setTextDiag({ count: runs.length, scanned: true })
        setReady(true)
      })
      .catch((e) => {
        if (cancelled) return
        if (e?.name === 'RenderingCancelledException') return
        console.error(e)
        setTextRuns([])
        setTextDiag({ count: 0, scanned: true, error: true })
        setReady(true)
      })

    return () => {
      cancelled = true
      try {
        task.cancel()
      } catch {
        /* ignore */
      }
      const c = pdfCanvasRef.current
      const cx = c?.getContext?.('2d')
      if (c && cx && c.width > 0 && c.height > 0) {
        cx.setTransform(1, 0, 0, 1, 0, 0)
        cx.fillStyle = '#ffffff'
        cx.fillRect(0, 0, c.width, c.height)
      }
      setReady(false)
      setTextRuns([])
      setTextDiag(null)
    }
  }, [pdfPage, pdfCanvasRef, metaRef, setTextRuns, setTextDiag, setReady])
}
