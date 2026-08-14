<script setup lang="ts">
import { estimateTokens } from '@proj-airi/stage-shared'
import { BrainModelPicker } from '@proj-airi/stage-ui/components'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import MobileHeaderLink from './MobileHeaderLink.vue'
import MobileSessionSwitcherPopover from './MobileSessionSwitcherPopover.vue'
import MobileUtilityPopover from './MobileUtilityPopover.vue'

const chatSessionStore = useChatSessionStore()
const { messages } = storeToRefs(chatSessionStore)

// Approximate context capacity bar
const MAX_CONTEXT_TOKENS = 128_000

const sessionTokenCount = computed(() => {
  let total = 0
  for (const msg of messages.value) {
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content)
    }
    else if (Array.isArray(msg.content)) {
      const textOnly = msg.content
        .map((part: any) => {
          if (typeof part === 'string')
            return part
          if (part && typeof part === 'object' && 'text' in part && !('image_url' in part))
            return String(part.text ?? '')
          return ''
        })
        .join('')
      total += estimateTokens(textOnly)
    }
  }
  return total
})

const tokenUsagePercent = computed(() => {
  if (!sessionTokenCount.value)
    return 2 // subtle base indicator
  return Math.min(Math.max((sessionTokenCount.value / MAX_CONTEXT_TOKENS) * 100, 2), 100)
})

const tokenBarColorClass = computed(() => {
  if (tokenUsagePercent.value > 85)
    return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
  if (tokenUsagePercent.value > 60)
    return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
  return 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.5)]'
})
</script>

<template>
  <header class="w-full flex flex-col gap-1.5 px-3">
    <!-- Top Action Strip -->
    <div class="w-full flex items-center justify-between gap-2">
      <!-- Left: Clean Logo Anchor & Timeline/Story Capsule -->
      <div class="min-w-0 flex items-center gap-2">
        <MobileHeaderLink class="shrink-0" />
        <MobileSessionSwitcherPopover />
      </div>

      <!-- Right: Action Cluster (Brain, Injections, Customizer, Settings) -->
      <div class="flex shrink-0 items-center gap-1.5">
        <!-- 1. Brain / LLM Model Switcher -->
        <BrainModelPicker
          variant="circle"
          side="bottom"
        />

        <!-- 2. Utility / Runtime Feature Toggles & Injections -->
        <MobileUtilityPopover />

        <!-- 3. Control Strip Customizer Trigger -->
        <RouterLink
          to="/settings/stage"
          class="size-8.5 flex items-center justify-center border border-neutral-200/30 rounded-full bg-white/10 text-neutral-700 shadow-sm backdrop-blur-md transition-all active:scale-95 dark:border-neutral-700/40 dark:bg-neutral-800/60 dark:text-neutral-200"
          title="Control Customizer"
        >
          <div class="i-solar:widget-2-bold-duotone size-4.5 text-sky-500 dark:text-sky-400" />
        </RouterLink>

        <!-- 4. Settings Gear -->
        <RouterLink
          to="/settings"
          class="size-8.5 flex items-center justify-center border border-neutral-200/30 rounded-full bg-white/10 text-neutral-700 shadow-sm backdrop-blur-md transition-all active:scale-95 dark:border-neutral-700/40 dark:bg-neutral-800/60 dark:text-neutral-200"
          title="Settings"
        >
          <div class="i-solar:settings-bold-duotone size-4.5 text-neutral-600 dark:text-neutral-300" />
        </RouterLink>
      </div>
    </div>

    <!-- Sub-Header: Animated Token Capacity Line -->
    <div class="h-[1.5px] w-full overflow-hidden rounded-full bg-neutral-200/20 dark:bg-neutral-800/40">
      <div
        :class="[
          'h-full rounded-full transition-all duration-500 ease-out',
          tokenBarColorClass,
        ]"
        :style="{ width: `${tokenUsagePercent}%` }"
      />
    </div>
  </header>
</template>
