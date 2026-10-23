import type { CadenceBubbleRange } from '../libs/cadence/classifier'
import type { CadenceSegmentRecord } from '../libs/cadence/mapping'
import type { SpeechCadencePlanPayload } from '../services/speech/bus'

import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { reactive } from 'vue'

import { assignSegmentsToBubbles } from '../libs/cadence/mapping'
import { getSpeechBusContext, speechCadencePlanEvent, speechCadenceProgressEvent } from '../services/speech/bus'

export interface CadenceDeliveryPlanInput {
  bubbles: string[]
  ranges: CadenceBubbleRange[]
  beatsMs: number[]
  textDelaysMs: number[]
  contentLength: number
  /** Bubble count; mirrors bubbles.length locally, carried explicitly over the bus. */
  total: number
}

export type CadenceDeliveryStatus = 'active' | 'done' | 'released' | 'aborted'
export type CadenceDeliveryMode = 'voiced' | 'text'

interface CadenceArm {
  messageId: string
  sessionId: string
  intentId: string
  streamId: string
  mode: CadenceDeliveryMode
  segments: CadenceSegmentRecord[]
}

interface CadenceDeliveryEntry {
  messageId: string
  sessionId: string
  intentId: string
  mode: CadenceDeliveryMode
  total: number
  revealed: number
  status: CadenceDeliveryStatus
  beatsMs: number[]
  textDelaysMs: number[]
  bubbleAudioCount: number[]
  bubbleOfSegment: Map<string, number>
  cursor: number
  ranges: CadenceBubbleRange[]
  contentLength: number
  timers: ReturnType<typeof setTimeout>[]
  waiters: { bubble: number, resolve: (value: 'released' | 'aborted') => void }[]
}

const FIRST_AUDIO_READY_TIMEOUT_MS = 8000
/** Absolute failsafe so a missing plan resolution can never hang playback. */
const PLAN_WAIT_CEILING_MS = 30000

const originId = `cadence-${nanoid()}`
let busSubscribed = false
// TEMP-DELIVERY-DIAG: bound per-(intent,bubble) gate logging.
const loggedGateHolds = new Set<string>()
const loggedFirstSegment = new Set<string>()
const loggedGatePass = new Set<string>()

function stripPieceSuffix(segmentId: string, knownBases: Set<string>): string {
  if (knownBases.has(segmentId))
    return segmentId
  // Streaming TTS emits follow-up pieces as `${segmentId}:${n}`.
  const idx = segmentId.lastIndexOf(':')
  if (idx > 0) {
    const base = segmentId.slice(0, idx)
    const suffix = segmentId.slice(idx + 1)
    if (knownBases.has(base) && /^\d+$/.test(suffix))
      return base
  }
  return segmentId
}

export const useCadenceDeliveryStore = defineStore('cadence-delivery', () => {
  const arms = reactive(new Map<string, CadenceArm>())
  const armByMessage = reactive(new Map<string, string>())
  const entries = reactive(new Map<string, CadenceDeliveryEntry>())
  const planWaiters = reactive(new Map<string, Set<(value: 'released' | 'aborted') => void>>())

  function ensureBusSubscription() {
    if (busSubscribed || typeof window === 'undefined')
      return
    busSubscribed = true
    try {
      getSpeechBusContext().on(speechCadenceProgressEvent, (evt: any) => {
        const payload = evt?.body
        // TEMP-DELIVERY-DIAG
        console.info('[Cadence] progress received', { messageId: payload?.messageId, revealed: payload?.revealed, status: payload?.status, self: payload?.originId === originId })
        if (!payload || payload.originId === originId)
          return
        applyMirrorProgress(payload)
      })
      getSpeechBusContext().on(speechCadencePlanEvent, (evt: any) => {
        const payload = evt?.body as SpeechCadencePlanPayload | undefined
        if (!payload || payload.originId === originId)
          return
        // TEMP-DELIVERY-DIAG
        console.info('[Cadence] plan event received', { messageId: payload.messageId, bubbles: payload.plan?.total ?? 0 })
        ingestPlan(payload.messageId, payload.plan ? { ...payload.plan, bubbles: [] } : null)
      })
    }
    catch {
      // BroadcastChannel unavailable (tests/SSR) — local-only delivery.
    }
  }

  function broadcast(entry: CadenceDeliveryEntry) {
    // TEMP-DELIVERY-DIAG
    console.info('[Cadence] progress send', { messageId: entry.messageId, revealed: entry.revealed, total: entry.total, status: entry.status })
    try {
      // NOTICE: send a plain snapshot, never the reactive entry itself.
      // Entries carry waiter resolve functions and timer handles, which are
      // not structured-cloneable — posting them throws DataCloneError and
      // the progress update silently never leaves this window.
      getSpeechBusContext().emit(speechCadenceProgressEvent, {
        originId,
        messageId: entry.messageId,
        sessionId: entry.sessionId,
        revealed: entry.revealed,
        total: entry.total,
        status: entry.status,
      })
    }
    catch (err) {
      // TEMP-DELIVERY-DIAG
      console.info('[Cadence] progress broadcast failed, local-only delivery', { messageId: entry.messageId, err })
    }
  }

  function applyMirrorProgress(payload: { messageId: string, sessionId: string, revealed: number, total: number, status: CadenceDeliveryStatus }) {
    if (payload.status !== 'active') {
      entries.delete(payload.messageId)
      return
    }
    const existing = entries.get(payload.messageId)
    if (existing && existing.intentId !== '') {
      // Owner entries are authoritative locally; mirrors never overwrite them.
      return
    }
    entries.set(payload.messageId, {
      messageId: payload.messageId,
      sessionId: payload.sessionId,
      intentId: '',
      mode: 'text',
      total: payload.total,
      revealed: payload.revealed,
      status: 'active',
      beatsMs: [],
      textDelaysMs: [],
      bubbleAudioCount: [],
      bubbleOfSegment: new Map(),
      cursor: 0,
      ranges: [],
      contentLength: 0,
      timers: [],
      waiters: [],
    })
  }

  function clearTimers(entry: CadenceDeliveryEntry) {
    for (const timer of entry.timers)
      clearTimeout(timer)
    entry.timers = []
  }

  function releaseWaiters(entry: CadenceDeliveryEntry, value: 'released' | 'aborted') {
    const pending = entry.waiters.splice(0)
    for (const waiter of pending)
      waiter.resolve(value)
  }

  function wakePlanWaiters(intentId: string, value: 'released' | 'aborted') {
    const pending = planWaiters.get(intentId)
    if (!pending)
      return
    planWaiters.delete(intentId)
    for (const resolve of pending)
      resolve(value)
  }

  function finishEntry(messageId: string, status: Exclude<CadenceDeliveryStatus, 'active'>) {
    const entry = entries.get(messageId)
    if (!entry || entry.status !== 'active')
      return
    // TEMP-DELIVERY-DIAG
    console.info('[Cadence] finish', { messageId, status, revealed: entry.revealed, total: entry.total })
    clearTimers(entry)
    entry.status = status
    entry.revealed = entry.total
    broadcast(entry)
    releaseWaiters(entry, status === 'aborted' ? 'aborted' : 'released')
    entries.delete(messageId)
  }

  function armTurn(arm: { messageId: string, sessionId: string, intentId: string, streamId: string, mode: CadenceDeliveryMode }) {
    ensureBusSubscription()
    // A new turn supersedes any active arm for the same session.
    for (const [intentId, existing] of arms) {
      if (existing.sessionId === arm.sessionId && intentId !== arm.intentId) {
        abortByIntent(intentId)
      }
    }
    arms.set(arm.intentId, { ...arm, segments: [] })
    armByMessage.set(arm.messageId, arm.intentId)
    // TEMP-DELIVERY-DIAG
    console.info('[Cadence] arm', { messageId: arm.messageId, intentId: arm.intentId, mode: arm.mode })
  }

  function findArmByMessage(messageId: string): CadenceArm | undefined {
    const intentId = armByMessage.get(messageId)
    return intentId ? arms.get(intentId) : undefined
  }

  function assignCursor(entry: Pick<CadenceDeliveryEntry, 'bubbleOfSegment' | 'ranges'> & { cursor: number }, seg: CadenceSegmentRecord): number {
    const start = seg.sourceStart ?? -1
    let index = entry.cursor
    while (index < entry.ranges.length && entry.ranges[index].end <= start)
      index++
    if (index >= entry.ranges.length)
      index = entry.ranges.length - 1
    entry.bubbleOfSegment.set(seg.segmentId, index)
    entry.cursor = index
    return index
  }

  function recordSegment(intentId: string, seg: CadenceSegmentRecord) {
    ensureBusSubscription()
    // TEMP-DELIVERY-DIAG
    if (!loggedFirstSegment.has(intentId)) {
      loggedFirstSegment.add(intentId)
      console.info('[Cadence] first segment', { intentId, start: seg.sourceStart, end: seg.sourceEnd, special: seg.special, armed: arms.has(intentId) })
    }
    const arm = arms.get(intentId)
    if (arm) {
      arm.segments.push(seg)
      return
    }
    const entry = [...entries.values()].find(e => e.intentId === intentId)
    if (entry && entry.status === 'active') {
      // Defensive late arrival: post-plan segments are already ordered, so
      // cursor assignment stays correct; audio plays under revealed bubbles.
      if (seg.sourceStart != null && seg.sourceEnd != null) {
        const bubble = assignCursor(entry, seg)
        if (seg.sourceStart !== seg.sourceEnd)
          entry.bubbleAudioCount[bubble] = (entry.bubbleAudioCount[bubble] ?? 0) + 1
      }
    }
  }

  function bubbleForPlaybackSegment(entry: CadenceDeliveryEntry, playbackSegmentId: string): number | undefined {
    const bases = new Set(entry.bubbleOfSegment.keys())
    const base = stripPieceSuffix(playbackSegmentId, bases)
    return entry.bubbleOfSegment.get(base)
  }

  function scheduleTextTimer(entry: CadenceDeliveryEntry, fromBubble: number) {
    if (entry.status !== 'active' || fromBubble + 1 >= entry.total)
      return
    const expectedRevealed = fromBubble + 1
    const delay = entry.textDelaysMs[fromBubble] ?? 900
    entry.timers.push(setTimeout(() => {
      if (entry.status !== 'active' || entry.revealed !== expectedRevealed)
        return
      reveal(entry, fromBubble + 2)
    }, delay))
  }

  function reveal(entry: CadenceDeliveryEntry, count: number) {
    if (entry.status !== 'active')
      return
    const next = Math.min(count, entry.total)
    if (next <= entry.revealed)
      return
    entry.revealed = next
    // TEMP-DELIVERY-DIAG
    console.info('[Cadence] reveal', { messageId: entry.messageId, revealed: entry.revealed, total: entry.total })
    broadcast(entry)
    const pending = entry.waiters.filter(w => w.bubble < entry.revealed)
    entry.waiters = entry.waiters.filter(w => w.bubble >= entry.revealed)
    for (const waiter of pending)
      waiter.resolve('released')
    if (entry.revealed >= entry.total) {
      finishEntry(entry.messageId, 'done')
      return
    }
    // A silent next bubble advances on typing time; audio bubbles wait for arrival.
    if ((entry.bubbleAudioCount[entry.revealed] ?? 0) === 0)
      scheduleTextTimer(entry, entry.revealed - 1)
  }

  function onItemAtGate(entry: CadenceDeliveryEntry, bubble: number) {
    if (entry.status !== 'active')
      return
    if (bubble < entry.revealed)
      return
    // An item arriving ahead of the revealed frontier proves all prior
    // bubbles finished (strictly sequential playback). Do NOT reveal here:
    // the beat below paces the transition and reveals the arriving bubble.
    if (bubble === 0) {
      reveal(entry, 1)
      return
    }
    const expectedRevealed = entry.revealed
    const beat = entry.beatsMs[bubble - 1] ?? 900
    entry.timers.push(setTimeout(() => {
      if (entry.status !== 'active' || entry.revealed !== expectedRevealed)
        return
      reveal(entry, bubble + 1)
    }, beat))
  }

  function resolvePlan(messageId: string | undefined, plan: CadenceDeliveryPlanInput | null, sessionId?: string) {
    ensureBusSubscription()
    if (!messageId)
      return
    const arm = findArmByMessage(messageId)
    ingestPlan(messageId, plan)
    // Cross-window handoff: the planning window broadcasts so the executing
    // window (which owns the audio pipeline) can drive delivery. The local
    // call above already handled the single-window case.
    try {
      getSpeechBusContext().emit(speechCadencePlanEvent, {
        originId,
        messageId,
        sessionId: sessionId ?? arm?.sessionId ?? '',
        plan: plan
          ? {
              ranges: plan.ranges,
              beatsMs: plan.beatsMs,
              textDelaysMs: plan.textDelaysMs,
              contentLength: plan.contentLength,
              total: plan.bubbles.length,
            }
          : null,
      })
    }
    catch {
      // Local-only delivery when the bus is unavailable.
    }
  }

  function ingestPlan(messageId: string, plan: CadenceDeliveryPlanInput | null) {
    const arm = findArmByMessage(messageId)
    if (!arm) {
      if (plan && plan.total > 1) {
        // Planning or mirror window without a local arm: hold a shell entry
        // so the transcript shows typing dots until progress events arrive.
        // TEMP-DELIVERY-DIAG
        console.info('[Cadence] resolve: no local arm, mirror shell', { messageId, total: plan.total })
        const shell: CadenceDeliveryEntry = {
          messageId,
          sessionId: '',
          intentId: '',
          mode: 'text',
          total: plan.total,
          revealed: 0,
          status: 'active',
          beatsMs: [],
          textDelaysMs: [],
          bubbleAudioCount: [],
          bubbleOfSegment: new Map(),
          cursor: 0,
          ranges: [],
          contentLength: plan.contentLength,
          timers: [],
          waiters: [],
        }
        entries.set(messageId, shell)
        // If no window ever drives delivery, fall back to the static stack.
        shell.timers.push(setTimeout(() => {
          const current = entries.get(messageId)
          if (current && current.status === 'active' && current.revealed === 0 && current.intentId === '') {
            // TEMP-DELIVERY-DIAG
            console.info('[Cadence] mirror expired with no progress, static fallback', { messageId })
            clearTimers(current)
            entries.delete(messageId)
          }
        }, 20000))
      }
      return
    }
    arms.delete(arm.intentId)
    armByMessage.delete(messageId)

    if (!plan || plan.total <= 1) {
      // Single bubble, failure, or bypass: normal continuous playback.
      wakePlanWaiters(arm.intentId, 'released')
      return
    }

    const entry: CadenceDeliveryEntry = {
      messageId,
      sessionId: arm.sessionId,
      intentId: arm.intentId,
      mode: arm.mode,
      total: plan.total,
      revealed: 0,
      status: 'active',
      beatsMs: plan.beatsMs,
      textDelaysMs: plan.textDelaysMs,
      bubbleAudioCount: new Array(plan.bubbles.length).fill(0),
      bubbleOfSegment: new Map(),
      cursor: 0,
      ranges: plan.ranges,
      contentLength: plan.contentLength,
      timers: [],
      waiters: [],
    }

    const assignment = assignSegmentsToBubbles(arm.segments, plan.ranges, plan.contentLength)
    // TEMP-DELIVERY-DIAG
    console.info('[Cadence] resolve', { messageId, bubbles: plan.bubbles.length, segments: arm.segments.length, failed: assignment.failed, failure: assignment.failureReason })
    if (assignment.failed) {
      // Fail safe: reveal everything, let audio play continuously.
      entry.revealed = entry.total
      entry.status = 'released'
      broadcast(entry)
      wakePlanWaiters(arm.intentId, 'released')
      return
    }
    entry.bubbleOfSegment = assignment.bubbleOfSegment
    entry.cursor = plan.ranges.length - 1
    const textSegmentIds = new Set(
      arm.segments.filter(s => s.sourceStart != null && s.sourceStart !== s.sourceEnd).map(s => s.segmentId),
    )
    for (const [segmentId, bubble] of entry.bubbleOfSegment) {
      if (textSegmentIds.has(segmentId))
        entry.bubbleAudioCount[bubble] = (entry.bubbleAudioCount[bubble] ?? 0) + 1
    }
    // TEMP-DELIVERY-DIAG
    console.info('[Cadence] delivery start', { messageId, mode: entry.mode, audioCounts: entry.bubbleAudioCount })

    entries.set(messageId, entry)
    wakePlanWaiters(arm.intentId, 'released')

    if (entry.mode === 'text') {
      reveal(entry, 1)
      return
    }

    if ((entry.bubbleAudioCount[0] ?? 0) === 0) {
      // First bubble is silent: start the typing clock immediately.
      reveal(entry, 1)
      return
    }

    // Voiced: the first reveal fires when bubble-0 audio arrives at the gate.
    // Hang fallback: reveal everything if synthesis never delivers.
    entry.timers.push(setTimeout(() => {
      if (entry.status !== 'active' || entry.revealed > 0)
        return
      finishEntry(messageId, 'released')
    }, FIRST_AUDIO_READY_TIMEOUT_MS))
  }

  function waitForPlan(intentId: string, signal: AbortSignal): Promise<'released' | 'aborted'> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const pending = planWaiters.get(intentId)
        pending?.delete(settle)
        resolve('released')
      }, PLAN_WAIT_CEILING_MS)
      const settle = (value: 'released' | 'aborted') => {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      }
      const onAbort = () => {
        const pending = planWaiters.get(intentId)
        pending?.delete(settle)
        clearTimeout(timer)
        resolve('aborted')
      }
      let pending = planWaiters.get(intentId)
      if (!pending) {
        pending = new Set()
        planWaiters.set(intentId, pending)
      }
      pending.add(settle)
      signal.addEventListener('abort', onAbort, { once: true })
    })
  }

  async function gatePlaybackItem(intentId: string, playbackSegmentId: string, signal: AbortSignal): Promise<'released' | 'aborted'> {
    const entry = [...entries.values()].find(e => e.intentId === intentId)
    if (!entry) {
      // TEMP-DELIVERY-DIAG
      if (!loggedGatePass.has(intentId)) {
        loggedGatePass.add(intentId)
        console.info('[Cadence] gate pass-through (no plan yet)', { intentId, armed: arms.has(intentId) })
      }
      // Plan not resolved yet: hold until resolution, abort, or ceiling.
      if (!arms.has(intentId))
        return 'released'
      const outcome = await waitForPlan(intentId, signal)
      if (outcome === 'aborted')
        return 'aborted'
      return gatePlaybackItem(intentId, playbackSegmentId, signal)
    }
    if (entry.status !== 'active')
      return entry.status === 'aborted' ? 'aborted' : 'released'
    if (entry.mode === 'text')
      return 'released'

    const bubble = bubbleForPlaybackSegment(entry, playbackSegmentId)
    if (bubble === undefined) {
      // Unmapped audio (e.g. pacing fillers, which schedule straight to the
      // playback manager and never pass segmentation): let it play without
      // touching the reveal state.
      // TEMP-DELIVERY-DIAG
      const passKey = `${entry.intentId}:${playbackSegmentId}`
      if (!loggedGatePass.has(passKey)) {
        loggedGatePass.add(passKey)
        console.info('[Cadence] gate pass-through (unmapped segment)', { messageId: entry.messageId, playbackSegmentId })
      }
      return 'released'
    }
    if (bubble < entry.revealed)
      return 'released'
    if (signal.aborted)
      return 'aborted'

    onItemAtGate(entry, bubble)
    if (bubble < entry.revealed)
      return 'released'

    // TEMP-DELIVERY-DIAG
    const holdKey = `${entry.intentId}:${bubble}`
    if (!loggedGateHolds.has(holdKey)) {
      loggedGateHolds.add(holdKey)
      console.info('[Cadence] gate hold', { messageId: entry.messageId, bubble, revealed: entry.revealed })
    }

    return new Promise((resolve) => {
      const onAbort = () => {
        const idx = entry.waiters.findIndex(w => w.resolve === settle)
        if (idx >= 0)
          entry.waiters.splice(idx, 1)
        resolve('aborted')
      }
      const settle = (value: 'released' | 'aborted') => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      }
      entry.waiters.push({ bubble, resolve: settle })
      signal.addEventListener('abort', onAbort, { once: true })
      // Re-check: the reveal may have landed while registering.
      if (bubble < entry.revealed) {
        const idx = entry.waiters.findIndex(w => w.resolve === settle)
        if (idx >= 0)
          entry.waiters.splice(idx, 1)
        signal.removeEventListener('abort', onAbort)
        resolve('released')
      }
    })
  }

  function notifyIntentEnd(intentId: string) {
    const entry = [...entries.values()].find(e => e.intentId === intentId)
    if (!entry || entry.status !== 'active')
      return
    arms.delete(intentId)
    // Intent end fires after the final playback item ended: delivery is done.
    finishEntry(entry.messageId, 'done')
  }

  function notifyIntentCancel(intentId: string) {
    abortByIntent(intentId)
  }

  function abortByIntent(intentId: string) {
    const arm = arms.get(intentId)
    if (arm) {
      arms.delete(intentId)
      armByMessage.delete(arm.messageId)
    }
    wakePlanWaiters(intentId, 'aborted')
    const entry = [...entries.values()].find(e => e.intentId === intentId)
    if (!entry || entry.status !== 'active')
      return
    // Stop reveals the remainder; audio buffers were dropped by cancellation.
    finishEntry(entry.messageId, 'aborted')
  }

  function abortTurn(messageId: string | undefined) {
    if (!messageId)
      return
    const arm = findArmByMessage(messageId)
    if (arm) {
      arms.delete(arm.intentId)
      armByMessage.delete(messageId)
      wakePlanWaiters(arm.intentId, 'aborted')
    }
    const entry = entries.get(messageId)
    if (entry && entry.status === 'active')
      finishEntry(messageId, 'aborted')
  }

  /** Active staged reveal count for a message, or null when rendering statically. */
  function revealedFor(messageId: string | undefined): number | null {
    ensureBusSubscription()
    if (!messageId)
      return null
    const entry = entries.get(messageId)
    if (!entry || entry.status !== 'active')
      return null
    return entry.revealed
  }

  return {
    armTurn,
    recordSegment,
    resolvePlan,
    gatePlaybackItem,
    notifyIntentEnd,
    notifyIntentCancel,
    abortTurn,
    abortByIntent,
    revealedFor,
  }
})
