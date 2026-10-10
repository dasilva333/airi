<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import {
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import SelectiveSyncPanel from '../../../../providers/selective-sync-panel.vue'
import CloudflareAccountHubDialog from '../../../cloudflare/CloudflareAccountHubDialog.vue'
import AssistantBubble from '../components/assistant-bubble.vue'

import { useAiriCardStore } from '../../../../../../stores/modules/airi-card'
import { useCloudflareStore } from '../../../../../../stores/modules/cloudflare'
import { useOnboardingStore } from '../../../../../../stores/onboarding'
import { useSyncEngineStore } from '../../../../../../stores/sync-engine'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
  onFinish?: () => void
}>()

const emit = defineEmits<{
  (e: 'previous'): void
  (e: 'next'): void
  (e: 'finish'): void
}>()

const { t } = useI18n()

const draftStore = useOnboardingV3Draft()
const cloudflareStore = useCloudflareStore()
const syncStore = useSyncEngineStore()
const cardStore = useAiriCardStore()
const onboardingStore = useOnboardingStore()

const { cfAccountId, isAuthenticating, isAuthenticated } = storeToRefs(cloudflareStore)

const viewMode = ref<'cards' | 'restore'>('cards')
const isTokenMode = ref(false)
const tokenInput = ref('')
const isValidatingToken = ref(false)
const isLoadingCatalog = ref(false)
const hasCheckedRemote = ref(false)
const remoteCardsCount = ref(0)
const isRestoring = ref(false)
const showHubDialog = ref(false)
const selectiveSyncPanelRef = ref<InstanceType<typeof SelectiveSyncPanel> | null>(null)

const selectedPath = computed<'local' | 'cloud'>({
  get: () => draftStore.state.architecture || 'local',
  set: (val) => {
    draftStore.setArchitecture(val)
  },
})

// 3 Consumer Bullets for Local Card
const localBullets = computed(() => [
  {
    icon: 'i-solar:disk-bold',
    title: t('onboarding.steps.triage.local.bullets.storage.title', 'On-device storage'),
    description: t('onboarding.steps.triage.local.bullets.storage.desc', 'Data stays in your local database.'),
  },
  {
    icon: 'i-solar:user-rounded-bold',
    title: t('onboarding.steps.triage.local.bullets.account.title', 'No account required'),
    description: t('onboarding.steps.triage.local.bullets.account.desc', 'Start without signing in.'),
  },
  {
    icon: 'i-solar:settings-minimalistic-bold',
    title: t('onboarding.steps.triage.local.bullets.setup.title', 'Simple local setup'),
    description: t('onboarding.steps.triage.local.bullets.setup.desc', 'Manage your companion on this device.'),
  },
])

// 3 Consumer Bullets for Cloud Card
const cloudBullets = computed(() => [
  {
    icon: 'i-solar:cloud-upload-bold',
    title: t('onboarding.steps.triage.cloud.bullets.sync.title', 'Backup & sync'),
    description: t('onboarding.steps.triage.cloud.bullets.sync.desc', 'Keep companion data across devices.'),
  },
  {
    icon: 'i-solar:stars-minimalistic-bold',
    title: t('onboarding.steps.triage.cloud.bullets.ai.title', 'Hosted AI access'),
    description: t('onboarding.steps.triage.cloud.bullets.ai.desc', 'Access daily edge AI credits.'),
  },
  {
    icon: 'i-solar:users-group-rounded-bold',
    title: t('onboarding.steps.triage.cloud.bullets.relay.title', 'Cloud relay'),
    description: t('onboarding.steps.triage.cloud.bullets.relay.desc', 'Use your companion through Discord.'),
  },
])

// Detailed Technical Specifications for Local Popover
const localDetails = computed(() => [
  {
    key: 'storage',
    icon: 'i-solar:database-bold',
    badge: 'IndexedDB & SQLite',
    title: t('onboarding.steps.triage.local.details.storage.title', 'On-Device Database Storage'),
    desc: t('onboarding.steps.triage.local.details.storage.desc', 'All companion cards, transcripts, and memory journals are stored strictly in your local IndexedDB and disk vaults. Zero data ever leaves your computer.'),
  },
  {
    key: 'telemetry',
    icon: 'i-solar:shield-check-bold',
    badge: '100% Air-Gapped',
    title: t('onboarding.steps.triage.local.details.telemetry.title', 'Zero Telemetry & Custody'),
    desc: t('onboarding.steps.triage.local.details.telemetry.desc', 'No accounts, no email addresses, no tracking cookies, and no telemetry pingbacks. Complete anonymity and zero-custody data sovereignty.'),
  },
  {
    key: 'compute',
    icon: 'i-solar:cpu-bolt-bold',
    badge: 'WebGPU & Local LLM',
    title: t('onboarding.steps.triage.local.details.compute.title', 'Bring-Your-Own Compute'),
    desc: t('onboarding.steps.triage.local.details.compute.desc', 'Run Kokoro TTS, Whisper STT, and Ollama / LM Studio / WebLLM completely offline using your device’s local CPU and GPU acceleration.'),
  },
  {
    key: 'export',
    icon: 'i-solar:card-2-bold',
    badge: 'CCv3 / PNG Chunks',
    title: t('onboarding.steps.triage.local.details.export.title', 'Portable Open Formats'),
    desc: t('onboarding.steps.triage.local.details.export.desc', 'Export your companions and memories anytime as standard PNG chunks or raw JSON. No proprietary format lock-in or cloud dependencies.'),
  },
])

// Detailed Technical Specifications for Cloud Popover
const cloudDetails = computed(() => [
  {
    key: 'storage',
    icon: 'i-solar:cloud-storage-bold-duotone',
    badge: 'Cloudflare R2',
    title: t('onboarding.steps.triage.cloud.features.storage.title', '10 GB Free Object Storage'),
    desc: t('onboarding.steps.triage.cloud.features.storage.whyItMatters', 'Generous free tier with zero egress fees. Safely backs up 3D/VRM vessels, Live2D assets, custom backgrounds, and entire memory hierarchies across devices.'),
  },
  {
    key: 'ai',
    icon: 'i-solar:cpu-bolt-bold-duotone',
    badge: 'Workers AI',
    title: t('onboarding.steps.triage.cloud.features.ai.title', '10,000 Free Daily Edge AI Credits'),
    desc: t('onboarding.steps.triage.cloud.features.ai.whyItMatters', 'Direct connection to Cloudflare’s global edge GPU fleet. Chat with DeepSeek-R1, Qwen 2.5, and Llama 3 without paid API keys or dedicated graphics cards.'),
  },
  {
    key: 'relay',
    icon: 'i-solar:chat-round-dots-bold-duotone',
    badge: '@proj-airi/stage-edge',
    title: t('onboarding.steps.triage.cloud.features.relay.title', '24/7 Discord Serverless Relay'),
    desc: t('onboarding.steps.triage.cloud.features.relay.whyItMatters', 'A serverless Cloudflare Worker keeps your companion awake in your Discord server 24/7, syncing conversations back to desktop when you reopen AIRI.'),
  },
  {
    key: 'sync',
    icon: 'i-solar:devices-bold-duotone',
    badge: 'Edge Key Vault',
    title: t('onboarding.steps.triage.cloud.features.sync.title', 'Multi-Device Sync & 1-Click Restore'),
    desc: t('onboarding.steps.triage.cloud.features.sync.whyItMatters', 'Encrypted Edge Key Vault securely synchronizes Desktop, Web, and Mobile companions, enabling one-click instant recovery on any new machine.'),
  },
  {
    key: 'proxy',
    icon: 'i-solar:shield-check-bold-duotone',
    badge: 'Edge Reverse Proxy',
    title: t('onboarding.steps.triage.cloud.features.proxy.title', 'Private CORS Proxy & Zero-Custody'),
    desc: t('onboarding.steps.triage.cloud.features.proxy.whyItMatters', 'Deploys a personal edge reverse proxy allowing Web and Pocket mobile stages to bypass browser CORS headers. Everything runs in your personal account.'),
  },
])

// Auto-switch to cloud and probe catalog if user is authenticated
watch(isAuthenticated, async (authed) => {
  if (authed) {
    if (selectedPath.value !== 'cloud') {
      selectedPath.value = 'cloud'
    }
    await restoreVaultCredentials()
    await probeRemoteCatalog()
  }
}, { immediate: true })

async function probeRemoteCatalog() {
  if (!isAuthenticated.value) {
    remoteCardsCount.value = 0
    return
  }
  isLoadingCatalog.value = true
  try {
    if (syncStore.activeProvider === 's3' && !syncStore.s3Bucket && cloudflareStore.isAuthenticated) {
      await cloudflareStore.autoRestoreEdgeVault()
    }
    const res = await syncStore.fetchRemoteSyncManifestCatalog()
    if (res && res.success) {
      remoteCardsCount.value = (res.cards || []).length
    }
  }
  catch (e) {
    console.warn('[StepTriage] Failed to probe remote catalog:', e)
  }
  finally {
    isLoadingCatalog.value = false
    hasCheckedRemote.value = true
  }
}

onMounted(() => {
  if (isAuthenticated.value) {
    void probeRemoteCatalog()
  }
})

async function restoreVaultCredentials() {
  if (!syncStore.s3Endpoint || !syncStore.s3Bucket) {
    try {
      const vault = await cloudflareStore.fetchFromEdgeVault()
      if (vault && vault.s3Endpoint && vault.s3Bucket) {
        syncStore.s3Endpoint = vault.s3Endpoint
        syncStore.s3Bucket = vault.s3Bucket
        syncStore.s3Region = vault.s3Region || 'auto'
        syncStore.s3AccessKeyId = vault.s3AccessKeyId || ''
        syncStore.s3SecretAccessKey = vault.s3SecretAccessKey || ''
        syncStore.activeProvider = 's3'
        syncStore.syncEnabled = true
        toast.info('Restored R2 Cloud Sync credentials from Edge Key Vault!')
      }
    }
    catch (e) {
      console.warn('[StepTriage] Failed to restore from Edge Vault:', e)
    }
  }
}

// User explicitly picks Local mode
function chooseLocal() {
  selectedPath.value = 'local'
  props.onNext()
}

// Start 1-Click OAuth PKCE
async function handleStartOAuth() {
  try {
    await cloudflareStore.authenticateWithCloudflare()
    selectedPath.value = 'cloud'
    toast.success('Successfully connected to Cloudflare!')
    await restoreVaultCredentials()
    await probeRemoteCatalog()
    if (remoteCardsCount.value === 0) {
      props.onNext()
    }
    else {
      viewMode.value = 'restore'
    }
  }
  catch (err: any) {
    toast.error(err?.message || 'Cloudflare authentication failed')
  }
}

function handleCancelAuth() {
  cloudflareStore.isAuthenticating = false
}

// Connect via API Token
async function handleConnectApiToken() {
  const clean = tokenInput.value.trim()
  if (!clean) {
    toast.error('Please enter a valid Cloudflare API token')
    return
  }
  isValidatingToken.value = true
  try {
    await cloudflareStore.verifyAndSetApiToken(clean)
    selectedPath.value = 'cloud'
    toast.success('Successfully connected Cloudflare API Token!')
    tokenInput.value = ''
    isTokenMode.value = false
    await restoreVaultCredentials()
    await probeRemoteCatalog()
    if (remoteCardsCount.value === 0) {
      props.onNext()
    }
    else {
      viewMode.value = 'restore'
    }
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to verify Cloudflare API token')
  }
  finally {
    isValidatingToken.value = false
  }
}

// User already signed in and continues with connected account
async function handleCloudContinue() {
  selectedPath.value = 'cloud'
  if (remoteCardsCount.value > 0) {
    viewMode.value = 'restore'
  }
  else {
    props.onNext()
  }
}

// Disconnect with confirmed safety prompt
function handleDisconnect(e?: Event) {
  e?.stopPropagation()
  const confirmed = window.confirm(
    'Are you sure you want to disconnect your Cloudflare account? Your local data will remain safe.',
  )
  if (!confirmed)
    return
  cloudflareStore.logout()
  selectedPath.value = 'local'
  remoteCardsCount.value = 0
  toast.info('Disconnected from Cloudflare')
}

// Route 4: Returning Restorer
async function handleRestoreAndLaunch() {
  if (isRestoring.value)
    return
  isRestoring.value = true
  try {
    syncStore.syncEnabled = true
    syncStore.activeProvider = 's3'

    if (selectiveSyncPanelRef.value) {
      const checkedIds = selectiveSyncPanelRef.value.getSelectedCheckedIds()
      if (checkedIds && checkedIds.length > 0) {
        syncStore.selectiveSyncEnabled = true
        syncStore.selectiveCheckedIds = checkedIds
      }
    }

    toast.info('Synchronizing companions and assets from Cloudflare R2...')
    await syncStore.triggerSync()

    await cardStore.loadCards()

    const availableCards = Array.from(cardStore.cards.keys())
    const cardToActivate = availableCards.find(id => id !== 'default') || availableCards[0] || 'default'
    if (cardToActivate && cardStore.cards.has(cardToActivate)) {
      await cardStore.activateCard(cardToActivate, true)
    }

    onboardingStore.markSetupCompleted()
    toast.success('Companion restored and stage ready!')
    emit('finish')
    props.onFinish?.()
  }
  catch (err: any) {
    console.error('[StepTriage] Restore and launch failed:', err)
    toast.error(err?.message || 'Failed to restore companions')
  }
  finally {
    isRestoring.value = false
  }
}

// Route 5: Multi-Companion Power User
async function handleRestoreAndBuildAnother() {
  if (isRestoring.value)
    return
  isRestoring.value = true
  try {
    syncStore.syncEnabled = true
    syncStore.activeProvider = 's3'

    if (selectiveSyncPanelRef.value) {
      const checkedIds = selectiveSyncPanelRef.value.getSelectedCheckedIds()
      if (checkedIds && checkedIds.length > 0) {
        syncStore.selectiveSyncEnabled = true
        syncStore.selectiveCheckedIds = checkedIds
      }
    }

    toast.info('Synchronizing companions and assets from Cloudflare R2...')
    await syncStore.triggerSync()
    await cardStore.loadCards()

    toast.success('Companions restored! Proceeding to create your new companion.')
    props.onNext()
  }
  catch (err: any) {
    console.error('[StepTriage] Restore failed:', err)
    toast.error(err?.message || 'Failed to restore companions')
  }
  finally {
    isRestoring.value = false
  }
}
</script>

<template>
  <div :class="['w-full max-w-4xl mx-auto h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Scrollable Content Body -->
    <div :class="['flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4']">
      <!-- Header Section -->
      <div :class="['flex flex-col items-center text-center gap-2.5']">
        <!-- Title & Subtitle -->
        <div
          v-motion
          :initial="{ opacity: 0, y: -6 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :class="['text-center']"
        >
          <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
            {{ t('onboarding.steps.triage.title', 'Choose how AIRI saves your companion') }}
          </h1>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-lg mx-auto']">
            {{ t('onboarding.steps.triage.description', 'Keep data on this device, or connect an account for cloud services.') }}
          </p>
        </div>

        <!-- Assistant Guidance Bubble -->
        <AssistantBubble
          :message="t('onboarding.steps.triage.companionGreeting')"
          step-key="triage"
          sticker-id="airi-confused"
          tone="primary"
        />
      </div>

      <!-- VIEW 1: 2-Card Architecture Selection Grid -->
      <div
        v-if="viewMode === 'cards'"
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="400"
        :delay="150"
        :class="['grid grid-cols-1 md:grid-cols-2 gap-5 w-full pt-1 items-stretch']"
      >
        <!-- CARD 1: Local Only -->
        <div
          :class="[
            'relative flex flex-col justify-between rounded-2xl p-6 border transition-all min-h-[380px] backdrop-blur-xl',
            'border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-[#121418] shadow-sm',
          ]"
        >
          <div :class="['space-y-4']">
            <!-- Header: Green circle icon + Title & Subtitle -->
            <div :class="['flex items-start gap-3.5']">
              <div :class="['w-11 h-11 rounded-full bg-[#46A758] text-white flex items-center justify-center shrink-0 shadow-sm']">
                <div :class="['i-solar:laptop-minimalistic-bold text-2xl']" />
              </div>
              <div :class="['min-w-0']">
                <h2 :class="['text-base sm:text-lg font-bold text-neutral-900 dark:text-white leading-tight']">
                  {{ t('onboarding.steps.triage.local.title', 'Local only') }}
                </h2>
                <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-snug']">
                  {{ t('onboarding.steps.triage.local.description', 'Keep companion cards, memories, and settings on this device.') }}
                </p>
              </div>
            </div>

            <!-- 3 Consumer Bullets -->
            <div :class="['space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800/80']">
              <div
                v-for="bullet in localBullets"
                :key="bullet.title"
                :class="['flex items-start gap-3']"
              >
                <div :class="['w-7 h-7 rounded-full bg-[#46A758]/15 text-[#46A758] dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5']">
                  <div :class="[bullet.icon, 'text-base']" />
                </div>
                <div :class="['text-xs leading-snug min-w-0']">
                  <div :class="['font-semibold text-neutral-900 dark:text-white']">
                    {{ bullet.title }}
                  </div>
                  <div :class="['text-neutral-500 dark:text-neutral-400 mt-0.5']">
                    {{ bullet.description }}
                  </div>
                </div>
              </div>
            </div>

            <!-- More details -> Click Popover -->
            <div :class="['pt-1']">
              <PopoverRoot>
                <PopoverTrigger as-child>
                  <button
                    type="button"
                    :class="['text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors group']"
                  >
                    <span :class="['group-hover:underline']">{{ t('onboarding.steps.triage.moreDetails', 'More details') }}</span>
                    <div :class="['i-solar:alt-arrow-right-line-duotone text-xs group-hover:translate-x-0.5 transition-transform']" />
                  </button>
                </PopoverTrigger>
                <PopoverPortal>
                  <PopoverContent
                    side="top"
                    align="start"
                    :side-offset="10"
                    :collision-padding="16"
                    :class="[
                      'z-50 w-84 sm:w-96 rounded-2xl p-4 shadow-2xl text-xs backdrop-blur-xl',
                      'bg-white/95 dark:bg-[#16181D]/95 border border-neutral-200/90 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200',
                      'animate-in fade-in-0 zoom-in-95 duration-150',
                    ]"
                  >
                    <div :class="['pb-2.5 mb-2.5 border-b border-neutral-200/80 dark:border-neutral-800']">
                      <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5']">
                        <div :class="['i-solar:shield-check-bold text-sm text-[#46A758] dark:text-emerald-400']" />
                        <span>Air-Gapped Local Architecture</span>
                      </h4>
                      <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
                        100% on-device execution. Your companion stays completely private to this machine.
                      </p>
                    </div>
                    <div :class="['space-y-2.5 max-h-[280px] overflow-y-auto pr-1']">
                      <div
                        v-for="detail in localDetails"
                        :key="detail.key"
                        :class="['p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800/60']"
                      >
                        <div :class="['flex items-center justify-between gap-2 mb-1']">
                          <span :class="['font-semibold text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-1.5']">
                            <div :class="[detail.icon, 'text-[#46A758] dark:text-emerald-400 text-sm shrink-0']" />
                            <span>{{ detail.title }}</span>
                          </span>
                          <span :class="['px-1.5 py-0.5 rounded-md text-[9px] font-mono font-medium bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400']">
                            {{ detail.badge }}
                          </span>
                        </div>
                        <p :class="['text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed']">
                          {{ detail.desc }}
                        </p>
                      </div>
                    </div>
                    <PopoverArrow :class="['fill-white dark:fill-[#16181D] stroke-neutral-200/90 dark:stroke-neutral-800']" />
                  </PopoverContent>
                </PopoverPortal>
              </PopoverRoot>
            </div>
          </div>

          <!-- Bottom Action CTA -->
          <div :class="['pt-5 mt-4 border-t border-neutral-100 dark:border-neutral-800/80']">
            <button
              type="button"
              :class="[
                'w-full py-2.5 rounded-xl border-2 border-[#46A758] dark:border-emerald-500 text-[#46A758] dark:text-emerald-400 hover:bg-[#46A758]/10 dark:hover:bg-emerald-500/10 font-bold text-xs sm:text-sm tracking-wide transition-all active:scale-[0.99] cursor-pointer text-center flex items-center justify-center gap-2',
              ]"
              @click="chooseLocal"
            >
              <span>{{ t('onboarding.steps.triage.local.continueAction', 'Continue locally') }}</span>
            </button>
            <div :class="['text-[11px] text-neutral-500 dark:text-neutral-400 text-center mt-2']">
              {{ t('onboarding.steps.triage.local.noSignInNeeded', 'No sign-in needed.') }}
            </div>
          </div>
        </div>

        <!-- CARD 2: Connected Account -->
        <div
          :class="[
            'relative flex flex-col justify-between rounded-2xl p-6 border transition-all min-h-[380px] backdrop-blur-xl',
            'border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-[#121418] shadow-sm',
          ]"
        >
          <div :class="['space-y-4']">
            <!-- Header: Green circle icon + Title & Subtitle -->
            <div :class="['flex items-start gap-3.5']">
              <div :class="['w-11 h-11 rounded-full bg-[#46A758] text-white flex items-center justify-center shrink-0 shadow-sm']">
                <div :class="['i-solar:cloud-bold text-2xl']" />
              </div>
              <div :class="['min-w-0']">
                <h2 :class="['text-base sm:text-lg font-bold text-neutral-900 dark:text-white leading-tight']">
                  {{ t('onboarding.steps.triage.cloud.title', 'Connected account') }}
                </h2>
                <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-snug']">
                  {{ t('onboarding.steps.triage.cloud.description', 'Powered by Cloudflare · Use an account for backup, sync, and hosted services.') }}
                </p>
              </div>
            </div>

            <!-- 3 Consumer Bullets -->
            <div :class="['space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800/80']">
              <div
                v-for="bullet in cloudBullets"
                :key="bullet.title"
                :class="['flex items-start gap-3']"
              >
                <div :class="['w-7 h-7 rounded-full bg-[#46A758]/15 text-[#46A758] dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5']">
                  <div :class="[bullet.icon, 'text-base']" />
                </div>
                <div :class="['text-xs leading-snug min-w-0']">
                  <div :class="['font-semibold text-neutral-900 dark:text-white']">
                    {{ bullet.title }}
                  </div>
                  <div :class="['text-neutral-500 dark:text-neutral-400 mt-0.5']">
                    {{ bullet.description }}
                  </div>
                </div>
              </div>
            </div>

            <!-- More details -> Click Popover -->
            <div :class="['pt-1']">
              <PopoverRoot>
                <PopoverTrigger as-child>
                  <button
                    type="button"
                    :class="['text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors group']"
                  >
                    <span :class="['group-hover:underline']">{{ t('onboarding.steps.triage.moreDetails', 'More details') }}</span>
                    <div :class="['i-solar:alt-arrow-right-line-duotone text-xs group-hover:translate-x-0.5 transition-transform']" />
                  </button>
                </PopoverTrigger>
                <PopoverPortal>
                  <PopoverContent
                    side="top"
                    align="start"
                    :side-offset="10"
                    :collision-padding="16"
                    :class="[
                      'z-50 w-84 sm:w-96 rounded-2xl p-4 shadow-2xl text-xs backdrop-blur-xl',
                      'bg-white/95 dark:bg-[#16181D]/95 border border-neutral-200/90 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200',
                      'animate-in fade-in-0 zoom-in-95 duration-150',
                    ]"
                  >
                    <div :class="['pb-2.5 mb-2.5 border-b border-neutral-200/80 dark:border-neutral-800']">
                      <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5']">
                        <div :class="['i-solar:cloud-bold text-sm text-[#46A758] dark:text-emerald-400']" />
                        <span>Cloudflare Zero-Custody Architecture</span>
                      </h4>
                      <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
                        Everything runs in your personal Cloudflare account. AIRI operates zero intermediate servers and never touches your data.
                      </p>
                    </div>
                    <div :class="['space-y-2.5 max-h-[280px] overflow-y-auto pr-1']">
                      <div
                        v-for="detail in cloudDetails"
                        :key="detail.key"
                        :class="['p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800/60']"
                      >
                        <div :class="['flex items-center justify-between gap-2 mb-1']">
                          <span :class="['font-semibold text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-1.5']">
                            <div :class="[detail.icon, 'text-[#46A758] dark:text-emerald-400 text-sm shrink-0']" />
                            <span>{{ detail.title }}</span>
                          </span>
                          <span :class="['px-1.5 py-0.5 rounded-md text-[9px] font-mono font-medium bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400']">
                            {{ detail.badge }}
                          </span>
                        </div>
                        <p :class="['text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed']">
                          {{ detail.desc }}
                        </p>
                      </div>
                    </div>
                    <PopoverArrow :class="['fill-white dark:fill-[#16181D] stroke-neutral-200/90 dark:stroke-neutral-800']" />
                  </PopoverContent>
                </PopoverPortal>
              </PopoverRoot>
            </div>
          </div>

          <!-- Bottom Action CTA / Dynamic States -->
          <div :class="['pt-5 mt-4 border-t border-neutral-100 dark:border-neutral-800/80']">
            <!-- State 01: Signed Out (Default) -->
            <div v-if="!isAuthenticated && !isAuthenticating && !isTokenMode" :class="['space-y-2']">
              <button
                type="button"
                :class="[
                  'w-full py-2.5 rounded-xl border-2 border-[#46A758] dark:border-emerald-500 text-[#46A758] dark:text-emerald-400 hover:bg-[#46A758]/10 dark:hover:bg-emerald-500/10 font-bold text-xs sm:text-sm tracking-wide transition-all active:scale-[0.99] cursor-pointer text-center flex items-center justify-center gap-2',
                ]"
                @click="handleStartOAuth"
              >
                <div :class="['i-solar:cloud-bold text-base']" />
                <span>{{ t('onboarding.steps.triage.cloud.signInAction', 'Sign in & continue') }}</span>
              </button>
              <div :class="['text-[11px] text-neutral-500 dark:text-neutral-400 text-center']">
                {{ t('onboarding.steps.triage.cloud.signInHelp', 'Sign in with Cloudflare to continue.') }}
              </div>
              <button
                type="button"
                :class="['text-[11px] text-[#46A758] dark:text-emerald-400 hover:underline cursor-pointer block mx-auto font-medium']"
                @click="isTokenMode = true"
              >
                {{ t('onboarding.steps.triage.cloud.useApiToken', 'Use API token') }}
              </button>
            </div>

            <!-- State 01b: Inline API Token Mode -->
            <div v-else-if="!isAuthenticated && isTokenMode" :class="['space-y-2']">
              <div :class="['flex items-center gap-2']">
                <input
                  v-model="tokenInput"
                  type="password"
                  :placeholder="t('onboarding.steps.triage.auth.tokenPlaceholder', 'Paste your Cloudflare API token...')"
                  :class="[
                    'flex-1 px-3 py-2 rounded-xl border text-xs bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white outline-none focus:border-emerald-500',
                  ]"
                  @keydown.enter="handleConnectApiToken"
                >
                <button
                  type="button"
                  :disabled="isValidatingToken || !tokenInput.trim()"
                  :class="[
                    'px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer shrink-0',
                  ]"
                  @click="handleConnectApiToken"
                >
                  {{ isValidatingToken ? t('onboarding.steps.triage.auth.verifying', 'Verifying...') : t('onboarding.steps.triage.auth.verifyToken', 'Connect') }}
                </button>
              </div>
              <div :class="['flex items-center justify-between text-[10px] text-neutral-400']">
                <span>Requires Workers KV and R2 read/write permissions.</span>
                <button
                  type="button"
                  :class="['text-neutral-500 hover:text-neutral-800 dark:hover:text-white underline cursor-pointer']"
                  @click="isTokenMode = false"
                >
                  Cancel
                </button>
              </div>
            </div>

            <!-- State 02: Signing In (in progress) -->
            <div v-else-if="!isAuthenticated && isAuthenticating" :class="['space-y-2']">
              <div
                :class="[
                  'w-full py-2.5 rounded-xl border-2 border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 font-bold text-xs sm:text-sm tracking-wide cursor-not-allowed text-center flex items-center justify-center gap-2 bg-neutral-50 dark:bg-neutral-900/50',
                ]"
              >
                <div :class="['i-solar:refresh-line-duotone text-base animate-spin text-[#46A758] dark:text-emerald-400']" />
                <span>{{ t('onboarding.steps.triage.cloud.waitingForSignIn', 'Waiting for sign-in...') }}</span>
              </div>
              <button
                type="button"
                :class="['text-[11px] text-[#46A758] dark:text-emerald-400 hover:underline cursor-pointer block mx-auto font-medium']"
                @click="handleCancelAuth"
              >
                {{ t('onboarding.steps.triage.cloud.cancelSignIn', 'Cancel sign-in') }}
              </button>
              <div :class="['text-[11px] text-neutral-500 dark:text-neutral-400 text-center']">
                {{ t('onboarding.steps.triage.cloud.finishInBrowser', 'Finish signing in in your browser.') }}
              </div>
            </div>

            <!-- State 03: Already Signed In -->
            <div v-else-if="isAuthenticated" :class="['space-y-2']">
              <button
                type="button"
                :class="[
                  'w-full py-2.5 rounded-xl border-2 border-[#46A758] dark:border-emerald-500 text-[#46A758] dark:text-emerald-400 hover:bg-[#46A758]/10 dark:hover:bg-emerald-500/10 font-bold text-xs sm:text-sm tracking-wide transition-all active:scale-[0.99] cursor-pointer text-center flex items-center justify-center gap-2',
                ]"
                @click="handleCloudContinue"
              >
                <span>{{ t('onboarding.steps.triage.cloud.continueAction', 'Continue with connected account') }}</span>
              </button>
              <div :class="['flex items-center justify-center gap-1.5 text-xs text-[#46A758] dark:text-emerald-400 font-semibold']">
                <div :class="['i-solar:check-circle-bold text-sm']" />
                <span>{{ t('onboarding.steps.triage.auth.connected', 'Account connected') }}</span>
                <span v-if="cfAccountId" :class="['text-[10px] text-neutral-400 font-mono font-normal ml-1']">
                  ({{ cfAccountId.slice(0, 8) }}...)
                </span>
              </div>
              <div :class="['flex items-center justify-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 pt-0.5']">
                <button
                  type="button"
                  :class="['hover:text-neutral-900 dark:hover:text-white underline cursor-pointer transition-colors']"
                  @click="showHubDialog = true"
                >
                  {{ t('onboarding.steps.triage.cloud.manageConnection', 'Manage connection') }}
                </button>
                <span>·</span>
                <button
                  type="button"
                  :class="['hover:text-red-600 dark:hover:text-red-400 underline cursor-pointer transition-colors']"
                  @click="handleDisconnect"
                >
                  {{ t('onboarding.steps.triage.auth.disconnect', 'Disconnect') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- VIEW 2: Standalone Cloud Vault Restore Screen -->
      <div
        v-else-if="viewMode === 'restore'"
        v-motion
        :initial="{ opacity: 0, scale: 0.98 }"
        :enter="{ opacity: 1, scale: 1 }"
        :duration="350"
        :class="['flex-1 min-h-0 flex flex-col justify-between gap-4 py-2']"
      >
        <div :class="['flex flex-col gap-3 flex-1 min-h-0']">
          <!-- Header of Restore Cockpit -->
          <div :class="['flex items-center justify-between pb-3 border-b border-emerald-500/20']">
            <div :class="['flex items-center gap-3']">
              <div :class="['h-10 w-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 shadow-xs']">
                <div :class="['i-solar:cloud-check-bold-duotone text-2xl']" />
              </div>
              <div>
                <h2 :class="['text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2']">
                  <span>{{ t('onboarding.steps.triage.restore.bannerTitle', 'Restore from Cloud Vault') }}</span>
                  <span :class="['px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400']">
                    {{ remoteCardsCount }} Available
                  </span>
                </h2>
                <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
                  {{ t('onboarding.steps.triage.restore.bannerDesc', { count: remoteCardsCount }) }} Choose what to sync to this device.
                </p>
              </div>
            </div>

            <button
              type="button"
              :class="['text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 cursor-pointer transition-colors']"
              @click="probeRemoteCatalog"
            >
              <div :class="['i-solar:refresh-linear text-xs', isLoadingCatalog ? 'animate-spin' : '']" />
              <span>Refresh</span>
            </button>
          </div>

          <!-- Full-Size Selective Sync Panel -->
          <div :class="['flex-1 min-h-[300px] max-h-[380px] overflow-y-auto rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 p-3 shadow-inner']">
            <SelectiveSyncPanel
              ref="selectiveSyncPanelRef"
              :show-actions="false"
            />
          </div>
        </div>

        <!-- Dedicated Restore Action Bar -->
        <div :class="['pt-3 border-t border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3']">
          <button
            type="button"
            :class="['flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer']"
            @click="viewMode = 'cards'"
          >
            <div :class="['i-solar:alt-arrow-left-line-duotone text-sm']" />
            <span>Back to Options</span>
          </button>

          <div :class="['flex items-center gap-3']">
            <button
              type="button"
              :class="['text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white underline cursor-pointer transition-colors']"
              @click="props.onNext"
            >
              Start fresh without restoring →
            </button>

            <!-- Route 5: Restore and Build Another -->
            <button
              type="button"
              :disabled="isRestoring"
              :class="[
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold',
                'border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 transition-all active:scale-95 disabled:opacity-50 cursor-pointer',
              ]"
              @click="handleRestoreAndBuildAnother"
            >
              <div v-if="isRestoring" :class="['i-solar:refresh-line-duotone text-xs animate-spin']" />
              <div v-else :class="['i-solar:add-circle-bold text-xs text-emerald-500']" />
              <span>{{ t('onboarding.steps.triage.restore.restoreAndBuild', 'Restore & Build Another') }}</span>
            </button>

            <!-- Route 4: Restore All and Launch -->
            <Button
              variant="primary"
              size="md"
              :disabled="isRestoring"
              :class="[
                'flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5',
                'text-xs font-semibold text-white shadow-md shadow-emerald-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer',
              ]"
              @click="handleRestoreAndLaunch"
            >
              <div v-if="isRestoring" :class="['i-solar:refresh-line-duotone text-xs animate-spin']" />
              <div v-else :class="['i-solar:rocket-bold-duotone text-xs']" />
              <span>{{ isRestoring ? t('onboarding.steps.triage.restore.restoring', 'Restoring...') : t('onboarding.steps.triage.restore.restoreAll', 'Restore & Launch Stage') }}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Base Navigation Footer (Only on Cards View) -->
    <div
      v-if="viewMode === 'cards'"
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="350"
      :delay="250"
      :class="['flex-shrink-0 pt-4 flex items-center justify-between border-t border-neutral-200/80 dark:border-white/5']"
    >
      <button
        type="button"
        :class="['flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>{{ t('onboarding.shell.previous', 'Back') }}</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium']">
        {{ t('onboarding.steps.triage.changeLater', 'You can change this later.') }}
      </div>
    </div>

    <!-- Cloudflare Account Hub Modal for "Manage connection" -->
    <CloudflareAccountHubDialog v-model="showHubDialog" />
  </div>
</template>
