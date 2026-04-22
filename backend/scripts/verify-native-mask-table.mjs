/**
 * Smoke test: synthetic table PDF + nativeText mask → output PDF.
 * Also sanity-checks tightenNativeTextMaskRect (no server required).
 *
 *   node backend/scripts/verify-native-mask-table.mjs
 *
 * Writes: ../../test-artifacts/native-mask-table-smoke.pdf
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { applyEditsToPdf, tightenNativeTextMaskRect } from '../services/applyEdits.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../../test-artifacts')

function main() {
  fs.mkdirSync(outDir, { recursive: true })

  const t = tightenNativeTextMaskRect(50, 400, 180, 14, 10.5)
  if (!(t.width > 0 && t.height > 0 && t.width < 180 && t.height < 14)) {
    throw new Error(`unexpected tighten result: ${JSON.stringify(t)}`)
  }
  if (!(t.y > 400)) {
    throw new Error('expected PDF-space top inset (y increases from bottom)')
  }
  console.log('tightenNativeTextMaskRect(180×14):', t)

  return (async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([400, 300])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    for (let i = 0; i < 6; i++) {
      const yy = 40 + i * 35
      page.drawLine({
        start: { x: 40, y: yy },
        end: { x: 360, y: yy },
        thickness: 0.75,
        color: rgb(0, 0, 0),
      })
    }
    page.drawLine({
      start: { x: 120, y: 40 },
      end: { x: 120, y: 220 },
      thickness: 0.75,
      color: rgb(0, 0, 0),
    })
    page.drawText('Dependent 1', {
      x: 48,
      y: 138,
      size: 10,
      font,
      color: rgb(0.35, 0.35, 0.35),
    })
    const bytes = new Uint8Array(await doc.save())

    const outBytes = await applyEditsToPdf(
      bytes,
      {
        pages: [
          {
            pageIndex: 0,
            items: [
              {
                type: 'nativeText',
                x: 48,
                y: 130,
                w: 62,
                h: 12,
                baseline: 138,
                fontSize: 10,
                fontFamily: 'Helvetica',
                bold: false,
                italic: false,
                underline: false,
                align: 'left',
                color: '#333333',
                opacity: 1,
                rotationDeg: 0,
                maskColor: '#ffffff',
                text: 'Dependent X',
              },
            ],
          },
        ],
      },
      {}
    )

    const out = path.join(outDir, 'native-mask-table-smoke.pdf')
    fs.writeFileSync(out, Buffer.from(outBytes))
    console.log('OK: wrote', out, `(${outBytes.byteLength} bytes)`)
  })()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
