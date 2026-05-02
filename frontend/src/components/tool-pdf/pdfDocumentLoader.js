import '../../lib/pdfjs.js'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfjsPackage from 'pdfjs-dist/package.json' with { type: 'json' }

const STANDARD_FONT_DATA_URL = `https://unpkg.com/pdfjs-dist@${pdfjsPackage.version}/standard_fonts/`

/**
 * @param {ArrayBuffer | Uint8Array} data
 */
export async function loadPdfDocument(data) {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data)
  const task = getDocument({ data: u8, standardFontDataUrl: STANDARD_FONT_DATA_URL })
  return task.promise
}
