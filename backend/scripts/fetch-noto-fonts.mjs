/**
 * Downloads Noto Sans static TTFs (OFL) for pdf-lib native-text Unicode + real bold/italic faces.
 * Run from repo root: npm run fonts:noto --prefix backend
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEST = path.join(__dirname, '../fonts')
const LATIN =
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans'
const DEVA =
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari'

const FILES = [
  [LATIN, 'NotoSans-Regular.ttf'],
  [LATIN, 'NotoSans-Bold.ttf'],
  [LATIN, 'NotoSans-Italic.ttf'],
  [LATIN, 'NotoSans-BoldItalic.ttf'],
  [DEVA, 'NotoSansDevanagari-Regular.ttf'],
  [DEVA, 'NotoSansDevanagari-Bold.ttf'],
]

fs.mkdirSync(DEST, { recursive: true })

for (const [base, fname] of FILES) {
  const url = `${base}/${fname}`
  const out = path.join(DEST, fname)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  fs.writeFileSync(out, buf)
  console.log('wrote', out, `(${buf.length} bytes)`)
}
