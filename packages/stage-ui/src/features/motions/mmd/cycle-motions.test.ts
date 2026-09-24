import { parseMmdCycleAnimations, resolveBuiltinMmdAnimationUrl } from '@proj-airi/stage-ui-mmd'
import { describe, expect, it } from 'vitest'

describe('mmd parseMmdCycleAnimations', () => {
  it('strips mmd: prefix from idle animation keys', () => {
    const input = [
      'mmd:wave.vmd',
      'mmd:idle_loop.vmd',
    ]
    const result = parseMmdCycleAnimations(input)
    expect(result).toEqual(['wave.vmd', 'idle_loop.vmd'])
  })

  it('preserves keys that do not have mmd: prefix', () => {
    const input = ['wave.vmd', 'idle_loop.vmd']
    const result = parseMmdCycleAnimations(input)
    expect(result).toEqual(['wave.vmd', 'idle_loop.vmd'])
  })

  it('filters out foreign model keys (live2d:, spine:)', () => {
    const input = [
      'live2d:motions/idle.motion3.json',
      'spine:walk',
      'mmd:dance.vmd',
      'unprefixed_motion.vmd',
    ]
    const result = parseMmdCycleAnimations(input)
    expect(result).toEqual(['dance.vmd', 'unprefixed_motion.vmd'])
  })

  it('returns empty array when input is undefined or empty', () => {
    expect(parseMmdCycleAnimations(undefined)).toEqual([])
    expect(parseMmdCycleAnimations([])).toEqual([])
  })
})

describe('mmd resolveBuiltinMmdAnimationUrl', () => {
  it('resolves relative to window doc href for Electron production file:// protocol', () => {
    const docHref = 'file:///Applications/AIRI.app/Contents/Resources/app.asar/dist/renderer/index.html'
    const result = resolveBuiltinMmdAnimationUrl('circulation.vmd', './', docHref)
    expect(result).toBe('file:///Applications/AIRI.app/Contents/Resources/app.asar/dist/renderer/assets/mmd/animations/circulation.vmd')
  })

  it('resolves relative to window doc href for subpath web deployments', () => {
    const docHref = 'https://example.com/airi/index.html'
    const result = resolveBuiltinMmdAnimationUrl('circulation.vmd', '/airi/', docHref)
    expect(result).toBe('https://example.com/airi/assets/mmd/animations/circulation.vmd')
  })

  it('resolves relative to dev server root', () => {
    const docHref = 'http://localhost:5173/'
    const result = resolveBuiltinMmdAnimationUrl('circulation.vmd', '/', docHref)
    expect(result).toBe('http://localhost:5173/assets/mmd/animations/circulation.vmd')
  })
})
