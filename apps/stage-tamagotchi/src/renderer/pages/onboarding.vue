<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { OnboardingV2 } from '@proj-airi/stage-ui/components'
import { useTheme } from '@proj-airi/ui'
import { computed } from 'vue'

import { electronOnboardingClose } from '../../shared/eventa'

const { isDark } = useTheme()

const bgClass = computed(() => isDark.value ? 'bg-[#0f0f0f]' : 'bg-white')

const closeWindow = useElectronEventaInvoke(electronOnboardingClose)

async function handleCloseV2() {
  await closeWindow()
}
</script>

<template>
  <div class="onboarding-root" h-full w-full flex flex-col overflow-x-hidden overflow-y-auto overscroll-none :class="bgClass">
    <div :class="bgClass" w="100dvw" min-h="12" w-full flex-shrink-0 select-none data-tauri-drag-region />
    <div class="onboarding-scroll" w-full flex-1 px-3>
      <div class="onboarding-content" h-full>
        <OnboardingV2 @close="handleCloseV2" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.onboarding-root {
  scrollbar-width: none;
}

.onboarding-root::-webkit-scrollbar {
  display: none;
}

.onboarding-content {
  padding: 8px 0 20px 0;
}

.onboarding-scroll {
  padding-top: 8px;
  padding-bottom: 20px;
  overflow-y: auto;
}
</style>

<route lang="yaml">
meta:
  layout: plain
</route>
