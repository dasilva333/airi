# Proposal: Unified DJ & Music Engine (Tri-Model Generative + Spotify Catalog)

> **Status**: Proposed RFC — Revision 2
> **Document**: `docs/proposal-comfyui-generative-music-dj-engine.md`
> **Target Audience**: Core Developers, Audio/Music Engineers, UI Integrators
> **Key References**: `packages/stage-ui/src/stores/dj-deck.ts`, `airi-audio-server` (`audio.cpp`), `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/comfyui.ts`
>
> **Revision 2 changes** (detailed in §3):
> 1. The tool surface is delivered over **MCP (Streamable HTTP) hosted directly by `airi-audio-server`** — not as bespoke AIRI builtin tools, and not through a separate proxy app.
> 2. The first LLM surface is a single **`music` hub tool** with a five-value action enum (`plan`, `generate`, `status`, `list`, `cancel`), mirroring the established `text_journal` / `image_journal` hub convention rather than the six discrete `dj_*` tools.
> 3. **`plan` is promoted to a first-class co-creation step.** ABC notation becomes the artifact the agent reasons over and mutates *before* committing to an acoustic render, instead of a metadata field attached to a finished track. Like every other action it returns a receipt; the score arrives through `status`.
> 4. The `mcp.json` entry is the single **activation record**; the MCP endpoint is **advertised** by the server via `/v1/capabilities` rather than derived by string-munging the provider `baseUrl`.

This document outlines the architectural design for enabling AI characters to act as dynamic, real-time DJs—interweaving AI-generated tracks (via a Tri-Model Generative Engine: Local MiniMax Music 3.0 & YuE 2 natively served via **AIRI Audio Server / `audio.cpp`**, with remote Suno v6 fallback) with real-world streaming catalogs (via Spotify) while interactively adjusting the setlist and hosting radio-style voiceover transitions in response to ongoing conversation.

---

## 🧭 1. Vision & Goals

Currently, AIRI supports visual generative artistry (via ComfyUI/Replicate) and 3D item manifestation (via TRELLIS). This proposal introduces a **Unified Music Provider and AI DJ Engine** that gives the character both an infinite record crate (Spotify streaming catalog) and a private music production studio supporting **high-performance local C++ audio inference and cloud fallback**:

*   **The Tri-Model Generative Engine**:
    1.  **Local Primary — AIRI Audio Server (`audio.cpp` Native Engine)**:
        *   **MiniMax Music 3.0 & MiniMax H3 Text-to-Audio**: High-fidelity neural music and soundscape generation running natively in C++/CUDA via `audio.cpp` without complex Python/ComfyUI dependency stacks.
        *   **YuE 2 & YuE AR LoRA**: Score-first on-device song generation (<8 GB VRAM) with symbolic score planning, musical key transposition, and full lyric alignment.
        *   *(Legacy/Alternative: Optional ComfyUI node integration for custom graph tinkerers).*
    2.  **Remote Option — Suno v6 (Cloud API)**: Fast, zero-local-VRAM cloud fallback with stem isolation, microediting single lyrics, and tiered creativity (V6, V6 Wild, V6 Mini).
    3.  **Catalog Option — Spotify (Streaming Catalog)**: Searches and streams real licensed music from Spotify's global library (e.g., *"Play some late 90s French house"*).
*   **Three Operational DJ Modes**:
    1.  **Generative Mode**: Synthesizes 100% original music on the fly based on chat context, themes, or user mood (e.g., *"Make a cozy lo-fi song about drinking matcha while coding"*).
    2.  **Catalog Mode (Spotify)**: Searches and streams real licensed music from Spotify's global library.
    3.  **Hybrid DJ Mode (The Radio Experience)**: Blends real tracks with custom-generated tracks, beats, and interludes, acting as an autonomous radio host.
*   **"Always on Deck" Continuous Playback**: Zero-latency transitions between tracks. While Track A is playing, Track B is pre-queued or pre-generated on deck.
*   **Zero-Downtime Fail-Safe (GPU / Fallback)**: If local GPU generation encounters an OOM error, latency spike, or the audio server is offline, the DJ loop gracefully falls back to Suno v6 cloud generation or Spotify catalog search without interrupting playback.
*   **Radio DJ Banter & Audio Ducking**: The character can speak over track intros/outros (e.g., *"Coming up next, one of my favorite tracks from Daft Punk..."*). Music automatically ducks to 20–25% volume during speech and swells back up seamlessly.
*   **Character Musical Identity**: Character cards (`extensions.airi.music`) define distinct musical tastes, favorite genres, BPM preferences, and DJ banter style.
*   **Plan-First Co-Creation (ABC Score as Dialogue)**: Before a single audio sample is rendered, the agent produces a compact ABC notation score and *interprets it in conversation* — key, tempo, chord movement, where the drop lands. The user steers in natural language, the score is mutated, and only the agreed composition is committed to the renderer. Planning costs ~3–20 seconds against ~27 minutes for a full render, which is precisely what makes composition interactive rather than a wait (§3.F).

---

## 🎛️ 2. Unified Track Model & Abstraction

To AIRI's DJ brain, all tracks share a normalized data structure regardless of whether they originate from Spotify, local ComfyUI/YuE2 generation, Suno cloud API, or local files:

```typescript
export interface DJTrack {
  id: string
  title: string
  artist: string // e.g., "Daft Punk", "AIRI x YuE2", or "AIRI x Suno"
  genre?: string
  mood?: string
  bpm?: number
  durationMs: number
  source: 'spotify' | 'comfyui' | 'yue2' | 'suno' | 'local'

  // Playback Handles
  spotifyUri?: string // spotify:track:...
  audioBlobKey?: string // IndexedDB/localforage key for local audio
  audioStreamUrl?: string // ComfyUI/YuE2 output URL or local file URL
  artworkUrl?: string // Album cover or generated stage background thumbnail

  // Generation & Composition Metadata
  caption?: string
  lyrics?: string
  abcScore?: string // Raw human-readable ABC notation string
  scorePlan?: {
    tempo: number
    keySignature: string
    chordProgression?: string[]
  }
  lora?: {
    adapterId: string // e.g. "synthwave_lead", "ar_lora_inst_v3abc"
    scale: number // 0.0 to 1.5
  }
  stems?: {
    vocalsUrl?: string
    instrumentalUrl?: string
  }
}
```

> **Phase 1 shape.** Until the deck engine exists (§6), the `music` hub (§3.D) returns a slimmer record:
> `{ id, title, audioUrl, durationMs, model, abcScore?, createdAt }`.
> `DJTrack` remains the Phase 2 superset that adds playback handles, deck state, stems, and lossless audio analysis. Every Phase 1 field name is chosen to match its `DJTrack` counterpart so the eventual chat chip and Now Playing widget render Phase 1 output with no translation layer — the request parameter `durationSeconds` is the one intentional exception, because it mirrors the REST endpoint's `duration_seconds`.

---

## 🛠️ 3. Transport & Tool Surface (MCP-First)

### A. Why MCP, Hosted by `airi-audio-server`

The music tool surface is **not** implemented as bespoke AIRI builtin tools. `airi-audio-server` hosts a Model Context Protocol endpoint over **Streamable HTTP** alongside its existing REST API, and AIRI connects to it declaratively — exactly the way `open-websearch` and `@modelcontextprotocol/server-filesystem` are connected today.

| Concern | Bespoke builtin (`generate-music.ts`) | Separate MCP proxy app | **MCP on `airi-audio-server` (chosen)** |
| :--- | :--- | :--- | :--- |
| New AIRI client files | Tool file plus six scattered touch points | New proxy package | Declarative entry only |
| Where tool logic lives | Split between renderer and server | Thin proxy re-calling REST | Co-located with the implementation |
| Extra runtime processes | 0 | +1 Node.js process | 0 — the server already runs |
| Tool discovery | Hardcoded in `builtinTools()` | `mcp_list_tools` | `mcp_list_tools` |
| Network hops per generation | Renderer → server | Renderer → bridge → proxy → server | Renderer → bridge → server |
| Server changes | None | None | MCP transport + tool defs (needed anyway) |

The Electron MCP manager already supports this natively — no new plumbing required:

* `ElectronMcpHttpServerConfig` (`url`, `headers?`, `enabled?`) is part of the `ElectronMcpServerConfig` union in `apps/stage-tamagotchi/src/shared/eventa.ts`.
* `apps/stage-tamagotchi/src/main/services/airi/mcp-servers/index.ts` imports `StreamableHTTPClientTransport`, branches in `createTransport()`, and reports `transport: 'http'` in runtime status.
* `isHttpServerConfig()` is literally `'url' in config`.

A dedicated `apps/airi-audio-mcp-server` proxy package is explicitly rejected: it would be a process whose entire job is to re-call `POST /v1/audio/music` on the server that already defines the semantics.

### B. Endpoint Advertisement (no URL derivation on the client)

AIRI never constructs the MCP URL. `airi-audio-server` advertises it in the capabilities payload AIRI already fetches for the speech provider:

```json
// GET /v1/capabilities
{
  "...": "existing speech capability fields",
  "mcp": { "url": "http://127.0.0.1:8095/mcp", "transport": "streamable-http" }
}
```

This keeps a single source of truth on the server side, survives custom ports and reverse proxies, and reduces the client to one question: *did the server advertise an MCP endpoint?* Extra fields are ignored by the existing `getSpeechCapabilities` consumer, so the addition is backward-compatible.

**Fallback if advertisement is unavailable:** derive the URL from the resolved provider `baseUrl` by stripping a trailing `/v1/` and appending `/mcp`. This is a compatibility path, not the contract.

### C. Activation: `mcp.json` Is the Record

The `airi-audio-server` provider is `deployment: 'local'` and keyless, so `isProviderConfigured()` short-circuits to `true` before it ever consults `addedProviders` — checking it would be a no-op on a fresh install. Rather than invent a second activation concept, the **`mcp.json` entry itself is the activation record**, exactly as the presence of the `open-websearch` entry is what makes web search provisioned.

```
LLM tool toggle: OFF → ON
        │
        ├─ entry already in mcp.json?
        │     └─ YES → reuse its url. No network call. Done.
        │
        └─ NO → GET {baseUrl}capabilities   (2.5s budget)
                 ├─ reachable + mcp.url present → write { url, enabled: true }, applyAndRestart
                 └─ unreachable / no mcp.url    → refuse the toggle, show dialog,
                                                  route to /settings/providers/speech/airi-audio-server
```

Three properties fall out of this for free:

* **Hard blocker at enable time.** The toggle cannot be turned on unless the server is reachable and advertising MCP.
* **No liveness requirement afterwards.** Once written, the URL resolves from `mcp.json` even with the server stopped.
* **No new persisted state.** Disabling music removes the ACL token but leaves the `mcp.json` entry intact — identical to web search.

### D. Phase 1 Tool Surface: the `music` Hub

The hub convention is established house style: `text_journal` exposes `action: ['create', 'search']`; `image_journal` exposes `action: ['create', 'apply']` plus a `mode` enum. Music follows it with a single MCP tool named **`music`** on the `airi-audio-server` server, invoked through the generic `mcp_call_tool` meta-tool as `airi-audio-server::music`.

| `action` | Purpose | Blocking? | Returns |
| :--- | :--- | :--- | :--- |
| `describe` | Return the ABC format, voice layout, engine limits, and a score template | No | capability contract |
| `plan` | Generate or mutate an ABC score without acoustic rendering | No — receipt only | `planId`, `state`, `title`, `next` |
| `generate` | Commit a score/prompt to the NAR ODE renderer | No — receipt only | `jobId`, `state`, `next` |
| `status` | Poll a `plan` or `render` job | No | `jobId`, `kind`, `state`, `progress`, `track`, `plan` |
| `list` | Browse and search the generated library | No | `tracks[]` |
| `cancel` | Abort a queued or running job | No | `jobId`, `state`, `cancelSupported` |

**Arguments** — one flat schema, all non-action fields optional and validated per action, exactly like `text_journal`:

```json
{
  "action": "plan" | "generate" | "status" | "list" | "cancel",

  "prompt": "melodic synthwave, analog synths, driving bassline, 120 bpm",
  "lyrics": "[Verse]\nNeon reflections on the wet asphalt...\n[Chorus]\nRunning through the grid...",
  "title": "Neon Horizon",
  "model": "yue-2" | "minimax-music-3",
  "durationSeconds": 60,
  "cot": "full" | "melody" | "off",
  "instrumental": false,
  "temperature": 0.8,

  "abcScore": "X:1\nT:Neon Horizon\nM:4/4\nL:1/8\nQ:1/4=120\nK:Cm\n...",
  "planId": "plan-ember-quartz-tide",
  "jobId": "song-velvet-thunder-lark",
  "query": "synthwave",
  "limit": 5
}
```

Why a hub instead of five discrete MCP tools (`music_plan`, `music_generate`, …): AIRI's tool gate and prompt builder both optimize for context budget, and `mcp_list_tools` surfaces one schema per tool. A single discriminated-action schema costs a fraction of five, which matters for the small local models AIRI explicitly protects.

**Discoverability is the price of the MCP path.** The tool is not in the model's native toolset — it is reachable only through `mcp_list_tools` — and nothing in the system prompt announces that a server is connected. In practice a character reports that it cannot make music until it is asked to list its MCP tools, which is exactly what happened on the first live connection. Injecting a "you have MCP tools" line into the system prompt was deliberately rejected: it spends context on every turn for one optional capability. The guidance therefore lives in the UI — the card tools tab, the Quick Settings tile, and the Sound Studio strip all tell the user to ask the character to list its MCP tools.

**The description is load-bearing.** A receipt-returning `generate` only works if the model knows to poll, and how often. The `status` action's description must state the cadence explicitly, with measured numbers rather than optimistic ones — YuE 2 renders at roughly **10–15x real time** on an 8GB laptop GPU (15x in the shootout benchmarks, 10.7x on a warm 30s render through the server), so 30 seconds of audio is 5–8 minutes and a 2 minute track is 20–27 minutes. An under-stated budget is worse than no guidance: a model told "1–3 minutes" declares a healthy render failed at the four-minute mark.

### E. The ABC Contract (and Why It Cannot Simply Be Published)

The score is **not parsed**. `pipeline.cpp` builds the AR prompt as:

```
<eod> {style + lyrics + cot instruction} <abc> {score tokens} </abc> <music> …
```

An external score is tokenised and inserted as a prefix; `</abc>` is emitted immediately so the model proceeds straight to the acoustic stage conditioned on it. There is no grammar, no validator, and no MIDI transcription — which is precisely why the tool cannot "self-describe its ABC support" by exporting a schema. The only meaningful contract is *the distribution YuE 2 was trained on*:

| Convention | What to emit |
| :--- | :--- |
| Headers | `X: T: M: L: Q: K:` |
| Voices | `V: Vocal` (lead; `Z4|` for instrumental sections) + `V: Ins` (melody and harmony) |
| Chords | Quoted, on the instrumental staff: `"G#m"G2B2d2g2` |
| Sections | `% intro`, `% verse`, `% chorus`, `% drop` |
| Rests | `Z` / `z` |
| Off-distribution | Modal keys (`K:Dmix`), odd meters (`6/8`, `7/8`), literal repeats (`\|: … :\|`), stacked chords (`[CEG]`) |

Two consequences the model must be told, or it will build the wrong mental model:

1. **The score biases, it does not dictate.** Repeat marks and exact voicings are suggestions conditioned on, not instructions honoured.
2. **Duration is independent of the score.** Output length comes from `durationSeconds` via the semantic token budget; a four-bar loop requested at 120 seconds still renders ~120 seconds.

Because AIRI's MCP bridge exposes only `listTools` and `callTool`, MCP *resources* and *prompts* would never reach the model. The contract therefore ships as an on-demand `describe` action returning machine-readable capabilities plus a canonical `abc.template`, while the always-on tool description stays lean (~900 chars) to protect the context budget. `GET /v1/audio/music/describe` returns the same object for REST clients.

`cot` is validated rather than ignored: supplying `abcScore` with `cot: "off"` is rejected, because the engine only consumes an external score when planning is on (`melody` or `full`). The requested `cot` is now always forwarded — previously it was dropped whenever a score was supplied, so callers believed a mode had been applied when it had not.

### F. Plan-First: ABC as the Conversational Artifact

Revision 2 promotes planning from a side effect to the center of the interaction. Measured on 8GB hardware, the symbolic AR pass takes **~3–20 seconds** (~115 tokens/sec) versus **~27 minutes** for a 2-minute rendered track — under 1.2% of total time, for a large coherence gain. That asymmetry is what makes the following loop affordably interactive:

1. Agent calls `plan` → receives a receipt (`planId`, `state`, `next`), where `next` is the server's own polling guidance.
2. A `status` poll on that id returns `{ plan: { abcScore, summary, tempo, keySignature, bars } }`.
3. Agent **shows the notation to the user and interprets it** — key, tempo, chord movement, where the drop lands.
4. User steers in natural language: *"transpose the bridge darker, move the drop to bar 16."*
5. Agent calls `plan` again with the modified `abcScore`, or edits the ABC directly.
6. Only once the score is agreed does the agent call `generate` with the final `abcScore`.

**The edited score is the actual input, not a suggestion.** `generate` accepts an `abcScore` string that is forwarded verbatim to the engine as `--request-option abc="..."`, bypassing text-derived structure entirely. That means the thing the user and agent hash out in conversation — a transposed bridge, a moved drop, a tempo change — is exactly what gets rendered, and the completed track's `abcScore` echoes the score that produced it. This is the difference between "prompt a song" and "compose together": the intermediate representation is editable, inspectable, and cheap to iterate on before any GPU time is spent.

Because ABC is compact human-readable text, steps 3–5 need no audio at all. It also gives the Sound Studio panel (§8) a real artifact to render with `abcjs`, and makes the user's edits and the agent's edits the same object.

The extra poll is the price of the constraint below, and it buys something in exchange: the user can keep talking while a plan renders, and a slow `cot=full` pass no longer holds the conversation hostage.

### G. Timeout Reality: Every Action Returns a Receipt

The MCP manager caps every `callTool` at **`mcpRequestTimeoutMsec = 10_000`** per request and **`mcpRequestMaxTotalTimeoutMsec = 15_000`** total, both hardcoded constants in `apps/stage-tamagotchi/src/main/services/airi/mcp-servers/index.ts`. With `resetTimeoutOnProgress` left at its default (`false`), the per-request timer never resets, so 10 seconds is the real ceiling and 15 seconds only bounds retries. The transport has no progress-notification handling either, so a long call cannot stream keepalives.

A `plan` pass measured at 3–20s therefore cannot be a blocking action. **The resolution is structural rather than a timeout override: no action blocks.** `plan` and `generate` both return a receipt immediately and the caller polls `status` — which is also why the async job model (§3.H) is not over-engineering but the only shape that fits the transport.

This keeps the required AIRI-side change surface at zero for the manager: no `timeoutMs` field, no per-server override, no change to `mcp-servers/index.ts at all.

### H. Receipt & Job Model

Both planning and rendering are jobs. Receipts carry their own polling guidance so the model does not have to infer cadence:

```
plan     → { planId, state: "queued", next: "call status with jobId=plan-ember-quartz-tide in ~10s" }
generate → { jobId,  state: "queued", next: "call status with jobId=song-velvet-thunder-lark in ~45s" }

status   → { jobId,
             kind: "plan" | "render",
             state: "queued" | "running" | "done" | "failed" | "cancelled",
             progress?: { percent, stage? },
             plan?:   { planId, abcScore, summary, tempo, keySignature, bars },
             track?:  Track }
```

**Identifiers are readable slugs, not timestamps.** Plans get `plan-<word>-<word>-<word>` and renders get `song-<word>-<word>-<word>` (e.g. `plan-night-thunder-drift`), drawn from a fixed vocabulary with collisions checked against live jobs and the library. Characters read receipts aloud, and `plan_mvlqsf8102` is noise to a listener.

`Track` = `{ id, title, audioUrl, durationMs, model, abcScore?, createdAt }` — the same record the Sound Studio already renders, so a completed job drops straight into the library and into `list` results.

The `next` string is deliberately human-readable rather than structured: it is injected into the model's context, and a natural-language instruction survives summarization better than a `retryAfterMs` integer that the model may ignore.

Job state survives across turns and `status` calls. It does **not** survive an `airi-audio-server` restart — job records are in-memory, so an unknown `jobId` returns a not-found tool error. Completed tracks do survive, because the library is written to disk; `list` still returns them after a restart. Tool descriptions should tell the model to treat a not-found error after a restart as "re-plan", not as a crash.

`cancel` is real, not cosmetic: each job owns an `AbortController`, and aborting it kills the spawned `audiocpp_cli` process so a running render stops instead of quietly finishing in the background and holding the GPU. A completion that races a cancel is discarded rather than resurrecting the job.

---

## 🧰 4. Deck Tool Surface (Phase 2)

Once the deck engine exists (§6), the consciousness orchestrator is additionally equipped with unified tools allowing it to seamlessly curate both generative and catalog music:

### A. `dj_queue_track`

Queues a track into the DJ deck from either a generative prompt or a catalog query.
*   **Arguments**:
    ```json
    {
      "source": "auto" | "spotify" | "comfyui" | "yue2" | "suno",
      "query": "Daft Punk - Digital Love",
      "caption": "french filter house, punchy vintage drums, groovy slap bass, 124 bpm",
      "lyrics": "[Intro]\n[Verse]\nLast night I had a dream about you...",
      "title": "Neon Dreams",
      "priority": "next" | "tail" | "immediate_fade"
    }
    ```
*   `source`: `"auto"` (DJ decides based on mode/preference), `"spotify"`, `"comfyui"`, `"yue2"`, or `"suno"`.
*   `priority`:
    *   `"tail"`: Appends to the end of the setlist.
    *   `"next"`: Pre-loads directly into the "On Deck" slot (Track B).
    *   `"immediate_fade"`: Immediately crossfades into the new track upon readiness.

### B. `dj_search_catalog`
Explicitly queries the Spotify catalog for tracks, albums, or playlists.
*   **Arguments**:
    ```json
    {
      "query": "Japanese City Pop 1980s",
      "type": "track" | "album" | "playlist",
      "limit": 5
    }
    ```

### C. `dj_get_status`
Queries real-time playback telemetry, current deck state, and upcoming queue.
*   **Returns**:
    ```json
    {
      "playbackState": "playing",
      "currentTrack": {
        "id": "spotify:track:2G8F6i...",
        "title": "Digital Love",
        "artist": "Daft Punk",
        "source": "spotify",
        "durationMs": 298000,
        "elapsedMs": 142000,
        "remainingMs": 156000
      },
      "onDeckTrack": {
        "id": "gen_88f21",
        "title": "Matcha Code Beat",
        "artist": "AIRI x YuE2",
        "source": "yue2",
        "status": "ready"
      },
      "mode": "hybrid",
      "queuedCount": 2,
      "volume": 0.8
    }
    ```

### D. `dj_control`
Direct playback and transition controls.
*   **Arguments**:
    ```json
    {
      "action": "fade_to_next" | "skip" | "pause" | "resume" | "set_volume" | "clear_queue",
      "fadeDurationSeconds": 4
    }
    ```

### E. `dj_plan_composition` (Music Room / Sound Studio)
Deck-level wrapper over `music { action: "plan" }` (§3.D). Initiates the fast symbolic planning phase (~3–20s). Generates or mutates an ABC musical notation score without running heavy acoustic diffusion.
*   **Arguments**:
    ```json
    {
      "action": "generate_new" | "mutate_existing",
      "style": "cyberpunk electro complextro 128 bpm",
      "lyrics": "[intro]\nSystem online...",
      "cotMode": "melody" | "full",
      "existingAbcScore": "X:1\nT:Neon Drive\nM:4/4\nK:Cm\n...",
      "mutationInstructions": "transpose the chorus into a dark minor key and double the bassline tempo",
      "loraAdapter": "ar_lora_inst_v3abc",
      "loraScale": 1.0
    }
    ```
*   **Returns**:
    ```json
    {
      "planId": "plan-ember-quartz-tide",
      "abcScore": "X:1\nT:Neon Drive\nM:4/4\nL:1/8\nQ:1/4=128\nK:Cm\n|: \"Cm\" c2 e2 g2 c'2 | \"Ab\" _A2 c2 e2 _a2 :|",
      "summary": "Generated 64 bars of 128 BPM electro in C Minor with annotated chord progressions and verse/drop structure.",
      "visualArtifactUrl": "music://artifacts/plan-ember-quartz-tide.abc"
    }
    ```

### F. `dj_render_composition`
Deck-level wrapper over `music { action: "generate" }` (§3.D). Commits an approved or edited ABC score into high-fidelity 48 kHz stereo audio via the YuE 2 NAR ODE pipeline. Returns a `jobId`; the deck learns about completion through the proactivity hook in §7 rather than by polling.
*   **Arguments**:
    ```json
    {
      "planId": "plan-ember-quartz-tide",
      "abcScore": "X:1\nT:Neon Drive\n...",
      "odeSteps": 8,
      "priority": "next" | "tail"
    }
    ```

---

## ⚙️ 5. Modular Provider Architecture

Audio sources are implemented under `packages/stage-ui/src/libs/providers/` as part of the `music` provider category:

```
                          ┌───────────────────────────┐
                          │    MusicProvider Interface│
                          └─────────────┬─────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
┌──────────────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│  Generative Providers        │    │  Spotify Web Provider│    │ Local File Provider  │
│  - AIRI Audio Server Engine  │    │  - Streaming catalog │    │ - IndexedDB cache    │
│    (audio.cpp: MiniMax, YuE2)│    │  - Connect / Web SDK │    │ - localforage assets │
│  - Remote Suno v6 (Cloud)    │    │  - Search & Playback │    │ - Stored playlists   │
│  - ComfyUI (Optional Custom) │    │                      │    │ - Stored playlists   │
└──────────────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

#### A. Local Primary Engine: AIRI Audio Server (`audio.cpp` C++ Runtime)
* **Dedicated Music API Endpoint (`POST /v1/audio/music`)**:
  Music synthesis differs structurally from plain TTS speech: it requires multi-modal conditioning (genre prompt, structured lyrics with verse/chorus tags, duration, tempo/BPM, and optional LoRA adapters). Rather than overloading `/v1/audio/speech`, `airi-audio-server` exposes a dedicated endpoint:
  ```json
  POST /v1/audio/music
  {
    "model": "minimax-music-3" | "yue-2",
    "prompt": "melodic synthwave, analog synths, driving bassline, 120 bpm",
    "lyrics": "[Verse]\nNeon reflections on the wet asphalt...\n[Chorus]\nRunning through the grid...",
    "duration_seconds": 60,
    "temperature": 0.8,
    "lora": "synthwave_retro_v1"
  }
  ```
* **1-Click Add-on Installation Flow (`install.bat` / `npm run add-music`)**:
  Music models (MiniMax Music 3, YuE 2) are significantly larger than lightweight TTS models (3 GB – 10 GB). To maintain zero-bloat for pure speech users:
  1. `install.bat` provides an optional modular add-on menu: `[M] Install Generative Music Models (MiniMax / YuE 2)`.
  2. Users can run `npm run add-music` anytime to download GGUF music weights and verified sidecars in 1 click.
* **Advanced Capability: YuE 2 AR LoRAs & Style Conditioning**:
  `audio.cpp` supports LoRA adapter injection into the Autoregressive (AR) stage (`--lora <path>`):
  - **Genre/Vocal Adapters**: Custom LoRAs steer acoustic timbre, specific vocal styles (e.g. Japanese anime vocals, metal screaming, acoustic folk), or unique musical keys.
  - **AIRI Integration**: Character cards can declare an optional `extensions.airi.music.default_lora` to ensure the character's generated music matches their artistic persona.
* **LoRA Management & Training Lifecycle (`/v1/audio/music/loras`)**:
  `airi-audio-server` provides a complete RESTful adapter cartridge management and training pipeline:
  ```json
  GET    /v1/audio/music/loras              // List installed LoRAs, ranks, sizes, tags
  POST   /v1/audio/music/loras              // Upload ready-to-use .safetensors adapter
  DELETE /v1/audio/music/loras/:id          // Archive or remove an adapter
  POST   /v1/audio/music/loras/train        // Trigger background style/voice fine-tuning run
  GET    /v1/audio/music/loras/jobs         // Monitor progress, epochs, loss, and ETAs
  POST   /v1/audio/music/loras/jobs/:id/cancel // Abort an in-flight training session
  ```
  - **Hot-Swapping Cartridges**: In the desktop UI, LoRAs are rendered as visual *synthesizer cartridges* with configurable scale sliders (0.0 to 1.5).
  - **Automated Fine-Tuning**: Users can drag and drop 5–10 reference stems/recordings or ABC scores. The server queues a background LoRA training worker (`rank=16..32`, target modules: `q_proj`, `v_proj`, `k_proj`, `o_proj`) and registers the resulting `.safetensors` adapter automatically upon completion.
  - **VRAM Concurrency Guard During Training**: Backward-pass gradients during LoRA fine-tuning consume significant GPU memory. While a training job is actively executing, `airi-audio-server` engages an automated hardware guard on `/v1/audio/speech` (and other inference endpoints), returning a temporary busy state (`503 Service Unavailable / In Training`) to prevent concurrent TTS requests from causing CUDA out-of-memory crashes on 8GB consumer GPUs.
  - **Runtime LoRA Injection & Dynamic Scaling**: Unfused AR LoRAs (`--lora`) are natively supported by `audio.cpp`. Dynamic runtime scaling (`loraScale: 0.0 - 1.5`) without restarting the model process is an active area of investigation in `audio.cpp`; if live alpha scaling is not natively supported in the current C++ engine, switching cartridges initiates a lightweight model instance reload (~5–10s) rather than live in-memory multiplier interpolation.

### B. Local Generative: YuE 2 (Score-First & Deep ABC Planning Architecture)
* **Hardware Footprint & Shootout Findings**:
  * Evaluated directly on 8GB consumer hardware (RTX 4070 Laptop GPU, 128-bit memory bus, CUDA 13.1, SM 8.9).
  * Consumes only **~2.8 GB to 3.3 GB VRAM** in `Q4_0`, leaving **>4.7 GB VRAM free** to seamlessly co-exist with ComfyUI and AIRI's real-time voice pipeline without OOM or host memory thrashing.
  * In contrast, MiniMax Music 3.0 consumed ~7.2 GB VRAM (88% of GPU capacity) and required ~11.7 min for 10s audio, making YuE 2 **3.5x–4x faster** with significantly lower resource contention.
  * Outputs native studio-broadcast **48,000 Hz stereo** (vs 44.1 kHz on MiniMax).
* **Two-Tiered Architecture (Symbolic Plan vs Acoustic Diffusion)**:
  * **Stage 1: Symbolic AR Planning (ABC Score CoT)**: The 3B model generates standard **ABC musical notation** (`cot=melody` or `cot=full`) outlining key signature, tempo/BPM, bars, chords (`[Cm]`, `[G#]`), melodies, dynamics, and song parts (`[intro]`, `[drop]`, `[verse]`). Generates at **~115 tokens/sec** taking only **~3–20 seconds**.
  * **Stage 2: Acoustic Diffusion (NAR ODE Flow)**: Solves the acoustic flow matching differential equations across 8 ODE steps (16 forward passes), transforming the symbolic score and lyrics into high-fidelity stereo audio.
* **Empirical 2-Minute Track Findings (`cot=full` vs `cot=off`)**:
  * **Score-Guided Coherence (`cot=full`)**: In empirical 2-minute festival dubstep tests, `cot=full` produced a dual-staff score in $D\sharp$ minor with explicit chord progression changes ($D\sharp m \to B \to G\sharp m \to F\sharp$) and bar-aligned drop moments, resulting in substantially richer acoustic textures, coordinated vocal-instrumental sync, and exact song duration alignment (**120.0s exact** vs 116.4s).
  * **Negligible Latency Delta**: The symbolic notation planner took **only 20.7 seconds** out of a 27-minute total generation run (<1.2% of total time), proving that the dramatic leap in musical composition quality is entirely worth the marginal generation time.
* **Plug-and-Play AR LoRAs**:
  * Verified support for unfused AR LoRAs (`ar_lora_inst_v3abc.safetensors`, 392 projections) with zero runtime conversion. Enables hot-swapping genre adapters (synthwave, EDM, lo-fi, acoustic) on the fly.
* **Interactive ABC Studio & Conversational Co-Creation ("Sound Studio" / "Music Room")**:
  * **Natural Language Steering of Musical Graphs**: Because ABC notation is compact human-readable text, the character can initiate a *compositional planning phase*, return the generated ABC notation score as a visual artifact/graph, and let the user inspect or modify the composition via natural language or direct visual editing prior to triggering heavy acoustic rendering.
  * **Dedicated Left-Sidebar Panel ("Sound Studio" / "Music Room")**: A specialized studio tab in the UI featuring a built-in visual ABC score/piano-roll viewer and chord sheet editor. Users can say *"transpose the bridge into a darker minor key and make the drop hit at bar 16"*, the LLM edits the ABC score, and YuE 2 renders the exact customized audio via `--request-option abc="..."`.

### C. Remote Generative: Suno v6 (Cloud API)
* Zero local VRAM requirement for low-spec hosts.
* Precision stem isolation and lyric microediting without re-rendering entire tracks.
* Three model tiers: V6 (stable production), V6 Wild (creative ideas), V6 Mini (rapid drafting).

### D. Optional Generative: ComfyUI (Custom Graph Tinkerers)
* Reuses `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/comfyui.ts` for advanced users wanting custom diffusion node setups.
* Injects `{{CAPTION}}`, `{{LYRICS}}`, `{{BPM}}`, and `{{DURATION}}` into workflow templates.

### D. Spotify Streaming Adapter
* **Authentication**: OAuth 2.0 PKCE flow stored securely in Electron safeStorage.
* **Search & Metadata**: Uses Spotify Web API (`/v1/search`, `/v1/me/player`).
* **Audio Transport**: Uses **Spotify Web Playback SDK** in the renderer (or Spotify Connect API for remote playback on external speakers).
* *Note: Requires Spotify Premium per Spotify API terms.*

### E. Fail-Safe & Latency Controller (The Generation Time Reality)
* **Latency Tiering**:
  * **Instantaneous / Real-Time Tier (< 10s)**: Spotify streaming (0s), Pre-rendered local "Record Crate" tracks (0s), and Suno v6 cloud API (<10s).
  * **Heavy Asynchronous Tier**: Full YuE 2 NAR ODE generation. Measured, see below.
* **Measured Throughput (RTX 4070 Laptop, 8 GB VRAM, CUDA 13.1, SM 8.9)**:

  | Metric | MiniMax Music 3.0 (Q4_0) | YuE 2 Base (3B Q4_0) | YuE 2 + AR LoRA |
  | :--- | :--- | :--- | :--- |
  | Wall time for 12 s of audio | **11.74 min** (704 s) | **~3.0 min** (~180 s) | **~3.9 min** (~234 s) |
  | Real-time factor (RTF) | **70.55x** | **~15.0x** | **~19.5x** |
  | Peak VRAM | ~7.2 GB (88% of 8 GB) | ~2.8 GB (34%) | ~2.9 GB (35%) |
  | Output sample rate | 44.1 kHz | 48 kHz | 48 kHz |

  A 30-second render through the MCP server measured **321 s wall (RTF 10.7x)**, producing 5,759,788 bytes — exactly 48 kHz stereo 16-bit. RTF improves on warm runs and worsens on cold starts, so the operating range is **10–15x real time**:

  | Requested duration | Typical wall time |
  | :--- | :--- |
  | 30 s | 5–8 min |
  | 60 s | 10–15 min |
  | 120 s | 20–27 min |

* **Why Plan-First Is Affordable**: in the 2-minute `cot=full` shootout, the symbolic ABC planning pass took **20.7 s of a ~27 min render — under 1.2%**. The score-guided run also landed at exactly 120.0 s versus 116.4 s for `cot=off`, with coherent chord movement ($D\sharp m \to B \to G\sharp m \to F\sharp$) instead of freeform transitions. Paying ~1% for the planning step is unambiguously worth it, and it is what makes the interactive plan/discuss/edit loop viable.

* **Operational Dispatch Logic**:
  * When `dj_queue_track` is called with `priority="next"` (for an imminent track transition occurring in < 60s), the engine **strictly routes to the Real-Time Tier** (Spotify, Suno v6, or pre-rendered local tracks).
  * When local YuE 2 song creation is requested during an active set, the system registers it as a **"Backstage Studio Order"** (`priority="tail"` or background job). It generates asynchronously without blocking the "On Deck" slot.
  * If a scheduled local generation job fails, throws OOM, or times out:
    1. The controller automatically falls back to Suno v6 cloud generation or executes a fallback search on Spotify matching the target genre/mood.
    2. The replacement track is cued immediately to the "On Deck" slot.
    3. The agent is notified via status telemetry to provide in-character commentary:
       > *"My local synth module hit an overload, so I'm pulling this track from the cloud while it cools down!"*

---

## 🎛️ 6. DJ Deck Engine & Dual-Stream Audio Pipeline

The playback engine in `packages/stage-ui/src/stores/dj-deck.ts` coordinates both native Web Audio and Spotify streaming:

```
[ Local / Generative Audio ] ──► [ Web Audio GainNode A/B ] ──┐
                                                              ├──► [ Master Audio Output ]
[ Spotify Web Playback ]     ──► [ Spotify Player Volume ]  ──┘           ▲
                                                                          │
                                                               (Ducking Controller)
                                                                          ▲
                                                                [ Character TTS Speech ]
```

### A. Seamless Crossfading
* **Generative-to-Generative**: Web Audio API equal-power crossfade curve between Deck A and Deck B.
* **Spotify-to-Generative (or vice versa)**: Coordinated software volume ramp down on Spotify Connect player while ramping up the Web Audio GainNode over 3–5 seconds.

### B. Dynamic Voice Audio Ducking
* Monitored via `useSpeechRuntimeStore()` and `character-speaking` state:
* When the character speaks (via Kokoro, ElevenLabs, etc.):
  * Active music stream volume is exponentially attenuated to **20–25%** over 200ms.
* When speech concludes:
  * Music volume smoothly recovers to **100%** over 600ms.

### C. Radio Host Banter Loop (Track Intros & Outros)
* When a new track is cued and begins playing at ducked volume, the agent can deliver a brief 1–2 sentence spoken intro during the first 5 seconds (e.g., over the instrumental intro bars).
* Proactivity hooks allow the agent to announce transitions naturally in voice dialogue.

---

## 🧠 7. Status-Anchored Proactivity & Setlist Adaptation

Instead of arbitrary clock-interval polling, the DJ engine hooks directly into the Proactivity Engine (`packages/stage-ui/src/stores/proactivity.ts`):

1. **Threshold Event**: When the active track reaches `remainingMs <= 40000` (40 seconds) and the "On Deck" slot is empty.
2. **Contextual Wakeup**: The proactivity dispatcher sends a telemetry event to the consciousness orchestrator:
   > *"[DJ Deck Status]: Current track 'Digital Love' ends in 38s. Mode: Hybrid. User mood: Focused/Coding. What is next on deck?"*
3. **Agent Action (Pacing & Source Resolution)**:
   - For immediate succession (`priority="next"`), the LLM selects a track from the real-time sources: Spotify, Suno v6, or an already-rendered song in the character's local "Record Crate".
   - If the agent is inspired to create an entirely new original local song via YuE 2, it initiates an asynchronous composition job (`priority="tail"`) for later in the session, while simultaneously queueing an instant track or short interlude for the immediate transition.

---

## 🖥️ 8. UI Surfaces & State Sync

*   **DJ Deck Overlay / Control Strip Widget**:
    *   Displays current track title, artist, source badge (`[Spotify]` | `[YuE2]` | `[MiniMax]` | `[Suno]`), waveform/progress bar, and "On Deck" track preview chip.
    *   Play/pause, skip, mode selector (`Generative` | `Spotify` | `Hybrid`), and crossfade button.
*   **"Music Room" / "Sound Studio" Left Sidebar Tab**:
    *   Dedicated interactive studio space for deep musical co-creation with the character.
    *   **Interactive ABC Notation & Piano-Roll Canvas**: Visualizes the generated composition plan (bars, chord voicings, key signature, tempo) using lightweight Web/WASM music notation renderers (such as `abcjs` or VexFlow).
    *   **Conversational Score Refinement**: The user and agent converse directly in the studio chat. The agent can mutate the score in real time (e.g. adding a syncopated synth lead, modulating into a minor key, or shifting BPM) before committing the plan to the ODE acoustic renderer.
    *   **LoRA Cartridge Rack & Training Workshop**: Visual rack displaying installed genre and vocal style adapters (rank, size, scale slider `0.0`–`1.5`, active switch). Features a drag-and-drop dropzone for training custom LoRAs from audio stems or ABC notation datasets with live epoch/loss telemetry.
    *   **One-Click Stem & Score Export**: Export raw ABC notation, MIDI files, and generated 48 kHz stereo audio directly from the studio.
*   **Chat Stream Moments**:
    *   Subtle inline track chips when a new song starts playing.
*   **Tool Enablement Surfaces** (Phase 1, no UI beyond the toggle itself):
    *   **Quick Settings → Tools subview**: a "Sound Studio" tile styled identically to the existing Web & Research / Computer Files rows.
    *   **Character card settings → Tools tab**: the same toggle, for parity with web search and filesystem.
    *   Both write the card-scoped ACL token (`music`) and never ask the user for an MCP URL — activation and URL resolution are handled by the provisioning branch in §3.C.
*   **Cross-Window Sync (`BroadcastChannel`)**:
    *   Registered channel: `airi-dj-sync` (listed in `docs/rosetta-stone.md` §13).
    *   Synchronizes playback state, deck buffers, and queue across Control Strip, Stage, and Chatbox windows.

---

## ⚠️ 9. Technical Realities & Audio Nuances

*   **Spotify Premium Requirement**: The Spotify Web Playback SDK strictly requires an active Spotify Premium subscription. For non-Premium users, the engine defaults to **Generative Mode** (YuE2 / MiniMax / Suno) and **Local File Mode**.
*   **DRM Audio Boundary**: Spotify streams are DRM-encrypted and cannot be directly routed through Web Audio API `AudioNode` chains (e.g., custom visualizer FFTs or audio filters). Volume ducking for Spotify is handled directly via SDK player volume controls (`player.setVolume()`).
*   **Full Raw Audio for Generative Tracks**: YuE 2 and MiniMax generated tracks provide 100% raw PCM/WAV access, enabling custom EQ filtering, spatial audio, and visualizer waveform rendering.

---

## 📅 10. Roadmap & Implementation Checklist

### Phase 0 — Server contract (`airi-audio-server`)

- [x] Add `POST /v1/audio/music` endpoint handling genre prompts, structured lyrics, duration, and LoRA adapters.
- [x] Add `POST /v1/audio/music/plan` for fast symbolic ABC score planning.
- [x] Add LoRA adapter management & training endpoints (`/v1/audio/music/loras`, `/v1/audio/music/loras/train`, `/v1/audio/music/loras/jobs`).
- [x] Add `POST /v1/audio/voice-design` endpoint for natural language character voice synthesis via `MOSS-VoiceGenerator`.
- [x] Add `POST /v1/audio/sfx` endpoint for rapid 8-step sound effects & foley synthesis via `Stable Audio 3 Small SFX`.
- [x] Add 1-click model downloaders (`npm run add-music`, `npm run add-voicegen`, `npm run add-sfx`) and modular `install.bat` wizard.
- [x] Advertise the MCP endpoint in `GET /v1/capabilities` as `mcp: { url, transport }` (§3.B).
- [x] Host a Streamable HTTP MCP endpoint at `POST /mcp` (§3.A).
- [x] Implement the `music` hub tool with the `describe` / `plan` / `generate` / `status` / `list` / `cancel` actions (§3.D).
- [x] Implement the job registry backing `plan` and `generate` → `status`, with receipts carrying their own `next` polling guidance (§3.H).
- [x] Real cancellation: per-job `AbortController` kills the spawned `audiocpp_cli` so a running render actually stops (§3.H).
- [x] Titles: `plan` accepts a `title` and fills the ABC `T:` field, so scores are referencable by name (§3.D).
- [x] Self-description: a `describe` action returns the ABC contract, voice layout, limits, and a canonical score template; `abcScore`/`cot` descriptions state that a score conditions rather than dictates, and that duration is independent (§3.E).
- [x] Validate `cot` instead of ignoring it: `cot="off"` with an external score is rejected, and the requested `cot` is always forwarded to the engine (§3.E).

### Phase 1 — AIRI client bridge (MCP)

- [ ] Add the `music` / `mcp_music` family to `filterToolsByAllowedTools` in `packages/stage-ui/src/stores/llm.ts`. **Hard requirement** — without it the MCP meta-tools are stripped and the LLM can never discover the server.
- [ ] Add an `airi-audio-server` (music) branch to `filterToolsForCard` in `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/mcp.ts`.
- [ ] Add a `music` branch to `ensureMcpServersForAllowedTools`: probe capabilities, then write or reuse the HTTP entry (§3.C).
- [ ] Add the "Sound Studio" tile to the Quick Settings **Tools** subview (`ChatOptionsToolsView.vue`).
- [ ] Add the matching toggle to the card creation **Tools** tab (`CardCreationTabTools.vue`).
- [ ] *(Optional)* Receipt and completed-track rendering in `tool-call-block.vue`.

### Phase 2 — Deck engine & catalog

- [ ] Define `MusicProvider`, `DJTrack`, and provider registry entries in `packages/stage-ui/src/libs/providers/`.
- [ ] Implement `AiriAudioServerMusicProvider` connecting to `/v1/audio/music`.
- [ ] Implement Suno v6 cloud API wrapper for fast remote fallback.
- [ ] Implement Spotify OAuth PKCE flow and Web Playback SDK / Connect API wrapper.
- [ ] Build `packages/stage-ui/src/stores/dj-deck.ts` with dual-deck buffer management, crossfading, and TTS audio ducking.
- [ ] Implement `dj_queue_track`, `dj_search_catalog`, `dj_get_status`, and `dj_control` in `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/`.
- [ ] Connect the DJ deck remaining-time threshold to the proactivity dispatcher.
- [ ] Create the "Now Playing / On Deck" media strip component on Stage and Control Strip.

### Phase 3 — Sound Studio depth

- [ ] Render ABC notation in the existing Sound Studio tab via `abcjs`. The data path already exists — `chat_music.vue` parses `abc_score` / `abc` out of the generation response and stores it as `abcScore` on the track, but no template branch ever displays it, so today it is captured and discarded from the user's perspective.
- [ ] Bidirectional conversational ABC editing: user edits and agent edits operate on the same score before `generate`.
- [ ] LoRA Cartridge Rack and training workshop (§5.A).
- [ ] One-click ABC / MIDI / WAV export.

