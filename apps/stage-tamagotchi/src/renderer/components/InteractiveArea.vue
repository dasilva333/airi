<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'

// Watch messageInput and search universe-scoped memory context
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import {
  CharacterContextDialog,
  ChatHistory,
  ChatImagesPopover,
  ChatSessionModal,
  JournalMomentModal,
  JournalPreviewModal,
  MarkdownRenderer,
  ProducerGuidanceModal,
  StageBackgroundDialogPicker,
} from '@proj-airi/stage-ui/components'
import { useProducer } from '@proj-airi/stage-ui/composables'
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
import { useProactivityStore } from '@proj-airi/stage-ui/stores/proactivity'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettingsChat } from '@proj-airi/stage-ui/stores/settings'
import { BasicTextarea, Button } from '@proj-airi/ui'
import { useLocalStorage, watchDebounced } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { noticeWindowEventa } from '../../shared/eventa'

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
const { messages, activeSessionId } = storeToRefs(chatSession)
const { streamingMessage } = storeToRefs(chatStream)
const { sending } = storeToRefs(chatOrchestrator)
const { activeCardId } = storeToRefs(airiCardStore)
const { t } = useI18n()
const providersStore = useProvidersStore()
const { activeModel, activeProvider } = storeToRefs(useConsciousnessStore())
const settingsChat = useSettingsChat()
const isComposing = ref(false)
const CHAT_WINDOW_TITLE = 'AIRI - Chat Window'

const isMemoriesCollapsed = useLocalStorage('airi:chat:memories-collapsed', false)
const isMediaCollapsed = useLocalStorage('airi:chat:media-collapsed', false)
const showJournalModal = ref(false)
const showImagineDialog = ref(false)
const imaginePrompt = ref('')

async function handleJournalSubmit(data: { scope: 'all' | 'turns', turns?: number, instructions: string, promptTemplate?: string }) {
  let msgSlice = historyMessages.value
  if (data.scope === 'turns' && data.turns) {
    msgSlice = historyMessages.value.slice(-data.turns)
  }

  toast.promise(
    textJournalStore.createJournalMoment({
      messages: msgSlice,
      instructions: data.instructions,
      promptTemplate: data.promptTemplate,
      modelId: activeModel.value,
      providerId: activeProvider.value,
    }),
    {
      loading: 'Generating journal entry...',
      success: 'Journal entry created!',
      error: 'Failed to create journal entry.',
    },
  )
  showJournalModal.value = false
}

function handleImagineSubmit() {
  if (!imaginePrompt.value.trim())
    return
  showImagineDialog.value = false

  toast.promise(
    artistryStore.runArtistTask(imaginePrompt.value.trim(), chatSession.messages as any, 'assistant'),
    {
      loading: 'Generating background image scene...',
      success: 'Scene added to Media Gallery!',
      error: 'Failed to generate scene.',
    },
  )
}

const proactivityStore = useProactivityStore()
const isGroundingPreviewExpanded = ref(false)
const isMemoriesPreviewExpanded = ref(true)
const isTopicsPreviewExpanded = ref(true)
const isScratchpadPreviewExpanded = ref(true)
const artistryStore = useAutonomousArtistryStore()

const latestDirectorScratchpad = computed(() => {
  if (!artistryStore.directorNotes || artistryStore.directorNotes.length === 0)
    return ''
  const sortedNotes = [...artistryStore.directorNotes].sort((a, b) => b.createdAt - a.createdAt)
  const lastNoteWithScratchpad = sortedNotes.find(n => !!n.scratchpad)
  return lastNoteWithScratchpad?.scratchpad || ''
})

const groundedMemories = ref<any[]>([])

watchDebounced(
  messageInput,
  async (newVal) => {
    const isMemoryEnabled = activeCard.value?.extensions?.airi?.groundingMemoryEnabled
    if (!isMemoryEnabled) {
      groundedMemories.value = []
      return
    }

    const query = newVal.trim()
    if (query.length <= 3) {
      groundedMemories.value = []
      return
    }

    try {
      const results = await textJournalStore.searchEntries({
        query,
        limit: 3,
        characterId: activeCardId.value,
      })
      groundedMemories.value = results
    }
    catch (err) {
      console.error('[InteractiveArea] Failed to search semantic memory context:', err)
      groundedMemories.value = []
    }
  },
  { debounce: 1000 },
)

watch(
  () => activeCard.value?.extensions?.airi?.groundingMemoryEnabled,
  async (enabled) => {
    if (!enabled) {
      groundedMemories.value = []
    }
    else if (messageInput.value.trim().length > 3) {
      try {
        const results = await textJournalStore.searchEntries({
          query: messageInput.value.trim(),
          limit: 3,
          characterId: activeCardId.value,
        })
        groundedMemories.value = results
      }
      catch (err) {
        console.error('[InteractiveArea] Failed to search semantic memory context:', err)
        groundedMemories.value = []
      }
    }
  },
)

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

const allTextEntries = computed(() => {
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
      source: e.source,
    }))

  const autoEntries = shortTermMemory.getCharacterBlocks(activeCardId.value)
    .map((b) => {
      const fenceMatch = b.summary.trim().match(/^(?:`{3,}|~{3,})[\w-]*\n?([\s\S]*?)\n?(?:`{3,}|~{3,})$/)
      const content = fenceMatch ? fenceMatch[1].trim() : b.summary.trim()
      return {
        id: b.id,
        type: 'auto' as const,
        timestamp: b.updatedAt || b.createdAt,
        messageCount: b.messageCount,
        sessionCount: b.sessionCount,
        estimatedTokens: b.estimatedTokens,
        title: `Daily Recap — ${b.date}`,
        content,
      }
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

const allImageEntries = computed(() => {
  if (!activeCardId.value)
    return []
  return backgroundStore.journalEntries
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

const isProducerModalOpen = ref(false)
const producerSuggestion = ref<{ type: 'producer-suggestion', choices: Array<{ title: string, message: string }>, loading?: boolean, createdAt: number } | null>(null)
const { generateSuggestions } = useProducer()
const lastProducerConfig = ref<{ guidance: string, contextDepth: number, count: number, shortReplies: boolean } | null>(null)

const requestNotice = useElectronEventaInvoke(noticeWindowEventa.openWindow)

const quickSuggestContextDepth = useLocalStorage('airi:producer:context-depth', 6)
const quickSuggestCount = useLocalStorage('airi:producer:suggestion-count', 4)
const quickSuggestShortReplies = useLocalStorage('airi:producer:short-replies', true)

function handleOpenUserProfile() {
  void requestNotice({
    id: 'user-profile',
    route: '#/settings/system/user-profile',
    type: 'user-profile',
  }).catch((err: any) => {
    console.error('Failed to open user profile notice:', err)
  })
}

function handleQuickSuggest() {
  const input = messageInput.value.trim()
  if (input) {
    messageInput.value = ''
    handleProducerSubmit({
      guidance: input,
      contextDepth: quickSuggestContextDepth.value,
      count: quickSuggestCount.value,
      shortReplies: quickSuggestShortReplies.value,
    })
  }
  else {
    isProducerModalOpen.value = true
  }
}

async function handleProducerSubmit(payload: { guidance: string, contextDepth: number, count: number, shortReplies: boolean }) {
  lastProducerConfig.value = payload
  producerSuggestion.value = {
    type: 'producer-suggestion',
    choices: [],
    loading: true,
    createdAt: Date.now(),
  }

  try {
    const choices = await generateSuggestions({
      characterName: characterName.value,
      messages: messages.value as unknown as ChatHistoryItem[],
      guidance: payload.guidance,
      contextDepth: payload.contextDepth,
      count: payload.count,
      shortReplies: payload.shortReplies,
    })

    producerSuggestion.value = {
      type: 'producer-suggestion',
      choices,
      loading: false,
      createdAt: Date.now(),
    }
  }
  catch (err) {
    producerSuggestion.value = null
    toast.error('Failed to generate suggestions. Please check your provider settings.')
  }
}

async function handleRetryProducer() {
  if (!lastProducerConfig.value) {
    isProducerModalOpen.value = true
    return
  }
  await handleProducerSubmit(lastProducerConfig.value)
}

function handleDeleteProducer() {
  producerSuggestion.value = null
}

function handleChooseOption(choice: { title: string, message: string }, isPlaybackOnly = false) {
  messageInput.value = choice.message

  // Focus the textarea
  const textarea = document.querySelector('.ph-no-capture textarea') as HTMLTextAreaElement | null
  if (textarea) {
    textarea.focus()
  }

  // Auto-send if checked (ONLY if NOT playback only)
  if (!isPlaybackOnly) {
    const autoSend = localStorage.getItem('airi:producer:auto-send') === 'true'
    if (autoSend) {
      handleSend()
    }
  }
}

watch(activeCardId, () => {
  producerSuggestion.value = null
  lastProducerConfig.value = null
})

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

function updateWindowTitle() {
  const nextTitle = messageInput.value.trim()
    ? `${CHAT_WINDOW_TITLE} - User Typing...`
    : CHAT_WINDOW_TITLE

  if (document.title !== nextTitle)
    document.title = nextTitle
}

let isOptimisticClearing = false

async function handleSend() {
  if (isComposing.value) {
    return
  }

  const isEmptyInput = !messageInput.value.trim() && !attachments.value.length

  if (isEmptyInput && hasVisibleMessages.value) {
    return
  }

  const textToSend = messageInput.value
  const attachmentsToSend = attachments.value.map(att => ({ ...att }))

  // optimistic clear without deleting draft from localStorage immediately
  isOptimisticClearing = true
  messageInput.value = ''
  attachments.value = []
  groundedMemories.value = []
  isOptimisticClearing = false

  try {
    const providerConfig = providersStore.getProviderConfig(activeProvider.value)

    if (isEmptyInput && !hasVisibleMessages.value) {
      await ingest('INVOKE_CHARACTER_FIRST', {
        model: activeModel.value,
        chatProvider: activeProvider.value,
        providerConfig,
        triggerOnly: true,
      })
    }
    else {
      await ingest(textToSend, {
        model: activeModel.value,
        chatProvider: activeProvider.value,
        providerConfig,
        attachments: attachmentsToSend,
      })
    }

    attachmentsToSend.forEach(att => URL.revokeObjectURL(att.url))
  }
  catch {
    // restore on failure
    if (!isEmptyInput) {
      messageInput.value = textToSend
      attachments.value = attachmentsToSend.map(att => ({
        ...att,
        url: URL.createObjectURL(new Blob([Uint8Array.from(atob(att.data), c => c.charCodeAt(0))], { type: att.mimeType })),
      }))
    }
    toast.error('Message failed to send. Draft restored.')
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
  producerSuggestion.value = null
})

const historyMessages = computed(() => {
  const base = messages.value as unknown as ChatHistoryItem[]
  if (producerSuggestion.value) {
    return [...base, producerSuggestion.value]
  }
  return base
})

const hasVisibleMessages = computed(() => {
  return messages.value.some(m => m.role === 'user' || m.role === 'assistant')
})

const isGreetMode = computed(() => !hasVisibleMessages.value && !messageInput.value.trim())

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

  if (isOptimisticClearing) {
    return
  }

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
      if (isOptimisticClearing)
        return
      localStorage.setItem('airi-chatbox-draft', newVal)
      lastSaveTime = Date.now()
    }, 5000 - timeSinceLastSave)
  }
})

// --- Semantic Search Modal State & Handlers ---
const isSearchModalOpen = ref(false)
const modalSearchTerm = ref('')
const modalIsSearching = ref(false)
const modalSearchResults = ref<any[]>([])

function openSearchModal() {
  modalSearchTerm.value = ''
  modalSearchResults.value = []
  isSearchModalOpen.value = true
}

let modalSearchTimeout: any = null
watch(modalSearchTerm, (term) => {
  if (modalSearchTimeout)
    clearTimeout(modalSearchTimeout)

  const trimmed = term.trim()
  if (!trimmed) {
    modalSearchResults.value = []
    return
  }

  modalSearchTimeout = setTimeout(async () => {
    modalIsSearching.value = true
    try {
      const results = await textJournalStore.searchEntries({
        query: trimmed,
        limit: 30,
      })
      modalSearchResults.value = results.filter(
        res => !activeCardId.value || res.characterId === activeCardId.value,
      )
    }
    catch (err) {
      console.error('[InteractiveArea:Search] Semantic search failed:', err)
      modalSearchResults.value = []
    }
    finally {
      modalIsSearching.value = false
    }
  }, 300)
})

function isSameSession(entry: any) {
  if (!entry.source?.startsWith('chat:'))
    return false
  const sid = entry.source.replace('chat:', '')
  return sid === activeSessionId.value
}

function jumpToMessage(messageId: string) {
  isSearchModalOpen.value = false
  nextTick(() => {
    const el = document.getElementById(`msg-${messageId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-primary-500/10')
      setTimeout(() => {
        el.classList.remove('bg-primary-500/10')
      }, 2000)
    }
  })
}

defineExpose({
  showContext,
  showSessions,
  openSearchModal,
  handleTrashClick,
  showJournalModal,
  latestImageEntries,
  allImageEntries,
  allTextEntries,
  openImagePreview,
  openTextPreview,
  openImagineDialog: () => {
    showImagineDialog.value = true
    imaginePrompt.value = ''
  },
  openBackgroundDialog: () => {
    stageBackgroundDialogOpen.value = true
  },
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
        @choose="handleChooseOption"
        @retry-producer="handleRetryProducer"
        @delete-producer="handleDeleteProducer"
      />
    </div>

    <!-- Journal Preview Chips -->
    <div v-if="latestTextEntries.length > 0 || latestImageEntries.length > 0" class="w-full flex flex-col gap-2 px-2 py-1">
      <!-- Unified Header Bar with Collapsible Badges -->
      <div class="h-[22px] flex select-none items-center justify-between px-1">
        <div class="flex items-center gap-3">
          <!-- Memories Badge -->
          <span
            v-if="groupedTextEntries.length > 0"
            :class="['flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer',
                     isMemoriesCollapsed ? 'bg-neutral-100/50 text-neutral-400 dark:bg-neutral-800/50' : 'bg-primary-50/50 text-primary-500 dark:bg-primary-950/30 dark:text-primary-400']"
            @click="isMemoriesCollapsed = !isMemoriesCollapsed"
          >
            Memories
            <span :class="isMemoriesCollapsed ? 'i-solar:eye-closed-linear' : 'i-solar:eye-linear'" class="text-xs" />
          </span>
          <!-- Media Gallery Badge -->
          <span
            v-if="latestImageEntries.length > 0"
            :class="['flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer',
                     isMediaCollapsed ? 'bg-neutral-100/50 text-neutral-400 dark:bg-neutral-800/50' : 'bg-primary-50/50 text-primary-500 dark:bg-primary-950/30 dark:text-primary-400']"
            @click="isMediaCollapsed = !isMediaCollapsed"
          >
            Media Gallery
            <span :class="isMediaCollapsed ? 'i-solar:eye-closed-linear' : 'i-solar:eye-linear'" class="text-xs" />
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="groupedTextEntries.length > 0"
            class="select-none text-[10px] text-primary-500 font-bold transition-colors hover:text-primary-600"
            @click="showJournalModal = true"
          >
            + New
          </button>
          <button
            v-if="latestImageEntries.length > 0"
            class="select-none text-[10px] text-primary-500 font-bold transition-colors hover:text-primary-600"
            @click="showImagineDialog = true; imaginePrompt = ''"
          >
            + Add
          </button>
          <button
            v-if="latestImageEntries.length > 0"
            class="select-none text-[10px] text-neutral-400 font-bold transition-colors hover:text-neutral-600"
            @click="stageBackgroundDialogOpen = true"
          >
            View All
          </button>
        </div>
      </div>

      <!-- Section Bodies -->
      <div class="w-full flex flex-col gap-3 md:flex-row">
        <!-- Text Journal Chips -->
        <div
          v-if="groupedTextEntries.length > 0 && !isMemoriesCollapsed"
          :class="[
            latestImageEntries.length > 0 && !isMediaCollapsed ? 'w-full md:w-1/2' : 'w-full',
            'flex flex-col gap-1 min-w-0',
          ]"
        >
          <div class="animate-in fade-in flex gap-2 overflow-x-auto duration-200 scrollbar-none">
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
        </div>

        <!-- Image Journal Chips -->
        <div
          v-if="latestImageEntries.length > 0 && !isMediaCollapsed"
          :class="[
            latestTextEntries.length > 0 && !isMemoriesCollapsed ? 'w-full md:w-1/2' : 'w-full',
            'flex flex-col gap-1 min-w-0',
          ]"
        >
          <div class="animate-in fade-in flex gap-2 overflow-x-auto duration-200 scrollbar-none">
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

    <!-- Ephemeral Grounding Preview Block -->
    <div
      v-if="activeCard?.extensions?.airi?.groundingEnabled || (activeCard?.extensions?.airi?.groundingMemoryEnabled && groundedMemories.length > 0) || (activeCard?.extensions?.airi?.groundingTopicsEnabled && activeCard?.extensions?.airi?.recentTopics?.length) || (activeCard?.extensions?.airi?.groundingDirectorScratchpadEnabled && latestDirectorScratchpad)"
      class="grounding-preview-panel relative mx-2 flex flex-col border border-amber-500/20 rounded-lg bg-black/40 p-2 text-sm text-amber-200 font-mono shadow-[0_0_15px_rgba(245,158,11,0.05)] backdrop-blur-md transition-colors hover:bg-black/60"
    >
      <div class="pointer-events-none absolute inset-0 bg-[length:100%_4px] bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] opacity-20" />

      <!-- Header / Control bar -->
      <div class="z-10 flex select-none items-center justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <span class="i-solar:cpu-bolt-bold-duotone animate-pulse text-amber-500" />
          <span class="text-[10px] text-amber-300 font-bold tracking-widest uppercase">Pre-Flight Grounding Active</span>

          <!-- Quick Status Badges -->
          <span v-if="activeCard?.extensions?.airi?.groundingEnabled" class="border border-amber-500/25 rounded bg-black/30 px-1.5 py-0.2 text-[8px] text-amber-400 font-bold font-mono">Sensors Active</span>
          <span v-if="activeCard?.extensions?.airi?.groundingMemoryEnabled && groundedMemories.length > 0" class="border border-amber-500/25 rounded bg-black/30 px-1.5 py-0.2 text-[8px] text-amber-400 font-bold font-mono">Grounded Memories ({{ groundedMemories.length }})</span>
          <span v-if="activeCard?.extensions?.airi?.groundingTopicsEnabled && activeCard?.extensions?.airi?.recentTopics?.length" class="border border-amber-500/25 rounded bg-black/30 px-1.5 py-0.2 text-[8px] text-amber-400 font-bold font-mono">Recent Topics ({{ activeCard.extensions.airi.recentTopics.length }})</span>
          <span v-if="activeCard?.extensions?.airi?.groundingDirectorScratchpadEnabled && latestDirectorScratchpad" class="border border-amber-500/25 rounded bg-black/30 px-1.5 py-0.2 text-[8px] text-amber-400 font-bold font-mono">Visual Scene Active</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            v-if="activeCard?.extensions?.airi?.groundingEnabled"
            class="flex items-center gap-1 border border-amber-500/25 rounded bg-black/50 px-2 py-0.5 text-xs text-amber-400 font-bold font-mono transition-colors hover:bg-black/80"
            @click="isGroundingPreviewExpanded = !isGroundingPreviewExpanded"
          >
            <span>Telemetry</span>
            <span class="text-amber-500 transition-transform" :class="isGroundingPreviewExpanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
          </button>
          <button
            v-if="activeCard?.extensions?.airi?.groundingMemoryEnabled && groundedMemories.length > 0"
            class="flex items-center gap-1 border border-amber-500/25 rounded bg-black/50 px-2 py-0.5 text-xs text-amber-400 font-bold font-mono transition-colors hover:bg-black/80"
            @click="isMemoriesPreviewExpanded = !isMemoriesPreviewExpanded"
          >
            <span>Memories</span>
            <span class="text-amber-500 transition-transform" :class="isMemoriesPreviewExpanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
          </button>
          <button
            v-if="activeCard?.extensions?.airi?.groundingTopicsEnabled && activeCard?.extensions?.airi?.recentTopics?.length"
            class="flex items-center gap-1 border border-amber-500/25 rounded bg-black/50 px-2 py-0.5 text-xs text-amber-400 font-bold font-mono transition-colors hover:bg-black/80"
            @click="isTopicsPreviewExpanded = !isTopicsPreviewExpanded"
          >
            <span>Topics</span>
            <span class="text-amber-500 transition-transform" :class="isTopicsPreviewExpanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
          </button>
          <button
            v-if="activeCard?.extensions?.airi?.groundingDirectorScratchpadEnabled && latestDirectorScratchpad"
            class="flex items-center gap-1 border border-amber-500/25 rounded bg-black/50 px-2 py-0.5 text-xs text-amber-400 font-bold font-mono transition-colors hover:bg-black/80"
            @click="isScratchpadPreviewExpanded = !isScratchpadPreviewExpanded"
          >
            <span>Visual Scene</span>
            <span class="text-amber-500 transition-transform" :class="isScratchpadPreviewExpanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
          </button>
        </div>
      </div>

      <!-- Telemetry details -->
      <div
        v-if="activeCard?.extensions?.airi?.groundingEnabled"
        :class="[
          'z-10 animate-fade-in animate-duration-200',
          isGroundingPreviewExpanded ? 'mt-2 border-t border-amber-500/10 pt-2' : '',
        ]"
      >
        <pre v-show="isGroundingPreviewExpanded" class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-amber-950/20 p-2 text-[10px] text-amber-300/90 leading-normal font-mono scrollbar-thin">{{ proactivityStore.sensorPayload || 'Polling sensors...' }}</pre>
      </div>

      <!-- Grounded Memories Section -->
      <div
        v-if="activeCard?.extensions?.airi?.groundingMemoryEnabled && groundedMemories.length > 0"
        :class="[
          'z-10 animate-fade-in animate-duration-200',
          isMemoriesPreviewExpanded ? 'mt-2 border-t border-amber-500/10 pt-2' : '',
        ]"
      >
        <div v-show="isMemoriesPreviewExpanded" class="max-h-36 overflow-y-auto scrollbar-thin space-y-1.5">
          <div
            v-for="entry in groundedMemories"
            :key="entry.id"
            class="flex flex-col cursor-pointer border border-amber-500/10 rounded bg-amber-950/10 p-2 text-[10px] leading-normal transition-all hover:border-amber-500/20 hover:bg-amber-950/20"
            @click="openTextPreview({ title: entry.title || 'Untitled Memory', content: entry.content })"
          >
            <div class="mb-0.5 flex items-center justify-between text-amber-300 font-bold">
              <span class="truncate pr-2">{{ entry.title || 'Untitled Memory' }}</span>
              <span class="shrink-0 text-[8px] font-normal uppercase opacity-60">{{ entry.kind || 'Journal' }}</span>
            </div>
            <p class="line-clamp-2 text-amber-200/80">
              {{ entry.content }}
            </p>
          </div>
        </div>
      </div>

      <!-- Recent Topics Section -->
      <div
        v-if="activeCard?.extensions?.airi?.groundingTopicsEnabled && activeCard?.extensions?.airi?.recentTopics?.length"
        :class="[
          'z-10 animate-fade-in animate-duration-200',
          isTopicsPreviewExpanded ? 'mt-2 border-t border-amber-500/10 pt-2' : '',
        ]"
      >
        <div v-show="isTopicsPreviewExpanded" class="max-h-24 flex flex-wrap gap-1.5 overflow-y-auto p-1 scrollbar-thin">
          <div
            v-for="item in activeCard.extensions.airi.recentTopics"
            :key="item.topic"
            class="flex items-center gap-1 border border-amber-500/15 rounded bg-amber-950/20 px-2 py-0.5 text-[10px] text-amber-300 font-mono"
            :title="`weight: ${item.weight.toFixed(2)}`"
          >
            <span>#{{ item.topic }}</span>
            <span class="text-[8px] text-amber-500 font-bold">({{ item.weight.toFixed(1) }})</span>
          </div>
        </div>
      </div>

      <!-- Visual Scene Scratchpad Section -->
      <div
        v-if="activeCard?.extensions?.airi?.groundingDirectorScratchpadEnabled && latestDirectorScratchpad"
        :class="[
          'z-10 animate-fade-in animate-duration-200',
          isScratchpadPreviewExpanded ? 'mt-2 border-t border-amber-500/10 pt-2' : '',
        ]"
      >
        <pre v-show="isScratchpadPreviewExpanded" class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-amber-950/20 p-2 text-[10px] text-amber-300/90 leading-normal font-mono scrollbar-thin">{{ latestDirectorScratchpad }}</pre>
      </div>
    </div>

    <div class="relative w-full flex items-end">
      <BasicTextarea
        v-model="messageInput"
        :send-mode="settingsChat.sendMode"
        :suggest-mode="settingsChat.suggestMode"
        :placeholder="t('stage.message')"
        class="ph-no-capture w-full pr-36"
        text="primary-600 dark:primary-100 placeholder:primary-500 dark:placeholder:primary-200"
        border="solid 2 primary-200/20 dark:primary-400/20"
        bg="primary-100/50 dark:primary-900/70"
        max-h="[10lh]" min-h="[1lh]"
        shrink-0 resize-none overflow-y-scroll rounded-xl p-2 font-medium outline-none
        transition="all duration-250 ease-in-out placeholder:all placeholder:duration-250 placeholder:ease-in-out"
        @submit="handleSend"
        @suggest="messageInput.trim() && handleQuickSuggest()"
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
        @attach="handleFilePaste"
      />
      <div class="composer-buttons no-drag absolute right-2.5 top-1/2 z-10 flex select-none items-center -translate-y-1/2">
        <!-- Add Media inline button -->
        <ChatImagesPopover
          @attach="fileInput?.click()"
          @screenshot="handleScreenshotClick"
        />

        <!-- Suggest Response (Producer Sparkle) Inline Button -->
        <button
          class="ml-1 h-8 w-8 flex items-center justify-center rounded-xl transition-all duration-250 active:scale-95 hover:bg-neutral-200/40 hover:text-neutral-700 dark:hover:bg-neutral-800/40 dark:hover:text-neutral-200"
          :class="[
            messageInput.trim()
              ? 'bg-primary-500/15 text-primary-500 shadow-[0_0_12px_rgba(168,85,247,0.2)] dark:bg-primary-500/20 dark:text-primary-400'
              : 'bg-neutral-200/20 text-neutral-500 dark:bg-neutral-800/20 dark:text-neutral-400',
          ]"
          title="Suggest responses"
          @click="handleQuickSuggest"
        >
          <div class="i-solar:magic-stick-3-bold-duotone text-base" />
        </button>

        <!-- Send / Greet Inline Button -->
        <button
          class="ml-2.5 h-8 w-8 flex items-center justify-center rounded-xl bg-primary-600 text-white transition-all duration-250 active:scale-95 dark:bg-primary-500 hover:bg-primary-700 dark:hover:bg-primary-600"
          :class="[
            messageInput.trim()
              ? 'shadow-lg shadow-primary-500/35 scale-[1.03]'
              : 'opacity-90',
          ]"
          :title="isGreetMode ? 'Greet' : 'Send Message'"
          @click="handleSend"
        >
          <div :class="[isGreetMode ? 'i-ph:hand-waving-bold' : 'i-solar:plain-2-bold-duotone', 'text-base']" />
        </button>
      </div>
    </div>

    <!-- Context Dialog -->
    <ChatSessionModal
      v-model="showSessions"
    />

    <CharacterContextDialog
      v-model="showContext"
      :character-name="characterName"
      :character-id="activeCardId || undefined"
      :system-prompt="effectiveSystemPrompt"
    />

    <!-- Journal Moment Dialog -->
    <JournalMomentModal
      :open="showJournalModal"
      :messages="historyMessages"
      @close="showJournalModal = false"
      @submit="handleJournalSubmit"
    />

    <!-- Imagine Prompt Dialog -->
    <DialogRoot v-model:open="showImagineDialog">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogContent class="animate-scale-in fixed left-1/2 top-1/2 z-50 w-96 border border-neutral-200/60 rounded-2xl bg-white p-6 shadow-2xl -translate-x-1/2 -translate-y-1/2 dark:border-neutral-800 dark:bg-neutral-950">
          <DialogTitle class="mb-2 text-sm text-neutral-800 font-bold dark:text-neutral-200">
            Imagine a Scene
          </DialogTitle>
          <p class="mb-4 text-xs text-neutral-500">
            Describe the scene background you want to generate and append to the gallery.
          </p>
          <input
            v-model="imaginePrompt"
            type="text"
            placeholder="A cozy study with books, warm lighting..."
            class="mb-4 w-full border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 text-sm outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900/50 dark:focus:border-primary-400"
            @keydown.enter="handleImagineSubmit"
          >
          <div class="flex justify-end gap-2">
            <button class="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs text-neutral-600 font-semibold dark:bg-neutral-800 dark:text-neutral-400" @click="showImagineDialog = false">
              Cancel
            </button>
            <button class="rounded-lg bg-primary-600 px-3 py-1.5 text-xs text-white font-semibold" @click="handleImagineSubmit">
              Generate
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

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

    <!-- Semantic Search Modal -->
    <DialogRoot :open="isSearchModalOpen" @update:open="isSearchModalOpen = $event">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-100 bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
        <DialogContent class="fixed left-1/2 top-1/2 z-100 m-0 max-h-[85vh] max-w-xl w-[92vw] flex flex-col border border-neutral-200 rounded-2xl bg-white p-6 shadow-2xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-800">
          <div class="h-full flex flex-col gap-4 overflow-hidden">
            <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-700">
              <div>
                <DialogTitle class="from-emerald-500 to-emerald-400 bg-gradient-to-r bg-clip-text text-lg text-transparent font-bold">
                  Search Memories
                </DialogTitle>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">
                  Semantic queries across memories for {{ characterName }}.
                </p>
              </div>
            </div>

            <div class="flex flex-col gap-3">
              <input
                v-model="modalSearchTerm"
                type="text"
                placeholder="Search memories..."
                class="w-full border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 text-sm outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900/50 dark:focus:border-primary-400"
              >
            </div>

            <div class="min-h-[300px] flex-1 overflow-y-auto pr-1">
              <div v-if="modalIsSearching" class="flex flex-col items-center justify-center py-12 text-neutral-400">
                <div class="i-solar:loading-bold mb-2 animate-spin text-3xl" />
                <span>Probing memory layers...</span>
              </div>
              <div v-else-if="modalSearchResults.length === 0" class="flex flex-col items-center justify-center py-12 text-neutral-400">
                <p class="text-sm">
                  No memory matches found.
                </p>
              </div>
              <div v-else class="flex flex-col gap-4">
                <article
                  v-for="entry in modalSearchResults"
                  :key="entry.id"
                  class="border-neutral-150 border rounded-[1.2rem] bg-neutral-50/40 p-4 dark:border-neutral-700/60 dark:bg-neutral-900/20"
                  :class="[isSameSession(entry) ? 'cursor-pointer hover:bg-neutral-100/70 dark:hover:bg-neutral-900/50 transition-colors' : '']"
                  @click="isSameSession(entry) ? jumpToMessage(entry.id) : undefined"
                >
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <span
                      :class="[
                        'rounded-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        entry.kind === 'raw'
                          ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                          : entry.kind === 'stmm'
                            ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                      ]"
                    >
                      {{ entry.kind === 'raw' ? 'Chat' : entry.kind === 'stmm' ? 'Recap' : 'Journal' }}
                    </span>
                    <div class="flex flex-col items-end gap-1">
                      <div class="flex items-center gap-2">
                        <span v-if="isSameSession(entry)" class="text-[10px] text-primary-500 font-bold hover:underline">
                          Jump to message &rarr;
                        </span>
                        <span class="text-[9px] text-neutral-400 font-semibold">
                          {{ formatDate(entry.createdAt) }}
                        </span>
                      </div>
                      <span class="text-neutral-450 text-[9px] tracking-tight font-mono opacity-75 dark:text-neutral-400">
                        ID: {{ entry.id }} | Source: {{ entry.source }}
                      </span>
                    </div>
                  </div>
                  <h5 class="dark:text-neutral-250 mb-2 text-sm text-neutral-800 font-bold">
                    {{ entry.title }}
                  </h5>
                  <div class="relative overflow-hidden border border-neutral-100/50 rounded-xl bg-neutral-50/30 p-4 dark:border-neutral-800 dark:bg-black/10">
                    <MarkdownRenderer
                      :content="entry.content"
                      class="select-text text-xs text-neutral-700 leading-relaxed dark:text-neutral-300"
                    />
                  </div>
                </article>
              </div>
            </div>

            <div class="flex items-center justify-end border-t border-neutral-200 pt-3 dark:border-neutral-700">
              <Button
                variant="secondary"
                label="Close"
                @click="isSearchModalOpen = false"
              />
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <!-- Producer Guidance Modal -->
    <ProducerGuidanceModal
      v-model="isProducerModalOpen"
      :character-name="characterName"
      @submit="handleProducerSubmit"
      @open-user-profile="handleOpenUserProfile"
    />
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

/* Compensate for whitespace/teleport nodes breaking flex gap in composer */

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
