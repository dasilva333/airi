/**
 * DSLVirtualMachine — the entry dispatcher / state engine.
 *
 * Given a manifest's motion groups (each a list of candidate entries), the VM:
 *   1. selects an eligible entry (guards → intimacy → time → weighted pick),
 *   2. applies that entry's Type-2 mutations atomically,
 *   3. runs its Command chain through the output ports,
 *   4. applies intimacy Bonus write-back,
 *   5. presents Choices / Text through the event bus,
 *   6. follows `NextMtn` chains (starting a named group) with loop protection.
 *
 * The renderer is fully owned by the host; this VM touches only the injected ports.
 */

import type { Live2DRuntimePorts } from '../ports'
import type { IClockLike } from './selector'
import type { DslCommand, DslEntry, DslMotionGroup, ResolvedChoice } from './types'

import { parseCommandChain, parseMotionRef } from './command-parser'
import { filterEligibleEntries, weightedPick } from './selector'
import { interpolate } from './template'
import { ReactiveVarStore } from './var-store'

/** Host = the runtime's output ports plus test-friendly RNG override. */
export type VMHost = Live2DRuntimePorts & { random?: () => number }

export interface VMOptions {
  host?: VMHost
  random?: () => number
  /** Max NextMtn / group hops per dispatch before bailing (guards against cycles). */
  maxHops?: number
  /** Preferred UI language for Choices/Text variants (`Language` field). */
  language?: string
}

export class DSLVirtualMachine {
  readonly vars: ReactiveVarStore
  private readonly groups = new Map<string, DslMotionGroup>()
  private readonly host: VMHost
  private readonly random: () => number
  private readonly maxHops: number
  private readonly clock?: IClockLike
  private language?: string
  private readonly motionGroupEnabled = new Map<string, boolean>()
  private pendingChoices: { text?: string, textDuration?: number, choices: ResolvedChoice[], rawEntry: DslEntry } | null = null

  constructor(options: VMOptions = {}) {
    this.random = options.random ?? Math.random
    this.vars = new ReactiveVarStore(this.random)
    this.host = options.host ?? {}
    this.maxHops = options.maxHops ?? 64
    this.clock = options.host?.clock
    this.language = options.language
  }

  setLanguage(language: string): void {
    this.language = language
  }

  /** Register/replace the manifest's motion groups. Existing heap state is preserved. */
  loadGroups(groups: readonly DslMotionGroup[]): void {
    this.groups.clear()
    for (const g of groups)
      this.groups.set(g.name, g)
  }

  /** Merge more groups in (e.g. loaded incrementally) without clearing. */
  addGroups(groups: readonly DslMotionGroup[]): void {
    for (const g of groups)
      this.groups.set(g.name, g)
  }

  /** Current intimacy (0 when the host doesn't provide a store). */
  private get intimacy(): number {
    return this.host.intimacy?.getIntimacy() ?? 0
  }

  /** Whether a named motion pool is enabled (motions enable/disable). */
  isMotionGroupEnabled(name: string): boolean {
    return this.motionGroupEnabled.get(name) ?? true
  }

  /** Whether a Choices menu is awaiting a selection. */
  hasPendingChoices(): boolean {
    return this.pendingChoices !== null
  }

  getPendingChoices(): { text?: string, textDuration?: number, choices: ResolvedChoice[], rawEntry: DslEntry } | null {
    return this.pendingChoices
  }

  /** Pick among the language-appropriate variants of an entry list. */
  private preferLanguage<T extends DslEntry>(variants: readonly T[]): readonly T[] {
    if (!this.language)
      return variants
    const matches = variants.filter(v => v.Language?.toLowerCase() === this.language!.toLowerCase())
    return matches.length > 0 ? matches : variants
  }

  /**
   * Dispatch a trigger (touch area, menu hop, idle tick, start) by group name.
   * Returns the resolved entry, or undefined when no eligible entry exists.
   * `ref` may carry a `:item` selector to bias toward a specific named entry.
   */
  dispatch(groupName: string): DslEntry | undefined {
    const { group, item, lane } = parseMotionRef(groupName)
    // A `#lane` hint on a dispatch target must not shadow the group: a manifest may
    // genuinely name a group `Sound#1` (lane 99 suffixes are routing hints). Try the
    // full name first, then fall back to the base group (lane hint stripped).
    if (lane !== undefined && this.groups.has(groupName) && !this.groups.has(group))
      return this.runGroup(groupName, item, 0)
    return this.runGroup(group, item, 0)
  }

  /** Resume a pending choice menu: pick by index and follow its NextMtn. */
  selectChoice(index: number): DslEntry | undefined {
    const pending = this.pendingChoices
    this.pendingChoices = null
    if (!pending || index < 0 || index >= pending.choices.length)
      return undefined
    const choice = pending.choices[index]
    if (!choice.nextMtn)
      return undefined
    return this.dispatch(choice.nextMtn)
  }

  private runGroup(groupName: string, item: string | undefined, hop: number): DslEntry | undefined {
    if (hop > this.maxHops) {
      // Cycles are possible in hand-authored NextMtn chains; bail loudly via events, not console.
      this.host.events?.showText({
        text: `[live2d-runtime] NextMtn chain exceeded ${this.maxHops} hops at "${groupName}" — possible cycle; bailing.`,
        rawEntry: {},
      })
      return undefined
    }

    const group = this.groups.get(groupName)
    if (!group)
      return undefined

    // If a specific item was requested (e.g. `送礼#99:香水`), prefer the entry whose
    // identity matches; group entries are positional, so we index by the requested name
    // when we can find it, else fall through to weighted selection.
    let candidates: readonly DslEntry[] = group.entries
    if (item !== undefined) {
      const idx = Number.parseInt(item, 10)
      if (!Number.isNaN(idx) && group.entries[idx])
        candidates = [group.entries[idx]]
    }

    candidates = this.preferLanguage(candidates)

    const eligible = filterEligibleEntries(candidates, {
      vars: this.vars,
      intimacy: this.intimacy,
      clock: this.clock,
    })

    const entry = weightedPick(eligible, this.random)
    if (!entry)
      return undefined

    return this.executeEntry(entry, hop)
  }

  /** Apply an entry: mutations → command → sound/expression → intimacy → choices/text → NextMtn. */
  private executeEntry(entry: DslEntry, hop: number): DslEntry {
    // 1. Atomic guard+mutation application. Guards were re-checked here to be safe.
    this.vars.applyAll(entry.VarFloats)

    // 2. Command chain (motion start / feature toggles / costume swap ...).
    if (entry.Command)
      this.runCommands(parseCommandChain(entry.Command), hop)

    // 3. Bound sound + expression (start_mtn audio lane equivalents).
    if (entry.Sound) {
      this.host.sound?.playSound(entry.Sound, {
        channel: entry.SoundChannel ?? 0,
        loop: entry.SoundLoop,
        volume: entry.SoundVolume,
      })
    }
    if (entry.Expression)
      this.host.expression?.applyExpression(entry.Expression)

    // 4. Intimacy reward write-back.
    const bonus = entry.Intimacy?.Bonus
    if (typeof bonus === 'number' && bonus !== 0 && this.host.intimacy) {
      this.host.intimacy.addIntimacy(bonus)
      const next = this.host.intimacy.getIntimacy()
      this.host.events?.onIntimacyChanged(next, bonus)
    }

    // 5. Choices / Text through the UI bridge (interpolated).
    const text = entry.Text !== undefined
      ? interpolate(entry.Text, { vars: this.vars, intimacy: this.intimacy, now: this.clock?.now() })
      : undefined
    if (entry.Choices && entry.Choices.length > 0) {
      const choices: ResolvedChoice[] = entry.Choices.map(c => ({
        text: interpolate(c.Text, { vars: this.vars, intimacy: this.intimacy, now: this.clock?.now() }),
        nextMtn: c.NextMtn,
        raw: c,
      }))
      this.pendingChoices = { text, textDuration: entry.TextDuration, choices, rawEntry: entry }
      this.host.events?.showChoices(this.pendingChoices)
      // A Choices menu suspends the chain until the host calls selectChoice().
      return entry
    }
    if (text !== undefined && text.length > 0)
      this.host.events?.showText({ text, duration: entry.TextDuration, rawEntry: entry })

    // 6. PostCommand runs after the entry's immediate effects resolve.
    if (entry.PostCommand)
      this.runCommands(parseCommandChain(entry.PostCommand), hop)

    // 7. Follow NextMtn.
    if (entry.NextMtn) {
      const next = parseMotionRef(entry.NextMtn)
      const followed = this.runGroup(next.group, next.item, hop + 1)
      return followed ?? entry
    }

    return entry
  }

  /** Run a parsed command chain through the ports. */
  private runCommands(commands: readonly DslCommand[], hop: number): void {
    for (const cmd of commands) {
      switch (cmd.kind) {
        case 'start_mtn': {
          // A start_mtn targeting a group we hold registers as both a viewport motion
          // directive *and* a DSL group dispatch; the renderer resolves which is physical.
          this.host.motion?.startMotion(cmd.target)
          if (this.groups.has(cmd.target.group))
            this.runGroup(cmd.target.group, cmd.target.item, hop + 1)
          break
        }
        case 'clear_exp':
          this.host.expression?.clearExpressions()
          break
        case 'change_cos':
          this.host.events?.onCostumeWillSwap(cmd.modelFile)
          this.host.costume?.changeCostume(cmd.modelFile)
          break
        case 'motions':
          this.motionGroupEnabled.set(cmd.target.group, cmd.enabled)
          this.host.motion?.setMotionGroupEnabled(cmd.target, cmd.enabled)
          break
        case 'mouse_tracking':
          this.host.tracking?.setMouseTracking(cmd.enabled)
          break
        case 'eye_blink':
          this.host.tracking?.setEyeBlink(cmd.enabled)
          break
        case 'stop_sound':
          this.host.sound?.stopSound(cmd.channel)
          break
        case 'replace_tex':
          this.host.texture?.replaceTexture(cmd.textureIndex, cmd.file)
          break
        case 'noop':
          break
      }
    }
  }
}

export { ReactiveVarStore }
