---
name: airi-jev-decision-engine
description: >-
  Implement/debug TypeSafe Jev System-1 fast decision routing, non-autoregressive
  discrete classification (choice, score, noul), OpenRouter decisions dispatch,
  on-device Laya & OpenJev local inference, and coprocessor integrations across
  vision gates, AnimaDex voice matching, streaming expressions, arcade gaming,
  and memory token compaction.
---

# TypeSafe Jev System-1 Decision Engine

Own fast, typed, non-autoregressive discrete decisions, zero-shot question triage, and batched classification (~100–150ms, $42/Btok). Autoregressive dialogue generation belongs to the primary LLM and [prompt builder engine](../airi-prompt-builder-engine/SKILL.md); avatar blendshapes and Live2D/VRM physical rendering belong to [character rendering](../airi-character-rendering/SKILL.md) and [acting tokens](../airi-acting-cue-act-tokens/SKILL.md); audio playback belongs to [speech runtime](../airi-speech-runtime/SKILL.md); continuous frame sampling belongs to [attention ecology vision](../airi-attention-ecology-vision/SKILL.md); character card synthesis belongs to [animadex wizard](../airi-animadex-wizard/SKILL.md).

## Source map

Paths are repository-relative. Read the relevant implementation before changing policy.

| Responsibility | Source and anchor |
| --- | --- |
| System 1 Coprocessor Settings | `packages/stage-pages/src/pages/settings/modules/system-one.vue` — `#/settings/modules/system-one` (5-provider grid, model selector, telemetry & latency strip, interactive playground) |
| System 1 Providers Hub | `packages/stage-pages/src/pages/settings/providers/index.vue` (`#/settings/providers#system1`) & `system1/[providerId].vue` (credential configuration) |
| System 1 Pinia Store | `packages/stage-ui/src/stores/modules/system-one.ts` — `useSystemOneStore`, `execute()`, `runTriage()`, `runRerank()` |
| Store Test Suite | `packages/stage-ui/src/stores/modules/system-one.test.ts` — CI-blocking mock Decisions API tests |
| Provider Interface | `packages/stage-ui/src/libs/providers/types.ts` — `System1Provider`, `System1Response` |
| OpenCode Go Provider | `packages/stage-ui/src/libs/providers/providers/opencode-go/index.ts` — `systemOne()`, `/zen/v1/systemone`, `jev-1.13-free`, `jev-1.13` |
| OpenRouter Provider | `packages/stage-ui/src/libs/providers/providers/openrouter-ai/index.ts` — `systemOne()`, `/api/alpha/decisions`, `typesafe/jev-1.13` |
| Direct TypeSafe AI Provider | `packages/stage-ui/src/libs/providers/providers/typesafe-ai/index.ts` — `systemOne()`, `/v1/systemone` |
| Local Laya Provider | `packages/stage-ui/src/libs/providers/providers/laya-local/index.ts` — on-device WebGPU/WASM ModernBERT-large (421M) |
| Local OpenJev Provider | `packages/stage-ui/src/libs/providers/providers/openjev-local/index.ts` — on-device WebGPU/WASM ModernBERT-base (151M, rlcd) |
| Vision Orchestrator Gate | `packages/stage-ui/src/stores/modules/vision/orchestrator.ts` — `processCapture()`, `evaluateJevVisualAttentionGate()` |
| Vision Store & Settings | `packages/stage-ui/src/stores/modules/vision.ts` — `useVisionStore` (`settings/vision/programmable-gate-question`) |
| AnimaDex Voice Matching | `packages/stage-pages/src/pages/settings/airi-card/guided.vue` — `prefillRosterBindings()`, `autoMatchCharacterVoiceWithJev()` |
| AnimaDex Wizard Store | `packages/stage-ui/src/stores/animadex-wizard.ts` — `useAnimaDexWizardStore`, `boundVoices` |
| Speech Runtime Store | `packages/stage-ui/src/stores/modules/speech.ts` — `useSpeechStore`, `availableVoices`, `savedVoiceProfiles` |
| Arcade Agent Co-Pilot | `packages/stage-ui/src/composables/arcade/use-arcade-agent.ts` & `packages/stage-ui/src/pages/chat_arcade.vue` |
| Virtual Workstation CLI & Shims | `packages/stage-ui/src/libs/sandbox/jev.ts` — `jev` CLI, `require('jev')`, native MCP tools. See [airi-sandbox-virtual-workstation](../airi-sandbox-virtual-workstation/SKILL.md) |
| Lifetime Artifact Curation (Pillar 5) | `packages/stage-ui/src/stores/memory-lifetime.ts` — `applyIncrementalUpdate()`, `applySurgicalSectionLock()`, `buildDayTranscriptWithWinnow()`; `packages/stage-ui/src/stores/modules/system-one.ts` — `JEV_LIFETIME_DAY_GATE_SCHEMA`, `runLifetimeDayGate()`, `runWinnowTurnCompaction()`; design in `docs/design-jev-powered-eternal-thread.md` |
| Widget Iframe MCP Dispatcher | `packages/stage-ui/src/libs/sandbox/mcp-bridge.ts` — `executeUniversalMcpTool()`, `handleWidgetMcpMessage()`. See [airi-generative-widgets](../airi-generative-widgets/SKILL.md) |
| Canonical Architecture RFC | `docs/proposal-jev-integration.md` — Complete multi-domain specification and shootout traces |

## Contracts to preserve

1. **OpenRouter Decisions Compatibility**:
   - OpenRouter's decisions endpoint (`POST https://openrouter.ai/api/alpha/decisions`) requires `"type": "noul"` for probability queries. Supplying `"type": "boolean"` causes an immediate HTTP 400 Bad Request.
   - Categorical questions must use `"type": "choice"` with explicit candidate string options.
2. **OpenCode Go Coprocessor Integration**:
   - Dedicated endpoint is `POST https://opencode.ai/zen/v1/systemone` (distinct from chat base URL `/zen/go/v1/`).
   - Supports `jev-1.13-free` (free tier) and `jev-1.13` (paid/standard tier).
   - Automatically forwards session identification via `x-opencode-session` header and normalizes model names (stripping any foreign `typesafe/` prefix).
3. **Five-Provider System 1 Surface Parity**:
   - Both `#/settings/modules/system-one` and `#/settings/providers#system1` maintain parity across the five supported backends: `openrouter-ai`, `typesafe-ai`, `laya-local`, `openjev-local`, and `opencode-go`.
4. **Universal Consumer Gate**:
   - Always check `systemOneStore.configured` before executing queries. If false, degrade gracefully to local regex, keyword heuristics, or baseline defaults without throwing unhandled exceptions.
5. **Telemetry & Latency Observability**:
   - Every `systemOneStore.execute()` call records round-trip latency (`lastLatencyMs`), increments `systemOneDecisionsCount`, and separates `systemOneCloudTokens` from `systemOneLocalTokens`.
6. **Distractor Attractor Baselines**:
   - For nuanced pragmatics, sarcasm, or negative actions, always provide explicit negative attractor options (e.g. `refused_or_negated_roast`, `routine_correction`, `fictional_framing`). This absorbs false-positive spillover and yields 100% precision.
7. **Decoupled Actuation**:
   - Jev evaluates decisions; actuators execute them. Jev does not render Live2D blendshapes, synthesize TTS waveforms, or press gamepad buttons directly. Keep decision state strictly separated from renderer buffers.
8. **Batching Efficiency**:
   - Jev evaluates multiple questions in parallel across internal classification heads within a single model forward pass (~100–150ms). Bundle related questions (e.g. voice match + pitch + speed) into a single `execute(state, questions)` call rather than sequential requests.

## Integration Recipes

### 1. Programmable Visual Attention Gate (Domain C)
In `packages/stage-ui/src/stores/modules/vision/orchestrator.ts`, evaluate changed screen crops:
```typescript
import { useSystemOneStore } from '../system-one'
import { useVisionStore } from '../vision'

export async function evaluateJevVisualAttentionGate(visualDescriptor: string) {
  const systemOneStore = useSystemOneStore()
  const visionStore = useVisionStore()

  if (!systemOneStore.configured)
    return { shouldPromote: false }

  const question = visionStore.programmableGateQuestion?.trim()
    || 'Did a notable, unexpected, or socially meaningful event occur that warrants companion proactive dialogue?'

  const res = await systemOneStore.execute(
    `Current Screen Observation: "${visualDescriptor}"`,
    { gate_decision: { type: 'noul', instructions: question } },
  )

  const prob = res.answers?.gate_decision?.noul ?? 0.0
  return { shouldPromote: prob >= 0.75, confidence: prob }
}
```

### 2. AnimaDex Fast Voice Matching & Pitch Tuning (Domain E)
In `packages/stage-pages/src/pages/settings/airi-card/guided.vue`, match character tuples during Step 1 $\rightarrow$ Step 2 transition:
```typescript
import { useAnimaDexWizardStore, useSpeechStore, useSystemOneStore } from '@proj-airi/stage-ui/stores'

export async function autoMatchCharacterVoiceWithJev(character: CharacterItem) {
  const wizardStore = useAnimaDexWizardStore()
  const speechStore = useSpeechStore()
  const systemOneStore = useSystemOneStore()

  if (wizardStore.boundVoices[character.id] || !systemOneStore.configured)
    return

  const candidatePool = Object.entries(speechStore.availableVoices)
    .flatMap(([provider, voices]) => voices.slice(0, 10).map(v => ({
      id: `${provider}::${v.id}`,
      provider,
      voiceId: v.id,
      name: v.name,
      desc: v.description || `${v.gender || 'neutral'} voice`,
    })))

  if (candidatePool.length === 0)
    return

  const res = await systemOneStore.execute(
    { character: { name: character.name, tags: character.tags }, candidatePool },
    {
      matched_voice: {
        type: 'choice',
        instructions: `Which voice best matches character '${character.name}' (${character.tags})?`,
        criteria: Object.fromEntries(candidatePool.map(c => [c.id, `${c.name}: ${c.desc}`])),
      },
      pitch_offset: {
        type: 'choice',
        instructions: 'Select the semitone pitch shift for this character build.',
        criteria: { '-4': 'Deep', '-2': 'Low', '0': 'Normal', '+2': 'Lighter', '+4': 'High' },
      },
      speed_rate: {
        type: 'score',
        instructions: 'Score delivery speed multiplier (0.85 to 1.25).',
        min: 0.85,
        max: 1.25,
      },
    },
  )

  const matched = candidatePool.find(c => c.id === res.answers?.matched_voice?.choice) || candidatePool[0]
  wizardStore.bindVoiceToCharacter(character.id, {
    baseProvider: matched.provider,
    baseModel: '',
    baseVoice: matched.voiceId,
  })
}
```

### 3. Lifetime Artifact Curation — Day-Gate, Surgical Lock & Winnow (Pillar 5)
In `packages/stage-ui/src/stores/memory-lifetime.ts`, `applyIncrementalUpdate()` routes every completed day through System 1 before spending System-2 tokens. Why: System 2 is biased toward inventing tweaks on routine days and drifts phrasing when re-emitting ~45 bullets to add one — Jev decides *whether* and *where* change happened in ~120ms, System 2 only writes unlocked prose.
```typescript
import { useSystemOneStore } from './modules/system-one'

const gate = await systemOneStore.runLifetimeDayGate({ characterName, day, currentPack, transcript })
// gate.triggeredSections: LifetimePackSection[]; gate.shouldInvokeSystem2: boolean
```
- Schemas live in `packages/stage-ui/src/stores/modules/system-one.ts`: `JEV_LIFETIME_DAY_GATE_SCHEMA` (6 parallel `choice` heads, one per `DistilledPack` section, over distractor basins in `JEV_LIFETIME_SECTION_CRITERIA`) and `JEV_WINNOW_TURN_CRITERIA` (`choice` + `score` over 4-turn exchange windows). Verdict math is pure in `evaluateLifetimeDayGateAnswers()` (0.60 conviction floor: top-choice conviction or summed `durable_new_addition` + `updates_existing_bullet` probability) — unit-test it without a provider.
- Fast-exit: `shouldInvokeSystem2 === false` → advance `lastConsumedDay`, record `changed: false`, zero LLM calls. If the gate throws (jitter/rate-limit/malformed), fall back to the full System-2 merge — never fail the day.
- Surgical lock: pass `gate.triggeredSections` into the `callJsonMode` system extras (`SYSTEM-1 AUDIT LOCK`) AND through `applySurgicalSectionLock(currentPack, candidate, unlocked)` (`memory-lifetime.ts`), which freezes un-triggered sections byte-identical even when System 2 rewrites them; the `<70%` contraction guard and true-diff check then measure the *locked* candidate.
- Winnow: `buildDayTranscriptWithWinnow()` compacts >24k-char days via `runWinnowTurnCompaction()` (prunes `routine_chitchat_or_filler` below 0.40 retention, 8-window batches for Laya buffer limits), falling back to the 40%/60% head/tail slice when every window is filler or on error; LTMM journal entries are always preserved in full.
- Invariants: gate only when `systemOneStore.configured` (default-off keeps the hardened System-2 baseline — and its test suite — exercising the real path); keep System-2 provider resolution eager so a broken `consciousness` config fails fast via `incrementalError` instead of silently sealing watermarks on fast-exit days.
- Verify: `pnpm -F @proj-airi/stage-ui typecheck`; vitest `memory-lifetime.test.ts` (gate/lock pure tests) + `memory-lifetime.incremental.test.ts` (fast-exit, surgical-lock, gate-throw fallback).

## Source versus proposal

Read `docs/proposal-jev-integration.md` for architecture RFC, OpenRouter alpha endpoints, and full 43-case cleanroom shootouts. Read `docs/design-openjev-system1-local-integration.md` for OpenJev (151M) on-device WebGPU/WASM integration, benchmarks, and cache architecture. Read `docs/design-subconscious-system1-inference-providers.md` for LoCoMo memory benchmarking. Read `docs/design-jev-powered-eternal-thread.md` for the Pillar 5 day-gate / surgical-lock / Winnow architecture. The proposal documents experimental and planned subsystem avenues; `packages/stage-ui/src/stores/modules/system-one.ts` contains the working, production-tested Pinia implementation.

## Verification

- Run the store test suite:
  ```bash
  pnpm -F @proj-airi/stage-ui test packages/stage-ui/src/stores/modules/system-one.test.ts
  ```
- Typecheck affected surfaces:
  ```bash
  pnpm -F @proj-airi/stage-ui typecheck
  pnpm -F @proj-airi/stage-pages typecheck
  ```
- Run cleanroom benchmarks (read-only):
  ```bash
  python3 scripts/tests/rwkv-harness/experiments/jev-nan0-pragmatic-benchmark.py
  ```
