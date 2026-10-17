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
  '/tools/e-sign': 'pdfpilot - E-Sign PDF',
  '/tools/pdf-to-jpg': 'pdfpilot - PDF to JPG',
  '/tools/pdf-to-png': 'pdfpilot - PDF to PNG',
  '/tools/pdf-to-text': 'pdfpilot - PDF to text',
  '/tools/jpg-to-pdf': 'pdfpilot - JPG to PDF',
  '/tools/scan-to-pdf': 'pdfpilot - Scan to PDF',
  '/tools/unlock-pdf': 'pdfpilot - Unlock PDF',
  '/tools/ocr-pdf': 'pdfpilot - OCR PDF',
  '/tools/encrypt-pdf': 'pdfpilot - Encrypt PDF',
  '/tools/organize-pdf': 'pdfpilot - Organize PDF Pages',
  '/tools/fill-pdf': 'pdfpilot - Fill PDF form',
  '/tools/flatten-pdf': 'pdfpilot - Flatten PDF',
  '/tools/add-page-numbers': 'pdfpilot - Add page numbers',
  '/tools/add-watermark': 'pdfpilot - Add Watermark',
  '/tools/pdf-to-word': 'pdfpilot - PDF to Word',
  '/tools/word-to-pdf': 'pdfpilot - Word to PDF',
  '/tools/gst-invoice': 'pdfpilot - GST invoice PDF',
  '/tools/remove-pages': 'pdfpilot - Remove pages',
  '/tools/extract-pages': 'pdfpilot - Extract pages',
  '/tools/repair-pdf': 'pdfpilot - Repair PDF',
  '/tools/powerpoint-to-pdf': 'pdfpilot - PowerPoint to PDF',
  '/tools/excel-to-pdf': 'pdfpilot - Excel to PDF',
  '/tools/html-to-pdf': 'pdfpilot - HTML to PDF',
  '/tools/pdf-to-powerpoint': 'pdfpilot - PDF to PowerPoint',
  '/tools/pdf-to-excel': 'pdfpilot - PDF to Excel',
  '/tools/pdf-to-pdfa': 'pdfpilot - PDF to PDF/A',
  '/tools/rotate-pdf': 'pdfpilot - Rotate PDF',
  '/tools/crop-pdf': 'pdfpilot - Crop PDF',
  '/tools/redact-pdf': 'pdfpilot - Redact PDF',
  '/tools/compare-pdf': 'pdfpilot - Compare PDF',
  '/tools/translate-pdf': 'pdfpilot - Translate PDF',
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

/**
 * Hand-written, unique SEO meta descriptions for high-intent tool routes (≤160 chars).
 * Each must read naturally and lead with the primary keyword a user would search.
 * Routes not listed here get a synthesized unique description from their title.
 */
const TOOL_META_DESCRIPTIONS = {
  '/tools/edit-pdf':
    'Edit PDF online free — change text, highlight, draw, and annotate pages right in your browser. No installation. Fast, private, and easy with pdfpilot.',
  '/tools/merge-pdf':
    'Merge PDF files online free — combine multiple PDFs into one document in seconds. Reorder before you merge. No sign-up, no watermark, powered by pdfpilot.',
  '/tools/split-pdf':
    'Split PDF online free — separate pages by range or extract every page into its own file. Fast, secure, no installation needed. pdfpilot PDF tools.',
  '/tools/compress-pdf':
    'Compress PDF online free — reduce PDF file size for email, uploads, and Aadhaar/GST forms while keeping quality. Fast and private with pdfpilot.',
  '/tools/sign-pdf':
    'Sign PDF online free — draw, type, or upload your signature and place it anywhere on the document. Secure e-signatures in your browser with pdfpilot.',
  '/tools/fill-pdf':
    'Fill PDF forms online free — type into form fields, add text, and download the completed PDF. No printing or scanning needed. pdfpilot form filler.',
  '/tools/pdf-to-word':
    'Convert PDF to Word online free — turn PDF into an editable DOCX while preserving layout and text. Fast, accurate conversion with pdfpilot.',
  '/tools/word-to-pdf':
    'Convert Word to PDF online free — turn DOC and DOCX files into clean, shareable PDFs in seconds. Keep your formatting intact with pdfpilot.',
  '/tools/pdf-to-jpg':
    'Convert PDF to JPG online free — export each PDF page as a high-quality JPG image. Fast, private, no installation. pdfpilot PDF to image converter.',
  '/tools/jpg-to-pdf':
    'Convert JPG to PDF online free — combine photos and images into a single PDF. Reorder pages before export. Fast and secure with pdfpilot.',
  '/tools/ocr-pdf':
    'OCR PDF online — turn scanned PDFs and photos into searchable, copy-paste text (English + Hindi supported). Make any scan selectable with pdfpilot.',
  '/tools/scan-to-pdf':
    'Scan to PDF online free — capture documents with your camera and save them as a clean, shareable PDF. Great for receipts and forms. pdfpilot scanner.',
  '/tools/unlock-pdf':
    'Unlock PDF online free — remove a known password from a protected PDF so you can view and edit it. Fast and secure with pdfpilot.',
  '/tools/encrypt-pdf':
    'Encrypt PDF online free — add a password and protect your PDF with strong encryption before sharing. Keep sensitive documents safe with pdfpilot.',
  '/tools/organize-pdf':
    'Organize PDF pages online free — reorder, rotate, and delete pages with drag-and-drop, then download. Fast and private with pdfpilot.',
  '/tools/add-watermark':
    'Add a watermark to PDF online free — stamp text or an image across pages with custom opacity and placement. Brand or protect files with pdfpilot.',
  '/tools/add-page-numbers':
    'Add page numbers to PDF online free — choose position, format, and page range, then download. Fast, in-browser page numbering with pdfpilot.',
  '/tools/gst-invoice':
    'Free GST invoice generator — create a clean GST-style tax invoice PDF in minutes. Add items with HSN, auto CGST/SGST/IGST, then download. pdfpilot.',
  '/tools/rotate-pdf':
    'Rotate PDF online free — fix sideways or upside-down pages and save the corrected PDF. Rotate single pages or the whole file with pdfpilot.',
  '/tools/crop-pdf':
    'Crop PDF online free — trim margins and remove unwanted areas from pages, then download. Fast, precise cropping in your browser with pdfpilot.',
  '/tools/redact-pdf':
    'Redact PDF online free — permanently black out sensitive text and information before sharing. Protect private data with pdfpilot.',
  '/tools/flatten-pdf':
    'Flatten PDF online free — merge annotations and form fields into the page so they can’t be edited. Lock your final document with pdfpilot.',
  '/tools/translate-pdf':
    'Translate PDF online — convert your document into another language while keeping it readable. AI-powered PDF translation with pdfpilot.',
}

/**
 * SEO meta description for a route pathname. Falls back to a unique synthesized
 * line from the route title, then the site default for the home/unknown routes.
 */
export function metaDescriptionForPath(pathname) {
  const p = (pathname || '/').replace(/\/$/, '') || '/'
  if (p === '/') return DEFAULT_SITE_DESCRIPTION
  if (TOOL_META_DESCRIPTIONS[p]) return TOOL_META_DESCRIPTIONS[p]
  const title = TOOL_DOC_TITLES[p]
  if (title) {
    const feature = title.replace(/^pdfpilot\s*[-–]\s*/, '')
    return `${feature} online free with pdfpilot — fast, secure, and easy to use. No installation needed for most tools.`
  }
  return DEFAULT_SITE_DESCRIPTION
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
