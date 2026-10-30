---
name: airi-ota-ergosphere-updater
description: >-
  Build/debug Over-The-Air (OTA) application updates via Ergosphere: launcher
  bootstrap, dynamic bundle loading, Ed25519 signature verification, R2 edge
  worker feeds, update channels (stable/canary/dev/nightly), auto-updater service,
  splash health watchdog, and crash rollback. Full binary packaging uses
  airi-release-packaging-deploy.
---

# AIRI Over-The-Air (OTA) Updates & Ergosphere Architecture

Own lightweight, continuous Over-The-Air application delivery for the `stage-tamagotchi` desktop app. OTA updates deliver main process logic, preloads, and Vite renderer bundles as cryptographically signed JavaScript tarballs (5–15 MB) without requiring full binary reinstalls or process elevation.

> **Related Domain Skills & Ownership Boundary:**
> - Full binary packaging (`.dmg`, `.exe`, `.deb`), electron-builder configuration, SignPath code signing, and Apple notarization belong to [airi-release-packaging-deploy](../airi-release-packaging-deploy/SKILL.md).
> - Initial window bootstrapping and service composition belong to [airi-app-entry-wiring](../airi-app-entry-wiring/SKILL.md).
> - Typed IPC definitions and cross-window relays belong to [airi-ipc-eventa](../airi-ipc-eventa/SKILL.md).
> - Edge infrastructure and Cloudflare Worker deployment belong to [airi-cloud-relay-infrastructure](../airi-cloud-relay-infrastructure/SKILL.md).

---

## 1. Authoritative Architecture & Planning Specs

Before modifying the launcher, updater service, or delivery worker, review the canonical design documents:
- **Architectural Specification & RFC**: [`docs/proposal-ota-app-updates-ergosphere.md`](../../docs/proposal-ota-app-updates-ergosphere.md) — Comprehensive design, threat model, rollback state machine, and upstream PR lineage ([#3126](https://github.com/moeru-ai/airi/pull/3126)–[#3188](https://github.com/moeru-ai/airi/pull/3188)).
- **Subsystem Execution Tracker**: [`docs/plan-ota-ergosphere-implementation.md`](../../docs/plan-ota-ergosphere-implementation.md) — Live infrastructure inventory (R2 bucket `airi-updates`, worker `https://airi-updates.r1ch4rd.workers.dev`, Ed25519 public key, KV namespace `airi-updates-metrics`), checklist, and testing harness roadmap.
- **PWA & Periodic Update Checker**: [`docs/design-desktop-update-checker.md`](../../docs/design-desktop-update-checker.md) — Background check loops, interval timers, and update dialog UX.

---

## 2. Surface & Source Map

Paths are repository-relative. Always inspect the relevant implementation before changing update contracts.

| Responsibility | Source and Anchor | Description |
| :--- | :--- | :--- |
| **Launcher Entry Shim** | `apps/stage-tamagotchi/src/launcher/index.ts` | Package entry (`main: "out/launcher/index.mjs"`). Resolves active bundle, checks Ed25519 signature, imports `main/index.mjs`, arms crash watchdog. |
| **Ergosphere Config** | `apps/stage-tamagotchi/ergo.config.ts` | Feed endpoint (`https://airi-updates.r1ch4rd.workers.dev`), baked Ed25519 public key, and channels (`stable`, `canary`, `dev`, `nightly`). |
| **Dual Vite Bundling** | `apps/stage-tamagotchi/electron.vite.config.ts` | Emits `out/launcher/index.mjs` (immutable shim) and `out/bundle/` (complete application bundle). Isolates unhashed `build-info.js`. |
| **Main Process Updater** | `apps/stage-tamagotchi/src/main/services/electron/auto-updater.ts` | Wraps `@ergosphere-it/electron/main`. Safe execution boundary via `isUnderErgosphere()`, checks feeds, stages downloads. |
| **Mock Updater Service** | `apps/stage-tamagotchi/src/main/services/electron/mock-auto-updater.ts` | In-memory mock for headless CI tests and dev simulation without an active Ergosphere runtime. |
| **Health Backstop Relay** | `apps/stage-tamagotchi/src/main/index.ts` | Calls `updaterService.reportHealthy()` on splash screen dismissal (`electronSplashDismiss`) or 30-second backstop timer. |
| **Runtime Path Resolver** | `apps/stage-tamagotchi/src/main/libs/electron/location.ts` | Intercepts asset paths via `activeBundle.resolve('renderer', ...)` when executing under an extracted Ergosphere bundle. |
| **Typed Eventa IPC** | `packages/electron-eventa/src/electron-updater/index.ts` | RPC contracts: `channel:get/set`, `status:get`, `update:check`, `update:apply`, and `rollback:dismiss`. |
| **Cloud Delivery Worker** | `apps/stage-edge-updates/` | Cloudflare Worker + R2 bucket (`airi-updates`) with non-blocking KV metrics (`ctx.waitUntil`) for `/channels/` and `/bundles/`. |
| **UI Presentation** | `packages/stage-pages/src/pages/settings/about.vue` | Update channel badges, byte download progress bar, speed indicator (MB/s), and "Reload to Apply" prompt. |

---

## 3. Core Architecture & Invariants

### 1. The Immutable Launcher vs. Dynamic Bundle
The Electron binary and its launcher script (`out/launcher/index.mjs`) are immutable after installation:
- `package.json` specifies `main: "out/launcher/index.mjs"`.
- On startup, the launcher inspects `app.getPath('userData')/updates/active-bundle.json`.
- If a downloaded bundle exists, its Ed25519 signature is verified against the public key committed in `ergo.config.ts`.
- If valid, the launcher dynamically imports `userData/updates/bundles/<id>/main/index.mjs`.
- If no bundle exists, verification fails, or the bundle crashed previously, the launcher seamlessly falls back to the embedded baseline in `app.asar/out/main/index.mjs`.

### 2. Ed25519 Cryptographic Verification
- All published bundle tarballs (`.tar.gz`) are signed using the private key configured as `ERGOSPHERE_IT_SIGNING_KEY` in CI.
- The public key (`ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIF/K7mT48suu2Or2Pnu8HQK/BKL92+WbH+mO6/DxlA8y airi-ota-updater`) is compiled directly into `ergo.config.ts`.
- Bundles with invalid signatures or incomplete checksums are rejected before execution.

### 3. Crash Watchdog & Atomic Rollback
- When launching a newly applied bundle, the launcher arms an automatic crash watchdog.
- The application main process must signal successful startup by invoking `updaterService.reportHealthy()`.
- AIRI binds `reportHealthy()` to the `electronSplashDismiss` milestone with an unconditional 30-second backstop timer in `apps/stage-tamagotchi/src/main/index.ts`.
- If the application crashes, hangs, or terminates before calling `reportHealthy()`, the launcher flags the bundle as broken and immediately rolls back to the previous working bundle or embedded baseline on the next boot.

### 4. Preserving CDN Chunk Caching (`assets/build-info.js`)
Per upstream PR [#3149](https://github.com/moeru-ai/airi/pull/3149):
- The `unplugin-info` git commit / build timestamp metadata is isolated into a fixed, unhashed chunk (`assets/build-info.js`).
- This prevents commit-hash churn from invalidating hashed renderer chunks (`main-*.js`, `vendor-*.js`), allowing users to download only changed modules (~500 KB–2 MB) rather than full bundle archives.

### 5. Safe Runtime Guard (`isUnderErgosphere`)
Always check `isUnderErgosphere()` before invoking `@ergosphere-it/electron` APIs:
- When running raw `electron .` or during development without an extracted bundle, `isUnderErgosphere()` evaluates to `false`.
- The service degrades gracefully to `mock-auto-updater.ts` without throwing unhandled exceptions.

---

## 4. Known Pitfalls & Failure Modes

1. **Path Resolution Under Dynamic Bundles (`app.getAppPath()` trap)**:
   - When running under Ergosphere, `app.getAppPath()` points to the launcher inside `app.asar`, NOT the active bundle in `userData/updates/bundles/<id>/`.
   - Never resolve renderer HTML or preload scripts using `path.join(app.getAppPath(), ...)`.
   - Always use `activeBundle.resolve('renderer', 'index.html')` and `activeBundle.resolve('preload', 'index.mjs')` via `location.ts`.

2. **Native Module C++ Boundary**:
   - Ergosphere OTA bundles only update JavaScript, CSS, HTML, and asset files.
   - If a dependency introduces new native Node C++ bindings or bumps Electron major versions (ABI change), a full binary installer release via `airi-release-packaging-deploy` is strictly required.

3. **Updater Log Directory Constraint**:
   - Per upstream PR [#3187](https://github.com/moeru-ai/airi/pull/3187), write `updater.log` strictly inside `app.getPath('userData')/logs/updater.log`. Writing to the install directory fails due to Windows UAC / macOS readonly bundle permissions.

4. **Premature `reportHealthy()` Calls**:
   - Do NOT invoke `reportHealthy()` immediately in the top-level main process script before windows or services initialize. If window creation throws an unhandled exception, calling `reportHealthy()` prematurely disables the crash watchdog and leaves the user stuck in a broken boot loop.

---

## 5. Verification Workflows

- **Run Auto-Updater Unit Tests**:
  ```bash
  pnpm -F @proj-airi/stage-tamagotchi test src/main/services/electron/auto-updater.test.ts
  ```
- **Typecheck Main Process & Launcher**:
  ```bash
  pnpm -F @proj-airi/stage-tamagotchi typecheck:node
  ```
- **Typecheck Renderer Windows**:
  ```bash
  pnpm -F @proj-airi/stage-tamagotchi typecheck:web
  ```
- **Smoke-Test Preview Launch Under Launcher**:
  ```bash
  pnpm -F @proj-airi/stage-tamagotchi run start
  ```
- **Verify Edge Delivery Health**:
  ```bash
  curl -s https://airi-updates.r1ch4rd.workers.dev/health
  ```
