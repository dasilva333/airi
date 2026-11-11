<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'

import { ChatHistory, WhisperComposerBar } from '@proj-airi/stage-ui/components'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'

const chatSession = useChatSessionStore()
const chatOrchestrator = useChatOrchestratorStore()
const chatStream = useChatStreamStore()

onMounted(async () => {
  await chatSession.ensureActiveSessionForCharacter()
})

const { messages } = storeToRefs(chatSession)
const { streamingMessage } = storeToRefs(chatStream)
const { sending } = storeToRefs(chatOrchestrator)

const historyMessages = computed(() => messages.value as unknown as ChatHistoryItem[])
</script>

<template>
  <div class="h-full min-h-0 flex flex-col overflow-hidden">
    <!-- Message Timeline -->
    <div class="min-h-0 flex-1 overflow-hidden">
      <ChatHistory
        variant="mobile"
        :messages="historyMessages"
        :sending="sending"
        :streaming-message="streamingMessage"
        class="h-full overflow-y-auto"
      />
    </div>

    <!-- Sticky Bottom Composer -->
    <div class="mt-2 shrink-0 pt-1">
      <WhisperComposerBar
        variant="compact"
      />
    </div>
  </div>
</template>
