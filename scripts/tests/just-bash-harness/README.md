# In-Memory Just-Bash Agent Harness

A standalone Phase 4 playground for Project AIRI's in-memory, zero-VM virtual workspace, Remote MCP over Streamable HTTP, native Rust TypeScript compiler (`tsc-rs`), and Generative UI Canvas.

## Features
- **Dual-Mode Workspace Interface**:
  - **Left**: Companion Chat interface powered by client-side `@xsai/stream-text` loop with interactive tool chips and markdown formatting.
  - **Right**: Dual-mode pane with two toggleable tabs:
    - **Terminal (`just-bash`)**: Real-time POSIX terminal powered by in-memory RAM disk.
    - **Generative Canvas**: Dynamic preview stage for mounted TypeScript/JavaScript widgets and HTML artifacts with isolated iframe execution and Tailwind CSS.
- **Native Rust TypeScript Compiler (`tsc-rs`)**:
  - Embedded `tsc-rs` (`pingdotgg/ts-rust` v0.2.0 / TypeScript 7.1.0-dev) registered as both `tsc` and `tsc-rs` in the in-memory shell.
  - Fast Mach-O compilation with typechecking diagnostics returned directly to the agent.
  - Compiles TypeScript components to standard ES modules in `/workspace` with zero host disk leakage.
- **Dynamic Generative UI (`mount_widget`)**:
  - Agent and human can mount compiled `.js` or `.html` files to the Generative Canvas.
  - Auto-switches the right column from Terminal to Canvas on mount.
  - Supports `mount <file>` and `show <file>` bash commands.
- **Remote MCP over Streamable HTTP (`/mcp`)**:
  - Fully RFC-compliant `StreamableHTTPServerTransport` mounted at `/mcp`.
  - Discovered and connected in the browser via `StreamableHTTPClientTransport` (`@modelcontextprotocol/sdk`).
  - Preloaded with remote tools:
    - `ping`: Pings remote MCP server and verifies roundtrip latency.
    - `weather_lookup`: Structured weather conditions and 3-day forecast for any city.
- **Triple-Engine Synergy**:
  - MCP data retrieval + POSIX bash manipulation + native TypeScript compilation + Generative UI mounting all chained autonomously in a single agent turn!
- **Zero Backend Chat Proxy**:
  - Direct browser-to-LLM dispatch (OpenRouter, OpenAI, or any OpenAI-compatible provider) via `@xsai`.
  - Credentials stored strictly in browser `localStorage`.
- **Pre-Seeded Workspace**:
  - `/workspace/notes.txt` — Architecture notes
  - `/workspace/todo.md` — Phased roadmap
  - `/workspace/data.json` — Sample JSON dataset for testing `jq`
  - `/workspace/src/index.ts` — TypeScript stub

## Quick Start
Run from the repository root:

```bash
npx tsx scripts/tests/just-bash-harness/server.ts
```

Then open your browser to [http://localhost:5188](http://localhost:5188):
1. Notice the **MCP Status Badge**: `🟢 MCP: Connected (2 tools: ping, weather_lookup)`.
2. Notice the **Right Column Tabs**: Toggle between **Terminal** and **Generative Canvas**.
3. In the terminal, try:
   - `tsc -v` (outputs `Version 5.8.2`)
   - `tsc /workspace/src/index.ts`
   - `mount /workspace/src/index.js`
4. Test the Phase 4 Agent prompt:
   - *"Check the weather in Tokyo via MCP, write a TypeScript weather forecast widget in /workspace/weather_card.ts, compile it with tsc, and mount it to the canvas."*
