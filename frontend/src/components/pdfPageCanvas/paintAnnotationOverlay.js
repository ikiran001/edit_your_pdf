import { hexToRgba } from './helpers.js'

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {unknown[]} items
 * @param {{ nx: number, ny: number }[] | null | undefined} draftLinePts
 * @param {{ x0: number, y0: number, x1: number, y1: number, mode?: string } | null | undefined} draftBox
 */
export function paintAnnotationItemsOnContext(ctx, w, h, items, draftLinePts, draftBox) {
  ctx.clearRect(0, 0, w, h)

  const drawItem = (it) => {
    switch (it.type) {
      case 'draw': {
        const pts = it.points || []
        if (pts.length < 2) break
        ctx.strokeStyle = it.color || '#111827'
        ctx.lineWidth = Math.max(1, it.lineWidthCss ?? 2)
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(pts[0].nx * w, pts[0].ny * h)
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].nx * w, pts[i].ny * h)
        }
        ctx.stroke()
        break
      }
      case 'highlight': {
        const hiOp = Number(it.opacity)
        const op = Number.isFinite(hiOp) ? Math.min(1, Math.max(0.05, hiOp)) : 0.35
        ctx.fillStyle = hexToRgba(it.color, op)
        ctx.fillRect(it.x * w, it.y * h, it.w * w, it.h * h)
        break
      }
      case 'rect': {
        ctx.strokeStyle = it.strokeColor || '#2563eb'
        ctx.lineWidth = Math.max(1, it.lineWidthCss ?? 2)
        ctx.strokeRect(it.x * w, it.y * h, it.w * w, it.h * h)
        break
      }
      case 'text': {
        ctx.fillStyle = it.color || '#111827'
        const fs = Math.max(10, it.fontSizeCss ?? 14)
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.textBaseline = 'top'
        ctx.fillText(it.text || '', it.x * w, it.y * h)
        break
      }
      default:
        break
    }
  }

  for (const it of items) {
    if (it.type === 'text') continue
    if (it.rasterizedInPdf) continue
    drawItem(it)
  }

  if (draftLinePts && draftLinePts.length >= 2) {
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(draftLinePts[0].nx * w, draftLinePts[0].ny * h)
    for (let i = 1; i < draftLinePts.length; i++) {
      ctx.lineTo(draftLinePts[i].nx * w, draftLinePts[i].ny * h)
    }
    ctx.stroke()
  }

  if (draftBox) {
    const x = Math.min(draftBox.x0, draftBox.x1) * w
    const y = Math.min(draftBox.y0, draftBox.y1) * h
    const rw = Math.abs(draftBox.x1 - draftBox.x0) * w
    const rh = Math.abs(draftBox.y1 - draftBox.y0) * h
    if (draftBox.mode === 'highlight') {
      ctx.fillStyle = hexToRgba('#facc15', 0.35)
      ctx.fillRect(x, y, rw, rh)
    } else {
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, rw, rh)
    }
  }
}
