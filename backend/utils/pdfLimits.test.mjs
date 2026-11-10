/**
 * Tests for the PDF page-count bomb guard. Run: node --test utils/pdfLimits.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { guardPdfPageCount } from './pdfLimits.js'

async function makePdf(pages) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i += 1) doc.addPage([200, 200])
  return Buffer.from(await doc.save())
}

test('allows a PDF within the page cap', async () => {
  const buf = await makePdf(3)
  const r = await guardPdfPageCount(buf, 500)
  assert.equal(r.ok, true)
  assert.equal(r.pageCount, 3)
})

test('rejects a PDF over the page cap with 413', async () => {
  const buf = await makePdf(6)
  const r = await guardPdfPageCount(buf, 5)
  assert.equal(r.ok, false)
  assert.equal(r.status, 413)
  assert.equal(r.body.error, 'too_many_pages')
  assert.equal(r.pageCount, 6)
})

test('fails open on unparseable / non-PDF input (lets downstream+timeout handle it)', async () => {
  const r = await guardPdfPageCount(Buffer.from('this is not a pdf'), 5)
  assert.equal(r.ok, true)
  assert.equal(r.pageCount, null)
})
