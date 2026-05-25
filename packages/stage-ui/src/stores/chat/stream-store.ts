import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { StreamingAssistantMessage } from '../../types/chat'

import { useChatSessionStore } from './session-store'

export const useChatStreamStore = defineStore('chat-stream', () => {
  const chatSession = useChatSessionStore()
  const streamingMessage = ref<StreamingAssistantMessage>({
    content: '',
    createdAt: Date.now(),
    role: 'assistant',
    slices: [],
    tool_results: [],
  })

  function beginStream(messageId?: string, createdAt?: number) {
    streamingMessage.value = {
      content: '',
      createdAt: createdAt ?? Date.now(),
      id: messageId,
      role: 'assistant',
      slices: [],
      tool_results: [],
    }
  }

  function appendStreamLiteral(literal: string) {
    streamingMessage.value.content += literal

    const lastSlice = streamingMessage.value.slices.at(-1)
    if (lastSlice?.type === 'text') {
      lastSlice.text += literal
      return
    }

    streamingMessage.value.slices.push({
      text: literal,
      type: 'text',
    })
  }

  function finalizeStream(sessionId = chatSession.activeSessionId, fullText?: string) {
    const sessionMessagesForSend = chatSession.getSessionMessages(sessionId)
    if (streamingMessage.value.slices.length > 0) {
      const existsById = !!(
        streamingMessage.value.id && sessionMessagesForSend.some((m) => m.id === streamingMessage.value.id)
      )
      const existsByContent = sessionMessagesForSend.some(
        (m) => m.role === 'assistant' && m.content === streamingMessage.value.content,
      )
      const exists = existsById || existsByContent

      console.log(`[ChatStreamStore] finalizeStream for session ${sessionId}:`, {
        contentPreview:
          typeof streamingMessage.value.content === 'string' ? streamingMessage.value.content.slice(0, 60) : '',
        existsByContent,
        existsById,
        messageId: streamingMessage.value.id,
        willPush: !exists,
      })

      if (!exists) {
        sessionMessagesForSend.push(streamingMessage.value)
      }
    }
    streamingMessage.value = { content: '', role: 'assistant', slices: [], tool_results: [] }
    if (fullText) streamingMessage.value.content = fullText
  }

  function resetStream() {
    streamingMessage.value = { content: '', role: 'assistant', slices: [], tool_results: [] }
  }

  return {
    appendStreamLiteral,
    beginStream,
    finalizeStream,
    resetStream,
    streamingMessage,
  }
})
