import { defineEventa, defineInvokeEventa } from '@moeru/eventa'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DiscordGuildInfo {
  id: string
  name: string
  icon: string | null
}

export interface DiscordServiceStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'error'
  ping: number | null
  guilds: DiscordGuildInfo[]
  activeChannelId: string | null
  botUser: { id: string, tag: string, avatarUrl: string | null } | null
  error: string | null
}

export interface DiscordEventLogEntry {
  timestamp: number
  type: string
  summary: string
}

export interface DiscordInboundMessage {
  messageId: string
  channelId: string
  guildId: string | null
  guildName: string | null
  userId: string
  username: string
  displayName: string
  content: string
  /** If the user attached images, base64-encoded data URIs */
  attachments: string[]
}

export interface DiscordOutboundMessage {
  channelId: string
  content: string
}

export interface DiscordForceSyncPayload {
  name: string
  avatarBase64: string | null
}

export interface DiscordSimulatePayload {
  username: string
  content: string
}

export interface DiscordCommandOption {
  type: number // 3 for string, 4 for integer, etc.
  name: string
  description: string
  required?: boolean
  choices?: Array<{ name: string, value: string | number }>
  autocomplete?: boolean
}

export interface DiscordCommandDefinition {
  name: string
  description: string
  options?: DiscordCommandOption[]
}

/** Payload for interaction events from Main to Renderer */
export interface DiscordInteractionPayload {
  interactionId: string
  commandName: string
  options: Record<string, any>
  channelId: string
  userId: string
  username: string
  guildId?: string | null
}

/** Payload for replying to an interaction from Renderer to Main */
export interface DiscordInteractionReplyPayload {
  interactionId: string
  content: string
  /** If true, sends as a follow-up if the initial reply was already sent */
  followUp?: boolean
  /** If true, only visible to the user who triggered it */
  ephemeral?: boolean
  /** Optional Discord message components (buttons, select menus, action rows) */
  components?: any[]
}

// ── Invoke Contracts (Renderer → Main) ─────────────────────────────────────────

/** Start the Discord service with the stored bot token. */
export const discordServiceStart = defineInvokeEventa<DiscordServiceStatus, { token: string }>(
  'eventa:invoke:electron:discord:start',
)

/** Stop the Discord service and disconnect the bot. */
export const discordServiceStop = defineInvokeEventa<DiscordServiceStatus>(
  'eventa:invoke:electron:discord:stop',
)

/** Trigger native Cloudflare OAuth PKCE login flow. */
export const discordServiceCloudflareOAuth = defineInvokeEventa<{ accessToken: string, refreshToken: string, expiresIn: number, accountId?: string }>(
  'eventa:invoke:electron:discord:cf-oauth',
)

/** Poll the current service status (connection, ping, guilds). */
export const discordServiceGetStatus = defineInvokeEventa<DiscordServiceStatus>(
  'eventa:invoke:electron:discord:get-status',
)

/** Push the current AIRI Card identity (name/avatar) to the Discord bot profile. */
export const discordServiceForceSync = defineInvokeEventa<void, DiscordForceSyncPayload>(
  'eventa:invoke:electron:discord:force-sync',
)

/** Inject a mock inbound message to test the full pipeline. */
export const discordServiceSimulateEvent = defineInvokeEventa<void, DiscordSimulatePayload>(
  'eventa:invoke:electron:discord:simulate-event',
)

/** Send a message from the assistant to a Discord channel. */
export const discordServiceSendMessage = defineInvokeEventa<void, DiscordOutboundMessage>(
  'eventa:invoke:electron:discord:send-message',
)

/** Send a typing indicator to a Discord channel. */
export const discordServiceSendTyping = defineInvokeEventa<void, { channelId: string }>(
  'eventa:invoke:electron:discord:send-typing',
)

/** Register global slash commands with the Discord API. */
export const discordServiceRegisterCommands = defineInvokeEventa<void, { commands: DiscordCommandDefinition[] }>(
  'eventa:invoke:electron:discord:register-commands',
)

/** Reply to a deferred interaction. */
export const discordServiceReplyInteraction = defineInvokeEventa<void, DiscordInteractionReplyPayload>(
  'eventa:invoke:electron:discord:reply-interaction',
)

/** Summon the bot to join the voice channel of the calling user. */
export const discordServiceSummon = defineInvokeEventa<{ success: boolean, channelName?: string, error?: string }, { userId: string }>(
  'eventa:invoke:electron:discord:summon',
)

/** Disconnect the bot from the current voice channel. */
export const discordServiceLeave = defineInvokeEventa<{ success: boolean, error?: string }, { guildId?: string } | void>(
  'eventa:invoke:electron:discord:leave',
)

export interface CloudRelayDeployPayload {
  apiToken: string
  accountId: string
  scriptName: string
  characterPrompt: string
  geminiApiKey: string
  geminiModel?: string
  discordBotToken?: string
  memoryMode?: 'fixed' | 'unlimited'
}

export interface CloudRelayDeployResult {
  success: boolean
  workerUrl?: string
  namespaceId?: string
  error?: string
}

export const discordServiceDeployCloudRelay = defineInvokeEventa<CloudRelayDeployResult, CloudRelayDeployPayload>(
  'eventa:invoke:electron:discord:deploy-cloud-relay',
)

export interface DiscordOutboundImage {
  channelId: string
  content?: string
  base64: string
  filename?: string
}

/** Send an image (base64) from the assistant to a Discord channel. */
export const discordServiceSendImage = defineInvokeEventa<void, DiscordOutboundImage>(
  'eventa:invoke:electron:discord:send-image',
)

// ── Event Contracts (Main → Renderer, push-based) ──────────────────────────────

/** Emitted when the service connection state changes. */
export const discordServiceStatusChanged = defineEventa<DiscordServiceStatus>(
  'eventa:event:electron:discord:status-changed',
)

/** Raw event log entries for the Developer Console. */
export const discordServiceEventLog = defineEventa<DiscordEventLogEntry>(
  'eventa:event:electron:discord:event-log',
)

/** A Discord user sent a message that should be routed to the chat pipeline. */
export const discordServiceInboundMessage = defineEventa<DiscordInboundMessage>(
  'eventa:event:electron:discord:inbound-message',
)

/** Emitted when a slash command interaction is triggered. */
export const discordServiceInteraction = defineEventa<DiscordInteractionPayload>(
  'eventa:event:electron:discord:interaction',
)
