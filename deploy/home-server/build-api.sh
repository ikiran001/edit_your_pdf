#!/usr/bin/env bash
# Phase 3.1 — build pdfpilot API image from repo-root Dockerfile.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
IMAGE="${PDFPILOT_IMAGE:-pdfpilot-api:latest}"

cd "${REPO_ROOT}"
echo "Building ${IMAGE} from ${REPO_ROOT}/Dockerfile ..."
docker build -t "${IMAGE}" .
echo "Done. Image: ${IMAGE}"
