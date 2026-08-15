<script setup lang="ts">
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { storeToRefs } from 'pinia'
import { inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useCloudflareStore } from '../../../../../../stores/modules/cloudflare'
import { useSyncEngineStore } from '../../../../../../stores/sync-engine'
import { onboardingV2GateKey } from '../gate'

const cloudflareStore = useCloudflareStore()
const syncStore = useSyncEngineStore()
const gate = inject(onboardingV2GateKey)

const { cfSubdomain } = storeToRefs(cloudflareStore)

// --- Edge Services Toggles ---
const corsProxyEnabled = useLocalStorageManualReset<boolean>('settings/cloudflare/corsProxyEnabled', true)
const discordRelayEnabled = useLocalStorageManualReset<boolean>('settings/cloudflare/discordRelayEnabled', true)
const saveToEdgeVault = useLocalStorageManualReset<boolean>('settings/cloudflare/saveToEdgeVault', true)

// --- Subdomain State ---
const subdomainInput = ref('')
const isSavingSubdomain = ref(false)
const subdomainVerified = ref(false)

// --- Remote Vault Inspection State ---
const isScanningRemote = ref(false)
const remoteStats = ref<{
  cardsCount: number
  modelsCount: number
  motionsCount: number
  hasVault: boolean
}>({
  cardsCount: 0,
  modelsCount: 0,
  motionsCount: 0,
  hasVault: false,
})

async function checkRemoteVault() {
  isScanningRemote.value = true
  try {
    const catalog = await syncStore.getRemoteCatalog()
    if (catalog && catalog.success) {
      const cards = catalog.cards?.length || 0
      const models = catalog.models?.length || 0
      const motions = (catalog.vmds?.length || 0) + (catalog.vrmas?.length || 0)

      remoteStats.value = {
        cardsCount: cards,
        modelsCount: models,
        motionsCount: motions,
        hasVault: models > 0 || cards > 0 || motions > 0,
      }
    }
  }
  catch {
    // If not reachable or empty bucket, remains fresh vault
  }
  finally {
    isScanningRemote.value = false
  }
}

async function handleSaveSubdomain() {
  const clean = subdomainInput.value.trim().toLowerCase()
  if (!clean) {
    toast.error('Please enter a valid subdomain name')
    return
  }
  isSavingSubdomain.value = true
  try {
    await cloudflareStore.setCloudflareSubdomain(clean)
    subdomainVerified.value = true
    toast.success(`Subdomain '${clean}.workers.dev' registered!`)
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to claim subdomain')
  }
  finally {
    isSavingSubdomain.value = false
  }
}

async function syncCredentialsToEdgeVault() {
  if (!saveToEdgeVault.value)
    return
  if (!syncStore.s3Endpoint || !syncStore.s3Bucket)
    return
  try {
    const vaultData = {
      s3Endpoint: syncStore.s3Endpoint,
      s3Bucket: syncStore.s3Bucket,
      s3Region: syncStore.s3Region || 'auto',
      s3AccessKeyId: syncStore.s3AccessKeyId,
      s3SecretAccessKey: syncStore.s3SecretAccessKey,
      activeProvider: 's3',
      savedAt: Date.now(),
    }
    await cloudflareStore.saveToEdgeVault(vaultData)
  }
  catch (e) {
    console.warn('[CloudInfrastructure] Failed to sync credentials to Edge Vault:', e)
  }
}

async function deployCorsProxyService() {
  if (!corsProxyEnabled.value)
    return
  try {
    await cloudflareStore.deployCorsProxy()
  }
  catch (e) {
    console.warn('[CloudInfrastructure] Failed to deploy CORS proxy worker:', e)
  }
}

onMounted(async () => {
  gate?.setGate('cloud-infrastructure', {
    canProceed: true,
    hint: 'Cloud services configured',
  })

  // Load existing subdomain if known
  if (cfSubdomain.value) {
    subdomainInput.value = cfSubdomain.value
    subdomainVerified.value = true
  }
  else {
    const sub = await cloudflareStore.getCloudflareSubdomain()
    if (sub) {
      subdomainInput.value = sub
      subdomainVerified.value = true
    }
  }

  // Scan remote storage
  void checkRemoteVault()

  // Save current R2 credentials to Edge Vault
  void syncCredentialsToEdgeVault()

  // Deploy CORS proxy worker if enabled
  void deployCorsProxyService()
})

onBeforeUnmount(() => {
  void syncCredentialsToEdgeVault()
  void deployCorsProxyService()
  gate?.clearGate('cloud-infrastructure')
})
</script>

<template>
  <div class="h-full flex flex-col gap-5 overflow-y-auto px-1 font-sans">
    <div
      v-motion
      :initial="{ opacity: 0, y: -10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      class="text-center"
    >
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Cloud Infrastructure & Edge Services
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Configure your Cloudflare edge services and prepare your zero-trust companion workspace.
      </p>
    </div>

    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="500"
      :delay="100"
      class="flex flex-col gap-4"
    >
      <!-- Subdomain Registration Card -->
      <div class="border border-neutral-200/60 rounded-2xl bg-white/40 p-4 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40">
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="rounded-xl bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
              <div class="i-solar:link-circle-bold-duotone h-4 w-4" />
            </div>
            <div>
              <h3 class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
                Workers Edge Subdomain
              </h3>
              <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                Unique domain for deploying Discord webhooks & serverless relay workers.
              </p>
            </div>
          </div>
          <span
            v-if="subdomainVerified"
            class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400"
          >
            ACTIVE
          </span>
        </div>

        <div class="mt-3 flex items-center gap-2">
          <div class="relative flex flex-1 items-center border border-neutral-300 rounded-xl bg-white/80 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800/80">
            <input
              v-model="subdomainInput"
              type="text"
              placeholder="my-companion-agent"
              class="w-full bg-transparent text-neutral-800 font-mono outline-none dark:text-neutral-100"
              @keyup.enter="handleSaveSubdomain"
            >
            <span class="select-none text-neutral-400">.workers.dev</span>
          </div>
          <button
            class="flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-xs text-white font-medium shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed hover:bg-primary-600 disabled:opacity-50"
            :disabled="isSavingSubdomain || !subdomainInput.trim()"
            @click="handleSaveSubdomain"
          >
            <div v-if="isSavingSubdomain" class="i-solar:refresh-line-duotone h-3.5 w-3.5 animate-spin" />
            <span>{{ subdomainVerified ? 'Update' : 'Claim' }}</span>
          </button>
        </div>
      </div>

      <!-- Edge Services Toggles Grid -->
      <div class="border border-neutral-200/60 rounded-2xl bg-white/40 p-4 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40">
        <h3 class="mb-3 text-xs text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
          Edge Service Modules
        </h3>
        <div class="space-y-3">
          <!-- CORS Reverse Proxy -->
          <label class="flex cursor-pointer items-start justify-between gap-3">
            <div class="flex items-start gap-2.5">
              <div class="mt-0.5 rounded-lg bg-indigo-500/10 p-1.5 text-indigo-600 dark:text-indigo-400">
                <div class="i-solar:shield-check-bold-duotone h-4 w-4" />
              </div>
              <div>
                <div class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                  Web CORS Reverse-Proxy Worker
                </div>
                <div class="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                  Bypasses browser CORS restrictions for web-based providers on web clients.
                </div>
              </div>
            </div>
            <input
              v-model="corsProxyEnabled"
              type="checkbox"
              class="mt-1 h-4 w-4 accent-primary-500"
            >
          </label>

          <div class="h-px bg-neutral-200/60 dark:bg-neutral-800/80" />

          <!-- Discord Cloud Relay -->
          <label class="flex cursor-pointer items-start justify-between gap-3">
            <div class="flex items-start gap-2.5">
              <div class="mt-0.5 rounded-lg bg-purple-500/10 p-1.5 text-purple-600 dark:text-purple-400">
                <div class="i-solar:chat-round-line-bold-duotone h-4 w-4" />
              </div>
              <div>
                <div class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                  Always-On Discord Cloud Relay
                </div>
                <div class="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                  Pre-configures serverless worker triggers for 24/7 background companion interactions.
                </div>
              </div>
            </div>
            <input
              v-model="discordRelayEnabled"
              type="checkbox"
              class="mt-1 h-4 w-4 accent-primary-500"
            >
          </label>

          <div class="h-px bg-neutral-200/60 dark:bg-neutral-800/80" />

          <!-- Edge Key Vault -->
          <label class="flex cursor-pointer items-start justify-between gap-3">
            <div class="flex items-start gap-2.5">
              <div class="mt-0.5 rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
                <div class="i-solar:key-bold-duotone h-4 w-4" />
              </div>
              <div>
                <div class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                  Save Credentials to Edge Key Vault (airi-edge-vault)
                </div>
                <div class="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                  Encrypts R2/S3 credentials to Cloudflare KV for 1-click companion restore on new devices.
                </div>
              </div>
            </div>
            <input
              v-model="saveToEdgeVault"
              type="checkbox"
              class="mt-1 h-4 w-4 accent-primary-500"
            >
          </label>
        </div>
      </div>

      <!-- Remote Storage Inspection Status -->
      <div
        class="border rounded-2xl p-4 transition-all"
        :class="[
          remoteStats.hasVault
            ? 'bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-500/5 dark:border-emerald-500/20'
            : 'bg-white/40 border-neutral-200/60 dark:bg-neutral-900/40 dark:border-neutral-800/80',
        ]"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div
              class="rounded-xl p-2"
              :class="remoteStats.hasVault ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'"
            >
              <div class="i-solar:cloud-storage-line-duotone h-4 w-4" />
            </div>
            <div>
              <h4 class="text-xs text-neutral-800 font-bold dark:text-neutral-100">
                {{ remoteStats.hasVault ? 'Remote Companion Backup Detected' : 'Cloud Vault Ready (airi-sync)' }}
              </h4>
              <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                {{ remoteStats.hasVault ? 'Found existing companion assets in your R2 bucket.' : 'No existing companion data found. Initialized for fresh sync.' }}
              </p>
            </div>
          </div>
          <div v-if="isScanningRemote" class="i-solar:refresh-line-duotone h-4 w-4 animate-spin text-neutral-400" />
        </div>

        <!-- Detected Assets Stats Badges -->
        <div v-if="remoteStats.hasVault" class="mt-3 flex flex-wrap items-center gap-2 border-t border-emerald-500/15 pt-2">
          <div class="rounded-lg bg-white/80 px-2.5 py-1 text-[11px] text-neutral-700 font-medium shadow-sm dark:bg-neutral-800 dark:text-neutral-200">
            📇 {{ remoteStats.cardsCount }} Character Cards
          </div>
          <div class="rounded-lg bg-white/80 px-2.5 py-1 text-[11px] text-neutral-700 font-medium shadow-sm dark:bg-neutral-800 dark:text-neutral-200">
            🎭 {{ remoteStats.modelsCount }} Display Models
          </div>
          <div class="rounded-lg bg-white/80 px-2.5 py-1 text-[11px] text-neutral-700 font-medium shadow-sm dark:bg-neutral-800 dark:text-neutral-200">
            🎬 {{ remoteStats.motionsCount }} Motions & Animations
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
