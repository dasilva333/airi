---
name: airi-acting-cue-act-tokens
description: >-
  Implement/debug ACT emotion and motion cues, ACTOR routing, DELAY pauses, acting prompts, marker parsing, rawContent/content preservation, avatar cue dispatch. Includes Acting tab and Rehearsal Room; model mappings use airi-model-customizer.
---

# AIRI ACT Token System — The Acting Cue Keystone

The ACT token is the annotation link between LLM output and the avatar's body. The model emits `<|ACT ... |>` markers inline in its reply; the chat pipeline parses them out of the speech stream (they never reach TTS), persists them in the raw message record, and executes them as expressions/motions/pauses/actor-switches on whichever renderer is on stage. The Model Customizer exists in large part to give these cues something concrete to drive (expression parameters, motion mappings per VRM/Live2D).

## 1. The Token Family

### Official ACT formats (two)

| Format | Shape | Where it is taught |
| --- | --- | --- |
| **Short Format (official)** | `<|ACT:emotion="expression_name"|>` and `<|ACT:motion="action_cue"|>` | `FieldAiGeneratorModal.vue` actingModelExpression default template (:~152-164); Rehearsal Room presets (:442-449 also emit the mixed `emotion="..",motion=".."` combined form) |
| **JSON Chaining Format** | `<|ACT:{"emotion":{"name":"expression_name","intensity":1},"motion":"action_cue"}|>` | `character-defaults.ts` `DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT` (:5); Field AI Generator `json` template |

The marker parser does not interpret payload syntax — it only splits `<| ... |>` spans. Payload interpretation (emotion name/intensity, motion cue) happens downstream in the cue-execution chain (§4). Both formats coexist deliberately; cards may teach either or both.

### Sibling action tokens

- `<|DELAY:{seconds}|>` — timed pause before continuing (taught in the default ACT instruction, `character-defaults.ts` :13-14).
- `<|ACTOR:{actorId}|>` — multi-actor routing: emitted (e.g. prepended by the Rehearsal Room at :292) to route the turn to a specific concept/actor; detected via `isMultiActor` probe and the `ACTOR` branch of the host marker regex.

### Hidden / tolerated formats (parser leniency — the "special spot")

`packages/stage-ui/src/composables/llm-marker-parser.ts`:

- **Legacy bare-`>` close** — `findLegacyCloseTagIndex()` (:91-109) accepts a plain `>` as the closing tag **only when the buffer starts with `<|ACT`, `<|DELAY`, or `<|LLM_`**. This whitelist exists because older card prompts taught some models to close these tokens with `>` instead of `|>`. No other tag family gets this tolerance — any other `<` in prose stays literal text.
- **Curly close normalization** — `normalizeSpecialToken()` (:79-89) rewrites a trailing `|}` to `|>` before emitting.
- **Escape sequences** — `<{'|'}'` and `{'|'}>` literals are converted back to `<|` / `|>` during consume (:114-116), so prompt/UI text can display the delimiters without triggering the parser.

Correspondingly, `stripMarkers()` in `response-categoriser.ts` (:143-149) removes both proper `<|...|>` and the legacy `<|(?:ACT|DELAY|llm_...)...>` bare-close forms, with a NOTICE documenting the historical reason.

**Rule**: parser tolerance and `stripMarkers` must stay in lockstep. Widening one without the other either leaks raw tokens into TTS/chat display or silently drops cues.

## 2. The Teaching Layer (how the model learns to emit them)

Order of precedence in the assembled system prompt:

1. **Character-level defaults** — `packages/stage-ui/src/constants/prompts/character-defaults.ts`: `DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT` (:1-17, the JSON Chaining example plus the canonical expressions list happy/sad/angry/surprised/think/awkward/question/curious/neutral/cool, DELAY macros, Kinetic Manifestation guidance), `DEFAULT_ACTING_SPEECH_EXPRESSION_PROMPT` (TTS speech tags — a separate, sibling system: `[whisper]`/`*sigh*`-style tags, NOT ACT tokens), `DEFAULT_ACTING_SPEECH_MANNERISM_PROMPT`.
2. **Card-level `acting` extension** — `card.schema.ts:148-153`: `modelExpressionPrompt`, `speechExpressionPrompt`, `speechMannerismPrompt`, `idleAnimations[]`. These are pushed verbatim into the system prompt by `airi-card.ts` (:1372-1384, guarded non-empty check).
3. **User authoring surfaces**:
   - **Acting tab** — `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabActing.vue` edits the three acting prompt fields per card.
   - **Field AI Generator** — `FieldAiGeneratorModal.vue` actingModelExpression section: AI-drafted acting instructions with the two official format templates; speech-expression section offers square-bracket / asterisk / Dynamic Caption FX / Mood-Tag TTS variants (again: sibling TTS systems, not ACT).

The canonical expression names in the teaching text must match what the Model Customizer mappings can resolve (§4) — mismatched names no-op silently.

## 3. The Storage Contract (the two keys)

`ChatAssistantMessage` (`packages/stage-ui/src/types/chat.ts` :25-48) carries both forms:

- `content` — display-friendly, ACT/ACTOR/DELAY markers stripped.
- `rawContent` — the full untouched LLM output **with** markers and reasoning, persisted at turn end (`chat.ts:1648-1656`).

When history is replayed as inference context, `chat.ts` prefers `rawContent || content` (:1113-1117) with an explicit NOTICE: feeding stripped history back makes the model "forget" to use ACT/ACTOR/DELAY tokens — the #1 behavioral-drift failure mode for this system. Display paths (chat UI sync, Discord outbound) go through `stripMarkers` instead (e.g. session-store sync building, `discord.ts` outbound in `airi-discord-integration`).

**Rules**: never strip tokens from `rawContent`; never send `content` (stripped) where inference expects `rawContent`.

## 4. The Cue Execution Chain

1. **Marker parser** — `useLlmmarkerParser` (`llm-marker-parser.ts:248`) streams `onLiteral` / `onSpecial` out of the LLM delta stream; the chat orchestrator feeds every turn through it (see [streaming and hooks](../airi-interaction-pipelines/references/streaming-hooks.md) for the marker-parser-before-TTS rule).
2. **Categorization** — `response-categoriser.ts` `createStreamingCategorizer` splits speech vs reasoning; markers are excluded from the speech category so TTS never speaks them.
3. **Chat hooks** — token events flow through the module-level hooks bus ([streaming and hooks](../airi-interaction-pipelines/references/streaming-hooks.md)); the Stage-side speech pipeline's `onTokenSpecial` hook is the canonical consumer for locally streamed messages (see the mods-server NOTICE below).
4. **Host dispatch** — `ControlStripHost.vue`: `processMarkers()` (:414-421) regexes `<\|(?:ACT|DELAY|ACTOR)...(?:\|>|>)` and enqueues via `playSpecialToken` (:407-410) into the special-token queue (`useSpecialTokenQueue`, :387-395) with `emotion` / `delay` / `actor` handler events.
5. **Renderer execution** — the emotion/actor handlers trigger `vrmStore.triggerEmotion/triggerMotion` and `live2dStore.triggerEmotion/triggerMotion` (:~240-320), falling back through expression mappings → emotion-motion name map → motionMappings ground-truth lookup. Those mappings are authored in the Model Customizer (`airi-model-customizer`) — that is the sense in which the customizer "is built to support" ACT tokens. The host also synthesizes its own cue for caption/emotion display (`processMarkers(<|ACT:{"emotion":"..."}|>)`, :465).
6. **Stage-local TTS enforcement** — the cue tokens are skipped by the STT/speech lane; caption displays the line (speech category only).

**Double-execution trap** (NOTICE at :~421-430): externally injected messages (mods-server/context bridge) re-run `processMarkers`, but local chatOrchestrator messages were **already** processed token-by-token through the speech pipeline's `onTokenSpecial`. The `stage-tamagotchi` / `stage-web` message flags exist solely to prevent every ACT/DELAY/ACTOR token executing twice.

## 5. Facets Map

| Facet | Where | Status |
| --- | --- | --- |
| ACT instruction authoring | Acting tab + Field AI Generator (actingModelExpression) | live |
| Playground / preset emission | Rehearsal Room `chat_rehearsal.vue` (presets :361-367, mixed :442-449, ACTOR prepend :292, strip preview :319) | live |
| Execution + renderer mapping | `ControlStripHost.vue` queue dispatch; Model Customizer mappings | live |
| Storage twin keys | `rawContent` / `content` (§3) | live |
| Discord outbound | `stripMarkers` on reply; tool-slice rendering via `formatToolSlices` (see `airi-tool-registry-builtin-tools` §5) | live |
| Onboarding V2 **Advanced-Lab acting step** | planned step under `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/` (wire via `gate.ts` contract + `draft-store.ts` draft-store isolation; see `airi-onboarding-v2`) | **planned** — a new wizard step exposing ACT/expressions configuration; keep its output validated against the parser whitelist before insertion |

## 6. Common Pitfalls

1. **Raw-history drift** — stripping tokens from replayed `rawContent` (or migrating records that lost it) makes the model silently stop emitting cues. See §3.
2. **Legacy-close mismatch** — parser whitelist and `stripMarkers` must move together (§1).
3. **Double-execution** — re-processing a full message broadcast that the streaming pipeline already tokenized (§4 step 6 NOTICE).
4. **Expression-name drift** — teaching text and Customizer mapping namespaces must agree; mismatches no-op with no error.
5. **Format mixing with TTS tags** — square-bracket speech tags / mood tags / Dynamic Caption FX are sibling TTS systems authored in the same Acting tab; do not confuse them with ACT marker syntax.
6. **Gemini Live mode** — native-PCM output suppresses text-literal forwarding (`_geminiLiteralHandled`); ACT cues typed mid-call may never reach the host TTS/cue chain. See `airi-gemini-live-api`.

## 7. Verification

- `pnpm -F @proj-airi/stage-ui typecheck` for parser/categorizer/schema changes.
- Manual: chat a line → confirm `<|ACT:...|>`/`<|DELAY:...|>` never appear in rendered chat or TTS audio, DO fire an expression/motion on stage, and `rawContent` retains them (DevTools → IndexedDB).
- Rehearsal Room: run one preset (single ACT, mixed, ACTOR) and confirm each cue fires.
- Discord: confirm outbound replies contain no markers but tool-call rendering is intact.

## Studio ownership and zero-token behavior

Read `docs/content/en/docs/manual/config/studio.md` before changing actor authoring. Its three setups assign ownership differently:

| Setup | Model switching | Scene/background |
| --- | --- | --- |
| A: coexisting Layer actors, place Base | ACTOR at playback | Director |
| B: Base outfits, no ACTOR | Director applies Base model | Director |
| C: mutually exclusive Base personalities, Director off | ACTOR | Concept's pinned background |

ACTOR is optional. A generic single-character card or Setup B must render and speak without actor tags. Keep roster/identity instructions in the system prompt and exact emotion/motion vocabulary in Acting Model Expression Prompt. Studio expression variants act as persistent concept setters; they are not necessarily one-frame cosmetic effects. Verify persistence when changing expression handling.

Keep parser actor identity separate from playback actor identity. Resolve upcoming voice configuration without activating that actor early; activate the model when its queued ACTOR item plays. See [Director orchestration](../airi-director-orchestration/SKILL.md) for Base/Layer resolution and [speech runtime](../airi-speech-runtime/SKILL.md) for playback ordering.

`packages/stage-ui/src/utils/chat-actor-slices.ts` owns legacy actor-slice hydration, consumed by `assistant-item.vue`. Preserve raw history and ordered text/tool/text slices. Do not infer actor identity from ordinary prose or retrofit chips with a separate regex.

Verify these cases with the existing parser/categorizer tests and `packages/stage-ui/src/utils/chat-actor-slices.test.ts` where applicable:

- No ACTOR and no ACT: ordinary reply, no phantom actor chip, no dropped text.
- ACT without ACTOR: expression applies to the current actor without requiring a roster.
- Two ACTOR segments: correct text slices and voice/model changes at playback, including slow audio with fast generation.
- Reloaded raw history and text/tool/text: hydration preserves order and tokens remain available for inference.
- Studio A/B/C: Director/model ownership and expression setters survive the intended transition and save/reload.

## 8. Sources & Peer Skills

- `packages/stage-ui/src/composables/llm-marker-parser.ts` — delimiter grammar + legacy/curly/escape tolerance (§1).
- `packages/stage-ui/src/composables/response-categoriser.ts` — `stripMarkers`, speech/reasoning categorization.
- `packages/stage-ui/src/constants/prompts/character-defaults.ts` — DEFAULT_ACTING_* defaults and the canonical expressions list.
- `packages/stage-ui/src/types/card.schema.ts` (:148-153) — `AiriExtension.acting`.
- `packages/stage-ui/src/stores/modules/airi-card.ts` (:1372-1384) — acting prompt assembly.
- `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabActing.vue` + `FieldAiGeneratorModal.vue` — authoring UI and the two official format templates.
- `packages/stage-ui/src/types/chat.ts` (:25-48) — `rawContent`/`content` contract; `chat.ts` (:1113-1117, :1648-1656).
- `packages/stage-ui/src/components/scenes/ControlStripHost.vue` (:387-421, :465) — cue dispatch.
- `apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue` — playground.
- `docs/design-journal-actor-token-sync.md` + `docs/design-actor-token-sync-postmortem.md` — ACTOR-token sync diagnostics journal and its validated code-trace review (generation/playback clock skew, text-swallowing, single-flight gaps).
- Peer skills: `airi-prompt-builder-engine`, `airi-character-rendering`, `airi-model-customizer`, `airi-interaction-pipelines`, `airi-onboarding-v2`, `airi-tool-registry-builtin-tools`.

## Related Skills & References

- **Peer Skills**: [[airi-character-rendering]], [[airi-discord-integration]], [[airi-gemini-live-api]], [[airi-interaction-pipelines]], [[airi-model-customizer]], [[airi-onboarding-v2]], [[airi-prompt-builder-engine]], [[airi-tool-registry-builtin-tools]]
- **Key Documents**: [[design-journal-actor-token-sync]], [[design-actor-token-sync-postmortem]]
