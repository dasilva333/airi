<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

interface QuickAccessItem {
  id: string
  title: string
  subtitle: string
  icon: string
  to: string
}

// All routes verified from actual source code:
// - user-profile: apps/stage-tamagotchi/.../system/index.vue line 13
// - kokoro-local: packages/stage-pages/.../providers/speech/kokoro-local.vue
// - whisper-local: packages/stage-pages/.../providers/transcription/whisper-local.vue
// - discord: packages/stage-ui/src/composables/use-modules-list.ts line 117
const items: QuickAccessItem[] = [
  {
    id: 'user-profile',
    title: 'User Profile',
    subtitle: 'Identity & Connection',
    icon: 'i-solar:user-bold-duotone',
    to: '/settings/system/user-profile',
  },
  {
    id: 'kokoro-speech',
    title: 'Kokoro Speech',
    subtitle: 'Local Voice Engine',
    icon: 'i-solar:volume-loud-bold-duotone',
    to: '/settings/providers/speech/kokoro-local',
  },
  {
    id: 'whisper-stt',
    title: 'Local Whisper',
    subtitle: 'App Speech-to-Text',
    icon: 'i-solar:microphone-3-bold-duotone',
    to: '/settings/providers/transcription/whisper-local',
  },
  {
    id: 'explore-models',
    title: 'Explore Models',
    subtitle: 'Discover Catalog',
    icon: 'i-solar:people-nearby-bold-duotone',
    to: '/settings/models?action=explore',
  },
  {
    id: 'discord-bot',
    title: 'Discord Bot',
    subtitle: 'Relay & Bot Control',
    icon: 'i-simple-icons:discord',
    to: '/settings/modules/messaging-discord',
  },
]

function navigate(to: string) {
  router.push(to)
}
</script>

<template>
  <div class="flex flex-col gap-2">
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
    <div class="grid grid-cols-5 gap-1.5">
      <button
        v-for="item in items"
        :key="item.id"
        :class="[
          'group flex flex-col items-center rounded-xl p-2.5 text-center transition-all duration-200',
          'border border-neutral-200/80 bg-white/70 shadow-xs',
          'dark:border-neutral-800/80 dark:bg-neutral-900/60',
          'hover:border-primary-500/50 hover:bg-white hover:-translate-y-0.5 hover:shadow-md',
          'dark:hover:border-primary-500/50 dark:hover:bg-neutral-850',
        ]"
        @click="navigate(item.to)"
      >
        <div
          :class="[
            'h-7 w-7 flex items-center justify-center rounded-lg transition-transform',
            'bg-primary-500/10 text-primary-500',
            'dark:bg-primary-500/15 dark:text-primary-400',
            'group-hover:scale-110',
          ]"
        >
          <div :class="item.icon" class="text-base" />
        </div>
        <div class="mt-1.5 flex flex-col items-center">
          <span class="truncate text-[11px] text-neutral-800 font-semibold leading-tight dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">
            {{ item.title }}
          </span>
          <span class="truncate text-[9px] text-neutral-400 leading-tight dark:text-neutral-500">
            {{ item.subtitle }}
          </span>
        </div>
      </button>
    </div>
  </div>
</template>
