# Design Specification: Brain Presets & Hosted Server-Side Tools Handshake

> **Living Architecture & Design Specification**
> * **Status:** Proposed Specification
> * **Author:** Richard Pinedo (`@dasilva333`)
> * **Date:** October 27, 2026
> * **Target Systems:**
>   - `packages/stage-ui/src/components/scenarios/chat/BrainModelPicker.vue` (Pervasive Brain Switcher)
>   - `packages/stage-ui/src/components/scenarios/chat/BrainModelFavoriteModal.vue` (Preset Authoring & Advanced Options)
>   - `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabTools.vue` (Character Tool ACL)
>   - `packages/stage-ui/src/stores/llm.ts` (Gateway Filtering, Server-Tool Injection, Fallbacks)
>   - `packages/stage-ui/src/stores/chat.ts` (Turn Execution & Options Propagation)

---

## 1. Executive Summary & Problem Definition

### 1.1 The Pervasive Brain Switcher
In AIRI, `BrainModelPicker.vue` has grown into the canonical model and provider selector across nearly every interaction surface:
* Desktop Chat Popover (`ChatBrainPopover.vue`)
* Mobile Top Header (`MobileHeader.vue`)
* Character Card Generation Tab (`CardCreationTabGeneration.vue`)
* Guided Card Creation Wizard (`guided.vue`)
* Discord Bot Control Plane (`MessagingDiscord.vue`)
* Acting & Calibration Studios (`EmotionCalibrationStudio.vue`)

Through `BrainModelFavoriteModal.vue`, users can save and curate **Brain Presets** (`FavoriteModel`), bundling:
1. A friendly display name / label (e.g., `DeepSeek Flash 1017 [Research]`).
2. A provider ID (e.g., `openrouter`, `opencode-go`, `deepseek`).
3. A model slug (e.g., `deepseek/deepseek-v4.1-flash`).
4. An **Advanced JSON Options** payload (handling provider-specific knobs like `thinking`, `reasoningEffort`, `temperature`, `max_tokens`, etc.).

### 1.2 The Dilemma: Hosted Server-Side Tools vs. Character-Centric ACL
AI providers have introduced native, **hosted server-side tools** (such as OpenRouter's `openrouter:web_search` and `openrouter:web_fetch`, DeepSeek's native Search/Fetch endpoints, and Anthropic's `web_search_20260209`). These execute on the provider's remote servers and return processed results and citations directly to the model with zero client-side execution loops.

However, AIRI's tool permission system (ACL) is strictly **character-centric**:
* The Character Card editor (`CardCreationTabTools.vue`) gates tools via `extensions.airi.generation.known.allowedTools` (`web_search`, `bash`, `filesystem`, `text_journal`, `image_journal`).
* When `web_search` is enabled on a card, AIRI provisions a local, 0-key Model Context Protocol (MCP) server: `open-websearch` (`npx -y open-websearch@latest`).

**The Failure Mode:**
If a character switches models mid-session:
1. **Incompatible Payloads**: Sending a server-side tool declaration like `{"type": "openrouter:web_search"}` to an Ollama instance, local WebLLM, or Apple Core AI causes an **HTTP 400 Bad Request**.
2. **Compatibility Cache Bricking**: In `packages/stage-ui/src/stores/llm.ts`, any HTTP 400 matching `TOOLS_RELATED_ERROR_PATTERNS` permanently flips `toolsCompatibility[key] = false`, silently stripping all tool capabilities for that model until the user clears localStorage.
3. **Billing Transparency**: Server-side searches consume paid provider credits ($0.75 per 1,000 requests on DeepSeek or OpenRouter search credits), whereas local MCP search is free. A global provider toggle is too coarse because a single provider hosts both search-capable and non-search models.

---

## 2. The Core Architecture: The Two-Way Handshake

To achieve seamless portability, safety, and model flexibility, AIRI adopts a **Two-Way Handshake** between the **Character Card (Permission Gate)** and the **Brain Preset (Capability Engine)**.

```
┌────────────────────────────────────────────────────────┐
│  CHARACTER CARD ACL (CardCreationTabTools.vue)          │
│  "Is this companion permitted to browse the web?"       │
│  allowedTools: ['web_search']                          │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  BRAIN PRESET (BrainModelFavoriteModal.vue)            │
│  "Does this active preset provide hosted server tools?"│
│  serverWebSearch: true  (Provider: OpenRouter/DeepSeek)│
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│  LLM DISPATCH GATEWAY (packages/stage-ui/src/stores/llm.ts)            │
│                                                                        │
│  Case 1: Card allows web_search  AND  Brain Preset has serverWebSearch │
│  ──> Inject remote hosted tool (e.g. `openrouter:web_search`)          │
│      Model executes search upstream; returns final text + citations.  │
│                                                                        │
│  Case 2: Card allows web_search  BUT  Brain Preset lacks server tool   │
│  ──> Fall back to local `open-websearch` MCP server (free DuckDuckGo). │
│      Client executes tool locally via Electron/Node runtime.           │
│                                                                        │
│  Case 3: Card disallows web_search                                     │
│  ──> Omit all web tools (persona boundaries preserved).                │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Why the Handshake Succeeds
1. **Character Portability**: A character card can be exported, shared, and imported across any user's machine without hardcoding provider-specific tool schemas or API details.
2. **Persona Safety**: A fantasy or offline character who must not access the internet has `web_search` unchecked; even if the user selects a web-enabled brain preset, no web tools are exposed.
3. **Graceful Fallback**: If a user switches from DeepSeek Flash to a local offline model (e.g. Ollama or Apple Core AI), the companion does not crash; it smoothly degrades to local MCP search or unassisted reasoning.

---

## 3. Data Model Specifications

### 3.1 `FavoriteModel` Schema Extension
In `packages/stage-ui/src/components/scenarios/chat/BrainModelFavoriteModal.vue`:

```ts
export interface FavoriteModel {
  id: string
  name: string
  provider: string
  model: string
  /**
   * Whether this brain configuration enables hosted, server-side web search.
   * When true, the gateway injects provider-specific server search schemas.
   */
  serverWebSearch?: boolean
  /**
   * Arbitrary provider-level parameters merged into requestOverrides.
   * Examples: reasoningEffort, thinking, plugins, contextWidth.
   */
  options?: Record<string, unknown>
}
```

### 3.2 Provider-Specific Server Tool Map
The LLM gateway maps `serverWebSearch` to the correct upstream wire format based on the active provider:

| Provider Type | Endpoint Type | Wire Tool Declaration |
| :--- | :--- | :--- |
| **OpenRouter** | OpenAI `/chat/completions` | `{"type": "openrouter:web_search"}` |
| **OpenCode Go** | Anthropic `/messages` | `{"type": "web_search_20260209", "name": "web_search"}` |
| **DeepSeek Native** | OpenAI `/chat/completions` | `{"type": "web_search"}` |
| **DeepSeek Anthropic** | Anthropic `/messages` | `{"type": "web_search_20260209", "name": "web_search"}` |
| **OpenAI Direct** | OpenAI `/chat/completions` | `{"type": "web_search_preview"}` |

---

## 4. User Interface Architecture

### 4.1 `BrainModelFavoriteModal.vue`
1. **Hosted Search Checkbox**:
   Rendered below the Model selection field:
   ```html
   <div class="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
     <FieldCheckbox v-model="serverWebSearch" />
     <div class="flex flex-col">
       <span class="text-xs font-semibold text-neutral-800 dark:text-neutral-100">
         Enable Hosted Web Search
       </span>
       <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
         Allows this brain to search the web server-side via provider infrastructure (e.g. OpenRouter or DeepSeek). Subject to provider request billing.
       </span>
     </div>
   </div>
   ```

2. **Advanced JSON Presets**:
   In `PRESET_GROUPS`, add a dedicated group for **Hosted Server Tools**:
   ```ts
   {
     group: 'HOSTED TOOLS',
     items: [
       {
         title: 'OpenRouter Web Search',
         subtitle: 'tools: openrouter:web_search',
         payload: {
           tools: [{ type: 'openrouter:web_search' }],
         },
       },
       {
         title: 'OpenRouter Web Fetch',
         subtitle: 'tools: openrouter:web_fetch',
         payload: {
           tools: [{ type: 'openrouter:web_fetch' }],
         },
       },
       {
         title: 'Anthropic / OpenCode Web Search',
         subtitle: 'tools: web_search_20260209',
         payload: {
           tools: [{ type: 'web_search_20260209', name: 'web_search' }],
         },
       },
     ],
   }
   ```

### 4.2 `BrainModelPicker.vue`
When the user selects an active preset (`handleSelectFavorite`):
* `activeProvider.value = fav.provider`
* `activeModel.value = fav.model`
* The active preset's `serverWebSearch` and `options` are synchronized to `consciousnessStore` so `chat.ts` can forward them into `llmStore.stream()`.

---

## 5. Gateway Dispatch Execution (`packages/stage-ui/src/stores/llm.ts`)

### 5.1 Tool Resolution Logic
When compiling tools in `streamFrom`:

```ts
// 1. Resolve character permission
const isWebSearchAllowed = allowedTools?.includes('web_search') || allowedTools?.includes('mcp_web_search')

// 2. Resolve brain capability
const activeFavorite = favorites.find(f => f.provider === chatProvider.id && f.model === model)
const hasServerSearch = activeFavorite?.serverWebSearch || activeFavorite?.options?.tools?.some((t: any) => t.type?.includes('web_search'))

if (isWebSearchAllowed) {
  if (hasServerSearch && chatProvider.id === 'openrouter') {
    // Inject server-side tool; strip local MCP search to avoid redundant tools
    sanitizedTools.push({ type: 'openrouter:web_search' })
  }
  else if (hasServerSearch && chatProvider.id === 'opencode-go') {
    sanitizedTools.push({ type: 'web_search_20260209', name: 'web_search' })
  }
  else {
    // Retain standard local MCP web_search
  }
}
```

### 5.2 Server-Side Execution Handling in `@xsai`
* Hosted server tools do not have a client-side `execute()` callback.
* When the remote provider executes the search, it does not send back an intermediate `tool_call` turn; it synthesizes the final answer directly and returns structured source metadata (`annotations`, `url_citation`, or `web_search_tool_result`).
* The chat store captures these citations and displays them in the chat interface via the Tool Call Combo Pill & Inspection Drawer (`docs/proposal-tool-call-combo-pill-and-inspection-panels.md`).

---

## 6. Implementation Roadmap

1. **Phase 1: Brain Model Preset Schema & UI**:
   - Update `FavoriteModel` interface with `serverWebSearch?: boolean`.
   - Add the hosted search toggle and preset entries into `BrainModelFavoriteModal.vue`.
   - Propagate active favorite metadata in `BrainModelPicker.vue`.
2. **Phase 2: LLM Gateway Handshake**:
   - Update `packages/stage-ui/src/stores/llm.ts` to recognize hosted tool configurations.
   - Implement the fallback logic between hosted tools and local `open-websearch` MCP.
3. **Phase 3: Citation & Tool Pill Presentation**:
   - Ensure server-emitted citations (`annotations` / `web_search_result`) route seamlessly into the chat transcript chips.
