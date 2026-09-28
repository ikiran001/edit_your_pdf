# pdfpilot home Linux server deployment

Deploy the **API** on your Linux laptop (Docker) and expose it via **Cloudflare Tunnel** at `https://api.pdfpilot.pro`. Serve the **frontend** from **BigRock** static hosting at `https://pdfpilot.pro`.

## Architecture

```
Browser → pdfpilot.pro (BigRock static files)
Browser → api.pdfpilot.pro (Cloudflare → cloudflared → Docker :3001)
```

## Quick start (on the Linux laptop)

```bash
git clone https://github.com/<your-user>/edit_your_pdf.git
cd edit_your_pdf

# Phase 1
bash deploy/home-server/check-specs.sh

# Phase 2
sudo bash deploy/home-server/install-docker.sh
sudo usermod -aG docker $USER   # log out/in
bash deploy/home-server/setup-env.sh   # creates ~/pdfpilot-api.env
nano ~/pdfpilot-api.env                # paste secrets from Render
sudo bash deploy/home-server/setup-firewall.sh

# Phase 3
bash deploy/home-server/build-api.sh
bash deploy/home-server/run-api.sh
bash deploy/home-server/verify-api.sh

# Phase 4 — see cloudflared/config.yml.example and install-cloudflared.sh
sudo bash deploy/home-server/install-cloudflared.sh
# Then Cloudflare Zero Trust → Tunnels → api.pdfpilot.pro → http://127.0.0.1:3001

# Phase 5 — on Mac or laptop
bash deploy/home-server/build-bigrock-frontend.sh
# Upload frontend/dist/* to BigRock public_html/
```

## Docs

| File | Purpose |
|------|---------|
| [CUTOVER.md](./CUTOVER.md) | Switch from Render to home API + Razorpay webhook |
| [OPS.md](./OPS.md) | Daily ops, redeploy, monitoring, backups |

## Scripts

| Script | Phase |
|--------|-------|
| `check-specs.sh` | 1 — RAM, disk, sleep, LAN IP |
| `install-docker.sh` | 2 — Docker Engine |
| `setup-firewall.sh` | 2 — UFW (no public 3001) |
| `pdfpilot-api.env.example` / `setup-env.sh` | 2 — env template |
| `verify-tunnel.sh` | 4 — public `/health` via tunnel |
| `build-api.sh` / `run-api.sh` / `stop-api.sh` | 3 — Docker image |
| `verify-api.sh` | 3 — `/health` + optional OCR |
| `install-cloudflared.sh` | 4 — tunnel client |
| `cloudflared/config.yml.example` | 4 — tunnel ingress |
| `build-bigrock-frontend.sh` | 5 — `dist/` + `.htaccess` |
| `bigrock.htaccess` | 5 — SPA routing on Apache |
| `redeploy-api.sh` | 7 — git pull + rebuild + restart |

## Image

Always build from the **repository root** [`Dockerfile`](../../Dockerfile) (full LibreOffice + ocrmypdf), not `backend/Dockerfile` alone.
