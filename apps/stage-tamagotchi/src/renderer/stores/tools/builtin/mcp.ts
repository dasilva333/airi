import type { ElectronMcpToolDescriptor } from '../../../../shared/eventa'

import z from 'zod'

import { tryGetMcpToolBridge } from '@proj-airi/stage-ui/stores/mcp-tool-bridge'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { tool } from '@xsai/tool'

function filterToolsForCard(rawTools: ElectronMcpToolDescriptor[]): ElectronMcpToolDescriptor[] {
  const cardStore = useAiriCardStore()
  const allowedTools = cardStore.activeCard?.extensions?.airi?.generation?.known?.allowedTools
  if (!allowedTools) {
    return []
  }
  if (allowedTools.includes('mcp')) {
    return rawTools
  }
  return rawTools.filter((t) => {
    const sName = t.serverName.toLowerCase()
    const isWebSearch = sName.includes('websearch') || sName.includes('web-search') || sName.includes('search')
    const isFilesystem = sName.includes('filesystem')
    const isMusic = sName.includes('audio-server') || sName.includes('audio_server')

    if (isWebSearch && (allowedTools.includes('web_search') || allowedTools.includes('mcp_web_search'))) {
      return true
    }
    if (isFilesystem && (allowedTools.includes('filesystem') || allowedTools.includes('mcp_filesystem'))) {
      return true
    }
    if (isMusic && (allowedTools.includes('music') || allowedTools.includes('mcp_music'))) {
      return true
    }
    return false
  })
}

const tools = [
  tool({
    name: 'mcp_list_tools',
    description: 'Discovery: List all tools available on the connected MCP servers. Use this first to see what capabilities are available.',
    execute: async () => {
      console.info('[mcp_list_tools] 🔍 Discovery initiated...')
      try {
        const bridge = tryGetMcpToolBridge()
        if (!bridge) {
          throw new Error('MCP tool bridge is not available in this runtime.')
        }

        const rawTools = await bridge.listTools()
        const tools = filterToolsForCard(rawTools)

        const names = tools.map(t => t.name)
        const servers = [...new Set(tools.map(t => t.serverName))]

        console.info('[mcp_list_tools] ✅ Discovery complete. Found:', {
          total: tools.length,
          servers,
          tools: names,
        })

        return {
          tools,
          names,
          servers,
        }
      }
      catch (error) {
        console.warn('[mcp_list_tools] ❌ Failed to list tools:', error)
        return { error: String(error) }
      }
    },
    parameters: z.object({}).strict(),
  }),
  tool({
    name: 'mcp_call_tool',
    description: 'Execution: Call a specific tool on an MCP server. Requires a qualified name in "server::tool" format (found via mcp_list_tools).',
    execute: async ({ name, parameters }) => {
      console.info(`[mcp_call_tool] 🚀 Calling tool "${name}"...`, { parameters })

      // FORGIVENESS: If the model gets confused and tries to "call" the listing tool, redirect it.
      if (name === 'mcp_list_tools') {
        console.info('[mcp_call_tool] 💡 FORGIVENESS: Redirecting list request to discovery bridge...')
        try {
          const bridge = tryGetMcpToolBridge()
          if (!bridge) {
            throw new Error('MCP tool bridge is not available in this runtime.')
          }

          const rawTools = await bridge.listTools()
          const tools = filterToolsForCard(rawTools)
          return {
            tools,
            names: tools.map(t => t.name),
            servers: [...new Set(tools.map(t => t.serverName))],
          }
        }
        catch (e) {
          console.error('[mcp_call_tool] ❌ Redirected list failed:', e)
          return { isError: true, content: [{ type: 'text', text: 'Failed to list tools during rescue redirection.' }] }
        }
      }

      try {
        const bridge = tryGetMcpToolBridge()
        if (!bridge) {
          throw new Error('MCP tool bridge is not available in this runtime.')
        }

        const rawTools = await bridge.listTools()
        const allowed = filterToolsForCard(rawTools)
        if (!allowed.some(t => t.name === name)) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Tool "${name}" is not permitted or enabled for this character card.` }],
          }
        }

        const parametersObject = Object.fromEntries(parameters.map(({ name, value }) => [name, value]))

        console.info(`[mcp_call_tool] 🌉 Bridge found, executing "${name}"...`)

        const result = await bridge.callTool({
          name,
          arguments: parametersObject,
        })

        console.info(`[mcp_call_tool] ✅ Result for "${name}":`, result)
        return result satisfies {
          content?: Record<string, unknown>[]
          isError?: boolean
          structuredContent?: Record<string, unknown>
          toolResult?: unknown
        }
      }
      catch (error) {
        console.error(`[mcp_call_tool] ❌ Error calling "${name}":`, error)
        const message = error instanceof Error ? error.message : String(error)
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        }
      }
    },
    parameters: z.object({
      name: z.string().describe('The qualified tool name to call. Use format "<serverName>::<toolName>"'),
      parameters: z.array(z.object({
        name: z.string().describe('The name of the parameter'),
        value: z.unknown().describe('The value of the parameter'),
      }).strict()).describe('The parameters to pass to the tool'),
    }).strict(),
  }),
]

export const mcpTools = async () => Promise.all(tools)
