import type { BeatSyncDetectorState } from '@proj-airi/stage-shared/beat-sync'

import { getBeatSyncState, listenBeatSyncStateChange } from '@proj-airi/stage-shared/beat-sync'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import factorioIcon from '../assets/factorio-simple.png'

import { useArtistryStore } from '../stores/modules/artistry'
import { useConsciousnessStore } from '../stores/modules/consciousness'
import { useDiscordStore } from '../stores/modules/discord'
import { useFactorioStore } from '../stores/modules/gaming-factorio'
import { useHearingStore } from '../stores/modules/hearing'
import { useSpeechStore } from '../stores/modules/speech'
import { useSystemOneStore } from '../stores/modules/system-one'
import { useTwitterStore } from '../stores/modules/twitter'
import { useVisionStore } from '../stores/modules/vision'
import { useSyncEngineStore } from '../stores/sync-engine'

export interface Module {
  id: string
  name: string
  description: string
  icon?: string
  iconColor?: string
  iconImage?: string
  to: string
  configured: boolean
  category: string
}

export function useModulesList() {
  const { t } = useI18n()

  // Initialize stores
  const consciousnessStore = useConsciousnessStore()
  const systemOneStore = useSystemOneStore()
  const speechStore = useSpeechStore()
  const hearingStore = useHearingStore()
  const discordStore = useDiscordStore()
  const twitterStore = useTwitterStore()
  const factorioStore = useFactorioStore()
  const artistryStore = useArtistryStore()
  const visionStore = useVisionStore()
  const syncEngineStore = useSyncEngineStore()
  const beatSyncState = ref<BeatSyncDetectorState>()

  const modulesList = computed<Module[]>(() => [
    {
      id: 'consciousness',
      name: t('settings.pages.modules.consciousness.title'),
      description: t('settings.pages.modules.consciousness.description'),
      icon: 'i-solar:ghost-bold-duotone',
      to: '/settings/modules/consciousness',
      configured: consciousnessStore.configured,
      category: 'essential',
    },
    {
      id: 'system-one',
      name: t('settings.pages.modules.system-one.title', 'System 1 Coprocessor'),
      description: t('settings.pages.modules.system-one.description', 'High-speed cognitive coprocessor for zero-shot query triage, batched candidate reranking, and affective heuristics'),
      icon: 'i-solar:cpu-bolt-bold-duotone',
      to: '/settings/modules/system-one',
      configured: systemOneStore.configured,
      category: 'essential',
    },
    {
      id: 'speech',
      name: t('settings.pages.modules.speech.title'),
      description: t('settings.pages.modules.speech.description'),
      icon: 'i-solar:user-speak-rounded-bold-duotone',
      to: '/settings/modules/speech',
      configured: speechStore.configured,
      category: 'essential',
    },
    {
      id: 'artistry',
      name: t('settings.pages.modules.artistry.title'),
      description: t('settings.pages.modules.artistry.description'),
      icon: 'i-iconify-heroicons:photo',
      to: '/settings/modules/artistry',
      configured: artistryStore.configured,
      category: 'essential',
    },
    {
      id: 'hearing',
      name: t('settings.pages.modules.hearing.title'),
      description: t('settings.pages.modules.hearing.description'),
      icon: 'i-solar:microphone-3-bold-duotone',
      to: '/settings/modules/hearing',
      configured: hearingStore.configured,
      category: 'essential',
    },
    {
      id: 'vision',
      name: t('settings.pages.modules.vision.title'),
      description: t('settings.pages.modules.vision.description'),
      icon: 'i-solar:eye-closed-bold-duotone',
      to: '/settings/modules/vision',
      configured: visionStore.configured,
      category: 'essential',
    },
    {
      id: 'text-to-motion',
      name: 'Text to Motion',
      description: 'Configure 3D motion generation provider & procedural acting engine.',
      icon: 'i-solar:running-round-bold-duotone',
      to: '/settings/modules/text-to-motion',
      configured: true,
      category: 'essential',
    },
    {
      id: 'memory-short-term',
      name: t('settings.pages.modules.memory-short-term.title'),
      description: t('settings.pages.modules.memory-short-term.description'),
      icon: 'i-solar:bookmark-bold-duotone',
      to: '/settings/modules/memory-short-term',
      configured: false,
      category: 'essential',
    },
    {
      id: 'memory-long-term',
      name: t('settings.pages.modules.memory-long-term.title'),
      description: t('settings.pages.modules.memory-long-term.description'),
      icon: 'i-solar:book-bookmark-bold-duotone',
      to: '/settings/modules/memory-long-term',
      configured: false,
      category: 'essential',
    },
    {
      id: 'messaging-discord',
      name: t('settings.pages.modules.messaging-discord.title'),
      description: t('settings.pages.modules.messaging-discord.description'),
      icon: 'i-simple-icons:discord',
      to: '/settings/modules/messaging-discord',
      configured: discordStore.configured,
      category: 'messaging',
    },
    {
      id: 'messaging-friends',
      name: t('settings.pages.modules.messaging-friends.title'),
      description: t('settings.pages.modules.messaging-friends.description'),
      icon: 'i-solar:users-group-two-rounded-bold-duotone',
      to: '/settings/modules/messaging-friends',
      configured: true,
      category: 'messaging',
    },
    {
      id: 'x',
      name: t('settings.pages.modules.x.title'),
      description: t('settings.pages.modules.x.description'),
      icon: 'i-simple-icons:x',
      to: '/settings/modules/x',
      configured: twitterStore.configured,
      category: 'messaging',
    },
    {
      id: 'gaming-factorio',
      name: t('settings.pages.modules.gaming-factorio.title'),
      description: t('settings.pages.modules.gaming-factorio.description'),
      iconImage: factorioIcon,
      to: '/settings/modules/gaming-factorio',
      configured: factorioStore.configured,
      category: 'gaming',
    },
    {
      id: 'mcp-server',
      name: t('settings.pages.modules.mcp-server.title'),
      description: t('settings.pages.modules.mcp-server.description'),
      icon: 'i-solar:server-bold-duotone',
      to: '/settings/modules/mcp',
      configured: false,
      category: 'essential',
    },
    {
      id: 'beat-sync',
      name: t('settings.pages.modules.beat_sync.title'),
      description: t('settings.pages.modules.beat_sync.description'),
      icon: 'i-solar:music-notes-bold-duotone',
      to: '/settings/modules/beat-sync',
      configured: beatSyncState.value?.isActive ?? false,
      category: 'essential',
    },
    {
      id: 'motion-choreography',
      name: t('settings.pages.modules.motion_choreography.title', 'Motion Choreography'),
      description: t('settings.pages.modules.motion_choreography.description', 'Acoustic DSP rhythm analysis, FlowMDM 3D dance synthesis, and elastic beat-warp conductor'),
      icon: 'i-solar:music-library-2-bold-duotone',
      to: '/settings/modules/motion-choreography',
      configured: true,
      category: 'essential',
    },
    {
      id: 'cloud-sync',
      name: 'Cloud Sync',
      description: 'Synchronize database and assets.',
      icon: 'i-solar:cloud-bold-duotone',
      to: '/settings/modules/cloud-sync',
      configured: syncEngineStore.syncEnabled,
      category: 'essential',
    },
  ])

  const categorizedModules = computed(() => {
    return modulesList.value.reduce((categories, module) => {
      const { category } = module
      if (!categories[category]) {
        categories[category] = []
      }
      categories[category].push(module)
      return categories
    }, {} as Record<string, Module[]>)
  })

  // Define category display names
  const categoryNames = computed(() => ({
    essential: t('settings.pages.modules.categories.essential'),
    messaging: t('settings.pages.modules.categories.messaging'),
    gaming: t('settings.pages.modules.categories.gaming'),
  }))

  // TODO(Makito): We can make this a reactive value from a synthetic store.
  onMounted(() => {
    getBeatSyncState().then(initialState => beatSyncState.value = initialState)
    const removeListener = listenBeatSyncStateChange(newState => beatSyncState.value = { ...newState })
    onUnmounted(() => removeListener())
  })

  return {
    modulesList,
    categorizedModules,
    categoryNames,
  }
}
