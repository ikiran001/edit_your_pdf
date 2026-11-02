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
 * @property {{ q: string, a: string }[]} [faqs] — optional FAQ (renders + emits FAQPage JSON-LD)
 */

/** @type {Record<string, ToolSeoEntry>} */
export const TOOL_SEO_BY_ID = {
  'edit-pdf': {
    featureName: 'Edit PDF',
    faqs: [
      {
        q: 'Can I edit text in a PDF for free?',
        a: 'Yes. Edit PDF is free — fix text where supported, highlight lines, and add annotations in your browser, then download the updated PDF. Signed-out users get a few downloads per day; a Pro plan removes the cap.',
      },
      {
        q: 'Is my PDF uploaded to a server when I edit it?',
        a: 'Editing runs in a focused session in your browser on pdfpilot, so you can avoid passing drafts through random file-sharing sites. Download the updated file when you are done and keep the original as a backup.',
      },
      {
        q: 'Why can’t I edit some of the text in my PDF?',
        a: 'Text editing works best on PDFs that contain real, selectable text. Scanned or image-only PDFs have no editable text layer — run the OCR PDF tool first to add one, then edit.',
      },
      {
        q: 'Can I edit a PDF on my phone?',
        a: 'Yes — Edit PDF runs in your mobile browser with no app install. A larger screen makes precise placement easier, but basic text fixes and highlights work fine on mobile.',
      },
    ],
    intro: [
      'Edit a PDF online to fix wording, highlight key lines, add notes, and mark up pages — with no desktop software to install and no account to create. Uploading opens a focused editing session so you can work through the whole document in one place and download the result when you are done.',
      'Text editing works best on PDFs that already contain real, selectable text; scanned or image-only pages have no text layer to change, so run OCR first and then come back. Keep a copy of the original in case you need the untouched version later.',
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
    faqs: [
      {
        q: 'How do I merge multiple PDFs into one file?',
        a: 'Open Merge PDF, upload all your files, drag them into the order you want, and click merge. You get one combined PDF to download.',
      },
      {
        q: 'Is merging PDFs free, and are my files uploaded?',
        a: 'Yes, it is free — and merging runs entirely in your browser, so your PDFs are combined locally and not sent to a server. That keeps sensitive annexes private.',
      },
      {
        q: 'Can I reorder files before merging?',
        a: 'Yes. Drag the files in the list until the sequence matches how readers should see them, and remove any file you added by mistake before you merge.',
      },
      {
        q: 'Is there a limit on how many PDFs I can merge?',
        a: 'You can stack several PDFs in one run. Because combining happens in the browser, very large sets may be slower on low-memory phones or tablets.',
      },
    ],
    intro: [
      'Merge several PDFs into one document for easier sharing, printing, and archiving. Add appendices, exhibits, certificates, or scans and arrange them in the exact order readers should see them — then download a single, tidy file.',
      'Merging runs entirely in your browser, so your files are combined locally on your own device and never uploaded to a third-party server just to be stitched together. That keeps sensitive annexes and personal documents private.',
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
    faqs: [
      {
        q: 'How do I split a PDF into separate files?',
        a: 'Open Split PDF, upload your document, and choose split by page ranges (e.g. 1-5, 8) or extract every page into its own PDF. Download a ZIP or individual files.',
      },
      {
        q: 'Can I extract just a few pages from a PDF?',
        a: 'Yes. Use range mode and enter the pages you need (like 3-7) to pull out only those pages — handy for sharing one section while keeping the rest private.',
      },
      {
        q: 'Is splitting done in my browser?',
        a: 'Yes — processing stays in your browser on pdfpilot, so you can split a contract locally instead of uploading it to an unknown website.',
      },
      {
        q: 'Is Split PDF free?',
        a: 'Yes. Splitting is free; signed-out users can download a few files per day and a Pro plan removes the daily cap.',
      },
    ],
    intro: [
      'Split a PDF into separate files by custom page ranges, or break it into one file per page. It is the clean way to pull out chapters, invoices, or signed sections — far better than screenshotting pages, which loses quality and makes the text unselectable.',
      'Everything happens in your browser, so you can extract pages locally instead of uploading a full contract to an unknown website, and every page you keep retains its original quality.',
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
      'Compress a PDF to shrink it for email limits, upload caps, cloud storage, and phones. Choose a level that balances a smaller file against how sharp the document needs to look — especially useful for the strict 100KB to 500KB limits on many government portals.',
      'When connected to a pdfpilot API (qpdf, plus Ghostscript for the Medium and High levels), compression downsamples images and streams for real size reductions. Without that API it falls back to a lighter in-browser rewrite, where the size may change only a little.',
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
    faqs: [
      {
        q: 'How do I compress a PDF to 100KB for an Aadhaar or government upload?',
        a: 'Open Compress PDF, add your file, and choose a stronger level (Medium or High). Many Indian portals — UIDAI, SSC, UPSC, and state sites — cap PDF uploads at 100–200KB. Compress, check the new size shown in the list, and re-run at a higher level if it is still above the limit. The strongest shrink needs the pdfpilot API (qpdf + Ghostscript).',
      },
      {
        q: 'What are the common file-size limits for Indian government forms?',
        a: 'Limits vary by portal, but PDFs are often capped at 100KB, 200KB, or 500KB, while photos and signatures are usually 20KB–50KB. Compress to just under the stated limit and keep the original in case you later need a sharper copy.',
      },
      {
        q: 'Will compressing reduce the quality of my scanned documents?',
        a: 'Light compression keeps text crisp; stronger levels downsample images, which can soften scans. For Aadhaar, PAN, or mark-sheet uploads that only need to be legible, Medium or High is usually fine — always spot-check readability before you submit.',
      },
      {
        q: 'Is it free to compress PDF files on pdfpilot?',
        a: 'Yes. Compressing PDFs is free. Signed-out users can download a few files per day; a Pro plan removes the daily cap for unlimited downloads.',
      },
    ],
  },

  'pdf-to-jpg': {
    featureName: 'PDF to JPG',
    faqs: [
      {
        q: 'How do I convert a PDF to JPG images?',
        a: 'Open PDF to JPG, upload your PDF, optionally pick quality or scale, and convert. Each page becomes a JPG — download them as a ZIP or individually.',
      },
      {
        q: 'Can I choose the image quality?',
        a: 'If offered, pick quality or scale — higher looks sharper but makes larger files. Choose higher for printing and lower for web or chat sharing.',
      },
      {
        q: 'Are my files uploaded when converting PDF to JPG?',
        a: 'No — export happens in your browser, so your document is not sent to a third-party converter.',
      },
      {
        q: 'Will the JPG images have selectable text?',
        a: 'No. JPGs are images, so the text is no longer selectable. Keep the original PDF, or use OCR PDF, if you still need searchable text later.',
      },
    ],
    intro: [
      'Turn each page of a PDF into a JPG image — ideal for slides, social posts, thumbnails, or any tool that prefers pictures over documents. You get one image per page, ready to drop in wherever you need it.',
      'The export runs in your browser, so your document is not sent to a random converter. JPG is the right pick when a recipient can open images everywhere but struggles with PDF viewers on mobile.',
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
    faqs: [
      {
        q: 'How do I combine JPG images into one PDF?',
        a: 'Open JPG to PDF, upload your images, drag the thumbnails into order, and create the PDF — you get one file to download.',
      },
      {
        q: 'Can I add multiple photos to a single PDF?',
        a: 'Yes. Add as many images as you need and reorder them before creating the PDF — great for applications, receipts, or photo sets.',
      },
      {
        q: 'Does it support PNG as well as JPG?',
        a: 'Yes — both JPG and PNG images can be combined into one PDF.',
      },
      {
        q: 'Are my photos uploaded to a server?',
        a: 'No — JPG to PDF runs in your browser, so your scans and photos are not sent through a cloud you do not control.',
      },
    ],
    intro: [
      'Combine JPG or PNG images into one polished PDF — perfect for applications, receipts, ID proofs, or photo sets. Arrange the pictures in the right order and export a single file that looks far more professional than loose images.',
      'Conversion runs in your browser, so your scans and photos are not sent through a cloud you do not control. If the finished PDF is too large to upload, compress it afterwards to fit the limit.',
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
    faqs: [
      {
        q: 'How do I sign a PDF online?',
        a: 'Open Sign PDF, upload your file, create a signature by drawing, typing, or uploading an image, place it on the right spot, and download the signed PDF.',
      },
      {
        q: 'Is this a legally valid e-signature?',
        a: 'It places an electronic signature image on the page, which is fine for routine agreements. It is not a certified digital signature (DSC with a certificate); for filings that legally mandate a DSC, use a certified provider.',
      },
      {
        q: 'Are my documents uploaded when I sign?',
        a: 'Signing happens in your browser on pdfpilot, which keeps routine agreements off random “free sign” sites for a simpler, more private flow.',
      },
      {
        q: 'Can I place my signature in more than one spot?',
        a: 'Yes. Copy or move the signature so initials or signatures appear wherever the document needs them, then export the signed PDF once.',
      },
    ],
    intro: [
      'Sign a PDF by placing your signature exactly where it belongs, then download a normal PDF anyone can open. Draw your signature, type it, or upload a PNG, and position it precisely on the signature line or box — no printing or scanning involved.',
      'Signing happens in your browser, which keeps routine agreements off random "free sign" sites when you want a simpler, more private flow. Keep the unsigned original in case you need to produce a fresh copy.',
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

  'e-sign-pdf': {
    featureName: 'E-Sign PDF',
    faqs: [
      {
        q: 'How do I e-sign a PDF?',
        a: 'Open E-Sign PDF, upload your file, add your signature, drag it onto the right line or box on each page, and download a standard PDF.',
      },
      {
        q: 'Is an electronic signature legally valid?',
        a: 'An electronic signature is accepted for many routine agreements, HR forms, and approvals. It is not a certificate-based digital signature (DSC); for filings that legally require a DSC, use a certified provider.',
      },
      {
        q: 'Are my documents uploaded when I e-sign?',
        a: 'Processing stays in your browser session on pdfpilot, so you get a simple electronic signature without uploading to unknown third-party sites.',
      },
      {
        q: 'What is the difference between E-Sign PDF and Sign PDF?',
        a: 'Both place an electronic signature in your browser; E-Sign focuses on quickly dropping your signature onto form lines and boxes for agreements and approvals. Neither is a certificate-based DSC.',
      },
    ],
    intro: [
      'Add an electronic signature to a PDF: create your signature, drag it onto the right line or box on each page, and download a standard signed PDF. It is built for agreements, HR forms, offer letters, and quick approvals that do not need a certificate-based digital signature.',
      'Processing stays in your session, so you get a simple electronic signature without uploading the document to unknown third-party sites.',
    ],
    steps: [
      'Open E-Sign PDF and upload the document.',
      'Create your signature (draw, type, or upload an image).',
      'Place it on the page; use Duplicate or copy/paste if initials appear in several spots.',
      'Adjust zoom and scroll until alignment looks correct.',
      'Apply and download the signed PDF.',
      'Keep the signed copy for your records and share only that file with others.',
    ],
    benefits: [
      {
        title: 'No print–sign–scan loop',
        body: 'Finish routine signatures on screen.',
      },
      {
        title: 'Precise placement',
        body: 'Line up with signature fields so forms look professional.',
      },
      {
        title: 'Reusable mark',
        body: 'Use the same signature on multiple pages in one session.',
      },
      {
        title: 'Normal PDF output',
        body: 'Opens in any PDF reader — same engine as Sign PDF.',
      },
    ],
    highlights: [
      {
        title: 'Flexible input',
        body: 'Draw fresh or reuse a PNG you already trust.',
      },
      {
        title: 'Multi-page',
        body: 'Initial every page your policy requires.',
      },
      {
        title: 'Straightforward flow',
        body: 'Upload, place, download.',
      },
    ],
  },

  'unlock-pdf': {
    featureName: 'Unlock PDF',
    faqs: [
      {
        q: 'How do I remove a password from a PDF?',
        a: 'Open Unlock PDF, upload the protected file, type the correct password, and download an unlocked copy. You must know the password.',
      },
      {
        q: 'Can I unlock a PDF without knowing the password?',
        a: 'No. Unlock PDF only removes an open password you already know, for documents you have permission to change — it is not a password-recovery or cracking tool.',
      },
      {
        q: 'Where is my file processed when unlocking?',
        a: 'Unlock uses your pdfpilot API with qpdf on the server, so the file and password go to that endpoint rather than to a public converter.',
      },
      {
        q: 'Is it safe to unlock bank statements or Aadhaar PDFs?',
        a: 'Only unlock documents you own and are allowed to change. Store the unlocked copy per your security policy and delete older copies if your rules allow.',
      },
    ],
    intro: [
      'Remove the open password from a PDF when you know the password and are entitled to keep an unlocked copy. It saves your team from retyping the same password over and over for internal references you already own.',
      'Unlocking uses your configured pdfpilot API (with qpdf on the server) when available, so your file and password go to that endpoint rather than a public converter. Only unlock documents you have permission to change.',
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
    faqs: [
      {
        q: 'How do I password-protect a PDF?',
        a: 'Open Encrypt PDF, upload your file, set a strong password, and download an AES-256 encrypted PDF that only opens with that password.',
      },
      {
        q: 'What encryption does it use?',
        a: 'AES-256, applied on your pdfpilot API server with qpdf. The file is only as safe as the password you choose and how you share it.',
      },
      {
        q: 'Can I recover the file if I forget the password?',
        a: 'No — there is no backdoor. Store the password in a password manager. If you lose it, you would need the original unencrypted copy.',
      },
      {
        q: 'Is it safe for sensitive documents like bank statements?',
        a: 'AES-256 is strong, but security also depends on using a unique password and sharing it over a separate channel from the file itself.',
      },
    ],
    intro: [
      'Add an open password to a PDF with strong AES-256 encryption, so only people who know the password can open it. It is the simplest way to protect salary slips, bank statements, contracts, and ID scans before you send them.',
      'Encryption runs on your pdfpilot API server with qpdf. Remember that an encrypted PDF is only as safe as the password you choose — use a long, unique one, and share it through a different channel than the file itself.',
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
    faqs: [
      {
        q: 'How do I reorder pages in a PDF?',
        a: 'Open Organize PDF, upload your file, drag page thumbnails (or use the arrows) into the order you want, then download the reorganized PDF.',
      },
      {
        q: 'Can I rotate or delete pages too?',
        a: 'Yes. Rotate mis-scanned sheets and delete extra pages, then download a clean PDF — all in one place.',
      },
      {
        q: 'Does organizing run in my browser?',
        a: 'Yes — the whole workflow runs in your browser, so page thumbnails and your final file stay on your device.',
      },
      {
        q: 'Will I see the pages before saving?',
        a: 'Yes — you see every page as a thumbnail before you commit, which cuts mistakes before you share.',
      },
    ],
    intro: [
      'Organize a PDF visually: drag pages into a new order, rotate sheets that scanned sideways, and delete the ones you do not need — then download one clean file. You see every page as a thumbnail before you commit to any change.',
      'The whole workflow runs in your browser, so the page thumbnails and your final file stay on your device. Seeing the pages before you save cuts mistakes before you share.',
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
    faqs: [
      {
        q: 'How do I add a watermark to a PDF?',
        a: 'Open Add Watermark, upload your file, add a text or image watermark, set opacity, rotation, position, and which pages get it, preview page one, and download.',
      },
      {
        q: 'Can I use an image or logo as the watermark?',
        a: 'Yes — add a text label (like DRAFT or CONFIDENTIAL) or an image/logo stamp across your pages.',
      },
      {
        q: 'Can I watermark only some pages?',
        a: 'Yes. You choose which pages receive the watermark before downloading.',
      },
      {
        q: 'Are my files uploaded?',
        a: 'No — watermarking runs in your browser, so your file is not sent to a separate watermarking service.',
      },
    ],
    intro: [
      'Stamp a text or image watermark across a PDF — set the opacity, rotation, position, and which pages receive it, then preview page one before you download. Use it for DRAFT labels, confidential banners, copyright notices, or a logo on proposals and quotes.',
      'Watermarking runs in your browser, so your file is not sent to a separate service, and the original structure of the PDF is preserved.',
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
    faqs: [
      {
        q: 'How do I add page numbers to a PDF?',
        a: 'Open Add page numbers, upload your PDF, choose a position and format, set margins and typography, then download a numbered copy.',
      },
      {
        q: 'Can I use the "Page N of M" format?',
        a: 'Yes — pick plain numbers or the Page N of M format to suit reports, contracts, or booklets.',
      },
      {
        q: 'Can I number facing pages or spreads?',
        a: 'Yes. Choose a single-page grid position, or facing spreads with outer-margin alternation for booklet-style layouts.',
      },
      {
        q: 'Does it upload my file?',
        a: 'No — numbering runs in your browser, so the PDF is not sent through a separate service.',
      },
    ],
    intro: [
      'Add page numbers to any PDF with precise placement — pick a position on the page, alternate the outer margin for facing spreads, and choose a format such as a plain number or "Page N of M". It is the quick way to make reports, contracts, and handouts easy to reference.',
      'Numbering runs in your browser: upload the file, set the margin and typography, and download a numbered copy without sending the PDF through a separate service.',
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
    faqs: [
      {
        q: 'How do I scan documents to PDF with my phone?',
        a: 'Open Scan to PDF, grant camera access for the tab, capture each page, reorder or retake as needed, and download one multi-page PDF.',
      },
      {
        q: 'What if I have no camera or deny access?',
        a: 'Upload existing photos instead — the same trim and contrast tools apply before the PDF is built.',
      },
      {
        q: 'Is my camera or scan data uploaded?',
        a: 'pdfpilot runs in your browser and uses the camera only for this tab; the PDF is built locally on your device.',
      },
      {
        q: 'Can I scan multiple pages into one file?',
        a: 'Yes — capture page after page, reorder them, then download them as a single PDF.',
      },
    ],
    intro: [
      'Turn photos from your phone or laptop camera into a clean, multi-page PDF. Grant camera access for the tab, capture each page, reorder or retake any that came out blurry, and download a single file — no scanner required.',
      'If you cannot use a camera — permission denied, or a desktop with no webcam — upload existing photos instead; the same trimming and contrast tools apply before the PDF is built. Everything happens on your device.',
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
    faqs: [
      {
        q: 'How do I convert a PDF to an editable Word file?',
        a: 'Open PDF to Word, upload a text-based PDF, and your browser extracts the text and builds a draft .docx you can download and edit.',
      },
      {
        q: 'Is the conversion exact?',
        a: 'It is a best-effort draft — text and paragraphs transfer, but complex layouts, tables, and fonts may simplify. Always review the .docx before final use.',
      },
      {
        q: 'Why is my scanned PDF converting to an empty or garbled Word file?',
        a: 'Scanned PDFs are images with no selectable text. Run OCR PDF first to add a text layer, then convert to Word.',
      },
      {
        q: 'Are my files uploaded for the conversion?',
        a: 'No — conversion runs in your browser with PDF.js, so your PDF is not uploaded to a converter API. Keep the page open until the download starts.',
      },
    ],
    intro: [
      'Convert a text-based PDF into an editable Word (.docx) document right in your browser, so you can reuse paragraphs, fix wording, or reformat without rebuilding the file from scratch.',
      'The result is a best-effort draft — complex layouts, tables, and exact fonts may simplify, so proofread before sending. A scanned PDF has no real text to extract, so run OCR first and then convert. Your PDF is not uploaded for this conversion.',
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
    faqs: [
      {
        q: 'How do I convert a Word document to PDF?',
        a: 'Open Word to PDF, upload a .docx, and your browser builds a simple, text-first PDF to download.',
      },
      {
        q: 'Will my formatting, tables, and images be preserved?',
        a: 'This is a fast draft — tables, images, headers, and exact fonts are not reproduced. For print-ready fidelity, use Word’s own “Save as PDF” or a server-based converter.',
      },
      {
        q: 'Is Word to PDF free and private?',
        a: 'Yes — it is free and runs in your browser, so your document is not uploaded to a converter service for this step.',
      },
      {
        q: 'Does it support .doc or only .docx?',
        a: 'It reads modern .docx files. Save older .doc files as .docx in Word first, then convert.',
      },
    ],
    intro: [
      'Turn a Microsoft Word .docx into a shareable PDF in your browser, so fonts and page breaks stay put on any device and the document cannot be edited by accident.',
      'This is a fast, text-first draft — not a replacement for Word\'s own "Save as PDF" or a server-based converter. Tables, images, headers, and exact fonts may not be reproduced, so use those options when you need print-ready fidelity. Your document is not uploaded for this step.',
    ],
    steps: [
      'Open Word to PDF from the toolkit.',
      'Upload a .docx (drag-and-drop or browse).',
      'Wait a few seconds while the tab extracts text and builds a PDF.',
      'Download the PDF when prompted (sign in first if your site requires accounts for downloads).',
      'Open the PDF and compare to your Word file; re-export from Word if layout must match exactly.',
    ],
    benefits: [
      {
        title: 'No upload for conversion',
        body: 'Typical text documents are processed locally in the browser for speed and privacy.',
      },
      {
        title: 'Seconds, not minutes',
        body: 'No cold-start on a remote LibreOffice or Gotenberg container — large cloud converters often sleep until first use.',
      },
      {
        title: 'Works without API wiring',
        body: 'Unlike server-only Word→PDF paths, this flow does not require SOFFICE_PATH or GOTENBERG_URL on your backend.',
      },
      {
        title: 'Pairs with PDF to Word',
        body: 'Round-trip drafts when you move between editable Word and shareable PDF.',
      },
    ],
    highlights: [
      {
        title: 'Plain-text–oriented output',
        body: 'Paragraphs and line breaks from the document body; complex OOXML is not fully modeled.',
      },
      {
        title: 'Simple upload flow',
        body: 'One .docx in — adjust expectations for draft fidelity vs Word export.',
      },
      {
        title: 'Operator-friendly hosting',
        body: 'Static hosting without document-flow env vars still gets a working Word→PDF tool.',
      },
    ],
  },

  'gst-invoice': {
    featureName: 'GST invoice PDF',
    intro: [
      'Create a GST-style tax invoice as a downloadable PDF, right in your browser. Enter supplier and buyer details plus line items with HSN and GST%, and the tool totals the taxable value and applies CGST/SGST for intra-state sales or IGST for inter-state sales, based on the two-digit state codes you enter.',
      'It is designed for drafts and internal paperwork. Always confirm the final format, e-invoicing (IRN and QR code), and return filing with a qualified chartered accountant before relying on it for compliance.',
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
    faqs: [
      {
        q: 'Is the GST invoice format generated here valid in India?',
        a: 'The tool produces a GST-style tax invoice with GSTIN, HSN/SAC codes, taxable value, and CGST/SGST or IGST splits from the state codes you enter. It is designed for drafts and internal paperwork — confirm the final format, e-invoicing (IRN and QR code), and return filing with a qualified chartered accountant before relying on it for compliance.',
      },
      {
        q: 'What fields are mandatory on a GST invoice?',
        a: 'Generally: supplier name, address and GSTIN; a unique invoice number and date; buyer details (with GSTIN for B2B); place of supply; HSN/SAC codes; description, quantity and taxable value; the GST rate; and the CGST/SGST or IGST amounts. Fill these in the form and they appear on the PDF.',
      },
      {
        q: 'When do I charge CGST + SGST instead of IGST?',
        a: 'If the supplier and buyer are in the same state (matching two-digit state codes, e.g. 27 for Maharashtra), GST splits into CGST + SGST. If they are in different states, IGST applies. The tool decides this automatically from the state codes you enter.',
      },
      {
        q: 'Can I add multiple goods or services to one invoice?',
        a: 'Yes — add or remove rows in the line table, each with its own HSN/SAC code, quantity, taxable rate, and GST %. Totals update automatically from your lines and state codes.',
      },
      {
        q: 'Is this GST invoice generator free?',
        a: 'Yes — you can create and download a GST-style invoice PDF for free. The form is turned into a PDF right in your browser.',
      },
    ],
  },
  'ocr-pdf': {
    featureName: 'OCR PDF',
    faqs: [
      {
        q: 'What does OCR do to a PDF?',
        a: 'OCR (optical character recognition) adds a searchable text layer over a scanned PDF, so you can find words, copy passages, and use editors that rely on real text.',
      },
      {
        q: 'Does OCR support Hindi and other Indian languages?',
        a: 'Yes — pdfpilot runs OCR on the server with ocrmypdf and Tesseract, including English and Hindi, so scanned Hindi documents become searchable.',
      },
      {
        q: 'How long does OCR take?',
        a: 'It runs on the server and large files can take a few minutes. You download a new PDF; keep the original if you still need the untouched scan.',
      },
      {
        q: 'Is OCR free?',
        a: 'Server OCR is a Pro feature because it runs on the server. Free accounts can still edit and convert PDFs; Pro unlocks OCR, Chat with PDF, and unlimited downloads.',
      },
    ],
    intro: [
      'A scanned PDF is really just pictures of pages, so you cannot search or copy its text. OCR (optical character recognition) reads those images and adds a searchable text layer underneath, making the document fully searchable while it still looks exactly the same.',
      'OCR runs on the server with trusted open-source tools (ocrmypdf and Tesseract) and supports both English and Hindi. You download a new PDF — keep the original if you still need the untouched scan.',
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
  'pdf-to-png': {
    featureName: 'PDF to PNG',
    faqs: [
      {
        q: 'How do I convert a PDF to PNG images?',
        a: 'Open PDF to PNG, upload your PDF, convert, and download a ZIP with one lossless PNG per page.',
      },
      {
        q: 'Why choose PNG over JPG?',
        a: 'PNG is lossless, so it keeps sharp edges and crisp text — better for design tools, slides, and archives. JPG makes smaller files and suits photos.',
      },
      {
        q: 'Are my files uploaded?',
        a: 'No — conversion runs entirely in your browser, so your document does not pass through an extra upload pipeline.',
      },
      {
        q: 'Will the PNG images have selectable text?',
        a: 'No. PNGs are images; keep the original PDF, or use PDF to text / OCR, if you still need the words.',
      },
    ],
    intro: [
      'Export every page of a PDF as a PNG image when you need lossless, sharp-edged screenshots — ideal for design tools, crisp presentation slides, or archives where clean edges matter more than file size.',
      'Conversion runs entirely in your browser, so your document does not pass through an extra upload pipeline before you download the images as a ZIP.',
    ],
    steps: [
      'Open PDF to PNG from the toolkit.',
      'Upload your PDF and pick a render scale if the tool offers one.',
      'Start conversion and wait for the ZIP to build.',
      'Download the archive and unzip on your computer.',
      'Use individual PNGs wherever images work better than PDF pages.',
    ],
    benefits: [
      {
        title: 'Lossless page shots',
        body: 'PNG avoids JPEG artifacts that can show up on text or thin lines.',
      },
      {
        title: 'ZIP keeps order',
        body: 'Page-named files stay aligned with the original document sequence.',
      },
      {
        title: 'Privacy-friendly',
        body: 'Rendering happens locally in the browser session you already trust.',
      },
      {
        title: 'Works offline-capable',
        body: 'Once the app is loaded, processing does not depend on a conversion API.',
      },
    ],
    highlights: [
      {
        title: 'Whole-document export',
        body: 'Every page is processed in one pass.',
      },
      {
        title: 'Scale control',
        body: 'Higher scale improves sharpness at the cost of larger files.',
      },
      {
        title: 'Share images easily',
        body: 'PNG previews open everywhere without a PDF reader.',
      },
    ],
  },
  'pdf-to-text': {
    featureName: 'PDF to text',
    faqs: [
      {
        q: 'How do I extract text from a PDF?',
        a: 'Open PDF to text, upload a digital PDF, and pdfpilot reads the embedded text layer in your browser so you can copy the plain text.',
      },
      {
        q: 'Why is my scanned PDF giving no text?',
        a: 'Scanned PDFs are images with no selectable text. Run OCR PDF first (when the server is configured) to add a text layer, then export text again.',
      },
      {
        q: 'Does it keep the original layout?',
        a: 'No — it pulls plain text, ideal when you just need the words for notes, scripts, or quick edits rather than the formatting.',
      },
      {
        q: 'Are my files uploaded?',
        a: 'No — text extraction runs in your browser from the PDF’s embedded text layer.',
      },
    ],
    intro: [
      'Pull the plain text out of a digital PDF for notes, quotes, scripts, data entry, or quick edits. It reads the embedded text layer in your browser — ideal when you want the words without the layout.',
      'A scanned PDF that is only images has no selectable text until OCR adds a layer, so run the OCR PDF tool first (when the server is configured) and then try the text export again.',
    ],
    steps: [
      'Open PDF to text from the toolkit.',
      'Upload a PDF that already has selectable text.',
      'Run extraction and download the .txt file.',
      'Open the text file in your editor or paste it where you need it.',
      'If the output is empty, treat the file as image-based and OCR it first.',
    ],
    benefits: [
      {
        title: 'Fast quotes and citations',
        body: 'Grab paragraphs without retyping from a viewer.',
      },
      {
        title: 'Lightweight output',
        body: 'A .txt file is easy to email or diff in version control.',
      },
      {
        title: 'Local extraction',
        body: 'The browser reads your PDF without uploading it for conversion.',
      },
      {
        title: 'Pairs with OCR',
        body: 'Searchable scans become fair game after OCR adds real text.',
      },
    ],
    highlights: [
      {
        title: 'Plain UTF-8 text',
        body: 'Download a simple text file you can open anywhere.',
      },
      {
        title: 'Honest limits',
        body: 'Very long documents follow the same client page caps as other tools.',
      },
      {
        title: 'No layout promises',
        body: 'This is text extraction, not a guarantee of perfect reading order on complex layouts.',
      },
    ],
  },
  'flatten-pdf': {
    featureName: 'Flatten PDF',
    faqs: [
      {
        q: 'What does flattening a PDF do?',
        a: 'It turns interactive elements into static appearance so form fields and annotations can no longer be edited — useful for final, locked copies.',
      },
      {
        q: 'What is the difference between the two flatten options?',
        a: 'Form flattening merges AcroForm fields into the page; full-page rasterization converts pages to images for the strongest guarantee nothing stays editable (larger files, no selectable text).',
      },
      {
        q: 'Will flattening reduce quality?',
        a: 'Form flattening keeps text crisp. Rasterization turns pages into images, so text is no longer selectable and file size may grow — use it only when you need a printed-like snapshot.',
      },
      {
        q: 'Does it run in my browser?',
        a: 'Yes — both the form-flattening and rasterization paths run in your browser on pdfpilot.',
      },
    ],
    intro: [
      'Flatten a PDF to turn interactive elements into a fixed, static appearance — either by flattening form fields so they can no longer be changed, or by rasterizing whole pages to images when you need the strongest guarantee that nothing stays editable.',
      'Both paths run in your browser: lightweight form flattening, or full-page rasterization that trades a larger file size for a locked, print-like snapshot.',
    ],
    steps: [
      'Open Flatten PDF and upload your document.',
      'Choose flatten forms for fillable fields, or rasterize for image-only pages.',
      'Adjust raster scale if you pick image mode—higher looks sharper but grows the file.',
      'Download the flattened PDF and verify in your usual reader.',
      'Keep an unfrozen copy if you might need to edit fields again.',
    ],
    benefits: [
      {
        title: 'Submission-ready forms',
        body: 'Flattened fields often match what regulators expect for “flat” uploads.',
      },
      {
        title: 'Raster option',
        body: 'Burn everything into pixels when you must eliminate hidden layers.',
      },
      {
        title: 'Clear trade-offs',
        body: 'Form flatten keeps vectors; raster mode prioritizes visual fidelity over size.',
      },
      {
        title: 'Runs locally',
        body: 'No separate flatten service is required once the app is open.',
      },
    ],
    highlights: [
      {
        title: 'Two flatten modes',
        body: 'Pick the approach that matches compliance or size needs.',
      },
      {
        title: 'Preview before sharing',
        body: 'Always open the download to confirm nothing important was lost.',
      },
      {
        title: 'Pairs with Fill PDF',
        body: 'Fill fields first, then flatten if you need a non-interactive export.',
      },
    ],
  },
  'fill-pdf': {
    featureName: 'Fill PDF form',
    faqs: [
      {
        q: 'How do I fill a PDF form online?',
        a: 'Open Fill PDF form, upload a standard AcroForm PDF, and pdfpilot lists the fields it can edit so you can type, tick boxes, and pick dropdown values, then download.',
      },
      {
        q: 'Why are my form fields not showing up?',
        a: 'Some complex government PDFs use widgets that cannot be edited in the browser. Simpler AcroForm PDFs work; for others, edit elsewhere or print and fill.',
      },
      {
        q: 'Do I need to print and scan to fill a form?',
        a: 'No — fill standard forms on screen and download the completed PDF without printing or scanning.',
      },
      {
        q: 'Are my files uploaded?',
        a: 'Filling runs in your browser, so your form data and file stay on your device.',
      },
    ],
    intro: [
      'Complete a standard PDF form on screen — type into fields, tick checkboxes, and choose dropdown values — without printing and scanning. The tool lists the fields it can edit so you can fill the form and download the finished copy.',
      'Some complex government PDFs include widgets that cannot be edited here; when that happens, downloading still works for simpler forms, or after you edit the tricky fields elsewhere.',
    ],
    steps: [
      'Open Fill PDF form and upload your PDF.',
      'Review the detected fields and enter values.',
      'Use download to save a filled copy.',
      'Open the result in your viewer to confirm layout and signatures.',
      'If fields are missing, try the desktop reader that issued the form.',
    ],
    benefits: [
      {
        title: 'Keyboard-first workflow',
        body: 'Type instead of handwriting small boxes.',
      },
      {
        title: 'Checkbox and choice support',
        body: 'Many toggles and dropdowns map cleanly to browser controls.',
      },
      {
        title: 'Privacy',
        body: 'The upload stays in your browser memory until you save.',
      },
      {
        title: 'Pairs with Flatten',
        body: 'Flatten after filling when a static file is required.',
      },
    ],
    highlights: [
      {
        title: 'Field listing',
        body: 'See what the tool recognized before you download.',
      },
      {
        title: 'Honest coverage',
        body: 'Unsupported widgets surface as unknown rather than silently failing.',
      },
      {
        title: 'Fast iteration',
        body: 'Adjust answers and download again without mailing drafts.',
      },
    ],
  },
  'repair-pdf': {
    featureName: 'Repair PDF',
    faqs: [
      {
        q: 'How do I fix a corrupt PDF that will not open?',
        a: 'Open Repair PDF, upload the file, and pdfpilot rewrites it through qpdf to rebuild structure that many readers can open again.',
      },
      {
        q: 'What kinds of problems can it fix?',
        a: 'Broken cross-reference tables and stream errors that make viewers crash or refuse to open the file. It cannot recover content that is genuinely missing.',
      },
      {
        q: 'Where is my file processed?',
        a: 'Repair sends your file to your configured pdfpilot API where qpdf runs — the same stack used for Unlock and Compress.',
      },
      {
        q: 'Will repair recover deleted pages or text?',
        a: 'No — it rebuilds the file’s structure so it opens; it cannot restore data that was never in the file.',
      },
    ],
    intro: [
      'Some PDFs have broken cross-reference tables or stream errors that make viewers freeze or refuse to open them. Rewriting the file rebuilds its internal structure so readers can open it again.',
      'Repair sends your file to your configured pdfpilot API, where qpdf rebuilds it — the same reliable engine used for unlocking and compressing when you self-host.',
    ],
    steps: [
      'Open Repair PDF and upload the problematic file.',
      'If the document is encrypted, enter its open password (optional field).',
      'Run repair and download the rewritten PDF.',
      'Open the result in your usual viewer; compare page count and content to the original.',
      'If repair still fails, try Unlock PDF first (when encrypted) or a desktop repair tool for severe damage.',
    ],
    benefits: [
      {
        title: 'Structural rewrite',
        body: 'qpdf reads and writes the PDF, which fixes many common corruptions.',
      },
      {
        title: 'Second-chance pass',
        body: 'When a straight rewrite fails, the server tries rebuilding from page content.',
      },
      {
        title: 'Your API',
        body: 'Runs on infrastructure you control when the toolkit points at your backend.',
      },
      {
        title: 'Honest limits',
        body: 'Not every damaged file can be recovered automatically.',
      },
    ],
    highlights: [
      {
        title: 'Optional password',
        body: 'Encrypted inputs can include the same password you use in Acrobat or Preview.',
      },
      {
        title: 'Download workflow',
        body: 'Same sign-in and download pattern as other server-backed tools.',
      },
      {
        title: 'Pairs with Edit PDF',
        body: 'After repair, continue cleanup in the editor if you still need changes.',
      },
    ],
  },
}
