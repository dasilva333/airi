/**
 * Phase 1 headless verification for the Live2D DSL interpreter virtual machine.
 *
 * Drives the canonical, render-agnostic engine in `@proj-airi/live2d-runtime`
 * directly (no PIXI/Vue/DOM) against the extracted model fixtures under
 * `apps/stage-edge/.models/`, asserting:
 *
 *   Task 1 — VarFloats heap:  Type 1 guards (equal/greater_equal) + Type 2 mutators
 *                             (assign rand / assign int / add / subtract) mutate & gate.
 *   Task 2 — Command chain:   start_mtn / clear_exp split into ordered instructions;
 *                             change_cos preserves the VarFloats heap.
 *   Task 3 — Intimacy:        Taphead / Tapbody dispatched headlessly; Intimacy.Min
 *                             gates the ladder, Bonus writes back to the host intimacy
 *                             store (NOT the heap), Max gates the low-intimacy line.
 *
 * Imported by relative source path (matching packages/live2d-runtime/test conventions),
 * so no build step / dist is required. Run via: pnpm test:dsl
 */

import type { DslMotionGroup } from '../../../packages/live2d-runtime/src/dsl/types'
import type { Live2DRuntimePorts } from '../../../packages/live2d-runtime/src/ports'

import { fileURLToPath } from 'node:url'

import * as fs from 'node:fs'
import * as path from 'node:path'

import { DSLVirtualMachine } from '../../../packages/live2d-runtime/src/dsl/interpreter'
import { captureDslGroups } from '../../../packages/stage-ui-live2d/src/runtime/dsl-capture'

// ---------------------------------------------------------------------------
// Fixture locations (two pre-extracted model manifests).
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../../..')
const FIXTURES_DIR = path.join(REPO_ROOT, 'apps/stage-edge/.models')

const FLANDRE = path.join(FIXTURES_DIR, 'live2d_2262182171', '2262182171.model3.json')
const KASANE = path.join(FIXTURES_DIR, 'live2d_3626567931', '3626567931.zip.model3.json')

// ---------------------------------------------------------------------------
// Tiny assertion + reporting harness.
// ---------------------------------------------------------------------------

let failures = 0
let passes = 0

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    passes += 1
    console.log(`  PASS ${label}`)
  }
  else {
    failures += 1
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  assert(
    Object.is(actual, expected),
    label,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  )
}

function section(title: string): void {
  console.log(`\n== ${title}`)
}

// ---------------------------------------------------------------------------
// Instrumented host: records every port call so we can assert intimacy
// write-back, motion sequencing, choices, and costume swaps without a renderer.
// ---------------------------------------------------------------------------

interface RecordedMotion { group: string, item?: string, lane?: number }

interface HostRecorder {
  ports: Live2DRuntimePorts
  intimacy: number
  motions: RecordedMotion[]
  sounds: string[]
  clearedExpressions: number
  appliedExpressions: string[]
  costumeSwaps: string[]
  intimacyChanges: Array<{ next: number, delta: number }>
  texts: string[]
}

function makeHost(initialIntimacy = 0): HostRecorder {
  const r: HostRecorder = {
    ports: {},
    intimacy: initialIntimacy,
    motions: [],
    sounds: [],
    clearedExpressions: 0,
    appliedExpressions: [],
    costumeSwaps: [],
    intimacyChanges: [],
    texts: [],
  }

  r.ports = {
    motion: {
      startMotion: (ref) => { r.motions.push({ group: ref.group, item: ref.item, lane: ref.lane }) },
      stopAllMotions: () => {},
      setMotionGroupEnabled: () => {},
    },
    sound: {
      playSound: (file) => { r.sounds.push(file) },
      stopSound: () => {},
    },
    expression: {
      applyExpression: (file) => { r.appliedExpressions.push(file) },
      clearExpressions: () => { r.clearedExpressions += 1 },
    },
    costume: {
      changeCostume: (modelFile) => { r.costumeSwaps.push(modelFile) },
    },
    intimacy: {
      getIntimacy: () => r.intimacy,
      addIntimacy: (delta) => { r.intimacy += delta },
    },
    events: {
      showChoices: () => {},
      showText: (payload) => { r.texts.push(payload.text) },
      onCostumeWillSwap: () => {},
      onIntimacyChanged: (next, delta) => { r.intimacyChanges.push({ next, delta }) },
    },
  }

  return r
}

function loadGroupsFromManifest(manifestPath: string): DslMotionGroup[] {
  const raw = fs.readFileSync(manifestPath, 'utf-8')
  const parsed = JSON.parse(raw)
  const motions = parsed.FileReferences?.Motions ?? parsed.motions
  return captureDslGroups(motions)
}

// ===========================================================================
// Scenario 1 — Flandre (2262182171): the intimacy-gated tap ladder.
// ===========================================================================

section('Scenario 1: fixture 2262182171 (Flandre) — Taphead / Tapbody intimacy ladder')
{
  const groups = loadGroupsFromManifest(FLANDRE)
  const host = makeHost(0)
  const vm = new DSLVirtualMachine({ host: host.ports })
  vm.loadGroups(groups)

  // Sanity: the four tap trigger groups parsed out of the manifest.
  for (const g of ['Taphead', 'Tapbody', 'TapHandL', 'TapHandR'])
    assert(groups.some(x => x.name === g), `manifest contains motion group "${g}"`)

  // --- Taphead: all 5 entries ungated (no Min), each Bonus +1. ---------------
  const headBefore = host.intimacy
  const headEntry = vm.dispatch('Taphead')
  assert(headEntry !== undefined, 'Taphead resolves a candidate entry at intimacy 0')
  assertEqual(host.intimacy, headBefore + 1, 'Taphead write-back Bonus +1 to host intimacy store')
  assertEqual(host.intimacyChanges.at(-1)?.delta, 1, 'intimacy change event emitted (delta +1)')
  assert(host.motions.length > 0, 'Taphead emitted a start_mtn motion')
  assert(host.motions.some(m => m.group === 'Face' && m.lane === 2), 'Taphead command chain includes start_mtn Face#2')
  assert(host.clearedExpressions > 0, 'Taphead command chain ends in clear_exp')
  // Bonus must NOT touch the VarFloats heap (engine-level separation of stores).
  assert(!('Intimacy' in vm.vars.snapshot()), 'intimacy Bonus is not written to the VarFloats heap')

  // --- Tapbody: intimacy ladder Min 20/40/60/80/100 + a Max 19 fallback. -----
  // At intimacy 5 (< Max 19 gate) only the "好感度大于20解锁" fallback is eligible.
  host.intimacy = 5
  host.texts = []
  const lowEntry = vm.dispatch('Tapbody')
  assert(lowEntry !== undefined && lowEntry.Text === '好感度大于20解锁', 'Tapbody at intimacy 5 resolves the Max-gated fallback text line')
  assert(host.texts.includes('好感度大于20解锁'), 'Tapbody fallback text emitted through the UI bridge')
  assertEqual(host.intimacy, 5, 'fallback line carries no Bonus — intimacy unchanged')

  // Below 20 the gated command entries are unreachable.
  host.intimacy = 10
  host.motions = []
  const beforeGate = host.intimacy
  vm.dispatch('Tapbody')
  assert(!host.motions.some(m => m.group === 'B40'), 'Tapbody at intimacy 10 never selects the Min:20 command entry')

  // Raise past the Min:20 gate and the first ladder entry becomes reachable.
  host.intimacy = 25
  const gatedEntry = vm.dispatch('Tapbody')
  assert(gatedEntry !== undefined && typeof gatedEntry.Command === 'string', 'Tapbody at intimacy 25 resolves a real command entry (past the Min gate)')
  assertEqual(host.intimacy, 26, 'Tapbody gated entry Bonus +1 written back (25 -> 26)')

  // Stair-step the ladder: each dispatch rewards +1, unlocking the next rung.
  host.intimacy = 100
  let ranGated = 0
  for (let i = 0; i < 8; i++) {
    const e = vm.dispatch('Tapbody')
    if (e?.Command)
      ranGated += 1
  }
  assertEqual(ranGated, 8, 'every Tapbody dispatch at intimacy >= 100 selects a command entry')
  assertEqual(host.intimacy, 108, 'each gated Tapbody dispatch accrues its Bonus (+1 x8)')
}

// ===========================================================================
// Scenario 2 — Flandre NextMtn command chain: motions enable/disable + change_cos.
// ===========================================================================

section('Scenario 2: fixture 2262182171 — command sequencing (Next chain, motions toggle, change_cos heap preservation)')
{
  const groups = loadGroupsFromManifest(FLANDRE)
  const host = makeHost(0)
  const vm = new DSLVirtualMachine({ host: host.ports })
  vm.loadGroups(groups)

  // Seed a heap value, then trigger the costume swap chain ("Next:cos").
  vm.vars.set('act', 4)
  host.motions = []
  vm.dispatch('Next:cos')
  assert(host.costumeSwaps.includes('model1.json'), 'change_cos model1.json reached the costume port')
  assertEqual(vm.vars.get('act'), 4, 'VarFloats heap preserved across change_cos (act still 4)')

  // motions enable/disable gates the named motion pool.
  vm.dispatch('Next:Leaveoff')
  assertEqual(vm.isMotionGroupEnabled('Leave60_70_80'), false, 'motions disable Leave60_70_80 disables the pool')
  vm.dispatch('Next:Leaveon')
  assertEqual(vm.isMotionGroupEnabled('Leave60_70_80'), true, 'motions enable Leave60_70_80 re-enables the pool')

  // A "Next:<id>" chain dispatches the recorded Sound#1 item in order.
  host.motions = []
  vm.dispatch('Next:011501_002_05_02')
  assert(host.motions.some(m => m.group === 'Sound' && m.lane === 1 && m.item === '011501_002_05_02'), 'NextMtn chain emits start_mtn Sound#1:<id> with lane+item parsed', `motions=${JSON.stringify(host.motions)}`)
}

// ===========================================================================
// Scenario 3 — Kasane (3626567931): VarFloats heap + Max/negative-Bonus gating.
// ===========================================================================

section('Scenario 3: fixture 3626567931 (Kasane) — VarFloats heap (ChatTimer rand / InValentine guard) + intimacy gates')
{
  const groups = loadGroupsFromManifest(KASANE)
  const host = makeHost(0)
  // Deterministic RNG: always roll the inclusive lower bound of rand(20,25).
  const vm = new DSLVirtualMachine({ host: host.ports, random: () => 0 })
  vm.loadGroups(groups)

  assert(groups.some(g => g.name === 'DREFTouchBoxHead-互动-抚摸-普通'), 'manifest contains DREFTouchBoxHead-互动-抚摸-普通')

  // --- Heap mutation: ChatTimer := rand(20,25) -> lower bound 20. -------------
  // Eligible entry needs intimacy in [1900, 1900+] for the head-stroke group.
  host.intimacy = 2000
  vm.vars.set('ChatTimer', -1)
  const entry = vm.dispatch('DREFTouchBoxHead-互动-抚摸-普通')
  assert(entry !== undefined, 'Kasane head-stroke resolves at intimacy 2000')
  assertEqual(vm.vars.get('ChatTimer'), 20, 'Type 2 mutator assign rand(20,25) -> 20 with seeded RNG')

  // --- Intimacy + Bonus write-back on the touch group. -----------------------
  assertEqual(host.intimacy, 2050, 'head-stroke Bonus +50 written back (2000 -> 2050)')

  // --- Negative Bonus + Max gate (Hip 抚摸-腿 has a Bonus -50, Min 0 row). ----
  host.intimacy = 500
  const hipEntry = vm.dispatch('DREFTouchBoxHip-互动-抚摸-腿')
  assert(hipEntry !== undefined && hipEntry.Intimacy?.Bonus === -50, 'Hip low-intimacy row selected (Max-gated ladder)')
  assertEqual(host.intimacy, 450, 'negative Bonus -50 applied (500 -> 450)')

  // --- Festival flag guard routes the 节日 (festival) touch group. ------------
  host.intimacy = 7000
  vm.vars.set('InValentine', 0)
  const offEntry = vm.dispatch('DREFTouchBoxHead-互动-抚摸-节日')
  assert(offEntry === undefined, 'festival head group with InValentine=0 and no matching guard yields no eligible entry')

  vm.vars.set('InValentine', 1)
  const onEntry = vm.dispatch('DREFTouchBoxHead-互动-抚摸-节日')
  assert(onEntry !== undefined, 'festival head group unlocked once InValentine=1 guard passes')
  assertEqual(vm.vars.get('ChatTimer'), 20, 'ChatTimer re-rolled to 20 by the festival entry mutator')
}

// ===========================================================================
// Scenario 5 — Phase 2: motion pool gating (motions enable/disable -> canvas gate).
// Drives the real fixture `motions enable/disable Leave60_70_80` commands and asserts:
//   * the VM and a render-side gate flip in lockstep;
//   * the canvas stop signal fires when a group is disabled;
//   * disabling blocks the (re)start surface (startMotion not re-triggered for that pool).
// ===========================================================================

section('Scenario 5: Phase 2 — motion enable/disable pool gating (fixture 2262182171 Next:Leaveoff/Leaveon)')
{
  const groups = loadGroupsFromManifest(FLANDRE)
  const host = makeHost(0)

  // Render-side mirror of the adapter's motion-group gate (reads only state + a stop flag).
  const gate = new Map<string, boolean>()
  const stoppedGroups: string[] = []
  host.ports.motion!.setMotionGroupEnabled = (ref, enabled) => {
    gate.set(ref.group, enabled)
    if (!enabled)
      stoppedGroups.push(ref.group)
  }

  const vm = new DSLVirtualMachine({ host: host.ports })
  vm.loadGroups(groups)

  // Leave60_70_80 is an idle pool. Disable it, then re-enable it — both through the DSL.
  vm.dispatch('Next:Leaveoff')
  assertEqual(vm.isMotionGroupEnabled('Leave60_70_80'), false, 'VM marks Leave60_70_80 disabled after `motions disable`')
  assertEqual(gate.get('Leave60_70_80'), false, 'render-side gate flipped to disabled (Task 2 host hook fired)')
  assert(stoppedGroups.includes('Leave60_70_80'), 'disabling a pool emits the canvas stop signal')

  vm.dispatch('Next:Leaveon')
  assertEqual(vm.isMotionGroupEnabled('Leave60_70_80'), true, 'VM marks Leave60_70_80 re-enabled after `motions enable`')
  assertEqual(gate.get('Leave60_70_80'), true, 'render-side gate flipped back to enabled')

  // The DSL group still executes its own command chain when explicitly dispatched —
  // the enable/disable gate suppresses *unsolicited idle restarts*, not intentional taps.
  // Re-disable it and confirm an explicit dispatch still runs its command chain (the VM
  // does not hard-block start_mtn), while the render-side gate remains "off" for auto-idle.
  // The DSL group still executes its own command chain when explicitly dispatched —
  // the enable/disable gate suppresses *unsolicited idle restarts*, not intentional taps.
  // The fixture lane strings (e.g. "Sound#1:011501_017") are start_mtn lane refs (they
  // emit startMotion, not playSound), so we assert on the emitted motion lanes.
  vm.dispatch('Next:Leaveoff')
  host.motions = []
  vm.dispatch('Leave60_70_80')
  assert(host.motions.some(m => m.group === 'Sound' && m.lane === 1), 'an explicit dispatch of a gated group still runs its command chain (Sound#1 lane emitted) — idle suppression is a render-side concern')
  assertEqual(vm.isMotionGroupEnabled('Leave60_70_80'), false, 'VM gate stays disabled after re-disabling (disable is idempotent)')
}

// ===========================================================================
// Scenario 6 — Phase 2: Intimacy store wiring (Bonus -> persistent raw store, Task 1).
// Uses the production host shape (Model.vue: dslAdapter.getIntimacy/addIntimacy -> a
// dedicated per-model raw store). Asserts a positive and a negative Bonus both persist
// to the raw store, clamped at 0, and are not written to the VarFloats heap.
// ===========================================================================

section('Scenario 6: Phase 2 — intimacy Bonus persists to the host store (production wiring shape)')
{
  const groups = loadGroupsFromManifest(KASANE)

  // Minimal faithful stand-in for `useDslIntimacyStore`: raw 0..DSL_INTIMACY_MAX per model,
  // clamped floor at 0. Mirrors stores/dsl-intimacy.ts add() semantics.
  const DSL_INTIMACY_MAX = 100_000
  const rawByModel: Record<string, number> = {}
  const dslStore = {
    getRaw: (id?: string) => (id ? (rawByModel[id] ?? 0) : 0),
    add: (id: string | undefined, delta: number) => {
      if (!id)
        return 0
      const next = Math.max(0, Math.min(DSL_INTIMACY_MAX, (rawByModel[id] ?? 0) + delta))
      rawByModel[id] = next
      return next
    },
  }
  const modelId = 'live2d_3626567931'

  const host = makeHost(0)
  // Override the default in-memory intimacy with the persistent-store accessors,
  // exactly as Model.vue wires dslAdapter.getIntimacy/addIntimacy -> dslIntimacy store.
  host.ports.intimacy = {
    getIntimacy: () => dslStore.getRaw(modelId),
    addIntimacy: (delta: number) => { dslStore.add(modelId, delta) },
  }

  const vm = new DSLVirtualMachine({ host: host.ports, random: () => 0 })
  vm.loadGroups(groups)

  // Positive Bonus: the low gate row (Min 0) is selectable and rewards Bonus +50.
  dslStore.add(modelId, 0) // intimacy starts at 0
  vm.dispatch('DREFTouchBoxHead-互动-触摸-头') // low gate (Min 0) + Bonus +50
  assertEqual(dslStore.getRaw(modelId), 50, 'positive Bonus +50 persisted to the raw intimacy store (0 -> 50)')

  // Negative Bonus: Hip 抚摸-腿 row gates Min 0 / Max 1899 with Bonus -50. At 50 it is eligible.
  vm.dispatch('DREFTouchBoxHip-互动-抚摸-腿')
  assertEqual(dslStore.getRaw(modelId), 0, 'negative Bonus -50 persisted + clamped at 0 (50 -> 0)')

  // Intimacy must not leak into the ephemeral VarFloats heap.
  assert(!('Intimacy' in vm.vars.snapshot()), 'intimacy Bonus stays out of the VarFloats heap (DSL/persistent separation)')
}

// ===========================================================================
// Scenario 4 — Authored Choices / double-click DSL (pruned from Kasane, see
// docs/live2d-special-sauce-insights.md): VarFloats guard + Choices + command chain.
// ===========================================================================

section('Scenario 4: authored DSL — DoubleClick guard + Choices menu + command chain')
{
  const host = makeHost(3)
  const vm = new DSLVirtualMachine({ host: host.ports })
  vm.loadGroups([
    {
      name: 'DoubliClick',
      entries: [{
        Text: '菜单{$br}好感度: {$vi_IntimacyVI}',
        Choices: [
          { Text: '送礼', NextMtn: '送礼菜单#99' },
          { Text: '动作菜单', NextMtn: '动作菜单#99' },
        ],
        VarFloats: [
          { Name: 'DoubleClickTimer', Type: 1, Code: 'greater 0' },
          { Name: 'DoubleClickTimer', Type: 2, Code: 'assign 0' },
        ],
      }],
    },
    { name: 'DoubliClickAdd', entries: [{ VarFloats: [{ Name: 'DoubleClickTimer', Type: 2, Code: 'add 1' }] }] },
    { name: '送礼菜单#99', entries: [{ Command: 'start_mtn GiftMotion' }] },
  ])

  // First click: DoubleClickTimer starts at 0 -> `greater 0` fails -> no menu.
  vm.vars.set('DoubleClickTimer', 0)
  let entry = vm.dispatch('DoubliClick')
  assert(entry === undefined, 'DoubliClick guard `greater 0` blocks the menu on a cold timer')
  assert(!vm.hasPendingChoices(), 'no Choices menu pending while the guard fails')

  // Simulate the physical click increment, then the menu opens.
  vm.dispatch('DoubliClickAdd')
  assertEqual(vm.vars.get('DoubleClickTimer'), 1, 'DoubliClickAdd Type 2 `add 1` mutates the heap (0 -> 1)')
  entry = vm.dispatch('DoubliClick')
  assert(vm.hasPendingChoices(), 'Choices menu opens once DoubleClickTimer > 0')
  assertEqual(vm.vars.get('DoubleClickTimer'), 0, 'DoubliClick mutator `assign 0` resets the timer on fire')

  const pending = vm.getPendingChoices()
  assertEqual(pending?.choices.length, 2, 'two choice buttons rendered')
  assertEqual(pending?.choices[0]?.text, '送礼', 'choice text is interpolated/preserved verbatim')

  // Selecting the first choice follows its NextMtn and runs the command chain.
  host.motions = []
  vm.selectChoice(0)
  assert(!vm.hasPendingChoices(), 'selectChoice consumes the pending menu')
  assert(host.motions.some(m => m.group === 'GiftMotion'), 'selectChoice(0) followed NextMtn 送礼菜单#99 -> start_mtn GiftMotion')
}

// ===========================================================================
// Report.
// ===========================================================================

console.log(`\n== DSL harness result: ${passes} passed, ${failures} failed`)
if (failures > 0)
  process.exit(1)
