<script setup lang="ts">
import type { ChatAssistantMessage, ChatHistoryItem, ChatSlices, ChatSlicesText } from '../../../types/chat'

import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
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

function injectActorColors(content: string): string {
  if (!content)
    return ''

  // Translate actor tags to safe text markers so the markdown parser won't strip them
  return content.replace(/<\|ACTOR:\s*([\w-]+)\s*(?:\|>|>)/gi, '[ACTOR:$1]')
}

const showJournalModal = ref(false)

const chatSession = useChatSessionStore()
const chatOrchestrator = useChatOrchestratorStore()
const { t } = useI18n()

const formattedTime = computed(() => {
  if (!props.message.createdAt)
    return ''
  return new Date(props.message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
})

interface DisplaySegment {
  type: 'text' | 'act'
  content: string
}

function processContent(content: string): DisplaySegment[] {
  const markerRegex = /<\|ACT:([^|>]+)\|>/g
  const segments: DisplaySegment[] = []
  let lastIndex = 0
  let match

  while ((match = markerRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      })
    }

    const command = match[1].trim()
    segments.push({
      type: 'act',
      content: command,
    })

    lastIndex = markerRegex.lastIndex
  }

  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.slice(lastIndex),
    })
  }

  return segments
}

const slices = computed(() => props.message.slices || [])
const toolResults = computed(() => props.message.tool_results || [])

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
    const userMsg = messages[index - 1]
    const content = userMsg.content

    // Truncate history at index - 1 (remove user message and all after it!)
    const nextMessages = messages.slice(0, index - 1)
    chatSession.setSessionMessages(activeSessionId, nextMessages)

    // Now ingest the user message content again!
    let textToIngest = ''
    if (typeof content === 'string') {
      textToIngest = content
    }
    else if (Array.isArray(content)) {
      const textPart = content.find(part => 'type' in part && part.type === 'text') as { text?: string } | undefined
      textToIngest = textPart?.text || ''
    }

    if (textToIngest) {
      await chatOrchestrator.ingest(textToIngest, {})
      toast.success('Retrying message...')
    }
    else {
      toast.error('Cannot retry: User message content is empty.')
    }
  }
  else {
    toast.error('Cannot retry: No user message found before this response.')
  }
}

async function handleFork() {
  const messages = chatSession.getSessionMessages(chatSession.activeSessionId)
  const index = messages.findIndex(m => m.id === props.message.id)
  if (index !== -1) {
    try {
      const newSessionId = await chatSession.forkSession({
        fromSessionId: chatSession.activeSessionId,
        atIndex: index + 1, // Include this message
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
  const messages = chatSession.getSessionMessages(chatSession.activeSessionId)
  const index = messages.findIndex(m => m.id === props.message.id)
  if (index !== -1) {
    try {
      const newSessionId = await chatSession.forkSession({
        fromSessionId: chatSession.activeSessionId,
        atIndex: index + 1, // Include this message
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
  const rs: (ChatSlices | (ChatSlicesText & { displaySegments?: DisplaySegment[] }))[] = []

  let textBuffer = ''

  const processBuffer = () => {
    if (textBuffer.trim()) {
      rs.push({
        type: 'text',
        text: textBuffer,
        displaySegments: processContent(textBuffer),
      })
      textBuffer = ''
    }
  }

  for (const slice of slices.value) {
    if (slice.type === 'text') {
      textBuffer += slice.text
      continue
    }

    if (slice.type === 'tool-call') {
      processBuffer()
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
      processBuffer()
      continue
    }

    if ((slice as any).type === 'reasoning') {
      // Typically skipped, reasoning can be styled separately or omitted
    }
  }

  processBuffer()
  return rs
})

function getSegmentedText(sliceText: string): string {
  const raw = (props.message as any).rawContent

  if (!raw || typeof raw !== 'string' || !raw.includes('<|ACTOR:')) {
    return injectActorColors(sliceText)
  }

  // Check if we only have one text slice to make it perfectly safe
  const textSlicesCount = resolvedSlices.value.filter(s => s.type === 'text').length
  if (textSlicesCount === 1) {
    // Strip other tags (ACT and DELAY) from rawContent, leaving only text and ACTOR tags.
    // Use word boundary (\b) to avoid stripping <|ACTOR:...|> tags because ACTOR starts with ACT!
    const cleanedRaw = raw
      .replace(/<\|ACT\b[\s\S]*?(?:\|>|>)/gi, '')
      .replace(/<\|DELAY\b[\s\S]*?(?:\|>|>)/gi, '')

    return injectActorColors(cleanedRaw)
  }

  return injectActorColors(sliceText)
}

const dynamicStyles = computed(() => {
  const raw = (props.message as any).rawContent
  if (!raw || typeof raw !== 'string')
    return ''

  const actorRegex = /<\|ACTOR:\s*([\w-]+)\s*(?:\|>|>)/gi
  const actorIds = new Set<string>()
  let match
  actorRegex.lastIndex = 0
  while ((match = actorRegex.exec(raw)) !== null) {
    actorIds.add(match[1].trim())
  }

  let css = ''
  for (const actorId of actorIds) {
    // Generate a stable Hue based on the actor's ID string
    let hash = 0
    for (let i = 0; i < actorId.length; i++) {
      hash = actorId.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = Math.abs(hash) % 360

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
      :can-edit="false"
      placement="right"
      @copy="handleCopy"
      @delete="handleDelete"
      @fork="handleFork"
      @retry="handleRetry"
      @delete-following="handleDeleteFollowing"
      @fork-switch="handleForkAndSwitch"
      @journal="handleJournal"
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
            <div v-else-if="resolvedSlices.length > 0" class="break-words" :class="mood ? 'text-neutral-800 dark:text-neutral-200' : 'text-primary-700 dark:primary-100'">
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
                  <MarkdownRenderer :content="getSegmentedText(slice.text)" />
                </template>
              </template>
            </div>
            <div v-else-if="showLoader" i-eos-icons:three-dots-loading />

            <div v-if="message.categorization?.reasoning" mt-1 text-xs text-neutral-500 font-normal italic dark:text-neutral-400>
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
