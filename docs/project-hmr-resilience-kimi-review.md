I'll conduct this peer review systematically. Let me start by reading the primary documents and the cited source files in parallel.
Now let me read the Rosetta Stone §16 section and the ControlStripHost.vue citations, plus the character store reference mentioned in the doc.
Now let me verify the critical technical claims. I need to check: (1) `createChatHooks` implementation, (2) the speech pipeline runtime internals, (3) whether Pinia `acceptHMRUpdate` / `import.meta.hot` is actually wired anywhere in the codebase (this determines whether the doc's premise even triggers, and whether Strategy C's claim about in-place patching is accurate), and (4) Pinia's actual HMR implementation in `node_modules`.
Now let me read Pinia 3.0.4's actual `acceptHMRUpdate` implementation — this is the linchpin for validating Strategy C's "patches state in-place" claim.
Let me see the `useStore` function itself to complete the picture of how the hot path reuses the existing store.
I now have everything needed — I verified the doc's claims against the actual source, the Pinia 3.0.4 HMR implementation in `node_modules`, the Vite config, and the repo's git history. Here is the full peer review.

---

# Peer Review: `project-hmr-resilience-architecture.md`

**Overall verdict**: The initiative targets a real problem class and four of five strategies are directionally sound, but the document has a **premise-level factual error** that changes what implementation actually means, one **syntax-invalid code pattern**, several **citation/mechanism inaccuracies** against the current source, and it **misses the single most important decision** (Phase 0). Details below, all verified against source.

---

## 1. The Premise Problem: none of the five failure modes can currently trigger as described

The doc's causal chain is: *"file modified → Vite re-evaluates module → Pinia re-runs setup → long-lived components keep stale references."* This chain is broken at its first two links in the current codebase:

1. **No store is an HMR boundary.** `acceptHMRUpdate` appears **nowhere** in `packages/` or `apps/` — and `git log -S 'acceptHMRUpdate'` shows it has *never* been in the tree. The only `import.meta.hot` usages are in the 3D/Live2D/Spine model layer ([vrm-instance-cache.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-three/src/components/Model/vrm-instance-cache.ts), plus `hot.dispose` in Model/Canvas components). I reviewed the renderer plugin chain in [electron.vite.config.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/electron.vite.config.ts) (Vue, VueMacros, VueRouter, Layouts, UnoCss, VueI18n, Yaml) — nothing injects store-level accepts; plugin-vue only makes `.vue` SFCs *self*-accepting.

2. **Consequence**: editing `chat.ts`, `session-store.ts`, or `speech-runtime.ts` today propagates up the importer graph to the entry and triggers a **Vite full reload** — every renderer window reloads, every component remounts, every store re-instantiates consistently. That is disruptive (lost in-flight streams, reconnect churn — matching the "forced to restart/refresh" symptom) but it does **not** produce stale closures. The "text streams but TTS silently drops" symptom cannot be reproduced via the doc's stated mechanism under the current wiring.

**This matters practically, not just pedantically**: Strategies A (`hot.data` singletons) and E (`hot.dispose`) are **inert without accept boundaries** — `import.meta.hot.data` only persists across re-evaluations of an *accepted* module, and `dispose` only fires for accepted updates. You could merge Phases 1–3 verbatim and observe zero behavior change. The doc needs an explicit **Phase 0: add `import.meta.hot.accept(acceptHMRUpdate(useXStore, import.meta.hot))` to the enumerated hot-path stores** — and it must state plainly that this *changes* dev behavior from full-reload to in-place patching, which is what *activates* all five failure modes. The initiative is really "make store-level HMR safe so we can stop eating full reloads," and it should say so.

I'd also recommend the doc include an **empirical reproduction log** (file edited → observed result per window). Given the fork's conventions on empirical truth, the current symptom list ("heartbeats disconnect," "strip stops responding") reads as anecdote without the repro path; some of it is consistent with a different mechanism (HMR websocket drop → one window stranded on an old module generation while peers reloaded), which the mitigations here would not fix.

---

## 2. Failure-mode validation against Pinia 3.0.4 (verified in `node_modules/pinia/dist/pinia.mjs`)

The doc's central mechanistic claim — *"Pinia replaces the store instance in its registry (`pinia._s.set(id, newStore)`)"* — is **incorrect for Pinia 3**. I read the actual implementation:

- [`acceptHMRUpdate`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/node_modules/pinia/dist/pinia.mjs) calls `useStore(pinia, existingStore)`; the hot path builds a throwaway `__hot:<id>` store (re-running `setup()` in a **new effect scope**) and then calls `existingStore._hotUpdate(newStore)`, which **mutates the existing reactive store object in place** — state keys are re-bound (`store[key] = toRef(newStore.$state, key)`), actions and getters are swapped onto the **same object**, and `pinia._s` keeps the original instance. Object identity is preserved.

With that established, per failure mode:

**FM1 (defunct event buses) — mechanism real, citation wrong.** The risk is real: `hooks.onTokenLiteral` closures capture per-instance hook arrays ([hooks.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/hooks.ts)), and ControlStripHost destructures `onTokenLiteral` at setup scope ([line 80](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue)) and registers at lines 1134–1238. **But the doc says registration happens "during `onMounted`" — it does not.** [Line 982](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue) and all hook registrations are `<script setup>` top-level (i.e., `setup()` body), with cleanup correctly handled in `onUnmounted` via `chatHookCleanups` (line ~1291). Fix the citation; the setup-vs-mounted distinction matters for anyone implementing the fix.

**FM2 (captured sibling store references) — largely a non-bug under Pinia 3.** Because identity is preserved, `const chatOrchestrator = useChatOrchestratorStore()` captured in [proactivity.ts:45](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/proactivity.ts) and [live-session.ts:147](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/live-session.ts) remains the same patched object; `chatOrchestrator.performSend(...)` at call time resolves through the proxy to the *new* action. The genuinely hazardous pattern is **destructured functions/getters** (snapshots of old wrapped actions closing over the old setup scope) and captured *non-store* module bindings — not store object references. Phase 2's wholesale "convert static store variables to dynamic accessors" refactor is mostly unnecessary work targeting a failure mode that doesn't exist on this Pinia version. Re-scope it to a destructuring audit. (Late resolution is still fine style and fixes init-ordering hazards, but the doc must not justify it with a false mechanism.)

**FM3 (module singletons vs. re-evaluation) — correct but incomplete.** Accurate that re-evaluating [chat.ts:96](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts) constructs a new `hooks`. Missing nuances: (a) `hot.data` is **per-module** — it only preserves across re-evaluations of the module that owns it *and* accepts; (b) editing **`hooks.ts`** instead of `chat.ts` bypasses `chat.ts`'s self-accept (accept doesn't cover dependency updates) → full reload anyway. The singleton, the `hot.data` stash, and the accept boundary must be **co-located in one module**, or the singleton moves to a tiny dedicated self-accepting module.

**FM4 (ephemeral registries) — effect correct, mechanism description wrong.** There is no `hosts = []` array. [pipeline-runtime.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/services/speech/pipeline-runtime.ts) holds a single nullable `hostPipeline` + `remoteIntentMap`, and the runtime is created **inside** the store setup ([speech-runtime.ts:6](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/speech-runtime.ts)), not at module scope. More importantly, the "silently fails" story is only one branch of a nondeterministic mess: `openIntent` has a **remote-intent fallback** that emits onto the eventa BroadcastChannel bus ([bus.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/services/speech/bus.ts)); the *old* runtime's bus listeners may still be bound to the old pipeline object (same `speechPipeline` the still-mounted host owns), so post-HMR audio can **keep working by accident via zombie listeners**, then break later when the component remounts. The doc should describe this honestly — "behavior after HMR is nondeterministic across zombie listeners, fallback paths, and remount timing" is the actual engineering truth and the stronger argument for the fix.

**FM5 (un-disposed side effects) — correct, and it's the most important one.** Verified in Pinia source: `_hotUpdate` does **not** stop the old setup's effect scope. Every `watch`, `useIntervalFn`, `useLocalStorage`, `useBroadcastChannel`, and eventa subscription created in a store setup **persists and duplicates** on each accepted HMR. The doc undersells this by leaving the source location generic. Concrete, citable instances in the current tree:

- [chat.ts:125](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts) — `useBroadcastChannel('airi-chat-input-bridge')` in setup: each accepted HMR adds **another channel + watcher** → cross-window input gets posted N times.
- [proactivity.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/proactivity.ts) — `useIntervalFn` heartbeat + `useElectronEventaInvoke` contexts at lines 79–80 (new eventa contexts per setup re-run risk double IPC subscription in the preload bridge).
- [live-session.ts:159–165](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/live-session.ts) — `useLocalStorage` watchers per re-run.

This is the mode that will bite hardest the moment Phase 0 lands (duplicate heartbeats firing LLM turns = real money). It deserves top billing, not last.

---

## 3. Strategy evaluation

**Strategy A (`hot.data` singletons) — right idea; the snippet is a syntax error and the codebase already has the correct idiom.**

```ts
const hooks = (import.meta.hot?.data.hooks as ReturnType<typeof createChatHooks>) ??= createChatHooks()
```

`??=` requires a valid assignment target; an optional-chain/`as` expression on the LHS is invalid (`a?.b ??= c` is a SyntaxError in both ES and TS). The repo's own prior art in [vrm-instance-cache.ts:22-27](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-three/src/components/Model/vrm-instance-cache.ts) is the correct, already-established pattern — cite it in the doc instead of inventing a new one:

```ts
const hotData = import.meta.hot?.data as { chatHooks?: ReturnType<typeof createChatHooks> } | undefined
const hooks = hotData?.chatHooks ?? createChatHooks()
if (import.meta.hot)
  import.meta.hot.data.chatHooks = hooks
```

Two additions worth mandating: (1) a **shape/version guard** — if you edit `createChatHooks` to add a hook type, the preserved instance silently lacks it; store a version key and rebuild on mismatch; (2) note the co-location requirement from FM3 above.

**Strategy B (late resolution) — premise false on Pinia 3; keep as style guidance only.** As analyzed in FM2: captured store objects survive in-place patching; what breaks is *destructured members*. Replace the ❌/✅ example with one contrasting `const { performSend } = useChatOrchestratorStore()` (snapshot, goes stale) vs. property access at call time (safe). This narrows Phase 2 from a four-file refactor to a targeted audit.

**Strategy C (reactive streams over callbacks) — verified sound, with three caveats to add.** I confirmed `storeToRefs` returns `toRef(store, key)` property refs that read through the reactive proxy, and `_hotUpdate`'s in-place reassignment triggers key-level reactivity, so previously captured refs and component `watch(() => store.x)` blocks genuinely survive HMR. Caveats the doc should state:

1. It only holds once `acceptHMRUpdate` is actually wired (Phase 0).
2. **In-flight async closures don't migrate.** A `performSend` streaming loop mid-turn is the old closure writing to old setup-scope refs; after `_hotUpdate` rebinds state keys to new refs, the UI freezes mid-stream while the old loop writes into the void. `hot.data` on `hooks` keeps the *event* path alive, but state-path desync remains. Note that [chat.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts) already has a `generation` field in `QueuedSend` — that generation-guard idiom is the right prior art to generalize ("HMR bumps generation → in-flight loops detect and abort gracefully").
3. C does not subsume FM5 — Pinia re-runs setup (with its watchers) regardless.

**Strategy D (primitive event transport) — sound and already the de-facto pattern; add the duplication hazard.** The speech bus already does exactly this (`eventa:audio:speech:intent:*` over BroadcastChannel). What the doc misses: [bus.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/services/speech/bus.ts) caches `channel`/`context` in module scope; on re-evaluation a **second same-name `BroadcastChannel` object** is created in the same window, the old one is never closed, and per spec *all* same-name channel objects except the poster receive every message → **duplicate delivery** to zombie contexts. Mitigations: preserve channel/context in `hot.data` too, `channel.close()` in dispose, and make consumers idempotent using the `originId`/`sequence` fields the payloads already carry. This BroadcastChannel multiplication issue deserves its own line in the gap section — it affects the ~15 channels catalogued in Rosetta Stone §13, not just speech.

**Strategy E (`hot.dispose` teardown) — correct tool, incomplete semantics.** Add three operational rules:

1. `dispose(cb)` fires **before** re-evaluation, only for accepted boundaries, and it **cannot reach into the old setup's effect scope** — you must stash teardown handles where dispose can see them. Recommend a standard **side-effect ledger** pattern: a module-scope array (itself `hot.data`-preserved) that setup pushes disposers into; `hot.dispose` drains it. VueUse composables self-register on the scope, so the ledger must wrap creation (`const stop = watch(...)`) explicitly.
2. **Never call `store.$dispose()` from `hot.dispose`** — it deletes the id from `pinia._s`, which makes `acceptHMRUpdate`'s `pinia._s.has(id)` check fail, the update gets skipped, and components keep the orphaned store object. Teardown must target side effects only.
3. Accept the transient: old scope dies at dispose, new scope starts at accept — for intervals/heartbeats, drain-and-rebuild via the ledger avoids the double-fire window entirely.

---

## 4. Gap analysis — what the doc misses

1. **Phase 0 (the decision) — covered above; it's the biggest gap.** Which stores get `acceptHMRUpdate`? Recommend an explicit allowlist (chat stack, speech-runtime, proactivity, live-session, hearing, character) and a documented "everything else keeps full-reload" stance. Also document the **blast radius**: edits to shared low-level modules (`stage-shared`, `types/chat.ts`, `hooks.ts` from outside) still full-reload — that's fine; say so.
2. **Web Workers.** Kokoro TTS / Whisper / WebLLM / Web-RWKV workers are outside Vite's renderer HMR graph; a store setup re-run that constructs workers spawns **duplicates holding WebGPU/AudioWorklet resources**. Worker handles belong in `hot.data`-preserved singletons with `terminate()` in dispose. Not mentioned anywhere in the doc.
3. **Multi-window module-generation divergence.** Each Electron window is its own Vite HMR client; a dropped socket or a failed reload leaves windows on *different module generations* that keep talking over same-name BroadcastChannels. Since D makes the bus the long-term compatibility surface, recommend a **bus protocol version** in payloads so a stale window can detect and hard-reload itself instead of silently mis-pairing.
4. **Pinia plugins.** Verified: no `pinia.use(` anywhere in `apps/` today, so plugin re-execution on hot store creation is not currently a risk — but the doc should note it as an audit item if a persistence/sync plugin is ever introduced (extenders re-run per hot creation; subscriptions double).
5. **Verification plan is manual-only.** Suggest: (a) a dev-only invariant assertion after accept (`console.assert(import.meta.hot.data.chatHooks === hooks)`); (b) an automated smoke — even a small script driving the Vite dev server, touching `session-store.ts`, and asserting heartbeat interval count stays 1 via a debug counter would catch FM5 regressions; (c) an ESLint rule or codemod for "no destructuring of store actions/getters at setup scope" — that's a mechanical, enforceable form of the real FM1/FM2 lesson.
6. **Production-safety note**: the strategies are dev-only by construction (`import.meta.hot` is undefined in prod builds), which is good, but say it explicitly — reviewers will ask.

---

## 5. Citation & companion-doc corrections

- [rosetta-stone.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/rosetta-stone.md) §16: *"re-executing Pinia setup functions creates new store instances"* should read "re-executes setup and patches the existing store in place (Pinia 3), leaving old effect scopes alive"; and the stale-closure framing needs the "accepted HMR only; unaccepted edits full-reload" qualifier. Per AGENTS.md, the Rosetta Stone should be corrected when the durable lesson is established.
- Initiative doc: fix "onMounted" → setup scope (ControlStripHost), fix "in-memory array `hosts = []`" → single `hostPipeline` + remote-intent fallback, fix the `pinia._s.set(id, newStore)` claim, fix the Strategy A snippet, and demote FM2/Strategy B as analyzed.
- Line citations `chat.ts:90-96`, `speech-runtime.ts:5-7`, `proactivity.ts:44-46`, `live-session.ts:146-148` are otherwise accurate — good.

---

## 6. Recommended roadmap revision

| Phase | Content |
| :--- | :--- |
| **0 (new)** | Decide & wire `acceptHMRUpdate` on the allowlisted hot-path stores; record before/after repro log. |
| **1** | `hot.data` singletons with version guards, co-located with their accept boundary: chat `hooks`, speech bus `channel`/`context`, speech runtime handle; worker handles. |
| **2 (re-scoped)** | Side-effect ledger + `hot.dispose` draining for setup-scope effects (FM5): `useBroadcastChannel`, `useIntervalFn`, `useLocalStorage`, eventa invoke contexts. **This is the highest-risk phase, not the last.** |
| **3 (re-scoped)** | Targeted destructuring audit (not sibling-store rewrite); in-flight generation guard for streaming; bus protocol versioning. |

---

**Bottom line**: approve the initiative's direction, but request a revision before implementation — the "current mechanism" narrative is empirically wrong (verified: no accept boundaries exist, Pinia 3 patches in place, full-reload is today's actual behavior), Strategy A's snippet won't compile, and FM5 + the missing Phase 0 should drive sequencing. Happy to do a focused editing pass on the doc (and the §16 entry) incorporating all of the above if you want — per our pair-programming protocol I've made no changes yet.
