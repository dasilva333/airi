<script setup lang="ts">
import { estimateTokens, formatTokenCount, isStageTamagotchi } from '@proj-airi/stage-shared'
import {
  CharacterContextDialog,
  ChatImagesPopover,
  ChatMemoryPopover,
  ChatSessionModal,
  StageBackgroundDialogPicker,
} from '@proj-airi/stage-ui/components'
import { useAudioAnalyzer } from '@proj-airi/stage-ui/composables'
import { useAudioContext } from '@proj-airi/stage-ui/stores/audio'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatMaintenanceStore } from '@proj-airi/stage-ui/stores/chat/maintenance'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { useShortTermMemoryStore } from '@proj-airi/stage-ui/stores/memory-short-term'
import { buildSystemPrompt, useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useAutonomousArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry-autonomous'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useHearingSpeechInputPipeline, useHearingStore } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettings, useSettingsAudioDevice, useSettingsChat } from '@proj-airi/stage-ui/stores/settings'
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'
import { BasicTextarea, FieldSelect } from '@proj-airi/ui'
import { until } from '@vueuse/core'
import type { ChatProvider } from '@xsai-ext/providers/utils'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { BackgroundDialogPicker } from '../Backgrounds'
import IndicatorMicVolume from './IndicatorMicVolume.vue'

const props = defineProps<{
  tools?: any[]
}>()

const router = useRouter()
const messageInput = ref('')
const attachments = ref<{ type: 'image'; data: string; mimeType: string; url: string }[]>([])
const hearingPopoverOpen = ref(false)
const isComposing = ref(false)
const isListening = ref(false)
const isImagineMode = ref(false)
const trashConfirmOpen = ref(false)
const showContext = ref(false)
const showSessions = ref(false)
const backgroundDialogOpen = ref(false)
const stageBackgroundDialogOpen = ref(false)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const providersStore = useProvidersStore()
const { activeProvider, activeModel } = storeToRefs(useConsciousnessStore())
const { themeColorsHueDynamic } = storeToRefs(useSettings())
const settingsChat = useSettingsChat()

const { askPermission, startStream } = useSettingsAudioDevice()
const { enabled, selectedAudioInput, stream, audioInputs } = storeToRefs(useSettingsAudioDevice())
const chatOrchestrator = useChatOrchestratorStore()
const chatSession = useChatSessionStore()
const chatStream = useChatStreamStore()
const airiCardStore = useAiriCardStore()
const shortTermMemory = useShortTermMemoryStore()
const { cleanupMessages } = useChatMaintenanceStore()

const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const { ingest, onAfterMessageComposed } = chatOrchestrator
const { messages } = storeToRefs(chatSession)
const { streamingMessage } = storeToRefs(chatStream)
const { sending } = storeToRefs(chatOrchestrator)
const { audioContext } = useAudioContext()
const { t } = useI18n()

// Transcription pipeline
const hearingStore = useHearingStore()
const hearingPipeline = useHearingSpeechInputPipeline()
const { transcribeForMediaStream, stopStreamingTranscription } = hearingPipeline
const { supportsStreamInput } = storeToRefs(hearingPipeline)
const { configured: hearingConfigured, autoSendEnabled, autoSendDelay } = storeToRefs(hearingStore)
const shouldUseStreamInput = computed(() => supportsStreamInput.value && !!stream.value)

const characterName = computed(() => activeCard.value?.name || 'AIRI')
const effectiveSystemPrompt = computed(() => buildSystemPrompt(activeCard.value))

// --- Logic Helpers ---
function formatLocalDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function handleTrashClick() {
  const today = formatLocalDayKey(new Date())
  const isTodayCached =
    activeCardId.value && shortTermMemory.getCharacterBlocks(activeCardId.value).some((b) => b.date === today)
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
    } catch (err) {
      console.error('[ChatArea] Failed to cache today before clear:', err)
    }
  }
  cleanupMessages()
}

function handleClearAnyway() {
  trashConfirmOpen.value = false
  cleanupMessages()
}

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
  } catch {
    url = `data:${mimeType};base64,${data}`
  }

  attachments.value.push({
    data,
    mimeType,
    type: 'image' as const,
    url,
  })
}

function handleFilePaste(files: File[]) {
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

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.length) {
    handleFilePaste(Array.from(target.files))
  }
  target.value = ''
}

async function handleScreenshotClick() {
  // Vision capture is typically restricted in browser unless using getDisplayMedia
  // For now, we show a toast explaining browser limitations if electron visionStore is missing
  toast.info('Vision capture is optimized for desktop. Please use the attach button for screenshots.')
}

function navigateToImageJournal() {
  if (!activeCardId.value) return
  router.push(`/settings/airi-card?cardId=${activeCardId.value}&tab=gallery`)
}

function removeAttachment(index: number) {
  const attachment = attachments.value[index]
  if (attachment) {
    URL.revokeObjectURL(attachment.url)
    attachments.value.splice(index, 1)
  }
}

// --- Token Counter ---
const historyMessages = computed(() => messages.value as unknown as ChatHistoryItem[])

const sessionTokenCount = computed(() => {
  let total = 0
  for (const message of historyMessages.value) {
    if (typeof message.content === 'string') {
      total += estimateTokens(message.content)
    } else if (Array.isArray(message.content)) {
      const textOnly = message.content
        .map((part) => {
          if (typeof part === 'string') return part
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
  if (!activeProvider.value || !activeModel.value) return undefined
  try {
    const rawMap = localStorage.getItem('airi:context-width-map')
    if (!rawMap) return undefined
    const map = JSON.parse(rawMap)
    return map[activeProvider.value]?.[activeModel.value]
  } catch {
    return undefined
  }
})

const effectiveContextWidth = computed(
  () => activeCard.value?.extensions?.airi?.generation?.known?.contextWidth || globalContextWidth.value,
)

const contextPercentage = computed(() => {
  if (!effectiveContextWidth.value) return 0
  return (sessionTokenCount.value / effectiveContextWidth.value) * 100
})

// --- Auto-send logic ---
let autoSendTimeout: ReturnType<typeof setTimeout> | undefined
const pendingAutoSendText = ref('')

function clearPendingAutoSend() {
  if (autoSendTimeout) {
    clearTimeout(autoSendTimeout)
    autoSendTimeout = undefined
  }
  pendingAutoSendText.value = ''
}

async function debouncedAutoSend(text: string) {
  if (!autoSendEnabled.value) {
    clearPendingAutoSend()
    return
  }
  pendingAutoSendText.value = pendingAutoSendText.value ? `${pendingAutoSendText.value} ${text}` : text
  if (autoSendTimeout) {
    clearTimeout(autoSendTimeout)
  }
  autoSendTimeout = setTimeout(async () => {
    if (!autoSendEnabled.value) {
      clearPendingAutoSend()
      return
    }
    const textToSend = pendingAutoSendText.value.trim()
    if (textToSend && autoSendEnabled.value) {
      try {
        const providerConfig = providersStore.getProviderConfig(activeProvider.value)
        await ingest(textToSend, {
          chatProvider: (await providersStore.getProviderInstance(activeProvider.value)) as ChatProvider,
          model: activeModel.value,
          providerConfig,
          tools: props.tools,
        })
        messageInput.value = ''
        pendingAutoSendText.value = ''
      } catch (err) {
        console.error('[ChatArea] Auto-send error:', err)
      }
    }
    autoSendTimeout = undefined
  }, autoSendDelay.value)
}

async function handleSend() {
  if ((!messageInput.value.trim() && !attachments.value.length) || isComposing.value) {
    return
  }

  const textToSend = messageInput.value
  const attachmentsToSend = attachments.value.map((att) => ({ ...att }))

  messageInput.value = ''
  attachments.value = []

  if (isImagineMode.value) {
    const artistryStore = useAutonomousArtistryStore()
    void artistryStore.runArtistTask(textToSend, chatSession.messages as any, 'assistant')
    return
  }

  try {
    const providerConfig = providersStore.getProviderConfig(activeProvider.value)
    await ingest(textToSend, {
      attachments: attachmentsToSend,
      chatProvider: (await providersStore.getProviderInstance(activeProvider.value)) as ChatProvider,
      model: activeModel.value,
      providerConfig,
      tools: props.tools,
    })
    attachmentsToSend.forEach((att) => URL.revokeObjectURL(att.url))
  } catch (error) {
    messageInput.value = textToSend
    attachments.value = attachmentsToSend
  }
}

// --- Audio Analyzer ---
const { startAnalyzer, stopAnalyzer, volumeLevel } = useAudioAnalyzer()
const normalizedVolume = computed(() => Math.min(1, Math.max(0, (volumeLevel.value ?? 0) / 100)))
let analyzerSource: MediaStreamAudioSourceNode | undefined

function teardownAnalyzer() {
  try {
    analyzerSource?.disconnect()
  } catch {}
  analyzerSource = undefined
  stopAnalyzer()
}

async function setupAnalyzer() {
  teardownAnalyzer()
  if (!hearingPopoverOpen.value || !enabled.value || !stream.value) return
  if (audioContext.state === 'suspended') await audioContext.resume()
  const analyser = startAnalyzer(audioContext)
  if (!analyser) return
  analyzerSource = audioContext.createMediaStreamSource(stream.value)
  analyzerSource.connect(analyser)
}

watch(
  [hearingPopoverOpen, enabled, stream],
  () => {
    setupAnalyzer()
  },
  { immediate: true },
)

onUnmounted(() => {
  teardownAnalyzer()
  stopListening()
  if (autoSendTimeout) {
    clearTimeout(autoSendTimeout)
    autoSendTimeout = undefined
  }
})

// --- Transcription ---
async function startListening() {
  try {
    if (!hearingConfigured.value) {
      const isWebSpeechAvailable =
        typeof window !== 'undefined' &&
        !isStageTamagotchi() &&
        ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
      if (isWebSpeechAvailable) {
        providersStore.initializeProvider('browser-web-speech-api')
        hearingStore.activeTranscriptionProvider = 'browser-web-speech-api'
        await nextTick()
      } else {
        isListening.value = false
        return
      }
    }
    if (!stream.value) {
      await askPermission()
      if (!stream.value && enabled.value) {
        startStream()
        try {
          await until(stream).toBeTruthy({ throwOnTimeout: true, timeout: 3000 })
        } catch {
          isListening.value = false
          return
        }
      }
    }
    if (!stream.value) {
      isListening.value = false
      return
    }
    if (!shouldUseStreamInput.value) {
      await stopStreamingTranscription(true)
      isListening.value = false
      return
    }
    try {
      await transcribeForMediaStream(stream.value, {
        onSentenceEnd: (delta) => {
          if (delta && delta.trim()) {
            const currentText = messageInput.value.trim()
            messageInput.value = currentText ? `${currentText} ${delta}` : delta
            if (autoSendEnabled.value) {
              debouncedAutoSend(delta)
            } else {
              clearPendingAutoSend()
            }
          }
        },
        onSpeechEnd: (text) => {
          if (!text || !text.trim()) return
          clearPendingAutoSend()
          void (async () => {
            try {
              const provider = await providersStore.getProviderInstance(activeProvider.value)
              if (!provider || !activeModel.value) return
              await ingest(text, {
                chatProvider: provider as ChatProvider,
                model: activeModel.value,
                skipAssistant: !autoSendEnabled.value,
                tools: props.tools,
              })
              if (messageInput.value.trim() === text.trim()) {
                messageInput.value = ''
              }
            } catch (err) {
              console.error('[ChatArea] Inscription error:', err)
            }
          })()
        },
      })
      isListening.value = true
    } catch (err) {
      isListening.value = false
      throw err
    }
  } catch (err) {
    isListening.value = false
  }
}

async function stopListening() {
  if (!isListening.value) return
  try {
    clearPendingAutoSend()
    if (autoSendEnabled.value && pendingAutoSendText.value.trim()) {
      const textToSend = pendingAutoSendText.value.trim()
      pendingAutoSendText.value = ''
      try {
        const providerConfig = providersStore.getProviderConfig(activeProvider.value)
        await ingest(textToSend, {
          chatProvider: (await providersStore.getProviderInstance(activeProvider.value)) as ChatProvider,
          model: activeModel.value,
          providerConfig,
          tools: props.tools,
        })
        messageInput.value = ''
      } catch (err) {
        console.error('[ChatArea] Auto-send error on stop:', err)
      }
    }
    await stopStreamingTranscription(true)
    isListening.value = false
  } catch (err) {
    isListening.value = false
  }
}

watch(enabled, async (val) => {
  if (val && stream.value) {
    await startListening()
  } else if (!val && isListening.value) {
    await stopListening()
  }
})

watch(stream, async (val) => {
  if (val && enabled.value && !isListening.value) {
    await startListening()
  } else if (!val && isListening.value) {
    await stopListening()
  }
})

watch(autoSendEnabled, (enabled) => {
  if (!enabled) {
    clearPendingAutoSend()
  }
})

onMounted(() => {
  shortTermMemory.load()
})
</script>

<template>
  <div h="<md:full" flex="~ col" gap-1 class="ph-no-capture">
    <input ref="fileInput" type="file" accept="image/*" class="hidden" multiple @change="handleFileSelect">

    <!-- Input Area -->
    <div
      :class="[
        'relative',
        'w-full',
        'bg-primary-200/20 dark:bg-primary-400/20 rounded-xl overflow-hidden',
      ]"
    >
      <!-- Attachments Preview -->
      <div v-if="attachments.length > 0" class="flex flex-wrap gap-2 border-b border-primary-100/50 p-2">
        <div v-for="(attachment, index) in attachments" :key="index" class="relative">
          <img :src="attachment.url" class="h-16 w-16 rounded-md object-cover">
          <button class="absolute h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-[10px] text-white -right-1 -top-1" @click="removeAttachment(index)">
            &times;
          </button>
        </div>
      </div>

      <BasicTextarea
        v-model="messageInput"
        :send-mode="settingsChat.sendMode"
        :placeholder="isImagineMode ? 'Describe a scene to imagine...' : t('stage.message')"
        text="neutral-900 dark:primary-50 placeholder:neutral-900/60 dark:placeholder:white/60"
        bg="transparent"
        min-h="[100px]" max-h="[300px]" w-full
        p-4 font-medium
        outline-none transition="all duration-250 ease-in-out placeholder:all placeholder:duration-250 placeholder:ease-in-out"
        :class="{
          'transition-colors-none placeholder:transition-colors-none': themeColorsHueDynamic,
        }"
        @submit="handleSend"
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
      />

      <!-- Bottom-left action button: Microphone -->
      <div
        absolute bottom-2 left-2 z-10 flex items-center gap-2
      >
        <PopoverRoot v-model:open="hearingPopoverOpen">
          <PopoverTrigger as-child>
            <button
              class="h-8 w-8 flex items-center justify-center rounded-md outline-none transition-all duration-200 active:scale-95"
              text="lg neutral-500 dark:neutral-400"
              :title="t('settings.hearing.title')"
            >
              <Transition name="fade" mode="out-in">
                <IndicatorMicVolume v-if="enabled" class="h-5 w-5" />
                <div v-else class="i-ph:microphone-slash h-5 w-5" />
              </Transition>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            :side-offset="8"
            :class="[
              'w-72 max-w-[18rem] rounded-xl border border-neutral-200/60 bg-neutral-50/90 p-4',
              'shadow-lg backdrop-blur-md dark:border-neutral-800/30 dark:bg-neutral-900/80',
              'flex flex-col gap-3',
            ]"
          >
            <div class="flex flex-col items-center justify-center">
              <div class="relative h-28 w-28 select-none">
                <div
                  class="absolute left-1/2 top-1/2 h-20 w-20 rounded-full transition-all duration-150 -translate-x-1/2 -translate-y-1/2"
                  :style="{ transform: `translate(-50%, -50%) scale(${1 + normalizedVolume * 0.35})`, opacity: String(0.25 + normalizedVolume * 0.25) }"
                  :class="enabled ? 'bg-primary-500/15 dark:bg-primary-600/20' : 'bg-neutral-300/20 dark:bg-neutral-700/20'"
                />
                <div
                  class="absolute left-1/2 top-1/2 h-24 w-24 rounded-full transition-all duration-200 -translate-x-1/2 -translate-y-1/2"
                  :style="{ transform: `translate(-50%, -50%) scale(${1.2 + normalizedVolume * 0.55})`, opacity: String(0.15 + normalizedVolume * 0.2) }"
                  :class="enabled ? 'bg-primary-500/10 dark:bg-primary-600/15' : 'bg-neutral-300/10 dark:bg-neutral-700/10'"
                />
                <div
                  class="absolute left-1/2 top-1/2 h-28 w-28 rounded-full transition-all duration-300 -translate-x-1/2 -translate-y-1/2"
                  :style="{ transform: `translate(-50%, -50%) scale(${1.5 + normalizedVolume * 0.8})`, opacity: String(0.08 + normalizedVolume * 0.15) }"
                  :class="enabled ? 'bg-primary-500/5 dark:bg-primary-600/10' : 'bg-neutral-300/5 dark:bg-neutral-700/5'"
                />
                <button
                  class="absolute left-1/2 top-1/2 grid h-16 w-16 place-items-center rounded-full shadow-md outline-none transition-all duration-200 -translate-x-1/2 -translate-y-1/2"
                  :class="enabled
                    ? 'bg-primary-500 text-white hover:bg-primary-600 active:scale-95'
                    : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300 active:scale-95 dark:bg-neutral-700 dark:text-neutral-200'"
                  @click="enabled = !enabled"
                >
                  <div :class="enabled ? 'i-ph:microphone' : 'i-ph:microphone-slash'" class="h-6 w-6" />
                </button>
              </div>
              <p class="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                {{ enabled ? 'Microphone enabled' : 'Microphone disabled' }}
              </p>
            </div>

            <FieldSelect
              v-model="selectedAudioInput"
              label="Input device"
              description="Select the microphone you want to use."
              :options="audioInputs.map(device => ({ label: device.label || 'Unknown Device', value: device.deviceId }))"
              layout="vertical"
              placeholder="Select microphone"
            />
          </PopoverContent>
        </PopoverRoot>
      </div>
    </div>

    <!-- Action Row (Grounding, Memory, Images, Trash, Send) -->
    <div flex items-center justify-end gap-2 px-1 py-1>
      <!-- Token Indicator -->
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
          'flex items-center justify-center border-2 rounded-xl p-2 outline-none',
          'transition-colors transition-transform active:scale-95 backdrop-blur-md',
          activeCard?.extensions?.airi?.groundingEnabled
            ? 'border-amber-500/50 bg-amber-500/10 text-lg text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
            : 'border-neutral-100/60 bg-neutral-50/70 text-lg text-neutral-500 hover:text-primary-500 dark:border-neutral-800/30 dark:bg-neutral-800/70 dark:text-neutral-400 dark:hover:text-primary-400',
        ]"
        :title="activeCard?.extensions?.airi?.groundingEnabled ? 'Grounding Active — sensor data attached to messages' : 'Attach sensor data with each message (Visit Proactivity tab to preview)'"
        @click="airiCardStore.toggleGrounding(activeCardId)"
      >
        <div :class="[activeCard?.extensions?.airi?.groundingEnabled ? 'i-solar:cpu-bolt-bold-duotone' : 'i-solar:cpu-bold-duotone']" />
      </button>

      <!-- Memory Popover -->
      <ChatMemoryPopover
        variant="mobile"
        show-cache-status
        :title="`Memory & Context for ${characterName}`"
        @view-context="showContext = true"
        @manage-sessions="showSessions = true"
      />

      <!-- Images Popover (incl. Background Picker) -->
      <ChatImagesPopover
        variant="mobile"
        :imagine-mode="isImagineMode"
        @toggle-imagine="isImagineMode = !isImagineMode"
        @attach="fileInput?.click()"
        @screenshot="handleScreenshotClick"
        @view-journal="stageBackgroundDialogOpen = true"
        @background-picker="backgroundDialogOpen = true"
      />

      <!-- Clear Messages (Safety Hook) -->
      <button
        class="max-h-[10lh] min-h-[1lh] flex items-center justify-center border-2 border-neutral-100/60 rounded-xl bg-neutral-50/70 p-2 text-lg text-neutral-500 outline-none backdrop-blur-md transition-colors transition-transform active:scale-95 dark:border-neutral-800/30 dark:bg-neutral-800/70 dark:text-neutral-400 hover:text-red-500 dark:hover:text-red-400"
        title="Clear Messages"
        @click="handleTrashClick"
      >
        <div class="i-solar:trash-bin-2-bold-duotone" />
      </button>

      <!-- Smart Send Split Button -->
      <div
        class="flex items-center overflow-hidden border-2 border-neutral-100/60 rounded-xl border-solid bg-neutral-50/70 backdrop-blur-md transition-all dark:border-neutral-800/30 dark:bg-neutral-800/70"
        max-h="[10lh]"
      >
        <button
          class="h-9 w-10 flex items-center justify-center outline-none transition-transform active:scale-95 hover:bg-primary-500/10"
          title="Send Message"
          @click="handleSend"
        >
          <div class="i-solar:plain-2-bold-duotone text-xl text-primary-600 dark:text-primary-400" />
        </button>

        <PopoverRoot>
          <PopoverTrigger as-child>
            <button
              class="h-9 w-6 flex items-center justify-center border-l border-neutral-200/50 outline-none transition-colors dark:border-neutral-700/50 hover:bg-primary-500/10"
              text="neutral-500 dark:neutral-400"
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

    <!-- Modals -->
    <BackgroundDialogPicker v-model="backgroundDialogOpen" />
    <StageBackgroundDialogPicker v-model="stageBackgroundDialogOpen" :card-id="activeCardId" />

    <ChatSessionModal v-model="showSessions" />

    <CharacterContextDialog
      v-model="showContext"
      :character-name="characterName"
      :system-prompt="effectiveSystemPrompt"
    />

    <!-- Trash Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="trashConfirmOpen"
          class="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          @click.self="trashConfirmOpen = false"
        >
          <div class="max-w-md w-full border border-neutral-200/60 rounded-2xl bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-neutral-800/60 dark:bg-neutral-900/90">
            <h3 class="text-xl text-neutral-900 font-bold dark:text-white">
              Clear conversation?
            </h3>
            <p class="mt-2 text-neutral-600 dark:text-neutral-400">
              You haven't summarized today's chat into memory yet. Clearing now will lose this context for future sessions.
            </p>
            <div class="mt-6 flex flex-col gap-2">
              <button
                class="w-full rounded-xl bg-primary-500 py-3 text-sm text-white font-bold transition active:scale-95 hover:bg-primary-600"
                @click="handleSaveAndClear"
              >
                Save to Memory & Clear
              </button>
              <button
                class="w-full rounded-xl bg-neutral-100 py-3 text-sm text-neutral-700 font-bold transition active:scale-95 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
                @click="handleClearAnyway"
              >
                Clear Anyway
              </button>
              <button
                class="mt-2 w-full text-sm text-neutral-400 font-medium hover:text-neutral-600 dark:hover:text-neutral-200"
                @click="trashConfirmOpen = false"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>e>
