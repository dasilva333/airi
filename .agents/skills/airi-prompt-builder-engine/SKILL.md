---
name: airi-prompt-builder-engine
description: >-
  Use when working with the AIRI system prompt builder, ACT marker pipeline, dating sim
  engine, character card prompt composition, acting/artistry instructions, short-term and
  lifetime memory injection, persona head/tail pruning, use-producer roleplay suggestions,
  and bridged gateway tool-call construction. Key tech: Vue 3 Pinia stores, TypeScript,
  streaming <|ACT:...|> marker parser, xsai tool calls, OpenAI-compatible gateways.
  Paths: packages/stage-ui/src/stores/modules/airi-card.ts,
  packages/stage-ui/src/stores/chat/session-store.ts,
  packages/stage-ui/src/composables/llm-marker-parser.ts,
  packages/stage-ui/src/stores/dating-sim.ts,
  packages/stage-ui/src/composables/use-producer.ts.
---

# AIRI Prompt Builder Engine

Composes the runtime system prompt from character-card fields plus overlays, then
enriches it per-session with memory and environmental context, and parses special
`<|ACT:...|>` action markers out of the LLM stream.

## Key Files/Locations

- `packages/stage-ui/src/stores/modules/airi-card.ts` — `buildSystemPrompt(card)` (~line 1407).
  Composes, in order: `card.systemPrompt`, `Nickname: ...`, `card.description`,
  `card.personality`, `card.scenario`, and `Greetings / Dialog Starters` bullets. Then
  appends acting prompts from `card.extensions.airi.acting` (`modelExpressionPrompt`,
  `speechExpressionPrompt`, `speechMannerismPrompt`), the artistry `widgetInstruction`
  (gated by `allowedTools`/`provider !== 'none'`/`!autonomousEnabled`), and the
  text-journal `widgetInstruction` (default `DEFAULT_TEXT_JOURNAL_WIDGET_INSTRUCTION`).
  Exposed as the store computed `systemPrompt` (line 1403).
- `packages/stage-ui/src/stores/chat/session-store.ts` —
  `buildShortTermMemoryContext(characterId)` (line 210, slices daily summaries by
  `windowSize ?? 3` into a `[Short-Term Memory]` block),
  `buildLifetimeMemoryContext` (line 226, `[Lifetime Artifact]` block),
  `generateInitialMessageFromPrompt` (line 240), and `refreshActiveSystemMessage()`
  (line 805) which prunes persona blocks keeping only head + tail.
- `packages/stage-ui/src/composables/llm-marker-parser.ts` — `useLlmmarkerParser`
  streaming marker tokenizer splitting literal vs. special tokens.
- `packages/stage-ui/src/stores/dating-sim.ts` — dating-sim game state (phases, mood,
  choices) read by the prompt builder.
- `packages/stage-ui/src/composables/use-producer.ts` — `DEFAULT_SYSTEM_PROMPT_TEMPLATE`
  (line 70) and template substitution for interactive roleplay user-suggestion prompts.

## When to Use

- Adding, reordering, or gating any block of the runtime system prompt.
- Debugging why a persona/system message is missing, duplicated, or stale across sessions.
- Touching dating-sim storyline, appearance, or scene injection into the prompt.
- Working on `<|ACT:...|>` / `<|DELAY:...|>` / bridged tool-marker parsing or execution.
- Constructing bridged tool-call objects for strict OpenAI/DeepSeek-compatible gateways.
- Composing producer ("what could the user say next") roleplay suggestion prompts.

## Common Pitfalls

- **Dating sim disables `card.scenario`.** When `useDatingSimStore().enabled &&
  activeStoryline` is truthy, `buildSystemPrompt` swaps `card.scenario` out (`isDatingSimActive
  ? '' : card.scenario`, line 1432) and instead injects the storyline premise, appearance, and
  scene (lines 1470-1480). Editing scenario while dating sim is active silently does nothing.
- **Persona head/tail pruning.** `refreshActiveSystemMessage` keeps only the FIRST and LAST
  system "Persona" blocks and prunes intermediates, but preserves blocks starting with
  `These are the contextual information retrieved`, `[ENVIRONMENTAL AWARENESS]`, or containing
  `[CONTEXT_AWARENESS]` (lines 836-884). Removing those prefixes reclassifies memory/context
  blocks as persona and gets them pruned.
- **Do NOT broadcast `session-refreshed` after pruning** — `setSessionMessages()` already
  emits `session-updated`; an extra refresh triggers a cross-window force-reload loop
  (NOTICE at lines 895-898).
- **`index: 0` is mandatory on manually built tool calls** (Rosetta §16). When enqueueing a
  bridged tool call (see `chat.ts` line ~864), the object MUST include `index: 0`, or strict
  OpenAI/DeepSeek gateways (Console Go / OpenCode) return `400 Bad Request: Upstream request
  failed`. Marker-bridges in `use-producer`-style flows and live-session follow the same rule.
- **Marker tag variants.** The parser normalizes escaped `<{'|'}`, curly `|}`, and legacy `>`
  closers, and only treats a bare `>` as legacy close for `<|ACT`, `<|DELAY`, `<|LLM_`
  prefixes (lines 91-109). Don't assume a single close-tag shape.
- **`buildSystemPrompt` swallows Pinia errors** (try/catch lines 1415-1425) so it can run
  outside an active Pinia; dating-sim overlay silently drops in that case.

## Verification

- `pnpm -F @proj-airi/stage-ui typecheck` for any store/composable change.
- Toggle dating sim on/off and confirm `card.scenario` alternates with storyline overlay in
  the composed prompt.
- Force-run `refreshActiveSystemMessage({ force: true })` and confirm only head+tail persona
  blocks remain (check `[ChatSession] Successfully refreshed and pruned` debug log).
- For bridged tool calls, confirm the outbound `tool_calls` chunk includes `index: 0` (a
  missing index surfaces as a gateway 400).
