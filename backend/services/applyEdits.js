import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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

/**
 * Applies annotation payloads from the client onto a PDF using pdf-lib.
 * All positions use normalized 0–1 coords relative to each page (top-left origin).
 */
export async function applyEditsToPdf(pdfBytes, editsPayload) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

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
          // PDF user-space box from pdf.js (origin bottom-left); masks original run then redraws.
          const x = item.x ?? 0;
          const y = item.y ?? 0;
          const w = item.w ?? 1;
          const h = item.h ?? 1;
          const baseline = item.baseline ?? y + h * 0.75;
          const fs = Math.max(4, Math.min(144, item.fontSize ?? 12));
          page.drawRectangle({
            x,
            y,
            width: Math.max(w, 1),
            height: Math.max(h, 1),
            color: rgb(1, 1, 1),
          });
          const raw = String(item.text ?? '');
          try {
            page.drawText(raw, {
              x: x + 1,
              y: baseline,
              size: fs,
              font,
              color: rgb(0, 0, 0),
            });
          } catch {
            const safe = raw.replace(/[^\x20-\x7E]/g, '?');
            if (safe.length) {
              page.drawText(safe, {
                x: x + 1,
                y: baseline,
                size: fs,
                font,
                color: rgb(0, 0, 0),
              });
            }
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
          try {
            page.drawText(raw, {
              x,
              y: baselineY,
              size: fontSize,
              font,
              color: parseHexColor(item.color),
            });
          } catch {
            // Standard Helvetica is WinAnsi-only; fall back to ASCII subset so edits still apply.
            const safe = raw.replace(/[^\x20-\x7E]/g, '?');
            if (safe.length) {
              page.drawText(safe, {
                x,
                y: baselineY,
                size: fontSize,
                font,
                color: parseHexColor(item.color),
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
