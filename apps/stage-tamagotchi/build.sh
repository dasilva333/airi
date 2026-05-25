#!/bin/bash
# AIRI Tamagotchi - Build script for Linux
# Usage: ./build.sh [--install]
#   --install   After building, run the install script locally

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[build]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }

# Check prerequisites
command -v pnpm >/dev/null 2>&1 || { error "pnpm is required but not installed. Run: npm install -g pnpm"; exit 1; }
command -v node >/dev/null 2>&1 || { error "Node.js is required but not installed."; exit 1; }

# Detect package manager for install script
detect_pkg_manager() {
  if command -v dpkg >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    echo "deb"
  elif command -v rpm >/dev/null 2>&1 && command -v dnf >/dev/null 2>&1; then
    echo "rpm"
  elif command -v rpm >/dev/null 2>&1 && command -v zypper >/dev/null 2>&1; then
    echo "rpm"
  else
    echo "unknown"
  fi
}

# Parse args
INSTALL_AFTER_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL_AFTER_BUILD=true ;;
    --help|-h)
      echo "Usage: ./build.sh [--install]"
      echo ""
      echo "Options:"
      echo "  --install   After building, run install.sh to install locally"
      echo "  --help, -h  Show this help"
      exit 0
      ;;
    *) error "Unknown option: $arg"; exit 1 ;;
  esac
done

# Step 1: Typecheck
log "Step 1/3: Running typecheck..."
pnpm run typecheck

# Step 2: Build the Electron app
log "Step 2/3: Building Electron app..."
pnpm run build

# Step 3: Package for Linux
log "Step 3/3: Packaging for Linux (deb + rpm)..."
pnpm run build:linux

# Find the built artifacts
DIST_DIR="$SCRIPT_DIR/dist"
DEB_FILE=$(find "$DIST_DIR" -maxdepth 1 -name "*.deb" -type f | sort -V | tail -1)
RPM_FILE=$(find "$DIST_DIR" -maxdepth 1 -name "*.rpm" -type f | sort -V | tail -1)

log "Build complete!"
echo ""

if [ -n "$DEB_FILE" ]; then
  log "DEB package: $DEB_FILE"
  ls -lh "$DEB_FILE"
fi
if [ -n "$RPM_FILE" ]; then
  log "RPM package: $RPM_FILE"
  ls -lh "$RPM_FILE"
fi

# Generate install.sh
log "Generating install.sh..."
INSTALL_SH="$SCRIPT_DIR/install.sh"

cat > "$INSTALL_SH" << 'INSTALLER_EOF'
#!/bin/bash
# AIRI Tamagotchi - Install script for Linux
# Usage: sudo ./install.sh [--uninstall]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_FILE="$SCRIPT_DIR/ai.moeru.airi.desktop"
ICON_FILE="$SCRIPT_DIR/resources/icon.png"
DIST_DIR="$SCRIPT_DIR/dist"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[install]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }

# Must be root for system-wide install
if [ "$EUID" -ne 0 ]; then
  error "Please run with sudo: sudo $0"
  exit 1
fi

# Detect package manager
detect_pkg_manager() {
  if command -v dpkg >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    echo "deb"
  elif command -v rpm >/dev/null 2>&1 && command -v dnf >/dev/null 2>&1; then
    echo "rpm"
  elif command -v rpm >/dev/null 2>&1 && command -v zypper >/dev/null 2>&1; then
    echo "rpm"
  else
    echo "unknown"
  fi
}

# Parse args
UNINSTALL=false
for arg in "$@"; do
  case "$arg" in
    --uninstall) UNINSTALL=true ;;
    --help|-h)
      echo "Usage: sudo ./install.sh [--uninstall]"
      echo ""
      echo "Options:"
      echo "  --uninstall   Remove AIRI from the system"
      echo "  --help, -h    Show this help"
      exit 0
      ;;
    *) error "Unknown option: $arg"; exit 1 ;;
  esac
done

# Uninstall
if [ "$UNINSTALL" = true ]; then
  log "Uninstalling AIRI..."
  PKG_MANAGER=$(detect_pkg_manager)

  case "$PKG_MANAGER" in
    deb)
      if dpkg -l | grep -q "^ii  ai.moeru.airi "; then
        apt-get remove -y ai.moeru.airi
        log "DEB package removed."
      else
        warn "DEB package not found installed."
      fi
      ;;
    rpm)
      if rpm -q ai.moeru.airi >/dev/null 2>&1; then
        dnf remove -y ai.moeru.airi 2>/dev/null || zypper remove -y ai.moeru.airi 2>/dev/null
        log "RPM package removed."
      else
        warn "RPM package not found installed."
      fi
      ;;
    *)
      warn "Could not detect package manager. You may need to uninstall manually."
      ;;
  esac

  # Remove desktop file
  rm -f /usr/share/applications/ai.moeru.airi.desktop
  rm -f /usr/share/icons/hicolor/512x512/apps/ai.moeru.airi.png
  update-desktop-database /usr/share/applications/ 2>/dev/null || true
  log "Desktop entry removed."
  log "Uninstall complete."
  exit 0
fi

# Install
PKG_MANAGER=$(detect_pkg_manager)
log "Detected package manager: $PKG_MANAGER"

# Find the package file
DEB_FILE=$(find "$DIST_DIR" -maxdepth 1 -name "*.deb" -type f | sort -V | tail -1)
RPM_FILE=$(find "$DIST_DIR" -maxdepth 1 -name "*.rpm" -type f | sort -V | tail -1)

case "$PKG_MANAGER" in
  deb)
    if [ -z "$DEB_FILE" ]; then
      error "No .deb package found in $DIST_DIR. Run build.sh first."
      exit 1
    fi
    log "Installing DEB package: $(basename "$DEB_FILE")"
    dpkg -i "$DEB_FILE" || apt-get install -f -y
    ;;

  rpm)
    if [ -z "$RPM_FILE" ]; then
      error "No .rpm package found in $DIST_DIR. Run build.sh first."
      exit 1
    fi
    log "Installing RPM package: $(basename "$RPM_FILE")"
    dnf install -y "$RPM_FILE" 2>/dev/null || zypper install -y "$RPM_FILE" 2>/dev/null || rpm -i "$RPM_FILE"
    ;;

  *)
    warn "Unknown package manager. Installing desktop file only."
    warn "You may need to manually install the package from $DIST_DIR"
    ;;
esac

# Install desktop file system-wide
if [ -f "$DESKTOP_FILE" ]; then
  log "Installing desktop entry..."
  cp "$DESKTOP_FILE" /usr/share/applications/ai.moeru.airi.desktop
  chmod 644 /usr/share/applications/ai.moeru.airi.desktop
fi

# Install icon
if [ -f "$ICON_FILE" ]; then
  log "Installing icon..."
  mkdir -p /usr/share/icons/hicolor/512x512/apps/
  cp "$ICON_FILE" /usr/share/icons/hicolor/512x512/apps/ai.moeru.airi.png
  chmod 644 /usr/share/icons/hicolor/512x512/apps/ai.moeru.airi.png
fi

# Update desktop database
update-desktop-database /usr/share/applications/ 2>/dev/null || true

log "Installation complete!"
log "You can now launch AIRI from your application menu or by running 'airi'."
INSTALLER_EOF

chmod +x "$INSTALL_SH"
log "install.sh generated at: $INSTALL_SH"

# Optionally run install
if [ "$INSTALL_AFTER_BUILD" = true ]; then
  log "Running install.sh..."
  echo ""
  sudo "$INSTALL_SH"
else
  echo ""
  log "To install locally, run: sudo ./install.sh"
  log "To uninstall later, run: sudo ./install.sh --uninstall"
fi
