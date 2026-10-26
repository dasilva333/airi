<script setup lang="ts">
import type { VoiceEditorPayload } from '@proj-airi/stage-ui/types/voice-editor'

import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { CharacterContextDialog, ChatSessionModal, StageBackgroundDialogPicker } from '@proj-airi/stage-ui/components'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import ChatOptionsAppearanceView from './ChatOptions/ChatOptionsAppearanceView.vue'
import ChatOptionsCapabilitiesView from './ChatOptions/ChatOptionsCapabilitiesView.vue'
import ChatOptionsInjectionsView from './ChatOptions/ChatOptionsInjectionsView.vue'
import ChatOptionsMemoriesView from './ChatOptions/ChatOptionsMemoriesView.vue'
import ChatOptionsRootView from './ChatOptions/ChatOptionsRootView.vue'
import ChatOptionsStagingView from './ChatOptions/ChatOptionsStagingView.vue'
import ChatOptionsToolsView from './ChatOptions/ChatOptionsToolsView.vue'
import ChatOptionsVoiceView from './ChatOptions/ChatOptionsVoiceView.vue'

const props = withDefaults(defineProps<{
  characterId?: string
  cardId?: string
  triggerVariant?: 'dots' | 'circle'
  showChatLayout?: boolean
  onApplyChatPreset?: (preset: 'mini' | 'medium' | 'large' | 'full') => void
}>(), {
  triggerVariant: 'dots',
  showChatLayout: true,
})

const emit = defineEmits<{
  (e: 'openStagingSettings'): void
  (e: 'openVoiceSettings'): void
  (e: 'openVoiceEditor', payload: VoiceEditorPayload): void
  (e: 'openMemorySettings'): void
  (e: 'openCardSettings'): void
  (e: 'openSettings'): void
  (e: 'searchMemories'): void
}>()

const isElectron = isStageTamagotchi()

const chatSessionStore = useChatSessionStore()
const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const effectiveCharacterId = computed(() => {
  const rawCandidateId = props.characterId
    || props.cardId
    || chatSessionStore.sessionMetas[chatSessionStore.activeSessionId]?.characterId
    || activeCardId.value
  // NOTICE: Guard against legacy 'default' ghost ID.
  return airiCardStore.resolveCardId(rawCandidateId)
})

const effectiveCard = computed(() => {
  return (effectiveCharacterId.value ? airiCardStore.cards.get(effectiveCharacterId.value) : undefined) || activeCard.value
})

const backgroundStore = useBackgroundStore()
const { chatboxActiveBackgroundId, activeBackgroundId } = storeToRefs(backgroundStore)

const isOpen = ref(false)
type ChatOptionsView = 'root' | 'capabilities' | 'tools' | 'injections' | 'memories' | 'appearance' | 'staging' | 'voice'
const currentView = ref<ChatOptionsView>('root')
const stageBackgroundDialogOpen = ref(false)
const chatSessionModalOpen = ref(false)
const characterContextDialogOpen = ref(false)

let router: any
try {
  router = useRouter()
}
catch {
  router = null
}

watch(isOpen, (val) => {
  if (!val) {
    currentView.value = 'root'
  }
})

function handleOpenBrowseScenes() {
  isOpen.value = false
  stageBackgroundDialogOpen.value = true
}

function handleOpenStagingSettings() {
  isOpen.value = false
  emit('openStagingSettings')
}

function handleOpenVoiceSettings() {
  isOpen.value = false
  emit('openVoiceSettings')
}

function handleViewContext() {
  isOpen.value = false
  characterContextDialogOpen.value = true
}

function handleManageSessions() {
  isOpen.value = false
  chatSessionModalOpen.value = true
}

function handleSearchMemories() {
  isOpen.value = false
  emit('searchMemories')
}

function handleOpenMemorySettings() {
  isOpen.value = false
  emit('openMemorySettings')
  if (router && typeof window !== 'undefined' && !(window as any).electron) {
    void router.push('/settings/memory').catch(() => {})
  }
}

function handleOpenCardSettings() {
  isOpen.value = false
  emit('openCardSettings')
  if (router && typeof window !== 'undefined' && !(window as any).electron) {
    const targetId = effectiveCharacterId.value || airiCardStore.resolveCardId()
    void router.push(`/settings/airi-card/edit?id=${targetId}`).catch(() => {})
  }
}

function handleOpenAllSettings() {
  isOpen.value = false
  emit('openSettings')
  if (router && typeof window !== 'undefined' && !(window as any).electron) {
    void router.push('/settings').catch(() => {})
  }
}

function handleOpenProviderSettings() {
  isOpen.value = false
  emit('openSettings')
  if (router && typeof window !== 'undefined' && !(window as any).electron) {
    void router.push('/settings/providers/speech/airi-audio-server').catch(() => {})
  }
}
</script>

<template>
  <PopoverRoot v-model:open="isOpen">
    <!-- Trigger Button -->
    <PopoverTrigger as-child>
      <slot name="trigger">
        <!-- Default: Dots Variant for Desktop Chat -->
        <button
          v-if="triggerVariant === 'dots'"
          type="button"
          :class="[
            'flex cursor-pointer items-center justify-center rounded-xl p-1.5 transition-all duration-200 ease-in-out',
            'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200',
            'dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800',
            isOpen ? 'text-primary-500 dark:text-primary-400 bg-neutral-200/60 dark:bg-neutral-800/60' : '',
          ]"
          title="Chat Options"
        >
          <div class="i-solar:menu-dots-bold text-base" />
        </button>

        <!-- Circle Variant for Mobile / Web Stage Header -->
        <button
          v-else
          type="button"
          :class="[
            'size-8.5 flex items-center justify-center border rounded-full text-neutral-700 shadow-sm backdrop-blur-md transition-all active:scale-95 cursor-pointer',
            'border-neutral-200/30 bg-white/10 dark:border-neutral-700/40 dark:bg-neutral-800/60 dark:text-neutral-200',
            isOpen ? 'ring-2 ring-primary-500/30' : '',
          ]"
          title="Quick settings"
        >
          <div class="i-solar:settings-bold-duotone size-4.5 text-neutral-600 dark:text-neutral-300" />
        </button>
      </slot>
    </PopoverTrigger>

    <!-- Popover Portal Panel -->
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        :side-offset="8"
        align="end"
        :collision-padding="12"
        :class="[
          'z-[10000] max-h-[min(630px,88dvh)] w-80 max-w-[calc(100vw-24px)]',
          'flex flex-col overflow-hidden',
          'border border-neutral-200/60 dark:border-neutral-800/80 rounded-2xl',
          'bg-white/70 dark:bg-neutral-950/70 shadow-2xl backdrop-blur-2xl duration-200',
        ]"
      >
        <!-- Header Bar -->
        <div
          v-if="currentView === 'root'"
          class="flex items-center justify-between border-b border-neutral-100 px-3.5 py-2.5 dark:border-neutral-800/80"
        >
          <div class="flex items-center gap-2">
            <div class="i-solar:settings-bold-duotone text-lg text-neutral-800 dark:text-neutral-100" />
            <span class="text-sm text-neutral-900 font-bold font-sans-rounded dark:text-neutral-100">Quick settings</span>
          </div>
          <button
            type="button"
            class="flex cursor-pointer items-center justify-center rounded-full p-0.5 text-neutral-400 transition-colors dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
            aria-label="Close"
            @click="isOpen = false"
          >
            <div class="i-solar:close-circle-linear text-lg" />
          </button>
        </div>

        <div
          v-else
          class="flex items-center justify-between border-b border-neutral-100 px-3 py-2.5 dark:border-neutral-800/80"
        >
          <button
            type="button"
            class="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-neutral-600 font-semibold transition hover:bg-neutral-100 dark:text-neutral-300 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            @click="currentView = 'root'"
          >
            <div class="i-solar:alt-arrow-left-linear size-4" />
            <span>Quick settings</span>
          </button>
          <button
            type="button"
            class="flex cursor-pointer items-center justify-center rounded-full p-0.5 text-neutral-400 transition-colors dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
            aria-label="Close"
            @click="isOpen = false"
          >
            <div class="i-solar:close-circle-linear text-lg" />
          </button>
        </div>

        <!-- Scrollable Body Content -->
        <div class="flex-1 overflow-y-auto p-2 scrollbar-none">
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-x-2"
            enter-to-class="opacity-100 translate-x-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-x-0"
            leave-to-class="opacity-0 -translate-x-2"
            mode="out-in"
          >
            <!-- ================= ROOT VIEW ================= -->
            <ChatOptionsRootView
              v-if="currentView === 'root'"
              key="root"
              :show-chat-layout="props.showChatLayout"
              @navigate="(view) => currentView = view"
              @apply-preset="(preset) => props.onApplyChatPreset?.(preset)"
              @open-all-settings="handleOpenAllSettings"
            />

            <!-- ================= CAPABILITIES VIEW ================= -->
            <ChatOptionsCapabilitiesView
              v-else-if="currentView === 'capabilities'"
              key="capabilities"
            />

            <!-- ================= TOOLS & WORKSTATION VIEW ================= -->
            <ChatOptionsToolsView
              v-else-if="currentView === 'tools'"
              key="tools"
              @open-provider-settings="handleOpenProviderSettings"
            />

            <!-- ================= CONTEXT INJECTIONS VIEW ================= -->
            <ChatOptionsInjectionsView
              v-else-if="currentView === 'injections'"
              key="injections"
              :character-id="effectiveCharacterId"
            />

            <!-- ================= MEMORIES & TIMELINES VIEW ================= -->
            <ChatOptionsMemoriesView
              v-else-if="currentView === 'memories'"
              key="memories"
              @view-context="handleViewContext"
              @manage-sessions="handleManageSessions"
              @search-memories="handleSearchMemories"
              @open-memory-settings="handleOpenMemorySettings"
              @open-card-settings="handleOpenCardSettings"
            />

            <!-- ================= APPEARANCE VIEW ================= -->
            <ChatOptionsAppearanceView
              v-else-if="currentView === 'appearance'"
              key="appearance"
              @browse-scenes="handleOpenBrowseScenes"
            />

            <!-- ================= CAST & STAGING VIEW ================= -->
            <ChatOptionsStagingView
              v-else-if="currentView === 'staging'"
              key="staging"
              @open-staging-settings="handleOpenStagingSettings"
            />

            <!-- ================= VOICE & AUDIO VIEW ================= -->
            <ChatOptionsVoiceView
              v-else-if="currentView === 'voice'"
              key="voice"
              @open-voice-settings="handleOpenVoiceSettings"
              @open-voice-editor="emit('openVoiceEditor', $event)"
            />
          </Transition>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>

  <StageBackgroundDialogPicker
    v-model="stageBackgroundDialogOpen"
    :card-id="effectiveCharacterId"
    :auto-apply="false"
    :close-on-pick="true"
    :selected-id="isElectron ? chatboxActiveBackgroundId : activeBackgroundId"
    @pick="(id: string) => isElectron ? backgroundStore.setChatboxActiveBackground(id) : backgroundStore.setActiveBackground(id)"
  />

  <!-- Timelines & Context Modals -->
  <ChatSessionModal v-model="chatSessionModalOpen" />

  <CharacterContextDialog
    v-model="characterContextDialogOpen"
    :character-id="effectiveCharacterId"
    :character-name="effectiveCard?.name || 'AIRI'"
  />
</template>
