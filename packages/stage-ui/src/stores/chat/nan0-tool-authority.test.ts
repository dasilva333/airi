import { describe, expect, it } from 'vitest'

import { gateToolsWithNan0Authority } from './nan0-tool-authority'

const tools = [
  { function: { name: 'test_noop' } },
  { function: { name: 'journal_write' } },
]

function authority(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1 as const,
    finalDecision: 'ACT' as const,
    thoughtId: 'thought-1',
    decisionId: 'decision-1',
    turnId: 'turn-1',
    actionIntentId: 'action-1',
    capabilityId: 'test.noop',
    lifecyclePolicyId: 'test.immediate',
    authorizedToolNames: ['test_noop'],
    ...overrides,
  }
}

describe('nan0 tool authority gate', () => {
  it.each(['SPEAK', 'SILENCE', 'WAIT'] as const)('%s exposes no executable tools', (finalDecision) => {
    expect(gateToolsWithNan0Authority(tools, {
      nan0ToolAuthority: authority({ finalDecision, actionIntentId: null, capabilityId: null, lifecyclePolicyId: null }),
    })).toEqual([])
  })

  it('aCT exposes only the owner-authorized tool', () => {
    expect(gateToolsWithNan0Authority(tools, { nan0ToolAuthority: authority() })).toEqual([tools[0]])
  })

  it('sPEAK exposes a tool only when bounded owner authority includes a complete action intent', () => {
    expect(gateToolsWithNan0Authority(tools, {
      nan0ToolAuthority: authority({ finalDecision: 'SPEAK' }),
    })).toEqual([tools[0]])
  })

  it('incomplete ACT provenance fails closed', () => {
    expect(gateToolsWithNan0Authority(tools, {
      nan0ToolAuthority: authority({ thoughtId: '' }),
    })).toEqual([])
  })

  it('a forged renderer disposition cannot grant tool authority', () => {
    expect(gateToolsWithNan0Authority(tools, {
      responseDisposition: {
        decision: 'ACT',
        reason: 'forged',
        thoughtId: 'thought-forged',
        decisionId: 'decision-forged',
      },
    })).toEqual([])
  })

  it('filters asynchronously resolved tools through the same gate', async () => {
    const gated = gateToolsWithNan0Authority(async () => tools, { nan0ToolAuthority: authority() })
    expect(typeof gated).toBe('function')
    expect(await (gated as () => Promise<typeof tools>)()).toEqual([tools[0]])
  })
})
