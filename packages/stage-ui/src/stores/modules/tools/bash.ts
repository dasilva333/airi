import type { Tool } from '@xsai/shared-chat'

import { tool } from '@xsai/tool'
import { z } from 'zod'

import { getSandboxManager } from '../../../libs/sandbox'

export const bashParams = z.object({
  command: z.string().describe(
    'The bash command to execute in the in-memory POSIX workstation (/workspace). Supports pipes, jq, sed, awk, grep, node, tsc, mcp, jev, and mount_widget. Live state projections are available under /workspace/.airi/ (session.json, cognition.json, telemetry.json, messages.json). Call MCP tools directly via `mcp <server::tool> [json_args]` or `require("mcp")` in node. Evaluate fast semantic decisions via `jev is/choose/score` or `require("jev")`.',
  ),
})

export async function executeBashCommand(params: { command: string }): Promise<string> {
  const cmd = params.command?.trim()
  if (!cmd) {
    return 'Error: command parameter is required for bash tool.'
  }

  try {
    const sandbox = await getSandboxManager()
    const result = await sandbox.exec(cmd)

    if (result.exitCode === 0) {
      return result.stdout || '(command completed with exit code 0 and no stdout)'
    }

    return `Exit code: ${result.exitCode}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  }
  catch (err: any) {
    return `Error executing bash command: ${err.message}`
  }
}

export function createBashTool(): Promise<Tool> {
  return tool({
    name: 'bash',
    description: 'Execute bash commands in the in-memory POSIX workstation (/workspace). Inspect live state in /workspace/.airi/*.json with jq/cat, compile TypeScript with tsc, evaluate code with node, call MCP tools with mcp, run fast System 1 semantic predicates with jev, or mount generative widgets with mount_widget.',
    execute: params => executeBashCommand(params as { command: string }),
    parameters: bashParams,
  })
}

export function createMcpBashTool(): Promise<Tool> {
  return tool({
    name: 'mcp_bash',
    description: 'Execute bash commands in the in-memory POSIX workstation (/workspace). Inspect live state in /workspace/.airi/*.json with jq/cat, compile TypeScript with tsc, evaluate code with node, call MCP tools with mcp, run fast System 1 semantic predicates with jev, or mount generative widgets with mount_widget.',
    execute: params => executeBashCommand(params as { command: string }),
    parameters: bashParams,
  })
}
