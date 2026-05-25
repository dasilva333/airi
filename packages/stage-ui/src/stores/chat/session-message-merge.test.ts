import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import type { ChatHistoryItem } from '../../types/chat'

import { mergeLoadedSessionMessages } from './session-message-merge'

describe('mergeLoadedSessionMessages', () => {
  it('keeps stored history when the in-memory session only has the placeholder system message', () => {
    const storedMessages: ChatHistoryItem[] = [
      { content: 'system', createdAt: 1, id: 'system-stored', role: 'system' },
      { content: 'saved reply', createdAt: 2, id: 'assistant-1', role: 'assistant', slices: [], tool_results: [] },
    ]
    const currentMessages: ChatHistoryItem[] = [
      { content: 'system', createdAt: 3, id: 'system-current', role: 'system' },
    ]

    assert.equal(mergeLoadedSessionMessages(storedMessages, currentMessages), storedMessages)
  })

  it('appends in-flight messages when IndexedDB finishes loading after a new send starts', () => {
    const storedMessages: ChatHistoryItem[] = [
      { content: 'system', createdAt: 1, id: 'system-stored', role: 'system' },
      { content: 'older reply', createdAt: 2, id: 'assistant-1', role: 'assistant', slices: [], tool_results: [] },
    ]
    const currentMessages: ChatHistoryItem[] = [
      { content: 'system', createdAt: 3, id: 'system-current', role: 'system' },
      { content: 'latest prompt', createdAt: 4, id: 'user-2', role: 'user' },
    ]

    assert.deepEqual(mergeLoadedSessionMessages(storedMessages, currentMessages), [
      ...storedMessages,
      currentMessages[1],
    ])
  })

  it('does not duplicate messages that are already present in storage', () => {
    const storedMessages: ChatHistoryItem[] = [
      { content: 'system', createdAt: 1, id: 'system-stored', role: 'system' },
      { content: 'latest prompt', createdAt: 4, role: 'user' },
    ]
    const currentMessages: ChatHistoryItem[] = [
      { content: 'system', createdAt: 3, id: 'system-current', role: 'system' },
      { content: 'latest prompt', createdAt: 4, role: 'user' },
    ]

    assert.equal(mergeLoadedSessionMessages(storedMessages, currentMessages), storedMessages)
  })
})
