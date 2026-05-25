import messages from '@proj-airi/i18n/locales'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { onMounted } from 'vue'

const languageRemap: Record<string, string> = {
  en: 'en',
  'en-AU': 'en',
  'en-GB': 'en',
  'en-US': 'en',
  es: 'es',
  'es-AR': 'es',
  'es-ES': 'es',
  'es-MX': 'es',
  fr: 'fr',
  'fr-FR': 'fr',
  ja: 'ja',
  'ja-JP': 'ja',
  ru: 'ru',
  'ru-RU': 'ru',
  'zh-CN': 'zh-Hans',
  'zh-HK': 'zh-Hant',
  'zh-TW': 'zh-Hant',
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
    if (language && languages.includes(language)) return language

    return 'en'
  }

  function resetState() {
    language.reset()
    disableTransitions.reset()
    usePageSpecificTransitions.reset()
    remoteSyncEnabled.reset()
    websocketSecureEnabled.reset()
  }

  onMounted(() => (language.value = getLanguage()))

  return {
    disableTransitions,
    getLanguage,
    language,
    remoteSyncEnabled,
    resetState,
    usePageSpecificTransitions,
    websocketSecureEnabled,
  }
})
