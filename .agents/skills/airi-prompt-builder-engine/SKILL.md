---
name: airi-prompt-builder-engine
description: >-
  Compose/debug system prompts: character persona, acting/artistry instructions, dating-sim context, memory injection, head/tail pruning, producer roleplay suggestions. Marker execution uses airi-acting-cue-act-tokens; request dispatch uses airi-llm-dispatch-gateway.
---

# Prompt Builder Engine

Own prompt composition and refresh. Marker execution belongs to [ACT tokens](../airi-acting-cue-act-tokens/SKILL.md), response normalization to [interaction pipelines](../airi-interaction-pipelines/SKILL.md), and cache layout to [prefix cache alignment](../airi-prefix-cache-alignment/SKILL.md).

## Source map

- `packages/stage-ui/src/stores/modules/airi-card.ts:buildSystemPrompt`: card persona and module instructions.
- `packages/stage-ui/src/stores/chat/session-store.ts`: `buildShortTermMemoryContext`, `buildLifetimeMemoryContext`, `generateInitialMessageFromPrompt`, `refreshActiveSystemMessage`.
- `packages/stage-ui/src/stores/dating-sim.ts`: active storyline overlay.
- `packages/stage-ui/src/composables/use-producer.ts:DEFAULT_SYSTEM_PROMPT_TEMPLATE`: user-reply suggestion prompts.

## Composition contracts

1. Preserve persona ordering: system prompt, nickname, description, personality, scenario, greetings/dialog starters; then acting and permitted module instructions.
2. Active Dating Sim replaces `card.scenario` with storyline context. Do not append both and create competing scenes. The guarded Pinia lookup permits use outside setup; verify whether the overlay is available in that context.
3. Acting model/speech/mannerism instructions come from card configuration. Do not globally require ACTOR tags: ordinary cards and Studio Setup B work without them. See `docs/content/en/docs/manual/config/studio.md`.
4. Artistry widget instructions require the allowed image tool, a non-`none` provider, and Autonomous Artistry disabled. Preserve the separate text-journal instruction gate.
5. Memory injection must use the intended character/session context. Do not copy generated memory into permanent persona fields to make a preview look correct.
6. `refreshActiveSystemMessage` prunes intermediate persona blocks while retaining first/last persona and recognized context blocks. Preserve classification contracts: `These are the contextual information retrieved`, `[ENVIRONMENTAL AWARENESS]`, and `[CONTEXT_AWARENESS]`. A renamed heading can cause context to be pruned.
7. In that pruning path, `setSessionMessages` already emits session updates. Do not add another `session-refreshed` broadcast and cause cross-window reload loops. This is not a blanket ban on refresh events elsewhere.
8. Producer prompts suggest what the user could say next. Keep their role and template substitutions separate from the talking assistant and Director.

## Verification

For store/composable changes, `pnpm -F @proj-airi/stage-ui typecheck`. Inspect the composed prompt with Dating Sim on/off, artistry autonomous/manual, tools enabled/disabled, memory present/absent, and no ACTOR configuration. Refresh repeatedly: preserve context, avoid duplicated persona, and check a second window for reload loops. Switch characters/sessions and confirm injected context follows the target.

Design context: `docs/design-prompt-crafting-catalog.md`, `docs/design-director-producer-roles.md`, and `docs/proposal-dynamic-memory-rag-injection.md`. Proposals describe intended behavior; inspect current builders before implementing.
