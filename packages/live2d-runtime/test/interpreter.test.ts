import type { DslMotionGroup } from '../src/dsl/types'
import type { Live2DRuntimePorts } from '../src/ports'

import { describe, expect, it, vi } from 'vitest'

import { DSLVirtualMachine } from '../src/dsl/interpreter'

/** Build a fake host with spies + a controllable intimacy store. */
function makeHost(initIntimacy = 0) {
  let intimacy = initIntimacy
  const intimacyStore = {
    getIntimacy: vi.fn(() => intimacy),
    addIntimacy: vi.fn((d: number) => { intimacy += d }),
  }
  const host: Live2DRuntimePorts = {
    motion: {
      startMotion: vi.fn(),
      stopAllMotions: vi.fn(),
      setMotionGroupEnabled: vi.fn(),
    },
    sound: { playSound: vi.fn(), stopSound: vi.fn() },
    expression: { applyExpression: vi.fn(), clearExpressions: vi.fn() },
    costume: { changeCostume: vi.fn() },
    intimacy: intimacyStore,
    tracking: { setMouseTracking: vi.fn(), setEyeBlink: vi.fn() },
    texture: { replaceTexture: vi.fn() },
    events: {
      showChoices: vi.fn(),
      showText: vi.fn(),
      onCostumeWillSwap: vi.fn(),
      onIntimacyChanged: vi.fn(),
    },
  }
  return { host, intimacyStore, get intimacy() { return intimacy } }
}

describe('dSLVirutalMachine — guard/filtered dispatch & mutation', () => {
  it('promise-toggle menu (model 2883004043): choice A requires var==1 then toggles to 0', () => {
    const { host } = makeHost()
    const vm = new DSLVirtualMachine({ host })
    vm.loadGroups([
      { name: 'A', entries: [{ VarFloats: [{ Name: 'var', Type: 1, Code: 'equal 1' }, { Name: 'var', Type: 2, Code: 'assign 0' }] }] },
      { name: 'B', entries: [{ VarFloats: [{ Name: 'var', Type: 1, Code: 'equal 0' }, { Name: 'var', Type: 2, Code: 'assign 1' }] }] },
    ])
    vm.vars.set('var', 1)
    expect(vm.dispatch('A')?.VarFloats?.[1].Code).toBe('assign 0')
    expect(vm.vars.get('var')).toBe(0)
    // After flipping, A's guard fails.
    expect(vm.dispatch('A')).toBeUndefined()
    expect(vm.dispatch('B')).toBeDefined()
    expect(vm.vars.get('var')).toBe(1)
  })

  it('flandre Start (2262182171): command chain drives motion lanes + clear_exp and mutates act=1', () => {
    const { host } = makeHost()
    const vm = new DSLVirtualMachine({ host })
    vm.loadGroups([
      {
        name: 'Start',
        entries: [{
          FadeIn: 0,
          FadeOut: 0,
          Command: 'start_mtn B10;start_mtn Sound#1:011501_051_01_01;start_mtn Face#2:07;clear_exp',
          VarFloats: [{ Name: 'act', Type: 2, Code: 'assign 1' }],
        }],
      },
    ])
    vm.dispatch('Start')
    expect(vm.vars.get('act')).toBe(1)
    const motion = host.motion!.startMotion as ReturnType<typeof vi.fn>
    const groups = motion.mock.calls.map(c => c[0].group)
    expect(groups).toEqual(expect.arrayContaining(['B10', 'Sound', 'Face']))
    expect(host.expression!.clearExpressions).toHaveBeenCalled()
  })

  it('bound Sound + Expression fire through ports', () => {
    const { host } = makeHost()
    const vm = new DSLVirtualMachine({ host })
    vm.loadGroups([
      {
        name: 'Sound#1',
        entries: [{
          Sound: 'Motions_Sound#1_0_Sound_0.wav',
          SoundChannel: 1,
          Expression: 'exp01.exp3',
          Text: 'これは咲夜が着付けしてくれたの！',
        }],
      },
    ])
    vm.dispatch('Sound#1')
    expect(host.sound!.playSound).toHaveBeenCalledWith('Motions_Sound#1_0_Sound_0.wav', expect.objectContaining({ channel: 1 }))
    expect(host.expression!.applyExpression).toHaveBeenCalledWith('exp01.exp3')
    expect(host.events!.showText).toHaveBeenCalledWith(expect.objectContaining({ text: 'これは咲夜が着付けしてくれたの！' }))
  })
})

describe('dSLVirtualMachine — intimacy gating + reward', () => {
  it('tapbody intimacy ladder: low intimacy only sees the always-available entry; bonus is written back', () => {
    const m = makeHost(0)
    const vm = new DSLVirtualMachine({ host: m.host })
    vm.loadGroups([
      {
        name: 'Tapbody',
        entries: [
          { Command: 'start_mtn B40', Intimacy: { Bonus: 1 }, Weight: 1 },
          { Command: 'start_mtn B50', Intimacy: { Min: 100, Bonus: 1 }, Weight: 1 },
        ],
      },
    ])
    const e = vm.dispatch('Tapbody')
    expect(e?.Command).toBe('start_mtn B40')
    expect(m.intimacy).toBe(1) // Bonus +1 applied
    expect(m.host.events!.onIntimacyChanged).toHaveBeenCalledWith(1, 1)
  })

  it('higher intimacy unlocks the Min-gated entry in the pool', () => {
    const m = makeHost(500)
    const vm = new DSLVirtualMachine({ host: m.host })
    vm.loadGroups([
      {
        name: 'Tapbody',
        entries: [
          { Command: 'start_mtn B40', Intimacy: { Bonus: 1 }, Weight: 1 },
          { Command: 'start_mtn B50', Intimacy: { Min: 100, Bonus: 1 }, Weight: 1 },
        ],
      },
    ])
    // With both eligible, run many times and confirm both can appear (weighted).
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const e = vm.dispatch('Tapbody')
      seen.add(e!.Command!)
    }
    expect(seen.size).toBe(2)
  })
})

describe('dSLVirtualMachine — choices menu + selectChoice', () => {
  const menu: DslMotionGroup = {
    name: 'Tapchange',
    entries: [{
      Text: '菜单',
      TextDuration: 5000,
      Choices: [
        { Text: '更换造型：原版皮肤', NextMtn: 'Next:cos' },
        { Text: '放置动作', NextMtn: 'Leave60_70_80' },
      ],
    }],
  }

  it('presents an interpolated Choices menu through the event bus and suspends the chain', () => {
    const { host } = makeHost()
    const vm = new DSLVirtualMachine({ host })
    vm.loadGroups([
      menu,
      { name: 'Next', entries: [{ Command: 'change_cos model1.json', VarFloats: [] }] },
    ])
    vm.dispatch('Tapchange')
    expect(vm.hasPendingChoices()).toBe(true)
    expect(host.events!.showChoices).toHaveBeenCalledWith(expect.objectContaining({
      text: '菜单',
      textDuration: 5000,
    }))
    const payload = (host.events!.showChoices as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload.choices).toHaveLength(2)
    expect(payload.choices[0]).toMatchObject({ text: '更换造型：原版皮肤', nextMtn: 'Next:cos' })
  })

  it('selectChoice follows NextMtn and runs the target (cos -> change_cos heap preserved)', () => {
    const { host } = makeHost()
    const vm = new DSLVirtualMachine({ host })
    vm.loadGroups([
      menu,
      // Next group holds the cos swap command (item-selected).
      { name: 'Next', entries: [{ Command: 'change_cos model1.json' }] },
    ])
    vm.vars.set('KeepMe', 7)
    vm.dispatch('Tapchange')
    vm.selectChoice(0) // -> Next:cos
    expect(host.events!.onCostumeWillSwap).toHaveBeenCalledWith('model1.json')
    expect(host.costume!.changeCostume).toHaveBeenCalledWith('model1.json')
    // change_cos must NOT wipe the VarFloats heap.
    expect(vm.vars.get('KeepMe')).toBe(7)
    expect(vm.hasPendingChoices()).toBe(false)
  })

  it('selectChoice with out-of-range index is a safe no-op', () => {
    const { host } = makeHost()
    const vm = new DSLVirtualMachine({ host })
    vm.loadGroups([menu])
    vm.dispatch('Tapchange')
    expect(vm.selectChoice(99)).toBeUndefined()
    expect(vm.hasPendingChoices()).toBe(false)
  })
})

describe('dSLVirtualMachine — double-click guard (3626567931)', () => {
  it('menu opens only when DoubleClickTimer>0 and resets it; DoubliClickAdd increments', () => {
    const { host } = makeHost()
    const vm = new DSLVirtualMachine({ host })
    vm.loadGroups([
      {
        name: 'DoubliClick',
        entries: [{
          Text: '菜单{$br}好感度: {$vi_IntimacyVI}',
          Choices: [{ Text: '送礼', NextMtn: '送礼菜单#99' }],
          VarFloats: [
            { Name: 'DoubleClickTimer', Type: 1, Code: 'greater 0' },
            { Name: 'DoubleClickTimer', Type: 2, Code: 'assign 0' },
          ],
        }],
      },
      { name: 'DoubliClickAdd', entries: [{ VarFloats: [{ Name: 'DoubleClickTimer', Type: 2, Code: 'add 1' }] }] },
    ])
    // First tap: timer=0, guard fails, menu should NOT open.
    expect(vm.dispatch('DoubliClick')).toBeUndefined()
    expect(vm.hasPendingChoices()).toBe(false)

    // Simulate a tap increment, then double-tap within window.
    vm.dispatch('DoubliClickAdd')
    expect(vm.vars.get('DoubleClickTimer')).toBe(1)
    expect(vm.dispatch('DoubliClick')).toBeDefined()
    expect(vm.hasPendingChoices()).toBe(true)
    expect(vm.vars.get('DoubleClickTimer')).toBe(0) // reset by the menu entry
  })
})

describe('dSLVirtualMachine — features + NextMtn chain', () => {
  it('motions enable/mouse_tracking/stop_sound/replace_tex route to the right ports', () => {
    const { host } = makeHost()
    const vm = new DSLVirtualMachine({ host })
    vm.loadGroups([
      {
        name: 'ctl',
        entries: [{
          Command: 'motions disable Leave60_70_80;mouse_tracking enable;stop_sound 2;replace_tex 0 base.png',
        }],
      },
    ])
    vm.dispatch('ctl')
    expect(vm.isMotionGroupEnabled('Leave60_70_80')).toBe(false)
    expect(host.motion!.setMotionGroupEnabled).toHaveBeenCalled()
    expect(host.tracking!.setMouseTracking).toHaveBeenCalledWith(true)
    expect(host.sound!.stopSound).toHaveBeenCalledWith(2)
    expect(host.texture!.replaceTexture).toHaveBeenCalledWith(0, 'base.png')
  })

  it('nextMtn chains follow through groups with hop-limit protection', () => {
    const { host } = makeHost()
    const vm = new DSLVirtualMachine({ host, maxHops: 5 })
    vm.loadGroups([
      { name: 'Loop', entries: [{ NextMtn: 'Loop' }] },
    ])
    // Should not hang; returns after bail.
    const r = vm.dispatch('Loop')
    expect(r).toBeDefined()
    expect(host.events!.showText).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('exceeded'),
    }))
  })

  it('next:item selection picks the indexed entry', () => {
    const { host } = makeHost()
    const vm = new DSLVirtualMachine({ host })
    vm.loadGroups([
      { name: 'Open', entries: [{ NextMtn: '送礼#99:2' }] },
      {
        name: '送礼',
        entries: [
          { Command: 'start_mtn X;start_mtn Sound#1:item0' },
          { Command: 'start_mtn X;start_mtn Sound#1:item1' },
          { Command: 'start_mtn X;start_mtn Sound#1:item2' },
        ],
      },
    ])
    const r = vm.dispatch('Open')
    expect(r?.Command).toContain('item2')
  })
})
