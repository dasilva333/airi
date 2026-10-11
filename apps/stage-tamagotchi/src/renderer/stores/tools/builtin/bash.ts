import type { Tool } from '@xsai/shared-chat'

import { getSandboxManager } from '@proj-airi/stage-ui/libs/sandbox'
import {
  bashParams,
  createBashTool,
  executeBashCommand,
} from '@proj-airi/stage-ui/stores'

export {
  bashParams,
  createBashTool,
  executeBashCommand,
}

const tools: Promise<Tool>[] = [
  Promise.resolve(createBashTool()),
]

export async function bashTools() {
  void getSandboxManager()
  return Promise.all(tools)
}
