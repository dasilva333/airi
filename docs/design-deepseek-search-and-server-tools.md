# Design Specification: DeepSeek Search Integration & Hosted Server-Side Tools

> **Living Architecture & Design Specification**
> * **Status:** Proposed Specification
> * **Author:** Richard Pinedo (`@dasilva333`)
> * **Date:** October 28, 2026
> * **Originating Context:** Conversation @[conversation:"DeepSeek API Server-Side Tools"] & Upstream Radar Triage
> * **Upstream References:**
>   - PR [#3156](https://github.com/moeru-ai/airi/pull/3156): `feat(stage-ui): add DeepSeek web search provider` *(Author: `@jim139129`)*
>   - PR [#3159](https://github.com/moeru-ai/airi/pull/3159): `refactor(stage-pages,stage-ui): let modules register to the settings search` *(Author: `@chiba233`)*
>   - PR [#3158](https://github.com/moeru-ai/airi/pull/3158): `fix(core-agent): remove the tool step limit` *(Counter-reference: bounded tool budgets)*
> * **Related Fork Specifications:**
>   - [`docs/design-brain-presets-and-hosted-server-tools.md`](./design-brain-presets-and-hosted-server-tools.md)
>   - [`docs/proposal-tool-call-combo-pill-and-inspection-panels.md`](./proposal-tool-call-combo-pill-and-inspection-panels.md)
>   - [`.agents/skills/airi-tool-registry-builtin-tools/SKILL.md`](../.agents/skills/airi-tool-registry-builtin-tools/SKILL.md)
>   - [`.agents/skills/airi-llm-dispatch-gateway/SKILL.md`](../.agents/skills/airi-llm-dispatch-gateway/SKILL.md)

---

## 1. Executive Summary: The Dual-Modality Paradigm

The arrival of upstream PR [#3156](https://github.com/moeru-ai/airi/pull/3156) introduces DeepSeek's Web Search API (`https://api.deepseek.com/v1/tools/search`) into the AIRI ecosystem. Simultaneously, PR [#3159](https://github.com/moeru-ai/airi/pull/3159) overhauls settings search to let module settings register dynamically with Reka-UI roving focus navigation.

However, upstream's implementation in PR #3156 is strictly **client-side tool execution**:
1. The model emits a client tool call `web_search({ query })`.
2. The client intercepts the turn, pauses generation, issues an outbound HTTP fetch to `api.deepseek.com`, parses the snippets, wraps them in `<untrusted_content>` XML fences, and sends them back in a secondary user/tool message.
3. The model processes the tool result in a second LLM request.

### The Fork's Superior Vision: The Two-Way Handshake
In `dasilva333/airi` (originally formulated in conversation @[conversation:"DeepSeek API Server-Side Tools"] and formalized in [`docs/design-brain-presets-and-hosted-server-tools.md`](./design-brain-presets-and-hosted-server-tools.md)), we take a fundamentally more elegant and token-efficient path: **The Two-Way Handshake between Character Card ACL and Brain Presets**.

```
┌────────────────────────────────────────────────────────┐
│  CHARACTER CARD ACL (CardCreationTabTools.vue)          │
│  "Is this companion permitted to browse the web?"       │
│  allowedTools: ['web_search']                          │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  BRAIN PRESET (BrainModelPicker / FavoriteModal)       │
│  "Does this active brain provide hosted server tools?" │
│  serverWebSearch: true  (Provider: OpenRouter/DeepSeek)│
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│  LLM DISPATCH GATEWAY (packages/stage-ui/src/stores/llm.ts)            │
│                                                                        │
│  [PRIMARY PATH]: Hosted Server-Side Tool Execution                     │
│  ──> Injects `{"type": "web_search"}` or `{"type": "openrouter:web_search"}`│
│      Search executes natively on provider GPU infrastructure;          │
│      zero client roundtrips; model streams grounded answer directly    │
│      with live citations.                                              │
│                                                                        │
│  [CLIENT-SIDE SCRAPING / MODE B]: PERMANENTLY REJECTED                │
│  ──> Upstream PR #3156's client-side scraping loop (fetching raw web   │
│      snippets and injecting them via a 2nd turn) is discarded as an    │
│      inefficient, token-bloating anti-pattern. If serverWebSearch is   │
│      absent or unconfigured, search is simply omitted.                 │
│                                                                        │
│  [PERSONA INVARIANT]: Web Search Disallowed                            │
│  ──> When card lacks `web_search`, all search tools are omitted.       │
└────────────────────────────────────────────────────────────────────────┘
```

By sticking to the user's core idea while adopting the modular pieces of PR #3156 and PR #3159, we obtain the best of both worlds:
- **Zero-latency server grounding** when using modern hosted APIs (DeepSeek, OpenRouter, OpenCode).
- **Graceful client-side fallback** to DeepSeek Search API (or local `open-websearch` MCP) when using local offline models.
- **Dynamic modular discovery** in settings search.

---

## 2. Comparison: Upstream PR #3156 vs. dasilva333 Two-Way Handshake

| Dimension | Upstream PR #3156 (Client-Side Only) | dasilva333 Fork Architecture (Two-Way Handshake) |
| :--- | :--- | :--- |
| **Execution Seam** | Client-side `@xsai` tool loop. | Provider server-side (Mode A) with client fallback (Mode B). |
| **Turn Latency** | 2 full LLM turns + client HTTP fetch latency. | 1 single LLM turn; search occurs in-flight on provider. |
| **Token Efficiency** | Ingests thousands of prompt tokens of scraped web markdown. | Provider compresses snippets internally; returns concise answer + citations. |
| **Character Portability** | Coupled to local settings configuration. | Character cards export cleanly (`allowedTools: ['web_search']`) across any machine. |
| **Cost / Billing** | Requires standalone search API key (Tavily/DeepSeek). | Reuses existing model inference provider credits (OpenRouter / DeepSeek API). |
| **Tool Loop Safety** | Vulnerable to infinite loops if limit removed (#3158). | Bounded by fork's `withToolStepBudget` or zero-loop server grounding. |

---

## 3. Architecture Specification

### 3.1 Mode A: Hosted Server-Side DeepSeek Tool
When the user configures a DeepSeek Brain Preset in `BrainModelFavoriteModal.vue`:
- **Provider**: `deepseek` or `openrouter`
- **Model**: `deepseek-chat`, `deepseek-reasoner`, or `deepseek/deepseek-v4.1-flash`
- **Knob**: `serverWebSearch: true`

In `packages/stage-ui/src/stores/llm.ts`:
```ts
// Gateway dispatch resolves character permission + brain preset capability
if (isWebSearchAllowed && activeFavorite?.serverWebSearch) {
  if (chatProvider.id === 'deepseek') {
    // DeepSeek native server-side search tool declaration
    sanitizedTools.push({
      type: 'web_search',
    })
  }
  else if (chatProvider.id === 'openrouter') {
    // OpenRouter hosted search tool declaration
    sanitizedTools.push({
      type: 'openrouter:web_search',
    })
  }
}
```
**Wire Effect**:
The API payload sends `tools: [{ type: "web_search" }]`. DeepSeek's server executes live web search natively before generating the reasoning/content stream. The model streams back citations in its metadata without requiring a second client prompt hop.

### 3.2 Rejection of Client-Side Scraping (PR #3156 Auto-Reject)
Upstream PR #3156 implemented DeepSeek search as a client-side tool calling `https://api.deepseek.com/v1/tools/search`, fetching markdown snippets, and stuffing them back into the LLM context.
In `dasilva333/airi`, **this client-side fallback is permanently rejected**:
- It introduces an unnecessary second LLM inference roundtrip.
- It pollutes the context window with raw scraped text.
- It is vulnerable to client timeouts and rate limits.
- Instead, search integration is **exclusively hosted server-side grounding** via the Two-Way Handshake. If a brain preset does not support server-side search, search capabilities are cleanly omitted rather than falling back to messy scraping loops.

### 3.3 Dynamic Settings Search Registration (PR #3159 Adoption)
In accordance with PR #3159, settings search registration moves away from static arrays to dynamic module hooks:
- File: `packages/stage-pages/src/pages/settings/modules/web-search.search.ts`
- Exports `searchItemRows`:
  ```ts
  export const searchItemRows: SettingsSearchItem[] = [
    {
      title: 'settings.modules.web-search.title',
      subtitle: 'settings.modules.web-search.description',
      keywords: ['web search', 'deepseek', 'tavily', 'internet', 'grounding'],
      route: '/settings/modules/web-search',
    },
  ]
  ```
- Integrates seamlessly with Reka-UI roving focus in `SettingsSearchResults.vue` (`packages/stage-shared/src/settings-search/`).

---

## 4. UI Presentation & Tool Budget Controls

### 4.1 Configurable Tool Step Limits: Shipped Reality vs. PR #3158
Upstream PR #3158 completely removed the 10-step tool limit, introducing the hazard of infinite loops and runaway billing.
In `dasilva333/airi`, this issue was **already solved and shipped**:
1. **Card Editor Tools Tab (`CardEditorForm.vue`)**:
   - Setting `generationMaxToolSteps` (`airiExt.generation.known.maxToolSteps`) is already fully wired and saved to the character card.
2. **Runtime Enforcement (`tool-call-budget.ts` & `chat.ts`)**:
   - `packages/stage-ui/src/libs/providers/tool-call-budget.ts` wraps tools with `withToolStepBudget(tools, cardMaxSteps ?? DEFAULT_MAX_TOOL_STEPS)`.
   - `packages/stage-ui/src/stores/chat.ts` already forwards `maxSteps: generationConfig?.known?.maxToolSteps` directly into generation.
   - When the limit is reached, it instructs the model:
     `Tool step limit reached (${limit} per reply). Do not call any more tools; answer the user now with what you have.`
   - This protects users against infinite tool loops without imposing an unchangeable hardcoded ceiling.

---

## 5. Phased Implementation Seams

1. **Phase 1: Two-Way Handshake Wire Injection**:
   - Implement `serverWebSearch` toggle in `BrainModelFavoriteModal.vue`.
   - Update `packages/stage-ui/src/stores/llm.ts` to inject `{ type: 'web_search' }` when `isWebSearchAllowed && activeFavorite?.serverWebSearch && provider === 'deepseek'`.
2. **Phase 2: Citation Rendering in Chat**:
   - Wire server-returned web search annotations into the Tool Call Combo Pill & Inspection Drawer.
3. **Phase 3: Settings Search Registration (from PR #3159)**:
   - Adopt dynamic module search registration for web search and brain presets with Reka-UI roving focus.
