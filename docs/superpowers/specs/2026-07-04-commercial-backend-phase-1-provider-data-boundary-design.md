# Commercial Backend Phase 1 Provider and Data Boundary Design

## Purpose

Phase 1 turns the customer-facing frontend into a product surface with one official service source and clear local-data ownership. It does not remove backend chat or character routes, because the user wants to keep those server capabilities available for possible future use. Instead, Phase 1 makes the current frontend hide third-party provider configuration and avoid private chat, character, and memory server sync paths.

## Source of Truth

Phase 1 follows:

- `AGENTS.md` — active customer target guardrails.
- `docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md` — customer-confirmed commercial backend requirements.
- `docs/superpowers/specs/2026-07-04-commercial-backend-phase-0-design.md` — Phase 0 disposition method and confirmed audit baseline.

Relevant requirements:

- R3.2: chats, characters, and memory stay in the browser.
- R3.3-R3.4: frontend must not save private chats or private character cards through server sync APIs.
- R3.6: local data should have clear cleanup, import/export, or backup messaging.
- R4.1-R4.7: the frontend exposes only the official provider and routes model requests through the backend proxy.
- R12.1-R12.4: remove third-party provider entry points and avoid user-entered third-party key prompts.

## Confirmed Phase 1 Decisions

- **Scope:** frontend product-state convergence only.
- **Backend chat/character routes:** keep in place for possible future use; do not return 410 or delete DB tables in Phase 1.
- **Third-party provider pages:** keep files in the repo, but hide them from the current settings UI so users cannot see or click into third-party configuration from supported product paths.
- **Direct URL handling:** do not prioritize deleting every historical route in Phase 1. If existing dynamic provider routes can still expose third-party key forms from normal settings navigation, add an official-only guard or redirect at that frontend boundary.
- **Local-data UX:** add clear Data-page messaging and keep existing chat export/import/clear behavior. Do not expand Phase 1 into new character-card import/export features.

## Architecture Boundary

Phase 1 does not try to make the server enforce the full private-data boundary. The server may still contain chat and character modules for future marketplace, cloud-sync, or multi-device work. The customer-facing frontend is responsible for the current product boundary:

1. Provider registry and settings entry points expose only official provider capabilities.
2. Chat sessions, character cards, and memory remain browser/device-local.
3. Data settings explain what is local, what is server-side, and how users should back up or clear local data.

This keeps the change small and reversible while satisfying the customer's current UI and data-boundary expectations.

## Provider UI Design

### Current State

- `packages/stage-ui/src/libs/providers/providers/index.ts` already imports only `./official`.
- `packages/stage-ui/src/libs/providers/providers/official/shared.ts` routes official OpenAI-shaped and audio requests through `SERVER_URL`.
- `packages/stage-pages/src/pages/settings/providers/index.vue` still renders multiple provider categories and manually adds artistry providers such as ComfyUI, Replicate, and Nano Banana.
- `packages/stage-pages/src/pages/settings/providers/**` still contains many third-party provider settings pages.

### Target State

The service source settings page becomes an official-only status and configuration surface:

- Show official chat, vision, speech, and transcription capabilities when those official metadata entries exist.
- Do not render third-party provider cards, categories, filter controls, or setup paths.
- Remove customer-facing prompts that imply users should paste OpenAI, OpenRouter, Ollama, Azure, ElevenLabs, Replicate, ComfyUI, or similar third-party credentials.
- Keep old third-party provider page files so future work can restore or repurpose them without reconstructing the whole integration.
- Prefer a simple official-provider list over a marketplace-style UI. With only one service source, price and deployment filters add noise and should not render.

### Official Provider Copy

The page copy should say that AIRI official services are used after login and that model requests go through the AIRI backend for account checks, Flux billing, auditing, and availability. It should not say users need to configure their own third-party key.

## Private Data Boundary Design

### Chat Sessions

Current chat persistence uses IndexedDB through `unstorage` and the `chatSessionsRepo` keys. Cloud sync is present in code but gated by `PERSONAL_DATA_CLOUD_SYNC_ENABLED = false` in `packages/stage-ui/src/stores/chat/session-store.ts`.

Phase 1 keeps this local-first behavior:

- Do not enable cloud websocket sync.
- Do not call server chat create/update/message APIs from the normal frontend flow.
- Keep local chat export/import/delete actions available in Data settings.
- Keep the disabled cloud-sync code path documented as intentionally inactive for this customer track.

### Character Cards

`packages/stage-ui/src/stores/characters.ts` currently uses the local character model for create, update, remove, like, and bookmark controller actions. Remote mutation definitions still exist but are not used by the returned controller flow.

Phase 1 should preserve the local behavior:

- Keep user-private character card creation and edits in local storage.
- Do not wire UI actions to `createRemote`, `updateRemote`, or `removeRemote` for private cards.
- Leave server character APIs available for future marketplace/public catalog work, but avoid mixing them into the private character-card settings flow.

### Memory

Phase 1 does not introduce server memory sync. Existing memory settings remain local. Data-page copy should explicitly include memory in the local-data boundary so users do not assume account login backs it up.

## Local Storage Inventory

Document these browser/device-local storage locations in the Phase 1 implementation notes or Data-page developer comments where useful:

| Storage | Purpose |
|---|---|
| IndexedDB base `airi-local` | Primary local app data namespace. |
| IndexedDB base `airi-sync-queue` | Historical/offline cloud-sync queue namespace; remains inactive for personal chat sync in this product track. |
| `local:chat/index/:userId` | Per-user local chat session index. |
| `local:chat/sessions/:sessionId` | Local chat session records and messages. |
| `local:chat/tombstones/:userId` | Historical cloud-delete tombstones used only if cloud sync is re-enabled later. |
| `local:chat/outbox/:userId` | Historical pending cloud message outbox used only if cloud sync is re-enabled later. |
| `local:characters` | Local private character cards. |

The user-facing copy should not expose every raw key unless it helps troubleshooting. The product text should explain the behavior in plain Chinese: local data is saved in this browser/device and should be exported before clearing site data, changing browsers, or reinstalling.

## Data Settings UX Design

Update `packages/stage-pages/src/pages/settings/data/index.vue` and related Data section components only as much as needed to support the existing entry points and copy.

Expected user-facing behavior:

- A local-data boundary notice appears near the top of Data settings.
- Chat section copy says chat sessions are local and can be exported/imported/deleted from this device.
- Existing chat export/import/delete actions remain the supported backup and cleanup path.
- Provider reset copy avoids promising or emphasizing third-party credential management in the customer build.
- Danger-zone copy reminds users to export local data before clearing it.

Do not add a new character import/export workflow in Phase 1. That would be useful later, but it is outside the confirmed scope.

## i18n Design

All new or changed user-facing copy belongs in `packages/i18n`, especially:

- `packages/i18n/src/locales/zh-Hans/settings.yaml`
- `packages/i18n/src/locales/en/settings.yaml`

Phase 1 should replace obvious English fallback text in touched settings surfaces. Priority keys:

- Provider page title, description, help info, filters, and category descriptions.
- Official provider speech streaming title/description.
- Data page title, description, local-data notice, chat section copy, provider reset copy, and danger-zone copy.
- Any touched account/Flux wording only when directly needed by this phase.

## Error Handling and Fallbacks

- Provider page should handle an empty official metadata list with a localized empty state that points users to login or retry later, not third-party setup.
- Data export/import errors should continue using existing status-banner behavior, with localized messages.
- If a hidden third-party provider route is reached through a stale link and a guard is added, prefer a localized redirect or unavailable message over rendering API-key forms.
- Chat cloud sync remains disabled. Disabled sync should not show user-facing sync errors because no sync should start.

## Testing Strategy

Phase 1 should add or update focused tests where practical:

- Provider registry test: official provider remains the only user-facing provider import path.
- Provider settings page test: third-party provider names/cards and API-key setup prompts are not rendered in the current page.
- Chat session store test: initialization does not create a cloud websocket or enqueue server sync when `PERSONAL_DATA_CLOUD_SYNC_ENABLED` is false.
- Character store test: create/update/remove stay local and do not call remote mutations through normal controller actions.
- Data settings page test: local-data boundary notice and existing chat export/import/delete actions render.

Targeted verification commands should prefer workspace-scoped or file-scoped Vitest runs before broader checks.

## Non-Goals

- Do not delete backend chat or character routes.
- Do not drop server chat, character, or memory-related schemas.
- Do not implement model catalog, model pricing, or fixed Flux-per-call billing in Phase 1.
- Do not implement subscription or Epay changes in Phase 1.
- Do not add a build-flag system for multiple product editions unless a later requirement asks for it.
- Do not add new character-card import/export tooling in Phase 1.
- Do not delete third-party provider page files solely to hide them from the current UI.

## Acceptance Criteria

- Service source settings shows only official provider capabilities and no third-party provider cards.
- Current supported settings navigation does not expose third-party API-key forms.
- Normal chat flow persists locally and does not upload private chat messages to server routes.
- Normal private character-card create/update/remove flow persists locally and does not call server character mutations.
- Memory remains local and no server memory sync is introduced.
- Data settings clearly says chats, character cards, and memory are stored in the browser/device and should be exported before clearing local data.
- Existing chat export/import/delete entry points remain available.
- Touched Chinese settings copy has no obvious English fallback on the Phase 1 surfaces.
