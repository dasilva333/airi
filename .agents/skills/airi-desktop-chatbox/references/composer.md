# Composer

## Distinct input owners

- Desktop: `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` owns drafts, attachments, producer suggestions, send and Stop. It does not use `useChatComposer`.
- Shared web/pocket input: `packages/stage-ui/src/composables/use-chat-composer.ts`. Inspect its consuming surface before changing behavior.
- WhisperDock shell: `packages/stage-ui/src/components/scenarios/chat/WhisperDock.vue`; composer controls live in `WhisperComposerBar.vue`.
- Shared suggestions: `packages/stage-ui/src/composables/use-producer.ts`.
- Landscape layout and transcript hosting: `packages/stage-layouts/src/components/Widgets/ChatArea.vue` and its layout consumers.

Shared `useChatComposer` also owns listening/auto-send, trash confirmation, and Imagine mode. Its Imagine branch calls `runArtistTask` instead of ordinary chat ingestion; preserve that branch when refactoring Send.

Do not patch one composer and claim all chatboxes changed. Identify portrait/landscape and desktop consumers with source search.

## Send, failure, Stop

Desktop `handleSend` optimistically clears input. Preserve draft/attachment restoration on failure and object-URL revocation after successful attachment handling. Keep file/drop validation, preview removal, and persisted draft behavior consistent.

`INVOKE_CHARACTER_FIRST` is an intentional empty-history first-turn trigger. Do not reject it through a generic empty-text guard or display the sentinel as user prose.

The Stop handler calls `stopCurrentGeneration(activeSessionId)`. Disable/enable controls from actual send/generation state; cancelling provider work, preserving the partial reply, and stopping speech belong to [interaction pipelines](../../airi-interaction-pipelines/SKILL.md), not a button-local flag.

Producer/wand suggestions are user-reply candidates, not assistant responses. Preserve local generation options and explicit selection/send behavior. Prompt composition belongs to `airi-prompt-builder-engine`; request execution belongs to `airi-llm-dispatch-gateway`.

## Verification

- Successful send clears draft; rejected send restores text and attachments.
- Remove attachment, retry send, switch session, and reopen window; inspect draft and URL lifecycle.
- Test empty initial conversation and the character-first trigger.
- Stop while streaming, then send again; no duplicated partial reply or replayed speech.
- Generate a suggestion, replace/refine it, select it, and verify it does not send without the intended action.
- If touching shared input, test portrait and landscape separately.

Read `docs/design-chatbox-magic-wand-flow.md` for flow rationale and `docs/arch-chat-stt-proactivity-pipelines.md` for routing context; source determines current behavior.
