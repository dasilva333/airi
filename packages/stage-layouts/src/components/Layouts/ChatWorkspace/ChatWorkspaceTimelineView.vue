<script setup lang="ts">
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref } from 'vue'

const props = defineProps<{
  characterId: string
  characterName: string
}>()

const emit = defineEmits<{
  (e: 'selectSession', sessionId: string): void
  (e: 'createSession'): void
  (e: 'openManageSessions'): void
}>()

const chatSessionStore = useChatSessionStore()
const { activeSessionId } = storeToRefs(chatSessionStore)

const searchQuery = ref('')
const editingSessionId = ref<string | null>(null)
const renameInput = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const characterSessions = computed(() => {
  const charId = props.characterId
  const characterIndex = charId ? chatSessionStore.getCharacterIndex(charId) : null
  if (!characterIndex)
    return []
  return Object.values(characterIndex.sessions).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
})

const filteredSessions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return characterSessions.value
  }
  return characterSessions.value.filter((session) => {
    const title = (session.title || '').toLowerCase()
    const universe = (session.universeId || '').toLowerCase()
    return title.includes(query) || universe.includes(query)
  })
})

function formatTimelineTitle(session: any): string {
  if (session.title && session.title !== 'Untitled Timeline') {
    return session.title.trim()
  }
  return chatSessionStore.getSessionDisplayTitle(session.sessionId, props.characterId)
}

function formatRelativeTime(date?: number | string | Date): string {
  if (!date) {
    return 'Recently'
  }
  const ms = typeof date === 'number' ? date : new Date(date).getTime()
  if (Number.isNaN(ms)) {
    return 'Recently'
  }
  const diff = Math.max(0, Date.now() - ms)
  const min = Math.floor(diff / 60000)
  if (min < 2) {
    return 'Just now'
  }
  if (min < 60) {
    return `${min}m ago`
  }
  const hours = Math.floor(min / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.floor(hours / 24)
  if (days === 1) {
    return 'Yesterday'
  }
  if (days < 7) {
    return `${days}d ago`
  }
  const d = new Date(ms)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function handleStartRename(session: any, e: Event) {
  e.stopPropagation()
  editingSessionId.value = session.sessionId
  renameInput.value = formatTimelineTitle(session)
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

async function handleCommitRename(session: any) {
  if (editingSessionId.value !== session.sessionId) {
    return
  }
  const val = renameInput.value.trim()
  if (val && val !== session.title) {
    await chatSessionStore.renameSession(session.sessionId, val)
  }
  editingSessionId.value = null
}

function handleCancelRename() {
  editingSessionId.value = null
}

async function handleDeleteSession(session: any, e: Event) {
  e.stopPropagation()
  if (characterSessions.value.length <= 1) {
    return
  }
  await chatSessionStore.deleteSession(session.sessionId)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Search Bar & New Button Row -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <div class="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-neutral-400">
          <div class="i-solar:magnifer-linear size-3.5" />
        </div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search timelines..."
          class="w-full border border-neutral-200/60 rounded-xl bg-neutral-100/60 py-1.5 pl-8 pr-3 text-xs text-neutral-800 outline-none transition dark:border-neutral-800/80 focus:border-primary-400 dark:bg-neutral-900/60 dark:text-neutral-100 placeholder-neutral-400"
        >
      </div>

      <!-- New Timeline Button -->
      <button
        type="button"
        class="size-8.5 flex shrink-0 flex-col cursor-pointer items-center justify-center rounded-xl bg-primary-500 text-white shadow-sm transition active:scale-95 hover:bg-primary-600"
        title="Create new timeline"
        @click="emit('createSession')"
      >
        <div class="i-solar:add-circle-bold size-4" />
      </button>
    </div>

    <!-- Section Title -->
    <div class="px-0.5 pt-1 text-[11px] text-neutral-400 font-semibold tracking-wide">
      Timelines for {{ characterName }}
    </div>

    <!-- Scrollable Timelines List -->
    <div class="max-h-64 flex flex-col gap-1 overflow-y-auto pr-0.5 scrollbar-thin">
      <div
        v-for="session in filteredSessions"
        :key="session.sessionId"
        :class="[
          'group relative flex items-center justify-between rounded-xl px-2.5 py-2 transition-all duration-150 cursor-pointer border',
          activeSessionId === session.sessionId
            ? 'border-primary-400/80 bg-primary-500/10 text-primary-900 dark:text-primary-100 shadow-sm'
            : 'border-transparent hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80 text-neutral-700 dark:text-neutral-200',
        ]"
        @click="emit('selectSession', session.sessionId)"
      >
        <!-- Left: Status Dot & Title/Meta -->
        <div class="min-w-0 flex flex-1 items-center gap-2.5 pr-2">
          <div
            :class="[
              'size-2 shrink-0 rounded-full transition-colors',
              activeSessionId === session.sessionId
                ? 'bg-primary-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                : 'bg-neutral-300 dark:bg-neutral-700',
            ]"
          />

          <div class="min-w-0 flex flex-1 flex-col">
            <!-- Title (or inline rename input) -->
            <div v-if="editingSessionId === session.sessionId" class="flex items-center gap-1" @click.stop>
              <input
                ref="renameInputRef"
                v-model="renameInput"
                type="text"
                class="w-full border border-primary-400 rounded-md bg-white px-1.5 py-0.5 text-xs text-neutral-900 outline-none dark:bg-neutral-900 dark:text-neutral-100"
                @blur="handleCommitRename(session)"
                @keydown.enter="handleCommitRename(session)"
                @keydown.esc="handleCancelRename"
              >
            </div>
            <span
              v-else
              :class="[
                'truncate text-xs',
                activeSessionId === session.sessionId ? 'font-bold' : 'font-medium',
              ]"
            >
              {{ formatTimelineTitle(session) }}
            </span>

            <!-- Subtitle Metadata: message count & relative time -->
            <span class="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
              {{ session.messageCount || 0 }} messages · {{ formatRelativeTime(session.updatedAt || session.createdAt) }}
            </span>
          </div>
        </div>

        <!-- Right Action Cluster: Checkmark Badge, Rename, Delete -->
        <div class="flex shrink-0 items-center gap-1">
          <!-- Active Checkmark Badge -->
          <div
            v-if="activeSessionId === session.sessionId"
            class="size-5 flex items-center justify-center rounded-full bg-primary-500 text-white shadow-sm"
          >
            <div class="i-solar:check-read-bold size-3" />
          </div>

          <!-- Rename Button -->
          <button
            type="button"
            class="size-6 flex cursor-pointer items-center justify-center rounded-lg text-neutral-400 opacity-0 transition hover:bg-neutral-200/60 hover:text-neutral-700 group-hover:opacity-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            title="Rename timeline"
            @click="handleStartRename(session, $event)"
          >
            <div class="i-solar:pen-linear size-3" />
          </button>

          <!-- Delete Button (Only on non-active or multiple) -->
          <button
            v-if="characterSessions.length > 1"
            type="button"
            class="size-6 flex cursor-pointer items-center justify-center rounded-lg text-neutral-400 opacity-0 transition hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
            title="Delete timeline"
            @click="handleDeleteSession(session, $event)"
          >
            <div class="i-solar:trash-bin-trash-linear size-3" />
          </button>
        </div>
      </div>

      <!-- Empty Filter State -->
      <div v-if="filteredSessions.length === 0" class="py-6 text-center text-xs text-neutral-400">
        No timelines match your search.
      </div>
    </div>

    <!-- Footer: Manage Timelines Action -->
    <div class="pt-1">
      <button
        type="button"
        class="w-full flex cursor-pointer items-center justify-center gap-1.5 border border-neutral-200/60 rounded-xl bg-neutral-100/70 py-2 text-xs text-neutral-700 font-semibold transition active:scale-98 dark:border-neutral-800/80 dark:bg-neutral-900/60 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
        @click="emit('openManageSessions')"
      >
        <div class="i-solar:settings-linear size-3.5 text-neutral-400" />
        <span>Manage timelines</span>
        <div class="i-solar:arrow-right-linear size-3 text-neutral-400" />
      </button>
    </div>
  </div>
</template>
