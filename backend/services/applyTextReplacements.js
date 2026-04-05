import 'regenerator-runtime/runtime.js';
import { Buffer } from 'node:buffer';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  containsDevanagari,
  drawTextDevanagariBestEffort,
  embedUnicodeFontIfAvailable,
} from './pdfUnicodeFonts.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** pdf.js rejects Node Buffers even though they subclass Uint8Array. */
function toUint8Array(pdfBytes) {
  if (pdfBytes instanceof Uint8Array && !Buffer.isBuffer(pdfBytes)) {
    return pdfBytes;
  }
  if (Buffer.isBuffer(pdfBytes)) {
    return new Uint8Array(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength);
  }
  if (pdfBytes instanceof ArrayBuffer) {
    return new Uint8Array(pdfBytes);
  }
  return new Uint8Array(pdfBytes);
}

/**
 * pdf.js may detach the ArrayBuffer passed to getDocument(). Never pass a view of the
 * same memory as pdf-lib or the caller's buffer — that corrupts subsequent reads.
 */
function copyForPdfJs(pdfBytes) {
  const src = toUint8Array(pdfBytes);
  const copy = new Uint8Array(src.byteLength);
  copy.set(src);
  return copy;
}

/**
 * Bounding box in pdf-lib space (origin bottom-left, y up).
 * `baseline` is PDF text baseline y; `y` is rectangle bottom edge.
 */
function charRangeBBox(item, startIdx, endIdx) {
  const [a, b, , d, e, f] = item.transform;
  const str = item.str;
  const totalW = item.width || 0;
  const n = Math.max(str.length, 1);
  const fontSize = Math.sqrt(a * a + b * b) || Math.abs(d) || 12;
  const x0 = e + (startIdx / n) * totalW;
  const w = ((endIdx - startIdx) / n) * totalW;
  const padX = Math.max(2, fontSize * 0.08);
  const desc = fontSize * 0.28;
  const asc = fontSize * 0.95;
  const yBottom = f - desc - 1.5;
  const h = asc + desc + 3;
  return {
    x: x0 - padX,
    y: yBottom,
    width: Math.max(w + padX * 2, 2),
    height: Math.max(h, 2),
    baseline: f,
    fontSize,
  };
}

/**
 * Apply white paint + Helvetica overlay for pattern / whole-item rules.
 * Rules example:
 *  { type: 'regexInItem', pattern: 'PDF\\\\s+editor', flags: 'gi', replace: 'PDF love' }
 *  { type: 'wholeItem', pattern: '^editor$', flags: 'i', replace: 'love' }
 */
export async function applyTextReplacements(pdfBytes, rules) {
  if (!rules?.length) return pdfBytes;

  const pdfJsData = copyForPdfJs(pdfBytes);
  const pdfJsDoc = await getDocument({
    data: pdfJsData,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  /** @type {{ pageIndex: number, bbox: ReturnType<typeof charRangeBBox>, text: string }[]} */
  const ops = [];

  for (let p = 1; p <= pdfJsDoc.numPages; p++) {
    const page = await pdfJsDoc.getPage(p);
    const { items } = await page.getTextContent();

    for (const item of items) {
      if (!('str' in item) || item.str == null) continue;
      const str = item.str;

      for (const rule of rules) {
        if (rule.type === 'wholeItem') {
          const re = new RegExp(rule.pattern, rule.flags || '');
          if (!re.test(str)) continue;
          const bbox = charRangeBBox(item, 0, str.length);
          ops.push({ pageIndex: p - 1, bbox, text: rule.replace });
        } else if (rule.type === 'regexInItem') {
          const re = new RegExp(rule.pattern, rule.flags || 'g');
          let m;
          const s = str;
          while ((m = re.exec(s)) !== null) {
            const bbox = charRangeBBox(item, m.index, m.index + m[0].length);
            ops.push({ pageIndex: p - 1, bbox, text: rule.replace });
            if (!re.global) break;
          }
        }
      }
    }
  }

  if (ops.length === 0) return pdfBytes;

  const doc = await PDFDocument.load(toUint8Array(pdfBytes), { ignoreEncryption: true });
  const baseFont = await doc.embedFont(StandardFonts.Helvetica);
  const notoUnicodeState = { cache: new Map(), fontkitRegistered: false };
  const pages = doc.getPages();

  // Paint all white masks first so later replacements are not covered by a nearby mask.
  for (const op of ops) {
    const page = pages[op.pageIndex];
    if (!page) continue;
    const { x, y, width, height } = op.bbox;
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: rgb(1, 1, 1),
    });
  }

  for (const op of ops) {
    const page = pages[op.pageIndex];
    if (!page) continue;
    const { x, baseline, fontSize } = op.bbox;
    const size = Math.min(Math.max(fontSize * 0.98, 6), 72);
    const raw = String(op.text || '');
    let tF = baseFont;
    let uni = false;
    const emb = await embedUnicodeFontIfAvailable(doc, fontkit, raw, false, false, notoUnicodeState);
    if (emb) {
      tF = emb.font;
      uni = emb.isUnicodeEmbedded;
    }
    const drawOpts = {
      x: x + 2,
      y: baseline,
      size,
      font: tF,
      color: rgb(0, 0, 0),
    };
    try {
      if (uni && containsDevanagari(raw)) {
        drawTextDevanagariBestEffort(page, raw, drawOpts);
      } else {
        page.drawText(raw, drawOpts);
      }
    } catch {
      if (!uni) {
        const safe = raw.replace(/[^\x20-\x7E]/g, '?');
        if (safe) page.drawText(safe, drawOpts);
      }
    }
  }

  return doc.save();
}

/** Default rules for the bundled “project guide” style PDFs (safe for pdf-editor-app paths). */
export const defaultEditorToLoveRules = [
  { type: 'regexInItem', pattern: 'PDF\\s+editor', flags: 'gi', replace: 'PDF love' },
  { type: 'wholeItem', pattern: '^editor$', flags: 'i', replace: 'love' },
];
