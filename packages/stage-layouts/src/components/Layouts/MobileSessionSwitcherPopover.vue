<script setup lang="ts">
import { ChatSessionModal } from '@proj-airi/stage-ui/components'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

const chatSessionStore = useChatSessionStore()
const airiCardStore = useAiriCardStore()
const { activeCardId } = storeToRefs(airiCardStore)
const { activeSessionId, sessionMetas, messages } = storeToRefs(chatSessionStore)

const isOpen = ref(false)
const popoverRef = ref<HTMLElement>()
const showManageModal = ref(false)

onClickOutside(popoverRef, () => {
  isOpen.value = false
})

// List of sessions for dropdown
const characterSessions = computed(() => {
  const cardId = activeCardId.value
  const characterIndex = cardId ? chatSessionStore.getCharacterIndex(cardId) : null
  const indexedList = characterIndex
    ? Object.values(characterIndex.sessions).map(s => ({
        ...s,
        messageCount: s.sessionId === activeSessionId.value ? Math.max(s.messageCount || 0, messages.value.length) : (s.messageCount || 0),
      }))
    : []

  // Ensure active session is present in the list even if index hasn't finished writing
  const currentId = activeSessionId.value
  if (currentId && !indexedList.some(s => s.sessionId === currentId)) {
    const meta = sessionMetas.value[currentId]
    indexedList.unshift({
      sessionId: currentId,
      userId: 'local',
      characterId: cardId || 'default',
      title: meta?.title || 'Main Timeline',
      messageCount: messages.value.length || meta?.messageCount || 0,
      createdAt: meta?.createdAt || Date.now(),
      updatedAt: meta?.updatedAt || Date.now(),
      universeId: meta?.universeId,
    })
  }

  // If list is completely empty, provide fallback Main Timeline
  if (indexedList.length === 0) {
    return [{
      sessionId: currentId || 'default-session',
      userId: 'local',
      characterId: cardId || 'default',
      title: 'Main Timeline',
      messageCount: messages.value.length || 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      universeId: 'global',
    }]
  }

  return indexedList.sort((a, b) => b.updatedAt - a.updatedAt)
})

const activeSessionMeta = computed(() => {
  if (!activeSessionId.value)
    return undefined
  return sessionMetas.value[activeSessionId.value]
})

const activeSessionLabel = computed(() => {
  const meta = activeSessionMeta.value
  if (!meta)
    return 'Main Timeline'
  return meta.title && meta.title !== 'Untitled Timeline' ? meta.title : 'Main Timeline'
})

function handleSelectSession(sessionId: string) {
  chatSessionStore.setActiveSession(sessionId)
  isOpen.value = false
}

async function handleCreateSession() {
  if (!activeCardId.value)
    return
  const newSessionId = await chatSessionStore.createSession(activeCardId.value)
  chatSessionStore.setActiveSession(newSessionId)
  isOpen.value = false
}

function handleOpenManage() {
  isOpen.value = false
  showManageModal.value = true
}
</script>

<template>
  <div ref="popoverRef" class="relative">
    <!-- Trigger Button -->
    <button
      :class="[
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all active:scale-95 cursor-pointer',
        'border border-neutral-200/40 dark:border-neutral-700/40',
        'bg-white/10 dark:bg-neutral-800/40 backdrop-blur-md',
        'hover:bg-white/20 dark:hover:bg-neutral-800/60',
        isOpen ? 'ring-2 ring-primary-500/30' : '',
      ]"
      type="button"
      title="Switch Timeline / Story"
      @click="isOpen = !isOpen"
    >
      <div class="i-solar:notebook-bookmark-bold-duotone size-3.5 shrink-0 text-primary-500" />
      <span class="max-w-24 truncate text-neutral-800 sm:max-w-36 dark:text-neutral-200">
        {{ activeSessionLabel }}
      </span>
      <div
        class="i-solar:alt-arrow-down-linear size-2.5 shrink-0 text-neutral-400 transition-transform duration-200"
        :class="isOpen ? 'rotate-180' : ''"
      />
    </button>

    <!-- Popover Panel -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="-translate-y-1 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="-translate-y-1 opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute left-0 top-full z-[9999] mt-2 max-w-[calc(100vw-24px)] w-72 flex flex-col origin-top-left border border-neutral-200/60 rounded-2xl bg-white/95 p-2.5 shadow-2xl backdrop-blur-2xl dark:border-neutral-800/80 dark:bg-neutral-950/95"
      >
        <!-- Header -->
        <div class="mb-2 flex items-center justify-between border-b border-neutral-200/40 px-1 pb-2 dark:border-neutral-800/40">
          <div class="flex items-center gap-1.5 text-[10px] text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">
            <div class="i-solar:history-bold-duotone text-primary-500" />
            <span>Story Timelines</span>
          </div>
          <button
            class="flex cursor-pointer items-center gap-1 rounded-lg bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-600 font-bold transition active:scale-95 hover:bg-primary-500/20 dark:text-primary-400"
            @click="handleCreateSession"
          >
            <div class="i-solar:add-circle-bold size-3" />
            <span>New Timeline</span>
          </button>
        </div>

        <!-- Session List -->
        <div class="max-h-60 overflow-y-auto pr-1 scrollbar-thin space-y-1">
          <div
            v-for="session in characterSessions"
            :key="session.sessionId"
            class="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium transition-all"
            :class="activeSessionId === session.sessionId
              ? 'bg-primary-500/10 text-primary-700 font-bold dark:bg-primary-950/50 dark:text-primary-300'
              : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900'"
            @click="handleSelectSession(session.sessionId)"
          >
            <div class="min-w-0 flex flex-col pr-2">
              <div class="flex items-center gap-1.5">
                <div
                  v-if="activeSessionId === session.sessionId"
                  class="size-1.5 shrink-0 rounded-full bg-primary-500"
                />
                <span class="truncate">{{ session.title || 'Main Timeline' }}</span>
              </div>
              <span v-if="session.universeId && session.universeId !== 'global'" class="mt-0.5 truncate text-[9px] text-neutral-400 font-normal">
                Universe: {{ session.universeId }}
              </span>
            </div>
            <span class="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-500 font-mono dark:bg-neutral-800 dark:text-neutral-400">
              {{ session.messageCount || 0 }} msgs
            </span>
          </div>
        </div>

        <!-- Footer: Manage All Timelines -->
        <div class="mt-2 border-t border-neutral-200/40 pt-2 dark:border-neutral-800/40">
          <button
            class="w-full flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-neutral-100/70 py-1.5 text-[10px] text-neutral-600 font-semibold transition active:scale-95 dark:bg-neutral-800/60 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-700/60"
            @click="handleOpenManage"
          >
            <div class="i-solar:settings-bold-duotone size-3.5 text-neutral-400" />
            <span>Manage All Timelines</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Full Management Modal -->
    <ChatSessionModal v-model="showManageModal" />
  </div>
</template>
