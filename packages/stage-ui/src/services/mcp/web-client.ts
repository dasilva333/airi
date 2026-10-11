import type {
  McpCallToolPayload,
  McpCallToolResult,
  McpConfigFile,
  McpHttpServerConfig,
  McpRuntimeStatus,
  McpServerRuntimeStatus,
  McpTestPayload,
  McpTestResult,
  McpToolBridge,
  McpToolDescriptor,
} from '../../stores/mcp-tool-bridge'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import { isHttpServerConfig, parseQualifiedToolName } from '../../stores/mcp-tool-bridge'
import { useMcpWebConfigStore } from '../../stores/mcp-web-config'

interface WebMcpSession {
  client: Client
  transport: StreamableHTTPClientTransport
  config: McpHttpServerConfig
}

const MCP_REQUEST_TIMEOUT_MSEC = 10_000
const MCP_REQUEST_MAX_TOTAL_TIMEOUT_MSEC = 15_000

function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer)
      clearTimeout(timer)
  })
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message
  }
  return String(error)
}

function createTransport(config: McpHttpServerConfig, urlOverride?: string): StreamableHTTPClientTransport {
  const targetUrl = urlOverride || config.url
  return new StreamableHTTPClientTransport(new URL(targetUrl), {
    requestInit: {
      headers: config.headers,
    },
  })
}

/**
 * Attempts a client connection, with optional fallback through Cloudflare CORS proxy
 * if a direct browser fetch fails due to CORS restrictions.
 */
async function connectWithCorsFallback(
  client: Client,
  config: McpHttpServerConfig,
  timeoutMs = MCP_REQUEST_MAX_TOTAL_TIMEOUT_MSEC,
): Promise<{ transport: StreamableHTTPClientTransport, proxied: boolean }> {
  // 1. Try direct connection first
  let transport = createTransport(config)
  try {
    await withDeadline(client.connect(transport), timeoutMs, 'direct connect')
    return { transport, proxied: false }
  }
  catch (directError: any) {
    // If it's a TypeError (standard browser network/CORS error), try through the Cloudflare CORS proxy
    const isNetworkOrCors = directError instanceof TypeError || String(directError).includes('Failed to fetch')
    if (!isNetworkOrCors) {
      throw directError
    }

    try {
      await transport.close().catch(() => {})
    }
    catch {}

    // Fallback URL via Cloudflare Worker proxy
    const proxiedUrl = `https://airi-cors-proxy.r1ch4rd.workers.dev/cors-proxy?url=${encodeURIComponent(config.url)}`
    console.info(`[WebMcpClient] Direct connection failed (possible CORS). Retrying via CORS proxy: ${proxiedUrl}`)

    transport = createTransport(config, proxiedUrl)
    await withDeadline(client.connect(transport), timeoutMs, 'proxied connect')
    return { transport, proxied: true }
  }
}

export class WebMcpClient implements McpToolBridge {
  private sessions = new Map<string, WebMcpSession>()
  private runtimeStatuses = new Map<string, McpServerRuntimeStatus>()
  private updatedAt = Date.now()

  async testServer(payload: McpTestPayload): Promise<McpTestResult> {
    const startedAt = Date.now()
    if (!isHttpServerConfig(payload.config)) {
      return {
        ok: false,
        error: 'Local stdio commands (e.g. npx/binary) are only supported in the AIRI Desktop app. In Web mode, please use Remote HTTP endpoints.',
        durationMs: 0,
      }
    }

    let transport: StreamableHTTPClientTransport | null = null
    let client: Client | null = null

    try {
      client = new Client({
        name: `proj-airi:stage-web:mcp:test:${payload.name}`,
        version: '0.9.37',
      })

      const connection = await connectWithCorsFallback(client, payload.config, MCP_REQUEST_MAX_TOTAL_TIMEOUT_MSEC)
      transport = connection.transport

      const response = await client.listTools(undefined, {
        timeout: MCP_REQUEST_TIMEOUT_MSEC,
        maxTotalTimeout: MCP_REQUEST_MAX_TOTAL_TIMEOUT_MSEC,
      })

      return {
        ok: true,
        tools: response.tools.map(t => t.name),
        durationMs: Date.now() - startedAt,
      }
    }
    catch (error) {
      return {
        ok: false,
        error: stringifyError(error),
        durationMs: Date.now() - startedAt,
      }
    }
    finally {
      if (client) {
        await client.close().catch(() => {})
      }
      if (transport) {
        await transport.close().catch(() => {})
      }
    }
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    const allTools: McpToolDescriptor[] = []

    for (const [serverName, session] of this.sessions.entries()) {
      try {
        const response = await session.client.listTools(undefined, {
          timeout: MCP_REQUEST_TIMEOUT_MSEC,
          maxTotalTimeout: MCP_REQUEST_MAX_TOTAL_TIMEOUT_MSEC,
        })

        for (const t of response.tools) {
          allTools.push({
            serverName,
            name: `${serverName}::${t.name}`,
            toolName: t.name,
            description: t.description,
            inputSchema: (t.inputSchema as Record<string, unknown>) || {},
          })
        }
      }
      catch (error) {
        console.warn(`[WebMcpClient] Failed to list tools from server "${serverName}":`, error)
      }
    }

    return allTools
  }

  async callTool(payload: McpCallToolPayload): Promise<McpCallToolResult> {
    const { serverName, toolName } = parseQualifiedToolName(payload.name)
    const session = this.sessions.get(serverName)

    if (!session) {
      throw new Error(`MCP server "${serverName}" is not connected or not available in Web runtime.`)
    }

    try {
      const response = await session.client.callTool(
        {
          name: toolName,
          arguments: payload.arguments,
        },
        undefined,
        {
          timeout: MCP_REQUEST_TIMEOUT_MSEC,
          maxTotalTimeout: MCP_REQUEST_MAX_TOTAL_TIMEOUT_MSEC,
        },
      )

      return {
        content: response.content as Array<Record<string, unknown>>,
        structuredContent: response.structuredContent as Record<string, unknown>,
        isError: typeof response.isError === 'boolean' ? response.isError : undefined,
      }
    }
    catch (error) {
      console.error(`[WebMcpClient] Call tool failed for "${payload.name}":`, error)
      return {
        isError: true,
        content: [{ type: 'text', text: stringifyError(error) }],
      }
    }
  }

  async getRuntimeStatus(): Promise<McpRuntimeStatus> {
    const store = useMcpWebConfigStore()
    const config = await store.getConfig()
    const statuses: McpServerRuntimeStatus[] = []

    for (const [name, serverConfig] of Object.entries(config.mcpServers || {})) {
      if (!isHttpServerConfig(serverConfig)) {
        statuses.push({
          name,
          state: 'stopped',
          transport: 'stdio',
          command: (serverConfig as any).command || '',
          args: (serverConfig as any).args || [],
          pid: null,
          lastError: 'Local stdio servers require AIRI Desktop.',
        })
      }
      else {
        const cached = this.runtimeStatuses.get(name)
        if (cached) {
          statuses.push(cached)
        }
        else {
          statuses.push({
            name,
            state: serverConfig.enabled === false ? 'stopped' : 'stopped',
            transport: 'http',
            url: serverConfig.url,
          })
        }
      }
    }

    return {
      path: 'localStorage:settings/mcp/config',
      servers: statuses,
      updatedAt: this.updatedAt,
    }
  }

  async getConfig(): Promise<McpConfigFile> {
    const store = useMcpWebConfigStore()
    return store.getConfig()
  }

  async updateConfig(partial: Partial<McpConfigFile>): Promise<void> {
    const store = useMcpWebConfigStore()
    await store.updateConfig(partial)
    await this.applyAndRestart()
  }

  async applyAndRestart(): Promise<void> {
    // 1. Close existing sessions
    for (const session of this.sessions.values()) {
      try {
        await session.client.close()
      }
      catch {}
      try {
        await session.transport.close()
      }
      catch {}
    }
    this.sessions.clear()
    this.runtimeStatuses.clear()

    // 2. Read latest config
    const store = useMcpWebConfigStore()
    const config = await store.getConfig()

    // 3. Connect to enabled HTTP servers
    for (const [name, serverConfig] of Object.entries(config.mcpServers || {})) {
      if (!isHttpServerConfig(serverConfig)) {
        this.runtimeStatuses.set(name, {
          name,
          state: 'stopped',
          transport: 'stdio',
          command: (serverConfig as any).command || '',
          args: (serverConfig as any).args || [],
          pid: null,
          lastError: 'Local stdio servers require AIRI Desktop.',
        })
        continue
      }

      if (serverConfig.enabled === false) {
        this.runtimeStatuses.set(name, {
          name,
          state: 'stopped',
          transport: 'http',
          url: serverConfig.url,
        })
        continue
      }

      try {
        const client = new Client({
          name: `proj-airi:stage-web:mcp:${name}`,
          version: '0.9.37',
        })

        const { transport } = await connectWithCorsFallback(client, serverConfig)
        this.sessions.set(name, { client, transport, config: serverConfig })
        this.runtimeStatuses.set(name, {
          name,
          state: 'running',
          transport: 'http',
          url: serverConfig.url,
        })
      }
      catch (error) {
        const lastError = stringifyError(error)
        console.warn(`[WebMcpClient] Failed to connect to server "${name}":`, error)
        this.runtimeStatuses.set(name, {
          name,
          state: 'error',
          transport: 'http',
          url: serverConfig.url,
          lastError,
        })
      }
    }

    this.updatedAt = Date.now()
  }
}

export function createWebMcpClient(): WebMcpClient {
  return new WebMcpClient()
}
