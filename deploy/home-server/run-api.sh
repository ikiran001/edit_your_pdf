#!/usr/bin/env bash
# Phase 3.2 — run API container bound to localhost only (Cloudflare Tunnel reaches it).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${PDFPILOT_ENV_FILE:-${HOME}/pdfpilot-api.env}"
IMAGE="${PDFPILOT_IMAGE:-pdfpilot-api:latest}"
CONTAINER="${PDFPILOT_CONTAINER:-pdfpilot-api}"
PORT="${PDFPILOT_PORT:-3001}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  echo "Copy deploy/home-server/pdfpilot-api.env.example to ${ENV_FILE} and fill secrets."
  exit 1
fi

if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
  echo "Removing existing container ${CONTAINER} ..."
  docker rm -f "${CONTAINER}" >/dev/null
fi

docker run -d \
  --name "${CONTAINER}" \
  --restart unless-stopped \
  -p "127.0.0.1:${PORT}:${PORT}" \
  --env-file "${ENV_FILE}" \
  "${IMAGE}"

echo "API listening on http://127.0.0.1:${PORT}"
echo "Health: curl -s http://127.0.0.1:${PORT}/health | jq"
echo "Logs:   docker logs -f ${CONTAINER}"
