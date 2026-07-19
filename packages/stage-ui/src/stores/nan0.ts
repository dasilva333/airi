import type { Message } from '@xsai/shared-chat'

import type {
  Nan0BridgeAction,
  Nan0BridgeRequestMap,
  Nan0PreparedTurnProxy,
} from './nan0-bridge'
import type { Nan0RendererIdentity } from './nan0-renderer'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import {
  classifyNan0DiagnosticResult,
  createNan0HeartbeatEngine,
  createNan0KernelObservatory,
  InMemoryStateStore,
  LocalStorageStateStore,
  Nan0Kernel,
  resolveNan0KernelObservatoryConfiguration,
  SystemNan0Clock,
} from '@proj-airi/nan0-runtime'
import { nan0DiagnosticsAppend, nan0DiagnosticsGetConfiguration } from '@proj-airi/stage-shared'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { requestNan0Owner, setNan0OwnerHandler, toAutonomyEvaluationProxy, toMetabolismEvaluationProxy, toPreparedTurnProxy, toTemporalAutonomyEvaluationProxy } from './nan0-bridge'
import { isNan0ProcessorEnabled, resolveNan0ReasoningRoute } from './nan0-config'
import { setNan0InputPresenceHandler } from './nan0-input-presence'
import { useSettingsStageModel } from './settings/stage-model'

const NAN0_CONTEXT_MARKER = '[NAN0 KERNEL CONTEXT]'

let activeInstallationCleanup: (() => void) | null = null

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    activeInstallationCleanup?.()
    activeInstallationCleanup = null
  })
}

function contentToText(content: unknown): string {
  if (typeof content === 'string')
    return content

  if (Array.isArray(content)) {
    return content
      .map((part: any) => typeof part?.text === 'string' ? part.text : '')
      .filter(Boolean)
      .join('\n')
  }

  return String(content ?? '')
}

async function dispatchNan0BodyExpression(expression: { kind: string, intensity: number }): Promise<boolean> {
  const renderer = useSettingsStageModel().stageModelRenderer
  if (renderer === 'live2d') {
    const { useLive2d } = await import('@proj-airi/stage-ui-live2d')
    return useLive2d().triggerEmotion(expression.kind, expression.intensity)
  }
  if (renderer === 'vrm') {
    const { useModelStore } = await import('@proj-airi/stage-ui-three')
    useModelStore().triggerEmotion(expression.kind, expression.intensity)
    return true
  }
  if (renderer === 'spine') {
    const { useSpine } = await import('@proj-airi/stage-ui-spine')
    useSpine().playOneShotAnimation(expression.kind, false)
    return true
  }
  if (renderer === 'mmd') {
    const { useMmd } = await import('@proj-airi/stage-ui-mmd')
    const store = useMmd()
    const matchedMotion = store.availableMotions.find(motion => motion === expression.kind || motion.replace(/\.vmd$/i, '') === expression.kind)
    if (matchedMotion)
      store.currentMotion = matchedMotion
    else
      store.previewExpression = expression.kind
    return true
  }
  return false
}

export const useNan0RuntimeStore = defineStore('nan0-runtime', () => {
  const installed = ref(false)
  const booted = ref(false)
  const lastThoughtId = ref<string | null>(null)
  const lastError = ref<string | null>(null)

  let rendererIdentity: Nan0RendererIdentity | null = null
  const isElectron = typeof window !== 'undefined' && Boolean((window as any).electron)
  const getDiagnosticConfiguration = isElectron ? useElectronEventaInvoke(nan0DiagnosticsGetConfiguration) : null
  const appendDiagnostics = isElectron ? useElectronEventaInvoke(nan0DiagnosticsAppend) : null
  const observatory = createNan0KernelObservatory({
    configuration: resolveNan0KernelObservatoryConfiguration({}),
    createId: nanoid,
    sink: appendDiagnostics
      ? {
          async write(events) {
            await appendDiagnostics({ events: events.map(event => structuredClone(event)) })
          },
        }
      : undefined,
  })
  let configureObservatoryPromise: Promise<void> | null = null

  function ensureObservatoryConfigured(): Promise<void> {
    configureObservatoryPromise ??= (async () => {
      if (!getDiagnosticConfiguration)
        return
      const configuration = await getDiagnosticConfiguration()
      observatory.configure({
        ...configuration,
        // Electron main owns PowerShell output; avoid printing the same event in the renderer.
        console: false,
      })
    })().catch((error) => {
      console.warn('[Nan0 Observatory] Failed to read host diagnostic configuration:', error)
    })
    return configureObservatoryPromise
  }

  function diagnostic(event: string, details: Record<string, unknown> = {}): void {
    observatory.emit({
      event,
      details: {
        rendererInstanceId: rendererIdentity?.instanceId ?? 'unassigned',
        rendererHash: rendererIdentity?.hash ?? 'unknown',
        ...details,
      },
    })
  }

  const clock = new SystemNan0Clock()
  const stateStore = typeof window !== 'undefined' && window.localStorage
    ? new LocalStorageStateStore('nan0/kernel-state/v1', {
        storage: window.localStorage,
        clock,
        diagnostic,
      })
    : new InMemoryStateStore()

  const kernel = new Nan0Kernel({
    stateStore,
    clock,
    createId: () => nanoid(),
    decisionCapabilities: {
      canSpeak: true,
      canBodyExpress: () => ['live2d', 'vrm', 'spine', 'mmd'].includes(String(useSettingsStageModel().stageModelRenderer)),
      availableActionIntents: [],
    },
    reasoningClient: {
      async stream(request, onEvent) {
        const [
          { useLLM },
          { useAiriCardStore },
          { useConsciousnessStore },
          { useProvidersStore },
        ] = await Promise.all([
          import('./llm'),
          import('./modules/airi-card'),
          import('./modules/consciousness'),
          import('./providers'),
        ])
        const llm = useLLM()
        const airiCard = useAiriCardStore()
        const consciousness = useConsciousnessStore()
        const providers = useProvidersStore()
        const { providerId, model } = resolveNan0ReasoningRoute(
          airiCard.activeCard?.extensions?.airi?.modules?.cognition,
          {
            providerId: consciousness.activeProvider,
            model: consciousness.activeModel,
          },
        )
        if (!providerId || !model)
          throw new Error('AIRI has no active provider and model for Nan0 private thought.')

        const provider = await providers.getProviderInstance(providerId)
        const config = providers.getProviderConfig(providerId)
        let text = ''
        let reasoning = ''
        let finishReason = ''
        diagnostic('thought.inference.start', {
          providerId,
          model,
          messageCount: request.messages.length + 1,
          streaming: true,
        })
        await llm.stream(model, provider as any, [
          { role: 'system', content: request.system },
          ...request.messages,
        ] as Message[], {
          headers: (config.headers || {}) as Record<string, string>,
          tools: [],
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          abortSignal: request.signal,
          onStreamEvent: async (event) => {
            if (event.type === 'text-delta') {
              text += event.text
              await onEvent(event)
            }
            else if (event.type === 'reasoning-delta') {
              reasoning += event.text
              await onEvent(event)
            }
            else if (event.type === 'finish') {
              finishReason = String((event as any).finishReason ?? '')
            }
          },
        })
        const resultText = text || reasoning
        diagnostic('thought.inference.complete', {
          providerId,
          model,
          outputLength: resultText.length,
          streaming: true,
        })
        return { text: resultText, finishReason }
      },
      async generate(request) {
        const [
          { useLLM },
          { useAiriCardStore },
          { useConsciousnessStore },
          { useProvidersStore },
        ] = await Promise.all([
          import('./llm'),
          import('./modules/airi-card'),
          import('./modules/consciousness'),
          import('./providers'),
        ])
        const llm = useLLM()
        const airiCard = useAiriCardStore()
        const consciousness = useConsciousnessStore()
        const providers = useProvidersStore()
        const { providerId, model } = resolveNan0ReasoningRoute(
          airiCard.activeCard?.extensions?.airi?.modules?.cognition,
          {
            providerId: consciousness.activeProvider,
            model: consciousness.activeModel,
          },
        )
        if (!providerId || !model)
          throw new Error('AIRI has no active provider and model for Nan0 private thought.')

        const provider = await providers.getProviderInstance(providerId)
        const config = providers.getProviderConfig(providerId)
        diagnostic('thought.inference.start', {
          providerId,
          model,
          messageCount: request.messages.length + 1,
        })
        const result = await llm.generate(model, provider as any, [
          { role: 'system', content: request.system },
          ...request.messages,
        ] as Message[], {
          headers: (config.headers || {}) as Record<string, string>,
          tools: [],
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          abortSignal: request.signal,
        })
        const text = result.text
          || (result as any).reasoning
          || (result as any).reasoning_content
          || ''
        diagnostic('thought.inference.complete', {
          providerId,
          model,
          outputLength: text.length,
        })
        return {
          text,
          finishReason: String((result as any).finishReason ?? ''),
        }
      },
    },
    privateThoughtProviderMetadata: {
      provider: 'airi-provider-selection',
      model: 'active-consciousness-model',
    },
    observatory,
  })

  let installPromise: Promise<void> | null = null

  async function ensureInstalled(renderer: Nan0RendererIdentity): Promise<void> {
    rendererIdentity ??= renderer
    await ensureObservatoryConfigured()
    diagnostic('store.install.requested', {
      installed: installed.value,
      installPending: installPromise != null,
      isOwner: renderer.isOwner,
      isExecutor: renderer.isExecutor,
    })

    if (!renderer.isOwner && !renderer.isExecutor) {
      diagnostic('store.install.skipped-non-participant')
      return
    }

    if (installed.value) {
      diagnostic('store.install.skipped-already-installed')
      return
    }

    if (installPromise) {
      diagnostic('store.install.joined-pending')
      return installPromise
    }

    installPromise = (renderer.isOwner ? installOwner(renderer) : installExecutor(renderer))
      .catch((error) => {
        lastError.value = error instanceof Error ? error.message : String(error)
        installPromise = null
        throw error
      })

    return installPromise
  }

  async function installOwner(renderer: Nan0RendererIdentity): Promise<void> {
    diagnostic('kernel.boot.start')
    await kernel.boot()
    booted.value = true

    const handleOwnerRequest = async (
      action: Nan0BridgeAction,
      payload: Nan0BridgeRequestMap[Nan0BridgeAction],
    ): Promise<any> => {
      diagnostic('bridge.owner.request', {
        action,
        thoughtId: (payload as any).thoughtId,
        turnId: (payload as any).turnId,
        memoryCount: kernel.getStateSnapshot().memories.length,
        revision: kernel.getStateSnapshot().revision ?? 0,
      })

      switch (action) {
        case 'prepare': {
          const prepared = await kernel.prepareTurn(payload as Nan0BridgeRequestMap['prepare'])
          lastThoughtId.value = prepared.thoughtId
          return toPreparedTurnProxy(prepared)
        }
        case 'complete': {
          const input = payload as Nan0BridgeRequestMap['complete']
          await kernel.recordAssistantTurn(input)
          return { persisted: true }
        }
        case 'terminal': {
          const input = payload as Nan0BridgeRequestMap['terminal']
          if (input.decision === 'SILENCE') {
            await kernel.recordSilenceDecision(input)
          }
          else {
            await kernel.recordNonSpeechDecision({
              ...input,
              decision: input.decision,
            })
          }
          return { persisted: true }
        }
        case 'fail': {
          await kernel.failTurn(payload as Nan0BridgeRequestMap['fail'])
          return { persisted: true }
        }
        case 'evaluateAutonomy': {
          const batch = await kernel.evaluatePendingIntentions(payload as Nan0BridgeRequestMap['evaluateAutonomy'])
          return toAutonomyEvaluationProxy(batch)
        }
        case 'evaluateTemporalAutonomy': {
          const batch = await kernel.evaluateTemporalAutonomy(payload as Nan0BridgeRequestMap['evaluateTemporalAutonomy'])
          return toTemporalAutonomyEvaluationProxy(batch)
        }
        case 'evaluateMetabolism': {
          const result = await kernel.evaluateMetabolism(payload as Nan0BridgeRequestMap['evaluateMetabolism'])
          return toMetabolismEvaluationProxy(result)
        }
        case 'notifyInput': {
          await kernel.notifyExternalInputPresence(payload as Nan0BridgeRequestMap['notifyInput'])
          return { persisted: true }
        }
        case 'deferAutonomy': {
          await kernel.deferAutonomousExpression(payload as Nan0BridgeRequestMap['deferAutonomy'])
          return { persisted: true }
        }
        case 'deferTemporalAutonomy': {
          await kernel.deferTemporalAutonomousExpression(payload as Nan0BridgeRequestMap['deferTemporalAutonomy'])
          return { persisted: true }
        }
      }
    }

    activeInstallationCleanup?.()
    const cleanupOwnerHandler = setNan0OwnerHandler(renderer.instanceId, handleOwnerRequest)
    const recordShutdown = () => {
      void kernel.shutdown().catch(error => diagnostic('kernel.shutdown.failed', {
        error: error instanceof Error ? error.message : String(error),
      }))
    }
    window.addEventListener('pagehide', recordShutdown)
    activeInstallationCleanup = () => {
      window.removeEventListener('pagehide', recordShutdown)
      cleanupOwnerHandler()
      recordShutdown()
    }
    installed.value = true
    diagnostic('store.owner.install.complete', {
      memoryCount: kernel.getStateSnapshot().memories.length,
      thoughtCount: kernel.getStateSnapshot().thoughts.length,
      revision: kernel.getStateSnapshot().revision ?? 0,
    })
  }

  async function installExecutor(renderer: Nan0RendererIdentity): Promise<void> {
    const [{ useChatOrchestratorStore }, { useAiriCardStore }] = await Promise.all([
      import('./chat'),
      import('./modules/airi-card'),
    ])
    const chat = useChatOrchestratorStore()
    const airiCard = useAiriCardStore()
    const nan0ProcessorEnabled = () => isNan0ProcessorEnabled(
      airiCard.activeCard?.extensions?.airi?.modules?.cognition,
    )
    const preparedTurns = new Map<string, Nan0PreparedTurnProxy>()
    const dispatchedBodyTurns = new Set<string>()
    const autonomyByTurn = new Map<string, {
      intentionId?: string
      evaluationId?: string
      temporalEventId?: string
      internalObservationId?: string
      heartbeatTickId?: string
      source: `internal:${string}`
    }>()
    const pendingAutonomy = new Map<string, {
      prepared: Nan0PreparedTurnProxy
      intentionId?: string
      evaluationId?: string
      temporalEventId?: string
      internalObservationId?: string
      heartbeatTickId?: string
      source: `internal:${string}`
    }>()
    const expressionResultByHeartbeatTick = new Map<string, {
      result: 'SPEAK' | 'CHOSEN_SILENCE' | 'SUPPRESSED_SILENCE' | 'WAIT' | 'ACT' | 'BODY_EXPRESSION' | 'STALE' | 'FAILURE_SILENCE'
      failureLayer?: string
      reasonCodes?: string[]
    }>()

    function turnKey(context: { message: { id?: string } }): string {
      const messageId = context.message.id
      if (!messageId)
        throw new Error('Nan0 chat lifecycle context is missing a stable message ID.')
      return String(messageId)
    }

    const cleanups = [
      chat.onBeforeMessageComposed(async (message, context) => {
        const autonomyCorrelationId = String((context.message as any).nan0AutonomyCorrelationId ?? '')
        const autonomous = autonomyCorrelationId ? pendingAutonomy.get(autonomyCorrelationId) : undefined
        if (autonomous) {
          const key = turnKey(context)
          pendingAutonomy.delete(autonomyCorrelationId)
          preparedTurns.set(key, autonomous.prepared)
          autonomyByTurn.set(key, {
            intentionId: autonomous.intentionId,
            evaluationId: autonomous.evaluationId,
            temporalEventId: autonomous.temporalEventId,
            internalObservationId: autonomous.internalObservationId,
            heartbeatTickId: autonomous.heartbeatTickId,
            source: autonomous.source,
          })
          lastThoughtId.value = autonomous.prepared.thoughtId
          diagnostic('autonomy.executor.prepared', {
            intentionId: autonomous.intentionId,
            evaluationId: autonomous.evaluationId,
            temporalEventId: autonomous.temporalEventId,
            thoughtId: autonomous.prepared.thoughtId,
            turnId: autonomous.prepared.turnId,
            heartbeatTickId: autonomous.heartbeatTickId,
          })
          return
        }
        if (!nan0ProcessorEnabled())
          return
        const source = context.input?.type?.startsWith('input:')
          ? context.input.type.slice('input:'.length)
          : 'chat'
        const sessionActorId = (context.message as any)?.actorId
          ?? (context.message as any)?.userId
          ?? (context.message as any)?.authorId
        const isLocalKyoInput = source === 'text' || source === 'voice' || source === 'chat'
        const actorId = String(sessionActorId ?? (isLocalKyoInput ? 'kyo' : 'unknown'))
        const displayName = String((context.message as any)?.displayName ?? (actorId === 'kyo' ? 'Kyo' : actorId))

        diagnostic('bridge.delegate.prepare.start', {
          messageId: context.message.id,
          sessionId: context.sessionId,
          actorId,
        })
        const prepared = await requestNan0Owner(renderer.instanceId, 'prepare', {
          id: String(context.message.id ?? nanoid()),
          source: source === 'text' ? 'chat' : source as any,
          sessionId: context.sessionId,
          actorId,
          displayName,
          content: message,
          metadata: {
            sessionInputType: context.input?.type,
            sourceIdentity: {
              source,
              actorId: sessionActorId == null ? undefined : String(sessionActorId),
              displayName: (context.message as any)?.displayName,
            },
          },
          timestamp: Number(context.message.createdAt ?? Date.now()),
        })

        lastThoughtId.value = prepared.thoughtId
        preparedTurns.set(turnKey(context), prepared)
        diagnostic('bridge.delegate.prepare.complete', {
          thoughtId: prepared.thoughtId,
          decisionId: prepared.decision.decisionId,
          turnId: prepared.turnId,
          sessionId: prepared.sessionId,
          inputEventId: prepared.inputEventId,
          decision: prepared.decision.finalDecision,
          allowed: prepared.decision.allowed,
          speakability: prepared.decision.speakability,
        })
      }),

      chat.onAfterMessageComposed(async (_message, context) => {
        const prepared = preparedTurns.get(turnKey(context))
        if (!prepared) {
          diagnostic('bridge.delegate.after-compose.missing-prepared-turn')
          return
        }
        if (!prepared.decision.allowed || prepared.decision.finalDecision !== 'SPEAK')
          return

        const alreadyInjected = context.composedMessage.some((message: Message) =>
          message.role === 'system'
          && contentToText(message.content).includes(NAN0_CONTEXT_MARKER),
        )
        if (alreadyInjected)
          return

        const firstNonSystemIndex = context.composedMessage.findIndex(
          (message: Message) => message.role !== 'system',
        )
        const insertAt = firstNonSystemIndex === -1
          ? context.composedMessage.length
          : firstNonSystemIndex
        context.composedMessage.splice(insertAt, 0, {
          role: 'system',
          content: prepared.outwardDirective,
        } as Message)
        diagnostic('bridge.delegate.after-compose.injected', {
          thoughtId: prepared.thoughtId,
          decisionId: prepared.decision.decisionId,
          insertAt,
        })
      }),

      chat.onBeforeSend(async (_message, context) => {
        const key = turnKey(context)
        const prepared = preparedTurns.get(key)
        if (!prepared)
          return

        context.nan0ToolAuthority = {
          schemaVersion: 1,
          finalDecision: prepared.decision.finalDecision,
          thoughtId: prepared.thoughtId,
          decisionId: prepared.decision.decisionId,
          turnId: prepared.turnId,
          actionIntentId: prepared.actionAuthority?.actionIntentId ?? null,
          capabilityId: prepared.actionAuthority?.capabilityId ?? null,
          lifecyclePolicyId: prepared.actionAuthority?.lifecyclePolicyId ?? null,
          authorizedToolNames: [...(prepared.actionAuthority?.authorizedToolNames ?? [])],
        }

        if (prepared.decision.finalDecision === 'BODY_EXPRESSION' && prepared.decision.allowed) {
          const expression = prepared.decision.bodyExpression
          if (!expression)
            throw new Error('Allowed Nan0 BODY_EXPRESSION is missing its bounded expression payload.')
          if (!dispatchedBodyTurns.has(key)) {
            const dispatched = await dispatchNan0BodyExpression(expression)
            if (!dispatched)
              throw new Error(`Active AIRI stage could not dispatch Nan0 body expression ${expression.kind}.`)
            dispatchedBodyTurns.add(key)
            diagnostic('bridge.delegate.body-expression.dispatched', {
              thoughtId: prepared.thoughtId,
              decisionId: prepared.decision.decisionId,
              kind: expression.kind,
              intensity: expression.intensity,
            })
          }
          context.responseDisposition = {
            decision: 'SILENCE',
            reason: 'body-expression-only',
            thoughtId: prepared.thoughtId,
            decisionId: prepared.decision.decisionId,
          }
          return
        }

        if (prepared.decision.finalDecision === 'SPEAK' && prepared.decision.allowed)
          return
        const decision = prepared.decision.finalDecision === 'SPEAK'
          ? 'WAIT'
          : prepared.decision.finalDecision === 'BODY_EXPRESSION' ? 'SILENCE' : prepared.decision.finalDecision

        context.responseDisposition = {
          decision,
          reason: prepared.decision.suppressionReason
            ?? (prepared.decision.reasonCodes.join(',') || `decision-${decision.toLowerCase()}`),
          thoughtId: prepared.thoughtId,
          decisionId: prepared.decision.decisionId,
        }
      }),

      chat.onAssistantResponseEnd(async (message, context) => {
        const key = turnKey(context)
        const prepared = preparedTurns.get(key)
        const autonomy = autonomyByTurn.get(key)
        diagnostic('bridge.delegate.assistant-end.fired', {
          thoughtId: prepared?.thoughtId,
          outputLength: message.length,
          heartbeatTickId: autonomy?.heartbeatTickId,
        })
        if (!prepared)
          return

        await requestNan0Owner(renderer.instanceId, 'complete', {
          turnId: prepared.turnId,
          thoughtId: prepared.thoughtId,
          decisionId: prepared.decision.decisionId,
          content: message,
          timestamp: Number(context.assistantMessageCreatedAt ?? Date.now()),
          metadata: {
            assistantMessageId: context.assistantMessageId,
            inputType: context.input?.type,
            completionHook: 'onAssistantResponseEnd',
            intentionId: autonomy?.intentionId,
            evaluationId: autonomy?.evaluationId,
            temporalEventId: autonomy?.temporalEventId,
            internalObservationId: autonomy?.internalObservationId,
          },
        })
        preparedTurns.delete(key)
        dispatchedBodyTurns.delete(key)
        autonomyByTurn.delete(key)
        diagnostic('bridge.delegate.assistant-end.acknowledged', {
          thoughtId: prepared.thoughtId,
          turnId: prepared.turnId,
          decisionId: prepared.decision.decisionId,
          heartbeatTickId: autonomy?.heartbeatTickId,
        })
        if (autonomy?.heartbeatTickId) {
          expressionResultByHeartbeatTick.set(autonomy.heartbeatTickId, {
            result: prepared.decision.finalDecision === 'BODY_EXPRESSION' ? 'BODY_EXPRESSION' : 'SPEAK',
            reasonCodes: prepared.decision.reasonCodes,
          })
        }
        scheduler.notify('turn-complete')
      }),

      chat.onAssistantSilence(async (reason, context) => {
        const key = turnKey(context)
        const prepared = preparedTurns.get(key)
        const autonomy = autonomyByTurn.get(key)
        if (!prepared)
          return
        await requestNan0Owner(renderer.instanceId, 'terminal', {
          turnId: prepared.turnId,
          thoughtId: prepared.thoughtId,
          decisionId: prepared.decision.decisionId,
          decision: prepared.decision.finalDecision === 'SPEAK' ? 'SILENCE' : prepared.decision.finalDecision,
          reason,
          timestamp: Number(context.assistantMessageCreatedAt ?? Date.now()),
          metadata: {
            assistantMessageId: context.assistantMessageId,
            inputType: context.input?.type,
            completionHook: 'onAssistantSilence',
            expressionOutcome: prepared.decision.finalDecision === 'SPEAK'
              ? 'provider-silence'
              : 'decision-terminal',
            intentionId: autonomy?.intentionId,
            evaluationId: autonomy?.evaluationId,
            temporalEventId: autonomy?.temporalEventId,
            internalObservationId: autonomy?.internalObservationId,
          },
        })
        if (autonomy?.heartbeatTickId) {
          expressionResultByHeartbeatTick.set(autonomy.heartbeatTickId, {
            result: prepared.decision.finalDecision === 'BODY_EXPRESSION'
              ? 'BODY_EXPRESSION'
              : prepared.decision.finalDecision === 'SPEAK' ? 'SUPPRESSED_SILENCE' : prepared.decision.finalDecision === 'SILENCE' ? 'CHOSEN_SILENCE' : prepared.decision.finalDecision,
            failureLayer: prepared.decision.finalDecision === 'SPEAK' ? 'outward-provider' : undefined,
            reasonCodes: [...prepared.decision.reasonCodes, reason],
          })
        }
        preparedTurns.delete(key)
        dispatchedBodyTurns.delete(key)
        autonomyByTurn.delete(key)
        scheduler.notify('turn-complete')
      }),

      chat.onChatError(async (error, context) => {
        const key = turnKey(context)
        const prepared = preparedTurns.get(key)
        const autonomy = autonomyByTurn.get(key)
        if (!prepared)
          return

        await requestNan0Owner(renderer.instanceId, 'fail', {
          turnId: prepared.turnId,
          thoughtId: prepared.thoughtId,
          error: error.message,
          timestamp: Date.now(),
          metadata: {
            technicalDetail: error.detail,
            inputType: context.input?.type,
            completionHook: 'onChatError',
            intentionId: autonomy?.intentionId,
            evaluationId: autonomy?.evaluationId,
            temporalEventId: autonomy?.temporalEventId,
            internalObservationId: autonomy?.internalObservationId,
          },
        })
        if (autonomy?.heartbeatTickId) {
          expressionResultByHeartbeatTick.set(autonomy.heartbeatTickId, {
            result: 'FAILURE_SILENCE',
            failureLayer: 'outward-expression',
            reasonCodes: ['expression.host-error'],
          })
        }
        preparedTurns.delete(key)
        dispatchedBodyTurns.delete(key)
        autonomyByTurn.delete(key)
        scheduler.notify('turn-complete')
      }),
    ]

    const scheduler = createNan0HeartbeatEngine({
      isHostReady: () => nan0ProcessorEnabled() && !chat.sending,
      baseIntervalMs: 30_000,
      minimumIntervalMs: 10_000,
      maximumIntervalMs: 60_000,
      jitterRatio: 0.2,
      diagnostic,
      async evaluate(reason, heartbeatContext) {
        const metabolism = await requestNan0Owner(renderer.instanceId, 'evaluateMetabolism', {
          reason,
          hostReady: !chat.sending,
          heartbeatTickId: heartbeatContext.heartbeatTickId,
        })
        const metabolismResult = {
          nextEvaluationAt: metabolism.nextEvaluationAt,
          ...metabolism.terminal,
          observationCount: metabolism.observationId ? 1 : 0,
        }
        if (metabolism.outcome === 'skipped')
          return metabolismResult
        if (metabolism.prepared) {
          const prepared = metabolism.prepared
          if (chat.sending) {
            await requestNan0Owner(renderer.instanceId, 'fail', {
              turnId: prepared.turnId,
              thoughtId: prepared.thoughtId,
              error: 'metabolism.host-became-busy',
              timestamp: Date.now(),
              metadata: { internalObservationId: metabolism.observationId, failureLayer: 'autonomous-expression-handoff' },
            })
            diagnostic('expression.suppressed', {
              heartbeatTickId: heartbeatContext.heartbeatTickId,
              observationId: metabolism.observationId,
              thoughtId: prepared.thoughtId,
              decisionId: prepared.decision.decisionId,
              turnId: prepared.turnId,
              result: 'SUPPRESSED_SILENCE',
              failureLayer: 'host-readiness',
              reasonCodes: ['metabolism.host-became-busy'],
            })
            return {
              ...metabolismResult,
              result: 'SUPPRESSED_SILENCE' as const,
              failureLayer: 'host-readiness',
              reasonCodes: ['metabolism.host-became-busy'],
            }
          }
          const correlationId = `metabolism_${nanoid()}`
          const expressionEventId = `expression_${nanoid()}`
          const source = 'internal:heartbeat' as const
          pendingAutonomy.set(correlationId, {
            prepared,
            internalObservationId: metabolism.observationId ?? undefined,
            heartbeatTickId: heartbeatContext.heartbeatTickId,
            source,
          })
          diagnostic('expression.started', {
            expressionEventId,
            heartbeatTickId: heartbeatContext.heartbeatTickId,
            observationId: metabolism.observationId,
            thoughtId: prepared.thoughtId,
            decisionId: prepared.decision.decisionId,
            turnId: prepared.turnId,
            sessionId: prepared.sessionId,
          })
          try {
            await chat.ingest('', {
              triggerOnly: true,
              metadata: {
                nan0AutonomyCorrelationId: correlationId,
                internalObservationId: metabolism.observationId,
                actorId: 'nan0',
                source,
                heartbeatTickId: heartbeatContext.heartbeatTickId,
                nan0ExpressionEventId: expressionEventId,
              },
            }, prepared.sessionId)
            const hostResult = expressionResultByHeartbeatTick.get(heartbeatContext.heartbeatTickId)
            expressionResultByHeartbeatTick.delete(heartbeatContext.heartbeatTickId)
            const result = hostResult?.result ?? metabolism.terminal.result
            diagnostic(result === 'FAILURE_SILENCE' ? 'expression.failed' : result === 'SUPPRESSED_SILENCE' || result === 'STALE' ? 'expression.suppressed' : 'expression.completed', {
              expressionEventId,
              heartbeatTickId: heartbeatContext.heartbeatTickId,
              observationId: metabolism.observationId,
              thoughtId: prepared.thoughtId,
              decisionId: prepared.decision.decisionId,
              turnId: prepared.turnId,
              sessionId: prepared.sessionId,
              result,
              failureLayer: hostResult?.failureLayer ?? null,
              reasonCodes: hostResult?.reasonCodes ?? prepared.decision.reasonCodes,
            })
            return {
              ...metabolismResult,
              result,
              failureLayer: hostResult?.failureLayer ?? metabolism.terminal.failureLayer,
              reasonCodes: hostResult?.reasonCodes ?? metabolism.terminal.reasonCodes,
            }
          }
          catch (error) {
            pendingAutonomy.delete(correlationId)
            await requestNan0Owner(renderer.instanceId, 'fail', {
              turnId: prepared.turnId,
              thoughtId: prepared.thoughtId,
              error: error instanceof Error ? error.message : 'metabolism.expression-handoff-failed',
              timestamp: Date.now(),
              metadata: { internalObservationId: metabolism.observationId, failureLayer: 'autonomous-expression-handoff' },
            })
            diagnostic('expression.failed', {
              expressionEventId,
              heartbeatTickId: heartbeatContext.heartbeatTickId,
              observationId: metabolism.observationId,
              thoughtId: prepared.thoughtId,
              decisionId: prepared.decision.decisionId,
              turnId: prepared.turnId,
              sessionId: prepared.sessionId,
              result: 'FAILURE_SILENCE',
              failureLayer: 'autonomous-expression-handoff',
              reasonCodes: ['expression.handoff-failed'],
              error: error instanceof Error ? error.message : String(error),
            })
            return {
              ...metabolismResult,
              result: 'FAILURE_SILENCE' as const,
              failureLayer: 'autonomous-expression-handoff',
              reasonCodes: ['expression.handoff-failed'],
            }
          }
        }

        const response = await requestNan0Owner(renderer.instanceId, 'evaluateAutonomy', {
          reason: reason === 'external-input' ? 'state-change' : reason,
          hostReady: !chat.sending,
          limit: 2,
        })
        let heartbeatResult = metabolismResult
        for (const evaluation of response.evaluations) {
          if (!evaluation.prepared) {
            const result = evaluation.outcome === 'provider-failure'
              ? 'FAILURE_SILENCE' as const
              : evaluation.outcome === 'SILENCE' ? 'CHOSEN_SILENCE' as const : evaluation.outcome
            heartbeatResult = {
              ...heartbeatResult,
              result,
              observationId: evaluation.observationId,
              observationCount: 1,
              failureLayer: evaluation.outcome === 'provider-failure' ? 'thought-generation' : null,
            }
            continue
          }
          if (chat.sending) {
            await requestNan0Owner(renderer.instanceId, 'deferAutonomy', {
              intentionId: evaluation.intentionId,
              turnId: evaluation.prepared.turnId,
              thoughtId: evaluation.prepared.thoughtId,
              reason: 'autonomy.host-became-busy',
            })
            heartbeatResult = {
              ...heartbeatResult,
              result: 'SUPPRESSED_SILENCE',
              failureLayer: 'host-readiness',
              reasonCodes: ['autonomy.host-became-busy'],
            }
            continue
          }
          const correlationId = `autonomy_${nanoid()}`
          const expressionEventId = `expression_${nanoid()}`
          pendingAutonomy.set(correlationId, {
            prepared: evaluation.prepared,
            intentionId: evaluation.intentionId,
            evaluationId: evaluation.evaluationId,
            heartbeatTickId: heartbeatContext.heartbeatTickId,
            source: 'internal:intention',
          })
          diagnostic('expression.started', {
            expressionEventId,
            heartbeatTickId: heartbeatContext.heartbeatTickId,
            observationId: evaluation.observationId,
            thoughtId: evaluation.prepared.thoughtId,
            decisionId: evaluation.prepared.decision.decisionId,
            turnId: evaluation.prepared.turnId,
            sessionId: evaluation.prepared.sessionId,
          })
          try {
            await chat.ingest('', {
              triggerOnly: true,
              metadata: {
                nan0AutonomyCorrelationId: correlationId,
                intentionId: evaluation.intentionId,
                evaluationId: evaluation.evaluationId,
                actorId: 'nan0',
                source: 'internal:intention',
                heartbeatTickId: heartbeatContext.heartbeatTickId,
                nan0ExpressionEventId: expressionEventId,
              },
            }, evaluation.prepared.sessionId)
            const hostResult = expressionResultByHeartbeatTick.get(heartbeatContext.heartbeatTickId)
            expressionResultByHeartbeatTick.delete(heartbeatContext.heartbeatTickId)
            const result = hostResult?.result ?? classifyNan0DiagnosticResult({ outcome: evaluation.outcome })
            diagnostic(result === 'FAILURE_SILENCE' ? 'expression.failed' : result === 'SUPPRESSED_SILENCE' || result === 'STALE' ? 'expression.suppressed' : 'expression.completed', {
              expressionEventId,
              heartbeatTickId: heartbeatContext.heartbeatTickId,
              observationId: evaluation.observationId,
              thoughtId: evaluation.prepared.thoughtId,
              decisionId: evaluation.prepared.decision.decisionId,
              turnId: evaluation.prepared.turnId,
              sessionId: evaluation.prepared.sessionId,
              result,
              failureLayer: hostResult?.failureLayer ?? null,
              reasonCodes: hostResult?.reasonCodes ?? evaluation.prepared.decision.reasonCodes,
            })
            heartbeatResult = {
              ...heartbeatResult,
              result,
              sessionId: evaluation.prepared.sessionId,
              observationId: evaluation.observationId,
              thoughtId: evaluation.prepared.thoughtId,
              decisionId: evaluation.prepared.decision.decisionId,
              turnId: evaluation.prepared.turnId,
              source: 'internal:intention',
              observationCount: 1,
              failureLayer: hostResult?.failureLayer ?? null,
              reasonCodes: hostResult?.reasonCodes ?? evaluation.prepared.decision.reasonCodes,
            }
          }
          catch (error) {
            pendingAutonomy.delete(correlationId)
            await requestNan0Owner(renderer.instanceId, 'deferAutonomy', {
              intentionId: evaluation.intentionId,
              turnId: evaluation.prepared.turnId,
              thoughtId: evaluation.prepared.thoughtId,
              reason: error instanceof Error ? error.message : 'autonomy.expression-handoff-failed',
            })
            diagnostic('expression.failed', {
              expressionEventId,
              heartbeatTickId: heartbeatContext.heartbeatTickId,
              observationId: evaluation.observationId,
              thoughtId: evaluation.prepared.thoughtId,
              decisionId: evaluation.prepared.decision.decisionId,
              turnId: evaluation.prepared.turnId,
              sessionId: evaluation.prepared.sessionId,
              result: 'FAILURE_SILENCE',
              failureLayer: 'autonomous-expression-handoff',
              reasonCodes: ['expression.handoff-failed'],
            })
            heartbeatResult = {
              ...heartbeatResult,
              result: 'FAILURE_SILENCE',
              failureLayer: 'autonomous-expression-handoff',
              reasonCodes: ['expression.handoff-failed'],
            }
          }
        }
        const nextEvaluationAt = [metabolism.nextEvaluationAt, response.nextEvaluationAt]
          .filter((candidate): candidate is number => candidate != null)
          .reduce<number | null>((minimum, candidate) => minimum == null ? candidate : Math.min(minimum, candidate), null)
        return { ...heartbeatResult, nextEvaluationAt }
      },
      onError: error => diagnostic('autonomy.scheduler.failed', {
        error: error instanceof Error ? error.message : String(error),
      }),
    })
    cleanups.push(setNan0InputPresenceHandler((input) => {
      if (!nan0ProcessorEnabled())
        return
      void requestNan0Owner(renderer.instanceId, 'notifyInput', input)
        .then(() => scheduler.notify('external-input'))
        .catch(error => diagnostic('heartbeat.input-notification.failed', {
          error: error instanceof Error ? error.message : String(error),
        }))
    }))
    scheduler.start()

    activeInstallationCleanup?.()
    activeInstallationCleanup = () => {
      for (const cleanup of cleanups)
        cleanup()
      scheduler.stop()
      preparedTurns.clear()
      dispatchedBodyTurns.clear()
      autonomyByTurn.clear()
      pendingAutonomy.clear()
      expressionResultByHeartbeatTick.clear()
      void observatory.flush()
    }
    installed.value = true
    diagnostic('store.executor.install.complete', {
      hookCount: cleanups.length,
    })
  }

  return {
    installed,
    booted,
    lastThoughtId,
    lastError,
    ensureInstalled,
    kernel,
  }
})
