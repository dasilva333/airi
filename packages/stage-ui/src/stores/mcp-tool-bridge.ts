export interface McpToolDescriptor {
  serverName: string
  name: string
  toolName: string
  description?: string
  inputSchema: Record<string, unknown>
}

export interface McpCallToolPayload {
  name: string
  arguments?: Record<string, unknown>
}

export interface McpCallToolResult {
  content?: Array<Record<string, unknown>>
  structuredContent?: Record<string, unknown>
  toolResult?: unknown
  isError?: boolean
}

export interface McpServerRuntimeStatus {
  name: string
  state: 'running' | 'stopped' | 'error'
  command: string
  args: string[]
  pid: number | null
  lastError?: string
}

export interface McpRuntimeStatus {
  path: string
  servers: McpServerRuntimeStatus[]
  updatedAt: number
}

export interface McpStdioServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  enabled?: boolean
}

export interface McpStdioConfigFile {
  mcpServers: Record<string, McpStdioServerConfig>
}

export interface McpToolBridge {
  listTools: () => Promise<McpToolDescriptor[]>
  callTool: (payload: McpCallToolPayload) => Promise<McpCallToolResult>
  getRuntimeStatus: () => Promise<McpRuntimeStatus>
  getConfig?: () => Promise<McpStdioConfigFile>
  updateConfig?: (partial: Partial<McpStdioConfigFile>) => Promise<void>
  applyAndRestart?: () => Promise<unknown>
}

export async function ensureMcpServersForAllowedTools(allowedTools: string[] | undefined): Promise<boolean> {
  if (!allowedTools || !allowedTools.length)
    return false

  const bridge = tryGetMcpToolBridge()
  if (!bridge?.getConfig || !bridge?.updateConfig) {
    return false
  }

  try {
    const currentConfig = await bridge.getConfig()
    const servers = { ...currentConfig?.mcpServers }
    let changed = false

    const hasWebSearch = allowedTools.includes('web_search') || allowedTools.includes('mcp_web_search')
    const hasFilesystem = allowedTools.includes('filesystem') || allowedTools.includes('mcp_filesystem')

    // 1. Ensure open-websearch if web_search is enabled
    if (hasWebSearch) {
      if (!servers['open-websearch']) {
        servers['open-websearch'] = {
          command: 'npx',
          args: ['-y', 'open-websearch@latest'],
          env: {
            DEFAULT_SEARCH_ENGINE: 'duckduckgo',
            SEARCH_MODE: 'auto',
          },
          enabled: true,
        }
        changed = true
      }
      else {
        const existing = servers['open-websearch']
        const currentEnv = existing.env || {}
        if (existing.enabled === false || !currentEnv.DEFAULT_SEARCH_ENGINE) {
          servers['open-websearch'] = {
            ...existing,
            env: {
              DEFAULT_SEARCH_ENGINE: 'duckduckgo',
              SEARCH_MODE: 'auto',
              ...currentEnv,
            },
            enabled: true,
          }
          changed = true
        }
      }
    }

    // 2. Ensure filesystem if filesystem is enabled
    if (hasFilesystem) {
      if (!servers.filesystem) {
        const home = typeof process !== 'undefined' && process.env?.HOME ? process.env.HOME : '/Users'
        servers.filesystem = {
          command: 'npx',
          args: [
            '-y',
            '@modelcontextprotocol/server-filesystem',
            `${home}/Documents/Projects`,
            `${home}/Downloads`,
            `${home}/Desktop`,
          ],
          enabled: true,
        }
        changed = true
      }
      else if (servers.filesystem.enabled === false) {
        servers.filesystem = {
          ...servers.filesystem,
          enabled: true,
        }
        changed = true
      }
    }

    if (changed) {
      console.log('[mcp-tool-bridge] 🛠️ Automatically updating mcp.json with required server configs:', Object.keys(servers))
      await bridge.updateConfig({ mcpServers: servers })
      if (bridge.applyAndRestart) {
        bridge.applyAndRestart().catch((err) => {
          console.warn('[mcp-tool-bridge] Background applyAndRestart encountered an error:', err)
        })
      }
      return true
    }
  }
  catch (error) {
    console.error('[mcp-tool-bridge] Failed to ensure MCP servers for allowed tools:', error)
  }

  return false
}

let bridge: McpToolBridge | undefined

/**
 * Sets the MCP tool bridge for the current runtime.
 * Also exposes it globally on the `window` object to ensure cross-module
 * and cross-window stability in Electron's multi-renderer architecture.
 */
export function setMcpToolBridge(nextBridge: McpToolBridge) {
  bridge = nextBridge

  // Expose globally for cross-context stability
  if (typeof window !== 'undefined') {
    ;(window as any).__AIRI_MCP_BRIDGE__ = nextBridge
  }
}

export function clearMcpToolBridge() {
  bridge = undefined
  if (typeof window !== 'undefined') {
    delete (window as any).__AIRI_MCP_BRIDGE__
  }
}

/**
 * Safely tries to retrieve the MCP tool bridge without throwing an error.
 * Returns undefined if the bridge is not initialized.
 */
export function tryGetMcpToolBridge(): McpToolBridge | undefined {
  return bridge || (typeof window !== 'undefined' ? (window as any).__AIRI_MCP_BRIDGE__ : undefined)
}

/**
 * Retrieves the MCP tool bridge.
 * Throws an error if the bridge is not available.
 */
export function getMcpToolBridge(): McpToolBridge {
  const resolvedBridge = tryGetMcpToolBridge()

  if (!resolvedBridge) {
    throw new Error('MCP tool bridge is not available in this runtime.')
  }

  return resolvedBridge
}
// FORCE CACHE REFRESH: Refined non-fatal bridge export confirmed.
