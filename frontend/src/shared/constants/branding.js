/** Single source of truth for product branding. */
export const BRAND_NAME = 'TheBestPDF'
export const TAGLINE = 'Free PDF tools. Fast, simple, no watermark.'

export const DOC_TITLE_HOME = 'TheBestPDF – Free PDF Tools (No Watermark)'

const TOOL_DOC_TITLES = {
  '/tools/edit-pdf': 'TheBestPDF – Edit PDF',
  '/tools/sign-pdf': 'TheBestPDF – Sign PDF',
  '/tools/pdf-to-jpg': 'TheBestPDF – PDF to JPG',
  '/tools/jpg-to-pdf': 'TheBestPDF – JPG to PDF',
  '/tools/unlock-pdf': 'TheBestPDF – Unlock PDF',
  '/tools/pdf-to-word': 'TheBestPDF – PDF to Word',
  '/tools/word-to-pdf': 'TheBestPDF – Word to PDF',
}

/**
 * Browser tab title for a route pathname (React Router path, no basename prefix in path).
 */
export function docTitleForPath(pathname) {
  const p = (pathname || '/').replace(/\/$/, '') || '/'
  return TOOL_DOC_TITLES[p] || DOC_TITLE_HOME
}

export const MSG = {
  uploading: 'Uploading to TheBestPDF…',
  processingFile: 'Processing your file…',
  finalizingPdf: 'Finalizing your PDF…',
  loadingPdf: 'Loading your PDF…',
  fileReady: 'Your file is ready on TheBestPDF.',
  savedSession: 'Saved — stored for this session on TheBestPDF.',
}

/** e.g. "Edit PDF on TheBestPDF" */
export function toolOnBrand(toolTitle) {
  return `${toolTitle} on ${BRAND_NAME}`
}
