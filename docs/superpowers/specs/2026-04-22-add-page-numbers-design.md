# Add page numbers — toolkit tool

**Date:** 2026-04-22  
**Status:** Draft for review (implementation follows user approval of this document)

## Brainstorming decisions (locked)

| Topic | Choice |
|--------|--------|
| Placement in product | **New toolkit tool** — dedicated route under `/tools/…`, not a mode inside Add watermark. |
| UX reference | **Inspired by** common “page number options” panels (position grid, margins, range, start number, format, typography), implemented **with pdfpilot patterns** (`ToolPageShell`, zinc/indigo styling, `FileDropzone`, collapsible `ToolFeatureSeoSection`). |
| Facing pages | **In v1.** |
| Facing horizontal rule | **A — Outside corners (book-style):** odd-numbered pages → stamp toward the **outer** bottom corner (**right** for typical LTR recto); even-numbered pages → outer bottom **left** (verso). Assumes **left-to-right** reading order; **RTL** is out of scope for v1. |

## Goals

- Let users **add visible page numbers** to an uploaded PDF **entirely in the browser** (pdf-lib), then download the result.
- Support **Single page** layout mode (user-selected position on a **3×3 grid** or equivalent mapping) and **Facing pages** mode with **automatic outer-corner alternation** as above.
- Reuse existing primitives: **page range** semantics (`resolvePageIndices` / `parsePageRangeInput` from `frontend/src/lib/watermarkPdfCore.js` + `pdfMergeSplitCore.js`), **download/auth** patterns from **`WatermarkPdfPage`** (`runWithSignInForDownload`, analytics), **StandardFonts** embedding consistent with watermark text.

## Non-goals (v1)

- **Server-side** rendering or OCR.
- **RTL / binding-right** book models (explicit later if needed).
- **Header/footer PDF page labels** that sync with Reader’s “logical page number” metadata — v1 is **visual stamp only**.
- **Google Drive / Dropbox** pickers from reference screenshots (not part of current toolkit unless added product-wide).

## User-visible options (v1)

Minimum set so the tool is comparable to familiar products without matching every control:

1. **Page layout mode**  
   - **Single page:** User chooses position via **3×3 grid** (top/middle × left/center/right). Maps to coordinates with configurable **margin** (preset: e.g. *Recommended* = fixed pts from edges, or a small numeric margin control — pick one implementation-friendly scheme).  
   - **Facing pages:** The grid selects **vertical band** (top / middle / bottom). **Horizontal** placement is **not** taken from the grid column: use **odd page → right margin**, **even page → left margin** at the **y** for that band (**outside corners**). Same alternation applies to top, middle, and bottom bands.

2. **Which pages** — All pages **or** **from–to** inclusive (reuse existing range validation UX patterns from watermark).

3. **First displayed number** — Integer ≥ 1; maps to the **first numbered page** in the selected range (subsequent pages increment). If range starts at physical page 5 but “first number” is 1, page 5 shows `1`, page 6 shows `2`, etc.

4. **Text format** (dropdown presets)  
   - Page number only: `1`, `2`, …  
   - `Page N`  
   - `Page N of M` where **M** = total pages in file **or** total pages in selected range — **spec lock:** **M = number of pages in the PDF document** (simplest to explain); optional follow-up to use “pages in range” only if users ask.

5. **Typography (v1)**  
   - Font: **Helvetica** / **Helvetica Bold** via pdf-lib `StandardFonts` (matches watermark reliability).  
   - Size (pt), color (hex), optional **bold** toggle (if not redundant with font choice).

6. **Primary action** — **Add page numbers** → processes → triggers gated download like other client tools.

## Algorithms (pdf-lib)

- Load PDF with `PDFDocument.load`, `ignoreEncryption: true` (consistent with other tools).  
- Determine **0-based page indices** to number via existing **range resolver**.  
- For each numbered page `p` (1-based among **physical** document pages):  
  - Compute **display string** from preset, `firstNumber`, and index within the numbered sequence.  
  - Measure text width (`font.widthOfTextAtSize`) for positioning.  
  - Compute `(x, y)` from **page size**, **margin**, **grid cell**, and mode:  
    - **Single:** anchor corner/center per cell (pdf-lib origin bottom-left).  
    - **Facing:** **Ignore** grid column for **x**. Let **odd `p`** align text to the **right** (outer); **even `p`** align to the **left** (outer). **y** comes from the selected **row** (top / middle / bottom) plus margins.  
- `page.drawText(text, { x, y, size, font, color })`.  
- **Rotation:** assume pages are **not** pre-rotated for placement — use page rotation metadata if pdf-lib exposes it so numbers stay readable (follow watermark page handling if any exists).

## Integration checklist (implementation plan input)

| Area | Action |
|------|--------|
| Registry | Add `{ id: 'add-page-numbers', path: '/tools/add-page-numbers', … }` to `TOOL_REGISTRY`; `implemented: true`; pick icon e.g. `Hash` or `ListOrdered` (lucide). |
| Routes | `AppRoutes.jsx`: import `PageNumbersPdfPage`, `<Route path="/tools/add-page-numbers" … />`. |
| Nav | Add `add-page-numbers` to **`TOOL_NAV_GROUPS`** — recommend **Organize PDF** column (`merge-pdf`, `split-pdf`, `organize-pdf`, **`add-page-numbers`**). |
| Branding | `docTitleForPath` entry for `/tools/add-page-numbers`. |
| Analytics | `ANALYTICS_TOOL.page_numbers_pdf` + `REGISTRY_ID_TO_FEATURE['add-page-numbers']`. |
| SEO | `TOOL_SEO_BY_ID['add-page-numbers']` in `toolSeoContent.js` + `<ToolFeatureSeoSection toolId="add-page-numbers" />` on the page. |
| Code layout | `frontend/src/features/add-page-numbers/PageNumbersPdfPage.jsx`, `frontend/src/lib/pageNumbersPdfCore.js` (or similar) exporting `applyPageNumbersToPdf(bytes, opts)`. |

## Error handling

- Empty range, invalid range input → inline error (reuse messages patterns).  
- Password-protected PDF → same behavior as watermark (document cannot load → user-facing message).  
- Very long strings → clip font size or ellipsis not required if presets stay short.

## Testing

- Manual: small PDF (3–4 pages), single vs facing, odd/even positions, range subset, start number offset.  
- Regression: download analytics + auth gate still fire.

## Self-review

- **Ambiguity resolved:** In facing mode, **x** is always left/right alternating; **y** comes from the grid row + margins.
- **Scope:** Single implementation slice (new route + core lib + registry/analytics/SEO).
