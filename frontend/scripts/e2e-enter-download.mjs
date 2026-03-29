/**
 * UI test: upload PDF → Edit text → Enter → Download.
 * Requires: API :3001, Vite :5173, Playwright Chromium.
 *
 *   node frontend/scripts/e2e-enter-download.mjs
 *   node frontend/scripts/e2e-enter-download.mjs /path/to/file.pdf [out.pdf]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

const defaultSample = path.join(repoRoot, 'test-artifacts', 'sample-upload.pdf')
const inputPdf = process.argv[2]
  ? path.resolve(process.argv[2])
  : defaultSample
const outFile = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(repoRoot, 'test-artifacts', 'edited-enter-ui-verification.pdf')

async function main() {
  fs.mkdirSync(path.dirname(outFile), { recursive: true })

  if (!fs.existsSync(inputPdf)) {
    throw new Error(`PDF not found: ${inputPdf}`)
  }
  if (!process.argv[2] && !fs.existsSync(defaultSample)) {
    throw new Error(
      `Missing ${defaultSample} — run: node backend/scripts/verify-edit-pipeline.mjs`
    )
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  let nativeCount = -1

  page.on('request', (req) => {
    if (req.url().includes('/edit') && req.method() === 'POST') {
      try {
        const j = JSON.parse(req.postData() || '{}')
        nativeCount = (j.nativeTextEdits || []).length
      } catch {
        /* ignore */
      }
    }
  })

  await page.goto('http://127.0.0.1:5173', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/upload') && r.status() === 200,
      { timeout: 60000 }
    ),
    page.setInputFiles('#pdf-file-input', inputPdf),
  ])

  await page.waitForResponse(
    (r) => r.url().includes('/pdf/') && r.status() === 200,
    { timeout: 60000 }
  )
  await page.getByText(/Page 1/).first().waitFor({ timeout: 30000 })
  await page.waitForFunction(
    () => !document.body.innerText.includes('Detecting text on this page'),
    { timeout: 30000 }
  )

  const layer = page.getByRole('application', { name: 'Click PDF text to edit' })
  await layer.waitFor({ state: 'visible', timeout: 15000 })
  const b = await layer.boundingBox()
  if (!b) throw new Error('no hit layer')

  const tryPositions = [
    [0.5, 0.07],
    [0.35, 0.09],
    [0.22, 0.11],
    [0.5, 0.12],
    [0.25, 0.15],
  ]
  let opened = false
  for (const [px, py] of tryPositions) {
    await layer.click({ position: { x: b.width * px, y: b.height * py } })
    await page.waitForTimeout(400)
    if ((await page.locator('textarea').count()) > 0) {
      opened = true
      break
    }
  }
  if (!opened) {
    throw new Error(
      'Could not open native text editor — no text hit at tried positions (try a text-based PDF).'
    )
  }

  const ta = page.locator('textarea').first()
  await ta.waitFor({ state: 'visible', timeout: 5000 })
  await ta.fill('EDITED_GUIDE_E2E_VERIFIED')

  await page.keyboard.press('Enter')
  await ta.waitFor({ state: 'detached', timeout: 5000 })

  const downloadPromise = page.waitForEvent('download', { timeout: 20000 })
  await page.getByRole('button', { name: 'Download PDF' }).click()
  const download = await downloadPromise
  await download.saveAs(outFile)

  if (nativeCount !== 1) {
    throw new Error(
      `Expected 1 nativeTextEdit in POST /edit after Enter, got ${nativeCount}`
    )
  }

  const st = fs.statSync(outFile)
  if (st.size < 200) throw new Error('Downloaded PDF suspiciously small')

  console.log('OK: source', inputPdf)
  console.log('OK: Enter committed; POST /edit nativeTextEdits=1')
  console.log('OK: wrote', outFile, `(${st.size} bytes)`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
