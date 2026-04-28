import { PDFDocument } from 'pdf-lib'
import { apiUrl } from './apiBase.js'

/** @typedef {'low'|'medium'|'high'} CompressionLevel */

export const COMPRESSION_LEVELS = /** @type {const} */ (['low', 'medium', 'high'])

/**
 * @param {string} level
 * @returns {CompressionLevel}
 */
export function normalizeCompressionLevel(level) {
  return COMPRESSION_LEVELS.includes(level) ? level : 'medium'
}

function isPdfMagic(bytes) {
  if (!bytes || bytes.byteLength < 4) return false
  return String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === '%PDF'
}

/**
 * pdf-lib-only path when the API (qpdf) is unavailable. Rewrites structure; may not reduce bytes much.
 * Uses copyPages + object streams for all levels so fallback is as effective as pdf-lib allows.
 * @param {Uint8Array} bytes
 * @param {CompressionLevel} level
 */
async function compressPdfBytesPdfLib(bytes, level) {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const n = src.getPageCount()
  if (n < 1) {
    return src.save({ useObjectStreams: true, updateFieldAppearances: false })
  }

  const saveOpts = { updateFieldAppearances: false }

  /** Strongest pdf-lib path — copy into a fresh doc (often smaller than in-place save). */
  const dst = await PDFDocument.create()
  const copied = await dst.copyPages(src, src.getPageIndices())
  copied.forEach((page) => dst.addPage(page))

  if (level === 'high') {
    return dst.save({ ...saveOpts, useObjectStreams: true })
  }

  if (level === 'medium') {
    return dst.save({ ...saveOpts, useObjectStreams: true })
  }

  return dst.save({ ...saveOpts, useObjectStreams: false })
}

/**
 * Preferred: server **qpdf** recompresses streams (real size reduction). Falls back to pdf-lib if the
 * API is unreachable or qpdf is not installed (e.g. static hosting only).
 *
 * @param {Uint8Array} bytes
 * @param {CompressionLevel} level
 * @param {{ fileName?: string }} [opts]
 * @returns {Promise<{ bytes: Uint8Array, via: 'api' | 'fallback' }>}
 */
export async function compressPdfBytes(bytes, level, opts = {}) {
  const fileName = typeof opts.fileName === 'string' && opts.fileName.trim() ? opts.fileName : 'document.pdf'
  if (typeof fetch === 'function') {
    try {
      const fd = new FormData()
      fd.append('level', level)
      const filePart =
        typeof File !== 'undefined'
          ? new File([bytes], fileName, { type: 'application/pdf' })
          : new Blob([bytes], { type: 'application/pdf' })
      fd.append('file', filePart)

      const res = await fetch(apiUrl('/compress-pdf'), {
        method: 'POST',
        body: fd,
        credentials: 'omit',
        mode: 'cors',
      })

      const ct = res.headers.get('content-type') || ''
      const buf = new Uint8Array(await res.arrayBuffer())

      if (res.ok && buf.byteLength > 0 && isPdfMagic(buf)) {
        return { bytes: buf, via: 'api' }
      }

      console.warn(
        '[compress-pdf] API not usable (status',
        res.status,
        'content-type:',
        ct,
        'len:',
        buf.byteLength,
        'pdf magic:',
        isPdfMagic(buf),
        ') — using pdf-lib fallback'
      )
    } catch (e) {
      console.warn('[compress-pdf] API call failed, using pdf-lib fallback:', e?.message || e)
    }
  }

  const out = await compressPdfBytesPdfLib(bytes, level)
  return { bytes: out, via: 'fallback' }
}
