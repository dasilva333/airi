Now I have the complete chain. Here is the full trace.

---

## Complete Flow: Magic Wand Button to Producer Suggestion Generation

### File Index (All 8 Files in the Chain)

| # | File | Role |
|---|------|------|
| 1 | `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` | Main chat UI: composer, wand button, modal wiring, submit handler |
| 2 | `packages/stage-ui/src/components/scenarios/chat/ProducerGuidanceModal.vue` | Modal dialog: guidance textarea, config sliders/checkboxes, emits `submit` |
| 3 | `packages/stage-ui/src/composables/use-producer.ts` | `generateSuggestions()` — compiles prompt, calls LLM for structured output |
| 4 | `packages/stage-ui/src/stores/llm.ts` | `generateObject()` — wraps stage-shared LLM call |
| 5 | `packages/stage-shared/src/llm/structured-output.ts` | `generateObject()` — actual `generateText` API call with JSON repair |
| 6 | `packages/stage-ui/src/components/scenarios/chat/ProducerChoiceBubble.vue` | Renders the generated choices; emits `choose`/`retry`/`delete` back up |
| 7 | `packages/stage-ui/src/components/scenarios/chat/history.vue` (`ChatHistory`) | Message list renderer; bridges `ProducerChoiceBubble` events to `InteractiveArea` |
| 8 | `packages/stage-ui/src/composables/use-chat-composer.ts` | Alternate chat-composer composable (used elsewhere, not in this exact flow) |

---

### Step-by-Step Chain

#### **1. The Composer: Textarea + Magic Wand Button**

**File:** `/Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue`

- **Textarea** — line **1069-1084**:
  ```html
  <BasicTextarea
    v-model="messageInput"
    ...
    @submit="handleSend"
  />
  ```
  Uses `BasicTextarea` from `@proj-airi/ui` (line 32 import). The `v-model` binds to `messageInput` ref (line 41).

- **Magic Wand Button** — lines **1092-1099**:
  ```html
  <!-- Suggest Response (Producer Sparkle) Inline Button -->
  <button
    class="h-8 w-8 ..."
    title="Suggest responses"
    @click="isProducerModalOpen = true"
  >
    <div class="i-solar:magic-stick-3-bold-duotone text-base" />
  </button>
  ```
  The icon is `i-solar:magic-stick-3-bold-duotone` — a "magic stick" with sparkles.
  **Click handler:** simply sets `isProducerModalOpen = true` (line 1096). This is a `ref<boolean>` defined at line 311.

- **Send/Greet button** — lines 1101-1108, next to the wand button:
  ```html
  <button @click="handleSend">
    <div :class="[isGreetMode ? 'i-ph:hand-waving-bold' : 'i-solar:plain-2-bold-duotone', 'text-base']" />
  </button>
  ```

---

#### **2. ProducerGuidanceModal Wiring**

**File:** Same `InteractiveArea.vue`

- Lines **1316-1321**:
  ```html
  <ProducerGuidanceModal
    v-model="isProducerModalOpen"
    :character-name="characterName"
    @submit="handleProducerSubmit"
  />
  ```
  The `v-model` two-way binds `isProducerModalOpen` (the ref set by the wand button). The `@submit` event is handled by `handleProducerSubmit`.

**No intermediary** — the wand button opens the modal directly, and the modal emits `submit` directly back to `handleProducerSubmit`.

---

#### **3. ProducerGuidanceModal internals**

**File:** `/Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/ProducerGuidanceModal.vue`

- **Props:** `modelValue: boolean`, `characterName: string` (lines 9-12)
- **Emits:** `update:modelValue` and `submit` (lines 14-17):
  ```ts
  (e: 'submit', payload: { guidance: string, contextDepth: number, count: number, shortReplies: boolean }): void
  ```
- **Guidance textarea** — lines 120-127 (`v-model="guidance"`)
- **Config controls** — `contextDepth` slider (line 161), `suggestionCount` slider (line 184), `shortReplies` checkbox (line 199), `autoSend` checkbox (line 212), `autoPlayAll` checkbox (line 224), `cacheAligned` checkbox (line 238). All backed by `useLocalStorage` refs (lines 22-30).
- **Generate button** — lines 288-293 ("Inspire me"):
  ```html
  <button @click="handleGenerate">Inspire me</button>
  ```
- **`handleGenerate()`** — lines 59-67:
  ```ts
  function handleGenerate() {
    emit('submit', {
      guidance: guidance.value.trim(),
      contextDepth: contextDepth.value,
      count: suggestionCount.value,
      shortReplies: shortReplies.value,
    })
    close() // calls emit('update:modelValue', false)
  }
  ```
  Emits the config payload upward and closes the modal.

---

#### **4. handleProducerSubmit — the bridge**

**File:** `InteractiveArea.vue`, lines 316-346

```ts
async function handleProducerSubmit(payload: { guidance: string, contextDepth: number, count: number, shortReplies: boolean }) {
  lastProducerConfig.value = payload // save for retry
  producerSuggestion.value = { // optimistic placeholder in chat history
    type: 'producer-suggestion',
    choices: [],
    loading: true,
    createdAt: Date.now(),
  }

  try {
    const choices = await generateSuggestions({
      characterName: characterName.value,
      messages: messages.value as unknown as ChatHistoryItem[],
      guidance: payload.guidance,
      contextDepth: payload.contextDepth,
      count: payload.count,
      shortReplies: payload.shortReplies,
    })

    producerSuggestion.value = {
      type: 'producer-suggestion',
      choices,
      loading: false,
      createdAt: Date.now(),
    }
  }
  catch (err) {
    producerSuggestion.value = null
    toast.error('Failed to generate suggestions. Please check your provider settings.')
  }
}
```

Key points:
- `generateSuggestions` is destructured from `useProducer()` at line 313.
- The result `choices` (an `Array<{title, message}>`) is stored in `producerSuggestion.value` which is rendered in `ChatHistory` via `historyMessages` computed (lines 616-622).
- On failure, `producerSuggestion` is nulled and a toast is shown.

---

#### **5. useProducer.generateSuggestions — the core engine**

**File:** `/Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/composables/use-producer.ts`

- **`useProducer()` export** — line 105
- **`generateSuggestions()`** — lines 117-276:

  **Flow:**
  1. Resolve `activeProvider`/`activeModel` from `consciousnessStore` (lines 129-139)
  2. Compile the system prompt template using `compilePrompt()` (lines 70-103), substituting `{count}`, `{characterName}`, `{guidance}`, `{lengthRule}` placeholders with the user's options.
  3. Build input messages (lines 149-242):
     - *Cache-aligned path* (lines 151-221): Replicates full chat context pipeline — system messages, chat context snapshots, sensor payloads, formatted conversation history. Appends the compiled instruction + JSON schema as a user message.
     - *Default path* (lines 223-241): Takes the last `contextDepth` user/assistant messages, formats them as "User: ... / {characterName}: ..." text, and sends `[system: compiledPrompt, user: chat history + instruction]`.
  4. Call `llmStore.generateObject<{ options: Array<{title, message}> }>(modelId, provider, { messages, schema: ProducerResponseSchema, normalize })` (lines 244-260).
     - **Schema** `ProducerResponseSchema` (lines 18-25): validates `{ options: [{ title: string, message: string }] }`.
     - **Normalize function** (lines 250-258): ensures each option has string `title` and `message`.
  5. Returns `res.options` (line 266) — the array of `{title, message}` choices.

  **Default template** `DEFAULT_SYSTEM_PROMPT_TEMPLATE` — lines 70-80:
  ```
  You are a dialogue writing assistant for an interactive roleplay.
  Your job is to suggest {count} things the USER could say next...
  ```

---

#### **6. llmStore.generateObject → stage-shared generateObject → API**

**File:** `/Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/llm.ts`

- `generateObject<T>()` — lines 568-582:
  ```ts
  async function generateObject<T>(model, chatProvider, options) {
    const { generateObject: sharedGenerateObject } = await import('@proj-airi/stage-shared')
    const chatConfig = getChatConfig(model, chatProvider)
    return await sharedGenerateObject({
      ...options,
      model,
      apiKey: chatConfig.apiKey,
      baseURL: String(chatConfig.baseURL),
    })
  }
  ```

**File:** `/Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-shared/src/llm/structured-output.ts`

- `generateObject<T>()` — lines 34-112:
  1. Appends schema instructions to messages (line 52: "Your response MUST be a valid JSON object matching this schema...")
  2. Calls `generateText()` from `@xsai/generate-text` (line 58) — the actual LLM API call.
  3. Strips markdown fences from response (line 66).
  4. Parses JSON (line 71).
  5. Applies `normalize` hook (line 91).
  6. Validates with valibot schema (line 95).
  7. Retries up to `maxAttempts` (default 3) on parse/validation failure, appending error feedback to messages each time.

---

#### **7. Choices Bubble Rendering (the return path)**

After `generateSuggestions` returns, `producerSuggestion.value` is updated in `InteractiveArea.vue` (line 335-340). The `historyMessages` computed (lines 616-622) merges it into the chat message list.

**File:** `/Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/history.vue` (`ChatHistory`)

- Lines 185-192:
  ```html
  <div v-else-if="'type' in message && (message as any).type === 'producer-suggestion'">
    <ProducerChoiceBubble
      :message="message as any"
      @choose="(choice, isPlaybackOnly) => emit('choose', choice, isPlaybackOnly)"
      @retry="emit('retry-producer')"
      @delete="emit('delete-producer')"
    />
  </div>
  ```
  Events bubble up to `InteractiveArea.vue` (lines 771-773):
  ```html
  <ChatHistory ... @choose="handleChooseOption" @retry-producer="handleRetryProducer" @delete-producer="handleDeleteProducer" />
  ```

**File:** `/Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/ProducerChoiceBubble.vue`

- Renders skeleton loading cards (lines 211-220) while `message.loading` is true.
- Renders the actual choice cards (lines 223-278). Clicking a card emits `emit('choose', choice)` (line 234).
- Has Retry/Dismiss/Play All header buttons emitting `retry` (line 191), `delete` (line 200).
- Auto-play all feature (lines 110-149) watches `message.loading` → false and reads `airi:producer:auto-play-all` localStorage flag.
- Playback-only `choose` emit (line 70): when preview voice is clicked, emits `choose(choice, true)` (updates textarea but does NOT auto-send).

---

#### **8. Post-Generation Actions in InteractiveArea.vue**

- **`handleChooseOption`** — lines 360-376: Sets `messageInput.value = choice.message`, focuses the textarea, and if `airi:producer:auto-send` localStorage is `true` AND it's not playback-only, calls `handleSend()`.
- **`handleRetryProducer`** — lines 348-354: Re-invokes `handleProducerSubmit` with last saved config, or opens the modal if no config exists.
- **`handleDeleteProducer`** — line 356-358: Sets `producerSuggestion.value = null` (removes the bubble from chat).
- **`handleSend`** — lines 426-480: Sends the text via `chatOrchestrator.ingest()`. After a successful send, `onAfterMessageComposed` callback (lines 608-614) nulls `producerSuggestion`.

---

### Summary Flow Diagram

```
[Magic Wand Button click]
  InteractiveArea.vue:1096  →  isProducerModalOpen = true
    ↓
[ProducerGuidanceModal opens]
  InteractiveArea.vue:1317  →  <ProducerGuidanceModal v-model="isProducerModalOpen" @submit="handleProducerSubmit">
    ↓
[User clicks "Inspire me"]
  ProducerGuidanceModal.vue:59  →  handleGenerate() → emit('submit', payload)
    ↓
[Submit handler]
  InteractiveArea.vue:316  →  handleProducerSubmit(payload)
    ↓
  InteractiveArea.vue:326  →  await generateSuggestions({...})
    ↓
[useProducer composable]
  use-producer.ts:117  →  generateSuggestions()
    ├── use-producer.ts:142  →  compilePrompt(template, options)  [system prompt]
    ├── use-producer.ts:149  →  build inputMessages  [system + conversation + instruction]
    └── use-producer.ts:244  →  llmStore.generateObject<ProducerResponse>(modelId, provider, { messages, schema, normalize })
         ↓
[LLM Store]
  llm.ts:568  →  generateObject() → imports stage-shared generateObject
    ↓
[Stage-Shared]
  structured-output.ts:34  →  generateObject<T>()
    ├── structured-output.ts:52  →  append schema instructions to messages
    ├── structured-output.ts:58  →  generateText() [@xsai/generate-text → actual LLM API call]
    ├── structured-output.ts:71  →  JSON.parse(stripMarkdown(response.text))
    ├── structured-output.ts:91  →  normalize(parsed)
    └── structured-output.ts:95  →  v.safeParse(schema, parsed) → retry up to 3x on failure
    ↓
[Return choices to InteractiveArea]
  InteractiveArea.vue:335  →  producerSuggestion.value = { choices, loading: false }
    ↓
[ChatHistory renders ProducerChoiceBubble]
  history.vue:185-192  →  ProducerChoiceBubble emits choose/retry/delete back up
    ↓
[User clicks a choice card]
  ProducerChoiceBubble.vue:234  →  emit('choose', choice)
  →  history.vue:188  →  emit('choose', choice, isPlaybackOnly)
    →  InteractiveArea.vue:771  →  @choose="handleChooseOption"
      →  InteractiveArea.vue:360  →  sets messageInput + optionally auto-sends via handleSend()
```

### Key Variable/Function Names

| Name | Location | Purpose |
|------|----------|---------|
| `isProducerModalOpen` | `InteractiveArea.vue:311` | Controls ProducerGuidanceModal visibility |
| `handleProducerSubmit` | `InteractiveArea.vue:316` | Receives modal submit, calls `generateSuggestions` |
| `generateSuggestions` | `use-producer.ts:117` | Core producer function |
| `llmStore.generateObject` | `llm.ts:568` | Structured LLM output with schema validation |
| `sharedGenerateObject` | `structured-output.ts:34` | JSON repair loop + valibot validation |
| `ProducerResponseSchema` | `use-producer.ts:18-25` | Valibot schema for `{options: [{title, message}]}` |
| `compilePrompt` | `use-producer.ts:82` | Template interpolation for system prompt |
| `DEFAULT_SYSTEM_PROMPT_TEMPLATE` | `use-producer.ts:70` | Default producer system prompt |
| `producerSuggestion` | `InteractiveArea.vue:312` | Holds the generated choices state |
| `handleChooseOption` | `InteractiveArea.vue:360` | Populates textarea + auto-sends |
| `handleRetryProducer` | `InteractiveArea.vue:348` | Regenerates with last config |
| `handleDeleteProducer` | `InteractiveArea.vue:356` | Dismisses the suggestions bubble |
| `historyMessages` | `InteractiveArea.vue:616` | Merges chat messages + producer bubble |

## Relevant Skills

- [[airi-desktop-chatbox]]
