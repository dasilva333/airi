# Edge Character Visual Expressivity: Photobooth Face Mugshots, Reaction Stickers & Zero-Compute Cloud Relay

> **Canonical Architecture & Design Specification**
> * **Status**: Proposed / Active Design
> * **Related Subsystems**: [`airi-cloud-relay-infrastructure`](../.agents/skills/airi-cloud-relay-infrastructure/SKILL.md), [`airi-acting-cue-act-tokens`](../.agents/skills/airi-acting-cue-act-tokens/SKILL.md), [`airi-model-preview-caching`](../.agents/skills/airi-model-preview-caching/SKILL.md), [`airi-discord-integration`](../.agents/skills/airi-discord-integration/SKILL.md), [`airi-model-customizer`](../.agents/skills/airi-model-customizer/SKILL.md)
> * **Related Specifications**: [`docs/design-cloud-relay.md`](./design-cloud-relay.md), [`docs/project-stickers-system-spec.md`](./project-stickers-system-spec.md), [`docs/design-discord-control-plane.md`](./design-discord-control-plane.md)

---

## 1. Executive Summary & Paradigm Shift

### 1.1 The Server-Side Sliced Rendering Bottleneck
Recent experimentation with pure-Rust / WASM 2.5D layer compositing on Cloudflare Workers (the Skia Tachie engine) proved that serverless edge compositing can theoretically execute in ~16–41 ms CPU time. However, it hit a fatal product barrier:
- It requires proprietary **sliced 2.5D raster layers** (separate eyes, mouths, brows, blushes, bodies).
- 99% of AIRI users own **3D VRM (`.vrm`)**, **Live2D Cubism (`.model3.json`)**, **Spine (`.skel`)**, or **MMD (`.pmx`)** models.
- Porting 3D/2D animation runtimes into Cloudflare Worker V8 isolates is impossible due to lack of GPU/WebGL contexts and strict 128 MB RAM constraints.
- Reverse-engineering arbitrary 3D/2D skeletal meshes into sliced 2D raster layers on the server is needlessly complex and introduces severe visual seams.

### 1.2 The Client-Side Pre-Baking Paradigm
Instead of rendering on the server, we leverage AIRI's core architectural principle: **Local-First Authoring Studio, Zero-Custody Edge Presence**.

The user's local desktop application already possesses full GPU acceleration, Three.js, Pixi-Live2D, Spine WebGL, MMD, lighting, spring physics, and the `ModelCustomizer`. When deploying a character to Cloudflare Edge for 24/7 Discord presence (`MessagingDiscord.vue`), the client pre-bakes visual expressions once and bundles them into Cloudflare KV.

### 1.3 The Dual Visual Expressivity Modalities
Cloud Relay delivers two complementary, distinct visual modalities directly in Discord chat:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   AIRI DUAL VISUAL EXPRESSIVITY                        │
├───────────────────────────────────┬────────────────────────────────────┤
│ Modality A: Photobooth Mugshots   │ Modality B: Reaction Stickers      │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Pre-baked 3D/2D avatar faces    │ • 2D chibi / meme / stylized art   │
│ • Linked to `<|ACT:emotion="..."|>`│ • Linked to `<|STICKER id|>`       │
│ • Generated via ModelCustomizer   │ • Authored in ActingSubTabStickers │
│ • Expresses avatar facial mood    │ • Expresses conversational beats   │
│ • 400×400 Head/Bust crop portrait │ • 160–300px transparent PNG/WebP   │
└───────────────────────────────────┴────────────────────────────────────┘
```

**Edge Performance Result**:
- Cloudflare Workers perform **0 ms GPU/rendering compute**.
- Cloudflare Workers simply do an instant KV lookup or direct CDN embed URL generation.
- **100% universal format compatibility**: Works with any VRM, Live2D, Spine, MMD, or 2D image avatar.

---

## 2. End-to-End Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. DESKTOP CLIENT AUTHORING (AIRI Studio)                                   │
│                                                                             │
│ [Acting Tab: Stickers]                [Deploy Wizard: Photobooth Studio]    │
│ - Select active character stickers     - Auto-Bake / Manual Snapshots        │
│ - Edit <|STICKER id|> directives       - Slots: neutral, smile, sad, wink... │
│   (ActingSubTabStickers.vue)             (MessagingDiscord.vue)             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ CloudflareStageDeployer (PUT script + KV)
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. CLOUDFLARE EDGE KV (Zero-Custody Storage)                                │
│                                                                             │
│  airi-kv-{scriptName}:                                                      │
│  ├── `avatar/snapshots/{emotion}` ──> Pre-baked 400x400 WebP/PNG image      │
│  ├── `avatar/catalog` ──────────────> ["neutral", "smile", "happy", ...]    │
│  ├── `stickers/{stickerId}` ────────> Sticker WebP/PNG image                │
│  ├── `stickers/catalog` ────────────> [{ id, label, emotions }, ...]        │
│  ├── `system/prompt` ───────────────> Assembled persona + ACT/STICKER cues  │
│  └── `context/rolling` ─────────────> Rolling message history               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ 24/7 Serverless Presence
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. EDGE WORKER RUNTIME (apps/stage-edge)                                    │
│                                                                             │
│  Public CDN Endpoints:                                                      │
│  • GET /avatar/:emotion  ──> Returns cached avatar snapshot (Cache-Control) │
│  • GET /stickers/:id     ──> Returns cached sticker asset                   │
│                                                                             │
│  Discord Interaction Handler (/discord):                                    │
│  1. Receives slash command / user message                                   │
│  2. Calls LLM with system/prompt (includes ACT & STICKER guidelines)        │
│  3. LLM returns: "Hehehe, you caught me! <|STICKER airi-smug|>"            │
│  4. Worker parses out `<|STICKER airi-smug|>`                               │
│  5. Worker PATCHes Discord message with safe prose + attached/embedded art  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Modality A: The Photobooth Studio Architecture

### 3.1 Standard Semantic Emotion Slots
To ensure predictable emotion matching without infinite combinatorial explosion, Photobooth defines canonical semantic slots:

| Slot Key | Emotion Category | Default Fallback Mapping |
| :--- | :--- | :--- |
| `neutral` | Baseline / Standby | Model default rest pose |
| `smile` | Content / Friendly | `happy`, `smile`, `fun` |
| `happy` | Joy / Ecstatic | `joy`, `laugh`, `cheer` |
| `sad` | Sorrow / Melancholy | `sorrow`, `depressed`, `gloom` |
| `angry` | Frustration / Rage | `irritated`, `mad`, `furious` |
| `surprised` | Shock / Awe | `shock`, `wide_eyed`, `gasp` |
| `thinking` | Pondering / Curious | `confused`, `look_up`, `curious` |
| `wink` | Playful / Teasing | `wink_left`, `wink_right` |
| `custom:*` | User-defined (e.g., `smug`, `blush`) | Explicit slot name |

### 3.2 Dual Capture Workflows
In the Cloud Relay deployment wizard (`MessagingDiscord.vue`), the Photobooth Studio provides two capture modes:

#### 1. "Auto-Bake All" (1-Click Batch Capture)
1. The client inspects the active model's capability mappings (`airiCardStore.activeCard.extensions.airi.acting.emotions` or `displayModelsStore.getCapabilities()`).
2. Sequentially for each canonical slot:
   - Sets the emotion on the stage model: `modelStore.triggerEmotion(rawKey, 1.0)` / `live2dStore.triggerEmotion(rawKey, 1.0)` / `spineStore.selectVariantAndSkin(...)`.
   - Pauses for 80 ms to allow Three.js / Live2D physics, spring bones, and cloth settling.
   - Invokes `captureFrame()` from `RendererStage.vue`.
   - Crops to a 400×400 head/bust framing (top 35–40% of the canvas) and converts to WebP (`image/webp`, quality 0.85, ~35 KB per snapshot).
   - Populates the corresponding slot.
3. Total elapsed time: **< 1.5 seconds for all 8 slots**.

#### 2. "Interactive Studio" (Fine-Tuning & Posing)
1. Displays the slot cards in a visual grid showing their captured thumbnail.
2. Clicking a slot displays a live interactive viewport.
3. The user can adjust sliders (expression weights, head tilt, eye gaze) using existing `ModelCustomizer` controls.
4. Clicking **"📸 Snap Photo"** captures the exact frame and saves it to that slot.

### 3.3 Snapshot Caching & Persistence
Snapshots are persisted locally in IndexedDB (`localforage`) and indexed under:
`activeCard.extensions.airi.modules.discordRelaySnapshots = { [emotion: string]: { dataUrl?: string, updatedAt: number } }`
**Benefit**: Once captured, the user never has to re-take snapshots on future redeployments unless they deliberately choose to re-bake or change outfits.

---

## 4. Modality B: Reaction Stickers Integration

### 4.1 Existing Sticker Foundation in AIRI
AIRI already possesses an expressive, token-driven reaction sticker subsystem:
- **Component**: `packages/stage-pages/src/pages/settings/airi-card/components/tabs/acting/ActingSubTabStickers.vue`
- **Store**: `packages/stage-ui/src/stores/stickers.ts` (`useStickersStore`)
- **Token Grammar**: `<|STICKER id|>` (e.g. `<|STICKER airi-happy|>`)
- **Assets**: Built-in chibi stickers (`packages/stage-ui/src/assets/stickers/`) + Custom character stickers stored in `localforage` (`sticker-data-${id}`).

### 4.2 Deploy Flow Sticker Selection
During the Cloud Relay deployment wizard (`MessagingDiscord.vue`):
1. A **"Reaction Stickers Bundle"** panel displays the character's active sticker catalog.
2. The user can check/uncheck which stickers they want uploaded to Cloudflare KV.
3. The selected stickers' binary blobs are retrieved from `stickersStore.getStickerUrl` / `localforage`.
4. The compiled sticker prompt directives (`ActingConfig.stickerDirectivesPrompt`) are included in the Worker's `system/prompt` seed, teaching the edge LLM the exact valid IDs:
   ```markdown
   ## Instruction: Reaction Stickers
   You have access to character reaction stickers to punctuate conversation.
   Token Syntax: To send a reaction sticker, emit: `<|STICKER id|>`
   Available IDs:
   - `airi-happy`: Cheerful smile, laughter
   - `airi-smug`: Playful smirk, teasing
   - `airi-crying`: Dramatic tears
   ```

---

## 5. Cloudflare KV Layout & Edge Runtime (`stage-edge`)

### 5.1 KV Namespace Key Layout
The Worker's bound KV namespace (`MEMORY`) stores both character state and pre-baked media:

| Key Pattern | Value Type | Description |
| :--- | :--- | :--- |
| `avatar/snapshots/{emotion}` | Binary / Base64 WebP | 400×400 photobooth face snapshot |
| `avatar/catalog` | JSON string array | List of available emotion keys (`["neutral", "smile", ...]`) |
| `stickers/{stickerId}` | Binary / Base64 PNG/WebP | Selected reaction sticker asset |
| `stickers/catalog` | JSON string array | List of available sticker metadata objects |
| `system/prompt` | UTF-8 String | Complete character system instruction + ACT & STICKER guidelines |
| `context/rolling` | JSON string array | Rolling conversation history (capped at 50 turns) |

### 5.2 Public Asset Endpoints (`apps/stage-edge/src/index.ts`)
The worker exposes public asset endpoints with aggressive caching:

```typescript
// GET /avatar/:emotion
if (request.method === 'GET' && url.pathname.startsWith('/avatar/')) {
  const emotion = url.pathname.replace('/avatar/', '').replace(/\.[a-z]+$/, '')
  const data = await env.MEMORY.get(`avatar/snapshots/${emotion}`, 'arrayBuffer')
  if (!data)
    return new Response('Avatar emotion not found', { status: 404 })

  return new Response(data, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
    },
  })
}

// GET /stickers/:id
if (request.method === 'GET' && url.pathname.startsWith('/stickers/')) {
  const stickerId = url.pathname.replace('/stickers/', '').replace(/\.[a-z]+$/, '')
  const data = await env.MEMORY.get(`stickers/${stickerId}`, 'arrayBuffer')
  if (!data)
    return new Response('Sticker not found', { status: 404 })

  return new Response(data, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
    },
  })
}
```

### 5.3 Discord Interaction Handler & Priority Delivery
When an incoming message arrives via `POST /discord`:
1. The LLM generates the response.
2. The worker scans the response for markers:
   - **Sticker Token**: `<|STICKER\s+([a-zA-Z0-9_-]+)|>`
   - **ACT Emotion Token**: `<|ACT:emotion="([^"]+)"|>` or `<|ACT:\s*\{.*"emotion":\{"name":"([^"]+)".*\}|>`
3. Tokens are stripped from `safeContent` so Discord users see clean prose.
4. **Visual Priority Logic**:
   - **Priority 1: Sticker Match**: If a `<|STICKER id|>` was emitted and exists in `stickers/catalog`, attach or embed the sticker asset: `https://{workerUrl}/stickers/{id}`.
   - **Priority 2: ACT Emotion Match**: Else if an `<|ACT:emotion=...|>` was emitted, resolve to the closest photobooth slot (e.g. `happy` -> `smile`, `furious` -> `angry`). Attach or embed the avatar snapshot: `https://{workerUrl}/avatar/{matchedEmotion}`.
   - **Priority 3: Default Neutral**: If configured, attach `https://{workerUrl}/avatar/neutral` or omit visual attachments for text-only replies.
5. **Discord Webhook PATCH**:
   ```json
   {
     "content": "Aww, don't worry about it! Everything is going to be just fine~",
     "embeds": [
       {
         "image": {
           "url": "https://airi-character.subdomain.workers.dev/avatar/smile"
         }
       }
     ]
   }
   ```
   *Alternative: For Discord servers where link embeds are disabled, the worker can upload the asset directly as a multipart/form-data file attachment (`attachment://reaction.png`).*

---

## 6. Comparison: Server Compositing vs. Photobooth vs. Stickers

| Dimension | Server 2.5D Skia Compositing | Photobooth Face Mugshots | Reaction Stickers |
| :--- | :--- | :--- | :--- |
| **Edge Compute CPU** | 16–41 ms CPU time | **0 ms** (CDN cache hit) | **0 ms** (CDN cache hit) |
| **Model Compatibility** | Only proprietary sliced 2.5D | **100%** (VRM, Live2D, Spine, MMD) | **100%** (Any 2D image/chibi) |
| **User Asset Burden** | High (must have sliced PSDs) | **Zero** (Auto-bakes active avatar) | **Zero** (Built-ins or uploaded art) |
| **Visual Fidelity** | Sliced flat layers | **Full 3D/2D shaders, lighting, physics** | Stylized chibi / die-cut illustration |
| **Trigger Mechanism** | Server emotion parser | `<|ACT:emotion="..."|>` | `<|STICKER id|>` |
| **Edge Memory Cost** | ~15–30 MB WASM heap | ~280 KB total in KV (8 WebPs) | ~500 KB total in KV (10 stickers) |

---

## 7. Phased Implementation Plan

### Phase 1: Deploy Wizard Photobooth Studio Component
- Create `PhotoboothStudio.vue` inside `packages/stage-ui/src/components/modules/discord/components/`.
- Wire "Auto-Bake All" using active stage model's `captureFrame()` and settling delay.
- Persist snapshots in `activeCard.extensions.airi.modules.discordRelaySnapshots`.
- Embed into Step 2 of `MessagingDiscord.vue` deploy modal.

### Phase 2: Sticker Selector in Deploy Wizard
- Embed a sticker multi-select checklist in `MessagingDiscord.vue` referencing `stickersStore` and `card.extensions.airi.stickers`.
- Include active sticker directives in the assembled system prompt.

### Phase 3: CloudflareStageDeployer KV Upload
- In `CloudflareStageDeployer.deployWorker()`, upload:
  - `avatar/snapshots/{emotion}` for each baked slot.
  - `stickers/{id}` for each selected sticker.
  - `avatar/catalog` and `stickers/catalog` metadata.

### Phase 4: Worker Runtime Delivery (`apps/stage-edge`)
- Implement `GET /avatar/:emotion` and `GET /stickers/:id` endpoints in `apps/stage-edge/src/index.ts`.
- In `doInferenceAndReply`, parse `<|STICKER id|>` and `<|ACT:emotion="..."|>`.
- Dispatch Discord PATCH with embed image URL or multipart file attachment.
