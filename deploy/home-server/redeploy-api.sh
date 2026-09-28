#!/usr/bin/env bash
# Phase 7.2 — pull, rebuild, restart API container.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"
git pull

bash "${SCRIPT_DIR}/build-api.sh"
bash "${SCRIPT_DIR}/stop-api.sh"
bash "${SCRIPT_DIR}/run-api.sh"
bash "${SCRIPT_DIR}/verify-api.sh"

echo "Redeploy complete."
