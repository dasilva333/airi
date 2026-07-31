import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export type TextToMotionMode = 'procedural' | 'flowmdm'

export const useTextToMotionStore = defineStore('module-text-to-motion', () => {
  const mode = useStorage<TextToMotionMode>('settings/modules/text-to-motion/mode', 'procedural')
  const enabled = useStorage<boolean>('settings/modules/text-to-motion/enabled', true)

  const configured = computed(() => enabled.value)

  function setMode(newMode: TextToMotionMode) {
    mode.value = newMode
  }

  return {
    mode,
    enabled,
    configured,
    setMode,
  }
})
