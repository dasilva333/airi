<script setup lang="ts">
import { useMediaQuery, useResizeObserver, useScreenSafeArea } from '@vueuse/core'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, VisuallyHidden } from 'reka-ui'
import { DrawerContent, DrawerHandle, DrawerOverlay, DrawerPortal, DrawerRoot } from 'vaul-vue'
import { onMounted } from 'vue'

import OnboardingV2 from './v2/onboarding-v2.vue'

const emit = defineEmits<{
  (e: 'configured'): void
  (e: 'skipped'): void
  (e: 'close'): void
}>()

const showDialog = defineModel({ type: Boolean, default: false, required: false })

const isDesktop = useMediaQuery('(min-width: 768px)')
const screenSafeArea = useScreenSafeArea()

useResizeObserver(document.documentElement, () => screenSafeArea.update())
onMounted(() => screenSafeArea.update())

function handleClose() {
  showDialog.value = false
  emit('close')
  emit('configured')
}
</script>

<template>
  <DialogRoot v-if="isDesktop" :open="showDialog" @update:open="value => showDialog = value">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-[9999] h-[680px] max-h-[92dvh] max-w-5xl w-[92dvw] flex flex-col transform overflow-hidden border border-neutral-200/60 rounded-2xl bg-white/95 p-6 shadow-2xl outline-none backdrop-blur-xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-800/80 dark:bg-neutral-900/95">
        <VisuallyHidden>
          <DialogTitle>AIRI Onboarding</DialogTitle>
        </VisuallyHidden>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <OnboardingV2 @close="handleClose" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
  <DrawerRoot v-else :open="showDialog" should-scale-background @update:open="value => showDialog = value">
    <DrawerPortal>
      <DrawerOverlay class="backdrop-blur-xs fixed inset-0 z-[9999] bg-black/40" />
      <DrawerContent
        class="fixed bottom-0 left-0 right-0 z-[9999] mt-10 h-full max-h-[94dvh] flex flex-col border-t border-neutral-200/60 rounded-t-3xl bg-neutral-50 px-4 pt-3 outline-none backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900"
        :style="{ paddingBottom: `${Math.max(Number.parseFloat(screenSafeArea.bottom.value.replace('px', '')), 24)}px` }"
      >
        <DrawerHandle class="mx-auto mb-2 h-1.5 w-12 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <div class="min-h-0 flex-1 overflow-y-auto">
          <OnboardingV2 @close="handleClose" />
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
