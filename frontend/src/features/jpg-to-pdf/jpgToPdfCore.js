import { PDFDocument } from 'pdf-lib'

/** @param {import('pdf-lib').PDFDocument} doc */
async function embedRasterOnPage(doc, bytes, mime) {
  const m = String(mime || '').toLowerCase()
  let image
  if (m.includes('png')) {
    image = await doc.embedPng(bytes)
  } else if (m.includes('jpeg') || m.includes('jpg')) {
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

/**
 * @param {File[]} filesOrdered
 * @returns {Promise<Uint8Array>}
 */
export async function imagesToPdfBytes(filesOrdered) {
  const doc = await PDFDocument.create()
  for (const file of filesOrdered) {
    await embedRasterOnPage(doc, await file.arrayBuffer(), file.type || '')
  }
  return doc.save()
}

/**
 * @param {Blob[]} blobsOrdered JPEG/PNG blobs in page order
 * @returns {Promise<Uint8Array>}
 */
export async function imageBlobsToPdfBytes(blobsOrdered) {
  const doc = await PDFDocument.create()
  for (const blob of blobsOrdered) {
    const mime = blob.type || 'image/jpeg'
    await embedRasterOnPage(doc, await blob.arrayBuffer(), mime)
  }
  return doc.save()
}
