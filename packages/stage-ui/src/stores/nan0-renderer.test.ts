import { describe, expect, it } from 'vitest'

import { createNan0RendererIdentity, isNan0ExecutorRenderer, isNan0OwnerRenderer } from './nan0-renderer'

describe('nan0 renderer ownership', () => {
  it('selects only the dedicated chat renderer as the owner', () => {
    expect(isNan0OwnerRenderer('#/chat')).toBe(true)
    expect(isNan0OwnerRenderer('#/chat?session=one')).toBe(true)
    expect(isNan0OwnerRenderer('#/')).toBe(false)
    expect(isNan0OwnerRenderer('#/actor')).toBe(false)
    expect(isNan0OwnerRenderer('#/settings')).toBe(false)
  })

  it('selects only the root renderer as the AIRI chat lifecycle executor', () => {
    expect(isNan0ExecutorRenderer('')).toBe(true)
    expect(isNan0ExecutorRenderer('#')).toBe(true)
    expect(isNan0ExecutorRenderer('#/')).toBe(true)
    expect(isNan0ExecutorRenderer('#/chat')).toBe(false)
    expect(isNan0ExecutorRenderer('#/settings')).toBe(false)
  })

  it('keeps non-owner renderers read-only and gives each renderer a stable diagnostic identity', () => {
    const identity = createNan0RendererIdentity('#/actor', () => 'renderer-1')
    let appendCount = 0

    if (identity.isOwner)
      appendCount += 1

    expect(identity).toEqual({
      instanceId: 'renderer-1',
      hash: '#/actor',
      isOwner: false,
      isExecutor: false,
    })
    expect(appendCount).toBe(0)
  })

  it('never grants a non-owner renderer temporal writer responsibility', () => {
    const renderers = ['#/actor', '#/settings', '#/caption'].map(hash => createNan0RendererIdentity(hash, () => `renderer-${hash}`))
    expect(renderers.every(renderer => !renderer.isOwner)).toBe(true)
  })
})
