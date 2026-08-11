<script setup lang="ts">
import { defineInvokeHandler } from '@moeru/eventa'
import { useElectronEventaContext, useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { themeColorFromValue, useThemeColor } from '@proj-airi/stage-layouts/composables/theme-color'
import { debug } from '@proj-airi/stage-shared'
import { ToasterRoot } from '@proj-airi/stage-ui/components'
import { useSharedAnalyticsStore } from '@proj-airi/stage-ui/stores/analytics'
import { useBackupStore } from '@proj-airi/stage-ui/stores/backup'
import { useCharacterOrchestratorStore } from '@proj-airi/stage-ui/stores/character'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { usePluginHostInspectorStore } from '@proj-airi/stage-ui/stores/devtools/plugin-host-debug'
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
import { useSyncEngineStore } from '@proj-airi/stage-ui/stores/sync-engine'
import { useTheme } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, watch } from 'vue'
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
  electronSettingsNavigate,
  electronShowToastEvent,
  electronStartTrackMousePosition,
  electronWindowSetTitle,
  i18nSetLocale,
  pluginProtocolListProviders,
  pluginProtocolListProvidersEventName,
} from '../shared/eventa'
import { useServerChannelSettingsStore } from './stores/settings/server-channel'
import { builtinTools } from './stores/tools/builtin'

const { isDark: dark } = useTheme()
const i18n = useI18n()
const contextBridgeStore = useContextBridgeStore()
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
  console.info('[TextJournal] Seeded entry via window.seedTextJournalEntry()', entry)
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

const initialHash = typeof window !== 'undefined' ? window.location.hash : ''

const isMainWindow = computed(() => {
  if (typeof window === 'undefined')
    return false
  return initialHash === '' || initialHash === '#/' || initialHash === '#'
})

onMounted(async () => {
  const startupAt = performance.now()
  const logStep = (label: string) => {
    console.info(`[PipelineTTS:App] ${label} (+${Math.round(performance.now() - startupAt)}ms)`)
  }

  logStep('onMounted start')

  // Load server channel config at the very beginning so the token is correct before any WebSocket client initializes
  logStep('Requesting server channel config')
  const serverChannelConfig = await getServerChannelConfig().catch((err: any) => {
    console.error('[PipelineTTS:App] FAILED server channel config:', err)
    return {} as any
  })
  logStep('Received server channel config')
  serverChannelSettingsStore.websocketTlsConfig = serverChannelConfig.websocketTlsConfig
  serverChannelSettingsStore.authToken = serverChannelConfig.authToken
  serverChannelSettingsStore.hostname = serverChannelConfig.hostname

  // Synchronize keys so the shared connection store reads the correct one immediately
  if (serverChannelConfig.authToken) {
    localStorage.setItem('settings/connection/auth-token', serverChannelConfig.authToken)
  }

  // Safety net: if localStorage was wiped by an OOM crash or force-close, restore any
  // missing keys from the IndexedDB backup before any store reads their values.
  // This is non-destructive — it only writes keys that are currently absent.
  // If sync was enabled and the /Volumes share is mounted, a background full reconcile
  // will also run to pull back any IndexedDB-only data (airi-cards, chat sessions, etc.).
  logStep('Restoring missing settings from IndexedDB backup')
  await useSyncEngineStore().initializeFromLocalBackup()

  // NOTICE: Infrastructure vs Service ordering.
  // We initialize the Context Bridge FIRST to ensure cross-window communication is established
  // before any potentially blocking or slow subsystems (like models or server channels) are started.
  // This prevents a hang in a high-level service from "deafening" the window to token broadcasts.
  logStep('Initializing context bridge')
  await contextBridgeStore.initialize().catch((err: any) => console.error('[PipelineTTS:App] FAILED context bridge init:', err))

  if (isMainWindow.value) {
    proactivityStore.registerTools(builtinTools)
    proactivityStore.startHeartbeatLoop()
  }

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
  // TEMPORARY ISOLATION TEST: Disabled eager catalog scan at boot (stage model init handles active model)
  // await displayModelsStore.loadDisplayModelsFromIndexedDB()
  logStep('Initializing stage model')
  await settingsStore.initializeStageModel().catch((err: any) => console.error('[PipelineTTS:App] FAILED stage model init:', err))
  logStep('Stage model initialized')

  logStep('Initializing server channel store')
  await serverChannelStore.initialize({
    possibleEvents: ['ui:configure'],
    token: serverChannelSettingsStore.authToken,
  }).catch((err: any) => console.error('[PipelineTTS:App] FAILED server channel store init:', err))

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
    debug('[App] Auto-backup condition met. Triggering backup...')
    void backupStore.triggerBackup()
  }

  // Listen for open-settings IPC message from main process
  defineInvokeHandler(context.value, electronOpenSettings, payload => router.push(payload?.route || '/settings'))

  if (typeof window !== 'undefined' && (window as any).electron) {
    if (typeof (window as any).electron.ipcRenderer.removeAllListeners === 'function') {
      ;(window as any).electron.ipcRenderer.removeAllListeners('dating-sim-toggle')
    }
  }

  // Listen for custom toast notifications from main process
  watch(context, (ctx) => {
    if (!ctx || isMainWindow.value)
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
    ctx.on(electronSettingsNavigate, (event) => {
      const payload = event?.body
      if (payload?.route) {
        debug('[Settings] Navigating to:', payload.route)
        router.push(payload.route)
      }
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
      debug('[AppTitle] Updating settings title', {
        from: document.title,
        to: nextTitle,
        route: route.path,
      })
      document.title = nextTitle
    }
  },
  { immediate: true },
)

const ROUTE_TITLES: Record<string, string> = {
  '/': 'AIRI - Control Strip',
  '/chat': 'AIRI - Chat Window',
  '/actor': 'AIRI - Looking at {character}',
  '/caption': 'AIRI - Captions',
  '/customizer': 'AIRI - Customizer',
  '/about': 'AIRI - About',
  '/onboarding': 'AIRI - Onboarding',
  '/widgets': 'AIRI - Widgets',
}

watch(
  () => {
    return [route.path, activeCard.value?.name]
  },
  () => {
    if (route.path.startsWith('/settings') || route.path === '/chat')
      return

    const activeCharacterLabel = activeCard.value?.name?.trim() || 'AIRI'
    const titleTemplate = ROUTE_TITLES[route.path] || 'AIRI - Looking at {character}'
    const nextTitle = titleTemplate.replace('{character}', activeCharacterLabel)

    if (document.title !== nextTitle) {
      debug('[AppTitle] Updating main title', {
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

// Renderer is the single source of truth for the visible title (the route watchers
// above mutate `document.title`); report it to the main process so the native OS
// chrome stays in sync instead of relying on the static BrowserWindow constructor
// `title`, which desyncs as soon as a route changes.
const reportWindowTitle = useElectronEventaInvoke(electronWindowSetTitle)
let lastReportedTitle: string | undefined
watch(
  () => document.title,
  (title) => {
    if (title === lastReportedTitle)
      return
    lastReportedTitle = title
    void reportWindowTitle({ title })
  },
  { immediate: true, flush: 'post' },
)

onUnmounted(() => {
  contextBridgeStore.dispose()
  clearMcpToolBridge()
  proactivityStore.stopHeartbeatLoop()
})
</script>

<template>
  <ToasterRoot v-if="!isMainWindow" @close="id => toast.dismiss(id)">
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
