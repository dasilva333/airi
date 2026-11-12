# Architecture Specification: AiriCard Capability Packs

> **Status**: Approved Architectural Standard
> **Concept**: Modular Functional Add-Ons for Companion Personas
> **Primary Surfaces**:
> - Character Card Creator (`packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabTools.vue`)
> - First-Run Onboarding V3 (`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-tools.vue`)
> **Related Documents**: [`docs/content/en/docs/chronicles/roadmap.md`](./content/en/docs/chronicles/roadmap.md), [`docs/design-onboarding-v3.md`](./design-onboarding-v3.md), [`docs/design-conversational-group-bot.md`](./design-conversational-group-bot.md)

---

## 1. Executive Summary & Design Philosophy

As an AI companion's capability repertoire grows—encompassing web search, filesystem access, image generation, memory recording, kinetic animation, and OS automation—managing tool access becomes a critical UX challenge.

Historically, AI agent interfaces fall into two opposing failure modes:
1. **The "Single Mega-Switch"**: A single global toggle that indiscriminately injects dozens of complex JSON tool schemas into the model's system prompt. This causes severe prompt bloat, increases inference costs, degrades reasoning fidelity, and induces hallucinations on weaker models.
2. **The "Hundred Toggles from Hell"**: Exposing raw, granular JSON schemas and separate switches for every individual function call, overwhelming end users with configuration fatigue and technical jargon.

AIRI resolves this through **Capability Packs**: curated, modular, functional "add-ons" that bundle related runtime tools, native functions, system prompt guidance, and platform-specific gating rules into cohesive thematic units.

```
┌────────────────────────────────────────────────────────────────────────┐
│                       The Capability Pack Model                        │
├────────────────────────────────────────────────────────────────────────┤
│  A Capability Pack is a thematic, progressive-disclosure functional    │
│  add-on for a character companion. Users enable capabilities by theme   │
│  (e.g., "Web Research", "Local Workspace", "Artistry") rather than      │
│  configuring low-level APIs or managing raw JSON schemas.              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Presentation Surfaces & Progressive Disclosure

Capability Packs are surfaced across two primary application boundaries:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Capability Pack Surfaces                        │
├───────────────────────────────────┬────────────────────────────────────┤
│ Surface A: Character Card Creator │ Surface B: Onboarding V3 Stepper   │
│ (CardCreationTabTools.vue)        │ (step-tools.vue)                   │
├───────────────────────────────────┼────────────────────────────────────┤
│ • In-depth, per-character tuning  │ • High-velocity first-run setup    │
│ • Tool Call vs. Token templates   │ • 1-click master pack toggles      │
│ • Introspective intrusion prompts │ • Informative readiness badges     │
│ • Reactive syntax conflict alerts │ • Safe zero-friction defaults      │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Surface A: Character Card Creator (`CardCreationTabTools.vue`)
- **Location**: `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabTools.vue`
- **Purpose**: Deep customization for authors creating or editing an AiriCard.
- **Progressive Disclosure Hierarchy**:
  - **Level 1 (Master Card & Switch)**: Clean card with title, icon, capability badge, concise description, and master activation toggle.
  - **Level 2 (Active Capabilities & Badges)**: Discloses active tool identifiers (e.g. `web_search`, `fetch_content`) and practical tips.
  - **Level 3 (Advanced Customization & Templates)**: Provides one-click template insertion (*Tool Call* vs. *Token Style* formats), real-time instruction conflict warnings, and intrusive context injection prompts (Dream Intrusion, Journal Intrusion, Artistry Intrusion).

### Surface B: First-Run Onboarding V3 (`step-tools.vue`)
- **Location**: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-tools.vue` (Step 15 in [`docs/design-onboarding-v3.md`](./design-onboarding-v3.md))
- **Purpose**: Fast, accessible first-time setup for new users.
- **Experience**: Clean, friendly presentation with colored iconography and capability pills (`0-Key Web Search`, `Desktop MCP`, `VRMA Generation`). Users can immediately equip their companion with core abilities in 1 click without ever opening a settings file or writing JSON.

---

## 3. Configuration Taxonomy: The Three Tiers

To keep the system intuitive, Capability Packs are categorized into three configuration tiers based on their user setup footprint:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      Capability Pack Configuration Tiers                 │
├───────────────────┬────────────────────────────┬─────────────────────────┤
│ Tier              │ Description                │ Setup Requirement       │
├───────────────────┼────────────────────────────┼─────────────────────────┤
│ Tier 1: Turnkey   │ Zero external setup, zero  │ None. 1-click toggle    │
│ (Zero-Config)     │ API keys, zero maintenance │ immediately functional. │
├───────────────────┼────────────────────────────┼─────────────────────────┤
│ Tier 2: Scoped    │ Sandboxed local resource   │ Simple boundary select  │
│ Environment       │ access with native pickers │ (e.g. 1-click folder).  │
├───────────────────┼────────────────────────────┼─────────────────────────┤
│ Tier 3: Privileged│ High-privilege system/OS   │ Permissions, approval   │
│ Automation        │ orchestration & external bridges│ mode, whitelist config. │
└───────────────────┴────────────────────────────┴─────────────────────────┘
```

---

## 4. Capability Packs Catalog: Present & Future

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   AiriCard Tools: Capability Packs                       │
├───────────────────────────────┬──────────────────────────────────────────┤
│ Pack Name                     │ Included Tools & Native Functions        │
├───────────────────────────────┼──────────────────────────────────────────┤
│ 🌐 Web & Research Pack        │ • fetch_url (instant Markdown/text RAG) │
│    [Tier 1: Shipped]          │ • web_search (live search queries)       │
├───────────────────────────────┼──────────────────────────────────────────┤
│ 📁 Local Workspace Pack       │ • @modelcontextprotocol/server-filesystem│
│    [Tier 2: Shipped]          │ • Turnkey Native Folder Picker           │
├───────────────────────────────┼──────────────────────────────────────────┤
│ 🎨 Visual Artistry Pack       │ • image_journal (scene & selfie art)     │
│    [Tier 1: Shipped]          │ • Artistry Intrusion hooks               │
├───────────────────────────────┼──────────────────────────────────────────┤
│ 🧠 Sacred Memory Pack         │ • text_journal (immutable LTMM entries)  │
│    [Tier 1: Shipped]          │ • Dream & Journal Intrusion hooks        │
├───────────────────────────────┼──────────────────────────────────────────┤
│ 🏃 Kinetic Motion Pack        │ • generate_motion (FlowMDM VRMA)         │
│    [Tier 1: Shipped]          │ • On-device neural procedural motion     │
├───────────────────────────────┼──────────────────────────────────────────┤
│ 🖥️ Desktop Computer Use Pack  │ • @auv-js AUV daemon (Eventa IPC)        │
│    [Tier 3: Planned Design]   │ • Native OS actions & window inspection  │
├───────────────────────────────┼──────────────────────────────────────────┤
│ ⚙️ Custom Developer MCP        │ • mcp.json raw stdio server manager      │
│    [Tier 3: Shipped]          │ • Third-party database & API bridges     │
└───────────────────────────────┴──────────────────────────────────────────┘
```

---

### Shipped Capability Packs

#### 1. 🌐 Web & Research Pack (Tier 1: Turnkey)
* **Underlying Tools**: `web_search`, `fetch_content` / `fetch_url`.
* **Runtime**: Built-in `open-websearch` module (DuckDuckGo, Bing, Brave, Baidu) + readability Markdown extractor.
* **Platform Availability**: All platforms (Electron, Web via reverse-proxy worker, Mobile via Capacitor HTTP).
* **Configuration Footprint**: **Zero Setup Required**. Requires no API keys, account sign-ins, or billing setup. Immediate out-of-the-box live search and webpage reading.

#### 2. 📁 Local Workspace & Filesystem Pack (Tier 2: Scoped Environment)
* **Underlying Tools**: `read_file`, `read_multiple_files`, `write_file`, `edit_file`, `create_directory`, `list_directory`, `directory_tree`, `move_file`, `search_files`, `get_file_info`.
* **Runtime**: Turnkey `@modelcontextprotocol/server-filesystem` MCP server over stdio.
* **Platform Availability**: Desktop Electron (`stage-tamagotchi`) only; hidden on Web and Mobile due to sandbox boundaries.
* **Configuration Footprint**: **Directory Boundary Selection**. Users select an accessible folder (e.g. `~/Projects` or `~/Downloads`) via a 1-click native Electron folder picker (`dialog.showOpenDialog`). The system automatically writes the path to `mcp.json` via `ensureMcpServersForAllowedTools(['filesystem'])`.

#### 3. 🎨 Visual Artistry & Studio Pack (Tier 1: Turnkey)
* **Underlying Tools**: `image_journal`.
* **Runtime**: Unified Artistry switchboard dispatching to active backends (ComfyUI, Replicate, NanoBanana, or Procedural Code-Painter).
* **Platform Availability**: All platforms.
* **Configuration Footprint**: **Zero Required Card Config**. Functions automatically with the active Artistry provider. Card authors can optionally select prompt templates (*Tool Call* vs. *Token Style*) and enable *Artistry Intrusion* to prompt companions to discuss newly generated art on the next conversation turn.

#### 4. 🧠 Sacred Memory & Recall Pack (Tier 1: Turnkey)
* **Underlying Tools**: `text_journal`.
* **Runtime**: Local episodic database (IndexedDB `local:text-journal:*` / LocalForage).
* **Platform Availability**: All platforms.
* **Configuration Footprint**: **Zero Required Setup**. Ready immediately. Authors can optionally customize system instructions or enable *Dream Intrusion* (injecting consolidated Echo Chips upon resume) and *Journal Intrusion* (recalling recent journal entries).

#### 5. 🏃 Kinetic Motion Generator Pack (Tier 1: Turnkey)
* **Underlying Tools**: `generate_motion`.
* **Runtime**: FlowMDM Local WebGPU neural diffusion and procedural LLM keyframing compiler generating standard `.vrma` animation tracks.
* **Platform Availability**: Desktop Electron and Web with WebGPU (VRM humanoid avatars).
* **Configuration Footprint**: **Zero Required Setup**. Operates entirely on-device via WebGPU.

#### 6. ⚙️ Custom Developer MCP (Tier 3: Power User)
* **Underlying Tools**: Dynamic tools declared by third-party MCP servers.
* **Runtime**: `mcp.json` stdio subprocess manager.
* **Platform Availability**: Desktop Electron (`stage-tamagotchi`).
* **Configuration Footprint**: Direct JSON configuration of commands, arguments, and environment variables.

---

### Future & Planned Add-On Packs

#### 7. 🖥️ Desktop Computer Use & OS Automation Pack (Tier 3: Privileged Automation)
* **Status**: **Roadmap Design Specification** (Evaluated against Upstream PR #2565 / Commit `c38b0a34f3`).
* **Underlying Runtime**: Host-managed AUV daemon (`@auv-js/cli` and `@auv-js/sdk`) exposed via typed Eventa IPC (`shared/eventa/computer-use.ts`).
* **Concept**: Elevating the companion from a conversationalist to an active desktop assistant capable of navigating desktop applications, inspecting windows, capturing screenshots, and executing keyboard or mouse input.

##### The Naive Assumption vs. Upstream Reality (PR #2565 Lessons)
The initial naive roadmap envisioned computer use as a simple 1-line entry in `mcp.json` (e.g. `@proj-airi/computer-use-mcp`) delegated through generic stdio `mcp_call_tool`. Upstream's production implementation in **PR #2565** proved why generic MCP stdio is inadequate for native OS automation, establishing 6 critical lessons:

1. **Multimodal VLM Injection vs. Text-Only MCP**:
   - *Problem*: Generic MCP stdio returns text strings. Vision models (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5/2.0) require native `{ type: 'image_url' }` base64 data URLs to visually inspect the desktop.
   - *Upstream Architecture*: Split the capability into two paired tools:
     - `computer_use`: Executes CLI actions (`invoke app.launch`, `invoke input.click`, etc.) and returns structured metadata + screenshot artifact file paths.
     - `computer_use_read_image`: A dedicated companion tool that reads the generated screenshot artifact from disk and formats it directly as an OpenAI-compatible multimodal image block: `[{ type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }]`.
2. **Private Daemon Lifecycle & Serialization Queue**:
   - *Problem*: Spawning CLI processes ad-hoc causes high latency and introduces catastrophic race conditions if multiple windows or conversational turns trigger simultaneous input events.
   - *Upstream Architecture*: Spawns a long-lived private daemon (`AuvDaemon`) bound to a local Unix domain socket (`unix:///tmp/auv-.../s`, `0700` permissions) or Windows named pipe. All incoming operations pass through a single serialized Promise queue (`enqueue()`) in Electron main to guarantee atomic UI interactions.
3. **Chat History Tool-Bleed Protection (`requiresExplicitSelection`)**:
   - *Problem*: Normal MCP tools (e.g. web search) are harmlessly auto-inherited into the conversation context from chat history. If an OS automation tool is auto-inherited, the LLM might hallucinate and trigger unintended desktop clicks on subsequent unrelated turns.
   - *Upstream Architecture*: Modified `packages/stage-ui/src/stores/chat.ts` to introduce `requiresExplicitSelection: true`. Tools flagged with this rule are **never** auto-inherited from message history and cannot be rerun from cache unless the user explicitly re-selects the tool for that specific prompt.
4. **Strict Screenshot Path Sandboxing**:
   - *Problem*: An image-reading tool exposed to an LLM creates a severe file-exfiltration vulnerability if a prompt injection directs the model to read `~/.ssh/id_rsa` or `/etc/passwd`.
   - *Upstream Architecture*: `readImage()` enforces strict `realpath()` validation, ensuring files reside strictly within `join(app.getPath('userData'), 'computer-use')`, asserts PNG/JPEG magic bytes, and enforces an 8 MiB ceiling.
5. **ASAR Unpacking for Platform Binaries**:
   - *Problem*: `@auv-js/cli` ships precompiled native Mach-O/ELF executables per platform. Packaged Electron apps cannot execute binaries from within the virtual `app.asar` archive.
   - *Upstream Architecture*: Resolves binary paths dynamically to `app.asar.unpacked` when packaged, configured via `electron-builder.config.ts`.
6. **Injeca DI Container Encapsulation (Fork Invariant)**:
   - Upstream hardwired `setupComputerUse` directly into `main/index.ts`. In our fork (`dasilva333/airi`), all Electron main services must be encapsulated as modular `injeca` services (`defineService`) and cleanly decoupled between `RendererStage` and `ControlStrip`.
7. **Host Integration, Terminal Approvals & Context Compaction (Upstream PR #3496 Lessons)**:
   - *Community Milestone*: In Upstream Draft PR [#3496](https://github.com/moeru-ai/airi/pull/3496) (`feat: integrate computer-use MCP, terminal approval, and conversation compact`), `@3361559784` consolidated 59 commits across 167 files (+16,813 / -503 lines), addressing three critical execution requirements:
     - **Extended Computer-Use MCP & AUV Paths**: Standardizes tool invocations across both generic MCP stdio channels and native AUV host daemons.
     - **Terminal Approvals / Human-in-the-Loop (HITL)**: Before terminal commands execute, host/renderer flows surface explicit confirmation/approval prompts, preventing autonomous run-away shell operations.
     - **Conversation Compact Handling**: Multi-turn computer-use automation cycles rapidly exhaust LLM context windows. Introduces conversation compaction handling in the core agent runtime to condense intermediate tool executions while maintaining task focus.

##### macOS Permission Boundaries & Current Fork Status
A key point of confusion in desktop automation is the distinction between display perception and synthetic input:
* **Screen Recording Permission (Already Solved in Fork)**:
  - Required for reading framebuffer pixels and capturing desktop contents.
  - *Current Reality*: Our fork's **Attention Ecology / Screen Watching** subsystem (`apps/stage-tamagotchi/src/main/services/electron/vision.ts` and `WithScreenCapture.vue`) has already solved this boundary. Users have already granted Screen Recording access to the signed AIRI application bundle in macOS *System Settings > Privacy & Security > Screen Recording*.
* **Accessibility Permission (`AXIsProcessTrusted`)**:
  - Required for synthesizing CGEvents (mouse moves, clicks, drag operations, keystrokes) and inspecting accessibility trees (`AXUIElementCopyAttributeValue`).
  - *Requirement*: AIRI must invoke `app.probePermissions` or `AXIsProcessTrustedWithOptions` to prompt the user to enable Accessibility in macOS *System Settings > Privacy & Security > Accessibility*.
* **Host Process Context**:
  - Because AIRI is already a signed macOS Electron bundle with user-granted permissions, managing AUV as an internal daemon spawned by Electron main ensures the subprocess operates under AIRI's established TCC security envelope, rather than triggering fragmented permissions for unbundled Node/npx scripts.

##### Dual-Tier Automation Model: Physical OS Actions (AUV) & Protocol Directives (`spark:command`)
While raw computer use via AUV handles physical desktop OS manipulation (clicking, typing, display capture via `xcap`), computer use in AIRI operates across a **dual-tier architecture**:

1. **Tier A: Physical OS Canvas (AUV Daemon)**:
   - Operates on raw desktop display pixels and window coordinates.
   - Ideal for native desktop applications (e.g. Photoshop, Discord, Spotify, terminal emulators).
   - Tools: `computer_use` (dispatches actions) and `computer_use_read_image` (formats screenshot artifacts for multimodal VLM consumption).

2. **Tier B: Protocol Swarm Directives (`spark:command` / `builtIn_emitSparkCommand`)**:
   - Operates over the typed WebSocket event bus (`port 6121`) to send high-level guidance, task priorities, and interrupts to connected frontend modules and companion bots.
   - **AIRI Web Extension (`plugins/airi-plugin-web-extension`)**: Browser DOM automation, form filling, tab navigation, and element interaction without blind pixel scraping or accessibility coordinate drift.
   - **Gaming Companions (`integrations/minecraft`)**: Tactical in-game commands, survival priorities, and spatial navigation.
   - **Editor Extensions (`integrations/vscode`, `integrations/claude-code`)**: Automated test execution, workspace diagnostics, and multi-file code editing.

##### Virtual Workstation Headless Automation: `require('spark')` & `spark-cli` in In-Memory Bash
A major bottleneck of purely conversational tool calling is that multi-step automated workflows require 10–20 sequential autoregressive LLM round-trips in the main chat context, clogging prompt memory and degrading conversational flow.

By leveraging AIRI's **In-Memory POSIX Virtual Workstation** (`just-bash` + RAM disk `/workspace`), the agent can author and execute headless automation scripts that combine filesystem manipulation, System-1 triage, and spark directives:

1. **Node.js Runtime Integration (`require('spark')`)**:
   Extending `customRequire` in `packages/stage-ui/src/libs/sandbox/manager.ts` alongside `fs`, `path`, `mcp`, and `jev`:
   ```javascript
   const fs = require('node:fs')

   // /workspace/scripts/browse-and-summarize.js
   const spark = require('spark')

   // Command browser extension to navigate and capture DOM text
   await spark.command({
     destinations: ['web-extension'],
     intent: 'action',
     priority: 'normal',
     contexts: [{
       lane: 'browser:dom',
       text: 'Navigate to https://news.ycombinator.com and extract top stories',
     }],
   })

   // Log status into sandbox RAM disk
   fs.writeFileSync('/workspace/run.log', `Dispatched browser extraction at ${Date.now()}`)
   ```

2. **Virtual POSIX CLI Interface (`spark`)**:
   Providing a turnkey shell utility in the virtual terminal:
   ```bash
   # Emit a command directly from a shell script or pipeline
   spark emit --to web-extension --intent action --lane "browser:dom" --text "Click the sign-in button"

   # Command a connected gaming bot
   spark command --to minecraft-bot --intent action --priority urgent --text "Retreat to shelter"
   ```
   This gives the agent full headless scripting agency: write a bash or node automation script, execute it in the background (`node script.js &`), monitor ambient state in `/workspace/.airi/`, and report back only the final synthesized result to the user.

##### Rich Tool Call Inspection & Widget Result Cards (Chiba Architecture: PR #2990 / #2992 / #2994)
As demonstrated by upstream PRs #2990, #2992, and #2994 (@chiba233), tool executions should not appear as raw, unformatted JSON blocks in chat. The unfolded tool panel elevates the user experience with dedicated presentation widgets:

1. **`computer_use` Result Widget**:
   - Parses the real `--json` output of `@auv-js/cli` commands (`invoke display.capture`, `invoke input.click`, `invoke app.launch`).
   - Displays a structured command card with `command_id`, execution `exit_code`, structured `argv`, and an expandable result tree with 1px indentation guides, type-specific coloring (numbers in theme color, strings quoted, booleans in gray), and one-click copy buttons.
   - For image-capture operations, embeds an off-screen rendered screenshot preview drawer directly in the panel.
2. **`spark:command` Card**:
   - Visualizes outgoing swarm directives: target destination badges (`web-extension`, `minecraft-bot`), intent tags (`action`, `plan`, `proposal`), priority indicators, and delivery/acknowledgment status.

##### Hardened Plan of Attack for `dasilva333/airi`
1. **Service Registration**: Wrap the AUV daemon runtime in an `injeca` service (`apps/stage-tamagotchi/src/main/services/airi/computer-use.ts`).
2. **IPC Contracts**: Maintain typed `@moeru/eventa` definitions for `computerUseRun` and `computerUseReadImage`.
3. **Safety Guardrail**: Adopt upstream's `requiresExplicitSelection` store logic in `packages/stage-ui/src/stores/chat.ts` to protect prompt turns from accidental tool inheritance.
4. **Virtual Workstation Bridge**: Add `require('spark')` to `customRequire` and register the `spark` CLI binary in `packages/stage-ui/src/libs/sandbox/manager.ts`.
5. **Tool-Call UI Polish**: Adopt Chiba's compact combo-pill and unfolded result widget architecture (`packages/stage-ui/src/components/scenarios/chat/components/tool-call-*`) for clean visual inspection of computer-use and spark directives.
6. **UI Presentation**: Surface the capability pack in `CardCreationTabTools.vue` as a Tier 3 pack, with clear status indicators for macOS Accessibility and Screen Recording readiness.

---

## 5. Tri-Platform Capability Gating Matrix

To avoid broken UI controls or runtime exceptions on sandboxed platforms, all Capability Packs adhere to strict platform availability rules:

| Capability Pack | Desktop Electron (`stage-tamagotchi`) | Web Browser (`stage-web`) | Mobile Companion (`stage-pocket`) |
| :--- | :--- | :--- | :--- |
| **🌐 Web & Research Pack** | ✅ Full Native HTTP / Scraper | ✅ Edge Reverse-Proxy Worker | ✅ Native Capacitor HTTP |
| **📁 Local Workspace Pack** | ✅ Full Stdio MCP (`npx`) | ❌ Hidden (Sandbox) | ❌ Hidden (Sandbox) |
| **🎨 Visual Artistry Pack** | ✅ Local & Cloud Backends | ✅ Cloud & WebGPU Painter | ✅ Cloud Backends |
| **🧠 Sacred Memory Pack** | ✅ IndexedDB + LocalForage | ✅ IndexedDB + LocalForage | ✅ Capacitor SQLite |
| **🏃 Kinetic Motion Pack** | ✅ WebGPU + Three.js VRM | ✅ WebGPU + Three.js VRM | ❌ Unsupported |
| **🖥️ Desktop Computer Use** | ⏳ Planned (macOS v1) | ❌ Hidden (Sandbox) | ❌ Hidden (Sandbox) |
| **⚙️ Custom Developer MCP** | ✅ Full `mcp.json` Stdio | ❌ Hidden | ❌ Hidden |

---

## 6. Architecture & State Reconciliation

When a pack is toggled in either the Character Card Creator or Onboarding V3, the change propagates through a clean reactive lifecycle:

1. **Card Model Update**:
   - The UI modifies `generationAllowedTools` (e.g. adding `'web_search'`, `'filesystem'`).
2. **Bridge Reconciliation**:
   - `ensureMcpServersForAllowedTools(tools)` in `packages/stage-ui/src/stores/mcp-tool-bridge.ts` checks if any active tool requires a backing MCP server.
   - For turnkey servers (like `filesystem`), it verifies or scaffolds the server entry in `mcp.json` and signals the background MCP manager.
3. **Prompt Compilation**:
   - During turn generation, `useContextBuilder` and the prompt compilation engine inspect enabled tools on the active card and selectively inject only the corresponding instructions, keeping token footprint and reasoning sharp.
4. **Cross-Service Inheritance**:
   - Connected peripheral runtimes (such as the Discord gateway bot service `apps/stage-tamagotchi/src/main/services/airi/discord/` or mobile companion) inherit the active companion card's enabled capability packs (e.g. answering queries with live `web_search` lookups in group channels) without duplicating tool toggle interfaces into individual module settings.
