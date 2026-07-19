# Commercial Backend Phase 0 Design

## Purpose

Phase 0 locks the customer target before implementation starts. Its output is a current-state disposition matrix that tells future agents and engineers which existing modules to keep, reuse, refactor, delete, or hide while implementing the commercial backend, periodic subscription, official-provider-only, and local-browser chat/character/memory requirements.

This document is a design/spec for the audit step only. It does not implement backend tables, UI changes, or payment behavior.

## Source of Truth

All Phase 0 work must follow:

- `AGENTS.md` — active customer target guardrails.
- `docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md` — customer-confirmed requirements and acceptance examples.

The requirements document remains the single source for customer scope. This Phase 0 spec explains how to mark current code against that scope.

## Confirmed Customer Decisions

- Accounts, Flux, subscriptions, payments, model catalog, pricing, and billing ledger live in the server DB.
- Chats, character cards, and memory stay in the browser.
- User-facing provider UI exposes one official provider only.
- All LLM, TTS, and image generation requests go through the backend proxy.
- The official provider may expose selectable models.
- Model billing is fixed Flux per call, per model/capability.
- Subscription is periodic, not a one-time top-up package.
- Epay uses real customer merchant credentials for this phase of delivery.
- UI should be simple and based directly on `https://airi.moeru.ai/`; extra screenshot-driven deletion is paused until the customer gives explicit removal targets.

## Current-State Disposition Method

Each relevant module receives one primary disposition:

| Disposition | Meaning | Required next action |
|---|---|---|
| Keep | Already aligns with the final customer target. | Leave in place, only maintain or test. |
| Reuse | Provides a useful base but must be wired into the new target. | Build on it without preserving incompatible behavior. |
| Refactor | Has the right general area but conflicts with the final target. | Change ownership, data flow, schema, or UI behavior. |
| Delete / Hide | Conflicts with the final target or would confuse users. | Remove, disable, or hide from the user-facing app. |
| Investigate | Needs an external/customer answer before final treatment. | Keep out of implementation until clarified. |

A module can have secondary notes, but the matrix should keep one primary disposition so implementation work does not stall on ambiguous labels.

## Disposition Matrix Design

The requirements document gets a new section named `Current Implementation Disposition` before `Implementation Phases`.

Each row contains:

- **Area** — user-facing or architectural module.
- **Current evidence** — concrete current implementation reference.
- **Disposition** — one of Keep / Reuse / Refactor / Delete or Hide / Investigate.
- **Target action** — what future implementation should do.
- **Completion condition** — how we know this area is done.

This matrix is intentionally high-level. Detailed implementation checklists belong in later plans.

## Initial Matrix Scope

The first Phase 0 matrix covers these areas:

1. Server app foundation.
2. Better Auth account system.
3. Admin user management.
4. Flux balance and ledger.
5. Epay one-time top-up implementation.
6. Stripe payment/subscription code.
7. OpenAI-compatible backend gateway.
8. TTS backend gateway.
9. Image generation capability.
10. Router config and provider catalog.
11. Official provider frontend runtime.
12. Third-party provider frontend UI and routes.
13. Account/profile page.
14. Flux settings page.
15. Chat persistence.
16. Character card persistence.
17. Memory persistence.
18. Chinese localization.
19. Customer screenshot deletion list.
20. Node/local dev setup.

## Completion Rules

- When a Phase 0 checklist item is finished, update the checkbox in `docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md` immediately.
- Also mark the matching visible task-list item complete in the current Claude session.
- Do not wait until the whole project is done to mark completed audit work.
- Do not mark implementation requirements complete from Phase 0. Phase 0 only marks audit/design tasks complete.

## Non-Goals

- Do not implement the commercial backend tables in Phase 0.
- Do not delete provider UI in Phase 0.
- Do not change billing behavior in Phase 0.
- Do not enter real Epay credentials in source-controlled files.
- Do not commit these documentation changes unless the user explicitly asks.

## Risks and Guardrails

- **Existing uncommitted work:** The worktree contains many existing changes. Phase 0 must avoid overwriting unrelated code or assuming those changes are complete.
- **Epay periodic behavior:** Automatic recurring charging is not assumed. Phase 0 documents periodic subscription as renewable paid periods through Epay checkout unless the customer's provider confirms a recurring API.
- **Data-boundary conflict:** The server currently has chat and character routes/tables. The matrix must mark these as conflicting with private chat/character storage unless isolated for marketplace/public use.
- **Provider regression:** The provider registry already disables third-party imports in one place, but UI routes and pages still exist. The matrix must distinguish runtime registry progress from UI cleanup still needed.

## Review Checklist

- The matrix points every major current module to Keep, Reuse, Refactor, Delete/Hide, or Investigate.
- The matrix does not claim implementation completion.
- The Phase 0 requirements checkbox is updated only for the audit work actually completed.
- No customer secret, merchant key, or API key appears in docs.
- Future implementation remains aligned with the active customer target in `AGENTS.md`.
