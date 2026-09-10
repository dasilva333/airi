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
│ 🖥️ Desktop Computer Use Pack  │ • @proj-airi/computer-use-mcp            │
│    [Tier 3: Future / Deferred]│ • macOS OS actions & Chrome DOM bridge   │
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
* **Status**: **Deferred for Future Roadmap** (Technical Research Completed).
* **Underlying Package**: Upstream `@proj-airi/computer-use-mcp` (`services/computer-use-mcp`).
* **Concept**: Elevating the companion from a conversationalist to an active desktop assistant capable of navigating macOS applications, inspecting web pages, and executing test suites.
* **Underlying Capabilities**:
  - *Native Desktop Actions*: Coordinate clicking, typing, hotkey execution, app launch/focus, and screen capture.
  - *Browser DOM Bridge*: Element-level web inspection and form filling via a local WebSocket bridge (`ws://127.0.0.1:8765`) paired with the AIRI Chrome extension.
  - *Terminal Execution*: Controlled PTY commands and diagnostic test runner workflows.
* **Why Deferred (Non-Trivial Configuration Footprint)**:
  Unlike Tier 1 and Tier 2 packs, `computer-use-mcp` is a high-privilege system that requires extensive non-trivial setup and security gating:
  1. *OS Permissions*: Mandatory macOS Accessibility and Screen Recording authorizations in System Settings.
  2. *Action Approval Mode*: Requiring user interaction loops (`actions` vs. `all` vs. `never`) so the model cannot act without explicit confirmation.
  3. *Application Whitelisting*: Explicit list of safe target apps (`COMPUTER_USE_OPENABLE_APPS`, e.g. `Terminal, Cursor, Chrome`).
  4. *Browser DOM Bridge Setup*: Unpacking and connecting the companion Chrome extension.
  *Decision*: Deferred to a dedicated phase where automated permission onboarding and approval UX can be engineered safely.

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
