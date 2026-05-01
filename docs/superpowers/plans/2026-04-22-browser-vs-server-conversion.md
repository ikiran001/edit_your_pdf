# Browser vs. server conversion — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the **hybrid** “client when good enough, server when needed” story **explicit, consistent, and measurable** across tools A–E (DOCX→PDF, PDF→DOCX, compress, OCR, and other PDF utilities), without breaking existing working paths.

**Architecture:** Keep **pdf-lib / pdf.js** for in-browser PDF work; keep **LibreOffice, Gotenberg, qpdf, Ghostscript, ocrmypdf** for fidelity-heavy or CPU-heavy server work. **Do not** promise browser parity with LibreOffice for Word↔PDF. **Document** the matrix in-repo and align **copy, analytics, and empty states** to the same story.

**Tech stack:** Vite + React frontend (`frontend/`), Express backend (`backend/`), existing `POST /document-flow/*`, `POST /compress-pdf`, `POST /ocr-pdf`. Reference spec: `docs/superpowers/specs/2026-04-22-pdf-to-word-hybrid-client-design.md`.

**Current-state snapshot (read before coding):**

| Area | Client today | Server today |
|------|----------------|--------------|
| **A — Word → PDF** | None (not viable for LO-class layout in small JS) | `POST /document-flow/convert-docx-to-pdf` |
| **B — PDF → Word** | `PdfToWordPage` + `extractPdfText.js` + `buildMinimalDocx.js` | `POST /document-flow/convert-pdf-to-docx` |
| **C — Compress** | `pdfCompressCore.js` `via: 'fallback'` (pdf-lib) | `POST /compress-pdf` (qpdf + optional GS) |
| **D — OCR** | None | `POST /ocr-pdf` (ocrmypdf) |
| **E — Other** | Merge, watermarks, page numbers, GST invoice, etc. (pdf-lib) | Unlock, some edit routes — per tool |

---

### Task 1: Add an architecture note (matrix) for A–E

**Files:**

- Create: `docs/superpowers/specs/2026-04-22-browser-server-conversion-matrix.md`
- Reference: this plan (no code)

- [ ] **Step 1: Create the matrix document**

Create `docs/superpowers/specs/2026-04-22-browser-server-conversion-matrix.md` with the following content (adjust dates only if you must):

```markdown
# Browser vs. server — conversion matrix

**Date:** 2026-04-22  
**Status:** Reference (ops + product)

| Flow | In-browser (today) | Server (today) | Product stance |
|------|--------------------|----------------|----------------|
| Word → PDF | Not supported (no small, maintained path matches LibreOffice layout) | LibreOffice and/or Gotenberg | **Server-primary**; static sites need `VITE_API_BASE_URL` + configured API |
| PDF → Word | pdf.js text extract → minimal `.docx` | LibreOffice `convert-pdf-to-docx` | **Hybrid** (client first for text PDFs, then server) — see `2026-04-22-pdf-to-word-hybrid-client-design.md` |
| Compress | pdf-lib re-save | qpdf + optional Ghostscript | **Hybrid**; browser fallback = structure rewrite, often little size change |
| OCR | None in production | ocrmypdf + Tesseract | **Server-primary**; optional future: Tesseract.js in browser (size/CPU trade-offs) |
| Other PDF tools | Many (merge, stamp, etc.) | Where qpdf/GS or LO required | **Per-tool** — check `toolRegistry` + page implementation |

**Rule of thumb:** If the tool needs a **system binary** (LibreOffice, qpdf, ocrmypdf), treat **server (or self-hosted API)** as the **source of truth** for fidelity; use the browser to **avoid upload** only when the implementation already exists and quality is acceptable.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-22-browser-server-conversion-matrix.md
git commit -m "docs: add browser vs server conversion matrix (A–E)"
```

---

### Task 2: (A) Word → PDF — clarify “no in-browser” in SEO + tool copy

**Files:**

- Modify: `frontend/src/shared/constants/toolSeoContent.js` (key `word-to-pdf` if present, or add body lines)
- Modify: `frontend/src/features/word-to-pdf/WordToPdfPage.jsx` (subtitle or note block when `caps?.docxToPdf === false`)

- [ ] **Step 1: Locate `word-to-pdf` in `toolSeoContent.js`**

Run:

```bash
rg -n "word-to-pdf" /Users/kiran.jadhav/Documents/Edit_Your_PDF/edit_your_pdf/frontend/src/shared/constants/toolSeoContent.js
```

- [ ] **Step 2: Add one short paragraph to the word-to-pdf SEO `body` array** (or first `body` string) stating that **full-fidelity .docx → .pdf** uses the **configured API** (LibreOffice/Gotenberg), not the static site alone. Wording must not promise a future in-browser LO engine.

- [ ] **Step 3: In `WordToPdfPage.jsx`, when capabilities are `ready` and `caps.docxToPdf` is false, show an info `div` (same pattern as other tools) explaining that **browser-only conversion is not offered** for layout-faithful Word → PDF, and that operators must set `SOFFICE_PATH` and/or `GOTENBERG_URL` on the API. Reuse tone from `POST /document-flow/convert-docx-to-pdf` 501 message in `backend/routes/documentFlow.js` (paraphrase, do not copy server error JSON verbatim into UI).

- [ ] **Step 4: Run lint on touched files**

```bash
cd /Users/kiran.jadhav/Documents/Edit_Your_PDF/edit_your_pdf/frontend && npm run build
```

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/constants/toolSeoContent.js frontend/src/features/word-to-pdf/WordToPdfPage.jsx
git commit -m "feat(word-to-pdf): clarify server-only full-fidelity conversion"
```

---

### Task 3: (B) PDF → Word — align analytics with the hybrid spec

**Files:**

- Modify: `frontend/src/features/pdf-to-word/PdfToWordPage.jsx`
- Modify: `frontend/src/lib/analytics.js` only if you add a new helper (prefer **not** to; use existing `trackEvent`)

- [ ] **Step 1: Add failure-bucket events before server fallback**

In `onPdf` inside `PdfToWordPage.jsx`, when `tryClient` is true but the client does not produce a `blob`, call `trackEvent` with a small fixed vocabulary (no PII). Example pattern to add after the `tryClient` block fails to set `blob` and before `if (!blob)` server branch:

```javascript
if (tryClient && !blob) {
  const buf = await file.arrayBuffer()
  const { text, numPages } = await extractPdfPlainText(buf)
  const reason =
    file.size > CLIENT_PDF_MAX_BYTES
      ? 'file_too_large'
      : numPages > CLIENT_PDF_MAX_PAGES
        ? 'page_limit'
        : text.trim().length < CLIENT_MIN_TEXT_CHARS
          ? 'insufficient_text'
          : 'client_error'
  trackEvent('pdf_to_word_client_skipped', { reason })
}
```

**Important:** Avoid double `extractPdfPlainText` — refactor so extraction runs once per attempt (merge with existing flow so you do not call `extractPdfPlainText` twice). Adjust the snippet into the existing structure: compute `{ text, numPages }` once, reuse for skip reason + `buildMinimalDocxBlob`.

- [ ] **Step 2: Run build**

```bash
cd /Users/kiran.jadhav/Documents/Edit_Your_PDF/edit_your_pdf/frontend && npm run build
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/pdf-to-word/PdfToWordPage.jsx
git commit -m "feat(pdf-to-word): track why client path was skipped"
```

---

### Task 4: (C) Compress — analytics for `api` vs `fallback`

**Files:**

- Modify: `frontend/src/features/compress-pdf/CompressPdfPage.jsx`

- [ ] **Step 1: After a successful `runCompress`, fire `trackEvent`**

Import `trackEvent` from `../../lib/analytics.js` (same pattern as other tools). When `setItems(next)` runs, compute:

```javascript
const paths = next.map((x) => x.compressedVia || 'fallback')
const allApi = paths.every((p) => p === 'api')
trackEvent('compress_pdf_path', {
  mode: allApi ? 'api_only' : paths.every((p) => p === 'fallback') ? 'fallback_only' : 'mixed',
})
```

Place the call once per batch run (not per file) after `setUsedFallbackOnly`.

- [ ] **Step 2: Build + commit**

```bash
cd /Users/kiran.jadhav/Documents/Edit_Your_PDF/edit_your_pdf/frontend && npm run build
git add frontend/src/features/compress-pdf/CompressPdfPage.jsx
git commit -m "feat(compress-pdf): track api vs pdf-lib fallback usage"
```

---

### Task 5: (D) OCR — optional Phase-2 spike (Tesseract.js), behind a flag

**Files:**

- Create (spike only): `frontend/src/features/ocr-pdf/clientOcrSpike.js`
- Modify (later): `frontend/src/features/ocr-pdf/OcrPdfPage.jsx` — **do not wire until spike passes manual QA**

- [ ] **Step 1: Add dependency**

```bash
cd /Users/kiran.jadhav/Documents/Edit_Your_PDF/edit_your_pdf/frontend && npm install tesseract.js@^5.1.0
```

- [ ] **Step 2: Create a minimal module that OCRs one PNG `Blob` in-browser**

Create `frontend/src/features/ocr-pdf/clientOcrSpike.js`:

```javascript
import Tesseract from 'tesseract.js'

/**
 * Spike: OCR a single raster image in the browser. Not wired to PDF pipeline yet.
 * @param {Blob} imageBlob — image/png or image/jpeg
 * @returns {Promise<{ text: string }>}
 */
export async function ocrImageBlobOnce(imageBlob) {
  const r = await Tesseract.recognize(imageBlob, 'eng', {
    logger: () => {},
  })
  return { text: String(r?.data?.text || '').trim() }
}
```

- [ ] **Step 3: Manual sanity check in DevTools (no Jest required for spike)**

In browser console on any page (temporary): dynamic import and pass a tiny PNG — expect `{ text: ... }`. Remove scratch code after verification.

- [ ] **Step 4: Document gate for production wiring**

In `clientOcrSpike.js` file header comment, state explicitly: full PDF OCR in-browser requires **per-page rasterization** (pdf.js), **memory caps**, **page limits**, and **WASM language packs** — ship only after product sets max pages.

- [ ] **Step 5: Commit dependency + spike file only**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/features/ocr-pdf/clientOcrSpike.js
git commit -m "chore(ocr): add tesseract.js spike module (unwired)"
```

**Stop condition:** If bundle size or policy forbids adding `tesseract.js`, **skip Step 1–5**, replace with a doc-only note in the matrix file under OCR: “Client OCR dependency not approved.”

---

### Task 6: (E) Inventory — tool registry descriptions vs. implementation

**Files:**

- Modify: `frontend/src/shared/constants/toolRegistry.js` (description strings only)

- [ ] **Step 1: List tools that still say “server” incorrectly**

Run:

```bash
rg -n "server" /Users/kiran.jadhav/Documents/Edit_Your_PDF/edit_your_pdf/frontend/src/shared/constants/toolRegistry.js
```

- [ ] **Step 2: Update descriptions** so each entry matches **actual** behavior:

- If **browser-first with optional API**: say “Browser (…); API optional for …”.
- If **API-required**: say “Needs configured API …”.

Concrete example — **only change text**, do not rename keys:

```javascript
// Example pattern (apply to the correct entries after reading each feature):
description: 'Compress PDFs — tries your API (qpdf/Ghostscript); falls back to in-browser pdf-lib when the API is missing.',
```

- [ ] **Step 3: Build + commit**

```bash
cd /Users/kiran.jadhav/Documents/Edit_Your_PDF/edit_your_pdf/frontend && npm run build
git add frontend/src/shared/constants/toolRegistry.js
git commit -m "docs(tools): align registry blurbs with browser vs API behavior"
```

---

## Plan self-review

| Spec / brainstorm requirement | Task covering it |
|------------------------------|------------------|
| Hybrid stance documented | Task 1 matrix + Task 2 copy |
| A — DOCX→PDF server-primary | Task 2 |
| B — PDF→Word hybrid | Task 3 (analytics gap); implementation largely exists |
| C — Compress hybrid | Task 4 (metrics); UX already explains fallback |
| D — OCR mostly server; optional client | Task 5 spike optional |
| E — other tools | Task 6 |

**Placeholder scan:** None intentional; Task 5 has an explicit stop condition if dependency rejected.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-22-browser-vs-server-conversion.md`.

**Two execution options:**

1. **Subagent-driven (recommended)** — Dispatch a fresh subagent per task; review between tasks. **Required sub-skill:** `superpowers:subagent-driven-development`.

2. **Inline execution** — Run tasks in this session with checkpoints. **Required sub-skill:** `superpowers:executing-plans`.

**Which approach do you want?**
