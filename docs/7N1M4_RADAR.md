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
