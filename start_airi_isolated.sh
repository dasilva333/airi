#!/bin/bash
set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Prevent VS Code from forcing Node mode
unset ELECTRON_RUN_AS_NODE

# Linux Sandbox setup
if [ "$(uname -s)" = "Linux" ]; then
  export ELECTRON_DISABLE_SANDBOX=1
fi

# Isolated User Data Directory & Origin Port
export AIRI_USER_DATA_DIR="${AIRI_USER_DATA_DIR:-$HOME/.config/ai.moeru.airi.dasilva333}"
export APP_USER_DATA_PATH="$AIRI_USER_DATA_DIR"
mkdir -p "$AIRI_USER_DATA_DIR"

PORT_NUM="${AIRI_RENDERER_PORT:-5174}"
export AIRI_RENDERER_PORT="$PORT_NUM"

LOG_FILE="$AIRI_USER_DATA_DIR/airi-isolated.log"

echo "========================================================"
echo " Starting AIRI (dasilva333) in ISOLATED mode"
echo " User Data Dir: $AIRI_USER_DATA_DIR"
echo " Renderer Port: $AIRI_RENDERER_PORT"
echo " Log Location:  $LOG_FILE"
echo "========================================================"

# Fetch Stage-Mate companion runtime if needed
if [ ! -d "apps/stage-mate/bin/StageMate.app" ] && [ ! -f "apps/stage-mate/bin/StageMate.x86_64" ] && [ ! -f "apps/stage-mate/bin/StageMate.exe" ]; then
  pnpm -F @proj-airi/stage-mate run engine:fetch || true
fi

# Pass any extra arguments
{
  if [ -f "apps/stage-tamagotchi/electron.vite.config.local.ts" ]; then
    pnpm -F @proj-airi/stage-tamagotchi run dev --config electron.vite.config.local.ts -- "$@"
  else
    pnpm -F @proj-airi/stage-tamagotchi run dev -- "$@"
  fi
} 2>&1 | tee "$LOG_FILE"
