import type { DslMotionGroup, MotionRef } from '../dsl/types'

import { captureDslGroups } from '../../../stage-ui-live2d/src/runtime/dsl-capture'
import { DSLVirtualMachine } from '../dsl/interpreter'

export interface TestStep {
  /** The action to execute in this step */
  action:
    | { type: 'dispatch', group: string }
    | { type: 'selectChoice', index: number }
  /** Expected VarFloats heap state after this step */
  expectedHeap?: Record<string, number>
  /** Expected choice button text strings if a choice menu opens */
  expectedChoices?: string[]
  /** Expected text/subtitle emitted during step */
  expectedText?: string | RegExp
  /** Expected motion group names triggered */
  expectedMotions?: string[]
}

export interface StepReport {
  stepIndex: number
  actionName: string
  passed: boolean
  heap: Record<string, number>
  pendingChoices: string[] | null
  lastText: string | null
  startedMotions: string[]
  error?: string
}

export interface ScenarioReport {
  totalSteps: number
  passedSteps: number
  failedSteps: number
  passed: boolean
  stepReports: StepReport[]
}

export class HeadlessDslTestHarness {
  readonly vm: DSLVirtualMachine
  private currentIntimacy = 0
  private lastText: string | null = null
  private startedMotions: string[] = []
  private playedSounds: string[] = []

  constructor(groupsOrManifest?: DslMotionGroup[] | Record<string, unknown> | string) {
    this.vm = new DSLVirtualMachine({
      host: {
        intimacy: {
          getIntimacy: () => this.currentIntimacy,
          addIntimacy: (delta) => {
            this.currentIntimacy += delta
          },
        },
        motion: {
          startMotion: (ref: MotionRef) => {
            this.startedMotions.push(ref.group + (ref.item ? `:${ref.item}` : ''))
          },
          stopAllMotions: () => {},
          setMotionGroupEnabled: () => {},
        },
        sound: {
          playSound: (file) => {
            this.playedSounds.push(file)
          },
          stopSound: () => {},
        },
        events: {
          showChoices: () => {},
          showText: (payload) => {
            this.lastText = payload.text
          },
          onCostumeWillSwap: () => {},
          onIntimacyChanged: () => {},
        },
      },
    })

    if (groupsOrManifest) {
      this.load(groupsOrManifest)
    }
  }

  /** Load manifest from DslMotionGroup[], raw manifest JSON object, or file path. */
  load(groupsOrManifest: DslMotionGroup[] | Record<string, unknown> | string): void {
    if (typeof groupsOrManifest === 'string') {
      let content = groupsOrManifest
      if (!groupsOrManifest.trim().startsWith('{')) {
        try {
          // NOTICE: Node-only file reading in test harness
          const req = typeof require !== 'undefined' ? require : null
          if (req) {
            content = req('node:fs').readFileSync(groupsOrManifest, 'utf-8')
          }
        }
        catch {
          // Fall through
        }
      }
      const parsed = JSON.parse(content)
      const motions = parsed.FileReferences?.Motions || parsed.motions
      this.vm.loadGroups(captureDslGroups(motions))
    }
    else if (Array.isArray(groupsOrManifest)) {
      this.vm.loadGroups(groupsOrManifest)
    }
    else {
      const motions = (groupsOrManifest as any).FileReferences?.Motions || (groupsOrManifest as any).motions
      this.vm.loadGroups(captureDslGroups(motions))
    }
  }

  /** Set persistent intimacy score for testing intimacy gates. */
  setIntimacy(score: number): void {
    this.currentIntimacy = score
  }

  /** Current VarFloats heap snapshot. */
  getHeap(): Record<string, number> {
    return this.vm.vars.snapshot()
  }

  /** Execute a single step and return its detailed report. */
  step(stepDef: TestStep, index = 0): StepReport {
    this.startedMotions = []
    this.playedSounds = []
    this.lastText = null

    let actionName = ''

    if (stepDef.action.type === 'dispatch') {
      actionName = `dispatch("${stepDef.action.group}")`
      this.vm.dispatch(stepDef.action.group)
    }
    else {
      actionName = `selectChoice(${stepDef.action.index})`
      this.vm.selectChoice(stepDef.action.index)
    }

    const currentHeap = this.getHeap()
    const pending = this.vm.getPendingChoices()
    const choiceTexts = pending ? pending.choices.map(c => c.text) : null

    let passed = true
    let error: string | undefined

    // 1. Heap assertions
    if (stepDef.expectedHeap) {
      for (const [key, val] of Object.entries(stepDef.expectedHeap)) {
        if (currentHeap[key] !== val) {
          passed = false
          error = `Heap mismatch for "${key}": expected ${val}, got ${currentHeap[key]} (full heap: ${JSON.stringify(currentHeap)})`
          break
        }
      }
    }

    // 2. Choices assertions
    if (passed && stepDef.expectedChoices) {
      if (!choiceTexts) {
        passed = false
        error = `Expected pending choices [${stepDef.expectedChoices.join(', ')}], but no choices menu was pending`
      }
      else {
        for (let i = 0; i < stepDef.expectedChoices.length; i++) {
          if (choiceTexts[i] !== stepDef.expectedChoices[i]) {
            passed = false
            error = `Choice text mismatch at index ${i}: expected "${stepDef.expectedChoices[i]}", got "${choiceTexts[i]}"`
            break
          }
        }
      }
    }

    // 3. Subtitle text assertion
    if (passed && stepDef.expectedText !== undefined) {
      if (this.lastText === null) {
        passed = false
        error = `Expected emitted text matching ${stepDef.expectedText}, but no text was emitted`
      }
      else if (typeof stepDef.expectedText === 'string' && this.lastText !== stepDef.expectedText) {
        passed = false
        error = `Text mismatch: expected "${stepDef.expectedText}", got "${this.lastText}"`
      }
      else if (stepDef.expectedText instanceof RegExp && !stepDef.expectedText.test(this.lastText)) {
        passed = false
        error = `Text mismatch: "${this.lastText}" did not match regex ${stepDef.expectedText}`
      }
    }

    return {
      stepIndex: index,
      actionName,
      passed,
      heap: currentHeap,
      pendingChoices: choiceTexts,
      lastText: this.lastText,
      startedMotions: [...this.startedMotions],
      error,
    }
  }

  /** Run a multi-step scenario and return a comprehensive test report. */
  runScenario(steps: TestStep[]): ScenarioReport {
    const reports: StepReport[] = []
    let passedCount = 0
    let failedCount = 0

    for (let i = 0; i < steps.length; i++) {
      const rep = this.step(steps[i], i)
      reports.push(rep)
      if (rep.passed)
        passedCount++
      else
        failedCount++
    }

    return {
      totalSteps: steps.length,
      passedSteps: passedCount,
      failedSteps: failedCount,
      passed: failedCount === 0,
      stepReports: reports,
    }
  }
}
