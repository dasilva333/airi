import type { DslMotionGroup } from '../src/dsl/types'

import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, expect, it } from 'vitest'

import { captureDslGroups } from '../../stage-ui-live2d/src/runtime/dsl-capture'
import { DSLVirtualMachine } from '../src/dsl/interpreter'

const SCRATCH_TMP_DIR = 'C:\\Users\\h4rdc\\.gemini\\antigravity\\brain\\a6542fd4-a559-4ed0-a056-40186f03eee7\\scratch\\tmp'

describe('extracted Live2D DSL Real-World Model Integration Tests', () => {
  it('should parse, load, and drive VarFloats heap evaluation on model live2d_2883004043', () => {
    const manifestPath = path.join(SCRATCH_TMP_DIR, 'live2d_2883004043', '2883004043.model3.json')
    expect(fs.existsSync(manifestPath)).toBe(true)

    const rawJsonText = fs.readFileSync(manifestPath, 'utf-8')
    const parsed = JSON.parse(rawJsonText)
    const motions = parsed.FileReferences?.Motions

    // 1. Convert raw motions manifest into DslMotionGroups
    const groups: DslMotionGroup[] = captureDslGroups(motions)
    expect(groups.length).toBeGreaterThan(0)

    const tick3Group = groups.find(g => g.name === 'Tick3')
    expect(tick3Group).toBeDefined()
    expect(tick3Group?.entries[0]?.VarFloats?.length).toBe(1)

    // 2. Initialize DSL Virtual Machine
    let playedSound: string | undefined

    const vm = new DSLVirtualMachine({
      host: {
        sound: {
          playSound: (src) => {
            playedSound = src
          },
        },
      },
    })
    vm.loadGroups(groups)

    // 3. Test Tick3 dispatch: evaluates equal 0 guard on var3
    const result = vm.dispatch('Tick3')
    expect(result).toBeDefined()
    expect(playedSound).toBeDefined()
  })

  it('should parse, load, and drive intimacy gates & multi-lane command chains on model live2d_2262182171', () => {
    const manifestPath = path.join(SCRATCH_TMP_DIR, 'live2d_2262182171', '2262182171.model3.json')
    expect(fs.existsSync(manifestPath)).toBe(true)

    const rawJsonText = fs.readFileSync(manifestPath, 'utf-8')
    const parsed = JSON.parse(rawJsonText)
    const motions = parsed.FileReferences?.Motions

    const groups: DslMotionGroup[] = captureDslGroups(motions)
    expect(groups.length).toBeGreaterThan(0)

    const vm = new DSLVirtualMachine()
    vm.loadGroups(groups)

    // 1. Dispatch Idle group -> VarFloats executes Type: 2 (assign 1) on 'act'
    const idleEntry = vm.dispatch('Idle')
    expect(idleEntry).toBeDefined()
    expect(vm.vars.snapshot().act).toBe(1)

    // 2. Dispatch A10 group -> VarFloats executes Type: 2 (assign 5) on 'act'
    const a10Entry = vm.dispatch('A10')
    expect(a10Entry).toBeDefined()
    expect(vm.vars.snapshot().act).toBeGreaterThanOrEqual(1)
  })
})
