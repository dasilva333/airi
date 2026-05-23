<script setup lang="ts">
import type { ChatHistoryItem, ChatMessage } from '../../../types/chat'

import { storeToRefs } from 'pinia'
import { computed, ref, useTemplateRef } from 'vue'
import { toast } from 'vue-sonner'

import JournalMomentModal from './JournalMomentModal.vue'

import { useChatOrchestratorStore } from '../../../stores/chat'
import { useChatSessionStore } from '../../../stores/chat/session-store'
import { useTextJournalStore } from '../../../stores/memory-text-journal'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../stores/modules/consciousness'
import { MarkdownRenderer } from '../../markdown'
import { ChatActionMenu } from './components/action-menu'
import { getChatHistoryItemCopyText } from './utils'

const props = withDefaults(defineProps<{
  message: Extract<ChatMessage, { role: 'user' }> & { id?: string, createdAt?: number }
  label: string
  variant?: 'desktop' | 'mobile'
}>(), {
  variant: 'desktop',
})

const emit = defineEmits<{
  (e: 'copy'): void
  (e: 'delete'): void
}>()

const chatSession = useChatSessionStore()
const chatOrchestrator = useChatOrchestratorStore()
const showJournalModal = ref(false)

const isEditing = ref(false)
const isSavingEdit = ref(false)
const editContent = ref('')
const editorRef = useTemplateRef<HTMLDivElement>('editorRef')

const formattedTime = computed(() => {
  if (!props.message.createdAt)
    return ''
  return new Date(props.message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
})

const content = computed(() => {
  const raw = props.message.content
  if (typeof raw === 'string')
    return raw

  if (Array.isArray(raw)) {
    const textPart = raw.find(part => 'type' in part && part.type === 'text') as { text?: string } | undefined
    return textPart?.text || ''
  }

  return ''
})

const images = computed(() => {
  const raw = props.message.content
  if (!Array.isArray(raw))
    return []

  return raw
    .filter(part => 'type' in part && part.type === 'image_url')
    .map(part => (part as any).image_url?.url as string)
    .filter(Boolean)
})

const containerClasses = computed(() => [
  'flex',
  props.variant === 'mobile' ? 'ml-0 flex-row' : 'ml-12 flex-row-reverse',
])

const boxClasses = computed(() => [
  props.variant === 'mobile' ? 'px-2 py-2 text-sm bg-neutral-100/90 dark:bg-neutral-800/90' : 'px-3 py-3 bg-neutral-100/80 dark:bg-neutral-800/80',
])

const copyText = computed(() => getChatHistoryItemCopyText(props.message as ChatHistoryItem))

function handleCopy() {
  emit('copy')
}

function handleDelete() {
  if (props.message.id)
    chatSession.deleteMessage(props.message.id)
  emit('delete')
}

async function handleRetry() {
  if (!props.message.id)
    return

  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return

  const messages = chatSession.getSessionMessages(activeSessionId)
  const index = messages.findIndex(msg => msg.id === props.message.id)

  if (index === -1)
    return

  // Truncate messages up to (but not including) this user message!
  const nextMessages = messages.slice(0, index)
  chatSession.setSessionMessages(activeSessionId, nextMessages)

  // Now ingest the message content again!
  await chatOrchestrator.ingest(content.value, {})

  toast.success('Retrying message...')
}

async function handleFork() {
  if (!props.message.id)
    return

  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return

  const messages = chatSession.getSessionMessages(activeSessionId)
  const index = messages.findIndex(msg => msg.id === props.message.id)

  if (index === -1)
    return

  // Fork at index + 1 to include the user message!
  const newSessionId = await chatSession.forkSession({
    fromSessionId: activeSessionId,
    atIndex: index + 1,
  })

  if (newSessionId) {
    // Trigger inference on the new session!
    // We pass empty string as message, and triggerOnly: true.
    await chatOrchestrator.ingest('', { triggerOnly: true }, newSessionId)

    // Show toast!
    toast.success('Conversation forked and triggered!')
  }
}

function handleDeleteFollowing() {
  if (props.message.id) {
    chatSession.deleteMessagesFromHere(props.message.id)
    toast.success('Messages deleted from here.')
  }
}

function handleJournal() {
  showJournalModal.value = true
}

async function handleJournalSubmit(data: { scope: 'all' | 'turns', turns?: number, instructions: string }) {
  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return

  const allMessages = chatSession.getSessionMessages(activeSessionId)
  const clickedIndex = allMessages.findIndex(m => m.id === props.message.id)
  if (clickedIndex === -1)
    return

  let contextMessages: any[] = []
  if (data.scope === 'all') {
    contextMessages = allMessages.slice(0, clickedIndex + 1)
  }
  else {
    const turnsCount = data.turns || 15
    contextMessages = allMessages.slice(Math.max(0, clickedIndex - turnsCount + 1), clickedIndex + 1)
  }

  const textJournalStore = useTextJournalStore()
  const consciousnessStore = useConsciousnessStore()
  const { activeCard } = storeToRefs(useAiriCardStore())

  if (!activeCard.value)
    return

  // Get model/provider info
  const extension = activeCard.value.extensions.airi
  const modelId = extension.modules?.consciousness?.model || consciousnessStore.activeModel
  const providerId = extension.modules?.consciousness?.provider || consciousnessStore.activeProvider

  toast.promise(textJournalStore.createJournalMoment({
    messages: contextMessages,
    instructions: data.instructions,
    modelId,
    providerId,
  }).catch((err) => {
    console.error('[JournalMoment] Creation failed:', err)
    throw err
  }), {
    loading: 'Generating journal entry...',
    success: 'Journal entry created!',
    error: 'Failed to create journal entry.',
  })

  showJournalModal.value = false
}

async function handleForkAndSwitch() {
  if (!props.message.id)
    return

  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return

  const messages = chatSession.getSessionMessages(activeSessionId)
  const index = messages.findIndex(msg => msg.id === props.message.id)

  if (index === -1)
    return

  // Fork at index + 1 to include the user message!
  const newSessionId = await chatSession.forkSession({
    fromSessionId: activeSessionId,
    atIndex: index + 1,
  })

  if (newSessionId) {
    // Switch to the new session!
    chatSession.activeSessionId = newSessionId

    // Trigger inference on the new session!
    await chatOrchestrator.ingest('', { triggerOnly: true }, newSessionId)

    // Show toast!
    toast.success('Conversation forked and switched!')
  }
}

function handleEdit() {
  isEditing.value = true
  editContent.value = content.value

  // Set the text manually to avoid cursor jumping with v-text/v-model
  setTimeout(() => {
    if (editorRef.value) {
      editorRef.value.textContent = editContent.value
      editorRef.value.focus()

      // Move cursor to the end
      const range = document.createRange()
      const sel = window.getSelection()
      if (sel) {
        range.selectNodeContents(editorRef.value)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }, 0)
}

function handleCancelEdit() {
  isEditing.value = false
}

async function handleCommitEdit() {
  if (!props.message.id || isSavingEdit.value)
    return

  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return

  if (editorRef.value) {
    const newText = (editorRef.value.textContent || '').trim()
    if (!newText) {
      toast.error('Message content cannot be empty.')
      return
    }

    isSavingEdit.value = true
    try {
      const messages = chatSession.getSessionMessages(activeSessionId)
      const index = messages.findIndex(msg => msg.id === props.message.id)

      if (index === -1)
        return

      // Construct updated content while preserving VLM image attachments
      const raw = props.message.content
      let updatedContent: any
      if (typeof raw === 'string') {
        updatedContent = newText
      }
      else if (Array.isArray(raw)) {
        updatedContent = raw.map((part) => {
          if (part && typeof part === 'object' && 'type' in part && part.type === 'text') {
            return { ...part, text: newText }
          }
          return part
        })
      }
      else {
        updatedContent = newText
      }

      // Truncate subsequent messages: slice history up to the edited user message (inclusive)
      const nextMessages = JSON.parse(JSON.stringify(messages.slice(0, index + 1)))
      nextMessages[index].content = updatedContent

      // Save history
      await chatSession.setSessionMessages(activeSessionId, nextMessages)

      isEditing.value = false

      // Resubmit for reply generation
      await chatOrchestrator.ingest('', { triggerOnly: true }, activeSessionId)

      toast.success('Message updated, generating response...')
    }
    catch (err) {
      console.error('[EditCommit] Failed:', err)
      toast.error('Failed to update message.')
    }
    finally {
      isSavingEdit.value = false
    }
  }
}
</script>

<template>
  <div v-if="message.role === 'user'" self-end class="group ph-no-capture max-w-[calc(100%-4rem)]" :class="containerClasses">
    <JournalMomentModal
      :open="showJournalModal"
      :message-id="message.id"
      :messages="chatSession.getSessionMessages(chatSession.activeSessionId || '')"
      @close="showJournalModal = false"
      @submit="handleJournalSubmit"
    />
    <ChatActionMenu
      :copy-text="copyText"
      placement="left"
      @copy="handleCopy"
      @delete="handleDelete"
      @fork="handleFork"
      @retry="handleRetry"
      @delete-following="handleDeleteFollowing"
      @fork-switch="handleForkAndSwitch"
      @journal="handleJournal"
      @edit="handleEdit"
    >
      <template #default="{ setMeasuredElement }">
        <div
          :ref="setMeasuredElement"
          flex="~ col" shadow="sm neutral-200/50 dark:none"
          h="unset <sm:fit"
          relative min-w-20 rounded-xl
          :class="boxClasses"
        >
          <div>
            <span text-sm text="black/60 dark:white/65" font-normal class="inline <sm:hidden">{{ label }}</span>
          </div>

          <div v-if="images.length > 0" class="my-2 flex flex-wrap gap-2">
            <div v-for="(url, idx) in images" :key="idx" class="relative max-w-sm overflow-hidden border border-neutral-200 rounded-lg dark:border-neutral-700">
              <img :src="url" class="max-h-64 object-contain">
            </div>
          </div>

          <MarkdownRenderer
            v-if="content && !isEditing"
            :content="content as string"
            class="break-words"
          />

          <div
            v-show="isEditing"
            ref="editorRef"
            contenteditable="true"
            class="my-0 min-h-[1lh] w-full break-words rounded-md bg-white/5 p-2 shadow-inner outline-none ring-2 ring-primary-500/50 transition-colors -mx-2 dark:bg-black/10"
            @keydown.shift.enter.prevent="handleCommitEdit"
            @keydown.esc.prevent="handleCancelEdit"
          />

          <div
            v-if="isEditing"
            class="absolute z-10 flex gap-1 border border-neutral-200 rounded-full bg-white/95 p-1 shadow-md backdrop-blur-sm -bottom-3 -right-3 dark:border-neutral-700 dark:bg-neutral-800/95"
          >
            <button
              :disabled="isSavingEdit"
              title="Cancel (Esc)"
              class="h-6 w-6 flex items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/50"
              @click="handleCancelEdit"
            >
              <div class="i-solar:close-circle-bold text-sm" />
            </button>
            <button
              :disabled="isSavingEdit"
              title="Commit (Shift+Enter)"
              class="h-6 w-6 flex items-center justify-center rounded-full text-emerald-500 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-950/50"
              @click="handleCommitEdit"
            >
              <div class="i-solar:check-circle-bold text-sm" />
            </button>
          </div>

          <div
            v-if="variant === 'desktop' && formattedTime"
            class="absolute right-full top-1/2 mr-4 opacity-0 transition-opacity -translate-y-1/2 group-hover:opacity-100"
          >
            <span class="whitespace-nowrap text-xs text-neutral-400 font-medium tabular-nums dark:text-neutral-500">
              {{ formattedTime }}
            </span>
          </div>
        </div>
      </template>
    </ChatActionMenu>
  </div>
</template>
