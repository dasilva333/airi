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

  // NOTICE: Intentional normalization behavior: In addition to string-valued chatProvider,
  // we also extract and forward .id from provider account objects if and only if .id is a non-empty string.
  // Missing, numeric, boolean, or object-valued IDs are normalized to undefined.
  const cleanOptions: Record<string, any> = {
    ...options,
    chatProvider: typeof options.chatProvider === 'string'
      ? options.chatProvider
      : (typeof options.chatProvider === 'object'
        && options.chatProvider !== null
        && typeof (options.chatProvider as any).id === 'string'
        && (options.chatProvider as any).id.trim().length > 0)
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
 * Top-level clientMessageId takes strict precedence over nested metadata.clientMessageId.
 */
export function matchesClientEcho(message: unknown, clientMessageId: string): boolean {
  if (!message || typeof message !== 'object' || !clientMessageId) {
    return false
  }

  const msg = message as Record<string, any>
  const effectiveId = msg.clientMessageId || msg.metadata?.clientMessageId

  return effectiveId === clientMessageId
}

export interface BridgedAcknowledgmentOptions {
  clientMessageId: string
  timeoutMs?: number
  getSessionMessages: () => unknown[]
  watchMessages: (getter: () => unknown[], callback: (messages: unknown[]) => void) => () => void
  postPayload: () => void
}

/**
 * Coordinates the secondary-window ingestion acknowledgment lifecycle:
 * 1. Sets a timeout (default INGESTION_TIMEOUT_MS) to reject if the main window never acknowledges.
 * 2. Watches session messages for an echo matching clientMessageId.
 * 3. Immediately cleans up (clearing timer and unwatching) upon successful echo.
 * 4. Wraps postPayload in try/catch to guarantee immediate cleanup and rejection if serialization or transport fails.
 */
export function createBridgedIngestionAcknowledgment(options: BridgedAcknowledgmentOptions): Promise<void> {
  const {
    clientMessageId,
    timeoutMs = INGESTION_TIMEOUT_MS,
    getSessionMessages,
    watchMessages,
    postPayload,
  } = options

  return new Promise<void>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let stopWatch: (() => void) | null = null
    let isSettled = false

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (stopWatch !== null) {
        stopWatch()
        stopWatch = null
      }
    }

    timeoutId = setTimeout(() => {
      if (isSettled) {
        return
      }
      isSettled = true
      cleanup()
      console.error(`[IngestDebug] TIMEOUT waiting for clientMessageId: ${clientMessageId}`)
      reject(new Error('Ingestion timeout: main process did not acknowledge the message.'))
    }, timeoutMs)

    const unwatch = watchMessages(
      () => getSessionMessages(),
      (messages) => {
        if (isSettled || !Array.isArray(messages)) {
          return
        }
        const found = messages.some(m => matchesClientEcho(m, clientMessageId))
        if (found) {
          isSettled = true
          cleanup()
          resolve()
        }
      },
    )
    stopWatch = unwatch
    if (isSettled) {
      cleanup()
    }

    try {
      postPayload()
    }
    catch (err) {
      if (!isSettled) {
        isSettled = true
        cleanup()
        reject(err)
      }
    }
  })
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
