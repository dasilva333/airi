/**
 * @proj-airi/live2d-runtime
 *
 * Headless Live2D DSL runtime & VarFloats state engine.
 * See docs/project-standalone-live2d-engine-plan.md §0 (Reconciled Architecture).
 */

export { parseCommandChain, parseMotionRef } from './dsl/command-parser'

export { DSLVirtualMachine } from './dsl/interpreter'

export type { VMHost, VMOptions } from './dsl/interpreter'

export { filterEligibleEntries, selectEntry, weightedPick } from './dsl/selector'
export type { IClockLike, SelectionContext } from './dsl/selector'

export { interpolate } from './dsl/template'

export type { TemplateContext } from './dsl/template'
// DSL types (manifest wire format + VM-internal shapes)
export type {
  DslChoice,
  DslCommand,
  DslCommandKind,
  DslEntry,
  DslMotionGroup,
  IntimacyBounds,
  MotionRef,
  ResolvedChoice,
  TimeLimitBounds,
  VarFloat,
  VarFloatCondition,
  VarFloatMutation,
} from './dsl/types'

// DSL VM + components
export { ReactiveVarStore } from './dsl/var-store'
export type { ConditionOp, MutationOp, RandomSource } from './dsl/var-store'

// Ports (output interfaces the host implements)
export type {
  IClock,
  ICostumeSwapper,
  IEventEmitter,
  IExpressionSink,
  IIntimacyStore,
  IMotionSink,
  ISoundSink,
  ITextureSink,
  ITrackingSink,
  Live2DRuntimePorts,
} from './ports'
export { systemClock } from './ports'

// Headless test harness for automated model scenario testing & state verification
export { HeadlessDslTestHarness } from './testing/harness'
export type { ScenarioReport, StepReport, TestStep } from './testing/harness'
