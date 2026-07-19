# Nan0 Full Integration Matrix

## Scope and evidence

This matrix is the implementation boundary for merging the complete current Nan0 runtime into Richard's official AIRI checkpoint without replacing AIRI's host architecture.

| Role | Location / revision | Authority |
| --- | --- | --- |
| Destination host | `H:\airi-nan0-unified`, branch `nan0-full-integration`, base `4a37ee43e62939527f0bf730667c1047741acb23` | Richard's AIRI application structure, card model, UI, persistence, providers, Electron composition, and chat orchestration |
| Nan0 behavior source | protected snapshot at `H:\nan0-pre-unification-backup` | Complete current Nan0 cognition behavior, including the source worktree's tracked, staged, unstaged, and relevant untracked implementation |
| Original Nan0 worktree | `H:\Nan0_Airi_Source` at `6cfa8a26aff1b8165175fa1ff20e601ed2f45fc4` plus its captured dirty state | Read-only after backup; never an integration output |

The backup contains 4,413 tracked files and 7 relevant untracked implementation files. All 4,420 included files were verified by SHA-256. The unstaged patch is 101,524 bytes; the staged patch is empty. Temporary scripts, data exports, collaboration exports, archives, and `.codex*` files were recorded but are not integration inputs.

## Architecture decision

Nan0 remains a cognition pipeline:

`Event -> Interpretation -> Identity -> Emotion -> Thought -> Speech Decision -> Speech Generation -> Output`

Speech is never created directly from an event or prompt. AIRI remains the application host. The canonical browser-side integration boundary is `packages/stage-ui/src/stores/nan0.ts`; it owns the kernel, persistence, completion, and heartbeat lifecycle. Electron's separate chat and root renderers require one bounded `BroadcastChannel` bridge, `nan0-bridge.ts`, but that bridge may carry only prepared decisions, terminal outcomes, and sanitized authority. It may not interpret events or invent thought. The chat orchestrator remains responsible for host streaming, while the response-disposition and tool-authority gates enforce the already-made Nan0 decision.

## Cognition runtime inventory

All rows marked **Port** are implemented runtime behavior, not conceptual scaffolding. Their existing focused tests are ported with them unless noted.

| Subsystem / source path under `packages/nan0-runtime/src` | Decision | Host dependencies | Preserved behavior and ownership | Validation |
| --- | --- | --- | --- | --- |
| `kernel/Nan0Kernel.ts` | Port | Runtime modules below; injected LLM and clock | Sole cognition orchestrator; interpretation through thought, decision, terminal completion, state export/hydration | Runtime typecheck; autonomy, metabolism, temporal-autonomy, and integration tests |
| `types.ts` | Port | None | Canonical typed cognition events, state, thought, decisions, authority, completion, and persistence schema | Runtime typecheck and consumers' typechecks |
| `attention/Nan0AttentionEngine.ts` | Port | Kernel state | Attention salience and focus; never produces speech | Existing unit tests |
| `prediction/Nan0PredictionEngine.ts` | Port | Identity, temporal and relationship evidence | Pattern recognition and expectation tracking | Existing unit tests |
| `goals/Nan0GoalEngine.ts` | Port | Predictions, identity, state | Goal formation and selection used by the current kernel | Existing unit tests |
| `goals/Nan0Goals.ts` | Port | Kernel state | Current goal ledger and goal continuity used by the kernel | Existing unit tests |
| `intentions/Nan0PendingIntentions.ts` | Port | Goals, clock, persistence | Deferred/self-directed intentions and restart-safe lifecycle | Existing unit tests |
| `relationship/RelationshipMemory.ts` | Port | Actor identity and persisted state | Actor-scoped relationship memory and continuity | Existing unit tests |
| `identity/ActorIdentity.ts` | Port | Persisted actor records | Protected Kyo/Nan0 identity aliases, actor ownership, hydration corrections | Existing unit tests |
| `emotional/Nan0EmotionalDynamics.ts` | Port | Interpreted event, identity, temporal state | Emotional dynamics feeding thought; never rewrites output | Existing unit tests |
| `thought/Nan0ThoughtEngine.ts` | Port | Provider/model host injection | Private thought generation, opinions, conclusions, and valid thought source | Existing unit tests plus chat integration tests |
| `thought/Nan0ThoughtPolicy.ts` | Port | Thought engine | Bounds thought generation and normalization without making Nan0 assistant-like | Existing unit tests/runtime typecheck |
| `decision/Nan0DecisionEngine.ts` | Port | Valid thought | Sole speak/suppress/defer routing; cannot invent a thought | Existing unit tests and disposition tests |
| `continuity/ConversationContinuity.ts` | Port | Timeline, relationship, session events | Conversation continuity and correction across turns | Existing unit tests |
| `timeline/SessionTimeline.ts` | Port | Clock and state store | Ordered session evidence and restart-safe temporal context | Existing unit tests |
| `temporal/Nan0Clock.ts` | Port | Injected/default clock | Deterministic time source | Runtime tests using controlled clock |
| `temporal/Nan0Temporal.ts` | Port | Clock, persistence | Temporal state and remembered intervals | Existing unit tests |
| `temporal/Nan0TemporalEngine.ts` | Port | Clock, goals, predictions, intentions | Temporal cognition and autonomous eligibility | Existing unit tests |
| `temporal/Nan0TemporalEventGenerator.ts` | Port | Temporal engine | Generates cognition events only; cannot route or speak | Existing unit tests |
| `heartbeat/Nan0HeartbeatEngine.ts` | Port as sole scheduler | Kernel, lifecycle, host callback | Exactly one owner heartbeat loop and one terminal result per tick | Existing heartbeat tests plus owner smoke test |
| `capabilities/Nan0CapabilityRegistry.ts` | Port | Host-provided capabilities | Bounded capability discovery; authority still comes from thought/decision | Existing unit tests |
| `lifecycle/Nan0Lifecycle.ts` | Port | Kernel, persistence, heartbeat | Start/stop/terminal lifecycle and cleanup | Existing unit tests |
| `persistence/LocalStorageStateStore.ts` | Port as canonical persisted store | Browser `localStorage` | State key `nan0/kernel-state/v1`, deterministic serialization, safe hydration | Existing unit tests and restart smoke test |
| `persistence/InMemoryStateStore.ts` | Port for tests/isolated runtime | None | Deterministic non-persistent test store | Runtime tests |
| `memory/LegacyMemoryImporter.ts` | Port | Explicit legacy input only | Deterministic import of prior memory shape; no raw user dataset bundled | Import tests/typecheck; sample data excluded |
| `diagnostics/Nan0KernelObservatory.ts` | Port | Optional bounded sink | Disabled by default; redaction, private-thought opt-in, bounded event sizes, duplicate/terminal classification; never affects cognition | Existing observatory tests and Electron sink smoke test |
| `index.ts` and package build config | Port and revise exports | Workspace package system | Public runtime API exports only active canonical mechanisms | Package build/typecheck |
| `host/Nan0HostAdapter.ts` | Retire | None in real host | Unused alternate host boundary; retaining it would create a second integration seam | Confirm no imports/exports |
| `host/CallbackHostBindings.ts` | Retire | None in real host | Unused callback wrapper around the retired adapter | Confirm no imports/exports |
| `host/Nan0HostAdapter.test.ts` | Retire with implementation | Retired seam | Tests a boundary that is not used in AIRI | Confirm absent from test inventory |

## AIRI host integration inventory

| Destination area | Decision | Dependencies | Required behavior | Validation |
| --- | --- | --- | --- | --- |
| `packages/stage-ui/src/stores/nan0.ts` | Port/adapt as canonical boundary | Nan0 runtime, AIRI card/provider/chat stores | One kernel per owner; prepare before compose, inject sanitized directive, gate before send, complete exactly once on response/silence/error, persist after transitions | Focused tests, stage-ui typecheck, desktop smoke test |
| `packages/stage-ui/src/stores/nan0-renderer.ts` | Port | Electron route/hash | Elect `#/chat` as cognition owner and root renderer as executor; all other windows skip runtime installation | Unit test and multi-window smoke test |
| `packages/stage-ui/src/stores/nan0-bridge.ts` | Port | `BroadcastChannel` | Bounded cross-renderer request/response, retry/timeout, response cache and idempotency; carries no raw private cognition beyond explicit sanitized payload | Existing bridge tests plus two-renderer smoke test |
| `packages/stage-ui/src/stores/nan0-input-presence.ts` | Port | Session store | Record accepted, unique user inscriptions only | Existing tests |
| `packages/stage-ui/src/stores/nan0-tool-authority.ts` | Port | Prepared Nan0 decision | Suppress tools unless valid thought/decision/action authority exists | Existing tests and orchestrator tests |
| `packages/stage-ui/src/stores/nan0-autonomy-scheduler.ts` | Retire/exclude | Duplicates heartbeat engine | An unused second heartbeat owner would violate lifecycle ownership | Confirm absent/no references |
| `packages/stage-ui/src/stores/chat/response-disposition.ts` | Port | Chat stream context | Native speak/suppress contract that enforces a decision without inventing one | Existing focused tests |
| `packages/stage-ui/src/stores/chat/types.ts` | Adapt | Session and Nan0 contracts | Carry required session ID, response disposition, and tool authority through one turn | Stage-ui typecheck |
| `packages/stage-ui/src/stores/chat/hooks.ts` | Adapt | Orchestrator | Add explicit silence and error terminal hooks alongside compose/send/completion hooks | Hook and orchestrator tests |
| `packages/stage-ui/src/stores/chat/session-store.ts` | Adapt minimally | Input-presence notifier | Notify Nan0 only after a user inscription is accepted and de-duplicated | Session-store tests/typecheck |
| `packages/stage-ui/src/stores/chat.ts` | Manually integrate, do not replace | Official AIRI orchestrator | Remove the hardcoded `local_nan0` monologue placeholder; preserve generic `none` first-hop behavior; invoke Nan0 hooks; enforce response/tool gates; terminalize success, silence, and error exactly once | Focused tests, stage-ui typecheck, runtime smoke test |
| `packages/stage-ui/src/stores/proactivity.ts` | Adapt minimally | Chat context | Provide session ID for autonomous turns; Nan0 remains heartbeat owner when enabled | Typecheck and heartbeat smoke test |
| `packages/stage-ui/src/stores/modules/live-session.ts` | Add architecture guard | Card cognition configuration | Keep Gemini Live unchanged for non-Nan0 cards; refuse or stop its direct audio session when Nan0 is enabled because that path cannot preserve thought-owned speech | Stage-ui typecheck, Electron build, source inspection |
| `apps/stage-tamagotchi/src/renderer/main.ts` | Adapt minimally | Renderer election/runtime install | Install Nan0 only after app mount and only in participating renderer | Desktop build and launch smoke test |
| `packages/stage-shared/src/nan0-diagnostics.ts` | Port | Eventa | Typed, bounded renderer-to-main diagnostic contract | Typecheck |
| `apps/stage-tamagotchi/src/main/services/airi/nan0-diagnostics.ts` | Port/adapt | Electron `userData`, shared contract | Optional JSONL sink, disabled by default, bounded batches and events, failure-isolated | Unit/smoke test; verify default produces no file |
| `apps/stage-tamagotchi/src/main/index.ts` | Adapt minimally | `injeca`, `@moeru/eventa` | Register exactly one diagnostics service using the official composition pattern; no unrelated CORS/tray/URL changes | Desktop build and launch smoke test |
| `packages/stage-ui/package.json` | Add runtime dependency | `@proj-airi/nan0-runtime` | Workspace resolution for canonical boundary | Frozen install after lock update, typecheck |
| `packages/stage-shared/package.json` | Add runtime dependency only if shared diagnostic types import it | Runtime types | Avoid duplicated contract types | Typecheck |
| `apps/stage-tamagotchi/package.json` | Add runtime dependency | Runtime and diagnostics service | Electron build resolution | Desktop build |
| `pnpm-lock.yaml` | Regenerate mechanically | Workspace graph | Reproducible dependency graph only; no unrelated upgrades | Frozen install |

## Card configuration, UI, and migration

| Area | Decision | Required behavior | Validation |
| --- | --- | --- | --- |
| `packages/stage-ui/src/stores/modules/airi-card.ts` | Extend Richard's official types/store | Add optional typed cognition config without dropping official fields; retain current card persistence and synchronization | Stage-ui and stage-pages typechecks; card round-trip test |
| `packages/stage-ui/src/stores/nan0-config.ts` | Port/adapt pure config helpers | Supported `local_nan0`/`none` shape, schema version, defaults from the card's consciousness provider/model | Existing and new unit tests |
| Card migration in AIRI card load path | Add deterministic migration | If cognition already exists, preserve explicit processor/enabled/provider/model and stamp current schema. If cognition is absent and `nan0/kernel-state/v1` exists, migrate only the active card, seeding provider/model from that card's consciousness module. Never convert all cards, names, explicit `none`, or another processor. Persist before recording completion; reruns are no-ops. | Unit tests for fresh, legacy, explicit-none, non-active, interrupted write, repeat, and restart cases |
| `CardCreationDialog.vue` | Preserve official component; patch only typed cognition plumbing | Keep Richard's provider watcher, layout, tabs, and existing behavior | Stage-pages typecheck and visual inspection |
| `CardCreationTabCognition.vue` | Adapt official tab | Use `@proj-airi/ui` controls and i18n; expose only real supported processor/provider/model/enabled settings; explain Nan0 ownership without assistant framing | Stage-pages typecheck and visual inspection |
| `packages/i18n/src/locales/en/settings.yaml` | Add managed keys | English Cognition labels, descriptions, ownership notice and options through `scripts/yaml-manager.js` | YAML manager readback and stage-pages build/typecheck |

## Explicit exclusions

| Excluded source | Classification / reason |
| --- | --- |
| `apply-nan0-cognition.ps1`, `inspect-airi-nan0-integration.ps1` | One-off patch/inspection scripts, not runtime |
| `nan0-chat-wiring-source.txt`, `nan0-integration-map.txt` | Generated working notes superseded by this matrix/report |
| `.codex*`, collaboration exports, `nan0-airiData*`, source ZIPs | Temporary/exported/user data; never product source |
| `legacy-memory-sample.json` | Sample data is not required by runtime and must not ship as user-like data |
| Broad Kyo-source diffs outside the rows above | Divergent fork work unrelated to Nan0 unification |
| Kyo root engine/version changes, removed dependencies, app-version downgrade | Unrelated release/dependency policy changes |
| Kyo `CardCreationDialog.vue` wholesale replacement | Would regress Richard's current provider watcher and unrelated official card features |
| Kyo Electron CORS, tray, and default-URL changes | Unrelated host behavior |
| Personality rewrites or sanitization | Forbidden: runtime/ownership integration does not justify changing character behavior |
| Direct prompt-to-speech, event-to-speech, or hardcoded token parser paths | Architecture violation; the official checkpoint's temporary `local_nan0` parser must be removed |

## Required end-to-end validation

1. Verify the destination still descends from exact base `4a37ee43e62939527f0bf730667c1047741acb23` and that both original source trees remain unchanged after the backup boundary.
2. Run Nan0 runtime typecheck and complete runtime test suite.
3. Run focused stage-ui tests for configuration, bridge, renderer ownership, input presence, tool authority, response disposition, and chat terminal lifecycle.
4. Run affected workspace typechecks. The untouched checkpoint's independent `stage-pages` baseline failure in `settings/system/user-profile.vue` is recorded and must be distinguished from integration regressions.
5. Run the complete Electron `stage-tamagotchi` production build (which includes its typechecks).
6. Launch the desktop application and exercise: fresh Nan0 card, legacy-state migration, normal spoken turn, suppressed turn, provider failure, owner/executor routing, heartbeat, restart/hydration, and diagnostics disabled/enabled behavior.
7. Inspect the complete diff, ensure no raw data/temporary artifacts/build outputs enter a commit, create clean local commits only, and do not push.
8. Build `H:\airi-nan0-unified-handoff.zip` from committed source only and verify archive contents and destination cleanliness.

## Known baseline condition

Before integration, `pnpm -F @proj-airi/stage-ui typecheck` and the complete Electron build passed. The standalone `pnpm -F @proj-airi/stage-pages typecheck` reported one pre-existing error at `src/pages/settings/system/user-profile.vue(110,9)`: an object is assigned where a string is expected. Final validation reproduces that exact untouched error, while the supported `stage-tamagotchi` typecheck and production build pass.
