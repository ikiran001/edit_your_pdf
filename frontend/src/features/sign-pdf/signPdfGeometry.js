/**
 * Map a rectangle in pdf.js viewport (canvas) pixels to pdf-lib drawImage args.
 * Viewport origin is top-left of the rendered page; PDF user space uses bottom-left for drawImage.
 */
export function viewportRectToPdfDrawImage(viewport, vx, vy, sw, sh) {
  const corners = [
    viewport.convertToPdfPoint(vx, vy),
    viewport.convertToPdfPoint(vx + sw, vy),
    viewport.convertToPdfPoint(vx, vy + sh),
    viewport.convertToPdfPoint(vx + sw, vy + sh),
  ]
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  }
}

/** Raw base64 (no data: prefix) for API payloads. */
export function uint8ToBase64(u8) {
  if (!u8?.length) return ''
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + chunk, u8.length)))
  }
  return btoa(binary)
}

/** Small PNGs only (signatures); avoids blob URL lifecycle in React. */
export function uint8ToDataUrlPng(u8) {
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + chunk, u8.length)))
  }
  return `data:image/png;base64,${btoa(binary)}`
}

export function clientToCanvasPoint(canvas, clientX, clientY) {
  const r = canvas.getBoundingClientRect()
  const sx = canvas.width / Math.max(r.width, 1)
  const sy = canvas.height / Math.max(r.height, 1)
  return {
    x: (clientX - r.left) * sx,
    y: (clientY - r.top) * sy,
  }
}

export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * Default normalized box (nx,ny,nw,nh) for a signature PNG on a page viewport.
 * Keeps signature aspect ratio; does not span full page width.
 */
export async function defaultPlacementForPng(pngBytes, getViewportForPage, pageIndex) {
  let nw = 0.2
  let nh = 0.07
  try {
    const bmp = await createImageBitmap(new Blob([pngBytes], { type: 'image/png' }))
    const sigAspect = bmp.width / Math.max(bmp.height, 1)
    const vp = await getViewportForPage?.(pageIndex)
    if (vp) {
      const pageAspect = vp.width / Math.max(vp.height, 1)
      nh = 0.09
      nw = (nh * sigAspect) / pageAspect
      nw = clamp(nw, 0.12, 0.36)
      nh = clamp(nh, 0.045, 0.18)
    }
  } catch {
    /* use defaults */
  }
  const nx = clamp(0.5 - nw / 2, 0, 1 - nw)
  const ny = clamp(0.74 - nh / 2, 0, 1 - nh)
  return { nx, ny, nw, nh }
}

/** True if canvas has visible ink (opaque/semi-opaque non-white pixels; skips transparent background). */
export function canvasHasInk(ctx, w, h) {
  if (!w || !h) return false
  const pix = ctx.getImageData(0, 0, w, h).data
  for (let i = 0; i < pix.length; i += 4) {
    const a = pix[i + 3]
    if (a < 12) continue
    const r = pix[i]
    const g = pix[i + 1]
    const b = pix[i + 2]
    if (r < 250 || g < 250 || b < 250) return true
  }
  return false
}
