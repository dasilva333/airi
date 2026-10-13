import type { ExecResult, ResolvedCommandContext } from 'just-bash'

import type { System1Response } from '../providers/types'

import { getActivePinia } from 'pinia'

import { JEV_TRIAGE_SCHEMA, useSystemOneStore } from '../../stores/modules/system-one'

function decodeBytesToUtf8(bytes: any): string {
  const str = String(bytes ?? '')
  if (!str)
    return ''
  let hasHighByte = false
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code > 255)
      return str
    if (code > 127)
      hasHighByte = true
  }
  if (!hasHighByte)
    return str
  const rawBytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    rawBytes[i] = str.charCodeAt(i)
  }
  try {
    return new TextDecoder().decode(rawBytes)
  }
  catch {
    return str
  }
}

export interface SystemOneBridge {
  execute: (
    state: string | object,
    questions: Record<string, any>,
    modelOverride?: string,
    options?: { signal?: AbortSignal },
  ) => Promise<System1Response>
  runTriage?: (query: string, options?: { signal?: AbortSignal }) => Promise<any>
  configured?: boolean
  lastLatencyMs?: number | null
}

let explicitBridge: SystemOneBridge | null = null

export function setSystemOneBridge(bridge: SystemOneBridge | null): void {
  explicitBridge = bridge
}

export function clearSystemOneBridge(): void {
  explicitBridge = null
}

export function getSystemOne(): SystemOneBridge {
  if (explicitBridge)
    return explicitBridge

  if (typeof window !== 'undefined' && (window as any).__AIRI_SYSTEM_ONE_BRIDGE__)
    return (window as any).__AIRI_SYSTEM_ONE_BRIDGE__

  if (getActivePinia()) {
    try {
      const store = useSystemOneStore()
      return {
        execute: (state, questions, model, options) => store.execute(state, questions, model, options),
        runTriage: (query, options) => store.runTriage(query, options),
        get configured() { return store.configured },
        get lastLatencyMs() { return store.lastLatencyMs },
      }
    }
    catch {
      // Pinia active but store resolution failed
    }
  }

  throw new Error('System 1 decision engine is not available in this runtime. Ensure System 1 is configured in Settings > System 1.')
}

export interface VirtualJevModule {
  is: (
    predicate: string,
    context?: string | object,
    options?: { threshold?: number, model?: string, signal?: AbortSignal },
  ) => Promise<boolean>
  choose: (
    question: string,
    context: string | object,
    choices: string[] | Record<string, string>,
    config?: { model?: string, signal?: AbortSignal },
  ) => Promise<string>
  score: (
    question: string,
    context?: string | object,
    options?: { min?: number, max?: number, model?: string, signal?: AbortSignal },
  ) => Promise<number>
  decide: (
    context: string | object,
    questions: Record<string, any>,
    options?: { model?: string, signal?: AbortSignal },
  ) => Promise<Record<string, any>>
  triage: (
    query: string,
    options?: { signal?: AbortSignal },
  ) => Promise<any>
}

export function createVirtualJevEnvironment(): VirtualJevModule {
  return {
    is: async (predicate, context = '', options = {}) => {
      if (!predicate || typeof predicate !== 'string')
        throw new Error('jev.is: predicate must be a non-empty string')

      const s1 = getSystemOne()
      const state = typeof context === 'object' ? JSON.stringify(context, null, 2) : (context || 'Context: none')
      const res = await s1.execute(
        state,
        {
          predicate_check: {
            type: 'noul',
            instructions: predicate,
          },
        },
        options.model,
        { signal: options.signal },
      )
      const prob = res.answers?.predicate_check?.noul ?? 0.0
      const threshold = options.threshold ?? 0.5
      return prob >= threshold
    },

    choose: async (question, context, choices, config = {}) => {
      if (!question || typeof question !== 'string')
        throw new Error('jev.choose: question must be a non-empty string')

      const s1 = getSystemOne()
      const state = typeof context === 'object' ? JSON.stringify(context, null, 2) : (context || 'Context: none')
      let criteria: Record<string, string> = {}
      if (Array.isArray(choices)) {
        if (choices.length === 0)
          throw new Error('jev.choose: choices array must not be empty')
        criteria = Object.fromEntries(choices.map(c => [String(c), String(c)]))
      }
      else if (choices && typeof choices === 'object') {
        criteria = { ...choices }
      }
      else {
        throw new Error('jev.choose: choices must be an array of strings or criteria record')
      }

      const res = await s1.execute(
        state,
        {
          choice_decision: {
            type: 'choice',
            instructions: question,
            criteria,
          },
        },
        config.model,
        { signal: config.signal },
      )
      return res.answers?.choice_decision?.choice ?? ''
    },

    score: async (question, context = '', options = {}) => {
      if (!question || typeof question !== 'string')
        throw new Error('jev.score: question must be a non-empty string')

      const s1 = getSystemOne()
      const state = typeof context === 'object' ? JSON.stringify(context, null, 2) : (context || 'Context: none')
      const min = options.min ?? 0
      const max = options.max ?? 10
      const res = await s1.execute(
        state,
        {
          score_eval: {
            type: 'score',
            instructions: question,
            min,
            max,
          },
        },
        options.model,
        { signal: options.signal },
      )
      return res.answers?.score_eval?.score ?? 0
    },

    decide: async (context, questions, options = {}) => {
      if (!questions || typeof questions !== 'object')
        throw new Error('jev.decide: questions schema object is required')

      const s1 = getSystemOne()
      const state = typeof context === 'object' ? JSON.stringify(context, null, 2) : (context || 'Context: none')
      const res = await s1.execute(state, questions, options.model, { signal: options.signal })
      return res.answers || {}
    },

    triage: async (query, options = {}) => {
      if (!query || typeof query !== 'string')
        throw new Error('jev.triage: query string is required')

      const s1 = getSystemOne()
      if (typeof s1.runTriage === 'function')
        return await s1.runTriage(query, options)

      const res = await s1.execute(`Query to classify: ${query}`, JEV_TRIAGE_SCHEMA, undefined, options)
      return res.answers || {}
    },
  }
}

async function resolveContext(candidate: string | undefined, ctx: ResolvedCommandContext): Promise<string> {
  if (candidate) {
    const fullPath = candidate.startsWith('/') ? candidate : `${ctx.cwd || '/workspace'}/${candidate}`
    try {
      if (await ctx.fs.exists(fullPath)) {
        const stat = await ctx.fs.stat(fullPath)
        if (!stat.isDirectory) {
          return await ctx.fs.readFile(fullPath)
        }
      }
    }
    catch {
      // Not a valid file path, treat candidate as inline text
    }
    return candidate
  }

  if (ctx.stdin) {
    try {
      const decoded = decodeBytesToUtf8(ctx.stdin)
      if (decoded && decoded.trim().length > 0) {
        return decoded
      }
    }
    catch {
      // Failed to decode stdin as UTF-8
    }
  }

  return ''
}

export async function handleJevCommand(args: string[], ctx: ResolvedCommandContext): Promise<ExecResult> {
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    return {
      stdout: `Usage:
  jev is <predicate> [input|file] [--threshold <0.0-1.0>] [--json] [--model <name>]
  jev choose <question> --options <opt1,opt2,...> [input|file] [--json] [--model <name>]
  jev score <question> [input|file] [--min <min>] [--max <max>] [--json] [--model <name>]
  jev triage <query> [--json]
  jev decide <schema.json|json_str> [input|file] [--model <name>]

Semantic Shell Predicates:
  'jev is' returns exit code 0 when true (prob >= threshold, default 0.5), and exit code 1 when false.
  All commands accept context from inline arguments, file paths, or stdin pipelines.

Examples:
  cat /workspace/build.log | jev is "Does this build log contain a fatal compiler panic?"
  if jev is "Is this user message urgent?" /workspace/message.txt; then echo "Urgent!"; fi
  jev choose "Select triage priority" --options low,medium,high,critical "$ALERT"
  cat document.txt | jev score "Score writing clarity" --min 1 --max 10
  jev triage "When did we first meet Pen-Pen?" --json
`,
      stderr: '',
      exitCode: 0,
    }
  }

  const isJson = args.includes('--json')
  const isQuiet = args.includes('-q') || args.includes('--quiet')

  function getFlag(flag: string, alias?: string): string | undefined {
    const idx = args.findIndex(a => a === flag || (alias && a === alias))
    if (idx !== -1 && idx + 1 < args.length) {
      return args[idx + 1]
    }
    return undefined
  }

  const flagsWithValues = new Set(['--threshold', '-t', '--min', '--max', '--options', '-o', '--model', '-m'])
  const positional: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (flagsWithValues.has(arg)) {
      i++ // Skip value
      continue
    }
    if (arg === '--json' || arg === '-q' || arg === '--quiet') {
      continue
    }
    positional.push(arg)
  }

  const subcommand = positional[0]
  const modelOverride = getFlag('--model', '-m')

  try {
    if (subcommand === 'is') {
      const predicate = positional[1]
      if (!predicate) {
        return {
          stdout: '',
          stderr: 'jev: missing predicate statement. Usage: jev is <predicate> [input|file]\n',
          exitCode: 1,
        }
      }

      const rawThreshold = getFlag('--threshold', '-t')
      const threshold = rawThreshold ? Number.parseFloat(rawThreshold) : 0.5
      if (Number.isNaN(threshold)) {
        return {
          stdout: '',
          stderr: `jev: invalid threshold value '${rawThreshold}'. Must be a number between 0.0 and 1.0.\n`,
          exitCode: 1,
        }
      }

      const context = await resolveContext(positional[2], ctx)
      const s1 = getSystemOne()
      const res = await s1.execute(
        context || 'Context: none',
        {
          predicate_check: {
            type: 'noul',
            instructions: predicate,
          },
        },
        modelOverride,
      )

      const prob = res.answers?.predicate_check?.noul ?? 0.0
      const passed = prob >= threshold

      if (isQuiet) {
        return {
          stdout: '',
          stderr: '',
          exitCode: passed ? 0 : 1,
        }
      }

      if (isJson) {
        const jsonOut = {
          result: passed,
          probability: prob,
          threshold,
          latencyMs: s1.lastLatencyMs ?? null,
        }
        return {
          stdout: `${JSON.stringify(jsonOut, null, 2)}\n`,
          stderr: '',
          exitCode: passed ? 0 : 1,
        }
      }

      return {
        stdout: `${passed ? 'true' : 'false'}\n`,
        stderr: '',
        exitCode: passed ? 0 : 1,
      }
    }

    if (subcommand === 'choose') {
      const question = positional[1]
      if (!question) {
        return {
          stdout: '',
          stderr: 'jev: missing question. Usage: jev choose <question> --options <opt1,opt2,...> [input|file]\n',
          exitCode: 1,
        }
      }

      const rawOptions = getFlag('--options', '-o')
      if (!rawOptions) {
        return {
          stdout: '',
          stderr: 'jev: missing --options flag. Specify candidates as: --options opt1,opt2,opt3\n',
          exitCode: 1,
        }
      }

      const optionsList = rawOptions.split(',').map(s => s.trim()).filter(Boolean)
      if (optionsList.length === 0) {
        return {
          stdout: '',
          stderr: 'jev: --options list cannot be empty\n',
          exitCode: 1,
        }
      }

      const context = await resolveContext(positional[2], ctx)
      const criteria = Object.fromEntries(optionsList.map(o => [o, o]))
      const s1 = getSystemOne()
      const res = await s1.execute(
        context || 'Context: none',
        {
          choice_decision: {
            type: 'choice',
            instructions: question,
            criteria,
          },
        },
        modelOverride,
      )

      const choice = res.answers?.choice_decision?.choice ?? ''
      if (isJson) {
        const jsonOut = {
          choice,
          options: optionsList,
          confidence: res.answers?.choice_decision?.confidence ?? null,
          latencyMs: s1.lastLatencyMs ?? null,
        }
        return {
          stdout: `${JSON.stringify(jsonOut, null, 2)}\n`,
          stderr: '',
          exitCode: 0,
        }
      }

      return {
        stdout: `${choice}\n`,
        stderr: '',
        exitCode: 0,
      }
    }

    if (subcommand === 'score') {
      const question = positional[1]
      if (!question) {
        return {
          stdout: '',
          stderr: 'jev: missing question. Usage: jev score <question> [input|file] [--min <min>] [--max <max>]\n',
          exitCode: 1,
        }
      }

      const rawMin = getFlag('--min')
      const rawMax = getFlag('--max')
      const min = rawMin ? Number.parseFloat(rawMin) : 0
      const max = rawMax ? Number.parseFloat(rawMax) : 10

      const context = await resolveContext(positional[2], ctx)
      const s1 = getSystemOne()
      const res = await s1.execute(
        context || 'Context: none',
        {
          score_eval: {
            type: 'score',
            instructions: question,
            min,
            max,
          },
        },
        modelOverride,
      )

      const score = res.answers?.score_eval?.score ?? 0
      if (isJson) {
        const jsonOut = {
          score,
          min,
          max,
          latencyMs: s1.lastLatencyMs ?? null,
        }
        return {
          stdout: `${JSON.stringify(jsonOut, null, 2)}\n`,
          stderr: '',
          exitCode: 0,
        }
      }

      return {
        stdout: `${score}\n`,
        stderr: '',
        exitCode: 0,
      }
    }

    if (subcommand === 'triage') {
      let query = positional.slice(1).join(' ')
      if (!query && ctx.stdin) {
        try {
          const decoded = decodeBytesToUtf8(ctx.stdin)
          if (decoded && decoded.trim().length > 0) {
            query = decoded.trim()
          }
        }
        catch {}
      }

      if (!query) {
        return {
          stdout: '',
          stderr: 'jev: missing query for triage. Usage: jev triage <query>\n',
          exitCode: 1,
        }
      }

      const s1 = getSystemOne()
      const triageRes = typeof s1.runTriage === 'function'
        ? await s1.runTriage(query)
        : (await s1.execute(`Query to classify: ${query}`, JEV_TRIAGE_SCHEMA)).answers || {}

      if (isJson) {
        return {
          stdout: `${JSON.stringify(triageRes, null, 2)}\n`,
          stderr: '',
          exitCode: 0,
        }
      }

      const category = triageRes.choice || triageRes.category || 'unknown'
      const conf = triageRes.confidence !== undefined ? ` [confidence: ${triageRes.confidence}]` : ''
      let out = `Category: ${category}${conf}\n`
      if (triageRes.temporalSubtype)
        out += `Temporal Subtype: ${triageRes.temporalSubtype}\n`
      if (triageRes.searchScope)
        out += `Search Scope: ${triageRes.searchScope}\n`
      if (triageRes.conjunctionStructure)
        out += `Conjunction Structure: ${triageRes.conjunctionStructure}\n`
      if (triageRes.requiresDecomposition !== undefined)
        out += `Requires Decomposition: ${triageRes.requiresDecomposition}\n`

      return {
        stdout: out,
        stderr: '',
        exitCode: 0,
      }
    }

    if (subcommand === 'decide') {
      const rawSchema = positional[1]
      if (!rawSchema) {
        return {
          stdout: '',
          stderr: 'jev: missing schema JSON or file path. Usage: jev decide <schema.json|json_str> [input|file]\n',
          exitCode: 1,
        }
      }

      let schemaContent = rawSchema
      const fullPath = rawSchema.startsWith('/') ? rawSchema : `${ctx.cwd || '/workspace'}/${rawSchema}`
      try {
        if (await ctx.fs.exists(fullPath)) {
          const stat = await ctx.fs.stat(fullPath)
          if (!stat.isDirectory) {
            schemaContent = await ctx.fs.readFile(fullPath)
          }
        }
      }
      catch {}

      let schemaObj: Record<string, any>
      try {
        schemaObj = JSON.parse(schemaContent)
      }
      catch (err: any) {
        return {
          stdout: '',
          stderr: `jev: invalid schema JSON: ${err.message}\n`,
          exitCode: 1,
        }
      }

      const context = await resolveContext(positional[2], ctx)
      const s1 = getSystemOne()
      const res = await s1.execute(context || 'Context: none', schemaObj, modelOverride)

      return {
        stdout: `${JSON.stringify(res.answers || {}, null, 2)}\n`,
        stderr: '',
        exitCode: 0,
      }
    }

    return {
      stdout: '',
      stderr: `jev: unknown command '${subcommand}'. Run 'jev --help' for usage.\n`,
      exitCode: 1,
    }
  }
  catch (err: any) {
    return {
      stdout: '',
      stderr: `jev: ${err.message || String(err)}\n`,
      exitCode: 1,
    }
  }
}
