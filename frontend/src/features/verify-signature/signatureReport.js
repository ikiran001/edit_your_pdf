// Builds a one-page PDF summary of a /verify-signature result, entirely in the
// browser. pdf-lib is loaded on demand so it only costs bytes when someone
// actually downloads a report.

function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

function statusLine(result) {
  if (!result.signed) return { text: 'This PDF is not digitally signed.', color: [0.6, 0.4, 0] }
  if (result.unreadable) {
    return { text: result.note || 'Signed, but the signature could not be verified.', color: [0.6, 0.4, 0] }
  }
  return result.integrity
    ? { text: 'Valid — the document has not been modified since signing.', color: [0.06, 0.5, 0.3] }
    : { text: 'Invalid — the document was modified after it was signed.', color: [0.7, 0.1, 0.1] }
}

function wrap(text, font, size, maxWidth) {
  const lines = []
  let cur = ''
  for (const word of String(text).split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word
    if (cur && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(cur)
      cur = word
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  return lines
}

export async function buildVerificationReport(result, fileName) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const margin = 50
  const maxWidth = 595 - margin * 2
  let y = 792

  const draw = (text, { size = 11, f = font, color = [0.12, 0.12, 0.14], gap = 16 } = {}) => {
    for (const ln of wrap(text, f, size, maxWidth)) {
      page.drawText(ln, { x: margin, y, size, font: f, color: rgb(...color) })
      y -= gap
    }
  }

  draw('PDF Signature Verification Report', { size: 18, f: bold, gap: 28 })
  draw(`File: ${fileName}`, { color: [0.35, 0.35, 0.4] })
  draw(`Checked: ${new Date().toLocaleString()}`, { color: [0.35, 0.35, 0.4], gap: 24 })

  const status = statusLine(result)
  draw(status.text, { size: 13, f: bold, color: status.color, gap: 26 })

  const signatures = result.signatures || []
  signatures.forEach((s, i) => {
    if (signatures.length > 1) draw(`Signature ${i + 1}`, { f: bold, gap: 18 })
    draw(`Signer: ${s.signer || 'Unknown signer'}`)
    if (s.issuedBy) draw(`Issued by: ${s.issuedBy}`)
    if (s.validFrom || s.validTo) draw(`Certificate valid: ${fmtDate(s.validFrom)} – ${fmtDate(s.validTo)}`)
    if (s.reason) draw(`Reason: ${s.reason}`)
    if (s.location) draw(`Location: ${s.location}`)
    if (s.authenticity !== undefined) {
      draw(s.authenticity ? 'Certificate chain is consistent.' : 'Certificate chain could not be validated.', {
        size: 10,
        color: [0.4, 0.4, 0.45],
      })
    }
    y -= 10
  })

  y -= 8
  draw(
    'Integrity is checked by recomputing the signed hash. Trust is validated against the signature’s own certificate chain, not an external authority list.',
    { size: 9, color: [0.45, 0.45, 0.5], gap: 12 }
  )

  return pdf.save()
}
