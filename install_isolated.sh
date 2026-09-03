#!/bin/bash
set -euo pipefail

# AIRI Fork (dasilva333) - Isolated Installation & Menubar Integration Script
# Sets up isolated storage, builds packages, and registers "AIRI (dasilva333)" in Freedesktop menubar / app launcher.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

ISOLATED_DATA_DIR="${AIRI_ISOLATED_DATA_DIR:-$HOME/.config/ai.moeru.airi.dasilva333}"
DEFAULT_PORT="${AIRI_ISOLATED_PORT:-5174}"
APP_ID="ai.moeru.airi.dasilva333"
APP_NAME="AIRI (dasilva333)"

echo "========================================================"
echo " [AIRI Fork] Isolated Installer & Menubar Registration"
echo "========================================================"
echo " App Name:       $APP_NAME"
echo " App ID:         $APP_ID"
echo " Workspace Root: $REPO_ROOT"
echo " Isolated Data:  $ISOLATED_DATA_DIR"
echo " Isolated Port:  $DEFAULT_PORT"
echo "========================================================"

# 1. Create isolated data directory
mkdir -p "$ISOLATED_DATA_DIR"
echo "[1/5] Isolated data directory ready at: $ISOLATED_DATA_DIR"

# 2. Install dependencies safely
echo "[2/5] Installing project dependencies..."
if [ ! -d "node_modules" ] || [ ! -d "node_modules/.bin" ]; then
  pnpm install --ignore-scripts || pnpm install
fi

# 3. Build workspace packages
echo "[3/5] Building workspace packages..."
pnpm run build:packages

# 4. Generate/Update start_airi_isolated.sh runner
cat << 'START_EOF' > "$REPO_ROOT/start_airi_isolated.sh"
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
START_EOF

chmod +x "$REPO_ROOT/start_airi_isolated.sh"
echo "[4/5] Created isolated runner: $REPO_ROOT/start_airi_isolated.sh"

# 5. Register in Freedesktop Menubar / Application Launcher
echo "[5/5] Registering '$APP_NAME' in Freedesktop Application Menu..."
ICON_TARGET_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
APPS_TARGET_DIR="$HOME/.local/share/applications"

mkdir -p "$ICON_TARGET_DIR" "$APPS_TARGET_DIR"

# Install application icon
if [ -f "$REPO_ROOT/apps/stage-tamagotchi/resources/icon-512.png" ]; then
  cp "$REPO_ROOT/apps/stage-tamagotchi/resources/icon-512.png" "$ICON_TARGET_DIR/$APP_ID.png"
elif [ -f "$REPO_ROOT/apps/stage-tamagotchi/resources/icon.png" ]; then
  cp "$REPO_ROOT/apps/stage-tamagotchi/resources/icon.png" "$ICON_TARGET_DIR/$APP_ID.png"
fi

# Generate .desktop file
DESKTOP_FILE="$APPS_TARGET_DIR/$APP_ID.desktop"
cat << DESKTOP_EOF > "$DESKTOP_FILE"
[Desktop Entry]
Name=$APP_NAME
Exec=$REPO_ROOT/start_airi_isolated.sh %U
Terminal=false
Type=Application
Icon=$APP_ID
StartupWMClass=AIRI
Comment=AIRI (dasilva333 fork) - Isolated development instance
Categories=Utility;Development;
DESKTOP_EOF

chmod +x "$DESKTOP_FILE"

# Refresh Freedesktop caches
if command -v update-desktop-database &>/dev/null; then
  update-desktop-database "$APPS_TARGET_DIR" || true
fi
if command -v gtk-update-icon-cache &>/dev/null; then
  gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
fi

echo "========================================================"
echo " Installation & Menubar Registration Complete!"
echo " - Desktop Entry: $DESKTOP_FILE"
echo " - App Title:     $APP_NAME"
echo " - Runner Script: $REPO_ROOT/start_airi_isolated.sh"
echo "========================================================"
