import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import type { ChatHistoryItem } from '../../../types/chat'

import { getChatHistoryItemKey } from './message-key'

describe('getChatHistoryItemKey', () => {
  it('prefers stable message ids when available', () => {
    const createdAt = 1700000000000

    const userMessage: ChatHistoryItem = { content: 'hi', createdAt, id: 'user-1', role: 'user' }
    const assistantMessage: ChatHistoryItem = {
      content: 'hello',
      createdAt,
      id: 'assistant-1',
      role: 'assistant',
      slices: [],
      tool_results: [],
    }

    assert.equal(getChatHistoryItemKey(userMessage, 0), 'user-1')
    assert.equal(getChatHistoryItemKey(assistantMessage, 1), 'assistant-1')
  })

  it('falls back to a role + timestamp + index composite when ids are missing', () => {
    const createdAt = 1700000000000

    const userMessage: ChatHistoryItem = { content: 'hi', createdAt, role: 'user' }
    const assistantMessage: ChatHistoryItem = {
      content: 'hello',
      createdAt,
      role: 'assistant',
      slices: [],
      tool_results: [],
    }

    assert.equal(getChatHistoryItemKey(userMessage, 0), 'user:1700000000000:0')
    assert.equal(getChatHistoryItemKey(assistantMessage, 1), 'assistant:1700000000000:1')
  })

  it('falls back to index when message is missing', () => {
    assert.equal(getChatHistoryItemKey(undefined, 0), 0)
    assert.equal(getChatHistoryItemKey(undefined, 1), 1)
  })

  it('falls back to a role + index composite when ids and timestamps are missing', () => {
    const userMessage: ChatHistoryItem = { content: 'hi', role: 'user' }
    const assistantMessage: ChatHistoryItem = { content: 'hello', role: 'assistant', slices: [], tool_results: [] }

    assert.equal(getChatHistoryItemKey(userMessage, 0), 'user:0')
    assert.equal(getChatHistoryItemKey(assistantMessage, 1), 'assistant:1')
  })
})
