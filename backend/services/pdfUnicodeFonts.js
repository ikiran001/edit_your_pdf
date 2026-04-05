import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, '../fonts');

/** True when string needs more than basic ASCII (Latin-1+ symbols, Indic scripts, etc.). */
export function needsNonAsciiText(s) {
  return /[^\u0000-\u007f]/.test(String(s ?? ''));
}

/** Devanagari block — Hindi, Marathi, Nepali, etc. */
export function containsDevanagari(s) {
  return /[\u0900-\u097F]/.test(String(s ?? ''));
}

let latinMemo;
let devaMemo;

function readFontFiles(dir, spec) {
  const out = {};
  for (const [key, fname] of Object.entries(spec)) {
    const p = path.join(dir, fname);
    if (!fs.existsSync(p)) return null;
    out[key] = new Uint8Array(fs.readFileSync(p));
  }
  return out;
}

/** All four Latin Noto Sans static files must exist. */
export function loadLatinNotoBytesIfComplete() {
  if (latinMemo !== undefined) return latinMemo;
  const spec = {
    normal: 'NotoSans-Regular.ttf',
    bold: 'NotoSans-Bold.ttf',
    italic: 'NotoSans-Italic.ttf',
    bolditalic: 'NotoSans-BoldItalic.ttf',
  };
  latinMemo = readFontFiles(FONTS_DIR, spec);
  return latinMemo;
}

/** Regular + Bold; no separate italic files in upstream static set. */
export function loadDevanagariNotoBytesIfComplete() {
  if (devaMemo !== undefined) return devaMemo;
  const spec = {
    normal: 'NotoSansDevanagari-Regular.ttf',
    bold: 'NotoSansDevanagari-Bold.ttf',
  };
  devaMemo = readFontFiles(FONTS_DIR, spec);
  return devaMemo;
}

/**
 * Choose embedded Noto variant. Devanagari text uses Noto Sans Devanagari (includes Latin for mixed lines).
 * Other Unicode uses full Latin Noto (bold / italic / bolditalic).
 */
export function pickNotoVariantKey(raw, bold, italic) {
  const b = !!bold;
  const i = !!italic;
  if (containsDevanagari(raw)) {
    return { script: 'devanagari', bytesKey: b ? 'bold' : 'normal' };
  }
  if (b && i) return { script: 'latin', bytesKey: 'bolditalic' };
  if (b) return { script: 'latin', bytesKey: 'bold' };
  if (i) return { script: 'latin', bytesKey: 'italic' };
  return { script: 'latin', bytesKey: 'normal' };
}

export function getNotoBytesForVariant(script, bytesKey) {
  if (script === 'devanagari') {
    const d = loadDevanagariNotoBytesIfComplete();
    return d ? d[bytesKey] : null;
  }
  const l = loadLatinNotoBytesIfComplete();
  return l ? l[bytesKey] : null;
}

function* iterateGraphemeClusters(str) {
  const s = String(str ?? '');
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    for (const { segment } of seg.segment(s)) {
      if (segment) yield segment;
    }
    return;
  }
  const re = /\P{Mark}\p{Mark}*/gu;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m[0]) yield m[0];
  }
}

/**
 * Prefer one shaped string (no dotted circles). If fontkit GPOS fails, use grapheme clusters
 * (keeps matras with consonants). Last resort: codepoints inside a failing cluster only (हे, etc.).
 */
export function widthOfTextDevanagariBestEffort(font, raw, sizePt) {
  const s = String(raw ?? '');
  if (!s) return 0;
  try {
    return font.widthOfTextAtSize(s, sizePt);
  } catch {
    let w = 0;
    for (const segment of iterateGraphemeClusters(s)) {
      try {
        w += font.widthOfTextAtSize(segment, sizePt);
      } catch {
        for (let i = 0; i < segment.length; ) {
          const c = segment.codePointAt(i);
          const ch = String.fromCodePoint(c);
          i += c > 0xffff ? 2 : 1;
          try {
            w += font.widthOfTextAtSize(ch, sizePt);
          } catch {
            /* skip */
          }
        }
      }
    }
    return w;
  }
}

export function drawTextDevanagariBestEffort(page, raw, drawOpts) {
  const s = String(raw ?? '');
  if (!s) return;
  try {
    page.drawText(s, drawOpts);
    return;
  } catch {
    /* fall through */
  }
  const { font, size } = drawOpts;
  let x = drawOpts.x;
  for (const segment of iterateGraphemeClusters(s)) {
    try {
      page.drawText(segment, { ...drawOpts, x });
      x += font.widthOfTextAtSize(segment, size);
    } catch {
      for (let i = 0; i < segment.length; ) {
        const c = segment.codePointAt(i);
        const ch = String.fromCodePoint(c);
        i += c > 0xffff ? 2 : 1;
        try {
          page.drawText(ch, { ...drawOpts, x });
          x += font.widthOfTextAtSize(ch, size);
        } catch {
          /* skip missing glyph */
        }
      }
    }
  }
}

/**
 * Embeds Noto TTF for replacement / annotation text when non-ASCII is present.
 * @param {import('pdf-lib').PDFDocument} doc
 * @param {unknown} fontkitModule — `@pdf-lib/fontkit` default export
 * @param {{ cache: Map<string, import('pdf-lib').PDFFont>, fontkitRegistered: boolean }} state
 */
export async function embedUnicodeFontIfAvailable(doc, fontkitModule, raw, bold, italic, state) {
  if (!needsNonAsciiText(raw)) return null;
  let { script, bytesKey } = pickNotoVariantKey(raw, bold, italic);
  let bytes = getNotoBytesForVariant(script, bytesKey);
  let cacheKey = `${script}:${bytesKey}`;
  if (!bytes && script === 'devanagari') {
    const lk =
      bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
    bytes = getNotoBytesForVariant('latin', lk);
    cacheKey = `latin:${lk}`;
  }
  if (!bytes) return null;
  if (state.cache.has(cacheKey)) {
    return { font: state.cache.get(cacheKey), isUnicodeEmbedded: true };
  }
  if (!state.fontkitRegistered) {
    doc.registerFontkit(fontkitModule);
    state.fontkitRegistered = true;
  }
  /* subset:true can drop complex-script glyphs and triggers fontkit layout edge cases for some clusters */
  const embedded = await doc.embedFont(bytes, { subset: false });
  state.cache.set(cacheKey, embedded);
  return { font: embedded, isUnicodeEmbedded: true };
}
