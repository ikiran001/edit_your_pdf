import { useEffect, useRef, useState } from 'react'
import '../../lib/pdfjs.js'

/**
 * Live preview: first PDF page + HTML overlay matching watermark style (approximate).
 */
export default function WatermarkPreview({
  pdfFile,
  pdfDoc,
  mode,
  text,
  fontSize,
  colorHex,
  opacityPct,
  rotationDeg,
  imageObjectUrl,
  imageScalePreset,
  imageScalePercent,
  position,
}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [layout, setLayout] = useState({ w: 0, h: 0 })
  const [pdfError, setPdfError] = useState(null)

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

  useEffect(() => {
    if (!pdfFile || !pdfDoc || layout.w < 40 || layout.h < 40) return undefined
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const run = async () => {
      setPdfError(null)
      try {
        const page = await pdfDoc.getPage(1)
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
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [pdfFile, pdfDoc, layout.w, layout.h])

  const overlayStyle = () => {
    const op = Math.min(100, Math.max(0, opacityPct)) / 100
    const rot = Number(rotationDeg) || 0
    const base = {
      opacity: op,
      transform: `rotate(${rot}deg)`,
      maxWidth: position === 'tile' ? 'none' : '85%',
      pointerEvents: 'none',
    }
    return base
  }

  const boxClass =
    position === 'tile'
      ? 'absolute inset-0 flex flex-wrap content-center items-center justify-center gap-6 overflow-hidden p-4'
      : 'absolute inset-0 flex items-center justify-center p-3'

  const positionClass = () => {
    if (position === 'tile') return ''
    switch (position) {
      case 'top-left':
        return '!justify-start !items-start'
      case 'top-right':
        return '!justify-end !items-start'
      case 'bottom-left':
        return '!justify-start !items-end'
      case 'bottom-right':
        return '!justify-end !items-end'
      case 'center':
      default:
        return ''
    }
  }

  const textSizePx = () => Math.min(64, Math.max(10, (Number(fontSize) || 48) * 0.35))

  const imageBoxPct = () => {
    if (imageScalePreset === 'small') return 'w-[18%]'
    if (imageScalePreset === 'large') return 'w-[38%]'
    if (imageScalePreset === 'custom') return ''
    return 'w-[28%]'
  }

  const imageCustomStyle =
    imageScalePreset === 'custom'
      ? { width: `${Math.min(60, Math.max(10, Number(imageScalePercent) || 25))}%` }
      : undefined

  if (!pdfFile) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
        Upload a PDF to see preview
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Preview (page 1)</p>
      <div
        ref={wrapRef}
        className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
        style={{ minHeight: 'min(55vh, 420px)', aspectRatio: '3 / 4' }}
      >
        {pdfError ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-red-600 dark:text-red-400">
            {pdfError}
          </div>
        ) : null}
        <div className="flex h-full w-full items-center justify-center p-2">
          <canvas ref={canvasRef} className="max-h-full max-w-full object-contain shadow-sm" aria-hidden />
        </div>
        <div className={`${boxClass} ${positionClass()}`} aria-hidden>
          {mode === 'text' && (text || '').trim() ? (
            position === 'tile' ? (
              Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="whitespace-pre-wrap text-center font-semibold"
                  style={{
                    ...overlayStyle(),
                    color: colorHex || '#64748b',
                    fontSize: `${textSizePx()}px`,
                    lineHeight: 1.2,
                  }}
                >
                  {text.trim()}
                </span>
              ))
            ) : (
              <span
                className="whitespace-pre-wrap text-center font-semibold"
                style={{
                  ...overlayStyle(),
                  color: colorHex || '#64748b',
                  fontSize: `${textSizePx()}px`,
                  lineHeight: 1.2,
                }}
              >
                {text.trim()}
              </span>
            )
          ) : null}
          {mode === 'image' && imageObjectUrl ? (
            position === 'tile' ? (
              Array.from({ length: 8 }).map((_, i) => (
                <img
                  key={i}
                  src={imageObjectUrl}
                  alt=""
                  className={`object-contain ${imageScalePreset === 'custom' ? '' : imageBoxPct()}`}
                  style={{ ...overlayStyle(), ...imageCustomStyle }}
                />
              ))
            ) : (
              <img
                src={imageObjectUrl}
                alt=""
                className={`object-contain ${imageScalePreset === 'custom' ? '' : imageBoxPct()}`}
                style={{ ...overlayStyle(), ...imageCustomStyle }}
              />
            )
          ) : null}
        </div>
      </div>
    </div>
  )
}
