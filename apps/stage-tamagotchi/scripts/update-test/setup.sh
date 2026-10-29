#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
KEYS_DIR="$(cd "${APP_DIR}/../../.cache/keys" && pwd)"

echo "==> AIRI OTA Update Test Setup"

if [ ! -f "${KEYS_DIR}/updater.pkcs8.key" ]; then
  echo "Error: PKCS#8 signing key not found at ${KEYS_DIR}/updater.pkcs8.key"
  exit 1
fi

echo "✓ Verified PKCS#8 signing key exists"
echo "✓ Ready for simulation matrix tests"
