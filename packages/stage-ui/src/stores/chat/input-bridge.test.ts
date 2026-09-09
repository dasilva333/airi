import { describe, expect, it } from 'vitest'

import {
  buildBridgeMessagePayload,
  buildBridgeStopPayload,
  CHAT_INPUT_BRIDGE_CHANNEL,
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

    it('maps object chatProvider with id property to string provider ID', () => {
      const options = {
        chatProvider: { id: 'anthropic-provider', client: {} },
      }
      const payload = buildBridgeMessagePayload('Hello', options, 'sess-1')
      expect(payload.options?.chatProvider).toBe('anthropic-provider')
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

    it('matches when clientMessageId is nested within metadata', () => {
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
})
