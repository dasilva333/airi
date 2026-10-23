<script setup lang="ts">
import { onUnmounted, ref, useTemplateRef } from 'vue'

import VoiceInputHoverCard from './VoiceInputHoverCard.vue'

// Hover bridge wrapper: renders the trigger inline, floats the card in a
// body Teleport. Teleporting escapes ancestor `overflow-hidden` clipping
// (e.g. the landscape composer card's rounded container), which no z-index
// can fix. A short close delay lets the cursor travel trigger → card.
const CARD_WIDTH = 288 // w-72
const CLOSE_DELAY_MS = 200

const open = ref(false)
const cardStyle = ref({ left: '0px', bottom: '0px' })
const anchorRef = useTemplateRef<HTMLElement>('anchorRef')
let closeTimer: ReturnType<typeof setTimeout> | undefined

function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = undefined
  }
}

function handleEnter() {
  clearCloseTimer()
  const anchor = anchorRef.value
  if (anchor) {
    const rect = anchor.getBoundingClientRect()
    const left = Math.min(
      Math.max(rect.right - CARD_WIDTH, 8),
      Math.max(window.innerWidth - CARD_WIDTH - 8, 8),
    )
    cardStyle.value = {
      left: `${left}px`,
      bottom: `${Math.max(window.innerHeight - rect.top + 8, 8)}px`,
    }
  }
  open.value = true
}

function scheduleClose() {
  clearCloseTimer()
  closeTimer = setTimeout(() => {
    open.value = false
  }, CLOSE_DELAY_MS)
}

onUnmounted(() => {
  clearCloseTimer()
})
</script>

<template>
  <div
    ref="anchorRef"
    class="relative shrink-0"
    @mouseenter="handleEnter"
    @mouseleave="scheduleClose"
    @focusin="handleEnter"
    @focusout="scheduleClose"
  >
    <slot />
    <Teleport to="body">
      <div
        v-if="open"
        class="fixed z-[60]"
        :style="cardStyle"
        @mouseenter="handleEnter"
        @mouseleave="scheduleClose"
      >
        <VoiceInputHoverCard />
      </div>
    </Teleport>
  </div>
</template>
