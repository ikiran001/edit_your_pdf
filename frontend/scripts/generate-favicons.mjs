/**
 * Generates root favicons from public/favicon.svg (ICO + 48×48 favicon.png for Google Search).
 * Run: npm run generate-favicons
 */
import fs from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const svgPath = path.join(publicDir, 'favicon.svg')

async function png(size) {
  return sharp(svgPath).resize(size, size).png().toBuffer()
}

const buf16 = await png(16)
const buf32 = await png(32)
const buf48 = await png(48)
const buf180 = await png(180)
const buf192 = await png(192)

fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), buf16)
fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), buf32)
fs.writeFileSync(path.join(publicDir, 'favicon-48x48.png'), buf48)
fs.writeFileSync(path.join(publicDir, 'favicon.png'), buf48)
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), buf180)
fs.writeFileSync(path.join(publicDir, 'favicon-192x192.png'), buf192)

const ico = await pngToIco([buf16, buf32, buf48])
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico)

console.log(
  'Wrote favicon.ico, favicon.png (48×48), favicon-16/32/48.png, favicon-192x192.png, apple-touch-icon.png'
)
