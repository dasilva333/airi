import { destroyLive2dModel } from '@proj-airi/stage-ui-live2d'
import { describe, expect, it, vi } from 'vitest'

describe('destroyLive2dModel contract (PR #2894, #2891)', () => {
  it('calls destroy with texture and baseTexture set to true to release GPU texture memory', () => {
    const destroySpy = vi.fn()
    const mockModel = {
      destroy: destroySpy,
    }

    destroyLive2dModel(mockModel)

    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(destroySpy).toHaveBeenCalledWith({
      texture: true,
      baseTexture: true,
    })
  })

  it('falls back to internalModel.destroy when root destroy method is unavailable', () => {
    const internalDestroySpy = vi.fn()
    const mockModel = {
      internalModel: {
        destroy: internalDestroySpy,
      },
    }

    destroyLive2dModel(mockModel)

    expect(internalDestroySpy).toHaveBeenCalledTimes(1)
  })

  it('handles null and undefined safely without throwing', () => {
    expect(() => destroyLive2dModel(null)).not.toThrow()
    expect(() => destroyLive2dModel(undefined)).not.toThrow()
  })

  it('catches and suppresses errors during model destruction to avoid unmount crashes', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failingModel = {
      destroy: vi.fn(() => {
        throw new Error('WebGL context lost during destroy')
      }),
    }

    expect(() => destroyLive2dModel(failingModel)).not.toThrow()
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[destroyLive2dModel] Error destroying Live2D model instance:'),
      expect.any(Error),
    )
    consoleWarnSpy.mockRestore()
  })
})
