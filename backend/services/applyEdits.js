import 'regenerator-runtime/runtime.js';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import {
  containsDevanagari,
  drawTextDevanagariBestEffort,
  embedUnicodeFontIfAvailable,
  needsNonAsciiText,
  widthOfTextDevanagariBestEffort,
} from './pdfUnicodeFonts.js';

/** Coerce JSON / form quirks so `"false"` is not treated as true. */
function asBool(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    return false;
  }
  return Boolean(v);
}

function estimateUnicodeTextWidth(str, fontSizePt) {
  const n = [...String(str)].length || 0;
  return n * fontSizePt * 0.48;
}

/**
 * Convert UI normalized coords (origin top-left, y down) to PDF user space
 * (origin bottom-left, y up). Returns lower-left corner for rectangles.
 */
function normRectToPdf(pageWidth, pageHeight, nx, ny, nw, nh) {
  const x = nx * pageWidth;
  const w = nw * pageWidth;
  const h = nh * pageHeight;
  const y = (1 - ny - nh) * pageHeight;
  return { x, y, width: w, height: h };
}

function normPointToPdf(pageWidth, pageHeight, nx, ny) {
  return {
    x: nx * pageWidth,
    y: (1 - ny) * pageHeight,
  };
}

/** Must stay in sync with annot text `lineHeight` in `PdfPageCanvas.jsx` (currently 1.35). */
const ANNOT_UI_LINE_HEIGHT = 1.35;

/**
 * Editor anchors `item.x` / `item.y` at the top of the first line box. pdf-lib `drawText` uses the
 * alphabetic baseline. Offset = half-leading above the em box + ascender (pdf-lib), matching CSS.
 */
function annotBaselineYFromTopPdfY(tAnnot, fontSizePt, yTopPdf) {
  let ascenderPt;
  try {
    ascenderPt = tAnnot.heightAtSize(fontSizePt, { descender: false });
  } catch {
    ascenderPt = fontSizePt * 0.72;
  }
  if (!Number.isFinite(ascenderPt) || ascenderPt <= 0) {
    ascenderPt = fontSizePt * 0.72;
  }
  const halfLeading = (fontSizePt * (ANNOT_UI_LINE_HEIGHT - 1)) / 2;
  return yTopPdf - ascenderPt - halfLeading;
}

function parseHexColor(hex) {
  let h = String(hex || '#000000')
    .trim()
    .replace(/^#/, '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    h = '000000';
  }
  const n = parseInt(h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Shrink the native-text erase mask slightly on each side. The mask is drawn on top of the
 * existing page content; a full-bleed rectangle covers nearby vector strokes (table rules,
 * form borders). Insetting keeps glyphs covered while leaving grid lines that sit on cell
 * edges much more often intact.
 */
function tightenNativeTextMaskRect(maskX, maskY, maskW, maskH, fontSizePt) {
  const fs = Math.max(4, Math.min(144, Number(fontSizePt) || 12));
  const horiz = Math.min(maskW * 0.085, Math.max(0.55, fs * 0.085));
  const vert = Math.min(maskH * 0.14, Math.max(0.75, fs * 0.1));
  const nx = maskX + horiz;
  const ny = maskY + vert;
  const nw = maskW - 2 * horiz;
  const nh = maskH - 2 * vert;
  const minW = Math.max(2, fs * 0.38);
  const minH = Math.max(2, fs * 0.52);
  if (nw < minW || nh < minH) {
    return { x: maskX, y: maskY, width: maskW, height: maskH };
  }
  return { x: nx, y: ny, width: nw, height: nh };
}

/** Map UI font family + bold/italic to pdf-lib StandardFonts (Arial≈Helvetica, etc.). */
function resolveNativeStandardFont(fontFamily, bold, italic) {
  const fam = String(fontFamily || 'Helvetica').toLowerCase();
  const b = !!bold;
  const i = !!italic;
  if (fam.includes('times')) {
    if (b && i) return StandardFonts.TimesRomanBoldItalic;
    if (b) return StandardFonts.TimesRomanBold;
    if (i) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (fam.includes('courier')) {
    if (b && i) return StandardFonts.CourierBoldOblique;
    if (b) return StandardFonts.CourierBold;
    if (i) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (b && i) return StandardFonts.HelveticaBoldOblique;
  if (b) return StandardFonts.HelveticaBold;
  if (i) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

/**
 * Applies annotation payloads from the client onto a PDF using pdf-lib.
 * All positions use normalized 0–1 coords relative to each page (top-left origin).
 */
export async function applyEditsToPdf(pdfBytes, editsPayload) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const nativeFontCache = new Map();
  const notoUnicodeState = { cache: new Map(), fontkitRegistered: false };

  const pageGroups = editsPayload.pages || [];

  for (const group of pageGroups) {
    const pageIndex = Number(group.pageIndex);
    if (!Number.isFinite(pageIndex) || pageIndex < 0 || pageIndex >= pages.length) {
      continue;
    }
    const page = pages[pageIndex];
    const { width: W, height: H } = page.getSize();

    for (const item of group.items || []) {
      switch (item.type) {
        case 'nativeText': {
          const fontSizePt = Math.max(4, Math.min(144, Number(item.fontSize) || 12));
          const raw = String(item.text ?? '');
          const bold = asBool(item.bold);
          const italic = asBool(item.italic);
          const underline = asBool(item.underline);

          let tFont = null;
          let isUnicodeEmbedded = false;
          const embedded = await embedUnicodeFontIfAvailable(
            doc,
            fontkit,
            raw,
            bold,
            italic,
            notoUnicodeState
          );
          if (embedded) {
            tFont = embedded.font;
            isUnicodeEmbedded = embedded.isUnicodeEmbedded;
          }
          if (!tFont) {
            const fontEnum = resolveNativeStandardFont(item.fontFamily, bold, italic);
            tFont = nativeFontCache.get(fontEnum);
            if (!tFont) {
              tFont = await doc.embedFont(fontEnum);
              nativeFontCache.set(fontEnum, tFont);
            }
          }

          let textW = 0;
          if (isUnicodeEmbedded && containsDevanagari(raw)) {
            textW = raw.length ? widthOfTextDevanagariBestEffort(tFont, raw, fontSizePt) : 0;
          } else {
            try {
              textW = raw.length ? tFont.widthOfTextAtSize(raw, fontSizePt) : 0;
            } catch {
              if (isUnicodeEmbedded) {
                textW = estimateUnicodeTextWidth(raw, fontSizePt);
              } else if (needsNonAsciiText(raw)) {
                textW = estimateUnicodeTextWidth(raw, fontSizePt);
              } else {
                const safe = raw.replace(/[^\x20-\x7E]/g, '?');
                textW = safe.length ? tFont.widthOfTextAtSize(safe, fontSizePt) : 0;
              }
            }
          }
          const pad = Math.max(2, Math.min(7, fontSizePt * 0.17));
          const textColor = parseHexColor(item.color);
          let opacity = Number(item.opacity);
          if (!Number.isFinite(opacity)) opacity = 1;
          opacity = Math.min(1, Math.max(0.1, opacity));
          const rotationDeg = Number(item.rotationDeg) || 0;
          const align = item.align === 'center' || item.align === 'right' ? item.align : 'left';

          let maskX;
          let maskY;
          let maskW;
          let maskH;
          let textX;
          let baselinePdf;

          const n = item.norm;
          if (
            n &&
            Number.isFinite(n.nx) &&
            Number.isFinite(n.ny) &&
            Number.isFinite(n.nw) &&
            Number.isFinite(n.nh) &&
            Number.isFinite(n.baselineN)
          ) {
            const padXN = pad / W;
            const padYN = pad / H;
            const nx0 = Math.max(0, n.nx - padXN);
            const ny0 = Math.max(0, n.ny - padYN);
            const nw0 = Math.min(1 - nx0, n.nw + padXN * 2);
            const nh0 = Math.min(1 - ny0, n.nh + padYN * 2);
            const rect = normRectToPdf(W, H, nx0, ny0, nw0, nh0);
            maskX = rect.x;
            maskY = rect.y;
            maskW = rect.width;
            maskH = Math.max(rect.height, fontSizePt * 1.22);
            textX = n.nx * W + 0.75;
            baselinePdf = (1 - n.baselineN) * H;
            const needW = textX + textW + pad - (maskX + maskW);
            if (needW > 0) maskW += needW;
            maskW = Math.max(maskW, textW + pad * 2, fontSizePt * 0.5);
          } else {
            const bx = Number(item.x) || 0;
            const by = Number(item.y) || 0;
            const bw = Math.abs(Number(item.w) || 1);
            const bh = Math.abs(Number(item.h) || 1);
            baselinePdf = Number(item.baseline) || by + bh * 0.75;
            maskW = Math.max(bw, textW + pad * 2, fontSizePt * 0.5);
            maskH = Math.max(bh + pad * 2, fontSizePt * 1.22);
            maskX = bx - pad;
            maskY = by - pad;
            textX = Math.max(bx + 0.5, maskX + 1);
          }

          if (Math.abs(rotationDeg) > 0.5) {
            const f = 1 + Math.min(1.2, Math.abs(rotationDeg) / 90) * 0.45;
            const cx = maskX + maskW / 2;
            const cy = maskY + maskH / 2;
            maskW *= f;
            maskH *= f;
            maskX = cx - maskW / 2;
            maskY = cy - maskH / 2;
          }

          {
            const t = tightenNativeTextMaskRect(maskX, maskY, maskW, maskH, fontSizePt);
            maskX = t.x;
            maskY = t.y;
            maskW = t.width;
            maskH = t.height;
          }

          /* Paint-out original glyphs — match canvas-sampled fill when provided (colored tables), else white. */
          const maskHex =
            typeof item.maskColor === 'string' &&
            /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/i.test(item.maskColor.trim())
              ? item.maskColor.trim()
              : '#ffffff';
          page.drawRectangle({
            x: maskX,
            y: maskY,
            width: maskW,
            height: maskH,
            color: parseHexColor(maskHex),
          });

          /* Expand mask height to cover all lines before alignment/drawing. */
          const nativeLines = raw.split('\n');
          const nativeLineStep = fontSizePt * ANNOT_UI_LINE_HEIGHT;
          if (nativeLines.length > 1) {
            maskH = Math.max(maskH, nativeLines.length * nativeLineStep);
          }

          if (align === 'center') {
            textX = maskX + (maskW - textW) / 2;
          } else if (align === 'right') {
            textX = maskX + maskW - textW - pad * 0.5;
          } else {
            textX = Math.max(textX, maskX + 0.5);
          }

          for (let li = 0; li < nativeLines.length; li++) {
            const lineStr = nativeLines[li];
            const lineY = baselinePdf - li * nativeLineStep;
            const drawOpts = {
              x: textX,
              y: lineY,
              size: fontSizePt,
              font: tFont,
              color: textColor,
              opacity,
              rotate: degrees(rotationDeg),
            };

            /* Per-line width for alignment on lines 2+ */
            let lineW = textW;
            if (li > 0 && lineStr.length) {
              try { lineW = tFont.widthOfTextAtSize(lineStr, fontSizePt); } catch { /* keep textW */ }
              if (align === 'center') drawOpts.x = maskX + (maskW - lineW) / 2;
              else if (align === 'right') drawOpts.x = maskX + maskW - lineW - pad * 0.5;
            }

            try {
              if (isUnicodeEmbedded && containsDevanagari(lineStr)) {
                drawTextDevanagariBestEffort(page, lineStr, drawOpts);
              } else {
                page.drawText(lineStr, drawOpts);
              }
            } catch (drawErr) {
              if (isUnicodeEmbedded) {
                console.warn('[applyEdits] nativeText unicode draw failed:', drawErr?.message);
              } else if (needsNonAsciiText(lineStr)) {
                console.warn('[applyEdits] nativeText non-ASCII skipped:', drawErr?.message);
              } else {
                const safe = lineStr.replace(/[^\x20-\x7E]/g, '?');
                if (safe.length) page.drawText(safe, drawOpts);
              }
            }

            if (underline && Math.abs(rotationDeg) < 1 && lineStr.length) {
              const uy = lineY - Math.max(0.8, fontSizePt * 0.11);
              page.drawLine({
                start: { x: drawOpts.x, y: uy },
                end: { x: drawOpts.x + lineW, y: uy },
                thickness: Math.max(0.5, fontSizePt * 0.06),
                color: textColor,
                opacity,
              });
            }
          }
          break;
        }
        case 'text': {
          const nx = item.x ?? 0;
          const ny = item.y ?? 0;
          const fontSize = Math.max(4, Math.min(144, item.fontSize ?? 12));
          const { x, y: yTopPdf } = normPointToPdf(W, H, nx, ny);
          const raw = String(item.text || '');
          const bold = asBool(item.bold);
          const italic = asBool(item.italic);
          const underline = asBool(item.underline);
          const textColor = parseHexColor(item.color);

          let tAnnot = null;
          let uniAnnot = false;
          const embedded = await embedUnicodeFontIfAvailable(
            doc,
            fontkit,
            raw,
            bold,
            italic,
            notoUnicodeState,
          );
          if (embedded) {
            tAnnot = embedded.font;
            uniAnnot = embedded.isUnicodeEmbedded;
          }
          if (!tAnnot) {
            const fontEnum = resolveNativeStandardFont(item.fontFamily, bold, italic);
            tAnnot = nativeFontCache.get(fontEnum);
            if (!tAnnot) {
              tAnnot = await doc.embedFont(fontEnum);
              nativeFontCache.set(fontEnum, tAnnot);
            }
          }

          const baselineY = annotBaselineYFromTopPdfY(tAnnot, fontSize, yTopPdf);

          let textW = 0;
          if (uniAnnot && containsDevanagari(raw)) {
            textW = raw.length ? widthOfTextDevanagariBestEffort(tAnnot, raw, fontSize) : 0;
          } else {
            try {
              textW = raw.length ? tAnnot.widthOfTextAtSize(raw, fontSize) : 0;
            } catch {
              if (uniAnnot) {
                textW = estimateUnicodeTextWidth(raw, fontSize);
              } else if (needsNonAsciiText(raw)) {
                textW = estimateUnicodeTextWidth(raw, fontSize);
              } else {
                const safe = raw.replace(/[^\x20-\x7E]/g, '?');
                textW = safe.length ? tAnnot.widthOfTextAtSize(safe, fontSize) : 0;
              }
            }
          }

          /* Annotation box width from client (nw = normalized) for alignment. */
          const annotAlign = item.align === 'center' || item.align === 'right' ? item.align : 'left';
          const boxWPdf = Number(item.nw) > 0 ? item.nw * W : textW;
          let textX;
          if (annotAlign === 'center') textX = x + (boxWPdf - textW) / 2;
          else if (annotAlign === 'right') textX = x + boxWPdf - textW;
          else textX = x;

          const annotLines = raw.split('\n');
          const annotLineStep = fontSize * ANNOT_UI_LINE_HEIGHT;

          for (let li = 0; li < annotLines.length; li++) {
            const lineStr = annotLines[li];
            const lineY = baselineY - li * annotLineStep;

            /* Per-line width for alignment on lines 2+ */
            let lineW = textW;
            let lineX = textX;
            if (li > 0 && lineStr.length) {
              try { lineW = tAnnot.widthOfTextAtSize(lineStr, fontSize); } catch { /* keep textW */ }
              if (annotAlign === 'center') lineX = x + (boxWPdf - lineW) / 2;
              else if (annotAlign === 'right') lineX = x + boxWPdf - lineW;
            }

            const annotDrawOpts = { x: lineX, y: lineY, size: fontSize, font: tAnnot, color: textColor };
            try {
              if (uniAnnot && containsDevanagari(lineStr)) {
                drawTextDevanagariBestEffort(page, lineStr, annotDrawOpts);
              } else {
                page.drawText(lineStr, annotDrawOpts);
              }
            } catch {
              if (!uniAnnot && !needsNonAsciiText(lineStr)) {
                const safe = lineStr.replace(/[^\x20-\x7E]/g, '?');
                if (safe.length) page.drawText(safe, annotDrawOpts);
              } else if (!uniAnnot && needsNonAsciiText(lineStr)) {
                console.warn('[applyEdits] text annotation non-ASCII skipped');
              }
            }

            if (underline && lineStr.length) {
              const uy = lineY - Math.max(0.8, fontSize * 0.11);
              page.drawLine({
                start: { x: lineX, y: uy },
                end: { x: lineX + lineW, y: uy },
                thickness: Math.max(0.5, fontSize * 0.06),
                color: textColor,
              });
            }
          }
          break;
        }
        case 'highlight': {
          const { x, y, width, height } = normRectToPdf(
            W,
            H,
            item.x ?? 0,
            item.y ?? 0,
            item.w ?? 0.1,
            item.h ?? 0.05
          );
          page.drawRectangle({
            x,
            y,
            width,
            height,
            color: parseHexColor(item.color || '#ffeb3b'),
            opacity: Math.min(1, Math.max(0.05, Number(item.opacity) || 0.35)),
          });
          break;
        }
        case 'rect': {
          const { x, y, width, height } = normRectToPdf(
            W,
            H,
            item.x ?? 0,
            item.y ?? 0,
            item.w ?? 0.1,
            item.h ?? 0.08
          );
          const sw = Math.max(0.5, item.strokeWidth ?? 2);
          if (item.fillColor) {
            page.drawRectangle({
              x,
              y,
              width,
              height,
              borderColor: parseHexColor(item.strokeColor || '#2563eb'),
              borderWidth: sw,
              color: parseHexColor(item.fillColor),
              opacity: item.fillOpacity ?? 0.12,
            });
          } else {
            page.drawRectangle({
              x,
              y,
              width,
              height,
              borderColor: parseHexColor(item.strokeColor || '#2563eb'),
              borderWidth: sw,
            });
          }
          break;
        }
        case 'draw': {
          const pts = item.points || [];
          const stroke = parseHexColor(item.color || '#111827');
          const sw = Math.max(0.25, item.strokeWidth ?? 1.5);
          for (let i = 1; i < pts.length; i++) {
            const a = normPointToPdf(W, H, pts[i - 1].nx, pts[i - 1].ny);
            const b = normPointToPdf(W, H, pts[i].nx, pts[i].ny);
            page.drawLine({
              start: a,
              end: b,
              thickness: sw,
              color: stroke,
            });
          }
          break;
        }
        case 'signature': {
          const raw = String(item.imageBase64 || '')
            .trim()
            .replace(/^data:image\/png;base64,/, '');
          if (!raw.length) break;
          let buf;
          try {
            buf = Buffer.from(raw, 'base64');
          } catch {
            break;
          }
          if (buf.length < 32 || buf.length > 2_500_000) break;
          let pngImage;
          try {
            pngImage = await doc.embedPng(buf);
          } catch {
            break;
          }
          const { x, y, width, height } = normRectToPdf(
            W,
            H,
            item.x ?? 0,
            item.y ?? 0,
            item.w ?? 0.1,
            item.h ?? 0.05,
          );
          page.drawImage(pngImage, { x, y, width, height });
          break;
        }
        default:
          break;
      }
    }
  }

  return doc.save();
}
