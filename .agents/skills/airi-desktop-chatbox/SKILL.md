---
name: airi-desktop-chatbox
description: >-
  Build/debug desktop chat workspace navigation, composer, attachments, transcript bubbles, action menus, grounding panel and journal chips. Input routing uses airi-interaction-pipelines; Studio decisions use airi-director-orchestration.
---

# Desktop Chatbox

Own desktop chat surfaces and shared transcript presentation. Read only the reference matching the change; load multiple for changes crossing those boundaries.

| Task | Reference |
| --- | --- |
| Workspace routes, subviews, window shell, right panel | [Workspace navigation](references/workspace-navigation.md) |
| Drafts, send/stop buttons, attachments, suggestions, composer variants | [Composer](references/composer.md) |
| Bubbles, action menus, grounding, journal chips, streaming performance | [Transcript rendering](references/transcript-rendering.md) |

## Ownership

- Desktop shell: `apps/stage-tamagotchi/src/renderer/pages/chat.vue`.
- Desktop input: `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue`.
- Shared rendering: `packages/stage-ui/src/components/scenarios/chat/`.
- Input dispatch, hooks, cancellation: [interaction pipelines](../airi-interaction-pipelines/SKILL.md).
- Actor grammar: [ACT tokens](../airi-acting-cue-act-tokens/SKILL.md); Studio decisions: [Director](../airi-director-orchestration/SKILL.md).
- Memory generation/persistence belongs to the corresponding memory skill. A preview or grounding toggle is not the injection implementation.

Paths in references are repository-relative. Verify source before applying older design documents. Desktop, portrait mobile, landscape web/pocket, and WhisperDock have different composition paths; do not assume shared bubbles mean shared input state.

## Verification

Check the affected surface with streaming text, tool output, empty history, and a switched character/session. For code changes, typecheck affected workspaces: `@proj-airi/stage-tamagotchi`, `@proj-airi/stage-ui`, or `@proj-airi/stage-layouts`, using `pnpm -F <workspace> typecheck`. Shared renderer changes also need a web/pocket smoke check. Use the selected reference's behavioral checks.
