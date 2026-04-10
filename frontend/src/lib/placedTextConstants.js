/**
 * Add Text (`type: 'text'`) layout — shared by editor UI, mask sampling, and legacy export fix.
 */

/**
 * Distance from the viewport “content top” anchor to pdf-lib `drawText` baseline, in font-size units.
 * Must stay in sync with `PLACED_TEXT_BASELINE_FRAC` in `backend/services/applyEdits.js`.
 */
export const PLACED_TEXT_BASELINE_FRAC = 0.85

/** Padding around the dotted box (CSS px). */
export const PLACED_TEXT_PAD_CSS = 4

/**
 * Legacy sessions: `y` was the top of the old widget (drag strip + padding), while pdf-lib drew
 * text at that Y as if it were the text line — PDF text sat too high. Export adds this offset (in
 * CSS px at commit time) converted to normalized Δy using the page canvas height.
 */
export const LEGACY_PLACED_TEXT_WIDGET_TOP_OFFSET_CSS = 34
