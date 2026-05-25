import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import {
  isWithinSchedule,
  visionCaptureScreen,
  visionCheckPermission,
  visionRequestPermission,
} from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useChatOrchestratorStore } from '../chat'
import { useProvidersStore } from '../providers'
import { useAiriCardStore } from './airi-card'
import { useLiveSessionStore } from './live-session'

export const useVisionStore = defineStore('vision', () => {
  const providersStore = useProvidersStore()
  const chatOrchestrator = useChatOrchestratorStore()

  // State
  const activeProvider = useLocalStorageManualReset<string>('settings/vision/active-provider', '')
  const activeModel = useLocalStorageManualReset<string>('settings/vision/active-model', '')
  const contextWindow = useLocalStorageManualReset<number>('settings/vision/context-window', 1) // Number of images to include in context
  const promptShim = useLocalStorageManualReset<string>(
    'settings/vision/prompt-shim',
    'You are currently acting as a vision-capable stand-in for the main character. Keep your responses natural, in-character, and avoid any meta-commentary about "analyzing" or "describing" the image for the user. Just react to what you see as the character would.',
  )

  // Witness (Proactive Ambient Vision)
  // NOTICE: Vision no longer self-polls. The proactivity heartbeat drives vision captures
  // when the Live API is active. isWitnessEnabled acts as a guard flag checked by proactivity.
  const isWitnessEnabled = useLocalStorageManualReset<boolean>('settings/vision/witness-enabled', false)
  const witnessPrompt = useLocalStorageManualReset<string>(
    'settings/vision/witness-prompt',
    "Carefully observe the user's screen and describe any interesting or relevant details you see, focusing on things that might spark a conversation or help you understand the user's current context better. Stay in character.",
  )
  const respectSchedule = useLocalStorageManualReset<boolean>('settings/vision/respect-schedule', true)
  const status = ref<'idle' | 'capturing'>('idle')
  const lastWitnessTime = ref<number>(0)
  const lastWitnessAnalysis = ref<string>('')
  const lastHeartbeatExec = useLocalStorageManualReset<number>('settings/vision/last-heartbeat', 0)

  const airiCardStore = useAiriCardStore()
  const { activeCard } = storeToRefs(airiCardStore)

  const captureInvoke = useElectronEventaInvoke(visionCaptureScreen)
  const checkPermissionInvoke = useElectronEventaInvoke(visionCheckPermission)
  const requestPermissionInvoke = useElectronEventaInvoke(visionRequestPermission)

  /**
   * Checks if the app has screen recording permissions on macOS.
   * Returns 'granted' on non-macOS platforms.
   */
  async function checkPermissions() {
    try {
      // In renderer, we use the IPC handler to check via systemPreferences
      const status = await checkPermissionInvoke()
      console.log('[Vision Store] macOS Screen Capture Permission Status:', status)
      return status
    } catch (err) {
      console.warn('[Vision Store] Failed to check macOS permissions (likely non-macOS):', err)
      return 'granted' // Fallback for non-macOS
    }
  }

  /**
   * Opens the macOS System Settings for Screen Recording.
   */
  async function openPermissionSettings() {
    await requestPermissionInvoke()
  }

  // Heartbeat Logic
  const heartbeat = async (options?: { force?: boolean }) => {
    const liveSessionStore = useLiveSessionStore()
    console.log('[Vision Store] Heartbeat checking...', {
      force: !!options?.force,
      isActive: liveSessionStore.isActive,
      isWitnessEnabled: isWitnessEnabled.value,
    })

    // Master Gate Check: if the session is not active, we never capture.
    if (!liveSessionStore.isActive) {
      console.log('[Vision Store] Heartbeat aborted: Master Gate (Live API) is OFF.')
      return
    }

    if (!isWitnessEnabled.value && !options?.force) return

    // Throttle duplicate executions across multiple independent Electron renderer windows.
    // Each window runs its own `useIntervalFn`, meaning they can easily drift out of sync.
    const now = Date.now()

    if (!options?.force) {
      // Background interval: enforce the full interval duration minus a small 10s drift buffer
      const intervalMs = 2 * 60 * 1000 // Minimum cooldown between captures
      if (now - lastHeartbeatExec.value < intervalMs - 10000) {
        console.log(
          `[Vision Store] Background heartbeat skipped. Next allowed in ${intervalMs - (now - lastHeartbeatExec.value)}ms due to cross-window sync.`,
        )
        return
      }
    } else {
      // Manual trigger: enforce a small 15-second debounce to prevent spam clicks and IPC echo
      if (now - lastHeartbeatExec.value < 15000) {
        console.log(`[Vision Store] Forced heartbeat throttled (15s cooldown).`)
        return
      }
    }

    // Lock the execution time so other windows respect this cycle
    lastHeartbeatExec.value = now

    // Schedule check (only if respectSchedule is enabled)
    const config = activeCard.value?.extensions?.airi?.heartbeats
    if (!options?.force && respectSchedule.value && config?.schedule?.start && config.schedule.end) {
      const inWindow = isWithinSchedule(config.schedule.start, config.schedule.end)
      if (!inWindow) {
        console.log(
          `[Vision Store] Heartbeat skipped: Outside schedule window (${config.schedule.start} - ${config.schedule.end})`,
        )
        return
      }
      console.log(`[Vision Store] Heartbeat inside schedule window (${config.schedule.start} - ${config.schedule.end})`)
    }

    console.log('[Vision Store] Heartbeat pulse starting...')
    status.value = 'capturing'

    try {
      const result = (await captureSnapshot({ height: 720, width: 1280 })) as any

      if (result?.error === 'permission_denied') {
        console.error('[Vision Store] Heartbeat: Screen capture failed due to permissions.')
        toast.error('Vision failed: Camera/Screen permissions required.', {
          action: { label: 'Fix', onClick: () => openPermissionSettings() },
        })
        return
      }

      if (result?.dataUrl) {
        console.log('[Vision Store] Heartbeat: Screen capture successful!')
        lastWitnessTime.value = result.timestamp

        // Send to Gemini via Chat Orchestrator
        console.log('[Vision Store] Sending screenshot to Chat Orchestrator for commentary...')
        const base64 = result.dataUrl.split(',')[1]

        await chatOrchestrator.ingest(witnessPrompt.value, {
          attachments: [
            {
              data: base64,
              mimeType: 'image/png',
              type: 'image',
            },
          ],
        })
      } else {
        console.warn('[Vision Store] Heartbeat: Screen capture failed or returned no data.')
      }
    } catch (err) {
      console.error('[Vision Store] Heartbeat error:', err)
    } finally {
      status.value = 'idle'
      console.log('[Vision Store] Heartbeat pulse complete.')
    }
  }

  /**
   * Captures a single snapshot of the screen via IPC.
   * This is a "clean" capture that doesn't trigger ambient vision processing (ingestion).
   */
  async function captureSnapshot(options?: { width?: number; height?: number }) {
    console.log('[Vision Store] captureSnapshot requested...')

    // 1. Permission Check (macOS only)
    const permission = await checkPermissions()
    if (permission === 'denied' || permission === 'restricted') {
      console.error('[Vision Store] Screen capture permission is DENIED.')
      return { error: 'permission_denied' }
    }

    console.log('[Vision Store] Invoking OS screen capture via Eventa...')
    try {
      const result = await captureInvoke({
        height: options?.height || 720,
        width: options?.width || 1280,
      })

      if (!result || !result.dataUrl) {
        console.warn('[Vision Store] captureInvoke returned null or empty data.')
      }

      return result
    } catch (err) {
      console.error('[Vision Store] captureSnapshot error:', err)
      return null
    }
  }

  function toggleWitness() {
    console.log('[Vision Store] toggleWitness() called. Current:', isWitnessEnabled.value)
    isWitnessEnabled.value = !isWitnessEnabled.value
    console.log('[Vision Store] toggleWitness() new state:', isWitnessEnabled.value)
  }

  // Computed properties
  const supportsModelListing = computed(() => {
    return providersStore.getProviderMetadata(activeProvider.value)?.capabilities.listModels !== undefined
  })

  const providerModels = computed(() => {
    return providersStore.getModelsForProvider(activeProvider.value)
  })

  const isLoadingActiveProviderModels = computed(() => {
    return providersStore.isLoadingModels[activeProvider.value] || false
  })

  const activeProviderModelError = computed(() => {
    return providersStore.modelLoadError[activeProvider.value] || null
  })

  function resetModelSelection() {
    activeModel.reset()
  }

  async function loadModelsForProvider(provider: string) {
    if (provider && providersStore.getProviderMetadata(provider)?.capabilities.listModels !== undefined) {
      await providersStore.fetchModelsForProvider(provider)
    }
  }

  async function getModelsForProvider(provider: string) {
    if (provider && providersStore.getProviderMetadata(provider)?.capabilities.listModels !== undefined) {
      return providersStore.getModelsForProvider(provider)
    }

    return []
  }

  const configured = computed(() => {
    return !!activeProvider.value && !!activeModel.value
  })

  function resetState() {
    activeProvider.reset()
    resetModelSelection()
    contextWindow.reset()
  }

  // Self-healing: Reset active provider if it no longer exists
  watch(
    activeProvider,
    () => {
      if (
        Object.keys(providersStore.providerMetadata).length > 0 &&
        activeProvider.value &&
        !providersStore.providerMetadata[activeProvider.value]
      ) {
        console.warn(`[Vision] Provider ${activeProvider.value} no longer exists. Resetting.`)
        activeProvider.value = ''
        resetModelSelection()
      }
    },
    { immediate: true },
  )

  return {
    activeModel,
    activeProvider,
    activeProviderModelError,
    captureSnapshot,
    checkPermissions,
    // State
    configured,
    contextWindow,
    getModelsForProvider,
    heartbeat,
    isLoadingActiveProviderModels,

    // Witness
    isWitnessEnabled,
    lastWitnessAnalysis,
    lastWitnessTime,
    loadModelsForProvider,
    openPermissionSettings,
    promptShim,
    providerModels,

    // Actions
    resetModelSelection,
    resetState,
    respectSchedule,
    status,

    // Computed
    supportsModelListing,
    toggleWitness,
    witnessPrompt,
  }
})
