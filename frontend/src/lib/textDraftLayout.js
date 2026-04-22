/**
 * Normalized width/height for the add-text draft overlay.
 * `nwFloor`: after a corner resize, `nw` is not shrunk below this until a new draft (see PdfPageCanvas).
 *
 * Margins match PdfPageCanvas caps (`1 - nx - margin`). Keep `ANNOT_UI_LINE_HEIGHT` aligned in PdfPageCanvas + backend applyEdits.js for PDF parity.
 */
export function resolveTextDraftNormSize({
  wantWpx,
  wantHpx,
  W,
  H,
  nx,
  ny,
  nwFloor,
  minNw = 0.018,
  minNh = 0.016,
  margin = 0.02,
}) {
  const capNw = 1 - nx - margin
  const capNh = 1 - ny - margin
  const measuredNw = wantWpx / W
  let newNw
  if (nwFloor != null && Number.isFinite(nwFloor)) {
    newNw = Math.min(capNw, Math.max(minNw, nwFloor, measuredNw))
  } else {
    newNw = Math.min(capNw, Math.max(minNw, measuredNw))
  }
  const measuredNh = wantHpx / H
  const newNh = Math.min(capNh, Math.max(minNh, measuredNh))
  return { nw: newNw, nh: newNh }
}
