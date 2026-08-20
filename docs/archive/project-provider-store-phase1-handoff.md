# Handoff Specification: Phase 1 Safe Restructuring of `providers.ts`

**Status:** Handoff Spec for Research/Engineering Subagent
**Target File:** `packages/stage-ui/src/stores/providers.ts` (~3.9k lines)
**Target Output Directory:** `packages/stage-ui/src/stores/providers/`
**Goal:** Extract legacy inline provider metadata declarations and registry composition out of `providers.ts` into modular, typed files under `providers/registry/`, with **zero changes to runtime store behavior**.

---

## 1. Executive Summary & Objective

`packages/stage-ui/src/stores/providers.ts` is a monolithic file containing over 3,900 lines of code. It currently mixes:
1. Reactive Pinia store state and selectors.
2. Validation side effects (Electron IPC, toast notifications).
3. Instance lifecycle & caching logic.
4. **Massive inline hand-written metadata declarations** for Speech (TTS) and Transcription (STT) providers.

### **The Phase 1 Mission**
Perform a **safe structural extraction** of provider metadata definitions. Move all inline metadata declarations out of `providers.ts` into dedicated, domain-focused registry files (`speech.ts`, `transcription.ts`, etc.) under `packages/stage-ui/src/stores/providers/registry/`.

### **Strict Non-Goals (DO NOT TOUCH)**
* ❌ Do NOT rewrite validation logic, IPC calls, or toast notifications.
* ❌ Do NOT alter `useProvidersStore` public API signatures or Pinia state definitions.
* ❌ Do NOT change provider model loading, instance caching, or disposal logic.
* ❌ Do NOT alter consumer code outside of `packages/stage-ui/src/stores/providers/`.

---

## 2. Directory Layout & Target Structure

The groundwork for Phase 1 is already in place:
- `packages/stage-ui/src/stores/providers/types.ts` (shared interfaces)
- `packages/stage-ui/src/stores/providers/helpers.ts` (helper utilities)
- `packages/stage-ui/src/stores/providers/registry/index.ts` (registry composition entry point)

### Target Files to Create in `packages/stage-ui/src/stores/providers/registry/`:

```
packages/stage-ui/src/stores/providers/registry/
├── index.ts               ← Composes all registries (speech, transcription, defined providers)
├── speech.ts              ← Hand-written TTS provider metadata declarations
├── transcription.ts       ← Hand-written STT provider metadata declarations
└── legacy-bridge.ts       ← Special local adapters (web-rwkv, blip-local, kokoro-local)
```

---

## 3. Metadata Standard & Metadata Catalog Rules

When extracting provider declarations into `speech.ts` and `transcription.ts`, ensure every metadata entry explicitly conforms to the canonical `ProviderMetadata` interface and populates standard catalog properties:

### Standard Provider Properties
- `id`: Unique string identifier (e.g., `kokoro-local`, `deepgram-tts`, `openai-audio-transcription`).
- `category`: `'speech'` | `'transcription'`.
- `tasks`: `['text-to-speech']` or `['audio-transcription']`.
- `pricing`: `'free'` | `'paid'`.
- `deployment`: `'local'` | `'cloud'`.
- `description`: Crisp UI subtext / pitch string (e.g. `"**Native AI** - Lightning-fast local text-to-speech using Kokoro-82M"`).

---

## 4. Execution Step-by-Step

### Step 1: Create `registry/speech.ts`
Extract all inline `category: 'speech'` provider metadata definitions from `providers.ts` (e.g., `kokoro-local`, `openai-audio-speech`, `elevenlabs`, `chatterbox`, `deepgram-tts`, `microsoft-speech`, `volcengine`, `alibab-cloud-model-studio`, etc.).

### Step 2: Create `registry/transcription.ts`
Extract all inline `category: 'transcription'` provider metadata definitions from `providers.ts` (e.g., `app-local-audio-transcription`, `browser-local-audio-transcription`, `deepgram-transcription`, `openai-audio-transcription`, `aliyun-nls-transcription`, `xai-audio-transcription`, etc.).

### Step 3: Update `registry/index.ts`
Wire `createProviderRegistry(t, currentMetadata)` to compose the extracted `speechMetadata` and `transcriptionMetadata` maps together with `libs/providers` definitions cleanly.

### Step 4: Refactor `providers.ts`
Replace inline metadata dictionary declarations in `providers.ts` with calls to `createProviderRegistry(t)`. `providers.ts` should decrease in size from ~3.9k lines down to ~1.2k lines.

---

## 5. Verification Command

After completing the extraction, run workspace typecheck to verify zero broken imports or type mismatches:
```bash
pnpm -F @proj-airi/stage-ui typecheck
```

## Relevant Skills

- [[airi-provider-store-instances]]
