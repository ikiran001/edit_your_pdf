import '../../lib/pdfjs.js'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

/** Hard caps so mobile browsers stay responsive */
export const CLIENT_PDF_MAX_BYTES = 28 * 1024 * 1024
export const CLIENT_PDF_MAX_PAGES = 120

/**
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<{ text: string, numPages: number }>}
 */
export async function extractPdfPlainText(arrayBuffer) {
  const data = arrayBuffer instanceof ArrayBuffer ? new Uint8Array(arrayBuffer) : arrayBuffer
  const task = getDocument({ data })
  const pdf = await task.promise
  try {
    const numPages = pdf.numPages
    const n = Math.min(numPages, CLIENT_PDF_MAX_PAGES)
    const chunks = []
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i)
      const tc = await page.getTextContent()
      let line = ''
      for (const item of tc.items) {
        if (item && typeof item === 'object' && 'str' in item && item.str) {
          line += item.str
        }
      }
      chunks.push(line)
    }
    const text = chunks.join('\n\n')
    return { text, numPages }
  } finally {
    await pdf.destroy().catch(() => {})
  }
}
