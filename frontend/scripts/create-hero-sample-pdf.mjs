/**
 * Writes frontend/public/hero-sample.pdf — one-page sample for “Try sample PDF”.
 * Run from repo root: node frontend/scripts/create-hero-sample-pdf.mjs
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, '../public/hero-sample.pdf')

const doc = await PDFDocument.create()
const page = doc.addPage([612, 792])
const font = await doc.embedFont(StandardFonts.Helvetica)
const bold = await doc.embedFont(StandardFonts.HelveticaBold)

page.drawText('pdfpilot — sample PDF', {
  x: 50,
  y: 720,
  size: 22,
  font: bold,
  color: rgb(0.15, 0.12, 0.35),
})

page.drawText(
  'Try highlighting text, using Edit text, or adding annotations. When you are done, download your edited copy.',
  {
    x: 50,
    y: 680,
    size: 12,
    font,
    color: rgb(0.25, 0.25, 0.28),
    maxWidth: 512,
    lineHeight: 16,
  }
)

page.drawRectangle({ x: 50, y: 420, width: 512, height: 220, borderColor: rgb(0.75, 0.78, 0.9), borderWidth: 1 })
page.drawText('Your edits appear here.', { x: 70, y: 600, size: 11, font, color: rgb(0.45, 0.45, 0.5) })

fs.writeFileSync(out, await doc.save())
console.log('Wrote', out)
