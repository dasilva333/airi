# Phase A Buy-In: `packages/core-agent` (#1826, #1819)

Companion docs:

- [`project-selective-upstream-sync-protocol.md`](./project-selective-upstream-sync-protocol.md)
- [`project-selective-upstream-sync-shortlist.md`](./project-selective-upstream-sync-shortlist.md)
- [`project-selective-upstream-sync-p1-file-manifest.md`](./project-selective-upstream-sync-p1-file-manifest.md)

**Status:** Review only — **no code ported yet.**

---

## Branch naming (clean room)

Use a **selective-sync / evaluation** branch, not `feat/*`:

| Repo | Branch | Role |
|------|--------|------|
| `airi-rebase-scratch` | stays on `main` | Live, tested line — do not experiment here |
| `airi-clean-pr` | `selective-sync/core-agent-eval-2026-05` | Clean room off `fork/main` — ports and diffs only |

`feat/*` implies shipping a product feature. This work is **upstream assimilation review** until you explicitly promote a result to `fork/main`.

---

## The critical misconception

**Phase A is not “AIRI finally gets a chat orchestrator.”**

Your fork **already has** `useChatOrchestratorStore` in `packages/stage-ui/src/stores/chat.ts` (~**1,320 lines**), plus split helpers under `stores/chat/` (`session-store`, `stream-store`, `context-store`, hooks, context-providers).

Upstream #1826 does the same job name, but the change is **structural**:

| | Your fork (today) | Upstream after #1826 |
|--|-------------------|----------------------|
| Orchestrator location | Monolithic Pinia store | `packages/core-agent` runtime class |
| `chat.ts` size | ~1,320 lines | ~**262-line facade** (per PR description) |
| Vue/Pinia | Core logic inside store | Store wires **~18 DI callbacks** into runtime |
| Marker parser / categoriser | `stage-ui` composables | Moved into `core-agent` |

So Phase A is **extract + dependency-inject**, not a capability you lack.

---

## What you are actually buying into

### 1. New package: `@proj-airi/core-agent`

Framework-agnostic (no Vue) modules:

- `chat-orchestrator-runtime.ts` — `performSend`, queue, `buildProviderMessages`, hook registry, ingest paths
- `llm-marker-parser.ts`, `response-categoriser.ts` — moved out of stage-ui
- `context-registry.ts` (#1819) — registry buckets + ingest isolation between channels
- `messages/context-prompt.ts`, `datetime-prefix.ts` — prompt assembly helpers

**Benefit (if adopted):** clearer boundary between “chat engine” and “desktop UI”; easier unit tests without Pinia; Discord/Telegram/desktop feeds can share one runtime.

**Cost:** large one-time port; every fork-specific behavior in `chat.ts` must be re-expressed as DI ports or stay in the facade.

### 2. Thin Pinia facade pattern

Upstream’s `stage-ui` store becomes glue:

- IO tracing wrappers
- Cloud sync hooks (you likely **skip**)
- Artistry / Minecraft / platform-specific callbacks

Their PR text explicitly keeps “application-specific logic” in the facade via callbacks. Your fork has **different** application logic (autonomous artistry, live-session, multi-window `BroadcastChannel`, proactivity, vision, etc.) — none of that comes “for free” from copying the package.

### 3. #1819 — ingest isolation

Separate PR, but Phase A depends on it: **context registry buckets** so Discord ingest, tool bridge, etc. do not corrupt each other’s runtime context.

Your fork already has `stores/mods/api/context-bridge.ts` — compare whether upstream’s registry is **better architecture** or **parallel invention** before moving anything.

---

## Fork-specific risk (why “import Phase A” is not step one)

Your `chat.ts` already includes patterns upstream lists as facade concerns, plus fork-only systems:

- `useAutonomousArtistryStore` / card artistry extensions
- `useLiveSessionStore` (Gemini native audio path)
- `useBroadcastChannel` for multi-window chat input
- Split stores: `chat/session-store`, `chat/stream-store`, `chat/context-store` with custom context-providers (eternal-record, expressions, scenes, stickers)
- Analytics, proactivity, vision, consciousness modules

Upstream’s #1826 was written against **their** `main` orchestrator semantics (“strictly consistent with main branch”). Your fork diverged ~**800 commits per side** since alpha.4.

**Reasonable outcomes after review:**

| Outcome | When |
|---------|------|
| **Reject** | Fork orchestrator is richer/stable; extraction adds churn without UX win |
| **Cherry-pick ideas** | e.g. registry buckets, test patterns — no new package |
| **Adopt package** | Side-by-side proves runtime is cleaner *and* all fork hooks map cleanly to DI ports |
| **Fork the package** | Take `core-agent` shape but implement ports against your stores |

None of these require conceding upstream is “better.”

---

## What Phase A is *not*

- Not a replacement for Phase B (chat store split) — Phase A **is** the refactor of what Phase B touches
- Not cloud chat sync (#1775) — separate; mostly skippable for you
- Not new LLM features, tools, or providers
- Not safe to copy `packages/core-agent/**` from `moeru-ai/main` without a facade rewrite plan

---

## Recommended review sequence (before any merge)

1. **Read-only diff** (no branch merge):
   - `moeru-ai/airi` `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts`
   - vs your `packages/stage-ui/src/stores/chat.ts` (`performSend`, queue, hooks)
2. List **fork-only behaviors** in `performSend` / stream path not present upstream.
3. Decide per behavior: DI port vs stay in facade vs ignore upstream.
4. Only then, in `airi-clean-pr` on `selective-sync/core-agent-eval-2026-05`, experiment with adding `packages/core-agent` **without** deleting fork `chat.ts` logic.

---

## Clean room setup checklist

- [ ] `airi-clean-pr` checked out on `selective-sync/core-agent-eval-2026-05` from `fork/main`
- [ ] `airi-rebase-scratch` remains on `main`
- [ ] No ports until you sign off this buy-in doc
- [ ] After sign-off: Phase A experiment → typecheck → tamagotchi smoke → compare with live `main`

---

## Phase scope (confirmed)

**Phase A = #1819 + #1826 only.**

| PR | In Phase A? | What it is |
|----|-------------|------------|
| #1826 | **Yes** | Extract orchestrator → `packages/core-agent` + thin Pinia facade |
| #1819 | **Yes** | Harden context registry (Map buckets) + safe ingest in `context-bridge` |
| #1775 | **No** (Phase C) | Cloud/session chat sync, `libs/chat-sync`, server WS — separate pass |

---

## Read-only diff notes (2026-05-27)

Compared fork `packages/stage-ui/src/stores/chat.ts` `performSend` (~line 173+) vs moeru `main` `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts` `performSend`.

### You already have much of #1819

Fork `stores/chat/context-store.ts` already does **source-key buckets** + `ReplaceSelf` / `AppendSelf` (same semantics as upstream `createContextRegistry`).

# 1819 adds on top:

- `Map` instead of `Record` (prototype-pollution hardening for keys like `__proto__`)
- Bounded **context history** (400 entries) + observability
- **Safe ingest** in `context-bridge` (failed context updates don’t poison broadcast/server paths; `store-ingest-rejected` lifecycle)

**Not** “Discord/Telegram shared runtime” in the sense of unifying separate bot processes. Upstream Discord is still largely `services/discord-bot` as a separate process in their tree; your fork **rewrote** Discord as `apps/stage-tamagotchi/.../discord` + `chatOrchestrator.ingest()` in-process. #1819’s registry helps **plugin metadata source keys** on the context bridge — relevant only where you use `context-bridge` + server channel ingest, not as a reason to adopt standalone Discord architecture.

### Fork `performSend` is *much* richer than upstream core runtime

Upstream runtime `performSend` is the **baseline** send loop (compose → append user msg → stream → tools queue → finalize). Your fork adds substantial logic **not present** in upstream `chat-orchestrator-runtime.ts`:

| Capability | Fork `chat.ts` | Upstream `core-agent` runtime |
|------------|----------------|------------------------------|
| Vision / VLM handover | Yes (`visionStore`, replaces provider for image turns) | No (facade/DI would need a port) |
| Grounding / sensor injection | Yes (`groundingEnabled`, proactivity sensors) | No |
| Autonomous artistry hooks | Yes (user + assistant targets) | No (upstream keeps in facade callbacks) |
| **Bridged marker → tool loop** | Yes (`tryBridgeMarker`, multi-turn `bridgedSteps` ≤ 5) | No |
| `skipAssistant` / `triggerOnly` | Yes | No in runtime options |
| Multi-window ingest | Yes (`BroadcastChannel`, secondary-window handshake) | No |
| Eternal record context | Yes | Via `runtimeContextProviders` DI list (different shape) |
| Datetime context | Injected via context store at send start | Moved to **message assembly** / system supplement (KV-cache comment) |

**Implication:** Phase A is not “add missing features.” It is “**relocate** upstream’s simpler loop into `core-agent` while re-wiring **all fork-only behavior** through DI ports or keeping a **large** facade.” Upstream’s ~262-line facade assumes **their** fork-only stuff (cloud sync, Minecraft, etc.) — not yours.

### Structural overlap (why it’s not zero value)

Shared ideas both sides already have:

- Session generation / stale-send guard
- Hook bus (`beforeMessageComposed`, token literal/special, stream end)
- LLM marker parser + response categoriser (fork: composables; upstream: moved to `core-agent`)
- Tool-call queue during stream
- `buildProviderMessages` + datetime prefix on user messages

So the question is **package boundary + hardening**, not “get an orchestrator.”

---

## Decision log

| Date | Decision | Notes |
|------|----------|-------|
| 2026-05-27 | Phase A = **#1819 + #1826 only** | #1775 is Phase C (chat sync) |
| 2026-05-27 | Phase A = **review first**, no blind import | Fork already has orchestrator; ~1320-line store |
| 2026-05-27 | Read-only diff | Fork performSend strictly superset of upstream runtime; #1819 partly redundant |
| | Clean room branch name | `selective-sync/core-agent-eval-2026-05` |
| | | |

## Relevant Skills

- [[airi-roadmap-upstream-research]]
