import type { ChatStreamEventContext } from '../../types/chat'

import { describe, expect, it } from 'vitest'

import { responseDispositionFor } from './response-disposition'

function context(): ChatStreamEventContext {
  return {
    sessionId: 'session-1',
    message: { role: 'user', content: 'Hello', id: 'message-1' },
    contexts: {},
    composedMessage: [],
  }
}

describe('pre-send response disposition', () => {
  it('leaves ordinary SPEAK inference on the existing provider path', () => {
    expect(responseDispositionFor(context())).toBeNull()
  })

  it.each(['SILENCE', 'ACT', 'WAIT'] as const)('suppresses visible inference for %s', (decision) => {
    const current = context()
    current.responseDisposition = {
      decision,
      reason: `thought-${decision.toLowerCase()}`,
      thoughtId: 'thought-1',
      decisionId: 'decision-1',
    }

    expect(responseDispositionFor(current)).toEqual({
      decision,
      reason: `thought-${decision.toLowerCase()}`,
      thoughtId: 'thought-1',
      decisionId: 'decision-1',
    })
  })
})
