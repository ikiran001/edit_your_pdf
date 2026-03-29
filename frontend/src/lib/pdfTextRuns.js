/**
 * Build selectable text runs from pdf.js text content (same viewport as the page canvas).
 * Coordinates are in canvas pixel space (0…viewport.width/height).
 */
export function buildTextRuns(viewport, textContent) {
  const { items, styles } = textContent
  const runs = []

  for (const item of items) {
    if (!('str' in item) || item.str == null) continue
    const s = item.str
    if (!s.length) continue

    const fontSizePdf =
      Math.hypot(item.transform[0], item.transform[1]) ||
      Math.hypot(item.transform[2], item.transform[3]) ||
      12
    const st = item.fontName ? styles[item.fontName] : null
    let desc = fontSizePdf * 0.28
    let asc = fontSizePdf * 0.92
    if (st && typeof st.descent === 'number' && typeof st.ascent === 'number') {
      const m = Math.max(fontSizePdf, item.height || 0) || fontSizePdf
      desc = Math.abs(st.descent) * m
      asc = st.ascent * m
    }

    const e = item.transform[4]
    const f = item.transform[5]
    const wPdf = item.width || 0
    const x0 = e
    const y0 = f - desc
    const x1 = e + wPdf
    const y1 = f + asc

    const r = viewport.convertToViewportRectangle([x0, y0, x1, y1])
    const left = Math.min(r[0], r[2])
    const right = Math.max(r[0], r[2])
    const top = Math.min(r[1], r[3])
    const bottom = Math.max(r[1], r[3])

    runs.push({
      str: s,
      left,
      top,
      width: Math.max(right - left, 2),
      height: Math.max(bottom - top, 2),
      fontSizePx: fontSizePdf * viewport.scale,
      pdf: {
        x: x0,
        y: y0,
        w: x1 - x0,
        h: y1 - y0,
        baseline: f,
        fontSize: fontSizePdf,
      },
    })
  }

  return runs
}

/** Hit-test in canvas bitmap space (px, py scaled from client coords). */
export function hitTestTextRun(runs, px, py) {
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i]
    if (
      px >= r.left &&
      px <= r.left + r.width &&
      py >= r.top &&
      py <= r.top + r.height
    ) {
      return r
    }
  }
  return null
}
