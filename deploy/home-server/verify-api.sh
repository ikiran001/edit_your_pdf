#!/usr/bin/env bash
# Phase 3.3 — verify /health and optional OCR smoke test.
set -euo pipefail

PORT="${PDFPILOT_PORT:-3001}"
BASE="http://127.0.0.1:${PORT}"
SAMPLE_PDF="${1:-}"

echo "=== GET ${BASE}/health ==="
if command -v jq >/dev/null 2>&1; then
  curl -sf "${BASE}/health" | jq .
else
  curl -sf "${BASE}/health"
  echo
fi

if [[ -n "${SAMPLE_PDF}" && -f "${SAMPLE_PDF}" ]]; then
  echo
  echo "=== POST ${BASE}/ocr-pdf (sample: ${SAMPLE_PDF}) ==="
  CODE=$(curl -s -o /tmp/pdfpilot-ocr-test.out -w "%{http_code}" \
    -F "file=@${SAMPLE_PDF}" \
    "${BASE}/ocr-pdf")
  echo "HTTP ${CODE}"
  if [[ "${CODE}" == "200" ]]; then
    echo "OCR output bytes: $(wc -c < /tmp/pdfpilot-ocr-test.out)"
    rm -f /tmp/pdfpilot-ocr-test.out
  else
    head -c 500 /tmp/pdfpilot-ocr-test.out
    echo
    exit 1
  fi
else
  echo
  echo "Optional OCR test: $0 /path/to/sample.pdf"
fi

echo
echo "Verify HEALTH_VERBOSE shows qpdf:true and ocrmypdf:true when enabled in env."
