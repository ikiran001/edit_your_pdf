import { useEffect, useRef, useState } from 'react'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PDFDocument } from 'pdf-lib'
import '../../lib/pdfjs.js'
import { applyWatermarkToPdf } from '../../lib/watermarkPdfCore.js'

/**
 * WYSIWYG preview: applies the real watermark to a cached 1-page copy of the PDF
 * (same `applyWatermarkToPdf` used for the download) and renders that page with
 * pdf.js. The preview is therefore pixel-identical to the exported output — no
 * approximate HTML overlay, so font size and tile density always match.
 */
export default function WatermarkPreview({
  pdfFile,
  pdfBytes,
  mode,
  text,
  fontSize,
  colorHex,
  opacityPct,
  rotationDeg,
  imageBytes,
  imageKind,
  imageScalePreset,
  imageScalePercent,
  position,
}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [layout, setLayout] = useState({ w: 0, h: 0 })
  const [onePageBytes, setOnePageBytes] = useState(null)
  const [pdfError, setPdfError] = useState(null)
  const [rendering, setRendering] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setLayout({ w: Math.floor(r.width), h: Math.floor(r.height) })
    })
    ro.observe(el)
    const r = el.getBoundingClientRect()
    setLayout({ w: Math.floor(r.width), h: Math.floor(r.height) })
    return () => ro.disconnect()
  }, [pdfFile])

  /* Extract page 1 into a tiny standalone PDF once per file, so re-applying the
     watermark on every slider/keystroke stays fast even for huge documents. */
  useEffect(() => {
    if (!pdfBytes?.length) {
      setOnePageBytes(null)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
        const out = await PDFDocument.create()
        const [p] = await out.copyPages(src, [0])
        out.addPage(p)
        const bytes = await out.save({ useObjectStreams: false })
        if (!cancelled) setOnePageBytes(bytes)
      } catch (e) {
        if (!cancelled) setPdfError(e?.message || 'Preview failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pdfBytes])

  useEffect(() => {
    if (!onePageBytes?.length || layout.w < 40 || layout.h < 40) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let cancelled = false
    let doc = null
    const timer = window.setTimeout(async () => {
      setRendering(true)
      setPdfError(null)
      try {
        /* Watermark only when the config is complete; otherwise show the clean page. */
        const hasText = mode === 'text' && (text || '').trim().length > 0
        const hasImage = mode === 'image' && imageBytes?.length
        let bytes = onePageBytes
        if (hasText || hasImage) {
          bytes = await applyWatermarkToPdf(onePageBytes, {
            mode,
            text,
            fontSize,
            colorHex,
            opacityPct,
            rotationDeg,
            imageBytes: mode === 'image' ? imageBytes : undefined,
            imageKind: mode === 'image' ? imageKind : undefined,
            imageScalePreset,
            imageScalePercent,
            position,
            pageScope: 'all',
            pageRangeInput: '',
          })
        }
        if (cancelled) return
        doc = await getDocument({ data: bytes.slice() }).promise
        if (cancelled) {
          doc.destroy()
          return
        }
        const page = await doc.getPage(1)
        const base = page.getViewport({ scale: 1 })
        const scale = Math.min(layout.w / base.width, layout.h / base.height, 2)
        const vp = page.getViewport({ scale })
        const ctx = canvas.getContext('2d')
        if (!ctx || cancelled) return
        canvas.width = Math.floor(vp.width)
        canvas.height = Math.floor(vp.height)
        await page.render({ canvasContext: ctx, viewport: vp }).promise
      } catch (e) {
        if (!cancelled) setPdfError(e?.message || 'Preview failed')
      } finally {
        if (!cancelled) setRendering(false)
        if (doc) doc.destroy()
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    onePageBytes,
    layout.w,
    layout.h,
    mode,
    text,
    fontSize,
    colorHex,
    opacityPct,
    rotationDeg,
    imageBytes,
    imageKind,
    imageScalePreset,
    imageScalePercent,
    position,
  ])

  if (!pdfFile) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
        Upload a PDF to see preview
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Preview (page 1) — matches the downloaded file
      </p>
      <div
        ref={wrapRef}
        className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
        style={{ minHeight: 'min(55vh, 420px)', aspectRatio: '3 / 4' }}
      >
        {pdfError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4 text-center text-xs text-red-600 dark:text-red-400">
            {pdfError}
          </div>
        ) : null}
        {rendering ? (
          <div className="absolute right-2 top-2 z-10 rounded-full bg-zinc-900/60 px-2 py-0.5 text-[10px] font-medium text-white">
            Updating…
          </div>
        ) : null}
        <div className="flex h-full w-full items-center justify-center p-2">
          <canvas ref={canvasRef} className="max-h-full max-w-full object-contain shadow-sm" aria-hidden />
        </div>
      </div>
    </div>
  )
}
