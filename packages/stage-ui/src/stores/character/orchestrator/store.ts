import type { WebSocketBaseEvent, WebSocketEventOf, WebSocketEvents } from '@proj-airi/server-sdk'

import { defineStore, storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useLLM } from '../../llm'
import { useModsServerChannelStore } from '../../mods/api/channel-server'
import { useConsciousnessStore } from '../../modules/consciousness'
import { useProvidersStore } from '../../providers'
import { useCharacterNotebookStore, useCharacterStore } from '../'
import { setupAgentSparkNotifyHandler } from './agents/event-handler-spark-notify'

export { sparkCommandSchema } from './agents/event-handler-spark-notify'

export const useCharacterOrchestratorStore = defineStore('character-orchestrator', () => {
  const { stream } = useLLM()
  const { activeProvider, activeModel } = storeToRefs(useConsciousnessStore())
  const providersStore = useProvidersStore()
  const characterStore = useCharacterStore()
  const notebookStore = useCharacterNotebookStore()
  const { systemPrompt } = storeToRefs(characterStore)
  const modsServerChannelStore = useModsServerChannelStore()

  const processing = ref(false)
  const pendingNotifies = ref<Array<WebSocketEventOf<'spark:notify'>>>([])
  const scheduledNotifies = ref<
    Array<{
      event: WebSocketEventOf<'spark:notify'>
      enqueuedAt: number
      nextRunAt: number
      attempts: number
      maxAttempts: number
      reason?: string
    }>
  >([])
  const attentionConfig = ref({
    maxAttempts: 3,
    requeueDelayMs: 30_000,
    taskNotifyWindowMs: 60_000,
    tickIntervalMs: 2_000,
  })
  let tickTimer: ReturnType<typeof setInterval> | undefined
  const sparkNotifyAgent = setupAgentSparkNotifyHandler({
    getActiveModel: () => activeModel.value,
    getActiveProvider: () => activeProvider.value,
    getPending: () => pendingNotifies.value,
    getProcessing: () => processing.value,
    getProviderInstance: (name) => providersStore.getProviderInstance(name),
    getSystemPrompt: () => systemPrompt.value,
    onReactionDelta: (eventId, text) => characterStore.onSparkNotifyReactionStreamEvent(eventId, text),
    onReactionEnd: (eventId, text) => characterStore.onSparkNotifyReactionStreamEnd(eventId, text),
    setPending: (next) => (pendingNotifies.value = next),
    setProcessing: (next) => (processing.value = next),
    stream,
  })

  function computeNextRunAt(event: WebSocketEventOf<'spark:notify'>, attempts: number) {
    const now = Date.now()
    const baseDelay = (() => {
      switch (event.data.urgency) {
        case 'immediate':
          return 0
        case 'soon':
          return 10_000
        case 'later':
          return 60_000
        default:
          return 30_000
      }
    })()

    return now + baseDelay + attempts * attentionConfig.value.requeueDelayMs
  }

  function removePending(eventId: string) {
    pendingNotifies.value = pendingNotifies.value.filter((item) => item.data.id !== eventId)
  }

  function enqueueSparkNotify(
    event: WebSocketEventOf<'spark:notify'>,
    options?: { reason?: string; nextRunAt?: number; maxAttempts?: number },
  ) {
    if (!pendingNotifies.value.find((item) => item.data.id === event.data.id)) {
      pendingNotifies.value = [...pendingNotifies.value, event]
    }

    scheduledNotifies.value = [
      ...scheduledNotifies.value,
      {
        attempts: 0,
        enqueuedAt: Date.now(),
        event,
        maxAttempts: options?.maxAttempts ?? attentionConfig.value.maxAttempts,
        nextRunAt: options?.nextRunAt ?? computeNextRunAt(event, 0),
        reason: options?.reason,
      },
    ]
  }

  async function processSparkNotify(event: WebSocketEventOf<'spark:notify'>) {
    const result = await sparkNotifyAgent.handle(event)
    if (!result?.commands?.length) return result

    for (const command of result.commands) {
      modsServerChannelStore.send({
        data: command,
        type: 'spark:command',
      })
    }

    return result
  }

  async function handleIncomingSparkNotify(event: WebSocketEventOf<'spark:notify'>) {
    if (event.data.urgency === 'immediate' && !processing.value) {
      return await processSparkNotify(event)
    }

    enqueueSparkNotify(event, { reason: 'spark:notify' })
    return undefined
  }

  function enqueueDueTasks(now: number) {
    const dueTasks = notebookStore.getDueTasks(now, attentionConfig.value.taskNotifyWindowMs)
    if (!dueTasks.length) return

    for (const task of dueTasks) {
      const event: WebSocketEventOf<'spark:notify'> = {
        data: {
          destinations: ['character'],
          eventId: task.id,
          headline: `Task reminder: ${task.title}`,
          id: `task-${task.id}`,
          kind: 'reminder',
          note: task.details,
          payload: {
            dueAt: task.dueAt,
            priority: task.priority,
            taskId: task.id,
          },
          urgency: task.priority === 'critical' ? 'immediate' : 'soon',
        },
        source: 'character:task-scheduler',
        type: 'spark:notify',
      }

      enqueueSparkNotify(event, { reason: 'task:due' })
      notebookStore.markTaskNotified(task.id, now + attentionConfig.value.requeueDelayMs)
    }
  }

  async function tick() {
    if (processing.value) return

    const now = Date.now()
    enqueueDueTasks(now)

    const nextIndex = scheduledNotifies.value.findIndex((item) => item.nextRunAt <= now)
    if (nextIndex < 0) return

    const [next] = scheduledNotifies.value.splice(nextIndex, 1)
    removePending(next.event.data.id)

    try {
      await processSparkNotify(next.event)
    } catch (error) {
      if (next.attempts + 1 < next.maxAttempts) {
        scheduledNotifies.value = [
          ...scheduledNotifies.value,
          {
            ...next,
            attempts: next.attempts + 1,
            nextRunAt: computeNextRunAt(next.event, next.attempts + 1),
          },
        ]
        pendingNotifies.value = [...pendingNotifies.value, next.event]
      } else {
        console.warn('Dropped spark:notify after max attempts:', error)
      }
    }
  }

  function startTicker() {
    if (tickTimer) return

    tickTimer = setInterval(() => {
      void tick()
    }, attentionConfig.value.tickIntervalMs)
  }

  function stopTicker() {
    if (!tickTimer) return

    clearInterval(tickTimer)
    tickTimer = undefined
  }

  async function handleSparkEmit(_: WebSocketBaseEvent<'spark:emit', WebSocketEvents['spark:emit']>) {
    // Currently no-op
    return undefined
  }

  async function simulateAssistant(text: string) {
    await characterStore.emitTextOutput(text)
  }

  function initialize() {
    modsServerChannelStore.onEvent('spark:notify', async (event) => {
      try {
        await handleIncomingSparkNotify(event)
      } catch (error) {
        console.warn('Failed to handle spark:notify event:', error)
      }
    })

    modsServerChannelStore.onEvent('spark:emit', async (event) => {
      try {
        await handleSparkEmit(event)
      } catch (error) {
        console.warn('Failed to handle spark:emit event:', error)
      }
    })

    if (typeof window !== 'undefined') {
      ;(window as any).simulateAssistant = simulateAssistant
    }

    startTicker()
  }

  return {
    attentionConfig,
    handleSparkEmit,

    handleSparkNotify: handleIncomingSparkNotify,

    initialize,
    pendingNotifies,
    processing,
    scheduledNotifies,
    simulateAssistant,
    startTicker,
    stopTicker,
  }
})
