# Proposal: Edge WASM Character Runtime

> **Status**: Proposed / Active Architecture
> **Author**: Richard Pinedo (@dasilva333 / azimuthal), with conceptual contributions from Göndul (@NURO)
> **Date**: 2026-10-11
> **Target Audience**: Core Maintainers, Edge Infrastructure Engineers, Community Modders
> **Companion Documents**: [`docs/proposal-in-memory-sandboxes-and-edge-wasm.md`](./proposal-in-memory-sandboxes-and-edge-wasm.md), [`docs/design-cloud-relay.md`](./design-cloud-relay.md), [`docs/feat-discord-revamp.md`](./feat-discord-revamp.md)
> **Relevant Skills**: [[airi-cloud-relay-infrastructure]], [[airi-discord-integration]], [[airi-generative-widgets]]

---

## 1. Executive Summary & Macro Context

### The Zero-Custody Vision
Project AIRI's **Cloud Relay** ("Vercel for Characters", located at `apps/stage-edge`) established a new standard for AI companions: characters that maintain a continuous, 24/7 proactive presence in Discord and external channels entirely on user-owned, serverless Cloudflare Workers—with **zero centralized custody, zero subscription servers, and zero ongoing VM hosting costs**.

However, today's edge presence is predominantly text-bound (constrained to 2,000-character Discord message strings). Traditional solutions to provide visual output rely on heavy, expensive infrastructure:
* Dedicated GPU machines running Stable Diffusion / Flux / ComfyUI,
* Or persistent Linux VPS servers running Node/Python canvas servers costing \$15–\$30/month.

### The Breakthrough: Serverless Edge WASM & 2D Tachie Compositing
By combining **Cloudflare Workers' native WebAssembly (WASM) execution environment**, **Cloudflare R2 object storage (with zero egress fees)**, and **compiled Rust raster libraries (`tiny-skia` / `image-rs`)**, we can grant edge characters a rich, dynamic visual presence:
1. **Edge Tachie (立ち絵) Sprite Compositing**: High-speed, in-memory alpha blending of transparent 2D character sprite layers (body poses, facial expressions, accessories, and mood effects) directly on Cloudflare edge nodes in **under 25 milliseconds**.
2. **Dynamic Visual Status Cards & RPG Badges**: Serverless rendering of API token budget monitors, mood gauges, and character progression sheets.
3. **Edge Script Execution via QuickJS-WASM**: Safe, sandboxed code execution for `/eval` Discord slash commands and autonomous budget self-regulation without running backend containers.

This document serves as the canonical specification for the **Edge WASM Character Runtime**, decoupling it from the client-side desktop/browser workstation sandbox ([`docs/proposal-in-memory-sandboxes-and-edge-wasm.md`](./proposal-in-memory-sandboxes-and-edge-wasm.md)).

---

## 2. Demystifying the WASM Tech Stack: Edge vs. Client

To prevent architectural confusion, we distinguish between the **Client-Side Workstation** and the **Serverless Edge Worker**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THE TWO WASM REALMS                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   CLIENT WORKSTATION (Browser / Electron)       SERVERLESS EDGE (Cloudflare Workers)   │
│   Document: proposal-in-memory-sandboxes.md     Document: proposal-edge-wasm-runtime.md│
│   Location: packages/stage-ui/src/libs/sandbox  Location: apps/stage-edge              │
│                                                                                        │
│   • POSIX Shell: just-bash (Rust in WASM)       • Image Compositor: tiny-skia /        │
│   • Virtual RAM Disk: /workspace in memory        image-rs (Rust in WASM)              │
│   • TypeScript Compiler: @tsc-rs/wasm (<2ms)    • Edge Script Runner: QuickJS-WASM     │
│   • Generative UI: srcdoc iframe micro-apps     • Trigger: Discord Webhooks & Commands │
│   • Target: User's local browser / desktop      • Storage: Cloudflare KV & R2 Bucket   │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Why `@tsc-rs/wasm` Belongs on the Client
* In the desktop/browser sandbox, the agent writes raw TypeScript components (`weather.ts`). `@tsc-rs/wasm` compiles TypeScript to JavaScript in 2ms so the local UI can mount it into an iframe.
* On the Cloudflare Worker edge, the worker does **not** need to compile TypeScript components on the fly. Instead, the edge runtime needs **raw computational performance**: decoding PNG byte buffers, blitting pixels with alpha blending, and encoding them into WebP/PNG byte streams. That is the domain of **native Rust compiled to `wasm32-unknown-unknown`**.

---

## 3. Pillar 1: Edge Tachie (立ち絵) Sprite Compositing

### 3.1 What is Tachie Compositing?
In visual novels (VN) and anime games, a *tachie* is a standing character illustration constructed from layered 2D transparent slices:

```
┌──────────────────────────────────────────────────────────────┐
│                    TACHIE LAYER PIPELINE                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   [Layer 4: Prop / FX]      blush_heavy.png + sweat_drop.png │
│              ▼                                               │
│   [Layer 3: Mouth]          mouth_pout_open.png              │
│              ▼                                               │
│   [Layer 2: Eyes / Brows]   eyes_dart_left.png               │
│              ▼                                               │
│   [Layer 1: Base Pose]      pose_school_uniform.png          │
│              ▼                                               │
│   ════════════════════════════════════════════════════════   │
│   OUTPUT: Composite 768x1024 WebP/PNG Reaction Portrait       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Combinatorial Expression Multiplier
Rather than rendering thousands of static images:
* **Base Poses**: 3 variants (Standing, Thinking, Hands on Hips)
* **Outfits**: 2 variants (School Uniform, Casual Jacket)
* **Eye States**: 8 variants (Normal, Sparkle, Half-Closed, Looking Away, Annoyed, Winking, Crying, Shocked)
* **Mouth States**: 8 variants (Closed Smile, Open Grin, Pout, Flat Line, Gaping, Cat Mouth, Smirk, Trembling)
* **Expression FX**: 5 overlays (Light Blush, Heavy Blush, Shadow Forehead, Sweat Drop, Exclamation Mark)

$$\text{Total Combinations} = (3 \times 2) \times 8 \times 8 \times 5 = 1,920 \text{ unique visual expressions}$$

Storing 1,920 full illustrations at 500KB each would require **nearly 1GB of bandwidth and storage**.
With layered tachie compositing, the total asset payload of all 26 slices combined is **less than 4.5MB**.

### 3.3 The Rust WASM Compositing Engine
Using [`tiny-skia`](https://github.com/RazrFalcon/tiny-skia) or [`image-rs`](https://github.com/image-rs/image) compiled to WASM:
* **Algorithm**:
  1. Initialize raw RGBA target pixel buffer of dimensions $W \times H$ (e.g. $768 \times 1024 \times 4 \text{ bytes} \approx 3.14\text{MB}$).
  2. Blit base pose buffer into target.
  3. For each active overlay slice (eyes, mouth, blush), perform Porter-Duff source-over alpha blending:
     $$C_{\text{out}} = C_{\text{src}} \times \alpha_{\text{src}} + C_{\text{dst}} \times \alpha_{\text{dst}} \times (1 - \alpha_{\text{src}})$$
  4. Encode the composite RGBA buffer into a lightweight PNG or WebP byte array.
* **Execution Benchmark**:
  - Blending 4 layers at $768 \times 1024$ resolution in optimized Rust WASM takes **12ms to 22ms** of CPU execution time.
  - Cloudflare Workers Free allows **up to 50ms** CPU execution time per request; Paid allows 50ms standard or 30s unbounded.
  - The entire compositing operation comfortably fits inside a single Cloudflare Worker invocation!

---

## 4. Pillar 2: Edge Storage & Caching Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               EDGE STORAGE & CACHE FLOW                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   1. Persistent Storage: Cloudflare R2 Bucket                                          │
│      • Zero egress fees                                                                │
│      • Path: r2://airi-assets-{botId}/tachie/{characterId}/                            │
│        ├── manifest.json                                                               │
│        ├── base/pose_default.png                                                       │
│        ├── eyes/sparkle.png                                                            │
│        └── mouth/smile.png                                                             │
│                                                                                        │
│   2. Point-of-Presence Edge Cache (caches.default)                                     │
│      • Frequently used layers cached in Cloudflare CDN RAM                             │
│      • Fetch latency for hot layers: 2ms - 5ms                                         │
│                                                                                        │
│   3. Worker Isolate Execution                                                          │
│      • Fetch recipe layers from edge cache                                             │
│      • Call tachie_blend(layers) WASM export                                           │
│      • Stream PNG to Discord Webhook                                                   │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Manifest Schema (`manifest.json`)
The character card includes a manifest mapping emotional states to layer combinations:

```json
{
  "characterId": "airi-core",
  "dimensions": { "width": 768, "height": 1024 },
  "recipes": {
    "joy": {
      "base": "base/pose_standing.png",
      "eyes": "eyes/sparkle.png",
      "mouth": "mouth/grin_open.png",
      "fx": "fx/blush_light.png"
    },
    "embarrassed": {
      "base": "base/pose_hands_on_hips.png",
      "eyes": "eyes/dart_away.png",
      "mouth": "mouth/wavy_pout.png",
      "fx": "fx/blush_heavy.png"
    },
    "neutral": {
      "base": "base/pose_standing.png",
      "eyes": "eyes/normal.png",
      "mouth": "mouth/slight_smile.png"
    }
  }
}
```

---

## 5. Pillar 3: Discord Interaction & Cadence Control

### 5.1 Slash Command vs. Conversational Turn

```
                     ┌──────────────────────────────────────────┐
                     │         Incoming Discord Event           │
                     └─────────────────────┬────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
       Slash Command (/selfie)                       Conversational Turn
       • Explicit user invocation                    • Natural LLM dialogue response
       • Always returns composite image              • Evaluates Cadence Policy
```

### 5.2 Cadence & Anti-Spam Trigger Policy
Attaching an image to every single message in a Discord channel creates visual clutter and consumes excessive channel real estate. The worker applies a **Selective Cadence Policy**:

1. **Emotional Delta Threshold**:
   - Compares the previous turn's emotion ($E_{t-1}$) with the current turn's emotion ($E_t$).
   - If the delta is significant (e.g. from `neutral` to `embarrassed` or `shocked`), trigger a reaction sprite.
2. **Turn Cooldown Window**:
   - Minimum gap of $N$ messages (e.g. at most 1 sprite every 5 turns in public channels).
3. **Random Probability Roll**:
   - Configurable percentage roll (e.g. 20% chance on high-affinity turns).
4. **Explicit Trigger Phrases**:
   - User asks *"How are you looking today?"* or *"Show me your reaction"*.

### 5.3 Discord Multipart Webhook Response
When the policy triggers:
1. Cloudflare Worker defers the interaction with Discord type `5` (DEFERRED).
2. The Worker executes LLM inference, extracts ACT emotion cues, and composites the sprite via WASM.
3. The Worker issues a `PATCH` request to `https://discord.com/api/v10/webhooks/{appId}/{token}/messages/@original` formatted as `multipart/form-data`:
   - `payload_json`: `{ "content": "Assistant dialogue text..." }`
   - `files[0]`: Binary PNG buffer with filename `reaction.png`.
4. Discord renders the character's reaction illustration alongside the text message!

---

## 6. Göndul’s Vision: Autonomous Edge Workspace & Status Cards

As Göndul noted during architectural review:
> *"Giving the character their own little workspace to experiment with tools and code? Such a good idea! Maybe it could also support a little debugging tool, or an API budget tracker that lets the character know when to save money, use a cheaper option, or leave a task for later."*

This insight expands the Edge WASM Runtime beyond sprites into **Dynamic Operational Cards**:

### 6.1 The Token & Financial Budget Tracker
The edge character can track its own token usage in Cloudflare KV:
* `budget/monthly_allowance`: e.g. \$10.00
* `budget/accumulated_spend`: e.g. \$4.28
* When spend approaches 80%:
  - The character autonomously switches system instructions to select cheaper models (`gemini-2.5-flash-lite` or `deepseek-v3`) instead of premium frontier models.
  - The character can explain its decision to the user: *"I'm pacing our API budget for the rest of the week, so I'll keep my thoughts concise!"*

### 6.2 Edge Dynamic Status Cards (SVG $\rightarrow$ PNG via WASM)
Using `resvg` / `tiny-skia` in WASM, the edge worker can render rich visual cards:
* **RPG Character Status Card**: Current mood, intimacy level, active buffs, and memory count.
* **System Telemetry Badge**: Health, latency, edge location (e.g. `IAD`, `NRT`, `FRA`), and uptime.
* **API Burn Meter**: A visual battery/gauge card showing budget health.

---

## 7. Phased Implementation Roadmap

* **Phase 1: Rust WASM Compositor Core (`@proj-airi/wasm-tachie`)**
  * Author lightweight Rust crate using `tiny-skia`.
  * Expose `blend_layers(layers: Vec<Uint8Array>) -> Vec<u8>` to WebAssembly.
  * Validate compilation under `wasm32-unknown-unknown` and verify bundle size (< 1.2MB uncompressed).
* **Phase 2: Edge R2 Storage & Caching Layer**
  * Configure Cloudflare R2 bucket bindings in `apps/stage-edge/wrangler.toml`.
  * Implement edge caching pipeline (`caches.default`) for sprite slices in `apps/stage-edge/src/tachie/`.
* **Phase 3: Discord Slash Command & Multipart Dispatch**
  * Register `/selfie` and `/tachie` slash commands in `apps/stage-edge/src/discord/client.ts`.
  * Implement multipart/form-data webhook builder for attaching composite PNGs.
* **Phase 4: Emotional Cadence & Recipe Matcher**
  * Integrate ACT emotion parser (`llm-marker-parser`) into the edge worker inference pipeline.
  * Add configurable cadence gates (delta threshold, cooldown, probability roll).
* **Phase 5: Studio Authoring & One-Click Deploy**
  * Add Tachie Layer Manager in AIRI Card Editor (`packages/stage-pages/src/pages/settings/airi-card/`).
  * Extend `CloudflareStageDeployer` to package sprite layers and upload directly to R2 alongside worker deployment.
* **Phase 6: Visual Status Cards & Budget Tracker**
  * Implement KV-backed API budget tracking and autonomous model down-scaling.
  * Integrate SVG-to-PNG template rendering for Discord telemetry cards.
