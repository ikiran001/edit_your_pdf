import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const PAGE_W = 595
const PAGE_H = 842
const M = 40
const LINE_H = 11
const FOOTER_RESERVE = 72

function n(v) {
  const x = Number(String(v).replace(/,/g, '').trim())
  return Number.isFinite(x) ? x : 0
}

function money(x) {
  return (Math.round(x * 100) / 100).toFixed(2)
}

/** Embed PNG/JPEG from a browser data URL onto the PDF. */
async function embedDataUrlImage(doc, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.*)$/i)
  if (!m || !m[2]) return null
  let binary
  try {
    binary = atob(m[2].replace(/\s/g, ''))
  } catch {
    return null
  }
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i)
  try {
    if (/png/i.test(m[1])) return await doc.embedPng(bytes)
    return await doc.embedJpg(bytes)
  } catch {
    return null
  }
}

function normState(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
    .slice(0, 2)
}

/** @param {{ qty: number, rate: number, gstPercent: number }[]} items */
export function calculateGstTotals(items, sellerStateCode, buyerStateCode) {
  const intra = normState(sellerStateCode) === normState(buyerStateCode) && normState(sellerStateCode).length === 2
  let taxable = 0
  let cgst = 0
  let sgst = 0
  let igst = 0
  for (const it of items) {
    const q = n(it.qty)
    const r = n(it.rate)
    const g = n(it.gstPercent)
    const t = q * r
    taxable += t
    if (intra) {
      const half = g / 2
      cgst += (t * half) / 100
      sgst += (t * half) / 100
    } else {
      igst += (t * g) / 100
    }
  }
  const grand = taxable + cgst + sgst + igst
  return { taxable, cgst, sgst, igst, grand, intra }
}

function wrapToWidth(text, maxChars) {
  const s = String(text || '').trim() || '—'
  if (s.length <= maxChars) return [s]
  const out = []
  let i = 0
  while (i < s.length) {
    out.push(s.slice(i, i + maxChars))
    i += maxChars
  }
  return out
}

/**
 * @param {object} form
 * @param {{ description: string, hsn: string, qty: number|string, rate: number|string, gstPercent: number|string }[]} form.items
 * @returns {Promise<Uint8Array>}
 */
export async function buildGstInvoicePdfBytes(form) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - M

  const draw = (text, x, yy, opts = {}) => {
    const f = opts.bold ? bold : font
    const size = opts.size ?? 9
    const color = opts.color ?? rgb(0.12, 0.12, 0.14)
    page.drawText(String(text), { x, y: yy, size, font: f, color })
  }

  const ensureSpace = (need) => {
    if (y - need < FOOTER_RESERVE) {
      page = doc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - M
    }
  }

  const totals = calculateGstTotals(form.items || [], form.sellerStateCode, form.buyerStateCode)
  const logoImage = await embedDataUrlImage(doc, form.logoDataUrl)

  const invLabel = form.invoiceType === 'bill_of_supply' ? 'BILL OF SUPPLY' : 'TAX INVOICE (GST)'
  draw(invLabel, M, y, { size: 14, bold: true })
  if (logoImage) {
    const lw = 68
    const lh = (logoImage.height * lw) / logoImage.width
    // pdf-lib: image y is bottom edge; align top of logo with title band
    page.drawImage(logoImage, {
      x: PAGE_W - M - lw,
      y: y - lh,
      width: lw,
      height: lh,
    })
  }
  y -= LINE_H * 2

  draw('Seller (Supplier)', M, y, { bold: true, size: 10 })
  draw('Buyer (Recipient)', PAGE_W / 2, y, { bold: true, size: 10 })
  y -= LINE_H * 1.2

  const sellerPan = String(form.sellerPan || '').trim()
  const buyerPan = String(form.buyerPan || '').trim()
  const leftBlock = []
  if (String(form.sellerTradeName || '').trim()) {
    leftBlock.push(`Trade / brand: ${String(form.sellerTradeName).trim()}`)
  }
  leftBlock.push(`Legal name: ${form.sellerName || '—'}`)
  leftBlock.push(form.sellerAddress || '')
  leftBlock.push(
    sellerPan
      ? `GSTIN: ${form.sellerGstin || '—'}    PAN: ${sellerPan}`
      : `GSTIN: ${form.sellerGstin || '—'}`
  )
  leftBlock.push(`State code: ${normState(form.sellerStateCode) || '—'}`)

  const rightBlock = []
  if (String(form.buyerTradeName || '').trim()) {
    rightBlock.push(`Trade / brand: ${String(form.buyerTradeName).trim()}`)
  }
  rightBlock.push(`Legal name: ${form.buyerName || '—'}`)
  rightBlock.push(form.buyerAddress || '')
  rightBlock.push(
    buyerPan
      ? `GSTIN: ${form.buyerGstin || '—'}    PAN: ${buyerPan}`
      : `GSTIN: ${form.buyerGstin || '—'}`
  )
  rightBlock.push(`State code: ${normState(form.buyerStateCode) || '—'}`)

  const maxLines = Math.max(leftBlock.length, rightBlock.length)
  for (let i = 0; i < maxLines; i += 1) {
    ensureSpace(LINE_H * 2)
    const la = wrapToWidth(leftBlock[i] || '', 48)
    const ra = wrapToWidth(rightBlock[i] || '', 48)
    const h = Math.max(la.length, ra.length) * LINE_H
    let yy = y
    for (const line of la) {
      draw(line, M, yy, { size: 8.5 })
      yy -= LINE_H
    }
    yy = y
    for (const line of ra) {
      draw(line, PAGE_W / 2, yy, { size: 8.5 })
      yy -= LINE_H
    }
    y -= h + 2
  }

  ensureSpace(LINE_H * 4)
  draw(`Invoice No: ${form.invoiceNo || '—'}    Date: ${form.invoiceDate || '—'}`, M, y, { size: 9 })
  y -= LINE_H * 1.3
  draw(`Place of supply: ${form.placeOfSupply || '—'}`, M, y, { size: 9 })
  y -= LINE_H * 1.2
  if (String(form.sellerPhone || '').trim() || String(form.sellerEmail || '').trim()) {
    draw(
      `Supplier contact: ${[form.sellerPhone, form.sellerEmail].filter((x) => String(x || '').trim()).join(' · ')}`,
      M,
      y,
      { size: 8 }
    )
    y -= LINE_H * 1.2
  }
  y -= LINE_H * 1.3
  if (form.reverseCharge) {
    draw('Reverse charge: Yes', M, y, { size: 9, bold: true })
    y -= LINE_H * 1.3
  }
  y -= LINE_H * 0.5

  const cx = {
    desc: M,
    hsn: M + 198,
    qty: M + 258,
    rate: M + 292,
    taxable: M + 334,
    gst: M + 388,
    cgst: M + 422,
    sgst: M + 462,
    igst: M + 502,
  }
  const hdr = ['Description', 'HSN', 'Qty', 'Rate', 'Taxable', 'GST%', 'CGST', 'SGST', 'IGST']
  ensureSpace(LINE_H * 2)
  draw(hdr[0], cx.desc, y, { bold: true, size: 8 })
  draw(hdr[1], cx.hsn, y, { bold: true, size: 8 })
  draw(hdr[2], cx.qty, y, { bold: true, size: 8 })
  draw(hdr[3], cx.rate, y, { bold: true, size: 8 })
  draw(hdr[4], cx.taxable, y, { bold: true, size: 8 })
  draw(hdr[5], cx.gst, y, { bold: true, size: 8 })
  draw(hdr[6], cx.cgst, y, { bold: true, size: 8 })
  draw(hdr[7], cx.sgst, y, { bold: true, size: 8 })
  draw(hdr[8], cx.igst, y, { bold: true, size: 8 })
  y -= LINE_H * 1.2
  page.drawLine({ start: { x: M, y: y + 3 }, end: { x: PAGE_W - M, y: y + 3 }, thickness: 0.4, color: rgb(0.4, 0.4, 0.45) })
  y -= LINE_H * 0.8

  for (const it of form.items || []) {
    const q = n(it.qty)
    const r = n(it.rate)
    const g = n(it.gstPercent)
    const t = q * r
    let c = 0
    let s = 0
    let ig = 0
    if (totals.intra) {
      c = (t * (g / 2)) / 100
      s = (t * (g / 2)) / 100
    } else {
      ig = (t * g) / 100
    }
    const descLines = wrapToWidth(it.description || '—', 34)
    const blockH = Math.max(descLines.length, 1) * LINE_H + 4
    ensureSpace(blockH + LINE_H)
    let yy = y
    for (const dl of descLines) {
      draw(dl, cx.desc, yy, { size: 8 })
      yy -= LINE_H
    }
    draw(String(it.hsn || '—'), cx.hsn, y, { size: 8 })
    draw(money(q), cx.qty, y, { size: 8 })
    draw(money(r), cx.rate, y, { size: 8 })
    draw(money(t), cx.taxable, y, { size: 8 })
    draw(`${g}%`, cx.gst, y, { size: 8 })
    draw(money(c), cx.cgst, y, { size: 8 })
    draw(money(s), cx.sgst, y, { size: 8 })
    draw(money(ig), cx.igst, y, { size: 8 })
    y -= blockH
  }

  ensureSpace(LINE_H * 8)
  y -= LINE_H * 0.5
  page.drawLine({ start: { x: M, y: y + 3 }, end: { x: PAGE_W - M, y: y + 3 }, thickness: 0.4, color: rgb(0.4, 0.4, 0.45) })
  y -= LINE_H * 1.2
  draw(`Total taxable value: ${money(totals.taxable)}`, M, y, { bold: true })
  y -= LINE_H * 1.2
  draw(`CGST: ${money(totals.cgst)}    SGST: ${money(totals.sgst)}    IGST: ${money(totals.igst)}`, M, y, { size: 9 })
  y -= LINE_H * 1.4
  draw(`Invoice total: ${money(totals.grand)}`, M, y, { bold: true, size: 11 })
  y -= LINE_H * 2.5

  const bankLines = []
  if (String(form.bankName || '').trim()) bankLines.push(`Bank: ${String(form.bankName).trim()}`)
  if (String(form.bankAccount || '').trim()) bankLines.push(`A/c: ${String(form.bankAccount).trim()}`)
  if (String(form.bankIfsc || '').trim()) bankLines.push(`IFSC: ${String(form.bankIfsc).trim()}`)
  if (String(form.bankUpi || '').trim()) bankLines.push(`UPI: ${String(form.bankUpi).trim()}`)
  if (bankLines.length) {
    ensureSpace(LINE_H * (bankLines.length + 2))
    draw('Bank details', M, y, { bold: true, size: 9 })
    y -= LINE_H * 1.2
    for (const bl of bankLines) {
      draw(bl, M, y, { size: 8.5 })
      y -= LINE_H * 1.1
    }
    y -= LINE_H * 0.5
  }

  const notes = String(form.notes || '').trim()
  if (notes) {
    ensureSpace(LINE_H * 4)
    draw('Notes / terms', M, y, { bold: true, size: 9 })
    y -= LINE_H * 1.2
    for (const chunk of wrapToWidth(notes, 92)) {
      ensureSpace(LINE_H * 1.2)
      draw(chunk, M, y, { size: 8 })
      y -= LINE_H * 1.05
    }
    y -= LINE_H * 0.5
  }

  const disc = [
    'This PDF is generated in your browser for convenience. It is not legal or tax advice.',
    'Verify GST rates, HSN/SAC, place of supply, and e-invoicing / e-way rules with a qualified CA before filing returns.',
    totals.intra
      ? 'CGST + SGST split assumes intra-state supply (same 2-digit state code for supplier and recipient).'
      : 'IGST shown assumes inter-state supply (supplier and recipient state codes differ).',
  ]
  for (const line of disc) {
    for (const chunk of wrapToWidth(line, 92)) {
      ensureSpace(LINE_H * 1.2)
      draw(chunk, M, y, { size: 7.5, color: rgb(0.35, 0.35, 0.38) })
      y -= LINE_H * 1.05
    }
    y -= 2
  }

  return doc.save()
}
