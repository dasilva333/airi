import type { Tool } from '@xsai/shared-chat'

import { debug } from '@proj-airi/stage-shared'
import { tryGetMcpToolBridge } from '@proj-airi/stage-ui/stores/mcp-tool-bridge'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useStickersStore } from '@proj-airi/stage-ui/stores/stickers'

import { generateMotionTools } from './generate-motion'
import { imageJournalTools } from './image-journal'
import { mcpTools } from './mcp'
import { stickersTools } from './stickers'
import { textJournalTools } from './text-journal'

export async function builtinTools(): Promise<Tool[]> {
  const artistry = useArtistryStore()
  const stickers = useStickersStore()

  const mcpBridge = tryGetMcpToolBridge()
  let hasMcpServers = false

  if (mcpBridge) {
    try {
      const mcpStatus = await mcpBridge.getRuntimeStatus()
      hasMcpServers = mcpStatus.servers.length > 0
    }
    catch (err) {
      debug('[builtinTools] 🔌 Failed to fetch MCP status, skipping MCP tools:', err)
    }
  }
  else {
    debug('[builtinTools] 🔌 MCP bridge not found, skipping MCP tools.')
  }

  const toolPromises: Promise<Tool[]>[] = []

  // Always register in list (filtered out by llmStore if not allowed)
  toolPromises.push(textJournalTools())
  toolPromises.push(generateMotionTools())

  // Artistry suite
  if (artistry.configured) {
    debug('[builtinTools] 🎨 Artistry configured, keeping image journal (widgets/stage_widgets deprecated).')
    toolPromises.push(imageJournalTools())
  }

  // Stickers library
  if (stickers.currentLibrary.length > 0) {
    debug(`[builtinTools] ✨ Stickers library found (${stickers.currentLibrary.length}), enabling stickers tool.`)
    toolPromises.push(Promise.resolve(stickersTools()))
  }

  // MCP Servers
  if (hasMcpServers) {
    debug('[builtinTools] 🔌 MCP Servers found, enabling mcp tools.')
    toolPromises.push(mcpTools())
  }

  const groups = await Promise.all(toolPromises)
  const flattened = groups.flat()

  debug(`[builtinTools] 🛠️ Total tools registered: ${flattened.length}`)
  return flattened
}
