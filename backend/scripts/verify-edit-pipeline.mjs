/**
 * End-to-end API check: upload → POST /edit (native text) → GET /download.
 * Writes the downloaded bytes to ../../test-artifacts/edited-api-verification.pdf
 *
 * Usage (from repo): start API on 3001, then:
 *   node backend/scripts/verify-edit-pipeline.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')
const outDir = path.join(repoRoot, 'test-artifacts')
const API = process.env.API_URL || 'http://127.0.0.1:3001'

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Hello PDF Edit Test', {
    x: 72,
    y: 700,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  })
  const pdfBytes = new Uint8Array(await doc.save())
  const samplePath = path.join(outDir, 'sample-upload.pdf')
  fs.writeFileSync(samplePath, pdfBytes)

  const fd = new FormData()
  fd.append(
    'file',
    new Blob([pdfBytes], { type: 'application/pdf' }),
    'sample.pdf'
  )
  const up = await fetch(`${API}/upload`, { method: 'POST', body: fd })
  if (!up.ok) throw new Error(`upload failed ${up.status}: ${await up.text()}`)
  const { sessionId } = await up.json()

  const nativeTextEdits = [
    {
      pageIndex: 0,
      x: 72,
      y: 682,
      w: 200,
      h: 22,
      baseline: 700,
      fontSize: 18,
      text: 'VERIFIED_SAVE_AND_DOWNLOAD',
    },
  ]

  const ed = await fetch(`${API}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      edits: { pages: [] },
      applyTextSwap: false,
      nativeTextEdits,
    }),
  })
  if (!ed.ok) throw new Error(`edit failed ${ed.status}: ${await ed.text()}`)

  const dl = await fetch(
    `${API}/download?sessionId=${encodeURIComponent(sessionId)}`
  )
  if (!dl.ok) throw new Error(`download failed ${dl.status}`)

  const buf = Buffer.from(await dl.arrayBuffer())
  const finalPath = path.join(outDir, 'edited-api-verification.pdf')
  fs.writeFileSync(finalPath, buf)
  console.log('OK: wrote', finalPath, `(${buf.length} bytes)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
