<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'

import { estimateTokens, formatTokenCount } from '@proj-airi/stage-shared'
import {
  CharacterContextDialog,
  ChatImagesPopover,
  ChatMemoryPopover,
  ChatSessionModal,
  StageBackgroundDialogPicker,
} from '@proj-airi/stage-ui/components'
import { useChatComposer } from '@proj-airi/stage-ui/composables'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { buildSystemPrompt, useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useSettings, useSettingsAudioDevice, useSettingsChat } from '@proj-airi/stage-ui/stores/settings'
import { BasicTextarea } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { BackgroundDialogPicker } from '../Backgrounds'

const props = defineProps<{
  tools?: any[]
}>()

const showContext = ref(false)
const showSessions = ref(false)
const backgroundDialogOpen = ref(false)
const stageBackgroundDialogOpen = ref(false)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const { activeProvider, activeModel } = storeToRefs(useConsciousnessStore())
const { themeColorsHueDynamic } = storeToRefs(useSettings())
const settingsChat = useSettingsChat()
const settingsAudioDevice = useSettingsAudioDevice()
const { enabled: isAudioInputEnabled, stream: audioStream } = storeToRefs(settingsAudioDevice)

const chatSession = useChatSessionStore()
const airiCardStore = useAiriCardStore()

const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const { messages } = storeToRefs(chatSession)
const { t } = useI18n()

// Initialize shared useChatComposer composable
const {
  messageInput,
  attachments,
  isComposing,
  isImagineMode,
  handleFileSelect,
  removeAttachment,
  handleSend,
} = useChatComposer({
  tools: props.tools,
})

async function handleVoiceClick() {
  if (!audioStream.value && !isAudioInputEnabled.value) {
    try {
      await settingsAudioDevice.askPermission()
    }
    catch (err) {
      console.error('Microphone permission error:', err)
    }
  }
  isAudioInputEnabled.value = !isAudioInputEnabled.value
}

const characterName = computed(() => activeCard.value?.name || 'AIRI')
const effectiveSystemPrompt = computed(() => buildSystemPrompt(activeCard.value))

function handleScreenshotClick() {
  // Vision capture is typically restricted in browser unless using getDisplayMedia
  toast.info('Vision capture is optimized for desktop. Please use the attach button for screenshots.')
}

// --- Token Counter ---
const historyMessages = computed(() => messages.value as unknown as ChatHistoryItem[])

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
</script>

<template>
  <div h="<md:full" flex="~ col" gap-1 class="ph-no-capture font-sans">
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
    </div>

    <!-- Action Row (Token Stats, Memory, Images, Mic, Send) -->
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

      <!-- [🎤] Voice / STT Mic Button -->
      <button
        type="button"
        :class="[
          'flex items-center justify-center size-9 rounded-xl border-2 border-neutral-100/60 bg-neutral-50/70 dark:border-neutral-800/30 dark:bg-neutral-800/70 transition-all cursor-pointer shrink-0 backdrop-blur-md active:scale-95',
          isAudioInputEnabled
            ? 'border-rose-500/50 bg-rose-500 text-white shadow-md shadow-rose-500/30 animate-pulse'
            : 'text-neutral-500 hover:text-primary-500 dark:text-neutral-400 dark:hover:text-primary-400',
        ]"
        :title="isAudioInputEnabled ? 'Stop Listening' : 'Voice Input'"
        @click="handleVoiceClick"
      >
        <div :class="[isAudioInputEnabled ? 'i-solar:microphone-3-bold text-lg' : 'i-solar:microphone-linear text-lg']" />
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
  </div>
</template>
