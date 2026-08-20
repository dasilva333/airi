# Settings Navigation Revamp & Deep Search Specification

This document outlines the proposal, architecture, deep index mapping, and UI design for the Settings Navigation Revamp in `stage-pages` and `stage-ui`.

---

## Executive Summary

Navigating settings in AIRI currently requires users to memorize deep breadcrumbs to reach frequently used configuration surfaces (e.g. `Settings > Providers > Speech > Kokoro`, `Settings > System > User Profile`, `Settings > Models > Model Selector > Explore`).

This proposal introduces two complementary features at the top of the Settings root page (`packages/stage-pages/src/pages/settings/index.vue`):

1. **Curated Deep Quick-Access Bar**: Directly targets deep, high-value configuration destinations rather than redundant top-level links.
2. **Comprehensive Settings Deep-Search**: A fast, autocomplete-driven search bar (`CMD+K` / Spotlight style) indexing all deep pages, sub-tabs, specific provider settings, and common keywords with instant navigation (`router.push`).

---

## 1. Curated Deep Quick-Access Bar

### Design Philosophy
* **Zero Redundancy**: Never link to top-level sections that are already visible 1 click away on the root settings list (e.g. `AIRI Card`, `Models`).
* **Deep Precision**: Link directly to the exact nested configuration surface users frequently ask for.

### Initial Curated Quick Links

| # | Quick Target | Deep Destination | Description / Target surface |
| :--- | :--- | :--- | :--- |
| 1 | **User Profile** | `/settings/system#user-profile` | First-class connection & user profile configuration |
| 2 | **Kokoro Speech Engine** | `/settings/providers?type=speech&provider=kokoro-local` | Local TTS voice synthesis settings & model weights |
| 3 | **Local Whisper STT** | `/settings/providers?type=transcription&provider=whisper-local` | App-local Speech-to-Text transcription model |
| 4 | **Explore Model Catalog** | `/settings/models?action=explore` | Open Model Selector dialog on the **Explore** tab to discover new 2D/3D avatars |
| 5 | **Discord Bot Integration** | `/settings/modules?tab=discord` | Discord bot connection, channel bindings, and relay controls |

---

## 2. Comprehensive Settings Search Index

### Indexing Architecture & Deep Routing
The search index cuts out filler keywords and maps directly to real routes, dynamic store entries (e.g. character names), sub-tabs, dialog tabs, and system section anchors.

```typescript
export interface SettingsSearchEntry {
  id: string
  title: string
  category: string
  description?: string
  to: string
  icon?: string
}
```

### Complete Page-by-Page Nesting & Index Rules

#### 1. Level-1 Primary Pages
Allows skipping manual scrolling directly to any main section:
* **AIRI Card** $\rightarrow$ `/settings/airi-card`
* **Scenes** $\rightarrow$ `/settings/scene`
* **Models** $\rightarrow$ `/settings/models`
* **Memory** $\rightarrow$ `/settings/memory`
* **Dating Sim** $\rightarrow$ `/settings/dating-sim`
* **Modules** $\rightarrow$ `/settings/modules`
* **Providers** $\rightarrow$ `/settings/providers`
* **System** $\rightarrow$ `/settings/system`
* **Data** $\rightarrow$ `/settings/data`
* **Docs** $\rightarrow$ `/settings/docs`

#### 2. Detailed Level-2 & Dynamic Character Breakdown

##### A. AIRI Cards (Dynamic Character Indexing)
* **Dynamic Character Cards**: Queries active character cards from `cardStore`.
* Typing any character's name (e.g. `Juewa`, `Airi`, `Neko`) opens that specific character card directly in the editor:
  * `/settings/airi-card?cardId={id}`

##### B. Scenes
* Root page only (`/settings/scene`). No additional sub-nesting required.

##### C. Models (Model Selector Dialog Shortcuts)
Direct shortcuts to the 3 main Model Selector tabs (skipping 3 clicks):
* **Browse Models (Local Catalog)** $\rightarrow$ `/settings/models?action=browse`
* **Cloud Models** $\rightarrow$ `/settings/models?action=cloud`
* **Explore Model Catalog** $\rightarrow$ `/settings/models?action=explore`

##### D. Memory (4 Legitimate Sub-Pages)
Index each of the 4 nested memory product surfaces:
* **Short-Term Awareness (`stmm`)** $\rightarrow$ `/settings/memory/stmm`
* **Long-Term Knowledge (`ltmm`)** $\rightarrow$ `/settings/memory/ltmm`
* **Lifetime Relational Bonds (`lifetime`)** $\rightarrow$ `/settings/memory/lifetime`
* **Cognitive Memory & Dreaming Chips** $\rightarrow$ `/settings/memory/dreaming`

##### E. Dating Sim
* Root page only (`/settings/dating-sim`). No additional sub-nesting required.

##### F. Modules (Direct Integration Tabs)
Queries active modules and jumps directly to their specific route/tab:
* **Discord Bot Integration** $\rightarrow$ `/settings/modules?tab=discord`
* **MCP Server & Plugins** $\rightarrow$ `/settings/modules?tab=mcp`
* **CloudSync Backup** $\rightarrow$ `/settings/modules?tab=cloudsync`
* **Vision Processing** $\rightarrow$ `/settings/modules?tab=vision`
* **Hearing & Audio Pipelines** $\rightarrow$ `/settings/modules?tab=hearing`

##### G. Providers (3-Tier Categorized Index)
Indexed by provider category (`Speech`, `Transcription`, `LLM`, `Vision`, `Artistry`) + specific provider ID:
* **Speech (TTS)**:
  * `Kokoro Local Engine` $\rightarrow$ `/settings/providers?type=speech&provider=kokoro-local`
  * `Deepgram Aura-2` $\rightarrow$ `/settings/providers?type=speech&provider=deepgram-tts`
  * `Amazon Polly` $\rightarrow$ `/settings/providers?type=speech&provider=aws-polly-tts`
* **Transcription (STT)**:
  * `App Local Whisper` $\rightarrow$ `/settings/providers?type=transcription&provider=whisper-local`
  * `Groq Cloud Whisper` $\rightarrow$ `/settings/providers?type=transcription&provider=groq-stt`
* **LLM Consciousness**:
  * `Ollama Local` $\rightarrow$ `/settings/providers?type=llm&provider=ollama`
  * `OpenAI GPT` $\rightarrow$ `/settings/providers?type=llm&provider=openai`

##### H. System (8 First-Class Sub-Menu Section Anchors)
Index each of System's 8 distinct sub-menus directly:
1. **User Profile & Connection** $\rightarrow$ `/settings/system#user-profile` *(High-priority shortcut)*
2. **Display & Aesthetics** $\rightarrow$ `/settings/system#display`
3. **Windowing & Stage** $\rightarrow$ `/settings/system#windowing`
4. **Language & Locale** $\rightarrow$ `/settings/system#language`
5. **Sound & Audio Pipeline** $\rightarrow$ `/settings/system#audio`
6. **Hotkeys & Controls** $\rightarrow$ `/settings/system#hotkeys`
7. **Updates & Release Channel** $\rightarrow$ `/settings/system#updates`
8. **Advanced Diagnostics** $\rightarrow$ `/settings/system#advanced`

##### I. Documentation & Data
* Root pages only (`/settings/docs`, `/settings/data`). No additional sub-nesting required.

---

## 3. UI Layout & Architecture

### Layout Structure (`/settings/index.vue`)

1. **Header & Search Bar Block**:
   * Search Input with magnifying glass icon and keyboard shortcut badge (`⌘K`).
   * Real-time autocomplete dropdown overlay with keyboard navigation (`Up`/`Down`/`Enter`/`Esc`).

2. **Curated Deep Quick-Access Row**:
   * Compact, sleek action chips/cards for the top 5 deep targets:
     - User Profile
     - Kokoro Speech
     - Local Whisper
     - Explore Catalog
     - Discord Integration

3. **Grouped Settings List**:
   * Existing `CHARACTER & SCENE`, `INTELLIGENCE`, `SYSTEM` sections below.

---

## 4. Verification Plan

* **Search Responsiveness**: Instant filtering as user types, with fallback to empty state prompt if no matches.
* **Deep Navigation**: Verifying `router.push` correctly opens target sub-pages, tabs, and modals (e.g. opening `model-selector` directly to `explore` tab).
* **Keyboard Navigation**: `⌘K` opens/focuses search; arrow keys cycle results; `Enter` navigates.

## Relevant Skills

- [[airi-provider-ui-pages]]
