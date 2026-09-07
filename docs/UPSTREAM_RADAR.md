# AIRI Upstream Radar

> **Living Intelligence Ledger**: Tracks continuous delta from upstream (`moeru-ai/airi`) to inform selective, high-value forward-porting into `dasilva333/airi`.
> Generated and maintained by Antigravity Scheduled Tasks via `scripts/upstream-tracker.mjs`.
> Guided by: [`docs/project-selective-upstream-sync-protocol.md`](./project-selective-upstream-sync-protocol.md).

---

## [2026-09-07] Upstream Delta: `f166736a..52a9f429` (6 commits, 63 files, 13 PR update(s))

### 🎯 Executive Highlights
* **Active Focus**: Upstream merged 6 commits spanning mobile stage controls simplification (#2472, #2475), Live2D expression synchronization between Stage and Settings windows in Electron (#2451), Plugin Host lifecycle debug controls (#2476), and backend API error propagation (#2333). In flight on PR radar, upstream is embarking on a massive architectural rewrite of LLM inference context projection via the Responses API (#2477), Chrome Prompt API support (#2299), and commercial payment backends.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2451 / Commit `05ac66edf` (`fix(stage-tamagotchi): show Live2D expressions in settings`)**: High architectural value for cross-window Live2D expression state syncing via Eventa and owner ID validation. Recommended for surgical cherry-pick (avoiding direct merge of Model.vue).
  - ⭐ **PR #2467 (`fix(stage-ui): persist speech provider settings`)**: Clean bug fix ensuring voice selections, base URLs, and API keys reliably persist in the synchronized provider store.
  - 🔍 **PR #2299 (`feat(providers): add Prompt API Provider`)**: Adds Chrome/Chromium built-in Prompt API (Gemini Nano) local inference. Good reference if expanding local offline providers.
  - 🔍 **Commit `52a9f429e` (`feat(plugin-host): add combined lifecycle controls (#2476)`)**: Adds combined 'Enable and Load' / 'Disable and Unload' actions to the devtools plugin host page.
* **Divergence / Collision Warnings**:
  - 🚨 **PR #2477 (`feat(inference): add native Responses API context projection`)**: CRITICAL ARCHITECTURAL DIVERGENCE (+2,333 / -562). Upstream is bypassing Chat Completions in favor of a Responses API context projection in `core-agent` and `stage-ui`. This fundamentally conflicts with our fork's custom cognitive architecture (`llm.ts`, `session-store.ts`, ACT token parser, STMM/LTMM/Lifetime memory injection, prefix-cache alignment). Do NOT merge upstream inference changes.
  - ⚠️ **Commit `836941fda` (`InteractiveArea.vue` in PR #2472)**: Upstream removed the chat clear button and analytics. Directly merging this would clobber our fork's custom `InteractiveArea.vue` controls (Image Journal button, audio/speech hooks).
  - ⚠️ **Commit `05ac66edf` (`Model.vue` in PR #2451)**: Live2D model loading changes collide with our fork's Live2D Scripting DSL VM, VarFloats heap, costume hot-swapping, and comic-bubble tethering.
  - ⚪ **Server & Monetization PRs (#2420 Steam, #2368 Payment CORE, #2339 Apple IAP, #2333 Server errors)**: Commercial monetization and centralized server infrastructure are out of scope and rejected for our offline-first BYOS fork.

### 📋 Upstream Commits
- `52a9f429e` feat(plugin-host): add combined lifecycle controls (#2476) [#2476](https://github.com/moeru-ai/airi/pull/2476) _(leafyy, 2026-09-07)_
- `0fd71bc1a` feat(stage-layouts): add mobile view adjustment mode (#2475) [#2475](https://github.com/moeru-ai/airi/pull/2475) _(RainbowBird, 2026-09-07)_
- `05ac66edf` fix(stage-tamagotchi): show Live2D expressions in settings (#2451) [#2451](https://github.com/moeru-ai/airi/pull/2451) _(leafyy, 2026-09-07)_
- `836941fda` feat(stage-layouts): simplify mobile stage controls (#2472) [#2472](https://github.com/moeru-ai/airi/pull/2472) _(RainbowBird, 2026-09-07)_
- `b1170ea8c` docs(server): clarify adr delivery workflow  _(RainbowBird, 2026-09-07)_
- `96b629165` fix(server): pass through final upstream errors (#2333) [#2333](https://github.com/moeru-ai/airi/pull/2333) _(RainbowBird, 2026-09-07)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 4 file(s) (+41/-0)
- `.agents/skills/create-pr/SKILL.md` *(+1/-0)*
- `AGENTS.md` *(+1/-0)*
- `docs/ai/context/ui-components.md` *(+27/-0)*
- `server/AGENTS.md` *(+12/-0)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 2 file(s) (+0/-4)
- `apps/stage-pocket/src/pages/index.vue` *(+0/-2)*
- `apps/stage-web/src/pages/index.vue` *(+0/-2)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 8 file(s) (+671/-84)
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+300/-1)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+0/-24)*
- `apps/stage-tamagotchi/src/renderer/composables/model-settings-runtime-owner.ts` *(+90/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/model-settings-runtime-snapshot.ts` *(+57/-26)*
- `apps/stage-tamagotchi/src/renderer/composables/model-settings-runtime.browser.test.ts` *(+171/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` *(+12/-27)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/models/index.vue` *(+2/-1)*
- `apps/stage-tamagotchi/src/shared/model-settings-runtime.ts` *(+39/-5)*

#### Localization (i18n) (`📦 import (additive only)`) — 4 file(s) (+64/-2)
- `packages/i18n/src/locales/en/settings.yaml` *(+7/-0)*
- `packages/i18n/src/locales/en/stage.yaml` *(+25/-1)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+7/-0)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+25/-1)*

#### Stage Layouts & Shells (`🔍 inspect`) — 8 file(s) (+423/-193)
- `packages/stage-layouts/src/components/Layouts/HeaderAvatar.vue` *(+11/-2)*
- `packages/stage-layouts/src/components/Layouts/InteractiveArea/Actions/About.vue` *(+7/-2)*
- `packages/stage-layouts/src/components/Layouts/InteractiveArea/Actions/ViewControls.vue` *(+53/-11)*
- `packages/stage-layouts/src/components/Layouts/MobileHeader.vue` *(+8/-8)*
- `packages/stage-layouts/src/components/Layouts/MobileHeaderLink.vue` *(+0/-35)*
- `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` *(+132/-107)*
- `packages/stage-layouts/src/components/Layouts/mobile-settings-drawer.vue` *(+212/-0)*
- `packages/stage-layouts/src/components/Widgets/ChatActionButtons.vue` *(+0/-28)*

#### UI Primitives & Pages (`📦 import / inspect`) — 5 file(s) (+115/-6)
- `packages/stage-pages/src/pages/devtools/plugin-host.vue` *(+36/-0)*
- `packages/ui/package.json` *(+1/-0)*
- `packages/ui/src/components/form/textarea/basic-text-area.vue` *(+5/-6)*
- `packages/ui/src/components/layouts/bottom-drawer.vue` *(+72/-0)*
- `packages/ui/src/components/layouts/index.ts` *(+1/-0)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 4 file(s) (+133/-23)
- `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue` *(+16/-7)*
- `packages/stage-ui-live2d/src/composables/live2d/expression-controller.test.ts` *(+41/-0)*
- `packages/stage-ui-live2d/src/composables/live2d/expression-controller.ts` *(+4/-7)*
- `packages/stage-ui-live2d/src/stores/expression-store.ts` *(+72/-9)*

#### Other / Uncategorized (`🔍 inspect`) — 27 file(s) (+1241/-303)
- `packages/stage-ui/src/components/misc/character-switcher-drawer.browser.test.ts` *(+94/-0)*
- `packages/stage-ui/src/components/misc/character-switcher-drawer.vue` *(+132/-0)*
- `packages/stage-ui/src/components/misc/index.ts` *(+1/-0)*
- `packages/stage-ui/src/components/misc/mobile-composer-height.browser.test.ts` *(+37/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-dialog.browser.test.ts` *(+45/-6)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-dialog.vue` *(+37/-105)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-drawer.browser.test.ts` *(+9/-2)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-drawer.vue` *(+4/-21)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-list.vue` *(+132/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/bottom-drawer.browser.test.ts` *(+45/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/live2d.browser.test.ts` *(+83/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/live2d.vue` *(+34/-33)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/panel.vue` *(+3/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/runtime.ts` *(+5/-0)*
- `packages/stage-ui/src/stores/devtools/plugin-host-debug.test.ts` *(+135/-0)*
- `packages/stage-ui/src/stores/devtools/plugin-host-debug.ts` *(+24/-0)*
- `packages/stage-ui/vitest.config.ts` *(+16/-0)*
- `server/apps/api/src/routes/openai/v1/http/response.test.ts` *(+22/-0)*
- `server/apps/api/src/routes/openai/v1/http/response.ts` *(+20/-0)*
- `server/apps/api/src/routes/openai/v1/operations/chat-completions/index.ts` *(+11/-4)*
- `server/apps/api/src/services/adapters/tts/dashscope-cosyvoice.test.ts` *(+15/-5)*
- `server/apps/api/src/services/adapters/tts/index.test.ts` *(+45/-22)*
- `server/apps/api/src/services/adapters/tts/types.ts` *(+15/-3)*
- `server/apps/api/src/services/adapters/tts/unspeech.ts` *(+5/-3)*
- `server/apps/api/src/services/domain/llm-router/router.ts` *(+131/-58)*
- `server/apps/api/src/services/domain/llm-router/tests/router.test.ts` *(+126/-40)*
- `server/apps/api/src/services/domain/openai-speech/index.ts` *(+15/-1)*

#### Root Build & Tooling (`🔍 inspect`) — 1 file(s) (+3/-0)
- `pnpm-lock.yaml` *(+3/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (6)
- [#2477](https://github.com/moeru-ai/airi/pull/2477) `feat(inference): add native Responses API context projection` by **@luoling8192** *(2 comments)*
- [#2474](https://github.com/moeru-ai/airi/pull/2474) `fix(stage-tamagotchi): prevent controls island overflow in small windows with scroll` by **@nayounsang** *(2 comments)*
- [#2476](https://github.com/moeru-ai/airi/pull/2476) `feat(plugin-host): add combined lifecycle controls` by **@leaft** *(2 comments)*
- [#2299](https://github.com/moeru-ai/airi/pull/2299) `feat(providers): add Prompt API Provider` by **@AdairLi2504** *(2 comments)*
- [#2475](https://github.com/moeru-ai/airi/pull/2475) `feat(stage-layouts): add mobile view adjustment mode` by **@luoling8192** *(2 comments)*
- [#2333](https://github.com/moeru-ai/airi/pull/2333) `fix(server): pass through final upstream errors` by **@luoling8192** *(2 comments)*

#### 🔄 PR Status & Lifecycle Changes (2)
- [#2451](https://github.com/moeru-ai/airi/pull/2451) `fix(stage-tamagotchi): show Live2D expressions in settings` — `OPEN` ➔ `MERGED`
- [#2472](https://github.com/moeru-ai/airi/pull/2472) `feat(stage-layouts): simplify mobile stage controls` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (5)
- [#2203](https://github.com/moeru-ai/airi/pull/2203) `fix(desktop): restore off-screen main window` — *+1 comments (23 ➔ 24 total)*
- [#2420](https://github.com/moeru-ai/airi/pull/2420) `feat(api): add Steam MicroTxn payment channel` — *+1 comments (1 ➔ 2 total)*
- [#2368](https://github.com/moeru-ai/airi/pull/2368) `refactor(api): extract payment CORE to support other payment providers [2/2]` — *+1 comments (0 ➔ 1 total)*
- [#2339](https://github.com/moeru-ai/airi/pull/2339) `feat(api): add Apple IAP payment channel backend` — *+1 comments (2 ➔ 3 total)*
- [#2467](https://github.com/moeru-ai/airi/pull/2467) `fix(stage-ui): persist speech provider settings` — *+1 comments (1 ➔ 2 total)*

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
