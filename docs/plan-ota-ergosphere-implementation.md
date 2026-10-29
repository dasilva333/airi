# Implementation Plan: Over-The-Air (OTA) Application Updates via Ergosphere Architecture

> **Status:** Active Execution & Multi-Day Subsystem Checklist
> **Branch:** `feat/ota-ergosphere-updater`
> **Architectural Specification & RFC:** [`docs/proposal-ota-app-updates-ergosphere.md`](./proposal-ota-app-updates-ergosphere.md)
> **Target Subsystems:**
> 1. Launcher & Configuration Core (`ergo.config.ts`, launcher shim, MPA Vite bundling)
> 2. Main Process Services, Splash Milestone Relay & IPC (`auto-updater.ts`, watchdog hook)
> 3. Cloud Infrastructure & CI Release Automation (R2 Bucket, Edge Worker, KV Telemetry, GitHub Actions)
> 4. Local Testing & Validation Harness (`update-test/*`, mock S3 bundle server)
> 5. UI Presentation & Localization (About page version badges, telemetry UI)

---

## 1. Live Infrastructure & Credentials Inventory

| Component | Identifier / Endpoint | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Cloudflare R2 Bucket** | `airi-updates` | **Active** | Standard storage class; zero egress fees. |
| **Worker Delivery URL** | `https://airi-updates.r1ch4rd.workers.dev` | **Active** | Handles CORS, Range queries, and content-aware edge caching. |
| **KV Telemetry Store** | `airi-updates-metrics`<br>`aa81893db1574f568b8ef66fb7c29758` | **Active** | Bound as `METRICS` in `apps/stage-edge-updates/wrangler.json`. |
| **Telemetry Endpoints** | [`/health`](https://airi-updates.r1ch4rd.workers.dev/health) & [`/stats`](https://airi-updates.r1ch4rd.workers.dev/stats) | **Active** | Real-time counters for channels, bundles, and geographic hits via `ctx.waitUntil`. |
| **Ed25519 Public Key** | `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIF/K7mT48suu2Or2Pnu8HQK/BKL92+WbH+mO6/DxlA8y airi-ota-updater` | **Active** | Committed to `apps/stage-tamagotchi/ergo.config.ts`. |
| **Ed25519 Private Key** | `.cache/keys/updater.key` | **Secured** | Gitignored local cache; configured as `ERGOSPHERE_IT_SIGNING_KEY` secret in CI. |
| **S3 API Endpoint** | `https://be20bd1c779b9eb5ea7127d80081c2d5.r2.cloudflarestorage.com` | **Active** | Used by `ergosphere-it` CLI for publishing bundles. |

---

## 2. Subsystems Implementation Tracker

### Subsystem 3: Cloud Infrastructure & Delivery Worker
- [x] Create Cloudflare R2 bucket `airi-updates`.
- [x] Provision KV namespace `airi-updates-metrics` (`aa81893db1574f568b8ef66fb7c29758`).
- [x] Create and deploy edge worker `apps/stage-edge-updates` to `https://airi-updates.r1ch4rd.workers.dev`.
- [x] Implement non-blocking telemetry tracking (`ctx.waitUntil`) for `/channels/*.json`, `/bundles/*.tar.gz`, and `/installers/*`.
- [x] Verify `/health` and `/stats` endpoints live.
- [x] Generate and store Ed25519 keypair (`.cache/keys/updater.key` and `updater.key.pub`).
- [ ] Port `.github/scripts/plan-tamagotchi-updates.ts` & `plan-tamagotchi-updates.test.ts` (with root `package.json` resolution).
- [ ] Configure `.github/workflows/release-tamagotchi.yml` to sign and publish bundles to R2 on push to `main` (dev lane) and release tags (stable).

### Subsystem 1: Launcher, Configuration Core & MPA Bundling
- [ ] Add `@ergosphere-it/electron` (v0.0.11+) to `apps/stage-tamagotchi/package.json` and set `main: "out/launcher/index.mjs"`.
- [ ] Configure `apps/stage-tamagotchi/ergo.config.ts`:
  - Set `feedUrl` to `https://airi-updates.r1ch4rd.workers.dev`.
  - Add the live Ed25519 public key.
  - Configure channels (`stable`, `canary`, `dev`, `nightly`).
- [ ] Implement `apps/stage-tamagotchi/src/launcher/index.ts`:
  - Verify active bundle signature against `ergo.config.ts`.
  - Fallback to embedded `app.asar` when bundle is absent or corrupt.
  - Render fallback `splash.html` immediately during bootloader initialization.
- [ ] Update `apps/stage-tamagotchi/electron.vite.config.ts`:
  - Dual build output: launcher (`out/launcher/index.mjs`) + main bundle.
  - Isolate `unplugin-info` to fixed-name unhashed chunk `assets/build-info.js` to preserve CDN chunk caching across commits (PR #3149).
  - Package all MPA entry points (`main`, `splash`, `beat-sync`, `sticker`) into `out/renderer/` for the bundle tarball.
- [ ] Verify `tsconfig.json` paths and compilation boundaries in `stage-tamagotchi`.

### Subsystem 2: Main Process Services, Splash Milestone Relay & IPC
- [ ] Implement `apps/stage-tamagotchi/src/main/services/electron/auto-updater.ts` using the consolidated upstream reference.
- [ ] Implement mock updater `apps/stage-tamagotchi/src/main/services/electron/mock-auto-updater.ts` and test suite `auto-updater.test.ts`.
- [ ] Define Eventa contracts in `apps/stage-tamagotchi/src/shared/eventa/index.ts` for download progress (`updater:download-progress`), channel switching, and restart triggers.
- [ ] Implement `apps/stage-tamagotchi/src/shared/update-channels.ts` & unit tests.
- [ ] Wire `updaterService.reportHealthy()` into `electronSplashDismiss` in `apps/stage-tamagotchi/src/main/index.ts`:
  - Ensure health is only confirmed once all startup milestones (`core-services`, `sync-engine`, `character-card`, `stage-actor`) report `'ready'`.
  - Re-arm watchdog and handle window reloads (`Cmd+R` / `F5`) gracefully without false crash loops.
- [ ] Add dual-engine version range parsing for seamless fallback to `electron-updater` binary installers when native modules change (PR #3137).
- [ ] Ensure `updater.log` writes strictly inside `app.getPath('userData')/logs/` (PR #3187).

### Subsystem 4: Local Testing & Validation Harness
- [ ] Port `apps/stage-tamagotchi/scripts/update-test/start-server.ts`.
- [ ] Port `apps/stage-tamagotchi/scripts/update-test/generate-manifest.ts` & unit tests.
- [ ] Port `apps/stage-tamagotchi/scripts/update-test/setup.sh`, `run-test.sh`, and `run-matrix.sh`.
- [ ] Run local simulation: test bundle extraction, signature verification, and 10-second watchdog crash rollback on macOS and Windows.

### Subsystem 5: UI Presentation & Localization
- [ ] Adapt upstream `about.vue` into `packages/stage-pages/src/pages/settings/about.vue`:
  - Channel selection dropdown / badges (`stable`, `canary`, `dev`, `nightly`).
  - Real-time download speed indicator (MB/s) and byte progress bar.
  - "Reload to Apply" badge when a bundle is staged.
- [ ] Add localization keys to `packages/i18n/src/locales/en/tamagotchi/stage.yaml` and `zh-Hans/...` via `yaml-manager.js`.

---

## 3. Immediate Next Steps (Phase 1 Kickoff)

1. Add `@ergosphere-it/electron` dependency to `apps/stage-tamagotchi/package.json`.
2. Commit `apps/stage-tamagotchi/ergo.config.ts` wired to `https://airi-updates.r1ch4rd.workers.dev`.
3. Scaffold `apps/stage-tamagotchi/src/launcher/index.ts` and configure `electron.vite.config.ts` for dual-target launcher + MPA bundle compilation.
