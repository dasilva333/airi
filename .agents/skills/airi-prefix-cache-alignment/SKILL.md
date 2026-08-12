---
name: airi-prefix-cache-alignment
description: >-
  Use when working with AIRI LLM prefix-cache alignment, prompt-compilation optimization, or KV prefix-cache layout geometry for DeepSeek/OpenRouter/Gemini. Trigger on keeping static prefix segments ahead of volatile segments, protecting cache alignment across automated sub-loops (proactivity heartbeat, Destiny 2 OCR, producer/journal), reducing token cost/latency, or validating cache-hit behavior in the chat session store.
---

Stable prefix first, volatile tail last. The whole point is layout geometry: keep the immutable system-prompt prefix ahead of volatile telemetry/history slices so providers re-use KV prefix cache instead of re-tokenizing on every automated sub-loop. Never cite `crates/` (legacy Tauri; current desktop is Electron `apps/stage-tamagotchi/`).

## Key Files/Locations

- `packages/stage-ui/src/stores/chat/session-store.ts` — the real prompt-assembly surface (`refreshActiveSystemMessage()` enrichment layer). Edit/verify here.
- `docs/proposal-prefix-cache-alignment.md` — the architectural spec (context profiles, `useContextBuilder`/`compileCacheAlignedPrompt`, per-subsystem integration).
- `docs/proposal-director-cache-alignment-analysis.md` — the risk analysis for force-fitting caching onto the Director role.
- **Do NOT cite `packages/stage-ui/src/stores/settings/llm-performance.ts`.** That store does not exist in the tree; it only appears as an aspirational schema/panel in `proposal-prefix-cache-alignment.md` §3. Treat it as not-yet-implemented design intent, never as a real path.

## When to Use

- Re-ordering or restructuring LLM prompt segments.
- Wiring a new automated subsystem (proactivity heartbeat, Destiny 2 OCR loop, Producer Lite reply suggestions, Journal Moments) into cache-aligned assembly.
- Chasing latency or repeated-token cost in sub-loops that re-send a large stable prefix.
- Targeting prefix-cache-aware providers (DeepSeek, OpenRouter, Gemini).

## Common Pitfalls

- **Volatile data ahead of the prefix.** Cache alignment is positional: any byte that changes before a stable segment invalidates the cache from that point on. Keep the static system prompt first; push volatile telemetry/sensor payloads and history slices to the tail. Append volatile items AFTER the static prefix or history, never interleaved.
- **Citing the non-existent settings store.** `useSettingsLlmPerformance` / `llm-performance.ts` is design intent in the proposal, not a real file. Implement against the actual assembly surface (`session-store.ts`) and treat the settings-store schema as future work.
- **Different alignment per provider, assumed identical.** DeepSeek/OpenRouter/Gemini handle KV prefix caching differently; do not assume one layout is optimal for all.
- **Re-sending full history by default in automated loops.** The design offers `historyMode: 'full' | 'slice'` + `sliceCount` so automated sub-loops can send a sliced history (e.g. last N turns) to save output tokens — but this trades off character context memory.
- **Director role is special.** `proposal-director-cache-alignment-analysis.md` flags character-mode leakage and a visual-scratchpad invalidation loop; do not blindly apply prefix caching there — review its proposed system-prompt prefix-caching alternative instead.


### Authoritative Design & Architecture Documents

- [docs/proposal-prefix-cache-alignment.md](docs/proposal-prefix-cache-alignment.md) — Prefix-cache alignment architectural spec.
- [docs/proposal-director-cache-alignment-analysis.md](docs/proposal-director-cache-alignment-analysis.md) — Director cache alignment risk analysis (do not force-fit).
- [docs/token-usage-metrics.md](docs/token-usage-metrics.md) — Token usage metrics.
- [docs/journal-the-reasoning-content-bug.md](docs/journal-the-reasoning-content-bug.md) — Reasoning-content bug journal (related prompt pipeline issue).

## Verification

- Confirm the static/system prefix occupies the head of the composed message list and every volatile segment is appended at the tail.
- Validate cache-hit behavior empirically against the target provider (compare latency/token-cost before vs. after an alignment change) — do not assume a layout change hits cache without measurement.
- Logic changes to `session-store.ts` or related `.ts`: run `pnpm -F <workspace> typecheck` per `AGENTS.md`, then run `git status` and report open/unstaged files.
