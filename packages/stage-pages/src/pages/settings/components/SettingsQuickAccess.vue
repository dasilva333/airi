<script setup lang="ts">
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

interface QuickAccessItem {
  id: string
  title: string
  icon: string
  to: string
}

const router = useRouter()
const cardStore = useAiriCardStore()
const { activeCardId } = storeToRefs(cardStore)

// Row 1: Core Character & Services
const row1Items = computed<QuickAccessItem[]>(() => [
  {
    id: 'user-profile',
    title: 'User Profile',
    icon: 'i-solar:user-bold-duotone',
    to: '/settings/system/user-profile',
  },
  {
    id: 'character-config',
    title: 'Character Config',
    icon: 'i-solar:pen-bold-duotone',
    to: activeCardId.value ? `/settings/airi-card?cardId=${activeCardId.value}&edit=true` : '/settings/airi-card',
  },
  {
    id: 'character-wizard',
    title: 'Character Wizard',
    icon: 'i-solar:magic-stick-3-bold-duotone',
    to: '/settings/airi-card/guided',
  },
  {
    id: 'discord-bot',
    title: 'Discord Bot',
    icon: 'i-simple-icons:discord',
    to: '/settings/modules/messaging-discord',
  },
  {
    id: 'cloud-sync',
    title: 'Cloud Sync',
    icon: 'i-solar:cloud-bold-duotone',
    to: '/settings/modules/cloud-sync',
  },
])

// Row 2: Audio & Discovery
const row2Items: QuickAccessItem[] = [
  {
    id: 'audio-studio',
    title: 'Audio Studio',
    icon: 'i-solar:soundwave-bold-duotone',
    to: '/settings/providers/speech/virtual-audio-studio',
  },
  {
    id: 'local-voice',
    title: 'Local Voice',
    icon: 'i-solar:volume-loud-bold-duotone',
    to: '/settings/providers/speech/kokoro-local',
  },
  {
    id: 'local-hearing',
    title: 'Local Hearing',
    icon: 'i-solar:microphone-3-bold-duotone',
    to: '/settings/providers/transcription/whisper-local',
  },
  {
    id: 'local-free-ai',
    title: 'Local Free AI',
    icon: 'i-solar:cpu-bolt-bold-duotone',
    to: '/settings/providers/chat/web-llm',
  },
  {
    id: 'discover-models',
    title: 'Find Free Bodies',
    icon: 'i-solar:planet-3-bold-duotone',
    to: '/settings/models?action=explore',
  },
]

function navigate(to: string) {
  router.push(to)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Header -->
    <div
      :class="[
        'flex items-center justify-between px-4',
        'text-xs font-bold uppercase tracking-wider',
        'text-neutral-400 dark:text-neutral-500',
      ]"
    >
      <span>Quick Shortcuts</span>
      <span class="text-[10px] text-neutral-400/80 font-normal normal-case">Deep links</span>
    </div>

    <!-- 2-Row Grid (Square Cards: Icon top, Title bottom) -->
    <div class="flex flex-col gap-1.5">
      <!-- Row 1: Core & Services -->
      <div class="grid grid-cols-5 gap-1.5">
        <button
          v-for="item in row1Items"
          :key="item.id"
          :class="[
            'group flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all duration-200',
            'border border-neutral-200/80 bg-white/70 shadow-xs',
            'dark:border-neutral-800/80 dark:bg-neutral-900/60',
            'hover:border-primary-500/50 hover:bg-white hover:-translate-y-0.5 hover:shadow-md',
            'dark:hover:border-primary-500/50 dark:hover:bg-neutral-850',
          ]"
          @click="navigate(item.to)"
        >
          <div
            :class="[
              'h-8 w-8 flex items-center justify-center rounded-lg transition-transform',
              'bg-primary-500/10 text-primary-500',
              'dark:bg-primary-500/15 dark:text-primary-400',
              'group-hover:scale-110',
            ]"
          >
            <div :class="item.icon" class="text-lg" />
          </div>
          <span class="mt-2 truncate text-xs text-neutral-800 font-semibold dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">
            {{ item.title }}
          </span>
        </button>
      </div>

      <!-- Row 2: Audio & Discovery -->
      <div class="grid grid-cols-5 gap-1.5">
        <button
          v-for="item in row2Items"
          :key="item.id"
          :class="[
            'group flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all duration-200',
            'border border-neutral-200/80 bg-white/70 shadow-xs',
            'dark:border-neutral-800/80 dark:bg-neutral-900/60',
            'hover:border-primary-500/50 hover:bg-white hover:-translate-y-0.5 hover:shadow-md',
            'dark:hover:border-primary-500/50 dark:hover:bg-neutral-850',
          ]"
          @click="navigate(item.to)"
        >
          <div
            :class="[
              'h-8 w-8 flex items-center justify-center rounded-lg transition-transform',
              'bg-primary-500/10 text-primary-500',
              'dark:bg-primary-500/15 dark:text-primary-400',
              'group-hover:scale-110',
            ]"
          >
            <div :class="item.icon" class="text-lg" />
          </div>
          <span class="mt-2 truncate text-xs text-neutral-800 font-semibold dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">
            {{ item.title }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
