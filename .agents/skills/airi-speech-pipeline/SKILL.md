---
name: airi-speech-pipeline
description: >-
  Implement/debug TTS voice synthesis, physical audio output playback, speaker switching, VoiceProfiles, UST speech transformers, PCM/WAV codecs, audio stutter or silence. Intent scheduling uses airi-speech-runtime; STT transcription and microphone composer ingestion use airi-hearing-pipeline.
---

# Speech Synthesis Pipeline

Own voice configuration, text-to-audio synthesis, Universal Speech Transformers (UST), VoiceProfiles, and physical audio playback routing.
- **Intent lifecycle & playback ordering**: belongs to [speech runtime](../airi-speech-runtime/SKILL.md).
- **Thinking fillers & conversational pacing**: belong to [pacing](../airi-conversational-pacing/SKILL.md).
- **On-device neural TTS engines (Kokoro, Pocket, MOSS, Ming)**: belong to [local TTS engines](../airi-local-tts-engines/SKILL.md).
- **Microphone input, STT transcription, and composer dictation**: belong to [hearing pipeline](../airi-hearing-pipeline/SKILL.md).

## Source map

Repository-relative paths:

| Responsibility | Source |
| --- | --- |
| TTS settings, saved profiles, speech transformation | `packages/stage-ui/src/stores/modules/speech.ts` |
| AudioContext unlock and speaker/audio output selection | `packages/stage-ui/src/stores/audio.ts`: `useAudioContext`, `useAudioDevice` |
| VoiceProfile / UST editor | `packages/stage-ui/src/components/scenarios/settings/model-settings/audio-studio.vue` |
| Synthesis integration and playback host | `packages/stage-ui/src/components/scenes/ControlStripHost.vue` |
| Segmentation / scheduling | `packages/pipelines-audio/src/speech-pipeline.ts` |

## Synthesis and profiles

1. **Profile Resolution**: Trace selected profile to a physical provider, model, and voice. A virtual Audio Studio profile is a configuration wrapper, not a synthesis endpoint. Preserve saved-profile and card-profile resolution; fail clearly when unresolved.
2. **Text Transformation (UST)**: Use `transformTextForSpeech(text, providerId, voiceProfileId?)` and existing UST behavior. Preserve configured bracket/expression handling and transform order. Do not strip all parenthetical text unconditionally.
3. **Empty Transforms**: Treat transformed-empty text as no speech; do not enqueue an empty synthesis job. Keep raw assistant text and rendering separate from transformed spoken text.
4. **Codec & Format Alignment**: Check provider capability and output format before decode. PCM needs correct sample rate, channel count, and sample representation; encoded WAV/MP3 is not raw PCM.
5. **Actor Voice Overrides**: Resolve actor speech overrides without changing the visible actor ahead of playback. See `airi-director-orchestration` and `airi-speech-runtime`.

For a new provider, use `airi-provider-core-registry` and inspect existing capability registration. Do not assume adding a switch in `speech.ts` completes registry, configuration, and provider UI wiring.

## Physical Playback & Troubleshooting

- For **silence**: Distinguish suspended AudioContext, empty transformed text, synthesis failure, decode failure, cancelled intent, and wrong output route. `useAudioContext` unlocks on user interaction; do not invent an `ensureContext` API.
- For **stutter/glitches**: Inspect actual scheduling and PCM conversion at the host/transport; the cross-window runtime is not a PCM underrun buffer.

## Authoritative Design & Architecture Documents

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

Run relevant existing tests such as `pnpm exec vitest run packages/stage-ui/src/stores/modules/speech.test.ts` for transformation changes. Typecheck the affected workspace with `pnpm -F <workspace> typecheck`. Check direct and virtual voices, actor overrides, transformed-empty input, provider/decode errors, and supported audio formats.
