#!/bin/bash
# Build script for StageMate Unity project

set -e

PROJECT_PATH="/Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-mate/mate-engine"
UNITY="/Applications/Unity/Hub/Editor/6000.2.6f2/Unity.app/Contents/MacOS/Unity"
LOG="/var/folders/wp/rgybj1l16wv8fgm2x6wg96zm0000gn/T/opencode/mate-build.log"

echo "=== Starting Unity build ==="
echo "Project: $PROJECT_PATH"
echo "Unity: $UNITY"
echo "Log: $LOG"

rm -f "$LOG"

"$UNITY" -batchmode -quit \
  -projectPath "$PROJECT_PATH" \
  -executeMethod MateSidecarBuild.Build \
  -logFile "$LOG" >/dev/null 2>&1 &

PID=$!
echo "Build started (PID: $PID)"

# Wait for completion
echo "Waiting for build to complete..."
while kill -0 $PID 2>/dev/null; do
    sleep 10
    # Show progress
    if grep -q "build succeeded\|build failed" "$LOG" 2>/dev/null; then
        break
    fi
done

wait $PID
EXIT_CODE=$?

echo ""
echo "=== Build Result ==="
if [ $EXIT_CODE -eq 0 ]; then
    grep -iE "build succeeded|build failed|Exiting batchmode" "$LOG" | tail -3
    if grep -q "build succeeded" "$LOG"; then
        echo "✓ BUILD SUCCEEDED"
        exit 0
    else
        echo "✗ BUILD FAILED"
        exit 1
    fi
else
    echo "✗ BUILD FAILED (exit code: $EXIT_CODE)"
    grep -iE "error CS[0-9]+|Scripts have compiler errors" "$LOG" | head -10
    exit 1
fi