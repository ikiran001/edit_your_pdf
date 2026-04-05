/**
 * Downloads Noto Sans static TTFs (OFL) for pdf-lib native-text Unicode + real bold/italic faces.
 * Run from repo root: npm run fonts:noto --prefix backend
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEST = path.join(__dirname, '../fonts')
const BASE = 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans'
const FILES = [
  'NotoSans-Regular.ttf',
  'NotoSans-Bold.ttf',
  'NotoSans-Italic.ttf',
  'NotoSans-BoldItalic.ttf',
]

fs.mkdirSync(DEST, { recursive: true })

for (const f of FILES) {
  const url = `${BASE}/${f}`
  const out = path.join(DEST, f)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  fs.writeFileSync(out, buf)
  console.log('wrote', out, `(${buf.length} bytes)`)
}
