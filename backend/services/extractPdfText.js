import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** Lazy pdfjs import — heavy module, only loaded when /ai/chat is hit. */
let pdfjsLibPromise = null;
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLibPromise;
}

const PKG = require('pdfjs-dist/package.json');
const STANDARD_FONT_DATA_URL = `https://unpkg.com/pdfjs-dist@${PKG.version}/standard_fonts/`;

/**
 * Extract selectable text from a PDF file on disk.
 * @param {string} filePath
 * @param {{ maxPages?: number }} [opts]
 * @returns {Promise<{ text: string, numPages: number, truncated: boolean }>}
 */
export async function extractPdfText(filePath, opts = {}) {
  const maxPages = Math.max(1, Number(opts.maxPages) || 200);
  const buf = await fs.promises.readFile(filePath);
  const data = new Uint8Array(buf);
  const { getDocument } = await loadPdfjs();
  const task = getDocument({ data, standardFontDataUrl: STANDARD_FONT_DATA_URL });
  const pdf = await task.promise;
  try {
    const numPages = pdf.numPages;
    const n = Math.min(numPages, maxPages);
    const chunks = [];
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      let line = '';
      for (const item of tc.items) {
        if (item && typeof item === 'object' && 'str' in item && item.str) {
          line += item.str + ' ';
        }
      }
      chunks.push(`--- Page ${i} ---\n${line.trim()}`);
    }
    return {
      text: chunks.join('\n\n'),
      numPages,
      truncated: numPages > n,
    };
  } finally {
    await pdf.destroy().catch(() => {});
  }
}
