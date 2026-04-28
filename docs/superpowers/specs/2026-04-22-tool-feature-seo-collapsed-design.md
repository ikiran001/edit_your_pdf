# Tool feature SEO: collapsed “How to use?” disclosure

**Date:** 2026-04-22  
**Status:** Approved for implementation (pending user review of this document)

## Problem

On toolkit pages, `ToolFeatureSeoSection` renders a long block (intro, “How to use”, “Why use”, “Key features”) that appears **before** or **between** primary controls on many flows. That pushes the real tool UI down and feels clumsy. Organize PDF is a concrete example; the same component is reused widely.

## Goals

- **Task-first layout:** Users land on the tool (dropzone, controls, canvas) without scrolling through a full instructional article.
- **On-demand help:** Full SEO/how-to content remains available when the user chooses to read it.
- **Scope:** Apply behavior to **every page** that uses `ToolFeatureSeoSection` (single implementation in the shared component; no per-tool copy-paste).
- **Accessibility:** Disclosures must be keyboard-operable and expose state to assistive tech (`aria-expanded` or native `<details>` semantics).

## Non-goals

- Changing the **copy** in `TOOL_SEO_BY_ID` (`frontend/src/shared/constants/toolSeoContent.js`) beyond what is needed to avoid duplicate headings (see below).
- Moving SEO to a separate route or lazy-loading content in a way that removes it from the initial HTML (SEO regression risk).
- Per-tool overrides for default open/closed (unless a concrete need appears later; YAGNI).

## Affected surfaces

Central component: `frontend/src/shared/components/ToolFeatureSeoSection.jsx`.

**Consumers (all inherit behavior automatically):**

| File | `toolId` |
|------|----------|
| `features/add-watermark/WatermarkPdfPage.jsx` | `add-watermark` |
| `features/compress-pdf/CompressPdfPage.jsx` | `compress-pdf` |
| `features/edit-pdf/EditPdfSessionFlow.jsx` | `edit-pdf` |
| `features/encrypt-pdf/EncryptPdfPage.jsx` | `encrypt-pdf` |
| `features/gst-invoice/GstInvoicePage.jsx` | `gst-invoice` |
| `features/jpg-to-pdf/JpgToPdfPage.jsx` | `jpg-to-pdf` |
| `features/merge-pdf/MergePdfPage.jsx` | `merge-pdf` |
| `features/ocr-pdf/OcrPdfPage.jsx` | `ocr-pdf` |
| `features/organize-pdf/OrganizePdfPage.jsx` | `organize-pdf` |
| `features/pdf-to-jpg/PdfToJpgPage.jsx` | `pdf-to-jpg` |
| `features/scan-to-pdf/ScanToPdfPage.jsx` | `scan-to-pdf` |
| `features/sign-pdf/SignPdfPage.jsx` | `sign-pdf` |
| `features/split-pdf/SplitPdfPage.jsx` | `split-pdf` |
| `features/unlock-pdf/UnlockPdfPage.jsx` | `unlock-pdf` |
| `features/word-to-pdf/WordToPdfPage.jsx` | `word-to-pdf` |

No changes are required to these files **unless** visual spacing/order issues appear after the disclosure ships (then adjust margins only).

## UX specification

1. **Default state:** The instructional/marketing body is **collapsed**. Only a single interactive affordance is visible: **`How to use?`** (exact label; sentence case with question mark).
2. **Expanded state:** Clicking the affordance reveals the **full** current content: intro paragraphs, numbered steps, “Why use …?”, and “Key features” grid — preserving existing styling tokens (rounded panels, grids, dark mode classes) inside the expanded region.
3. **Toggle:** Clicking again collapses the region (native `<details>` toggling satisfies this).
4. **Placement:** Unchanged relative to each parent page — only the **presentation** of `ToolFeatureSeoSection` changes. Optional follow-up (separate change): reorder Organize PDF so the component sits below primary controls; **not** part of this spec unless explicitly added later.

## Implementation approach (recommended)

- Wrap the existing `<article>` body in a **native `<details>`** element with **`open={false}`** by default (omit `open` so closed by default).
- Use **`<summary>`** as the visible row containing the **`How to use?`** label. Style `summary` with existing button-like or subtle link styling consistent with the design system (cursor pointer, focus ring).
- **Avoid duplicate headings:** The visible `<summary>` replaces the redundant inner `<h2>How to use {c.featureName}</h2>`; keep the ordered list as the next block inside the expanded panel. Retain other `<h2>` sections (“Why use …?”, “Key features”) for structure when expanded.
- **IDs / `aria-labelledby`:** Reconcile `aria-labelledby` on `<article>` with the new structure so the intro block’s `id` remains valid and heading order remains logical (intro remains first content inside the expanded region).
- **SEO:** Prefer `<details>` so full text remains in the **initial DOM** (not injected only after JavaScript). Avoid `display: none` on the entire SEO body if that would remove it from accessible tree in a way that harms indexing; `<details>` closed state keeps content in the document.

## Testing

- Manual: Open several tools (e.g. Organize PDF, Merge PDF); confirm section is collapsed on load; expand/collapse; keyboard (Enter/Space on summary per UA).
- Regression: Snapshot or smoke that each route still renders without console errors when `toolId` is missing (`ToolFeatureSeoSection` returns `null`).

## Self-review checklist

- **Placeholders:** None.
- **Consistency:** Single component change matches “all tools” scope.
- **Scope:** One implementation unit; no unrelated refactors.
- **Ambiguity:** “How to use?” is the exact summary label; full prior body appears when expanded.
