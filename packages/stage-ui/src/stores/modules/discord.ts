import type { DiscordCommandDefinition, DiscordEventLogEntry, DiscordInboundMessage, DiscordInteractionPayload, DiscordServiceStatus } from '@proj-airi/stage-shared'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import {
  debug,
  discordServiceCloudflareOAuth,
  discordServiceDeployCloudRelay,
  discordServiceForceSync,
  discordServiceGetStatus,
  discordServiceLeave,
  discordServiceRegisterCommands,
  discordServiceReplyInteraction,
  discordServiceSendImage,
  discordServiceSendMessage,
  discordServiceSendTyping,
  discordServiceSimulateEvent,
  discordServiceStart,
  discordServiceStop,
  discordServiceSummon,
} from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { useModelStore } from '@proj-airi/stage-ui-three'
import { useBroadcastChannel } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'

import { stripMarkers } from '../../composables/response-categoriser'
import { useBackgroundStore } from '../background'
import { useChatOrchestratorStore } from '../chat'
import { useChatSessionStore } from '../chat/session-store'
import { useSettings } from '../settings'
import { useAiriCardStore } from './airi-card'
import { useArtistryStore } from './artistry'
import { useAutonomousArtistryStore } from './artistry-autonomous'
import { useConsciousnessStore } from './consciousness'
import { useHearingSpeechInputPipeline } from './hearing'
import { useLiveSessionStore } from './live-session'
import { useSpeechStore } from './speech'
import { useVisionStore } from './vision'

// ── IPC Event Channel Names ────────────────────────────────────────────────────

const STATUS_CHANGED_CHANNEL = 'eventa:event:electron:discord:status-changed'
const EVENT_LOG_CHANNEL = 'eventa:event:electron:discord:event-log'
const INBOUND_MESSAGE_CHANNEL = 'eventa:event:electron:discord:inbound-message'
const INTERACTION_CHANNEL = 'eventa:event:electron:discord:interaction'

const MAX_EVENT_LOG_ENTRIES = 200

// ── Slash Command Definitions ──────────────────────────────────────────────────

const COMMANDS_VERSION = 11
const CORE_COMMANDS: DiscordCommandDefinition[] = [
  {
    name: 'status',
    description: 'View the current AIRI system status, active modules, and AI brains',
  },
  {
    name: 'imagine',
    description: 'Manually trigger an image generation using the current Autonomous Artistry pipeline',
    options: [
      {
        name: 'prompt',
        description: 'What do you want the active character to visualize?',
        type: 3, // String
        required: true,
      },
    ],
  },
  {
    name: 'director',
    description: 'Toggle Autonomous Artistry (stops generation requests)',
    options: [
      {
        name: 'mode',
        description: 'Set to on or off',
        type: 3, // String
        required: true,
        choices: [
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' },
        ],
      },
    ],
  },
  {
    name: 'character',
    description: 'Switch the active AIRI character profile',
    options: [
      {
        name: 'id',
        description: 'The unique ID of the character to switch to',
        type: 3, // String
        required: false,
        autocomplete: true,
      },
    ],
  },
  {
    name: 'new',
    description: 'Reset the current chat session and start fresh',
    options: [
      {
        name: 'message',
        description: 'Optional initial message to start the new session with',
        type: 3, // String
        required: false,
      },
    ],
  },
  {
    name: 'history',
    description: 'Catch up on the last few turns of the conversation',
    options: [
      {
        name: 'turns',
        description: 'Number of conversation turns to retrieve (default: 5)',
        type: 4, // Integer
        required: false,
      },
    ],
  },
  {
    name: 'summon',
    description: 'Summon the bot to your current voice channel',
  },
  {
    name: 'leave',
    description: 'Disconnect the bot from the voice channel',
  },
  {
    name: 'chatmode',
    description: 'Change the chat mode for handling multiple messages',
    options: [
      {
        name: 'mode',
        description: 'The mode to use (followup, steer, or collect)',
        type: 3, // String
        required: true,
        choices: [
          { name: 'followup', value: 'followup' },
          { name: 'steer', value: 'steer' },
          { name: 'collect', value: 'collect' },
        ],
      },
    ],
  },
  {
    name: 'timelines',
    description: 'List or switch chat timelines (sessions) for the active character',
    options: [
      {
        name: 'id',
        description: 'The unique ID of the timeline/session to switch to',
        type: 3, // String
        required: false,
        autocomplete: true,
      },
    ],
  },
  {
    name: 'journalmoment',
    description: 'Trigger a background journal entry for the active character based on recent chat turns',
    options: [
      {
        name: 'prompt',
        description: 'Optional guidance/instructions on what to emphasize in this journal entry',
        type: 3, // String
        required: false,
      },
    ],
  },
  {
    name: 'voicemode',
    description: 'Change the voice output mode (puppet, voicenote, or none)',
    options: [
      {
        name: 'mode',
        description: 'The mode to use (puppet, voicenote, or none)',
        type: 3, // String
        required: true,
        choices: [
          { name: 'puppet', value: 'puppet' },
          { name: 'voicenote', value: 'voicenote' },
          { name: 'none', value: 'none' },
        ],
      },
    ],
  },
  {
    name: 'voicecall',
    description: 'Change the voice call technology (gemini, classic, or off)',
    options: [
      {
        name: 'mode',
        description: 'The mode to use (gemini, classic, or off)',
        type: 3, // String
        required: true,
        choices: [
          { name: 'gemini', value: 'gemini' },
          { name: 'classic', value: 'classic' },
          { name: 'off', value: 'off' },
        ],
      },
    ],
  },
  {
    name: 'vision',
    description: 'Toggle VLM processing for image attachments (on or off)',
    options: [
      {
        name: 'mode',
        description: 'Set to on or off',
        type: 3, // String
        required: true,
        choices: [
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' },
        ],
      },
    ],
  },
  {
    name: 'manage',
    description: 'Open the interactive session and modality control dashboard',
  },
  {
    name: 'selfie',
    description: 'Capture a stage selfie of the active character',
    options: [
      {
        name: 'emotion',
        description: 'Optional expression/emotion to pose the character with before capturing',
        type: 3, // String
        required: false,
      },
    ],
  },
]

export const useDiscordStore = defineStore('discord', () => {
  const chatSession = useChatSessionStore()
  const chatOrchestrator = useChatOrchestratorStore()
  const airiCard = useAiriCardStore()
  const artistryStore = useArtistryStore()
  const artistryAutonomousStore = useAutonomousArtistryStore()
  const consciousnessStore = useConsciousnessStore()
  const liveSessionStore = useLiveSessionStore()
  const speechStore = useSpeechStore()
  const visionStore = useVisionStore()
  const settingsStore = useSettings()
  const { post: postCapture } = useBroadcastChannel<{ characterId: string, includeBg: boolean, channelId?: string }, { characterId: string, includeBg: boolean, channelId?: string }>({ name: 'airi:stage-capture' })
  // ── Persisted Config ───────────────────────────────────────────────────────
  const enabled = useLocalStorageManualReset<boolean>('settings/discord/enabled', false)
  const token = useLocalStorageManualReset<string>('settings/discord/token', '')
  const executionMode = useLocalStorageManualReset<'local' | 'remote'>('settings/discord/executionMode', 'local')
  const ownerUsername = useLocalStorageManualReset<string>('settings/discord/ownerUsername', '')
  const ownerUserId = useLocalStorageManualReset<string>('settings/discord/ownerUserId', '')

  // Cloud Relay persisted state
  const cfAccountId = useLocalStorageManualReset<string>('settings/discord/cfAccountId', '')
  const cfApiToken = useLocalStorageManualReset<string>('settings/discord/cfApiToken', '')
  const cfOAuthTokens = useLocalStorageManualReset<{ accessToken: string, refreshToken: string, accountId?: string } | null>('settings/discord/cfOAuthTokens', null)
  const cloudRelayInstances = useLocalStorageManualReset<Record<string, { scriptName: string, workerUrl: string, namespaceId: string, memoryMode: 'fixed' | 'unlimited', deployedAt: number, cardId: string, sessionId: string }>>('settings/discord/cloudRelayInstances', {})

  const lastRegisteredVersion = useLocalStorageManualReset<number>('settings/discord/lastRegisteredVersion', 0)
  const chatMode = useLocalStorageManualReset<'followup' | 'steer' | 'collect'>('settings/discord/chatMode', 'followup')
  const voiceMode = useLocalStorageManualReset<'puppet' | 'voicenote' | 'none'>('settings/discord/voiceMode', 'puppet')
  const voiceCall = useLocalStorageManualReset<'classic' | 'gemini' | 'off'>('settings/discord/voiceCall', 'off')
  const visionEnabled = useLocalStorageManualReset<boolean>('settings/discord/visionEnabled', true)
  const dmsEnabled = useLocalStorageManualReset<boolean>('settings/discord/dmsEnabled', false)

  const pendingCollectBatch = ref<{ formattedContent: string, attachments: any[], msg: DiscordInboundMessage }[]>([])
  let collectTimer: ReturnType<typeof setTimeout> | null = null

  function flushCollectBatch() {
    if (pendingCollectBatch.value.length === 0)
      return
    const batch = [...pendingCollectBatch.value]
    pendingCollectBatch.value = []

    const combinedContent = batch.map(b => b.formattedContent).join('\n\n')
    const combinedAttachments = batch.flatMap(b => b.attachments)
    const lastMsg = batch[batch.length - 1].msg

    void chatOrchestrator.ingest(combinedContent, {
      attachments: combinedAttachments,
      metadata: {
        _discordSource: {
          messageId: lastMsg.messageId,
          channelId: lastMsg.channelId,
          userId: lastMsg.userId,
          username: lastMsg.username,
        },
      },
    })
  }

  // ── Live Service State ─────────────────────────────────────────────────────
  const serviceStatus = ref<DiscordServiceStatus>({
    state: 'disconnected',
    ping: null,
    guilds: [],
    activeChannelId: null,
    botUser: null,
    error: null,
  })
  const eventLog = ref<DiscordEventLogEntry[]>([])

  // ── Derived ────────────────────────────────────────────────────────────────
  const configured = computed(() => !!token.value.trim())
  const isConnected = computed(() => serviceStatus.value.state === 'connected')
  const isConnecting = computed(() => serviceStatus.value.state === 'connecting')

  // ── IPC Invokers ───────────────────────────────────────────────────────────
  const isElectron = typeof window !== 'undefined' && !!(window as any).electron

  const invokeStart = isElectron ? useElectronEventaInvoke(discordServiceStart) : null
  const invokeStop = isElectron ? useElectronEventaInvoke(discordServiceStop) : null
  const invokeGetStatus = isElectron ? useElectronEventaInvoke(discordServiceGetStatus) : null
  const invokeCloudflareOAuth = isElectron ? useElectronEventaInvoke(discordServiceCloudflareOAuth) : null

  async function authenticateWithCloudflare() {
    if (!invokeCloudflareOAuth) {
      debug('[DiscordStore] Cloudflare OAuth unavailable in non-Electron environment')
      return
    }
    try {
      debug('[DiscordStore] Invoking Cloudflare OAuth PKCE login flow...')
      const res = await invokeCloudflareOAuth()
      if (res) {
        cfOAuthTokens.value = {
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          accountId: res.accountId,
        }
        if (res.accountId) {
          cfAccountId.value = res.accountId
        }
        debug('[DiscordStore] Cloudflare OAuth tokens successfully captured!')
      }
      return res
    }
    catch (err: any) {
      debug('[DiscordStore] Cloudflare OAuth login error:', err)
      throw err
    }
  }
  const invokeForceSync = isElectron ? useElectronEventaInvoke(discordServiceForceSync) : null
  const invokeSimulate = isElectron ? useElectronEventaInvoke(discordServiceSimulateEvent) : null
  const invokeSendMessage = isElectron ? useElectronEventaInvoke(discordServiceSendMessage) : null
  const invokeSendTyping = isElectron ? useElectronEventaInvoke(discordServiceSendTyping) : null
  const invokeRegisterCommands = isElectron ? useElectronEventaInvoke(discordServiceRegisterCommands) : null
  const invokeReplyInteraction = isElectron ? useElectronEventaInvoke(discordServiceReplyInteraction) : null
  const invokeSendImage = isElectron ? useElectronEventaInvoke(discordServiceSendImage) : null
  const invokeSummon = isElectron ? useElectronEventaInvoke(discordServiceSummon) : null
  const invokeLeave = isElectron ? useElectronEventaInvoke(discordServiceLeave) : null
  const invokeDeployCloudRelay = isElectron ? useElectronEventaInvoke(discordServiceDeployCloudRelay) : null

  async function deployCloudRelay(payload: {
    scriptName: string
    characterPrompt: string
    characterName?: string
    llmBaseUrl?: string
    llmApiKey: string
    llmModel?: string
    memoryMode?: 'fixed' | 'unlimited'
    cardId: string
    sessionId: string
    initialHistory?: Array<{ role: string, content: string }>
  }) {
    const apiToken = cfApiToken.value || cfOAuthTokens.value?.accessToken || ''
    const accountId = cfAccountId.value || cfOAuthTokens.value?.accountId || ''

    if (!apiToken) {
      throw new Error('Cloudflare API Token missing. Please authenticate first.')
    }

    if (!invokeDeployCloudRelay) {
      throw new Error('Cloud Relay deployment unavailable in non-Electron environment')
    }

    const res = await invokeDeployCloudRelay({
      apiToken,
      accountId,
      scriptName: payload.scriptName,
      characterPrompt: payload.characterPrompt,
      characterName: payload.characterName,
      llmBaseUrl: payload.llmBaseUrl,
      llmApiKey: payload.llmApiKey,
      llmModel: payload.llmModel,
      discordBotToken: token.value,
      memoryMode: payload.memoryMode,
      initialHistory: payload.initialHistory,
    })

    if (!res?.success || !res.workerUrl) {
      throw new Error(res?.error || 'Worker deployment failed on Cloudflare Edge')
    }

    cloudRelayInstances.value = {
      ...cloudRelayInstances.value,
      [payload.scriptName]: {
        scriptName: payload.scriptName,
        workerUrl: res.workerUrl,
        namespaceId: res.namespaceId || '',
        memoryMode: payload.memoryMode || 'unlimited',
        deployedAt: Date.now(),
        cardId: payload.cardId,
        sessionId: payload.sessionId,
      },
    }

    return res
  }

  // ── Routing Cache ──────────────────────────────────────────────────────────
  const lastChannelId = ref<string | null>(null)
  const audioTurnBuffer = ref<ArrayBuffer[]>([])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function startService() {
    if (!token.value.trim()) {
      debug('[DiscordStore] Cannot start: no token configured')
      return
    }

    enabled.value = true
    try {
      const status = await invokeStart?.({ token: token.value })
      if (status) {
        serviceStatus.value = status
        // Sync commands on successful start
        await syncCommands()
      }
    }
    catch (err) {
      console.error('[DiscordStore] Failed to start service:', err)
    }
  }

  /**
   * Register slash commands with Discord if the version has increased.
   */
  async function syncCommands(force = false) {
    if (!isConnected.value || !invokeRegisterCommands)
      return

    if (!force && lastRegisteredVersion.value >= COMMANDS_VERSION) {
      debug(`[DiscordStore] Slash commands are up to date (v${lastRegisteredVersion.value})`)
      return
    }

    try {
      debug(`[DiscordStore] Registering slash commands (v${COMMANDS_VERSION})...`)
      await invokeRegisterCommands({ commands: CORE_COMMANDS })
      lastRegisteredVersion.value = COMMANDS_VERSION
    }
    catch (err) {
      console.error('[DiscordStore] Failed to register commands:', err)
    }
  }

  async function stopService() {
    enabled.value = false
    try {
      const status = await invokeStop?.()
      if (status)
        serviceStatus.value = status
    }
    catch (err) {
      console.error('[DiscordStore] Failed to stop service:', err)
    }
  }

  async function refreshStatus() {
    try {
      const status = await invokeGetStatus?.()
      if (status)
        serviceStatus.value = status
    }
    catch { /* ignore in non-electron */ }
  }

  async function forceCardSync(payload: { name: string, avatarBase64: string | null }) {
    try {
      await invokeForceSync?.(payload)
    }
    catch (err) {
      console.error('[DiscordStore] Force sync failed:', err)
    }
  }

  async function simulateEvent(payload?: { username?: string, content?: string }) {
    try {
      await invokeSimulate?.(payload as any)
    }
    catch (err) {
      console.error('[DiscordStore] Simulate failed:', err)
    }
  }

  async function sendMessageToDiscord(channelId: string, content: string) {
    try {
      lastChannelId.value = channelId
      debug(`[DiscordStore] sendMessageToDiscord called. channelId=${channelId}, content=`, JSON.stringify(content))
      const result = await invokeSendMessage?.({ channelId, content })
      debug('[DiscordStore] sendMessageToDiscord IPC result:', result)
    }
    catch (err) {
      console.error('[DiscordStore] Send message failed:', err)
    }
  }

  function addAudioToTurn(buffer: ArrayBuffer) {
    if (buffer.byteLength === 0)
      return
    debug(`[DiscordStore] Aggregating audio chunk: ${Math.round(buffer.byteLength / 1024)}KB`)
    audioTurnBuffer.value.push(buffer)
  }

  async function flushAudioTurn(content?: string) {
    if (audioTurnBuffer.value.length === 0 || !lastChannelId.value) {
      debug('[DiscordStore] Flush skipped: Bucket empty.')
      return
    }

    const channelId = lastChannelId.value
    debug(`[DiscordStore] FLUSHING Voice Note: ${audioTurnBuffer.value.length} chunks to ${channelId}`)

    try {
      // Signal the end of the voice stream to clear passthrough players
      ;(window as any).electron?.ipcRenderer?.send('gemini-audio-end')

      const channelName = 'eventa:invoke:electron:discord:send-voice-note'

      // Explicitly convert buffers to Uint8Arrays to ensure they are cloneable via IPC
      // and strip any Vue reactivity proxies.
      const buffers = audioTurnBuffer.value.map(buf => new Uint8Array(buf))

      // We send the array of buffers to the main process for merging and delivery
      const result = await (window as any).electron?.ipcRenderer?.invoke(
        channelName,
        {
          channelId,
          audioBuffers: buffers,
          content,
          filename: `voice-note-${Date.now()}.mp3`,
        },
      )

      debug('[DiscordStore] Voice Note IPC successful. Result:', result)
    }
    catch (err) {
      console.error('[DiscordStore] Voice Note delivery failed:', err)
    }
    finally {
      audioTurnBuffer.value = []
    }
  }

  function clearAudioTurn() {
    debug('[DiscordStore] Clearing audio turn bucket.')
    audioTurnBuffer.value = []
    ;(window as any).electron?.ipcRenderer?.send('gemini-audio-end')
  }

  async function sendImageToDiscord(channelId: string, base64: string, content?: string, filename?: string) {
    debug(`[DiscordStore] Preparing to invoke IPC sendImage. Channel: ${channelId}, Payload Size: ${Math.round(base64.length / 1024)}KB, Shape: ${base64.substring(0, 30)}...`)

    if (!invokeSendImage) {
      console.error('[DiscordStore] IPC Invoker "invokeSendImage" is NULL! Are you in a browser instead of Electron?')
      return
    }

    try {
      lastChannelId.value = channelId
      const channelName = 'eventa:invoke:electron:discord:send-image'
      debug(`[DiscordStore] NATIVE BYPASS: Invoking ${channelName}. Shape: ${base64.substring(0, 50)}...`)

      // We bypass the wrapper and use the literal channel name to avoid "undefined" contract issues
      const result = await (window as any).electron?.ipcRenderer?.invoke(
        channelName,
        toRaw({ channelId, base64, content, filename }),
      )

      debug('[DiscordStore] Native IPC successful. Result:', result)
    }
    catch (err) {
      console.error('[DiscordStore] Send image failed during IPC invoke:', err)
    }
  }

  function clearEventLog() {
    eventLog.value = []
  }

  function resetState() {
    enabled.reset()
    token.reset()
    serviceStatus.value = {
      state: 'disconnected',
      ping: null,
      guilds: [],
      activeChannelId: null,
      botUser: null,
      error: null,
    }
    eventLog.value = []
  }

  // ── IPC Event Listeners ────────────────────────────────────────────────────
  const processedMessageIds = new Set<string>()
  let cleanupListeners: (() => void) | null = null
  let typingHeartbeat: ReturnType<typeof setInterval> | null = null

  function setupEventListeners() {
    if (!isElectron)
      return

    const ipcRenderer = (window as any).electron?.ipcRenderer
    if (!ipcRenderer)
      return

    debug('[DiscordStore] Initializing IPC listeners...')

    const onStatusChanged = (_event: any, status: DiscordServiceStatus) => {
      serviceStatus.value = status
    }

    const onEventLog = (_event: any, entry: DiscordEventLogEntry) => {
      eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), entry]
    }

    const onInboundMessage = (_event: any, msg: DiscordInboundMessage) => {
      if (!dmsEnabled.value && !msg.guildId) {
        debug(`[DiscordStore] Ignoring message ${msg.messageId.slice(-6)}: private DMs are disabled.`)
        return
      }

      debug(`[DiscordStore] Inbound message received: ${msg.messageId.slice(-6)} from ${msg.username}`)

      // 0. Deduplicate by ID within this window process
      if (processedMessageIds.has(msg.messageId))
        return
      processedMessageIds.add(msg.messageId)

      // Update routing cache
      lastChannelId.value = msg.channelId

      // 1. Leadership Election: Only the "Stage" window (root hash) handles the Brain handover.
      const hash = window.location.hash || '#/'
      const isStage = hash === '#/' || hash.startsWith('#/stage')

      if (!isStage) {
        debug(`[DiscordStore] Skipping Brain handover: Window (${hash}) is not Stage.`)
        return
      }

      debug(`[DiscordStore] Handing over message ${msg.messageId.slice(-6)} to Brain...`)

      // 3. BRAIN HANDOVER (Stage only)
      const handoverEntry: DiscordEventLogEntry = {
        timestamp: Date.now(),
        type: 'BRAIN_HANDOVER',
        summary: `Stage taking control of message ${msg.messageId.slice(-6)}`,
      }
      eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), handoverEntry]

      const formattedContent = `${msg.displayName} says:\n${msg.content}`

      const attachments = visionEnabled.value
        ? (msg.attachments || []).map((att) => {
            const match = att.match(/^data:([^;]+);base64,(.*)$/)
            if (match) {
              return {
                type: 'image' as const,
                mimeType: match[1],
                data: match[2],
              }
            }
            return null
          }).filter(Boolean) as any[]
        : []

      if (chatMode.value === 'collect') {
        pendingCollectBatch.value.push({ formattedContent, attachments, msg })
        if (collectTimer)
          clearTimeout(collectTimer)
        collectTimer = setTimeout(flushCollectBatch, 5000)
        return
      }

      if (chatMode.value === 'steer' && chatOrchestrator.sending) {
        debug(`[DiscordStore] Steer mode active. Aborting current generation and rolling up context.`)
        const partialText = chatOrchestrator.streamingMessage?.content || ''

        chatSession.bumpSessionGeneration(chatSession.activeSessionId)

        const steerContent = partialText
          ? `You were saying: "${partialText}", but then ${msg.displayName} interrupted with:\n${msg.content}`
          : formattedContent

        setTimeout(() => {
          void chatOrchestrator.ingest(steerContent, {
            attachments,
            metadata: {
              _discordSource: {
                messageId: msg.messageId,
                channelId: msg.channelId,
                userId: msg.userId,
                username: msg.username,
              },
            },
          })
        }, 100)
        return
      }

      void chatOrchestrator.ingest(formattedContent, {
        attachments,
        metadata: {
          _discordSource: {
            messageId: msg.messageId,
            channelId: msg.channelId,
            userId: msg.userId,
            username: msg.username,
          },
        },
      })
    }

    const onChatTurnComplete = async (chat: any, context: any) => {
      const source = (context.message as any)?._discordSource
      if (!source?.channelId) {
        debug('[DiscordStore] onChatTurnComplete: No Discord source found in context.')
        return
      }

      debug(`[DiscordStore] Outbound response ready for ${source.username} in channel ${source.channelId.slice(-4)}`)
      debug('[DiscordStore] onChatTurnComplete - FULL chat object:', chat)
      debug('[DiscordStore] onChatTurnComplete - FULL context object:', context)

      // Leadership Election: Only the "Stage" window handles the Outbound reply
      const hash = window.location.hash || '#/'
      const isStage = hash === '#/' || hash.startsWith('#/stage')

      if (!isStage) {
        debug(`[DiscordStore] Skipping Outbound: Window (${hash}) is not Stage.`)
        return
      }

      const ttsText = chat.output.rawContent || chat.outputText || chat.output.content
      const error = chat.output.error

      debug('[DiscordStore] onChatTurnComplete - raw ttsText:', JSON.stringify(ttsText))

      if (error) {
        debug('[DiscordStore] Relaying error back to Discord:', error)
        // Notify Discord about the technical failure so the user isn't left hanging
        const errorMsg = typeof error === 'string' ? error : (error.message || 'Unknown Error')
        const technicalFeedback = `⚠️ **AIRI encountered a technical problem.**\n*(Error: ${errorMsg})*`

        const errorLogEntry: DiscordEventLogEntry = {
          timestamp: Date.now(),
          type: 'ERROR_RELAY',
          summary: `Relaying error to ${source.username}: ${errorMsg.substring(0, 50)}`,
        }
        eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), errorLogEntry]

        await sendMessageToDiscord(source.channelId, technicalFeedback)

        if (typingHeartbeat) {
          debug('[DiscordStore] Turn complete (ERROR), clearing typing heartbeat.')
          clearInterval(typingHeartbeat)
          typingHeartbeat = null
        }

        return
      }

      if (!ttsText) {
        debug('[DiscordStore] onChatTurnComplete: ttsText is empty/falsy, skipping.')
        return
      }

      // Log the intent to send
      const logEntry: DiscordEventLogEntry = {
        timestamp: Date.now(),
        type: 'MESSAGE_SEND',
        summary: `Sending reply to ${source.username} in channel ${source.channelId.slice(-4)}`,
      }
      eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), logEntry]

      // NOTICE: Strip orchestration tokens (<|ACTOR:|>, <|ACT:|>, etc.) before sending
      // to Discord. The raw tokens are preserved in the DB for LLM context, but external
      // consumers should never see them.
      let rawText = typeof ttsText === 'string' ? ttsText : String(ttsText)
      debug('[DiscordStore] text before ACTOR replacement:', JSON.stringify(rawText))

      // Convert ACTOR tokens to bold bracketed format (e.g. <|ACTOR:actor_oshino_shinobu|> -> **[oshino_shinobu]**:)
      rawText = rawText.replace(/<\|ACTOR:([^|>]+)(?:\|>|>)/gi, (_, captured) => {
        let cleanName = captured.trim()
        if (cleanName.toLowerCase().startsWith('actor_')) {
          cleanName = cleanName.substring(6)
        }
        else if (cleanName.toLowerCase().startsWith('actress_')) {
          cleanName = cleanName.substring(8)
        }
        return `**[${cleanName}]**: `
      })
      debug('[DiscordStore] text after ACTOR replacement:', JSON.stringify(rawText))

      let cleanedText = stripMarkers(rawText)
      debug('[DiscordStore] text after stripMarkers:', JSON.stringify(cleanedText))

      const currentToolSlices = chat.output?.slices?.filter((s: any) => s.type === 'tool-call') || []
      if (currentToolSlices.length > 0) {
        const formattedCalls = currentToolSlices.map((slice: any) => {
          const name = slice.toolCall?.toolName || slice.toolCall?.function?.name || 'unknown'
          const rawArgs = slice.toolCall?.args || slice.toolCall?.function?.arguments

          let parsedArgs: any = null
          if (rawArgs) {
            try {
              parsedArgs = JSON.parse(rawArgs)
            }
            catch {}
          }

          if (name === 'text_journal') {
            const action = parsedArgs?.action
            if (action === 'create') {
              const title = parsedArgs?.title || 'Untitled Entry'
              const content = parsedArgs?.content || ''
              return `\n\n### New Journal Entry: ${title}\n> ${content}`
            }
            if (action === 'search') {
              const query = parsedArgs?.query || ''
              const limit = parsedArgs?.limit || 3
              return `\n\n🔍 Searching Journal: "${query}" (limit: ${limit})`
            }
          }
          else if (name === 'image_journal') {
            const action = parsedArgs?.action
            if (action === 'create') {
              const prompt = parsedArgs?.prompt || ''
              const titleStr = parsedArgs?.title ? ` (title: "${parsedArgs.title}")` : ''
              const modeStr = parsedArgs?.mode ? ` (mode: "${parsedArgs.mode}")` : ''
              return `\n\n🎨 Generating Image: "${prompt}"${titleStr}${modeStr}`
            }
            if (action === 'apply' || action === 'set_as_background') {
              const query = parsedArgs?.query || ''
              return `\n\n🖼️ Applying Background: "${query}"`
            }
          }

          // Fallback to raw JSON style
          let argsStr = ''
          if (rawArgs) {
            try {
              argsStr = JSON.stringify(parsedArgs || JSON.parse(rawArgs))
            }
            catch {
              argsStr = rawArgs
            }
          }
          return `\n🔧 \`${name}\` | \`${argsStr}\``
        }).join('')
        cleanedText += formattedCalls
      }

      debug('[DiscordStore] calling sendMessageToDiscord with content:', JSON.stringify(cleanedText))
      await sendMessageToDiscord(source.channelId, cleanedText)
    }

    const onStreamEnd = async () => {
      const hash = window.location.hash || '#/'
      const isStage = hash === '#/' || hash.startsWith('#/stage')

      if (!isStage)
        return

      if (typingHeartbeat) {
        debug('[DiscordStore] Stream ended, clearing typing heartbeat.')
        clearInterval(typingHeartbeat)
        typingHeartbeat = null
      }
    }

    const onInteraction = async (_event: any, payload: DiscordInteractionPayload) => {
      // Leadership Election: Only the 'Stage' window should handle interactions
      // to prevent duplicate responses when multiple windows (like Settings) are open.
      const hash = window.location.hash || '#/'
      const isStage = hash === '#/' || hash.startsWith('#/stage')
      if (!isStage) {
        debug(`[DiscordStore] Ignoring interaction ${payload.interactionId}: Not the leader window.`)
        return
      }

      if (!dmsEnabled.value && !payload.guildId) {
        debug(`[DiscordStore] Rejecting interaction ${payload.interactionId}: private DMs are disabled.`)
        await invokeReplyInteraction?.({
          interactionId: payload.interactionId,
          content: '❌ Private DMs are disabled by the owner.',
          ephemeral: true,
        })
        return
      }

      debug(`[DiscordStore] Handling interaction: /${payload.commandName} (${payload.interactionId})`)

      // Keep channel context updated for things like image routing (e.g. /imagine)
      if (payload.channelId) {
        lastChannelId.value = payload.channelId
      }

      if (payload.commandName === 'summon') {
        try {
          const res = await invokeSummon?.({ userId: payload.userId })
          if (res?.success) {
            const modeLabel = voiceCall.value === 'off'
              ? 'off'
              : voiceCall.value === 'gemini'
                ? '🤖 Gemini Live'
                : '🎙️ Classic TTS'
            const warning = voiceCall.value === 'off'
              ? '\n\n⚠️ *Voice call mode is currently **off**. Run `/voicecall mode: gemini` or `/voicecall mode: classic` to enable it!*'
              : ''
            await invokeReplyInteraction?.({
              interactionId: payload.interactionId,
              content: `🟢 Joined voice channel **${res.channelName}** in **${modeLabel}** mode!${warning}`,
            })
          }
          else {
            await invokeReplyInteraction?.({
              interactionId: payload.interactionId,
              content: `❌ Failed to join voice channel: ${res?.error || 'Unknown error'}`,
            })
          }
        }
        catch (err: any) {
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: `❌ Failed to join voice channel: ${err.message || err}`,
          })
        }
        return
      }

      if (payload.commandName === 'leave') {
        try {
          const res = await invokeLeave?.()
          if (res?.success) {
            await invokeReplyInteraction?.({
              interactionId: payload.interactionId,
              content: '🛑 Disconnected from the voice channel.',
            })
          }
          else {
            await invokeReplyInteraction?.({
              interactionId: payload.interactionId,
              content: `❌ Failed to disconnect: ${res?.error || 'Unknown error'}`,
            })
          }
        }
        catch (err: any) {
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: `❌ Failed to disconnect: ${err.message || err}`,
          })
        }
        return
      }

      if (payload.commandName === 'history') {
        const turns = payload.options.turns || 5
        const history = chatSession.messages.slice(-turns * 2) // * 2 because history includes user and assistant

        if (history.length === 0) {
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: 'There is no conversation history to display.',
          })
          return
        }

        const lines: string[] = []
        for (const msg of history) {
          const role = msg.role === 'user' ? 'User' : (airiCard.activeCard?.name || 'Assistant')
          const content = stripMarkers(String(msg.content || '')).trim()
          if (content) {
            lines.push(`**${role}**: ${content}`)
          }
        }

        // Chunking per turn logic
        let currentMessage = ''
        const messagesToSend: string[] = []

        for (const line of lines) {
          // Check if adding this line would exceed Discord's 2000 limit
          if (currentMessage.length + line.length + 2 > 2000) {
            messagesToSend.push(currentMessage.trim())
            currentMessage = `${line}\n\n`
          }
          else {
            currentMessage += `${line}\n\n`
          }
        }
        if (currentMessage) {
          messagesToSend.push(currentMessage.trim())
        }

        // Send the first chunk as the initial reply
        try {
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: messagesToSend[0],
          })

          // Send subsequent chunks as follow-ups
          for (let i = 1; i < messagesToSend.length; i++) {
            await invokeReplyInteraction?.({
              interactionId: payload.interactionId,
              content: messagesToSend[i],
              followUp: true,
            })
          }
        }
        catch (err) {
          console.error('[DiscordStore] Failed to send history chunks:', err)
        }
      }
      else if (payload.commandName === 'character') {
        const renderCharactersWidget = async (interactionId: string, page: number) => {
          const allCards = Array.from(airiCard.cards.entries())
          const activeCardId = airiCard.activeCardId
          const activeCard = airiCard.activeCard

          const totalCards = allCards.length
          const pageSize = 12
          const totalPages = Math.ceil(totalCards / pageSize) || 1
          const currentPage = Math.min(Math.max(page, 0), totalPages - 1)

          const startIdx = currentPage * pageSize
          const pageCards = allCards.slice(startIdx, startIdx + pageSize)

          let replyContent = `**🎭 Character Selector (Page ${currentPage + 1}/${totalPages})**\n`
          replyContent += `--------------------------------------------------\n`
          replyContent += `🟢 **Active:** **${activeCard?.name || 'None'}**\n`
          replyContent += `--------------------------------------------------\n`

          const components: any[] = []
          const buttonsPerRow = 3

          for (let i = 0; i < pageCards.length; i += buttonsPerRow) {
            const rowCards = pageCards.slice(i, i + buttonsPerRow)
            const rowComponents = rowCards.map(([id, card]) => {
              const isActive = id === activeCardId
              return {
                type: 2, // Button
                style: isActive ? 2 : 1, // Grey if active, Blurple if not
                label: isActive ? `🟢 ${card.name}` : card.name,
                customId: `characters:switch:${id}`,
                disabled: isActive,
              }
            })

            components.push({
              type: 1, // ActionRow
              components: rowComponents,
            })
          }

          if (totalCards === 0) {
            replyContent += `*No character cards found.*\n`
          }

          components.push({
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 2, // Secondary (Grey)
                label: '◀️ Previous',
                customId: `characters:page:${currentPage - 1}`,
                disabled: currentPage === 0,
              },
              {
                type: 2, // Button
                style: 2, // Secondary (Grey)
                label: '▶️ Next',
                customId: `characters:page:${currentPage + 1}`,
                disabled: currentPage >= totalPages - 1,
              },
            ],
          })

          await invokeReplyInteraction?.({
            interactionId,
            content: replyContent.trim(),
            components,
          })
        }

        const query = (payload.options.id || payload.options.name || '').toString().trim()

        if (!query) {
          await renderCharactersWidget(payload.interactionId, 0)
          return
        }

        // Fuzzy match: Try exact ID, then exact name, then partial name
        const allCards = Array.from(airiCard.cards.entries())
        const target = allCards.find(([id]) => id === query)
          || allCards.find(([, card]) => card.name.toLowerCase() === query.toLowerCase())
          || allCards.find(([, card]) => card.name.toLowerCase().includes(query.toLowerCase()))

        if (target) {
          const [id, card] = target
          await airiCard.activateCard(id)
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: `Successfully switched active character to **${card.name}**!`,
          })
        }
        else {
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: `Could not find a character matching "**${query}**".`,
          })
        }
      }
      else if (payload.commandName === 'button:characters') {
        const action = payload.options.action
        const targetId = payload.options.id

        const allCards = Array.from(airiCard.cards.entries())

        const renderCharactersWidget = async (interactionId: string, page: number) => {
          const activeCardId = airiCard.activeCardId
          const activeCard = airiCard.activeCard

          const totalCards = allCards.length
          const pageSize = 12
          const totalPages = Math.ceil(totalCards / pageSize) || 1
          const currentPage = Math.min(Math.max(page, 0), totalPages - 1)

          const startIdx = currentPage * pageSize
          const pageCards = allCards.slice(startIdx, startIdx + pageSize)

          let replyContent = `**🎭 Character Selector (Page ${currentPage + 1}/${totalPages})**\n`
          replyContent += `--------------------------------------------------\n`
          replyContent += `🟢 **Active:** **${activeCard?.name || 'None'}**\n`
          replyContent += `--------------------------------------------------\n`

          const components: any[] = []
          const buttonsPerRow = 3

          for (let i = 0; i < pageCards.length; i += buttonsPerRow) {
            const rowCards = pageCards.slice(i, i + buttonsPerRow)
            const rowComponents = rowCards.map(([id, card]) => {
              const isActive = id === activeCardId
              return {
                type: 2,
                style: isActive ? 2 : 1,
                label: isActive ? `🟢 ${card.name}` : card.name,
                customId: `characters:switch:${id}`,
                disabled: isActive,
              }
            })

            components.push({
              type: 1,
              components: rowComponents,
            })
          }

          if (totalCards === 0) {
            replyContent += `*No character cards found.*\n`
          }

          components.push({
            type: 1,
            components: [
              {
                type: 2,
                style: 2,
                label: '◀️ Previous',
                customId: `characters:page:${currentPage - 1}`,
                disabled: currentPage === 0,
              },
              {
                type: 2,
                style: 2,
                label: '▶️ Next',
                customId: `characters:page:${currentPage + 1}`,
                disabled: currentPage >= totalPages - 1,
              },
            ],
          })

          await invokeReplyInteraction?.({
            interactionId,
            content: replyContent.trim(),
            components,
          })
        }

        if (action === 'switch' && targetId) {
          await airiCard.activateCard(targetId)

          // Re-render widget on page containing the newly active card
          const idx = allCards.findIndex(([id]) => id === targetId)
          const page = idx >= 0 ? Math.floor(idx / 12) : 0
          await renderCharactersWidget(payload.interactionId, page)
        }
        else if (action === 'page' && targetId) {
          const page = Number.parseInt(targetId) || 0
          await renderCharactersWidget(payload.interactionId, page)
        }
      }
      else if (payload.commandName === 'new') {
        const initialMessage = payload.options.message?.toString()

        // Reset the session for the current character
        // In AIRI, we can just trigger a new session creation
        await chatSession.createSession(airiCard.activeCardId!)

        if (initialMessage) {
          // If they provided a message, send it immediately
          await chatOrchestrator.ingest(initialMessage, {
            metadata: { _discordSource: payload },
          })
        }

        await invokeReplyInteraction?.({
          interactionId: payload.interactionId,
          content: initialMessage
            ? `Started a new session with your message!`
            : `Chat session has been reset. Fresh start!`,
        })
      }
      else if (payload.commandName === 'timelines') {
        const renderTimelinesWidget = async (interactionId: string, page: number) => {
          const characterId = airiCard.activeCardId || 'default'
          const characterName = airiCard.activeCard?.name || 'Active Character'
          const characterIndex = chatSession.index?.characters?.[characterId]
          const sessions = characterIndex?.sessions || {}
          const activeId = chatSession.activeSessionId

          const sessionList = Object.values(sessions)
            .sort((a, b) => b.updatedAt - a.updatedAt)

          const totalSessions = sessionList.length
          const pageSize = 4
          const totalPages = Math.ceil(totalSessions / pageSize) || 1
          const currentPage = Math.min(Math.max(page, 0), totalPages - 1)

          const startIdx = currentPage * pageSize
          const pageSessions = sessionList.slice(startIdx, startIdx + pageSize)

          const activeMeta = sessions[activeId]
          const activeTitle = activeMeta?.title || 'Untitled Session'

          let replyContent = `**⏳ Chat Timelines for ${characterName} (Page ${currentPage + 1}/${totalPages})**\n`
          replyContent += `--------------------------------------------------\n`
          replyContent += `🟢 **Active:** **${activeTitle}** (id: \`${activeId}\`)\n`
          replyContent += `--------------------------------------------------\n`

          const components: any[] = []

          pageSessions.forEach((s, idx) => {
            const num = startIdx + idx + 1
            const title = s.title || 'Untitled Session'
            const count = s.messageCount || 0
            const activeIndicator = s.sessionId === activeId ? '🟢 ' : ''
            replyContent += `${num}. ${activeIndicator}**${title}** (id: \`${s.sessionId}\`, ${count} messages)\n`

            components.push({
              type: 1, // ActionRow
              components: [
                {
                  type: 2, // Button
                  style: s.sessionId === activeId ? 2 : 3, // Grey if active, Success/Green if not
                  label: s.sessionId === activeId ? `Active #${num}` : `Select #${num}`,
                  customId: `timelines:select:${s.sessionId}`,
                  disabled: s.sessionId === activeId,
                },
                {
                  type: 2, // Button
                  style: 1, // Primary (Blurple)
                  label: `Fork #${num}`,
                  customId: `timelines:fork:${s.sessionId}`,
                },
              ],
            })
          })

          if (pageSessions.length === 0) {
            replyContent += `*No timelines found.*\n`
          }

          components.push({
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 2, // Secondary (Grey)
                label: '◀️ Previous',
                customId: `timelines:page:${currentPage - 1}`,
                disabled: currentPage === 0,
              },
              {
                type: 2, // Button
                style: 2, // Secondary (Grey)
                label: '▶️ Next',
                customId: `timelines:page:${currentPage + 1}`,
                disabled: currentPage >= totalPages - 1,
              },
              {
                type: 2, // Button
                style: 1, // Primary (Blurple)
                label: '➕ New Timeline',
                customId: 'timelines:new',
              },
            ],
          })

          await invokeReplyInteraction?.({
            interactionId,
            content: replyContent.trim(),
            components,
          })
        }

        const characterId = airiCard.activeCardId || 'default'
        const characterName = airiCard.activeCard?.name || 'Active Character'
        const targetId = payload.options.id?.toString().trim()

        const characterIndex = chatSession.index?.characters?.[characterId]
        const sessions = characterIndex?.sessions || {}
        const activeId = chatSession.activeSessionId

        if (targetId) {
          if (sessions[targetId] || targetId === activeId) {
            chatSession.setActiveSession(targetId)
            const sessionMeta = sessions[targetId]
            const title = sessionMeta?.title || 'Untitled Session'
            await invokeReplyInteraction?.({
              interactionId: payload.interactionId,
              content: `Successfully switched active chat timeline to **${title}**! (id: \`${targetId}\`)`,
            })
          }
          else {
            await invokeReplyInteraction?.({
              interactionId: payload.interactionId,
              content: `Could not find a timeline matching ID \`${targetId}\` for **${characterName}**.`,
            })
          }
        }
        else {
          await renderTimelinesWidget(payload.interactionId, 0)
        }
      }
      else if (payload.commandName === 'button:timelines') {
        const action = payload.options.action
        const targetId = payload.options.id
        const characterId = airiCard.activeCardId || 'default'

        const characterIndex = chatSession.index?.characters?.[characterId]
        const sessions = characterIndex?.sessions || {}
        const sessionList = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt)

        // Helper function declared inline to match /timelines scope
        const renderTimelinesWidget = async (interactionId: string, page: number) => {
          const characterName = airiCard.activeCard?.name || 'Active Character'
          const activeId = chatSession.activeSessionId

          const totalSessions = sessionList.length
          const pageSize = 4
          const totalPages = Math.ceil(totalSessions / pageSize) || 1
          const currentPage = Math.min(Math.max(page, 0), totalPages - 1)

          const startIdx = currentPage * pageSize
          const pageSessions = sessionList.slice(startIdx, startIdx + pageSize)

          const activeMeta = sessions[activeId]
          const activeTitle = activeMeta?.title || 'Untitled Session'

          let replyContent = `**⏳ Chat Timelines for ${characterName} (Page ${currentPage + 1}/${totalPages})**\n`
          replyContent += `--------------------------------------------------\n`
          replyContent += `🟢 **Active:** **${activeTitle}** (id: \`${activeId}\`)\n`
          replyContent += `--------------------------------------------------\n`

          const components: any[] = []

          pageSessions.forEach((s, idx) => {
            const num = startIdx + idx + 1
            const title = s.title || 'Untitled Session'
            const count = s.messageCount || 0
            const activeIndicator = s.sessionId === activeId ? '🟢 ' : ''
            replyContent += `${num}. ${activeIndicator}**${title}** (id: \`${s.sessionId}\`, ${count} messages)\n`

            components.push({
              type: 1,
              components: [
                {
                  type: 2,
                  style: s.sessionId === activeId ? 2 : 3,
                  label: s.sessionId === activeId ? `Active #${num}` : `Select #${num}`,
                  customId: `timelines:select:${s.sessionId}`,
                  disabled: s.sessionId === activeId,
                },
                {
                  type: 2,
                  style: 1,
                  label: `Fork #${num}`,
                  customId: `timelines:fork:${s.sessionId}`,
                },
              ],
            })
          })

          if (pageSessions.length === 0) {
            replyContent += `*No timelines found.*\n`
          }

          components.push({
            type: 1,
            components: [
              {
                type: 2,
                style: 2,
                label: '◀️ Previous',
                customId: `timelines:page:${currentPage - 1}`,
                disabled: currentPage === 0,
              },
              {
                type: 2,
                style: 2,
                label: '▶️ Next',
                customId: `timelines:page:${currentPage + 1}`,
                disabled: currentPage >= totalPages - 1,
              },
              {
                type: 2,
                style: 1,
                label: '➕ New Timeline',
                customId: 'timelines:new',
              },
            ],
          })

          await invokeReplyInteraction?.({
            interactionId,
            content: replyContent.trim(),
            components,
          })
        }

        if (action === 'select' && targetId) {
          if (sessions[targetId]) {
            chatSession.setActiveSession(targetId)
            const idx = sessionList.findIndex(s => s.sessionId === targetId)
            const page = idx >= 0 ? Math.floor(idx / 4) : 0
            await renderTimelinesWidget(payload.interactionId, page)
          }
        }
        else if (action === 'fork' && targetId) {
          const forkSessionId = await chatSession.forkSession({ fromSessionId: targetId })
          if (forkSessionId) {
            chatSession.setActiveSession(forkSessionId)
            const characterIndexUpdated = chatSession.index?.characters?.[characterId]
            const sessionsUpdated = characterIndexUpdated?.sessions || {}
            const activeMeta = sessionsUpdated[forkSessionId]
            if (activeMeta) {
              activeMeta.title = `Fork of ${sessions[targetId]?.title || 'Untitled'}`
            }
            await renderTimelinesWidget(payload.interactionId, 0)
          }
        }
        else if (action === 'new') {
          await chatSession.createSession(characterId)
          await renderTimelinesWidget(payload.interactionId, 0)
        }
        else if (action === 'page' && targetId) {
          const page = Number.parseInt(targetId) || 0
          await renderTimelinesWidget(payload.interactionId, page)
        }
      }
      else if (payload.commandName === 'status') {
        const buildStatusContent = () => {
          const activeCardName = airiCard.activeCard?.name || 'None'
          const turns = chatSession.messages.length

          const llmProvider = consciousnessStore.activeProvider || 'Unknown'
          const llmModel = consciousnessStore.activeModel || 'Unknown'

          const ttsProvider = speechStore.activeSpeechProvider || 'Unknown'
          const ttsVoice = speechStore.activeSpeechVoiceId || 'Unknown'

          const artistryExt = airiCard.activeCard?.extensions?.airi?.artistry
          const artProvider = artistryExt?.provider || artistryStore.activeProvider || 'Unknown'
          const artModelId = artistryExt?.model || 'Unknown'
          let artModelName = artModelId

          if (artProvider === 'comfyui') {
            const wf = artistryStore.comfyuiSavedWorkflows?.find((w: any) => w.id === artModelId)
            if (wf)
              artModelName = wf.name
          }

          const sessionId = chatSession.activeSessionId
          const sessionMeta = chatSession.getSessionMeta(sessionId)
          const timelineName = sessionMeta?.title || 'Default Timeline'
          const universeId = sessionMeta?.universeId || 'global'

          const vlmProvider = visionStore.activeProvider || 'None'
          const vlmModel = visionStore.activeModel || 'None'

          const visionEnabled = visionStore.isWitnessEnabled
          const directorEnabled = artistryExt?.autonomousEnabled || false
          const liveActive = liveSessionStore.isActive

          return `**AIRI System Status**
-------------------------
**Active Character:** ${activeCardName}
**Conversation:** ${turns} turns (Timeline: "${timelineName}" | Universe: "${universeId}")
**Chat Mode:** ${chatMode.value === 'followup' ? 'Follow-up' : chatMode.value.charAt(0).toUpperCase() + chatMode.value.slice(1)}
**Discord Voice Mode:** ${voiceMode.value}
**Discord Voice Call:** ${voiceCall.value}

**🧠 Brains (LLM):** ${llmProvider} / ${llmModel}
**👁️ Vision (VLM):** ${vlmProvider} / ${vlmModel}
**🗣️ Voice (TTS):** ${ttsProvider} / ${ttsVoice}
**🎨 Artistry:** ${artProvider} / ${artProvider === 'comfyui' ? 'Workflow' : 'Model'}: \`${artModelName}\`

**Active Modules:**
- [${visionEnabled ? 'ON' : 'OFF'}] 👁️ **Vision:** Witness Mode ${visionEnabled ? 'active' : 'disabled'}
- [${directorEnabled ? 'ON' : 'OFF'}] 🎬 **Director:** Autonomous Artistry ${directorEnabled ? 'active' : 'disabled'}
- [${liveActive ? 'ON' : 'OFF'}] 🧠 **Live API:** ${liveActive ? 'Active' : 'Offline'}`
        }

        await invokeReplyInteraction?.({
          interactionId: payload.interactionId,
          content: buildStatusContent(),
        })
      }
      else if (payload.commandName === 'voicemode') {
        const mode = payload.options.mode?.toString() as 'puppet' | 'voicenote' | 'none'
        if (mode && ['puppet', 'voicenote', 'none'].includes(mode)) {
          voiceMode.value = mode
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: `🔊 Discord voice output mode set to **${mode.toUpperCase()}**.`,
          })
        }
      }
      else if (payload.commandName === 'vision') {
        const mode = payload.options.mode?.toString()
        const enabled = mode === 'on'
        visionEnabled.value = enabled
        await invokeReplyInteraction?.({
          interactionId: payload.interactionId,
          content: `👁️ Discord image VLM processing has been set to **${mode?.toUpperCase()}**.`,
        })
      }
      else if (payload.commandName === 'voicecall') {
        const mode = payload.options.mode?.toString() as 'gemini' | 'classic' | 'off'
        if (mode && ['gemini', 'classic', 'off'].includes(mode)) {
          voiceCall.value = mode
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: `📞 Discord voice call mode set to **${mode.toUpperCase()}**.`,
          })
        }
      }
      else if (payload.commandName === 'selfie') {
        const emotion = payload.options.emotion?.toString()
        if (emotion) {
          if (settingsStore.stageModelRenderer === 'live2d') {
            const live2dStore = useLive2d()
            live2dStore.triggerEmotion(emotion)
          }
          else if (settingsStore.stageModelRenderer === 'vrm') {
            const vrmStore = useModelStore()
            vrmStore.triggerEmotion(emotion, 1)
          }
          await new Promise(resolve => setTimeout(resolve, 500))
        }

        await invokeReplyInteraction?.({
          interactionId: payload.interactionId,
          content: '📸 Capturing stage selfie...',
        })
        if (airiCard.activeCardId) {
          postCapture({ characterId: airiCard.activeCardId, includeBg: true, channelId: payload.channelId })
        }
      }
      else if (payload.commandName === 'manage') {
        const buildStatusContent = () => {
          const activeCardName = airiCard.activeCard?.name || 'None'
          const turns = chatSession.messages.length

          const llmProvider = consciousnessStore.activeProvider || 'Unknown'
          const llmModel = consciousnessStore.activeModel || 'Unknown'

          const ttsProvider = speechStore.activeSpeechProvider || 'Unknown'
          const ttsVoice = speechStore.activeSpeechVoiceId || 'Unknown'

          const artistryExt = airiCard.activeCard?.extensions?.airi?.artistry
          const artProvider = artistryExt?.provider || artistryStore.activeProvider || 'Unknown'
          const artModelId = artistryExt?.model || 'Unknown'
          let artModelName = artModelId

          if (artProvider === 'comfyui') {
            const wf = artistryStore.comfyuiSavedWorkflows?.find((w: any) => w.id === artModelId)
            if (wf)
              artModelName = wf.name
          }

          const sessionId = chatSession.activeSessionId
          const sessionMeta = chatSession.getSessionMeta(sessionId)
          const timelineName = sessionMeta?.title || 'Default Timeline'
          const universeId = sessionMeta?.universeId || 'global'

          const vlmProvider = visionStore.activeProvider || 'None'
          const vlmModel = visionStore.activeModel || 'None'

          const visionEnabledDiscord = visionEnabled.value
          const visionEnabledWitness = visionStore.isWitnessEnabled
          const directorEnabled = artistryExt?.autonomousEnabled || false
          const liveActive = liveSessionStore.isActive

          return `**AIRI System Status**
-------------------------
**Active Character:** ${activeCardName}
**Conversation:** ${turns} turns (Timeline: "${timelineName}" | Universe: "${universeId}")
**Chat Mode:** ${chatMode.value === 'followup' ? 'Follow-up' : chatMode.value.charAt(0).toUpperCase() + chatMode.value.slice(1)}
**Discord Voice Mode:** ${voiceMode.value}
**Discord Voice Call:** ${voiceCall.value}

**🧠 Brains (LLM):** ${llmProvider} / ${llmModel}
**👁️ Vision (VLM):** ${vlmProvider} / ${vlmModel} (Discord intake: ${visionEnabledDiscord ? 'ON' : 'OFF'})
**🗣️ Voice (TTS):** ${ttsProvider} / ${ttsVoice}
**🎨 Artistry:** ${artProvider} / ${artProvider === 'comfyui' ? 'Workflow' : 'Model'}: \`${artModelName}\`

**Active Modules:**
- [${visionEnabledDiscord ? 'ON' : 'OFF'}] 👁️ **Vision Intake:** Discord VLM processing
- [${visionEnabledWitness ? 'ON' : 'OFF'}] 📸 **Witness Mode:** Desktop Witness active
- [${directorEnabled ? 'ON' : 'OFF'}] 🎬 **Director:** Autonomous Artistry ${directorEnabled ? 'active' : 'disabled'}
- [${liveActive ? 'ON' : 'OFF'}] 🧠 **Live API:** ${liveActive ? 'Active' : 'Offline'}`
        }

        const renderManageWidget = async (interactionId: string) => {
          const content = buildStatusContent()
          const artistryExt = airiCard.activeCard?.extensions?.airi?.artistry

          const components = [
            // Row 1: Voice Mode
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: voiceMode.value === 'puppet' ? 3 : 2,
                  label: '🔊 Puppet',
                  customId: 'manage:voicemode:puppet',
                },
                {
                  type: 2,
                  style: voiceMode.value === 'voicenote' ? 3 : 2,
                  label: '📝 Voice Note',
                  customId: 'manage:voicemode:voicenote',
                },
                {
                  type: 2,
                  style: voiceMode.value === 'none' ? 4 : 2,
                  label: '🔇 Mute',
                  customId: 'manage:voicemode:none',
                },
              ],
            },
            // Row 2: Voice Call
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: voiceCall.value === 'gemini' ? 1 : 2,
                  label: '📞 Gemini Live',
                  customId: 'manage:voicecall:gemini',
                },
                {
                  type: 2,
                  style: voiceCall.value === 'classic' ? 1 : 2,
                  label: '⚙️ Classic TTS',
                  customId: 'manage:voicecall:classic',
                },
                {
                  type: 2,
                  style: voiceCall.value === 'off' ? 4 : 2,
                  label: '🛑 Call Off',
                  customId: 'manage:voicecall:off',
                },
              ],
            },
            // Row 3: Chat Mode
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: chatMode.value === 'followup' ? 3 : 2,
                  label: '📥 Follow-up',
                  customId: 'manage:chatmode:followup',
                },
                {
                  type: 2,
                  style: chatMode.value === 'steer' ? 3 : 2,
                  label: '🎯 Steer',
                  customId: 'manage:chatmode:steer',
                },
                {
                  type: 2,
                  style: chatMode.value === 'collect' ? 3 : 2,
                  label: '🔋 Collect',
                  customId: 'manage:chatmode:collect',
                },
              ],
            },
            // Row 4: Module Toggles
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: (artistryExt?.autonomousEnabled || false) ? 3 : 2,
                  label: '🎬 Director',
                  customId: 'manage:module:director',
                },
                {
                  type: 2,
                  style: visionEnabled.value ? 3 : 2,
                  label: '👁️ Vision',
                  customId: 'manage:module:vision',
                },
              ],
            },
            // Row 5: Utilities & Sync
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 1,
                  label: '📸 Selfie',
                  customId: 'manage:util:selfie',
                },
                {
                  type: 2,
                  style: 1,
                  label: '✍️ Journal Moment',
                  customId: 'manage:util:journalmoment',
                },
                {
                  type: 2,
                  style: 2,
                  label: '🔄 Refresh Status',
                  customId: 'manage:util:refresh',
                },
              ],
            },
          ]

          await invokeReplyInteraction?.({
            interactionId,
            content,
            components,
          })
        }

        await renderManageWidget(payload.interactionId)
      }
      else if (payload.commandName === 'button:manage') {
        const action = payload.options.action
        const targetId = payload.options.id

        const buildStatusContent = () => {
          const activeCardName = airiCard.activeCard?.name || 'None'
          const turns = chatSession.messages.length

          const llmProvider = consciousnessStore.activeProvider || 'Unknown'
          const llmModel = consciousnessStore.activeModel || 'Unknown'

          const ttsProvider = speechStore.activeSpeechProvider || 'Unknown'
          const ttsVoice = speechStore.activeSpeechVoiceId || 'Unknown'

          const artistryExt = airiCard.activeCard?.extensions?.airi?.artistry
          const artProvider = artistryExt?.provider || artistryStore.activeProvider || 'Unknown'
          const artModelId = artistryExt?.model || 'Unknown'
          let artModelName = artModelId

          if (artProvider === 'comfyui') {
            const wf = artistryStore.comfyuiSavedWorkflows?.find((w: any) => w.id === artModelId)
            if (wf)
              artModelName = wf.name
          }

          const sessionId = chatSession.activeSessionId
          const sessionMeta = chatSession.getSessionMeta(sessionId)
          const timelineName = sessionMeta?.title || 'Default Timeline'
          const universeId = sessionMeta?.universeId || 'global'

          const vlmProvider = visionStore.activeProvider || 'None'
          const vlmModel = visionStore.activeModel || 'None'

          const visionEnabledDiscord = visionEnabled.value
          const visionEnabledWitness = visionStore.isWitnessEnabled
          const directorEnabled = artistryExt?.autonomousEnabled || false
          const liveActive = liveSessionStore.isActive

          return `**AIRI System Status**
-------------------------
**Active Character:** ${activeCardName}
**Conversation:** ${turns} turns (Timeline: "${timelineName}" | Universe: "${universeId}")
**Chat Mode:** ${chatMode.value === 'followup' ? 'Follow-up' : chatMode.value.charAt(0).toUpperCase() + chatMode.value.slice(1)}
**Discord Voice Mode:** ${voiceMode.value}
**Discord Voice Call:** ${voiceCall.value}

**🧠 Brains (LLM):** ${llmProvider} / ${llmModel}
**👁️ Vision (VLM):** ${vlmProvider} / ${vlmModel} (Discord intake: ${visionEnabledDiscord ? 'ON' : 'OFF'})
**🗣️ Voice (TTS):** ${ttsProvider} / ${ttsVoice}
**🎨 Artistry:** ${artProvider} / ${artProvider === 'comfyui' ? 'Workflow' : 'Model'}: \`${artModelName}\`

**Active Modules:**
- [${visionEnabledDiscord ? 'ON' : 'OFF'}] 👁️ **Vision Intake:** Discord VLM processing
- [${visionEnabledWitness ? 'ON' : 'OFF'}] 📸 **Witness Mode:** Desktop Witness active
- [${directorEnabled ? 'ON' : 'OFF'}] 🎬 **Director:** Autonomous Artistry ${directorEnabled ? 'active' : 'disabled'}
- [${liveActive ? 'ON' : 'OFF'}] 🧠 **Live API:** ${liveActive ? 'Active' : 'Offline'}`
        }

        const renderManageWidget = async (interactionId: string) => {
          const content = buildStatusContent()
          const artistryExt = airiCard.activeCard?.extensions?.airi?.artistry

          const components = [
            // Row 1: Voice Mode
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: voiceMode.value === 'puppet' ? 3 : 2,
                  label: '🔊 Puppet',
                  customId: 'manage:voicemode:puppet',
                },
                {
                  type: 2,
                  style: voiceMode.value === 'voicenote' ? 3 : 2,
                  label: '📝 Voice Note',
                  customId: 'manage:voicemode:voicenote',
                },
                {
                  type: 2,
                  style: voiceMode.value === 'none' ? 4 : 2,
                  label: '🔇 Mute',
                  customId: 'manage:voicemode:none',
                },
              ],
            },
            // Row 2: Voice Call
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: voiceCall.value === 'gemini' ? 1 : 2,
                  label: '📞 Gemini Live',
                  customId: 'manage:voicecall:gemini',
                },
                {
                  type: 2,
                  style: voiceCall.value === 'classic' ? 1 : 2,
                  label: '⚙️ Classic TTS',
                  customId: 'manage:voicecall:classic',
                },
                {
                  type: 2,
                  style: voiceCall.value === 'off' ? 4 : 2,
                  label: '🛑 Call Off',
                  customId: 'manage:voicecall:off',
                },
              ],
            },
            // Row 3: Chat Mode
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: chatMode.value === 'followup' ? 3 : 2,
                  label: '📥 Follow-up',
                  customId: 'manage:chatmode:followup',
                },
                {
                  type: 2,
                  style: chatMode.value === 'steer' ? 3 : 2,
                  label: '🎯 Steer',
                  customId: 'manage:chatmode:steer',
                },
                {
                  type: 2,
                  style: chatMode.value === 'collect' ? 3 : 2,
                  label: '🔋 Collect',
                  customId: 'manage:chatmode:collect',
                },
              ],
            },
            // Row 4: Module Toggles
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: (artistryExt?.autonomousEnabled || false) ? 3 : 2,
                  label: '🎬 Director',
                  customId: 'manage:module:director',
                },
                {
                  type: 2,
                  style: visionEnabled.value ? 3 : 2,
                  label: '👁️ Vision',
                  customId: 'manage:module:vision',
                },
              ],
            },
            // Row 5: Utilities & Sync
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 1,
                  label: '📸 Selfie',
                  customId: 'manage:util:selfie',
                },
                {
                  type: 2,
                  style: 1,
                  label: '✍️ Journal Moment',
                  customId: 'manage:util:journalmoment',
                },
                {
                  type: 2,
                  style: 2,
                  label: '🔄 Refresh Status',
                  customId: 'manage:util:refresh',
                },
              ],
            },
          ]

          await invokeReplyInteraction?.({
            interactionId,
            content,
            components,
          })
        }

        if (action === 'voicemode' && targetId) {
          if (['puppet', 'voicenote', 'none'].includes(targetId)) {
            voiceMode.value = targetId as any
          }
        }
        else if (action === 'voicecall' && targetId) {
          if (['gemini', 'classic', 'off'].includes(targetId)) {
            voiceCall.value = targetId as any
          }
        }
        else if (action === 'chatmode' && targetId) {
          if (['followup', 'steer', 'collect'].includes(targetId)) {
            chatMode.value = targetId as any
          }
        }
        else if (action === 'module' && targetId) {
          if (targetId === 'director' && airiCard.activeCardId) {
            const current = airiCard.activeCard?.extensions?.airi?.artistry?.autonomousEnabled || false
            airiCard.setAutonomousArtistry(airiCard.activeCardId, !current)
          }
          else if (targetId === 'vision') {
            visionEnabled.value = !visionEnabled.value
          }
        }
        else if (action === 'util' && targetId) {
          if (targetId === 'selfie' && airiCard.activeCardId) {
            postCapture({ characterId: airiCard.activeCardId, includeBg: true, channelId: payload.channelId })
          }
          else if (targetId === 'journalmoment') {
            const llmProvider = consciousnessStore.activeProvider
            const llmModel = consciousnessStore.activeModel
            const messages = chatSession.messages || []
            if (llmProvider && llmModel && messages.length > 0) {
              const textJournalStore = (await import('../memory-text-journal')).useTextJournalStore()
              await textJournalStore.createJournalMoment({
                messages,
                modelId: llmModel,
                providerId: llmProvider,
              })
            }
          }
        }

        // Re-render widget to show updated values
        await renderManageWidget(payload.interactionId)
      }
      else if (payload.commandName === 'director') {
        const mode = payload.options.mode?.toString()
        const enabled = mode === 'on'

        if (airiCard.activeCardId) {
          airiCard.setAutonomousArtistry(airiCard.activeCardId, enabled)
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: `🎬 Autonomous Artistry has been set to **${mode?.toUpperCase()}**.`,
          })
        }
      }
      else if (payload.commandName === 'chatmode') {
        const mode = payload.options.mode?.toString() as 'followup' | 'steer' | 'collect'
        if (mode && ['followup', 'steer', 'collect'].includes(mode)) {
          chatMode.value = mode
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: `⚙️ Chat mode has been set to **${mode.toUpperCase()}**.`,
          })
        }
      }
      else if (payload.commandName === 'imagine') {
        const prompt = payload.options.prompt?.toString()
        if (!prompt)
          return

        await invokeReplyInteraction?.({
          interactionId: payload.interactionId,
          content: `🎨 Directing the Artistry pipeline to visualize: *"${prompt}"*...`,
        })

        // Fire autonomous task with assistant target to force display
        await artistryAutonomousStore.runArtistTask(prompt, chatSession.messages as any, 'assistant')
      }
      else if (payload.commandName === 'journalmoment') {
        const prompt = payload.options.prompt?.toString().trim()
        const llmProvider = consciousnessStore.activeProvider
        const llmModel = consciousnessStore.activeModel

        if (!llmProvider || !llmModel) {
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: '❌ Cannot generate journal entry: active LLM brain/provider not selected.',
          })
          return
        }

        const messages = chatSession.messages || []
        if (messages.length === 0) {
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: '❌ Cannot generate journal entry: there is no conversation history in the active session.',
          })
          return
        }

        try {
          debug('[DiscordStore] Generating background journal moment via /journalmoment...')
          const textJournalStore = (await import('../memory-text-journal')).useTextJournalStore()
          const entry = await textJournalStore.createJournalMoment({
            messages,
            instructions: prompt || undefined,
            modelId: llmModel,
            providerId: llmProvider,
          })

          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: `📖 **Journal Moment Created!**\n**Title**: ${entry.title}\n> ${entry.content}`,
          })
        }
        catch (err: any) {
          console.error('[DiscordStore] Failed to generate journal moment:', err)
          await invokeReplyInteraction?.({
            interactionId: payload.interactionId,
            content: `❌ Failed to generate journal entry: ${err.message || String(err)}`,
          })
        }
      }
      else {
        // Fallback for other commands not yet implemented
        await invokeReplyInteraction?.({
          interactionId: payload.interactionId,
          content: `The command \`/${payload.commandName}\` is not yet implemented in the AIRI core.`,
          ephemeral: true,
        })
      }
    }

    const onClassicSpeechCaptured = async (_event: any, payload: { userId: string, username: string, pcmBase64: string }) => {
      // Leadership election: only the Stage window should run transcription.
      // Multiple renderer windows (Stage, Settings, etc.) all receive the IPC broadcast;
      // without this guard we'd get N parallel transcription jobs fighting over the Whisper worker.
      const hash = window.location.hash || '#/'
      const isStage = hash === '#/' || hash.startsWith('#/stage')
      if (!isStage)
        return

      // Minimum viable audio: 16kHz mono 16-bit = 32000 bytes/sec.
      // Anything under ~300ms (~9600 bytes) is almost certainly trailing silence
      // that Whisper will hallucinate on (producing ">>" or "you" artifacts).
      const MIN_PCM_BYTES = 9600
      const pcmByteLength = Math.floor(payload.pcmBase64.length * 3 / 4)
      if (pcmByteLength < MIN_PCM_BYTES) {
        debug(`[DiscordStore/Classic] ⏭ Skipping micro-clip (${pcmByteLength} bytes < ${MIN_PCM_BYTES} minimum).`)
        return
      }

      const initLog = `[DiscordStore/Classic] 🎙️ IPC Captured speech from ${payload.username}. Length: ${payload.pcmBase64.length} chars.`
      debug(initLog)
      if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.send('logger:write', 'info', initLog)
      }

      try {
        const hearingPipeline = useHearingSpeechInputPipeline()

        // Convert PCM base64 string to binary array
        const binaryString = atob(payload.pcmBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        // Construct 44-byte WAV header
        const wavHeader = new ArrayBuffer(44)
        const view = new DataView(wavHeader)

        const writeString = (offset: number, str: string) => {
          for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i))
          }
        }

        writeString(0, 'RIFF')
        view.setUint32(4, 36 + bytes.length, true)
        writeString(8, 'WAVE')
        writeString(12, 'fmt ')
        view.setUint32(16, 16, true)
        view.setUint16(20, 1, true)
        view.setUint16(22, 1, true)
        view.setUint32(24, 16000, true)
        view.setUint32(28, 32000, true)
        view.setUint16(32, 2, true)
        view.setUint16(34, 16, true)
        writeString(36, 'data')
        view.setUint32(40, bytes.length, true)

        const wavBlob = new Blob([wavHeader, bytes], { type: 'audio/wav' })

        const procLog = `[DiscordStore/Classic] 🎙️ Processing transcription for ${payload.username} (${wavBlob.size} bytes)...`
        debug(procLog)
        if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
          (window as any).electron.ipcRenderer.send('logger:write', 'info', procLog)
        }

        const text = await hearingPipeline.transcribeForRecording(wavBlob)

        const resultLog = `[Discord Classic STT Verification] User Said: "${text}"`
        debug(resultLog)
        if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
          (window as any).electron.ipcRenderer.send('logger:write', 'info', resultLog)
        }

        // Phase 2: Ingest the transcription into the active chat session,
        // triggering the LLM response exactly as a typed Discord message would.
        if (text && text.trim()) {
          void chatOrchestrator.ingest(text.trim(), {
            metadata: {
              _discordVoiceSource: {
                userId: payload.userId,
                username: payload.username,
                mode: 'classic',
              },
            },
          })
        }
      }
      catch (err: any) {
        const errLog = `[DiscordStore/Classic] Failed to transcribe classic speech: ${err.message}`
        console.error(errLog)
        if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
          (window as any).electron.ipcRenderer.send('logger:write', 'error', errLog)
        }
      }
    }

    ipcRenderer.on(STATUS_CHANGED_CHANNEL, onStatusChanged)
    ipcRenderer.on(EVENT_LOG_CHANNEL, onEventLog)
    ipcRenderer.on(INBOUND_MESSAGE_CHANNEL, onInboundMessage)
    ipcRenderer.on(INTERACTION_CHANNEL, onInteraction)
    ipcRenderer.on('discord-classic-speech-captured', onClassicSpeechCaptured)

    const onBeforeSend = async (_message: string, options: any) => {
      // ── VERIFICATION LOGS ──
      // We log the structure to confirm where _discordSource actually lives
      debug('[DiscordStore] onBeforeSend triggered. Context Structure:', {
        hasMessage: !!options?.message,
        messageKeys: options?.message ? Object.keys(options.message) : [],
        hasMetadata: !!options?.metadata,
        metadataKeys: options?.metadata ? Object.keys(options.metadata) : [],
      })

      const source = options?.message?._discordSource
      if (source?.channelId) {
        debug(`[DiscordStore] Discord Source Detected: channel=${source.channelId}, user=${source.username}`)

        // Leadership Election: Only Stage window sends the typing indicator
        const hash = window.location.hash || '#/'
        const isStage = hash === '#/' || hash.startsWith('#/stage')

        if (isStage && invokeSendTyping) {
          debug(`[DiscordStore] Starting typing heartbeat for channel ${source.channelId.slice(-4)}`)

          // Initial trigger
          await invokeSendTyping({ channelId: source.channelId }).catch(() => {})

          // Heartbeat every 7 seconds (Discord typing expires in ~10s)
          if (typingHeartbeat)
            clearInterval(typingHeartbeat)

          typingHeartbeat = setInterval(async () => {
            if (invokeSendTyping && source.channelId) {
              debug(`[DiscordStore] Typing heartbeat tick for ${source.channelId.slice(-4)}`)
              await invokeSendTyping({ channelId: source.channelId }).catch(() => {})
            }
          }, 7000)
        }
        else {
          debug(`[DiscordStore] Typing skipped: isStage=${isStage}, hasInvoker=${!!invokeSendTyping}`)
        }
      }
      else {
        debug('[DiscordStore] No Discord source found in message metadata.')
      }
    }

    const cleanupChatHooks = [
      chatOrchestrator.onChatTurnComplete(onChatTurnComplete),
      chatOrchestrator.onBeforeSend(onBeforeSend),
      chatOrchestrator.onStreamEnd(onStreamEnd),
    ]

    const backgroundStore = useBackgroundStore()
    const cleanupBackgroundHook = backgroundStore.onBackgroundAdded(async (entry) => {
      debug(`[DiscordStore] Background detected: ${entry.id} (${entry.type})`)

      // 1. Detection Log
      const detectLog: DiscordEventLogEntry = {
        timestamp: Date.now(),
        type: 'image-debug-log',
        summary: `New background detected: ${entry.id} (Type: ${entry.type})`,
      }
      eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), detectLog]

      // Only route Journal or Selfie images to Discord
      if (entry.type !== 'journal' && entry.type !== 'selfie')
        return

      debug('[DiscordStore] Candidate image for Discord routing found.')

      const targetChannelId = entry.metadata?.discordChannelId || lastChannelId.value
      // 2. Connection/Channel Check
      if (!isConnected.value || !targetChannelId) {
        debug(`[DiscordStore] Skipping image routing: isConnected=${isConnected.value}, targetChannelId=${targetChannelId}`)
        const failLog: DiscordEventLogEntry = {
          timestamp: Date.now(),
          type: 'image-debug-log',
          summary: `Routing skipped: Connected=${isConnected.value}, TargetChannel=${targetChannelId}`,
        }
        eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), failLog]
        return
      }

      // 3. Leadership Election Check
      const hash = window.location.hash || '#/'
      const isStage = hash === '#/' || hash.startsWith('#/stage') || hash.startsWith('#/actor')

      if (!isStage) {
        debug(`[DiscordStore] Skipping image routing: Window (${hash}) is not Stage leader.`)
        const leaderLog: DiscordEventLogEntry = {
          timestamp: Date.now(),
          type: 'image-debug-log',
          summary: `Routing skipped: This window (${hash}) is not the Stage leader.`,
        }
        eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), leaderLog]
        return
      }

      try {
        debug(`[DiscordStore] Routing image to Discord: ${entry.title}`)
        // Convert Blob to Base64 for IPC transfer
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string)
        })
        reader.readAsDataURL(entry.blob)
        const base64 = await base64Promise

        // Fetch the Director's reasoning to include in the caption (if enabled)
        const artistryStore = useAutonomousArtistryStore()
        const cardStore = useAiriCardStore()
        const monitorDiscordEnabled = (cardStore.activeCard?.extensions?.airi?.artistry as any)?.autonomousMonitorDiscordEnabled ?? false
        const recentNote = [...artistryStore.directorNotes].reverse().find(n => n.title === entry.title || n.prompt === entry.prompt)

        let caption = `🎨 **New Visual Manifestation: ${entry.title}**`
        if (monitorDiscordEnabled && recentNote && recentNote.content) {
          caption += `\n\n🎬 **Director's Note (${recentNote.intensity}/100):** *${recentNote.content}*`
        }

        await sendImageToDiscord(targetChannelId, base64, caption)
      }
      catch (err: any) {
        console.error('[DiscordStore] Failed to route image to discord:', err)
        const errLog: DiscordEventLogEntry = {
          timestamp: Date.now(),
          type: 'ERROR',
          summary: `Image routing failed: ${err.message}`,
        }
        eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), errLog]
      }
    })

    cleanupListeners = () => {
      if (typingHeartbeat) {
        clearInterval(typingHeartbeat)
        typingHeartbeat = null
      }
      ipcRenderer.removeListener(STATUS_CHANGED_CHANNEL, onStatusChanged)
      ipcRenderer.removeListener(EVENT_LOG_CHANNEL, onEventLog)
      ipcRenderer.removeListener(INBOUND_MESSAGE_CHANNEL, onInboundMessage)
      ipcRenderer.removeListener(INTERACTION_CHANNEL, onInteraction)
      ipcRenderer.removeListener('discord-classic-speech-captured', onClassicSpeechCaptured)
      cleanupChatHooks.forEach(cleanup => cleanup())
      cleanupBackgroundHook()
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  // ── Lifecycle & Initialization ──────────────────────────────────────────

  // Initialize listeners immediately so the store is "always awake"
  setupEventListeners()

  onMounted(async () => {
    // Always fetch the true status from the main process on mount
    await refreshStatus()

    // Auto-start logic: If the user previously enabled the service, we have a token,
    // and the main process is currently disconnected, we should boot it up.
    // We restrict this trigger to the Stage window so multiple open windows (like Settings)
    // don't try to start the service simultaneously and cause reconnect loops.
    if (enabled.value && token.value && serviceStatus.value.state === 'disconnected') {
      const hash = window.location.hash || '#/'
      const isStage = hash === '#/' || hash.startsWith('#/stage')

      if (isStage) {
        void startService()
      }
    }
  })

  // Automatically sync commands once we actually connect
  watch(isConnected, (connected) => {
    if (connected) {
      debug('[DiscordStore] Service connected, triggering command sync...')
      void syncCommands()
    }
  })

  onUnmounted(() => {
    cleanupListeners?.()
  })

  return {
    // Config
    enabled,
    token,
    configured,
    executionMode,
    ownerUsername,
    ownerUserId,
    cfAccountId,
    cfApiToken,
    cfOAuthTokens,
    cloudRelayInstances,
    chatMode,
    voiceMode,
    voiceCall,
    visionEnabled,
    dmsEnabled,

    // Live State
    serviceStatus,
    isConnected,
    isConnecting,
    eventLog,

    // Actions
    startService,
    stopService,
    authenticateWithCloudflare,
    deployCloudRelay,
    refreshStatus,
    forceCardSync,
    simulateEvent,
    sendMessageToDiscord,
    addAudioToTurn,
    flushAudioTurn,
    clearAudioTurn,
    clearEventLog,
    resetState,
  }
})
