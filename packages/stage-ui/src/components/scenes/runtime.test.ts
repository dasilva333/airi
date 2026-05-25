import { describe, expect, it } from 'vitest'

import { shouldRunLive2dLipSyncLoop } from './runtime'

describe('shouldRunLive2dLipSyncLoop', () => {
  it('runs only for live2d while not paused', () => {
    expect(shouldRunLive2dLipSyncLoop({ paused: false, stageModelRenderer: 'live2d' })).toBe(true)
    expect(shouldRunLive2dLipSyncLoop({ paused: true, stageModelRenderer: 'live2d' })).toBe(false)
    expect(shouldRunLive2dLipSyncLoop({ paused: false, stageModelRenderer: 'vrm' })).toBe(false)
  })
})
