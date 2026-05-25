import messages from '@proj-airi/i18n/locales'

import { createI18n } from 'vue-i18n'

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
  ru: 'ru',
  'ru-RU': 'ru',
  'zh-CN': 'zh-Hans',
  'zh-Hant': 'zh-Hans', // TODO: remove this when zh-Hant is supported
  'zh-HK': 'zh-Hans', // TODO: remove this when zh-Hant is supported
  'zh-TW': 'zh-Hans', // TODO: remove this when zh-Hant is supported
}

function getLocale() {
  let language = localStorage.getItem('settings/language')
  const languages = Object.keys(messages!)

  if (languageRemap[language || 'en'] != null) {
    language = languageRemap[language || 'en']
  }
  if (language && languages.includes(language)) return language

  return 'en'
}

export const i18n = createI18n({
  fallbackLocale: 'en',
  legacy: false,
  locale: getLocale(),
  messages,
})
