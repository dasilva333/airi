#!/bin/bash
# AIRI Tamagotchi - Build script for Linux
# Usage: ./build.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[build]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }

command -v pnpm >/dev/null 2>&1 || { error "pnpm is required. Run: npm install -g pnpm"; exit 1; }
command -v node >/dev/null 2>&1 || { error "Node.js is required."; exit 1; }

# Step 1: Typecheck
log "Step 1/3: Running typecheck..."
pnpm run typecheck

# Step 2: Build the Electron app
log "Step 2/3: Building Electron app..."
pnpm run build

# Step 3: Package for Linux
log "Step 3/3: Packaging for Linux (deb)..."
pnpm run build:linux

# Find the built artifacts
DIST_DIR="$SCRIPT_DIR/dist"
DEB_FILE=$(find "$DIST_DIR" -maxdepth 1 -name "*.deb" -type f | sort -V | tail -1)

log "Build complete!"
echo ""

if [ -n "$DEB_FILE" ]; then
  log "DEB package: $DEB_FILE"
  ls -lh "$DEB_FILE"
else
  error "No .deb package found."
  exit 1
fi

# Copy PKGBUILD and deb into pkgbuild directory for Arch Linux users
PKGBUILD_DIR="$SCRIPT_DIR/pkgbuild"
mkdir -p "$PKGBUILD_DIR"
cp "$SCRIPT_DIR/PKGBUILD" "$PKGBUILD_DIR/"
cp "$DEB_FILE" "$PKGBUILD_DIR/"

log "Arch Linux:  cd $PKGBUILD_DIR && makepkg -si"
log "Debian/Ubuntu: sudo dpkg -i $DEB_FILE"
