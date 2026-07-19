import type { ActiveWindowEntry, SystemLoadAverages } from '@proj-airi/stage-shared'

import type { ChatStreamEventContext, StreamingAssistantMessage } from '../types/chat'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import {
  isWithinSchedule,
  sensorsGetActiveWindow,
  sensorsGetActiveWindowHistory,
  sensorsGetIdleTime,
  sensorsGetLocalTime,
  sensorsGetSystemLoad,
  sensorsGetVolumeLevel,
  sensorsSetTrackingEnabled,
} from '@proj-airi/stage-shared'
import { useIntervalFn } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import { computed, onUnmounted, ref, toRaw, watch } from 'vue'

import { useLlmmarkerParser } from '../composables/llm-marker-parser'
import { categorizeResponse, createStreamingCategorizer } from '../composables/response-categoriser'
import { chatSessionsRepo } from '../database/repos/chat-sessions.repo'
import { useAuthStore } from './auth'
import { useBackgroundStore } from './background'
import { useChatOrchestratorStore } from './chat'
import { useChatContextStore } from './chat/context-store'
import { mergeLoadedSessionMessages } from './chat/session-message-merge'
import { useChatSessionStore } from './chat/session-store'
import { useEchoesStore } from './echo-chips'
import { useLLM } from './llm'
import { useTextJournalStore } from './memory-text-journal'
import { useAiriCardStore } from './modules/airi-card'
import { useConsciousnessStore } from './modules/consciousness'
import { useLiveSessionStore } from './modules/live-session'
import { useVisionStore } from './modules/vision'
import { useProvidersStore } from './providers'

export const useProactivityStore = defineStore('proactivity', () => {
  const airiCardStore = useAiriCardStore()
  const { activeCard, activeCardId } = storeToRefs(airiCardStore)
  const { userId } = storeToRefs(useAuthStore())
  const chatSession = useChatSessionStore()
  const chatOrchestrator = useChatOrchestratorStore()
  const chatContext = useChatContextStore()
  const llmStore = useLLM()
  const textJournalStore = useTextJournalStore()
  const consciousnessStore = useConsciousnessStore()
  const providersStore = useProvidersStore()
  const backgroundStore = useBackgroundStore()
  const liveSessionStore = useLiveSessionStore()
  const visionStore = useVisionStore()
  const echoesStore = useEchoesStore()

  // eslint-disable-next-line no-console
  console.log('[Proactivity] Proactivity Store initialized.')

  const registeredTools = ref<(any | (() => Promise<any[] | undefined>))[]>([])

  function registerTools(tools: any | any[] | (() => Promise<any[] | undefined>)) {
    if (Array.isArray(tools)) {
      registeredTools.value.push(...tools)
    }
    else {
      registeredTools.value.push(tools)
    }
  }

  const lastHeartbeatTime = ref<number>(Date.now())
  const isDreamStateEvaluating = ref(false)
  const isUpdatingSensors = ref(false)
  const isHeartbeatEvaluating = ref(false)
  // Dedupes the local-activity-gated heartbeat to one send per continuous idle stretch.
  // Cleared as soon as idleTimeSec drops back below the required threshold (user returned).
  const firedForIdleSession = ref(false)
  let heartbeatInterval: any = null

  const isElectron = typeof window !== 'undefined' && !!(window as any).electron
  const getIdleTimeInvoke = isElectron ? useElectronEventaInvoke(sensorsGetIdleTime) : null
  const getActiveWindowInvoke = isElectron ? useElectronEventaInvoke(sensorsGetActiveWindow) : null
  const getActiveWindowHistoryInvoke = isElectron ? useElectronEventaInvoke(sensorsGetActiveWindowHistory) : null
  const getSystemLoadInvoke = isElectron ? useElectronEventaInvoke(sensorsGetSystemLoad) : null
  const getLocalTimeInvoke = isElectron ? useElectronEventaInvoke(sensorsGetLocalTime) : null
  const getVolumeLevelInvoke = isElectron ? useElectronEventaInvoke(sensorsGetVolumeLevel) : null
  const setTrackingEnabledInvoke = isElectron ? useElectronEventaInvoke(sensorsSetTrackingEnabled) : null

  const idleTimeSec = ref<number | undefined>(undefined)
  const activeWinStr = ref('')
  const winHistory = ref<ActiveWindowEntry[]>([])
  const sysLoad = ref<SystemLoadAverages | null>(null)
  const locTime = ref('')
  const volLevel = ref<number | undefined>(undefined)

  const recentTtsCount = ref(0)
  const recentSttCount = ref(0)
  const recentChatCount = ref(0)
  const recentJournalEntryCount = ref(0)

  const sessionMetrics = ref({
    ttsCount: 0,
    sttCount: 0,
    chatCount: 0,
  })
  const totalTurns = computed(() => chatSession.messages.length)
  const nextMilestone = computed(() => Math.ceil(Math.max(1, totalTurns.value + 1) / 100) * 100)

  watch(activeCard, () => {
    // We now derive metrics from history, but we keep this watch for potential future extension syncs
  }, { immediate: true })

  /** @deprecated Metrics are now derived from chat history in sensorPayload */
  function incrementMetric(_type: 'tts' | 'stt' | 'chat') {
    // Stubbed: logic moved to computed properties in sensorPayload
  }

  async function updateSensors() {
    if (isUpdatingSensors.value) {
      // eslint-disable-next-line no-console
      console.log('[Proactivity] Sensor update already in progress, skipping tick.')
      return
    }

    isUpdatingSensors.value = true
    // eslint-disable-next-line no-console
    console.log('[Proactivity] Starting updateSensors tick...')
    console.time('[Proactivity] updateSensors')
    // Fallback for non-electron or missing invoker
    const now = new Date()
    locTime.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

    if (!isElectron) {
      console.timeEnd('[Proactivity] updateSensors')
      return
    }

    // Helper to measure individual query latency
    const timePromise = async <T>(name: string, promise: Promise<T>): Promise<T> => {
      const start = performance.now()
      try {
        return await promise
      }
      finally {
        // eslint-disable-next-line no-console
        console.log(`[Proactivity:Timer] ${name} took ${Math.round(performance.now() - start)}ms`)
      }
    }

    try {
      // Parallelize all OS sensor probes to reduce total latency to the slowest single call.
      const probes = [
        // Only trigger load if not already initialized or loading
        timePromise('textJournalStore.load', textJournalStore.load()),
        timePromise('getIdleTime', getIdleTimeInvoke ? getIdleTimeInvoke() : Promise.resolve(undefined)),
        timePromise('getActiveWindow', getActiveWindowInvoke ? getActiveWindowInvoke() : Promise.resolve(undefined)),
        timePromise('getActiveWindowHistory', getActiveWindowHistoryInvoke ? getActiveWindowHistoryInvoke() : Promise.resolve([])),
        timePromise('getSystemLoad', getSystemLoadInvoke ? getSystemLoadInvoke() : Promise.resolve(null)),
        timePromise('getLocalTime', getLocalTimeInvoke ? getLocalTimeInvoke() : Promise.resolve(undefined)),
        timePromise('getVolumeLevel', getVolumeLevelInvoke ? getVolumeLevelInvoke() : Promise.resolve(undefined)),
      ]

      const [
        _journalLoad,
        idleMsResult,
        activeWinResult,
        winHistoryResult,
        sysLoadResult,
        locTimeResult,
        volLevelResult,
      ] = await Promise.allSettled(probes)

      // Map settled results back to reactive state
      if (idleMsResult.status === 'fulfilled' && (idleMsResult as any).value !== undefined) {
        idleTimeSec.value = Math.floor((idleMsResult as any).value / 1000)
        // eslint-disable-next-line no-console
        console.log(`[Proactivity] Sensor tick -> Idle: ${idleTimeSec.value}s`)
      }
      if (activeWinResult.status === 'fulfilled') {
        activeWinStr.value = (activeWinResult as any).value?.title || ''
      }
      if (winHistoryResult.status === 'fulfilled') {
        winHistory.value = (winHistoryResult as any).value || []
      }
      if (sysLoadResult.status === 'fulfilled') {
        sysLoad.value = (sysLoadResult as any).value
      }
      if (locTimeResult.status === 'fulfilled' && (locTimeResult as any).value) {
        locTime.value = (locTimeResult as any).value
      }
      if (volLevelResult.status === 'fulfilled') {
        volLevel.value = (volLevelResult as any).value
      }

      // Single-pass optimization for usage metrics
      const oneHourAgo = Date.now() - 3600000
      const currentCardId = activeCardId.value

      const journalEntries = textJournalStore.entries ?? []
      recentJournalEntryCount.value = journalEntries.reduce((count, entry) => {
        return (entry.characterId === currentCardId && (entry.createdAt || 0) > oneHourAgo) ? count + 1 : count
      }, 0)

      // Combined message metrics (TTS, STT, Total) in one pass
      let tts = 0
      let stt = 0
      let total = 0
      const messages = chatSession.messages ?? []
      for (const m of messages) {
        if ((m.createdAt || 0) > oneHourAgo) {
          total++
          if (m.role === 'assistant')
            tts++
          else if (m.role === 'user')
            stt++
        }
      }
      recentTtsCount.value = tts
      recentSttCount.value = stt
      recentChatCount.value = total
    }
    catch (err) {
      console.warn('[Proactivity] Failed to poll sensors for preview:', err)
    }
    finally {
      console.timeEnd('[Proactivity] updateSensors')
      isUpdatingSensors.value = false
    }
  }

  async function refreshIdleTimeOnly() {
    if (!isElectron || !getIdleTimeInvoke)
      return

    try {
      const idleMs = await getIdleTimeInvoke()
      if (idleMs !== undefined)
        idleTimeSec.value = Math.floor(idleMs / 1000)
    }
    catch (err) {
      console.warn('[Proactivity] Failed to poll idle time:', err)
    }
  }

  const isProactivityLoopNeeded = computed(() => {
    const config = activeCard.value?.extensions?.airi?.heartbeats
    const grounding = activeCard.value?.extensions?.airi?.groundingEnabled
    return !!(config?.enabled || grounding)
  })

  const { pause, resume } = useIntervalFn(updateSensors, 10000, { immediate: false })

  watch(isProactivityLoopNeeded, (needed) => {
    if (needed) {
      // eslint-disable-next-line no-console
      console.log('[Proactivity] Resuming sensor polling loop.')
      resume()
      setTrackingEnabledInvoke?.({ enabled: true })
    }
    else {
      // eslint-disable-next-line no-console
      console.log('[Proactivity] Pausing sensor polling loop (idle).')
      pause()
      setTrackingEnabledInvoke?.({ enabled: false })
    }
  }, { immediate: true })

  onUnmounted(() => {
    pause()
  })

  const sensorPayload = computed(() => {
    const config = activeCard.value?.extensions?.airi?.heartbeats
    const activeBackgroundId = activeCard.value?.extensions?.airi?.modules?.activeBackgroundId
    const resolvedDefaultBackgroundName = activeBackgroundId && activeBackgroundId !== 'none'
      ? (backgroundStore.entries.get(activeBackgroundId)?.title ?? 'unknown')
      : 'none'

    let payload = '[Sensor Data]\n'

    payload += `User Idle: ${idleTimeSec.value !== undefined ? `${idleTimeSec.value}s` : 'unknown'}\n`

    if (config?.contextOptions?.windowHistory !== false) {
      if (winHistory.value.length > 0) {
        const history = winHistory.value.slice(-6)
        const active = history.pop()

        if (active) {
          if (active.window.processName && active.window.processName !== 'Unknown') {
            payload += `Active Program: ${active.window.processName}\n`
          }
          payload += `Active Window Title: ${active.window.title}\n`
        }

        if (history.length > 0) {
          payload += '\n[ Previous History ]\n'
          history.reverse().forEach((entry) => {
            const start = new Date(entry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
            const end = new Date(entry.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
            const durationSec = Math.floor(entry.durationMs / 1000)
            const durationStr = durationSec < 60 ? `${durationSec}s` : `${Math.floor(durationSec / 60)}m`

            const name = (entry.window.processName && entry.window.processName !== 'Unknown')
              ? `${entry.window.processName} | `
              : ''
            payload += `[ ${name}${entry.window.title} ] [ ${durationStr} ] [ ${start} - ${end} ]\n`
          })
        }
      }
    }
    else {
      payload += 'Window History: [DISABLED]\n'
    }

    if (config?.contextOptions?.systemLoad !== false) {
      if (sysLoad.value) {
        payload += `CPU Load (1/5/15): ${sysLoad.value.cpu[0].toFixed(2)} | ${sysLoad.value.cpu[1].toFixed(2)} | ${sysLoad.value.cpu[2].toFixed(2)}\n`
        payload += `GPU Load (Avg): ${sysLoad.value.gpuAvg.toFixed(2)}\n`
      }
    }
    else {
      payload += 'System Load: [DISABLED]\n'
    }

    const volStr = volLevel.value !== undefined ? `${volLevel.value}%` : 'unknown'
    payload += `Volume Level: ${volStr}\n`
    payload += `Current Local Time: ${locTime.value || 'unknown'}\n`
    payload += `Active Character Default Background: ${resolvedDefaultBackgroundName}\n`

    if (config?.contextOptions?.usageMetrics !== false) {
      const turnCount = chatSession.messages.length

      payload += '\n[Usage Metrics (Last Hr)]\n'
      payload += `TTS (Last Hr): ${recentTtsCount.value}\n`
      payload += `STT (Last Hr): ${recentSttCount.value}\n`
      payload += `Chat (Last Hr): ${recentChatCount.value}\n`
      payload += `Journal Entries (Last Hr): ${recentJournalEntryCount.value}\n`
      payload += `Turn Count: ${turnCount} (Next Target: ${nextMilestone.value})\n`
    }
    else {
      payload += '\n[Metrics]: [DISABLED]\n'
    }

    return payload
  })

  function getTodayKey() {
    return new Date().toISOString().slice(0, 10)
  }

  async function collectCharacterConversationMessages(characterId: string) {
    const currentUserId = userId.value || 'local'
    const index = await chatSessionsRepo.getIndex(currentUserId)
    const characterSessions = index?.characters?.[characterId]
    if (!characterSessions)
      return []

    const inMemorySessions = chatSession.getAllSessions()
    const sessionMetas = Object.values(characterSessions.sessions || {})
    const sessionRecords = await Promise.all(sessionMetas.map(meta => chatSessionsRepo.getSession(meta.sessionId)))

    const mergedMessages = sessionRecords.flatMap((session, index) => {
      const sessionId = sessionMetas[index]?.sessionId
      const currentMessages = inMemorySessions[sessionId] ?? []
      const storedMessages = session?.messages ?? []
      return mergeLoadedSessionMessages(storedMessages, currentMessages)
    })

    return mergedMessages
      .filter((msg) => {
        return (msg.role === 'user' || msg.role === 'assistant') && typeof msg.createdAt === 'number'
      })
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  }

  async function evaluateDreamState(options?: { force?: boolean }) {
    if (isDreamStateEvaluating.value && !options?.force) {
      return
    }

    const card = activeCard.value
    const characterId = activeCardId.value
    const config = card?.extensions?.airi?.dreamState

    if (!card || !characterId || !config?.enabled) {
      return
    }

    const conversationalMessages = await collectCharacterConversationMessages(characterId)

    if (conversationalMessages.length < (config.minConversationTurns || 4)) {
      return
    }

    const now = Date.now()
    const firstDreamFallbackMs = 24 * 60 * 60 * 1000
    const effectiveFromTimestamp = config.lastProcessedAt ?? Math.max(0, now - firstDreamFallbackMs)
    const unprocessedMessages = conversationalMessages.filter(msg => (msg.createdAt || 0) > effectiveFromTimestamp)
    if (unprocessedMessages.length < (config.minConversationTurns || 4)) {
      return
    }

    const lastTurnAt = Math.max(...unprocessedMessages.map(msg => msg.createdAt || 0))
    const quietWindowMinutes = config.sessionTimeoutMinutes || 60
    const quietWindowMs = quietWindowMinutes * 60 * 1000

    if (!options?.force && now - lastTurnAt < quietWindowMs) {
      return
    }

    if (config.strictAfkGating) {
      if (idleTimeSec.value === undefined)
        await refreshIdleTimeOnly()
      else
        await refreshIdleTimeOnly()

      const afkThresholdSec = (config.afkThresholdMinutes || 5) * 60
      if (!options?.force && (idleTimeSec.value ?? 0) < afkThresholdSec) {
        return
      }
    }

    const todayKey = getTodayKey()
    const dailyRunCount = config.dailyRunDate === todayKey ? (config.dailyRunCount ?? 0) : 0
    const maxSessionsPerDay = config.maxSessionsPerDay || 4
    if (!options?.force && dailyRunCount >= maxSessionsPerDay) {
      return
    }

    isDreamStateEvaluating.value = true
    try {
      const activeSessionId = chatSession.activeSessionId
      const activeSessionMeta = chatSession.getSessionMeta(activeSessionId)
      const currentUniverseId = activeSessionMeta?.universeId || 'global'

      await echoesStore.load()
      const newChips = await echoesStore.synthesizeForCharacter(characterId, {
        fromTimestamp: config.lastProcessedAt ?? null,
        toTimestamp: lastTurnAt,
        force: options?.force,
        universeId: currentUniverseId,
        sessionId: activeSessionId,
      })

      const pendingDreamChips = (newChips || []).map(chip => chip.content)
      const hasDreamChips = pendingDreamChips.length > 0

      airiCardStore.updateCard(characterId, {
        extensions: {
          ...card.extensions,
          airi: {
            ...card.extensions?.airi,
            dreamState: {
              ...card.extensions?.airi?.dreamState,
              lastProcessedAt: lastTurnAt,
              dailyRunDate: todayKey,
              dailyRunCount: dailyRunCount + 1,
              pendingDreamChips: config.injectDreamContext && hasDreamChips ? pendingDreamChips : undefined,
              pendingDreamTimestamp: config.injectDreamContext && hasDreamChips ? Date.now() : undefined,
            },
          },
        },
      } as any)
    }
    catch (err) {
      console.error('[Dream State] Synthesis failed.', {
        characterId,
        error: err,
      })
    }
    finally {
      isDreamStateEvaluating.value = false
    }
  }

  async function evaluateHeartbeat(options?: { force?: boolean }) {
    const config = activeCard.value?.extensions?.airi?.heartbeats
    if (!config?.enabled && !options?.force) {
      return
    }

    console.time('[Proactivity] evaluateHeartbeat')
    try {
      if (isHeartbeatEvaluating.value && !options?.force) {
        // eslint-disable-next-line no-console
        console.log('[Proactivity] Evaluation already in progress, skipping.')
        return
      }

      // eslint-disable-next-line no-console
      console.log('[Proactivity] Ticking evaluation loop...', { force: !!options?.force })

      if (!activeCard.value) {
        // eslint-disable-next-line no-console
        console.log('[Proactivity] Aborted: No active card selected.', { activeCard: activeCard.value })
        return
      }

      // NOTICE: Guard against mid-card-switch state. When the user imports or switches to a new
      // character card, ensureActiveSessionForCharacter() runs async and updates activeSessionId.
      // If the heartbeat fires before that resolves, sessionMessages[activeSessionId] still holds
      // the *previous* character's conversation, which would be injected as context for the new
      // character — causing completely wrong roleplay history to appear in Nan0's proactive prompt.
      if (!options?.force && chatSession.isEnsuringSession) {
        // eslint-disable-next-line no-console
        console.log('[Proactivity] Aborted: Session switch in progress, deferring heartbeat.')
        return
      }

      const now = new Date()

      // Check schedule
      if (!options?.force && config?.respectSchedule && config?.schedule?.start && config?.schedule?.end) {
        const isInWindow = isWithinSchedule(config!.schedule!.start, config!.schedule!.end)

        if (!isInWindow) {
          // eslint-disable-next-line no-console
          console.log(`[Proactivity] Aborted: Outside schedule window (${config!.schedule!.start} - ${config!.schedule!.end}).`)
          return
        }
      }

      if (config?.useAsLocalGate) {
        // "Interval" is reinterpreted as "required continuous idle minutes" in this mode: the
        // heartbeat fires once the user has been away for that long, then waits for them to
        // return (idleTimeSec drops back down) before the next idle stretch can fire again.
        // Reuses the idleTimeSec ref kept fresh by the 10s updateSensors() background loop,
        // rather than issuing a second, redundant sensor query here.
        if (idleTimeSec.value === undefined)
          await refreshIdleTimeOnly()

        const requiredIdleSec = (config.intervalMinutes || 1) * 60
        const currentIdleSec = idleTimeSec.value ?? 0

        if (!options?.force && currentIdleSec < requiredIdleSec) {
          firedForIdleSession.value = false
          const remainingSec = requiredIdleSec - currentIdleSec
          // eslint-disable-next-line no-console
          console.log(`[Proactivity] Waiting for inactivity: ${Math.floor(remainingSec / 60)}m ${remainingSec % 60}s of continuous idle remaining (currently idle ${currentIdleSec}s, need ${config.intervalMinutes}m).`)
          return
        }

        if (!options?.force && firedForIdleSession.value) {
          // eslint-disable-next-line no-console
          console.log('[Proactivity] Already sent a heartbeat for this idle session; waiting for the user to return before the next one.')
          return
        }

        firedForIdleSession.value = true
      }
      else {
        // Wall-clock cooldown, unrelated to activity: fires every `intervalMinutes` regardless
        // of whether the user is present.
        const intervalMs = (config?.intervalMinutes || 1) * 60 * 1000
        const timeSinceLast = now.getTime() - lastHeartbeatTime.value
        const timeLeftMs = Math.max(0, intervalMs - timeSinceLast)

        if (!options?.force && timeLeftMs > 0) {
          const mins = Math.floor(timeLeftMs / 60000)
          const secs = Math.floor((timeLeftMs % 60000) / 1000)
          // eslint-disable-next-line no-console
          console.log(`[Proactivity] Next evaluation due in: ${mins}m ${secs}s (Interval: ${config?.intervalMinutes}m)`)
          return
        }
      }

      if (config?.injectIntoPrompt) {
        if (isElectron && getIdleTimeInvoke) {
          try {
            await updateSensors()
          }
          catch (err) {
            console.warn('[Proactivity] Failed to fetch OS sensors:', err)
          }
        }
        else {
          // eslint-disable-next-line no-console
          console.log('[Proactivity] Skipping sensors: Browser environment or invokers missing.')
        }
      }

      lastHeartbeatTime.value = now.getTime()
      isHeartbeatEvaluating.value = true

      try {
        const promptText = config?.prompt || 'Evaluate heartbeat and situational context.'
        // eslint-disable-next-line no-console
        console.log(`[Proactivity] >>> TRIGGERING LLM <<< Prompt:\n${promptText}`)

        const messages: { role: 'system' | 'user' | 'assistant', content: string }[] = []

        if (airiCardStore.systemPrompt) {
          messages.push({
            role: 'system',
            content: airiCardStore.systemPrompt,
          })
        }

        const contextsSnapshot = chatContext.getContextsSnapshot()
        const sensorPayloadRaw = config?.injectIntoPrompt ? sensorPayload.value : ''

        if (Object.keys(contextsSnapshot).length > 0 || sensorPayloadRaw) {
          let contextContent = ''
          if (Object.keys(contextsSnapshot).length > 0) {
            contextContent += 'These are the contextual information retrieved or on-demand updated from other modules:\n'
              + `${Object.entries(contextsSnapshot).map(([key, value]) => `Module ${key}: ${JSON.stringify(value)}`).join('\n')}\n`
          }

          if (sensorPayloadRaw) {
            contextContent += `${contextContent ? '\n---\n' : ''
            }[ENVIRONMENTAL AWARENESS]\n`
            + `The following telemetry describes your current environmental context. `
            + `Use it to stay grounded in the user's reality and inform your response. `
            + `You may reference specific values (like time or active applications) if relevant `
            + `to the conversation, but avoid a dry, technical recitation of the data.\n`
            + `---\n`
            + `${sensorPayloadRaw}\n`
          }

          messages.push({
            role: 'system',
            content: contextContent.trim(),
          })
        }

        const sessionId = chatSession.activeSessionId
        const sessionMessages = chatSession.sessionMessages[sessionId] || []

        // NOTICE: Defensive character ownership check. The sessionMessages map holds every
        // session ever loaded in memory (across all characters). Even after isEnsuringSession
        // clears, a brief race or the RECOVERY BRIDGE loading candidate sessions could leave
        // activeSessionId pointing at a session from a different character. We verify ownership
        // via the session meta before injecting any messages, to prevent another character's
        // conversation history (e.g. a previous roleplay session) from leaking into this
        // character's proactive observation prompt.
        const sessionMeta = chatSession.getSessionMeta(sessionId)
        const sessionOwnerCharacterId = sessionMeta?.characterId
        const currentCharacterId = activeCardId.value
        if (sessionOwnerCharacterId && sessionOwnerCharacterId !== currentCharacterId) {
          console.warn('[Proactivity] Session characterId mismatch — skipping history injection.', {
            sessionId,
            sessionOwnerCharacterId,
            currentCharacterId,
          })
        }
        else {
          // Inject the last 6 messages (approx 3 turns) for conversational context
          const recentMessages = sessionMessages.slice(-6)
          for (const msg of recentMessages) {
            if (msg.role === 'user' || msg.role === 'assistant') {
              let msgContent = ''
              if (typeof msg.content === 'string') {
                msgContent = msg.content as string
              }
              else if (Array.isArray(msg.content)) {
                msgContent = (msg.content as any[]).map((part: any) => {
                  if (typeof part === 'string')
                    return part
                  if (part && typeof part === 'object' && 'text' in part)
                    return String(part.text ?? '')
                  return ''
                }).join('')
              }
              if (msgContent) {
                messages.push({ role: msg.role as 'user' | 'assistant', content: msgContent })
              }
            }
          }
        }

        messages.push({ role: 'user', content: promptText })

        const activeProviderId = consciousnessStore.activeProvider
        const activeModel = consciousnessStore.activeModel

        if (!activeProviderId) {
          console.warn('[Proactivity] Aborted: No active LLM provider found.')
          return
        }

        if (!options?.force && !providersStore.configuredProviders[activeProviderId]) {
          // eslint-disable-next-line no-console
          console.log(`[Proactivity] Aborted: Active LLM provider "${activeProviderId}" is not configured or offline.`)
          return
        }

        // eslint-disable-next-line no-console
        console.log('[Proactivity] Resolving Provider Instance:', { activeProviderId, activeModel })
        const activeProvider = await providersStore.getProviderInstance(activeProviderId) as any

        if (!activeProvider) {
          console.warn('[Proactivity] Aborted: Failed to instantiate LLM provider.', { activeProviderId })
          return
        }

        // NOTICE: Uses the top-level resolveRegisteredTools function (also used by LiveSessionStore)
        const resolvedTools = resolveRegisteredTools

        const llmResponse = await llmStore.generate(activeModel, activeProvider, messages, {
          tools: resolvedTools,
          supportsTools: true,
        })
        const rawReply = llmResponse.text

        // Record token usage for persistent tracking
        if (llmResponse.usage) {
          const totalTokens = llmResponse.usage.total_tokens || (llmResponse.usage.prompt_tokens + llmResponse.usage.completion_tokens) || 0
          liveSessionStore.recordInferenceUsage(totalTokens)
        }

        // eslint-disable-next-line no-console
        console.log(`[Proactivity] LLM Raw Response: "${rawReply}"`)

        // NOTICE: `NO_REPLY` is a control sentinel for proactive heartbeats, not user-facing content.
        // If the model returns it exactly, we must stop here so it never reaches chat history, stage
        // replay, captions, or TTS.
        if ((rawReply || '').trim() === 'NO_REPLY') {
          console.log('[Proactivity] AI decided to remain silent via NO_REPLY sentinel.')
          return
        }

        const composedMessageSnapshot = toRaw(chatSession.sessionMessages[sessionId] || [])

        const rawStreamingContext: ChatStreamEventContext = {
          sessionId,
          message: { role: 'user', content: '[Heartbeat Check]', createdAt: Date.now(), id: nanoid() },
          contexts: toRaw(chatContext.getContextsSnapshot()),
          composedMessage: composedMessageSnapshot as any,
        }

        // Deep clone to ensure serializability for IPC (prevents DataCloneError)
        const streamingContext = JSON.parse(JSON.stringify(rawStreamingContext))

        const buildingMessage: StreamingAssistantMessage = {
          role: 'assistant',
          content: '',
          slices: [],
          tool_results: [],
          createdAt: Date.now(),
          id: nanoid(),
        }

        await chatOrchestrator.emitBeforeMessageComposedHooks('[Proactive Heartbeat]', streamingContext)

        const categorizer = createStreamingCategorizer(activeProviderId)
        let streamPosition = 0

        const updateUI = () => {
          if (sessionId === chatSession.activeSessionId) {
            chatOrchestrator.streamingMessage = JSON.parse(JSON.stringify(buildingMessage))
          }
        }

        const parser = useLlmmarkerParser({
          onLiteral: async (literal) => {
            categorizer.consume(literal)
            const speechOnly = categorizer.filterToSpeech(literal, streamPosition)
            streamPosition += literal.length

            if (speechOnly.trim()) {
              buildingMessage.content += speechOnly
              await chatOrchestrator.emitTokenLiteralHooks(speechOnly, streamingContext)

              const lastSlice = buildingMessage.slices.at(-1)
              if (lastSlice?.type === 'text') {
                lastSlice.text += speechOnly
              }
              else {
                buildingMessage.slices.push({ type: 'text', text: speechOnly })
              }
            }
            updateUI()
          },
          onSpecial: async (special) => {
            await chatOrchestrator.emitTokenSpecialHooks(special, streamingContext)
          },
          onEnd: (fullText) => {
            const finalCategorization = categorizeResponse(fullText, activeProviderId)
            buildingMessage.categorization = {
              speech: finalCategorization.speech,
              reasoning: finalCategorization.reasoning,
            }
            updateUI()
          },
        })

        await parser.consume(rawReply || '')
        await parser.end()

        const trimmedReply = (buildingMessage.content as string).trim()

        if (!trimmedReply) {
          // eslint-disable-next-line no-console
          console.log('[Proactivity] AI decided to remain silent.')
          return
        }

        // eslint-disable-next-line no-console
        console.log(`[Proactivity] Success! Injecting message into UI: ${trimmedReply}`)

        await chatOrchestrator.emitStreamEndHooks(streamingContext)
        await chatOrchestrator.emitAssistantResponseEndHooks(trimmedReply, streamingContext)

        // Inscribe the proactive turn properly
        chatSession.inscribeTurn(buildingMessage as any, sessionId)

        if (sessionId === chatSession.activeSessionId) {
          chatOrchestrator.streamingMessage = { role: 'assistant', content: '', slices: [], tool_results: [] }
        }

        await chatOrchestrator.emitAssistantMessageHooks(buildingMessage, trimmedReply, streamingContext)
        await chatOrchestrator.emitChatTurnCompleteHooks({
          output: buildingMessage,
          outputText: trimmedReply,
          toolCalls: [],
        }, streamingContext)

        // Piggyback vision capture onto the proactivity heartbeat when Live API is active.
        // This eliminates the need for a separate vision polling loop — proactivity's AFK,
        // schedule, and interval gates naturally protect vision from wasted captures.
        if (liveSessionStore.isActive && visionStore.isWitnessEnabled) {
          console.log('[Proactivity] Live API active + Witness enabled → piggybacking vision capture.')
          await visionStore.heartbeat({ force: true })
        }
      }
      catch (err) {
        console.error('[Proactivity] Error during heartbeat evaluation:', err)
      }
      finally {
        isHeartbeatEvaluating.value = false
      }
    }
    finally {
      console.timeEnd('[Proactivity] evaluateHeartbeat')
    }
  }

  // Diagnostic Hook
  if (typeof window !== 'undefined') {
    (window as any).triggerHeartbeat = (force = true) => {
      // eslint-disable-next-line no-console
      console.log('[Proactivity] Manual trigger initiated via window.triggerHeartbeat')
      return evaluateHeartbeat({ force })
    }
    ;(window as any).triggerDreamState = (force = true) => {
      return evaluateDreamState({ force })
    }
  }

  function startHeartbeatLoop() {
    if (heartbeatInterval)
      stopHeartbeatLoop()

    // eslint-disable-next-line no-console
    console.log('[Proactivity] Starting global heartbeat loop (10s tick)...')
    heartbeatInterval = setInterval(() => {
      void evaluateHeartbeat()
      void evaluateDreamState()
    }, 10 * 1000)
  }

  function stopHeartbeatLoop() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }

  // Resolves all registered tools (static + async factory functions) into a flat array.
  // Used by both the Proactivity heartbeat pipeline AND the LiveSessionStore for Gemini Bidi tool injection.
  async function resolveRegisteredTools(): Promise<any[]> {
    const all: any[] = []
    for (const t of registeredTools.value) {
      if (typeof t === 'function') {
        const resolved = await t()
        if (resolved)
          all.push(...resolved)
      }
      else {
        all.push(t)
      }
    }
    return all
  }

  // Presets for the heartbeat interval cycle button in the controls island.
  const HEARTBEAT_INTERVAL_PRESETS = [2, 5, 10, 20]

  // Computed read of the active card's heartbeat interval for UI binding.
  const heartbeatIntervalMinutes = computed(() => {
    return activeCard.value?.extensions?.airi?.heartbeats?.intervalMinutes ?? 5
  })

  /**
   * Cycles the proactivity heartbeat interval through [2, 5, 10, 20] minute presets.
   * If the current value is a custom value (not in presets), snaps to the first preset (2).
   */
  function cycleHeartbeatInterval() {
    const current = heartbeatIntervalMinutes.value
    const idx = HEARTBEAT_INTERVAL_PRESETS.indexOf(current)
    const next = idx === -1
      ? HEARTBEAT_INTERVAL_PRESETS[0] // Custom value → snap to first preset
      : HEARTBEAT_INTERVAL_PRESETS[(idx + 1) % HEARTBEAT_INTERVAL_PRESETS.length]

    const cardId = activeCardId.value
    const card = activeCard.value
    if (!card || !cardId)
      return

    airiCardStore.updateCard(cardId, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions?.airi,
          heartbeats: {
            ...card.extensions?.airi?.heartbeats,
            intervalMinutes: next,
          },
        },
      },
    } as any)

    console.log(`[Proactivity] Cycled heartbeat interval: ${current}m → ${next}m`)
  }

  // Computed read of the active card's respectSchedule setting for UI binding.
  const isRespectScheduleEnabled = computed(() => {
    return activeCard.value?.extensions?.airi?.heartbeats?.respectSchedule ?? true
  })

  /**
   * Toggles the "Respect Schedule" setting for the active card.
   */
  function toggleRespectSchedule() {
    const cardId = activeCardId.value
    const card = activeCard.value
    if (!card || !cardId)
      return

    const next = !isRespectScheduleEnabled.value

    airiCardStore.updateCard(cardId, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions?.airi,
          heartbeats: {
            ...card.extensions?.airi?.heartbeats,
            respectSchedule: next,
          },
        },
      },
    } as any)

    console.log(`[Proactivity] Toggled respectSchedule: ${!next} → ${next}`)
  }

  return {
    sessionMetrics,
    totalTurns,
    nextMilestone,
    incrementMetric,
    updateSensors,
    sensorPayload,
    idleTimeSec,
    activeWinStr,
    winHistory,
    sysLoad,
    locTime,
    lastHeartbeatTime,
    isHeartbeatEvaluating,
    isDreamStateEvaluating,
    registeredTools,
    registerTools,
    resolveRegisteredTools,
    evaluateHeartbeat,
    evaluateDreamState,
    startHeartbeatLoop,
    stopHeartbeatLoop,
    heartbeatIntervalMinutes,
    cycleHeartbeatInterval,
    isRespectScheduleEnabled,
    toggleRespectSchedule,
  }
})
