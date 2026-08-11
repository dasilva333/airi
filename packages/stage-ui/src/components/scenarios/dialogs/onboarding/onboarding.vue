<script setup lang="ts">
import type { ProviderMetadata } from '../../../../stores/providers'
import type {
  OnboardingStep,
  OnboardingStepGuard,
  OnboardingStepNextHandler,
  OnboardingStepPrevHandler,
  ProviderConfigData,
} from './types'

import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import StepCharacterSelection from './step-character-selection.vue'
import StepEasySetup from './step-easy-setup.vue'
import StepGoogleOAuth from './step-google-oauth.vue'
import StepManualAdapter from './step-manual-adapter.vue'
import StepModeSelection from './step-mode-selection.vue'
import StepModelSelection from './step-model-selection.vue'
import StepProviderConfiguration from './step-provider-configuration.vue'
import StepProviderResolver from './step-provider-resolver.vue'
import StepProviderSelection from './step-provider-selection.vue'
import StepSelectiveSync from './step-selective-sync.vue'
import StepStartChoice from './step-start-choice.vue'
import StepSyncOptions from './step-sync-options.vue'
import StepSyncProgress from './step-sync-progress.vue'
import StepWelcome from './step-welcome.vue'

import { fetchSession } from '../../../../libs/auth'
import { useAuthStore } from '../../../../stores/auth'
import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../../stores/modules/consciousness'
import { useHearingStore } from '../../../../stores/modules/hearing'
import { useSpeechStore } from '../../../../stores/modules/speech'
import { useProvidersStore } from '../../../../stores/providers'
import { useSyncEngineStore } from '../../../../stores/sync-engine'

interface Emits {
  (e: 'configured'): void
  (e: 'skipped'): void
}

const { extraSteps = [] } = defineProps<{
  extraSteps?: OnboardingStep[]
}>()
const emit = defineEmits<Emits>()
const step = ref(0)
const direction = ref<'next' | 'previous'>('next')
const pendingProviderConfig = ref<ProviderConfigData | null>(null)
const onboardingMode = ref<'easy' | 'custom'>('easy')
const onboardingPath = ref<'new' | 'returning'>('new')
const returningMethod = ref<'google' | 'manual'>('google')
const isGoogleAuthenticated = ref(false)
const isGoogleLinking = ref(false)

const providersStore = useProvidersStore()
const { providers, allChatProvidersMetadata, addedProviders } = storeToRefs(providersStore)
const consciousnessStore = useConsciousnessStore()
const speechStore = useSpeechStore()
const hearingStore = useHearingStore()
const airiCardStore = useAiriCardStore()

const {
  activeProvider,
} = storeToRefs(consciousnessStore)

async function configureEasyMode(data: any) {
  if (!data)
    return

  // 1. Configure OpenRouter (Consciousness)
  if (data.openrouter) {
    const orKey = data.openrouter.trim()
    // Ensure we have the base config with defaults (like baseUrl)
    const defaultConfig = providersStore.getDefaultProviderConfig('openrouter-ai')

    // Set credentials first
    providers.value['openrouter-ai'] = {
      ...defaultConfig,
      ...providers.value['openrouter-ai'],
      apiKey: orKey,
    }
    addedProviders.value['openrouter-ai'] = true

    // Now force it as configured. This will cache the new apiKey hash.
    providersStore.forceProviderConfigured('openrouter-ai')

    // Trigger lazy fetching so models are ready for selection
    void providersStore.fetchModelsForProvider('openrouter-ai')
  }

  // 2. Configure Deepgram (Speech & Hearing)
  if (data.deepgram) {
    const dgKey = data.deepgram.trim()

    // Setup TTS credentials
    const dgtConfig = providersStore.getDefaultProviderConfig('deepgram-tts')
    providers.value['deepgram-tts'] = {
      ...dgtConfig,
      ...providers.value['deepgram-tts'],
      apiKey: dgKey,
    }
    providersStore.forceProviderConfigured('deepgram-tts')

    // Setup Transcription credentials
    const dgSttConfig = providersStore.getDefaultProviderConfig('deepgram-transcription')
    providers.value['deepgram-transcription'] = {
      ...dgSttConfig,
      ...providers.value['deepgram-transcription'],
      apiKey: dgKey,
    }
    providersStore.forceProviderConfigured('deepgram-transcription')

    // Trigger lazy fetching
    void providersStore.fetchModelsForProvider('deepgram-tts')
    void providersStore.fetchModelsForProvider('deepgram-transcription')
  }

  // CRITICAL: Wait for the providersStore to propagate the "configured" status
  // before we try to set them as active in the module stores.
  await nextTick()
  // Wait a tiny bit more for cross-window sync if needed (though nextTick + persistent store should be enough)
  await new Promise(resolve => setTimeout(resolve, 50))

  // 3. Assign Modules
  if (data.openrouter) {
    consciousnessStore.activeProvider = 'openrouter-ai'
    consciousnessStore.activeModel = 'openrouter/free'
  }

  if (data.deepgram) {
    // Set Active Speech
    speechStore.activeSpeechProvider = 'deepgram-tts'
    speechStore.activeSpeechModel = 'aura-2'
    speechStore.activeSpeechVoiceId = 'aura-asteria-en'

    // Set Active Hearing
    hearingStore.activeTranscriptionProvider = 'deepgram-transcription'
    hearingStore.activeTranscriptionModel = 'nova-3'
  }

  // Final save
  await nextTick()
}

const availableProviders = computed(() => {
  const preferredOrder = ['openai', 'anthropic', 'amazon-bedrock', 'google-generative-ai', 'groq', 'nvidia', 'openrouter-ai', 'ollama', 'deepseek', 'player2', 'openai-compatible']
  const preferredProviders = allChatProvidersMetadata.value
    .filter(provider => preferredOrder.includes(provider.id))
    .sort((a, b) => preferredOrder.indexOf(a.id) - preferredOrder.indexOf(b.id))
  const remainingProviders = allChatProvidersMetadata.value
    .filter(provider => !preferredOrder.includes(provider.id))
    .sort((a, b) => (a.localizedName || a.name || a.id).localeCompare(b.localizedName || b.name || b.id))

  return [...preferredProviders, ...remainingProviders]
})

// Selected provider and form data
const selectedProviderId = ref('')
const selectedCharacterId = ref('default')

// Computed selected provider
const selectedProvider = computed(() => {
  return allChatProvidersMetadata.value.find(p => p.id === selectedProviderId.value) || null
})

// Reset validation state when provider changes
function selectProvider(provider: ProviderMetadata) {
  selectedProviderId.value = provider.id
}

const requestPreviousStep: OnboardingStepPrevHandler = () => {
  return navigatePrevious()
}

const requestNextStep: OnboardingStepNextHandler = async (configData?: ProviderConfigData | any) => {
  pendingProviderConfig.value = configData ?? null
  await navigateNext(configData)
}

function requestSkipStep() {
  emit('skipped')
}

async function saveProviderConfiguration(data: ProviderConfigData) {
  if (!selectedProvider.value)
    return

  const config: Record<string, unknown> = {}

  if (data.apiKey)
    config.apiKey = data.apiKey.trim()
  if (data.baseUrl)
    config.baseUrl = data.baseUrl.trim()
  if (data.accountId)
    config.accountId = data.accountId.trim()
  if (data.accessKeyId)
    config.accessKeyId = data.accessKeyId.trim()
  if (data.secretAccessKey)
    config.secretAccessKey = data.secretAccessKey.trim()
  if (data.region)
    config.region = data.region.trim()

  providers.value[selectedProvider.value.id] = {
    ...providers.value[selectedProvider.value.id],
    ...config,
  }

  activeProvider.value = selectedProvider.value.id
  await nextTick()

  try {
    await consciousnessStore.loadModelsForProvider(selectedProvider.value.id)
  }
  catch (err) {
    console.error('error', err)
  }
}

async function handleSave() {
  localStorage.removeItem('airi-onboarding-state')
  emit('configured')
  window.location.reload()
}

// Persist onboarding state to localStorage so redirects do not lose user context
function saveOnboardingState() {
  localStorage.setItem('airi-onboarding-state', JSON.stringify({
    step: step.value,
    onboardingMode: onboardingMode.value,
    onboardingPath: onboardingPath.value,
    returningMethod: returningMethod.value,
    isGoogleAuthenticated: isGoogleAuthenticated.value,
    isGoogleLinking: isGoogleLinking.value,
    pendingProviderConfig: pendingProviderConfig.value,
    selectedProviderId: selectedProviderId.value,
    selectedCharacterId: selectedCharacterId.value,
  }))
}

watch([step, onboardingMode, onboardingPath, returningMethod, isGoogleAuthenticated, isGoogleLinking, pendingProviderConfig, selectedProviderId, selectedCharacterId], () => {
  saveOnboardingState()
}, { deep: true })

const authStore = useAuthStore()

onMounted(async () => {
  // 1. Force check google session callback on load (even if sync isn't fully enabled yet)
  try {
    const hasActiveSync = localStorage.getItem('settings/privacy/remote-sync-enabled') === 'true'
    if (hasActiveSync) {
      await fetchSession()
    }
  }
  catch (err) {
    console.error('Failed to fetch authentication session:', err)
  }

  if (authStore.isAuthenticated) {
    isGoogleAuthenticated.value = true
  }

  // 2. Restore onboarding progress
  const saved = localStorage.getItem('airi-onboarding-state')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      step.value = parsed.step ?? 0
      onboardingMode.value = parsed.onboardingMode ?? 'easy'
      onboardingPath.value = parsed.onboardingPath ?? 'new'
      returningMethod.value = parsed.returningMethod ?? 'google'
      isGoogleAuthenticated.value = parsed.isGoogleAuthenticated || authStore.isAuthenticated || isGoogleAuthenticated.value
      isGoogleLinking.value = parsed.isGoogleLinking ?? false
      pendingProviderConfig.value = parsed.pendingProviderConfig ?? null
      selectedProviderId.value = parsed.selectedProviderId ?? ''
      selectedCharacterId.value = parsed.selectedCharacterId ?? 'default'
    }
    catch (e) {
      console.error('Failed to parse onboarding state', e)
    }
  }
})

const allSteps = computed<OnboardingStep[]>(() => {
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      component: StepWelcome,
    },
    {
      id: 'start-choice',
      component: StepStartChoice,
      props: () => ({
        onSelectPath: (path: 'new' | 'returning') => {
          onboardingPath.value = path
        },
      }),
    },
  ]

  if (onboardingPath.value === 'new') {
    steps.push({
      id: 'mode-selection',
      component: StepModeSelection,
      props: () => ({
        onSelectMode: (mode: 'easy' | 'custom') => {
          onboardingMode.value = mode
        },
      }),
    })

    if (onboardingMode.value === 'easy') {
      steps.push({
        id: 'easy-setup',
        component: StepEasySetup,
        beforeNext: async (data: any) => {
          await configureEasyMode(data)
          return true
        },
      })
    }
    else if (onboardingMode.value === 'custom') {
      steps.push(
        {
          id: 'provider-selection',
          component: StepProviderSelection,
          props: () => ({
            selectedProviderId: selectedProviderId.value,
            availableProviders: availableProviders.value,
            onSelectProvider: selectProvider,
          }),
        },
        {
          id: 'provider-configuration',
          component: StepProviderConfiguration,
          props: () => ({
            selectedProviderId: selectedProviderId.value,
            selectedProvider: selectedProvider.value,
          }),
          beforeNext: async () => {
            if (!pendingProviderConfig.value)
              return false

            await saveProviderConfiguration(pendingProviderConfig.value)
            pendingProviderConfig.value = null
            return true
          },
        },
        ...extraSteps.map(s => ({
          ...s,
          props: () => ({
            ...s.props?.(),
          }),
        })),
        {
          id: 'model-selection',
          component: StepModelSelection,
        },
      )
    }

    steps.push({
      id: 'character-selection',
      component: StepCharacterSelection,
      props: () => ({
        selectedCharacterId: selectedCharacterId.value,
        onSelectCharacter: (id: string) => {
          selectedCharacterId.value = id
        },
      }),
      beforeNext: async () => {
        await airiCardStore.seedDefaults(selectedCharacterId.value)
        await airiCardStore.activateCard(selectedCharacterId.value)
        return true
      },
    })
  }
  else {
    steps.push({
      id: 'sync-options',
      component: StepSyncOptions,
      props: () => ({
        onSelectMethod: (method: 'google' | 'manual') => {
          returningMethod.value = method
          isGoogleLinking.value = false
        },
      }),
    })

    if (returningMethod.value === 'google') {
      steps.push(
        {
          id: 'google-oauth',
          component: StepGoogleOAuth,
          beforeNext: async () => {
            isGoogleAuthenticated.value = true
            return true
          },
        },
        {
          id: 'provider-resolver',
          component: StepProviderResolver,
          beforeNext: async (data: any) => {
            if (data && data.manualFallback) {
              returningMethod.value = 'manual'
              step.value = 3 // index of manual-adapter in computed sequence
              return false // cancel default next navigation
            }

            // Set active provider and restore credentials based on selected backup target
            if (data && data.selectedBackupId) {
              const syncStore = useSyncEngineStore()
              try {
                const manifest = await syncStore.fetchGDriveManifest()
                const selected = (manifest.providers || []).find((p: any) => p.id === data.selectedBackupId)
                if (selected) {
                  syncStore.activeProvider = selected.type
                  if (selected.type === 's3') {
                    syncStore.s3Endpoint = selected.config.endpoint
                    syncStore.s3Bucket = selected.config.bucket
                    syncStore.s3Region = selected.config.region
                    syncStore.s3AccessKeyId = selected.config.accessKeyId
                    syncStore.s3SecretAccessKey = selected.config.secretAccessKey
                  }
                  else if (selected.type === 'local') {
                    syncStore.fsBackupPath = selected.config.path
                  }
                  console.log(`[Onboarding] Successfully resolved and restored cloud credentials for: ${selected.name}`)
                }
              }
              catch (err) {
                console.error('[Onboarding] Failed to restore credentials from Google AppData:', err)
              }
            }
            return true
          },
        },
      )
    }
    else {
      steps.push({
        id: 'manual-adapter',
        component: StepManualAdapter,
        beforeNext: async (data: any) => {
          if (!data)
            return false

          const syncStore = useSyncEngineStore()
          syncStore.activeProvider = data.adapterType
          if (data.adapterType === 's3') {
            syncStore.s3Endpoint = data.s3.endpoint
            syncStore.s3Bucket = data.s3.bucket
            syncStore.s3Region = data.s3.region
            syncStore.s3AccessKeyId = data.s3.accessKey
            syncStore.s3SecretAccessKey = data.s3.secretKey
          }
          else {
            syncStore.fsBackupPath = data.local.path
          }
          return true
        },
      })
    }

    steps.push(
      {
        id: 'selective-sync',
        component: StepSelectiveSync,
        props: () => ({
          isGoogleAuthenticated: isGoogleAuthenticated.value,
        }),
        beforeNext: async (data: any) => {
          const syncStore = useSyncEngineStore()
          if (data && data.checkedIds) {
            syncStore.selectiveSyncEnabled = true
            syncStore.selectiveCheckedIds = data.checkedIds
          }
          else {
            syncStore.selectiveSyncEnabled = false
          }
          isGoogleLinking.value = !!(data && data.saveToGoogle)
          return true
        },
      },
    )

    if (isGoogleLinking.value) {
      steps.push({
        id: 'google-oauth-link',
        component: StepGoogleOAuth,
        beforeNext: async () => {
          isGoogleAuthenticated.value = true

          try {
            const syncStore = useSyncEngineStore()
            // 1. Fetch current manifest from Google Drive AppData
            const manifest = await syncStore.fetchGDriveManifest()
            const providersList = manifest.providers || []

            // 2. Build current active provider configuration
            const newProvider = {
              id: syncStore.activeProvider === 's3' ? 's3-backup' : 'local-backup',
              name: syncStore.activeProvider === 's3' ? syncStore.s3Bucket || 's3-backup' : 'local-fs-archive',
              type: syncStore.activeProvider,
              config: syncStore.activeProvider === 's3'
                ? {
                    endpoint: syncStore.s3Endpoint,
                    bucket: syncStore.s3Bucket,
                    region: syncStore.s3Region,
                    accessKeyId: syncStore.s3AccessKeyId,
                    secretAccessKey: syncStore.s3SecretAccessKey,
                  }
                : {
                    path: syncStore.fsBackupPath,
                  },
              lastSync: new Date().toISOString(),
            }

            // 3. Filter out any existing provider with the same ID, append the new one, and save
            const updatedProviders = providersList.filter((p: any) => p.id !== newProvider.id)
            updatedProviders.push(newProvider)

            const success = await syncStore.saveGDriveManifest({
              version: '1.0',
              providers: updatedProviders,
            })

            if (success) {
              console.log('[Onboarding] Successfully saved credentials link to Google AppData.')
            }
            else {
              console.error('[Onboarding] Failed to save credentials link to Google AppData.')
            }
          }
          catch (err) {
            console.error('[Onboarding] Error during cloud linkage save:', err)
          }
          return true
        },
      })
    }

    steps.push({
      id: 'sync-progress',
      component: StepSyncProgress,
    })
  }

  return steps
})

const currentStep = computed(() => allSteps.value[step.value] ?? null)
const isLastStep = computed(() => step.value === allSteps.value.length - 1)
const currentStepProps = computed(() => currentStep.value?.props?.() ?? {})

async function canPassGuard(guard?: OnboardingStepGuard, data?: any) {
  if (!guard)
    return true

  return await guard(data)
}

async function navigateNext(data?: any) {
  if (!currentStep.value)
    return

  if (!(await canPassGuard(currentStep.value.beforeNext, data)))
    return

  if (isLastStep.value) {
    await handleSave()
    return
  }

  direction.value = 'next'
  step.value++
}

async function navigatePrevious() {
  if (!currentStep.value || step.value <= 0)
    return

  if (!(await canPassGuard(currentStep.value.beforePrev)))
    return

  direction.value = 'previous'
  step.value--
}
</script>

<template>
  <div class="onboarding-step-container h-full w-full">
    <Transition :name="direction === 'next' ? 'slide-next' : 'slide-prev'" mode="out-in">
      <component
        :is="currentStep.component"
        v-if="currentStep"
        :key="currentStep.id"
        v-bind="currentStepProps"
        :on-next="requestNextStep"
        :on-previous="requestPreviousStep"
        :on-skip="requestSkipStep"
      />
    </Transition>
  </div>
</template>

<style scoped>
.onboarding-step-container {
  overflow-x: hidden;
}

.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  will-change: transform, opacity;
}

.slide-next-enter-active {
  animation: onboarding-slide-next-in 0.2s ease-in-out both;
}

.slide-next-leave-active {
  animation: onboarding-slide-next-out 0.2s ease-in-out both;
}

.slide-prev-enter-active {
  animation: onboarding-slide-prev-in 0.2s ease-in-out both;
}

.slide-prev-leave-active {
  animation: onboarding-slide-prev-out 0.2s ease-in-out both;
}

@keyframes onboarding-slide-next-in {
  from {
    transform: translateX(2rem);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes onboarding-slide-next-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }

  to {
    transform: translateX(-2rem);
    opacity: 0;
  }
}

@keyframes onboarding-slide-prev-in {
  from {
    transform: translateX(-2rem);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes onboarding-slide-prev-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }

  to {
    transform: translateX(2rem);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .slide-next-enter-active,
  .slide-next-leave-active,
  .slide-prev-enter-active,
  .slide-prev-leave-active {
    animation-duration: 1ms;
  }
}
</style>
