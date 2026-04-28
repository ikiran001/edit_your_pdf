import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { resolvePageIndices } from './watermarkPdfCore.js'

function hexToRgb01(hex) {
  const s = (hex || '').replace(/^#/, '')
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16)
    const g = parseInt(s[1] + s[1], 16)
    const b = parseInt(s[2] + s[2], 16)
    return rgb(r / 255, g / 255, b / 255)
  }
  if (s.length !== 6) return rgb(0.12, 0.16, 0.23)
  const r = parseInt(s.slice(0, 2), 16)
  const g = parseInt(s.slice(2, 4), 16)
  const b = parseInt(s.slice(4, 6), 16)
  if (![r, g, b].every((n) => Number.isFinite(n))) return rgb(0.12, 0.16, 0.23)
  return rgb(r / 255, g / 255, b / 255)
}

function clampGrid01(v) {
  const n = Number(v)
  if (n === 1) return 1
  if (n === 2) return 2
  return 0
}

/**
 * @param {'plain'|'page-n'|'page-n-of-m'} format
 */
function formatPageNumberText(format, n, totalPagesInDoc) {
  if (format === 'plain') return String(n)
  if (format === 'page-n') return `Page ${n}`
  return `Page ${n} of ${totalPagesInDoc}`
}

/**
 * Baseline (pdf-lib) / horizontal anchor for single-page mode — 3×3 grid.
 * @param {0|1|2} gridRow top / middle / bottom
 * @param {0|1|2} gridCol left / center / right
 */
function xySingle(gridRow, gridCol, pageW, pageH, margin, fontSize, textW) {
  const halfH = fontSize * 0.4
  let y
  if (gridRow === 0) y = pageH - margin - fontSize
  else if (gridRow === 2) y = margin + halfH
  else y = pageH / 2 - halfH

  let x
  if (gridCol === 0) x = margin
  else if (gridCol === 2) x = pageW - margin - textW
  else x = (pageW - textW) / 2

  return { x, y }
}

/**
 * Facing mode: vertical band from row; horizontal alternates outer corners (odd → right, even → left).
 */
function xyFacing(gridRow, pageW, pageH, margin, fontSize, textW, physicalOneBased) {
  const halfH = fontSize * 0.4
  let y
  if (gridRow === 0) y = pageH - margin - fontSize
  else if (gridRow === 2) y = margin + halfH
  else y = pageH / 2 - halfH

  const odd = physicalOneBased % 2 === 1
  const x = odd ? pageW - margin - textW : margin
  return { x, y }
}

/**
 * @param {File | Uint8Array} fileOrBytes
 * @param {object} opts
 * @param {'single'|'facing'} opts.layoutMode
 * @param {number} opts.gridRow 0–2
 * @param {number} opts.gridCol 0–2 (ignored when layoutMode is facing)
 * @param {number} [opts.marginPts]
 * @param {'all'|'range'} opts.pageScope
 * @param {string} [opts.pageRangeInput]
 * @param {number} [opts.firstNumber]
 * @param {'plain'|'page-n'|'page-n-of-m'} [opts.numberFormat]
 * @param {number} [opts.fontSize]
 * @param {string} [opts.colorHex]
 * @param {boolean} [opts.bold]
 * @param {(done: number, total: number) => void} [opts.onProgress]
 */
export async function applyPageNumbersToPdf(fileOrBytes, opts) {
  const bytes =
    fileOrBytes instanceof Uint8Array
      ? new Uint8Array(fileOrBytes)
      : new Uint8Array(await fileOrBytes.arrayBuffer())

  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const numPages = pdfDoc.getPageCount()
  const indices = resolvePageIndices(opts.pageScope || 'all', opts.pageRangeInput || '', numPages)
  if (!indices.length) throw new Error('No pages selected for numbering.')

  const fontSize = Math.min(120, Math.max(6, Number(opts.fontSize) || 11))
  const marginRaw = opts.marginPts
  const margin = Math.min(
    144,
    Math.max(8, Number.isFinite(Number(marginRaw)) ? Number(marginRaw) : 36)
  )
  const firstNumber = Math.max(1, Math.floor(Number(opts.firstNumber) || 1))
  const bold = Boolean(opts.bold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const font = bold ? fontBold : fontRegular
  const color = hexToRgb01(opts.colorHex || '#1e293b')

  const layoutMode = opts.layoutMode === 'facing' ? 'facing' : 'single'
  const gridRow = clampGrid01(opts.gridRow)
  const gridCol = clampGrid01(opts.gridCol)

  let fmt = opts.numberFormat
  if (fmt !== 'page-n' && fmt !== 'page-n-of-m') fmt = 'plain'

  const totalPagesInDoc = numPages

  let done = 0
  const total = indices.length

  for (let i = 0; i < indices.length; i++) {
    const pageIndex = indices[i]
    const physicalOneBased = pageIndex + 1
    const n = firstNumber + i
    const text = formatPageNumberText(fmt, n, totalPagesInDoc)
    const tw = font.widthOfTextAtSize(text, fontSize)

    const page = pdfDoc.getPage(pageIndex)
    const { width: pw, height: ph } = page.getSize()

    const { x, y } =
      layoutMode === 'facing'
        ? xyFacing(gridRow, pw, ph, margin, fontSize, tw, physicalOneBased)
        : xySingle(gridRow, gridCol, pw, ph, margin, fontSize, tw)

    page.drawText(text, { x, y, size: fontSize, font, color })

    done += 1
    opts.onProgress?.(done, total)
    if (done % 4 === 0 && typeof requestAnimationFrame === 'function') {
      await new Promise((r) => requestAnimationFrame(() => r()))
    }
  }

  return pdfDoc.save({ useObjectStreams: false })
}
