import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 72

/**
 * @param {string} paragraph
 * @param {import('pdf-lib').PDFFont} font
 * @param {number} fontSize
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapParagraphToLines(paragraph, font, fontSize, maxWidth) {
  if (!paragraph.trim()) return ['']
  const words = paragraph.trim().split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      line = candidate
    } else {
      if (line) lines.push(line)
      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        line = word
      } else {
        let rest = word
        while (rest.length) {
          let take = rest.length
          while (take > 1 && font.widthOfTextAtSize(rest.slice(0, take), fontSize) > maxWidth) {
            take -= 1
          }
          lines.push(rest.slice(0, take))
          rest = rest.slice(take)
        }
        line = ''
      }
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

/**
 * Minimal PDF from plain text — Helvetica, wrapped lines, multiple pages.
 * Not layout-faithful vs Word (no tables, images, or exact fonts).
 *
 * @param {string} plainText
 * @returns {Promise<{ blob: Blob, numPages: number }>}
 */
export async function buildDraftPdfBlob(plainText) {
  const body = String(plainText || '').replace(/\r\n/g, '\n')
  if (!body.trim()) throw new Error('empty_text')

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontSize = 11
  const lineHeight = fontSize * 1.35
  const maxW = PAGE_W - 2 * MARGIN

  let page = pdfDoc.addPage([PAGE_W, PAGE_H])
  let baselineY = PAGE_H - MARGIN - fontSize * 0.85

  const blocks = body.split(/\n/)
  for (let bi = 0; bi < blocks.length; bi++) {
    const lines = wrapParagraphToLines(blocks[bi], font, fontSize, maxW)
    for (const ln of lines) {
      if (baselineY < MARGIN + fontSize * 0.5) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H])
        baselineY = PAGE_H - MARGIN - fontSize * 0.85
      }
      if (ln.length) {
        page.drawText(ln, {
          x: MARGIN,
          y: baselineY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        })
      }
      baselineY -= lineHeight
    }
    if (bi < blocks.length - 1) {
      baselineY -= lineHeight * 0.15
    }
  }

  const bytes = await pdfDoc.save()
  const numPages = pdfDoc.getPageCount()
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    numPages,
  }
}
