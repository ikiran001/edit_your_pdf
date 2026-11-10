# Cutover: Render → Hetzner (zero downtime)

Keep Render running until every step passes. The frontend stays on GitHub Pages — you only
repoint it at the new API.

## Prerequisites

- [ ] `curl -s https://api.pdfpilot.pro/health` returns healthy JSON (`qpdf:true`, `ocrmypdf:true`)
- [ ] `ALLOWED_ORIGINS` in `pdfpilot-api.env` includes `https://pdfpilot.pro` and `https://www.pdfpilot.pro`

## Steps

| # | Action | Verify |
|---|--------|--------|
| 1 | API live on Hetzner | `curl https://api.pdfpilot.pro/health` |
| 2 | Repoint frontend | GitHub repo → **Settings → Secrets and variables → Actions** → set **`VITE_API_BASE_URL`** = `https://api.pdfpilot.pro` (no trailing slash) |
| 3 | Rebuild frontend | Re-run the **Deploy to GitHub Pages** workflow (Actions tab → Run workflow). After it finishes, open `https://pdfpilot.pro`, do a PDF action, and confirm the Network tab calls `api.pdfpilot.pro` |
| 4 | Razorpay webhook | Razorpay Dashboard → Webhooks → set URL `https://api.pdfpilot.pro/subscription/webhooks/razorpay` → send a test event (uses the same `RAZORPAY_WEBHOOK_SECRET`) |
| 5 | Smoke test | Edit PDF, OCR, Unlock/Compress, PDF→Word/PowerPoint, Sign in + My Documents — all work and hit `api.pdfpilot.pro` |
| 6 | Retire Render | Only after 1–5 pass: **Suspend** (don't delete yet) the Render web service. Keep it a few days as rollback insurance, then delete |

## Rollback

1. Set GitHub secret `VITE_API_BASE_URL` back to `https://edit-your-pdf-1.onrender.com`
2. Re-run the GitHub Pages workflow
3. Resume the Render service
4. Revert the Razorpay webhook URL to the Render URL

## Common failures

| Symptom | Fix |
|---------|-----|
| No HTTPS cert / Caddy errors | DNS A record must resolve to the server **before** deploy; ports 80 + 443 open (`ufw status`); on Cloudflare, use grey-cloud for first issue |
| CORS error on upload | Add the exact origin to `ALLOWED_ORIGINS` (no trailing slash), then `bash deploy.sh` |
| Calls still go to onrender.com | GitHub secret not updated, or the Pages workflow wasn't re-run after changing it |
| 502 from api.pdfpilot.pro | `docker compose ps` / `docker compose logs api` — container healthy? |
| Razorpay webhook fails | HTTPS reachable, correct `RAZORPAY_WEBHOOK_SECRET`, server clock synced (`timedatectl`) |
