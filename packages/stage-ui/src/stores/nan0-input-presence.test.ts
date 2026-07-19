import { describe, expect, it, vi } from 'vitest'

import {
  notifyNan0AcceptedInputPresence,
  notifyNan0InputPresence,
  setNan0InputPresenceHandler,
} from './nan0-input-presence'

describe('nan0 input presence boundary', () => {
  it('forwards only through the installed narrow handler and cleans up idempotently', () => {
    const handler = vi.fn()
    const cleanup = setNan0InputPresenceHandler(handler)
    notifyNan0InputPresence({ at: 10, actorId: 'kyo' })
    expect(handler).toHaveBeenCalledWith({ at: 10, actorId: 'kyo' })
    cleanup()
    cleanup()
    notifyNan0InputPresence({ at: 20 })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('notifies only for a newly accepted external user inscription', () => {
    const handler = vi.fn()
    const cleanup = setNan0InputPresenceHandler(handler)

    notifyNan0AcceptedInputPresence({ role: 'assistant', createdAt: 10 }, false, 99)
    notifyNan0AcceptedInputPresence({ role: 'user', createdAt: 20 }, true, 99)
    notifyNan0AcceptedInputPresence({ role: 'user', createdAt: Number.NaN }, false, 99)
    notifyNan0AcceptedInputPresence({ role: 'user', createdAt: 30, metadata: { actorId: 'kyo' } }, false, 99)

    expect(handler).toHaveBeenNthCalledWith(1, { at: 99, actorId: undefined })
    expect(handler).toHaveBeenNthCalledWith(2, { at: 30, actorId: 'kyo' })
    expect(handler).toHaveBeenCalledTimes(2)
    cleanup()
  })
})
