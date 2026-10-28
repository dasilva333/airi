# AIRI 7n1m4 Fork Radar

> **Living Intelligence Ledger**: Tracks continuous delta, PR activity, roadmap issues, and commits from the 7n1m4 sister fork (`7n1m4/airi`) to inform high-velocity cherry-picking and synchronization into `dasilva333/airi`.
> Generated and maintained by Antigravity Scheduled Tasks via `scripts/upstream-tracker.mjs --7n1m4`.

> [!CAUTION]
> ### CHERRY-PICK POLICY: STRICT BAN ON BLIND "VIBE-CODE" ADOPTION
> **7n1m4 operates via high-velocity agentic "vibe-coding" en masse with little-to-no actual real-world end-to-end testing.**
> - **Zero Blind Cherry-Picks**: NEVER blindly merge, adopt, or hoist features, providers, or scripts from `7n1m4/airi` solely because code or static unit test mocks compile.
> - **Mandatory Real-World Empirical Verification**: Every candidate cherry-pick MUST be manually verified and live-tested against actual network endpoints, real browser/desktop sessions, and user workflows before adoption into `dasilva333/airi`.
> - **Empirical Provenance (Case Study)**:
>   - **LanLan Free (`lanlan-free`)**: Looked plausible on paper and passed static mock tests, but live inference failed instantly with `{"error": "Invalid request: you are not using Lanlan. STOP ABUSE THE API."}` because the author copy-pasted endpoints from an external repo without testing live chat completions.
>   - **MiMo Free (`mimo`)**: Routing model `mimo-auto` failed with HTTP 400 (`Unsupported model mimo-auto`) due to upstream API sunset.
>   - **Kilo (`kilo-auto/free`)**: Verified live with sub-1300ms TTFT and retained alongside Pollinations as our genuine zero-setup free cloud options.
> - **Quarantine Speculative Architecture**: P2P mesh networking, WebRTC sidecars, and untested scripts must remain quarantined in design documents (`docs/phase-2b-mesh-and-nap-chat.md`) until proven solid.

---

<!-- RADAR_ENTRIES -->

## [2026-10-28] 7n1m4 Fork Delta: `59f1d77f..c516650a` (2 commits, 37 files, 4 update(s))

### 🚨 Action Required: Direct Mentions & Maintainer Inquiries
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6313736629)):
  > "Hey @dasilva333! On behalf of the team here at Anima Labs, thanks so much for the detailed write-up and the awesome shoutout! It’s great to see our roadmaps aligning so closely. To give a bit of context on our end: our core product vision for AnimaOS centers on strict local sovereignty—a puristic, z"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6382505252)):
  > "@dasilva333  — thank you for putting together such a comprehensive blueprint! Having reviewed it end-to-end, the proposed 4-layer inversion aligns perfectly with our architecture and integrates seamlessly into the components we have already deployed without any structural rework. ### Architecture Ma"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** **(Pending Reply)** ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6442783645)):
  > "Phase 6 PR 1 landed: ported `packages/stage-shared/src/peers.ts` (+12 tests) as the Universal Friends & Peers domain substrate. Transport-agnostic, sovereign-adapted (libp2p multiaddrs, no Cloudflare relay). PR: https://github.com/dasilva333/airi/pull/30. Next: reconciler (libp2p-based same-account "
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** **(Pending Reply)** ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6453934222)):
  > "## 2026-10-28 — feat/nap-chat-substrate-unify (PR #22) Opened PR #22 unifying fork nap-chat substrate onto upstream (dasilva333/airi) design to eliminate code silos. Shipped on branch `feat/nap-chat-substrate-unify` (commit b23152b4a):"

### 🎯 Executive Highlights
**Sister Fork Intelligence Briefing & Architectural Alignment**:

• **Actionable Maintainer Inquiry & Substrate Unification (@anlmabot ➔ @dasilva333)**:
  - **Phase 6 PR 1 Landed & Universal Friends Substrate**: @anlmabot confirmed landing Phase 6 PR 1, porting `packages/stage-shared/src/peers.ts` (+12 unit tests) into their fork as the transport-agnostic Universal Friends & Peers domain substrate (using libp2p multiaddrs without Cloudflare relays).
  - **Nap-Chat Substrate Unification (PR #22 / `8d4e39c70`)**: @anlmabot posted unacknowledged updates on Issue #1 announcing PR #22, which unifies 7n1m4's nap-chat substrate onto `dasilva333/airi`'s canonical architecture to eliminate code silos.

• **Executive Highlights**:
  - **Transport Boundary Contract Aligned (PR #23 / `c516650af`)**: 7n1m4 completed full alignment of their transport seam onto upstream `dasilva333/airi`'s `TransportAdapter` contract (`packages/stage-shared/src/transport.ts`). Canonical methods (`start`, `stop`, `sendToPeer`, `broadcast`, `subscribe`) are now shared across both codebases. Sovereignty invariants are preserved via optional capability fields (`capabilities`, `requiresExternalRelay` runtime gate in `transport-registry.ts`).
  - **Upstream UI & Messaging Surface Ported (`c516650af`)**: Ported upstream's `MessagingFriends.vue` (3,263 LOC), `embassy-inbox.ts`, `use-peer-embassy.ts`, and `cloudflare-edge-transport.ts`. To allow verbatim upstream UI code in sovereign AnimaOS builds without cloud dependencies, 7n1m4 introduced a graceful stub `stores/modules/cloudflare.ts` (`isAvailable = false`) that clearly signals "Cloudflare Edge unavailable in this build".
  - **Nap-Chat Substrate Convergence (`8d4e39c70`)**: Standardized fork nap-chat constants (`NAP_CHAT_DEFAULT_THRESHOLD_MIN`, `NAPCHAT_UNIVERSE_ID`), data structures (`NapTurn`, `NapEpisode`), and coordination helpers (`resolveNapIdleSec`, `selectCandidates`, `formatWelcomeBackRecap`). Added `napPeerId?` to `ChatSessionMeta` and clean conditional spread in `session-store.ts`.

• **Discussion Velocity**:
  - **Issue #17 (Cross-WAN Rendezvous)**: Massive discussion spike with +36 new comments (54 ➔ 90 total) driven by automated CI gossipsub mesh health checks across WAN dynamic tunnel relays.
  - **Issue #1 (Permanent Roadmap)**: +2 new comments (19 ➔ 21 total) with @anlmabot reporting progress on Phase 6 substrate landing and PR #22 unification.
  - **PR #22 & PR #23**: Both authored by Vi (@7n1m4) and @anlmabot, achieving rapid review and merge into `7n1m4/main` with zero friction.

• **Cherry-Pick Candidates**:
  - **TypeScript Strictness in `session-store.ts` (`8d4e39c70`)**: Replaces unsafe `(message as any).metadata` casts with strongly typed `message.metadata` in `packages/stage-ui/src/stores/chat/session-store.ts`. Low-risk, immediate cherry-pick.
  - **Fail-Closed `resolveNapIdleSec` Helper (`8d4e39c70`)**: Pure utility in `nap-chat.ts` ensuring absent presence telemetry defaults to user-present (preventing spurious autonomous runs).
  - **Pure `isUserAway` Predicate & Tests (`8d4e39c70`)**: Clean decoupled boolean logic in `packages/stage-ui/src/stores/proactivity-telemetry.ts` and corresponding tests.
  - *Evaluation against Cherry-Pick Policy*: The above candidates are clean utility/type refactors with unit test coverage. Transport adapter enhancements (`sendToPeer`/`broadcast` on libp2p) remain quarantined until empirical real-world mesh testing is conducted.

• **Collision Warnings**:
  - **Cloudflare Store Stub (`packages/stage-ui/src/stores/modules/cloudflare.ts`)**: 7n1m4 created a stub that disables Cloudflare Edge. **DO NOT** adopt this file into `dasilva333/airi`, which depends on the full 53KB Cloudflare Edge integration for embassy and vault sync.
  - **Transport Boundary (`packages/stage-shared/src/transport.ts`)**: Verify upstream's `transport.ts` maintains optionality for `capabilities` and `publish` to prevent breaking potential cross-fork backports.
  - **Session Store (`packages/stage-ui/src/stores/chat/session-store.ts`)**: Hand-merge `napPeerId` additions to avoid overwriting upstream window-broadcasting logic.

### 📋 7n1m4 Fork Commits
- `c516650af` feat(transport): align seam with upstream + port embassy-inbox/MessagingFriends (#23) [#23](https://github.com/7n1m4/airi/pull/23) _(ヴィオレット, 2026-10-28)_
- `8d4e39c70` feat(stage-ui): unify nap-chat substrate onto upstream design (#22) [#22](https://github.com/7n1m4/airi/pull/22) _(ヴィオレット, 2026-10-28)_

### 🔬 Subsystem Breakdown
#### Electron Desktop Shell (`⚠️ hand-merge`) — 5 file(s) (+88/-43)
- `apps/stage-tamagotchi/src/main/services/airi/agentic/companion.ts` *(+4/-2)*
- `apps/stage-tamagotchi/src/main/services/airi/libp2p/transport-adapter.test.ts` *(+11/-16)*
- `apps/stage-tamagotchi/src/main/services/airi/libp2p/transport-adapter.ts` *(+58/-20)*
- `apps/stage-tamagotchi/src/main/services/airi/transport-registry.test.ts` *(+7/-2)*
- `apps/stage-tamagotchi/src/main/services/airi/transport-registry.ts` *(+8/-3)*

#### Documentation & Scaffolding (`⚪ ignore`) — 3 file(s) (+81/-4)
- `docs/data-catalog.md` *(+50/-1)*
- `docs/project-testing-parity.md` *(+11/-0)*
- `docs/rosetta-stone.md` *(+20/-3)*

#### Localization (i18n) (`📦 import (additive only)`) — 1 file(s) (+4/-0)
- `packages/i18n/src/locales/en/settings.yaml` *(+4/-0)*

#### UI Primitives & Pages (`📦 import / inspect`) — 2 file(s) (+24/-4)
- `packages/stage-pages/src/pages/settings/components/SettingsQuickAccess.vue` *(+7/-4)*
- `packages/stage-pages/src/pages/settings/modules/messaging-friends.vue` *(+17/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 1 file(s) (+1/-0)
- `packages/stage-shared/package.json` *(+1/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 22 file(s) (+5822/-93)
- `packages/stage-shared/src/index.ts` *(+1/-0)*
- `packages/stage-shared/src/transport-adapter.test.ts` *(+18/-24)*
- `packages/stage-shared/src/transport-adapter.ts` *(+4/-67)*
- `packages/stage-shared/src/transport.ts` *(+113/-0)*
- `packages/stage-ui/src/components/modules/MessagingFriends.vue` *(+3263/-0)*
- `packages/stage-ui/src/components/modules/index.ts` *(+1/-0)*
- `packages/stage-ui/src/composables/use-modules-list.ts` *(+9/-0)*
- `packages/stage-ui/src/composables/use-peer-embassy.test.ts` *(+196/-0)*
- `packages/stage-ui/src/composables/use-peer-embassy.ts` *(+364/-0)*
- `packages/stage-ui/src/constants/settings-catalog.ts` *(+15/-0)*
- `packages/stage-ui/src/libs/transport/cloudflare-edge-transport.test.ts` *(+69/-0)*
- `packages/stage-ui/src/libs/transport/cloudflare-edge-transport.ts` *(+128/-0)*
- `packages/stage-ui/src/libs/transport/embassy-socket.test.ts` *(+107/-0)*
- `packages/stage-ui/src/libs/transport/embassy-socket.ts` *(+170/-0)*
- `packages/stage-ui/src/stores/embassy-inbox.test.ts` *(+401/-0)*
- `packages/stage-ui/src/stores/embassy-inbox.ts` *(+417/-0)*
- `packages/stage-ui/src/stores/modules/cloudflare.ts` *(+41/-0)*
- `packages/stage-ui/src/stores/nap-chat-coordinator.test.ts` *(+158/-0)*
- `packages/stage-ui/src/stores/nap-chat-coordinator.ts` *(+223/-0)*
- `packages/stage-ui/src/stores/nap-chat.ts` *(+116/-1)*
- `packages/stage-ui/src/types/chat-session.ts` *(+7/-0)*
- `packages/stage-ui/src/types/chat.ts` *(+1/-1)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 1 file(s) (+6/-5)
- `packages/stage-ui/src/stores/chat/session-store.ts` *(+6/-5)*

#### Telemetry & Analytics (`⚪ ignore / rejected in fork`) — 2 file(s) (+31/-0)
- `packages/stage-ui/src/stores/proactivity-telemetry.test.ts` *(+19/-0)*
- `packages/stage-ui/src/stores/proactivity-telemetry.ts` *(+12/-0)*

### 📬 7n1m4 Fork Activity Radar
#### 🆕 New Items Opened (2)
- [PR] [#23](https://github.com/anlmalabs/airi/pull/23) `feat(transport): align seam with upstream + port embassy-inbox/MessagingFriends` by **@7n1m4** *(0 comments)*
- [PR] [#22](https://github.com/anlmalabs/airi/pull/22) `feat(stage-ui): unify nap-chat substrate onto upstream design` by **@7n1m4** *(0 comments)*

#### 💬 Discussion Activity (2)
- [Issue] [#17](https://github.com/anlmalabs/airi/issues/17) `[CI] Cross-WAN rendezvous (auto-managed, do not close)` — *+36 comments (54 ➔ 90 total)*
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — *+2 comments (19 ➔ 21 total)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/anlmalabs/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/anlmalabs/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/anlmalabs/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` [OPEN] — 🚨 **+2 comments** (21 total)
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/anlmalabs/airi/issues/4) `Phase 3: Agentic OS Integration` [CLOSED] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
## [2026-10-27] 7n1m4 Fork Delta: `52f99542..59f1d77f` (3 commits, 20 files, 3 update(s))

### 🚨 Action Required: Direct Mentions & Maintainer Inquiries
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6313736629)):
  > "Hey @dasilva333! On behalf of the team here at Anima Labs, thanks so much for the detailed write-up and the awesome shoutout! It’s great to see our roadmaps aligning so closely. To give a bit of context on our end: our core product vision for AnimaOS centers on strict local sovereignty—a puristic, z"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6382505252)):
  > "@dasilva333  — thank you for putting together such a comprehensive blueprint! Having reviewed it end-to-end, the proposed 4-layer inversion aligns perfectly with our architecture and integrates seamlessly into the components we have already deployed without any structural rework. ### Architecture Ma"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** **(Pending Reply)** ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6442783645)):
  > "Phase 6 PR 1 landed: ported `packages/stage-shared/src/peers.ts` (+12 tests) as the Universal Friends & Peers domain substrate. Transport-agnostic, sovereign-adapted (libp2p multiaddrs, no Cloudflare relay). PR: https://github.com/dasilva333/airi/pull/30. Next: reconciler (libp2p-based same-account "

### 🎯 Executive Highlights
**Sister Fork Intelligence Briefing & Architectural Alignment**:

• **Actionable Maintainer Inquiry & Phase 6 Rollout (@anlmabot ➔ @dasilva333)**:
  - **Phase 6 PR 1 Landed**: @anlmabot confirmed landing Phase 6 PR 1 by porting `packages/stage-shared/src/peers.ts` (+12 unit tests) into their fork as the sovereign, transport-agnostic Universal Friends & Peers substrate (`endpoints.cloudflareWorkerUrl` omitted; routing via libp2p multiaddrs).
  - **Accidental Broad PR #30 Closed**: 7n1m4 opened PR #30 on `dasilva333/airi` with the substrate port, but accidentally included fork commit history (+48k lines); @7n1m4 promptly closed it to re-open a lean branch off `upstream/main`. Next milestone on their roadmap: libp2p same-account discovery reconciler.

• **Executive Highlights**:
  - **Phase 6 PR 2 Merged (PR #21 / `8f7526e85`)**: 7n1m4 merged `feat(stage-ui): adopt peers repo + store`, porting our character-scoped IndexedDB repository (`peers.repo.ts`) and Pinia store (`stores/peers.ts`). Sovereign-adapted by eliminating Cloudflare Edge vault synchronization (`toVaultDeviceMapForSync` and `mergeVaultDevices`) in favor of purely local storage and direct peer pairing.
  - **Agent Client Protocol (ACP) Agent Support Shipped (`79137a833`)**: Added full-stack ACP integration enabling AIRI companion personas to summon and control external CLI/coding agent binaries (e.g., Claude Code, OpenCode) as tools:
    - *Main Service*: `acp-agents/index.ts` leverages `@agentclientprotocol/sdk` (v2.0.2 catalog entry) to manage spawned child processes over ndJsonStream stdio streams, session tracking, and permission policies (`prompt`, `auto-read`, `auto-all`).
    - *Multi-Window Eventa Bridge*: Dispatches lifecycle, session updates, and permission prompts across main, chat, settings, and widget windows via `eventa:invoke:electron:acp:*` and `eventa:event:electron:acp:*`.
    - *Builtin Tools*: Registered `acp_list_agents`, `acp_create_session`, `acp_prompt`, `acp_cancel`, and `acp_list_sessions` in `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/acp.ts`.
  - **WAN Mesh Activity & CI Verification**: Issue #17 automated rendezvous recorded +27 additional gossipsub transactions across dynamic tunnel relays without disconnections.

• **Discussion Velocity**:
  - **Issue #1 (Permanent Roadmap)**: +2 new comments (17 ➔ 19 total), including @anlmabot's announcement of Phase 6 PR 1 substrate landing.
  - **PR #21 (Phase 6 PR 2)**: Opened and merged into `7n1m4/main` by Vi within 1 hour.
  - **Issue #17 (Cross-WAN Rendezvous)**: +27 new automated journal comments (27 ➔ 54 total) documenting WAN gossipsub mesh health.

• **Cherry-Pick Candidates**:
  - **ACP Agent Integration Architecture (`79137a833`)**: Exceptional modular tool suite. The ACP service (`acp-agents/index.ts`), Eventa RPC bindings in `shared/eventa.ts`, and renderer tool definitions (`acp.ts`) are clean and decoupled. Enables AIRI characters to orchestrate external coding agents natively.
    - *Evaluation against Cherry-Pick Policy*: Requires empirical verification with an actual ACP binary/agent before merging to verify stdin/stdout ndJsonStream framing and session lifecycles under Electron on macOS/Linux/Windows.
  - **TypeScript Strictness Improvements (`8f7526e85`)**:
    - `packages/stage-ui/src/stores/peers.ts`: Replaces `(window as any).electron` with typed check `(window as { electron?: unknown }).electron` and `(p as any).machineId` with `(p as SameAccountDevice).machineId`. Clean, immediate low-risk pick.

• **Collision Warnings**:
  - **Electron Main Injection (`apps/stage-tamagotchi/src/main/index.ts`)**: Injects `acpAgentsManager` across all Electron window providers and app readiness handlers. Merge will conflict with local window customizations in `main/index.ts`.
  - **Builtin Tools Index (`apps/stage-tamagotchi/src/renderer/stores/tools/builtin/index.ts`)**: Checks `hasAcpAgents` dynamically; merge carefully against our local tool registry.
  - **Shared Eventa Definitions (`apps/stage-tamagotchi/src/shared/eventa.ts`)**: 7n1m4's commit stripped Cloudflare Edge Vault and Cloud Relay RPCs during their local-only refactor. We MUST retain our Cloudflare / Edge definitions while incorporating the ACP definitions.
  - **Pinia Peers Store (`packages/stage-ui/src/stores/peers.ts`)**: 7n1m4 dropped `toVaultDeviceMapForSync` and `mergeVaultDevices`. Our fork relies on Cloudflare Edge Vault for cross-device synchronization; do NOT overwrite our sync methods when backporting changes from 7n1m4.

### 📋 7n1m4 Fork Commits
- `59f1d77ff` Merge remote-tracking branch 'origin/main'  _(vi, 2026-10-27)_
- `8f7526e85` feat(stage-ui): adopt peers repo + store (Phase 6 PR 2) (#21) [#21](https://github.com/7n1m4/airi/pull/21) _(ヴィオレット, 2026-10-27)_
- `79137a833` feat(acp): add ACP agent support (main + rpc + builtin tool)  _(vi, 2026-10-27)_

### 🔬 Subsystem Breakdown
#### Other / Uncategorized (`🔍 inspect`) — 7 file(s) (+472/-0)
- `.gitignore` *(+3/-0)*
- `packages/stage-shared/src/index.ts` *(+1/-0)*
- `packages/stage-shared/src/peers.test.ts` *(+85/-0)*
- `packages/stage-shared/src/peers.ts` *(+184/-0)*
- `packages/stage-ui/src/database/repos/peers.repo.ts` *(+17/-0)*
- `packages/stage-ui/src/stores/peers.ts` *(+181/-0)*
- `pnpm-workspace.yaml` *(+1/-0)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 12 file(s) (+627/-4)
- `apps/stage-tamagotchi/package.json` *(+1/-0)*
- `apps/stage-tamagotchi/src/main/index.ts` *(+9/-4)*
- `apps/stage-tamagotchi/src/main/services/airi/acp-agents/index.ts` *(+429/-0)*
- `apps/stage-tamagotchi/src/main/windows/chat/index.ts` *(+3/-0)*
- `apps/stage-tamagotchi/src/main/windows/chat/rpc/index.electron.ts` *(+4/-0)*
- `apps/stage-tamagotchi/src/main/windows/main/index.ts` *(+3/-0)*
- `apps/stage-tamagotchi/src/main/windows/main/rpc/index.electron.ts` *(+4/-0)*
- `apps/stage-tamagotchi/src/main/windows/settings/index.ts` *(+3/-0)*
- `apps/stage-tamagotchi/src/main/windows/settings/rpc/index.electron.ts` *(+4/-0)*
- `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/acp.ts` *(+79/-0)*
- `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/index.ts` *(+19/-0)*
- `apps/stage-tamagotchi/src/shared/eventa.ts` *(+69/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 1 file(s) (+47/-26)
- `pnpm-lock.yaml` *(+47/-26)*

### 📬 7n1m4 Fork Activity Radar
#### 🆕 New Items Opened (1)
- [PR] [#21](https://github.com/anlmalabs/airi/pull/21) `feat(stage-ui): adopt peers repo + store (Phase 6 PR 2)` by **@7n1m4** *(0 comments)*

#### 💬 Discussion Activity (2)
- [Issue] [#17](https://github.com/anlmalabs/airi/issues/17) `[CI] Cross-WAN rendezvous (auto-managed, do not close)` — *+27 comments (27 ➔ 54 total)*
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — *+2 comments (17 ➔ 19 total)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/anlmalabs/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/anlmalabs/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/anlmalabs/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` [OPEN] — 🚨 **+2 comments** (19 total)
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/anlmalabs/airi/issues/4) `Phase 3: Agentic OS Integration` [CLOSED] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
## [2026-10-25] 7n1m4 Fork Activity: `52f99542` (1 update(s))

### 🚨 Action Required: Direct Mentions & Maintainer Inquiries
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6313736629)):
  > "Hey @dasilva333! On behalf of the team here at Anima Labs, thanks so much for the detailed write-up and the awesome shoutout! It’s great to see our roadmaps aligning so closely. To give a bit of context on our end: our core product vision for AnimaOS centers on strict local sovereignty—a puristic, z"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6382505252)):
  > "@dasilva333  — thank you for putting together such a comprehensive blueprint! Having reviewed it end-to-end, the proposed 4-layer inversion aligns perfectly with our architecture and integrates seamlessly into the components we have already deployed without any structural rework. ### Architecture Ma"
  - **Our Response**: [Issue #1 Comment #6386372201](https://github.com/anlmalabs/airi/issues/1#issuecomment-6386372201) — Accepted PR #11 `TransportAdapter` seam as canonical contract; endorsed peer record as source of truth with transport boundary as enforcer; approved Phase 6 roadmap (`peers.ts` port to IndexedDB).

### 🎯 Executive Highlights
**Sister Fork Intelligence Briefing & Architectural Alignment**:

• **Executive Highlights**:
  - **Commit Baseline Stationary**: `7n1m4/main` remains unchanged at `52f99542` with 0 new commits since the last snapshot.
  - **Seam Contract Consensus Formalized (@dasilva333 ➔ @7n1m4)**: Response posted on Issue #1 ([Comment #6386372201](https://github.com/anlmalabs/airi/issues/1#issuecomment-6386372201)) ratifying 7n1m4's PR #11 `TransportAdapter` seam (`id`, `capabilities`, `initialize`/`dispose`, `publish`, `subscribe`) as canonical in `packages/stage-shared`. `dasilva333/airi` will align `transport.ts` (including loopback and Cloudflare Edge embassy drivers) to conform to this interface.
  - **Capability Gating Architecture Resolved**: Agreed on a clean hybrid separation of concerns: User intent / policy (`canNapChat`, `canShareMemories`, `canStreamSensory`) resides on the `ExternalFriend` peer record (source of truth), while transport-level sovereignty (`requiresExternalRelay`, pairing trust) enforces gating at the delivery boundary.
  - **Phase 6 Universal Friends & Peers Greenlit**: 7n1m4 is cleared to begin the phased rollout of `peers.ts` types into `stage-shared`, backed by local character-scoped IndexedDB in `stage-tamagotchi` and libp2p multiaddr routing (mDNS + signed peer records) to preserve strict data sovereignty.

• **Discussion Velocity**:
  - **Issue #1 (Permanent Roadmap)**: +1 new comment (16 ➔ 17 total) containing @dasilva333's comprehensive alignment response to Vi (@7n1m4).
  - All PRs (#20, #15, #14, #13, #12, #11, #8, #7, #6, #5) and rendezvous logs remain stable with zero new status transitions.

• **Cherry-Pick Candidates**:
  - **None in this cycle**: 0 new commits since `52f99542`.
  - **Prior Pipeline Standing**: `e867a6679` (Google STUN removal from WebRTC) and `scripts/cross-wan-node.mjs` lower-Peer-ID dialer constraint remain reference-ready; third-party runner tunnels remain quarantined per strict empirical testing policy.

• **Collision Warnings**:
  - **Zero file collisions**: No code changes on either branch in this interval.
  - **Upcoming Horizon**: Watch for Phase 6 PRs from 7n1m4 introducing `packages/stage-shared/src/peers.ts` to ensure compatibility with our existing offline-first storage and Edge transport adapters.

### 📬 7n1m4 Fork Activity Radar
#### 💬 Discussion Activity (1)
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — *+1 comments (16 ➔ 17 total)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/anlmalabs/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/anlmalabs/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/anlmalabs/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` [OPEN] — 🚨 **+1 comments** (17 total)
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/anlmalabs/airi/issues/4) `Phase 3: Agentic OS Integration` [CLOSED] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
## [2026-10-24] 7n1m4 Fork Delta: `904120f8..52f99542` (2 commits, 5 files, 3 update(s))

### 🚨 Action Required: Direct Mentions & Maintainer Inquiries
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6313736629)):
  > "Hey @dasilva333! On behalf of the team here at Anima Labs, thanks so much for the detailed write-up and the awesome shoutout! It’s great to see our roadmaps aligning so closely. To give a bit of context on our end: our core product vision for AnimaOS centers on strict local sovereignty—a puristic, z"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Replied & Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6382505252)):
  > "@dasilva333  — thank you for putting together such a comprehensive blueprint! Having reviewed it end-to-end, the proposed 4-layer inversion aligns perfectly with our architecture and integrates seamlessly into the components we have already deployed without any structural rework. ### Architecture Ma"
  - **Our Response**: [Issue #1 Comment #6386372201](https://github.com/anlmalabs/airi/issues/1#issuecomment-6386372201) — Accepted PR #11 `TransportAdapter` seam as canonical contract; endorsed peer record as source of truth with transport boundary as enforcer; approved Phase 6 roadmap (`peers.ts` port to IndexedDB).

### 🎯 Executive Highlights
**Sister Fork Intelligence Briefing & Architectural Alignment**:

• **Actionable Maintainer Inquiry & 4-Layer Architectural Convergence (@dasilva333)**:
  - **Full Blueprint Endorsement**: Vi (@7n1m4) reviewed @dasilva333's 4-layer inversion blueprint (`docs/phase-2b-mesh-and-nap-chat.md`) end-to-end, confirming that it maps cleanly to their deployed stack without structural rework.
  - **Phase 6 Universal Friends & Peers Plan**: 7n1m4 proposed Phase 6 to port `packages/stage-shared/src/peers.ts` domain types (`BasePeer`, `SameAccountDevice`, `ExternalFriend`, `FriendRequest`, `AmbassadorCard`) into their stack, backed by an IndexedDB repository in `stage-tamagotchi` (honoring local sovereignty). Transport routing will leave `endpoints.cloudflareWorkerUrl` unset and route through libp2p multiaddrs (mDNS + signed peer records), re-hosting nap-chat on the new peers roster.
  - **Contract Reconciliation & Open Question**: 7n1m4 proposed adopting their deployed `TransportAdapter` seam (PR #11/#12) as the canonical interface in `stage-shared` and refactoring `transport.ts` (including loopback) as a conforming driver. They raised an open design question for @dasilva333: should capability gating (`canNapChat`, `canShareMemories`, `canStreamSensory`) reside directly on the `ExternalFriend` peer record (dasilva333 model) or at the transport boundary (7n1m4 sovereign gate)? Vi leans toward peer record as source of truth and transport as enforcer.

• **Executive Highlights**:
  - **Cross-WAN P2P Tunnel Mesh Shipped (PR #20)**: Replaced failed WebRTC/STUN hole-punching against Azure symmetric NAT on GitHub-hosted runners with an automated 3-node libp2p mesh (`scripts/cross-wan-node.mjs`, `.github/workflows/ci-cross-wan-p2p.yml`). Nodes establish outbound connections via anonymous quick tunnels (`cloudflared`, `pinggy`, `localhost.run`) and coordinate public multiaddrs via GitHub Issue #17 rendezvous ledger.
  - **STUN Reversion to Preserve Local Sovereignty**: Removed Google STUN servers (`stun.l.google.com:19302`) from WebRTC in `apps/stage-tamagotchi/src/main/services/airi/libp2p/index.ts`, confirming that external STUN is ineffective against symmetric NAT and unneeded for local sovereign operation.
  - **CI Quota Preservation**: Migrated heavy monorepo verification (`.github/workflows/ci.yml`) to a daily schedule (`0 3 * * *`) instead of triggering on every commit/PR.

• **Discussion Velocity**:
  - **Issue #1 (Permanent Roadmap)**: 1 new critical architectural comment from Vi (@7n1m4) addressed to @dasilva333 detailing the Phase 6 convergence roadmap and capability gating question.
  - **Issue #17 (Cross-WAN Rendezvous)**: +18 new automated journal comments (27 total) tracking 3-runner multiaddr registrations and gossipsub ping/pong exchanges.
  - **PR #20**: Successfully transitioned from `OPEN` ➔ `MERGED`.

• **Cherry-Pick Candidates**:
  - `e867a6679` (PR #20 diff in `apps/stage-tamagotchi/src/main/services/airi/libp2p/index.ts`): Revert of Google STUN configuration in `webRTC()`. Matches our offline-first sovereign stance; safe to keep in sync.
  - **Gossipsub Tie-Breaking Logic**: The symmetric lower-Peer-ID dialer constraint in `scripts/cross-wan-node.mjs` prevents dual-dial race conditions that orphan gossipsub publish streams in libp2p. High-value pattern for P2P connection management.
  - *(Quarantine per Cherry-Pick Policy)*: `scripts/cross-wan-node.mjs` and `.github/workflows/ci-cross-wan-p2p.yml` rely on ephemeral third-party tunnel providers (`*.trycloudflare.com`, `*.pinggy.net`, `*.lhr.life`); keep quarantined from production build.

• **Collision Warnings**:
  - `apps/stage-tamagotchi/src/main/services/airi/libp2p/index.ts`: Touched (-14 lines) to revert STUN. Clean diff with zero conflicts against our local changes.
  - `packages/stage-shared/src/transport.ts`: Discrepancy between dasilva333's `TransportAdapter` interface and 7n1m4's PR #11/#12 contract requires resolution before executing Phase 6 `peers.ts` port.

### 📋 7n1m4 Fork Commits
- `52f99542a` ci: run monorepo verification on a daily schedule instead of every commit/PR  _(7n1m4, 2026-10-24)_
- `e867a6679` feat(cross-wan): stand up a three-runner libp2p mesh across the WAN (#20) [#20](https://github.com/7n1m4/airi/pull/20) _(anlmabot[bot], 2026-10-24)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 3 file(s) (+116/-42)
- `.github/workflows/ci-cross-wan-p2p.yml` *(+106/-40)*
- `.github/workflows/ci.yml` *(+4/-2)*
- `README.md` *(+6/-0)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 1 file(s) (+1/-15)
- `apps/stage-tamagotchi/src/main/services/airi/libp2p/index.ts` *(+1/-15)*

#### Root Build & Tooling (`🔍 inspect`) — 1 file(s) (+546/-0)
- `scripts/cross-wan-node.mjs` *(+546/-0)*

### 📬 7n1m4 Fork Activity Radar
#### 🔄 Status & Lifecycle Changes (1)
- [PR] [#20](https://github.com/anlmalabs/airi/pull/20) `feat(cross-wan): stand up a three-runner libp2p mesh across the WAN` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (2)
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — *+1 comments (15 ➔ 16 total)*
- [Issue] [#17](https://github.com/anlmalabs/airi/issues/17) `[CI] Cross-WAN rendezvous (auto-managed, do not close)` — *+18 comments (9 ➔ 27 total)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/anlmalabs/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/anlmalabs/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/anlmalabs/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` [OPEN] — 🚨 **+1 comments** (16 total)
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/anlmalabs/airi/issues/4) `Phase 3: Agentic OS Integration` [CLOSED] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
## [2026-10-21] 7n1m4 Fork Delta: `cf090ed5..904120f8` (10 commits, 40 files, 15 update(s))

### 🚨 Action Required: Direct Mentions & Maintainer Inquiries
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p Local Mesh → Agentic OS integration` — Comment by **@7n1m4** *(Replied & Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6313736629)):
  > "Hey @dasilva333! ... Anima Labs fully endorses your proposed TransportAdapter interface. Decoupling transport capabilities into a pluggable boundary is an elegant fix for cross-fork divergence... Quick question: Are you interested in receiving just the modular transport interface and libp2p stack, or would you also welcome a PR with our complete, repo-wide TDD test harness once it's finalized?"
  - **Our Response**: [Issue #1 Comment #6320885159](https://github.com/anlmalabs/airi/issues/1#issuecomment-6320885159) — Accepted full stack (PR #11 + PR #12 + repo-wide TDD/CI harness) and linked to [`docs/phase-2b-mesh-and-nap-chat.md`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/phase-2b-mesh-and-nap-chat.md).

### 🎯 Executive Highlights
**Sister Fork Intelligence Briefing & Cherry-Pick Provenance**:

• **Actionable Response & Upstream Alignment (@dasilva333)**:
  - **Transport Boundary Consensus**: Vi (@7n1m4) and Anima Labs formally endorsed @dasilva333's `TransportAdapter` interface RFC (`dasilva333/airi#28`), recognizing it as the architectural bridge preventing cross-fork silos while preserving AnimaOS's zero-dependency local sovereignty.
  - **Full Stack Acceptance (PR #11 & PR #12 ACCEPT)**: dasilva333/airi accepts PR #11 (`stage-shared` seam contract) and PR #12 (`stage-tamagotchi` registry/libp2p factory), and welcomes the complete stack including repo-wide TDD & cross-WAN CI testing.
  - **Advanced Specification Alignment**: Point 7n1m4 to our authoritative architecture blueprint [`docs/phase-2b-mesh-and-nap-chat.md`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/phase-2b-mesh-and-nap-chat.md) demonstrating how we've inverted companion socialization (Friends & Peers domain substrate, same-account zero-setup discovery, Cloudflare Edge embassies + libp2p LAN driver, and decoupled nap-chat interaction protocols). The transport layer is already completed locally.

• **Executive Highlights**:
  - **Pluggable Transport Seam Contract (Phase 4)**: 7n1m4 landed PR #11 (`stage-shared`) and PR #12 (`stage-tamagotchi`), establishing the `TransportAdapter` interface and registry based on @dasilva333's RFC (`dasilva333/airi#28`). Refactored companion share publishing in `companion.ts` to route over the `TransportAdapter` seam (PR #13) rather than directly calling libp2p.
  - **Cross-WAN P2P Tunnel Mesh (Phase 5)**: Pivoting away from WebRTC/STUN alone (which failed on Azure symmetric NAT in GitHub-hosted runners), 7n1m4 implemented an automated 3-node WAN mesh (PR #20) utilizing public quick-tunnels (`cloudflared`, `pinggy`, `localhost.run`) and GitHub Issue #17 as a rendezvous ledger. Added public Google STUN to WebRTC transport in `stage-tamagotchi/libp2p` (PR #15).
  - **Phase Progression**: Closed Phase 2 (`libp2p Local Mesh Foundation`, Issue #3) and Phase 3 (`Agentic OS Integration`, Issue #4).

• **Discussion Velocity**:
  - **Maintainer Interaction on Issue #1**: Vi (@7n1m4) replied directly to @dasilva333 inquiring whether we welcome the modular transport PR alone or the full stack + TDD test harness.
  - **Comment Spike on Issue #19 (`scratch: cross-wan tunnel validation`)**: 121 automated test logs and coordination comments generated by anlmabot during cross-WAN multi-backend tunnel testing, subsequently closed and stabilized into Issue #17 (9 comments).
  - **Roadmap Issue #1**: +12 new comments (14 total) discussing Phase 4 transport seam architecture, gossipsub single-stream collision prevention, and cross-WAN runner mesh coordination.
  - **PR Lifecycle**: Merged PRs #11, #12, #13, #15; opened PR #20 with green CI across three hosted runner nodes.

• **Cherry-Pick Candidates**:
  - `b2438943e` (PR #11): `feat(stage-shared): add TransportAdapter seam contract + registry interface (Phase 4)` — **ACCEPTED FOR IMPORT**. Clean types-only interface contract in `packages/stage-shared` with 5 passing unit tests. Standardizes transport boundaries in `dasilva333/airi`.
  - `c99b829a9` (PR #12): `feat(stage-tamagotchi): add TransportAdapter registry impl + libp2p adapter factory (Phase 4 PR 2)` — **ACCEPTED FOR IMPORT**. Provides in-memory registry with a strict sovereign gate (`requiresExternalRelay` refusal) and libp2p factory (12 tests).
  - *(Caution per Cherry-Pick Policy)*: Quarantine PR #20 and speculative WAN tunneling scripts (`cross-wan-node.mjs`) until verified with empirical local isolation tests.

• **Collision & Integration Warnings**:
  - `apps/stage-tamagotchi/src/main/services/airi/agentic/companion.ts`: Publishing logic now funnels through `companionTransportAdapter.publish`. Ensure local companion enhancements do not clash with the `Uint8Array` binary transformation.
  - `apps/stage-tamagotchi/src/main/services/airi/libp2p/index.ts`: Injected Google STUN servers (`stun.l.google.com:19302`). In strict sovereign or offline-first deployments, verify outbound STUN requests do not violate network isolation policies.
  - `scripts/tests/attention-ecology-harness/`: Standalone harness deletion from commit `cf090ed5b` was bypassed when 7n1m4 rebased from `ac7c91725`. Local retention in `dasilva333/airi` remains intact.

### 📋 7n1m4 Fork Commits
- `904120f8a` ci: temporarily disable monorepo verification (runs locally)  _(7n1m4, 2026-10-21)_
- `566f09d8f` Merge pull request #15 from anlmalabs/feat/webrtc-stun-ci [#15](https://github.com/7n1m4/airi/pull/15) _(ヴィオレット, 2026-10-21)_
- `7b3c6fda8` feat(libp2p): add public STUN to WebRTC transport + build addon in CI  _(7n1m4, 2026-10-21)_
- `e08c6b5b3` ci: add cross-WAN P2P harness workflow (Phase 5, hosted runners only)  _(7n1m4, 2026-10-21)_
- `732c711d0` Merge pull request #13 from anlmalabs/feat/companion-publish-via-transport-adapter [#13](https://github.com/7n1m4/airi/pull/13) _(ヴィオレット, 2026-10-21)_
- `40f8a146f` refactor(agentic): route companion share publishing through TransportAdapter (Phase 4 PR 3a)  _(7n1m4, 2026-10-21)_
- `ae6e4ece3` Merge pull request #12 from anlmalabs/feat/transport-adapter-registry-impl [#12](https://github.com/7n1m4/airi/pull/12) _(ヴィオレット, 2026-10-21)_
- `c99b829a9` feat(stage-tamagotchi): add TransportAdapter registry impl + libp2p adapter factory (Phase 4 PR 2)  _(7n1m4, 2026-10-21)_
- `137779653` Merge pull request #11 from anlmalabs/feat/transport-adapter-seam-contract [#11](https://github.com/7n1m4/airi/pull/11) _(ヴィオレット, 2026-10-21)_
- `b2438943e` feat(stage-shared): add TransportAdapter seam contract + registry interface (Phase 4)  _(7n1m4, 2026-10-21)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 5 file(s) (+127/-39)
- `.agents/skills/airi-attention-ecology-vision/SKILL.md` *(+7/-4)*
- `.github/workflows/ci-cross-wan-p2p.yml` *(+78/-0)*
- `.github/workflows/ci.yml` *(+2/-8)*
- `docs/design-attention-ecology-screen-watching.md` *(+38/-26)*
- `docs/project-testing-parity.md` *(+2/-1)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 6 file(s) (+326/-3)
- `apps/stage-tamagotchi/src/main/services/airi/agentic/companion.ts` *(+34/-2)*
- `apps/stage-tamagotchi/src/main/services/airi/libp2p/index.ts` *(+15/-1)*
- `apps/stage-tamagotchi/src/main/services/airi/libp2p/transport-adapter.test.ts` *(+77/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/libp2p/transport-adapter.ts` *(+63/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/transport-registry.test.ts` *(+89/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/transport-registry.ts` *(+48/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 22 file(s) (+3358/-1)
- `package.json` *(+4/-0)*
- `packages/stage-shared/package.json` *(+3/-1)*
- `scripts/tests/attention-ecology-harness/.gitignore` *(+5/-0)*
- `scripts/tests/attention-ecology-harness/engine/screen-capture.ts` *(+150/-0)*
- `scripts/tests/attention-ecology-harness/engine/stage0-phash.ts` *(+110/-0)*
- `scripts/tests/attention-ecology-harness/engine/stage1-vision-embed.ts` *(+152/-0)*
- `scripts/tests/attention-ecology-harness/engine/stage2-ocr.ts` *(+255/-0)*
- `scripts/tests/attention-ecology-harness/engine/stage2-salience-eval.ts` *(+216/-0)*
- `scripts/tests/attention-ecology-harness/engine/stage3-vlm-forwarder.ts` *(+251/-0)*
- `scripts/tests/attention-ecology-harness/eval-attention-ecology.ts` *(+339/-0)*
- `scripts/tests/attention-ecology-harness/live-desktop-dashboard.ts` *(+417/-0)*
- `scripts/tests/attention-ecology-harness/live-desktop-observer.ts` *(+171/-0)*
- `scripts/tests/attention-ecology-harness/live-ticker-observer.ts` *(+138/-0)*
- `scripts/tests/attention-ecology-harness/package.json` *(+18/-0)*
- `scripts/tests/attention-ecology-harness/pnpm-lock.yaml` *(+1116/-0)*
- `scripts/tests/attention-ecology-harness/test-screenshots/01-static-editor.png` *(+0/-0)*
- `scripts/tests/attention-ecology-harness/test-screenshots/02-static-editor-cursor.png` *(+0/-0)*
- `scripts/tests/attention-ecology-harness/test-screenshots/03-window-switch-term.png` *(+0/-0)*
- `scripts/tests/attention-ecology-harness/test-screenshots/04-term-error-stack.png` *(+0/-0)*
- `scripts/tests/attention-ecology-harness/test-screenshots/05a-browser-video-frame1.png` *(+0/-0)*
- `scripts/tests/attention-ecology-harness/test-screenshots/05b-browser-video-frame2.png` *(+0/-0)*
- `scripts/tests/attention-ecology-harness/tsconfig.json` *(+13/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 7 file(s) (+191/-358)
- `packages/stage-shared/src/index.ts` *(+2/-0)*
- `packages/stage-shared/src/transport-adapter.test.ts` *(+56/-0)*
- `packages/stage-shared/src/transport-adapter.ts` *(+67/-0)*
- `packages/stage-shared/src/transport-registry.test.ts` *(+31/-0)*
- `packages/stage-shared/src/transport-registry.ts` *(+30/-0)*
- `packages/stage-ui/src/workers/attention-guard/engine/pixels.test.ts` *(+0/-347)*
- `packages/stage-ui/src/workers/attention-guard/engine/pixels.ts` *(+5/-11)*

### 📬 7n1m4 Fork Activity Radar
#### 🆕 New Items Opened (12)
- [PR] [#20](https://github.com/anlmalabs/airi/pull/20) `feat(cross-wan): stand up a three-runner libp2p mesh across the WAN` by **@anlmabot** *(1 comments)*
- [PR] [#18](https://github.com/anlmalabs/airi/pull/18) `ci: cross-WAN harness using GitHub issue rendezvous (no secrets)` by **@anlmabot** *(0 comments)*
- [PR] [#16](https://github.com/anlmalabs/airi/pull/16) `ci: two-runner cross-WAN harness with gist rendezvous + WebRTC hole punching` by **@anlmabot** *(0 comments)*
- [PR] [#14](https://github.com/anlmalabs/airi/pull/14) `ci: cross-WAN P2P harness workflow (Phase 5, hosted runners only)` by **@anlmabot** *(0 comments)*
- [PR] [#15](https://github.com/anlmalabs/airi/pull/15) `feat(libp2p): add public STUN to WebRTC transport + build addon in CI` by **@anlmabot** *(0 comments)*
- [PR] [#13](https://github.com/anlmalabs/airi/pull/13) `refactor(agentic): route companion share publishing through TransportAdapter (Phase 4 PR 3a)` by **@anlmabot** *(0 comments)*
- [PR] [#12](https://github.com/anlmalabs/airi/pull/12) `feat(stage-tamagotchi): TransportAdapter registry impl + libp2p adapter factory (Phase 4 PR 2)` by **@anlmabot** *(0 comments)*
- [PR] [#11](https://github.com/anlmalabs/airi/pull/11) `feat(stage-shared): TransportAdapter seam contract + registry interface (Phase 4)` by **@anlmabot** *(0 comments)*
- [Issue] [#19](https://github.com/anlmalabs/airi/issues/19) `scratch: cross-wan tunnel validation` by **@anlmabot** *(121 comments)*
- [Issue] [#17](https://github.com/anlmalabs/airi/issues/17) `[CI] Cross-WAN rendezvous (auto-managed, do not close)` by **@anlmabot** *(9 comments)*
- [Issue] [#9](https://github.com/anlmalabs/airi/issues/9) `test app post` by **@anlmabot** *(0 comments)*
- [Issue] [#10](https://github.com/anlmalabs/airi/issues/10) `Phase 4: TransportAdapter seam (pluggable mesh boundary)` by **@anlmabot** *(0 comments)*

#### 🔄 Status & Lifecycle Changes (2)
- [Issue] [#4](https://github.com/anlmalabs/airi/issues/4) `Phase 3: Agentic OS Integration` — `OPEN` ➔ `CLOSED`
- [Issue] [#3](https://github.com/anlmalabs/airi/issues/3) `Phase 2: libp2p Local Mesh Foundation` — `OPEN` ➔ `CLOSED`

#### 💬 Discussion Activity (1)
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p Local Mesh → Agentic OS integration` — *+12 comments (2 ➔ 14 total)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/anlmalabs/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/anlmalabs/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/anlmalabs/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p Local Mesh → Agentic OS integration` [OPEN] — 🚨 **+12 comments** (14 total)
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/anlmalabs/airi/issues/4) `Phase 3: Agentic OS Integration` [CLOSED] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
## [2026-10-20] 7n1m4 Fork Delta: `2988fb78..cf090ed5` (11 commits, 88 files, 1 update(s))

### 🎯 Executive Highlights
**Sister Fork Intelligence Briefing & Cherry-Pick Provenance**:

• **Adopted Cherry-Picks in dasilva333/airi**:
  - `9221056bf` ➔ `adc8b4555`: Fixed 77 stage-ui typecheck errors across test files and removed 37 brittle type casts.
  - `27e08e167` ➔ `fc05b0f48`: Added `closePacing()` in `turn-pacing-coordinator.ts` to clear stale `nextEligibleAtMs`, +729 lines of test coverage (66/66 passing), and fixed `layered-memory` mock in `memory-text-journal.test.ts` (18/18 passing).
  - `09ab62d1c` ➔ `574c2b7ab`: Added canonical Vue ambient shims (`env.d.ts`) across 13 workspaces and fixed tsconfig exclude inheritance for child packages (verified passing `vue-tsc --noEmit` with 0 errors).

• **Executive Highlights**:
  7n1m4 completed an 11-commit stabilization blitz across 88 files focusing on repo-wide typecheck resolution and test hardening. They resolved pacing timer leaks, prevented libp2p websockets teardown hangs on Bun via `webSocketsCloseSafe` (`8a8a3f796`), and retired the standalone cleanroom attention harness in favor of in-app Vision DevTools and `pixels.test.ts` (`cf090ed5b`).

• **Discussion Velocity**:
  Activity on master roadmap Issue #1 (`wayfinder: Cloudflare Purge → libp2p Local Mesh → Agentic OS`) with +1 new comment. @dasilva333 submitted an architectural proposal introducing a pluggable `TransportAdapter` interface to bridge 7n1m4's local libp2p mesh with upstream without forcing divergent silos.

• **Collision & Integration Warnings**:
  - `apps/stage-tamagotchi/src/main/services/airi/libp2p/`: Keep quarantined behind the pluggable `TransportAdapter` interface.
  - `scripts/tests/attention-ecology-harness/`: Standalone harness was deleted upstream; retained locally per user preference.

### 📋 7n1m4 Fork Commits
- `cf090ed5b` test: retire the attention-ecology cleanroom harness  _(vi, 2026-10-20)_
- `ac7c91725` style: drop stray blank lines in stage-pocket tsconfig  _(vi, 2026-10-20)_
- `de5b8bfa4` chore: stop tracking tsbuildinfo build artifact  _(vi, 2026-10-20)_
- `f26052953` test: tolerate cross-engine float drift; scope browser test and audit parsing  _(vi, 2026-10-20)_
- `09ab62d1c` fix: green repo typecheck — vue ambient shims and tsconfig input resolution  _(vi, 2026-10-20)_
- `8a8a3f796` fix: stop libp2p websockets teardown from hanging on Bun  _(vi, 2026-10-20)_
- `27e08e167` fix: clear stale nextEligibleAtMs on pacing close, and fix 5 pre-existing test failures  _(vi, 2026-10-20)_
- `9221056bf` fix: resolve 77 stage-ui typecheck errors without casts  _(vi, 2026-10-20)_
- `c4f4c4488` fix: remove duplicated test block in agentic-intentions.test.ts (syntax error)  _(vi, 2026-10-20)_
- `94e15a6e7` chore: improve coverage batch 9 (audio, consciousness, presence, airi-card, modules/index, providers/helpers, use-model-preload)  _(vi, 2026-10-20)_
- `ba1c5d4fb` chore: improve coverage batch 8 (turn-pacing-coordinator, audio, consciousness, settings-catalog, memory-sentinel, color-from-element, entity-ledger, faculty-defaults, presence)  _(vi, 2026-10-20)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 5 file(s) (+42/-47)
- `.agents/skills/airi-attention-ecology-vision/SKILL.md` *(+4/-7)*
- `docs/design-attention-ecology-screen-watching.md` *(+26/-38)*
- `docs/env.d.ts` *(+10/-0)*
- `docs/project-testing-parity.md` *(+1/-2)*
- `docs/tsconfig.json` *(+1/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 33 file(s) (+2338/-179)
- `apps/component-calling/src/env.d.ts` *(+10/-0)*
- `packages/motion-driver-magic/src/var-ar-hmm.test.ts` *(+36/-8)*
- `packages/stage-ui-mmd/src/env.d.ts` *(+10/-0)*
- `packages/stage-ui-spine/src/env.d.ts` *(+10/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-fps.browser.test.ts` *(+6/-0)*
- `packages/stage-ui/src/composables/api.test.ts` *(+2/-9)*
- `packages/stage-ui/src/composables/use-inference-status.test.ts` *(+1/-1)*
- `packages/stage-ui/src/composables/use-model-preload.test.ts` *(+405/-0)*
- `packages/stage-ui/src/constants/settings-catalog.test.ts` *(+9/-5)*
- `packages/stage-ui/src/constants/settings-search-index.test.ts` *(+5/-0)*
- `packages/stage-ui/src/libs/auth.test.ts` *(+1/-1)*
- `packages/stage-ui/src/libs/color-from-element.test.ts` *(+29/-22)*
- `packages/stage-ui/src/libs/pacing/turn-pacing-coordinator.test.ts` *(+817/-4)*
- `packages/stage-ui/src/libs/pacing/turn-pacing-coordinator.ts` *(+24/-24)*
- `packages/stage-ui/src/libs/providers/tool-schema.test.ts` *(+52/-28)*
- `packages/stage-ui/src/libs/providers/types.test.ts` *(+9/-3)*
- `packages/stage-ui/src/libs/search/entity-ledger.test.ts` *(+4/-4)*
- `packages/stage-ui/src/stores/agentic-guard.test.ts` *(+11/-2)*
- `packages/stage-ui/src/stores/agentic-intentions.test.ts` *(+0/-13)*
- `packages/stage-ui/src/stores/auth.test.ts` *(+1/-1)*
- `packages/stage-ui/src/stores/backup.test.ts` *(+43/-16)*
- `packages/stage-ui/src/stores/character/orchestrator/agents/event-handler-spark-notify/index.test.ts` *(+16/-16)*
- `packages/stage-ui/src/stores/modules/airi-card.test.ts` *(+252/-2)*
- `packages/stage-ui/src/stores/modules/artistry-autonomous.test.ts` *(+4/-0)*
- `packages/stage-ui/src/stores/modules/consciousness.test.ts` *(+31/-2)*
- `packages/stage-ui/src/stores/modules/index.test.ts` *(+62/-0)*
- `packages/stage-ui/src/stores/modules/tools/text-journal.test.ts` *(+3/-3)*
- `packages/stage-ui/src/stores/modules/vision/orchestrator.test.ts` *(+41/-7)*
- `packages/stage-ui/src/stores/nap-chat-surface.test.ts` *(+11/-2)*
- `packages/stage-ui/src/stores/presence-electron.test.ts` *(+67/-1)*
- `packages/stage-ui/src/utils/memory-sentinel.test.ts` *(+8/-0)*
- `packages/stage-ui/src/workers/attention-guard/engine/pixels.test.ts` *(+347/-0)*
- `packages/stage-ui/src/workers/attention-guard/engine/pixels.ts` *(+11/-5)*

#### Root Build & Tooling (`🔍 inspect`) — 25 file(s) (+55/-3358)
- `apps/stage-mate/tsconfig.json` *(+9/-0)*
- `package.json` *(+0/-4)*
- `packages/cap-vite/tsconfig.json` *(+9/-0)*
- `packages/stream-kit/tsconfig.json` *(+9/-0)*
- `scripts/audit-test-catalog.mjs` *(+28/-3)*
- `scripts/tests/attention-ecology-harness/.gitignore` *(+0/-5)*
- `scripts/tests/attention-ecology-harness/engine/screen-capture.ts` *(+0/-150)*
- `scripts/tests/attention-ecology-harness/engine/stage0-phash.ts` *(+0/-110)*
- `scripts/tests/attention-ecology-harness/engine/stage1-vision-embed.ts` *(+0/-152)*
- `scripts/tests/attention-ecology-harness/engine/stage2-ocr.ts` *(+0/-255)*
- `scripts/tests/attention-ecology-harness/engine/stage2-salience-eval.ts` *(+0/-216)*
- `scripts/tests/attention-ecology-harness/engine/stage3-vlm-forwarder.ts` *(+0/-251)*
- `scripts/tests/attention-ecology-harness/eval-attention-ecology.ts` *(+0/-339)*
- `scripts/tests/attention-ecology-harness/live-desktop-dashboard.ts` *(+0/-417)*
- `scripts/tests/attention-ecology-harness/live-desktop-observer.ts` *(+0/-171)*
- `scripts/tests/attention-ecology-harness/live-ticker-observer.ts` *(+0/-138)*
- `scripts/tests/attention-ecology-harness/package.json` *(+0/-18)*
- `scripts/tests/attention-ecology-harness/pnpm-lock.yaml` *(+0/-1116)*
- `scripts/tests/attention-ecology-harness/test-screenshots/01-static-editor.png` *(+0/-0)*
- `scripts/tests/attention-ecology-harness/test-screenshots/02-static-editor-cursor.png` *(+0/-0)*
- `scripts/tests/attention-ecology-harness/test-screenshots/03-window-switch-term.png` *(+0/-0)*
- `scripts/tests/attention-ecology-harness/test-screenshots/04-term-error-stack.png` *(+0/-0)*
- `scripts/tests/attention-ecology-harness/test-screenshots/05a-browser-video-frame1.png` *(+0/-0)*
- `scripts/tests/attention-ecology-harness/test-screenshots/05b-browser-video-frame2.png` *(+0/-0)*
- `scripts/tests/attention-ecology-harness/tsconfig.json` *(+0/-13)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 4 file(s) (+60/-4)
- `apps/stage-pocket/src/env.d.ts` *(+10/-0)*
- `apps/stage-pocket/tsconfig.json` *(+21/-3)*
- `apps/stage-web/src/env.d.ts` *(+10/-0)*
- `apps/stage-web/tsconfig.json` *(+19/-1)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 7 file(s) (+251/-5)
- `apps/stage-tamagotchi/src/env.d.ts` *(+10/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/libp2p/index.ts` *(+2/-2)*
- `apps/stage-tamagotchi/src/main/services/airi/libp2p/transports.test.ts` *(+11/-1)*
- `apps/stage-tamagotchi/src/main/services/airi/libp2p/websockets-bun-close.ts` *(+211/-0)*
- `apps/stage-tamagotchi/tsconfig.node.json` *(+12/-1)*
- `apps/stage-tamagotchi/tsconfig.node.tsbuildinfo` *(+0/-1)*
- `apps/stage-tamagotchi/tsconfig.web.json` *(+5/-0)*

#### Stage Layouts & Shells (`🔍 inspect`) — 1 file(s) (+10/-0)
- `packages/stage-layouts/src/env.d.ts` *(+10/-0)*

#### UI Primitives & Pages (`📦 import / inspect`) — 4 file(s) (+41/-0)
- `packages/stage-pages/src/env.d.ts` *(+10/-0)*
- `packages/ui-loading-screens/src/env.d.ts` *(+11/-0)*
- `packages/ui-transitions/src/env.d.ts` *(+10/-0)*
- `packages/ui/src/env.d.ts` *(+10/-0)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 2 file(s) (+20/-0)
- `packages/stage-ui-live2d/src/env.d.ts` *(+10/-0)*
- `packages/stage-ui-three/src/env.d.ts` *(+10/-0)*

#### Audio & Speech Pipeline (`🔍 inspect`) — 1 file(s) (+63/-25)
- `packages/stage-ui/src/stores/audio.test.ts` *(+63/-25)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 2 file(s) (+15/-3)
- `packages/stage-ui/src/stores/chat/text-journal-tool.test.ts` *(+3/-3)*
- `packages/stage-ui/src/stores/memory-text-journal.test.ts` *(+12/-0)*

#### Provider & Model Integrations (`📦 import / inspect`) — 4 file(s) (+358/-18)
- `packages/stage-ui/src/stores/providers/helpers.test.ts` *(+302/-0)*
- `packages/stage-ui/src/stores/providers/registry/chat-local.test.ts` *(+2/-2)*
- `packages/stage-ui/src/stores/providers/registry/local-engines.test.ts` *(+50/-12)*
- `packages/stage-ui/src/stores/providers/registry/speech.test.ts` *(+4/-4)*

### 📬 7n1m4 Fork Activity Radar
#### 💬 Discussion Activity (1)
- [Issue] [#1](https://github.com/7n1m4/airi/issues/1) `wayfinder: Cloudflare Purge → libp2p Local Mesh → Agentic OS` — *+1 comments (1 ➔ 2 total)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/7n1m4/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/7n1m4/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/7n1m4/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/7n1m4/airi/issues/1) `wayfinder: Cloudflare Purge → libp2p Local Mesh → Agentic OS` [OPEN] — 🚨 **+1 comments** (2 total)
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/7n1m4/airi/issues/4) `Phase 3: Agentic OS Integration` [OPEN] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
