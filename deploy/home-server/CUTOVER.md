# Cutover checklist (Render → home server)

Keep Render running until every step below passes.

## Prerequisites

- [ ] `curl -s https://api.pdfpilot.pro/health` returns JSON with `qpdf: true` and `ocrmypdf: true` (set `HEALTH_VERBOSE=1` in `~/pdfpilot-api.env`)
- [ ] `https://pdfpilot.pro` loads from BigRock with new build (`VITE_API_BASE_URL=https://api.pdfpilot.pro`)
- [ ] `ALLOWED_ORIGINS` includes `https://pdfpilot.pro` and `https://www.pdfpilot.pro`

## Steps

| # | Action | Verify |
|---|--------|--------|
| 1 | API live on tunnel | `curl https://api.pdfpilot.pro/health` |
| 2 | Frontend on BigRock | Open `https://pdfpilot.pro` — View Source shows your build |
| 3 | Razorpay webhook | Dashboard → Webhooks → URL `https://api.pdfpilot.pro/subscription/webhooks/razorpay` → send test event |
| 4 | Edit PDF | Upload → save → download; Network shows `api.pdfpilot.pro/upload`, `/edit`, `/download` |
| 5 | OCR PDF | `POST api.pdfpilot.pro/ocr-pdf` returns 200 |
| 6 | Unlock / Compress | Same host in Network tab |
| 7 | PDF → PowerPoint | `POST api.pdfpilot.pro/document-flow/convert-pdf-to-pptx` |
| 8 | Sign in / My Documents | Firebase flows work (same `FIREBASE_SERVICE_ACCOUNT_JSON` as Render) |
| 9 | Pause Render | After 1–8 pass, pause or delete Render web service |
| 10 | GitHub secret (optional) | If using Pages backup: `VITE_API_BASE_URL=https://api.pdfpilot.pro` |

## Rollback

1. Point BigRock build back to `VITE_API_BASE_URL=https://<your-service>.onrender.com`
2. Resume Render service
3. Revert Razorpay webhook URL to Render URL

## Common failures

| Symptom | Fix |
|---------|-----|
| CORS error on upload | Add exact origin to `ALLOWED_ORIGINS` (no trailing slash) |
| `POST` goes to `pdfpilot.pro/upload` | Rebuild frontend with `VITE_API_BASE_URL` |
| 502 from `api.pdfpilot.pro` | `docker ps`, `systemctl status cloudflared`, laptop awake |
| Razorpay webhook fails | HTTPS reachable, correct `RAZORPAY_WEBHOOK_SECRET`, clock synced (`timedatectl`) |
