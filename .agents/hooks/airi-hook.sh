#!/usr/bin/env bash
# AIRI Code Assistant Notification Hook for Antigravity & Claude Code
set -e

EVENT="${1:-unknown}"
STATE="${2:-work}"
HEADLINE="${3:-Coding Assistant Activity}"
TOKEN="08752879-4087-47ff-8692-b3cfd44c5d1c"
PORT="${AIRI_PORT:-6121}"
LOG_FILE="/tmp/airi-assistant-hook.log"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Log event trigger
echo "[${TIMESTAMP}] [Hook:${EVENT}] Triggered -> state=${STATE}, headline=\"${HEADLINE}\"" >> "${LOG_FILE}"

# Read any stdin input quietly (Antigravity passes JSON context over stdin)
STDIN_DATA=""
if [ ! -t 0 ]; then
  STDIN_DATA=$(cat 2>/dev/null || true)
fi

# Send state update to AIRI H3 REST endpoint
HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://127.0.0.1:${PORT}/api/assistant/state" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"source\":\"antigravity\",\"state\":\"${STATE}\",\"headline\":\"${HEADLINE}\"}" 2>&1 || true)

HTTP_CODE=$(echo "${HTTP_RESPONSE}" | tail -n1)
HTTP_BODY=$(echo "${HTTP_RESPONSE}" | sed '$d')

echo "[${TIMESTAMP}] [Hook:${EVENT}] Response HTTP ${HTTP_CODE}: ${HTTP_BODY}" >> "${LOG_FILE}"

# Output mandatory protocol JSON response for Antigravity lifecycle hooks
if [ "${EVENT}" = "PreToolUse" ]; then
  echo '{"decision":"allow"}'
else
  echo '{}'
fi
