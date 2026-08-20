# Design Document: Multi-Instance Provider Architecture & Low-Friction Provider Studio UX

**Status:** Proposed Design / Phase 2 Blueprint
**Target Pages:** `packages/stage-pages/src/pages/settings/providers/` & `packages/stage-ui/src/stores/providers/`
**Related Docs:**
- [`project-provider-store-restructuring-plan.md`](./project-provider-store-restructuring-plan.md) — Phase 1 provider store metadata extraction.
- [`project-provider-store-phase1-handoff.md`](./project-provider-store-phase1-handoff.md) — Active Phase 1 execution handoff.
- [`project-provider-metadata-catalog.md`](./project-provider-metadata-catalog.md) — Canonical catalog of provider descriptions, pricing, and links.

---

## 1. Problem Statement & UX Pain Points

AIRI's current Provider Management UX has several architectural and usability bottlenecks:

### 1.1 The "Single-Slot Constraint"
Currently, users are restricted to a single configuration slot per provider type. For example:
- Users with multiple local/remote endpoints (e.g. `Ollama` on desktop vs. `Ollama` on home GPU server, or multiple `vLLM` endpoints) must constantly overwrite their credentials.
- Users resort to abusing the built-in `openai` entry to point to secondary custom OpenAI-compatible endpoints.
- Community users frequently request the ability to register multiple endpoints of the same provider type.

### 1.2 Unfriendly Configuration UI Friction
As observed in the current provider settings UI:
- **Accidental Resets**: A bare refresh icon (`i-lucide:rotate-ccw`) sits in the card corner and wipes credentials without confirmation.
- **Mismatched Field Priorities**: Local providers (e.g., LM Studio, Ollama) hide their most critical setting (`Base URL`) inside an "Advanced" accordion while prioritizing an irrelevant `API Key` input.
- **No Direct Console Links**: Users must leave AIRI and search Google to find where to generate API keys, despite AIRI having metadata URLs.
- **Page Context Disruption**: Checking available models requires clicking **[Select Model →]**, navigating away to `ModelCacheManager.vue`.
- **Footgun Settings without Guardrails**: Toggles like "Use Custom SSML" in speech playgrounds lack warning text, leading users to accidentally enable raw SSML mode and get corrupted/robotic audio output.

---

## 2. Architectural Solution: Multi-Instance Provider Registry

Building upon the Phase 1 dynamic registry composition (`createProviderRegistry`), AIRI introduces **Multi-Instance Provider Duplication**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🦙 Ollama Instances                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🟢 Instance 1: Local Mac (Default)           [http://localhost:11434]  [Edit]│
│ 🟢 Instance 2: Workstation GPU Rig           [http://192.168.1.100]    [Edit]│
│                                                                             │
│ [+ Add Another Instance]                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 State Representation (`useProvidersStore`)
Persisted state transitions from a static key-value dictionary to support array-backed instances per provider family:

```typescript
interface ProviderInstanceConfig {
  instanceId: string // e.g. "ollama:local-mac" or "openai-compatible:vast-ai"
  providerId: string // Parent provider template (e.g. "ollama", "openai-compatible")
  label: string // User-defined display label (e.g. "Workstation GPU Rig")
  options: Record<string, unknown> // Persisted API keys, base URLs, model defaults
}
```

### 2.2 Dynamic Registry Ingestion
During `createProviderRegistry(t)`, the engine iterates over user-defined `ProviderInstanceConfig` entries and generates dynamic `ProviderMetadata` objects for each instance:

```typescript
// Example: Registers "ollama:workstation" as a standalone selectable provider
resolvedMetadata['ollama:workstation'] = buildProviderInstance(parentDefinition, instanceConfig)
```

- **`isConfigured` Redefinition**: `isConfigured` transitions from a binary key-check to evaluating `instances.length > 0`.
- **Dropdown Integration**: UI selectors cleanly display `Parent Provider (Instance Label) / Model Name`.

---

## 3. Redesigned Low-Friction Provider Studio Layout

The provider settings layout adopts a responsive **2-Column Split / 1-Column Responsive Grid** that preserves split playgrounds while modernizing the configuration panel.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔑 Deepgram User Configuration                  [ 🌐 console.deepgram.com ↗ ]│
│ Ultra-fast, high-accuracy real-time transcription & Aura TTS                │
├─────────────────────────────────────────────┬───────────────────────────────┤
│ Left Column: Configuration & Instances      │ Right Column: Voice Playground│
│                                             │                               │
│ ┌─────────────────────────────────────────┐ │ 🎙️ Interactive Playground     │
│ │ Managed Instances                       │ │                               │
│ │ 🟢 Primary Key (Default)       [Edit]   │ │ Text input: [Hello world...]  │
│ └─────────────────────────────────────────┘ │                               │
│                                             │ Voice: [ agathe ▾ ]           │
│ [+ Add Instance]                            │                               │
│                                             │ [🔊 Test Voice]               │
│ ┌─────────────────────────────────────────┐ │                               │
│ │ API Key: [ sk-deepgram-...            ] │ │ ⚠️ Custom SSML Mode           │
│ │ Base URL (Optional): [ https://...    ] │ │ Enable only if sending raw    │
│ └─────────────────────────────────────────┘ │ W3C SSML XML blocks.          │
│                                             │ Defaults to plain text.       │
│ [Delete Credentials] (Red Danger Zone)      │                               │
└─────────────────────────────────────────────┴───────────────────────────────┘
```

### 3.1 Key UX Upgrades

1. **Smart Field Prioritization**:
   - **Cloud Providers** (OpenAI, Deepgram, ElevenLabs): **API Key** is primary; direct **[Get API Key ↗]** external link header.
   - **Local Providers** (LM Studio, Ollama, ComfyUI): **Base URL** is primary; API Key marked optional.
2. **In-Page Model Browser**:
   - Fetches and displays available models directly inside the provider panel with a live search filter. Eliminates context switching to `ModelCacheManager`.
3. **Explicit Danger Zone**:
   - Replaces the accidental single-click refresh icon with an explicit, bottom-anchored `[Delete Credentials]` button with confirmation modal.
4. **Playground Guardrails**:
   - Adds clear inline warning badges to risky toggles (e.g. SSML): *"⚠️ Enable only if sending raw W3C SSML tags. Plain text input will sound distorted if SSML mode is active."*
5. **Responsive Layout Grid**:
   - Maintains the popular 2-column layout (Configuration on Left, Interactive Playground/Monitor on Right) on widescreen monitors, automatically collapsing to a single column on portrait/mobile viewports.

---

## 4. Implementation Phasing

1. **Phase 1 (Current Handoff)**: Complete structural extraction of `providers.ts` metadata into `registry/speech.ts`, `registry/transcription.ts`, and `registry/local-engines.ts`.
2. **Phase 2 (Multi-Instance Engine & Store Update)**: Extend `useProvidersStore` to manage `ProviderInstanceConfig[]` and inject multi-instance cards into `createProviderRegistry`.
3. **Phase 3 (Provider Studio UI Overhaul)**: Update shared provider setting layout components (`packages/stage-pages/src/pages/settings/providers/components/`) with smart field prioritization, direct console links, embedded model lists, and SSML guardrails.

## Relevant Skills

- [[airi-provider-core-registry]]
- [[airi-provider-store-instances]]
- [[airi-provider-ui-pages]]
