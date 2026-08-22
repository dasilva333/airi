# Architectural Specification: Prefix Cache Alignment & Prompt Compilation Controls

This document outlines the standard for **Prefix Cache Alignment** across AIRI subsystems. It details the design of a DRY context-builder utility, global performance settings, and per-turn context overrides to minimize LLM latency/costs while maintaining fine-grained control over character memory.

---

## 1. The Core Caching Problem

For modern LLM providers supporting prefix caching (such as DeepSeek, OpenRouter, and Gemini), input prompts are cached sequentially starting from the first token.

1. **Prefix Invalidation**: Any dynamic tokens injected early in the sequence (e.g. active window titles, system load, or timestamps placed *above* the conversation history) completely invalidate the cache for everything following them.
2. **The Hard Slicing Pitfall**: Physically slicing the message array (`messages.slice(-N)`) shifts token starting indices. Even if the text of recent turns is identical, their offset in the token stream changes completely, turning a warm 98% cached request into a 100% cold cache miss.
3. **Optimized Layout & Soft Slicing (Tail Framing)**: To maximize cache reuse across different features, we must:
   - Position the static system prompt and stable conversation history at the beginning (prefix) of the input array.
   - Keep the historical message sequence intact across auxiliary loops (Proactivity, Suggestions, Journaling).
   - Constrain character attention and prevent drift through **Tail Framing Directives** (e.g., appending *"Focus your response strictly on the last $N$ dialogue exchanges above"* at the tail) rather than destroying the prefix cache via physical array truncation.

```
[System Prompt] -> [Sensor Data (Deltas)] -> [Conversation History] ❌ INVALIDATES CACHE ON EVERY HEARTBEAT
[System Prompt] -> [Sliced History (6 msgs)] -> [Instructions]      ❌ BREAKS PREFIX CACHE OF MAIN CHAT
[System Prompt] -> [Full History (Warm Cache)] -> [Tail Directive]  ✅ 100% CACHE HITS + FOCUSED ATTENTION
```

---

## 2. Subsystem Audit & Context Profiles

We have identified distinct prompt-compilation flows that build overlapping context arrays.

### A. Proactivity Heartbeat
* **Path:** [proactivity.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/proactivity.ts#L540-L602)
* **Default Context:** Historical context paired with volatile telemetry (CPU load, active windows, idle seconds).
* **Caching Strategy:** Must leverage **Global Performance Controls** directly. Volatile telemetry is appended as a suffix block at the tail after the warm conversation history.

### B. Destiny 2 Event-Driven OCR Loop
* **Path:** [proposal-destiny2-plugin.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/proposal-destiny2-plugin.md)
* **Default Context:** Tactical officer system prompts, active game state telemetry (HUD crop text recognition), and chat history.
* **Caching Strategy:** Leverages **Global Performance Controls** directly. Game telemetry crops are appended at the tail of the message array.

### C. Producer Lite (Reply Suggestion Generator)
* **Path:** [use-producer.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/composables/use-producer.ts#L151-L222)
* **Default Context:** Character system prompt, environment sensors, chat transcript, and reply generation instructions.
* **Caching Strategy:** Uses **Tail Framing (Soft Slicing)**. The full conversation history prefix remains intact for cache hits, while a tail instruction directs the model: *"Focus suggestions strictly on the last N exchanges above."*

### D. Journal Moments
* **Path:** [memory-text-journal.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/memory-text-journal.ts#L431-L501)
* **Default Context:** Active character system prompt, environmental context, and chat history.
* **Caching Strategy:** Uses **Tail Framing (Soft Slicing)** with Per-Invocation Controls. To prevent character drift without breaking the prefix cache, the full history prefix is preserved and a tail directive explicitly bounds the reflection scope (e.g. *"Reflect and journal strictly about the last N turns / recent narrative arc above; ignore earlier topics"*).

### E. VLM "Forward to LLM" Pipeline
* **Path:** [chat.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts)
* **Default Context:** When forwarding is enabled, user message history and the image are sent to the VLM to produce a description.
* **Caching Strategy:** Maintains conversation history cleanly at the prefix so that repeated images/messages with identical history maximize cache hits, while volatile prompt-shims or image directives are kept at the tail.

### F. Primary Chat Ingestion & STMM / Lifetime Grounding
* **Path:** [chat.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts) & [session-store.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/session-store.ts)
* **Decoupled Architecture:** `messages[0]` is strictly reserved for the pure, immutable character persona system prompt (`buildSystemPrompt()`), preserving a 100% frozen prefix across all auxiliary subsystems (Proactivity, Suggestions, Journaling).
* **Trailing System Stack:** Past daily continuity summaries (`[PAST CONTINUITY / DAILY SUMMARIES]`), relationship artifacts (`[LIFETIME RELATIONSHIP ARTIFACT]`), semantic RAG entries (`[GROUNDED LONG-TERM MEMORIES]`), live sensor telemetry (`[ENVIRONMENTAL AWARENESS]`), active topics (`[RECENT TOPICS]`), and director scratchpads (`[VISUAL STATE BOARD]`) are injected as dedicated trailing `role: 'system'` grounding blocks immediately before the active user prompt.
* **Attention Recency Advantage:** Placing grounding context at the tail leverages transformer attention recency to prevent memory loss in long dialogues while keeping the shared prefix completely warm.

---

## 3. Global LLM Performance Configurations

To govern default behavior for automated subsystems (Proactivity and Destiny 2) and act as a fallback for user-facing features, we introduce a global settings store: `useSettingsLlmPerformance`.

### Store Schema (`packages/stage-ui/src/stores/settings/llm-performance.ts`)
```typescript
export interface LlmPerformanceSettings {
  prefixCacheAlignment: boolean // Aligns prompt segments to maximize prefix cache hits
  softSlicingEnabled: boolean // Uses tail-framing directives instead of array-slicing to preserve prefix cache
  defaultFocusRounds: number // Default round count when framing recent focus (defaults to 6)
}
```

### Settings UI Mockup
This panel will be placed under **Settings > Behavior > LLM Performance**:
```
┌────────────────────────────────────────────────────────┐
│  LLM Performance & Cache Alignment                    │
│                                                        │
│  [X] Enable Prefix Cache Alignment                     │
│      Re-orders prompt segments (system -> history ->    │
│      telemetry/directives) to maximize cache hits.     │
│                                                        │
│  [X] Use Soft Slicing (Tail Framing)                  │
│      Preserves the full history prefix in the cache    │
│      and appends focus directives at the tail.         │
│                                                        │
│  Default Focus Scope:                                  │
│  Focus on the last [ 6  ] dialogue rounds             │
└────────────────────────────────────────────────────────┘
```

---

## 4. The Unified Prefix Builder Utility (`useContextBuilder`)

To dry up context assembly across companion subsystems and enforce cache-preserving tail framing, we define the `useContextBuilder` composable.

```typescript
import { useSettingsLlmPerformance } from '../stores/settings/llm-performance'

export interface ContextBuilderOptions {
  activeCard: any
  messages: any[]

  // Per-turn / Per-invocation Overrides:
  cacheAligned?: boolean
  softSlicing?: boolean
  focusRounds?: number

  // Telemetry & Instructions:
  injectSensors?: boolean
  instructionSuffix?: string
}

export function compileCacheAlignedPrompt(options: ContextBuilderOptions) {
  const performanceSettings = useSettingsLlmPerformance()

  // Resolve settings (use invocation overrides, fallback to global settings)
  const isCacheAligned = options.cacheAligned !== undefined
    ? options.cacheAligned
    : performanceSettings.prefixCacheAlignment

  const isSoftSlicing = options.softSlicing !== undefined
    ? options.softSlicing
    : performanceSettings.softSlicingEnabled

  const focusRounds = options.focusRounds !== undefined
    ? options.focusRounds
    : performanceSettings.defaultFocusRounds

  if (!isCacheAligned) {
    return compileFlatLegacyPrompt(options) // Fallback to unaligned layout
  }

  const systemMessages: Array<{ role: 'system', content: string }> = []

  // 1. Core System Prompt (The absolute static prefix)
  const baseSystemPrompt = buildSystemPrompt(options.activeCard)
  if (baseSystemPrompt) {
    systemMessages.push({ role: 'system', content: baseSystemPrompt })
  }

  // 2. Full Conversation History (Preserving the warm prefix cache)
  const chatMessages = options.messages.filter(m => m.role === 'user' || m.role === 'assistant')

  // Format message history without truncating prefix tokens
  const formattedHistory = chatMessages.map(m => ({
    role: m.role,
    content: extractRawText(m.rawContent || m.content),
  }))

  // 3. Volatile Sensor Payloads & Context Overlays (Tail System Message)
  const suffixDirectives: string[] = []
  if (options.injectSensors) {
    const proactivityStore = useProactivityStore()
    if (proactivityStore.sensorPayload) {
      suffixDirectives.push(`[ENVIRONMENTAL AWARENESS]\n${proactivityStore.sensorPayload}`)
    }
  }

  if (suffixDirectives.length > 0) {
    systemMessages.push({ role: 'system', content: suffixDirectives.join('\n---\n') })
  }

  // 4. User Messages & Tail Focus Framing
  const userMessages = [...formattedHistory]
  const tailInstructions: string[] = []

  // Soft Slicing: Guide model attention without breaking the prefix cache
  if (isSoftSlicing && focusRounds && focusRounds > 0 && chatMessages.length > focusRounds) {
    tailInstructions.push(`[FOCUS DIRECTIVE]: You are provided with the full dialogue history above for context continuity, but you must focus your task and reflection strictly on the last ${focusRounds} dialogue exchanges.`)
  }

  if (options.instructionSuffix) {
    tailInstructions.push(options.instructionSuffix)
  }

  if (tailInstructions.length > 0) {
    userMessages.push({ role: 'user', content: tailInstructions.join('\n\n') })
  }

  return {
    messages: [...systemMessages, ...userMessages],
  }
}
```

---

## 5. Subsystem Integration & UI Controls

### A. Proactivity Heartbeat
* **Behavior**: The proactivity loop calls `compileCacheAlignedPrompt` with `injectSensors: true`.
* **Prompt Assembly**: History prefix remains warm; telemetry data (idle time, load, window titles) is pushed to the tail.

### B. Destiny 2 OCR Plugin
* **Behavior**: The Destiny 2 OCR agent invokes the prompt builder utilizing global fallbacks.
* **Prompt Assembly**: HUD recognition details (weapon loadouts, score differentials, super status) are formatted as a tail directive after the conversation history.

### C. Producer Lite (Per-Turn Controls)
* **UI Controls**: Control toggles within the reply suggestions popover or settings sidebar.
  ```
  [Suggestions Options]
  Focus Scope:
  (o) Soft Focus on last [ 6 ] rounds (Prefix-Cache Preserved)
  ( ) Full History Context
  ```
* **Invocation**: Passes focus parameters directly to the suggestions request:
  ```typescript
  // Inside useProducer.ts
  const prompt = compileCacheAlignedPrompt({
    activeCard: activeCard.value,
    messages: options.messages,
    softSlicing: true,
    focusRounds: localFocusRounds.value,
    instructionSuffix: compiledInstructions,
  })
  ```

### D. Journal Moments (Per-Invocation Controls)
* **UI Controls**: When triggering a journal moment (e.g. from the conversation action menu), a modal or mini-overlay prompts the user to select the reflection scope:
  ```
  [Create Journal Entry]
  Choose Focus Scope:
  (o) Soft Focus on the last [ 10 ] turns (Recent Arc - Cache Preserved)
  ( ) Journal about entire chat history
  ```
* **Invocation**: Maps the selection to the invocation input for prompt generation:
  ```typescript
  // Inside memory-text-journal.ts
  async function createJournalMoment(input: {
    messages: any[]
    instructions?: string
    modelId: string
    providerId: string
    softSlicing?: boolean
    focusRounds?: number
  }) {
    // Passes overrides directly to useContextBuilder / compileCacheAlignedPrompt
  }
  ```

---

## 6. Prefix Cache Validation & Empirical Tooling

To ensure that prefix alignment remains intact across regressions and updates, the monorepo includes an empirical validator script at [`scripts/validate-prefix-cache.js`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/scripts/validate-prefix-cache.js).

### Running Cache Alignment Audits
```bash
node scripts/validate-prefix-cache.js [payloadA.json] [payloadB.json]
```

### Layer-by-Layer Verification Output
The validator decomposes prompt payloads into three distinct layers:
1. **Leading System / Persona Prefix (Index 0)**: Ensures immutable persona text matches byte-for-byte.
2. **Monotonic Dialogue Turns (Indices 1..N)**: Measures identical history turns and token reuse.
3. **Trailing Telemetry / Directives**: Confirms dynamic blocks diverge only at the tail.

---

## Relevant Skills

- [[airi-prefix-cache-alignment]]

