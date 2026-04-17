/**
 * GA4 `tool` / `feature_name` values (snake_case). Maps app routes to spec-friendly names.
 */
export const ANALYTICS_TOOL = {
  edit_pdf: 'edit_pdf',
  sign_pdf: 'sign_pdf',
  /** JPG → PDF (combine images) */
  merge_pdf: 'merge_pdf',
  /** Merge multiple PDF files into one */
  pdf_merge: 'pdf_merge',
  split_pdf: 'split_pdf',
  compress_pdf: 'compress_pdf',
  pdf_to_jpg: 'pdf_to_jpg',
  unlock_pdf: 'unlock_pdf',
  organize_pdf: 'organize_pdf',
  watermark_pdf: 'watermark_pdf',
  /** Camera / image scan → single PDF (browser-only). */
  scan_to_pdf: 'scan_to_pdf',
  /** DOCX → PDF via server (Gotenberg when configured). */
  word_to_pdf: 'word_to_pdf',
}

/** Toolkit registry `id` → analytics feature key for `feature_used` */
export const REGISTRY_ID_TO_FEATURE = {
  'edit-pdf': ANALYTICS_TOOL.edit_pdf,
  'merge-pdf': ANALYTICS_TOOL.pdf_merge,
  'split-pdf': ANALYTICS_TOOL.split_pdf,
  'compress-pdf': ANALYTICS_TOOL.compress_pdf,
  'sign-pdf': ANALYTICS_TOOL.sign_pdf,
  'pdf-to-jpg': ANALYTICS_TOOL.pdf_to_jpg,
  'jpg-to-pdf': ANALYTICS_TOOL.merge_pdf,
  'unlock-pdf': ANALYTICS_TOOL.unlock_pdf,
  'organize-pdf': ANALYTICS_TOOL.organize_pdf,
  'add-watermark': ANALYTICS_TOOL.watermark_pdf,
  'scan-to-pdf': ANALYTICS_TOOL.scan_to_pdf,
  'pdf-to-word': 'pdf_to_word',
  'word-to-pdf': ANALYTICS_TOOL.word_to_pdf,
}
