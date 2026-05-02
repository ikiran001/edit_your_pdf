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
  remove_pages: 'remove_pages',
  extract_pages: 'extract_pages',
  repair_pdf: 'repair_pdf',
  powerpoint_to_pdf: 'powerpoint_to_pdf',
  excel_to_pdf: 'excel_to_pdf',
  html_to_pdf: 'html_to_pdf',
  pdf_to_powerpoint: 'pdf_to_powerpoint',
  pdf_to_excel: 'pdf_to_excel',
  pdf_to_pdfa: 'pdf_to_pdfa',
  rotate_pdf: 'rotate_pdf',
  crop_pdf: 'crop_pdf',
  redact_pdf: 'redact_pdf',
  compare_pdf: 'compare_pdf',
  ai_pdf_summarizer: 'ai_pdf_summarizer',
  translate_pdf: 'translate_pdf',
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
  'remove-pages': ANALYTICS_TOOL.remove_pages,
  'extract-pages': ANALYTICS_TOOL.extract_pages,
  'repair-pdf': ANALYTICS_TOOL.repair_pdf,
  'powerpoint-to-pdf': ANALYTICS_TOOL.powerpoint_to_pdf,
  'excel-to-pdf': ANALYTICS_TOOL.excel_to_pdf,
  'html-to-pdf': ANALYTICS_TOOL.html_to_pdf,
  'pdf-to-powerpoint': ANALYTICS_TOOL.pdf_to_powerpoint,
  'pdf-to-excel': ANALYTICS_TOOL.pdf_to_excel,
  'pdf-to-pdfa': ANALYTICS_TOOL.pdf_to_pdfa,
  'rotate-pdf': ANALYTICS_TOOL.rotate_pdf,
  'crop-pdf': ANALYTICS_TOOL.crop_pdf,
  'redact-pdf': ANALYTICS_TOOL.redact_pdf,
  'compare-pdf': ANALYTICS_TOOL.compare_pdf,
  'ai-pdf-summarizer': ANALYTICS_TOOL.ai_pdf_summarizer,
  'translate-pdf': ANALYTICS_TOOL.translate_pdf,
}
