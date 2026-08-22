---
name: airi-prefix-cache-alignment
description: >-
  Use when working with AIRI LLM prefix-cache alignment, prompt-compilation optimization, or KV prefix-cache layout geometry for DeepSeek/OpenRouter/Gemini. Trigger on keeping static prefix segments ahead of volatile segments, protecting cache alignment across automated sub-loops (proactivity heartbeat, Destiny 2 OCR, producer/journal), reducing token cost/latency, or validating cache-hit behavior in the chat session store.
---

Stable prefix first, volatile tail last. The whole point is layout geometry: keep the immutable system-prompt prefix ahead of volatile telemetry/history slices so providers re-use KV prefix cache instead of re-tokenizing on every automated sub-loop. Never cite `crates/` (legacy Tauri; current desktop is Electron `apps/stage-tamagotchi/`).

## Key Files/Locations

- `packages/stage-ui/src/stores/chat/session-store.ts` — `generateInitialMessageFromPrompt()` creates pure, frozen `messages[0]`; exports `buildShortTermMemoryContext` and `buildLifetimeMemoryContext`.
- `packages/stage-ui/src/stores/chat.ts` — `performSend()` injects trailing `groundingMessages` (Sensors, STMM, Lifetime, RAG, Topics, Director Scratchpad, Salience) at the tail before the user turn.
- `packages/stage-ui/src/stores/llm.ts` — `combineSystemMessagesIfNeeded()` preserves multi-system prompt blocks for OpenAI/DeepSeek/OpenRouter while merging for single-system providers (Google, WebLLM).
- `scripts/validate-prefix-cache.js` — Empirical validator tool comparing two LLM payloads to measure exact prefix overlap and locate divergence boundaries.
- `docs/proposal-prefix-cache-alignment.md` — The architectural specification for prefix cache alignment.
- `docs/proposal-director-cache-alignment-analysis.md` — The risk analysis for force-fitting caching onto the Director role.
- **Do NOT cite `packages/stage-ui/src/stores/settings/llm-performance.ts`.** That store does not exist in the tree; it only appears as an aspirational schema/panel in `proposal-prefix-cache-alignment.md` §3. Treat it as not-yet-implemented design intent, never as a real path.

## The Canonical 3-Tier Message Geometry

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. FROZEN IMMUTABLE PREFIX (Message [0])                               │
│    • Core Persona & Identity (buildSystemPrompt)                       │
│    • Speaking Style & Rules                                            │
│    • ACT Token Grammar & Tool Definitions                              │
│    🎯 100% CACHE HIT across Chat, Heartbeats, Suggestions, & Proactivity│
├────────────────────────────────────────────────────────────────────────┤
│ 2. MONOTONIC CONVERSATION HISTORY (Messages [1 .. N])                  │
│    • User: "hey rick..."                                               │
│    • Assistant: "Oh good, you're back..."                              │
│    • User: "..."                                                       │
│    🎯 Strictly monotonic growth -> Maximizes KV cache reuse per turn   │
├────────────────────────────────────────────────────────────────────────┤
│ 3. DYNAMIC GROUNDING TAIL (Trailing system blocks before User Query)   │
│    • [PAST CONTINUITY / DAILY SUMMARIES] (STMM daily blocks)           │
│    • [LIFETIME RELATIONSHIP ARTIFACT] (Distilled durable memories)     │
│    • [GROUNDED LONG-TERM MEMORIES] (Retrieved RAG entries)             │
│    • [ENVIRONMENTAL AWARENESS] (Live sensor telemetry & metrics)       │
│    • [RECENT TOPICS] & [VISUAL STATE BOARD] (Scene & Concept threads)  │
│    • [SALIENCE TELEMETRY] & [FOCUS DIRECTIVE] (Sentinels & Directives) │
└────────────────────────────────────────────────────────────────────────┘
```

## When to Use

- Re-ordering or restructuring LLM prompt segments.
- Wiring a new automated subsystem (proactivity heartbeat, Destiny 2 OCR loop, Producer Lite reply suggestions, Journal Moments) into cache-aligned assembly.
- Chasing latency or repeated-token cost in sub-loops that re-send a large stable prefix.
- Targeting prefix-cache-aware providers (DeepSeek, OpenRouter, Gemini).

## Common Pitfalls & Invariants

- **STMM / Lifetime Contamination in `messages[0]`**: Never concatenate Short-Term Memory summaries or Lifetime Artifacts into `messages[0]`. Doing so makes `messages[0]` volatile and destroys prefix cache alignment between Chat and Heartbeat/Producer loops. Always inject STMM and Lifetime Memory as trailing `groundingMessages` via `buildShortTermMemoryContext()` and `buildLifetimeMemoryContext()`.
- **Volatile data ahead of the prefix**: Cache alignment is positional: any byte that changes before a stable segment invalidates the cache from that point on. Keep the static system prompt first; push volatile telemetry/sensor payloads and history slices to the tail. Append volatile items AFTER the static prefix or history, never interleaved.
- **Premature System Message Merging**: DeepSeek, OpenAI, and OpenRouter support multiple `role: 'system'` blocks natively. Keep trailing grounding messages as separate system blocks rather than merging them into `messages[0]`.
- **Citing the non-existent settings store**: `useSettingsLlmPerformance` / `llm-performance.ts` is design intent in the proposal, not a real file. Implement against the actual assembly surface (`session-store.ts` & `chat.ts`).
- **Director role is special**: `proposal-director-cache-alignment-analysis.md` flags character-mode leakage and a visual-scratchpad invalidation loop; do not blindly apply prefix caching there — review its proposed system-prompt prefix-caching alternative instead.

### Authoritative Design & Architecture Documents

- [docs/proposal-prefix-cache-alignment.md](docs/proposal-prefix-cache-alignment.md) — Prefix-cache alignment architectural spec.
- [docs/proposal-director-cache-alignment-analysis.md](docs/proposal-director-cache-alignment-analysis.md) — Director cache alignment risk analysis (do not force-fit).
- [docs/design-token-usage-metrics.md](docs/design-token-usage-metrics.md) — Token usage metrics.
- [docs/journal-the-reasoning-content-bug.md](docs/journal-the-reasoning-content-bug.md) — Reasoning-content bug journal (related prompt pipeline issue).

## Verification

- Run `node scripts/validate-prefix-cache.js [payloadA.json] [payloadB.json]` to inspect exact character/token overlap and diagnose cache boundaries across turns.
- Confirm the static/system prefix occupies the head of the composed message list and every volatile segment is appended at the tail.
- Validate cache-hit behavior empirically against the target provider (compare latency/token-cost before vs. after an alignment change).
- Logic changes to `session-store.ts`, `chat.ts`, or related `.ts`: run `pnpm -F <workspace> typecheck` per `AGENTS.md`, then run `git status` and report open/unstaged files.

## Related Skills & References

- **Key Documents**: [[proposal-prefix-cache-alignment]], [[proposal-director-cache-alignment-analysis]], [[design-token-usage-metrics]], [[journal-the-reasoning-content-bug]], [[AGENTS]]
