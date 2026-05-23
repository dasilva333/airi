<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'
import type { ChatProvider } from '@xsai-ext/providers/utils'

import { ChatHistory, ChatImagesPopover, ChatMemoryPopover, HearingConfigDialog } from '@proj-airi/stage-ui/components'
import { useAudioAnalyzer } from '@proj-airi/stage-ui/composables'
import { useAudioContext } from '@proj-airi/stage-ui/stores/audio'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatMaintenanceStore } from '@proj-airi/stage-ui/stores/chat/maintenance'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettings, useSettingsAudioDevice } from '@proj-airi/stage-ui/stores/settings'
import { BasicTextarea, useTheme } from '@proj-airi/ui'
import { useResizeObserver, useScreenSafeArea } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import IndicatorMicVolume from '../Widgets/IndicatorMicVolume.vue'
import ActionViewControls from './InteractiveArea/Actions/ViewControls.vue'
import ViewControlInputs from './ViewControls/Inputs.vue'

import { BackgroundDialogPicker } from '../Backgrounds'

const { isDark, toggleDark } = useTheme()
const hearingDialogOpen = ref(false)
const chatOrchestrator = useChatOrchestratorStore()
const chatSession = useChatSessionStore()
const chatStream = useChatStreamStore()
const airiCardStore = useAiriCardStore()
const { cleanupMessages } = useChatMaintenanceStore()
const { messages } = storeToRefs(chatSession)
const { streamingMessage } = storeToRefs(chatStream)
const { sending } = storeToRefs(chatOrchestrator)
const historyMessages = computed(() => messages.value as unknown as ChatHistoryItem[])

const {
  stageViewControlsEnabled,
  stageViewControlsMode: viewControlsActiveMode,
} = storeToRefs(useSettings())
const viewControlsInputsRef = useTemplateRef<InstanceType<typeof ViewControlInputs>>('viewControlsInputs')

const messageInput = ref('')
const isComposing = ref(false)
const isImagineMode = ref(false)
const backgroundDialogOpen = ref(false)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const router = useRouter()
const screenSafeArea = useScreenSafeArea()
const providersStore = useProvidersStore()
const { activeProvider, activeModel } = storeToRefs(useConsciousnessStore())

function navigateToImageJournal() {
  const { activeCardId } = storeToRefs(airiCardStore)
  if (!activeCardId.value)
    return
  router.push(`/settings/airi-card?cardId=${activeCardId.value}&tab=gallery`)
}

function handleScreenshotClick() {
  toast.info('Vision capture is optimized for desktop. Please use the attach button for screenshots.')
}

useResizeObserver(document.documentElement, () => screenSafeArea.update())
const { themeColorsHueDynamic } = storeToRefs(useSettings())
const settingsAudioDevice = useSettingsAudioDevice()
const { enabled, selectedAudioInput, stream, audioInputs } = storeToRefs(settingsAudioDevice)
const { ingest, onAfterMessageComposed } = chatOrchestrator
const { t } = useI18n()
const { audioContext } = useAudioContext()
const { startAnalyzer, stopAnalyzer, volumeLevel } = useAudioAnalyzer()
let analyzerSource: MediaStreamAudioSourceNode | undefined

function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

async function handleSubmit() {
  if (!isMobileDevice()) {
    await handleSend()
  }
}

async function handleSend() {
  if (!messageInput.value.trim() || isComposing.value) {
    return
  }

  const textToSend = messageInput.value
  messageInput.value = ''

  try {
    const providerConfig = providersStore.getProviderConfig(activeProvider.value)

    await ingest(textToSend, {
      chatProvider: await providersStore.getProviderInstance(activeProvider.value) as ChatProvider,
      model: activeModel.value,
      providerConfig,
    })
  }
  catch (error) {
    messageInput.value = textToSend
    messages.value.pop()
    messages.value.push({
      role: 'error',
      content: (error as Error).message,
    })
  }
}

function teardownAnalyzer() {
  try {
    analyzerSource?.disconnect()
  }
  catch {}
  analyzerSource = undefined
  stopAnalyzer()
}

async function setupAnalyzer() {
  teardownAnalyzer()
  if (!hearingDialogOpen.value || !enabled.value || !stream.value)
    return
  if (audioContext.state === 'suspended')
    await audioContext.resume()
  const analyser = startAnalyzer(audioContext)
  if (!analyser)
    return
  analyzerSource = audioContext.createMediaStreamSource(stream.value)
  analyzerSource.connect(analyser)
}

watch([hearingDialogOpen, enabled, stream], () => {
  setupAnalyzer()
}, { immediate: true })

watch(hearingDialogOpen, (value) => {
  if (value) {
    settingsAudioDevice.askPermission()
  }
})

onAfterMessageComposed(async () => {
})

onUnmounted(() => {
  teardownAnalyzer()
})

onMounted(() => {
  screenSafeArea.update()
})
</script>

<template>
  <div class="fixed bottom-0 w-full flex flex-col">
    <BackgroundDialogPicker v-model="backgroundDialogOpen" />
    <KeepAlive>
      <Transition name="fade">
        <ChatHistory
          v-if="!stageViewControlsEnabled"
          variant="mobile"
          :messages="historyMessages"
          :sending="sending"
          :streaming-message="streamingMessage"
          class="chat-history relative z-20 max-w-[calc(100%-3.5rem)] w-full self-start pb-3 pl-3"
        />
      </Transition>
    </KeepAlive>
    <div class="relative w-full self-end">
      <div class="fixed top-[50%] z-15 px-3 -translate-y-1/2">
        <ViewControlInputs ref="viewControlsInputs" />
      </div>
      <div class="absolute right-0 w-full px-3 pb-3 font-sans -translate-y-full">
        <div class="w-full flex flex-col items-end gap-1">
          <HearingConfigDialog
            v-model:show="hearingDialogOpen"
            v-model:enabled="enabled"
            v-model:selected-audio-input="selectedAudioInput"
            :audio-inputs="audioInputs"
            :volume-level="volumeLevel"
            :granted="true"
          >
            <button
              class="w-fit flex items-center justify-center border-2 border-neutral-100/60 rounded-xl border-solid bg-neutral-50/70 p-2 backdrop-blur-md dark:border-neutral-800/30 dark:bg-neutral-800/70"
              title="Hearing"
            >
              <Transition name="fade" mode="out-in">
                <IndicatorMicVolume v-if="enabled" class="size-5 text-neutral-500 dark:text-neutral-400" />
                <div v-else class="i-solar:microphone-3-outline size-5 text-neutral-500 dark:text-neutral-400" />
              </Transition>
            </button>
          </HearingConfigDialog>

          <ChatMemoryPopover
            show-cache-status
            variant="mobile"
            title="Memory"
          />

          <ChatImagesPopover
            variant="mobile"
            :imagine-mode="isImagineMode"
            @toggle-imagine="isImagineMode = !isImagineMode"
            @attach="fileInput?.click()"
            @screenshot="handleScreenshotClick"
            @view-journal="navigateToImageJournal"
            @background-picker="backgroundDialogOpen = true"
          />

          <ActionViewControls @reset="() => viewControlsInputsRef?.resetOnMode()" />
          <button
            class="w-fit flex items-center justify-center border-2 border-neutral-100/60 rounded-xl border-solid bg-neutral-50/70 p-2 backdrop-blur-md dark:border-neutral-800/30 dark:bg-neutral-800/70"
            title="Cleanup Messages"
            @click="cleanupMessages()"
          >
            <div class="i-solar:trash-bin-2-bold-duotone size-5" />
          </button>
        </div>
      </div>
      <div class="max-h-100dvh max-w-100dvw w-full flex gap-1 overflow-auto bg-white px-3 pt-2 dark:bg-neutral-800" :style="{ paddingBottom: `${Math.max(Number.parseFloat(screenSafeArea.bottom.value.replace('px', '')), 12)}px` }">
        <input ref="fileInput" type="file" class="hidden" accept="image/*">
        <BasicTextarea
          v-model="messageInput"
          :placeholder="t('stage.message')"
          class="max-h-[10lh] min-h-[calc(1lh+4px+4px)] w-full resize-none overflow-y-scroll border-2 border-neutral-200/60 rounded-[1lh] border-solid bg-neutral-100/80 px-4 py-0.5 text-neutral-500 outline-none backdrop-blur-md transition-all duration-250 ease-in-out scrollbar-none dark:border-neutral-700/60 dark:bg-neutral-950/80 dark:text-neutral-100 hover:text-neutral-600 placeholder:text-neutral-900/60 placeholder:transition-all placeholder:duration-250 placeholder:ease-in-out dark:hover:text-neutral-200 placeholder:dark:text-white/60 placeholder:hover:text-neutral-500 placeholder:dark:hover:text-neutral-400"
          :class="[themeColorsHueDynamic ? 'transition-none placeholder:transition-none' : '']"
          default-height="1lh"
          @submit="handleSubmit"
          @compositionstart="isComposing = true"
          @compositionend="isComposing = false"
        />
        <button
          v-if="messageInput.trim() || isComposing"
          class="aspect-square h-[calc(1lh+4px+4px)] w-[calc(1lh+4px+4px)] flex items-center self-end justify-center rounded-full bg-primary-50/80 text-neutral-500 outline-none backdrop-blur-md transition-all duration-250 ease-in-out dark:bg-neutral-100/80 hover:bg-neutral-50 dark:text-neutral-900 hover:text-neutral-600 dark:hover:text-neutral-800"
          @click="handleSend"
        >
          <div i-solar:arrow-up-outline />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes scan {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
}

.animate-scan {
  animation: scan 2s infinite linear;
}

/*
DO NOT ATTEMPT TO USE backdrop-filter TOGETHER WITH mask-image.

html - Why doesn't blur backdrop-filter work together with mask-image? - Stack Overflow
https://stackoverflow.com/questions/72780266/why-doesnt-blur-backdrop-filter-work-together-with-mask-image
*/
.chat-history {
  --gradient: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 20%);
  -webkit-mask-image: var(--gradient);
  mask-image: var(--gradient);
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: bottom;
  mask-position: bottom;
  max-height: 35dvh;
}
</style>
