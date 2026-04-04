import { PDFDocument } from 'pdf-lib'

/**
 * Client-only merge/split helpers using pdf-lib (isolated from server edit pipeline).
 * @param {File[]} files — PDF files in merge order
 * @returns {Promise<Uint8Array>}
 */
export async function mergePdfsToUint8(files) {
  const merged = await PDFDocument.create()
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const copied = await merged.copyPages(doc, doc.getPageIndices())
    copied.forEach((page) => merged.addPage(page))
  }
  return merged.save()
}

/**
 * @param {string} part — e.g. "1-3" or "5"
 * @returns {[number, number]} 1-based inclusive page range
 */
function parseOneRangePart(part) {
  const p = part.trim()
  if (!p) throw new Error('Empty range segment')
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(p)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 1 || b < a) {
      throw new Error(`Invalid range: ${p}`)
    }
    return [a, b]
  }
  const n = Number(p)
  if (!Number.isFinite(n) || n < 1) throw new Error(`Invalid page: ${p}`)
  return [n, n]
}

/**
 * @param {string} input — comma-separated ranges, e.g. "1-3, 5, 7-8"
 * @param {number} numPages — total pages in document (1-based max)
 * @returns {Array<[number, number]>} groups as 1-based inclusive ranges
 */
export function parsePageRangeInput(input, numPages) {
  const s = input.trim()
  if (!s) throw new Error('Enter page ranges (e.g. 1-3, 5-6)')
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean)
  if (!parts.length) throw new Error('Enter at least one range')
  const groups = []
  for (const part of parts) {
    const [lo, hi] = parseOneRangePart(part)
    if (hi > numPages || lo > numPages) {
      throw new Error(`Pages must be between 1 and ${numPages}`)
    }
    groups.push([lo, hi])
  }
  return groups
}

/**
 * Build one PDF per page range group (1-based ranges).
 * @returns {Promise<Uint8Array[]>}
 */
export async function splitPdfByRanges(file, groups1Based) {
  const srcBytes = new Uint8Array(await file.arrayBuffer())
  const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true })
  const n = src.getPageCount()
  const out = []
  for (const [lo1, hi1] of groups1Based) {
    if (lo1 < 1 || hi1 > n || lo1 > hi1) {
      throw new Error(`Invalid range ${lo1}-${hi1} for ${n} page(s)`)
    }
    const dst = await PDFDocument.create()
    const idx = []
    for (let p = lo1; p <= hi1; p++) idx.push(p - 1)
    const copied = await dst.copyPages(src, idx)
    copied.forEach((page) => dst.addPage(page))
    out.push(await dst.save())
  }
  return out
}

/**
 * One PDF per page.
 * @returns {Promise<Uint8Array[]>}
 */
export async function splitPdfEveryPage(file) {
  const srcBytes = new Uint8Array(await file.arrayBuffer())
  const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true })
  const n = src.getPageCount()
  const out = []
  for (let i = 0; i < n; i++) {
    const dst = await PDFDocument.create()
    const [page] = await dst.copyPages(src, [i])
    dst.addPage(page)
    out.push(await dst.save())
  }
  return out
}
