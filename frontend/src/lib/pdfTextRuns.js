import { mapPdfFontNameToServer, parsePdfFontStyle } from './textFormatDefaults'

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
    const rawPdfFontFamily = st?.fontFamily || 'sans-serif'
    const fromStyleName = parsePdfFontStyle(rawPdfFontFamily)
    let desc = fontSizePdf * 0.28
    let asc = fontSizePdf * 0.92
    if (st && typeof st.descent === 'number' && typeof st.ascent === 'number') {
      const m = Math.max(fontSizePdf, item.height || 0) || fontSizePdf
      let d = Math.abs(st.descent) * m
      let a = st.ascent * m
      if (d > fontSizePdf * 2.5) d = fontSizePdf * 0.28
      if (a > fontSizePdf * 2.5) a = fontSizePdf * 0.92
      desc = d
      asc = a
    }

    const e = item.transform[4]
    const f = item.transform[5]
    const wPdf = item.width || 0
    const x0 = e
    const y0 = f - desc
    const x1 = e + wPdf
    const y1 = f + asc
    const pdfLeft = Math.min(x0, x1)
    const pdfRight = Math.max(x0, x1)
    const pdfBottom = Math.min(y0, y1)
    const pdfTop = Math.max(y0, y1)

    const r = viewport.convertToViewportRectangle([pdfLeft, pdfBottom, pdfRight, pdfTop])
    const left = Math.min(r[0], r[2])
    const right = Math.max(r[0], r[2])
    const top = Math.min(r[1], r[3])
    const bottom = Math.max(r[1], r[3])
    const boxH = Math.max(bottom - top, 2)
    const boxW = Math.max(right - left, 2)
    // Match on-screen size from the mapped bbox (canvas pixels)
    const fontSizePx = Math.min(200, Math.max(9, boxH * 0.82))

    const vw = viewport.width
    const vh = viewport.height
    const [, vyBaseline] = viewport.convertToViewportPoint(e, f)
    const baselineN = vh > 0 ? Math.min(1, Math.max(0, vyBaseline / vh)) : 0

    runs.push({
      str: s,
      /** Viewport Y of text baseline — used to cluster true lines (avoids merging adjacent rows). */
      baselineY: vyBaseline,
      /** pdf.js TextStyle.fontFamily (e.g. Helvetica, Times New Roman). */
      pdfFontFamily: rawPdfFontFamily,
      serverFontFamily: mapPdfFontNameToServer(rawPdfFontFamily),
      sourceBold: fromStyleName.bold,
      sourceItalic: fromStyleName.italic,
      /** getTextContent does not include fill color; default matches typical PDF body text. */
      sourceColorHex: '#000000',
      left,
      top,
      width: Math.max(boxW, 2),
      height: boxH,
      fontSizePx,
      viewportW: vw,
      viewportH: vh,
      /** Same viewport as the canvas — server maps this to pdf-lib page size so edits line up visually. */
      norm: {
        nx: left / vw,
        ny: top / vh,
        nw: boxW / vw,
        nh: boxH / vh,
        baselineN,
      },
      pdf: {
        x: pdfLeft,
        y: pdfBottom,
        w: pdfRight - pdfLeft,
        h: pdfTop - pdfBottom,
        baseline: f,
        fontSize: fontSizePdf,
      },
    })
  }

  return runs
}

/** Hit-test in canvas bitmap space (px, py scaled from client coords). */
export function hitTestTextRun(runs, px, py, pad = 8) {
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i]
    if (
      px >= r.left - pad &&
      px <= r.left + r.width + pad &&
      py >= r.top - pad &&
      py <= r.top + r.height + pad
    ) {
      return r
    }
  }
  return null
}

/** If no direct hit (bbox drift), pick the closest text run center within ~2 lines of slop. */
export function hitTestTextRunNearest(runs, px, py, pad = 8) {
  const direct = hitTestTextRun(runs, px, py, pad)
  if (direct) return direct
  let best = null
  let bestD = Infinity
  const maxSlop = 48
  for (const r of runs) {
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const d = Math.hypot(px - cx, py - cy)
    const reach = Math.hypot(r.width, r.height) / 2 + maxSlop
    if (d < bestD && d <= reach) {
      bestD = d
      best = r
    }
  }
  return best
}
