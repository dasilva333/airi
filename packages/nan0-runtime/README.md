# Nan0 Runtime

This package contains Nan0's local-first cognition pipeline. AIRI supplies provider access and host events, while the runtime owns interpretation, identity, emotion, thought, speech decisions, continuity, goals, predictions, intentions, temporal autonomy, and persisted cognition state.

Speech decisions always reference a valid thought. Host code may enforce a prepared decision, but may not manufacture or rewrite cognition.

## Local commands

```bash
pnpm --filter @proj-airi/nan0-runtime typecheck
pnpm --filter @proj-airi/nan0-runtime test
pnpm --filter @proj-airi/nan0-runtime build
```

## Local observability

Nan0 diagnostics are disabled by default. Set `NAN0_DEBUG=true` before starting the Electron app to enable the local observatory. Console and JSONL output default to enabled once debugging is on; individual controls are:

```text
NAN0_DEBUG_CONSOLE=true
NAN0_DEBUG_JSONL=true
NAN0_DEBUG_PRIVATE_THOUGHTS=false
NAN0_DEBUG_VERBOSE=false
NAN0_DEBUG_LOG_DIR=logs
```

Relative log directories resolve beneath Electron's user-data directory. JSONL files are named `nan0-kernel-YYYY-MM-DD.jsonl`. Private narrative text remains excluded unless `NAN0_DEBUG_PRIVATE_THOUGHTS=true`; diagnostics never enter chat, TTS, rendering, or memory.

## Host ownership

The canonical AIRI boundary is `packages/stage-ui/src/stores/nan0.ts`. `Nan0HeartbeatEngine` is the only scheduler for Nan0 autonomy. The runtime deliberately exports no alternate callback or host-adapter seam.
