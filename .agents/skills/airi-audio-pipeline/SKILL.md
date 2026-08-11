---
name: airi-audio-pipeline
description: >-
  Use when implementing, configuring, or debugging TTS speech output, STT hearing input, audio device switching, VAD detection, streaming transcription, VoiceProfiles, UST speech transformers, or PCM/WAV audio playback.
---

# AIRI Audio Pipeline Engine

This skill provides comprehensive technical guidelines and exact code paths for managing TTS speech synthesis output, STT microphone input, VAD voice activity detection, and streaming audio playback across AIRI.

## 1. Overview & Surface Map

AIRI's audio infrastructure consists of 2 primary real-time pipelines:
- **Speech Pipeline (TTS Output)**: Text → VoiceProfile → UST Speech Transformers → Provider Synthesis (Kokoro, ElevenLabs, Azure, OpenAI) → Web Audio API / PCM Audio Playback.
- **Hearing Pipeline (STT Input)**: Microphone Input Device → Web Audio API VAD Node → Audio Chunking → Transcription Provider (Whisper WASM worker, Deepgram, Groq) → Text Ingestion into Chat.

## 2. Key Code Paths

### Pinia Stores
- `packages/stage-ui/src/stores/modules/speech.ts` — `speechStore`. Manages active TTS provider, voice selection (`voice_id`), pitch/rate, and TTS synthesis dispatch.
- `packages/stage-ui/src/stores/modules/hearing.ts` — `hearingStore`. Manages active STT provider, microphone device ID, VAD sensitivity threshold, and transcription state.
- `packages/stage-ui/src/stores/audio.ts` — `audioStore`. Manages global Web Audio API `AudioContext`, volume gain nodes, and PCM/WAV buffer playback queues.

### Runtime Pipelines & Audio Packages
- `packages/stage-ui/src/services/speech/pipeline-runtime.ts` — Speech pipeline execution runtime. Handles text chunking, UST transformers, and audio queueing.
- `packages/audio-pipelines-transcribe/src/` — Package for real-time STT streaming transcription, PCM encoding, and WebSocket audio streaming.
- `packages/stage-ui/src/libs/workers/whisper/` — Local Whisper WASM/WebGPU STT inference worker.

### Related Specs
- `docs/feat-audio-studio.md` — Specification document for VoiceProfiles and Universal Speech Transformers (UST).

## 3. Core SOPs & Guidelines

### 1. Adding a New TTS Provider
1. Define the provider in `packages/stage-ui/src/libs/providers/providers/` implementing `SpeechCapabilitiesInfo`.
2. Add provider registration in `speech.ts` and UI panel in `packages/stage-pages/src/pages/settings/providers/speech/`.
3. Support audio playback output formats (`audio/wav`, `audio/mp3`, `audio/pcm`).

### 2. Tuning STT & VAD Sensitivity
1. Adjust VAD parameters in `hearingStore` (`vadThreshold`, `silenceDurationMs`).
2. Verify audio input stream handling in `packages/audio-pipelines-transcribe/`.

## 4. Known Pitfalls & Failure Modes

- **AudioContext Autoplay Gating**: Browsers block Web Audio `AudioContext` until the user interacts with the page. Ensure `audioStore.ensureContext()` resumes context on first click/interaction.
- **PCM Buffer Underruns**: When streaming audio chunks over IPC or WebSockets, ensure the PCM queue in `pipeline-runtime.ts` maintains a smooth buffer queue to prevent stuttering.

## 5. Verification Workflows

- **Typecheck**: `pnpm -F @proj-airi/stage-ui typecheck`
- **Audio Package Typecheck**: `pnpm -F @proj-airi/audio-pipelines-transcribe typecheck`
