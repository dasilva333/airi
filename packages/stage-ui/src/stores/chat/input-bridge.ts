export const CHAT_INPUT_BRIDGE_CHANNEL = 'airi-chat-input-bridge'
export const INGESTION_TIMEOUT_MS = 5000

export interface ChatInputBridgeStopPayload {
  type: 'stop'
  targetSessionId?: string
}

export interface ChatInputBridgeMessagePayload {
  type?: 'message'
  sendingMessage?: string
  options?: Record<string, any>
  targetSessionId?: string
}

export type ChatInputBridgePayload = ChatInputBridgeStopPayload | ChatInputBridgeMessagePayload

/**
 * Ensures payload is safely serializable for BroadcastChannel structured cloning.
 * Recursively strips non-serializable values (functions, symbols) and converts
 * non-plain objects where necessary. Throws descriptive error if JSON serialization fails.
 */
export function serializeBridgePayload<T extends ChatInputBridgePayload>(payload: T): T {
  try {
    return JSON.parse(JSON.stringify(payload)) as T
  }
  catch (err) {
    console.error('[ChatInputBridge] Failed to serialize bridge payload:', err)
    throw new Error('Failed to prepare message for the main window (payload not serializable).')
  }
}

/**
 * Builds a structured stop command payload to broadcast to the main stage window.
 */
export function buildBridgeStopPayload(targetSessionId?: string): ChatInputBridgeStopPayload {
  return {
    type: 'stop',
    targetSessionId,
  }
}

/**
 * Builds a sanitized, cloneable message payload for cross-window ingestion.
 * Ensures clientMessageId is injected into options.metadata for echo verification.
 */
export function buildBridgeMessagePayload(
  sendingMessage: string,
  options: Record<string, any> = {},
  targetSessionId?: string,
  clientMessageId?: string,
): ChatInputBridgeMessagePayload {
  const metadata = {
    ...(options.metadata && typeof options.metadata === 'object' ? options.metadata : {}),
    ...(clientMessageId ? { clientMessageId } : {}),
  }

  const cleanOptions: Record<string, any> = {
    ...options,
    chatProvider: typeof options.chatProvider === 'string'
      ? options.chatProvider
      : (typeof options.chatProvider === 'object' && options.chatProvider !== null && 'id' in (options.chatProvider as any))
          ? (options.chatProvider as any).id
          : undefined,
    tools: undefined, // Tools cannot be serialized across BroadcastChannel and are resolved in main window
  }

  if (Object.keys(metadata).length > 0) {
    cleanOptions.metadata = metadata
  }

  return {
    sendingMessage,
    options: cleanOptions,
    targetSessionId,
  }
}

/**
 * Evaluates whether a session message corresponds to the client-generated message ID echo.
 * Checks both direct top-level property and nested metadata.
 */
export function matchesClientEcho(message: unknown, clientMessageId: string): boolean {
  if (!message || typeof message !== 'object' || !clientMessageId) {
    return false
  }

  const msg = message as Record<string, any>
  const directId = msg.clientMessageId
  const metadataId = msg.metadata?.clientMessageId

  return directId === clientMessageId || metadataId === clientMessageId
}

/**
 * Determines whether the secondary window should bypass the 5-second echo verification loop.
 */
export function shouldBypassVerificationLoop(options?: Record<string, any>): boolean {
  return Boolean(options?.triggerOnly)
}

export type BridgeInboundAction
  = | { action: 'stop', targetSessionId?: string }
    | { action: 'ignore', reason: string }
    | {
      action: 'ingest'
      shouldSwitchSession: boolean
      targetSessionId?: string
      sendingMessage: string
      options?: Record<string, any>
    }

/**
 * Evaluates an inbound broadcast message received by the main window and determines the execution plan.
 */
export function evaluateBridgeInboundAction(
  payload: unknown,
  activeSessionId?: string,
): BridgeInboundAction {
  if (!payload || typeof payload !== 'object') {
    return { action: 'ignore', reason: 'empty_or_invalid_payload' }
  }

  const p = payload as Record<string, any>

  if (p.type === 'stop') {
    return {
      action: 'stop',
      targetSessionId: p.targetSessionId,
    }
  }

  const sendingMessage = typeof p.sendingMessage === 'string' ? p.sendingMessage : ''
  const isTriggerOnly = Boolean(p.options?.triggerOnly)
  const hasAttachments = Array.isArray(p.options?.attachments) && p.options.attachments.length > 0

  if (!sendingMessage && !isTriggerOnly && !hasAttachments) {
    return { action: 'ignore', reason: 'empty_message_without_trigger_or_attachments' }
  }

  const targetSessionId = p.targetSessionId
  const shouldSwitchSession = Boolean(targetSessionId && targetSessionId !== activeSessionId)

  return {
    action: 'ingest',
    shouldSwitchSession,
    targetSessionId,
    sendingMessage,
    options: p.options,
  }
}
