import messages from '@proj-airi/i18n/locales'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { onMounted } from 'vue'

const languageRemap: Record<string, string> = {
  'zh': 'zh-Hans',
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
  'zh-HK': 'zh-Hant',
  'en-US': 'en',
  'en-GB': 'en',
  'en-AU': 'en',
  'en': 'en',
  'es-ES': 'es',
  'es-MX': 'es',
  'es-AR': 'es',
  'es': 'es',
  'ru': 'ru',
  'ru-RU': 'ru',
  'fr': 'fr',
  'fr-FR': 'fr',
  'ja': 'ja',
  'ja-JP': 'ja',
}

export const useSettingsGeneral = defineStore('settings-general', () => {
  const language = useLocalStorageManualReset<string>('settings/language', '')

  const disableTransitions = useLocalStorageManualReset<boolean>('settings/disable-transitions', true)
  const usePageSpecificTransitions = useLocalStorageManualReset<boolean>('settings/use-page-specific-transitions', true)
  const remoteSyncEnabled = useLocalStorageManualReset<boolean>('settings/privacy/remote-sync-enabled', false)

  const websocketSecureEnabled = useLocalStorageManualReset<boolean>('settings/websocket/secure-enabled', false)

  function getLanguage() {
    let language = localStorage.getItem('settings/language')

    if (!language) {
      // Fallback to browser language
      language = navigator.language || 'en'
    }

    const languages = Object.keys(messages!)
    if (languageRemap[language || 'en'] != null) {
      language = languageRemap[language || 'en']
    }
    if (language && languages.includes(language))
      return language

    return 'en'
  }

  function resetState() {
    language.reset()
    disableTransitions.reset()
    usePageSpecificTransitions.reset()
    remoteSyncEnabled.reset()
    websocketSecureEnabled.reset()
  }

  onMounted(() => language.value = getLanguage())

  return {
    language,
    disableTransitions,
    usePageSpecificTransitions,
    remoteSyncEnabled,
    websocketSecureEnabled,
    getLanguage,
    resetState,
  }
})

// Phase 0B: pure localStorage-backed state, no timers/channels/handles — safe
// for direct Pinia HMR patching. No dispose ledger needed (nothing to tear
// down). No-op in production (import.meta.hot is undefined).
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsGeneral, import.meta.hot))
}
