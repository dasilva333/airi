import type { ScreenWatchingConfig } from './airi-card'

import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import { computed, onUnmounted, ref, watch } from 'vue'

import { useChatOrchestratorStore } from '../chat'
import { useChatSessionStore } from '../chat/session-store'
import { useEventLogStore } from '../event-log'
import { useLLM } from '../llm'
import { useProvidersStore } from '../providers'
import { useAiriCardStore } from './airi-card'
import { useConsciousnessStore } from './consciousness'
import { useLiveSessionStore } from './live-session'
import { useVisionStore } from './vision'
import { ATTENTION_GUARD_WORKLOAD_ID, useVisionOrchestratorStore } from './vision/orchestrator'

export const useScreenWatcherStore = defineStore('screen-watcher', () => {
  const airiCardStore = useAiriCardStore()
  const { activeCard, activeCardId } = storeToRefs(airiCardStore)
  const visionStore = useVisionStore()
  const visionOrchestrator = useVisionOrchestratorStore()
  const eventLogStore = useEventLogStore()
  const chatOrchestrator = useChatOrchestratorStore()
  const chatSessionStore = useChatSessionStore()
  const consciousnessStore = useConsciousnessStore()
  const providersStore = useProvidersStore()
  const llmStore = useLLM()
  const liveSessionStore = useLiveSessionStore()

  // State
  const isRunning = ref(false)
  const isCapturing = ref(false)
  const captureCount = ref(0)
  const promotionsCount = ref(0)
  const lastCaptureAt = ref<number>(0)
  const lastPromotionAt = ref<number>(0)
  const lastDecision = ref<string>('IDLE')
  const lastSummary = ref<string>('')
  const lastLatencyMs = ref<number>(0)
  const lastError = ref<string | null>(null)

  // Promotion rate-limiting state
  const recentPromotionTimestamps: number[] = []

  let timerHandle: any = null

  const activeConfig = computed<ScreenWatchingConfig | undefined>(() => {
    return activeCard.value?.extensions?.airi?.screenWatching
  })

  const isEnabled = computed(() => {
    return Boolean(activeConfig.value?.enabled)
  })

  function rateLimitAllowsPromotion(config: ScreenWatchingConfig, now = Date.now()): boolean {
    const cooldownMs = (config.hysteresisMinutes || 1) * 60 * 1000
    if (now - lastPromotionAt.value < cooldownMs) {
      console.log(`[ScreenWatcher:RateLimit] ⏳ Promotion throttled by hysteresis cooldown (${Math.round((cooldownMs - (now - lastPromotionAt.value)) / 1000)}s remaining).`)
      return false
    }

    const windowStart = now - 60 * 60 * 1000
    while (recentPromotionTimestamps.length > 0 && recentPromotionTimestamps[0] < windowStart) {
      recentPromotionTimestamps.shift()
    }

    const maxPerHour = config.maxPerHour || 4
    if (recentPromotionTimestamps.length >= maxPerHour) {
      console.log(`[ScreenWatcher:RateLimit] 🛑 Promotion throttled: Reached max ${maxPerHour} interventions per hour.`)
      return false
    }

    return true
  }

  async function generateBubbleOnlyReaction(prompt: string) {
    const activeProviderId = consciousnessStore.activeProvider
    const activeModel = consciousnessStore.activeModel
    if (!activeProviderId) {
      console.warn('[ScreenWatcher:Reaction] Aborted: No active provider found for bubble reaction.')
      return
    }

    const activeProvider = (await providersStore.getProviderInstance(activeProviderId)) as any
    if (!activeProvider) {
      console.warn('[ScreenWatcher:Reaction] Aborted: Failed to instantiate LLM provider.')
      return
    }

    const systemPrompt = activeCard.value?.description
      || 'You are AIRI, an attentive AI desktop companion. Stay in character.'

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ]

    console.log('[ScreenWatcher:Reaction] Generating bubble-only commentary turn from LLM...')
    const response = await llmStore.generate(activeModel, activeProvider, messages, {})
    const reply = (response.text || '').trim()

    if (!reply || reply === 'NO_REPLY') {
      console.log('[ScreenWatcher:Reaction] Character decided to stay silent (NO_REPLY).')
      return
    }

    console.log(`[ScreenWatcher:Reaction] 💬 Bubble commentary generated: "${reply}"`)
    chatSessionStore.inscribeTurn({
      id: nanoid(),
      role: 'assistant',
      content: reply,
      slices: [{ type: 'text', text: reply }],
      tool_results: [],
      createdAt: Date.now(),
    })
  }

  async function dispatchPromotedReaction(visualSummary: string, config: ScreenWatchingConfig) {
    const deliveryMode = config.deliveryMode ?? 'both'
    console.log(`[ScreenWatcher:Reaction] 🎙️ Dispatching real-time reaction (deliveryMode="${deliveryMode}")...`)

    if (deliveryMode === 'off') {
      console.log('[ScreenWatcher:Reaction] 🔇 Delivery mode is "off" — skipping dialogue dispatch.')
      return
    }

    const reactionPrompt = `[REAL-TIME SCREEN OBSERVATION]\n`
      + `You just noticed something noteworthy on the user's screen:\n${visualSummary}\n\n`
      + `Give a brief, natural, in-character reaction or comment (1-2 sentences). Do not announce that you are analyzing the screen.`

    if (deliveryMode === 'bubble_only') {
      await generateBubbleOnlyReaction(reactionPrompt)
    }
    else if (deliveryMode === 'both') {
      console.log('[ScreenWatcher:Reaction] 🔊 Ingesting into Chat Orchestrator (Voice + Bubble)...')
      await chatOrchestrator.ingest(reactionPrompt, {
        metadata: {
          source: 'screen-watcher',
          visualSummary,
        },
      })
    }
    else if (deliveryMode === 'tts_only') {
      console.log('[ScreenWatcher:Reaction] 🗣️ TTS-only reaction dispatched.')
      await generateBubbleOnlyReaction(reactionPrompt)
    }
  }

  async function captureAndProcess(): Promise<void> {
    if (isCapturing.value) {
      console.log('[ScreenWatcher:Tick] ⏳ Previous capture still in progress, skipping overlapping tick.')
      return
    }

    const config = activeConfig.value
    if (!config || !config.enabled) {
      return
    }

    // Busy Pipe Safeguard: defer if user or assistant is active
    if (config.deferWhileSpeaking) {
      const isSpeaking = Boolean(chatOrchestrator.sending)
        || Boolean(chatOrchestrator.activeSpokenText)
        || Boolean(chatOrchestrator.isUserTyping)
        || liveSessionStore.isActive
      if (isSpeaking) {
        console.log('[ScreenWatcher:Tick] ⏸️ Skipped: Busy Pipe (user or character is speaking/typing).')
        return
      }
    }

    isCapturing.value = true
    lastError.value = null

    try {
      const downscale = config.downscalePercent || 75
      const width = Math.round(1280 * (downscale / 100))
      const height = Math.round(720 * (downscale / 100))
      const sourceId = config.sourceId || 'screen:primary'
      const workloadId = config.workload === 'screen:interpret'
        ? 'screen:interpret'
        : config.workload === 'screen:ocr'
          ? 'screen:ocr'
          : ATTENTION_GUARD_WORKLOAD_ID

      // Guard readiness check
      if (workloadId === ATTENTION_GUARD_WORKLOAD_ID) {
        try {
          await visionOrchestrator.ensureGuardLoaded()
        }
        catch (err: any) {
          console.log('[ScreenWatcher:Tick] ⏳ Attention Ecology Guard is loading/downloading models, waiting for ready...')
          return
        }
      }

      console.log(`[ScreenWatcher:Tick] 📸 Capturing screen frame #${captureCount.value + 1} (${width}×${height}, source="${sourceId}")...`)

      const snapshot = await visionStore.captureSnapshot({ width, height })
      if (!snapshot?.dataUrl) {
        lastError.value = snapshot?.error === 'permission_denied'
          ? 'Screen capture permission denied.'
          : 'Capture returned no frame.'
        console.warn('[ScreenWatcher:Tick] ⚠️ Capture returned no frame:', lastError.value)
        return
      }

      captureCount.value++
      lastCaptureAt.value = Date.now()

      const tickStart = performance.now()
      const processed = await visionOrchestrator.processCapture({
        dataUrl: snapshot.dataUrl,
        width,
        height,
        sourceId,
        workloadId,
        timestamp: snapshot.timestamp || Date.now(),
      })
      lastLatencyMs.value = Math.round(performance.now() - tickStart)
      lastDecision.value = processed?.decision || 'UNKNOWN'
      lastSummary.value = processed?.summary || ''

      console.log(`[ScreenWatcher:Engine] 🔍 Result in ${lastLatencyMs.value}ms:`, {
        decision: processed?.decision,
        novelty: processed?.novelty?.toFixed(4),
        ocrErrorPatternHits: processed?.ocrErrorPatternHits,
        summary: processed?.summary,
      })

      if (processed?.decision === 'PROMOTE') {
        const now = Date.now()
        promotionsCount.value++
        lastPromotionAt.value = now
        recentPromotionTimestamps.push(now)

        console.log(`[ScreenWatcher:Promotion] 🚀 NOVELTY PROMOTED! Summary: "${processed.summary}"`)

        // 1. Record in Event Ledger
        await eventLogStore.appendEvent({
          category: 'vision',
          type: 'screen_watching_promoted',
          source: activeCard.value?.name || 'AIRI',
          textSummary: processed.summary || 'Promoted visual event',
          payload: {
            workloadId,
            sourceId,
            novelty: processed.novelty,
            ocrErrorPatternHits: processed.ocrErrorPatternHits,
          },
        })

        // 2. Real-Time Push Dispatcher
        if (config.publishToContext) {
          if (rateLimitAllowsPromotion(config, now)) {
            await dispatchPromotedReaction(processed.summary || 'Novelty detected on screen', config)
          }
        }
        else {
          console.log('[ScreenWatcher:Promotion] 💤 Real-Time Push is OFF. Event logged silently to Unified Event Ledger for next Heartbeat.')
        }
      }
    }
    catch (err: any) {
      lastError.value = err?.message || String(err)
      console.error('[ScreenWatcher:Error] Tick failed:', err)
    }
    finally {
      isCapturing.value = false
    }
  }

  function startWatcher(): void {
    if (timerHandle) {
      stopWatcher()
    }

    const intervalMs = activeConfig.value?.captureIntervalMs || 2000
    console.log(`[ScreenWatcher:Lifecycle] 🟢 Starting ambient screen watcher (interval=${intervalMs}ms)...`)

    // Warm guard worker before first tick if using attention guard
    if (!activeConfig.value?.workload || activeConfig.value.workload === 'attention-guard') {
      void visionOrchestrator.ensureGuardLoaded()
        .then(() => console.log('[ScreenWatcher:Init] 🚀 Attention Ecology Guard ready.'))
        .catch((err: any) => console.warn('[ScreenWatcher:Init] Guard pre-warm in progress or failed:', err))
    }

    isRunning.value = true
    timerHandle = setInterval(() => {
      void captureAndProcess()
    }, intervalMs)
  }

  function stopWatcher(): void {
    if (timerHandle) {
      console.log('[ScreenWatcher:Lifecycle] 🔴 Stopping ambient screen watcher.')
      clearInterval(timerHandle)
      timerHandle = null
    }
    isRunning.value = false
  }

  function restartWatcher(): void {
    if (isEnabled.value) {
      startWatcher()
    }
    else {
      stopWatcher()
    }
  }

  // React to card changes or screenWatching configuration toggles
  watch(
    () => [activeCardId.value, activeConfig.value?.enabled, activeConfig.value?.captureIntervalMs],
    ([cardId, enabled]) => {
      console.log('[ScreenWatcher:Watch] Card / config changed:', { cardId, enabled })
      restartWatcher()
    },
    { immediate: true },
  )

  onUnmounted(() => {
    stopWatcher()
  })

  // Diagnostic Hook for console inspection
  if (typeof window !== 'undefined') {
    (window as any).triggerScreenCaptureTick = () => {
      console.log('[ScreenWatcher:Diagnostic] Manual capture tick triggered via window.triggerScreenCaptureTick()')
      return captureAndProcess()
    }
    ;(window as any).screenWatcherStatus = () => {
      return {
        isRunning: isRunning.value,
        isCapturing: isCapturing.value,
        captureCount: captureCount.value,
        promotionsCount: promotionsCount.value,
        lastCaptureAt: lastCaptureAt.value ? new Date(lastCaptureAt.value).toLocaleTimeString() : 'Never',
        lastPromotionAt: lastPromotionAt.value ? new Date(lastPromotionAt.value).toLocaleTimeString() : 'Never',
        lastDecision: lastDecision.value,
        lastSummary: lastSummary.value,
        lastLatencyMs: lastLatencyMs.value,
        lastError: lastError.value,
        config: activeConfig.value,
      }
    }
  }

  return {
    isRunning,
    isCapturing,
    captureCount,
    promotionsCount,
    lastCaptureAt,
    lastPromotionAt,
    lastDecision,
    lastSummary,
    lastLatencyMs,
    lastError,
    activeConfig,
    isEnabled,
    startWatcher,
    stopWatcher,
    restartWatcher,
    captureAndProcess,
  }
})
