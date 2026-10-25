# Selective Upstream Sync

## Purpose

This document defines the process for pulling useful upstream improvements from `moeru-ai/airi` into `dasilva333/airi` without blindly rebasing or merging large batches of commits.

The goal is to preserve the fork as the tested source of truth while still benefiting from upstream fixes and improvements where they are actually valuable.

## Why This Process Exists

The fork is often:

- many commits ahead of upstream
- a smaller number of commits behind upstream
- carrying heavily tested local changes that should not be casually overwritten

A blind rebase or merge is the wrong default when:

- upstream includes large amounts of unrelated churn
- upstream touches files that are actively customized in the fork
- Git conflict resolution would be tempted to pick a side instead of preserving both intents

This process treats upstream as a content source, not a history source.

## Core Principle

The fork's current tested behavior is the baseline.

Upstream changes are reviewed as candidate improvements. They are not accepted automatically just because they are newer.

In practical terms:

- prefer the fork's behavior when there is conflict
- only absorb upstream intent where it is clearly useful
- preserve both intents when both are valid
- ignore upstream noise that does not improve the fork

## Correct Terminology

This workflow is better described as:

- selective upstream sync
- file-level upstream integration
- curated upstream assimilation
- forward-port audit

It is **not** primarily a rebase workflow, even if Git tools are used underneath.

## Default Working Model

Use `airi-clean-pr` as the clean-room scratch repo.

Use `airi-rebase-scratch` as the live, tested repo and do not use it as a conflict playground.

`airi-rebase-scratch` must remain checked out on local branch `main`.

Do not switch `airi-rebase-scratch` to temporary branches.

Do not use `airi-rebase-scratch` for rebases, cherry-pick experiments, conflict resolution, or branch-staging work.

The only acceptable advancement model for `airi-rebase-scratch` is:

- keep the repo checked out on `main`
- validate risky work somewhere else
- then bring approved work into `main`
- fast-forward-like advancement of the live line only

If a temporary branch is needed at all, it belongs in `airi-clean-pr` or a disposable worktree, never in `airi-rebase-scratch`.

The clean-room process should be:

1. Fetch the latest `origin/main` and `upstream/main`.
2. Treat the fork's `origin/main` as the base.
3. Compute the upstream-only file set from `origin/main...upstream/main`.
4. Filter out obvious noise and unrelated surfaces.
5. Review the remaining files one by one.
6. Classify each file as `ignore`, `inspect`, `import`, or `hand-merge`.
7. Integrate only the approved file set in the clean room.
8. Typecheck and smoke-test there.
9. Port the approved result back to the live repo only after validation.

## File Classifications

### `ignore`

Use when upstream changed a file but the change is irrelevant to the fork's current goals.

Examples:

- docs churn
- mobile-only assets
- Android scaffolding
- project-level agent skill updates
- telemetry changes the fork does not currently want

### `inspect`

Use when a file may contain worthwhile ideas, but it is not yet clear whether the full upstream change belongs in the fork.

This is the staging state for files that need human judgment before acceptance.

### `import`

Use when the upstream file change is low-risk and the fork rarely or never customizes that file.

This means the file can usually be copied over with little or no local adaptation.

### `hand-merge`

Use when the file is important, actively customized in the fork, or likely to carry conflicting intent.

This means:

- review the upstream diff manually
- preserve the fork's existing behavior first
- selectively pull over useful upstream pieces
- never rely on one-click conflict resolution

## Decision Heuristics

Choose `hand-merge` when any of these are true:

- the file is routinely edited in the fork
- the file controls behavior already stabilized locally
- the file is a store, runtime entrypoint, provider layer, or renderer surface
- losing local intent would be costly

Choose `import` when:

- the file is mostly declarative
- the fork rarely touches it
- the upstream change is clearly beneficial and contained

Choose `ignore` when:

- the file does not affect the fork's active surfaces
- the change is mostly release/process churn
- there is no meaningful user value for the fork

## Practical Goal

This process is designed to answer:

> Which upstream changes are actually worth taking, and how do we preserve fork quality while taking them?

That is the standard moving forward.

## Tracking Baselines

Because this workflow is content-based instead of history-based, the GitHub ahead/behind counters will often remain misleading.

A non-zero `behind` count does **not** automatically mean the fork is functionally missing all of those upstream changes.

For this reason, every selective sync pass should record:

- the upstream head SHA that was reviewed
- the fork commit where the accepted changes landed
- the approved file set
- any explicitly rejected upstream files or concepts

This becomes the real baseline for future sync work.

## Workspace Invariant

Treat this as a hard rule:

- `airi-rebase-scratch` is the canonical live workspace
- `airi-rebase-scratch` should always be checked out on `main`
- `airi-clean-pr` is the playground
- disposable worktrees are the playground

If there is any doubt about where risky Git operations belong, the answer is never `airi-rebase-scratch`

### Current Recorded Baseline

- reviewed upstream head: `4671ceaaae92f5d780319394512bf63ed01a85f1`
- clean-room branch: `selective-upstream-sync-2026-03-16`
- accepted selective-sync landing commit: `a13e3479`
- Codex thread id: `019ceec8-bb6c-7f01-a7b6-f505fe20e6b4`

Interpretation:

- GitHub may still report the fork as being behind upstream
- that number is historical, not a full measure of functional drift
- future selective sync passes should compare against the last reviewed upstream head first, not just the raw behind count

## Reconnaissance Tracking vs. Selective Porting Filters

It is critical to distinguish between **Radar Reconnaissance** and **Selective Porting**:

1. **Radar Reconnaissance (Full Ecosystem Awareness)**:
   - The upstream tracker and radar reports in `docs/UPSTREAM_RADAR.md` MUST observe, track, and log everything upstream is doing across all domains—including hosted cloud sync, billing, Stripe, Apple IAP, authentication flows, and community discussion velocity.
   - Even if the fork has zero intention of adopting cloud billing or hosted databases, maintaining a radar of upstream's macro direction provides vital situational awareness of their architectural trajectory and community needs.
   - Do NOT scrub or exclude upstream cloud/commercial initiatives from the high-level radar report or community buzz metrics.

2. **Selective Porting Filters (Cherry-Pick & Integration Boundaries)**:
   - When transitioning from observation to action—evaluating **Cherry-Pick Candidates** or proposing PR ports—strict architectural filters apply.
   - Changes that touch dead, superseded, or incompatible architectures must be filtered out so the fork does not waste time reviewing or porting changes that make no sense in this codebase.

## Permanent Architectural Divergence & Upstream Filter Catalog

The following areas represent permanent or intentional architectural divergences between `dasilva333/airi` and `moeru-ai/airi`. Changes in these categories must NOT be recommended as cherry-pick candidates:

### 1. Control Island & Chat Floating vs. Control Strip (Decoupled Stage Architecture)
- **Fork Reality**: In commit `e10223f2e` and subsequent stage cleanups, this fork completely eliminated the legacy monolithic `controls-island` (`apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/`) and `chat-floating.vue`. The architecture underwent a deep structural decoupling:
  - **Actor Stage Window (`windows/stage`)**: Dedicated strictly to avatar rendering (`RendererStage.vue` / `WidgetStage.vue` for VRM, Live2D, Spine, MMD).
  - **Main Window / Control Strip (`windows/main`)**: Hosts the independent, floating, draggable glassmorphic ribbon (`ControlStrip.vue`, `ControlStripHost.vue`) and desktop chat window.
- **Upstream Reality**: Upstream never decoupled this. They continue to maintain and patch the monolithic `controls-island` inside their stage window (e.g. PR #2522 Wayland hover fixes, drawer menus) and the legacy floating chat dock (`chat-floating.vue`, e.g. PR #3107).
- **Filter Rule**: Any upstream commits, PRs, or diffs touching `controls-island` or `chat-floating.vue` are **permanent auto-rejects** for porting. Never propose or cherry-pick them.

### 2. Local-First Desktop vs. Hosted Cloud & Monetization
- **Fork Reality**: `dasilva333/airi` is strictly a private, local-first desktop application with Bring Your Own Storage (BYOS: S3/R2/Google Drive backup), local unstorage/localforage persistence, and zero online account requirements.
- **Upstream Reality**: Upstream actively develops hosted cloud services, remote database provider syncing (e.g. PR #2471), Stripe product restoration (PR #2533), Apple App Store IAP (PR #2339), and remote email verification flows (PR #2473).
- **Filter Rule**: Report these in the radar for macro awareness, but classify them as `⚪ ignore / rejected in fork` for integration. Never recommend them for local porting.

### 3. Speech & Audio Engines
- **Fork Reality**: Primary zero-config STT is `browser-web-speech-api` (Chromium Web Speech API), alongside `whisper-local` (on-device WebGPU/WASM Whisper) and cloud STT providers.
- **Upstream Reality**: Upstream introduced a native macOS/iOS Apple Speech provider (`apple-speech` via `SFSpeechRecognizer`).
- **Filter Rule**: Web Speech API routes audio data over the network to browser vendor servers (e.g. Google), whereas native Apple Speech supports on-device offline recognition on Apple Silicon. While Apple Speech has legitimate on-device privacy value, it is not currently wired in this fork. Do not confuse Web Speech with Apple Speech, and do not propose Apple Speech fixes (such as PR #2540) unless a deliberate port of the native Apple Speech provider is authorized.

### 4. Multi-Actor & Expanded Avatar Runtimes
- **Fork Reality**: This fork supports `<|ACTOR|>` tokens for mid-conversation dynamic character switching, LRU display model caching, and multi-actor character cards. It also provides first-class support for 4 model formats (VRM, Live2D, MMD with PMX physics, Spine 2D) and a high-fidelity Unity companion (`apps/stage-mate`).
- **Upstream Reality**: Upstream focuses predominantly on 1:1 character cards, VRM/Live2D, and experimental Godot 4 sidecar skeletons.
- **Filter Rule**: Upstream patches assuming single-actor cards or Godot sidecars must not be blindly imported over the fork's multi-actor or Unity sidecar runtimes.

### 5. Hosted Responses API & Server-Side LLM Gateways
- **Fork Reality**: `dasilva333/airi` is strictly client- and local-first, directly dispatching to AI providers (e.g. OpenRouter, Ollama, OpenAI, Anthropic, Gemini) via client-side adapters and WebGPU/local runtimes (`packages/provider-inference`, `packages/stage-ui/src/stores/providers`). There is no intermediate proxy or server-side responses gateway.
- **Upstream Reality**: Upstream is actively building and hardening a hosted `/v1/responses` gateway (OpenResponses specification) with server-side settlement, Flux billing, token aggregation, and OpenRouter routing in `server/apps/api`.
- **Filter Rule**: We do not support the Responses API (at least not yet, and there is no plan to do so). Upstream commits, PRs, or diffs touching the Responses API (`server/apps/api/.../responses`, OpenResponses schemas, or client adapters specifically binding to `/v1/responses`) can be safely ignored and treated as auto-rejects for porting.

### 6. Wake Words & Voice Triggers
- **Fork Reality**: `dasilva333/airi` does not use or maintain wake words (`openwakeword`, Sherpa-ONNX wake-word engines, or acoustic wake triggers). Audio interaction relies strictly on user-initiated Push-to-Talk, VAD speech input, or intentional desktop hotkeys.
- **Upstream Reality**: Upstream actively develops wake word catalogs, wake word preparation lifecycles, and openwakeword integration.
- **Filter Rule**: All upstream commits, PRs, and fixes touching wake word engines, wake word catalogs, or wake word preparation (e.g. PR #3104) are permanent auto-rejects for cherry-picking. Never recommend them as cherry-pick candidates.

## Relevant Skills

- [[airi-roadmap-upstream-research]]

