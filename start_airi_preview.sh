#!/bin/bash

# AIRI Tamagotchi - Production Preview Starter (macOS/Linux)
# Builds packages, builds the app, and previews the production bundle via electron-vite.

# Safeguard: prevent VS Code from forcing Electron into Node mode
unset ELECTRON_RUN_AS_NODE

# On Linux, disable Electron sandbox if needed for dev/preview environments
if [ "$(uname -s)" = "Linux" ]; then
  export ELECTRON_DISABLE_SANDBOX=1
fi

# Isolated User Data Directory routing
if [ -z "${AIRI_USER_DATA_DIR:-}" ]; then
  if [ "$(uname -s)" = "Darwin" ]; then
    ISOLATED_DIR="$HOME/Library/Application Support/ai.moeru.airi.dasilva333"
  else
    ISOLATED_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/ai.moeru.airi.dasilva333"
  fi
  if [ -d "$ISOLATED_DIR" ]; then
    export AIRI_USER_DATA_DIR="$ISOLATED_DIR"
  fi
fi

if [ -n "${AIRI_USER_DATA_DIR:-}" ]; then
  export APP_USER_DATA_PATH="$AIRI_USER_DATA_DIR"
  mkdir -p "$AIRI_USER_DATA_DIR"
fi

# Ensure workspace dependencies and binaries are installed
if [ ! -d "node_modules" ] || ! command -v pnpm exec turbo &> /dev/null; then
  echo "[0/3] Installing/updating project dependencies (pnpm install)..."
  pnpm install || { echo "Error: pnpm install failed."; exit 1; }
fi

# Ensure Stage-Mate companion runtime is available
if [ ! -d "apps/stage-mate/bin/StageMate.app" ] && [ ! -f "apps/stage-mate/bin/StageMate.x86_64" ] && [ ! -f "apps/stage-mate/bin/StageMate.exe" ]; then
  echo "[Stage-Mate] Prebuilt companion runtime not detected in apps/stage-mate/bin/. Fetching runtime..."
  pnpm -F @proj-airi/stage-mate run engine:fetch || echo "[Stage-Mate] Notice: Runtime fetch skipped. You can fetch later via 'pnpm run stage-mate:fetch'."
fi

echo "[1/3] Building packages..."
pnpm run build:packages

echo "[2/3] Building Tamagotchi production assets..."
pnpm -F @proj-airi/stage-tamagotchi run build

echo "[3/3] Starting Tamagotchi in Preview Mode..."
if [ -f "apps/stage-tamagotchi/electron.vite.config.local.ts" ]; then
  pnpm -F @proj-airi/stage-tamagotchi start --config electron.vite.config.local.ts -- "$@"
else
  pnpm -F @proj-airi/stage-tamagotchi start -- "$@"
fi
