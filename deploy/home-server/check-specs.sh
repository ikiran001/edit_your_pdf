#!/usr/bin/env bash
# Phase 1 — hardware/OS checklist for pdfpilot home server.
# Run on the Linux laptop before installing Docker.
set -euo pipefail

PASS=0
WARN=0
FAIL=0

ok()   { echo "  [OK]   $*"; PASS=$((PASS + 1)); }
warn() { echo "  [WARN] $*"; WARN=$((WARN + 1)); }
fail() { echo "  [FAIL] $*"; FAIL=$((FAIL + 1)); }

echo "=== pdfpilot home server — spec check ==="
echo

echo "--- Memory ---"
if command -v free >/dev/null 2>&1; then
  free -h
  MEM_GB=$(free -g | awk '/^Mem:/{print $2}')
  if [[ "${MEM_GB:-0}" -ge 8 ]]; then
    ok "RAM ${MEM_GB} GB (8+ recommended, 16 ideal)"
  elif [[ "${MEM_GB:-0}" -ge 4 ]]; then
    warn "RAM ${MEM_GB} GB — OCR/LibreOffice may be slow"
  else
    fail "RAM ${MEM_GB} GB — too low for this API"
  fi
else
  warn "free not found — install procps"
fi

echo
echo "--- Disk (root / SSD) ---"
df -h /
ROOT_AVAIL=$(df -BG / 2>/dev/null | awk 'NR==2{gsub(/G/,"",$4); print $4}' || df -h / | awk 'NR==2{print $4}')
ROOT_AVAIL_NUM=$(df -BG / 2>/dev/null | awk 'NR==2{gsub(/G/,"",$4); print $4}' || echo 0)
if [[ "${ROOT_AVAIL_NUM:-0}" -ge 50 ]] 2>/dev/null; then
  ok "Root filesystem has ${ROOT_AVAIL} free (50 GB+ recommended)"
else
  warn "Root has ${ROOT_AVAIL} free — Docker + LibreOffice need ~15 GB; keep 50 GB+ free"
fi

if [[ -d /var/lib/docker ]]; then
  DOCKER_ROOT=$(df -h /var/lib/docker 2>/dev/null | awk 'NR==2{print $6}' || echo "?")
  echo "  Docker data mount: ${DOCKER_ROOT}"
  if [[ "${DOCKER_ROOT}" == "/" ]] || [[ "${DOCKER_ROOT}" == "/var" ]]; then
    ok "Docker appears on same volume as root (prefer SSD)"
  else
    warn "Docker is on ${DOCKER_ROOT} — ensure it is the SSD, not a slow HDD"
  fi
fi

echo
echo "--- CPU ---"
if command -v lscpu >/dev/null 2>&1; then
  lscpu | grep -E 'Model name|CPU\(s\):' || lscpu
  ok "CPU info listed above"
elif command -v nproc >/dev/null 2>&1; then
  ok "CPU cores: $(nproc)"
else
  warn "lscpu/nproc not found"
fi

echo
echo "--- OS ---"
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  echo "  ${PRETTY_NAME:-unknown}"
  ok "OS identified"
else
  warn "/etc/os-release missing"
fi

echo
echo "--- Time (NTP) ---"
if command -v timedatectl >/dev/null 2>&1; then
  timedatectl status | head -5
  if timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -q yes; then
    ok "NTP synchronized"
  else
    warn "NTP may not be synced — fix before Razorpay webhooks"
  fi
else
  warn "timedatectl not found"
fi

echo
echo "--- Sleep / suspend ---"
if systemctl is-enabled sleep.target 2>/dev/null | grep -q enabled; then
  warn "sleep.target is enabled — disable suspend for a 24/7 server"
else
  ok "sleep.target not enabled (or unavailable)"
fi
if [[ -f /etc/systemd/logind.conf ]]; then
  if grep -qE '^HandleLidSwitch=suspend' /etc/systemd/logind.conf 2>/dev/null; then
    warn "Lid close may suspend — set HandleLidSwitch=ignore when plugged in"
  else
    ok "logind lid policy not set to suspend (or using defaults)"
  fi
fi

echo
echo "--- Network ---"
if command -v hostname >/dev/null 2>&1; then
  echo "  Hostname: $(hostname)"
fi
if command -v ip >/dev/null 2>&1; then
  echo "  LAN addresses:"
  ip -4 addr show scope global | awk '{print "    " $2}' || true
  ok "Reserve one LAN IP in your router (DHCP reservation)"
elif command -v hostname >/dev/null 2>&1; then
  echo "  $(hostname -I)"
fi

echo
echo "--- Summary ---"
echo "  Pass: ${PASS}  Warn: ${WARN}  Fail: ${FAIL}"
echo
if [[ "${FAIL}" -gt 0 ]]; then
  echo "Fix FAIL items before deploying the API."
  exit 1
fi
if [[ "${WARN}" -gt 0 ]]; then
  echo "Review WARN items. You can proceed for practice with caution."
  exit 0
fi
echo "System looks ready for Phase 2 (Docker)."
exit 0
