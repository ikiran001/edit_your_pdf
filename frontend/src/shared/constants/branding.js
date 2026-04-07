/** Single source of truth for product branding. */
export const BRAND_NAME = 'pdfpilot'
export const TAGLINE = 'Navigate your PDFs effortlessly'

export const DOC_TITLE_HOME = 'Edit PDF Online Free | pdfpilot.pro'

const TOOL_DOC_TITLES = {
  '/tools/edit-pdf': 'pdfpilot - Edit PDF',
  '/tools/merge-pdf': 'pdfpilot - Merge PDF',
  '/tools/split-pdf': 'pdfpilot - Split PDF',
  '/tools/compress-pdf': 'pdfpilot - Compress PDF',
  '/tools/sign-pdf': 'pdfpilot - Sign PDF',
  '/tools/pdf-to-jpg': 'pdfpilot - PDF to JPG',
  '/tools/jpg-to-pdf': 'pdfpilot - JPG to PDF',
  '/tools/unlock-pdf': 'pdfpilot - Unlock PDF',
  '/tools/pdf-to-word': 'pdfpilot - PDF to Word',
  '/tools/word-to-pdf': 'pdfpilot - Word to PDF',
}

/**
 * Browser tab title for a route pathname (React Router path, no basename prefix in path).
 */
export function docTitleForPath(pathname) {
  const p = (pathname || '/').replace(/\/$/, '') || '/'
  return TOOL_DOC_TITLES[p] || DOC_TITLE_HOME
}

export const MSG = {
  uploading: 'Uploading to pdfpilot…',
  processingFile: 'Processing your file…',
  finalizingPdf: 'Finalizing your PDF…',
  loadingPdf: 'Loading your PDF…',
  fileReady: 'Your file is ready on pdfpilot.',
  savedSession: 'Saved — stored for this session on pdfpilot.',
  /** Shown after native line text is persisted without clicking Save PDF. */
  autoSavedSession: 'Text updated — saved to this session.',
  autoSaveFailed: 'Could not auto-save. Use Save PDF or check your connection.',
  undoToast: 'Undone.',
  redoToast: 'Redone.',
  /** Dismissible banner on first editor visit (localStorage). */
  editorOnboardingHint:
    'Turn on Edit text and Text boxes, then tap or click a line on the PDF. Use the format panel at the side (or bottom on phones) while you edit. Ctrl+Enter applies a line; Escape cancels.',
  /** Short privacy line under session id in the editor. */
  editorSessionPrivacyLine:
    'This file is tied to your session on our server; download or save if you need a permanent copy.',
}

/** e.g. "Edit PDF on pdfpilot" */
export function toolOnBrand(toolTitle) {
  return `${toolTitle} on ${BRAND_NAME}`
}
