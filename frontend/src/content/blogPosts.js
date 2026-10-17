/**
 * Blog content — plain data (no JSX) so it is importable by the app AND by the
 * build scripts (generate-sitemap.mjs, prerender.mjs).
 *
 * Each post `body` is an array of blocks rendered by BlogPostPage:
 *   { type: 'p'|'h2'|'h3'|'note', text }
 *   { type: 'ul'|'ol', items: string[] }
 *   { type: 'cta', path, label }
 *
 * Keep `description` ≤ ~160 chars (used as the meta description + card summary).
 */

export const BLOG_BASE = '/blog'

/** @typedef {{ type: string, text?: string, items?: string[], path?: string, label?: string }} Block */

export const BLOG_POSTS = [
  {
    slug: 'compress-pdf-to-100kb-for-aadhaar',
    title: 'How to Compress a PDF to 100KB for Aadhaar & Government Uploads',
    description:
      'Step-by-step guide to shrink a PDF under 100KB (or 200KB/500KB) for UIDAI, SSC, UPSC and other Indian government portals — free, in your browser.',
    date: '2026-10-17',
    readMins: 4,
    tags: ['Compress', 'Government', 'Aadhaar'],
    relatedTools: [{ path: '/tools/compress-pdf', label: 'Compress PDF' }],
    body: [
      { type: 'p', text: 'Indian government portals are strict about file size. UIDAI, SSC, UPSC, passport Seva, and most state recruitment sites cap PDF uploads at 100KB, 200KB, or 500KB — and reject anything larger. Here is how to get a PDF under the limit in a couple of minutes, for free, without installing anything.' },
      { type: 'h2', text: 'The quick way to compress a PDF under 100KB' },
      { type: 'ol', items: [
        'Open the Compress PDF tool and add your file.',
        'Choose a stronger compression level (Medium or High).',
        'Download the compressed file and check its new size.',
        'Still above the limit? Run it again at a higher level, or crop/remove pages you do not need.',
      ] },
      { type: 'cta', path: '/tools/compress-pdf', label: 'Compress a PDF now' },
      { type: 'h2', text: 'Common size limits on Indian portals' },
      { type: 'ul', items: [
        'PDFs: usually 100KB, 200KB, or 500KB.',
        'Photos and signatures: often 20KB–50KB (JPG), with fixed dimensions.',
        'Always compress to just under the stated limit — do not aim exactly at it.',
      ] },
      { type: 'h2', text: 'Will compressing ruin the quality?' },
      { type: 'p', text: 'Light compression keeps text crisp. Stronger levels downsample images, which can soften scans — but for documents that only need to be legible (mark sheets, ID proofs, certificates), Medium or High is usually fine. Open the file and read it before you submit.' },
      { type: 'note', text: 'Tip: keep the original, higher-quality PDF as a backup in case you need a sharper copy later.' },
      { type: 'h2', text: 'Why file size matters for these forms' },
      { type: 'p', text: 'Upload caps exist so portals can store millions of applications cheaply and serve them quickly. A 2MB scan that looks identical to a 90KB one just wastes space — compression removes that overhead so your document fits without losing what reviewers actually need to read.' },
    ],
  },
  {
    slug: 'how-to-create-gst-invoice-india',
    title: 'How to Create a GST Invoice in India (Free, Step by Step)',
    description:
      'What a GST invoice must include — GSTIN, HSN, CGST/SGST vs IGST — and how to generate a clean GST tax invoice PDF for free.',
    date: '2026-10-17',
    readMins: 5,
    tags: ['GST', 'Invoice', 'Business'],
    relatedTools: [{ path: '/tools/gst-invoice', label: 'GST Invoice Generator' }],
    body: [
      { type: 'p', text: 'If you are a registered business or freelancer in India, your tax invoice needs specific fields to be GST-ready. This guide covers what to include and how to generate a clean invoice PDF in minutes.' },
      { type: 'h2', text: 'Mandatory fields on a GST invoice' },
      { type: 'ul', items: [
        'Supplier name, address, and GSTIN.',
        'A unique, sequential invoice number and the invoice date.',
        'Buyer name, address, and GSTIN (for B2B sales).',
        'Place of supply (important for deciding CGST/SGST vs IGST).',
        'HSN (goods) or SAC (services) code for each line item.',
        'Description, quantity, taxable value, and GST rate per line.',
        'The tax split: CGST + SGST, or IGST, and the grand total.',
      ] },
      { type: 'h2', text: 'CGST + SGST or IGST — which applies?' },
      { type: 'p', text: 'If the supplier and buyer are in the same state (same two-digit state code, e.g. 27 for Maharashtra), GST splits into CGST + SGST. If they are in different states, you charge IGST instead. A good generator decides this automatically from the state codes you enter.' },
      { type: 'h2', text: 'Generate your GST invoice PDF' },
      { type: 'ol', items: [
        'Open the GST Invoice tool.',
        'Enter seller and buyer details, GSTINs, and two-digit state codes.',
        'Add line items with HSN/SAC, quantity, taxable rate, and GST %.',
        'Click generate — totals and the CGST/SGST or IGST split are calculated for you.',
        'Download the PDF and share or file it like any other document.',
      ] },
      { type: 'cta', path: '/tools/gst-invoice', label: 'Create a GST invoice' },
      { type: 'note', text: 'This is great for drafts and internal paperwork. For e-invoicing (IRN and QR code) and return filing, confirm the final format with a qualified chartered accountant.' },
    ],
  },
  {
    slug: 'convert-pdf-to-word-free',
    title: 'How to Convert PDF to Word for Free (and Keep It Editable)',
    description:
      'Convert a PDF into an editable Word document free in your browser, when to run OCR first for scans, and tips to keep the layout clean.',
    date: '2026-10-17',
    readMins: 4,
    tags: ['Convert', 'Word'],
    relatedTools: [
      { path: '/tools/pdf-to-word', label: 'PDF to Word' },
      { path: '/tools/ocr-pdf', label: 'OCR PDF' },
    ],
    body: [
      { type: 'p', text: 'Need to edit a PDF in Microsoft Word? You can convert it to an editable .docx for free, right in your browser, without emailing your document to a converter service.' },
      { type: 'h2', text: 'Convert a text-based PDF to Word' },
      { type: 'ol', items: [
        'Open the PDF to Word tool.',
        'Upload your PDF — the text is extracted in your browser.',
        'Download the generated .docx and open it in Word or Google Docs.',
        'Fix any spacing or formatting, then save.',
      ] },
      { type: 'cta', path: '/tools/pdf-to-word', label: 'Convert PDF to Word' },
      { type: 'h2', text: 'If your PDF is a scan, run OCR first' },
      { type: 'p', text: 'Scanned PDFs are just images of pages — there is no text to extract, so conversion comes out empty or garbled. Run OCR first to add a real text layer, then convert to Word.' },
      { type: 'cta', path: '/tools/ocr-pdf', label: 'Make a scan searchable with OCR' },
      { type: 'h2', text: 'What to expect' },
      { type: 'ul', items: [
        'Best results come from clean, text-based PDFs.',
        'Complex layouts, tables, and exact fonts may simplify — treat the output as an editable draft.',
        'Always review the .docx before you send it on.',
      ] },
      { type: 'note', text: 'Your file is processed in your browser for this conversion, so it is not uploaded to a converter API.' },
    ],
  },
  {
    slug: 'make-scanned-pdf-searchable-ocr-hindi',
    title: 'How to Make a Scanned PDF Searchable with OCR (English & Hindi)',
    description:
      'Turn scanned PDFs and photos into searchable, copy-paste text with OCR — including Hindi — so you can find, copy, and reuse content.',
    date: '2026-10-17',
    readMins: 4,
    tags: ['OCR', 'Hindi', 'Scan'],
    relatedTools: [
      { path: '/tools/ocr-pdf', label: 'OCR PDF' },
      { path: '/tools/pdf-to-text', label: 'PDF to Text' },
    ],
    body: [
      { type: 'p', text: 'A scanned PDF looks like a document but behaves like a photo — you cannot select, search, or copy its text. OCR (optical character recognition) fixes that by adding a real, searchable text layer over the scan.' },
      { type: 'h2', text: 'Turn a scan into searchable text' },
      { type: 'ol', items: [
        'Open the OCR PDF tool.',
        'Upload your scanned PDF (camera photos, exported copies, or mixed documents).',
        'Run OCR — large files can take a few minutes.',
        'Download the new PDF. You can now search, select, and copy its text.',
      ] },
      { type: 'cta', path: '/tools/ocr-pdf', label: 'Run OCR on a PDF' },
      { type: 'h2', text: 'Does OCR work for Hindi?' },
      { type: 'p', text: 'Yes. OCR here runs on the server with open-source tools (ocrmypdf and Tesseract) and supports English and Hindi, so scanned Hindi documents become searchable too — handy for records, notices, and study material.' },
      { type: 'h2', text: 'Just need the plain text?' },
      { type: 'p', text: 'If your PDF already has a text layer (a normal digital PDF, or one you just ran OCR on), you can pull the words straight out with the PDF to Text tool — ideal for notes, scripts, or quick edits.' },
      { type: 'cta', path: '/tools/pdf-to-text', label: 'Extract text from a PDF' },
    ],
  },
  {
    slug: 'password-protect-pdf-free',
    title: 'How to Password-Protect a PDF for Free',
    description:
      'Add a password to a PDF with strong AES-256 encryption so only people you trust can open it — free, step by step.',
    date: '2026-10-17',
    readMins: 3,
    tags: ['Security', 'Encrypt'],
    relatedTools: [
      { path: '/tools/encrypt-pdf', label: 'Encrypt PDF' },
      { path: '/tools/unlock-pdf', label: 'Unlock PDF' },
    ],
    body: [
      { type: 'p', text: 'Sending a salary slip, bank statement, or contract? Add a password so only the right person can open it. Here is how to encrypt a PDF for free.' },
      { type: 'h2', text: 'Password-protect your PDF' },
      { type: 'ol', items: [
        'Open the Encrypt PDF tool and upload your file.',
        'Choose a strong, unique password.',
        'Download the encrypted PDF — it now needs the password to open.',
      ] },
      { type: 'cta', path: '/tools/encrypt-pdf', label: 'Encrypt a PDF' },
      { type: 'h2', text: 'How strong is it?' },
      { type: 'p', text: 'The file is protected with AES-256 — the same encryption standard trusted for sensitive documents. But a PDF is only as safe as the password you choose, so avoid names and dates, and store it in a password manager.' },
      { type: 'note', text: 'Share the password through a different channel than the file itself (e.g. file by email, password by message).' },
      { type: 'h2', text: 'Need to remove a password later?' },
      { type: 'p', text: 'If you already know the password and want an unlocked copy for your own records, use the Unlock PDF tool.' },
      { type: 'cta', path: '/tools/unlock-pdf', label: 'Unlock a PDF' },
    ],
  },
  {
    slug: 'merge-pdf-for-applications',
    title: 'How to Merge PDF Files for Job & Visa Applications',
    description:
      'Combine certificates, mark sheets, and ID proofs into one neat PDF in the right order — free and private, in your browser.',
    date: '2026-10-17',
    readMins: 3,
    tags: ['Merge', 'Applications'],
    relatedTools: [
      { path: '/tools/merge-pdf', label: 'Merge PDF' },
      { path: '/tools/compress-pdf', label: 'Compress PDF' },
    ],
    body: [
      { type: 'p', text: 'Most job portals, university forms, and visa applications ask for a single PDF with all your documents in a set order. Instead of stapling screenshots together, merge them into one clean file.' },
      { type: 'h2', text: 'Merge your documents into one PDF' },
      { type: 'ol', items: [
        'Open the Merge PDF tool and add every file (certificates, mark sheets, ID proofs).',
        'Drag them into the exact order the application asks for.',
        'Remove anything added by mistake, then merge.',
        'Download the single combined PDF.',
      ] },
      { type: 'cta', path: '/tools/merge-pdf', label: 'Merge PDFs now' },
      { type: 'h2', text: 'Keep it private' },
      { type: 'p', text: 'Merging runs entirely in your browser, so your personal documents are combined locally and not uploaded to a third-party server.' },
      { type: 'h2', text: 'Too large to upload?' },
      { type: 'p', text: 'If the merged file is over the portal’s size limit, run it through Compress PDF to shrink it before you submit.' },
      { type: 'cta', path: '/tools/compress-pdf', label: 'Compress the merged PDF' },
    ],
  },
  {
    slug: 'images-to-pdf-for-applications',
    title: 'How to Convert Photos to PDF for Online Applications',
    description:
      'Turn phone photos or scans of your documents into a single, neat PDF for uploads — free, in the right order, in your browser.',
    date: '2026-10-17',
    readMins: 3,
    tags: ['Images', 'Applications'],
    relatedTools: [
      { path: '/tools/jpg-to-pdf', label: 'JPG to PDF' },
      { path: '/tools/scan-to-pdf', label: 'Scan to PDF' },
    ],
    body: [
      { type: 'p', text: 'Many forms want a PDF, but all you have are photos of your documents. Converting images to a single PDF takes seconds and looks far more professional than uploading loose JPGs.' },
      { type: 'h2', text: 'Convert your photos to one PDF' },
      { type: 'ol', items: [
        'Open the JPG to PDF tool and upload your images (JPG or PNG).',
        'Drag the thumbnails into the correct order.',
        'Create the PDF and download it.',
      ] },
      { type: 'cta', path: '/tools/jpg-to-pdf', label: 'Convert images to PDF' },
      { type: 'h2', text: 'No photos yet? Scan with your camera' },
      { type: 'p', text: 'If you still need to capture the documents, use Scan to PDF to photograph each page with your phone or webcam and build a clean multi-page PDF directly.' },
      { type: 'cta', path: '/tools/scan-to-pdf', label: 'Scan documents to PDF' },
    ],
  },
]

/** @param {string} slug */
export function getBlogPost(slug) {
  return BLOG_POSTS.find((p) => p.slug === slug) || null
}
