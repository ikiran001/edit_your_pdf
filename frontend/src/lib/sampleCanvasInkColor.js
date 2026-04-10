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

function avgRgb(arr) {
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

/**
 * Trimmed mean on sorted pixels (by luminance).
 */
function trimmedMeanRgb(sorted, loFrac, hiFrac) {
  const n = sorted.length
  if (n < 4) return null
  const lo = Math.floor(n * loFrac)
  const hi = Math.max(lo + 3, Math.ceil(n * hiFrac))
  return avgRgb(sorted.slice(lo, hi))
}

/** If enough samples are near-white, snap mask to pure white (avoids pale blue/grey patches on paper). */
function trySnapPaperWhite(sortedAsc, n) {
  const hi = sortedAsc.filter((x) => x.lum >= 0.942)
  if (hi.length < n * 0.17) return null
  if (hi.length >= n * 0.32) return '#ffffff'
  const meanL = hi.reduce((s, p) => s + p.lum, 0) / hi.length
  if (meanL >= 0.965) return '#ffffff'
  const loIx = Math.floor(hi.length * 0.08)
  return avgRgb(hi.slice(loIx)) ?? '#ffffff'
}

/** Darkest “bulk” of a sorted list — row paint without black grid specks. */
function trimmedDarkFill(sortedAsc, n) {
  const lo = Math.floor(n * 0.03)
  const hi = Math.max(lo + 8, Math.floor(n * 0.36))
  return avgRgb(sortedAsc.slice(lo, hi))
}

/**
 * Pixels in an expanded rect **outside** the inner text bbox — pure row/cell fill without glyphs.
 *
 * Dark blue row + dark blue text: anti-aliasing adds many **mid/high-lum** grey-blue pixels. Median
 * then lands in the “mid” band and a wide percentile slice averages to a **pale** mask — the bug.
 * We use p10/p90 and bimodal rules before falling back to median.
 */
function sampleRingBackgroundFromBuffer(data, erw, erh, ix0, iy0, ix1, iy1) {
  /** @type {{ r: number; g: number; b: number; lum: number }[]} */
  const ring = []
  const pixelAt = (row, col) => {
    const i = (row * erw + col) * 4
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return { r: data[i], g: data[i + 1], b: data[i + 2], lum }
  }
  const i0 = Math.max(0, Math.min(ix0, ix1))
  const j0 = Math.max(0, Math.min(iy0, iy1))
  const i1 = Math.max(i0, Math.min(erw, Math.max(ix0, ix1)))
  const j1 = Math.max(j0, Math.min(erh, Math.max(iy0, iy1)))
  /* Widen the hole slightly so the ring is taken from cell margin, not glyph anti-alias at the bbox edge. */
  const pw = i1 - i0
  const ph = j1 - j0
  const gutter = Math.min(5, Math.max(1, Math.floor(Math.min(pw, ph) * 0.07)))
  const ei0 = Math.max(0, i0 - gutter)
  const ej0 = Math.max(0, j0 - gutter)
  const ei1 = Math.min(erw, i1 + gutter)
  const ej1 = Math.min(erh, j1 + gutter)
  for (let row = 0; row < erh; row++) {
    for (let col = 0; col < erw; col++) {
      if (col >= ei0 && col < ei1 && row >= ej0 && row < ej1) continue
      ring.push(pixelAt(row, col))
    }
  }
  if (ring.length < 12) return null
  ring.sort((a, b) => a.lum - b.lum)
  const n = ring.length
  const p = (q) => ring[Math.min(n - 1, Math.max(0, Math.floor(q * (n - 1))))].lum
  const p10 = p(0.1)
  const p25 = p(0.25)
  const p50 = p(0.5)
  const p75 = p(0.75)
  const p90 = p(0.9)

  const brightFrac = ring.filter((x) => x.lum >= 0.86).length / n

  /*
   * White table cells: the ring often includes black grid lines + a little AA. p10 is very low and
   * the bimodal branch used to average those “darks” → charcoal mask and invisible black text.
   * Require p50 high enough so we don’t treat a dark-coloured row with bright halos as “paper”.
   */
  const looksLikePaper =
    p50 > 0.44 && (brightFrac >= 0.2 || (p75 >= 0.82 && p50 >= 0.56))
  if (looksLikePaper) {
    const snap = trySnapPaperWhite(ring, n)
    if (snap) return snap
    const t = trimmedMeanRgb(ring, 0.58, 1)
    if (t) return t
  }

  /*
   * Coloured table row: allow slightly higher p90 (strong AA on blue) but require overall dark bulk.
   */
  if (p90 < 0.64 && p10 < 0.45 && p50 < 0.54 && brightFrac < 0.24) {
    const t = trimmedDarkFill(ring, n)
    if (t) return t
  }
  /* Strong AA on blue rows can raise brightFrac; average darker ring pixels only. */
  if (p50 < 0.47 && p90 < 0.68 && brightFrac >= 0.15) {
    const subs = ring.filter((x) => x.lum <= 0.54)
    if (subs.length >= Math.max(16, n * 0.18)) {
      subs.sort((a, b) => a.lum - b.lum)
      const t = trimmedDarkFill(subs, subs.length)
      if (t) return t
    }
  }

  /* Dark base + bright halos — only when the ring is not paper-white overall. */
  if (p10 < 0.34 && p90 > 0.62 && p50 < 0.52 && brightFrac < 0.18) {
    const darks = ring.filter((x) => x.lum < Math.min(0.48, p50 + 0.12))
    if (darks.length >= 10) {
      darks.sort((a, b) => a.lum - b.lum)
      const t = trimmedMeanRgb(darks, 0.05, 0.72)
      if (t) return t
    }
  }

  /* Light page + dark glyphs in ring */
  if (p10 > 0.55 && p90 > 0.82) {
    const t = trimmedMeanRgb(ring, 0.28, 0.97)
    if (t) return t
  }

  const med = p50
  let lo
  let hi
  if (med < 0.44) {
    lo = Math.floor(n * 0.06)
    hi = Math.max(lo + 6, Math.floor(n * 0.52))
  } else if (med > 0.58) {
    lo = Math.floor(n * 0.32)
    hi = Math.max(lo + 6, Math.floor(n * 0.94))
  } else {
    /* Mid median: often AA on dark rows — prefer darker tail if p25 is still low. */
    if (p25 < 0.38 && p75 < 0.62) {
      lo = Math.floor(n * 0.05)
      hi = Math.max(lo + 6, Math.floor(n * 0.45))
    } else {
      lo = Math.floor(n * 0.12)
      hi = Math.max(lo + 6, Math.floor(n * 0.88))
    }
  }
  return avgRgb(ring.slice(lo, hi))
}

/**
 * Left/right (and thin top/bottom) strips inside the bbox — margins often lack ink even when the line is full-width.
 */
function sampleEdgeStripBackground(pixelAtInner, rw, rh) {
  const stripW = Math.max(2, Math.min(12, Math.floor(rw * 0.12), Math.floor(rw / 3)))
  const stripH = Math.max(2, Math.min(8, Math.floor(rh * 0.4)))
  /** @type {{ r: number; g: number; b: number; lum: number }[]} */
  const pts = []
  for (let row = 0; row < rh; row++) {
    for (let dc = 0; dc < stripW && dc < rw; dc++) {
      pts.push(pixelAtInner(row, dc))
      const c2 = rw - 1 - dc
      if (c2 > dc) pts.push(pixelAtInner(row, c2))
    }
  }
  for (let col = stripW; col < rw - stripW; col++) {
    for (let dr = 0; dr < stripH && dr < rh; dr++) {
      pts.push(pixelAtInner(dr, col))
      const r2 = rh - 1 - dr
      if (r2 > dr) pts.push(pixelAtInner(r2, col))
    }
  }
  if (pts.length < 10) return null
  pts.sort((a, b) => a.lum - b.lum)
  const m = pts.length
  const q = (f) => pts[Math.min(m - 1, Math.max(0, Math.floor(f * (m - 1))))].lum
  const p10 = q(0.1)
  const p25 = q(0.25)
  const p50 = q(0.5)
  const p75 = q(0.75)
  const p90 = q(0.9)
  const brightFrac = pts.filter((x) => x.lum >= 0.86).length / m
  const paperFrac = pts.filter((x) => x.lum >= 0.9).length / m

  /*
   * Strips often sit on glyph strokes (low p50) while the cell is still white; p75 + paperFrac
   * detect enough near-white samples to prefer a paper trim.
   */
  if (
    (p75 >= 0.7 && paperFrac >= 0.11) ||
    (p50 > 0.42 && (brightFrac >= 0.18 || (p75 >= 0.8 && p50 >= 0.54)))
  ) {
    const snap = trySnapPaperWhite(pts, m)
    if (snap) return snap
    const t = trimmedMeanRgb(pts, 0.55, 1)
    if (t) return t
  }

  if (p90 < 0.64 && p10 < 0.45 && p50 < 0.54 && brightFrac < 0.24) {
    const t = trimmedDarkFill(pts, m)
    if (t) return t
  }
  if (p50 < 0.47 && p90 < 0.68 && brightFrac >= 0.15) {
    const subs = pts.filter((x) => x.lum <= 0.54)
    if (subs.length >= Math.max(14, m * 0.16)) {
      subs.sort((a, b) => a.lum - b.lum)
      const t = trimmedDarkFill(subs, subs.length)
      if (t) return t
    }
  }
  if (p10 < 0.34 && p90 > 0.62 && p50 < 0.52 && brightFrac < 0.16) {
    const darks = pts.filter((x) => x.lum < Math.min(0.48, p50 + 0.12))
    if (darks.length >= 8) {
      darks.sort((a, b) => a.lum - b.lum)
      const t = trimmedMeanRgb(darks, 0.06, 0.75)
      if (t) return t
    }
  }

  const med = p50
  let lo
  let hi
  if (med < 0.44) {
    lo = Math.floor(m * 0.07)
    hi = Math.max(lo + 5, Math.floor(m * 0.55))
  } else if (med > 0.58) {
    lo = Math.floor(m * 0.3)
    hi = Math.max(lo + 5, Math.floor(m * 0.93))
  } else if (p25 < 0.38 && p75 < 0.62) {
    lo = Math.floor(m * 0.06)
    hi = Math.max(lo + 5, Math.floor(m * 0.48))
  } else {
    lo = Math.floor(m * 0.14)
    hi = Math.max(lo + 5, Math.floor(m * 0.86))
  }
  return avgRgb(pts.slice(lo, hi))
}

/**
 * Sample fill behind text in a PDF canvas rect (bitmap coords) so server-side erase rectangles
 * can match table headers / colored cells instead of always using white.
 *
 * Strategy (in order): (1) **Ring sample** on an expanded rect excluding the inner glyph box — best
 * for dark table rows. (2) **Edge strips** inside the box. (3) Legacy corner/border/full heuristics.
 */
export function sampleBackgroundColorHex(canvas, left, top, width, height) {
  if (!canvas?.width || width < 1 || height < 1) return '#ffffff'
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return '#ffffff'

  const innerX0 = Math.max(0, Math.floor(left))
  const innerY0 = Math.max(0, Math.floor(top))
  const innerX1 = Math.min(canvas.width, Math.ceil(left + width))
  const innerY1 = Math.min(canvas.height, Math.ceil(top + height))
  const rw = innerX1 - innerX0
  const rh = innerY1 - innerY0
  if (rw < 1 || rh < 1) return '#ffffff'

  /* Pull more pure fill from the sides; vertical band stays modest to avoid the next row. */
  const expandX = Math.max(4, Math.min(22, Math.floor(rw * 0.18)))
  const expandY = Math.max(2, Math.min(10, Math.floor(rh * 0.65)))
  const ox0 = Math.max(0, innerX0 - expandX)
  const oy0 = Math.max(0, innerY0 - expandY)
  const ox1 = Math.min(canvas.width, innerX1 + expandX)
  const oy1 = Math.min(canvas.height, innerY1 + expandY)
  const erw = ox1 - ox0
  const erh = oy1 - oy0

  let data
  try {
    data = ctx.getImageData(ox0, oy0, erw, erh).data
  } catch {
    return '#ffffff'
  }

  const ix0 = innerX0 - ox0
  const iy0 = innerY0 - oy0
  const ix1 = innerX1 - ox0
  const iy1 = innerY1 - oy0

  const ringHex = sampleRingBackgroundFromBuffer(data, erw, erh, ix0, iy0, ix1, iy1)
  if (ringHex) return ringHex

  /* Fallback: inner rect only (same buffer if expand>0, else re-read — here always have expanded) */
  const pixelAtInner = (row, col) => {
    const r = iy0 + row
    const c = ix0 + col
    const i = (r * erw + c) * 4
    const rr = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const lum = 0.2126 * rr + 0.7152 * g + 0.0722 * b
    return { r: data[i], g: data[i + 1], b: data[i + 2], lum }
  }

  const edgeHex = sampleEdgeStripBackground(pixelAtInner, rw, rh)
  if (edgeHex) return edgeHex

  const avg = avgRgb

  const pixelAt = (row, col) => pixelAtInner(row, col)

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

  /**
   * Dark / saturated fills (table headers, navy rows): corner and “bright pixel” rules often
   * miss and we incorrectly return white — a pale mask on a dark row looks like a broken bar.
   * Trim darkest ~7% (glyph cores) and brightest ~12% (halos), then average the body.
   */
  {
    /** @type {{ r: number; g: number; b: number; lum: number }[]} */
    const all = []
    for (let row = 0; row < rh; row++) {
      for (let col = 0; col < rw; col++) {
        all.push(pixelAt(row, col))
      }
    }
    const n = all.length
    if (n >= 24) {
      all.sort((a, b) => a.lum - b.lum)
      const lo = Math.floor(n * 0.07)
      const hi = Math.max(lo + 4, Math.floor(n * 0.88))
      const body = all.slice(lo, hi)
      const meanLum = body.reduce((s, p) => s + p.lum, 0) / body.length
      if (meanLum < 0.52 && meanLum > 0.035) {
        const h = avg(body)
        if (h) return h
      }
    }
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
