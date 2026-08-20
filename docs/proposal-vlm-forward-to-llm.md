# Proposal: "Forward to LLM" VLM Captioning & Tagging Pipeline

This proposal outlines the design, UI integration, and backend implementation for the **Forward to LLM** strategy under `Settings > Modules > Vision`. It specifies a unified, provider-agnostic architecture that treats all vision models uniformly (whether local or remote), letting the user combine any vision model with any conversation routing strategy.

---

## 1. Architectural Concept: sight Decoupled from Voice

Under the unified vision architecture, **any configured Vision Model** acts as a text generator driven by visual inputs. The system provides two routing strategies for this text:

```
                  [User Image + Message]
                            │
                            ▼
                  ┌──────────────────┐
                  │ IPC Interception │
                  └─────────┬────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
  [Direct Response Mode]          [Forward to LLM Mode]
  (Selected VLM replies           (Selected VLM acts as a
   directly to the user)           descriptor/captioner)
            │                               │
            │                               ▼
            │                     ┌───────────────────┐
            │                     │ VLM Output Text   │
            │                     │ (Tags / Prose)    │
            │                     └─────────┬─────────┘
            │                               ▼
            │                     ┌───────────────────┐
            │                     │ Inject into Chat  │
            │                     │ Message Prompt    │
            │                     └─────────┬─────────┘
            │                               ▼
            ▼                     ┌───────────────────┐
      [Display Chat] ◄────────────┤ Primary Text LLM  │
                                  │ (Character Voice) │
                                  └───────────────────┘
```

1.  **Direct Response (Stand-in):** The selected Vision Model directly generates the chat reply on that turn, acting as a stand-in for the active character.
2.  **Forward to LLM (Descriptor):** The selected Vision Model is used to analyze the image and generate a text description. This text (whether it is detailed semantic prose from a model like Kimi 2.5 or comma-separated tags from WD14) is injected as context into the primary chat stream. The character's primary text-only LLM (e.g. DeepSeek) then generates the response in its authentic voice.

---

## 2. Store & Configuration Expansion (`vision.ts`)

We will update the vision store (`packages/stage-ui/src/stores/modules/vision.ts`) to persist the routing strategy. No separate "local" or "remote" stores are introduced; the store remains provider-agnostic.

### Config State Fields
```typescript
export type VisionStrategy = 'direct' | 'forward'

export const useVisionStore = defineStore('vision', () => {
  const strategy = useLocalStorageManualReset<VisionStrategy>('settings/vision/strategy', 'direct')

  return {
    strategy,
    // ... existing activeProvider and activeModel references
  }
})
```

---

## 3. Settings UI Integration (`vision.vue`)

We will modify [vision.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/modules/vision.vue#L321-L352) to support the new strategy option and display helpful configuration warnings.

### UI Modifications
1.  **Enable Radio Options:** Remove the `:disabled="true"` and `[PLANNED]` badges from the "Forward to LLM" card.
2.  **Add Configuration Warnings:**
    *   To assist the user without restricting their choices, the UI will display a warning if they pair a non-semantic concept tagger (like `wd14-tagger`) with the **Direct Response** strategy:
        > ⚠️ **Notice:** Non-semantic response expected to be received with this configuration setup (e.g., the model will output raw tags directly to the chat).

---

## 4. Pipeline Execution & Prompt Ingress

When the user sends a message with an image attachment:

### Step 1: Pre-processing Interception
Inside the chat/message orchestration layer:
```typescript
import { useVisionStore } from './stores/modules/vision'

async function processUserMessage(payload: ChatMessagePayload) {
  const visionStore = useVisionStore()

  if (payload.imageAttachment && visionStore.strategy === 'forward') {
    // 1. Invoke the configured active Vision Model (local or remote) to analyze the image
    const visionOutput = await runActiveVisionModelAnalysis(
      payload.imageAttachment,
      visionStore.activeProvider,
      visionStore.activeModel
    )

    // 2. Format the analysis text block
    const formattedText = `[IMAGE ANALYSIS: ${visionOutput}]`

    // 3. Inject it into the prompt stream and drop the raw image bytes for the main text-only LLM
    payload.content = `${formattedText}\n\n${payload.content}`
    payload.attachments = payload.attachments.filter(a => a.type !== 'image')
  }
}
```

### Step 2: Prompt Injection Example
The compiled message sent to the primary LLM contains the textual representation of the image generated by the vision model:
> **User Prompt:**
> `[IMAGE ANALYSIS: A black cat sitting on a grey keyboard, staring intently at the camera.]`
> Get off my desk!

The primary text-only LLM (e.g. DeepSeek) reads the description and responds in the character's authentic voice, reacting naturally to the situation.

## Relevant Skills

- [[airi-attention-ecology-vision]]
