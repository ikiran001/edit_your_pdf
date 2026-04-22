# pdfpilot — marketing & agency brief

**Document purpose:** Single source of facts and messaging for agencies, partners, and press.  
**Product:** pdfpilot — browser-based PDF toolkit + editor  
**Primary site:** https://pdfpilot.pro  
**Contact (product / partnerships):** ijkiranp@gmail.com  
**Last aligned with product copy:** April 2026  

---

## One-line positioning

**pdfpilot** helps people **edit, compress, merge, and manage PDFs in the browser** — fast, clear exports without installing desktop software.

**Tagline:** Navigate your PDFs effortlessly.

**Supporting line (hero):** Edit, compress, merge and manage PDFs instantly — clarity, speed, and trustworthy exports.

---

## Elevator pitch (30 seconds)

pdfpilot is a **web app** that bundles professional PDF workflows: true **in-browser editing** (text, annotations, highlights, signatures), plus merge, split, compress, convert, encrypt, watermark, and India-focused tools like **GST invoice PDF**. Users can work **signed in** to save sessions to **Saved PDFs**, manage downloads securely, and optionally upgrade to **Pro** for unlimited server-backed downloads (paid via **Razorpay**, INR). The experience is built for **students, small businesses, accountants, and anyone** who lives in PDFs but does not want heavyweight installs.

---

## Who it’s for (personas)

| Persona | Need | How pdfpilot fits |
|--------|------|-------------------|
| **Students & educators** | Fix typos, highlight, merge handouts | Edit PDF + Merge + Organize |
| **SMB / ops** | Compress attachments, merge contracts | Compress + Merge + Sign |
| **Finance / India** | GST-ready invoice PDFs | GST invoice PDF tool |
| **General knowledge workers** | Quick edits without Acrobat | Edit PDF in the browser |
| **Mobile-first users** | Scan receipts → one PDF | Scan to PDF |

---

## Product pillars (messaging angles)

1. **No install** — Runs in the browser; modern UI, dark mode, keyboard-friendly editor.  
2. **Toolkit + editor** — Not only “one trick”; many tools in one brand (pdfpilot).  
3. **Trust & quality** — Server-side processing where needed (e.g. encryption, Word→PDF); clear download flows with optional **Firebase** sign-in for secure downloads.  
4. **Freemium that’s honest** — Free tier includes real editing; **Pro** removes daily download caps for signed-in server downloads (see “Monetization” for exact rules — keep claims aligned with current Terms).  
5. **Global, India-ready** — INR Pro pricing via Razorpay; hero usage line references multi-country use (refresh geography copy from analytics when updating site).

---

## Tool catalogue (implemented)

Use these names in ads and landing pages; paths are relative to **https://pdfpilot.pro**.

| Tool | Path | One-line benefit |
|------|------|------------------|
| **Edit PDF** | `/tools/edit-pdf` | Change text, annotate, highlight, draw |
| **Merge PDF** | `/tools/merge-pdf` | Combine multiple PDFs into one |
| **Split PDF** | `/tools/split-pdf` | Split by ranges or extract every page |
| **Organize pages** | `/tools/organize-pdf` | Reorder, rotate, delete pages |
| **Compress PDF** | `/tools/compress-pdf` | Smaller files, levels, batch ZIP |
| **PDF to JPG** | `/tools/pdf-to-jpg` | Export pages as JPEG |
| **JPG to PDF** | `/tools/jpg-to-pdf` | Images → one PDF |
| **Scan to PDF** | `/tools/scan-to-pdf` | Camera/photos → trimmed multi-page PDF |
| **Sign PDF** | `/tools/sign-pdf` | Signatures on any page, download |
| **Unlock PDF** | `/tools/unlock-pdf` | Remove password (where legally allowed) |
| **Encrypt PDF** | `/tools/encrypt-pdf` | Password-protect (server, AES-256 via qpdf) |
| **Add watermark** | `/tools/add-watermark` | Text or image watermark, ranges, preview |
| **Word to PDF** | `/tools/word-to-pdf` | Upload .docx → download PDF |
| **GST invoice PDF** | `/tools/gst-invoice` | Supplier, buyer, HSN lines → tax invoice PDF |
| **Saved PDFs** | `/my-documents` | Signed-in library of sessions (when auth enabled) |
| **Subscription & billing** | `/account/subscription` | Plan, usage, Razorpay receipts |

**Roadmap / not live:** PDF to Word (`/tools/pdf-to-word`) — positioned as coming soon in product.

---

## Monetization (Pro) — facts for compliant copy

- **Currency:** INR (India).  
- **Razorpay** checkout for card/UPI etc. (exact methods = whatever Razorpay enables on the merchant account).  
- **Pro tiers (as implemented):** **₹99 / month** and **₹999 / year** (verify in app before running paid ads).  
- **Renewal model:** **Manual renewal** (prepaid periods; no surprise auto-debit described in-product).  
- **Free tier download rule (server downloads):** Signed-in users get **up to 3 PDF downloads per UTC calendar day** on free; **Pro = unlimited** for those flows. (Toolkit flows that only download client-side blobs may differ; avoid promising “every pixel server-gated” unless product/legal confirms.)  
- **Agency note:** Always sync final numbers and rules with **Terms of Service** on pdfpilot.pro before publishing.

---

## Trust & social proof (refresh regularly)

From in-product hero trust strip (update when marketing refreshes GA):

- **~275+** PDFs created (7-day window; snapshot dated in repo: Apr 12–18, 2026).  
- **~270+** users actively editing (same window).  
- **Growth** narrative: “Growing ~15% week over week” (verify before reuse).  
- **Geography line:** “Used by people in 🇮🇳 🇺🇸 🇧🇷 🇬🇧 and more” — refresh flags from GA geography when updating site.

**Do not** treat these as audited financials; they are **product analytics snapshots**.

---

## Legal & brand housekeeping (for agency compliance)

- **Governing law (Terms):** India — confirm exact wording on `/terms` before legal campaigns.  
- **Brand name:** pdfpilot (lowercase styling in UI).  
- **Legal entity name in footer copy:** pdfpilot (see site Terms).  
- **Contact for legal / terms:** use address and channels stated on the live Terms page.

---

## Suggested campaign hooks (examples — not prescriptive)

- *“Fix the PDF without fixing your laptop.”* — zero-install editor.  
- *“Merge, compress, sign — one tab.”* — toolkit breadth.  
- *“GST invoice PDF in minutes.”* — India SMB angle.  
- *“Pro when you’re done fighting the 3-a-day cap.”* — only if aligned with live UX and Terms.

---

## Technical differentiators (for B2B / dev-curious buyers)

- **Server API** (e.g. Render) for uploads, edits, secure download, Word→PDF, etc.  
- **Firebase Authentication** optional for sign-in and library features.  
- **Firestore** for per-user document index when Admin is configured.  
- **qpdf / LibreOffice** stack on API image for reliable PDF operations.

(Use at a high level in brochures; avoid over-sharing internal architecture unless talking to technical partners.)

---

## Deliverables agencies often need

| Asset | Where to get / note |
|-------|---------------------|
| **Logo** | `frontend/public/favicon.svg` — confirm if a full wordmark package exists before large print runs |
| **Screenshots** | Capture from pdfpilot.pro (light + dark mode) for authenticity |
| **Fonts / colors** | Match live site (indigo / cyan accents, zinc neutrals) |
| **URL list** | Use table above; always test links before campaigns |

---

## Call to action

- **Primary CTA:** https://pdfpilot.pro  
- **Deep link for “hero” product:** https://pdfpilot.pro/tools/edit-pdf  
- **Contact:** ijkiranp@gmail.com  

---

## Changelog (brochure file)

| Date | Change |
|------|--------|
| 2026-04-22 | Initial agency brochure from product repo facts |

---

*Agencies: replace snapshot stats and pricing lines with the latest values from the live site and Terms before going live with paid media.*
