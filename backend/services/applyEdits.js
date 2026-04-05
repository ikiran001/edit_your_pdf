import 'regenerator-runtime/runtime.js';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import {
  containsDevanagari,
  drawTextDevanagariBestEffort,
  embedUnicodeFontIfAvailable,
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

function parseHexColor(hex) {
  const h = (hex || '#000000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
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
  const font = await doc.embedFont(StandardFonts.Helvetica);
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
              } else {
                const safe = raw.replace(/[^\x20-\x7E]/g, '?');
                textW = safe.length ? tFont.widthOfTextAtSize(safe, fontSizePt) : 0;
              }
            }
          }
          const pad = Math.max(3, fontSizePt * 0.22);
          const textColor = parseHexColor(item.color);
          let opacity = Number(item.opacity);
          if (!Number.isFinite(opacity)) opacity = 1;
          opacity = Math.min(1, Math.max(0.05, opacity));
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
            maskH = Math.max(rect.height, fontSizePt * 1.35);
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
            maskH = Math.max(bh + pad * 2, fontSizePt * 1.35);
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

          /* Paint-out original glyphs (PDF content stream is unchanged). Not an annotation fill — avoids double text. */
          page.drawRectangle({
            x: maskX,
            y: maskY,
            width: maskW,
            height: maskH,
            color: rgb(1, 1, 1),
          });

          if (align === 'center') {
            textX = maskX + (maskW - textW) / 2;
          } else if (align === 'right') {
            textX = maskX + maskW - textW - pad * 0.5;
          } else {
            textX = Math.max(textX, maskX + 0.5);
          }

          const drawOpts = {
            x: textX,
            y: baselinePdf,
            size: fontSizePt,
            font: tFont,
            color: textColor,
            opacity,
            rotate: degrees(rotationDeg),
          };

          try {
            if (isUnicodeEmbedded && containsDevanagari(raw)) {
              drawTextDevanagariBestEffort(page, raw, drawOpts);
            } else {
              page.drawText(raw, drawOpts);
            }
          } catch (drawErr) {
            if (isUnicodeEmbedded) {
              console.warn('[applyEdits] nativeText unicode draw failed:', drawErr?.message);
            } else {
              const safe = raw.replace(/[^\x20-\x7E]/g, '?');
              if (safe.length) {
                page.drawText(safe, drawOpts);
              }
            }
          }

          if (underline && Math.abs(rotationDeg) < 1) {
            const uy = baselinePdf - Math.max(0.8, fontSizePt * 0.11);
            page.drawLine({
              start: { x: textX, y: uy },
              end: { x: textX + textW, y: uy },
              thickness: Math.max(0.5, fontSizePt * 0.06),
              color: textColor,
              opacity,
            });
          }
          break;
        }
        case 'text': {
          const nx = item.x ?? 0;
          const ny = item.y ?? 0;
          const fontSize = Math.max(4, Math.min(144, item.fontSize ?? 12));
          const { x, y } = normPointToPdf(W, H, nx, ny);
          const baselineY = y - fontSize * 0.85;
          const raw = String(item.text || '');
          let tAnnot = font;
          let uniAnnot = false;
          const emb = await embedUnicodeFontIfAvailable(doc, fontkit, raw, false, false, notoUnicodeState);
          if (emb) {
            tAnnot = emb.font;
            uniAnnot = emb.isUnicodeEmbedded;
          }
          try {
            page.drawText(raw, {
              x,
              y: baselineY,
              size: fontSize,
              font: tAnnot,
              color: parseHexColor(item.color),
            });
          } catch {
            if (!uniAnnot) {
              const safe = raw.replace(/[^\x20-\x7E]/g, '?');
              if (safe.length) {
                page.drawText(safe, {
                  x,
                  y: baselineY,
                  size: fontSize,
                  font: tAnnot,
                  color: parseHexColor(item.color),
                });
              }
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
            opacity: item.opacity ?? 0.35,
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
        default:
          break;
      }
    }
  }

  return doc.save();
}
