<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { OnboardingV3 } from '@proj-airi/stage-ui/components'
import { useTheme } from '@proj-airi/ui'
import { computed } from 'vue'

import { electronOnboardingClose, electronOpenChat, electronStageToggleVisibility } from '../../shared/eventa'

const { isDark } = useTheme()

const bgClass = computed(() => isDark.value ? 'bg-[#0a0a12]' : 'bg-slate-50')

const closeWindow = useElectronEventaInvoke(electronOnboardingClose)
const openChat = useElectronEventaInvoke(electronOpenChat)
const toggleStageVisibility = useElectronEventaInvoke(electronStageToggleVisibility)

async function handleCloseV3() {
  try {
    await toggleStageVisibility(true)
    await openChat(true)
  }
  catch (error) {
    console.warn('[Onboarding V3 Page] Failed to reveal Stage or Chat window:', error)
  }
  await closeWindow()
}
</script>

<template>
  <div :class="['onboarding-root h-screen w-screen overflow-hidden select-none', bgClass]">
    <OnboardingV3 @close="handleCloseV3" @finish="handleCloseV3" />
  </div>
</template>

<style scoped>
.onboarding-root {
  scrollbar-width: none;
}

.onboarding-root::-webkit-scrollbar {
  display: none;
}
</style>

<route lang="yaml">
meta:
  layout: plain
</route>
