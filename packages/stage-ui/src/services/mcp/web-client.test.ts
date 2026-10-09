import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { isHttpServerConfig, isStdioServerConfig, parseQualifiedToolName } from '../../stores/mcp-tool-bridge'
import { useMcpWebConfigStore } from '../../stores/mcp-web-config'
import { WebMcpClient } from './web-client'

describe('web MCP Client & Web Config Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  describe('type guards & name parser', () => {
    it('correctly identifies HTTP vs stdio configs', () => {
      const httpConfig = { url: 'https://example.com/api/mcp' }
      const stdioConfig = { command: 'npx', args: ['-y', 'server'] }

      expect(isHttpServerConfig(httpConfig)).toBe(true)
      expect(isHttpServerConfig(stdioConfig)).toBe(false)

      expect(isStdioServerConfig(stdioConfig)).toBe(true)
      expect(isStdioServerConfig(httpConfig)).toBe(false)
    })

    it('parses qualified tool name server::tool', () => {
      const parsed = parseQualifiedToolName('weather::get_forecast')
      expect(parsed).toEqual({
        serverName: 'weather',
        toolName: 'get_forecast',
      })
    })

    it('throws error for invalid tool names', () => {
      expect(() => parseQualifiedToolName('invalid-name')).toThrow('invalid qualified tool name')
      expect(() => parseQualifiedToolName('::no-server')).toThrow('invalid qualified tool name')
      expect(() => parseQualifiedToolName('no-tool::')).toThrow('invalid qualified tool name')
    })
  })

  describe('webMcpClient runtime boundaries', () => {
    it('rejects stdio server test with clear desktop-requirement error', async () => {
      const client = new WebMcpClient()
      const result = await client.testServer({
        name: 'local-stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
      })

      expect(result.ok).toBe(false)
      expect(result.error).toContain('Local stdio commands')
      expect(result.error).toContain('AIRI Desktop')
    })

    it('throws when calling tool on disconnected server', async () => {
      const client = new WebMcpClient()
      await expect(client.callTool({
        name: 'remote-server::my_tool',
        arguments: {},
      })).rejects.toThrow('not connected or not available')
    })

    it('reports stdio servers as stopped with helpful message in getRuntimeStatus', async () => {
      const store = useMcpWebConfigStore()
      await store.updateConfig({
        mcpServers: {
          'local-tool': { command: 'npx', args: [] },
          'remote-tool': { url: 'https://example.com/mcp', enabled: true },
        },
      })

      const client = new WebMcpClient()
      const status = await client.getRuntimeStatus()

      expect(status.servers).toHaveLength(2)
      const stdioStatus = status.servers.find(s => s.name === 'local-tool')
      expect(stdioStatus).toBeDefined()
      expect(stdioStatus?.state).toBe('stopped')
      expect(stdioStatus?.transport).toBe('stdio')
      expect(stdioStatus?.lastError).toContain('Desktop')

      const httpStatus = status.servers.find(s => s.name === 'remote-tool')
      expect(httpStatus).toBeDefined()
      expect(httpStatus?.transport).toBe('http')
    })
  })

  describe('useMcpWebConfigStore persistence', () => {
    it('updates, reads, and deletes server configs', async () => {
      const store = useMcpWebConfigStore()

      await store.setServer('custom-server', {
        url: 'https://mcp.api.dev',
        headers: { Authorization: 'Bearer test' },
      })

      const server = store.mcpServers['custom-server']
      expect(server).toBeDefined()
      expect(isHttpServerConfig(server)).toBe(true)
      if (isHttpServerConfig(server)) {
        expect(server.url).toBe('https://mcp.api.dev')
      }

      const config = await store.getConfig()
      expect(config.mcpServers['custom-server']).toBeDefined()

      await store.removeServer('custom-server')
      expect(store.mcpServers['custom-server']).toBeUndefined()
    })
  })
})
