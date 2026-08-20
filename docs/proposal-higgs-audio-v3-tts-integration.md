# Proposal: Higgs Audio v3 TTS — Self-Hosted OpenAI-Compatible Integration

## What Is Higgs Audio v3?

[Higgs Audio v3 TTS](https://huggingface.co/bosonai/higgs-audio-v3-tts-4b) (released June 4, 2026) is a 4B-parameter text-to-speech model by Boson AI, built specifically for **conversational voice AI** rather than document reading. It is designed to speak model responses in the moment — with timing, expressiveness, and mid-utterance control that make voice agents feel genuinely alive.

Key facts:
- **100+ language support** with single-digit WER/CER across major multilingual benchmarks (SeedTTS, CV3, MiniMax-Multilingual, and Higgs-Multilingual)
- **Zero-shot voice cloning** from an audio reference
- **Inline control tokens** — emotion, style, prosody, pauses, and sound effects injected directly into the text stream
- **Paralinguistics category winner** in the Emergent TTS conversational benchmark at 68.57% win-rate (best open model overall)
- Served via **SGLang-Omni** or a custom Python HTTP server
- License: research & non-commercial only (at time of writing)

---

## The Decoupling Philosophy

This is **not** a proposal to bundle Higgs into AIRI's core. The established pattern for models that can't run in-browser (no ONNX/WebGPU build, no browser-compatible runtime) is a **self-hosted sidecar**: the user stands up a local Python HTTP server that exposes OpenAI-compatible endpoints, then points the relevant AIRI provider config at it.

AIRI already does this with:
- **Deepgram** — routed through Electron's main process to bypass CORS
- **Pioneer** — same CORS intercept pattern
- **OpenCode Go** — OpenAI-compatible API, sidecar approach

Higgs v3 would follow the same path. The user runs an SGLang-Omni or custom FastAPI server locally (or on a local GPU machine), disables parallel request execution if needed for GPU memory reasons, and registers it as a TTS provider in AIRI pointing at `http://localhost:<port>`.

There is a MOSS TTS Nano proposal in docs that qualifies for in-browser ONNX/WebGPU — Higgs v3 does not qualify for that track. These are two different integration tiers.

---

## The Real Discussion: The Control Token Problem

This is where it gets interesting and uncomfortable.

Higgs v3's killer feature is its **inline control token syntax**:

```
All tags follow <|category:value|> syntax and can be inserted mid-utterance.
```

**Emotion tokens** (21 values):
`elation`, `amusement`, `enthusiasm`, `determination`, `pride`, `contentment`, `affection`, `relief`, `contemplation`, `confusion`, `surprise`, `awe`, `longing`, `arousal`, `anger`, `fear`, `disgust`, `bitterness`, `sadness`, `shame`, `helplessness`

**Other control categories:**
- Style: `neutral`, `narration`, `customer-service`, `documentary`, `podcast`, `debate`, `weather-report`
- Speed: `x-slow`, `slow`, `moderate`, `fast`, `x-fast`
- Pitch: `very-low`, `low`, `moderate`, `high`, `very-high`
- Pauses: `<|pause:short|>`, `<|pause:medium|>`, `<|pause:long|>`
- Sound effects: `<|soundeffect:laughing|>`, `<|soundeffect:crying|>`, `<|soundeffect:sighing|>`, etc.
- Language switching: `<|zh|>`, `<|en|>`, `<|ja|>`, etc.

Example:
```
"I can't believe you did that. <|emotion:awe|> That's... actually incredible. <|pause:short|> Wow."
```

### Why This Is Antithetical to AIRI's Current Architecture

AIRI has a specific and deliberate guarantee: **tokenized marker format never reaches the TTS layer**.

The speech pipeline works like this:
1. The LLM streams tokens
2. `chat.ts` runs `categorizeResponse` / `createStreamingCategorizer` which extracts only the `speech` portion
3. The `speechOnly` text is emitted via the `onTokenLiteral` hook in [hooks.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/hooks.ts)
4. TTS providers subscribe to `onTokenLiteral` and receive clean, human-readable speech text
5. `<|ACT:...|>`, `<|EXPRESSION:...|>`, widget markers — all stripped before TTS ever sees them

Higgs v3 demands the **exact opposite**: for maximum benefit, the LLM itself should generate `<|emotion:sadness|>` and `<|pause:medium|>` tags inline as part of the character's speech output, and those tags must survive all the way to the TTS layer intact.

This creates a fundamental conflict:
- AIRI's marker parser in `chat.ts` would either eat the tags (mistaking them for tool markers or special tokens) or they'd pass through as literal text that renders in the chat UI — visible and ugly
- The `speechOnly` text categorization would need to know which `<|...|>` format belongs to Higgs vs. which belongs to AIRI's internal widget/action system
- The visual chat bubble would either show the tags to the user (bad) or strip them before the UI but preserve them in a parallel TTS-bound stream (complex, requires new plumbing)

---

## Option D — Recommended: Audio Studio UST Extension

The answer was in the existing architecture the whole time. AIRI already has a text transformation layer that sits **between the raw speech text and the TTS provider**: the **Universal Speech Transformer (UST)**, defined per voice profile in the Audio Studio ([feat-audio-studio.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/feat-audio-studio.md)).

The UST already strips asterisks, mutes narrative brackets, replaces tildes, strips emojis — all before the text reaches the TTS engine. This is exactly the hook we need.

### What Gets Added: One Toggle Per Profile

```json
{
  "ust": {
    "enabled": true,
    "mode": "mute",
    "convertBracketsToTokenFormat": true
  }
}
```

A new checkbox in the Audio Studio profile editor:

> **Convert square brackets to token format** `[ toggle ]`
> *Transforms `[emotion:sadness]` → `<|emotion:sadness|>` before sending to TTS. Enable when using Higgs Audio v3 or other control-token TTS providers.*

### Why This Works So Cleanly

- **The LLM keeps using square brackets** — AIRI's existing actor/scriptwriter direction format. The system prompt can instruct the character to produce `[pause:short]`, `[emotion:awe]` as stage directions. Nothing about the LLM interaction changes.
- **The display pipeline strips brackets as it always has** — square brackets are already treated as narrative/direction markers and handled by the UST's existing strip logic before anything reaches the chat UI.
- **The TTS pipeline receives Higgs-formatted tokens** — the UST runs the bracket-to-token conversion just before handing text to the base provider. The Higgs server receives `<|emotion:awe|>` exactly as it expects.
- **Per-profile, opt-in** — other voice profiles pointing at Kokoro, ElevenLabs, OpenAI TTS etc. are completely unaffected. The toggle only fires when explicitly enabled for a Higgs-backed profile.
- **Audio Studio is already the proxy layer** — it's designed to wrap and transform speech before the base engine. This is a natural extension of that design, not a new concept.

### The Bracket-to-Token Mapping

The transformation is a simple regex substitution on `[category:value]` shaped brackets only:

```
[category:value]  →  <|category:value|>
```

| Square Bracket (LLM output) | Higgs Token (TTS input) |
|---|---|
| `[emotion:sadness]` | `<\|emotion:sadness\|>` |
| `[pause:short]` | `<\|pause:short\|>` |
| `[style:customer-service]` | `<\|style:customer-service\|>` |
| `[speed:slow]` | `<\|speed:slow\|>` |
| `[soundeffect:sighing]` | `<\|soundeffect:sighing\|>` |
| `[zh]` | `<\|zh\|>` |

Brackets **without a colon** — existing AIRI action format like `[sighs]`, `[smiles warmly]` — are **not** transformed. They continue to follow the existing mute/flatten/custom UST rules. Only `[category:value]` shaped brackets get the conversion, so there is no collision with existing roleplay directions.

---

## Prior Approaches Considered (Historical Reference)

These three approaches were explored before landing on the UST extension above.

### Option A: LLM-Generated Tags (Full Power, High Complexity)
The LLM is instructed via system prompt to generate Higgs control tokens inline as part of its speech. AIRI would need a **parallel speech stream** — a shadow copy of the token flow where Higgs tags are preserved and routed to TTS, while the display stream has them stripped. The existing `onTokenLiteral` hook architecture would need a companion `onTokenLiteralWithControls` hook, and the TTS provider would subscribe to the latter.

**Why it was rejected:** The LLM needs to know Higgs v3's exact `<|...|>` syntax and produce it consistently. Most LLMs (especially roleplay-tuned ones) will hallucinate, over-use, or randomly omit tags. This also directly conflicts with AIRI's guarantee that `<|...|>` markers never reach TTS. The result is unstable and architecturally invasive.

### Option B: Inference-Time Tag Injection (Pragmatic Middle Ground)
The LLM generates clean speech text as always. Before handing the text to the Higgs TTS server, AIRI runs a lightweight **post-processing step** that infers emotion/prosody from context and injects appropriate Higgs tags.

**Why it was rejected:** Loses mid-utterance granularity — injection would be per-sentence at best. Also requires an emotion classifier with its own quality and latency costs.

### Option C: Strip on Receive, Forward Raw to TTS
AIRI instructs the LLM to produce Higgs tags. The display pipeline strips them; a parallel TTS-bound channel preserves them. Requires modifying the `onTokenLiteral` hook signature.

**Why it was rejected:** Architecturally cleaner than A but still requires new hook plumbing and still has the LLM consistency problem. The UST solution is simpler and doesn't touch the hook system at all.

---

## CORS & Server Considerations

Like Deepgram and Pioneer, a locally-hosted Higgs TTS server would be CORS-restrictive by default when accessed from the web stage. On the desktop stage (Electron), this is already handled by the `webRequest.onHeadersReceived` intercept. If the user adds their Higgs server URL to the **CORS Bypass URLs** list in Settings → System → Connection, it would be intercepted automatically.

For parallel execution: GPU inference for a 4B model can't handle concurrent requests gracefully. The custom server wrapper should enforce a **request queue** (single-threaded inference, queue on the HTTP layer). This is a server-side concern, not something AIRI enforces.

---

## WebGPU/ONNX Track — Not Applicable Here

MOSS TTS Nano qualifies for in-browser WebGPU inference because it has a quantized ONNX build that fits in browser memory. Higgs v3 at 4B parameters does not. There is no known ONNX/WebGPU-compatible export of Higgs v3 at time of writing. If one emerges, that changes the integration calculus entirely and would be a separate proposal.

---

## The Deep Integration: `/chatterbox/capabilities` — Already Solved

The "where does the LLM instruction surface live" question is already answered — and it requires **zero AIRI code changes**.

The chatterbox sidecar server exposes:

```python
@app.get("/chatterbox/capabilities")
async def get_capabilities():
    return {
        "voices": list_voice_files(),
        "profiles": list(profiles.keys()),
        "modes": ["full", "turbo"],
        "speech": {
            "supportsPresets": True,
            "supportsExpressionTags": True,
            "supportsMannerisms": True,
            "expressionTags": get_supported_expression_tags(),
            "mannerisms": get_supported_mannerisms(),
        }
    }
```

AIRI already calls this endpoint and uses `expressionTags` to render clickable tag buttons in the Card Edit Modal under **Speech Tags / Audio Expressions**. When the user clicks `[sad]` or `[whisper]`, that tag gets inserted into the LLM's speech instruction context — teaching the character to emit those brackets inline in its responses.

The `expressionTags` data comes directly from `supported_tags.csv`, which is hot-reloaded on every request. Adding Higgs support on the server side is just:

1. Add a `--higgs` mode flag to `server.py` alongside the existing `--omni`, `--turbo`, `--full` flags
2. Expand `supported_tags.csv` with Higgs emotion/style/prosody/pause tokens using the existing `[category:value]` bracket format
3. The capabilities endpoint automatically returns them
4. AIRI surfaces them as buttons in the Card Edit Modal automatically
5. The UST `convertBracketsToTokenFormat` toggle transforms `[emotion:sadness]` → `<|emotion:sadness|>` before the text hits the Higgs TTS engine

The full end-to-end flow with zero new AIRI plumbing:

```
supported_tags.csv (Higgs rows added)
    ↓ hot-reload
/chatterbox/capabilities → expressionTags
    ↓ AIRI reads on provider connect
Card Edit Modal → Speech Tags buttons ([emotion:sadness], [pause:short], ...)
    ↓ injected into LLM system prompt
LLM generates: "That was incredible. [emotion:awe] I didn't expect that."
    ↓ onTokenLiteral (clean speech text with brackets)
UST convertBracketsToTokenFormat: [emotion:awe] → <|emotion:awe|>
    ↓
Higgs TTS server receives: "That was incredible. <|emotion:awe|> I didn't expect that."
```

---

## Open Questions

- **Provider registration**: Should Higgs v3 get its own named TTS provider entry in `providers.ts`, or should it be registered as an OpenAI-compatible TTS endpoint and identified by the `convertBracketsToTokenFormat` toggle? The latter keeps it provider-agnostic and would work for any future control-token TTS that follows the same pattern.
- **Server rename/rebrand**: The chatterbox sidecar project has outgrown its name — it now ships OmniVoice support and is about to get Higgs bolted on. `chatterbox-tts-airi` is increasingly a misnomer (the upstream Chatterbox project has also effectively gone dormant). Worth renaming to something engine-agnostic (e.g. `airi-tts-server` or `airi-speech-sidecar`) and reworking the `/chatterbox/capabilities` endpoint path to something like `/airi/capabilities`. Since both this sidecar and the AIRI fork are owned by the same author, the rename is a single self-coordinated pass: update the server endpoint, update the AIRI-side capabilities URL, ship together.
- **License gate**: Research & non-commercial only at time of writing. If a commercial license becomes available, this raises the implementation priority significantly.

## Relevant Skills

- [[airi-audio-pipeline]]
