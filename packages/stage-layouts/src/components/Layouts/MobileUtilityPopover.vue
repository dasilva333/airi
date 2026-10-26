<script setup lang="ts">
import type { VoiceEditorPayload } from '@proj-airi/stage-ui/types/voice-editor'

import ChatOptionsPopover from './ChatOptionsPopover.vue'

const emit = defineEmits<{
  (e: 'openVoiceEditor', payload: VoiceEditorPayload): void
}>()
</script>

<template>
  <ChatOptionsPopover
    trigger-variant="circle"
    :show-chat-layout="false"
    @open-voice-editor="emit('openVoiceEditor', $event)"
  />
</template>
