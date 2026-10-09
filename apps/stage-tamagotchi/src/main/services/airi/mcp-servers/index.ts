import type { createContext } from '@moeru/eventa/adapters/electron/main'

import type {
  ElectronMcpCallToolPayload,
  ElectronMcpCallToolResult,
  ElectronMcpConfigFile,
  ElectronMcpRuntimeStatus,
  ElectronMcpServerConfig,
  ElectronMcpServerRuntimeStatus,
  ElectronMcpStdioApplyResult,
  ElectronMcpTestPayload,
  ElectronMcpTestResult,
  ElectronMcpToolDescriptor,
} from '../../../../shared/eventa'

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { useLogg } from '@guiiai/logg'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { defineInvokeHandler } from '@moeru/eventa'
import { app, dialog, shell } from 'electron'
import { z } from 'zod'

import {
  electronMcpApplyAndRestart,
  electronMcpCallTool,
  electronMcpGetConfig,
  electronMcpGetRuntimeStatus,
  electronMcpListTools,
  electronMcpOpenConfigFile,
  electronMcpTestServer,
  electronMcpUpdateConfig,
  electronSelectDirectories,
} from '../../../../shared/eventa'
import { onAppBeforeQuit } from '../../../libs/bootkit/lifecycle'

/** A transport that the MCP client can drive. Both kinds expose `close`. */
type McpTransport = StdioClientTransport | StreamableHTTPClientTransport

interface McpServerSession {
  client: Client
  transport: McpTransport
  config: ElectronMcpServerConfig
}

export interface McpStdioManager {
  ensureConfigFile: () => Promise<{ path: string }>
  openConfigFile: () => Promise<{ path: string }>
  applyAndRestart: () => Promise<ElectronMcpStdioApplyResult>
  listTools: () => Promise<ElectronMcpToolDescriptor[]>
  callTool: (payload: ElectronMcpCallToolPayload) => Promise<ElectronMcpCallToolResult>
  stopAll: () => Promise<void>
  getRuntimeStatus: () => ElectronMcpRuntimeStatus
  getConfig: () => Promise<ElectronMcpConfigFile>
  updateConfig: (config: Partial<ElectronMcpConfigFile>) => Promise<void>
  testServer: (payload: ElectronMcpTestPayload) => Promise<ElectronMcpTestResult>
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  }
  catch {
    return false
  }
}

export function isHttpServerConfig(config: ElectronMcpServerConfig): config is { url: string, headers?: Record<string, string>, enabled?: boolean } {
  return 'url' in config
}

const mcpStdioServerConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
  enabled: z.boolean().optional(),
}).strict()

const mcpHttpServerConfigSchema = z.object({
  url: z.string().min(1).refine(isHttpUrl, { message: 'must be an absolute http or https URL' }),
  headers: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
}).strict()

const mcpServerConfigSchema = z.union([
  mcpStdioServerConfigSchema,
  mcpHttpServerConfigSchema,
])

const mcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), mcpServerConfigSchema),
}).strict()

const defaultMcpConfig: ElectronMcpConfigFile = {
  mcpServers: {
    'open-websearch': {
      command: 'npx',
      args: ['-y', 'open-websearch@latest'],
      env: {
        DEFAULT_SEARCH_ENGINE: 'duckduckgo',
        SEARCH_MODE: 'auto',
        MODE: 'stdio',
      },
      enabled: true,
    },
  },
}
const toolNameSeparator = '::'
const mcpRequestTimeoutMsec = 10_000
const mcpRequestMaxTotalTimeoutMsec = 15_000
const mcpTestStderrMaxChars = 16_000

function stringifyError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function getConfigPath() {
  return join(app.getPath('appData'), 'airi', 'mcp.json')
}

function parseQualifiedToolName(name: string) {
  const separatorIndex = name.indexOf(toolNameSeparator)
  if (separatorIndex <= 0 || separatorIndex === name.length - toolNameSeparator.length) {
    throw new Error(`invalid qualified tool name: ${name}`)
  }

  return {
    serverName: name.slice(0, separatorIndex),
    toolName: name.slice(separatorIndex + toolNameSeparator.length),
  }
}

function resolveFallbackToolName(toolName: string): string | undefined {
  const normalizedTransportPrefix = toolName
    .replace(/^\.(?:stdio|stdo)::/, '')
    .replace(/^(?:stdio|stdo)::/, '')
  if (normalizedTransportPrefix !== toolName) {
    return normalizedTransportPrefix
  }

  const lastSeparatorIndex = toolName.lastIndexOf(toolNameSeparator)
  if (lastSeparatorIndex <= 0 || lastSeparatorIndex === toolName.length - toolNameSeparator.length) {
    return undefined
  }

  return toolName.slice(lastSeparatorIndex + toolNameSeparator.length)
}

async function closeSession(session: McpServerSession) {
  try {
    await session.client.close()
  }
  catch {
    await session.transport.close()
  }
}

/**
 * Creates the transport for one server configuration.
 *
 * Use when:
 * - Starting a server from `mcp.json`
 *
 * Expects:
 * - `config` already passed the MCP config schema
 *
 * Returns:
 * - A stdio transport that spawns `config.command`, or a streamable HTTP
 *   transport that reaches `config.url` and sends `config.headers` on every request
 */
function createTransport(config: ElectronMcpServerConfig): McpTransport {
  if (isHttpServerConfig(config)) {
    return new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: { headers: config.headers },
    })
  }

  return new StdioClientTransport({
    command: config.command,
    args: config.args ?? [],
    env: config.env,
    cwd: config.cwd,
    stderr: 'pipe',
  })
}

/**
 * Builds the runtime status row for one server.
 *
 * Use when:
 * - Recording that a server started, stopped, or failed
 *
 * Expects:
 * - `config` already passed the MCP config schema
 * - `options.pid` is known for stdio servers only
 *
 * Returns:
 * - A status that reports a process for stdio servers and an endpoint for HTTP servers
 */
function describeRuntime(
  name: string,
  config: ElectronMcpServerConfig,
  state: ElectronMcpServerRuntimeStatus['state'],
  options: { pid?: number | null, lastError?: string } = {},
): ElectronMcpServerRuntimeStatus {
  const lastError = options.lastError === undefined ? {} : { lastError: options.lastError }

  if (isHttpServerConfig(config)) {
    return { name, state, transport: 'http', url: config.url, ...lastError }
  }

  return {
    name,
    state,
    transport: 'stdio',
    command: config.command,
    args: config.args ?? [],
    pid: options.pid ?? null,
    ...lastError,
  }
}

export function createMcpStdioManager(): McpStdioManager {
  const log = useLogg('main/mcp').useGlobalConfig()
  const sessions = new Map<string, McpServerSession>()
  const runtimeStatuses = new Map<string, ElectronMcpServerRuntimeStatus>()
  let updatedAt = Date.now()

  const setRuntimeStatus = (status: ElectronMcpServerRuntimeStatus) => {
    runtimeStatuses.set(status.name, status)
    updatedAt = Date.now()
  }

  const ensureConfigFile = async () => {
    const path = getConfigPath()
    log.withFields({ path }).debug('ensuring mcp config file')

    // Ensure the parent directory exists
    await mkdir(dirname(path), { recursive: true })

    try {
      await readFile(path, 'utf-8')
    }
    catch {
      log.withFields({ path }).log('mcp config file not found, creating default')
      await writeFile(path, `${JSON.stringify(defaultMcpConfig, null, 2)}\n`)
    }

    return { path }
  }

  const openConfigFile = async () => {
    const { path } = await ensureConfigFile()
    const openResult = await shell.openPath(path)
    if (openResult) {
      throw new Error(openResult)
    }
    return { path }
  }

  const readConfigFile = async (path: string): Promise<ElectronMcpConfigFile> => {
    const raw = await readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    const validated = mcpConfigSchema.safeParse(parsed)
    if (!validated.success) {
      throw new Error(validated.error.issues.map(issue => issue.message).join('; '))
    }
    return validated.data
  }

  const stopAll = async () => {
    const entries = [...sessions.entries()]
    for (const [name, session] of entries) {
      await closeSession(session)
      setRuntimeStatus(describeRuntime(name, session.config, 'stopped'))
      sessions.delete(name)
    }
  }

  const startServer = async (name: string, config: ElectronMcpServerConfig) => {
    log.withFields({ name }).log('starting mcp server')
    const transport = createTransport(config)

    const client = new Client({
      name: `proj-airi:stage-tamagotchi:mcp:${name}`,
      version: app.getVersion(),
    }, {
      capabilities: {},
    })

    try {
      await client.connect(transport)
      if (transport instanceof StdioClientTransport) {
        transport.stderr?.on('data', (data) => {
          const text = data.toString('utf-8').trim()
          if (text) {
            log.withFields({ name }).debug(`mcp stdio stderr: ${text}`)
          }
        })
      }

      sessions.set(name, { client, transport, config })
      setRuntimeStatus(describeRuntime(name, config, 'running', {
        pid: transport instanceof StdioClientTransport ? transport.pid : null,
      }))
      log.withFields({ name, transport: isHttpServerConfig(config) ? 'http' : 'stdio' }).log('mcp server started')
    }
    catch (error) {
      log.withFields({ name }).withError(error).error('failed to connect mcp server')
      console.error(`[MCP][${name}] Connection Failed:`, error)
      await transport.close().catch(() => {})
      throw error
    }
  }

  const applyAndRestart = async (): Promise<ElectronMcpStdioApplyResult> => {
    const { path } = await ensureConfigFile()
    const config = await readConfigFile(path)

    await stopAll()
    runtimeStatuses.clear()

    const result: ElectronMcpStdioApplyResult = {
      path,
      started: [],
      failed: [],
      skipped: [],
    }

    for (const [name, server] of Object.entries(config.mcpServers)) {
      if (server.enabled === false) {
        result.skipped.push({ name, reason: 'disabled' })
        setRuntimeStatus(describeRuntime(name, server, 'stopped'))
        continue
      }

      try {
        await startServer(name, server)
        result.started.push({ name })
      }
      catch (error) {
        const message = stringifyError(error)
        result.failed.push({ name, error: message })
        setRuntimeStatus(describeRuntime(name, server, 'error', { lastError: message }))
      }
    }

    updatedAt = Date.now()

    return result
  }

  const listTools = async (): Promise<ElectronMcpToolDescriptor[]> => {
    log.log('listing mcp tools')
    const allTools: ElectronMcpToolDescriptor[] = []
    for (const [serverName, session] of sessions) {
      try {
        const result = await session.client.listTools()
        for (const tool of result.tools) {
          allTools.push({
            serverName,
            name: `${serverName}${toolNameSeparator}${tool.name}`,
            toolName: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema as Record<string, unknown>,
          })
        }
      }
      catch (error) {
        log.withFields({ serverName }).withError(error).error('failed to list tools')
        console.error(`[MCP][${serverName}] List Tools Failed:`, error)
      }
    }

    log.withFields({ count: allTools.length }).log('mcp tools listed')
    return allTools
  }

  const callTool = async (payload: ElectronMcpCallToolPayload): Promise<ElectronMcpCallToolResult> => {
    const { serverName, toolName } = parseQualifiedToolName(payload.name)
    log.withFields({ serverName, toolName }).log('calling mcp tool')

    const session = sessions.get(serverName)
    if (!session) {
      log.withFields({ serverName }).error('mcp server is not running')
      throw new Error(`mcp server is not running: ${serverName}`)
    }

    let result
    try {
      result = await session.client.callTool({
        name: toolName,
        arguments: payload.arguments ?? {},
      }, undefined, {
        timeout: mcpRequestTimeoutMsec,
        maxTotalTimeout: mcpRequestMaxTotalTimeoutMsec,
      })
    }
    catch (error) {
      const fallbackToolName = resolveFallbackToolName(toolName)
      if (!fallbackToolName || fallbackToolName === toolName) {
        throw error
      }

      log.withFields({
        serverName,
        requestedToolName: toolName,
        fallbackToolName,
      }).warn('retrying mcp tool call with normalized tool name')

      result = await session.client.callTool({
        name: fallbackToolName,
        arguments: payload.arguments ?? {},
      }, undefined, {
        timeout: mcpRequestTimeoutMsec,
        maxTotalTimeout: mcpRequestMaxTotalTimeoutMsec,
      })
    }

    const normalized: ElectronMcpCallToolResult = {}
    if ('content' in result && Array.isArray(result.content)) {
      normalized.content = result.content as Array<Record<string, unknown>>
    }
    if ('structuredContent' in result && result.structuredContent && typeof result.structuredContent === 'object' && !Array.isArray(result.structuredContent)) {
      normalized.structuredContent = result.structuredContent as Record<string, unknown>
    }
    if ('isError' in result && typeof result.isError === 'boolean') {
      normalized.isError = result.isError
    }
    if ('toolResult' in result) {
      normalized.toolResult = result.toolResult
    }

    return normalized
  }

  const getRuntimeStatus = (): ElectronMcpRuntimeStatus => {
    return {
      path: getConfigPath(),
      servers: [...runtimeStatuses.values()].sort((left, right) => left.name.localeCompare(right.name)),
      updatedAt,
    }
  }

  const getConfig = async () => {
    const { path } = await ensureConfigFile()
    return readConfigFile(path)
  }

  const updateConfig = async (partial: Partial<ElectronMcpConfigFile>) => {
    const { path } = await ensureConfigFile()
    const current = await readConfigFile(path)

    const updated: ElectronMcpConfigFile = {
      ...current,
      ...partial,
      mcpServers: partial.mcpServers !== undefined
        ? partial.mcpServers
        : current.mcpServers,
    }

    await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`)
    log.log('mcp config updated')
  }

  const testServer = async (payload: ElectronMcpTestPayload): Promise<ElectronMcpTestResult> => {
    const startedAt = Date.now()
    let transport: McpTransport | null = null
    let client: Client | null = null
    const stderrChunks: string[] = []

    const withDeadline = <V>(promise: Promise<V>, ms: number, label: string): Promise<V> => {
      let timer: NodeJS.Timeout | undefined
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      })
      return Promise.race([promise, timeout]).finally(() => {
        if (timer)
          clearTimeout(timer)
      })
    }

    try {
      transport = createTransport(payload.config)
      client = new Client({
        name: `proj-airi:stage-tamagotchi:mcp:test:${payload.name}`,
        version: app.getVersion(),
      })

      if (transport instanceof StdioClientTransport) {
        transport.stderr?.on('data', (data) => {
          const text = data.toString('utf-8')
          if (text)
            stderrChunks.push(text)
        })
      }

      await withDeadline(client.connect(transport), mcpRequestMaxTotalTimeoutMsec, 'connect')

      const response = await client.listTools(undefined, {
        timeout: mcpRequestTimeoutMsec,
        maxTotalTimeout: mcpRequestMaxTotalTimeoutMsec,
      })

      if (stderrChunks.length > 0) {
        log.withFields({ serverName: payload.name }).debug(stderrChunks.join('').trim())
      }

      return {
        ok: true,
        tools: response.tools.map(tool => tool.name),
        durationMs: Date.now() - startedAt,
      }
    }
    catch (error) {
      const message = stringifyError(error)
      // Keep only the tail so a noisy failed server cannot flood the settings UI.
      const stderr = stderrChunks.join('').trim().slice(-mcpTestStderrMaxChars)
      return {
        ok: false,
        error: stderr ? `${message}\n\n${stderr}` : message,
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

  return {
    ensureConfigFile,
    openConfigFile,
    applyAndRestart,
    listTools,
    callTool,
    stopAll,
    getRuntimeStatus,
    getConfig,
    updateConfig,
    testServer,
  }
}

export async function setupMcpStdioManager() {
  const log = useLogg('main/mcp-stdio').useGlobalConfig()
  const manager = createMcpStdioManager()

  onAppBeforeQuit(async () => {
    await manager.stopAll()
  })

  await manager.ensureConfigFile()

  // NOTICE: Fire-and-forget — do not await applyAndRestart() here.
  // MCP stdio servers can be slow to connect (e.g. npx cold-cache downloads),
  // and awaiting this blocks the entire injeca dependency chain including all
  // main windows. The manager is returned immediately; servers attach in the background.
  manager.applyAndRestart().catch((error) => {
    log.withError(error).warn('failed to apply mcp stdio config during startup')
  })

  return manager
}

export function createMcpServersService(params: { context: ReturnType<typeof createContext>['context'], manager: McpStdioManager }) {
  defineInvokeHandler(params.context, electronMcpOpenConfigFile, async () => {
    return params.manager.openConfigFile()
  })

  defineInvokeHandler(params.context, electronMcpApplyAndRestart, async () => {
    return params.manager.applyAndRestart()
  })

  defineInvokeHandler(params.context, electronMcpGetRuntimeStatus, async () => {
    return params.manager.getRuntimeStatus()
  })

  defineInvokeHandler(params.context, electronMcpListTools, async () => {
    return params.manager.listTools()
  })

  defineInvokeHandler(params.context, electronMcpCallTool, async (payload) => {
    return params.manager.callTool(payload)
  })

  defineInvokeHandler(params.context, electronMcpGetConfig, async () => {
    return params.manager.getConfig()
  })

  defineInvokeHandler(params.context, electronMcpUpdateConfig, async (payload) => {
    return params.manager.updateConfig(payload)
  })

  defineInvokeHandler(params.context, electronMcpTestServer, async (payload) => {
    return params.manager.testServer(payload)
  })

  defineInvokeHandler(params.context, electronSelectDirectories, async (payload) => {
    const result = await dialog.showOpenDialog({
      title: payload?.title || 'Select Allowed Directories for Filesystem MCP',
      defaultPath: payload?.defaultPath,
      properties: ['openDirectory', 'multiSelections', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths.length) {
      return undefined
    }
    return result.filePaths
  })
}
