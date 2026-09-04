<script setup lang="ts">
import SelectiveSyncPanel from '@proj-airi/stage-ui/components/scenarios/providers/selective-sync-panel.vue'

import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useSyncEngineStore } from '@proj-airi/stage-ui/stores/sync-engine'
import { storeToRefs } from 'pinia'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const syncStore = useSyncEngineStore()
const cardStore = useAiriCardStore()

const {
  syncEnabled,
  syncInterval,
  conflictStrategy,
  activeProvider,
  isSyncing,
  lastSyncTime,
  syncError,
  conflicts,
  selectiveSyncEnabled,
  selectiveCheckedIds,
} = storeToRefs(syncStore)

// Selective Sync Modal states
const isSelectiveSyncOpen = ref(false)
async function onSelectiveSync(checkedIds: string[]) {
  selectiveCheckedIds.value = checkedIds
  selectiveSyncEnabled.value = true
  isSelectiveSyncOpen.value = false
  await syncStore.triggerSync()
}

function getConflictCharacterName(conflict: any): string {
  const charId = conflict.sessionDetails?.local?.characterId || conflict.sessionDetails?.remote?.characterId
  if (!charId)
    return ''
  const card = cardStore.cards.get(charId)
  return card?.name || charId
}

const formattedLastSync = computed(() => {
  if (!lastSyncTime.value)
    return 'Never'
  return new Date(lastSyncTime.value).toLocaleString()
})

function handleConfigureProvider() {
  if (activeProvider.value === 'local-fs') {
    router.push('/settings/providers/cloud/local-fs')
  }
  else if (activeProvider.value === 's3') {
    router.push('/settings/providers/cloud/s3')
  }
  else {
    router.push('/settings/providers#cloud')
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0)
    return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

function cleanKeyLabel(key: string): string {
  return key.replace('local:', '')
}

async function handleRestoreFromBackup() {
  const confirmed = confirm(
    'WARNING: This will completely wipe all local settings, characters, chat history, and assets, replacing them with the remote backup. This action cannot be undone.\n\nAre you sure you want to proceed?',
  )
  if (confirmed) {
    await syncStore.forceRestoreFromRemote()
  }
}

async function handleRestoreSettingsOnly() {
  const confirmed = confirm(
    'WARNING: This will overwrite your local settings and configurations with the versions from your remote backup. Your character models and background assets will not be affected.\n\nAre you sure you want to proceed?',
  )
  if (confirmed) {
    await syncStore.restoreSettingsFromRemote()
  }
}

function isMergeable(key: string): boolean {
  return (
    key.startsWith('local:chat/sessions/')
    || key === 'local:localstorage/settings/live2d/available-motions'
    || key === 'local:localstorage/settings/speech/voice-profiles'
    || ['local:memory/short-term/local', 'local:memory/text-journal/local', 'local:memory/echo-chips/local', 'local:airi-cards'].includes(key)
    || key.startsWith('local:chat/index/')
  )
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="h-fit w-full flex flex-col gap-4 rounded-xl bg-neutral-100 p-4 dark:bg-[rgba(0,0,0,0.3)]">
      <div>
        <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-400">
          Cloud Sync Settings
        </h2>
        <div class="text-neutral-400 dark:text-neutral-500">
          Configure how and when your databases, character cards, memory segments, and media assets are synchronized.
        </div>
      </div>

      <!-- Sync Enable Switch -->
      <div class="flex items-center justify-between border-b border-neutral-200 py-3 dark:border-neutral-800">
        <div>
          <div class="text-neutral-700 font-medium dark:text-neutral-300">
            Enable Cloud Sync
          </div>
          <div class="text-xs text-neutral-400 dark:text-neutral-500">
            Automatically back up and sync your data in the background.
          </div>
        </div>
        <button
          class="relative h-6 w-11 inline-flex shrink-0 cursor-pointer border-2 border-transparent rounded-full transition-colors duration-200 ease-in-out focus:outline-none"
          :class="syncEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
          role="switch"
          :aria-checked="syncEnabled"
          @click="syncEnabled = !syncEnabled"
        >
          <span
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
            :class="syncEnabled ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <!-- Sync Interval -->
      <div class="flex flex-col gap-2 border-b border-neutral-200 py-3 dark:border-neutral-800">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-neutral-700 font-medium dark:text-neutral-300">
              Sync Interval (Minutes)
            </div>
            <div class="text-xs text-neutral-400 dark:text-neutral-500">
              Time between automatic background sync loops.
            </div>
          </div>
          <span class="text-sm text-neutral-600 font-semibold dark:text-neutral-400">{{ syncInterval }} min</span>
        </div>
        <input
          v-model.number="syncInterval"
          type="range"
          min="5"
          max="120"
          step="5"
          class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-700"
        >
      </div>

      <!-- Conflict Strategy -->
      <div class="flex items-center justify-between border-b border-neutral-200 py-3 dark:border-neutral-800">
        <div>
          <div class="text-neutral-700 font-medium dark:text-neutral-300">
            Conflict Resolution Strategy
          </div>
          <div class="text-xs text-neutral-400 dark:text-neutral-500">
            How conflict is resolved if data diverges on multiple devices.
          </div>
        </div>
        <select
          v-model="conflictStrategy"
          class="border border-neutral-300 rounded-lg bg-white px-3 py-1.5 text-sm text-neutral-700 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-300"
        >
          <option value="lww">
            Last-Write-Wins (LWW)
          </option>
          <option value="remote-wins">
            Remote-Wins (Override Conflicts)
          </option>
          <option value="local-wins">
            Local-Wins (Keep Local Copy)
          </option>
        </select>
      </div>

      <!-- Selective Sync Toggle -->
      <div class="flex items-center justify-between border-b border-neutral-200 py-3 dark:border-neutral-800">
        <div>
          <div class="text-neutral-700 font-medium dark:text-neutral-300">
            Selective Sync
          </div>
          <div class="text-xs text-neutral-400 dark:text-neutral-500">
            Only sync selected characters, chat histories, and display models.
          </div>
        </div>
        <button
          class="relative h-6 w-11 inline-flex shrink-0 cursor-pointer border-2 border-transparent rounded-full transition-colors duration-200 ease-in-out focus:outline-none"
          :class="selectiveSyncEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
          role="switch"
          :aria-checked="selectiveSyncEnabled"
          @click="selectiveSyncEnabled = !selectiveSyncEnabled"
        >
          <span
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
            :class="selectiveSyncEnabled ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <!-- Active Provider Info -->
      <div class="flex items-center justify-between py-2">
        <div>
          <div class="text-neutral-700 font-medium dark:text-neutral-300">
            Active Storage Provider
          </div>
          <div class="text-xs text-neutral-400 dark:text-neutral-500">
            Choose which sync target is active.
          </div>
        </div>
        <div class="flex items-center gap-2">
          <select
            v-model="activeProvider"
            class="border border-neutral-300 rounded-lg bg-white px-3 py-1.5 text-sm text-neutral-700 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <option value="local-fs">
              Local File System / Samba
            </option>
            <option value="s3">
              S3-Compatible Cloud Storage
            </option>
          </select>
          <button
            class="border border-neutral-200 rounded-xl px-4 py-2 text-sm text-neutral-600 font-semibold outline-none transition-colors duration-200 dark:border-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="handleConfigureProvider"
          >
            Configure
          </button>
        </div>
      </div>
    </div>

    <!-- Sync Now Trigger Panel -->
    <div class="flex flex-col gap-4 border border-neutral-200 rounded-xl p-4 dark:border-neutral-800">
      <div class="flex flex-row items-center gap-3">
        <div class="size-10 flex items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
          <div class="i-solar:refresh-bold text-xl" :class="{ 'animate-spin': isSyncing }" />
        </div>
        <div class="flex flex-col">
          <span class="text-neutral-700 font-semibold dark:text-neutral-300">Manual Synchronization</span>
          <span class="text-xs text-neutral-400 dark:text-neutral-500">Last Synced: {{ formattedLastSync }}</span>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <button
            class="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-600 font-semibold outline-none transition-colors duration-200 dark:border-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
            :disabled="isSyncing"
            @click="isSelectiveSyncOpen = true"
          >
            Selective Sync...
          </button>
          <button
            class="rounded-xl bg-primary-500 px-5 py-2.5 text-sm text-white font-semibold transition-colors duration-200 hover:bg-primary-600 focus:outline-none"
            :disabled="isSyncing"
            @click="syncStore.triggerSync()"
          >
            {{ isSyncing ? 'Syncing...' : (selectiveSyncEnabled ? 'Sync Selected' : 'Sync Full') }}
          </button>
        </div>
      </div>

      <div class="flex flex-row items-center border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <div class="size-10 flex items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
          <div class="i-solar:shield-up-bold text-xl" />
        </div>
        <div class="ml-3 flex flex-col">
          <span class="text-neutral-700 font-semibold dark:text-neutral-300">Restore Settings Only</span>
          <span class="text-xs text-neutral-400 dark:text-neutral-500">Restore configurations and UI settings without touching character assets.</span>
        </div>
        <button
          class="ml-auto rounded-xl bg-amber-600 px-5 py-2.5 text-sm text-white font-semibold transition-colors duration-200 hover:bg-amber-700 focus:outline-none"
          :disabled="isSyncing"
          @click="handleRestoreSettingsOnly"
        >
          Restore Settings...
        </button>
      </div>

      <div class="flex flex-row items-center border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <div class="size-10 flex items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
          <div class="i-solar:shield-warning-bold text-xl" />
        </div>
        <div class="ml-3 flex flex-col">
          <span class="text-neutral-700 font-semibold dark:text-neutral-300">Restore Remote Backup</span>
          <span class="text-xs text-neutral-400 dark:text-neutral-500">Nuke local data and force restore all settings from remote.</span>
        </div>
        <button
          class="ml-auto rounded-xl bg-rose-600 px-5 py-2.5 text-sm text-white font-semibold transition-colors duration-200 hover:bg-rose-700 focus:outline-none"
          :disabled="isSyncing"
          @click="handleRestoreFromBackup"
        >
          Restore Backup...
        </button>
      </div>

      <div v-if="syncError" class="mt-2 flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-600 font-medium dark:text-rose-400">
        <div class="i-solar:danger-bold text-lg" />
        <span>Failed: {{ syncError }}</span>
      </div>
    </div>

    <!-- Sync Conflicts Section -->
    <div v-if="conflicts && conflicts.length > 0" class="flex flex-col gap-4 border border-rose-200 rounded-xl bg-rose-50/50 p-4 dark:border-rose-900/30 dark:bg-rose-950/10">
      <div class="flex items-center gap-2 text-rose-600 dark:text-rose-400">
        <div class="i-solar:danger-bold animate-pulse text-xl" />
        <h3 class="text-lg font-semibold">
          Review Sync Conflicts
        </h3>
        <span class="rounded bg-rose-500 px-1.5 py-0.5 text-xs text-white font-bold">{{ conflicts.length }}</span>
      </div>
      <div class="text-xs text-neutral-500 dark:text-neutral-400">
        The sync engine blocked automatic overwriting for these files because a significant data contraction was detected. Please choose which version to keep, or merge them.
      </div>

      <div class="flex flex-col gap-3">
        <div v-for="conflict in conflicts" :key="conflict.key" class="flex flex-col gap-3 border border-rose-200/50 rounded-lg bg-white p-3 dark:border-rose-900/20 dark:bg-neutral-900">
          <div class="flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800">
            <span class="flex flex-wrap items-center gap-2 break-all pr-2 text-xs text-neutral-800 font-semibold dark:text-neutral-200">
              <span v-if="getConflictCharacterName(conflict)" class="shrink-0 rounded bg-primary-500/10 px-2 py-0.5 text-xs text-primary-600 font-bold dark:bg-primary-500/20 dark:text-primary-400">
                {{ getConflictCharacterName(conflict) }}
              </span>
              <span>{{ cleanKeyLabel(conflict.key) }}</span>
            </span>
            <span class="shrink-0 text-[10px] text-neutral-400 dark:text-neutral-500">
              {{ new Date(conflict.conflictTime).toLocaleTimeString() }}
            </span>
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <!-- Local Version info -->
            <div class="flex flex-col gap-1 rounded bg-neutral-50 p-2 dark:bg-neutral-800/50">
              <div class="text-[10px] text-neutral-400 font-medium uppercase dark:text-neutral-500">
                Local (This Device)
              </div>
              <div class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
                {{ formatSize(conflict.localSize) }}
              </div>
              <div class="text-[10px] text-neutral-500 dark:text-neutral-400">
                {{ new Date(conflict.localTimestamp).toLocaleString() }}
              </div>
              <div v-if="conflict.sessionDetails?.local" class="mt-1 flex flex-col gap-0.5 border-t border-neutral-200/50 pt-1 text-[10px] text-neutral-500 dark:border-neutral-700/50 dark:text-neutral-400">
                <div>Messages: <span class="font-semibold">{{ conflict.sessionDetails.local.messageCount }}</span></div>
                <div v-if="conflict.sessionDetails.local.lastMessage" class="max-w-[280px] truncate italic">
                  Last: "{{ conflict.sessionDetails.local.lastMessage }}"
                </div>
              </div>
            </div>

            <!-- Remote Version info -->
            <div class="flex flex-col gap-1 rounded bg-neutral-50 p-2 dark:bg-neutral-800/50">
              <div class="text-[10px] text-neutral-400 font-medium uppercase dark:text-neutral-500">
                Remote (Cloud/Backup)
              </div>
              <div class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
                {{ formatSize(conflict.remoteSize) }}
              </div>
              <div class="text-[10px] text-neutral-500 dark:text-neutral-400">
                {{ new Date(conflict.remoteTimestamp).toLocaleString() }}
              </div>
              <div v-if="conflict.sessionDetails?.remote" class="mt-1 flex flex-col gap-0.5 border-t border-neutral-200/50 pt-1 text-[10px] text-neutral-500 dark:border-neutral-700/50 dark:text-neutral-400">
                <div>Messages: <span class="font-semibold">{{ conflict.sessionDetails.remote.messageCount }}</span></div>
                <div v-if="conflict.sessionDetails.remote.lastMessage" class="max-w-[280px] truncate italic">
                  Last: "{{ conflict.sessionDetails.remote.lastMessage }}"
                </div>
              </div>
            </div>
          </div>

          <div class="mt-1 flex flex-wrap gap-2">
            <button
              class="border border-neutral-200 rounded-xl px-3 py-1.5 text-xs text-neutral-700 font-semibold transition dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              @click="syncStore.resolveConflict(conflict.key, 'local')"
            >
              Keep Local
            </button>
            <button
              class="border border-neutral-200 rounded-xl px-3 py-1.5 text-xs text-neutral-700 font-semibold transition dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              @click="syncStore.resolveConflict(conflict.key, 'remote')"
            >
              Keep Remote
            </button>
            <button
              v-if="isMergeable(conflict.key)"
              class="rounded-xl bg-primary-500 px-3 py-1.5 text-xs text-white font-semibold transition hover:bg-primary-600"
              @click="syncStore.resolveConflict(conflict.key, 'merge')"
            >
              {{
                conflict.key.startsWith('local:chat/sessions/')
                  ? 'Merge Message History'
                  : conflict.key === 'local:localstorage/settings/live2d/available-motions'
                    ? 'Merge Motion Lists'
                    : conflict.key === 'local:localstorage/settings/speech/voice-profiles'
                      ? 'Merge Voice Profiles'
                      : 'Merge Data'
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Selective Sync Modal Dialog -->
  <DialogRoot :open="isSelectiveSyncOpen" @update:open="isSelectiveSyncOpen = $event">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-100 bg-black/60 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-100 max-h-[85vh] max-w-2xl w-[90vw] flex flex-col overflow-y-auto border border-white/10 rounded-2xl bg-neutral-900/95 p-6 text-white shadow-2xl backdrop-blur-xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow focus:outline-none"
      >
        <DialogTitle class="mb-1 w-full flex items-center gap-2 text-xl font-bold">
          <div class="i-solar:shield-keyhole-bold-duotone text-2xl text-primary-400" />
          <span>Selective Sync Scope</span>
        </DialogTitle>
        <DialogDescription class="mb-4 text-xs text-neutral-400">
          Choose which databases and heavy media assets you want to synchronize with your storage backend. Required core metadata is always synced.
        </DialogDescription>

        <SelectiveSyncPanel
          @cancel="isSelectiveSyncOpen = false"
          @sync="onSelectiveSync"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <div
    v-motion
    class="pointer-events-none fixed bottom-0 right-[-1.25rem] top-[calc(100dvh-15rem)] z-[-1] size-60 flex items-center justify-center text-neutral-200/50 dark:text-neutral-600/20"
    :initial="{ scale: 0.9, opacity: 0, x: 20 }"
    :enter="{ scale: 1, opacity: 1, x: 0 }"
    :duration="500"
  >
    <div class="i-solar:cloud-bold-duotone text-[60px]" />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.cloud-sync.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
