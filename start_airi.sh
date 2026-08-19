#!/bin/bash

# AIRI Tamagotchi - Local Dev Starter (macOS/Linux)
# Use this for a simple, one-shot startup.

# Safeguard: prevent VS Code from forcing Electron into Node mode
unset ELECTRON_RUN_AS_NODE

# Ensure workspace dependencies and binaries (turbo, electron-vite, etc.) are installed
if [ ! -d "node_modules" ] || ! command -v pnpm exec turbo &> /dev/null; then
  echo "[0/2] Installing/updating project dependencies (pnpm install)..."
  pnpm install || { echo "Error: pnpm install failed."; exit 1; }
fi

# Default to 5173. If your settings/model vanished after an update,
# try entering 5174 to recover your local storage from previous versions.
read -p "Enter port (default 5173): " PORT_NUM
PORT_NUM=${PORT_NUM:-5173}

LOG_FILE="airi.log"
echo "Logging to $LOG_FILE"

{
  echo "[1/2] Building packages..."
  pnpm exec turbo run build -F="./packages/*" || pnpm run build:packages

  echo "[2/2] Starting Tamagotchi on Port $PORT_NUM..."
  export AIRI_RENDERER_PORT=$PORT_NUM

  # Check if disable-webgl-stage is requested in arguments
  for arg in "$@"; do
    if [ "$arg" = "--disable-webgl-stage" ]; then
      export AIRI_DISABLE_WEBGL_STAGE=true
    fi
  done

  # Try to use local config if it exists, otherwise use default
  if [ -f "apps/stage-tamagotchi/electron.vite.config.local.ts" ]; then
      pnpm -F @proj-airi/stage-tamagotchi run dev --config electron.vite.config.local.ts -- "$@"
  else
      pnpm -F @proj-airi/stage-tamagotchi run dev -- "$@"
  fi
} 2>&1 | tee "$LOG_FILE"

