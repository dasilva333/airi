import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { Action } from '../../libs/mineflayer/action'

import { JavaScriptPlanner } from './js-planner'

function createAction(name: string, schema: Action['schema']): Action {
  return {
    description: `${name} tool`,
    execution: 'sync',
    name,
    perform: () => () => '',
    schema,
  }
}

const actions: Action[] = [
  createAction('chat', z.object({ message: z.string() })),
  createAction(
    'goToPlayer',
    z.object({
      closeness: z.number().min(0),
      player_name: z.string(),
    }),
  ),
]

const actionsWithSkip: Action[] = [createAction('skip', z.object({})), ...actions]

describe('javaScriptPlanner', () => {
  const globals = {
    actionQueue: {
      capacity: { executing: 1, pending: 4, total: 5 },
      counts: { executing: 0, pending: 0, total: 0 },
      executing: null,
      pending: [],
      recent: [],
      updatedAt: Date.now(),
    },
    errorBurstGuard: null,
    event: {
      payload: { type: 'chat_message' },
      source: { id: 'test', type: 'minecraft' },
      timestamp: Date.now(),
      type: 'perception',
    },
    forgetConversation: () => ({ cleared: ['conversationHistory', 'lastLlmInputSnapshot'], ok: true }),
    getNoActionBudget: () => ({
      default: 3,
      max: 8,
      remaining: 3,
    }),
    llmInput: {
      attempt: 1,
      conversationHistory: [{ content: 'previous reply', role: 'assistant' }],
      messages: [{ content: 'hello', role: 'user' }],
      systemPrompt: 'system prompt',
      updatedAt: Date.now(),
      userMessage: 'latest user message',
    },
    noActionBudget: {
      default: 3,
      max: 8,
      remaining: 3,
    },
    patterns: {
      find: (query: string, limit = 10) => {
        if (!query.toLowerCase().includes('torch')) return []
        return [
          {
            code: 'const target = query.blocks().within(32).list().find(b => b.name.includes("torch"));',
            id: 'collect.wall_torch',
            intent: 'Use variant-aware block lookup for torch tasks.',
            steps: ['scan blocks', 'mine exact target'],
            tags: ['torch', 'wall_torch'],
            title: 'Collect Wall Torches Reliably',
            whenToUse: ['torch tasks'],
          },
        ].slice(0, limit)
      },
      get: (id: string) => {
        if (id !== 'collect.wall_torch') return null
        return {
          code: 'const target = query.blocks().within(32).list().find(b => b.name.includes("torch"));',
          id: 'collect.wall_torch',
          intent: 'Use variant-aware block lookup for torch tasks.',
          steps: ['scan blocks', 'mine exact target'],
          tags: ['torch', 'wall_torch'],
          title: 'Collect Wall Torches Reliably',
          whenToUse: ['torch tasks'],
        }
      },
      ids: () => ['collect.wall_torch'],
      list: (limit = 10) =>
        [
          {
            code: 'const target = query.blocks().within(32).list().find(b => b.name.includes("torch"));',
            id: 'collect.wall_torch',
            intent: 'Use variant-aware block lookup for torch tasks.',
            steps: ['scan blocks', 'mine exact target'],
            tags: ['torch', 'wall_torch'],
            title: 'Collect Wall Torches Reliably',
            whenToUse: ['torch tasks'],
          },
        ].slice(0, limit),
    },
    setNoActionBudget: (value: number) => ({
      default: 3,
      max: 8,
      ok: true,
      remaining: Math.max(0, Math.min(8, Math.floor(value))),
    }),
    snapshot: {
      attention: {},
      environment: { nearbyPlayers: [] },
      self: { food: 20, health: 20, location: { x: 0, y: 64, z: 0 } },
      social: {},
      threat: {},
    },
  } as any

  it('maps positional/object args and executes tools in order', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)
    const planned = await planner.evaluate(
      `
      await chat("hello")
      await goToPlayer({ player_name: "Alex", closeness: 2 })
    `,
      actions,
      globals,
      executeAction,
    )

    expect(executeAction).toHaveBeenCalledTimes(2)
    expect(executeAction).toHaveBeenNthCalledWith(1, { params: { message: 'hello' }, tool: 'chat' })
    expect(executeAction).toHaveBeenNthCalledWith(2, {
      params: { closeness: 2, player_name: 'Alex' },
      tool: 'goToPlayer',
    })
    expect(planned.actions.map((a) => a.action)).toEqual([
      { params: { message: 'hello' }, tool: 'chat' },
      { params: { closeness: 2, player_name: 'Alex' }, tool: 'goToPlayer' },
    ])
  })

  it('supports dynamic dispatch with use(toolName, params)', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)
    const planned = await planner.evaluate(`await use("chat", { message: "via-use" })`, actions, globals, executeAction)

    expect(planned.actions.map((a) => a.action)).toEqual([{ params: { message: 'via-use' }, tool: 'chat' }])
  })

  it('persists script variables across turns with mem', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)

    await planner.evaluate('mem.count = 2', actions, globals, executeAction)
    const planned = await planner.evaluate('await chat("count=" + mem.count)', actions, globals, executeAction)

    expect(planned.actions.map((a) => a.action)).toEqual([{ params: { message: 'count=2' }, tool: 'chat' }])
  })

  it('persists typed previous return via prevRun.returnRaw', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)

    await planner.evaluate(
      `
      const inv = [{ name: "oak_log", count: 2 }]
      return inv
    `,
      actions,
      globals,
      executeAction,
    )

    const planned = await planner.evaluate(
      `
      const inv = prevRun.returnRaw
      await chat(inv.map(item => item.count + " " + item.name).join(", "))
    `,
      actions,
      globals,
      executeAction,
    )

    expect(planned.actions.map((a) => a.action)).toEqual([{ params: { message: '2 oak_log' }, tool: 'chat' }])
  })

  it('does not expose stringified return mirror on prevRun', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)

    await planner.evaluate(
      `
      const inv = [{ name: "oak_log", count: 2 }]
      return inv
    `,
      actions,
      globals,
      executeAction,
    )

    const planned = await planner.evaluate(
      'return Object.prototype.hasOwnProperty.call(prevRun, "returnValue")',
      actions,
      globals,
      executeAction,
    )
    expect(planned.returnValue).toBe('false')
  })

  it('provides snapshot globals in script scope', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)
    const planned = await planner.evaluate('await chat("hp=" + self.health)', actions, globals, executeAction)

    expect(planned.actions.map((a) => a.action)).toEqual([{ params: { message: 'hp=20' }, tool: 'chat' }])
  })

  it('rejects mixed skip + tool calls', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)

    await expect(planner.evaluate('await skip(); await chat("oops")', actions, globals, executeAction)).rejects.toThrow(
      /skip\(\) cannot be mixed/i,
    )
  })

  it('allows evaluate when action catalog also includes skip', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)

    await expect(planner.evaluate('await skip()', actionsWithSkip, globals, executeAction)).resolves.toMatchObject({
      actions: [
        {
          action: { params: {}, tool: 'skip' },
          ok: true,
          result: 'Skipped turn',
        },
      ],
    })
  })

  it('returns structured validation failures without aborting the script', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)
    const planned = await planner.evaluate(
      `
      const first = await goToPlayer({ player_name: "Alex", closeness: -1 })
      if (!first.ok) {
        await chat("fallback")
      }
    `,
      actions,
      globals,
      executeAction,
    )

    expect(planned.actions[0]?.ok).toBe(false)
    expect(planned.actions[0]?.error).toMatch(/Invalid tool parameters/i)
    expect(executeAction).toHaveBeenCalledTimes(1)
    expect(planned.actions[1]?.action.tool).toBe('chat')
  })

  it('enforces timeout on long-running scripts', async () => {
    const planner = new JavaScriptPlanner({ timeoutMs: 20 })
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)

    await expect(planner.evaluate('while (true) {}', actions, globals, executeAction)).rejects.toThrow(
      /Script execution timed out/i,
    )
  })

  it('supports expectation guardrails on structured action telemetry', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async () => ({
      distanceToTargetAfter: 1.5,
      endPos: { x: 8, y: 64, z: 4 },
      movedDistance: 1.25,
      ok: true,
    }))

    const planned = await planner.evaluate(
      `
      const nav = await goToPlayer({ player_name: "Alex", closeness: 2 })
      expect(nav.ok, "go failed")
      expectMoved(1)
      expectNear(2)
      expectNear({ x: 7, y: 64, z: 4 }, 2)
    `,
      actions,
      globals,
      executeAction,
    )

    expect(planned.actions).toHaveLength(1)
    expect(planned.actions[0]?.ok).toBe(true)
  })

  it('throws when expectation guardrail fails', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async () => ({
      movedDistance: 0.1,
      ok: true,
    }))

    await expect(
      planner.evaluate(
        `
      await goToPlayer({ player_name: "Alex", closeness: 2 })
      expectMoved(1, "did not move enough")
    `,
        actions,
        globals,
        executeAction,
      ),
    ).rejects.toThrow(/Expectation failed: did not move enough/i)
  })

  it('describes registered globals for debug REPL', () => {
    const planner = new JavaScriptPlanner()
    const descriptors = planner.describeGlobals(actions, globals)
    const names = descriptors.map((d) => d.name)

    expect(names).toContain('mem')
    expect(names).toContain('chat')
    expect(names).toContain('goToPlayer')
    expect(names).toContain('llmInput')
    expect(names).toContain('llmUserMessage')
    expect(names).toContain('query')
    expect(names).toContain('patterns')
    expect(names).toContain('patterns.get')
    expect(names).toContain('patterns.find')
    expect(names).toContain('bot')
    expect(names).toContain('mineflayer')
    expect(names).toContain('currentInput')
    expect(names).toContain('llmLog')
    expect(names).toContain('actionQueue')
    expect(names).toContain('noActionBudget')
    expect(names).toContain('errorBurstGuard')
    expect(names).toContain('setNoActionBudget')
    expect(names).toContain('getNoActionBudget')
    expect(names).toContain('forget_conversation')

    const mem = descriptors.find((d) => d.name === 'mem')
    expect(mem?.readonly).toBe(false)
  })

  it('exposes actionQueue runtime global to scripts', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)
    const planned = await planner.evaluate('return actionQueue.capacity.total', actions, globals, executeAction)
    expect(planned.returnValue).toBe('5')
    expect(planned.actions).toHaveLength(0)
  })

  it('exposes no-action budget runtime globals to scripts', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)
    const planned = await planner.evaluate(
      'return { state: getNoActionBudget(), set: setNoActionBudget(6), now: noActionBudget }',
      actions,
      globals,
      executeAction,
    )
    expect(planned.returnValue).toContain('remaining: 3')
    expect(planned.returnValue).toContain('remaining: 6')
    expect(planned.actions).toHaveLength(0)
  })

  it('exposes error-burst guard runtime global to scripts', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)
    const guardedGlobals = {
      ...globals,
      errorBurstGuard: {
        errorTurnCount: 3,
        threshold: 3,
        windowTurns: 5,
      },
    } as any
    const planned = await planner.evaluate(
      'return errorBurstGuard.errorTurnCount',
      actions,
      guardedGlobals,
      executeAction,
    )
    expect(planned.returnValue).toBe('3')
    expect(planned.actions).toHaveLength(0)
  })

  it('exposes llm input globals to scripts', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)
    const planned = await planner.evaluate('await chat("llm=" + llmUserMessage)', actions, globals, executeAction)
    expect(planned.actions[0]?.action).toEqual({ params: { message: 'llm=latest user message' }, tool: 'chat' })
  })

  it('exposes patterns runtime global to scripts', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)

    const fromGet = await planner.evaluate(
      'return patterns.get("collect.wall_torch")?.id',
      actions,
      globals,
      executeAction,
    )
    expect(fromGet.returnValue).toContain('collect.wall_torch')

    const fromFind = await planner.evaluate(
      'return patterns.find("torch wall", 1).map(p => p.id)',
      actions,
      globals,
      executeAction,
    )
    expect(fromFind.returnValue).toContain('collect.wall_torch')
  })

  it('exposes forget_conversation runtime function', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)
    const planned = await planner.evaluate('return forget_conversation()', actions, globals, executeAction)

    expect(planned.returnValue).toContain('conversationHistory')
    expect(planned.actions).toHaveLength(0)
  })

  it('renders nested return objects without [Object] truncation', async () => {
    const planner = new JavaScriptPlanner()
    const executeAction = vi.fn(async (action) => `ok:${action.tool}`)
    const planned = await planner.evaluate(
      `
      return {
        nearbyCopperOre: [{
          name: 'copper_ore',
          pos: { x: 10, y: 64, z: -2 },
          distance: 1.8,
        }],
      }
    `,
      actions,
      globals,
      executeAction,
    )

    expect(planned.returnValue).toContain('pos: { x: 10, y: 64, z: -2 }')
    expect(planned.returnValue).not.toContain('[Object]')
  })

  it('detects expression-friendly REPL inputs', () => {
    const planner = new JavaScriptPlanner()
    expect(planner.canEvaluateAsExpression('2 + 3')).toBe(true)
    expect(planner.canEvaluateAsExpression('const a = 1; a + 1')).toBe(false)
  })
})
