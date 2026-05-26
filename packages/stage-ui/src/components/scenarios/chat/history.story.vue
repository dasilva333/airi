<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChatAssistantMessage, ChatHistoryItem } from '../../../types/chat'

import ChatHistory from './history.vue'

const markdownMessages = ref<ChatHistoryItem[]>([
  {
    content: "Hey AIRI, can you summarize today's tasks?",
    role: 'user',
  },
  {
    content: '',
    role: 'assistant',
    slices: [
      {
        text: 'Absolutely! Here is a **quick recap** with bullet points:\n\n- Finish UI polish\n- Ship the API client\n- Record the demo',
        type: 'text',
      },
    ],
    tool_results: [],
  },
  {
    content: '',
    role: 'assistant',
    slices: [
      {
        toolCall: {
          args: JSON.stringify({ limit: 5 }),
          toolCallId: '1',
          toolCallType: 'function',
          toolName: 'fetch_tasks',
        },
        type: 'tool-call',
      },
      { text: 'Let me pull the latest tasks from the tracker.', type: 'text' },
    ],
    tool_results: [],
  },
])

const toolHeavyMessages = computed<ChatHistoryItem[]>(() => [
  {
    content: 'Grab the weather for Tokyo and Osaka.',
    role: 'user',
  },
  {
    content: '',
    role: 'assistant',
    slices: [
      {
        toolCall: {
          args: JSON.stringify({ location: 'Tokyo' }),
          toolCallId: '2',
          toolCallType: 'function',
          toolName: 'weather',
        },
        type: 'tool-call',
      },
      {
        toolCall: {
          args: JSON.stringify({ location: 'Osaka' }),
          toolCallId: '3',
          toolCallType: 'function',
          toolName: 'weather',
        },
        type: 'tool-call',
      },
      { text: 'I will fetch both cities, one sec.', type: 'text' },
    ],
    tool_results: [],
  },
])

const errorMessages = ref<ChatHistoryItem[]>([
  {
    content: 'Push the deployment now.',
    role: 'user',
  },
  {
    content: 'Deployment failed: upstream gateway timed out. Please try again in a minute.',
    role: 'error',
  },
])

const streamingMessage = ref<ChatAssistantMessage>({
  content: '',
  role: 'assistant',
  slices: [{ text: 'Working on it...', type: 'text' }],
  tool_results: [],
})
</script>

<template>
  <Story
    title="Chat / History"
    group="chat"
  >
    <template #controls>
      <ThemeColorsHueControl />
    </template>

    <Variant
      id="with-tools-desktop"
      title="With Tools"
    >
      <ChatHistory :messages="markdownMessages" />
    </Variant>

    <Variant
      id="with-tools-mobile"
      title="With Tools (Mobile)"
    >
      <ChatHistory
        :messages="markdownMessages"
        variant="mobile"
      />
    </Variant>

    <Variant
      id="multiple-tools"
      title="Multiple Tools"
    >
      <ChatHistory :messages="toolHeavyMessages" />
    </Variant>

    <Variant
      id="streaming"
      title="Streaming"
    >
      <ChatHistory
        :messages="[]"
        :sending="true"
        :streaming-message="streamingMessage"
        variant="mobile"
      />
    </Variant>

    <Variant
      id="error"
      title="Error"
    >
      <ChatHistory
        :messages="errorMessages"
      />
    </Variant>
  </Story>
</template>
