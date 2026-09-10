# AIRI Upstream Radar

> **Living Intelligence Ledger**: Tracks continuous delta from upstream (`moeru-ai/airi`) to inform selective, high-value forward-porting into `dasilva333/airi`.
> Generated and maintained by Antigravity Scheduled Tasks via `scripts/upstream-tracker.mjs`.
> Guided by: [`docs/project-selective-upstream-sync-protocol.md`](./project-selective-upstream-sync-protocol.md).

---

## [2026-09-10] Upstream Delta: `3e94ea81..2904b795` (12 commits, 126 files, 20 PR update(s))

### 🎯 Executive Highlights
* **Active Focus**: Upstream merged 12 commits (`3e94ea81..2904b795`) focusing heavily on chat swipe-to-reply interactions and touch gestures (#2489, #2508, #2514), speech provider persistence and initial TTS login catalog restoration (#2497, #2490), Turbo-powered typecheck optimization (#2499), and browser test stabilization (#2510). Active PR radar includes Live2D ambient lighting (#2498 [Draft]), folder-based plugin imports (#2506 [Draft]), provider cloud replica sync (#2471), and security reports (#2511, #2512).
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2497 (`fix(stage-ui): persist speech provider settings`) [Merged]**: High-value bug fix addressing Issue #2449 where newly entered speech credentials fail to persist due to computed configs masking uninitialized providers. Forward-port `patchProviderConfig` and the existence check in `packages/stage-ui/src/stores/providers/` (`provider.ts`, `config.ts`).
  - ⭐ **PR #2499 (`chore: optimize typecheck execution`) [Merged]**: Monorepo speedup configuring `turbo run typecheck` with input hashing in `turbo.json` and updating root `package.json`, dramatically speeding up typecheck passes.
  - 🔍 **PR #2490 (`fix(stage-ui): restore TTS after first login`) [Merged]**: Important fix preventing unauthenticated/tokenless requests from caching empty voice catalogs. Inspect selectively; adapt the cache-guard pattern without pulling upstream's full leader/follower store rewrite.
* **Divergence / Collision Warnings**:
  - 🚨 **PR #2489 / #2508 / #2514 (`feat(stage-ui): add swipe to reply for chat messages`) [Merged]**: Massive touch/reply overhaul (+3,646 LOC across 57 files). Deeply conflicts with our fork's custom desktop chatbox, message frame, and interaction pipeline. Do NOT merge directly; quote/reply UI should be ported as a standalone component if desired.
  - ⚠️ **PR #2490 (`packages/stage-ui/src/stores/modules/speech.ts`)**: Rewrites speech store synchronization around leader/follower Pinia context (+333 lines). High conflict potential with our fork's audio pipeline and speech runtime.
  - ⚪ **PR #2494 (`services/computer-use-mcp`) & PR #2513 (`Cloudflare preview origins`)**: Upstream-specific services and hosted web auth infrastructure; ignore for desktop fork.

### 📋 Upstream Commits
- `2904b795dd` fix(stage-ui): keep mobile swipe attached to touch (#2514) [#2514](https://github.com/moeru-ai/airi/pull/2514) _(Neko, 2026-09-10)_
- `9a76eaec32` fix(server): trust moeru-ai Cloudflare Workers preview origins (#2513) [#2513](https://github.com/moeru-ai/airi/pull/2513) _(Lulu, 2026-09-10)_
- `3c9e60907c` test(stage-tamagotchi): stabilize interactive area browser fixtures (#2510) [#2510](https://github.com/moeru-ai/airi/pull/2510) _(leafyy, 2026-09-10)_
- `21d0e9d3a7` fix(stage-ui): use touch events for mobile swipe (#2508) [#2508](https://github.com/moeru-ai/airi/pull/2508) _(Neko, 2026-09-10)_
- `13ae708541` chore(nix): update assets hash (#2501) [#2501](https://github.com/moeru-ai/airi/pull/2501) _(Weathercold, 2026-09-10)_
- `b2a7dc252c` fix(stage-ui): center mobile user message text (#2505) [#2505](https://github.com/moeru-ai/airi/pull/2505) _(Neko, 2026-09-10)_
- `dfc6951a55` chore(nix): update pnpmDeps hash (#2500) [#2500](https://github.com/moeru-ai/airi/pull/2500) _(Weathercold, 2026-09-09)_
- `d7f38783f7` fix(stage-ui): persist speech provider settings (#2497) [#2497](https://github.com/moeru-ai/airi/pull/2497) _(leafyy, 2026-09-10)_
- `352a9e389b` fix(stage-ui): restore TTS after first login (#2490) [#2490](https://github.com/moeru-ai/airi/pull/2490) _(Lovehsigure_520, 2026-09-10)_
- `41f9fb616b` fix(computer-use-mcp): fix type errors at serivce/computer-use-mcp (#2494) [#2494](https://github.com/moeru-ai/airi/pull/2494) _(Younsang Na, 2026-09-10)_
- `db2f8e3064` chore: optimize typecheck execution  (#2499) [#2499](https://github.com/moeru-ai/airi/pull/2499) _(Younsang Na, 2026-09-10)_
- `0d7b5e9a60` feat(stage-ui): add swipe to reply for chat messages (#2489) [#2489](https://github.com/moeru-ai/airi/pull/2489) _(Neko, 2026-09-10)_

### 🔬 Subsystem Breakdown
#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 4 file(s) (+2/-6)
- `apps/stage-pocket/package.json` *(+0/-1)*
- `apps/stage-pocket/tsconfig.json` *(+1/-2)*
- `apps/stage-web/package.json` *(+0/-1)*
- `apps/stage-web/tsconfig.json` *(+1/-2)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 9 file(s) (+683/-119)
- `apps/stage-tamagotchi/package.json` *(+0/-1)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+316/-12)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+97/-93)*
- `apps/stage-tamagotchi/src/renderer/components/chat-image-attachment-preview.browser.test.ts` *(+32/-0)*
- `apps/stage-tamagotchi/src/renderer/components/chat-image-attachment-preview.vue` *(+32/-0)*
- `apps/stage-tamagotchi/src/renderer/components/chat-viewport-layout.browser.test.ts` *(+148/-7)*
- `apps/stage-tamagotchi/src/renderer/components/chat-viewport-layout.vue` *(+33/-3)*
- `apps/stage-tamagotchi/tsconfig.json` *(+1/-2)*
- `apps/stage-tamagotchi/vitest.config.ts` *(+24/-1)*

#### Root Build & Tooling (`🔍 inspect`) — 7 file(s) (+40/-36)
- `apps/ui-server-auth/package.json` *(+0/-1)*
- `apps/ui-server-auth/tsconfig.json` *(+1/-2)*
- `package.json` *(+3/-2)*
- `packages/stage-ui/package.json` *(+2/-1)*
- `packages/stage-ui/tsconfig.json` *(+1/-2)*
- `pnpm-lock.yaml` *(+29/-28)*
- `turbo.json` *(+4/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 79 file(s) (+4905/-362)
- `nix/assets-hash.txt` *(+1/-1)*
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/provider-inference/src/providers/cloud/elevenlabs/index.ts` *(+1/-0)*
- `packages/provider-inference/src/providers/cloud/google-gemini-audio-speech/index.ts` *(+1/-0)*
- `packages/provider-inference/src/providers/cloud/mimo-audio/index.ts` *(+1/-0)*
- `packages/provider-inference/src/providers/cloud/minimax-speech/index.ts` *(+1/-0)*
- `packages/provider-inference/src/providers/cloud/openai-audio/index.ts` *(+2/-0)*
- `packages/provider-inference/src/providers/cloud/openrouter-audio-speech/index.ts` *(+1/-0)*
- `packages/provider-inference/src/providers/cloud/unspeech/index.ts` *(+4/-0)*
- `packages/provider-inference/src/providers/local/index-tts-vllm/index.ts` *(+1/-0)*
- `packages/provider-inference/src/providers/local/player2-speech/index.ts` *(+1/-0)*
- `packages/provider-inference/src/providers/local/speech-noop/index.ts` *(+1/-0)*
- `packages/provider-inference/src/providers/local/voicevox/define.ts` *(+1/-0)*
- `packages/provider-inference/src/types.ts` *(+12/-1)*
- `packages/scenarios-stage-tamagotchi-electron/src/context.test.ts` *(+1/-0)*
- `packages/scenarios-stage-tamagotchi-electron/src/context.ts` *(+9/-0)*
- `packages/scenarios-stage-tamagotchi-electron/src/index.ts` *(+2/-0)*
- `packages/scenarios-stage-tamagotchi-electron/src/runtime/gestures.test.ts` *(+215/-0)*
- `packages/scenarios-stage-tamagotchi-electron/src/runtime/gestures.ts` *(+144/-0)*
- `packages/stage-ui/src/components/gestures/index.ts` *(+4/-0)*
- `packages/stage-ui/src/components/gestures/swipeable.ts` *(+31/-0)*
- `packages/stage-ui/src/components/gestures/swipeable.vue` *(+306/-0)*
- `packages/stage-ui/src/components/gestures/use-swipe-gesture.browser.test.ts` *(+81/-0)*
- `packages/stage-ui/src/components/gestures/use-swipe-gesture.ts` *(+55/-0)*
- `packages/stage-ui/src/components/index.ts` *(+1/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/action-menu/index.test.ts` *(+7/-43)*
- `packages/stage-ui/src/components/scenarios/chat/components/action-menu/index.vue` *(+59/-59)*
- `packages/stage-ui/src/components/scenarios/chat/components/action-menu/menu-items.ts` *(+11/-2)*
- `packages/stage-ui/src/components/scenarios/chat/components/assistant-item.vue` *(+10/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/history-message-frame.vue` *(+61/-2)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.browser.test.ts` *(+1215/-1)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.vue` *(+59/-2)*
- `packages/stage-ui/src/components/scenarios/chat/components/reply-preview.vue` *(+83/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/reply-quote.vue` *(+40/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/user-item.vue` *(+12/-1)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-composer.test.ts` *(+88/-0)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-composer.ts` *(+152/-0)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-history-scroll.browser.test.ts` *(+49/-0)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-history-scroll.ts` *(+4/-1)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-virtualizer-scroll.ts` *(+15/-3)*
- `packages/stage-ui/src/components/scenarios/chat/index.ts` *(+5/-0)*
- `packages/stage-ui/src/components/scenarios/chat/reply.test.ts` *(+31/-0)*
- `packages/stage-ui/src/components/scenarios/chat/reply.ts` *(+45/-0)*
- `packages/stage-ui/src/components/scenarios/providers/speech-provider-settings.vue` *(+3/-4)*
- `packages/stage-ui/src/components/scenarios/providers/voicevox-family-settings.browser.test.ts` *(+38/-2)*
- `packages/stage-ui/src/composables/use-data-maintenance.browser.test.ts` *(+102/-0)*
- `packages/stage-ui/src/composables/use-data-maintenance.ts` *(+19/-10)*
- `packages/stage-ui/src/database/repos/chat-sessions.repo.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/chat-sync/wire-message.test.ts` *(+16/-0)*
- `packages/stage-ui/src/libs/chat-sync/wire-message.ts` *(+5/-0)*
- `packages/stage-ui/src/libs/pinia/setup-synced.ts` *(+6/-15)*
- `packages/stage-ui/src/libs/pinia/synced-context.ts` *(+15/-0)*
- `packages/stage-ui/src/libs/providers/providers/kokoro-local/index.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/providers/providers/official/index.ts` *(+72/-90)*
- `packages/stage-ui/src/stores/modules/airi-card-inheritance.test.ts` *(+128/-0)*
- `packages/stage-ui/src/stores/modules/airi-card.test.ts` *(+5/-14)*
- `packages/stage-ui/src/stores/modules/airi-card.ts` *(+43/-18)*
- `packages/stage-ui/src/stores/modules/speech-card-preview.browser.test.ts` *(+97/-0)*
- `packages/stage-ui/src/stores/modules/speech-settings.browser.test.ts` *(+173/-0)*
- `packages/stage-ui/src/stores/modules/speech.browser.test.ts` *(+668/-0)*
- `packages/stage-ui/src/stores/modules/speech.test.ts` *(+309/-23)*
- `packages/stage-ui/src/stores/modules/speech.ts` *(+288/-45)*
- `packages/stage-ui/vitest.config.ts` *(+8/-0)*
- `pnpm-workspace.yaml` *(+1/-1)*
- `server/apps/api/src/routes/chat-ws/v1/rpc.contract.test.ts` *(+20/-0)*
- `server/apps/api/src/services/domain/chats.test.ts` *(+31/-0)*
- `server/apps/api/src/services/domain/chats.ts` *(+5/-7)*
- `server/apps/api/src/utils/origin.ts` *(+1/-1)*
- `server/apps/auth/src/origin.ts` *(+1/-1)*
- `server/apps/auth/src/tests/auth.test.ts` *(+2/-2)*
- `server/packages/server-sdk-shared/src/chat.ts` *(+2/-0)*
- `services/computer-use-mcp/src/bin/smoke-workflow.ts` *(+1/-1)*
- `services/computer-use-mcp/src/browser-dom/extension-bridge.test.ts` *(+2/-2)*
- `services/computer-use-mcp/src/chrome-session-manager.test.ts` *(+8/-3)*
- `services/computer-use-mcp/src/chrome-session-manager.ts` *(+1/-1)*
- `services/computer-use-mcp/src/policy.ts` *(+1/-1)*
- `services/computer-use-mcp/src/server/action-executor.ts` *(+4/-4)*
- `services/computer-use-mcp/src/server/register-chrome-session.test.ts` *(+2/-0)*
- `services/computer-use-mcp/src/types.ts` *(+2/-0)*

#### Core Agent Runtime (`🔍 inspect`) — 3 file(s) (+232/-3)
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.test.ts` *(+150/-0)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts` *(+80/-3)*
- `packages/core-agent/src/types/chat.ts` *(+2/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+12/-0)
- `packages/i18n/src/locales/en/stage.yaml` *(+6/-0)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+6/-0)*

#### Documentation & Scaffolding (`⚪ ignore`) — 1 file(s) (+24/-1)
- `packages/scenarios-stage-tamagotchi-electron/README.md` *(+24/-1)*

#### Stage Layouts & Shells (`🔍 inspect`) — 5 file(s) (+106/-81)
- `packages/stage-layouts/package.json` *(+0/-1)*
- `packages/stage-layouts/src/components/Layouts/InteractiveArea.vue` *(+18/-5)*
- `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` *(+51/-37)*
- `packages/stage-layouts/src/components/Widgets/ChatArea.vue` *(+36/-36)*
- `packages/stage-layouts/tsconfig.json` *(+1/-2)*

#### UI Primitives & Pages (`📦 import / inspect`) — 8 file(s) (+288/-85)
- `packages/stage-pages/package.json` *(+7/-1)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardCreationDialog.vue` *(+33/-8)*
- `packages/stage-pages/src/pages/settings/modules/speech.vue` *(+76/-72)*
- `packages/stage-pages/src/pages/settings/providers/speech/google-gemini-audio-speech.vue` *(+1/-1)*
- `packages/stage-pages/src/pages/settings/providers/speech/mimo-audio-speech.vue` *(+1/-1)*
- `packages/stage-pages/src/pages/settings/providers/speech/provider-config-persistence.browser.test.ts` *(+122/-0)*
- `packages/stage-pages/tsconfig.json` *(+1/-2)*
- `packages/stage-pages/vitest.config.ts` *(+47/-0)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 1 file(s) (+1/-1)
- `packages/stage-ui-live2d/src/composables/live2d/animation.ts` *(+1/-1)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 3 file(s) (+32/-3)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+22/-0)*
- `packages/stage-ui/src/stores/chat.ts` *(+5/-0)*
- `packages/stage-ui/src/stores/chat/session-store.ts` *(+5/-3)*

#### Provider & Model Integrations (`📦 import / inspect`) — 4 file(s) (+380/-30)
- `packages/stage-ui/src/stores/providers/config.test.ts` *(+21/-0)*
- `packages/stage-ui/src/stores/providers/config.ts` *(+19/-0)*
- `packages/stage-ui/src/stores/providers/provider.test.ts` *(+211/-17)*
- `packages/stage-ui/src/stores/providers/provider.ts` *(+129/-13)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (15)
- [#2514](https://github.com/moeru-ai/airi/pull/2514) `fix(stage-ui): keep mobile swipe attached to touch` by **@nekomeowww** *(2 comments)*
- [#2506](https://github.com/moeru-ai/airi/pull/2506) `feat(plugin-host): import extensions from folders` by **@leaft** *(Draft)* *(1 comments)*
- [#2513](https://github.com/moeru-ai/airi/pull/2513) `fix(server): trust moeru-ai Cloudflare Workers preview origins` by **@lulu0119** *(3 comments)*
- [#2512](https://github.com/moeru-ai/airi/pull/2512) `fix: fix security issue in artistry.ts` by **@anupamme** *(0 comments)*
- [#2511](https://github.com/moeru-ai/airi/pull/2511) `fix: upgrade gh-pages to 5.0.0 (CVE-2022-37611)` by **@anupamme** *(0 comments)*
- [#2510](https://github.com/moeru-ai/airi/pull/2510) `test(stage-tamagotchi): stabilize interactive area browser fixtures` by **@leaft** *(2 comments)*
- [#2509](https://github.com/moeru-ai/airi/pull/2509) `fix(stage-tamagotchi): restore macOS Steam signing` by **@Neko-233** *(2 comments)*
- [#2508](https://github.com/moeru-ai/airi/pull/2508) `fix(stage-ui): use touch events for mobile swipe` by **@nekomeowww** *(2 comments)*
- [#2502](https://github.com/moeru-ai/airi/pull/2502) `test(stage-tamagotchi): cover Fade on Hover interaction recovery` by **@lorenzozanee** *(1 comments)*
- [#2501](https://github.com/moeru-ai/airi/pull/2501) `chore(nix): update assets hash` by **@Weathercold** *(1 comments)*
- [#2503](https://github.com/moeru-ai/airi/pull/2503) `docs(contributing): align setup guides with pinned tooling` by **@S-FRANK88** *(1 comments)*
- [#2505](https://github.com/moeru-ai/airi/pull/2505) `fix(stage-ui): center mobile user message text` by **@nekomeowww** *(2 comments)*
- [#2504](https://github.com/moeru-ai/airi/pull/2504) `feat: custom Fish/OpenRouter TTS voices and OpenAI-compatible images` by **@lino22808108-stack** *(0 comments)*
- [#2500](https://github.com/moeru-ai/airi/pull/2500) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2499](https://github.com/moeru-ai/airi/pull/2499) `chore: optimize typecheck execution ` by **@nayounsang** *(1 comments)*

#### 🔄 PR Status & Lifecycle Changes (5)
- [#2471](https://github.com/moeru-ai/airi/pull/2471) `feat(stage-ui): sync user providers to a cloud replica` — `Draft` ➔ `Ready`
- [#2497](https://github.com/moeru-ai/airi/pull/2497) `fix(stage-ui): persist speech provider settings` — `OPEN` ➔ `MERGED`
- [#2490](https://github.com/moeru-ai/airi/pull/2490) `fix(stage-ui): restore TTS after first login` — `OPEN` ➔ `MERGED`
- [#2494](https://github.com/moeru-ai/airi/pull/2494) `fix(computer-use-mcp): fix type errors at serivce/computer-use-mcp` — `OPEN` ➔ `MERGED`
- [#2489](https://github.com/moeru-ai/airi/pull/2489) `feat(stage-ui): add swipe to reply for chat messages` — `OPEN` ➔ `MERGED`

---
## [2026-09-09] Upstream Delta: `f679616c..3e94ea81` (6 commits, 86 files, 18 PR update(s))

### 🎯 Executive Highlights
* **Active Focus**: Upstream merged 6 commits (`f679616c..3e94ea81`) covering small-window overflow scrolling for the Controls Island & Profile Switcher (#2474), signed-in nickname injection into chat prompts (#2488), telemetry migration from PostHog to OpenPanel (#2480), browser test fixture cleanup (#2492), and Nix hashes (#2495, #2496). On the PR radar, upstream is actively prototyping Live2D pseudo-3D ambient lighting with normal maps (#2498 [Draft]), fixing speech provider persistence (#2497), resolving post-login TTS initialization race conditions (#2490), adding swipe-to-reply chat gestures (#2489), and chat-round TTS billing (#2491).
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2497 (`fix(stage-ui): persist speech provider settings`) [Open PR]**: High-value bug fix addressing a critical flaw where entering credentials on fresh speech provider forms (e.g. OpenAI Compatible, Comet, VOICEVOX) fails to persist due to `initializeProvider` inspecting derived configs. Highly recommended for forward-porting (`provider.ts`, `config.ts`, `speech-provider-settings.vue`).
  - ⭐ **PR #2474 / Commit `5e78b64e3` (`profile-switcher-popover.vue` portion)**: Excellent UX bug fix for `packages/stage-ui/src/components/misc/profile-switcher-popover.vue` that teleports the "Save as new" profile creation popup to `<body>` and calculates viewport-clamped positioning to prevent truncation on small or narrow windows.
  - 🔍 **PR #2490 (`fix(stage-ui): restore TTS after first login`) [Open PR]**: Important fix resolving race conditions where initial tokenless voice catalog requests cache empty results. Inspect closely once merged to determine applicability to our fork's speech store.
* **Divergence / Collision Warnings**:
  - 🚨 **PR #2498 (`WIP live2d ambient light with normal map and pseudo-3d light remodel`) [Draft PR]**: Massive upcoming Live2D overhaul (+5,000 LOC, touching `Model.vue`, `Live2D.vue`, shaders, and display sampling). Conflicts fundamentally with our fork's Live2D Scripting DSL interpreter, VarFloats heap, and costume swapping. Do NOT merge directly; monitor for isolated shader/lighting techniques.
  - ⚠️ **PR #2488 / Commit `097202cd3` (`packages/stage-ui/src/stores/chat.ts`)**: Upstream added `createUserAccountContext` into `chat.ts` context snapshotting. Our fork has significantly diverged `chat.ts` and prompt builder pipelines; upstream account context injection should not be pulled directly.
  - ⚠️ **PR #2489 (`feat(stage-ui): add swipe to reply for chat messages`) [Open PR]**: Relies heavily on upstream's `packages/core-agent` orchestrator runtime and modified `InteractiveArea.vue`, which differs from our desktop chatbox architecture.
  - ⚪ **PR #2480 / Commit `66f0d4502` (`OpenPanel telemetry`) & PR #2491 (`TTS billing grouping`)**: Cloud telemetry and commercial billing features remain strictly rejected under fork policy (`⚪ ignore / rejected in fork`).

### 📋 Upstream Commits
- `3e94ea816` chore(nix): update pnpmDeps hash (#2496) [#2496](https://github.com/moeru-ai/airi/pull/2496) _(Weathercold, 2026-09-09)_
- `94873f851` chore(nix): update assets hash (#2495) [#2495](https://github.com/moeru-ai/airi/pull/2495) _(Weathercold, 2026-09-09)_
- `66f0d4502` refactor(analytics): replace PostHog with OpenPanel (#2480) [#2480](https://github.com/moeru-ai/airi/pull/2480) _(RainbowBird, 2026-09-09)_
- `5e78b64e3` fix(stage-tamagotchi): prevent controls island overflow in small windows with scroll (#2474) [#2474](https://github.com/moeru-ai/airi/pull/2474) _(Younsang Na, 2026-09-09)_
- `7bcd8e527` test(stage-ui): fix browser fixtures and cleanup (#2492) [#2492](https://github.com/moeru-ai/airi/pull/2492) _(leafyy, 2026-09-09)_
- `097202cd3` feat(stage-ui): add signed-in nickname context to chat prompts (#2488) [#2488](https://github.com/moeru-ai/airi/pull/2488) _(RainbowBird, 2026-09-08)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 13 file(s) (+116/-38)
- `.github/workflows/deploy-cloudflare-auth-ui.yml` *(+1/-9)*
- `.github/workflows/deploy-cloudflare-workers.yml` *(+1/-9)*
- `.github/workflows/deploy-huggingface-spaces.yml` *(+1/-1)*
- `.github/workflows/release-docker.yaml` *(+1/-1)*
- `.github/workflows/release-pocket-android.yml` *(+1/-1)*
- `.github/workflows/release-pocket-ios.yml` *(+1/-1)*
- `.github/workflows/release-tamagotchi-steam.yml` *(+1/-1)*
- `.github/workflows/release-tamagotchi.yml` *(+1/-1)*
- `deploy/openpanel/README.md` *(+83/-0)*
- `docs/.vitepress/modules/openpanel.ts` *(+23/-0)*
- `docs/.vitepress/modules/posthog.ts` *(+0/-12)*
- `docs/.vitepress/theme/index.ts` *(+1/-1)*
- `docs/package.json` *(+1/-1)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 7 file(s) (+8/-10)
- `apps/stage-pocket/package.json` *(+0/-1)*
- `apps/stage-pocket/src/main.ts` *(+2/-2)*
- `apps/stage-web/Dockerfile` *(+2/-2)*
- `apps/stage-web/package.json` *(+0/-1)*
- `apps/stage-web/src/main.ts` *(+2/-2)*
- `apps/stage-web/src/pages/settings/characters/components/CharacterDialog.vue` *(+1/-1)*
- `apps/stage-web/vite.config.ts` *(+1/-1)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 11 file(s) (+1015/-266)
- `apps/stage-tamagotchi/package.json` *(+0/-1)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/control-button-tooltip.vue` *(+23/-16)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-auth-button.test.ts` *(+41/-8)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-auth-button.vue` *(+13/-8)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-overflow.browser.test.ts` *(+523/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-profile-picker.vue` *(+5/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-stop-speaking.test.ts` *(+1/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/index.vue` *(+313/-226)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/use-controls-island-layout.ts` *(+89/-0)*
- `apps/stage-tamagotchi/src/renderer/main.ts` *(+2/-2)*
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` *(+5/-5)*

#### Root Build & Tooling (`🔍 inspect`) — 6 file(s) (+89/-117)
- `apps/ui-server-auth/package.json` *(+1/-1)*
- `package.json` *(+0/-1)*
- `packages/stage-shared/package.json` *(+1/-2)*
- `packages/stage-ui/package.json` *(+1/-1)*
- `pnpm-lock.yaml` *(+85/-111)*
- `server/apps/api/package.json` *(+1/-1)*

#### Other / Uncategorized (`🔍 inspect`) — 33 file(s) (+615/-907)
- `apps/ui-server-auth/src/main.ts` *(+3/-3)*
- `apps/ui-server-auth/vite.config.ts` *(+1/-1)*
- `nix/assets-hash.txt` *(+1/-1)*
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/stage-ui/src/components/misc/character-switcher-drawer.browser.test.ts` *(+28/-3)*
- `packages/stage-ui/src/components/misc/profile-switcher-popover.vue` *(+113/-60)*
- `packages/stage-ui/src/libs/auth-fetch.test.ts` *(+13/-13)*
- `packages/stage-ui/src/libs/auth-fetch.ts` *(+6/-6)*
- `packages/stage-ui/src/libs/product-signals/client.ts` *(+1/-1)*
- `packages/stage-ui/src/libs/product-signals/events/chat/events/generation.ts` *(+0/-13)*
- `packages/stage-ui/src/libs/product-signals/events/chat/events/index.ts` *(+0/-1)*
- `packages/stage-ui/src/libs/product-signals/events/chat/runtime.test.ts` *(+12/-22)*
- `packages/stage-ui/src/libs/product-signals/events/chat/runtime.ts` *(+0/-19)*
- `packages/stage-ui/src/libs/product-signals/openpanel.browser.test.ts` *(+65/-0)*
- `packages/stage-ui/src/libs/product-signals/openpanel.ts` *(+116/-0)*
- `packages/stage-ui/src/libs/product-signals/posthog.test.ts` *(+0/-52)*
- `packages/stage-ui/src/libs/product-signals/posthog.ts` *(+0/-79)*
- `packages/stage-ui/src/stores/mods/api/context-bridge.contract.browser.test.ts` *(+34/-42)*
- `pnpm-workspace.yaml` *(+2/-2)*
- `server/apps/api/src/app.test.ts` *(+0/-1)*
- `server/apps/api/src/app.ts` *(+10/-16)*
- `server/apps/api/src/libs/env.ts` *(+3/-7)*
- `server/apps/api/src/routes/openai/v1/operations/chat-completions/index.ts` *(+2/-91)*
- `server/apps/api/src/routes/openai/v1/route.test.ts` *(+3/-84)*
- `server/apps/api/src/routes/stripe/operations/checkout.ts` *(+9/-9)*
- `server/apps/api/src/routes/stripe/operations/webhook.ts` *(+7/-4)*
- `server/apps/api/src/routes/stripe/route.test.ts` *(+16/-12)*
- `server/apps/api/src/services/adapters/openpanel.test.ts` *(+58/-0)*
- `server/apps/api/src/services/adapters/openpanel.ts` *(+53/-0)*
- `server/apps/api/src/services/adapters/posthog.ts` *(+0/-81)*
- `server/apps/api/src/services/domain/product-events.test.ts` *(+34/-148)*
- `server/apps/api/src/services/domain/product-events.ts` *(+23/-133)*
- `vite-env.d.ts` *(+1/-2)*

#### Telemetry & Analytics (`⚪ ignore / rejected in fork`) — 8 file(s) (+127/-255)
- `apps/ui-server-auth/src/modules/analytics-adapters/openpanel.ts` *(+34/-0)*
- `apps/ui-server-auth/src/modules/analytics-adapters/posthog.ts` *(+0/-28)*
- `apps/ui-server-auth/src/modules/analytics.test.ts` *(+1/-1)*
- `packages/stage-shared/src/analytics/openpanel.ts` *(+5/-0)*
- `packages/stage-shared/src/analytics/posthog.ts` *(+0/-25)*
- `packages/stage-ui/src/composables/use-analytics.test.ts` *(+75/-144)*
- `packages/stage-ui/src/composables/use-analytics.ts` *(+5/-49)*
- `server/apps/api/src/routes/openai/v1/analytics.ts` *(+7/-8)*

#### Stage Layouts & Shells (`🔍 inspect`) — 1 file(s) (+0/-1)
- `packages/stage-layouts/package.json` *(+0/-1)*

#### UI Primitives & Pages (`📦 import / inspect`) — 2 file(s) (+5/-7)
- `packages/stage-pages/package.json` *(+0/-1)*
- `packages/stage-pages/src/pages/settings/flux.vue` *(+5/-6)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 5 file(s) (+159/-17)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+44/-15)*
- `packages/stage-ui/src/stores/chat.ts` *(+12/-2)*
- `packages/stage-ui/src/stores/chat/context-providers/index.ts` *(+1/-0)*
- `packages/stage-ui/src/stores/chat/context-providers/user-account.browser.test.ts` *(+69/-0)*
- `packages/stage-ui/src/stores/chat/context-providers/user-account.ts` *(+33/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (9)
- [#2490](https://github.com/moeru-ai/airi/pull/2490) `fix(stage-ui): restore TTS after first login` by **@Neko-233** *(2 comments)*
- [#2489](https://github.com/moeru-ai/airi/pull/2489) `feat(stage-ui): add swipe to reply for chat messages` by **@nekomeowww** *(2 comments)*
- [#2497](https://github.com/moeru-ai/airi/pull/2497) `fix(stage-ui): persist speech provider settings` by **@leaft** *(2 comments)*
- [#2498](https://github.com/moeru-ai/airi/pull/2498) `WIP live2d ambient light with normal map and pseudo-3d light remodel` by **@shinohara-rin** *(Draft)* *(1 comments)*
- [#2496](https://github.com/moeru-ai/airi/pull/2496) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2494](https://github.com/moeru-ai/airi/pull/2494) `fix(computer-use-mcp): fix type errors at serivce/computer-use-mcp` by **@nayounsang** *(1 comments)*
- [#2495](https://github.com/moeru-ai/airi/pull/2495) `chore(nix): update assets hash` by **@Weathercold** *(1 comments)*
- [#2492](https://github.com/moeru-ai/airi/pull/2492) `test(stage-ui): fix browser fixtures and cleanup` by **@leaft** *(2 comments)*
- [#2491](https://github.com/moeru-ai/airi/pull/2491) `feat(stage-pages): group TTS billing by chat round` by **@luoling8192** *(2 comments)*

#### 🔄 PR Status & Lifecycle Changes (6)
- [#2480](https://github.com/moeru-ai/airi/pull/2480) `refactor(analytics): replace PostHog with OpenPanel` — `OPEN` ➔ `MERGED`, `Draft` ➔ `Ready`
- [#2441](https://github.com/moeru-ai/airi/pull/2441) `feat(stage): add Whiteboard as a extension` — `OPEN` ➔ `CLOSED`
- [#2474](https://github.com/moeru-ai/airi/pull/2474) `fix(stage-tamagotchi): prevent controls island overflow in small windows with scroll` — `OPEN` ➔ `MERGED`
- [#2486](https://github.com/moeru-ai/airi/pull/2486) `feat(stage-ui): confirm sign-out with keep or wipe options` — ➔ `Draft`
- [#2471](https://github.com/moeru-ai/airi/pull/2471) `feat(stage-ui): sync user providers to a cloud replica` — ➔ `Draft`
- [#2488](https://github.com/moeru-ai/airi/pull/2488) `feat(stage-ui): add signed-in nickname context to chat prompts` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (3)
- [#2480](https://github.com/moeru-ai/airi/pull/2480) `refactor(analytics): replace PostHog with OpenPanel` — *+1 comments (1 ➔ 2 total)*
- [#2441](https://github.com/moeru-ai/airi/pull/2441) `feat(stage): add Whiteboard as a extension` — *+1 comments (2 ➔ 3 total)*
- [#2474](https://github.com/moeru-ai/airi/pull/2474) `fix(stage-tamagotchi): prevent controls island overflow in small windows with scroll` — *+1 comments (5 ➔ 6 total)*

---
## [2026-09-08] Upstream Delta: `52a9f429..f679616c` (6 commits, 41 files, 15 PR update(s))

### 🎯 Executive Highlights
* **Active Focus**: Upstream merged 6 commits spanning configurable LLM sampling parameters (temperature, top_p in #2200), character card global settings inheritance (#2332), onboarding dialog suppression when provider credentials exist (#1900), and Electron onboarding sign-in window retention (#2482). On PR radar, upstream is working on bilingual subtitles (#2485, #2487), Live2D lip-sync preservation during MAGIC motion (#2481), account context injection (#2488), and OpenPanel analytics (#2480 [Draft]).
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2200 / Commit `e293b71ab` (`feat: add support for temperature, top_p to be configurable`)**: High value feature adding temperature and top_p controls to Consciousness settings. Recommended for surgical port into `useConsciousnessStore`, `consciousness.vue`, and `chat.ts` -> `llm.ts` (adapting to our fork's `useLLM` rather than upstream's `core-agent`).
  - ⭐ **PR #2481 (`fix(stage-ui-live2d): preserve lip sync during MAGIC motion`) [Open PR]**: High-value Live2D fix preventing motion sequences from freezing lip sync during speech playback.
  - ⭐ **PR #2414 (`fix(pipelines-audio): preserve multi-code-unit grapheme clusters in TTS chunking`) [Discussion]**: Critical text segmentation fix preventing surrogate pair / emoji corruption in TTS streams.
  - 🔍 **PR #1900 / Commit `332883d42` (`fix(stage-ui): onboarding repeat prompt when provider credentials exist`)**: Useful startup provider credential snapshot pattern to prevent accidental onboarding re-triggers.
* **Divergence / Collision Warnings**:
  - 🚨 **PR #2332 / Commit `ef9f122d5` (`airi-card.ts` & Card Editors)**: Massive refactor (+1086/-365) in `packages/stage-ui/src/stores/modules/airi-card.ts`. Direct merge would clobber our fork's custom companion mounting, dream turns, proactivity gating, voice profile merging by ID, and navigation logic. Requires manual surgical adoption if card inheritance is desired.
  - 🚨 **PR #2200 / Commit `e293b71ab` (`packages/core-agent`)**: Upstream continues building on `packages/core-agent`, which is absent in `dasilva333/airi`. Our fork dispatches via `packages/stage-ui/src/stores/llm.ts`. Do not import `core-agent` dependencies.
  - ⚠️ **PR #2482 / Commit `f679616c3` (`apps/stage-tamagotchi/.../onboarding.vue`)**: Upstream patched their legacy onboarding page for browser OAuth callbacks. Our fork uses the custom `OnboardingV2` component tree; this change is inapplicable.
  - ⚪ **PR #2480 (`feat(analytics): route product events to OpenPanel`)**: OpenPanel telemetry is explicitly rejected under our fork's privacy principles (`⚪ ignore / rejected in fork`).

### 📋 Upstream Commits
- `f679616c3` fix(stage-tamagotchi): allow sign-in on the first attempt (#2482) [#2482](https://github.com/moeru-ai/airi/pull/2482) _(Lovehsigure_520, 2026-09-08)_
- `ef9f122d5` fix(stage-ui): inherit global settings for default card (#2332) [#2332](https://github.com/moeru-ai/airi/pull/2332) _(RainbowBird, 2026-09-08)_
- `9a4e1da5a` test(stage-ui): fix tests  _(Makito, 2026-09-08)_
- `332883d42` fix(stage-ui): onboarding repeat prompt when provider credentials exist (#1900) [#1900](https://github.com/moeru-ai/airi/pull/1900) _(Sho Jikumaru, 2026-09-07)_
- `e293b71ab` feat: add support for temperature, top_p to be configurable (#2200) [#2200](https://github.com/moeru-ai/airi/pull/2200) _(Vikranth Kumar Bala, 2026-09-07)_
- `66c6aa9b5` chore: ignore .worktrees  _(RainbowBird, 2026-09-04)_

### 🔬 Subsystem Breakdown
#### Other / Uncategorized (`🔍 inspect`) — 20 file(s) (+970/-184)
- `.gitignore` *(+1/-0)*
- `packages/provider-inference/src/providers/cloud/amazon-bedrock/index.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/providers/providers/official/constants.ts` *(+6/-0)*
- `packages/stage-ui/src/libs/providers/providers/official/index.ts` *(+2/-5)*
- `packages/stage-ui/src/services/airi-card-editor.test.ts` *(+51/-1)*
- `packages/stage-ui/src/services/airi-card-editor.ts` *(+43/-0)*
- `packages/stage-ui/src/services/airi-card-modules.ts` *(+18/-0)*
- `packages/stage-ui/src/stores/mods/api/context-bridge.ts` *(+3/-1)*
- `packages/stage-ui/src/stores/modules/airi-card-inheritance.browser.test.ts` *(+112/-0)*
- `packages/stage-ui/src/stores/modules/airi-card-inheritance.test.ts` *(+298/-0)*
- `packages/stage-ui/src/stores/modules/airi-card.test.ts` *(+71/-34)*
- `packages/stage-ui/src/stores/modules/airi-card.ts` *(+223/-115)*
- `packages/stage-ui/src/stores/modules/consciousness.ts` *(+16/-0)*
- `packages/stage-ui/src/stores/modules/default.ts` *(+1/-1)*
- `packages/stage-ui/src/stores/onboarding.test.ts` *(+48/-1)*
- `packages/stage-ui/src/stores/onboarding.ts` *(+7/-0)*
- `packages/stage-ui/src/types/character.ts` *(+5/-0)*
- `server/apps/api/src/routes/characters/schema.ts` *(+8/-15)*
- `server/apps/api/src/services/domain/characters.ts` *(+55/-11)*
- `server/apps/api/src/types/character-capability.ts` *(+1/-0)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 5 file(s) (+35/-21)
- `apps/stage-pocket/src/App.vue` *(+2/-5)*
- `apps/stage-pocket/src/pages/index.vue` *(+7/-2)*
- `apps/stage-web/src/App.vue` *(+2/-5)*
- `apps/stage-web/src/pages/index.vue` *(+7/-2)*
- `apps/stage-web/src/pages/settings/characters/components/CharacterDialog.vue` *(+17/-7)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 4 file(s) (+161/-40)
- `apps/stage-tamagotchi/src/renderer/App.vue` *(+2/-5)*
- `apps/stage-tamagotchi/src/renderer/composables/use-onboarding-authentication.test.ts` *(+87/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-onboarding-authentication.ts` *(+63/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/onboarding.vue` *(+9/-35)*

#### Core Agent Runtime (`🔍 inspect`) — 3 file(s) (+19/-0)
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts` *(+6/-0)*
- `packages/core-agent/src/runtime/llm-service.ts` *(+2/-0)*
- `packages/core-agent/src/types/llm.ts` *(+11/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+14/-3)
- `packages/i18n/src/locales/en/settings.yaml` *(+7/-2)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+7/-1)*

#### UI Primitives & Pages (`📦 import / inspect`) — 5 file(s) (+250/-192)
- `packages/stage-pages/src/pages/settings/airi-card/components/CardCreationDialog.vue` *(+159/-109)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardDetailDialog.vue` *(+11/-22)*
- `packages/stage-pages/src/pages/settings/modules/consciousness.vue` *(+37/-11)*
- `packages/stage-pages/src/pages/settings/modules/speech.vue` *(+26/-35)*
- `packages/stage-pages/src/pages/settings/modules/vision.vue` *(+17/-15)*

#### Documentation & Scaffolding (`⚪ ignore`) — 1 file(s) (+25/-0)
- `packages/stage-ui/README.md` *(+25/-0)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 1 file(s) (+6/-0)
- `packages/stage-ui/src/stores/chat.ts` *(+6/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (12)
- [#2488](https://github.com/moeru-ai/airi/pull/2488) `feat(stage-ui): add signed-in nickname context to chat prompts` by **@luoling8192** *(2 comments)*
- [#2487](https://github.com/moeru-ai/airi/pull/2487) `feat(stage): add bilingual subtitles` by **@phx3334** *(0 comments)*
- [#2486](https://github.com/moeru-ai/airi/pull/2486) `feat(stage-ui): confirm sign-out with keep or wipe options` by **@lulu0119** *(1 comments)*
- [#2485](https://github.com/moeru-ai/airi/pull/2485) `feat(stage): user-configurable bilingual subtitles (speak one languag…` by **@phx3334** *(0 comments)*
- [#2484](https://github.com/moeru-ai/airi/pull/2484) `feat(stage-ui): show Cloud announcements on Web and Electron` by **@luoling8192** *(2 comments)*
- [#2483](https://github.com/moeru-ai/airi/pull/2483) `fix(auth): discard stale authentication requests` by **@luoling8192** *(2 comments)*
- [#2480](https://github.com/moeru-ai/airi/pull/2480) `feat(analytics): route product events to OpenPanel` by **@luoling8192** *(Draft)* *(1 comments)*
- [#2482](https://github.com/moeru-ai/airi/pull/2482) `fix(stage-tamagotchi): allow sign-in on the first attempt` by **@Neko-233** *(2 comments)*
- [#2332](https://github.com/moeru-ai/airi/pull/2332) `fix(stage-ui): inherit global settings for default card` by **@luoling8192** *(2 comments)*
- [#2481](https://github.com/moeru-ai/airi/pull/2481) `fix(stage-ui-live2d): preserve lip sync during MAGIC motion` by **@Arata1202** *(2 comments)*
- [#1900](https://github.com/moeru-ai/airi/pull/1900) `fix(stage-ui): onboarding repeat prompt when provider credentials exist` by **@shojikumaru** *(3 comments)*
- [#2200](https://github.com/moeru-ai/airi/pull/2200) `feat: add support for temperature, top_p to be configurable` by **@VikranthBala** *(7 comments)*

#### 💬 Discussion Activity (3)
- [#2474](https://github.com/moeru-ai/airi/pull/2474) `fix(stage-tamagotchi): prevent controls island overflow in small windows with scroll` — *+3 comments (2 ➔ 5 total)*
- [#2414](https://github.com/moeru-ai/airi/pull/2414) `fix(pipelines-audio): preserve multi-code-unit grapheme clusters in TTS chunking` — *+1 comments (3 ➔ 4 total)*
- [#2415](https://github.com/moeru-ai/airi/pull/2415) `fix(stage-ui): deliver sends issued during the transport prepare phase` — *+1 comments (2 ➔ 3 total)*

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
