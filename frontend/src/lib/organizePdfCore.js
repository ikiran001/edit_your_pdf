import { PDFDocument, degrees } from 'pdf-lib'

/**
 * Rebuild a PDF with reordered pages, per-page rotation deltas (90° steps), and omissions.
 * @param {File} file — original PDF
 * @param {Array<{ sourceIndex: number, rotationDelta: number }>} orderedPages — `sourceIndex` is 0-based in the original file
 * @returns {Promise<Uint8Array>}
 */
export async function buildOrganizedPdf(file, orderedPages) {
  if (!orderedPages?.length) {
    throw new Error('No pages left to save. Reset or upload a PDF again.')
  }
  const srcBytes = new Uint8Array(await file.arrayBuffer())
  const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true })
  const n = src.getPageCount()
  for (const p of orderedPages) {
    if (p.sourceIndex < 0 || p.sourceIndex >= n) {
      throw new Error('Invalid page reference. Try uploading the PDF again.')
    }
  }
  const out = await PDFDocument.create()
  const indices = orderedPages.map((p) => p.sourceIndex)
  const copied = await out.copyPages(src, indices)
  for (let i = 0; i < copied.length; i++) {
    const page = copied[i]
    const delta = Number(orderedPages[i].rotationDelta) || 0
    const existing = page.getRotation().angle
    const total = ((existing + delta) % 360) + 360
    const normalized = total % 360
    page.setRotation(degrees(normalized))
    out.addPage(page)
  }
  return out.save()
}

/**
 * One PDF per entry — same rotation rules as {@link buildOrganizedPdf}, but loads the source file once.
 * @param {File} file
 * @param {Array<{ sourceIndex: number, rotationDelta: number }>} orderedPages — order preserved in output array
 * @returns {Promise<Uint8Array[]>}
 */
export async function exportOrganizedSinglePagePdfs(file, orderedPages) {
  if (!orderedPages?.length) {
    throw new Error('No pages left to export. Reset or upload a PDF again.')
  }
  const srcBytes = new Uint8Array(await file.arrayBuffer())
  const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true })
  const n = src.getPageCount()
  for (const p of orderedPages) {
    if (p.sourceIndex < 0 || p.sourceIndex >= n) {
      throw new Error('Invalid page reference. Try uploading the PDF again.')
    }
  }
  const results = []
  for (const p of orderedPages) {
    const dst = await PDFDocument.create()
    const [page] = await dst.copyPages(src, [p.sourceIndex])
    const delta = Number(p.rotationDelta) || 0
    const existing = page.getRotation().angle
    const total = ((existing + delta) % 360) + 360
    const normalized = total % 360
    page.setRotation(degrees(normalized))
    dst.addPage(page)
    results.push(await dst.save())
  }
  return results
}
