import JSZip from 'jszip'

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

/**
 * Word paragraph: runs, hyperlinks, content controls, etc. — collect w:t, w:tab, w:br.
 * @param {Element} pEl
 * @returns {string}
 */
function extractParagraphPlainText(pEl) {
  let out = ''
  const walk = (el) => {
    for (const child of el.children) {
      if (child.namespaceURI !== W_NS) continue
      const tag = child.localName
      if (tag === 'r') {
        for (const rc of child.children) {
          if (rc.namespaceURI !== W_NS) continue
          const rt = rc.localName
          if (rt === 't') out += rc.textContent || ''
          else if (rt === 'tab') out += '\t'
          else if (rt === 'br' || rt === 'cr') out += '\n'
        }
      } else {
        walk(child)
      }
    }
  }
  walk(pEl)
  return out
}

export const CLIENT_DOCX_MAX_BYTES = 28 * 1024 * 1024

/**
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>} UTF-8 plain text (paragraphs joined with \n)
 */
export async function extractDocxPlainText(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const entry = zip.file('word/document.xml')
  if (!entry) throw new Error('missing_document_xml')
  const xml = await entry.async('string')
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('invalid_docx_xml')

  const paras = doc.getElementsByTagNameNS(W_NS, 'p')
  const lines = []
  for (let i = 0; i < paras.length; i++) {
    lines.push(extractParagraphPlainText(paras[i]))
  }
  return lines.join('\n')
}
