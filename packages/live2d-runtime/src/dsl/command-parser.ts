/**
 * CommandParser — parses `;`-delimited macro strings from `Command`/`PostCommand`.
 *
 * Target grammar (lane-aware):  `Group[#lane][:item]`
 *   start_mtn B40                          -> { group: 'B40' }
 *   start_mtn Sound#1:011501_051_01_01     -> { group: 'Sound', lane: 1, item: '011501_051_01_01' }
 *   change_cos model1.json                 -> costume swap
 *   motions disable Leave60_70_80          -> motion-pool gate
 *   stop_sound 2                           -> channel stop
 *   replace_tex 0 Motions_x.png            -> texture swap
 */

import type { DslCommand, MotionRef } from './types'

/** Parse a `Group[#lane][:item]` reference, preserving the raw string. */
export function parseMotionRef(target: string): MotionRef {
  const raw = target
  const colonIdx = target.indexOf(':')
  let head = target
  let item: string | undefined
  if (colonIdx >= 0) {
    head = target.slice(0, colonIdx)
    item = target.slice(colonIdx + 1)
  }

  const hashIdx = head.indexOf('#')
  let group = head
  let lane: number | undefined
  if (hashIdx >= 0) {
    group = head.slice(0, hashIdx)
    const laneNum = Number.parseInt(head.slice(hashIdx + 1), 10)
    if (!Number.isNaN(laneNum))
      lane = laneNum
  }

  return { group, lane, item, raw }
}

function onOff(token: string | undefined): boolean {
  return token?.toLowerCase() === 'enable' || token?.toLowerCase() === 'on'
}

/** Parse one whitespace-split command token-list into a DslCommand. */
function parseOne(statement: string): DslCommand {
  const raw = statement.trim()
  if (!raw)
    return { kind: 'noop', raw }

  const [head, ...rest] = raw.split(/\s+/)
  const verb = head.toLowerCase()

  switch (verb) {
    case 'start_mtn': {
      const target = parseMotionRef(rest.join(' '))
      return { kind: 'start_mtn', target, raw }
    }
    case 'clear_exp':
      return { kind: 'clear_exp', raw }
    case 'change_cos':
      return { kind: 'change_cos', modelFile: rest.join(' '), raw }
    case 'motions': {
      const enabled = onOff(rest[0])
      const target = parseMotionRef(rest.slice(1).join(' '))
      return { kind: 'motions', enabled, target, raw }
    }
    case 'mouse_tracking':
      return { kind: 'mouse_tracking', enabled: onOff(rest[0]), raw }
    case 'eye_blink':
      return { kind: 'eye_blink', enabled: onOff(rest[0]), raw }
    case 'stop_sound': {
      const channel = Number.parseInt(rest[0] ?? '0', 10)
      return { kind: 'stop_sound', channel: Number.isNaN(channel) ? 0 : channel, raw }
    }
    case 'replace_tex': {
      const textureIndex = Number.parseInt(rest[0] ?? '0', 10)
      const file = rest.slice(1).join(' ')
      return { kind: 'replace_tex', textureIndex: Number.isNaN(textureIndex) ? 0 : textureIndex, file, raw }
    }
    default:
      // Unrecognized verbs are preserved as noops rather than dropped, so the
      // sequencer ordering stays intact and a host can introspect them.
      return { kind: 'noop', raw }
  }
}

/** Split a command chain on `;` and parse each statement in order. */
export function parseCommandChain(chain: string | undefined): DslCommand[] {
  if (!chain)
    return []
  return chain
    .split(';')
    .map(parseOne)
    .filter(c => c.kind !== 'noop' || c.raw.length > 0)
}
