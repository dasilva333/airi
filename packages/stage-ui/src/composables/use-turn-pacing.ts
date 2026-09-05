import type { PlaybackItem } from '@proj-airi/pipelines-audio'
import type { Ref } from 'vue'

import type { ThinkingAudioFingerprintParams } from '../libs/pacing/pacing-cache'
import type { AiriThinkingFiller } from '../types/card.schema'
import type { PacingMetrics, PacingPolicyConfig } from '../types/pacing'

import { readonly, ref } from 'vue'

import { PacingPlaybackBridge, resolveFillerCandidate } from '../libs/pacing/pacing-playback-bridge'
import { TurnPacingCoordinator } from '../libs/pacing/turn-pacing-coordinator'
import { useAudioContext } from '../stores/audio'
import { useSpeechStore } from '../stores/modules/speech'

export interface UseTurnPacingOptions {
  activeCard: Ref<any>
  playbackManager: {
    schedule: (item: PlaybackItem<AudioBuffer>) => void
    stopByIntent?: (intentId: string, reason: string) => void
    stopAll?: (reason: string) => void
    getCurrentTime?: () => number
  }
  speechStore?: ReturnType<typeof useSpeechStore>
  audioContext?: AudioContext | null
  isPlaybackSuppressed?: Ref<boolean>
  getIntentContext?: () => { intentId?: string, streamId?: string }
}

/**
 * Composable orchestrating conversational pacing and thinking fillers for a stage host.
 */
export function useTurnPacing(options: UseTurnPacingOptions) {
  const { activeCard, playbackManager, isPlaybackSuppressed } = options

  const speechStore = options.speechStore ?? useSpeechStore()
  const audioCtxStore = useAudioContext()

  function getAudioContext(): AudioContext | null {
    return options.audioContext ?? audioCtxStore.audioContext ?? null
  }

  const ttftSamplesByProvider = new Map<string, number[]>()
  let currentGeneration = 0
  let activeCoordinator: TurnPacingCoordinator | null = null
  let activeBridge: PacingPlaybackBridge<AudioBuffer> | null = null

  const activePacingMetrics = ref<PacingMetrics | null>(null)

  function startTurn(turnId: string, _context?: any): TurnPacingCoordinator | null {
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

    if (activeCoordinator) {
      activeCoordinator.cancel('new-turn')
      activeBridge?.cancel('new-turn')
    }

    const gen = ++currentGeneration
    const providerKey = `${speechStore.activeSpeechProvider || 'unknown'}:${speechStore.activeSpeechModel || 'default'}`
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
      onCancelFiller: (reason) => {
        bridge.cancel(reason)
      },
      onSettled: (metrics) => {
        activePacingMetrics.value = metrics
        if (metrics.ttftMs && metrics.ttftMs > 0) {
          const list = ttftSamplesByProvider.get(providerKey) || []
          list.push(metrics.ttftMs)
          if (list.length > 30)
            list.shift()
          ttftSamplesByProvider.set(providerKey, list)
        }
      },
    })

    const voiceParams: ThinkingAudioFingerprintParams = {
      provider: speechStore.activeSpeechProvider,
      model: speechStore.activeSpeechModel || '',
      voiceId: speechStore.activeSpeechVoice?.id || speechStore.activeSpeechVoiceId || '',
      pitch: speechStore.pitch ?? 0,
      rate: speechStore.rate ?? 1,
      language: speechStore.selectedLanguage || 'en-US',
      text: '',
      format: 'audio/mp3',
    }

    const bridge = new PacingPlaybackBridge<AudioBuffer>({
      coordinator,
      playback: {
        schedule: item => playbackManager.schedule(item),
        stopByIntent: (intentId, reason) => playbackManager.stopByIntent?.(intentId, reason),
        stopAll: reason => playbackManager.stopAll?.(reason),
        getCurrentTime: () => (playbackManager.getCurrentTime ? playbackManager.getCurrentTime() : (getAudioContext()?.currentTime ?? Date.now() / 1000)),
      },
      voiceParams,
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

  function onAnswerLiteral(literal: string) {
    if (!activeCoordinator)
      return
    activeCoordinator.onInferenceEvent({
      type: 'answer',
      text: literal,
      at: Date.now(),
    })
  }

  async function onAssistantEnd() {
    if (!activeCoordinator)
      return
    await activeCoordinator.onAssistantEnd()
    activeCoordinator = null
    activeBridge = null
  }

  function cancel(reason: string) {
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
    onAnswerLiteral,
    onAssistantEnd,
    cancel,
    onFillerStarted,
    onFillerEnded,
    activePacingMetrics: readonly(activePacingMetrics),
  }
}
