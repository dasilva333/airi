# Stage-Mate Project Structure & Source Overlay Architecture

This document describes how `@proj-airi/stage-mate` separates **custom AIRI C# code (tracked in Git)** from the **raw upstream Mate-Engine Unity project (gitignored to prevent repository bloat)**.

---

## 🏛️ Architecture Overview

The raw [`shinyflvre/Mate-Engine`](https://github.com/shinyflvre/Mate-Engine) repository contains 500MB+ of binary 3D assets, textures, animations, and precompiled DLLs. To keep the AIRI monorepo lightweight (<30KB footprint) and avoid binary merge churn:

1. **`unity-src/` (TRACKED IN GIT)**:
   - Contains **only** AIRI-specific C# scripts, editor tools, and controllers.
   - Fully version-controlled, diffable in pull requests, and editable directly.
2. **`mate-engine/` (GITIGNORED)**:
   - Contains the local clone of upstream Mate-Engine.
   - Excluded from Git and `pnpm-workspace.yaml`.
3. **`scripts/setup.ts` (THE OVERLAY BRIDGE)**:
   - Clones upstream `Mate-Engine` if missing.
   - Copies / overlays `unity-src/` $\rightarrow$ `mate-engine/Assets/StageMate/`.
   - Automatically executes before any `pnpm build` command.

---

## 📂 Directory Layout

```
apps/stage-mate/
├── unity-src/                        <-- [TRACKED IN GIT] Custom AIRI Unity C# Code
│   ├── MateSidecar.cs                # Runtime: WebSocket client, VRM loader, idle cycle, viewport
│   └── Editor/
│       └── MateSidecarBuild.cs       # Editor: Scene setup, idle catalog generator, batch builds
│
├── harness/                          <-- [TRACKED IN GIT] Headless mock WS server & TUI control center
│   └── index.ts                      # Listens on ws://localhost:6171
│
├── scripts/                          <-- [TRACKED IN GIT] Toolchain & build scripts
│   ├── setup.ts                      # Clones upstream + overlays unity-src/ into Assets/StageMate/
│   └── build.ts                      # Batch build runner (Win .exe, Linux .x86_64, macOS .app)
│
├── project-structure.md              <-- This file
├── README.md                         # Quickstart & wire protocol documentation
├── package.json                      # Package scripts (setup, harness, build:win, build:linux, build:mac)
│
└── mate-engine/                      <-- [GITIGNORED] Local Unity Project (Unity 6000.2.6f2)
    ├── Assets/
    │   ├── StageMate/                <-- Generated/overlaid by setup.ts from unity-src/
    │   │   ├── MateSidecar.cs
    │   │   └── Editor/
    │   │       └── MateSidecarBuild.cs
    │   └── ... (Upstream assets, shaders, animations)
    └── Build/                        <-- [GITIGNORED] Compiled binaries
        ├── Windows/StageMate.exe
        ├── Linux/StageMate.x86_64
        └── StageMate.app
```

---

## 🔄 Instructions for macOS / Secondary Dev Environments

If you developed or modified C# scripts inside your local `apps/stage-mate/mate-engine/Assets/StageMate/` folder on another machine (e.g. Mac), here is how to sync your work back into version control:

### 1. Copy local C# modifications into `unity-src/`:
```bash
# From the root of airi monorepo:
cp -R apps/stage-mate/mate-engine/Assets/StageMate/* apps/stage-mate/unity-src/
```

### 2. Verify Git detects the C# changes:
```bash
git status apps/stage-mate/unity-src/
git diff apps/stage-mate/unity-src/
```

### 3. Commit and push the C# changes:
```bash
git add apps/stage-mate/unity-src/
git commit -m "feat(stage-mate): update StageMate C# runtime and build scripts"
```

---

## 🛠️ Developer Workflow Commands

| Command | Purpose |
|---|---|
| `pnpm -F @proj-airi/stage-mate engine:setup` | Clones upstream `mate-engine` (if absent) and syncs `unity-src/` $\rightarrow$ `Assets/StageMate/` |
| `pnpm -F @proj-airi/stage-mate harness` | Starts the interactive WebSocket mock harness on `ws://localhost:6171` |
| `pnpm -F @proj-airi/stage-mate build:win` | Compiles Windows Standalone 64-bit binary (`Build/Windows/StageMate.exe`) |
| `pnpm -F @proj-airi/stage-mate build:linux` | Compiles Linux Standalone 64-bit binary (`Build/Linux/StageMate.x86_64`) |
| `pnpm -F @proj-airi/stage-mate build:mac` | Compiles macOS Standalone application (`Build/StageMate.app`) |
| `pnpm -F @proj-airi/stage-mate build:all` | Compiles Windows, Linux, and macOS targets sequentially |
