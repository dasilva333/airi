#!/bin/bash
# scripts/pr_summary.sh

# Check for required tools
if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) not installed. Please install it first."
  exit 1
fi

# Check for jq
if ! command -v jq &> /dev/null; then
  echo "Error: jq not installed. Please install it first."
  exit 1
fi

# Configuration
SRC_ROOT="/Users/richardpinedo/Projects.nosync/airi/airi_dasilva333"
OUTPUT_FILE="$SRC_ROOT/docs/archive/pr-summary.md"

# Clean output file
> "$OUTPUT_FILE"

# Get all PRs with number, title, and file count
pr_data=$(gh pr list --state=all --json "number,title,changedFiles" | jq -r '.[] | [(.number | tostring), (.title | @json | gsub("\""; "")), (.changedFiles | tostring)] | @tsv')

# Format as markdown table
echo "# Upstream PR Summary" > "$OUTPUT_FILE"
echo "| PR # | Files | Title |" >> "$OUTPUT_FILE"
echo "|------|-------|-------|" >> "$OUTPUT_FILE"

while IFS=$'\t' read -r pr_num title file_count; do
  if [[ -n "$title" && -n "$file_count" ]]; then
    echo "| $pr_num | $file_count | $title |" >> "$OUTPUT_FILE"
  fi
done <<< "$pr_data"