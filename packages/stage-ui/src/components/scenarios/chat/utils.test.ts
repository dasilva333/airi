import type { ChatAssistantMessage } from '../../../types/chat'

import { describe, expect, it } from 'vitest'

import { getChatHistoryItemCopyText } from './utils'

describe('getChatHistoryItemCopyText', () => {
  it('copies actor-aware text slices as clean prose with no orchestration markers', () => {
    const message: ChatAssistantMessage = {
      role: 'assistant',
      content: 'Hi, how are you? I am great, thanks.',
      rawContent: '<|ACTOR:actor_one|>Hi, how are you?<|ACTOR:actor_two|>I am great, thanks.',
      slices: [
        { type: 'text', text: 'Hi, how are you?', actorId: 'actor_one', startsActor: true },
        {
          type: 'tool-call',
          toolCall: {
            args: '{}',
            toolCallId: 'tool-1',
            toolCallType: 'function',
            toolName: 'text_journal',
          },
        },
        { type: 'text', text: 'I am great, thanks.', actorId: 'actor_two', startsActor: true },
      ],
      tool_results: [],
    }

    const copied = getChatHistoryItemCopyText(message)

    expect(copied).toBe('Hi, how are you?\n\nI am great, thanks.')
    expect(copied).not.toContain('<|')
  })
})
