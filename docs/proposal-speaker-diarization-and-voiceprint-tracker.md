# Proposal: Local Speaker Diarization, Voiceprint Tracking & Acoustic Biometrics

> **Status**: Proposed Architecture & Evaluation RFC
> **Target Subsystems**:
> - `packages/stage-ui/src/libs/voice/` & `packages/stage-ui/src/stores/speaker-tracker.ts` (Acoustic Worker & Runtime)
> - `packages/stage-ui/src/stores/modules/hearing.ts` & Audio Input Pipeline (`packages/stage-ui/src/stores/modules/hearing-speech-input-pipeline.ts`)
> - `packages/stage-ui/src/stores/chat.ts` & Prompt Composition (`packages/stage-ui/src/composables/use-airi-runtime-prompt.ts`)
> - `packages/stage-pages/src/pages/settings/data/` (Voiceprint Enrollment UX)
> - `packages/stage-ui/src/components/scenes/ControlStripHost.vue` (Desktop Sensory Feedback)
> **Key Upstream References**:
> - Upstream PR [#2971](https://github.com/moeru-ai/airi/pull/2971): `chore(deps): bump sherpaw to 0.3.0`
> - Upstream PR [#2975](https://github.com/moeru-ai/airi/pull/2975): `feat(stage-ui): add speaker tracker runtime` *(Merged into upstream/main at commit `d7c9737118`)*
> - Upstream PR [#2980](https://github.com/moeru-ai/airi/pull/2980): `feat(stage-ui,stage-pages): add voiceprint enrollment` *(Merged into upstream/main at commit `7189b7eade`)*
> - Upstream PR [#2989](https://github.com/moeru-ai/airi/pull/2989): `feat(stage-ui,stage-pages): add speaker recognition` *(Merged into upstream/main at commit `79792e1613`)* — Real-time speaker evidence collection via CAM++ background worker scoring 1s audio windows every 250ms against enrolled voiceprint when VAD speech ≥ 50%.
> - Upstream PR [#2995](https://github.com/moeru-ai/airi/pull/2995): `refactor(core-agent,stage-ui,stream-kit): decide voice input with rules and speculate rewrites` *(Merged into upstream/main at commit `b039c917c1`)* — Rule-based voice input policy engine and speculative ASR rewrite pipelines.
> - Upstream PR [#2998](https://github.com/moeru-ai/airi/pull/2998): `feat(stage-ui,stage-tamagotchi): fade live voice text in and animate rewrites` *(Merged into upstream/main at commit `efa42d2ebd`)* — Animated live voice text fade-in and rewrite animations (`PoppinText` blur-fade, `rewrite-text.vue`).
> - Upstream PR [#3268](https://github.com/moeru-ai/airi/pull/3268): `fix(stage-tamagotchi,stage-pages): bundle the voiceprint model, explain its download failures, and remove the dead resources store` *(Merged into upstream/main at commit `dc5865d1eb`)* — Bundles the 28 MB CAM++ speaker model into Electron builds via `Sherpaw` bundler in `electron.vite.config.ts`, pre-warming cache to eliminate runtime network download failures during enrollment.
> **Related Fork Skills & Specs**:
> - [`airi-speech-pipeline`](../.agents/skills/airi-speech-pipeline/SKILL.md) & [`airi-speech-runtime`](../.agents/skills/airi-speech-runtime/SKILL.md)
> - [`airi-acting-cue-act-tokens`](../.agents/skills/airi-acting-cue-act-tokens/SKILL.md) *(Distinct output manifestation boundary)*
> - [`docs/project-selective-upstream-sync-protocol.md`](./project-selective-upstream-sync-protocol.md)

---

## 1. Executive Summary & Paradigm Shift

Current Speech-to-Text (STT) runtimes in AIRI (such as local Whisper WebGPU, browser-native Web Speech API, or cloud ASR gateways) suffer from a fundamental sensory blindspot: **they answer "What was said?", but possess zero awareness of "Who said it?"**.

Every sound wave that crosses the Voice Activity Detection (VAD) threshold or follows a wake-word trigger is transcribed as a single, homogenous text string attributed blindly to the user. This creates acute failure modes in real-world desktop and mobile environments:
1. **Accidental & Third-Party Wake Triggers**: A YouTube video, Twitch stream, podcast, TV in the background, or a coworker speaking nearby triggers the wake word or voice transcription, causing AIRI to interrupt and formulate an unwanted response.
2. **Social Blindness**: When friends, family, or colleagues speak near the microphone, AIRI cannot distinguish the owner's voice from a guest's voice, either hallucinating that the user contradicted themselves or treating malicious/heckling comments from others as direct user commands.
3. **No Speaker-Gated Privacy**: Anyone physically near the workstation can issue commands or query personal memory records without biometric voice verification.

**Speaker Diarization and Voiceprint Tracking introduce an acoustic identity layer to AIRI's sensory cortex.**

By leveraging the **CAM++** (Context-Aware Masking) neural network model via `@sherpaw/speaker-diarization` running 100% locally in an isolated Web Worker, AIRI can extract compact mathematical embeddings of spoken audio, unlocking two distinct operational modes:
- **Mode 1: Biometric Gating & Voiceprint Enrollment ("Owner Only")**: The companion listens only to the enrolled owner, silently dropping background voices or stranger inputs before they ever reach the LLM.
- **Mode 2: Multi-Speaker Conversational Tagging ("Who Said What")**: The companion actively clusters multiple distinct human speakers in the room, tagging dialogue transcripts with speaker identifiers (`[Owner]`, `[Guest]`) so the LLM perceives the true multi-party social dynamic.

```
                           +----------------------------------------+
                           |     Physical Microphone Stream         |
                           +-------------------+--------------------+
                                               |
                                               v
                           +----------------------------------------+
                           |  Acoustic Embedding Extractor (CAM++)  |
                           |   (28 MB ONNX in WebAssembly Worker)   |
                           +-------------------+--------------------+
                                               |
                     +-------------------------+-------------------------+
                     |                                                   |
                     v                                                   v
   +------------------------------------+             +------------------------------------+
   |   Mode 1: Biometric Gating         |             | Mode 2: Multi-Speaker Diarization  |
   |   (Compare vs. Enrolled Owner)     |             | (Cluster Multiple Voices in Room)  |
   +-----------------+------------------+             +-----------------+------------------+
                     |                                                  |
           +---------+---------+                                        |
           |                   |                                        |
      Match >= 0.72       Match < 0.72                                  |
           |                   |                                        |
           v                   v                                        v
     [Accept Turn]       [Drop Audio]                  [Annotate Transcript by Speaker]
     Send to LLM       Silently Suppress               "[Owner]: Hey! [Guest]: Hello!"
```

---

## 2. Deep Dive: Mode 1 vs. Mode 2

### Mode 1: Biometric Gating & Voiceprint Enrollment ("Owner Only")
*Primary target of upstream PRs [#2975](https://github.com/moeru-ai/airi/pull/2975) and [#2980](https://github.com/moeru-ai/airi/pull/2980).*

In Mode 1, AIRI acts as an attentive personal companion dedicated strictly to her primary operator.

1. **Enrollment Phase**:
   - The user navigates to Settings -> Data & Audio -> Voiceprint Enrollment.
   - The user records a clean 5-to-10 second speech prompt (e.g. reciting a short pangram or introductory sentence).
   - The CAM++ engine extracts a normalized reference embedding vector $\vec{v}_{\text{owner}}$ and stores it in client-side persistence (`local:voiceprints`).
2. **Runtime Verification**:
   - When the microphone opens (via wake-word or continuous VAD), incoming audio frames are fed into the worker tracker.
   - The tracker computes the cosine similarity score between the live utterance vector $\vec{v}_{\text{live}}$ and the enrolled reference:
     $$\text{Similarity} = \frac{\vec{v}_{\text{live}} \cdot \vec{v}_{\text{owner}}}{\|\vec{v}_{\text{live}}\| \|\vec{v}_{\text{owner}}\|}$$
   - **Gating Logic**:
     - If $\text{Similarity} \ge \tau_{\text{threshold}}$ (typically $0.68 - 0.75$ depending on ambient noise): Audio proceeds to speech transcription and chat dispatch.
     - If $\text{Similarity} < \tau_{\text{threshold}}$: Audio is judged as external noise or an unauthorized speaker. The interaction turn is aborted silently or flagged as `IGNORED_UNENROLLED_SPEAKER`, saving LLM API tokens, local GPU compute, and avoiding jarring false-positive replies.

### Mode 2: Multi-Speaker Conversational Tagging ("Who Said What")
*Advanced architectural extension for conversational awareness in shared spaces and Discord voice channels.*

In Mode 2, AIRI does not reject non-owner voices; instead, she acts as an intelligent participant in a group setting.

1. **Unsupervised Online Clustering**:
   - As audio chunks arrive, the diarization runtime tracks speaker cluster centroids.
   - When a known enrolled voice matches $\vec{v}_{\text{owner}}$, it is labeled with the user's configured name (e.g., `[Richard]`).
   - Unrecognized voices that deviate significantly from the owner are assigned sequential participant IDs (e.g., `[Speaker 1]`, `[Speaker 2]`).
2. **Transcript Annotation**:
   - The transcription pipeline merges the time-aligned words from Whisper/ASR with the diarization speaker boundaries.
   - The final synthesized user turn sent to `chat.submit()` looks like:
     ```text
     [Richard (Owner)]: Airi, what do you think of this idea?
     [Speaker 1 (Guest)]: Honestly it sounds completely ridiculous to me.
     [Richard (Owner)]: Ignore him, he always says that.
     ```
3. **Cognitive Perception**:
   - The prompt builder receives a rich conversational transcript rather than an incoherent string of mixed voices.
   - The LLM persona understands who its master is, perceives the social context of the room, and can generate nuanced responses (e.g., defending Richard, playfully teasing Speaker 1, or asking for clarification from the specific person who spoke).

---

## 3. Structural Decoupling: Diarization (Input) vs. `<|ACTOR|>` (Output)

It is critical to distinguish between **Speaker Diarization** and AIRI's existing **`<|ACTOR|>` Dynamic Staging system** ([`airi-acting-cue-act-tokens`](../.agents/skills/airi-acting-cue-act-tokens/SKILL.md)):

| Dimension | Speaker Diarization / Voiceprints | `<|ACTOR:{actorId}|>` Dynamic Staging |
| :--- | :--- | :--- |
| **Pipeline Direction** | **Sensory Input (Ears / Microphone)** | **Manifestation Output (Voice / Avatar Body)** |
| **Domain** | Physical human beings speaking in the real world | Virtual anime/3D characters rendering on stage |
| **Technology** | CAM++ neural acoustic embedding extractor | Regex marker parser & Live2D/VRM model cache |
| **Question Answered** | *"Which human in the room just spoke to the microphone?"* | *"Which virtual character should speak this sentence and animate?"* |
| **Data Flow** | Audio Frames $\rightarrow$ ONNX WASM $\rightarrow$ Cosine Match $\rightarrow$ LLM Context | LLM Output $\rightarrow$ Marker Parser $\rightarrow$ Stage Display Engine |

They are complementary, not competing: Diarization provides accurate human context *into* the LLM; `<|ACTOR|>` routes the LLM's response *out* to the appropriate virtual character.

---

## 4. Technical Architecture: CAM++ & `@sherpaw/speaker-diarization`

Upstream commit `d7c9737118` (PR [#2975](https://github.com/moeru-ai/airi/pull/2975)) pins `@sherpaw/speaker-diarization` version `0.3.0`.

### Key Characteristics of the Model
- **Network Architecture**: CAM++ (Context-Aware Masking) developed by Alibaba / ModelScope. Uses a hybrid dense-connection convolutional backbone with temporal context masking to generate robust speaker embeddings even from short, noisy audio snippets ($> 1.5$ seconds).
- **Model Package**: `sherpa-onnx-cam++` ONNX model pack (~28 MB uncompressed).
- **Execution Target**: Runs client-side inside a Dedicated Web Worker using ONNX Runtime WebAssembly (WASM SIMD).
- **Performance Characteristics**:
  - Embedding generation latency: ~30ms–60ms on modern CPU WASM for a 2-second utterance.
  - Zero VRAM requirement: Operates entirely in system RAM / WebAssembly heap, avoiding contention with local WebGPU LLM / RWKV / Whisper instances.

### Upstream Class Structure
```typescript
// packages/stage-ui/src/libs/voice/speaker-tracker.ts
export class SpeakerTrackerRuntime {
  acquire(): Promise<SpeakerTracker> // Lazy-loads worker & model on first call
  setVoiceprints(voiceprints: readonly SpeakerVoiceprint[]): Promise<void> // Re-enrolls references
  dispose(): void // Terminates worker & frees WASM heap
}
```

---

## 5. Proposed Integration Architecture for `dasilva333/airi`

To maintain architectural integrity with the `dasilva333/airi` fork, the diarization system must adhere strictly to our local-first invariants:

### 1. Zero Cloud / Zero Telemetry Invariant
- Upstream couples model downloads to central API server endpoints or remote object storage.
- In `dasilva333/airi`, the CAM++ model must be treated as a **local asset** distributed via direct Hugging Face / GitHub release mirrors or cached into `localforage` OPFS storage, strictly isolated from external account authentication.

### 2. State & Storage Contract
- **Enrolled Voiceprints**:
  - Persisted in unstorage under `local:voiceprints:enrolled` (backed by IndexedDB).
  - Schema:
    ```typescript
    export interface EnrolledVoiceprintRecord {
      id: string
      name: string // e.g. "Primary Owner" or user display name
      isOwner: boolean // True for the biometric gatekeeper
      embedding: number[] // 192-dim normalized CAM++ float array
      sampleDurationMs: number
      createdAt: string
      updatedAt: string
    }
    ```
  - Compatible with BYOS (Bring Your Own Storage: S3/R2/Google Drive backup), allowing a user's voiceprint to sync privately across their own devices without a central server.

### 3. Surface Wiring: Decoupled Control Strip & Stage
- **Control Strip Ribbon**:
  - Add a subtle biometric indicator badge next to the microphone status icon:
    - 🟢 Green Lock: Enrolled owner voice verified.
    - 🟡 Yellow Question: Voice below similarity threshold (suppressed or flagged).
    - ⚪ Gray: Diarization disabled / raw VAD mode.
- **Settings UI (`stage-pages`)**:
  - Place enrollment under `Settings -> Audio -> Voiceprint Biometrics`.
  - Provide an interactive waveform recorder with real-time feedback ensuring the user speaks long enough ($> 3$ seconds) to form a high-confidence embedding.

---

## 6. Open Questions & Architectural Decision Points for the Fork

Before implementing speaker diarization in `dasilva333/airi`, we must resolve the following concrete design decisions:

### Q1: Model Distribution & Storage Footprint
- **Tradeoff**: The CAM++ ONNX model is ~28 MB.
- **Decision Point**:
  - *Option A (Bundled)*: Pre-bundle the 28 MB model inside Electron assets (`apps/stage-tamagotchi`) and lazy-fetch for Web/Pocket.
  - *Option B (On-Demand)*: Keep the core installation lightweight and prompt the user to download the "Voiceprint Biometrics Pack" only when they enable Mode 1 in settings.
- *Recommended*: **Option B (On-Demand)** to keep base repository clone times fast and respect mobile storage limits.

### Q2: Integration with Voice Cancellation & Wake-Word Pipeline
- **Problem**: In continuous listening, where does the similarity check occur?
- **Decision Point**:
  - Does the wake-word engine (e.g. Sherpa-KWS) fire first, and *then* CAM++ verifies the speaker within the 2-second wake buffer?
  - Or does CAM++ run continuously alongside VAD?
- *Recommended*: Run CAM++ on the wake-word trigger window ($T_{-1.5s} \dots T_{+0.5s}$). If the wake word was spoken by someone other than the owner, discard the wake trigger immediately before spinning up speech synthesis or sending anything to the LLM.

### Q3: Multi-Speaker Prompt Schema (Mode 2)
- **Problem**: Standard character cards expect single-user prompts (`User: <text>`). How should multi-speaker dialogues be framed in `useAiriRuntimePrompt`?
- **Decision Point**:
  - Should the prompt builder inject a System Note explaining: *"Multiple individuals are speaking. [Richard] is your creator/owner. Address other speakers accordingly."*?
  - Does this create prompt drift on smaller local models (e.g. RWKV-7 or Needle)?

### Q4: Acoustic Environmental Drift & False Rejection
- **Problem**: Voice pitch and timbre fluctuate during illness, morning hoarseness, low energy, or when wearing different headsets/microphones.
- **Decision Point**:
  - Should the system support **Multi-Sample Averaging** (enrolling 3 separate recordings: normal, quiet, excited) to produce a centroid embedding with a wider acceptance tolerance?

---

## 7. Upstream Radar & Surveillance Directives

To keep this capability actively tracked:
1. **Track PR [#2980](https://github.com/moeru-ai/airi/pull/2980)** (`feat(stage-ui,stage-pages): add voiceprint enrollment`) in `WATCHED_PRS` inside `airi_dasilva333/scripts/upstream-tracker.mjs`.
2. Monitor maintainer review regarding WebAssembly bundling in Electron vs Web, device OPFS quotas, and false-rejection thresholds.
3. Once PR [#2980](https://github.com/moeru-ai/airi/pull/2980) stabilizes or merges upstream, evaluate the enrollment UI components for selective forward-porting into our local-first settings architecture.
