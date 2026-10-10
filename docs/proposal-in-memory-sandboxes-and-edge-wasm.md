# Proposal: In-Memory Agent Sandboxes, Zero-VM Workspaces, and Edge WASM Capabilities

> **Status**: Proposed / RFC
> **Author**: Richard Pinedo (@dasilva333 / azimuthal)
> **Date**: 2026-10-10
> **Target Audience**: Core Developers, Architecture Maintainers, Community Extension Developers
> **Related Documents**: [`docs/design-cloud-relay.md`](./design-cloud-relay.md), [`docs/proposal-plugin-ecosystem-and-community-registry.md`](./proposal-plugin-ecosystem-and-community-registry.md), [`docs/design-discord-control-plane.md`](./design-discord-control-plane.md), [`docs/arch-mcp-integration.md`](./arch-mcp-integration.md), [`docs/proposal-built-in-llm-webgpu.md`](./proposal-built-in-llm-webgpu.md)

---

## 1. Executive Summary & Macro Context

### The Economic & Compute Inversion
Over the past 18 months, developer tooling has witnessed a fundamental economic divergence:
1. **Inference costs are dropping exponentially** (10× to 100× annualized decrease across frontier and fast models like Claude Opus, DeepSeek, and lightweight distilled models).
2. **Dedicated compute and host VM costs remain flat or are rising**, driven by surging datacenter memory (RAM) and power demands.

Currently, agentic developer environments (Cursor Cloud, Claude Code VMs, Docker-based code sandboxes) provide autonomous agents with full 16GB–32GB Linux virtual machines. While convenient, this model fails three foundational requirements of Project AIRI:
* **Strict Local-First & Zero-Custody Boundaries**: Spawning unconstrained host processes or requiring \$50/month cloud Linux VPSs violates AIRI's mission of client-side ownership and zero-overhead execution.
* **Universal Tri-Platform Parity**: AIRI runs across **Desktop Electron** (`apps/stage-tamagotchi`), **Web Browser** (`apps/stage-web`), and **Mobile Capacitor** (`apps/stage-pocket`). Spawning Node child processes, Docker containers, or native bash shells is fundamentally impossible inside a mobile browser or iOS sandbox.
* **Host System Safety**: Granting autonomous agents direct host terminal access creates significant hazards (accidental `rm -rf`, unexpected network calls, environment leakage).

### The In-Memory / WASM Breakthrough
By combining **V8 Isolates**, **in-memory POSIX simulation (`just-bash`)**, and **lightweight WebAssembly tooling (such as `ts-rust` / `@tsc-rs/wasm` and QuickJS-WASM)**, we can give AIRI characters an autonomous, fully functioning "virtual computer" and dynamic runtime that:
* Consumes **< 200MB of RAM** and negligible CPU when idle.
* Executes identically inside a **Chrome browser tab**, an **iPhone Capacitor webview**, an **Electron desktop window**, or a **serverless Cloudflare Worker**.
* Guarantees **100% memory-isolated containment** with zero risk to the user's host operating system.

This proposal organizes these capabilities into **Three Golden Architectural Pillars**:
1. **Self-Synthesizing In-Memory Plugins & Generative UI**: Allowing characters to create, typecheck, and register their own tools and interface widgets in-memory on the fly.
2. **The Character's Personal Virtual Computer**: Giving characters their own virtual Unix workspace and terminal (`just-bash` + WASM) embedded directly in the chat experience.
3. **Next-Gen Cloudflare Edge Relay with WASM**: Upgrading the zero-custody Discord bot and cloud relay with edge code execution, dynamic graphic rendering, and simulation abilities.

---

## 2. Architectural Blueprint: The Three Golden Pillars

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     PROJECT AIRI RUNTIME                                     │
│               (Desktop Electron • Web Browser • Mobile Capacitor • Edge Worker)              │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│   ┌───────────────────────────────┐                  ┌────────────────────────────────────┐  │
│   │  Pillar 1: Self-Synthesizing  │                  │   Pillar 2: Virtual Workstation    │  │
│   │      In-Memory Plugins        │                  │      (just-bash + WASM Engine)     │  │
│   │                               │                  │                                    │  │
│   │  • Agent-generated TS tools   │                  │  • In-memory POSIX Virtual FS      │  │
│   │  • In-isolate type checking   │                  │  • Sandboxed JS/TS code runner     │  │
│   │    via @tsc-rs/wasm           │                  │  • Interactive Terminal Drawer UI  │  │
│   │  • toolsResolver auto-mount   │                  │  • Zero-risk host isolation        │  │
│   │  • Generative UI Vue widgets  │                  │  • Preserved in IndexedDB / OPFS   │  │
│   └───────────────┬───────────────┘                  └─────────────────┬──────────────────┘  │
│                   │                                                    │                     │
│                   ▼                                                    ▼                     │
│  ══════════════════════════════════════════════════════════════════════════════════════════  │
│                               SHARED WASM / ISOLATE SUBSTRATE                                │
│       [QuickJS / V8 Worker]       [@tsc-rs/wasm Compiler]       [MemFS Virtual Drive]        │
│  ══════════════════════════════════════════════════════════════════════════════════════════  │
│                                                    │                                         │
│                                                    ▼                                         │
│                                      ┌───────────────────────────┐                           │
│                                      │ Pillar 3: Edge Relay WASM │                           │
│                                      │    (apps/stage-edge)      │                           │
│                                      │                           │                           │
│                                      │ • Edge Discord Code Exec  │                           │
│                                      │ • Dynamic SVG/Canvas Cards│                           │
│                                      │ • Zero-Server Cost Sim    │                           │
│                                      └───────────────────────────┘                           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Pillar 1: Self-Synthesizing In-Memory Plugins & Generative UI

### 3.1 Problem Statement
Currently, adding a tool to AIRI requires:
* Authoring a hardcoded TypeScript module in `packages/stage-ui/src/tools/` or `packages/plugin-*`,
* Or setting up an external Model Context Protocol (MCP) `stdio` child process server.

This model is static: if a user asks a character to perform a novel structured task (e.g., *"Calculate my net worth based on this portfolio breakdown and alert me when it changes"*), the character cannot dynamically create a tool for itself. Furthermore, MCP child processes do not work on Web or Mobile.

### 3.2 Proposed Mechanism
When an agent encounters a recurring or complex user requirement:
1. **Dynamic Tool Specification**: The agent emits a tool definition adhering to AIRI's Valibot/JSON-Schema schema:
   ```ts
   interface DynamicAgentTool {
     name: string
     description: string
     parameters: Record<string, unknown>
     code: string // TypeScript source
   }
   ```
2. **In-Isolate Type & Syntax Verification**:
   Instead of writing to disk and restarting Node, the agent passes the code to **`@tsc-rs/wasm`** (the WebAssembly build of `ts-rust`). The WASM compiler typechecks the input/output boundaries and confirms syntactic correctness in < 50ms inside the browser/renderer thread.
3. **In-Memory Registry Mount**:
   The validated tool is wrapped in a secure `Web Worker` or QuickJS isolate and injected directly into `toolsResolver` ([`airi-tool-registry-builtin-tools`](file:///Users/richardpinedo/Projects.nosync/airi/.agents/skills/airi-tool-registry-builtin-tools/SKILL.md)). The tool becomes immediately invokable by the LLM in subsequent turns.
4. **Generative UI Component Rendering**:
   Along with logic, the agent can output declarative UI widgets (using `@proj-airi/ui` primitives or sandboxed SVG/HTML) that mount into the desktop chat stream as interactive cards (e.g. tracking progress bars, clickable toggles, status pills).

---

## 4. Pillar 2: The Character's Personal Virtual Computer (`just-bash` Sandbox)

### 4.1 Concept & User Experience
To give AI characters true agency, they need a scratchpad that goes beyond text tokens. We propose introducing **"Airi's Personal Terminal"**—an in-memory virtual Unix-like environment:

* **Interactive Chat Drawer**:
  A collapsible terminal drawer in the Desktop Chatbox (`packages/stage-ui/src/components/chat/`) and Web Stage. When Airi performs complex reasoning, users can click to reveal a live terminal window showing the agent running virtual commands:
  ```bash
  airi@sandbox:~$ cat data/daily_mood.json | jq '.average'
  airi@sandbox:~$ ts-run scripts/calculate_schedule.ts
  >> Optimal sleep schedule: 23:30 - 07:30
  ```
* **User-Agent Collaboration**:
  The user can drop virtual text files or datasets directly into the sandbox folder, allowing Airi to inspect, edit, and organize them without ever exposing the host computer's actual filesystem.

### 4.2 Architecture: `just-bash` + WASM Engine
* **Filesystem Emulation**: Powered by `just-bash` (or a high-performance in-memory virtual filesystem). Files reside purely in memory (RAM) and can be checkpointed into IndexedDB (`local:*`) or Origin Private File System (OPFS) across sessions.
* **Command Suite**: Built-in POSIX utilities (`cat`, `ls`, `grep`, `head`, `tail`, `sed`, `awk`, `find`, `mkdir`, `echo`, `touch`, `cp`, `mv`).
* **Code Execution**:
  * For JavaScript: A lightweight, memory-capped Web Worker.
  * For TypeScript: Compiling via `@tsc-rs/wasm` in memory before execution.
  * For Sandboxed Python/Math: Optional Pyodide / MicroPython WASM module.
* **Guaranteed Safety**: Zero IPC calls to Electron's `child_process.spawn`. It cannot access `file://`, cannot read `~/.ssh`, and cannot open raw sockets.

---

## 5. Pillar 3: Next-Gen Cloudflare Edge Relay with WASM ("Vercel for Characters")

### 5.1 Context & Cloudflare Workers WASM Support
AIRI's **Cloud Relay** ([`apps/stage-edge/`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-edge/), governed by [`airi-cloud-relay-infrastructure`](file:///Users/richardpinedo/Projects.nosync/airi/.agents/skills/airi-cloud-relay-infrastructure/SKILL.md)) currently deploys an HTTP interaction worker on Cloudflare Workers that serves as a 24/7 Discord bot and Edge KV memory sync.

Cloudflare Workers run on V8 Isolates and feature **first-class WebAssembly support**. A `.wasm` module can be bundled directly into the Worker package and executed with zero cold-start delay and zero kernel virtualization overhead.

### 5.2 Novel Edge Capabilities
By integrating targeted WASM binaries into `apps/stage-edge`, the Discord bot gains capabilities traditionally reserved for heavy cloud servers:

1. **Edge Code Interpreter in Discord Slash Commands**:
   * Users in Discord can invoke `/eval` or ask the bot complex procedural questions (e.g. data crunching, Monte Carlo simulations, regex parsing).
   * The Discord worker executes the task inside an embedded QuickJS-WASM sandbox directly on Cloudflare’s edge nodes within the 50ms CPU execution budget.
2. **Dynamic Visual Card & Avatar Asset Synthesis**:
   * Currently, the Discord bot only returns plain text (limited to 2,000 characters).
   * Using a compiled Rust WASM crate (such as `resvg` or `image-rs`), the Worker can dynamically render visual status sheets, character intimacy badges, and RPG quest cards directly from SVG templates into PNG byte buffers, attaching them to Discord webhook replies.
3. **Edge Semantic Vector Search (Micro-RAG)**:
   * Run lightweight vector cosine similarity or embedding quantization in WASM over KV-stored conversational history without calling external vector databases.

---

## 6. Security, Isolation, & Resource Boundaries

| Security Domain | Host Process Model (Traditional) | AIRI In-Memory / WASM Model |
| :--- | :--- | :--- |
| **Filesystem Access** | Full read/write to user disk (`$HOME`) | In-memory RAM disk only (virtual memfs) |
| **Network Access** | Raw TCP / unrestricted internet sockets | Gated by application CORS / fetch proxies |
| **Host System Calls** | Unrestricted kernel syscalls (`fork`, `exec`) | None (runs inside browser/isolate sandbox) |
| **Memory Footprint** | 1GB+ (Docker / VM / separate processes) | < 200MB shared V8 isolate heap |
| **Cross-Platform Parity** | Desktop only (breaks on Web/iOS) | 100% parity on Electron, Web, Mobile, Edge |

---

## 7. Open Questions & Technical Risks

1. **WASM Binary Size on Cloudflare Workers Free Tier**:
   Cloudflare Workers Free limits script size to 1MB compressed (10MB on Paid). Full compilers like `ts-rust` WASM may exceed 3MB uncompressed. Can we strip unnecessary compiler phases or use dynamic streaming instantiation from an R2 bucket?
2. **Virtual Filesystem State Persistence**:
   How frequently should the agent's virtual sandbox state be flushed to IndexedDB / localforage? Should we implement an incremental dirty-page snapshot mechanism to prevent memory spikes during long chat sessions?
3. **Template Compilation for Generative UI**:
   While pure TypeScript logic can be checked via `@tsc-rs/wasm`, Vue Single File Components still require Volar template compilation. Should dynamic Generative UI widgets use standard declarative JSON component schemas (like Reka UI / UnoCSS schema) rather than raw arbitrary `.vue` SFC strings?
4. **Execution Timeout & Infinite Loop Protection**:
   In-isolate code execution must enforce hard execution budgets (e.g., maximum 2,000ms CPU execution time) via `AbortController` or Web Worker termination to prevent accidental infinite loops generated by the LLM.

---

## 8. Phased Implementation Roadmap

* **Phase 1: Chatbox Virtual Terminal Sandbox (Client-Side Prototype)**
  * Integrate `just-bash` (or virtual POSIX coreutils) into `packages/stage-ui/`.
  * Add a tool definition `run_virtual_terminal({ command: string })` to `toolsResolver`.
  * Build a collapsible "Terminal Drawer" component in the chat composer to display real-time command execution.
* **Phase 2: In-Memory TypeScript & Code Runner Integration**
  * Evaluate `@tsc-rs/wasm` and QuickJS-WASM packaging inside Vite/Rollup.
  * Wire the virtual terminal to compile and execute sandboxed code inside an isolated Web Worker.
  * Validate persistence of virtual sandbox files in IndexedDB (`local:sandbox:*`).
* **Phase 3: Cloudflare Edge Relay WASM Extensions (`apps/stage-edge`)**
  * Add a minimal QuickJS-WASM code interpreter module to `apps/stage-edge/src/inference/`.
  * Implement an edge-evaluated Discord slash command (`/run` or `/eval`) with strict 50ms CPU bounds.
  * Experiment with edge SVG-to-PNG rendering for character status card attachments.
* **Phase 4: Autonomous Self-Synthesizing Plugin Loop**
  * Design the dynamic tool schema and registration lifecycle for `stage-ui`.
  * Add guardrails and user-confirmation prompts for persistent in-memory plugin adoption.
