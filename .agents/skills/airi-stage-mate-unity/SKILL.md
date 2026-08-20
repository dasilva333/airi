---
name: airi-stage-mate-unity
description: Use when working with Stage-Mate, the Unity/VRM native sidecar of the AIRI Electron app (apps/stage-mate): the workspace-purity rule (never edit or reset mate-engine/ directly; all custom code lives in unity-src/ and is overlaid by scripts/setup.ts), the pinned upstream Mate-Engine commit in CANONICAL_MATE_ENGINE_COMMIT, the harness WebSocket mock on ws://localhost:6171, the stage:vrm wire protocol, the C# sidecar runtime under unity-src/Assets/StageMate/ (StageMateSocket, StageMateBridge, StageMateStateSync, VRM model drivers, companion/tactile systems, camera/viewport rig, shadow rig), upstream patches under unity-src/Patches/, Unity batch builds via scripts/build.ts and MateSidecarBuild, runtime logging (stagemate-runtime.log vs deep Player.log), and platform-specific UniWindowController transparency behavior (macOS hit-test vs Windows opacity thresholds).
---

# AIRI Stage-Mate (Unity Sidecar)

Stage-Mate is a native **Unity 6000.2.6f2 / VRM sidecar** that renders the AIRI avatar as a transparent desktop pet window and talks to the AIRI app over a WebSocket protocol. The Unity project is a **clone of the upstream `shinyflvre/Mate-Engine` repo**, with AIRI-specific code layered on top as a **source overlay**.

---

## 1. The Workspace Purity Rule (most important section)

```
apps/stage-mate/
├── unity-src/        <-- [TRACKED IN GIT] ALL custom AIRI code lives here. EDIT HERE.
│   ├── Assets/StageMate/       # Core sidecar (socket, bridge, state sync, model drivers, ...)
│   ├── Assets/StreamingAssets/ # Mock config stubs (LLMManager.json etc.)
│   ├── Patches/                # Overrides for upstream "MATE ENGINE - Scripts"/ etc.
│   ├── Packages/               # Overrides for upstream "MATE ENGINE - Packages"/
│   ├── ProjectSettings/        # Standalone build settings (scene 0 = MateSidecarScene)
│   └── build.sh                # macOS batchmode build convenience script
├── harness/          <-- [TRACKED] Mock WebSocket server (ws://localhost:6171)
├── scripts/          <-- [TRACKED] setup.ts / clean.ts / build.ts / logs.ts
└── mate-engine/      <-- [GITIGNORED] Local upstream Mate-Engine clone. PRISTINE. NEVER EDIT.
```

**Hard rules:**

1. **Never directly create, edit, or mutate any file inside `apps/stage-mate/mate-engine/`.** It is a gitignored upstream clone that must remain pristine. This includes letting the Unity Editor auto-save assets/scenes into it as part of a commit-intended change — such changes belong in `unity-src/`.
2. **All Stage-Mate code changes go into `apps/stage-mate/unity-src/`**:
   - Custom assets/scripts: `unity-src/Assets/StageMate/...` or `unity-src/Assets/StreamingAssets/...`
   - Upstream script overrides: `unity-src/Patches/<dir>/<File>.cs` (mirrors `mate-engine/Assets/MATE ENGINE - Scripts/` layout)
   - Upstream package overrides: `unity-src/Packages/<...>` (mirrors `mate-engine/Assets/MATE ENGINE - Packages/`)
   - Project settings: `unity-src/ProjectSettings/`
3. **Pinned upstream commit:** `shinyflvre/Mate-Engine@2c5ea6b8f4cf5e1773a0816b46d9267cda5174d4` ("Prepare 3.4 Features"), defined as `CANONICAL_MATE_ENGINE_COMMIT` in `apps/stage-mate/scripts/setup.ts`. Do not rebump it casually.
4. **`mate-engine/` is NOT part of the pnpm workspace** — its `package.json` belongs to the upstream Unity project.
5. **Python/C#-editor auto-generated churn** (`.csproj`, `*.dwlt`, `UserSettings/`, `UMotionData/` backups, `uWindowCapture.log`, csproj sln files) lives under `mate-engine/` and is ignored — never copy it back into `unity-src/`.

## 2. The Overlay Bridge

`scripts/setup.ts` (`pnpm -F @proj-airi/stage-mate run engine:setup`) is the ONLY thing allowed to write into `mate-engine/`:

1. If `mate-engine/` is missing: `git clone https://github.com/shinyflvre/Mate-Engine.git` and `git checkout CANONICAL_MATE_ENGINE_COMMIT`.
2. Overlay `unity-src/Assets/` → `mate-engine/Assets/` (recursive, forced).
3. Overlay `unity-src/Patches/` → `mate-engine/Assets/MATE ENGINE - Scripts/`.
4. Overlay `unity-src/Packages/` → `mate-engine/Assets/MATE ENGINE - Packages/`.
5. Overlay `unity-src/ProjectSettings/` → `mate-engine/ProjectSettings/`.
6. Deterministic post-processing (also only allowed to touch `mate-engine/`):
   - Sync Macaron materials → `Assets/Resources/Materials/`
   - `patchMacCompatibility()` — macOS framebuffer alpha + strip conflicting `#if UNITY_STANDALONE_WIN` struct wraps in `AvatarWindowHandler.cs`
   - `patchSettingsMenuUI()` — regex-surgery on `Mate Engine Main.unity` to disable Steam/DLC/AI/Minecraft/Food promo cards, shift DEBUG section, resize scroll content, force `WindowAPI`/`MenuActions` active, disable UniWindowController hit-test on macOS
7. **If you need a new deterministic tweak to upstream files, add it to `setup.ts`'s overlay steps — or mirror the whole file into `unity-src/Patches/`. Do not hand-edit the clone.**

`scripts/clean.ts` (`engine:clean`) resets the clone: `git -C mate-engine reset --hard <canonical>` + `git clean -fd`. Note: AGENTS.md's general "never reset --hard" rule applies to the AIRI repo; this is the sanctioned local equivalent for the gitignored upstream clone.

## 3. Common Workflows

| Task | Command |
|---|---|
| Initialize workspace (clone upstream if missing) + overlay `unity-src/` | `pnpm -F @proj-airi/stage-mate run engine:setup` |
| Reset clone to pristine canonical state | `pnpm -F @proj-airi/stage-mate run engine:clean` |
| Run the mock WS harness (port 6171) | `pnpm -F @proj-airi/stage-mate run harness` |
| Build Windows / Linux / macOS / all | `pnpm -F @proj-airi/stage-mate run build:win` / `build:linux` / `build:mac` / `build:all` |
| Build ORIGINAL unpatched Windows target | `pnpm -F @proj-airi/stage-mate run build:original` (uses `MateSidecarBuild.BuildOriginalWindows`) |
| Tail runtime log (`mate-engine/Build/stagemate-runtime.log`) | `pnpm -F @proj-airi/stage-mate run logs` |
| Tail deep Unity `Player.log` | `pnpm -F @proj-airi/stage-mate run logs:deep` |
| Clear both logs | `pnpm -F @proj-airi/stage-mate run logs:clean` |
| Typecheck harness/scripts TS | `pnpm -F @proj-airi/stage-mate typecheck` |

- `build.ts` automatically calls `setupMateEngine()` before invoking Unity, so builds always pick up `unity-src/` changes. Unity is located via `$UNITY_PATH` or hard-coded Hub paths (Unity **6000.2.6f2**).
- Builds are emitted into `mate-engine/Build/` (`Windows/StageMate.exe`, `Linux/StageMate.x86_64`, `StageMate.app`) via `MateSidecarBuild` execute-methods.
- **Player.log locations** (deep logging): `%USERPROFILE%\AppData\LocalLow\Shinymoon\MateEngineX\Player.log` (Win), `~/Library/Logs/Shinymoon/MateEngineX/Player.log` (macOS), `~/.config/unity3d/Shinymoon/MateEngineX/Player.log` (Linux).

## 4. Wire Protocol (v0)

Transport: WebSocket, default `ws://localhost:6171` (`MATE_HARNESS_PORT`).

Server → Engine:

```json
{ "type": "stage:vrm:load", "data": { "modelPath": "/abs/path/to/model.vrm" } }
{ "type": "stage:vrm:idle", "data": { "idleAnimations": ["PET_IDLE 1", "PET_IDLE 2"] } }
{ "type": "ping", "data": { "t": 1234567890 } }
```

Engine → Server:

```json
{ "type": "stage:vrm:ready", "data": { "modelPath": "/path/to/model.vrm" } }
```

Harness env vars: `MATE_MODEL_PATH`, `MATE_MODEL_PATH_2` (ping-pong), `MATE_MODEL_SWAP_MS`, `MATE_IDLE_ANIMATIONS`, `MATE_HARNESS_PORT`.

## 5. Key C# Source Map (`unity-src/Assets/StageMate/`)

| File | Role |
|---|---|
| `Core/StageMateSocket.cs` | WebSocket client (connect, reconnect, message dispatch) |
| `Core/StageMateBridge.cs` | Central orchestrator: wires socket → UniWindowController + VRMLoader + telemetry; platform window config |
| `Core/StageMateProtocol.cs` | Wire protocol types/enums |
| `Core/StageMateStateSync.cs` | State synchronization with AIRI |
| `Models/IStageModelDriver.cs` / `VrmModelDriver.cs` / `VrmSwayDriver.cs` | VRM model loading + physics/sway |
| `Window/StageMateWindowManager.cs` / `StageMateShadowRig.cs` | Transparent window + shadow rendering |
| `Viewport/StageMateCameraRig.cs` / `StageMateViewportController.cs` | Camera/orbit/viewport |
| `Companion/StageMateLocomotion.cs` / `StageMateTactileHandler.cs` / `StageMatePlushBed.cs` | Petting/locomotion interactions |
| `MateSidecar.cs` | Legacy standalone runtime kept for reference |
| `MateSidecarBuild.cs` (+`Editor/`) | Batch build entry points (`Build`, `BuildWindows`, `BuildLinux`, `BuildMac`, `BuildOriginalWindows`, `BuildAll`) |
| `MateSidecarScene.unity` | Scene 0 — the companion scene loaded in sidecar mode |

**Window transparency (in `StageMateBridge.cs`):**
- macOS (`UNITY_STANDALONE_OSX`): `isHitTestEnabled = false`, default window `768×512`, topmost + alpha transparent
- Windows/other: `isHitTestEnabled = true` with `HitTestType.Opacity`, threshold `0.05f`
- Also sets `SaveLoadHandler.Instance.data.tutorialDone = true` to unlock companion interactions and suppresses standalone menus in sidecar mode.

## 6. Validation & Status Reporting

- TypeScript changes (harness/scripts only): `pnpm -F @proj-airi/stage-mate typecheck`.
- C# changes: no TS typecheck covers them — validate via `pnpm -F @proj-airi/stage-mate run build:<target>` (Unity batchmode compile) or open the project in Unity; check `mate-engine/Build/build.log` + `logs:runtime` / `logs:deep` output.
- After any file modification: run `git status` and report open/unstaged files verbatim. Expect `mate-engine/` and `Build/` contents to be gitignored — they should NOT appear in status. If they do, stop and report it.
- Commit scope: only `unity-src/`, `harness/`, `scripts/`, `package.json`-level files ever appear in diffs. The `.cs`/`.unity`/`.anim`/`.controller` assets under `unity-src/` are tracked; never add large binary VRM/test models to git.

## 7. Common Pitfalls

- **"Editing the engine to test something", then forgetting to sync back.** If you ever found yourself editing inside `mate-engine/Assets/StageMate/` directly (e.g. in the Unity Editor), copy the correct file back into `unity-src/` **before committing** (`cp -R` mirroring the layout), then re-run `engine:setup` to confirm determinism.
- **Patches layout mismatch.** `unity-src/Patches/` paths mirror `Assets/MATE ENGINE - Scripts/` subtree, NOT `Assets/Patches/`. Getting the mirror path wrong means setup overlays into the wrong location and the upstream file stays unpatched.
- **Overwriting a patched upstream file by accident.** An overlay copies with `force: true`. If you delete a file from `unity-src/`, the stale copy inside `mate-engine/` survives until you run `engine:clean` — don't assume the clone matches `unity-src/` after deletions.
- **Skipping `engine:setup` before opening in Unity.** The Unity project will not compile AIRI code until the overlay has run.
- **Port 6171 busy** (`EADDRINUSE`): kill the old harness (`lsof -ti:6171 | xargs kill -9` on Unix; `Get-Process`/`Stop-Process` on Windows) or set `MATE_HARNESS_PORT`.
- **Assuming macOS-only behavior.** Hit-testing, window sizing, and `preserveFramebufferAlpha` are platform-branched — test on the target build platform or at least read the `#if` branches.

## See Also

- [`AGENTS.md`](AGENTS.md) "Stage-Mate & Unity Workspace Purity" section — canonical source of the purity rule.
- `apps/stage-mate/README.md` — quickstart + wire protocol reference.
- `apps/stage-mate/project-structure.md` — overlay architecture + cross-machine sync workflow.
- `docs/mate-engine-navigation-guide.md` — canonical navigation manual (scene-tree.ts CLI, Unity YAML anatomy, workspace-purity recap).
- `docs/stagemate-companion-runtime-distribution.md` — prebuilt companion runtime distribution (GitHub Releases fetch, `bin/` layout).
- `docs/rosetta-stone.md` §14 — repository directory map.

## Related Skills & References

- **Key Documents**: [[AGENTS]], [[project-structure]], [[mate-engine-navigation-guide]], [[stagemate-companion-runtime-distribution]], [[rosetta-stone]]
