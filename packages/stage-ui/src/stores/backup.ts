import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'

import { useDataMaintenance } from '../composables/use-data-maintenance'

export const useBackupStore = defineStore('backup', () => {
  const isBackupEnabled = useLocalStorageManualReset<boolean>('settings/backup/enabled', true)
  const backupPath = useLocalStorageManualReset<string>('settings/backup/path', '')
  const lastBackupTime = useLocalStorageManualReset<number>('settings/backup/last-time', 0)

  const dataMaintenance = useDataMaintenance()

  async function triggerBackup() {
    console.log('[Backup] Triggering backup...')

    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-')
      const files: Record<string, string> = {}

      // 1. Export Chats
      const chatsBlob = await dataMaintenance.exportChatSessions()
      files[`airi-chat-sessions-${timestamp}.json`] = await chatsBlob.text()

      // 2. Export Characters
      const charactersBlob = await dataMaintenance.exportAllCharacters()
      files[`airi-characters-${timestamp}.json`] = await charactersBlob.text()

      // 3. Export Memory
      const memoryBlob = await dataMaintenance.exportMemory()
      files[`airi-memory-${timestamp}.json`] = await memoryBlob.text()

      // 4. Export LocalStorage
      const storageData: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          storageData[key] = localStorage.getItem(key) || ''
        }
      }
      files[`airi-localstorage-${timestamp}.json`] = JSON.stringify(storageData, null, 2)

      // Save as bundle (ZIP)
      const result = await (window as any).electron.ipcRenderer.invoke('save-backup-bundle', {
        timestamp,
        files,
        customPath: backupPath.value,
      }) as { success: boolean, path: string }

      // Update last backup time
      lastBackupTime.value = Date.now()
      console.log('[Backup] Backup completed successfully!')
      return result.path
    }
    catch (error) {
      console.error('[Backup] Backup failed:', error)
      return null
    }
  }

  return {
    isBackupEnabled,
    backupPath,
    lastBackupTime,
    triggerBackup,
  }
})
