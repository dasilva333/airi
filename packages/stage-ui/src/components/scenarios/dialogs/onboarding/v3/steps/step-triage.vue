<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import SelectiveSyncPanel from '../../../../providers/selective-sync-panel.vue'
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

const { cfOAuthTokens, cfAccountId, isAuthenticating, isAuthenticated } = storeToRefs(cloudflareStore)

const authMethod = ref<'auto' | 'token'>('auto')
const tokenInput = ref('')
const isValidatingToken = ref(false)
const isLoadingCatalog = ref(false)
const hasCheckedRemote = ref(false)
const remoteCardsCount = ref(0)
const isRestoring = ref(false)
const selectiveSyncPanelRef = ref<InstanceType<typeof SelectiveSyncPanel> | null>(null)

const selectedPath = computed<'local' | 'cloud'>({
  get: () => draftStore.state.architecture || 'local',
  set: (val) => {
    draftStore.setArchitecture(val)
  },
})

const cloudFeatures = computed(() => [
  {
    key: 'storage',
    icon: 'i-solar:cloud-storage-bold-duotone',
    title: t('onboarding.steps.triage.cloud.features.storage.title', '10 GB Free Cloud Storage'),
    summary: t('onboarding.steps.triage.cloud.features.storage.desc', 'Back up 3D models, custom backgrounds, and full memory vaults with zero egress fees.'),
    howItWorks: t('onboarding.steps.triage.cloud.features.storage.howItWorks', 'Powered by user-owned Cloudflare R2 object storage.'),
    whyItMatters: t('onboarding.steps.triage.cloud.features.storage.whyItMatters', 'Generous free tier with plenty of room for dozens of VRM/Live2D models and years of chat history. Unlike AWS S3, downloading your assets is 100% free with $0 bandwidth fees.'),
  },
  {
    key: 'ai',
    icon: 'i-solar:cpu-bolt-bold-duotone',
    title: t('onboarding.steps.triage.cloud.features.ai.title', 'Free Daily Edge AI Credits'),
    summary: t('onboarding.steps.triage.cloud.features.ai.desc', '10,000 free daily Neurons for DeepSeek, Qwen & Llama (no API key required).'),
    howItWorks: t('onboarding.steps.triage.cloud.features.ai.howItWorks', 'Directly connects to Cloudflare Workers AI during Step 8 (Consciousness).'),
    whyItMatters: t('onboarding.steps.triage.cloud.features.ai.whyItMatters', 'Chat immediately with cutting-edge open models at the edge without needing an OpenAI subscription, paid credit card, or a high-end local gaming GPU.'),
  },
  {
    key: 'relay',
    icon: 'i-solar:chat-round-dots-bold-duotone',
    title: t('onboarding.steps.triage.cloud.features.relay.title', '24/7 Discord Cloud Relay'),
    summary: t('onboarding.steps.triage.cloud.features.relay.desc', 'Keep your companion awake in your Discord server even when your PC is turned off.'),
    howItWorks: t('onboarding.steps.triage.cloud.features.relay.howItWorks', 'Runs as a serverless Cloudflare Worker (@proj-airi/stage-edge) handling Discord interaction webhooks.'),
    whyItMatters: t('onboarding.steps.triage.cloud.features.relay.whyItMatters', 'Your companion stays alive 24/7 to chat in Discord, stores context in Edge KV, and syncs conversations back to your desktop when you reopen AIRI.'),
  },
  {
    key: 'sync',
    icon: 'i-solar:devices-bold-duotone',
    title: t('onboarding.steps.triage.cloud.features.sync.title', 'Multi-Device Sync & 1-Click Restore'),
    summary: t('onboarding.steps.triage.cloud.features.sync.desc', 'Seamlessly sync Desktop, Web, and Mobile; restore companions in one click.'),
    howItWorks: t('onboarding.steps.triage.cloud.features.sync.howItWorks', 'Edge Key Vault (airi-edge-vault) securely tracks your active companion state.'),
    whyItMatters: t('onboarding.steps.triage.cloud.features.sync.whyItMatters', 'Reinstalling AIRI or moving to a new laptop/phone automatically brings back your companion, settings, and memories without manual key entry.'),
  },
  {
    key: 'proxy',
    icon: 'i-solar:shield-check-bold-duotone',
    title: t('onboarding.steps.triage.cloud.features.proxy.title', 'Private CORS Proxy & Zero-Custody'),
    summary: t('onboarding.steps.triage.cloud.features.proxy.desc', 'Access tricky local & remote AI APIs with 100% zero-custody data privacy.'),
    howItWorks: t('onboarding.steps.triage.cloud.features.proxy.howItWorks', 'Deploys a personal edge reverse proxy to bypass browser CORS headers for Web & Mobile stages.'),
    whyItMatters: t('onboarding.steps.triage.cloud.features.proxy.whyItMatters', 'Everything runs in your personal Cloudflare account. AIRI operates zero intermediate servers and never reads, stores, or harvests your conversations.'),
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

async function handleStartOAuth() {
  try {
    await cloudflareStore.authenticateWithCloudflare()
    selectedPath.value = 'cloud'
    toast.success('Successfully connected to Cloudflare!')
    await restoreVaultCredentials()
    await probeRemoteCatalog()
  }
  catch (err: any) {
    toast.error(err?.message || 'Cloudflare authentication failed')
  }
}

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
    await restoreVaultCredentials()
    await probeRemoteCatalog()
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to verify Cloudflare API token')
  }
  finally {
    isValidatingToken.value = false
  }
}

function handleDisconnect(e: Event) {
  e.stopPropagation()
  cloudflareStore.logout()
  selectedPath.value = 'local'
  remoteCardsCount.value = 0
  toast.info('Disconnected from Cloudflare')
}

function chooseLocal() {
  selectedPath.value = 'local'
}

function chooseCloud() {
  selectedPath.value = 'cloud'
  if (isAuthenticated.value) {
    void restoreVaultCredentials()
    void probeRemoteCatalog()
  }
}

// Route 4: The Returning Restorer
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

// Route 5: The Multi-Companion Power User
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
      <div :class="['flex flex-col items-center text-center gap-3']">
        <!-- Title -->
        <div
          v-motion
          :initial="{ opacity: 0, y: -6 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :class="['text-center']"
        >
          <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
            {{ t('onboarding.steps.triage.title') }}
          </h1>
        </div>

        <!-- Assistant Guidance Bubble -->
        <AssistantBubble
          :message="t('onboarding.steps.triage.companionGreeting')"
          step-key="triage"
          tone="primary"
        />
      </div>

      <!-- 2-Card Architecture Choice Grid -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="400"
        :delay="150"
        :class="['grid grid-cols-1 md:grid-cols-2 gap-5 w-full pt-1 items-stretch']"
      >
        <!-- Option 1: Local Companion (100% Offline) -->
        <div
          :class="[
            'relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 border-2 transition-all duration-200 cursor-pointer min-h-[340px] backdrop-blur-xl',
            selectedPath === 'local'
              ? 'border-primary-500 bg-white/95 dark:bg-neutral-900/95 shadow-lg shadow-primary-500/10 ring-1 ring-primary-500/30'
              : 'border-neutral-200/80 dark:border-neutral-800 bg-white/85 dark:bg-neutral-900/75 hover:border-neutral-300 dark:hover:border-neutral-700',
          ]"
          @click="chooseLocal"
        >
          <div :class="['space-y-4']">
            <!-- Top Row: Icon + Badge + Radio Indicator -->
            <div :class="['flex items-center justify-between']">
              <div :class="['flex items-center gap-2.5']">
                <div
                  :class="[
                    'h-10 w-10 rounded-xl flex items-center justify-center transition-colors',
                    selectedPath === 'local'
                      ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                  ]"
                >
                  <div :class="['i-solar:home-smile-bold-duotone text-xl']" />
                </div>
                <span :class="['rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-primary-500/15 text-primary-600 dark:text-primary-400']">
                  {{ t('onboarding.steps.triage.local.badge') }}
                </span>
              </div>

              <!-- Radio Indicator -->
              <div
                :class="[
                  'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  selectedPath === 'local'
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-neutral-300 dark:border-neutral-600',
                ]"
              >
                <div
                  v-if="selectedPath === 'local'"
                  :class="['h-2 w-2 rounded-full bg-white']"
                />
              </div>
            </div>

            <!-- Main Info -->
            <div>
              <h2 :class="['text-base font-bold text-neutral-900 dark:text-white']">
                {{ t('onboarding.steps.triage.local.title') }}
              </h2>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                {{ t('onboarding.steps.triage.local.description') }}
              </p>
            </div>

            <!-- Feature Bullets -->
            <div :class="['space-y-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/80']">
              <div
                v-for="(bullet, i) in [
                  t('onboarding.steps.triage.local.features.f1'),
                  t('onboarding.steps.triage.local.features.f2'),
                  t('onboarding.steps.triage.local.features.f3'),
                ]"
                :key="i"
                :class="['flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300']"
              >
                <div :class="['i-solar:check-circle-bold text-primary-500 shrink-0 h-4 w-4']" />
                <span>{{ bullet }}</span>
              </div>
            </div>
          </div>

          <!-- Action Button -->
          <div :class="['pt-5']">
            <Button
              type="button"
              :class="['w-full justify-center text-xs py-2.5 font-semibold rounded-xl']"
              :variant="selectedPath === 'local' ? 'primary' : 'secondary'"
              @click.stop="chooseLocal"
            >
              {{ selectedPath === 'local' ? t('onboarding.steps.triage.local.selectedCta') : t('onboarding.steps.triage.local.selectCta') }}
            </Button>
          </div>
        </div>

        <!-- Option 2: Account Sign-In (Cloudflare) -->
        <div
          :class="[
            'relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 border-2 transition-all duration-200 cursor-pointer min-h-[340px] backdrop-blur-xl',
            selectedPath === 'cloud'
              ? isAuthenticated
                ? 'border-emerald-500 bg-white/95 dark:bg-neutral-900/95 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                : 'border-primary-500 bg-white/95 dark:bg-neutral-900/95 shadow-lg shadow-primary-500/10 ring-1 ring-primary-500/30'
              : 'border-neutral-200/80 dark:border-neutral-800 bg-white/85 dark:bg-neutral-900/75 hover:border-neutral-300 dark:hover:border-neutral-700',
          ]"
          @click="chooseCloud"
        >
          <div :class="['space-y-4']">
            <!-- Top Row: Icon + Badge + Radio Indicator -->
            <div :class="['flex items-center justify-between']">
              <div :class="['flex items-center gap-2.5']">
                <div
                  :class="[
                    'h-10 w-10 rounded-xl flex items-center justify-center transition-colors',
                    isAuthenticated
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                      : selectedPath === 'cloud'
                        ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                  ]"
                >
                  <div :class="['i-solar:cloud-storage-line-duotone text-xl']" />
                </div>
                <span
                  :class="[
                    'rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                    isAuthenticated
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-primary-500/15 text-primary-600 dark:text-primary-400',
                  ]"
                >
                  {{ isAuthenticated ? t('onboarding.steps.triage.auth.connected', { account: '' }) : t('onboarding.steps.triage.cloud.badge') }}
                </span>
              </div>

              <!-- Radio Indicator -->
              <div
                :class="[
                  'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  selectedPath === 'cloud'
                    ? isAuthenticated ? 'border-emerald-500' : 'border-primary-500'
                    : 'border-neutral-300 dark:border-neutral-600',
                ]"
              >
                <div
                  v-if="selectedPath === 'cloud'"
                  :class="[
                    'h-2.5 w-2.5 rounded-full shadow-xs',
                    isAuthenticated ? 'bg-emerald-500' : 'bg-primary-500',
                  ]"
                />
              </div>
            </div>

            <!-- Title & Description -->
            <div>
              <h2 :class="['text-base font-bold text-neutral-900 dark:text-white']">
                {{ t('onboarding.steps.triage.cloud.title') }}
              </h2>
              <p :class="['text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 leading-relaxed']">
                {{ t('onboarding.steps.triage.cloud.description') }}
              </p>
            </div>

            <!-- Authenticated State Banner -->
            <div
              v-if="isAuthenticated"
              :class="['border border-emerald-500/30 rounded-xl bg-emerald-500/10 p-3 text-xs dark:bg-emerald-950/20 space-y-1.5']"
            >
              <div :class="['flex items-center justify-between text-emerald-700 dark:text-emerald-300 font-semibold']">
                <span :class="['flex items-center gap-1.5']">
                  <div :class="['i-solar:check-circle-bold-duotone text-sm']" />
                  <span>{{ cfOAuthTokens?.accessToken ? 'Authenticated via OAuth PKCE' : 'Authenticated via API Token' }}</span>
                </span>
                <button
                  type="button"
                  :class="['text-[10px] text-neutral-500 underline dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white cursor-pointer']"
                  @click="handleDisconnect"
                >
                  {{ t('onboarding.steps.triage.auth.disconnect') }}
                </button>
              </div>
              <div :class="['truncate text-[10px] text-neutral-600 dark:text-neutral-300 font-mono']">
                <span :class="['text-neutral-400']">Account:</span> {{ cfAccountId || cfOAuthTokens?.accountId || 'Default Account' }}
              </div>
              <div :class="['truncate text-[10px] text-neutral-500 dark:text-neutral-400 font-mono']">
                <span :class="['text-neutral-400']">Edge Vault:</span> Ready & encrypted
              </div>
            </div>

            <!-- 5 Feature Bullets with Hover Popovers (Always Visible) -->
            <TooltipProvider :delay-duration="100">
              <div :class="['space-y-1 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 text-xs']">
                <div
                  v-for="feature in cloudFeatures"
                  :key="feature.key"
                  :class="['w-full']"
                >
                  <TooltipRoot>
                    <TooltipTrigger as-child>
                      <div
                        :class="[
                          'group flex items-start gap-2 p-1.5 -mx-1 rounded-lg transition-all cursor-help',
                          'hover:bg-primary-500/10 dark:hover:bg-primary-400/10',
                        ]"
                      >
                        <div :class="[feature.icon, 'text-primary-500 shrink-0 h-4 w-4 mt-0.5 group-hover:scale-110 transition-transform']" />
                        <div :class="['flex-1 min-w-0 text-[11px] leading-tight']">
                          <span :class="['font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors']">
                            {{ feature.title }}:
                          </span>
                          <span :class="['text-neutral-600 dark:text-neutral-400 ml-1']">
                            {{ feature.summary }}
                          </span>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipPortal>
                      <TooltipContent
                        side="right"
                        :side-offset="12"
                        :collision-padding="16"
                        :class="[
                          'z-50 max-w-xs sm:max-w-sm rounded-xl p-3.5 shadow-2xl text-xs backdrop-blur-xl',
                          'bg-white/95 dark:bg-neutral-900/95 border border-primary-500/30 text-neutral-800 dark:text-neutral-200',
                          'animate-in fade-in-0 zoom-in-95 duration-150',
                        ]"
                      >
                        <div :class="['flex items-center gap-2 pb-2 mb-2 border-b border-neutral-200/80 dark:border-neutral-800']">
                          <div :class="[feature.icon, 'text-primary-500 text-base shrink-0']" />
                          <span :class="['font-bold text-neutral-900 dark:text-white text-xs']">
                            {{ feature.title }}
                          </span>
                        </div>
                        <div :class="['space-y-2 text-[11px] leading-relaxed']">
                          <div>
                            <span :class="['font-semibold text-primary-600 dark:text-primary-400']">How it works: </span>
                            <span :class="['text-neutral-600 dark:text-neutral-300']">{{ feature.howItWorks }}</span>
                          </div>
                          <div>
                            <span :class="['font-semibold text-emerald-600 dark:text-emerald-400']">Why it matters: </span>
                            <span :class="['text-neutral-600 dark:text-neutral-300']">{{ feature.whyItMatters }}</span>
                          </div>
                        </div>
                        <TooltipArrow :class="['fill-white dark:fill-neutral-900 stroke-primary-500/30']" />
                      </TooltipContent>
                    </TooltipPortal>
                  </TooltipRoot>
                </div>
              </div>
            </TooltipProvider>
          </div>

          <!-- Bottom Action CTA / Auth Module Area -->
          <div :class="['pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800/80']">
            <!-- State A: Card is NOT selected -->
            <div
              v-if="selectedPath !== 'cloud'"
              :class="[
                'w-full py-2.5 rounded-xl text-xs font-semibold text-center transition-all flex items-center justify-center gap-2',
                'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700',
              ]"
            >
              <span>{{ t('onboarding.steps.triage.cloud.selectCta') }}</span>
            </div>

            <!-- State B: Card IS selected AND already Authenticated -->
            <div
              v-else-if="isAuthenticated"
              :class="[
                'w-full py-2.5 rounded-xl text-xs font-semibold text-center transition-all flex items-center justify-center gap-2',
                'bg-emerald-600 text-white shadow-md shadow-emerald-600/25',
              ]"
            >
              <div :class="['i-solar:check-circle-bold text-sm']" />
              <span>{{ t('onboarding.steps.triage.cloud.selectedCta') }}</span>
            </div>

            <!-- State C: Card IS selected BUT NOT Authenticated (Docked Auth Form) -->
            <div
              v-else
              :class="['space-y-2']"
              @click.stop
            >
              <!-- Tabs: 1-Click vs API Token -->
              <div :class="['flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5 text-xs']">
                <button
                  type="button"
                  :class="[
                    'flex-1 py-1 rounded-md text-center text-[11px] font-medium transition-all cursor-pointer',
                    authMethod === 'auto'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white',
                  ]"
                  @click="authMethod = 'auto'"
                >
                  {{ t('onboarding.steps.triage.auth.autoTab') }}
                </button>
                <button
                  type="button"
                  :class="[
                    'flex-1 py-1 rounded-md text-center text-[11px] font-medium transition-all cursor-pointer',
                    authMethod === 'token'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white',
                  ]"
                  @click="authMethod = 'token'"
                >
                  {{ t('onboarding.steps.triage.auth.tokenTab') }}
                </button>
              </div>

              <!-- 1-Click Auto OAuth -->
              <div v-if="authMethod === 'auto'" :class="['space-y-1.5']">
                <button
                  type="button"
                  :disabled="isAuthenticating"
                  :class="[
                    'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer',
                  ]"
                  @click="handleStartOAuth"
                >
                  <div v-if="isAuthenticating" :class="['i-solar:refresh-line-duotone h-4 w-4 animate-spin']" />
                  <div v-else :class="['i-solar:login-2-linear h-4 w-4']" />
                  <span>{{ isAuthenticating ? t('onboarding.steps.triage.auth.verifying') : t('onboarding.steps.triage.auth.oauthButton') }}</span>
                </button>
                <p :class="['text-[10px] text-neutral-400 text-center leading-tight']">
                  Opens your browser for PKCE authorization & Edge Vault pairing.
                </p>
              </div>

              <!-- API Token Direct Input -->
              <div v-else :class="['space-y-2']">
                <div :class="['flex items-center gap-2']">
                  <input
                    v-model="tokenInput"
                    type="password"
                    :placeholder="t('onboarding.steps.triage.auth.tokenPlaceholder')"
                    :class="[
                      'flex-1 px-3 py-1.5 rounded-xl border text-xs bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white outline-none focus:border-primary-500',
                    ]"
                    @keydown.enter="handleConnectApiToken"
                  >
                  <button
                    type="button"
                    :disabled="isValidatingToken || !tokenInput.trim()"
                    :class="[
                      'px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer',
                    ]"
                    @click="handleConnectApiToken"
                  >
                    {{ isValidatingToken ? t('onboarding.steps.triage.auth.verifying') : t('onboarding.steps.triage.auth.verifyToken') }}
                  </button>
                </div>
                <p :class="['text-[10px] text-neutral-400 leading-tight']">
                  Requires Workers KV and R2 read/write permissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Remote Companions Found / Selective Restore View (Routes 4 & 5) -->
      <div
        v-if="selectedPath === 'cloud' && isAuthenticated && remoteCardsCount > 0"
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="400"
        :class="['flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 shadow-sm']"
      >
        <div :class="['flex items-center justify-between pb-2 border-b border-emerald-500/20']">
          <div :class="['flex items-center gap-2.5']">
            <div :class="['h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0']">
              <div :class="['i-solar:cloud-check-bold-duotone text-lg']" />
            </div>
            <div>
              <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2']">
                <span>{{ t('onboarding.steps.triage.restore.bannerTitle') }}</span>
                <span :class="['px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400']">
                  Ready to Restore
                </span>
              </h3>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400']">
                {{ t('onboarding.steps.triage.restore.bannerDesc', { count: remoteCardsCount }) }}
              </p>
            </div>
          </div>

          <button
            type="button"
            :class="['text-[11px] text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors']"
            @click="probeRemoteCatalog"
          >
            <div :class="['i-solar:refresh-linear text-xs', isLoadingCatalog ? 'animate-spin' : '']" />
            <span>Refresh</span>
          </button>
        </div>

        <!-- Embedded Full Selective Sync Tree -->
        <div :class="['max-h-[300px] overflow-y-auto rounded-xl border border-neutral-200/80 dark:border-white/5 bg-white/60 dark:bg-neutral-900/60 p-2']">
          <SelectiveSyncPanel
            ref="selectiveSyncPanelRef"
            :show-actions="false"
          />
        </div>

        <!-- Route 4 & 5 Action Bar -->
        <div :class="['flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-emerald-500/20']">
          <div :class="['text-[11px] text-neutral-500 dark:text-neutral-400']">
            Restoring pulls active state into your local vault.
          </div>

          <div :class="['flex items-center gap-2.5']">
            <!-- Route 5: Multi-Companion Power User -->
            <button
              type="button"
              :disabled="isRestoring"
              :class="[
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold',
                'border border-primary-500/30 bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-300 transition-all active:scale-95 disabled:opacity-50 cursor-pointer',
              ]"
              @click="handleRestoreAndBuildAnother"
            >
              <div v-if="isRestoring" :class="['i-solar:refresh-line-duotone text-xs animate-spin']" />
              <div v-else :class="['i-solar:add-circle-bold text-xs text-primary-500']" />
              <span>{{ t('onboarding.steps.triage.restore.restoreAndBuild') }}</span>
            </button>

            <!-- Route 4: Returning Restorer -->
            <Button
              variant="primary"
              size="md"
              :disabled="isRestoring"
              :class="[
                'flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2',
                'text-xs font-semibold text-white shadow-md shadow-emerald-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer',
              ]"
              @click="handleRestoreAndLaunch"
            >
              <div v-if="isRestoring" :class="['i-solar:refresh-line-duotone text-xs animate-spin']" />
              <div v-else :class="['i-solar:rocket-bold-duotone text-xs']" />
              <span>{{ isRestoring ? t('onboarding.steps.triage.restore.restoring') : t('onboarding.steps.triage.restore.restoreAll') }}</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- Connected Cloud Account (Fresh / Zero Backups) -->
      <div
        v-else-if="selectedPath === 'cloud' && isAuthenticated && !isLoadingCatalog"
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="350"
        :class="['p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between']"
      >
        <div :class="['flex items-center gap-2']">
          <div :class="['i-solar:check-circle-bold-duotone text-base text-emerald-500 shrink-0']" />
          <span>Connected to Cloudflare! No existing companion backups found in Cloudflare R2. Your new companion will automatically sync to your cloud vault.</span>
        </div>
        <button
          type="button"
          :class="['px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs cursor-pointer transition-colors shrink-0 ml-2']"
          @click="props.onNext"
        >
          Continue Setup (Cloud-Backed) →
        </button>
      </div>

      <!-- Catalog Scanning Indicator -->
      <div
        v-else-if="selectedPath === 'cloud' && isAuthenticated && isLoadingCatalog"
        :class="['p-3 rounded-xl border border-neutral-200 dark:border-white/5 bg-neutral-50 dark:bg-white/5 text-xs text-neutral-500 flex items-center justify-center gap-2 animate-pulse']"
      >
        <div :class="['i-solar:refresh-line-duotone animate-spin text-sm']" />
        <span>Checking Cloudflare R2 for companion backups...</span>
      </div>
    </div>

    <!-- Navigation Action Bar -->
    <div
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
        <span>{{ t('onboarding.shell.previous') }}</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium']">
        Path: <span :class="['text-neutral-700 dark:text-neutral-200 font-semibold']">{{ selectedPath === 'local' ? t('onboarding.steps.triage.local.title') : t('onboarding.steps.triage.cloud.title') }}</span>
      </div>

      <Button
        variant="primary"
        size="md"
        :class="[
          'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2',
          'text-xs font-semibold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95 cursor-pointer',
        ]"
        @click="props.onNext"
      >
        <span>{{ t('onboarding.shell.next') }}</span>
        <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
      </Button>
    </div>
  </div>
</template>
