import type {
  DiscordEventLogEntry,
  DiscordInboundMessage,
  DiscordInteractionPayload,
  DiscordOutboundImage,
  DiscordServiceStatus,
} from '@proj-airi/stage-shared'

import { PassThrough } from 'node:stream'

import * as fs from 'node:fs'
import * as path from 'node:path'

import prism from 'prism-media'

import { AudioPlayer, AudioPlayerStatus, createAudioResource, EndBehaviorType, getVoiceConnection, joinVoiceChannel, StreamType } from '@discordjs/voice'
import { useLogg } from '@guiiai/logg'
import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js'
import { BrowserWindow, ipcMain } from 'electron'
import { nanoid } from 'nanoid'

import {
  discordServiceCloudflareOAuth,
  discordServiceDeployCloudRelay,
  discordServiceForceSync,
  discordServiceGetStatus,
  discordServiceLeave,
  discordServiceRegisterCommands,
  discordServiceReplyInteraction,
  discordServiceSendMessage,
  discordServiceSendTyping,
  discordServiceSimulateEvent,
  discordServiceStart,
  discordServiceStop,
  discordServiceSummon,
} from '../../../../shared/eventa'

const log = useLogg('discord-service').useGlobalConfig()

// Event channel names for main → renderer push events
const STATUS_CHANGED_CHANNEL = 'eventa:event:electron:discord:status-changed'
const EVENT_LOG_CHANNEL = 'eventa:event:electron:discord:event-log'
const INBOUND_MESSAGE_CHANNEL = 'eventa:event:electron:discord:inbound-message'
const INTERACTION_CHANNEL = 'eventa:event:electron:discord:interaction'

// ── Internal State ─────────────────────────────────────────────────────────────

let discordClient: Client | null = null
let activeChannelId: string | null = null
const activeInteractions = new Map<string, any>()
let lastError: string | null = null

// Audio player for piping Gemini responses back into Discord voice
let activeAudioPlayer: AudioPlayer | null = null
let activeAudioPassthrough: PassThrough | null = null

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Broadcast an event payload to all BrowserWindows. */
function broadcastToAllWindows(channel: string, payload: unknown) {
  // Use setImmediate to avoid blocking the main thread during heavy broadcast cycles
  setImmediate(() => {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          win.webContents.send(channel, payload)
        }
      }
      catch (err: any) {
        // NOTICE: We ignore 'Render frame was disposed' errors as they occur normally
        // when a window is closed or crashes while a broadcast is in flight.
        const msg = err?.message || ''
        if (!msg.includes('disposed') && !msg.includes('WebFrameMain')) {
          log.warn(`Broadcast failed for window ${win.id}: ${msg}`)
        }
      }
    }
  })
}
function buildStatus(): DiscordServiceStatus {
  if (!discordClient) {
    return {
      state: 'disconnected',
      ping: null,
      guilds: [],
      activeChannelId: null,
      botUser: null,
      error: lastError,
    }
  }

  const ready = discordClient.isReady()
  const guilds = ready
    ? discordClient.guilds.cache.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.iconURL({ size: 64 }),
      }))
    : []

  return {
    state: ready ? 'connected' : 'connecting',
    ping: ready ? discordClient.ws.ping : null,
    guilds,
    activeChannelId,
    botUser: ready && discordClient.user
      ? {
          id: discordClient.user.id,
          tag: discordClient.user.tag,
          avatarUrl: discordClient.user.displayAvatarURL({ size: 128 }),
        }
      : null,
    error: lastError,
  }
}

/**
 * Split a message into Discord-safe chunks (≤2000 chars), preferring
 * newline and space boundaries.  Ported from the legacy adapter.
 */
function chunkMessage(content: string): string[] {
  const MAX = 2000
  if (content.length <= MAX)
    return [content]

  const chunks: string[] = []
  let remaining = content

  while (remaining.length > 0) {
    if (remaining.length <= MAX) {
      chunks.push(remaining)
      break
    }

    let splitAt = remaining.lastIndexOf('\n', MAX)
    if (splitAt <= 0)
      splitAt = remaining.lastIndexOf(' ', MAX)
    if (splitAt <= 0)
      splitAt = MAX

    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trim()
  }

  return chunks
}

// ── Service Setup ──────────────────────────────────────────────────────────────

export function setupDiscordService() {
  const { context } = createContext(ipcMain)

  // ── Interaction Logic ──────────────────────────────────────────────────

  const handleInteraction = async (interaction: any) => {
    const isButton = interaction.isButton()
    if (!interaction.isChatInputCommand() && !isButton) {
      console.log('[DiscordService/Native] Ignoring interaction: not button or command.')
      return
    }

    try {
      console.log(`[DiscordService/Native] handleInteraction started. ID=${interaction.id}, Type=${isButton ? 'Button' : 'Command'}, User=${interaction.user.tag}`)
      if (isButton) {
        pushLog('INTERACTION', `Received button click "${interaction.customId}" from ${interaction.user.tag}`)
        // Defer update so we don't block and can edit the message components dynamically
        await interaction.deferUpdate()
      }
      else {
        pushLog('INTERACTION', `Received /${interaction.commandName} from ${interaction.user.tag}`)
        // Defer reply for slash commands to prevent the 3s timeout
        console.log(`[DiscordService/Native] Deferring reply for /${interaction.commandName}...`)
        await interaction.deferReply()
        console.log('[DiscordService/Native] Defer reply successful.')
      }

      // 2. Cache the interaction so the renderer can reply to it later
      activeInteractions.set(interaction.id, interaction)
      console.log(`[DiscordService/Native] Cached interaction ID=${interaction.id}. Active count: ${activeInteractions.size}`)

      let commandName = ''
      const options: Record<string, any> = {}

      if (isButton) {
        // customId format: namespace:action:args
        const parts = interaction.customId.split(':')
        const namespace = parts[0] || 'unknown'
        const action = parts[1] || ''
        commandName = `button:${namespace}`
        options.action = action
        if (parts.length > 2) {
          options.id = parts.slice(2).join(':')
        }
      }
      else {
        commandName = interaction.commandName
        interaction.options.data.forEach((opt: any) => {
          options[opt.name] = opt.value
        })
      }

      pushInteraction({
        interactionId: interaction.id,
        commandName,
        options,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        username: interaction.user.username,
        guildId: interaction.guildId || null,
      })

      // 5. Auto-cleanup interactions after 15 minutes (Discord's token limit)
      setTimeout(() => {
        activeInteractions.delete(interaction.id)
      }, 15 * 60 * 1000)
    }
    catch (err: any) {
      pushLog('ERROR', `Interaction handling failed: ${err.message}`)
    }
  }

  function pushLog(type: string, summary: string) {
    const entry: DiscordEventLogEntry = {
      timestamp: Date.now(),
      type,
      summary,
    }
    log.log(`[Event] ${type}: ${summary}`)
    broadcastToAllWindows(EVENT_LOG_CHANNEL, entry)
  }

  function pushStatus() {
    broadcastToAllWindows(STATUS_CHANGED_CHANNEL, buildStatus())
  }

  function pushInboundMessage(msg: DiscordInboundMessage) {
    broadcastToAllWindows(INBOUND_MESSAGE_CHANNEL, msg)
  }

  function pushInteraction(payload: DiscordInteractionPayload) {
    broadcastToAllWindows(INTERACTION_CHANNEL, payload)
  }

  // ── Invoke Handlers ────────────────────────────────────────────────────────

  defineInvokeHandler(context, discordServiceStart, async (payload) => {
    const token = payload?.token
    if (!token) {
      lastError = 'No token provided'
      pushStatus()
      return buildStatus()
    }

    // Tear down existing client if any
    if (discordClient) {
      try {
        discordClient.removeAllListeners()
        await discordClient.destroy()
      }
      catch { /* ignore */ }
      discordClient = null
    }

    lastError = null
    pushLog('SERVICE', 'Starting Discord service...')

    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel],
    })

    // ── Discord Event Wiring ───────────────────────────────────────────────

    discordClient.once(Events.ClientReady, (readyClient) => {
      log.log(`Discord bot ready: ${readyClient.user.tag}`)
      pushLog('READY', `Bot online as ${readyClient.user.tag}`)
      pushStatus()
    })

    discordClient.on(Events.ShardDisconnect, (_, shardId) => {
      pushLog('SHARD_DISCONNECT', `Shard ${shardId} disconnected`)
      pushStatus()
    })

    discordClient.on(Events.ShardReconnecting, (shardId) => {
      pushLog('SHARD_RECONNECTING', `Shard ${shardId} reconnecting...`)
      pushStatus()
    })

    discordClient.on(Events.ShardReady, (shardId) => {
      pushLog('SHARD_READY', `Shard ${shardId} ready`)
      pushStatus()
    })

    discordClient.on(Events.Error, (error) => {
      lastError = error.message
      pushLog('ERROR', error.message)
      pushStatus()
    })

    // ── Inbound Message Pipe ───────────────────────────────────────────────

    discordClient.on(Events.MessageCreate, async (message) => {
      if (message.author.bot)
        return

      const content = message.content.trim()

      // Allow empty text if there are attachments
      if (!content && message.attachments.size === 0)
        return

      // Track active channel for outbound routing
      activeChannelId = message.channelId

      pushLog('MESSAGE_CREATE', `${message.author.username}: ${content.substring(0, 80)}${content.length > 80 ? '...' : ''} (${message.attachments.size} attachments)`)

      const inbound: DiscordInboundMessage = {
        messageId: message.id,
        channelId: message.channelId,
        guildId: message.guildId ?? null,
        guildName: message.guild?.name ?? null,
        userId: message.author.id,
        username: message.author.username,
        displayName: message.member?.displayName ?? message.author.username,
        content,
        attachments: [],
      }

      // Handle image attachments
      if (message.attachments.size > 0) {
        for (const attachment of message.attachments.values()) {
          if (attachment.contentType?.startsWith('image/')) {
            try {
              pushLog('ATTACHMENT', `Downloading ${attachment.name} (${attachment.contentType})...`)
              const response = await fetch(attachment.url)
              const buffer = await response.arrayBuffer()
              const base64 = Buffer.from(buffer).toString('base64')
              inbound.attachments.push(`data:${attachment.contentType};base64,${base64}`)
            }
            catch (err: any) {
              pushLog('ERROR', `Failed to download attachment: ${err.message}`)
            }
          }
        }
      }

      pushInboundMessage(inbound)
    })

    discordClient.on(Events.InteractionCreate, handleInteraction)

    // ── Login ──────────────────────────────────────────────────────────────

    try {
      pushStatus() // connecting state
      await discordClient.login(token)
      return buildStatus()
    }
    catch (err: any) {
      lastError = err?.message || 'Login failed'
      pushLog('ERROR', `Login failed: ${lastError}`)
      pushStatus()
      return buildStatus()
    }
  })

  defineInvokeHandler(context, discordServiceStop, async () => {
    if (discordClient) {
      pushLog('SERVICE', 'Stopping Discord service...')
      try {
        discordClient.removeAllListeners()
        await discordClient.destroy()
      }
      catch { /* ignore */ }
      discordClient = null
      activeChannelId = null
    }
    pushStatus()
    return buildStatus()
  })

  defineInvokeHandler(context, discordServiceCloudflareOAuth, async () => {
    pushLog('OAUTH', 'Initiating Cloudflare OAuth 2.0 PKCE authentication server...')
    const { loginWithCloudflareOAuth } = await import('@proj-airi/stage-edge/deployer/oauth')
    try {
      const tokens = await loginWithCloudflareOAuth()
      pushLog('OAUTH', 'Cloudflare OAuth authentication succeeded!')
      return tokens
    }
    catch (err: any) {
      pushLog('ERROR', `Cloudflare OAuth authentication failed: ${err?.message || err}`)
      throw err
    }
  })

  defineInvokeHandler(context, discordServiceDeployCloudRelay, async (payload) => {
    pushLog('DEPLOY', `Initiating Cloudflare Edge deployment for script "${payload.scriptName}"...`)
    try {
      const { CloudflareStageDeployer } = await import('@proj-airi/stage-edge/deployer')

      let targetAccountId = payload.accountId
      if (!targetAccountId) {
        pushLog('DEPLOY', 'Account ID missing from payload, resolving account memberships via Cloudflare API...')
        const tempDeployer = new CloudflareStageDeployer({
          apiToken: payload.apiToken,
          accountId: '',
        })
        const accounts = await tempDeployer.getAccounts()
        if (accounts.length > 0) {
          targetAccountId = accounts[0].id
          pushLog('DEPLOY', `Resolved Cloudflare Account: "${accounts[0].name}" (${targetAccountId})`)
        }
        else {
          throw new Error('No Cloudflare accounts found for this token.')
        }
      }

      const deployer = new CloudflareStageDeployer({
        apiToken: payload.apiToken,
        accountId: targetAccountId,
      })

      const res = await deployer.deployWorker({
        scriptName: payload.scriptName,
        characterPrompt: payload.characterPrompt,
        characterName: payload.characterName,
        llmBaseUrl: payload.llmBaseUrl,
        llmApiKey: payload.llmApiKey,
        llmModel: payload.llmModel,
        discordBotToken: payload.discordBotToken,
        memoryMode: payload.memoryMode,
      })

      pushLog('DEPLOY', `Deployment successful! Worker URL: ${res.workerUrl}`)
      return {
        success: true,
        workerUrl: res.workerUrl,
        namespaceId: res.namespaceId,
      }
    }
    catch (err: any) {
      pushLog('ERROR', `Cloudflare Edge deployment failed: ${err?.message || err}`)
      return {
        success: false,
        error: err?.message || String(err),
      }
    }
  })

  defineInvokeHandler(context, discordServiceGetStatus, async () => {
    return buildStatus()
  })

  // ── Outbound: Send assistant message to Discord ────────────────────────

  defineInvokeHandler(context, discordServiceSendMessage, async (payload) => {
    if (!discordClient?.isReady() || !payload?.channelId || !payload?.content)
      return

    try {
      const channel = await discordClient.channels.fetch(payload.channelId)
      if (channel?.isTextBased() && 'send' in channel && typeof (channel as any).send === 'function') {
        const chunks = chunkMessage(payload.content)
        for (const chunk of chunks) {
          await (channel as any).send(chunk)
        }
        pushLog('MESSAGE_SEND', `Sent ${chunks.length} chunk(s) to ${payload.channelId}`)
      }
    }
    catch (err: any) {
      pushLog('ERROR', `Failed to send message: ${err?.message}`)
    }
  })

  // ── Outbound: Send typing indicator to Discord ────────────────────────

  defineInvokeHandler(context, discordServiceSendTyping, async (payload) => {
    if (!discordClient?.isReady() || !payload?.channelId)
      return

    try {
      const channel = await discordClient.channels.fetch(payload.channelId)
      if (channel?.isTextBased() && 'sendTyping' in channel && typeof (channel as any).sendTyping === 'function') {
        await (channel as any).sendTyping()
        // We don't push log for typing to avoid spamming the debug console
      }
    }
    catch {
      // Ignore typing errors silently to avoid spam
    }
  })

  // ── Native IPC Bypass ───────────────────────────────────────────────────
  // We use native ipcMain.handle for images because the Eventa Context Bridge (WebSocket)
  // often has a 1MB payload limit that chokes on high-res base64 strings.
  // Electron's native IPC can handle hundreds of megabytes without breaking.
  ipcMain.handle('eventa:invoke:electron:discord:send-image', async (_event, payload: DiscordOutboundImage) => {
    // 0. Hard Terminal Log (Visible in the shell where AIRI started)
    console.log(`[DiscordService/Native] IPC Received Image. Size: ${Math.round((payload?.base64?.length || 0) / 1024)}KB, Shape: ${payload?.base64?.substring(0, 30)}...`)

    // 0. UI Receipt Log
    pushLog('IMAGE_PUSH', `IPC Received: Image Payload (${Math.round((payload?.base64?.length || 0) / 1024)}KB)`)

    if (!discordClient?.isReady() || !payload?.channelId || !payload?.base64) {
      pushLog('ERROR', `SendImage skipped: ClientReady=${discordClient?.isReady()}, Channel=${payload?.channelId}`)
      return { success: false, error: 'Client not ready or invalid payload' }
    }

    try {
      pushLog('IMAGE_PUSH', `Fetching channel ${payload.channelId}...`)
      const channel = await discordClient.channels.fetch(payload.channelId)

      if (channel?.isTextBased() && 'send' in channel && typeof (channel as any).send === 'function') {
        pushLog('IMAGE_PUSH', `Converting base64 buffer (${Math.round(payload.base64.length / 1024)}KB)...`)

        let base64Data = payload.base64
        if (base64Data.startsWith('data:')) {
          base64Data = base64Data.split(',')[1]
        }

        const buffer = Buffer.from(base64Data, 'base64')

        pushLog('IMAGE_PUSH', `Attempting Discord send to ${payload.channelId}...`)
        await (channel as any).send({
          content: payload.content || null,
          files: [{
            attachment: buffer,
            name: payload.filename || 'airi-manifestation.png',
          }],
        })
        pushLog('IMAGE_SEND', `Successfully sent image to ${payload.channelId} (Native Bypass)`)
        return { success: true }
      }
      else {
        pushLog('ERROR', `Channel ${payload.channelId} is not text-based or lacks send()`)
        return { success: false, error: 'Invalid channel type' }
      }
    }
    catch (err: any) {
      pushLog('ERROR', `Failed to send image: ${err?.message || 'Unknown Error'}`)
      console.error('[DiscordService/Native] sendImage Error:', err)
      return { success: false, error: err.message }
    }
  })

  function mergeAudioBuffers(buffers: Uint8Array[]): Buffer {
    if (buffers.length === 0) {
      return Buffer.alloc(0)
    }

    const firstBuf = buffers[0]
    const isWav = firstBuf.length >= 44
      && firstBuf[0] === 0x52 // 'R'
      && firstBuf[1] === 0x49 // 'I'
      && firstBuf[2] === 0x46 // 'F'
      && firstBuf[3] === 0x46 // 'F'

    if (!isWav) {
      return Buffer.concat(buffers.map(b => Buffer.from(b)))
    }

    const pcmChunks: Buffer[] = []
    let headerTemplate: Buffer | null = null

    for (const buf of buffers) {
      const buffer = Buffer.from(buf)
      let dataOffset = -1
      for (let i = 12; i < buffer.length - 8; i++) {
        if (buffer[i] === 0x64 && buffer[i + 1] === 0x61 && buffer[i + 2] === 0x74 && buffer[i + 3] === 0x61) {
          dataOffset = i
          break
        }
      }

      if (dataOffset === -1) {
        dataOffset = 40
      }

      const chunkDataSize = buffer.readUInt32LE(dataOffset + 4)
      const pcmStart = dataOffset + 8
      const pcmEnd = Math.min(pcmStart + chunkDataSize, buffer.length)
      const pcm = buffer.subarray(pcmStart, pcmEnd)
      pcmChunks.push(pcm)

      if (!headerTemplate) {
        headerTemplate = Buffer.alloc(pcmStart)
        buffer.copy(headerTemplate, 0, 0, pcmStart)
      }
    }

    if (!headerTemplate) {
      return Buffer.concat(buffers.map(b => Buffer.from(b)))
    }

    const totalPcm = Buffer.concat(pcmChunks)
    const riffSize = headerTemplate.length - 8 + totalPcm.length
    headerTemplate.writeUInt32LE(riffSize, 4)
    headerTemplate.writeUInt32LE(totalPcm.length, headerTemplate.length - 4)

    return Buffer.concat([headerTemplate, totalPcm])
  }

  ipcMain.handle('eventa:invoke:electron:discord:send-voice-note', async (_event, payload: { channelId: string, audioBuffers: Uint8Array[], content?: string, filename?: string }) => {
    // 0. Hard Terminal Log
    console.log(`[DiscordService/Native] IPC Received Voice Note. Chunks: ${payload?.audioBuffers?.length}, Total Chunks: ${payload?.audioBuffers?.length}`)

    if (!discordClient?.isReady() || !payload?.channelId || !payload?.audioBuffers || payload.audioBuffers.length === 0) {
      pushLog('ERROR', `SendVoiceNote skipped: ClientReady=${discordClient?.isReady()}, Channel=${payload?.channelId}, BufferCount=${payload?.audioBuffers?.length}`)
      return { success: false, error: 'Client not ready or empty buffers' }
    }

    try {
      pushLog('VOICE_PUSH', `Fetching channel ${payload.channelId} for voice note...`)
      const channel = await discordClient.channels.fetch(payload.channelId)

      if (channel?.isTextBased() && 'send' in channel && typeof (channel as any).send === 'function') {
        pushLog('VOICE_PUSH', `Merging ${payload.audioBuffers.length} audio chunks...`)

        const buffer = mergeAudioBuffers(payload.audioBuffers)
        const isWav = buffer.length >= 4
          && buffer[0] === 0x52
          && buffer[1] === 0x49
          && buffer[2] === 0x46
          && buffer[3] === 0x46

        let filename = payload.filename || `voice-note-${Date.now()}.mp3`
        if (isWav && filename.endsWith('.mp3')) {
          filename = filename.replace(/\.mp3$/, '.wav')
        }

        pushLog('VOICE_PUSH', `Attempting Discord send to ${payload.channelId} (Size: ${Math.round(buffer.length / 1024)}KB, Name: ${filename})...`)
        await (channel as any).send({
          content: payload.content || null,
          files: [{
            attachment: buffer,
            name: filename,
          }],
        })
        pushLog('VOICE_SEND', `Successfully sent voice note to ${payload.channelId} (Native Bypass)`)
        return { success: true }
      }
      else {
        pushLog('ERROR', `Channel ${payload.channelId} is not text-based or lacks send()`)
        return { success: false, error: 'Invalid channel type' }
      }
    }
    catch (err: any) {
      pushLog('ERROR', `Failed to send voice note: ${err?.message || 'Unknown Error'}`)
      console.error('[DiscordService/Native] sendVoiceNote Error:', err)
      return { success: false, error: err.message }
    }
  })

  // ── Force Sync: Push AIRI Card identity to Discord ─────────────────────

  defineInvokeHandler(context, discordServiceForceSync, async (payload) => {
    if (!discordClient?.isReady() || !discordClient.user)
      return

    try {
      const updates: any = {}
      if (payload?.name)
        updates.username = payload.name
      if (payload?.avatarBase64)
        updates.avatar = payload.avatarBase64

      if (Object.keys(updates).length > 0) {
        await discordClient.user.edit(updates)
        pushLog('FORCE_SYNC', `Updated bot profile: ${JSON.stringify(Object.keys(updates))}`)
      }
    }
    catch (err: any) {
      pushLog('ERROR', `Force sync failed: ${err?.message}`)
    }
  })

  // ── Simulate: Inject a mock inbound message ────────────────────────────

  defineInvokeHandler(context, discordServiceSimulateEvent, async (payload) => {
    const mock: DiscordInboundMessage = {
      messageId: `sim-${nanoid()}`,
      channelId: activeChannelId || 'simulated-channel',
      guildId: null,
      guildName: null,
      userId: 'simulated-user-001',
      username: payload?.username || 'TestUser',
      displayName: payload?.username || 'TestUser',
      content: payload?.content || 'Hello from simulated event!',
      attachments: [],
    }

    pushLog('SIMULATE', `Injected mock message from ${mock.username}: ${mock.content.substring(0, 60)}`)
    pushInboundMessage(mock)
  })

  // ── Registration: Slash Commands ───────────────────────────────────────

  defineInvokeHandler(context, discordServiceRegisterCommands, async (payload) => {
    if (!discordClient?.isReady() || !discordClient.application) {
      throw new Error('Discord client not ready for command registration')
    }

    try {
      pushLog('COMMAND_REG', `Registering ${payload.commands.length} global commands...`)
      await discordClient.application.commands.set(payload.commands)
      pushLog('COMMAND_REG', 'Commands registered successfully')
    }
    catch (err: any) {
      pushLog('ERROR', `Command registration failed: ${err.message}`)
      throw err
    }
  })

  defineInvokeHandler(context, discordServiceReplyInteraction, async (payload) => {
    const interaction = activeInteractions.get(payload.interactionId)
    if (!interaction) {
      pushLog('ERROR', `Cannot reply: Interaction ${payload.interactionId} not found or expired`)
      return
    }

    try {
      if (payload.followUp) {
        await interaction.followUp({
          content: payload.content,
          ephemeral: payload.ephemeral,
          components: payload.components,
        })
      }
      else {
        await interaction.editReply({
          content: payload.content,
          components: payload.components,
        })
      }
    }
    catch (err: any) {
      pushLog('ERROR', `Failed to reply to interaction: ${err.message}`)
    }
  })

  defineInvokeHandler(context, discordServiceSummon, async (payload) => {
    console.log('[DiscordService/Native] discordServiceSummon called with payload:', JSON.stringify(payload))
    if (!discordClient?.isReady()) {
      console.error('[DiscordService/Native] Summon failed: discordClient is not ready.')
      return { success: false, error: 'Discord bot client is not active/ready.' }
    }

    const userId = payload.userId
    let voiceChannel: any = null

    console.log(`[DiscordService/Native] Searching for userId=${userId} in cached guilds... Guild count: ${discordClient.guilds.cache.size}`)

    // Search for the user in any of the cached guild voice states
    for (const guild of discordClient.guilds.cache.values()) {
      const voiceState = guild.voiceStates.cache.get(userId)
      console.log(`[DiscordService/Native] Guild "${guild.name}" (${guild.id}): Voice state cached for user:`, !!voiceState)
      if (voiceState) {
        console.log(`[DiscordService/Native] Voice state details: channelId=${voiceState.channelId}`)
      }
      if (voiceState?.channel) {
        voiceChannel = voiceState.channel
        console.log(`[DiscordService/Native] Found user voice channel: "${voiceChannel.name}" in guild "${guild.name}"`)
        break
      }
    }

    if (!voiceChannel) {
      console.warn('[DiscordService/Native] Summon failed: User voice channel not found in cache.')
      return { success: false, error: 'You must be in a voice channel to summon me!' }
    }

    try {
      pushLog('VOICE', `Attempting to join voice channel: ${voiceChannel.name} in guild: ${voiceChannel.guild.name}`)
      console.log(`[DiscordService/Native] Calling joinVoiceChannel with channelId=${voiceChannel.id}, guildId=${voiceChannel.guild.id}`)

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      })

      console.log('[DiscordService/Native] joinVoiceChannel connection instance created:', !!connection)

      // Listen for voice connection state changes to handle auto-stop of Gemini session
      connection.on('stateChange', (oldState, newState) => {
        console.log(`[DiscordService/Voice] Connection state change: ${oldState.status} -> ${newState.status}`)
        if (newState.status === 'destroyed' || newState.status === 'disconnected') {
          console.log('[DiscordService/Voice] Voice channel disconnected or destroyed. Notifying renderer...')
          broadcastToAllWindows('discord-voice-disconnected', {})
        }
      })

      // Create an AudioPlayer for piping Gemini responses back into the voice channel
      activeAudioPlayer = new AudioPlayer()
      connection.subscribe(activeAudioPlayer)
      console.log('[DiscordService/Voice] AudioPlayer created and subscribed to voice connection.')

      activeAudioPlayer.on('error', (err) => {
        console.error('[DiscordService/Voice] AudioPlayer error:', err)
      })
      activeAudioPlayer.on(AudioPlayerStatus.Idle, () => {
        console.log('[DiscordService/Voice] AudioPlayer is idle (finished playing).')
      })

      // Set up speaking listeners on connection.receiver
      connection.receiver.speaking.on('start', (targetUserId) => {
        console.log(`[DiscordService/Voice] User speaking START: ${targetUserId}`)

        let username = targetUserId
        for (const guild of discordClient!.guilds.cache.values()) {
          const member = guild.members.cache.get(targetUserId)
          if (member) {
            username = member.user.tag
            break
          }
        }

        pushLog('VOICE_SPEAKING_START', `User ${username} started speaking`)

        try {
          const audioStream = connection.receiver.subscribe(targetUserId, {
            end: {
              behavior: EndBehaviorType.AfterSilence,
              duration: 100,
            },
          })

          console.log(`[DiscordService/Voice] ▶ Subscribed to Opus audio stream for ${username}.`)

          // Decode Opus → raw PCM (48kHz stereo 16-bit)
          const decoder = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 })
          audioStream.pipe(decoder)

          // Diagnostic: track decoder output
          let decoderChunkCount = 0
          let decoderTotalBytes = 0
          decoder.on('data', (chunk: Buffer) => {
            decoderChunkCount++
            decoderTotalBytes += chunk.length
            if (decoderChunkCount === 1) {
              console.log(`[DiscordService/Voice] 🎙️ Decoder first output chunk for ${username}: ${chunk.length} bytes`)
            }
          })

          // Path A: Write raw PCM to disk for debugging
          const timestamp = Date.now()
          const dir = '/tmp/airi-discord-voice'
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          const filePath = path.join(dir, `speaking_${targetUserId}_${timestamp}.pcm`)
          const writeStream = fs.createWriteStream(filePath)
          decoder.pipe(writeStream)
          console.log(`[DiscordService/Voice] 📄 Path A: Writing PCM to ${filePath}`)

          // Path B: Resample 48kHz stereo → 16kHz mono and forward to renderer via IPC (Pure JS)
          console.log(`[DiscordService/Voice] 🔀 Path B: Setting up pure JS 48kHz stereo → 16kHz mono downsampler...`)

          let ipcChunkCount = 0
          const classicAudioChunks: Buffer[] = []

          decoder.on('data', (chunk: Buffer) => {
            try {
              // 48kHz stereo 16-bit PCM to 16kHz mono 16-bit PCM.
              // 16-bit = 2 bytes. Stereo = 2 channels (4 bytes per frame).
              // Downsample factor = 3 (48kHz / 16kHz).
              const numFrames = Math.floor(chunk.length / 4)
              const outFrames = Math.floor(numFrames / 3)
              if (outFrames <= 0)
                return

              const resampledBuffer = Buffer.alloc(outFrames * 2) // 2 bytes per mono 16-bit sample

              for (let i = 0; i < outFrames; i++) {
                const byteOffset = i * 3 * 4 // Frame index i * 3 * 4 bytes per stereo frame
                const left = chunk.readInt16LE(byteOffset)
                const right = chunk.readInt16LE(byteOffset + 2)
                const monoValue = Math.round((left + right) / 2)
                resampledBuffer.writeInt16LE(monoValue, i * 2)
              }

              ipcChunkCount++
              classicAudioChunks.push(resampledBuffer)
              const base64 = resampledBuffer.toString('base64')
              if (ipcChunkCount === 1) {
                console.log(`[DiscordService/Voice] 📡 First resampled chunk for ${username}. Input: ${chunk.length} bytes -> Output: ${resampledBuffer.length} bytes. Sending to renderer...`)
              }
              broadcastToAllWindows('discord-audio-chunk', base64)
            }
            catch (err: any) {
              console.error(`[DiscordService/Voice] ❌ JS Downsampler error for ${username}:`, err.message)
            }
          })

          decoder.on('end', () => {
            console.log(`[DiscordService/Voice] ✅ Decoder ended for ${username}. Total decoder output: ${decoderChunkCount} chunks (${decoderTotalBytes} bytes). Total IPC chunks sent: ${ipcChunkCount}.`)
            pushLog('VOICE_RECORD_END', `Speech segment complete. Decoder: ${decoderChunkCount} chunks, IPC: ${ipcChunkCount} chunks`)
            broadcastToAllWindows('discord-audio-end', { userId: targetUserId })

            // Assemble complete PCM buffer and broadcast for classic STT
            const completePcmBuffer = Buffer.concat(classicAudioChunks)
            if (completePcmBuffer.length > 0) {
              console.log(`[DiscordService/Voice] 📣 Broadcasting complete speech buffer to renderer for Classic TTS: ${completePcmBuffer.length} bytes.`)
              broadcastToAllWindows('discord-classic-speech-captured', {
                userId: targetUserId,
                username,
                pcmBase64: completePcmBuffer.toString('base64'),
              })
            }
          })

          audioStream.on('end', () => {
            console.log(`[DiscordService/Voice] 📭 Opus stream ended for ${username}. Waiting for decoder to drain...`)
          })

          audioStream.on('error', (err) => {
            console.error(`[DiscordService/Voice] ❌ Audio stream error for ${username}:`, err)
          })
        }
        catch (err: any) {
          console.error(`[DiscordService/Voice] ❌ Failed to set up pipeline for ${username}:`, err)
        }
      })

      connection.receiver.speaking.on('end', (targetUserId) => {
        let username = targetUserId
        for (const guild of discordClient!.guilds.cache.values()) {
          const member = guild.members.cache.get(targetUserId)
          if (member) {
            username = member.user.tag
            break
          }
        }
        console.log(`[DiscordService/Voice] User speaking END: ${username}`)
      })

      pushLog('VOICE', `Successfully joined voice channel: ${voiceChannel.name}`)
      return { success: true, channelName: voiceChannel.name }
    }
    catch (err: any) {
      console.error('[DiscordService/Native] Error joining voice channel:', err)
      pushLog('ERROR', `Failed to join voice channel: ${err.message || err}`)
      return { success: false, error: err.message || String(err) }
    }
  })

  defineInvokeHandler(context, discordServiceLeave, async (payload) => {
    if (!discordClient?.isReady()) {
      return { success: false, error: 'Discord bot client is not active/ready.' }
    }

    const targetGuildId = (payload as any)?.guildId
    try {
      if (targetGuildId) {
        const connection = getVoiceConnection(targetGuildId)
        if (connection) {
          connection.destroy()
          pushLog('VOICE', `Disconnected from voice channel in guild ${targetGuildId}`)
          return { success: true }
        }
      }
      else {
        let disconnectedCount = 0
        for (const guild of discordClient.guilds.cache.values()) {
          const connection = getVoiceConnection(guild.id)
          if (connection) {
            connection.destroy()
            disconnectedCount++
          }
        }
        pushLog('VOICE', `Disconnected from all voice channels (${disconnectedCount} channel(s))`)
        return { success: true }
      }
      return { success: false, error: 'No active voice connection found.' }
    }
    catch (err: any) {
      pushLog('ERROR', `Failed to disconnect from voice channel: ${err.message || err}`)
      return { success: false, error: err.message || String(err) }
    }
  })

  // ── Gemini Audio Bridge: Renderer → Discord Voice ────────────────────────
  // Receives 24kHz mono PCM16 base64 chunks from the renderer (Gemini Live output),
  // upsamples them to 48kHz stereo in pure JS, and plays them via the AudioPlayer.

  ipcMain.on('gemini-audio-chunk', (_event, base64Pcm: string) => {
    if (!activeAudioPlayer) {
      console.warn('[DiscordService/Voice] Received gemini-audio-chunk but no active AudioPlayer.')
      return
    }

    try {
      const pcmBuffer = Buffer.from(base64Pcm, 'base64')

      // If there's no active passthrough stream, create one and start playing
      if (!activeAudioPassthrough) {
        activeAudioPassthrough = new PassThrough()
        console.log('[DiscordService/Voice] 🔊 Created new PassThrough for Gemini audio playback.')

        const resource = createAudioResource(activeAudioPassthrough, {
          inputType: StreamType.Raw,
        })

        activeAudioPlayer.play(resource)
        console.log('[DiscordService/Voice] 🎵 AudioPlayer playing raw stream.')
      }

      // Upsample: 24kHz mono (1 sample = 2 bytes) → 48kHz stereo (4 samples = 8 bytes)
      const numSamples = Math.floor(pcmBuffer.length / 2)
      const upsampledBuffer = Buffer.alloc(numSamples * 8)

      for (let i = 0; i < numSamples; i++) {
        const val = pcmBuffer.readInt16LE(i * 2)
        const offset = i * 8
        // Sample 1 (Left and Right)
        upsampledBuffer.writeInt16LE(val, offset)
        upsampledBuffer.writeInt16LE(val, offset + 2)
        // Sample 2 (Left and Right) - repeat to double rate from 24kHz to 48kHz
        upsampledBuffer.writeInt16LE(val, offset + 4)
        upsampledBuffer.writeInt16LE(val, offset + 6)
      }

      // Write upsampled 48kHz stereo buffer directly to the player's input stream
      activeAudioPassthrough.write(upsampledBuffer)
    }
    catch (err: any) {
      console.error('[DiscordService/Voice] ❌ Error handling gemini-audio-chunk:', err.message)
    }
  })

  ipcMain.on('gemini-audio-end', () => {
    console.log('[DiscordService/Voice] Received gemini-audio-end. Finalizing audio stream.')
    if (activeAudioPassthrough) {
      activeAudioPassthrough.end()
      activeAudioPassthrough = null
    }
  })

  log.log('Discord service handlers registered')
}
