---
name: airi-tool-registry-builtin-tools
description: >-
  Use when working with tool calling across AIRI surfaces — the builtinTools factory (apps/stage-tamagotchi/src/renderer/stores/tools/builtin/), the tool registry inside ProactivityStore (registerTools/resolveRegisteredTools), the chat orchestrator toolsResolver, the card-level allowedTools gate in llmStore.filterToolsByAllowedTools, and the per-surface availability matrix (desktop chatbox, secondary windows/WhisperDock relay, web-stage, pocket, proactivity heartbeats, Discord text/voice/steer, Gemini Live Bidi native function calls, VLM turns). Covers tool-call rendering in chat slices and Discord outbound formatting, authoring new builtin tools, and registration pitfalls. Peer skills: airi-mcp-integration (MCP meta-tools), airi-interaction-pipelines (routing), airi-llm-dispatch-gateway (gateway-side filtering), airi-discord-integration, airi-gemini-live-api, airi-artistry-comfyui-widgets (image_journal), airi-generative-motion-vrma (generate_motion). Cites docs/rosetta-stone.md and docs/content/en/docs/advanced/architecture/arch-chat-stt-proactivity-pipelines.md.
---

# AIRI Tool Registry & Builtin Tools

Everything the model can *do* flows through two registries that are, today, fed the same way but wired differently per surface. This skill is the map of which surface gets which tools and why.

## 1. The Two Registries (one of them lives in the wrong store — by history)

### 1.1 Chat orchestrator `toolsResolver` (`packages/stage-ui/src/stores/chat.ts`)

- `toolsResolver` ref (:144) + `setToolsResolver(resolver)` (:146).
- Only one setter in the entire codebase: **desktop main window** `apps/stage-tamagotchi/src/renderer/pages/index.vue:764` → `chatStore.setToolsResolver(builtinTools)`.
- `performSend` uses it as fallback: `effectiveTools = options.tools || toolsResolver.value` (:470). A secondary-window `ingest` relays over `airi-chat-input-bridge`; the main-window receiver **injects** `tools: toolsResolver.value` into the relayed options (:162-167) — so secondary windows do not need tools of their own.
- VLM turns force `effectiveTools = undefined` (:484).

### 1.2 ProactivityStore registry (`packages/stage-ui/src/stores/proactivity.ts`)

- `registeredTools` ref (:69) holds tool objects, arrays, and async factory functions.
- `registerTools(tools)` (:71) appends. Sole caller: **desktop main window** `App.vue:198` `proactivityStore.registerTools(builtinTools)` (guarded by `isMainWindow`, alongside `startHeartbeatLoop()`).
- `resolveRegisteredTools()` (:901) flattens static entries + awaits factories into one `Tool[]`. Consumers:
  - Proactivity heartbeat — `llmStore.generate(..., { tools: resolveRegisteredTools, supportsTools: true })` (:707-711).
  - Gemini Live Bidi — `live-session.ts:234` (in-call function-call execution lookup) and `:482` (session tool declarations at `start()`).

**Structural oddity worth knowing**: the general tool registry physically lives in the proactivity store, so web/pocket apps that never import desktop builtinTools get *no* tools on any path. Moving registry ownership into the chat orchestrator (or a shared package layer) is the pre-identified fix if you ever want web/pocket tools.

## 2. The `builtinTools` Factory (`apps/stage-tamagotchi/src/renderer/stores/tools/builtin/index.ts`, 63 lines)

`async function builtinTools(): Promise<Tool[]>` — resolved lazily per request (chat) or once per resolve (proactivity/live). Composition:

| Tool family | File | Registered when | Card gate family |
| --- | --- | --- | --- |
| Text journal (`text_journal`) | `text-journal.ts` | always | `text_journal` |
| Motion (`generate_motion`) | `generate-motion.ts` | always (filtered at gateway by default — see §3) | `generate_motion` |
| Image journal (`image_journal`) | `image-journal.ts` | only if `artistry.configured` (per index.ts comment, replaces deprecated `widgets`/`stage_widgets` tools) | `image_journal` |
| Stickers | `stickers.ts` | only if a stickers library has content | pass-through |
| MCP meta-tools (`mcp_list_tools`, `mcp_call_tool`) | `mcp.ts` | only if the MCP bridge exists and ≥1 server is connected; qualified names are `server::tool` | `mcp` |

**Not wired** (exported but not pushed into the factory): `datingSimTools()` (`dating-sim.ts`) and `widgetsTools()` (`widgets.ts`, deprecated after image-journal adoption). If a card expects `update_dating_sim_variables`, its tool was never registered — wire it in index.ts first.

Tool authoring conventions in repo: `tool({ name, description, parameters: zod schema, execute })` from `@xsai/tool` (dating-sim/generate-motion pattern) or raw `{ type: 'function', function: {...} }` objects (stickers pattern). Arguments may arrive slightly malformed — chat.ts lenient-parses bridged call args (`tryParseLenientJson`).

### 2.1 ACT-Marker Tool Bridging (legacy-models path)

`chat.ts` `tryBridgeMarker` (:795+) converts text-emitted pseudo-tool-call markers into first-class slices when the model does not natively tool-call. Recognizes `<|tool:args|>`, `[call_tool:tool, args]`, `<tool_call>...</tool_call>` (both keyed-args and JSON flavors), parses kwargs with a lenient kv regex + `tryParseLenientJson`, looks the tool up in the same `options.tools`/resolver set, and **enqueues a `tool-call` slice into `toolCallQueue`** (:891+) identical to a native call. Bridged calls are therefore subject to the same execution, result handling, and stop/cancel semantics as native tool calls — treat the two as one mechanism when tracing.

## 3. Card-Level Gating Happens at the Gateway, Not Here

`llmStore.filterToolsByAllowedTools` (`llm.ts:295-331`) reads `activeCard.extensions.airi.generation.known.allowedTools` and runs against every request:

- No allowlist → everything **except** names containing `generate_motion` (back-compat default).
- Allowlist present → `text_journal` / `image_journal` / `mcp*` / `generate_motion` families gated by membership; unknown tool names pass through.

So a tool can be fully registered and still invisible per-card. See `airi-llm-dispatch-gateway` §2/§4-style gating and `airi-card-editor-wizard` for where `allowedTools` is authored in the card schema.

## 4. Availability Matrix (audited 2026-08)

| Surface | Tool calls? | Mechanism | Representation |
| --- | --- | --- | --- |
| Desktop main chatbox (`InteractiveArea.vue`) | **Yes** | `options.tools` absent → `toolsResolver` fallback (chat.ts:470; resolver set index.vue:764) | Chat slice trace (tool-call/tool-result bubbles) |
| Desktop secondary windows (actor WhisperDock, chat window) | **Yes** | Relay via `airi-chat-input-bridge`; main window injects `toolsResolver` (chat.ts:162-167). Note: actor.vue passes an intentionally empty `tools` prop stub (:147-148) — it is cosmetic, the relay overrides it | Same as main |
| Proactivity heartbeat | **Yes** | Registry → `supportsTools: true` (proactivity.ts:707-711) | Inscripted turn; visible if session active |
| Discord text messages | **Yes** | Ingest (:760) lands in stage window → resolver fallback | **Reformatted into the outbound Discord reply** (see §5) |
| Discord classic voice → STT | **Yes** | `ingest` at discord.ts:2227, same path as typed text | Same |
| Discord steer interruption | **Yes** | Steer ingest (:760 style, with partial-text rollup per `airi-interaction-pipelines` §7.1) | Same |
| Gemini Live Bidi | **Yes (native)** | Registry resolved for session declarations (:482) and per-call execution lookup (:234); native mid-turn function calls, `_geminiLiteralHandled` suppression per outputMode | Transcript only — no slice trace |
| Web stage (landscape ChatArea) | **No** | No `setToolsResolver`, no `registerTools`, no `tools` prop passed anywhere in `apps/stage-web`. `useChatComposer` plumbing accepts `tools` (ChatArea.vue:59) but nothing supplies it | n/a |
| Pocket stage (portrait MobileWhisperSheet / landscape) | **No** | Same as web — `MobileInteractiveArea`/`MobileWhisperSheet`/`WhisperComposerBar` all forward a `tools` prop down to `useChatComposer`, but `apps/stage-pocket` never provides one | n/a |
| VLM image turns | **No (forced)** | `effectiveTools = undefined` (chat.ts:484) | n/a |

**Fix path for web/pocket**, should it ever be wanted: the components already plumb `tools` end-to-end (`WhisperComposerBar` → `useChatComposer` → `ingest` → gateway); the gap is purely "nothing calls `setToolsResolver` / `registerTools` / passes `:tools` in web/pocket apps". Web/pocket run in the browser, so any resolver must avoid desktop-only `builtinTools` (Electron IPC, MCP bridge, artistry widgets) or provide web-safe subsets.

## 5. Tool-Call Rendering per Surface

- **Chat UI**: `performSend` records `tool-call`/`tool-result` slices into `streamingMessage` via `toolCallQueue` (chat.ts:917+) — displayed as tool blocks by the chatbox components (see `airi-desktop-chatbox`).
- **Discord outbound** (stage window only, leadership election `isStage`): `onChatTurnComplete` filters `chat.output.slices` for `type === 'tool-call'` (discord.ts:857-910) and formats human-readable lines into the reply:
  - `text_journal create` → `### New Journal Entry: {title}` + quoted content; `search` → `🔍 Searching Journal: "{query}"`
  - `image_journal create` → `🎨 Generating Image: "{prompt}"`; `apply`/`set_as_background` → `🖼️ Applying Background: "{query}"`
  - Fallback → `🔧 \`name\` | \`{json args}\``
  So yes — Discord users see tool activity inline in AIRI's replies, and tool *results* ride the relayed turn.
- **Gemini Live**: native Bidi function calls (`toolCall`/`toolResponse` websocket messages) are executed against the registry; results are returned over the socket, not traced as chat slices.
- **Authoritative relay rule**: metadata like `_discordSource` is stripped by `sanitizeMessages` before dispatch (`airi-llm-dispatch-gateway` §4) — Discord formatting re-reads it from the stream context on `onChatTurnComplete`, never from the provider response.

## 6. Authoring a New Builtin Tool (desktop)

1. Add `your-tool.ts` under `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/`, exporting an async factory or static `Tool[]` (zod `tool()` pattern preferred).
2. Gate registration in `builtin/index.ts` (config/store preconditions like `artistry.configured`) and push into `toolPromises`.
3. If it should be card-gateable, extend the known families in `llm.ts` `filterToolsByAllowedTools` (unknown names pass through by default — deliberate for custom tools).
4. Registration is centralized in `App.vue:198` / `index.vue:764` — nothing else to wire for desktop, main window, relayed secondary windows, credit text, Classic voice, or Live Bidi.
5. If the tool is long-running, respect that execution happens inline in the turn (chat waits on `toolCallQueue` drain, chat.ts:1541) and `maxSteps: 10` caps total steps (`airi-llm-dispatch-gateway` §3.1).

## 7. Pitfalls

- **Registry ≠ availability**: web/pocket surfaces silently run toolless until someone wires resolvers there (§4).
- **`generate_motion` is off by default** unless the card allowlists it.
- **Unwired exports** (`datingSimTools`, `widgetsTools`) look registered but are not.
- Tool errors bubble as stream `error` events, not tool-result errors (gateway §3).
- Generation bumps (stop/cancel) can race the `toolCallQueue` drain — see `airi-interaction-pipelines` §7.3 step 4 before implementing stop.

## 8. Verification

- Tool additions: `pnpm -F @proj-airi/stage-tamagotchi typecheck`.
- Runtime: one tool-bearing chat turn on desktop, one heartbeat (or `/heartbeat`-style trigger) where relevant, and a Discord turn if relay formatting changed.

## 9. Sources & Peer Skills

- Ground truth: `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/index.ts`, `packages/stage-ui/src/stores/proactivity.ts` (registry), `packages/stage-ui/src/stores/chat.ts` (resolver/loop), `packages/stage-ui/src/stores/llm.ts` (gating).
- `docs/content/en/docs/advanced/architecture/arch-chat-stt-proactivity-pipelines.md`, `docs/rosetta-stone.md`.
- Peer skills: `airi-mcp-integration`, `airi-interaction-pipelines`, `airi-llm-dispatch-gateway`, `airi-discord-integration`, `airi-gemini-live-api`, `airi-artistry-comfyui-widgets`, `airi-generative-motion-vrma`, `airi-dating-sim-engine`, `airi-desktop-chatbox`.

## Related Skills & References

- **Peer Skills**: [[airi-artistry-comfyui-widgets]], [[airi-card-editor-wizard]], [[airi-dating-sim-engine]], [[airi-desktop-chatbox]], [[airi-discord-integration]], [[airi-gemini-live-api]], [[airi-generative-motion-vrma]], [[airi-interaction-pipelines]], [[airi-llm-dispatch-gateway]], [[airi-mcp-integration]]
- **Key Documents**: [[rosetta-stone]], [[arch-chat-stt-proactivity-pipelines]]
