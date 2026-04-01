#!/usr/bin/env bash
# Render / CI: install qpdf when root/sudo exists; otherwise only npm install.
# Render native builders have no apt privileges — unlock still works via Ghostscript at runtime.
set -euo pipefail

cd "$(dirname "$0")"

if command -v apt-get >/dev/null 2>&1; then
  if [ "$(id -u)" -eq 0 ]; then
    apt-get update
    apt-get install -y --no-install-recommends qpdf
    rm -rf /var/lib/apt/lists/*
    echo "render-build.sh: installed qpdf (root)"
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo apt-get update
    sudo apt-get install -y --no-install-recommends qpdf
    sudo rm -rf /var/lib/apt/lists/*
    echo "render-build.sh: installed qpdf (sudo)"
  else
    echo "render-build.sh: skipping apt (no root/sudo). On Render native, /unlock-pdf uses Ghostscript; optional: deploy with Docker for qpdf."
  fi
else
  echo "render-build.sh: no apt-get; continuing with npm install only"
fi

npm install
