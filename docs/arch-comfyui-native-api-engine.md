# ComfyUI Native API Redesign — "Bring Your Own Workflow"

> **Status**: Draft — Pending Review
> **Date**: 2026-03-23
> **Author**: Richy / Antigravity
> **Supersedes**: [comfyui-widget-proposal.md](./comfyui-widget-proposal.md) (CUIPP CLI Edition)
> **Related Docs**: [widget-system-report.md](./widget-system-report.md), [image-journal-proposal.md](./image-journal-proposal.md), [proposal-flux-grid-slice.md](./proposal-flux-grid-slice.md)

---

## 1. Background & Motivation

The current ComfyUI integration in AIRI is tightly coupled to CUIPP (`comfyGalleryAppBackend`). It shells out to a **WSL CLI bridge** that spawns `node cli-agent.js generate|remix`, parses stdout for progress events, and scrapes filenames from the output to reconstruct image URLs.

### What Erickira's Conversation Revealed

A community contributor showed that the entire CUIPP intermediary is unnecessary. ComfyUI Portable's built-in HTTP server exposes everything needed:

```js
// This is literally it. No WSL. No CLI. No middleware.
await fetch(`${hostUrl}/prompt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: workflowJson }),
})
```

**Key insight**: You only need to send the `prompt` field (the API-format node graph). The full `workflow` object (UI metadata, positions, groups) is optional — it just lets you see the run inside ComfyUI's GUI.

### Why The Redesign

| Current (CUIPP CLI Bridge) | Proposed (Native HTTP API) |
|---|---|
| Requires WSL + Node.js in WSL | Direct HTTP — works from any OS |
| Spawns `child_process` per generation | Simple `fetch()` call |
| Parses stdout with regex for progress | WebSocket or polling for status |
| Hardcoded paths (`/mnt/e/CUIPP/...`) | URL + Port configuration only |
| Users can't bring their own workflows | Upload any `workflow_api.json` |
| No portable distribution possible | Works with ComfyUI Portable out of the box |

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  AIRI Settings UI                                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Settings > Providers > Artistry > ComfyUI         │  │
│  │  ┌──────────────────────┐ ┌─────────────────────┐  │  │
│  │  │  Connection Config   │ │  Workflow Manager    │  │  │
│  │  │  • Host URL          │ │  • Upload JSON       │  │  │
│  │  │  • Port              │ │  • Pick fields       │  │  │
│  │  │  • Test Connection   │ │  • Name & save       │  │  │
│  │  └──────────────────────┘ └─────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Settings > Card > ✏️ > Artistry Tab                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │  • Provider: ComfyUI                               │  │
│  │  • Template: [dropdown of saved workflows]         │  │
│  │  • Prompt Prefix: "masterpiece, anime, ..."        │  │
│  │  • (Optional) Hardcoded default template           │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
          │
          │  POST /prompt  { prompt: resolvedWorkflowJson }
          ▼
┌──────────────────────┐       ┌─────────────────────┐
│  ComfyUI Server      │──────▶│  image_journal      │
│  (Portable / Local)  │       │  (persistent store)  │
│  http://localhost:8188│       └─────────────────────┘
└──────────────────────┘
```

### Integration with `image_journal`

Per [widget-system-report.md](./widget-system-report.md) §8-9 and [image-journal-proposal.md](./image-journal-proposal.md), generated images should flow into the **`image_journal`** (the persistent, character-scoped carousel) rather than remaining owned by ephemeral widgets. The new ComfyUI provider should:

1. Generate via `POST /prompt`
2. Retrieve the result image
3. Append to the `image_journal` store (same as Replicate flow)

The `Comfy.vue` widget becomes a **viewport** into journal entries, not the source of truth.

---

## 3. The Gem: `getComfyTemplate.js` — Deep Analysis

This function is the proven engine powering **all** CUIPP workflow modes. Every single mode module follows the same contract:

### The Universal Pattern (7+ modes confirm this)

```js
// 1. Import the template engine
const { getComfyTemplate } = require("../workflowBuilder/getComfyTemplate");

// 2. Point to a pre-built workflow JSON (exported from ComfyUI)
const workflowPath = "./controllers/workflowBuilder/someWorkflow.json";

// 3. Build a config object keyed by node _meta.title
const config = {
  "Node Title": { inputName: value },
};

// 4. Apply config to workflow, get back { prompt, workflow }
const result = await getComfyTemplate(workflowPath, config);
return { output: result.prompt, workflow: result.workflow };
```

### How It Works Internally

1. Reads the workflow JSON file (must contain both `prompt` and `workflow` sections — this is the full export, not just API format)
2. For each entry in `config`, finds nodes where `node._meta.title === configKey`
3. For matching nodes, overwrites `node.inputs[field] = value` in the prompt section
4. Also updates `widgets_values` in the workflow section (for GUI display) using `propertyIndices` or positional mapping
5. Always auto-injects a unique `Save Image` filename prefix

### Real-World Config Examples from CUIPP Modes

These show the actual variety of overrides the system handles:

```js
// sbsMode.js — Side-by-side comparison
{
  "load_first_image":        { image: "output_001.png" },     // filename
  "first_image_text_overlay": { text: "CivitAI | 12345" },    // label string
  "load_second_image":       { image: "input_original.jpg" },  // filename
  "second_image_text_overlay": { text: "bunnyMint", font_size: 96 }, // string + number
  "save_caption":            { file: "captions_42.txt" },      // output path
}

// gifMode.js — Animated GIF from static image
{
  "Taco Img2Img Animated Loader":  { image: "frame.png" },
  "KSampler":                       { seed: 123456789012345 },  // random seed
  "GroundingDinoSAMSegment (segment anything)": { prompt: "subject" }, // segmentation target
  "Video Combine 🎥🅥🅗🅢":        { format: "image/webp" },   // output format
}

// effectMode.js — DepthFlow camera effects
{
  "Load Image":      { image: "photo.jpg" },
  "main_depthflow":  { motion: ["37", 0] },  // ARRAY value — links to another node!
}

// swapFaceMode.js — Face swap with weight control
{
  "load_target_bg":    { image: "scene.png" },
  "load_target_image": { image: "face_ref.jpg" },
  "prompt_addon":      { text: "some extra prompt text" },
  "face_swap_lora":    { weight: 0.8 },        // float for LoRA strength
}

// memeMode.js — AI-generated dialogue overlays
{
  "Load Image":                { image: "scene.jpg" },
  "gemini_vlm":                { prompt: "<long LLM template>", temperature: 0.65 },
  "Create Markdown Image V2":  { theme: "pastel" },
}

// shareVideoMode.js — Video share processing
{
  "Load Image":    { image: "start_frame.jpg" },
  "save_caption":  { file: "captions_99.txt" },
  "save_tags":     { file: "tags_99.txt" },
}
```

### Key Takeaway for AIRI

The config values are **not just text prompts**. They include:
- **Filenames** (images to load)
- **Strings** (prompts, labels, themes)
- **Numbers** (seeds, font sizes, temperatures, LoRA weights)
- **Arrays** (node-to-node links for rewiring the graph)
- **Output paths** (where to save results)

The Workflow Manager UI must support exposing fields of different types — not just a single "prompt" text box.

> [!NOTE]
> There's also a second serializer (`serializeImageGenData` in `defaultMode.js`) that works on a DSL-style workflow format. This is a CUIPP-internal concern and doesn't need to be ported to AIRI. We only port the `getComfyTemplate` concept.

---

## 4. Workflow Manager — The New Settings Page

### User Flow: "Bring Your Own Workflow"

> *"Export your workflow from ComfyUI, bring it in here, and pick your fields."*

#### Step 1: Upload
User drops or selects a `workflow_api.json` file they exported from ComfyUI (Settings > Enable Dev Mode > "Save API Format").

#### Step 2: Field Discovery
The UI parses the JSON and displays all nodes with their `_meta.title` and `inputs`:

```
┌──────────────────────────────────────────────────────────┐
│  📋 Workflow Nodes — "My Anime Generator"                │
│                                                          │
│  ☑️ Positive Prompt          (CLIPTextEncode)            │
│     └─ text: string          "beautiful landscape" [✓]   │
│     └─ clip: link            ["4", 1]              [ ]   │
│                                                          │
│  ☑️ KSampler                 (KSampler)                  │
│     └─ seed: number          1234567               [✓]   │
│     └─ steps: number         20                    [✓]   │
│     └─ cfg: number           7                     [ ]   │
│     └─ sampler_name: string  "euler"               [ ]   │
│                                                          │
│  ☐ Load Checkpoint           (CheckpointLoaderSimple)    │
│     └─ ckpt_name: string     "animagine.safetensors" [ ] │
│                                                          │
│  ☐ Empty Latent Image        (EmptyLatentImage)          │
│     └─ width: number         1024                  [✓]   │
│     └─ height: number        1024                  [✓]   │
│                                                          │
│  [✓] = exposed to agent   [ ] = frozen at default        │
└──────────────────────────────────────────────────────────┘
```

**Expose** means the agent (or the card-level config) can override this field at generation time. Everything else stays frozen at its uploaded default value.

#### Step 3: Name & Save
User gives it a name (e.g., `"Anime Text2Img"`) and saves. The stored record looks like:

```json
{
  "id": "anime-text2img",
  "name": "Anime Text2Img",
  "workflow": { /* full API-format JSON */ },
  "exposedFields": {
    "Positive Prompt": ["text"],
    "KSampler": ["seed", "steps"],
    "Empty Latent Image": ["width", "height"]
  }
}
```

### Agent Interface

When the agent wants to generate, it emits via `image_journal.create`:

```json
{
  "title": "Cherry Blossom Scene",
  "prompt": "anime girl in cherry blossom field",
  "template": "anime-text2img",
  "options": {
    "KSampler": { "seed": 42 }
  }
}
```

Under the hood, `getComfyTemplate`'s logic merges these overrides into the stored workflow and POSTs to `/prompt`. The `prompt` field gets injected into the exposed "Positive Prompt" > "text" slot. Additional options override their respective exposed fields.

---

## 5. Hardcoded Default Template (Card-Level)

For simpler setups, a card can have a **single hardcoded workflow** with just the prompt exposed. This lives in `Settings > Card > ✏️ > Artistry`:

- **Provider**: ComfyUI
- **Template**: (dropdown or fixed default)
- **Prompt Prefix**: `"masterpiece, high quality, anime, 1girl,"`

The agent just says a prompt string, the prefix gets prepended, and everything else is frozen in the template. Zero workflow knowledge needed by the model.

This mirrors how Replicate presets already work in `CardCreationTabArtistry.vue` — each preset is a frozen config with a model-specific prompt prefix. The ComfyUI equivalent is a frozen workflow with only the prompt node exposed.

---

## 6. The Result Retrieval Problem

> [!CAUTION]
> **This is the hard part.** Sending the prompt is the easy half. Getting the generated image back is a monumental task.

### What `/prompt` Returns

```json
{
  "prompt_id": "abc123-def456",
  "number": 7
}
```

That's it. A **ticket number**. No image. No URL. No callback.

### The Legacy Approach: WebSocket Heuristics (What We're Replacing)

The current CUIPP system uses `QueueOrchestrator.js` — a WebSocket-based approach that:

1. Maintains a persistent WS connection to ComfyUI
2. Listens for `executed` events on every node
3. Looks up each node's `type` in the active workflow graph
4. Detects completion by matching on `SaveImage` or `VHS_VideoCombine` node types
5. Handles reconnection, interruption, and disconnection edge cases

This works but is **fragile and over-engineered** for AIRI's needs:
- Requires maintaining the full workflow graph in memory to map node IDs → types
- Completion detection is heuristic-based ("did a SaveImage node fire?")
- Has a hash-collision workaround that appends random periods to prompts
- Needs complex state management for reconnection mid-generation

### ✅ Chosen Strategy: Polling `/history/{prompt_id}`

**Decision**: We adopt Erickira's polling approach. It matches how the Replicate provider already works in `artistry-bridge.ts` (poll-based providers), keeping the codebase consistent.

**Polling interval**: **5 seconds** (2s was too aggressive; 5s is respectful to the server while still being responsive enough for image gen that typically takes 10-60s).

### Reference Implementation (Erickira's Proven Code)

```typescript
// After POST /prompt returns { prompt_id }, poll for completion:

let historyDone = false
let attempt = 0

while (!historyDone) {
  await new Promise(r => setTimeout(r, 5000)) // 5s polling interval
  attempt++

  if (attempt % 3 === 0) {
    log(`Polling history for prompt_id ${promptId}... attempt ${attempt}`)
  }

  let histResp: Response
  try {
    histResp = await fetch(`${hostUrl}/history/${promptId}`)
  }
  catch (e) {
    throw new Error(`ComfyUI disconnected during polling: ${e}`)
  }

  if (histResp.ok) {
    const histData = await histResp.json()
    if (histData[promptId]) {
      const outputs = histData[promptId].outputs

      // Find first image in any node's output
      for (const nodeId in outputs) {
        const nodeOutput = outputs[nodeId]
        if (nodeOutput.images && nodeOutput.images.length > 0) {
          const img = nodeOutput.images[0]
          // Construct the view URL to fetch the actual image
          const imageUrl = `${hostUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`
          callback({ status: 'succeeded', progress: 100, imageUrl })
          historyDone = true
          break
        }
      }

      // Job finished but no images (e.g. text-only workflow)
      if (!historyDone) {
        callback({ status: 'succeeded', progress: 100 })
        historyDone = true
      }
    }
  }
}
```

### Why Polling Wins Over WebSocket

| Concern | Polling | WebSocket |
|---|---|---|
| Complexity | ~30 lines | ~300 lines (QueueOrchestrator) |
| State management | Stateless per request | Must track activeItem, promptId, hash, reconnection |
| Completion detection | Deterministic (appears in `/history`) | Heuristic (sniff node types) |
| Cross-platform | Works everywhere HTTP works | Needs WS library, binary parsing |
| Consistency with Replicate | ✅ Same pattern | ❌ Different pattern |
| Real-time progress | ❌ No | ✅ Yes |

> [!NOTE]
> **Future enhancement**: If real-time progress is ever desired (for the `Comfy.vue` widget progress bar), WebSocket can be added as an **optional overlay** on top of the polling base. The polling loop handles completion; the WS connection just feeds the progress bar. This is additive, not a replacement.

---

## 7. What To Rip Out (Legacy CUIPP Integration)

The following files are the old CLI bridge approach and should be gutted or replaced:

### Files to Remove or Replace

| File | Why |
|---|---|
| [`comfyui.ts` (provider)](../apps/stage-tamagotchi/src/main/services/airi/widgets/providers/comfyui.ts) | WSL `child_process` spawn approach — replace with direct HTTP provider |
| [`comfyui.vue` (settings)](../packages/stage-pages/src/pages/settings/providers/artistry/comfyui.vue) | Shows WSL path fields — replace with URL + Workflow Manager |
| [`artistry.ts` (store)](../packages/stage-ui/src/stores/modules/artistry.ts) | ComfyUI fields are all WSL-specific — replace with URL + saved workflows |
| [`comfyui-widget-proposal.md`](./comfyui-widget-proposal.md) | Superseded by this document |
| `cuipp.ts` (legacy bridge, per widget-system-report §6) | Exploratory bridge code, not final architecture |

### Files to Keep (Adapt)

| File | Why |
|---|---|
| [`artistry-bridge.ts`](../apps/stage-tamagotchi/src/main/services/airi/widgets/artistry-bridge.ts) | Provider registry pattern is good — swap the ComfyUI provider implementation |
| [`Comfy.vue` (widget)](../apps/stage-tamagotchi/src/renderer/widgets/comfy/components/Comfy.vue) | Gallery + flip-card + progress overlay is excellent UI — wire to `image_journal` store |
| [`CardCreationTabArtistry.vue`](../packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabArtistry.vue) | Add ComfyUI template dropdown alongside the Replicate presets |

### Store Changes

Replace the WSL-specific ComfyUI fields in `artistry.ts`:

```diff
- comfyuiWslBackendPath
- comfyuiWslNodePath
- comfyuiHostUrl (repurpose)
- comfyuiDefaultCheckpoint
- comfyuiDefaultRemixId
+ comfyuiServerUrl       // "http://localhost:8188"
+ comfyuiSavedWorkflows  // Array of { id, name, workflow, exposedFields }
+ comfyuiActiveWorkflow  // Default workflow ID
```

---

## 8. UI Design: Settings Page

The new ComfyUI settings page should follow the rich, informational pattern from `memory-long-term.vue`:

### Top Section — What Is This?

Rounded card with icon + title + description:

```
┌──────────────────────────────────────────────────────────┐
│ 🖥️  ComfyUI Native API                                  │
│                                                          │
│ Connect to your local ComfyUI instance. Upload workflow  │
│ JSON files exported from ComfyUI and pick which fields   │
│ your AI character can control.                           │
│                                                          │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ │
│ │ What You Need   │ │ How To Export   │ │ Scope Boundary │ │
│ │                 │ │                 │ │                │ │
│ │ ComfyUI running │ │ Dev Mode ON →   │ │ Model downloads│ │
│ │ locally or on   │ │ "Save (API     │ │ & node installs│ │
│ │ your network.   │ │  Format)"      │ │ are YOUR job.  │ │
│ └────────────────┘ └────────────────┘ └────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Connection Section

```
┌──────────────────────────────────────────────────────────┐
│ Server URL:  [http://localhost:8188        ] [🔌 Test]   │
│                                                          │
│ Status: ● Connected — ComfyUI v0.3.10, 1 GPU (RTX 4090) │
└──────────────────────────────────────────────────────────┘
```

The "Test" button hits `GET /system_stats` and displays version + GPU info.

### Workflow Manager Section

List of saved workflows with upload button, edit, delete. Each row shows:
- Name
- Node count
- Exposed field count
- Delete / Edit buttons

---

## 9. Complete ComfyUI API Reference

For reference, here is every endpoint available in the ComfyUI server (from `server.py`):

| Endpoint | Method | Purpose |
|---|---|---|
| `/ws` | WS | Real-time events (progress, previews, completion) |
| `/prompt` | `POST` | **Queue a workflow for execution** |
| `/prompt` | `GET` | Get queue info |
| `/queue` | `GET` | Get running/pending queue |
| `/queue` | `POST` | Clear queue or delete items |
| `/history` | `GET` | Get execution history |
| `/history/{prompt_id}` | `GET` | Get specific job result |
| `/api/jobs` | `GET` | List jobs (newer, with filtering/pagination) |
| `/api/jobs/{job_id}` | `GET` | Get specific job |
| `/interrupt` | `POST` | Stop current or specific execution |
| `/free` | `POST` | Free VRAM/unload models |
| `/view` | `GET` | Fetch generated images by filename |
| `/upload/image` | `POST` | Upload input images |
| `/upload/mask` | `POST` | Upload masks |
| `/object_info` | `GET` | List all available nodes + their inputs |
| `/object_info/{class}` | `GET` | Single node info |
| `/models` | `GET` | List model types |
| `/models/{folder}` | `GET` | List models in folder |
| `/system_stats` | `GET` | System/GPU info |
| `/embeddings` | `GET` | List embeddings |
| `/features` | `GET` | Server feature flags |
| `/view_metadata/{folder}` | `GET` | Safetensors metadata |

All endpoints are also mirrored under `/api/` prefix (e.g., `/api/prompt`, `/api/queue`).

---

## 10. Error Handling — Follow the Replicate Paradigm

The new ComfyUI provider must mirror the error handling patterns established in `replicate.ts` and `base.ts`. This keeps the artistry bridge consistent and agnostic.

### The `ArtistryProvider` Contract

```typescript
interface ArtistryProvider {
  generate: (request: ArtistryRequest) => Promise<ArtistryJob> // Returns { jobId }
  getStatus: (jobId: string) => Promise<ArtistryJobStatus> // Polled by bridge
}

interface ArtistryJobStatus {
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  progress?: number // 0–100
  imageUrl?: string // Final result
  error?: string // Error message
  actionLabel?: string // Human-readable status for the widget UI
}
```

### How Replicate Does It (Reference Pattern)

1. **`generate()`** starts an async `runGeneration()` and returns immediately with a job ID
2. **`runGeneration()`** stores status updates in an internal `jobResults` Map:
   - On start: `{ status: 'running', actionLabel: 'Requesting cloud generation...' }`
   - On success: `{ status: 'succeeded', progress: 100, imageUrl }`
   - On error: `{ status: 'failed', error: message, actionLabel: 'Error: <truncated>' }`
3. **`getStatus()`** reads from the Map — the bridge polls this at intervals
4. **The bridge** (`artistry-bridge.ts`) polls `getStatus()` every 2s and calls `updateWidget()` with each status, which flows to `Comfy.vue` as props

### How ComfyUI Should Do It

Same pattern, but the "async work" is the polling loop:

```typescript
async generate(request: ArtistryRequest): Promise<ArtistryJob> {
  // 1. Apply template overrides using getComfyTemplate logic
  // 2. POST /prompt → get prompt_id
  // 3. Start async pollForResult(jobId, promptId)
  // 4. Return { jobId } immediately
}

private async pollForResult(jobId: string, promptId: string) {
  this.jobResults.set(jobId, { status: 'running', actionLabel: 'Queued in ComfyUI...' })

  try {
    // Poll /history/{promptId} at 5s intervals (see §6)
    // On completion → extract image URL from outputs
    // GET /view?filename=X → set as imageUrl
    this.jobResults.set(jobId, { status: 'succeeded', progress: 100, imageUrl })
  } catch (error) {
    this.jobResults.set(jobId, {
      status: 'failed',
      error: error.message,
      actionLabel: `Error: ${error.message.slice(0, 50)}...`,
    })
  }
}
```

### ComfyUI-Specific Errors to Handle

| Error Source | When | What to Surface |
|---|---|---|
| `POST /prompt` returns non-200 | Missing nodes, bad JSON | `"Workflow error: <validation message>"` |
| `POST /prompt` network fail | ComfyUI not running | `"Cannot connect to ComfyUI at <url>"` |
| Polling timeout (5 min) | Stuck generation | `"Generation timed out after 5 minutes"` |
| History has no images | Text-only workflow / crash | `"Job completed but no images were generated"` |
| `/view` fetch fails | File missing | `"Failed to retrieve generated image"` |

---

## 11. Resolved Decisions

All design questions have been finalized:

| Question | Decision |
|---|---|
| **Result retrieval** | Polling `/history/{prompt_id}` at 5s intervals (§6) |
| **VRAM management** | Not opinionated — users can add `POST /free` to their workflow if needed. Auto-clearing would break back-to-back generations by forcing model reloads |
| **Image serving / CORS** | No proxy needed — direct `GET /view` from the main process (Electron, not browser) |
| **Default workflow** | Ship a bundled `txt2img.json` workflow in the repo so users have a working starting point |
| **Error surfacing** | Follow the Replicate pattern — errors bubble through `ArtistryJobStatus` → bridge → widget (§10) |
| **Image upload (img2img)** | Out of scope for Phase 1 — text-to-image workflows only |

---

## 12. Summary

| What | How |
|---|---|
| **Send prompt** | `POST /prompt` with `{ prompt: resolvedWorkflow }` |
| **Get result** | Poll `/history/{prompt_id}` every 5s |
| **Fetch image** | `GET /view?filename=X&type=output` (no proxy needed) |
| **Workflow management** | Upload JSON → pick exposed fields → save named template |
| **Default workflow** | Ship bundled `txt2img.json` out of the box |
| **Agent interface** | `{ template: "name", options: { "Node Title": { field: value } } }` |
| **Card-level default** | Hardcoded template + prompt prefix in Artistry tab |
| **Error handling** | Mirror Replicate's `ArtistryJobStatus` pattern (§10) |
| **Old CUIPP code** | Rip out WSL/CLI bridge, replace with HTTP provider |
| **Phase 1 scope** | Text-to-image only (no img2img, no image uploads) |
| **Prior art** | `getComfyTemplate.js` — proven across 7+ production workflow modes |

## Relevant Skills

- [[airi-artistry-comfyui-widgets]]
- [[airi-comfyui-provider-bridge]]
