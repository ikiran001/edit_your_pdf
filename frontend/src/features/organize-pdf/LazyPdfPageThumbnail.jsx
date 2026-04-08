import { useEffect, useRef, useState } from 'react'

/**
 * Renders a PDF page into the preview box at a resolution that matches the on-screen size (sharp, readable).
 * @param {import('pdfjs-dist').PDFDocumentProxy | null} pdfDoc
 * @param {number} pageIndex1Based
 * @param {number} extraRotation — user-applied clockwise degrees (multiple of 90)
 */
export default function LazyPdfPageThumbnail({ pdfDoc, pageIndex1Based, extraRotation = 0, className = '' }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const visibleRef = useRef(false)
  const lastSignatureRef = useRef('')
  const debounceRef = useRef(0)
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    const el = wrapRef.current
    if (!el || !pdfDoc) return undefined

    let cancelled = false

    const render = async () => {
      if (!visibleRef.current || cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return

      const doc = pdfDoc
      const p1 = pageIndex1Based
      const ex = extraRotation
      if (!doc) return

      const cssW = el.clientWidth
      const cssH = el.clientHeight
      if (cssW < 24 || cssH < 24) return

      try {
        const page = await doc.getPage(p1)
        const baseRot = page.rotate || 0
        const rot = ((baseRot + ex) % 360) + 360
        const rotation = rot % 360

        const unitVp = page.getViewport({ scale: 1, rotation })
        const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
        const budgetW = cssW * dpr
        const budgetH = cssH * dpr
        const scaleW = budgetW / unitVp.width
        const scaleH = budgetH / unitVp.height
        const scale = Math.min(scaleW, scaleH, 3)

        const vp = page.getViewport({ scale, rotation })
        const signature = `${p1}-${rotation}-${Math.round(vp.width)}x${Math.round(vp.height)}`
        if (lastSignatureRef.current === signature) {
          setStatus('done')
          return
        }

        setStatus('loading')

        const ctx = canvas.getContext('2d')
        if (!ctx || cancelled) return

        const w = Math.max(1, Math.floor(vp.width))
        const h = Math.max(1, Math.floor(vp.height))
        canvas.width = w
        canvas.height = h
        canvas.style.width = `${w / dpr}px`
        canvas.style.height = `${h / dpr}px`

        await page.render({ canvasContext: ctx, viewport: vp }).promise
        if (!cancelled) {
          lastSignatureRef.current = signature
          setStatus('done')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    const scheduleRender = () => {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        render()
      }, 64)
    }

    lastSignatureRef.current = ''

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting)
        visibleRef.current = hit
        if (hit) scheduleRender()
      },
      { root: null, rootMargin: '220px', threshold: 0.02 }
    )
    io.observe(el)

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (visibleRef.current) scheduleRender()
          })
        : null
    ro?.observe(el)

    return () => {
      cancelled = true
      window.clearTimeout(debounceRef.current)
      io.disconnect()
      ro?.disconnect()
    }
  }, [pdfDoc, pageIndex1Based, extraRotation])

  return (
    <div
      ref={wrapRef}
      className={`relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800/80 ${className}`}
      style={{ aspectRatio: '8.5 / 11', minHeight: 'clamp(220px, 48vw, 400px)' }}
    >
      <canvas
        ref={canvasRef}
        className={`max-h-full max-w-full object-contain ${status === 'done' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
        aria-hidden
      />
      {status === 'idle' || status === 'loading' ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent dark:border-cyan-400" />
        </div>
      ) : null}
      {status === 'error' ? (
        <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-[10px] text-zinc-500 dark:text-zinc-400">
          Preview unavailable
        </span>
      ) : null}
    </div>
  )
}
