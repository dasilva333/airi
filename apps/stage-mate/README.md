# AIRI Stage-Mate

**Mate-Engine Sidecar Prototype** — A native Unity/VRM sidecar for AIRI that renders VRM avatars and communicates with the AIRI Electron app over WebSocket.

## Architecture

- **Harness** (Node/TypeScript) — Mock WebSocket server on `ws://localhost:6171` that simulates AIRI's `server-runtime` protocol. Sends `stage:vrm:load`, `stage:vrm:idle`, `ping`.
- **Mate-Engine** (Unity/C#) — Native macOS app (`StageMate.app`) that loads VRM models, plays idle animations, handles drag mode, and communicates with the harness over WebSocket.

## Quick Start

### Prerequisites
- Node.js + pnpm (for harness)
- Unity 6000.2.6f2 + Mac Standalone Support module (for building)
- macOS (tested on 26.x)

### Run the Harness (Terminal 1)

```bash
cd /Users/richardpinedo/Projects.nosync/airi/airi_dasilva333
pnpm -F @proj-airi/stage-mate harness
```

Expected output:
```
[harness] listening on ws://localhost:6171
[harness] model paths: /path/to/test-model.vrm
[harness] idle animations: PET_IDLE 1
```

Optional environment variables:
```bash
MATE_MODEL_PATH=/path/to/model.vrm          # Model to load (default: test-model.vrm)
MATE_MODEL_PATH_2=/path/to/second.vrm       # Optional second model for ping-pong
MATE_MODEL_SWAP_MS=30000                    # Swap interval in ms (default: 30000)
MATE_IDLE_ANIMATIONS="PET_IDLE 1,PET_IDLE 2" # Idle animation pool
MATE_HARNESS_PORT=6171                      # WebSocket port (default: 6171)
MATE_MODEL_SWAP_MS=30000                    # Auto-swap interval
```

### Launch the App (Terminal 2)

```bash
open /Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-mate/mate-engine/Build/StageMate.app
```

Or run directly for console output:
```bash
/Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-mate/mate-engine/Build/StageMate.app/Contents/MacOS/MateEngineX
```

### Controls

| Key | Action |
|-----|--------|
| **D** | Toggle **Drag Mode** (click-drag to move model on ground plane) |
| **Mouse drag** | In drag mode: click-drag anywhere to move model on ground plane |
| **Mouse drag (no D)** | Orbit camera around model |
| **Scroll wheel** | Zoom in/out |
| **Mouse hover top-right** | Click ◉ icon for size presets (mini/med/large) |

### Visual Indicators

Top-left status dot:
- **Red** = Disconnected from harness
- **Green** = Connected to harness
- **Yellow blink** = Received message from harness (ping/activity)

Top-left text shows:
- Connection status
- Current model filename
- Current idle animation
- "drag to orbit / scroll to zoom" hint

### Configuration

Environment variables (can be set in shell before launch):

| Variable | Default | Description |
|----------|---------|-------------|
| `MATE_MODEL_PATH` | `../test-model.vrm` | Primary VRM file path |
| `MATE_MODEL_PATH_2` | (none) | Optional second model for ping-pong |
| `MATE_MODEL_SWAP_MS` | `30000` | Auto-swap interval (ms) |
| `MATE_IDLE_ANIMATIONS` | (none) | Comma-separated idle animation names |
| `MATE_HARNESS_PORT` | `6171` | WebSocket server port |

### Window Size Persistence

Window size is saved to `PlayerPrefs` (`stage-mate-window-size`) and restored on launch. Default: **Medium (450×600)**. Change via ◉ eye icon in top-right corner.

### Build from Source

```bash
cd /Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-mate/mate-engine
/Applications/Unity/Hub/Editor/6000.2.6f2/Unity.app/Contents/MacOS/Unity \
  -batchmode -quit \
  -projectPath . \
  -executeMethod MateSidecarBuild.Build
```

Output: `Build/StageMate.app`

### Wire Protocol (v0)

Server → Engine:
```json
{ "type": "stage:vrm:load", "data": { "modelPath": "/abs/path/to/model.vrm" } }
{ "type": "stage:vrm:idle", "data": { "idleAnimations": ["PET_IDLE 1", "PET_IDLE 2"] } }
{ "type": "ping", "data": { "t": 1234567890 } }
```

Engine → Harness:
```json
{ "type": "stage:vrm:ready", "data": { "modelPath": "/path/to/model.vrm" } }
```

### Project Structure

```
apps/stage-mate/
├── README.md                    # This file
├── package.json                 # pnpm workspace package
├── harness/
│   └── index.ts                 # WebSocket mock harness
├── test-model.vrm               # VRM 0.x test model (gitignored)
├── test-model-2.vrm             # Second test model (gitignored)
└── mate-engine/                 # Unity project (gitignored)
    ├── Assets/StageMate/
    │   ├── MateSidecar.cs        # Runtime: WS client, VRM loader, drag, idle, orbit
    │   ├── MateSidecarBuild.cs   # Editor build script
    │   └── Editor/MateSidecarBuild.cs
    └── Build/StageMate.app      # Built app (gitignored)
```

### Troubleshooting

| Issue | Fix |
|-------|-----|
| `EADDRINUSE: address already in use` | `lsof -ti:6171 \| xargs kill -9` |
| App won't launch | Check `~/Library/Logs/Shinymoon/MateEngineX/Player.log` |
| Model not loading | Verify `.vrm` path exists; check Player.log for errors |
| Port 6171 in use | `lsof -ti:6171 \| xargs kill -9` |
| Window doesn't resize | Check `~/Library/Logs/Shinymoon/MateEngineX/Player.log` |

### Key Files

| Path | Purpose |
|------|---------|
| `harness/index.ts` | WebSocket mock server |
| `Assets/StageMate/MateSidecar.cs` | Unity runtime: WS client, VRM loader, drag, idle, orbit |
| `Assets/StageMate/MateSidecarBuild.cs` | Editor build script |
| `docs/idle-animation-design.md` | Idle animation system design |
| `docs/engine-sidecar-journal.md` | Full design journal |
| `design-actor-stage.md` | Actor Stage UX reference |

---

**Status**: Phase 0 prototype complete — VRM loading, idle animations, drag mode, orbit controls, size presets, window persistence all working. Ready for expression relay and IndexedDB model loading discussion.
