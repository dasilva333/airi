<script setup lang="ts">
import { Button, FieldInput } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { useCloudflareStore } from '../../../../stores/modules/cloudflare'
import { useSyncEngineStore } from '../../../../stores/sync-engine'

const emit = defineEmits<{
  (e: 'connected'): void
}>()
const showDialog = defineModel<boolean>({ default: false })
const { t } = useI18n()
const cloudflareStore = useCloudflareStore()
const syncStore = useSyncEngineStore()

const {
  cfAccountId,
  cfSubdomain,
  isAuthenticating,
  isAuthenticated,
} = storeToRefs(cloudflareStore)

// Step: 1 = Auth, 2 = Subdomain & Vault Check, 3 = Restore or Backup, 4 = Success
const currentStep = ref<1 | 2 | 3 | 4>(1)

// Auth Mode
const isElectron = typeof window !== 'undefined' && Boolean((window as any).electron)
const authMode = ref<'oauth' | 'token'>(isElectron ? 'oauth' : 'token')
const apiTokenInput = ref('')
const isValidatingToken = ref(false)

// Subdomain
const subdomainInput = ref('')
const isClaimingSubdomain = ref(false)
const subdomainVerified = ref(false)

// Edge Vault & Remote State
const isCheckingVault = ref(false)
const hasVault = ref(false)
const remoteCatalogStats = ref<{ cards: number, models: number, hasData: boolean }>({
  cards: 0,
  models: 0,
  hasData: false,
})

// Auto-advance if already authenticated when opening
watch(showDialog, async (open) => {
  if (open) {
    if (isAuthenticated.value) {
      currentStep.value = 2
      subdomainInput.value = cfSubdomain.value || ''
      await runVaultCheck()
    }
    else {
      currentStep.value = 1
    }
  }
})

async function handleOAuthLogin() {
  try {
    const success = await cloudflareStore.authenticateWithCloudflare()
    if (success) {
      toast.success(t('settings.cloudflare.connect.oauth_success', 'Signed in with Cloudflare!'))
      currentStep.value = 2
      subdomainInput.value = cfSubdomain.value || ''
      await runVaultCheck()
    }
  }
  catch (err: any) {
    toast.error(err?.message || 'OAuth authentication failed')
  }
}

async function handleApiTokenLogin() {
  const token = apiTokenInput.value.trim()
  if (!token) {
    toast.error('Please enter a Cloudflare API Token')
    return
  }

  isValidatingToken.value = true
  try {
    await cloudflareStore.verifyAndSetApiToken(token)
    toast.success(t('settings.cloudflare.connect.token_success', 'API Token verified!'))
    currentStep.value = 2
    subdomainInput.value = cfSubdomain.value || ''
    await runVaultCheck()
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to verify API Token')
  }
  finally {
    isValidatingToken.value = false
  }
}

async function handleClaimSubdomain() {
  const clean = subdomainInput.value.trim().toLowerCase()
  if (!clean) {
    toast.error('Please enter a subdomain name')
    return
  }

  isClaimingSubdomain.value = true
  try {
    await cloudflareStore.setCloudflareSubdomain(clean)
    subdomainVerified.value = true
    toast.success(`Subdomain '${clean}.workers.dev' claimed!`)
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to claim subdomain')
  }
  finally {
    isClaimingSubdomain.value = false
  }
}

async function runVaultCheck() {
  isCheckingVault.value = true
  try {
    // 1. Check KV Edge Vault
    const vault = await cloudflareStore.fetchFromEdgeVault()
    if (vault && vault.s3Endpoint && vault.s3Bucket) {
      hasVault.value = true
      syncStore.s3Endpoint = vault.s3Endpoint
      syncStore.s3Bucket = vault.s3Bucket
      syncStore.s3Region = vault.s3Region || 'auto'
      syncStore.s3AccessKeyId = vault.s3AccessKeyId || ''
      syncStore.s3SecretAccessKey = vault.s3SecretAccessKey || ''
      syncStore.activeProvider = 's3'
      syncStore.syncEnabled = true

      // 2. Scan remote catalog
      const catalog = await syncStore.getRemoteCatalog()
      if (catalog && catalog.success) {
        const cardsCount = catalog.cards?.length || 0
        const modelsCount = catalog.models?.length || 0
        remoteCatalogStats.value = {
          cards: cardsCount,
          models: modelsCount,
          hasData: cardsCount > 0 || modelsCount > 0,
        }
      }
    }
  }
  catch (e) {
    console.warn('[CloudflareConnectDialog] Vault check:', e)
  }
  finally {
    isCheckingVault.value = false
  }
}

async function handleRestoreSync(checkedIds: string[]) {
  try {
    toast.info('Restoring companion data from Cloudflare R2...')
    syncStore.selectiveCheckedIds = checkedIds
    syncStore.selectiveSyncEnabled = true
    await syncStore.triggerSync()
    toast.success('Successfully restored from cloud!')
    currentStep.value = 4
  }
  catch (err: any) {
    toast.error(err?.message || 'Restore failed')
  }
}

async function handleBackupLocalToCloud() {
  try {
    toast.info('Backing up local life to Cloudflare R2...')
    syncStore.syncEnabled = true
    syncStore.selectiveSyncEnabled = false
    await syncStore.triggerSync()
    toast.success('Local companion data successfully backed up to Cloud!')
    currentStep.value = 4
  }
  catch (err: any) {
    toast.error(err?.message || 'Backup failed')
  }
}

function handleFinish() {
  emit('connected')
  showDialog.value = false
}
</script>

<template>
  <DialogRoot :open="showDialog" @update:open="val => showDialog = val">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-[9999] max-h-[90dvh] max-w-xl w-[94dvw] flex flex-col transform overflow-hidden border border-neutral-200/80 rounded-3xl bg-white/95 p-6 shadow-2xl outline-none backdrop-blur-xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-800/80 dark:bg-neutral-900/95 sm:p-7">
        <!-- Header -->
        <div class="mb-5 flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div class="shadow-xs size-11 flex shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-2xl text-amber-500 dark:bg-amber-500/20">
              <div class="i-solar:cloud-bold-duotone" />
            </div>
            <div>
              <DialogTitle class="text-lg text-neutral-900 font-bold sm:text-xl dark:text-neutral-100">
                Connect Cloudflare Account
              </DialogTitle>
              <DialogDescription class="text-xs text-neutral-500 dark:text-neutral-400">
                Local-First & Zero-Custody edge infrastructure on your own account.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            class="rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
            @click="showDialog = false"
          >
            <div class="i-solar:close-circle-bold-duotone text-2xl" />
          </button>
        </div>

        <!-- Body Content -->
        <div class="flex-1 overflow-y-auto pr-1 scrollbar-none">
          <!-- Step 1: Authentication -->
          <div v-if="currentStep === 1" class="flex flex-col gap-5">
            <div class="border border-neutral-200/70 rounded-2xl bg-neutral-50/70 p-4 dark:border-neutral-800/70 dark:bg-neutral-800/50">
              <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
                Connecting your personal Cloudflare account enables <strong>CORS reverse proxying</strong>, <strong>24/7 Discord bots</strong>, and <strong>multi-device R2 backup</strong> without any intermediate AIRI servers.
              </p>
            </div>

            <!-- Auth Mode Switcher -->
            <div class="flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800/80">
              <button
                type="button"
                :class="[
                  'flex-1 py-2 text-xs font-semibold rounded-lg transition-all',
                  authMode === 'oauth'
                    ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
                ]"
                @click="authMode = 'oauth'"
              >
                1-Click OAuth (Recommended)
              </button>
              <button
                type="button"
                :class="[
                  'flex-1 py-2 text-xs font-semibold rounded-lg transition-all',
                  authMode === 'token'
                    ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
                ]"
                @click="authMode = 'token'"
              >
                Manual API Token
              </button>
            </div>

            <!-- OAuth Pane -->
            <div v-if="authMode === 'oauth'" class="flex flex-col items-center gap-4 py-3 text-center">
              <div class="size-14 flex items-center justify-center rounded-2xl bg-amber-500/10 text-3xl text-amber-500">
                <div class="i-solar:shield-keyhole-bold-duotone" />
              </div>
              <div>
                <h4 class="text-sm text-neutral-800 font-bold dark:text-neutral-200">
                  Authenticate via Cloudflare Dashboard
                </h4>
                <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  A secure authorization window will open to grant access to your Workers and KV.
                </p>
              </div>

              <Button
                variant="primary"
                :disabled="isAuthenticating"
                class="w-full flex items-center justify-center gap-2 py-2.5 font-bold shadow-md"
                @click="handleOAuthLogin"
              >
                <div v-if="isAuthenticating" class="i-solar:restart-circle-bold-duotone animate-spin text-base" />
                <div v-else class="i-solar:lock-keyhole-minimalistic-bold text-base" />
                <span>{{ isAuthenticating ? 'Authorizing with Cloudflare...' : 'Sign In with Cloudflare' }}</span>
              </Button>
            </div>

            <!-- API Token Pane -->
            <div v-else class="flex flex-col gap-3 py-2">
              <div>
                <label class="mb-1 block text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                  Cloudflare API Token
                </label>
                <FieldInput
                  v-model="apiTokenInput"
                  type="password"
                  placeholder="Paste your Cloudflare API token..."
                  class="w-full"
                />
                <p class="mt-1.5 text-[11px] text-neutral-400">
                  Must have <code>Workers Scripts:Edit</code> and <code>Account Settings:Read</code> permissions.
                </p>
              </div>

              <Button
                variant="primary"
                :disabled="isValidatingToken || !apiTokenInput.trim()"
                class="mt-2 w-full flex items-center justify-center gap-2 py-2.5 font-bold shadow-md"
                @click="handleApiTokenLogin"
              >
                <div v-if="isValidatingToken" class="i-solar:restart-circle-bold-duotone animate-spin text-base" />
                <div v-else class="i-solar:check-circle-bold text-base" />
                <span>Verify and Connect</span>
              </Button>
            </div>
          </div>

          <!-- Step 2: Subdomain & Vault Probe -->
          <div v-else-if="currentStep === 2" class="flex flex-col gap-5">
            <div class="flex items-center gap-2 text-xs text-emerald-600 font-semibold dark:text-emerald-400">
              <div class="i-solar:check-circle-bold text-base" />
              <span>Cloudflare Account Connected (ID: {{ cfAccountId.slice(0, 10) }}...)</span>
            </div>

            <!-- Subdomain Card -->
            <div class="border border-neutral-200/80 rounded-2xl bg-neutral-50/70 p-4 dark:border-neutral-800/80 dark:bg-neutral-800/50">
              <label class="mb-1 block text-xs text-neutral-800 font-bold dark:text-neutral-200">
                Workers Subdomain
              </label>
              <p class="mb-3 text-[11px] text-neutral-500 dark:text-neutral-400">
                Used to route CORS proxy requests and serverless character webhooks.
              </p>

              <div class="flex items-center gap-2">
                <div class="flex flex-1 items-center border border-neutral-300 rounded-xl bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900">
                  <input
                    v-model="subdomainInput"
                    placeholder="my-subdomain"
                    class="w-full bg-transparent font-mono outline-none"
                  >
                  <span class="shrink-0 text-neutral-400">.workers.dev</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  :disabled="isClaimingSubdomain || !subdomainInput.trim()"
                  class="shrink-0 font-semibold"
                  @click="handleClaimSubdomain"
                >
                  {{ isClaimingSubdomain ? 'Saving...' : 'Confirm' }}
                </Button>
              </div>
            </div>

            <!-- Vault Probe Card -->
            <div class="border border-neutral-200/80 rounded-2xl bg-neutral-50/70 p-4 dark:border-neutral-800/80 dark:bg-neutral-800/50">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
                    Edge Key Vault & Remote Storage
                  </h4>
                  <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Checking for existing companion backups in Cloudflare KV...
                  </p>
                </div>
                <div v-if="isCheckingVault" class="i-solar:restart-circle-bold-duotone animate-spin text-base text-primary-500" />
              </div>

              <div v-if="hasVault" class="mt-3 border border-emerald-500/20 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                <div class="flex items-center gap-1.5 font-bold">
                  <div class="i-solar:cloud-check-bold text-sm" />
                  <span>Existing Vault Found!</span>
                </div>
                <p class="mt-1 text-[11px] text-emerald-600/90 dark:text-emerald-400/90">
                  Found remote backups ({{ remoteCatalogStats.cards }} cards, {{ remoteCatalogStats.models }} models).
                </p>
              </div>

              <div v-else-if="!isCheckingVault" class="mt-3 rounded-xl bg-neutral-100 p-3 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                No existing remote vault found. This device will initialize a fresh edge vault.
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-end gap-3 pt-2">
              <Button
                v-if="hasVault && remoteCatalogStats.hasData"
                variant="primary"
                class="font-bold"
                @click="currentStep = 3"
              >
                Choose Restore or Backup &rarr;
              </Button>
              <Button
                v-else
                variant="primary"
                class="font-bold"
                @click="currentStep = 4"
              >
                Complete Connection &rarr;
              </Button>
            </div>
          </div>

          <!-- Step 3: Restore or Backup -->
          <div v-else-if="currentStep === 3" class="flex flex-col gap-4">
            <h4 class="text-sm text-neutral-800 font-bold dark:text-neutral-200">
              Synchronize Companion Data
            </h4>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              Choose whether to download your companion data from Cloudflare R2 or upload your current local data.
            </p>

            <div class="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
              <!-- Option A: Restore from Cloud -->
              <div
                class="flex flex-col justify-between gap-3 border-2 border-primary-500/60 rounded-2xl bg-primary-500/5 p-4 transition-colors hover:border-primary-500"
              >
                <div>
                  <div class="mb-2 size-9 flex items-center justify-center rounded-xl bg-primary-500/15 text-xl text-primary-600 dark:text-primary-400">
                    <div class="i-solar:cloud-download-bold-duotone" />
                  </div>
                  <h5 class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
                    Restore from Cloud
                  </h5>
                  <p class="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    Download {{ remoteCatalogStats.cards }} cards & memories from your cloud bucket to this device.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  class="w-full font-bold"
                  @click="handleRestoreSync([])"
                >
                  Pull from Cloud
                </Button>
              </div>

              <!-- Option B: Upload Local Life -->
              <div
                class="flex flex-col justify-between gap-3 border-2 border-neutral-200 rounded-2xl bg-neutral-50/50 p-4 transition-colors dark:border-neutral-800 hover:border-neutral-400 dark:bg-neutral-800/40"
              >
                <div>
                  <div class="mb-2 size-9 flex items-center justify-center rounded-xl bg-neutral-200 text-xl text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                    <div class="i-solar:cloud-upload-bold-duotone" />
                  </div>
                  <h5 class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
                    Push Local Life to Cloud
                  </h5>
                  <p class="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    Keep local cards and upload them to Cloudflare R2 as your new cloud baseline.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  class="w-full font-bold"
                  @click="handleBackupLocalToCloud"
                >
                  Push to Cloud
                </Button>
              </div>
            </div>
          </div>

          <!-- Step 4: Success -->
          <div v-else-if="currentStep === 4" class="flex flex-col items-center gap-4 py-4 text-center">
            <div class="size-16 flex items-center justify-center rounded-3xl bg-emerald-500/15 text-4xl text-emerald-500 shadow-md">
              <div class="i-solar:check-circle-bold" />
            </div>

            <div>
              <h3 class="text-base text-neutral-900 font-bold dark:text-neutral-100">
                Cloudflare Account Connected!
              </h3>
              <p class="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
                Your zero-custody edge services are linked. Your companion state and backups will automatically persist to your Cloudflare account.
              </p>
            </div>

            <Button
              variant="primary"
              class="mt-2 max-w-xs w-full font-bold shadow-md"
              @click="handleFinish"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
