# AIRI Upstream Radar

> **Living Intelligence Ledger**: Tracks continuous delta from upstream (`moeru-ai/airi`) to inform selective, high-value forward-porting into `dasilva333/airi`.
> Generated and maintained by Antigravity Scheduled Tasks via `scripts/upstream-tracker.mjs`.
> Guided by: [`docs/project-selective-upstream-sync-protocol.md`](./project-selective-upstream-sync-protocol.md).

---

## 👁️ Active Upstream Watchlist (High-Interest Monitored PRs)

| PR | Title | Author | State | Priority / Rationale | Tracking Directives & Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [#2634](https://github.com/moeru-ai/airi/pull/2634) | `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` | `@peachoolong-uwu` | `Draft` (0 comments) | 🔴 **High Alert** (Radical divergence) | Proposes external Cortico daemon (`ws://localhost:6122`) replacing native memory. **Directive**: Monitor maintainer reaction to 2-process requirement & Web/Mobile breakage. Hold off on comments until maintainers triage. |
| [#2672](https://github.com/moeru-ai/airi/pull/2672) | `refactor(stage-ui): bind conversations to window-local characters` | `@luoling8192` | `Open` (20 comments) | 🟡 **Architectural Interest** (Window decoupling) | Decouples character definition from window selection, scopes conversations to window-local character, adds standalone profile page and shared CharacterCard. **Directive**: Track decoupling pattern across windows and evaluate shared CharacterCard component. |
| [#2541](https://github.com/moeru-ai/airi/pull/2541) | `Telltworose/feat/drop in plugins` (MCP-first tool architecture) | `@telltworose` | `Open` (Changes Requested) | 🟢 **Direct Fork Influence** (Security & MCP) | Author pivoted 180° away from in-process Node loader to MCP stdio child processes + card-level scoping (`tools.allowed`) per `@dasilva333`'s comment. **Directive**: Monitor author rebase and explanation to maintainer `@0xSelenicDove` regarding deleted files and merge conflicts. |
| [#2290](https://github.com/moeru-ai/airi/pull/2290) | `feat(server): stream official ASR over WebSocket` | `@luoling8192` | `Open` (Changes Requested) | 🟡 **Audio Architecture** (ASR transport) | Official ASR streaming transport. User `@dasilva333` suggested OpenAI-compatible HTTP SSE (`stream: true`) to avoid per-utterance WS handshake overhead. **Directive**: Track author rebase and backend transport/billing decisions. |
| [#2120](https://github.com/moeru-ai/airi/pull/2120) | `refactor(stage-pages): rebuild AIRI Card editor` | `@luoling8192` | `Open` (Changes Requested) | 🟡 **UI Architecture** (Editor lifecycle) | Rebuilding card editor in `stage-pages`. User `@dasilva333` shared dedicated route design. **Directive**: Track dirty-draft browser unload protection and component decoupling. |

---

<!-- RADAR_ENTRIES -->

## [2026-10-09] Upstream Delta: `142e7596..a94e2055` (19 commits, 118 files, 54 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus & Key Merges**: Upstream merged 19 commits (`142e7596`..`a94e2055`) alongside 54 PR updates (13 new PRs, 27 lifecycle transitions, 14 discussion updates):
  1. **Remote MCP Servers over Streamable HTTP (PR #2821 / Commit `9e95900984` by @clansty)**: Major expansion of Model Context Protocol support in Electron desktop shell. Adds streamable HTTP (SSE/POST) remote MCP client capabilities alongside local stdio child processes, including typed eventa IPC channels, settings forms (`McpServerForm.vue`), and connection test panels.
  2. **Voice Composer & Inlay Window Maturation (PR #2858 / Commit `02b22bf292`, PR #2876 / Commit `0327dc8fcf`, PR #2875 / Commit `f48dab2276` by @nekomeowww)**: Continuing upstream's voice blitz from yesterday: redesigned voice inlay window bounds/rendering (`voice-inlay.vue`), compact waveform bubbles for voice messages (`voice-waveform.vue`), and optimistic rendering of voice message bubbles while speech-to-text transcripts are streaming. Concurrently, upstream bulk-closed older mobile/pocket background hearing and calling-word PRs (#2731, #2728, #2730, #2721, #2546, #2708, #2727).
  3. **Settings UI Unification with SettingsCard (PR #2868 / Commit `f2a45286fc` by @clansty)**: Completed the merge unifying all module settings pages (artistry, beat-sync, consciousness, hearing, speech, vision, mcp, home-assistant) using the new `@proj-airi/ui` `SettingsCard` layout primitive.
  4. **3D & Audio Pipeline Engine Bugfixes (PR #2862 / Commit `9eea59a038` by @FlowerWater1019, PR #2760 / Commit `3cb8c1b991` by @0xSelenicDove)**: PR #2862 anchors VRM hips animation tracks to local coordinates instead of world coordinates (fixing unintended world-space translation during animation playback). PR #2760 isolates stale audio playback completion callbacks in `playback-manager.ts`.
  5. **Danmaku Feed Read-Message Expiry (PR #2809 / Commit `e84ae6a452` by @chiba233)**: Added auto-hiding / expiry of read messages in the tamagotchi danmaku feed (`use-chat-feed-expiry.ts`, `use-danmaku-feed-expiry.ts`).
  6. **Superseded Streaming Token Syntax Removal (PR #2873 / Commit `a94e2055f0` by @lulu0119)**: Pruned superseded streaming token syntax from queues and response categorisers.
  7. **Lifecycle & Watched PR Movement**: Watched PR #2672 (`refactor(stage-ui): bind conversations to window-local characters`) was CLOSED by @luoling8192; PR #2869 (sync Live2D/VRM models to private storage) transitioned from Draft to Ready.
* **Discussion & Community Buzz**:
  - 💬 **#2696: `feat(inference): manage Sherpaw model assets across hosts` (+7 comments, 19 total)**: Spike in discussion velocity regarding multi-host model mirrors and artifact management for Sherpaw inference.
  - 💬 **#2459: `fix(core-agent): prevent plain-text tool call leaks` (+3 comments, 45 total)**: Active discussion around regex filtering and preventing raw JSON tool invocations from leaking into user-visible chat streaming.
  - 💬 **#2760: `fix(pipelines-audio): isolate stale playback completions` (+2 comments, 4 total)**: Review and verification prior to merging.
  - 💬 **#2546: `feat(stage-ui): add voice messages and mobile dictation` (+1 comment, 170 total)**: Massive multi-week voice PR closed after final cleanup.
  - 💬 **#2708: `feat(hearing): add character wake words across clients` (+1 comment, 37 total)**: Closed alongside the pocket/hearing batch.
  - 💬 **#2209: `feat(stage-ui): add emotion and relationship bond state` (+1 comment, 11 total)**: Steady incremental interest in character bonding/relationship models.
  - 👁️ **Watched PRs Radar**:
    - **#2672: `refactor(stage-ui): bind conversations to window-local characters`** (CLOSED): Closed by @luoling8192. Maintainers have closed or superseded the window-local conversation binding PR.
    - **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain`** [Draft] (1 comment): Unchanged / dormant.
    - **#2541: `Telltworose/feat/drop in plugins` (MCP-first architecture)** [Open] (59 comments): Unchanged / changes requested.
    - **#2290: `feat(server): stream official ASR over WebSocket`** [Open] (59 comments): Unchanged / changes requested.
    - **#2120: `refactor(stage-pages): rebuild AIRI Card editor`** [Open] (41 comments): Unchanged / changes requested.
* **Cherry-Pick Candidates**:
  - 💎 **PR #2862 / Commit `9eea59a038`: `fix(stage-ui-three): anchor VRM animation tracks in local space` by @FlowerWater1019**: High-value 3D/VRM fix. Prevents unintended world-space drift / translation offset bugs during VRM animation playback in `packages/stage-ui-three/src/composables/vrm/animation.ts`. Clean, self-contained, backed by 130 lines of tests.
  - 💎 **PR #2760 / Commit `3cb8c1b991`: `fix(pipelines-audio): isolate stale playback completions` by @0xSelenicDove**: High-value audio pipeline fix in `packages/pipelines-audio/src/managers/playback-manager.ts`. Prevents race conditions where interrupted or superseded playback attempts fire stale completion callbacks, disrupting queue state.
  - 💎 **PR #2821 / Commit `9e95900984`: `feat(stage-tamagotchi): support remote MCP servers over streamable HTTP` by @clansty**: Extends Model Context Protocol beyond local stdio child processes to streamable HTTP endpoints (`SSE/HTTP POST`), allowing users to connect remote MCP servers or cloud-hosted tool backends without local process spawning.
  - 💎 **PR #2818 / Commit `beeaf0b878`: `fix(stage-ui): enforce required OpenRouter reasoning` by @nayounsang**: Ensures models requiring OpenRouter reasoning (e.g. DeepSeek R1 / thinking models) correctly receive reasoning configurations instead of silent failures or schema rejection.
  - 💎 **PR #2826 / Commit `b27a00fbb0`: `fix(stage-tamagotchi): set isFileClosed in finally block so flag is always set on close` by @bitxwolf**: Robust file logger cleanup in `apps/stage-tamagotchi/src/main/app/file-logger.ts`.
  - 💎 **PR #2824 / Commit `1f0772aee6`: `fix(tamagotchi): move once() wrapper to module level so guard actually works` by @bitxwolf**: Tray event listener bug fix preventing duplicate registration.
  - ✅ **SQUATTED [dasilva333/airi]: PR #2872 / Commit `d6545e9c21`: `fix(stage-shared): make useLocalStorageManualReset reset to the initial value` by @chiba233**: Already squatted and ported into `packages/stage-shared/src/composables/use-local-storage-manual-reset.ts` with unit tests yesterday; upstream has now officially merged it.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **PR #2886, Commits `4577fdcbab`, `aa89a4dc6c`, `21af6f4546`**: Cloud server auth and OAuth dev session cookies (`server/apps/auth`, `api-dev.airi.build`). Violates offline/local-first architecture.
    - **PR #2858, #2875, #2876 (Commits `02b22bf292`, `0327dc8fcf`, `f48dab2276`)**: Inlay window voice composer redesign and voice message bubbles. Diverges from our decoupled Control Strip and multi-actor speech architecture.
    - **PR #2809 (Commit `e84ae6a452`)**: Danmaku feed expiry in `apps/stage-tamagotchi`. Upstream tamagotchi floating chat window differs substantially from our decoupled Control Strip chat experience.
    - **PR #2869**: Sync Live2D and VRM models to private cloud storage. Local-first invariant reject.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts` (Commit `f48dab2276` / PR #2875)**: Upstream touched `chat.ts` (+88/-10 lines) to add voice message tracking and transcript state transitions. In our fork, `chat.ts` is 2,300+ lines with `<|ACTOR|>` slices, timeline tracking, and memory grounding. Never pull upstream `chat.ts` directly.
  - ⚠️ **`apps/stage-tamagotchi/src/main/services/airi/mcp-servers/` (Commit `9e95900984` / PR #2821)**: Upstream refactored MCP server management for streamable HTTP. When adapting this feature, ensure it integrates into our Injeca dependency injection container without overwriting fork-specific Electron service initializers.
  - ⚠️ **`packages/stage-pages/src/pages/settings/modules/` (Commit `f2a45286fc` / PR #2868)**: Upstream migrated all settings pages to `SettingsCard`. In our fork, modules like `consciousness.vue` contain rich custom controls (autonomous artistry, memory pillars, Jev decisions). Port `SettingsCard` styling carefully without clobbering fork-specific UI blocks.

### 📋 Upstream Commits
- `a94e2055f0` refactor(stage-ui): remove superseded streaming token syntax (#2873) [#2873](https://github.com/moeru-ai/airi/pull/2873) _(Lulu, 2026-10-09)_
- `4577fdcbab` fix(auth): point server-dev at api-dev.airi.build (#2886) [#2886](https://github.com/moeru-ai/airi/pull/2886) _(Lulu, 2026-10-09)_
- `aa89a4dc6c` Revert "fix(auth): set the dev session cookie before OAuth authorize"  _(RainbowBird, 2026-10-09)_
- `21af6f4546` fix(auth): set the dev session cookie before OAuth authorize  _(Lulu, 2026-10-09)_
- `0327dc8fcf` feat(stage-ui): show voice messages as a compact waveform bubble (#2876) [#2876](https://github.com/moeru-ai/airi/pull/2876) _(Neko, 2026-10-09)_
- `3cb8c1b991` fix(pipelines-audio): isolate stale playback completions (#2760) [#2760](https://github.com/moeru-ai/airi/pull/2760) _(Columbina, 2026-10-08)_
- `8e2e1fce14` fix(tamagotchi): preserve existing config when updating update channel (#2819) [#2819](https://github.com/moeru-ai/airi/pull/2819) _(Bit Wolf, 2026-10-09)_
- `beeaf0b878` fix(stage-ui): enforce required OpenRouter reasoning (#2818) [#2818](https://github.com/moeru-ai/airi/pull/2818) _(Younsang Na, 2026-10-09)_
- `6b153c37a9` fix(tamagotchi): replace getErrorMessage wrapper with errorMessageFrom from @moeru/std (#2820) [#2820](https://github.com/moeru-ai/airi/pull/2820) _(Bit Wolf, 2026-10-09)_
- `1f0772aee6` fix(tamagotchi): move once() wrapper to module level so guard actually works (#2824) [#2824](https://github.com/moeru-ai/airi/pull/2824) _(Bit Wolf, 2026-10-09)_
- `9e95900984` feat(stage-tamagotchi): support remote MCP servers over streamable HTTP (#2821) [#2821](https://github.com/moeru-ai/airi/pull/2821) _(凌莞~(=^▽^=), 2026-10-09)_
- `b27a00fbb0` fix(stage-tamagotchi): set isFileClosed in finally block so flag is always set on close (#2826) [#2826](https://github.com/moeru-ai/airi/pull/2826) _(Bit Wolf, 2026-10-09)_
- `bc5bd8d77c` fix(stage-tamagotchi): use structured logger instead of console.error for startup failure (#2827) [#2827](https://github.com/moeru-ai/airi/pull/2827) _(Bit Wolf, 2026-10-09)_
- `9eea59a038` fix(stage-ui-three): anchor VRM animation tracks in local space (#2862) [#2862](https://github.com/moeru-ai/airi/pull/2862) _(Penluna, 2026-10-09)_
- `e84ae6a452` feat(stage-tamagotchi): hide read messages in the danmaku feed (#2809) [#2809](https://github.com/moeru-ai/airi/pull/2809) _(蓝莓🫐, 2026-10-09)_
- `d6545e9c21` fix(stage-shared): make useLocalStorageManualReset reset to the initial value (#2872) [#2872](https://github.com/moeru-ai/airi/pull/2872) _(蓝莓🫐, 2026-10-09)_
- `f2a45286fc` refactor(ui,stage-ui,stage-pages,stage-tamagotchi): unify module settings pages with SettingsCard (#2868) [#2868](https://github.com/moeru-ai/airi/pull/2868) _(凌莞~(=^▽^=), 2026-10-09)_
- `f48dab2276` fix(stage-ui): show a voice message at once while its transcript comes (#2875) [#2875](https://github.com/moeru-ai/airi/pull/2875) _(Neko, 2026-10-09)_
- `02b22bf292` feat(stage-tamagotchi): redesign the voice inlay (#2858) [#2858](https://github.com/moeru-ai/airi/pull/2858) _(Neko, 2026-10-09)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 4 file(s) (+13/-4)
- `.github/workflows/deploy-cloudflare-workers-dev-server.yml` *(+2/-2)*
- `apps/ui-server-auth/README.md` *(+1/-1)*
- `docs/ai/context/ui-components.md` *(+8/-0)*
- `packages/stage-ui/README.md` *(+2/-1)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 2 file(s) (+2/-8)
- `apps/stage-pocket/src/pages/devtools/performance-playground.vue` *(+1/-4)*
- `apps/stage-web/src/pages/devtools/performance-playground.vue` *(+1/-4)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 39 file(s) (+1828/-516)
- `apps/stage-tamagotchi/src/main/app/file-logger.ts` *(+8/-13)*
- `apps/stage-tamagotchi/src/main/index.ts` *(+10/-10)*
- `apps/stage-tamagotchi/src/main/services/airi/mcp-servers/index.test.ts` *(+42/-3)*
- `apps/stage-tamagotchi/src/main/services/airi/mcp-servers/index.ts` *(+127/-89)*
- `apps/stage-tamagotchi/src/main/tray/index.ts` *(+177/-173)*
- `apps/stage-tamagotchi/src/main/windows/chat/index.ts` *(+3/-3)*
- `apps/stage-tamagotchi/src/main/windows/chat/rpc/index.electron.ts` *(+3/-3)*
- `apps/stage-tamagotchi/src/main/windows/desktop-overlay/index.ts` *(+3/-3)*
- `apps/stage-tamagotchi/src/main/windows/desktop-overlay/rpc/index.electron.test.ts` *(+4/-4)*
- `apps/stage-tamagotchi/src/main/windows/desktop-overlay/rpc/index.electron.ts` *(+3/-3)*
- `apps/stage-tamagotchi/src/main/windows/inlay/bounds.test.ts` *(+40/-0)*
- `apps/stage-tamagotchi/src/main/windows/inlay/bounds.ts` *(+37/-0)*
- `apps/stage-tamagotchi/src/main/windows/inlay/index.ts` *(+4/-31)*
- `apps/stage-tamagotchi/src/main/windows/main/index.ts` *(+3/-3)*
- `apps/stage-tamagotchi/src/main/windows/main/rpc/index.electron.ts` *(+3/-3)*
- `apps/stage-tamagotchi/src/main/windows/settings/index.ts` *(+3/-3)*
- `apps/stage-tamagotchi/src/main/windows/settings/rpc/index.electron.ts` *(+3/-3)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+8/-0)*
- `apps/stage-tamagotchi/src/renderer/components/chat-viewport-layout.browser.test.ts` *(+10/-1)*
- `apps/stage-tamagotchi/src/renderer/components/chat-window/chat-danmaku-feed-menu.browser.test.ts` *(+49/-0)*
- `apps/stage-tamagotchi/src/renderer/components/chat-window/chat-danmaku-feed-menu.vue` *(+100/-0)*
- `apps/stage-tamagotchi/src/renderer/components/inlay/voice-inlay.browser.test.ts` *(+65/-0)*
- `apps/stage-tamagotchi/src/renderer/components/inlay/voice-inlay.vue` *(+57/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-chat-feed-expiry.browser.test.ts` *(+229/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-chat-feed-expiry.ts` *(+157/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-danmaku-feed-expiry.ts` *(+55/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-danmaku-feed-settings.ts` *(+43/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-speech-output-voicing.ts` *(+51/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/chat-floating.vue` *(+14/-1)*
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` *(+4/-5)*
- `apps/stage-tamagotchi/src/renderer/pages/inlay/index.vue` *(+2/-40)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/modules/components/McpConnectionTestPanel.vue` *(+5/-7)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/modules/components/McpServerForm.vue` *(+63/-20)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/modules/home-assistant.vue` *(+3/-3)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/modules/mcp-config.test.ts` *(+98/-14)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/modules/mcp-config.ts` *(+128/-23)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/modules/mcp.vue` *(+26/-24)*
- `apps/stage-tamagotchi/src/shared/eventa/index.ts` *(+61/-22)*
- `apps/stage-tamagotchi/src/shared/mcp-config.ts` *(+127/-9)*

#### Other / Uncategorized (`🔍 inspect`) — 44 file(s) (+1104/-296)
- `apps/ui-server-auth/src/modules/server-auth-context.test.ts` *(+5/-5)*
- `apps/ui-server-auth/src/modules/server-auth-context.ts` *(+1/-1)*
- `apps/ui-server-auth/src/modules/sign-in.test.ts` *(+3/-3)*
- `packages/pipelines-audio/src/llm-streaming-control/index.test.ts` *(+0/-17)*
- `packages/pipelines-audio/src/managers/playback-manager.test.ts` *(+37/-0)*
- `packages/pipelines-audio/src/managers/playback-manager.ts` *(+10/-1)*
- `packages/provider-inference/src/index.ts` *(+1/-0)*
- `packages/provider-inference/src/model-catalog.ts` *(+2/-0)*
- `packages/provider-inference/src/types.ts` *(+2/-0)*
- `packages/stage-shared/src/composables/use-local-storage-manual-reset/index.test.ts` *(+95/-0)*
- `packages/stage-shared/src/composables/use-local-storage-manual-reset/index.ts` *(+18/-3)*
- `packages/stage-ui/src/components/modules/GamingMinecraft.vue` *(+3/-9)*
- `packages/stage-ui/src/components/modules/GamingModuleSettings.vue` *(+3/-3)*
- `packages/stage-ui/src/components/modules/MessagingDiscord.vue` *(+3/-3)*
- `packages/stage-ui/src/components/modules/WebSearch.vue` *(+3/-9)*
- `packages/stage-ui/src/components/modules/X.vue` *(+3/-3)*
- `packages/stage-ui/src/components/modules/stickers.vue` *(+3/-3)*
- `packages/stage-ui/src/components/scenarios/chat/components/history-layout.browser.test.ts` *(+10/-1)*
- `packages/stage-ui/src/components/scenarios/chat/components/history-message-frame.vue` *(+14/-2)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.browser.test.ts` *(+120/-2)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.vue` *(+13/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/user-item.vue` *(+18/-5)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-drafts.browser.test.ts` *(+45/-7)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-drafts.vue` *(+128/-58)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-message-player.browser.test.ts` *(+67/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-message-player.vue` *(+154/-19)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-waveform.vue` *(+8/-24)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-history-scroll.ts` *(+21/-7)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-voice-composer.ts` *(+12/-0)*
- `packages/stage-ui/src/composables/queues.ts` *(+1/-49)*
- `packages/stage-ui/src/composables/response-categoriser.test.ts` *(+13/-13)*
- `packages/stage-ui/src/composables/voice-drafts.ts` *(+13/-1)*
- `packages/stage-ui/src/constants/index.ts` *(+0/-2)*
- `packages/stage-ui/src/features/motions/live2d/settings.ts` *(+3/-3)*
- `packages/stage-ui/src/libs/voice/voice-message.test.ts` *(+48/-0)*
- `packages/stage-ui/src/libs/voice/voice-message.ts` *(+51/-33)*
- `packages/stage-ui/src/libs/voice/waveform.test.ts` *(+26/-0)*
- `packages/stage-ui/src/libs/voice/waveform.ts` *(+70/-0)*
- `packages/stage-ui/src/services/speech/bus.ts` *(+17/-1)*
- `packages/stage-ui/src/stores/modules/consciousness.test.ts` *(+19/-0)*
- `packages/stage-ui/src/stores/modules/consciousness.ts` *(+26/-0)*
- `packages/stage-ui/src/stores/modules/stickers.ts` *(+2/-2)*
- `packages/stage-ui/src/stores/settings/beat-sync.ts` *(+2/-2)*
- `packages/stage-ui/src/stores/voice-messages.ts` *(+11/-5)*

#### Core Agent Runtime (`🔍 inspect`) — 5 file(s) (+39/-19)
- `packages/core-agent/README.md` *(+2/-0)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.test.ts` *(+13/-3)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts` *(+3/-2)*
- `packages/core-agent/src/runtime/response-categoriser.test.ts` *(+13/-13)*
- `packages/core-agent/src/types/chat.ts` *(+8/-1)*

#### Localization (i18n) (`📦 import (additive only)`) — 7 file(s) (+68/-4)
- `packages/i18n/src/locales/en/settings.yaml` *(+20/-1)*
- `packages/i18n/src/locales/en/stage.yaml` *(+4/-1)*
- `packages/i18n/src/locales/en/tamagotchi/stage.yaml` *(+8/-0)*
- `packages/i18n/src/locales/ko/settings.yaml` *(+6/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+18/-1)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+4/-1)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/stage.yaml` *(+8/-0)*

#### UI Primitives & Pages (`📦 import / inspect`) — 8 file(s) (+64/-41)
- `packages/stage-pages/src/pages/settings/modules/artistry.vue` *(+3/-2)*
- `packages/stage-pages/src/pages/settings/modules/beat-sync.vue` *(+3/-3)*
- `packages/stage-pages/src/pages/settings/modules/consciousness.vue` *(+22/-6)*
- `packages/stage-pages/src/pages/settings/modules/hearing.vue` *(+3/-3)*
- `packages/stage-pages/src/pages/settings/modules/speech.vue` *(+3/-2)*
- `packages/stage-pages/src/pages/settings/modules/vision.vue` *(+24/-25)*
- `packages/ui/src/components/layouts/index.ts` *(+1/-0)*
- `packages/ui/src/components/layouts/settings-card.vue` *(+5/-0)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 3 file(s) (+154/-8)
- `packages/stage-ui-three/src/composables/vrm/animation.test.ts` *(+130/-1)*
- `packages/stage-ui-three/src/composables/vrm/animation.ts` *(+7/-5)*
- `packages/stage-ui/src/components/scenes/Stage.vue` *(+17/-2)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 2 file(s) (+130/-10)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+49/-1)*
- `packages/stage-ui/src/stores/chat.ts` *(+81/-9)*

#### Provider & Model Integrations (`📦 import / inspect`) — 1 file(s) (+3/-0)
- `packages/stage-ui/src/stores/providers/provider.ts` *(+3/-0)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 3 file(s) (+10/-10)
- `server/apps/auth/src/routes.ts` *(+1/-1)*
- `server/apps/auth/src/tests/auth.test.ts` *(+2/-2)*
- `server/apps/auth/src/tests/routes-ui.test.ts` *(+7/-7)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (13)
- [#2873](https://github.com/moeru-ai/airi/pull/2873) `refactor(stage-ui): remove superseded streaming token syntax` by **@lulu0119** *(2 comments)*
- [#2888](https://github.com/moeru-ai/airi/pull/2888) `Feature/secretary custom` by **@HoangIT-69** *(1 comments)*
- [#2887](https://github.com/moeru-ai/airi/pull/2887) `fix(stage-ui): persist automatic official speech selections` by **@starvingarc** *(2 comments)*
- [#2886](https://github.com/moeru-ai/airi/pull/2886) `fix(auth): point server-dev at api-dev.airi.build` by **@lulu0119** *(2 comments)*
- [#2885](https://github.com/moeru-ai/airi/pull/2885) `feat(custom): add Vietnamese secretary character card` by **@HoangIT-69** *(1 comments)*
- [#2881](https://github.com/moeru-ai/airi/pull/2881) `refactor(server): share one error model between the API and Auth services` by **@luoling8192** *(2 comments)*
- [#2880](https://github.com/moeru-ai/airi/pull/2880) `chore(i18n): update translations` by **@github-actions** *(2 comments)*
- [#2878](https://github.com/moeru-ai/airi/pull/2878) `feat(stage-ui): store chat images and recordings as asset references` by **@nekomeowww** *(2 comments)*
- [#2879](https://github.com/moeru-ai/airi/pull/2879) `feat(core-agent): support per-request output token limits` by **@FlowerWater1019** *(2 comments)*
- [#2876](https://github.com/moeru-ai/airi/pull/2876) `feat(stage-ui): show voice messages as a compact waveform bubble` by **@nekomeowww** *(2 comments)*
- [#2877](https://github.com/moeru-ai/airi/pull/2877) `fix(core-agent): retry transient speech synthesis failures` by **@FlowerWater1019** *(2 comments)*
- [#2875](https://github.com/moeru-ai/airi/pull/2875) `fix(stage-ui): show a voice message at once while its transcript comes` by **@nekomeowww** *(2 comments)*
- [#2874](https://github.com/moeru-ai/airi/pull/2874) `fix(api,stage-ui): keep the character of synchronized chats` by **@luoling8192** *(Draft)* *(1 comments)*

#### 🔄 PR Status & Lifecycle Changes (27)
- [#2731](https://github.com/moeru-ai/airi/pull/2731) `feat(stage-pocket): add Android background calling words` — `OPEN` ➔ `CLOSED`
- [#2728](https://github.com/moeru-ai/airi/pull/2728) `feat(stage-pocket): share foreground hearing lifecycle` — `OPEN` ➔ `CLOSED`
- [#2869](https://github.com/moeru-ai/airi/pull/2869) `feat(api,stage-ui): sync Live2D and VRM models to private storage` — `Draft` ➔ `Ready`
- [#2730](https://github.com/moeru-ai/airi/pull/2730) `feat(hearing): connect foreground calling word capture` — `OPEN` ➔ `CLOSED`
- [#2721](https://github.com/moeru-ai/airi/pull/2721) `fix(chat): adapt voice input to dynamic provider requests` — `OPEN` ➔ `CLOSED`
- [#2546](https://github.com/moeru-ai/airi/pull/2546) `feat(stage-ui): add voice messages and mobile dictation` — `OPEN` ➔ `CLOSED`
- [#2708](https://github.com/moeru-ai/airi/pull/2708) `feat(hearing): add character wake words across clients` — `OPEN` ➔ `CLOSED`
- [#2727](https://github.com/moeru-ai/airi/pull/2727) `feat(stage-tamagotchi): add recording indicator and session drafts` — `OPEN` ➔ `CLOSED`
- [#2760](https://github.com/moeru-ai/airi/pull/2760) `fix(pipelines-audio): isolate stale playback completions` — `OPEN` ➔ `MERGED`
- [#2819](https://github.com/moeru-ai/airi/pull/2819) `fix(tamagotchi): preserve existing config when updating update channel` — `OPEN` ➔ `MERGED`
- [#2824](https://github.com/moeru-ai/airi/pull/2824) `fix(tamagotchi): move once() wrapper to module level so guard actually works` — `OPEN` ➔ `MERGED`
- [#2818](https://github.com/moeru-ai/airi/pull/2818) `fix(stage-ui): enforce required OpenRouter reasoning` — `OPEN` ➔ `MERGED`
- [#2820](https://github.com/moeru-ai/airi/pull/2820) `fix(tamagotchi): replace getErrorMessage wrapper with errorMessageFrom from @moeru/std` — `OPEN` ➔ `MERGED`
- [#2821](https://github.com/moeru-ai/airi/pull/2821) `feat(stage-tamagotchi): support remote MCP servers over streamable HTTP` — `OPEN` ➔ `MERGED`
- [#2786](https://github.com/moeru-ai/airi/pull/2786) `docs(security): update vulnerability reporting policy` — `OPEN` ➔ `CLOSED`
- [#2826](https://github.com/moeru-ai/airi/pull/2826) `fix(tamagotchi): set isFileClosed in finally block so flag is always set on close` — `OPEN` ➔ `MERGED`
- [#2862](https://github.com/moeru-ai/airi/pull/2862) `fix(stage-ui-three): anchor VRM animation tracks in local space` — `OPEN` ➔ `MERGED`
- [#2827](https://github.com/moeru-ai/airi/pull/2827) `fix(stage-tamagotchi): use structured logger instead of console.error for startup failure` — `OPEN` ➔ `MERGED`
- [#2842](https://github.com/moeru-ai/airi/pull/2842) `feat(provider-inference): add Opper provider` — `OPEN` ➔ `CLOSED`
- [#2845](https://github.com/moeru-ai/airi/pull/2845) `test(stage-ui): pin the clock in sessions drawer time label tests` — `OPEN` ➔ `CLOSED`
- [#2809](https://github.com/moeru-ai/airi/pull/2809) `feat(stage-tamagotchi): hide read messages in the danmaku feed` — `OPEN` ➔ `MERGED`
- [#2872](https://github.com/moeru-ai/airi/pull/2872) `fix(stage-shared): make useLocalStorageManualReset reset to the initial value` — `OPEN` ➔ `MERGED`
- [#2868](https://github.com/moeru-ai/airi/pull/2868) `refactor(ui,stage-ui,stage-pages,stage-tamagotchi): unify module settings pages with SettingsCard` — `OPEN` ➔ `MERGED`
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` — `OPEN` ➔ `CLOSED`
- [#2693](https://github.com/moeru-ai/airi/pull/2693) `feat(api-server): add contact-owned character synchronization` — `OPEN` ➔ `CLOSED`
- [#2694](https://github.com/moeru-ai/airi/pull/2694) `feat(stage-ui): synchronize character contacts and direct histories` — `OPEN` ➔ `CLOSED`
- [#2858](https://github.com/moeru-ai/airi/pull/2858) `feat(stage-tamagotchi): redesign the voice inlay` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (14)
- [#2696](https://github.com/moeru-ai/airi/pull/2696) `feat(inference): manage Sherpaw model assets across hosts` — *+7 comments (12 ➔ 19 total)*
- [#2459](https://github.com/moeru-ai/airi/pull/2459) `fix(core-agent): prevent plain-text tool call leaks` — *+3 comments (42 ➔ 45 total)*
- [#2731](https://github.com/moeru-ai/airi/pull/2731) `feat(stage-pocket): add Android background calling words` — *+1 comments (0 ➔ 1 total)*
- [#2728](https://github.com/moeru-ai/airi/pull/2728) `feat(stage-pocket): share foreground hearing lifecycle` — *+1 comments (0 ➔ 1 total)*
- [#2209](https://github.com/moeru-ai/airi/pull/2209) `feat(stage-ui): add emotion and relationship bond state` — *+1 comments (10 ➔ 11 total)*
- [#2869](https://github.com/moeru-ai/airi/pull/2869) `feat(api,stage-ui): sync Live2D and VRM models to private storage` — *+1 comments (1 ➔ 2 total)*
- [#2712](https://github.com/moeru-ai/airi/pull/2712) `test(testing-audio): cover wake word detection` — *+1 comments (3 ➔ 4 total)*
- [#2725](https://github.com/moeru-ai/airi/pull/2725) `feat(stage-ui): pin chat turns and model steps to the session character` — *+1 comments (0 ➔ 1 total)*
- [#2730](https://github.com/moeru-ai/airi/pull/2730) `feat(hearing): connect foreground calling word capture` — *+1 comments (0 ➔ 1 total)*
- [#2721](https://github.com/moeru-ai/airi/pull/2721) `fix(chat): adapt voice input to dynamic provider requests` — *+1 comments (0 ➔ 1 total)*
- [#2546](https://github.com/moeru-ai/airi/pull/2546) `feat(stage-ui): add voice messages and mobile dictation` — *+1 comments (169 ➔ 170 total)*
- [#2708](https://github.com/moeru-ai/airi/pull/2708) `feat(hearing): add character wake words across clients` — *+1 comments (36 ➔ 37 total)*
- [#2727](https://github.com/moeru-ai/airi/pull/2727) `feat(stage-tamagotchi): add recording indicator and session drafts` — *+1 comments (0 ➔ 1 total)*
- [#2760](https://github.com/moeru-ai/airi/pull/2760) `fix(pipelines-audio): isolate stale playback completions` — *+2 comments (2 ➔ 4 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(1 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` [Draft] — *(48 comments)*
  - *Focus*: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard
- [#2541](https://github.com/moeru-ai/airi/pull/2541) `Telltworose/feat/drop in plugins` [OPEN] — *(59 comments)*
  - *Focus*: MCP stdio child processes & card-level tool scoping; track author rebase and explanation to maintainers regarding deleted in-process loader
- [#2290](https://github.com/moeru-ai/airi/pull/2290) `feat(server): stream official ASR over WebSocket` [OPEN] — *(59 comments)*
  - *Focus*: Official ASR streaming over WebSocket vs OpenAI-compatible HTTP SSE; track rebase and backend transport decisions
- [#2120](https://github.com/moeru-ai/airi/pull/2120) `refactor(stage-pages): rebuild AIRI Card editor` [OPEN] — *(41 comments)*
  - *Focus*: Card editor overhaul in stage-pages, dirty draft protection, route vs modal lifecycles

---
## [2026-10-08] Upstream Delta: `8772fbb2..142e7596` (15 commits, 135 files, 30 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus & Key Merges**: Upstream merged 15 commits (`8772fbb2`..`142e7596`) alongside 30 PR updates (18 new PRs, 7 lifecycle transitions, 5 discussion updates):
  1. **Voice Input Inlay & Composer Expansion (PR #2857 / Commit `142e7596cf` by @nekomeowww, PR #2773 / Commit `947e26ed85`, PR #2761 / Commit `523eedcba1`)**: Large client-side overhaul (+2506/-640 lines) adding dedicated voice composer components (`voice-composer.vue`, `voice-input-button.vue`, `voice-waveform.vue`, `use-voice-composer.ts`) across desktop, web, and mobile layouts (`MobileInteractiveArea.vue`). Pairs with real-time transcript streaming and LLM transcript rephrasing (`voice-rephrase.ts`).
  2. **First-Class Home Assistant Integration (PR #2865 / Commit `dd1b8a1f8c` by @clansty)**: Promoted Home Assistant from an external plugin (`plugins/airi-plugin-homeassistant/` deleted) into native core tooling. Adds Electron main service (`services/airi/home-assistant/`), eventa IPC channels, typed tools in `stage-ui/src/tools/home-assistant.ts`, client in `stage-ui/src/libs/home-assistant/`, and settings in `stage-pages`.
  3. **Cloud Character Card & Asset Sync Expansion (PR #2850 / Commit `b6cd1e97c8`, PR #2852, Draft PR #2869 by @luoling8192)**: Rollout of hosted backend synchronization continued with `airi-card.ts` field sync defect fixes (PR #2850), cross-device card sync (PR #2852), and a new draft to sync Live2D/VRM models to private cloud storage (PR #2869).
  4. **UI Design Tokens & Card Architecture (PR #2868 by @clansty, PR #2854 / Commit `45b8670e63` by @luoling8192, PR #2864 / Commit `cb50eff594`)**: Unifying module settings pages with a new `SettingsCard` primitive in `@proj-airi/ui`, fixing muted card contrast (`CARD_MUTED`), refining mobile bottom-drawer interactions, and introducing an automated UI component adoption audit script (`scripts/audit-ui-components.mjs`).
* **Discussion & Community Buzz**:
  - 💬 **#2197: `feat(live2d): support Cubism 2 through generation-specific loaders` (+3 comments, 74 total)**: Active discussion around legacy Cubism 2 model support and generation-specific runtime loader segregation.
  - 💬 **#2458: `feat(stage): add character-owned Live2D controls` (+2 comments, 65 total)**: Ongoing discussion regarding character-owned Live2D controls and parameters.
  - 💬 **#2868: `refactor(ui,stage-ui,stage-pages,stage-tamagotchi): unify module settings pages with SettingsCard` (6 comments)**: Active design discussion on card hierarchy nesting, contrast in light/dark themes, and MCP settings grouping.
  - 💬 **#2852: `feat(server,stage-ui,stage-pages): sync character cards between devices` (8 comments)**: Active automated Codex reviews on server-side character card synchronization.
  - 💬 **#2813: `feat(api,stage-ui): bill subscriptions and Flux packs through RevenueCat` (+1 comment, 2 total)**: Discussion on upstream hosted billing infrastructure.
  - 💬 **#2696: `feat(inference): manage Sherpaw model assets across hosts` (+1 comment, 12 total)**: Asset distribution and mirror hosting for Sherpaw models.
  - 👁️ **Watched PRs Radar**:
    - **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain`** [Draft] (1 comment): Dormant. Maintainers have not triaged the 2-process daemon requirement or Web/Mobile parity concerns.
    - **#2672: `refactor(stage-ui): bind conversations to window-local characters`** [Draft] (48 comments): High architectural interest; tracking window-local conversation decoupling.
    - **#2541: `Telltworose/feat/drop in plugins` (MCP-first architecture)** [Open] (59 comments): Changes requested; awaiting maintainer rebase review.
    - **#2290: `feat(server): stream official ASR over WebSocket`** [Open] (59 comments): Changes requested; awaiting transport decision.
    - **#2120: `refactor(stage-pages): rebuild AIRI Card editor`** [Open] (41 comments): Changes requested; dirty-draft route design under review.
* **Cherry-Pick Candidates**:
  - ✅ **SQUATTED [dasilva333/airi]: PR #2872: `fix(stage-shared): make useLocalStorageManualReset reset to the initial value` by @chiba233**: Squatted and ported into `packages/stage-shared/src/composables/use-local-storage-manual-reset.ts` with comprehensive unit tests (`use-local-storage-manual-reset.test.ts`). Fixes `reset()` failing to restore initial values due to referencing the storage ref directly, object proxy in-place mutations polluting default objects in memory, and getter defaults returning uncalled function references instead of evaluated defaults. Also updated `packages/stage-ui/src/features/motions/live2d/settings.ts` to call `.reset()`.
  - 💎 **PR #2862: `fix(stage-ui-three): anchor VRM animation tracks in local space` by @FlowerWater1019**: High-value 3D/VRM fix. Prevents unintended displacement during animation playback by anchoring hips position in local coordinates instead of world coordinates in `packages/stage-ui-three/src/composables/vrm/animation.ts`.
  - 💎 **PR #2863 / Commit `9f9f583d2c`: `fix(audio): stop encoder leaks and unhandled rejections on cancel` by @nekomeowww**: Audio pipeline hygiene. Gracefully swallows `reader.cancel()` rejections on aborted audio streams in `packages/audio/src/encoding/pcm-stream.ts` and ensures explicit sample closure in `media-file.ts`.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **PR #2865**: Home Assistant built-in service & tool in `apps/stage-tamagotchi` / `stage-ui`. In our fork, external home automation belongs as an MCP stdio server rather than monolithic Electron main services.
    - **PR #2850 / PR #2852 / PR #2869**: Hosted cloud card sync and model storage in `server/apps/api`. Violates our local-first offline BYOS architecture.
    - **PR #2857 / PR #2773 / PR #2761**: Voice composer inlay & transcript rephrase. Diverges from our decoupled Control Strip and multi-actor speech architecture.
    - **PR #2867**: `use-linked-accounts` spinner fix for cloud account auth (not present in our fork).
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts` (PR #2859 / Commit `dedbbf4474`)**: Upstream modified retry mechanics to restore turns on failure. Our fork's `chat.ts` is 2,300+ lines with deeply divergent multi-actor `<|ACTOR|>` slices, intrusions, Nan0 runtime, and memory grounding. Never merge upstream `chat.ts` directly.
  - ⚠️ **`apps/stage-tamagotchi/src/main/services/airi/` & Inlay Window (Commits `dd1b8a1f8c`, `947e26ed85`, `523eedcba1`)**: Upstream added Home Assistant main services and inlay voice drafts directly inside `apps/stage-tamagotchi`. Our fork uses decoupled Control Strip architecture, Injeca dependency injection, and clean window boundaries.
  - ⚠️ **`packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` (Commits `cb50eff594`, `142e7596cf`)**: Upstream restructured mobile layout for voice composer buttons and drawer interactions.

### 📋 Upstream Commits
- `142e7596cf` feat(stage-ui): voice input controls for desktop, web, and mobile composers (#2857) [#2857](https://github.com/moeru-ai/airi/pull/2857) _(Neko, 2026-10-08)_
- `cb50eff594` fix(stage-layouts): refine mobile settings drawer interactions (#2864) [#2864](https://github.com/moeru-ai/airi/pull/2864) _(RainbowBird, 2026-10-08)_
- `f0e751f2e3` fix(stage-ui): stop the linked-account button from spinning forever in Electron (#2867) [#2867](https://github.com/moeru-ai/airi/pull/2867) _(凌莞~(=^▽^=), 2026-10-08)_
- `dd1b8a1f8c` feat(stage-tamagotchi,stage-ui): control Home Assistant through typed tools (#2865) [#2865](https://github.com/moeru-ai/airi/pull/2865) _(凌莞~(=^▽^=), 2026-10-08)_
- `dedbbf4474` fix(stage-ui): keep the source turn when a retry fails before storage (#2859) [#2859](https://github.com/moeru-ai/airi/pull/2859) _(Neko, 2026-10-08)_
- `9f9f583d2c` fix(audio): stop encoder leaks and unhandled rejections on cancel (#2863) [#2863](https://github.com/moeru-ai/airi/pull/2863) _(Neko, 2026-10-08)_
- `077c3757f0` fix(stage-ui): open the browser default microphone by name (#2866) [#2866](https://github.com/moeru-ai/airi/pull/2866) _(Neko, 2026-10-08)_
- `45b8670e63` test(stage-ui): add shared component stories and adoption audit (#2854) [#2854](https://github.com/moeru-ai/airi/pull/2854) _(RainbowBird, 2026-10-08)_
- `b8b5080142` chore(nix): update pnpmDeps hash (#2848) [#2848](https://github.com/moeru-ai/airi/pull/2848) _(Weathercold, 2026-10-07)_
- `523eedcba1` feat(stage-ui): stream voice transcripts in the inlay and rewrite them with a chat model (#2761) [#2761](https://github.com/moeru-ai/airi/pull/2761) _(Neko, 2026-10-08)_
- `d8935c6ad7` test(stage-ui): run sessions drawer time labels at a fixed noon (#2853) [#2853](https://github.com/moeru-ai/airi/pull/2853) _(Neko, 2026-10-08)_
- `55f1a0377e` feat(provider-inference,vite-plugin-sherpaw): serve sherpaw model artifacts from a mirror (#2822) [#2822](https://github.com/moeru-ai/airi/pull/2822) _(凌莞~(=^▽^=), 2026-10-08)_
- `639dabe178` fix(stage-ui): broadcast spark commands from the LLM tool again (#2823) [#2823](https://github.com/moeru-ai/airi/pull/2823) _(凌莞~(=^▽^=), 2026-10-08)_
- `947e26ed85` feat(stage-tamagotchi): show voice drafts in a composer-style inlay (#2773) [#2773](https://github.com/moeru-ai/airi/pull/2773) _(Neko, 2026-10-07)_
- `b6cd1e97c8` fix(api,stage-ui): correct character card sync defects from #2817 (#2850) [#2817](https://github.com/moeru-ai/airi/pull/2817) _(Neko, 2026-10-07)_

### 🔬 Subsystem Breakdown
#### Electron Desktop Shell (`⚠️ hand-merge`) — 20 file(s) (+810/-218)
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/index.vue` *(+1/-2)*
- `apps/stage-tamagotchi/electron.vite.config.ts` *(+1/-0)*
- `apps/stage-tamagotchi/src/main/index.ts` *(+3/-1)*
- `apps/stage-tamagotchi/src/main/services/airi/home-assistant/index.ts` *(+103/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/home-assistant/request.test.ts` *(+111/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/home-assistant/request.ts` *(+111/-0)*
- `apps/stage-tamagotchi/src/main/windows/inlay/index.ts` *(+17/-7)*
- `apps/stage-tamagotchi/src/main/windows/inlay/rpc/index.electron.ts` *(+7/-0)*
- `apps/stage-tamagotchi/src/main/windows/main/index.ts` *(+2/-0)*
- `apps/stage-tamagotchi/src/main/windows/main/rpc/index.electron.ts` *(+8/-0)*
- `apps/stage-tamagotchi/src/renderer/App.vue` *(+5/-0)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+10/-12)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+63/-99)*
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` *(+20/-4)*
- `apps/stage-tamagotchi/src/renderer/pages/inlay/index.vue` *(+34/-93)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/modules/home-assistant.vue` *(+157/-0)*
- `apps/stage-tamagotchi/src/renderer/stores/tools/home-assistant.ts` *(+108/-0)*
- `apps/stage-tamagotchi/src/renderer/stores/tools/index.ts` *(+1/-0)*
- `apps/stage-tamagotchi/src/shared/eventa/home-assistant.ts` *(+45/-0)*
- `apps/stage-tamagotchi/src/shared/eventa/index.ts` *(+3/-0)*

#### Documentation & Scaffolding (`⚪ ignore`) — 7 file(s) (+1059/-2)
- `docs/ai/adr/2026-09-22-sherpaw-model-assets.md` *(+2/-0)*
- `docs/ai/adr/2026-10-06-home-assistant-integration.md` *(+161/-0)*
- `docs/ai/audits/ui-components.csv` *(+672/-0)*
- `docs/ai/audits/ui-components.md` *(+189/-0)*
- `docs/ai/context/ui-components.md` *(+4/-0)*
- `packages/stage-ui/README.md` *(+9/-2)*
- `packages/vite-plugin-sherpaw/README.md` *(+22/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 79 file(s) (+4688/-366)
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/audio/src/encoding/media-file.test.ts` *(+27/-1)*
- `packages/audio/src/encoding/media-file.ts` *(+9/-2)*
- `packages/audio/src/encoding/pcm-stream.browser.test.ts` *(+34/-0)*
- `packages/audio/src/encoding/pcm-stream.ts` *(+3/-1)*
- `packages/plugin-protocol/src/types/events.ts` *(+9/-1)*
- `packages/provider-inference/src/providers/local/sherpaw-transcription/models.test.ts` *(+19/-1)*
- `packages/provider-inference/src/providers/local/sherpaw-transcription/models.ts` *(+19/-2)*
- `packages/server-runtime/src/middlewares/route.test.ts` *(+22/-0)*
- `packages/stage-ui/src/components/animations/transitions.story.vue` *(+46/-0)*
- `packages/stage-ui/src/components/form/combobox/combobox.story.vue` *(+38/-0)*
- `packages/stage-ui/src/components/form/field/remaining-fields.story.vue` *(+33/-0)*
- `packages/stage-ui/src/components/layouts/bottom-drawer.story.vue` *(+74/-0)*
- `packages/stage-ui/src/components/layouts/collapsible.story.vue` *(+28/-0)*
- `packages/stage-ui/src/components/layouts/scrollable-area.story.vue` *(+17/-0)*
- `packages/stage-ui/src/components/layouts/truncatable.story.vue` *(+20/-0)*
- `packages/stage-ui/src/components/misc/alerts.story.vue` *(+30/-0)*
- `packages/stage-ui/src/components/misc/avatar.story.vue` *(+22/-0)*
- `packages/stage-ui/src/components/misc/basic-button.story.vue` *(+24/-0)*
- `packages/stage-ui/src/components/misc/dropdown-menu.story.vue` *(+33/-0)*
- `packages/stage-ui/src/components/misc/error-boundary.story.vue` *(+47/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/send-button.browser.test.ts` *(+49/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/send-button.vue` *(+84/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-drawer.browser.test.ts` *(+19/-3)*
- `packages/stage-ui/src/components/scenarios/chat/components/tool-call-shell.story.vue` *(+27/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/user-item.vue` *(+16/-5)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-composer.browser.test.ts` *(+141/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-composer.vue` *(+379/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-drafts.browser.test.ts` *(+103/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-drafts.vue` *(+157/-9)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-input-button.browser.test.ts` *(+149/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-input-button.vue` *(+443/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-message-controls.browser.test.ts` *(+0/-79)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-message-controls.vue` *(+0/-124)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-message-player.vue` *(+70/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-message-preview.vue` *(+0/-38)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-waveform.vue` *(+71/-0)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-hover-menu.ts` *(+70/-0)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-voice-composer.ts` *(+263/-0)*
- `packages/stage-ui/src/components/scenarios/chat/index.ts` *(+3/-1)*
- `packages/stage-ui/src/components/scenarios/dialogs/bottom-drawer.browser.test.ts` *(+31/-0)*
- `packages/stage-ui/src/components/scenarios/settings/settings-bars.story.vue` *(+29/-0)*
- `packages/stage-ui/src/components/scenarios/status/status-capsule.story.vue` *(+29/-0)*
- `packages/stage-ui/src/composables/audio/audio-device.ts` *(+10/-3)*
- `packages/stage-ui/src/composables/use-linked-accounts.browser.test.ts` *(+127/-0)*
- `packages/stage-ui/src/composables/use-linked-accounts.test.ts` *(+32/-7)*
- `packages/stage-ui/src/composables/use-linked-accounts.ts` *(+67/-3)*
- `packages/stage-ui/src/composables/use-modules-list.ts` *(+11/-0)*
- `packages/stage-ui/src/composables/voice-rephrase.ts` *(+59/-0)*
- `packages/stage-ui/src/libs/document-sync/synchronize.test.ts` *(+23/-0)*
- `packages/stage-ui/src/libs/document-sync/synchronize.ts` *(+7/-2)*
- `packages/stage-ui/src/libs/home-assistant/client.test.ts` *(+162/-0)*
- `packages/stage-ui/src/libs/home-assistant/client.ts` *(+139/-0)*
- `packages/stage-ui/src/libs/voice/input-level.test.ts` *(+58/-0)*
- `packages/stage-ui/src/libs/voice/input-level.ts` *(+30/-0)*
- `packages/stage-ui/src/libs/voice/voice-message.test.ts` *(+55/-0)*
- `packages/stage-ui/src/libs/voice/voice-message.ts` *(+60/-7)*
- `packages/stage-ui/src/libs/voice/voice-rephrase-plugin.test.ts` *(+113/-0)*
- `packages/stage-ui/src/libs/voice/voice-rephrase-plugin.ts` *(+75/-0)*
- `packages/stage-ui/src/services/speech/bus.ts` *(+62/-9)*
- `packages/stage-ui/src/stores/ai/chat-llm/tool-resolver.test.ts` *(+62/-0)*
- `packages/stage-ui/src/stores/ai/chat-llm/tool-resolver.ts` *(+7/-6)*
- `packages/stage-ui/src/stores/modules/airi-card-sync.browser.test.ts` *(+36/-4)*
- `packages/stage-ui/src/stores/modules/airi-card.test.ts` *(+48/-0)*
- `packages/stage-ui/src/stores/modules/airi-card.ts` *(+46/-17)*
- `packages/stage-ui/src/stores/modules/hearing-status.browser.test.ts` *(+2/-2)*
- `packages/stage-ui/src/stores/modules/hearing.ts` *(+11/-0)*
- `packages/stage-ui/src/stores/modules/home-assistant.ts` *(+42/-0)*
- `packages/stage-ui/src/stores/settings/audio-device.browser.test.ts` *(+24/-7)*
- `packages/stage-ui/src/stores/voice-controls.ts` *(+14/-2)*
- `packages/stage-ui/src/stores/voice-messages.browser.test.ts` *(+76/-0)*
- `packages/stage-ui/src/stores/voice-messages.ts` *(+63/-11)*
- `packages/stage-ui/src/stores/voice.ts` *(+81/-4)*
- `packages/stage-ui/src/tools/home-assistant.test.ts` *(+191/-0)*
- `packages/stage-ui/src/tools/home-assistant.ts` *(+153/-0)*
- `packages/vite-plugin-sherpaw/src/index.test.ts` *(+33/-0)*
- `packages/vite-plugin-sherpaw/src/index.ts` *(+21/-3)*
- `plugins/airi-plugin-homeassistant/src/index.ts` *(+0/-1)*
- `plugins/airi-plugin-homeassistant/tsdown.config.ts` *(+0/-10)*

#### Core Agent Runtime (`🔍 inspect`) — 5 file(s) (+34/-9)
- `packages/core-agent/src/agents/spark-command/schema.ts` *(+2/-2)*
- `packages/core-agent/src/agents/spark-command/tools.test.ts` *(+4/-3)*
- `packages/core-agent/src/agents/spark-command/tools.ts` *(+4/-3)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.test.ts` *(+14/-0)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts` *(+10/-1)*

#### Localization (i18n) (`📦 import (additive only)`) — 6 file(s) (+130/-14)
- `packages/i18n/src/locales/en/settings.yaml` *(+33/-0)*
- `packages/i18n/src/locales/en/stage.yaml` *(+31/-6)*
- `packages/i18n/src/locales/en/tamagotchi/stage.yaml` *(+1/-1)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+33/-0)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+31/-6)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/stage.yaml` *(+1/-1)*

#### Stage Layouts & Shells (`🔍 inspect`) — 4 file(s) (+265/-334)
- `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` *(+44/-30)*
- `packages/stage-layouts/src/components/Layouts/mobile-settings-drawer.vue` *(+148/-91)*
- `packages/stage-layouts/src/components/Widgets/ChatArea.vue` *(+73/-136)*
- `packages/stage-layouts/src/components/Widgets/IndicatorMicVolume.vue` *(+0/-77)*

#### UI Primitives & Pages (`📦 import / inspect`) — 5 file(s) (+121/-5)
- `packages/stage-pages/src/pages/settings/modules/hearing.vue` *(+60/-0)*
- `packages/stage-pages/src/pages/settings/modules/home-assistant.vue` *(+41/-0)*
- `packages/ui/src/components/form/textarea/basic-text-area.vue` *(+5/-2)*
- `packages/ui/src/components/layouts/bottom-drawer.vue` *(+8/-2)*
- `packages/ui/src/components/misc/dropdown-menu.vue` *(+7/-1)*

#### Root Build & Tooling (`🔍 inspect`) — 5 file(s) (+191/-55)
- `packages/stage-ui/package.json` *(+1/-0)*
- `plugins/airi-plugin-homeassistant/package.json` *(+0/-15)*
- `plugins/airi-plugin-homeassistant/tsconfig.json` *(+0/-31)*
- `pnpm-lock.yaml` *(+0/-9)*
- `scripts/audit-ui-components.mjs` *(+190/-0)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 2 file(s) (+64/-7)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+33/-0)*
- `packages/stage-ui/src/stores/chat.ts` *(+31/-7)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 2 file(s) (+29/-3)
- `server/apps/api/src/services/domain/field-sync/store.test.ts` *(+23/-0)*
- `server/apps/api/src/services/domain/field-sync/store.ts` *(+6/-3)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (18)
- [#2872](https://github.com/moeru-ai/airi/pull/2872) `fix(stage-shared): make useLocalStorageManualReset reset to the initial value` by **@chiba233** *(2 comments)*
- [#2868](https://github.com/moeru-ai/airi/pull/2868) `refactor(ui,stage-ui,stage-pages,stage-tamagotchi): unify module settings pages with SettingsCard` by **@clansty** *(6 comments)*
- [#2858](https://github.com/moeru-ai/airi/pull/2858) `feat(stage-tamagotchi): redesign the voice inlay` by **@nekomeowww** *(2 comments)*
- [#2857](https://github.com/moeru-ai/airi/pull/2857) `feat(stage-ui): voice input controls for desktop, web, and mobile composers` by **@nekomeowww** *(2 comments)*
- [#2871](https://github.com/moeru-ai/airi/pull/2871) `docs(agents): require UI test review on the final commit` by **@luoling8192** *(2 comments)*
- [#2870](https://github.com/moeru-ai/airi/pull/2870) `feat(ui): use outline icon for avatar placeholders` by **@luoling8192** *(2 comments)*
- [#2864](https://github.com/moeru-ai/airi/pull/2864) `fix(stage-layouts): refine mobile settings drawer interactions` by **@luoling8192** *(3 comments)*
- [#2869](https://github.com/moeru-ai/airi/pull/2869) `feat(api,stage-ui): sync Live2D and VRM models to private storage` by **@luoling8192** *(Draft)* *(1 comments)*
- [#2867](https://github.com/moeru-ai/airi/pull/2867) `fix(stage-ui): stop the linked-account button from spinning forever in Electron` by **@clansty** *(2 comments)*
- [#2865](https://github.com/moeru-ai/airi/pull/2865) `feat(stage-tamagotchi,stage-ui): control Home Assistant through typed tools` by **@clansty** *(3 comments)*
- [#2863](https://github.com/moeru-ai/airi/pull/2863) `fix(audio): stop encoder leaks and unhandled rejections on cancel` by **@nekomeowww** *(2 comments)*
- [#2859](https://github.com/moeru-ai/airi/pull/2859) `fix(stage-ui): keep the source turn when a retry fails before storage` by **@nekomeowww** *(2 comments)*
- [#2866](https://github.com/moeru-ai/airi/pull/2866) `fix(stage-ui): open the browser default microphone by name` by **@nekomeowww** *(2 comments)*
- [#2862](https://github.com/moeru-ai/airi/pull/2862) `fix(stage-ui-three): anchor VRM animation tracks in local space` by **@FlowerWater1019** *(2 comments)*
- [#2856](https://github.com/moeru-ai/airi/pull/2856) `refactor(ui): unify audited business controls` by **@luoling8192** *(1 comments)*
- [#2854](https://github.com/moeru-ai/airi/pull/2854) `test(stage-ui): add shared component stories and adoption audit` by **@luoling8192** *(2 comments)*
- [#2852](https://github.com/moeru-ai/airi/pull/2852) `feat(server,stage-ui,stage-pages): sync character cards between devices` by **@luoling8192** *(8 comments)*
- [#2853](https://github.com/moeru-ai/airi/pull/2853) `test(stage-ui): run sessions drawer time labels at a fixed noon` by **@nekomeowww** *(2 comments)*

#### 🔄 PR Status & Lifecycle Changes (7)
- [#2692](https://github.com/moeru-ai/airi/pull/2692) `fix(api-server): sync chat message deletions across devices` — `OPEN` ➔ `CLOSED`
- [#2848](https://github.com/moeru-ai/airi/pull/2848) `chore(nix): update pnpmDeps hash` — `OPEN` ➔ `MERGED`
- [#2761](https://github.com/moeru-ai/airi/pull/2761) `feat(stage-ui): stream voice transcripts in the inlay and rewrite them with a chat model` — `OPEN` ➔ `MERGED`
- [#2822](https://github.com/moeru-ai/airi/pull/2822) `feat(provider-inference,vite-plugin-sherpaw): serve sherpaw model artifacts from a mirror` — `OPEN` ➔ `MERGED`
- [#2823](https://github.com/moeru-ai/airi/pull/2823) `fix(stage-ui): broadcast spark commands from the LLM tool again` — `OPEN` ➔ `MERGED`
- [#2773](https://github.com/moeru-ai/airi/pull/2773) `feat(stage-tamagotchi): show voice drafts in a composer-style inlay` — `OPEN` ➔ `MERGED`
- [#2850](https://github.com/moeru-ai/airi/pull/2850) `fix(api,stage-ui): correct character card sync defects from #2817` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (5)
- [#2813](https://github.com/moeru-ai/airi/pull/2813) `feat(api,stage-ui): bill subscriptions and Flux packs through RevenueCat` — *+1 comments (1 ➔ 2 total)*
- [#2458](https://github.com/moeru-ai/airi/pull/2458) `feat(stage): add character-owned Live2D controls` — *+2 comments (63 ➔ 65 total)*
- [#2696](https://github.com/moeru-ai/airi/pull/2696) `feat(inference): manage Sherpaw model assets across hosts` — *+1 comments (11 ➔ 12 total)*
- [#2197](https://github.com/moeru-ai/airi/pull/2197) `feat(live2d): support Cubism 2 through generation-specific loaders` — *+3 comments (71 ➔ 74 total)*
- [#2761](https://github.com/moeru-ai/airi/pull/2761) `feat(stage-ui): stream voice transcripts in the inlay and rewrite them with a chat model` — *+1 comments (1 ➔ 2 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(1 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` [Draft] — *(48 comments)*
  - *Focus*: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard
- [#2541](https://github.com/moeru-ai/airi/pull/2541) `Telltworose/feat/drop in plugins` [OPEN] — *(59 comments)*
  - *Focus*: MCP stdio child processes & card-level tool scoping; track author rebase and explanation to maintainers regarding deleted in-process loader
- [#2290](https://github.com/moeru-ai/airi/pull/2290) `feat(server): stream official ASR over WebSocket` [OPEN] — *(59 comments)*
  - *Focus*: Official ASR streaming over WebSocket vs OpenAI-compatible HTTP SSE; track rebase and backend transport decisions
- [#2120](https://github.com/moeru-ai/airi/pull/2120) `refactor(stage-pages): rebuild AIRI Card editor` [OPEN] — *(41 comments)*
  - *Focus*: Card editor overhaul in stage-pages, dirty draft protection, route vs modal lifecycles

---
## [2026-10-07] Upstream Delta: `881ec784..8772fbb2` (11 commits, 235 files, 34 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus & Key Merges**: Upstream merged 11 commits (`881ec784`..`8772fbb2`) alongside 34 PR updates (21 new PRs, 8 lifecycle transitions, 5 discussion updates). The primary momentum centers on a monolithic voice pipeline migration, cloud database card synchronization, and chat UI readability:
  1. **Voice Pipeline Unification (PR #2772 / Commit `8772fbb222` & PR #2770 / Commit `ac13190a75` by @nekomeowww)**: Massive 127-file refactor (+4454/-9827 lines) overhauling client voice handling. Migrated voice controller, speech input lifecycle, transcription buffering, and plugins into `@proj-airi/core-agent`, gutting legacy `hearing.ts` (959 lines removed) in favor of modular `packages/stage-ui/src/stores/voice.ts`, `voice-controls.ts`, and `voice-messages.ts`.
  2. **Field-Level Cloud Card Synchronization (PR #2817 / Commit `3848d155f9` by @luoling8192)**: Added Drizzle migration `0031_character_cards.sql` and `server/apps/api` field-sync endpoints paired with client-side `document-sync` client and `airi-card.ts` synchronization. Follow-up bugfixes immediately merged in Commit `60d73ccd52` (PR #2840, JSONB string formatting) and opened in PR #2850 by @nekomeowww to repair field sync defects.
  3. **Chat Readability & Relative Timestamps (PR #2825 / Commit `b123c71487` by @luoling8192)**: Added `history-time-separator.vue`, human-readable relative message timestamps, and simplified sender labels in chat history & sessions drawer.
  4. **Experimental Feature Controls (PR #2829 / Commit `09b5eda980` by @luoling8192)**: Introduced client-side `feature-flags.ts` store, composables, and an experimental features settings page under system settings.
  5. **Mobile Composer Voice Input (PR #2832 / Commit `94fa5d7cc5` by @luoling8192)**: Moved voice input controls into `MobileInteractiveArea.vue` in `packages/stage-layouts`.
  6. **Server Tracing Simplification (PR #2798 / Commit `aeadd9226a` by @luoling8192)**: Stripped out Langfuse remote telemetry export in favor of lightweight in-tree request logs.
* **Discussion & Community Buzz**:
  - 💬 **#2817: `feat(api,stage-ui): synchronize character cards by field` (+4 comments, 31 total, Merged)**: High discussion volume surrounding field sync conflict resolution, schema boundaries, and immediate regressions that prompted PR #2850.
  - 💬 **#2850: `fix(api,stage-ui): correct character card sync defects from #2817` (4 comments, Open)**: Immediate maintainer triage by @nekomeowww addressing character card field sync bugs.
  - 💬 **#1107: `fix(providers): use native ElevenLabs API to avoid unspeech proxy 401` (+1 comment, 13 total)**: Persistent community discussion on bypassing intermediate unspeech proxy issues.
  - 💬 **#2802: `chore(i18n): update translations` (+2 comments, 6 total, Merged)**: Translation updates and sync discussions.
  - 💬 **#2773: `feat(stage-tamagotchi): show voice drafts in a composer-style inlay` (+1 comment, 2 total)**: Discussion on displaying streaming speech drafts in desktop composer.
  - 👁️ **Watched PRs Radar**:
    - **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain`** [Draft] (1 comment): Dormant. Maintainers still have not triaged the 2-process daemon requirement or Web/Mobile parity concerns.
    - **#2672: `refactor(stage-ui): bind conversations to window-local characters`** [Draft] (48 comments): High discussion volume exploring conversation scoping per window and extracting shared `CharacterCard` components.
    - **#2541: `Telltworose/feat/drop in plugins` (MCP-first architecture)** [Open] (59 comments): Awaiting maintainer rebase review.
    - **#2290: `feat(server): stream official ASR over WebSocket`** [Open] (59 comments): Changes requested; transport selection pending.
    - **#2120: `refactor(stage-pages): rebuild AIRI Card editor`** [Open] (41 comments): Changes requested; dirty-draft route design under review.
* **Cherry-Pick Candidates**:
  - ✅ **SQUATTED [dasilva333/airi Commit `2f78c969fa`]: PR #2846 / Commit `39a397458c`: `fix(i18n): quote the label of the agree sticker` by @chiba233**: Squatted the YAML 1.1 boolean string quoting hygiene fix. While `pages.stickers` is intentionally omitted in this fork in favor of card-scoped Acting tab directives (`docs/project-stickers-system-spec.md`), we quoted existing unquoted booleans (`confirmations.yes: 'Yes'` and `scale-and-position.y: 'Y'`) in `packages/i18n/src/locales/en/settings.yaml` to guarantee YAML 1.1 / Crowdin parser safety.
  - ✅ **SQUATTED [dasilva333/airi Commit `2f78c969fa`]: PR #2842: `feat(provider-inference): add Opper provider` by @Felixkw12**: Squatted the Opper AI provider (`https://api.opper.ai/v3/compat`). Adapted from upstream's extracted `provider-inference` package to our fork's `packages/stage-ui/src/libs/providers/providers/opper/` using `createOpenAI` with `OPPER_DEFAULT_BASE_URL`, registered in `providers/index.ts`, added unit tests, and populated `en` / `zh-Hans` provider metadata.
  - 💎 **PR #2845: `test(stage-ui): pin the clock in sessions drawer time label tests` by @Anandb71**: High value test-hygiene fix. Pins Vitest fake timer clock to local midday (`2026-01-15T12:00:00`) in `sessions-drawer.browser.test.ts` to prevent test failures when executed before 04:00 AM due to `intlFormatDistance` day rollover. *(Evaluated: Not needed for our current suite).*
  - ⚪ **Auto-Reject / Do Not Port**:
    - **PR #2817 / PR #2840 / PR #2850**: Hosted cloud card field synchronization to `server/apps/api`. Violates our local-first / BYOS privacy architecture.
    - **PR #2843**: System theme option touches deprecated `controls-island` surfaces.
    - **PR #2838**: Hosted API speech execution bridge. Violates client-direct inference model.
    - **PR #2831**: Analytics tracking client switches.
    - **PR #2829**: Remote experimental feature dashboard flags.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/modules/hearing.ts` & Voice Pipeline (PR #2772 / Commit `8772fbb222`)**: Upstream removed 9,800+ lines across audio and hearing stores in favor of `@proj-airi/core-agent`. In `dasilva333/airi`, audio/speech is specialized with local WebGPU/WASM inference, conversational pacing, and multi-actor speech intents. Do not attempt direct Git merge.
  - ⚠️ **`packages/stage-ui/src/stores/modules/airi-card.ts` (PR #2817 / Commit `3848d155f9`)**: Upstream added remote document-sync reconciliation hooks. In our fork, `airi-card.ts` is strictly local unstorage/IndexedDB with multi-actor AnimaDex schemas.
  - ⚠️ **`packages/stage-ui/src/components/scenarios/chat/components/history.vue` (PR #2825 / Commit `b123c71487`)**: Upstream modified chat history layout for date separators. Our fork features virtualized rendering, custom frames, and multi-actor routing.

### 📋 Upstream Commits
- `8772fbb222` refactor(stage-ui): move voice features onto the shared voice pipeline (#2772) [#2772](https://github.com/moeru-ai/airi/pull/2772) _(Neko, 2026-10-07)_
- `82225c9747` chore(i18n): update translations (#2802) [#2802](https://github.com/moeru-ai/airi/pull/2802) _(github-actions[bot], 2026-10-07)_
- `39a397458c` fix(i18n): quote the label of the agree sticker (#2846) [#2846](https://github.com/moeru-ai/airi/pull/2846) _(蓝莓🫐, 2026-10-07)_
- `60d73ccd52` fix(api): return jsonb strings as stored in character card fields (#2840) [#2840](https://github.com/moeru-ai/airi/pull/2840) _(RainbowBird, 2026-10-07)_
- `ac13190a75` feat(core-agent): add the voice controller, transcripts, and plugins (#2770) [#2770](https://github.com/moeru-ai/airi/pull/2770) _(Neko, 2026-10-07)_
- `3848d155f9` feat(api,stage-ui): synchronize character cards by field (#2817) [#2817](https://github.com/moeru-ai/airi/pull/2817) _(RainbowBird, 2026-10-07)_
- `633ff104cb` chore(nix): update pnpmDeps hash (#2834) [#2834](https://github.com/moeru-ai/airi/pull/2834) _(Weathercold, 2026-10-06)_
- `aeadd9226a` refactor(api): replace Langfuse export with request logs (#2798) [#2798](https://github.com/moeru-ai/airi/pull/2798) _(RainbowBird, 2026-10-07)_
- `94fa5d7cc5` feat(stage-layouts): move voice input to the mobile composer (#2832) [#2832](https://github.com/moeru-ai/airi/pull/2832) _(RainbowBird, 2026-10-07)_
- `09b5eda980` feat(settings): add experimental feature controls (#2829) [#2829](https://github.com/moeru-ai/airi/pull/2829) _(RainbowBird, 2026-10-06)_
- `b123c71487` feat(chat): add readable message times and simplify sender labels (#2825) [#2825](https://github.com/moeru-ai/airi/pull/2825) _(RainbowBird, 2026-10-06)_

### 🔬 Subsystem Breakdown
#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 4 file(s) (+38/-290)
- `apps/stage-pocket/src/pages/index.vue` *(+9/-137)*
- `apps/stage-pocket/src/pages/settings/system/index.vue` *(+10/-7)*
- `apps/stage-web/src/pages/index.vue` *(+9/-139)*
- `apps/stage-web/src/pages/settings/system/index.vue` *(+10/-7)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 7 file(s) (+59/-958)
- `apps/stage-tamagotchi-kirie/package.json` *(+0/-1)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/App.vue` *(+0/-1)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/InteractiveArea.vue` *(+3/-4)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/index.vue` *(+18/-470)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+11/-5)*
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` *(+17/-470)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/system/index.vue` *(+10/-7)*

#### Deprecated Surfaces (Control Island) (`⚪ ignore / rejected in fork (decoupled into Control Strip)`) — 2 file(s) (+6/-0)
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/controls-island-overflow.browser.test.ts` *(+3/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-overflow.browser.test.ts` *(+3/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 116 file(s) (+6147/-6197)
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/audio/src/audio-context/index.ts` *(+0/-318)*
- `packages/audio/src/audio-context/processor.worklet.ts` *(+0/-162)*
- `packages/audio/tsdown.config.ts` *(+0/-4)*
- `packages/pipelines-audio/src/index.ts` *(+0/-1)*
- `packages/pipelines-audio/src/transcript-buffer.test.ts` *(+0/-169)*
- `packages/pipelines-audio/src/transcript-buffer.ts` *(+0/-125)*
- `packages/provider-inference/src/model-catalog.test.ts` *(+9/-0)*
- `packages/provider-inference/src/model-catalog.ts` *(+13/-10)*
- `packages/provider-inference/src/providers/local/browser-web-speech-api/index.browser.test.ts` *(+33/-5)*
- `packages/provider-inference/src/providers/local/browser-web-speech-api/provider.ts` *(+175/-438)*
- `packages/provider-inference/src/types.ts` *(+3/-1)*
- `packages/stage-ui/src/components/scenarios/chat/components/history-layout.browser.test.ts` *(+26/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/history-time-separator.browser.test.ts` *(+84/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/history-time-separator.vue` *(+58/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.vue` *(+72/-47)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-dialog.browser.test.ts` *(+6/-6)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-drawer.browser.test.ts` *(+60/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-drawer.vue` *(+19/-31)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-list.vue` *(+3/-3)*
- `packages/stage-ui/src/components/scenarios/chat/components/user-item.vue` *(+10/-6)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-drafts.vue` *(+82/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-message-controls.browser.test.ts` *(+79/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-message-controls.vue` *(+124/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/voice-message-preview.vue` *(+38/-0)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-images.ts` *(+1/-1)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-voice-input.ts` *(+47/-0)*
- `packages/stage-ui/src/components/scenarios/chat/index.ts` *(+3/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/audio-input/hearing-config.browser.test.ts` *(+3/-2)*
- `packages/stage-ui/src/components/scenarios/providers/transcription-playground.vue` *(+114/-164)*
- `packages/stage-ui/src/components/scenarios/status/hearing-status.vue` *(+12/-12)*
- `packages/stage-ui/src/composables/audio/audio-device.test.ts` *(+0/-78)*
- `packages/stage-ui/src/composables/audio/audio-device.ts` *(+89/-118)*
- `packages/stage-ui/src/composables/audio/audio-recorder.test.ts` *(+0/-173)*
- `packages/stage-ui/src/composables/audio/audio-recorder.ts` *(+0/-130)*
- `packages/stage-ui/src/composables/audio/index.ts` *(+0/-2)*
- `packages/stage-ui/src/composables/audio/voice-controller.ts` *(+55/-0)*
- `packages/stage-ui/src/composables/audio/voice-input-session.test.ts` *(+0/-425)*
- `packages/stage-ui/src/composables/audio/voice-input-session.ts` *(+0/-623)*
- `packages/stage-ui/src/composables/audio/voice-input-vad-startup.test.ts` *(+0/-49)*
- `packages/stage-ui/src/composables/audio/voice-input-vad-startup.ts` *(+0/-39)*
- `packages/stage-ui/src/composables/cloud.browser.test.ts` *(+49/-0)*
- `packages/stage-ui/src/composables/cloud.ts` *(+14/-0)*
- `packages/stage-ui/src/composables/speech-output-trace.test.ts` *(+79/-0)*
- `packages/stage-ui/src/composables/speech-output-trace.ts` *(+147/-0)*
- `packages/stage-ui/src/composables/use-io-trace-bridge.ts` *(+0/-105)*
- `packages/stage-ui/src/composables/vision/use-vision-inference.ts` *(+7/-5)*
- `packages/stage-ui/src/composables/voice-drafts.browser.test.ts` *(+68/-0)*
- `packages/stage-ui/src/composables/voice-drafts.ts` *(+119/-0)*
- `packages/stage-ui/src/database/repos/document-sync.repo.ts` *(+17/-0)*
- `packages/stage-ui/src/libs/{auth.test.ts => auth.browser.test.ts}` *(+7/-1)*
- `packages/stage-ui/src/libs/character-card-sync/card-fields.test.ts` *(+100/-0)*
- `packages/stage-ui/src/libs/character-card-sync/card-fields.ts` *(+120/-0)*
- `packages/stage-ui/src/libs/character-card-sync/index.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/chat-sync/wire-message.ts` *(+3/-0)*
- `packages/stage-ui/src/libs/document-sync/client.test.ts` *(+67/-0)*
- `packages/stage-ui/src/libs/document-sync/client.ts` *(+153/-0)*
- `packages/stage-ui/src/libs/document-sync/index.ts` *(+8/-0)*
- `packages/stage-ui/src/libs/document-sync/reconcile.test.ts` *(+268/-0)*
- `packages/stage-ui/src/libs/document-sync/reconcile.ts` *(+252/-0)*
- `packages/stage-ui/src/libs/document-sync/synchronize.test.ts` *(+219/-0)*
- `packages/stage-ui/src/libs/document-sync/synchronize.ts` *(+158/-0)*
- `packages/stage-ui/src/libs/feature-flags.test.ts` *(+64/-0)*
- `packages/stage-ui/src/libs/feature-flags.ts` *(+59/-0)*
- `packages/stage-ui/src/libs/index.ts` *(+0/-1)*
- `packages/stage-ui/src/libs/providers/providers/official/index.ts` *(+1/-3)*
- `packages/stage-ui/src/libs/providers/transcription-types.ts` *(+8/-0)*
- `packages/stage-ui/src/libs/speech/streaming-pipeline.ts` *(+83/-24)*
- `packages/stage-ui/src/libs/speech/tts-session.test.ts` *(+0/-339)*
- `packages/stage-ui/src/libs/speech/tts-session.ts` *(+0/-322)*
- `packages/stage-ui/src/libs/voice/voice-activity-plugin.test.ts` *(+114/-0)*
- `packages/stage-ui/src/libs/voice/voice-activity-plugin.ts` *(+102/-0)*
- `packages/stage-ui/src/libs/voice/voice-message.test.ts` *(+52/-0)*
- `packages/stage-ui/src/libs/voice/voice-message.ts` *(+119/-0)*
- `packages/stage-ui/src/services/speech/bus.ts` *(+81/-41)*
- `packages/stage-ui/src/services/speech/pipeline-runtime.ts` *(+0/-279)*
- `packages/stage-ui/src/services/speech/speech-client.test.ts` *(+49/-0)*
- `packages/stage-ui/src/services/speech/speech-client.ts` *(+87/-0)*
- `packages/stage-ui/src/stores/character.test.ts` *(+18/-21)*
- `packages/stage-ui/src/stores/character/index.ts` *(+18/-28)*
- `packages/stage-ui/src/stores/feature-flags.ts` *(+114/-0)*
- `packages/stage-ui/src/stores/mods/api/context-bridge.contract.browser.test.ts` *(+17/-0)*
- `packages/stage-ui/src/stores/mods/api/context-bridge.ts` *(+16/-0)*
- `packages/stage-ui/src/stores/mods/api/context-channel.ts` *(+11/-0)*
- `packages/stage-ui/src/stores/modules/airi-card-sync.browser.test.ts` *(+380/-0)*
- `packages/stage-ui/src/stores/modules/airi-card.test.ts` *(+106/-0)*
- `packages/stage-ui/src/stores/modules/airi-card.ts` *(+421/-38)*
- `packages/stage-ui/src/stores/modules/artistry-autonomous.ts` *(+32/-23)*
- `packages/stage-ui/src/stores/modules/hearing-status.browser.test.ts` *(+15/-87)*
- `packages/stage-ui/src/stores/modules/hearing.ts` *(+87/-872)*
- `packages/stage-ui/src/stores/modules/speech.ts` *(+53/-1)*
- `packages/stage-ui/src/stores/modules/streaming-transcription-consumers.test.ts` *(+0/-79)*
- `packages/stage-ui/src/stores/modules/streaming-transcription-consumers.ts` *(+0/-68)*
- `packages/stage-ui/src/stores/settings/audio-device.browser.test.ts` *(+102/-0)*
- `packages/stage-ui/src/stores/settings/audio-device.test.ts` *(+0/-234)*
- `packages/stage-ui/src/stores/settings/audio-device.ts` *(+77/-160)*
- `packages/stage-ui/src/stores/speech-output-control.browser.test.ts` *(+42/-19)*
- `packages/stage-ui/src/stores/speech-output-control.test.ts` *(+0/-122)*
- `packages/stage-ui/src/stores/speech-output-control.ts` *(+35/-59)*
- `packages/stage-ui/src/stores/speech-runtime.ts` *(+0/-30)*
- `packages/stage-ui/src/stores/voice-controls.ts` *(+66/-0)*
- `packages/stage-ui/src/stores/voice-messages.ts` *(+87/-0)*
- `packages/stage-ui/src/stores/voice.ts` *(+376/-0)*
- `packages/stage-ui/src/types/chat-session.ts` *(+9/-0)*
- `packages/stage-ui/src/workers/vad/silero-vad.ts` *(+63/-0)*
- `packages/stage-ui/vitest.config.ts` *(+1/-1)*
- `packages/testing-audio/cases/apple-speech/case.audio.electron.test.ts` *(+3/-3)*
- `packages/testing-audio/cases/long-leading-silence/case.audio.test.ts` *(+8/-6)*
- `packages/testing-audio/cases/shared/configurations/module-hearing.ts` *(+13/-9)*
- `packages/testing-audio/cases/shared/interactions/chat.ts` *(+11/-5)*
- `packages/testing-audio/cases/single-utterance-pipeline/case.audio.test.ts` *(+2/-0)*
- `packages/testing-audio/cases/two-utterance-streaming/case.audio.test.ts` *(+20/-32)*
- `packages/testing-audio/src/expect-extend.test.ts` *(+29/-16)*
- `packages/testing-audio/src/expect-extend.ts` *(+16/-16)*
- `packages/testing-audio/src/setup/session.ts` *(+5/-2)*
- `pnpm-workspace.yaml` *(+0/-3)*

#### Root Build & Tooling (`🔍 inspect`) — 4 file(s) (+7/-74)
- `packages/audio/package.json` *(+0/-8)*
- `packages/provider-inference/package.json` *(+1/-0)*
- `packages/stage-ui/package.json` *(+0/-1)*
- `pnpm-lock.yaml` *(+6/-65)*

#### Core Agent Runtime (`🔍 inspect`) — 24 file(s) (+3442/-17)
- `packages/core-agent/README.md` *(+95/-0)*
- `packages/core-agent/src/index.ts` *(+1/-0)*
- `packages/core-agent/src/testing/audio.ts` *(+36/-0)*
- `packages/core-agent/src/utils/error-message.ts` *(+0/-17)*
- `packages/core-agent/src/utils/error.ts` *(+17/-0)*
- `packages/core-agent/src/voice/controller.test.ts` *(+467/-0)*
- `packages/core-agent/src/voice/controller.ts` *(+285/-0)*
- `packages/core-agent/src/voice/index.ts` *(+41/-0)*
- `packages/core-agent/src/voice/input/attempt-types.ts` *(+24/-0)*
- `packages/core-agent/src/voice/input/attempt.ts` *(+383/-0)*
- `packages/core-agent/src/voice/input/end-detection.test.ts` *(+60/-0)*
- `packages/core-agent/src/voice/input/end-detection.ts` *(+23/-0)*
- `packages/core-agent/src/voice/input/snapshot.ts` *(+35/-0)*
- `packages/core-agent/src/voice/input/speech-input.ts` *(+174/-0)*
- `packages/core-agent/src/voice/input/submission.ts` *(+35/-0)*
- `packages/core-agent/src/voice/input/transcript.ts` *(+223/-0)*
- `packages/core-agent/src/voice/interruption.ts` *(+18/-0)*
- `packages/core-agent/src/voice/output/response.test.ts` *(+274/-0)*
- `packages/core-agent/src/voice/output/response.ts` *(+358/-0)*
- `packages/core-agent/src/voice/plugins/input-plugins.ts` *(+429/-0)*
- `packages/core-agent/src/voice/plugins/registry.ts` *(+263/-0)*
- `packages/core-agent/src/voice/plugins/task-lifetime.ts` *(+45/-0)*
- `packages/core-agent/src/voice/plugins/types.ts` *(+146/-0)*
- `packages/core-agent/src/voice/turn.ts` *(+10/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 10 file(s) (+281/-75)
- `packages/i18n/src/locales/en/settings.yaml` *(+81/-1)*
- `packages/i18n/src/locales/en/stage.yaml` *(+28/-0)*
- `packages/i18n/src/locales/es/settings.yaml` *(+11/-13)*
- `packages/i18n/src/locales/fr/settings.yaml` *(+11/-13)*
- `packages/i18n/src/locales/ja/settings.yaml` *(+4/-4)*
- `packages/i18n/src/locales/ko/settings.yaml` *(+11/-13)*
- `packages/i18n/src/locales/vi/settings.yaml` *(+4/-4)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+92/-14)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+28/-0)*
- `packages/i18n/src/locales/zh-Hant/settings.yaml` *(+11/-13)*

#### Documentation & Scaffolding (`⚪ ignore`) — 3 file(s) (+125/-17)
- `packages/pipelines-audio/README.md` *(+1/-17)*
- `packages/stage-ui/README.md` *(+53/-0)*
- `packages/stage-ui/src/libs/document-sync/README.md` *(+71/-0)*

#### Stage Layouts & Shells (`🔍 inspect`) — 10 file(s) (+211/-1299)
- `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` *(+51/-15)*
- `packages/stage-layouts/src/components/Layouts/mobile-settings-drawer.vue` *(+3/-29)*
- `packages/stage-layouts/src/components/Widgets/ChatArea.vue` *(+5/-11)*
- `packages/stage-layouts/src/composables/use-chat-interruption.test.ts` *(+119/-336)*
- `packages/stage-layouts/src/composables/use-chat-interruption.ts` *(+20/-49)*
- `packages/stage-layouts/src/composables/use-transcriptions.test.ts` *(+0/-459)*
- `packages/stage-layouts/src/composables/use-transcriptions.ts` *(+0/-233)*
- `packages/stage-layouts/src/composables/useStopSpeakingButton.test.ts` *(+0/-159)*
- `packages/stage-layouts/src/composables/useStopSpeakingButton.ts` *(+9/-8)*
- `packages/stage-layouts/vitest.config.ts` *(+4/-0)*

#### UI Primitives & Pages (`📦 import / inspect`) — 12 file(s) (+861/-337)
- `packages/stage-pages/package.json` *(+1/-0)*
- `packages/stage-pages/src/components/settings-experimental-features.vue` *(+56/-0)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardDetailDialog.browser.test.ts` *(+106/-0)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardDetailDialog.vue` *(+211/-4)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardListItem.browser.test.ts` *(+50/-0)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardListItem.vue` *(+22/-1)*
- `packages/stage-pages/src/pages/settings/airi-card/components/RestoreVersionDialog.vue` *(+74/-0)*
- `packages/stage-pages/src/pages/settings/airi-card/composables/relative-time.ts` *(+28/-0)*
- `packages/stage-pages/src/pages/settings/airi-card/index.vue` *(+155/-3)*
- `packages/stage-pages/src/pages/settings/modules/hearing.vue` *(+106/-150)*
- `packages/stage-pages/src/pages/settings/providers/transcription/browser-web-speech-api.vue` *(+35/-179)*
- `packages/stage-pages/src/pages/settings/system/experimental.vue` *(+17/-0)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 1 file(s) (+71/-499)
- `packages/stage-ui/src/components/scenes/Stage.vue` *(+71/-499)*

#### Audio & Speech Pipeline (`🔍 inspect`) — 4 file(s) (+248/-205)
- `packages/stage-ui/src/libs/audio/hearing-transcriber.test.ts` *(+119/-0)*
- `packages/stage-ui/src/libs/audio/hearing-transcriber.ts` *(+129/-0)*
- `packages/stage-ui/src/libs/audio/vad-streaming-session.test.ts` *(+0/-98)*
- `packages/stage-ui/src/libs/audio/vad-streaming-session.ts` *(+0/-107)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 5 file(s) (+405/-186)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+37/-2)*
- `packages/stage-ui/src/stores/chat.ts` *(+131/-13)*
- `packages/stage-ui/src/stores/chat/{session-store.test.ts => session-store-lifecycle.browser.test.ts}` *(+69/-103)*
- `packages/stage-ui/src/stores/chat/session-store.browser.test.ts` *(+114/-64)*
- `packages/stage-ui/src/stores/chat/session-store.ts` *(+54/-4)*

#### Provider & Model Integrations (`📦 import / inspect`) — 1 file(s) (+4/-0)
- `packages/stage-ui/src/stores/providers/provider.ts` *(+4/-0)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 32 file(s) (+5957/-842)
- `server/apps/api/README.md` *(+1/-2)*
- `server/apps/api/drizzle/0031_character_cards.sql` *(+21/-0)*
- `server/apps/api/drizzle/meta/0031_snapshot.json` *(+4027/-0)*
- `server/apps/api/drizzle/meta/_journal.json` *(+7/-0)*
- `server/apps/api/instrumentation.ts` *(+17/-103)*
- `server/apps/api/package.json` *(+0/-2)*
- `server/apps/api/src/app.test.ts` *(+1/-0)*
- `server/apps/api/src/app.ts` *(+18/-1)*
- `server/apps/api/src/libs/json-value.ts` *(+15/-0)*
- `server/apps/api/src/routes/character-cards/index.ts` *(+48/-0)*
- `server/apps/api/src/routes/character-cards/route.test.ts` *(+144/-0)*
- `server/apps/api/src/routes/openai/v1/index.ts` *(+3/-6)*
- `server/apps/api/src/routes/openai/v1/operations/chat-completions/index.ts` *(+1/-42)*
- `server/apps/api/src/routes/openai/v1/operations/responses/index.ts` *(+0/-13)*
- `server/apps/api/src/routes/openai/v1/operations/speech-generation/index.ts` *(+0/-1)*
- `server/apps/api/src/routes/openai/v1/route.test.ts` *(+5/-17)*
- `server/apps/api/src/routes/openai/v1/types.ts` *(+0/-14)*
- `server/apps/api/src/schemas/character-cards.ts` *(+54/-0)*
- `server/apps/api/src/schemas/index.ts` *(+1/-0)*
- `server/apps/api/src/services/domain/character-cards.test.ts` *(+83/-0)*
- `server/apps/api/src/services/domain/character-cards.ts` *(+109/-0)*
- `server/apps/api/src/services/domain/field-sync/index.ts` *(+5/-0)*
- `server/apps/api/src/services/domain/field-sync/request.ts` *(+104/-0)*
- `server/apps/api/src/services/domain/field-sync/store.test.ts` *(+416/-0)*
- `server/apps/api/src/services/domain/field-sync/store.ts` *(+459/-0)*
- `server/apps/api/src/services/domain/field-sync/tables.ts` *(+66/-0)*
- `server/apps/api/src/services/domain/llm-tracing/index.test.ts` *(+0/-265)*
- `server/apps/api/src/services/domain/llm-tracing/index.ts` *(+0/-356)*
- `server/apps/api/src/services/domain/openai-speech/index.ts` *(+0/-20)*
- `server/apps/api/src/utils/error.ts` *(+7/-0)*
- `server/docs/ai/adr/2026-10-05-admin-agent-traces.md` *(+127/-0)*
- `server/docs/ai/adr/2026-10-06-document-sync.md` *(+218/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (21)
- [#2850](https://github.com/moeru-ai/airi/pull/2850) `fix(api,stage-ui): correct character card sync defects from #2817` by **@nekomeowww** *(4 comments)*
- [#2848](https://github.com/moeru-ai/airi/pull/2848) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(2 comments)*
- [#1324](https://github.com/moeru-ai/airi/pull/1324) `fix(server-runtime): preserve explicit empty route destinations` by **@Gujiassh** *(4 comments)*
- [#1309](https://github.com/moeru-ai/airi/pull/1309) `fix(stage-ui): flip canvas pixel reads on Y axis` by **@Gujiassh** *(4 comments)*
- [#1179](https://github.com/moeru-ai/airi/pull/1179) `fix(telegram-bot): guard malformed structured messages` by **@Gujiassh** *(4 comments)*
- [#1323](https://github.com/moeru-ai/airi/pull/1323) `fix(plugin-sdk): preserve absolute plugin entrypoints` by **@Gujiassh** *(3 comments)*
- [#1305](https://github.com/moeru-ai/airi/pull/1305) `fix(plugin-sdk): trim negotiated compatibility versions` by **@Gujiassh** *(3 comments)*
- [#2033](https://github.com/moeru-ai/airi/pull/2033) `fix(stage-ui): recover stale stage model selection` by **@Gujiassh** *(1 comments)*
- [#1322](https://github.com/moeru-ai/airi/pull/1322) `fix(stage-ui): keep nested reasoning out of speech` by **@Gujiassh** *(2 comments)*
- [#1304](https://github.com/moeru-ai/airi/pull/1304) `fix(stage-ui): skip optimistic updates before apply` by **@Gujiassh** *(4 comments)*
- [#2045](https://github.com/moeru-ai/airi/pull/2045) `fix(stage-pages): add local provider WIP routes` by **@Gujiassh** *(1 comments)*
- [#2846](https://github.com/moeru-ai/airi/pull/2846) `fix(i18n): quote the label of the agree sticker` by **@chiba233** *(1 comments)*
- [#2845](https://github.com/moeru-ai/airi/pull/2845) `test(stage-ui): pin the clock in sessions drawer time label tests` by **@Anandb71** *(2 comments)*
- [#2833](https://github.com/moeru-ai/airi/pull/2833) `test(stage-ui): isolate provider cache test from network` by **@starvingarc** *(2 comments)*
- [#2843](https://github.com/moeru-ai/airi/pull/2843) `feat(ui,stage-layouts,stage-tamagotchi): add a system theme option` by **@chiba233** *(2 comments)*
- [#2842](https://github.com/moeru-ai/airi/pull/2842) `feat(provider-inference): add Opper provider` by **@Felixkw12** *(0 comments)*
- [#2840](https://github.com/moeru-ai/airi/pull/2840) `fix(api): return jsonb strings as stored in character card fields` by **@luoling8192** *(2 comments)*
- [#2838](https://github.com/moeru-ai/airi/pull/2838) `feat(provider-inference): share speech execution with the hosted API` by **@luoling8192** *(2 comments)*
- [#2834](https://github.com/moeru-ai/airi/pull/2834) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(2 comments)*
- [#2832](https://github.com/moeru-ai/airi/pull/2832) `feat(stage-layouts): move voice input to the mobile composer` by **@luoling8192** *(2 comments)*
- [#2831](https://github.com/moeru-ai/airi/pull/2831) `feat(analytics): track switch interactions across clients` by **@luoling8192** *(2 comments)*

#### 🔄 PR Status & Lifecycle Changes (8)
- [#2772](https://github.com/moeru-ai/airi/pull/2772) `refactor(stage-ui): move voice features onto the shared voice pipeline` — `OPEN` ➔ `MERGED`
- [#2802](https://github.com/moeru-ai/airi/pull/2802) `chore(i18n): update translations` — `OPEN` ➔ `MERGED`
- [#2770](https://github.com/moeru-ai/airi/pull/2770) `feat(core-agent): add the voice controller, transcripts, and plugins` — `OPEN` ➔ `MERGED`
- [#2127](https://github.com/moeru-ai/airi/pull/2127) `fix(electron): persist desktop window bounds` — `OPEN` ➔ `CLOSED`
- [#2817](https://github.com/moeru-ai/airi/pull/2817) `feat(api,stage-ui): synchronize character cards by field` — `OPEN` ➔ `MERGED`
- [#2798](https://github.com/moeru-ai/airi/pull/2798) `refactor(api): replace Langfuse export with request logs` — `OPEN` ➔ `MERGED`
- [#2829](https://github.com/moeru-ai/airi/pull/2829) `feat(settings): add experimental feature controls` — `OPEN` ➔ `MERGED`
- [#2825](https://github.com/moeru-ai/airi/pull/2825) `feat(chat): add readable message times and simplify sender labels` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (5)
- [#2773](https://github.com/moeru-ai/airi/pull/2773) `feat(stage-tamagotchi): show voice drafts in a composer-style inlay` — *+1 comments (1 ➔ 2 total)*
- [#2772](https://github.com/moeru-ai/airi/pull/2772) `refactor(stage-ui): move voice features onto the shared voice pipeline` — *+1 comments (1 ➔ 2 total)*
- [#2802](https://github.com/moeru-ai/airi/pull/2802) `chore(i18n): update translations` — *+2 comments (4 ➔ 6 total)*
- [#1107](https://github.com/moeru-ai/airi/pull/1107) `fix(providers): use native ElevenLabs API to avoid unspeech proxy 401` — *+1 comments (12 ➔ 13 total)*
- [#2817](https://github.com/moeru-ai/airi/pull/2817) `feat(api,stage-ui): synchronize character cards by field` — *+4 comments (27 ➔ 31 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(1 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` [Draft] — *(48 comments)*
  - *Focus*: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard
- [#2541](https://github.com/moeru-ai/airi/pull/2541) `Telltworose/feat/drop in plugins` [OPEN] — *(59 comments)*
  - *Focus*: MCP stdio child processes & card-level tool scoping; track author rebase and explanation to maintainers regarding deleted in-process loader
- [#2290](https://github.com/moeru-ai/airi/pull/2290) `feat(server): stream official ASR over WebSocket` [OPEN] — *(59 comments)*
  - *Focus*: Official ASR streaming over WebSocket vs OpenAI-compatible HTTP SSE; track rebase and backend transport decisions
- [#2120](https://github.com/moeru-ai/airi/pull/2120) `refactor(stage-pages): rebuild AIRI Card editor` [OPEN] — *(41 comments)*
  - *Focus*: Card editor overhaul in stage-pages, dirty draft protection, route vs modal lifecycles

---
## [2026-10-06] Upstream Delta: `edbbcf53..881ec784` (9 commits, 61 files, 33 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus & Key Merges**: Upstream merged 9 commits (edbbcf5384..881ec784fd) alongside 33 PR updates (19 new/unbaselined PRs, 8 lifecycle transitions, 6 discussion updates). The primary momentum centers on audio pipeline decoupling, LLM context window protection, and hosted cloud platform expansions:
  1. **Audio Pipeline Subscriptions (PR #2769 / Commit `91953f0380` by @nekomeowww)**: Major architectural overhaul (+2416/-8 across 30 files) decoupling browser audio adapters (`@proj-airi/audio`) from capture intervals/playback groups (`@proj-airi/pipelines-audio`), enabling shared audio sources via reactive subscriptions.
  2. **Context Window Protection (PR #2788 / Commit `c291c10f68` by @cheesemori)**: Stopped returning heavy base64 image data in the `image_journal` tool return payload, eliminating LLM context window bloat and runaway token costs by carrying only metadata/`entryId` and letting the UI resolve image bytes via `backgroundStore`.
  3. **UI Polish & Markdown Fixes**: Fixed tilde (`~~~`) code fence Shiki highlighting (PR #2797 / Commit `2416064d70`), fixed floating chat mode switch drag bounds and pointer capture leaks (PR #2812 / Commit `1d44ed3c2f`), and animated card editor routes in `stage-web` (PR #2811 / Commit `0a1ada35dd`).
  4. **Hosted Cloud & Commercial Platform Expansion**: Continues rapid convergence toward commercial hosted infrastructure: merged Flux sign-in spinner polish (PR #2807 / Commit `881ec784fd`), opened PR #2817 (27 comments) for field-level cloud card synchronization with backend quotas, opened PR #2813 for RevenueCat subscription/pack billing, PR #2829 for remote experimental feature controls via admin dashboard, and PR #2828 for `/v1/responses` gateway preference.
  5. **Desktop Shell Stability Wave by @bitxwolf**: A wave of Electron fixes opened for review: PR #2819 (preserve config on update channel switch), PR #2824 (move tray `once()` guard to module level), PR #2826 (guarantee `isFileClosed` in `finally`), PR #2827 (structured logger on startup failure), and PR #2820 (`errorMessageFrom`).
* **Discussion & Community Buzz**:
  - 💬 **#2817: `feat(api,stage-ui): synchronize character cards by field` (27 comments)**: Intense discussion regarding remote cloud sync protocol, account card limits (200-card quota), and field-level merge resolution with hosted database.
  - 💬 **#2552: `add bilingual subtitles` (+7 new comments, 24 total)**: Active velocity; author @phx3334 addressed 4 review issues and requested maintainer re-review from @0xSelenicDove for bracketed subtitle parsing.
  - 💬 **#979: `Feat/dock mode` (+3 new comments, 17 total, Draft ➔ Ready)**: Upstream dock mode PR moved from draft to ready for review with active review discussion.
  - 💬 **#2818: `fix(stage-ui): enforce required OpenRouter reasoning` (+4 comments)**: Enforcing mandatory reasoning in OpenRouter catalog to prevent request rejections when effort: none is sent.
  - 💬 **#2821: `feat(stage-tamagotchi): support remote MCP servers over streamable HTTP` (+2 comments)**: Introducing StreamableHTTPClientTransport to connect to remote MCP endpoints via HTTP/HTTPS.
  - 👁️ **Watched PRs Radar**:
    - **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain`** [Draft] (1 comment): Quiet; maintainers still haven't triaged the 2-process daemon requirement.
    - **#2672: `refactor(stage-ui): bind conversations to window-local characters`** [Draft] (48 comments): Steady discussion.
    - **#2541: `feat(plugins): drop in plugins and MCP-first tool architecture`** [Open] (59 comments): Awaiting maintainer rebase review.
    - **#2290: `feat(server): stream official ASR over WebSocket`** [Open] (59 comments): Changes requested; awaiting transport decision.
    - **#2120: `refactor(stage-pages): rebuild AIRI Card editor`** [Open] (41 comments): Changes requested.
    - 🔄 **Lifecycle Note**: PR #1534 (`auto hide controls island`) was permanently closed upstream.
* **Cherry-Pick Candidates**:
  - ✅ **PORTED [dasilva333/airi Commit `800aa8b09c`]: PR #2797 / Commit `2416064d70`: `fix(stage-ui): highlight tilde code fences` by @starvingarc**: High value, minimal diff, zero divergence risk. One-line regex fix in `packages/stage-ui/src/composables/markdown.ts` and `markdown-renderer.vue` to ensure code blocks using `~~~` are properly highlighted.
  - ✅ **PORTED [dasilva333/airi Commit `4bbc72b987`]: PR #2788 / Commit `c291c10f68`: `fix(stage-tamagotchi): keep image data out of journal tool results` by @cheesemori**: High value optimization. In `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/image-journal.ts`, prevents returning base64/URL image data in the LLM tool result JSON, referencing `entryId` instead so image bytes don't pollute the LLM conversation context.
  - ✅ **PORTED [dasilva333/airi Commit `496ec45227`]: PR #2826: `fix(tamagotchi): set isFileClosed in finally block so flag is always set on close` by @bitxwolf**: Clean stability fix in `apps/stage-tamagotchi/src/main/app/file-logger.ts` ensuring file logger closed state is always marked even if handle close throws.
  - ✅ **PORTED [dasilva333/airi Commit `bf97ca614a`]: PR #2824: `fix(tamagotchi): move once() wrapper to module level so guard actually works` by @bitxwolf**: Idempotency fix in `apps/stage-tamagotchi/src/main/tray/index.ts` moving `setupTrayOnce` to module level so repeated tray initialization calls are safely guarded.
  - ✅ **PORTED [dasilva333/airi Commit `22c9c80b03`]: PR #2821: `feat(stage-tamagotchi): support remote MCP servers over streamable HTTP` by @clansty**: Ported remote MCP server support over streamable HTTP. Extended `ElectronMcpServerConfig` in `apps/stage-tamagotchi/src/shared/eventa.ts` and `packages/stage-ui/src/stores/mcp-tool-bridge.ts` to support `{ url: string, headers?: Record<string, string> }` alongside local stdio processes, updated `apps/stage-tamagotchi/src/main/services/airi/mcp-servers/index.ts` to instantiate `StreamableHTTPClientTransport`, and upgraded `apps/stage-tamagotchi/src/renderer/pages/settings/modules/mcp.vue` to connect, display remote endpoints, and install `streamable-http` remotes from the Discover tab registry.
  - 💡 **PR #2818: `fix(stage-ui): enforce required OpenRouter reasoning` by @nayounsang** (Reference): Good reference for handling OpenRouter models that fail when reasoning effort is disabled.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **PR #2817**: Cloud character card field synchronization to hosted backend. Violates local-first architecture (we use local persistence + BYOS).
    - **PR #2813 & PR #2807**: RevenueCat subscription billing & Flux pricing/spinner. Violates offline-first / zero-account architecture.
    - **PR #2828**: `/v1/responses` gateway preference. This fork connects directly to providers and local runtimes.
    - **PR #2829**: Remote experimentation and admin dashboard telemetry flags.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/components/scenarios/chat/components/history.vue`**: PR #2825 touches chat history layout and timestamp separators. In `dasilva333/airi`, `history.vue` is heavily customized with virtualized rendering, custom frames, and multi-actor item handling. Do not merge directly.
  - ⚠️ **`packages/stage-ui/src/stores/modules/consciousness.ts` & `provider.ts`**: PR #2818 touches reasoning controls. Our fork has deep customizations for System-1 Jev gating, actor manifestation, and prompt building.
  - ⚠️ **`apps/stage-tamagotchi` Desktop Shell**: PR #2812 and #2819-#2827 touch Electron main process window management, tray setup, and config persistence. Our architecture cleanly separates the Actor Stage (`windows/stage`) from the Control Strip (`windows/main`) using `injeca`.

### 📋 Upstream Commits
- `881ec784fd` fix(stage-pages): keep the Flux spinner until sign-in leaves the page (#2807) [#2807](https://github.com/moeru-ai/airi/pull/2807) _(RainbowBird, 2026-10-06)_
- `91953f0380` feat(pipelines-audio,audio): share audio sources through subscriptions (#2769) [#2769](https://github.com/moeru-ai/airi/pull/2769) _(Neko, 2026-10-06)_
- `34576c19f6` chore(nix): update pnpmDeps hash (#2810) [#2810](https://github.com/moeru-ai/airi/pull/2810) _(Weathercold, 2026-10-05)_
- `2416064d70` fix(stage-ui): highlight tilde code fences (#2797) [#2797](https://github.com/moeru-ai/airi/pull/2797) _(wyx, 2026-10-06)_
- `c291c10f68` fix(stage-tamagotchi): keep image data out of journal tool results (#2788) [#2788](https://github.com/moeru-ai/airi/pull/2788) _(cheesemori, 2026-10-05)_
- `b2c17e6c2a` chore(skills): add the enforce-rules-for-i18n skill (#2805) [#2805](https://github.com/moeru-ai/airi/pull/2805) _(蓝莓🫐, 2026-10-05)_
- `7b6a340761` fix(ci): preserve labels and correct PR review reconciliation (#2808) [#2808](https://github.com/moeru-ai/airi/pull/2808) _(Columbina, 2026-10-05)_
- `0a1ada35dd` feat(stage-web): animate AIRI card editor routes (#2811) [#2811](https://github.com/moeru-ai/airi/pull/2811) _(凌莞~(=^▽^=), 2026-10-06)_
- `1d44ed3c2f` fix(stage-tamagotchi): fix the floating chat mode switch and its growth during a drag (#2812) [#2812](https://github.com/moeru-ai/airi/pull/2812) _(蓝莓🫐, 2026-10-05)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 10 file(s) (+328/-9)
- `.agents/skills/enforce-rules-for-i18n/SKILL.md` *(+109/-0)*
- `.github/labeling.md` *(+10/-2)*
- `.github/labels.yml` *(+15/-0)*
- `.github/scripts/check-locales.ts` *(+7/-1)*
- `.github/scripts/pr-review-labels.test.ts` *(+46/-1)*
- `.github/workflows/pr-review-labels.yml` *(+6/-3)*
- `.github/workflows/sync-labels.yml` *(+1/-0)*
- `AGENTS.md` *(+1/-0)*
- `packages/audio/README.md` *(+76/-0)*
- `packages/pipelines-audio/README.md` *(+57/-2)*

#### Other / Uncategorized (`🔍 inspect`) — 35 file(s) (+2591/-12)
- `.agents/skills/enforce-rules-for-i18n/agents/openai.yaml` *(+4/-0)*
- `.agents/skills/enforce-rules-for-i18n/scripts/apply-review.mjs` *(+114/-0)*
- `.agents/skills/enforce-rules-for-i18n/scripts/pending-review.mjs` *(+128/-0)*
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/audio/src/browser.browser.test.ts` *(+107/-0)*
- `packages/audio/src/browser/audio-output.ts` *(+153/-0)*
- `packages/audio/src/browser/capture.worklet.ts` *(+29/-0)*
- `packages/audio/src/browser/index.ts` *(+3/-0)*
- `packages/audio/src/browser/media-stream.ts` *(+24/-0)*
- `packages/audio/src/browser/playback.ts` *(+19/-0)*
- `packages/audio/src/browser/sources.ts` *(+130/-0)*
- `packages/audio/src/encoding/index.ts` *(+2/-0)*
- `packages/audio/src/encoding/media-file.test.ts` *(+63/-0)*
- `packages/audio/src/encoding/media-file.ts` *(+149/-0)*
- `packages/audio/src/encoding/pcm-stream.test.ts` *(+34/-0)*
- `packages/audio/src/encoding/pcm-stream.ts` *(+130/-0)*
- `packages/audio/tsdown.config.ts` *(+3/-0)*
- `packages/audio/vitest.config.ts` *(+11/-1)*
- `packages/pipelines-audio/src/audio-input.test.ts` *(+339/-0)*
- `packages/pipelines-audio/src/audio-input.ts` *(+330/-0)*
- `packages/pipelines-audio/src/capture.ts` *(+113/-0)*
- `packages/pipelines-audio/src/index.ts` *(+5/-0)*
- `packages/pipelines-audio/src/observe.ts` *(+212/-0)*
- `packages/pipelines-audio/src/playback.test.ts` *(+88/-0)*
- `packages/pipelines-audio/src/playback.ts` *(+227/-0)*
- `packages/pipelines-audio/src/scope.ts` *(+74/-0)*
- `packages/pipelines-audio/src/speech-pipeline.ts` *(+1/-0)*
- `packages/pipelines-audio/src/stream.ts` *(+13/-3)*
- `packages/pipelines-audio/src/types.ts` *(+2/-0)*
- `packages/stage-ui/src/components/markdown/markdown-renderer.browser.test.ts` *(+13/-0)*
- `packages/stage-ui/src/components/markdown/markdown-renderer.vue` *(+1/-1)*
- `packages/stage-ui/src/composables/markdown.test.ts` *(+13/-0)*
- `packages/stage-ui/src/composables/markdown.ts` *(+1/-1)*
- `packages/stage-ui/src/libs/auth.test.ts` *(+34/-0)*
- `packages/stage-ui/src/libs/auth.ts` *(+21/-5)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 8 file(s) (+146/-50)
- `apps/stage-tamagotchi/src/main/windows/chat/floating.ts` *(+40/-17)*
- `apps/stage-tamagotchi/src/main/windows/chat/mode-switch.ts` *(+3/-2)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+29/-0)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+18/-10)*
- `apps/stage-tamagotchi/src/renderer/components/chat-tool-renderers/journal-tool-call-block.vue` *(+11/-4)*
- `apps/stage-tamagotchi/src/renderer/pages/chat-floating.vue` *(+39/-11)*
- `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/image-journal.ts` *(+1/-2)*
- `apps/stage-tamagotchi/src/shared/eventa/index.ts` *(+5/-4)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 2 file(s) (+88/-6)
- `apps/stage-web/src/App.vue` *(+30/-6)*
- `apps/stage-web/src/styles/transitions.css` *(+58/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 3 file(s) (+22/-2)
- `packages/audio/package.json` *(+8/-1)*
- `packages/pipelines-audio/package.json` *(+2/-1)*
- `pnpm-lock.yaml` *(+12/-0)*

#### UI Primitives & Pages (`📦 import / inspect`) — 3 file(s) (+10/-6)
- `packages/stage-pages/src/pages/settings/airi-card/[cardId]/edit.vue` *(+2/-2)*
- `packages/stage-pages/src/pages/settings/airi-card/new.vue` *(+2/-2)*
- `packages/stage-pages/src/pages/settings/flux.vue` *(+6/-2)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (19)
- [#2820](https://github.com/moeru-ai/airi/pull/2820) `fix(tamagotchi): replace getErrorMessage wrapper with errorMessageFrom from @moeru/std` by **@bitxwolf** *(2 comments)*
- [#2828](https://github.com/moeru-ai/airi/pull/2828) `feat(chat): prefer Responses with protocol fallback` by **@luoling8192** *(3 comments)*
- [#2829](https://github.com/moeru-ai/airi/pull/2829) `feat(settings): add experimental feature controls` by **@luoling8192** *(2 comments)*
- [#2825](https://github.com/moeru-ai/airi/pull/2825) `feat(chat): add readable message times and simplify sender labels` by **@luoling8192** *(2 comments)*
- [#2827](https://github.com/moeru-ai/airi/pull/2827) `fix(stage-tamagotchi): use structured logger instead of console.error for startup failure` by **@bitxwolf** *(2 comments)*
- [#2813](https://github.com/moeru-ai/airi/pull/2813) `feat(api,stage-ui): bill subscriptions and Flux packs through RevenueCat` by **@lulu0119** *(Draft)* *(1 comments)*
- [#2824](https://github.com/moeru-ai/airi/pull/2824) `fix(tamagotchi): move once() wrapper to module level so guard actually works` by **@bitxwolf** *(2 comments)*
- [#2819](https://github.com/moeru-ai/airi/pull/2819) `fix(tamagotchi): preserve existing config when updating update channel` by **@bitxwolf** *(2 comments)*
- [#2826](https://github.com/moeru-ai/airi/pull/2826) `fix(tamagotchi): set isFileClosed in finally block so flag is always set on close` by **@bitxwolf** *(2 comments)*
- [#2807](https://github.com/moeru-ai/airi/pull/2807) `fix(stage-pages): keep the Flux spinner until sign-in leaves the page` by **@luoling8192** *(1 comments)*
- [#2823](https://github.com/moeru-ai/airi/pull/2823) `fix(stage-ui): broadcast spark commands from the LLM tool again` by **@clansty** *(2 comments)*
- [#2822](https://github.com/moeru-ai/airi/pull/2822) `feat(provider-inference,vite-plugin-sherpaw): serve sherpaw model artifacts from a mirror` by **@clansty** *(2 comments)*
- [#2817](https://github.com/moeru-ai/airi/pull/2817) `feat(api,stage-ui): synchronize character cards by field` by **@luoling8192** *(27 comments)*
- [#2821](https://github.com/moeru-ai/airi/pull/2821) `feat(stage-tamagotchi): support remote MCP servers over streamable HTTP` by **@clansty** *(2 comments)*
- [#2818](https://github.com/moeru-ai/airi/pull/2818) `fix(stage-ui): enforce required OpenRouter reasoning` by **@nayounsang** *(4 comments)*
- [#2815](https://github.com/moeru-ai/airi/pull/2815) `fix(stage-web): limit service worker precache to app shell` by **@lorenzozanee** *(1 comments)*
- [#2797](https://github.com/moeru-ai/airi/pull/2797) `fix(stage-ui): highlight tilde code fences` by **@starvingarc** *(1 comments)*
- [#2805](https://github.com/moeru-ai/airi/pull/2805) `chore(skills): add the enforce-rules-for-i18n skill` by **@chiba233** *(1 comments)*
- [#2812](https://github.com/moeru-ai/airi/pull/2812) `fix(stage-tamagotchi): fix the floating chat mode switch and its growth during a drag` by **@chiba233** *(1 comments)*

#### 🔄 PR Status & Lifecycle Changes (8)
- [#1534](https://github.com/moeru-ai/airi/pull/1534) `Add feature: auto hide controls island` — `OPEN` ➔ `CLOSED`
- [#979](https://github.com/moeru-ai/airi/pull/979) `Feat/dock mode` — `Draft` ➔ `Ready`
- [#2809](https://github.com/moeru-ai/airi/pull/2809) `feat(stage-tamagotchi): hide read messages in the danmaku feed` — `Draft` ➔ `Ready`
- [#2769](https://github.com/moeru-ai/airi/pull/2769) `feat(pipelines-audio,audio): share audio sources through subscriptions` — `OPEN` ➔ `MERGED`
- [#2810](https://github.com/moeru-ai/airi/pull/2810) `chore(nix): update pnpmDeps hash` — `OPEN` ➔ `MERGED`
- [#2788](https://github.com/moeru-ai/airi/pull/2788) `fix(stage-tamagotchi): keep image data out of journal tool results` — `OPEN` ➔ `MERGED`
- [#2808](https://github.com/moeru-ai/airi/pull/2808) `fix(ci): preserve labels and correct PR review reconciliation` — `OPEN` ➔ `MERGED`
- [#2811](https://github.com/moeru-ai/airi/pull/2811) `feat(stage-web): animate AIRI card editor routes` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (6)
- [#2590](https://github.com/moeru-ai/airi/pull/2590) `feat(provider): add display names for v2 Provider connections` — *+1 comments (7 ➔ 8 total)*
- [#2552](https://github.com/moeru-ai/airi/pull/2552) ` add bilingual subtitles` — *+7 comments (17 ➔ 24 total)*
- [#979](https://github.com/moeru-ai/airi/pull/979) `Feat/dock mode` — *+3 comments (14 ➔ 17 total)*
- [#2802](https://github.com/moeru-ai/airi/pull/2802) `chore(i18n): update translations` — *+1 comments (3 ➔ 4 total)*
- [#2679](https://github.com/moeru-ai/airi/pull/2679) `docs: update development setup guide` — *+1 comments (4 ➔ 5 total)*
- [#2770](https://github.com/moeru-ai/airi/pull/2770) `feat(core-agent): add the voice controller, transcripts, and plugins` — *+1 comments (1 ➔ 2 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(1 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` [Draft] — *(48 comments)*
  - *Focus*: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard
- [#2541](https://github.com/moeru-ai/airi/pull/2541) `Telltworose/feat/drop in plugins` [OPEN] — *(59 comments)*
  - *Focus*: MCP stdio child processes & card-level tool scoping; track author rebase and explanation to maintainers regarding deleted in-process loader
- [#2290](https://github.com/moeru-ai/airi/pull/2290) `feat(server): stream official ASR over WebSocket` [OPEN] — *(59 comments)*
  - *Focus*: Official ASR streaming over WebSocket vs OpenAI-compatible HTTP SSE; track rebase and backend transport decisions
- [#2120](https://github.com/moeru-ai/airi/pull/2120) `refactor(stage-pages): rebuild AIRI Card editor` [OPEN] — *(41 comments)*
  - *Focus*: Card editor overhaul in stage-pages, dirty draft protection, route vs modal lifecycles

---
## [2026-10-05] Upstream Delta: `87230a0d..edbbcf53` (15 commits, 95 files, 35 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus & Key Merges**: Upstream merged 15 commits (87230a0d4f..edbbcf5384) alongside 35 PR updates (29 new/unbaselined PRs, 1 status change, 5 discussion changes). The dominant theme is an emergency reversal wave of recent desktop optimizations, paired with a new chat emotion sticker system:
  1. **Emergency Reversal Wave (5 Reverts by @nekomeowww)**: Upstream rapidly reverted 5 commits merged over the past 24–48 hours:
     - `ffd94c1e4d`: Reverted off-screen window recovery (PR #2203 / `bda0146d64`) due to multi-monitor / Wayland positioning regressions.
     - `64e2a33c6b`: Restored bundled ONNX runtimes in `electron-builder.config.ts` (PR #2611 / `3a41b446ee` packaging exclusions broke local inference).
     - `a8a52125ca`: Restored bundled CJK fonts in `electron-builder.config.ts` and `uno.config.ts` (PR #2612 / `6aa39e0a7a` font exclusion caused missing glyphs).
     - `9e0877e0b3`: Reverted configuration write isolation across host lifecycles (PR #2776 / `188eac8362`) in `apps/stage-tamagotchi`.
     - `edbbcf5384`: Reverted API Route provider (PR #2526 / `c097190cb7`) in `packages/provider-inference`.
  2. **Chat Emotion Stickers & Local Library (PR #2714 / Commit `7187df8caf`)**: Added 12 bundled Airi emotion stickers, a local sticker store/repository (`stickers.repo.ts`), import/tagging/delete modals, and sticker rendering in assistant chat bubbles.
  3. **MiniMax Speech Settings Page (PR #2703 / Commit `da4b47e7f3`)**: Added `minimax-speech.vue` settings route, dynamic `POST /v1/get_voice` fetching with locale badges, and fallback voice IDs.
  4. **Hosted Flux Pricing & Onboarding (PRs #2794 & #2800 / Commits `bd10aa1db6`, `9006e08033`)**: Made Flux token pricing public on `stage-web` and polished onboarding copy.
  5. **Dependency & CI Updates**: Bumped AUV to 0.0.28 (PR #2801 / `0d403340e4`), automated CI category labels and review handoffs (PR #2806 / `9e689b1ed9`), and updated Nix pnpm hash (PR #2790 / `da72cc620a`).
* **Discussion & Community Buzz**:
  - 💬 **#2512: `fix: fix security issue in artistry.ts` (+9 new comments, 19 total)**: Ongoing discussions regarding parameter validation and security hardening in image generation workflows.
  - 💬 **#2769: `feat(pipelines-audio,audio): share audio sources through subscriptions` (+6 new comments, 8 total)**: High discussion velocity exploring shared audio subscription architectures between audio pipeline processors.
  - 💬 **#2552: `add bilingual subtitles` (+5 new comments, 17 total)**: Active community interest in bilingual subtitle rendering in captions overlay.
  - 💬 **#1891: `fix(stage-ui, stage-ui-live2d): repair broken Live2D expression pipeline and add config-driven emotion mapping` (+3 new comments, 28 total)**: Further debate on Live2D expression fallback ordering and configuration schemas.
  - 💬 **#2590: `feat(provider): add display names for v2 Provider connections` (+3 new comments, 7 total)**: Discussing custom display name labeling for multiple provider accounts.
  - 👁️ **Watched PRs Radar**:
    - **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain`** [Draft] (1 total): Remained quiet; maintainers have not officially triaged the 2-process daemon architecture.
    - **#2672: `refactor(stage-ui): bind conversations to window-local characters`** [Draft] (48 total): Maintained steady review volume regarding conversation scoping and character decoupling.
* **Cherry-Pick Candidates**:
  - 🛑 **CRITICAL REVERSAL ALERT — DO NOT PORT**: Yesterday's candidate PR #2203 (`bda0146d64` / off-screen window recovery), PR #2776 (`188eac8362` / config write isolation), PR #2611 (`3a41b446ee` / ONNX runtime exclusion), PR #2612 (`6aa39e0a7a` / CJK font exclusion), and PR #2526 (`c097190cb7` / API Route provider) were **ALL REVERTED** upstream today due to runtime breakages and packaging bugs. Any plans to adapt PR #2203 or packaging exclusions should be halted immediately.
  - 💡 **PR #2714 / Commit `7187df8caf`: `feat(chat): add optional emotion stickers and a local library` by @LemonNeko**: The 12 bundled PNG sticker assets and local sticker repository offer high UI charm. Note that upstream wired the orchestrator into `packages/core-agent` and `packages/stage-ui/src/stores/chat.ts`. If adopted in `dasilva333/airi`, we should cherry-pick the static assets and sticker UI components only, adapting them to our native multi-actor message parser.
  - 💡 **PR #2703 / Commit `da4b47e7f3`: `fix(stage-pages): add the MiniMax Speech settings page` by @DennyHo0917**: Clean implementation of dynamic voice catalog fetching (`POST /v1/get_voice`) and locale badges on voice dropdowns. Our fork does not currently wire MiniMax Speech, but this is a solid reference pattern.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **PR #2794 (`bd10aa1db6`) & PR #2800 (`9006e08033`)**: Hosted Flux pricing display and cloud onboarding. This fork is 100% offline-first / local-first with zero accounts or billing.
    - **Reverted commits `ffd94c1e4d`, `64e2a33c6b`, `a8a52125ca`, `9e0877e0b3`, `edbbcf5384`**: Explicitly retracted upstream.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts`**: Touched in Commit `7187df8caf` (PR #2714) for emotion sticker state and assistant rendering. In `dasilva333/airi`, `chat.ts` contains customized multi-actor `<|ACTOR|>` dynamic staging, prompt builder integration, and local dreaming pipelines. Never blind-merge.
  - ⚠️ **`apps/stage-tamagotchi` Desktop Shell**: Revert churn across `electron-builder.config.ts`, `windows/main/index.ts`, and host service plugins. Our Electron architecture cleanly decouples the Actor Stage (`windows/stage`) from the Control Strip (`windows/main`) using `injeca` service containers.

### 📋 Upstream Commits
- `edbbcf5384` revert(provider-inference): remove API Route provider  _(Neko Ayaka, 2026-10-05)_
- `9e0877e0b3` revert(stage-tamagotchi): remove configuration write isolation  _(Neko Ayaka, 2026-10-05)_
- `a8a52125ca` revert(stage-tamagotchi): restore bundled CJK fonts  _(Neko Ayaka, 2026-10-05)_
- `64e2a33c6b` revert(stage-tamagotchi): restore bundled ONNX runtimes  _(Neko Ayaka, 2026-10-05)_
- `ffd94c1e4d` revert(stage-tamagotchi): remove off-screen window recovery  _(Neko Ayaka, 2026-10-05)_
- `0d403340e4` chore(stage-tamagotchi): bump AUV to 0.0.28 (#2801) [#2801](https://github.com/moeru-ai/airi/pull/2801) _(Neko, 2026-10-05)_
- `9e689b1ed9` feat(ci): automate category labels and PR review handoff (#2806) [#2806](https://github.com/moeru-ai/airi/pull/2806) _(Columbina, 2026-10-05)_
- `9006e08033` feat(stage-pages): polish Flux pricing and onboarding (#2800) [#2800](https://github.com/moeru-ai/airi/pull/2800) _(RainbowBird, 2026-10-05)_
- `da4b47e7f3` fix(stage-pages): add the MiniMax Speech settings page (#2703) [#2703](https://github.com/moeru-ai/airi/pull/2703) _(Jhonny Barrios Sandrea, 2026-10-04)_
- `7adb8973e6` chore: update sponsors svg (#2803) [#2803](https://github.com/moeru-ai/airi/pull/2803) _(Neko, 2026-10-05)_
- `7187df8caf` feat(chat): add optional emotion stickers and a local library (#2714) [#2714](https://github.com/moeru-ai/airi/pull/2714) _(reverieach, 2026-10-05)_
- `6aa39e0a7a` perf(stage-tamagotchi): exclude special CJK fonts (#2612) [#2612](https://github.com/moeru-ai/airi/pull/2612) _(Younsang Na, 2026-10-05)_
- `da72cc620a` chore(nix): update pnpmDeps hash (#2790) [#2790](https://github.com/moeru-ai/airi/pull/2790) _(Weathercold, 2026-10-04)_
- `975b13dec0` chore(stage-tamagotchi): bump auv to 0.0.27 (#2799) [#2799](https://github.com/moeru-ai/airi/pull/2799) _(Neko, 2026-10-05)_
- `bd10aa1db6` feat(stage-web): make Flux pricing public (#2794) [#2794](https://github.com/moeru-ai/airi/pull/2794) _(RainbowBird, 2026-10-05)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 15 file(s) (+4107/-4680)
- `.github/category-labeling.md` *(+31/-0)*
- `.github/labeling.md` *(+50/-0)*
- `.github/labels.yml` *(+8/-0)*
- `.github/scripts/copilot-labels.test.ts` *(+133/-0)*
- `.github/scripts/pr-review-labels.test.ts` *(+221/-0)*
- `.github/workflows/copilot-labels.yml` *(+130/-0)*
- `.github/workflows/pr-review-event.yml` *(+13/-0)*
- `.github/workflows/pr-review-labels.yml` *(+124/-0)*
- `.github/workflows/pr-triage-dispatch.yml` *(+8/-7)*
- `.github/workflows/pr-triage.lock.yml` *(+0/-1130)*
- `.github/workflows/pr-triage.md` *(+0/-214)*
- `docs/content/public/assets/sponsors/sponsors.json` *(+3305/-3327)*
- `docs/content/public/assets/sponsors/sponsors.svg` *(+2/-2)*
- `packages/stage-ui/README.md` *(+33/-0)*
- `packages/stage-ui/src/assets/stickers/README.md` *(+49/-0)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 11 file(s) (+77/-736)
- `apps/stage-tamagotchi/electron-builder.config.ts` *(+0/-5)*
- `apps/stage-tamagotchi/src/main/libs/electron/persistence-isolation.test.ts` *(+0/-92)*
- `apps/stage-tamagotchi/src/main/libs/electron/persistence.ts` *(+16/-33)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/config.ts` *(+0/-3)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/index.ts` *(+45/-74)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/index.test.ts` *(+0/-104)*
- `apps/stage-tamagotchi/src/main/windows/main/index.test.ts` *(+0/-197)*
- `apps/stage-tamagotchi/src/main/windows/main/index.ts` *(+16/-65)*
- `apps/stage-tamagotchi/src/main/windows/shared/app-icon.test.ts` *(+0/-1)*
- `apps/stage-tamagotchi/src/main/windows/shared/display.test.ts` *(+0/-79)*
- `apps/stage-tamagotchi/src/main/windows/shared/display.ts` *(+0/-83)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 1 file(s) (+3/-0)
- `apps/stage-web/src/App.vue` *(+3/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 44 file(s) (+2542/-321)
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/provider-inference/src/providers/cloud/api-route/index.ts` *(+0/-53)*
- `packages/provider-inference/src/providers/cloud/minimax-speech/index.test.ts` *(+366/-0)*
- `packages/provider-inference/src/providers/cloud/minimax-speech/index.ts` *(+276/-29)*
- `packages/provider-inference/src/providers/index.ts` *(+139/-141)*
- `packages/provider-inference/src/providers/registry.test.ts` *(+45/-47)*
- `packages/stage-ui/src/assets/stickers/airi-affectionate.png` *(+0/-0)*
- `packages/stage-ui/src/assets/stickers/airi-agree.png` *(+0/-0)*
- `packages/stage-ui/src/assets/stickers/airi-angry.png` *(+0/-0)*
- `packages/stage-ui/src/assets/stickers/airi-awkward.png` *(+0/-0)*
- `packages/stage-ui/src/assets/stickers/airi-celebrate.png` *(+0/-0)*
- `packages/stage-ui/src/assets/stickers/airi-confused.png` *(+0/-0)*
- `packages/stage-ui/src/assets/stickers/airi-disagree.png` *(+0/-0)*
- `packages/stage-ui/src/assets/stickers/airi-happy.png` *(+0/-0)*
- `packages/stage-ui/src/assets/stickers/airi-sad.png` *(+0/-0)*
- `packages/stage-ui/src/assets/stickers/airi-surprised.png` *(+0/-0)*
- `packages/stage-ui/src/assets/stickers/airi-thanks.png` *(+0/-0)*
- `packages/stage-ui/src/assets/stickers/airi-tired.png` *(+0/-0)*
- `packages/stage-ui/src/assets/stickers/generation.json` *(+418/-0)*
- `packages/stage-ui/src/assets/stickers/index.ts` *(+28/-0)*
- `packages/stage-ui/src/components/auth/SignInPanel.vue` *(+4/-5)*
- `packages/stage-ui/src/components/modules/index.ts` *(+1/-0)*
- `packages/stage-ui/src/components/modules/stickers.vue` *(+200/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/assistant-item.browser.test.ts` *(+77/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/assistant-item.vue` *(+2/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/sticker.vue` *(+32/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.browser.test.ts` *(+10/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.vue` *(+40/-6)*
- `packages/stage-ui/src/components/scenarios/providers/speech-playground.vue` *(+60/-10)*
- `packages/stage-ui/src/components/scenarios/providers/speech-provider-settings.browser.test.ts` *(+139/-0)*
- `packages/stage-ui/src/components/scenarios/providers/speech-provider-settings.vue` *(+37/-15)*
- `packages/stage-ui/src/composables/use-modules-list.ts` *(+11/-0)*
- `packages/stage-ui/src/constants/index.ts` *(+1/-0)*
- `packages/stage-ui/src/constants/public-links.ts` *(+8/-0)*
- `packages/stage-ui/src/database/repos/stickers.repo.ts` *(+30/-0)*
- `packages/stage-ui/src/libs/providers/attributes.ts` *(+0/-1)*
- `packages/stage-ui/src/libs/providers/metadata.test.ts` *(+0/-11)*
- `packages/stage-ui/src/libs/providers/providers/provider-settings-pages.test.ts` *(+50/-0)*
- `packages/stage-ui/src/libs/stickers/import.ts` *(+48/-0)*
- `packages/stage-ui/src/stores/modules/stickers.browser.test.ts` *(+354/-0)*
- `packages/stage-ui/src/stores/modules/stickers.ts` *(+135/-0)*
- `packages/stage-ui/src/types/chat.ts` *(+1/-0)*
- `packages/stage-ui/src/types/sticker.ts` *(+13/-0)*
- `pnpm-workspace.yaml` *(+16/-2)*

#### Core Agent Runtime (`🔍 inspect`) — 5 file(s) (+215/-4)
- `packages/core-agent/README.md` *(+13/-0)*
- `packages/core-agent/src/index.ts` *(+1/-0)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.test.ts` *(+158/-0)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts` *(+36/-3)*
- `packages/core-agent/src/types/chat.ts` *(+7/-1)*

#### Localization (i18n) (`📦 import (additive only)`) — 9 file(s) (+249/-0)
- `packages/i18n/src/locales/en/settings.yaml` *(+82/-0)*
- `packages/i18n/src/locales/es/settings.yaml` *(+13/-0)*
- `packages/i18n/src/locales/fr/settings.yaml` *(+13/-0)*
- `packages/i18n/src/locales/ja/settings.yaml` *(+10/-0)*
- `packages/i18n/src/locales/ko/settings.yaml` *(+13/-0)*
- `packages/i18n/src/locales/ru/settings.yaml` *(+10/-0)*
- `packages/i18n/src/locales/vi/settings.yaml` *(+10/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+85/-0)*
- `packages/i18n/src/locales/zh-Hant/settings.yaml` *(+13/-0)*

#### Stage Layouts & Shells (`🔍 inspect`) — 1 file(s) (+133/-101)
- `packages/stage-layouts/src/components/Layouts/HeaderAvatar.vue` *(+133/-101)*

#### UI Primitives & Pages (`📦 import / inspect`) — 5 file(s) (+526/-31)
- `packages/stage-pages/src/pages/settings/flux.browser.test.ts` *(+71/-0)*
- `packages/stage-pages/src/pages/settings/flux.vue` *(+84/-31)*
- `packages/stage-pages/src/pages/settings/modules/stickers.vue` *(+17/-0)*
- `packages/stage-pages/src/pages/settings/providers/speech/minimax-speech.browser.test.ts` *(+189/-0)*
- `packages/stage-pages/src/pages/settings/providers/speech/minimax-speech.vue` *(+165/-0)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 3 file(s) (+287/-9)
- `packages/stage-ui/src/stores/chat-stickers.browser.test.ts` *(+237/-0)*
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+5/-0)*
- `packages/stage-ui/src/stores/chat.ts` *(+45/-9)*

#### Root Build & Tooling (`🔍 inspect`) — 1 file(s) (+48/-36)
- `pnpm-lock.yaml` *(+48/-36)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (29)
- [#2811](https://github.com/moeru-ai/airi/pull/2811) `feat(stage-web): animate AIRI card editor routes` by **@clansty** *(2 comments)*
- [#2810](https://github.com/moeru-ai/airi/pull/2810) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#979](https://github.com/moeru-ai/airi/pull/979) `Feat/dock mode` by **@s3d-i** *(Draft)* *(14 comments)*
- [#1107](https://github.com/moeru-ai/airi/pull/1107) `fix(providers): use native ElevenLabs API on desktop to avoid unspeech proxy 401` by **@Hanfeng-Lin** *(12 comments)*
- [#1216](https://github.com/moeru-ai/airi/pull/1216) `feat(alaya): lay the groundwork for standalone short-term memory planner/query` by **@freezinlove** *(21 comments)*
- [#1264](https://github.com/moeru-ai/airi/pull/1264) `feat: add mem9.ai long-term memory integration` by **@YangKeao** *(Draft)* *(7 comments)*
- [#1334](https://github.com/moeru-ai/airi/pull/1334) `feat(telegram-bot): add long-term memory and debug flow tracker` by **@Oldcircle** *(5 comments)*
- [#1382](https://github.com/moeru-ai/airi/pull/1382) `feat(memory): add integrated recall and consolidation pipeline` by **@yuki61256-cell** *(3 comments)*
- [#1427](https://github.com/moeru-ai/airi/pull/1427) `feat(stage-tamagotchi): dashboard ui` by **@nekomeowww** *(Draft)* *(13 comments)*
- [#1449](https://github.com/moeru-ai/airi/pull/1449) `fix: bypass iOS Silent mode for web audio playback` by **@yudanmao123** *(11 comments)*
- [#1519](https://github.com/moeru-ai/airi/pull/1519) `feat(singing): add local singing cover generation and voice training pipeline` by **@Joker-of-Gotham** *(103 comments)*
- [#1534](https://github.com/moeru-ai/airi/pull/1534) `Add feature: auto hide controls island` by **@leaft** *(27 comments)*
- [#1538](https://github.com/moeru-ai/airi/pull/1538) `feat: ComfyUI fallback + session fixes` by **@roseonlineownz-lab** *(21 comments)*
- [#1579](https://github.com/moeru-ai/airi/pull/1579) `feat(visual-chat): harden vision-text pipeline and packaged desktop runtime` by **@Joker-of-Gotham** *(19 comments)*
- [#1888](https://github.com/moeru-ai/airi/pull/1888) `fix(stage-ui): bound sign-out requests` by **@wuyua9** *(25 comments)*
- [#1901](https://github.com/moeru-ai/airi/pull/1901) `feat(server): send survey email after first payment` by **@Neko-233** *(1 comments)*
- [#1968](https://github.com/moeru-ai/airi/pull/1968) `Local main` by **@Suzumiya-SOS** *(3 comments)*
- [#2011](https://github.com/moeru-ai/airi/pull/2011) `fix(stage-ui): proxy openai-compatible requests in electron` by **@jim139129** *(20 comments)*
- [#2067](https://github.com/moeru-ai/airi/pull/2067) `feat(stage-tamagotchi): add optional periodic screen awareness` by **@aierkuite** *(12 comments)*
- [#2127](https://github.com/moeru-ai/airi/pull/2127) `fix(electron): persist desktop window bounds` by **@luoling8192** *(3 comments)*
- [#2267](https://github.com/moeru-ai/airi/pull/2267) `feat(api-server): 接入 StepFun 流式 TTS` by **@luoling8192** *(Draft)* *(1 comments)*
- [#2311](https://github.com/moeru-ai/airi/pull/2311) `fix(analytics): correct app entry event semantics` by **@luoling8192** *(Draft)* *(1 comments)*
- [#2798](https://github.com/moeru-ai/airi/pull/2798) `refactor(api): replace Langfuse export with request logs` by **@luoling8192** *(1 comments)*
- [#2802](https://github.com/moeru-ai/airi/pull/2802) `chore(i18n): update translations` by **@github-actions** *(3 comments)*
- [#2801](https://github.com/moeru-ai/airi/pull/2801) `chore(stage-tamagotchi): bump AUV to 0.0.28` by **@nekomeowww** *(2 comments)*
- [#2809](https://github.com/moeru-ai/airi/pull/2809) `feat(stage-tamagotchi): hide read messages in the danmaku feed` by **@chiba233** *(Draft)* *(1 comments)*
- [#1016](https://github.com/moeru-ai/airi/pull/1016) `feat(stage-pocket): push notifications` by **@LemonNekoGH** *(Draft)* *(4 comments)*
- [#1237](https://github.com/moeru-ai/airi/pull/1237) `feat(stage-ui): add chat settings with stream idle timeout` by **@Minnzen** *(6 comments)*
- [#2808](https://github.com/moeru-ai/airi/pull/2808) `fix(ci): preserve labels and correct PR review reconciliation` by **@0xSelenicDove** *(1 comments)*

#### 🔄 PR Status & Lifecycle Changes (1)
- [#2792](https://github.com/moeru-ai/airi/pull/2792) `feat(stage-pages): group pooled settlements in Flux history` — `OPEN` ➔ `CLOSED`

#### 💬 Discussion Activity (5)
- [#2552](https://github.com/moeru-ai/airi/pull/2552) ` add bilingual subtitles` — *+5 comments (12 ➔ 17 total)*
- [#2769](https://github.com/moeru-ai/airi/pull/2769) `feat(pipelines-audio,audio): share audio sources through subscriptions` — *+6 comments (2 ➔ 8 total)*
- [#1891](https://github.com/moeru-ai/airi/pull/1891) `fix(stage-ui, stage-ui-live2d): repair broken Live2D expression pipeline and add config-driven emotion mapping` — *+3 comments (25 ➔ 28 total)*
- [#2590](https://github.com/moeru-ai/airi/pull/2590) `feat(provider): add display names for v2 Provider connections` — *+3 comments (4 ➔ 7 total)*
- [#2512](https://github.com/moeru-ai/airi/pull/2512) `fix: fix security issue in artistry.ts` — *+9 comments (10 ➔ 19 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(1 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` [Draft] — *(48 comments)*
  - *Focus*: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard

---
## [2026-10-04] Upstream Delta: `450c5d81..87230a0d` (20 commits, 292 files, 93 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus & Key Merges**: Upstream merged 20 commits (`450c5d81dc`..`87230a0d4f`) across 292 files, alongside 93 PR updates (42 new PRs, 20 lifecycle transitions, 31 discussion changes). Key themes include:
  1. **Desktop Package Size Optimization (PR #2611 / Commit `3a41b446ee`)**: Excluded `onnxruntime-node` and duplicate `onnxruntime-web` from desktop ASAR packaging in `apps/stage-tamagotchi/electron-builder.config.ts`, reducing unpacked macOS application size by ~15.1% (~286 MB down to 1.60 GB).
  2. **Window Bounds & Off-Screen Recovery (PR #2203 / Commit `bda0146d64`)**: Detects and restores off-screen or disconnected-monitor main window positions back to the primary display work area while preserving coordinates across active displays and native Wayland.
  3. **Rendering & Memory Leak Hygiene (PR #2609 / Commit `be6b8789b7` & PR #2286 / Commit `2f07b69fa1`)**: Added a 30/60/unlimited FPS cap for VRM in `ThreeScene.vue` and `model-store.ts` (mitigating idle GPU overhead), and fixed unmount memory leaks by cancelling lingering `requestAnimationFrame` and removing document drag listeners.
  4. **Audio & TTS Unicode Handling (PR #2369 / Commit `343cff90e6`)**: Fixed `chunkTtsInput` in `packages/pipelines-audio/src/processors/tts-chunker.ts` to preserve multi-code-unit grapheme clusters (Thai combining marks and multi-byte emojis) without stripping them before TTS synthesis.
  5. **Host Configuration Isolation & Shutdown Flushing (PR #2776 / Commit `188eac8362`)**: Bound settings persistence to `userData` paths per-host lifecycle and added graceful flush on shutdown to prevent cross-lifecycle save collisions.
  6. **Core Agent Concurrency & UI Components (PR #2771 / Commit `7684415927` & PR #2762 / Commit `edfdda3dd5`)**: Enables running chat sessions concurrently with storage receipts, and added a shared `dropdown-menu.vue` primitive in `@proj-airi/ui`.
  7. **Hosted Cloud Billing Iteration (PRs #2785, #2783, #2791, #2675)**: Continued migrations and ledger refinements for hosted `/v1/responses` gateway and Flux token fees.
* **Discussion & Community Buzz**:
  - 💬 **#2382: `feat(stage-ui): add Doubao speech provider with bidirectional streaming TTS` (+62 new comments, 78 total)**: High discussion surge around ByteDance Doubao bidirectional streaming speech provider.
  - 💬 **#2370: `fix(stage-ui,stage-layouts): start streaming transcription when microphone is enabled` (+29 new comments, 30 total)**: Intense discussion regarding microphone capture lifecycle and streaming transcription timing.
  - 💬 **#2410: `fix(stage-ui): use MiMo v2.5 ASR for transcription` (+9 new comments, 11 total)**: Community discussion around MiMo v2.5 speech-to-text integration.
  - 💬 **#2512: `fix: fix security issue in artistry.ts` (+6 new comments, 10 total)**: Review discussion regarding sanitization and security handling in artistry generation.
  - 💬 **#2203: `fix(desktop): restore off-screen main window` (+4 new comments, 62 total)**: Extensive testing feedback before merging the multi-monitor display recovery fix.
  - 💬 **#2782: `fix(stage-tamagotchi): follow cursor on native Wayland` (+3 new comments, 4 total)**: Active community work on Wayland cursor tracking.
  - 👁️ **Watched PRs Radar**:
    - **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain`** [Draft] (1 total): Remained quiet; maintainers have not officially triaged the 2-process daemon architecture.
    - **#2672: `refactor(stage-ui): bind conversations to window-local characters`** [Draft] (48 total): Maintained steady review volume regarding conversation scoping and character decoupling.
* **Cherry-Pick Candidates**:
  - ✅ **PORTED & COMMITTED: PR #2609 / Commit `be6b8789b7`: `feat(stage-ui-three): add a VRM frame rate limit` by @Penluna**: Ported to `ThreeScene.vue` and `model-store.ts` via commit `b21760d23a`, with subsequent UI refinement streamlining the FPS row into the Advanced section and adopting warm lighting defaults via commit `f1a3001d81`.
  - ✅ **PORTED & COMMITTED: PR #2286 / Commit `2f07b69fa1`: `fix(stage-ui): cancel animation frames and remove drag listeners on unmount` by @BitWolf**: Ported to `cursor-momentum.vue`, `property-number.vue`, and `property-point.vue` via commit `ec63c84ef6`.
  - ✅ **PORTED & COMMITTED: PR #2369 / Commit `343cff90e6`: `fix(pipelines-audio): preserve grapheme clusters in TTS chunks` by @mrlonely**: Ported to `packages/pipelines-audio/src/processors/tts-chunker.ts` and test suite via commit `4757bcc488`. Audio Studio UST (`transformTextForSpeech` in `speech.ts`) retains user authority over emoji and symbol stripping before synthesis.
  - ⏸️ **ALREADY PRESENT: PR #2611 / Commit `3a41b446ee`: `perf(stage-tamagotchi): exclude duplicate ONNX runtimes` by @nayounsang**: Confirmed duplicate ONNX exclusions are already active in our desktop packaging configuration.
  - 💡 **PR #2203 / Commit `bda0146d64`: `fix(desktop): restore off-screen main window` by @MarkXian**: Excellent window manager resilience. Detects when window bounds fall outside active displays (e.g. unplugged external monitor) and snaps back to the primary work area. Can be selectively adapted to our decoupled Control Strip and Stage window manager services.
  - 💡 **PR #2762 / Commit `edfdda3dd5`: `feat(ui): add shared dropdown menu` by @蓝莓**: Clean UI primitive (`packages/ui/src/components/misc/dropdown-menu.vue`). Standardizes dropdown menus across desktop/web views.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **Commits `4158789d07`, `41335077ee`, `e20e28936f`, `87230a0d4f` (PRs #2675, #2783, #2785, #2791)**: Server-side hosted billing and Flux ledger migrations in `server/apps/api`. We are 100% offline-first / local-first with zero accounts or token balances.
    - **PR #2397 / Commit `4e5de09e82`**: Patches obsolete `controls-island` profile switcher (surface permanently removed in our fork).
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts` & `core-agent`**: Heavy modifications in Commit `7684415927` (PR #2771) for concurrent chat sessions and storage receipts. In our fork, `chat.ts` contains customized multi-actor `<|ACTOR|>` dynamic staging, prompt builder integration, and local dreaming pipelines. Do not blind-merge.
  - ⚠️ **`apps/stage-tamagotchi/src/renderer/App.vue` & `apps/stage-tamagotchi/src/main/index.ts`**: Touched by Commit `5e4aa616f4` (PR #2530) and `188eac8362` (PR #2776). Our Electron architecture decouples the Actor Stage from the Control Strip and uses `injeca` service containers. Ensure any IPC cleanup or lifecycle persistence changes are manually adapted to our decoupled services.

### 📋 Upstream Commits
- `87230a0d4f` fix(api): stop writing TTS requests to llm_request_log (#2791) [#2791](https://github.com/moeru-ai/airi/pull/2791) _(RainbowBird, 2026-10-04)_
- `bda0146d64` fix(desktop): restore off-screen main window (#2203) [#2203](https://github.com/moeru-ai/airi/pull/2203) _(Mark Xian, 2026-10-04)_
- `e2ede509d6` chore(README.md): clarify translation contributions across locales (#2787) [#2787](https://github.com/moeru-ai/airi/pull/2787) _(蓝莓🫐, 2026-10-04)_
- `6529f2cea4` docs(ui): add entrance animations and optimize performance across UI components (#2252) [#2252](https://github.com/moeru-ai/airi/pull/2252) _(MilkyWeighW, 2026-10-04)_
- `2f07b69fa1` fix(stage-ui): cancel animation frames and remove drag listeners on unmount (#2286) [#2286](https://github.com/moeru-ai/airi/pull/2286) _(Bit Wolf, 2026-10-04)_
- `a109de44e3` chore(stage-tamagotchi-kirie): bump Kirie to 0.8.0 (#2789) [#2789](https://github.com/moeru-ai/airi/pull/2789) _(LemonNeko, 2026-10-04)_
- `343cff90e6` fix(pipelines-audio): preserve grapheme clusters in TTS chunks (#2369) [#2369](https://github.com/moeru-ai/airi/pull/2369) _(mrlonely, 2026-10-04)_
- `5e4aa616f4` fix(stage-tamagotchi): remove obsolete mouse tracking IPC (#2530) [#2530](https://github.com/moeru-ai/airi/pull/2530) _(keeponlight, 2026-10-04)_
- `be6b8789b7` feat(stage-ui-three): add a VRM frame rate limit (#2609) [#2609](https://github.com/moeru-ai/airi/pull/2609) _(Penluna, 2026-10-04)_
- `3a41b446ee` perf(stage-tamagotchi): exclude duplicate ONNX runtimes (#2611) [#2611](https://github.com/moeru-ai/airi/pull/2611) _(Younsang Na, 2026-10-04)_
- `390535bbd4` fix(minecraft): explain AIRI authentication failures (#2750) [#2750](https://github.com/moeru-ai/airi/pull/2750) _(Huyvux12, 2026-10-04)_
- `c097190cb7` feat(provider-inference): add API Route provider (#2526) [#2526](https://github.com/moeru-ai/airi/pull/2526) _(DennyHo0917, 2026-10-04)_
- `4e5de09e82` fix(stage-ui): open Save as New Profile form (#2397) [#2397](https://github.com/moeru-ai/airi/pull/2397) _(Younsang Na, 2026-10-04)_
- `188eac8362` fix(stage-tamagotchi): isolate configuration writes across host lifecycles (#2776) [#2776](https://github.com/moeru-ai/airi/pull/2776) _(Columbina, 2026-10-03)_
- `f368855e06` test(stage-tamagotchi): verify linux window rendering in CI (#2519) [#2519](https://github.com/moeru-ai/airi/pull/2519) _(이윤진(Lee Yunjin), 2026-10-04)_
- `e20e28936f` refactor(api): drop the request-log Flux column and the settlement archive (#2785) [#2785](https://github.com/moeru-ai/airi/pull/2785) _(RainbowBird, 2026-10-04)_
- `4158789d07` feat(api): store LLM request and error content (#2675) [#2675](https://github.com/moeru-ai/airi/pull/2675) _(RainbowBird, 2026-10-04)_
- `41335077ee` refactor(api): store micro-Flux fees in flux_usage (#2783) [#2783](https://github.com/moeru-ai/airi/pull/2783) _(RainbowBird, 2026-10-04)_
- `edfdda3dd5` feat(ui): add shared dropdown menu (#2762) [#2762](https://github.com/moeru-ai/airi/pull/2762) _(蓝莓🫐, 2026-10-04)_
- `7684415927` feat(core-agent): run chat sessions concurrently with storage receipts (#2771) [#2771](https://github.com/moeru-ai/airi/pull/2771) _(Neko, 2026-10-03)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 146 file(s) (+676/-536)
- `.github/workflows/tamagotchi-linux-window-smoke.yml` *(+240/-0)*
- `README.md` *(+10/-7)*
- `docs/.vitepress/components/BlogPosts.vue` *(+56/-46)*
- `docs/.vitepress/components/Home.vue` *(+1/-1)*
- `docs/.vitepress/components/Navbar.vue` *(+11/-2)*
- `docs/.vitepress/components/ParallaxCoverChristmas20251224.vue` *(+5/-5)*
- `docs/.vitepress/components/SearchTrigger.vue` *(+67/-150)*
- `docs/.vitepress/components/Snowfall.vue` *(+44/-63)*
- `docs/.vitepress/components/ThemeToggle.vue` *(+5/-2)*
- `docs/.vitepress/custom/Docs.vue` *(+58/-78)*
- `docs/.vitepress/custom/Layout.vue` *(+40/-35)*
- `docs/.vitepress/theme/index.ts` *(+0/-1)*
- `docs/.vitepress/theme/theme-animations.css` *(+0/-53)*
- `docs/README.fr.md` *(+10/-7)*
- `docs/README.ja-JP.md` *(+10/-7)*
- `docs/README.ko-KR.md` *(+10/-7)*
- `docs/README.ru-RU.md` *(+10/-7)*
- `docs/README.vi.md` *(+10/-7)*
- `docs/README.zh-CN.md` *(+10/-7)*
- `docs/ai/context/ui-components.md` *(+17/-0)*
- `docs/content/en/blog/DevLog-2025.08.26/assets/factorio-ultralytics-hub-preview.avif` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.08.26/assets/factorio-ultralytics-hub-preview.jpg` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.08.26/index.md` *(+1/-1)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/control-island.avif` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/control-island.png` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/electron.avif` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/electron.png` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/moeru.avif` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/moeru.png` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/project-airi.avif` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/project-airi.png` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/rust-tts.avif` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/rust-tts.png` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/three-mmd.avif` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/three-mmd.png` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/velin.avif` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/assets/velin.png` *(+0/-0)*
- `docs/content/en/blog/DevLog-2025.10.20/index.md` *(+6/-6)*
- `docs/content/en/blog/DevLog-2026.01.01/assets/cover-dark.avif` *(+0/-0)*
- `docs/content/en/blog/DevLog-2026.01.01/assets/cover-dark.png` *(+0/-0)*
- `docs/content/en/blog/DevLog-2026.01.01/assets/cover-light.avif` *(+0/-0)*
- `docs/content/en/blog/DevLog-2026.01.01/assets/cover-light.png` *(+0/-0)*
- `docs/content/en/blog/DevLog-2026.01.01/assets/helldiver-laughing.avif` *(+0/-0)*
- `docs/content/en/blog/DevLog-2026.01.01/assets/helldiver-laughing.png` *(+0/-0)*
- `docs/content/en/blog/DevLog-2026.01.01/index.md` *(+3/-3)*
- `docs/content/ja/blog/DevLog-2025.08.26/index.md` *(+1/-1)*
- `docs/content/ja/blog/Devlog-2025.10.20/index.md` *(+6/-6)*
- `docs/content/ja/blog/DreamLog-0x1/index.md` *(+1/-0)*
- `docs/content/ko/blog/DevLog-2025.08.26/index.md` *(+1/-1)*
- `docs/content/ko/blog/DevLog-2025.10.20/index.md` *(+6/-6)*
- `docs/content/ko/blog/DevLog-2026.01.01/index.md` *(+3/-3)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.dark.en-US.avif` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.dark.en-US.png` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.dark.ja-JP.avif` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.dark.ja-JP.png` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.dark.kr-KR.avif` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.dark.kr-KR.png` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.dark.ru-RU.avif` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.dark.ru-RU.png` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.dark.zh-Hans.avif` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.dark.zh-Hans.png` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.light.en-US.avif` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.light.en-US.png` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.light.ja-JP.avif` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.light.ja-JP.png` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.light.kr-KR.avif` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.light.kr-KR.png` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.light.ru-RU.avif` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.light.ru-RU.png` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.light.zh-Hans.avif` *(+0/-0)*
- `docs/content/public/assets/QR code button/section.cards.qrcode.light.zh-Hans.png` *(+0/-0)*
- `docs/content/public/assets/download-buttons/download-buttons.browser.dark.en-US.avif` *(+0/-0)*
- `docs/content/public/assets/download-buttons/download-buttons.browser.dark.en-US.png` *(+0/-0)*
- `docs/content/public/assets/download-buttons/download-buttons.browser.dark.zh-Hans.avif` *(+0/-0)*
- `docs/content/public/assets/download-buttons/download-buttons.browser.dark.zh-Hans.png` *(+0/-0)*
- `docs/content/public/assets/download-buttons/download-buttons.browser.light.en-US.avif` *(+0/-0)*
- `docs/content/public/assets/download-buttons/download-buttons.browser.light.en-US.png` *(+0/-0)*
- `docs/content/public/assets/download-buttons/download-buttons.browser.light.zh-Hans.avif` *(+0/-0)*
- `docs/content/public/assets/download-buttons/download-buttons.browser.light.zh-Hans.png` *(+0/-0)*
- `docs/content/public/assets/sponsors/kofi-supporters.json` *(+1/-1)*
- `docs/content/public/new-bg-halloween.avif` *(+0/-0)*
- `docs/content/public/new-bg-halloween.png` *(+0/-0)*
- `docs/content/public/wechat-qr.avif` *(+0/-0)*
- `docs/content/public/wechat-qr.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2025.08.26/assets/factorio-ultralytics-hub-preview.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2025.08.26/assets/factorio-ultralytics-hub-preview.jpg` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2025.08.26/index.md` *(+1/-1)*
- `docs/content/zh-Hans/blog/DevLog-2026.01.01/assets/cover-dark.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2026.01.01/assets/cover-dark.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2026.01.01/assets/cover-light.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2026.01.01/assets/cover-light.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2026.01.01/assets/helldiver-laughing.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2026.01.01/assets/helldiver-laughing.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2026.01.01/index.md` *(+3/-3)*
- `docs/content/zh-Hans/blog/DevLog-2026.02.16/assets/add-button-to-menu.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2026.02.16/assets/add-button-to-menu.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2026.02.16/assets/some-collected-data.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2026.02.16/assets/some-collected-data.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/DevLog-2026.02.16/index.md` *(+2/-2)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/control-island.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/control-island.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/electron.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/electron.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/moeru.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/moeru.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/project-airi.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/project-airi.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/rust-tts.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/rust-tts.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/three-mmd.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/three-mmd.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/velin.avif` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/assets/velin.png` *(+0/-0)*
- `docs/content/zh-Hans/blog/Devlog-2025.10.20/index.md` *(+6/-6)*
- `docs/content/zh-Hans/blog/DreamLog-0x1/index.md` *(+1/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-10.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-10.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-11.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-11.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-12.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-12.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-14.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-14.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-15.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-15.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-16.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-16.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-17.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-17.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-2.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-2.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-3.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-3.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-4.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-4.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-6.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-6.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-7.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-7.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-8.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-8.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-9.avif` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/image-9.png` *(+0/-0)*
- `docs/content/zh-Hans/docs/manual/tamagotchi/setup-and-use/index.md` *(+10/-10)*
- `docs/wechat.md` *(+1/-1)*
- `integrations/minecraft/README.md` *(+9/-0)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 32 file(s) (+2009/-573)
- `apps/stage-tamagotchi-kirie/MIGRATION.md` *(+7/-7)*
- `apps/stage-tamagotchi-kirie/README.md` *(+4/-4)*
- `apps/stage-tamagotchi-kirie/StageTamagotchiKirie.csproj` *(+2/-2)*
- `apps/stage-tamagotchi-kirie/docs/host-architecture.md` *(+1/-1)*
- `apps/stage-tamagotchi-kirie/package.json` *(+4/-4)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/InteractiveArea.browser.test.ts` *(+20/-114)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/InteractiveArea.vue` *(+4/-6)*
- `apps/stage-tamagotchi/electron-builder.config.ts` *(+5/-0)*
- `apps/stage-tamagotchi/package.json` *(+1/-0)*
- `apps/stage-tamagotchi/scripts/desktop-overlay-live-window-smoke.ts` *(+7/-180)*
- `apps/stage-tamagotchi/scripts/{desktop-overlay-live-window-smoke.test.ts => lib/remote-debug.test.ts}` *(+20/-1)*
- `apps/stage-tamagotchi/scripts/lib/remote-debug.ts` *(+225/-0)*
- `apps/stage-tamagotchi/scripts/linux-window-render-smoke.ts` *(+481/-0)*
- `apps/stage-tamagotchi/src/main/libs/electron/persistence-isolation.test.ts` *(+92/-0)*
- `apps/stage-tamagotchi/src/main/libs/electron/persistence.ts` *(+33/-16)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/config.ts` *(+3/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/index.ts` *(+74/-45)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/index.test.ts` *(+104/-0)*
- `apps/stage-tamagotchi/src/main/windows/main/index.test.ts` *(+197/-0)*
- `apps/stage-tamagotchi/src/main/windows/main/index.ts` *(+65/-16)*
- `apps/stage-tamagotchi/src/main/windows/shared/app-icon.test.ts` *(+1/-0)*
- `apps/stage-tamagotchi/src/main/windows/shared/display.test.ts` *(+79/-0)*
- `apps/stage-tamagotchi/src/main/windows/shared/display.ts` *(+83/-0)*
- `apps/stage-tamagotchi/src/renderer/App.vue` *(+0/-3)*
- `apps/stage-tamagotchi/src/renderer/app.browser.test.ts` *(+408/-0)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+20/-114)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+5/-7)*
- `apps/stage-tamagotchi/src/renderer/components/chat-window/chat-window-style-menu.browser.test.ts` *(+5/-0)*
- `apps/stage-tamagotchi/src/renderer/components/chat-window/chat-window-style-menu.vue` *(+44/-52)*
- `apps/stage-tamagotchi/src/shared/eventa/index.ts` *(+0/-1)*
- `apps/stage-tamagotchi/src/test/setup-live2d.browser.ts` *(+12/-0)*
- `apps/stage-tamagotchi/vitest.config.ts` *(+3/-0)*

#### Deprecated Surfaces (Control Island) (`⚪ ignore / rejected in fork (decoupled into Control Strip)`) — 2 file(s) (+10/-1)
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-profile-picker.vue` *(+2/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/index.vue` *(+8/-1)*

#### Other / Uncategorized (`🔍 inspect`) — 24 file(s) (+802/-429)
- `"docs/content/public/assets/Sponsor's avatar/\343\203\237\343\202\253.avif"` *(+0/-0)*
- `"docs/content/public/assets/Sponsor's avatar/\343\203\237\343\202\253.jpg"` *(+0/-0)*
- `integrations/minecraft/.env` *(+3/-0)*
- `integrations/minecraft/src/airi/start-background-client.test.ts` *(+145/-0)*
- `integrations/minecraft/src/airi/start-background-client.ts` *(+26/-2)*
- `packages/pipelines-audio/src/processors/tts-chunker.test.ts` *(+46/-0)*
- `packages/pipelines-audio/src/processors/tts-chunker.ts` *(+4/-5)*
- `packages/provider-inference/src/providers/cloud/api-route/index.ts` *(+53/-0)*
- `packages/provider-inference/src/providers/index.ts` *(+141/-139)*
- `packages/provider-inference/src/providers/registry.test.ts` *(+47/-45)*
- `packages/stage-ui/src/components/data-pane/property-number.vue` *(+6/-1)*
- `packages/stage-ui/src/components/data-pane/property-point.vue` *(+6/-1)*
- `packages/stage-ui/src/components/misc/profile-switcher-popover.browser.test.ts` *(+90/-0)*
- `packages/stage-ui/src/components/misc/profile-switcher-popover.vue` *(+2/-2)*
- `packages/stage-ui/src/components/physics/cursor-momentum.vue` *(+5/-2)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.vue` *(+38/-52)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-fps.browser.test.ts` *(+28/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm.vue` *(+13/-0)*
- `packages/stage-ui/src/libs/providers/attributes.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/providers/metadata.test.ts` *(+11/-0)*
- `packages/stage-ui/src/stores/mods/api/context-bridge.contract.browser.test.ts` *(+26/-8)*
- `packages/stage-ui/src/stores/mods/api/context-bridge.ts` *(+104/-166)*
- `pnpm-workspace.yaml` *(+6/-6)*
- `sponsorkit.config.js` *(+1/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 2 file(s) (+30/-26)
- `integrations/minecraft/package.json` *(+1/-0)*
- `pnpm-lock.yaml` *(+29/-26)*

#### Core Agent Runtime (`🔍 inspect`) — 7 file(s) (+417/-69)
- `packages/core-agent/src/index.ts` *(+1/-0)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.test.ts` *(+135/-1)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts` *(+198/-68)*
- `packages/core-agent/src/runtime/llm-service.test.ts` *(+68/-0)*
- `packages/core-agent/src/runtime/llm-service.ts` *(+3/-0)*
- `packages/core-agent/src/types/chat.ts` *(+4/-0)*
- `packages/core-agent/src/types/llm.ts` *(+8/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+10/-0)
- `packages/i18n/src/locales/en/settings.yaml` *(+5/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+5/-0)*

#### Stage Layouts & Shells (`🔍 inspect`) — 3 file(s) (+87/-106)
- `packages/stage-layouts/src/components/Layouts/HeaderAvatar.vue` *(+79/-94)*
- `packages/stage-layouts/src/components/Layouts/InteractiveArea.vue` *(+4/-6)*
- `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` *(+4/-6)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 2 file(s) (+4/-0)
- `packages/stage-ui-three/src/components/ThreeScene.vue` *(+2/-0)*
- `packages/stage-ui-three/src/stores/model-store.ts` *(+2/-0)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 5 file(s) (+232/-44)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+28/-9)*
- `packages/stage-ui/src/stores/chat.ts` *(+95/-27)*
- `packages/stage-ui/src/stores/chat/session-store.browser.test.ts` *(+60/-0)*
- `packages/stage-ui/src/stores/chat/session-store.ts` *(+32/-1)*
- `packages/stage-ui/src/stores/chat/stream-store.ts` *(+17/-7)*

#### UI Primitives & Pages (`📦 import / inspect`) — 2 file(s) (+73/-0)
- `packages/ui/src/components/misc/dropdown-menu.vue` *(+72/-0)*
- `packages/ui/src/components/misc/index.ts` *(+1/-0)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 65 file(s) (+13689/-2069)
- `server/apps/api/README.md` *(+53/-12)*
- `server/apps/api/drizzle.config.ts` *(+1/-1)*
- `server/apps/api/drizzle/0028_flux_usage.sql` *(+14/-0)*
- `server/apps/api/drizzle/0029_llm_request_content.sql` *(+4/-0)*
- `server/apps/api/drizzle/0030_drop_flux_consumed_and_settlement.sql` *(+2/-0)*
- `server/apps/api/drizzle/meta/0028_snapshot.json` *(+4038/-0)*
- `server/apps/api/drizzle/meta/0029_snapshot.json` *(+4062/-0)*
- `server/apps/api/drizzle/meta/0030_snapshot.json` *(+3891/-0)*
- `server/apps/api/drizzle/meta/_journal.json` *(+21/-0)*
- `server/apps/api/src/app.test.ts` *(+2/-1)*
- `server/apps/api/src/app.ts` *(+24/-32)*
- `server/apps/api/src/otel/index.ts` *(+2/-2)*
- `server/apps/api/src/routes/audio-speech-ws/route.test.ts` *(+26/-27)*
- `server/apps/api/src/routes/audio-speech-ws/session.ts` *(+23/-35)*
- `server/apps/api/src/routes/audio-speech-ws/types.ts` *(+5/-7)*
- `server/apps/api/src/routes/flux/index.ts` *(+15/-0)*
- `server/apps/api/src/routes/flux/route.test.ts` *(+60/-71)*
- `server/apps/api/src/routes/openai/v1/middlewares/billing.ts` *(+18/-58)*
- `server/apps/api/src/routes/openai/v1/operations/chat-completions/index.ts` *(+51/-67)*
- `server/apps/api/src/routes/openai/v1/operations/responses/index.ts` *(+29/-39)*
- `server/apps/api/src/routes/openai/v1/operations/speech-generation/index.ts` *(+1/-3)*
- `server/apps/api/src/routes/openai/v1/route.test.ts` *(+160/-168)*
- `server/apps/api/src/routes/openai/v1/types.ts` *(+4/-2)*
- `server/apps/api/src/routes/stripe/checkout.test.ts` *(+1/-1)*
- `server/apps/api/src/routes/stripe/payment-release.test.ts` *(+1/-3)*
- `server/apps/api/src/schemas/flux-usage.ts` *(+23/-0)*
- `server/apps/api/src/schemas/flux.ts` *(+6/-2)*
- `server/apps/api/src/schemas/index.ts` *(+1/-1)*
- `server/apps/api/src/schemas/llm-request-attempt.ts` *(+1/-0)*
- `server/apps/api/src/schemas/llm-request-log.ts` *(+4/-2)*
- `server/apps/api/src/schemas/llm-request-settlement.ts` *(+0/-28)*
- `server/apps/api/src/services/adapters/config-kv/definitions.ts` *(+0/-3)*
- `server/apps/api/src/services/domain/billing/billing-service.ts` *(+106/-462)*
- `server/apps/api/src/services/domain/billing/billing.ts` *(+29/-7)*
- `server/apps/api/src/services/domain/billing/flux-meter.ts` *(+0/-290)*
- `server/apps/api/src/services/domain/billing/flux-posting.ts` *(+24/-0)*
- `server/apps/api/src/services/domain/billing/llm-billing.ts` *(+45/-0)*
- `server/apps/api/src/services/domain/billing/speech-billing.ts` *(+47/-0)*
- `server/apps/api/src/services/domain/billing/tests/billing-service.test.ts` *(+7/-436)*
- `server/apps/api/src/services/domain/billing/tests/billing.test.ts` *(+11/-11)*
- `server/apps/api/src/services/domain/billing/tests/flux-meter.test.ts` *(+0/-224)*
- `server/apps/api/src/services/domain/billing/tests/flux-usage-concurrency.test.ts` *(+61/-0)*
- `server/apps/api/src/services/domain/billing/tests/flux-usage-migration.test.ts` *(+46/-0)*
- `server/apps/api/src/services/domain/billing/tests/flux-usage.test.ts` *(+133/-0)*
- `server/apps/api/src/services/domain/billing/tests/llm-billing.test.ts` *(+59/-0)*
- `server/apps/api/src/services/domain/flux-cache.ts` *(+25/-13)*
- `server/apps/api/src/services/domain/flux-transaction.ts` *(+14/-0)*
- `server/apps/api/src/services/domain/flux.test.ts` *(+3/-3)*
- `server/apps/api/src/services/domain/flux.ts` *(+5/-9)*
- `server/apps/api/src/services/domain/generation-observation.ts` *(+7/-3)*
- `server/apps/api/src/services/domain/llm-router/attempt.ts` *(+3/-0)*
- `server/apps/api/src/services/domain/llm-router/router.ts` *(+7/-2)*
- `server/apps/api/src/services/domain/llm-router/tests/router.test.ts` *(+1/-0)*
- `server/apps/api/src/services/domain/llm-router/types.ts` *(+3/-0)*
- `server/apps/api/src/services/domain/openai-speech/index.ts` *(+7/-19)*
- `server/apps/api/src/services/domain/payment/index.ts` *(+2/-2)*
- `server/apps/api/src/services/domain/payment/tests/payment.test.ts` *(+4/-15)*
- `server/apps/api/src/services/domain/request-content.test.ts` *(+91/-0)*
- `server/apps/api/src/services/domain/request-content.ts` *(+175/-0)*
- `server/apps/api/src/services/domain/request-log.test.ts` *(+23/-2)*
- `server/apps/api/src/services/domain/request-log.ts` *(+3/-1)*
- `server/apps/api/src/utils/redis-keys.ts` *(+0/-4)*
- `server/docs/ai/adr/2026-09-23-provider-cost-billing.md` *(+1/-1)*
- `server/docs/ai/adr/2026-09-27-llm-request-content.md` *(+75/-0)*
- `server/docs/ai/adr/2026-10-04-flux-usage.md` *(+129/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (42)
- [#2793](https://github.com/moeru-ai/airi/pull/2793) `docs: test first contribution` by **@thkh64** *(0 comments)*
- [#2765](https://github.com/moeru-ai/airi/pull/2765) `feat(acp): expose the AIRI desktop chat as an ACP agent` by **@lulu0119** *(Draft)* *(0 comments)*
- [#2792](https://github.com/moeru-ai/airi/pull/2792) `feat(stage-pages): group pooled settlements in Flux history` by **@luoling8192** *(Draft)* *(7 comments)*
- [#2791](https://github.com/moeru-ai/airi/pull/2791) `fix(api): stop writing TTS requests to llm_request_log` by **@luoling8192** *(3 comments)*
- [#1171](https://github.com/moeru-ai/airi/pull/1171) `feat(services/matrix-bot): add matrix_bot` by **@donjuanplatinum** *(13 comments)*
- [#2787](https://github.com/moeru-ai/airi/pull/2787) `chore(README.md): clarify translation contributions across locales` by **@chiba233** *(2 comments)*
- [#2790](https://github.com/moeru-ai/airi/pull/2790) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(2 comments)*
- [#2789](https://github.com/moeru-ai/airi/pull/2789) `chore(stage-tamagotchi-kirie): bump Kirie to 0.8.0` by **@LemonNekoGH** *(2 comments)*
- [#2788](https://github.com/moeru-ai/airi/pull/2788) `fix(stage-tamagotchi): keep image data out of journal tool results` by **@cheesemori** *(2 comments)*
- [#2786](https://github.com/moeru-ai/airi/pull/2786) `docs(security): update vulnerability reporting policy` by **@0xSelenicDove** *(2 comments)*
- [#1983](https://github.com/moeru-ai/airi/pull/1983) `feat(core-agent): add outbound channel registry` by **@NashChennc** *(8 comments)*
- [#1577](https://github.com/moeru-ai/airi/pull/1577) `feat(stage-ui): add GPT-SoVITS speech provider support` by **@orangeZSCB** *(13 comments)*
- [#1518](https://github.com/moeru-ai/airi/pull/1518) `feat(stage-ui,stage-pages,stage-tamagotchi,i18n): add bilingual trans…` by **@Iris0fTheValley** *(31 comments)*
- [#1221](https://github.com/moeru-ai/airi/pull/1221) `feat(providers): add IndexTTS-2 Text-to-Speech (TTS) provider` by **@AnyaCoder** *(5 comments)*
- [#1040](https://github.com/moeru-ai/airi/pull/1040) `feat(openclaw): add OpenClaw bridge and Stage integration` by **@botBehavior** *(7 comments)*
- [#2195](https://github.com/moeru-ai/airi/pull/2195) `Dannielyu219/feat/llm thinking toggle` by **@DannielYu219** *(11 comments)*
- [#1757](https://github.com/moeru-ai/airi/pull/1757) `feat(stage-tamagotchi): add local account avatar upload` by **@fordelkon** *(4 comments)*
- [#2313](https://github.com/moeru-ai/airi/pull/2313) `fix(stage-ui): register chat-ingestion consumers only after the transport is ready (#2305)` by **@yzxcj797** *(13 comments)*
- [#2209](https://github.com/moeru-ai/airi/pull/2209) `feat(stage-ui): add emotion and relationship bond state` by **@Tonystarkw12** *(10 comments)*
- [#2199](https://github.com/moeru-ai/airi/pull/2199) `feat(speech): implement user-configurable bilingual subtitles and dual-language routing` by **@aamir2003-star** *(39 comments)*
- [#2163](https://github.com/moeru-ai/airi/pull/2163) `feat(stage-ui): refresh MiniMax Speech TTS provider config` by **@octo-patch** *(7 comments)*
- [#2105](https://github.com/moeru-ai/airi/pull/2105) `fix(discord): prevent control token leakage` by **@Woww603** *(6 comments)*
- [#2097](https://github.com/moeru-ai/airi/pull/2097) `fix(discord): bound and fairly schedule retained input work` by **@Woww603** *(12 comments)*
- [#2051](https://github.com/moeru-ai/airi/pull/2051) `feat(stage-tamagotchi): add opt-in companion observation mode` by **@Miuuter** *(53 comments)*
- [#1125](https://github.com/moeru-ai/airi/pull/1125) `feat(providers): manual model ping and selective validation checks` by **@cat1949** *(10 comments)*
- [#1891](https://github.com/moeru-ai/airi/pull/1891) `fix(stage-ui, stage-ui-live2d): repair broken Live2D expression pipeline and add config-driven emotion mapping` by **@LeventureQys** *(25 comments)*
- [#1026](https://github.com/moeru-ai/airi/pull/1026) `feat(providers): add xAI Grok voice providers (TTS/STT)` by **@olsenbudanur** *(13 comments)*
- [#1870](https://github.com/moeru-ai/airi/pull/1870) `feat: implement EDA long-term memory plugin and upgrade plugin system infrastructure` by **@xiaobin83** *(77 comments)*
- [#2351](https://github.com/moeru-ai/airi/pull/2351) `feat(stage-ui): add MiniMax voice design support` by **@octo-patch** *(5 comments)*
- [#2232](https://github.com/moeru-ai/airi/pull/2232) `feat(stage-ui): add Voicebox local Qwen TTS and Whisper ASR providers` by **@CosimoDi** *(5 comments)*
- [#1820](https://github.com/moeru-ai/airi/pull/1820) `feat(stage-ui,stage-layouts): add collapse/expand toggle to mobile chat history` by **@YTLLL** *(12 comments)*
- [#1450](https://github.com/moeru-ai/airi/pull/1450) `feat: add export/import for provider configurations` by **@yudanmao123** *(8 comments)*
- [#1174](https://github.com/moeru-ai/airi/pull/1174) `feat(providers): add MegaNova AI as a chat provider` by **@bq1024** *(7 comments)*
- [#1981](https://github.com/moeru-ai/airi/pull/1981) `feat(core-agent): add channel ingress runtime` by **@NashChennc** *(4 comments)*
- [#1863](https://github.com/moeru-ai/airi/pull/1863) `Add AIRI chess coach gamelet plugin` by **@shlinawaf717-collab** *(17 comments)*
- [#2103](https://github.com/moeru-ai/airi/pull/2103) `feat(provider-inference): add Eden AI as a chat provider` by **@MVS-source** *(2 comments)*
- [#1982](https://github.com/moeru-ai/airi/pull/1982) `feat(core-agent): add execution config` by **@NashChennc** *(2 comments)*
- [#2785](https://github.com/moeru-ai/airi/pull/2785) `refactor(api): drop the request-log Flux column and the settlement archive` by **@luoling8192** *(7 comments)*
- [#2783](https://github.com/moeru-ai/airi/pull/2783) `refactor(api): store micro-Flux fees in flux_usage` by **@luoling8192** *(2 comments)*
- [#2769](https://github.com/moeru-ai/airi/pull/2769) `feat(pipelines-audio,audio): share audio sources through subscriptions` by **@nekomeowww** *(2 comments)*
- [#2767](https://github.com/moeru-ai/airi/pull/2767) `docs(voice): add the voice pipeline spec and design records` by **@nekomeowww** *(2 comments)*
- [#2770](https://github.com/moeru-ai/airi/pull/2770) `feat(core-agent): add the voice controller, transcripts, and plugins` by **@nekomeowww** *(1 comments)*

#### 🔄 PR Status & Lifecycle Changes (20)
- [#2763](https://github.com/moeru-ai/airi/pull/2763) `refactor(chat): allow concurrent sends across sessions` — `OPEN` ➔ `CLOSED`
- [#2203](https://github.com/moeru-ai/airi/pull/2203) `fix(desktop): restore off-screen main window` — `OPEN` ➔ `MERGED`
- [#2369](https://github.com/moeru-ai/airi/pull/2369) `fix(pipelines-audio): preserve grapheme clusters in TTS chunks` — `OPEN` ➔ `MERGED`
- [#2252](https://github.com/moeru-ai/airi/pull/2252) `docs(ui): add entrance animations and optimize performance across UI components` — `OPEN` ➔ `MERGED`
- [#2286](https://github.com/moeru-ai/airi/pull/2286) `fix(stage-ui): cancel animation frames and remove drag listeners on unmount` — `OPEN` ➔ `MERGED`
- [#2414](https://github.com/moeru-ai/airi/pull/2414) `fix(pipelines-audio): preserve multi-code-unit grapheme clusters in TTS chunking` — `OPEN` ➔ `CLOSED`
- [#2415](https://github.com/moeru-ai/airi/pull/2415) `fix(stage-ui): deliver sends issued during the transport prepare phase` — `OPEN` ➔ `CLOSED`
- [#2530](https://github.com/moeru-ai/airi/pull/2530) `fix(stage-tamagotchi): remove obsolete mouse tracking IPC` — `OPEN` ➔ `MERGED`
- [#2609](https://github.com/moeru-ai/airi/pull/2609) `feat(stage-ui-three): add a VRM frame rate limit` — `OPEN` ➔ `MERGED`
- [#2611](https://github.com/moeru-ai/airi/pull/2611) `perf(stage-tamagotchi): exclude duplicate ONNX runtimes` — `OPEN` ➔ `MERGED`
- [#2616](https://github.com/moeru-ai/airi/pull/2616) `test(stage-ui): poll the provider status instead of reading it synchronously` — `OPEN` ➔ `CLOSED`
- [#2511](https://github.com/moeru-ai/airi/pull/2511) `fix: upgrade gh-pages to 5.0.0 (CVE-2022-37611)` — `OPEN` ➔ `CLOSED`
- [#2750](https://github.com/moeru-ai/airi/pull/2750) `fix(minecraft): explain AIRI authentication failures` — `OPEN` ➔ `MERGED`
- [#2526](https://github.com/moeru-ai/airi/pull/2526) `feat(provider-inference): add API Route provider` — `OPEN` ➔ `MERGED`
- [#2397](https://github.com/moeru-ai/airi/pull/2397) `fix(stage-ui): open Save as New Profile form` — `OPEN` ➔ `MERGED`
- [#2776](https://github.com/moeru-ai/airi/pull/2776) `fix(stage-tamagotchi): isolate configuration writes across host lifecycles` — `OPEN` ➔ `MERGED`
- [#2519](https://github.com/moeru-ai/airi/pull/2519) `test(stage-tamagotchi): verify linux window rendering in CI` — `OPEN` ➔ `MERGED`
- [#2675](https://github.com/moeru-ai/airi/pull/2675) `feat(api): store LLM request and error content` — `OPEN` ➔ `MERGED`
- [#2762](https://github.com/moeru-ai/airi/pull/2762) `feat(ui): add shared dropdown menu` — `OPEN` ➔ `MERGED`
- [#2771](https://github.com/moeru-ai/airi/pull/2771) `feat(core-agent): run chat sessions concurrently with storage receipts` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (31)
- [#2612](https://github.com/moeru-ai/airi/pull/2612) `perf(stage-tamagotchi): exclude special CJK fonts` — *+2 comments (2 ➔ 4 total)*
- [#2237](https://github.com/moeru-ai/airi/pull/2237) `feat(stage-ui): add OpenCode Go provider` — *+1 comments (31 ➔ 32 total)*
- [#2512](https://github.com/moeru-ai/airi/pull/2512) `fix: fix security issue in artistry.ts` — *+6 comments (4 ➔ 10 total)*
- [#2203](https://github.com/moeru-ai/airi/pull/2203) `fix(desktop): restore off-screen main window` — *+4 comments (58 ➔ 62 total)*
- [#2591](https://github.com/moeru-ai/airi/pull/2591) `fix(api): allow packaged transcription preflight` — *+1 comments (2 ➔ 3 total)*
- [#2369](https://github.com/moeru-ai/airi/pull/2369) `fix(pipelines-audio): preserve grapheme clusters in TTS chunks` — *+6 comments (5 ➔ 11 total)*
- [#2252](https://github.com/moeru-ai/airi/pull/2252) `docs(ui): add entrance animations and optimize performance across UI components` — *+2 comments (12 ➔ 14 total)*
- [#2286](https://github.com/moeru-ai/airi/pull/2286) `fix(stage-ui): cancel animation frames and remove drag listeners on unmount` — *+6 comments (10 ➔ 16 total)*
- [#2714](https://github.com/moeru-ai/airi/pull/2714) `feat(chat): add opt-in local reaction stickers` — *+1 comments (2 ➔ 3 total)*
- [#2414](https://github.com/moeru-ai/airi/pull/2414) `fix(pipelines-audio): preserve multi-code-unit grapheme clusters in TTS chunking` — *+2 comments (11 ➔ 13 total)*
- [#2415](https://github.com/moeru-ai/airi/pull/2415) `fix(stage-ui): deliver sends issued during the transport prepare phase` — *+4 comments (8 ➔ 12 total)*
- [#2530](https://github.com/moeru-ai/airi/pull/2530) `fix(stage-tamagotchi): remove obsolete mouse tracking IPC` — *+2 comments (7 ➔ 9 total)*
- [#2609](https://github.com/moeru-ai/airi/pull/2609) `feat(stage-ui-three): add a VRM frame rate limit` — *+1 comments (1 ➔ 2 total)*
- [#2552](https://github.com/moeru-ai/airi/pull/2552) ` add bilingual subtitles` — *+1 comments (11 ➔ 12 total)*
- [#2410](https://github.com/moeru-ai/airi/pull/2410) `fix(stage-ui): use MiMo v2.5 ASR for transcription` — *+9 comments (2 ➔ 11 total)*
- [#2382](https://github.com/moeru-ai/airi/pull/2382) `feat(stage-ui): add Doubao speech provider with bidirectional streaming TTS` — *+62 comments (16 ➔ 78 total)*
- [#2370](https://github.com/moeru-ai/airi/pull/2370) `fix(stage-ui,stage-layouts): start streaming transcription when microphone is enabled` — *+29 comments (1 ➔ 30 total)*
- [#1958](https://github.com/moeru-ai/airi/pull/1958) `fix(stage-ui): persist manual speech voice selection for catalog-free…` — *+1 comments (4 ➔ 5 total)*
- [#2197](https://github.com/moeru-ai/airi/pull/2197) `feat(live2d): support Cubism 2 through generation-specific loaders` — *+1 comments (70 ➔ 71 total)*
- [#2555](https://github.com/moeru-ai/airi/pull/2555) `test(stage-tamagotchi): cover Fade on Hover interaction recovery` — *+1 comments (1 ➔ 2 total)*
- [#2556](https://github.com/moeru-ai/airi/pull/2556) `fix: treat cleanup failure as best-effort in routeModelAliasCandidates` — *+1 comments (1 ➔ 2 total)*
- [#2616](https://github.com/moeru-ai/airi/pull/2616) `test(stage-ui): poll the provider status instead of reading it synchronously` — *+1 comments (1 ➔ 2 total)*
- [#2511](https://github.com/moeru-ai/airi/pull/2511) `fix: upgrade gh-pages to 5.0.0 (CVE-2022-37611)` — *+1 comments (2 ➔ 3 total)*
- [#2526](https://github.com/moeru-ai/airi/pull/2526) `feat(provider-inference): add API Route provider` — *+3 comments (4 ➔ 7 total)*
- [#2397](https://github.com/moeru-ai/airi/pull/2397) `fix(stage-ui): open Save as New Profile form` — *+2 comments (10 ➔ 12 total)*
- [#2667](https://github.com/moeru-ai/airi/pull/2667) `fix(stage-tamagotchi): isolate Eventa IPC contexts by window` — *+1 comments (4 ➔ 5 total)*
- [#2776](https://github.com/moeru-ai/airi/pull/2776) `fix(stage-tamagotchi): isolate configuration writes across host lifecycles` — *+1 comments (3 ➔ 4 total)*
- [#2519](https://github.com/moeru-ai/airi/pull/2519) `test(stage-tamagotchi): verify linux window rendering in CI` — *+1 comments (21 ➔ 22 total)*
- [#2590](https://github.com/moeru-ai/airi/pull/2590) `feat(provider): add display names for v2 Provider connections` — *+2 comments (2 ➔ 4 total)*
- [#2782](https://github.com/moeru-ai/airi/pull/2782) `fix(stage-tamagotchi): follow cursor on native Wayland` — *+3 comments (1 ➔ 4 total)*
- [#2675](https://github.com/moeru-ai/airi/pull/2675) `feat(api): store LLM request and error content` — *+3 comments (8 ➔ 11 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(1 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` [Draft] — *(48 comments)*
  - *Focus*: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard

---
## [2026-10-03] Upstream Delta: `33870846..450c5d81` (14 commits, 90 files, 100 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus & Key Merges**: Upstream merged 14 commits (`33870846ad`..`450c5d81dc`) across 88 files, alongside 100 PR updates (64 new/untracked PRs, 7 lifecycle transitions, 29 discussion activity changes). Key areas of activity include:
  1. **Hosted Cloud Billing & Provider-Cost Settlement (PR #2644 / Commit `450c5d81dc`)**: Upstream merged an extensive 5.7k-line addition to `server/apps/api` adding Drizzle migrations, billing middlewares, and token-cost settlement for their hosted `/v1/responses` and Chat Completions gateway (Flux balance settlement).
  2. **Packaging Optimization & Size Reduction (PR #2613 / Commit `a734c14239`)**: Trimmed `apps/stage-tamagotchi/electron-builder.config.ts` by filtering out non-runtime build/transpile toolchains (`@rolldown`, `rolldown`, `lightningcss`, `fsevents`, `sharp`, `uiohook-napi/libuiohook`), reducing `app.asar.unpacked` by 19.1% and unpacked macOS bundle size by 44 MB (~2.3%).
  3. **Rendering Performance & Layout Optimization (PR #2608 / Commit `1cb0fb0fdf`)**: Swapped synchronous layout-forcing `getBoundingClientRect()` calls in `ThreeScene.vue` with `@vueuse/core` `useElementBounding` (ResizeObserver-backed with next-frame update), eliminating layout thrashing during mouse cursor tracking on 3D VRM eye gaze.
  4. **Agent Tool-Use Resilience (PR #2753 / Commit `f58aa03a85`)**: Fixed runtime tool deactivation where single-invocation schema errors (`invalid schema for function`, `invalid_function_parameters`, `tool_use_failed`) improperly marked models as completely lacking tool support (`toolsCompatibility: false`).
  5. **Chat Interruptibility & Speech Stop Controls (PR #2741 / Commit `5f44f6f67a`)**: Fixed disappearing stop action between TTS speech segments in `useChatInterruption` and added `liveRemoteStreamSessionId` in `context-bridge.ts` to differentiate actively running generations from completed guards retained for view refreshes.
  6. **Provider Catalog Gating (PR #2575 / Commit `1d9c601fa3`)**: Filtered provider definitions in the v2 settings catalog using `availableProvidersMetadata` from `useProviderStore()`, preventing surface-gated providers (e.g. NVIDIA NIM on desktop only) from erroneously appearing on web.
  7. **Card Wake Words & Local IO Traces (PR #2768 / Commit `24e977551e` & PR #2774 / Commit `a4da7edd73`)**: Added schema and store support for attaching wake words/pronunciations to character card extensions, and added background JSONL logging for OpenTelemetry IO traces in the Electron main process.
  8. **Emerging Voice & Chat PRs**: PR #2773 (composer-style voice inlay drafts), PR #2772 (shared voice pipeline unification), PR #2763 (concurrent sends across chat sessions), and PR #2771 (chat session storage receipts).
* **Discussion & Community Buzz**:
  - 💬 **#2435: `feat(stage-ui): add local FunASR transcription provider` (+1 new comment, 197 total)**: Dominant community traction around local Chinese ASR model integration.
  - 💬 **#2541: `Telltworose/feat/drop in plugins` (+1 new comment, 59 total)**: Ongoing architectural debate on drop-in plugin systems.
  - 💬 **#2203: `fix(desktop): restore off-screen main window` (+4 new comments, 58 total)**: High activity on multi-monitor / off-screen desktop window bounds restoration.
  - 💬 **#2459: `fix(core-agent): prevent plain-text tool call leaks` (+1 new comment, 42 total)**: Active debugging on tool-call serialization hygiene.
  - 💬 **#2644: `feat(api): add provider-cost Flux settlement` (+1 new comment, 40 total)**: Concluded active discussion culminating in merge of hosted billing.
  - 💬 **#2519: `test(stage-tamagotchi): verify linux window rendering in CI` (+1 new comment, 21 total)**: Linux CI window rendering tests.
  - 💬 **#2250: `fix(discord): show live bot connection status` (+4 new comments, 17 total)**: Discord bot connectivity feedback.
  - 💬 **#2473: `feat(auth): add native email change flow` (+1 new comment, 12 total)** & **#2252: `docs(ui): add entrance animations and optimize performance across UI components` (+1 new comment, 12 total)**.
  - 💬 **#2414: `fix(pipelines-audio): preserve multi-code-unit grapheme clusters in TTS chunking` (+1 new comment, 11 total)**: Multi-byte unicode splitting issues in TTS sentence chunker.
  - 💬 **#2397: `fix(stage-ui): open Save as New Profile form` (+3 new comments, 10 total)** & **#2286: `fix(stage-ui): cancel animation frames and remove drag listeners on unmount` (+1 new comment, 10 total)**.
  - 💬 **#2741: `fix(stage-layouts): keep the stop action available between speech segments` (+7 new comments, 9 total)**: Rapid discussion velocity preceding its merge.
  - 💬 **#2703: `fix(stage-pages): add the MiniMax Speech settings page` (+4 new comments, 5 total)** & **#2718: `feat(provider-inference): add the MiniMax speech-to-text provider` (+2 new comments, 3 total)**.
  - 👁️ **Watched PRs Radar**:
    - **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain`** [Draft] (1 comment): Dormant / waiting for maintainer reaction on the external daemon architecture.
    - **#2672: `refactor(stage-ui): bind conversations to window-local characters`** [Draft] (48 comments): Maintained high discussion volume regarding window decoupling.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2608 / Commit `1cb0fb0fdf`: `perf(stage-ui-three): cache the screen bounding box instead of forcing layout per read` by @Penluna**: High-value rendering performance optimization. Replaces synchronous `getBoundingClientRect()` on every cursor movement with `useElementBounding` from `@vueuse/core` in `ThreeScene.vue`, preventing forced layout thrashing during 3D VRM eye gaze tracking.
  - ⭐ **PR #2613 / Commit `a734c14239`: `perf(stage-tamagotchi): remove packaging-only dependencies` by @nayounsang**: Direct build/packaging improvement for `apps/stage-tamagotchi/electron-builder.config.ts`. Excludes build-only toolchains (`@rolldown`, `rolldown`, `lightningcss`, `fsevents`, `sharp`, `uiohook-napi/libuiohook`) from the final Electron package, cutting unpacked bundle size by ~19% (~44 MB on macOS).
  - ⭐ **PR #2575 / Commit `1d9c601fa3`: `fix(stage-pages): hide unavailable providers from v2 catalog` by @Bruce-Yii**: Clean UI/store bugfix in `packages/stage-pages/src/pages/v2/settings/providers.vue`. Uses `availableProvidersMetadata` from `useProviderStore()` to ensure surface-gated providers (desktop-only or platform-restricted) do not appear in the add menu on unsupported platforms.
  - 💡 **Design Pattern Port: Tool Error Pattern Cleansing from PR #2753 / Commit `f58aa03a85` by @ybai08**: In `packages/core-agent/src/runtime/llm-service.ts` (and relevant `useLLM` stores in `packages/stage-ui/`), removes `invalid schema for function`, `invalid_function_parameters`, and `tool_use_failed` from `TOOLS_RELATED_ERROR_PATTERNS`. Prevents single malformed tool calls or provider-specific schema rejections from permanently breaking tool calls for that model.
  - 💡 **PR #2741 / Commit `5f44f6f67a`: `fix(stage-layouts): keep the stop action available between speech segments` by @yi111**: Fixes UI glitch where the chat stop button flickers or disappears between TTS speech segments or while remote streams are processing.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **PR #2644 / Commit `450c5d81dc` (`feat(api): add provider-cost Flux settlement`)**: Server-side hosted billing and Flux ledger settlement for `server/apps/api`. Our fork is strictly local-first desktop with BYOS, zero accounts, and direct client-to-provider inference.
    - **PR #2768 / Commit `24e977551e` (`feat(stage-ui): store wake words with character cards`)**: Adds keyword spotting vocabulary and wake words into CCv3 extensions; we maintain strict card format schemas and decoupled speech runtimes.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts`**: Touched by commit `6f654a7e9b` (PR #2144) to add `chatReady` checks. In our fork, `chat.ts` contains customized multi-actor `<|ACTOR|>` switching, dreaming loops, and prompt-builder pipelines; do not blind-cherry-pick.
  - ⚠️ **`apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue`**: Touched by commits `6f654a7e9b`, `7311238610`. In our fork, desktop UI surfaces are decoupled into the Control Strip (`ControlStrip.vue`, `ControlStripHost.vue`) and Actor Stage (`RendererStage.vue`). Monolithic `InteractiveArea.vue` changes must be adapted or rejected.
  - ⚠️ **`apps/stage-tamagotchi/src/main/index.ts` & Electron Eventa Services**: Touched by commit `a4da7edd73` (PR #2774) for IO trace recording. Our main process has custom window orchestration and injection bindings (`injeca`); merge any IO tracing services deliberately into our service layout.

### 📋 Upstream Commits
- `450c5d81dc` feat(api): add provider-cost Flux settlement (#2644) [#2644](https://github.com/moeru-ai/airi/pull/2644) _(RainbowBird, 2026-10-03)_
- `5bd4600455` feat(skills): add symlink to agent skills directory  _(RainbowBird, 2026-10-03)_
- `8e9120891e` fix(stage-layouts): respect mobile voice auto-send settings (#2780) [#2780](https://github.com/moeru-ai/airi/pull/2780) _(RainbowBird, 2026-10-03)_
- `6f654a7e9b` fix(stage-tamagotchi): improve provider setup recovery (#2144) [#2144](https://github.com/moeru-ai/airi/pull/2144) _(RainbowBird, 2026-10-03)_
- `a2ce9f4088` chore(ci): require Unit Test before merging (#2777) [#2777](https://github.com/moeru-ai/airi/pull/2777) _(Columbina, 2026-10-03)_
- `24e977551e` feat(stage-ui): store wake words with character cards (#2768) [#2768](https://github.com/moeru-ai/airi/pull/2768) _(Neko, 2026-10-03)_
- `1d9c601fa3` fix(stage-pages): hide unavailable providers from v2 catalog (#2575) [#2575](https://github.com/moeru-ai/airi/pull/2575) _(Bruce-Yii, 2026-10-03)_
- `5f44f6f67a` fix(stage-layouts): keep the stop action available between speech segments (#2741) [#2741](https://github.com/moeru-ai/airi/pull/2741) _(yi111, 2026-10-03)_
- `1cb0fb0fdf` perf(stage-ui-three): cache the screen bounding box instead of forcing layout per read (#2608) [#2608](https://github.com/moeru-ai/airi/pull/2608) _(Penluna, 2026-10-03)_
- `a734c14239` perf(stage-tamagotchi): remove packaging-only dependencies (#2613) [#2613](https://github.com/moeru-ai/airi/pull/2613) _(Younsang Na, 2026-10-03)_
- `f58aa03a85` fix(core-agent): keep tools after a schema or tool-call error (#2753) [#2753](https://github.com/moeru-ai/airi/pull/2753) _(Yang Bai, 2026-10-02)_
- `7311238610` refactor: generate local identifiers with non-secure nanoid (#2766) [#2766](https://github.com/moeru-ai/airi/pull/2766) _(Neko, 2026-10-03)_
- `a4da7edd73` refactor(stage-tamagotchi): persist local IO traces (#2774) [#2774](https://github.com/moeru-ai/airi/pull/2774) _(RainbowBird, 2026-10-03)_
- `146c04294c` test(pipelines-audio): assert current playback manager scheduling (#2775) [#2775](https://github.com/moeru-ai/airi/pull/2775) _(Neko, 2026-10-03)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 4 file(s) (+93/-0)
- `.agents/skills/analyze-io-traces/SKILL.md` *(+45/-0)*
- `.github/CONTRIBUTING.md` *(+18/-0)*
- `.github/rulesets/require-unit-test.json` *(+29/-0)*
- `AGENTS.md` *(+1/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 18 file(s) (+342/-47)
- `.claude/skills` *(+1/-0)*
- `packages/pipelines-audio/src/managers/playback-manager.test.ts` *(+45/-38)*
- `packages/stage-shared/src/types/io-trace.ts` *(+8/-0)*
- `packages/stage-ui-mmd/src/stores/mmd.ts` *(+2/-1)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-images.ts` *(+2/-1)*
- `packages/stage-ui/src/composables/use-io-tracer.browser.test.ts` *(+20/-0)*
- `packages/stage-ui/src/composables/use-io-tracer.ts` *(+9/-1)*
- `packages/stage-ui/src/libs/voice/wake-words.test.ts` *(+24/-0)*
- `packages/stage-ui/src/libs/voice/wake-words.ts` *(+67/-0)*
- `packages/stage-ui/src/services/airi-card-import-export.test.ts` *(+12/-0)*
- `packages/stage-ui/src/services/airi-card-import-export.ts` *(+2/-0)*
- `packages/stage-ui/src/stores/ai/chat-llm/llm.test.ts` *(+53/-5)*
- `packages/stage-ui/src/stores/mods/api/context-bridge.contract.browser.test.ts` *(+33/-0)*
- `packages/stage-ui/src/stores/mods/api/context-bridge.ts` *(+15/-1)*
- `packages/stage-ui/src/stores/modules/airi-card.ts` *(+3/-0)*
- `packages/stage-ui/src/stores/modules/consciousness.ts` *(+6/-0)*
- `packages/stage-ui/src/stores/wake-words.ts` *(+37/-0)*
- `packages/stage-ui/src/types/airiCard.ts` *(+3/-0)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 3 file(s) (+25/-5)
- `apps/stage-pocket/src/modules/websocket-bridge.ts` *(+3/-1)*
- `apps/stage-pocket/src/pages/index.vue` *(+11/-2)*
- `apps/stage-web/src/pages/index.vue` *(+11/-2)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 21 file(s) (+446/-15)
- `apps/stage-tamagotchi-kirie/package.json` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/InteractiveArea.vue` *(+2/-1)*
- `apps/stage-tamagotchi/electron-builder.config.ts` *(+14/-0)*
- `apps/stage-tamagotchi/package.json` *(+1/-0)*
- `apps/stage-tamagotchi/src/main/configs/io-trace-recording.ts` *(+12/-0)*
- `apps/stage-tamagotchi/src/main/index.ts` *(+40/-6)*
- `apps/stage-tamagotchi/src/main/services/airi/io-trace-recording/index.test.ts` *(+84/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/io-trace-recording/index.ts` *(+100/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/io-trace-recording/register.ts` *(+28/-0)*
- `apps/stage-tamagotchi/src/main/windows/chat/index.ts` *(+3/-0)*
- `apps/stage-tamagotchi/src/main/windows/chat/rpc/index.electron.ts` *(+4/-1)*
- `apps/stage-tamagotchi/src/main/windows/main/index.ts` *(+3/-0)*
- `apps/stage-tamagotchi/src/main/windows/main/rpc/index.electron.ts` *(+5/-0)*
- `apps/stage-tamagotchi/src/main/windows/settings/index.ts` *(+3/-0)*
- `apps/stage-tamagotchi/src/main/windows/settings/rpc/index.electron.ts` *(+5/-0)*
- `apps/stage-tamagotchi/src/renderer/App.vue` *(+5/-0)*
- `apps/stage-tamagotchi/src/renderer/bridges/io-trace-recording.ts` *(+37/-0)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+25/-1)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+29/-3)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/system/developer.vue` *(+39/-3)*
- `apps/stage-tamagotchi/src/shared/eventa/index.ts` *(+6/-0)*

#### Core Agent Runtime (`🔍 inspect`) — 1 file(s) (+2/-3)
- `packages/core-agent/src/runtime/llm-service.ts` *(+2/-3)*

#### Localization (i18n) (`📦 import (additive only)`) — 4 file(s) (+15/-0)
- `packages/i18n/src/locales/en/stage.yaml` *(+4/-0)*
- `packages/i18n/src/locales/en/tamagotchi/settings.yaml` *(+3/-0)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+4/-0)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/settings.yaml` *(+4/-0)*

#### Stage Layouts & Shells (`🔍 inspect`) — 5 file(s) (+188/-25)
- `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` *(+2/-1)*
- `packages/stage-layouts/src/composables/use-chat-interruption.test.ts` *(+135/-16)*
- `packages/stage-layouts/src/composables/use-chat-interruption.ts` *(+16/-2)*
- `packages/stage-layouts/src/composables/use-transcriptions.test.ts` *(+26/-0)*
- `packages/stage-layouts/src/composables/use-transcriptions.ts` *(+9/-6)*

#### UI Primitives & Pages (`📦 import / inspect`) — 2 file(s) (+91/-4)
- `packages/stage-pages/src/pages/v2/settings/providers.browser.test.ts` *(+78/-0)*
- `packages/stage-pages/src/pages/v2/settings/providers.vue` *(+13/-4)*

#### Root Build & Tooling (`🔍 inspect`) — 2 file(s) (+34/-0)
- `packages/stage-ui-mmd/package.json` *(+1/-0)*
- `pnpm-lock.yaml` *(+33/-0)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 1 file(s) (+19/-2)
- `packages/stage-ui-three/src/components/ThreeScene.vue` *(+19/-2)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 2 file(s) (+5/-3)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+3/-1)*
- `packages/stage-ui/src/stores/chat.ts` *(+2/-2)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 27 file(s) (+5562/-217)
- `server/apps/api/README.md` *(+42/-4)*
- `server/apps/api/drizzle/0027_llm_cost_settlement.sql` *(+27/-0)*
- `server/apps/api/drizzle/meta/0027_snapshot.json` *(+3937/-0)*
- `server/apps/api/drizzle/meta/_journal.json` *(+7/-0)*
- `server/apps/api/src/routes/openai/v1/index.ts` *(+2/-2)*
- `server/apps/api/src/routes/openai/v1/middlewares/billing.ts` *(+45/-33)*
- `server/apps/api/src/routes/openai/v1/model-routing.ts` *(+9/-1)*
- `server/apps/api/src/routes/openai/v1/operations/chat-completions/index.ts` *(+52/-13)*
- `server/apps/api/src/routes/openai/v1/operations/responses/index.ts` *(+29/-2)*
- `server/apps/api/src/routes/openai/v1/route.test.ts` *(+465/-72)*
- `server/apps/api/src/schemas/flux-transaction.ts` *(+4/-0)*
- `server/apps/api/src/schemas/index.ts` *(+1/-0)*
- `server/apps/api/src/schemas/llm-request-settlement.ts` *(+28/-0)*
- `server/apps/api/src/services/adapters/config-kv/contracts.test.ts` *(+3/-3)*
- `server/apps/api/src/services/adapters/config-kv/definitions.ts` *(+4/-3)*
- `server/apps/api/src/services/adapters/config-kv/index.test.ts` *(+26/-13)*
- `server/apps/api/src/services/adapters/config-kv/store.test.ts` *(+13/-13)*
- `server/apps/api/src/services/adapters/llm/cost.test.ts` *(+31/-0)*
- `server/apps/api/src/services/adapters/llm/cost.ts` *(+35/-0)*
- `server/apps/api/src/services/domain/billing/billing-service.ts` *(+233/-0)*
- `server/apps/api/src/services/domain/billing/billing.ts` *(+70/-6)*
- `server/apps/api/src/services/domain/billing/tests/billing-service.test.ts` *(+274/-0)*
- `server/apps/api/src/services/domain/billing/tests/billing.test.ts` *(+38/-52)*
- `server/apps/api/src/services/domain/llm-router/router.ts` *(+20/-0)*
- `server/apps/api/src/services/domain/llm-router/tests/router.test.ts` *(+35/-0)*
- `server/apps/api/src/services/domain/llm-router/types.ts` *(+2/-0)*
- `server/docs/ai/adr/2026-09-23-provider-cost-billing.md` *(+130/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (64)
- [#2782](https://github.com/moeru-ai/airi/pull/2782) `fix(stage-tamagotchi): follow cursor on native Wayland` by **@lorenzozanee** *(1 comments)*
- [#2771](https://github.com/moeru-ai/airi/pull/2771) `feat(core-agent): run chat sessions concurrently with storage receipts` by **@nekomeowww** *(2 comments)*
- [#2780](https://github.com/moeru-ai/airi/pull/2780) `fix(stage-layouts): respect mobile voice auto-send settings` by **@luoling8192** *(2 comments)*
- [#2144](https://github.com/moeru-ai/airi/pull/2144) `fix(stage-tamagotchi): improve provider setup recovery` by **@luoling8192** *(8 comments)*
- [#2369](https://github.com/moeru-ai/airi/pull/2369) `fix(pipelines-audio): preserve grapheme clusters in TTS chunks` by **@mameikagou** *(5 comments)*
- [#2129](https://github.com/moeru-ai/airi/pull/2129) `fix(stage-pages): fall back to volume speech detection for hearing STT` by **@DinonowDev** *(16 comments)*
- [#2777](https://github.com/moeru-ai/airi/pull/2777) `chore(ci): require Unit Test before merging` by **@0xSelenicDove** *(2 comments)*
- [#1865](https://github.com/moeru-ai/airi/pull/1865) `chore(stage-tamagotchi-godot): use stable path for main scene` by **@shinohara-rin** *(1 comments)*
- [#1371](https://github.com/moeru-ai/airi/pull/1371) `feat(minecraft,stage-*): airi integration, isolated-vm plus misc updates` by **@shinohara-rin** *(33 comments)*
- [#2773](https://github.com/moeru-ai/airi/pull/2773) `feat(stage-tamagotchi): show voice drafts in a composer-style inlay` by **@nekomeowww** *(1 comments)*
- [#2772](https://github.com/moeru-ai/airi/pull/2772) `refactor(stage-ui): move voice features onto the shared voice pipeline` by **@nekomeowww** *(1 comments)*
- [#2776](https://github.com/moeru-ai/airi/pull/2776) `fix(stage-tamagotchi): isolate configuration writes across host lifecycles` by **@0xSelenicDove** *(3 comments)*
- [#2768](https://github.com/moeru-ai/airi/pull/2768) `feat(stage-ui): store wake words with character cards` by **@nekomeowww** *(2 comments)*
- [#2763](https://github.com/moeru-ai/airi/pull/2763) `refactor(chat): allow concurrent sends across sessions` by **@lulu0119** *(2 comments)*
- [#1958](https://github.com/moeru-ai/airi/pull/1958) `fix(stage-ui): persist manual speech voice selection for catalog-free…` by **@wsVIC** *(4 comments)*
- [#1569](https://github.com/moeru-ai/airi/pull/1569) `feat(hearing): comprehensive VAD decoupling, i18n, and UI refactor` by **@Iris0fTheValley** *(52 comments)*
- [#1946](https://github.com/moeru-ai/airi/pull/1946) `refactor(stage-ui): rework inference IPC, add in-browser RWKV LLM + whisper-local providers` by **@sebastian-zm** *(Draft)* *(5 comments)*
- [#111](https://github.com/moeru-ai/airi/pull/111) `refactor(airi-card): dialog` by **@luoling8192** *(2 comments)*
- [#226](https://github.com/moeru-ai/airi/pull/226) `refactor: use `@moeru/std`` by **@kwaa** *(2 comments)*
- [#11](https://github.com/moeru-ai/airi/pull/11) `refactor: have `stage-ui` dedicated` by **@nekomeowww** *(1 comments)*
- [#239](https://github.com/moeru-ai/airi/pull/239) `refactor: dynamic import `@tauri-apps/plugin-os`` by **@luoling8192** *(14 comments)*
- [#236](https://github.com/moeru-ai/airi/pull/236) `chore: replace println! to info!` by **@luoling8192** *(6 comments)*
- [#217](https://github.com/moeru-ai/airi/pull/217) `perf(ui-transitions): buildless` by **@kwaa** *(2 comments)*
- [#216](https://github.com/moeru-ai/airi/pull/216) `perf(ui-loading-screens): buildless` by **@kwaa** *(2 comments)*
- [#2147](https://github.com/moeru-ai/airi/pull/2147) `chore(stage-ui-tachie): kebab case` by **@kwaa** *(1 comments)*
- [#301](https://github.com/moeru-ai/airi/pull/301) `chore: use AVIF instead of PNG/JPG as more as possible` by **@typed-sigterm** *(10 comments)*
- [#2172](https://github.com/moeru-ai/airi/pull/2172) `perf(stage-ui-tachie): use fflate instead of jszip` by **@kwaa** *(6 comments)*
- [#417](https://github.com/moeru-ai/airi/pull/417) `chore: convert images to AVIF` by **@typed-sigterm** *(6 comments)*
- [#527](https://github.com/moeru-ai/airi/pull/527) `Disqort` by **@Disqort** *(16 comments)*
- [#28](https://github.com/moeru-ai/airi/pull/28) `Try to add dependency&relationship graph for "Sub-projects born from this project" ` by **@DWCarrot** *(4 comments)*
- [#16](https://github.com/moeru-ai/airi/pull/16) `refactor(header): add github link` by **@kwaa** *(1 comments)*
- [#918](https://github.com/moeru-ai/airi/pull/918) `ignore me` by **@shinohara-rin** *(3 comments)*
- [#634](https://github.com/moeru-ai/airi/pull/634) `refactor: start websocket server by server-runtime` by **@Slinetrac** *(7 comments)*
- [#528](https://github.com/moeru-ai/airi/pull/528) `typo corrected` by **@ChenyangLi4288** *(5 comments)*
- [#105](https://github.com/moeru-ai/airi/pull/105) `refactor: airi card` by **@luoling8192** *(2 comments)*
- [#1598](https://github.com/moeru-ai/airi/pull/1598) `perf(vishot): compress and downscale AVIF screenshots` by **@Neko-233** *(2 comments)*
- [#1075](https://github.com/moeru-ai/airi/pull/1075) `chore: align Novita default OpenAI-compatible endpoint` by **@Alex-yang00** *(Draft)* *(1 comments)*
- [#1044](https://github.com/moeru-ai/airi/pull/1044) `Dev` by **@ifloveisture** *(21 comments)*
- [#547](https://github.com/moeru-ai/airi/pull/547) `Приколы` by **@itzfox1** *(14 comments)*
- [#261](https://github.com/moeru-ai/airi/pull/261) `chore(gemini): [do not merge] test gemini suggestions` by **@sumimakito** *(Draft)* *(7 comments)*
- [#235](https://github.com/moeru-ai/airi/pull/235) `chore: update rust fmt rules` by **@luoling8192** *(9 comments)*
- [#1701](https://github.com/moeru-ai/airi/pull/1701) `拉取同步` by **@Therainclouds** *(5 comments)*
- [#1660](https://github.com/moeru-ai/airi/pull/1660) `refactor(inference): replace custom AsyncMutex with async-mutex package` by **@NJX-njx** *(13 comments)*
- [#1204](https://github.com/moeru-ai/airi/pull/1204) `Revert "fix(stage-*): can’t get mcp servers when use remote api"` by **@nekomeowww** *(2 comments)*
- [#1197](https://github.com/moeru-ai/airi/pull/1197) `Enhance main page interactivity with click-through areas` by **@fordelkon** *(4 comments)*
- [#548](https://github.com/moeru-ai/airi/pull/548) `Приколы` by **@itzfox1** *(10 comments)*
- [#411](https://github.com/moeru-ai/airi/pull/411) `Remove single-line comments from codebase` by **@Ksirailway-base** *(14 comments)*
- [#379](https://github.com/moeru-ai/airi/pull/379) `This is a test` by **@Carokyp** *(7 comments)*
- [#356](https://github.com/moeru-ai/airi/pull/356) `chore: remove tool version` by **@luoling8192** *(6 comments)*
- [#1776](https://github.com/moeru-ai/airi/pull/1776) `更新支持0.10.1版本的说明书` by **@JhIcefair** *(15 comments)*
- [#1310](https://github.com/moeru-ai/airi/pull/1310) `[DO NOT MERGE] Serverlize` by **@luoling8192** *(7 comments)*
- [#1252](https://github.com/moeru-ai/airi/pull/1252) `chore: update pnpm version to 10.32.1` by **@Garfield550** *(8 comments)*
- [#460](https://github.com/moeru-ai/airi/pull/460) `Russian language` by **@xn80a32** *(5 comments)*
- [#459](https://github.com/moeru-ai/airi/pull/459) `optimize WebSocket handling in packages/server-runtime/src/index.ts` by **@Iro96** *(6 comments)*
- [#412](https://github.com/moeru-ai/airi/pull/412) `Adding voice interaction for both input and output text.` by **@Ksirailway-base** *(12 comments)*
- [#1902](https://github.com/moeru-ai/airi/pull/1902) `ㅤ` by **@vi70x3** *(3 comments)*
- [#1894](https://github.com/moeru-ai/airi/pull/1894) `refactor(server): simplify additional trusted origin env to a single string` by **@lulu0119** *(12 comments)*
- [#1789](https://github.com/moeru-ai/airi/pull/1789) `revert(server): remove .well-known/assetlinks.json (revert #1772)` by **@hahaQWQ** *(0 comments)*
- [#1374](https://github.com/moeru-ai/airi/pull/1374) `[DO NOT MERGE] SERVER` by **@Neko-233** *(9 comments)*
- [#563](https://github.com/moeru-ai/airi/pull/563) `refactor: replace `useLogg` with `useLogger`` by **@luoling8192** *(4 comments)*
- [#518](https://github.com/moeru-ai/airi/pull/518) `Vietnamese` by **@Iro96** *(4 comments)*
- [#1990](https://github.com/moeru-ai/airi/pull/1990) `refactor(audio-pipelines-transcribe): use `@proj-airi/audio`` by **@nekomeowww** *(3 comments)*
- [#1849](https://github.com/moeru-ai/airi/pull/1849) `chore: update sponsors svg` by **@nekomeowww** *(3 comments)*
- [#1792](https://github.com/moeru-ai/airi/pull/1792) `refactor(server): drop redis stream + worker role` by **@luoling8192** *(9 comments)*

#### 🔄 PR Status & Lifecycle Changes (7)
- [#2750](https://github.com/moeru-ai/airi/pull/2750) `fix(minecraft): explain AIRI authentication failures` — `Draft` ➔ `Ready`
- [#2644](https://github.com/moeru-ai/airi/pull/2644) `feat(api): add provider-cost Flux settlement` — `OPEN` ➔ `MERGED`
- [#2524](https://github.com/moeru-ai/airi/pull/2524) `feat(provider-inference): refresh Volcengine coding-plan models from endpoint` — `OPEN` ➔ `CLOSED`
- [#2575](https://github.com/moeru-ai/airi/pull/2575) `fix(stage-pages): hide unavailable providers from v2 catalog` — `OPEN` ➔ `MERGED`
- [#2741](https://github.com/moeru-ai/airi/pull/2741) `fix(stage-layouts): keep the stop action available between speech segments` — `OPEN` ➔ `MERGED`
- [#2608](https://github.com/moeru-ai/airi/pull/2608) `perf(stage-ui-three): cache the screen bounding box instead of forcing layout per read` — `OPEN` ➔ `MERGED`
- [#2613](https://github.com/moeru-ai/airi/pull/2613) `perf(stage-tamagotchi): remove packaging-only dependencies` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (29)
- [#2750](https://github.com/moeru-ai/airi/pull/2750) `fix(minecraft): explain AIRI authentication failures` — *+1 comments (0 ➔ 1 total)*
- [#2644](https://github.com/moeru-ai/airi/pull/2644) `feat(api): add provider-cost Flux settlement` — *+1 comments (39 ➔ 40 total)*
- [#2762](https://github.com/moeru-ai/airi/pull/2762) `feat(ui): add shared dropdown menu` — *+1 comments (2 ➔ 3 total)*
- [#2414](https://github.com/moeru-ai/airi/pull/2414) `fix(pipelines-audio): preserve multi-code-unit grapheme clusters in TTS chunking` — *+1 comments (10 ➔ 11 total)*
- [#2397](https://github.com/moeru-ai/airi/pull/2397) `fix(stage-ui): open Save as New Profile form` — *+3 comments (7 ➔ 10 total)*
- [#2526](https://github.com/moeru-ai/airi/pull/2526) `feat(provider-inference): add API Route provider` — *+1 comments (3 ➔ 4 total)*
- [#2459](https://github.com/moeru-ai/airi/pull/2459) `fix(core-agent): prevent plain-text tool call leaks` — *+1 comments (41 ➔ 42 total)*
- [#2714](https://github.com/moeru-ai/airi/pull/2714) `feat(chat): add opt-in local reaction stickers` — *+2 comments (0 ➔ 2 total)*
- [#2519](https://github.com/moeru-ai/airi/pull/2519) `test(stage-tamagotchi): verify linux window rendering in CI` — *+1 comments (20 ➔ 21 total)*
- [#2541](https://github.com/moeru-ai/airi/pull/2541) `Telltworose/feat/drop in plugins` — *+1 comments (58 ➔ 59 total)*
- [#2252](https://github.com/moeru-ai/airi/pull/2252) `docs(ui): add entrance animations and optimize performance across UI components` — *+1 comments (11 ➔ 12 total)*
- [#2667](https://github.com/moeru-ai/airi/pull/2667) `fix(stage-tamagotchi): isolate Eventa IPC contexts by window` — *+1 comments (3 ➔ 4 total)*
- [#2512](https://github.com/moeru-ai/airi/pull/2512) `fix: fix security issue in artistry.ts` — *+1 comments (3 ➔ 4 total)*
- [#2473](https://github.com/moeru-ai/airi/pull/2473) `feat(auth): add native email change flow` — *+1 comments (11 ➔ 12 total)*
- [#2435](https://github.com/moeru-ai/airi/pull/2435) `feat(stage-ui): add local FunASR transcription provider` — *+1 comments (196 ➔ 197 total)*
- [#2703](https://github.com/moeru-ai/airi/pull/2703) `fix(stage-pages): add the MiniMax Speech settings page` — *+4 comments (1 ➔ 5 total)*
- [#2718](https://github.com/moeru-ai/airi/pull/2718) `feat(provider-inference): add the MiniMax speech-to-text provider` — *+2 comments (1 ➔ 3 total)*
- [#2203](https://github.com/moeru-ai/airi/pull/2203) `fix(desktop): restore off-screen main window` — *+4 comments (54 ➔ 58 total)*
- [#2286](https://github.com/moeru-ai/airi/pull/2286) `fix(stage-ui): cancel animation frames and remove drag listeners on unmount` — *+1 comments (9 ➔ 10 total)*
- [#2590](https://github.com/moeru-ai/airi/pull/2590) `feat(provider): add display names for v2 Provider connections` — *+1 comments (1 ➔ 2 total)*
- [#2735](https://github.com/moeru-ai/airi/pull/2735) `fix(stage-ui): constrain chat bubbles with wide code blocks` — *+1 comments (2 ➔ 3 total)*
- [#2692](https://github.com/moeru-ai/airi/pull/2692) `fix(api-server): sync chat message deletions across devices` — *+1 comments (1 ➔ 2 total)*
- [#2250](https://github.com/moeru-ai/airi/pull/2250) `fix(discord): show live bot connection status` — *+4 comments (13 ➔ 17 total)*
- [#2591](https://github.com/moeru-ai/airi/pull/2591) `fix(api): allow packaged transcription preflight` — *+2 comments (0 ➔ 2 total)*
- [#2662](https://github.com/moeru-ai/airi/pull/2662) `feat(i18n): add Indonesian language support` — *+1 comments (3 ➔ 4 total)*
- [#2575](https://github.com/moeru-ai/airi/pull/2575) `fix(stage-pages): hide unavailable providers from v2 catalog` — *+1 comments (0 ➔ 1 total)*
- [#2741](https://github.com/moeru-ai/airi/pull/2741) `fix(stage-layouts): keep the stop action available between speech segments` — *+7 comments (2 ➔ 9 total)*
- [#2608](https://github.com/moeru-ai/airi/pull/2608) `perf(stage-ui-three): cache the screen bounding box instead of forcing layout per read` — *+1 comments (1 ➔ 2 total)*
- [#2613](https://github.com/moeru-ai/airi/pull/2613) `perf(stage-tamagotchi): remove packaging-only dependencies` — *+1 comments (4 ➔ 5 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(1 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` [Draft] — *(48 comments)*
  - *Focus*: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard

---
## [2026-10-02] Upstream Delta: `4b702bd6..33870846` (12 commits, 353 files, 43 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 12 commits (`33870846ad`..`671fbf0d33`) across 353 files, alongside 43 PR updates (17 new PRs, 9 lifecycle transitions, 17 discussion activity changes). Key developments include:
  1. **Godot / Kirie Desktop Host Migration (PR #2739 / `671fbf0d33`)**: Merged the massive experimental `apps/stage-tamagotchi-kirie` (+31k LOC across 299 files), establishing a Godot 4.7.2 + .NET 10 + CEF host for the Vue renderer with its own migration roadmap and test harness.
  2. **Provider Resilience & Transient Retry (PR #2724 / `33870846ad`)**: Merged automatic backoff retry (`[3s, 6s, 12s]` or `Retry-After`) for transient HTTP errors (408, 429, 5xx) in `core-agent` runtime, with strict guards (`consumerNotified`) preventing duplicate retries once stream tokens or tool calls have fired.
  3. **Accessibility & Toggle Switch Fixes (PR #2740 / `9fdbd16408`)**: Swapped hidden checkboxes for `@proj-airi/ui` `Checkbox` primitive in `check-bar.vue`, fixing keyboard accessibility and flex-shrink label truncation.
  4. **Desktop Tray-Only Mode & Dev Dock Scoping (PR #2700 / `8c9df2276f` & PR #2757 / `865f628b8c`)**: Added an optional tray-only mode (`app.dock.hide()` / `skipTaskbar: true`) to Stage Tamagotchi, and restricted Electron dev dock icon overrides to development runs only.
  5. **New Upstream PR Initiatives**: Streamed voice transcript inlays with LLM rewriting (PR #2761 by @nekomeowww) and shared dropdown UI primitive (PR #2762 by @chiba233).
* **Discussion & Community Buzz**:
  - 💬 **#2541: `Telltworose/feat/drop in plugins` (+2 new comments, total 58)**: Continued high-volume debate surrounding drop-in plugin architecture.
  - 💬 **#1889: `feat(chat): add stop button to cancel in-flight assistant generation` (49 comments)**: High interest and activity around canceling in-flight LLM assistant generations.
  - 💬 **#2672: `refactor(stage-ui): bind conversations to window-local characters` (48 comments)**: Heavy architectural discussion around window-local character selection and conversation scoping.
  - 💬 **#2644: `feat(api): add provider-cost Flux settlement` (+2 new comments, total 39)**: Active engagement on hosted API billing and settlement mechanics.
  - 💬 **#2717: `feat(debug-server): persist and query local OTLP traces` (+4 new comments, total 27)**: Sustained traction on DuckDB-backed local OpenTelemetry trace storage.
  - 💬 **#2250: `fix(discord): show live bot connection status` (13 comments)**: Community discussion around live Discord bot status indicators.
  - 💬 **#2473: `feat(auth): add native email change flow` (+2 new comments, total 11)** & **#2552: `feat(stage) add bilingual subtitles` (+1 new comment, total 11)**.
  - 💬 **#2748: `feat: add the cognitive runtime` (+3 new comments, total 5)**: Early momentum on new cognitive runtime proposal by @chiba233.
  - 👁️ **Watched PRs Radar**:
    - **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI’s brain`** [Draft] (1 comment): Quiet; no maintainer endorsement for the external daemon approach.
    - **#2672: `refactor(stage-ui): bind conversations to window-local characters`** [Draft] (48 comments): Maintained high discussion velocity regarding window decoupling.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2740 / Commit `9fdbd16408`: `fix(stage-ui): clarify animation toggle states` by @Codada**: Clean UI bugfix for `check-bar.vue`. Replaces invisible checkbox input with `@proj-airi/ui` `Checkbox`, adds proper keyboard toggle and label flex protection, and includes Vitest browser unit tests.
  - ⭐ **PR #2700 / Commit `8c9df2276f`: `feat(stage-tamagotchi): add tray-only app icon setting` by @RainbowBird**: Useful desktop UX option allowing Stage Tamagotchi to run exclusively in the system tray without occupying dock/taskbar space.
  - ⭐ **PR #2757 / Commit `865f628b8c`: `fix(stage-tamagotchi): set the dock icon only in dev runs` by @nekomeowww**: Ensures packaged release dock icons are not overwritten by dev asset overrides.
  - 💡 **Design Pattern Port: Provider Transient Retry from PR #2724 (`33870846ad`)**: Port the `streamWithTransientRetry` logic (`transientRetryDelayMs`, exponential backoff `[3s, 6s, 12s]`, and `consumerNotified` safeguard) into `packages/stage-ui/src/stores/ai/chat-llm/llm.ts` to make LLM streaming resilient to temporary provider outages.
  - 💡 **Design Pattern Port: Zod Nullable Union Flattening from PR #2756 (`8f887ab743`)**: Avoid nested `anyOf` schema rejections from strict LLM providers by using `z.union([...variants, z.null()])` rather than `.nullable()` on unions.
  - 🔍 **PR #2762: `feat(ui): add shared dropdown menu` by @chiba233**: Track for potential adoption once merged to enrich `@proj-airi/ui` primitives.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **PR #2739 / Commit `671fbf0d33` (`apps/stage-tamagotchi-kirie`)**: Massive Godot 4.7.2 + CEF migration workspace that re-introduces deprecated `controls-island`. Our fork relies on decoupled Electron + Control Strip + Unity companion (`apps/stage-mate`).
    - **PR #2733 / Commit `7f750c88d0`**: Hosted cloud authentication and browser redirects for `server/apps/api`.
* **Divergence / Collision Warnings**:
  - ⚠️ **`apps/stage-tamagotchi/src/main/index.ts` & window managers**: Touched by tray-only settings (PR #2700). Must be adapted to our decoupled `ControlStripHost` and `RendererStage` windows rather than upstream’s monolithic stage window.
  - ⚠️ **`apps/stage-tamagotchi-kirie`**: Upstream now maintains a secondary Godot renderer host under `apps/stage-tamagotchi-kirie/src-web`. Never pull or mix components from this tree into our Electron surfaces.
  - ⚠️ **`packages/core-agent`**: Upstream runtime additions in `packages/core-agent` (PR #2724, #2756) cannot be directly cherry-picked since our fork orchestrates LLMs in `packages/stage-ui/src/stores/ai/` and composables.

### 📋 Upstream Commits
- `33870846ad` feat(core-agent): retry temporary provider failures (#2724) [#2724](https://github.com/moeru-ai/airi/pull/2724) _(Muhammad Faiq, 2026-10-02)_
- `be7abc318d` fix(ci): include service workspaces in typecheck (#2416) [#2416](https://github.com/moeru-ai/airi/pull/2416) _(huyua9, 2026-10-02)_
- `9fdbd16408` fix(stage-ui): clarify animation toggle states (#2740) [#2740](https://github.com/moeru-ai/airi/pull/2740) _(Codada, 2026-10-02)_
- `2f59a4c14f` test: include pipelines audio in root vitest projects (#2419) [#2419](https://github.com/moeru-ai/airi/pull/2419) _(huyua9, 2026-10-02)_
- `056ab72642` docs(contributing): align GitHub setup guide with pinned tooling (#2588) [#2588](https://github.com/moeru-ai/airi/pull/2588) _(Codada, 2026-10-02)_
- `1f4009dc33` fix(i18n): format Crowdin exports before publication (#2759) [#2759](https://github.com/moeru-ai/airi/pull/2759) _(Columbina, 2026-10-02)_
- `7f750c88d0` fix(auth): return API and verification browser visits to AIRI (#2733) [#2733](https://github.com/moeru-ai/airi/pull/2733) _(RainbowBird, 2026-10-02)_
- `8f887ab743` fix(core-agent): flatten nullable spark command destinations (#2756) [#2756](https://github.com/moeru-ai/airi/pull/2756) _(Columbina, 2026-10-01)_
- `8c9df2276f` feat(stage-tamagotchi): add tray-only app icon setting (#2700) [#2700](https://github.com/moeru-ai/airi/pull/2700) _(RainbowBird, 2026-10-02)_
- `865f628b8c` fix(stage-tamagotchi): set the dock icon only in dev runs (#2757) [#2757](https://github.com/moeru-ai/airi/pull/2757) _(Neko, 2026-10-02)_
- `74ee76fbe3` chore(nix): update pnpmDeps hash (#2755) [#2755](https://github.com/moeru-ai/airi/pull/2755) _(Weathercold, 2026-10-02)_
- `671fbf0d33` feat(tamagotchi): experimental kirie migration (#2739) [#2739](https://github.com/moeru-ai/airi/pull/2739) _(Doji, 2026-10-02)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 6 file(s) (+80/-100)
- `.agents/skills/stage-tamagotchi-godot-csharp/SKILL.md` *(+16/-13)*
- `.github/CONTRIBUTING.md` *(+56/-86)*
- `.github/workflows/crowdin-cron-sync.yml` *(+4/-0)*
- `.github/workflows/deploy-cloudflare-auth-ui.yml` *(+1/-0)*
- `.github/workflows/deploy-cloudflare-workers-dev-server.yml` *(+1/-0)*
- `apps/ui-server-auth/README.md` *(+2/-1)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 2 file(s) (+20/-26)
- `apps/stage-pocket/src/pages/settings/system/developer.vue` *(+10/-13)*
- `apps/stage-web/src/pages/settings/system/developer.vue` *(+10/-13)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 299 file(s) (+31003/-33)
- `apps/stage-tamagotchi-kirie/.gitignore` *(+17/-0)*
- `apps/stage-tamagotchi-kirie/MIGRATION.md` *(+214/-0)*
- `apps/stage-tamagotchi-kirie/README.md` *(+118/-0)*
- `apps/stage-tamagotchi-kirie/StageTamagotchiKirie.csproj` *(+16/-0)*
- `apps/stage-tamagotchi-kirie/docs/ablation-review.md` *(+154/-0)*
- `apps/stage-tamagotchi-kirie/docs/host-architecture.md` *(+106/-0)*
- `apps/stage-tamagotchi-kirie/docs/verification.md` *(+146/-0)*
- `apps/stage-tamagotchi-kirie/icon.svg` *(+41/-0)*
- `apps/stage-tamagotchi-kirie/icon.svg.import` *(+43/-0)*
- `apps/stage-tamagotchi-kirie/kirie.config.ts` *(+190/-0)*
- `apps/stage-tamagotchi-kirie/mise.toml` *(+5/-0)*
- `apps/stage-tamagotchi-kirie/package.json` *(+185/-0)*
- `apps/stage-tamagotchi-kirie/project.godot` *(+48/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/chat-window.tscn` *(+25/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/developer-window.tscn` *(+26/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/main.tscn` *(+17/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/notice-window.tscn` *(+25/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/onboarding-window.tscn` *(+27/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/AiriDesktopContracts.cs` *(+311/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/AiriDesktopContracts.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/ChatWindow.cs` *(+128/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/ChatWindow.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/ChatWindowManager.cs` *(+96/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/ChatWindowManager.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/DeveloperWindow.cs` *(+155/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/DeveloperWindow.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/Main.cs` *(+193/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/Main.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/NoticeWindow.cs` *(+237/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/NoticeWindow.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/NoticeWindowManager.cs` *(+105/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/NoticeWindowManager.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/OnboardingWindow.cs` *(+175/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/OnboardingWindow.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/OnboardingWindowManager.cs` *(+91/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/OnboardingWindowManager.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/RendererUrl.cs` *(+88/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/RendererUrl.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/SettingsWindow.cs` *(+174/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/SettingsWindow.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/SettingsWindowManager.cs` *(+122/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/SettingsWindowManager.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/SpotlightWindow.cs` *(+205/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/SpotlightWindow.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/assembly-info.cs` *(+3/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/assembly-info.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/auth-service.cs` *(+354/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/auth-service.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/cef-inspector-target.cs` *(+89/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/cef-inspector-target.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/current-display-snapshot-service.cs` *(+42/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/current-display-snapshot-service.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/desktop-window-sizing.cs` *(+138/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/desktop-window-sizing.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/developer-tools-service.cs` *(+182/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/developer-tools-service.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/loopback-auth-server.cs` *(+195/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/loopback-auth-server.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/main.gd.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/microphone-permission-service.cs` *(+433/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/microphone-permission-service.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/native-window-resize-controller.cs` *(+196/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/native-window-resize-controller.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/spotlight-host.cs` *(+260/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/spotlight-host.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/web-view-permission-handler.cs` *(+78/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/scripts/web-view-permission-handler.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/settings-window.tscn` *(+25/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/spotlight-window.tscn` *(+30/-0)*
- `apps/stage-tamagotchi-kirie/src-godot/window-background.tscn` *(+11/-0)*
- `apps/stage-tamagotchi-kirie/src-web/beat-sync.html` *(+32/-0)*
- `apps/stage-tamagotchi-kirie/src-web/index.html` *(+25/-0)*
- `apps/stage-tamagotchi-kirie/src-web/public/assets/vrm/animations/idle_loop.vrma` *(+0/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/App.vue` *(+297/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/assets/videos/tutorial/tutorial-fade-on-hover.dark.mp4` *(+0/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/assets/videos/tutorial/tutorial-fade-on-hover.light.mp4` *(+0/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/beat-sync.html` *(+32/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/beat-sync.main.ts` *(+30/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/bridges/electron-auth-callback.test.ts` *(+71/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/bridges/electron-auth-callback.ts` *(+40/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/bridges/stage-three-runtime-trace.ts` *(+143/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/IconAnimation.vue` *(+84/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/InteractiveArea.browser.test.ts` *(+1047/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/InteractiveArea.vue` *(+467/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/Window/TitleBar.vue` *(+59/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/WindowRouterLink.vue` *(+12/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/WithScreenCapture.vue` *(+134/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/chat-image-attachment-preview.browser.test.ts` *(+32/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/chat-image-attachment-preview.vue` *(+32/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/chat-tool-renderers/journal-tool-call-block.vue` *(+191/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/chat-viewport-layout.browser.test.ts` *(+214/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/chat-viewport-layout.vue` *(+87/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/microphone-permission-prompt.vue` *(+73/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/resource-status-island/index.vue` *(+87/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/resource-status-island/loading-component-detail.vue` *(+3/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/resource-status-island/loading-component.vue` *(+36/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/resource-status-island/loading-modules.vue` *(+76/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/status-island/index.vue` *(+57/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/icon-animation.ts` *(+29/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/model-settings-runtime-owner.ts` *(+90/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/model-settings-runtime-snapshot.ts` *(+98/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/model-settings-runtime.browser.test.ts` *(+171/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/runtime.ts` *(+25/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/use-hearing-input-channel.test.ts` *(+82/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/use-hearing-input-channel.ts` *(+39/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/use-language.test.ts` *(+166/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/use-language.ts` *(+63/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/use-onboarding-authentication.test.ts` *(+87/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/use-onboarding-authentication.ts` *(+63/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/use-restore-scroll.ts` *(+37/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/use-vision-screen-capture.ts` *(+190/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/useCaptionItems.test.ts` *(+81/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/composables/useCaptionItems.ts` *(+133/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/features/live2d/system-audio-lipsync.ts` *(+325/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/app.ts` *(+19/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/auth.test.ts` *(+48/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/auth.ts` *(+37/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/auto-updater.ts` *(+24/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/chat.ts` *(+19/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/desktop-services.test.ts` *(+30/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/desktop-services.ts` *(+5/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/displays.test.ts` *(+55/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/displays.ts` *(+79/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/external-navigation.browser.test.ts` *(+72/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/external-navigation.ts` *(+61/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/global-shortcuts.test.ts` *(+123/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/global-shortcuts.ts` *(+161/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/index.ts` *(+22/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/locale.browser.test.ts` *(+38/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/locale.ts` *(+17/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/media-access.ts` *(+13/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/microphone-permission.test.ts` *(+91/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/microphone-permission.ts` *(+100/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/onboarding.test.ts` *(+37/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/onboarding.ts` *(+33/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/owner.ts` *(+57/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/pointer.ts` *(+176/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/screen-capture.ts` *(+26/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/spotlight.test.ts` *(+210/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/spotlight.ts` *(+152/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/window-actions.test.ts` *(+61/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/window-actions.ts` *(+23/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/window-lifecycle.test.ts` *(+61/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/host-context/window-lifecycle.ts` *(+61/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/index.html` *(+25/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/layouts/default.vue` *(+9/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/layouts/settings.vue` *(+91/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/layouts/stage.vue` *(+7/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/main.ts` *(+100/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/modules/i18n.ts` *(+22/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/about.vue` *(+497/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/caption.vue` *(+154/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/chat-page-shell.vue` *(+13/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/chat.browser.test.ts` *(+37/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/chat.vue` *(+79/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/dashboard/index.vue` *(+5/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/desktop-overlay-coordinates.test.ts` *(+120/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/desktop-overlay-coordinates.ts` *(+80/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/desktop-overlay-polling.test.ts` *(+539/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/desktop-overlay-polling.ts` *(+392/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/desktop-overlay.vue` *(+418/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/devtools/global-shortcut.vue` *(+386/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/devtools/index.vue` *(+13/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/devtools/live2d-motion.vue` *(+49/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/devtools/performance-visualizer.vue` *(+198/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/devtools/screen-capture.vue` *(+386/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/devtools/updater.vue` *(+112/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/devtools/use-electron-all-displays.vue` *(+149/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/devtools/use-electron-relative-mouse.vue` *(+83/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/devtools/use-magic-keys.vue` *(+10/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/devtools/use-window-mouse.vue` *(+22/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/devtools/vision.vue` *(+633/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/devtools/widgets-calling.vue` *(+421/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/editor/index.vue` *(+8/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/index.vue` *(+928/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/inlay/index.vue` *(+88/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/notice/fade-on-hover.vue` *(+256/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/notice/index.vue` *(+12/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/onboarding.vue` *(+73/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/account/index.vue` *(+37/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/connection/index.vue` *(+134/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/connection/server-channel-qr-card.vue` *(+209/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/data/components/desktop-folder-section.vue` *(+41/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/data/components/desktop-reset-section.vue` *(+73/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/data/index.vue` *(+46/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/index.vue` *(+81/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/models/godot-scene-input.ts` *(+37/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/models/godot-view-patch-queue.ts` *(+174/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/models/godot-view-session.ts` *(+43/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/models/index.vue` *(+433/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/modules/components/McpConnectionTestPanel.vue` *(+79/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/modules/components/McpJsonEditor.vue` *(+60/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/modules/components/McpServerForm.vue` *(+75/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/modules/mcp-config.test.ts` *(+115/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/modules/mcp-config.ts` *(+161/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/modules/mcp.vue` *(+527/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/system/developer.vue` *(+205/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/system/general.vue` *(+16/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/system/index.vue` *(+90/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/system/permissions.vue` *(+106/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/settings/system/window-shortcuts.vue` *(+156/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/spotlight.vue` *(+160/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/pages/widgets.vue` *(+322/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/public/assets/vrm/animations/idle_loop.vrma` *(+0/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/controls-island.ts` *(+23/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/resources.ts` *(+166/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/settings/server-channel.test.ts` *(+139/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/settings/server-channel.ts` *(+87/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/stage-three-runtime-diagnostics.test.ts` *(+90/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/stage-three-runtime-diagnostics.ts` *(+491/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/stage-window-lifecycle.test.ts` *(+69/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/stage-window-lifecycle.ts` *(+57/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/built-in.test.ts` *(+51/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/built-in.ts` *(+52/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/builtin/image-journal.test.ts` *(+65/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/builtin/image-journal.ts` *(+238/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/builtin/weather-api.ts` *(+146/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/builtin/weather.test.ts` *(+101/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/builtin/weather.ts` *(+41/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/builtin/widgets.test.ts` *(+612/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/builtin/widgets.ts` *(+321/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/index.ts` *(+7/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/mcp.test.ts` *(+97/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/mcp.ts` *(+48/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/plugins.test.ts` *(+140/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/plugins.ts` *(+79/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/testing/strict-tool-schema.test.ts` *(+73/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/stores/tools/testing/strict-tool-schema.ts` *(+144/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/styles/main.css` *(+58/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/styles/transitions.css` *(+18/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/utils/create-object-url-from-bytes.ts` *(+17/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/utils/fade-on-hover.test.ts` *(+41/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/utils/fade-on-hover.ts` *(+28/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/utils/stage-three-transparency.ts` *(+15/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/utils/voice-input-lifecycle.test.ts` *(+85/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/utils/voice-input-lifecycle.ts` *(+85/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/utils/voice-input-suppression.test.ts` *(+44/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/utils/voice-input-suppression.ts` *(+42/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/utils/windows.ts` *(+5/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/artistry/components/Comfy.vue` *(+355/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/artistry/index.ts` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/extension-ui/components/extension-ui-host.vue` *(+259/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/extension-ui/components/iframe-request.test.ts` *(+176/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/extension-ui/components/iframe-request.ts` *(+122/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/extension-ui/components/index.ts` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/extension-ui/composables/use-bridge-spark.test.ts` *(+208/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/extension-ui/composables/use-bridge-spark.ts` *(+134/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/extension-ui/composables/use-extension-ui-for-module.ts` *(+166/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/extension-ui/composables/use-iframe-message-port.test.ts` *(+42/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/extension-ui/composables/use-iframe-message-port.ts` *(+199/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/extension-ui/host.ts` *(+47/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/extension-ui/index.ts` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/extension-ui/shared/eventa-runtime.test.ts` *(+169/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/map/components/Map.vue` *(+306/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/map/index.ts` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/weather/assets/README.md` *(+10/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/weather/assets/clear-day.svg` *(+13/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/weather/assets/clear-day.svg.import` *(+43/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/weather/components/Skeleton.vue` *(+75/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/weather/components/Weather.vue` *(+288/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/widgets/weather/index.ts` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/window-context.test.ts` *(+44/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/window-context.ts` *(+57/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/auth-config.ts` *(+9/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/desktop-overlay-heartbeat.ts` *(+5/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/desktop-overlay-live-window-smoke.test.ts` *(+53/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/desktop-overlay-live-window-smoke.ts` *(+24/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/eventa/index.ts` *(+551/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/eventa/plugin/assets.ts` *(+3/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/eventa/plugin/capabilities.ts` *(+45/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/eventa/plugin/domains.test.ts` *(+115/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/eventa/plugin/host.ts` *(+195/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/eventa/plugin/tools.ts` *(+107/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/eventa/widgets-gamelet-request.test.ts` *(+13/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/mcp-config.ts` *(+124/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/model-settings-runtime.ts` *(+42/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/spotlight-shortcut.ts` *(+7/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/utils/electron/display.ts` *(+42/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/shared/utils/electron/windows/window-size.ts` *(+52/-0)*
- `apps/stage-tamagotchi-kirie/src-web/tsconfig.json` *(+67/-0)*
- `apps/stage-tamagotchi-kirie/tests/StageTamagotchiKirie.Tests/Program.cs` *(+410/-0)*
- `apps/stage-tamagotchi-kirie/tests/StageTamagotchiKirie.Tests/Program.cs.uid` *(+1/-0)*
- `apps/stage-tamagotchi-kirie/tests/StageTamagotchiKirie.Tests/StageTamagotchiKirie.Tests.csproj` *(+23/-0)*
- `apps/stage-tamagotchi-kirie/uno.config.ts` *(+22/-0)*
- `apps/stage-tamagotchi-kirie/vitest.config.ts` *(+37/-0)*
- `apps/stage-tamagotchi/resources/icon-dev.png` *(+0/-0)*
- `apps/stage-tamagotchi/src/main/configs/global.ts` *(+2/-1)*
- `apps/stage-tamagotchi/src/main/index.ts` *(+7/-4)*
- `apps/stage-tamagotchi/src/main/tray/index.ts` *(+16/-1)*
- `apps/stage-tamagotchi/src/main/windows/caption/index.ts` *(+2/-1)*
- `apps/stage-tamagotchi/src/main/windows/chat/floating.ts` *(+2/-1)*
- `apps/stage-tamagotchi/src/main/windows/shared/app-icon.test.ts` *(+101/-0)*
- `apps/stage-tamagotchi/src/main/windows/shared/app-icon.ts` *(+75/-0)*
- `apps/stage-tamagotchi/src/main/windows/spotlight/index.ts` *(+2/-0)*
- `apps/stage-tamagotchi/src/main/windows/widgets/index.ts` *(+2/-1)*
- `apps/stage-tamagotchi/src/main/windows/widgets/lifecycle.test.ts` *(+2/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/system/developer.vue` *(+15/-23)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/system/general.vue` *(+45/-1)*
- `apps/stage-tamagotchi/src/shared/eventa/index.ts` *(+2/-0)*

#### Deprecated Surfaces (Control Island) (`⚪ ignore / rejected in fork (decoupled into Control Strip)`) — 17 file(s) (+2509/-8)
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/control-button-tooltip.vue` *(+78/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/control-button.vue` *(+17/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/controls-island-auth-button.test.ts` *(+115/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/controls-island-auth-button.vue` *(+181/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/controls-island-fade-on-hover.vue` *(+86/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/controls-island-hearing-config.vue` *(+64/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/controls-island-overflow.browser.test.ts` *(+598/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/controls-island-profile-picker.vue` *(+39/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/controls-island-root.test.ts` *(+261/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/controls-island-root.vue` *(+135/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/controls-island-stop-speaking.test.ts` *(+90/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/controls-island-stop-speaking.vue` *(+44/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/index.vue` *(+532/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/indicator-mic-volume.vue` *(+81/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/use-controls-island-layout.ts` *(+89/-0)*
- `apps/stage-tamagotchi-kirie/src-web/src/renderer/components/stage-islands/controls-island/use-controls-island-placement.ts` *(+99/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-hearing-config.vue` *(+0/-8)*

#### Other / Uncategorized (`🔍 inspect`) — 14 file(s) (+309/-88)
- `apps/ui-server-auth/src/pages/verify-email.vue` *(+2/-4)*
- `apps/ui-server-auth/vite-env.d.ts` *(+1/-0)*
- `apps/ui-server-auth/vite.config.ts` *(+9/-2)*
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/stage-ui/src/components/scenarios/chat/components/history-message-frame.vue` *(+9/-3)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.browser.test.ts` *(+37/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/audio-input/hearing-config-dialog.vue` *(+4/-3)*
- `packages/stage-ui/src/components/scenarios/dialogs/audio-input/hearing-config.browser.test.ts` *(+80/-42)*
- `packages/stage-ui/src/components/scenarios/dialogs/audio-input/hearing-config.vue` *(+36/-24)*
- `packages/stage-ui/src/components/scenarios/settings/check-bar.browser.test.ts` *(+100/-0)*
- `packages/stage-ui/src/components/scenarios/settings/check-bar.vue` *(+10/-8)*
- `packages/stage-ui/vitest.config.ts` *(+11/-1)*
- `pnpm-workspace.yaml` *(+8/-0)*
- `vitest.config.ts` *(+1/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 2 file(s) (+770/-59)
- `package.json` *(+1/-1)*
- `pnpm-lock.yaml` *(+769/-58)*

#### Core Agent Runtime (`🔍 inspect`) — 5 file(s) (+205/-4)
- `packages/core-agent/README.md` *(+2/-0)*
- `packages/core-agent/src/agents/spark-command/schema.ts` *(+2/-1)*
- `packages/core-agent/src/agents/spark-command/tools.test.ts` *(+24/-0)*
- `packages/core-agent/src/runtime/chat-completions.test.ts` *(+88/-1)*
- `packages/core-agent/src/runtime/llm-service.ts` *(+89/-2)*

#### Localization (i18n) (`📦 import (additive only)`) — 3 file(s) (+43/-1)
- `packages/i18n/src/locales/en/tamagotchi/settings.yaml` *(+21/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+1/-1)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/settings.yaml` *(+21/-0)*

#### Stage Layouts & Shells (`🔍 inspect`) — 2 file(s) (+1/-2)
- `packages/stage-layouts/src/components/Layouts/mobile-settings-drawer.vue` *(+1/-1)*
- `packages/stage-layouts/src/components/Widgets/ChatArea.vue` *(+0/-1)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 3 file(s) (+124/-14)
- `server/apps/api/src/app.test.ts` *(+48/-1)*
- `server/apps/api/src/app.ts` *(+18/-13)*
- `server/docs/ai/adr/2026-09-30-api-root-browser-redirect.md` *(+58/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (17)
- [#2762](https://github.com/moeru-ai/airi/pull/2762) `feat(ui): add shared dropdown menu` by **@chiba233** *(2 comments)*
- [#2761](https://github.com/moeru-ai/airi/pull/2761) `feat(stage-ui): stream voice transcripts in the inlay and rewrite them with a chat model` by **@nekomeowww** *(1 comments)*
- [#2250](https://github.com/moeru-ai/airi/pull/2250) `fix(discord): show live bot connection status` by **@Zchary1106** *(13 comments)*
- [#2131](https://github.com/moeru-ai/airi/pull/2131) `fix(stage-pages): add MiniMax Speech settings page` by **@Abhinoob1501** *(9 comments)*
- [#1185](https://github.com/moeru-ai/airi/pull/1185) `feat(tamagotchi): Add model selection and custom Voice ID support for Alibaba Bailian` by **@liteshade** *(9 comments)*
- [#1496](https://github.com/moeru-ai/airi/pull/1496) `airi with subtitle and translate` by **@mujiaoMJ** *(7 comments)*
- [#2760](https://github.com/moeru-ai/airi/pull/2760) `fix(pipelines-audio): correct playback tests and isolate stale completions` by **@0xSelenicDove** *(2 comments)*
- [#2137](https://github.com/moeru-ai/airi/pull/2137) `fix(docs): restore characters pages` by **@blottters** *(3 comments)*
- [#2759](https://github.com/moeru-ai/airi/pull/2759) `fix(i18n): format Crowdin exports before publication` by **@0xSelenicDove** *(2 comments)*
- [#2754](https://github.com/moeru-ai/airi/pull/2754) `chore(i18n): update translations` by **@github-actions** *(4 comments)*
- [#2756](https://github.com/moeru-ai/airi/pull/2756) `fix(core-agent): flatten nullable spark command destinations` by **@0xSelenicDove** *(4 comments)*
- [#2753](https://github.com/moeru-ai/airi/pull/2753) `fix(core-agent): keep tools after a schema or tool-call error` by **@ybai08** *(2 comments)*
- [#2757](https://github.com/moeru-ai/airi/pull/2757) `fix(stage-tamagotchi): set the dock icon only in dev runs` by **@nekomeowww** *(2 comments)*
- [#1889](https://github.com/moeru-ai/airi/pull/1889) `feat(chat): add stop button to cancel in-flight assistant generation` by **@felixtremblay** *(49 comments)*
- [#1859](https://github.com/moeru-ai/airi/pull/1859) `fix(tamagotchi): include stream state in chat sync snapshots` by **@luyua9** *(1 comments)*
- [#2298](https://github.com/moeru-ai/airi/pull/2298) `docs: fix broken star history chart` by **@Dessalines39394** *(2 comments)*
- [#2755](https://github.com/moeru-ai/airi/pull/2755) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(2 comments)*

#### 🔄 PR Status & Lifecycle Changes (9)
- [#2724](https://github.com/moeru-ai/airi/pull/2724) `feat(core-agent): retry temporary provider failures` — `OPEN` ➔ `MERGED`
- [#2416](https://github.com/moeru-ai/airi/pull/2416) `fix(ci): include service workspaces in typecheck` — `OPEN` ➔ `MERGED`
- [#2740](https://github.com/moeru-ai/airi/pull/2740) `fix(stage-ui): clarify animation toggle states` — `OPEN` ➔ `MERGED`
- [#2419](https://github.com/moeru-ai/airi/pull/2419) `test: include pipelines audio in root vitest projects` — `OPEN` ➔ `MERGED`
- [#2588](https://github.com/moeru-ai/airi/pull/2588) `docs(contributing): align GitHub setup guide with pinned tooling` — `OPEN` ➔ `MERGED`
- [#2733](https://github.com/moeru-ai/airi/pull/2733) `fix(auth): return API and verification browser visits to AIRI` — `OPEN` ➔ `MERGED`
- [#2700](https://github.com/moeru-ai/airi/pull/2700) `feat(stage-tamagotchi): add tray-only app icon setting` — `OPEN` ➔ `MERGED`
- [#2739](https://github.com/moeru-ai/airi/pull/2739) `feat(tamagotchi): experimental kirie migration` — `OPEN` ➔ `MERGED`, `Draft` ➔ `Ready`
- [#2651](https://github.com/moeru-ai/airi/pull/2651) `refactor(stage-ui): make voice input and ASR lifecycle explicit` — `OPEN` ➔ `CLOSED`

#### 💬 Discussion Activity (17)
- [#2748](https://github.com/moeru-ai/airi/pull/2748) `feat: add the cognitive runtime` — *+3 comments (2 ➔ 5 total)*
- [#2724](https://github.com/moeru-ai/airi/pull/2724) `feat(core-agent): retry temporary provider failures` — *+3 comments (1 ➔ 4 total)*
- [#2703](https://github.com/moeru-ai/airi/pull/2703) `fix(stage-pages): add the MiniMax Speech settings page` — *+1 comments (0 ➔ 1 total)*
- [#2416](https://github.com/moeru-ai/airi/pull/2416) `fix(ci): include service workspaces in typecheck` — *+2 comments (2 ➔ 4 total)*
- [#2419](https://github.com/moeru-ai/airi/pull/2419) `test: include pipelines audio in root vitest projects` — *+1 comments (1 ➔ 2 total)*
- [#2679](https://github.com/moeru-ai/airi/pull/2679) `docs: update development setup guide` — *+1 comments (3 ➔ 4 total)*
- [#2567](https://github.com/moeru-ai/airi/pull/2567) `feat(provider-inference): add AnonRouter chat provider` — *+1 comments (4 ➔ 5 total)*
- [#2644](https://github.com/moeru-ai/airi/pull/2644) `feat(api): add provider-cost Flux settlement` — *+2 comments (37 ➔ 39 total)*
- [#2741](https://github.com/moeru-ai/airi/pull/2741) `fix(stage-layouts): keep the stop action available between speech segments` — *+1 comments (1 ➔ 2 total)*
- [#2524](https://github.com/moeru-ai/airi/pull/2524) `feat(provider-inference): refresh Volcengine coding-plan models from endpoint` — *+1 comments (10 ➔ 11 total)*
- [#2733](https://github.com/moeru-ai/airi/pull/2733) `fix(auth): return API and verification browser visits to AIRI` — *+3 comments (5 ➔ 8 total)*
- [#2473](https://github.com/moeru-ai/airi/pull/2473) `feat(auth): add native email change flow` — *+2 comments (9 ➔ 11 total)*
- [#2552](https://github.com/moeru-ai/airi/pull/2552) `feat(stage)    add bilingual subtitles` — *+1 comments (10 ➔ 11 total)*
- [#2541](https://github.com/moeru-ai/airi/pull/2541) `Telltworose/feat/drop in plugins` — *+2 comments (56 ➔ 58 total)*
- [#2545](https://github.com/moeru-ai/airi/pull/2545) `refactor(stage-ui): share provider config snapshots and cover follower edits` — *+1 comments (1 ➔ 2 total)*
- [#2739](https://github.com/moeru-ai/airi/pull/2739) `feat(tamagotchi): experimental kirie migration` — *+1 comments (2 ➔ 3 total)*
- [#2717](https://github.com/moeru-ai/airi/pull/2717) `feat(debug-server): persist and query local OTLP traces` — *+4 comments (23 ➔ 27 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(1 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` [Draft] — *(48 comments)*
  - *Focus*: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard

---
## [2026-10-01] Upstream Delta: `2444e92c..4b702bd6` (10 commits, 107 files, 20 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 10 commits (`4b702bd667`..`96ca8bbe7a`) across 107 files, alongside 20 PR updates (9 new PRs, 5 lifecycle changes, 6 discussion activity changes). Key themes: (1) **Apple Vision Provider (#2734 / `244360260a`)**: Merged native Apple Vision support on macOS with OCR and visual description wrapping for attached and tool images; (2) **Coordinated Splash & Loading Screens (#2698 / `3fd34c20c8`)**: Added `@proj-airi/ui-loading-screens` with unified `StartupScreen` and error recovery dialogs; (3) **Floating Chat Danmaku Style (#2704 / `07c63535f1`)**: Added a 4th floating chat style ("Message feed" / danmaku) with auto-folding composer and hover fade/click-through, plus bubble width blowout fixes; (4) **Wayland Window Interactivity (#2749 / `85d90ab067`)**: Fixed permanent click-through lockup on Linux Wayland by keeping the window interactive; (5) **Tool Replay Safety on Fallback (#2745 / `6a6dd46f9f`)**: Fixed critical bug where content-part array rejection retried a stream after a tool call had already begun; (6) **New PR Initiatives**: Cognitive runtime proposal (#2748 by @chiba233), centralized voice/audio lifecycles (#2743 by @nekomeowww), and Minecraft auth diagnostics (#2750).
* **Discussion & Community Buzz**:
  - 💬 **#2698: `feat(stage): add coordinated splash and loading screens` (+12 new comments, total 62)**: Heavy review velocity across desktop and mobile prior to merge.
  - 💬 **#2519: `test(stage-tamagotchi): verify linux window rendering in CI` (+6 new comments, total 20)**: Active discussion on Linux CI testing and window harness stability.
  - 💬 **#2717: `feat(debug-server): persist and query local OTLP traces` (+3 new comments, total 23)**: Steady engagement on local OpenTelemetry trace storage with DuckDB.
  - 💬 **#2252: `docs(ui): add entrance animations and optimize performance across UI components` (+2 new comments, total 11)**: Review polish on UI animations.
  - 💬 **#2708: `feat(hearing): add character wake words across clients` (+1 new comments, total 36)**: Sustained community interest in client-side character wake words.
  - 👁️ **Watched PRs**:
    - **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain`** [Draft] (1 comment): Dormant; maintainers have not endorsed replacing native memory with an external daemon.
    - **#2672: `refactor(stage-ui): bind conversations to window-local characters`** [Draft] (48 comments): Maintained high discussion velocity regarding window-local character selection and scoping.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2745 / Commit `6a6dd46f9f`: `fix(stage-ui): prevent tool replay during compatibility fallback` by @nekomeowww**: High-priority safety bug fix in `useLLM().stream`. Prevents duplicate tool invocations when content array errors trigger retry logic after a tool has already started execution. Clean, minimal, high-value port.
  - ⭐ **PR #2749 / Commit `85d90ab067`: `fix(stage-tamagotchi): keep the stage window interactive on Wayland` by @gg582**: Important fix for Wayland users. Prevents permanent click-through unresponsiveness caused by unsupported Electron `forward` flag on Linux.
  - ⭐ **PR #2704 (Bubble Width Constraint) / Commit `07c63535f1`: `min-w-0 max-w-full` for Chat Bubbles**: Simple CSS fix in `ChatActionMenu` preventing horizontal viewport overflow from long URLs or wide code blocks.
  - 🔍 **PR #2698 / Commit `3fd34c20c8`: `@proj-airi/ui-loading-screens`**: Clean modular loading screen package; evaluate compatibility with our decoupled Actor Stage boot sequence.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **Commit `1262237806` (PR #2719)**: Targets `controls-island`, which is deprecated and deleted in our fork in favor of the floating Control Strip.
    - **Commit `244360260a` (PR #2734)**: Apple Vision provider makes intrusive modifications across `stores/chat.ts` and `stores/modules/airi-card.ts` designed for upstream's single-actor model; incompatible with our multi-actor and decoupled attention ecology vision engine.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts` & `packages/stage-ui/src/stores/ai/chat-llm/llm.ts`**: Touched extensively by PR #2734 and #2745. Our fork has deeply customized multi-actor conversation pipelines, STMM/LTMM text journal hooks, and dreaming workers. Never auto-merge; isolate cherry-picks to the specific tool execution guard in `llm.ts`.
  - ⚠️ **`packages/stage-ui/src/stores/modules/airi-card.ts`**: Modified by PR #2734 for vision model inheritance. Our fork has custom multi-actor character bindings and extensions.
  - ⚠️ **`apps/stage-tamagotchi/src/main/windows/chat/floating.ts` & `InteractiveArea.vue`**: Upstream added danmaku mode in `07c63535f1`. Conflicts with our decoupled Control Strip and stage window architecture.

### 📋 Upstream Commits
- `4b702bd667` chore(i18n): update translations (#2747) [#2747](https://github.com/moeru-ai/airi/pull/2747) _(github-actions[bot], 2026-10-01)_
- `85d90ab067` fix(stage-tamagotchi): keep the stage window interactive on Wayland (#2749) [#2749](https://github.com/moeru-ai/airi/pull/2749) _(이윤진(Lee Yunjin), 2026-10-01)_
- `6dd036bec5` chore(nix): update assets hash (#2746) [#2746](https://github.com/moeru-ai/airi/pull/2746) _(Weathercold, 2026-09-30)_
- `3fd34c20c8` feat(stage-*): add coordinated splash and loading screens (#2698) [#2698](https://github.com/moeru-ai/airi/pull/2698) _(Neko, 2026-10-01)_
- `6a6dd46f9f` fix(stage-ui): prevent tool replay during compatibility fallback (#2745) [#2745](https://github.com/moeru-ai/airi/pull/2745) _(Neko, 2026-10-01)_
- `1262237806` fix(stage-tamagotchi): align controls island placement (#2719) [#2719](https://github.com/moeru-ai/airi/pull/2719) _(Neko, 2026-10-01)_
- `07c63535f1` feat(stage-tamagotchi): add a danmaku style to the floating chat (#2704) [#2704](https://github.com/moeru-ai/airi/pull/2704) _(蓝莓🫐, 2026-10-01)_
- `da2bcbd46f` chore(nix): update pnpmDeps hash (#2737) [#2737](https://github.com/moeru-ai/airi/pull/2737) _(Weathercold, 2026-09-30)_
- `244360260a` feat(stage-ui): add the Apple Vision provider (#2734) [#2734](https://github.com/moeru-ai/airi/pull/2734) _(蓝莓🫐, 2026-10-01)_
- `96ca8bbe7a` docs(agents): forbid English placeholders in other locales (#2742) [#2742](https://github.com/moeru-ai/airi/pull/2742) _(Lulu, 2026-09-30)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 2 file(s) (+32/-8)
- `AGENTS.md` *(+1/-0)*
- `packages/stage-ui/README.md` *(+31/-8)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 10 file(s) (+359/-123)
- `apps/stage-pocket/index.html` *(+62/-1)*
- `apps/stage-pocket/src/App.vue` *(+88/-56)*
- `apps/stage-pocket/src/pages/index.vue` *(+19/-0)*
- `apps/stage-pocket/uno.config.ts` *(+1/-3)*
- `apps/stage-pocket/vite.config.ts` *(+6/-0)*
- `apps/stage-web/index.html` *(+62/-1)*
- `apps/stage-web/package.json` *(+1/-0)*
- `apps/stage-web/src/App.vue` *(+95/-62)*
- `apps/stage-web/src/pages/index.vue` *(+19/-0)*
- `apps/stage-web/vite.config.ts` *(+6/-0)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 18 file(s) (+364/-49)
- `apps/stage-tamagotchi/README.md` *(+5/-2)*
- `apps/stage-tamagotchi/electron.vite.config.ts` *(+1/-0)*
- `apps/stage-tamagotchi/package.json` *(+4/-1)*
- `apps/stage-tamagotchi/src/main/index.ts` *(+7/-1)*
- `apps/stage-tamagotchi/src/main/services/airi/apple-vision/index.ts` *(+67/-0)*
- `apps/stage-tamagotchi/src/main/windows/chat/floating.ts` *(+27/-16)*
- `apps/stage-tamagotchi/src/main/windows/chat/index.ts` *(+1/-1)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+81/-2)*
- `apps/stage-tamagotchi/src/renderer/components/chat-viewport-layout.vue` *(+18/-0)*
- `apps/stage-tamagotchi/src/renderer/components/chat-window/chat-window-style-menu.vue` *(+4/-2)*
- `apps/stage-tamagotchi/src/renderer/composables/use-chat-floating-click-through.browser.test.ts` *(+18/-2)*
- `apps/stage-tamagotchi/src/renderer/composables/use-chat-floating-click-through.ts` *(+62/-8)*
- `apps/stage-tamagotchi/src/renderer/pages/chat-floating.vue` *(+24/-3)*
- `apps/stage-tamagotchi/src/renderer/pages/devtools/vision.vue` *(+2/-3)*
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` *(+8/-1)*
- `apps/stage-tamagotchi/src/renderer/utils/fade-on-hover.test.ts` *(+18/-0)*
- `apps/stage-tamagotchi/src/renderer/utils/fade-on-hover.ts` *(+8/-1)*
- `apps/stage-tamagotchi/src/shared/eventa/index.ts` *(+9/-6)*

#### Deprecated Surfaces (Control Island) (`⚪ ignore / rejected in fork (decoupled into Control Strip)`) — 2 file(s) (+14/-14)
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-root.test.ts` *(+11/-11)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/use-controls-island-placement.ts` *(+3/-3)*

#### Other / Uncategorized (`🔍 inspect`) — 47 file(s) (+1760/-54)
- `nix/assets-hash.txt` *(+1/-1)*
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/provider-inference/src/types.ts` *(+16/-0)*
- `packages/stage-ui-spine/src/components/scenes/Spine.vue` *(+15/-2)*
- `packages/stage-ui-spine/src/components/scenes/spine/Model.vue` *(+1/-3)*
- `packages/stage-ui/src/components/scenarios/chat/components/action-menu/index.vue` *(+1/-1)*
- `packages/stage-ui/src/components/scenarios/chat/components/history-layout.browser.test.ts` *(+41/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.vue` *(+8/-0)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-history-scroll.browser.test.ts` *(+28/-0)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-history-scroll.ts` *(+22/-1)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding-dialog.vue` *(+11/-5)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding.browser.test.ts` *(+1/-1)*
- `packages/stage-ui/src/components/scenarios/index.ts` *(+1/-0)*
- `packages/stage-ui/src/components/scenarios/startup/startup-overlay.browser.test.ts` *(+223/-0)*
- `packages/stage-ui/src/components/scenarios/startup/startup-overlay.vue` *(+72/-0)*
- `packages/stage-ui/src/composables/use-startup-resource-timeout.test.ts` *(+44/-0)*
- `packages/stage-ui/src/composables/use-startup-resource-timeout.ts` *(+20/-0)*
- `packages/stage-ui/src/composables/vision/use-chat-vision.ts` *(+51/-0)*
- `packages/stage-ui/src/composables/vision/use-vision-inference.test.ts` *(+100/-2)*
- `packages/stage-ui/src/composables/vision/use-vision-inference.ts` *(+54/-9)*
- `packages/stage-ui/src/composables/vision/use-vision-workloads.ts` *(+11/-1)*
- `packages/stage-ui/src/composables/vision/vision-read-queue.ts` *(+66/-0)*
- `packages/stage-ui/src/libs/providers/attributes.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/providers/providers/apple-vision/index.test.ts` *(+88/-0)*
- `packages/stage-ui/src/libs/providers/providers/apple-vision/index.ts` *(+143/-0)*
- `packages/stage-ui/src/libs/providers/providers/index.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/providers/providers/provider-definitions.test.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/providers/providers/registry.ts` *(+2/-0)*
- `packages/stage-ui/src/stores/ai/chat-llm/llm.test.ts` *(+14/-0)*
- `packages/stage-ui/src/stores/ai/chat-llm/llm.ts` *(+20/-3)*
- `packages/stage-ui/src/stores/ai/chat-llm/tool-images.test.ts` *(+85/-0)*
- `packages/stage-ui/src/stores/ai/chat-llm/tool-images.ts` *(+81/-0)*
- `packages/stage-ui/src/stores/ai/chat-llm/tool-resolver.test.ts` *(+24/-0)*
- `packages/stage-ui/src/stores/ai/chat-llm/tool-resolver.ts` *(+14/-1)*
- `packages/stage-ui/src/stores/modules/airi-card-inheritance.browser.test.ts` *(+29/-0)*
- `packages/stage-ui/src/stores/modules/airi-card.test.ts` *(+31/-0)*
- `packages/stage-ui/src/stores/modules/airi-card.ts` *(+20/-0)*
- `packages/stage-ui/src/stores/modules/vision/activity.browser.test.ts` *(+120/-0)*
- `packages/stage-ui/src/stores/modules/vision/activity.ts` *(+105/-0)*
- `packages/stage-ui/src/stores/modules/vision/index.ts` *(+1/-0)*
- `packages/stage-ui/src/stores/modules/vision/processing-store.ts` *(+10/-16)*
- `packages/stage-ui/src/stores/modules/vision/store.ts` *(+4/-0)*
- `packages/stage-ui/src/stores/startup-resources.test.ts` *(+79/-0)*
- `packages/stage-ui/src/stores/startup-resources.ts` *(+91/-0)*
- `packages/stage-ui/uno.config.ts` *(+1/-4)*
- `packages/stage-ui/vitest.config.ts` *(+3/-3)*
- `pnpm-workspace.yaml` *(+4/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 12 file(s) (+244/-1)
- `packages/i18n/src/index.ts` *(+2/-0)*
- `packages/i18n/src/locales/en/settings.yaml` *(+32/-0)*
- `packages/i18n/src/locales/en/stage.yaml` *(+21/-0)*
- `packages/i18n/src/locales/en/tamagotchi/stage.yaml` *(+4/-0)*
- `packages/i18n/src/locales/es/base.yaml` *(+2/-0)*
- `packages/i18n/src/locales/es/settings.yaml` *(+1/-1)*
- `packages/i18n/src/locales/es/stage.yaml` *(+55/-0)*
- `packages/i18n/src/locales/es/tamagotchi/settings.yaml` *(+53/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+32/-0)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+20/-0)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/stage.yaml` *(+4/-0)*
- `packages/i18n/src/startup-fallback.ts` *(+18/-0)*

#### Stage Layouts & Shells (`🔍 inspect`) — 1 file(s) (+6/-1)
- `packages/stage-layouts/src/composables/useChatToolCallRerun.ts` *(+6/-1)*

#### UI Primitives & Pages (`📦 import / inspect`) — 8 file(s) (+796/-39)
- `packages/stage-pages/src/pages/settings/modules/vision.vue` *(+86/-32)*
- `packages/stage-pages/src/pages/settings/providers/vision/apple-vision.vue` *(+60/-0)*
- `packages/ui-loading-screens/README.md` *(+27/-4)*
- `packages/ui-loading-screens/package.json` *(+4/-1)*
- `packages/ui-loading-screens/src/components/index.ts` *(+1/-0)*
- `packages/ui-loading-screens/src/components/startup-error-details.vue` *(+216/-0)*
- `packages/ui-loading-screens/src/components/startup-screen.vue` *(+393/-0)*
- `packages/ui/src/components/misc/progress.vue` *(+9/-2)*

#### Root Build & Tooling (`🔍 inspect`) — 2 file(s) (+82/-3)
- `packages/stage-ui/package.json` *(+2/-0)*
- `pnpm-lock.yaml` *(+80/-3)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 1 file(s) (+13/-5)
- `packages/stage-ui/src/components/scenes/Stage.vue` *(+13/-5)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 4 file(s) (+417/-61)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+267/-6)*
- `packages/stage-ui/src/stores/chat.ts` *(+82/-17)*
- `packages/stage-ui/src/stores/chat/image-projection.test.ts` *(+31/-25)*
- `packages/stage-ui/src/stores/chat/image-projection.ts` *(+37/-13)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (9)
- [#2748](https://github.com/moeru-ai/airi/pull/2748) `feat: add the cognitive runtime` by **@chiba233** *(Draft)* *(2 comments)*
- [#2743](https://github.com/moeru-ai/airi/pull/2743) `refactor(voice): centralize audio and conversation lifecycles` by **@nekomeowww** *(2 comments)*
- [#2750](https://github.com/moeru-ai/airi/pull/2750) `fix(minecraft): explain AIRI authentication failures` by **@Huyvux12** *(Draft)* *(0 comments)*
- [#2747](https://github.com/moeru-ai/airi/pull/2747) `chore(i18n): update translations` by **@github-actions** *(4 comments)*
- [#2749](https://github.com/moeru-ai/airi/pull/2749) `fix(stage-tamagotchi): keep the stage window interactive on Wayland` by **@gg582** *(2 comments)*
- [#2746](https://github.com/moeru-ai/airi/pull/2746) `chore(nix): update assets hash` by **@Weathercold** *(2 comments)*
- [#2745](https://github.com/moeru-ai/airi/pull/2745) `fix(stage-ui): prevent tool replay during compatibility fallback` by **@nekomeowww** *(2 comments)*
- [#2744](https://github.com/moeru-ai/airi/pull/2744) `fix(stage-pages): group hearing auto-send settings` by **@nekomeowww** *(1 comments)*
- [#2742](https://github.com/moeru-ai/airi/pull/2742) `docs(agents): forbid English placeholders in other locales` by **@lulu0119** *(2 comments)*

#### 🔄 PR Status & Lifecycle Changes (5)
- [#2734](https://github.com/moeru-ai/airi/pull/2734) `feat(stage-ui): add the Apple Vision provider` — `OPEN` ➔ `MERGED`
- [#2704](https://github.com/moeru-ai/airi/pull/2704) `feat(stage-tamagotchi): add a danmaku style to the floating chat` — `OPEN` ➔ `MERGED`
- [#2698](https://github.com/moeru-ai/airi/pull/2698) `feat(stage): add coordinated splash and loading screens` — `OPEN` ➔ `MERGED`
- [#2719](https://github.com/moeru-ai/airi/pull/2719) `fix(stage-tamagotchi): align controls island placement` — `OPEN` ➔ `MERGED`
- [#2737](https://github.com/moeru-ai/airi/pull/2737) `chore(nix): update pnpmDeps hash` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (6)
- [#2717](https://github.com/moeru-ai/airi/pull/2717) `feat(debug-server): persist and query local OTLP traces` — *+3 comments (20 ➔ 23 total)*
- [#2519](https://github.com/moeru-ai/airi/pull/2519) `test(stage-tamagotchi): verify linux window rendering in CI` — *+6 comments (14 ➔ 20 total)*
- [#2252](https://github.com/moeru-ai/airi/pull/2252) `docs(ui): add entrance animations and optimize performance across UI components` — *+2 comments (9 ➔ 11 total)*
- [#2698](https://github.com/moeru-ai/airi/pull/2698) `feat(stage): add coordinated splash and loading screens` — *+12 comments (50 ➔ 62 total)*
- [#2708](https://github.com/moeru-ai/airi/pull/2708) `feat(hearing): add character wake words across clients` — *+1 comments (35 ➔ 36 total)*
- [#2719](https://github.com/moeru-ai/airi/pull/2719) `fix(stage-tamagotchi): align controls island placement` — *+1 comments (1 ➔ 2 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(1 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` [Draft] — *(48 comments)*
  - *Focus*: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard

---
## [2026-09-30] Upstream Delta: `b40e3e87..2444e92c` (11 commits, 68 files, 38 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 11 commits (`2444e92c7e`, `93cc3da5c1`, `1545b34da8`, `3dc2c18782`, `752c7527b7`, `bc6e65e097`, `26f37d6846`, `d3a51672b0`, `3f4fd2a749`, `dc686d9697`, `d474d1033d`) across 68 files, alongside 38 PR updates (29 new PRs, 4 status changes, 5 discussion changes). Key themes: (1) **Dynamic In-Canvas Presence Bubble (#2657 / `d3a51672b0`)**: Merged +3.2k lines establishing canvas-painted presence/thinking indicators beside avatar heads for Three/VRM and Pixi/Live2D with spring follow physics; (2) **Core Agent Step-Level Settings (#2709 / `3dc2c18782`)**: Refreshed provider settings dynamically across multi-step tool execution loops; (3) **Tamagotchi Window UX (#2681, #2702, #2720)**: Fades `controls-island` on cursor-away, refined resize/fold icons in floating chat, and removed chat window background gradients; (4) **Calling Words & Hearing Overhaul Swarm (#2721, #2726-#2732)**: Major burst of 8 draft PRs by @nekomeowww introducing character calling words, KWS assets, foreground/background hearing lifecycle, and push-to-talk; (5) **Local OTLP Debug Server (#2717)**: Added embedded DuckDB and OpenTelemetry trace storage service; (6) **Provider Integrations**: MiniMax STT provider (#2718) and Apple Vision (#2734); (7) **Agent Resiliency & Chat Polish**: Transient HTTP retry with backoff (#2724), stop button retention across speech segments (#2741), code block bubble overflow constraints (#2735), and opt-in reaction stickers (#2714); (8) **Hosted Backend / Cloud**: Stripe customer creation for unbound users (`dc686d9697`), xsai 0.5.1 bump (`93cc3da5c1`), and logg 1.2.12 bump (`d474d1033d`).
* **Discussion & Community Buzz**:
  - 💬 **#2546: `feat(stage-ui): add voice messages and mobile dictation` (+92 new comments, total 169)**: Massive discussion explosion on voice messaging UX, audio capture, and mobile dictation workflows.
  - 💬 **#2717: `feat(debug-server): persist and query local OTLP traces` (20 comments on opening)**: Strong interest and review engagement on local OpenTelemetry trace collection with embedded DuckDB.
  - 💬 **#2698: `feat(stage): add coordinated splash and loading screens` (+19 new comments, total 50)**: Sustained review velocity around startup asset preloading and splash screen sequencing.
  - 💬 **#2458: `feat(stage): add character-owned Live2D controls` (+8 new comments, total 63)**: Continuing discussions on per-character Live2D model controls and motion hooks.
  - 💬 **#2709: `feat(core-agent): refresh provider settings across tool steps` (+5 new comments, total 5)**: Quick maintainer iterations leading to merge.
  - 💬 **#2644: `feat(api): add provider-cost Flux settlement` (+1 new comments, total 37)**: Deliberation on LLM token cost metering and wallet settlements.
  - 👁️ **Watched PRs**:
    - **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain`** [Draft] (1 comment): Remained inactive; maintainers have not weighed in favoring the external daemon architecture.
    - **#2672: `refactor(stage-ui): bind conversations to window-local characters`** [Draft] (48 comments): High architectural interest around decoupling character selection and scoping conversations locally per window.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2741: `fix(stage-layouts): keep the stop action available between speech segments` by @Yi-111-a**: High-value UX bug fix. Resolves a regression in `useChatInterruption` where switching sessions or waiting between multi-segment speech synthesis hides the stop button, preventing cancellation. Confined cleanly to `packages/stage-layouts/src/composables/use-chat-interruption.ts`.
  - ⭐ **PR #2735: `fix(stage-ui): constrain chat bubbles with wide code blocks` by @Neko-233**: Simple, high-value CSS fix in `action-menu/index.vue` preventing horizontal overflow blowout on wide pre/code blocks by allowing the container to shrink (`min-w-0 max-w-full`).
  - ⭐ **PR #2718: `feat(provider-inference): add the MiniMax speech-to-text provider` by @jabarrioss**: Complete, well-tested addition of MiniMax ASR (`POST /v1/speech_to_text`) with custom request adaptation and settings UI in `packages/stage-pages`. Clean additive port.
  - ⭐ **PR #2724: `feat(core-agent): retry temporary provider failures` by @poggufanz**: Adds transient error retries (HTTP 408, 429, 5xx) with exponential backoff (3s/6s/12s or Retry-After up to 30s) in `llm-service.ts` before stream events reach the caller. Prevents dropped turns on temporary provider blips without duplicate tool side effects.
  - 🔍 **Commit `bc6e65e097` (PR #2702): `chore(stage-tamagotchi): clarify the chat window resize and fold icons`**: Minor icon UX improvement (`lucide:move-diagonal-2` and `lucide:minimize-2`) in `chat-floating.vue`.
  - 🔍 **Commit `d3a51672b0` (PR #2657): Dynamic Presence Bubble in Canvas**: High-fidelity in-canvas presence/thinking indicator with spring follow physics. Good candidate for future adaptation into our decoupled Actor Stage once reviewed.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **Commit `26f37d6846` (PR #2681)**: Modifies `controls-island` (hiding on mouse-away). Our fork deprecated and removed `controls-island` in favor of the decoupled floating Control Strip ribbon.
    - **Commit `dc686d9697` (PR #2715) & PR #2644**: Hosted Stripe billing & Flux settlements (`server/apps/api`). Incompatible with offline-first local architecture.
    - **Commit `93cc3da5c1` (PR #2736)**: Patches for `@xsai-ext/responses` / hosted Responses API. Auto-reject per fork architecture.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts` & `packages/stage-ui/src/stores/ai/chat-llm/llm.ts`**: Touched by PR #2725 (`isolate character sessions and concurrent turns`) and PR #2714 (`reaction stickers`). Our fork has custom multi-actor session architecture, universe scoping, and decoupled memory integration. Blind merges of upstream chat/session store refactors will conflict with local session management.
  - ⚠️ **`apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue`**: Modified by PR #2725, PR #2720, and PR #2681. Upstream is actively shifting session routing and styling in this component, which differs from our fork's Control Strip and Actor Stage separation.
  - ⚠️ **`packages/stage-ui/src/stores/modules/hearing.ts` & `apps/stage-pocket/*`**: Upstream PR swarm (#2726-#2732) is heavily restructuring hearing pipelines around local keyword spotting (KWS) and Android background listeners. Do not merge hearing changes without isolating desktop vs pocket dependencies.

### 📋 Upstream Commits
- `2444e92c7e` docs: add weekly Trendshift badge to readme  _(Lovehsigure_520, 2026-09-30)_
- `93cc3da5c1` chore(deps): update xsai to 0.5.1 and trim patch (#2736) [#2736](https://github.com/moeru-ai/airi/pull/2736) _(藍+85CD, 2026-09-30)_
- `1545b34da8` chore(i18n): update translations (#2722) [#2722](https://github.com/moeru-ai/airi/pull/2722) _(github-actions[bot], 2026-09-30)_
- `3dc2c18782` feat(core-agent): refresh provider settings across tool steps (#2709) [#2709](https://github.com/moeru-ai/airi/pull/2709) _(Neko, 2026-09-30)_
- `752c7527b7` style(stage-tamagotchi): remove chat window gradient (#2720) [#2720](https://github.com/moeru-ai/airi/pull/2720) _(Neko, 2026-09-30)_
- `bc6e65e097` chore(stage-tamagotchi): clarify the chat window resize and fold icons (#2702) [#2702](https://github.com/moeru-ai/airi/pull/2702) _(蓝莓🫐, 2026-09-30)_
- `26f37d6846` feat(stage-tamagotchi): hide the controls island while the cursor is away (#2681) [#2681](https://github.com/moeru-ai/airi/pull/2681) _(蓝莓🫐, 2026-09-30)_
- `d3a51672b0` feat(stage-ui): show a dynamic presence bubble beside the character (#2657) [#2657](https://github.com/moeru-ai/airi/pull/2657) _(蓝莓🫐, 2026-09-30)_
- `3f4fd2a749` chore(nix): update pnpmDeps hash (#2716) [#2716](https://github.com/moeru-ai/airi/pull/2716) _(Weathercold, 2026-09-29)_
- `dc686d9697` fix(api-server): create Stripe customers for unbound users (#2715) [#2715](https://github.com/moeru-ai/airi/pull/2715) _(RainbowBird, 2026-09-29)_
- `d474d1033d` chore(deps): upgrade logg to 1.2.12 (#2713) [#2713](https://github.com/moeru-ai/airi/pull/2713) _(RainbowBird, 2026-09-29)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 3 file(s) (+102/-15)
- `README.md` *(+1/-0)*
- `docs/ai/adr/2026-09-24-presence-bubble-in-canvas.md` *(+95/-0)*
- `patches/README.md` *(+6/-15)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 9 file(s) (+97/-16)
- `apps/stage-tamagotchi/src/main/services/electron/app.ts` *(+9/-1)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+5/-5)*
- `apps/stage-tamagotchi/src/renderer/components/devtools/presence-bubble/controls.vue` *(+45/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/chat-floating.vue` *(+3/-8)*
- `apps/stage-tamagotchi/src/renderer/pages/chat-page-shell.vue` *(+1/-1)*
- `apps/stage-tamagotchi/src/renderer/pages/devtools/presence-bubble.vue` *(+14/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` *(+12/-1)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/system/developer.vue` *(+6/-0)*
- `apps/stage-tamagotchi/src/shared/eventa/index.ts` *(+2/-0)*

#### Deprecated Surfaces (Control Island) (`⚪ ignore / rejected in fork (decoupled into Control Strip)`) — 2 file(s) (+44/-2)
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-overflow.browser.test.ts` *(+26/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/index.vue` *(+18/-2)*

#### Other / Uncategorized (`🔍 inspect`) — 20 file(s) (+2187/-299)
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/stage-shared/src/index.ts` *(+1/-0)*
- `packages/stage-shared/src/presence-bubble/advance.test.ts` *(+239/-0)*
- `packages/stage-shared/src/presence-bubble/advance.ts` *(+188/-0)*
- `packages/stage-shared/src/presence-bubble/clock.test.ts` *(+40/-0)*
- `packages/stage-shared/src/presence-bubble/clock.ts` *(+27/-0)*
- `packages/stage-shared/src/presence-bubble/content.test.ts` *(+61/-0)*
- `packages/stage-shared/src/presence-bubble/content.ts` *(+115/-0)*
- `packages/stage-shared/src/presence-bubble/follow.test.ts` *(+148/-0)*
- `packages/stage-shared/src/presence-bubble/follow.ts` *(+118/-0)*
- `packages/stage-shared/src/presence-bubble/index.ts` *(+6/-0)*
- `packages/stage-shared/src/presence-bubble/painter.test.ts` *(+140/-0)*
- `packages/stage-shared/src/presence-bubble/painter.ts` *(+534/-0)*
- `packages/stage-shared/src/presence-bubble/placement.test.ts` *(+136/-0)*
- `packages/stage-shared/src/presence-bubble/placement.ts` *(+157/-0)*
- `packages/stage-ui/src/stores/presence-bubble.browser.test.ts` *(+105/-0)*
- `packages/stage-ui/src/stores/presence-bubble.ts` *(+52/-0)*
- `patches/@xsai-ext__responses@0.5.0.patch` *(+0/-281)*
- `patches/@xsai-ext__responses@0.5.1.patch` *(+96/-0)*
- `pnpm-workspace.yaml` *(+23/-17)*

#### Core Agent Runtime (`🔍 inspect`) — 12 file(s) (+831/-64)
- `packages/core-agent/README.md` *(+2/-0)*
- `packages/core-agent/src/messages/chat-completions.ts` *(+13/-9)*
- `packages/core-agent/src/runtime/chat-completions.test.ts` *(+158/-0)*
- `packages/core-agent/src/runtime/chat-completions.ts` *(+73/-9)*
- `packages/core-agent/src/runtime/generation.ts` *(+8/-5)*
- `packages/core-agent/src/runtime/llm-service.test.ts` *(+146/-0)*
- `packages/core-agent/src/runtime/llm-service.ts` *(+105/-33)*
- `packages/core-agent/src/runtime/request-context.ts` *(+28/-0)*
- `packages/core-agent/src/runtime/request-switch.ts` *(+12/-0)*
- `packages/core-agent/src/runtime/responses.test.ts` *(+206/-0)*
- `packages/core-agent/src/runtime/responses.ts` *(+64/-8)*
- `packages/core-agent/src/types/llm.ts` *(+16/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 7 file(s) (+35/-0)
- `packages/i18n/src/locales/en/tamagotchi/settings.yaml` *(+13/-0)*
- `packages/i18n/src/locales/ja/settings.yaml` *(+2/-0)*
- `packages/i18n/src/locales/ko/settings.yaml` *(+1/-0)*
- `packages/i18n/src/locales/ru/settings.yaml` *(+1/-0)*
- `packages/i18n/src/locales/vi/docs/theme.yaml` *(+2/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+1/-0)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/settings.yaml` *(+15/-0)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 11 file(s) (+1008/-4)
- `packages/stage-ui-live2d/src/components/scenes/Live2D.vue` *(+16/-0)*
- `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue` *(+40/-0)*
- `packages/stage-ui-live2d/src/components/scenes/live2d/presence-bubble.vue` *(+168/-0)*
- `packages/stage-ui-live2d/src/composables/live2d/head-anchor.test.ts` *(+167/-0)*
- `packages/stage-ui-live2d/src/composables/live2d/head-anchor.ts` *(+288/-0)*
- `packages/stage-ui-live2d/src/composables/live2d/index.ts` *(+1/-0)*
- `packages/stage-ui-three/src/components/Model/VRMModel.vue` *(+50/-0)*
- `packages/stage-ui-three/src/components/ThreeScene.vue` *(+59/-3)*
- `packages/stage-ui-three/src/components/presence-bubble-palette.ts` *(+11/-0)*
- `packages/stage-ui-three/src/components/presence-bubble.vue` *(+193/-0)*
- `packages/stage-ui/src/components/scenes/Stage.vue` *(+15/-1)*

#### Root Build & Tooling (`🔍 inspect`) — 1 file(s) (+258/-258)
- `pnpm-lock.yaml` *(+258/-258)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 3 file(s) (+137/-1)
- `server/apps/api/src/routes/stripe/checkout.test.ts` *(+65/-1)*
- `server/apps/api/src/routes/stripe/operations/checkout.ts` *(+1/-0)*
- `server/docs/ai/adr/2026-09-29-stripe-checkout-customer.md` *(+71/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (29)
- [#2741](https://github.com/moeru-ai/airi/pull/2741) `fix(stage-layouts): keep the stop action available between speech segments` by **@Yi-111-a** *(1 comments)*
- [#2740](https://github.com/moeru-ai/airi/pull/2740) `fix(stage-ui): clarify animation toggle states` by **@Redestiny** *(2 comments)*
- [#2739](https://github.com/moeru-ai/airi/pull/2739) `feat(tamagotchi): experimental kirie migration` by **@BeanDz** *(Draft)* *(2 comments)*
- [#2717](https://github.com/moeru-ai/airi/pull/2717) `feat(debug-server): persist and query local OTLP traces` by **@luoling8192** *(20 comments)*
- [#2734](https://github.com/moeru-ai/airi/pull/2734) `feat(stage-ui): add the Apple Vision provider` by **@chiba233** *(2 comments)*
- [#2737](https://github.com/moeru-ai/airi/pull/2737) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(2 comments)*
- [#2735](https://github.com/moeru-ai/airi/pull/2735) `fix(stage-ui): constrain chat bubbles with wide code blocks` by **@Neko-233** *(2 comments)*
- [#2736](https://github.com/moeru-ai/airi/pull/2736) `chore(deps): update xsai to 0.5.1 and trim patch` by **@kwaa** *(2 comments)*
- [#2722](https://github.com/moeru-ai/airi/pull/2722) `chore(i18n): update translations` by **@github-actions** *(2 comments)*
- [#2733](https://github.com/moeru-ai/airi/pull/2733) `fix(auth): return API and verification browser visits to AIRI` by **@luoling8192** *(5 comments)*
- [#2723](https://github.com/moeru-ai/airi/pull/2723) `fix(auth): route verification emails to the result page` by **@Neko-233** *(1 comments)*
- [#2721](https://github.com/moeru-ai/airi/pull/2721) `fix(chat): adapt voice input to dynamic provider requests` by **@nekomeowww** *(Draft)* *(0 comments)*
- [#2732](https://github.com/moeru-ai/airi/pull/2732) `refactor(hearing): separate settings routes and shared controls` by **@nekomeowww** *(Draft)* *(0 comments)*
- [#2731](https://github.com/moeru-ai/airi/pull/2731) `feat(stage-pocket): add Android background calling words` by **@nekomeowww** *(Draft)* *(0 comments)*
- [#2727](https://github.com/moeru-ai/airi/pull/2727) `feat(stage-tamagotchi): add recording indicator and session drafts` by **@nekomeowww** *(Draft)* *(0 comments)*
- [#2726](https://github.com/moeru-ai/airi/pull/2726) `feat(hearing): add character calling words and KWS assets` by **@nekomeowww** *(Draft)* *(0 comments)*
- [#2730](https://github.com/moeru-ai/airi/pull/2730) `feat(hearing): connect foreground calling word capture` by **@nekomeowww** *(Draft)* *(0 comments)*
- [#2729](https://github.com/moeru-ai/airi/pull/2729) `feat(voice): add push-to-talk capture and delivery` by **@nekomeowww** *(Draft)* *(0 comments)*
- [#2728](https://github.com/moeru-ai/airi/pull/2728) `feat(stage-pocket): share foreground hearing lifecycle` by **@nekomeowww** *(Draft)* *(0 comments)*
- [#2725](https://github.com/moeru-ai/airi/pull/2725) `feat(chat): isolate character sessions and concurrent turns` by **@nekomeowww** *(Draft)* *(0 comments)*
- [#2724](https://github.com/moeru-ai/airi/pull/2724) `feat(core-agent): retry temporary provider failures` by **@poggufanz** *(1 comments)*
- [#2712](https://github.com/moeru-ai/airi/pull/2712) `test(testing-audio): cover calling word detection` by **@nekomeowww** *(3 comments)*
- [#2719](https://github.com/moeru-ai/airi/pull/2719) `fix(stage): align controls island and hearing settings layout` by **@nekomeowww** *(1 comments)*
- [#2720](https://github.com/moeru-ai/airi/pull/2720) `style(stage-tamagotchi): remove chat window gradient` by **@nekomeowww** *(2 comments)*
- [#2716](https://github.com/moeru-ai/airi/pull/2716) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2718](https://github.com/moeru-ai/airi/pull/2718) `feat(provider-inference): add the MiniMax speech-to-text provider` by **@jabarrioss** *(1 comments)*
- [#2715](https://github.com/moeru-ai/airi/pull/2715) `fix(api-server): create Stripe customers for unbound users` by **@luoling8192** *(2 comments)*
- [#2713](https://github.com/moeru-ai/airi/pull/2713) `chore(deps): upgrade logg to 1.2.12` by **@luoling8192** *(4 comments)*
- [#2714](https://github.com/moeru-ai/airi/pull/2714) `feat(chat): add opt-in local reaction stickers` by **@reverieach** *(0 comments)*

#### 🔄 PR Status & Lifecycle Changes (4)
- [#2681](https://github.com/moeru-ai/airi/pull/2681) `feat(stage-tamagotchi): hide the controls island while the cursor is away` — `OPEN` ➔ `MERGED`
- [#2657](https://github.com/moeru-ai/airi/pull/2657) `feat(stage-ui): show a dynamic presence bubble beside the character` — `OPEN` ➔ `MERGED`
- [#2709](https://github.com/moeru-ai/airi/pull/2709) `feat(core-agent): refresh provider settings across tool steps` — `OPEN` ➔ `MERGED`, `Draft` ➔ `Ready`
- [#2702](https://github.com/moeru-ai/airi/pull/2702) `chore(stage-tamagotchi): clarify the chat window resize and fold icons` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (5)
- [#2698](https://github.com/moeru-ai/airi/pull/2698) `feat(stage): add coordinated splash and loading screens` — *+19 comments (31 ➔ 50 total)*
- [#2644](https://github.com/moeru-ai/airi/pull/2644) `feat(api): add provider-cost Flux settlement` — *+1 comments (36 ➔ 37 total)*
- [#2546](https://github.com/moeru-ai/airi/pull/2546) `feat(stage-ui): add voice messages and mobile dictation` — *+92 comments (77 ➔ 169 total)*
- [#2709](https://github.com/moeru-ai/airi/pull/2709) `feat(core-agent): refresh provider settings across tool steps` — *+5 comments (0 ➔ 5 total)*
- [#2458](https://github.com/moeru-ai/airi/pull/2458) `feat(stage): add character-owned Live2D controls` — *+8 comments (55 ➔ 63 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(1 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` [Draft] — *(48 comments)*
  - *Focus*: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard

---
## [2026-09-29] Upstream Delta: `1828bdc0..b40e3e87` (8 commits, 94 files, 32 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 8 commits (`b40e3e87b1`, `a7bb9a3169`, `9cfc9a44db`, `a62f58346e`, `991c0a27c8`, `2e0e963670`, `bea1275f0a`, `c2ee54a91d`) across 94 files, alongside 32 PR updates (15 new PRs, 8 status changes, 9 discussion changes). Key focus areas: (1) **Chat Error Display Compactness (#2695 / `2e0e963670`)**: Added compact provider error formatting in chat history (`error-item.vue`) with 160-char summaries and an expandable disclosure drawer; (2) **Hearing & Auth Status Capsules (#2547 / `a62f58346e`)**: Merged status capsule UI primitive (`status-capsule.vue`), live hearing status component (`hearing-status.vue`), and cloud sign-in status island; (3) **AIRI Design System Guide (#2689 / `c2ee54a91d`)**: Established canonical `DESIGN.md` design conventions following the Google Labs specification; (4) **Multi-Client Wake Words (#2708)**: Rapidly developed wake-word capability across platforms (+8106/-1103 lines) integrating Sherpaw and browser hearing; (5) **Core Agent Step-Level Settings (#2709)**: Draft PR enabling dynamic provider/model/tool settings resolution across multi-turn tool continuation steps in `core-agent`; (6) **Startup Splash & Loading Screen (#2698)**: Unified resource-loading screen for Web/Pocket tracking initialization prior to avatar rendering; (7) **Hosted Cloud Services & Character Sync (#2692, #2693, #2694)**: Continued work on remote server character contact sync and chat deletion sync; (8) **Dependencies & Maintenance (`a7bb9a3169`, `b40e3e87b1`, `9cfc9a44db`)**: Bumped `@moeru/eventa` to 1.0.2, updated Nix pnpm hashes, and performed automated Crowdin translation cleanups.
* **Discussion & Community Buzz**:
  - 💬 **#2546: `feat(stage-ui): add voice messages and mobile dictation` (+69 new comments, total 77)**: Massive comment surge discussing voice messaging UX, audio capture, and mobile dictation workflows.
  - 💬 **#2458: `feat(stage): add character-owned Live2D controls` (+49 new comments, total 55)**: Major discussion spike on per-character Live2D model controls and motion bindings.
  - 💬 **#2708: `feat(hearing): add character wake words across clients` (35 comments on a new PR)**: High opening velocity on character wake-word detection.
  - 💬 **#2698: `feat(stage): add coordinated splash and loading screens` (31 comments on a new PR)**: Strong interest and review engagement on startup asset sequencing.
  - 💬 **#2695: `fix(stage-ui): keep provider errors compact` (+21 comments)**: Significant discussion resolving chat overflow from verbose provider error responses.
  - 💬 **#2672: `refactor(stage-ui): bind conversations to window-local characters` (+8 new comments, total 48)**: Active architecture debate on window-local character selection; PR moved back to Draft for refinement.
  - 💬 **#2689: `docs(ui): define AIRI design conventions with the DESIGN.md format` (+9 new comments, total 15)**: Alignment on design system conventions leading to merge.
  - 💬 **#2547: `feat(stage-ui): add hearing and sign-in status capsules` (+7 new comments, total 18)**: Review iterations leading to merge.
  - 💬 **#2644: `feat(api): add provider-cost Flux settlement` (+5 new comments, total 36)**: Deliberation on LLM token cost metering and wallet settlements.
  - 🛑 **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` (CLOSED)**: Major Watchlist event: The external Cortico daemon proposal has been officially closed upstream.
* **Cherry-Pick Candidates**:
  - ⭐ **Commit `2e0e963670` (PR #2695): `fix(stage-ui): keep provider errors compact` by @nekomeowww**: High-value, zero-risk UI bug fix. Prevents massive raw provider JSON/400 errors from blowing up the chat UI by showing a 160-char summary and an expandable disclosure drawer (`stage.chat.error-details.show` / `hide`). Adaptable to our `packages/stage-ui/src/components/scenarios/chat/error-item.vue`.
  - ⭐ **Commit `c2ee54a91d` (PR #2689): `docs(ui): define AIRI design conventions with the DESIGN.md format` by @RainbowBird**: Canonical `DESIGN.md` reference document outlining Chromatic hue usage, typography scales, button sizing, and component conventions. Pure documentation; safe to port directly.
  - ⭐ **PR #2703: `fix(stage-pages): add the MiniMax Speech settings page` by @jabarrioss**: Dedicated settings page (`minimax-speech.vue`) and browser tests for MiniMax Speech in `packages/stage-pages`, filling a missing settings route.
  - 🔍 **PR #2707: `chore(deps): bump @moeru/eventa to 1.0.2` by @nekomeowww**: Dependency update to the shared Eventa IPC package.
  - 🔍 **Commit `a62f58346e` (PR #2547): UI Primitives (`status-capsule.vue` & `hearing-status.vue`)**: Clean status capsule component using `@proj-airi/ui` and UnoCSS. Can be selectively ported without the auth island.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **Commit `a62f58346e` Auth logic (PR #2547: `auth-status-island.vue`, `auth.ts`, `use-onboarding-authentication.ts`)**: Hosted cloud authentication and online accounts; conflicts with offline-first local persistence.
    - **PR #2704 (`danmaku style floating chat`) & PR #2702**: Built on top of upstream's legacy stage window and floating chat docked to character; incompatible with our decoupled Control Strip ribbon.
    - **PR #2692, PR #2693, PR #2694, PR #2644 (`server/apps/api/*`)**: Hosted server API infrastructure (message deletion sync, character contact sync, Flux billing) incompatible with client-only architecture.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/components/scenarios/chat/*`**: Upstream relocated chat history items under `chat/components/error-item.vue`, whereas our fork maintains `chat/error-item.vue` with custom session deletion hooks. Any port of PR #2695 must adapt paths and preserve local features.
  - ⚠️ **`apps/stage-tamagotchi/src/main/services/airi/auth.ts` (Commit `a62f58346e`)**: Upstream continues expanding online sign-in and Electron auth callback bridges. Do not merge Electron services wholesale.
  - ⚠️ **`packages/stage-ui/src/stores/modules/hearing.ts`**: Upstream is actively refactoring hearing stores for wake words (#2708) and status capsules (#2547). Protect local audio/speech pipeline stores from remote server assumptions.

### 📋 Upstream Commits
- `b40e3e87b1` chore(nix): update pnpmDeps hash (#2711) [#2711](https://github.com/moeru-ai/airi/pull/2711) _(Weathercold, 2026-09-29)_
- `a7bb9a3169` chore(deps): bump @moeru/eventa to 1.0.2 (#2707) [#2707](https://github.com/moeru-ai/airi/pull/2707) _(Neko, 2026-09-29)_
- `9cfc9a44db` chore(i18n): update translations (#2706) [#2706](https://github.com/moeru-ai/airi/pull/2706) _(github-actions[bot], 2026-09-29)_
- `a62f58346e` feat(stage-ui): add hearing and sign-in status capsules (#2547) [#2547](https://github.com/moeru-ai/airi/pull/2547) _(Neko, 2026-09-29)_
- `991c0a27c8` chore(i18n): update translations (#2688) [#2688](https://github.com/moeru-ai/airi/pull/2688) _(github-actions[bot], 2026-09-29)_
- `2e0e963670` fix(stage-ui): keep provider errors compact (#2695) [#2695](https://github.com/moeru-ai/airi/pull/2695) _(Neko, 2026-09-29)_
- `bea1275f0a` chore(nix): update pnpmDeps hash (#2691) [#2691](https://github.com/moeru-ai/airi/pull/2691) _(Weathercold, 2026-09-28)_
- `c2ee54a91d` docs(ui): define AIRI design conventions with the DESIGN.md format (#2689) [#2689](https://github.com/moeru-ai/airi/pull/2689) _(RainbowBird, 2026-09-28)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 4 file(s) (+321/-0)
- `AGENTS.md` *(+1/-0)*
- `DESIGN.md` *(+240/-0)*
- `docs/ai/context/design-implementation.md` *(+63/-0)*
- `packages/stage-ui/README.md` *(+17/-0)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 13 file(s) (+499/-96)
- `apps/stage-tamagotchi/src/main/services/airi/auth.test.ts` *(+38/-2)*
- `apps/stage-tamagotchi/src/main/services/airi/auth.ts` *(+55/-7)*
- `apps/stage-tamagotchi/src/renderer/bridges/electron-auth-callback.browser.test.ts` *(+73/-0)*
- `apps/stage-tamagotchi/src/renderer/bridges/electron-auth-callback.test.ts` *(+0/-71)*
- `apps/stage-tamagotchi/src/renderer/bridges/electron-auth-callback.ts` *(+36/-3)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/auth-status-island.vue` *(+98/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-onboarding-authentication.test.ts` *(+85/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-onboarding-authentication.ts` *(+40/-9)*
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` *(+15/-3)*
- `apps/stage-tamagotchi/src/renderer/pages/onboarding.vue` *(+3/-0)*
- `apps/stage-tamagotchi/src/renderer/stores/auth-status.ts` *(+10/-0)*
- `apps/stage-tamagotchi/src/renderer/styles/transitions.css` *(+36/-0)*
- `apps/stage-tamagotchi/src/shared/eventa/index.ts` *(+10/-1)*

#### Other / Uncategorized (`🔍 inspect`) — 16 file(s) (+582/-39)
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/provider-inference/src/providers/local/browser-web-speech-api/index.browser.test.ts` *(+25/-0)*
- `packages/provider-inference/src/providers/local/browser-web-speech-api/provider.ts` *(+21/-5)*
- `packages/stage-ui/src/components/scenarios/chat/components/error-item.vue` *(+60/-19)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.browser.test.ts` *(+42/-0)*
- `packages/stage-ui/src/components/scenarios/index.ts` *(+1/-0)*
- `packages/stage-ui/src/components/scenarios/status/hearing-status.vue` *(+108/-0)*
- `packages/stage-ui/src/components/scenarios/status/index.ts` *(+2/-0)*
- `packages/stage-ui/src/components/scenarios/status/status-capsule.browser.test.ts` *(+29/-0)*
- `packages/stage-ui/src/components/scenarios/status/status-capsule.vue` *(+91/-0)*
- `packages/stage-ui/src/stores/modules/hearing-status.browser.test.ts` *(+99/-0)*
- `packages/stage-ui/src/stores/modules/hearing.ts` *(+75/-10)*
- `packages/stage-ui/src/stores/settings/audio-device.ts` *(+23/-3)*
- `packages/stage-ui/src/stores/settings/general.ts` *(+3/-0)*
- `packages/stage-ui/src/stores/settings/index.ts` *(+1/-0)*
- `pnpm-workspace.yaml` *(+1/-1)*

#### Root Build & Tooling (`🔍 inspect`) — 2 file(s) (+28/-28)
- `packages/electron-screen-capture/package.json` *(+1/-1)*
- `pnpm-lock.yaml` *(+27/-27)*

#### Localization (i18n) (`📦 import (additive only)`) — 56 file(s) (+50/-8507)
- `packages/i18n/src/locales/en/settings.yaml` *(+4/-0)*
- `packages/i18n/src/locales/en/stage.yaml` *(+18/-0)*
- `packages/i18n/src/locales/es/base.yaml` *(+0/-32)*
- `packages/i18n/src/locales/es/docs/theme.yaml` *(+0/-2)*
- `packages/i18n/src/locales/es/server/auth.yaml` *(+0/-4)*
- `packages/i18n/src/locales/es/settings.yaml` *(+1/-396)*
- `packages/i18n/src/locales/es/stage.yaml` *(+0/-67)*
- `packages/i18n/src/locales/es/tamagotchi/settings.yaml` *(+0/-442)*
- `packages/i18n/src/locales/es/tamagotchi/stage.yaml` *(+0/-23)*
- `packages/i18n/src/locales/fr/base.yaml` *(+0/-32)*
- `packages/i18n/src/locales/fr/docs/theme.yaml` *(+0/-3)*
- `packages/i18n/src/locales/fr/docs/versions.yaml` *(+0/-1)*
- `packages/i18n/src/locales/fr/server/auth.yaml` *(+0/-3)*
- `packages/i18n/src/locales/fr/settings.yaml` *(+1/-972)*
- `packages/i18n/src/locales/fr/stage.yaml` *(+0/-61)*
- `packages/i18n/src/locales/fr/tamagotchi/settings.yaml` *(+0/-442)*
- `packages/i18n/src/locales/fr/tamagotchi/stage.yaml` *(+0/-20)*
- `packages/i18n/src/locales/ja/base.yaml` *(+0/-32)*
- `packages/i18n/src/locales/ja/server/auth.yaml` *(+0/-6)*
- `packages/i18n/src/locales/ja/settings.yaml` *(+1/-300)*
- `packages/i18n/src/locales/ja/stage.yaml` *(+0/-66)*
- `packages/i18n/src/locales/ja/tamagotchi/settings.yaml` *(+0/-407)*
- `packages/i18n/src/locales/ja/tamagotchi/stage.yaml` *(+0/-17)*
- `packages/i18n/src/locales/ko/base.yaml` *(+0/-31)*
- `packages/i18n/src/locales/ko/server/auth.yaml` *(+0/-157)*
- `packages/i18n/src/locales/ko/settings.yaml` *(+1/-996)*
- `packages/i18n/src/locales/ko/stage.yaml` *(+0/-88)*
- `packages/i18n/src/locales/ko/tamagotchi/settings.yaml` *(+0/-442)*
- `packages/i18n/src/locales/ko/tamagotchi/stage.yaml` *(+0/-26)*
- `packages/i18n/src/locales/ru/base.yaml` *(+0/-31)*
- `packages/i18n/src/locales/ru/server/auth.yaml` *(+0/-7)*
- `packages/i18n/src/locales/ru/settings.yaml` *(+1/-278)*
- `packages/i18n/src/locales/ru/stage.yaml` *(+0/-36)*
- `packages/i18n/src/locales/ru/tamagotchi/settings.yaml` *(+0/-399)*
- `packages/i18n/src/locales/ru/tamagotchi/stage.yaml` *(+0/-19)*
- `packages/i18n/src/locales/vi/base.yaml` *(+0/-32)*
- `packages/i18n/src/locales/vi/docs/theme.yaml` *(+0/-2)*
- `packages/i18n/src/locales/vi/server/auth.yaml` *(+0/-5)*
- `packages/i18n/src/locales/vi/settings.yaml` *(+1/-300)*
- `packages/i18n/src/locales/vi/stage.yaml` *(+0/-60)*
- `packages/i18n/src/locales/vi/tamagotchi/settings.yaml` *(+0/-406)*
- `packages/i18n/src/locales/vi/tamagotchi/stage.yaml` *(+0/-20)*
- `packages/i18n/src/locales/zh-Hans/docs/theme.yaml` *(+0/-2)*
- `packages/i18n/src/locales/zh-Hans/server/auth.yaml` *(+0/-3)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+4/-213)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+17/-8)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/settings.yaml` *(+0/-387)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/stage.yaml` *(+0/-2)*
- `packages/i18n/src/locales/zh-Hant/base.yaml` *(+0/-31)*
- `packages/i18n/src/locales/zh-Hant/docs/theme.yaml` *(+0/-1)*
- `packages/i18n/src/locales/zh-Hant/server/auth.yaml` *(+0/-194)*
- `packages/i18n/src/locales/zh-Hant/settings.yaml` *(+1/-791)*
- `packages/i18n/src/locales/zh-Hant/stage.yaml` *(+0/-66)*
- `packages/i18n/src/locales/zh-Hant/tamagotchi/electron/tray.yaml` *(+0/-1)*
- `packages/i18n/src/locales/zh-Hant/tamagotchi/settings.yaml` *(+0/-74)*
- `packages/i18n/src/locales/zh-Hant/tamagotchi/stage.yaml` *(+0/-71)*

#### Stage Layouts & Shells (`🔍 inspect`) — 2 file(s) (+4/-3)
- `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` *(+3/-2)*
- `packages/stage-layouts/src/composables/use-transcriptions.ts` *(+1/-1)*

#### UI Primitives & Pages (`📦 import / inspect`) — 1 file(s) (+8/-0)
- `packages/stage-pages/src/components/settings-general-fields.vue` *(+8/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (15)
- [#2711](https://github.com/moeru-ai/airi/pull/2711) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2707](https://github.com/moeru-ai/airi/pull/2707) `chore(deps): bump @moeru/eventa to 1.0.2` by **@nekomeowww** *(5 comments)*
- [#2708](https://github.com/moeru-ai/airi/pull/2708) `feat(hearing): add character wake words across clients` by **@nekomeowww** *(35 comments)*
- [#2709](https://github.com/moeru-ai/airi/pull/2709) `feat(core-agent): refresh provider settings across tool steps` by **@nekomeowww** *(Draft)* *(0 comments)*
- [#2706](https://github.com/moeru-ai/airi/pull/2706) `chore(i18n): update translations` by **@github-actions** *(3 comments)*
- [#2698](https://github.com/moeru-ai/airi/pull/2698) `feat(stage): add coordinated splash and loading screens` by **@nekomeowww** *(31 comments)*
- [#2704](https://github.com/moeru-ai/airi/pull/2704) `feat(stage-tamagotchi): add a danmaku style to the floating chat` by **@chiba233** *(1 comments)*
- [#2703](https://github.com/moeru-ai/airi/pull/2703) `fix(stage-pages): add the MiniMax Speech settings page` by **@jabarrioss** *(0 comments)*
- [#2702](https://github.com/moeru-ai/airi/pull/2702) `chore(stage-tamagotchi): clarify the chat window resize and fold icons` by **@chiba233** *(1 comments)*
- [#2692](https://github.com/moeru-ai/airi/pull/2692) `fix(api-server): sync chat message deletions across devices` by **@chiba233** *(1 comments)*
- [#2696](https://github.com/moeru-ai/airi/pull/2696) `feat(inference): manage Sherpaw model assets across hosts` by **@nekomeowww** *(11 comments)*
- [#2693](https://github.com/moeru-ai/airi/pull/2693) `feat(api-server): add contact-owned character synchronization` by **@luoling8192** *(Draft)* *(1 comments)*
- [#2694](https://github.com/moeru-ai/airi/pull/2694) `feat(stage-ui): synchronize character contacts and direct histories` by **@luoling8192** *(Draft)* *(1 comments)*
- [#2700](https://github.com/moeru-ai/airi/pull/2700) `feat(stage-tamagotchi): add tray-only app icon setting` by **@luoling8192** *(1 comments)*
- [#2695](https://github.com/moeru-ai/airi/pull/2695) `fix(stage-ui): keep provider errors compact` by **@nekomeowww** *(21 comments)*

#### 🔄 PR Status & Lifecycle Changes (8)
- [#2547](https://github.com/moeru-ai/airi/pull/2547) `feat(stage-ui): add hearing and sign-in status capsules` — `OPEN` ➔ `MERGED`
- [#2688](https://github.com/moeru-ai/airi/pull/2688) `chore(i18n): update translations` — `OPEN` ➔ `MERGED`
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` — ➔ `Draft`
- [#2679](https://github.com/moeru-ai/airi/pull/2679) `docs: update development setup guide` — `Draft` ➔ `Ready`
- [#2677](https://github.com/moeru-ai/airi/pull/2677) `feat(provider-inference): add Chutes chat, speech, and transcription providers` — `OPEN` ➔ `CLOSED`
- [#2691](https://github.com/moeru-ai/airi/pull/2691) `chore(nix): update pnpmDeps hash` — `OPEN` ➔ `MERGED`
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` — `OPEN` ➔ `CLOSED`
- [#2689](https://github.com/moeru-ai/airi/pull/2689) `docs(ui): define AIRI design conventions with the DESIGN.md format` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (9)
- [#2546](https://github.com/moeru-ai/airi/pull/2546) `feat(stage-ui): add voice messages and mobile dictation` — *+69 comments (8 ➔ 77 total)*
- [#2458](https://github.com/moeru-ai/airi/pull/2458) `feat(stage): add character-owned Live2D controls` — *+49 comments (6 ➔ 55 total)*
- [#2547](https://github.com/moeru-ai/airi/pull/2547) `feat(stage-ui): add hearing and sign-in status capsules` — *+7 comments (11 ➔ 18 total)*
- [#2688](https://github.com/moeru-ai/airi/pull/2688) `chore(i18n): update translations` — *+1 comments (4 ➔ 5 total)*
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` — *+8 comments (40 ➔ 48 total)*
- [#2667](https://github.com/moeru-ai/airi/pull/2667) `fix(stage-tamagotchi): isolate Eventa IPC contexts by window` — *+1 comments (2 ➔ 3 total)*
- [#2644](https://github.com/moeru-ai/airi/pull/2644) `feat(api): add provider-cost Flux settlement` — *+5 comments (31 ➔ 36 total)*
- [#2679](https://github.com/moeru-ai/airi/pull/2679) `docs: update development setup guide` — *+1 comments (2 ➔ 3 total)*
- [#2689](https://github.com/moeru-ai/airi/pull/2689) `docs(ui): define AIRI design conventions with the DESIGN.md format` — *+9 comments (6 ➔ 15 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(1 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` [Draft] — 🚨 **+8 comments** (48 total)
  - *Focus*: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard

---
## [2026-09-28] Upstream Delta: `07ed52e3..1828bdc0` (13 commits, 233 files, 33 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 13 commits (`1828bdc028`, `2155df934b`, `dc950cc89c`, `5d46ee8634`, `72d1499d38`, `29cf656f41`, `d16a278942`, `584a235e43`, `a7aed90cc1`, `49c15a6df2`, `81ae494724`, `2feea5ad3d`, `b4289d3401`) across 233 files, accompanied by 33 PR updates (18 new PRs, 8 status changes, 7 discussion changes). Key focus areas: (1) **Sherpaw Speech Recognition Across Apps (#2550 / `2155df934b`)**: Merged offline speech recognition using WebWorker runtime, Vite asset packaging (`vite-plugin-sherpaw`), and Electron asset protocol (`airi-sherpaw://assets/`); (2) **Floating Chat Window Beside Character (#2663 / `49c15a6df2`)**: Merged an auxiliary floating chat window docked to the stage character with click-through and draft handover, wired through the legacy controls-island; (3) **Plugin SDK Activation Planner (#2572 / `29cf656f41`)**: Merged Phase 2 of the plugin system roadmap implementing deterministic provider-first activation / consumer-first deactivation; (4) **Stage Canvas Sizing Fix (#2658 / `81ae494724`)**: Simplified `Screen.vue` by switching to `useElementSize`, preventing Live2D jump artifacts on resize; (5) **Main Process i18n Fallback (#2686 / `72d1499d38`)**: Added missing `fallbackLocale: 'en'` to Electron main process i18n to prevent raw key path display in the tray menu; (6) **Nix Tooling (#2690 / `1828bdc028`)**: Updated Nix packaging assets hash; and (7) **Hosted API Settlements & Tracking (#2674, #2675, #2644)**: Active development on hosted server infrastructure, including Apple sandbox IAP fixes (#2674), LLM prompt/completion retention (#2675), and Flux cost billing (#2644).
* **Discussion & Community Buzz**:
  - 💬 **#2672: `refactor(stage-ui): bind conversations to window-local characters` (+20 new comments, 40 total)**: Watched PR experiencing substantial discussion velocity around decoupling character selection and conversation scoping per window.
  - 💬 **#2121: `chore(i18n): update translations` (+15 new comments, 142 total)**: Heavy Crowdin sync activity and validation scripting.
  - 💬 **#2644: `feat(api): add provider-cost Flux settlement` (+8 new comments, 31 total)**: Ongoing discussion on normalized LLM cost metering, OpenRouter pricing, and wallet locking.
  - 💬 **#2675: `feat(api): store LLM request and error content` (8 total comments)**: Deliberation on database schema migration coordination and diagnostic payload retention.
  - 💬 **#2550: `feat(hearing): add Sherpaw recognition across apps` (+2 new comments, 19 total)**: Final review iterations leading up to merge.
  - 💬 **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` (+1 new comment, 1 total)**: Automated preview deployment trigger; maintainers (@luoling8192, @nekomeowww) have still not officially commented on the external daemon architecture.
  - 💬 **#2667: `fix(stage-tamagotchi): isolate Eventa IPC contexts by window` (+1 new comment, 2 total)**: Multi-window Eventa IPC isolation review.
* **Cherry-Pick Candidates**:
  - ⭐ **Commit `72d1499d38` (PR #2686): `fix(stage-tamagotchi): fall back to English for missing main-process strings` by @chiba233**: High-priority, zero-risk 1-line bug fix. Electron main process `createI18n` lacked `fallbackLocale: 'en'`, exposing raw translation key paths in the system tray menu when keys were untranslated. Our fork currently lacks this fallback.
  - ⭐ **PR #2677: `feat(provider-inference): add Chutes chat, speech, and transcription providers` by @Pietro00x**: Portable third-party client provider supporting chat (with thinking/reasoning kwargs), Kokoro/Qwen3-TTS, and Whisper/Parakeet STT via AudioDojo. Zero backend server dependencies; cleanly fits into our `packages/provider-inference` registry and provider stores.
  - 🔍 **Commit `2155df934b` (PR #2550): `feat(hearing): add Sherpaw recognition across apps` by @RainbowBird**: Major offline speech recognition capability using WASM/WebWorker and bundled/remote model distribution. Worth evaluating against our existing local inference stack.
  - 🔍 **PR #2689: `docs(ui): document existing component design conventions` by @luoling8192**: Source-backed design guide for `packages/ui` components, button hierarchy, control sizes, drawers, and animations.
  - 🔍 **PR #2667: `fix(stage-tamagotchi): isolate Eventa IPC contexts by window` by @jim139129**: Desktop IPC safety patch preventing cross-window Eventa listener leakage via `onlySameWindow: true`.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **Commit `49c15a6df2` / PR #2663 (`feat(stage-tamagotchi): add a floating chat window beside the character`)**: Upstream's floating chat is built around the legacy monolithic `controls-island` inside the stage window. Our fork already decoupled the desktop into the Actor Stage (`windows/stage`) and the floating Control Strip (`windows/main`) with integrated desktop chatbox (`airi-desktop-chatbox`). Do not port.
    - **PR #2681 (`feat(stage-tamagotchi): hide the controls island while the cursor is away`)**: Modifies deprecated `controls-island`.
    - **Commits `b4289d3401` (#2674), PR #2675, PR #2644 (`server/apps/api/*`)**: Hosted server API infrastructure (Apple IAP billing, Postgres LLM payload storage, Flux credit settlements) directly conflicting with our client-only, zero-account architecture.
* **Divergence / Collision Warnings**:
  - ⚠️ **`apps/stage-tamagotchi/src/main/windows/*` and `controls-island/*` (Commit `49c15a6df2`)**: Massive diff (+3286/-172) touching 46 files for floating chat placement and IPC. Our desktop architecture is completely decoupled; do not cherry-pick or rebase window lifecycles or controls-island components.
  - ⚠️ **`packages/stage-ui/src/stores/providers/*` and `hearing.ts` (Commit `2155df934b`)**: Upstream introduced Sherpaw provider definitions and store modifications. In our fork, provider instances are persisted locally in `providersStore` (`providersRepo`). Hand-merge only.
  - ⚠️ **`server/apps/api/*` (PR #2675, PR #2644)**: Growing hosted backend divergence with pending migration collisions between request logging and Flux billing.

### 📋 Upstream Commits
- `1828bdc028` chore(nix): update assets hash (#2690) [#2690](https://github.com/moeru-ai/airi/pull/2690) _(Weathercold, 2026-09-28)_
- `2155df934b` feat(hearing): add Sherpaw recognition across apps (#2550) [#2550](https://github.com/moeru-ai/airi/pull/2550) _(RainbowBird, 2026-09-28)_
- `dc950cc89c` chore(i18n): update translations (#2121) [#2121](https://github.com/moeru-ai/airi/pull/2121) _(github-actions[bot], 2026-09-28)_
- `5d46ee8634` chore(ci): check Crowdin exports (#2684) [#2684](https://github.com/moeru-ai/airi/pull/2684) _(蓝莓🫐, 2026-09-28)_
- `72d1499d38` fix(stage-tamagotchi): fall back to English for missing main-process strings (#2686) [#2686](https://github.com/moeru-ai/airi/pull/2686) _(蓝莓🫐, 2026-09-28)_
- `29cf656f41` feat(plugin-host): add activation planner (#2572) [#2572](https://github.com/moeru-ai/airi/pull/2572) _(leafyy, 2026-09-28)_
- `d16a278942` fix(i18n): translate the zh-Hant strings that Crowdin misplaced (#2683) [#2683](https://github.com/moeru-ai/airi/pull/2683) _(蓝莓🫐, 2026-09-28)_
- `584a235e43` chore(docs): update Minecraft integration guide (#2465) [#2465](https://github.com/moeru-ai/airi/pull/2465) _(jim139129, 2026-09-28)_
- `a7aed90cc1` docs(ko): sync Korean docs with English changes since the last sync (#2680) [#2680](https://github.com/moeru-ai/airi/pull/2680) _(mullung, 2026-09-28)_
- `49c15a6df2` feat(stage-tamagotchi): add a floating chat window beside the character (#2663) [#2663](https://github.com/moeru-ai/airi/pull/2663) _(蓝莓🫐, 2026-09-28)_
- `81ae494724` fix(ui): size the stage canvas from the Screen box alone (#2658) [#2658](https://github.com/moeru-ai/airi/pull/2658) _(蓝莓🫐, 2026-09-28)_
- `2feea5ad3d` docs(AGENTS.md): perform housekeeping on agent-facing docs (#2678) [#2678](https://github.com/moeru-ai/airi/pull/2678) _(Makito, 2026-09-28)_
- `b4289d3401` fix(api): allow Apple sandbox purchases for dedicated test accounts (#2674) [#2674](https://github.com/moeru-ai/airi/pull/2674) _(Hatsune Miku, 2026-09-27)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 35 file(s) (+1821/-616)
- `.agents/skills/enforce-rules-for-pinia-synced/SKILL.md` *(+39/-0)*
- `.agents/skills/enforce-rules-for-typescript/SKILL.md` *(+154/-0)*
- `.agents/skills/enforce-rules-for-unocss/SKILL.md` *(+1/-1)*
- `.agents/skills/enforce-rules-for-vitest/SKILL.md` *(+34/-16)*
- `.github/copilot-instructions.md` *(+1/-1)*
- `.github/scripts/check-locales.test.ts` *(+228/-0)*
- `.github/scripts/check-locales.ts` *(+306/-0)*
- `.github/workflows/crowdin-cron-sync.yml` *(+105/-8)*
- `.github/workflows/crowdin-manual-upload.yml` *(+11/-2)*
- `.github/workflows/crowdin-upload-on-change.yml` *(+45/-0)*
- `.github/workflows/i18n-locale-check.yml` *(+36/-0)*
- `.github/workflows/release-tamagotchi-steam.yml` *(+3/-0)*
- `.github/workflows/release-tamagotchi.yml` *(+1/-0)*
- `AGENTS.md` *(+146/-341)*
- `docs/README.ko-KR.md` *(+11/-1)*
- `docs/ai/adr/2026-09-22-sherpaw-model-assets.md` *(+76/-0)*
- `docs/content/en/docs/integrations/minecraft.md` *(+32/-7)*
- `docs/content/ko/about/privacy.md` *(+0/-1)*
- `docs/content/ko/about/terms.md` *(+0/-1)*
- `docs/content/ko/blog/DevLog-2025.05.16/index.md` *(+0/-1)*
- `docs/content/ko/docs/contributing/index.md` *(+24/-13)*
- `docs/content/ko/docs/manual/config/common.md` *(+1/-1)*
- `docs/content/ko/docs/manual/config/providers/consciousness/lm-studio.md` *(+9/-3)*
- `docs/content/ko/docs/manual/config/providers/transcription/comet-api.md` *(+4/-3)*
- `docs/content/ko/references/research/live2d-recording-curve-fitting.md` *(+177/-0)*
- `docs/content/zh-Hans/docs/integrations/minecraft.md` *(+37/-2)*
- `packages/model-driver-mediapipe/AGENTS.md` *(+5/-5)*
- `packages/model-driver-mediapipe/CLAUDE.md` *(+1/-0)*
- `packages/plugin-sdk/README.md` *(+6/-2)*
- `packages/provider-inference/README.md` *(+7/-0)*
- `packages/stage-ui/README.md` *(+19/-0)*
- `packages/vite-plugin-sherpaw/README.md` *(+84/-0)*
- `services/computer-use-mcp/AGENTS.md` *(+4/-207)*
- `services/computer-use-mcp/CLAUDE.md` *(+1/-0)*
- `services/computer-use-mcp/terminal-lane-status.md` *(+213/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 48 file(s) (+2820/-147)
- `.agents/skills/enforce-rules-for-pinia-synced/agents/openai.yaml` *(+4/-0)*
- `.agents/skills/enforce-rules-for-typescript/agents/openai.yaml` *(+4/-0)*
- `.gitignore` *(+4/-0)*
- `nix/assets-hash.txt` *(+1/-1)*
- `packages/electron-vueuse/src/main/renderer-loop.ts` *(+29/-3)*
- `packages/plugin-sdk/src/plugin-host/activation-plan.test.ts` *(+831/-0)*
- `packages/plugin-sdk/src/plugin-host/activation-plan.ts` *(+582/-0)*
- `packages/plugin-sdk/src/plugin-host/api.ts` *(+4/-0)*
- `packages/plugin-sdk/src/plugin-host/core.test.ts` *(+78/-1)*
- `packages/plugin-sdk/src/plugin-host/index.ts` *(+1/-3)*
- `packages/plugin-sdk/src/plugin-host/runtimes/node/index.ts` *(+1/-3)*
- `packages/plugin-sdk/src/plugin-host/runtimes/web/index.ts` *(+1/-3)*
- `packages/plugin-sdk/src/plugin-host/shared/types.ts` *(+2/-2)*
- `packages/provider-inference/src/index.ts` *(+3/-0)*
- `packages/provider-inference/src/providers/local/sherpaw-transcription/index.test.ts` *(+92/-0)*
- `packages/provider-inference/src/providers/local/sherpaw-transcription/index.ts` *(+110/-0)*
- `packages/provider-inference/src/providers/local/sherpaw-transcription/models.test.ts` *(+50/-0)*
- `packages/provider-inference/src/providers/local/sherpaw-transcription/models.ts` *(+147/-0)*
- `packages/provider-inference/src/providers/local/sherpaw-transcription/runtime.ts` *(+127/-0)*
- `packages/provider-inference/src/providers/local/sherpaw-transcription/transcript.test.ts` *(+19/-0)*
- `packages/provider-inference/src/providers/local/sherpaw-transcription/transcript.ts` *(+37/-0)*
- `packages/provider-inference/src/types.ts` *(+10/-0)*
- `packages/provider-inference/tsdown.config.ts` *(+1/-1)*
- `packages/stage-ui/src/components/scenarios/chat/components/assistant-item.vue` *(+15/-5)*
- `packages/stage-ui/src/components/scenarios/chat/components/chat-history-scroll-container.vue` *(+7/-3)*
- `packages/stage-ui/src/components/scenarios/chat/components/error-item.vue` *(+15/-7)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.vue` *(+19/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/user-item.vue` *(+15/-5)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding.browser.test.ts` *(+3/-1)*
- `packages/stage-ui/src/libs/inference/cache-utils.browser.test.ts` *(+27/-0)*
- `packages/stage-ui/src/libs/inference/cache-utils.ts` *(+56/-23)*
- `packages/stage-ui/src/libs/inference/index.ts` *(+11/-60)*
- `packages/stage-ui/src/libs/providers/providers/index.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/providers/providers/provider-definitions.test.ts` *(+11/-0)*
- `packages/stage-ui/src/libs/providers/providers/registry.ts` *(+3/-1)*
- `packages/stage-ui/src/libs/providers/providers/sherpaw/hearing-settings.vue` *(+96/-0)*
- `packages/stage-ui/src/libs/providers/providers/sherpaw/index.ts` *(+34/-0)*
- `packages/stage-ui/src/libs/providers/providers/sherpaw/model-resources.ts` *(+12/-0)*
- `packages/stage-ui/src/libs/providers/stream-transcription/index.ts` *(+2/-9)*
- `packages/stage-ui/src/stores/modules/hearing.ts` *(+28/-15)*
- `packages/testing-audio/src/describe.ts` *(+4/-1)*
- `packages/vite-plugin-sherpaw/src/assets.ts` *(+13/-0)*
- `packages/vite-plugin-sherpaw/src/index.test.ts` *(+181/-0)*
- `packages/vite-plugin-sherpaw/src/index.ts` *(+93/-0)*
- `packages/vite-plugin-sherpaw/tsdown.config.ts` *(+13/-0)*
- `packages/vite-plugin-sherpaw/vitest.config.ts` *(+5/-0)*
- `pnpm-workspace.yaml` *(+10/-0)*
- `vitest.config.ts` *(+8/-0)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 5 file(s) (+21/-2)
- `apps/stage-pocket/README.md` *(+5/-0)*
- `apps/stage-pocket/package.json` *(+2/-0)*
- `apps/stage-pocket/vite.config.ts` *(+3/-0)*
- `apps/stage-web/package.json` *(+2/-0)*
- `apps/stage-web/vite.config.ts` *(+9/-2)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 56 file(s) (+5396/-306)
- `apps/stage-tamagotchi/electron.vite.config.ts` *(+17/-0)*
- `apps/stage-tamagotchi/package.json` *(+2/-0)*
- `apps/stage-tamagotchi/src/main/index.ts` *(+18/-10)*
- `apps/stage-tamagotchi/src/main/libs/bootkit/lifecycle.test.ts` *(+36/-0)*
- `apps/stage-tamagotchi/src/main/libs/bootkit/lifecycle.ts` *(+26/-17)*
- `apps/stage-tamagotchi/src/main/libs/electron/window-manager/reusable.test.ts` *(+68/-0)*
- `apps/stage-tamagotchi/src/main/libs/electron/window-manager/reusable.ts` *(+30/-2)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/examples/README.md` *(+10/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/examples/activation-planner-consumer/README.md` *(+16/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/examples/activation-planner-consumer/activation-planner-consumer.mjs` *(+13/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/examples/activation-planner-consumer/extension.airi.json` *(+24/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/examples/activation-planner-provider/README.md` *(+16/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/examples/activation-planner-provider/activation-planner-provider.mjs` *(+13/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/examples/activation-planner-provider/extension.airi.json` *(+25/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/features/static-assets/index.test.ts` *(+59/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/features/static-assets/index.ts` *(+109/-15)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/debug.ts` *(+12/-5)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/index.ts` *(+414/-122)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/managed-sessions.test.ts` *(+34/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/managed-sessions.ts` *(+181/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/index.test.ts` *(+1183/-22)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/kits/index.test.ts` *(+25/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/kits/index.ts` *(+48/-4)*
- `apps/stage-tamagotchi/src/main/services/electron/powerMonitor.ts` *(+10/-2)*
- `apps/stage-tamagotchi/src/main/services/electron/screen.ts` *(+7/-2)*
- `apps/stage-tamagotchi/src/main/services/electron/sherpaw-model-assets.test.ts` *(+46/-0)*
- `apps/stage-tamagotchi/src/main/services/electron/sherpaw-model-assets.ts` *(+40/-0)*
- `apps/stage-tamagotchi/src/main/services/electron/window.ts` *(+7/-2)*
- `apps/stage-tamagotchi/src/main/windows/caption/index.ts` *(+1/-6)*
- `apps/stage-tamagotchi/src/main/windows/chat/floating-placement.test.ts` *(+139/-0)*
- `apps/stage-tamagotchi/src/main/windows/chat/floating-placement.ts` *(+124/-0)*
- `apps/stage-tamagotchi/src/main/windows/chat/floating.ts` *(+515/-0)*
- `apps/stage-tamagotchi/src/main/windows/chat/index.ts` *(+239/-18)*
- `apps/stage-tamagotchi/src/main/windows/chat/mode-switch.test.ts` *(+182/-0)*
- `apps/stage-tamagotchi/src/main/windows/chat/mode-switch.ts` *(+127/-0)*
- `apps/stage-tamagotchi/src/main/windows/chat/rpc/index.electron.ts` *(+4/-8)*
- `apps/stage-tamagotchi/src/main/windows/main/index.ts` *(+2/-1)*
- `apps/stage-tamagotchi/src/main/windows/main/rpc/index.electron.ts` *(+16/-4)*
- `apps/stage-tamagotchi/src/main/windows/shared/window.test.ts` *(+19/-1)*
- `apps/stage-tamagotchi/src/main/windows/shared/window.ts` *(+19/-6)*
- `apps/stage-tamagotchi/src/main/windows/spotlight/index.ts` *(+3/-7)*
- `apps/stage-tamagotchi/src/renderer/App.vue` *(+3/-1)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+105/-1)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+129/-12)*
- `apps/stage-tamagotchi/src/renderer/components/chat-window/chat-speech-mute-button.vue` *(+40/-0)*
- `apps/stage-tamagotchi/src/renderer/components/chat-window/chat-window-style-menu.browser.test.ts` *(+128/-0)*
- `apps/stage-tamagotchi/src/renderer/components/chat-window/chat-window-style-menu.vue` *(+163/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-chat-draft-handover.browser.test.ts` *(+60/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-chat-draft-handover.ts` *(+43/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-chat-floating-click-through.browser.test.ts` *(+195/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-chat-floating-click-through.ts` *(+154/-0)*
- `apps/stage-tamagotchi/src/renderer/index.html` *(+1/-1)*
- `apps/stage-tamagotchi/src/renderer/pages/chat-floating.vue` *(+327/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/chat.vue` *(+11/-34)*
- `apps/stage-tamagotchi/src/shared/eventa/index.ts` *(+139/-3)*
- `apps/stage-tamagotchi/src/shared/utils/electron/display.ts` *(+19/-0)*

#### Deprecated Surfaces (Control Island) (`⚪ ignore / rejected in fork (decoupled into Control Strip)`) — 2 file(s) (+63/-15)
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-chat-button.vue` *(+61/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/index.vue` *(+2/-15)*

#### Localization (i18n) (`📦 import (additive only)`) — 59 file(s) (+7180/-2899)
- `packages/i18n/AGENTS.md` *(+34/-0)*
- `packages/i18n/CLAUDE.md` *(+1/-0)*
- `packages/i18n/glossary/terms.yaml` *(+1/-1)*
- `packages/i18n/src/locales/en/settings.yaml` *(+10/-0)*
- `packages/i18n/src/locales/en/tamagotchi/stage.yaml` *(+12/-0)*
- `packages/i18n/src/locales/es/base.yaml` *(+37/-6)*
- `packages/i18n/src/locales/es/server/auth.yaml` *(+5/-2)*
- `packages/i18n/src/locales/es/settings.yaml` *(+388/-414)*
- `packages/i18n/src/locales/es/stage.yaml` *(+58/-0)*
- `packages/i18n/src/locales/es/tamagotchi/electron/tray.yaml` *(+1/-1)*
- `packages/i18n/src/locales/es/tamagotchi/settings.yaml` *(+440/-0)*
- `packages/i18n/src/locales/es/tamagotchi/stage.yaml` *(+16/-3)*
- `packages/i18n/src/locales/fr/base.yaml` *(+31/-0)*
- `packages/i18n/src/locales/fr/server/auth.yaml` *(+3/-0)*
- `packages/i18n/src/locales/fr/settings.yaml` *(+295/-314)*
- `packages/i18n/src/locales/fr/stage.yaml` *(+58/-0)*
- `packages/i18n/src/locales/fr/tamagotchi/settings.yaml` *(+440/-0)*
- `packages/i18n/src/locales/fr/tamagotchi/stage.yaml` *(+15/-2)*
- `packages/i18n/src/locales/ja/base.yaml` *(+31/-0)*
- `packages/i18n/src/locales/ja/docs/theme.yaml` *(+1/-1)*
- `packages/i18n/src/locales/ja/server/auth.yaml` *(+140/-137)*
- `packages/i18n/src/locales/ja/settings.yaml` *(+805/-695)*
- `packages/i18n/src/locales/ja/stage.yaml` *(+65/-7)*
- `packages/i18n/src/locales/ja/tamagotchi/settings.yaml` *(+440/-0)*
- `packages/i18n/src/locales/ja/tamagotchi/stage.yaml` *(+46/-33)*
- `packages/i18n/src/locales/ko/base.yaml` *(+31/-0)*
- `packages/i18n/src/locales/ko/docs/theme.yaml` *(+2/-2)*
- `packages/i18n/src/locales/ko/docs/versions.yaml` *(+1/-1)*
- `packages/i18n/src/locales/ko/server/auth.yaml` *(+3/-0)*
- `packages/i18n/src/locales/ko/settings.yaml` *(+290/-196)*
- `packages/i18n/src/locales/ko/stage.yaml` *(+61/-3)*
- `packages/i18n/src/locales/ko/tamagotchi/settings.yaml` *(+440/-0)*
- `packages/i18n/src/locales/ko/tamagotchi/stage.yaml` *(+15/-2)*
- `packages/i18n/src/locales/ru/base.yaml` *(+31/-0)*
- `packages/i18n/src/locales/ru/server/auth.yaml` *(+3/-0)*
- `packages/i18n/src/locales/ru/settings.yaml` *(+316/-294)*
- `packages/i18n/src/locales/ru/stage.yaml` *(+58/-0)*
- `packages/i18n/src/locales/ru/tamagotchi/settings.yaml` *(+440/-0)*
- `packages/i18n/src/locales/ru/tamagotchi/stage.yaml` *(+15/-2)*
- `packages/i18n/src/locales/vi/base.yaml` *(+31/-0)*
- `packages/i18n/src/locales/vi/docs/theme.yaml` *(+1/-1)*
- `packages/i18n/src/locales/vi/server/auth.yaml` *(+5/-2)*
- `packages/i18n/src/locales/vi/settings.yaml` *(+479/-436)*
- `packages/i18n/src/locales/vi/stage.yaml` *(+58/-0)*
- `packages/i18n/src/locales/vi/tamagotchi/electron/tray.yaml` *(+1/-1)*
- `packages/i18n/src/locales/vi/tamagotchi/settings.yaml` *(+442/-2)*
- `packages/i18n/src/locales/vi/tamagotchi/stage.yaml` *(+27/-14)*
- `packages/i18n/src/locales/zh-Hans/base.yaml` *(+0/-1)*
- `packages/i18n/src/locales/zh-Hans/server/auth.yaml` *(+3/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+149/-102)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+10/-11)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/settings.yaml` *(+382/-0)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/stage.yaml` *(+11/-2)*
- `packages/i18n/src/locales/zh-Hant/base.yaml` *(+31/-0)*
- `packages/i18n/src/locales/zh-Hant/server/auth.yaml` *(+3/-0)*
- `packages/i18n/src/locales/zh-Hant/settings.yaml` *(+324/-209)*
- `packages/i18n/src/locales/zh-Hant/stage.yaml` *(+58/-0)*
- `packages/i18n/src/locales/zh-Hant/tamagotchi/settings.yaml` *(+71/-0)*
- `packages/i18n/src/locales/zh-Hant/tamagotchi/stage.yaml` *(+15/-2)*

#### Root Build & Tooling (`🔍 inspect`) — 5 file(s) (+190/-0)
- `packages/provider-inference/package.json` *(+6/-0)*
- `packages/stage-ui/package.json` *(+2/-0)*
- `packages/vite-plugin-sherpaw/package.json` *(+40/-0)*
- `packages/vite-plugin-sherpaw/tsconfig.json` *(+15/-0)*
- `pnpm-lock.yaml` *(+127/-0)*

#### UI Primitives & Pages (`📦 import / inspect`) — 2 file(s) (+19/-70)
- `packages/stage-pages/src/pages/settings/modules/hearing.vue` *(+12/-8)*
- `packages/ui/src/components/layouts/screen.vue` *(+7/-62)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 2 file(s) (+69/-5)
- `packages/stage-ui/src/components/scenes/Stage.vue` *(+5/-5)*
- `packages/stage-ui/src/components/scenes/screen-size.browser.test.ts` *(+64/-0)*

#### Provider & Model Integrations (`📦 import / inspect`) — 2 file(s) (+34/-2)
- `packages/stage-ui/src/stores/providers/provider.test.ts` *(+22/-0)*
- `packages/stage-ui/src/stores/providers/provider.ts` *(+12/-2)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 17 file(s) (+596/-95)
- `server/CLAUDE.md` *(+1/-0)*
- `server/apps/api/AGENTS.md` *(+56/-0)*
- `server/apps/api/CLAUDE.md` *(+1/-56)*
- `server/apps/api/README.md` *(+42/-0)*
- `server/apps/api/src/app.ts` *(+2/-0)*
- `server/apps/api/src/libs/env.ts` *(+5/-0)*
- `server/apps/api/src/libs/tests/env.test.ts` *(+9/-0)*
- `server/apps/api/src/routes/apple-iap/evidence.ts` *(+14/-2)*
- `server/apps/api/src/routes/apple-iap/index.ts` *(+3/-2)*
- `server/apps/api/src/routes/apple-iap/operations/notifications.ts` *(+10/-0)*
- `server/apps/api/src/routes/apple-iap/operations/transactions.ts` *(+5/-0)*
- `server/apps/api/src/routes/apple-iap/route.test.ts` *(+97/-2)*
- `server/apps/api/src/routes/apple-iap/verifier-routing.test.ts` *(+100/-0)*
- `server/apps/api/src/routes/apple-iap/verifier.test.ts` *(+43/-2)*
- `server/apps/api/src/routes/apple-iap/verifier.ts` *(+57/-31)*
- `server/apps/api/src/services/domain/payment/tests/payment.test.ts` *(+58/-0)*
- `server/docs/ai/adr/2026-09-27-apple-iap-sandbox-accounts.md` *(+93/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (18)
- [#2689](https://github.com/moeru-ai/airi/pull/2689) `docs(ui): document existing component design conventions` by **@luoling8192** *(6 comments)*
- [#2690](https://github.com/moeru-ai/airi/pull/2690) `chore(nix): update assets hash` by **@Weathercold** *(1 comments)*
- [#2691](https://github.com/moeru-ai/airi/pull/2691) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2681](https://github.com/moeru-ai/airi/pull/2681) `feat(stage-tamagotchi): hide the controls island while the cursor is away` by **@chiba233** *(1 comments)*
- [#2688](https://github.com/moeru-ai/airi/pull/2688) `chore(i18n): update translations` by **@github-actions** *(4 comments)*
- [#2684](https://github.com/moeru-ai/airi/pull/2684) `chore(ci): check Crowdin exports` by **@chiba233** *(1 comments)*
- [#2676](https://github.com/moeru-ai/airi/pull/2676) `docs(blog): DevLog @ 2026.09.27` by **@LemonNekoGH** *(Draft)* *(1 comments)*
- [#2687](https://github.com/moeru-ai/airi/pull/2687) `feat(plugin-sdk): add hosted Kit registration` by **@leaft** *(Draft)* *(1 comments)*
- [#2686](https://github.com/moeru-ai/airi/pull/2686) `fix(stage-tamagotchi): fall back to English for missing main-process strings` by **@chiba233** *(1 comments)*
- [#2683](https://github.com/moeru-ai/airi/pull/2683) `fix(i18n): translate the zh-Hant strings that Crowdin misplaced` by **@chiba233** *(1 comments)*
- [#2046](https://github.com/moeru-ai/airi/pull/2046) `feat(ci): add new agentic PR triage workflow` by **@lietblue** *(15 comments)*
- [#2679](https://github.com/moeru-ai/airi/pull/2679) `docs: update development setup guide` by **@jim139129** *(Draft)* *(2 comments)*
- [#2680](https://github.com/moeru-ai/airi/pull/2680) `docs(ko): sync Korean docs with English changes since the last sync` by **@Daeil-Jung** *(1 comments)*
- [#2238](https://github.com/moeru-ai/airi/pull/2238) `fix(docs): correct ko loanword transliterations and particle spacing` by **@Daeil-Jung** *(1 comments)*
- [#2357](https://github.com/moeru-ai/airi/pull/2357) `fix(docs): correct Korean particle spacing and stale ko README commands` by **@Daeil-Jung** *(6 comments)*
- [#2678](https://github.com/moeru-ai/airi/pull/2678) `docs(AGENTS.md): perform housekeeping on agent-facing docs` by **@sumimakito** *(1 comments)*
- [#2677](https://github.com/moeru-ai/airi/pull/2677) `feat(provider-inference): add Chutes chat, speech, and transcription providers` by **@Pietro00x** *(0 comments)*
- [#2675](https://github.com/moeru-ai/airi/pull/2675) `feat(api): store LLM request and error content` by **@luoling8192** *(8 comments)*

#### 🔄 PR Status & Lifecycle Changes (8)
- [#2550](https://github.com/moeru-ai/airi/pull/2550) `feat(hearing): add Sherpaw recognition across apps` — `OPEN` ➔ `MERGED`
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — `OPEN` ➔ `MERGED`
- [#2572](https://github.com/moeru-ai/airi/pull/2572) `feat(plugin-host): add activation planner` — `OPEN` ➔ `MERGED`
- [#2465](https://github.com/moeru-ai/airi/pull/2465) `chore(docs): update Minecraft integration guide` — `OPEN` ➔ `MERGED`
- [#2661](https://github.com/moeru-ai/airi/pull/2661) `feat(provider-inference): add Cheaper Inference provider` — `OPEN` ➔ `CLOSED`
- [#2663](https://github.com/moeru-ai/airi/pull/2663) `feat(stage-tamagotchi): add a floating chat window beside the character` — `OPEN` ➔ `MERGED`
- [#2658](https://github.com/moeru-ai/airi/pull/2658) `fix(ui): size the stage canvas from the Screen box alone` — `OPEN` ➔ `MERGED`
- [#2674](https://github.com/moeru-ai/airi/pull/2674) `fix(api): allow Apple sandbox purchases for dedicated test accounts` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (7)
- [#2550](https://github.com/moeru-ai/airi/pull/2550) `feat(hearing): add Sherpaw recognition across apps` — *+2 comments (17 ➔ 19 total)*
- [#2644](https://github.com/moeru-ai/airi/pull/2644) `feat(api): add provider-cost Flux settlement` — *+8 comments (23 ➔ 31 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+15 comments (127 ➔ 142 total)*
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` — *+1 comments (0 ➔ 1 total)*
- [#2667](https://github.com/moeru-ai/airi/pull/2667) `fix(stage-tamagotchi): isolate Eventa IPC contexts by window` — *+1 comments (1 ➔ 2 total)*
- [#2661](https://github.com/moeru-ai/airi/pull/2661) `feat(provider-inference): add Cheaper Inference provider` — *+1 comments (0 ➔ 1 total)*
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` — *+20 comments (20 ➔ 40 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — 🚨 **+1 comments** (1 total)
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` [OPEN] — 🚨 **+20 comments** (40 total)
  - *Focus*: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard

---
## [2026-09-27] Upstream Delta: `c83fae45..07ed52e3` (6 commits, 69 files, 19 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 6 commits (`07ed52e39d`, `c4da510353`, `4bba665da9`, `1437f3cc49`, `e8c939039b`, `0fbd91c27b`) across 69 files, accompanied by 19 PR updates (11 new PRs, 4 status changes, 4 discussion changes). Core focus centered on: (1) **Cloud Provider Sync (#2471 / `0fbd91c27b`)**: Merged remote database synchronization for user provider configs to a cloud replica via `server/apps/api` (Drizzle migration 0025, schemas, merge logic in `stage-ui`); (2) **Extensible LLM Request Tracking (#2673 / `07ed52e39d`)**: Added Drizzle migration 0026 and request tracking schemas (`llm_request_log`, `llm_request_attempt`) to `server/apps/api` for server-side generation usage, token tracking, and observation middleware; (3) **Steam OAuth Profile Extraction (#2647 / `1437f3cc49`)**: Enhanced the auth service to query Steam WebAPI (`GetPlayerSummaries`) to extract persona name and avatar URL during the initial Steam OpenID sign-up flow; (4) **Server S3 Object Storage Adapter (#2669 / `4bba665da9`)**: Added optional S3-compatible backend storage support to `server/apps/api` with ADR documentation; (5) **Window-Local Character & Conversation Decoupling (#2672 by @luoling8192)**: Major new architectural PR (20 comments) refactoring `stage-ui` to bind conversations to window-local characters rather than sharing a single global selection snapshot across windows; and (6) **Electron Multi-Window IPC Isolation (#2667 by @jim139129)**: New PR fixing cross-window Eventa IPC listener leakage by applying `onlySameWindow: true` transport filters.
* **Discussion & Community Buzz**:
  - 💬 **#2672: `refactor(stage-ui): bind conversations to window-local characters` (20 total comments)**: Heavy architectural discussion around decoupling character selection and conversation state per window on desktop and mobile.
  - 💬 **#2644: `feat(api): add provider-cost Flux settlement` (+12 new comments, total 23)**: Ongoing discussion regarding provider cost metering, OpenRouter pricing, and Flux credit deductions in the hosted backend.
  - 💬 **#2673: `feat(api): add extensible LLM request tracking` (16 total comments)**: Technical alignment on Drizzle database schemas and LLM routing retry observation.
  - 💬 **#2524: `feat(provider-inference): refresh Volcengine coding-plan models from endpoint` (+1 new comments, total 10)**: Steady activity around endpoint-based dynamic model discovery for Volcengine.
  - 💬 **#2674: `fix(api): allow Apple sandbox purchases for dedicated test accounts` (5 comments)**: Discussion on Apple App Store IAP test account sandbox integration.
  - 💬 **#2121: `chore(i18n): update translations` (+2 new comments, total 127)**: High-volume community translation maintenance.
  - 💬 **#2550: `feat(hearing): add bundled Sherpaw speech recognition` (17 total comments)**: Monitored PR maintaining steady evaluation status for local offline STT packaging.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2667: `fix(stage-tamagotchi): isolate Eventa IPC contexts by window` by @jim139129**: High-value desktop IPC safety candidate. In Electron multi-window environments, shared `ipcMain` listeners could leak renderer requests across window contexts. Applies Eventa's `onlySameWindow: true` transport filter and ensures clean IPC listener disposal on window close. Excellent fit for our decoupled desktop architecture (Control Strip, Actor Stage, Control Strip Customizer).
  - 🔍 **PR #2672: `refactor(stage-ui): bind conversations to window-local characters` by @luoling8192 (Architectural Reference Only)**: Worth studying for how upstream structures window-local character selection and restored conversation state, though our fork already enforces decoupled window lifecycles and universe-isolated sessions.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **Commit `0fbd91c27b` / PR #2471 (`feat(stage-ui): sync user providers to a cloud replica`)**: Modifies provider config and inference services to sync to upstream hosted cloud database replica. Directly conflicts with our local-first, zero-account architecture where provider instances are persisted locally in `providersStore` (`providersRepo`).
    - **Commit `07ed52e39d` / PR #2673 & Commit `4bba665da9` / PR #2669 (`feat(api): LLM request tracking` & `feat(api-server): S3 object storage`)**: Server-hosted API infrastructure in `server/apps/api`. Our fork has no backend server dependencies and uses client-side BYOS (S3/R2/Google Drive) directly.
    - **Commit `1437f3cc49` / PR #2647 & PR #2674 (`feat(auth): Steam profile fetch` & `fix(api): Apple sandbox purchases`)**: Hosted account auth and commercial IAP billing.
    - **`apps/stage-tamagotchi/.../controls-island-overflow.browser.test.ts` (Commit `0fbd91c27b`)**: Touches deprecated `controls-island`, removed in this fork.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/providers/*` and `services/inference-service-providers.ts` (Commit `0fbd91c27b`)**: Heavy upstream modifications (+1196/-164) introducing cloud sync merge logic (`merge.ts`) and API client replicas. Our fork maintains strictly local-first `providersStore` instances (`airi-provider-store-instances`). Never blindly merge upstream provider store diffs.
  - ⚠️ **`apps/stage-tamagotchi/.../controls-island/*` (Commit `0fbd91c27b`)**: Upstream continues patching `controls-island` test surfaces. Our fork completely decoupled the desktop into `windows/stage` (Actor Stage) and `windows/main` (Control Strip).
  - ⚠️ **`server/apps/api/*` and `server/apps/auth/*` (Commits `07ed52e39d`, `4bba665da9`, `1437f3cc49`)**: Massive additions (+9245/-619) for Drizzle migrations (0025, 0026), Steam OAuth, and request tracking. Keep our repository clean from hosted cloud infrastructure.

### 📋 Upstream Commits
- `07ed52e39d` feat(api): add extensible LLM request tracking (#2673) [#2673](https://github.com/moeru-ai/airi/pull/2673) _(RainbowBird, 2026-09-27)_
- `c4da510353` chore(nix): update pnpmDeps hash (#2670) [#2670](https://github.com/moeru-ai/airi/pull/2670) _(Weathercold, 2026-09-27)_
- `4bba665da9` feat(api-server): add optional S3 object storage (#2669) [#2669](https://github.com/moeru-ai/airi/pull/2669) _(RainbowBird, 2026-09-27)_
- `1437f3cc49` feat(auth): fetch the Steam profile on sign-in (#2647) [#2647](https://github.com/moeru-ai/airi/pull/2647) _(Lulu, 2026-09-27)_
- `e8c939039b` chore: update sponsors svg (#2668) [#2668](https://github.com/moeru-ai/airi/pull/2668) _(Neko, 2026-09-27)_
- `0fbd91c27b` feat(stage-ui): sync user providers to a cloud replica (#2471) [#2471](https://github.com/moeru-ai/airi/pull/2471) _(Lulu, 2026-09-27)_

### 🔬 Subsystem Breakdown
#### Deprecated Surfaces (Control Island) (`⚪ ignore / rejected in fork (decoupled into Control Strip)`) — 1 file(s) (+3/-0)
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-overflow.browser.test.ts` *(+3/-0)*

#### Documentation & Scaffolding (`⚪ ignore`) — 1 file(s) (+1/-1)
- `docs/content/public/assets/sponsors/sponsors.json` *(+1/-1)*

#### Other / Uncategorized (`🔍 inspect`) — 5 file(s) (+165/-286)
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/stage-ui/src/components/menu/icon-status-item.vue` *(+31/-0)*
- `packages/stage-ui/src/services/inference-service-providers.test.ts` *(+73/-134)*
- `packages/stage-ui/src/services/inference-service-providers.ts` *(+58/-151)*
- `pnpm-workspace.yaml` *(+2/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+8/-0)
- `packages/i18n/src/locales/en/settings.yaml` *(+4/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+4/-0)*

#### UI Primitives & Pages (`📦 import / inspect`) — 2 file(s) (+6/-6)
- `packages/stage-pages/src/pages/settings/providers/index.vue` *(+4/-0)*
- `packages/stage-pages/src/pages/v2/settings/providers.vue` *(+2/-6)*

#### Provider & Model Integrations (`📦 import / inspect`) — 7 file(s) (+1196/-164)
- `packages/stage-ui/src/stores/providers/config.test.ts` *(+469/-52)*
- `packages/stage-ui/src/stores/providers/config.ts` *(+321/-97)*
- `packages/stage-ui/src/stores/providers/merge.test.ts` *(+137/-0)*
- `packages/stage-ui/src/stores/providers/merge.ts` *(+109/-0)*
- `packages/stage-ui/src/stores/providers/onboarding-save.browser.test.ts` *(+3/-0)*
- `packages/stage-ui/src/stores/providers/provider.test.ts` *(+124/-0)*
- `packages/stage-ui/src/stores/providers/provider.ts` *(+33/-15)*

#### Root Build & Tooling (`🔍 inspect`) — 1 file(s) (+324/-0)
- `pnpm-lock.yaml` *(+324/-0)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 49 file(s) (+9245/-619)
- `server/apps/api/README.md` *(+86/-0)*
- `server/apps/api/drizzle/0025_premium_frog_thor.sql` *(+14/-0)*
- `server/apps/api/drizzle/0026_llm_request_tracking.sql` *(+58/-0)*
- `server/apps/api/drizzle/meta/0025_snapshot.json` *(+3264/-0)*
- `server/apps/api/drizzle/meta/0026_snapshot.json` *(+3723/-0)*
- `server/apps/api/drizzle/meta/_journal.json` *(+15/-1)*
- `server/apps/api/package.json` *(+2/-0)*
- `server/apps/api/src/app.ts` *(+27/-13)*
- `server/apps/api/src/libs/env.ts` *(+5/-3)*
- `server/apps/api/src/libs/tests/env.test.ts` *(+12/-0)*
- `server/apps/api/src/routes/llm-requests/index.ts` *(+66/-0)*
- `server/apps/api/src/routes/openai/v1/middlewares/billing.ts` *(+1/-1)*
- `server/apps/api/src/routes/openai/v1/model-routing.ts` *(+9/-2)*
- `server/apps/api/src/routes/openai/v1/operations/chat-completions/index.ts` *(+163/-82)*
- `server/apps/api/src/routes/openai/v1/operations/responses/index.ts` *(+40/-10)*
- `server/apps/api/src/routes/openai/v1/route.test.ts` *(+117/-1)*
- `server/apps/api/src/routes/providers/index.ts` *(+14/-52)*
- `server/apps/api/src/routes/providers/route.test.ts` *(+31/-101)*
- `server/apps/api/src/routes/providers/schema.ts` *(+3/-26)*
- `server/apps/api/src/schemas/index.ts` *(+1/-0)*
- `server/apps/api/src/schemas/llm-request-attempt.ts` *(+31/-0)*
- `server/apps/api/src/schemas/llm-request-log.ts` *(+37/-2)*
- `server/apps/api/src/schemas/providers.ts` *(+9/-25)*
- `server/apps/api/src/services/adapters/object-store.integration.test.ts` *(+65/-0)*
- `server/apps/api/src/services/adapters/object-store.test.ts` *(+124/-0)*
- `server/apps/api/src/services/adapters/object-store.ts` *(+79/-0)*
- `server/apps/api/src/services/adapters/s3-config.test.ts` *(+46/-0)*
- `server/apps/api/src/services/adapters/s3-config.ts` *(+22/-0)*
- `server/apps/api/src/services/domain/billing/billing.ts` *(+1/-14)*
- `server/apps/api/src/services/domain/billing/tests/billing.test.ts` *(+1/-56)*
- `server/apps/api/src/services/domain/generation-observation.ts` *(+66/-0)*
- `server/apps/api/src/services/domain/generation-usage.test.ts` *(+91/-0)*
- `server/apps/api/src/services/domain/generation-usage.ts` *(+86/-0)*
- `server/apps/api/src/services/domain/llm-router/attempt.ts` *(+22/-0)*
- `server/apps/api/src/services/domain/llm-router/router.ts` *(+36/-1)*
- `server/apps/api/src/services/domain/llm-router/tests/router.test.ts` *(+42/-0)*
- `server/apps/api/src/services/domain/llm-router/types.ts` *(+3/-0)*
- `server/apps/api/src/services/domain/providers.test.ts` *(+127/-50)*
- `server/apps/api/src/services/domain/providers.ts` *(+93/-148)*
- `server/apps/api/src/services/domain/request-log.test.ts` *(+123/-0)*
- `server/apps/api/src/services/domain/request-log.ts` *(+80/-12)*
- `server/apps/api/src/services/domain/user-deletion/tests/service-deletion.test.ts` *(+8/-5)*
- `server/apps/auth/src/auth.ts` *(+1/-1)*
- `server/apps/auth/src/env.ts` *(+1/-0)*
- `server/apps/auth/src/plugins/steam.ts` *(+81/-2)*
- `server/apps/auth/src/tests/env.test.ts` *(+1/-0)*
- `server/apps/auth/src/tests/steam.test.ts` *(+120/-11)*
- `server/docs/ai/adr/2026-09-27-llm-request-tracking.md` *(+112/-0)*
- `server/docs/ai/adr/2026-09-27-s3-object-storage.md` *(+86/-0)*

#### Telemetry & Analytics (`⚪ ignore / rejected in fork`) — 1 file(s) (+3/-11)
- `server/apps/api/src/routes/openai/v1/middlewares/telemetry.ts` *(+3/-11)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (11)
- [#2672](https://github.com/moeru-ai/airi/pull/2672) `refactor(stage-ui): bind conversations to window-local characters` by **@luoling8192** *(20 comments)*
- [#2674](https://github.com/moeru-ai/airi/pull/2674) `fix(api): allow Apple sandbox purchases for dedicated test accounts` by **@Neko-233** *(5 comments)*
- [#2673](https://github.com/moeru-ai/airi/pull/2673) `feat(api): add extensible LLM request tracking` by **@luoling8192** *(16 comments)*
- [#2670](https://github.com/moeru-ai/airi/pull/2670) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2669](https://github.com/moeru-ai/airi/pull/2669) `feat(api-server): add optional S3 object storage` by **@luoling8192** *(1 comments)*
- [#2031](https://github.com/moeru-ai/airi/pull/2031) `docs(ui-server-auth): fix stale server-dev auth UI domain in README` by **@lulu0119** *(3 comments)*
- [#1884](https://github.com/moeru-ai/airi/pull/1884) `chore(server): remove unused CLIENT_URL from env template` by **@lulu0119** *(3 comments)*
- [#1879](https://github.com/moeru-ai/airi/pull/1879) `fix(ui-server-auth): clarify social-only email sign-in hint` by **@lulu0119** *(2 comments)*
- [#1584](https://github.com/moeru-ai/airi/pull/1584) `fix(stage-tamagotchi): add drag region to onboarding layout` by **@lulu0119** *(5 comments)*
- [#2668](https://github.com/moeru-ai/airi/pull/2668) `chore: update sponsors svg` by **@nekomeowww** *(2 comments)*
- [#2667](https://github.com/moeru-ai/airi/pull/2667) `fix(stage-tamagotchi): isolate Eventa IPC contexts by window` by **@jim139129** *(1 comments)*

#### 🔄 PR Status & Lifecycle Changes (4)
- [#2647](https://github.com/moeru-ai/airi/pull/2647) `feat(auth): fetch the Steam profile on sign-in` — `OPEN` ➔ `MERGED`
- [#2662](https://github.com/moeru-ai/airi/pull/2662) `feat(i18n): add Indonesian language support` — `OPEN` ➔ `CLOSED`
- [#2580](https://github.com/moeru-ai/airi/pull/2580) `fix(stage-tamagotchi): prevent duplicate user data folder openings` — `OPEN` ➔ `CLOSED`
- [#2471](https://github.com/moeru-ai/airi/pull/2471) `feat(stage-ui): sync user providers to a cloud replica` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (4)
- [#2644](https://github.com/moeru-ai/airi/pull/2644) `feat(api): add provider-cost Flux settlement` — *+12 comments (11 ➔ 23 total)*
- [#2524](https://github.com/moeru-ai/airi/pull/2524) `feat(provider-inference): refresh Volcengine coding-plan models from endpoint` — *+1 comments (9 ➔ 10 total)*
- [#2662](https://github.com/moeru-ai/airi/pull/2662) `feat(i18n): add Indonesian language support` — *+3 comments (0 ➔ 3 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+2 comments (125 ➔ 127 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(0 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2550](https://github.com/moeru-ai/airi/pull/2550) `feat(hearing): add bundled Sherpaw speech recognition` [OPEN] — *(17 comments)*
  - *Focus*: Offline Sherpaw STT model packaging (Paraformer/Zipformer) via tsdown and Vite plugin
- [#2641](https://github.com/moeru-ai/airi/pull/2641) `feat(stage-ui): show chat image analysis status` [CLOSED] — *(1 comments)*
  - *Focus*: Accessible live status indicator for text-only models undergoing vision pre-processing

---
## [2026-09-26] Upstream Delta: `a142a053..c83fae45` (4 commits, 37 files, 10 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 4 commits (`c83fae45f2`, `fab2dbeafa`, `7abffaee58`, `d1d594e785`) across 37 files and registered 10 PR updates (6 new PRs, 2 status changes, 2 discussion changes). Core focus centered on: (1) **Full-Screen Card Editor Migration (#2654 / `d1d594e785`)**: Replaced the legacy narrow `CardCreationDialog.vue` modal with dedicated full-screen routes (`/settings/airi-card/new` and `/settings/airi-card/:cardId/edit`), introducing `CardEditor.vue`, `UnsavedChangesDialog.vue`, and route-based navigation with guarded discard flow; (2) **Provider Card Alignment Polish (#2653 / `7abffaee58`)**: Fixed provider card grid vertical alignment in `icon-status-item.vue` (`items-start` instead of `items-center`) so cards lacking descriptions remain top-aligned; (3) **Commercial Apple IAP Backend (#2665 / `fab2dbeafa`, #2664)**: Added Apple App Store In-App Purchase verification and certificate validation in `server/apps/api`, followed by PR #2664 adding multi-app bundle ID support; (4) **Floating Chat Window Experimentation (#2663 by @chiba233)**: Major desktop PR proposing an attached floating chat window alongside the character stage (`chat-floating.vue`, `floating-placement.ts`), coupled to upstream's legacy `controls-island`; and (5) **Provider & Ecosystem Additions (#2661, #2662, #2666)**: New PRs adding the Cheaper Inference provider (`#2661`), Indonesian language support (`#2662`), and Nix dependency hash updates (`#2666`).
* **Discussion & Community Buzz**:
  - 💬 **#2121: `chore(i18n): update translations` (+2 new comments, total 125)**: Continued high-volume community localization updates across locales.
  - 💬 **#2657: `feat(stage-ui): show a dynamic presence bubble beside the character` (+1 new comments, total 4)**: Ongoing discussion regarding spring dampening and head-tracking anchor math.
  - 💬 **#2550: `feat(hearing): add bundled Sherpaw speech recognition` (17 total comments)**: Sustained community interest in offline bundled Sherpaw STT model packaging (Paraformer/Zipformer).
  - 💬 **#2644: `feat(api): add provider cost billing with OpenRouter adapter` (11 total comments)**: Active discussion around upstream server-side billing metering.
* **Cherry-Pick Candidates**:
  - ⭐ **Commit `7abffaee58` / PR #2653 (`fix(stage-ui): align provider card content to top`)**: High-value, zero-risk visual polish candidate. A clean 4-line adjustment in `packages/stage-ui/src/components/menu/icon-status-item.vue` (`items-start` + `flex-1` / `h-full`) that prevents provider cards without descriptions from sagging vertically relative to neighbor cards in the provider settings grid.
  - 🔍 **PR #2661: `feat(provider-inference): add Cheaper Inference provider`**: Low-risk provider candidate. Adds an OpenAI-compatible cloud router (`cheaperinference`) with standard API endpoint validation. Can be cherry-picked if additional budget router options are desired.
  - 🔍 **PR #2662: `feat(i18n): add Indonesian language support`**: Additive localization candidate once merged upstream.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **Commit `fab2dbeafa` / PR #2665 & PR #2664 (`feat(api): add Apple IAP payment channel backend`)**: Hosted commercial billing/IAP in `server/apps/api`. Directly violates our fork's local-first, zero-account BYOS architecture.
    - **Commit `d1d594e785` / PR #2654 (`feat(stage-pages): replace card editor modal with full-screen routes`)**: While structurally interesting, our fork has already heavily diverged with the custom AnimaDex Wizard (`guided.vue`), multi-actor tabs, and `extensions.airi` schema bindings. Direct porting would wipe out our multi-actor and persona customization extensions.
    - **PR #2663 (`feat(stage-tamagotchi): add a floating chat window beside the character`)**: Heavily coupled to `controls-island` (`controls-island-chat-button.vue`), which our fork completely deleted in favor of the decoupled Control Strip ribbon architecture. The window placement logic can be studied for architectural reference, but the code itself is an auto-reject.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-pages/src/pages/settings/airi-card/*` (Commit `d1d594e785`)**: Upstream completely rewrote the card editor from a modal to route pages, deleting `CardCreationDialog.vue` and creating `CardEditor.vue`. Our fork has `guided.vue` and custom card wizard tabs. Any future upstream card editor sync will cause extensive merge conflicts; our custom extensions must be preserved.
  - ⚠️ **`apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/*` (PR #2663)**: Touches controls-island, which does not exist in our fork (decoupled into Control Strip). Do NOT attempt to cherry-pick or merge this PR directly.
  - ⚠️ **`server/apps/api/*` (Commit `fab2dbeafa`, PR #2664, PR #2665)**: Upstream continues expanding hosted Apple IAP and Stripe payment processors. Keep our fork entirely disconnected from hosted server billing.

### 📋 Upstream Commits
- `c83fae45f2` chore(nix): update pnpmDeps hash (#2666) [#2666](https://github.com/moeru-ai/airi/pull/2666) _(Weathercold, 2026-09-26)_
- `fab2dbeafa` feat(api): add Apple IAP payment channel backend (#2665) [#2665](https://github.com/moeru-ai/airi/pull/2665) _(Lulu, 2026-09-26)_
- `7abffaee58` fix(stage-ui): align provider card content to top (#2653) [#2653](https://github.com/moeru-ai/airi/pull/2653) _(凌莞~(=^▽^=), 2026-09-26)_
- `d1d594e785` feat(stage-pages): replace card editor modal with full-screen routes (#2654) [#2654](https://github.com/moeru-ai/airi/pull/2654) _(凌莞~(=^▽^=), 2026-09-26)_

### 🔬 Subsystem Breakdown
#### Other / Uncategorized (`🔍 inspect`) — 4 file(s) (+25/-18)
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/stage-ui/src/components/menu/icon-status-item.vue` *(+2/-2)*
- `packages/stage-ui/src/stores/modules/speech-card-preview.browser.test.ts` *(+21/-15)*
- `pnpm-workspace.yaml` *(+1/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+52/-34)
- `packages/i18n/src/locales/en/settings.yaml` *(+11/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+41/-34)*

#### UI Primitives & Pages (`📦 import / inspect`) — 9 file(s) (+1463/-915)
- `packages/stage-pages/src/pages/settings/airi-card/[cardId]/edit.vue` *(+47/-0)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardCreationDialog.vue` *(+0/-882)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardEditor.vue` *(+1097/-0)*
- `packages/stage-pages/src/pages/settings/airi-card/components/UnsavedChangesDialog.vue` *(+85/-0)*
- `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabArtistry.vue` *(+4/-4)*
- `packages/stage-pages/src/pages/settings/airi-card/composables/use-airi-card-editor-page.browser.test.ts` *(+77/-0)*
- `packages/stage-pages/src/pages/settings/airi-card/composables/use-airi-card-editor-page.ts` *(+105/-0)*
- `packages/stage-pages/src/pages/settings/airi-card/index.vue` *(+7/-29)*
- `packages/stage-pages/src/pages/settings/airi-card/new.vue` *(+41/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 1 file(s) (+55/-0)
- `pnpm-lock.yaml` *(+55/-0)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 21 file(s) (+1249/-6)
- `server/apps/api/README.md` *(+8/-1)*
- `server/apps/api/assets/apple-root-ca/AppleRootCA-G2.cer` *(+0/-0)*
- `server/apps/api/assets/apple-root-ca/AppleRootCA-G3.cer` *(+0/-0)*
- `server/apps/api/assets/apple-root-ca/README.md` *(+25/-0)*
- `server/apps/api/package.json` *(+1/-0)*
- `server/apps/api/src/app.test.ts` *(+1/-0)*
- `server/apps/api/src/app.ts` *(+35/-0)*
- `server/apps/api/src/libs/env.ts` *(+25/-1)*
- `server/apps/api/src/libs/tests/env.test.ts` *(+13/-0)*
- `server/apps/api/src/routes/apple-iap/evidence.ts` *(+128/-0)*
- `server/apps/api/src/routes/apple-iap/index.ts` *(+59/-0)*
- `server/apps/api/src/routes/apple-iap/operations/account-token.ts` *(+38/-0)*
- `server/apps/api/src/routes/apple-iap/operations/notifications.ts` *(+92/-0)*
- `server/apps/api/src/routes/apple-iap/operations/transactions.ts` *(+76/-0)*
- `server/apps/api/src/routes/apple-iap/route.test.ts` *(+348/-0)*
- `server/apps/api/src/routes/apple-iap/verifier.test.ts` *(+69/-0)*
- `server/apps/api/src/routes/apple-iap/verifier.ts` *(+162/-0)*
- `server/apps/api/src/services/adapters/config-kv/definitions.ts` *(+9/-1)*
- `server/apps/api/src/services/domain/payment/index.ts` *(+81/-2)*
- `server/apps/api/src/services/domain/payment/tests/payment.test.ts` *(+57/-1)*
- `server/apps/api/src/services/domain/payment/types.ts` *(+22/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (6)
- [#2666](https://github.com/moeru-ai/airi/pull/2666) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2665](https://github.com/moeru-ai/airi/pull/2665) `feat(api): add Apple IAP payment channel backend` by **@lulu0119** *(1 comments)*
- [#2664](https://github.com/moeru-ai/airi/pull/2664) `feat(api): evolve Apple IAP channel on payment CORE with multi-app support` by **@lulu0119** *(0 comments)*
- [#2663](https://github.com/moeru-ai/airi/pull/2663) `feat(stage-tamagotchi): add a floating chat window beside the character` by **@chiba233** *(1 comments)*
- [#2662](https://github.com/moeru-ai/airi/pull/2662) `feat(i18n): add Indonesian language support` by **@kaisaaru** *(0 comments)*
- [#2661](https://github.com/moeru-ai/airi/pull/2661) `feat(provider-inference): add Cheaper Inference provider` by **@aiapienthusiast** *(0 comments)*

#### 🔄 PR Status & Lifecycle Changes (2)
- [#2653](https://github.com/moeru-ai/airi/pull/2653) `fix(stage-ui): align provider card content to top` — `OPEN` ➔ `MERGED`
- [#2654](https://github.com/moeru-ai/airi/pull/2654) `feat(stage-pages): replace card editor modal with full-screen routes` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (2)
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+2 comments (123 ➔ 125 total)*
- [#2657](https://github.com/moeru-ai/airi/pull/2657) `feat(stage-ui): show a dynamic presence bubble beside the character` — *+1 comments (3 ➔ 4 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(0 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2550](https://github.com/moeru-ai/airi/pull/2550) `feat(hearing): add bundled Sherpaw speech recognition` [OPEN] — *(17 comments)*
  - *Focus*: Offline Sherpaw STT model packaging (Paraformer/Zipformer) via tsdown and Vite plugin
- [#2641](https://github.com/moeru-ai/airi/pull/2641) `feat(stage-ui): show chat image analysis status` [CLOSED] — *(1 comments)*
  - *Focus*: Accessible live status indicator for text-only models undergoing vision pre-processing

---
## [2026-09-25] Upstream Delta: `3e8ea960..a142a053` (1 commits, 8 files, 7 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 1 commit (`a142a053fd` / PR #2656) and logged 7 PR updates (3 new PRs, 1 status change, 3 discussion changes). Core focus centered on: (1) Auth leader/follower synchronization (#2656 / `a142a053fd`), resolving a race condition where Pinia sync followers (e.g. the onboarding dialog) toggled `needsLogin = true` before the leader could consume it, introducing a leader-owned `requestLogin()` action; (2) In-canvas dynamic presence bubbles (#2657 by @chiba233), introducing dynamic presence bubble tracking anchored to character head positions (Live2D & VRM) via `@proj-airi/stage-shared` with spring physics and devtools controls—converging toward patterns already implemented in this fork via `HeadTetheredCaption` and `HeadTetheredCanvas2D`; (3) Stage canvas sizing & minimum constraint cleanups (#2658 by @chiba233), streamlining `screen.vue` to rely exclusively on `useElementSize(containerRef)` and removing conflicting `min-h="100 sm:100"` constraints from `Stage.vue` scenes that caused avatar models to bounce/jump during window resizes; (4) Linux Electron CI hardening (#2519 by @gg582), moving PR #2519 from Draft to Ready for headless Linux X11 (Xvfb) and Wayland (Weston) smoke testing in GitHub Actions via CDP remote debugging; and (5) Community localization & audio streams (#2121, #2290), continuing rolling translation updates (+2 comments, 123 total) and server-side WebSocket ASR streaming discussions (+1 comment, 59 total).
* **Discussion & Community Buzz**:
  - 💬 **#2121: `chore(i18n): update translations` (+2 new comments, total 123)**: Continuous high-volume community localization updates across locales.
  - 💬 **#2290: `feat(server): stream official ASR over WebSocket` (+1 new comments, total 59)**: Sustained architectural discussion regarding server-side streaming ASR protocol.
  - 💬 **#2519: `test(stage-tamagotchi): verify linux window rendering in CI` (+1 new comments, total 14)**: Author marked PR ready for review after passing all remote debugging CDP assertion suites under headless Weston/Xvfb.
  - 💬 **#2657: `feat(stage-ui): show a dynamic presence bubble beside the character` (3 comments)**: Active mathematical and testing discussion detailing ablation runs, hysteresis band feedback, and spring stiffness/damping across head anchors.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2658: `fix(ui): size the stage canvas from the Screen box alone`**: High-value candidate for stage layout stability. Eliminates model jumping during window resizing caused by conflicting `min-h-100 sm:100` (400px minimum) constraints across avatar scene renderers and replaces complex bounding/breakpoint guesses in `screen.vue` with a simple `useElementSize`. In our fork, `RendererStage.vue` still retains `:class="['min-w-50% <lg:full min-h-100 sm:100', 'h-full w-full flex-1']"` on VRM, Spine, and MMD scenes; stripping those minimums aligns with this fix.
  - 🔍 **PR #2519: `test(stage-tamagotchi): verify linux window rendering in CI`**: Valuable CI infrastructure candidate. Introduces headless Electron smoke tests via Chrome DevTools Protocol (`remote-debug.ts`) under Xvfb and Weston to detect window creation, Ozone platform flags (`--ozone-platform=wayland|x11`), and transparent rendering regressions without manual Linux hardware testing.
  - 🔍 **PR #2657: `feat(stage-ui): show a dynamic presence bubble beside the character`**: Conceptual reference candidate. Our fork already implemented in-scene head-following comic bubbles (`HeadTetheredCaption` for Live2D and `HeadTetheredCanvas2D` for 3D/VRM/MMD/Spine). The physics advancer (`PresenceBubbleAdvancer`) and spring placement math in `@proj-airi/stage-shared/src/presence-bubble` can be reviewed for smoothing our tethered bubble spring dynamics.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **Commit `a142a053fd` / PR #2656 (`fix(auth): publish login requests on the leader`)**: Pertains directly to upstream's hosted cloud authentication, OIDC redirects, and remote user accounts. Our fork strictly adheres to offline-first, zero-account BYOS persistence.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/components/scenes/Stage.vue` vs `RendererStage.vue` (PR #2658)**: Upstream modifies `Stage.vue` to remove `min-h="100 sm:100"`. In our fork, `Stage.vue` was decoupled and replaced by `RendererStage.vue` in the dedicated Actor Stage window (`apps/stage-tamagotchi/src/renderer/windows/stage`). Do not attempt a direct git patch; port the removal of `min-h-100 sm:100` specifically into `RendererStage.vue`.
  - ⚠️ **`packages/stage-ui/src/stores/auth.ts` & `step-welcome.vue` (Commit `a142a053fd`)**: Touches cloud authentication stores and onboarding dialogs. Our fork does not route logins or store cloud auth tokens; keep fork's local onboarding intact.
  - ⚠️ **`packages/stage-shared` & Head Anchors (PR #2657)**: Upstream's presence bubble introduces new files in `@proj-airi/stage-shared` and modifies `packages/stage-ui-live2d/src/components/scenes/Live2D.vue`. Our fork already hooks the Live2D PIXI app and Three.js scene refs via `HeadTetheredCaption` and `HeadTetheredCanvas2D` with radial menu controls. Avoid clobbering existing head-tethered caption wiring.

### 📋 Upstream Commits
- `a142a053fd` fix(auth): publish login requests on the leader (#2656) [#2656](https://github.com/moeru-ai/airi/pull/2656) _(RainbowBird, 2026-09-25)_

### 🔬 Subsystem Breakdown
#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 2 file(s) (+4/-4)
- `apps/stage-pocket/src/pages/settings/account/index.vue` *(+2/-2)*
- `apps/stage-web/src/pages/settings/account/index.vue` *(+2/-2)*

#### Other / Uncategorized (`🔍 inspect`) — 6 file(s) (+91/-9)
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding.browser.test.ts` *(+19/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.browser.test.ts` *(+26/-1)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.vue` *(+2/-2)*
- `packages/stage-ui/src/components/scenarios/hologram/holo-coupon.vue` *(+2/-2)*
- `packages/stage-ui/src/stores/auth.browser.test.ts` *(+31/-0)*
- `packages/stage-ui/src/stores/auth.ts` *(+11/-4)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (3)
- [#2657](https://github.com/moeru-ai/airi/pull/2657) `feat(stage-ui): show a dynamic presence bubble beside the character` by **@chiba233** *(3 comments)*
- [#2658](https://github.com/moeru-ai/airi/pull/2658) `fix(ui): size the stage canvas from the Screen box alone` by **@chiba233** *(1 comments)*
- [#2656](https://github.com/moeru-ai/airi/pull/2656) `fix(auth): publish login requests on the leader` by **@luoling8192** *(1 comments)*

#### 🔄 PR Status & Lifecycle Changes (1)
- [#2519](https://github.com/moeru-ai/airi/pull/2519) `test(stage-tamagotchi): verify linux window rendering in CI` — `Draft` ➔ `Ready`

#### 💬 Discussion Activity (3)
- [#2519](https://github.com/moeru-ai/airi/pull/2519) `test(stage-tamagotchi): verify linux window rendering in CI` — *+1 comments (13 ➔ 14 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+2 comments (121 ➔ 123 total)*
- [#2290](https://github.com/moeru-ai/airi/pull/2290) `feat(server): stream official ASR over WebSocket` — *+1 comments (58 ➔ 59 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(0 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2550](https://github.com/moeru-ai/airi/pull/2550) `feat(hearing): add bundled Sherpaw speech recognition` [OPEN] — *(17 comments)*
  - *Focus*: Offline Sherpaw STT model packaging (Paraformer/Zipformer) via tsdown and Vite plugin
- [#2641](https://github.com/moeru-ai/airi/pull/2641) `feat(stage-ui): show chat image analysis status` [CLOSED] — *(1 comments)*
  - *Focus*: Accessible live status indicator for text-only models undergoing vision pre-processing

---
## [2026-09-24] Upstream Delta: `595ea726..3e8ea960` (6 commits, 37 files, 15 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 6 commits (`595ea726..3e8ea960`) across 37 files and recorded 15 PR updates (10 new, 2 status changes, 3 discussion changes). Core focus centered on: (1) Voice input stream binding & ASR lifecycle (#2645 / `40d6ffd8df`, #2651, #2290), resolving microphone race conditions where late stream discovery or rapid toggling decoupled the Hearing VAD from active MediaStreams, with follow-ups making ASR lifecycle explicit (#2651) and streaming official ASR over WebSocket (#2290); (2) Live2D resize frame blanking fix (#2646 / `3e8ea96075`), forcing an immediate frame draw before the compositor presents and switching dimension watchers to `flush: 'post'`; (3) Consciousness sampling opt-in (#2650 / `f0fae90a0b`), resolving Issue #2628 by making temperature and top_p explicit opt-ins via UI toggles so default slider values do not override provider defaults for reasoning models (e.g. o1/o3/r1); (4) Character card editor overhaul (#2654 by @clansty), proposing to replace the cramped card editor modal with full-screen responsive routes (`/settings/airi-card/new` and `/settings/airi-card/:cardId/edit`) with linear browser back-history; (5) Deprecated Controls Island adjustments (#2649 / `eeea3a1a5a`, `b38ae4a62f`), tweaking island dock assertions and chat controls; and (6) Cloud/auth expansions (#2648, #2647), adding provider/chat cloud sync switches and Steam profile sign-in.
* **Discussion & Community Buzz**:
  - 💬 **#2290: `feat(server): stream official ASR over WebSocket` (58 comments)**: Heavy discussion on streaming official ASR over WebSocket vs HTTP chunking.
  - 💬 **#2471: `feat(stage-ui): sync user providers to a cloud replica` (+2 new comments, total 67)**: Ongoing high-velocity architectural discussion regarding hosted database cloud sync of user provider configurations vs local privacy.
  - 💬 **#2121: `chore(i18n): update translations` (+3 new comments, total 121)**: Continuous high-volume community localization updates.
  - 💬 **#2651: `refactor(stage-ui): make voice input and ASR lifecycle explicit` (4 comments)**: Active discussion following PR #2645 on cleanly decoupling voice input stream acquisition and ASR consumer lifecycles.
  - 💬 **#2214: `feat(tts): add Volcengine streaming BYOK` [Draft] (4 comments)**: Community discussion on adding streaming TTS for ByteDance Volcengine (Doubao).
  - 💬 **#2613: `perf(stage-tamagotchi): remove packaging-only dependencies` (+1 new comments, total 4)**: Finalizing bundle footprint cleanup.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2646 (Commit `3e8ea96075`): `fix(stage-ui-live2d): draw the resized frame before the compositor takes it`**: High-value visual fix. Resizing the Live2D drawing buffer reallocates it empty; under constrained maxFPS, this caused visible black flashes/flickering. Calling `renderStage?.()` immediately inside `handleResize()` and using `{ flush: 'post' }` fixes the flash cleanly. Direct drop-in into `packages/stage-ui-live2d/src/components/scenes/live2d/Canvas.vue`.
  - ⭐ **PR #2650 (Commit `f0fae90a0b`): `fix(stage-ui): make custom sampling parameters opt-in (#2650)`**: High value for LLM inference correctness. Fixes Issue #2628 where default slider values (0.7, 1.0) were unconditionally included in chat completion payloads, clobbering model defaults for reasoning models (OpenAI o1/o3, DeepSeek R1). Worth adapting into our `consciousness.ts` and `consciousness-settings.ts` stores, taking care to preserve our fork's composite provider key logic.
  - 🔍 **PR #2653: `fix(stage-ui): align provider card content to top`**: Clean visual polish aligning provider card contents to the top. Low risk, simple candidate.
  - 🔍 **PR #2654: `feat(stage-pages): replace card editor modal with full-screen routes`**: Replaces the card editor modal with dedicated full-screen routes. Architectural reference to study against our existing AnimaDex / Card Editor Wizard (`airi-card-editor-wizard`).
  - ⚪ **Auto-Reject / Do Not Port**:
    - **Commits `eeea3a1a5a` & `b38ae4a62f` / PR #2649 (`controls-island`)**: Modifies `controls-island` which this fork permanently deleted in favor of the decoupled Control Strip.
    - **PR #2648 & #2647 (Cloud sync switches & Steam profile auth)**: Hosted cloud database sync and remote game profile authentication; incompatible with this fork's local-first, zero-account, client-only architecture.
    - **Commit `40d6ffd8df` (server Aliyun NLS streaming routes)**: Server-side transcription proxying is not used in this client-direct fork.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/modules/consciousness.ts` & `settings/modules/consciousness.vue` (Commit `f0fae90a0b`)**: Upstream adds opt-in sampling flags. Our fork contains customized provider key mappings (`composite provider keys`), onboarding grounding persistence, and model customizer integrations. Any port must splice the opt-in computed properties without overwriting fork-specific provider structures.
  - ⚠️ **`apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` & `chat.vue` (Commit `eeea3a1a5a`)**: Upstream altered island dock placement and chat controls. Our fork completely decoupled chat and controls from the stage window. Do not merge.
  - ⚠️ **`packages/stage-ui/src/stores/modules/hearing.ts` & `vad.ts` (Commit `40d6ffd8df` / PR #2651)**: Upstream is actively refactoring voice input stream binding. Our fork maintains custom audio pipelines (VoiceProfiles, UST speech transformers, and Stage-Mate audio bridge). Review changes against our audio pipeline before adopting.

### 📋 Upstream Commits
- `3e8ea96075` fix(stage-ui-live2d): draw the resized frame before the compositor takes it (#2646) [#2646](https://github.com/moeru-ai/airi/pull/2646) _(蓝莓🫐, 2026-09-24)_
- `b38ae4a62f` test(stage-tamagotchi): correct controls island dock assertions  _(RainbowBird, 2026-09-24)_
- `f0fae90a0b` fix(stage-ui): make custom sampling parameters opt-in (#2650) [#2650](https://github.com/moeru-ai/airi/pull/2650) _(RainbowBird, 2026-09-24)_
- `eeea3a1a5a` fix(stage-tamagotchi): correct island dock and simplify chat controls (#2649) [#2649](https://github.com/moeru-ai/airi/pull/2649) _(RainbowBird, 2026-09-24)_
- `bdf8c0b648` docs: update behavior evidence workflow and clarify diagram usage  _(RainbowBird, 2026-09-24)_
- `40d6ffd8df` fix(stage-ui): restore voice input after microphone changes (#2645) [#2645](https://github.com/moeru-ai/airi/pull/2645) _(RainbowBird, 2026-09-24)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 3 file(s) (+132/-36)
- `.agents/skills/create-pr/SKILL.md` *(+10/-36)*
- `docs/ai/adr/2026-09-23-voice-input-binding.md` *(+112/-0)*
- `packages/stage-ui/README.md` *(+10/-0)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 2 file(s) (+108/-129)
- `apps/stage-pocket/src/pages/index.vue` *(+53/-64)*
- `apps/stage-web/src/pages/index.vue` *(+55/-65)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 2 file(s) (+53/-68)
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+53/-55)*
- `apps/stage-tamagotchi/src/renderer/pages/chat.vue` *(+0/-13)*

#### Deprecated Surfaces (Control Island) (`⚪ ignore / rejected in fork (decoupled into Control Strip)`) — 4 file(s) (+36/-40)
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-root.test.ts` *(+16/-16)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-root.vue` *(+1/-1)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-speech-mute.vue` *(+16/-20)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/use-controls-island-placement.ts` *(+3/-3)*

#### Localization (i18n) (`📦 import (additive only)`) — 4 file(s) (+8/-0)
- `packages/i18n/src/locales/en/settings.yaml` *(+3/-0)*
- `packages/i18n/src/locales/en/stage.yaml` *(+1/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+3/-0)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+1/-0)*

#### Stage Layouts & Shells (`🔍 inspect`) — 2 file(s) (+6/-14)
- `packages/stage-layouts/src/composables/use-transcriptions.test.ts` *(+3/-5)*
- `packages/stage-layouts/src/composables/use-transcriptions.ts` *(+3/-9)*

#### UI Primitives & Pages (`📦 import / inspect`) — 1 file(s) (+27/-5)
- `packages/stage-pages/src/pages/settings/modules/consciousness.vue` *(+27/-5)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 1 file(s) (+13/-1)
- `packages/stage-ui-live2d/src/components/scenes/live2d/Canvas.vue` *(+13/-1)*

#### Audio & Speech Pipeline (`🔍 inspect`) — 4 file(s) (+155/-5)
- `packages/stage-ui/src/libs/audio/vad-streaming-session.test.ts` *(+32/-0)*
- `packages/stage-ui/src/libs/audio/vad-streaming-session.ts` *(+5/-5)*
- `packages/stage-ui/src/libs/audio/voice-input-binding.test.ts` *(+60/-0)*
- `packages/stage-ui/src/libs/audio/voice-input-binding.ts` *(+58/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 12 file(s) (+437/-79)
- `packages/stage-ui/src/stores/ai/models/vad.test.ts` *(+63/-0)*
- `packages/stage-ui/src/stores/ai/models/vad.ts` *(+59/-23)*
- `packages/stage-ui/src/stores/mods/api/context-bridge.contract.browser.test.ts` *(+5/-2)*
- `packages/stage-ui/src/stores/modules/consciousness-settings.browser.test.ts` *(+22/-3)*
- `packages/stage-ui/src/stores/modules/consciousness-settings.ts` *(+26/-9)*
- `packages/stage-ui/src/stores/modules/consciousness.test.ts` *(+83/-0)*
- `packages/stage-ui/src/stores/modules/consciousness.ts` *(+14/-5)*
- `packages/stage-ui/src/stores/modules/hearing.ts` *(+104/-36)*
- `packages/stage-ui/src/stores/modules/streaming-transcription-consumers.test.ts` *(+3/-0)*
- `packages/stage-ui/src/stores/modules/streaming-transcription-consumers.ts` *(+5/-0)*
- `packages/stage-ui/src/stores/settings/audio-device.test.ts` *(+44/-0)*
- `packages/stage-ui/src/stores/settings/audio-device.ts` *(+9/-1)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 2 file(s) (+92/-7)
- `server/apps/api/src/routes/audio-transcription-stream/session.test.ts` *(+31/-1)*
- `server/apps/api/src/routes/audio-transcription-stream/session.ts` *(+61/-6)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (10)
- [#2646](https://github.com/moeru-ai/airi/pull/2646) `fix(stage-ui-live2d): draw the resized frame before the compositor takes it` by **@chiba233** *(1 comments)*
- [#2654](https://github.com/moeru-ai/airi/pull/2654) `feat(stage-pages): replace card editor modal with full-screen routes` by **@clansty** *(1 comments)*
- [#2653](https://github.com/moeru-ai/airi/pull/2653) `fix(stage-ui): align provider card content to top` by **@clansty** *(1 comments)*
- [#2651](https://github.com/moeru-ai/airi/pull/2651) `refactor(stage-ui): make voice input and ASR lifecycle explicit` by **@luoling8192** *(4 comments)*
- [#2290](https://github.com/moeru-ai/airi/pull/2290) `feat(server): stream official ASR over WebSocket` by **@luoling8192** *(58 comments)*
- [#2650](https://github.com/moeru-ai/airi/pull/2650) `fix(stage-ui): make custom sampling parameters opt-in` by **@luoling8192** *(2 comments)*
- [#2214](https://github.com/moeru-ai/airi/pull/2214) `feat(tts): add Volcengine streaming BYOK` by **@luoling8192** *(Draft)* *(4 comments)*
- [#2649](https://github.com/moeru-ai/airi/pull/2649) `fix(stage-tamagotchi): correct island dock and simplify chat controls` by **@luoling8192** *(1 comments)*
- [#2648](https://github.com/moeru-ai/airi/pull/2648) `feat(stage-ui): add cloud sync switches for providers and chats` by **@lulu0119** *(Draft)* *(0 comments)*
- [#2647](https://github.com/moeru-ai/airi/pull/2647) `feat(auth): fetch the Steam profile on sign-in` by **@lulu0119** *(1 comments)*

#### 🔄 PR Status & Lifecycle Changes (2)
- [#2641](https://github.com/moeru-ai/airi/pull/2641) `feat(stage-ui): show chat image analysis status` — `OPEN` ➔ `CLOSED`
- [#2645](https://github.com/moeru-ai/airi/pull/2645) `fix(stage-ui): restore voice input after microphone changes` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (3)
- [#2613](https://github.com/moeru-ai/airi/pull/2613) `perf(stage-tamagotchi): remove packaging-only dependencies` — *+1 comments (3 ➔ 4 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+3 comments (118 ➔ 121 total)*
- [#2471](https://github.com/moeru-ai/airi/pull/2471) `feat(stage-ui): sync user providers to a cloud replica` — *+2 comments (65 ➔ 67 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(0 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2550](https://github.com/moeru-ai/airi/pull/2550) `feat(hearing): add bundled Sherpaw speech recognition` [OPEN] — *(17 comments)*
  - *Focus*: Offline Sherpaw STT model packaging (Paraformer/Zipformer) via tsdown and Vite plugin
- [#2641](https://github.com/moeru-ai/airi/pull/2641) `feat(stage-ui): show chat image analysis status` [CLOSED] — *(1 comments)*
  - *Focus*: Accessible live status indicator for text-only models undergoing vision pre-processing

---
## [2026-09-23] Upstream Delta: `308ee2b3..595ea726` (1 commits, 6 files, 7 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 1 commit (`595ea7260d`) across 6 files and recorded 7 PR updates (4 new PRs, 0 status changes, 3 discussion changes). Core focus centered on: (1) Stage Tamagotchi controls-island audio UX (#2643 / `595ea7260d`), replacing the stop-speaking control with an explicit speech mute toggle (`controls-island-speech-mute.vue`); (2) Speech input & VAD resilience (#2645 by @luoling8192), binding voice input only when the microphone stream is ready, serializing start/stop across toggles and device switches, enforcing single VAD ownership, and cleanly tearing down cancelled transcription sessions; (3) Hosted API cost billing & usage ledgering (#2644 by @luoling8192), adding Drizzle schema migrations (`llm_cost_receipts`) and OpenRouter adapters to compute and store token usage costs; (4) Electron desktop authentication stability (#2190 by @Gujiassh), isolating loopback OIDC login attempt identities to prevent stale cancellations; and (5) Ongoing community discussions on offline Sherpaw speech recognition (#2550), packaging-only dependency removal (#2613), and translations (#2121).
* **Discussion & Community Buzz**:
  - 💬 **#2644: `feat(api): add provider cost billing with OpenRouter adapter` (11 comments)**: Immediate high discussion velocity regarding server-side token pricing calculation, receipt schemas, and billing middleware.
  - 💬 **#2550: `feat(hearing): add bundled Sherpaw speech recognition` (+2 new comments, total 17)**: Watched PR continues steady discussion velocity on packaging offline Zipformer/Paraformer models for streaming on-device STT.
  - 💬 **#2190: `fix(stage-tamagotchi): prevent duplicate OIDC login cancellation` (6 comments)**: Discussion resolving desktop race conditions where superseded browser login attempts abort newly initiated sign-in flows.
  - 💬 **#2121: `chore(i18n): update translations` (+4 new comments, total 118)**: High-volume rolling localization maintenance.
  - 💬 **#2613: `perf(stage-tamagotchi): remove packaging-only dependencies` (+2 new comments, total 3)**: Pruning dev-only packaging tools from the Electron production bundle footprint.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2645 [Open PR]: `fix(stage-ui): restore voice input after microphone changes`**: High value for audio/speech input stability. Fixes an issue where switching microphone devices or hot-plugging caused input streaming to hang without reconnecting. It serializes audio state transitions, binds speech listeners only after stream acquisition, ensures single-owner VAD per mode, and implements clean teardown of upstream audio streams upon cancellation. Relevant to `packages/stage-ui/src/stores/modules/hearing.ts`, `vad.ts`, and audio device management.
  - 🔍 **PR #2641 [Open PR - Watched]: `feat(stage-ui): show chat image analysis status`**: Continues on watchlist. Adds accessible status indication during vision pre-processing for text-only LLMs.
  - 🔍 **PR #2550 [Open PR - Watched]: `feat(hearing): add bundled Sherpaw speech recognition`**: Offline STT packaging via Vite/tsdown. Keep tracking for local speech pipeline alternatives.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **Commit `595ea7260d` / PR #2643 (`controls-island-speech-mute.vue`)**: Upstream continues modifying `controls-island`. This fork permanently deleted `controls-island` in favor of the decoupled Control Strip (`windows/main`, `ControlStrip.vue`).
    - **PR #2644 (Provider cost billing & OpenRouter adapter)**: Hosted server-side API billing, Drizzle DB migrations, and PostgreSQL tables for hosted AIRI services. Incompatible with this fork's strictly local-first, zero-account, client-only architecture.
    - **PR #2190 (OIDC login cancellation fix)**: Desktop OIDC authentication services (`auth.ts`). This fork does not use hosted cloud accounts or OIDC authentication.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/modules/hearing.ts` & `vad.ts` (PR #2645)**: If porting PR #2645's microphone recovery improvements, review our fork's speech runtime / audio input pipeline to ensure custom VAD configurations, live session integrations, and actor speech routing remain intact.
  - ⚠️ **`apps/stage-tamagotchi/src/main/services/airi/auth.ts` (PR #2190)**: Upstream continues expanding Electron main process OIDC authentication state machines. Our fork does not maintain or run this remote service.
  - ⚠️ **`apps/stage-tamagotchi/.../controls-island/` (Commit `595ea7260d`)**: Upstream still relies on the monolith stage island. Any speech mute features in our fork should be wired into the Control Strip actions, not `controls-island`.

### 📋 Upstream Commits
- `595ea7260d` fix(stage-tamagotchi): mute speech output from the controls island (#2643) [#2643](https://github.com/moeru-ai/airi/pull/2643) _(蓝莓🫐, 2026-09-23)_

### 🔬 Subsystem Breakdown
#### Deprecated Surfaces (Control Island) (`⚪ ignore / rejected in fork (decoupled into Control Strip)`) — 4 file(s) (+87/-70)
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/{controls-island-stop-speaking.test.ts => controls-island-speech-mute.test.ts}` *(+28/-24)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-speech-mute.vue` *(+57/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-stop-speaking.vue` *(+0/-44)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/index.vue` *(+2/-2)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+4/-4)
- `packages/i18n/src/locales/en/tamagotchi/stage.yaml` *(+2/-2)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/stage.yaml` *(+2/-2)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (4)
- [#2645](https://github.com/moeru-ai/airi/pull/2645) `fix(stage-ui): restore voice input after microphone changes` by **@luoling8192** *(1 comments)*
- [#2644](https://github.com/moeru-ai/airi/pull/2644) `feat(api): add provider cost billing with OpenRouter adapter` by **@luoling8192** *(11 comments)*
- [#2643](https://github.com/moeru-ai/airi/pull/2643) `fix(stage-tamagotchi): mute speech output from the controls island` by **@chiba233** *(1 comments)*
- [#2190](https://github.com/moeru-ai/airi/pull/2190) `fix(stage-tamagotchi): prevent duplicate OIDC login cancellation` by **@Gujiassh** *(6 comments)*

#### 💬 Discussion Activity (3)
- [#2613](https://github.com/moeru-ai/airi/pull/2613) `perf(stage-tamagotchi): remove packaging-only dependencies` — *+2 comments (1 ➔ 3 total)*
- [#2550](https://github.com/moeru-ai/airi/pull/2550) `feat(hearing): add bundled Sherpaw speech recognition` — *+2 comments (15 ➔ 17 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+4 comments (114 ➔ 118 total)*

### 👁️ Watched PRs Monitor
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` [Draft] — *(0 comments)*
  - *Focus*: External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage
- [#2550](https://github.com/moeru-ai/airi/pull/2550) `feat(hearing): add bundled Sherpaw speech recognition` [OPEN] — 🚨 **+2 comments** (17 total)
  - *Focus*: Offline Sherpaw STT model packaging (Paraformer/Zipformer) via tsdown and Vite plugin
- [#2641](https://github.com/moeru-ai/airi/pull/2641) `feat(stage-ui): show chat image analysis status` [OPEN] — *(1 comments)*
  - *Focus*: Accessible live status indicator for text-only models undergoing vision pre-processing

---
## [2026-09-22] Upstream Delta: `8e2e5b01..308ee2b3` (10 commits, 47 files, 21 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 10 commits (`8e2e5b01..308ee2b3`) across 47 files and recorded 21 PR updates (13 new, 2 status changes, 6 discussion changes). Core focus centered on: (1) chat image analysis optimization and concurrency (#2640, #2635), caching generated image descriptions on chat message history to prevent redundant vision inference across turns, and throttling concurrent image descriptions using a 4-slot Semaphore while preserving turn order; (2) session selection stabilization (#2630, #2631), decoupling shared index updates from window-local navigation to fix Issue #2595 (where initial message sync restored stale sessions); (3) web and layout chat control refinements (#2633), extracting `chat-panel-header.vue` and modularizing session list/drawer components; (4) authentication staleness protection (#2483), rejecting out-of-order auth requests; (5) dependency and tooling updates, bumping `@moeru/eventa` to 1.0.1 (#2632) and nix pnpmDeps hash (#2637); and (6) server deployment cleanup (#2642), removing deprecated Railway configs.
* **Discussion & Community Buzz**:
  - 💬 **#2471: `feat(stage-ui): sync user providers to a cloud replica` (+3 new comments, total 65)**: Continuous heavy discussion on hosted cloud replica syncing of user providers vs. client privacy and local storage.
  - 💬 **#2484: `feat(stage-ui): show Cloud announcements on Web and Electron` (+5 new comments, total 27)**: Fast-moving velocity discussing broadcast cloud announcement banners across Web and desktop platforms.
  - 💬 **#2550: `feat(hearing): add bundled Sherpaw speech recognition` (+5 new comments, total 15)**: Notable velocity on bundling Sherpaw streaming STT models (Paraformer / Zipformer) with tsdown packaging and Vite plugin delivery.
  - 💬 **#2121: `chore(i18n): update translations` (+3 new comments, total 114)**: Continuous community translation stream crossing 114 total comments.
  - 💬 **#2624: `fix(stage-ui): interrupt active chat responses` (+1 new comments, total 39)**: Sustained discussion on multi-window abort signals and partial assistant message retention.
  - 💬 **#1139: `feat: Add export/import config buttons` (21 comments)**: Re-emerged activity around config export/import for first-time setup and DevTools.
  - 💬 **#2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` (Draft)**: High-profile community architecture RFC introducing `@proj-airi/cortico-bridge` daemon to replace local memory with external Cortico workspace.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2635 (Commit `f9f440b236`) & PR #2640 (Commit `2d8bcd43f2`): Image description caching & Semaphore concurrency**: High value for stage chat. PR #2635 adds `imageDescriptions` caching to chat session message records, preventing expensive repeated vision inference calls on historical turns during multi-turn chats with text-only models. PR #2640 bounds concurrency to 4 simultaneous tasks with `Semaphore` from `es-toolkit` while maintaining source order via `Promise.all`.
  - ⭐ **PR #2630 (Commit `5a21724640`) & PR #2631 (Commit `1cb4fad3d4`): Decouple shared index sync from window-local session navigation**: Clean state-machine fix for Issue #2595. Deletes the reactive `watch(index)` in `session-store.ts` that caused incoming synchronized index broadcasts to reset the user's active session selection during the first message in a newly created session.
  - 🔍 **PR #2641 [Open PR]: Accessible `Analyzing images…` status**: Adds an accessible live status indicator to the chat history while uncached images are undergoing vision analysis. Clean UX enhancement to monitor when upstream merges.
  - 🔍 **PR #2550 [Open PR]: Bundled Sherpaw offline streaming speech recognition**: Adds local streaming STT via Sherpaw (Paraformer/Zipformer). While our fork uses Whisper WebGPU, bundling lightweight on-device Chinese/English models is an interesting alternative worth tracking.
  - ⚪ **Auto-Reject / Do Not Port**:
    - **PR #2634 (Cortico bridge)**: Externalizes cognitive brain to a separate daemon process (`ws://localhost:6122`) and eliminates STMM/LTMM. Our fork has native two-layer STMM summaries, immutable LTMM Sacred Journal, Dreaming reflections, and Echo chips built directly into the engine.
    - **PR #2636 (S3 sync via hosted API server)**: Cloud relay attachment storage routed through remote API server. Our fork already has native client-side BYOS (direct to S3/R2/Drive) without central accounts.
    - **PR #2483 / #2471 / #2484 (Auth / Cloud Replica / Cloud Announcements)**: Conflicts with our strict local-first, zero-telemetry, account-free architecture.
    - **`controls-island-auth-button.vue`**: Modifies deprecated and removed `controls-island` surface.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts` (Commit `f9f440b236`)**: Upstream modified `chat.ts` to add `getImageDescription` and `saveImageDescription`. Our fork's `chat.ts` contains deep divergent customizations (multi-actor `<|ACTOR|>` orchestration, STMM/LTMM hooks, Echo chips, and universe scoping). Do not overwrite; cherry-pick the caching methods manually.
  - ⚠️ **`packages/stage-ui/src/stores/chat/session-store.ts` (Commits `5a21724640`, `1cb4fad3d4`)**: Upstream touched session lifecycle watchers and selection state. Our fork has custom universe metadata and session persistence. Apply the removal of `watch(index)` carefully without wiping fork-specific session initialization logic.
  - ⚠️ **`apps/stage-tamagotchi/src/main/services/airi/auth.ts` (Commit `7e2ecdce17`)**: Upstream continues expanding Electron main-process authentication services and endpoints. This fork does not run hosted cloud authentication.

### 📋 Upstream Commits
- `308ee2b3aa` chore(server): remove deprecated Railway configs (#2642) [#2642](https://github.com/moeru-ai/airi/pull/2642) _(RainbowBird, 2026-09-22)_
- `2d8bcd43f2` perf(stage-ui): analyze chat images concurrently (#2640) [#2640](https://github.com/moeru-ai/airi/pull/2640) _(RainbowBird, 2026-09-22)_
- `f9f440b236` fix(stage-ui): reuse chat image descriptions (#2635) [#2635](https://github.com/moeru-ai/airi/pull/2635) _(RainbowBird, 2026-09-22)_
- `6783485bad` docs(skills): add adaptive PR context guidance (#2638) [#2638](https://github.com/moeru-ai/airi/pull/2638) _(RainbowBird, 2026-09-22)_
- `892a199996` chore(nix): update pnpmDeps hash (#2637) [#2637](https://github.com/moeru-ai/airi/pull/2637) _(Weathercold, 2026-09-22)_
- `5c8449c244` chore(deps): bump eventa to 1.0.1 (#2632) [#2632](https://github.com/moeru-ai/airi/pull/2632) _(Neko, 2026-09-22)_
- `7e2ecdce17` fix(auth): discard stale authentication requests (#2483) [#2483](https://github.com/moeru-ai/airi/pull/2483) _(RainbowBird, 2026-09-22)_
- `686479e67c` feat(stage-layouts): refine web chat controls (#2633) [#2633](https://github.com/moeru-ai/airi/pull/2633) _(RainbowBird, 2026-09-22)_
- `1cb4fad3d4` refactor(stage-ui): separate chat data from selection (#2631) [#2631](https://github.com/moeru-ai/airi/pull/2631) _(RainbowBird, 2026-09-22)_
- `5a21724640` fix(stage-ui): preserve new chat selection (#2630) [#2630](https://github.com/moeru-ai/airi/pull/2630) _(RainbowBird, 2026-09-22)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 2 file(s) (+259/-16)
- `.agents/skills/create-pr/SKILL.md` *(+104/-16)*
- `.agents/skills/create-pr/references/pr-body.md` *(+155/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 12 file(s) (+626/-48)
- `.agents/skills/create-pr/agents/openai.yaml` *(+1/-1)*
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/stage-ui/src/components/misc/profile-switcher-popover.vue` *(+12/-6)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-dialog.browser.test.ts` *(+68/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-dialog.vue` *(+60/-4)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-drawer.vue` *(+7/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-list.vue` *(+133/-15)*
- `packages/stage-ui/src/libs/auth-fetch.ts` *(+8/-8)*
- `packages/stage-ui/src/stores/auth.browser.test.ts` *(+258/-0)*
- `packages/stage-ui/src/stores/auth.test.ts` *(+2/-0)*
- `packages/stage-ui/src/stores/auth.ts` *(+75/-12)*
- `pnpm-workspace.yaml` *(+1/-1)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 7 file(s) (+219/-49)
- `apps/stage-tamagotchi/src/main/services/airi/auth.test.ts` *(+138/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/auth.ts` *(+62/-45)*
- `apps/stage-tamagotchi/src/main/services/airi/http-server/server.ts` *(+3/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-onboarding-authentication.test.ts` *(+6/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-onboarding-authentication.ts` *(+6/-3)*
- `apps/stage-tamagotchi/src/renderer/pages/onboarding.vue` *(+1/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/account/index.vue` *(+3/-1)*

#### Deprecated Surfaces (Control Island) (`⚪ ignore / rejected in fork (decoupled into Control Strip)`) — 2 file(s) (+9/-6)
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-auth-button.test.ts` *(+6/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-auth-button.vue` *(+3/-6)*

#### Core Agent Runtime (`🔍 inspect`) — 1 file(s) (+5/-0)
- `packages/core-agent/src/types/chat.ts` *(+5/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 2 file(s) (+28/-28)
- `packages/electron-screen-capture/package.json` *(+1/-1)*
- `pnpm-lock.yaml` *(+27/-27)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+2/-0)
- `packages/i18n/src/locales/en/stage.yaml` *(+1/-0)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+1/-0)*

#### Stage Layouts & Shells (`🔍 inspect`) — 7 file(s) (+161/-101)
- `packages/stage-layouts/src/components/Layouts/Header.vue` *(+0/-2)*
- `packages/stage-layouts/src/components/Layouts/HeaderAvatar.vue` *(+1/-1)*
- `packages/stage-layouts/src/components/Layouts/InteractiveArea.vue` *(+3/-1)*
- `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` *(+1/-1)*
- `packages/stage-layouts/src/components/Widgets/ChatActionButtons.vue` *(+65/-31)*
- `packages/stage-layouts/src/components/Widgets/ChatArea.vue` *(+22/-65)*
- `packages/stage-layouts/src/components/Widgets/chat-panel-header.vue` *(+69/-0)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 7 file(s) (+272/-32)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+34/-0)*
- `packages/stage-ui/src/stores/chat.ts` *(+51/-6)*
- `packages/stage-ui/src/stores/chat/image-projection.test.ts` *(+63/-2)*
- `packages/stage-ui/src/stores/chat/image-projection.ts` *(+27/-17)*
- `packages/stage-ui/src/stores/chat/session-store.browser.test.ts` *(+38/-0)*
- `packages/stage-ui/src/stores/chat/session-store.test.ts` *(+59/-0)*
- `packages/stage-ui/src/stores/chat/session-store.ts` *(+0/-7)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 5 file(s) (+23/-57)
- `server/README.md` *(+13/-12)*
- `server/apps/api/README.md` *(+5/-5)*
- `server/apps/api/railway.toml` *(+0/-18)*
- `server/apps/auth/README.md` *(+5/-5)*
- `server/apps/auth/railway.toml` *(+0/-17)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (13)
- [#1139](https://github.com/moeru-ai/airi/pull/1139) `feat: Add export/import config buttons, integrated into the Airi first-time setup page and DevTools page` by **@Decolv** *(21 comments)*
- [#2642](https://github.com/moeru-ai/airi/pull/2642) `chore(server): remove deprecated Railway configs` by **@luoling8192** *(1 comments)*
- [#2640](https://github.com/moeru-ai/airi/pull/2640) `perf(stage-ui): analyze chat images concurrently` by **@luoling8192** *(1 comments)*
- [#2641](https://github.com/moeru-ai/airi/pull/2641) `feat(stage-ui): show chat image analysis status` by **@luoling8192** *(1 comments)*
- [#2639](https://github.com/moeru-ai/airi/pull/2639) `feat(stage-kirie): adopt Android devices` by **@LemonNekoGH** *(Draft)* *(0 comments)*
- [#2635](https://github.com/moeru-ai/airi/pull/2635) `fix(stage-ui): reuse chat image descriptions` by **@luoling8192** *(1 comments)*
- [#2636](https://github.com/moeru-ai/airi/pull/2636) `feat(chat): sync image attachments through S3` by **@luoling8192** *(1 comments)*
- [#2638](https://github.com/moeru-ai/airi/pull/2638) `docs(skills): add adaptive PR context guidance` by **@luoling8192** *(2 comments)*
- [#2637](https://github.com/moeru-ai/airi/pull/2637) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2632](https://github.com/moeru-ai/airi/pull/2632) `chore(deps): bump eventa to 1.0.1` by **@nekomeowww** *(2 comments)*
- [#2634](https://github.com/moeru-ai/airi/pull/2634) `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` by **@peachoolong-uwu** *(Draft)* *(0 comments)*
- [#2633](https://github.com/moeru-ai/airi/pull/2633) `feat(stage-layouts): refine web chat controls` by **@luoling8192** *(1 comments)*
- [#2631](https://github.com/moeru-ai/airi/pull/2631) `refactor(stage-ui): separate chat data from selection` by **@luoling8192** *(4 comments)*

#### 🔄 PR Status & Lifecycle Changes (2)
- [#2483](https://github.com/moeru-ai/airi/pull/2483) `fix(auth): discard stale authentication requests` — `OPEN` ➔ `MERGED`
- [#2630](https://github.com/moeru-ai/airi/pull/2630) `fix(stage-ui): preserve new chat selection` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (6)
- [#2471](https://github.com/moeru-ai/airi/pull/2471) `feat(stage-ui): sync user providers to a cloud replica` — *+3 comments (62 ➔ 65 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+3 comments (111 ➔ 114 total)*
- [#2550](https://github.com/moeru-ai/airi/pull/2550) `feat(hearing): add bundled Sherpaw speech recognition` — *+5 comments (10 ➔ 15 total)*
- [#2483](https://github.com/moeru-ai/airi/pull/2483) `fix(auth): discard stale authentication requests` — *+4 comments (2 ➔ 6 total)*
- [#2484](https://github.com/moeru-ai/airi/pull/2484) `feat(stage-ui): show Cloud announcements on Web and Electron` — *+5 comments (22 ➔ 27 total)*
- [#2624](https://github.com/moeru-ai/airi/pull/2624) `fix(stage-ui): interrupt active chat responses` — *+1 comments (38 ➔ 39 total)*

---
## [2026-09-21] Upstream Delta: `6670dc9d..8e2e5b01` (5 commits, 32 files, 9 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 5 commits (`6670dc9d..8e2e5b01`) across 32 files and recorded 9 PR updates (7 new, 0 status/lifecycle changes, 2 discussion changes). Focus centered on: (1) native vision routing and client-side image compression (#2629), bypassing intermediate pre-description when models support vision natively and introducing canvas downscaling to 3MB; (2) active chat response interruption and abort handling (#2624), retaining partial assistant outputs marked `{ interrupted: true }` and coordinating TTS speech cancellation with new prompt sends via `useChatInterruption`; (3) chat action control unification across Web/Mobile/Electron (#2623), standardizing stop/send actions to 36px circular buttons with a square stop glyph; (4) Web image controls alignment (#2622), switching to a gallery icon and unifying 32px secondary controls; and (5) Mobile composer stabilization (#2621), adopting a fixed 3-part layout and removing legacy dock/drag code.
* **Discussion & Community Buzz**:
  - 💬 **#2624: `fix(stage-ui): interrupt active chat responses` (38 comments)**: Heavy discussion on interaction ergonomics, abort signal handling, partial message persistence, and coordinating multi-window/BroadcastChannel cancellations across LLM streams and audio playback.
  - 💬 **#2629: `feat(stage-ui): route chat images to native vision` (22 comments)**: High interest and debate over native vision dispatch vs. pre-description fallbacks, canvas client-side image downscaling, and attachment byte caps.
  - 💬 **#2121: `chore(i18n): update translations` (+3 new comments, total 111)**: Milestone crossing 110+ comments for ongoing multilingual community translation sync.
  - 💬 **#2567: `feat(provider-inference): add AnonRouter chat provider` (+1 new comments, total 4)**: Continued interest in anonymous router inference provider integration.
  - 💬 **#2630: `fix(stage-ui): preserve new chat selection` (2 comments)**: Active review on preserving selection state when switching or creating chats.
  - 💬 **#2627: `fix(stage-ui): initialize Kokoro catalogs before discovery` (2 comments)**: New fix addressing Kokoro local TTS catalog initialization race condition before model discovery runs.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2629 / Commit `8e2e5b010d`: Client-side image compression & native vision routing**: High value for stage chat ergonomics. Modifies `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-images.ts` with `compressImage` (canvas downscaling to max edge 1920, JPEG quality 0.85, 3MB cap), preventing payload explosion/OOM on high-res image pastes. The native vision check (`selectedModel?.metadata?.abilities?.vision === true`) is also a clean bypass for multimodal models.
  - ⭐ **PR #2624 / Commit `fe11decc22`: Partial message preservation on abort & `interrupted: true` flag**: Excellent UX fix. Retains streamed partial assistant text when aborted (`abortSignal.aborted && hasAssistantOutput(buildingMessage)`) and appends it to session history with `{ interrupted: true }` instead of dropping it completely.
  - 🔍 **PR #2627 [Open PR]: `fix(stage-ui): initialize Kokoro catalogs before discovery`**: Worth evaluating for our local Kokoro TTS pipeline to ensure voice catalogs are populated before model discovery queries them.
  - 🔍 **PR #2623 / Commit `dce185ba1d` & PR #2622 / Commit `8abff7a238`: Chat composer action styling**: Clean visual polish aligning secondary action buttons (gallery icon, mic, send) and unified stop glyph. Can be adapted into our custom chat composer.
  - ⚪ **Auto-Reject / Do Not Port**: Upstream `packages/core-agent/` architectural abstractions (this fork uses Pinia stores for chat orchestration); upstream `MobileInteractiveArea.vue` and `InteractiveArea.vue` full file ports (conflicts with our 1.8k-line customized `InteractiveArea.vue` which houses text journal, STMM/LTMM, echo chips, and autonomous artistry).
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts` (Commits `8e2e5b010d`, `fe11decc22`)**: Upstream touched `chat.ts` for vision routing and `cancelPendingSends`. Our fork contains extensive custom logic (multi-actor `<|ACTOR|>` switching, STMM/LTMM text journal hooks, Echo chips, and universe scoping). Do not merge directly; cherry-pick isolated snippets only.
  - ⚠️ **`apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` (Commits `fe11decc22`, `dce185ba1d`)**: Upstream modified stop/send controls and event handling in `InteractiveArea.vue`. In our fork, `InteractiveArea.vue` is heavily customized with memory and artistry modals.
  - ⚠️ **`packages/core-agent/` Architecture**: Upstream moved core chat runtime into `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts`. Our fork maintains runtime logic in `packages/stage-ui/src/stores/chat/`. Any port of interruption logic must be implemented in the store layer.

### 📋 Upstream Commits
- `8e2e5b010d` feat(stage-ui): route chat images to native vision (#2629) [#2629](https://github.com/moeru-ai/airi/pull/2629) _(RainbowBird, 2026-09-21)_
- `fe11decc22` fix(stage-ui): interrupt active chat responses (#2624) [#2624](https://github.com/moeru-ai/airi/pull/2624) _(RainbowBird, 2026-09-21)_
- `dce185ba1d` refactor(stage-layouts): unify chat action controls (#2623) [#2623](https://github.com/moeru-ai/airi/pull/2623) _(RainbowBird, 2026-09-21)_
- `8abff7a238` fix(stage-layouts): align web image controls (#2622) [#2622](https://github.com/moeru-ai/airi/pull/2622) _(RainbowBird, 2026-09-21)_
- `59af59fbbf` fix(stage-layouts): stabilize mobile chat composer (#2621) [#2621](https://github.com/moeru-ai/airi/pull/2621) _(RainbowBird, 2026-09-21)_

### 🔬 Subsystem Breakdown
#### Electron Desktop Shell (`⚠️ hand-merge`) — 2 file(s) (+41/-73)
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+14/-58)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+27/-15)*

#### Core Agent Runtime (`🔍 inspect`) — 2 file(s) (+35/-0)
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.test.ts` *(+27/-0)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts` *(+8/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+6/-4)
- `packages/i18n/src/locales/en/stage.yaml` *(+3/-2)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+3/-2)*

#### Stage Layouts & Shells (`🔍 inspect`) — 10 file(s) (+542/-323)
- `packages/stage-layouts/src/components/Layouts/InteractiveArea.vue` *(+6/-1)*
- `packages/stage-layouts/src/components/Layouts/InteractiveArea/Actions/ViewControls.vue` *(+10/-5)*
- `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` *(+67/-250)*
- `packages/stage-layouts/src/components/Widgets/ChatActionButtons.vue` *(+20/-37)*
- `packages/stage-layouts/src/components/Widgets/ChatArea.vue` *(+47/-29)*
- `packages/stage-layouts/src/components/Widgets/ChatToolbarButton.vue` *(+26/-0)*
- `packages/stage-layouts/src/composables/use-chat-interruption.test.ts` *(+242/-0)*
- `packages/stage-layouts/src/composables/use-chat-interruption.ts` *(+105/-0)*
- `packages/stage-layouts/src/composables/useStopSpeakingButton.test.ts` *(+12/-0)*
- `packages/stage-layouts/src/composables/useStopSpeakingButton.ts` *(+7/-1)*

#### UI Primitives & Pages (`📦 import / inspect`) — 1 file(s) (+2/-2)
- `packages/stage-pages/src/pages/settings/data/components/chats-section.vue` *(+2/-2)*

#### Other / Uncategorized (`🔍 inspect`) — 13 file(s) (+397/-50)
- `packages/stage-ui/src/components/scenarios/chat/components/image-attachment-preview.vue` *(+2/-2)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-composer.test.ts` *(+36/-0)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-composer.ts` *(+14/-3)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-images.browser.test.ts` *(+1/-1)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-images.ts` *(+74/-13)*
- `packages/stage-ui/src/components/scenarios/chat/index.ts` *(+1/-1)*
- `packages/stage-ui/src/composables/use-data-maintenance.ts` *(+4/-4)*
- `packages/stage-ui/src/stores/mods/api/context-bridge.contract.browser.test.ts` *(+137/-7)*
- `packages/stage-ui/src/stores/mods/api/context-bridge.ts` *(+58/-16)*
- `packages/stage-ui/src/stores/mods/api/context-channel.test.ts` *(+14/-0)*
- `packages/stage-ui/src/stores/mods/api/context-channel.ts` *(+11/-0)*
- `packages/stage-ui/src/stores/speech-output-control.browser.test.ts` *(+32/-0)*
- `packages/stage-ui/src/stores/speech-output-control.ts` *(+13/-3)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 2 file(s) (+103/-8)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+98/-5)*
- `packages/stage-ui/src/stores/chat.ts` *(+5/-3)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (7)
- [#2630](https://github.com/moeru-ai/airi/pull/2630) `fix(stage-ui): preserve new chat selection` by **@luoling8192** *(2 comments)*
- [#2629](https://github.com/moeru-ai/airi/pull/2629) `feat(stage-ui): route chat images to native vision` by **@luoling8192** *(22 comments)*
- [#2627](https://github.com/moeru-ai/airi/pull/2627) `fix(stage-ui): initialize Kokoro catalogs before discovery` by **@lorenzozanee** *(2 comments)*
- [#2624](https://github.com/moeru-ai/airi/pull/2624) `fix(stage-ui): interrupt active chat responses` by **@luoling8192** *(38 comments)*
- [#2623](https://github.com/moeru-ai/airi/pull/2623) `refactor(stage-layouts): unify chat action controls` by **@luoling8192** *(1 comments)*
- [#2622](https://github.com/moeru-ai/airi/pull/2622) `fix(stage-layouts): unify web chat controls` by **@luoling8192** *(1 comments)*
- [#2621](https://github.com/moeru-ai/airi/pull/2621) `fix(stage-layouts): align chat image controls` by **@luoling8192** *(1 comments)*

#### 💬 Discussion Activity (2)
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+3 comments (108 ➔ 111 total)*
- [#2567](https://github.com/moeru-ai/airi/pull/2567) `feat(provider-inference): add AnonRouter chat provider` — *+1 comments (3 ➔ 4 total)*

---
## [2026-09-20] Upstream Delta: `62ef8676..6670dc9d` (12 commits, 124 files, 33 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 12 commits (`62ef8676..6670dc9d`) across 124 files and recorded 33 PR updates (20 new, 7 status/lifecycle changes, 6 discussion changes). The dominant developments are: (1) multimodal chat image understanding across Web and Electron (#2551), allowing vision models to describe attached images before passing prompt text to chat models; (2) screen ambient lighting for Live2D models (#2391), a 6.8k-line feature introducing real-time display color sampling and Live2D shaders; (3) TTS chunking optimization (#2584), enforcing `minimumWords` on boost chunks to eliminate micro-fragment delays; (4) settings layout scroll reset (#2606) and inlay window reuse (#2600); (5) Safari/Firefox streaming transcription buffering (#2610); and (6) server-side payment CORE refactoring (#2368) and auth session fixes (#2614). In PRs, desktop performance bundling (#2603, #2611, #2612, #2613), window/cursor IPC deduplication (#2607), and 3D bounding box caching (#2608) are active.
* **Discussion & Community Buzz**:
  - 💬 **#2551: `feat(stage-ui): add chat image understanding across Web and Electron` (+11 new comments, total 23)**: High volume of technical discussion and visual regression verification leading to merge, covering mobile/desktop image paste and vision model prompt projections.
  - 💬 **#2614: `fix(auth): avoid bridge sessions on token routes` (19 comments)**: Intense debate over hosted auth bridge sessions and token request routing.
  - 💬 **#2391: `feat(stage-*): add screen ambient light` (+5 new comments, total 19)**: Shipped feature with active community feedback on ambient light shader performance and screen color sampling.
  - 💬 **#2615: `fix(auth): stop minting sessions for jwt requests` (15 comments)**: Substantial discussion regarding JWT request session lifecycle.
  - 💬 **#2368: `refactor(api): extract payment CORE to support other payment providers [2/2]` (+1 new comments, total 12)**: Architectural discussion on abstracting payment providers beyond Stripe.
  - 💬 **#2121: `chore(i18n): update translations` (+3 new comments, total 108)**: Milestone crossing 100+ comments for ongoing multilingual community translation sync.
  - 💬 **#1971: `feat(mcp): progressive tool disclosure — awareness catalog + on-use native promotion` (10 comments)**: Active interest in MCP progressive tool discovery patterns.
  - 💬 **#2606: `fix(stage-layouts): reset scroll when settings pages change` (9 comments)**: Discussion and verification around viewport reuse during settings page transitions.
  - 💬 **#1974: `feat(hearing): local voice — STT/TTS wiring, caption window, global shortcuts, VAD auto-send` (9 comments)**: Continued community attention on local voice pipeline architecture.
  - 💬 **#1973: `feat(memory): opt-in long-term memory (local IndexedDB store + recall)` (9 comments)**: Ongoing discussion around local long-term memory store.
  - 💬 **#1975: `feat(vision): headless background screen vision as a silent chat-context signal` (8 comments)**: Discussion regarding headless screen perception signals.
  - 💬 **#2610: `fix(stage-ui): buffer Safari transcription stream uploads` (7 comments)**: Troubleshooting Safari/Firefox `Request.duplex` lack of support.
  - 💬 **#1972: `feat(stage-ui): configurable chat response length limits` (7 comments)**: Community interest in configurable response token caps.
  - 💬 **#2603: `perf(stage-tamagotchi): reduce packaged desktop bundle size` (+2 new comments, total 5)**: Split into modular PRs (#2611, #2612, #2613) to trim CJK fonts, duplicate ONNX runtimes, and build-only deps.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2584 / Commit `b972b9fcae`: `fix(pipelines-audio): stop yielding tiny boost chunks`**: High-value audio pipeline fix. Modifies `packages/pipelines-audio/src/processors/tts-chunker.ts` to require `chunkWordsCount >= minimumWords` during boost chunking, preventing tiny leading phrases (e.g. `嗯，`) from incurring full synthesis round-trip latency and causing audio stutter. Clean, isolated, and tested.
  - ⭐ **PR #2606 / Commit `aea991bd9e`: `fix(stage-layouts): reset scroll when settings pages change`**: Clean UX fix in `packages/stage-layouts/src/layouts/settings.vue`. Fixes scroll retention across settings pages when `RouterView` reuses the viewport container by resetting `scrollTop = 0` on `route.path` change.
  - ⭐ **PR #2610 / Commit `4804e7989e`: `fix(stage-ui): buffer Safari transcription stream uploads`**: Cross-browser fix in `packages/stage-ui/src/libs/providers/stream-transcription/index.ts`. Detects `duplex in Request.prototype` and falls back to an `ArrayBuffer` body when streaming uploads are unsupported by Safari 27 and Firefox.
  - ⭐ **PR #2600 / Commit `32cb0433b8`: `fix(stage-tamagotchi): reuse the inlay window and add a close control`**: Electron window lifecycle fix. Reuses existing inlay window instances and adds an explicit close action, preventing window leaks in `apps/stage-tamagotchi/src/main/windows/inlay/`.
  - 🔍 **PR #2607: `perf(stage-tamagotchi): stop re-sending unchanged cursor position and window bounds` [Draft]**: Good candidate once finalized to suppress redundant Electron IPC traffic during mouse movement.
  - 🔍 **PR #2608 & #2609: `perf(stage-ui-three)`**: VRM framerate limiting and bounding box layout caching; worth evaluating for 3D performance improvements.
  - 🔍 **PR #2611, #2612, #2613: `perf(stage-tamagotchi)`**: Desktop packaging footprint optimizations (stripping redundant ONNX runtimes and non-essential font subsets).
  - 🔍 **PR #2551 / Commit `29ac56b95d` (`describeChatImages` helper)**: Standalone helper `packages/stage-ui/src/stores/chat/image-projection.ts` can be selectively adapted for pre-describing images with a vision model before sending to text-only LLMs.
  - ⚪ **Auto-Reject / Do Not Port**: Commits `9805c0a0f3` (PR #2368) & `21096a4389` (PR #2614), PR #2615 (hosted billing, Stripe drizzle drop, server auth tokens); Commit `26f37192e0` (PR #2391 screen ambient light directly modifies legacy monolithic `index.vue` / `controls-island`, incompatible with our decoupled `RendererStage.vue`).
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts` (Commit `29ac56b95d` / PR #2551)**: Upstream modifies `chat.ts` for vision image projection. Our fork has heavy customizations in `chat.ts` (multi-actor `<|ACTOR|>` switching, STMM/LTMM text journal integration, Echo chips). Do not merge directly; extract modular logic from `image-projection.ts` if needed.
  - ⚠️ **`packages/stage-layouts/src/components/Widgets/ChatArea.vue` & `InteractiveArea.vue` (Commit `29ac56b95d`)**: Upstream reworked clipboard and drag/drop handlers in `ChatArea.vue`. Our fork uses dedicated decoupled chat layouts (`airi-desktop-chatbox`) with grounding panels and custom tokens.
  - ⚠️ **`apps/stage-tamagotchi/src/renderer/pages/index.vue` (Commit `26f37192e0` / PR #2391)**: Upstream attaches screen ambient lighting to the monolithic `pages/index.vue`. Our fork decoupled the stage into `RendererStage.vue` and `ControlStripHost.vue`. Any port of screen ambient light must target `RendererStage.vue`.
  - ⚠️ **`packages/ui/src/components/form/content-editable/` (Commit `175638973d`)**: Upstream deleted `basic-content-editable.vue`. Verify if our fork references this before syncing UI primitives.

### 📋 Upstream Commits
- `6670dc9d13` test(stage-ui): control idle timing in desktop pan regression (#2620) [#2620](https://github.com/moeru-ai/airi/pull/2620) _(Neko, 2026-09-20)_
- `29ac56b95d` feat(stage-ui): add chat image understanding across Web and Electron (#2551) [#2551](https://github.com/moeru-ai/airi/pull/2551) _(RainbowBird, 2026-09-20)_
- `31e9b32182` chore(nix): update pnpmDeps hash (#2619) [#2619](https://github.com/moeru-ai/airi/pull/2619) _(Weathercold, 2026-09-20)_
- `bdabe0934e` fix(stage-pocket): hide iOS keyboard accessory bar (#2618) [#2618](https://github.com/moeru-ai/airi/pull/2618) _(RainbowBird, 2026-09-20)_
- `32cb0433b8` fix(stage-tamagotchi): reuse the inlay window and add a close control (#2600) [#2600](https://github.com/moeru-ai/airi/pull/2600) _(xy, 2026-09-20)_
- `aea991bd9e` fix(stage-layouts): reset scroll when settings pages change (#2606) [#2606](https://github.com/moeru-ai/airi/pull/2606) _(Neko, 2026-09-20)_
- `21096a4389` fix(auth): avoid bridge sessions on token routes (#2614) [#2614](https://github.com/moeru-ai/airi/pull/2614) _(RainbowBird, 2026-09-20)_
- `4804e7989e` fix(stage-ui): buffer Safari transcription stream uploads (#2610) [#2610](https://github.com/moeru-ai/airi/pull/2610) _(Lulu, 2026-09-20)_
- `175638973d` Revert "fix(stage-layouts): avoid Safari Form Assistant (#2461)" [#2461](https://github.com/moeru-ai/airi/pull/2461) _(RainbowBird, 2026-09-20)_
- `9805c0a0f3` refactor(api): extract payment CORE to support other payment providers [2/2] (#2368) [#2368](https://github.com/moeru-ai/airi/pull/2368) _(Lulu, 2026-09-20)_
- `26f37192e0` feat(stage-*): add screen ambient light (#2391) [#2391](https://github.com/moeru-ai/airi/pull/2391) _(Makito, 2026-09-20)_
- `b972b9fcae` fix(pipelines-audio): stop yielding tiny boost chunks (#2584) [#2584](https://github.com/moeru-ai/airi/pull/2584) _(Penluna, 2026-09-19)_

### 🔬 Subsystem Breakdown
#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 4 file(s) (+21/-10)
- `apps/stage-pocket/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` *(+5/-5)*
- `apps/stage-pocket/ios/App/CapApp-SPM/Package.swift` *(+7/-5)*
- `apps/stage-pocket/package.json` *(+1/-0)*
- `apps/stage-pocket/src/main.ts` *(+8/-0)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 33 file(s) (+2357/-662)
- `apps/stage-tamagotchi/src/main/index.ts` *(+6/-1)*
- `apps/stage-tamagotchi/src/main/tray/index.ts` *(+2/-2)*
- `apps/stage-tamagotchi/src/main/windows/inlay/index.ts` *(+50/-47)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+19/-173)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+48/-59)*
- `apps/stage-tamagotchi/src/renderer/components/chat-image-attachment-preview.vue` *(+0/-32)*
- `apps/stage-tamagotchi/src/renderer/components/chat-viewport-layout.browser.test.ts` *(+1/-32)*
- `apps/stage-tamagotchi/src/renderer/components/content-editable.browser.test.ts` *(+0/-307)*
- `apps/stage-tamagotchi/src/renderer/components/devtools/live2d-ambient-light/controls.vue` *(+128/-0)*
- `apps/stage-tamagotchi/src/renderer/components/devtools/live2d-ambient-light/diagnostics-colors.vue` *(+152/-0)*
- `apps/stage-tamagotchi/src/renderer/components/devtools/live2d-ambient-light/diagnostics-metrics.vue` *(+163/-0)*
- `apps/stage-tamagotchi/src/renderer/components/devtools/live2d-ambient-light/diagnostics-preview.vue` *(+110/-0)*
- `apps/stage-tamagotchi/src/renderer/components/devtools/live2d-ambient-light/diagnostics.vue` *(+40/-0)*
- `apps/stage-tamagotchi/src/renderer/components/devtools/live2d-ambient-light/format.ts` *(+9/-0)*
- `apps/stage-tamagotchi/src/renderer/components/devtools/live2d-ambient-light/sampling.vue` *(+81/-0)*
- `apps/stage-tamagotchi/src/renderer/components/devtools/live2d-ambient-light/shader-preview.vue` *(+154/-0)*
- `apps/stage-tamagotchi/src/renderer/components/devtools/live2d-ambient-light/shader.vue` *(+140/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/resource-status-island/index.vue` *(+2/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-screen-ambient-light-diagnostics.ts` *(+58/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-screen-ambient-light.browser.test.ts` *(+156/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-screen-ambient-light.ts` *(+533/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-stage-painted-mask.browser.test.ts` *(+104/-0)*
- `apps/stage-tamagotchi/src/renderer/composables/use-stage-painted-mask.ts` *(+249/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/chat-page-shell.vue` *(+1/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/chat.vue` *(+4/-1)*
- `apps/stage-tamagotchi/src/renderer/pages/devtools/live2d-ambient-light.vue` *(+24/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` *(+14/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/inlay/index.vue` *(+22/-1)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/system/developer.vue` *(+6/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/widgets.vue` *(+4/-4)*
- `apps/stage-tamagotchi/src/shared/screen-ambient-light-diagnostics.ts` *(+72/-0)*
- `apps/stage-tamagotchi/src/shared/utils/electron/display.ts` *(+2/-2)*
- `apps/stage-tamagotchi/src/renderer/components/chat-image-attachment-preview.browser.test.ts => packages/stage-ui/src/components/scenarios/chat/components/image-attachment-preview.browser.test.ts` *(+3/-1)*

#### Documentation & Scaffolding (`⚪ ignore`) — 2 file(s) (+18/-18)
- `docs/ai/context/ui-components.md` *(+0/-18)*
- `packages/stage-ui/README.md` *(+18/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 29 file(s) (+2437/-126)
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/pipelines-audio/src/processors/tts-chunker.test.ts` *(+32/-1)*
- `packages/pipelines-audio/src/processors/tts-chunker.ts` *(+18/-1)*
- `packages/stage-shared/src/screen-ambient-light/environment.test.ts` *(+77/-0)*
- `packages/stage-shared/src/screen-ambient-light/environment.ts` *(+451/-0)*
- `packages/stage-shared/src/screen-ambient-light/index.ts` *(+2/-0)*
- `packages/stage-shared/src/screen-ambient-light/sampling.test.ts` *(+552/-0)*
- `packages/stage-shared/src/screen-ambient-light/sampling.ts` *(+770/-0)*
- `packages/stage-shared/src/stores/screen-ambient-light.ts` *(+119/-0)*
- `packages/stage-ui/src/components/data-pane/index.ts` *(+1/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/chat-history-scroll-container.vue` *(+0/-5)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.browser.test.ts` *(+40/-16)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.vue` *(+1/-2)*
- `packages/stage-ui/src/components/scenarios/chat/components/image-attachment-preview.vue` *(+23/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/user-item.vue` *(+11/-5)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-history-scroll.browser.test.ts` *(+0/-29)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-history-scroll.ts` *(+4/-46)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-images.browser.test.ts` *(+113/-0)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-images.ts` *(+110/-0)*
- `packages/stage-ui/src/components/scenarios/chat/index.ts` *(+3/-0)*
- `packages/stage-ui/src/components/scenarios/chat/utils.ts` *(+2/-12)*
- `packages/stage-ui/src/composables/use-data-maintenance.ts` *(+3/-0)*
- `packages/stage-ui/src/composables/vision/use-vision-inference.ts` *(+3/-1)*
- `packages/stage-ui/src/libs/providers/stream-transcription/index.ts` *(+15/-7)*
- `packages/stage-ui/src/stores/devtools/context-observability.ts` *(+12/-0)*
- `packages/stage-ui/src/stores/modules/vision.browser.test.ts` *(+69/-0)*
- `packages/stage-ui/src/stores/modules/vision/store.ts` *(+3/-0)*
- `pnpm-workspace.yaml` *(+1/-0)*
- `vitest.config.ts` *(+1/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 3 file(s) (+25/-1)
- `package.json` *(+2/-1)*
- `packages/stage-shared/package.json` *(+2/-0)*
- `pnpm-lock.yaml` *(+21/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 7 file(s) (+353/-0)
- `packages/i18n/glossary/terms.yaml` *(+56/-0)*
- `packages/i18n/src/locales/en/stage.yaml` *(+14/-0)*
- `packages/i18n/src/locales/en/tamagotchi/settings.yaml` *(+131/-0)*
- `packages/i18n/src/locales/en/tamagotchi/stage.yaml` *(+3/-0)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+14/-0)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/stage.yaml` *(+4/-0)*
- `packages/i18n/src/locales/zh-Hant/tamagotchi/settings.yaml` *(+131/-0)*

#### Stage Layouts & Shells (`🔍 inspect`) — 4 file(s) (+111/-30)
- `packages/stage-layouts/src/components/Layouts/InteractiveArea.vue` *(+3/-1)*
- `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` *(+51/-23)*
- `packages/stage-layouts/src/components/Widgets/ChatArea.vue` *(+46/-4)*
- `packages/stage-layouts/src/layouts/settings.vue` *(+11/-2)*

#### UI Primitives & Pages (`📦 import / inspect`) — 6 file(s) (+7/-261)
- `packages/stage-pages/src/pages/settings/modules/vision.vue` *(+7/-0)*
- `packages/ui/README.md` *(+0/-28)*
- `packages/ui/src/components/form/content-editable/basic-content-editable.vue` *(+0/-220)*
- `packages/ui/src/components/form/content-editable/index.ts` *(+0/-5)*
- `packages/ui/src/components/form/index.ts` *(+0/-1)*
- `packages/ui/src/components/layouts/scrollable-area.vue` *(+0/-7)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 13 file(s) (+2335/-16)
- `packages/stage-ui-live2d/package.json` *(+5/-0)*
- `packages/stage-ui-live2d/src/components/diagnostics/screen-ambient-light-preview.vue` *(+129/-0)*
- `packages/stage-ui-live2d/src/components/scenes/Live2D.vue` *(+41/-0)*
- `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue` *(+143/-14)*
- `packages/stage-ui-live2d/src/composables/live2d/motion-manager.test.ts` *(+248/-0)*
- `packages/stage-ui-live2d/src/composables/live2d/motion-manager.ts` *(+206/-1)*
- `packages/stage-ui-live2d/src/filters/screen-ambient-light.browser.test.ts` *(+643/-0)*
- `packages/stage-ui-live2d/src/filters/screen-ambient-light.ts` *(+640/-0)*
- `packages/stage-ui-live2d/src/index.ts` *(+1/-0)*
- `packages/stage-ui-live2d/src/utils/ambient-light-test-card.browser.test.ts` *(+109/-0)*
- `packages/stage-ui-live2d/src/utils/ambient-light-test-card.ts` *(+135/-0)*
- `packages/stage-ui-live2d/vitest.config.ts` *(+25/-1)*
- `packages/stage-ui-live2d/vitest.node.config.ts` *(+10/-0)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 4 file(s) (+232/-12)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+95/-0)*
- `packages/stage-ui/src/stores/chat.ts` *(+43/-12)*
- `packages/stage-ui/src/stores/chat/image-projection.test.ts` *(+49/-0)*
- `packages/stage-ui/src/stores/chat/image-projection.ts` *(+45/-0)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 19 file(s) (+4082/-437)
- `server/apps/api/drizzle/0024_drop_stripe_tables.sql` *(+5/-0)*
- `server/apps/api/drizzle/meta/0024_snapshot.json` *(+3329/-0)*
- `server/apps/api/drizzle/meta/_journal.json` *(+7/-0)*
- `server/apps/api/src/app.ts` *(+0/-1)*
- `server/apps/api/src/routes/stripe/index.ts` *(+1/-3)*
- `server/apps/api/src/routes/stripe/operations/webhook.ts` *(+3/-68)*
- `server/apps/api/src/routes/stripe/payment-release.test.ts` *(+1/-27)*
- `server/apps/api/src/routes/stripe/route.test.ts` *(+0/-25)*
- `server/apps/api/src/schemas/flux.ts` *(+0/-3)*
- `server/apps/api/src/schemas/index.ts` *(+0/-1)*
- `server/apps/api/src/schemas/stripe.ts` *(+0/-78)*
- `server/apps/api/src/services/domain/payment/index.ts` *(+0/-17)*
- `server/apps/auth/src/auth.ts` *(+5/-6)*
- `server/apps/auth/src/oidc-access-token.ts` *(+52/-0)*
- `server/apps/auth/src/plugins/oidc-jwt-bearer.ts` *(+128/-147)*
- `server/apps/auth/src/routes.ts` *(+59/-61)*
- `server/apps/auth/src/tests/oidc-jwt-bearer.test.ts` *(+200/-0)*
- `server/apps/auth/src/tests/routes-oidc-token-auth.test.ts` *(+156/-0)*
- `server/docs/ai/adr/2026-09-20-oidc-jwt-session-boundary.md` *(+136/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (20)
- [#2620](https://github.com/moeru-ai/airi/pull/2620) `test(stage-ui): control idle timing in desktop pan regression` by **@nekomeowww** *(2 comments)*
- [#2619](https://github.com/moeru-ai/airi/pull/2619) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2618](https://github.com/moeru-ai/airi/pull/2618) `fix(stage-pocket): hide iOS keyboard accessory bar` by **@luoling8192** *(2 comments)*
- [#2606](https://github.com/moeru-ai/airi/pull/2606) `fix(stage-layouts): reset scroll when settings pages change` by **@nekomeowww** *(9 comments)*
- [#2614](https://github.com/moeru-ai/airi/pull/2614) `fix(auth): avoid bridge sessions on token routes` by **@luoling8192** *(19 comments)*
- [#2607](https://github.com/moeru-ai/airi/pull/2607) `perf(stage-tamagotchi): stop re-sending unchanged cursor position and window bounds` by **@FlowerWater1019** *(Draft)* *(3 comments)*
- [#2617](https://github.com/moeru-ai/airi/pull/2617) `fix(stage-ui): buffer Safari uploads at the official HTTP wrapper` by **@lulu0119** *(1 comments)*
- [#2610](https://github.com/moeru-ai/airi/pull/2610) `fix(stage-ui): buffer Safari transcription stream uploads` by **@lulu0119** *(7 comments)*
- [#2615](https://github.com/moeru-ai/airi/pull/2615) `fix(auth): stop minting sessions for jwt requests` by **@luoling8192** *(15 comments)*
- [#2616](https://github.com/moeru-ai/airi/pull/2616) `test(stage-ui): poll the provider status instead of reading it synchronously` by **@FlowerWater1019** *(1 comments)*
- [#2612](https://github.com/moeru-ai/airi/pull/2612) `perf(stage-tamagotchi): exclude special CJK fonts` by **@nayounsang** *(2 comments)*
- [#2613](https://github.com/moeru-ai/airi/pull/2613) `perf(stage-tamagotchi): remove packaging-only dependencies` by **@nayounsang** *(1 comments)*
- [#2611](https://github.com/moeru-ai/airi/pull/2611) `perf(stage-tamagotchi): exclude duplicate ONNX runtimes` by **@nayounsang** *(2 comments)*
- [#2609](https://github.com/moeru-ai/airi/pull/2609) `feat(stage-ui-three): add a VRM frame rate limit` by **@FlowerWater1019** *(1 comments)*
- [#2608](https://github.com/moeru-ai/airi/pull/2608) `perf(stage-ui-three): cache the screen bounding box instead of forcing layout per read` by **@FlowerWater1019** *(1 comments)*
- [#1975](https://github.com/moeru-ai/airi/pull/1975) `feat(vision): headless background screen vision as a silent chat-context signal` by **@FlowerWater1019** *(8 comments)*
- [#1974](https://github.com/moeru-ai/airi/pull/1974) `feat(hearing): local voice — STT/TTS wiring, caption window, global shortcuts, VAD auto-send` by **@FlowerWater1019** *(9 comments)*
- [#1973](https://github.com/moeru-ai/airi/pull/1973) `feat(memory): opt-in long-term memory (local IndexedDB store + recall)` by **@FlowerWater1019** *(9 comments)*
- [#1972](https://github.com/moeru-ai/airi/pull/1972) `feat(stage-ui): configurable chat response length limits (max tokens + reply-length hint)` by **@FlowerWater1019** *(7 comments)*
- [#1971](https://github.com/moeru-ai/airi/pull/1971) `feat(mcp): progressive tool disclosure — awareness catalog + on-use native promotion` by **@FlowerWater1019** *(10 comments)*

#### 🔄 PR Status & Lifecycle Changes (7)
- [#2551](https://github.com/moeru-ai/airi/pull/2551) `feat(stage-ui): add chat image understanding across Web and Electron` — `OPEN` ➔ `MERGED`
- [#2600](https://github.com/moeru-ai/airi/pull/2600) `fix(stage-tamagotchi): reuse the inlay window and add a close control` — `OPEN` ➔ `MERGED`
- [#2589](https://github.com/moeru-ai/airi/pull/2589) `fix(api): complete OpenRouter Responses streams at EOF` — `OPEN` ➔ `CLOSED`
- [#2603](https://github.com/moeru-ai/airi/pull/2603) ` [DO NOT MERGE] perf(stage-tamagotchi): reduce packaged desktop bundle size` — `OPEN` ➔ `CLOSED`, ➔ `Draft`
- [#2368](https://github.com/moeru-ai/airi/pull/2368) `refactor(api): extract payment CORE to support other payment providers [2/2]` — `OPEN` ➔ `MERGED`
- [#2391](https://github.com/moeru-ai/airi/pull/2391) `feat(stage-*): add screen ambient light` — `OPEN` ➔ `MERGED`
- [#2584](https://github.com/moeru-ai/airi/pull/2584) `fix(pipelines-audio): stop yielding tiny boost chunks` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (6)
- [#2551](https://github.com/moeru-ai/airi/pull/2551) `feat(stage-ui): add chat image understanding across Web and Electron` — *+11 comments (12 ➔ 23 total)*
- [#2603](https://github.com/moeru-ai/airi/pull/2603) ` [DO NOT MERGE] perf(stage-tamagotchi): reduce packaged desktop bundle size` — *+2 comments (3 ➔ 5 total)*
- [#2368](https://github.com/moeru-ai/airi/pull/2368) `refactor(api): extract payment CORE to support other payment providers [2/2]` — *+1 comments (11 ➔ 12 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+3 comments (105 ➔ 108 total)*
- [#2391](https://github.com/moeru-ai/airi/pull/2391) `feat(stage-*): add screen ambient light` — *+5 comments (14 ➔ 19 total)*
- [#2588](https://github.com/moeru-ai/airi/pull/2588) `docs(contributing): align GitHub setup guide with pinned tooling` — *+1 comments (2 ➔ 3 total)*

---
## [2026-09-19] Upstream Delta: `09aa7a7d..62ef8676` (6 commits, 27 files, 18 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 6 commits (`09aa7a7d..62ef8676`) and recorded 18 PR updates (11 new, 7 discussion). Work remains heavily centered on hardening the hosted `/v1/responses` gateway and OpenRouter search routing (#2604, #2601, #2593, #2589), client-side graceful handling of interrupted streaming responses (#2596), enabling official provider web search (#2602), and Electron automation window-role guidelines (#2592). In PRs, performance bundling (#2603), inlay window reuse (#2600), Y-API provider (#2598), and bundled Sherpaw STT (#2550) are advancing.
* **Discussion & Community Buzz**:
  - 💬 **#2596: `fix: handle interrupted Responses streams` (21 comments)**: High discussion on preserving partial assistant text across network/provider drops and retry indexing.
  - 💬 **#2391: `feat(stage-*): add screen ambient light` (+8 new comments, total 14)**: Growing community buzz and testing around real-time screen color sampling and Live2D lighting shaders.
  - 💬 **#2589: `fix(api): complete OpenRouter Responses streams at EOF` (+6 new comments, total 10)**: Server-side SSE completion and buffer flushing fixes.
  - 💬 **#2594: `fix(api): normalize OpenRouter Responses event names` (7 comments)**: OpenRouter response event normalization.
  - 💬 **#2593: `fix(api): recover completed OpenRouter Responses streams` (6 comments)**: Resilient stream reconnection and recovery.
  - 💬 **#2121: `chore(i18n): update translations` (+3 new comments, total 105)**: Active community localization updates crossing 100+ comments.
  - 💬 **#2603: `perf(stage-tamagotchi): reduce packaged desktop bundle size` (3 comments)**: Packaging footprint optimization discussion.
  - 💬 **#2550: `feat(hearing): add bundled Sherpaw speech recognition` (+2 new comments, total 10)**: Interest in offline WASM speech-to-text via sherpa-onnx.
  - 💬 **#2552: `feat(stage) add bilingual subtitles` (+1 new comments, total 10)**: Subtitle chunking and bilingual display coordination.
  - 💬 **#2530: `fix(stage-tamagotchi): remove obsolete mouse tracking IPC` (+1 new comments, total 7)**: Cleanup of legacy mouse event routing.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2596 / Commit `41e48b12ce`: `fix: handle interrupted Responses streams` (frontend/core-agent only)**: High UX value. Preserves partial streaming assistant replies with `interrupted: true` rather than discarding output on transport drop, and updates retry logic (`retrySourceIndexFrom`, `canRetryMessageAt`) in `chat.ts` and `history.vue`. Excludes interrupted turns from cloud sync.
  - ⭐ **PR #2600: `fix(stage-tamagotchi): reuse the inlay window and add a close control`**: Window lifecycle cleanup. Reuses existing inlay window instances and adds an explicit close action, preventing window leaks in Electron.
  - ⭐ **PR #2598: `feat(providers): add Y-API provider`**: Self-contained provider integration in `packages/provider-inference/src/providers/cloud/y-api/index.ts` with localization keys.
  - 🔍 **PR #2603: `perf(stage-tamagotchi): reduce packaged desktop bundle size`**: Desktop bundle optimizations in `electron-builder.config.ts` and UnoCSS; worth reviewing for our own Electron distribution.
  - 🔍 **PR #2550: `feat(hearing): add bundled Sherpaw speech recognition`**: Offline WASM STT integration via sherpa-onnx (`vite-plugin-sherpaw`). Excellent offline alignment, though needs evaluation against our audio pipeline.
  - ⚪ **Auto-Reject / Do Not Port**: Commits `62ef8676f6`, `542db6c89b`, `cfffa9b6f3` and PRs #2594, #2591, #2589 (hosted cloud API server / Stripe / Flux); Commit `470c4664a3` (hosted web search default for official provider).
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts` & `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts` (Commit `41e48b12ce`)**: Our fork features `<|ACTOR|>` routing, multi-actor state, and memory journal integrations. Porting the interrupted-stream handling must be done selectively by hand.
  - ⚠️ **`apps/stage-tamagotchi/src/renderer/pages/index.vue` (PR #2391 Screen Ambient Light)**: Upstream continues building on the monolithic `index.vue` / `controls-island`. Our fork decouples the stage into `RendererStage.vue` and `ControlStripHost.vue`. Ambient lighting logic must target `RendererStage.vue` if ported.
  - ⚠️ **`packages/stage-ui/src/components/scenes/Stage.vue` (PR #2552 Bilingual Subtitles)**: Upstream modifies legacy `Stage.vue` and `pipelines-audio`; our fork uses `packages/stage-layouts` and `airi-caption-subsystem`.

### 📋 Upstream Commits
- `62ef8676f6` fix(api): route web search through OpenRouter (#2604) [#2604](https://github.com/moeru-ai/airi/pull/2604) _(RainbowBird, 2026-09-19)_
- `470c4664a3` fix(stage-ui): enable official web search by default (#2602) [#2602](https://github.com/moeru-ai/airi/pull/2602) _(RainbowBird, 2026-09-19)_
- `542db6c89b` fix(api): preserve Responses provider fields (#2601) [#2601](https://github.com/moeru-ai/airi/pull/2601) _(RainbowBird, 2026-09-19)_
- `41e48b12ce` fix: handle interrupted Responses streams (#2596) [#2596](https://github.com/moeru-ai/airi/pull/2596) _(RainbowBird, 2026-09-19)_
- `cfffa9b6f3` fix(api): recover completed OpenRouter Responses streams (#2593) [#2593](https://github.com/moeru-ai/airi/pull/2593) _(RainbowBird, 2026-09-19)_
- `332af7f66f` docs(skills): preserve Electron window roles during automation (#2592) [#2592](https://github.com/moeru-ai/airi/pull/2592) _(Neko, 2026-09-19)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 1 file(s) (+17/-1)
- `.agents/skills/agent-browser-electron/SKILL.md` *(+17/-1)*

#### Core Agent Runtime (`🔍 inspect`) — 4 file(s) (+138/-9)
- `packages/core-agent/README.md` *(+2/-2)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.test.ts` *(+105/-1)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts` *(+29/-6)*
- `packages/core-agent/src/types/chat.ts` *(+2/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 7 file(s) (+101/-8)
- `packages/stage-ui/src/components/scenarios/chat/components/history.browser.test.ts` *(+51/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.story.vue` *(+29/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.vue` *(+11/-1)*
- `packages/stage-ui/src/libs/chat-sync/wire-message.test.ts` *(+2/-1)*
- `packages/stage-ui/src/libs/chat-sync/wire-message.ts` *(+5/-3)*
- `packages/stage-ui/src/libs/providers/providers/official/index.test.ts` *(+2/-2)*
- `packages/stage-ui/src/libs/providers/providers/official/index.ts` *(+1/-1)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 2 file(s) (+57/-4)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+51/-0)*
- `packages/stage-ui/src/stores/chat.ts` *(+6/-4)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 13 file(s) (+522/-650)
- `server/apps/api/README.md` *(+2/-1)*
- `server/apps/api/src/routes/openai/v1/index.ts` *(+2/-1)*
- `server/apps/api/src/routes/openai/v1/operations/responses/index.ts` *(+110/-14)*
- `server/apps/api/src/routes/openai/v1/operations/responses/request.test.ts` *(+64/-70)*
- `server/apps/api/src/routes/openai/v1/operations/responses/request.ts` *(+139/-70)*
- `server/apps/api/src/routes/openai/v1/route.test.ts` *(+118/-3)*
- `server/apps/api/src/services/adapters/llm/responses.ts` *(+49/-17)*
- `server/apps/api/src/services/adapters/llm/schemas/README.md` *(+0/-22)*
- `server/apps/api/src/services/adapters/llm/schemas/openresponses-schema.ts` *(+0/-344)*
- `server/apps/api/src/services/adapters/llm/schemas/request-openapi.json` *(+0/-1)*
- `server/apps/api/src/services/adapters/llm/schemas/responses.ts` *(+0/-105)*
- `server/apps/api/src/services/domain/llm-router/tests/router.test.ts` *(+26/-0)*
- `server/docs/ai/adr/2026-09-15-hosted-responses.md` *(+12/-2)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (11)
- [#2598](https://github.com/moeru-ai/airi/pull/2598) `feat(providers): add Y-API provider` by **@jiweiyeah** *(1 comments)*
- [#2603](https://github.com/moeru-ai/airi/pull/2603) ` perf(stage-tamagotchi): reduce packaged desktop bundle size` by **@nayounsang** *(3 comments)*
- [#2604](https://github.com/moeru-ai/airi/pull/2604) `fix(api): route web search through OpenRouter` by **@luoling8192** *(1 comments)*
- [#2602](https://github.com/moeru-ai/airi/pull/2602) `fix: enable official web search by default` by **@luoling8192** *(1 comments)*
- [#2601](https://github.com/moeru-ai/airi/pull/2601) `fix(api): preserve Responses provider fields` by **@luoling8192** *(1 comments)*
- [#2600](https://github.com/moeru-ai/airi/pull/2600) `fix(stage-tamagotchi): reuse the inlay window and add a close control` by **@Fan-xxy** *(1 comments)*
- [#2596](https://github.com/moeru-ai/airi/pull/2596) `fix: handle interrupted Responses streams` by **@luoling8192** *(21 comments)*
- [#2594](https://github.com/moeru-ai/airi/pull/2594) `fix(api): normalize OpenRouter Responses event names` by **@luoling8192** *(7 comments)*
- [#2593](https://github.com/moeru-ai/airi/pull/2593) `fix(api): recover completed OpenRouter Responses streams` by **@luoling8192** *(6 comments)*
- [#2592](https://github.com/moeru-ai/airi/pull/2592) `docs(skills): preserve Electron window roles during automation` by **@nekomeowww** *(4 comments)*
- [#2591](https://github.com/moeru-ai/airi/pull/2591) `fix(api): allow packaged transcription preflight` by **@lorenzozanee** *(0 comments)*

#### 💬 Discussion Activity (7)
- [#2588](https://github.com/moeru-ai/airi/pull/2588) `docs(contributing): align GitHub setup guide with pinned tooling` — *+1 comments (1 ➔ 2 total)*
- [#2530](https://github.com/moeru-ai/airi/pull/2530) `fix(stage-tamagotchi): remove obsolete mouse tracking IPC` — *+1 comments (6 ➔ 7 total)*
- [#2391](https://github.com/moeru-ai/airi/pull/2391) `feat(stage-*): add screen ambient light` — *+8 comments (6 ➔ 14 total)*
- [#2552](https://github.com/moeru-ai/airi/pull/2552) `feat(stage)    add bilingual subtitles` — *+1 comments (9 ➔ 10 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+3 comments (102 ➔ 105 total)*
- [#2550](https://github.com/moeru-ai/airi/pull/2550) `feat(hearing): add bundled Sherpaw speech recognition` — *+2 comments (8 ➔ 10 total)*
- [#2589](https://github.com/moeru-ai/airi/pull/2589) `fix(api): complete OpenRouter Responses streams at EOF` — *+6 comments (4 ➔ 10 total)*

---
## [2026-09-18] Upstream Delta: `fa159df1..09aa7a7d` (9 commits, 85 files, 28 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 9 commits (`fa159df1..09aa7a7d34`) and processed 28 PR updates, primarily focused on hosted commercial infra (stateless `/v1/responses` gateway with Flux billing settlement in #2554, and chat-round TTS billing in #2491), canvas scene rendering consolidation (#2581), VRM emotion weight/morph conflict prevention (#2352), streaming transcription audio chunking (#2560), and card creation UI refactoring (#2568). Meanwhile, the Extension Activation Planner (#2572) and Live2D Screen Ambient Light (#2391) transitioned to Ready for review.
* **Discussion & Community Buzz**:
  - 💬 **#2554: `feat(api): add stateless Responses gateway with Flux settlement` (+84 new comments, total 92)**: High-velocity architectural review on server-side response schemas, model routing, and token settlement.
  - 💬 **#2491: `feat(server): group TTS billing history by chat round` (+7 new comments, total 59)**: Finalizing chat-round aggregation and token accounting for hosted TTS.
  - 💬 **#2568: `refactor(stage-ui): airi card ui` (+6 new comments, total 15)**: Feedback on card creation dialog tab reworks and layout styling.
  - 💬 **#2391: `feat(stage-*): add screen ambient light` (+5 new comments, total 6)**: Transitioned from Draft to Ready with community interest in Live2D model ambient lighting.
  - 💬 **#2121: `chore(i18n): update translations` (+3 new comments, total 102)**: Ongoing Crowdin translation updates crossing 100+ comments.
  - 💬 **#2546: `feat(stage-ui): add voice messages and mobile dictation` (+3 new comments, total 8)**: Active mobile voice input development.
  - 💬 **#2120: `refactor(stage-pages): rebuild AIRI Card editor` (+1 new comments, total 41)**: Iterative discussion on draft saving and card editor redesign.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2352 / Commit `16e30f763b`: `fix(stage-ui-three): maintain vrm emotion weights and prevent morph conflicts`**: High-value avatar stability fix. Prevents morph weights from getting stuck when transitioning between emotions or when an emotion state is cleared before reset fires by maintaining `trackedExpressionNames` in `useVRMEmote`.
  - ⭐ **PR #2580: `fix(stage-tamagotchi): prevent duplicate user data folder openings`**: Crucial Electron multi-window fix. Filters `ipcMain` Eventa calls by checking `event.sender.id === webContents.id` so a single action in one window does not trigger duplicate handlers across other window services (e.g. `ControlStrip` vs `Stage`).
  - ⭐ **PR #2584: `fix(pipelines-audio): stop yielding tiny boost chunks`**: Audio pipeline efficiency fix. Prevents TTS chunker from prematurely dispatching micro-chunks (e.g. 1-2 character soft punctuation splits) during the initial `boost` phase unless `chunkWordsCount >= minimumWords`, avoiding costly fixed backend synthesis latency.
  - ⭐ **PR #2560 / Commit `01e6064388`: `fix(stage-ui): emit Uint8Array chunks for streaming transcription audio`**: Enqueues `Uint8Array` rather than raw `ArrayBuffer` in Web Audio transcription streams, adhering to standard `ReadableStream<ArrayBufferView>` expectations and improving streaming STT provider compatibility.
  - ⭐ **PR #2577 / Commit `5b759a9af5`: `fix(ui): give focus rings room and centre the add button`**: Clean, zero-risk UI styling polish for `field-values.vue` and `bottom-drawer.vue`.
  - 🔍 **PR #2590: `feat(provider): add display names for v2 Provider connections`**: Allows custom user-facing nicknames for multiple connections of the same provider type. Highly compatible with our local multi-account `providersStore`.
  - ⚪ **Auto-Reject / Do Not Port**: PR #2554 / Commit `70bcee06a3`, PR #2491 / Commit `0040675e86`, and PR #2583 / Commit `03bcd64bfc` (hosted cloud server, Stripe/Flux billing, Redis tracking, remote provider accounts); Commit `1ce988917e` canvas scene repainting (diverges from our decoupled `RendererStage.vue` and dedicated background store architecture).
* **Divergence / Collision Warnings**:
  - ⚠️ **`apps/stage-tamagotchi/src/renderer/pages/index.vue` (Commit `1ce988917e`)**: Upstream continues modifying `index.vue` around legacy `controls-island` and monolithic canvas layering. In our fork, desktop surfaces are decoupled into `RendererStage.vue` and `ControlStripHost.vue`. Do not sync directly.
  - ⚠️ **Background Rendering Architecture (`Stage.vue` & 3D/2D Scene Canvas components)**: Upstream shifted background drawing directly into each renderer's canvas via `coverRect` (`1ce988917e`). Our fork manages layered scenes and autonomous artistry via `airi-scenes-backgrounds` and `RendererStage.vue`.
  - ⚠️ **`packages/stage-pages/src/pages/settings/airi-card/components/CardCreationDialog.vue` (Commit `ab99b18800`)**: Upstream refactored card creation tabs and styling. Our fork has extensive custom extensions (e.g. AnimaDex bindings, ACT cues, multi-actor card schemas) in `CardCreationDialog.vue`. Merge manually with caution.

### 📋 Upstream Commits
- `09aa7a7d34` fix(stage-ui): restore official chat default (#2587) [#2587](https://github.com/moeru-ai/airi/pull/2587) _(RainbowBird, 2026-09-18)_
- `03bcd64bfc` feat(stage-ui): allow official provider protocol selection (#2583) [#2583](https://github.com/moeru-ai/airi/pull/2583) _(RainbowBird, 2026-09-18)_
- `70bcee06a3` feat(api): add stateless Responses gateway with Flux settlement (#2554) [#2554](https://github.com/moeru-ai/airi/pull/2554) _(RainbowBird, 2026-09-18)_
- `0040675e86` feat(server): group TTS billing history by chat round (#2491) [#2491](https://github.com/moeru-ai/airi/pull/2491) _(RainbowBird, 2026-09-18)_
- `16e30f763b` fix(stage-ui-three): maintain vrm emotion weights and prevent morph conflicts (#2352) [#2352](https://github.com/moeru-ai/airi/pull/2352) _(이윤진(Lee Yunjin), 2026-09-18)_
- `ab99b18800` refactor(stage-ui): airi card ui (#2568) [#2568](https://github.com/moeru-ai/airi/pull/2568) _(凌莞~(=^▽^=), 2026-09-18)_
- `1ce988917e` fix(stage-ui): paint the scene into the canvas each renderer already draws (#2581) [#2581](https://github.com/moeru-ai/airi/pull/2581) _(蓝莓🫐, 2026-09-18)_
- `5b759a9af5` fix(ui): give focus rings room and centre the add button (#2577) [#2577](https://github.com/moeru-ai/airi/pull/2577) _(蓝莓🫐, 2026-09-17)_
- `01e6064388` fix(stage-ui): emit Uint8Array chunks for streaming transcription audio (#2560) [#2560](https://github.com/moeru-ai/airi/pull/2560) _(Shucheng Hu, 2026-09-17)_

### 🔬 Subsystem Breakdown
#### Electron Desktop Shell (`⚠️ hand-merge`) — 1 file(s) (+11/-15)
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` *(+11/-15)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 1 file(s) (+50/-0)
- `apps/stage-web/src/pages/official-provider-chat.browser.test.ts` *(+50/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+10/-0)
- `packages/i18n/src/locales/en/settings.yaml` *(+5/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+5/-0)*

#### Documentation & Scaffolding (`⚪ ignore`) — 1 file(s) (+5/-1)
- `packages/provider-inference/README.md` *(+5/-1)*

#### Other / Uncategorized (`🔍 inspect`) — 21 file(s) (+487/-43)
- `packages/provider-inference/src/generation.ts` *(+20/-1)*
- `packages/provider-inference/src/index.ts` *(+1/-0)*
- `packages/provider-inference/src/providers/cloud/openai-compatible/index.ts` *(+8/-5)*
- `packages/provider-inference/src/providers/cloud/openai/index.ts` *(+17/-14)*
- `packages/provider-inference/src/providers/responses.test.ts` *(+12/-0)*
- `packages/stage-shared/src/cover-fit.test.ts` *(+27/-0)*
- `packages/stage-shared/src/cover-fit.ts` *(+31/-0)*
- `packages/stage-shared/src/index.ts` *(+1/-0)*
- `packages/stage-ui-mmd/src/components/scenes/MMD.vue` *(+91/-1)*
- `packages/stage-ui-spine/src/components/scenes/Spine.vue` *(+3/-0)*
- `packages/stage-ui-spine/src/components/scenes/spine/Model.vue` *(+81/-1)*
- `packages/stage-ui-tachie/src/components/scenes/tachie.vue` *(+3/-0)*
- `packages/stage-ui-tachie/src/components/scenes/tachie/canvas.vue` *(+89/-1)*
- `packages/stage-ui/src/libs/providers/providers/official/index.test.ts` *(+45/-1)*
- `packages/stage-ui/src/libs/providers/providers/official/index.ts` *(+39/-10)*
- `packages/stage-ui/src/libs/speech/streaming-pipeline.ts` *(+5/-0)*
- `packages/stage-ui/src/libs/speech/tts-session.ts` *(+2/-0)*
- `packages/stage-ui/src/stores/modules/hearing.ts` *(+9/-9)*
- `packages/stage-ui/src/stores/modules/speech.ts` *(+1/-0)*
- `pnpm-workspace.yaml` *(+1/-0)*
- `vitest.config.ts` *(+1/-0)*

#### UI Primitives & Pages (`📦 import / inspect`) — 7 file(s) (+319/-220)
- `packages/stage-pages/src/pages/devtools/providers-transcription-realtime-aliyun-nls.vue` *(+3/-3)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardCreationDialog.vue` *(+248/-191)*
- `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabArtistry.vue` *(+22/-17)*
- `packages/stage-pages/src/pages/settings/providers/chat/official-provider.vue` *(+9/-0)*
- `packages/stage-pages/src/pages/settings/providers/transcription/aliyun-nls-transcription.vue` *(+3/-3)*
- `packages/ui/src/components/form/field/field-values.vue` *(+28/-5)*
- `packages/ui/src/components/layouts/bottom-drawer.vue` *(+6/-1)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 11 file(s) (+912/-113)
- `packages/stage-ui-live2d/src/components/scenes/Live2D.vue` *(+3/-0)*
- `packages/stage-ui-live2d/src/components/scenes/live2d/Canvas.vue` *(+100/-1)*
- `packages/stage-ui-three/src/components/Environment/SkyBox.vue` *(+29/-8)*
- `packages/stage-ui-three/src/components/Model/VRMModel.vue` *(+24/-5)*
- `packages/stage-ui-three/src/components/ThreeScene.vue` *(+141/-3)*
- `packages/stage-ui-three/src/composables/vrm/animation.test.ts` *(+108/-0)*
- `packages/stage-ui-three/src/composables/vrm/animation.ts` *(+17/-3)*
- `packages/stage-ui-three/src/composables/vrm/expression.test.ts` *(+249/-0)*
- `packages/stage-ui-three/src/composables/vrm/expression.ts` *(+205/-24)*
- `packages/stage-ui-three/src/composables/vrm/lip-sync.ts` *(+19/-5)*
- `packages/stage-ui/src/components/scenes/Stage.vue` *(+17/-64)*

#### Root Build & Tooling (`🔍 inspect`) — 1 file(s) (+9/-0)
- `pnpm-lock.yaml` *(+9/-0)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 38 file(s) (+2494/-249)
- `server/apps/api/README.md` *(+61/-0)*
- `server/apps/api/package.json` *(+2/-0)*
- `server/apps/api/src/app.test.ts` *(+32/-1)*
- `server/apps/api/src/app.ts` *(+23/-2)*
- `server/apps/api/src/routes/audio-speech-ws/session.ts` *(+3/-1)*
- `server/apps/api/src/routes/openai/v1/gateway.ts` *(+14/-4)*
- `server/apps/api/src/routes/openai/v1/index.ts` *(+37/-5)*
- `server/apps/api/src/routes/openai/v1/middlewares/index.ts` *(+0/-1)*
- `server/apps/api/src/routes/openai/v1/middlewares/traffic-control.ts` *(+0/-78)*
- `server/apps/api/src/routes/openai/v1/model-routing.ts` *(+130/-0)*
- `server/apps/api/src/routes/openai/v1/operations/chat-completions/index.ts` *(+9/-97)*
- `server/apps/api/src/routes/openai/v1/operations/responses/index.ts` *(+233/-0)*
- `server/apps/api/src/routes/openai/v1/operations/responses/request.test.ts` *(+187/-0)*
- `server/apps/api/src/routes/openai/v1/operations/responses/request.ts` *(+86/-0)*
- `server/apps/api/src/routes/openai/v1/route.test.ts` *(+613/-1)*
- `server/apps/api/src/schemas/generation-protocol.test.ts` *(+25/-0)*
- `server/apps/api/src/schemas/generation-protocol.ts` *(+21/-0)*
- `server/apps/api/src/services/adapters/config-kv/definitions.ts` *(+4/-0)*
- `server/apps/api/src/services/adapters/llm/chat-completions.ts` *(+20/-0)*
- `server/apps/api/src/services/adapters/llm/index.ts` *(+11/-0)*
- `server/apps/api/src/services/adapters/llm/responses.ts` *(+33/-0)*
- `server/apps/api/src/services/adapters/llm/schemas/README.md` *(+22/-0)*
- `server/apps/api/src/services/adapters/llm/schemas/openresponses-schema.ts` *(+344/-0)*
- `server/apps/api/src/services/adapters/llm/schemas/request-openapi.json` *(+1/-0)*
- `server/apps/api/src/services/adapters/llm/schemas/responses.ts` *(+105/-0)*
- `server/apps/api/src/services/adapters/llm/types.ts` *(+11/-0)*
- `server/apps/api/src/services/domain/billing/billing-service.ts` *(+2/-0)*
- `server/apps/api/src/services/domain/billing/flux-meter.ts` *(+2/-0)*
- `server/apps/api/src/services/domain/flux-transaction.test.ts` *(+16/-0)*
- `server/apps/api/src/services/domain/flux-transaction.ts` *(+40/-11)*
- `server/apps/api/src/services/domain/llm-router/router.ts` *(+61/-40)*
- `server/apps/api/src/services/domain/llm-router/tests/router.test.ts` *(+84/-0)*
- `server/apps/api/src/services/domain/llm-router/types.ts` *(+7/-1)*
- `server/apps/api/src/services/domain/llm-tracing/index.test.ts` *(+60/-1)*
- `server/apps/api/src/services/domain/llm-tracing/index.ts` *(+30/-5)*
- `server/apps/api/src/services/domain/openai-speech/index.ts` *(+4/-1)*
- `server/docs/ai/adr/2026-09-15-hosted-responses.md` *(+141/-0)*
- `server/docs/ai/adr/2026-09-17-tts-flux-history-read-model.md` *(+20/-0)*

#### Telemetry & Analytics (`⚪ ignore / rejected in fork`) — 2 file(s) (+48/-7)
- `server/apps/api/src/routes/openai/v1/middlewares/telemetry.test.ts` *(+38/-0)*
- `server/apps/api/src/routes/openai/v1/middlewares/telemetry.ts` *(+10/-7)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (13)
- [#2590](https://github.com/moeru-ai/airi/pull/2590) `feat(provider): add display names for v2 Provider connections` by **@nayounsang** *(1 comments)*
- [#2589](https://github.com/moeru-ai/airi/pull/2589) `fix(api): ignore empty Responses SSE messages` by **@luoling8192** *(4 comments)*
- [#2588](https://github.com/moeru-ai/airi/pull/2588) `docs(contributing): align GitHub setup guide with pinned tooling` by **@Redestiny** *(1 comments)*
- [#2587](https://github.com/moeru-ai/airi/pull/2587) `fix(stage-ui): restore official chat default` by **@luoling8192** *(1 comments)*
- [#2586](https://github.com/moeru-ai/airi/pull/2586) `Nanakura/chore/remove vscode integration` by **@cuwayo** *(0 comments)*
- [#2583](https://github.com/moeru-ai/airi/pull/2583) `feat(stage-ui): allow official provider protocol selection` by **@luoling8192** *(1 comments)*
- [#2584](https://github.com/moeru-ai/airi/pull/2584) `fix(pipelines-audio): stop yielding tiny boost chunks` by **@FlowerWater1019** *(1 comments)*
- [#2581](https://github.com/moeru-ai/airi/pull/2581) `fix(stage-ui): paint the scene into the canvas each renderer already draws` by **@chiba233** *(1 comments)*
- [#2580](https://github.com/moeru-ai/airi/pull/2580) `fix(stage-tamagotchi): prevent duplicate user data folder openings` by **@jim139129** *(1 comments)*
- [#2578](https://github.com/moeru-ai/airi/pull/2578) `fix(stage-tamagotchi): hold clicks where a scene is painted` by **@chiba233** *(2 comments)*
- [#2576](https://github.com/moeru-ai/airi/pull/2576) `fix(stage-tamagotchi): let a scene decide click-through per pixel` by **@chiba233** *(1 comments)*
- [#2577](https://github.com/moeru-ai/airi/pull/2577) `fix(ui): give focus rings room and centre the add button` by **@chiba233** *(1 comments)*
- [#2575](https://github.com/moeru-ai/airi/pull/2575) `fix(stage-pages): hide unavailable providers from v2 catalog` by **@Bruce-Yii** *(0 comments)*

#### 🔄 PR Status & Lifecycle Changes (8)
- [#2554](https://github.com/moeru-ai/airi/pull/2554) `feat(api): add stateless Responses gateway with Flux settlement` — `OPEN` ➔ `MERGED`
- [#2572](https://github.com/moeru-ai/airi/pull/2572) `feat(plugin-host): add activation planner` — `Draft` ➔ `Ready`
- [#2491](https://github.com/moeru-ai/airi/pull/2491) `feat(server): group TTS billing history by chat round` — `OPEN` ➔ `MERGED`
- [#2568](https://github.com/moeru-ai/airi/pull/2568) `refactor(stage-ui): airi card ui` — `OPEN` ➔ `MERGED`
- [#2352](https://github.com/moeru-ai/airi/pull/2352) `fix(stage-ui-three): maintain vrm emotion weights and prevent morph conflicts` — `OPEN` ➔ `MERGED`
- [#2391](https://github.com/moeru-ai/airi/pull/2391) `feat(stage-*): add screen ambient light` — `Draft` ➔ `Ready`
- [#2560](https://github.com/moeru-ai/airi/pull/2560) `fix(stage-ui): emit Uint8Array chunks for streaming transcription audio` — `OPEN` ➔ `MERGED`
- [#2569](https://github.com/moeru-ai/airi/pull/2569) `feat(stage-tamagotchi): show recent VRM resource events` — `OPEN` ➔ `CLOSED`

#### 💬 Discussion Activity (7)
- [#2554](https://github.com/moeru-ai/airi/pull/2554) `feat(api): add stateless Responses gateway with Flux settlement` — *+84 comments (8 ➔ 92 total)*
- [#2491](https://github.com/moeru-ai/airi/pull/2491) `feat(server): group TTS billing history by chat round` — *+7 comments (52 ➔ 59 total)*
- [#2568](https://github.com/moeru-ai/airi/pull/2568) `refactor(stage-ui): airi card ui` — *+6 comments (9 ➔ 15 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+3 comments (99 ➔ 102 total)*
- [#2391](https://github.com/moeru-ai/airi/pull/2391) `feat(stage-*): add screen ambient light` — *+5 comments (1 ➔ 6 total)*
- [#2546](https://github.com/moeru-ai/airi/pull/2546) `feat(stage-ui): add voice messages and mobile dictation` — *+3 comments (5 ➔ 8 total)*
- [#2120](https://github.com/moeru-ai/airi/pull/2120) `refactor(stage-pages): rebuild AIRI Card editor` — *+1 comments (40 ➔ 41 total)*

---
## [2026-09-17] Upstream Delta: `1b019c32..fa159df1` (12 commits, 74 files, 35 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 12 commits (`1b019c32..fa159df1`) headlined by desktop Computer Use via `@auv-js` automated vision (#2565), Chrome built-in Prompt API provider integration (#2299), VRM resource event diagnostics in devtools (#2570), and stage blank-area click-through improvements (#2573). Active PRs saw high activity around CCv3 character card compilation (#2119), Airi Card UI refactoring (#2568), and server-side TTS/Flux billing optimizations (#2491, #2562, #2563).
* **Discussion & Community Buzz**:
  - 💬 **#2491: `feat(server): group TTS billing history by chat round` (+42 new comments, 52 total)**: Major discussion spike evaluating chat-round aggregation and token accounting on the hosted server.
  - 💬 **#2471: `feat(stage-ui): sync user providers to a cloud replica` (+10 new comments, 62 total)**: Continued debate on remote cloud provider syncing vs. client storage.
  - 💬 **#2568: `refactor(stage-ui): airi card ui` (9 comments)**: High initial community feedback on redesigning the AIRI character card UI.
  - 💬 **#2119: `feat(stage-ui): compile CCv3 character card runtime` (+4 new comments, 58 total)**: Continued review and testing of CCv3 lorebook and regex matching.
  - 💬 **#2554: `feat(api): add stateless Responses gateway with Flux settlement` (+4 new comments, 8 total)**: Architectural discussion on server-side token settlement.
  - 💬 **#2550: `feat(hearing): add bundled Sherpaw speech recognition` (+3 new comments, 8 total)**: Offline STT packaging using Sherpa-onnx.
  - 💬 **#2120: `refactor(stage-pages): rebuild AIRI Card editor` (+3 new comments, 40 total)**: Discussion on editor draft tracking and multi-tab state.
  - 💬 **#2121: `chore(i18n): update translations` (+2 new comments, 99 total)**: Ongoing Crowdin localization updates.
  - 💬 **#2567: `feat(provider-inference): add AnonRouter chat provider` (3 comments)**: Community submission for a new inference provider.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2299 / Commit `ad24cfe629`: `feat(stage-ui): add Prompt API Provider`**: Adds zero-configuration, local-first in-browser inference using Chrome's embedded Gemini Nano (`window.ai` via `xsai-chromium-prompt`). Cleanly aligns with our privacy invariant.
  - ⭐ **PR #2570 / Commit `fa159df1eb`: `feat(stage-tamagotchi): display recent VRM resource events`**: Isolated devtools component (`resource-events.vue`) that tracks Three.js resource metrics (textures, geometries, meshes, materials) across model loading/switching to diagnose leaks.
  - ⭐ **PR #2565 (Tool Gating Pattern): `requiresExplicitSelection` in `chat.ts`**: Upstream's security pattern ensuring sensitive or dangerous tools (such as OS automation) are not automatically re-invoked from past message history unless explicitly activated for the current prompt.
  - 🔍 **PR #2573: `pass clicks through blank stage areas` (Logic Only)**: Hit-test resolution logic in `fade-on-hover.ts` decoupling Auto Hide fade from blank-area click-through; high value for window interaction, but must be ported to our decoupled `RendererStage.vue`.
  - ⚪ **Auto-Reject / Do Not Port**: PR #2574 (`controls-island` clipped corner fix — deprecated surface removed in fork); Commits `72999dda75`/`83b8b9afd4` & PR #2491/#2554 (hosted cloud billing, Redis cache expiry, Flux token settlement).
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts` (Commits `c38b0a34f3`, `ad24cfe629`)**: Upstream modified send execution and tool rerun logic. Our fork maintains multi-actor routing (`<|ACTOR|>`), STMM/LTMM memory hydration, and acting cues in `chat.ts`. Port changes manually with care.
  - ⚠️ **`apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` & `pages/index.vue` (Commit `e51f5cafb1`)**: Touches stage interaction logic. In this fork, desktop surfaces are decoupled into `ControlStrip` and `RendererStage.vue`.
  - ⚠️ **`apps/stage-tamagotchi/src/main/services/airi/computer-use/` (Commit `c38b0a34f3`)**: New Electron service introducing OS automation and macOS accessibility permissions; requires adaptation to our `injeca` DI container if ever adopted.

### 📋 Upstream Commits
- `fa159df1eb` feat(stage-tamagotchi): display recent VRM resource events (#2570) [#2570](https://github.com/moeru-ai/airi/pull/2570) _(Codada, 2026-09-17)_
- `e51f5cafb1` feat(stage-tamagotchi): pass clicks through blank stage areas (#2573) [#2573](https://github.com/moeru-ai/airi/pull/2573) _(蓝莓🫐, 2026-09-17)_
- `4657675fa3` fix(stage-tamagotchi): keep the controls menu corners round when clipped (#2574) [#2574](https://github.com/moeru-ai/airi/pull/2574) _(蓝莓🫐, 2026-09-17)_
- `56b95a29c6` chore(nix): update pnpmDeps hash (#2571) [#2571](https://github.com/moeru-ai/airi/pull/2571) _(Weathercold, 2026-09-17)_
- `ad24cfe629` feat(stage-ui): add Prompt API Provider (#2299) [#2299](https://github.com/moeru-ai/airi/pull/2299) _(AdairLi, 2026-09-17)_
- `438a067dde` chore(nix): update pnpmDeps hash (#2566) [#2566](https://github.com/moeru-ai/airi/pull/2566) _(Weathercold, 2026-09-16)_
- `c38b0a34f3` feat(stage-tamagotchi): add desktop computer use with AUV (#2565) [#2565](https://github.com/moeru-ai/airi/pull/2565) _(RainbowBird, 2026-09-17)_
- `6d3fd7a605` fix(stage-ui): hide browser local transcription provider until its settings page exists (#2558) [#2558](https://github.com/moeru-ai/airi/pull/2558) _(xy, 2026-09-17)_
- `9d4398eadd` fix(stage-pages): keep required field labels on one line (#2561) [#2561](https://github.com/moeru-ai/airi/pull/2561) _(蓝莓🫐, 2026-09-17)_
- `b4686b4dfb` chore(.agents/skills): clarify attachment uploads and screenshot readiness (#2564) [#2564](https://github.com/moeru-ai/airi/pull/2564) _(Neko, 2026-09-17)_
- `72999dda75` refactor(api-server): centralize Redis cache expiry policy (#2563) [#2563](https://github.com/moeru-ai/airi/pull/2563) _(RainbowBird, 2026-09-17)_
- `83b8b9afd4` fix(api-server): expire Flux balance cache after one minute (#2562) [#2562](https://github.com/moeru-ai/airi/pull/2562) _(RainbowBird, 2026-09-17)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 3 file(s) (+13/-7)
- `.agents/skills/create-pr/SKILL.md` *(+2/-2)*
- `.agents/skills/upload-github-attachment/SKILL.md` *(+5/-4)*
- `.agents/skills/use-vishot-with-web/SKILL.md` *(+6/-1)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 25 file(s) (+789/-90)
- `apps/stage-tamagotchi/README.md` *(+46/-0)*
- `apps/stage-tamagotchi/build/entitlements.mac.plist` *(+2/-0)*
- `apps/stage-tamagotchi/electron-builder.config.ts` *(+3/-0)*
- `apps/stage-tamagotchi/electron.vite.config.ts` *(+2/-0)*
- `apps/stage-tamagotchi/package.json` *(+2/-0)*
- `apps/stage-tamagotchi/src/main/index.ts` *(+2/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/computer-use/index.ts` *(+36/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/computer-use/runtime.test.ts` *(+70/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/computer-use/runtime.ts` *(+170/-0)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+36/-0)*
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+46/-46)*
- `apps/stage-tamagotchi/src/renderer/components/devtools/resource-events.browser.test.ts` *(+97/-0)*
- `apps/stage-tamagotchi/src/renderer/components/devtools/resource-events.vue` *(+79/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/resource-status-island/index.vue` *(+8/-2)*
- `apps/stage-tamagotchi/src/renderer/pages/devtools/performance-visualizer.vue` *(+4/-1)*
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` *(+51/-14)*
- `apps/stage-tamagotchi/src/renderer/stores/stage-window-lifecycle.test.ts` *(+1/-12)*
- `apps/stage-tamagotchi/src/renderer/stores/tools/built-in.test.ts` *(+3/-0)*
- `apps/stage-tamagotchi/src/renderer/stores/tools/built-in.ts` *(+8/-0)*
- `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/computer-use.ts` *(+54/-0)*
- `apps/stage-tamagotchi/src/renderer/stores/tools/index.ts` *(+1/-0)*
- `apps/stage-tamagotchi/src/renderer/utils/fade-on-hover.test.ts` *(+29/-1)*
- `apps/stage-tamagotchi/src/renderer/utils/fade-on-hover.ts` *(+19/-11)*
- `apps/stage-tamagotchi/src/renderer/utils/stage-three-transparency.ts` *(+8/-3)*
- `apps/stage-tamagotchi/src/shared/eventa/computer-use.ts` *(+12/-0)*

#### Deprecated Surfaces (Control Island) (`⚪ ignore / rejected in fork (decoupled into Control Strip)`) — 1 file(s) (+13/-12)
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/index.vue` *(+13/-12)*

#### Other / Uncategorized (`🔍 inspect`) — 10 file(s) (+191/-3)
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/stage-ui/src/components/scenarios/providers/index.ts` *(+1/-0)*
- `packages/stage-ui/src/components/scenarios/providers/provider-download-model.vue` *(+63/-0)*
- `packages/stage-ui/src/libs/providers/providers/index.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/providers/providers/local-audio/index.ts` *(+6/-1)*
- `packages/stage-ui/src/libs/providers/providers/prompt-api/index.ts` *(+85/-0)*
- `packages/stage-ui/src/libs/providers/providers/provider-definitions.test.ts` *(+14/-0)*
- `packages/stage-ui/src/stores/ai/chat-llm/tools.test.ts` *(+11/-0)*
- `packages/stage-ui/src/stores/ai/chat-llm/tools.ts` *(+6/-1)*
- `pnpm-workspace.yaml` *(+3/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 13 file(s) (+1772/-812)
- `packages/i18n/src/locales/en/settings.yaml` *(+9/-0)*
- `packages/i18n/src/locales/en/stage.yaml` *(+4/-0)*
- `packages/i18n/src/locales/en/tamagotchi/settings.yaml` *(+12/-0)*
- `packages/i18n/src/locales/es/settings.yaml` *(+340/-135)*
- `packages/i18n/src/locales/fr/settings.yaml` *(+304/-106)*
- `packages/i18n/src/locales/ja/settings.yaml` *(+173/-104)*
- `packages/i18n/src/locales/ko/settings.yaml` *(+186/-101)*
- `packages/i18n/src/locales/ru/settings.yaml` *(+254/-97)*
- `packages/i18n/src/locales/vi/settings.yaml` *(+229/-93)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+89/-84)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+4/-0)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/settings.yaml` *(+12/-0)*
- `packages/i18n/src/locales/zh-Hant/settings.yaml` *(+156/-92)*

#### UI Primitives & Pages (`📦 import / inspect`) — 3 file(s) (+91/-4)
- `packages/stage-pages/package.json` *(+1/-0)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardCreationDialog.vue` *(+4/-4)*
- `packages/stage-pages/src/pages/settings/providers/chat/prompt-api.vue` *(+86/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 2 file(s) (+116/-0)
- `packages/stage-ui/package.json` *(+1/-0)*
- `pnpm-lock.yaml` *(+115/-0)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 2 file(s) (+44/-4)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+28/-0)*
- `packages/stage-ui/src/stores/chat.ts` *(+16/-4)*

#### Provider & Model Integrations (`📦 import / inspect`) — 1 file(s) (+7/-2)
- `packages/stage-ui/src/stores/providers/provider.ts` *(+7/-2)*

#### Cloud Services, Billing & Auth (`⚪ ignore / rejected in fork (offline-first architecture)`) — 14 file(s) (+338/-29)
- `server/apps/api/README.md` *(+14/-0)*
- `server/apps/api/src/libs/redis/cache.test.ts` *(+44/-0)*
- `server/apps/api/src/libs/redis/cache.ts` *(+28/-0)*
- `server/apps/api/src/routes/stripe/price-catalog.test.ts` *(+7/-2)*
- `server/apps/api/src/routes/stripe/price-catalog.ts` *(+1/-1)*
- `server/apps/api/src/services/adapters/config-kv/contracts.ts` *(+1/-1)*
- `server/apps/api/src/services/adapters/config-kv/store.test.ts` *(+8/-8)*
- `server/apps/api/src/services/adapters/config-kv/store.ts` *(+2/-1)*
- `server/apps/api/src/services/domain/billing/billing-service.ts` *(+4/-4)*
- `server/apps/api/src/services/domain/billing/tests/billing-service.test.ts` *(+23/-2)*
- `server/apps/api/src/services/domain/flux-cache.ts` *(+29/-0)*
- `server/apps/api/src/services/domain/flux.test.ts` *(+72/-5)*
- `server/apps/api/src/services/domain/flux.ts` *(+5/-5)*
- `server/docs/ai/adr/2026-09-17-flux-cache-ttl.md` *(+100/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (13)
- [#2570](https://github.com/moeru-ai/airi/pull/2570) `feat(stage-tamagotchi): display recent VRM resource events` by **@Redestiny** *(1 comments)*
- [#2567](https://github.com/moeru-ai/airi/pull/2567) `feat(provider-inference): add AnonRouter chat provider` by **@anonrouterai** *(3 comments)*
- [#2573](https://github.com/moeru-ai/airi/pull/2573) `feat(stage-tamagotchi): pass clicks through blank stage areas` by **@chiba233** *(1 comments)*
- [#2574](https://github.com/moeru-ai/airi/pull/2574) `fix(stage-tamagotchi): keep the controls menu corners round when clipped` by **@chiba233** *(1 comments)*
- [#2572](https://github.com/moeru-ai/airi/pull/2572) `feat(plugin-host): add activation planner` by **@leaft** *(Draft)* *(1 comments)*
- [#2568](https://github.com/moeru-ai/airi/pull/2568) `refactor(stage-ui): airi card ui` by **@clansty** *(9 comments)*
- [#2571](https://github.com/moeru-ai/airi/pull/2571) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2569](https://github.com/moeru-ai/airi/pull/2569) `feat(stage-tamagotchi): show recent VRM resource events` by **@Bruce-Yii** *(1 comments)*
- [#2566](https://github.com/moeru-ai/airi/pull/2566) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2565](https://github.com/moeru-ai/airi/pull/2565) `feat(stage-tamagotchi): add desktop computer use with AUV` by **@luoling8192** *(7 comments)*
- [#2564](https://github.com/moeru-ai/airi/pull/2564) `chore(.agents/skills): clarify attachment uploads and screenshot readiness` by **@nekomeowww** *(4 comments)*
- [#2563](https://github.com/moeru-ai/airi/pull/2563) `refactor(api-server): centralize Redis cache expiry policy` by **@luoling8192** *(4 comments)*
- [#2562](https://github.com/moeru-ai/airi/pull/2562) `fix(api-server): expire Flux balance cache after one minute` by **@luoling8192** *(5 comments)*

#### 🔄 PR Status & Lifecycle Changes (5)
- [#2520](https://github.com/moeru-ai/airi/pull/2520) `fix(api-server): complete cache expiry cleanup` — `OPEN` ➔ `CLOSED`
- [#2299](https://github.com/moeru-ai/airi/pull/2299) `feat(providers): add Prompt API Provider` — `OPEN` ➔ `MERGED`
- [#2558](https://github.com/moeru-ai/airi/pull/2558) `fix(stage-ui): hide browser local transcription provider until its settings page exists` — `OPEN` ➔ `MERGED`
- [#2561](https://github.com/moeru-ai/airi/pull/2561) `fix(stage-pages): keep required field labels on one line` — `OPEN` ➔ `MERGED`
- [#2538](https://github.com/moeru-ai/airi/pull/2538) `refactor(live2d): move live2d asset download to stage-ui-live2d` — `OPEN` ➔ `CLOSED`

#### 💬 Discussion Activity (17)
- [#2491](https://github.com/moeru-ai/airi/pull/2491) `feat(server): group TTS billing history by chat round` — *+42 comments (10 ➔ 52 total)*
- [#2520](https://github.com/moeru-ai/airi/pull/2520) `fix(api-server): complete cache expiry cleanup` — *+4 comments (7 ➔ 11 total)*
- [#2471](https://github.com/moeru-ai/airi/pull/2471) `feat(stage-ui): sync user providers to a cloud replica` — *+10 comments (52 ➔ 62 total)*
- [#2498](https://github.com/moeru-ai/airi/pull/2498) `WIP live2d ambient light with normal map and pseudo-3d light remodel` — *+1 comments (1 ➔ 2 total)*
- [#2299](https://github.com/moeru-ai/airi/pull/2299) `feat(providers): add Prompt API Provider` — *+1 comments (42 ➔ 43 total)*
- [#2352](https://github.com/moeru-ai/airi/pull/2352) `fix(stage-ui-three): maintain vrm emotion weights and prevent morph conflicts` — *+1 comments (40 ➔ 41 total)*
- [#2557](https://github.com/moeru-ai/airi/pull/2557) `fix(stage-ui): persist onboarding provider config through synced actions` — *+3 comments (2 ➔ 5 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+2 comments (97 ➔ 99 total)*
- [#2550](https://github.com/moeru-ai/airi/pull/2550) `feat(hearing): add bundled Sherpaw speech recognition` — *+3 comments (5 ➔ 8 total)*
- [#2560](https://github.com/moeru-ai/airi/pull/2560) `fix(stage-ui): emit Uint8Array chunks for streaming transcription audio` — *+1 comments (0 ➔ 1 total)*
- [#2555](https://github.com/moeru-ai/airi/pull/2555) `test(stage-tamagotchi): cover Fade on Hover interaction recovery` — *+1 comments (0 ➔ 1 total)*
- [#2561](https://github.com/moeru-ai/airi/pull/2561) `fix(stage-pages): keep required field labels on one line` — *+1 comments (0 ➔ 1 total)*
- [#2119](https://github.com/moeru-ai/airi/pull/2119) `feat(stage-ui): compile CCv3 character card runtime` — *+4 comments (54 ➔ 58 total)*
- [#2120](https://github.com/moeru-ai/airi/pull/2120) `refactor(stage-pages): rebuild AIRI Card editor` — *+3 comments (37 ➔ 40 total)*
- [#2554](https://github.com/moeru-ai/airi/pull/2554) `feat(api): add stateless Responses gateway with Flux settlement` — *+4 comments (4 ➔ 8 total)*
- [#2547](https://github.com/moeru-ai/airi/pull/2547) `feat(stage-ui): add hearing and sign-in status capsules` — *+2 comments (9 ➔ 11 total)*
- [#2538](https://github.com/moeru-ai/airi/pull/2538) `refactor(live2d): move live2d asset download to stage-ui-live2d` — *+1 comments (11 ➔ 12 total)*

---
## [2026-09-16] Upstream Delta: `3da3cf81..1b019c32` (2 commits, 44 files, 16 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 2 commits (`3da3cf81..1b019c32`) including the landmark Extension folder import feature in Plugin Host (#2506, +2,711/-517 across 40 files) and a fix for onboarding provider credentials lost during cross-window Pinia sync (#2557). In active PRs, upstream refreshed and rebased major CCv3 character card compilation (#2119) and card editor rebuild (#2120) branches, addressed streaming audio transcription upload bugs (#2560), and continued expanding cloud server Responses gateway with commercial Flux settlement (#2554).
* **Discussion & Community Buzz**:
  - 💬 **#2435: `feat(stage-ui): add local FunASR transcription provider` (+2 new comments, 196 total)**: Continued massive community velocity for offline Chinese ASR.
  - 💬 **#2506: `feat(plugin-host): import extensions from folders` (+2 new comments, 144 total, merged)**: Culmination of extensive community discussion on Extension Manifest v2 and safe folder imports.
  - 💬 **#2121: `chore(i18n): update translations` (+3 new comments, 97 total)**: Steady Crowdin localization translation submissions.
  - 💬 **#2119: `feat(stage-ui): compile CCv3 character card runtime` (54 comments)**: Major refresh and rebase activity on CCv3 Lorebook, macro, and greeting compilation.
  - 💬 **#2120: `refactor(stage-pages): rebuild AIRI Card editor` (37 comments)**: Updated multi-tab card editor with dirty draft state tracking.
  - 💬 **#2558: `fix(stage-ui): hide browser local transcription provider until its settings page exists` (10 comments)**: Discussion on hiding incomplete `<WIP />` provider settings pages.
  - 💬 **#2552: `feat(stage) add bilingual subtitles` (+5 new comments, 9 total)**: Active community design iteration on dual-language subtitle chunk synchronization.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2560: `fix(stage-ui): emit Uint8Array chunks for streaming transcription audio`**: High-value audio pipeline fix. Changes VAD and audio worklet streaming emitters to output `Uint8Array` instead of raw `ArrayBuffer`, avoiding Chromium `fetch` streaming body rejections (`TypeError: Failed to fetch`).
  - ⭐ **PR #2561: `fix(stage-pages): keep required field labels on one line`**: Clean, low-risk CSS fix in `CardCreationDialog` preventing CJK labels (`名字`, `版本`) from line-breaking on narrow screens.
  - 🔍 **PR #2119 (Selective Utilities): `compile CCv3 character card runtime`**: Isolated Lorebook matching primitives (regex scanning in lazy Worker with 1s timeout, depth sorting, selective keys) could be extracted for this fork's prompt builder without adopting upstream's monolithic chat session refactoring.
  - 🔍 **PR #2552: `feat(stage) add bilingual subtitles` (Monitor)**: Relevant to our `airi-caption-subsystem`; monitor for clean subtitle segment sync patterns.
  - ⚪ **Auto-Reject / Do Not Port**: PR #2554 (`hosted Responses gateway with Flux settlement` - violates local-first invariant); Commit `1b019c32b3` / PR #2557 (`onboarding pinia-plugin-synced` - our fork uses Onboarding V3 and `providersRepo`).
* **Divergence / Collision Warnings**:
  - ⚠️ **`apps/stage-tamagotchi/src/main/services/airi/plugins/` (Commit `827d22502e` / PR #2506)**: Massive additions to Electron main plugin loading and directory imports. Our fork uses decoupled desktop surfaces and `injeca` dependency injection; do not directly merge without adapting to `injeca`.
  - ⚠️ **`packages/stage-ui/src/stores/chat.ts` (PR #2119)**: Upstream changes prompt compilation and conversation model flow. Our fork maintains multi-actor routing (`<|ACTOR|>`), STMM/LTMM memory layers, and emotional cue parsing in this pipeline.
  - ⚠️ **`server/` Cloud Services (PR #2554)**: Hosted cloud routing, Stripe/Flux settlement, and rate-limiting infrastructure are strictly incompatible with our local-first desktop focus.

### 📋 Upstream Commits
- `1b019c32b3` fix(stage-ui): persist onboarding provider config through synced actions (#2557) [#2557](https://github.com/moeru-ai/airi/pull/2557) _(凌莞~(=^▽^=), 2026-09-16)_
- `827d22502e` feat(plugin-host): import extensions from folders (#2506) [#2506](https://github.com/moeru-ai/airi/pull/2506) _(leafyy, 2026-09-16)_

### 🔬 Subsystem Breakdown
#### Electron Desktop Shell (`⚠️ hand-merge`) — 20 file(s) (+1565/-308)
- `apps/stage-tamagotchi/src/main/index.ts` *(+14/-1)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/examples/devtools-sample-plugin/README.md` *(+7/-10)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/examples/devtools-sample-plugin/extension.airi.json` *(+23/-8)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/debug.ts` *(+1/-3)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/directory-import.test.ts` *(+312/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/directory-import.ts` *(+516/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/index.ts` *(+64/-7)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/host/registry.ts` *(+42/-43)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/index.test.ts` *(+429/-10)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/index.ts` *(+120/-6)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/kits/widget/asset-url.ts` *(+3/-2)*
- `apps/stage-tamagotchi/src/main/services/airi/plugins/types.ts` *(+10/-6)*
- `apps/stage-tamagotchi/src/renderer/App.vue` *(+9/-0)*
- `apps/stage-tamagotchi/src/renderer/widgets/extension-ui/components/extension-ui-host.vue` *(+2/-1)*
- `apps/stage-tamagotchi/src/renderer/widgets/extension-ui/composables/use-extension-ui-for-module.ts` *(+1/-2)*
- `apps/stage-tamagotchi/src/renderer/widgets/extension-ui/composables/use-iframe-message-port.ts` *(+1/-2)*
- `apps/stage-tamagotchi/src/renderer/widgets/extension-ui/host.ts` *(+1/-1)*
- `apps/stage-tamagotchi/src/shared/eventa/index.ts` *(+0/-45)*
- `apps/stage-tamagotchi/src/shared/eventa/plugin/capabilities.ts` *(+2/-19)*
- `apps/stage-tamagotchi/src/shared/eventa/plugin/host.ts` *(+8/-142)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+38/-0)
- `packages/i18n/src/locales/en/settings.yaml` *(+19/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+19/-0)*

#### Documentation & Scaffolding (`⚪ ignore`) — 3 file(s) (+52/-1)
- `packages/plugin-sdk/README.md` *(+32/-0)*
- `packages/plugin-sdk/docs/design/multi-transport.md` *(+1/-1)*
- `packages/stage-shared/README.md` *(+19/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 3 file(s) (+9/-0)
- `packages/plugin-sdk/package.json` *(+2/-0)*
- `packages/stage-shared/package.json` *(+1/-0)*
- `pnpm-lock.yaml` *(+6/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 14 file(s) (+1083/-219)
- `packages/plugin-sdk/src/extension/index.test.ts` *(+1/-3)*
- `packages/plugin-sdk/src/extension/shared.ts` *(+0/-2)*
- `packages/plugin-sdk/src/plugin-host/core.test.ts` *(+404/-49)*
- `packages/plugin-sdk/src/plugin-host/core.ts` *(+31/-8)*
- `packages/plugin-sdk/src/plugin-host/runtimes/node/loaders/fs.ts` *(+8/-7)*
- `packages/plugin-sdk/src/plugin-host/shared/index.ts` *(+1/-0)*
- `packages/plugin-sdk/src/plugin-host/shared/manifest.ts` *(+42/-0)*
- `packages/plugin-sdk/src/plugin-host/shared/types.ts` *(+181/-68)*
- `packages/stage-shared/src/plugin-host.ts` *(+119/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding.browser.test.ts` *(+184/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding.vue` *(+7/-8)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-provider-configuration.vue` *(+19/-7)*
- `packages/stage-ui/src/stores/devtools/plugin-host-debug.test.ts` *(+57/-1)*
- `packages/stage-ui/src/stores/devtools/plugin-host-debug.ts` *(+29/-66)*

#### UI Primitives & Pages (`📦 import / inspect`) — 1 file(s) (+174/-4)
- `packages/stage-pages/src/pages/devtools/plugin-host.vue` *(+174/-4)*

#### Provider & Model Integrations (`📦 import / inspect`) — 1 file(s) (+111/-0)
- `packages/stage-ui/src/stores/providers/onboarding-save.browser.test.ts` *(+111/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (9)
- [#2119](https://github.com/moeru-ai/airi/pull/2119) `feat(stage-ui): compile CCv3 character card runtime` by **@luoling8192** *(54 comments)*
- [#2120](https://github.com/moeru-ai/airi/pull/2120) `refactor(stage-pages): rebuild AIRI Card editor` by **@luoling8192** *(37 comments)*
- [#2561](https://github.com/moeru-ai/airi/pull/2561) `fix(stage-pages): keep required field labels on one line` by **@chiba233** *(0 comments)*
- [#2560](https://github.com/moeru-ai/airi/pull/2560) `fix(stage-ui): emit Uint8Array chunks for streaming transcription audio` by **@JamesHu6657** *(0 comments)*
- [#2558](https://github.com/moeru-ai/airi/pull/2558) `fix(stage-ui): hide browser local transcription provider until its settings page exists` by **@Fan-xxy** *(10 comments)*
- [#2554](https://github.com/moeru-ai/airi/pull/2554) `feat(api): add stateless Responses gateway with Flux settlement` by **@luoling8192** *(4 comments)*
- [#2557](https://github.com/moeru-ai/airi/pull/2557) `fix(stage-ui): persist onboarding provider config through synced actions` by **@clansty** *(2 comments)*
- [#2556](https://github.com/moeru-ai/airi/pull/2556) `fix: treat cleanup failure as best-effort in routeModelAliasCandidates` by **@zapabob** *(1 comments)*
- [#2555](https://github.com/moeru-ai/airi/pull/2555) `test(stage-tamagotchi): cover Fade on Hover interaction recovery` by **@lorenzozanee** *(0 comments)*

#### 🔄 PR Status & Lifecycle Changes (2)
- [#2549](https://github.com/moeru-ai/airi/pull/2549) `feat(plugin-sdk): support extension-hosted kits` — `OPEN` ➔ `CLOSED`
- [#2506](https://github.com/moeru-ai/airi/pull/2506) `feat(plugin-host): import extensions from folders` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (5)
- [#2549](https://github.com/moeru-ai/airi/pull/2549) `feat(plugin-sdk): support extension-hosted kits` — *+1 comments (1 ➔ 2 total)*
- [#2552](https://github.com/moeru-ai/airi/pull/2552) `feat(stage)    add bilingual subtitles` — *+5 comments (4 ➔ 9 total)*
- [#2506](https://github.com/moeru-ai/airi/pull/2506) `feat(plugin-host): import extensions from folders` — *+2 comments (142 ➔ 144 total)*
- [#2435](https://github.com/moeru-ai/airi/pull/2435) `feat(stage-ui): add local FunASR transcription provider` — *+2 comments (194 ➔ 196 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+3 comments (94 ➔ 97 total)*

---
## [2026-09-15] Upstream Delta: `1a79f8b1..3da3cf81` (6 commits, 104 files, 26 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 6 commits (`1a79f8b1..3da3cf81`) featuring a major overhaul to support the OpenAI Responses API (+4,079/-1,094 across 94 files in #2477), inter-window speech settings synchronization (#2467), removal of duplicate speech voice loads on mount (#2543), anti-slop linting rules (#2544), and commercial Apple In-App Purchase backend integration (#2339). In active PRs, upstream opened bundled Sherpaw offline speech recognition (#2550), chat image understanding (#2551), revived bilingual subtitles (#2552), and is experiencing huge community engagement around local drop-in plugins and folder extension imports (#2541, #2506).
* **Discussion & Community Buzz**:
  - 💬 **#2506: `feat(plugin-host): import extensions from folders` (+39 new comments, 142 total)**: Major community momentum evaluating external folder scanning, hot-reloading, and manifest formats for extensions.
  - 💬 **#2541: `Telltworose/feat/drop in plugins` (+39 new comments, 56 total)**: Intense discussion spike around drop-in plugin runtime and file placement.
  - 💬 **#2537: `add bilingual subtitles` (+9 new comments, 43 total, closed in favor of #2552)**: Active dialogue on translation chunk synchronization leading into the clean refactor in #2552.
  - 💬 **#2435: `feat(stage-ui): add local FunASR transcription provider` (+7 new comments, 194 total)**: Continued community interest in local Chinese/multilingual speech-to-text.
  - 💬 **#2551: `feat(stage-ui): add chat image understanding across Web and Electron` (12 comments)**: High initial review activity on multi-modal vision prompt plumbing.
  - 💬 **#2547: `feat(stage-ui): add hearing and sign-in status capsules` (9 comments)**: UI review on status indicators.
  - 💬 **#2550: `feat(hearing): add bundled Sherpaw speech recognition` (5 comments)**: Offline STT packaging discussion.
  - 💬 **#2546: `feat(stage-ui): add voice messages and mobile dictation` (5 comments)**: Voice messaging primitives.
  - 💬 **#2538: `refactor(live2d): move live2d asset download to stage-ui-live2d` (+4 new comments, 11 total)**: Internal module boundary cleanup.
  - 💬 **#2525: `fix(stage-pages): load speech provider voices after configuration updates` (+4 new comments, 27 total)**: Debounce timing verification.
  - 💬 **#2467: `fix(stage-ui): synchronize speech settings across windows` (+3 new comments, 28 total, merged)**: Resolving cross-window follower race conditions.
  - 💬 **#2477: `feat(client): support Responses API with user-provided API keys` (+2 new comments, 42 total, merged)**: Large-scale client integration debate.
  - 💬 **#2339: `feat(api): add Apple IAP payment channel backend` (+2 new comments, 40 total, merged)**: Commercial payment verification review.
  - 💬 **#2121: `chore(i18n): update translations` (+2 new comments, 94 total)**: Routine localization additions.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2543 / Commit `7cfd395561`: `fix(stage-pages): avoid duplicate speech voice loads`**: Clean, high-value fix. Removes `{ immediate: true }` from debounced watchers across speech provider settings (`alibaba-cloud-model-studio.vue`, `deepgram-tts.vue`, `elevenlabs.vue`, `volcengine.vue`), stopping redundant immediate voice queries on mount.
  - 🔍 **PR #2477 (Selective Primitive): `response-citations.vue`**: Isolated UI primitive (`packages/stage-ui/src/components/scenarios/chat/components/response-citations.vue`) for rendering web citations and numbered clickable links from grounding sources.
  - 🔍 **PR #2550: `feat(hearing): add bundled Sherpaw speech recognition` (Monitor)**: Upstream exploration of bundled offline speech recognition using Sherpa-onnx. Worth monitoring as a candidate offline hearing provider.
  - ⚪ **Auto-Reject / Do Not Port**: PR #2339 (`Apple IAP backend` - violates local-first invariant); PR #2467 (`cross-window speech sync` - tightly coupled to upstream remote server sync).
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/core-agent/` & `packages/stage-ui/src/stores/chat.ts` (PR #2477)**: Upstream heavily refactored orchestrator runtimes, turn projections, and streaming handlers for OpenAI Responses API. Our fork maintains custom memory injection, `<|ACTOR|>` routing, and emotional cue parsing in these files; avoid blanket merges.
  - ⚠️ **`apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` (PR #2477)**: Touches legacy monolithic area. In our fork, desktop UI is cleanly decoupled into `ControlStrip.vue` and `chat/` views.
  - ⚠️ **Plugin Ecosystems (PR #2541, #2506, #2549)**: Upstream is implementing folder/kit loaders. Must be evaluated against our `injeca` DI container rather than merged directly.

### 📋 Upstream Commits
- `3da3cf8154` chore(nix): update pnpmDeps hash (#2553) [#2553](https://github.com/moeru-ai/airi/pull/2553) _(Weathercold, 2026-09-15)_
- `e1957d2832` feat(client): support Responses API with user-provided API keys (#2477) [#2477](https://github.com/moeru-ai/airi/pull/2477) _(RainbowBird, 2026-09-15)_
- `7cfd395561` fix(stage-pages): avoid duplicate speech voice loads (#2543) [#2543](https://github.com/moeru-ai/airi/pull/2543) _(Columbina, 2026-09-14)_
- `a5716a8370` chore(nix): update pnpmDeps hash (#2548) [#2548](https://github.com/moeru-ai/airi/pull/2548) _(Weathercold, 2026-09-14)_
- `7eec25eeeb` chore(lint): add eslint-plugin-slop (#2544) [#2544](https://github.com/moeru-ai/airi/pull/2544) _(Neko, 2026-09-15)_
- `334f8b9c6c` fix(stage-ui): synchronize speech settings across windows (#2467) [#2467](https://github.com/moeru-ai/airi/pull/2467) _(Columbina, 2026-09-14)_

### 🔬 Subsystem Breakdown
#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 2 file(s) (+6/-6)
- `apps/stage-pocket/src/pages/devtools/performance-playground.vue` *(+3/-3)*
- `apps/stage-web/src/pages/devtools/performance-playground.vue` *(+3/-3)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 1 file(s) (+7/-1)
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` *(+7/-1)*

#### Other / Uncategorized (`🔍 inspect`) — 41 file(s) (+1507/-384)
- `eslint.config.ts` *(+21/-0)*
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `packages/{provider-inference/src/providers/cloud/azure-openai/index.test.ts => core-agent/src/agents/spark-command/azure-openai.test.ts}` *(+3/-2)*
- `packages/provider-inference/src/generation.ts` *(+24/-0)*
- `packages/provider-inference/src/model-catalog.test.ts` *(+55/-0)*
- `packages/provider-inference/src/model-catalog.ts` *(+64/-0)*
- `packages/provider-inference/src/providers/cloud/ark-providers.test.ts` *(+1/-1)*
- `packages/provider-inference/src/providers/cloud/openai-compatible/index.ts` *(+27/-7)*
- `packages/provider-inference/src/providers/cloud/openai/index.ts` *(+56/-13)*
- `packages/provider-inference/src/providers/cloud/openrouter-ai/index.test.ts` *(+2/-81)*
- `packages/provider-inference/src/providers/cloud/openrouter-ai/index.ts` *(+10/-0)*
- `packages/provider-inference/src/providers/responses.test.ts` *(+96/-0)*
- `packages/provider-inference/src/responses.browser.test.ts` *(+111/-0)*
- `packages/provider-inference/src/types.ts` *(+51/-2)*
- `packages/provider-inference/src/validators/openai-compatible.test.ts` *(+38/-0)*
- `packages/provider-inference/src/validators/openai-compatible.ts` *(+20/-4)*
- `packages/stage-ui/src/components/scenarios/chat/components/assistant-item.vue` *(+35/-14)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.browser.test.ts` *(+30/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.vue` *(+7/-2)*
- `packages/stage-ui/src/components/scenarios/chat/components/response-citations.browser.test.ts` *(+15/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/response-citations.vue` *(+22/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/tool-call-results.test.ts` *(+18/-14)*
- `packages/stage-ui/src/components/scenarios/chat/components/tool-call-results.ts` *(+17/-27)*
- `packages/stage-ui/src/components/scenarios/providers/index.ts` *(+1/-0)*
- `packages/stage-ui/src/components/scenarios/providers/provider-generation-settings.vue` *(+97/-0)*
- `packages/stage-ui/src/components/scenarios/providers/speech-provider-settings.vue` *(+109/-50)*
- `packages/stage-ui/src/composables/use-data-maintenance.browser.test.ts` *(+10/-0)*
- `packages/stage-ui/src/composables/vision/use-vision-inference.test.ts` *(+45/-46)*
- `packages/stage-ui/src/composables/vision/use-vision-inference.ts` *(+17/-26)*
- `packages/stage-ui/src/stores/ai/chat-llm/llm.test.ts` *(+11/-13)*
- `packages/stage-ui/src/stores/ai/chat-llm/llm.ts` *(+5/-6)*
- `packages/stage-ui/src/stores/character/orchestrator/index.test.ts` *(+12/-10)*
- `packages/stage-ui/src/stores/character/orchestrator/store.ts` *(+2/-1)*
- `packages/stage-ui/src/stores/markdown-stress.ts` *(+8/-12)*
- `packages/stage-ui/src/stores/mods/api/context-bridge.ts` *(+2/-2)*
- `packages/stage-ui/src/stores/modules/artistry-autonomous.ts` *(+12/-11)*
- `packages/stage-ui/src/stores/modules/consciousness.test.ts` *(+4/-3)*
- `packages/stage-ui/src/stores/tool-call-rerun.test.ts` *(+80/-1)*
- `packages/stage-ui/src/stores/tool-call-rerun.ts` *(+83/-35)*
- `patches/@xsai-ext__responses@0.5.0.patch` *(+281/-0)*
- `pnpm-workspace.yaml` *(+4/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 3 file(s) (+87/-88)
- `package.json` *(+1/-0)*
- `packages/provider-inference/package.json` *(+2/-1)*
- `pnpm-lock.yaml` *(+84/-87)*

#### Core Agent Runtime (`🔍 inspect`) — 37 file(s) (+2379/-526)
- `packages/core-agent/README.md` *(+62/-0)*
- `packages/core-agent/package.json` *(+2/-0)*
- `packages/core-agent/src/agents/spark-command/openrouter-ai.test.ts` *(+86/-0)*
- `packages/core-agent/src/agents/spark-notify/agent.test.ts` *(+5/-6)*
- `packages/core-agent/src/agents/spark-notify/agent.ts` *(+14/-10)*
- `packages/core-agent/src/agents/spark-notify/types.ts` *(+6/-5)*
- `packages/core-agent/src/contracts/llm-port.ts` *(+4/-3)*
- `packages/core-agent/src/index.ts` *(+4/-4)*
- `packages/core-agent/src/messages/chat-completions.test.ts` *(+50/-0)*
- `packages/core-agent/src/messages/chat-completions.ts` *(+189/-0)*
- `packages/core-agent/src/messages/compaction.test.ts` *(+3/-2)*
- `packages/core-agent/src/messages/compaction.ts` *(+11/-12)*
- `packages/core-agent/src/messages/index.ts` *(+0/-1)*
- `packages/core-agent/src/messages/preview.test.ts` *(+14/-0)*
- `packages/core-agent/src/messages/preview.ts` *(+45/-0)*
- `packages/core-agent/src/messages/projection.test.ts` *(+6/-5)*
- `packages/core-agent/src/messages/projection.ts` *(+5/-4)*
- `packages/core-agent/src/messages/render-context.ts` *(+87/-0)*
- `packages/core-agent/src/messages/render-provider-chat.test.ts` *(+3/-2)*
- `packages/core-agent/src/messages/render-provider-chat.ts` *(+7/-81)*
- `packages/core-agent/src/messages/turns.test.ts` *(+39/-0)*
- `packages/core-agent/src/messages/turns.ts` *(+107/-0)*
- `packages/core-agent/src/messages/types.test.ts` *(+18/-3)*
- `packages/core-agent/src/messages/types.ts` *(+124/-19)*
- `packages/core-agent/src/runtime/chat-completions.test.ts` *(+76/-0)*
- `packages/core-agent/src/runtime/chat-completions.ts` *(+53/-0)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.test.ts` *(+142/-45)*
- `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts` *(+74/-100)*
- `packages/core-agent/src/runtime/generation.ts` *(+81/-0)*
- `packages/core-agent/src/runtime/llm-service.test.ts` *(+106/-42)*
- `packages/core-agent/src/runtime/llm-service.ts` *(+33/-171)*
- `packages/core-agent/src/runtime/request-context.ts` *(+21/-0)*
- `packages/core-agent/src/runtime/responses.test.ts` *(+613/-0)*
- `packages/core-agent/src/runtime/responses.ts` *(+218/-0)*
- `packages/core-agent/src/runtime/xsai-events.ts` *(+45/-0)*
- `packages/core-agent/src/types/chat.ts` *(+7/-0)*
- `packages/core-agent/src/types/llm.ts` *(+19/-11)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+12/-0)
- `packages/i18n/src/locales/en/settings.yaml` *(+6/-0)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+6/-0)*

#### Documentation & Scaffolding (`⚪ ignore`) — 2 file(s) (+71/-0)
- `packages/provider-inference/README.md` *(+39/-0)*
- `patches/README.md` *(+32/-0)*

#### Stage Layouts & Shells (`🔍 inspect`) — 1 file(s) (+6/-10)
- `packages/stage-layouts/src/composables/useChatToolCallRerun.ts` *(+6/-10)*

#### UI Primitives & Pages (`📦 import / inspect`) — 8 file(s) (+40/-13)
- `packages/stage-pages/README.md` *(+4/-0)*
- `packages/stage-pages/src/pages/settings/providers/chat/[providerId].vue` *(+7/-2)*
- `packages/stage-pages/src/pages/settings/providers/speech/alibaba-cloud-model-studio.vue` *(+0/-1)*
- `packages/stage-pages/src/pages/settings/providers/speech/deepgram-tts.vue` *(+0/-1)*
- `packages/stage-pages/src/pages/settings/providers/speech/elevenlabs.vue` *(+0/-1)*
- `packages/stage-pages/src/pages/settings/providers/speech/volcengine.vue` *(+0/-1)*
- `packages/stage-pages/src/pages/settings/providers/vision/[providerId].vue` *(+7/-2)*
- `packages/stage-pages/src/pages/v2/settings/providers/edit/[providerId]/index.vue` *(+22/-5)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 2 file(s) (+70/-72)
- `packages/stage-ui/src/stores/chat.contract.test.ts` *(+60/-64)*
- `packages/stage-ui/src/stores/chat.ts` *(+10/-8)*

#### Provider & Model Integrations (`📦 import / inspect`) — 5 file(s) (+54/-58)
- `packages/stage-ui/src/stores/providers/config.test.ts` *(+4/-4)*
- `packages/stage-ui/src/stores/providers/config.ts` *(+7/-5)*
- `packages/stage-ui/src/stores/providers/provider-model-catalog.browser.test.ts` *(+18/-0)*
- `packages/stage-ui/src/stores/providers/provider.test.ts` *(+10/-5)*
- `packages/stage-ui/src/stores/providers/provider.ts` *(+15/-44)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (11)
- [#2553](https://github.com/moeru-ai/airi/pull/2553) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2552](https://github.com/moeru-ai/airi/pull/2552) `Phx3334/feat/bilingual subtitles` by **@phx3334** *(4 comments)*
- [#2551](https://github.com/moeru-ai/airi/pull/2551) `feat(stage-ui): add chat image understanding across Web and Electron` by **@luoling8192** *(12 comments)*
- [#2550](https://github.com/moeru-ai/airi/pull/2550) `feat(hearing): add bundled Sherpaw speech recognition` by **@luoling8192** *(5 comments)*
- [#2549](https://github.com/moeru-ai/airi/pull/2549) `feat(plugin-sdk): support extension-hosted kits` by **@leaft** *(Draft)* *(1 comments)*
- [#2545](https://github.com/moeru-ai/airi/pull/2545) `fix(stage-ui): clone synchronized provider config` by **@0xSelenicDove** *(1 comments)*
- [#2543](https://github.com/moeru-ai/airi/pull/2543) `fix(stage-pages): avoid duplicate speech voice loads` by **@0xSelenicDove** *(4 comments)*
- [#2548](https://github.com/moeru-ai/airi/pull/2548) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*
- [#2544](https://github.com/moeru-ai/airi/pull/2544) `chore(lint): add eslint-plugin-slop` by **@nekomeowww** *(5 comments)*
- [#2547](https://github.com/moeru-ai/airi/pull/2547) `feat(stage-ui): add hearing and sign-in status capsules` by **@nekomeowww** *(9 comments)*
- [#2546](https://github.com/moeru-ai/airi/pull/2546) `feat(stage-ui): add voice messages and mobile dictation` by **@nekomeowww** *(5 comments)*

#### 🔄 PR Status & Lifecycle Changes (5)
- [#2477](https://github.com/moeru-ai/airi/pull/2477) `feat(client): support Responses API with user-provided API keys` — `OPEN` ➔ `MERGED`
- [#2537](https://github.com/moeru-ai/airi/pull/2537) `add bilingual subtitles` — `OPEN` ➔ `CLOSED`
- [#2467](https://github.com/moeru-ai/airi/pull/2467) `fix(stage-ui): synchronize speech settings across windows` — `OPEN` ➔ `MERGED`
- [#2542](https://github.com/moeru-ai/airi/pull/2542) `chore(lint): integrate anti-slop rule sets` — `OPEN` ➔ `CLOSED`
- [#2339](https://github.com/moeru-ai/airi/pull/2339) `feat(api): add Apple IAP payment channel backend` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (10)
- [#2477](https://github.com/moeru-ai/airi/pull/2477) `feat(client): support Responses API with user-provided API keys` — *+2 comments (40 ➔ 42 total)*
- [#2506](https://github.com/moeru-ai/airi/pull/2506) `feat(plugin-host): import extensions from folders` — *+39 comments (103 ➔ 142 total)*
- [#2541](https://github.com/moeru-ai/airi/pull/2541) `Telltworose/feat/drop in plugins` — *+39 comments (17 ➔ 56 total)*
- [#2537](https://github.com/moeru-ai/airi/pull/2537) `add bilingual subtitles` — *+9 comments (34 ➔ 43 total)*
- [#2435](https://github.com/moeru-ai/airi/pull/2435) `feat(stage-ui): add local FunASR transcription provider` — *+7 comments (187 ➔ 194 total)*
- [#2538](https://github.com/moeru-ai/airi/pull/2538) `refactor(live2d): move live2d asset download to stage-ui-live2d` — *+4 comments (7 ➔ 11 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+2 comments (92 ➔ 94 total)*
- [#2467](https://github.com/moeru-ai/airi/pull/2467) `fix(stage-ui): synchronize speech settings across windows` — *+3 comments (25 ➔ 28 total)*
- [#2525](https://github.com/moeru-ai/airi/pull/2525) `fix(stage-pages): load speech provider voices after configuration updates` — *+4 comments (23 ➔ 27 total)*
- [#2339](https://github.com/moeru-ai/airi/pull/2339) `feat(api): add Apple IAP payment channel backend` — *+2 comments (38 ➔ 40 total)*

---
## [2026-09-14] Upstream Delta: `42e3e9e8..1a79f8b1` (3 commits, 25 files, 16 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 3 commits (`42e3e9e8..1a79f8b1`) resolving Safari Form Assistant keyboard accessory bar disruption via a new plaintext contenteditable primitive (#2461), fixing Apple Speech locale changes by localizing provider instance disposal (#2540), and debouncing speech voice loading with deep cloning to prevent reactive proxy serialization errors (#2525). In active PRs, upstream opened a new drop-in filesystem plugin runtime (#2541), added anti-slop linter rules (#2542), and continues active work on bilingual subtitles (#2537) and multi-window speech settings synchronization (#2467).
* **Discussion & Community Buzz**:
  - 💬 **#2537: `add bilingual subtitles` (+17 new comments, 34 total)**: High discussion velocity regarding positional synchronization between TTS audio chunks and bracketed UST translation segments.
  - 💬 **#2477: `feat(client): support Responses API with user-provided API keys` (+12 new comments, 40 total)**: Continued architecture debate over API proxying with user credentials.
  - 💬 **#2541: `Telltworose/feat/drop in plugins` (12 comments)**: Notable immediate interest around loading drop-in plugins from the local filesystem.
  - 💬 **#2461: `fix(stage-layouts): avoid Safari Form Assistant` (+9 new comments, 28 total, merged)**: Review discussion concluding mobile Safari compatibility fixes.
  - 💬 **#2467: `fix(stage-ui): synchronize speech settings across windows` (+8 new comments, 22 total)**: In-depth technical discussion resolving follower-window race conditions and save barriers.
  - 💬 **#2539: `feat(tamagotchi): pause stage if screen is locked or system is suspending` (+5 new comments, 8 total)**: Desktop powerMonitor lifecycle integration.
  - 💬 **#2530: `fix(stage-tamagotchi): remove obsolete mouse tracking IPC` (+4 new comments, 6 total)**: Refining Vitest browser test fixtures for follower stage windows.
  - 💬 **#2459: `fix(core-agent): prevent plain-text tool call leaks` (+3 new comments, 41 total)**: Detailed review on bounded candidate buffering and JSON streaming integrity.
  - 💬 **#2121: `chore(i18n): update translations` (+3 new comments, 92 total)**: Ongoing community translation string additions.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2525 / `54e49766d8`: `fix(stage-pages): load speech provider voices after configuration updates`**: Essential fix. Uses `cloneDeep` from `es-toolkit` to snapshot provider configs before sending to synced Pinia actions (avoiding reactive Proxy serialization bugs), and adds 500ms `watchDebounced` on `apiKey`/`baseUrl` across speech providers to stop duplicate voice queries.
  - ⭐ **PR #2540 / `9f30a1977e`: `fix(stage-ui): apply Apple Speech locale in hearing settings`**: Key architectural fix for `useProviderStore`. Caches instances by `{ configKey, instance }` so config modifications cleanly dispose and recreate instances locally. Ensures `disposeProviderInstance` remains renderer-local rather than broadcast across windows.
  - 🔍 **PR #2539: `feat(tamagotchi): pause stage if screen is locked or system is suspending`**: Clean powerMonitor hooks (`suspend`, `lock-screen`) to pause avatar rendering and save CPU/battery on desktop.
  - 🔍 **PR #2461 / `1a79f8b1ca`: `fix(stage-layouts): avoid Safari Form Assistant`**: Introduces `BasicContentEditable` (`packages/ui/src/components/form/content-editable/basic-content-editable.vue`) using `contenteditable="plaintext-only"` to bypass Safari Form Assistant overlays.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/providers/provider.ts`**: Touched by PR #2540. Our fork has custom providers and offline engine wiring; apply provider cache changes with care.
  - ⚠️ **`apps/stage-tamagotchi/src/main/services/airi/plugins/` (PR #2541)**: Upstream's new drop-in plugin loader touches Electron main services. Do not merge directly; evaluate compatibility with our injeca dependency injection structure.
  - ⚠️ **`packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` (PR #2461)**: Mobile layout changes do not apply to our decoupled desktop Control Strip (`ControlStrip.vue`).
  - ⚪ **`apps/stage-tamagotchi/src/shared/eventa/index.ts` (PR #2530)**: Obsolete mouse tracking IPC removal. Already cleaned up in our fork.

### 📋 Upstream Commits
- `1a79f8b1ca` fix(stage-layouts): avoid Safari Form Assistant (#2461) [#2461](https://github.com/moeru-ai/airi/pull/2461) _(RainbowBird, 2026-09-14)_
- `9f30a1977e` fix(stage-ui): apply Apple Speech locale in hearing settings (#2540) [#2540](https://github.com/moeru-ai/airi/pull/2540) _(Neko, 2026-09-14)_
- `54e49766d8` fix(stage-pages): load speech provider voices after configuration updates (#2525) [#2525](https://github.com/moeru-ai/airi/pull/2525) _(Columbina, 2026-09-13)_

### 🔬 Subsystem Breakdown
#### Electron Desktop Shell (`⚠️ hand-merge`) — 3 file(s) (+474/-14)
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+135/-13)*
- `apps/stage-tamagotchi/src/renderer/components/chat-viewport-layout.browser.test.ts` *(+32/-1)*
- `apps/stage-tamagotchi/src/renderer/components/content-editable.browser.test.ts` *(+307/-0)*

#### Documentation & Scaffolding (`⚪ ignore`) — 1 file(s) (+20/-0)
- `docs/ai/context/ui-components.md` *(+20/-0)*

#### Stage Layouts & Shells (`🔍 inspect`) — 1 file(s) (+18/-17)
- `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` *(+18/-17)*

#### UI Primitives & Pages (`📦 import / inspect`) — 13 file(s) (+339/-50)
- `packages/stage-pages/package.json` *(+1/-0)*
- `packages/stage-pages/src/pages/settings/providers/speech/alibaba-cloud-model-studio.vue` *(+13/-13)*
- `packages/stage-pages/src/pages/settings/providers/speech/deepgram-tts.vue` *(+14/-4)*
- `packages/stage-pages/src/pages/settings/providers/speech/elevenlabs.vue` *(+13/-13)*
- `packages/stage-pages/src/pages/settings/providers/speech/kokoro-local.vue` *(+9/-4)*
- `packages/stage-pages/src/pages/settings/providers/speech/player2-speech.vue` *(+4/-1)*
- `packages/stage-pages/src/pages/settings/providers/speech/volcengine.vue` *(+14/-13)*
- `packages/ui/README.md` *(+28/-0)*
- `packages/ui/src/components/form/combobox/combobox.vue` *(+10/-2)*
- `packages/ui/src/components/form/content-editable/basic-content-editable.vue` *(+220/-0)*
- `packages/ui/src/components/form/content-editable/index.ts` *(+5/-0)*
- `packages/ui/src/components/form/index.ts` *(+1/-0)*
- `packages/ui/src/components/layouts/scrollable-area.vue` *(+7/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 4 file(s) (+82/-5)
- `packages/stage-ui/src/components/scenarios/chat/components/chat-history-scroll-container.vue` *(+5/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/history.vue` *(+2/-1)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-history-scroll.browser.test.ts` *(+29/-0)*
- `packages/stage-ui/src/components/scenarios/chat/composables/use-chat-history-scroll.ts` *(+46/-4)*

#### Provider & Model Integrations (`📦 import / inspect`) — 2 file(s) (+83/-11)
- `packages/stage-ui/src/stores/providers/provider-model-catalog.browser.test.ts` *(+64/-0)*
- `packages/stage-ui/src/stores/providers/provider.ts` *(+19/-11)*

#### Root Build & Tooling (`🔍 inspect`) — 1 file(s) (+3/-0)
- `pnpm-lock.yaml` *(+3/-0)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (2)
- [#2541](https://github.com/moeru-ai/airi/pull/2541) `Telltworose/feat/drop in plugins` by **@telltworose** *(17 comments)*
- [#2542](https://github.com/moeru-ai/airi/pull/2542) `chore(lint): integrate anti-slop rule sets` by **@nekomeowww** *(2 comments)*

#### 🔄 PR Status & Lifecycle Changes (3)
- [#2461](https://github.com/moeru-ai/airi/pull/2461) `fix(stage-layouts): avoid Safari Form Assistant` — `OPEN` ➔ `MERGED`
- [#2540](https://github.com/moeru-ai/airi/pull/2540) `fix(stage-ui): apply Apple Speech locale in hearing settings` — `OPEN` ➔ `MERGED`
- [#2525](https://github.com/moeru-ai/airi/pull/2525) `fix(stage-pages): load speech provider voices after configuration updates` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (11)
- [#2467](https://github.com/moeru-ai/airi/pull/2467) `fix(stage-ui): synchronize speech settings across windows` — *+11 comments (14 ➔ 25 total)*
- [#2477](https://github.com/moeru-ai/airi/pull/2477) `feat(client): support Responses API with user-provided API keys` — *+12 comments (28 ➔ 40 total)*
- [#2539](https://github.com/moeru-ai/airi/pull/2539) `feat(tamagotchi): pause stage if screen is locked or system is suspending` — *+5 comments (3 ➔ 8 total)*
- [#2538](https://github.com/moeru-ai/airi/pull/2538) `refactor(live2d): move live2d asset download to stage-ui-live2d` — *+1 comments (6 ➔ 7 total)*
- [#2459](https://github.com/moeru-ai/airi/pull/2459) `fix(core-agent): prevent plain-text tool call leaks` — *+3 comments (38 ➔ 41 total)*
- [#2461](https://github.com/moeru-ai/airi/pull/2461) `fix(stage-layouts): avoid Safari Form Assistant` — *+9 comments (19 ➔ 28 total)*
- [#2537](https://github.com/moeru-ai/airi/pull/2537) `add bilingual subtitles` — *+17 comments (17 ➔ 34 total)*
- [#2419](https://github.com/moeru-ai/airi/pull/2419) `test: include pipelines audio in root vitest projects` — *+1 comments (0 ➔ 1 total)*
- [#2530](https://github.com/moeru-ai/airi/pull/2530) `fix(stage-tamagotchi): remove obsolete mouse tracking IPC` — *+4 comments (2 ➔ 6 total)*
- [#2540](https://github.com/moeru-ai/airi/pull/2540) `fix(stage-ui): apply Apple Speech locale in hearing settings` — *+2 comments (4 ➔ 6 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+3 comments (89 ➔ 92 total)*

---
## [2026-09-13] Upstream Delta: `553d8a0d..42e3e9e8` (3 commits, 37 files, 19 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 3 commits (`553d8a0d..42e3e9e8`) adding native Wayland hover stability for Electron desktop controls island (#2522), introducing bidirectional swipe actions (pin/delete) with new `@proj-airi/ui` swipe primitives (#2536), and finalizing the Stripe product catalog restore for Flux packs (#2533). In active PRs, upstream is expanding desktop system power awareness (#2539), decoupling Live2D asset downloads (#2538), implementing bilingual subtitle translation tracks (#2537), and fixing Apple Speech locale switching in Hearing settings (#2540).
* **Discussion & Community Buzz**:
  - 🔥 **#2471: `feat(stage-ui): sync user providers to a cloud replica` (+17 new comments, 52 total)**: Surging community discussion debating provider credential replication to cloud backends versus local privacy.
  - 💬 **#2537: `add bilingual subtitles` (17 comments)**: Active interest around UST bracket-syntax `[translation]` sentence splitting and synchronized dual-caption overlay rendering.
  - 💬 **#2533: `refactor(api): restore Stripe product catalog as Flux pack source` (+13 new comments, 20 total, merged)**: Discussion wrapping up payment catalog restoration.
  - 💬 **#2339: `feat(api): add Apple IAP payment channel backend` (+8 new comments, 38 total)**: Ongoing architectural review for Apple App Store in-app purchase verification.
  - 💬 **#2473: `feat(auth): add native email change flow` (+6 new comments, 9 total)**: Security discussion on email re-verification tokens.
  - 💬 **#2286: `fix(stage-ui): cancel animation frames and remove drag listeners on unmount` (+5 new comments, 9 total)**: Cleanup and lifecycle leak verification.
  - 💬 **#2477: `feat(client): support Responses API with user-provided API keys` (+5 new comments, 28 total)**: Expanding provider proxy capabilities.
  - 💬 **#2525: `fix(stage-pages): load speech provider voices after configuration updates` (+4 new comments, 23 total)**: Validation across reactive speech providers.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2522 / `42e3e9e857`: `fix(stage-tamagotchi): keep controls island open on native Wayland`**: Essential Linux bugfix in `controls-island/index.vue`. ORs `useElectronMouseInElement` with DOM-based `useMouseInElement` so Chromium Wayland cursor drops cannot trigger false auto-collapses.
  - ⭐ **PR #2539: `feat(tamagotchi): pause stage if screen is locked or system is suspending`**: High-value desktop lifecycle optimization hooking Electron's `powerMonitor` (`suspend`, `lock-screen`) to pause avatar rendering and animations, saving battery and CPU.
  - 🔍 **PR #2540: `fix(stage-ui): apply Apple Speech locale in hearing settings`**: Resolves locale switching failure in Electron Settings by disposing stale instances locally instead of routing disposal to leader, and fixes combobox language label refresh.
  - 🔍 **PR #2536 / `a75b031ccc`: `feat(ui,stage-ui): add bidirectional swipe actions for conversations`**: Clean Radix-style UI swipe primitives for conversation cards (pin/delete via swipe gestures).
  - 🔍 **PR #2537: `add bilingual subtitles`**: Dual-track bilingual subtitle feature using structural alignment for synchronous foreign language and native subtitles.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/components/scenarios/chat/components/sessions-list.vue`**: Heavily refactored by PR #2536 to integrate swipe actions. Avoid direct file overwrite; port swipe gestures cleanly if adopted.
  - ⚠️ **`packages/stage-ui-live2d` (PR #2538)**: Upstream is moving Live2D assets download to a package-level postinstall/Vite script. Our fork uses custom asset packaging; do not blindly adopt upstream's asset distribution script.
  - ⚪ **`server/apps/api` (PR #2533, #2339, #2473)**: Upstream cloud payment and auth endpoints. Irrelevant to our local-first offline desktop architecture; ignore.

### 📋 Upstream Commits
- `42e3e9e857` fix(stage-tamagotchi): keep controls island open on native Wayland (#2522) [#2522](https://github.com/moeru-ai/airi/pull/2522) _(이윤진(Lee Yunjin), 2026-09-14)_
- `a75b031ccc` feat(ui,stage-ui): add bidirectional swipe actions for conversations (#2536) [#2536](https://github.com/moeru-ai/airi/pull/2536) _(Neko, 2026-09-14)_
- `00c6867b7f` refactor(api): restore Stripe product catalog as Flux pack source (#2533) [#2533](https://github.com/moeru-ai/airi/pull/2533) _(Lulu, 2026-09-12)_

### 🔬 Subsystem Breakdown
#### Electron Desktop Shell (`⚠️ hand-merge`) — 5 file(s) (+94/-23)
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/control-button-tooltip.vue` *(+4/-1)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-overflow.browser.test.ts` *(+61/-0)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-stop-speaking.test.ts` *(+12/-19)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/controls-island-stop-speaking.vue` *(+1/-1)*
- `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/index.vue` *(+16/-2)*

#### Documentation & Scaffolding (`⚪ ignore`) — 3 file(s) (+133/-5)
- `docs/ai/context/ui-components.md` *(+123/-0)*
- `packages/stage-ui/README.md` *(+4/-0)*
- `server/apps/api/README.md` *(+6/-5)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+16/-0)
- `packages/i18n/src/locales/en/stage.yaml` *(+8/-0)*
- `packages/i18n/src/locales/zh-Hans/stage.yaml` *(+8/-0)*

#### UI Primitives & Pages (`📦 import / inspect`) — 11 file(s) (+965/-13)
- `packages/stage-pages/src/pages/settings/flux.vue` *(+13/-13)*
- `packages/ui/README.md` *(+27/-0)*
- `packages/ui/src/components/misc/index.ts` *(+1/-0)*
- `packages/ui/src/components/misc/swipe-action-button.vue` *(+52/-0)*
- `packages/ui/src/components/swipe-actions/context.ts` *(+52/-0)*
- `packages/ui/src/components/swipe-actions/index.ts` *(+5/-0)*
- `packages/ui/src/components/swipe-actions/swipe-actions-content.vue` *(+22/-0)*
- `packages/ui/src/components/swipe-actions/swipe-actions-item.vue` *(+97/-0)*
- `packages/ui/src/components/swipe-actions/swipe-actions-list.vue` *(+52/-0)*
- `packages/ui/src/components/swipe-actions/swipe-actions-root.vue` *(+643/-0)*
- `packages/ui/src/index.ts` *(+1/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 16 file(s) (+1070/-407)
- `packages/stage-ui/src/components/misc/swipe-actions.browser.test.ts` *(+137/-0)*
- `packages/stage-ui/src/components/misc/swipe-actions.story.vue` *(+57/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-dialog.browser.test.ts` *(+470/-11)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-drawer.browser.test.ts` *(+1/-0)*
- `packages/stage-ui/src/components/scenarios/chat/components/sessions-list.vue` *(+83/-70)*
- `packages/stage-ui/stories/setup.server.ts` *(+2/-1)*
- `server/apps/api/src/routes/stripe/checkout.test.ts` *(+71/-46)*
- `server/apps/api/src/routes/stripe/index.ts` *(+7/-10)*
- `server/apps/api/src/routes/stripe/operations/checkout.ts` *(+20/-38)*
- `server/apps/api/src/routes/stripe/operations/webhook.ts` *(+3/-3)*
- `server/apps/api/src/routes/stripe/price-catalog.test.ts` *(+88/-52)*
- `server/apps/api/src/routes/stripe/price-catalog.ts` *(+106/-65)*
- `server/apps/api/src/routes/stripe/route.test.ts` *(+17/-20)*
- `server/apps/api/src/routes/stripe/schema.ts` *(+5/-19)*
- `server/apps/api/src/services/adapters/config-kv/definitions.ts` *(+3/-32)*
- `server/apps/api/src/services/adapters/config-kv/index.test.ts` *(+0/-40)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (5)
- [#2540](https://github.com/moeru-ai/airi/pull/2540) `fix(stage-ui): apply Apple Speech locale in hearing settings` by **@nekomeowww** *(4 comments)*
- [#2538](https://github.com/moeru-ai/airi/pull/2538) `refactor(live2d): move live2d asset download to stage-ui-live2d` by **@drHuangMHT** *(6 comments)*
- [#2536](https://github.com/moeru-ai/airi/pull/2536) `feat(ui): add bidirectional swipe actions for conversations` by **@nekomeowww** *(21 comments)*
- [#2537](https://github.com/moeru-ai/airi/pull/2537) `add bilingual subtitles` by **@phx3334** *(17 comments)*
- [#2539](https://github.com/moeru-ai/airi/pull/2539) `feat(tamagotchi): pause stage if screen is locked or system is suspending` by **@drHuangMHT** *(3 comments)*

#### 🔄 PR Status & Lifecycle Changes (2)
- [#2522](https://github.com/moeru-ai/airi/pull/2522) `fix(stage-tamagotchi): keep controls island open on native Wayland` — `OPEN` ➔ `MERGED`, `Draft` ➔ `Ready`
- [#2533](https://github.com/moeru-ai/airi/pull/2533) `refactor(api): restore Stripe product catalog as Flux pack source` — `OPEN` ➔ `MERGED`, `Draft` ➔ `Ready`

#### 💬 Discussion Activity (12)
- [#2286](https://github.com/moeru-ai/airi/pull/2286) `fix(stage-ui): cancel animation frames and remove drag listeners on unmount` — *+5 comments (4 ➔ 9 total)*
- [#2525](https://github.com/moeru-ai/airi/pull/2525) `fix(stage-pages): load speech provider voices after configuration updates` — *+4 comments (19 ➔ 23 total)*
- [#2477](https://github.com/moeru-ai/airi/pull/2477) `feat(client): support Responses API with user-provided API keys` — *+5 comments (23 ➔ 28 total)*
- [#2530](https://github.com/moeru-ai/airi/pull/2530) `fix(stage-tamagotchi): remove obsolete mouse tracking IPC` — *+2 comments (0 ➔ 2 total)*
- [#2339](https://github.com/moeru-ai/airi/pull/2339) `feat(api): add Apple IAP payment channel backend` — *+8 comments (30 ➔ 38 total)*
- [#2522](https://github.com/moeru-ai/airi/pull/2522) `fix(stage-tamagotchi): keep controls island open on native Wayland` — *+2 comments (6 ➔ 8 total)*
- [#2473](https://github.com/moeru-ai/airi/pull/2473) `feat(auth): add native email change flow` — *+6 comments (3 ➔ 9 total)*
- [#2471](https://github.com/moeru-ai/airi/pull/2471) `feat(stage-ui): sync user providers to a cloud replica` — *+17 comments (35 ➔ 52 total)*
- [#2352](https://github.com/moeru-ai/airi/pull/2352) `fix(stage-ui-three): maintain vrm emotion weights and prevent morph conflicts` — *+1 comments (39 ➔ 40 total)*
- [#2435](https://github.com/moeru-ai/airi/pull/2435) `feat(stage-ui): add local FunASR transcription provider` — *+3 comments (184 ➔ 187 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+3 comments (86 ➔ 89 total)*
- [#2533](https://github.com/moeru-ai/airi/pull/2533) `refactor(api): restore Stripe product catalog as Flux pack source` — *+13 comments (7 ➔ 20 total)*

---
## [2026-09-12] Upstream Delta: `3fcae726..553d8a0d` (8 commits, 64 files, 19 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 8 commits (`3fcae726..553d8a0d`) concentrating on server payment CORE extraction (decoupling Stripe into multi-provider `payment_order` tables, PR #2335), native Google OAuth ID-token audience configuration (#2518), `core-agent` modularization by moving `spark-command` from `stage-ui` to `@proj-airi/core-agent` (#2528), co-locating provider inference tests (#2529), Service Worker navigation precaching for payment redirects in `stage-web` (#2531), and ADR placement standards in `ai/adr/` (#827b692, #41ee5ee).
* **Discussion & Community Buzz**:
  - 💬 **#2525: `fix(stage-pages): load speech provider voices after configuration updates` (19 comments)**: High initial velocity on converting reactive provider configurations to plain snapshots to reliably refresh voice catalogs across 6 speech providers (ElevenLabs, Volcengine, Deepgram, Alibaba Cloud, Player2, Kokoro).
  - 🔥 **#2352: `fix(stage-ui-three): maintain vrm emotion weights and prevent morph conflicts` (+10 new comments, total 39)**: Sustained community engagement resolving VRM blendshape decay, procedural blink clobbering eye expressions, and viseme/emotion arbitration.
  - ⚡ **#2519: `test(stage-tamagotchi): verify linux window rendering in CI` (+10 new comments, total 13, ➔ Draft)**: Discussion around headless Weston and Xvfb CI smoke testing for Linux desktop rendering.
  - 💬 **#2487: `feat(stage): add bilingual subtitles` (+1 new comment, total 74, closed)**: Discussion finalized and PR closed.
  - 💬 **#2121: `chore(i18n): update translations` (+4 new comments, total 86)**: Ongoing localization review.
  - 💬 **#2533: `refactor(api): restore Stripe product catalog as Flux pack source` (7 comments, Draft)**: Follow-up to payment core extraction.
* **Cherry-Pick Candidates**:
  - ✅ **PR #2530: `fix(stage-tamagotchi): remove obsolete mouse tracking IPC` (PORTED)**: Removed dead `await startTrackingCursorPoint()` call in `App.vue` and obsolete `electronStartTrackMousePosition` definition in `shared/eventa.ts`, unblocking desktop startup sequence.
  - ⭐ **PR #2525: `fix(stage-pages): load speech provider voices after configuration updates`**: Converts reactive provider configurations to plain snapshots before synchronized validation across speech providers (ElevenLabs, Deepgram, Volcengine, etc.), fixing voice loading stall/caching bugs on configuration changes.
  - 🔍 **PR #2522: `fix(stage-tamagotchi): keep controls island open on native Wayland`**: Fixes auto-collapse bug on native Wayland desktops by tracking DOM `pointerenter`/`pointerleave` events on the controls island alongside `screen.getCursorScreenPoint()`.
  - 🔍 **PR #2524: `feat(provider-inference): refresh Volcengine coding-plan models from endpoint`**: Adds dynamic `/models` endpoint refreshing for Volcengine with 5s timeout fallback to static list.
  - 🔍 **PR #2352: `fix(stage-ui-three): maintain vrm emotion weights and prevent morph conflicts`**: Holds VRM blendshape weights across steady-state frames and gates procedural blinking during active expressions.
* **Divergence / Collision Warnings**:
  - ⚠️ **`packages/stage-ui/src/stores/ai/chat-llm/tool-resolver.ts` & `packages/stage-ui/src/tools/character/`**: Commit `cf6ff23f7c` (#2528) removed spark tools from `stage-ui` into `core-agent`. In our fork, cognitive orchestration and tool resolution are architecturally divergent; do not bulk-import upstream `tool-resolver.ts` or upstream tool registrations.
  - ⚪ **`server/apps/api` & `server/apps/auth` (PR #2335, #2518)**: Upstream hosted backend services (Stripe/Flux payment orders, cloud OAuth ID tokens). Not used by local-first desktop fork; ignore.
  - ⚪ **`apps/stage-web/vite.config.ts` (PR #2531)** & `nix/assets-hash.txt` (#2532): Web service worker precache and Nix hash; low priority / ignore.

### 📋 Upstream Commits
- `553d8a0da4` feat(auth): accept configured native Google ID token audiences (#2518) [#2518](https://github.com/moeru-ai/airi/pull/2518) _(Lovehsigure_520, 2026-09-12)_
- `41ee5ee5c8` docs: place ADRs under ai/adr directories  _(RainbowBird, 2026-09-12)_
- `827b692b15` docs: keep ADRs in the main repository  _(RainbowBird, 2026-09-12)_
- `938c9d6b88` chore(nix): update assets hash (#2532) [#2532](https://github.com/moeru-ai/airi/pull/2532) _(Weathercold, 2026-09-12)_
- `1d27dc7cdf` fix(stage-web): cache canonical app shell for payment returns (#2531) [#2531](https://github.com/moeru-ai/airi/pull/2531) _(RainbowBird, 2026-09-12)_
- `37c837e502` refactor(api): extract payment CORE to support other payment providers [1/2] (#2335) [#2335](https://github.com/moeru-ai/airi/pull/2335) _(Lulu, 2026-09-12)_
- `e447b15b0d` refactor(provider-inference): move provider tests closer to implementations (#2529) [#2529](https://github.com/moeru-ai/airi/pull/2529) _(Garfield Lee, 2026-09-12)_
- `cf6ff23f7c` refactor(core-agent): move spark-command agent from stage-ui to core-agent (#2528) [#2528](https://github.com/moeru-ai/airi/pull/2528) _(Garfield Lee, 2026-09-12)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 4 file(s) (+44/-3)
- `AGENTS.md` *(+7/-0)*
- `server/AGENTS.md` *(+2/-3)*
- `server/apps/api/README.md` *(+9/-0)*
- `server/apps/auth/README.md` *(+26/-0)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 1 file(s) (+4/-0)
- `apps/stage-web/vite.config.ts` *(+4/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 53 file(s) (+6076/-2324)
- `nix/assets-hash.txt` *(+1/-1)*
- `packages/{stage-ui/src/tools/character/orchestrator/spark-command-shared.ts => core-agent/src/agents/spark-command/schema.ts}` *(+78/-17)*
- `packages/{stage-ui/src/tools/character/orchestrator/spark-command.test.ts => core-agent/src/agents/spark-command/tools.test.ts}` *(+2/-2)*
- `packages/{stage-ui/src/tools/character/orchestrator/spark-command.ts => core-agent/src/agents/spark-command/tools.ts}` *(+9/-1)*
- `packages/{stage-ui/src/tools/character/orchestrator/spark-notify.test.ts => core-agent/src/agents/spark-notify/tools.test.ts}` *(+2/-2)*
- `packages/{stage-ui/src/libs/providers/providers => provider-inference/src/providers/cloud}/azure-openai/index.test.ts` *(+3/-7)*
- `packages/{stage-ui/src/libs/providers/providers => provider-inference/src/providers/cloud}/openrouter-ai/index.test.ts` *(+6/-13)*
- `packages/stage-ui/src/stores/ai/chat-llm/tool-resolver.ts` *(+2/-1)*
- `packages/stage-ui/src/tools/character/index.ts` *(+0/-1)*
- `packages/stage-ui/src/tools/character/orchestrator/index.ts` *(+0/-3)*
- `packages/stage-ui/src/tools/character/orchestrator/spark-notify.ts` *(+0/-9)*
- `packages/stage-ui/src/tools/index.ts` *(+0/-1)*
- `server/apps/api/drizzle/0023_payment_order.sql` *(+113/-0)*
- `server/apps/api/drizzle/meta/0023_snapshot.json` *(+3795/-0)*
- `server/apps/api/drizzle/meta/_journal.json` *(+8/-1)*
- `server/apps/api/src/app.test.ts` *(+2/-1)*
- `server/apps/api/src/app.ts` *(+50/-35)*
- `server/apps/api/src/otel/index.ts` *(+0/-12)*
- `server/apps/api/src/routes/flux/route.test.ts` *(+0/-1)*
- `server/apps/api/src/routes/openai/v1/route.test.ts` *(+0/-3)*
- `server/apps/api/src/routes/stripe/checkout.test.ts` *(+292/-0)*
- `server/apps/api/src/routes/stripe/claim.ts` *(+49/-0)*
- `server/apps/api/src/routes/stripe/index.ts` *(+20/-97)*
- `server/apps/api/src/routes/stripe/operations/checkout.ts` *(+97/-106)*
- `server/apps/api/src/routes/stripe/operations/webhook.ts` *(+140/-296)*
- `server/apps/api/src/routes/stripe/payment-release.test.ts` *(+120/-0)*
- `server/apps/api/src/routes/stripe/price-catalog.test.ts` *(+78/-0)*
- `server/apps/api/src/routes/stripe/price-catalog.ts` *(+71/-126)*
- `server/apps/api/src/routes/stripe/route.test.ts` *(+164/-562)*
- `server/apps/api/src/routes/stripe/schema.ts` *(+19/-5)*
- `server/apps/api/src/schemas/flux.ts` *(+2/-0)*
- `server/apps/api/src/schemas/index.ts` *(+1/-0)*
- `server/apps/api/src/schemas/payment.ts` *(+55/-0)*
- `server/apps/api/src/schemas/stripe.ts` *(+13/-70)*
- `server/apps/api/src/services/adapters/config-kv/definitions.ts` *(+32/-3)*
- `server/apps/api/src/services/adapters/config-kv/index.test.ts` *(+43/-3)*
- `server/apps/api/src/services/domain/billing/billing-service.ts` *(+27/-160)*
- `server/apps/api/src/services/domain/billing/tests/billing-service.test.ts` *(+0/-78)*
- `server/apps/api/src/services/domain/flux.test.ts` *(+0/-7)*
- `server/apps/api/src/services/domain/flux.ts` *(+0/-15)*
- `server/apps/api/src/services/domain/payment/index.ts` *(+290/-0)*
- `server/apps/api/src/services/domain/payment/tests/payment.test.ts` *(+259/-0)*
- `server/apps/api/src/services/domain/payment/types.ts` *(+48/-0)*
- `server/apps/api/src/services/domain/stripe.test.ts` *(+0/-468)*
- `server/apps/api/src/services/domain/stripe.ts` *(+0/-212)*
- `server/apps/api/src/utils/format-price.ts` *(+20/-0)*
- `server/apps/api/src/utils/observability.ts` *(+0/-2)*
- `server/apps/auth/src/auth.ts` *(+2/-1)*
- `server/apps/auth/src/env.ts` *(+3/-0)*
- `server/apps/auth/src/google-client-ids.ts` *(+29/-0)*
- `server/apps/auth/src/social-authorization.ts` *(+7/-0)*
- `server/apps/auth/src/tests/google-client-ids.test.ts` *(+62/-0)*
- `server/apps/auth/src/tests/social-authorization.test.ts` *(+62/-2)*

#### Core Agent Runtime (`🔍 inspect`) — 3 file(s) (+22/-0)
- `packages/core-agent/package.json` *(+4/-0)*
- `packages/core-agent/src/agents/spark-command/index.ts` *(+17/-0)*
- `packages/core-agent/tsdown.config.ts` *(+1/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 2 file(s) (+4/-0)
- `packages/provider-inference/package.json` *(+1/-0)*
- `pnpm-lock.yaml` *(+3/-0)*

#### UI Primitives & Pages (`📦 import / inspect`) — 1 file(s) (+13/-13)
- `packages/stage-pages/src/pages/settings/flux.vue` *(+13/-13)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (10)
- [#2533](https://github.com/moeru-ai/airi/pull/2533) `refactor(api): restore Stripe product catalog as Flux pack source` by **@lulu0119** *(Draft)* *(7 comments)*
- [#2532](https://github.com/moeru-ai/airi/pull/2532) `chore(nix): update assets hash` by **@Weathercold** *(1 comments)*
- [#2531](https://github.com/moeru-ai/airi/pull/2531) `fix(stage-web): cache canonical app shell for payment returns` by **@luoling8192** *(2 comments)*
- [#2525](https://github.com/moeru-ai/airi/pull/2525) `fix(stage-pages): load speech provider voices after configuration updates` by **@0xSelenicDove** *(19 comments)*
- [#2530](https://github.com/moeru-ai/airi/pull/2530) `fix(stage-tamagotchi): remove obsolete mouse tracking IPC` by **@keeponlight** *(0 comments)*
- [#2522](https://github.com/moeru-ai/airi/pull/2522) `fix(stage-tamagotchi): keep controls island open on native Wayland` by **@gg582** *(Draft)* *(6 comments)*
- [#2526](https://github.com/moeru-ai/airi/pull/2526) `feat(provider-inference): add API Route provider` by **@DennyHo0917** *(3 comments)*
- [#2529](https://github.com/moeru-ai/airi/pull/2529) `refactor(provider-inference): move provider tests closer to implementations` by **@Garfield550** *(3 comments)*
- [#2528](https://github.com/moeru-ai/airi/pull/2528) `refactor(core-agent): move spark-command agent from stage-ui to core-agent` by **@Garfield550** *(3 comments)*
- [#2524](https://github.com/moeru-ai/airi/pull/2524) `feat(provider-inference): refresh Volcengine coding-plan models from endpoint` by **@Bruce-Yii** *(9 comments)*

#### 🔄 PR Status & Lifecycle Changes (4)
- [#2518](https://github.com/moeru-ai/airi/pull/2518) `feat(auth): accept configured native Google ID token audiences` — `OPEN` ➔ `MERGED`
- [#2335](https://github.com/moeru-ai/airi/pull/2335) `refactor(api): extract payment CORE to support other payment providers [1/2]` — `OPEN` ➔ `MERGED`
- [#2487](https://github.com/moeru-ai/airi/pull/2487) `feat(stage): add bilingual subtitles` — `OPEN` ➔ `CLOSED`
- [#2519](https://github.com/moeru-ai/airi/pull/2519) `test(stage-tamagotchi): verify linux window rendering in CI` — ➔ `Draft`

#### 💬 Discussion Activity (5)
- [#2335](https://github.com/moeru-ai/airi/pull/2335) `refactor(api): extract payment CORE to support other payment providers [1/2]` — *+3 comments (54 ➔ 57 total)*
- [#2352](https://github.com/moeru-ai/airi/pull/2352) `fix(stage-ui-three): maintain vrm emotion weights and prevent morph conflicts` — *+10 comments (29 ➔ 39 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+4 comments (82 ➔ 86 total)*
- [#2487](https://github.com/moeru-ai/airi/pull/2487) `feat(stage): add bilingual subtitles` — *+1 comments (73 ➔ 74 total)*
- [#2519](https://github.com/moeru-ai/airi/pull/2519) `test(stage-tamagotchi): verify linux window rendering in CI` — *+10 comments (3 ➔ 13 total)*

---
## [2026-09-11] Upstream Delta: `2904b795..3fcae726` (6 commits, 15 files, 19 PR update(s))

### 🎯 Executive Highlights
* **Upstream Focus**: Upstream merged 6 commits (`2904b795..3fcae726`) focusing on macOS Steam signing restoration (#2509), Live2D lip sync preservation during MAGIC motion (#2481), mobile chat input layout centering (#2517), Web FPS history visualization (#2516), setup guide alignment with pinned tooling (#2503), and automated Nix dependency hash updates (#2515).
* **Discussion & Community Buzz**:
  - 🔥 **#2506: `feat(plugin-host): import extensions and host kits` (+102 new comments, total 103)**: Major community and architectural deliberation as plugin host extensions moved from Draft to Ready.
  - ⚡ **#2487: `feat(stage): add bilingual subtitles` (+41 new comments, total 73)**: Strong discussion velocity evaluating bilingual dual-subtitle rendering for stage captioning.
  - 💬 **#2484: `feat(stage-ui): show Cloud announcements on Web and Electron` (+12 new comments, total 22)**: Cloud announcement banner delivery across web and desktop shells.
  - 💬 **#2121: `chore(i18n): update translations` (+4 new comments, total 82)**: Ongoing localization review.
  - 💬 **#2335: `refactor(api): extract payment CORE to support other payment providers [1/2]` (+2 new comments, total 54)**: Ongoing payment abstraction refactoring.
* **Cherry-Pick Candidates**:
  - ⭐ **PR #2481 (`fix(stage-ui-live2d): preserve lip sync during MAGIC motion`) [Commit `c30d169543`]**: High-value, surgical 1-line bug fix in `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue` swapping registration order so `useMotionUpdatePluginLipSync` executes after `useMotionUpdatePluginManualControl`, preventing MAGIC cues from clobbering lip sync mouth movement.
  - ⭐ **PR #2509 (`fix(stage-tamagotchi): restore macOS Steam signing`) [Commit `8928dca0b5`]**: Upgrades `electron-builder` to 26.16.1 with `minimumReleaseAgeExclude` configuration in `pnpm-workspace.yaml` to fix macOS code signing on modern GitHub runner environments.
  - 🔍 **PR #2517 (`fix(stage-layouts): center the mobile chat input`) [Commit `3fcae726c5`]**: Minor UI polish switching input bubble to `justify-center` in `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue`.
  - 🔍 **PR #2516 (`feat(stage-web): show FPS history in performance visualizer`) [Commit `69ca0a9171`]**: Self-contained SVG sparkline component `fps-history.vue` in devtools with accompanying i18n strings in `tamagotchi/settings.yaml`.
* **Divergence / Collision Warnings**:
  - ⚠️ **`apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts`**: Touched by #2517; our desktop shell uses custom chatbox/gesture implementations, so avoid bulk-merging desktop interactive area test suites.
  - ⚪ **`apps/stage-web/` (PR #2516)**: Low priority / ignored platform in fork.
  - ⚪ **`nix/pnpm-deps-hash.txt` (PR #2515)** & `docs/content/` (PR #2503): Platform-specific Nix hashing and upstream-only contributing docs; ignore.

### 📋 Upstream Commits
- `3fcae726c5` fix(stage-layouts): center the mobile chat input (#2517) [#2517](https://github.com/moeru-ai/airi/pull/2517) _(Neko, 2026-09-11)_
- `c30d169543` fix(stage-ui-live2d): preserve lip sync during MAGIC motion (#2481) [#2481](https://github.com/moeru-ai/airi/pull/2481) _(Arata, 2026-09-11)_
- `69ca0a9171` feat(stage-web): show FPS history in performance visualizer (#2516) [#2516](https://github.com/moeru-ai/airi/pull/2516) _(Neko, 2026-09-11)_
- `22b164bab0` chore(nix): update pnpmDeps hash (#2515) [#2515](https://github.com/moeru-ai/airi/pull/2515) _(Weathercold, 2026-09-10)_
- `ac3601c061` chore(CONTRIBUTING.md): align setup guides with pinned tooling (#2503) [#2503](https://github.com/moeru-ai/airi/pull/2503) _(bianyi, 2026-09-11)_
- `8928dca0b5` fix(stage-tamagotchi): restore macOS Steam signing (#2509) [#2509](https://github.com/moeru-ai/airi/pull/2509) _(Lovehsigure_520, 2026-09-11)_

### 🔬 Subsystem Breakdown
#### Electron Desktop Shell (`⚠️ hand-merge`) — 1 file(s) (+27/-3)
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.browser.test.ts` *(+27/-3)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 5 file(s) (+153/-0)
- `apps/stage-web/README.md` *(+17/-0)*
- `apps/stage-web/src/components/Devtools/PerformanceOverlay.vue` *(+10/-0)*
- `apps/stage-web/src/components/Devtools/fps-history.browser.test.ts` *(+48/-0)*
- `apps/stage-web/src/components/Devtools/fps-history.vue` *(+71/-0)*
- `apps/stage-web/src/pages/devtools/performance-visualizer.vue` *(+7/-0)*

#### Documentation & Scaffolding (`⚪ ignore`) — 2 file(s) (+54/-37)
- `docs/content/en/docs/contributing/index.md` *(+18/-5)*
- `docs/content/zh-Hans/docs/contributing/index.md` *(+36/-32)*

#### Other / Uncategorized (`🔍 inspect`) — 2 file(s) (+9/-2)
- `nix/pnpm-deps-hash.txt` *(+1/-1)*
- `pnpm-workspace.yaml` *(+8/-1)*

#### Localization (i18n) (`📦 import (additive only)`) — 2 file(s) (+18/-2)
- `packages/i18n/src/locales/en/tamagotchi/settings.yaml` *(+9/-1)*
- `packages/i18n/src/locales/zh-Hans/tamagotchi/settings.yaml` *(+9/-1)*

#### Stage Layouts & Shells (`🔍 inspect`) — 1 file(s) (+1/-1)
- `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` *(+1/-1)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 1 file(s) (+1/-1)
- `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue` *(+1/-1)*

#### Root Build & Tooling (`🔍 inspect`) — 1 file(s) (+42/-36)
- `pnpm-lock.yaml` *(+42/-36)*

### 📬 Upstream PR Radar
#### 🆕 New PRs Opened (6)
- [#2520](https://github.com/moeru-ai/airi/pull/2520) `fix(server): fence stale cache writes after invalidation` by **@luoling8192** *(7 comments)*
- [#2519](https://github.com/moeru-ai/airi/pull/2519) `test(stage-tamagotchi): verify linux window rendering in CI` by **@gg582** *(3 comments)*
- [#2518](https://github.com/moeru-ai/airi/pull/2518) `feat(auth): accept configured native Google ID token audiences` by **@Neko-233** *(7 comments)*
- [#2517](https://github.com/moeru-ai/airi/pull/2517) `fix(stage-layouts): center the mobile chat input` by **@nekomeowww** *(5 comments)*
- [#2516](https://github.com/moeru-ai/airi/pull/2516) `feat(stage-web): show FPS history in performance visualizer` by **@nekomeowww** *(4 comments)*
- [#2515](https://github.com/moeru-ai/airi/pull/2515) `chore(nix): update pnpmDeps hash` by **@Weathercold** *(1 comments)*

#### 🔄 PR Status & Lifecycle Changes (5)
- [#2506](https://github.com/moeru-ai/airi/pull/2506) `feat(plugin-host): import extensions and host kits` — `Draft` ➔ `Ready`
- [#2481](https://github.com/moeru-ai/airi/pull/2481) `fix(stage-ui-live2d): preserve lip sync during MAGIC motion` — `OPEN` ➔ `MERGED`
- [#2503](https://github.com/moeru-ai/airi/pull/2503) `docs(contributing): align setup guides with pinned tooling` — `OPEN` ➔ `MERGED`
- [#2509](https://github.com/moeru-ai/airi/pull/2509) `fix(stage-tamagotchi): restore macOS Steam signing` — `OPEN` ➔ `MERGED`
- [#2502](https://github.com/moeru-ai/airi/pull/2502) `test(stage-tamagotchi): cover Fade on Hover interaction recovery` — `OPEN` ➔ `CLOSED`

#### 💬 Discussion Activity (8)
- [#2335](https://github.com/moeru-ai/airi/pull/2335) `refactor(api): extract payment CORE to support other payment providers [1/2]` — *+2 comments (52 ➔ 54 total)*
- [#2487](https://github.com/moeru-ai/airi/pull/2487) `feat(stage): add bilingual subtitles` — *+41 comments (32 ➔ 73 total)*
- [#2506](https://github.com/moeru-ai/airi/pull/2506) `feat(plugin-host): import extensions and host kits` — *+102 comments (1 ➔ 103 total)*
- [#2299](https://github.com/moeru-ai/airi/pull/2299) `feat(providers): add Prompt API Provider` — *+2 comments (40 ➔ 42 total)*
- [#2484](https://github.com/moeru-ai/airi/pull/2484) `feat(stage-ui): show Cloud announcements on Web and Electron` — *+12 comments (10 ➔ 22 total)*
- [#2352](https://github.com/moeru-ai/airi/pull/2352) `fix(stage-ui-three): maintain vrm emotion weights and prevent morph conflicts` — *+2 comments (27 ➔ 29 total)*
- [#2121](https://github.com/moeru-ai/airi/pull/2121) `chore(i18n): update translations` — *+4 comments (78 ➔ 82 total)*
- [#2481](https://github.com/moeru-ai/airi/pull/2481) `fix(stage-ui-live2d): preserve lip sync during MAGIC motion` — *+1 comments (12 ➔ 13 total)*

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
