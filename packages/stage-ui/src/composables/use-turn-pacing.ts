import type { PlaybackItem } from '@proj-airi/pipelines-audio'
import type { Ref } from 'vue'

import type { AiriThinkingFiller } from '../types/card.schema'
import type { ChatStreamEventContext } from '../types/chat'
import type { AsideCandidate, PacingMetrics, PacingPolicyConfig } from '../types/pacing'

import { useBroadcastChannel, useLocalStorage } from '@vueuse/core'
import { readonly, ref, toRaw } from 'vue'

import { createThinkingAudioFingerprintParams } from '../libs/pacing/pacing-cache'
import { PacingPlaybackBridge, resolveFillerCandidate } from '../libs/pacing/pacing-playback-bridge'
import { TurnPacingCoordinator } from '../libs/pacing/turn-pacing-coordinator'
import { useAudioContext } from '../stores/audio'
import { useConsciousnessStore } from '../stores/modules/consciousness'
import { useSpeechStore } from '../stores/modules/speech'

export interface UseTurnPacingOptions {
  activeCard: Ref<any>
  playbackManager: {
    schedule: (item: PlaybackItem<AudioBuffer>) => void
    tryCommitFiller?: (item: PlaybackItem<AudioBuffer>, maxAdmissionLeadMs?: number) => any
    stopByIntent?: (intentId: string, reason: string) => void
    stopAll?: (reason: string) => void
    getCurrentTime?: () => number
  }
  speechStore?: ReturnType<typeof useSpeechStore>
  audioContext?: AudioContext | null
  isPlaybackSuppressed?: Ref<boolean>
  getIntentContext?: () => { intentId?: string, streamId?: string }
  synthesizeAudio?: (text: string, signal: AbortSignal) => Promise<ArrayBuffer>
}

/**
 * Composable orchestrating conversational pacing and thinking fillers for a stage host.
 */
export function useTurnPacing(options: UseTurnPacingOptions) {
  const { activeCard, playbackManager, isPlaybackSuppressed } = options

  const speechStore = options.speechStore ?? useSpeechStore()
  const consciousnessStore = useConsciousnessStore()
  const audioCtxStore = useAudioContext()

  function getAudioContext(): AudioContext | null {
    return options.audioContext ?? audioCtxStore.audioContext ?? null
  }

  const ttftSamplesByProvider = new Map<string, number[]>()
  const activePacingMetrics = ref<PacingMetrics | null>(null)
  const latestPacingMetrics = useLocalStorage<PacingMetrics | null>('airi:latest-pacing-metrics', null)

  const { post: postPacingTelemetry } = useBroadcastChannel<PacingMetrics, PacingMetrics>({
    name: 'airi:pacing-telemetry',
  })

  let activeCoordinator: TurnPacingCoordinator | null = null
  let activeBridge: PacingPlaybackBridge<AudioBuffer> | null = null
  let currentGeneration = 0
  let countdownTimer: any = null

  function startTurn(turnId: string, _context?: ChatStreamEventContext): TurnPacingCoordinator | null {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }

    cancel('new-turn')

    const pacingConfig = activeCard.value?.extensions?.airi?.acting?.pacing
    if (!pacingConfig?.enabled) {
      activeCoordinator = null
      activeBridge = null
      return null
    }

    if (isPlaybackSuppressed?.value) {
      activeCoordinator = null
      activeBridge = null
      return null
    }

    const provider = speechStore.activeSpeechProvider
    if (!provider || provider === 'speech-noop') {
      activeCoordinator = null
      activeBridge = null
      return null
    }

    const fillers = pacingConfig.fillers || []
    const enabledFillers: AiriThinkingFiller[] = fillers.filter((f: AiriThinkingFiller) => f.enabled && f.text?.trim())
    if (enabledFillers.length === 0) {
      activeCoordinator = null
      activeBridge = null
      return null
    }

    const gen = ++currentGeneration
    const card = activeCard.value
    const llmProvider = card?.extensions?.airi?.generation?.provider || consciousnessStore.activeProvider || 'unknown'
    const llmModel = card?.extensions?.airi?.generation?.model || consciousnessStore.activeModel || 'default'
    const providerKey = `${llmProvider}:${llmModel}`
    const samples = ttftSamplesByProvider.get(providerKey) || []

    const policy: PacingPolicyConfig = {
      enabled: pacingConfig.enabled,
      armMinMs: pacingConfig.armMinMs ?? 900,
      armMaxMs: pacingConfig.armMaxMs ?? 3500,
      maxFillerDurationMs: pacingConfig.maxFillerDurationMs ?? 2200,
      reasoningWindowMs: pacingConfig.reasoningWindowMs ?? 900,
      categoryThreshold: pacingConfig.categoryThreshold ?? 2,
      kFast: pacingConfig.kFast ?? 0.5,
      maxFillersPerTurn: pacingConfig.maxFillersPerTurn ?? 3,
      pacingIntervalMs: pacingConfig.pacingIntervalMs ?? 15000,
      dynamicAsidesEnabled: pacingConfig.dynamicAsidesEnabled ?? false,
      semanticExtractorEnabled: pacingConfig.semanticExtractorEnabled ?? false,
      dynamicAfterMs: pacingConfig.dynamicAfterMs ?? 15000,
      candidateTtlMs: pacingConfig.candidateTtlMs ?? 15000,
      maxFillerSynthesisBudgetMs: pacingConfig.maxFillerSynthesisBudgetMs ?? 2500,
      maxSynthesisBudgetMs: pacingConfig.maxSynthesisBudgetMs ?? 2500,
      experimentalOrganicPivots: pacingConfig.experimentalOrganicPivots ?? false,
    }

    const coordinator = new TurnPacingCoordinator({
      turnId,
      generation: gen,
      providerKey,
      policy,
      historicalTtftSamples: samples,
      onArmFiller: async (category, _deadlineMs) => {
        const phrase = resolveFillerCandidate(enabledFillers, category, bridge.usedPhrases)
        if (!phrase) {
          coordinator.notifyCacheMiss()
          return
        }
        await bridge.handleFillerArmed(category, phrase)
      },
      onArmDynamicAside: async (candidate, _budgetMs) => {
        await bridge.handleDynamicAsideArmed(candidate)
      },
      onCancelFiller: (reason) => {
        bridge.cancelFiller(reason)
      },
      onStateChange: (state, log, nextInMs) => {
        const snapshot: PacingMetrics = {
          ...coordinator.metrics,
          liveState: state,
          stateLog: [...log],
          committedCount: coordinator.committedCount,
          spokenCount: coordinator.spokenCount,
          fillersSpokenCount: coordinator.metrics.fillersSpokenCount,
          maxFillers: policy.maxFillersPerTurn ?? 3,
          nextOpportunityCountdownSec: nextInMs && nextInMs > 0 ? Math.ceil(nextInMs / 1000) : undefined,
        }
        activePacingMetrics.value = snapshot
        try {
          postPacingTelemetry(toRaw(snapshot))
        }
        catch {}
      },
      onSettled: (metrics) => {
        if (countdownTimer) {
          clearInterval(countdownTimer)
          countdownTimer = null
        }
        activePacingMetrics.value = metrics
        const raw = toRaw(metrics)
        latestPacingMetrics.value = raw
        console.log('[TurnPacing:Settled] Turn pacing metrics settled:', raw)
        try {
          postPacingTelemetry(raw)
        }
        catch {
          // BroadcastChannel may fail if window/context is disconnected
        }
        if (metrics.ttftMs && metrics.ttftMs > 0) {
          const list = ttftSamplesByProvider.get(providerKey) || []
          list.push(metrics.ttftMs)
          if (list.length > 30)
            list.shift()
          ttftSamplesByProvider.set(providerKey, list)
        }
      },
    })

    countdownTimer = setInterval(() => {
      if (!activeCoordinator || activeCoordinator.turnPhase === 'canceled' || activeCoordinator.turnPhase === 'settled' || activeCoordinator.pacingClosed) {
        if (countdownTimer) {
          clearInterval(countdownTimer)
          countdownTimer = null
        }
        return
      }

      if (activeCoordinator.state === 'STAGING' && activeCoordinator.nextEligibleAtMs) {
        const remSec = Math.max(0, Math.ceil((activeCoordinator.nextEligibleAtMs - Date.now()) / 1000))
        const snapshot: PacingMetrics = {
          ...activeCoordinator.metrics,
          liveState: activeCoordinator.state,
          stateLog: [...activeCoordinator.stateLog],
          committedCount: activeCoordinator.committedCount,
          spokenCount: activeCoordinator.spokenCount,
          fillersSpokenCount: activeCoordinator.metrics.fillersSpokenCount,
          maxFillers: policy.maxFillersPerTurn ?? 3,
          nextOpportunityCountdownSec: remSec,
        }
        activePacingMetrics.value = snapshot
        try {
          postPacingTelemetry(toRaw(snapshot))
        }
        catch {}
      }
    }, 1000)

    const voiceParams = createThinkingAudioFingerprintParams({
      provider: speechStore.activeSpeechProvider,
      model: speechStore.activeSpeechModel,
      voiceId: speechStore.activeSpeechVoiceId || speechStore.activeSpeechVoice?.id,
      pitch: speechStore.pitch,
      rate: speechStore.rate,
      language: speechStore.selectedLanguage,
    })

    const bridge = new PacingPlaybackBridge<AudioBuffer>({
      coordinator,
      playback: {
        schedule: item => playbackManager.schedule(item),
        tryCommitFiller: playbackManager.tryCommitFiller ? item => playbackManager.tryCommitFiller!(item) : undefined,
        stopByIntent: (intentId, reason) => playbackManager.stopByIntent?.(intentId, reason),
        stopAll: reason => playbackManager.stopAll?.(reason),
        getCurrentTime: () => (playbackManager.getCurrentTime ? playbackManager.getCurrentTime() : (getAudioContext()?.currentTime ?? Date.now() / 1000)),
      },
      voiceParams,
      synthesizeAudio: options.synthesizeAudio,
      getIntentContext: options.getIntentContext,
      decodeAudio: async (buffer: ArrayBuffer) => {
        const ctx = getAudioContext()
        if (!ctx)
          throw new Error('AudioContext unavailable')
        return await ctx.decodeAudioData(buffer.slice(0))
      },
    })

    coordinator.dispatch()
    activeCoordinator = coordinator
    activeBridge = bridge
    return coordinator
  }

  function onReasoningChunk(chunk: string) {
    if (!activeCoordinator)
      return
    activeCoordinator.onInferenceEvent({
      type: 'reasoning',
      text: chunk,
      visibility: 'hidden',
      at: Date.now(),
    })
  }

  function onDynamicAsideCue(cue: AsideCandidate) {
    if (!activeCoordinator)
      return
    activeCoordinator.submitAsideCandidate(cue)
  }

  function onAnswerLiteral(literal: string) {
    if (!activeCoordinator)
      return
    activeCoordinator.onInferenceEvent({
      type: 'answer',
      text: literal,
      at: Date.now(),
    })
  }

  function onAnswerAudioScheduled(at: number = Date.now()) {
    if (activeCoordinator) {
      activeCoordinator.notifyAnswerAudioScheduled(at)
    }
  }

  async function onAssistantEnd() {
    if (!activeCoordinator)
      return
    await activeCoordinator.onAssistantEnd()
    // NOTICE: Do not null activeCoordinator or activeBridge immediately here.
    // In typical turn lifecycles, answer TTS synthesis finishes and schedules its first
    // audio chunk shortly after the assistant text stream finishes. Keeping the coordinator
    // active allows notifyAnswerAudioScheduled to record answerFirstAudioMs and compute handoffGapMs.
    // Full teardown occurs upon startTurn, cancel, or speech intent completion.
  }

  function cancel(reason: string) {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
    if (activeCoordinator) {
      activeCoordinator.cancel(reason)
      activeBridge?.cancel(reason)
      activeCoordinator = null
      activeBridge = null
    }
  }

  function onFillerStarted() {
    activeBridge?.handleFillerStarted()
  }

  function onFillerEnded() {
    activeBridge?.handleFillerEnded()
  }

  return {
    startTurn,
    onReasoningChunk,
    onDynamicAsideCue,
    onAnswerLiteral,
    onAnswerAudioScheduled,
    onAssistantEnd,
    cancel,
    onFillerStarted,
    onFillerEnded,
    activePacingMetrics: readonly(activePacingMetrics),
    latestPacingMetrics: readonly(latestPacingMetrics),
  }
}
