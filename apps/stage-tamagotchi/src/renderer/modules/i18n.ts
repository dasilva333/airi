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
  ru: 'ru',
  'ru-RU': 'ru',
  vi: 'vi',
  'vi-VN': 'vi',
  'zh-CN': 'zh-Hans',
  'zh-HK': 'zh-Hant',
  'zh-TW': 'zh-Hant',
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
