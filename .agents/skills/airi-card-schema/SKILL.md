---
name: airi-card-schema
description: "Use when working with Character Card Specifications (CCv2/CCv3), AiriCard and AiriExtension Valibot schemas, PNG tEXt chunk writing/parsing (chara keyword, CRC32), base64 UTF-8 encoding, or webview download interception."
---

# Overview & Architecture
This skill defines workflows and architecture for managing character cards in AIRI, including CCv2/CCv3 interoperability, PNG image parsing and writing (`tEXt` chunks with base64 encoded data), and data persistence in Pinia / IndexedDB.

AIRI extends the standard Character Card specification with the `AiriExtension` schema (`extensions.airi`), which houses configurations for Consciousness (LLMs), Speech (TTS), Manifestations (2D/3D avatars), Behavioral Systems (Heartbeats, Dream State), and Visual Assets.

# Key Code Paths

### 1. Data Schema & Types
- `packages/stage-ui/src/types/card.schema.ts`: Defines the strict runtime Valibot schemas (`AiriCardSchema`, `AiriExtensionSchema`).

### 2. Store & Persistence
- `packages/stage-ui/src/stores/modules/airi-card.ts`: Pinia store (`useAiriCardStore`) managing memory structures and persistence. Persists to IndexedDB `local:airi-cards` rather than localStorage to avoid QuotaExceeded errors with large card bases.

### 3. Architecture & Documentation
- `docs/airi-card-design.md`: The canonical document outlining the AIRI Package Spec v2, upstream ZIP packaging, and ecosystem interoperability logic.

### 4. UI & Parsing Overlords
- `packages/stage-pages/src/pages/settings/airi-card/index.vue`: Main UI for managing cards and triggering exports.
- `apps/stage-tamagotchi/src/main/index.ts`: Electron main process interceptor that listens for webview `.png` and `.json` downloads to launch the card import wizard.

# Core Standard Operating Procedures (SOPs)

### 1. Adding or Modifying Card Schema Properties
When extending `AiriExtension` with new fields (e.g., a new proactivity system):
1. **Update `card.schema.ts`:**
   Add the new optional field to `AiriExtensionSchema`. Note that `looseObject` and `optional()` should be used generously, as external imported cards will not have strict internal states.
2. **Update the TypeScript Interface:**
   Add the property definition to the `AiriExtension` TypeScript interface within `packages/stage-ui/src/stores/modules/airi-card.ts`.
3. **Verify the Store Factory:**
   If a default is required, add it inside `resolveAiriExtension(card)` in `airi-card.ts` to ensure newly imported cards initialize gracefully.

### 2. IndexedDB Storage Integration
**CRITICAL:** Do NOT persist AiriCard collections to standard `localStorage`. Due to embedded base64 voice profiles and long lore histories, the payload routinely exceeds 5MB limits.
- The `useAiriCardStore` utilizes `localforage` (via `storage.setItemRaw('local:airi-cards')`).
- Keep sync signals and cross-tab/cross-worker updates aligned via `airi:cards-sync` BroadcastChannel.

### 3. PNG Parse & Export Pipeline
AIRI interacts with character discovery platforms (JanitorAI, Chubb) by disguising card JSON data within standard PNG image files via `tEXt` chunks.
- **Import:** Search the binary array buffer starting at offset 8 for a `tEXt` chunk labeled `chara`. Extract the raw buffer, base64-decode to UTF-8, and parse as JSON.
- **Export:** Encode the JSON payload in base64. Ensure an accurate IEEE 802.3 CRC32 checksum is calculated for the chunk data, or strict image parsers (and Photoshop) will declare the PNG corrupt.

### 4. Upstream ZIP Format Handling
AIRI maintains an advanced fork of the upstream (`moeru-ai/airi:main`).
- Upstream uses a `.zip` archive (v1 manifest) for `card.json` + one physical display model.
- Our fork proposes a `v2` ZIP manifest accommodating multiple models and assets (cover images, backgrounds, voices) without inlining base64.
- You MUST maintain compatibility with upstream imports by defaulting missing fields.

# Known Pitfalls & Gotchas
- **`QuotaExceededError` (Local Storage):** A common failure if attempting to sync cards to `localStorage`. `local:airi-cards` in IndexedDB is mandatory.
- **Valibot Strictness:** Ensure `looseObject()` is used where other third-party frontends (like SillyTavern) might inject unexpected keys. Use `safeParse()` in parsers to gracefully reject malformed payloads without crashing the app.
- **Concept Stack Rendering Desync:** When changing physical models (`displayModelId`), the `syncCardState` in `airi-card.ts` has guards around `isModelSyncPrevented`. Do not blindly `force` model swaps during TTS speech execution.

# Verification Steps
1. Typecheck the repository (`pnpm -F stage-ui typecheck`) after modifying `card.schema.ts` or `airi-card.ts`.
2. Generate a valid card payload using `safeParse(AiriCardSchema, myPayload)` to ensure your Valibot changes align with your TypeScript interfaces.
3. Validate PNG generation using an online CRC32 validator if making modifications to the PNG chunking logic.

## 1. Overview & Surface Map

## 2. Key Code Paths

## 3. Core SOPs & Guidelines

## 4. Known Pitfalls & Failure Modes

## 5. Verification Workflows

### Authoritative Design & Architecture Documents

- [docs/airi-card-design.md](docs/airi-card-design.md) — AIRI Package Spec v2, upstream ZIP packaging, ecosystem interoperability.
- [docs/content/en/docs/advanced/architecture/design-character-card-import-export.md](docs/content/en/docs/advanced/architecture/design-character-card-import-export.md) — Character card import/export design.
- [docs/content/en/docs/manual/config/character-card.md](docs/content/en/docs/manual/config/character-card.md) — Character card manual/config.
- [docs/content/en/docs/showcase/01-card-system.md](docs/content/en/docs/showcase/01-card-system.md) — Card system showcase.
- [docs/starter-character-gold-standard.md](docs/starter-character-gold-standard.md) — Starter character gold standard.

## Related Skills & References

- **Key Documents**: [[airi-card-design]], [[design-character-card-import-export]], [[character-card]], [[01-card-system]], [[starter-character-gold-standard]]
