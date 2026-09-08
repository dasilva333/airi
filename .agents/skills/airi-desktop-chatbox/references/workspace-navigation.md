# Workspace navigation

## Entry points

- `apps/stage-tamagotchi/src/renderer/pages/chat.vue`: `activeSurface`, `activeSurfaceComponent`, title/icon maps, sidebar/drawer navigation.
- `apps/stage-tamagotchi/src/main/windows/chat/index.ts`: Electron window creation and sizing.
- `apps/stage-tamagotchi/src/renderer/components/chat/`: workspace wrappers.

| Surface key | Wrapper | Responsibility |
| --- | --- | --- |
| messages | `chat_messages.vue` | Chat input/history; forwards the InteractiveArea ref |
| director | `chat_director.vue` | Director Monitor |
| world | `chat_world.vue` | World Bible / character context |
| characters | `chat_studio.vue` | Studio / AnimaDex |
| media | `chat_media.vue` | Media Library / background picker |
| archives | `chat_lifetime.vue` | Eternal Thread / lifetime dialogs |
| event-log | `chat_event_log.vue` | Event Ledger |
| notes | `chat_notes.vue` | Notes placeholder; inspect before assuming editing exists |
| rehearsal | `chat_rehearsal.vue` | Rehearsal / model customization |

## Changing a route

1. Update the `activeSurface` union, component mapping, title/icon maps, and wrapper.
2. Update both inline navigation arrays in `chat.vue`: desktop sidebar and compact drawer. They are duplicated.
3. Preserve the `airi:chat:left-panel-active` persisted selection; handle a removed/unknown value deliberately.
4. Keep `chat_messages.vue` ref forwarding intact: shell/right-panel actions call into InteractiveArea.
5. Guard absent active card/session while switching or restoring state. Check keyboard focus and drawer closure.

A workspace wrapper should delegate domain behavior. Director decisions use `airi-director-orchestration`; card creation uses `airi-animadex-wizard`; lifetime provisioning uses `airi-memory-provisioning`. Do not copy those stores into navigation handlers.

## State and verification

Each Electron window has its own Pinia instance. A local mutation is not cross-window synchronization; use existing repository actions and matching broadcast contracts. See `airi-broadcast-channels` and `docs/rosetta-stone.md`.

Open every changed route through sidebar and drawer, restore its persisted selection, switch characters, and test a missing card. Verify right-panel actions on Chat View after returning from another route.

Design context: `docs/design-tamagotchi-chatbox-ux-improvements.md`. Treat proposed UX as rationale, not proof that a component exists.
