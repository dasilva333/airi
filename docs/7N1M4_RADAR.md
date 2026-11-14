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

## [2026-11-13] 7n1m4 Fork Delta: `bee21ea5..b208f045` (74 commits, 2854 files, 10 update(s))

### 🚨 Action Required: Direct Mentions & Maintainer Inquiries
- [Issue] [#1](https://github.com/7n1m4/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/7n1m4/airi/issues/1#issuecomment-6382505252)):
  > "@dasilva333  — thank you for putting together such a comprehensive blueprint! Having reviewed it end-to-end, the proposed 4-layer inversion aligns perfectly with our architecture and integrates seamlessly into the components we have already deployed without any structural rework. ### Architecture Ma"
- [Issue] [#1](https://github.com/7n1m4/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** **(Pending Reply)** ([view comment](https://github.com/7n1m4/airi/issues/1#issuecomment-6442783645)):
  > "Phase 6 PR 1 landed: ported `packages/stage-shared/src/peers.ts` (+12 tests) as the Universal Friends & Peers domain substrate. Transport-agnostic, sovereign-adapted (libp2p multiaddrs, no Cloudflare relay). PR: https://github.com/dasilva333/airi/pull/30. Next: reconciler (libp2p-based same-account "
- [Issue] [#1](https://github.com/7n1m4/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@anlmabot** **(Pending Reply)** ([view comment](https://github.com/7n1m4/airi/issues/1#issuecomment-6453934222)):
  > "## 2026-10-28 — feat/nap-chat-substrate-unify (PR #22) Opened PR #22 unifying fork nap-chat substrate onto upstream (dasilva333/airi) design to eliminate code silos. Shipped on branch `feat/nap-chat-substrate-unify` (commit b23152b4a):"
- [Issue] [#1](https://github.com/7n1m4/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/7n1m4/airi/issues/1#issuecomment-6473559133)):
  > "--- ## Milestone: Fork-upstream alignment (devlog #24) We’re kicking off a focused effort to stay closely aligned with upstream (dasilva333/airi) for painless porting of features/improvements."
- [Issue] [#1](https://github.com/7n1m4/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/7n1m4/airi/issues/1#issuecomment-6476456954)):
  > "Progress checkpoint summary: - Ported peers vault sync (peers-reconciler + store methods) committed as b99f02811. - Restored peers tests."
- [Issue] [#1](https://github.com/7n1m4/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/7n1m4/airi/issues/1#issuecomment-6477119522)):
  > "Upstream contract alignment progress: ported peers vault sync, cadence delivery + libs + speech bus, dsl-snapshot, composer-draft-bridge, message-sanitizer, compaction exports, cloudflare-auth + cors-proxy-worker-script, stickers + image-convert + background-removal, sandbox libs, ming3, perf/tracer"
- [Issue] [#1](https://github.com/7n1m4/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — Comment by **@7n1m4** **(Pending Reply)** ([view comment](https://github.com/7n1m4/airi/issues/1#issuecomment-6477379397)):
  > "Typecheck clean (exit 0). All upstream contract alignment work complete. Commits: ba2d6c370 (contract alignment, 73 files), ad0e53485 (remaining typecheck fixes, 33 files). Removed dead sandbox module (no external callers). Working tree clean. Ready for next task. --- _Posted by **Beam from Anima La"

### 🎯 Executive Highlights
Sister Fork Intelligence Briefing — Daemon Gateway Pivot & Hardening Sweep:

• **Executive Highlights**:
  - **Daemon-Hosted Gateway Architecture (`airi-daemon` / `airi-channel`)**: Completed Increment 2 of runtime unification where `airi-daemon` hosts the central control plane gateway (`ws/wss` via locally minted CA) and exposes read-only `core.status`. Control plane wire DTOs are Rust-canonical and exported to TypeScript.
  - **Dual Framework Pivot — Qt Purged for Slint; Tamagotchi Moved to Electrobun 2**: After 13 waves of Qt Quick 3D development, 7n1m4 abandoned Qt completely (`apps/stage-qt` deleted, references purged) and ported all 27 bridges to Slint (`airi-slint`). Concurrently, `stage-tamagotchi` was migrated from Electron to Electrobun 2 (`bf85fb521`), and Capacitor (`stage-pocket`) was excised.
  - **Cloud Sync Hardening & Tombstone Deletion Protocol**: Introduced `sync-tombstones.ts` (LWW tombstones preventing deleted messages/memories from resurrecting on sync), `sync-lease.ts` (cross-window multi-tab sync election), and pending-write replays during import windows.
  - **Security & Secret Quarantine Sweep**: CSRF origin checks on `/api/*`, pooled provider secrets stripped on GET, non-loopback WebSocket LAN connections auto-upgraded to WSS to prevent token sniffing, and single-instance locks hardened.

• **Discussion Velocity**:
  - **10 New PRs Opened (#39–#48)**: High internal agentic velocity with 0 external comments. PRs #39–#43 already merged (hardening, app restructuring, DB untracking), while PRs #44–#48 drive the daemon runtime pivot and Rust gateway client.
  - **Issue #1 ([Roadmap])**: Stable at 34 comments; previous maintainer inquiries acknowledged.
  - **Issue #4 (Phase 3: Agentic OS Integration)**: Formally closed.

• **Cherry-Pick Candidates**:
  - **Cloud Sync Tombstones (`packages/stage-ui/src/stores/sync-tombstones.ts`, `sync-engine-merge.ts`, `e47eef3c5`)**: High-value, self-contained LWW deletion tracking preventing union-by-id resurrection of chat sessions and memories (58 unit tests).
  - **Cross-Window Sync Lease (`packages/stage-ui/src/stores/sync-lease.ts`, `f15de4266`)**: Elegantly resolves multi-window localStorage write collision races during cloud sync.
  - **Server CSRF & Secret Stripping (`apps/server/src/middlewares/require-origin.ts`, `services/providers.ts`, `c7c82ed09`)**: Critical security middleware blocking cross-site mutations and stripping pooled API secrets.
  - **LAN WSS Fail-Closed Guard & Devtools Token Redaction (`e05cc5fe0`)**: Auto-rewrites non-loopback `ws://` to `wss://` and redacts bearer tokens in the devtools WebSocket inspector.
  - **Shell i18n Translations (`packages/i18n/src/locales/*/shell.yaml`)**: Additive 1,195-line shell localization dictionaries across 10 languages.

• **Collision Warnings**:
  - **Electrobun 2 & Slint Architectural Incompatibilities**: `dasilva333/airi` relies on the stable Electron desktop runtime and Web/Tauri architecture. Do NOT adopt Electrobun or Slint infrastructure.
  - **Daemon-Hosted Gateway Inversion**: Centralizes state in a Rust daemon, breaking our browser-first and offline-first standalone app topology.
  - **Massive Repository Purge (`82edd4071`)**: Purged 524k lines of memory-lab benchmark datasets and test traces. Do not merge or rebase.
  - **Strict Ban on Blind Vibe-Code Adoption**: As per radar policy, all candidate logic must undergo manual empirical validation prior to cherry-picking.

### 📋 7n1m4 Fork Commits
- `b208f045f` feat(airi-daemon): own core state, expose read-only core.status over the gateway  _(7n1m4, 2026-11-13)_
- `cdef784a2` feat(airi-channel): add synchronous gateway client  _(7n1m4, 2026-11-13)_
- `5f25cc395` bd init: initialize beads issue tracking  _(7n1m4, 2026-11-13)_
- `cd20e232d` chore(airi-daemon): drop unused AUDIT_FILE_NAME re-export  _(7n1m4, 2026-11-13)_
- `2704013a3` refactor(airi-slint): single load_section/save_section in bridges::mod  _(7n1m4, 2026-11-13)_
- `dbbbd5b52` refactor(rust): share the audit-log contract via airi-channel  _(7n1m4, 2026-11-13)_
- `2bd4f3336` refactor(rust): hoist shared slint bridge helpers into airi-core  _(7n1m4, 2026-11-13)_
- `409aaf063` docs: de-age pivot docs; keep facts topology-focused, not dated  _(7n1m4, 2026-11-13)_
- `c7c82ed09` fix(server): CSRF origin check; system provider configs never leak secrets  _(7n1m4, 2026-11-13)_
- `f15de4266` feat(stage-ui): cross-window reconcile/outbox lease; drop stale etags  _(7n1m4, 2026-11-13)_
- `94e9dbda7` fix(airi-slint): clear_audit archives the audit log instead of truncating  _(7n1m4, 2026-11-13)_
- `b6e9dd58f` fix(tamagotchi): collapse boot-time double ApplyGatewayConfig  _(7n1m4, 2026-11-13)_
- `c4548f695` fix(tamagotchi): restart on rotation; honest binds; apply errors surface  _(7n1m4, 2026-11-13)_
- `e05cc5fe0` fix(stage-ui): no cleartext tokens on LAN; redact authenticate payload  _(7n1m4, 2026-11-13)_
- `ef8642ce3` feat(stage-ui): replay writes made during the sync import window; bridge-key secrets  _(7n1m4, 2026-11-13)_
- `f86ae1b83` fix(airi-daemon,airi-channel): dead peers, lockdown races, apply honesty, redactor  _(7n1m4, 2026-11-13)_
- `32c4834b0` fix(server): harden PATCH, sync, auth boot and container defaults  _(7n1m4, 2026-11-13)_
- `7cfa8253f` fix(stage-ui): close sync credential/tombstone/loss gaps  _(7n1m4, 2026-11-13)_
- `e47eef3c5` feat(stage-ui): tombstone-aware sync merge — deletions survive cloud sync  _(7n1m4, 2026-11-13)_
- `85afedca9` feat(airi-channel): dead-peer TTL reaps silent gateway connections  _(7n1m4, 2026-11-13)_
- `50a75ed78` fix(stage-pages): i18n the WebSocket URL description and connection keys  _(7n1m4, 2026-11-13)_
- `5137559e3` docs: pivot state of affairs; daemon-era gateway manual; catalog keys  _(7n1m4, 2026-11-13)_
- `e2cafc571` ci: run cargo test --workspace --locked as a gate  _(7n1m4, 2026-11-13)_
- `d017eeb9f` fix(server): production CORS origin, session cookieCache, fail-fast secret, opt-in PGlite  _(7n1m4, 2026-11-13)_
- `23ab0ecba` docs: under-construction banner; pivot status; Electrobun/runtime fixes  _(7n1m4, 2026-11-13)_
- `755c35548` feat(stage-ui): derive ws/wss from the daemon TLS flag; close secret-sync leaks  _(7n1m4, 2026-11-13)_
- `feb5a1e77` feat(stage-tamagotchi): daemon-backed gateway bridge with in-app fallback  _(7n1m4, 2026-11-13)_
- `b473f4428` feat(gateway): Rust-canonical control-plane DTOs exported to TS  _(7n1m4, 2026-11-13)_
- `4a222b60e` chore: untrack dev database cluster and local agent notes (#43) [#43](https://github.com/7n1m4/airi/pull/43) _(ヴィオレット, 2026-11-13)_
- `82edd4071` fix: repo audit hardening pass  _(7n1m4, 2026-11-13)_
- `58ddf7515` feat(airi-daemon): host the gateway (ws/wss) with a locally minted CA  _(7n1m4, 2026-11-13)_
- `1f81de958` feat(airi-channel): make wire types Rust-canonical and export them to TS  _(7n1m4, 2026-11-13)_
- `e3ca96a20` chore: purge stage-pocket (Capacitor) in favor of a unified Rust native app  _(7n1m4, 2026-11-13)_
- `ede5be1da` refactor: excise Capacitor and cap-vite from the workspace  _(7n1m4, 2026-11-13)_
- `b429ccee6` fix(stage-tamagotchi): repair JSDoc mangled by the pre-commit hook  _(7n1m4, 2026-11-13)_
- `5a9062647` feat(stage-tamagotchi): wire the renderer bridge; make main↔view RPC work  _(7n1m4, 2026-11-13)_
- `8bd89c01e` docs: pivot architecture README and archive stale proposals  _(7n1m4, 2026-11-13)_
- `b4f70f076` feat(airi-slint): open the shell windows on the Slint event loop  _(7n1m4, 2026-11-13)_
- `37fed1f3a` chore: archive the Qt port docs and delete committed build logs  _(7n1m4, 2026-11-13)_
- `44bd19917` fix(stage-tamagotchi): force h3/srxv onto the Bun adapters so WebSocket upgrades work  _(7n1m4, 2026-11-13)_
- `bf85fb521` feat(stage-tamagotchi): port the desktop app from Electron to Electrobun 2  _(7n1m4, 2026-11-13)_
- `26674842c` chore: purge Qt references from the sibling crates' docs  _(7n1m4, 2026-11-13)_
- `822a0c976` chore: purge the last Qt artifacts from the tree  _(7n1m4, 2026-11-13)_
- `d69b3744e` fix(airi-slint): repair the last bridge defects found by the test suite  _(7n1m4, 2026-11-13)_
- `e48dfaf58` feat(airi-slint): complete the bridge port — all 27 Qt bridges on Slint  _(7n1m4, 2026-11-13)_
- `4204bec19` feat(airi-slint): port the desktop, discord gateway and MCP bridges  _(7n1m4, 2026-11-13)_
- `955b8932b` feat(airi-slint): port the remaining bridges and wire them into the module tree  _(7n1m4, 2026-11-13)_
- `85b3bfcbc` test(airi-slint): fix the settings bridge tests  _(7n1m4, 2026-11-13)_
- `d337b89d8` feat(airi-slint): port 20 of the Qt bridges to Slint  _(7n1m4, 2026-11-13)_
- `cdf0ff2a8` chore(airi-slint): drop the Qt QML sources  _(7n1m4, 2026-11-13)_
- `1a31e9cf0` chore(airi-slint): retarget the Qt port to Slint (rename + spine render seam)  _(7n1m4, 2026-11-13)_
- `6eb33e938` chore: move Qt app out of apps/ to the repo root (#41) [#41](https://github.com/7n1m4/airi/pull/41) _(ヴィオレット, 2026-11-13)_
- `41af4ef29` chore: remove Stage-Mate and stage-qt native apps (#40) [#40](https://github.com/7n1m4/airi/pull/40) _(ヴィオレット, 2026-11-12)_
- `772bb2d1a` fix: post-audit hardening sweep (27 findings) (#39) [#39](https://github.com/7n1m4/airi/pull/39) _(ヴィオレット, 2026-11-12)_
- `622f6c085` wip: some patches  _(7n1m4, 2026-11-12)_
- `850b6486d` WIP: wave P4a — system-bus unit-failure watch + wake briefing (opt-in)  _(7n1m4, 2026-11-12)_
- `f64968fc4` WIP: wave P3 (slice 1) — portal screenshot path  _(7n1m4, 2026-11-12)_
- `22c48d908` WIP: wave P2 — AT-SPI screen awareness (opt-in, local-only)  _(7n1m4, 2026-11-12)_
- `1fbd56cae` WIP: wave P1 — user-session awareness daemon + Qt surface  _(7n1m4, 2026-11-12)_
- `4ed98b7ce` WIP: wave ⑬ — memory wired into chat end-to-end (opt-in)  _(7n1m4, 2026-11-12)_
- `c0225a9d0` WIP: wave ⑫ — GUI-thread gateway dispatch (opt-in agent actions on the session)  _(7n1m4, 2026-11-12)_
- `c740f53a9` WIP: wave ⑪ — record 2026-11-12 approvals (wave order ⑫→⑬→P1; research posture adopted)  _(7n1m4, 2026-11-12)_
- `9824713f5` WIP: wave ⑪ — module services (memory/speech/hearing/modules/card export)  _(7n1m4, 2026-11-12)_
- `f2b749e2a` WIP: wave ⑩c — settings cuts (onboarding v2, Gemini notice)  _(7n1m4, 2026-11-12)_
- `9666d185b` WIP: wave ⑩b — MCP-HTTP bearer auth (lane C1)  _(7n1m4, 2026-11-12)_
- `eee8ef95c` WIP: wave ⑩ — v1 waivers, cutover decisions, dev-release groundwork  _(7n1m4, 2026-11-12)_
- `7ebe41a92` WIP: wave ⑨ batch — MMD M1, Discord receive, cutover groundwork, default-profile fix  _(7n1m4, 2026-11-11)_
- `a5a5f182b` WIP: wave ⑧ batch — wiring wave (backends -> Qt UI), user decisions applied  _(7n1m4, 2026-11-11)_
- `c110bb61d` WIP: wave ⑦ batch — backend lanes I1–I5 + MMD M0 (lane J1)  _(7n1m4, 2026-11-11)_
- `9a1a927d5` Manifest: waive the devtools family for Qt v1 (user decision)  _(7n1m4, 2026-11-11)_
- `780bee27b` WIP: wave ⑥ batch — ACP HITL bridge + Agents page, gateway --gateway flag, screen capture (vision slice)  _(7n1m4, 2026-11-10)_
- `2c37cc936` WIP: wave ⑤ batch — ACP agents, channel server, Cloud Sync/Plugin Host pages, MCP bridge wired  _(7n1m4, 2026-11-10)_
- `f9d2441d2` WIP: wave ④ delegation batch — MCP client, MMD M0, Discord/MCP pages, manifest audit  _(7n1m4, 2026-11-10)_
- `e8da8c178` WIP: AIRI Qt (Rust + Qt Quick) rewrite — P0 through P9 wave ④  _(7n1m4, 2026-11-10)_

### 🔬 Subsystem Breakdown
#### Documentation & Scaffolding (`⚪ ignore`) — 196 file(s) (+17763/-6753)
- `.agents/skills/airi-acting-cue-act-tokens/SKILL.md` *(+1/-1)*
- `.agents/skills/airi-caption-subsystem/SKILL.md` *(+8/-18)*
- `.agents/skills/airi-controlstrip-customizer/SKILL.md` *(+2/-2)*
- `.agents/skills/airi-gateway-websocket-protocol/SKILL.md` *(+4/-3)*
- `.agents/skills/airi-modular-outfits-system/SKILL.md` *(+3/-8)*
- `.agents/skills/airi-release-packaging-deploy/SKILL.md` *(+7/-36)*
- `.agents/skills/airi-roadmap-upstream-research/SKILL.md` *(+2/-2)*
- `.agents/skills/airi-stage-mate-unity/SKILL.md` *(+0/-144)*
- `.agents/skills/airi-stage-ui-surfaces/SKILL.md` *(+11/-11)*
- `.agents/skills/beads/SKILL.md` *(+80/-0)*
- `.beads/README.md` *(+81/-0)*
- `.github/CONTRIBUTING.md` *(+9/-94)*
- `.github/workflows/ci-linux-window-smoke.yml` *(+77/-111)*
- `.github/workflows/ci.yml` *(+48/-5)*
- `AGENTS.md` *(+100/-13)*
- `CLAUDE.md` *(+1/-1)*
- `COMPARISONS.md` *(+3/-5)*
- `README.md` *(+23/-30)*
- `apps/stage-mate/README.md` *(+0/-163)*
- `apps/stage-mate/project-structure.md` *(+0/-92)*
- `apps/stage-mate/unity-src/EXTERNAL_ASSETS.md` *(+0/-54)*
- `apps/stage-mate/unity-src/README.md` *(+0/-11)*
- `apps/stage-qt/README.md` *(+0/-52)*
- `crates/airi-llm/README.md` *(+77/-0)*
- `crates/airi-mmd/README.md` *(+60/-0)*
- `crates/airi-speech/README.md` *(+103/-0)*
- `crates/airi-stt/README.md` *(+162/-0)*
- `docs/README.md` *(+127/-0)*
- `docs/UPSTREAM_RADAR.md` *(+9/-7)*
- `docs/Untitled.canvas` *(+0/-5)*
- `docs/arch-mcp-integration.md` *(+10/-12)*
- `docs/{ => archive}/AIRI-Mind-Map-Design-Review.md` *(+0/-0)*
- `docs/archive/README.md` *(+20/-0)*
- `docs/{ => archive}/architecture-chat-orchestrator-decomposition.md` *(+0/-0)*
- `docs/{ => archive}/design-actor-token-sync-postmortem.md` *(+0/-0)*
- `docs/{ => archive}/design-expression-emoji-mapping.md` *(+0/-0)*
- `docs/{ => archive}/design-tamagotchi-chatbox-ux-improvements.md` *(+0/-0)*
- `docs/{ => archive}/orbital-settings-topology-handoff.md` *(+0/-0)*
- `docs/{ => archive}/project-mobile-revamp.md` *(+2/-0)*
- `docs/{ => archive}/project-positioning-store-migration.md` *(+0/-0)*
- `docs/{ => archive}/proposal-acting-sidebar.md` *(+0/-0)*
- `docs/archive/qt-port/p10-lane-mmd-m0.md` *(+230/-0)*
- `docs/archive/qt-port/p10-lane-mmd-m1.md` *(+694/-0)*
- `docs/archive/qt-port/p10-lane-mmd.md` *(+194/-0)*
- `docs/archive/qt-port/p10-mmd-design.md` *(+153/-0)*
- `docs/archive/qt-port/p11-audit.md` *(+439/-0)*
- `docs/archive/qt-port/p11-lane-card-export.md` *(+195/-0)*
- `docs/archive/qt-port/p11-lane-hearing.md` *(+237/-0)*
- `docs/archive/qt-port/p11-lane-memory.md` *(+277/-0)*
- `docs/archive/qt-port/p11-lane-modules.md` *(+311/-0)*
- `docs/archive/qt-port/p11-lane-speech.md` *(+225/-0)*
- `docs/archive/qt-port/p11-parity-design.md` *(+140/-0)*
- `docs/archive/qt-port/p11-wave11-module-services.md` *(+31/-0)*
- `docs/archive/qt-port/p12-cutover-plan.md` *(+203/-0)*
- `docs/archive/qt-port/p12-lane-gui-thread-dispatch.md` *(+254/-0)*
- `docs/archive/qt-port/p12-system-embedding-research.md` *(+1252/-0)*
- `docs/archive/qt-port/p13-lane-memory-wiring.md` *(+338/-0)*
- `docs/archive/qt-port/p14-lane-awareness-page.md` *(+292/-0)*
- `docs/archive/qt-port/p14-lane-daemon-crate.md` *(+399/-0)*
- `docs/archive/qt-port/p14-wave-p1-summary.md` *(+51/-0)*
- `docs/archive/qt-port/p15-lane-awareness-screen.md` *(+289/-0)*
- `docs/archive/qt-port/p15-lane-screen-awareness.md` *(+419/-0)*
- `docs/archive/qt-port/p15-wave-p2-summary.md` *(+71/-0)*
- `docs/archive/qt-port/p16-lane-portal-screenshot.md` *(+298/-0)*
- `docs/archive/qt-port/p16-wave-p3-summary.md` *(+39/-0)*
- `docs/archive/qt-port/p17-lane-systemd-watch.md` *(+284/-0)*
- `docs/archive/qt-port/p17-wave-p4a-summary.md` *(+63/-0)*
- `docs/archive/qt-port/p18-qt-to-slint-retarget.md` *(+101/-0)*
- `docs/archive/qt-port/p2-wave-b-chat.md` *(+38/-0)*
- `docs/archive/qt-port/p2-wave-b-providers.md` *(+60/-0)*
- `docs/archive/qt-port/p3-p4-merge.md` *(+52/-0)*
- `docs/archive/qt-port/p3-stage-settings.md` *(+62/-0)*
- `docs/archive/qt-port/p4-spine.md` *(+95/-0)*
- `docs/archive/qt-port/p5-stt.md` *(+68/-0)*
- `docs/archive/qt-port/p5-tts.md` *(+128/-0)*
- `docs/archive/qt-port/p6-render-pages.md` *(+74/-0)*
- `docs/archive/qt-port/p6a-nav-system-pages.md` *(+53/-0)*
- `docs/archive/qt-port/p7-memory-journal.md` *(+200/-0)*
- `docs/archive/qt-port/p7-retrieval.md` *(+108/-0)*
- `docs/archive/qt-port/p8-tray-hotkeys.md` *(+89/-0)*
- `docs/archive/qt-port/p9-card-wave2.md` *(+64/-0)*
- `docs/archive/qt-port/p9-kokoro.md` *(+39/-0)*
- `docs/archive/qt-port/p9-lane-acp-agents.md` *(+206/-0)*
- `docs/archive/qt-port/p9-lane-acp-hitl.md` *(+515/-0)*
- `docs/archive/qt-port/p9-lane-acp-sessions.md` *(+262/-0)*
- `docs/archive/qt-port/p9-lane-channel-renderer.md` *(+91/-0)*
- `docs/archive/qt-port/p9-lane-channel-rpc.md` *(+95/-0)*
- `docs/archive/qt-port/p9-lane-channel-server.md` *(+99/-0)*
- `docs/archive/qt-port/p9-lane-cloud-sync.md` *(+239/-0)*
- `docs/archive/qt-port/p9-lane-data-backend.md` *(+47/-0)*
- `docs/archive/qt-port/p9-lane-discord-gateway-wire.md` *(+236/-0)*
- `docs/archive/qt-port/p9-lane-discord-gateway-ws.md` *(+174/-0)*
- `docs/archive/qt-port/p9-lane-discord-gateway.md` *(+127/-0)*
- `docs/archive/qt-port/p9-lane-discord-page.md` *(+174/-0)*
- `docs/archive/qt-port/p9-lane-discord.md` *(+193/-0)*
- `docs/archive/qt-port/p9-lane-mcp-client.md` *(+156/-0)*
- `docs/archive/qt-port/p9-lane-mcp-http-auth.md` *(+267/-0)*
- `docs/archive/qt-port/p9-lane-mcp-http.md` *(+193/-0)*
- `docs/archive/qt-port/p9-lane-mcp-page.md` *(+177/-0)*
- `docs/archive/qt-port/p9-lane-plugin-host.md` *(+177/-0)*
- `docs/archive/qt-port/p9-lane-screen-capture.md` *(+175/-0)*
- `docs/archive/qt-port/p9-lane-sync-page.md` *(+326/-0)*
- `docs/archive/qt-port/p9-lane-sync.md` *(+256/-0)*
- `docs/archive/qt-port/p9-laneA-onboarding.md` *(+399/-0)*
- `docs/archive/qt-port/p9-laneB-data.md` *(+254/-0)*
- `docs/archive/qt-port/p9-laya.md` *(+56/-0)*
- `docs/archive/qt-port/p9-llama.md` *(+166/-0)*
- `docs/archive/qt-port/p9-wave10-decisions.md` *(+90/-0)*
- `docs/archive/qt-port/p9-wave3-integration.md` *(+46/-0)*
- `docs/archive/qt-port/p9-wave4-delegation.md` *(+36/-0)*
- `docs/archive/qt-port/p9-wave5-delegation.md` *(+40/-0)*
- `docs/archive/qt-port/p9-wave6-delegation.md` *(+46/-0)*
- `docs/archive/qt-port/p9-wave7-delegation.md` *(+50/-0)*
- `docs/archive/qt-port/p9-wave8-delegation.md` *(+40/-0)*
- `docs/archive/qt-port/p9-wave9-delegation.md` *(+42/-0)*
- `docs/archive/qt-port/p9-whisper.md` *(+45/-0)*
- `docs/{ => archive}/sentence-sync-streaming-tts-architecture-review.md` *(+0/-0)*
- `docs/catalog-control-strip.md` *(+1/-2)*
- `docs/content/en/docs/chronicles/feature-report.md` *(+5/-22)*
- `docs/content/en/docs/chronicles/roadmap.md` *(+1/-2)*
- `docs/content/en/docs/contributing/macos-release-guide.md` *(+2/-1)*
- `docs/content/en/docs/contributing/windows-release-guide.md` *(+0/-24)*
- `docs/content/en/docs/manual/config/gateway.md` *(+32/-27)*
- `docs/data-catalog.md` *(+25/-2)*
- `docs/design-airi-card.md` *(+1/-1)*
- `docs/design-daemon-client.md` *(+37/-0)*
- `docs/design-daemon-core-rpc.md` *(+133/-0)*
- `docs/design-daemon-gateway.md` *(+177/-0)*
- `docs/design-electrobun-port.md` *(+265/-0)*
- `docs/design-embedding-provider-support.md` *(+1/-1)*
- `docs/design-engine-sidecar-journal.md` *(+0/-1042)*
- `docs/design-idle-animation.md` *(+7/-53)*
- `docs/design-journal-actor-token-sync.md` *(+1/-1)*
- `docs/design-mate-engine-navigation-guide.md` *(+0/-534)*
- `docs/design-mate-scene-hierarchy.md` *(+0/-1795)*
- `docs/design-needle-subconscious-runtime.md` *(+1/-1)*
- `docs/design-plugin-architecture.md` *(+1/-1)*
- `docs/design-stage-radial-menu.md` *(+8/-19)*
- `docs/design-stagemate-companion-runtime.md` *(+0/-124)*
- `docs/design-text-to-motion.md` *(+1/-1)*
- `docs/design-vrm-outfits.md` *(+0/-468)*
- `docs/port-manifest/electron-services.md` *(+181/-0)*
- `docs/port-manifest/features.md` *(+255/-0)*
- `docs/port-manifest/features.ticks.json` *(+35/-0)*
- `docs/port-manifest/features.waivers.json` *(+87/-0)*
- `docs/port-manifest/i18n-keys.md` *(+120/-0)*
- `docs/port-manifest/ipc-channels.md` *(+285/-0)*
- `docs/port-manifest/providers.md` *(+49/-0)*
- `docs/port-manifest/settings-panels.md` *(+164/-0)*
- `docs/port-manifest/speech.md` *(+33/-0)*
- `docs/port-manifest/stores.md` *(+225/-0)*
- `docs/port-manifest/windows.md` *(+81/-0)*
- `docs/project-companion-comparisons.md` *(+0/-792)*
- `docs/project-gunslinger-sidecar-mod.md` *(+0/-184)*
- `docs/project-selective-upstream-sync-protocol.md` *(+2/-2)*
- `docs/project-specialized-skills.md` *(+10/-10)*
- `docs/project-testing-parity.md` *(+8/-3)*
- `docs/proposal-core-agent-revamp.md` *(+1/-1)*
- `docs/proposal-generic-gaming-agent-runtime.md` *(+2/-2)*
- `docs/proposal-jev-integration.md` *(+2/-2)*
- `docs/proposal-ninja-swap-interceptor.md` *(+2/-2)*
- `docs/proposal-plugin-ecosystem-and-community-registry.md` *(+1/-1)*
- `docs/proposal-text-to-vrma-system.md` *(+1/-1)*
- `docs/proposal-unified-rust-native-app.md` *(+38/-0)*
- `docs/rosetta-stone.md` *(+13/-5)*
- `macos_compatibility_problems.md` *(+0/-25)*
- `memory/2026-05-24.md` *(+0/-20)*
- `packages/cap-vite/README.md` *(+0/-61)*
- `packages/drizzle-duckdb-wasm/README.md` *(+0/-3)*
- `packages/duckdb-wasm/README.md` *(+0/-3)*
- `apps/stage-qt/LICENSE => packaging/LICENSE.txt` *(+0/-0)*
- `packaging/README.md` *(+140/-0)*
- `reports/implementation_plan.md` *(+0/-22)*
- `reports/installation_report.md` *(+0/-66)*
- `reports/live2d_package_metadata_report.md` *(+0/-148)*
- `reports/memory-lab/locomo-conv47-jev-report.md` *(+0/-20)*
- `reports/memory-lab/locomo-conv47-pass10-anaphora-report.md` *(+0/-29)*
- `reports/memory-lab/locomo-conv47-pass11-jev-report.md` *(+0/-28)*
- `reports/memory-lab/locomo-conv47-pass11-laya-report.md` *(+0/-28)*
- `reports/memory-lab/locomo-conv47-pass2-report.md` *(+0/-35)*
- `reports/memory-lab/locomo-conv47-pass3-report.md` *(+0/-25)*
- `reports/memory-lab/locomo-conv47-pass4-report.md` *(+0/-26)*
- `reports/memory-lab/locomo-conv47-pass5-report.md` *(+0/-27)*
- `reports/memory-lab/locomo-conv47-pass6-report.md` *(+0/-28)*
- `reports/memory-lab/locomo-conv47-pass7-report.md` *(+0/-29)*
- `reports/memory-lab/locomo-conv47-pass8-report.md` *(+0/-31)*
- `reports/memory-lab/locomo-conv47-pass9-laya-report.md` *(+0/-28)*
- `reports/memory-lab/locomo-conv47-pass9-report.md` *(+0/-29)*
- `reports/memory-lab/locomo-conv47-shootout-report.md` *(+0/-36)*
- `third-party/spine-runtimes/4.0.64/LICENSE` *(+26/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/LICENSE` *(+26/-0)*
- `third-party/spine-runtimes/4.1.00/LICENSE` *(+26/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/LICENSE` *(+26/-0)*
- `third-party/spine-runtimes/4.2/LICENSE` *(+26/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/LICENSE` *(+26/-0)*
- `third-party/spine-runtimes/VERSIONS.md` *(+39/-0)*

#### Other / Uncategorized (`🔍 inspect`) — 2297 file(s) (+168070/-705082)
- `.agents/skills/beads/agents/openai.yaml` *(+4/-0)*
- `.beads/.gitignore` *(+82/-0)*
- `.beads/config.yaml` *(+75/-0)*
- `.beads/hooks/post-checkout` *(+59/-0)*
- `.beads/hooks/post-merge` *(+59/-0)*
- `.beads/hooks/pre-commit` *(+71/-0)*
- `.beads/hooks/pre-commit.backup` *(+12/-0)*
- `.beads/hooks/pre-push` *(+59/-0)*
- `.beads/hooks/prepare-commit-msg` *(+59/-0)*
- `.beads/metadata.json` *(+7/-0)*
- `.claude/settings.json` *(+15/-0)*
- `.codex/config.toml` *(+2/-0)*
- `.codex/hooks.json` *(+51/-0)*
- `.cursor/hooks.json` *(+20/-0)*
- `.cursor/rules/beads.mdc` *(+67/-0)*
- `.gitignore` *(+16/-8)*
- `.npmrc` *(+0/-1)*
- `Cargo.lock` *(+9975/-0)*
- `Cargo.toml` *(+125/-0)*
- `animadex.db` *(+0/-0)*
- `apps/server/.airi-db/PG_VERSION` *(+0/-1)*
- `apps/server/.airi-db/base/1/112` *(+0/-0)*
- `apps/server/.airi-db/base/1/113` *(+0/-0)*
- `apps/server/.airi-db/base/1/1247` *(+0/-0)*
- `apps/server/.airi-db/base/1/1247_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/1247_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/1249` *(+0/-0)*
- `apps/server/.airi-db/base/1/1249_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/1249_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/1255` *(+0/-0)*
- `apps/server/.airi-db/base/1/1255_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/1255_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/1259` *(+0/-0)*
- `apps/server/.airi-db/base/1/12596` *(+0/-0)*
- `apps/server/.airi-db/base/1/12596_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/12596_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/12599` *(+0/-0)*
- `apps/server/.airi-db/base/1/1259_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/1259_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/12600` *(+0/-0)*
- `apps/server/.airi-db/base/1/12601` *(+0/-0)*
- `apps/server/.airi-db/base/1/12601_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/12601_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/12604` *(+0/-0)*
- `apps/server/.airi-db/base/1/12605` *(+0/-0)*
- `apps/server/.airi-db/base/1/12606` *(+0/-0)*
- `apps/server/.airi-db/base/1/12606_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/12606_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/12609` *(+0/-0)*
- `apps/server/.airi-db/base/1/12610` *(+0/-0)*
- `apps/server/.airi-db/base/1/12611` *(+0/-0)*
- `apps/server/.airi-db/base/1/12611_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/12611_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/12614` *(+0/-0)*
- `apps/server/.airi-db/base/1/12615` *(+0/-0)*
- `apps/server/.airi-db/base/1/1417` *(+0/-0)*
- `apps/server/.airi-db/base/1/1418` *(+0/-0)*
- `apps/server/.airi-db/base/1/16385` *(+0/-0)*
- `apps/server/.airi-db/base/1/16386` *(+0/-0)*
- `apps/server/.airi-db/base/1/16390` *(+0/-0)*
- `apps/server/.airi-db/base/1/16391` *(+0/-0)*
- `apps/server/.airi-db/base/1/16392` *(+0/-0)*
- `apps/server/.airi-db/base/1/16394` *(+0/-0)*
- `apps/server/.airi-db/base/1/16398` *(+0/-0)*
- `apps/server/.airi-db/base/1/16399` *(+0/-0)*
- `apps/server/.airi-db/base/1/16400` *(+0/-0)*
- `apps/server/.airi-db/base/1/16402` *(+0/-0)*
- `apps/server/.airi-db/base/1/16406` *(+0/-0)*
- `apps/server/.airi-db/base/1/16407` *(+0/-0)*
- `apps/server/.airi-db/base/1/16408` *(+0/-0)*
- `apps/server/.airi-db/base/1/16410` *(+0/-0)*
- `apps/server/.airi-db/base/1/16412` *(+0/-0)*
- `apps/server/.airi-db/base/1/16418` *(+0/-0)*
- `apps/server/.airi-db/base/1/16419` *(+0/-0)*
- `apps/server/.airi-db/base/1/16420` *(+0/-0)*
- `apps/server/.airi-db/base/1/16422` *(+0/-0)*
- `apps/server/.airi-db/base/1/16424` *(+0/-0)*
- `apps/server/.airi-db/base/1/16429` *(+0/-0)*
- `apps/server/.airi-db/base/1/16430` *(+0/-0)*
- `apps/server/.airi-db/base/1/16431` *(+0/-0)*
- `apps/server/.airi-db/base/1/16433` *(+0/-0)*
- `apps/server/.airi-db/base/1/16438` *(+0/-0)*
- `apps/server/.airi-db/base/1/16439` *(+0/-0)*
- `apps/server/.airi-db/base/1/16440` *(+0/-0)*
- `apps/server/.airi-db/base/1/16442` *(+0/-0)*
- `apps/server/.airi-db/base/1/16452` *(+0/-0)*
- `apps/server/.airi-db/base/1/16453` *(+0/-0)*
- `apps/server/.airi-db/base/1/16454` *(+0/-0)*
- `apps/server/.airi-db/base/1/16456` *(+0/-0)*
- `apps/server/.airi-db/base/1/16459` *(+0/-0)*
- `apps/server/.airi-db/base/1/16460` *(+0/-0)*
- `apps/server/.airi-db/base/1/16461` *(+0/-0)*
- `apps/server/.airi-db/base/1/16463` *(+0/-0)*
- `apps/server/.airi-db/base/1/16468` *(+0/-0)*
- `apps/server/.airi-db/base/1/16469` *(+0/-0)*
- `apps/server/.airi-db/base/1/16470` *(+0/-0)*
- `apps/server/.airi-db/base/1/16472` *(+0/-0)*
- `apps/server/.airi-db/base/1/16477` *(+0/-0)*
- `apps/server/.airi-db/base/1/16478` *(+0/-0)*
- `apps/server/.airi-db/base/1/16479` *(+0/-0)*
- `apps/server/.airi-db/base/1/16481` *(+0/-0)*
- `apps/server/.airi-db/base/1/16484` *(+0/-0)*
- `apps/server/.airi-db/base/1/16485` *(+0/-0)*
- `apps/server/.airi-db/base/1/16486` *(+0/-0)*
- `apps/server/.airi-db/base/1/16488` *(+0/-0)*
- `apps/server/.airi-db/base/1/16491` *(+0/-0)*
- `apps/server/.airi-db/base/1/16492` *(+0/-0)*
- `apps/server/.airi-db/base/1/16493` *(+0/-0)*
- `apps/server/.airi-db/base/1/16495` *(+0/-0)*
- `apps/server/.airi-db/base/1/16500` *(+0/-0)*
- `apps/server/.airi-db/base/1/16501` *(+0/-0)*
- `apps/server/.airi-db/base/1/16502` *(+0/-0)*
- `apps/server/.airi-db/base/1/16504` *(+0/-0)*
- `apps/server/.airi-db/base/1/16509` *(+0/-0)*
- `apps/server/.airi-db/base/1/16510` *(+0/-0)*
- `apps/server/.airi-db/base/1/16511` *(+0/-0)*
- `apps/server/.airi-db/base/1/16513` *(+0/-0)*
- `apps/server/.airi-db/base/1/16518` *(+0/-0)*
- `apps/server/.airi-db/base/1/16519` *(+0/-0)*
- `apps/server/.airi-db/base/1/16520` *(+0/-0)*
- `apps/server/.airi-db/base/1/16522` *(+0/-0)*
- `apps/server/.airi-db/base/1/16527` *(+0/-0)*
- `apps/server/.airi-db/base/1/16528` *(+0/-0)*
- `apps/server/.airi-db/base/1/16529` *(+0/-0)*
- `apps/server/.airi-db/base/1/16531` *(+0/-0)*
- `apps/server/.airi-db/base/1/16536` *(+0/-0)*
- `apps/server/.airi-db/base/1/16537` *(+0/-0)*
- `apps/server/.airi-db/base/1/16538` *(+0/-0)*
- `apps/server/.airi-db/base/1/16540` *(+0/-0)*
- `apps/server/.airi-db/base/1/16548` *(+0/-0)*
- `apps/server/.airi-db/base/1/16549` *(+0/-0)*
- `apps/server/.airi-db/base/1/16550` *(+0/-0)*
- `apps/server/.airi-db/base/1/16552` *(+0/-0)*
- `apps/server/.airi-db/base/1/16560` *(+0/-0)*
- `apps/server/.airi-db/base/1/16561` *(+0/-0)*
- `apps/server/.airi-db/base/1/16562` *(+0/-0)*
- `apps/server/.airi-db/base/1/16564` *(+0/-0)*
- `apps/server/.airi-db/base/1/16568` *(+0/-0)*
- `apps/server/.airi-db/base/1/16569` *(+0/-0)*
- `apps/server/.airi-db/base/1/16570` *(+0/-0)*
- `apps/server/.airi-db/base/1/16572` *(+0/-0)*
- `apps/server/.airi-db/base/1/16576` *(+0/-0)*
- `apps/server/.airi-db/base/1/16577` *(+0/-0)*
- `apps/server/.airi-db/base/1/16578` *(+0/-0)*
- `apps/server/.airi-db/base/1/16660` *(+0/-0)*
- `apps/server/.airi-db/base/1/16661` *(+0/-0)*
- `apps/server/.airi-db/base/1/16662` *(+0/-0)*
- `apps/server/.airi-db/base/1/174` *(+0/-0)*
- `apps/server/.airi-db/base/1/175` *(+0/-0)*
- `apps/server/.airi-db/base/1/2187` *(+0/-0)*
- `apps/server/.airi-db/base/1/2224` *(+0/-0)*
- `apps/server/.airi-db/base/1/2228` *(+0/-0)*
- `apps/server/.airi-db/base/1/2328` *(+0/-0)*
- `apps/server/.airi-db/base/1/2336` *(+0/-0)*
- `apps/server/.airi-db/base/1/2337` *(+0/-0)*
- `apps/server/.airi-db/base/1/2579` *(+0/-0)*
- `apps/server/.airi-db/base/1/2600` *(+0/-0)*
- `apps/server/.airi-db/base/1/2600_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2600_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2601` *(+0/-0)*
- `apps/server/.airi-db/base/1/2601_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2601_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2602` *(+0/-0)*
- `apps/server/.airi-db/base/1/2602_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2602_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2603` *(+0/-0)*
- `apps/server/.airi-db/base/1/2603_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2603_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2604` *(+0/-0)*
- `apps/server/.airi-db/base/1/2604_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2605` *(+0/-0)*
- `apps/server/.airi-db/base/1/2605_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2605_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2606` *(+0/-0)*
- `apps/server/.airi-db/base/1/2606_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2606_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2607` *(+0/-0)*
- `apps/server/.airi-db/base/1/2607_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2607_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2608` *(+0/-0)*
- `apps/server/.airi-db/base/1/2608_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2608_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2609` *(+0/-0)*
- `apps/server/.airi-db/base/1/2609_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2609_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2610` *(+0/-0)*
- `apps/server/.airi-db/base/1/2610_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2610_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2611` *(+0/-0)*
- `apps/server/.airi-db/base/1/2612` *(+0/-0)*
- `apps/server/.airi-db/base/1/2612_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2612_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2613` *(+0/-0)*
- `apps/server/.airi-db/base/1/2615` *(+0/-0)*
- `apps/server/.airi-db/base/1/2615_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2615_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2616` *(+0/-0)*
- `apps/server/.airi-db/base/1/2616_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2616_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2617` *(+0/-0)*
- `apps/server/.airi-db/base/1/2617_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2617_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2618` *(+0/-0)*
- `apps/server/.airi-db/base/1/2618_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2618_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2619` *(+0/-0)*
- `apps/server/.airi-db/base/1/2619_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2619_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2620` *(+0/-0)*
- `apps/server/.airi-db/base/1/2620_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2650` *(+0/-0)*
- `apps/server/.airi-db/base/1/2651` *(+0/-0)*
- `apps/server/.airi-db/base/1/2652` *(+0/-0)*
- `apps/server/.airi-db/base/1/2653` *(+0/-0)*
- `apps/server/.airi-db/base/1/2654` *(+0/-0)*
- `apps/server/.airi-db/base/1/2655` *(+0/-0)*
- `apps/server/.airi-db/base/1/2656` *(+0/-0)*
- `apps/server/.airi-db/base/1/2657` *(+0/-0)*
- `apps/server/.airi-db/base/1/2658` *(+0/-0)*
- `apps/server/.airi-db/base/1/2659` *(+0/-0)*
- `apps/server/.airi-db/base/1/2660` *(+0/-0)*
- `apps/server/.airi-db/base/1/2661` *(+0/-0)*
- `apps/server/.airi-db/base/1/2662` *(+0/-0)*
- `apps/server/.airi-db/base/1/2663` *(+0/-0)*
- `apps/server/.airi-db/base/1/2664` *(+0/-0)*
- `apps/server/.airi-db/base/1/2665` *(+0/-0)*
- `apps/server/.airi-db/base/1/2666` *(+0/-0)*
- `apps/server/.airi-db/base/1/2667` *(+0/-0)*
- `apps/server/.airi-db/base/1/2668` *(+0/-0)*
- `apps/server/.airi-db/base/1/2669` *(+0/-0)*
- `apps/server/.airi-db/base/1/2670` *(+0/-0)*
- `apps/server/.airi-db/base/1/2673` *(+0/-0)*
- `apps/server/.airi-db/base/1/2674` *(+0/-0)*
- `apps/server/.airi-db/base/1/2675` *(+0/-0)*
- `apps/server/.airi-db/base/1/2678` *(+0/-0)*
- `apps/server/.airi-db/base/1/2679` *(+0/-0)*
- `apps/server/.airi-db/base/1/2680` *(+0/-0)*
- `apps/server/.airi-db/base/1/2681` *(+0/-0)*
- `apps/server/.airi-db/base/1/2682` *(+0/-0)*
- `apps/server/.airi-db/base/1/2683` *(+0/-0)*
- `apps/server/.airi-db/base/1/2684` *(+0/-0)*
- `apps/server/.airi-db/base/1/2685` *(+0/-0)*
- `apps/server/.airi-db/base/1/2686` *(+0/-0)*
- `apps/server/.airi-db/base/1/2687` *(+0/-0)*
- `apps/server/.airi-db/base/1/2688` *(+0/-0)*
- `apps/server/.airi-db/base/1/2689` *(+0/-0)*
- `apps/server/.airi-db/base/1/2690` *(+0/-0)*
- `apps/server/.airi-db/base/1/2691` *(+0/-0)*
- `apps/server/.airi-db/base/1/2692` *(+0/-0)*
- `apps/server/.airi-db/base/1/2693` *(+0/-0)*
- `apps/server/.airi-db/base/1/2696` *(+0/-0)*
- `apps/server/.airi-db/base/1/2699` *(+0/-0)*
- `apps/server/.airi-db/base/1/2701` *(+0/-0)*
- `apps/server/.airi-db/base/1/2702` *(+0/-0)*
- `apps/server/.airi-db/base/1/2703` *(+0/-0)*
- `apps/server/.airi-db/base/1/2704` *(+0/-0)*
- `apps/server/.airi-db/base/1/2753` *(+0/-0)*
- `apps/server/.airi-db/base/1/2753_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2753_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2754` *(+0/-0)*
- `apps/server/.airi-db/base/1/2755` *(+0/-0)*
- `apps/server/.airi-db/base/1/2756` *(+0/-0)*
- `apps/server/.airi-db/base/1/2757` *(+0/-0)*
- `apps/server/.airi-db/base/1/2830` *(+0/-0)*
- `apps/server/.airi-db/base/1/2831` *(+0/-0)*
- `apps/server/.airi-db/base/1/2832` *(+0/-0)*
- `apps/server/.airi-db/base/1/2833` *(+0/-0)*
- `apps/server/.airi-db/base/1/2834` *(+0/-0)*
- `apps/server/.airi-db/base/1/2835` *(+0/-0)*
- `apps/server/.airi-db/base/1/2836` *(+0/-0)*
- `apps/server/.airi-db/base/1/2836_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2836_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2837` *(+0/-0)*
- `apps/server/.airi-db/base/1/2838` *(+0/-0)*
- `apps/server/.airi-db/base/1/2838_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2838_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2839` *(+0/-0)*
- `apps/server/.airi-db/base/1/2840` *(+0/-0)*
- `apps/server/.airi-db/base/1/2840_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2840_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/2841` *(+0/-0)*
- `apps/server/.airi-db/base/1/2995` *(+0/-0)*
- `apps/server/.airi-db/base/1/2996` *(+0/-0)*
- `apps/server/.airi-db/base/1/3079` *(+0/-0)*
- `apps/server/.airi-db/base/1/3079_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3079_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3080` *(+0/-0)*
- `apps/server/.airi-db/base/1/3081` *(+0/-0)*
- `apps/server/.airi-db/base/1/3085` *(+0/-0)*
- `apps/server/.airi-db/base/1/3118` *(+0/-0)*
- `apps/server/.airi-db/base/1/3119` *(+0/-0)*
- `apps/server/.airi-db/base/1/3164` *(+0/-0)*
- `apps/server/.airi-db/base/1/3256` *(+0/-0)*
- `apps/server/.airi-db/base/1/3257` *(+0/-0)*
- `apps/server/.airi-db/base/1/3258` *(+0/-0)*
- `apps/server/.airi-db/base/1/3350` *(+0/-0)*
- `apps/server/.airi-db/base/1/3351` *(+0/-0)*
- `apps/server/.airi-db/base/1/3379` *(+0/-0)*
- `apps/server/.airi-db/base/1/3380` *(+0/-0)*
- `apps/server/.airi-db/base/1/3381` *(+0/-0)*
- `apps/server/.airi-db/base/1/3394` *(+0/-0)*
- `apps/server/.airi-db/base/1/3394_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3394_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3395` *(+0/-0)*
- `apps/server/.airi-db/base/1/3429` *(+0/-0)*
- `apps/server/.airi-db/base/1/3430` *(+0/-0)*
- `apps/server/.airi-db/base/1/3431` *(+0/-0)*
- `apps/server/.airi-db/base/1/3433` *(+0/-0)*
- `apps/server/.airi-db/base/1/3439` *(+0/-0)*
- `apps/server/.airi-db/base/1/3440` *(+0/-0)*
- `apps/server/.airi-db/base/1/3455` *(+0/-0)*
- `apps/server/.airi-db/base/1/3456` *(+0/-0)*
- `apps/server/.airi-db/base/1/3456_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3456_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3466` *(+0/-0)*
- `apps/server/.airi-db/base/1/3467` *(+0/-0)*
- `apps/server/.airi-db/base/1/3468` *(+0/-0)*
- `apps/server/.airi-db/base/1/3501` *(+0/-0)*
- `apps/server/.airi-db/base/1/3502` *(+0/-0)*
- `apps/server/.airi-db/base/1/3503` *(+0/-0)*
- `apps/server/.airi-db/base/1/3534` *(+0/-0)*
- `apps/server/.airi-db/base/1/3541` *(+0/-0)*
- `apps/server/.airi-db/base/1/3541_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3541_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3542` *(+0/-0)*
- `apps/server/.airi-db/base/1/3574` *(+0/-0)*
- `apps/server/.airi-db/base/1/3575` *(+0/-0)*
- `apps/server/.airi-db/base/1/3576` *(+0/-0)*
- `apps/server/.airi-db/base/1/3596` *(+0/-0)*
- `apps/server/.airi-db/base/1/3597` *(+0/-0)*
- `apps/server/.airi-db/base/1/3598` *(+0/-0)*
- `apps/server/.airi-db/base/1/3599` *(+0/-0)*
- `apps/server/.airi-db/base/1/3600` *(+0/-0)*
- `apps/server/.airi-db/base/1/3600_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3600_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3601` *(+0/-0)*
- `apps/server/.airi-db/base/1/3601_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3601_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3602` *(+0/-0)*
- `apps/server/.airi-db/base/1/3602_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3602_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3603` *(+0/-0)*
- `apps/server/.airi-db/base/1/3603_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3603_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3604` *(+0/-0)*
- `apps/server/.airi-db/base/1/3605` *(+0/-0)*
- `apps/server/.airi-db/base/1/3606` *(+0/-0)*
- `apps/server/.airi-db/base/1/3607` *(+0/-0)*
- `apps/server/.airi-db/base/1/3608` *(+0/-0)*
- `apps/server/.airi-db/base/1/3609` *(+0/-0)*
- `apps/server/.airi-db/base/1/3712` *(+0/-0)*
- `apps/server/.airi-db/base/1/3764` *(+0/-0)*
- `apps/server/.airi-db/base/1/3764_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3764_vm` *(+0/-0)*
- `apps/server/.airi-db/base/1/3766` *(+0/-0)*
- `apps/server/.airi-db/base/1/3767` *(+0/-0)*
- `apps/server/.airi-db/base/1/3997` *(+0/-0)*
- `apps/server/.airi-db/base/1/4143` *(+0/-0)*
- `apps/server/.airi-db/base/1/4144` *(+0/-0)*
- `apps/server/.airi-db/base/1/4145` *(+0/-0)*
- `apps/server/.airi-db/base/1/4146` *(+0/-0)*
- `apps/server/.airi-db/base/1/4147` *(+0/-0)*
- `apps/server/.airi-db/base/1/4148` *(+0/-0)*
- `apps/server/.airi-db/base/1/4149` *(+0/-0)*
- `apps/server/.airi-db/base/1/4150` *(+0/-0)*
- `apps/server/.airi-db/base/1/4151` *(+0/-0)*
- `apps/server/.airi-db/base/1/4152` *(+0/-0)*
- `apps/server/.airi-db/base/1/4153` *(+0/-0)*
- `apps/server/.airi-db/base/1/4154` *(+0/-0)*
- `apps/server/.airi-db/base/1/4155` *(+0/-0)*
- `apps/server/.airi-db/base/1/4156` *(+0/-0)*
- `apps/server/.airi-db/base/1/4157` *(+0/-0)*
- `apps/server/.airi-db/base/1/4158` *(+0/-0)*
- `apps/server/.airi-db/base/1/4159` *(+0/-0)*
- `apps/server/.airi-db/base/1/4160` *(+0/-0)*
- `apps/server/.airi-db/base/1/4163` *(+0/-0)*
- `apps/server/.airi-db/base/1/4164` *(+0/-0)*
- `apps/server/.airi-db/base/1/4165` *(+0/-0)*
- `apps/server/.airi-db/base/1/4166` *(+0/-0)*
- `apps/server/.airi-db/base/1/4167` *(+0/-0)*
- `apps/server/.airi-db/base/1/4168` *(+0/-0)*
- `apps/server/.airi-db/base/1/4169` *(+0/-0)*
- `apps/server/.airi-db/base/1/4170` *(+0/-0)*
- `apps/server/.airi-db/base/1/4171` *(+0/-0)*
- `apps/server/.airi-db/base/1/4172` *(+0/-0)*
- `apps/server/.airi-db/base/1/4173` *(+0/-0)*
- `apps/server/.airi-db/base/1/4174` *(+0/-0)*
- `apps/server/.airi-db/base/1/5002` *(+0/-0)*
- `apps/server/.airi-db/base/1/548` *(+0/-0)*
- `apps/server/.airi-db/base/1/549` *(+0/-0)*
- `apps/server/.airi-db/base/1/6102` *(+0/-0)*
- `apps/server/.airi-db/base/1/6104` *(+0/-0)*
- `apps/server/.airi-db/base/1/6106` *(+0/-0)*
- `apps/server/.airi-db/base/1/6110` *(+0/-0)*
- `apps/server/.airi-db/base/1/6111` *(+0/-0)*
- `apps/server/.airi-db/base/1/6112` *(+0/-0)*
- `apps/server/.airi-db/base/1/6113` *(+0/-0)*
- `apps/server/.airi-db/base/1/6116` *(+0/-0)*
- `apps/server/.airi-db/base/1/6117` *(+0/-0)*
- `apps/server/.airi-db/base/1/6175` *(+0/-0)*
- `apps/server/.airi-db/base/1/6176` *(+0/-0)*
- `apps/server/.airi-db/base/1/6228` *(+0/-0)*
- `apps/server/.airi-db/base/1/6229` *(+0/-0)*
- `apps/server/.airi-db/base/1/6237` *(+0/-0)*
- `apps/server/.airi-db/base/1/6238` *(+0/-0)*
- `apps/server/.airi-db/base/1/6239` *(+0/-0)*
- `apps/server/.airi-db/base/1/826` *(+0/-0)*
- `apps/server/.airi-db/base/1/827` *(+0/-0)*
- `apps/server/.airi-db/base/1/828` *(+0/-0)*
- `apps/server/.airi-db/base/1/PG_VERSION` *(+0/-1)*
- `apps/server/.airi-db/base/1/pg_filenode.map` *(+0/-0)*
- `apps/server/.airi-db/base/4/112` *(+0/-0)*
- `apps/server/.airi-db/base/4/113` *(+0/-0)*
- `apps/server/.airi-db/base/4/1247` *(+0/-0)*
- `apps/server/.airi-db/base/4/1247_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/1247_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/1249` *(+0/-0)*
- `apps/server/.airi-db/base/4/1249_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/1249_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/1255` *(+0/-0)*
- `apps/server/.airi-db/base/4/1255_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/1255_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/1259` *(+0/-0)*
- `apps/server/.airi-db/base/4/12596` *(+0/-0)*
- `apps/server/.airi-db/base/4/12596_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/12596_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/12599` *(+0/-0)*
- `apps/server/.airi-db/base/4/1259_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/1259_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/12600` *(+0/-0)*
- `apps/server/.airi-db/base/4/12601` *(+0/-0)*
- `apps/server/.airi-db/base/4/12601_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/12601_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/12604` *(+0/-0)*
- `apps/server/.airi-db/base/4/12605` *(+0/-0)*
- `apps/server/.airi-db/base/4/12606` *(+0/-0)*
- `apps/server/.airi-db/base/4/12606_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/12606_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/12609` *(+0/-0)*
- `apps/server/.airi-db/base/4/12610` *(+0/-0)*
- `apps/server/.airi-db/base/4/12611` *(+0/-0)*
- `apps/server/.airi-db/base/4/12611_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/12611_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/12614` *(+0/-0)*
- `apps/server/.airi-db/base/4/12615` *(+0/-0)*
- `apps/server/.airi-db/base/4/1417` *(+0/-0)*
- `apps/server/.airi-db/base/4/1418` *(+0/-0)*
- `apps/server/.airi-db/base/4/174` *(+0/-0)*
- `apps/server/.airi-db/base/4/175` *(+0/-0)*
- `apps/server/.airi-db/base/4/2187` *(+0/-0)*
- `apps/server/.airi-db/base/4/2224` *(+0/-0)*
- `apps/server/.airi-db/base/4/2228` *(+0/-0)*
- `apps/server/.airi-db/base/4/2328` *(+0/-0)*
- `apps/server/.airi-db/base/4/2336` *(+0/-0)*
- `apps/server/.airi-db/base/4/2337` *(+0/-0)*
- `apps/server/.airi-db/base/4/2579` *(+0/-0)*
- `apps/server/.airi-db/base/4/2600` *(+0/-0)*
- `apps/server/.airi-db/base/4/2600_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2600_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2601` *(+0/-0)*
- `apps/server/.airi-db/base/4/2601_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2601_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2602` *(+0/-0)*
- `apps/server/.airi-db/base/4/2602_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2602_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2603` *(+0/-0)*
- `apps/server/.airi-db/base/4/2603_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2603_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2604` *(+0/-0)*
- `apps/server/.airi-db/base/4/2605` *(+0/-0)*
- `apps/server/.airi-db/base/4/2605_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2605_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2606` *(+0/-0)*
- `apps/server/.airi-db/base/4/2606_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2606_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2607` *(+0/-0)*
- `apps/server/.airi-db/base/4/2607_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2607_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2608` *(+0/-0)*
- `apps/server/.airi-db/base/4/2608_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2608_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2609` *(+0/-0)*
- `apps/server/.airi-db/base/4/2609_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2609_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2610` *(+0/-0)*
- `apps/server/.airi-db/base/4/2610_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2610_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2611` *(+0/-0)*
- `apps/server/.airi-db/base/4/2612` *(+0/-0)*
- `apps/server/.airi-db/base/4/2612_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2612_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2613` *(+0/-0)*
- `apps/server/.airi-db/base/4/2615` *(+0/-0)*
- `apps/server/.airi-db/base/4/2615_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2615_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2616` *(+0/-0)*
- `apps/server/.airi-db/base/4/2616_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2616_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2617` *(+0/-0)*
- `apps/server/.airi-db/base/4/2617_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2617_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2618` *(+0/-0)*
- `apps/server/.airi-db/base/4/2618_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2618_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2619` *(+0/-0)*
- `apps/server/.airi-db/base/4/2619_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2619_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2620` *(+0/-0)*
- `apps/server/.airi-db/base/4/2650` *(+0/-0)*
- `apps/server/.airi-db/base/4/2651` *(+0/-0)*
- `apps/server/.airi-db/base/4/2652` *(+0/-0)*
- `apps/server/.airi-db/base/4/2653` *(+0/-0)*
- `apps/server/.airi-db/base/4/2654` *(+0/-0)*
- `apps/server/.airi-db/base/4/2655` *(+0/-0)*
- `apps/server/.airi-db/base/4/2656` *(+0/-0)*
- `apps/server/.airi-db/base/4/2657` *(+0/-0)*
- `apps/server/.airi-db/base/4/2658` *(+0/-0)*
- `apps/server/.airi-db/base/4/2659` *(+0/-0)*
- `apps/server/.airi-db/base/4/2660` *(+0/-0)*
- `apps/server/.airi-db/base/4/2661` *(+0/-0)*
- `apps/server/.airi-db/base/4/2662` *(+0/-0)*
- `apps/server/.airi-db/base/4/2663` *(+0/-0)*
- `apps/server/.airi-db/base/4/2664` *(+0/-0)*
- `apps/server/.airi-db/base/4/2665` *(+0/-0)*
- `apps/server/.airi-db/base/4/2666` *(+0/-0)*
- `apps/server/.airi-db/base/4/2667` *(+0/-0)*
- `apps/server/.airi-db/base/4/2668` *(+0/-0)*
- `apps/server/.airi-db/base/4/2669` *(+0/-0)*
- `apps/server/.airi-db/base/4/2670` *(+0/-0)*
- `apps/server/.airi-db/base/4/2673` *(+0/-0)*
- `apps/server/.airi-db/base/4/2674` *(+0/-0)*
- `apps/server/.airi-db/base/4/2675` *(+0/-0)*
- `apps/server/.airi-db/base/4/2678` *(+0/-0)*
- `apps/server/.airi-db/base/4/2679` *(+0/-0)*
- `apps/server/.airi-db/base/4/2680` *(+0/-0)*
- `apps/server/.airi-db/base/4/2681` *(+0/-0)*
- `apps/server/.airi-db/base/4/2682` *(+0/-0)*
- `apps/server/.airi-db/base/4/2683` *(+0/-0)*
- `apps/server/.airi-db/base/4/2684` *(+0/-0)*
- `apps/server/.airi-db/base/4/2685` *(+0/-0)*
- `apps/server/.airi-db/base/4/2686` *(+0/-0)*
- `apps/server/.airi-db/base/4/2687` *(+0/-0)*
- `apps/server/.airi-db/base/4/2688` *(+0/-0)*
- `apps/server/.airi-db/base/4/2689` *(+0/-0)*
- `apps/server/.airi-db/base/4/2690` *(+0/-0)*
- `apps/server/.airi-db/base/4/2691` *(+0/-0)*
- `apps/server/.airi-db/base/4/2692` *(+0/-0)*
- `apps/server/.airi-db/base/4/2693` *(+0/-0)*
- `apps/server/.airi-db/base/4/2696` *(+0/-0)*
- `apps/server/.airi-db/base/4/2699` *(+0/-0)*
- `apps/server/.airi-db/base/4/2701` *(+0/-0)*
- `apps/server/.airi-db/base/4/2702` *(+0/-0)*
- `apps/server/.airi-db/base/4/2703` *(+0/-0)*
- `apps/server/.airi-db/base/4/2704` *(+0/-0)*
- `apps/server/.airi-db/base/4/2753` *(+0/-0)*
- `apps/server/.airi-db/base/4/2753_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2753_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2754` *(+0/-0)*
- `apps/server/.airi-db/base/4/2755` *(+0/-0)*
- `apps/server/.airi-db/base/4/2756` *(+0/-0)*
- `apps/server/.airi-db/base/4/2757` *(+0/-0)*
- `apps/server/.airi-db/base/4/2830` *(+0/-0)*
- `apps/server/.airi-db/base/4/2831` *(+0/-0)*
- `apps/server/.airi-db/base/4/2832` *(+0/-0)*
- `apps/server/.airi-db/base/4/2833` *(+0/-0)*
- `apps/server/.airi-db/base/4/2834` *(+0/-0)*
- `apps/server/.airi-db/base/4/2835` *(+0/-0)*
- `apps/server/.airi-db/base/4/2836` *(+0/-0)*
- `apps/server/.airi-db/base/4/2836_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2836_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2837` *(+0/-0)*
- `apps/server/.airi-db/base/4/2838` *(+0/-0)*
- `apps/server/.airi-db/base/4/2838_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2838_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2839` *(+0/-0)*
- `apps/server/.airi-db/base/4/2840` *(+0/-0)*
- `apps/server/.airi-db/base/4/2840_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2840_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/2841` *(+0/-0)*
- `apps/server/.airi-db/base/4/2995` *(+0/-0)*
- `apps/server/.airi-db/base/4/2996` *(+0/-0)*
- `apps/server/.airi-db/base/4/3079` *(+0/-0)*
- `apps/server/.airi-db/base/4/3079_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3079_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3080` *(+0/-0)*
- `apps/server/.airi-db/base/4/3081` *(+0/-0)*
- `apps/server/.airi-db/base/4/3085` *(+0/-0)*
- `apps/server/.airi-db/base/4/3118` *(+0/-0)*
- `apps/server/.airi-db/base/4/3119` *(+0/-0)*
- `apps/server/.airi-db/base/4/3164` *(+0/-0)*
- `apps/server/.airi-db/base/4/3256` *(+0/-0)*
- `apps/server/.airi-db/base/4/3257` *(+0/-0)*
- `apps/server/.airi-db/base/4/3258` *(+0/-0)*
- `apps/server/.airi-db/base/4/3350` *(+0/-0)*
- `apps/server/.airi-db/base/4/3351` *(+0/-0)*
- `apps/server/.airi-db/base/4/3379` *(+0/-0)*
- `apps/server/.airi-db/base/4/3380` *(+0/-0)*
- `apps/server/.airi-db/base/4/3381` *(+0/-0)*
- `apps/server/.airi-db/base/4/3394` *(+0/-0)*
- `apps/server/.airi-db/base/4/3394_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3394_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3395` *(+0/-0)*
- `apps/server/.airi-db/base/4/3429` *(+0/-0)*
- `apps/server/.airi-db/base/4/3430` *(+0/-0)*
- `apps/server/.airi-db/base/4/3431` *(+0/-0)*
- `apps/server/.airi-db/base/4/3433` *(+0/-0)*
- `apps/server/.airi-db/base/4/3439` *(+0/-0)*
- `apps/server/.airi-db/base/4/3440` *(+0/-0)*
- `apps/server/.airi-db/base/4/3455` *(+0/-0)*
- `apps/server/.airi-db/base/4/3456` *(+0/-0)*
- `apps/server/.airi-db/base/4/3456_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3456_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3466` *(+0/-0)*
- `apps/server/.airi-db/base/4/3467` *(+0/-0)*
- `apps/server/.airi-db/base/4/3468` *(+0/-0)*
- `apps/server/.airi-db/base/4/3501` *(+0/-0)*
- `apps/server/.airi-db/base/4/3502` *(+0/-0)*
- `apps/server/.airi-db/base/4/3503` *(+0/-0)*
- `apps/server/.airi-db/base/4/3534` *(+0/-0)*
- `apps/server/.airi-db/base/4/3541` *(+0/-0)*
- `apps/server/.airi-db/base/4/3541_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3541_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3542` *(+0/-0)*
- `apps/server/.airi-db/base/4/3574` *(+0/-0)*
- `apps/server/.airi-db/base/4/3575` *(+0/-0)*
- `apps/server/.airi-db/base/4/3576` *(+0/-0)*
- `apps/server/.airi-db/base/4/3596` *(+0/-0)*
- `apps/server/.airi-db/base/4/3597` *(+0/-0)*
- `apps/server/.airi-db/base/4/3598` *(+0/-0)*
- `apps/server/.airi-db/base/4/3599` *(+0/-0)*
- `apps/server/.airi-db/base/4/3600` *(+0/-0)*
- `apps/server/.airi-db/base/4/3600_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3600_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3601` *(+0/-0)*
- `apps/server/.airi-db/base/4/3601_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3601_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3602` *(+0/-0)*
- `apps/server/.airi-db/base/4/3602_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3602_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3603` *(+0/-0)*
- `apps/server/.airi-db/base/4/3603_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3603_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3604` *(+0/-0)*
- `apps/server/.airi-db/base/4/3605` *(+0/-0)*
- `apps/server/.airi-db/base/4/3606` *(+0/-0)*
- `apps/server/.airi-db/base/4/3607` *(+0/-0)*
- `apps/server/.airi-db/base/4/3608` *(+0/-0)*
- `apps/server/.airi-db/base/4/3609` *(+0/-0)*
- `apps/server/.airi-db/base/4/3712` *(+0/-0)*
- `apps/server/.airi-db/base/4/3764` *(+0/-0)*
- `apps/server/.airi-db/base/4/3764_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3764_vm` *(+0/-0)*
- `apps/server/.airi-db/base/4/3766` *(+0/-0)*
- `apps/server/.airi-db/base/4/3767` *(+0/-0)*
- `apps/server/.airi-db/base/4/3997` *(+0/-0)*
- `apps/server/.airi-db/base/4/4143` *(+0/-0)*
- `apps/server/.airi-db/base/4/4144` *(+0/-0)*
- `apps/server/.airi-db/base/4/4145` *(+0/-0)*
- `apps/server/.airi-db/base/4/4146` *(+0/-0)*
- `apps/server/.airi-db/base/4/4147` *(+0/-0)*
- `apps/server/.airi-db/base/4/4148` *(+0/-0)*
- `apps/server/.airi-db/base/4/4149` *(+0/-0)*
- `apps/server/.airi-db/base/4/4150` *(+0/-0)*
- `apps/server/.airi-db/base/4/4151` *(+0/-0)*
- `apps/server/.airi-db/base/4/4152` *(+0/-0)*
- `apps/server/.airi-db/base/4/4153` *(+0/-0)*
- `apps/server/.airi-db/base/4/4154` *(+0/-0)*
- `apps/server/.airi-db/base/4/4155` *(+0/-0)*
- `apps/server/.airi-db/base/4/4156` *(+0/-0)*
- `apps/server/.airi-db/base/4/4157` *(+0/-0)*
- `apps/server/.airi-db/base/4/4158` *(+0/-0)*
- `apps/server/.airi-db/base/4/4159` *(+0/-0)*
- `apps/server/.airi-db/base/4/4160` *(+0/-0)*
- `apps/server/.airi-db/base/4/4163` *(+0/-0)*
- `apps/server/.airi-db/base/4/4164` *(+0/-0)*
- `apps/server/.airi-db/base/4/4165` *(+0/-0)*
- `apps/server/.airi-db/base/4/4166` *(+0/-0)*
- `apps/server/.airi-db/base/4/4167` *(+0/-0)*
- `apps/server/.airi-db/base/4/4168` *(+0/-0)*
- `apps/server/.airi-db/base/4/4169` *(+0/-0)*
- `apps/server/.airi-db/base/4/4170` *(+0/-0)*
- `apps/server/.airi-db/base/4/4171` *(+0/-0)*
- `apps/server/.airi-db/base/4/4172` *(+0/-0)*
- `apps/server/.airi-db/base/4/4173` *(+0/-0)*
- `apps/server/.airi-db/base/4/4174` *(+0/-0)*
- `apps/server/.airi-db/base/4/5002` *(+0/-0)*
- `apps/server/.airi-db/base/4/548` *(+0/-0)*
- `apps/server/.airi-db/base/4/549` *(+0/-0)*
- `apps/server/.airi-db/base/4/6102` *(+0/-0)*
- `apps/server/.airi-db/base/4/6104` *(+0/-0)*
- `apps/server/.airi-db/base/4/6106` *(+0/-0)*
- `apps/server/.airi-db/base/4/6110` *(+0/-0)*
- `apps/server/.airi-db/base/4/6111` *(+0/-0)*
- `apps/server/.airi-db/base/4/6112` *(+0/-0)*
- `apps/server/.airi-db/base/4/6113` *(+0/-0)*
- `apps/server/.airi-db/base/4/6116` *(+0/-0)*
- `apps/server/.airi-db/base/4/6117` *(+0/-0)*
- `apps/server/.airi-db/base/4/6175` *(+0/-0)*
- `apps/server/.airi-db/base/4/6176` *(+0/-0)*
- `apps/server/.airi-db/base/4/6228` *(+0/-0)*
- `apps/server/.airi-db/base/4/6229` *(+0/-0)*
- `apps/server/.airi-db/base/4/6237` *(+0/-0)*
- `apps/server/.airi-db/base/4/6238` *(+0/-0)*
- `apps/server/.airi-db/base/4/6239` *(+0/-0)*
- `apps/server/.airi-db/base/4/826` *(+0/-0)*
- `apps/server/.airi-db/base/4/827` *(+0/-0)*
- `apps/server/.airi-db/base/4/828` *(+0/-0)*
- `apps/server/.airi-db/base/4/PG_VERSION` *(+0/-1)*
- `apps/server/.airi-db/base/4/pg_filenode.map` *(+0/-0)*
- `apps/server/.airi-db/base/5/112` *(+0/-0)*
- `apps/server/.airi-db/base/5/113` *(+0/-0)*
- `apps/server/.airi-db/base/5/1247` *(+0/-0)*
- `apps/server/.airi-db/base/5/1247_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/1247_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/1249` *(+0/-0)*
- `apps/server/.airi-db/base/5/1249_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/1249_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/1255` *(+0/-0)*
- `apps/server/.airi-db/base/5/1255_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/1255_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/1259` *(+0/-0)*
- `apps/server/.airi-db/base/5/12596` *(+0/-0)*
- `apps/server/.airi-db/base/5/12596_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/12596_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/12599` *(+0/-0)*
- `apps/server/.airi-db/base/5/1259_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/1259_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/12600` *(+0/-0)*
- `apps/server/.airi-db/base/5/12601` *(+0/-0)*
- `apps/server/.airi-db/base/5/12601_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/12601_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/12604` *(+0/-0)*
- `apps/server/.airi-db/base/5/12605` *(+0/-0)*
- `apps/server/.airi-db/base/5/12606` *(+0/-0)*
- `apps/server/.airi-db/base/5/12606_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/12606_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/12609` *(+0/-0)*
- `apps/server/.airi-db/base/5/12610` *(+0/-0)*
- `apps/server/.airi-db/base/5/12611` *(+0/-0)*
- `apps/server/.airi-db/base/5/12611_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/12611_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/12614` *(+0/-0)*
- `apps/server/.airi-db/base/5/12615` *(+0/-0)*
- `apps/server/.airi-db/base/5/1417` *(+0/-0)*
- `apps/server/.airi-db/base/5/1418` *(+0/-0)*
- `apps/server/.airi-db/base/5/174` *(+0/-0)*
- `apps/server/.airi-db/base/5/175` *(+0/-0)*
- `apps/server/.airi-db/base/5/2187` *(+0/-0)*
- `apps/server/.airi-db/base/5/2224` *(+0/-0)*
- `apps/server/.airi-db/base/5/2228` *(+0/-0)*
- `apps/server/.airi-db/base/5/2328` *(+0/-0)*
- `apps/server/.airi-db/base/5/2336` *(+0/-0)*
- `apps/server/.airi-db/base/5/2337` *(+0/-0)*
- `apps/server/.airi-db/base/5/2579` *(+0/-0)*
- `apps/server/.airi-db/base/5/2600` *(+0/-0)*
- `apps/server/.airi-db/base/5/2600_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2600_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2601` *(+0/-0)*
- `apps/server/.airi-db/base/5/2601_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2601_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2602` *(+0/-0)*
- `apps/server/.airi-db/base/5/2602_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2602_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2603` *(+0/-0)*
- `apps/server/.airi-db/base/5/2603_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2603_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2604` *(+0/-0)*
- `apps/server/.airi-db/base/5/2605` *(+0/-0)*
- `apps/server/.airi-db/base/5/2605_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2605_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2606` *(+0/-0)*
- `apps/server/.airi-db/base/5/2606_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2606_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2607` *(+0/-0)*
- `apps/server/.airi-db/base/5/2607_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2607_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2608` *(+0/-0)*
- `apps/server/.airi-db/base/5/2608_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2608_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2609` *(+0/-0)*
- `apps/server/.airi-db/base/5/2609_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2609_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2610` *(+0/-0)*
- `apps/server/.airi-db/base/5/2610_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2610_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2611` *(+0/-0)*
- `apps/server/.airi-db/base/5/2612` *(+0/-0)*
- `apps/server/.airi-db/base/5/2612_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2612_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2613` *(+0/-0)*
- `apps/server/.airi-db/base/5/2615` *(+0/-0)*
- `apps/server/.airi-db/base/5/2615_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2615_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2616` *(+0/-0)*
- `apps/server/.airi-db/base/5/2616_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2616_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2617` *(+0/-0)*
- `apps/server/.airi-db/base/5/2617_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2617_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2618` *(+0/-0)*
- `apps/server/.airi-db/base/5/2618_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2618_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2619` *(+0/-0)*
- `apps/server/.airi-db/base/5/2619_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2619_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2620` *(+0/-0)*
- `apps/server/.airi-db/base/5/2650` *(+0/-0)*
- `apps/server/.airi-db/base/5/2651` *(+0/-0)*
- `apps/server/.airi-db/base/5/2652` *(+0/-0)*
- `apps/server/.airi-db/base/5/2653` *(+0/-0)*
- `apps/server/.airi-db/base/5/2654` *(+0/-0)*
- `apps/server/.airi-db/base/5/2655` *(+0/-0)*
- `apps/server/.airi-db/base/5/2656` *(+0/-0)*
- `apps/server/.airi-db/base/5/2657` *(+0/-0)*
- `apps/server/.airi-db/base/5/2658` *(+0/-0)*
- `apps/server/.airi-db/base/5/2659` *(+0/-0)*
- `apps/server/.airi-db/base/5/2660` *(+0/-0)*
- `apps/server/.airi-db/base/5/2661` *(+0/-0)*
- `apps/server/.airi-db/base/5/2662` *(+0/-0)*
- `apps/server/.airi-db/base/5/2663` *(+0/-0)*
- `apps/server/.airi-db/base/5/2664` *(+0/-0)*
- `apps/server/.airi-db/base/5/2665` *(+0/-0)*
- `apps/server/.airi-db/base/5/2666` *(+0/-0)*
- `apps/server/.airi-db/base/5/2667` *(+0/-0)*
- `apps/server/.airi-db/base/5/2668` *(+0/-0)*
- `apps/server/.airi-db/base/5/2669` *(+0/-0)*
- `apps/server/.airi-db/base/5/2670` *(+0/-0)*
- `apps/server/.airi-db/base/5/2673` *(+0/-0)*
- `apps/server/.airi-db/base/5/2674` *(+0/-0)*
- `apps/server/.airi-db/base/5/2675` *(+0/-0)*
- `apps/server/.airi-db/base/5/2678` *(+0/-0)*
- `apps/server/.airi-db/base/5/2679` *(+0/-0)*
- `apps/server/.airi-db/base/5/2680` *(+0/-0)*
- `apps/server/.airi-db/base/5/2681` *(+0/-0)*
- `apps/server/.airi-db/base/5/2682` *(+0/-0)*
- `apps/server/.airi-db/base/5/2683` *(+0/-0)*
- `apps/server/.airi-db/base/5/2684` *(+0/-0)*
- `apps/server/.airi-db/base/5/2685` *(+0/-0)*
- `apps/server/.airi-db/base/5/2686` *(+0/-0)*
- `apps/server/.airi-db/base/5/2687` *(+0/-0)*
- `apps/server/.airi-db/base/5/2688` *(+0/-0)*
- `apps/server/.airi-db/base/5/2689` *(+0/-0)*
- `apps/server/.airi-db/base/5/2690` *(+0/-0)*
- `apps/server/.airi-db/base/5/2691` *(+0/-0)*
- `apps/server/.airi-db/base/5/2692` *(+0/-0)*
- `apps/server/.airi-db/base/5/2693` *(+0/-0)*
- `apps/server/.airi-db/base/5/2696` *(+0/-0)*
- `apps/server/.airi-db/base/5/2699` *(+0/-0)*
- `apps/server/.airi-db/base/5/2701` *(+0/-0)*
- `apps/server/.airi-db/base/5/2702` *(+0/-0)*
- `apps/server/.airi-db/base/5/2703` *(+0/-0)*
- `apps/server/.airi-db/base/5/2704` *(+0/-0)*
- `apps/server/.airi-db/base/5/2753` *(+0/-0)*
- `apps/server/.airi-db/base/5/2753_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2753_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2754` *(+0/-0)*
- `apps/server/.airi-db/base/5/2755` *(+0/-0)*
- `apps/server/.airi-db/base/5/2756` *(+0/-0)*
- `apps/server/.airi-db/base/5/2757` *(+0/-0)*
- `apps/server/.airi-db/base/5/2830` *(+0/-0)*
- `apps/server/.airi-db/base/5/2831` *(+0/-0)*
- `apps/server/.airi-db/base/5/2832` *(+0/-0)*
- `apps/server/.airi-db/base/5/2833` *(+0/-0)*
- `apps/server/.airi-db/base/5/2834` *(+0/-0)*
- `apps/server/.airi-db/base/5/2835` *(+0/-0)*
- `apps/server/.airi-db/base/5/2836` *(+0/-0)*
- `apps/server/.airi-db/base/5/2836_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2836_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2837` *(+0/-0)*
- `apps/server/.airi-db/base/5/2838` *(+0/-0)*
- `apps/server/.airi-db/base/5/2838_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2838_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2839` *(+0/-0)*
- `apps/server/.airi-db/base/5/2840` *(+0/-0)*
- `apps/server/.airi-db/base/5/2840_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2840_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/2841` *(+0/-0)*
- `apps/server/.airi-db/base/5/2995` *(+0/-0)*
- `apps/server/.airi-db/base/5/2996` *(+0/-0)*
- `apps/server/.airi-db/base/5/3079` *(+0/-0)*
- `apps/server/.airi-db/base/5/3079_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3079_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3080` *(+0/-0)*
- `apps/server/.airi-db/base/5/3081` *(+0/-0)*
- `apps/server/.airi-db/base/5/3085` *(+0/-0)*
- `apps/server/.airi-db/base/5/3118` *(+0/-0)*
- `apps/server/.airi-db/base/5/3119` *(+0/-0)*
- `apps/server/.airi-db/base/5/3164` *(+0/-0)*
- `apps/server/.airi-db/base/5/3256` *(+0/-0)*
- `apps/server/.airi-db/base/5/3257` *(+0/-0)*
- `apps/server/.airi-db/base/5/3258` *(+0/-0)*
- `apps/server/.airi-db/base/5/3350` *(+0/-0)*
- `apps/server/.airi-db/base/5/3351` *(+0/-0)*
- `apps/server/.airi-db/base/5/3379` *(+0/-0)*
- `apps/server/.airi-db/base/5/3380` *(+0/-0)*
- `apps/server/.airi-db/base/5/3381` *(+0/-0)*
- `apps/server/.airi-db/base/5/3394` *(+0/-0)*
- `apps/server/.airi-db/base/5/3394_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3394_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3395` *(+0/-0)*
- `apps/server/.airi-db/base/5/3429` *(+0/-0)*
- `apps/server/.airi-db/base/5/3430` *(+0/-0)*
- `apps/server/.airi-db/base/5/3431` *(+0/-0)*
- `apps/server/.airi-db/base/5/3433` *(+0/-0)*
- `apps/server/.airi-db/base/5/3439` *(+0/-0)*
- `apps/server/.airi-db/base/5/3440` *(+0/-0)*
- `apps/server/.airi-db/base/5/3455` *(+0/-0)*
- `apps/server/.airi-db/base/5/3456` *(+0/-0)*
- `apps/server/.airi-db/base/5/3456_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3456_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3466` *(+0/-0)*
- `apps/server/.airi-db/base/5/3467` *(+0/-0)*
- `apps/server/.airi-db/base/5/3468` *(+0/-0)*
- `apps/server/.airi-db/base/5/3501` *(+0/-0)*
- `apps/server/.airi-db/base/5/3502` *(+0/-0)*
- `apps/server/.airi-db/base/5/3503` *(+0/-0)*
- `apps/server/.airi-db/base/5/3534` *(+0/-0)*
- `apps/server/.airi-db/base/5/3541` *(+0/-0)*
- `apps/server/.airi-db/base/5/3541_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3541_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3542` *(+0/-0)*
- `apps/server/.airi-db/base/5/3574` *(+0/-0)*
- `apps/server/.airi-db/base/5/3575` *(+0/-0)*
- `apps/server/.airi-db/base/5/3576` *(+0/-0)*
- `apps/server/.airi-db/base/5/3596` *(+0/-0)*
- `apps/server/.airi-db/base/5/3597` *(+0/-0)*
- `apps/server/.airi-db/base/5/3598` *(+0/-0)*
- `apps/server/.airi-db/base/5/3599` *(+0/-0)*
- `apps/server/.airi-db/base/5/3600` *(+0/-0)*
- `apps/server/.airi-db/base/5/3600_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3600_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3601` *(+0/-0)*
- `apps/server/.airi-db/base/5/3601_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3601_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3602` *(+0/-0)*
- `apps/server/.airi-db/base/5/3602_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3602_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3603` *(+0/-0)*
- `apps/server/.airi-db/base/5/3603_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3603_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3604` *(+0/-0)*
- `apps/server/.airi-db/base/5/3605` *(+0/-0)*
- `apps/server/.airi-db/base/5/3606` *(+0/-0)*
- `apps/server/.airi-db/base/5/3607` *(+0/-0)*
- `apps/server/.airi-db/base/5/3608` *(+0/-0)*
- `apps/server/.airi-db/base/5/3609` *(+0/-0)*
- `apps/server/.airi-db/base/5/3712` *(+0/-0)*
- `apps/server/.airi-db/base/5/3764` *(+0/-0)*
- `apps/server/.airi-db/base/5/3764_fsm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3764_vm` *(+0/-0)*
- `apps/server/.airi-db/base/5/3766` *(+0/-0)*
- `apps/server/.airi-db/base/5/3767` *(+0/-0)*
- `apps/server/.airi-db/base/5/3997` *(+0/-0)*
- `apps/server/.airi-db/base/5/4143` *(+0/-0)*
- `apps/server/.airi-db/base/5/4144` *(+0/-0)*
- `apps/server/.airi-db/base/5/4145` *(+0/-0)*
- `apps/server/.airi-db/base/5/4146` *(+0/-0)*
- `apps/server/.airi-db/base/5/4147` *(+0/-0)*
- `apps/server/.airi-db/base/5/4148` *(+0/-0)*
- `apps/server/.airi-db/base/5/4149` *(+0/-0)*
- `apps/server/.airi-db/base/5/4150` *(+0/-0)*
- `apps/server/.airi-db/base/5/4151` *(+0/-0)*
- `apps/server/.airi-db/base/5/4152` *(+0/-0)*
- `apps/server/.airi-db/base/5/4153` *(+0/-0)*
- `apps/server/.airi-db/base/5/4154` *(+0/-0)*
- `apps/server/.airi-db/base/5/4155` *(+0/-0)*
- `apps/server/.airi-db/base/5/4156` *(+0/-0)*
- `apps/server/.airi-db/base/5/4157` *(+0/-0)*
- `apps/server/.airi-db/base/5/4158` *(+0/-0)*
- `apps/server/.airi-db/base/5/4159` *(+0/-0)*
- `apps/server/.airi-db/base/5/4160` *(+0/-0)*
- `apps/server/.airi-db/base/5/4163` *(+0/-0)*
- `apps/server/.airi-db/base/5/4164` *(+0/-0)*
- `apps/server/.airi-db/base/5/4165` *(+0/-0)*
- `apps/server/.airi-db/base/5/4166` *(+0/-0)*
- `apps/server/.airi-db/base/5/4167` *(+0/-0)*
- `apps/server/.airi-db/base/5/4168` *(+0/-0)*
- `apps/server/.airi-db/base/5/4169` *(+0/-0)*
- `apps/server/.airi-db/base/5/4170` *(+0/-0)*
- `apps/server/.airi-db/base/5/4171` *(+0/-0)*
- `apps/server/.airi-db/base/5/4172` *(+0/-0)*
- `apps/server/.airi-db/base/5/4173` *(+0/-0)*
- `apps/server/.airi-db/base/5/4174` *(+0/-0)*
- `apps/server/.airi-db/base/5/5002` *(+0/-0)*
- `apps/server/.airi-db/base/5/548` *(+0/-0)*
- `apps/server/.airi-db/base/5/549` *(+0/-0)*
- `apps/server/.airi-db/base/5/6102` *(+0/-0)*
- `apps/server/.airi-db/base/5/6104` *(+0/-0)*
- `apps/server/.airi-db/base/5/6106` *(+0/-0)*
- `apps/server/.airi-db/base/5/6110` *(+0/-0)*
- `apps/server/.airi-db/base/5/6111` *(+0/-0)*
- `apps/server/.airi-db/base/5/6112` *(+0/-0)*
- `apps/server/.airi-db/base/5/6113` *(+0/-0)*
- `apps/server/.airi-db/base/5/6116` *(+0/-0)*
- `apps/server/.airi-db/base/5/6117` *(+0/-0)*
- `apps/server/.airi-db/base/5/6175` *(+0/-0)*
- `apps/server/.airi-db/base/5/6176` *(+0/-0)*
- `apps/server/.airi-db/base/5/6228` *(+0/-0)*
- `apps/server/.airi-db/base/5/6229` *(+0/-0)*
- `apps/server/.airi-db/base/5/6237` *(+0/-0)*
- `apps/server/.airi-db/base/5/6238` *(+0/-0)*
- `apps/server/.airi-db/base/5/6239` *(+0/-0)*
- `apps/server/.airi-db/base/5/826` *(+0/-0)*
- `apps/server/.airi-db/base/5/827` *(+0/-0)*
- `apps/server/.airi-db/base/5/828` *(+0/-0)*
- `apps/server/.airi-db/base/5/PG_VERSION` *(+0/-1)*
- `apps/server/.airi-db/base/5/pg_filenode.map` *(+0/-0)*
- `apps/server/.airi-db/global/1213` *(+0/-0)*
- `apps/server/.airi-db/global/1213_fsm` *(+0/-0)*
- `apps/server/.airi-db/global/1213_vm` *(+0/-0)*
- `apps/server/.airi-db/global/1214` *(+0/-0)*
- `apps/server/.airi-db/global/1232` *(+0/-0)*
- `apps/server/.airi-db/global/1233` *(+0/-0)*
- `apps/server/.airi-db/global/1260` *(+0/-0)*
- `apps/server/.airi-db/global/1260_fsm` *(+0/-0)*
- `apps/server/.airi-db/global/1260_vm` *(+0/-0)*
- `apps/server/.airi-db/global/1261` *(+0/-0)*
- `apps/server/.airi-db/global/1261_fsm` *(+0/-0)*
- `apps/server/.airi-db/global/1261_vm` *(+0/-0)*
- `apps/server/.airi-db/global/1262` *(+0/-0)*
- `apps/server/.airi-db/global/1262_fsm` *(+0/-0)*
- `apps/server/.airi-db/global/1262_vm` *(+0/-0)*
- `apps/server/.airi-db/global/2396` *(+0/-0)*
- `apps/server/.airi-db/global/2396_fsm` *(+0/-0)*
- `apps/server/.airi-db/global/2396_vm` *(+0/-0)*
- `apps/server/.airi-db/global/2397` *(+0/-0)*
- `apps/server/.airi-db/global/2671` *(+0/-0)*
- `apps/server/.airi-db/global/2672` *(+0/-0)*
- `apps/server/.airi-db/global/2676` *(+0/-0)*
- `apps/server/.airi-db/global/2677` *(+0/-0)*
- `apps/server/.airi-db/global/2694` *(+0/-0)*
- `apps/server/.airi-db/global/2695` *(+0/-0)*
- `apps/server/.airi-db/global/2697` *(+0/-0)*
- `apps/server/.airi-db/global/2698` *(+0/-0)*
- `apps/server/.airi-db/global/2846` *(+0/-0)*
- `apps/server/.airi-db/global/2847` *(+0/-0)*
- `apps/server/.airi-db/global/2964` *(+0/-0)*
- `apps/server/.airi-db/global/2965` *(+0/-0)*
- `apps/server/.airi-db/global/2966` *(+0/-0)*
- `apps/server/.airi-db/global/2967` *(+0/-0)*
- `apps/server/.airi-db/global/3592` *(+0/-0)*
- `apps/server/.airi-db/global/3593` *(+0/-0)*
- `apps/server/.airi-db/global/4060` *(+0/-0)*
- `apps/server/.airi-db/global/4061` *(+0/-0)*
- `apps/server/.airi-db/global/4175` *(+0/-0)*
- `apps/server/.airi-db/global/4176` *(+0/-0)*
- `apps/server/.airi-db/global/4177` *(+0/-0)*
- `apps/server/.airi-db/global/4178` *(+0/-0)*
- `apps/server/.airi-db/global/4181` *(+0/-0)*
- `apps/server/.airi-db/global/4182` *(+0/-0)*
- `apps/server/.airi-db/global/4183` *(+0/-0)*
- `apps/server/.airi-db/global/4184` *(+0/-0)*
- `apps/server/.airi-db/global/4185` *(+0/-0)*
- `apps/server/.airi-db/global/4186` *(+0/-0)*
- `apps/server/.airi-db/global/6000` *(+0/-0)*
- `apps/server/.airi-db/global/6001` *(+0/-0)*
- `apps/server/.airi-db/global/6002` *(+0/-0)*
- `apps/server/.airi-db/global/6100` *(+0/-0)*
- `apps/server/.airi-db/global/6114` *(+0/-0)*
- `apps/server/.airi-db/global/6115` *(+0/-0)*
- `apps/server/.airi-db/global/6243` *(+0/-0)*
- `apps/server/.airi-db/global/6244` *(+0/-0)*
- `apps/server/.airi-db/global/6245` *(+0/-0)*
- `apps/server/.airi-db/global/6246` *(+0/-0)*
- `apps/server/.airi-db/global/6247` *(+0/-0)*
- `apps/server/.airi-db/global/6302` *(+0/-0)*
- `apps/server/.airi-db/global/6303` *(+0/-0)*
- `apps/server/.airi-db/global/pg_control` *(+0/-0)*
- `apps/server/.airi-db/global/pg_filenode.map` *(+0/-0)*
- `apps/server/.airi-db/pg_hba.conf` *(+0/-126)*
- `apps/server/.airi-db/pg_ident.conf` *(+0/-72)*
- `apps/server/.airi-db/pg_logical/replorigin_checkpoint` *(+0/-0)*
- `apps/server/.airi-db/pg_multixact/members/0000` *(+0/-0)*
- `apps/server/.airi-db/pg_multixact/offsets/0000` *(+0/-0)*
- `apps/server/.airi-db/pg_subtrans/0000` *(+0/-0)*
- `apps/server/.airi-db/pg_wal/000000010000000000000005` *(+0/-0)*
- `apps/server/.airi-db/pg_wal/000000010000000000000006` *(+0/-0)*
- `apps/server/.airi-db/pg_wal/000000010000000000000007` *(+0/-0)*
- `apps/server/.airi-db/pg_wal/000000010000000000000008` *(+0/-0)*
- `apps/server/.airi-db/pg_wal/000000010000000000000009` *(+0/-0)*
- `apps/server/.airi-db/pg_xact/0000` *(+0/-0)*
- `apps/server/.airi-db/postgresql.auto.conf` *(+0/-2)*
- `apps/server/.airi-db/postgresql.conf` *(+0/-842)*
- `apps/server/.airi-db/postmaster.pid` *(+0/-7)*
- `apps/server/.env` *(+0/-9)*
- `apps/server/.env.example` *(+15/-0)*
- `apps/server/Dockerfile` *(+3/-0)*
- `apps/server/docker-compose.yml` *(+4/-3)*
- `apps/server/drizzle/0001_add-missing-indexes.sql` *(+3/-0)*
- `apps/server/drizzle/meta/0001_snapshot.json` *(+1558/-0)*
- `apps/server/drizzle/meta/_journal.json` *(+7/-0)*
- `apps/server/production/railway/Dockerfile` *(+3/-0)*
- `apps/server/src/api/chats.schema.ts` *(+3/-3)*
- `apps/server/src/app.ts` *(+25/-2)*
- `apps/server/src/libs/auth.ts` *(+15/-1)*
- `apps/server/src/libs/db.ts` *(+2/-1)*
- `apps/server/src/libs/env.ts` *(+3/-1)*
- `apps/server/src/libs/otel.ts` *(+2/-30)*
- `apps/server/src/middlewares/__test__/require-origin.test.ts` *(+55/-0)*
- `apps/server/src/middlewares/otel.ts` *(+4/-2)*
- `apps/server/src/middlewares/require-origin.ts` *(+29/-0)*
- `apps/server/src/routes/__test__/characters.test.ts` *(+80/-0)*
- `apps/server/src/routes/__test__/providers.test.ts` *(+4/-0)*
- `apps/server/src/routes/characters.ts` *(+8/-5)*
- `apps/server/src/routes/providers.ts` *(+2/-0)*
- `apps/server/src/schemas/characters.ts` *(+2/-1)*
- `apps/server/src/schemas/chats.ts` *(+3/-1)*
- `apps/server/src/services/characters.ts` *(+43/-6)*
- `apps/server/src/services/chats.ts` *(+4/-0)*
- `apps/server/src/services/gdrive.ts` *(+2/-1)*
- `apps/server/src/services/providers.ts` *(+29/-3)*
- `apps/server/src/utils/origin.ts` *(+19/-4)*
- `apps/server/vitest.config.ts` *(+8/-4)*
- `apps/stage-mate/.gitignore` *(+0/-10)*
- `apps/stage-mate/harness/index.ts` *(+0/-598)*
- `apps/stage-mate/scripts/build.ts` *(+0/-151)*
- `apps/stage-mate/scripts/clean.ts` *(+0/-45)*
- `apps/stage-mate/scripts/fetch-runtime.ts` *(+0/-173)*
- `apps/stage-mate/scripts/logs.ts` *(+0/-57)*
- `apps/stage-mate/scripts/release.ts` *(+0/-141)*
- `apps/stage-mate/scripts/scene-tree.ts` *(+0/-679)*
- `apps/stage-mate/scripts/setup.ts` *(+0/-226)*
- `apps/stage-mate/test-model.outfits.json` *(+0/-46)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Cat Gun.meta` *(+0/-8)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Cat Gun/Cat Gun Controller.controller` *(+0/-162)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Cat Gun/Cat Gun Controller.controller.meta` *(+0/-8)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Cat Gun/Cat Gun Shooting.prefab` *(+0/-476)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Cat Gun/Cat Gun Shooting.prefab.meta` *(+0/-7)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Cat Gun/Cat Gun@FIre.anim` *(+0/-697)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Cat Gun/Cat Gun@FIre.anim.meta` *(+0/-8)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger.meta` *(+0/-8)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets.meta` *(+0/-10)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations.meta` *(+0/-10)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX.meta` *(+0/-10)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_B.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_B.FBX.meta` *(+0/-1791)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_BL.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_BL.FBX.meta` *(+0/-1791)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_BR.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_BR.FBX.meta` *(+0/-1791)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_F.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_F.FBX.meta` *(+0/-1600)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_FL.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_FL.FBX.meta` *(+0/-1792)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_FR.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_FR.FBX.meta` *(+0/-1791)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_L.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_L.FBX.meta` *(+0/-1791)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_R.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Run_R.FBX.meta` *(+0/-1791)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_B.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_B.FBX.meta` *(+0/-1788)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_BL.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_BL.FBX.meta` *(+0/-1789)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_BR.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_BR.FBX.meta` *(+0/-1788)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_F.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_F.FBX.meta` *(+0/-1788)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_FL.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_FL.FBX.meta` *(+0/-1788)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_FR.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_FR.FBX.meta` *(+0/-1788)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_L.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_L.FBX.meta` *(+0/-1790)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_R.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_8Way_Walk_R.FBX.meta` *(+0/-1788)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_AirCombo01_All.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_AirCombo01_All.FBX.meta` *(+0/-1801)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Attack01.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Attack01.FBX.meta` *(+0/-1797)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Attack02.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Attack02.FBX.meta` *(+0/-1801)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Attack03.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Attack03.FBX.meta` *(+0/-1810)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Attack04.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Attack04.FBX.meta` *(+0/-1812)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Attack05.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Attack05.FBX.meta` *(+0/-1799)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Block.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Block.FBX.meta` *(+0/-1789)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Combo01_All.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Combo01_All.FBX.meta` *(+0/-1801)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Combo02_All.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Combo02_All.FBX.meta` *(+0/-1801)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Combo03_All.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Combo03_All.FBX.meta` *(+0/-1812)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Combo04_All.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Combo04_All.FBX.meta` *(+0/-1812)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Crouch_Idle.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Crouch_Idle.FBX.meta` *(+0/-1779)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Crouch_Start.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Crouch_Start.FBX.meta` *(+0/-1787)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Crouch_end.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Crouch_end.FBX.meta` *(+0/-1789)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Die.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Die.FBX.meta` *(+0/-1803)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Equip.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Equip.FBX.meta` *(+0/-1805)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Equip_Idle.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Equip_Idle.FBX.meta` *(+0/-1780)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Evade_B.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Evade_B.FBX.meta` *(+0/-1800)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Evade_F.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Evade_F.FBX.meta` *(+0/-1799)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Evade_L.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Evade_L.FBX.meta` *(+0/-1801)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Evade_R.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Evade_R.FBX.meta` *(+0/-1800)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Getup.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Getup.FBX.meta` *(+0/-1802)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Guard.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Guard.FBX.meta` *(+0/-1781)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Handgun_Aim.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Handgun_Aim.FBX.meta` *(+0/-1782)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Handgun_Fire.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Handgun_Fire.FBX.meta` *(+0/-1790)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Hit01.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Hit01.FBX.meta` *(+0/-1799)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Hit02.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Hit02.FBX.meta` *(+0/-1802)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Hit03.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Hit03.FBX.meta` *(+0/-1802)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Hit_Knockback.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Hit_Knockback.FBX.meta` *(+0/-1804)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Hit_Knockdown.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Hit_Knockdown.FBX.meta` *(+0/-1802)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Hit_Knockdown_Loop.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Hit_Knockdown_Loop.FBX.meta` *(+0/-1779)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Jump_01.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Jump_01.FBX.meta` *(+0/-1800)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Jump_02.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Jump_02.FBX.meta` *(+0/-1803)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Jump_0H.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Jump_0H.FBX.meta` *(+0/-1800)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Rifle_Aim.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Rifle_Aim.FBX.meta` *(+0/-1783)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Rifle_Fire.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Rifle_Fire.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run01.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run01.FBX.meta` *(+0/-1793)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run01_Velocity.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run01_Velocity.FBX.meta` *(+0/-1793)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run02.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run02.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run02_Velocity.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run02_Velocity.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run03_Faster.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run03_Faster.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run03_Faster_Velocity.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run03_Faster_Velocity.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run04_HandGun_Aim.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run04_HandGun_Aim.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run04_HandGun_Aim_Velocity.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run04_HandGun_Aim_Velocity.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run05_ShotGun_Aim.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run05_ShotGun_Aim.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run05_ShotGun_Aim_Velocity.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run05_ShotGun_Aim_Velocity.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run06_Rifle_Aim.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run06_Rifle_Aim.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run06_Rifle_Aim_Velocity.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run06_Rifle_Aim_Velocity.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run07_Dual_Aim.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run07_Dual_Aim.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run07_Dual_Aim_Velocity.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Run07_Dual_Aim_Velocity.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Shotgun_Aim.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Shotgun_Aim.FBX.meta` *(+0/-1779)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Shotgun_Fire.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Shotgun_Fire.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Skill01.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Skill01.FBX.meta` *(+0/-1807)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Skill02.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Skill02.FBX.meta` *(+0/-1801)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Skill03.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Skill03.FBX.meta` *(+0/-1801)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Skill04.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Skill04.FBX.meta` *(+0/-1811)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Step_B.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Step_B.FBX.meta` *(+0/-1800)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Step_F.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Step_F.FBX.meta` *(+0/-1801)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Step_L.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Step_L.FBX.meta` *(+0/-1800)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Step_R.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Step_R.FBX.meta` *(+0/-1794)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Unequip.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Unequip.FBX.meta` *(+0/-1799)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Unequip_Idle.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Unequip_Idle.FBX.meta` *(+0/-1779)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Unequip_Run.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Unequip_Run.FBX.meta` *(+0/-1791)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Unequip_Run_Faster.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Unequip_Run_Faster.FBX.meta` *(+0/-1791)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Walk.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Walk.FBX.meta` *(+0/-1793)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Walk_Faster.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Walk_Faster.FBX.meta` *(+0/-1793)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Walk_Faster_Velocity.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Walk_Faster_Velocity.FBX.meta` *(+0/-1793)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Walk_Velocity.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/FBX/Frank_RPG_Gunslinger_Walk_Velocity.FBX.meta` *(+0/-1793)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/Frank_Gunslinger_Demo.controller` *(+0/-719)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Animations/Frank_Gunslinger_Demo.controller.meta` *(+0/-17)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Gunslinger.meta` *(+0/-8)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials.meta` *(+0/-10)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials/Frank_Gunslinger_Body.mat` *(+0/-76)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials/Frank_Gunslinger_Body.mat.meta` *(+0/-17)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials/Frank_Gunslinger_GunBlue.mat` *(+0/-76)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials/Frank_Gunslinger_GunBlue.mat.meta` *(+0/-17)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials/Frank_Gunslinger_Gunfire.mat` *(+0/-86)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials/Frank_Gunslinger_Gunfire.mat.meta` *(+0/-17)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials/Frank_Gunslinger_Shell_Color.mat` *(+0/-76)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials/Frank_Gunslinger_Shell_Color.mat.meta` *(+0/-17)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials/Frank_Gunslinger_Silver.mat` *(+0/-76)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials/Frank_Gunslinger_Silver.mat.meta` *(+0/-17)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials/Frank_Gunslinger_Tan.mat` *(+0/-76)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Materials/Frank_Gunslinger_Tan.mat.meta` *(+0/-17)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Meshes.meta` *(+0/-10)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Meshes/Frank_Gunslinger_Mask.mask` *(+0/-202)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Meshes/Frank_Gunslinger_Mask.mask.meta` *(+0/-17)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Meshes/Frank_Gunslinger_Skin.FBX` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Meshes/Frank_Gunslinger_Skin.FBX.meta` *(+0/-1236)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Meshes/akai_e_espiritu.fbx` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Meshes/akai_e_espiritu.fbx.meta` *(+0/-984)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Meshes/femalexxx.fbx` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Meshes/femalexxx.fbx.meta` *(+0/-1092)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Textures.meta` *(+0/-10)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Textures/Gunfire_FX.png` *(+0/-0)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Assets/Textures/Gunfire_FX.png.meta` *(+0/-85)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Demo.meta` *(+0/-10)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Demo/Frank_RPG_Gunslinger.unity` *(+0/-397)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Demo/Frank_RPG_Gunslinger.unity.meta` *(+0/-16)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Documentation.meta` *(+0/-10)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Documentation/Frank_Gunslinger_MotionList.txt` *(+0/-117)*
- `apps/stage-mate/unity-src/Assets/Gunslinger/Frank_RPG_Gunslinger/Documentation/Frank_Gunslinger_MotionList.txt.meta` *(+0/-16)*
- `apps/stage-mate/unity-src/Assets/MATE ENGINE - Mod SDK/MEClothes.cs` *(+0/-105)*
- `apps/stage-mate/unity-src/Assets/Resources/Gunslinger/Cat Gun Shooting.prefab` *(+0/-476)*
- `apps/stage-mate/unity-src/Assets/StageMate.meta` *(+0/-8)*
- `apps/stage-mate/unity-src/Assets/StageMate/Companion/StageMateLocomotion.cs` *(+0/-112)*
- `apps/stage-mate/unity-src/Assets/StageMate/Companion/StageMatePlushBed.cs` *(+0/-42)*
- `apps/stage-mate/unity-src/Assets/StageMate/Companion/StageMateTactileHandler.cs` *(+0/-129)*
- `apps/stage-mate/unity-src/Assets/StageMate/Core/MateTelemetryProbe.cs` *(+0/-198)*
- `apps/stage-mate/unity-src/Assets/StageMate/Core/StageMateBridge.cs` *(+0/-775)*
- `apps/stage-mate/unity-src/Assets/StageMate/Core/StageMateProtocol.cs` *(+0/-222)*
- `apps/stage-mate/unity-src/Assets/StageMate/Core/StageMateSocket.cs` *(+0/-279)*
- `apps/stage-mate/unity-src/Assets/StageMate/Core/StageMateStateSync.cs` *(+0/-319)*
- `apps/stage-mate/unity-src/Assets/StageMate/Effects/BulletHoleDecay.cs` *(+0/-56)*
- `apps/stage-mate/unity-src/Assets/StageMate/Effects/BulletHoleManager.cs` *(+0/-184)*
- `apps/stage-mate/unity-src/Assets/StageMate/MateSidecar.cs` *(+0/-1807)*
- `apps/stage-mate/unity-src/Assets/StageMate/MateSidecar.cs.meta` *(+0/-2)*
- `apps/stage-mate/unity-src/Assets/StageMate/MateSidecarBuild.cs` *(+0/-273)*
- `apps/stage-mate/unity-src/Assets/StageMate/MateSidecarBuild.cs.meta` *(+0/-2)*
- `apps/stage-mate/unity-src/Assets/StageMate/MateSidecarScene.unity` *(+0/-572)*
- `apps/stage-mate/unity-src/Assets/StageMate/MateSidecarScene.unity.meta` *(+0/-7)*
- `apps/stage-mate/unity-src/Assets/StageMate/Models/IStageModelDriver.cs` *(+0/-27)*
- `apps/stage-mate/unity-src/Assets/StageMate/Models/VrmModelDriver.cs` *(+0/-441)*
- `apps/stage-mate/unity-src/Assets/StageMate/Models/VrmSwayDriver.cs` *(+0/-90)*
- `apps/stage-mate/unity-src/Assets/StageMate/Native/MacScreenBridge.mm` *(+0/-46)*
- `apps/stage-mate/unity-src/Assets/StageMate/StageMateIdleA.anim` *(+0/-53)*
- `apps/stage-mate/unity-src/Assets/StageMate/StageMateIdleA.anim.meta` *(+0/-8)*
- `apps/stage-mate/unity-src/Assets/StageMate/StageMateIdleB.anim` *(+0/-53)*
- `apps/stage-mate/unity-src/Assets/StageMate/StageMateIdleB.anim.meta` *(+0/-8)*
- `apps/stage-mate/unity-src/Assets/StageMate/StageMateIdleController.controller` *(+0/-101)*
- `apps/stage-mate/unity-src/Assets/StageMate/StageMateIdleController.controller.meta` *(+0/-8)*
- `apps/stage-mate/unity-src/Assets/StageMate/Viewport/StageMateCameraRig.cs` *(+0/-80)*
- `apps/stage-mate/unity-src/Assets/StageMate/Viewport/StageMateViewportController.cs` *(+0/-172)*
- `apps/stage-mate/unity-src/Assets/StageMate/Window/StageMateBorderGlow.cs` *(+0/-247)*
- `apps/stage-mate/unity-src/Assets/StageMate/Window/StageMateShadowRig.cs` *(+0/-62)*
- `apps/stage-mate/unity-src/Assets/StageMate/Window/StageMateWindowManager.cs` *(+0/-192)*
- `apps/stage-mate/unity-src/Assets/StageMate/Window/StageMateWindowResizeHandle.cs` *(+0/-343)*
- `apps/stage-mate/unity-src/Assets/StreamingAssets/LLMManager.json` *(+0/-6)*
- `apps/stage-mate/unity-src/Assets/StreamingAssets/LLMManager.json.meta` *(+0/-7)*
- `apps/stage-mate/unity-src/Packages/Kirurobo/UniWindowController/Runtime/Scripts/UniWindowController.cs` *(+0/-1170)*
- `apps/stage-mate/unity-src/Patches/AvatarHandlers/AvatarAnimatorController.cs` *(+0/-520)*
- `apps/stage-mate/unity-src/Patches/AvatarHandlers/AvatarBigScreenScreenSaver.cs` *(+0/-274)*
- `apps/stage-mate/unity-src/Patches/AvatarHandlers/AvatarGravityController.cs` *(+0/-116)*
- `apps/stage-mate/unity-src/Patches/AvatarHandlers/AvatarHideHandler.cs` *(+0/-773)*
- `apps/stage-mate/unity-src/Patches/AvatarHandlers/AvatarLocomotionController.cs` *(+0/-824)*
- `apps/stage-mate/unity-src/Patches/AvatarHandlers/AvatarMouseTracking.cs` *(+0/-958)*
- `apps/stage-mate/unity-src/Patches/AvatarHandlers/AvatarRandomMessages.cs` *(+0/-349)*
- `apps/stage-mate/unity-src/Patches/AvatarHandlers/AvatarTaskbarController.cs` *(+0/-299)*
- `apps/stage-mate/unity-src/Patches/AvatarHandlers/AvatarWindowHandler.cs` *(+0/-1133)*
- `apps/stage-mate/unity-src/Patches/CustomVRM.prefab` *(+0/-563)*
- `apps/stage-mate/unity-src/Patches/CustomVRM.prefab.meta` *(+0/-7)*
- `apps/stage-mate/unity-src/Patches/GlobalMouse.cs` *(+0/-229)*
- `apps/stage-mate/unity-src/Patches/GlobalMouse.cs.meta` *(+0/-2)*
- `apps/stage-mate/unity-src/Patches/Settings/AvatarScaleController.cs` *(+0/-104)*
- `apps/stage-mate/unity-src/Patches/Settings/IgnoredAppsManager.cs` *(+0/-212)*
- `apps/stage-mate/unity-src/Patches/Settings/MenuActions.cs` *(+0/-303)*
- `apps/stage-mate/unity-src/Patches/Settings/MonitorHelper.cs` *(+0/-122)*
- `apps/stage-mate/unity-src/Patches/Settings/SaveLoadHandler.cs` *(+0/-300)*
- `apps/stage-mate/unity-src/Patches/Settings/SettingsMenuPosition.cs` *(+0/-141)*
- `apps/stage-mate/unity-src/Patches/Tasty Pie Menu/Scripts/CircleSelector.cs` *(+0/-477)*
- `apps/stage-mate/unity-src/Patches/VRMLoader/VRMLoader.cs` *(+0/-901)*
- `apps/stage-mate/unity-src/Patches/WinMessageBox.cs` *(+0/-29)*
- `apps/stage-mate/unity-src/Patches/WinMessageBox.cs.meta` *(+0/-2)*
- `apps/stage-mate/unity-src/Patches/WinMonitorUtil.cs` *(+0/-131)*
- `apps/stage-mate/unity-src/Patches/WinMonitorUtil.cs.meta` *(+0/-2)*
- `apps/stage-mate/unity-src/ProjectSettings/EditorBuildSettings.asset` *(+0/-14)*
- `apps/stage-mate/unity-src/build.sh` *(+0/-53)*
- `apps/stage-qt/Cargo.lock` *(+0/-1656)*
- `apps/stage-qt/Cargo.toml` *(+0/-27)*
- `apps/stage-qt/build.rs` *(+0/-25)*
- `apps/stage-qt/harness/index.ts` *(+0/-234)*
- `apps/stage-qt/qml/Caption.qml` *(+0/-37)*
- `apps/stage-qt/qml/Main.qml` *(+0/-86)*
- `apps/stage-qt/qml/StageScene.qml` *(+0/-38)*
- `apps/stage-qt/qml/VrmMtoonMaterial.qml` *(+0/-44)*
- `apps/stage-qt/qml/shaders/mtoon.frag` *(+0/-31)*
- `apps/stage-qt/qml/shaders/mtoon.vert` *(+0/-6)*
- `apps/stage-qt/src/cpp/stage_qt_bridge.cpp` *(+0/-21)*
- `apps/stage-qt/src/cpp/stage_qt_bridge.h` *(+0/-50)*
- `apps/stage-qt/src/cxxqt_object.rs` *(+0/-124)*
- `apps/stage-qt/src/main.rs` *(+0/-139)*
- `apps/stage-qt/src/protocol/mod.rs` *(+0/-117)*
- `apps/stage-qt/src/protocol/socket.rs` *(+0/-196)*
- `apps/stage-qt/src/vrm/mod.rs` *(+0/-46)*
- `apps/stage-qt/src/vrm/skin.rs` *(+0/-60)*
- `assets/icon.png` *(+0/-0)*
- `assets/test-models/synthetic/skeleton.json` *(+108/-0)*
- `assets/test-models/synthetic/synthetic.atlas` *(+7/-0)*
- `assets/test-models/synthetic/synthetic.png` *(+0/-0)*
- `assets/test-models/synthetic/synthetic.zip` *(+0/-0)*
- `crates/airi-a11y/Cargo.toml` *(+10/-0)*
- `crates/airi-a11y/src/client.rs` *(+379/-0)*
- `crates/airi-a11y/src/digest.rs` *(+503/-0)*
- `crates/airi-a11y/src/discover.rs` *(+120/-0)*
- `crates/airi-a11y/src/focus.rs` *(+256/-0)*
- `crates/airi-a11y/src/lib.rs` *(+35/-0)*
- `crates/airi-a11y/src/redact.rs` *(+204/-0)*
- `crates/airi-acp/Cargo.toml` *(+14/-0)*
- `crates/airi-acp/src/client.rs` *(+1881/-0)*
- `crates/airi-acp/src/error.rs` *(+107/-0)*
- `crates/airi-acp/src/jsonrpc.rs` *(+194/-0)*
- `crates/airi-acp/src/lib.rs` *(+82/-0)*
- `crates/airi-acp/src/permission.rs` *(+399/-0)*
- `crates/airi-acp/src/types.rs` *(+647/-0)*
- `crates/airi-acp/tests/stdio_mock.rs` *(+659/-0)*
- `crates/airi-channel/Cargo.toml` *(+26/-0)*
- `crates/airi-channel/examples/export-wire-types.rs` *(+64/-0)*
- `crates/airi-channel/src/audit.rs` *(+151/-0)*
- `crates/airi-channel/src/base64.rs` *(+48/-0)*
- `crates/airi-channel/src/certs.rs` *(+599/-0)*
- `crates/airi-channel/src/client.rs` *(+597/-0)*
- `crates/airi-channel/src/config.rs` *(+324/-0)*
- `crates/airi-channel/src/control.rs` *(+86/-0)*
- `crates/airi-channel/src/dispatch.rs` *(+697/-0)*
- `crates/airi-channel/src/lib.rs` *(+106/-0)*
- `crates/airi-channel/src/server.rs` *(+548/-0)*
- `crates/airi-channel/src/session.rs` *(+675/-0)*
- `crates/airi-channel/src/sha1.rs` *(+107/-0)*
- `crates/airi-channel/src/uuid.rs` *(+107/-0)*
- `crates/airi-channel/src/wire.rs` *(+491/-0)*
- `crates/airi-channel/src/ws.rs` *(+514/-0)*
- `crates/airi-channel/tests/channel_server.rs` *(+683/-0)*
- `crates/airi-channel/tests/client_gateway.rs` *(+168/-0)*
- `crates/airi-core/Cargo.toml` *(+41/-0)*
- `crates/airi-core/src/cards.rs` *(+2908/-0)*
- `crates/airi-core/src/chat.rs` *(+1276/-0)*
- `crates/airi-core/src/crashlog.rs` *(+307/-0)*
- `crates/airi-core/src/lib.rs` *(+227/-0)*
- `crates/airi-core/src/memory/embedding.rs` *(+297/-0)*
- `crates/airi-core/src/memory/journal.rs` *(+203/-0)*
- `crates/airi-core/src/memory/mod.rs` *(+37/-0)*
- `crates/airi-core/src/memory/retrieval.rs` *(+865/-0)*
- `crates/airi-core/src/memory/short_term.rs` *(+646/-0)*
- `crates/airi-core/src/providers.rs` *(+156/-0)*
- `crates/airi-core/src/sessions.rs` *(+104/-0)*
- `crates/airi-core/src/settings.rs` *(+1421/-0)*
- `crates/airi-core/src/single_instance.rs` *(+264/-0)*
- `crates/airi-core/src/update.rs` *(+321/-0)*
- `crates/airi-core/src/util.rs` *(+48/-0)*
- `crates/airi-core/src/vault.rs` *(+1489/-0)*
- `crates/airi-daemon/Cargo.toml` *(+29/-0)*
- `crates/airi-daemon/src/audit.rs` *(+327/-0)*
- `crates/airi-daemon/src/control.rs` *(+788/-0)*
- `crates/airi-daemon/src/core.rs` *(+149/-0)*
- `crates/airi-daemon/src/gateway.rs` *(+938/-0)*
- `crates/airi-daemon/src/lib.rs` *(+2/-0)*
- `crates/airi-daemon/src/main.rs` *(+832/-0)*
- `crates/airi-daemon/src/observe/logind.rs` *(+66/-0)*
- `crates/airi-daemon/src/observe/mod.rs` *(+89/-0)*
- `crates/airi-daemon/src/observe/mpris.rs` *(+125/-0)*
- `crates/airi-daemon/src/observe/network.rs` *(+105/-0)*
- `crates/airi-daemon/src/observe/screensaver.rs` *(+83/-0)*
- `crates/airi-daemon/src/observe/systemd1.rs` *(+204/-0)*
- `crates/airi-daemon/src/observe/upower.rs` *(+76/-0)*
- `crates/airi-daemon/src/redact.rs` *(+253/-0)*
- `crates/airi-daemon/src/ring.rs` *(+103/-0)*
- `crates/airi-daemon/src/screen.rs` *(+367/-0)*
- `crates/airi-daemon/src/state.rs` *(+354/-0)*
- `crates/airi-daemon/src/wake_facts.rs` *(+161/-0)*
- `crates/airi-daemon/tests/ownership.rs` *(+72/-0)*
- `crates/airi-discord/Cargo.toml` *(+19/-0)*
- `crates/airi-discord/src/client.rs` *(+300/-0)*
- `crates/airi-discord/src/error.rs` *(+67/-0)*
- `crates/airi-discord/src/gateway.rs` *(+724/-0)*
- `crates/airi-discord/src/lib.rs` *(+82/-0)*
- `crates/airi-discord/src/types.rs` *(+99/-0)*
- `crates/airi-discord/tests/gateway.rs` *(+470/-0)*
- `crates/airi-discord/tests/rest.rs` *(+358/-0)*
- `crates/airi-i18n/Cargo.toml` *(+17/-0)*
- `crates/airi-i18n/build.rs` *(+195/-0)*
- `crates/airi-i18n/src/lib.rs` *(+180/-0)*
- `crates/airi-laya/Cargo.toml` *(+28/-0)*
- `crates/airi-laya/src/error.rs` *(+148/-0)*
- `crates/airi-laya/src/lib.rs` *(+84/-0)*
- `crates/airi-laya/src/model.rs` *(+652/-0)*
- `crates/airi-laya/src/question.rs` *(+629/-0)*
- `crates/airi-laya/src/tokenizer.rs` *(+101/-0)*
- `crates/airi-llm/Cargo.toml` *(+27/-0)*
- `crates/airi-llm/src/client_anthropic.rs` *(+205/-0)*
- `crates/airi-llm/src/client_gemini.rs` *(+210/-0)*
- `crates/airi-llm/src/client_openai.rs` *(+164/-0)*
- `crates/airi-llm/src/client_stub.rs` *(+57/-0)*
- `crates/airi-llm/src/common.rs` *(+137/-0)*
- `crates/airi-llm/src/lib.rs` *(+279/-0)*
- `crates/airi-llm/src/registry.rs` *(+419/-0)*
- `crates/airi-llm/src/sse.rs` *(+125/-0)*
- `crates/airi-llm/src/stream.rs` *(+56/-0)*
- `crates/airi-llm/src/types.rs` *(+167/-0)*
- `crates/airi-llm/tests/mock_provider.rs` *(+432/-0)*
- `crates/airi-local-llm/Cargo.toml` *(+27/-0)*
- `crates/airi-local-llm/src/lib.rs` *(+686/-0)*
- `crates/airi-local-llm/src/prompt.rs` *(+166/-0)*
- `crates/airi-local-llm/src/stop.rs` *(+209/-0)*
- `crates/airi-local-llm/src/utf8.rs` *(+108/-0)*
- `crates/airi-mcp/Cargo.toml` *(+18/-0)*
- `crates/airi-mcp/src/client.rs` *(+414/-0)*
- `crates/airi-mcp/src/error.rs` *(+92/-0)*
- `crates/airi-mcp/src/http.rs` *(+776/-0)*
- `crates/airi-mcp/src/jsonrpc.rs` *(+429/-0)*
- `crates/airi-mcp/src/lib.rs` *(+70/-0)*
- `crates/airi-mcp/src/registry.rs` *(+242/-0)*
- `crates/airi-mcp/src/sse.rs` *(+247/-0)*
- `crates/airi-mcp/src/types.rs` *(+116/-0)*
- `crates/airi-mcp/tests/http_auth.rs` *(+351/-0)*
- `crates/airi-mcp/tests/http_mock.rs` *(+407/-0)*
- `crates/airi-mcp/tests/registry_mock.rs` *(+128/-0)*
- `crates/airi-mcp/tests/stdio_mock.rs` *(+153/-0)*
- `crates/airi-mmd/Cargo.toml` *(+19/-0)*
- `crates/airi-mmd/src/cursor.rs` *(+176/-0)*
- `crates/airi-mmd/src/error.rs` *(+66/-0)*
- `crates/airi-mmd/src/lib.rs` *(+104/-0)*
- `crates/airi-mmd/src/model.rs` *(+452/-0)*
- `crates/airi-mmd/src/pmx.rs` *(+693/-0)*
- `crates/airi-mmd/src/rest_pose.rs` *(+502/-0)*
- `crates/airi-mmd/src/vmd.rs` *(+348/-0)*
- `crates/airi-mmd/tests/common/mod.rs` *(+114/-0)*
- `crates/airi-mmd/tests/live_model.rs` *(+120/-0)*
- `crates/airi-mmd/tests/pmx_parse.rs` *(+674/-0)*
- `crates/airi-mmd/tests/rest_pose.rs` *(+478/-0)*
- `crates/airi-mmd/tests/synthetic_pmx.rs` *(+247/-0)*
- `crates/airi-mmd/tests/vmd_parse.rs` *(+424/-0)*
- `crates/airi-render/Cargo.toml` *(+23/-0)*
- `crates/airi-render/build.rs` *(+96/-0)*
- `crates/airi-render/cpp/spine_shell.cpp` *(+403/-0)*
- `crates/airi-render/cpp/spine_shell.h` *(+119/-0)*
- `crates/airi-render/src/bundle.rs` *(+539/-0)*
- `crates/airi-render/src/lib.rs` *(+12/-0)*
- `crates/airi-render/src/spine/animation.rs` *(+154/-0)*
- `crates/airi-render/src/spine/atlas.rs` *(+440/-0)*
- `crates/airi-render/src/spine/mod.rs` *(+21/-0)*
- `crates/airi-render/src/spine/session.rs` *(+338/-0)*
- `crates/airi-render/src/spine/skeleton.rs` *(+321/-0)*
- `crates/airi-render/src/spine/version.rs` *(+190/-0)*
- `{apps/stage-qt => crates/airi-render}/src/vrm/doc.rs` *(+40/-8)*
- `crates/airi-render/src/vrm/engine.rs` *(+1080/-0)*
- `{apps/stage-qt => crates/airi-render}/src/vrm/expression.rs` *(+0/-0)*
- `{apps/stage-qt => crates/airi-render}/src/vrm/gaze.rs` *(+0/-0)*
- `{apps/stage-qt => crates/airi-render}/src/vrm/geometry.rs` *(+15/-20)*
- `{apps/stage-qt => crates/airi-render}/src/vrm/idle.rs` *(+0/-0)*
- `{apps/stage-qt => crates/airi-render}/src/vrm/lipsync.rs` *(+0/-0)*
- `{apps/stage-qt => crates/airi-render}/src/vrm/materials.rs` *(+2/-2)*
- `crates/airi-render/src/vrm/math.rs` *(+604/-0)*
- `crates/airi-render/src/vrm/mod.rs` *(+48/-0)*
- `{apps/stage-qt => crates/airi-render}/src/vrm/morph.rs` *(+11/-13)*
- `crates/airi-render/src/vrm/skin.rs` *(+57/-0)*
- `{apps/stage-qt => crates/airi-render}/src/vrm/springbone.rs` *(+2/-8)*
- `crates/airi-render/tests/spine_session.rs` *(+142/-0)*
- `crates/airi-slint/Cargo.toml` *(+48/-0)*
- `crates/airi-slint/build.rs` *(+13/-0)*
- `crates/airi-slint/src/bridges/acp.rs` *(+847/-0)*
- `crates/airi-slint/src/bridges/capture.rs` *(+1314/-0)*
- `crates/airi-slint/src/bridges/cards.rs` *(+464/-0)*
- `crates/airi-slint/src/bridges/chat.rs` *(+2032/-0)*
- `crates/airi-slint/src/bridges/daemon.rs` *(+1495/-0)*
- `crates/airi-slint/src/bridges/data.rs` *(+253/-0)*
- `crates/airi-slint/src/bridges/desktop.rs` *(+477/-0)*
- `crates/airi-slint/src/bridges/discord.rs` *(+497/-0)*
- `crates/airi-slint/src/bridges/discord_gateway.rs` *(+875/-0)*
- `crates/airi-slint/src/bridges/hearing.rs` *(+342/-0)*
- `crates/airi-slint/src/bridges/i18n.rs` *(+73/-0)*
- `crates/airi-slint/src/bridges/mcp.rs` *(+853/-0)*
- `crates/airi-slint/src/bridges/memory.rs` *(+643/-0)*
- `crates/airi-slint/src/bridges/mmd.rs` *(+351/-0)*
- `crates/airi-slint/src/bridges/mod.rs` *(+154/-0)*
- `crates/airi-slint/src/bridges/providers.rs` *(+712/-0)*
- `crates/airi-slint/src/bridges/settings_chat.rs` *(+155/-0)*
- `crates/airi-slint/src/bridges/settings_general.rs` *(+135/-0)*
- `crates/airi-slint/src/bridges/settings_sections.rs` *(+604/-0)*
- `crates/airi-slint/src/bridges/settings_stage.rs` *(+418/-0)*
- `crates/airi-slint/src/bridges/settings_tests.rs` *(+589/-0)*
- `crates/airi-slint/src/bridges/shell.rs` *(+42/-0)*
- `crates/airi-slint/src/bridges/speech.rs` *(+603/-0)*
- `crates/airi-slint/src/bridges/spine.rs` *(+129/-0)*
- `crates/airi-slint/src/bridges/stage.rs` *(+459/-0)*
- `crates/airi-slint/src/bridges/sync.rs` *(+521/-0)*
- `crates/airi-slint/src/bridges/theme.rs` *(+89/-0)*
- `crates/airi-slint/src/bridges/update.rs` *(+83/-0)*
- `crates/airi-slint/src/bridges/windows.rs` *(+84/-0)*
- `crates/airi-slint/src/daemon_mode.rs` *(+124/-0)*
- `crates/airi-slint/src/lib.rs` *(+11/-0)*
- `crates/airi-slint/src/main.rs` *(+334/-0)*
- `crates/airi-slint/src/spine_render.rs` *(+372/-0)*
- `crates/airi-slint/src/spine_rt.rs` *(+239/-0)*
- `crates/airi-slint/src/ui/I18n.slint` *(+23/-0)*
- `crates/airi-slint/src/ui/SpineStage.slint` *(+35/-0)*
- `crates/airi-slint/src/ui/Theme.slint` *(+43/-0)*
- `crates/airi-slint/src/ui/bootstrap.slint` *(+54/-0)*
- `crates/airi-slint/src/ui/components/ABadge.slint` *(+36/-0)*
- `crates/airi-slint/src/ui/components/AButton.slint` *(+64/-0)*
- `crates/airi-slint/src/ui/components/ACard.slint` *(+24/-0)*
- `crates/airi-slint/src/ui/components/AEmptyState.slint` *(+48/-0)*
- `crates/airi-slint/src/ui/components/AInputNumber.slint` *(+96/-0)*
- `crates/airi-slint/src/ui/components/AListItem.slint` *(+64/-0)*
- `crates/airi-slint/src/ui/components/AModal.slint` *(+65/-0)*
- `crates/airi-slint/src/ui/components/AProgress.slint` *(+27/-0)*
- `crates/airi-slint/src/ui/components/ASelect.slint` *(+91/-0)*
- `crates/airi-slint/src/ui/components/ASeparator.slint` *(+15/-0)*
- `crates/airi-slint/src/ui/components/ASlider.slint` *(+57/-0)*
- `crates/airi-slint/src/ui/components/ASwitch.slint` *(+55/-0)*
- `crates/airi-slint/src/ui/components/ATextArea.slint` *(+49/-0)*
- `crates/airi-slint/src/ui/components/ATextField.slint` *(+51/-0)*
- `crates/airi-slint/src/ui/components/AToggleGroup.slint` *(+28/-0)*
- `crates/airi-slint/src/ui/components/ATooltip.slint` *(+29/-0)*
- `crates/airi-slint/src/ui/main.slint` *(+37/-0)*
- `crates/airi-slint/src/ui/shell/AboutWindow.slint` *(+164/-0)*
- `crates/airi-slint/src/ui/shell/ChatWindow.slint` *(+216/-0)*
- `crates/airi-slint/src/ui/shell/MainShell.slint` *(+189/-0)*
- `crates/airi-slint/src/ui/shell/SettingsWindow.slint` *(+113/-0)*
- `crates/airi-slint/src/ui/shell/Splash.slint` *(+79/-0)*
- `crates/airi-slint/test-models/synthetic/skeleton.json` *(+108/-0)*
- `crates/airi-slint/test-models/synthetic/synthetic.atlas` *(+7/-0)*
- `crates/airi-slint/test-models/synthetic/synthetic.png` *(+0/-0)*
- `crates/airi-slint/test-models/synthetic/synthetic.zip` *(+0/-0)*
- `crates/airi-speech/Cargo.toml` *(+34/-0)*
- `crates/airi-speech/src/cache.rs` *(+290/-0)*
- `crates/airi-speech/src/client_common.rs` *(+93/-0)*
- `crates/airi-speech/src/client_elevenlabs.rs` *(+184/-0)*
- `crates/airi-speech/src/client_gemini.rs` *(+165/-0)*
- `crates/airi-speech/src/client_kokoro.rs` *(+732/-0)*
- `crates/airi-speech/src/client_kokoro/kokoro_vocab.rs` *(+188/-0)*
- `crates/airi-speech/src/client_mimo.rs` *(+134/-0)*
- `crates/airi-speech/src/client_minimax.rs` *(+180/-0)*
- `crates/airi-speech/src/client_noop.rs` *(+40/-0)*
- `crates/airi-speech/src/client_openai.rs` *(+127/-0)*
- `crates/airi-speech/src/client_openrouter.rs` *(+176/-0)*
- `crates/airi-speech/src/client_player2.rs` *(+132/-0)*
- `crates/airi-speech/src/client_polly.rs` *(+304/-0)*
- `crates/airi-speech/src/client_unspeech.rs` *(+232/-0)*
- `crates/airi-speech/src/client_voicevox.rs` *(+172/-0)*
- `crates/airi-speech/src/config.rs` *(+388/-0)*
- `crates/airi-speech/src/error.rs` *(+35/-0)*
- `crates/airi-speech/src/lib.rs` *(+62/-0)*
- `crates/airi-speech/src/pipeline.rs` *(+273/-0)*
- `crates/airi-speech/src/player.rs` *(+286/-0)*
- `crates/airi-speech/src/synth.rs` *(+32/-0)*
- `crates/airi-speech/src/tap.rs` *(+117/-0)*
- `crates/airi-speech/src/types.rs` *(+134/-0)*
- `crates/airi-speech/src/wav.rs` *(+79/-0)*
- `crates/airi-speech/tests/mock_tts_e2e.rs` *(+304/-0)*
- `crates/airi-store/Cargo.toml` *(+17/-0)*
- `crates/airi-store/src/lib.rs` *(+1855/-0)*
- `crates/airi-stt/Cargo.toml` *(+42/-0)*
- `crates/airi-stt/examples/capture_probe.rs` *(+46/-0)*
- `crates/airi-stt/examples/vad_probe.rs` *(+136/-0)*
- `crates/airi-stt/src/capture.rs` *(+553/-0)*
- `crates/airi-stt/src/lib.rs` *(+18/-0)*
- `crates/airi-stt/src/mic.rs` *(+907/-0)*
- `crates/airi-stt/src/stt.rs` *(+410/-0)*
- `crates/airi-stt/src/stt/aliyun.rs` *(+479/-0)*
- `crates/airi-stt/src/stt/deepgram.rs` *(+260/-0)*
- `crates/airi-stt/src/stt/openai.rs` *(+159/-0)*
- `crates/airi-stt/src/stt/whisper_local.rs` *(+654/-0)*
- `crates/airi-stt/src/vad.rs` *(+683/-0)*
- `crates/airi-stt/tests/common/mod.rs` *(+162/-0)*
- `crates/airi-stt/tests/mock_stt.rs` *(+120/-0)*
- `crates/airi-sync/Cargo.toml` *(+18/-0)*
- `crates/airi-sync/src/error.rs` *(+90/-0)*
- `crates/airi-sync/src/lib.rs` *(+85/-0)*
- `crates/airi-sync/src/manifest.rs` *(+222/-0)*
- `crates/airi-sync/src/ops.rs` *(+936/-0)*
- `crates/airi-sync/src/timefmt.rs` *(+74/-0)*
- `crates/airi-sync/tests/sync_tests.rs` *(+775/-0)*
- `eslint.config.js` *(+11/-2)*
- `install.bat` *(+3/-15)*
- `install_airi.sh` *(+6/-10)*
- `install_isolated.sh` *(+5/-12)*
- `packages/cap-vite/src/bin/run.ts` *(+0/-24)*
- `packages/cap-vite/src/cli.test.ts` *(+0/-41)*
- `packages/cap-vite/src/cli.ts` *(+0/-55)*
- `packages/cap-vite/src/index.test.ts` *(+0/-79)*
- `packages/cap-vite/src/index.ts` *(+0/-176)*
- `packages/cap-vite/src/native.test.ts` *(+0/-84)*
- `packages/cap-vite/src/native.ts` *(+0/-140)*
- `packages/cap-vite/src/vite-plugin.ts` *(+0/-124)*
- `packages/cap-vite/src/vite-wrapper-config.test.ts` *(+0/-76)*
- `packages/cap-vite/src/vite-wrapper-config.ts` *(+0/-51)*
- `packages/cap-vite/tsdown.config.ts` *(+0/-14)*
- `packages/cap-vite/vitest.config.ts` *(+0/-13)*
- `packages/electrobun-eventa/src/contract.ts` *(+131/-0)*
- `packages/electrobun-eventa/src/index.ts` *(+29/-0)*
- `packages/electrobun-eventa/src/main.ts` *(+87/-0)*
- `packages/electrobun-eventa/src/shared.ts` *(+181/-0)*
- `packages/electrobun-eventa/src/view.ts` *(+72/-0)*
- `packages/electrobun-eventa/test/adapter.test.ts` *(+209/-0)*
- `packages/electrobun-eventa/vitest.config.ts` *(+8/-0)*
- `packages/nan0-runtime/src/persistence/LocalStorageStateStore.test.ts` *(+47/-0)*
- `packages/nan0-runtime/src/persistence/LocalStorageStateStore.ts` *(+42/-2)*
- `packages/server-runtime/src/index.test.ts` *(+141/-0)*
- `packages/server-runtime/src/index.ts` *(+31/-5)*
- `packages/server-runtime/src/middlewares/route.test.ts` *(+47/-3)*
- `packages/server-runtime/src/middlewares/route.ts` *(+17/-8)*
- `packages/server-runtime/src/server/index.ts` *(+1/-6)*
- `packages/server-shared/src/types/generated/airi-channel.ts` *(+272/-0)*
- `packages/server-shared/src/types/index.ts` *(+2/-0)*
- `packages/stage-shared/src/index.ts` *(+0/-1)*
- `packages/stage-shared/src/process-spawner.ts` *(+5/-1)*
- `packages/stage-shared/src/stage-mate.ts` *(+0/-99)*
- `packages/stage-shared/src/utils/radial-geometry.ts` *(+2/-2)*
- `packages/stage-ui/{.env => .env.example}` *(+0/-0)*
- `packages/stage-ui/public/assets/animadex-catalog.json` *(+0/-1)*
- `packages/stage-ui/src/components/scenarios/chat/ChatWorkspaceWidgetsPanel.vue` *(+2/-2)*
- `packages/stage-ui/src/components/scenarios/consciousness/useConsciousnessConfig.ts` *(+1/-3)*
- `packages/stage-ui/src/components/scenarios/dialogs/model-selector/model-selector.vue` *(+1/-1)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-2-consciousness.vue` *(+3/-7)*
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-consciousness.vue` *(+8/-12)*
- `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue` *(+2/-252)*
- `packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue` *(+1/-96)*
- `packages/stage-ui/src/composables/use-control-strip-action.ts` *(+0/-4)*
- `packages/stage-ui/src/composables/use-data-maintenance.ts` *(+2/-13)*
- `packages/stage-ui/src/composables/use-expression-curation.ts` *(+2/-10)*
- `packages/stage-ui/src/composables/use-process-spawner.test.ts` *(+77/-7)*
- `packages/stage-ui/src/composables/use-process-spawner.ts` *(+6/-2)*
- `packages/stage-ui/src/constants/control-customizer.ts` *(+1/-20)*
- `packages/stage-ui/src/database/storage.ts` *(+26/-4)*
- `packages/stage-ui/src/libs/native-ai/index.ts` *(+130/-391)*
- `packages/stage-ui/src/libs/sandbox/manager.ts` *(+53/-10)*
- `packages/stage-ui/src/libs/sandbox/mcp-bridge.test.ts` *(+44/-0)*
- `packages/stage-ui/src/libs/sandbox/mcp-bridge.ts` *(+27/-2)*
- `packages/stage-ui/src/libs/secret-storage-keys.ts` *(+41/-0)*
- `packages/stage-ui/src/stores/backup.test.ts` *(+58/-0)*
- `packages/stage-ui/src/stores/backup.ts` *(+23/-5)*
- `packages/stage-ui/src/stores/companion.test.ts` *(+137/-2)*
- `packages/stage-ui/src/stores/companion.ts` *(+16/-2)*
- `packages/stage-ui/src/stores/devtools/websocket-inspector.test.ts` *(+22/-0)*
- `packages/stage-ui/src/stores/devtools/websocket-inspector.ts` *(+15/-1)*
- `packages/stage-ui/src/stores/echo-chips.ts` *(+35/-19)*
- `packages/stage-ui/src/stores/mcp-tool-bridge.test.ts` *(+22/-1)*
- `packages/stage-ui/src/stores/mcp-tool-bridge.ts` *(+51/-22)*
- `packages/stage-ui/src/stores/mods/api/channel-server.test.ts` *(+144/-0)*
- `packages/stage-ui/src/stores/mods/api/channel-server.ts` *(+62/-5)*
- `packages/stage-ui/src/stores/modules/cloudflare.ts` *(+0/-4)*
- `packages/stage-ui/src/stores/modules/screen-watcher.ts` *(+1/-32)*
- `packages/stage-ui/src/stores/settings/control-strip.ts` *(+0/-4)*
- `packages/stage-ui/src/stores/settings/index.ts` *(+0/-1)*
- `packages/stage-ui/src/stores/settings/stage-model.ts` *(+6/-108)*
- `packages/stage-ui/src/stores/sync-engine-merge.test.ts` *(+127/-1)*
- `packages/stage-ui/src/stores/sync-engine-merge.ts` *(+100/-26)*
- `packages/stage-ui/src/stores/sync-engine-outbox.test.ts` *(+20/-0)*
- `packages/stage-ui/src/stores/sync-engine-safeguards.test.ts` *(+544/-1)*
- `packages/stage-ui/src/stores/sync-engine.ts` *(+346/-310)*
- `packages/stage-ui/src/stores/sync-lease.test.ts` *(+65/-0)*
- `packages/stage-ui/src/stores/sync-lease.ts` *(+71/-0)*
- `packages/stage-ui/src/stores/sync-tombstones.ts` *(+59/-0)*
- `packages/stage-ui/src/tools/mcp.ts` *(+7/-29)*
- `packaging/airi-qt.png` *(+0/-0)*
- `packaging/airi-slint.desktop` *(+12/-0)*
- `packaging/build-deb.sh` *(+100/-0)*
- `packaging/dbus/org.moeru.airi.Daemon1.service` *(+14/-0)*
- `packaging/systemd/airi-daemon.service` *(+54/-0)*
- `patches/node-gyp@11.5.0.patch` *(+0/-51)*
- `pnpm-workspace.yaml` *(+0/-10)*
- `reports/memory-lab/batch-size-isolation-experiment.json` *(+0/-526)*
- `reports/memory-lab/datasets/locomo-conv47-embeddings-windowed.json` *(+0/-1)*
- `reports/memory-lab/datasets/locomo-conv47-embeddings.json` *(+0/-1)*
- `reports/memory-lab/datasets/locomo-conv47-ledger-jev.json` *(+0/-15661)*
- `reports/memory-lab/datasets/locomo-conv47-ledger-pass3.json` *(+0/-22776)*
- `reports/memory-lab/datasets/locomo-conv47-ledger.json` *(+0/-15639)*
- `reports/memory-lab/datasets/locomo-conv47-question-embeddings.json` *(+0/-1)*
- `reports/memory-lab/datasets/locomo-conv47.json` *(+0/-7169)*
- `reports/memory-lab/datasets/locomo10.json` *(+0/-66751)*
- `reports/memory-lab/locomo-conv47-jev-trace.json` *(+0/-8976)*
- `reports/memory-lab/locomo-conv47-pass10-anaphora-trace.json` *(+0/-34266)*
- `reports/memory-lab/locomo-conv47-pass11-jev-trace.json` *(+0/-41801)*
- `reports/memory-lab/locomo-conv47-pass11-laya-trace.json` *(+0/-49555)*
- `reports/memory-lab/locomo-conv47-pass2-trace.json` *(+0/-14883)*
- `reports/memory-lab/locomo-conv47-pass3-trace.json` *(+0/-16255)*
- `reports/memory-lab/locomo-conv47-pass4-trace.json` *(+0/-16269)*
- `reports/memory-lab/locomo-conv47-pass5-trace.json` *(+0/-16522)*
- `reports/memory-lab/locomo-conv47-pass6-trace.json` *(+0/-16924)*
- `reports/memory-lab/locomo-conv47-pass7-trace.json` *(+0/-16912)*
- `reports/memory-lab/locomo-conv47-pass8-trace.json` *(+0/-17086)*
- `reports/memory-lab/locomo-conv47-pass9-laya-trace.json` *(+0/-26753)*
- `reports/memory-lab/locomo-conv47-pass9-trace.json` *(+0/-18998)*
- `reports/memory-lab/locomo-conv47-shootout-trace.json` *(+0/-12144)*
- `reports/memory-lab/locomo-conv47-triage-trace.json` *(+0/-2586)*
- `reports/nan0-cleanroom/famous-sentence-matrix-1789601152.json` *(+0/-386)*
- `reports/nan0-cleanroom/famous-sentence-matrix-1789602613.json` *(+0/-644)*
- `reports/nan0-cleanroom/famous-sentence-matrix-1789604021.json` *(+0/-662)*
- `reports/nan0-cleanroom/nan0-laya-vs-jev-shootout-trace.json` *(+0/-10605)*
- `reports/nan0-cleanroom/nan0-probe-benchmark-v1-run-1789605812.json` *(+0/-938)*
- `reports/nan0-cleanroom/nan0-probe-benchmark-v1.json` *(+0/-1319)*
- `reports/nan0-cleanroom/nan0-probe-benchmark-v2-jev-run-1789747783.json` *(+0/-1402)*
- `reports/nan0-cleanroom/nan0-probe-benchmark-v2-phase5-diagnostic.json` *(+0/-6203)*
- `reports/nan0-cleanroom/nan0-probe-benchmark-v2-phase5-run.json` *(+0/-4330)*
- `reports/nan0-cleanroom/nan0-probe-benchmark-v2-pragmatics-run-1789694077.json` *(+0/-4186)*
- `reports/nan0-cleanroom/nan0-probe-benchmark-v2-pragmatics-run-1789695835.json` *(+0/-5156)*
- `reports/nan0-cleanroom/nan0-probe-benchmark-v2-pragmatics-run-1789697089.json` *(+0/-5156)*
- `reports/nan0-cleanroom/nan0-probe-benchmark-v2-pragmatics.json` *(+0/-2191)*
- `reports/nan0-cleanroom/nan0-shallow-vs-rich-shootout-trace.json` *(+0/-10231)*
- `reports/nan0-cleanroom/nan0-v1-vs-v2-shootout-trace.json` *(+0/-23699)*
- `apps/stage-qt/rust-toolchain.toml => rust-toolchain.toml` *(+0/-0)*
- `scratch/monitor-ws.js` *(+0/-53)*
- `scratch/moss/app_local_transformer.py` *(+0/-130)*
- `scratch/moss/app_nano_c.py` *(+0/-147)*
- `scratch/moss/app_v1.5.py` *(+0/-712)*
- `scratch/pitch_slider_zips/Pitch slider - part 2/Log.txt` *(+0/-68)*
- `scratch/pitch_slider_zips/Pitch slider - part 2/Stage.vue` *(+0/-1333)*
- `scratch/pitch_slider_zips/Pitch slider - part 2/speech.ts` *(+0/-470)*
- `scratch/pitch_slider_zips/Pitch slider - part 2/speech.vue` *(+0/-767)*
- `scratch/pitch_slider_zips/Pitch slider/Log.txt` *(+0/-37)*
- `scratch/pitch_slider_zips/Pitch slider/Stage.vue` *(+0/-1234)*
- `scratch/pitch_slider_zips/Pitch slider/speech.ts` *(+0/-452)*
- `scratch/recover_data.js` *(+0/-104)*
- `scratch/repro_marker_bug.ts` *(+0/-30)*
- `scratch/test-i18n-src.ts` *(+0/-8)*
- `scratch/test-i18n.ts` *(+0/-8)*
- `start_airi.bat` *(+0/-13)*
- `start_airi.sh` *(+5/-14)*
- `start_airi_customport.bat` *(+2/-2)*
- `start_airi_hiperf.bat` *(+1/-9)*
- `start_airi_isolated.sh` *(+4/-7)*
- `start_airi_preview.sh` *(+4/-8)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Animation.h` *(+132/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/AnimationState.h` *(+491/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/AnimationStateData.h` *(+87/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Atlas.h` *(+132/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/AtlasAttachmentLoader.h` *(+72/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Attachment.h` *(+62/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/AttachmentLoader.h` *(+82/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/AttachmentTimeline.h` *(+82/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/AttachmentType.h` *(+45/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/BlendMode.h` *(+42/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Bone.h` *(+272/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/BoneData.h` *(+140/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/BoundingBoxAttachment.h` *(+54/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/ClippingAttachment.h` *(+65/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Color.h` *(+110/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/ColorTimeline.h` *(+197/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/ConstraintData.h` *(+65/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/ContainerUtil.h` *(+129/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/CurveTimeline.h` *(+103/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Debug.h` *(+131/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/DeformTimeline.h` *(+80/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/DrawOrderTimeline.h` *(+61/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Event.h` *(+86/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/EventData.h` *(+86/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/EventTimeline.h` *(+62/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Extension.h` *(+125/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/HasRendererObject.h` *(+65/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/HashMap.h` *(+198/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/IkConstraint.h` *(+119/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/IkConstraintData.h` *(+100/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/IkConstraintTimeline.h` *(+70/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Json.h` *(+116/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/LinkedMesh.h` *(+57/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Log.h` *(+57/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/MathUtil.h` *(+129/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/MeshAttachment.h` *(+159/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/MixBlend.h` *(+45/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/MixDirection.h` *(+44/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/PathAttachment.h` *(+70/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/PathConstraint.h` *(+134/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/PathConstraintData.h` *(+118/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/PathConstraintMixTimeline.h` *(+69/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/PathConstraintPositionTimeline.h` *(+64/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/PathConstraintSpacingTimeline.h` *(+59/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/PointAttachment.h` *(+81/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Pool.h` *(+74/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/PositionMode.h` *(+40/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Property.h` *(+58/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/RTTI.h` *(+72/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/RegionAttachment.h` *(+157/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/RotateMode.h` *(+41/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/RotateTimeline.h` *(+61/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/ScaleTimeline.h` *(+109/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/ShearTimeline.h` *(+109/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Skeleton.h` *(+260/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/SkeletonBinary.h` *(+161/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/SkeletonBounds.h` *(+110/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/SkeletonClipping.h` *(+85/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/SkeletonData.h` *(+182/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/SkeletonJson.h` *(+110/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Skin.h` *(+167/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Slot.h` *(+137/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/SlotData.h` *(+121/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/SpacingMode.h` *(+42/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/SpineObject.h` *(+59/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/SpineString.h` *(+212/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/TextureLoader.h` *(+51/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Timeline.h` *(+86/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/TransformConstraint.h` *(+111/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/TransformConstraintData.h` *(+96/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/TransformConstraintTimeline.h` *(+71/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/TransformMode.h` *(+43/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/TranslateTimeline.h` *(+113/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Triangulator.h` *(+70/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Updatable.h` *(+53/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Vector.h` *(+222/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/VertexAttachment.h` *(+101/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/VertexEffect.h` *(+120/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/Vertices.h` *(+43/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/dll.h` *(+51/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/include/spine/spine.h` *(+111/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Animation.cpp` *(+111/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/AnimationState.cpp` *(+1053/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/AnimationStateData.cpp` *(+85/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Atlas.cpp` *(+356/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/AtlasAttachmentLoader.cpp` *(+128/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Attachment.cpp` *(+63/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/AttachmentLoader.cpp` *(+52/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/AttachmentTimeline.cpp` *(+104/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Bone.cpp` *(+539/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/BoneData.cpp` *(+152/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/BoundingBoxAttachment.cpp` *(+51/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/ClippingAttachment.cpp` *(+62/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/ColorTimeline.cpp` *(+497/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/ConstraintData.cpp` *(+62/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/CurveTimeline.cpp` *(+154/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/DeformTimeline.cpp` *(+332/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/DrawOrderTimeline.cpp` *(+106/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Event.cpp` *(+94/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/EventData.cpp` *(+100/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/EventTimeline.cpp` *(+103/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Extension.cpp` *(+127/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/IkConstraint.cpp` *(+360/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/IkConstraintData.cpp` *(+109/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/IkConstraintTimeline.cpp` *(+145/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Json.cpp` *(+565/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/LinkedMesh.cpp` *(+46/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Log.cpp` *(+123/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/MathUtil.cpp` *(+128/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/MeshAttachment.cpp` *(+337/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/PathAttachment.cpp` *(+75/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/PathConstraint.cpp` *(+586/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/PathConstraintData.cpp` *(+138/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/PathConstraintMixTimeline.cpp` *(+130/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/PathConstraintPositionTimeline.cpp` *(+91/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/PathConstraintSpacingTimeline.cpp` *(+88/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/PointAttachment.cpp` *(+94/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/RTTI.cpp` *(+60/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/RegionAttachment.cpp` *(+306/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/RotateTimeline.cpp` *(+88/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/ScaleTimeline.cpp` *(+304/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/ShearTimeline.cpp` *(+218/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Skeleton.cpp` *(+702/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/SkeletonBinary.cpp` *(+1318/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/SkeletonBounds.cpp` *(+222/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/SkeletonClipping.cpp` *(+327/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/SkeletonData.cpp` *(+229/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/SkeletonJson.cpp` *(+1436/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Skin.cpp` *(+199/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Slot.cpp` *(+132/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/SlotData.cpp` *(+94/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/SpineObject.cpp` *(+67/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/TextureLoader.cpp` *(+42/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Timeline.cpp` *(+78/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/TransformConstraint.cpp` *(+344/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/TransformConstraintData.cpp` *(+122/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/TransformConstraintTimeline.cpp` *(+161/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/TranslateTimeline.cpp` *(+218/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Triangulator.cpp` *(+289/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/Updatable.cpp` *(+44/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/VertexAttachment.cpp` *(+171/-0)*
- `third-party/spine-runtimes/4.0.64/spine-cpp/src/spine/VertexEffect.cpp` *(+157/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Animation.h` *(+131/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/AnimationState.h` *(+495/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/AnimationStateData.h` *(+87/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Atlas.h` *(+137/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/AtlasAttachmentLoader.h` *(+72/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Attachment.h` *(+62/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/AttachmentLoader.h` *(+84/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/AttachmentTimeline.h` *(+82/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/AttachmentType.h` *(+45/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/BlendMode.h` *(+42/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Bone.h` *(+272/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/BoneData.h` *(+140/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/BoundingBoxAttachment.h` *(+54/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/ClippingAttachment.h` *(+65/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Color.h` *(+110/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/ColorTimeline.h` *(+197/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/ConstraintData.h` *(+65/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/ContainerUtil.h` *(+129/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/CurveTimeline.h` *(+103/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Debug.h` *(+131/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/DeformTimeline.h` *(+80/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/DrawOrderTimeline.h` *(+61/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Event.h` *(+86/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/EventData.h` *(+86/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/EventTimeline.h` *(+62/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Extension.h` *(+125/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/HasRendererObject.h` *(+65/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/HashMap.h` *(+200/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/IkConstraint.h` *(+119/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/IkConstraintData.h` *(+100/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/IkConstraintTimeline.h` *(+70/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Json.h` *(+116/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/LinkedMesh.h` *(+57/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Log.h` *(+57/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/MathUtil.h` *(+129/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/MeshAttachment.h` *(+120/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/MixBlend.h` *(+45/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/MixDirection.h` *(+44/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/PathAttachment.h` *(+70/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/PathConstraint.h` *(+134/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/PathConstraintData.h` *(+118/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/PathConstraintMixTimeline.h` *(+69/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/PathConstraintPositionTimeline.h` *(+64/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/PathConstraintSpacingTimeline.h` *(+59/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/PointAttachment.h` *(+81/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Pool.h` *(+74/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/PositionMode.h` *(+40/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Property.h` *(+59/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/RTTI.h` *(+72/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/RegionAttachment.h` *(+140/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/RotateMode.h` *(+41/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/RotateTimeline.h` *(+61/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/ScaleTimeline.h` *(+109/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Sequence.h` *(+98/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/SequenceTimeline.h` *(+73/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/ShearTimeline.h` *(+109/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Skeleton.h` *(+253/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/SkeletonBinary.h` *(+168/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/SkeletonBounds.h` *(+110/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/SkeletonClipping.h` *(+85/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/SkeletonData.h` *(+182/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/SkeletonJson.h` *(+114/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Skin.h` *(+167/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Slot.h` *(+137/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/SlotData.h` *(+121/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/SpacingMode.h` *(+42/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/SpineObject.h` *(+59/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/SpineString.h` *(+220/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/TextureLoader.h` *(+51/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/TextureRegion.h` *(+50/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Timeline.h` *(+86/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/TransformConstraint.h` *(+111/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/TransformConstraintData.h` *(+96/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/TransformConstraintTimeline.h` *(+71/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/TransformMode.h` *(+43/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/TranslateTimeline.h` *(+113/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Triangulator.h` *(+70/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Updatable.h` *(+53/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Vector.h` *(+222/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Version.h` *(+37/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/VertexAttachment.h` *(+101/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/Vertices.h` *(+43/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/dll.h` *(+51/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/include/spine/spine.h` *(+110/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Animation.cpp` *(+107/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/AnimationState.cpp` *(+1060/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/AnimationStateData.cpp` *(+81/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Atlas.cpp` *(+352/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/AtlasAttachmentLoader.cpp` *(+115/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Attachment.cpp` *(+59/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/AttachmentLoader.cpp` *(+48/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/AttachmentTimeline.cpp` *(+100/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Bone.cpp` *(+535/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/BoneData.cpp` *(+148/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/BoundingBoxAttachment.cpp` *(+47/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/ClippingAttachment.cpp` *(+58/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/ColorTimeline.cpp` *(+493/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/ConstraintData.cpp` *(+58/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/CurveTimeline.cpp` *(+150/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/DeformTimeline.cpp` *(+328/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/DrawOrderTimeline.cpp` *(+102/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Event.cpp` *(+90/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/EventData.cpp` *(+96/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/EventTimeline.cpp` *(+99/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Extension.cpp` *(+123/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/IkConstraint.cpp` *(+356/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/IkConstraintData.cpp` *(+105/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/IkConstraintTimeline.cpp` *(+141/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Json.cpp` *(+561/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/LinkedMesh.cpp` *(+42/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Log.cpp` *(+123/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/MathUtil.cpp` *(+124/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/MeshAttachment.cpp` *(+241/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/PathAttachment.cpp` *(+71/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/PathConstraint.cpp` *(+582/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/PathConstraintData.cpp` *(+134/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/PathConstraintMixTimeline.cpp` *(+126/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/PathConstraintPositionTimeline.cpp` *(+87/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/PathConstraintSpacingTimeline.cpp` *(+84/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/PointAttachment.cpp` *(+90/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/RTTI.cpp` *(+56/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/RegionAttachment.cpp` *(+264/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/RotateTimeline.cpp` *(+84/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/ScaleTimeline.cpp` *(+300/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Sequence.cpp` *(+98/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/SequenceTimeline.cpp` *(+124/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/ShearTimeline.cpp` *(+214/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Skeleton.cpp` *(+685/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/SkeletonBinary.cpp` *(+1389/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/SkeletonBounds.cpp` *(+218/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/SkeletonClipping.cpp` *(+323/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/SkeletonData.cpp` *(+225/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/SkeletonJson.cpp` *(+1476/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Skin.cpp` *(+195/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Slot.cpp` *(+129/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/SlotData.cpp` *(+90/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/SpineObject.cpp` *(+63/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/TextureLoader.cpp` *(+38/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Timeline.cpp` *(+74/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/TransformConstraint.cpp` *(+340/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/TransformConstraintData.cpp` *(+118/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/TransformConstraintTimeline.cpp` *(+157/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/TranslateTimeline.cpp` *(+214/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Triangulator.cpp` *(+285/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/Updatable.cpp` *(+40/-0)*
- `third-party/spine-runtimes/4.1.00/spine-cpp/src/spine/VertexAttachment.cpp` *(+167/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Animation.h` *(+131/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/AnimationState.h` *(+521/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/AnimationStateData.h` *(+90/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Atlas.h` *(+139/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/AtlasAttachmentLoader.h` *(+72/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Attachment.h` *(+62/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/AttachmentLoader.h` *(+84/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/AttachmentTimeline.h` *(+82/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/AttachmentType.h` *(+45/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/BlendMode.h` *(+42/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/BlockAllocator.h` *(+114/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Bone.h` *(+286/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/BoneData.h` *(+150/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/BoundingBoxAttachment.h` *(+54/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/ClippingAttachment.h` *(+65/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Color.h` *(+110/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/ColorTimeline.h` *(+197/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/ConstraintData.h` *(+69/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/ContainerUtil.h` *(+129/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/CurveTimeline.h` *(+111/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Debug.h` *(+139/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/DeformTimeline.h` *(+80/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/DrawOrderTimeline.h` *(+61/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Event.h` *(+86/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/EventData.h` *(+86/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/EventTimeline.h` *(+62/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Extension.h` *(+125/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/HasRendererObject.h` *(+65/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/HashMap.h` *(+200/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/IkConstraint.h` *(+118/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/IkConstraintData.h` *(+102/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/IkConstraintTimeline.h` *(+70/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Inherit.h` *(+43/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/InheritTimeline.h` *(+71/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Json.h` *(+116/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/LinkedMesh.h` *(+61/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Log.h` *(+57/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/MathUtil.h` *(+139/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/MeshAttachment.h` *(+122/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/MixBlend.h` *(+45/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/MixDirection.h` *(+44/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/PathAttachment.h` *(+70/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/PathConstraint.h` *(+133/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/PathConstraintData.h` *(+119/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/PathConstraintMixTimeline.h` *(+68/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/PathConstraintPositionTimeline.h` *(+64/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/PathConstraintSpacingTimeline.h` *(+59/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Physics.h` *(+50/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/PhysicsConstraint.h` *(+197/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/PhysicsConstraintData.h` *(+151/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/PhysicsConstraintTimeline.h` *(+288/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/PointAttachment.h` *(+81/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Pool.h` *(+74/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/PositionMode.h` *(+40/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Property.h` *(+68/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/RTTI.h` *(+72/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/RegionAttachment.h` *(+140/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/RotateMode.h` *(+41/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/RotateTimeline.h` *(+61/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/ScaleTimeline.h` *(+109/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Sequence.h` *(+98/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/SequenceTimeline.h` *(+73/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/ShearTimeline.h` *(+109/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Skeleton.h` *(+285/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/SkeletonBinary.h` *(+178/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/SkeletonBounds.h` *(+121/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/SkeletonClipping.h` *(+88/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/SkeletonData.h` *(+195/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/SkeletonJson.h` *(+114/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/SkeletonRenderer.h` *(+69/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Skin.h` *(+171/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Slot.h` *(+137/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/SlotData.h` *(+126/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/SpacingMode.h` *(+42/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/SpineObject.h` *(+59/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/SpineString.h` *(+246/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/TextureLoader.h` *(+51/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/TextureRegion.h` *(+50/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Timeline.h` *(+86/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/TransformConstraint.h` *(+113/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/TransformConstraintData.h` *(+128/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/TransformConstraintTimeline.h` *(+71/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/TranslateTimeline.h` *(+113/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Triangulator.h` *(+70/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Updatable.h` *(+54/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Vector.h` *(+245/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Version.h` *(+37/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/VertexAttachment.h` *(+101/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/Vertices.h` *(+43/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/dll.h` *(+51/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/include/spine/spine.h` *(+115/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Animation.cpp` *(+107/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/AnimationState.cpp` *(+1104/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/AnimationStateData.cpp` *(+86/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Atlas.cpp` *(+350/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/AtlasAttachmentLoader.cpp` *(+112/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Attachment.cpp` *(+59/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/AttachmentLoader.cpp` *(+48/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/AttachmentTimeline.cpp` *(+100/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Bone.cpp` *(+595/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/BoneData.cpp` *(+166/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/BoundingBoxAttachment.cpp` *(+47/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/ClippingAttachment.cpp` *(+58/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/ColorTimeline.cpp` *(+488/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/ConstraintData.cpp` *(+60/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/CurveTimeline.cpp` *(+252/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/DeformTimeline.cpp` *(+328/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/DrawOrderTimeline.cpp` *(+102/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Event.cpp` *(+90/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/EventData.cpp` *(+96/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/EventTimeline.cpp` *(+99/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Extension.cpp` *(+127/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/IkConstraint.cpp` *(+379/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/IkConstraintData.cpp` *(+107/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/IkConstraintTimeline.cpp` *(+141/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/InheritTimeline.cpp` *(+81/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Json.cpp` *(+559/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/LinkedMesh.cpp` *(+52/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Log.cpp` *(+123/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/MathUtil.cpp` *(+132/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/MeshAttachment.cpp` *(+241/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/PathAttachment.cpp` *(+71/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/PathConstraint.cpp` *(+588/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/PathConstraintData.cpp` *(+136/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/PathConstraintMixTimeline.cpp` *(+126/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/PathConstraintPositionTimeline.cpp` *(+66/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/PathConstraintSpacingTimeline.cpp` *(+64/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/PhysicsConstraint.cpp` *(+493/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/PhysicsConstraintData.cpp` *(+223/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/PhysicsConstraintTimeline.cpp` *(+103/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/PointAttachment.cpp` *(+88/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/RTTI.cpp` *(+56/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/RegionAttachment.cpp` *(+275/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/RotateTimeline.cpp` *(+59/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/ScaleTimeline.cpp` *(+194/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Sequence.cpp` *(+96/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/SequenceTimeline.cpp` *(+129/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/ShearTimeline.cpp` *(+162/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Skeleton.cpp` *(+774/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/SkeletonBinary.cpp` *(+1490/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/SkeletonBounds.cpp` *(+231/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/SkeletonClipping.cpp` *(+397/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/SkeletonData.cpp` *(+244/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/SkeletonJson.cpp` *(+1617/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/SkeletonRenderer.cpp` *(+246/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Skin.cpp` *(+195/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Slot.cpp` *(+129/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/SlotData.cpp` *(+99/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/SpineObject.cpp` *(+63/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/TextureLoader.cpp` *(+38/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Timeline.cpp` *(+73/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/TransformConstraint.cpp` *(+350/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/TransformConstraintData.cpp` *(+180/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/TransformConstraintTimeline.cpp` *(+157/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/TranslateTimeline.cpp` *(+162/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Triangulator.cpp` *(+285/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/Updatable.cpp` *(+40/-0)*
- `third-party/spine-runtimes/4.2/spine-cpp/src/spine/VertexAttachment.cpp` *(+167/-0)*
- `tmp/hyper-minimal-qwen.cjs` *(+0/-23)*
- `tmp/list-qwen-models.cjs` *(+0/-18)*
- `tmp/test-qwen.cjs` *(+0/-70)*
- `uno.config.ts` *(+2/-2)*
- `vitest.config.ts` *(+6/-5)*

#### Root Build & Tooling (`🔍 inspect`) — 37 file(s) (+753/-5487)
- `apps/stage-mate/package.json` *(+0/-46)*
- `apps/stage-mate/tsconfig.json` *(+0/-22)*
- `apps/stage-qt/package.json` *(+0/-21)*
- `apps/stage-qt/tsconfig.json` *(+0/-11)*
- `package.json` *(+2/-13)*
- `packages/cap-vite/package.json` *(+0/-46)*
- `packages/cap-vite/tsconfig.json` *(+0/-23)*
- `packages/electrobun-eventa/package.json` *(+43/-0)*
- `packages/electrobun-eventa/tsconfig.json` *(+22/-0)*
- `packages/plugin-sdk/package.json` *(+0/-1)*
- `packages/stage-shared/package.json` *(+2/-4)*
- `packages/stage-ui/package.json` *(+0/-4)*
- `pnpm-lock.yaml` *(+87/-2411)*
- `scripts/audit-orphan-dependencies.mjs` *(+0/-192)*
- `scripts/audit-skill-docs.js` *(+0/-97)*
- `scripts/audit-test-catalog.mjs` *(+2/-0)*
- `scripts/burn-down-skill-docs.js` *(+0/-461)*
- `scripts/compare_sync.cjs` *(+0/-173)*
- `scripts/compare_sync.js` *(+0/-171)*
- `scripts/gemini-live-adv-test.ts` *(+0/-84)*
- `scripts/gemini-live-pocs/utils-list-models.ts` *(+0/-46)*
- `scripts/gen-manifest/gen-manifest.mjs` *(+561/-0)*
- `scripts/github/ci-status.mjs` *(+5/-1)*
- `scripts/github/pr-status-report.mjs` *(+0/-129)*
- `scripts/list-module-loc.mjs` *(+0/-369)*
- `scripts/monitor-airi-memory.py` *(+1/-6)*
- `scripts/parse_logs_audit.cjs` *(+0/-123)*
- `scripts/parse_logs_audit.js` *(+0/-123)*
- `scripts/refresh-free-catalog.ts` *(+0/-117)*
- `scripts/release-download-chart.py` *(+0/-192)*
- `scripts/release-download-windows.py` *(+0/-167)*
- `scripts/release/publish-mac.js` *(+17/-6)*
- `scripts/release/publish-win.js` *(+11/-9)*
- `scripts/soak-memory-gate.mjs` *(+0/-125)*
- `scripts/upstream-tracker.mjs` *(+0/-1)*
- `scripts/validate-openai-provider.ts` *(+0/-158)*
- `scripts/verify-mcp-harness.ts` *(+0/-135)*

#### Mobile & Web Platforms (`⚪ ignore / low-priority`) — 186 file(s) (+0/-14517)
- `apps/stage-pocket/.swiftlint.yml` *(+0/-13)*
- `apps/stage-pocket/README.md` *(+0/-7)*
- `apps/stage-pocket/android/.gitignore` *(+0/-101)*
- `apps/stage-pocket/android/app/.gitignore` *(+0/-2)*
- `apps/stage-pocket/android/app/build.gradle` *(+0/-84)*
- `apps/stage-pocket/android/app/capacitor.build.gradle` *(+0/-20)*
- `apps/stage-pocket/android/app/proguard-rules.pro` *(+0/-21)*
- `apps/stage-pocket/android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java` *(+0/-26)*
- `apps/stage-pocket/android/app/src/main/AndroidManifest.xml` *(+0/-46)*
- `apps/stage-pocket/android/app/src/main/java/ai/moeru/airipocket/MainActivity.java` *(+0/-5)*
- `apps/stage-pocket/android/app/src/main/res/drawable-land-hdpi/splash.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/drawable-land-mdpi/splash.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/drawable-land-xhdpi/splash.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/drawable-land-xxhdpi/splash.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/drawable-land-xxxhdpi/splash.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/drawable-port-hdpi/splash.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/drawable-port-mdpi/splash.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/drawable-port-xhdpi/splash.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/drawable-port-xxhdpi/splash.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/drawable-port-xxxhdpi/splash.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml` *(+0/-34)*
- `apps/stage-pocket/android/app/src/main/res/drawable/ic_launcher_background.xml` *(+0/-170)*
- `apps/stage-pocket/android/app/src/main/res/drawable/splash.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/layout/activity_main.xml` *(+0/-12)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` *(+0/-5)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml` *(+0/-5)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-hdpi/ic_launcher.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-mdpi/ic_launcher.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png` *(+0/-0)*
- `apps/stage-pocket/android/app/src/main/res/values/ic_launcher_background.xml` *(+0/-4)*
- `apps/stage-pocket/android/app/src/main/res/values/strings.xml` *(+0/-7)*
- `apps/stage-pocket/android/app/src/main/res/values/styles.xml` *(+0/-22)*
- `apps/stage-pocket/android/app/src/main/res/xml/file_paths.xml` *(+0/-5)*
- `apps/stage-pocket/android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java` *(+0/-18)*
- `apps/stage-pocket/android/build.gradle` *(+0/-29)*
- `apps/stage-pocket/android/capacitor.settings.gradle` *(+0/-9)*
- `apps/stage-pocket/android/gradle.properties` *(+0/-22)*
- `apps/stage-pocket/android/gradle/wrapper/gradle-wrapper.jar` *(+0/-0)*
- `apps/stage-pocket/android/gradle/wrapper/gradle-wrapper.properties` *(+0/-7)*
- `apps/stage-pocket/android/gradlew` *(+0/-251)*
- `apps/stage-pocket/android/gradlew.bat` *(+0/-94)*
- `apps/stage-pocket/android/keystore.properties.example` *(+0/-10)*
- `apps/stage-pocket/android/settings.gradle` *(+0/-5)*
- `apps/stage-pocket/android/variables.gradle` *(+0/-16)*
- `apps/stage-pocket/build_log.txt` *(+0/-0)*
- `apps/stage-pocket/build_log_2.txt` *(+0/-0)*
- `apps/stage-pocket/capacitor.config.ts` *(+0/-20)*
- `apps/stage-pocket/index.html` *(+0/-51)*
- `apps/stage-pocket/ios/.gitignore` *(+0/-16)*
- `apps/stage-pocket/ios/App/App.xcodeproj/project.pbxproj` *(+0/-405)*
- `apps/stage-pocket/ios/App/App.xcodeproj/project.xcworkspace/contents.xcworkspacedata` *(+0/-7)*
- `apps/stage-pocket/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist` *(+0/-8)*
- `apps/stage-pocket/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` *(+0/-87)*
- `apps/stage-pocket/ios/App/App/AppDelegate.swift` *(+0/-76)*
- `apps/stage-pocket/ios/App/App/AppIcon_LiquidGlass.icon/Assets/Body.png` *(+0/-0)*
- `apps/stage-pocket/ios/App/App/AppIcon_LiquidGlass.icon/Assets/Ear_L.png` *(+0/-0)*
- `apps/stage-pocket/ios/App/App/AppIcon_LiquidGlass.icon/Assets/Ear_R.png` *(+0/-0)*
- `apps/stage-pocket/ios/App/App/AppIcon_LiquidGlass.icon/Assets/Hard_Shadow.png` *(+0/-0)*
- `apps/stage-pocket/ios/App/App/AppIcon_LiquidGlass.icon/icon.json` *(+0/-121)*
- `apps/stage-pocket/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x-dark.png` *(+0/-0)*
- `apps/stage-pocket/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x-light.png` *(+0/-0)*
- `apps/stage-pocket/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` *(+0/-0)*
- `apps/stage-pocket/ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json` *(+0/-38)*
- `apps/stage-pocket/ios/App/App/Assets.xcassets/Contents.json` *(+0/-6)*
- `apps/stage-pocket/ios/App/App/Assets.xcassets/Splash.imageset/Contents.json` *(+0/-23)*
- `apps/stage-pocket/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png` *(+0/-0)*
- `apps/stage-pocket/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png` *(+0/-0)*
- `apps/stage-pocket/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png` *(+0/-0)*
- `apps/stage-pocket/ios/App/App/Base.lproj/LaunchScreen.storyboard` *(+0/-32)*
- `apps/stage-pocket/ios/App/App/Base.lproj/Main.storyboard` *(+0/-19)*
- `apps/stage-pocket/ios/App/App/DevBridgeViewController.swift` *(+0/-133)*
- `apps/stage-pocket/ios/App/App/Info.plist` *(+0/-69)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Package.swift` *(+0/-28)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/AudioEncoder.swift` *(+0/-113)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/AudioFileLoader.swift` *(+0/-13)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/AudioMelTables.swift` *(+0/-215)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/AudioPreprocess.swift` *(+0/-220)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/ChainConfig.swift` *(+0/-91)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/ChainConfigV2.swift` *(+0/-158)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/ChunkedChainConfig.swift` *(+0/-158)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/ChunkedSpeculativeChain.swift` *(+0/-1063)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/CompiledModelStore.swift` *(+0/-60)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/CoreMLChain.swift` *(+0/-343)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/CoreMLChainV2.swift` *(+0/-1237)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/CoreMLEngine.swift` *(+0/-962)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/GenerationChain.swift` *(+0/-104)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/HFTokenizer.swift` *(+0/-23)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/HostInputs.swift` *(+0/-558)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/LiveVision.swift` *(+0/-67)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/PromptLookup.swift` *(+0/-49)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/QuantizedSidecar.swift` *(+0/-65)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/Sidecar.swift` *(+0/-29)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/SkeletonJSONDecoder.swift` *(+0/-383)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/SpeculationPolicy.swift` *(+0/-14)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/VisionEncoder.swift` *(+0/-148)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/CoreMLBackend/VisionPreprocess.swift` *(+0/-107)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/LLMCore/ASRGenerationInfo.swift` *(+0/-31)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/LLMCore/GenerationTypes.swift` *(+0/-178)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/LLMCore/KVCheckpoint.swift` *(+0/-46)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/LLMCore/LLMEngine.swift` *(+0/-68)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/LLMCore/ModelBundle.swift` *(+0/-94)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/LLMCore/Tokenizing.swift` *(+0/-5)*
- `apps/stage-pocket/ios/App/App/NativeAI/CoreLLMKit/Sources/LLMCore/VLMGenerationInfo.swift` *(+0/-29)*
- `apps/stage-pocket/ios/App/App/NativeAI/NativeAIPlugin.m` *(+0/-17)*
- `apps/stage-pocket/ios/App/App/NativeAI/NativeAIPlugin.swift` *(+0/-851)*
- `apps/stage-pocket/ios/App/CapApp-SPM/.gitignore` *(+0/-9)*
- `apps/stage-pocket/ios/App/CapApp-SPM/Package.resolved` *(+0/-87)*
- `apps/stage-pocket/ios/App/CapApp-SPM/Package.swift` *(+0/-32)*
- `apps/stage-pocket/ios/App/CapApp-SPM/README.md` *(+0/-5)*
- `apps/stage-pocket/ios/App/CapApp-SPM/Sources/CapApp-SPM/CapApp-SPM.swift` *(+0/-1)*
- `apps/stage-pocket/ios/debug.xcconfig` *(+0/-1)*
- `apps/stage-pocket/package.json` *(+0/-151)*
- `apps/stage-pocket/public/.assetsignore` *(+0/-3)*
- `apps/stage-pocket/public/_headers` *(+0/-4)*
- `apps/stage-pocket/public/_redirects` *(+0/-15)*
- `apps/stage-pocket/public/apple-touch-icon.png` *(+0/-0)*
- `apps/stage-pocket/public/favicon.ico` *(+0/-0)*
- `apps/stage-pocket/public/favicon.svg` *(+0/-61)*
- `apps/stage-pocket/public/maskable_icon_x192.png` *(+0/-0)*
- `apps/stage-pocket/public/maskable_icon_x512.png` *(+0/-0)*
- `apps/stage-pocket/public/open-graph.png` *(+0/-0)*
- `apps/stage-pocket/public/web-app-manifest-192x192.png` *(+0/-0)*
- `apps/stage-pocket/public/web-app-manifest-512x512.png` *(+0/-0)*
- `apps/stage-pocket/scripts/build-ipa.ts` *(+0/-122)*
- `apps/stage-pocket/src/App.vue` *(+0/-160)*
- `apps/stage-pocket/src/assets/backgrounds/fairy-forest.e17cbc2774.ko-fi.com.avif` *(+0/-0)*
- `apps/stage-pocket/src/assets/icons/modules/games/factorio.png` *(+0/-0)*
- `apps/stage-pocket/src/components/AudioWaveform.vue` *(+0/-95)*
- `apps/stage-pocket/src/components/DataGui/DualEndRange.vue` *(+0/-204)*
- `apps/stage-pocket/src/components/IconAnimation.vue` *(+0/-76)*
- `apps/stage-pocket/src/composables/audio-input.ts` *(+0/-83)*
- `apps/stage-pocket/src/composables/audio-record.ts` *(+0/-42)*
- `apps/stage-pocket/src/composables/icon-animation.ts` *(+0/-29)*
- `apps/stage-pocket/src/env.d.ts` *(+0/-10)*
- `apps/stage-pocket/src/main.ts` *(+0/-112)*
- `apps/stage-pocket/src/modules/i18n.ts` *(+0/-49)*
- `apps/stage-pocket/src/modules/posthog.ts` *(+0/-8)*
- `apps/stage-pocket/src/modules/pwa.ts` *(+0/-1)*
- `apps/stage-pocket/src/pages/[...all].vue` *(+0/-19)*
- `apps/stage-pocket/src/pages/devtools/audio-record.vue` *(+0/-67)*
- `apps/stage-pocket/src/pages/devtools/background-gradient-blending.vue` *(+0/-220)*
- `apps/stage-pocket/src/pages/devtools/background-removal.vue` *(+0/-393)*
- `apps/stage-pocket/src/pages/devtools/gesture-circle.vue` *(+0/-179)*
- `apps/stage-pocket/src/pages/devtools/notifications.vue` *(+0/-54)*
- `apps/stage-pocket/src/pages/devtools/performance-playground.vue` *(+0/-309)*
- `apps/stage-pocket/src/pages/devtools/polaroid.vue` *(+0/-94)*
- `apps/stage-pocket/src/pages/devtools/use-magic-keys.vue` *(+0/-131)*
- `apps/stage-pocket/src/pages/index.vue` *(+0/-302)*
- `apps/stage-pocket/src/pages/settings/system/developer.vue` *(+0/-164)*
- `apps/stage-pocket/src/pages/settings/system/index.vue` *(+0/-92)*
- `apps/stage-pocket/src/stores/background.ts` *(+0/-1)*
- `apps/stage-pocket/src/styles/main.css` *(+0/-65)*
- `apps/stage-pocket/src/styles/transitions.css` *(+0/-18)*
- `apps/stage-pocket/src/styles/vue-transitions.css` *(+0/-48)*
- `apps/stage-pocket/src/utils/jsonFormat.ts` *(+0/-74)*
- `apps/stage-pocket/src/utils/platform.ts` *(+0/-18)*
- `apps/stage-pocket/src/workers/vad/index.ts` *(+0/-3)*
- `apps/stage-pocket/src/workers/vad/manager.ts` *(+0/-2)*
- `apps/stage-pocket/src/workers/vad/process.worklet.ts` *(+0/-53)*
- `apps/stage-pocket/src/workers/vad/vad.ts` *(+0/-277)*
- `apps/stage-pocket/tsconfig.json` *(+0/-61)*
- `apps/stage-pocket/uno.config.ts` *(+0/-41)*
- `apps/stage-pocket/vite-env.d.ts` *(+0/-8)*
- `apps/stage-pocket/vite.config-env.d.ts` *(+0/-6)*
- `apps/stage-pocket/vite.config.ts` *(+0/-262)*
- `apps/stage-web/public/assets/animadex-catalog.json` *(+0/-1)*
- `apps/stage-web/src/composables/audio-input.ts` *(+0/-83)*
- `apps/stage-web/src/composables/audio-record.ts` *(+0/-42)*
- `apps/stage-web/src/composables/icon-animation.ts` *(+0/-29)*
- `apps/stage-web/src/utils/platform.ts` *(+0/-18)*
- `apps/stage-web/src/workers/vad/index.ts` *(+0/-3)*
- `apps/stage-web/src/workers/vad/manager.ts` *(+0/-2)*
- `apps/stage-web/src/workers/vad/process.worklet.ts` *(+0/-53)*
- `apps/stage-web/src/workers/vad/vad.ts` *(+0/-277)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 90 file(s) (+4406/-5479)
- `apps/stage-tamagotchi/.gitignore` *(+13/-0)*
- `apps/stage-tamagotchi/build_log.txt` *(+0/-0)*
- `apps/stage-tamagotchi/build_log_2.txt` *(+0/-0)*
- `apps/stage-tamagotchi/build_log_2_utf8.txt` *(+0/-77)*
- `apps/stage-tamagotchi/build_log_3.txt` *(+0/-0)*
- `apps/stage-tamagotchi/build_log_3_utf8.txt` *(+0/-72)*
- `apps/stage-tamagotchi/build_log_4.txt` *(+0/-0)*
- `apps/stage-tamagotchi/build_log_4_utf8.txt` *(+0/-77)*
- `apps/stage-tamagotchi/build_log_5.txt` *(+0/-0)*
- `apps/stage-tamagotchi/build_log_5_utf8.txt` *(+0/-71)*
- `apps/stage-tamagotchi/build_log_utf8.txt` *(+0/-83)*
- `apps/stage-tamagotchi/dev-app-update.yml` *(+0/-6)*
- `apps/stage-tamagotchi/electrobun.config.ts` *(+109/-0)*
- `apps/stage-tamagotchi/electron-builder.config.ts` *(+0/-297)*
- `apps/stage-tamagotchi/electron-builder.yml` *(+0/-81)*
- `apps/stage-tamagotchi/electron.vite.config.ts` *(+0/-413)*
- `apps/stage-tamagotchi/hutch.config.ts` *(+25/-0)*
- `apps/stage-tamagotchi/package.json` *(+16/-33)*
- `apps/stage-tamagotchi/scripts/dev-hmr.ts` *(+32/-0)*
- `apps/stage-tamagotchi/scripts/ensure-electron.js` *(+0/-165)*
- `apps/stage-tamagotchi/scripts/linux-window-render-smoke.ts` *(+284/-189)*
- `apps/stage-tamagotchi/src/main/app/debugger.ts` *(+5/-4)*
- `apps/stage-tamagotchi/src/main/app/file-logger.ts` *(+2/-2)*
- `apps/stage-tamagotchi/src/main/app/leveldb-guard.ts` *(+8/-5)*
- `apps/stage-tamagotchi/src/main/app/migration.ts` *(+29/-10)*
- `apps/stage-tamagotchi/src/main/app/shutdown.ts` *(+49/-0)*
- `apps/stage-tamagotchi/src/main/app/single-instance.test.ts` *(+71/-0)*
- `apps/stage-tamagotchi/src/main/app/single-instance.ts` *(+130/-0)*
- `apps/stage-tamagotchi/src/main/assets.ts` *(+25/-0)*
- `apps/stage-tamagotchi/src/main/electrobun-env.d.ts` *(+265/-0)*
- `apps/stage-tamagotchi/src/main/electron-shim.ts` *(+470/-0)*
- `apps/stage-tamagotchi/src/main/index.ts` *(+423/-1262)*
- `apps/stage-tamagotchi/src/main/libs/electrobun/location.ts` *(+70/-0)*
- `apps/stage-tamagotchi/src/main/libs/electron/location.ts` *(+0/-124)*
- `apps/stage-tamagotchi/src/main/libs/electron/persistence.ts` *(+26/-7)*
- `apps/stage-tamagotchi/src/main/rpc/index.ts` *(+325/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/channel-server/index.ts` *(+208/-22)*
- `apps/stage-tamagotchi/src/main/services/airi/daemon-gateway.test.ts` *(+75/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/daemon-gateway.ts` *(+143/-0)*
- `apps/stage-tamagotchi/src/main/services/airi/discord/index.ts` *(+11/-977)*
- `apps/stage-tamagotchi/src/main/services/airi/mcp-servers/index.ts` *(+15/-1)*
- `apps/stage-tamagotchi/src/main/services/airi/stage-mate/index.ts` *(+0/-760)*
- `apps/stage-tamagotchi/src/main/services/electron/mock-auto-updater.ts` *(+0/-71)*
- `apps/stage-tamagotchi/src/main/services/electron/process-spawner.test.ts` *(+94/-0)*
- `apps/stage-tamagotchi/src/main/services/electron/process-spawner.ts` *(+99/-43)*
- `apps/stage-tamagotchi/src/main/services/electron/system-preferences.ts` *(+0/-24)*
- `apps/stage-tamagotchi/src/main/tray/index.ts` *(+1/-3)*
- `apps/stage-tamagotchi/src/main/windows/about/index.ts` *(+5/-5)*
- `apps/stage-tamagotchi/src/main/windows/beat-sync/index.ts` *(+1/-1)*
- `apps/stage-tamagotchi/src/main/windows/caption/index.ts` *(+5/-5)*
- `apps/stage-tamagotchi/src/main/windows/chat/index.ts` *(+5/-5)*
- `apps/stage-tamagotchi/src/main/windows/customizer/index.ts` *(+5/-5)*
- `apps/stage-tamagotchi/src/main/windows/dashboard/index.ts` *(+5/-5)*
- `apps/stage-tamagotchi/src/main/windows/devtools/index.ts` *(+5/-5)*
- `apps/stage-tamagotchi/src/main/windows/inlay/index.ts` *(+5/-5)*
- `apps/stage-tamagotchi/src/main/windows/main/index.ts` *(+118/-144)*
- `apps/stage-tamagotchi/src/main/windows/main/rpc/index.electron.ts` *(+7/-17)*
- `apps/stage-tamagotchi/src/main/windows/notice/index.ts` *(+5/-5)*
- `apps/stage-tamagotchi/src/main/windows/onboarding/index.ts` *(+5/-5)*
- `apps/stage-tamagotchi/src/main/windows/registry.ts` *(+70/-0)*
- `apps/stage-tamagotchi/src/main/windows/settings/index.ts` *(+5/-5)*
- `apps/stage-tamagotchi/src/main/windows/shared/app-icon.ts` *(+16/-40)*
- `apps/stage-tamagotchi/src/main/windows/shared/create-window.ts` *(+83/-0)*
- `apps/stage-tamagotchi/src/main/windows/shared/display.ts` *(+27/-8)*
- `apps/stage-tamagotchi/src/main/windows/shared/open-external.test.ts` *(+35/-0)*
- `apps/stage-tamagotchi/src/main/windows/shared/open-external.ts` *(+20/-0)*
- `apps/stage-tamagotchi/src/main/windows/shared/referenced-window.ts` *(+3/-1)*
- `apps/stage-tamagotchi/src/main/windows/shared/view.ts` *(+45/-0)*
- `apps/stage-tamagotchi/src/main/windows/splash/index.ts` *(+31/-62)*
- `apps/stage-tamagotchi/src/main/windows/stage/index.ts` *(+7/-19)*
- `apps/stage-tamagotchi/src/main/windows/widgets/index.ts` *(+5/-5)*
- `apps/stage-tamagotchi/src/preload/beat-sync.ts` *(+0/-3)*
- `apps/stage-tamagotchi/src/preload/index.ts` *(+0/-3)*
- `apps/stage-tamagotchi/src/preload/shared.ts` *(+0/-53)*
- `apps/stage-tamagotchi/src/renderer/electrobun-bridge.ts` *(+151/-0)*
- `apps/stage-tamagotchi/src/renderer/electrobun-view.d.ts` *(+47/-0)*
- `apps/stage-tamagotchi/src/renderer/install-bridge.ts` *(+75/-0)*
- `apps/stage-tamagotchi/src/renderer/main.ts` *(+23/-11)*
- `apps/stage-tamagotchi/src/renderer/pages/customizer.vue` *(+17/-16)*
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` *(+77/-47)*
- `apps/stage-tamagotchi/src/renderer/pages/settings/system/connection.vue` *(+2/-2)*
- `apps/stage-tamagotchi/src/renderer/shims/empty.ts` *(+4/-0)*
- `apps/stage-tamagotchi/src/renderer/splash.main.ts` *(+4/-2)*
- `apps/stage-tamagotchi/src/renderer/stores/settings/server-channel.ts` *(+75/-16)*
- `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/mcp.ts` *(+2/-20)*
- `apps/stage-tamagotchi/src/shared/eventa.ts` *(+6/-45)*
- `apps/stage-tamagotchi/tsconfig.json` *(+7/-1)*
- `apps/stage-tamagotchi/tsconfig.node.json` *(+27/-3)*
- `apps/stage-tamagotchi/tsconfig.preload.json` *(+0/-31)*
- `apps/stage-tamagotchi/vite.config.ts` *(+348/-0)*

#### Auto-Updater & Packaging Infrastructure (`📦 import / inspect`) — 1 file(s) (+21/-149)
- `apps/stage-tamagotchi/src/main/services/electron/auto-updater.ts` *(+21/-149)*

#### Localization (i18n) (`📦 import (additive only)`) — 22 file(s) (+12012/-0)
- `packages/i18n/src/locales.test.ts` *(+31/-0)*
- `packages/i18n/src/locales/en/index.ts` *(+2/-0)*
- `packages/i18n/src/locales/en/settings.yaml` *(+13/-0)*
- `packages/i18n/src/locales/en/shell.yaml` *(+1195/-0)*
- `packages/i18n/src/locales/es/index.ts` *(+2/-0)*
- `packages/i18n/src/locales/es/shell.yaml` *(+1195/-0)*
- `packages/i18n/src/locales/fr/index.ts` *(+2/-0)*
- `packages/i18n/src/locales/fr/shell.yaml` *(+1195/-0)*
- `packages/i18n/src/locales/id/index.ts` *(+2/-0)*
- `packages/i18n/src/locales/id/shell.yaml` *(+1196/-0)*
- `packages/i18n/src/locales/ja/index.ts` *(+2/-0)*
- `packages/i18n/src/locales/ja/shell.yaml` *(+1194/-0)*
- `packages/i18n/src/locales/ko/index.ts` *(+2/-0)*
- `packages/i18n/src/locales/ko/shell.yaml` *(+1195/-0)*
- `packages/i18n/src/locales/ru/index.ts` *(+2/-0)*
- `packages/i18n/src/locales/ru/shell.yaml` *(+1195/-0)*
- `packages/i18n/src/locales/vi/index.ts` *(+2/-0)*
- `packages/i18n/src/locales/vi/shell.yaml` *(+1195/-0)*
- `packages/i18n/src/locales/zh-Hans/index.ts` *(+2/-0)*
- `packages/i18n/src/locales/zh-Hans/shell.yaml` *(+1194/-0)*
- `packages/i18n/src/locales/zh-Hant/index.ts` *(+2/-0)*
- `packages/i18n/src/locales/zh-Hant/shell.yaml` *(+1194/-0)*

#### UI Primitives & Pages (`📦 import / inspect`) — 4 file(s) (+25/-23)
- `packages/stage-pages/src/pages/settings/modules/cloud-sync.vue` *(+2/-12)*
- `packages/stage-pages/src/pages/settings/providers/artistry/comfyui.vue` *(+4/-3)*
- `packages/stage-pages/src/pages/settings/providers/speech/airi-audio-server.vue` *(+5/-5)*
- `packages/stage-pages/src/pages/settings/system/ConnectionSettings.vue` *(+14/-3)*

#### 3D, Live2D & Motion (`🔍 inspect`) — 3 file(s) (+0/-46)
- `packages/stage-ui-live2d/package.json` *(+0/-8)*
- `packages/stage-ui-three/package.json` *(+0/-3)*
- `packages/stage-ui/src/components/scenes/ControlStripHost.vue` *(+0/-35)*

#### Cognitive & Consciousness (`⚠️ hand-merge`) — 9 file(s) (+304/-128)
- `packages/stage-ui/src/stores/chat.ts` *(+4/-15)*
- `packages/stage-ui/src/stores/chat/session-message-merge.ts` *(+34/-13)*
- `packages/stage-ui/src/stores/chat/session-store.ts` *(+28/-26)*
- `packages/stage-ui/src/stores/memory-lifetime.incremental.test.ts` *(+54/-0)*
- `packages/stage-ui/src/stores/memory-lifetime.ts` *(+78/-20)*
- `packages/stage-ui/src/stores/memory-lifetime.watermark.test.ts` *(+72/-0)*
- `packages/stage-ui/src/stores/memory-short-term.ts` *(+15/-20)*
- `packages/stage-ui/src/stores/memory-text-journal.ts` *(+17/-20)*
- `packages/stage-ui/src/stores/proactivity.ts` *(+2/-14)*

#### Provider & Model Integrations (`📦 import / inspect`) — 9 file(s) (+596/-34)
- `packages/stage-ui/src/stores/providers.ts` *(+9/-7)*
- `packages/stage-ui/src/stores/providers/apple-core-ai/index.ts` *(+4/-2)*
- `packages/stage-ui/src/stores/providers/registry/speech.ts` *(+41/-4)*
- `packages/stage-ui/src/stores/providers/round2-providers.test.ts` *(+30/-4)*
- `packages/stage-ui/src/stores/providers/runtime/credential-dispose.test.ts` *(+316/-0)*
- `packages/stage-ui/src/stores/providers/runtime/instances.ts` *(+36/-6)*
- `packages/stage-ui/src/stores/providers/runtime/lifecycle.ts` *(+14/-8)*
- `packages/stage-ui/src/stores/providers/runtime/validation.test.ts` *(+126/-0)*
- `packages/stage-ui/src/stores/providers/runtime/validation.ts` *(+20/-3)*

### 📬 7n1m4 Fork Activity Radar
#### 🆕 New Items Opened (10)
- [PR] [#48](https://github.com/7n1m4/airi/pull/48) `feat: add Rust gateway client for the daemon pivot` by **@7n1m4** *(0 comments)*
- [PR] [#47](https://github.com/7n1m4/airi/pull/47) `fix: post-#46 follow-through — CSRF belt, system-config key strip, sync lease, tamagotchi boot, slint audit archive` by **@7n1m4** *(0 comments)*
- [PR] [#46](https://github.com/7n1m4/airi/pull/46) `fix: post-merge audit follow-through — sync hardening, server prod traps, daemon/channel safety, tamagotchi honesty` by **@7n1m4** *(0 comments)*
- [PR] [#45](https://github.com/7n1m4/airi/pull/45) `fix: audit follow-through — sync tombstones, server prod traps, Rust CI gate, dead-peer TTL` by **@7n1m4** *(0 comments)*
- [PR] [#44](https://github.com/7n1m4/airi/pull/44) `feat: unify — daemon hosts the gateway; app and renderer become thin clients (increment 2)` by **@7n1m4** *(0 comments)*
- [PR] [#43](https://github.com/7n1m4/airi/pull/43) `chore: untrack dev database cluster and local agent notes` by **@7n1m4** *(0 comments)*
- [PR] [#42](https://github.com/7n1m4/airi/pull/42) `feat: runtime pivot — daemon gateway, Rust wire types, audit hardening` by **@7n1m4** *(0 comments)*
- [PR] [#41](https://github.com/7n1m4/airi/pull/41) `chore: move Qt app out of apps/ to the repo root` by **@7n1m4** *(0 comments)*
- [PR] [#40](https://github.com/7n1m4/airi/pull/40) `chore: remove Stage-Mate and stage-qt native apps` by **@7n1m4** *(0 comments)*
- [PR] [#39](https://github.com/7n1m4/airi/pull/39) `fix: post-audit hardening sweep (27 findings)` by **@7n1m4** *(0 comments)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/7n1m4/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/7n1m4/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/7n1m4/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/7n1m4/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` [OPEN] — *(34 comments)*
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/7n1m4/airi/issues/4) `Phase 3: Agentic OS Integration` [CLOSED] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
## [2026-11-10] 7n1m4 Fork Delta: `e8c9f7bf..bee21ea5` (3 commits, 45 files, 2 update(s))

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
Sister Fork Intelligence Briefing & Native Companion Renderer:

• **Executive Highlights**:
  - **Native Qt Quick 3D VRM Companion Renderer (`apps/stage-qt`, commits `ac0013773`, `1de174100`)**: 7n1m4 landed a native desktop companion renderer built in Rust + C++ (`cxx-qt`) and Qt Quick 3D. It speaks the Stage-Mate WebSocket JSONL protocol on port 6171 (`module:authenticate` -> `module:announce` -> `stage:vrm:load` -> `stage:vrm:ready`), parsing VRM 0.x/1.0 via `gltf` with custom Verlet springbones, MToon shaders, and gaze/lip-sync engines. Electron main in `stage-tamagotchi` was wired with fallback candidate paths to launch `stage-qt` when Unity Stage-Mate is absent.
  - **Onboarding i18n Key Parity Sync (`packages/i18n`, commit `bee21ea5c`)**: Added 399 missing translation keys to `en/onboarding.yaml` (732 total keys) covering onboarding-v3 components (welcome, triage, appearance, consciousness, persona, etc.) and propagated English fallbacks across 9 locale files (`es`, `fr`, `ja`, `ko`, `ru`, `zh-Hans`, `zh-Hant`, `vi`, `id`) with interpolation syntax quotation fixes (`{name}`, `{error}`).

• **Discussion Velocity**:
  - **Issue #1 ([Roadmap])**: Milestone discussion reached 34 total comments (+1 new comment). Maintainer @dasilva333 posted an architectural check-in commending PR #22 (nap-chat substrate) and PR #23 (transport seam), green-lighting 7n1m4/anlmabot to proceed autonomously until the next milestone.
  - **Issue #17 ([CI] Cross-WAN rendezvous)**: Continued high-cadence automated CI multiaddr signaling traffic with +18 new comments (369 ➔ 387 total).

• **Cherry-Pick Candidates**:
  - **Selective i18n Interpolation Syntax Quotations**: Inspect `bee21ea5c` strictly for YAML quote-escaping fixes on interpolation variables (`{name}`, `{error}`) to backport into our existing locale files without overwriting `dasilva333`'s richer onboarding copy.
  - **Stage-Mate Secondary Binary Fallback Candidates (`apps/stage-tamagotchi/src/main/services/airi/stage-mate/index.ts`)**: Optional candidate path addition for `stage-qt` binaries; defer until/unless a native non-Unity renderer is packaged for `dasilva333/airi`.

• **Collision Warnings**:
  - **GPL-3.0 Licensing Boundary on `apps/stage-qt`**: Qt Quick 3D requires GPL-3.0-or-later licensing (isolated in `apps/stage-qt/LICENSE`), conflicting with AIRI's root MIT license. Do NOT merge or hoist `apps/stage-qt` into `dasilva333/airi` without architectural quarantine and legal review.
  - **Strict Ban on Blind Vibe-Code Adoption**: `apps/stage-qt` introduces complex native C++/Rust/Qt6 toolchains and untested cross-platform windowing behaviors. In accordance with radar policy, it remains speculative and quarantined.
  - **Onboarding Copy & Locale Conflict**: `dasilva333/airi` maintains a far more comprehensive 2,800+ line onboarding suite (including Ming 3.0 TTS voice-design, Whistle local STT grid, and LFM3 models). Do not blindly import 7n1m4's 732-line `onboarding.yaml` files, as it would cause massive regression of custom upstream features.

### 📋 7n1m4 Fork Commits
- `bee21ea5c` i18n: fix onboarding untranslated strings by adding missing keys to all locales  _(7n1m4, 2026-11-10)_
- `1de174100` Merge branch 'feat/stage-qt-native-renderer'  _(7n1m4, 2026-11-10)_
- `ac0013773` feat(stage-qt): native Qt Quick 3D VRM companion renderer (Rust + cxx-qt)  _(7n1m4, 2026-11-09)_

### 🔬 Subsystem Breakdown
#### Other / Uncategorized (`🔍 inspect`) — 29 file(s) (+4574/-0)
- `.gitignore` *(+6/-0)*
- `apps/stage-qt/Cargo.lock` *(+1656/-0)*
- `apps/stage-qt/Cargo.toml` *(+27/-0)*
- `apps/stage-qt/build.rs` *(+25/-0)*
- `apps/stage-qt/harness/index.ts` *(+234/-0)*
- `apps/stage-qt/qml/Caption.qml` *(+37/-0)*
- `apps/stage-qt/qml/Main.qml` *(+86/-0)*
- `apps/stage-qt/qml/StageScene.qml` *(+38/-0)*
- `apps/stage-qt/qml/VrmMtoonMaterial.qml` *(+44/-0)*
- `apps/stage-qt/qml/shaders/mtoon.frag` *(+31/-0)*
- `apps/stage-qt/qml/shaders/mtoon.vert` *(+6/-0)*
- `apps/stage-qt/rust-toolchain.toml` *(+3/-0)*
- `apps/stage-qt/src/cpp/stage_qt_bridge.cpp` *(+21/-0)*
- `apps/stage-qt/src/cpp/stage_qt_bridge.h` *(+50/-0)*
- `apps/stage-qt/src/cxxqt_object.rs` *(+124/-0)*
- `apps/stage-qt/src/main.rs` *(+139/-0)*
- `apps/stage-qt/src/protocol/mod.rs` *(+117/-0)*
- `apps/stage-qt/src/protocol/socket.rs` *(+196/-0)*
- `apps/stage-qt/src/vrm/doc.rs` *(+371/-0)*
- `apps/stage-qt/src/vrm/expression.rs` *(+232/-0)*
- `apps/stage-qt/src/vrm/gaze.rs` *(+72/-0)*
- `apps/stage-qt/src/vrm/geometry.rs` *(+257/-0)*
- `apps/stage-qt/src/vrm/idle.rs` *(+143/-0)*
- `apps/stage-qt/src/vrm/lipsync.rs` *(+70/-0)*
- `apps/stage-qt/src/vrm/materials.rs` *(+128/-0)*
- `apps/stage-qt/src/vrm/mod.rs` *(+46/-0)*
- `apps/stage-qt/src/vrm/morph.rs` *(+174/-0)*
- `apps/stage-qt/src/vrm/skin.rs` *(+60/-0)*
- `apps/stage-qt/src/vrm/springbone.rs` *(+181/-0)*

#### Documentation & Scaffolding (`⚪ ignore`) — 2 file(s) (+254/-0)
- `apps/stage-qt/LICENSE` *(+202/-0)*
- `apps/stage-qt/README.md` *(+52/-0)*

#### Root Build & Tooling (`🔍 inspect`) — 3 file(s) (+45/-0)
- `apps/stage-qt/package.json` *(+21/-0)*
- `apps/stage-qt/tsconfig.json` *(+11/-0)*
- `pnpm-lock.yaml` *(+13/-0)*

#### Electron Desktop Shell (`⚠️ hand-merge`) — 1 file(s) (+12/-0)
- `apps/stage-tamagotchi/src/main/services/airi/stage-mate/index.ts` *(+12/-0)*

#### Localization (i18n) (`📦 import (additive only)`) — 10 file(s) (+5079/-276)
- `packages/i18n/src/locales/en/onboarding.yaml` *(+480/-3)*
- `packages/i18n/src/locales/es/onboarding.yaml` *(+513/-31)*
- `packages/i18n/src/locales/fr/onboarding.yaml` *(+518/-36)*
- `packages/i18n/src/locales/id/onboarding.yaml` *(+530/-40)*
- `packages/i18n/src/locales/ja/onboarding.yaml` *(+502/-24)*
- `packages/i18n/src/locales/ko/onboarding.yaml` *(+503/-25)*
- `packages/i18n/src/locales/ru/onboarding.yaml` *(+511/-30)*
- `packages/i18n/src/locales/vi/onboarding.yaml` *(+514/-35)*
- `packages/i18n/src/locales/zh-Hans/onboarding.yaml` *(+504/-26)*
- `packages/i18n/src/locales/zh-Hant/onboarding.yaml` *(+504/-26)*

### 📬 7n1m4 Fork Activity Radar
#### 💬 Discussion Activity (2)
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` — *+1 comments (33 ➔ 34 total)*
- [Issue] [#17](https://github.com/anlmalabs/airi/issues/17) `[CI] Cross-WAN rendezvous (auto-managed, do not close)` — *+18 comments (369 ➔ 387 total)*

### 👁️ Watched 7n1m4 Fork Monitor
- [PR] [#7](https://github.com/anlmalabs/airi/pull/7) `feat(agentic): presence single source + nap & companion nap-chat` [MERGED] — *(1 comments)*
  - *Focus*: Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap
- [PR] [#6](https://github.com/anlmalabs/airi/pull/6) `feat(libp2p): complete pairing over the wire and paired-device management` [MERGED] — *(0 comments)*
  - *Focus*: Wire pairing negotiation, multiaddr identity storage, and eventa message transport
- [PR] [#8](https://github.com/anlmalabs/airi/pull/8) `fix: migrate zod imports to default for Node 26 Vite SSR interop` [MERGED] — *(0 comments)*
  - *Focus*: Vite SSR interop for Node 26 runtime
- [Issue] [#1](https://github.com/anlmalabs/airi/issues/1) `[Roadmap] libp2p LAN+WAN Mesh → TransportAdapter Unification → Agentic OS Integration (Linux as POC, MacOS/Win further ahead)` [OPEN] — 🚨 **+1 comments** (34 total)
  - *Focus*: Violet's master roadmap and architectural milestone tracker
- [Issue] [#4](https://github.com/anlmalabs/airi/issues/4) `Phase 3: Agentic OS Integration` [CLOSED] — *(0 comments)*
  - *Focus*: Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop

---
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
