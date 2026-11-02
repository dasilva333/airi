#!/usr/bin/env node

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'

export type AssistantState = 'work' | 'wait' | 'done' | 'idle' | 'error'

export interface AssistantStatePayload {
  state: AssistantState
  source?: string
  sessionId?: string
  headline?: string
  note?: string
  tool?: string
  updatedAt?: number
}

export interface AssistantCliOptions {
  state?: AssistantState
  source?: string
  sessionId?: string
  headline?: string
  note?: string
  tool?: string
  port?: number
  host?: string
  token?: string
  verbose?: boolean
}

/**
 * Parses raw CLI arguments into typed options and positional command.
 */
export function parseArgs(argv: string[]): { command: string, target?: string, options: AssistantCliOptions } {
  const args = argv.slice(2)
  let command = 'notify'
  let target: string | undefined
  const options: AssistantCliOptions = {
    source: 'custom',
    port: process.env.AIRI_PORT ? Number.parseInt(process.env.AIRI_PORT, 10) : 6121,
    host: process.env.AIRI_HOST || '127.0.0.1',
    token: process.env.AIRI_AUTH_TOKEN || '',
    verbose: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === 'notify' || arg === 'install' || arg === 'test' || arg === 'help') {
      command = arg
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        target = args[++i]
      }
    }
    else if (arg === '--state' || arg === '-s') {
      options.state = args[++i] as AssistantState
    }
    else if (arg === '--source') {
      options.source = args[++i]
    }
    else if (arg === '--session' || arg === '--sessionId') {
      options.sessionId = args[++i]
    }
    else if (arg === '--headline' || arg === '-h') {
      options.headline = args[++i]
    }
    else if (arg === '--note' || arg === '-n') {
      options.note = args[++i]
    }
    else if (arg === '--tool' || arg === '-t') {
      options.tool = args[++i]
    }
    else if (arg === '--port' || arg === '-p') {
      options.port = Number.parseInt(args[++i], 10)
    }
    else if (arg === '--host') {
      options.host = args[++i]
    }
    else if (arg === '--token') {
      options.token = args[++i]
    }
    else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true
    }
  }

  return { command, target, options }
}

/**
 * Normalizes input from stdin (e.g. Antigravity or Claude Code lifecycle hook payloads).
 */
export function parseStdinContext(raw: string): Partial<AssistantStatePayload> {
  try {
    const data = JSON.parse(raw.trim())
    if (!data || typeof data !== 'object')
      return {}

    // Direct AssistantStatePayload
    if (data.state && ['work', 'wait', 'done', 'idle', 'error'].includes(data.state)) {
      return data
    }

    // Antigravity Hook Payload Parsing
    if (data.toolCall) {
      const toolName = data.toolCall.name || 'tool'
      return {
        state: 'wait',
        headline: 'Approval requested',
        note: `Execute ${toolName}?`,
        tool: toolName,
      }
    }

    if (data.error) {
      return {
        state: 'error',
        headline: 'Tool failed',
        note: String(data.error),
      }
    }

    if (data.lastUserInput) {
      return {
        state: 'work',
        headline: 'Thinking...',
        note: data.lastUserInput.slice(0, 80),
      }
    }

    // Claude Code Hook Payload Parsing
    if (data.event) {
      if (data.event === 'PreToolUse') {
        return {
          state: 'wait',
          headline: 'Approval needed',
          tool: data.toolName,
          note: data.toolName ? `Execute ${data.toolName}?` : undefined,
        }
      }
      if (data.event === 'UserPromptSubmit' || data.event === 'PostToolUse') {
        return {
          state: 'work',
          headline: 'Claude is working...',
        }
      }
      if (data.event === 'Stop') {
        return {
          state: 'done',
          headline: 'Turn complete',
        }
      }
    }

    return {}
  }
  catch {
    return {}
  }
}

/**
 * Dispatches the state payload to the AIRI HTTP ingestion endpoint.
 */
export async function sendAssistantState(
  payload: AssistantStatePayload,
  options: AssistantCliOptions,
): Promise<{ ok: boolean, status?: number, error?: string }> {
  const host = options.host || '127.0.0.1'
  const port = options.port || 6121
  const url = `http://${host}:${port}/api/assistant/state`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        updatedAt: payload.updatedAt || Date.now(),
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (options.verbose) {
      console.error(`[airi-assistant] Dispatched state=${payload.state} -> HTTP ${res.status}`)
    }

    return { ok: res.ok, status: res.status }
  }
  catch (err: any) {
    if (options.verbose) {
      console.error(`[airi-assistant] Failed to reach AIRI endpoint at ${url}: ${err.message}`)
    }
    return { ok: false, error: err.message }
  }
}

/**
 * Reads all data from standard input if piped.
 */
export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY)
    return ''

  return new Promise((resolve) => {
    let result = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', chunk => result += chunk)
    process.stdin.on('end', () => resolve(result))
    process.stdin.on('error', () => resolve(''))
  })
}

/**
 * Installs Claude Code hooks into ~/.claude/settings.json.
 */
export function installClaudeCodeHooks(options: AssistantCliOptions): { success: boolean, message: string } {
  try {
    const claudeDir = path.join(os.homedir(), '.claude')
    const settingsPath = path.join(claudeDir, 'settings.json')

    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true })
    }

    let settings: any = {}
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
        // Create backup
        fs.writeFileSync(`${settingsPath}.bak`, JSON.stringify(settings, null, 2), 'utf-8')
      }
      catch {
        settings = {}
      }
    }

    if (!settings.hooks || typeof settings.hooks !== 'object') {
      settings.hooks = {}
    }

    const port = options.port || 6121
    const authHeader = options.token ? `-H "Authorization: Bearer ${options.token}" ` : ''

    settings.hooks.UserPromptSubmit = [
      {
        type: 'command',
        command: `curl -s -X POST http://127.0.0.1:${port}/api/assistant/state ${authHeader}-H "Content-Type: application/json" -d '{"source":"claude-code","state":"work","headline":"Claude is thinking..."}' >/dev/null 2>&1 &`,
      },
    ]

    settings.hooks.PreToolUse = [
      {
        type: 'command',
        command: `curl -s -X POST http://127.0.0.1:${port}/api/assistant/state ${authHeader}-H "Content-Type: application/json" -d '{"source":"claude-code","state":"wait","headline":"Tool approval requested"}' >/dev/null 2>&1 &`,
      },
    ]

    settings.hooks.PostToolUse = [
      {
        type: 'command',
        command: `curl -s -X POST http://127.0.0.1:${port}/api/assistant/state ${authHeader}-H "Content-Type: application/json" -d '{"source":"claude-code","state":"work","headline":"Claude is executing..."}' >/dev/null 2>&1 &`,
      },
    ]

    settings.hooks.Stop = [
      {
        type: 'command',
        command: `curl -s -X POST http://127.0.0.1:${port}/api/assistant/state ${authHeader}-H "Content-Type: application/json" -d '{"source":"claude-code","state":"done","headline":"Turn completed"}' >/dev/null 2>&1 &`,
      },
    ]

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
    return {
      success: true,
      message: `Successfully configured Claude Code hooks in ${settingsPath} (backup saved as settings.json.bak)`,
    }
  }
  catch (err: any) {
    return {
      success: false,
      message: `Failed to configure Claude Code hooks: ${err.message}`,
    }
  }
}

/**
 * Installs Antigravity hooks into .agents/hooks.json or ~/.gemini/config/hooks.json.
 */
export function installAntigravityHooks(options: AssistantCliOptions): { success: boolean, message: string } {
  try {
    // Prefer workspace .agents/hooks.json if .agents/ exists, else ~/.gemini/config/hooks.json
    let hooksDir = path.resolve(process.cwd(), '.agents')
    if (!fs.existsSync(hooksDir)) {
      hooksDir = path.join(os.homedir(), '.gemini', 'config')
    }

    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true })
    }

    const hooksPath = path.join(hooksDir, 'hooks.json')
    let config: any = {}

    if (fs.existsSync(hooksPath)) {
      try {
        config = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'))
        fs.writeFileSync(`${hooksPath}.bak`, JSON.stringify(config, null, 2), 'utf-8')
      }
      catch {
        config = {}
      }
    }

    const port = options.port || 6121
    const authHeader = options.token ? `-H "Authorization: Bearer ${options.token}" ` : ''

    config['airi-assistant-sync'] = {
      enabled: true,
      PreInvocation: [
        {
          type: 'command',
          command: `curl -s -X POST http://127.0.0.1:${port}/api/assistant/state ${authHeader}-H "Content-Type: application/json" -d '{"source":"antigravity","state":"work","headline":"Antigravity is thinking..."}' >/dev/null 2>&1 &`,
        },
      ],
      PreToolUse: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: `curl -s -X POST http://127.0.0.1:${port}/api/assistant/state ${authHeader}-H "Content-Type: application/json" -d '{"source":"antigravity","state":"wait","headline":"Tool approval requested"}' >/dev/null 2>&1 &`,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: `curl -s -X POST http://127.0.0.1:${port}/api/assistant/state ${authHeader}-H "Content-Type: application/json" -d '{"source":"antigravity","state":"work","headline":"Executing tool..."}' >/dev/null 2>&1 &`,
            },
          ],
        },
      ],
      Stop: [
        {
          type: 'command',
          command: `curl -s -X POST http://127.0.0.1:${port}/api/assistant/state ${authHeader}-H "Content-Type: application/json" -d '{"source":"antigravity","state":"done","headline":"Task finished"}' >/dev/null 2>&1 &`,
        },
      ],
    }

    fs.writeFileSync(hooksPath, JSON.stringify(config, null, 2), 'utf-8')
    return {
      success: true,
      message: `Successfully configured Antigravity hooks in ${hooksPath} (backup saved as hooks.json.bak)`,
    }
  }
  catch (err: any) {
    return {
      success: false,
      message: `Failed to configure Antigravity hooks: ${err.message}`,
    }
  }
}

/**
 * Main CLI entry point.
 */
export async function main(argv = process.argv): Promise<void> {
  const { command, target, options } = parseArgs(argv)

  if (command === 'help') {
    // eslint-disable-next-line no-console
    console.log(`
AIRI Assistant CLI - Connect AI coding assistants to your AIRI companion

Usage:
  airi-assistant notify [options]       Send a state update to AIRI
  airi-assistant install <agent>        Configure lifecycle hooks for an assistant
  airi-assistant test                   Send a test lifecycle sequence

Agents:
  claude          Configure Claude Code (~/.claude/settings.json)
  antigravity     Configure Google Antigravity (.agents/hooks.json)

Options:
  --state, -s <state>      State (work | wait | done | idle | error) [default: work]
  --source <name>          Source assistant name [default: custom]
  --session <id>           Unique session ID
  --headline, -h <text>    Short status summary
  --note, -n <text>        Detailed explanation or message
  --tool, -t <name>        Active tool name
  --port, -p <number>      AIRI port [default: 6121]
  --token <string>         Bearer authorization token
  --verbose, -v            Print detailed logs
`)
    process.exit(0)
  }

  if (command === 'install') {
    const agent = (target || '').toLowerCase()
    if (agent === 'claude' || agent === 'claude-code') {
      const res = installClaudeCodeHooks(options)
      // eslint-disable-next-line no-console
      console.log(res.message)
      process.exit(res.success ? 0 : 1)
    }
    else if (agent === 'antigravity' || agent === 'agy' || agent === 'gemini') {
      const res = installAntigravityHooks(options)
      // eslint-disable-next-line no-console
      console.log(res.message)
      process.exit(res.success ? 0 : 1)
    }
    else {
      console.error(`Unknown assistant: "${target}". Supported: claude, antigravity`)
      process.exit(1)
    }
  }

  if (command === 'test') {
    // eslint-disable-next-line no-console
    console.log('[airi-assistant] Dispatching test lifecycle sequence...')
    const src = target || options.source || 'test'
    await sendAssistantState({ state: 'work', source: src, headline: 'Starting test...' }, options)
    await new Promise(r => setTimeout(r, 1500))
    await sendAssistantState({ state: 'wait', source: src, headline: 'Needs approval', note: 'Run test suite?' }, options)
    await new Promise(r => setTimeout(r, 1500))
    await sendAssistantState({ state: 'done', source: src, headline: 'All tests passed!' }, options)
    // eslint-disable-next-line no-console
    console.log('[airi-assistant] Test sequence finished.')
    process.exit(0)
  }

  // Default: Notify
  const stdinData = await readStdin()
  const stdinPayload = parseStdinContext(stdinData)

  const payload: AssistantStatePayload = {
    state: options.state || stdinPayload.state || 'work',
    source: options.source || stdinPayload.source || 'custom',
    sessionId: options.sessionId || stdinPayload.sessionId,
    headline: options.headline || stdinPayload.headline,
    note: options.note || stdinPayload.note,
    tool: options.tool || stdinPayload.tool,
  }

  await sendAssistantState(payload, options)

  // For agent hooks that require stdout JSON contract
  if (stdinData) {
    process.stdout.write('{}\n')
  }

  process.exit(0)
}

// Execute when invoked directly
if (process.argv[1] && (process.argv[1].endsWith('assistant.ts') || process.argv[1].endsWith('assistant.mjs'))) {
  main().catch((err) => {
    console.error('[airi-assistant] Uncaught error:', err)
    process.exit(0) // Exit 0 to avoid breaking assistant hooks
  })
}
