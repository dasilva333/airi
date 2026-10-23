import type { McpToolBridge, McpToolDescriptor } from './mcp-tool-bridge'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearMcpToolBridge,
  ensureMcpServersForAllowedTools,
  ensureMusicToolProvisioned,
  filterMcpToolsForCard,
  getMcpToolBridge,

  setMcpToolBridge,
  tryGetMcpToolBridge,
} from './mcp-tool-bridge'

describe('mCP tool bridge lifecycle, config reconciliation & titration', () => {
  beforeEach(() => {
    clearMcpToolBridge()
  })

  afterEach(() => {
    clearMcpToolBridge()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('bridge lifecycle', () => {
    it('sets bridge and exposes it on global window object', () => {
      const mockBridge: McpToolBridge = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        getRuntimeStatus: vi.fn(),
      }

      setMcpToolBridge(mockBridge)
      expect(tryGetMcpToolBridge()).toBe(mockBridge)
      expect(getMcpToolBridge()).toBe(mockBridge)
      expect((globalThis as any).__AIRI_MCP_BRIDGE__).toBe(mockBridge)
    })

    it('throws descriptive error when getMcpToolBridge called without initialization', () => {
      expect(() => getMcpToolBridge()).toThrow('MCP tool bridge is not available in this runtime.')
      expect(tryGetMcpToolBridge()).toBeUndefined()
    })

    it('clears local bridge and global window property on clearMcpToolBridge', () => {
      const mockBridge: McpToolBridge = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        getRuntimeStatus: vi.fn(),
      }

      setMcpToolBridge(mockBridge)
      clearMcpToolBridge()

      expect(tryGetMcpToolBridge()).toBeUndefined()
      expect((globalThis as any).__AIRI_MCP_BRIDGE__).toBeUndefined()
    })
  })

  describe('ensureMcpServersForAllowedTools', () => {
    it('returns false early when allowedTools is undefined or empty', async () => {
      expect(await ensureMcpServersForAllowedTools(undefined)).toBe(false)
      expect(await ensureMcpServersForAllowedTools([])).toBe(false)
    })

    it('returns false when bridge does not implement getConfig or updateConfig', async () => {
      const bridgeWithoutConfig: McpToolBridge = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        getRuntimeStatus: vi.fn(),
      }
      setMcpToolBridge(bridgeWithoutConfig)

      const result = await ensureMcpServersForAllowedTools(['web_search'])
      expect(result).toBe(false)
    })

    it('automatically configures open-websearch when web_search is allowed', async () => {
      let savedConfig: any = null
      const mockApplyAndRestart = vi.fn().mockResolvedValue(undefined)

      const bridge: McpToolBridge = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        getRuntimeStatus: vi.fn(),
        getConfig: vi.fn().mockResolvedValue({ mcpServers: {} }),
        updateConfig: vi.fn().mockImplementation(async (partial) => {
          savedConfig = partial
        }),
        applyAndRestart: mockApplyAndRestart,
      }
      setMcpToolBridge(bridge)

      const result = await ensureMcpServersForAllowedTools(['web_search'])

      expect(result).toBe(true)
      expect(savedConfig).not.toBeNull()
      expect(savedConfig.mcpServers['open-websearch']).toBeDefined()
      expect(savedConfig.mcpServers['open-websearch'].command).toBe('npx')
      expect(savedConfig.mcpServers['open-websearch'].enabled).toBe(true)
      expect(savedConfig.mcpServers['open-websearch'].env.DEFAULT_SEARCH_ENGINE).toBe('duckduckgo')
      expect(mockApplyAndRestart).toHaveBeenCalled()
    })

    it('automatically configures filesystem when filesystem is allowed', async () => {
      let savedConfig: any = null
      const bridge: McpToolBridge = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        getRuntimeStatus: vi.fn(),
        getConfig: vi.fn().mockResolvedValue({ mcpServers: {} }),
        updateConfig: vi.fn().mockImplementation(async (partial) => {
          savedConfig = partial
        }),
      }
      setMcpToolBridge(bridge)

      const result = await ensureMcpServersForAllowedTools(['filesystem'])

      expect(result).toBe(true)
      expect(savedConfig.mcpServers.filesystem).toBeDefined()
      expect(savedConfig.mcpServers.filesystem.command).toBe('npx')
      expect(savedConfig.mcpServers.filesystem.enabled).toBe(true)
    })

    it('does not update config or trigger restart when servers are already configured and enabled', async () => {
      const updateConfigMock = vi.fn()
      const bridge: McpToolBridge = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        getRuntimeStatus: vi.fn(),
        getConfig: vi.fn().mockResolvedValue({
          mcpServers: {
            'open-websearch': {
              command: 'npx',
              enabled: true,
              env: { DEFAULT_SEARCH_ENGINE: 'duckduckgo', SEARCH_MODE: 'auto', MODE: 'stdio' },
            },
          },
        }),
        updateConfig: updateConfigMock,
      }
      setMcpToolBridge(bridge)

      const result = await ensureMcpServersForAllowedTools(['web_search'])

      expect(result).toBe(false)
      expect(updateConfigMock).not.toHaveBeenCalled()
    })
  })

  describe('ensureMusicToolProvisioned', () => {
    function createBridge(config: any) {
      let savedConfig: any = null
      const updateConfig = vi.fn().mockImplementation(async (partial) => {
        savedConfig = partial
      })
      const bridge: McpToolBridge = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        getRuntimeStatus: vi.fn(),
        getConfig: vi.fn().mockResolvedValue(config),
        updateConfig,
      }
      setMcpToolBridge(bridge)
      return { bridge, updateConfig, getSaved: () => savedConfig }
    }

    it('fails without a bridge (web runtime)', async () => {
      expect(await ensureMusicToolProvisioned()).toEqual({ ok: false, reason: 'no-bridge' })
    })

    it('reuses an existing http entry without probing the server', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      createBridge({
        mcpServers: { 'airi-audio-server': { url: 'http://127.0.0.1:8095/mcp', enabled: true } },
      })

      const outcome = await ensureMusicToolProvisioned()

      expect(outcome).toEqual({ ok: true, url: 'http://127.0.0.1:8095/mcp', source: 'existing' })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('provisions the endpoint advertised by /capabilities', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ mcp: { url: 'http://127.0.0.1:8095/mcp' } }),
      }))
      const { getSaved } = createBridge({ mcpServers: {} })

      const outcome = await ensureMusicToolProvisioned({ providerBaseUrl: 'http://127.0.0.1:8095/v1/' })

      expect(outcome).toEqual({ ok: true, url: 'http://127.0.0.1:8095/mcp', source: 'provisioned' })
      expect(getSaved().mcpServers['airi-audio-server']).toEqual({
        url: 'http://127.0.0.1:8095/mcp',
        enabled: true,
      })
    })

    it('blocks when the audio server is unreachable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
      const { updateConfig } = createBridge({ mcpServers: {} })

      const outcome = await ensureMusicToolProvisioned()

      expect(outcome).toEqual({ ok: false, reason: 'unreachable' })
      expect(updateConfig).not.toHaveBeenCalled()
    })

    it('blocks when the server does not advertise an MCP endpoint', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ supportsExpressionTags: true }),
      }))
      const { updateConfig } = createBridge({ mcpServers: {} })

      const outcome = await ensureMusicToolProvisioned()

      expect(outcome).toEqual({ ok: false, reason: 'not-advertised' })
      expect(updateConfig).not.toHaveBeenCalled()
    })
  })

  describe('filterMcpToolsForCard (Tool Titration)', () => {
    const rawTools: McpToolDescriptor[] = [
      {
        serverName: 'open-websearch',
        name: 'open-websearch::search',
        toolName: 'search',
        inputSchema: {},
      },
      {
        serverName: 'filesystem',
        name: 'filesystem::read_file',
        toolName: 'read_file',
        inputSchema: {},
      },
      {
        serverName: 'custom-utility',
        name: 'custom-utility::ping',
        toolName: 'ping',
        inputSchema: {},
      },
      {
        serverName: 'airi-audio-server',
        name: 'airi-audio-server::music',
        toolName: 'music',
        inputSchema: {},
      },
    ]

    it('returns empty array when allowedTools is undefined or empty', () => {
      expect(filterMcpToolsForCard(rawTools, undefined)).toEqual([])
      expect(filterMcpToolsForCard(rawTools, [])).toEqual([])
    })

    it('returns all tools when allowedTools includes blanket mcp permission', () => {
      expect(filterMcpToolsForCard(rawTools, ['mcp'])).toEqual(rawTools)
    })

    it('filters to only websearch tools when web_search or mcp_web_search is specified', () => {
      const result = filterMcpToolsForCard(rawTools, ['web_search'])
      expect(result).toHaveLength(1)
      expect(result[0].serverName).toBe('open-websearch')

      const aliasResult = filterMcpToolsForCard(rawTools, ['mcp_web_search'])
      expect(aliasResult).toHaveLength(1)
      expect(aliasResult[0].serverName).toBe('open-websearch')
    })

    it('filters to only filesystem tools when filesystem or mcp_filesystem is specified', () => {
      const result = filterMcpToolsForCard(rawTools, ['filesystem'])
      expect(result).toHaveLength(1)
      expect(result[0].serverName).toBe('filesystem')

      const aliasResult = filterMcpToolsForCard(rawTools, ['mcp_filesystem'])
      expect(aliasResult).toHaveLength(1)
      expect(aliasResult[0].serverName).toBe('filesystem')
    })

    it('permits explicit qualified tool names even from custom servers', () => {
      const result = filterMcpToolsForCard(rawTools, ['custom-utility::ping'])
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('custom-utility::ping')
    })

    it('filters to only audio server tools when music or mcp_music is specified', () => {
      const result = filterMcpToolsForCard(rawTools, ['music'])
      expect(result).toHaveLength(1)
      expect(result[0].serverName).toBe('airi-audio-server')

      const aliasResult = filterMcpToolsForCard(rawTools, ['mcp_music'])
      expect(aliasResult).toHaveLength(1)
      expect(aliasResult[0].serverName).toBe('airi-audio-server')
    })

    it('does not leak audio server tools when only unrelated families are allowed', () => {
      expect(filterMcpToolsForCard(rawTools, ['web_search', 'filesystem'])).toHaveLength(2)
    })
  })
})
