# AIRI Upstream Radar

> **Living Intelligence Ledger**: Tracks continuous delta from upstream (`moeru-ai/airi`) to inform selective, high-value forward-porting into `dasilva333/airi`.
> Generated and maintained by Antigravity Scheduled Tasks via `scripts/upstream-tracker.mjs`.
> Guided by: [`docs/project-selective-upstream-sync-protocol.md`](./project-selective-upstream-sync-protocol.md).

---

## 👁️ Active Upstream Watchlist (High-Interest Monitored PRs)

| PR | Title | Author | State | Priority / Rationale | Tracking Directives & Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [#2634](https://github.com/moeru-ai/airi/pull/2634) | `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain` | `@peachoolong-uwu` | `Draft` (0 comments) | 🔴 **High Alert** (Radical divergence) | Proposes external Cortico daemon (`ws://localhost:6122`) replacing native memory. **Directive**: Monitor maintainer reaction to 2-process requirement & Web/Mobile breakage. Hold off on comments until maintainers triage. |
| [#2550](https://github.com/moeru-ai/airi/pull/2550) | `feat(hearing): add bundled Sherpaw speech recognition` | `@luoling8192` | `Open` (17 comments) | 🟡 **Evaluation** (Offline STT) | Offline Sherpaw STT model packaging (Paraformer/Zipformer) via tsdown and Vite plugin. **Directive**: Monitor packaging structure for local speech pipeline. |
| [#2641](https://github.com/moeru-ai/airi/pull/2641) | `feat(stage-ui): show chat image analysis status` | `@luoling8192` | `Open` (1 comments) | 🟢 **Cherry-Pick Watch** (UI Polish) | Accessible live status indicator for text-only models undergoing vision analysis. **Directive**: Cherry-pick once merged upstream. |

---

<!-- RADAR_ENTRIES -->

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
