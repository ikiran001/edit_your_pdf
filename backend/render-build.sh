#!/usr/bin/env bash
# Native Render Web Service (no Docker): install qpdf during build, then npm install.
# Dashboard: Root Directory = backend, Build Command = bash render-build.sh, Start Command = npm start
set -euo pipefail

cd "$(dirname "$0")"

if command -v apt-get >/dev/null 2>&1; then
  if [ "$(id -u)" -eq 0 ]; then
    apt-get update
    apt-get install -y --no-install-recommends qpdf
    rm -rf /var/lib/apt/lists/*
  elif command -v sudo >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y --no-install-recommends qpdf
    sudo rm -rf /var/lib/apt/lists/*
  else
    echo "render-build.sh: no root/sudo; cannot apt-get install qpdf. Use Docker deploy (backend/Dockerfile) instead." >&2
    exit 1
  fi
else
  echo "render-build.sh: apt-get not found. Use Docker (backend/Dockerfile) on Render." >&2
  exit 1
fi

npm install
