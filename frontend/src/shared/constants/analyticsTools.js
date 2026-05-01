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
  encrypt_pdf: 'encrypt_pdf',
  organize_pdf: 'organize_pdf',
  watermark_pdf: 'watermark_pdf',
  /** Client-side page number stamping (pdf-lib). */
  page_numbers_pdf: 'page_numbers_pdf',
  /** Camera / image scan → single PDF (browser-only). */
  scan_to_pdf: 'scan_to_pdf',
  /** DOCX → PDF via server (Gotenberg when configured). */
  word_to_pdf: 'word_to_pdf',
  /** PDF → DOCX via LibreOffice on the API server (`SOFFICE_PATH`). */
  pdf_to_word: 'pdf_to_word',
  /** GST-style tax invoice PDF generated in the browser (pdf-lib). */
  gst_invoice: 'gst_invoice',
  /** Server ocrmypdf + Tesseract → searchable PDF. */
  ocr_pdf: 'ocr_pdf',
  /** PDF → PNG pages in browser. */
  pdf_to_png: 'pdf_to_png',
  /** PDF → .txt (pdf.js text layer). */
  pdf_to_text: 'pdf_to_text',
  /** Flatten forms or rasterize pages. */
  flatten_pdf: 'flatten_pdf',
  /** Fill AcroForm fields. */
  fill_pdf: 'fill_pdf',
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
  'encrypt-pdf': ANALYTICS_TOOL.encrypt_pdf,
  'organize-pdf': ANALYTICS_TOOL.organize_pdf,
  'add-page-numbers': ANALYTICS_TOOL.page_numbers_pdf,
  'add-watermark': ANALYTICS_TOOL.watermark_pdf,
  'scan-to-pdf': ANALYTICS_TOOL.scan_to_pdf,
  'pdf-to-word': ANALYTICS_TOOL.pdf_to_word,
  'word-to-pdf': ANALYTICS_TOOL.word_to_pdf,
  'gst-invoice': ANALYTICS_TOOL.gst_invoice,
  'ocr-pdf': ANALYTICS_TOOL.ocr_pdf,
  'pdf-to-png': ANALYTICS_TOOL.pdf_to_png,
  'pdf-to-text': ANALYTICS_TOOL.pdf_to_text,
  'flatten-pdf': ANALYTICS_TOOL.flatten_pdf,
  'fill-pdf': ANALYTICS_TOOL.fill_pdf,
}
