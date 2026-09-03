#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo "========================================================"
echo " [AIRI (dasilva333)] Building and Installing DEB Package"
echo "========================================================"

pnpm run build:packages
pnpm -F @proj-airi/stage-tamagotchi run build:deb

DEB_FILE=$(ls -t "$REPO_ROOT/apps/stage-tamagotchi/dist/"*linux-amd64.deb 2>/dev/null | head -n 1 || true)

if [ -z "$DEB_FILE" ] || [ ! -f "$DEB_FILE" ]; then
  echo "Error: DEB package was not generated."
  exit 1
fi

echo "Installing $DEB_FILE via sudo dpkg..."
sudo dpkg -i "$DEB_FILE"

echo "========================================================"
echo " Installation Complete!"
echo " AIRI (dasilva333) is now installed in your system."
echo " Launch it from your Application Menu or run: airi-dasilva333"
echo "========================================================"
