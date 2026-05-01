import { Document, Packer, Paragraph, TextRun } from 'docx'
import { sanitizeDocxText } from '../../lib/sanitizeDocxText.js'

/** Word paragraph runs are safest under ~8k chars */
const MAX_RUN_CHARS = 7500

function paragraphsFromLines(lines) {
  const out = []
  for (let rawLine of lines) {
    let line = sanitizeDocxText(rawLine)
    if (!line.length) {
      out.push(new Paragraph({ children: [new TextRun({ text: '\u00a0' })] }))
      continue
    }
    while (line.length > MAX_RUN_CHARS) {
      const chunk = line.slice(0, MAX_RUN_CHARS)
      line = line.slice(MAX_RUN_CHARS)
      out.push(new Paragraph({ children: [new TextRun({ text: chunk })] }))
    }
    out.push(new Paragraph({ children: [new TextRun({ text: line })] }))
  }
  return out
}

/**
 * @param {string} rawText
 * @returns {Promise<Blob>}
 */
export async function buildMinimalDocxBlob(rawText) {
  let body = sanitizeDocxText(rawText).replace(/\r\n/g, '\n').trim()
  if (!body.length) {
    throw new Error('empty_text')
  }
  const lines = body.split('\n')
  const children = paragraphsFromLines(lines.length ? lines : [' '])
  const doc = new Document({
    sections: [{ properties: {}, children }],
  })
  // Browser: Packer.toBuffer uses Node Buffer ("nodebuffer is not supported by this platform").
  const blob = await Packer.toBlob(doc)
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
  if (head.length < 4 || head[0] !== 0x50 || head[1] !== 0x4b) {
    throw new Error('invalid_docx_zip')
  }
  return new Blob([blob], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
