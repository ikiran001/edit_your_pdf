import { PDFDocument } from 'pdf-lib'

/**
 * @param {File[]} filesOrdered
 * @returns {Promise<Uint8Array>}
 */
export async function imagesToPdfBytes(filesOrdered) {
  const doc = await PDFDocument.create()
  for (const file of filesOrdered) {
    const bytes = await file.arrayBuffer()
    const mime = file.type || ''
    let image
    if (mime.includes('png')) {
      image = await doc.embedPng(bytes)
    } else if (mime.includes('jpeg') || mime.includes('jpg')) {
      image = await doc.embedJpg(bytes)
    } else {
      try {
        image = await doc.embedPng(bytes)
      } catch {
        image = await doc.embedJpg(bytes)
      }
    }
    const { width, height } = image
    const page = doc.addPage([width, height])
    page.drawImage(image, { x: 0, y: 0, width, height })
  }
  return doc.save()
}
