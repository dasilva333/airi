<script setup lang="ts">
import { errorMessageFrom } from '@moeru/std'
import type { WebSocketBaseEvent, WebSocketEventOf, WebSocketEvents } from '@proj-airi/server-sdk'
import { ContextUpdateStrategy } from '@proj-airi/server-sdk'
import { useCharacterOrchestratorStore, useCharacterStore } from '@proj-airi/stage-ui/stores/character'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { CHAT_STREAM_CHANNEL_NAME, CONTEXT_CHANNEL_NAME } from '@proj-airi/stage-ui/stores/chat/constants'
import { useModsServerChannelStore } from '@proj-airi/stage-ui/stores/mods/api/channel-server'
import type { ChatStreamEvent, ContextMessage } from '@proj-airi/stage-ui/types/chat'
import { getEventSourceKey } from '@proj-airi/stage-ui/utils'
import { Callout } from '@proj-airi/ui'
import { useBroadcastChannel } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import ContextFlowActions from './components/context-flow-actions.vue'
import ContextFlowFilters from './components/context-flow-filters.vue'
import ContextFlowStream from './components/context-flow-stream.vue'
import { useContextFlowFormatters } from './composables/use-context-flow-formatters'
import type { FlowDirection, FlowEntry, SparkNotifyEntryState } from './context-flow-types'

type DirectionFilter = 'all' | FlowDirection

const { formatDestinations, getPayloadData, summarizeContextUpdate, truncateText } = useContextFlowFormatters()

const chatStore = useChatOrchestratorStore()
const characterStore = useCharacterStore()
const characterOrchestratorStore = useCharacterOrchestratorStore()
const serverChannelStore = useModsServerChannelStore()

const entries = ref<FlowEntry[]>([])
const showIncoming = ref(true)
const showOutgoing = ref(true)
const showServer = ref(true)
const showBroadcast = ref(false)
const showChat = ref(false)
const showDevtools = ref(false)
const filterText = ref('')
const maxEntries = ref('200')

const testPayload = ref('{"type":"coding:context","data":{"file":{"path":"README.md"}}}')
const testStrategy = ref<ContextUpdateStrategy>(ContextUpdateStrategy.ReplaceSelf)

const testSparkNotifyPayload = ref(
  JSON.stringify(
    {
      destinations: ['character'],
      headline: 'Minecraft entity `zombie` attacked you, health dropped 2 points.',
      kind: 'ping',
      note: 'Triggered from minecraft',
      payload: {
        message: 'Hello from Context Flow devtools',
      },
      urgency: 'immediate',
    },
    null,
    2,
  ),
)

const directionFilter = ref<DirectionFilter>('all')

const sparkNotifyStates = ref<Map<string, SparkNotifyEntryState>>(new Map())

const maxEntriesValue = computed(() => {
  const parsed = Number.parseInt(maxEntries.value, 10)
  if (!Number.isFinite(parsed)) return 200
  return Math.min(Math.max(parsed, 50), 1000)
})

const filteredEntries = computed(() => {
  const query = filterText.value.trim().toLowerCase()
  const filtered = entries.value.filter((entry) => {
    if (directionFilter.value !== 'all' && entry.direction !== directionFilter.value) return false
    if (!showIncoming.value && entry.direction === 'incoming') return false
    if (!showOutgoing.value && entry.direction === 'outgoing') return false
    if (!showServer.value && entry.channel === 'server') return false
    if (!showBroadcast.value && entry.channel === 'broadcast') return false
    if (!showChat.value && entry.channel === 'chat') return false
    if (!showDevtools.value && entry.channel === 'devtools') return false
    if (!query) return true
    return entry.searchText.includes(query)
  })
  return filtered.slice().reverse()
})

function normalizePayload(payload: unknown) {
  try {
    return JSON.parse(JSON.stringify(payload)) as unknown
  } catch {
    return payload
  }
}

function getSparkNotifyReaction(eventId: string) {
  const reactions = characterStore.reactions
  for (let index = reactions.length - 1; index >= 0; index -= 1) {
    const reaction = reactions[index]
    if (reaction.sourceEventId === eventId) return reaction
  }
  return undefined
}

function getSparkNotifyEntryState(entry: FlowEntry) {
  if (entry.type !== 'spark:notify') return undefined
  const payload = getPayloadData(entry) as { id?: string } | undefined
  if (!payload?.id) return undefined
  return sparkNotifyStates.value.get(payload.id)
}

function setSparkNotifyState(nextState: SparkNotifyEntryState) {
  const nextMap = new Map(sparkNotifyStates.value)
  nextMap.set(nextState.eventId, nextState)
  sparkNotifyStates.value = nextMap
}

function updateSparkNotifyState(eventId: string, updater: (state: SparkNotifyEntryState) => SparkNotifyEntryState) {
  const current = sparkNotifyStates.value.get(eventId)
  if (!current) return
  setSparkNotifyState(updater(current))
}

function summarizeServerEvent(event: { type: string; data: Record<string, any> }) {
  switch (event.type) {
    case 'module:announce':
      return `name=${event.data.name} events=${event.data.possibleEvents?.length ?? 0}`
    case 'spark:notify':
      return [
        event.data.headline ? `headline="${truncateText(String(event.data.headline), 120)}"` : '',
        event.data.destinations
          ? `destinations="${truncateText(formatDestinations(event.data.destinations), 120)}"`
          : '',
      ]
        .filter(Boolean)
        .join(' ')
    case 'spark:emit':
      return [
        event.data.state ? `state=${event.data.state}` : '',
        event.data.destinations
          ? `destinations="${truncateText(formatDestinations(event.data.destinations), 120)}"`
          : '',
      ]
        .filter(Boolean)
        .join(' ')
    case 'spark:command':
      return [
        event.data.intent ? `intent=${event.data.intent}` : '',
        event.data.priority ? `priority=${event.data.priority}` : '',
        event.data.destinations
          ? `destinations="${truncateText(formatDestinations(event.data.destinations), 120)}"`
          : '',
      ]
        .filter(Boolean)
        .join(' ')
    default:
      if (event.data.text) return `text="${truncateText(String(event.data.text), 120)}"`
      if (event.data.transcription) return `transcription="${truncateText(String(event.data.transcription), 120)}"`
      return ''
  }
}

function buildSearchText(entry: Omit<FlowEntry, 'searchText'>) {
  const payloadText =
    typeof entry.payload === 'string'
      ? entry.payload
      : (() => {
          try {
            return JSON.stringify(entry.payload)
          } catch {
            return ''
          }
        })()
  return [entry.direction, entry.channel, entry.type, entry.summary ?? '', payloadText].join(' ').toLowerCase()
}

let entryId = 0
function pushEntry(entry: Omit<FlowEntry, 'id' | 'timestamp' | 'searchText'>) {
  const normalizedPayload = normalizePayload(entry.payload)
  const nextEntry: FlowEntry = {
    ...entry,
    id: entryId++,
    payload: normalizedPayload,
    searchText: '',
    timestamp: Date.now(),
  }
  nextEntry.searchText = buildSearchText(nextEntry)

  entries.value.push(nextEntry)
  if (entries.value.length > maxEntriesValue.value)
    entries.value.splice(0, entries.value.length - maxEntriesValue.value)
}

function clearEntries() {
  entries.value = []
}

function sendTestContextUpdate() {
  const text = testPayload.value.trim()
  if (!text) return

  serverChannelStore.sendContextUpdate({
    strategy: testStrategy.value,
    text,
  })

  pushEntry({
    channel: 'devtools',
    direction: 'outgoing',
    payload: { strategy: testStrategy.value, text },
    summary: `strategy=${testStrategy.value} length=${text.length}`,
    type: 'context:update',
  })
}

async function sendTestSparkNotify() {
  const raw = testSparkNotifyPayload.value.trim()
  if (!raw) return

  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    toast(`Invalid spark:notify: ${errorMessageFrom(err)}`)
    return
  }

  const destinations = Array.isArray(parsed?.destinations)
    ? parsed.destinations.filter((d: unknown) => typeof d === 'string')
    : []
  if (!parsed?.headline || !destinations.length) {
    toast('Missing required fields (headline, destinations[]) for spark:notify')
    return
  }

  // TODO(@nekomeowww): improve server event, support to have zod or valibot schema validation for better cross runtime handling
  const notify = {
    destinations,
    eventId: typeof parsed.eventId === 'string' && parsed.eventId ? parsed.eventId : nanoid(),
    headline: String(parsed.headline),
    id: typeof parsed.id === 'string' && parsed.id ? parsed.id : nanoid(),
    kind: parsed.kind === 'alarm' || parsed.kind === 'ping' || parsed.kind === 'reminder' ? parsed.kind : 'ping',
    lane: typeof parsed.lane === 'string' ? parsed.lane : undefined,
    metadata: parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : undefined,
    note: typeof parsed.note === 'string' ? parsed.note : undefined,
    payload: parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : undefined,
    requiresAck: typeof parsed.requiresAck === 'boolean' ? parsed.requiresAck : undefined,
    ttlMs: typeof parsed.ttlMs === 'number' ? parsed.ttlMs : undefined,
    urgency:
      parsed.urgency === 'immediate' || parsed.urgency === 'soon' || parsed.urgency === 'later'
        ? parsed.urgency
        : 'immediate',
  }

  const simulatedEvent: WebSocketEventOf<'spark:notify'> = {
    data: notify,
    source: 'devtools',
    type: 'spark:notify',
  }

  pushEntry({
    channel: 'server',
    direction: 'incoming',
    payload: simulatedEvent,
    summary: summarizeServerEvent(simulatedEvent as any),
    type: 'spark:notify',
  })

  try {
    setSparkNotifyState({
      commands: [],
      eventId: notify.id,
      handling: true,
      reaction: '',
      sparkId: notify.eventId,
      startedAt: Date.now(),
    })

    const result = await characterOrchestratorStore.handleSparkNotify(simulatedEvent)
    const reaction = getSparkNotifyReaction(notify.id)
    updateSparkNotifyState(notify.id, (current) => ({
      ...current,
      commands: result?.commands ?? [],
      endedAt: Date.now(),
      handling: false,
      reaction: reaction?.message ?? '',
      sparkId: notify.eventId,
    }))

    if (result?.commands?.length) {
      for (const command of result.commands) {
        serverChannelStore.send({
          data: command,
          type: 'spark:command',
        })
      }
    }
  } catch (error) {
    toast(`Error handling spark:notify: ${errorMessageFrom(error)}`)
    updateSparkNotifyState(notify.id, (current) => ({
      ...current,
      endedAt: Date.now(),
      error: errorMessageFrom(error),
      handling: false,
    }))
  }
}

const { data: incomingContext } = useBroadcastChannel<ContextMessage, ContextMessage>({
  name: CONTEXT_CHANNEL_NAME,
})
const { data: incomingStreamEvent } = useBroadcastChannel<ChatStreamEvent, ChatStreamEvent>({
  name: CHAT_STREAM_CHANNEL_NAME,
})

const cleanupFns: Array<() => void> = []

onMounted(() => {
  cleanupFns.push(
    serverChannelStore.onContextUpdate((event) => {
      pushEntry({
        channel: 'server',
        direction: 'incoming',
        payload: event,
        summary: [
          `source=${getEventSourceKey(event)}`,
          `strategy=${event.data.strategy}`,
          summarizeContextUpdate(event.data),
        ]
          .filter(Boolean)
          .join(' '),
        type: event.type,
      })
    }),
  )

  const serverEventTypes = [
    'module:announce',
    'module:configure',
    'module:authenticated',
    'error',
    'spark:notify',
    'spark:emit',
    'spark:command',
    'input:text',
    'input:text:voice',
    'output:gen-ai:chat:message',
    'output:gen-ai:chat:complete',
    'output:gen-ai:chat:tool-call',
  ] as const

  for (const type of serverEventTypes) {
    cleanupFns.push(
      serverChannelStore.onEvent(type, (event) => {
        if (event.type === 'spark:notify') {
          const eventId = (event as WebSocketBaseEvent<'spark:notify', WebSocketEvents['spark:notify']>).data?.id
          if (eventId && !sparkNotifyStates.value.has(eventId)) {
            const sparkId = (event as WebSocketBaseEvent<'spark:notify', WebSocketEvents['spark:notify']>).data?.eventId
            setSparkNotifyState({
              commands: [],
              eventId,
              handling: true,
              reaction: '',
              sparkId,
              startedAt: Date.now(),
            })
          }
        }

        pushEntry({
          channel: 'server',
          direction: 'incoming',
          payload: event,
          summary: summarizeServerEvent(event as any),
          type: event.type,
        })
      }),
    )
  }

  cleanupFns.push(
    chatStore.onBeforeMessageComposed(async (message, context) => {
      pushEntry({
        channel: 'chat',
        direction: 'outgoing',
        payload: { context, message },
        summary: truncateText(message),
        type: 'before-compose',
      })
    }),
    chatStore.onAfterMessageComposed(async (message, context) => {
      pushEntry({
        channel: 'chat',
        direction: 'outgoing',
        payload: { context, message },
        summary: truncateText(message),
        type: 'after-compose',
      })
    }),
    chatStore.onBeforeSend(async (message, context) => {
      pushEntry({
        channel: 'chat',
        direction: 'outgoing',
        payload: { context, message },
        summary: truncateText(message),
        type: 'before-send',
      })
    }),
    chatStore.onAfterSend(async (message, context) => {
      pushEntry({
        channel: 'chat',
        direction: 'outgoing',
        payload: { context, message },
        summary: truncateText(message),
        type: 'after-send',
      })
    }),
    chatStore.onTokenLiteral(async (literal, context) => {
      pushEntry({
        channel: 'chat',
        direction: 'outgoing',
        payload: { context, literal },
        summary: truncateText(literal, 80),
        type: 'token-literal',
      })
    }),
    chatStore.onTokenSpecial(async (special, context) => {
      pushEntry({
        channel: 'chat',
        direction: 'outgoing',
        payload: { context, special },
        summary: truncateText(special, 80),
        type: 'token-special',
      })
    }),
    chatStore.onStreamEnd(async (context) => {
      pushEntry({
        channel: 'chat',
        direction: 'outgoing',
        payload: { context },
        summary: 'stream completed',
        type: 'stream-end',
      })
    }),
    chatStore.onAssistantResponseEnd(async (message, context) => {
      pushEntry({
        channel: 'chat',
        direction: 'outgoing',
        payload: { context, message },
        summary: truncateText(message),
        type: 'assistant-end',
      })
    }),
    chatStore.onAssistantMessage(async (message, messageText, context) => {
      pushEntry({
        channel: 'chat',
        direction: 'outgoing',
        payload: { context, message, messageText },
        summary: truncateText(messageText),
        type: 'assistant-message',
      })
    }),
    chatStore.onChatTurnComplete(async (chat, context) => {
      pushEntry({
        channel: 'chat',
        direction: 'outgoing',
        payload: { chat, context },
        summary: truncateText(chat.outputText),
        type: 'chat-turn-complete',
      })
    }),
  )
})

watch(incomingContext, (event) => {
  if (!event) return

  pushEntry({
    channel: 'broadcast',
    direction: 'incoming',
    payload: event,
    summary: [`source=${getEventSourceKey(event)}`, `strategy=${event.strategy}`, summarizeContextUpdate(event)]
      .filter(Boolean)
      .join(' '),
    type: 'context:broadcast',
  })
})

watch(incomingStreamEvent, (event) => {
  if (!event) return

  pushEntry({
    channel: 'broadcast',
    direction: 'incoming',
    payload: event,
    summary:
      event.type === 'token-literal'
        ? truncateText(event.literal, 80)
        : event.type === 'token-special'
          ? truncateText(event.special, 80)
          : event.type === 'assistant-message'
            ? truncateText(event.messageText ?? '', 120)
            : `session=${event.sessionId}`,
    type: `stream:${event.type}`,
  })
})

watch(
  () => characterStore.reactions.length,
  () => {
    for (const state of sparkNotifyStates.value.values()) {
      if (state.reaction) continue
      const reaction = getSparkNotifyReaction(state.eventId)
      if (!reaction) continue
      updateSparkNotifyState(state.eventId, (current) => ({
        ...current,
        endedAt: current.endedAt ?? Date.now(),
        handling: false,
        reaction: reaction.message,
      }))
    }
  },
)

watch(maxEntriesValue, () => {
  if (entries.value.length > maxEntriesValue.value)
    entries.value.splice(0, entries.value.length - maxEntriesValue.value)
})

onUnmounted(() => {
  for (const cleanup of cleanupFns) cleanup()
})
</script>

<template>
  <div :class="['flex', 'flex-col', 'gap-6']">
    <Callout label="Context Flow">
      Inspect incoming context updates (server + broadcast) and outgoing chat hooks in real time. Use this to verify
      how plugin context (e.g. VSCode coding context) travels into the chat pipeline and out to server events.
    </Callout>

    <div :class="['grid', 'gap-6', 'lg:grid-cols-[360px_1fr]']">
      <ContextFlowFilters
        v-model:direction-filter="directionFilter"
        v-model:show-incoming="showIncoming"
        v-model:show-outgoing="showOutgoing"
        v-model:show-server="showServer"
        v-model:show-broadcast="showBroadcast"
        v-model:show-chat="showChat"
        v-model:show-devtools="showDevtools"
        v-model:max-entries="maxEntries"
        @clear="clearEntries"
      />

      <div :class="['flex', 'flex-col', 'gap-2']">
        <ContextFlowActions
          v-model:test-strategy="testStrategy"
          v-model:test-payload="testPayload"
          v-model:test-spark-notify-payload="testSparkNotifyPayload"
          v-model:attention-tick-interval="characterOrchestratorStore.attentionConfig.tickIntervalMs"
          v-model:attention-task-window="characterOrchestratorStore.attentionConfig.taskNotifyWindowMs"
          v-model:attention-requeue-delay="characterOrchestratorStore.attentionConfig.requeueDelayMs"
          v-model:attention-max-attempts="characterOrchestratorStore.attentionConfig.maxAttempts"
          @send-context-update="sendTestContextUpdate"
          @send-spark-notify="sendTestSparkNotify"
        />

        <ContextFlowStream
          v-model:filter-text="filterText"
          :entries="filteredEntries"
          :get-spark-notify-state="getSparkNotifyEntryState"
        />
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: tamagotchi.settings.devtools.pages.context-flow.title
  subtitleKey: tamagotchi.settings.devtools.title
</route>
