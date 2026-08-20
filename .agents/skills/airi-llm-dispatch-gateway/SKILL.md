---
name: airi-llm-dispatch-gateway
description: >-
  Use when tracing, extending, debugging, or tuning the LLM request dispatch gateway — the useLLM store (packages/stage-ui/src/stores/llm.ts) through which every chat turn, proactivity heartbeat, VLM/analysis first-hop, and structured-output call leaves the renderer. Covers the StreamOptions contract (abortSignal, waitForTools, supportsTools, lazy tools resolver, vision, contextWidth→num_ctx, requestOverrides sanitization), the per-model tools-compatibility cache with one-way runtime auto-degrade, message/system-message sanitization, the dual-settlement stream promise, and the hard maxSteps:10 cap. Peer skills: airi-provider-core-registry, airi-provider-store-instances, airi-tool-registry-builtin-tools, airi-interaction-pipelines, airi-prefix-cache-alignment. Cites docs/rosetta-stone.md and docs/arch-chat-stt-proactivity-pipelines.md as supporting architecture docs.
---

# AIRI LLM Dispatch Gateway

`packages/stage-ui/src/stores/llm.ts` (638 lines) — `useLLM = defineStore('llm', ...)` (:559) — is the single renderer-side funnel for every LLM request. It wraps `@xsai/stream-text` / `@xsai/generate-text` and owns three things nobody else owns: message sanitization, tools resolution/compatibility, and the `StreamEvent` protocol.

## 1. Public Surface

| Member | Line | Notes |
| --- | --- | --- |
| `stream(model, chatProvider, messages, options?)` | :562 | Wraps `streamFrom`; catches `isToolRelatedError` → flips `toolsCompatibility[key] = false` (:568) then rethrows |
| `generate(...)` | :576 | Non-streaming twin via `generateFrom` |
| `generateObject<T>(model, chatProvider, options)` | :580 | Structured output; delegates to `@proj-airi/stage-shared` `generateObject` with chatConfig `apiKey/baseURL/fetch` merged in |
| `discoverToolsCompatibility(model, chatProvider, _, options?)` | :601 | Cached; skipped when `${baseURL}-${model}` key already known |
| `models(apiUrl, apiKey)` | ~:611 | `@xsai/model` `listModels`; returns `[]` on invalid-URL rather than throwing |
| `toolsCompatibility` (internal) | :560 | `useLocalStorage('settings/llm/tools-compatibility-v3', {})` |

### 1.1 Call-site map (every caller must go through here)

- **Interactive chat turn** — `chat.ts:1424` `llmStore.stream(effectiveModel, effectiveProvider, newMessages, { headers, abortSignal, onStreamEvent, tools: effectiveTools, waitForTools: true, ... })`
- **VLM analysis first-hop** — `chat.ts:378` `llmStore.generate(visionStore.activeModel, vlmProvider, vlmMessages, { vision: true })` (no tools)
- **First-hop "two-hop" cognition** — `chat.ts:1340`
- **Proactivity heartbeat** — `proactivity.ts:709` with `{ tools: resolveRegisteredTools, supportsTools: true }`
- **Structured output paths** — `generateObject`: `use-producer.ts:256`, `memory-text-journal.ts:560`, `memory-lifetime.ts` (3 sites), `text-to-motion.ts:158`, `echo-chips.ts:302`, `chat_rehearsal.vue:378`
- **Memory/summarizer generate** — `memory-short-term.ts:324`
- **Wizard/card-production generate** — `packages/stage-pages/src/pages/settings/airi-card/**` (5 sites), `ModelPromptGeneratorModal.vue:161`, `artistry-autonomous.ts:651`

## 2. StreamOptions Contract (:24-39)

```ts
{
  headers?, onStreamEvent?, toolsCompatibility?, supportsTools?, waitForTools?,
  tools?,            // Tool[] OR () => Promise<Tool[] | undefined> — lazy, resolved per request
  abortSignal?, temperature?, top_p?, max_tokens?, contextWidth?, vision?, requestOverrides?
}
```

- `tools` as a **function** is the norm (`builtinTools` is an async factory). Resolution happens *inside* the gateway (`resolveTools`, :341-346) and only after the compatibility check — incompatible models never pay resolver cost; `supportsTools: true` bypasses the cache.
- `requestOverrides` is sanitized by `sanitizeRequestOverrides` (:40-56): `messages`, `headers`, `tools`, `onEvent`, `abortSignal`, `maxSteps` are **stripped** — callers cannot override those internals.
- `contextWidth` maps to `num_ctx` (:410).

## 3. StreamEvent Protocol (:15-22)

`text-delta`, `reasoning-delta`, `finish`, `tool-call` (CompletionToolCall fields), `tool-result`, `usage`, `error`. `chat.ts` consumes all of these; **an `error` event rejects the gateway promise** (via `rejectOnce` inside `onEvent`, :390-392) rather than arriving as a data channel.

### 3.1 Dual-settlement promise (debug anchor for "stream hung")

`streamFrom` (:333-445) resolves `Promise<void>` through three race paths under a `settled` guard:

1. `onEvent` sees `finish` and `!waitForTools` → immediate resolve (:387).
2. `finish` with `waitForTools: true` → defers to `result.messages.then()` so buggy endpoints (Gemini's OpenAI proxy returning `stop` mid tool-loop) don't resolve early (:383-388, :422).
3. `result.steps.catch` (:427) and sync throws (:441) also reject; `result.usage.catch` is log-only (:433).

`result.totalUsage.then()` re-emits as a synthetic `{ type: 'usage' }` event (:435-438) because some proxies never emit per-step usage — token accounting depends on this.

**`maxSteps: 10` is hard-coded** (:404 stream, generateFrom similar) and not overridable. A tool loop needing more than 10 steps silently ends; plan orchestration across turns, not inside one stream.

### 3.2 Idle-timeout abort

The only abort source today is `chat.ts`'s per-turn `AbortController` + `settingsChat.streamIdleTimeoutMs` (600 s default, `stores/settings/chat.ts:10`). No UI-facing abort exists — see `airi-interaction-pipelines` §7 for the stop/cancel audit.

## 4. Message Sanitization (`sanitizeMessages`, :65-110)

- JSON-snapshots (`toRaw` + `JSON.parse(JSON.stringify())`) so xsai's `structuredClone` never touches Vue reactive proxies.
- Keeps only provider-legal fields: `role`, `content`, `name`, `tool_calls`, `tool_call_id`. Custom metadata (e.g. `_discordSource`) is stripped here — **do not expect metadata to survive dispatch**; Discord relay reads it from the stream context instead.
- `role: 'error'` → rewritten to `user` with `User encountered error:` prefix (:87-90).
- `vision === false` (strict) collapses `image_url` content parts to `[Image]`; array content without images is flattened to a string.

## 5. Tools Compatibility Cache

Cache key `${baseURL}-${model}`; only `false` values are ever stored.

- **One-way runtime auto-degrade** (`stream`, :562-573): any thrown error matching `TOOLS_RELATED_ERROR_PATTERNS` (:166-178 — Ollama, OpenRouter, OpenAI-compat/Groq, Azure AI Foundry, Google GenAI, Anthropic, Cloudflare Workers AI) disables tools for that model until the localStorage key is deleted. This is the classic "tools silently disappeared" vector; check `settings/llm/tools-compatibility-v3` first when users report tool loss.
- **Manual discovery** (`attemptForToolsCompatibilityDiscovery`, :493+): two staggered `Hello, world!` probes (tools on/off, 1 s apart), both must succeed; an interruption in either attempt throws with combined cause.
- Note the doc-vs-code gap: the arch doc lists autofix-on-error as a *planned* capability, but the implementation only *flags* — it never retries without tools. Treat "first tool error ⇒ permanent flag" as current behavior.

## 6. System-Message Combination (`combineSystemMessagesIfNeeded`, :112-157)

Combines multiple system messages into one for Gemini (`googleapis.com`), web-llm, or when `settingsChat.combineSystemMessages` — deduping persona blocks and keeping the last context block. This is the gateway's contribution to prefix-cache alignment; see `airi-prefix-cache-alignment` for why dynamic context must stay behind the persona prefix.

## 7. Common Failure Patterns

| Symptom | First suspect |
| --- | --- |
| Tools gone on one model | `toolsCompatibility` false flag (§5) |
| Stream promise never resolves | `waitForTools` interaction with proxy `stop`-finish-reason quirk (§3.1); idle timeout is the watchdog |
| 400 from strict providers (OpenRouter/Phala) | Unsanitized message fields — extend the allowlist in `sanitizeMessages` |
| `AIRI Chat Provider 未初始化` throw | Provider instance was null or not a chat-capable ChatProvider (`getChatConfig`, :58-62) — check provider registry wiring |
| Tool loop cut short | `maxSteps: 10` ceiling (§3.1) |

## 8. Verification

- Type changes: `pnpm -F @proj-airi/stage-ui typecheck`.
- Behavior changes: exercise one streaming chat turn, one `generateObject` path (e.g. echo-chips summarize), and one tools-bearing turn, because all three settle through different promise paths.

## 9. Authoritative Sources

- `packages/stage-ui/src/stores/llm.ts` (this skill's ground truth)
- `docs/arch-chat-stt-proactivity-pipelines.md` — pipeline placement of the gateway
- `docs/rosetta-stone.md` — provider/LLM section index
- Peer skills: `airi-provider-core-registry`, `airi-provider-store-instances`, `airi-tool-registry-builtin-tools`, `airi-interaction-pipelines`

## Related Skills & References

- **Peer Skills**: [[airi-interaction-pipelines]], [[airi-prefix-cache-alignment]], [[airi-provider-core-registry]], [[airi-provider-store-instances]], [[airi-tool-registry-builtin-tools]]
- **Key Documents**: [[rosetta-stone]], [[arch-chat-stt-proactivity-pipelines]]
