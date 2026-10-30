#!/bin/bash

# AIRI Tamagotchi - Local Dev Starter (macOS/Linux)
# Use this for a simple, one-shot startup.

# Safeguard: prevent VS Code from forcing Electron into Node mode
unset ELECTRON_RUN_AS_NODE

# Prevent onnxruntime-node from attempting broken CUDA binary downloads on Linux
export ONNXRUNTIME_NODE_INSTALL_CUDA=skip

# On Linux, disable Electron sandbox if needed for dev environments
if [ "$(uname -s)" = "Linux" ]; then
  export ELECTRON_DISABLE_SANDBOX=1
fi

# Isolated User Data Directory routing
# If the isolated fork directory exists on disk (e.g. via pnpm data:migrate), use it automatically!
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

# Ensure workspace dependencies and binaries (turbo, electron-vite, tsx, etc.) are installed
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/turbo" ] || [ ! -f "node_modules/.bin/tsx" ]; then
  echo "[0/2] Installing/updating project dependencies (pnpm install)..."
  pnpm install || { echo "Error: pnpm install failed."; exit 1; }
fi

# Ensure Stage-Mate companion runtime is available
if [ ! -d "apps/stage-mate/bin/StageMate.app" ] && [ ! -f "apps/stage-mate/bin/StageMate.x86_64" ] && [ ! -f "apps/stage-mate/bin/StageMate.exe" ]; then
  echo "[Stage-Mate] Prebuilt companion runtime not detected in apps/stage-mate/bin/. Fetching runtime..."
  pnpm -F @proj-airi/stage-mate run engine:fetch || echo "[Stage-Mate] Notice: Runtime fetch skipped. You can fetch later via 'pnpm run stage-mate:fetch'."
fi

# Default to 5173. If your settings/model vanished after an update,
# try entering 5174 to recover your local storage from previous versions.
PORT_NUM=${AIRI_RENDERER_PORT:-}
if [ -z "$PORT_NUM" ]; then
  if [ -t 0 ]; then
    read -p "Enter port (default 5173): " PORT_NUM
  fi
fi
PORT_NUM=${PORT_NUM:-5173}

LOG_FILE="airi.log"
echo "Logging to $LOG_FILE"

{
  echo "[1/2] Building packages..."
  pnpm run build:packages

  echo "[2/2] Starting Tamagotchi on Port $PORT_NUM..."
  export AIRI_RENDERER_PORT=$PORT_NUM

  IS_PREVIEW=false
  # Check if disable-webgl-stage or preview is requested in arguments
  for arg in "$@"; do
    if [ "$arg" = "--preview" ] || [ "$arg" = "--prod" ]; then
      IS_PREVIEW=true
    fi
    if [ "$arg" = "--disable-webgl-stage" ]; then
      export AIRI_DISABLE_WEBGL_STAGE=true
    fi
  done

  if [ "$IS_PREVIEW" = "true" ]; then
      echo "Launching packaged preview mode (Ergosphere OTA Launcher active)..."
      pnpm -F @proj-airi/stage-tamagotchi run start
  # Try to use local config if it exists, otherwise use default
  elif [ -f "apps/stage-tamagotchi/electron.vite.config.local.ts" ]; then
      pnpm -F @proj-airi/stage-tamagotchi run dev --config electron.vite.config.local.ts -- "$@"
  else
      pnpm -F @proj-airi/stage-tamagotchi run dev -- "$@"
  fi
} 2>&1 | tee "$LOG_FILE"

