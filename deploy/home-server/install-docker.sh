#!/usr/bin/env bash
# Phase 2.1 — install Docker Engine on Ubuntu/Debian (official convenience script).
# Run: sudo bash deploy/home-server/install-docker.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash $0"
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  echo "Docker already installed: $(docker --version)"
  docker run --rm hello-world
  exit 0
fi

apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin

echo
echo "Docker installed. Add your user to the docker group:"
echo "  sudo usermod -aG docker \$USER"
echo "Then log out and back in, then: docker run hello-world"
