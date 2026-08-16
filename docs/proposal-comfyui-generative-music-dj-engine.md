# Proposal: Unified DJ & Music Engine (ComfyUI Generative + Spotify Catalog)

This document outlines the architectural design for enabling AI characters to act as dynamic, real-time DJs—interweaving AI-generated tracks (via ComfyUI / MiniMax Music 3.0) with real-world streaming catalogs (via Spotify) while interactively adjusting the setlist and hosting radio-style voiceover transitions in response to ongoing conversation.

---

## 🧭 1. Vision & Goals

Currently, AIRI supports visual generative artistry (via ComfyUI/Replicate) and 3D item manifestation (via TRELLIS). This proposal introduces a **Unified Music Provider and AI DJ Engine** that gives the character both an infinite record crate (Spotify streaming catalog) and a private music production studio (ComfyUI / MiniMax):

*   **Three Operational DJ Modes**:
    1.  **Generative Mode**: Synthesizes 100% original music on the fly based on chat context, themes, or user mood (e.g., *"Make a cozy lo-fi song about drinking matcha while coding"*).
    2.  **Catalog Mode (Spotify)**: Searches and streams real licensed music from Spotify's global library (e.g., *"Play some late 90s French house"*).
    3.  **Hybrid DJ Mode (The Radio Experience)**: Blends real tracks with custom-generated tracks, beats, and interludes, acting as an autonomous radio host.
*   **"Always on Deck" Continuous Playback**: Zero-latency transitions between tracks. While Track A is playing, Track B is pre-queued or pre-generated on deck.
*   **Zero-Downtime Fail-Safe (Comfy / GPU Fallback)**: If local GPU generation encounters an OOM error, latency spike, or ComfyUI is offline, the DJ loop gracefully falls back to Spotify catalog search without interrupting playback.
*   **Radio DJ Banter & Audio Ducking**: The character can speak over track intros/outros (e.g., *"Coming up next, one of my favorite tracks from Daft Punk..."*). Music automatically ducks to 20–25% volume during speech and swells back up seamlessly.
*   **Character Musical Identity**: Character cards (`extensions.airi.music`) define distinct musical tastes, favorite genres, BPM preferences, and DJ banter style.

---

## 🎛️ 2. Unified Track Model & Abstraction

To AIRI's DJ brain, all tracks share a normalized data structure regardless of whether they originate from Spotify, local ComfyUI generation, or local files:

```typescript
export interface DJTrack {
  id: string
  title: string
  artist: string // e.g., "Daft Punk" or "AIRI x MiniMax"
  genre?: string
  mood?: string
  bpm?: number
  durationMs: number
  source: 'spotify' | 'comfyui' | 'local'

  // Playback Handles
  spotifyUri?: string // spotify:track:...
  audioBlobKey?: string // IndexedDB/localforage key for local audio
  audioStreamUrl?: string // ComfyUI output URL or local file URL
  artworkUrl?: string // Album cover or generated stage background thumbnail

  // Generation Metadata (for ComfyUI tracks)
  caption?: string
  lyrics?: string
}
```

---

## 🛠️ 3. The LLM Interface (Tool Calling)

The consciousness orchestrator is equipped with unified tools allowing it to seamlessly curate both generative and catalog music:

### A. `dj_queue_track`
Queues a track into the DJ deck from either a generative prompt or a catalog query.
*   **Arguments**:
    ```json
    {
      "source": "auto" | "spotify" | "comfyui",
      "query": "Daft Punk - Digital Love",
      "caption": "french filter house, punchy vintage drums, groovy slap bass, 124 bpm",
      "lyrics": "[Intro]\n[Verse]\nLast night I had a dream about you...",
      "title": "Neon Dreams",
      "priority": "next" | "tail" | "immediate_fade"
    }
    ```
*   `source`: `"auto"` (DJ decides based on mode/preference), `"spotify"`, or `"comfyui"`.
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
        "artist": "AIRI x MiniMax",
        "source": "comfyui",
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
      "fadeDurationSeconds": 4,
      "targetVolume": 0.8
    }
    ```

---

## ⚙️ 4. Modular Provider Architecture

Audio sources are implemented under `packages/stage-ui/src/libs/providers/` as part of the `music` provider category:

```
                          ┌───────────────────────────┐
                          │    MusicProvider Interface│
                          └─────────────┬─────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│  ComfyUI (MiniMax)   │    │  Spotify Web Provider│    │ Local File Provider  │
│  - Generative audio  │    │  - Streaming catalog │    │ - IndexedDB cache    │
│  - Raw PCM / WAV     │    │  - Connect / Web SDK │    │ - localforage assets │
│  - Full DSP control  │    │  - Search & Playback │    │ - Stored playlists   │
└──────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

### A. ComfyUI Generative Adapter
* Reuses `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/comfyui.ts`.
* Injects `{{CAPTION}}`, `{{LYRICS}}`, `{{BPM}}`, and `{{DURATION}}` into MiniMax Music 3.0 workflow templates.
* Fetches generated `.wav`/`.mp3` files, persists them in IndexedDB (`localforage`), and provides raw audio streams.

### B. Spotify Streaming Adapter
* **Authentication**: OAuth 2.0 PKCE flow stored securely in Electron safeStorage.
* **Search & Metadata**: Uses Spotify Web API (`/v1/search`, `/v1/me/player`).
* **Audio Transport**: Uses **Spotify Web Playback SDK** in the renderer (or Spotify Connect API for remote playback on external speakers).
* *Note: Requires Spotify Premium per Spotify API terms.*

### C. Fail-Safe & Latency Controller
* When `dj_queue_track` targets ComfyUI, a generation timeout watcher (e.g., 45 seconds) is established.
* If generation fails, throws OOM, or times out while Track A has `< 20s` remaining:
  1. The controller automatically executes a fallback search on Spotify matching the target genre/mood.
  2. The Spotify track is cued immediately to the "On Deck" slot.
  3. The agent is notified via status telemetry to provide in-character commentary:
     > *"My synth module overheated for a second, so I'm spinning this Tycho track while it cools down!"*

---

## 🎛️ 5. DJ Deck Engine & Dual-Stream Audio Pipeline

The playback engine in `packages/stage-ui/src/stores/dj-deck.ts` coordinates both native Web Audio and Spotify streaming:

```
[ Local / ComfyUI Audio ] ──► [ Web Audio GainNode A/B ] ──┐
                                                           ├──► [ Master Audio Output ]
[ Spotify Web Playback ]  ──► [ Spotify Player Volume ]  ──┘           ▲
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

## 🧠 6. Status-Anchored Proactivity & Setlist Adaptation

Instead of arbitrary clock-interval polling, the DJ engine hooks directly into the Proactivity Engine (`packages/stage-ui/src/stores/proactivity.ts`):

1. **Threshold Event**: When the active track reaches `remainingMs <= 40000` (40 seconds) and the "On Deck" slot is empty.
2. **Contextual Wakeup**: The proactivity dispatcher sends a telemetry event to the consciousness orchestrator:
   > *"[DJ Deck Status]: Current track 'Digital Love' ends in 38s. Mode: Hybrid. User mood: Focused/Coding. What is next on deck?"*
3. **Agent Action**: The LLM evaluates recent chat history and user feedback, calling `dj_queue_track` to queue either a real song or a generated beat.

---

## 🖥️ 7. UI Surfaces & State Sync

*   **DJ Deck Overlay / Control Strip Widget**:
    *   Displays current track title, artist, source badge (`[Spotify]` / `[MiniMax]`), waveform/progress bar, and "On Deck" track preview chip.
    *   Play/pause, skip, mode selector (`Generative` | `Spotify` | `Hybrid`), and crossfade button.
*   **Chat Stream Moments**:
    *   Subtle inline track chips when a new song starts playing.
*   **Cross-Window Sync (`BroadcastChannel`)**:
    *   Registered channel: `airi-dj-sync` (listed in `docs/rosetta-stone.md` §13).
    *   Synchronizes playback state, deck buffers, and queue across Control Strip, Stage, and Chatbox windows.

---

## ⚠️ 8. Technical Realities & Spotify Nuances

*   **Spotify Premium Requirement**: The Spotify Web Playback SDK strictly requires an active Spotify Premium subscription. For non-Premium users, the engine defaults to **Generative Mode** (ComfyUI) and **Local File Mode**.
*   **DRM Audio Boundary**: Spotify streams are DRM-encrypted and cannot be directly routed through Web Audio API `AudioNode` chains (e.g., custom visualizer FFTs or audio filters). Volume ducking for Spotify is handled directly via SDK player volume controls (`player.setVolume()`).
*   **Full Raw Audio for Generative Tracks**: MiniMax/ComfyUI generated tracks provide 100% raw PCM/WAV access, enabling custom EQ filtering, spatial audio, and visualizer waveform rendering.

---

## 📅 9. Roadmap & Implementation Checklist

- [ ] **Music Provider Interface**: Define `MusicProvider`, `DJTrack`, and provider registry entries in `packages/stage-ui/src/libs/providers/`.
- [ ] **ComfyUI Audio Bridge**: Extend `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/comfyui.ts` to support audio output nodes and metadata extraction.
- [ ] **Spotify Provider Integration**: Implement Spotify OAuth PKCE flow and Web Playback SDK / Connect API wrapper in `packages/stage-ui/src/libs/providers/providers/spotify/`.
- [ ] **DJ Deck Store**: Build `packages/stage-ui/src/stores/dj-deck.ts` with dual-deck buffer management, crossfading, and TTS audio ducking.
- [ ] **Unified DJ Tools**: Implement `dj_queue_track`, `dj_search_catalog`, `dj_get_status`, and `dj_control` in `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/`.
- [ ] **Playback-Anchored Proactivity**: Connect DJ deck remaining-time threshold to the proactivity dispatcher.
- [ ] **DJ Widget & UI**: Create the "Now Playing / On Deck" media strip component on Stage and Control Strip.
