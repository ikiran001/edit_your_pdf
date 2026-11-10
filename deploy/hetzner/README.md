# pdfpilot API on Hetzner (CX22)

Move the **API** off Render's free tier onto an always-on Hetzner VPS. The **frontend stays on
GitHub Pages** exactly as it is — we only change one build secret so it calls the new API.

## Architecture

```
Browser → pdfpilot.pro            (frontend, GitHub Pages — unchanged)
Browser → api.pdfpilot.pro        (Hetzner VPS → Caddy :443 → Docker api :3001)
```

Caddy gets a free Let's Encrypt HTTPS certificate automatically. The API port is never exposed
to the internet — only Caddy (80/443) is. No Cloudflare Tunnel needed (the VPS has a public IP).

---

## Step 0 — Create the server (Hetzner Cloud Console)

1. Sign up at <https://console.hetzner.cloud> → **New project** → **Add server**.
2. **Location:** pick the one closest to your users. For mostly-India traffic choose **Singapore**.
3. **Image:** Ubuntu 24.04.
4. **Type:** **CX22** (2 vCPU, 4 GB RAM) — *Shared vCPU → Intel/AMD (x86)*.
5. **SSH key:** add your public key (`cat ~/.ssh/id_ed25519.pub` on your Mac; create one with
   `ssh-keygen -t ed25519` if you don't have it). Avoid password login.
6. Create the server and note its **public IPv4** (e.g. `203.0.113.10`).

## Step 1 — Point DNS at the server

Wherever `pdfpilot.pro`'s DNS is managed, add an **A record**:

| Type | Name | Value |
|------|------|-------|
| A    | `api` | `<server-ip>` |

This creates `api.pdfpilot.pro → <server-ip>`. Wait for it to resolve:
`dig +short api.pdfpilot.pro` should return the server IP before you deploy (so Caddy can get a cert).

## Step 2 — Prepare the server (one time)

```bash
ssh root@<server-ip>
apt-get update && apt-get install -y git
git clone https://github.com/ikiran001/edit_your_pdf.git
bash edit_your_pdf/deploy/hetzner/setup-server.sh
```

This creates a `pdfpilot` user, installs Docker + Compose, enables the firewall (SSH/80/443),
adds swap, and turns on automatic security updates. Then log in as that user:

```bash
ssh pdfpilot@<server-ip>
# move the clone into your home (or re-clone):
sudo mv /root/edit_your_pdf ~/ 2>/dev/null || git clone https://github.com/ikiran001/edit_your_pdf.git
cd ~/edit_your_pdf/deploy/hetzner
```

## Step 3 — App secrets

```bash
cp pdfpilot-api.env.example /home/pdfpilot/pdfpilot-api.env
chmod 600 /home/pdfpilot/pdfpilot-api.env
nano /home/pdfpilot/pdfpilot-api.env
```

Paste these from **Render Dashboard → your service → Environment** (one line each):
`FIREBASE_SERVICE_ACCOUNT_JSON`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

## Step 4 — Compose config

```bash
cp .env.example .env
nano .env
```

Set `API_DOMAIN=api.pdfpilot.pro` and `ACME_EMAIL=<an email you check>`. Leave `PDFPILOT_ENV_FILE`
as `/home/pdfpilot/pdfpilot-api.env` (where you put the secrets in Step 3).

## Step 5 — Deploy

```bash
bash deploy.sh
```

First build takes several minutes (it installs LibreOffice, Tesseract, Ghostscript, qpdf and
downloads Noto fonts). Watch certificate issuance with `docker compose logs -f caddy`.

## Step 6 — Verify (before touching the live site)

```bash
curl -s https://api.pdfpilot.pro/health        # JSON with qpdf:true, ocrmypdf:true
```

If that returns healthy JSON over HTTPS, the server side is done. See [CUTOVER.md](./CUTOVER.md)
to switch the live frontend over and retire Render with zero downtime.

---

## Operations

**Logs**

```bash
cd ~/edit_your_pdf/deploy/hetzner
docker compose logs -f api
docker compose logs -f caddy
docker compose ps
```

**Redeploy after code changes**

```bash
bash deploy.sh --pull     # git pull + rebuild + restart
```

**Update Caddy**

```bash
docker compose pull caddy && docker compose up -d caddy
```

**Backup secrets** (keep off the server too)

```bash
scp pdfpilot@<server-ip>:/home/pdfpilot/pdfpilot-api.env ~/backups/
```

**Disk cleanup** (monthly)

```bash
df -h / && docker system prune -f
```

**Monitoring** — add a free [UptimeRobot](https://uptimerobot.com) HTTP(s) monitor on
`https://api.pdfpilot.pro/health` so you're alerted if it ever goes down.

## Notes

- Everything runs as Docker containers with `restart: unless-stopped`, so the API comes back by
  itself after a reboot.
- If `pdfpilot.pro`'s DNS is on **Cloudflare**, set the `api` record to **DNS only (grey cloud)**
  for the first deploy so Caddy can complete the Let's Encrypt check; you can enable the orange
  proxy afterward.
- CX22 has 4 GB RAM + 2 GB swap — comfortable for OCR/LibreOffice on normal PDFs. Very large or
  many concurrent OCR jobs may need a bigger plan (CPX/CCX).
