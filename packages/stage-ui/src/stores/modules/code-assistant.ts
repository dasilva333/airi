import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useSpine } from '@proj-airi/stage-ui-spine'
import { useModelStore } from '@proj-airi/stage-ui-three'
import { useBroadcastChannel } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, getCurrentInstance, onUnmounted, ref, watch } from 'vue'

import { useEventLogStore } from '../event-log'
import { useModsServerChannelStore } from '../mods/api/channel-server'
import { useSettings } from '../settings'
import { useAiriCardStore } from './airi-card'

export type CodeAssistantState = 'work' | 'wait' | 'done' | 'idle' | 'error'

export interface CodeAssistantStatePayload {
  state: CodeAssistantState
  sessionId?: string
  assistant?: string
  source?: string
  headline?: string
  note?: string
  tool?: string
  timestamp?: number
}

export interface StateReactionMapping {
  expression?: string
  motion?: string
  sound?: string
  captionEnabled: boolean
  captionTemplate: string
}

export interface CharacterCodeAssistantConfig {
  enabled: boolean
  reactions: Record<CodeAssistantState, StateReactionMapping>
}

export type CodeAssistantCaptionSurface = 'follow' | 'above' | 'window' | 'off'

export interface ActiveAssistantSession {
  sessionId: string
  state: CodeAssistantState
  assistant: string
  headline?: string
  note?: string
  tool?: string
  lastUpdated: number
  payload: CodeAssistantStatePayload
}

export interface CodeAssistantStatusInfo {
  badge: 'ready' | 'paused' | 'setup_needed'
  text: string
}

export function createDefaultCharacterReactionConfig(): CharacterCodeAssistantConfig {
  return {
    enabled: true,
    reactions: {
      work: {
        expression: 'Focused',
        motion: 'Typing',
        sound: 'None',
        captionEnabled: true,
        captionTemplate: 'Working on {headline}',
      },
      wait: {
        expression: 'Curious',
        motion: 'Raise hand',
        sound: 'Soft ding',
        captionEnabled: true,
        captionTemplate: '{headline}: {note}',
      },
      done: {
        expression: 'Happy',
        motion: 'Celebrate',
        sound: 'Chime',
        captionEnabled: true,
        captionTemplate: 'Complete: {headline}',
      },
      idle: {
        expression: 'Neutral',
        motion: 'Breathing',
        sound: 'None',
        captionEnabled: false,
        captionTemplate: '',
      },
      error: {
        expression: 'Concerned',
        motion: 'Sigh',
        sound: 'Alert',
        captionEnabled: true,
        captionTemplate: 'Error: {headline} - {note}',
      },
    },
  }
}

export function resolveCaptionText(template: string, payload: Partial<CodeAssistantStatePayload>): string {
  if (!template)
    return ''
  return template
    .replace(/\{headline\}/gi, payload.headline || '')
    .replace(/\{note\}/gi, payload.note || '')
    .replace(/\{tool\}/gi, payload.tool || '')
    .trim()
}

/**
 * Priority resolution order:
 * 1. error (critical issue encountered)
 * 2. wait / "Needs you" (blocking user prompt / confirmation)
 * 3. work / "Working" (agent currently executing tools / code)
 * 4. done / "Complete" (turn completed)
 * 5. idle (no active work)
 */
export function resolveEffectiveState(
  sessions: ActiveAssistantSession[],
  idleTimeoutMs: number,
  now: number = Date.now(),
): {
  effectiveState: CodeAssistantState
  dominantSession?: ActiveAssistantSession
} {
  const activeSessions = sessions.filter(s => (now - s.lastUpdated) < idleTimeoutMs && s.state !== 'idle')

  if (activeSessions.length === 0) {
    return { effectiveState: 'idle' }
  }

  // Precedence 1: error
  const errorSession = activeSessions.find(s => s.state === 'error')
  if (errorSession) {
    return { effectiveState: 'error', dominantSession: errorSession }
  }

  // Precedence 2: wait
  const waitSession = activeSessions.find(s => s.state === 'wait')
  if (waitSession) {
    return { effectiveState: 'wait', dominantSession: waitSession }
  }

  // Precedence 3: work
  const workSession = activeSessions.find(s => s.state === 'work')
  if (workSession) {
    return { effectiveState: 'work', dominantSession: workSession }
  }

  // Precedence 4: done
  const doneSession = activeSessions.find(s => s.state === 'done')
  if (doneSession) {
    return { effectiveState: 'done', dominantSession: doneSession }
  }

  return { effectiveState: 'idle' }
}

export const useCodeAssistantStore = defineStore('code-assistant', () => {
  // 1. Settings (Persisted)
  const enabled = useLocalStorageManualReset<boolean>('settings/code-assistant/enabled', true)
  const captionSurface = useLocalStorageManualReset<CodeAssistantCaptionSurface>('settings/code-assistant/caption-surface', 'follow')
  const idleTimeoutSeconds = useLocalStorageManualReset<number>('settings/code-assistant/idle-timeout-seconds', 90)
  const recordEventLedger = useLocalStorageManualReset<boolean>('settings/code-assistant/record-event-ledger', true)
  const characterConfigs = useLocalStorageManualReset<Record<string, CharacterCodeAssistantConfig>>('settings/code-assistant/character-configs', {})

  // 2. Ephemeral State
  const activeSessions = ref<ActiveAssistantSession[]>([])
  const effectiveState = ref<CodeAssistantState>('idle')
  const isPreviewing = ref(false)
  const previewTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const cheerTimer = ref<ReturnType<typeof setTimeout> | null>(null)

  // External stores
  const airiCardStore = useAiriCardStore()
  const settingsStore = useSettings()

  // Broadcast channel for caption bubbles
  const { post: postCaption } = useBroadcastChannel<any, any>({ name: 'airi-caption-overlay' })

  // Active On-Stage Character ID
  const activeCharacterId = computed(() => airiCardStore.activeCardId || '')
  const activeCharacterName = computed(() => airiCardStore.activeCard?.name || 'Companion')

  // Character config for currently active character
  const activeCharacterConfig = computed<CharacterCodeAssistantConfig | null>(() => {
    if (!activeCharacterId.value)
      return null
    return characterConfigs.value[activeCharacterId.value] || null
  })

  // Status computation
  const statusInfo = computed<CodeAssistantStatusInfo>(() => {
    if (!enabled.value) {
      return {
        badge: 'paused',
        text: 'Paused · Notifications are disabled',
      }
    }

    const cfg = activeCharacterConfig.value
    if (!cfg || !cfg.enabled) {
      return {
        badge: 'setup_needed',
        text: `Setup needed · ${activeCharacterName.value} has no reactions configured`,
      }
    }

    return {
      badge: 'ready',
      text: `Ready · ${activeCharacterName.value} is responding to assistant events`,
    }
  })

  // Synthesized Web Audio cues (zero external file dependencies)
  function playSoundCue(soundName?: string) {
    if (!soundName || soundName === 'None')
      return

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx)
        return
      const ctx = new AudioCtx()
      const now = ctx.currentTime

      const playTone = (freq: number, startTime: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.15) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(freq, startTime)
        gain.gain.setValueAtTime(gainVal, startTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(startTime)
        osc.stop(startTime + duration)
      }

      switch (soundName) {
        case 'Soft ding':
          playTone(880, now, 0.4, 'sine', 0.2) // A5
          playTone(1320, now + 0.05, 0.5, 'sine', 0.1) // E6 harmonic
          break
        case 'Chime':
          playTone(523.25, now, 0.35, 'triangle', 0.15) // C5
          playTone(659.25, now + 0.12, 0.35, 'triangle', 0.15) // E5
          playTone(783.99, now + 0.24, 0.6, 'sine', 0.2) // G5
          break
        case 'Alert':
          playTone(440, now, 0.15, 'sawtooth', 0.15)
          playTone(330, now + 0.18, 0.3, 'sawtooth', 0.15)
          break
        case 'Success fanfare':
          playTone(523.25, now, 0.15, 'sine', 0.15) // C5
          playTone(659.25, now + 0.12, 0.15, 'sine', 0.15) // E5
          playTone(783.99, now + 0.24, 0.15, 'sine', 0.15) // G5
          playTone(1046.50, now + 0.36, 0.7, 'triangle', 0.2) // C6
          break
        default:
          break
      }
    }
    catch (e) {
      // AudioContext may be suspended or unavailable in headless environments
      console.warn('[CodeAssistant] Web Audio playback ignored:', e)
    }
  }

  // Expression & Motion Actuation across all 4 avatar engines
  function triggerExpression(emotion?: string) {
    if (!emotion || emotion === 'None' || emotion === 'none')
      return
    const renderer = settingsStore.stageModelRenderer
    try {
      if (renderer === 'live2d') {
        useLive2d().triggerEmotion(emotion, 1.0)
      }
      else if (renderer === 'vrm') {
        useModelStore().triggerEmotion(emotion, 1.0)
      }
      else if (renderer === 'mmd') {
        const mmd = useMmd()
        mmd.previewExpression = emotion
        setTimeout(() => {
          if (mmd.previewExpression === emotion)
            mmd.previewExpression = null
        }, 3000)
      }
      else if (renderer === 'spine') {
        const spine = useSpine()
        const match = emotion.match(/^(.+?)\s*\[(.+?)\]$/)
        if (match) {
          spine.selectVariantAndSkin(match[1], match[2])
        }
      }
    }
    catch (err) {
      console.warn('[CodeAssistant] Expression trigger error:', err)
    }
  }

  function triggerMotion(motion?: string) {
    if (!motion || motion === 'None' || motion === 'none')
      return
    const renderer = settingsStore.stageModelRenderer
    try {
      if (renderer === 'live2d') {
        useLive2d().triggerMotion(motion)
      }
      else if (renderer === 'vrm') {
        useModelStore().triggerMotion(motion)
      }
      else if (renderer === 'mmd') {
        useMmd().playOneShotAction(motion)
      }
      else if (renderer === 'spine') {
        useSpine().playOneShotAnimation(motion)
      }
    }
    catch (err) {
      console.warn('[CodeAssistant] Motion trigger error:', err)
    }
  }

  function emitCaption(speakerName: string, text: string) {
    if (!text || captionSurface.value === 'off') {
      clearCaption()
      return
    }

    try {
      postCaption({
        type: 'caption-speaker',
        text: speakerName,
      })
      postCaption({
        type: 'caption-assistant',
        segments: [{
          text,
          color: '#a855f7',
          actorId: 'assistant',
          isActive: true,
        }],
      })
    }
    catch (err) {
      console.warn('[CodeAssistant] Caption emit error:', err)
    }
  }

  function clearCaption() {
    try {
      postCaption({ type: 'caption-speaker', text: '' })
      postCaption({ type: 'caption-assistant', segments: [] })
    }
    catch {}
  }

  // Unified Actuator
  function actuateState(
    state: CodeAssistantState,
    payload: Partial<CodeAssistantStatePayload>,
    config: CharacterCodeAssistantConfig,
    isPreview = false,
  ) {
    const reaction = config.reactions[state]
    if (!reaction)
      return

    // 1. Actuate expression & motion
    triggerExpression(reaction.expression)
    triggerMotion(reaction.motion)

    // 2. Play auditory cue
    playSoundCue(reaction.sound)

    // 3. Caption formatting & broadcast
    const resolvedText = reaction.captionEnabled
      ? resolveCaptionText(reaction.captionTemplate, payload)
      : ''

    const speakerName = payload.assistant
      ? `${payload.assistant.toUpperCase()} ASSISTANT`
      : 'CODE ASSISTANT'

    if (resolvedText) {
      emitCaption(speakerName, resolvedText)
    }
    else {
      clearCaption()
    }

    // 4. Record in Event Ledger (Live mode only)
    if (!isPreview && recordEventLedger.value) {
      try {
        const eventLogStore = useEventLogStore()
        eventLogStore.appendEvent({
          category: 'tools',
          type: `code-assistant:${state}`,
          source: payload.assistant || 'code-assistant',
          textSummary: `[${state.toUpperCase()}] ${resolvedText || payload.headline || state}`,
          payload: {
            ...payload,
            effectiveState: state,
          },
          inspectable: true,
        })
      }
      catch (err) {
        console.warn('[CodeAssistant] Failed to record in Event Ledger:', err)
      }
    }
  }

  // Ingestion handler for inbound agent events (REST or WebSocket)
  function handleAssistantState(payload: CodeAssistantStatePayload) {
    console.info('[CodeAssistant] 📥 Inbound assistant state event received:', payload)
    const sessionId = payload.sessionId || 'default'
    const now = payload.timestamp || Date.now()

    // 1. Check master switch
    if (!enabled.value) {
      console.warn('[CodeAssistant] Event ignored: Code Assistant Notifications master switch is disabled.')
      return { handled: false, reason: 'disabled' }
    }

    // 2. Check active on-stage character configuration
    const activeCfg = activeCharacterConfig.value
    if (!activeCfg || !activeCfg.enabled) {
      console.warn(`[CodeAssistant] Event ignored: Active character "${activeCharacterName.value}" (${activeCharacterId.value}) has notifications disabled or unconfigured.`)
      return { handled: false, reason: 'character_unconfigured' }
    }

    console.info(`[CodeAssistant] 🎭 Actuating state "${payload.state}" for "${activeCharacterName.value}"`)

    // 3. Update session record
    const existingIndex = activeSessions.value.findIndex(s => s.sessionId === sessionId)
    const sessionRecord: ActiveAssistantSession = {
      sessionId,
      state: payload.state,
      assistant: payload.assistant || payload.source || 'assistant',
      headline: payload.headline,
      note: payload.note,
      tool: payload.tool,
      lastUpdated: now,
      payload,
    }

    if (existingIndex >= 0) {
      activeSessions.value[existingIndex] = sessionRecord
    }
    else {
      activeSessions.value.push(sessionRecord)
    }

    // 4. Resolve multi-session effective state
    const timeoutMs = (idleTimeoutSeconds.value || 90) * 1000
    const { effectiveState: nextState, dominantSession } = resolveEffectiveState(activeSessions.value, timeoutMs, now)

    // Clear any existing cheer transition timer
    if (cheerTimer.value) {
      clearTimeout(cheerTimer.value)
      cheerTimer.value = null
    }

    effectiveState.value = nextState
    const targetPayload = dominantSession ? dominantSession.payload : payload

    // 5. Actuate avatar
    actuateState(nextState, targetPayload, activeCfg, false)

    // If transitioned to 'done', set a 12s timer to settle back into idle
    if (nextState === 'done') {
      cheerTimer.value = setTimeout(() => {
        if (effectiveState.value === 'done') {
          effectiveState.value = 'idle'
          if (activeCharacterConfig.value) {
            actuateState('idle', { headline: 'Idle' }, activeCharacterConfig.value, false)
          }
        }
      }, 12000)
    }

    return { handled: true, effectiveState: nextState }
  }

  // Periodic Watchdog: cleans up timed-out sessions
  let watchdogInterval: ReturnType<typeof setInterval> | null = null

  function sweepStaleSessions() {
    if (activeSessions.value.length === 0)
      return
    const now = Date.now()
    const timeoutMs = (idleTimeoutSeconds.value || 90) * 1000
    const activeBefore = activeSessions.value.length

    activeSessions.value = activeSessions.value.filter(s => (now - s.lastUpdated) < timeoutMs)

    if (activeSessions.value.length !== activeBefore) {
      const { effectiveState: nextState, dominantSession } = resolveEffectiveState(activeSessions.value, timeoutMs, now)
      if (nextState !== effectiveState.value) {
        effectiveState.value = nextState
        if (activeCharacterConfig.value) {
          actuateState(nextState, dominantSession ? dominantSession.payload : {}, activeCharacterConfig.value, false)
        }
      }
    }
  }

  // Character config management
  function getOrInitCharacterConfig(characterId: string): CharacterCodeAssistantConfig {
    if (!characterConfigs.value[characterId]) {
      const fresh = createDefaultCharacterReactionConfig()
      characterConfigs.value = {
        ...characterConfigs.value,
        [characterId]: fresh,
      }
      return fresh
    }
    return characterConfigs.value[characterId]
  }

  function updateCharacterConfig(characterId: string, partial: Partial<CharacterCodeAssistantConfig>) {
    const current = getOrInitCharacterConfig(characterId)
    characterConfigs.value = {
      ...characterConfigs.value,
      [characterId]: {
        ...current,
        ...partial,
      },
    }
  }

  function copyCharacterConfig(fromCharacterId: string, toCharacterId: string) {
    const source = characterConfigs.value[fromCharacterId]
    if (!source)
      return
    characterConfigs.value = {
      ...characterConfigs.value,
      [toCharacterId]: JSON.parse(JSON.stringify(source)),
    }
  }

  function resetCharacterConfig(characterId: string) {
    characterConfigs.value = {
      ...characterConfigs.value,
      [characterId]: createDefaultCharacterReactionConfig(),
    }
  }

  // Preview / Audition Actions (isolated from live activity & Event Ledger)
  function testReaction(characterId: string, state: CodeAssistantState) {
    const config = characterConfigs.value[characterId] || createDefaultCharacterReactionConfig()
    const samplePayload: Partial<CodeAssistantStatePayload> = {
      state,
      assistant: 'preview',
      headline: state === 'work'
        ? 'Running test suite'
        : state === 'wait'
          ? 'Approval needed'
          : state === 'done'
            ? 'Task completed successfully'
            : state === 'error'
              ? 'Build failed with 1 error'
              : 'Companion ready',
      note: state === 'wait' ? 'Run the test suite?' : undefined,
      tool: state === 'work' ? 'npm test' : undefined,
    }

    actuateState(state, samplePayload, config, true)
  }

  function testLifecycle(characterId: string) {
    stopPreview()
    isPreviewing.value = true

    const sequence: { state: CodeAssistantState, durationMs: number }[] = [
      { state: 'work', durationMs: 3000 },
      { state: 'wait', durationMs: 3000 },
      { state: 'work', durationMs: 2000 },
      { state: 'done', durationMs: 3000 },
      { state: 'idle', durationMs: 1000 },
    ]

    let currentStep = 0

    function runStep() {
      if (!isPreviewing.value || currentStep >= sequence.length) {
        stopPreview()
        return
      }

      const step = sequence[currentStep]
      testReaction(characterId, step.state)
      currentStep++

      previewTimer.value = setTimeout(runStep, step.durationMs)
    }

    runStep()
  }

  function stopPreview() {
    isPreviewing.value = false
    if (previewTimer.value) {
      clearTimeout(previewTimer.value)
      previewTimer.value = null
    }
    clearCaption()
    // Settle avatar
    triggerExpression('Neutral')
    triggerMotion('Breathing')
  }

  // Inbound BroadcastChannel listener (window-to-window or testing relay)
  const { data: inboundBroadcastData } = useBroadcastChannel<CodeAssistantStatePayload, CodeAssistantStatePayload>({
    name: 'airi:code-assistant:state',
  })

  watch(inboundBroadcastData, (data) => {
    if (data && typeof data === 'object' && data.state) {
      handleAssistantState(data)
    }
  })

  // WebSocket Server Channel Listener (Persistent across stage & settings views)
  let removeWsListener: (() => void) | null = null
  try {
    const modsServerChannelStore = useModsServerChannelStore()
    removeWsListener = modsServerChannelStore.onEvent('assistant:state', (event) => {
      console.info('[CodeAssistant] 📡 Received assistant:state from modsServerChannelStore:', event)
      if (event?.data) {
        handleAssistantState(event.data)
      }
    })
  }
  catch (err) {
    console.debug('[CodeAssistant] Server channel store not available at store init:', err)
  }

  // Start periodic watchdog
  if (typeof window !== 'undefined') {
    watchdogInterval = setInterval(sweepStaleSessions, 10000)
  }

  function dispose() {
    if (removeWsListener) {
      removeWsListener()
      removeWsListener = null
    }
    if (watchdogInterval) {
      clearInterval(watchdogInterval)
      watchdogInterval = null
    }
    stopPreview()
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      // NOTICE: Do not tear down removeWsListener or watchdog here; the store is a singleton
      // and must remain listening on Stage after Settings is closed.
      if (previewTimer.value) {
        clearTimeout(previewTimer.value)
        previewTimer.value = null
      }
      if (cheerTimer.value) {
        clearTimeout(cheerTimer.value)
        cheerTimer.value = null
      }
    })
  }

  return {
    // Settings
    enabled,
    captionSurface,
    idleTimeoutSeconds,
    recordEventLedger,
    characterConfigs,

    // Status & Active State
    activeSessions,
    effectiveState,
    statusInfo,
    activeCharacterId,
    activeCharacterName,
    activeCharacterConfig,
    isPreviewing,

    // Ingestion
    handleAssistantState,

    // Config Management
    getOrInitCharacterConfig,
    updateCharacterConfig,
    copyCharacterConfig,
    resetCharacterConfig,

    // Audition / Testing
    testReaction,
    testLifecycle,
    stopPreview,
    dispose,

    // Direct Primitives
    playSoundCue,
    triggerExpression,
    triggerMotion,
    emitCaption,
    clearCaption,
  }
})
