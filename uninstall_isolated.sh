#!/bin/bash
set -euo pipefail

# AIRI Fork (dasilva333) - Isolated Menubar Entry Removal Script

APP_ID="ai.moeru.airi.dasilva333"
DESKTOP_FILE="$HOME/.local/share/applications/$APP_ID.desktop"
ICON_FILE="$HOME/.local/share/icons/hicolor/512x512/apps/$APP_ID.png"

echo "Removing AIRI (dasilva333) menubar entry..."
rm -f "$DESKTOP_FILE"
rm -f "$ICON_FILE"

if command -v update-desktop-database &>/dev/null; then
  update-desktop-database "$HOME/.local/share/applications" || true
fi
if command -v gtk-update-icon-cache &>/dev/null; then
  gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
fi

echo "Removed '$APP_ID' desktop entry and icon."
