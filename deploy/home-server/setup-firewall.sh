#!/usr/bin/env bash
# Phase 2.2 — basic UFW: deny incoming except SSH. Do NOT open port 3001 (use Cloudflare Tunnel).
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash $0"
  exit 1
fi

if ! command -v ufw >/dev/null 2>&1; then
  apt-get update && apt-get install -y ufw
fi

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH comment 'SSH from LAN'
echo "Enabling UFW (port 3001 stays closed — tunnel only) ..."
ufw --force enable
ufw status verbose
