<script setup lang="ts">
import { IconStatusItem, RippleGrid } from '@proj-airi/stage-ui/components'
import { ModelCacheManager } from '@proj-airi/stage-ui/components/scenarios/settings'
import { useAnalytics } from '@proj-airi/stage-ui/composables'
import { useRippleGridState } from '@proj-airi/stage-ui/composables/use-ripple-grid-state'
import { formatBytes, getModelCacheSize } from '@proj-airi/stage-ui/libs/inference'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSyncEngineStore } from '@proj-airi/stage-ui/stores/sync-engine'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const providersStore = useProvidersStore()
const artistryStore = useArtistryStore()
const syncEngineStore = useSyncEngineStore()
const { lastClickedIndex, setLastClickedIndex } = useRippleGridState()
const { trackProviderClick } = useAnalytics()

const {
  allChatProvidersMetadata,
  allAudioSpeechProvidersMetadata,
  allAudioTranscriptionProvidersMetadata,
  allVisionProvidersMetadata,
  allSystem1ProvidersMetadata,
  configuredProviders,
} = storeToRefs(providersStore)

const allCloudProvidersMetadata = computed(() => {
  return [
    {
      id: 'local-fs',
      category: 'cloud',
      icon: 'i-solar:folder-with-files-bold-duotone',
      iconColor: 'text-amber-500',
      name: 'Local File System',
      localizedName: 'Local File System / Samba',
      description: 'Synchronize data to a local path or mounted Samba network share.',
      localizedDescription: 'Synchronize data to a local path or mounted Samba network share.',
      configured: !!syncEngineStore.fsBackupPath,
      to: '/settings/providers/cloud/local-fs',
      pricing: 'free',
      deployment: 'local',
      beginnerRecommended: true,
      iconImage: undefined,
    },
    {
      id: 's3',
      category: 'cloud',
      icon: 'i-solar:cloud-bold-duotone',
      iconColor: 'text-blue-500',
      name: 'S3-Compatible Cloud Storage',
      localizedName: 'S3-Compatible Cloud Storage',
      description: 'Synchronize data to Cloudflare R2, AWS S3, Backblaze B2, or MinIO.',
      localizedDescription: 'Synchronize data to Cloudflare R2, AWS S3, Backblaze B2, or MinIO.',
      configured: !!(syncEngineStore.s3Endpoint && syncEngineStore.s3Bucket && syncEngineStore.s3AccessKeyId && syncEngineStore.s3SecretAccessKey),
      to: '/settings/providers/cloud/s3',
      pricing: 'free',
      deployment: 'cloud',
      beginnerRecommended: false,
      iconImage: undefined,
    },
  ]
})

const allArtistryProvidersMetadata = computed(() => {
  return [
    {
      id: 'pollinations',
      category: 'artistry',
      icon: 'i-solar:magic-stick-3-bold-duotone',
      iconColor: 'text-emerald-500',
      name: 'Pollinations AI',
      localizedName: 'Pollinations AI',
      description: 'Zero-config free cloud image generator with optional Pollen key.',
      localizedDescription: 'Zero-config free cloud image generator with optional Pollen key.',
      configured: true,
      to: '/settings/providers/artistry/pollinations',
      pricing: 'free',
      deployment: 'cloud',
      beginnerRecommended: true,
      iconImage: undefined,
    },
    {
      id: 'comfyui',
      category: 'artistry',
      icon: 'i-solar:gallery-bold-duotone',
      iconColor: 'text-indigo-500',
      name: 'ComfyUI',
      localizedName: 'ComfyUI',
      description: 'Local image generation runner.',
      localizedDescription: 'Local image generation runner.',
      configured: !!artistryStore.comfyuiServerUrl,
      to: '/settings/providers/artistry/comfyui',
      pricing: 'free',
      deployment: 'local',
      beginnerRecommended: true,
      iconImage: undefined,
    },
    {
      id: 'replicate',
      category: 'artistry',
      icon: 'i-lobe-icons:replicate',
      iconColor: 'i-lobe-icons:replicate-color',
      name: 'Replicate',
      localizedName: 'Replicate',
      description: 'Cloud-based model inference service.',
      localizedDescription: 'Cloud-based model inference service.',
      configured: !!artistryStore.replicateApiKey,
      to: '/settings/providers/artistry/replicate',
      pricing: 'paid',
      deployment: 'cloud',
      beginnerRecommended: false,
      iconImage: undefined,
    },
    {
      id: 'nanobanana',
      category: 'artistry',
      icon: 'i-solar:gallery-round-bold-duotone',
      iconColor: 'text-amber-500',
      name: 'Nano Banana',
      localizedName: 'Nano Banana',
      description: 'Google AI Studio Image Preview.',
      localizedDescription: 'Google AI Studio Image Preview.',
      configured: !!artistryStore.nanobananaApiKey,
      to: '/settings/providers/artistry/nanobanana',
      pricing: 'free',
      deployment: 'cloud',
      beginnerRecommended: false,
      iconImage: undefined,
    },
    {
      id: 'openai-image',
      category: 'artistry',
      icon: 'i-solar:gallery-bold-duotone',
      name: t('settings.pages.providers.provider.openai-image.title'),
      localizedName: t('settings.pages.providers.provider.openai-image.title'),
      description: t('settings.pages.providers.provider.openai-image.description'),
      localizedDescription: t('settings.pages.providers.provider.openai-image.description'),
      configured: !!artistryStore.openaiImageApiKey.trim(),
      to: '/settings/providers/artistry/openai-image',
      pricing: 'paid',
      deployment: 'cloud',
      iconImage: undefined,
    },
    {
      id: 'cloudflare',
      category: 'artistry',
      icon: 'i-simple-icons:cloudflare',
      iconColor: 'text-orange-500',
      name: t('settings.pages.providers.provider.cloudflare-image.title', 'Cloudflare Workers AI'),
      localizedName: t('settings.pages.providers.provider.cloudflare-image.title', 'Cloudflare Workers AI'),
      description: t('settings.pages.providers.provider.cloudflare-image.description', 'Free serverless neural image generation (FLUX, Leonardo, SDXL, DreamShaper).'),
      localizedDescription: t('settings.pages.providers.provider.cloudflare-image.description', 'Free serverless neural image generation (FLUX, Leonardo, SDXL, DreamShaper).'),
      configured: Boolean(artistryStore.getEffectiveCloudflareCredentials().accountId && artistryStore.getEffectiveCloudflareCredentials().apiToken),
      to: '/settings/providers/artistry/cloudflare',
      pricing: 'free',
      deployment: 'cloud',
      beginnerRecommended: true,
      iconImage: undefined,
    },
  ]
})

const allMotionProvidersMetadata = computed(() => {
  return [
    {
      id: 'flowmdm',
      category: 'motion',
      icon: 'i-solar:running-bold-duotone',
      iconColor: 'text-purple-500',
      name: 'FlowMDM',
      localizedName: 'FlowMDM (Local WebGPU)',
      description: 'On-device 3D motion diffusion using CLIP text encoding + ONNX WebGPU.',
      localizedDescription: 'On-device 3D motion diffusion using CLIP text encoding + ONNX WebGPU.',
      configured: true,
      to: '/settings/providers/motion/flowmdm',
      pricing: 'free',
      deployment: 'local',
      beginnerRecommended: true,
      iconImage: undefined,
    },
  ]
})

const providerBlocksConfig = [
  {
    id: 'chat',
    icon: 'i-solar:chat-square-like-bold-duotone',
    title: 'Chat',
    description: 'Text generation model providers. e.g. OpenRouter, OpenAI, Ollama.',
    providersRef: allChatProvidersMetadata,
  },
  {
    id: 'speech',
    icon: 'i-solar:user-speak-rounded-bold-duotone',
    title: 'Speech',
    description: 'Speech (text-to-speech) model providers. e.g. ElevenLabs, Azure Speech.',
    providersRef: allAudioSpeechProvidersMetadata,
  },
  {
    id: 'transcription',
    icon: 'i-solar:microphone-3-bold-duotone',
    title: 'Hearing',
    description: 'Hearing (speech-to-text) model providers. e.g. Whisper.cpp, OpenAI, Azure Speech.',
    providersRef: allAudioTranscriptionProvidersMetadata,
  },
  {
    id: 'artistry',
    icon: 'i-solar:palette-bold-duotone',
    title: 'Artistry',
    description: 'Image generation and design model providers. e.g. ComfyUI, Replicate.',
    providersRef: allArtistryProvidersMetadata,
  },
  {
    id: 'vision',
    icon: 'i-solar:eye-scan-bold-duotone',
    title: 'Vision',
    description: 'Vision-Language model providers. e.g. OpenRouter, OpenAI, Ollama.',
    providersRef: allVisionProvidersMetadata,
  },
  {
    id: 'motion',
    icon: 'i-solar:running-bold-duotone',
    title: 'Motion',
    description: 'Motion generation model providers. e.g. FlowMDM (Local WebGPU).',
    providersRef: allMotionProvidersMetadata,
  },
  {
    id: 'system1',
    icon: 'i-solar:cpu-bolt-bold-duotone',
    title: 'System 1',
    description: 'Ultra-fast cognitive coprocessors and classifiers for zero-shot query triage, batched candidate reranking, and affective heuristics.',
    providersRef: allSystem1ProvidersMetadata,
  },
  {
    id: 'cloud',
    icon: 'i-solar:cloud-bold-duotone',
    title: 'Cloud & Storage',
    description: 'Storage adapters for backups and multi-device database/asset sync.',
    providersRef: allCloudProvidersMetadata,
  },
]

const activeTabId = ref(providerBlocksConfig[0].id)
const filterPricing = ref<'all' | 'free' | 'paid'>('all')
const filterDeployment = ref<'all' | 'local' | 'cloud'>('all')

const activeTabRecommendations = computed(() => {
  const category = activeTabId.value
  const title = t(`settings.pages.providers.onboarding.${category}.title`)
  const description = t(`settings.pages.providers.onboarding.${category}.description`)

  if (!title || title.includes(category))
    return null

  return {
    title,
    description,
    badge: t('settings.pages.providers.onboarding.start_here'),
  }
})

const modelCacheSize = ref(0)
const isCacheLoading = ref(true)
const isTargetHighlighted = ref(false)

async function refreshCacheSize() {
  try {
    modelCacheSize.value = await getModelCacheSize()
  }
  finally {
    isCacheLoading.value = false
  }
}

function scrollToCacheManager() {
  const el = document.getElementById('model-cache-oversight')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    isTargetHighlighted.value = true
    setTimeout(() => {
      isTargetHighlighted.value = false
    }, 2000)
  }
}

onMounted(() => {
  refreshCacheSize()
  if (route.hash) {
    const hashId = route.hash.replace('#', '')
    if (providerBlocksConfig.some(b => b.id === hashId)) {
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
    .filter(block => block.id === activeTabId.value)
    .map((block) => {
      const filteredProviders = block.providersRef.value
        .filter((p) => {
          if (filterPricing.value !== 'all' && p.pricing !== filterPricing.value)
            return false
          if (filterDeployment.value !== 'all' && p.deployment !== filterDeployment.value)
            return false
          return true
        })
        .map(provider => ({
          ...provider,
          configured: (provider as any).configured ?? !!configuredProviders.value[provider.id],
          renderIndex: globalIndex++,
        }))

      return {
        id: block.id,
        icon: block.icon,
        title: block.title,
        description: block.description,
        providers: filteredProviders,
      }
    })
})
</script>

<template>
  <div mb-6 flex flex-col gap-5>
    <!-- Free AI Hub Spotlight Banner -->
    <div
      :class="[
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border transition-all',
        'bg-gradient-to-r from-primary-500/10 via-amber-500/5 to-transparent',
        'border-primary-500/25 dark:border-primary-500/35',
        'shadow-sm',
      ]"
    >
      <div class="flex items-center gap-3.5">
        <div class="h-11 w-11 flex shrink-0 items-center justify-center rounded-xl bg-primary-500/15 text-2xl text-primary-600 dark:text-primary-400">
          <div class="i-solar:magic-stick-3-bold-duotone" />
        </div>
        <div class="flex flex-col gap-0.5">
          <div class="flex items-center gap-2">
            <h3 class="text-base text-neutral-900 font-bold tracking-tight dark:text-neutral-100">
              Free AI Catalog & Model Hub
            </h3>
            <span class="rounded-full bg-amber-500/20 px-2 py-0.2 text-[10px] text-amber-700 font-bold tracking-wider uppercase dark:text-amber-300">
              New
            </span>
          </div>
          <p class="max-w-xl text-xs text-neutral-600 dark:text-neutral-400">
            Browse 370+ free model endpoints across 24 providers with real-time rate limits, intelligence & speed rankings, and operational advisories.
          </p>
        </div>
      </div>

      <RouterLink
        to="/settings/providers/free-hub"
        class="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs text-white font-semibold shadow-sm transition-all hover:bg-primary-600 hover:shadow"
      >
        <span>Explore Free Hub</span>
        <div class="i-solar:arrow-right-linear text-sm" />
      </RouterLink>
    </div>

    <!-- Recommendations & Quick Model Cache Overview (Responsive Split) -->
    <div class="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
      <!-- Active Tab Recommendations (8/12 on lg, 9/12 on xl) -->
      <div
        v-if="activeTabRecommendations"
        :class="[
          'lg:col-span-8 xl:col-span-9',
          'bg-primary-500/10 dark:bg-primary-800/25',
          'border-1 border-primary-500/20',
          'rounded-2xl p-5 flex flex-col justify-between',
        ]"
      >
        <div>
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
            :class="['text-primary-700 dark:text-primary-300 text-xs sm:text-sm leading-relaxed']"
            v-html="activeTabRecommendations.description"
          />
        </div>
      </div>

      <!-- Quick Model Cache Status Widget -->
      <div
        :class="[
          activeTabRecommendations ? 'lg:col-span-4 xl:col-span-3' : 'lg:col-span-12',
          'flex flex-col justify-between gap-3 p-4 rounded-2xl border transition-all',
          'bg-neutral-500/5 dark:bg-neutral-800/30',
          'border-neutral-200 dark:border-neutral-800/80',
        ]"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <div class="h-9 w-9 flex shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-lg text-sky-600 dark:text-sky-400">
              <div class="i-solar:server-square-bold-duotone" />
            </div>
            <div class="flex flex-col">
              <span class="text-sm text-neutral-900 font-bold leading-tight tracking-tight dark:text-neutral-100">
                {{ $t('settings.pages.providers.cache.title') }}
              </span>
              <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
                {{ $t('settings.pages.providers.cache.subtitle') }}
              </span>
            </div>
          </div>

          <!-- Total size badge -->
          <div
            v-if="!isCacheLoading"
            :class="[
              'rounded-full px-2.5 py-0.8 text-xs font-semibold shrink-0',
              modelCacheSize > 0
                ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                : 'bg-neutral-200/60 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
            ]"
          >
            {{ formatBytes(modelCacheSize) }}
          </div>
        </div>

        <div class="pt-1">
          <button
            type="button"
            class="shadow-xs w-full inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-neutral-200/70 px-3 py-1.5 text-xs text-neutral-700 font-semibold transition-all active:scale-98 dark:bg-neutral-800/80 hover:bg-neutral-200/90 dark:text-neutral-200 dark:hover:bg-neutral-700/80"
            @click="scrollToCacheManager"
          >
            <span>{{ $t('settings.pages.providers.cache.manage') }}</span>
            <div class="i-solar:arrow-down-linear text-xs" />
          </button>
        </div>
      </div>
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
          :to="`/settings/providers/${activeTabId === 'system1' ? 'system1' : provider.category === 'vision' ? (provider.id === 'mirage-local' ? 'vision' : 'chat') : provider.category}/${provider.id}`"
          :configured="provider.configured"
          :pricing="provider.pricing as any"
          :deployment="provider.deployment as any"
          :beginner-recommended="provider.beginnerRecommended"
          @click="trackProviderClick(provider.id, provider.category)"
        />
      </template>
    </RippleGrid>

    <div
      id="model-cache-oversight"
      mt-6 max-w-2xl
      class="rounded-xl transition-all duration-500"
      :class="isTargetHighlighted ? 'ring-2 ring-primary-500 ring-offset-4 ring-offset-neutral-900/10 dark:ring-offset-neutral-900' : ''"
    >
      <ModelCacheManager @change="refreshCacheSize" />
    </div>
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
