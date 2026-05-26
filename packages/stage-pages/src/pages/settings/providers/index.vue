<script setup lang="ts">
import { IconStatusItem, RippleGrid } from '@proj-airi/stage-ui/components'
import { useAnalytics } from '@proj-airi/stage-ui/composables'
import { useRippleGridState } from '@proj-airi/stage-ui/composables/use-ripple-grid-state'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const providersStore = useProvidersStore()
const artistryStore = useArtistryStore()
const { lastClickedIndex, setLastClickedIndex } = useRippleGridState()
const { trackProviderClick } = useAnalytics()

const {
  allChatProvidersMetadata,
  allAudioSpeechProvidersMetadata,
  allAudioTranscriptionProvidersMetadata,
  allVisionProvidersMetadata,
} = storeToRefs(providersStore)

const allArtistryProvidersMetadata = computed(() => {
  return [
    {
      beginnerRecommended: true,
      category: 'artistry',
      configured: !!artistryStore.comfyuiServerUrl,
      deployment: 'local',
      description: 'Local image generation runner.',
      icon: 'i-solar:gallery-bold-duotone',
      iconColor: 'text-indigo-500',
      iconImage: undefined,
      id: 'comfyui',
      localizedDescription: 'Local image generation runner.',
      localizedName: 'ComfyUI',
      name: 'ComfyUI',
      pricing: 'free',
      to: '/settings/providers/artistry/comfyui',
    },
    {
      beginnerRecommended: false,
      category: 'artistry',
      configured: !!artistryStore.replicateApiKey,
      deployment: 'cloud',
      description: 'Cloud-based model inference service.',
      icon: 'i-lobe-icons:replicate',
      iconColor: 'i-lobe-icons:replicate-color',
      iconImage: undefined,
      id: 'replicate',
      localizedDescription: 'Cloud-based model inference service.',
      localizedName: 'Replicate',
      name: 'Replicate',
      pricing: 'paid',
      to: '/settings/providers/artistry/replicate',
    },
    {
      beginnerRecommended: false,
      category: 'artistry',
      configured: !!artistryStore.nanobananaApiKey,
      deployment: 'cloud',
      description: 'Google AI Studio Image Preview.',
      icon: 'i-solar:gallery-round-bold-duotone',
      iconColor: 'text-amber-500',
      iconImage: undefined,
      id: 'nanobanana',
      localizedDescription: 'Google AI Studio Image Preview.',
      localizedName: 'Nano Banana',
      name: 'Nano Banana',
      pricing: 'free',
      to: '/settings/providers/artistry/nanobanana',
    },
  ]
})

const providerBlocksConfig = [
  {
    description: 'Text generation model providers. e.g. OpenRouter, OpenAI, Ollama.',
    icon: 'i-solar:chat-square-like-bold-duotone',
    id: 'chat',
    providersRef: allChatProvidersMetadata,
    title: 'Chat',
  },
  {
    description: 'Speech (text-to-speech) model providers. e.g. ElevenLabs, Azure Speech.',
    icon: 'i-solar:user-speak-rounded-bold-duotone',
    id: 'speech',
    providersRef: allAudioSpeechProvidersMetadata,
    title: 'Speech',
  },
  {
    description: 'Transcription (speech-to-text) model providers. e.g. Whisper.cpp, OpenAI, Azure Speech.',
    icon: 'i-solar:microphone-3-bold-duotone',
    id: 'transcription',
    providersRef: allAudioTranscriptionProvidersMetadata,
    title: 'Transcription',
  },
  {
    description: 'Image generation and design model providers. e.g. ComfyUI, Replicate.',
    icon: 'i-solar:palette-bold-duotone',
    id: 'artistry',
    providersRef: allArtistryProvidersMetadata,
    title: 'Artistry',
  },
  {
    description: 'Vision-Language model providers. e.g. OpenRouter, OpenAI, Ollama.',
    icon: 'i-solar:eye-scan-bold-duotone',
    id: 'vision',
    providersRef: allVisionProvidersMetadata,
    title: 'Vision',
  },
]

const activeTabId = ref(providerBlocksConfig[0].id)
const filterPricing = ref<'all' | 'free' | 'paid'>('all')
const filterDeployment = ref<'all' | 'local' | 'cloud'>('all')

const activeTabRecommendations = computed(() => {
  const category = activeTabId.value
  const title = t(`settings.pages.providers.onboarding.${category}.title`)
  const description = t(`settings.pages.providers.onboarding.${category}.description`)

  if (!title || title.includes(category)) return null

  return {
    badge: t('settings.pages.providers.onboarding.start_here'),
    description,
    title,
  }
})

onMounted(() => {
  if (route.hash) {
    const hashId = route.hash.replace('#', '')
    if (providerBlocksConfig.some((b) => b.id === hashId)) {
      activeTabId.value = hashId
    }
  }
})

function setActiveTab(id: string) {
  activeTabId.value = id
  filterPricing.value = 'all'
  filterDeployment.value = 'all'
  router.replace({ hash: `#${id}` }).catch(() => {})
}

const providerBlocks = computed(() => {
  let globalIndex = 0
  return providerBlocksConfig
    .filter((block) => block.id === activeTabId.value)
    .map((block) => {
      const filteredProviders = block.providersRef.value
        .filter((p) => {
          if (filterPricing.value !== 'all' && p.pricing !== filterPricing.value) return false
          if (filterDeployment.value !== 'all' && p.deployment !== filterDeployment.value) return false
          return true
        })
        .map((provider) => ({
          ...provider,
          renderIndex: globalIndex++,
        }))

      return {
        description: block.description,
        icon: block.icon,
        id: block.id,
        providers: filteredProviders,
        title: block.title,
      }
    })
})
</script>

<template>
  <div mb-6 flex flex-col gap-5>
    <div
      v-if="activeTabRecommendations"
      :class="[
        'bg-primary-500/10 dark:bg-primary-800/25',
        'border-1 border-primary-500/20',
        'rounded-lg p-5',
      ]"
    >
      <div
        mb-2
        flex
        items-center
        gap-2
        text-xl
        font-semibold
        :class="['text-primary-800 dark:text-primary-100']"
      >
        <div i-solar:map-arrow-square-bold-duotone />
        <span>{{ activeTabRecommendations.title }}</span>
        <div

          ml-auto rounded-full px-2 py-0.5 text-xs font-bold tracking-wider uppercase
          :class="[
            'bg-primary-500/20',
            'text-primary-600 dark:text-primary-300',
          ]"
        >
          {{ activeTabRecommendations.badge }}
        </div>
      </div>
      <div
        :class="['text-primary-700 dark:text-primary-300']"
        v-html="activeTabRecommendations.description"
      />
    </div>

    <div class="flex flex-row flex-wrap gap-2 pb-2">
      <button
        v-for="block in providerBlocksConfig"
        :key="block.id"
        class="flex items-center gap-2 rounded-xl px-4 py-2 outline-none transition-colors duration-200"
        :class="activeTabId === block.id ? 'bg-primary-500/15 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300 font-semibold' : 'hover:bg-neutral-200/50 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400'"
        @click="setActiveTab(block.id)"
      >
        <div :class="block.icon" class="text-xl" />
        {{ block.title }}
      </button>
    </div>

    <div flex="~ row items-center gap-4 wrap" pb-2 text-sm>
      <div flex="~ row items-center gap-2">
        <span text="neutral-400 dark:neutral-500" font-medium>{{ $t('settings.pages.providers.filters.pricing') }}:</span>
        <div flex="~ row items-center gap-1" bg="neutral-100 dark:neutral-800" rounded-lg p-0.5>
          <button
            v-for="opt in ['all', 'free', 'paid'] as const"
            :key="opt"
            rounded-md px-2 py-0.5 transition-all
            :class="filterPricing === opt ? 'bg-white dark:bg-neutral-700 shadow-sm text-primary-600 dark:text-primary-400 font-semibold' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
            @click="filterPricing = opt"
          >
            {{ $t(`settings.pages.providers.filters.${opt}`) }}
          </button>
        </div>
      </div>

      <div flex="~ row items-center gap-2">
        <span text="neutral-400 dark:neutral-500" font-medium>{{ $t('settings.pages.providers.filters.deployment') }}:</span>
        <div flex="~ row items-center gap-1" bg="neutral-100 dark:neutral-800" rounded-lg p-0.5>
          <button
            v-for="opt in ['all', 'local', 'cloud'] as const"
            :key="opt"
            rounded-md px-2 py-0.5 transition-all
            :class="filterDeployment === opt ? 'bg-white dark:bg-neutral-700 shadow-sm text-primary-600 dark:text-primary-400 font-semibold' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
            @click="filterDeployment = opt"
          >
            {{ $t(`settings.pages.providers.filters.${opt}`) }}
          </button>
        </div>
      </div>
    </div>

    <RippleGrid
      :sections="providerBlocks"
      :get-items="block => block.providers"
      :columns="{ default: 1, sm: 2, xl: 3 }"
      :origin-index="lastClickedIndex"
      @item-click="({ globalIndex }) => setLastClickedIndex(globalIndex)"
    >
      <template #header="{ section: block }">
        <div mb-1 flex="~ row items-center gap-2">
          <div :id="block.id" :class="block.icon" text="neutral-500 dark:neutral-400 4xl" />
          <div>
            <div>
              <span text="neutral-400 dark:neutral-500 sm sm:base">{{ block.description }}</span>
            </div>
            <div flex text-nowrap text-2xl font-semibold>
              <div>
                {{ block.title }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #item="{ item: provider }">
        <IconStatusItem
          :title="provider.localizedName || 'Unknown'"
          :description="provider.localizedDescription"
          :icon="provider.icon"
          :icon-color="provider.iconColor"
          :icon-image="provider.iconImage"
          :to="`/settings/providers/${provider.category === 'vision' ? 'chat' : provider.category}/${provider.id}`"
          :configured="provider.configured"
          :pricing="provider.pricing as any"
          :deployment="provider.deployment as any"
          :beginner-recommended="provider.beginnerRecommended"
          @click="trackProviderClick(provider.id, provider.category)"
        />
      </template>
    </RippleGrid>
  </div>
  <div
    v-motion
    text="neutral-500/5 dark:neutral-600/20" pointer-events-none
    fixed top="[calc(100dvh-15rem)]" bottom-0 right--5 z--1
    :initial="{ scale: 0.9, opacity: 0, y: 20 }"
    :enter="{ scale: 1, opacity: 1, y: 0 }"
    :duration="500"
    size-60
    flex items-center justify-center
  >
    <div text="60" i-solar:box-minimalistic-bold-duotone />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.providers.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.providers.description
  icon: i-solar:box-minimalistic-bold-duotone
  settingsEntry: true
  order: 6
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
