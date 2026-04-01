import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

/**
 * Render each PDF page to a JPEG blob (client-only).
 * @param {ArrayBuffer} arrayBuffer
 * @param {{ scale?: number, quality?: number }} opts
 * @returns {Promise<Blob[]>}
 */
export async function pdfToJpegBlobs(arrayBuffer, { scale = 2, quality = 0.92 } = {}) {
  const data = arrayBuffer instanceof ArrayBuffer ? new Uint8Array(arrayBuffer) : arrayBuffer
  const pdf = await getDocument({ data }).promise
  const out = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))), 'image/jpeg', quality)
    })
    out.push(blob)
  }
  return out
}
