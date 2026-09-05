<script setup lang="ts">
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

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
    to: '/settings/airi-card',
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

// Detection for iOS (iPad/iPhone/iPod)
const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

// Row 2: Audio & Discovery
const row2Items = computed<QuickAccessItem[]>(() => [
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
    to: isStageTamagotchi()
      ? '/settings/providers/speech/kokoro-local'
      : '/settings/providers/speech/pocket-tts-local',
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
    to: isIOS
      ? '/settings/providers/chat/apple-core-ai'
      : '/settings/providers/chat/web-llm',
  },
  {
    id: 'discover-models',
    title: 'Get Free Avatars',
    icon: 'i-solar:planet-3-bold-duotone',
    to: '/settings/models?action=explore',
  },
])

function navigate(target: string | QuickAccessItem) {
  if (typeof target === 'object') {
    if (target.id === 'character-config') {
      const targetId = activeCardId.value || 'default'
      cardStore.requestEditCard(targetId)
      toast.loading('Opening character configuration...', { id: 'character-config-opening', duration: 6000 })
      router.push('/settings/airi-card')
      return
    }
    router.push(target.to)
    return
  }
  router.push(target)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <!-- Row 1: Core & Services -->
    <div class="grid grid-cols-5 gap-1.5">
      <button
        v-for="item in row1Items"
        :key="item.id"
        :class="[
          'group relative flex flex-col items-center justify-center overflow-hidden rounded-xl px-1 py-2 min-h-19 text-center transition-all duration-300',
          'border border-neutral-200/80 bg-white/70 shadow-2xs',
          'dark:border-neutral-800/80 dark:bg-neutral-900/60',
          'hover:border-primary-500/40 dark:hover:border-primary-400/40',
          'hover:bg-primary-500/8 dark:hover:bg-primary-500/15',
          'hover:-translate-y-0.5 hover:shadow-sm',
        ]"
        @click="navigate(item)"
      >
        <div
          :class="[
            'h-7 w-7 flex shrink-0 items-center justify-center rounded-lg transition-all duration-300',
            'bg-primary-500/10 text-primary-500',
            'dark:bg-primary-500/15 dark:text-primary-400',
            'group-hover:bg-primary-500/20 dark:group-hover:bg-primary-500/30 group-hover:scale-110',
          ]"
        >
          <div :class="item.icon" class="text-base" />
        </div>
        <span class="line-clamp-2 mt-1 w-full text-[10px] text-neutral-800 font-medium leading-3 transition-colors duration-300 dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-300">
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
          'group relative flex flex-col items-center justify-center overflow-hidden rounded-xl px-1 py-2 min-h-19 text-center transition-all duration-300',
          'border border-neutral-200/80 bg-white/70 shadow-2xs',
          'dark:border-neutral-800/80 dark:bg-neutral-900/60',
          'hover:border-primary-500/40 dark:hover:border-primary-400/40',
          'hover:bg-primary-500/8 dark:hover:bg-primary-500/15',
          'hover:-translate-y-0.5 hover:shadow-sm',
        ]"
        @click="navigate(item.to)"
      >
        <div
          :class="[
            'h-7 w-7 flex shrink-0 items-center justify-center rounded-lg transition-all duration-300',
            'bg-primary-500/10 text-primary-500',
            'dark:bg-primary-500/15 dark:text-primary-400',
            'group-hover:bg-primary-500/20 dark:group-hover:bg-primary-500/30 group-hover:scale-110',
          ]"
        >
          <div :class="item.icon" class="text-base" />
        </div>
        <span class="line-clamp-2 mt-1 w-full text-[10px] text-neutral-800 font-medium leading-3 transition-colors duration-300 dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-300">
          {{ item.title }}
        </span>
      </button>
    </div>
  </div>
</template>
