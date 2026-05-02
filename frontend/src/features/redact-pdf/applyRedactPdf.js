import { PDFDocument, rgb } from 'pdf-lib'

/**
 * @param {File} file
 * @param {Array<{ pageIndex: number, nx: number, ny: number, nw: number, nh: number }>} marks
 */
export async function applyRedactionsToPdf(file, marks) {
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const pages = doc.getPages()
  const byPage = new Map()
  for (const m of marks) {
    const list = byPage.get(m.pageIndex) ?? []
    list.push(m)
    byPage.set(m.pageIndex, list)
  }
  for (const [pageIndex, list] of byPage) {
    const page = pages[pageIndex]
    if (!page) continue
    const { width: W, height: H } = page.getSize()
    for (const r of list) {
      const nx = Math.min(1, Math.max(0, r.nx))
      const ny = Math.min(1, Math.max(0, r.ny))
      const nw = Math.min(1 - nx, Math.max(0.01, r.nw))
      const nh = Math.min(1 - ny, Math.max(0.01, r.nh))
      page.drawRectangle({
        x: nx * W,
        y: H - ny * H - nh * H,
        width: nw * W,
        height: nh * H,
        color: rgb(0, 0, 0),
        opacity: 1,
      })
    }
  }
  return doc.save()
}
