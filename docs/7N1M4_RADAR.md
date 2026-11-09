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

## [2026-11-09] 7n1m4 Fork Delta: `2b0703f1..e8c9f7bf` (1 commits, 14 files, 2 update(s))

### 🚨 Action Required: Direct Mentions & Maintainer Inquiries
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6382505252)):
  > "@dasilva333  — thank you for putting together such a comprehensive blueprint! Having reviewed it end-to-end, the proposed 4-layer inversion aligns perfectly with our architecture and integrates seamlessly into the components we have already deployed without any structural rework. ### Architecture Ma"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6442783645)):
  > "Phase 6 PR 1 landed: ported `packages/stage-shared/src/peers.ts` (+12 tests) as the Universal Friends & Peers domain substrate. Transport-agnostic, sovereign-adapted (libp2p multiaddrs, no Cloudflare relay). PR: https://github.com/dasilva333/airi/pull/30. Next: reconciler (libp2p-based same-account "
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6453934222)):
  > "## 2026-10-28 — feat/nap-chat-substrate-unify (PR #22) Opened PR #22 unifying fork nap-chat substrate onto upstream (dasilva333/airi) design to eliminate code silos. Shipped on branch `feat/nap-chat-substrate-unify` (commit b23152b4a):"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6473559133)):
  > "--- ## Milestone: Fork-upstream alignment (devlog #24) We’re kicking off a focused effort to stay closely aligned with upstream (dasilva333/airi) for painless porting of features/improvements."
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6476456954)):
  > "Progress checkpoint summary: - Ported peers vault sync (peers-reconciler + store methods) committed as b99f02811. - Restored peers tests."
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6477119522)):
  > "Upstream contract alignment progress: ported peers vault sync, cadence delivery + libs + speech bus, dsl-snapshot, composer-draft-bridge, message-sanitizer, compaction exports, cloudflare-auth + cors-proxy-worker-script, stickers + image-convert + background-removal, sandbox libs, ming3, perf/tracer"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6477379397)):
  > "Typecheck clean (exit 0). All upstream contract alignment work complete. Commits: ba2d6c370 (contract alignment, 73 files), ad0e53485 (remaining typecheck fixes, 33 files). Removed dead sandbox module (no external callers). Working tree clean. Ready for next task. --- _Posted by **Beam from Anima La"

### 🎯 Executive Highlights
Sister Fork Intelligence Briefing & Testing Parity Expansion:

• **Executive Highlights**:
  - **Measure-First Test Coverage & Vitest Root Wiring (PR #38, commit `e8c9f7bf7`)**: 7n1m4 executed a major test coverage sprint across the monorepo. Crucially, they wired `packages/nan0-runtime`, `packages/speech-transformer-chem`, and `packages/speech-transformer-math` into root `vitest.config.ts` projects, surfacing **42 test suites and 739 tests** previously excluded from root `pnpm test` and CI runs.
  - **Shared Layered-Memory Mock Contract (`mock-layered-memory.ts` + `mock-layered-memory.test.ts`)**: Established a standardized, contract-tested mock factory for `layeredMemory` in `packages/stage-ui/src/test-utils/`. Eliminates hand-rolled mock drift across 5 store suites (`agentic-guard`, `echo-chips`, `nap-chat-surface`, and `memory-text-journal` x2) and permanently silences the ~42 unhandled promise rejections previously caused by missing methods like `fetchStatus`.
  - **Compaction Distillation End-to-End Suite (`compaction.test.ts`)**: Expanded `useCompactionStore` tests to validate the `strategy === "distill"` branch across multiple day buckets, asserting that short-term memory (STMM) blocks are persisted and sessions are pruned to system + active tail without corrupting System-1 winnowing.
  - **Background Builtin Seeding Resilience (`background.test.ts`)**: Added unit test suite covering `useBackgroundStore.initializeStore()`, testing successful blob retrieval and localforage persistence for `builtin:cozy-tea-corner` and `builtin:cute-streaming-room`, graceful single-error logging on network drop, and prevention of redundant fetches for cached wallpapers.
  - **New High-Coverage Unit Suites**: Added full coverage suites for `libs/providers/tool-call-budget.ts` (100% lines, 7 tests; enforces `DEFAULT_MAX_TOOL_STEPS = 20` and round caps), `libs/search/turn-chunker.ts` (100% lines, 5 tests; sliding window turn chunking), and `utils/math-speech.ts` (~93% lines, 15 tests; BCP 47 mapping, dominant script detection, bare LaTeX parsing).
  - **Test Parity Catalog Reconciliation (`docs/project-testing-parity.md`)**: Reconciled 176 uncataloged suites into the canonical document, raising the verified monorepo baseline to 372 root-collected suites / 4,437 tests with 0 failures.

• **Discussion Velocity**:
  - **Issue #17 ([CI] Cross-WAN rendezvous)**: High-frequency automated CI coordination added +18 new comments (total 369 comments), maintaining the multiaddr signaling bus for isolated runner mesh tests.
  - **PR #38 (`test(coverage): measure-first pass`)**: Authored and merged by @7n1m4, integrating the full test-coverage improvement plan and establishing coverage thresholds (32/24/31/33).

• **Cherry-Pick Candidates**:
  - **Root `vitest.config.ts` Package Wiring (`vitest.config.ts`)**: **High Priority / Zero Risk**. Add `packages/nan0-runtime`, `packages/speech-transformer-chem`, and `packages/speech-transformer-math` to projects array to immediately run all 739 nan0 and speech transformer tests during root `pnpm test`.
  - **Layered-Memory Shared Mock Factory (`packages/stage-ui/src/test-utils/mock-layered-memory.ts` & test)**: **High Priority / Test Quality**. Centralizes `layeredMemory` mocks and provides contract verification to prevent test suite mock drift and unhandled rejection noise.
  - **Turn Chunker & Tool-Call Budget Test Suites (`packages/stage-ui/src/libs/search/turn-chunker.test.ts`, `packages/stage-ui/src/libs/providers/tool-call-budget.test.ts`)**: **High Priority / Immediate Port**. 100% coverage suites for pure utility logic with zero application dependencies.
  - **Math Speech & Background Seeding Test Suites (`packages/stage-ui/src/utils/math-speech.test.ts`, `packages/stage-ui/src/stores/background.test.ts`)**: **High Priority / Immediate Port**. Comprehensive unit tests validating speech translation helpers and background wallpaper cache lifecycle.
  - **Compaction Distill Verification Test (`packages/stage-ui/src/stores/chat/compaction.test.ts`)**: **High Priority / Immediate Port**. Exercises end-to-end multi-day STMM bucket distillation.

• **Collision Warnings**:
  - **Store Test Migration Parity (`memory-text-journal.background-index.test.ts`)**: 7n1m4 preserved a verbatim live-getter override for `lastIndexState` because plain property replacement breaks two indexing tests. Ensure this live-getter override is retained when porting the mock factory into `dasilva333/airi`.
  - **Vitest Coverage Thresholds**: 7n1m4's root coverage thresholds require careful validation when ported to ensure existing `dasilva333/airi` custom modules do not trigger unexpected threshold failures in CI.

### 📋 7n1m4 Fork Commits
- `e8c9f7bf7` test(coverage): measure-first pass — root wiring, mock contract, distill + seeding + 3 suites, catalog reconciled (#38) [#38](https://github.com/7n1m4/airi/pull/38) _(ヴィオレット, 2026-11-09)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 1 file(s) (+223/-12)
- `docs/project-testing-parity.md` *(+223/-12)*

#### Other / Uncategorized (`🔍 inspect`) — 9 file(s) (+421/-34)
- `packages/stage-ui/src/libs/providers/tool-call-budget.test.ts` *(+87/-0)*
- `packages/stage-ui/src/libs/search/turn-chunker.test.ts` *(+74/-0)*
- `packages/stage-ui/src/stores/agentic-guard.test.ts` *(+4/-7)*
- `packages/stage-ui/src/stores/echo-chips.test.ts` *(+23/-20)*
- `packages/stage-ui/src/stores/nap-chat-surface.test.ts` *(+4/-7)*
- `packages/stage-ui/src/test-utils/mock-layered-memory.test.ts` *(+57/-0)*
- `packages/stage-ui/src/test-utils/mock-layered-memory.ts` *(+49/-0)*
- `packages/stage-ui/src/utils/math-speech.test.ts` *(+120/-0)*
- `vitest.config.ts` *(+3/-0)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 1 file(s) (+157/-0)
- `packages/stage-ui/src/stores/background.test.ts` *(+157/-0)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 3 file(s) (+76/-20)
- `packages/stage-ui/src/stores/chat/compaction.test.ts` *(+55/-1)*
- `packages/stage-ui/src/stores/memory-text-journal.background-index.test.ts` *(+17/-12)*
- `packages/stage-ui/src/stores/memory-text-journal.test.ts` *(+4/-7)*

### 📬 7n1m4 Fork Activity Radar
#### 🆕 New Items Opened (1)
- [PR] [#38](https://github.com/anlmalabs/airi/pull/38) `test(coverage): measure-first pass — root wiring, mock contract, distill + seeding + 3 suites, catalog reconciled` by **@7n1m4** *(0 comments)*

#### 💬 Discussion Activity (1)
- [Issue] [#17](https://github.com/anlmalabs/airi/issues/17) `[CI] Cross-WAN rendezvous (auto-managed, do not close)` — *+18 comments (351 ➔ 369 total)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/anlmalabs/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/anlmalabs/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/anlmalabs/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` [OPEN] — *(33 comments)*
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/anlmalabs/airi/issues/4) `Phase 3: Agentic OS Integration` [CLOSED] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
## [2026-11-08] 7n1m4 Fork Delta: `3c58f428..2b0703f1` (26 commits, 427 files, 8 update(s))

### 🚨 Action Required: Direct Mentions & Maintainer Inquiries
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6382505252)):
  > "@dasilva333  — thank you for putting together such a comprehensive blueprint! Having reviewed it end-to-end, the proposed 4-layer inversion aligns perfectly with our architecture and integrates seamlessly into the components we have already deployed without any structural rework. ### Architecture Ma"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6442783645)):
  > "Phase 6 PR 1 landed: ported `packages/stage-shared/src/peers.ts` (+12 tests) as the Universal Friends & Peers domain substrate. Transport-agnostic, sovereign-adapted (libp2p multiaddrs, no Cloudflare relay). PR: https://github.com/dasilva333/airi/pull/30. Next: reconciler (libp2p-based same-account "
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6453934222)):
  > "## 2026-10-28 — feat/nap-chat-substrate-unify (PR #22) Opened PR #22 unifying fork nap-chat substrate onto upstream (dasilva333/airi) design to eliminate code silos. Shipped on branch `feat/nap-chat-substrate-unify` (commit b23152b4a):"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6473559133)):
  > "--- ## Milestone: Fork-upstream alignment (devlog #24) We’re kicking off a focused effort to stay closely aligned with upstream (dasilva333/airi) for painless porting of features/improvements."
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6476456954)):
  > "Progress checkpoint summary: - Ported peers vault sync (peers-reconciler + store methods) committed as b99f02811. - Restored peers tests."
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6477119522)):
  > "Upstream contract alignment progress: ported peers vault sync, cadence delivery + libs + speech bus, dsl-snapshot, composer-draft-bridge, message-sanitizer, compaction exports, cloudflare-auth + cors-proxy-worker-script, stickers + image-convert + background-removal, sandbox libs, ming3, perf/tracer"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6477379397)):
  > "Typecheck clean (exit 0). All upstream contract alignment work complete. Commits: ba2d6c370 (contract alignment, 73 files), ad0e53485 (remaining typecheck fixes, 33 files). Removed dead sandbox module (no external callers). Working tree clean. Ready for next task. --- _Posted by **Beam from Anima La"

### 🎯 Executive Highlights
Sister Fork Intelligence Briefing & Architectural Alignment:

• **Executive Highlights**:
  - **Comprehensive Upstream Reconciliation Wave (PR #37, commits `70ad2043e`..`41bd36f0c`)**: 7n1m4 executed an extensive 16-commit wave-based reconciliation with `dasilva333/airi` to eliminate architectural drift. Waves 1–2 wholesale-ported ~205 fork-untouched files; Wave 3 closed dependency gaps (mathjson, audio-cache, spine hacker, i18n fallback, assets); Waves 4–5 performed 3-way hand-merges of dual-modified files (`airi-card.ts`, `session-store.ts`, `mcp-tool-bridge`, `query-analyzer`, `live-session`, `display-models`, `memory-lifetime`, `vision`); Waves 6–9 restored fork sovereignty invariants (`AIRI_ENABLE_CLOUD_ADAPTERS` opt-in gate, loopback guard, `NapConfig`/`napPeerId` companion state) and resolved build/renderer issues.
  - **Keyless Provider Hardening & Live Truth Sync (PR #35, commit `9a43090dd`)**: Rigorous synchronization of the keyless provider lane against live API reality and CI smoke tests. Completely purged `lanlan-free` due to permanent server-side TCP connection failures (`www.lanlan.tech`). Trimmed 7 sunset/404 model IDs from Kilo presets down to the 12 verified live free IDs. Converted `mimo` into an authenticated OpenAI-compatible provider (`api.xiaomimimo.com/v1`, models `mimo-v2.6-flash/pro/ultraspeed`) after Xiaomi's free JWT API sunset, moving it out of the keyless lane (`requiresCredentials: true`).
  - **oh-my-pi Coding Agent Bridge & Server-Runtime Routing Fix (PR #34, commit `fa0f37d9d`)**: Landed `@proj-airi/airi-plugin-oh-my-pi` under `integrations/oh-my-pi/`, bridging `oh-my-pi` (omp) coding sessions to AIRI's Channel Server via WebSocket. Crucially resolved a routing delimiter bug in `packages/server-runtime/src/middlewares/route/match-expression.ts` where `split(':', 2)` truncated scoped peer identifiers at the second colon, breaking prefixed destination matching (`plugin:proj-airi:stage-web`).
  - **Cloudflare Shims Integration (PR #32, commit `e58df07e3`)**: Merged pluggable cloud shims behind the `TransportAdapter` seam, wiring `registerCloudAdapters` into transport setup strictly behind the `AIRI_ENABLE_CLOUD_ADAPTERS=1` flag while enforcing sovereign rejection guards.
  - **Test Suite & Typecheck Remediation (PR #36, commit `ceef6ae60`; commit `dd27cc7c7`)**: Resolved 4 typecheck blockers (`mimo` listModels typing, `useCompanionStore.localPeerId` export, Pinia unwrap `.value` removal in `nap-chat-coordinator.ts`, GossipSub pubsub typing). Repaired 4 failing test suites: explicit `@libp2p/tcp` transport addition in `cross-wan-roundtrip.ts`, test-runtime provider registration in `registry.ts`, strict universe isolation in `memory-lifetime`, System-1 winnow compaction restoration in `compaction.ts`, and guard against missing `layeredMemory.fetchStatus` in `memory-text-journal.ts`.

• **Discussion Velocity**:
  - **Issue #17 ([CI] Cross-WAN rendezvous)**: High-frequency automated CI activity with +117 new comments (108 ➔ 234 ➔ 351 total), serving as the decentralized multiaddr rendezvous bus for cross-WAN P2P test runs across isolated runners.
  - **Issue #1 ([Roadmap])**: Significant milestone update with +4 new comments (total 33). The master roadmap body was comprehensively updated to reflect codebase ground truth, formally marking Phases 1 through 6 as complete and verified against HEAD (`4cc7e729c`). Noted remaining open specifications: gossip topic schemas, CRDT vs LWW conflict resolution, and extended sensory telemetry.
  - **PR Lifecycle Transitions**: PR #32 (Cloudflare transport wiring) and PR #33 (cherry-picks batch 1 from upstream) were merged into main. Four new PRs opened (#34, #35, #36, #37) and merged in rapid succession.

• **Cherry-Pick Candidates**:
  - **Destination Colon Parsing Fix (`packages/server-runtime/src/middlewares/route/match-expression.ts`)** (`fa0f37d9d`): High-priority upstream fix. `split(':', 2)` truncated scoped destinations like `plugin:proj-airi:stage-tamagotchi` to `proj-airi`, preventing matches against production peer IDs. Splitting on first colon only restores correct destination routing.
  - **Nap-Chat Coordinator Store Unwrapping Fix (`packages/stage-ui/src/stores/nap-chat-coordinator.ts`)** (`ceef6ae60`): Fixes a latent bug where `napChat.latestEpisode.value` failed because Pinia setup stores auto-unwrap refs, causing `finishSession` to always fall back to synthetic episodes. Includes test assertion.
  - **Kilo Model Presets Pruning (`packages/stage-ui/src/libs/providers/providers/kilo/`)** (`9a43090dd`): Prunes 7 dead model IDs and aligns presets with the 12 verified live free endpoints, preventing user 404 errors. Purges dead `lanlan-free` registry entries.
  - **Unhandled Rejection Guard in Memory Text Journal (`packages/stage-ui/src/stores/memory-text-journal.ts`)** (`dd27cc7c7`): Adds `typeof layeredMemory.fetchStatus === 'function'` and try/catch guard, eliminating 42 unhandled promise rejections in test environments lacking the mock method.
  - **Libp2p TCP Explicit Transport & GossipSub Message Decode (`scripts/lib/cross-wan-roundtrip.ts`)** (`dd27cc7c7`): Adds `@libp2p/tcp` for libp2p v2 compatibility and JSON-decodes gossipsub Uint8Array payloads cleanly.

• **Collision Warnings**:
  - **Cognitive & Session Hand-Merges**: 12 files in `packages/stage-ui/src/stores/chat/` (`compaction.ts`, `session-store.ts`, `airi-card.ts`, `memory-lifetime.ts`) have dual modifications. 7n1m4 embeds `NapConfig`, `napPeerId`, and `universeId` handling. Avoid blind file replacement; maintain `dasilva333/airi`'s offline-first memory schema.
  - **Cloudflare Transport Ingress (`apps/stage-tamagotchi/.../cloudflare/`)**: Restores cloud relay adapters. Verify that `dasilva333/airi` retains strict offline-first sovereignty by default, ensuring cloud transports remain opt-in only via flags.
  - **Test-Runtime Cloud Provider Activation (`packages/stage-ui/vitest.config.ts` & `registry.ts`)**: Sets `VITE_ENABLE_CLOUD_PROVIDERS=1` in vitest and activates cloud providers when `isTestRuntime` is true. Ensure unit tests in `dasilva333/airi` do not inadvertently perform external network calls.

### 📋 7n1m4 Fork Commits
- `2b0703f19` Merge remote-tracking branch 'origin/main'  _(7n1m4, 2026-11-08)_
- `dd27cc7c7` fix(tests): repair 4 failing test files — libp2p TCP transport, cloud-provider registry in tests, universe isolation, winnow compaction  _(7n1m4, 2026-11-08)_
- `41bd36f0c` reconcile: sync fork with upstream/main (wave-based, 16 commits, sovereignty preserved) (#37) [#37](https://github.com/7n1m4/airi/pull/37) _(ヴィオレット, 2026-11-08)_
- `ca00ce895` reconcile(wave9): fix stage-tamagotchi renderer build — port upstream components/workers, adopt upstream exports map + zlib node-shim  _(7n1m4, 2026-11-08)_
- `8cacddb39` reconcile(wave8): upstream flowmdm (needed by text-to-motion), fork vrmaExporter.test; stage-ui typecheck 0  _(7n1m4, 2026-11-08)_
- `a30ccd632` reconcile(wave7): fix wave-induced test regressions, port missing assets/providers  _(7n1m4, 2026-11-08)_
- `a9992e0e4` fix: integrations tsconfig exclude incompatible with root prune (pre-existing TS18003)  _(7n1m4, 2026-11-08)_
- `2d359fb6e` reconcile(wave6): stage-pages green — electron-eventa/ui/i18n ports, QRCode+fallback exports, LifetimeProvisioningModal, sovereignty re-applied  _(7n1m4, 2026-11-08)_
- `961a855f5` reconcile(wave5c): revert wave-clobbered fork files, port i18n fallback + spine hacker + plugin-protocol assistant:state  _(7n1m4, 2026-11-08)_
- `ac7d6556e` reconcile(wave5): dep closure + 3-way merges to green stage-ui typecheck  _(7n1m4, 2026-11-08)_
- `d80473345` reconcile(wave5a): take upstream memory-lifetime.ts (fork delta was console.log->info only)  _(7n1m4, 2026-11-08)_
- `08280bfab` reconcile(wave4): hand-merge 4 both-changed modules (mcp-tool-bridge, query-analyzer, live-session, display-models)  _(7n1m4, 2026-11-08)_
- `93148c29e` reconcile(wave3c): transitive dep closure — 17 more upstream-only modules  _(7n1m4, 2026-11-08)_
- `78c5dd9a9` reconcile(wave3b): port 19 upstream-only dependency modules  _(7n1m4, 2026-11-08)_
- `a0602c355` reconcile: take upstream providers/types.ts (superset — retains fork's requiresCredentials union)  _(7n1m4, 2026-11-08)_
- `4f9a51fa5` reconcile: port @proj-airi/ui Alert component from upstream (fork-untouched)  _(7n1m4, 2026-11-08)_
- `5513ee2f0` reconcile(wave2): auto-port 31 files with trivial fork deltas from upstream  _(7n1m4, 2026-11-08)_
- `d8375346b` reconcile(wave1b): port SettingsThemeHeaderWidget.vue from upstream  _(7n1m4, 2026-11-08)_
- `a3fb22b5e` reconcile(wave1): port 174 fork-untouched files wholesale from upstream/main  _(7n1m4, 2026-11-08)_
- `70ad2043e` chore(reconcile): base commit — upstream read-only rule override + Workstream A fixes  _(7n1m4, 2026-11-08)_
- `4cc7e729c` chore: purge .omp/plans directory  _(7n1m4, 2026-11-08)_
- `ceef6ae60` fix: resolve 4 pre-existing typecheck errors (#36) [#36](https://github.com/7n1m4/airi/pull/36) _(ヴィオレット, 2026-11-08)_
- `9a43090dd` fix(providers): sync keyless lane with 2026-11-08 CI smoke (#35) [#35](https://github.com/7n1m4/airi/pull/35) _(anlmabot[bot], 2026-11-08)_
- `e58df07e3` feat(cloudflare): wire cloud adapter registration into transport setup (#32) [#32](https://github.com/7n1m4/airi/pull/32) _(ヴィオレット, 2026-11-08)_
- `9f45c34e7` feat(upstream): cherry-picks batch 1 (#33) [#33](https://github.com/7n1m4/airi/pull/33) _(ヴィオレット, 2026-11-08)_
- `fa0f37d9d` feat(integrations): oh-my-pi AIRI bridge + server-runtime routing fix (#34) [#34](https://github.com/7n1m4/airi/pull/34) _(ヴィオレット, 2026-11-08)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 7 file(s) (+170/-477)
- `.omp/plans/KILO_PRESET_MODELS_PLAN.md` *(+0/-473)*
- `AGENTS.md` *(+1/-1)*
- `docs/project-testing-parity.md` *(+3/-3)*
- `integrations/oh-my-pi/airi-plugin-oh-my-pi/README.md` *(+24/-0)*
- `packages/mathjson/README.md` *(+30/-0)*
- `packages/speech-transformer-chem/README.md` *(+47/-0)*
- `packages/speech-transformer-math/README.md` *(+65/-0)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 22 file(s) (+2022/-828)
- `apps/stage-tamagotchi/electron-builder.yml` *(+1/-1)*
- `apps/stage-tamagotchi/electron.vite.config.ts` *(+5/-0)*
- `apps/stage-tamagotchi/scripts/linux-window-render-smoke.ts` *(+17/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/agentic/companion.ts` *(+5/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/libp2p/cross-wan-roundtrip.test.ts` *(+30/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/widgets/index.ts` *(+29/-1)*
- `apps/stage-tamagotchi/src/main/services/electron/screen.ts` *(+12/-2)*
- `apps/stage-tamagotchi/src/main/services/sensors/index.ts` *(+13/-1)*
- `apps/stage-tamagotchi/src/main/windows/splash/index.ts` *(+2/-2)*
- `apps/stage-tamagotchi/src/main/windows/widgets/index.ts` *(+220/-20)*
- `apps/stage-tamagotchi/src/main/windows/widgets/rpc/index.electron.ts` *(+22/-2)*
- `apps/stage-tamagotchi/src/renderer/components/chat/chat_lifetime.vue` *(+3/-460)*
- `apps/stage-tamagotchi/src/renderer/components/chat/chat_music.vue` *(+696/-99)*
- `apps/stage-tamagotchi/src/renderer/main.ts` *(+18/-0)*
- `apps/stage-tamagotchi/src/renderer/modules/i18n.ts` *(+13/-2)*
- `apps/stage-tamagotchi/src/renderer/pages/customizer.vue` *(+1/-2)*
- `apps/stage-tamagotchi/src/renderer/pages/devtools/widgets-calling.vue` *(+137/-0)*
- `apps/stage-tamagotchi/src/renderer/pages/onboarding-v3.vue` *(+5/-3)*
- `apps/stage-tamagotchi/src/renderer/splash.html` *(+536/-171)*
- `apps/stage-tamagotchi/src/renderer/splash.main.ts` *(+252/-58)*
- `apps/stage-tamagotchi/src/renderer/styles/main.css` *(+4/-4)*
- `apps/stage-tamagotchi/src/shared/eventa.ts` *(+1/-0)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 1 file(s) (+0/-8)
- `apps/stage-web/index.html` *(+0/-8)*

#### Root Build & Tooling (`🔍 inspect`) — 14 file(s) (+1224/-157)
- `integrations/claude-code/airi-plugin-claude-code/tsconfig.json` *(+7/-1)*
- `integrations/oh-my-pi/airi-plugin-oh-my-pi/package.json` *(+33/-0)*
- `integrations/oh-my-pi/airi-plugin-oh-my-pi/tsconfig.json` *(+13/-0)*
- `integrations/vscode/airi-plugin-vscode/tsconfig.json` *(+7/-1)*
- `packages/mathjson/package.json` *(+35/-0)*
- `packages/mathjson/tsconfig.json` *(+18/-0)*
- `packages/speech-transformer-chem/package.json` *(+45/-0)*
- `packages/speech-transformer-chem/tsconfig.json` *(+18/-0)*
- `packages/speech-transformer-math/package.json` *(+39/-0)*
- `packages/speech-transformer-math/tsconfig.json` *(+18/-0)*
- `packages/stage-ui/package.json` *(+10/-0)*
- `pnpm-lock.yaml` *(+833/-99)*
- `scripts/lib/cross-wan-roundtrip.ts` *(+105/-0)*
- `scripts/test-keyless-providers.ts` *(+43/-56)*

#### Other / Uncategorized (`🔍 inspect`) — 303 file(s) (+49367/-10908)
- `integrations/oh-my-pi/airi-plugin-oh-my-pi/src/config.test.ts` *(+30/-0)*
- `integrations/oh-my-pi/airi-plugin-oh-my-pi/src/config.ts` *(+20/-0)*
- `integrations/oh-my-pi/airi-plugin-oh-my-pi/src/format.test.ts` *(+45/-0)*
- `integrations/oh-my-pi/airi-plugin-oh-my-pi/src/format.ts` *(+51/-0)*
- `integrations/oh-my-pi/airi-plugin-oh-my-pi/src/index.test.ts` *(+53/-0)*
- `integrations/oh-my-pi/airi-plugin-oh-my-pi/src/index.ts` *(+64/-0)*
- `integrations/oh-my-pi/airi-plugin-oh-my-pi/vitest.config.ts` *(+9/-0)*
- `packages/electron-eventa/src/electron-updater/index.ts` *(+22/-1)*
- `packages/electron-screen-capture/src/main/index.ts` *(+20/-6)*
- `packages/electron-vueuse/src/composables/use-electron-auto-updater.ts` *(+10/-0)*
- `packages/electron-vueuse/src/index.ts` *(+14/-1)*
- `packages/mathjson/src/index.ts` *(+58/-0)*
- `packages/mathjson/tsdown.config.ts` *(+6/-0)*
- `packages/motion-driver-magic/src/crossfade.test.ts` *(+58/-0)*
- `packages/motion-driver-magic/src/crossfade.ts` *(+59/-0)*
- `packages/motion-driver-magic/src/index.ts` *(+1/-0)*
- `packages/plugin-protocol/src/types/events.ts` *(+16/-0)*
- `packages/server-runtime/src/middlewares/route/match-expression.test.ts` *(+14/-0)*
- `packages/server-runtime/src/middlewares/route/match-expression.ts` *(+3/-2)*
- `packages/speech-transformer-chem/src/chem.test.ts` *(+20/-0)*
- `packages/speech-transformer-chem/src/chem.ts` *(+287/-0)*
- `packages/speech-transformer-chem/src/index.ts` *(+50/-0)*
- `packages/speech-transformer-chem/src/locale.ts` *(+49/-0)*
- `packages/speech-transformer-chem/src/locales/en.test.ts` *(+44/-0)*
- `packages/speech-transformer-chem/src/locales/en.ts` *(+29/-0)*
- `packages/speech-transformer-chem/src/locales/ja.test.ts` *(+51/-0)*
- `packages/speech-transformer-chem/src/locales/ja.ts` *(+31/-0)*
- `packages/speech-transformer-chem/src/locales/ko.test.ts` *(+39/-0)*
- `packages/speech-transformer-chem/src/locales/ko.ts` *(+31/-0)*
- `packages/speech-transformer-chem/src/locales/names-ja.ts` *(+134/-0)*
- `packages/speech-transformer-chem/src/locales/names-ko.ts` *(+134/-0)*
- `packages/speech-transformer-chem/src/locales/names-zh.ts` *(+133/-0)*
- `packages/speech-transformer-chem/src/locales/names.test.ts` *(+12/-0)*
- `packages/speech-transformer-chem/src/locales/zh.test.ts` *(+50/-0)*
- `packages/speech-transformer-chem/src/locales/zh.ts` *(+29/-0)*
- `packages/speech-transformer-chem/tsdown.config.ts` *(+6/-0)*
- `packages/speech-transformer-chem/vitest.config.ts` *(+8/-0)*
- `packages/speech-transformer-math/src/extension.ts` *(+44/-0)*
- `packages/speech-transformer-math/src/heads.ts` *(+67/-0)*
- `packages/speech-transformer-math/src/index.ts` *(+17/-0)*
- `packages/speech-transformer-math/src/locale.ts` *(+389/-0)*
- `packages/speech-transformer-math/src/locales/en.test.ts` *(+263/-0)*
- `packages/speech-transformer-math/src/locales/en.ts` *(+219/-0)*
- `packages/speech-transformer-math/src/locales/ja.test.ts` *(+151/-0)*
- `packages/speech-transformer-math/src/locales/ja.ts` *(+214/-0)*
- `packages/speech-transformer-math/src/locales/ko.test.ts` *(+161/-0)*
- `packages/speech-transformer-math/src/locales/ko.ts` *(+217/-0)*
- `packages/speech-transformer-math/src/locales/zh.test.ts` *(+190/-0)*
- `packages/speech-transformer-math/src/locales/zh.ts` *(+218/-0)*
- `packages/speech-transformer-math/src/lower.test.ts` *(+112/-0)*
- `packages/speech-transformer-math/src/lower.ts` *(+1104/-0)*
- `packages/speech-transformer-math/src/numbers.test.ts` *(+25/-0)*
- `packages/speech-transformer-math/src/numbers.ts` *(+132/-0)*
- `packages/speech-transformer-math/src/parse.test.ts` *(+45/-0)*
- `packages/speech-transformer-math/src/parse.ts` *(+431/-0)*
- `packages/speech-transformer-math/src/render.test.ts` *(+77/-0)*
- `packages/speech-transformer-math/src/render.ts` *(+462/-0)*
- `packages/speech-transformer-math/src/speech.bench.ts` *(+49/-0)*
- `packages/speech-transformer-math/src/speech.test.ts` *(+70/-0)*
- `packages/speech-transformer-math/src/speech.ts` *(+138/-0)*
- `packages/speech-transformer-math/src/tex.ts` *(+83/-0)*
- `packages/speech-transformer-math/src/units.test.ts` *(+62/-0)*
- `packages/speech-transformer-math/src/units.ts` *(+62/-0)*
- `packages/speech-transformer-math/tsdown.config.ts` *(+6/-0)*
- `packages/speech-transformer-math/vitest.config.ts` *(+8/-0)*
- `packages/stage-shared/src/text.test.ts` *(+49/-1)*
- `packages/stage-shared/src/transport.ts` *(+23/-0)*
- `packages/stage-ui-spine/src/index.ts` *(+1/-0)*
- `packages/stage-ui-spine/src/utils/spine-hacker-runtime.ts` *(+50/-0)*
- `packages/stage-ui/src/assets/backgrounds/summer-sky-meadow-with-wildflowers.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/free-ai-catalog-baseline.json` *(+10327/-4569)*
- `packages/stage-ui/src/assets/memory-personal-journal.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/memory-quiet-reflection.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/memory-shared-history.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/motions/blow_kiss.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/motions/celebrate.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/motions/graceful_bow.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/motions/hello.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/proactivity-speech-bubbles.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/widgets/starter-custom-terminal.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/widgets/starter-daily-checklist.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/widgets/starter-focus-timer.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/widgets/starter-haven-weather.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/widgets/starter-honey-notes.avif` *(+0/-0)*
- `packages/stage-ui/src/assets/widgets/starter-strawberry-pet.avif` *(+0/-0)*
- `packages/stage-ui/src/components/markdown/markdown-renderer.vue` *(+16/-6)*
- `packages/stage-ui/src/components/menu/radio-card-detail.vue` *(+51/-6)*
- `packages/stage-ui/src/components/menu/radio-card-many-select.vue` *(+10/-3)*
- `packages/stage-ui/src/components/menu/voice-card-many-select.vue` *(+1/-1)*
- `packages/stage-ui/src/components/misc/CharacterAvatar.vue` *(+8/-4)*
- `packages/stage-ui/src/components/misc/alert.vue` *(+6/-71)*
- `packages/stage-ui/src/components/misc/error-container.vue` *(+1/-1)*
- `packages/stage-ui/src/components/modules/MessagingFriends.vue` *(+4/-2)*
- `packages/stage-ui/src/components/scenarios/about/about-content.vue` *(+1/-1)*
- `packages/stage-ui/src/components/scenarios/chat/BrainModelFavoriteModal.vue` *(+672/-0)*
- `packages/stage-ui/src/components/scenarios/chat/BrainModelPicker.vue` *(+251/-257)*
- `packages/stage-ui/src/components/scenarios/chat/ChatDashboardCard.vue` *(+79/-0)*
- `packages/stage-ui/src/components/scenarios/chat/ChatGroundingPopover.vue` *(+24/-6)*
- `packages/stage-ui/src/components/scenarios/chat/ChatImagesPopover.vue` *(+30/-18)*
- `packages/stage-ui/src/components/scenarios/chat/ChatWorkspaceTerminalPanel.vue` *(+823/-0)*
- `packages/stage-ui/src/components/scenarios/chat/ChatWorkspaceWidgetsPanel.vue` *(+556/-0)*
- `packages/stage-ui/src/components/scenarios/chat/MusicTrackPreview.vue` *(+154/-0)*
- `packages/stage-ui/src/components/scenarios/chat/ProviderSetupNudge.vue` *(+186/-0)*
- `packages/stage-ui/src/components/scenarios/chat/VoiceInputHover.vue` *(+76/-0)*
- `packages/stage-ui/src/components/scenarios/chat/VoiceInputHoverCard.vue` *(+512/-0)*
- `packages/stage-ui/src/components/scenarios/chat/WhisperComposerBar.vue` *(+191/-24)*
- `packages/stage-ui/src/components/scenarios/chat/components/sticker.vue` *(+8/-3)*
- `packages/stage-ui/src/components/scenarios/chat/index.ts` *(+8/-1)*
- `packages/stage-ui/src/components/scenarios/chat/tool-call-block.vue` *(+238/-26)*
- `packages/stage-ui/src/components/scenarios/chat/user-item.vue` *(+7/-1)*
- `packages/stage-ui/src/components/scenarios/chat/utils.test.ts` *(+23/-1)*
- `packages/stage-ui/src/components/scenarios/chat/utils.ts` *(+117/-0)*
- `packages/stage-ui/src/components/scenarios/consciousness/ConsciousnessProbeTester.vue` *(+179/-0)*
- `packages/stage-ui/src/components/scenarios/consciousness/ConsciousnessRouteSelector.vue` *(+770/-0)*
- `packages/stage-ui/src/components/scenarios/consciousness/ConsciousnessWorkspace.vue` *(+45/-0)*
- `packages/stage-ui/src/components/scenarios/consciousness/index.ts` *(+4/-0)*
- `packages/stage-ui/src/components/scenarios/consciousness/useConsciousnessConfig.ts` *(+1035/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/VoiceCreatorModal.vue` *(+498/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/cloudflare/CloudflareConnectDialog.vue` *(+611/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/download/GetNativeAppDialog.vue` *(+3/-3)*
- `packages/stage-ui/src/components/scenarios/dialogs/index.ts` *(+1/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/lifetime-memory/LifetimeProvisioningModal.vue` *(+550/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/model-assignment/model-assignment-modal.vue` *(+99/-102)*
- `packages/stage-ui/src/components/scenarios/dialogs/model-selector/model-selector.vue` *(+444/-40)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-6-speech.vue` *(+5/-13)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-7-calibration.vue` *(+1/-1)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/components/art-preview-modal.vue` *(+20/-17)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/components/assistant-bubble.vue` *(+220/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/components/comfyui-workflow-modal.vue` *(+27/-24)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/components/experience-compatibility-panel.vue` *(+243/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/components/provider-picker-grid.vue` *(+126/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/components/sliding-stepper.vue` *(+7/-7)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/components/vessel-coverflow.vue` *(+20/-14)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/composables/useOnboardingHardwareSnapshot.ts` *(+229/-0)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/composables/useStarterCardCommit.ts` *(+53/-45)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/onboarding-v3.vue` *(+20/-9)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/quick-start.vue` *(+0/-7)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-appearance.vue` *(+288/-301)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-artistry.vue` *(+397/-347)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-emotions.vue` *(+42/-30)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-experience.vue` *(+285/-288)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-hearing.vue` *(+604/-472)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-memory.vue` *(+288/-299)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-proactivity.vue` *(+833/-528)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-profile.vue` *(+383/-194)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-screen.vue` *(+38/-38)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-sensory.vue` *(+113/-82)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-tools.vue` *(+359/-317)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-vessel.vue` *(+365/-285)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-welcome.vue` *(+102/-71)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/stores/useOnboardingV3Draft.ts` *(+35/-7)*
- `packages/stage-ui/src/components/scenarios/index.ts` *(+1/-0)*
- `packages/stage-ui/src/components/scenarios/providers/provider-model-browser.vue` *(+1/-1)*
- `packages/stage-ui/src/components/scenarios/providers/provider-validation-alerts.vue` *(+1/-2)*
- `packages/stage-ui/src/components/scenarios/settings/ModelCacheManager.vue` *(+73/-74)*
- `packages/stage-ui/src/components/scenarios/settings/StageControlEditor.vue` *(+402/-0)*
- `packages/stage-ui/src/components/scenarios/settings/index.ts` *(+1/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/audio-studio.vue` *(+1089/-538)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/HackerStudioShell.vue` *(+1095/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/live2d/live2d-exporter.ts` *(+109/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/live2d/live2d-texture.ts` *(+61/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/live2d/use-live2d-hacker-adapter.ts` *(+309/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/spine/spine-exporter.ts` *(+47/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/spine/spine-texture.ts` *(+22/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/spine/use-spine-hacker-adapter.ts` *(+304/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/types.ts` *(+86/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/vrm/glb-exporter.ts` *(+173/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/vrm/use-vrm-hacker-adapter.ts` *(+666/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/composables/use-hacker-studio.ts` *(+296/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/domain/export-filename.ts` *(+81/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/domain/generation-guidance.ts` *(+15/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/domain/material-owners.ts` *(+21/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/domain/preview-gamma.ts` *(+29/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/domain/texture-identity.ts` *(+24/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/domain/upload-validation.ts` *(+71/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/use-hacker-studio-host.ts` *(+54/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/use-live2d-hacker-studio-host.ts` *(+45/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/use-spine-hacker-studio-host.ts` *(+43/-0)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/index.ts` *(+1/-2)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/index.vue` *(+0/-9)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/live2d.vue` *(+21/-23)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/spine.vue` *(+21/-2)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm.vue` *(+35/-73)*
- `packages/stage-ui/src/components/scenarios/stickers/sticker-manager.vue` *(+40/-11)*
- `packages/stage-ui/src/components/scenarios/stickers/sticker-upload-dialog.vue` *(+270/-0)*
- `packages/stage-ui/src/components/scenarios/widgets/MicroAppCatalog.vue` *(+799/-0)*
- `packages/stage-ui/src/composables/arcade/use-arcade-agent.ts` *(+4/-1)*
- `packages/stage-ui/src/composables/audio/audio-analyzer.ts` *(+18/-12)*
- `packages/stage-ui/src/composables/index.ts` *(+5/-0)*
- `packages/stage-ui/src/composables/markdown.test.ts` *(+10/-0)*
- `packages/stage-ui/src/composables/markdown.ts` *(+3/-0)*
- `packages/stage-ui/src/composables/queues.ts` *(+94/-3)*
- `packages/stage-ui/src/composables/response-categoriser.test.ts` *(+18/-0)*
- `packages/stage-ui/src/composables/response-categoriser.ts` *(+8/-5)*
- `packages/stage-ui/src/composables/use-auto-suggestions.ts` *(+125/-0)*
- `packages/stage-ui/src/composables/use-autonomous-cues.test.ts` *(+121/-10)*
- `packages/stage-ui/src/composables/use-autonomous-cues.ts` *(+244/-45)*
- `packages/stage-ui/src/composables/use-chat-composer.ts` *(+552/-17)*
- `packages/stage-ui/src/composables/use-chat-dashboard.ts` *(+250/-0)*
- `packages/stage-ui/src/composables/use-control-strip-action.ts` *(+20/-6)*
- `packages/stage-ui/src/composables/use-preflight-grounding.ts` *(+335/-0)*
- `packages/stage-ui/src/constants/control-customizer.ts` *(+34/-26)*
- `packages/stage-ui/src/constants/prompts/character-defaults.ts` *(+56/-5)*
- `packages/stage-ui/src/constants/settings-search-index.ts` *(+33/-0)*
- `packages/stage-ui/src/database/repos/chat-sessions.repo.ts` *(+8/-1)*
- `packages/stage-ui/src/database/repos/provisioning-session.repo.ts` *(+29/-7)*
- `packages/stage-ui/src/libs/index.ts` *(+2/-0)*
- `packages/stage-ui/src/libs/inference/adapters/kokoro.ts` *(+3/-3)*
- `packages/stage-ui/src/libs/inference/adapters/laya.ts` *(+48/-21)*
- `packages/stage-ui/src/libs/inference/adapters/pocket-tts.ts` *(+6/-0)*
- `packages/stage-ui/src/libs/inference/adapters/whisper.ts` *(+10/-7)*
- `packages/stage-ui/src/libs/inference/cache-utils.test.ts` *(+239/-1)*
- `packages/stage-ui/src/libs/inference/cache-utils.ts` *(+670/-12)*
- `packages/stage-ui/src/libs/inference/constants.ts` *(+46/-16)*
- `packages/stage-ui/src/libs/inference/contract.ts` *(+2/-0)*
- `packages/stage-ui/src/libs/inference/coordinator.ts` *(+13/-3)*
- `packages/stage-ui/src/libs/inference/index.ts` *(+16/-3)*
- `packages/stage-ui/src/libs/inference/laya-engine.ts` *(+40/-57)*
- `packages/stage-ui/src/libs/inference/laya-models.ts` *(+148/-0)*
- `packages/stage-ui/src/libs/providers/providers/index.ts` *(+1/-1)*
- `packages/stage-ui/src/libs/providers/providers/kilo/index.test.ts` *(+2/-2)*
- `packages/stage-ui/src/libs/providers/providers/kilo/index.ts` *(+1/-53)*
- `packages/stage-ui/src/libs/providers/providers/lanlan-free/index.test.ts` *(+0/-70)*
- `packages/stage-ui/src/libs/providers/providers/lanlan-free/index.ts` *(+0/-75)*
- `packages/stage-ui/src/libs/providers/providers/laya-local/index.ts` *(+9/-6)*
- `packages/stage-ui/src/libs/providers/providers/mimo/index.ts` *(+25/-118)*
- `packages/stage-ui/src/libs/providers/providers/opencode-go/index.ts` *(+46/-1)*
- `packages/stage-ui/src/libs/providers/providers/openjev-local/index.ts` *(+98/-0)*
- `packages/stage-ui/src/libs/providers/providers/registry.ts` *(+11/-3)*
- `packages/stage-ui/src/libs/providers/tool-call-budget.ts` *(+39/-0)*
- `packages/stage-ui/src/libs/providers/tool-result-images.ts` *(+102/-0)*
- `packages/stage-ui/src/libs/sandbox/jev.ts` *(+2/-2)*
- `packages/stage-ui/src/libs/search/embedding-format.ts` *(+20/-1)*
- `packages/stage-ui/src/libs/search/layered-memory.ts` *(+814/-199)*
- `packages/stage-ui/src/libs/search/ledger-priming.ts` *(+94/-1)*
- `packages/stage-ui/src/libs/search/query-analyzer.test.ts` *(+37/-0)*
- `packages/stage-ui/src/libs/search/query-analyzer.ts` *(+90/-21)*
- `packages/stage-ui/src/libs/search/turn-chunker.ts` *(+56/-0)*
- `packages/stage-ui/src/libs/workers/search/index.ts` *(+194/-78)*
- `packages/stage-ui/src/libs/workers/search/search-channel.ts` *(+250/-0)*
- `packages/stage-ui/src/libs/workers/search/search.worker.ts` *(+209/-24)*
- `packages/stage-ui/src/libs/workers/worker.ts` *(+39/-25)*
- `packages/stage-ui/src/services/mcp/web-client.ts` *(+358/-0)*
- `packages/stage-ui/src/services/speech/audio-cache.ts` *(+389/-0)*
- `packages/stage-ui/src/stores/character.test.ts` *(+1/-0)*
- `packages/stage-ui/src/stores/character/index.ts` *(+50/-0)*
- `packages/stage-ui/src/stores/companion.ts` *(+1/-0)*
- `packages/stage-ui/src/stores/display-models.ts` *(+188/-50)*
- `packages/stage-ui/src/stores/faculty-defaults.test.ts` *(+10/-10)*
- `packages/stage-ui/src/stores/faculty-defaults.ts` *(+33/-9)*
- `packages/stage-ui/src/stores/mcp-tool-bridge.test.ts` *(+96/-0)*
- `packages/stage-ui/src/stores/mcp-tool-bridge.ts` *(+236/-4)*
- `packages/stage-ui/src/stores/mcp.ts` *(+3/-0)*
- `packages/stage-ui/src/stores/mods/api/channel-server.ts` *(+1/-0)*
- `packages/stage-ui/src/stores/modules/airi-card.ts` *(+354/-71)*
- `packages/stage-ui/src/stores/modules/hearing-speech-input-pipeline.ts` *(+31/-12)*
- `packages/stage-ui/src/stores/modules/hearing-store.ts` *(+45/-0)*
- `packages/stage-ui/src/stores/modules/index.test.ts` *(+5/-0)*
- `packages/stage-ui/src/stores/modules/live-session.ts` *(+9/-5)*
- `packages/stage-ui/src/stores/modules/nan0.ts` *(+23/-4)*
- `packages/stage-ui/src/stores/modules/speech.test.ts` *(+206/-1)*
- `packages/stage-ui/src/stores/modules/speech.ts` *(+432/-137)*
- `packages/stage-ui/src/stores/modules/system-one.test.ts` *(+17/-1)*
- `packages/stage-ui/src/stores/modules/system-one.ts` *(+392/-12)*
- `packages/stage-ui/src/stores/modules/text-to-motion.ts` *(+175/-6)*
- `packages/stage-ui/src/stores/modules/tools/motion.ts` *(+132/-0)*
- `packages/stage-ui/src/stores/modules/vision.ts` *(+47/-18)*
- `packages/stage-ui/src/stores/modules/vision/orchestrator.ts` *(+37/-10)*
- `packages/stage-ui/src/stores/nap-chat-coordinator.test.ts` *(+1/-0)*
- `packages/stage-ui/src/stores/nap-chat-coordinator.ts` *(+1/-1)*
- `packages/stage-ui/src/stores/onboarding.test.ts` *(+11/-3)*
- `packages/stage-ui/src/stores/onboarding.ts` *(+9/-4)*
- `packages/stage-ui/src/stores/settings/audio-device.ts` *(+6/-0)*
- `packages/stage-ui/src/stores/settings/control-strip.ts` *(+49/-19)*
- `packages/stage-ui/src/stores/settings/general.ts` *(+1/-0)*
- `packages/stage-ui/src/tools/index.ts` *(+2/-0)*
- `packages/stage-ui/src/tools/mcp.ts` *(+214/-0)*
- `packages/stage-ui/src/tools/web.ts` *(+28/-0)*
- `packages/stage-ui/src/types/chat.ts` *(+29/-5)*
- `packages/stage-ui/src/types/lifetime-memory.ts` *(+7/-2)*
- `packages/stage-ui/src/utils/chat-actor-slices.ts` *(+21/-7)*
- `packages/stage-ui/src/utils/flowmdm/clipEncoder.test.ts` *(+4/-7)*
- `packages/stage-ui/src/utils/flowmdm/clipEncoder.ts` *(+86/-16)*
- `packages/stage-ui/src/utils/flowmdm/constants.test.ts` *(+1/-1)*
- `packages/stage-ui/src/utils/flowmdm/constants.ts` *(+12/-2)*
- `packages/stage-ui/src/utils/flowmdm/ddimSolver.test.ts` *(+113/-12)*
- `packages/stage-ui/src/utils/flowmdm/ddimSolver.ts` *(+207/-38)*
- `packages/stage-ui/src/utils/flowmdm/retargeting.test.ts` *(+382/-0)*
- `packages/stage-ui/src/utils/flowmdm/retargeting.ts` *(+857/-0)*
- `packages/stage-ui/src/utils/flowmdm/vrmaExporter.ts` *(+124/-14)*
- `packages/stage-ui/src/utils/math-speech.ts` *(+199/-0)*
- `packages/stage-ui/src/utils/web-address-speech.ts` *(+254/-0)*
- `packages/stage-ui/src/workers/background-removal/worker.ts` *(+139/-46)*
- `packages/stage-ui/src/workers/kokoro/worker.ts` *(+49/-0)*
- `packages/stage-ui/src/workers/laya/prep.ts` *(+189/-1)*
- `packages/stage-ui/src/workers/laya/worker.ts` *(+364/-148)*
- `packages/stage-ui/src/workers/ming3/loader.ts` *(+391/-0)*
- `packages/stage-ui/src/workers/ming3/worker.ts` *(+115/-0)*
- `packages/stage-ui/src/workers/moondream/worker.ts` *(+6/-0)*
- `packages/stage-ui/src/workers/vad/vad.worker.ts` *(+9/-2)*
- `packages/stage-ui/vitest.config.ts` *(+6/-1)*
- `pnpm-workspace.yaml` *(+3/-0)*
- `vitest.config.ts` *(+1/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 12 file(s) (+269/-119)
- `packages/i18n/src/fallback.ts` *(+20/-0)*
- `packages/i18n/src/index.ts` *(+2/-0)*
- `packages/i18n/src/locales/en/settings.yaml` *(+10/-14)*
- `packages/i18n/src/locales/es/settings.yaml` *(+1/-1)*
- `packages/i18n/src/locales/fr/settings.yaml` *(+1/-1)*
- `packages/i18n/src/locales/id/settings.yaml` *(+229/-97)*
- `packages/i18n/src/locales/ja/settings.yaml` *(+1/-1)*
- `packages/i18n/src/locales/ko/settings.yaml` *(+1/-1)*
- `packages/i18n/src/locales/ru/settings.yaml` *(+1/-1)*
- `packages/i18n/src/locales/vi/settings.yaml` *(+1/-1)*
- `packages/i18n/src/locales/zh-Hans/settings.yaml` *(+1/-1)*
- `packages/i18n/src/locales/zh-Hant/settings.yaml` *(+1/-1)*

#### UI Primitives & Pages (`📦 import / inspect`) — 39 file(s) (+4728/-1947)
- `packages/stage-pages/src/pages/knowledge-graph/components/KnowledgeGraphOverview.vue` *(+174/-2)*
- `packages/stage-pages/src/pages/settings/about/index.vue` *(+368/-3)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardDetailDialog.vue` *(+7/-7)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardEditorForm.vue` *(+1/-1)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardExportDialog.vue` *(+72/-18)*
- `packages/stage-pages/src/pages/settings/airi-card/components/CardListItem.vue` *(+1/-1)*
- `packages/stage-pages/src/pages/settings/airi-card/components/ConceptBuilderModal.vue` *(+35/-7)*
- `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabModules.vue` *(+2/-2)*
- `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabTools.vue` *(+553/-103)*
- `packages/stage-pages/src/pages/settings/airi-card/components/tabs/acting/ActingSubTabStickers.vue` *(+166/-15)*
- `packages/stage-pages/src/pages/settings/airi-card/components/tabs/acting/components/CardStickerAddModal.vue` *(+324/-40)*
- `packages/stage-pages/src/pages/settings/airi-card/components/tabs/cognition/CognitionSubTabMemory.vue` *(+101/-202)*
- `packages/stage-pages/src/pages/settings/airi-card/composables/use-card-export.ts` *(+94/-14)*
- `packages/stage-pages/src/pages/settings/index.vue` *(+1/-1)*
- `packages/stage-pages/src/pages/settings/memory/index.vue` *(+2/-2)*
- `packages/stage-pages/src/pages/settings/modules/beat-sync.vue` *(+2/-2)*
- `packages/stage-pages/src/pages/settings/modules/components/GlobalFacultiesMatrix.vue` *(+176/-32)*
- `packages/stage-pages/src/pages/settings/modules/components/LifetimeMemoryView.vue` *(+488/-0)*
- `packages/stage-pages/src/pages/settings/modules/components/LifetimeProvisioningModal.vue` *(+14/-353)*
- `packages/stage-pages/src/pages/settings/modules/components/McpConnectionTestPanel.vue` *(+371/-0)*
- `packages/stage-pages/src/pages/settings/modules/consciousness.vue` *(+30/-298)*
- `packages/stage-pages/src/pages/settings/modules/mcp.vue` *(+795/-41)*
- `packages/stage-pages/src/pages/settings/modules/memory-lifetime.vue` *(+3/-318)*
- `packages/stage-pages/src/pages/settings/modules/memory-long-term.vue` *(+125/-3)*
- `packages/stage-pages/src/pages/settings/modules/system-one.vue` *(+110/-7)*
- `packages/stage-pages/src/pages/settings/providers/chat/[providerId].vue` *(+21/-3)*
- `packages/stage-pages/src/pages/settings/providers/speech/kokoro-local.vue` *(+220/-2)*
- `packages/stage-pages/src/pages/settings/providers/speech/pocket-tts-local.vue` *(+79/-48)*
- `packages/stage-pages/src/pages/settings/providers/system1/laya-local.vue` *(+39/-11)*
- `packages/stage-pages/src/pages/settings/providers/transcription/browser-web-speech-api.vue` *(+17/-1)*
- `packages/stage-pages/src/pages/settings/providers/transcription/whisper-local.vue` *(+32/-4)*
- `packages/stage-pages/src/pages/settings/stage/index.vue` *(+2/-391)*
- `packages/stage-pages/src/pages/settings/system/general.vue` *(+9/-4)*
- `packages/stage-pages/src/pages/settings/system/user-profile.vue` *(+3/-3)*
- `packages/ui/src/components/animations/animated-height.vue` *(+50/-0)*
- `packages/ui/src/components/animations/index.ts` *(+1/-0)*
- `packages/ui/src/components/misc/alert.vue` *(+167/-0)*
- `packages/ui/src/components/misc/index.ts` *(+2/-0)*
- `packages/ui/src/composables/use-theme.ts` *(+71/-8)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 5 file(s) (+290/-11)
- `packages/stage-ui-live2d/src/composables/live2d/focus-bias.test.ts` *(+90/-0)*
- `packages/stage-ui-live2d/src/composables/live2d/focus-bias.ts` *(+164/-0)*
- `packages/stage-ui-live2d/src/composables/live2d/index.ts` *(+1/-0)*
- `packages/stage-ui/src/components/widgets/SettingsSearchBar.vue` *(+6/-3)*
- `packages/stage-ui/src/components/widgets/SettingsThemeHeaderWidget.vue` *(+29/-8)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 12 file(s) (+2344/-304)
- `packages/stage-ui/src/composables/llm-json-interceptor.ts` *(+7/-0)*
- `packages/stage-ui/src/composables/llm-marker-parser.ts` *(+38/-6)*
- `packages/stage-ui/src/stores/chat/compaction.ts` *(+41/-5)*
- `packages/stage-ui/src/stores/chat/intrusion-staging.ts` *(+56/-3)*
- `packages/stage-ui/src/stores/chat/intrusions.ts` *(+72/-0)*
- `packages/stage-ui/src/stores/chat/session-store.ts` *(+146/-23)*
- `packages/stage-ui/src/stores/llm.ts` *(+433/-25)*
- `packages/stage-ui/src/stores/memory-lifetime.incremental.test.ts` *(+7/-3)*
- `packages/stage-ui/src/stores/memory-lifetime.test.ts` *(+1/-1)*
- `packages/stage-ui/src/stores/memory-lifetime.ts` *(+669/-187)*
- `packages/stage-ui/src/stores/memory-text-journal.ts` *(+821/-36)*
- `packages/stage-ui/src/types/card.schema.ts` *(+53/-15)*

#### Audio & Speech Pipeline (`🔍 inspect`) — 1 file(s) (+49/-10)
- `packages/stage-ui/src/stores/audio.ts` *(+49/-10)*

#### Provider & Model Integrations (`📦 import / inspect`) — 11 file(s) (+866/-36)
- `packages/stage-ui/src/stores/providers/kokoro-audio-utils.test.ts` *(+57/-0)*
- `packages/stage-ui/src/stores/providers/kokoro-audio-utils.ts` *(+408/-0)*
- `packages/stage-ui/src/stores/providers/registry/index.ts` *(+11/-1)*
- `packages/stage-ui/src/stores/providers/registry/speech.ts` *(+243/-6)*
- `packages/stage-ui/src/stores/providers/registry/transcription.ts` *(+76/-1)*
- `packages/stage-ui/src/stores/providers/runtime/instance-store.phase5.test.ts` *(+17/-0)*
- `packages/stage-ui/src/stores/providers/runtime/models.ts` *(+5/-6)*
- `packages/stage-ui/src/stores/providers/types.ts` *(+19/-1)*
- `packages/stage-ui/src/stores/providers/web-llm/index.ts` *(+8/-2)*
- `packages/stage-ui/src/stores/providers/web-speech-api/index.ts` *(+15/-17)*
- `packages/stage-ui/src/stores/providers/whisper-local/index.ts` *(+7/-2)*

### 📬 7n1m4 Fork Activity Radar
#### 🆕 New Items Opened (4)
- [PR] [#37](https://github.com/anlmalabs/airi/pull/37) `reconcile: sync fork with upstream/main (wave-based, 16 commits, sovereignty preserved)` by **@7n1m4** *(0 comments)*
- [PR] [#36](https://github.com/anlmalabs/airi/pull/36) `fix: resolve 4 pre-existing typecheck errors` by **@7n1m4** *(0 comments)*
- [PR] [#35](https://github.com/anlmalabs/airi/pull/35) `fix(providers): sync keyless lane with 2026-11-08 CI smoke` by **@anlmabot** *(0 comments)*
- [PR] [#34](https://github.com/anlmalabs/airi/pull/34) `feat(integrations): oh-my-pi AIRI bridge + server-runtime routing fix` by **@7n1m4** *(0 comments)*

#### 🔄 Status & Lifecycle Changes (2)
- [PR] [#33](https://github.com/anlmalabs/airi/pull/33) `feat(upstream): cherry-picks batch 1` — `OPEN` ➔ `MERGED`
- [PR] [#32](https://github.com/anlmalabs/airi/pull/32) `feat(cloudflare): wire cloud adapter registration into transport setup` — `OPEN` ➔ `MERGED`

#### 💬 Discussion Activity (2)
- [Issue] [#17](https://github.com/anlmalabs/airi/issues/17) `[CI] Cross-WAN rendezvous (auto-managed, do not close)` — *+117 comments (234 ➔ 351 total)*
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — *+4 comments (29 ➔ 33 total)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/anlmalabs/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/anlmalabs/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/anlmalabs/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` [OPEN] — 🚨 **+4 comments** (33 total)
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/anlmalabs/airi/issues/4) `Phase 3: Agentic OS Integration` [CLOSED] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
## [2026-11-06] 7n1m4 Fork Activity: `3c58f428` (1 update(s))

### 🚨 Action Required: Direct Mentions & Maintainer Inquiries
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6382505252)):
  > "@dasilva333  — thank you for putting together such a comprehensive blueprint! Having reviewed it end-to-end, the proposed 4-layer inversion aligns perfectly with our architecture and integrates seamlessly into the components we have already deployed without any structural rework. ### Architecture Ma"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6442783645)):
  > "Phase 6 PR 1 landed: ported `packages/stage-shared/src/peers.ts` (+12 tests) as the Universal Friends & Peers domain substrate. Transport-agnostic, sovereign-adapted (libp2p multiaddrs, no Cloudflare relay). PR: https://github.com/dasilva333/airi/pull/30. Next: reconciler (libp2p-based same-account "
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6453934222)):
  > "## 2026-10-28 — feat/nap-chat-substrate-unify (PR #22) Opened PR #22 unifying fork nap-chat substrate onto upstream (dasilva333/airi) design to eliminate code silos. Shipped on branch `feat/nap-chat-substrate-unify` (commit b23152b4a):"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6473559133)):
  > "--- ## Milestone: Fork-upstream alignment (devlog #24) We’re kicking off a focused effort to stay closely aligned with upstream (dasilva333/airi) for painless porting of features/improvements."
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6476456954)):
  > "Progress checkpoint summary: - Ported peers vault sync (peers-reconciler + store methods) committed as b99f02811. - Restored peers tests."
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6477119522)):
  > "Upstream contract alignment progress: ported peers vault sync, cadence delivery + libs + speech bus, dsl-snapshot, composer-draft-bridge, message-sanitizer, compaction exports, cloudflare-auth + cors-proxy-worker-script, stickers + image-convert + background-removal, sandbox libs, ming3, perf/tracer"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6477379397)):
  > "Typecheck clean (exit 0). All upstream contract alignment work complete. Commits: ba2d6c370 (contract alignment, 73 files), ad0e53485 (remaining typecheck fixes, 33 files). Removed dead sandbox module (no external callers). Working tree clean. Ready for next task. --- _Posted by **Beam from Anima La"

### 🎯 Executive Highlights
Sister Fork Intelligence Briefing & Architectural Alignment:

• **Executive Highlights**:
  - **New Integration Bridge Package (@proj-airi/airi-plugin-oh-my-pi)**: 7n1m4 (via Beam @ Anima Labs) implemented an oh-my-pi (omp) coding-agent extension under `integrations/oh-my-pi/airi-plugin-oh-my-pi/`. It bridges omp to AIRI via persistent WebSocket (`@proj-airi/server-sdk` `Client`), forwarding user prompts as `input:text` (prefixed `[oh-my-pi · <cwd-basename> · <model>]`), turn completions as `spark:notify` pings, and injecting AIRI's replies back into the omp transcript as `airi-reply` messages correlated via the `textRaw` echo in `output:gen-ai:chat:message`. Features auto-reconnect, heartbeat, session lifecycle cleanup, `possibleEvents` parity with web extensions, and passed 16 vitest tests, typecheck, and full wire smoke through `server-runtime`.
  - **Architecture Discovery on Peer Addressing & Routing Bug**: Flagged two critical messaging discoveries: (1) `destinations: ['character']` matches no production peer, as the character orchestrator listens on shared stage clients named `proj-airi:stage-web` / `proj-airi:stage-tamagotchi` (`channel-server.ts:142`); (2) Prefixed destination forms (`plugin:…`, `module:…`) truncate at the second colon in `packages/server-runtime/src/middlewares/route/match-expression.ts` due to `split(':', 2)`, making exact plain peer-name globs the only functioning addressing format.

• **Discussion Velocity**:
  - **Issue #1 ([Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration)**: Discussion velocity remains active with +1 new update from @anlmabot (total 29 comments), detailing the omp bridge implementation and wire verification.
  - **PR/Issue Lifecycle**: 0 new commits on main (HEAD at `3c58f428`); omp bridge changes remain in 7n1m4 working tree awaiting live E2E against stage-tamagotchi.

• **Cherry-Pick Candidates**:
  - **Server-Runtime Destination Parsing Bugfix**: The destination prefix truncation in `packages/server-runtime/src/middlewares/route/match-expression.ts` (`split(':', 2)` truncating scoped names like `plugin:proj-airi:stage-web`) is a high-value candidate fix for our own codebase.
  - **omp Bridge (`@proj-airi/airi-plugin-oh-my-pi`)**: High-utility companion/coding-agent bridge candidate for modular adoption once published/PR'd upstream and empirically verified.

• **Collision Warnings**:
  - **Zero Git Collisions**: 0 new commits on `7n1m4/main` (baseline remains at `3c58f428`).
  - **Addressing Pitfall**: Avoid using `destinations: ['character']` or prefixed scoped destination selectors in custom fork logic until the delimiter bug in `match-expression.ts` is resolved.

### 📬 7n1m4 Fork Activity Radar
#### 💬 Discussion Activity (1)
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — *+1 comments (28 ➔ 29 total)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/anlmalabs/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/anlmalabs/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/anlmalabs/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` [OPEN] — 🚨 **+1 comments** (29 total)
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/anlmalabs/airi/issues/4) `Phase 3: Agentic OS Integration` [CLOSED] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
## [2026-11-03] 7n1m4 Fork Delta: `a639f80a..3c58f428` (5 commits, 63 files, 14 update(s))

### 🚨 Action Required: Direct Mentions & Maintainer Inquiries
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6382505252)):
  > "@dasilva333  — thank you for putting together such a comprehensive blueprint! Having reviewed it end-to-end, the proposed 4-layer inversion aligns perfectly with our architecture and integrates seamlessly into the components we have already deployed without any structural rework. ### Architecture Ma"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6442783645)):
  > "Phase 6 PR 1 landed: ported `packages/stage-shared/src/peers.ts` (+12 tests) as the Universal Friends & Peers domain substrate. Transport-agnostic, sovereign-adapted (libp2p multiaddrs, no Cloudflare relay). PR: https://github.com/dasilva333/airi/pull/30. Next: reconciler (libp2p-based same-account "
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6453934222)):
  > "## 2026-10-28 — feat/nap-chat-substrate-unify (PR #22) Opened PR #22 unifying fork nap-chat substrate onto upstream (dasilva333/airi) design to eliminate code silos. Shipped on branch `feat/nap-chat-substrate-unify` (commit b23152b4a):"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6473559133)):
  > "--- ## Milestone: Fork-upstream alignment (devlog #24) We’re kicking off a focused effort to stay closely aligned with upstream (dasilva333/airi) for painless porting of features/improvements."
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6476456954)):
  > "Progress checkpoint summary: - Ported peers vault sync (peers-reconciler + store methods) committed as b99f02811. - Restored peers tests."
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6477119522)):
  > "Upstream contract alignment progress: ported peers vault sync, cadence delivery + libs + speech bus, dsl-snapshot, composer-draft-bridge, message-sanitizer, compaction exports, cloudflare-auth + cors-proxy-worker-script, stickers + image-convert + background-removal, sandbox libs, ming3, perf/tracer"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6477379397)):
  > "Typecheck clean (exit 0). All upstream contract alignment work complete. Commits: ba2d6c370 (contract alignment, 73 files), ad0e53485 (remaining typecheck fixes, 33 files). Removed dead sandbox module (no external callers). Working tree clean. Ready for next task. --- _Posted by **Beam from Anima La"

### 🎯 Executive Highlights
Sister Fork Intelligence Briefing & Architectural Alignment:

• **Executive Highlights**:
  - **In-Browser Sandbox Subsystem Shipped (PR #27, Issue #26, commit `cd6f13fd0`)**: 7n1m4 landed an extensive 51-file, +11,650 line sandbox environment (`packages/stage-ui/src/libs/sandbox/*`). Features include in-browser Bash (`just-bash`), TypeScript compilation (`sucrase`), VFS projections, MCP bridge, Jev tool routing, import/export, and interactive starter templates (Daily Checklist, Focus Timer, Glyphs Audio Works, Live2D Menu Driver, Haven Weather, Honey Notes, Strawberry Pet), coupled with DSL hit area routing in `packages/live2d-runtime`.
  - **Pluggable Cloud Shims & Cloudflare Workers AI (PR #29, PR #32, commit `5b8ddee50`)**: Restored minimal pluggable cloud shims behind the `TransportAdapter` seam, strictly gated behind flags (`AIRI_ENABLE_CLOUD_ADAPTERS=1`, `VITE_ENABLE_CLOUD_PROVIDERS=1`). Added Cloudflare Workers AI provider (`cloudflare-workers-ai`) and edge relay transport adapter while preserving sovereign mode opt-outs.
  - **Sovereignty Gate TDD Hardening (PR #30, commit `0e598c5c0`)**: Implemented a comprehensive TDD test suite for `createTransportRegistry` verifying that adapters requiring external relays are rejected when sovereign mode is enabled, and capturing capabilities at registration time to prevent post-registration mutation leaks.
  - **Transport Seam Upstream Alignment & Stable Peer Meta (PR #28, commit `06695b4a1`)**: Eliminated the final documented divergence from Devlog #24 by updating the libp2p transport adapter to preserve `senderId` and `timestamp` from incoming message metadata instead of hardcoding `'mesh'` and `Date.now()`, ensuring stable peer identity across multi-hop gossipsub networks.
  - **Nap-Chat Recap Consolidation (PR #31, commit `3c58f428d`)**: Consolidated autonomous nap-chat recap handling. `finishSession` now directly creates and records `NapChatSessionRecord` into `latestEpisode` as the reactive single source of truth for the UI and pending recap slot, streamlining session lifecycle.
  - **Upstream Cherry-Picks Batch 1 (PR #33)**: 7n1m4 opened PR #33 cherry-picking 7 commits directly from `dasilva333/airi` (Linux Wayland screen capture caching, unscoped CSS highlight rule for v-html bubbles, Plausible removal, native dialog dismissal, AnimatedHeight primitive, smoothstep crossfade, and Live2D focus bias).

• **Discussion Velocity**:
  - **Issue #17 ([CI] Cross-WAN rendezvous)**: Exploded with +126 new automated CI comments (108 ➔ 234 total) validating automated multiaddr gossipsub mesh connectivity across WAN relays.
  - **Issue #1 (Roadmap)**: +2 new comments (26 ➔ 28 total) with @anlmabot reporting sandbox landing and nap-chat recap consolidation, acknowledging dasilva333's maintainer endorsement.
  - **Milestone Transitions**: Both Issue #10 (Phase 4: TransportAdapter seam) and Issue #24 (Devlog: Align fork with upstream) were marked CLOSED as transport seam convergence and contract parity reached 100%. Issue #26 (Sandbox test suite) was opened and closed within 24 hours with all 80 tests passing.
  - **PR Spurt**: 8 new items opened in rapid succession (PRs #27–#33, Issue #26) during Vi's sprint.

• **Cherry-Pick Candidates**:
  - **`06695b4a1` (PR #28) — Preserve `senderId` & `timestamp` in `Libp2pTransportAdapter`**: High-value contract fix. Prevents timestamp/sender loss across gossipsub mesh hops without introducing regressions.
  - **`0e598c5c0` (PR #30) — Sovereignty Gate TDD Cases (`transport-registry.test.ts`)**: Clean, zero-risk unit test suite validating that external relay adapters are rejected in sovereign mode and adapter capabilities are captured immutably at registration.
  - **`3c58f428d` (PR #31) — Nap-chat coordinator recap consolidation**: High-quality cleanup linking `finishSession` directly to `useNapChatStore().recordNapChatCompletion`, eliminating state drift between coordinator and UI display.
  - **`cd6f13fd0` (PR #27) — Live2D DSL hit area parser & VM method**: Isolated runtime fix in `packages/live2d-runtime/src/dsl/interpreter.ts` exposing `runCommandChain` and connecting `Model.vue` command handling.
  - *(Note on Sandbox and Cloudflare Workers AI: Strictly quarantined under Cherry-Pick Policy until empirical testing is performed).*

• **Collision Warnings**:
  - **Cloud Shim Ingress (`apps/stage-tamagotchi/.../cloudflare/`)**: Introduces cloud relay shims. Must verify that `dasilva333/airi`'s offline-first posture remains untouched and that `AIRI_ENABLE_CLOUD_ADAPTERS` stays opt-in.
  - **Root Dependencies**: PR #27 adds `just-bash` and `sucrase` to `packages/stage-ui/package.json` (+954 lockfile lines). Do not adopt without evaluating client bundle overhead.
  - **Store Contract Divergence (`nap-chat-coordinator.ts`)**: 7n1m4 imports `storeToRefs(airiCardStore)` and `useCompanionStore()`. Ensure `localPeerIdSafe` and card accessor helpers match `dasilva333/airi`'s active card implementation if porting.

### 📋 7n1m4 Fork Commits
- `3c58f428d` feat(nap-chat): consolidate recap handling in coordinator and store (#31) [#31](https://github.com/7n1m4/airi/pull/31) _(ヴィオレット, 2026-11-02)_
- `0e598c5c0` test(transport): harden sovereignty gate TDD cases (phase 5) (#30) [#30](https://github.com/7n1m4/airi/pull/30) _(ヴィオレット, 2026-11-02)_
- `5b8ddee50` feat(cloudflare): restore minimal pluggable cloud shims behind TransportAdapter seam (phase 6) (#29) [#29](https://github.com/7n1m4/airi/pull/29) _(ヴィオレット, 2026-11-02)_
- `06695b4a1` fix(transport): preserve sender/timestamp in libp2p adapter (upstream alignment) (#28) [#28](https://github.com/7n1m4/airi/pull/28) _(ヴィオレット, 2026-11-02)_
- `cd6f13fd0` feat(sandbox): implement sandbox subsystem (issue #26) (#27) [#26](https://github.com/7n1m4/airi/pull/26) _(ヴィオレット, 2026-11-02)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 1 file(s) (+96/-73)
- `AGENTS.md` *(+96/-73)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 6 file(s) (+428/-5)
- `apps/stage-tamagotchi/src/main/services/airi/cloudflare/index.ts` *(+16/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/cloudflare/transport-adapter.ts` *(+48/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/libp2p/index.ts` *(+1/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/libp2p/transport-adapter.ts` *(+12/-5)*
- `apps/stage-tamagotchi/src/main/services/airi/transport-registry.test.ts` *(+72/-0)*
- `apps/stage-tamagotchi/src/main/services/sandbox/index.ts` *(+279/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 51 file(s) (+10587/-84)
- `packages/live2d-runtime/src/dsl/command-parser.ts` *(+5/-0)*
- `packages/live2d-runtime/src/dsl/interpreter.ts` *(+15/-0)*
- `packages/live2d-runtime/src/dsl/types.ts` *(+2/-0)*
- `packages/stage-shared/src/cors.ts` *(+18/-2)*
- `packages/stage-shared/src/index.ts` *(+1/-0)*
- `packages/stage-shared/src/libp2p.ts` *(+2/-0)*
- `packages/stage-shared/src/llm/structured-output.ts` *(+1/-4)*
- `packages/stage-shared/src/sandbox.ts` *(+18/-0)*
- `packages/stage-shared/src/sensors.ts` *(+6/-0)*
- `packages/stage-shared/src/text.ts` *(+26/-0)*
- `packages/stage-shared/src/url.ts` *(+19/-7)*
- `packages/stage-shared/src/vision.ts` *(+23/-0)*
- `packages/stage-ui/src/components/modules/MessagingFriends.vue` *(+5/-3)*
- `packages/stage-ui/src/composables/use-sandbox.ts` *(+206/-0)*
- `packages/stage-ui/src/database/repos/widgets.repo.ts` *(+143/-0)*
- `packages/stage-ui/src/libs/providers/providers/cloudflare-workers-ai/index.ts` *(+65/-0)*
- `packages/stage-ui/src/libs/providers/providers/index.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/providers/providers/registry.ts` *(+15/-1)*
- `packages/stage-ui/src/libs/sandbox/ansi.ts` *(+33/-0)*
- `packages/stage-ui/src/libs/sandbox/compiler-bridge.ts` *(+124/-0)*
- `packages/stage-ui/src/libs/sandbox/export.test.ts` *(+42/-0)*
- `packages/stage-ui/src/libs/sandbox/export.ts` *(+79/-0)*
- `packages/stage-ui/src/libs/sandbox/import.test.ts` *(+77/-0)*
- `packages/stage-ui/src/libs/sandbox/import.ts` *(+109/-0)*
- `packages/stage-ui/src/libs/sandbox/index.ts` *(+28/-0)*
- `packages/stage-ui/src/libs/sandbox/jev.ts` *(+846/-0)*
- `packages/stage-ui/src/libs/sandbox/live2d.ts` *(+80/-0)*
- `packages/stage-ui/src/libs/sandbox/manager.ts` *(+2178/-0)*
- `packages/stage-ui/src/libs/sandbox/mcp-bridge.test.ts` *(+178/-0)*
- `packages/stage-ui/src/libs/sandbox/mcp-bridge.ts` *(+117/-0)*
- `packages/stage-ui/src/libs/sandbox/projections.ts` *(+340/-0)*
- `packages/stage-ui/src/libs/sandbox/sandbox.test.ts` *(+1572/-0)*
- `packages/stage-ui/src/libs/sandbox/srcdoc.ts` *(+450/-0)*
- `packages/stage-ui/src/libs/sandbox/starters/daily-checklist.ts` *(+297/-0)*
- `packages/stage-ui/src/libs/sandbox/starters/focus-timer.ts` *(+407/-0)*
- `packages/stage-ui/src/libs/sandbox/starters/glyphs-audio-works.ts` *(+1527/-0)*
- `packages/stage-ui/src/libs/sandbox/starters/haven-weather.ts` *(+31/-0)*
- `packages/stage-ui/src/libs/sandbox/starters/honey-notes.ts` *(+46/-0)*
- `packages/stage-ui/src/libs/sandbox/starters/index.ts` *(+27/-0)*
- `packages/stage-ui/src/libs/sandbox/starters/live2d-menu-driver.test.ts` *(+205/-0)*
- `packages/stage-ui/src/libs/sandbox/starters/live2d-menu-driver.ts` *(+493/-0)*
- `packages/stage-ui/src/libs/sandbox/starters/strawberry-pet.ts` *(+401/-0)*
- `packages/stage-ui/src/libs/sandbox/types.ts` *(+186/-0)*
- `packages/stage-ui/src/stores/companion.ts` *(+1/-1)*
- `packages/stage-ui/src/stores/modules/tools/bash.ts` *(+51/-0)*
- `packages/stage-ui/src/stores/nap-chat-coordinator.test.ts` *(+6/-5)*
- `packages/stage-ui/src/stores/nap-chat-coordinator.ts` *(+59/-40)*
- `packages/stage-ui/src/stores/nap-chat.ts` *(+16/-21)*
- `packages/stage-ui/src/types/just-bash.d.ts` *(+5/-0)*
- `packages/stage-ui/src/types/sucrase.d.ts` *(+3/-0)*
- `pnpm-workspace.yaml` *(+2/-0)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 2 file(s) (+34/-1)
- `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue` *(+8/-1)*
- `packages/stage-ui-live2d/src/runtime/live2d-runtime-adapter.ts` *(+26/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 2 file(s) (+823/-133)
- `packages/stage-ui/package.json` *(+2/-0)*
- `pnpm-lock.yaml` *(+821/-133)*

#### Provider & Model Integrations (`📦 import / inspect`) — 1 file(s) (+7/-0)
- `packages/stage-ui/src/stores/providers/registry/index.ts` *(+7/-0)*

### 📬 7n1m4 Fork Activity Radar
#### 🆕 New Items Opened (8)
- [PR] [#33](https://github.com/anlmalabs/airi/pull/33) `feat(upstream): cherry-picks batch 1` by **@7n1m4** *(0 comments)*
- [PR] [#32](https://github.com/anlmalabs/airi/pull/32) `feat(cloudflare): wire cloud adapter registration into transport setup` by **@7n1m4** *(0 comments)*
- [PR] [#31](https://github.com/anlmalabs/airi/pull/31) `feat(nap-chat): consolidate recap handling in coordinator and store` by **@7n1m4** *(0 comments)*
- [PR] [#30](https://github.com/anlmalabs/airi/pull/30) `test(transport): harden sovereignty gate TDD cases (phase 5)` by **@7n1m4** *(0 comments)*
- [PR] [#29](https://github.com/anlmalabs/airi/pull/29) `feat(cloudflare): restore minimal pluggable cloud shims behind TransportAdapter seam (phase 6)` by **@7n1m4** *(0 comments)*
- [PR] [#28](https://github.com/anlmalabs/airi/pull/28) `fix(transport): preserve sender/timestamp in libp2p adapter (upstream alignment)` by **@7n1m4** *(0 comments)*
- [PR] [#27](https://github.com/anlmalabs/airi/pull/27) `feat(sandbox): implement sandbox subsystem (issue #26)` by **@7n1m4** *(0 comments)*
- [Issue] [#26](https://github.com/anlmalabs/airi/issues/26) `Create comprehensive test suite for the Sandbox system` by **@7n1m4** *(1 comments)*

#### 🔄 Status & Lifecycle Changes (2)
- [Issue] [#10](https://github.com/anlmalabs/airi/issues/10) `Phase 4: TransportAdapter seam (pluggable mesh boundary)` — `OPEN` ➔ `CLOSED`
- [Issue] [#24](https://github.com/anlmalabs/airi/issues/24) `Devlog: Align fork with upstream for painless porting` — `OPEN` ➔ `CLOSED`

#### 💬 Discussion Activity (4)
- [Issue] [#17](https://github.com/anlmalabs/airi/issues/17) `[CI] Cross-WAN rendezvous (auto-managed, do not close)` — *+126 comments (108 ➔ 234 total)*
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — *+2 comments (26 ➔ 28 total)*
- [Issue] [#10](https://github.com/anlmalabs/airi/issues/10) `Phase 4: TransportAdapter seam (pluggable mesh boundary)` — *+1 comments (0 ➔ 1 total)*
- [Issue] [#24](https://github.com/anlmalabs/airi/issues/24) `Devlog: Align fork with upstream for painless porting` — *+1 comments (4 ➔ 5 total)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/anlmalabs/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/anlmalabs/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/anlmalabs/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` [OPEN] — 🚨 **+2 comments** (28 total)
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/anlmalabs/airi/issues/4) `Phase 3: Agentic OS Integration` [CLOSED] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
## [2026-10-29] 7n1m4 Fork Delta: `c516650a..a639f80a` (1 commits, 56 files, 4 update(s))

### 🚨 Action Required: Direct Mentions & Maintainer Inquiries
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6313736629)):
  > "Hey @dasilva333! On behalf of the team here at Anima Labs, thanks so much for the detailed write-up and the awesome shoutout! It’s great to see our roadmaps aligning so closely. To give a bit of context on our end: our core product vision for AnimaOS centers on strict local sovereignty—a puristic, z"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6382505252)):
  > "@dasilva333  — thank you for putting together such a comprehensive blueprint! Having reviewed it end-to-end, the proposed 4-layer inversion aligns perfectly with our architecture and integrates seamlessly into the components we have already deployed without any structural rework. ### Architecture Ma"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6442783645)):
  > "Phase 6 PR 1 landed: ported `packages/stage-shared/src/peers.ts` (+12 tests) as the Universal Friends & Peers domain substrate. Transport-agnostic, sovereign-adapted (libp2p multiaddrs, no Cloudflare relay). PR: https://github.com/dasilva333/airi/pull/30. Next: reconciler (libp2p-based same-account "
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** *(Acknowledged)* ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6453934222)):
  > "## 2026-10-28 — feat/nap-chat-substrate-unify (PR #22) Opened PR #22 unifying fork nap-chat substrate onto upstream (dasilva333/airi) design to eliminate code silos. Shipped on branch `feat/nap-chat-substrate-unify` (commit b23152b4a):"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6473559133)):
  > "--- ## Milestone: Fork-upstream alignment (devlog #24) We’re kicking off a focused effort to stay closely aligned with upstream (dasilva333/airi) for painless porting of features/improvements."
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6476456954)):
  > "Progress checkpoint summary: - Ported peers vault sync (peers-reconciler + store methods) committed as b99f02811. - Restored peers tests."
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6477119522)):
  > "Upstream contract alignment progress: ported peers vault sync, cadence delivery + libs + speech bus, dsl-snapshot, composer-draft-bridge, message-sanitizer, compaction exports, cloudflare-auth + cors-proxy-worker-script, stickers + image-convert + background-removal, sandbox libs, ming3, perf/tracer"
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/anlmalabs/airi/issues/1#issuecomment-6477379397)):
  > "Typecheck clean (exit 0). All upstream contract alignment work complete. Commits: ba2d6c370 (contract alignment, 73 files), ad0e53485 (remaining typecheck fixes, 33 files). Removed dead sandbox module (no external callers). Working tree clean. Ready for next task. --- _Posted by **Beam from Anima La"
- [Issue] [#24](https://github.com/anlmalabs/airi/issues/24) `Devlog: Align fork with upstream for painless porting` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/anlmalabs/airi/issues/24#issuecomment-6474079282)):
  > "## Step 1 Audit Results (subagent findings) ### Transport contract - Our `packages/stage-shared/src/transport.ts` extends upstream with optional `capabilities`, `initialize`/`dispose`, `publish` - backward compatible (upstream shape is subset)"
- [Issue] [#24](https://github.com/anlmalabs/airi/issues/24) `Devlog: Align fork with upstream for painless porting` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/anlmalabs/airi/issues/24#issuecomment-6474229731)):
  > "Fixed companion.ts to safely call publish/broadcast with guards (removed non-null assertion). Made publishCompanionShare async."
- [Issue] [#24](https://github.com/anlmalabs/airi/issues/24) `Devlog: Align fork with upstream for painless porting` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/anlmalabs/airi/issues/24#issuecomment-6475843985)):
  > "## Final Summary ### Completed tonight - Step 1 (Audit): Transport, peers, nap-chat contracts audited via subagents."
- [Issue] [#24](https://github.com/anlmalabs/airi/issues/24) `Devlog: Align fork with upstream for painless porting` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/anlmalabs/airi/issues/24#issuecomment-6475846784)):
  > "## Final Summary ### Completed tonight - **Step 1 (Audit):** Transport, peers, nap-chat contracts audited via subagents. Results posted earlier."

### 🎯 Executive Highlights
Sister Fork Intelligence Briefing & Architectural Alignment:

• **Direct Maintainer Inquiry & Alignment Milestone (@7n1m4 ➔ @dasilva333)**:
  - **Milestone Devlog Kickoff (Issue #1 & Devlog #24)**: @7n1m4 announced a dedicated milestone on Issue #1 and opened Devlog Issue #24 ("Align fork with upstream for painless porting"), officially adopting dasilva333/airi as their upstream design baseline. Vi's autonomous subagents audited transport, peers, and nap-chat contracts to eliminate code silos while maintaining local-first sovereignty.
  - **Contract Parity Shipped via PR #25 (a639f80ab)**: 7n1m4 completed a sweeping 56-file synchronization (+8,644/-110 lines) cleanly landing peers vault sync, cadence delivery + classification, stickers + IS-Net background removal, composer draft bridge, message sanitization, compaction helpers, Ming 3.0 TTS adapters, and Cloudflare eventa/auth wrappers into 7n1m4/main.

• **Executive Highlights**:
  - **Full Upstream Contract Parity Achieved**: 7n1m4 successfully aligned their types, adapters, and stores with dasilva333/airi. By adopting upstream contracts verbatim, cross-fork cherry-picking and bidirectional patch porting can now occur with minimal rebasing friction.
  - **Sovereign UI Degradation in MessagingFriends.vue**: Rather than stripping upstream cloud UI surfaces, 7n1m4 added graceful runtime guards (isCloudAvailable with dynamic transportStatusSummary diagnostics, disabled embassy deployment warnings, and local mesh pairings) to enable a unified UI that functions seamlessly in both Cloudflare-connected and pure offline local-mesh environments.
  - **Agentic Companion Hardening (companion.ts:558)**: In apps/stage-tamagotchi/src/main/services/airi/agentic/companion.ts, 7n1m4 removed an unsafe non-null assertion on companionTransportAdapter.publish!(...), adding runtime guards for publish() with automatic fallback to broadcast(), and converted publishCompanionShare to an async pipeline.

• **Discussion Velocity**:
  - **Issue #17 (Cross-WAN Rendezvous)**: Continued automated CI discussion spike with +18 new comments (90 ➔ 108 total), monitoring automated multiaddr gossipsub mesh connectivity across WAN relays.
  - **Issue #1 (Permanent Roadmap)**: +4 new comments (22 ➔ 26 total) with Vi (@7n1m4) and @Beam reporting progress on contract alignment, clean typecheck passes, and milestone completion.
  - **Issue #24 (Fork-Upstream Alignment Devlog)**: Newly opened with 4 in-depth audit comments documenting exact subagent audit results, contract compatibility, and known intentional divergences.
  - **PR #25**: Merged rapidly after typecheck resolution, merging 56 files into 7n1m4/main.

• **Cherry-Pick Candidates**:
  - **TS7006 Catch-Clause Strictness (unknown annotations)**: Low-risk, high-value type safety improvement in attention-guard.ts, blip.ts, kokoro.ts, laya.ts, moondream.ts, web-llm.ts, web-rwkv.ts, whisper.ts (.catch((error: unknown) => {) and TraceEvent typing in perf-tracer-bridge.ts & markdown-stress.ts.
  - **Dynamic Diagnostics in MessagingFriends.vue**: The transportStatusSummary computed property cleanly reports observed transport states (Edge connected/standby/unavailable + mesh status + queue depth) rather than static strings.
  - **Quarantined Agentic Fix (companion.ts)**: The publish-guard and async broadcast fallback in publishCompanionShare is a necessary bugfix for when phase-2b-mesh-and-nap-chat.md is implemented in dasilva333/airi. (Cherry-Pick Policy: Keep quarantined until empirical mesh validation).

• **Collision Warnings**:
  - **System-1 Winnow vs Compaction (compaction.ts)**: 7n1m4's compaction.ts does not contain our live useSystemOneStore Winnow turn garbage collection loop. DO NOT overwrite packages/stage-ui/src/stores/chat/compaction.ts from 7n1m4, as it would drop our System-1 Winnow implementation.
  - **Inference Cache Utils (cache-utils.ts)**: 7n1m4 contains a stubbed evictOtherMing3Models that drops parameter inspection. Preserve our local implementation.
  - **Duplicate Return in companion.ts**: 7n1m4 introduced a benign duplicate return published line in publishCompanionShare that should be cleaned up if ever ported.

### 📋 7n1m4 Fork Commits
- `a639f80ab` feat: upstream contract alignment — peers, cadence, cloudflare, stickers, sandbox, perf/tracer, compaction (#25) [#25](https://github.com/7n1m4/airi/pull/25) _(ヴィオレット, 2026-10-28)_

### 🔬 Subsystem Breakdown
#### Electron Desktop Shell (`⚠️ hand-merge`) — 1 file(s) (+19/-10)
- `apps/stage-tamagotchi/src/main/services/airi/agentic/companion.ts` *(+19/-10)*

#### Other / Uncategorized (`🔍 inspect`) — 43 file(s) (+6883/-99)
- `packages/stage-shared/src/discord.ts` *(+167/-12)*
- `packages/stage-shared/src/index.ts` *(+1/-0)*
- `packages/stage-shared/src/peers-reconciler.test.ts` *(+53/-0)*
- `packages/stage-shared/src/peers-reconciler.ts` *(+82/-0)*
- `packages/stage-ui/src/components/modules/MessagingFriends.vue` *(+3/-2)*
- `packages/stage-ui/src/libs/cadence/classifier.test.ts` *(+293/-0)*
- `packages/stage-ui/src/libs/cadence/classifier.ts` *(+309/-0)*
- `packages/stage-ui/src/libs/cadence/index.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/cadence/mapping.test.ts` *(+100/-0)*
- `packages/stage-ui/src/libs/cadence/mapping.ts` *(+72/-0)*
- `packages/stage-ui/src/libs/inference/adapters/attention-guard.ts` *(+3/-3)*
- `packages/stage-ui/src/libs/inference/adapters/background-removal.ts` *(+10/-14)*
- `packages/stage-ui/src/libs/inference/adapters/blip.ts` *(+3/-3)*
- `packages/stage-ui/src/libs/inference/adapters/kokoro.test.ts` *(+1/-1)*
- `packages/stage-ui/src/libs/inference/adapters/kokoro.ts` *(+3/-3)*
- `packages/stage-ui/src/libs/inference/adapters/laya.ts` *(+3/-3)*
- `packages/stage-ui/src/libs/inference/adapters/ming3.ts` *(+543/-0)*
- `packages/stage-ui/src/libs/inference/adapters/moondream.ts` *(+3/-3)*
- `packages/stage-ui/src/libs/inference/adapters/web-llm.ts` *(+3/-3)*
- `packages/stage-ui/src/libs/inference/adapters/web-rwkv.ts` *(+3/-3)*
- `packages/stage-ui/src/libs/inference/adapters/whisper.ts` *(+3/-3)*
- `packages/stage-ui/src/libs/inference/cache-utils.ts` *(+7/-0)*
- `packages/stage-ui/src/libs/inference/constants.ts` *(+1/-0)*
- `packages/stage-ui/src/libs/stickers/image-convert.test.ts` *(+117/-0)*
- `packages/stage-ui/src/libs/stickers/image-convert.ts` *(+116/-0)*
- `packages/stage-ui/src/services/speech/bus.ts` *(+26/-0)*
- `packages/stage-ui/src/stores/cadence-delivery.test.ts` *(+121/-0)*
- `packages/stage-ui/src/stores/cadence-delivery.ts` *(+625/-0)*
- `packages/stage-ui/src/stores/markdown-stress.ts` *(+1/-1)*
- `packages/stage-ui/src/stores/mcp-web-config.ts` *(+59/-0)*
- `packages/stage-ui/src/stores/modules/cloudflare-auth.test.ts` *(+219/-0)*
- `packages/stage-ui/src/stores/modules/cloudflare-auth.ts` *(+221/-0)*
- `packages/stage-ui/src/stores/modules/cloudflare-persistence.test.ts` *(+455/-0)*
- `packages/stage-ui/src/stores/modules/cloudflare.ts` *(+1444/-26)*
- `packages/stage-ui/src/stores/modules/cors-proxy-worker-script.test.ts` *(+347/-0)*
- `packages/stage-ui/src/stores/modules/cors-proxy-worker-script.ts` *(+602/-0)*
- `packages/stage-ui/src/stores/modules/text-to-motion.test.ts` *(+65/-0)*
- `packages/stage-ui/src/stores/peers.test.ts` *(+82/-0)*
- `packages/stage-ui/src/stores/peers.ts` *(+17/-2)*
- `packages/stage-ui/src/stores/perf-tracer-bridge.ts` *(+1/-1)*
- `packages/stage-ui/src/stores/settings/control-strip.test.ts` *(+40/-0)*
- `packages/stage-ui/src/stores/stickers.test.ts` *(+267/-0)*
- `packages/stage-ui/src/stores/stickers.ts` *(+391/-16)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 2 file(s) (+55/-0)
- `packages/stage-ui-live2d/src/stores/dsl-snapshot.ts` *(+54/-0)*
- `packages/stage-ui-live2d/src/stores/index.ts` *(+1/-0)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 8 file(s) (+1415/-1)
- `packages/stage-ui/src/stores/chat/compaction.test.ts` *(+211/-0)*
- `packages/stage-ui/src/stores/chat/compaction.ts` *(+93/-1)*
- `packages/stage-ui/src/stores/chat/composer-draft-bridge.test.ts` *(+17/-0)*
- `packages/stage-ui/src/stores/chat/composer-draft-bridge.ts` *(+47/-0)*
- `packages/stage-ui/src/stores/chat/message-sanitizer.test.ts` *(+88/-0)*
- `packages/stage-ui/src/stores/chat/message-sanitizer.ts` *(+84/-0)*
- `packages/stage-ui/src/stores/memory-lifetime.incremental.test.ts` *(+634/-0)*
- `packages/stage-ui/src/stores/memory-text-journal.background-index.test.ts` *(+241/-0)*

#### Provider & Model Integrations (`📦 import / inspect`) — 2 file(s) (+272/-0)
- `packages/stage-ui/src/stores/providers/ming3-audio-utils.ts` *(+77/-0)*
- `packages/stage-ui/src/stores/providers/ming3-catalog.ts` *(+195/-0)*

### 📬 7n1m4 Fork Activity Radar
#### 🆕 New Items Opened (2)
- [PR] [#25](https://github.com/anlmalabs/airi/pull/25) `feat: upstream contract alignment — peers, cadence, cloudflare, stickers, sandbox, perf/tracer, compaction` by **@7n1m4** *(0 comments)*
- [Issue] [#24](https://github.com/anlmalabs/airi/issues/24) `Devlog: Align fork with upstream for painless porting` by **@7n1m4** *(4 comments)*

#### 💬 Discussion Activity (2)
- [Issue] [#17](https://github.com/anlmalabs/airi/issues/17) `[CI] Cross-WAN rendezvous (auto-managed, do not close)` — *+18 comments (90 ➔ 108 total)*
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — *+4 comments (22 ➔ 26 total)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/anlmalabs/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/anlmalabs/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/anlmalabs/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `roadmap (permanent):  libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` [OPEN] — 🚨 **+4 comments** (26 total)
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/anlmalabs/airi/issues/4) `Phase 3: Agentic OS Integration` [CLOSED] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
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
