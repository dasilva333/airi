---
name: airi-audio-pipeline
description: >-
  Implement/debug TTS synthesis, STT transcription, microphone/speaker switching, VAD, VoiceProfiles, UST speech transformers, PCM/WAV playback, audio stutter or silence. Intent scheduling uses airi-speech-runtime; Gemini sessions use airi-gemini-live-api.
---

# Audio Pipeline

Own voice configuration, text-to-audio synthesis, transcription, and physical audio formats/devices. Intent lifecycle belongs to [speech runtime](../airi-speech-runtime/SKILL.md); filler budgets/cache belong to [pacing](../airi-conversational-pacing/SKILL.md); worker execution belongs to [local inference](../airi-local-inference-engines/SKILL.md).

## Source map

Repository-relative paths:

| Responsibility | Source |
| --- | --- |
| TTS settings, saved profiles, speech transformation | `packages/stage-ui/src/stores/modules/speech.ts` |
| STT provider/model, detection mode, auto-send settings | `packages/stage-ui/src/stores/modules/hearing.ts` |
| AudioContext unlock and microphone selection | `packages/stage-ui/src/stores/audio.ts`: `useAudioContext`, `useAudioDevice` |
| VoiceProfile / UST editor | `packages/stage-ui/src/components/scenarios/settings/model-settings/audio-studio.vue` |
| Synthesis integration and playback | `packages/stage-ui/src/components/scenes/ControlStripHost.vue` |
| Segmentation / scheduling | `packages/pipelines-audio/src/speech-pipeline.ts` |
| Streaming transcription transport | `packages/audio-pipelines-transcribe/src/` |
| Whisper adapter and worker | `packages/stage-ui/src/libs/inference/adapters/whisper.ts`, `packages/stage-ui/src/libs/workers/worker.ts` |

## Synthesis and profiles

1. Trace selected profile to a physical provider, model, and voice. A virtual Audio Studio profile is a configuration wrapper, not a synthesis endpoint. Preserve saved-profile and card-profile resolution; fail clearly when unresolved.
2. Use `transformTextForSpeech(text, providerId, voiceProfileId?)` and existing UST behavior. Preserve configured bracket/expression handling and transform order. Do not strip all parenthetical text unconditionally.
3. Treat transformed-empty text as no speech; do not enqueue an empty synthesis job. Keep raw assistant text and rendering separate from transformed spoken text.
4. Check provider capability and output format before decode. PCM needs correct sample rate, channel count, and sample representation; encoded WAV/MP3 is not raw PCM.
5. Resolve actor speech overrides without changing the visible actor ahead of playback. See `airi-director-orchestration` and `airi-speech-runtime`.

For a new provider, use `airi-provider-core-registry` and inspect existing capability registration. Do not assume adding a switch in `speech.ts` completes registry, configuration, and provider UI wiring.

## Hearing and physical playback

Follow the actual detection-mode caller from microphone acquisition through VAD or manual recording, transcription, and final ingestion. VAD tuning belongs at the detector implementation; hearing settings are not proof that a particular threshold field exists.

Preserve permission errors, device disappearance/reselection, old stream-track cleanup, and auto-send debouncing. STT partials must not become duplicate user turns. Follow provider-specific streaming/final-result semantics.

For silence, distinguish suspended AudioContext, empty transformed text, synthesis failure, decode failure, cancelled intent, and wrong output route. `useAudioContext` unlocks on interaction; do not invent an `ensureContext` API. For stutter, inspect actual scheduling and PCM conversion at the host/transport; the cross-window runtime is not a PCM underrun buffer.


### Authoritative Design & Architecture Documents

- [docs/feat-audio-studio.md](docs/feat-audio-studio.md) — Audio studio feature spec (VoiceProfiles, UST).
- [docs/design-openai-compatible-tts.md](docs/design-openai-compatible-tts.md) — OpenAI-compatible TTS.
- [docs/blueprint-tts-universal-speech-transformer.md](docs/blueprint-tts-universal-speech-transformer.md) — TTS universal speech transformer blueprint.
- [docs/blueprint-aws-polly-integration.md](docs/blueprint-aws-polly-integration.md) — AWS Polly integration blueprint.
- [docs/analysis-pocket-tts-viability.md](docs/analysis-pocket-tts-viability.md) — Pocket TTS viability analysis.
- [docs/analysis-gpt-sovits-onnx-webgpu-viability.md](docs/analysis-gpt-sovits-onnx-webgpu-viability.md) — GPT-SoVITS ONNX WebGPU viability analysis.
- [docs/proposal-higgs-audio-v3-tts-integration.md](docs/proposal-higgs-audio-v3-tts-integration.md) — Higgs Audio V3 TTS integration proposal.
- [docs/proposal-moss-tts-nano-provider-unified-webgpu.md](docs/proposal-moss-tts-nano-provider-unified-webgpu.md) — MOSS TTS nano provider unified WebGPU proposal.
- [docs/project-multimodal-audio-transport.md](docs/project-multimodal-audio-transport.md) — Multimodal audio transport project.
- [docs/tts.md](docs/tts.md) — TTS research reference.
- [docs/lipsync.md](docs/lipsync.md) — Lipsync research reference.

## Verification

Run relevant existing tests such as `pnpm exec vitest run packages/stage-ui/src/stores/modules/speech.test.ts` for transformation changes. Typecheck the affected workspace with `pnpm -F <workspace> typecheck`.

Check direct and virtual voices, actor overrides, transformed-empty input, provider/decode errors, and supported audio formats. For hearing changes, test permission denial, microphone switching, silence, one recording, and streaming transcription. Playback claims require listening on the affected app/output route.

## Design context

Read `docs/feat-audio-studio.md`, `docs/blueprint-tts-universal-speech-transformer.md`, and `docs/design-openai-compatible-tts.md` for the relevant task. They explain intent; executable provider and transformation code determine current support.
