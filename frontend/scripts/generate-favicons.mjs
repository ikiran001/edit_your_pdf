/**
 * Generates favicon.ico, favicon-16x16.png, favicon-32x32.png from public/favicon.svg.
 * Run: npm run generate-favicons
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const svgPath = path.join(publicDir, 'favicon.svg')

const buf16 = await sharp(svgPath).resize(16, 16).png().toBuffer()
const buf32 = await sharp(svgPath).resize(32, 32).png().toBuffer()

fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), buf16)
fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), buf32)

const ico = await pngToIco([buf16, buf32])
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico)

console.log('Wrote favicon.ico, favicon-16x16.png, favicon-32x32.png')
