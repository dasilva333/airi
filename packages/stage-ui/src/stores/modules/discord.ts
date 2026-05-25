import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import type {
  DiscordCommandDefinition,
  DiscordEventLogEntry,
  DiscordInboundMessage,
  DiscordInteractionPayload,
  DiscordServiceStatus,
} from '@proj-airi/stage-shared'
import {
  discordServiceForceSync,
  discordServiceGetStatus,
  discordServiceRegisterCommands,
  discordServiceReplyInteraction,
  discordServiceSendImage,
  discordServiceSendMessage,
  discordServiceSendTyping,
  discordServiceSimulateEvent,
  discordServiceStart,
  discordServiceStop,
} from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'

import { stripMarkers } from '../../composables/response-categoriser'
import { useBackgroundStore } from '../background'
import { useChatOrchestratorStore } from '../chat'
import { useChatSessionStore } from '../chat/session-store'
import { useAiriCardStore } from './airi-card'
import { useArtistryStore } from './artistry'
import { useAutonomousArtistryStore } from './artistry-autonomous'
import { useConsciousnessStore } from './consciousness'
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

const COMMANDS_VERSION = 5
const CORE_COMMANDS: DiscordCommandDefinition[] = [
  {
    description: 'View the current AIRI system status, active modules, and AI brains',
    name: 'status',
  },
  {
    description: 'Manually trigger an image generation using the current Autonomous Artistry pipeline',
    name: 'imagine',
    options: [
      {
        description: 'What do you want the active character to visualize?',
        name: 'prompt',
        required: true,
        type: 3, // String
      },
    ],
  },
  {
    description: 'Toggle Autonomous Artistry (stops generation requests)',
    name: 'director',
    options: [
      {
        choices: [
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' },
        ],
        description: 'Set to on or off',
        name: 'mode',
        required: true,
        type: 3, // String
      },
    ],
  },
  {
    description: 'Switch the active AIRI character profile',
    name: 'character',
    options: [
      {
        autocomplete: true,
        description: 'The unique ID of the character to switch to',
        name: 'id',
        required: false,
        type: 3, // String
      },
    ],
  },
  {
    description: 'Reset the current chat session and start fresh',
    name: 'new',
    options: [
      {
        description: 'Optional initial message to start the new session with',
        name: 'message',
        required: false,
        type: 3, // String
      },
    ],
  },
  {
    description: 'Catch up on the last few turns of the conversation',
    name: 'history',
    options: [
      {
        description: 'Number of conversation turns to retrieve (default: 5)',
        name: 'turns',
        required: false,
        type: 4, // Integer
      },
    ],
  },
  {
    description: 'Summon the bot to your current voice channel',
    name: 'summon',
  },
  {
    description: 'Disconnect the bot from the voice channel',
    name: 'leave',
  },
  {
    description: 'Change the chat mode for handling multiple messages',
    name: 'chatmode',
    options: [
      {
        choices: [
          { name: 'followup', value: 'followup' },
          { name: 'steer', value: 'steer' },
          { name: 'collect', value: 'collect' },
        ],
        description: 'The mode to use (followup, steer, or collect)',
        name: 'mode',
        required: true,
        type: 3, // String
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
  // ── Persisted Config ───────────────────────────────────────────────────────
  const enabled = useLocalStorageManualReset<boolean>('settings/discord/enabled', false)
  const token = useLocalStorageManualReset<string>('settings/discord/token', '')
  const lastRegisteredVersion = useLocalStorageManualReset<number>('settings/discord/lastRegisteredVersion', 0)
  const chatMode = useLocalStorageManualReset<'followup' | 'steer' | 'collect'>('settings/discord/chatMode', 'followup')

  const pendingCollectBatch = ref<{ formattedContent: string; attachments: any[]; msg: DiscordInboundMessage }[]>([])
  let collectTimer: ReturnType<typeof setTimeout> | null = null

  function flushCollectBatch() {
    if (pendingCollectBatch.value.length === 0) return
    const batch = [...pendingCollectBatch.value]
    pendingCollectBatch.value = []

    const combinedContent = batch.map((b) => b.formattedContent).join('\n\n')
    const combinedAttachments = batch.flatMap((b) => b.attachments)
    const lastMsg = batch[batch.length - 1].msg

    void chatOrchestrator.ingest(combinedContent, {
      attachments: combinedAttachments,
      metadata: {
        _discordSource: {
          channelId: lastMsg.channelId,
          messageId: lastMsg.messageId,
          userId: lastMsg.userId,
          username: lastMsg.username,
        },
      },
    })
  }

  // ── Live Service State ─────────────────────────────────────────────────────
  const serviceStatus = ref<DiscordServiceStatus>({
    activeChannelId: null,
    botUser: null,
    error: null,
    guilds: [],
    ping: null,
    state: 'disconnected',
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
  const invokeForceSync = isElectron ? useElectronEventaInvoke(discordServiceForceSync) : null
  const invokeSimulate = isElectron ? useElectronEventaInvoke(discordServiceSimulateEvent) : null
  const invokeSendMessage = isElectron ? useElectronEventaInvoke(discordServiceSendMessage) : null
  const invokeSendTyping = isElectron ? useElectronEventaInvoke(discordServiceSendTyping) : null
  const invokeRegisterCommands = isElectron ? useElectronEventaInvoke(discordServiceRegisterCommands) : null
  const invokeReplyInteraction = isElectron ? useElectronEventaInvoke(discordServiceReplyInteraction) : null
  const invokeSendImage = isElectron ? useElectronEventaInvoke(discordServiceSendImage) : null

  // ── Routing Cache ──────────────────────────────────────────────────────────
  const lastChannelId = ref<string | null>(null)
  const audioTurnBuffer = ref<ArrayBuffer[]>([])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function startService() {
    if (!token.value.trim()) {
      console.warn('[DiscordStore] Cannot start: no token configured')
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
    } catch (err) {
      console.error('[DiscordStore] Failed to start service:', err)
    }
  }

  /**
   * Register slash commands with Discord if the version has increased.
   */
  async function syncCommands(force = false) {
    if (!isConnected.value || !invokeRegisterCommands) return

    if (!force && lastRegisteredVersion.value >= COMMANDS_VERSION) {
      console.log(`[DiscordStore] Slash commands are up to date (v${lastRegisteredVersion.value})`)
      return
    }

    try {
      console.log(`[DiscordStore] Registering slash commands (v${COMMANDS_VERSION})...`)
      await invokeRegisterCommands({ commands: CORE_COMMANDS })
      lastRegisteredVersion.value = COMMANDS_VERSION
    } catch (err) {
      console.error('[DiscordStore] Failed to register commands:', err)
    }
  }

  async function stopService() {
    enabled.value = false
    try {
      const status = await invokeStop?.()
      if (status) serviceStatus.value = status
    } catch (err) {
      console.error('[DiscordStore] Failed to stop service:', err)
    }
  }

  async function refreshStatus() {
    try {
      const status = await invokeGetStatus?.()
      if (status) serviceStatus.value = status
    } catch {
      /* ignore in non-electron */
    }
  }

  async function forceCardSync(payload: { name: string; avatarBase64: string | null }) {
    try {
      await invokeForceSync?.(payload)
    } catch (err) {
      console.error('[DiscordStore] Force sync failed:', err)
    }
  }

  async function simulateEvent(payload?: { username?: string; content?: string }) {
    try {
      await invokeSimulate?.(payload as any)
    } catch (err) {
      console.error('[DiscordStore] Simulate failed:', err)
    }
  }

  async function sendMessageToDiscord(channelId: string, content: string) {
    try {
      lastChannelId.value = channelId
      await invokeSendMessage?.({ channelId, content })
    } catch (err) {
      console.error('[DiscordStore] Send message failed:', err)
    }
  }

  function addAudioToTurn(buffer: ArrayBuffer) {
    if (buffer.byteLength === 0) return
    console.log(`[DiscordStore] Aggregating audio chunk: ${Math.round(buffer.byteLength / 1024)}KB`)
    audioTurnBuffer.value.push(buffer)
  }

  async function flushAudioTurn(content?: string) {
    if (audioTurnBuffer.value.length === 0 || !lastChannelId.value) {
      console.log('[DiscordStore] Flush skipped: Bucket empty.')
      return
    }

    const channelId = lastChannelId.value
    console.log(`[DiscordStore] FLUSHING Voice Note: ${audioTurnBuffer.value.length} chunks to ${channelId}`)

    try {
      const channelName = 'eventa:invoke:electron:discord:send-voice-note'

      // Explicitly convert buffers to Uint8Arrays to ensure they are cloneable via IPC
      // and strip any Vue reactivity proxies.
      const buffers = audioTurnBuffer.value.map((buf) => new Uint8Array(buf))

      // We send the array of buffers to the main process for merging and delivery
      const result = await (window as any).electron?.ipcRenderer?.invoke(channelName, {
        audioBuffers: buffers,
        channelId,
        content,
        filename: `voice-note-${Date.now()}.mp3`,
      })

      console.log('[DiscordStore] Voice Note IPC successful. Result:', result)
    } catch (err) {
      console.error('[DiscordStore] Voice Note delivery failed:', err)
    } finally {
      audioTurnBuffer.value = []
    }
  }

  function clearAudioTurn() {
    console.log('[DiscordStore] Clearing audio turn bucket.')
    audioTurnBuffer.value = []
  }

  async function sendImageToDiscord(channelId: string, base64: string, content?: string, filename?: string) {
    console.log(
      `[DiscordStore] Preparing to invoke IPC sendImage. Channel: ${channelId}, Payload Size: ${Math.round(base64.length / 1024)}KB, Shape: ${base64.substring(0, 30)}...`,
    )

    if (!invokeSendImage) {
      console.error('[DiscordStore] IPC Invoker "invokeSendImage" is NULL! Are you in a browser instead of Electron?')
      return
    }

    try {
      lastChannelId.value = channelId
      const channelName = 'eventa:invoke:electron:discord:send-image'
      console.log(`[DiscordStore] NATIVE BYPASS: Invoking ${channelName}. Shape: ${base64.substring(0, 50)}...`)

      // We bypass the wrapper and use the literal channel name to avoid "undefined" contract issues
      const result = await (window as any).electron?.ipcRenderer?.invoke(
        channelName,
        toRaw({ base64, channelId, content, filename }),
      )

      console.log('[DiscordStore] Native IPC successful. Result:', result)
    } catch (err) {
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
      activeChannelId: null,
      botUser: null,
      error: null,
      guilds: [],
      ping: null,
      state: 'disconnected',
    }
    eventLog.value = []
  }

  // ── IPC Event Listeners ────────────────────────────────────────────────────
  const processedMessageIds = new Set<string>()
  let cleanupListeners: (() => void) | null = null
  let typingHeartbeat: ReturnType<typeof setInterval> | null = null

  function setupEventListeners() {
    if (!isElectron) return

    const ipcRenderer = (window as any).electron?.ipcRenderer
    if (!ipcRenderer) return

    console.log('[DiscordStore] Initializing IPC listeners...')

    const onStatusChanged = (_event: any, status: DiscordServiceStatus) => {
      serviceStatus.value = status
    }

    const onEventLog = (_event: any, entry: DiscordEventLogEntry) => {
      eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), entry]
    }

    const onInboundMessage = (_event: any, msg: DiscordInboundMessage) => {
      console.log(`[DiscordStore] Inbound message received: ${msg.messageId.slice(-6)} from ${msg.username}`)

      // 0. Deduplicate by ID within this window process
      if (processedMessageIds.has(msg.messageId)) return
      processedMessageIds.add(msg.messageId)

      // Update routing cache
      lastChannelId.value = msg.channelId

      // 1. Leadership Election: Only the "Stage" window (root hash) handles the Brain handover.
      const hash = window.location.hash || '#/'
      const isStage = hash === '#/' || hash.startsWith('#/stage')

      if (!isStage) {
        console.log(`[DiscordStore] Skipping Brain handover: Window (${hash}) is not Stage.`)
        return
      }

      console.log(`[DiscordStore] Handing over message ${msg.messageId.slice(-6)} to Brain...`)

      // 3. BRAIN HANDOVER (Stage only)
      const handoverEntry: DiscordEventLogEntry = {
        summary: `Stage taking control of message ${msg.messageId.slice(-6)}`,
        timestamp: Date.now(),
        type: 'BRAIN_HANDOVER',
      }
      eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), handoverEntry]

      const formattedContent = `${msg.displayName} says:\n${msg.content}`

      const attachments = (msg.attachments || [])
        .map((att) => {
          const match = att.match(/^data:([^;]+);base64,(.*)$/)
          if (match) {
            return {
              data: match[2],
              mimeType: match[1],
              type: 'image' as const,
            }
          }
          return null
        })
        .filter(Boolean) as any[]

      if (chatMode.value === 'collect') {
        pendingCollectBatch.value.push({ attachments, formattedContent, msg })
        if (collectTimer) clearTimeout(collectTimer)
        collectTimer = setTimeout(flushCollectBatch, 5000)
        return
      }

      if (chatMode.value === 'steer' && chatOrchestrator.sending) {
        console.log(`[DiscordStore] Steer mode active. Aborting current generation and rolling up context.`)
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
                channelId: msg.channelId,
                messageId: msg.messageId,
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
            channelId: msg.channelId,
            messageId: msg.messageId,
            userId: msg.userId,
            username: msg.username,
          },
        },
      })
    }

    const onChatTurnComplete = async (chat: any, context: any) => {
      const source = (context.message as any)?._discordSource
      if (!source?.channelId) return

      console.log(
        `[DiscordStore] Outbound response ready for ${source.username} in channel ${source.channelId.slice(-4)}`,
      )

      // Leadership Election: Only the "Stage" window handles the Outbound reply
      const hash = window.location.hash || '#/'
      const isStage = hash === '#/' || hash.startsWith('#/stage')

      if (!isStage) {
        console.log(`[DiscordStore] Skipping Outbound: Window (${hash}) is not Stage.`)
        return
      }

      const ttsText = chat.outputText || chat.output.content
      const error = chat.output.error

      if (error) {
        console.warn('[DiscordStore] Relaying error back to Discord:', error)
        // ... (error handling)
        // Notify Discord about the technical failure so the user isn't left hanging
        const errorMsg = typeof error === 'string' ? error : error.message || 'Unknown Error'
        const technicalFeedback = `⚠️ **AIRI encountered a technical problem.**\n*(Error: ${errorMsg})*`

        const errorLogEntry: DiscordEventLogEntry = {
          summary: `Relaying error to ${source.username}: ${errorMsg.substring(0, 50)}`,
          timestamp: Date.now(),
          type: 'ERROR_RELAY',
        }
        eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), errorLogEntry]

        await sendMessageToDiscord(source.channelId, technicalFeedback)

        if (typingHeartbeat) {
          console.log('[DiscordStore] Turn complete (ERROR), clearing typing heartbeat.')
          clearInterval(typingHeartbeat)
          typingHeartbeat = null
        }

        return
      }

      if (!ttsText) return

      // Log the intent to send
      const logEntry: DiscordEventLogEntry = {
        summary: `Sending reply to ${source.username} in channel ${source.channelId.slice(-4)}`,
        timestamp: Date.now(),
        type: 'MESSAGE_SEND',
      }
      eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), logEntry]

      // NOTICE: Strip orchestration tokens (<|ACTOR:|>, <|ACT:|>, etc.) before sending
      // to Discord. The raw tokens are preserved in the DB for LLM context, but external
      // consumers should never see them.
      const cleanedText = stripMarkers(typeof ttsText === 'string' ? ttsText : String(ttsText))
      await sendMessageToDiscord(source.channelId, cleanedText)
    }

    const onStreamEnd = async () => {
      const hash = window.location.hash || '#/'
      const isStage = hash === '#/' || hash.startsWith('#/stage')

      if (!isStage) return

      if (typingHeartbeat) {
        console.log('[DiscordStore] Stream ended, clearing typing heartbeat.')
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
        console.log(`[DiscordStore] Ignoring interaction ${payload.interactionId}: Not the leader window.`)
        return
      }

      console.log(`[DiscordStore] Handling interaction: /${payload.commandName} (${payload.interactionId})`)

      // Keep channel context updated for things like image routing (e.g. /imagine)
      if (payload.channelId) {
        lastChannelId.value = payload.channelId
      }

      if (payload.commandName === 'history') {
        const turns = payload.options.turns || 5
        const history = chatSession.messages.slice(-turns * 2) // * 2 because history includes user and assistant

        if (history.length === 0) {
          await invokeReplyInteraction?.({
            content: 'There is no conversation history to display.',
            interactionId: payload.interactionId,
          })
          return
        }

        const lines: string[] = []
        for (const msg of history) {
          const role = msg.role === 'user' ? 'User' : airiCard.activeCard?.name || 'Assistant'
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
          } else {
            currentMessage += `${line}\n\n`
          }
        }
        if (currentMessage) {
          messagesToSend.push(currentMessage.trim())
        }

        // Send the first chunk as the initial reply
        try {
          await invokeReplyInteraction?.({
            content: messagesToSend[0],
            interactionId: payload.interactionId,
          })

          // Send subsequent chunks as follow-ups
          for (let i = 1; i < messagesToSend.length; i++) {
            await invokeReplyInteraction?.({
              content: messagesToSend[i],
              followUp: true,
              interactionId: payload.interactionId,
            })
          }
        } catch (err) {
          console.error('[DiscordStore] Failed to send history chunks:', err)
        }
      } else if (payload.commandName === 'character') {
        const query = (payload.options.id || payload.options.name || '').toString().trim()

        if (!query) {
          const charList = Array.from(airiCard.cards.values())
            .map((c) => `- **${c.name}**`)
            .join('\n')

          await invokeReplyInteraction?.({
            content: `Active: **${airiCard.activeCard?.name || 'None'}**\n\nAvailable Characters:\n${charList}`,
            interactionId: payload.interactionId,
          })
          return
        }

        // Fuzzy match: Try exact ID, then exact name, then partial name
        const allCards = Array.from(airiCard.cards.entries())
        const target =
          allCards.find(([id]) => id === query) ||
          allCards.find(([, card]) => card.name.toLowerCase() === query.toLowerCase()) ||
          allCards.find(([, card]) => card.name.toLowerCase().includes(query.toLowerCase()))

        if (target) {
          const [id, card] = target
          await airiCard.activateCard(id)
          await invokeReplyInteraction?.({
            content: `Successfully switched active character to **${card.name}**!`,
            interactionId: payload.interactionId,
          })
        } else {
          await invokeReplyInteraction?.({
            content: `Could not find a character matching "**${query}**".`,
            interactionId: payload.interactionId,
          })
        }
      } else if (payload.commandName === 'new') {
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
          content: initialMessage
            ? `Started a new session with your message!`
            : `Chat session has been reset. Fresh start!`,
          interactionId: payload.interactionId,
        })
      } else if (payload.commandName === 'status') {
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
          if (wf) artModelName = wf.name
        }

        const visionEnabled = visionStore.isWitnessEnabled
        const directorEnabled = artistryExt?.autonomousEnabled || false
        const liveActive = liveSessionStore.isActive

        const content = `**AIRI System Status**
-------------------------
**Active Character:** ${activeCardName}
**Conversation:** ${turns} turns in current session

**🧠 Brains (LLM):** ${llmProvider} / ${llmModel}
**🗣️ Voice (TTS):** ${ttsProvider} / ${ttsVoice}
**🎨 Artistry:** ${artProvider} / ${artProvider === 'comfyui' ? 'Workflow' : 'Model'}: \`${artModelName}\`

**Active Modules:**
- [${visionEnabled ? 'ON' : 'OFF'}] 👁️ **Vision:** Witness Mode ${visionEnabled ? 'active' : 'disabled'}
- [${directorEnabled ? 'ON' : 'OFF'}] 🎬 **Director:** Autonomous Artistry ${directorEnabled ? 'active' : 'disabled'}
- [${liveActive ? 'ON' : 'OFF'}] 🧠 **Live API:** ${liveActive ? 'Active' : 'Offline'}`

        await invokeReplyInteraction?.({
          content,
          interactionId: payload.interactionId,
        })
      } else if (payload.commandName === 'director') {
        const mode = payload.options.mode?.toString()
        const enabled = mode === 'on'

        if (airiCard.activeCardId) {
          airiCard.setAutonomousArtistry(airiCard.activeCardId, enabled)
          await invokeReplyInteraction?.({
            content: `🎬 Autonomous Artistry has been set to **${mode?.toUpperCase()}**.`,
            interactionId: payload.interactionId,
          })
        }
      } else if (payload.commandName === 'chatmode') {
        const mode = payload.options.mode?.toString() as 'followup' | 'steer' | 'collect'
        if (mode && ['followup', 'steer', 'collect'].includes(mode)) {
          chatMode.value = mode
          await invokeReplyInteraction?.({
            content: `⚙️ Chat mode has been set to **${mode.toUpperCase()}**.`,
            interactionId: payload.interactionId,
          })
        }
      } else if (payload.commandName === 'imagine') {
        const prompt = payload.options.prompt?.toString()
        if (!prompt) return

        await invokeReplyInteraction?.({
          content: `🎨 Directing the Artistry pipeline to visualize: *"${prompt}"*...`,
          interactionId: payload.interactionId,
        })

        // Fire autonomous task with assistant target to force display
        await artistryAutonomousStore.runArtistTask(prompt, chatSession.messages as any, 'assistant')
      } else {
        // Fallback for other commands not yet implemented
        await invokeReplyInteraction?.({
          content: `The command \`/${payload.commandName}\` is not yet implemented in the AIRI core.`,
          ephemeral: true,
          interactionId: payload.interactionId,
        })
      }
    }

    ipcRenderer.on(STATUS_CHANGED_CHANNEL, onStatusChanged)
    ipcRenderer.on(EVENT_LOG_CHANNEL, onEventLog)
    ipcRenderer.on(INBOUND_MESSAGE_CHANNEL, onInboundMessage)
    ipcRenderer.on(INTERACTION_CHANNEL, onInteraction)

    const onBeforeSend = async (_message: string, options: any) => {
      // ── VERIFICATION LOGS ──
      // We log the structure to confirm where _discordSource actually lives
      console.log('[DiscordStore] onBeforeSend triggered. Context Structure:', {
        hasMessage: !!options?.message,
        hasMetadata: !!options?.metadata,
        messageKeys: options?.message ? Object.keys(options.message) : [],
        metadataKeys: options?.metadata ? Object.keys(options.metadata) : [],
      })

      const source = options?.message?._discordSource
      if (source?.channelId) {
        console.log(`[DiscordStore] Discord Source Detected: channel=${source.channelId}, user=${source.username}`)

        // Leadership Election: Only Stage window sends the typing indicator
        const hash = window.location.hash || '#/'
        const isStage = hash === '#/' || hash.startsWith('#/stage')

        if (isStage && invokeSendTyping) {
          console.log(`[DiscordStore] Starting typing heartbeat for channel ${source.channelId.slice(-4)}`)

          // Initial trigger
          await invokeSendTyping({ channelId: source.channelId }).catch(() => {})

          // Heartbeat every 7 seconds (Discord typing expires in ~10s)
          if (typingHeartbeat) clearInterval(typingHeartbeat)

          typingHeartbeat = setInterval(async () => {
            if (invokeSendTyping && source.channelId) {
              console.log(`[DiscordStore] Typing heartbeat tick for ${source.channelId.slice(-4)}`)
              await invokeSendTyping({ channelId: source.channelId }).catch(() => {})
            }
          }, 7000)
        } else {
          console.log(`[DiscordStore] Typing skipped: isStage=${isStage}, hasInvoker=${!!invokeSendTyping}`)
        }
      } else {
        console.log('[DiscordStore] No Discord source found in message metadata.')
      }
    }

    const cleanupChatHooks = [
      chatOrchestrator.onChatTurnComplete(onChatTurnComplete),
      chatOrchestrator.onBeforeSend(onBeforeSend),
      chatOrchestrator.onStreamEnd(onStreamEnd),
    ]

    const backgroundStore = useBackgroundStore()
    const cleanupBackgroundHook = backgroundStore.onBackgroundAdded(async (entry) => {
      console.log(`[DiscordStore] Background detected: ${entry.id} (${entry.type})`)

      // 1. Detection Log
      const detectLog: DiscordEventLogEntry = {
        summary: `New background detected: ${entry.id} (Type: ${entry.type})`,
        timestamp: Date.now(),
        type: 'image-debug-log',
      }
      eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), detectLog]

      // Only route Journal or Selfie images to Discord
      if (entry.type !== 'journal' && entry.type !== 'selfie') return

      console.log('[DiscordStore] Candidate image for Discord routing found.')

      // 2. Connection/Channel Check
      if (!isConnected.value || !lastChannelId.value) {
        console.log(
          `[DiscordStore] Skipping image routing: isConnected=${isConnected.value}, lastChannelId=${lastChannelId.value}`,
        )
        const failLog: DiscordEventLogEntry = {
          summary: `Routing skipped: Connected=${isConnected.value}, LastChannel=${lastChannelId.value}`,
          timestamp: Date.now(),
          type: 'image-debug-log',
        }
        eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), failLog]
        return
      }

      // 3. Leadership Election Check
      const hash = window.location.hash || '#/'
      const isStage = hash === '#/' || hash.startsWith('#/stage')

      if (!isStage) {
        console.log(`[DiscordStore] Skipping image routing: Window (${hash}) is not Stage leader.`)
        const leaderLog: DiscordEventLogEntry = {
          summary: `Routing skipped: This window (${hash}) is not the Stage leader.`,
          timestamp: Date.now(),
          type: 'image-debug-log',
        }
        eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), leaderLog]
        return
      }

      try {
        console.log(`[DiscordStore] Routing image to Discord: ${entry.title}`)
        const routeLog: DiscordEventLogEntry = {
          summary: `Routing image "${entry.title}" to channel ${lastChannelId.value.slice(-4)}`,
          timestamp: Date.now(),
          type: 'IMAGE_ROUTE',
        }
        eventLog.value = [...eventLog.value.slice(-(MAX_EVENT_LOG_ENTRIES - 1)), routeLog]

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
        const monitorEnabled =
          (cardStore.activeCard?.extensions?.airi?.artistry as any)?.autonomousMonitorEnabled ?? true
        const recentNote = [...artistryStore.directorNotes]
          .reverse()
          .find((n) => n.title === entry.title || n.prompt === entry.prompt)

        let caption = `🎨 **New Visual Manifestation: ${entry.title}**`
        if (monitorEnabled && recentNote && recentNote.content) {
          caption += `\n\n🎬 **Director's Note (${recentNote.intensity}/100):** *${recentNote.content}*`
        }

        await sendImageToDiscord(lastChannelId.value, base64, caption)
      } catch (err: any) {
        console.error('[DiscordStore] Failed to route image to discord:', err)
        const errLog: DiscordEventLogEntry = {
          summary: `Image routing failed: ${err.message}`,
          timestamp: Date.now(),
          type: 'ERROR',
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
      cleanupChatHooks.forEach((cleanup) => cleanup())
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
      console.log('[DiscordStore] Service connected, triggering command sync...')
      void syncCommands()
    }
  })

  onUnmounted(() => {
    cleanupListeners?.()
  })

  return {
    addAudioToTurn,
    clearAudioTurn,
    clearEventLog,
    configured,
    // Config
    enabled,
    eventLog,
    flushAudioTurn,
    forceCardSync,
    isConnected,
    isConnecting,
    refreshStatus,
    resetState,
    sendMessageToDiscord,

    // Live State
    serviceStatus,
    simulateEvent,

    // Actions
    startService,
    stopService,
    token,
  }
})
