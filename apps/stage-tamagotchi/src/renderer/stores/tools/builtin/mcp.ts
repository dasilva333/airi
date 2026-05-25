import { tryGetMcpToolBridge } from '@proj-airi/stage-ui/stores/mcp-tool-bridge'
import { tool } from '@xsai/tool'
import { z } from 'zod'

const tools = [
  tool({
    description:
      'Discovery: List all tools available on the connected MCP servers. Use this first to see what capabilities are available.',
    execute: async () => {
      console.log('[mcp_list_tools] 🔍 Discovery initiated...')
      try {
        const bridge = tryGetMcpToolBridge()
        if (!bridge) {
          throw new Error('MCP tool bridge is not available in this runtime.')
        }

        const tools = await bridge.listTools()

        const names = tools.map((t) => t.name)
        const servers = [...new Set(tools.map((t) => t.serverName))]

        console.log('[mcp_list_tools] ✅ Discovery complete. Found:', {
          servers,
          tools: names,
          total: tools.length,
        })

        return {
          names,
          servers,
          tools,
        }
      } catch (error) {
        console.warn('[mcp_list_tools] ❌ Failed to list tools:', error)
        return { error: String(error) }
      }
    },
    name: 'mcp_list_tools',
    parameters: z.object({}).strict(),
  }),
  tool({
    description:
      'Execution: Call a specific tool on an MCP server. Requires a qualified name in "server::tool" format (found via mcp_list_tools).',
    execute: async ({ name, parameters }) => {
      console.log(`[mcp_call_tool] 🚀 Calling tool "${name}"...`, { parameters })

      // FORGIVENESS: If the model gets confused and tries to "call" the listing tool, redirect it.
      if (name === 'mcp_list_tools') {
        console.log('[mcp_call_tool] 💡 FORGIVENESS: Redirecting list request to discovery bridge...')
        try {
          const bridge = tryGetMcpToolBridge()
          if (!bridge) {
            throw new Error('MCP tool bridge is not available in this runtime.')
          }

          const result = await bridge.listTools()
          return {
            names: result.map((t) => t.name),
            servers: [...new Set(result.map((t) => t.serverName))],
            tools: result,
          }
        } catch (e) {
          console.error('[mcp_call_tool] ❌ Redirected list failed:', e)
          return { content: [{ text: 'Failed to list tools during rescue redirection.', type: 'text' }], isError: true }
        }
      }

      try {
        const parametersObject = Object.fromEntries(parameters.map(({ name, value }) => [name, value]))
        const bridge = tryGetMcpToolBridge()
        if (!bridge) {
          throw new Error('MCP tool bridge is not available in this runtime.')
        }

        console.log(`[mcp_call_tool] 🌉 Bridge found, executing "${name}"...`)

        const result = await bridge.callTool({
          arguments: parametersObject,
          name,
        })

        console.log(`[mcp_call_tool] ✅ Result for "${name}":`, result)
        return result satisfies {
          content?: Record<string, unknown>[]
          isError?: boolean
          structuredContent?: Record<string, unknown>
          toolResult?: unknown
        }
      } catch (error) {
        console.error(`[mcp_call_tool] ❌ Error calling "${name}":`, error)
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              text: message,
              type: 'text',
            },
          ],
          isError: true,
        }
      }
    },
    name: 'mcp_call_tool',
    parameters: z
      .object({
        name: z.string().describe('The qualified tool name to call. Use format "<serverName>::<toolName>"'),
        parameters: z
          .array(
            z
              .object({
                name: z.string().describe('The name of the parameter'),
                value: z.unknown().describe('The value of the parameter'),
              })
              .strict(),
          )
          .describe('The parameters to pass to the tool'),
      })
      .strict(),
  }),
]

export const mcpTools = async () => Promise.all(tools)
