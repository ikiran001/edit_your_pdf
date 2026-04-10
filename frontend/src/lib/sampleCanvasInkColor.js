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

function chromaRgb(p) {
  const m = Math.max(p.r, p.g, p.b) / 255
  const n = Math.min(p.r, p.g, p.b) / 255
  return m - n
}

/**
 * Sample fill behind text in a PDF canvas rect (bitmap coords) so server-side erase rectangles
 * can match table headers / colored cells instead of always using white.
 *
 * - On **white** pages, anti-aliased glyphs add mid-grey pixels; we prefer near-white corners / high
 *   luminance thresholds so masks are not visibly grey.
 * - On **tinted** cells (gold headers, etc.), fill luminance is often 0.5–0.85, so those strict
 *   rules never fire and we must sample the **border strip** (away from glyph cores) and distinguish
 *   “mostly white margin” from “solid fill” using how much of the border is very bright.
 */
export function sampleBackgroundColorHex(canvas, left, top, width, height) {
  if (!canvas?.width || width < 1 || height < 1) return '#ffffff'
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return '#ffffff'

  const x0 = Math.max(0, Math.floor(left))
  const y0 = Math.max(0, Math.floor(top))
  const x1 = Math.min(canvas.width, Math.ceil(left + width))
  const y1 = Math.min(canvas.height, Math.ceil(top + height))
  const rw = x1 - x0
  const rh = y1 - y0
  if (rw < 1 || rh < 1) return '#ffffff'

  let data
  try {
    data = ctx.getImageData(x0, y0, rw, rh).data
  } catch {
    return '#ffffff'
  }

  const pixelAt = (row, col) => {
    const i = (row * rw + col) * 4
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return { r: data[i], g: data[i + 1], b: data[i + 2], lum }
  }

  const avg = (arr) => {
    if (!arr.length) return null
    let rr = 0
    let gg = 0
    let bb = 0
    for (const p of arr) {
      rr += p.r
      gg += p.g
      bb += p.b
    }
    const n = arr.length
    return rgbToHex(rr / n, gg / n, bb / n)
  }

  const inset = Math.max(0, Math.min(2, Math.floor(Math.min(rw, rh) * 0.06)))
  const cs = Math.max(2, Math.min(8, Math.floor(Math.min(rw, rh) * 0.28)))
  let bestCornerHex = null
  let bestCornerMeanLum = -1
  for (const [sr, sc] of [
    [inset, inset],
    [inset, Math.max(inset, rh - cs)],
    [Math.max(inset, rw - cs), inset],
    [Math.max(inset, rw - cs), Math.max(inset, rh - cs)],
  ]) {
    /** @type {{ r: number; g: number; b: number; lum: number }[]} */
    const pts = []
    for (let dr = 0; dr < cs; dr++) {
      for (let dc = 0; dc < cs; dc++) {
        const row = sr + dr
        const col = sc + dc
        if (row < 0 || col < 0 || row >= rh || col >= rw) continue
        const p = pixelAt(row, col)
        if (p.lum >= 0.88) pts.push(p)
      }
    }
    if (pts.length < 2) continue
    let ml = 0
    for (const p of pts) ml += p.lum
    ml /= pts.length
    if (ml > bestCornerMeanLum) {
      bestCornerMeanLum = ml
      bestCornerHex = avg(pts)
    }
  }
  if (bestCornerHex && bestCornerMeanLum >= 0.86) return bestCornerHex

  const borderW = Math.max(1, Math.min(4, Math.floor(Math.min(rw, rh) * 0.18)))
  const bi0 = borderW
  const bi1 = rw - borderW
  const bj0 = borderW
  const bj1 = rh - borderW
  /** @type {{ r: number; g: number; b: number; lum: number }[]} */
  const borderAll = []
  for (let row = 0; row < rh; row++) {
    for (let col = 0; col < rw; col++) {
      const onBorder = row < bj0 || row >= bj1 || col < bi0 || col >= bi1
      if (!onBorder) continue
      const p = pixelAt(row, col)
      if (p.lum >= 0.28) borderAll.push(p)
    }
  }
  if (borderAll.length >= 6) {
    const highFrac = borderAll.filter((p) => p.lum >= 0.93).length / borderAll.length
    if (highFrac >= 0.4) {
      const highs = borderAll.filter((p) => p.lum >= 0.9)
      const h = avg(highs.length ? highs : borderAll.filter((p) => p.lum >= 0.88))
      if (h) return h
    } else {
      const mids = borderAll.filter((p) => p.lum >= 0.34 && p.lum <= 0.93)
      if (mids.length >= 4) {
        mids.sort((a, b) => a.lum - b.lum)
        const a = Math.floor(mids.length * 0.12)
        const b = Math.ceil(mids.length * 0.88)
        const slice = mids.slice(a, b)
        if (slice.length >= 3) {
          let csum = 0
          for (const p of slice) csum += chromaRgb(p)
          const meanLum = slice.reduce((s, p) => s + p.lum, 0) / slice.length
          const meanChroma = csum / slice.length
          if (meanChroma < 0.055 && meanLum > 0.52 && meanLum < 0.9) {
            /* Desaturated mid-grey fringe on white — don’t paint a grey mask */
          } else {
            const h = avg(slice)
            if (h) return h
          }
        }
      }
    }
  }

  const minSamples = Math.max(4, Math.floor(rw * rh * 0.04))
  for (const threshold of [0.93, 0.88, 0.82, 0.76]) {
    /** @type {{ r: number; g: number; b: number }[]} */
    const pts = []
    for (let row = 0; row < rh; row++) {
      for (let col = 0; col < rw; col++) {
        const p = pixelAt(row, col)
        if (p.lum >= threshold) pts.push(p)
      }
    }
    if (pts.length >= minSamples) return avg(pts) ?? '#ffffff'
  }

  const border = Math.max(1, Math.min(5, Math.floor(Math.min(rw, rh) * 0.22)))
  const i0 = border
  const i1 = rw - border
  const j0 = border
  const j1 = rh - border
  const minBorder = Math.max(3, Math.floor((rw + rh) * 2 * border * 0.02))
  for (const threshold of [0.9, 0.82, 0.72]) {
    /** @type {{ r: number; g: number; b: number }[]} */
    const pts = []
    for (let row = 0; row < rh; row++) {
      for (let col = 0; col < rw; col++) {
        const onBorder = row < j0 || row >= j1 || col < i0 || col >= i1
        if (!onBorder) continue
        const p = pixelAt(row, col)
        if (p.lum >= threshold) pts.push(p)
      }
    }
    if (pts.length >= minBorder) return avg(pts) ?? '#ffffff'
  }

  return '#ffffff'
}

function rgbToHex(r, g, b) {
  const q = (v) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
  return `#${q(r)}${q(g)}${q(b)}`
}
