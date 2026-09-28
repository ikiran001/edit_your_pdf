#!/usr/bin/env bash
# Phase 2.4 — create ~/pdfpilot-api.env from template if missing.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${HOME}/pdfpilot-api.env"

if [[ -f "${TARGET}" ]]; then
  echo "Already exists: ${TARGET}"
  echo "Edit with: nano ${TARGET}"
  exit 0
fi

cp "${SCRIPT_DIR}/pdfpilot-api.env.example" "${TARGET}"
chmod 600 "${TARGET}"
echo "Created ${TARGET}"
echo "Paste secrets from Render Dashboard → Environment, then:"
echo "  nano ${TARGET}"
