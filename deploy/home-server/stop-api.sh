#!/usr/bin/env bash
set -euo pipefail
CONTAINER="${PDFPILOT_CONTAINER:-pdfpilot-api}"
docker stop "${CONTAINER}" 2>/dev/null || true
docker rm "${CONTAINER}" 2>/dev/null || true
echo "Stopped ${CONTAINER}"
