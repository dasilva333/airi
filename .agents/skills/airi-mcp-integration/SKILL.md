---
name: airi-mcp-integration
description: >-
  Configure/debug desktop Model Context Protocol (MCP): mcp.json, stdio server lifecycle, renderer bridge, tool discovery/invocation, permissions, server::tool names, mcp_list_tools/mcp_call_tool. Built-in tool registration uses airi-tool-registry-builtin-tools.
---

# AIRI MCP Integration

## Key Files/Locations

- `apps/stage-tamagotchi/src/main/services/airi/mcp-servers/index.ts` — Electron **main-process** service manager: spawns stdio MCP servers, owns lifecycle (start/stop/restart), tool listing/delegation. Config path = `join(app.getPath('appData'), 'airi', 'mcp.json')`. Uses `toolNameSeparator` (`::`) and `parseQualifiedToolName`; request timeout `mcpRequestMaxTotalTimeoutMsec = 15_000`. Handles `electronSelectDirectories` native folder picker dialogs and `updateConfig` server replacements.
- `apps/stage-tamagotchi/src/shared/eventa.ts` — typed IPC contracts: `electronMcpListTools`, `electronMcpCallTool`, `electronMcpGetRuntimeStatus`, `electronMcpApplyAndRestart`, `electronMcpOpenConfigFile`, `electronMcpGetConfig`, `electronMcpUpdateConfig`, `electronSelectDirectories`; types `ElectronMcpStdioConfigFile` (`{ mcpServers: Record<string, ElectronMcpStdioServerConfig> }`), `ElectronMcpToolDescriptor`, `ElectronMcpCallToolPayload/Result`, `ElectronMcpStdioRuntimeStatus`.
- `packages/stage-ui/src/stores/mcp-tool-bridge.ts` — renderer-side bridge registry. `setMcpToolBridge()` installs the bridge AND mirrors it onto `window.__AIRI_MCP_BRIDGE__` for cross-window/cross-renderer stability; `tryGetMcpToolBridge()` (non-throwing) / `getMcpToolBridge()` (throws); `clearMcpToolBridge()`. Exposes `listTools()`, `callTool(payload)`, `getRuntimeStatus()`.
- `apps/stage-tamagotchi/src/renderer/pages/settings/modules/mcp.vue` — MCP settings UI: Manage tab with runtime status, folder path manager with preset chips for `@modelcontextprotocol/server-filesystem`, 0-key `open-websearch` status banner, and Discover tab connected to PulseMCP registry.
- `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/mcp.ts` — LLM-facing builtin meta-tools: `mcp_list_tools` (discovery) and `mcp_call_tool` (execution, requires qualified `"server::tool"` name). Features card-level ACL filtering (`filterToolsForCard`) respecting `activeCard.extensions.airi.generation.known.allowedTools` (`web_search`, `filesystem`, or `mcp`).

## When to Use

- Adding/changing MCP server config handling, the `mcp.json` schema, or restart/apply lifecycle.
- Installing or wiring 0-key plugins like `open-websearch@latest` (multi-engine web search + markdown extraction via `npx -y`) or `@modelcontextprotocol/server-filesystem`.
- Managing local workspace folder access boundaries using native directory dialogs (`electronSelectDirectories`).
- Debugging tool discovery (`mcp_list_tools` returns empty / errors) or invocation (`mcp_call_tool`).
- Working on IPC between the Electron main MCP manager and renderer windows.
- Surfacing MCP runtime status (running/stopped/error, pid, lastError) in UI.

## Common Pitfalls

- **Main vs renderer separation.** stdio servers run ONLY in the Electron main process (`services/airi/mcp-servers/`); the renderer never touches child processes. All renderer access goes through the eventa IPC contracts → bridge. Do not import main-process code into renderer bundles.
- **0-Install via `npx -y`.** MCP plugins like `open-websearch@latest` and `@modelcontextprotocol/server-filesystem` run directly via `npx -y` — no manual global installation or Python venvs required.
- **Card-level ACLs & context protection.** Tools are **strictly opt-in by default**. If a card does not have `web_search`, `filesystem`, or `mcp` in `allowedTools`, `llmStore.filterToolsByAllowedTools` strips all MCP schemas, protecting small local models from context window bloat. When enabled, `filterToolsForCard` in `builtin/mcp.ts` ensures only permitted server tools are listed and callable.
- **Bridge availability.** In multi-renderer Electron windows the bridge must be mirrored on `window.__AIRI_MCP_BRIDGE__`; use `tryGetMcpToolBridge()` in tools so `mcp_list_tools`/`mcp_call_tool` degrade gracefully (log/return error) instead of throwing when no bridge exists. `getMcpToolBridge()` throws `'MCP tool bridge is not available in this runtime.'`.
- **Qualified names.** Tool invocation requires `server::tool` format parsed by `parseQualifiedToolName` (separator `::`, must not be leading/trailing). `mcp_call_tool` has a forgiveness path that redirects `mcp_list_tools` to discovery — keep it.
- **Timeouts/errors.** Calls are capped at 15 s total; surface `lastError` from `ElectronMcpStdioServerRuntimeStatus` rather than swallowing.

### Authoritative Design & Architecture Documents

- [docs/arch-mcp-integration.md](docs/arch-mcp-integration.md) — MCP integration architecture.
- [docs/research-open-apis-and-mcp-servers.md](docs/research-open-apis-and-mcp-servers.md) — Finding open APIs, MCP servers, and plugins.
- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical concept-to-path index; §1 eventa contract registry.

## Verification

- Typecheck: `pnpm -F @proj-airi/stage-ui typecheck` and build `pnpm -F stage-tamagotchi build` (its build includes typechecking) after touching `shared/eventa.ts` or the service manager.
- Manual: add a stdio server to `mcp.json`, apply-and-restart, confirm `getRuntimeStatus()` reports it `running`, `mcp_list_tools` enumerates `server::tool` entries, and `mcp_call_tool` round-trips; verify a second window sees the same bridge via `window.__AIRI_MCP_BRIDGE__`.

## Related Skills & References

- **Key Documents**: [[arch-mcp-integration]], [[research-open-apis-and-mcp-servers]], [[rosetta-stone]]
- **Peer Skills**: `airi-tool-registry-builtin-tools`, `airi-card-editor-wizard`
