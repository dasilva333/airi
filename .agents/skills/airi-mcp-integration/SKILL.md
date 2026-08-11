---
name: airi-mcp-integration
description: >-
  Use when working with Model Context Protocol (MCP) server integration in the Electron desktop app: stdio MCP service manager in apps/stage-tamagotchi/src/main/services/airi/mcp-servers/index.ts, mcp.json config in Electron userData/appData, eventa IPC contracts electronMcpListTools/electronMcpCallTool/electronMcpApplyAndRestart/electronMcpGetRuntimeStatus in apps/stage-tamagotchi/src/shared/eventa.ts, renderer bridge window.__AIRI_MCP_BRIDGE__ and setMcpToolBridge/getMcpToolBridge in packages/stage-ui/src/stores/mcp-tool-bridge.ts, settings store packages/stage-ui/src/stores/mcp.ts (serverCmd/serverArgs/connected), builtin meta-tools mcp_list_tools/mcp_call_tool in apps/stage-tamagotchi/src/renderer/stores/tools/builtin/mcp.ts, tool listing/invocation, server lifecycle, qualified tool names "server::tool", LLM tool calling with MCP.
---

# AIRI MCP Integration

## Key Files/Locations

- `apps/stage-tamagotchi/src/main/services/airi/mcp-servers/index.ts` — Electron **main-process** service manager: spawns stdio MCP servers, owns lifecycle (start/stop/restart), tool listing/delegation. Config path = `join(app.getPath('appData'), 'airi', 'mcp.json')`. Uses `toolNameSeparator` (`::`) and `parseQualifiedToolName`; request timeout `mcpRequestMaxTotalTimeoutMsec = 15_000`.
- `apps/stage-tamagotchi/src/shared/eventa.ts` — typed IPC contracts: `electronMcpListTools`, `electronMcpCallTool`, `electronMcpGetRuntimeStatus`, `electronMcpApplyAndRestart`, `electronMcpOpenConfigFile`, `electronMcpGetConfig`, `electronMcpUpdateConfig`; types `ElectronMcpStdioConfigFile` (`{ mcpServers: Record<string, ElectronMcpStdioServerConfig> }`), `ElectronMcpToolDescriptor`, `ElectronMcpCallToolPayload/Result`, `ElectronMcpStdioRuntimeStatus`.
- `packages/stage-ui/src/stores/mcp-tool-bridge.ts` — renderer-side bridge registry. `setMcpToolBridge()` installs the bridge AND mirrors it onto `window.__AIRI_MCP_BRIDGE__` for cross-window/cross-renderer stability; `tryGetMcpToolBridge()` (non-throwing) / `getMcpToolBridge()` (throws); `clearMcpToolBridge()`. Exposes `listTools()`, `callTool(payload)`, `getRuntimeStatus()`.
- `packages/stage-ui/src/stores/mcp.ts` — legacy settings store: `serverCmd`, `serverArgs`, `connected` (localStorage-backed so `connected` syncs across windows).
- `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/mcp.ts` — LLM-facing builtin meta-tools: `mcp_list_tools` (discovery) and `mcp_call_tool` (execution, requires qualified `"server::tool"` name). Both resolve the bridge via `tryGetMcpToolBridge`.

## When to Use

- Adding/changing MCP server config handling, the `mcp.json` schema, or restart/apply lifecycle.
- Debugging tool discovery (`mcp_list_tools` returns empty / errors) or invocation (`mcp_call_tool`).
- Working on IPC between the Electron main MCP manager and renderer windows.
- Surfacing MCP runtime status (running/stopped/error, pid, lastError) in UI.

## Common Pitfalls

- **Main vs renderer separation.** stdio servers run ONLY in the Electron main process (`services/airi/mcp-servers/`); the renderer never touches child processes. All renderer access goes through the eventa IPC contracts → bridge. Do not import main-process code into renderer bundles.
- **Bridge availability.** In multi-renderer Electron windows the bridge must be mirrored on `window.__AIRI_MCP_BRIDGE__`; use `tryGetMcpToolBridge()` in tools so `mcp_list_tools`/`mcp_call_tool` degrade gracefully (log/return error) instead of throwing when no bridge exists. `getMcpToolBridge()` throws `'MCP tool bridge is not available in this runtime.'`.
- **Qualified names.** Tool invocation requires `server::tool` format parsed by `parseQualifiedToolName` (separator `::`, must not be leading/trailing). `mcp_call_tool` has a forgiveness path that redirects `mcp_list_tools` to discovery — keep it.
- **Config is dual-sourced.** Runtime servers come from `mcp.json` in `userData`/appData (`mcpServers` record), edited via `electronMcpGetConfig`/`electronMcpUpdateConfig`/`electronMcpApplyAndRestart`. The `stores/mcp.ts` `serverCmd`/`serverArgs` is the older single-server settings path — don't conflate them.
- **Timeouts/errors.** Calls are capped at 15 s total; surface `lastError` from `ElectronMcpStdioServerRuntimeStatus` rather than swallowing.

## Verification

- Typecheck: `pnpm -F @proj-airi/stage-ui typecheck` and build `pnpm -F stage-tamagotchi build` (its build includes typechecking) after touching `shared/eventa.ts` or the service manager.
- Manual: add a stdio server to `mcp.json`, apply-and-restart, confirm `getRuntimeStatus()` reports it `running`, `mcp_list_tools` enumerates `server::tool` entries, and `mcp_call_tool` round-trips; verify a second window sees the same bridge via `window.__AIRI_MCP_BRIDGE__`.
