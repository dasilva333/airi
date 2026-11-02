<script setup lang="ts">
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useDataMaintenance } from '@proj-airi/stage-ui/composables/use-data-maintenance'
import { useBackupStore } from '@proj-airi/stage-ui/stores/backup'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useCloudflareStore } from '@proj-airi/stage-ui/stores/modules/cloudflare'
import { useSyncEngineStore } from '@proj-airi/stage-ui/stores/sync-engine'
import { Button, DoubleCheckButton } from '@proj-airi/ui'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import ExportVaultModal from './components/ExportVaultModal.vue'
import ImportVaultModal from './components/ImportVaultModal.vue'
import ScrubHistoryModal from './components/ScrubHistoryModal.vue'

const { t } = useI18n()
const router = useRouter()

const {
  deleteAllModels,
  resetProvidersSettings,
  resetModulesSettings,
  deleteAllChatSessions,
  exportChatSessions,
  importChatSessions,
  exportAllCharacters,
  importAllCharacters,
  exportMemory,
  importMemory,
  exportBackgrounds,
  importBackgrounds,
  deleteAllData,
  resetDesktopApplicationState,
  getOrphanedGroups,
  nukeOrphanedGroups,
  restoreOrphanedGroups,
} = useDataMaintenance()

const syncEngineStore = useSyncEngineStore()
const cloudflareStore = useCloudflareStore()
const airiCardStore = useAiriCardStore()
const backupStore = useBackupStore()

const isCreatingSnapshot = ref(false)
const formattedLastSnapshotTime = computed(() => {
  if (!backupStore.lastBackupTime)
    return 'Never'
  return new Date(backupStore.lastBackupTime).toLocaleString()
})

async function handleTriggerSnapshot() {
  isCreatingSnapshot.value = true
  try {
    const res = await backupStore.triggerBackup()
    if (res) {
      setStatus(`Snapshot created successfully at ${res}!`, 'success')
    }
    else {
      setStatus('Failed to create snapshot.', 'error')
    }
  }
  catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  }
  finally {
    isCreatingSnapshot.value = false
  }
}

const statusMessage = ref('')
const statusTone = ref<'neutral' | 'success' | 'error'>('neutral')
const importError = ref('')
const importFileInput = ref<HTMLInputElement>()
const importType = ref<'chats' | 'characters' | 'memory' | 'backgrounds'>('chats')
const isDesktop = computed(() => isStageTamagotchi())

const isExportVaultOpen = ref(false)
const isImportVaultOpen = ref(false)
const isScrubModalOpen = ref(false)
const showLegacyTools = ref(false)

function onScrubComplete(report: any) {
  setStatus(`Successfully scrubbed ${report.sessionsScanned} session(s) and saved ${(report.bytesSaved / 1024).toFixed(1)} KB!`, 'success')
}

async function onVaultImported() {
  setStatus(t('settings.pages.data.status.imported'))
  orphanedGroups.value = await getOrphanedGroups()
}

function setStatus(message: string, tone: 'neutral' | 'success' | 'error' = 'success') {
  statusMessage.value = message
  statusTone.value = tone
}

async function runAction(action: () => Promise<void> | void, successKey: string) {
  try {
    await action()
    setStatus(t(successKey), 'success')
  }
  catch (error) {
    console.error(error)
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  }
}

async function triggerExport(type: 'chats' | 'characters' | 'memory' | 'backgrounds') {
  try {
    let blob: Blob
    let filename: string

    switch (type) {
      case 'characters':
        blob = await exportAllCharacters()
        filename = `airi-characters-${new Date().toISOString()}.json`
        break
      case 'memory':
        blob = await exportMemory()
        filename = `airi-memory-${new Date().toISOString()}.json`
        break
      case 'backgrounds':
        blob = await exportBackgrounds()
        filename = `airi-backgrounds-${new Date().toISOString()}.json`
        break
      default:
        blob = await exportChatSessions()
        filename = `airi-chat-sessions-${new Date().toISOString()}.json`
    }

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
    setStatus(t('settings.pages.data.status.exported'))
  }
  catch (error) {
    console.error(error)
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  }
}

function triggerImportPicker(type: 'chats' | 'characters' | 'memory' | 'backgrounds') {
  importError.value = ''
  importType.value = type
  importFileInput.value?.click()
}

async function handleImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  try {
    const raw = await file.text()
    const parsed = JSON.parse(raw) as Record<string, unknown>

    switch (importType.value) {
      case 'characters':
        await importAllCharacters(parsed)
        break
      case 'memory':
        await importMemory(parsed)
        break
      case 'backgrounds':
        await importBackgrounds(parsed)
        break
      default:
        await importChatSessions(parsed)
    }

    setStatus(t('settings.pages.data.status.imported'))
    importError.value = ''
  }
  catch (error) {
    console.error(error)
    importError.value = t('settings.pages.data.status.import_error')
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  }
  finally {
    target.value = ''
  }
}

// --- Cloud Sync Bridge State ---
const isCloudSyncConfigured = computed(() => {
  if (syncEngineStore.activeProvider === 's3') {
    return Boolean(syncEngineStore.s3Bucket)
  }
  if (syncEngineStore.activeProvider === 'local-fs') {
    return Boolean(syncEngineStore.fsBackupPath)
  }
  return false
})

const cloudSyncStatus = computed(() => {
  if (syncEngineStore.syncEnabled) {
    return {
      label: `Active • Auto-Syncing (${syncEngineStore.syncInterval}m)`,
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-500 animate-pulse',
    }
  }
  if (isCloudSyncConfigured.value) {
    return {
      label: 'Configured • Auto-Sync Paused',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400 border-amber-500/30',
      dotClass: 'bg-amber-500',
    }
  }
  return {
    label: 'Not Configured',
    badgeClass: 'bg-neutral-500/15 text-neutral-600 dark:bg-neutral-500/25 dark:text-neutral-400 border-neutral-500/30',
    dotClass: 'bg-neutral-400',
  }
})

const formattedBackupLocation = computed(() => {
  if (syncEngineStore.activeProvider === 'local-fs') {
    return syncEngineStore.fsBackupPath || 'Default OS Share'
  }
  if (syncEngineStore.activeProvider === 's3') {
    return syncEngineStore.s3Bucket ? `${syncEngineStore.s3Bucket} (${syncEngineStore.s3Endpoint || 'S3/R2'})` : 'No bucket specified'
  }
  return syncEngineStore.activeProvider
})

const formattedLastSyncTime = computed(() => {
  if (!syncEngineStore.lastSyncTime)
    return 'Never'
  return new Date(syncEngineStore.lastSyncTime).toLocaleString()
})

async function handleTriggerBackup() {
  await syncEngineStore.triggerSync()
  if (!syncEngineStore.syncError) {
    setStatus('Cloud backup completed successfully!', 'success')
  }
  else {
    setStatus(`Backup failed: ${syncEngineStore.syncError}`, 'error')
  }
}

// --- Unlinked Data (Orphaned Sessions & Memories) State ---
const orphanedGroups = ref<{ characterId: string, messageCount: number, lastActive: number, preview: string }[]>([])
const isUnlinkedExpanded = ref(false)
const selectedOrphans = ref<string[]>([])
const quickMergeTargets = ref<Record<string, string>>({})
const isRestoreMappingOpen = ref(false)
const restoreMappings = ref<Record<string, string>>({})

const existingCharacters = computed(() => {
  return Array.from(airiCardStore.cards.entries()).map(([id, card]) => ({
    id,
    name: card.nickname || card.name || id,
  }))
})

async function loadOrphans() {
  orphanedGroups.value = await getOrphanedGroups()
}

onMounted(() => {
  loadOrphans()
})

function selectAll() {
  selectedOrphans.value = orphanedGroups.value.map(g => g.characterId)
}

function deselectAll() {
  selectedOrphans.value = []
}

function toggleSelect(id: string) {
  if (selectedOrphans.value.includes(id)) {
    selectedOrphans.value = selectedOrphans.value.filter(item => item !== id)
  }
  else {
    selectedOrphans.value.push(id)
  }
}

async function restoreSingle(orphanId: string, targetId: string) {
  try {
    await restoreOrphanedGroups({ [orphanId]: targetId })
    setStatus(targetId === 'new' ? `Recreated companion for ${orphanId}!` : `Merged ${orphanId} into companion!`, 'success')
    await loadOrphans()
  }
  catch (e) {
    console.error(e)
    setStatus(e instanceof Error ? e.message : String(e), 'error')
  }
}

async function nukeSingle(orphanId: string) {
  try {
    await nukeOrphanedGroups([orphanId])
    selectedOrphans.value = selectedOrphans.value.filter(id => id !== orphanId)
    setStatus(`Purged unlinked data for ${orphanId}!`, 'success')
    await loadOrphans()
  }
  catch (e) {
    console.error(e)
    setStatus(e instanceof Error ? e.message : String(e), 'error')
  }
}

async function restoreBulkSelected() {
  if (selectedOrphans.value.length === 0)
    return
  const mappings: Record<string, string> = {}
  for (const id of selectedOrphans.value) {
    mappings[id] = 'new'
  }
  try {
    await restoreOrphanedGroups(mappings)
    const count = selectedOrphans.value.length
    selectedOrphans.value = []
    setStatus(`Successfully recreated ${count} companion(s)!`, 'success')
    await loadOrphans()
  }
  catch (e) {
    console.error(e)
    setStatus(e instanceof Error ? e.message : String(e), 'error')
  }
}

async function nukeBulkSelected() {
  if (selectedOrphans.value.length === 0)
    return
  try {
    await nukeOrphanedGroups(selectedOrphans.value)
    const count = selectedOrphans.value.length
    selectedOrphans.value = []
    setStatus(`Successfully purged ${count} unlinked group(s)!`, 'success')
    await loadOrphans()
  }
  catch (e) {
    console.error(e)
    setStatus(e instanceof Error ? e.message : String(e), 'error')
  }
}

function openAdvancedMapping() {
  restoreMappings.value = {}
  selectedOrphans.value.forEach((id) => {
    restoreMappings.value[id] = 'new'
  })
  isRestoreMappingOpen.value = true
}

async function executeAdvancedRestore() {
  try {
    await restoreOrphanedGroups(restoreMappings.value)
    const count = Object.keys(restoreMappings.value).length
    isRestoreMappingOpen.value = false
    selectedOrphans.value = []
    setStatus(`Successfully restored/merged ${count} companion(s)!`, 'success')
    await loadOrphans()
  }
  catch (e) {
    console.error(e)
    setStatus(e instanceof Error ? e.message : String(e), 'error')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 pb-4">
    <!-- Live Status Banner -->
    <div
      v-if="statusMessage"
      :class="[
        'flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-all border',
        statusTone === 'error'
          ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30'
          : statusTone === 'success'
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
            : 'bg-neutral-500/10 text-neutral-700 dark:text-neutral-300 border-neutral-500/30',
      ]"
    >
      <div class="flex items-center gap-2">
        <div
          :class="[
            'size-4',
            statusTone === 'error'
              ? 'i-solar:danger-triangle-bold text-red-500'
              : 'i-solar:check-circle-bold text-emerald-500',
          ]"
        />
        <span>{{ statusMessage }}</span>
      </div>
      <button
        type="button"
        class="text-xs opacity-60 hover:opacity-100"
        @click="statusMessage = ''"
      >
        ✕
      </button>
    </div>

    <!-- Unified Data Vault Card -->
    <div class="border-2 border-primary/20 rounded-2xl bg-primary/5 p-6 shadow-sm dark:border-primary/30 dark:bg-primary/10">
      <div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div class="text-xl text-neutral-900 font-bold dark:text-white">
            Data Vault: Archive & Universal Import
          </div>
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Create selective, human-readable ZIP archives across all memory pillars or restore data with automatic companion linking.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <Button variant="secondary" class="flex items-center gap-2" @click="isImportVaultOpen = true">
            <span>📥</span>
            <span>Universal Import</span>
          </Button>
          <Button variant="primary" class="flex items-center gap-2" @click="isExportVaultOpen = true">
            <span>📦</span>
            <span>Export Archive</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- Cloud Sync Bridge & Status Card (Phase 4) -->
    <div class="border-2 border-sky-500/25 rounded-2xl bg-sky-500/5 p-6 shadow-sm dark:border-sky-500/35 dark:bg-sky-500/10">
      <div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 flex items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
            <div class="i-solar:cloud-upload-bold-duotone size-6" />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xl text-neutral-900 font-bold dark:text-white">
                Cloud Sync: Zero-Custody Continuous Backup
              </span>
              <span
                :class="[
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                  cloudSyncStatus.badgeClass,
                ]"
              >
                <span :class="['h-1.5 w-1.5 rounded-full', cloudSyncStatus.dotClass]" />
                {{ cloudSyncStatus.label }}
              </span>
            </div>
            <p class="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
              Modern continuous replication to your personal Cloudflare R2, S3 bucket, or local network share.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <Button
            :variant="syncEngineStore.syncEnabled ? 'primary' : 'secondary'"
            size="sm"
            @click="syncEngineStore.syncEnabled = !syncEngineStore.syncEnabled"
          >
            {{ syncEngineStore.syncEnabled ? 'Auto-Sync Active' : 'Enable Auto-Sync' }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :disabled="syncEngineStore.isSyncing"
            class="flex items-center gap-1.5"
            @click="handleTriggerBackup"
          >
            <div :class="['i-solar:refresh-circle-bold size-4', syncEngineStore.isSyncing ? 'animate-spin' : '']" />
            <span>{{ syncEngineStore.isSyncing ? 'Syncing...' : 'Sync Now' }}</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            class="flex items-center gap-1.5"
            @click="router.push('/settings/modules/cloud-sync')"
          >
            <span>Open Cloud Sync Settings</span>
            <div class="i-solar:arrow-right-bold size-3.5" />
          </Button>
        </div>
      </div>

      <!-- Zero-Custody Reassurance Tip & Model Notice -->
      <div class="mt-4 flex flex-col gap-2.5 border border-sky-500/20 rounded-xl bg-white/70 p-3.5 text-xs text-neutral-700 dark:border-sky-500/30 dark:bg-neutral-900/60 dark:text-neutral-300">
        <div class="flex items-start gap-2">
          <div class="i-solar:shield-check-bold mt-0.5 shrink-0 text-base text-sky-500" />
          <div>
            <span class="text-sky-700 font-semibold dark:text-sky-300">Zero-Custody Automatic Replication:</span>
            Cloud Sync continuously mirrors your conversations, companions, daily memory summaries, and settings to storage you control (Cloudflare R2, AWS S3, or Local Share). We never see or hold custody of your data — client-side encrypted and 100% user-owned.
          </div>
        </div>
        <div class="flex items-start gap-2 border-t border-sky-500/15 pt-2 dark:border-sky-500/25">
          <div class="i-solar:box-minimalistic-bold-duotone mt-0.5 shrink-0 text-base text-indigo-500" />
          <div>
            <span class="text-indigo-700 font-semibold dark:text-indigo-300">Live2D, VRM, Spine & MMD Avatars:</span>
            Because character models are large binary assets (textures, meshes, physics, and motion clips), there is no manual single-file JSON export. <strong>Cloud Sync is the only automated mechanism that backs up, preserves, and synchronizes your imported avatar models across devices.</strong>
          </div>
        </div>
      </div>

      <!-- Status Metadata Strip -->
      <div class="grid grid-cols-1 mt-4 gap-3 sm:grid-cols-3">
        <div class="rounded-lg bg-neutral-100/70 p-2.5 dark:bg-neutral-800/50">
          <div class="text-[11px] text-neutral-500 font-medium tracking-wider uppercase dark:text-neutral-400">
            Active Target
          </div>
          <div class="mt-0.5 truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200">
            {{ formattedBackupLocation }}
          </div>
        </div>
        <div class="rounded-lg bg-neutral-100/70 p-2.5 dark:bg-neutral-800/50">
          <div class="text-[11px] text-neutral-500 font-medium tracking-wider uppercase dark:text-neutral-400">
            Cloudflare Edge Hub
          </div>
          <div class="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-800 font-semibold dark:text-neutral-200">
            <span :class="['h-2 w-2 rounded-full', cloudflareStore.isAuthenticated ? 'bg-emerald-500' : 'bg-neutral-400']" />
            <span class="truncate">{{ cloudflareStore.isAuthenticated ? (cloudflareStore.cfAccountId ? `${cloudflareStore.cfAccountId.slice(0, 12)}...` : 'Authenticated') : 'Not Linked' }}</span>
          </div>
        </div>
        <div class="rounded-lg bg-neutral-100/70 p-2.5 dark:bg-neutral-800/50">
          <div class="text-[11px] text-neutral-500 font-medium tracking-wider uppercase dark:text-neutral-400">
            Last Synchronized
          </div>
          <div class="mt-0.5 truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200">
            {{ formattedLastSyncTime }}
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop Snapshot Auto-Backup Card -->
    <div
      v-if="isDesktop"
      :class="[
        'border-2 border-neutral-200/60 rounded-2xl bg-white/70 p-6 shadow-sm',
        'dark:border-neutral-800/60 dark:bg-neutral-900/60',
      ]"
    >
      <div :class="['flex flex-col items-start justify-between gap-4 md:flex-row md:items-center']">
        <div :class="['flex items-center gap-3']">
          <div :class="['h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400']">
            <div :class="['i-solar:disk-bold-duotone size-6']" />
          </div>
          <div>
            <div :class="['flex flex-wrap items-center gap-2']">
              <span :class="['text-xl text-neutral-900 font-bold dark:text-white']">
                Desktop Snapshot Auto-Backup
              </span>
              <span
                :class="[
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                  backupStore.isBackupEnabled
                    ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-neutral-500/15 text-neutral-600 dark:bg-neutral-500/25 dark:text-neutral-400 border-neutral-500/30',
                ]"
              >
                <span :class="['h-1.5 w-1.5 rounded-full', backupStore.isBackupEnabled ? 'bg-emerald-500' : 'bg-neutral-400']" />
                {{ backupStore.isBackupEnabled ? 'Active (Every 24h)' : 'Disabled' }}
              </span>
            </div>
            <p :class="['mt-0.5 text-sm text-neutral-600 dark:text-neutral-400']">
              Periodic full JSON snapshot archive of chats, character cards, memories, and app state saved directly to local or network storage.
            </p>
          </div>
        </div>

        <div :class="['flex flex-wrap items-center gap-2.5']">
          <Button
            :variant="backupStore.isBackupEnabled ? 'primary' : 'secondary'"
            size="sm"
            @click="backupStore.isBackupEnabled = !backupStore.isBackupEnabled"
          >
            {{ backupStore.isBackupEnabled ? 'Auto-Backup Enabled' : 'Enable Auto-Backup' }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :disabled="isCreatingSnapshot"
            :class="['flex items-center gap-1.5']"
            @click="handleTriggerSnapshot"
          >
            <div :class="['i-solar:folder-with-files-bold size-4', isCreatingSnapshot ? 'animate-spin' : '']" />
            <span>{{ isCreatingSnapshot ? 'Saving...' : 'Snapshot Now' }}</span>
          </Button>
        </div>
      </div>

      <!-- Backup Destination Path Input -->
      <div :class="['mt-4 border-t border-neutral-200/60 pt-4 dark:border-neutral-800/60']">
        <label :class="['block text-xs text-neutral-500 font-medium dark:text-neutral-400 mb-1.5']">
          Backup Destination Directory
        </label>
        <div :class="['flex items-center gap-2']">
          <input
            v-model="backupStore.backupPath"
            type="text"
            placeholder="~/Documents/AIRI-Backups (Default)"
            :class="[
              'w-full border border-neutral-300 rounded-lg bg-white px-3 py-1.5 text-sm text-neutral-800 outline-none',
              'focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
            ]"
          >
          <Button
            v-if="backupStore.backupPath"
            variant="ghost"
            size="sm"
            @click="backupStore.backupPath = ''"
          >
            Reset
          </Button>
        </div>
        <p :class="['mt-1 text-xs text-neutral-400 dark:text-neutral-500']">
          Leave blank to use the default OS documents path (<code>~/Documents/AIRI-Backups</code>), or enter an absolute path to a local folder or mounted share (e.g. <code>/Volumes/AIRI-Backup-Share/airi-backups</code>).
        </p>
      </div>

      <!-- Status Metadata Strip -->
      <div :class="['grid grid-cols-1 mt-4 gap-3 sm:grid-cols-2']">
        <div :class="['rounded-lg bg-neutral-100/70 p-2.5 dark:bg-neutral-800/50']">
          <div :class="['text-[11px] text-neutral-500 font-medium tracking-wider uppercase dark:text-neutral-400']">
            Current Save Destination
          </div>
          <div :class="['mt-0.5 truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200']">
            {{ backupStore.backupPath || '~/Documents/AIRI-Backups (Default)' }}
          </div>
        </div>
        <div :class="['rounded-lg bg-neutral-100/70 p-2.5 dark:bg-neutral-800/50']">
          <div :class="['text-[11px] text-neutral-500 font-medium tracking-wider uppercase dark:text-neutral-400']">
            Last Local Snapshot
          </div>
          <div :class="['mt-0.5 truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200']">
            {{ formattedLastSnapshotTime }}
          </div>
        </div>
      </div>
    </div>

    <!-- Session Media Optimization & Scrub Card -->
    <div class="border-2 border-emerald-500/20 rounded-2xl bg-emerald-500/5 p-6 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
            <div class="i-solar:magic-stick-3-bold-duotone size-6" />
          </div>
          <div>
            <div class="text-xl text-neutral-900 font-bold dark:text-white">
              Session Media Optimization & Scrub
            </div>
            <p class="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
              Extract inline base64 image strings and leaked tool payloads from your chat history into persistent local storage, preventing LLM token blowup and keeping sessions lightweight.
            </p>
          </div>
        </div>
        <div class="flex shrink-0">
          <Button
            variant="secondary"
            class="flex items-center gap-2 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
            @click="isScrubModalOpen = true"
          >
            <div class="i-solar:magic-stick-3-bold size-4 text-emerald-500" />
            <span>Clean & Resolve History</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- Unlinked Conversations & Memories Section (Phase 3) -->
    <div class="border-2 border-neutral-200/60 rounded-2xl bg-white/70 p-6 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
      <div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 flex items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-300">
            <div class="i-solar:ghost-bold-duotone size-6" />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xl text-neutral-900 font-bold dark:text-white">
                Unlinked Conversations & Memories
              </span>
              <span
                :class="[
                  'px-2 py-0.5 rounded-full text-xs font-semibold border',
                  orphanedGroups.length > 0
                    ? 'bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400 border-emerald-500/30',
                ]"
              >
                {{ orphanedGroups.length === 0 ? 'All Linked' : `${orphanedGroups.length} Unlinked Group(s)` }}
              </span>
            </div>
            <p class="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
              Recover chat histories and memories left behind by deleted or renamed companions, or merge them into an active companion.
            </p>
          </div>
        </div>

        <div v-if="orphanedGroups.length > 0" class="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            class="flex items-center gap-1.5"
            @click="isUnlinkedExpanded = !isUnlinkedExpanded"
          >
            <div :class="['size-3.5 transition-transform duration-200', isUnlinkedExpanded ? 'i-solar:alt-arrow-up-bold' : 'i-solar:alt-arrow-down-bold']" />
            <span>{{ isUnlinkedExpanded ? 'Collapse List' : `Review & Manage (${orphanedGroups.length})` }}</span>
          </Button>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="orphanedGroups.length === 0"
        class="mt-6 flex flex-col items-center justify-center border border-neutral-300/80 rounded-xl border-dashed bg-neutral-50/50 py-10 dark:border-neutral-700/80 dark:bg-neutral-800/30"
      >
        <div class="i-solar:shield-check-bold-duotone size-12 text-emerald-500/80" />
        <div class="mt-3 text-sm text-neutral-800 font-semibold dark:text-neutral-200">
          All Conversations & Memories Linked
        </div>
        <p class="mt-1 max-w-md text-center text-xs text-neutral-500 dark:text-neutral-400">
          All chat sessions, daily summaries, text journal entries, and lifetime memories are tied to active companions. No orphaned data detected.
        </p>
      </div>

      <!-- Expandable Orphan Content (when orphans exist) -->
      <div
        v-else-if="isUnlinkedExpanded"
        class="mt-5 border-t border-neutral-200/60 pt-4 dark:border-neutral-800/60"
      >
        <!-- Bulk Management Toolbar -->
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              @click="selectedOrphans.length === orphanedGroups.length ? deselectAll() : selectAll()"
            >
              {{ selectedOrphans.length === orphanedGroups.length ? 'Deselect All' : 'Select All' }}
            </Button>
            <Button
              variant="primary"
              size="sm"
              :disabled="selectedOrphans.length === 0"
              @click="restoreBulkSelected"
            >
              ✨ Recreate Selected ({{ selectedOrphans.length }})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              :disabled="selectedOrphans.length === 0"
              @click="openAdvancedMapping"
            >
              🤝 Merge Selected...
            </Button>
          </div>
          <div>
            <DoubleCheckButton
              variant="danger"
              size="sm"
              :disabled="selectedOrphans.length === 0"
              @confirm="nukeBulkSelected"
            >
              🗑️ Purge Selected
              <template #confirm>
                Confirm Purge ({{ selectedOrphans.length }})
              </template>
              <template #cancel>
                Cancel
              </template>
            </DoubleCheckButton>
          </div>
        </div>

        <!-- Bounded Scrollable Orphan Cards List -->
        <div :class="['flex flex-col gap-3', orphanedGroups.length > 2 ? 'max-h-[560px] overflow-y-auto pr-1.5' : '']">
          <div
            v-for="group in orphanedGroups"
            :key="group.characterId"
            :class="[
              'border-2 rounded-xl p-4 transition-all',
              selectedOrphans.includes(group.characterId)
                ? 'border-primary/50 bg-primary/5 dark:bg-primary/10'
                : 'border-neutral-200/70 bg-neutral-50/50 dark:border-neutral-800/70 dark:bg-neutral-900/50',
            ]"
          >
            <div class="flex flex-col gap-3">
              <!-- Header Row -->
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    :checked="selectedOrphans.includes(group.characterId)"
                    class="h-4 w-4 cursor-pointer accent-primary-500"
                    @change="toggleSelect(group.characterId)"
                  >
                  <span class="rounded-md bg-neutral-200/70 px-2 py-0.5 text-xs text-neutral-800 font-semibold font-mono dark:bg-neutral-800 dark:text-neutral-200">
                    {{ group.characterId }}
                  </span>
                  <span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary font-semibold">
                    {{ group.messageCount }} messages
                  </span>
                </div>
                <div class="text-xs text-neutral-500 dark:text-neutral-400">
                  Last active: <span class="text-neutral-700 font-medium dark:text-neutral-300">{{ group.lastActive ? new Date(group.lastActive).toLocaleString() : 'Unknown' }}</span>
                </div>
              </div>

              <!-- Dialogue Snippet Preview -->
              <div
                v-if="group.preview"
                class="border-l-3 border-primary/60 rounded-r-lg bg-white/80 p-3 text-xs text-neutral-700 italic dark:bg-neutral-800/70 dark:text-neutral-300"
              >
                <span class="mr-1 text-[11px] text-neutral-400 font-semibold uppercase not-italic">Recent Dialogue:</span>
                “{{ group.preview }}”
              </div>
              <div
                v-else
                class="rounded-lg bg-white/50 p-2.5 text-xs text-neutral-400 italic dark:bg-neutral-800/40"
              >
                No message text preview recorded
              </div>

              <!-- Inline 1-Click Actions -->
              <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div class="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    class="flex items-center gap-1.5"
                    @click="restoreSingle(group.characterId, 'new')"
                  >
                    <span>✨</span>
                    <span>Recreate Companion</span>
                  </Button>

                  <div class="flex items-center gap-1.5">
                    <select
                      v-model="quickMergeTargets[group.characterId]"
                      class="h-8 border border-neutral-300 rounded-lg bg-white px-2.5 py-1 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">
                        Merge into existing...
                      </option>
                      <option
                        v-for="char in existingCharacters"
                        :key="char.id"
                        :value="char.id"
                      >
                        🤝 {{ char.name }} ({{ char.id }})
                      </option>
                    </select>
                    <Button
                      variant="secondary"
                      size="sm"
                      :disabled="!quickMergeTargets[group.characterId]"
                      @click="restoreSingle(group.characterId, quickMergeTargets[group.characterId])"
                    >
                      Merge
                    </Button>
                  </div>
                </div>

                <div>
                  <DoubleCheckButton
                    variant="danger"
                    size="sm"
                    @confirm="nukeSingle(group.characterId)"
                  >
                    🗑️ Purge
                    <template #confirm>
                      Confirm Purge
                    </template>
                    <template #cancel>
                      Cancel
                    </template>
                  </DoubleCheckButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Collapsible Legacy Single-File Domain Tools -->
    <div class="border border-neutral-200/60 rounded-xl bg-white/40 p-4 dark:border-neutral-800/60 dark:bg-neutral-900/40">
      <button
        type="button"
        class="w-full flex items-center justify-between text-left text-sm text-neutral-700 font-semibold dark:text-neutral-300"
        @click="showLegacyTools = !showLegacyTools"
      >
        <span>Individual Domain Tools (Legacy Single-File JSON)</span>
        <span class="text-xs text-neutral-400">{{ showLegacyTools ? '▲ Hide' : '▼ Show' }}</span>
      </button>

      <div v-if="showLegacyTools" class="mt-4 flex flex-col gap-4">
        <!-- Chats -->
        <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
          <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div class="flex flex-col gap-1 md:max-w-[560px]">
              <div class="text-lg font-medium">
                {{ t('settings.pages.data.sections.chats.title') }}
              </div>
              <p class="text-sm text-neutral-600 dark:text-neutral-400">
                {{ t('settings.pages.data.sections.chats.description') }}
              </p>
            </div>
            <div class="flex flex-col items-start gap-2 sm:items-end">
              <div class="flex flex-wrap gap-2">
                <Button variant="secondary" @click="triggerExport('chats')">
                  {{ t('settings.pages.data.sections.chats.export') }}
                </Button>
                <Button variant="primary" @click="triggerImportPicker('chats')">
                  {{ t('settings.pages.data.sections.chats.import') }}
                </Button>
              </div>
              <DoubleCheckButton
                variant="danger"
                @confirm="runAction(deleteAllChatSessions, 'settings.pages.data.status.chats_deleted')"
              >
                {{ t('settings.pages.data.sections.chats.delete') }}
                <template #confirm>
                  {{ t('settings.pages.data.confirmations.yes') }}
                </template>
                <template #cancel>
                  {{ t('settings.pages.card.cancel') }}
                </template>
              </DoubleCheckButton>
            </div>
          </div>
          <input ref="importFileInput" type="file" accept="application/json" class="hidden" @change="handleImport">
          <p v-if="importError" class="text-sm text-red-500">
            {{ importError }}
          </p>
        </div>

        <!-- Characters -->
        <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
          <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div class="flex flex-col gap-1 md:max-w-[560px]">
              <div class="text-lg font-medium">
                {{ t('settings.pages.data.sections.characters.title') }}
              </div>
              <p class="text-sm text-neutral-600 dark:text-neutral-400">
                {{ t('settings.pages.data.sections.characters.description') }}
              </p>
            </div>
            <div class="flex flex-col items-start gap-2 sm:items-end">
              <div class="flex flex-wrap gap-2">
                <Button variant="secondary" @click="triggerExport('characters')">
                  {{ t('settings.pages.data.sections.characters.export') }}
                </Button>
                <Button variant="primary" @click="triggerImportPicker('characters')">
                  {{ t('settings.pages.data.sections.characters.import') }}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Memory -->
        <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
          <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div class="flex flex-col gap-1 md:max-w-[560px]">
              <div class="text-lg font-medium">
                {{ t('settings.pages.data.sections.memory.title') }}
              </div>
              <p class="text-sm text-neutral-600 dark:text-neutral-400">
                {{ t('settings.pages.data.sections.memory.description') }}
              </p>
            </div>
            <div class="flex flex-col items-start gap-2 sm:items-end">
              <div class="flex flex-wrap gap-2">
                <Button variant="secondary" @click="triggerExport('memory')">
                  {{ t('settings.pages.data.sections.memory.export') }}
                </Button>
                <Button variant="primary" @click="triggerImportPicker('memory')">
                  {{ t('settings.pages.data.sections.memory.import') }}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Backgrounds -->
        <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
          <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div class="flex flex-col gap-1 md:max-w-[560px]">
              <div class="text-lg font-medium">
                {{ t('settings.pages.data.sections.backgrounds.title') }}
              </div>
              <p class="text-sm text-neutral-600 dark:text-neutral-400">
                {{ t('settings.pages.data.sections.backgrounds.description') }}
              </p>
            </div>
            <div class="flex flex-col items-start gap-2 sm:items-end">
              <div class="flex flex-wrap gap-2">
                <Button variant="secondary" @click="triggerExport('backgrounds')">
                  {{ t('settings.pages.data.sections.backgrounds.export') }}
                </Button>
                <Button variant="primary" @click="triggerImportPicker('backgrounds')">
                  {{ t('settings.pages.data.sections.backgrounds.import') }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div class="flex flex-col gap-1 md:max-w-[560px]">
            <div class="text-lg font-medium">
              {{ t('settings.pages.data.sections.models.title') }}
            </div>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              {{ t('settings.pages.data.sections.models.description') }}
            </p>
          </div>
          <div class="flex flex-col items-start gap-2">
            <DoubleCheckButton
              variant="danger"
              @confirm="runAction(deleteAllModels, 'settings.pages.data.status.models_deleted')"
            >
              {{ t('settings.pages.data.sections.models.delete') }}
              <template #confirm>
                {{ t('settings.pages.data.confirmations.yes') }}
              </template>
              <template #cancel>
                {{ t('settings.pages.card.cancel') }}
              </template>
            </DoubleCheckButton>
          </div>
        </div>

        <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div class="flex flex-col gap-1 md:max-w-[560px]">
            <div class="text-lg font-medium">
              {{ t('settings.pages.data.sections.modules.title') }}
            </div>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              {{ t('settings.pages.data.sections.modules.description') }}
            </p>
          </div>
          <div class="flex flex-col items-start gap-2">
            <DoubleCheckButton
              variant="caution"
              @confirm="runAction(resetModulesSettings, 'settings.pages.data.status.modules_reset')"
            >
              {{ t('settings.pages.data.sections.modules.reset') }}
              <template #confirm>
                {{ t('settings.pages.data.confirmations.yes') }}
              </template>
              <template #cancel>
                {{ t('settings.pages.card.cancel') }}
              </template>
            </DoubleCheckButton>
          </div>
        </div>
      </div>
    </div>

    <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
      <div class="flex flex-col gap-3">
        <div>
          <div class="text-lg text-red-600 font-semibold dark:text-red-300">
            {{ t('settings.pages.data.sections.danger.title') }}
          </div>
          <p class="text-sm text-red-600/80 dark:text-red-200/80">
            {{ t('settings.pages.data.sections.danger.description') }}
          </p>
        </div>

        <div class="flex flex-col gap-3">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="rounded-lg bg-white/70 p-3 dark:bg-red-950/40">
              <div class="grid grid-cols-1 items-start gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <div class="flex flex-col gap-1 md:max-w-[560px]">
                  <div class="text-sm text-red-700 font-medium dark:text-red-200">
                    {{ t('settings.pages.data.sections.providers.title') }}
                  </div>
                  <p class="text-xs text-red-700/80 dark:text-red-200/80">
                    {{ t('settings.pages.data.sections.providers.description') }}
                  </p>
                </div>
                <div class="flex flex-col items-start gap-2">
                  <DoubleCheckButton
                    variant="danger"
                    @confirm="runAction(resetProvidersSettings, 'settings.pages.data.status.providers_reset')"
                  >
                    {{ t('settings.pages.data.sections.providers.reset') }}
                    <template #confirm>
                      {{ t('settings.pages.data.confirmations.yes') }}
                    </template>
                    <template #cancel>
                      {{ t('settings.pages.card.cancel') }}
                    </template>
                  </DoubleCheckButton>
                </div>
              </div>
            </div>

            <div class="rounded-lg bg-white/70 p-3 dark:bg-red-950/40">
              <div class="grid grid-cols-1 items-start gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <div class="flex flex-col gap-1 md:max-w-[560px]">
                  <div class="text-sm text-red-700 font-medium dark:text-red-200">
                    {{ t('settings.pages.data.sections.all.title') }}
                  </div>
                  <p class="text-xs text-red-700/80 dark:text-red-200/80">
                    {{ t('settings.pages.data.sections.all.description') }}
                  </p>
                </div>
                <div class="flex flex-col items-start gap-2">
                  <DoubleCheckButton
                    variant="danger"
                    @confirm="runAction(deleteAllData, 'settings.pages.data.status.all_deleted')"
                  >
                    {{ t('settings.pages.data.sections.all.delete') }}
                    <template #confirm>
                      {{ t('settings.pages.data.confirmations.yes') }}
                    </template>
                    <template #cancel>
                      {{ t('settings.pages.card.cancel') }}
                    </template>
                  </DoubleCheckButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="isDesktop"
      class="border-2 border-amber-300/80 rounded-xl bg-amber-50/80 p-4 shadow-sm dark:border-amber-500/60 dark:bg-amber-500/10"
    >
      <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div class="flex flex-col gap-1 md:max-w-[560px]">
          <div class="text-lg text-amber-700 font-medium dark:text-amber-200">
            {{ t('settings.pages.data.sections.desktop.title') }}
          </div>
          <p class="text-sm text-amber-700/80 dark:text-amber-200/80">
            {{ t('settings.pages.data.sections.desktop.description') }}
          </p>
        </div>
        <div class="flex flex-col items-start gap-2">
          <DoubleCheckButton
            variant="caution"
            @confirm="runAction(resetDesktopApplicationState, 'settings.pages.data.status.desktop_reset')"
          >
            {{ t('settings.pages.data.sections.desktop.reset') }}
            <template #confirm>
              {{ t('settings.pages.data.confirmations.yes') }}
            </template>
            <template #cancel>
              {{ t('settings.pages.card.cancel') }}
            </template>
          </DoubleCheckButton>
        </div>
      </div>
    </div>
  </div>

  <DialogRoot :open="isRestoreMappingOpen" @update:open="isRestoreMappingOpen = $event">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-110 bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-110 m-0 max-h-[80vh] max-w-lg w-[90vw] flex flex-col border border-neutral-200 rounded-2xl bg-white p-6 shadow-2xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-800">
        <div class="h-full flex flex-col gap-5 overflow-hidden">
          <div class="border-b border-neutral-200 pb-3 dark:border-neutral-700">
            <DialogTitle class="from-primary-500 to-primary-400 bg-gradient-to-r bg-clip-text text-lg text-transparent font-bold">
              Restore Target Selection
            </DialogTitle>
            <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Map each orphaned session to a new companion card or merge into an existing companion.
            </p>
          </div>

          <div class="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
            <div v-for="orphanId in Object.keys(restoreMappings)" :key="orphanId" class="flex flex-col gap-2 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900/50">
              <span class="break-all text-xs text-neutral-800 font-semibold font-mono dark:text-neutral-200">
                {{ orphanId }}
              </span>
              <select
                v-model="restoreMappings[orphanId]"
                class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="new">
                  ✨ Create New Companion ({{ orphanId }})
                </option>
                <option v-for="char in existingCharacters" :key="char.id" :value="char.id">
                  🤝 Merge into {{ char.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <Button
              variant="secondary"
              label="Cancel"
              @click="isRestoreMappingOpen = false"
            />
            <Button
              variant="primary"
              label="Confirm Restore"
              @click="executeAdvancedRestore"
            />
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <!-- Export Vault Modal -->
  <ExportVaultModal v-model="isExportVaultOpen" />

  <!-- Universal Import Vault Modal -->
  <ImportVaultModal v-model="isImportVaultOpen" @imported="onVaultImported" />

  <!-- Scrub History Modal -->
  <ScrubHistoryModal v-model="isScrubModalOpen" @scrub-complete="onScrubComplete" />
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.data.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.data.description
  icon: i-solar:database-bold-duotone
  settingsEntry: true
  order: 11
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
