# AIRI + Nan0 Integration Report

## Status

This repository is a coherent, buildable, locally committed AIRI + Nan0 integration, but it is **not declared fully validated or complete**. Static validation, 332 focused tests, the supported Electron production build, and a real desktop launch pass. The remaining acceptance blocker is credentialed end-to-end evidence: a real provider-backed Nan0 turn, configured TTS playback, interactive card persistence/restart, and live processor switching were not executed in a disposable profile.

## Provenance and evidence

| Item | Verified value |
| --- | --- |
| Destination | `H:\airi-nan0-unified` |
| Integration branch | `nan0-full-integration` |
| Richard base | `4a37ee43e62939527f0bf730667c1047741acb23` |
| Base ancestry | `git merge-base HEAD 4a37ee43e62939527f0bf730667c1047741acb23` returned the exact base hash |
| Kyo source | `H:\Nan0_Airi_Source`, branch `main`, HEAD `6cfa8a26aff1b8165175fa1ff20e601ed2f45fc4`, plus captured dirty/untracked state |
| Protected backup | `H:\nan0-pre-unification-backup` |
| Backup content | 4,413 tracked files + 7 relevant untracked files; 4,420 SHA-256 entries; 101,524-byte unstaged patch; empty staged patch |
| Final source-integrity check | All 4,420 current source files matched the backup hashes; no missing files, hash mismatches, or `git status --short` delta |

The destination was cloned from Richard's official `kyo-nan0-integration-base` branch and no existing history was rewritten. Neither source location was edited. No commit was pushed.

## Diagnosis

**Evidence:** Richard's checkpoint supplied the current Electron host, card-scoped cognition UI, provider/model transport, chat stream, rendering, speech, persistence backends, renderer topology, and Eventa/injeca composition. Kyo's worktree supplied the implemented Nan0 kernel and its identity, thought, decision, persistence, temporal, relationship, autonomy, heartbeat, diagnostic, and bridge behavior. The checkpoint's `local_nan0` branch was only a prompt/parser placeholder and could produce speech without running the real kernel.

**Failed Layer:** cognition ownership and host lifecycle integration.

**Root Cause:** the official host extension point and the real Nan0 cognition runtime had never been unified. The placeholder parser bypassed thought-owned speech, while copied adapters/schedulers would have created competing configuration, runtime, heartbeat, and completion paths.

**Files To Change:** the Nan0 runtime package; card cognition types/configuration/migration and editor; Stage UI chat context/hooks/orchestrator and canonical Nan0 store/bridge; renderer startup; shared and main-process diagnostics; package manifests/lockfile; i18n; architecture and handoff documentation.

**Files Not To Change:** AIRI's provider transports, speech/STT implementation, rendering engines, vision capture, generic processor behavior, core card persistence implementation, unrelated Electron CORS/tray/URL behavior, Nan0 personality policy, either source repository, raw user data, or collaboration/export artifacts.

**Risks Introduced:** cross-renderer ownership races, duplicate completion, stale-state overwrite, accidental migration of unrelated cards, direct-audio bypass of thought-owned speech, diagnostic leakage, and generic-processor regression. The implementation addresses these with renderer election, an idempotent bounded bridge, terminal maps, merge-safe persistence, active-card-only migration, a Gemini Live guard for Nan0 cards, default-off bounded diagnostics, and preservation of the generic chat path.

## Responsibility matrix summary

The complete file/subsystem inventory and action decision is in [`nan0-full-integration-matrix.md`](./nan0-full-integration-matrix.md).

Canonical ownership is now:

- AIRI owns the application, cards, configuration storage, provider/model transport, message ingress, rendering, TTS/STT, vision, plugins, Electron lifecycle, and generic processors.
- Nan0 owns identity-preserving cognition, private thought, decision/speech authorization, actor interpretation, continuity, relationship/emotional/temporal state, autonomous evaluation, silence/refusal, and Nan0 state semantics.
- `packages/stage-ui/src/stores/nan0.ts` is the one unified host boundary and runtime owner API.
- `Nan0HeartbeatEngine` is the one Nan0 scheduler.
- `nan0-bridge.ts` is the one bounded owner/executor renderer bridge; it transports prepared decisions and terminal outcomes but cannot invent thought.
- the AIRI chat stream remains the one output/render/TTS path, gated by the Nan0 disposition and tool authority already produced by cognition.

## Implemented subsystem inventory

The ported runtime includes:

- kernel orchestration and typed state contracts;
- attention, prediction, goals, pending intentions, and capability registry;
- protected actor identity and alias normalization for Kyo/Nan0 ownership;
- emotional dynamics, relationship memory, conversation continuity, and session timeline;
- thought generation/policy and decision/speech authorization;
- temporal state, clock, temporal event generation, metabolism, and autonomous evaluation;
- lifecycle and sole heartbeat engine;
- in-memory and merge-safe local-storage state stores;
- deterministic legacy-memory importer without sample user data;
- bounded, redacted, opt-in kernel observatory diagnostics;
- 23 runtime test files covering 300 deterministic cases.

The AIRI-native integration includes:

- card-scoped `local_nan0` configuration with AIRI provider/model selection;
- schema-versioned, active-card-only legacy migration;
- official card editor and i18n integration using repository UI primitives;
- owner/executor renderer election and one installed runtime;
- unique accepted-input notification;
- thought/decision response disposition and tool authority gates;
- success, silence, and error terminal hooks with exactly-once completion cleanup;
- assistant output linkage through observation, thought, decision, turn, session, input/output references, actors, timestamps, and monotonic state revision;
- Eventa/injeca diagnostic composition with bounded JSONL output, default disabled and private thought excluded by default;
- a guard that leaves Gemini Live available to non-Nan0 cards but refuses/stops it for Nan0 cards because its direct audio generation cannot pass through Nan0's required thought -> speech-decision -> speech chain.

## Duplicate and placeholder implementations removed

- removed the hardcoded `[MONOLOGUE]` / `[DECISION]` `local_nan0` parser and placeholder response path;
- retired unused `Nan0HostAdapter`, `CallbackHostBindings`, their test, and exports;
- excluded the alternate `nan0-autonomy-scheduler` because the heartbeat engine is canonical;
- retained no parallel processor registry, duplicate Nan0 store, second state key, second heartbeat timer, fallback compatibility bridge, or unreliable assistant completion listener;
- preserved Richard's official required manual tool-call index and generic `none` first-hop behavior.

## Configuration and migration behavior

The canonical processor ID is `local_nan0`; the state key is `nan0/kernel-state/v1`; the cognition schema version is `1`.

Migration rules:

1. Explicit cognition configuration wins. Its processor/enabled/provider/model values are preserved and the current schema version is stamped.
2. A fresh install is not opted into Nan0.
3. Legacy Nan0 state triggers migration only for the active card when that card has no cognition configuration.
4. Provider and model are seeded from that card's existing consciousness module.
5. Other cards, explicit `none`, and other/future processor IDs are not converted.
6. The IndexedDB card write completes before the in-memory list changes, so interruption leaves a safe retry.
7. Repeating the migration at the current schema is a no-op.

## Deliberate exclusions

| Source item/class | Classification and reason |
| --- | --- |
| `.codex*` browser/state audit scripts | Temporary Codex tooling, not product source |
| `apply-nan0-cognition.ps1`, `inspect-airi-nan0-integration.ps1` | One-off patch/inspection tooling superseded by native code and reports |
| `nan0-chat-wiring-source.txt`, `nan0-integration-map.txt` | Generated working notes superseded by the matrix |
| `nan0-airiData*`, raw data, source ZIPs, collaboration export | User/export/archive material forbidden from the product tree |
| `legacy-memory-sample.json` | Sample data not required by the importer and inappropriate for source handoff |
| Unrelated Kyo fork diffs | Divergent personal/release/CORS/tray/default-URL/dependency behavior outside Nan0 ownership |
| Wholesale Kyo card-dialog replacement | Would regress Richard's current provider watcher and unrelated official card features |
| Conceptual future systems | No new broad WorldModel, Constitution, Predictions, Goals, simultaneous modality, or autonomous-tool system was invented beyond implemented runtime behavior |

## Validation

Detailed commands, process evidence, persistence evidence, and the 25-point acceptance table are in [`nan0-runtime-validation.md`](./nan0-runtime-validation.md).

Key results:

- frozen workspace install: pass;
- Nan0 typecheck: pass;
- Nan0 tests: 23 files / 300 tests pass;
- focused Stage UI integration tests: 7 files / 32 tests pass;
- Stage UI typecheck: pass;
- standalone Stage Pages typecheck: exact inherited failure in untouched `settings/system/user-profile.vue:110`;
- Stage Tamagotchi node/web typechecks and full production build: pass (800 main modules, 5,118 renderer modules, Nan0 chunk emitted);
- repository lint: 0 errors and 144 warnings before commit-hook fixes; each implementation commit also passed the repository's mandatory `moeru-lint --fix` hook;
- localization duplicate-key audit: pass;
- real Electron launch: pass, with one main, one GPU, three utility, six renderer processes, visible control strip, transparent stage, and developer-tools surface;
- default-off diagnostics: no Nan0 file produced during launch;
- source backup integrity: all 4,420 hashes and captured dirty status unchanged.

## Runtime, persistence, restart, TTS, and switching evidence

- **Runtime startup:** verified in the actual built Electron application.
- **Persistence:** deterministic stale-writer, exactly-once, provenance, actor, timeline, monotonic revision, and hydration tests pass.
- **Restart:** state/config/heartbeat restart behavior passes deterministic tests; an interactive provider-backed desktop restart was not performed.
- **TTS:** the AIRI speech boundary is preserved after Nan0 authorization; actual configured speech playback was not performed.
- **Processor switching:** renderer/card watchers and tests establish the intended one-runtime transition; live switch-away/switch-back evidence was not captured.
- **Provider-backed turn:** not performed. This blocks claims that visible speech, TTS, persisted output, restart, and live switching satisfy final acceptance in a real credentialed session.

## Local commit series

1. `5f2312ec1cc5ee1e9385d3b4e80ada1485069b13` — `feat(nan0): add cognition runtime package`
2. `9f46eaa5b468d6ec0c6a13f76b487c35006af1a3` — `feat(stage): add card-scoped Nan0 cognition`
3. `1b7636e1ec65583fc4209bbc334df5b185c2d26b` — `feat(stage): integrate Nan0 cognition lifecycle`
4. `docs(nan0): document integration and validation` — documentation/handoff commit containing this report, matrix, validation record, and Rosetta Stone update

No push was performed.

## Patch plan outcome

The planned source changes are implemented and locally committed. The remaining work is validation, not an additional architecture patch: run the six credentialed interactive steps in the runtime validation document, record their evidence, and only then upgrade the status from incomplete.

## Handoff

- repository: `H:\airi-nan0-unified`
- backup: `H:\nan0-pre-unification-backup`
- source-only archive: `H:\airi-nan0-unified-handoff.zip`

The archive is generated from committed `HEAD` with `git archive`, so it excludes `.git`, ignored/untracked `node_modules`, build output/caches, local secrets, `.env` files, diagnostic output, raw datasets, and collaboration/export artifacts.

## Remaining risk

The exact remaining risk is runtime integration with real external services and persisted desktop state. A credentialed turn could still expose provider-specific streaming, speech-device, or card-switch timing behavior not represented by deterministic tests. Until the provider-backed/TTS/restart/switch sequence passes, this checkpoint must remain labeled incomplete despite its clean architecture, successful build, and passing deterministic suites.
