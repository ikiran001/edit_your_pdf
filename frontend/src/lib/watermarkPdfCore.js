import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib'
import { parsePageRangeInput } from './pdfMergeSplitCore.js'

const MARGIN = 28

/**
 * @param {'all' | 'range'} scope
 * @param {string} rangeInput
 * @param {number} numPages
 * @returns {number[]} sorted unique 0-based page indices
 */
export function resolvePageIndices(scope, rangeInput, numPages) {
  if (scope === 'all') {
    return Array.from({ length: numPages }, (_, i) => i)
  }
  const groups = parsePageRangeInput(rangeInput, numPages)
  const set = new Set()
  for (const [lo, hi] of groups) {
    for (let p = lo; p <= hi; p++) set.add(p - 1)
  }
  return [...set].sort((a, b) => a - b)
}

function hexToRgb01(hex) {
  const s = hex.replace(/^#/, '')
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16)
    const g = parseInt(s[1] + s[1], 16)
    const b = parseInt(s[2] + s[2], 16)
    return rgb(r / 255, g / 255, b / 255)
  }
  if (s.length !== 6) return rgb(0.4, 0.4, 0.45)
  const r = parseInt(s.slice(0, 2), 16)
  const g = parseInt(s.slice(2, 4), 16)
  const b = parseInt(s.slice(4, 6), 16)
  if (![r, g, b].every((n) => Number.isFinite(n))) return rgb(0.4, 0.4, 0.45)
  return rgb(r / 255, g / 255, b / 255)
}

function imageDrawSize(image, pageW, pageH, scalePreset, scalePercent) {
  const naturalW = image.width
  const naturalH = image.height
  const ref = Math.min(pageW, pageH)
  let pct
  if (scalePreset === 'small') pct = 0.14
  else if (scalePreset === 'medium') pct = 0.26
  else if (scalePreset === 'large') pct = 0.4
  else pct = Math.min(70, Math.max(8, Number(scalePercent) || 25)) / 100
  const targetW = ref * pct
  const ratio = targetW / naturalW
  return {
    width: Math.max(6, naturalW * ratio),
    height: Math.max(6, naturalH * ratio),
  }
}

function placeImage(pageW, pageH, iw, ih, position) {
  const m = MARGIN
  switch (position) {
    case 'top-left':
      return { x: m, y: pageH - m - ih }
    case 'top-right':
      return { x: pageW - m - iw, y: pageH - m - ih }
    case 'bottom-left':
      return { x: m, y: m }
    case 'bottom-right':
      return { x: pageW - m - iw, y: m }
    case 'center':
    default:
      return { x: (pageW - iw) / 2, y: (pageH - ih) / 2 }
  }
}

function placeTextBaseline(pageW, pageH, textW, fontSize, position) {
  const m = MARGIN
  const halfH = fontSize * 0.4
  switch (position) {
    case 'top-left':
      return { x: m, y: pageH - m - fontSize }
    case 'top-right':
      return { x: pageW - m - textW, y: pageH - m - fontSize }
    case 'bottom-left':
      return { x: m, y: m + halfH }
    case 'bottom-right':
      return { x: pageW - m - textW, y: m + halfH }
    case 'center':
    default:
      return { x: (pageW - textW) / 2, y: pageH / 2 - halfH }
  }
}

/**
 * @param {File} file
 * @param {object} opts
 * @param {'text'|'image'} opts.mode
 * @param {string} [opts.text]
 * @param {number} [opts.fontSize]
 * @param {string} [opts.colorHex]
 * @param {number} opts.opacityPct 0–100
 * @param {number} opts.rotationDeg
 * @param {Uint8Array} [opts.imageBytes]
 * @param {'png'|'jpg'} [opts.imageKind]
 * @param {'small'|'medium'|'large'|'custom'} [opts.imageScalePreset]
 * @param {number} [opts.imageScalePercent] when custom
 * @param {'center'|'top-left'|'top-right'|'bottom-left'|'bottom-right'|'tile'} opts.position
 * @param {'all'|'range'} opts.pageScope
 * @param {string} [opts.pageRangeInput]
 * @param {(done: number, total: number) => void} [opts.onProgress]
 * @returns {Promise<Uint8Array>}
 */
export async function applyWatermarkToPdf(file, opts) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const numPages = pdfDoc.getPageCount()
  const indices = resolvePageIndices(opts.pageScope, opts.pageRangeInput || '', numPages)
  if (!indices.length) throw new Error('No pages selected for watermark.')

  const opacity = Math.min(1, Math.max(0, (opts.opacityPct ?? 50) / 100))
  const rotationDeg = Math.min(180, Math.max(-180, Number(opts.rotationDeg) || 0))
  const rot = degrees(rotationDeg)

  let embeddedImage = null
  if (opts.mode === 'image') {
    if (!opts.imageBytes?.length) throw new Error('Add a PNG or JPG image for the watermark.')
    try {
      embeddedImage =
        opts.imageKind === 'png'
          ? await pdfDoc.embedPng(opts.imageBytes)
          : await pdfDoc.embedJpg(opts.imageBytes)
    } catch {
      throw new Error('Could not read the image. Use a valid PNG or JPEG file.')
    }
  } else {
    const t = (opts.text || '').trim()
    if (!t) throw new Error('Enter watermark text.')
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const color = hexToRgb01(opts.colorHex || '#64748b')

  let done = 0

  for (const pageIndex of indices) {
    const page = pdfDoc.getPage(pageIndex)
    const { width: pw, height: ph } = page.getSize()

    if (opts.mode === 'text') {
      const fontSize = Math.min(200, Math.max(6, Number(opts.fontSize) || 48))
      const text = (opts.text || '').trim()
      const lines = text.split(/\r?\n/)
      const lineHeight = fontSize * 1.15
      const maxLineW = Math.max(...lines.map((ln) => font.widthOfTextAtSize(ln, fontSize)), 8)

      if (opts.position === 'tile') {
        const stepX = Math.max(maxLineW + 36, 100)
        const blockH = lines.length * lineHeight + 28
        for (let row = 0; ; row++) {
          const baseY = ph - MARGIN - fontSize - row * blockH
          if (baseY < MARGIN) break
          for (let colX = MARGIN; colX + maxLineW <= pw - MARGIN + 0.5; colX += stepX) {
            let yOff = 0
            for (const line of lines) {
              const w = font.widthOfTextAtSize(line, fontSize)
              page.drawText(line, {
                x: colX + (maxLineW - w) / 2,
                y: baseY - yOff,
                size: fontSize,
                font,
                color,
                opacity,
                rotate: rot,
              })
              yOff += lineHeight
            }
          }
        }
      } else {
        const longest = lines.reduce((a, b) => (font.widthOfTextAtSize(a, fontSize) >= font.widthOfTextAtSize(b, fontSize) ? a : b))
        const tw = font.widthOfTextAtSize(longest, fontSize)
        const { x: bx, y: by } = placeTextBaseline(pw, ph, tw, fontSize, opts.position)
        let yOff = 0
        for (const line of lines) {
          const w = font.widthOfTextAtSize(line, fontSize)
          let x = bx
          if (opts.position === 'center') x = (pw - w) / 2
          if (opts.position === 'top-right' || opts.position === 'bottom-right') x = pw - MARGIN - w
          page.drawText(line, {
            x,
            y: by - yOff,
            size: fontSize,
            font,
            color,
            opacity,
            rotate: rot,
          })
          yOff += lineHeight
        }
      }
    } else {
      const { width: iw, height: ih } = imageDrawSize(
        embeddedImage,
        pw,
        ph,
        opts.imageScalePreset || 'medium',
        opts.imageScalePercent ?? 25
      )

      if (opts.position === 'tile') {
        const gap = 20
        for (let y = MARGIN; y + ih <= ph - MARGIN + 0.5; y += ih + gap) {
          for (let x = MARGIN; x + iw <= pw - MARGIN + 0.5; x += iw + gap) {
            page.drawImage(embeddedImage, {
              x,
              y,
              width: iw,
              height: ih,
              rotate: rot,
              opacity,
            })
          }
        }
      } else {
        const { x, y } = placeImage(pw, ph, iw, ih, opts.position)
        page.drawImage(embeddedImage, {
          x,
          y,
          width: iw,
          height: ih,
          rotate: rot,
          opacity,
        })
      }
    }

    done += 1
    opts.onProgress?.(done, indices.length)
    if (done % 4 === 0 && typeof requestAnimationFrame === 'function') {
      await new Promise((r) => requestAnimationFrame(() => r()))
    }
  }

  return pdfDoc.save({ useObjectStreams: true })
}
