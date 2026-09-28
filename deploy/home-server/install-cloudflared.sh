#!/usr/bin/env bash
# Phase 4.1 — install cloudflared on Debian/Ubuntu.
# Tunnel creation is done in Cloudflare Zero Trust dashboard (see README).
set -euo pipefail

if command -v cloudflared >/dev/null 2>&1; then
  cloudflared --version
  exit 0
fi

ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
case "${ARCH}" in
  amd64|x86_64) DEB_ARCH=amd64 ;;
  arm64|aarch64) DEB_ARCH=arm64 ;;
  *)
    echo "Unsupported arch: ${ARCH}. Install from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
    ;;
esac

TMP=$(mktemp -d)
curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${DEB_ARCH}.deb" \
  -o "${TMP}/cloudflared.deb"
sudo dpkg -i "${TMP}/cloudflared.deb"
rm -rf "${TMP}"
cloudflared --version
echo
echo "Next: Cloudflare Dashboard → Zero Trust → Networks → Tunnels → Create tunnel"
echo "      Public hostname: api.pdfpilot.pro → http://127.0.0.1:3001"
