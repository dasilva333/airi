<script setup lang="ts">
import type { MicToggleHotkey } from '@proj-airi/stage-shared/shortcuts'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { electronGetMicToggleHotkey, electronSetMicToggleHotkey } from '@proj-airi/stage-shared/shortcuts'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { RadioCardSimple } from '../../../../../menu'

// V2 onboarding — Electron-only lock-key mic trigger. Hidden on web.
// Lifted from settings/modules/hearing.vue (including the isFetched race guard).
const isElectron = typeof window !== 'undefined' && !!(window as any).electron
const getHotkeyInvoke = isElectron ? useElectronEventaInvoke(electronGetMicToggleHotkey) : null
const setHotkeyInvoke = isElectron ? useElectronEventaInvoke(electronSetMicToggleHotkey) : null

const selectedHotkey = ref<MicToggleHotkey>('Scroll')
const lastPressAt = ref(0)
const isFetched = ref(false)
let pressFlashTimer: ReturnType<typeof setTimeout> | undefined

const options: { id: MicToggleHotkey, label: string }[] = [
  { id: 'Scroll', label: 'Scroll Lock' },
  { id: 'Caps', label: 'Caps Lock' },
  { id: 'Num', label: 'Num Lock' },
]

onMounted(async () => {
  if (!isElectron)
    return
  const hotkey = await getHotkeyInvoke?.()
  if (hotkey)
    selectedHotkey.value = hotkey as MicToggleHotkey
  isFetched.value = true

  // Live press feedback from the main-process global shortcut.
  ;(window as any).electron?.ipcRenderer?.on('toggle-mic-from-shortcut', () => {
    lastPressAt.value = Date.now()
    clearTimeout(pressFlashTimer)
    pressFlashTimer = setTimeout(() => (lastPressAt.value = 0), 1600)
  })
})

onBeforeUnmount(() => clearTimeout(pressFlashTimer))

// Only persist after the initial fetch to avoid overwriting the stored key on init.
watch(selectedHotkey, async (next, prev) => {
  if (isElectron && isFetched.value && next !== prev)
    await setHotkeyInvoke?.(next)
})
</script>

<template>
  <div v-if="isElectron" :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']">
    <div class="flex items-center justify-between gap-2">
      <div>
        <div class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
          Push-to-Talk Trigger Key
        </div>
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          Pick a lock key to toggle the microphone hands-free.
        </p>
      </div>
      <span
        v-if="lastPressAt"
        class="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-600 font-bold dark:text-emerald-400"
      >
        <div class="i-solar:check-circle-bold-duotone h-3.5 w-3.5" />
        Key detected
      </span>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <RadioCardSimple
        v-for="opt in options"
        :id="`onboarding-v2-hotkey-${opt.id}`"
        :key="opt.id"
        v-model="selectedHotkey"
        name="onboarding-v2-hotkey"
        :value="opt.id"
        :title="opt.label"
      />
    </div>
  </div>
</template>
