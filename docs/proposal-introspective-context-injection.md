# Proposal: Introspective Context Injection (Dream & Journal Intrusion)

## 1. Overview
This proposal introduces a unified class of runtime prompt injections called **Introspective Context Injection**. Unlike standard RAG or user-message concatenation (which directly alters user inputs or pollutes the chat history), this class utilizes the runtime system context block assembled during the sending pipeline (`performSend` in `chat.ts`).

By injecting ephemeral system instructions on the very next turn when a conversation resumes, we allow the character to introspect and react to out-of-band or background events (like dreaming, text journaling, or generating artwork) that do not natively register in the flat user/assistant chat history.

---

## 2. Introspection Channels

This pattern supports three primary introspective vectors:

### A. Dream Intrusion
* **Context**: Triggered by idle-time dream consolidation (Echo Chips).
* **The Injection**: Uses `dreamIntrusionPrompt` (customizable) to inject consolidated offline dreams (Echo Chips) into the character's thoughts when resuming the chat.
  * *Default Template*:
    > `You just spoke with the user {timeToDream} minutes ago, and in the time since, you had a dream about: {insertEchoChips}.`
    > `For this turn only, continue to address the user and find a natural way to work in that you had a dream and what it was about as part of your response.`

### B. Journal Intrusion
* **Context**: Triggered by background "Journal Moments" or in-band `text_journal` tool executions.
* **The Injection**: Uses `journalIntrusionPrompt` (customizable) to prompt the character to reflect on their latest journal entry on their next reply.
  * *Default Template*:
    > `You just wrote the following entry in your journal {timeSinceJournal} minutes ago:`
    > `"{journalEntryText}"`
    > `For this turn only, continue the conversation and find a natural way to reflect on this action, the feelings you recorded, or your state of mind in your response.`

### C. Artistry Intrusion (Image Journal)
* **Context**: Triggered by background autonomous artistry runs or in-band `image_journal` creations.
* **The Injection**: Uses `artistryIntrusionPrompt` (customizable) to allow the character to bring up their latest image journal creations on their next response.
  * *Default Template*:
    > `You just finished creating a new artwork of: "{imagePrompt}".`
    > `For this turn only, continue the conversation and find a natural way to reference or react to having just made this creation.`

---

## 3. Structural Schema Extensions

To support configuring and tracking these pending introspective states, we will expand the character card extensions and the session metadata.

### Character Card Settings (`packages/stage-ui/src/types/card.schema.ts`)
Settings are centralized under the card's `extensions.airi`:

```typescript
// 1. Text Journal Configuration
const AiriTextJournalSchema = object({
  widgetInstruction: optional(string()), // Instruction prompt override
  injectJournalContext: optional(boolean()), // Intrusion toggle
  journalIntrusionPrompt: optional(string()), // Intrusion prompt template
})

// 2. Artistry Configuration
const AiriArtistrySchema = looseObject({
  provider: optional(string()),
  model: optional(string()),
  promptPrefix: optional(string()),
  widgetInstruction: optional(string()), // Instruction prompt override
  options: optional(record(string(), unknown())),
  autonomousEnabled: optional(boolean()),
  autonomousThreshold: optional(number()),
  autonomousHistoryDepth: optional(number()),
  autonomousMonitorEnabled: optional(boolean()),
  autonomousMonitorDiscordEnabled: optional(boolean()),

  // New intrusion fields
  injectArtistryContext: optional(boolean()), // Intrusion toggle
  artistryIntrusionPrompt: optional(string()), // Intrusion prompt template
})

// 3. Dream State Configuration
const AiriDreamStateSchema = object({
  enabled: boolean(),
  strictAfkGating: boolean(),
  journalingThreshold: union([literal('minimal'), literal('balanced'), literal('lush')]),
  maxSessionsPerDay: number(),
  sessionTimeoutMinutes: number(),
  afkThresholdMinutes: number(),
  minConversationTurns: number(),
  lastProcessedAt: optional(number()),
  dailyRunDate: optional(string()),
  dailyRunCount: optional(number()),

  // New intrusion fields
  injectDreamContext: optional(boolean()), // Intrusion toggle
  dreamIntrusionPrompt: optional(string()), // Intrusion prompt template

  // Transient staging (stored on card)
  pendingDreamChips: optional(array(string())),
  pendingDreamTimestamp: optional(number()),
})

const AiriExtensionSchema = looseObject({
  modules: optional(AiriModulesSchema),
  heartbeats: optional(AiriHeartbeatSchema),
  dreamState: optional(AiriDreamStateSchema),
  shortTermMemory: optional(AiriShortTermMemorySchema),
  groundingEnabled: optional(boolean()),

  textJournal: optional(AiriTextJournalSchema), // Added textJournal config block
  artistry: optional(AiriArtistrySchema),
  // ...
})
```

### Session Metadata (`packages/stage-ui/src/types/chat.ts`)
Session-specific actions (like journaling and artistry) hold their transient pending state on the active session record to prevent cross-session leaks:
```typescript
interface ChatSessionMeta {
  // Existing fields ...
  pendingJournalMoment?: {
    entryText: string
    timestamp: number
  }
  pendingArtistryMoment?: {
    prompt: string
    timestamp: number
  }
}
```

---

## 4. Execution Pipeline (`performSend` in `chat.ts`)

During the sending pipeline:
1. **Collate Pending Introspections**: Check the active card and the active session metadata for pending dream, journal, or artistry state.
2. **Build Prompt Segments**: For each pending item:
   * Calculate elapsed minutes (`Math.max(1, Math.round((Date.now() - timestamp) / 60000))`).
   * Read the custom prompt template from the card configuration (falling back to default templates if blank).
   * Replace placeholders (e.g. `{timeSinceJournal}`, `{journalEntryText}`, `{imagePrompt}`, `{timeToDream}`, `{insertEchoChips}`) with runtime values.
3. **Inject to System Context**: Append the compiled prompts into the runtime system/metadata payload (`contextContent`) which is injected immediately following the main System Prompt.
4. **Flush Pending State**: Right after generating `newMessages` for streaming, clear the transient state:
   * Delete `pendingDreamChips`/`pendingDreamTimestamp` from the card.
   * Delete `pendingJournalMoment`/`pendingArtistryMoment` from the active session metadata.
   This guarantees that the character only reacts to these events on the immediate next turn, preventing repeated output loops.

---

## 5. UI Integration & Configuration

All toggle preferences and editable prompt templates reside in the new **Tools Tab** of the card creator, while session-specific actions (like background Journal Moments) will inherit these defaults but remain overrideable at trigger time.

## Relevant Skills

- [[airi-prompt-builder-engine]]
