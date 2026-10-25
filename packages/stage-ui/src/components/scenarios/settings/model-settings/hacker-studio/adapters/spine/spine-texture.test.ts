import { describe, expect, it, vi } from 'vitest'

import { replaceSpinePageTexture, restoreSpinePageTexture } from './spine-texture'

function fakePage() {
  return {
    texture: 'original' as any,
    setTexture: vi.fn(function (this: any, texture: any) {
      this.texture = texture
    }),
  }
}

describe('hacker-studio: Spine atlas page texture swap', () => {
  it('replaces the page texture without touching atlas metadata', () => {
    const page = fakePage()
    const swap = replaceSpinePageTexture(page, 'replacement')

    expect(page.texture).toBe('replacement')
    expect(page.setTexture).toHaveBeenCalledWith('replacement')
    expect(swap.previousTexture).toBe('original')
  })

  it('restores the original texture', () => {
    const page = fakePage()
    const swap = replaceSpinePageTexture(page, 'replacement')
    restoreSpinePageTexture(page, swap)

    expect(page.texture).toBe('original')
    expect(page.setTexture).toHaveBeenCalledTimes(2)
  })
})
