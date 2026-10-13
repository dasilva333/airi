<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { OnboardingV3 } from '@proj-airi/stage-ui/components'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { useTheme } from '@proj-airi/ui'
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import { electronOnboardingClose, electronOpenChat, electronStageToggleVisibility } from '../../shared/eventa'

const { t } = useI18n()
const { isDark } = useTheme()
const onboardingStore = useOnboardingStore()

watchEffect(() => {
  document.title = t('onboarding.shell.brand')
})

const bgClass = computed(() => isDark.value ? 'bg-[#0a0a12]' : 'bg-slate-50')

const closeWindow = useElectronEventaInvoke(electronOnboardingClose)
const openChat = useElectronEventaInvoke(electronOpenChat)
const toggleStageVisibility = useElectronEventaInvoke(electronStageToggleVisibility)

async function handleCloseV3() {
  if (!onboardingStore.hasCompletedSetup) {
    onboardingStore.markSetupSkipped()
  }
  try {
    void toggleStageVisibility(true).catch((error: unknown) => console.warn('[Onboarding V3 Page] Failed to reveal Stage:', error))
    void openChat(true).catch((error: unknown) => console.warn('[Onboarding V3 Page] Failed to open Chat window:', error))
  }
  catch (error) {
    console.warn('[Onboarding V3 Page] Failed to reveal Stage or Chat window:', error)
  }
  await closeWindow()
}

async function handleFinishV3() {
  onboardingStore.markSetupCompleted()
  await handleCloseV3()
}

async function handleSkipV3() {
  onboardingStore.markSetupSkipped()
  await handleCloseV3()
}
</script>

<template>
  <div :class="['onboarding-root h-screen w-screen overflow-hidden select-none', bgClass]">
    <OnboardingV3 @close="handleCloseV3" @skip="handleSkipV3" @finish="handleFinishV3" />
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
