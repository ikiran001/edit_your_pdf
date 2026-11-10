#!/usr/bin/env bash
# Build + (re)start the API and Caddy. Run from deploy/hetzner on the server (as the app user).
#   bash deploy.sh           # build & start with current code
#   bash deploy.sh --pull    # git pull first, then build & start
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [[ ! -f .env ]]; then
  echo "Missing deploy/hetzner/.env — copy .env.example to .env and edit it first."
  exit 1
fi

if [[ "${1:-}" == "--pull" ]]; then
  echo "== git pull =="
  git -C ../.. pull
fi

echo "== docker compose up -d --build =="
docker compose up -d --build
docker compose ps

API_DOMAIN="$(grep -E '^API_DOMAIN=' .env | cut -d= -f2-)"
echo
echo "Verify once DNS + certificate are ready:"
echo "  curl -s https://${API_DOMAIN}/health"
echo "Logs: docker compose logs -f api   |   docker compose logs -f caddy"
