import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { useLogg } from '@guiiai/logg'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { defineInvokeHandler } from '@moeru/eventa'
import type { createContext } from '@moeru/eventa/adapters/electron/main'
import { app, shell } from 'electron'
import { z } from 'zod'
import type {
  ElectronMcpCallToolPayload,
  ElectronMcpCallToolResult,
  ElectronMcpStdioApplyResult,
  ElectronMcpStdioConfigFile,
  ElectronMcpStdioRuntimeStatus,
  ElectronMcpStdioServerConfig,
  ElectronMcpStdioServerRuntimeStatus,
  ElectronMcpToolDescriptor,
} from '../../../../shared/eventa'

import {
  electronMcpApplyAndRestart,
  electronMcpCallTool,
  electronMcpGetConfig,
  electronMcpGetRuntimeStatus,
  electronMcpListTools,
  electronMcpOpenConfigFile,
  electronMcpUpdateConfig,
} from '../../../../shared/eventa'
import { onAppBeforeQuit } from '../../../libs/bootkit/lifecycle'

interface McpServerSession {
  client: Client
  transport: StdioClientTransport
  config: ElectronMcpStdioServerConfig
}

export interface McpStdioManager {
  ensureConfigFile: () => Promise<{ path: string }>
  openConfigFile: () => Promise<{ path: string }>
  applyAndRestart: () => Promise<ElectronMcpStdioApplyResult>
  listTools: () => Promise<ElectronMcpToolDescriptor[]>
  callTool: (payload: ElectronMcpCallToolPayload) => Promise<ElectronMcpCallToolResult>
  stopAll: () => Promise<void>
  getRuntimeStatus: () => ElectronMcpStdioRuntimeStatus
  getConfig: () => Promise<ElectronMcpStdioConfigFile>
  updateConfig: (config: Partial<ElectronMcpStdioConfigFile>) => Promise<void>
}

const mcpServerConfigSchema = z
  .object({
    args: z.array(z.string()).optional(),
    command: z.string().min(1),
    cwd: z.string().optional(),
    enabled: z.boolean().optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .strict()

const mcpConfigSchema = z
  .object({
    mcpServers: z.record(z.string(), mcpServerConfigSchema),
  })
  .strict()

const defaultMcpConfig: ElectronMcpStdioConfigFile = {
  mcpServers: {},
}
const toolNameSeparator = '::'
const mcpRequestTimeoutMsec = 10_000
const mcpRequestMaxTotalTimeoutMsec = 15_000

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
  const normalizedTransportPrefix = toolName.replace(/^\.(?:stdio|stdo)::/, '').replace(/^(?:stdio|stdo)::/, '')
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
  } catch {
    await session.transport.close()
  }
}

export function createMcpStdioManager(): McpStdioManager {
  const log = useLogg('main/mcp-stdio').useGlobalConfig()
  const sessions = new Map<string, McpServerSession>()
  const runtimeStatuses = new Map<string, ElectronMcpStdioServerRuntimeStatus>()
  let updatedAt = Date.now()

  const setRuntimeStatus = (status: ElectronMcpStdioServerRuntimeStatus) => {
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
    } catch {
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

  const readConfigFile = async (path: string): Promise<ElectronMcpStdioConfigFile> => {
    const raw = await readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    const validated = mcpConfigSchema.safeParse(parsed)
    if (!validated.success) {
      throw new Error(validated.error.issues.map((issue) => issue.message).join('; '))
    }
    return validated.data
  }

  const stopAll = async () => {
    const entries = [...sessions.entries()]
    for (const [name, session] of entries) {
      await closeSession(session)
      setRuntimeStatus({
        args: session.config.args ?? [],
        command: session.config.command,
        name,
        pid: null,
        state: 'stopped',
      })
      sessions.delete(name)
    }
  }

  const startServer = async (name: string, config: ElectronMcpStdioServerConfig) => {
    log.withFields({ name }).log('starting mcp stdio server')
    const transport = new StdioClientTransport({
      args: config.args ?? [],
      command: config.command,
      cwd: config.cwd,
      env: config.env,
      stderr: 'pipe',
    })

    const client = new Client(
      {
        name: 'proj-airi',
        version: app.getVersion(),
      },
      {
        capabilities: {},
      },
    )

    try {
      await client.connect(transport)
      transport.stderr?.on('data', (data) => {
        const text = data.toString('utf-8').trim()
        if (text) {
          log.withFields({ name }).debug(`mcp stdio stderr: ${text}`)
        }
      })

      sessions.set(name, { client, config, transport })
      setRuntimeStatus({
        args: config.args ?? [],
        command: config.command,
        name,
        pid: transport.pid,
        state: 'running',
      })
      log.withFields({ name, pid: transport.pid }).log('mcp stdio server started')
    } catch (error) {
      log.withFields({ name }).withError(error).error('failed to connect mcp stdio server')
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
      failed: [],
      path,
      skipped: [],
      started: [],
    }

    for (const [name, server] of Object.entries(config.mcpServers)) {
      if (server.enabled === false) {
        result.skipped.push({ name, reason: 'disabled' })
        setRuntimeStatus({
          args: server.args ?? [],
          command: server.command,
          name,
          pid: null,
          state: 'stopped',
        })
        continue
      }

      try {
        await startServer(name, server)
        result.started.push({ name })
      } catch (error) {
        const message = stringifyError(error)
        result.failed.push({ error: message, name })
        setRuntimeStatus({
          args: server.args ?? [],
          command: server.command,
          lastError: message,
          name,
          pid: null,
          state: 'error',
        })
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
            description: tool.description,
            inputSchema: tool.inputSchema as Record<string, unknown>,
            name: `${serverName}${toolNameSeparator}${tool.name}`,
            serverName,
            toolName: tool.name,
          })
        }
      } catch (error) {
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
      result = await session.client.callTool(
        {
          arguments: payload.arguments ?? {},
          name: toolName,
        },
        undefined,
        {
          maxTotalTimeout: mcpRequestMaxTotalTimeoutMsec,
          timeout: mcpRequestTimeoutMsec,
        },
      )
    } catch (error) {
      const fallbackToolName = resolveFallbackToolName(toolName)
      if (!fallbackToolName || fallbackToolName === toolName) {
        throw error
      }

      log
        .withFields({
          fallbackToolName,
          requestedToolName: toolName,
          serverName,
        })
        .warn('retrying mcp tool call with normalized tool name')

      result = await session.client.callTool(
        {
          arguments: payload.arguments ?? {},
          name: fallbackToolName,
        },
        undefined,
        {
          maxTotalTimeout: mcpRequestMaxTotalTimeoutMsec,
          timeout: mcpRequestTimeoutMsec,
        },
      )
    }

    const normalized: ElectronMcpCallToolResult = {}
    if ('content' in result && Array.isArray(result.content)) {
      normalized.content = result.content as Array<Record<string, unknown>>
    }
    if (
      'structuredContent' in result &&
      result.structuredContent &&
      typeof result.structuredContent === 'object' &&
      !Array.isArray(result.structuredContent)
    ) {
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

  const getRuntimeStatus = (): ElectronMcpStdioRuntimeStatus => {
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

  const updateConfig = async (partial: Partial<ElectronMcpStdioConfigFile>) => {
    const { path } = await ensureConfigFile()
    const current = await readConfigFile(path)

    const updated: ElectronMcpStdioConfigFile = {
      ...current,
      mcpServers: {
        ...current.mcpServers,
        ...partial.mcpServers,
      },
    }

    await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`)
    log.log('mcp config updated')
  }

  return {
    applyAndRestart,
    callTool,
    ensureConfigFile,
    getConfig,
    getRuntimeStatus,
    listTools,
    openConfigFile,
    stopAll,
    updateConfig,
  }
}

export async function setupMcpStdioManager() {
  const log = useLogg('main/mcp-stdio').useGlobalConfig()
  const manager = createMcpStdioManager()

  onAppBeforeQuit(async () => {
    await manager.stopAll()
  })

  await manager.ensureConfigFile()

  try {
    await manager.applyAndRestart()
  } catch (error) {
    log.withError(error).warn('failed to apply mcp stdio config during startup')
  }

  return manager
}

export function createMcpServersService(params: {
  context: ReturnType<typeof createContext>['context']
  manager: McpStdioManager
}) {
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
}
