#!/usr/bin/env bash
# One-time Hetzner CX22 server prep. Run as root on a fresh Ubuntu 22.04/24.04 box:
#   ssh root@<server-ip>
#   # (clone the repo first, or scp this file over)
#   bash setup-server.sh
#
# Creates a non-root sudo user, installs Docker + compose, sets a firewall (SSH/HTTP/HTTPS),
# adds swap, and enables unattended security upgrades.
set -euo pipefail

APP_USER="${APP_USER:-pdfpilot}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "== System update =="
apt-get update
apt-get -y upgrade
apt-get install -y ca-certificates curl gnupg ufw unattended-upgrades

echo "== Non-root user: ${APP_USER} =="
if ! id "${APP_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${APP_USER}"
  usermod -aG sudo "${APP_USER}"
  # Copy root's SSH key so you can log in as the new user with the same key.
  if [[ -f /root/.ssh/authorized_keys ]]; then
    install -d -m 700 -o "${APP_USER}" -g "${APP_USER}" "/home/${APP_USER}/.ssh"
    install -m 600 -o "${APP_USER}" -g "${APP_USER}" /root/.ssh/authorized_keys "/home/${APP_USER}/.ssh/authorized_keys"
  fi
else
  echo "  user already exists"
fi

echo "== Docker Engine + Compose =="
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "  docker already installed: $(docker --version)"
fi
usermod -aG docker "${APP_USER}"

echo "== Firewall (UFW): SSH + HTTP + HTTPS only =="
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== Swap (2 GB — insurance for OCR/LibreOffice memory spikes) =="
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "  swap already present"
fi

echo "== Unattended security upgrades =="
dpkg-reconfigure -f noninteractive unattended-upgrades || true

echo
echo "Done. Next steps:"
echo "  1) Log in as the app user:   ssh ${APP_USER}@<server-ip>"
echo "  2) git clone <your repo>; cd edit_your_pdf/deploy/hetzner"
echo "  3) Follow README.md (secrets + .env + docker compose up -d --build)"
