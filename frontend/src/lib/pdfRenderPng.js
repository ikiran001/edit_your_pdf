import './pdfjs.js'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

/**
 * Render each PDF page to a PNG blob (client-only).
 * Shared by toolkit features — keep imports out of `features/*` cross-dependencies.
 * @param {ArrayBuffer} arrayBuffer
 * @param {{ scale?: number }} opts
 * @returns {Promise<Blob[]>}
 */
export async function pdfToPngBlobs(arrayBuffer, { scale = 2 } = {}) {
  const data = arrayBuffer instanceof ArrayBuffer ? new Uint8Array(arrayBuffer) : arrayBuffer
  const pdf = await getDocument({ data }).promise
  const out = []
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png')
      })
      out.push(blob)
    }
    return out
  } finally {
    await pdf.destroy().catch(() => {})
  }
}
