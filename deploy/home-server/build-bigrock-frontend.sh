#!/usr/bin/env bash
# Phase 5.1 — production frontend build for BigRock + api.pdfpilot.pro.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
FRONTEND="${REPO_ROOT}/frontend"
OUT="${FRONTEND}/dist"
API_BASE="${VITE_API_BASE_URL:-https://api.pdfpilot.pro}"
SITE_URL="${VITE_SITE_URL:-https://pdfpilot.pro/}"
BASE_PATH="${VITE_BASE_PATH:-/}"

cd "${FRONTEND}"
npm ci

# Runtime fallback (matches GitHub Actions deploy-github-pages.yml)
node -e "
const fs = require('fs');
const u = String(process.env.VITE_API_BASE_URL || '${API_BASE}').trim().replace(/\\/+\$/, '');
fs.writeFileSync('public/pilot-api-runtime.js', 'window.__PDFPILOT_API_BASE__=' + JSON.stringify(u) + '\\n');
"

export VITE_API_BASE_URL="${API_BASE}"
export VITE_SITE_URL="${SITE_URL}"
export VITE_BASE_PATH="${BASE_PATH}"

npm run build

cp "${SCRIPT_DIR}/bigrock.htaccess" "${OUT}/.htaccess"

echo
echo "Build complete: ${OUT}"
echo "Upload everything inside dist/ to BigRock public_html/ (index.html at root)."
echo "API base baked in: ${API_BASE}"
ls -la "${OUT}/.htaccess" "${OUT}/index.html"
