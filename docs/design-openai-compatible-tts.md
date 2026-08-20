# OpenAI-Compatible TTS Provider Reference

This document describes how AIRI's **OpenAI Compatible** speech provider discovers voices, normalizes responses, and falls back gracefully — so you can stand up your own compatible TTS server or configure an existing one without reverse-engineering the code.

The provider lives at `Settings → Providers → Speech → OpenAI Compatible`.

---

## Architecture Overview

The OpenAI Compatible provider is a "Bring Your Own Endpoint" TTS adapter. You supply a base URL and API key; AIRI handles voice discovery, model listing, and speech synthesis using best-effort heuristics. OpenAI itself does not expose a dynamic `/voices` endpoint for TTS — third-party servers invented this independently, and there is no canonical spec. AIRI bridges the gap.

### Endpoints AIRI Calls

| Purpose | Method | Path | Notes |
|---|---|---|---|
| Speech synthesis | `POST` | `{baseURL}/audio/speech` | Standard OpenAI TTS endpoint |
| Voice discovery | `GET` | See [Voice Discovery](#voice-discovery) below | Auto-probed or user-pinned |
| Model listing | `GET` | `{baseURL}/models` | Filtered to TTS-related models only |
| Health check | `POST` | `{baseURL}/audio/speech` | Sends `"ping"` with model `tts-1`, voice `alloy` |

All requests include `Authorization: Bearer {apiKey}` when an API key is configured.

### Speech Synthesis Request Shape

```
POST {baseURL}/audio/speech
Content-Type: application/json
Authorization: Bearer {apiKey}

{
  "model": "tts-1",
  "input": "Hello world",
  "voice": "alloy",
  "speed": 1.0
}
```

AIRI expects an audio binary response (`arrayBuffer`). Supported response format: MP3 by default (the `response_format` field is omitted unless explicitly configured).

---

## Voice Discovery

### Auto-Probe Waterfall

When the `Voices Endpoint Path` setting is left blank (default), AIRI probes three URLs in order and uses the **first successful response**:

| Order | URL | Rationale |
|---|---|---|
| 1 | `{baseURL}/audio/voices` | Mirrors the `/audio/speech` sibling naming pattern; used by some servers (e.g., Chatterbox-TTS-Server at `GET /v1/audio/voices`) |
| 2 | `{baseURL}/voices` | The most common convention in `unspeech`-type API wrappers |
| 3 | `{rootURL}/voices` | Fallback for servers that don't use a `/v1/` prefix (strips `v1/` from the base URL) |

If all three probes fail, **no voices are discovered** — AIRI falls back to manual voice input (see [Fallback Behavior](#fallback-behavior)).

### Pinned Path

If you set the `Voices Endpoint Path` field (e.g., `audio/voices` or `v1/audio/voices`), AIRI uses that path directly against `{baseURL}` and skips all probing. Use this when auto-detect picks the wrong endpoint or you know your server's exact path.

### Response Shape Normalization

Since no spec exists, AIRI handles two incompatible response formats:

#### Format A: Object Array

Used by `unspeech`, ElevenLabs-compatible proxies, and most OpenAI-style wrappers.

```json
[
  {
    "id": "alloy",
    "name": "Alloy",
    "voice_id": "alloy",
    "preview_url": "https://example.com/alloy.mp3",
    "languages": [{ "code": "en", "title": "English" }],
    "gender": "neutral",
    "labels": { "gender": "neutral" }
  }
]
```

Handled fields:
- `id` ← `voice.id || voice.voice_id || voice.name` (first available)
- `name` ← `voice.name || voice.id`
- `previewURL` ← `voice.preview_url || voice.preview_audio_url`
- `languages` ← `voice.languages || []`
- `gender` ← `voice.gender || voice.labels?.gender`

#### Format B: String Array

Used by `devnen/Chatterbox-TTS-Server` and other simple servers.

```json
["Abigail.wav", "Adrian.wav", "Alyssa.wav"]
```

AIRI strips common audio extensions (`.wav`, `.mp3`, `.ogg`, `.flac`, `.m4a`) to produce clean display names: `Abigail`, `Adrian`, `Alyssa`.

### Response Data Path Probing

After fetching, AIRI checks several JSON paths for the actual voice array:
1. `response.voices`
2. `response.data`
3. If the response itself is an array, uses it directly

If none of these yield a non-empty array, the probe is treated as a failure.

---

## Fallback Behavior

### No `/voices` Endpoint

If your server doesn't expose a `/voices` endpoint at all (or all probes fail), AIRI switches to **manual voice input**:

- In the **Speech module settings** (`Settings → Modules → Speech`), the voice dropdown is replaced by a free-text **Voice Name** field with placeholder `"Enter voice name (e.g., 'alloy', 'echo')"`.
- The **playground panel** always shows a free-text voice input regardless of discovery status.
- Whatever you type is sent directly as the `voice` field in the `/audio/speech` request body.

### Synthetic Voice Objects

When a manually entered voice ID is used, AIRI constructs a synthetic voice object on the fly:

```typescript
{
  id: "my-custom-voice",
  name: "my-custom-voice",
  description: "my-custom-voice",
  previewURL: "",
  languages: [{ code: "en", title: "English" }],
  provider: "openai-compatible-audio-speech",
  gender: "neutral"
}
```

This means you can use **any voice ID your server supports**, even if it's not discoverable.

### Defaults When Nothing Is Configured

If no voice is configured at all, AIRI defaults to `"alloy"`.

---

## Provider Configuration Reference

| Field | Required | Default | Description |
|---|---|---|---|
| API Key | Yes | — | Bearer token sent in `Authorization` header |
| Base URL | Yes | — | Must be absolute (e.g., `https://tts.example.com/v1/`) |
| Model | No | `tts-1` | Free-text model ID sent in the request body |
| Voice | No | `alloy` | Voice ID sent in the request body |
| Speed | No | `1.0` | Speech speed, range `0.5`–`2.0` |
| Voices Endpoint Path | No | *(auto-detect)* | Optional pinned path for voice discovery |

---

## Validation

When you save the provider configuration, AIRI runs a health check: it calls `POST /audio/speech` with `{ "model": "tts-1", "input": "ping", "voice": "alloy" }` and expects a `2xx` response. If it fails, you'll see an error — but you can click **"Continue Anyway"** to force-save the configuration.

---

## Standing Up a Compatible Server

### Minimum Viable Server

The absolute minimum your server needs:

1. `POST /audio/speech` — accepts `{ model, input, voice }`, returns audio bytes
2. Bearer token auth is optional (AIRI sends the header if you configure an API key)

### Recommended: Add a `/voices` Endpoint

If you want AIRI to auto-discover voices, add **one** of these endpoints:

```
GET /v1/voices        ← most common, recommended
GET /v1/audio/voices  ← Chatterbox-style
GET /voices           ← no-prefix fallback
```

Return either:
```json
[{ "id": "...", "name": "..." }, ...]
```
or:
```json
["VoiceName1.wav", "VoiceName2.wav"]
```

### Optional: Add a `/models` Endpoint

AIRI filters the model list to entries whose `id` contains `tts`, `speech`, `audio`, or `kokoro`. This is purely cosmetic — you can type any model ID in the settings field regardless.

---

## Known Compatible Servers

| Server | Voices Endpoint | Notes |
|---|---|---|
| [unspeech](https://github.com/moeru-ai/unspeech) | `GET /v1/voices` | Object array format; universal proxy for TTS/STT |
| [Chatterbox TTS Server](https://github.com/devnen/chatterbox-tts-server) | `GET /v1/audio/voices` | Returns `.wav` filename strings |
| OpenAI API (official) | *(none)* | No dynamic voice endpoint; use manual input |
| ElevenLabs (via unspeech) | `GET /v1/voices` | Object array with `voice_id`, `preview_url` |
| Kokoro (via unspeech) | `GET /v1/voices` | Object array with `voice_id` |

---

## Key Source Files

| File | What It Does |
|---|---|
| `packages/stage-ui/src/stores/providers.ts` (L845–990) | Provider definition, voice discovery waterfall, response normalization |
| `packages/stage-ui/src/stores/modules/speech.ts` (L196–227) | Synthetic voice fallback construction |
| `packages/stage-pages/src/pages/settings/modules/speech.vue` (L560–594) | Manual voice name input UI |
| `packages/stage-pages/src/pages/settings/providers/speech/openai-compatible-audio-speech.vue` | Provider config page: model, voice, speed, voicesPath |
| `packages/stage-ui/src/components/scenarios/providers/speech-playground-openai-compatible.vue` | Playground component with free-text voice input |

## Relevant Skills

- [[airi-audio-pipeline]]
