import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { useAsyncState, useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { watch } from 'vue'

import { electronApplyServerChannelConfig, electronGetServerChannelConfig } from '../../../shared/eventa'

export const useServerChannelSettingsStore = defineStore('tamagotchi-server-channel-settings', () => {
  const websocketTlsConfig = useLocalStorage<{ cert?: string; key?: string; passphrase?: string } | null | undefined>(
    'settings/server-channel/websocket-tls-config',
    null,
  )
  const hostname = useLocalStorage<string>('settings/server-channel/hostname', '127.0.0.1')
  const authToken = useLocalStorage<string>('settings/server-channel/auth-token', '')

  const getServerChannelConfig = useElectronEventaInvoke(electronGetServerChannelConfig)
  const applyServerChannelConfig = useElectronEventaInvoke(electronApplyServerChannelConfig)

  const serverChannelConfig = useAsyncState(getServerChannelConfig, null as any)

  watch([websocketTlsConfig, hostname, authToken], async ([newTls, newHost, newAuth]) => {
    await applyServerChannelConfig({
      authToken: newAuth,
      hostname: newHost,
      websocketTlsConfig: newTls ? {} : null,
    })
  })

  watch(serverChannelConfig.state, (newConfig) => {
    if (newConfig?.websocketTlsConfig !== undefined) {
      websocketTlsConfig.value = newConfig.websocketTlsConfig
    }
    if (newConfig?.hostname !== undefined) {
      hostname.value = newConfig.hostname
    }
    if (newConfig?.authToken !== undefined) {
      authToken.value = newConfig.authToken
    }
  })

  return {
    authToken,
    hostname,
    websocketTlsConfig,
  }
})
