import { describe, expect, it, vi } from 'vitest'

import { replaceBaseTexture, restoreBaseTexture } from './live2d-texture'

function fakeTexture(baseTexture: string) {
  return {
    baseTexture,
    update: vi.fn(),
  }
}

describe('hacker-studio: Live2D baseTexture swap', () => {
  it('swaps the target baseTexture and updates it', () => {
    const target = fakeTexture('old')
    const result = replaceBaseTexture(target, 'new')

    expect(target.baseTexture).toBe('new')
    expect(target.update).toHaveBeenCalledOnce()
    expect(result.previous).toBe('old')
  })

  it('repoints only drawables that reference the previous baseTexture', () => {
    const target = fakeTexture('old')
    const matching = { texture: fakeTexture('old') }
    const unrelated = { texture: fakeTexture('other') }

    const result = replaceBaseTexture(target, 'new', [matching, unrelated])

    expect(matching.texture.baseTexture).toBe('new')
    expect(matching.texture.update).toHaveBeenCalledOnce()
    expect(unrelated.texture.baseTexture).toBe('other')
    expect(result.swappedDrawables).toEqual([matching])
  })

  it('restores the target and every swapped drawable in place', () => {
    const target = fakeTexture('old')
    const matching = { texture: fakeTexture('old') }
    const swap = replaceBaseTexture(target, 'new', [matching])

    restoreBaseTexture(target, swap)

    expect(target.baseTexture).toBe('old')
    expect(matching.texture.baseTexture).toBe('old')
    expect(target.update).toHaveBeenCalledTimes(2)
    expect(matching.texture.update).toHaveBeenCalledTimes(2)
  })

  it('tolerates drawables without a texture', () => {
    const target = fakeTexture('old')
    const result = replaceBaseTexture(target, 'new', [{}])
    expect(result.swappedDrawables).toEqual([])
  })
})
