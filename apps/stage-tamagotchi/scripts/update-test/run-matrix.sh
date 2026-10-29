#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "==> Running AIRI OTA Update Test Matrix"
"${SCRIPT_DIR}/setup.sh"

cd "${APP_DIR}"
pnpm exec vitest run scripts/update-test/auto-updater.integration.test.ts
