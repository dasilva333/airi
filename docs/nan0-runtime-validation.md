# Nan0 Runtime Validation

## Result

The unified source, deterministic cognition runtime, affected host workspaces, production Electron bundle, and real desktop startup pass. The validation does **not** establish the task's final provider-backed acceptance criteria: no credentialed Nan0 inference turn or configured TTS playback was executed, and the card migration/restart/processor-switch sequence was not performed against a disposable credentialed desktop profile. Accordingly, this checkpoint is buildable and runtime-launchable but is not described as fully validated or complete.

Validation date: 2026-07-19 (America/Chicago).

## Static and deterministic validation

| Command / check | Result | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Pass | All 57 workspace projects resolved; Electron/native dependency rebuild completed; the lockfile remained frozen. |
| `pnpm -F @proj-airi/nan0-runtime typecheck` | Pass | Runtime public and internal contracts compile. |
| `pnpm -F @proj-airi/nan0-runtime test` | Pass | 23 test files, 300 tests. |
| `pnpm -F @proj-airi/stage-ui typecheck` | Pass | Includes chat hooks/orchestrator, Nan0 store/bridge, input persistence, Live Session guard, and card-store migration. |
| Focused Stage UI Vitest run for `nan0-config`, `nan0-renderer`, both bridge suites, input presence, tool authority, and response disposition | Pass | 7 files, 32 tests. |
| `pnpm -F @proj-airi/stage-pages typecheck` | Inherited failure | Reproduces the exact pre-integration error in untouched `src/pages/settings/system/user-profile.vue(110,9)`: an object is assigned to a string. No Nan0 path appears in the diagnostic. The supported desktop typecheck/build below passes. |
| `pnpm -F @proj-airi/stage-tamagotchi typecheck` | Pass | Electron main, preload, and renderer contracts compile. |
| `pnpm -F @proj-airi/stage-tamagotchi build` | Pass | Main bundle: 800 modules. Renderer: 5,118 modules. Nan0 renderer chunk emitted. Only the checkpoint's non-failing Vite/UnoCSS warnings appeared. |
| `pnpm lint` | Analysis completed: 0 errors, 144 warnings | Repository-wide warnings include generated workers and existing fork code. Ported Nan0 has non-failing style warnings; no broad cleanup was performed. The Windows wrapper retained an open handle after printing `Finished`, so the orphaned lint process was stopped after the result was captured. |
| `git diff --check` | Pass | No whitespace errors or conflict markers in the integration diff. |
| `npx tsx scripts/yaml-manager.js audit packages/i18n/src/locales/en/settings.yaml` | Pass | No duplicate localization keys. |
| Forbidden-seam scan | Pass | No hardcoded `[MONOLOGUE]`/`[DECISION]` Nan0 parser, TODO placeholder, retired host adapter, or second Nan0 scheduler remains. `local_nan0` is retained only as the canonical processor identifier. |

The repository has no separate non-mutating formatter-check script. Style/format enforcement was therefore evaluated with the repository's `moeru-lint` command plus `git diff --check`; `lint:fix` was deliberately not run because it is a broad mutating cleanup command.

## Persistence and restart evidence

Deterministic tests validate the persistence invariants without credentials:

- `LocalStorageStateStore.test.ts` verifies stale-writer protection, exactly-once Kyo input/Nan0 output reload, decision and completed-turn retention, shared thought provenance, monotonic revisions, legacy-state migration, temporal markers, and restart-safe handled events.
- the kernel suites validate observation -> thought -> decision -> completion, suppressed and failed outcomes, metabolism, autonomy, continuity, and export/hydration behavior;
- `Nan0HeartbeatEngine.test.ts` verifies idempotent start, serialized wakes, bounded jitter, clean stop/restart, no duplicate timers, and one terminal record for every started tick;
- `nan0-bridge-idempotency.test.ts` verifies that a retried temporal request executes once;
- `nan0-config.test.ts` verifies fresh-install opt-out, active-card-only legacy migration, provider/model preservation, explicit non-Nan0 preservation, schema stamping, and repeat idempotency.

The migration persists the card update before changing the in-memory card list. An interrupted write therefore leaves the migration eligible for retry instead of falsely marking it complete.

## Real Electron launch evidence

The built application was launched from `apps/stage-tamagotchi` with Electron 40.8.0 after materializing the Electron binary in `node_modules`. This dependency repair changed no source.

Observed process topology:

| Process role | Count |
| --- | ---: |
| Electron main | 1 |
| GPU process | 1 |
| Utility processes | 3 |
| Renderer processes | 6 |

Observed native windows:

- `AIRI - Looking at ReLU` (transparent stage surface);
- `AIRI - Control Strip` (rendered and visible);
- `Developer Tools - file:///H:/airi-nan0-unified/apps/stage-tamagotchi/out/renderer/index.html`.

The launch used AIRI's existing desktop profile read-only from the validation workflow: no card, processor, provider, or secret was changed. A recursive filename check under AIRI's `userData` found no Nan0 diagnostic output, confirming the diagnostics sink remains off by default. The exact validation main process and its children were then stopped.

## Acceptance checklist

| Requirement | Status | Evidence / blocker |
| --- | --- | --- |
| AIRI starts normally | Pass | Real main/GPU/utility/renderers and visible control strip observed. |
| Generic processors remain wired | Static pass; live not exercised | Generic orchestration is retained and the app builds; no provider-backed generic turn was sent. |
| Cognition tab renders | Build pass; live not exercised | Component compiles in Stage Pages and full Electron renderer; the live card editor was not opened. |
| `local_nan0` selection and configuration persistence | Deterministic pass; live not exercised | Config/migration tests pass; no disposable live card profile with credentials was used. |
| Restart retains `local_nan0` | Deterministic pass; live not exercised | Migration and persistence logic is restart-safe by test; live restart sequence remains unexecuted. |
| Kyo input reaches the real kernel | Deterministic pass; live provider turn blocked | Store and kernel tests exercise the boundary; no credentialed desktop turn was sent. |
| Exactly one thought and decision | Deterministic pass; live provider turn blocked | Kernel suites and completion gates pass. |
| Allowed visible response uses AIRI rendering | Static pass; live provider turn blocked | Chat stream remains AIRI-owned; no real model response was produced. |
| TTS uses configured AIRI provider | Static pass; not executed | Nan0 authorizes/suppresses before AIRI's retained speech path. No speech credential/device run was performed. |
| Input/output/provenance persistence | Deterministic pass; live provider turn blocked | Persistence tests retain actor, thought, decision, turn, session, input, output, timeline, and monotonic revision. |
| Canonical actor ownership | Pass in tests | Runtime identity suites preserve `kyo`/`nan0` and aliases. |
| Heartbeat does not duplicate | Pass in tests | Sole `Nan0HeartbeatEngine`; idempotent lifecycle and bridge tests pass. |
| Processor switching stops/reactivates one runtime | Static/deterministic pass; live not exercised | Card watcher and renderer election implement the transition; no live switch sequence was performed. |
| No placeholder/duplicate speech or persistence | Static and deterministic pass | Placeholder parser removed; one disposition gate, one terminal path, and exactly-once tests. |
| Diagnostics show one active owner | Ownership tests pass; live diagnostics off | Renderer-election tests pass. The privacy-preserving default prevented a diagnostic owner dump during launch. |
| UI has no broken placeholder controls | Compile pass; live editor not inspected | Official controls/i18n are used; interactive editor QA remains. |

## Remaining runtime blockers

The following evidence is required before anyone may label the integration complete:

1. Configure a disposable desktop profile with an authorized reasoning provider/model and AIRI speech provider.
2. Select or migrate one known Nan0 card, restart, and verify the selection remains `local_nan0`.
3. Send one Kyo turn and capture one persisted observation, thought, allowed decision, visible AIRI response, speech playback, turn/session linkage, and post-restart reload.
4. Exercise a suppressed turn and a provider failure to confirm silence/error terminalization in the real renderer.
5. Switch to a generic processor and back while observing one Nan0 owner, one heartbeat, no hidden thoughts, no duplicate speech, and no duplicate persistence.
6. Open the Cognition editor and visually verify the real selection/save path in the disposable profile.

No source defect was observed in the validated layers; the blocker is unavailable credentialed/end-to-end runtime evidence, not compilation or deterministic test failure.
