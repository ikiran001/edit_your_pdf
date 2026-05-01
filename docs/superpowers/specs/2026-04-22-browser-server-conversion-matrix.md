# Browser vs. server — conversion matrix

**Date:** 2026-04-22  
**Status:** Reference (ops + product)

| Flow | In-browser (today) | Server (today) | Product stance |
|------|--------------------|----------------|----------------|
| Word → PDF | Not supported (no small, maintained path matches LibreOffice layout) | LibreOffice and/or Gotenberg | **Server-primary**; static sites need `VITE_API_BASE_URL` + configured API |
| PDF → Word | pdf.js text extract → minimal `.docx` (SPA; **no conversion upload**) | `convert-pdf-to-docx` exists on API for other use — **not used** by pdfpilot PDF→Word UI | **Client-only** for shipped tool — see `2026-04-22-pdf-to-word-client-only-no-upload-design.md` |
| Compress | pdf-lib re-save | qpdf + optional Ghostscript | **Hybrid**; browser fallback = structure rewrite, often little size change |
| OCR | Optional unwired spike: `frontend/src/features/ocr-pdf/clientOcrSpike.js` (tesseract.js); not used in production UI | ocrmypdf + Tesseract | **Server-primary** for shipped flow; client spike for future evaluation (memory/page limits) |
| Other PDF tools | Many (merge, stamp, etc.) | Where qpdf/GS or LO required | **Per-tool** — check `toolRegistry` + page implementation |

**Rule of thumb:** If the tool needs a **system binary** (LibreOffice, qpdf, ocrmypdf), treat **server (or self-hosted API)** as the **source of truth** for fidelity; use the browser to **avoid upload** only when the implementation already exists and quality is acceptable.
