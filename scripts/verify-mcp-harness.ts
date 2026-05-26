import { readFile } from 'node:fs/promises'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

// --- MOCKED/COPIED FROM PROJECT ---

// From packages/stage-ui/src/stores/mcp-tool-bridge.ts

// From packages/stage-ui/src/stores/modules/live-session.ts (Hardened Logic)
function mapAiriToolToGemini(tool: any): Record<string, unknown> {
  const params = tool.function.parameters
    ? JSON.parse(JSON.stringify(tool.function.parameters))
    : { properties: {}, type: 'object' }
  const cleanSchema = (obj: any) => {
    if (!obj || typeof obj !== 'object') return
    delete obj.$schema
    delete obj.additionalProperties
    if (obj.properties) {
      Object.values(obj.properties).forEach(cleanSchema)
    }
    if (obj.items) {
      cleanSchema(obj.items)
    }
  }
  cleanSchema(params)
  if (params.type !== 'object') params.type = 'object'
  if (!params.properties) params.properties = {}
  return {
    description: tool.function.description || '',
    name: tool.function.name,
    parameters: params,
  }
}

// --- HARNESS LOGIC ---

async function runHarness() {
  const configPath = 'c:/Users/h4rdc/.gemini/antigravity/mcp_config.json'
  console.log(`[Harness] Reading config from ${configPath}...`)

  const configRaw = await readFile(configPath, 'utf-8')
  const config = JSON.parse(configRaw)

  const archivistConfig = config.mcpServers.archivist
  if (!archivistConfig) {
    throw new Error('Archivist server not found in config')
  }

  console.log(`[Harness] Starting archivist server: ${archivistConfig.command} ${archivistConfig.args.join(' ')}`)

  const transport = new StdioClientTransport({
    args: archivistConfig.args,
    command: archivistConfig.command,
    env: archivistConfig.env,
  })

  const client = new Client({
    name: 'harness-mcp-gemini',
    version: '1.0.0',
  })

  try {
    await client.connect(transport)
    console.log('[Harness] Connected to MCP server!')

    // 1. Simulate mcp_list_tools execute logic
    console.log('[Harness] Listing tools...')
    const response = await client.listTools()

    // Convert to project's McpToolDescriptor format
    const descriptors = response.tools.map((t) => ({
      description: t.description,
      inputSchema: t.inputSchema,
      name: `archivist::${t.name}`,
      serverName: 'archivist',
      toolName: t.name,
    }))

    console.log(`[Harness] Found ${descriptors.length} tools.`)

    // 2. Simulate AIRI tool creation (xsai tool wrapper)
    // We'll just create a mock AIRI tool object for mcp_list_tools itself first
    const mcpListToolsAiri = {
      function: {
        description: 'List all tools available on the connected MCP servers',
        name: 'mcp_list_tools',
        parameters: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          additionalProperties: false,
          properties: {},
          required: [],
          type: 'object',
        },
      },
    }

    // 3. Test the mapping
    console.log('\n--- VERIFICATION: mcp_list_tools (Empty Params) ---')
    const purifiedList = mapAiriToolToGemini(mcpListToolsAiri)
    console.log(JSON.stringify(purifiedList, null, 2))

    // 4. Test calling an actual tool
    const targetToolName = 'catalog_list' // Raw name as returned by server
    const hasCatalogList = descriptors.some((t) => t.toolName === targetToolName)

    if (hasCatalogList) {
      console.log(`\n[Harness] --- VERIFICATION: Calling ${targetToolName} ---`)
      try {
        const result = await client.callTool({
          arguments: {}, // Assuming catalog_list takes no mandatory args or we just test empty
          name: targetToolName,
        })
        console.log('[Harness] Call Result:', JSON.stringify(result, null, 2))
      } catch (callErr) {
        console.error(`[Harness] Call Error on ${targetToolName}:`, callErr)
      }
    } else {
      console.log(`\n[Harness] Tool '${targetToolName}' not found on server. Cannot test execution.`)
    }

    console.log('\n[Harness] All verification steps completed successfully!')
  } catch (err) {
    console.error('[Harness] Error:', err)
  } finally {
    await client.close()
  }
}

runHarness()
