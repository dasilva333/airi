# Proposal: RWKV Salience Gate → Chat UI Integration (Toggle 4 Surface)

**Status:** UI Concept Proposal (research handoff — no application code written yet)
**Authors:** AIRI Team & AI Assistant
**Empirical basis:** commit `3e17a8c60` (Phase 4b), reports under `scripts/tests/rwkv-harness/reports/`
**Related Docs:**
- [`proposal-toggle4-rework-and-rwkv-harness.md`](./proposal-toggle4-rework-and-rwkv-harness.md) — Toggle 4 spec & Avenue 3 (hidden-state delta)
- [`proposal-dynamic-memory-rag-injection.md`](./proposal-dynamic-memory-rag-injection.md) — Grounding popover & injection pipeline
- [`proposal-introspective-context-injection.md`](./proposal-introspective-context-injection.md) — Dream/Journal intrusion channels
- [`project-rwkv-kimi.md`](./project-rwkv-kimi.md) — measured Phase 3/4/4b results

---

## 1. What the Experiment Proved (and Why the UI Should Reflect It)

Phase 4b showed a **recurrent-state salience signal** inside the 0.1B RWKV model's late layers. We measure per-turn hidden-state vector deltas (`Δh = h_t − h_{t−1}`) over L9–L11 (the last three layers of the 12-layer, 608,256-float state).

Two key findings from the measured sweep (report `04-toggle4-vote-sweep-…`):

1. **It is a salience sensor, not a topic sensor.** In "topic-shift" mode (4 boundaries) we achieved Recall 1.00 but only Precision 0.40 (FPR 0.40): the state also spikes on emotionally charged in-topic turns (affection, awe, physical beats). When we re-annotated those as *salience* positives, `vote-2of3 @ 1.5×` reached **Recall 0.818, Precision 0.90, F1 0.857, FPR 0.125** (i.e. 1-of-8 in-topic noisy flag rate).
2. **The gate is cheap and already computable in-page.** The production WebGPU worker already exposes `session.back(state)` to read the full recurrent vector — no new inference pass is needed, just a per-turn diff against the previous snapshot.

Implication for UI: surface it as **`SALIENCE`**, an *intensity/vibe* indicator — not a "topic changed" badge (geometry doesn't support that claim on 0.1B) and not a threat tag. This pairs with the roadmap decision that Echo Chips offline synthesis is gated by salience windows rather than the tiny model writing tags itself (Phase 3 showed 0/14 GT structured-tag match with generation off).

## 2. UI Staging: from noisy numbers to an amber pill

Three integration points, in order of UX visibility:

1. **Pre-Flight Grounding header bar** (always visible above the chat input):
   adds a fifth status badge beside *Sensors Active / Grounded Memories / Recent Topics / Visual Scene Active*.
2. **`Context Injections` popover** (`ChatGroundingPopover.vue` / `chat.vue` panel):
   a new toggle row to enable/disable salience reporting, mirroring existing toggles.
3. **Collapsible "Salience ∨" drawer** in the grounding panel:
   a tiny intensity history readout for the last N turns.

---

## 3. Component Mapping — where each piece lands

### 3.1 Header Badge — `PRE-FLIGHT GROUNDING ACTIVE` bar

File: `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` (header/control bar region ≈ lines 1082–1128).

Existing pattern (line 1091):
```vue
<span v-if="activeCard?.extensions?.airi?.groundingTopicsEnabled && activeCard?.extensions?.airi?.recentTopics?.length"
  class="border border-amber-300 rounded bg-amber-100/50 …"
>
Recent Topics ({{ … }})
</span>
```

Proposed sibling badge (same glass-dark token set), driven by a new store:
```vue
<span
  v-if="salience.enabled && salience.hot"
  class="border border-amber-300 rounded bg-amber-100/50 px-1.5 py-0.2 text-[8px]
         text-amber-800 font-bold font-mono dark:border-amber-500/25 dark:bg-black/30 dark:text-amber-400"
  title="avg Δcos L9–L11 = 0.243 (last turn vs prev)"
>
Salience +Δ
</span>
```

Rule for `hot` (maps the harness vote to UI): *≥2 of 3 late layers exceed `1.5 × control-mean` for the current turn*; badge shows only on trigger to stay attention-cheap.

### 3.2 Toggle — `Context Injections` popover

File: `apps/stage-tamagotchi/src/renderer/pages/chat.vue` (toggle block ≈ lines 804–915) and its sibling `packages/stage-ui/src/components/scenarios/chat/ChatGroundingPopover.vue` (toggle list ≈ lines 99–224).

New row after "Recent Topics", matching the existing icon+switch idiom:
- Label: **Salience Gating (RWKV 0.1B)**
- Subcaption: "Flag high-intensity turns for grounding/journal"
- Store flag: `activeCard.extensions.airi.salienceGateEnabled` (boolean, default **on** but unobtrusive since it only lights the pill).

The switch relies on the same toggle wiring as `groundingTopicsEnabled` (see `handleToggleGroundingTopics`); store toggle goes into the `airi-card` extension store module.

### 3.3 Drawer — collapsible Salience readout

File: `InteractiveArea.vue`, directly under the grounding panel header (mirrors `isTopicsPreviewExpanded` drawer around line 1167).

Mock draw content (fixed-height ~4.5rem sparkline):
```
Δh/t (L9–L11 cos): ▁▁▂∙▅█▅▂▁▁▁▂▃▅▇▂▁▁▁
turns:  -12  -9  -6  -3   now   thr=1.5×floor
```

Drawer hides when `salience.enabled=false`; same expand/collapse button pattern.

## 4. Data contract between engine and UI

New store `packages/stage-ui/src/stores/chat/salience.ts`:

| API | Type | Shape |
| --- | --- | --- |
| `probeTurn(text)` | Promise<void> | runs WebGPU session → back(state) → diff against prior → returns `{ dCos9..11, hot }` |
| `hot` | computed | `votes >= 2` (layers passing `1.5×` control threshold) |
| `history` | ref | circular buffer of last 24 `{ turnIndex, lateMean, hot }` |
| `enabled` → persisted | `salienceGateEnabled` per-card extension field |

This matches the measured rule exactly (no translation-layer bugs) and keeps GPU work in the worker, with only tiny scalars crossing the bridge — the same constraint we proved in the Phase-4b bridge (state vector is 608k floats ≈ 2.4 MB, so CDP returns only the three per-layer deltas + verdict).

## 5. Why this is safe to add — and what it cannot be

- **Not** a topic-change detector (FPR on that framing was 0.40) and **not** an Echo-Chips generator (0/14 — Phase 3 dead-end).
- **Is** a low-noise "something just happened" beacon with ~0.13 FPR at the chosen operating point; UI copy should say exactly that ("marks turn as notable/salient") to avoid over-promising.
- Fails closed: if the RWKV worker isn't loaded (no local model configured), the badge simply never illuminates — no baseline cost.

## 6. Calibration & rollout

1. Persist `controlPerLayerMean` per card from the CONTROL phase; recompute on card switch or session start.
2. Fixed multiplier `1.5` is the measured sweet spot; expose it under *Advanced* in settings but default-hide.
3. If FP creep appears (roleplay-heavy sessions), adopt `vote-all3` (measured FPR 0.13 → even fewer hits at same recall on salience metric) as the strict mode.

## 7. Verification hook for the UI phase

Reuse the proven harness: `04-toggle4-realtime.ts` stands as the acceptance test — when wiring lands, re-run `pnpm test:topics-realtime`; UI flag may replay store triggers but must not change the underlying numeric verdicts.

## Relevant Skills

- [[airi-attention-ecology-vision]]
