# Add page numbers — live thumbnail preview (Organize-style)

**Date:** 2026-04-22  
**Status:** Draft for review (implementation follows user approval)

## Context

The shipped **Add page numbers** tool (`/tools/add-page-numbers`) processes PDFs with **pdf-lib** and does not render page thumbnails. **Organize PDF** (`OrganizePdfPage` + `OrganizePageGrid` + `OrganizePageCard` + `LazyPdfPageThumbnail`) provides a **zoomable grid** of pages that users expect when working visually.

## Brainstorming decisions (locked)

| Topic | Choice |
|--------|--------|
| Preview strategy | **Live overlay on thumbnails** — update labels as controls change; **download** still runs **pdf-lib** once (no full PDF regeneration per keystroke). |
| Visual parity | **A — Very close to Organize** — same **zoom slider** band (min/max/step aligned with Organize), scrollable grid, card chrome — **read-only** (no drag, reorder, rotate, delete, multi-select). |

## Goals

- After upload, users **see all pages** in an **Organize-like** thumbnail grid with **grid zoom** controls.
- Each thumbnail shows a **live text overlay** reflecting current options: **layout mode** (single vs facing), **3×3 band/position**, **margin preset**, **page scope / range**, **first number**, **format**, **font size**, **color**, **bold**.
- **Download** behavior stays as today: **single** `applyPageNumbersToPdf` pass for fidelity.

## Non-goals

- **Pixel-perfect** preview vs pdf-lib on every edge case — acceptable small drift; document known gaps (see Risks).
- **Regenerating** the PDF in-browser on every option change for preview only (too heavy for **A**).
- Reusing **`OrganizePageGrid`** verbatim — it is built for **drag/drop and reorder** (`OrganizePageGrid.jsx`). Prefer a **dedicated read-only grid** or a **thin wrapper** + shared thumbnail component.

## Architecture

### 1. Keep `pdf.js` document alive

Mirror **Organize**: load PDF bytes, call `getDocument({ data: master.slice() })`, store **`pdfDoc`** in React state for the lifetime of the upload (destroy on unmount / file replace). Today **PageNumbersPdfPage** loads pdf.js only to read **`numPages`** and discards the doc — change so thumbnails can call `getPage`.

### 2. Read-only thumbnail grid

- **Layout:** Match **Organize** shell: when `docReady`, show **`Grid zoom`** controls (`ZoomOut` / `ZoomIn` / **100%**) using the **same constants** as Organize (`GRID_ZOOM_MIN` / `MAX` / `STEP`) so behavior feels identical.
- **Grid container:** Reuse styling tokens from Organize (`grid` + `minmax`, rounded panel) — either duplicate classes or extract a tiny shared constant if worthwhile (avoid large refactors).
- **Cards:** New component (e.g. `PageNumbersPreviewCard`) or a **`previewMode`** on a slimmed card:
  - **Header:** Show **physical page index** (`Page N` of uploaded file), **not** draggable chrome — replace grip/drag with static label.
  - **Body:** Reuse **`LazyPdfPageThumbnail`** from `features/organize-pdf/LazyPdfPageThumbnail.jsx` with `extraRotation={0}` (no user rotation in this tool).
  - **Overlay:** Absolutely positioned layer **above** the thumbnail (`relative` wrapper) drawing the **computed label string** at the **computed position** (see Layout math).

Do **not** show organize-only controls (rotate arrows, delete, selection checkboxes).

### 3. Shared layout math (single source of truth)

Today **`pageNumbersPdfCore.js`** contains **`formatPageNumberText`**, **`xySingle`**, **`xyFacing`**, and **`resolvePageIndices`** usage.

**Refactor:** Extract a small shared module, e.g. `frontend/src/lib/pageNumbersLayout.js`, exporting:

- `formatPageNumberText(format, n, totalPagesInDoc)`
- `stampPositionPdfPts(layoutMode, gridRow, gridCol, pageW, pageH, marginPts, fontSize, textWidthPxApprox, physicalOneBased)` → `{ x, y }` in **pdf-lib** coordinates (origin bottom-left, **y** = baseline).

**`pageNumbersPdfCore.js`** imports these helpers so **download** and **preview** cannot drift logically.

**Preview text width:** pdf-lib uses real font metrics; the browser overlay can use **`CanvasRenderingContext2D.measureText`** with **`bold ? 'bold' : 'normal'` `px` `sans-serif`** at **scaled** font size (Helvetica isn’t required to match exactly — close enough for preview). Export an optional `estimateTextWidthCanvas(text, fontSizePx, bold)` helper in the same module or colocated util.

### 4. Mapping PDF coordinates → CSS overlay

Thumbnail uses **`LazyPdfPageThumbnail`**, which builds a viewport from **`page.getViewport`** (handles **page rotation**). For overlay placement:

- Read **width / height** used as logical page size for formulas — **spec lock:** use **`page.getViewport({ scale: 1, rotation })`** dimensions **after** the same rotation PDF.js applies for rendering, so overlay aligns with the **canvas** orientation.
- Convert pdf-lib **(x, y)** with origin bottom-left to CSS **top-left** overlay:
  - `leftPct = (x / pageW) * 100`
  - Baseline from bottom: `bottomPct = (y / pageH) * 100`  
  - Apply `transform: translateY(...)` or padding so text **sits** on baseline (same heuristic as pdf-lib `drawText` baseline — match existing core `halfH` assumptions).

Scale **font-size** on overlay proportionally to **thumbnail width / pageW** so zooming the grid scales the label visually.

### 5. Page range / “skipped” pages

Pages **not** in the selected index list should **not** show a folio overlay (or show a **muted** “Not numbered” badge — **spec lock:** **no number text**, optional subtle **dimming** via opacity class).

### 6. Responsiveness / debouncing

- Recalculating overlay props is cheap; optional **100–150 ms debounce** on rapid slider changes reduces React churn.
- Thumbnail **canvas** already debounces via **`LazyPdfPageThumbnail`** + intersection observer — no change required unless profiling shows issues.

## Risks / known gaps

- **Highly rotated or cropboxed pages:** Preview uses pdf.js viewport; pdf-lib **`getSize`** may differ slightly — document that **download** is authoritative.
- **Very large PDFs:** Same constraints as Organize — many thumbnails may stress memory; rely on **lazy** thumbnails; optional soft cap message if product adds one elsewhere.

## Testing

- Manual: multi-page PDF, toggle **single vs facing**, move grid, change margin/format/font — overlay updates without download.
- Range `2-4`, first number `5` — only those pages show labels with correct sequence.
- Zoom grid to 45% / 165% — overlay scales/readability acceptable.

## Implementation notes (for a later plan)

- Files likely touched: `PageNumbersPdfPage.jsx`, new preview card/grid components under `features/add-page-numbers/`, new `pageNumbersLayout.js`, refactor `pageNumbersPdfCore.js`.
- No change to **tool registry** or **routes**.

## Self-review

- **Placeholder scan:** None.
- **Consistency:** Shared layout module prevents divergence between overlay and pdf-lib.
- **Scope:** Preview + refactor only — no new numbering modes.
