/** Base pdf.js CSS-pixel scale before capping very large pages (see `computePdfRenderScale`). */
export const RENDER_SCALE_BASE = 1.35

/**
 * Max width or height of the rendered page bitmap (device px). Larger PDFs scale down so
 * canvas memory and overlay paints stay bounded.
 */
export const PDF_RENDER_MAX_BITMAP_SIDE = 4096

export const MAX_DRAW_POINTS = 1000
export const MAX_ANNOT_TEXT_PER_PAGE = 50
export const MAX_ANNOT_TEXT_LENGTH = 2000
export const MAX_SIGN_PER_PAGE = 10

export const ANNOT_SCOPE_EVENT = 'pdf-editor-annot-scope'

export const DEFAULT_SNAP_PDF_H = 792

/** Added text is drawn with no fill in the viewer and on export — PDF shows through. */
export const ANNOT_TEXT_DISPLAY_BG = 'transparent'

/** Must match backend `ANNOT_UI_LINE_HEIGHT` in applyEdits.js. */
export const ANNOT_UI_LINE_HEIGHT = 1.35

/** Initial empty add-text width ≈ this many average-width glyphs at 14px (matches tight placed-text look). */
export const TEXT_DRAFT_INITIAL_CHAR_COLUMNS = 4
/** Typical Latin sans advance width / em (between ~0.48–0.58 for UI fonts). */
export const TEXT_DRAFT_CHAR_ADVANCE_EM = 0.54
/** Horizontal padding inside the draft ring (caret, border). */
export const TEXT_DRAFT_H_PADDING_PX = 6
/** New Add Text drafts always start at this CSS px size; initial `nw`/`nh` derive from it so the box matches the line. */
export const ADD_TEXT_DRAFT_DEFAULT_FONT_CSS = 14
