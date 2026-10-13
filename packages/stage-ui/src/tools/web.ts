import type { Tool } from '@xsai/shared-chat'

import { createBashTool } from '../stores/modules/tools/bash'
import { createTextJournalTool } from '../stores/modules/tools/text-journal'
import { mcpTools } from './mcp'

/**
 * Built-in tool suite for Web and Pocket runtimes.
 *
 * Provides browser-safe tools that operate without native Electron dependencies:
 * 1. In-Memory POSIX Workstation (`bash`) powered by `just-bash` + WebAssembly.
 * 2. Sacred Long-Term Text Journal (`text_journal`) powered by browser IndexedDB.
 * 3. Remote Model Context Protocol (`mcp_list_tools`, `mcp_call_tool`) via browser HTTP/SSE.
 */
export async function webTools(): Promise<Tool[]> {
  const toolPromises: Promise<Tool | Tool[]>[] = [
    createBashTool(),
    createTextJournalTool(),
    mcpTools(),
  ]

  const results = await Promise.all(toolPromises)
  return results.flat()
}
