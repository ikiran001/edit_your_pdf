/**
 * Approximate text ink colour from the rendered PDF canvas (pdf.js does not expose fill colour per glyph).
 *
 * Works for BOTH dark-on-light AND light-on-dark text:
 *  1. Sample a moderate patch around the glyph centre.
 *  2. Compute median luminance of ALL pixels to determine whether the background is dark or light.
 *  3. Dark  background (medianLum < 0.45) → text is BRIGHT.
 *     • Take only pixels that are SIGNIFICANTLY BRIGHTER than the background median
 *       (lum > medianLum + 0.45, minimum threshold 0.65).
 *     • These are the actual glyph pixels (white/light text), not blended anti-alias noise.
 *     • If no such pixels exist → return '#ffffff' (safe fallback for dark background).
 *  4. Light background → ink is the darkest pixels (original logic).
 *
 * This prevents returning the navy-blue background as the "ink" colour when editing
 * white text on a dark table header, which would make re-drawn text invisible.
 */
export function sampleInkColorHex(canvas, cx, cy) {
  if (!canvas?.width) return null
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const w = canvas.width
  const h = canvas.height
  const ix = Math.max(0, Math.min(w - 1, Math.floor(cx)))
  const iy = Math.max(0, Math.min(h - 1, Math.floor(cy)))
  /* ±12 px: wide enough to capture glyph + background for bimodal detection. */
  const half = 12
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
  const all = []
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    all.push({ r: data[i], g: data[i + 1], b: data[i + 2], lum })
  }
  if (all.length === 0) return '#000000'

  const sorted = [...all].sort((a, b) => a.lum - b.lum)
  const medianLum = sorted[Math.floor(sorted.length / 2)].lum

  let ink

  if (medianLum < 0.45) {
    /*
     * DARK BACKGROUND (navy, black, dark teal …)
     * The text is bright (white/cream/yellow). We want pixels that contrast
     * strongly against the background — i.e., lum significantly above the median.
     * Using a fixed percentage ("top 38%") fails because background pixels still
     * outnumber text pixels in the sample; instead use a luminance threshold.
     */
    const brightThreshold = Math.min(0.65, medianLum + 0.45)
    const bright = all.filter((p) => p.lum >= brightThreshold)
    if (bright.length >= 2) {
      ink = bright
    } else {
      /* No clearly bright pixels → text colour is unmeasurable; default to white. */
      return '#ffffff'
    }
  } else {
    /*
     * LIGHT BACKGROUND (white, cream …)
     * Ink is the darkest non-trivial pixels (classic black-on-white path).
     */
    const nonWhite = sorted.filter((p) => p.lum < 0.97)
    const nTake = Math.max(3, Math.ceil(nonWhite.length * 0.38))
    ink = nonWhite.slice(0, nTake)
  }

  if (!ink || ink.length === 0) {
    const ci = (iy - y0) * rw * 4 + (ix - x0) * 4
    if (ci >= 0 && ci + 2 < data.length) return rgbToHex(data[ci], data[ci + 1], data[ci + 2])
    return medianLum < 0.45 ? '#ffffff' : '#000000'
  }

  let rr = 0, gg = 0, bb = 0
  for (const p of ink) { rr += p.r; gg += p.g; bb += p.b }
  return rgbToHex(rr / ink.length, gg / ink.length, bb / ink.length)
}

function chromaRgb(p) {
  const m = Math.max(p.r, p.g, p.b) / 255
  const n = Math.min(p.r, p.g, p.b) / 255
  return m - n
}

/**
 * Sample fill behind text in a PDF canvas rect (bitmap coords) so server-side erase rectangles
 * can match table headers / coloured cells instead of always using white.
 *
 * Strategy:
 * 1. Collect all border-strip pixels (outer ring, away from glyph cores).
 * 2. Measure dark%, light%, mid% of those pixels.
 * 3. DARK cell  (navy, black, dark teal) → average dark border pixels directly.
 * 4. LIGHT cell (white, cream)           → average bright border pixels.
 * 5. MID-TONE   (gold, red, blue header) → IQR-trimmed median of the border.
 * 6. Corner / luminance-cascade fallback for anything else.
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
    let rr = 0, gg = 0, bb = 0
    for (const p of arr) { rr += p.r; gg += p.g; bb += p.b }
    const n = arr.length
    return rgbToHex(rr / n, gg / n, bb / n)
  }

  /* ── Collect border-strip pixels (outer ~18% ring, away from glyph cores) ── */
  const borderW = Math.max(1, Math.min(4, Math.floor(Math.min(rw, rh) * 0.18)))
  const bi0 = borderW, bi1 = rw - borderW
  const bj0 = borderW, bj1 = rh - borderW
  /** @type {{ r: number; g: number; b: number; lum: number }[]} */
  const borderAll = []
  for (let row = 0; row < rh; row++) {
    for (let col = 0; col < rw; col++) {
      const onBorder = row < bj0 || row >= bj1 || col < bi0 || col >= bi1
      if (onBorder) borderAll.push(pixelAt(row, col))
    }
  }

  if (borderAll.length >= 4) {
    const darkPct  = borderAll.filter((p) => p.lum < 0.35).length / borderAll.length
    const lightPct = borderAll.filter((p) => p.lum >= 0.82).length / borderAll.length

    /* ── Dark background: navy, black, dark teal, dark grey ── */
    if (darkPct >= 0.4) {
      const dark = borderAll.filter((p) => p.lum < 0.40)
      const h = avg(dark)
      if (h) return h
    }

    /* ── Light / white background ── */
    if (lightPct >= 0.55) {
      const lights = borderAll.filter((p) => p.lum >= 0.82)
      const h = avg(lights)
      if (h) return h
    }

    /* ── Mid-tone coloured fill (gold, teal, medium-blue, red headers) ── */
    const mids = borderAll.filter((p) => p.lum >= 0.28 && p.lum <= 0.93)
    if (mids.length >= 4) {
      mids.sort((a, b) => a.lum - b.lum)
      const lo = Math.floor(mids.length * 0.12)
      const hi = Math.ceil(mids.length * 0.88)
      const slice = mids.slice(lo, hi)
      if (slice.length >= 3) {
        let csum = 0
        for (const p of slice) csum += chromaRgb(p)
        const meanLum    = slice.reduce((s, p) => s + p.lum, 0) / slice.length
        const meanChroma = csum / slice.length
        /* Skip desaturated mid-grey anti-alias fringe on a white page */
        if (!(meanChroma < 0.055 && meanLum > 0.52 && meanLum < 0.9)) {
          const h = avg(slice)
          if (h) return h
        }
      }
    }
  }

  /* ── Corner check for very bright / near-white cells ── */
  const inset = Math.max(0, Math.min(2, Math.floor(Math.min(rw, rh) * 0.06)))
  const cs    = Math.max(2, Math.min(8, Math.floor(Math.min(rw, rh) * 0.28)))
  let bestCornerHex = null, bestCornerMeanLum = -1
  for (const [sr, sc] of [
    [inset, inset],
    [inset, Math.max(inset, rh - cs)],
    [Math.max(inset, rw - cs), inset],
    [Math.max(inset, rw - cs), Math.max(inset, rh - cs)],
  ]) {
    const pts = []
    for (let dr = 0; dr < cs; dr++) {
      for (let dc = 0; dc < cs; dc++) {
        const row = sr + dr, col = sc + dc
        if (row < 0 || col < 0 || row >= rh || col >= rw) continue
        const p = pixelAt(row, col)
        if (p.lum >= 0.88) pts.push(p)
      }
    }
    if (pts.length < 2) continue
    const ml = pts.reduce((s, p) => s + p.lum, 0) / pts.length
    if (ml > bestCornerMeanLum) { bestCornerMeanLum = ml; bestCornerHex = avg(pts) }
  }
  if (bestCornerHex && bestCornerMeanLum >= 0.86) return bestCornerHex

  /* ── Luminance-cascade fallback for near-white pages ── */
  const minSamples = Math.max(4, Math.floor(rw * rh * 0.04))
  for (const threshold of [0.93, 0.88, 0.82, 0.76]) {
    const pts = []
    for (let row = 0; row < rh; row++)
      for (let col = 0; col < rw; col++) { const p = pixelAt(row, col); if (p.lum >= threshold) pts.push(p) }
    if (pts.length >= minSamples) return avg(pts) ?? '#ffffff'
  }

  return '#ffffff'
}

/**
 * WCAG relative luminance of a hex colour string.
 * Returns a value in [0, 1]. Returns 0 for invalid input.
 */
export function hexLuminance(hex) {
  if (typeof hex !== 'string') return 0
  const s = hex.replace('#', '')
  const full = s.length === 3
    ? s[0] + s[0] + s[1] + s[1] + s[2] + s[2]
    : s
  if (full.length !== 6) return 0
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function rgbToHex(r, g, b) {
  const q = (v) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
  return `#${q(r)}${q(g)}${q(b)}`
}
