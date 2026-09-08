<script setup lang="ts">
import { format } from 'date-fns'
import { storeToRefs } from 'pinia'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import UniversePickerModal from '../dialogs/UniversePickerModal.vue'

import { chatSessionsRepo } from '../../../database/repos/chat-sessions.repo'
import { useChatSessionStore } from '../../../stores/chat/session-store'
import { useAiriCardStore } from '../../../stores/modules/airi-card'

const showDialog = defineModel<boolean>({ default: false })

const chatSessionStore = useChatSessionStore()
const airiCardStore = useAiriCardStore()

const { activeCardId } = storeToRefs(airiCardStore)
const { activeSessionId } = storeToRefs(chatSessionStore)

const rawTurnsCount = ref<number | null>(null)
const uniqueTurnsCount = ref<number | null>(null)
const statsLoading = ref(false)

async function loadAnalytics() {
  if (!activeCardId.value) {
    rawTurnsCount.value = null
    uniqueTurnsCount.value = null
    return
  }
  statsLoading.value = true
  try {
    const characterIndex = chatSessionStore.getCharacterIndex(activeCardId.value)
    if (!characterIndex) {
      rawTurnsCount.value = 0
      uniqueTurnsCount.value = 0
      return
    }

    const sessions = Object.values(characterIndex.sessions)
    let totalRaw = 0
    const uniqueContents = new Set<string>()

    const sessionRecords = await Promise.all(
      sessions.map(s => chatSessionsRepo.getSession(s.sessionId)),
    )

    for (const record of sessionRecords) {
      if (!record)
        continue
      for (const m of record.messages) {
        if (m.role === 'user' || m.role === 'assistant') {
          totalRaw++
          const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
          uniqueContents.add(text.trim())
        }
      }
    }

    rawTurnsCount.value = totalRaw
    uniqueTurnsCount.value = uniqueContents.size
  }
  catch (err) {
    console.error('[ChatSessionModal] Failed to load session stats:', err)
  }
  finally {
    statsLoading.value = false
  }
}

watch(showDialog, (open) => {
  if (open) {
    void loadAnalytics()
  }
})

const characterSessions = computed(() => {
  if (!activeCardId.value)
    return []
  const characterIndex = chatSessionStore.getCharacterIndex(activeCardId.value)
  if (!characterIndex)
    return []

  return Object.values(characterIndex.sessions).sort((a, b) => b.updatedAt - a.updatedAt)
})

const showUniversePicker = ref(false)
const pickerAction = ref<'create' | 'migrate'>('create')
const sessionToMigrate = ref<string | null>(null)

function handleCreateSessionClick() {
  pickerAction.value = 'create'
  showUniversePicker.value = true
}

function handleOpenUniverseMigration(sessionId: string) {
  pickerAction.value = 'migrate'
  sessionToMigrate.value = sessionId
  showUniversePicker.value = true
}

async function handleUniverseConfirm(universeId: string) {
  if (pickerAction.value === 'create') {
    if (!activeCardId.value)
      return
    await chatSessionStore.createSession(activeCardId.value, { universeId })
    showDialog.value = false
  }
  else if (pickerAction.value === 'migrate' && sessionToMigrate.value) {
    await chatSessionStore.migrateSessionUniverse(sessionToMigrate.value, universeId)
    sessionToMigrate.value = null
  }
}

function handleSelectSession(sessionId: string) {
  chatSessionStore.setActiveSession(sessionId)
  showDialog.value = false
}

async function handleDeleteSession(sessionId: string) {
  if (characterSessions.value.length <= 1)
    return

  await chatSessionStore.deleteSession(sessionId)
}

function formatSessionDate(timestamp: number) {
  return format(timestamp, 'MMM d, yyyy HH:mm')
}
const editingSessionId = ref<string | null>(null)
const editText = ref('')

function handleStartEdit(sessionId: string, currentTitle?: string) {
  editingSessionId.value = sessionId
  editText.value = currentTitle || chatSessionStore.getSessionDisplayTitle(sessionId, activeCardId.value)
}

function handleSaveTitle(sessionId: string) {
  if (!editText.value.trim())
    return

  const meta = chatSessionStore.sessionMetas[sessionId]
  if (meta) {
    meta.title = editText.value.trim()
    chatSessionStore.persistSessionMessages(sessionId)
  }
  editingSessionId.value = null
}
</script>

<template>
  <DialogRoot :open="showDialog" @update:open="val => showDialog = val">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-[9999] max-h-[85dvh] max-w-lg w-[92dvw] flex flex-col transform overflow-hidden border border-neutral-200/50 rounded-3xl bg-white/95 p-0 shadow-2xl outline-none backdrop-blur-xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700/50 dark:bg-neutral-900/95">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 pb-4">
          <div class="flex flex-col">
            <DialogTitle class="text-xl text-neutral-800 font-bold tracking-tight dark:text-neutral-100">
              Parallel Timelines
            </DialogTitle>
            <span class="mt-1 text-xs text-neutral-500 font-medium dark:text-neutral-400">
              Manage different branches of your story
            </span>
            <div v-if="rawTurnsCount !== null" class="mt-2 flex items-center gap-3 text-[10px] text-primary-600 font-bold tracking-wider uppercase dark:text-primary-400">
              <span class="flex items-center gap-1">
                <span class="i-solar:chat-line-bold-duotone text-xs" />
                {{ rawTurnsCount }} Raw Turns
              </span>
              <span class="text-neutral-300 dark:text-neutral-700">|</span>
              <span class="flex items-center gap-1">
                <span class="i-solar:magic-stick-3-bold-duotone text-xs" />
                {{ uniqueTurnsCount }} Unique Turns
              </span>
            </div>
          </div>
          <button
            class="group rounded-full p-2 text-neutral-400 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
            @click="showDialog = false"
          >
            <div class="i-solar:close-circle-bold-duotone text-2xl transition-transform group-hover:scale-110" />
          </button>
        </div>

        <!-- Create New Button Block -->
        <div class="px-6 pb-4">
          <button
            class="w-full flex items-center justify-center gap-2 border border-primary-200 rounded-2xl bg-primary-50/50 py-3 text-sm text-primary-700 font-bold transition-all active:scale-[0.98] dark:border-primary-800/30 dark:bg-primary-900/20 hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-primary-800/30"
            @click="handleCreateSessionClick"
          >
            <div class="i-solar:add-circle-bold-duotone text-lg" />
            Start New Timeline
          </button>
        </div>

        <!-- Session List -->
        <div class="flex-1 overflow-y-auto px-6 pb-6 scrollbar-none">
          <div class="space-y-3">
            <div
              v-for="session in characterSessions"
              :key="session.sessionId"
              :class="[
                'group relative flex flex-col gap-1 p-4 rounded-2xl border transition-all cursor-pointer',
                session.sessionId === activeSessionId
                  ? 'bg-primary-50/30 border-primary-500 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)] dark:bg-primary-900/10 dark:border-primary-400'
                  : 'bg-neutral-50/50 border-neutral-100 dark:bg-neutral-800/30 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50',
              ]"
              @click="handleSelectSession(session.sessionId)"
            >
              <!-- Active Badge -->
              <div
                v-if="session.sessionId === activeSessionId"
                class="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-primary-500 px-2 py-0.5 text-[10px] text-white font-black tracking-widest uppercase shadow-lg shadow-primary-500/20"
              >
                <div class="i-solar:check-circle-bold text-[10px]" />
                Active
              </div>

              <div v-if="editingSessionId === session.sessionId" class="flex items-center gap-2 pr-24" @click.stop>
                <input
                  v-model="editText"
                  class="w-full border border-primary-500 rounded bg-white px-2 py-0.5 text-sm font-bold dark:bg-neutral-800 focus:outline-none"
                  @keyup.enter="handleSaveTitle(session.sessionId)"
                  @keyup.esc="editingSessionId = null"
                >
                <button
                  class="p-1 text-primary-500 hover:text-primary-600"
                  @click.stop="handleSaveTitle(session.sessionId)"
                >
                  <div class="i-solar:check-circle-bold text-lg" />
                </button>
              </div>
              <span
                v-else
                :class="[
                  'text-sm font-bold truncate pr-24',
                  session.sessionId === activeSessionId ? 'text-primary-700 dark:text-primary-300' : 'text-neutral-700 dark:text-neutral-200',
                ]"
              >
                {{ session.title || chatSessionStore.getSessionDisplayTitle(session.sessionId, activeCardId) }}
              </span>

              <div class="mt-1 flex items-center gap-4">
                <div class="flex items-center gap-1.5 text-[11px] text-neutral-500 font-medium dark:text-neutral-400">
                  <div class="i-solar:calendar-minimalistic-bold-duotone opacity-70" />
                  {{ formatSessionDate(session.createdAt) }}
                </div>
                <div class="flex items-center gap-1.5 text-[11px] text-neutral-500 font-medium dark:text-neutral-400">
                  <div class="i-solar:chat-line-bold-duotone opacity-70" />
                  {{ session.messageCount || 0 }} messages
                </div>
                <div class="flex items-center gap-1.5 text-[11px] text-primary-600 font-bold dark:text-primary-400">
                  <div class="i-solar:globus-bold opacity-70" />
                  {{ session.universeId || 'global' }}
                </div>
              </div>

              <!-- Last Active info -->
              <div class="mt-2 text-[10px] text-neutral-400 font-medium italic dark:text-neutral-500">
                Last active {{ formatSessionDate(session.updatedAt) }}
              </div>

              <!-- Actions -->
              <div class="absolute bottom-4 right-4 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  class="rounded-xl bg-neutral-100 p-2 text-neutral-600 transition-all dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  title="Change Universe"
                  @click.stop="handleOpenUniverseMigration(session.sessionId)"
                >
                  <div class="i-solar:globus-bold text-lg" />
                </button>
                <button
                  class="rounded-xl bg-neutral-100 p-2 text-neutral-600 transition-all dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  title="Edit Title"
                  @click.stop="handleStartEdit(session.sessionId, session.title)"
                >
                  <div class="i-solar:pen-bold text-lg" />
                </button>
                <button
                  v-if="characterSessions.length > 1"
                  class="rounded-xl bg-red-50 p-2 text-red-500 transition-all dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-800/30"
                  title="Delete Session"
                  @click.stop="handleDeleteSession(session.sessionId)"
                >
                  <div class="i-solar:trash-bin-trash-bold-duotone text-lg" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <UniversePickerModal
    v-model="showUniversePicker"
    :character-id="activeCardId"
    :title="pickerAction === 'create' ? 'Start New Timeline Universe' : 'Change Timeline Universe'"
    :description="pickerAction === 'create' ? 'Assign a universe or create a new memory pool for this timeline.' : 'Move this session and all its associated memories and images to another universe.'"
    @confirm="handleUniverseConfirm"
  />
</template>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes content-show {
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes content-hide {
  from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  to { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
}

.animate-fadeIn { animation: fade-in 200ms ease-out; }
.animate-fadeOut { animation: fade-out 200ms ease-in; }
.animate-contentShow { animation: content-show 300ms cubic-bezier(0.16, 1, 0.3, 1); }
.animate-contentHide { animation: content-hide 200ms ease-in; }
</style>
