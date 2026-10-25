---
name: airi-roadmap-upstream-research
description: >-
  Review roadmap/RFCs, verify proposed versus shipped features, compare forks, plan selective upstream ports. Never inspect/fetch/rebase/push upstream without explicit authorization. Use for research and planning.
---

Research first, port deliberately. This fork is highly divergent; the `upstream` remote is reference-only. Never push, rebase from, fetch, or otherwise inspect `upstream` unless the user explicitly authorizes it. Never cite `crates/` (legacy Tauri; current desktop is Electron `apps/stage-tamagotchi/`).

## Key Files/Locations

- `docs/content/en/docs/chronicles/roadmap.md` — the "AIRI Pending Items Catalog": the source of truth for triaging unbuilt features (core infra, local runtimes, consciousness/cognitive pipeline, memory & RAG, speech/audio, visual manifestation, integration architecture). Note some entries are already `[COMPLETED]` — read carefully before treating a feature as unbuilt.
- `docs/memory_lab/` — a folder of memory-system design specs, plans, and analysis docs (retrieval/ranking, schema/lifecycle, replay/eval plans, benchmark history).
- `docs/proposal-*.md` (and `docs/design-*.md`) — the architectural proposal RFCs and design docs under `docs/`.
- Git remotes — run `git remote -v` to enumerate the fork's named remotes (e.g. `origin` = `dasilva333/airi`, `upstream` = `moeru-ai/airi`, plus several fork remotes). Upstream diff comes from these remotes, not from invented paths.

## When to Use

- Triage an unbuilt roadmap feature to decide whether/how to build it.
- Read or evaluate an architectural proposal RFC before implementing.
- Inspect upstream repo changes / PRs to understand what upstream did.
- Compare divergent fork paths across the named remotes.
- Plan a port of upstream/fork work into this divergent fork.

## Common Pitfalls

- **Touching `upstream` without authorization.** Upstream is reference-only. No `push`/`rebase`/`fetch`/`inspect` of `upstream` (or any remote mutation) unless the user explicitly authorizes it — and a greenlight is one-time, for that checkpoint only.
- **Treating the roadmap as all-unbuilt.** Read each roadmap entry; several are already marked `[COMPLETED]` or carry priority tags. Verify current source before assuming a feature is missing.
- **Assuming a proposal doc reflects shipped code.** Proposal documents are design intent. If a proposal conflicts with current source, source wins — verify against the actual files before planning.
- **Recommending Obsolete or Superseded Surfaces.** Upstream still actively develops on surfaces that this fork deprecated and removed months ago (e.g. `controls-island`, `chat-floating.vue`) or subsystems this fork does not use (e.g. wake words / `openwakeword`). Never recommend upstream commits or PRs modifying `controls-island`, `chat-floating.vue`, or wake-word engines as cherry-pick candidates.
- **Scope creep on a port.** Port narrowly and deliberately; do not bundle a broad refactor into a research/port task. Root-cause and state the proposed approach and tradeoffs, and wait for approval before changing application code (pair-programming rule).
- **Momentum toward commit/push.** Never proactively commit or push. The user decides when a tested checkpoint becomes a commit and when it is published; validate before any push.

## Architectural Divergences: What Sets This Fork Apart

This fork (`dasilva333/airi`) has undergone deep, structural architectural shifts that separate it from upstream (`moeru-ai/airi`). When conducting research or triaging PRs, evaluate changes against these core distinctions:

1. **Decoupled Desktop Surfaces (Control Strip vs. Control Island & Chat Floating)**:
   - In commit `e10223f2e` and subsequent stage cleanups, this fork deleted the legacy monolithic `controls-island/` and `chat-floating.vue` inside the stage window.
   - The desktop was cleanly split into the **Actor Stage** (`windows/stage`, `RendererStage.vue` dedicated solely to avatar rendering) and the **Main Window / Control Strip** (`windows/main`, `ControlStrip.vue`, `ControlStripHost.vue` floating ribbon).
   - Upstream never decoupled this and still patches `controls-island` (e.g. Wayland hover fixes, menus) and `chat-floating.vue` (e.g. dock buttons). **Upstream `controls-island` and `chat-floating.vue` changes are permanent auto-rejects for porting.**
2. **Local-First & Privacy Invariant vs. Hosted Cloud / Commercial Services**:
   - This fork is strictly local-first desktop with Bring Your Own Storage (BYOS: S3/R2/Google Drive backup), local unstorage/localforage persistence, and zero online accounts.
   - Upstream actively develops hosted cloud services, remote database provider syncing (e.g. PR #2471), Stripe billing for Flux (PR #2533), Apple App Store IAP (PR #2339), and remote email verification (PR #2473).
3. **Multi-Actor & `<|ACTOR|>` Dynamic Staging**:
   - This fork supports `<|ACTOR|>` tokens for mid-conversation dynamic character switching, LRU display model caching, and multi-actor character cards. Upstream is strictly 1:1 character cards.
4. **Expanded Avatar Runtimes (4 Engines + Unity Companion)**:
   - This fork natively supports 4 avatar engines (VRM, Live2D, MMD with PMX physics, Spine 2D) and a high-fidelity Unity C# sidecar (`apps/stage-mate`). Upstream focuses on VRM/Live2D and Godot 4 experiments.
5. **Two-Layer Memory & Dreaming Subsystems**:
   - This fork features STMM daily summaries, LTMM immutable text journal with `text_journal` tool, Sacred Journal Rule, Dreaming Worker reflections, Echo chips, and Universe/storyline isolation.
6. **Autonomous Artistry & BYOW**:
   - Native ComfyUI API direct integration with Bring-Your-Own-Workflow `workflow_api.json` node mapping and autonomous Director decision loops.
7. **Speech & Audio Pipeline Awareness**:
   - **Web Speech API** (`browser-web-speech-api`): Browser-native STT; routes audio data over the network to browser vendor servers (e.g. Google).
   - **Apple Speech** (`SFSpeechRecognizer`): Native Apple framework supporting genuine on-device offline recognition on Apple Silicon.
   - While Apple Speech has legitimate on-device privacy value, it is currently an upstream-focused provider not wired in this fork. Distinguish these architectures carefully rather than conflating them or recommending unported provider patches.
8. **Responses API & Hosted Server-Side Gateways**:
   - This fork is strictly client/local-first with direct provider connections and local WebGPU/WASM inference (`packages/provider-inference`, `packages/stage-ui/src/stores/providers`).
   - Upstream actively develops a hosted `/v1/responses` gateway (OpenResponses schema, Flux billing, OpenRouter routing in `server/apps/api`).
   - **Filter Rule**: This fork does not support the Responses API (at least not yet, and there is no plan to do so). All upstream changes touching `/v1/responses` or OpenResponses are auto-rejects and can be safely ignored.
9. **Native In-Process Memory & Cognition vs. External Daemon Bridges (Cortico PR #2634)**:
   - This fork is strictly 100% in-process: character memory is powered natively by the Eight Pillars (STMM daily summaries, LTMM immutable Sacred Journal, Echo chips, distilled Lifetime Artifacts, and Orama hybrid search) stored directly in client-side IndexedDB (`local:*`) and `localforage`.
   - It requires zero secondary terminal processes, zero daemons, and maintains full parity across Desktop (Electron), Web, and Mobile (Capacitor).
   - Upstream PR #2634 proposes offloading character cognition and persona to an external Cortico daemon (`@proj-airi/cortico-bridge` on `ws://localhost:6122`), breaking single-command launch (`pnpm dev:bridge` requirement), gutting native memory settings pages, breaking Web/Mobile compatibility, and relying on raw unindexed host directory scans. **External persona daemons are auto-rejects for core adoption.**
10. **Hosted Cloud Display Model Sync vs. BYOS / Local Asset Catalogs**:
   - This fork is strictly client/local-first: avatars, Live2D assets, VRMs, and display models are stored directly in local client storage (`localforage` / IndexedDB) or backed up via Bring Your Own Storage (BYOS: S3/R2/Google Drive backup), with zero server accounts, zero remote auth requirements, and zero centralized model sync.
   - Upstream actively develops hosted central S3 upload sessions, cloud model syncing, transfer queues, and subscription gates (`server/apps/api/src/routes/display-models`, `display-model-sync.ts`, `transfer-queue.ts`, `display-models.repo.ts`, PRs #2869, #2970, #2972, #2973).
   - **Filter Rule**: All upstream PRs, commits, and fixes touching hosted cloud display model sync or cloud model downloading/deduplication (e.g. PR #2869, PR #2973) are permanent auto-rejects for cherry-picking. Never recommend upstream cloud display model syncing changes as cherry-pick candidates.
11. **Local-First Desktop Distribution vs. Hosted Auto-Updater Infrastructure**:
   - This fork operates as a local-first desktop application with explicit, user-directed release packaging and offline distribution. It does not run background auto-updater daemons, remote feed polling, or auto-restart installer hooks.
   - Upstream actively develops Electron `autoUpdater` integrations, Flatpak/Nix packaging-specific updater disable flags, update download/check mutexes, and `quitAndInstall` window lifecycle hooks (`auto-updater.ts`, `hide-on-close.ts`, PRs #3081, #3082, #3083, #3084).
   - **Filter Rule**: All upstream PRs, commits, and fixes touching Electron auto-updater services, background update feeds, and installer window closure workarounds (e.g. PR #3081, #3082, #3083, #3084) are permanent auto-rejects for cherry-picking. Never recommend upstream auto-updater changes as cherry-pick candidates.
12. **Absence of Wake Words / Voice Trigger Engines**:
   - This fork does not include, maintain, or use wake words (`openwakeword`, Sherpa-ONNX wake engines, or acoustic trigger catalogs). Audio ingestion relies strictly on user-directed Push-to-Talk, VAD, or explicit hotkeys.
   - Upstream actively develops wake word catalogs, wake word preparation lifecycles, and openwakeword integration.
   - **Filter Rule**: All upstream PRs, commits, and fixes touching wake word engines, wake word catalogs, or wake word preparation (e.g. PR #3104) are permanent auto-rejects for cherry-picking. Never recommend wake word changes as cherry-pick candidates.

## Upstream Radar Watchlist (High-Interest Monitored PRs)

Maintain an active rolling monitor of high-impact upstream PRs during scheduled radar checks. When running `scripts/upstream-tracker.mjs`, evaluate changes in discussion velocity, maintainer triage, or lifecycle transitions for these specific items:

- **PR #2634: `[WIP] feat(cortico-bridge): embed Cortico persona core as AIRI's brain`**
  - **Author**: `@peachoolong-uwu` | **State**: Draft
  - **Focus**: Community proposal to replace native memory with an external Cortico WebSocket daemon (`ws://localhost:6122`).
  - **Monitoring Objective**: Track upstream maintainer reactions (@luoling8192, @nekomeowww) regarding the 2-process developer friction (`pnpm dev:bridge`), loss of Web/Mobile parity, and deletion of native memory settings. Hold off on commenting until maintainers officially weigh in.
- **PR #2672: `refactor(stage-ui): bind conversations to window-local characters`**
  - **Author**: `@luoling8192` | **State**: Open
  - **Focus**: Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard component.
  - **Monitoring Objective**: Track upstream maintainer implementation of window-local character selection and conversation scoping. Evaluate whether extracting a shared `CharacterCard` component offers value for our decoupled Control Strip and stage surfaces.
- **PR #2541: `Telltworose/feat/drop in plugins` (MCP-first tool architecture)**
  - **Author**: `@telltworose` | **State**: Open (Changes Requested)
  - **Focus**: Community plugin loader. Author pivoted 180° away from in-process Node execution to MCP stdio child processes and card-level tool scoping (`extensions.airi.tools.allowed`) after `@dasilva333`'s comment.
  - **Monitoring Objective**: Track author rebase against `main` and explanation to maintainer `@0xSelenicDove` regarding deleted loader files and merge conflicts.
- **PR #2290: `feat(server): stream official ASR over WebSocket`**
  - **Author**: `@luoling8192` | **State**: Open (Changes Requested)
  - **Focus**: Upstream official ASR streaming transport. User `@dasilva333` advised OpenAI-compatible HTTP SSE (`stream: true`) to avoid per-utterance WS handshake latency and proxy friction.
  - **Monitoring Objective**: Track author rebase and backend transport/billing accounting decisions.
- **PR #2120: `refactor(stage-pages): rebuild AIRI Card editor`**
  - **Author**: `@luoling8192` | **State**: Open (Changes Requested)
  - **Focus**: Character card editor overhaul in `stage-pages`. User `@dasilva333` shared dedicated page/route architecture from fork.
  - **Monitoring Objective**: Track dirty-draft browser unload protection and component decoupling.
- **PR #2980: `feat(stage-ui,stage-pages): add voiceprint enrollment`**
  - **Author**: `@sumimakito` | **State**: Merged
  - **Focus**: Local speaker diarization via `@sherpaw/speaker-diarization` (0.3.0) and the CAM++ 28 MB ONNX model. Enrolls user voiceprints to enable Mode 1 biometric wake-word gating ("owner only") and opens the path to Mode 2 multi-speaker conversational tagging.
  - **Monitoring Objective**: Track WebAssembly/worker bundling, false-rejection handling, and evaluate for local Mode 1/Mode 2 port per `docs/proposal-speaker-diarization-and-voiceprint-tracker.md`.
- **PR #3000: `feat(memory-eval): add identity-continuity evaluation package`**
  - **Author**: `@RUI-debug769` | **State**: Open (68 comments)
  - **Focus**: Self-contained identity continuity metrics package (`@proj-airi/memory-eval`) using Wasserstein-1 distance, GMM BIC bimodality for split-persona detection, and fixed-point operator convergence.
  - **Monitoring Objective**: Track maintainer decisions regarding package location (`packages/` vs `evals/`), benchmark harness independence, and evaluate portability for our Eight Pillars memory evaluation.

## Upstream Radar vs. Cherry-Pick Triage SOP

- **Reconnaissance Tracking (Observe Everything)**:
  - The upstream radar in `docs/UPSTREAM_RADAR.md` MUST capture the full macro picture: commits, PRs, comments, cloud features, Stripe, billing, auth, and community velocity.
  - The user wants visibility into upstream's total trajectory, even for features this fork will never adopt.
- **Cherry-Pick Triage (Filter Deliberately)**:
  - When recommending **Cherry-Pick Candidates**, strictly filter against the architectural shifts above.
  - Never recommend `controls-island` fixes, hosted cloud auth/billing, or single-actor assumptions.
  - Only recommend high-value bugfixes, UI primitives, or features that cleanly fit the fork's decoupled architecture.


### Authoritative Design & Architecture Documents

- [docs/content/en/docs/chronicles/roadmap.md](docs/content/en/docs/chronicles/roadmap.md) — AIRI Pending Items Catalog (roadmap triage source of truth).
- [docs/project-selective-upstream-sync-protocol.md](docs/project-selective-upstream-sync-protocol.md) — Selective upstream sync protocol.
- [docs/project-selective-upstream-sync-shortlist.md](docs/project-selective-upstream-sync-shortlist.md) — Selective upstream sync shortlist.
- [docs/project-selective-upstream-sync-p1-file-manifest.md](docs/project-selective-upstream-sync-p1-file-manifest.md) — Selective upstream sync P1 file manifest.
- [docs/project-selective-upstream-sync-phase-a-buy-in.md](docs/project-selective-upstream-sync-phase-a-buy-in.md) — Selective upstream sync phase A buy-in.
- [docs/project-selective-upstream-sync-phase-b-buy-in.md](docs/project-selective-upstream-sync-phase-b-buy-in.md) — Selective upstream sync phase B buy-in.
- [docs/project-critical-upstream-sync-hashes.md](docs/project-critical-upstream-sync-hashes.md) — Critical upstream sync hashes.
- [docs/project-upstream-sync-alpha15-alpha22.md](docs/project-upstream-sync-alpha15-alpha22.md) — Upstream sync alpha15→alpha22.
- [docs/project-upstream-sync-alpha15-alpha22-v2.md](docs/project-upstream-sync-alpha15-alpha22-v2.md) — Upstream sync alpha15→alpha22 v2.
- [docs/project-upstream-sync-report-alpha22-to-latest.md](docs/project-upstream-sync-report-alpha22-to-latest.md) — Upstream sync report alpha22→latest.
- [docs/project-upstream-pr-catalog.md](docs/project-upstream-pr-catalog.md) — Upstream PR catalog.
- [docs/project-upstream-squat-candidates.md](docs/project-upstream-squat-candidates.md) — Upstream squat candidates.
- [docs/project-squat-1622-report.md](docs/project-squat-1622-report.md) — Squat 1622 report.
- [docs/project-rebase-changelog.md](docs/project-rebase-changelog.md) — Rebase changelog.
- [docs/research-fork-harvest-report.md](docs/research-fork-harvest-report.md) — Fork harvest report.
- [docs/research-forks-ecosystem.md](docs/research-forks-ecosystem.md) — Forks ecosystem.
- [docs/proposal-fork-explorer-harvest-scanner.md](docs/proposal-fork-explorer-harvest-scanner.md) — Fork explorer harvest scanner proposal.
- [docs/superpowers/README.md](docs/superpowers/README.md) — Superpowers docs README (commercial backend plans/specs index).
- [docs/project-specialized-skills.md](docs/project-specialized-skills.md) — Specialized skills project plan.

## Verification

- Read the specific roadmap entry and locate (or confirm the absence of) the corresponding current source before concluding a feature is unbuilt.
- Confirm remote names with `git remote -v`; cite upstream/fork diffs from real remotes, not invented paths.
- For any research that leads to a code change proposal, state the decision point and tradeoffs and get approval before implementing.
- After any modification made during the task, run `git status` and report open/unstaged files.

## Related Skills & References

- **Key Documents**: [[roadmap]], [[project-selective-upstream-sync-protocol]], [[project-selective-upstream-sync-shortlist]], [[project-selective-upstream-sync-p1-file-manifest]], [[project-selective-upstream-sync-phase-a-buy-in]], [[project-selective-upstream-sync-phase-b-buy-in]], [[project-critical-upstream-sync-hashes]], [[project-upstream-sync-alpha15-alpha22]], [[project-upstream-sync-alpha15-alpha22-v2]], [[project-upstream-sync-report-alpha22-to-latest]], [[project-upstream-pr-catalog]], [[project-upstream-squat-candidates]], [[project-squat-1622-report]], [[project-rebase-changelog]], [[research-fork-harvest-report]], [[research-forks-ecosystem]], [[proposal-fork-explorer-harvest-scanner]], [[project-specialized-skills]]
