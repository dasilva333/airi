import type { AutoUpdaterState } from '@proj-airi/electron-eventa/electron-updater'

import {
  autoUpdater,
  electronAutoUpdaterStateChanged,
} from '@proj-airi/electron-eventa/electron-updater'
import { computed, onMounted, ref } from 'vue'

import { useElectronEventaContext, useElectronEventaInvoke } from './use-electron-eventa-context'

export function useElectronAutoUpdater() {
  const context = useElectronEventaContext()

  const state = ref<AutoUpdaterState>({ status: 'idle' })

  const getState = useElectronEventaInvoke(autoUpdater.getState, context.value)
  const checkForUpdates = useElectronEventaInvoke(autoUpdater.checkForUpdates, context.value)
  const downloadUpdate = useElectronEventaInvoke(autoUpdater.downloadUpdate, context.value)
  const quitAndInstall = useElectronEventaInvoke(autoUpdater.quitAndInstall, context.value)
  const getChannel = useElectronEventaInvoke(autoUpdater.getChannel, context.value)
  const setChannel = useElectronEventaInvoke(autoUpdater.setChannel, context.value)
  const applyUpdate = useElectronEventaInvoke(autoUpdater.applyUpdate, context.value)
  const dismissRollback = useElectronEventaInvoke(autoUpdater.dismissRollback, context.value)

  const isBusy = computed(() => ['checking', 'downloading'].includes(state.value.status))
  const canDownload = computed(() => state.value.status === 'available')
  const canRestartToUpdate = computed(() => state.value.status === 'downloaded')
  const channel = computed(() => state.value.channel)

  onMounted(async () => {
    try {
      const current = await getState()
      if (current)
        state.value = current
    }
    catch {}

    if (context.value) {
      try {
        context.value.on(electronAutoUpdaterStateChanged, (evt) => {
          if (evt.body)
            state.value = evt.body
        })
      }
      catch {}
    }
  })

  return {
    state,
    isBusy,
    canDownload,
    canRestartToUpdate,
    channel,

    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    applyUpdate,
    getChannel,
    setChannel,
    dismissRollback,
  }
}
