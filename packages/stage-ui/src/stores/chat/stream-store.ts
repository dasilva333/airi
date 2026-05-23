import type { StreamingAssistantMessage } from '../../types/chat'

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useChatSessionStore } from './session-store'

export const useChatStreamStore = defineStore('chat-stream', () => {
  const chatSession = useChatSessionStore()
  const streamingMessage = ref<StreamingAssistantMessage>({ role: 'assistant', content: '', slices: [], tool_results: [], createdAt: Date.now() })

  function beginStream(messageId?: string, createdAt?: number) {
    streamingMessage.value = {
      role: 'assistant',
      content: '',
      slices: [],
      tool_results: [],
      createdAt: createdAt ?? Date.now(),
      id: messageId,
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
      type: 'text',
      text: literal,
    })
  }

  function finalizeStream(sessionId = chatSession.activeSessionId, fullText?: string) {
    const sessionMessagesForSend = chatSession.getSessionMessages(sessionId)
    if (streamingMessage.value.slices.length > 0) {
      const existsById = !!(streamingMessage.value.id && sessionMessagesForSend.some(m => m.id === streamingMessage.value.id))
      const existsByContent = sessionMessagesForSend.some(m => m.role === 'assistant' && m.content === streamingMessage.value.content)
      const exists = existsById || existsByContent

      console.log(`[ChatStreamStore] finalizeStream for session ${sessionId}:`, {
        messageId: streamingMessage.value.id,
        existsById,
        existsByContent,
        willPush: !exists,
        contentPreview: typeof streamingMessage.value.content === 'string' ? streamingMessage.value.content.slice(0, 60) : '',
      })

      if (!exists) {
        sessionMessagesForSend.push(streamingMessage.value)
      }
    }
    streamingMessage.value = { role: 'assistant', content: '', slices: [], tool_results: [] }
    if (fullText)
      streamingMessage.value.content = fullText
  }

  function resetStream() {
    streamingMessage.value = { role: 'assistant', content: '', slices: [], tool_results: [] }
  }

  return {
    streamingMessage,
    beginStream,
    appendStreamLiteral,
    finalizeStream,
    resetStream,
  }
})
