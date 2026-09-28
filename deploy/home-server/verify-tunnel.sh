#!/usr/bin/env bash
# Phase 4.3 — verify public API via Cloudflare Tunnel.
set -euo pipefail

HOST="${PDFPILOT_PUBLIC_HOST:-api.pdfpilot.pro}"
URL="https://${HOST}/health"

echo "GET ${URL}"
if command -v jq >/dev/null 2>&1; then
  curl -sf "${URL}" | jq .
else
  curl -sf "${URL}"
  echo
fi
echo "OK — tunnel and API reachable."
