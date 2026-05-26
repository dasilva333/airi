#!/usr/bin/env bash
# check-vue-type-imports.sh
# Prevents type-only imports of .vue components that are used in <template>.
# In Vue SFCs with <script setup>, a component imported with `import type`
# is erased at runtime, causing "Failed to resolve component" errors in builds.
#
# Usage: ./scripts/check-vue-type-imports.sh [file-or-directory ...]
# If no arguments, checks the entire repo (excluding node_modules, dist, etc.)

set -euo pipefail

# Default: search all .vue and .ts files if no args provided
if [ $# -eq 0 ]; then
  # Use git ls-files to respect .gitignore
  FILES=$(git ls-files -- '*.vue' '*.ts' '*.tsx')
else
  FILES="$*"
fi

ERRORS=0

for file in $FILES; do
  # Skip non-existent files (e.g., deleted in working tree)
  [ -f "$file" ] || continue

  # Find lines with `import type` that import .vue files
  # Matches: import type X from './Y.vue'  OR  import { type X } from './Y.vue'
  # Also matches: import type { X } from './Y.vue'
  matches=$(grep -nE 'import\s+(type\s+.*from\s+.*\.vue|.*\{[^}]*type\s+[^}]*\}.*from\s+.*\.vue)' "$file" 2>/dev/null || true)

  if [ -n "$matches" ]; then
    # For .vue files, check if the imported component name is used in <template>
    # For .ts files that re-export, we still flag it as a warning
    if [[ "$file" == *.vue ]]; then
      while IFS= read -r line; do
        linenum=$(echo "$line" | cut -d: -f1)
        importline=$(echo "$line" | cut -d: -f2-)

        # Extract the imported component name(s)
        # Handles: import type Foo from '...'  |  import type { Foo } from '...'
        #          import { type Foo } from '...'  |  import { type Foo, type Bar } from '...'
        names=$(echo "$importline" | sed -E \
          -e "s/.*import\s+type\s+([a-zA-Z0-9_]+).*/\1/" \
          -e "s/.*import\s*\{[^}]*type\s+([a-zA-Z0-9_]+).*/\1/" \
          -e "s/.*import\s+type\s*\{\s*([a-zA-Z0-9_]+).*/\1/" \
        )

        for name in $names; do
          # Skip if it's clearly a type-only usage (not a component)
          # Check if the name is used as a tag in <template>
          if grep -qE "<${name}[[:space:]/>]" "$file" 2>/dev/null; then
            echo "ERROR: $file:$linenum — '$name' is imported as type-only but used as a component in <template>"
            echo "  $importline"
            ERRORS=$((ERRORS + 1))
          fi
        done
      done <<< "$matches"
    fi
  fi
done

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Found $ERRORS type-only import(s) of Vue components that are used in <template>."
  echo "These will cause 'Failed to resolve component' errors in production builds."
  echo "Fix: Change 'import type' to 'import' for components used in templates."
  exit 1
fi

echo "OK: No type-only imports of Vue components in templates found."
exit 0
