# Project: Future Modalities Support (Audio & Video Attachments)

## Background
This document outlines potential solutions and implementation strategies to support audio and video files as inline message attachments in AIRI. This follows user requests and discussions regarding expanding AIRI beyond text and image modalities.

## The Challenge
Supporting audio and video attachments in a chat interface involves significant technical hurdles, as many standard LLM APIs and providers do not natively support these formats as direct file uploads in the same way they support images.

---

## 1. Audio Attachments (.mp3, .wav, etc.)

### Potential Strategies (Not Mutually Exclusive)

Instead of choosing one or the other, AIRI could offer a choice to the user via a modal when an audio file is attached: **"Do you want to send it as-is or do you want to transcribe it first?"** This modal could also serve as a way to guide users to the relevant settings in `Settings > Providers > (Audio Modality)`.

#### A. Native Multimodal Input (OpenRouter / Gemini)
Some advanced models and providers (like Gemini via Google AI Studio or certain models on OpenRouter) support raw audio input.
- **Use Case**: This is essential for non-speech audio, such as a song the user wants the character to hear. Transcribing a song will only return lyrics, losing the melody, tone, and musicality.
- **Challenges**: We need to investigate how to effectively filter OpenRouter for LLMs that specifically support the audio modality for input and text for output.
- **Pros**: Maintains emotional tone, prosody, and background context of the audio.
- **Cons**: High token cost; limited model support.

#### B. Pre-Transcription (STT Scribe)
For speech-heavy audio where the text content is what matters most, AIRI could run the audio through an STT engine first.
- **Flow**: The audio is sent to an STT model (like Whisper) -> AIRI receives the text transcription -> This text is then sent to the character (LLM) as the message content. (There is no use case for simply transcribing and giving it back to the user without sending it to the character).
- **Pros**: Compatible with all text-based models; lower token cost.
- **Cons**: Loses non-verbal cues (laughter, hesitation, tone); cannot describe music or melodies.

---

## 2. Video Attachments (.mp4, .webm, etc.)

Currently, none of the "big players" or standard chat APIs support uploading full video files directly as inline message attachments. The data is simply too large for standard context windows.

### Potential Strategies & Compromises

#### A. First-Frame Extraction
The simplest fallback is to treat the video as a static image by extracting only the first frame (or a specific thumbnail frame).
- **Pros**: Low overhead; extremely compatible.
- **Cons**: Loses all motion and temporal context.

#### B. Smart Frame Sampling (User Decided)
Instead of the whole video, AIRI could extract a specific number of frames distributed across the video duration.
- **Implementation**: Provide a small modal when attaching a video asking the user:
    - "How many frames do you want to send?" (e.g., 5, 10, 20)
    - Or "Send 1 frame per X seconds."
- **Pros**: Gives the LLM a sense of time and motion; manageable token cost.
- **Cons**: Requires video decoding capabilities in the frontend (e.g., via Canvas/WebCodecs).

#### C. Tiled Contact Sheets
Extract multiple frames and compose them into a single "tiled" image (like a film contact sheet).
- **Pros**: Sends temporal data in a single image payload; highly compatible with standard vision models (GPT-4V, Claude 3, etc.).
- **Cons**: Resolution per frame is reduced; requires complex canvas manipulation.

---

## 3. Status update — October 2026: dictation-only reality (voice message deferred)

The voice-message mode already exists in the UI (`VoiceInputHoverCard.vue`) but is
**disabled with a "coming soon" tag**. What follows is everything learned while
trying to stand up native audio sends in October 2026 — recorded here so the
next attempt starts warm. Bottom line: **we are limited to dictation**
(record → transcribe → send text) until the pipeline items in §3.5 are built
and validated.

### 3.1 What actually shipped (dictation paths)

- Portrait + landscape mic hover card (`VoiceInputHoverCard.vue`, shared
  `VoiceInputHover` teleport wrapper): Voice message / Dictation rows,
  microphone picker with full-panel swap, live input meter, Send-when-stops
  and Tap-to-talk toggles, More-Hearing-settings deep link.
- Tap-to-talk (`settings/hearing/tap-to-talk`, default ON, independent of the
  mic-hot flag): one tap captures one utterance, VAD ends it at speech end,
  text lands in the composer. OFF = open line with VAD segmentation.
- Record fallback for non-streaming providers (e.g. whisper-local): utterances
  transcribe whole into the input with the same auto-send semantics as live
  deltas. Transcription-slot races wait-and-retry instead of dropping speech.
- Whisper settings page gained a Compute Device toggle (WebGPU/WASM) with
  manifest-aware reload, and model-download failures now log message + stack.

### 3.2 transformers 4.3.1 broke every local backend (fixed)

After the 3.x → 4.3.1 upgrade, all transformers-backed workers failed backend
init with `Failed to construct 'URL': Invalid URL` ("no available backend").
Root cause, verified live against the dev server: 4.x's stock `wasmPaths`
default is the **object form** (`{ mjs, wasm }`), and something on its init
path chokes on it. The **string form** loads clean (VAD: `LOAD OK in 763ms`).
Fix applied everywhere: overwrite unconditionally with the string CDN pin
(`onnxruntime-web@1.24.2/dist/`), matching what the search/blip workers
already did — which is why they were immune. Touched: vad, whisper,
moondream, kokoro, attention-guard workers.

### 3.3 ORT 1.24 fusion vs whisper merged decoder (WASM load blocked)

On the **WASM** EP, whisper-tiny fails session creation on *every* dtype
(fp16/q4, fp32/q4, fp32/fp32 — the worker tries all three and logs each):

> `Can't create a session ... GetIndexFromName ... name which does not exist:
> InsertedPrecisionFreeCast_/layer_norm/Constant_output_0 for node:
> /layers.0/self_attn_layer_norm/Mul/SimplifiedLayerNormFusion/`

So it is **not** the quantization alone (fp32 fails identically) — it is the
fusion engine vs this graph family on ORT 1.24. The dtype fallback chain in
`libs/workers/worker.ts` is retained (other shards may differ), but on tiny
it only burns download bytes. Next lever if revisited: `graphOptimizationLevel`.

### 3.4 WebGPU works (with caveats)

Same tiny/base/small shards load and transcribe on the **WebGPU** EP
(small produced perfect text on live speech). Two warnings carried forward:
- whisper-large-v3-turbo (~3 GB VRAM) hard-crashed a shared-memory Mac
  (OS killed the process). Consider a memory guard or warning on that shard.
- One `NormalizeDispatchGroupSize Invalid dispatch group size (0, 1, 1)`
  (empty first-step KV past vs fused `optimum::if` decoder) was observed on
  turbo/WebGPU. Smaller shards transcribe fine, so this may be
  turbo-specific or input-specific — unresolved.
- Tiny/base one-word outputs on multi-second clips (`' L'`, `' And'`) are
  most likely a mix of tiny-model quality and whisper hallucinating on
  near-silence (a 20s no-speech auto-abort with discard now guards the
  composer path) — not necessarily breakage.

### 3.5 Native audio packets: the actual plumbing list (all open)

Verified by reading the code — no base64 audio travels the message pipes
today, anywhere, by construction:
- The composer strips audio at send (transcribes; only `image` forwards).
- `chat.ts` ingest/history knows `text` + `image_url` only; user bubbles
  render `image_url` only (`user-item.vue`).
- Existing in-repo precedents for the wire shapes: `input_audio` + wav/mp3
  format sniffing (`stores/providers/registry/transcription.ts`, STT path)
  and Gemini Live PCM `inlineData` (`live-session.ts`).
- To ship it for real: `'audio'` attachment type through ingest → history
  parts, per-provider part builders, an `audioInput` provider capability
  with transcribe-fallback-or-clean-block for the rest, compressed capture
  (the recorder emits 48 kHz WAV) + duration caps, blob-in-localforage
  persistence (never base64 in IndexedDB/sync payloads — see the binary
  safety rules), bubble + edit rendering, token/cost accounting (audio bills
  per-second), and memory-synthesis handling (transcript stays canonical).
- Attach-now-send-later vs send-now is **not** a design fork: both end at
  the same `ingest` gate with the same Blob. Build the chip and the
  pipeline independently.

### 3.6 Open questions (unanswered, in priority order)

1. Which chat providers get native audio first (OpenAI `input_audio`,
   Gemini), and how is `audioInput` capability discovered/filtered
   (OpenRouter has no clean audio-input filter today)?
2. Compressed capture format for voice messages (Opus/WebM vs WAV) and
   duration/size caps before base64.
3. Persistence + sync design for audio blobs (localforage keys, merge
   semantics, quota/eviction).
4. Should the whisper default stay WebGPU (fast, turbo dangerous) or move
   to WASM until the decoder paths settle — and should OrtRun failures
   auto-promote + retry once?
5. Upstream reference only (do not pull): upstream's waveform bubbles +
   show-voice-message-while-transcript-streams pattern
   (`voice-message-player.vue`, PRs #2858/#2875/#2876) for when our native
   path exists. Their `chat.ts` is too divergent to merge.

## 4. Related Roadmap Discussions

While discussing modalities, a few other UX improvements were identified for the roadmap:

### A. Inline Message Editing [Completed]
The ability to edit a previous message in the chat history.
- **Desired Behavior**: Editing a message should clear anything after it in that session and resend the prompt to take the conversation in a new direction from that point.
- **Current Workaround**: Deleting the assistant reply, copying the user message, deleting it, and sending it again.

