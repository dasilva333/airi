import { useBroadcastChannel, useColorMode, useToggle } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

class LocalStorageShim implements Storage {
  private map = new Map<string, string>()

  clear() {
    this.map.clear()
  }

  getItem(key: string) {
    return this.map.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null
  }

  get length() {
    return this.map.size
  }

  setItem(key: string, value: string) {
    this.map.set(key, value)
  }

  removeItem(key: string) {
    this.map.delete(key)
  }
}

// The classes are the ones of `useDark`: `dark` on the root element, and none for light.
const colorMode = useColorMode({
  modes: { dark: 'dark', light: '' },
  disableTransition: true,
  // NOTICE: for histoire / vitest / SSR, localStorage global variable exists but `storage.getItem is not a function`
  // will be thrown. LocalStorageShim avoids this issue, falling back to real localStorage when available.
  storage: 'localStorage' in globalThis && localStorage != null && 'getItem' in localStorage && typeof localStorage.getItem === 'function' ? localStorage : new LocalStorageShim(),
})

/**
 * Whether the dark theme shows now. A two-state toggle writes it, and selects
 * the light or the dark theme. Only a three-state control selects `auto`.
 */
const isDark = computed({
  get: () => colorMode.state.value === 'dark',
  set: (dark) => {
    colorMode.store.value = dark ? 'dark' : 'light'
  },
})

const toggleDark = useToggle(isDark)

/** Selects the next theme: light, dark, then the system scheme. */
function switchToNextTheme() {
  colorMode.store.value = ({ light: 'dark', dark: 'auto', auto: 'light' } as const)[colorMode.store.value] || 'auto'
}

// NOTICE: useBroadcastChannel at module scope creates a *native Node*
// BroadcastChannel when this module is imported outside a browser
// (histoire story collection, vitest, SSR). Its immediate post below then
// crashes Node with ERR_INVALID_ARG_TYPE once a cross-realm MessageEvent
// arrives. Only wire cross-window sync in a real browser window.
const isBrowserWindow = typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined'
const { data, post } = isBrowserWindow
  ? useBroadcastChannel<string | boolean, string | boolean>({ name: 'airi-theme-sync' })
  : { data: ref<string | boolean | undefined>(undefined), post: () => {} }

watch(colorMode.store, (val) => {
  if (data.value !== val) {
    post(val)
  }
}, { immediate: true })

watch(data, (val) => {
  if (val === undefined)
    return

  if (typeof val === 'boolean') {
    const mapped = val ? 'dark' : 'light'
    if (colorMode.store.value !== mapped) {
      colorMode.store.value = mapped
    }
  }
  else if (val === 'auto' || val === 'light' || val === 'dark') {
    if (colorMode.store.value !== val) {
      colorMode.store.value = val
    }
  }
})

export function useTheme() {
  return {
    isDark,
    toggleDark,
    /** The chosen theme, which a three-state control reads and writes. */
    themeMode: colorMode.store,
    switchToNextTheme,
  }
}
