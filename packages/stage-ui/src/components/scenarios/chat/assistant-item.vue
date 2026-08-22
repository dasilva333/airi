<script setup lang="ts">
import type { ChatAssistantMessage, ChatHistoryItem, ChatSlices } from '../../../types/chat'

import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import JournalMomentModal from './JournalMomentModal.vue'
import ChatResponsePart from './response-part.vue'
import ChatToolCallBlock from './tool-call-block.vue'

import { useChatOrchestratorStore } from '../../../stores/chat'
import { useChatSessionStore } from '../../../stores/chat/session-store'
import { useTextJournalStore } from '../../../stores/memory-text-journal'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../stores/modules/consciousness'
import { hydrateLegacyActorSlices, isValidActorId } from '../../../utils/chat-actor-slices'
import { MarkdownRenderer } from '../../markdown'
import { ChatActionMenu } from './components/action-menu'
import { getChatHistoryItemCopyText } from './utils'

const props = withDefaults(defineProps<{
  message: ChatAssistantMessage & { id?: string, createdAt?: number }
  label: string
  showPlaceholder?: boolean
  variant?: 'desktop' | 'mobile'
}>(), {
  showPlaceholder: false,
  variant: 'desktop',
})

const emit = defineEmits<{
  (e: 'copy'): void
  (e: 'delete'): void
}>()
const activeSpokenText = computed(() => chatOrchestrator.activeSpokenText)
const activeSpokenColor = computed(() => chatOrchestrator.activeSpokenColor)

const showJournalModal = ref(false)

const chatSession = useChatSessionStore()
const chatOrchestrator = useChatOrchestratorStore()
const { t } = useI18n()

const formattedTime = computed(() => {
  if (!props.message.createdAt)
    return ''
  return new Date(props.message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
})

const slices = computed(() => props.message.slices || [])
const toolResults = computed(() => props.message.tool_results || [])
const actorAwareSlices = computed(() => hydrateLegacyActorSlices(slices.value, props.message.rawContent))

// The shrink-wrap visual container constraints
const containerClasses = computed(() => [
  'flex',
  props.variant === 'mobile' ? 'mr-0' : 'mr-12',
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
  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return

  const messages = chatSession.getSessionMessages(activeSessionId)
  const index = messages.findIndex(msg => msg.id === props.message.id)

  if (index === -1)
    return

  // Find the user message before this assistant message!
  if (index > 0 && messages[index - 1].role === 'user') {
    // Truncate history at index (keep user message at index-1, remove assistant message and all after it!)
    const nextMessages = messages.slice(0, index)
    await chatSession.setSessionMessages(activeSessionId, nextMessages)

    try {
      // Ingest with triggerOnly: true to trigger generation from the user message that is already in history
      await chatOrchestrator.ingest('', { triggerOnly: true })
      toast.success('Retrying message...')
    }
    catch (err) {
      console.error('[Retry] Failed:', err)
      toast.error('Failed to retry message.')
    }
  }
  else {
    toast.error('Cannot retry: No user message found before this response.')
  }
}

async function handleFork(universeId?: string) {
  const messages = chatSession.getSessionMessages(chatSession.activeSessionId)
  const index = messages.findIndex(m => m.id === props.message.id)
  if (index !== -1) {
    try {
      const newSessionId = await chatSession.forkSession({
        fromSessionId: chatSession.activeSessionId,
        atIndex: index + 1, // Include this message
        universeId,
      })
      toast.success('Conversation forked successfully!')
      console.log(`[AssistantItem] Forked session created: ${newSessionId}`)
    }
    catch (error) {
      console.error('Failed to fork session:', error)
      toast.error('Failed to fork conversation.')
    }
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

async function handleJournalSubmit(data: { scope: 'all' | 'turns', turns?: number, instructions: string, promptTemplate?: string }) {
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
    promptTemplate: data.promptTemplate,
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

async function handleForkAndSwitch(universeId?: string) {
  const messages = chatSession.getSessionMessages(chatSession.activeSessionId)
  const index = messages.findIndex(m => m.id === props.message.id)
  if (index !== -1) {
    try {
      const newSessionId = await chatSession.forkSession({
        fromSessionId: chatSession.activeSessionId,
        atIndex: index + 1, // Include this message
        universeId,
      })

      // Switch to the new session!
      chatSession.activeSessionId = newSessionId

      toast.success('Conversation forked and switched!')
      console.log(`[AssistantItem] Forked session created: ${newSessionId}`)
    }
    catch (error) {
      console.error('Failed to fork session:', error)
      toast.error('Failed to fork conversation.')
    }
  }
}

const isEditing = ref(false)
const isSavingEdit = ref(false)
const editContent = ref('')
const editorRef = useTemplateRef<HTMLDivElement>('editorRef')

function handleEdit() {
  isEditing.value = true
  const raw = props.message.content
  if (typeof raw === 'string') {
    editContent.value = raw
  }
  else if (Array.isArray(raw)) {
    const textPart = raw.find(part => 'type' in part && part.type === 'text') as { text?: string } | undefined
    editContent.value = textPart?.text || ''
  }
  else {
    editContent.value = ''
  }

  void nextTick(() => {
    if (editorRef.value) {
      editorRef.value.textContent = editContent.value
      editorRef.value.focus()

      const range = document.createRange()
      const selection = window.getSelection()
      if (selection) {
        range.selectNodeContents(editorRef.value)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
  })
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

      // Copy message array, update content of the index directly
      const nextMessages = JSON.parse(JSON.stringify(messages))
      nextMessages[index].content = updatedContent

      // Update slices to render the new content instantly
      nextMessages[index].slices = [
        { type: 'text', text: newText },
      ]

      // If the message has rawContent, update it as well so the rendering logic gets the new text while preserving actor tags
      if (typeof nextMessages[index].rawContent === 'string') {
        const oldRaw = nextMessages[index].rawContent
        const actorMatch = oldRaw.match(/<\|ACTOR:\s*([\w-]+)\s*(?:\|>|>)/i)
        if (actorMatch) {
          nextMessages[index].rawContent = `${actorMatch[0]} ${newText}`
        }
        else {
          nextMessages[index].rawContent = newText
        }
      }

      // Pure in-place save: set session messages without slicing or ingesting
      await chatSession.setSessionMessages(activeSessionId, nextMessages)

      isEditing.value = false
      toast.success('Response updated.')
    }
    catch (err) {
      console.error('[EditCommit] Failed:', err)
      toast.error('Failed to update response.')
    }
    finally {
      isSavingEdit.value = false
    }
  }
}

const hasContentText = computed(() => {
  const content = props.message.content
  if (typeof content === 'string') {
    return !!content.trim()
  }
  if (Array.isArray(content)) {
    return content.some(part => part && typeof part === 'object' && 'type' in part && part.type === 'text' && !!(part as any).text?.trim())
  }
  return false
})

const isLatestAssistantMessage = computed(() => {
  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return false
  const messages = chatSession.getSessionMessages(activeSessionId)
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      return messages[i].id === props.message.id
    }
  }
  return false
})

// Visual FX state parsing (re-injected from main)
const showLoader = computed(() => props.showPlaceholder)

function getMoodArchetype(text: string): string | null {
  if (!text || typeof text !== 'string')
    return null

  // Pattern to find both ACT tags and Bracket tokens [mood]
  const matches = Array.from(text.matchAll(/<\|ACT:([\s\S]*?)\|>|\[([\w-]+)\]/gi))

  for (const match of matches) {
    let name = ''
    if (match[1]) { // ACT tag fallback
      const nameMatch = match[1].match(/"name":\s*"([^"]+)"/i)
      if (nameMatch)
        name = nameMatch[1].toLowerCase()
    }
    else if (match[2]) { // Bracket token [mood] - Priority!
      name = match[2].toLowerCase()
    }

    if (!name)
      continue

    let result = null
    // Map keywords to our core visual archetypes
    if (/happy|joy|laugh|grin|chuckle|smile|beam|cheer/.test(name))
      result = 'happy'
    else if (/sad|cry|sorrow|pout|sniff|sigh|whimper|mourn/.test(name))
      result = 'sad'
    else if (/angry|mad|annoy|frustrate|growl|hiss|glare|stomp/.test(name))
      result = 'angry'
    else if (/surprise|shock|wonder|gasp|eep|awe|blink/.test(name))
      result = 'surprised'
    else if (/think|ponder|curious|hmm|mmm|doubt|question/.test(name))
      result = 'thinking'
    else if (/blush|shy|embarrassed|rose|bashful|stutter|awkward/.test(name))
      result = 'flustered'
    else if (/relax|whisper|sleepy|soft|calm|peace|yawn|purr/.test(name))
      result = 'relaxed'

    if (result)
      return result
  }

  return null
}

const mood = computed(() => {
  // Priority: inline bracket extraction from text slices
  if (props.message.slices?.length) {
    for (const slice of props.message.slices) {
      if (slice.type === 'text') {
        const m = getMoodArchetype(slice.text)
        if (m)
          return m
      }
    }
  }

  if (typeof props.message.content === 'string') {
    const m = getMoodArchetype(props.message.content)
    if (m)
      return m
  }

  if (Array.isArray(props.message.content)) {
    const textPart = props.message.content.find(part => 'type' in part && part.type === 'text') as { text?: string } | undefined
    if (textPart?.text) {
      const m = getMoodArchetype(textPart.text)
      if (m)
        return m
    }
  }

  // Fallback: Message categorization
  if (!(props.message.categorization as any)?.mood)
    return null
  const m = String((props.message.categorization as any).mood).toLowerCase().trim()
  if (m === 'null' || m === '')
    return null
  return m
})

const moodBaseColor = computed(() => {
  switch (mood.value) {
    case 'happy':
    case 'joy': return 'emerald'
    case 'sad':
    case 'sorrow': return 'blue'
    case 'angry':
    case 'mad': return 'rose'
    case 'scared':
    case 'fear': return 'amber'
    case 'surprised':
    case 'shock': return 'violet'
    case 'disgusted':
    case 'disgust': return 'lime'
    case 'relaxed':
    case 'calm': return 'teal'
    default: return 'primary'
  }
})

// Original specific hex effects
const MOOD_ARCHETYPE_COLORS: Record<string, { border: string, bg: string, glow: string }> = {
  happy: { border: '#10b98180', bg: '#10b98115', glow: '#10b98130' }, // emerald
  sad: { border: '#3b82f680', bg: '#3b82f615', glow: '#3b82f630' }, // blue
  angry: { border: '#f43f5e80', bg: '#f43f5e15', glow: '#f43f5e30' }, // rose
  surprised: { border: '#a855f790', bg: '#a855f720', glow: '#a855f740' }, // vibrant purple
  thinking: { border: '#f59e0b80', bg: '#f59e0b10', glow: '#f59e0b20' }, // amber
  flustered: { border: '#f472b680', bg: '#f472b615', glow: '#f472b630' }, // pink
  relaxed: { border: '#14b8a680', bg: '#14b8a615', glow: '#14b8a630' }, // teal
}

// Box constraints combining feature layout with main's dynamic border FX
const boxClasses = computed(() => {
  const baseClasses = props.variant === 'mobile' ? 'px-2 py-2 text-sm' : 'px-3 py-3'
  const isDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true

  if (!mood.value) {
    return [
      baseClasses,
      isDark ? 'bg-primary-900/50 text-white' : 'bg-primary-100 text-black',
      'transition-all duration-300',
    ]
  }

  // If we have a specific ported archetype color, just supply the transitions
  if (MOOD_ARCHETYPE_COLORS[mood.value]) {
    return [
      baseClasses,
      'transition-all duration-300 text-neutral-800 dark:text-neutral-200',
    ]
  }

  const c = moodBaseColor.value
  return [
    baseClasses,
    `border-${c}-500/50 shadow-[0_0_15px_rgba(var(--un-colors-${c}-500),0.2)]`,
    isDark ? `bg-${c}-900/40 text-${c}-100` : `bg-${c}-100 text-${c}-900`,
    'transition-all duration-300',
  ]
})

const boxStyle = computed(() => {
  if (!mood.value)
    return {}

  if (MOOD_ARCHETYPE_COLORS[mood.value]) {
    const colors = MOOD_ARCHETYPE_COLORS[mood.value]
    return {
      borderColor: colors.border,
      borderWidth: '2px', // Increase for visibility
      borderStyle: 'solid',
      backgroundColor: colors.bg, // Tint the background directly!
      boxShadow: `0 0 15px ${colors.glow}`, // Add outer glow
    }
  }

  return {
    border: '1px solid',
  }
})

const resolvedSlices = computed(() => {
  const rs: ChatSlices[] = []

  for (const slice of actorAwareSlices.value) {
    if (slice.type === 'text') {
      const lastSlice = rs.at(-1)
      if (lastSlice?.type === 'text' && !slice.startsActor && lastSlice.actorId === slice.actorId) {
        lastSlice.text += slice.text
      }
      else {
        rs.push({ ...slice })
      }
      continue
    }

    if (slice.type === 'tool-call') {
      const toolCallId = (slice.toolCall as any)?.id || (slice.toolCall as any)?.toolCallId
      if (toolCallId) {
        const result = toolResults.value.find((tr: any) => tr.toolCallId === toolCallId || tr.id === toolCallId)
        if (result) {
          rs.push({
            type: 'tool-call',
            toolCall: slice.toolCall,
            state: 'done',
            result: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
          })
          continue
        }
      }
      rs.push({
        type: 'tool-call',
        toolCall: slice.toolCall,
        state: slice.state || 'executing',
      })
    }

    if (slice.type === 'tool-call-result') {
      continue
    }

    if ((slice as any).type === 'reasoning') {
      // Typically skipped, reasoning can be styled separately or omitted
    }
  }

  return rs
})

const dynamicStyles = computed(() => {
  const actorIds = new Set<string>()
  for (const slice of actorAwareSlices.value) {
    if (slice.type === 'text' && isValidActorId(slice.actorId))
      actorIds.add(slice.actorId)
  }

  const cardStore = useAiriCardStore()
  const visualAssets = cardStore.activeCard?.extensions?.airi?.visual_assets || {}

  // Combine visual asset keys and parsed actor IDs to ensure we cover all candidates
  const allKeys = Array.from(new Set([
    ...Object.keys(visualAssets),
    ...actorIds,
  ])).sort()

  const minDistance = 30 // minimum degrees of separation on the 360-degree color wheel
  const assignedHues: number[] = []
  const hueMap: Record<string, number> = {}

  for (const key of allKeys) {
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash)
    }
    let h = Math.abs(hash) % 360

    // Resolve circular hue collisions
    let attempts = 0
    while (attempts < 360) {
      let conflict = false
      for (const assigned of assignedHues) {
        const diff = Math.abs(h - assigned)
        const distance = Math.min(diff, 360 - diff)
        if (distance < minDistance) {
          conflict = true
          break
        }
      }
      if (!conflict) {
        break
      }
      h = (h + 45) % 360 // shift deterministically
      attempts++
    }

    assignedHues.push(h)
    hueMap[key] = h
  }

  let css = ''
  for (const actorId of actorIds) {
    const customColor = visualAssets[actorId]?.textColor
    if (customColor) {
      const isHex = customColor.startsWith('#') && customColor.length === 7
      const bgOpacity = isHex ? `${customColor}14` : customColor
      const borderOpacity = isHex ? `${customColor}33` : customColor

      css += `.actor-color-${actorId} { color: ${customColor} !important; }\n`
      css += `.actor-chip-${actorId} { background-color: ${bgOpacity} !important; color: ${customColor} !important; border: 1px solid ${borderOpacity} !important; }\n`

      css += `.dark .actor-color-${actorId} { color: ${customColor} !important; }\n`
      css += `.dark .actor-chip-${actorId} { background-color: ${bgOpacity} !important; color: ${customColor} !important; border: 1px solid ${borderOpacity} !important; }\n`
      continue
    }

    const h = hueMap[actorId] ?? 0

    // Light Mode colors (Rich, deep, high contrast)
    css += `.actor-color-${actorId} { color: hsl(${h}, 70%, 35%) !important; }\n`
    css += `.actor-chip-${actorId} { background-color: hsla(${h}, 70%, 35%, 0.08) !important; color: hsl(${h}, 70%, 35%) !important; border: 1px solid hsla(${h}, 70%, 35%, 0.2) !important; }\n`

    // Dark Mode colors (Bright, pastel, glowing)
    css += `.dark .actor-color-${actorId} { color: hsl(${h}, 90%, 75%) !important; }\n`
    css += `.dark .actor-chip-${actorId} { background-color: hsla(${h}, 90%, 75%, 0.15) !important; color: hsl(${h}, 90%, 75%) !important; border: 1px solid hsla(${h}, 90%, 75%, 0.25) !important; }\n`
  }
  return css
})
</script>

<template>
  <div v-if="message.role === 'assistant'" class="group ph-no-capture w-full !max-w-full" :class="containerClasses">
    <component is="style" v-html="dynamicStyles" />
    <JournalMomentModal
      :open="showJournalModal"
      :message-id="message.id"
      :messages="chatSession.getSessionMessages(chatSession.activeSessionId || '')"
      @close="showJournalModal = false"
      @submit="handleJournalSubmit"
    />
    <ChatActionMenu
      :copy-text="copyText"
      :can-edit="true"
      placement="right"
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
        <div class="w-full flex flex-row gap-2">
          <!-- Avatar space holding -->
          <!-- A static avatar can go here, leaving space on the left -->
          <!-- We rely on layout styling for this -->
          <div
            :ref="setMeasuredElement"
            flex="~ col" shadow="sm neutral-200/50 dark:none"
            h="unset <sm:fit" relative rounded-xl
            class="max-w-[calc(100%-4rem)] min-w-20 w-fit"
            :class="boxClasses"
            :style="boxStyle"
          >
            <!-- Render Label -->
            <div>
              <span text-sm text="black/60 dark:white/65" font-normal class="inline <sm:hidden">{{ label }}</span>
            </div>

            <div v-if="message.content === 'NO_REPLY' || message.rawContent === 'NO_REPLY'" class="py-1 text-sm text-neutral-500/70 italic dark:text-neutral-400/70">
              The character chose not to respond in this turn
            </div>
            <div v-else-if="resolvedSlices.length > 0 && !isEditing" class="break-words" :class="mood ? 'text-neutral-800 dark:text-neutral-200' : 'text-primary-700 dark:primary-100'">
              <template v-for="(slice, sliceIndex) in resolvedSlices" :key="sliceIndex">
                <ChatToolCallBlock
                  v-if="slice.type === 'tool-call'"
                  :tool-name="(slice.toolCall as any).function?.name || (slice.toolCall as any).toolName"
                  :args="(slice.toolCall as any).function?.arguments || (slice.toolCall as any).args"
                  :state="slice.state"
                  :result="slice.result"
                  class="mb-2"
                />
                <template v-else-if="slice.type === 'tool-call-result'" />
                <template v-else-if="slice.type === 'text'">
                  <MarkdownRenderer
                    :content="slice.text"
                    :active-text="isLatestAssistantMessage ? activeSpokenText : undefined"
                    :active-color="isLatestAssistantMessage ? activeSpokenColor : undefined"
                    :actor-id="slice.actorId"
                    :starts-actor="slice.startsActor"
                  />
                </template>
              </template>
            </div>
            <div v-else-if="showLoader" i-eos-icons:three-dots-loading />

            <!-- In-place Assistant Message Editor -->
            <div
              v-show="isEditing"
              ref="editorRef"
              contenteditable="true"
              class="my-0 min-h-[1lh] w-full break-words rounded-md bg-white/5 p-2 text-neutral-800 shadow-inner outline-none ring-2 ring-primary-500/50 transition-colors -mx-2 dark:bg-black/10 dark:text-neutral-200"
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

            <div v-if="message.categorization?.reasoning && !hasContentText" mt-1 text-xs text-neutral-500 font-normal italic dark:text-neutral-400>
              {{ t('stage.chat.reasoning_only') }}
            </div>

            <ChatResponsePart
              v-if="message.categorization"
              :message="message"
              :variant="variant"
            />

            <!-- Formatted Timestamp -->
            <div
              v-if="variant === 'desktop' && formattedTime"
              class="absolute left-full top-1/2 ml-4 opacity-0 transition-opacity -translate-y-1/2 group-hover:opacity-100"
            >
              <span class="whitespace-nowrap text-xs text-neutral-400 font-medium tabular-nums dark:text-neutral-500">
                {{ formattedTime }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </ChatActionMenu>
  </div>
</template>
