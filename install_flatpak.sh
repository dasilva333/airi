#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo "========================================================"
echo " [AIRI (dasilva333)] Building and Installing Flatpak"
echo "========================================================"

if ! command -v flatpak-builder &>/dev/null; then
  echo "Error: flatpak-builder is not installed. Please install it via: sudo apt install flatpak-builder"
  exit 1
fi

pnpm run build:packages
pnpm -F @proj-airi/stage-tamagotchi run build:flatpak

echo "========================================================"
echo " Flatpak Installation Complete!"
echo " Launch it from your Application Menu or run: flatpak run ai.moeru.airi.dasilva333"
echo "========================================================"
