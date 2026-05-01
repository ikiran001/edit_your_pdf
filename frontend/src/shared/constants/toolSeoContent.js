/**
 * SEO-friendly marketing copy per toolkit route id (`TOOL_REGISTRY.id`).
 * Used by ToolFeatureSeoSection — keep language accurate per tool (browser vs API vs session).
 */

/** @typedef {{ title: string, body: string }} SeoBenefitOrHighlight */

/**
 * @typedef {Object} ToolSeoEntry
 * @property {string} featureName — display name for headings
 * @property {string[]} intro — 2–3 short paragraphs
 * @property {string[]} steps — numbered “how to” steps
 * @property {SeoBenefitOrHighlight[]} benefits — “why use” items
 * @property {SeoBenefitOrHighlight[]} highlights — exactly 3 cards
 */

/** @type {Record<string, ToolSeoEntry>} */
export const TOOL_SEO_BY_ID = {
  'edit-pdf': {
    featureName: 'Edit PDF',
    intro: [
      'Edit PDF online to fix text, add highlights, sketch notes, and mark up pages without installing desktop software. Upload starts a focused editing session so you can work through your document in one place.',
      'Your PDF is tied to your session on pdfpilot—ideal when you want to avoid passing drafts through random file-sharing sites. When you are done, download the updated PDF and keep a copy of the original if you might need it later.',
    ],
    steps: [
      'Open Edit PDF from the toolkit and upload your file (drag-and-drop or browse).',
      'Wait for the document to open in the viewer.',
      'Use the on-screen tools to adjust text where supported, highlight important lines, or draw simple annotations.',
      'Move between pages on longer files so every section is covered.',
      'Save or apply changes according to the prompts so your edits are kept for this session.',
      'Download your updated PDF and store it somewhere safe.',
    ],
    benefits: [
      {
        title: 'Fix mistakes quickly',
        body: 'Correct typos, dates, or labels on contracts, forms, and handouts without rebuilding the file from scratch.',
      },
      {
        title: 'No heavy design suite',
        body: 'Edit PDF online from a normal browser—helpful on a work laptop or when you cannot install extra apps.',
      },
      {
        title: 'Session-based workflow',
        body: 'Keep the document inside your editing session instead of emailing ten versions back and forth.',
      },
      {
        title: 'One flow for light edits',
        body: 'Handle quick markup and text tweaks in a single tool before you share or archive.',
      },
    ],
    highlights: [
      {
        title: 'In-browser viewer',
        body: 'Work directly in the tab with tools tuned for everyday PDF edits.',
      },
      {
        title: 'Text and markup',
        body: 'Update copy and add emphasis without exporting to Word for tiny changes.',
      },
      {
        title: 'Multi-page navigation',
        body: 'Scroll through reports and proposals without losing context.',
      },
    ],
  },

  'merge-pdf': {
    featureName: 'Merge PDF',
    intro: [
      'Merge PDF files into one document for easier sharing, printing, and archiving. Put appendices, exhibits, and scans in the exact order you want.',
      'Everything runs in your browser on pdfpilot—your PDFs are combined locally, so you skip uploading them to a third-party server just to stitch pages together.',
    ],
    steps: [
      'Open Merge PDF from the toolkit.',
      'Upload every PDF you want in the final file (you can add several at once).',
      'Drag files in the list until the order matches how readers should see the pages.',
      'Remove any file you added by mistake.',
      'Click merge and wait a moment while the tool builds one PDF.',
      'Download the merged file and rename it if your team uses a naming convention.',
    ],
    benefits: [
      {
        title: 'One attachment instead of many',
        body: 'Send a single merge PDF online for proposals, closing sets, or portfolios.',
      },
      {
        title: 'Clear reading order',
        body: 'Readers open one file from page one to the end—no “open part three first” confusion.',
      },
      {
        title: 'Privacy-friendly combining',
        body: 'Merge PDF files in the browser when you want sensitive annexes to stay off public converters.',
      },
      {
        title: 'Faster print and sign',
        body: 'Print or sign once on a merged PDF instead of juggling separate downloads.',
      },
    ],
    highlights: [
      {
        title: 'Drag-and-drop order',
        body: 'Reorder merges without renaming files on disk.',
      },
      {
        title: 'Multiple inputs',
        body: 'Stack several PDFs in a single run.',
      },
      {
        title: 'Instant download',
        body: 'Grab the combined PDF as soon as processing finishes.',
      },
    ],
  },

  'split-pdf': {
    featureName: 'Split PDF',
    intro: [
      'Split PDF pages into separate files by custom ranges or by every page. Pull out chapters, invoices, or signed sections without copy-pasting screenshots.',
      'Processing stays in your browser, so you can extract pages locally instead of uploading a full contract to an unknown website.',
    ],
    steps: [
      'Open Split PDF and upload your document.',
      'Choose split by page ranges or extract every page into its own PDF.',
      'If you use ranges, type segments such as 1-5, 8 using commas and dashes as the tool describes.',
      'Double-check the page count shown so your ranges stay inside the document.',
      'Run the split and wait for the tool to finish.',
      'Download a ZIP or individual PDFs, then file or share only the slices you need.',
    ],
    benefits: [
      {
        title: 'Share only what matters',
        body: 'Email pages 3-7 to legal while keeping the rest internal.',
      },
      {
        title: 'Cleaner archives',
        body: 'After scanning a thick binder, split PDF online so each topic has its own file.',
      },
      {
        title: 'Less manual work',
        body: 'Avoid print-rescan loops or fragile screenshots for single pages.',
      },
      {
        title: 'Local extraction',
        body: 'Keep sensitive PDFs in the browser workflow you already trust.',
      },
    ],
    highlights: [
      {
        title: 'Flexible ranges',
        body: 'Define multiple segments in one pass.',
      },
      {
        title: 'Every-page export',
        body: 'Ideal for forms or one-page records.',
      },
      {
        title: 'ZIP when needed',
        body: 'Download many parts in one bundle when the tool offers it.',
      },
    ],
  },

  'compress-pdf': {
    featureName: 'Compress PDF',
    intro: [
      'Compress PDF files to shrink size for email limits, cloud folders, and phones. Pick a level that balances smaller files against how sharp you need the document to look.',
      'When your site points at a pdfpilot API with qpdf (and Ghostscript for Medium/High), compression runs there for real stream downsampling. If the API is missing, pdfpilot falls back to an in-browser pdf-lib rewrite — sizes may barely change.',
    ],
    steps: [
      'Open Compress PDF and add one or more PDFs.',
      'Choose a compression level if the tool offers presets (lighter change vs. smaller output).',
      'Start compression and watch the progress indicator.',
      'Compare original and new sizes in the list when sizes are shown.',
      'Download each compressed PDF or grab a batch ZIP if provided.',
      'Spot-check important pages before you delete the originals.',
    ],
    benefits: [
      {
        title: 'Fits upload caps',
        body: 'Shrink PDFs for portals, HR systems, and email attachments that enforce limits.',
      },
      {
        title: 'Faster syncing',
        body: 'Smaller files move quicker to Drive, Dropbox, or your LMS.',
      },
      {
        title: 'More phone storage',
        body: 'Lighten travel folders without deleting photos.',
      },
      {
        title: 'Flexible deployment',
        body: 'Strongest shrink when your API runs qpdf/Ghostscript; pdf-lib fallback keeps the tool usable on static hosting.',
      },
    ],
    highlights: [
      {
        title: 'Level choices',
        body: 'Tune how aggressive compression should be.',
      },
      {
        title: 'Batch-friendly',
        body: 'Handle more than one PDF when you are cleaning a folder.',
      },
      {
        title: 'Size feedback',
        body: 'See how much you saved at a glance.',
      },
    ],
  },

  'pdf-to-jpg': {
    featureName: 'PDF to JPG',
    intro: [
      'Turn each PDF page into JPG images for slides, social posts, or tools that prefer pictures over documents. Export happens in your browser, so your deck is not uploaded to a random converter.',
      'PDF to JPG online is perfect when a teammate can open images everywhere but struggles with PDF viewers on mobile.',
    ],
    steps: [
      'Open PDF to JPG and upload your PDF.',
      'If offered, pick image quality or scale (higher looks sharper but creates larger files).',
      'Start conversion and wait until processing completes.',
      'Download a ZIP of page images or individual JPGs.',
      'Unzip on your computer and drop images into your presentation or site.',
      'Keep the original PDF if you still need selectable text later.',
    ],
    benefits: [
      {
        title: 'Slides and design apps',
        body: 'Drop page images into PowerPoint, Canva, or a CMS without re-exporting from InDesign.',
      },
      {
        title: 'Easy previews',
        body: 'Share JPGs when someone cannot open PDFs on their phone.',
      },
      {
        title: 'Page-level control',
        body: 'Export every page once instead of screenshotting each screen.',
      },
      {
        title: 'Local conversion',
        body: 'Convert PDF to JPG in the browser when privacy matters.',
      },
    ],
    highlights: [
      {
        title: 'Whole-document export',
        body: 'All pages in one run.',
      },
      {
        title: 'Adjustable quality',
        body: 'Balance sharpness against file size when options exist.',
      },
      {
        title: 'ZIP download',
        body: 'Keeps many images organized.',
      },
    ],
  },

  'jpg-to-pdf': {
    featureName: 'JPG to PDF',
    intro: [
      'Combine JPG or PNG images into one polished PDF—great for applications, receipts, or photo sets. Build the story in the right order, then download a single file.',
      'JPG to PDF online runs in your browser so your scans and photos are not sent through an extra cloud you do not control.',
    ],
    steps: [
      'Open JPG to PDF from the toolkit.',
      'Upload every image you want in the final document.',
      'Drag thumbnails until the sequence matches how readers should scroll.',
      'Remove any wrong shot from the list.',
      'Create the PDF and wait briefly.',
      'Download the combined PDF and upload or email it wherever forms ask for one file.',
    ],
    benefits: [
      {
        title: 'One clean attachment',
        body: 'Submit a single merge PDF online instead of ten separate photos.',
      },
      {
        title: 'Consistent viewing',
        body: 'Reviewers open the same PDF on phone, tablet, or desktop.',
      },
      {
        title: 'Scan cleanup',
        body: 'Turn a burst of phone pictures into one professional document.',
      },
      {
        title: 'Browser workflow',
        body: 'Skip installing yet another “print to PDF” utility.',
      },
    ],
    highlights: [
      {
        title: 'Drag to reorder',
        body: 'Fix the page order before you export.',
      },
      {
        title: 'Multi-image input',
        body: 'Build longer PDFs from many shots.',
      },
      {
        title: 'Quick download',
        body: 'One file, ready to send.',
      },
    ],
  },

  'sign-pdf': {
    featureName: 'Sign PDF',
    intro: [
      'Sign PDF documents by placing your signature on the right page, then download a normal PDF others can open anywhere. Draw or paste a signature and position it precisely on lines or boxes.',
      'Signing happens in your browser on pdfpilot, which keeps routine agreements off random “free sign” sites when you want a simpler, more private flow.',
    ],
    steps: [
      'Open Sign PDF and upload the file you need signed.',
      'Create your signature using the options the tool provides (draw, type, or upload).',
      'Place the signature on the page; copy or move it if initials appear in several spots.',
      'Zoom and scroll until alignment looks correct.',
      'Export or download the signed PDF.',
      'Store the signed copy securely and share only that version with counterparties.',
    ],
    benefits: [
      {
        title: 'Faster than print-sign-scan',
        body: 'Close simple deals without hunting for a scanner.',
      },
      {
        title: 'Accurate placement',
        body: 'Line up with signature fields so forms look intentional.',
      },
      {
        title: 'Reusable mark',
        body: 'Use the same signature across multiple pages in one session.',
      },
      {
        title: 'Standard PDF output',
        body: 'Recipients open the file in any PDF reader.',
      },
    ],
    highlights: [
      {
        title: 'Flexible signature input',
        body: 'Draw fresh or reuse an image you already trust.',
      },
      {
        title: 'Multi-page support',
        body: 'Initial every page that your policy requires.',
      },
      {
        title: 'Simple flow',
        body: 'Upload, place, download—no mystery steps.',
      },
    ],
  },

  'unlock-pdf': {
    featureName: 'Unlock PDF',
    intro: [
      'Remove an open password from a PDF when you know the password and are allowed to keep an unlocked copy. This helps teams stop retyping the same password for internal references they already own.',
      'Unlock PDF uses your configured pdfpilot API (with qpdf on the server) when available—your file and password go to that endpoint, not to a public converter. Only unlock documents you have permission to change.',
    ],
    steps: [
      'Open Unlock PDF and upload the protected file.',
      'Type the correct document password.',
      'Start unlock and wait for the server to return an unlocked PDF.',
      'Download the new file and verify it opens without the old password.',
      'Store it according to your security policy and delete older copies if rules allow.',
      'If the tool warns that the API is missing, configure your deployment before trying again in production.',
    ],
    benefits: [
      {
        title: 'Stop retyping passwords',
        body: 'Useful for personal archives you are authorized to keep open.',
      },
      {
        title: 'Team efficiency',
        body: 'Share an unlocked internal copy only when policy says that is OK.',
      },
      {
        title: 'Controlled endpoint',
        body: 'Works through your app’s API instead of a random upload site.',
      },
      {
        title: 'Compliance-minded',
        body: 'Never unlock PDFs you do not own or are not permitted to alter.',
      },
    ],
    highlights: [
      {
        title: 'Password-aware flow',
        body: 'Built for legitimate access you already have.',
      },
      {
        title: 'Straightforward steps',
        body: 'Upload, enter password, download result.',
      },
      {
        title: 'Deployment-ready',
        body: 'Wire your backend so unlock works where you host pdfpilot.',
      },
    ],
  },

  'encrypt-pdf': {
    featureName: 'Encrypt PDF',
    intro: [
      'Add an open password to a PDF with AES-256 so only people who know the password can open it. pdfpilot encrypts the file on your API server with qpdf—the same stack many teams already use for Unlock PDF.',
      'Use a strong, unique password and store it in a password manager. Encrypted PDFs are still only as safe as the password you choose and how you share it.',
    ],
    steps: [
      'Open Encrypt PDF and upload an unencrypted PDF (or unlock first if it already has a password).',
      'Create a strong password (12+ characters with mixed case, numbers, and symbols is ideal).',
      'Confirm the password so typos do not lock you out of your own file.',
      'Start encryption and download the protected PDF over HTTPS.',
      'Open the download in a PDF reader to verify it asks for the password before showing pages.',
    ],
    benefits: [
      {
        title: 'AES-256',
        body: 'Industry-standard encryption applied by qpdf when your backend has it installed.',
      },
      {
        title: 'HTTPS in transit',
        body: 'Upload and download happen over your configured API—avoid public “free converter” sites for sensitive documents.',
      },
      {
        title: 'Pairs with Unlock',
        body: 'Remove an old password with Unlock PDF, then apply a new one here when you rotate access.',
      },
      {
        title: 'Clear workflow',
        body: 'Upload, set password, confirm, download—no extra installers.',
      },
    ],
    highlights: [
      {
        title: 'Password-gated files',
        body: 'Recipients need the password you set before the document opens normally.',
      },
      {
        title: 'Server-side qpdf',
        body: 'Matches the deployment story you already use for unlocking PDFs.',
      },
      {
        title: 'Built for real policies',
        body: 'Use alongside your org’s rules on sharing, retention, and key storage.',
      },
    ],
  },

  'organize-pdf': {
    featureName: 'Organize PDF Pages',
    intro: [
      'Organize PDF pages visually: reorder with drag-and-drop or arrows, rotate mis-scanned sheets, and delete extras—then download a clean PDF. The whole workflow runs in your browser, so page thumbnails and your final file stay on your device.',
      'Whether you are fixing a merged report or trimming a long download, you see every page before you commit, which cuts mistakes before you share.',
    ],
    steps: [
      'Open Organize Pages and upload your PDF.',
      'Wait for thumbnails to appear; zoom the grid if you want to see more pages at once.',
      'Drag a page onto another to change order, or use the up and down arrows on each card.',
      'Use rotate controls for crooked scans and delete for pages you do not need.',
      'Optionally select multiple pages to remove several at once, or reset to start over.',
      'Click apply and download your reorganized PDF.',
    ],
    benefits: [
      {
        title: 'See before you ship',
        body: 'Thumbnails make wrong order or upside-down pages obvious.',
      },
      {
        title: 'No re-merge hassle',
        body: 'Fix order after combining PDFs without rebuilding from source files.',
      },
      {
        title: 'Browser-based privacy',
        body: 'Reorder and rotate locally instead of uploading to unknown tools.',
      },
      {
        title: 'Fine control',
        body: 'Mix single-page fixes with bulk deletes when a document is half noise.',
      },
    ],
    highlights: [
      {
        title: 'Drag, arrows, zoom',
        body: 'Reorder comfortably on large sets of pages.',
      },
      {
        title: 'Per-page rotation',
        body: 'Straighten only the scans that need it.',
      },
      {
        title: 'Instant download',
        body: 'Export the new page order in one click.',
      },
    ],
  },

  'add-watermark': {
    featureName: 'Add Watermark',
    intro: [
      'Add a text or image watermark across your PDF—set opacity, rotation, position, and which pages receive it, then preview on page one before you download. Processing uses pdf-lib in your browser, so your file is not sent to a separate watermarking service.',
      'Use it for DRAFT labels, confidential banners, or logo stamps while keeping the original structure of the PDF.',
    ],
    steps: [
      'Open Add Watermark and upload your PDF.',
      'Choose text or image watermark and adjust size, color, opacity, and rotation.',
      'Pick a position such as center, a corner, or tiled repeat.',
      'Select all pages or enter page ranges like 1-3, 5.',
      'Check the live preview on page one.',
      'Apply and download your watermarked PDF.',
    ],
    benefits: [
      {
        title: 'Clear document status',
        body: 'Mark drafts and internal copies before they leave your team.',
      },
      {
        title: 'Flexible placement',
        body: 'Center a subtle logo or tile text across large reports.',
      },
      {
        title: 'Targeted pages',
        body: 'Watermark only the sections that need a label.',
      },
      {
        title: 'Local processing',
        body: 'Keep confidential PDFs in a browser-first workflow.',
      },
    ],
    highlights: [
      {
        title: 'Text and image modes',
        body: 'Switch between typed watermarks and your logo file.',
      },
      {
        title: 'Live preview',
        body: 'See page one update as you tweak settings.',
      },
      {
        title: 'Range-aware apply',
        body: 'Cover the whole file or just the pages you list.',
      },
    ],
  },

  'add-page-numbers': {
    featureName: 'Add page numbers',
    intro: [
      'Add page numbers to any PDF with clear placement controls — choose a grid position for single-page layouts or facing spreads with outer-margin alternation, then pick formats like plain numbers or Page N of M.',
      'Processing runs in your browser with pdf-lib: upload the file, set margin and typography, and download a numbered copy without sending the PDF through a separate numbering service.',
    ],
    steps: [
      'Open Add page numbers from the toolkit and upload your PDF.',
      'Choose Single page or Facing pages (book-style outer left/right alternation).',
      'Tap the position grid to pick the vertical band and, in single mode, the horizontal alignment.',
      'Choose margin preset, which pages to number, and the first displayed number.',
      'Pick a text format and adjust font size, color, and bold if needed.',
      'Click Add page numbers and save the downloaded PDF.',
    ],
    benefits: [
      {
        title: 'Readable navigation',
        body: 'Give reviewers consistent folios instead of guessing page order from thumbnails.',
      },
      {
        title: 'Spread-aware option',
        body: 'Facing mode mirrors common print layouts with outer-edge numbering.',
      },
      {
        title: 'Flexible ranges',
        body: 'Number the whole document or only the ranges you specify.',
      },
      {
        title: 'Local-first workflow',
        body: 'Stamp numbers locally when you want drafts to stay in the browser.',
      },
    ],
    highlights: [
      {
        title: 'Grid placement',
        body: 'Nine-cell layout for corners, edges, and center positions.',
      },
      {
        title: 'Format presets',
        body: 'Plain numbers, Page N, or Page N of M across the file.',
      },
      {
        title: 'Helvetica typography',
        body: 'Standard fonts for reliable rendering on every viewer.',
      },
    ],
  },

  'scan-to-pdf': {
    featureName: 'Scan to PDF',
    intro: [
      'Turn phone or laptop camera shots into a clean multi-page PDF. pdfpilot runs in your browser: you grant camera access only for this tab, capture each page, reorder or retake, then download one file.',
      'If you cannot use the camera (permission denied or desktop without a webcam), upload existing photos instead — the same trim and contrast tools apply before the PDF is built.',
    ],
    steps: [
      'Open Scan to PDF from the toolkit.',
      'Choose whether to auto-trim bright margins and enhance contrast (defaults are on for typical paper scans).',
      'Tap Scan document and allow the camera, or use Upload photos for gallery files.',
      'Capture each page while the live preview is steady; add as many pages as you need.',
      'Use Done to review thumbnails, drag to reorder, retake a bad page, or remove extras.',
      'Download PDF when the order looks right.',
    ],
    benefits: [
      {
        title: 'No scanner hardware required',
        body: 'Use the camera you already carry for receipts, forms, and whiteboard notes.',
      },
      {
        title: 'Graceful fallbacks',
        body: 'Blocked camera or missing hardware is not a dead end — upload images and continue.',
      },
      {
        title: 'Readable exports',
        body: 'Optional contrast stretch and margin trimming help text pop before pages become PDF.',
      },
      {
        title: 'Private by design',
        body: 'Frames are processed locally in the browser; only the final PDF leaves your device when you save it.',
      },
    ],
    highlights: [
      {
        title: 'Multi-page capture',
        body: 'Stack several shots in order for a single download.',
      },
      {
        title: 'Reorder and retake',
        body: 'Drag rows to fix sequence or open the camera again for one page.',
      },
      {
        title: 'Mobile friendly',
        body: 'Large tap targets and a vertical layout work on phones in landscape or portrait.',
      },
    ],
  },

  'pdf-to-word': {
    featureName: 'PDF to Word',
    intro: [
      'Convert PDF to Word in your browser when you need an editable .docx from a text-based PDF. pdf.js reads the file in your tab and pdfpilot builds a draft Word document locally — your PDF is not uploaded for conversion.',
      'Output is best-effort draft text and paragraphs; complex layouts, tables, and fonts may simplify. Scanned PDFs need OCR first — use pdfpilot’s OCR PDF tool, then try again.',
    ],
    steps: [
      'Open PDF to Word from the toolkit.',
      'Upload a PDF (drag-and-drop or browse).',
      'Wait while your browser extracts text and builds the .docx.',
      'Download the Word file when prompted (sign in first if your site requires accounts for downloads).',
      'Open the .docx locally and adjust formatting as needed.',
    ],
    benefits: [
      {
        title: 'Editable output',
        body: 'Receive a .docx you can revise instead of retyping from a flat PDF.',
      },
      {
        title: 'Conversion stays on your device',
        body: 'No server upload for PDF→Word conversion — ideal when you want drafts without sending the PDF to a converter API.',
      },
      {
        title: 'Pairs with OCR PDF',
        body: 'Run OCR on scanned documents first so extractable text exists before Word conversion.',
      },
      {
        title: 'Straightforward limits',
        body: 'Large PDFs are capped for browser stability; split very large files if needed.',
      },
    ],
    highlights: [
      {
        title: 'Simple upload flow',
        body: 'One PDF in, one .docx out after local processing.',
      },
      {
        title: 'Browser-side extraction',
        body: 'Uses PDF.js in your tab — keep the page open until the download starts.',
      },
      {
        title: 'Proof before publishing',
        body: 'Draft conversion may shift layout; always review before final use.',
      },
    ],
  },

  'word-to-pdf': {
    featureName: 'Word to PDF',
    intro: [
      'Turn a Microsoft Word .docx into a PDF for sharing, printing, or archiving. Upload your document and download a PDF when conversion finishes.',
      'Layout-faithful .docx → .pdf uses your configured pdfpilot API (LibreOffice on the server and/or a separate Gotenberg service), not this static page alone. pdfpilot does not ship an in-browser engine that matches full Word layout.',
    ],
    steps: [
      'Open Word to PDF from the toolkit.',
      'Confirm your deployment sets SOFFICE_PATH and/or GOTENBERG_URL on the API so conversion is enabled.',
      'Upload a .docx (drag-and-drop or browse).',
      'Wait while the API converts the file to PDF.',
      'Download the PDF when prompted (sign in first if your site requires accounts for downloads).',
      'Open the PDF locally and spot-check fonts, tables, and page breaks.',
    ],
    benefits: [
      {
        title: 'Consistent with Word export',
        body: 'Uses the same document-flow stack as other pdfpilot exports when the API is configured.',
      },
      {
        title: 'No random converter site',
        body: 'Files go to your API origin — pair with HTTPS and access controls you already run.',
      },
      {
        title: 'Large-document friendly',
        body: 'Typical business documents up to tens of megabytes work; keep the tab open on slow links.',
      },
      {
        title: 'Pairs with PDF to Word',
        body: 'Round-trip drafts when you need Word for heavy edits and PDF for sharing.',
      },
    ],
    highlights: [
      {
        title: 'Server-side fidelity',
        body: 'LibreOffice or Gotenberg handles complex styles better than a lightweight browser shim.',
      },
      {
        title: 'Simple upload flow',
        body: 'One .docx in, one PDF out after your API accepts the job.',
      },
      {
        title: 'Operator-controlled',
        body: 'Self-hosters enable conversion with environment variables they already document for PDF → Word.',
      },
    ],
  },

  'gst-invoice': {
    featureName: 'GST invoice PDF',
    intro: [
      'Create a simple GST-style tax invoice as a downloadable PDF directly in your browser. Fill supplier and buyer details, line items with HSN and GST%, and pdfpilot totals taxable value plus CGST/SGST (intra-state) or IGST (inter-state) from the two-digit state codes you enter.',
      'This tool is for drafts and internal paperwork — always confirm format, e-invoicing, and return filing with a qualified chartered accountant before you rely on it for compliance.',
    ],
    steps: [
      'Open GST invoice PDF from the toolkit.',
      'Enter seller and buyer legal names, addresses, GSTINs, and two-digit state codes (e.g. 27 for Maharashtra).',
      'Set invoice number, invoice date, and place of supply.',
      'Add one or more line items: description, HSN/SAC, quantity, taxable rate per unit (before GST), and GST %.',
      'Click Generate PDF — totals update from your lines and state codes.',
      'Download the PDF and store or share it like any other document.',
    ],
    benefits: [
      {
        title: 'No server upload for the form',
        body: 'Invoice data is turned into a PDF locally in the browser on pdfpilot.',
      },
      {
        title: 'Clear split of taxes',
        body: 'CGST/SGST vs IGST follows whether supplier and buyer state codes match.',
      },
      {
        title: 'Editable line table',
        body: 'Add or remove rows for multiple goods or services on one invoice.',
      },
      {
        title: 'Fast for small businesses',
        body: 'Useful when you already know the numbers and just need a clean PDF attachment.',
      },
    ],
    highlights: [
      {
        title: 'HSN and GST% per line',
        body: 'Each row carries its own rate slab for taxable value and tax math.',
      },
      {
        title: 'Reverse charge flag',
        body: 'Mark when supply is under reverse charge for your records.',
      },
      {
        title: 'Disclaimer built in',
        body: 'The PDF reminds readers that professional verification is still required.',
      },
    ],
  },
  'ocr-pdf': {
    featureName: 'OCR PDF',
    intro: [
      'Scanned PDFs are often pictures of pages. OCR (optical character recognition) adds a searchable text layer so you can find words, copy passages, and get better results in editors that rely on real text.',
      'pdfpilot runs OCR on the server with open-source tools (ocrmypdf and Tesseract). You download a new PDF; keep the original if you still need the untouched scan.',
    ],
    steps: [
      'Open OCR PDF from the toolkit.',
      'Upload a PDF (camera scans, exported copies, or mixed documents).',
      'Click Run OCR and download — large files can take a few minutes.',
      'Open the downloaded file in Edit PDF if you want to change wording, or use it anywhere you need selectable text.',
    ],
    benefits: [
      {
        title: 'Better search and copy',
        body: 'Searchable text makes long documents easier to navigate than image-only pages.',
      },
      {
        title: 'Honest limits',
        body: 'Very long files are processed in chunks on the server so the service stays reliable for everyone.',
      },
      {
        title: 'Unlock first when locked',
        body: 'Password-protected PDFs should be decrypted with Unlock PDF before OCR.',
      },
    ],
    highlights: [
      {
        title: 'Server-side quality',
        body: 'The production Docker image includes Tesseract language data for common English and Hindi text.',
      },
      {
        title: 'Skip pages that already have text',
        body: 'Pages that already contain extractable text are passed through efficiently when possible.',
      },
      {
        title: 'Download and continue',
        body: 'You always get a file you can store, email, or open again in pdfpilot.',
      },
    ],
  },
}
