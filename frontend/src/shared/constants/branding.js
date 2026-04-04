/** Single source of truth for product branding. */
export const BRAND_NAME = 'PDFly'
export const TAGLINE = 'Free PDF tools. Fast, simple, no watermark.'

export const DOC_TITLE_HOME = 'PDFly - Edit, Sign & Convert PDFs'

const TOOL_DOC_TITLES = {
  '/tools/edit-pdf': 'PDFly - Edit PDF',
  '/tools/merge-pdf': 'PDFly - Merge PDF',
  '/tools/split-pdf': 'PDFly - Split PDF',
  '/tools/compress-pdf': 'PDFly - Compress PDF',
  '/tools/sign-pdf': 'PDFly - Sign PDF',
  '/tools/pdf-to-jpg': 'PDFly - PDF to JPG',
  '/tools/jpg-to-pdf': 'PDFly - JPG to PDF',
  '/tools/unlock-pdf': 'PDFly - Unlock PDF',
  '/tools/pdf-to-word': 'PDFly - PDF to Word',
  '/tools/word-to-pdf': 'PDFly - Word to PDF',
}

/**
 * Browser tab title for a route pathname (React Router path, no basename prefix in path).
 */
export function docTitleForPath(pathname) {
  const p = (pathname || '/').replace(/\/$/, '') || '/'
  return TOOL_DOC_TITLES[p] || DOC_TITLE_HOME
}

export const MSG = {
  uploading: 'Uploading to PDFly…',
  processingFile: 'Processing your file…',
  finalizingPdf: 'Finalizing your PDF…',
  loadingPdf: 'Loading your PDF…',
  fileReady: 'Your file is ready on PDFly.',
  savedSession: 'Saved — stored for this session on PDFly.',
}

/** e.g. "Edit PDF on PDFly" */
export function toolOnBrand(toolTitle) {
  return `${toolTitle} on ${BRAND_NAME}`
}
