# Phase 1 Hard Block Design

## Context

The commercial backend/subscription track requires Phase 1 to converge the product around the confirmed data boundary and official provider boundary:

- User accounts, Flux, subscriptions, payments, model catalog, pricing, and billing ledger live in the server DB.
- Private chats, private character cards, and memory stay in the browser/device.
- The customer-facing app exposes one official provider; users must not configure third-party provider keys.

Current inspection found that the provider registry and provider landing page already expose only the official provider, and the data settings page already explains local-only storage with export/clear actions. Two gaps remain:

1. Private server sync routes are still mounted for chat and characters.
2. Concrete third-party provider settings pages still exist and can be reached directly.

## Decision

Use a hard-block strategy instead of physical deletion or feature flags.

Hard blocking keeps the old implementation files available for later refactors or marketplace separation, but makes the customer-facing routes unusable now. This matches the Phase 1 goal with the smallest safe change and avoids introducing new compatibility switches that would preserve the wrong product boundary.

## Scope

### In scope

- Block private chat server sync through REST and WebSocket routes.
- Block private character server sync through the current character REST route.
- Ensure direct navigation to third-party provider settings pages cannot show third-party API-key configuration forms.
- Preserve official provider pages and the provider landing page.
- Keep existing local-data copy and maintenance actions, improving only if tests or code review show an obvious Phase 1 gap.
- Update the commercial requirements checklist only after implementation and verification match reality.

### Out of scope

- Deleting provider implementation files across the repository.
- Building a public character marketplace route.
- Adding feature flags to re-enable private sync or third-party provider UI.
- Implementing Phase 2 model catalog/pricing or Phase 3 subscription/payment changes.
- Full Phase 4 Chinese localization cleanup, except for small touched-copy fixes if they are directly adjacent.

## Server Design

### Disabled private sync router

Create a small route boundary for disabled private sync endpoints. It should return a consistent API error for every method and nested path under the blocked prefix.

Recommended response:

- HTTP status: `410 Gone`
- Error code: stable product-level code such as `PRIVATE_SYNC_DISABLED`
- Message: explain that private chats, private character cards, and memory are stored locally in the browser/device for this product build.

This makes old clients fail explicitly instead of silently creating server-backed private data.

### `/api/v1/chats`

Replace the current mount of `createChatRoutes(deps.chatService)` with the disabled private sync router. Existing chat service code remains in place but is no longer mounted in the customer-facing API.

Expected behavior:

- `GET /api/v1/chats` returns `410`.
- `POST /api/v1/chats` returns `410`.
- Nested chat mutation paths also return `410`.

### `/api/v1/characters`

Replace the current mount of `createCharacterRoutes(deps.characterService)` with the disabled private sync router for Phase 1.

The current character route includes owner-scoped create/update/delete and social actions, so it is not safe to treat it as a public marketplace route without a separate design. If a future marketplace/public character catalog is needed, it should be split into a new explicit route with its own read/write policy.

Expected behavior:

- `GET /api/v1/characters` returns `410`.
- `POST /api/v1/characters` returns `410`.
- Owner-scoped update/delete paths return `410`.

### `/ws/chat`

Stop upgrading `/ws/chat` into the chat sync handler. Use a normal HTTP response that rejects the old private sync endpoint before any private state exchange can start.

Expected behavior:

- `GET /ws/chat` returns a disabled response rather than establishing a WebSocket sync session.
- Audio speech WebSocket and OpenAI-compatible routes are not affected.

## Frontend Provider Route Design

### Official routes remain reachable

Keep these pages active:

- `settings/providers/chat/official-provider`
- `settings/providers/vision/official-provider`
- `settings/providers/speech/official-provider-speech`
- `settings/providers/speech/official-provider-speech-streaming`
- `settings/providers/transcription/official-provider-transcription`

### Third-party concrete pages redirect

Direct visits to third-party provider concrete pages should redirect to `/settings/providers` or to the appropriate official provider page. The simplest Phase 1 behavior is redirecting to `/settings/providers`, because it avoids implying a third-party provider was converted into an official one.

Use the existing provider boundary concept as the source of truth where practical:

- Provider landing sections are already filtered through official-only provider cards.
- Dynamic provider pages already have unsupported-route logic.
- Concrete third-party pages need the same boundary applied, either through page-level redirect code or a shared route guard if the route system supports it cleanly.

Hard-blocking should prevent third-party API-key forms from rendering after direct navigation.

## Data Flow

After this change:

1. The browser stores private chat, private character, and memory data locally.
2. The settings data page exposes local export/import/clear actions for supported local data.
3. The backend rejects private sync requests for chats and characters.
4. Provider settings only allow official provider configuration and model/service selection that routes through the server proxy.
5. Billing and model gateway routes continue through the server and remain available for later Phase 2 fixed per-call pricing work.

## Error Handling

- Server disabled endpoints use one stable error response and status to avoid route-by-route drift.
- The error message should be user-safe and not mention internal legacy implementation details.
- Frontend redirects should avoid throwing visible errors during normal navigation.
- Tests should assert status and error code, not exact prose, unless the copy itself is the contract.

## Testing Plan

### Server tests

Add or update focused tests around `createApp()` or the relevant route module:

- `/api/v1/chats` returns the disabled-sync error for representative read and write methods.
- `/api/v1/characters` returns the disabled-sync error for representative read and write methods.
- `/ws/chat` no longer establishes the private chat sync handler.
- Existing OpenAI/audio speech routes remain mounted by preserving current route tests where applicable.

### Frontend tests

Add or update focused tests where current test infrastructure supports it:

- Provider registry exposes only official providers.
- Provider landing page sections only include official provider cards.
- Unsupported provider route handling redirects away from third-party provider pages or otherwise prevents third-party forms from rendering.

### Documentation/checklist verification

Only after tests pass, update the Phase 1 checklist in `docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md` to reflect verified completion. If any item cannot be fully verified, leave it unchecked or add a precise note instead of marking it complete.

## Implementation Notes

- Keep changes small and scoped to Phase 1 boundaries.
- Do not add backward-compatibility flags for the old behavior.
- Do not remove old service modules unless the implementation reveals they are unused and safe to delete within this scope.
- Preserve existing comments that explain multi-instance behavior and billing boundaries.
- Add `NOTICE:` comments only where a reader needs to understand why an old route is intentionally blocked instead of removed.

## Acceptance Criteria

Phase 1 is complete when all of the following are true:

1. The provider registry and provider landing page expose only official providers.
2. Direct navigation to third-party provider settings pages cannot show third-party API-key setup forms.
3. `/api/v1/chats` cannot create, list, update, or delete server-backed private chats.
4. `/api/v1/characters` cannot create, list, update, or delete server-backed private character data.
5. `/ws/chat` cannot establish the old private chat sync session.
6. The local data settings page continues to explain local-only storage and expose export/clear actions.
7. Targeted server and frontend tests pass.
8. The commercial requirements Phase 1 checklist matches the verified state.
