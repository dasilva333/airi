<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'
import type { ChatProvider } from '@xsai-ext/providers/utils'

import { estimateTokens, formatTokenCount } from '@proj-airi/stage-shared'
import {
  CharacterContextDialog,
  ChatBrainPopover,
  ChatHistory,
  ChatImagesPopover,
  ChatMemoryPopover,
  ChatSessionModal,
  JournalPreviewModal,
  StageBackgroundDialogPicker,
} from '@proj-airi/stage-ui/components'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores/background'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatMaintenanceStore } from '@proj-airi/stage-ui/stores/chat/maintenance'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { useEchoesStore } from '@proj-airi/stage-ui/stores/echo-chips'
import { useJournalPreviewStore } from '@proj-airi/stage-ui/stores/journal-preview'
import { useShortTermMemoryStore } from '@proj-airi/stage-ui/stores/memory-short-term'
import { useTextJournalStore } from '@proj-airi/stage-ui/stores/memory-text-journal'
import { buildSystemPrompt, useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useAutonomousArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry-autonomous'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettingsChat } from '@proj-airi/stage-ui/stores/settings'
import { BasicTextarea } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { builtinTools } from '../stores/tools/builtin'

const router = useRouter()
const messageInput = ref('')
const attachments = ref<{ type: 'image', data: string, mimeType: string, url: string }[]>([])

const chatOrchestrator = useChatOrchestratorStore()
const chatSession = useChatSessionStore()
const chatStream = useChatStreamStore()
const textJournalStore = useTextJournalStore()
const backgroundStore = useBackgroundStore()
const airiCardStore = useAiriCardStore()
const echoesStore = useEchoesStore()

const { activeCard } = storeToRefs(airiCardStore)
const shortTermMemory = useShortTermMemoryStore()

const { cleanupMessages } = useChatMaintenanceStore()
const { ingest, onAfterMessageComposed } = chatOrchestrator
const { messages } = storeToRefs(chatSession)
const { streamingMessage } = storeToRefs(chatStream)
const { sending } = storeToRefs(chatOrchestrator)
const { activeCardId } = storeToRefs(airiCardStore)
const { t } = useI18n()
const providersStore = useProvidersStore()
const { activeModel, activeProvider } = storeToRefs(useConsciousnessStore())
const settingsChat = useSettingsChat()
const isComposing = ref(false)
const isImagineMode = ref(false)
const CHAT_WINDOW_TITLE = 'AIRI - Chat Window'

const journalPreviewStore = useJournalPreviewStore()
const visionStore = useVisionStore()
const { openTextPreview, openImagePreview, closePreview } = journalPreviewStore

function addImageAttachmentFromBase64(data: string, mimeType: string, _fileName?: string) {
  let url = ''
  try {
    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mimeType })
    url = URL.createObjectURL(blob)
  }
  catch {
    url = `data:${mimeType};base64,${data}`
  }

  attachments.value.push({
    type: 'image' as const,
    data,
    mimeType,
    url,
  })
}

// --- Journal Preview Data ---
const latestTextEntries = computed(() => {
  if (!activeCardId.value)
    return []

  const manualEntries = textJournalStore.entries
    .filter(e => e.characterId === activeCardId.value)
    .map(e => ({
      id: e.id,
      type: 'manual' as const,
      timestamp: e.createdAt,
      title: e.title,
      content: e.content,
    }))

  const autoEntries = shortTermMemory.getCharacterBlocks(activeCardId.value)
    .map((b) => {
      // Robust stripping of markdown code fences (``` or ~~~) with optional language tag
      const fenceMatch = b.summary.trim().match(/^(?:`{3,}|~{3,})[\w-]*\n?([\s\S]*?)\n?(?:`{3,}|~{3,})$/)
      const content = fenceMatch ? fenceMatch[1].trim() : b.summary.trim()

      return ({
        id: b.id,
        type: 'auto' as const,
        timestamp: b.updatedAt || b.createdAt,
        messageCount: b.messageCount,
        title: 'Daily Recap',
        content,
      })
    })

  const echoEntries = echoesStore.getCharacterChips(activeCardId.value)
    .map(c => ({
      id: c.id,
      type: 'echo' as const,
      echoType: c.type,
      timestamp: c.createdAt,
      title: c.type.charAt(0).toUpperCase() + c.type.slice(1).replace('_', ' '),
      content: c.content,
    }))

  return [...manualEntries, ...autoEntries, ...echoEntries]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 15)
})

const groupedTextEntries = computed(() => {
  const entries = latestTextEntries.value
  const groups: { type: 'single' | 'echo-group', entry?: any, items?: any[] }[] = []
  let tempEchoGroup: any[] = []

  entries.forEach((entry) => {
    if (entry.type === 'echo') {
      tempEchoGroup.push(entry)
    }
    else {
      if (tempEchoGroup.length > 0) {
        groups.push({ type: 'echo-group', items: [...tempEchoGroup] })
        tempEchoGroup = []
      }
      groups.push({ type: 'single', entry })
    }
  })

  if (tempEchoGroup.length > 0) {
    groups.push({ type: 'echo-group', items: tempEchoGroup })
  }

  return groups
})

const latestImageEntries = computed(() => {
  if (!activeCardId.value)
    return []
  return backgroundStore.journalEntries.slice(0, 15)
})

// --- Date Formatting ---
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-CA') // YYYY-MM-DD
}

function formatDayMonth(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatLocalDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const trashConfirmOpen = ref(false)
const showContext = ref(false)
const showSessions = ref(false)

const characterName = computed(() => activeCard.value?.name || 'AIRI')
const effectiveSystemPrompt = computed(() => buildSystemPrompt(activeCard.value))

function handleTrashClick() {
  const today = formatLocalDayKey(new Date())
  const isTodayCached = activeCardId.value && shortTermMemory.getCharacterBlocks(activeCardId.value).some(b => b.date === today)
  if (!isTodayCached && messages.value.length > 0) {
    trashConfirmOpen.value = true
    return
  }
  cleanupMessages()
}

async function handleSaveAndClear() {
  trashConfirmOpen.value = false
  if (activeCardId.value) {
    try {
      await shortTermMemory.rebuildToday(activeCardId.value)
    }
    catch (err) {
      console.error('[InteractiveArea] Failed to cache today before clear:', err)
    }
  }
  cleanupMessages()
}

function handleClearAnyway() {
  trashConfirmOpen.value = false
  cleanupMessages()
}

const stageBackgroundDialogOpen = ref(false)

// --- Deep Links ---

function navigateToConceptStudio() {
  if (!activeCardId.value)
    return
  router.push(`/settings/airi-card?cardId=${activeCardId.value}&tab=studio`)
}

function updateWindowTitle() {
  const nextTitle = messageInput.value.trim()
    ? `${CHAT_WINDOW_TITLE} - User Typing...`
    : CHAT_WINDOW_TITLE

  if (document.title !== nextTitle)
    document.title = nextTitle
}

async function handleSend() {
  if (isComposing.value) {
    return
  }

  if (!messageInput.value.trim() && !attachments.value.length) {
    return
  }

  const textToSend = messageInput.value

  const attachmentsToSend = attachments.value.map(att => ({ ...att }))

  // optimistic clear
  messageInput.value = ''
  localStorage.removeItem('airi-chatbox-draft')
  attachments.value = []

  if (isImagineMode.value) {
    const artistryStore = useAutonomousArtistryStore()
    void artistryStore.runArtistTask(textToSend, chatSession.messages as any, 'assistant')
    return
  }

  try {
    const providerConfig = providersStore.getProviderConfig(activeProvider.value)
    await ingest(textToSend, {
      model: activeModel.value,
      chatProvider: await providersStore.getProviderInstance<ChatProvider>(activeProvider.value),
      providerConfig,
      attachments: attachmentsToSend,
      tools: builtinTools,
    })

    attachmentsToSend.forEach(att => URL.revokeObjectURL(att.url))
  }
  catch (error) {
    // restore on failure
    messageInput.value = textToSend
    attachments.value = attachmentsToSend.map(att => ({
      ...att,
      url: URL.createObjectURL(new Blob([Uint8Array.from(atob(att.data), c => c.charCodeAt(0))], { type: att.mimeType })),
    }))
  }
}

async function handleFilePaste(files: File[]) {
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64Data = (e.target?.result as string)?.split(',')[1]
        if (base64Data) {
          addImageAttachmentFromBase64(base64Data, file.type, file.name)
        }
      }
      reader.readAsDataURL(file)
    }
  }
}

function addScreenshotAttachment(data: string, mimeType: string) {
  addImageAttachmentFromBase64(data, mimeType, 'screenshot.png')
}

async function handleScreenshotClick() {
  console.log('[InteractiveArea] Manual screenshot capture requested via visionStore...')
  try {
    const result = await visionStore.captureSnapshot({ width: 1280, height: 720 }) as any
    console.log('[InteractiveArea] Capture result:', result ? (result.error ? result.error : 'Success') : 'Null/Empty')

    if (result?.error === 'permission_denied') {
      toast.error('Screen recording permission required.', {
        action: { label: 'Open Settings', onClick: () => visionStore.openPermissionSettings() },
      })
      return
    }

    if (result?.dataUrl) {
      const base64 = result.dataUrl.split(',')[1]
      if (base64) {
        addScreenshotAttachment(base64, 'image/png')
        toast.success('Screenshot attached!')
      }
    }
    else {
      console.warn('[InteractiveArea] Capturing screenshot returned no data. Check screen recording permissions.')
      toast.error('Capture failed: No data.')
    }
  }
  catch (err) {
    console.error('[InteractiveArea] Screenshot capture failed:', err)
  }
}

async function handleInternalImageAttach({ url, title }: { url: string, title: string }) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64Data = (e.target?.result as string)?.split(',')[1]
      if (base64Data) {
        addImageAttachmentFromBase64(base64Data, blob.type, title)
        toast.success('Image attached to chat!')
      }
    }
    reader.readAsDataURL(blob)
  }
  catch (err) {
    console.error('[InteractiveArea] Failed to attach internal image:', err)
    toast.error('Failed to attach image.')
  }
}

async function captureAndSendScreenshot() {
  console.log('[InteractiveArea] Auto-send screenshot requested (shortcut) via visionStore...')
  try {
    const result = await visionStore.captureSnapshot({ width: 1280, height: 720 }) as any
    if (result?.error === 'permission_denied') {
      toast.error('Permission denied. Cannot auto-send.', {
        action: { label: 'Settings', onClick: () => visionStore.openPermissionSettings() },
      })
      return
    }
    if (result?.dataUrl) {
      const base64 = result.dataUrl.split(',')[1]
      if (base64) {
        addScreenshotAttachment(base64, 'image/png')
        await handleSend()
      }
    }
    else {
      console.warn('[InteractiveArea] Auto-send screenshot failed: No data. Check permissions.')
      toast.error('Auto-send failed: No data.')
    }
  }
  catch (err) {
    console.error('[InteractiveArea] Auto-send screenshot capture failed:', err)
  }
}

const isDragging = ref(false)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.length) {
    handleFilePaste(Array.from(target.files))
  }
  target.value = ''
}

function stopDrag() {
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files?.length) {
    handleFilePaste(Array.from(e.dataTransfer.files))
  }
}

function removeAttachment(index: number) {
  const attachment = attachments.value[index]
  if (attachment) {
    URL.revokeObjectURL(attachment.url)
    attachments.value.splice(index, 1)
  }
}

onAfterMessageComposed(async () => {
  messageInput.value = ''
  localStorage.removeItem('airi-chatbox-draft')
  attachments.value.forEach(att => URL.revokeObjectURL(att.url))
  attachments.value = []
})

const historyMessages = computed(() => messages.value as unknown as ChatHistoryItem[])

// --- Token Counter ---
const sessionTokenCount = computed(() => {
  let total = 0
  for (const message of historyMessages.value) {
    if (typeof message.content === 'string') {
      total += estimateTokens(message.content)
    }
    else if (Array.isArray(message.content)) {
      const textOnly = message.content
        .map((part) => {
          if (typeof part === 'string')
            return part
          if (part && typeof part === 'object' && 'text' in part && !('image_url' in part))
            return String(part.text ?? '')
          return ''
        })
        .join('')
      total += estimateTokens(textOnly)
    }
  }
  return total
})

const formattedTokenCount = computed(() => formatTokenCount(sessionTokenCount.value))

const globalContextWidth = computed(() => {
  if (activeCard.value?.extensions?.airi?.generation?.known?.contextWidth)
    return undefined

  if (!activeProvider.value || !activeModel.value)
    return undefined

  try {
    const rawMap = localStorage.getItem('airi:context-width-map')
    if (!rawMap)
      return undefined

    const map = JSON.parse(rawMap)
    return map[activeProvider.value]?.[activeModel.value]
  }
  catch {
    return undefined
  }
})

const effectiveContextWidth = computed(() => activeCard.value?.extensions?.airi?.generation?.known?.contextWidth || globalContextWidth.value)

const contextPercentage = computed(() => {
  if (!effectiveContextWidth.value)
    return 0
  return (sessionTokenCount.value / effectiveContextWidth.value) * 100
})

onMounted(() => {
  updateWindowTitle()
  
  const savedDraft = localStorage.getItem('airi-chatbox-draft')
  if (savedDraft) {
    messageInput.value = savedDraft
  }
  
  textJournalStore.load()
  shortTermMemory.load()
  echoesStore.load()

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'F7') {
      e.preventDefault()
      captureAndSendScreenshot()
    }
  }

  window.addEventListener('keydown', handleKeyDown)
})

let lastSaveTime = 0
let throttleTimeout: ReturnType<typeof setTimeout> | null = null

watch(messageInput, (newVal) => {
  updateWindowTitle()
  
  const now = Date.now()
  const timeSinceLastSave = now - lastSaveTime

  if (timeSinceLastSave >= 5000) {
    localStorage.setItem('airi-chatbox-draft', newVal)
    lastSaveTime = now
  }
  else {
    if (throttleTimeout) {
      clearTimeout(throttleTimeout)
    }
    throttleTimeout = setTimeout(() => {
      localStorage.setItem('airi-chatbox-draft', newVal)
      lastSaveTime = Date.now()
    }, 5000 - timeSinceLastSave)
  }
})
</script>

<template>
  <div
    h-full w-full flex="~ col gap-1"
    :class="[isDragging ? 'ring-2 ring-primary-500 rounded-lg overflow-hidden' : '']"
    @dragenter.prevent="isDragging = true"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="stopDrag"
    @drop.prevent="handleDrop"
    @keydown.escape="closePreview"
  >
    <input ref="fileInput" type="file" accept="image/*" class="hidden" multiple @change="handleFileSelect">
    <div w-full flex-1 overflow-hidden>
      <ChatHistory
        :messages="historyMessages"
        :sending="sending"
        :streaming-message="streamingMessage"
      />
    </div>

    <!-- Journal Preview Chips -->
    <div v-if="latestTextEntries.length > 0 || latestImageEntries.length > 0" class="w-full flex gap-2 px-2 py-1">
      <!-- Text Journal Chips -->
      <div
        v-if="groupedTextEntries.length > 0"
        :class="[
          latestImageEntries.length > 0 ? 'w-1/2' : 'w-full',
          'flex gap-2 overflow-x-auto scrollbar-none',
        ]"
      >
        <template v-for="(group, idx) in groupedTextEntries" :key="idx">
          <!-- Echo Group (2-story Ticker) -->
          <div v-if="group.type === 'echo-group'" class="h-14 min-w-fit flex flex-col flex-wrap gap-1">
            <div
              v-for="entry in group.items"
              :key="entry.id"
              :class="[
                'h-[26px] flex items-center gap-2 shrink-0 cursor-pointer px-2 py-1 rounded-lg border border-opacity-30 transition-all',
                entry.echoType === 'mood' ? 'bg-rose-50/50 border-rose-200 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400'
                : entry.echoType === 'flavor' ? 'bg-amber-50/50 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                  : 'bg-indigo-50/50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400',
              ]"
              @click="openTextPreview(entry)"
            >
              <div class="flex items-center gap-1 text-[8px] font-bold tracking-tighter uppercase opacity-70">
                <span>{{ formatDayMonth(entry.timestamp) }}</span>
                <div
                  :class="[
                    'text-[10px]',
                    entry.echoType === 'mood' ? 'i-solar:heart-bold-duotone'
                    : entry.echoType === 'flavor' ? 'i-solar:tag-bold-duotone'
                      : 'i-solar:magic-stick-3-bold-duotone',
                  ]"
                />
              </div>
              <span class="max-w-40 truncate text-[10px] font-bold leading-none">{{ entry.content }}</span>
            </div>
          </div>

          <!-- Single Entries (DNA Snaps / Emerald Cards) -->
          <div v-else-if="group.type === 'single'" @click="openTextPreview(group.entry)">
            <!-- STMM (Auto) Square Block -->
            <div
              v-if="group.entry.type === 'auto'"
              :class="[
                'h-14 w-14 shrink-0 flex flex-col items-center justify-between p-1 cursor-pointer',
                'border border-primary-200/30 rounded-lg bg-primary-50/50 transition-all hover:bg-primary-100/50',
                'dark:border-primary-800/30 dark:bg-primary-900/30 dark:hover:bg-primary-800/50',
              ]"
            >
              <span class="mt-0.5 text-[9px] text-primary-500/80 font-bold leading-none">{{ formatDayMonth(group.entry.timestamp) }}</span>
              <div class="i-solar:dna-bold-duotone text-sm text-primary-500" />
              <span class="mb-0.5 text-[8px] text-primary-400 font-bold leading-none font-mono dark:text-primary-500">{{ group.entry.messageCount }}</span>
            </div>

            <!-- Manual Journal Card -->
            <div
              v-else
              :class="[
                'min-w-28 max-w-40 h-14 flex flex-col shrink-0 cursor-pointer p-2 text-xs',
                'border border-emerald-200/30 rounded-lg bg-emerald-50/50 transition-all hover:bg-emerald-100/50',
                'dark:border-emerald-800/30 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50',
              ]"
            >
              <div :class="['flex items-center gap-1', 'text-emerald-500 text-[10px] font-bold uppercase tracking-tighter leading-none mb-1']">
                <div class="i-solar:notebook-bold-duotone" />
                <span>{{ formatDate(group.entry.timestamp) }}</span>
              </div>
              <div :class="['line-clamp-2 text-[10px] leading-tight', 'text-emerald-900/70 dark:text-emerald-100/70']">
                {{ group.entry.title }}
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Image Journal Chips -->
      <div
        v-if="latestImageEntries.length > 0"
        :class="[
          latestTextEntries.length > 0 ? 'w-1/2' : 'w-full',
          'flex gap-2 overflow-x-auto scrollbar-none',
        ]"
      >
        <div
          v-for="entry in latestImageEntries"
          :key="entry.id"
          :class="[
            'group relative h-14 w-14 shrink-0 cursor-pointer of-hidden rounded-lg',
            'border border-primary-200/30 transition-all hover:border-primary-500',
            'dark:border-primary-800/30 dark:hover:border-primary-400',
          ]"
          @click="openImagePreview(entry)"
        >
          <img :src="entry.url || ''" class="h-full w-full object-cover">
          <div :class="['absolute inset-0 flex items-end p-1', 'bg-gradient-to-t from-black/60 to-transparent']">
            <span class="truncate text-[8px] text-white font-medium">{{ entry.title }}</span>
          </div>

          <!-- Save Button (Top Right, Hover Only) -->
          <button
            :class="[
              'absolute right-1 top-1 z-10 p-1 rounded-md bg-black/40 text-white backdrop-blur-sm',
              'opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60',
            ]"
            title="Save to computer"
            @click.stop="journalPreviewStore.downloadImage(entry.url || '', entry.title)"
          >
            <div class="i-solar:download-minimalistic-bold-duotone text-[10px]" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="attachments.length > 0" class="flex flex-wrap gap-2 border-t border-primary-100 p-2">
      <div v-for="(attachment, index) in attachments" :key="index" class="relative">
        <img :src="attachment.url" class="h-20 w-20 rounded-md object-cover">
        <button class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-xs text-white" @click="removeAttachment(index)">
          &times;
        </button>
      </div>
    </div>

    <div class="flex items-center justify-end gap-2 py-1">
      <div
        v-if="effectiveContextWidth"
        class="flex cursor-help items-center gap-1.5 px-2 py-1"
        :title="`${globalContextWidth ? '[Inherited] ' : ''}Context: ${formattedTokenCount} / ${formatTokenCount(effectiveContextWidth)} (${contextPercentage.toFixed(1)}%)`"
      >
        <div class="i-solar:graph-bold-duotone text-[10px] text-neutral-400 dark:text-neutral-500" />
        <span class="text-[10px] text-neutral-400 font-bold leading-none tracking-tight uppercase dark:text-neutral-500">{{ formattedTokenCount }}</span>
        <div class="h-1.5 w-12 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            class="h-full transition-all duration-300"
            :class="[
              contextPercentage > 85 ? 'bg-red-500' : contextPercentage > 60 ? 'bg-amber-500' : 'bg-emerald-500',
            ]"
            :style="{ width: `${Math.min(contextPercentage, 100)}%` }"
          />
        </div>
      </div>
      <div
        v-else
        class="flex cursor-help items-center gap-1.5 px-2 py-1 text-[10px] font-bold tracking-tight uppercase"
        :class="[
          sessionTokenCount > 100000 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-400 dark:text-neutral-500',
        ]"
        title="Est. of tokens used for this chat"
      >
        <div class="i-solar:graph-bold-duotone text-xs" />
        <span>{{ formattedTokenCount }}</span>
      </div>

      <!-- Grounding Toggle -->
      <button
        :class="[
          'max-h-[10lh] min-h-[1lh]',
          'flex items-center justify-center rounded-md p-2 outline-none',
          'transition-colors transition-transform active:scale-95',
          activeCard?.extensions?.airi?.groundingEnabled
            ? 'bg-amber-100 text-lg text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
            : 'bg-neutral-100 text-lg text-neutral-500 hover:text-primary-500 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-primary-400',
        ]"
        :title="activeCard?.extensions?.airi?.groundingEnabled ? 'Grounding Active — sensor data attached to messages' : 'Attach sensor data with each message (Visit Proactivity tab to preview)'"
        @click="airiCardStore.toggleGrounding(activeCardId)"
      >
        <div :class="[activeCard?.extensions?.airi?.groundingEnabled ? 'i-solar:cpu-bolt-bold-duotone' : 'i-solar:cpu-bold-duotone']" />
      </button>

      <!-- Model & Provider Selection -->
      <ChatBrainPopover />

      <!-- Memory & Context -->
      <ChatMemoryPopover
        show-cache-status
        :title="`Memory & Context for ${characterName}`"
        @view-context="showContext = true"
        @manage-sessions="showSessions = true"
      />

      <ChatImagesPopover
        :imagine-mode="isImagineMode"
        :hide-toolbar-style="true"
        @toggle-imagine="isImagineMode = !isImagineMode"
        @attach="fileInput?.click()"
        @screenshot="handleScreenshotClick"
        @view-journal="stageBackgroundDialogOpen = true"
        @open-studio="navigateToConceptStudio"
      />

      <!-- Clear Messages (with safety hook) -->
      <button
        class="max-h-[10lh] min-h-[1lh]"
        bg="neutral-100 dark:neutral-800"
        text="lg neutral-500 dark:neutral-400"
        hover:text="red-500 dark:red-400"
        flex items-center justify-center rounded-md p-2 outline-none
        transition-colors transition-transform active:scale-95
        title="Clear Messages"
        @click="handleTrashClick"
      >
        <div class="i-solar:trash-bin-2-bold-duotone" />
      </button>

      <!-- Send (Dual Use) -->
      <div
        class="flex items-center gap-0.5 overflow-hidden rounded-lg shadow-sm transition-colors"
        bg="primary-500 hover:primary-600"
        max-h="[10lh]"
      >
        <button
          class="h-9 flex items-center justify-center px-3 outline-none transition-transform active:scale-95"
          text="white"
          title="Send Message"
          @click="handleSend"
        >
          <div class="i-solar:plain-2-bold-duotone mr-1.5 text-lg" />
          <span class="text-xs font-bold leading-none tracking-tighter uppercase">Send</span>
        </button>

        <PopoverRoot>
          <PopoverTrigger as-child>
            <button
              class="h-9 w-6 flex items-center justify-center border-l border-white/20 outline-none hover:bg-white/10"
              text="white"
              title="Change Send Key Mode"
            >
              <div class="i-solar:alt-arrow-down-linear text-xs" />
            </button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent
              class="z-100 flex flex-col gap-1 border border-neutral-200 rounded-xl bg-white/95 p-1.5 shadow-2xl backdrop-blur-md dark:border-neutral-700 dark:bg-neutral-900/95"
              side="top"
              align="end"
              :side-offset="12"
            >
              <div class="px-2 py-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                Send Key Mode
              </div>
              <button
                v-for="mode in (['enter', 'ctrl-enter', 'double-enter'] as const)"
                :key="mode"
                :class="[
                  'px-3 py-2 text-xs font-semibold rounded-lg transition-all text-left flex items-center justify-between gap-4',
                  settingsChat.sendMode === mode
                    ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-300'
                    : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
                ]"
                @click="settingsChat.sendMode = mode"
              >
                <span>{{ mode === 'enter' ? 'Enter' : mode === 'ctrl-enter' ? 'Ctrl + Enter' : 'Double Enter' }}</span>
                <div v-if="settingsChat.sendMode === mode" class="i-solar:check-circle-bold text-sm" />
              </button>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
      </div>
    </div>
    <BasicTextarea
      v-model="messageInput"
      :send-mode="settingsChat.sendMode"
      :placeholder="isImagineMode ? 'Describe a scene to imagine...' : t('stage.message')"
      class="ph-no-capture"
      text="primary-600 dark:primary-100  placeholder:primary-500 dark:placeholder:primary-200"
      border="solid 2 primary-200/20 dark:primary-400/20"
      bg="primary-100/50 dark:primary-900/70"
      max-h="[10lh]" min-h="[1lh]"
      w-full shrink-0 resize-none overflow-y-scroll rounded-xl p-2 font-medium outline-none
      transition="all duration-250 ease-in-out placeholder:all placeholder:duration-250 placeholder:ease-in-out"
      @submit="handleSend"
      @compositionstart="isComposing = true"
      @compositionend="isComposing = false"
      @attach="handleFilePaste"
    />

    <!-- Context Dialog -->
    <ChatSessionModal
      v-model="showSessions"
    />

    <CharacterContextDialog
      v-model="showContext"
      :character-name="characterName"
      :system-prompt="effectiveSystemPrompt"
    />

    <!-- Trash Safety Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="trashConfirmOpen"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          @click.self="trashConfirmOpen = false"
        >
          <div
            :class="[
              'relative mx-4 max-w-sm w-full overflow-hidden rounded-2xl',
              'bg-white shadow-2xl dark:bg-neutral-900',
              'animate-scale-in',
            ]"
          >
            <div class="px-5 pb-3 pt-5">
              <div :class="['flex items-center gap-2 text-base font-bold', 'text-neutral-800 dark:text-neutral-100']">
                <div class="i-solar:danger-triangle-bold-duotone text-amber-500" />
                Unsaved Memories
              </div>
              <p :class="['mt-2 text-sm leading-relaxed', 'text-neutral-600 dark:text-neutral-400']">
                You haven't saved today's memories yet. Your character may lose context from this session.
              </p>
            </div>

            <div :class="['flex gap-2 border-t px-5 py-3', 'border-neutral-200/50 dark:border-neutral-700/50']">
              <button
                :class="[
                  'flex-1 rounded-lg px-3 py-2 text-xs font-semibold',
                  'bg-primary-500 text-white transition-colors',
                  'hover:bg-primary-600',
                ]"
                :disabled="shortTermMemory.rebuilding"
                @click="handleSaveAndClear"
              >
                {{ shortTermMemory.rebuilding ? 'Saving...' : 'Save & Clear' }}
              </button>
              <button
                :class="[
                  'flex-1 rounded-lg px-3 py-2 text-xs font-semibold',
                  'bg-red-100 text-red-600 transition-colors',
                  'hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-800/30',
                ]"
                @click="handleClearAnyway"
              >
                Clear Anyway
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Journal Preview Modal -->
    <JournalPreviewModal @attach="handleInternalImageAttach" />

    <!-- Stage Background Dialog Picker -->
    <StageBackgroundDialogPicker v-model="stageBackgroundDialogOpen" :card-id="activeCardId" />
  </div>
</template>

<style scoped>
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@keyframes scale-in {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-scale-in {
  animation: scale-in 0.2s ease-out;
}
</style>
