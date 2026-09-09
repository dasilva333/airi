import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildBridgeMessagePayload,
  buildBridgeStopPayload,
  CHAT_INPUT_BRIDGE_CHANNEL,
  createBridgedIngestionAcknowledgment,
  evaluateBridgeInboundAction,
  INGESTION_TIMEOUT_MS,
  matchesClientEcho,
  serializeBridgePayload,
  shouldBypassVerificationLoop,
} from './input-bridge'

describe('chat input-bridge seams', () => {
  describe('constants', () => {
    it('defines the canonical broadcast channel name', () => {
      expect(CHAT_INPUT_BRIDGE_CHANNEL).toBe('airi-chat-input-bridge')
    })

    it('defines standard 5-second ingestion verification timeout', () => {
      expect(INGESTION_TIMEOUT_MS).toBe(5000)
    })
  })

  describe('serializeBridgePayload', () => {
    it('serializes and clones valid message payload', () => {
      const payload = {
        sendingMessage: 'Hello from secondary window',
        options: { model: 'gpt-4o' },
        targetSessionId: 'sess-123',
      }

      const serialized = serializeBridgePayload(payload)
      expect(serialized).toEqual(payload)
      expect(serialized).not.toBe(payload) // Must be a clone
    })

    it('strips non-serializable functions from options', () => {
      const payload = {
        sendingMessage: 'Test',
        options: {
          validData: 'ok',
          callback: () => 'forbidden',
        },
      }

      const serialized = serializeBridgePayload(payload as any)
      expect(serialized.options?.validData).toBe('ok')
      expect((serialized.options as any)?.callback).toBeUndefined()
    })

    it('throws friendly error when payload has circular references', () => {
      const circular: any = { sendingMessage: 'Loop' }
      circular.self = circular

      expect(() => serializeBridgePayload(circular)).toThrow(
        'Failed to prepare message for the main window (payload not serializable).',
      )
    })
  })

  describe('buildBridgeStopPayload', () => {
    it('creates stop payload with targetSessionId', () => {
      const payload = buildBridgeStopPayload('session-42')
      expect(payload).toEqual({
        type: 'stop',
        targetSessionId: 'session-42',
      })
    })

    it('creates stop payload when targetSessionId is omitted', () => {
      const payload = buildBridgeStopPayload()
      expect(payload).toEqual({
        type: 'stop',
        targetSessionId: undefined,
      })
    })
  })

  describe('buildBridgeMessagePayload', () => {
    it('injects clientMessageId into metadata', () => {
      const payload = buildBridgeMessagePayload('Hello', {}, 'sess-1', 'client-msg-99')
      expect(payload.sendingMessage).toBe('Hello')
      expect(payload.targetSessionId).toBe('sess-1')
      expect(payload.options?.metadata).toEqual({
        clientMessageId: 'client-msg-99',
      })
    })

    it('preserves existing metadata fields alongside clientMessageId', () => {
      const options = {
        metadata: { source: 'desktop-chatbox', timestamp: 12345 },
      }
      const payload = buildBridgeMessagePayload('Hello', options, 'sess-1', 'client-msg-99')
      expect(payload.options?.metadata).toEqual({
        source: 'desktop-chatbox',
        timestamp: 12345,
        clientMessageId: 'client-msg-99',
      })
    })

    it('strips tools from options to prevent BroadcastChannel clone errors', () => {
      const options = {
        tools: [{ type: 'function', execute: () => {} }],
        model: 'claude-3-5-sonnet',
      }
      const payload = buildBridgeMessagePayload('Hello', options, 'sess-1')
      expect(payload.options?.tools).toBeUndefined()
      expect(payload.options?.model).toBe('claude-3-5-sonnet')
    })

    it('maps object chatProvider with string id property to string provider ID', () => {
      const options = {
        chatProvider: { id: 'anthropic-provider', client: {} },
      }
      const payload = buildBridgeMessagePayload('Hello', options, 'sess-1')
      expect(payload.options?.chatProvider).toBe('anthropic-provider')
    })

    it('normalizes non-string or missing chatProvider IDs to undefined', () => {
      // Numeric id
      expect(buildBridgeMessagePayload('Hello', { chatProvider: { id: 123 } }).options?.chatProvider).toBeUndefined()
      // Object-valued id
      expect(buildBridgeMessagePayload('Hello', { chatProvider: { id: { name: 'nested' } } }).options?.chatProvider).toBeUndefined()
      // Whitespace or empty string id
      expect(buildBridgeMessagePayload('Hello', { chatProvider: { id: '   ' } }).options?.chatProvider).toBeUndefined()
      // Missing id
      expect(buildBridgeMessagePayload('Hello', { chatProvider: { name: 'no-id' } }).options?.chatProvider).toBeUndefined()
      // Null / boolean provider
      expect(buildBridgeMessagePayload('Hello', { chatProvider: null }).options?.chatProvider).toBeUndefined()
      expect(buildBridgeMessagePayload('Hello', { chatProvider: true }).options?.chatProvider).toBeUndefined()
    })

    it('preserves string chatProvider', () => {
      const options = {
        chatProvider: 'openai',
      }
      const payload = buildBridgeMessagePayload('Hello', options, 'sess-1')
      expect(payload.options?.chatProvider).toBe('openai')
    })
  })

  describe('matchesClientEcho', () => {
    it('matches when clientMessageId is at the top-level of message', () => {
      const message = {
        id: 'msg-1',
        role: 'user',
        content: 'Hi',
        clientMessageId: 'cmid-abc-123',
      }
      expect(matchesClientEcho(message, 'cmid-abc-123')).toBe(true)
    })

    it('matches when clientMessageId is nested within metadata and top-level is absent', () => {
      const message = {
        id: 'msg-2',
        role: 'user',
        content: 'Hi',
        metadata: {
          clientMessageId: 'cmid-xyz-789',
        },
      }
      expect(matchesClientEcho(message, 'cmid-xyz-789')).toBe(true)
    })

    it('enforces top-level precedence over nested metadata when IDs conflict', () => {
      const message = {
        id: 'msg-conflict',
        role: 'user',
        content: 'Conflict test',
        clientMessageId: 'top-priority-id',
        metadata: {
          clientMessageId: 'nested-secondary-id',
        },
      }
      // Top-level must match
      expect(matchesClientEcho(message, 'top-priority-id')).toBe(true)
      // Nested metadata must NOT match because top-level takes strict precedence
      expect(matchesClientEcho(message, 'nested-secondary-id')).toBe(false)
    })

    it('returns false when clientMessageId does not match', () => {
      const message = {
        id: 'msg-3',
        role: 'user',
        clientMessageId: 'other-id',
      }
      expect(matchesClientEcho(message, 'expected-id')).toBe(false)
    })

    it('returns false when message has no clientMessageId', () => {
      const message = {
        id: 'msg-4',
        role: 'user',
        content: 'No client id',
      }
      expect(matchesClientEcho(message, 'expected-id')).toBe(false)
    })

    it('returns false for null, undefined, or empty clientMessageId', () => {
      expect(matchesClientEcho(null, 'id-1')).toBe(false)
      expect(matchesClientEcho(undefined, 'id-1')).toBe(false)
      expect(matchesClientEcho({ clientMessageId: 'id-1' }, '')).toBe(false)
      expect(matchesClientEcho('not an object', 'id-1')).toBe(false)
    })
  })

  describe('shouldBypassVerificationLoop', () => {
    it('returns true when triggerOnly is true', () => {
      expect(shouldBypassVerificationLoop({ triggerOnly: true })).toBe(true)
    })

    it('returns false when triggerOnly is false, missing, or options undefined', () => {
      expect(shouldBypassVerificationLoop({ triggerOnly: false })).toBe(false)
      expect(shouldBypassVerificationLoop({})).toBe(false)
      expect(shouldBypassVerificationLoop(undefined)).toBe(false)
    })
  })

  describe('evaluateBridgeInboundAction', () => {
    it('returns ignore for null, undefined, or primitive payload', () => {
      expect(evaluateBridgeInboundAction(null)).toEqual({
        action: 'ignore',
        reason: 'empty_or_invalid_payload',
      })
      expect(evaluateBridgeInboundAction(undefined)).toEqual({
        action: 'ignore',
        reason: 'empty_or_invalid_payload',
      })
      expect(evaluateBridgeInboundAction('string')).toEqual({
        action: 'ignore',
        reason: 'empty_or_invalid_payload',
      })
    })

    it('evaluates stop payload with targetSessionId', () => {
      const result = evaluateBridgeInboundAction({
        type: 'stop',
        targetSessionId: 'sess-active',
      })
      expect(result).toEqual({
        action: 'stop',
        targetSessionId: 'sess-active',
      })
    })

    it('ignores empty message payload when no attachments or triggerOnly', () => {
      const result = evaluateBridgeInboundAction({
        sendingMessage: '',
        options: {},
      })
      expect(result).toEqual({
        action: 'ignore',
        reason: 'empty_message_without_trigger_or_attachments',
      })
    })

    it('evaluates normal message and detects when session switch is needed', () => {
      const payload = {
        sendingMessage: 'Tell me a story',
        targetSessionId: 'sess-new',
        options: { model: 'gpt-4o' },
      }

      // Active session in main window is sess-old; target is sess-new -> switch required
      const result = evaluateBridgeInboundAction(payload, 'sess-old')
      expect(result).toEqual({
        action: 'ingest',
        shouldSwitchSession: true,
        targetSessionId: 'sess-new',
        sendingMessage: 'Tell me a story',
        options: { model: 'gpt-4o' },
      })
    })

    it('evaluates normal message and preserves session when already aligned', () => {
      const payload = {
        sendingMessage: 'Keep going',
        targetSessionId: 'sess-same',
        options: {},
      }

      // Active session matches target -> no switch required
      const result = evaluateBridgeInboundAction(payload, 'sess-same')
      expect(result).toEqual({
        action: 'ingest',
        shouldSwitchSession: false,
        targetSessionId: 'sess-same',
        sendingMessage: 'Keep going',
        options: {},
      })
    })

    it('allows empty message when triggerOnly is true', () => {
      const payload = {
        sendingMessage: '',
        options: { triggerOnly: true },
        targetSessionId: 'sess-1',
      }
      const result = evaluateBridgeInboundAction(payload, 'sess-1')
      expect(result.action).toBe('ingest')
    })

    it('allows empty message when attachments are present', () => {
      const payload = {
        sendingMessage: '',
        options: { attachments: [{ type: 'image', url: 'blob:test' }] },
        targetSessionId: 'sess-1',
      }
      const result = evaluateBridgeInboundAction(payload, 'sess-1')
      expect(result.action).toBe('ingest')
    })
  })

  describe('createBridgedIngestionAcknowledgment', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.restoreAllMocks()
      vi.useRealTimers()
    })

    it('resolves and cleans up watcher and timer when matching echo is detected', async () => {
      let watcherCb: ((msgs: unknown[]) => void) | null = null
      const unwatchSpy = vi.fn()
      const postSpy = vi.fn()

      const ackPromise = createBridgedIngestionAcknowledgment({
        clientMessageId: 'cmid-target',
        getSessionMessages: () => [],
        watchMessages: (_getter, cb) => {
          watcherCb = cb
          return unwatchSpy
        },
        postPayload: postSpy,
      })

      expect(postSpy).toHaveBeenCalledOnce()
      expect(unwatchSpy).not.toHaveBeenCalled()

      // Simulate matching message appearing in history
      watcherCb!([{ id: 'msg-1', clientMessageId: 'cmid-target', role: 'user' }])

      await expect(ackPromise).resolves.toBeUndefined()
      expect(unwatchSpy).toHaveBeenCalledOnce()

      // Advancing timer past 5s should not trigger timeout or error
      vi.advanceTimersByTime(6000)
    })

    it('resolves immediately and cleans up if matching echo is present on initial watch trigger', async () => {
      const unwatchSpy = vi.fn()
      const postSpy = vi.fn()

      const ackPromise = createBridgedIngestionAcknowledgment({
        clientMessageId: 'cmid-existing',
        getSessionMessages: () => [{ id: 'msg-existing', clientMessageId: 'cmid-existing', role: 'user' }],
        watchMessages: (getter, cb) => {
          // Immediately trigger callback like watch with { immediate: true }
          cb(getter())
          return unwatchSpy
        },
        postPayload: postSpy,
      })

      await expect(ackPromise).resolves.toBeUndefined()
      expect(unwatchSpy).toHaveBeenCalledOnce()
      expect(postSpy).toHaveBeenCalledOnce()
    })

    it('rejects with timeout error and cleans up both watcher and timer after timeoutMs', async () => {
      const unwatchSpy = vi.fn()
      const postSpy = vi.fn()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const ackPromise = createBridgedIngestionAcknowledgment({
        clientMessageId: 'cmid-lost',
        timeoutMs: 5000,
        getSessionMessages: () => [],
        watchMessages: (_getter, _cb) => unwatchSpy,
        postPayload: postSpy,
      })

      expect(postSpy).toHaveBeenCalledOnce()
      expect(unwatchSpy).not.toHaveBeenCalled()

      // Advance time to trigger timeout
      vi.advanceTimersByTime(5000)

      await expect(ackPromise).rejects.toThrow('Ingestion timeout: main process did not acknowledge the message.')
      expect(unwatchSpy).toHaveBeenCalledOnce()
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('cmid-lost'))
    })

    it('immediately cleans up watcher and timer and rejects with original error when postPayload throws', async () => {
      const unwatchSpy = vi.fn()
      const postError = new Error('Payload not serializable')
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const ackPromise = createBridgedIngestionAcknowledgment({
        clientMessageId: 'cmid-fail',
        timeoutMs: 5000,
        getSessionMessages: () => [],
        watchMessages: (_getter, _cb) => unwatchSpy,
        postPayload: () => {
          throw postError
        },
      })

      // Must reject immediately with the original error
      await expect(ackPromise).rejects.toThrow('Payload not serializable')
      // Watcher must be cleaned up immediately
      expect(unwatchSpy).toHaveBeenCalledOnce()

      // Advancing timer must NOT trigger secondary timeout
      vi.advanceTimersByTime(6000)
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('cleans up immediately when transport throws a network error', async () => {
      const unwatchSpy = vi.fn()
      const transportError = new Error('BroadcastChannel closed')

      const ackPromise = createBridgedIngestionAcknowledgment({
        clientMessageId: 'cmid-channel-closed',
        timeoutMs: 5000,
        getSessionMessages: () => [],
        watchMessages: (_getter, _cb) => unwatchSpy,
        postPayload: () => {
          throw transportError
        },
      })

      await expect(ackPromise).rejects.toThrow('BroadcastChannel closed')
      expect(unwatchSpy).toHaveBeenCalledOnce()
    })

    it('ignores non-matching messages and keeps waiting until match or timeout', async () => {
      let watcherCb: ((msgs: unknown[]) => void) | null = null
      const unwatchSpy = vi.fn()

      const ackPromise = createBridgedIngestionAcknowledgment({
        clientMessageId: 'cmid-target',
        timeoutMs: 5000,
        getSessionMessages: () => [],
        watchMessages: (_getter, cb) => {
          watcherCb = cb
          return unwatchSpy
        },
        postPayload: vi.fn(),
      })

      // Send unrelated message
      watcherCb!([{ id: 'msg-other', clientMessageId: 'cmid-unrelated', role: 'user' }])
      expect(unwatchSpy).not.toHaveBeenCalled()

      // Now send matching message
      watcherCb!([
        { id: 'msg-other', clientMessageId: 'cmid-unrelated', role: 'user' },
        { id: 'msg-matched', metadata: { clientMessageId: 'cmid-target' }, role: 'user' },
      ])

      await expect(ackPromise).resolves.toBeUndefined()
      expect(unwatchSpy).toHaveBeenCalledOnce()
    })
  })
})
