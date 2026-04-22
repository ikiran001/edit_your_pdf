/** Single source of truth for product branding. */
export const BRAND_NAME = 'pdfpilot'

/** Shown on Terms of Service and legal footers. */
export const LEGAL_ENTITY_NAME = 'pdfpilot'
export const LEGAL_CONTACT_EMAIL = 'ijkiranp@gmail.com'
/** ISO-style date for “Last updated” on legal pages. */
export const TERMS_LAST_UPDATED = '2026-04-18'

/**
 * Contractual governing law / courts (where local law allows parties to choose).
 * Does **not** override mandatory consumer, employment, or public-policy rules in a user’s country.
 * Confirm with counsel for your entity’s seat, users, and risk tolerance.
 */
export const LEGAL_GOVERNING_LAW_PLACE = 'India'
export const LEGAL_GOVERNING_COURTS = 'the courts of India'
export const TAGLINE = 'Navigate your PDFs effortlessly'

/** Main subheading on the toolkit home (under the brand name). */
export const HOME_HERO_SUBLINE =
  'Edit, compress, merge and manage PDFs instantly — PurPDF-grade clarity, speed, and trustworthy exports from pdfpilot.'

/** Default SEO / social description (mirrored in frontend/index.html and manifest). */
export const DEFAULT_SITE_DESCRIPTION =
  'Edit, compress, merge and manage PDFs instantly with pdfpilot — PurPDF-grade quality for merges, compresses, edits, and exports. Free and fast PDF tools.'

export const DOC_TITLE_HOME = 'Edit PDF Online Free | pdfpilot.pro'

const TOOL_DOC_TITLES = {
  '/my-documents': 'pdfpilot - Saved PDFs',
  '/account/subscription': 'pdfpilot - Subscription & billing',
  '/tools/edit-pdf': 'pdfpilot - Edit PDF',
  '/tools/edit-pdf/editor': 'pdfpilot - Edit PDF',
  '/tools/merge-pdf': 'pdfpilot - Merge PDF',
  '/tools/split-pdf': 'pdfpilot - Split PDF',
  '/tools/compress-pdf': 'pdfpilot - Compress PDF',
  '/tools/sign-pdf': 'pdfpilot - Sign PDF',
  '/tools/pdf-to-jpg': 'pdfpilot - PDF to JPG',
  '/tools/jpg-to-pdf': 'pdfpilot - JPG to PDF',
  '/tools/scan-to-pdf': 'pdfpilot - Scan to PDF',
  '/tools/unlock-pdf': 'pdfpilot - Unlock PDF',
  '/tools/encrypt-pdf': 'pdfpilot - Encrypt PDF',
  '/tools/organize-pdf': 'pdfpilot - Organize PDF Pages',
  '/tools/add-watermark': 'pdfpilot - Add Watermark',
  '/tools/pdf-to-word': 'pdfpilot - PDF to Word',
  '/tools/word-to-pdf': 'pdfpilot - Word to PDF',
  '/tools/gst-invoice': 'pdfpilot - GST invoice PDF',
  '/terms': 'pdfpilot - Terms of Service',
  '/feedback': 'pdfpilot - Share feedback',
  '/admin/feedback': 'pdfpilot - Feedback admin',
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
    '1) Turn on Text edit mode and pick Edit text. 2) Tap a line on the page — use the format panel on the side (or bottom on a phone). 3) Ctrl+Enter applies a line; Escape cancels. Save PDF / Download when you are finished.',
  /** One-line helper next to “Flatten forms on save” in the toolbar. */
  editorFlattenHelper:
    'Turn on so fillable fields print as normal text instead of blue form shading.',
  /** Short privacy line under session id in the editor. */
  editorSessionPrivacyLine:
    'This file is tied to your session on our server; download or save if you need a permanent copy.',
}

/** e.g. "Edit PDF on pdfpilot" */
export function toolOnBrand(toolTitle) {
  return `${toolTitle} on ${BRAND_NAME}`
}
