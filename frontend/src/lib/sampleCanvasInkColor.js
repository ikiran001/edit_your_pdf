/**
 * Approximate text ink color from the rendered PDF canvas (pdf.js does not expose fill color per glyph).
 *
 * Anti-aliased glyphs blend with white; averaging *all* dark pixels yields a washed-out / faded RGB.
 * We average only the **darkest** pixels in the patch (core ink + inner edges) so the hex matches
 * perceived text darkness much closer to the original.
 */
export function sampleInkColorHex(canvas, cx, cy) {
  if (!canvas?.width) return null
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const w = canvas.width
  const h = canvas.height
  const ix = Math.max(0, Math.min(w - 1, Math.floor(cx)))
  const iy = Math.max(0, Math.min(h - 1, Math.floor(cy)))
  const half = 5
  const x0 = Math.max(0, ix - half)
  const y0 = Math.max(0, iy - half)
  const rw = Math.min(w, ix + half + 1) - x0
  const rh = Math.min(h, iy + half + 1) - y0
  if (rw < 1 || rh < 1) return null

  let data
  try {
    data = ctx.getImageData(x0, y0, rw, rh).data
  } catch {
    return null
  }

  /** @type {{ r: number; g: number; b: number; lum: number }[]} */
  const candidates = []
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (lum < 0.97) {
      candidates.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
        lum,
      })
    }
  }

  if (candidates.length === 0) {
    const i = (iy - y0) * rw * 4 + (ix - x0) * 4
    if (i >= 0 && i + 2 < data.length) {
      return rgbToHex(data[i], data[i + 1], data[i + 2])
    }
    return '#000000'
  }

  candidates.sort((a, b) => a.lum - b.lum)
  const darkestFrac = 0.38
  const nTake = Math.max(3, Math.ceil(candidates.length * darkestFrac))
  const darkest = candidates.slice(0, nTake)

  let rr = 0
  let gg = 0
  let bb = 0
  for (const p of darkest) {
    rr += p.r
    gg += p.g
    bb += p.b
  }
  const n = darkest.length
  return rgbToHex(rr / n, gg / n, bb / n)
}

function rgbToHex(r, g, b) {
  const q = (v) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
  return `#${q(r)}${q(g)}${q(b)}`
}
