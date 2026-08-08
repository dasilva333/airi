import type { TestStep } from '../src/testing/harness'

import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, expect, it } from 'vitest'

import { HeadlessDslTestHarness } from '../src/testing/harness'

const SCRATCH_TMP_DIR = 'C:\\Users\\h4rdc\\.gemini\\antigravity\\brain\\a6542fd4-a559-4ed0-a056-40186f03eee7\\scratch\\tmp'

describe('headless Live2D DSL Model Automated Scenario Runner', () => {
  it('should load model live2d_2883004043 headlessly and run automated scenario sequence', () => {
    const manifestPath = path.join(SCRATCH_TMP_DIR, 'live2d_2883004043', '2883004043.model3.json')
    expect(fs.existsSync(manifestPath)).toBe(true)

    const runner = new HeadlessDslTestHarness(manifestPath)

    // Initial state check: all declared variables (var, var1, var2, var3) are auto-registered at 0
    expect(runner.getHeap()).toEqual({
      var: 0,
      var1: 0,
      var2: 0,
      var3: 0,
    })

    // Define a multi-step scenario sequence
    const steps: TestStep[] = [
      {
        action: { type: 'dispatch', group: 'Start' },
        expectedHeap: { var: 0, var1: 0, var2: 0, var3: 0 },
      },
      {
        action: { type: 'dispatch', group: 'Tick3' },
        expectedHeap: { var: 0, var1: 0, var2: 0, var3: 0 },
      },
      {
        action: { type: 'dispatch', group: 'TapTouchHead' },
        expectedHeap: { var: 0, var1: 0, var2: 0, var3: 0 },
      },
      {
        action: { type: 'dispatch', group: 'TapTouchBody' },
        expectedHeap: { var: 0, var1: 0, var2: 0, var3: 0 },
      },
    ]

    const report = runner.runScenario(steps)

    // Assert that every step in the scenario passed cleanly
    expect(report.passed).toBe(true)
    expect(report.passedSteps).toBe(4)
    expect(report.failedSteps).toBe(0)
  })

  it('should load model live2d_2262182171 headlessly, auto-register heap, and mutate act state', () => {
    const manifestPath = path.join(SCRATCH_TMP_DIR, 'live2d_2262182171', '2262182171.model3.json')
    expect(fs.existsSync(manifestPath)).toBe(true)

    const runner = new HeadlessDslTestHarness(manifestPath)

    // Initial state check: 'act' is auto-registered on load
    expect(runner.getHeap()).toHaveProperty('act')
    expect(runner.getHeap().act).toBe(0)

    const steps: TestStep[] = [
      {
        action: { type: 'dispatch', group: 'Idle' },
        expectedHeap: { act: 1 },
      },
      {
        action: { type: 'dispatch', group: 'A10' },
      },
    ]

    const report = runner.runScenario(steps)

    expect(report.passed).toBe(true)
    expect(report.passedSteps).toBe(2)
    expect(runner.getHeap().act).toBeGreaterThanOrEqual(1)
  })
})
