<script setup lang="ts">
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useDataMaintenance } from '@proj-airi/stage-ui/composables/use-data-maintenance'
import { useBackupStore } from '@proj-airi/stage-ui/stores/backup'
import { Button, DoubleCheckButton } from '@proj-airi/ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
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
} = useDataMaintenance()

const backupStore = useBackupStore()

const statusMessage = ref('')
const statusTone = ref<'neutral' | 'success' | 'error'>('neutral')
const importError = ref('')
const importFileInput = ref<HTMLInputElement>()
const importType = ref<'chats' | 'characters' | 'memory' | 'backgrounds'>('chats')
const isDesktop = computed(() => isStageTamagotchi())

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

const formattedLastBackupTime = computed(() => {
  if (!backupStore.lastBackupTime)
    return 'Never'
  return new Date(backupStore.lastBackupTime).toLocaleString()
})

async function handleTriggerBackup() {
  const backupPathResult = await backupStore.triggerBackup()
  if (backupPathResult) {
    setStatus(`Backup completed successfully at: ${backupPathResult}`)
  }
  else {
    setStatus('Backup failed!', 'error')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 pb-4">
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

    <!-- Backup -->
    <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
      <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div class="flex flex-col gap-1 md:max-w-[560px]">
          <div class="text-lg font-medium">
            Auto-Backup & Manual Backup
          </div>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            Configure auto-backup or trigger a manual backup.
          </p>
          <div class="mt-2 text-sm text-neutral-500">
            <div>Backup Path: <span class="font-mono">{{ backupStore.backupPath || '~/Documents/AIRI-Backups' }}</span></div>
            <div>Last Backup: <span class="font-mono">{{ formattedLastBackupTime }}</span></div>
          </div>
        </div>
        <div class="flex flex-col items-start gap-2 sm:items-end">
          <div class="flex flex-wrap gap-2">
            <Button :variant="backupStore.isBackupEnabled ? 'primary' : 'secondary'" @click="backupStore.isBackupEnabled = !backupStore.isBackupEnabled">
              {{ backupStore.isBackupEnabled ? 'Auto-Backup Enabled' : 'Auto-Backup Disabled' }}
            </Button>
            <Button variant="primary" @click="handleTriggerBackup">
              Trigger Backup
            </Button>
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
