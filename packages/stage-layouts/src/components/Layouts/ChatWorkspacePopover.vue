<script setup lang="ts">
import { CharacterAvatar } from '@proj-airi/stage-ui/components'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import ChatWorkspaceAvatarView from './ChatWorkspace/ChatWorkspaceAvatarView.vue'
import ChatWorkspaceCardView from './ChatWorkspace/ChatWorkspaceCardView.vue'
import ChatWorkspaceTimelineView from './ChatWorkspace/ChatWorkspaceTimelineView.vue'

const props = withDefaults(defineProps<{
  characterId?: string
  characterName?: string
}>(), {})

const emit = defineEmits<{
  (e: 'openCardSettings'): void
  (e: 'openManageSessions'): void
  (e: 'browseCards'): void
  (e: 'createCard'): void
  (e: 'manageAvatars'): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const airiCardStore = useAiriCardStore()
const chatSessionStore = useChatSessionStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const { activeSessionId, sessionMetas } = storeToRefs(chatSessionStore)

type WorkspaceTab = 'timeline' | 'card' | 'avatar'
const currentTab = ref<WorkspaceTab>('timeline')

// Reset to timeline tab when closed
watch(isOpen, (val) => {
  if (!val) {
    currentTab.value = 'timeline'
  }
})

const effectiveCardId = computed(() => {
  const rawCandidate = props.characterId || activeCardId.value
  return airiCardStore.resolveCardId(rawCandidate)
})

const effectiveCardName = computed(() => {
  const card = airiCardStore.cards.get(effectiveCardId.value) || activeCard.value
  return card?.name || props.characterName || 'Character'
})

const effectiveDisplayModelId = computed(() => {
  return airiCardStore.getCardDisplayModelId(effectiveCardId.value)
})

const activeTimelineTitle = computed(() => {
  const currentId = activeSessionId.value
  if (!currentId)
    return ''
  const meta = sessionMetas.value[currentId]
  if (meta?.title && meta.title.trim() && meta.title !== 'Untitled Timeline') {
    return meta.title.trim()
  }
  return chatSessionStore.getSessionDisplayTitle(currentId, effectiveCardId.value)
})

function handleEditCurrentCard() {
  isOpen.value = false
  emit('openCardSettings')
}

async function handleCreateSession() {
  const newId = await chatSessionStore.createSession(effectiveCardId.value)
  chatSessionStore.setActiveSession(newId)
  isOpen.value = false
}

function handleSelectSession(sessionId: string) {
  chatSessionStore.setActiveSession(sessionId)
  isOpen.value = false
}

function handleSelectCard(cardId: string) {
  airiCardStore.activeCardId = cardId
  const charIndex = chatSessionStore.getCharacterIndex(cardId)
  if (charIndex?.activeSessionId) {
    chatSessionStore.setActiveSession(charIndex.activeSessionId)
  }
}
</script>

<template>
  <PopoverRoot v-model:open="isOpen">
    <!-- Trigger slot -->
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>

    <!-- Popover Portal & Content -->
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        :side-offset="8"
        align="start"
        :collision-padding="12"
        :class="[
          'z-[10000] w-[370px] max-w-[calc(100vw-24px)] max-h-[min(650px,88dvh)]',
          'flex flex-col overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-neutral-800/80',
          'bg-white/70 dark:bg-neutral-950/70 shadow-2xl backdrop-blur-2xl duration-150',
        ]"
      >
        <!-- Top Title Bar -->
        <div class="flex items-center justify-between border-b border-neutral-100 px-3.5 py-2.5 dark:border-neutral-800/80">
          <span class="text-sm text-neutral-900 font-bold font-sans-rounded dark:text-neutral-100">
            Chat workspace
          </span>
          <button
            type="button"
            class="flex cursor-pointer items-center justify-center rounded-full p-0.5 text-neutral-400 transition-colors dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
            aria-label="Close"
            @click="isOpen = false"
          >
            <div class="i-solar:close-circle-linear text-lg" />
          </button>
        </div>

        <!-- Shared Card Summary Banner -->
        <div class="flex items-center justify-between border-b border-neutral-100/80 bg-neutral-50/60 px-3.5 py-2.5 dark:border-neutral-800/60 dark:bg-neutral-900/40">
          <div class="min-w-0 flex items-center gap-2.5">
            <CharacterAvatar
              :card-id="effectiveCardId"
              :name="effectiveCardName"
              :display-model-id="effectiveDisplayModelId"
              size-class="size-9.5"
              shape="rounded"
            />
            <div class="min-w-0 flex flex-col">
              <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">
                {{ effectiveCardName }}
              </span>
              <span class="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
                Current card · Timeline {{ activeTimelineTitle }}
              </span>
            </div>
          </div>

          <button
            type="button"
            class="shadow-xs size-8 flex shrink-0 cursor-pointer items-center justify-center border border-neutral-200/60 rounded-xl bg-white text-neutral-500 transition dark:border-neutral-800 dark:bg-neutral-800 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
            title="Edit card"
            @click="handleEditCurrentCard"
          >
            <div class="i-solar:pen-linear size-4" />
          </button>
        </div>

        <!-- 3-Tab Segmented Control -->
        <div class="px-3 pb-1 pt-2.5">
          <div class="grid grid-cols-3 gap-1 border border-neutral-200/50 rounded-xl bg-neutral-100/80 p-1 text-xs font-semibold dark:border-neutral-800/80 dark:bg-neutral-900/90">
            <button
              type="button"
              :class="[
                'flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer',
                currentTab === 'timeline'
                  ? 'bg-primary-500 text-white shadow-sm font-bold'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
              ]"
              @click="currentTab = 'timeline'"
            >
              <div class="i-solar:history-bold size-3.5" />
              <span>Timeline</span>
            </button>

            <button
              type="button"
              :class="[
                'flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer',
                currentTab === 'card'
                  ? 'bg-primary-500 text-white shadow-sm font-bold'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
              ]"
              @click="currentTab = 'card'"
            >
              <div class="i-solar:card-2-bold size-3.5" />
              <span>Card</span>
            </button>

            <button
              type="button"
              :class="[
                'flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer',
                currentTab === 'avatar'
                  ? 'bg-primary-500 text-white shadow-sm font-bold'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
              ]"
              @click="currentTab = 'avatar'"
            >
              <div class="i-solar:user-bold size-3.5" />
              <span>Avatar</span>
            </button>
          </div>
        </div>

        <!-- Scrollable Tab Content Container with Horizontal Slide Transitions -->
        <div class="flex-1 overflow-y-auto p-3 scrollbar-none">
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-x-2"
            enter-to-class="opacity-100 translate-x-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-x-0"
            leave-to-class="opacity-0 -translate-x-2"
            mode="out-in"
          >
            <!-- SUB-VIEW 1: TIMELINE -->
            <ChatWorkspaceTimelineView
              v-if="currentTab === 'timeline'"
              key="timeline"
              :character-id="effectiveCardId"
              :character-name="effectiveCardName"
              @select-session="handleSelectSession"
              @create-session="handleCreateSession"
              @open-manage-sessions="emit('openManageSessions')"
            />

            <!-- SUB-VIEW 2: CARD -->
            <ChatWorkspaceCardView
              v-else-if="currentTab === 'card'"
              key="card"
              :active-card-id="effectiveCardId"
              @select-card="handleSelectCard"
              @edit-card="handleEditCurrentCard"
              @browse-cards="emit('browseCards')"
              @create-card="emit('createCard')"
            />

            <!-- SUB-VIEW 3: AVATAR -->
            <ChatWorkspaceAvatarView
              v-else-if="currentTab === 'avatar'"
              key="avatar"
              :card-id="effectiveCardId"
              :initial-model-id="effectiveDisplayModelId"
              @applied="isOpen = false"
              @manage-avatars="emit('manageAvatars')"
            />
          </Transition>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
