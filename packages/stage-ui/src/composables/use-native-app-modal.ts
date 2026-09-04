import { createSharedComposable, useLocalStorage } from '@vueuse/core'
import { ref } from 'vue'

export const useGetNativeAppModal = createSharedComposable(() => {
  const isOpen = ref(false)
  const hasDismissed = useLocalStorage('settings/dismissed-get-native-apps', false)

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function dismiss() {
    hasDismissed.value = true
    isOpen.value = false
  }

  return {
    isOpen,
    hasDismissed,
    open,
    close,
    dismiss,
  }
})
