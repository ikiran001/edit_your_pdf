# Browser vs. server — conversion matrix

**Date:** 2026-04-22  
**Status:** Reference (ops + product)

| Flow | In-browser (today) | Server (today) | Product stance |
|------|--------------------|----------------|----------------|
| Word → PDF | SPA builds a **draft PDF** from extracted plain text (`word-to-pdf` feature; **no upload**) — layout/pictures are not preserved | **`POST /document-flow/convert-docx-to-pdf` removed** (404 if called); no DOCX→PDF on the pdfpilot API | **Client-only** for the shipped tool; fidelity is intentionally limited — external integrations must not rely on the old route |
| PDF → Word | pdf.js text extract → minimal `.docx` (SPA; **no conversion upload**) | `convert-pdf-to-docx` exists on API for other use — **not used** by pdfpilot PDF→Word UI | **Client-only** for shipped tool — see `2026-04-22-pdf-to-word-client-only-no-upload-design.md` |
| Compress | pdf-lib re-save | qpdf + optional Ghostscript | **Hybrid**; browser fallback = structure rewrite, often little size change |
| OCR | Optional unwired spike: `frontend/src/features/ocr-pdf/clientOcrSpike.js` (tesseract.js); not used in production UI | ocrmypdf + Tesseract | **Server-primary** for shipped flow; client spike for future evaluation (memory/page limits) |
| Other PDF tools | Many (merge, stamp, etc.) | Where qpdf/GS or LO required | **Per-tool** — check `toolRegistry` + page implementation |

**Rule of thumb:** If the tool needs a **system binary** (LibreOffice, qpdf, ocrmypdf), treat **server (or self-hosted API)** as the **source of truth** for fidelity; use the browser to **avoid upload** only when the implementation already exists and quality is acceptable.

**Ops (Render):** The Blueprint (`render.yaml`) does **not** define a Gotenberg service. If an older deploy left a `pdfpilot-gotenberg` (or similar) web service running, delete it in the Render dashboard to avoid idle cost. The API service should not need `GOTENBERG_URL` for the shipped Word→PDF tool.
