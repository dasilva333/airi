<script setup lang="ts">
import { defineInvokeHandler } from '@moeru/eventa'
import { useElectronEventaContext, useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { themeColorFromValue, useThemeColor } from '@proj-airi/stage-layouts/composables/theme-color'
import { ToasterRoot } from '@proj-airi/stage-ui/components'
import { useSharedAnalyticsStore } from '@proj-airi/stage-ui/stores/analytics'
import { useBackupStore } from '@proj-airi/stage-ui/stores/backup'
import { useCharacterOrchestratorStore } from '@proj-airi/stage-ui/stores/character'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { usePluginHostInspectorStore } from '@proj-airi/stage-ui/stores/devtools/plugin-host-debug'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { clearMcpToolBridge, setMcpToolBridge } from '@proj-airi/stage-ui/stores/mcp-tool-bridge'
import { useShortTermMemoryStore } from '@proj-airi/stage-ui/stores/memory-short-term'
import { useTextJournalStore } from '@proj-airi/stage-ui/stores/memory-text-journal'
import { useModsServerChannelStore } from '@proj-airi/stage-ui/stores/mods/api/channel-server'
import { useContextBridgeStore } from '@proj-airi/stage-ui/stores/mods/api/context-bridge'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useDiscordStore } from '@proj-airi/stage-ui/stores/modules/discord'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { usePerfTracerBridgeStore } from '@proj-airi/stage-ui/stores/perf-tracer-bridge'
import { listProvidersForPluginHost, shouldPublishPluginHostCapabilities } from '@proj-airi/stage-ui/stores/plugin-host-capabilities'
import { useProactivityStore } from '@proj-airi/stage-ui/stores/proactivity'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { useTheme } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { toast, Toaster } from 'vue-sonner'

import ResizeHandler from './components/ResizeHandler.vue'

import {
  electronGetServerChannelConfig,
  electronMcpCallTool,
  electronMcpGetRuntimeStatus,
  electronMcpListTools,
  electronOpenOnboarding,
  electronOpenSettings,
  electronPluginInspect,
  electronPluginList,
  electronPluginLoad,
  electronPluginLoadEnabled,
  electronPluginSetEnabled,
  electronPluginUnload,
  electronPluginUpdateCapability,
  electronShowToastEvent,
  electronStartTrackMousePosition,
  i18nSetLocale,
  pluginProtocolListProviders,
  pluginProtocolListProvidersEventName,
} from '../shared/eventa'
import { useServerChannelSettingsStore } from './stores/settings/server-channel'
import { builtinTools } from './stores/tools/builtin'

const { isDark: dark } = useTheme()
const i18n = useI18n()
const contextBridgeStore = useContextBridgeStore()
const displayModelsStore = useDisplayModelsStore()
const settingsStore = useSettings()
const { language, themeColorsHue, themeColorsHueDynamic } = storeToRefs(settingsStore)
const serverChannelSettingsStore = useServerChannelSettingsStore()
const onboardingStore = useOnboardingStore()
const router = useRouter()
const route = useRoute()
const cardStore = useAiriCardStore()
const { activeCard } = storeToRefs(cardStore)
const chatSessionStore = useChatSessionStore()
const serverChannelStore = useModsServerChannelStore()
const characterOrchestratorStore = useCharacterOrchestratorStore()
const analyticsStore = useSharedAnalyticsStore()
const pluginHostInspectorStore = usePluginHostInspectorStore()
const discordStore = useDiscordStore()
const textJournalStore = useTextJournalStore()
const shortTermMemoryStore = useShortTermMemoryStore()
const backupStore = useBackupStore()
usePerfTracerBridgeStore()

const proactivityStore = useProactivityStore()

async function seedTextJournalEntryFromWindow() {
  await textJournalStore.load()
  const entry = await textJournalStore.seedActiveCharacterEntry()
  console.log('[TextJournal] Seeded entry via window.seedTextJournalEntry()', entry)
  return entry
}

async function ensureYesterdayShortTermBlockForActiveCharacter() {
  if (!cardStore.activeCardId)
    return

  try {
    await shortTermMemoryStore.ensureYesterdayBlock(cardStore.activeCardId)
  }
  catch (error) {
    console.warn('[ShortTermMemory] Failed to auto-generate yesterday block.', error)
  }
}

Object.assign(window as Window & typeof globalThis, {
  seedTextJournalEntry: seedTextJournalEntryFromWindow,
})

const context = useElectronEventaContext()
const getServerChannelConfig = useElectronEventaInvoke(electronGetServerChannelConfig)
const listPlugins = useElectronEventaInvoke(electronPluginList)
const setPluginEnabled = useElectronEventaInvoke(electronPluginSetEnabled)
const loadEnabledPlugins = useElectronEventaInvoke(electronPluginLoadEnabled)
const loadPlugin = useElectronEventaInvoke(electronPluginLoad)
const unloadPlugin = useElectronEventaInvoke(electronPluginUnload)
const inspectPluginHost = useElectronEventaInvoke(electronPluginInspect)
const startTrackingCursorPoint = useElectronEventaInvoke(electronStartTrackMousePosition)
const reportPluginCapability = useElectronEventaInvoke(electronPluginUpdateCapability)
const listMcpTools = useElectronEventaInvoke(electronMcpListTools)
const callMcpTool = useElectronEventaInvoke(electronMcpCallTool)
const getMcpRuntimeStatus = useElectronEventaInvoke(electronMcpGetRuntimeStatus)
const setLocale = useElectronEventaInvoke(i18nSetLocale)
const openOnboarding = useElectronEventaInvoke(electronOpenOnboarding)

// NOTICE: register plugin host bridge during setup to avoid race with pages using it in immediate watchers.
pluginHostInspectorStore.setBridge({
  list: () => listPlugins(),
  setEnabled: payload => setPluginEnabled(payload),
  loadEnabled: () => loadEnabledPlugins(),
  load: payload => loadPlugin(payload),
  unload: payload => unloadPlugin(payload),
  inspect: () => inspectPluginHost(),
})

// NOTICE: MCP tools are declared from stage-ui and executed during model streaming.
// Register runtime bridge during setup to avoid missing bridge in early tool invocations.
setMcpToolBridge({
  listTools: () => listMcpTools(),
  callTool: payload => callMcpTool(payload),
  getRuntimeStatus: () => getMcpRuntimeStatus(),
})

watch(language, () => {
  i18n.locale.value = language.value
  setLocale(language.value)
})

const { updateThemeColor } = useThemeColor(themeColorFromValue({ light: 'rgb(255 255 255)', dark: 'rgb(18 18 18)' }))
watch(dark, () => updateThemeColor(), { immediate: true })
watch(route, () => updateThemeColor(), { immediate: true })
onMounted(() => updateThemeColor())

onMounted(async () => {
  const startupAt = performance.now()
  const logStep = (label: string) => {
    console.log(`[PipelineTTS:App] ${label} (+${Math.round(performance.now() - startupAt)}ms)`)
  }

  logStep('onMounted start')

  // NOTICE: Infrastructure vs Service ordering.
  // We initialize the Context Bridge FIRST to ensure cross-window communication is established
  // before any potentially blocking or slow subsystems (like models or server channels) are started.
  // This prevents a hang in a high-level service from "deafening" the window to token broadcasts.
  logStep('Initializing context bridge')
  await contextBridgeStore.initialize().catch((err: any) => console.error('[PipelineTTS:App] FAILED context bridge init:', err))

  proactivityStore.registerTools(builtinTools)
  proactivityStore.startHeartbeatLoop()

  logStep('Initializing Analytics & Card stores')
  analyticsStore.initialize()
  cardStore.initialize()
  await textJournalStore.load()

  logStep('Initializing chat session')
  await chatSessionStore.initialize()
  logStep('Loading short-term memory')
  await shortTermMemoryStore.load()
  logStep('Checking yesterday short-term block')
  await ensureYesterdayShortTermBlockForActiveCharacter()
  logStep('Loading display models')
  await displayModelsStore.loadDisplayModelsFromIndexedDB()
  logStep('Initializing stage model')
  await settingsStore.initializeStageModel().catch((err: any) => console.error('[PipelineTTS:App] FAILED stage model init:', err))
  logStep('Stage model initialized')

  logStep('Requesting server channel config')
  const serverChannelConfig = await getServerChannelConfig().catch((err: any) => {
    console.error('[PipelineTTS:App] FAILED server channel config:', err)
    return {} as any
  })
  logStep('Received server channel config')
  serverChannelSettingsStore.websocketTlsConfig = serverChannelConfig.websocketTlsConfig
  serverChannelSettingsStore.authToken = serverChannelConfig.authToken
  serverChannelSettingsStore.hostname = serverChannelConfig.hostname

  logStep('Initializing server channel store')
  await serverChannelStore.initialize({ possibleEvents: ['ui:configure'] }).catch((err: any) => console.error('[PipelineTTS:App] FAILED server channel store init:', err))

  logStep('Initializing character orchestrator')
  characterOrchestratorStore.initialize()

  logStep('Starting cursor tracking')
  await startTrackingCursorPoint().catch((err: any) => console.error('[PipelineTTS:App] FAILED cursor tracking init:', err))
  logStep('App Startup Complete')
  // Startup initialization complete

  // Expose stage provider definitions to plugin host APIs.
  defineInvokeHandler(context.value, pluginProtocolListProviders, async () => listProvidersForPluginHost())

  if (shouldPublishPluginHostCapabilities()) {
    await reportPluginCapability({
      key: pluginProtocolListProvidersEventName,
      state: 'ready',
      metadata: {
        source: 'stage-ui',
      },
    })
  }

  // Auto-start Discord service if previously enabled and token is configured
  if (discordStore.enabled && discordStore.configured) {
    discordStore.startService()
  }

  // Auto-backup check (every 24 hours)
  if (backupStore.isBackupEnabled && Date.now() - backupStore.lastBackupTime > 24 * 60 * 60 * 1000) {
    console.log('[App] Auto-backup condition met. Triggering backup...')
    void backupStore.triggerBackup()
  }

  // Listen for open-settings IPC message from main process
  defineInvokeHandler(context.value, electronOpenSettings, payload => router.push(payload?.route || '/settings'))

  // Listen for custom toast notifications from main process
  watch(context, (ctx) => {
    if (!ctx)
      return
    ctx.on(electronShowToastEvent, (event) => {
      const payload = event?.body
      if (!payload)
        return
      toast(payload.message, {
        description: payload.description,
        duration: payload.duration || 4000,
      })
    })
  }, { immediate: true })
})

watch(themeColorsHue, () => {
  document.documentElement.style.setProperty('--chromatic-hue', themeColorsHue.value.toString())
}, { immediate: true })

watch(themeColorsHueDynamic, () => {
  document.documentElement.classList.toggle('dynamic-hue', themeColorsHueDynamic.value)
}, { immediate: true })

watch(
  () => cardStore.activeCardId,
  async (nextCardId, previousCardId) => {
    if (!nextCardId || nextCardId === previousCardId)
      return

    await ensureYesterdayShortTermBlockForActiveCharacter()
  },
)

watch(
  () => {
    return [route.path, route.meta.titleKey, route.meta.title]
  },
  () => {
    if (!route.path.startsWith('/settings'))
      return

    const titleKey = typeof route.meta.titleKey === 'string' ? route.meta.titleKey : undefined
    const rawTitle = typeof route.meta.title === 'string' ? route.meta.title : undefined
    const resolvedTitle = titleKey ? i18n.t(titleKey) : rawTitle
    const parts = ['AIRI', 'Settings']

    if (resolvedTitle && resolvedTitle !== i18n.t('settings.title'))
      parts.push(resolvedTitle)

    const nextTitle = parts.join(' - ')

    if (document.title !== nextTitle) {
      console.log('[AppTitle] Updating settings title', {
        from: document.title,
        to: nextTitle,
        route: route.path,
      })
      document.title = nextTitle
    }
  },
  { immediate: true },
)

watch(
  () => {
    return [route.path, activeCard.value?.name]
  },
  () => {
    if (route.path.startsWith('/settings') || route.path === '/chat')
      return

    const activeCharacterLabel = activeCard.value?.name?.trim() || 'AIRI'
    const nextTitle = `AIRI - Looking at ${activeCharacterLabel}`

    if (document.title !== nextTitle) {
      console.log('[AppTitle] Updating main title', {
        from: document.title,
        to: nextTitle,
        route: route.path,
        activeCharacterLabel,
      })
      document.title = nextTitle
    }
  },
  { immediate: true },
)

watch(() => onboardingStore.needsOnboarding, () => {
  if (onboardingStore.needsOnboarding) {
    openOnboarding()
  }
}, { immediate: true })

onUnmounted(() => {
  contextBridgeStore.dispose()
  clearMcpToolBridge()
  proactivityStore.stopHeartbeatLoop()
})
</script>

<template>
  <ToasterRoot @close="id => toast.dismiss(id)">
    <Toaster position="top-right" />
  </ToasterRoot>
  <ResizeHandler />
  <RouterView />
</template>

<style>
/* We need this to properly animate the CSS variable */
@property --chromatic-hue {
  syntax: '<number>';
  initial-value: 0;
  inherits: true;
}

@keyframes hue-anim {
  from {
    --chromatic-hue: 0;
  }
  to {
    --chromatic-hue: 360;
  }
}

.dynamic-hue {
  animation: hue-anim 10s linear infinite;
}
</style>
