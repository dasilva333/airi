# AIRI Upstream Radar

> **Living Intelligence Ledger**: Tracks continuous delta from upstream (`moeru-ai/airi`) to inform selective, high-value forward-porting into `dasilva333/airi`.
> Generated and maintained by Antigravity Scheduled Tasks via `scripts/upstream-tracker.mjs`.
> Guided by: [`docs/project-selective-upstream-sync-protocol.md`](./project-selective-upstream-sync-protocol.md).

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
