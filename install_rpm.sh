#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo "========================================================"
echo " [AIRI (dasilva333)] Building and Installing RPM Package"
echo "========================================================"

pnpm run build:packages
pnpm -F @proj-airi/stage-tamagotchi run build:rpm

RPM_FILE=$(ls -t "$REPO_ROOT/apps/stage-tamagotchi/dist/"*linux-x86_64.rpm 2>/dev/null | head -n 1 || true)

if [ -z "$RPM_FILE" ] || [ ! -f "$RPM_FILE" ]; then
  echo "Error: RPM package was not generated."
  exit 1
fi

echo "Installing $RPM_FILE..."
if command -v dnf &>/dev/null; then
  sudo dnf install -y "$RPM_FILE"
elif command -v zypper &>/dev/null; then
  sudo zypper install -y "$RPM_FILE"
else
  sudo rpm -Uvh "$RPM_FILE"
fi

echo "========================================================"
echo " Installation Complete!"
echo " AIRI (dasilva333) is now installed in your system."
echo " Launch it from your Application Menu or run: airi-dasilva333"
echo "========================================================"
