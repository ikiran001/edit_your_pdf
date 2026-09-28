# Operations — pdfpilot home server

## Daily health check

```bash
curl -s https://api.pdfpilot.pro/health
docker ps --filter name=pdfpilot-api
sudo systemctl status cloudflared --no-pager
```

Optional: [UptimeRobot](https://uptimerobot.com) free monitor on `https://api.pdfpilot.pro/health`.

## Logs

```bash
docker logs --tail 100 pdfpilot-api
docker logs -f pdfpilot-api
journalctl -u cloudflared -n 50 --no-pager
```

## Redeploy API after code changes

```bash
cd edit_your_pdf
bash deploy/home-server/redeploy-api.sh
```

Or manually:

```bash
git pull
bash deploy/home-server/build-api.sh
bash deploy/home-server/stop-api.sh
bash deploy/home-server/run-api.sh
bash deploy/home-server/verify-api.sh
```

## Redeploy frontend (BigRock)

On Mac or laptop:

```bash
bash deploy/home-server/build-bigrock-frontend.sh
```

Upload contents of `frontend/dist/` to cPanel `public_html/` (overwrite). `.htaccess` is included in `dist/`.

## Environment backup

```bash
# Encrypted backup to HDD (example)
zip -e ~/backups/pdfpilot-api-env-$(date +%Y%m%d).zip ~/pdfpilot-api.env
```

Never commit `~/pdfpilot-api.env` to git.

## Disk cleanup (monthly)

```bash
df -h /
docker system prune -f
```

## After reboot

Laptop must stay plugged in with suspend disabled.

```bash
docker ps                    # pdfpilot-api should be Up
sudo systemctl status cloudflared
curl -s http://127.0.0.1:3001/health
curl -s https://api.pdfpilot.pro/health
```

## Power / uptime risks

- Power cut → API down until laptop boots and Docker + cloudflared start (`--restart unless-stopped` helps).
- Home upload bandwidth limits large PDF uploads vs datacenter.
- OCR heats CPU — normal on old laptops.

## Quick reference

| Task | Command |
|------|---------|
| Stop API | `bash deploy/home-server/stop-api.sh` |
| Start API | `bash deploy/home-server/run-api.sh` |
| Spec check | `bash deploy/home-server/check-specs.sh` |
| OCR smoke test | `bash deploy/home-server/verify-api.sh /path/to/sample.pdf` |
