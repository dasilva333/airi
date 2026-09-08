# Transcript rendering

## Sources

Under `packages/stage-ui/src/components/scenarios/chat/`:

- `history.vue`, `assistant-item.vue`, `user-item.vue`: list and message rendering.
- `response-part.vue`, `tool-call-block.vue`: text/tool slices.
- `DirectorNoteBubble.vue`: Director-specific presentation.
- `components/action-menu/index.ts`: `ChatActionMenuAction`, `createChatActionMenuItems`.
- `components/action-menu/index.vue`: menu handlers/emits.
- Locate `ChatGroundingPopover`, journal preview consumers, and message-key utilities with source search before editing their consumers.

## Rendering contracts

Preserve ordered slices: text, tool, text must not collapse into a single text bubble around tool output. Keep raw content available for legacy actor-slice hydration. ACTOR-free replies remain ordinary messages; no phantom actor chip or inferred actor identity. Delegate grammar/hydration to `airi-acting-cue-act-tokens`.

An action-menu change spans the action type, menu builder, handler/emits, and consuming render sites. Search all callers rather than adding a visible item with no handler. Forking includes universe selection; preserve scope instead of copying messages directly into the current session.

Journal chips use grouped text entries and latest image entries. Distinguish journal preview/download from creating a journal moment. Preserve mood/flavor presentation and echo grouping; generation and persistence remain in memory skills.

## Grounding controls

Trace these settings through actual prompt injection, not only the preview:

| Setting | Context represented |
| --- | --- |
| `groundingEnabled` | Environmental awareness |
| `groundingMemoryEnabled` | Grounded long-term memories |
| `groundingTopicsEnabled` | Recent topics |
| `groundingDirectorScratchpadEnabled` | Visual state board / Director scratchpad |

Keep `salienceGateEnabled` distinct from the grounding switches. The In-context History placeholder is not evidence of an implemented independent switch. Verify character/universe filters in retrieval code when changing displayed scope.

## Performance and verification

Avoid eager deep watchers on streaming history or large store objects. Use targeted dependencies and stable message keys. Do not make reasoning previews feed their measured size back into their own layout.

Preserve `healMozibake` Unicode handling: code points, not blind UTF-16 `charCodeAt` conversion. Check emoji and non-Latin text after any repair change.

Test reasoning plus text, text/tool/text, multiple actors, no actor tags, edit/retry/delete/fork, image/text journal previews, and grounding toggles. Check a second window and web/pocket when changing shared components. For CPU/layout regressions, read `docs/archive/linux-wayland-chat-cpu-spikes.md` and `docs/rosetta-stone.md` §16.
