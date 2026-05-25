import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useControlsIslandStore = defineStore('controls-island', () => {
  // Persist fade-on-hover preference per user
  const fadeOnHoverEnabled = useLocalStorage<boolean>('controls-island/fade-on-hover-enabled', false)
  const dontShowItAgainNoticeFadeOnHover = useLocalStorage<boolean>(
    'preferences/dont-show-it-again/notice/fade-on-hover',
    false,
  )
  const dontShowGeminiOnboarding = useLocalStorage<boolean>(
    'preferences/dont-show-it-again/notice/gemini-onboarding',
    false,
  )

  function enableFadeOnHover() {
    fadeOnHoverEnabled.value = true
  }

  function disableFadeOnHover() {
    fadeOnHoverEnabled.value = false
  }

  return {
    disableFadeOnHover,
    dontShowGeminiOnboarding,
    dontShowItAgainNoticeFadeOnHover,
    enableFadeOnHover,
    fadeOnHoverEnabled,
  }
})
