/**
 * GA4 `tool` / `feature_name` values (snake_case). Maps app routes to spec-friendly names.
 */
export const ANALYTICS_TOOL = {
  edit_pdf: 'edit_pdf',
  sign_pdf: 'sign_pdf',
  /** JPG → PDF (combine images); aligns with “Merge PDF” style journeys */
  merge_pdf: 'merge_pdf',
  pdf_to_jpg: 'pdf_to_jpg',
  unlock_pdf: 'unlock_pdf',
}

/** Toolkit registry `id` → analytics feature key for `feature_used` */
export const REGISTRY_ID_TO_FEATURE = {
  'edit-pdf': ANALYTICS_TOOL.edit_pdf,
  'sign-pdf': ANALYTICS_TOOL.sign_pdf,
  'pdf-to-jpg': ANALYTICS_TOOL.pdf_to_jpg,
  'jpg-to-pdf': ANALYTICS_TOOL.merge_pdf,
  'unlock-pdf': ANALYTICS_TOOL.unlock_pdf,
  'pdf-to-word': 'pdf_to_word',
  'word-to-pdf': 'word_to_pdf',
}
