# AIRI Upstream Radar

> **Living Intelligence Ledger**: Tracks continuous delta from upstream (`moeru-ai/airi`) to inform selective, high-value forward-porting into `dasilva333/airi`.
> Generated and maintained by Antigravity Scheduled Tasks via `scripts/upstream-tracker.mjs`.
> Guided by: [`docs/project-selective-upstream-sync-protocol.md`](./project-selective-upstream-sync-protocol.md).

---

## [2026-09-06] Upstream PR Activity: `f166736a` (6 PR update(s))

### 🎯 Executive Highlights
* **Active Focus**: Upstream main remains at `f166736a` (0 new commits merged), but active PR activity includes Live2D Cubism 2 generation-loader modularization (#2197), WebSocket race condition fixes (#2468), mobile stage controls drawer simplification (#2472), provider cloud replica synchronization (#2471 Ready), and local FunASR STT integration (#2435).
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2468 (`fix(better-ws)`)**: High-value, zero-collision bug fix that binds WebSocket preparation to connection epochs and prevents stale connection hangs. Recommended for forward-porting.
  - 🔍 **PR #2197 (`feat(live2d)`)**: High architectural value for Cubism 2 model support via modular `src/generations/cubism2/` loader, but requires surgical extraction rather than full merge.
  - 🔍 **PR #2435 (`feat(stage-ui: FunASR)`)**: Strong local Chinese/multilingual STT addition (SenseVoiceSmall) once finalized.
* **Divergence / Collision Warnings**:
  - ⚠️ **PR #2197 (`Model.vue`)**: Severe collision risk with fork's custom Live2D DSL interpreter, VarFloats heap, and comic-bubble plank hooks. Must NOT be merged directly.
  - ⚠️ **PR #2471 (`stores/providers` cloud replica)**: Conflicts with our fork's decentralized BYOS (S3/R2/Google Drive) offline-first persistence. Upstream's central API sync should be rejected.
  - ⚪ **PR #2473 (`server/apps/auth` email flow)**: Out of scope for desktop Electron/local runtime.

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (3)
- [#2472](https://github.com/moeru-ai/airi/pull/2472) `feat(stage-layouts): simplify mobile stage controls` by **@luoling8192** *(2 comments)*
- [#2473](https://github.com/moeru-ai/airi/pull/2473) `feat(auth): add native email change flow` by **@RuinyIcaria** *(0 comments)*
- [#2197](https://github.com/moeru-ai/airi/pull/2197) `feat(live2d): support Cubism 2 through generation-specific loaders` by **@starryark** *(4 comments)*

#### 🔄 PR Status & Lifecycle Changes (1)
- [#2471](https://github.com/moeru-ai/airi/pull/2471) `feat(stage-ui): sync user providers to a cloud replica` — `Draft` ➔ `Ready`

#### 💬 Discussion Activity (2)
- [#2468](https://github.com/moeru-ai/airi/pull/2468) `fix(better-ws): isolate preparation across connection changes` — *+1 comments (0 ➔ 1 total)*
- [#2435](https://github.com/moeru-ai/airi/pull/2435) `feat(stage-ui): add local FunASR transcription provider` — *+1 comments (16 ➔ 17 total)*

---
## [2026-09-05] Upstream Delta: `05007ce3..f166736a` (2 commits, 4 files)

### 🎯 Executive Highlights
* **Active Focus**: Upstream is focusing on MMD ecosystem dependency upgrades and routine Nix packaging maintenance.
* **Cherry-Pick Candidates**: None recommended for forward-porting. Upstream bumped `@moeru/three-mmd` and `@moeru/three-mmd-physics-ammo` to `v0.2.0-beta.2` (PR #2469), whereas our fork currently maintains its own MMD stage implementation in `packages/stage-ui-mmd` utilizing `three-stdlib`. PR #2470 is an automated CI update to `nix/pnpm-deps-hash.txt`.
* **Divergence / Collision Warnings**: Zero collision risk. No touched files intersect with custom fork logic (e.g. `llm.ts`, `session-store.ts`, or Electron desktop services).

### 📋 Upstream Commits
- `f166736a7` chore(nix): update pnpmDeps hash (#2470) [#2470](https://github.com/moeru-ai/airi/pull/2470) _(Weathercold, 2026-09-05)_
- `3fc1e6461` chore(deps): bump three-mmd to v0.2.0-beta.2 (#2469) [#2469](https://github.com/moeru-ai/airi/pull/2469) _(藍+85CD, 2026-09-05)_

### 🔬 Subsystem Breakdown
#### Other / Uncategorized (`🔍 inspect`) — 3 file(s) (+7/-7)
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/stage-ui-mmd/src/utils/mmd-materials.test.ts` *(+4/-4)*
- `pnpm-workspace.yaml` *(+2/-2)*

#### Root Build & Tooling (`🔍 inspect`) — 1 file(s) (+14/-14)
- `pnpm-lock.yaml` *(+14/-14)*

---
## [2026-09-04] 🏁 Baseline Snapshot Established
- **Upstream Head SHA**: `05007ce3ca64ec9ddacb7e34a10ca5d27320eb23`
- **Latest Upstream Commit**: `refactor(stage-ui): rename analytics runtime path (#2466)`
- **Status**: Clean baseline established. Subsequent daily scheduled runs will measure delta from this commit forward.
