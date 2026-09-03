<script setup lang="ts">
import { CloudflareConnectDialog } from '@proj-airi/stage-ui/components'
import { useCloudflareStore } from '@proj-airi/stage-ui/stores/modules/cloudflare'
import { useSyncEngineStore } from '@proj-airi/stage-ui/stores/sync-engine'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

const router = useRouter()
const cloudflareStore = useCloudflareStore()
const syncStore = useSyncEngineStore()

const {
  cfAccountId,
  cfSubdomain,
  isAuthenticated,
} = storeToRefs(cloudflareStore)

const isConnectModalOpen = ref(false)

// Subdomain management
const subdomainInput = ref('')
const isSavingSubdomain = ref(false)

// CORS Proxy
const isDeployingCors = ref(false)
const isTestingCors = ref(false)
const corsHealth = ref<'unknown' | 'online' | 'offline'>('unknown')

// Edge Vault
const isSavingVault = ref(false)
const isFetchingVault = ref(false)
const vaultStatus = ref<string>('')

onMounted(async () => {
  if (cfSubdomain.value) {
    subdomainInput.value = cfSubdomain.value
    void testCorsHealth()
  }
})

async function handleSaveSubdomain() {
  const clean = subdomainInput.value.trim().toLowerCase()
  if (!clean) {
    toast.error('Please enter a valid subdomain')
    return
  }
  isSavingSubdomain.value = true
  try {
    await cloudflareStore.setCloudflareSubdomain(clean)
    toast.success(`Subdomain '${clean}.workers.dev' confirmed!`)
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to set subdomain')
  }
  finally {
    isSavingSubdomain.value = false
  }
}

async function handleDeployCors() {
  isDeployingCors.value = true
  try {
    toast.info('Deploying CORS Reverse-Proxy worker to Cloudflare...')
    await cloudflareStore.deployCorsProxy()
    toast.success('CORS Reverse-Proxy worker deployed successfully!')
    await testCorsHealth()
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to deploy CORS Proxy worker')
  }
  finally {
    isDeployingCors.value = false
  }
}

async function testCorsHealth() {
  if (!cfSubdomain.value)
    return
  isTestingCors.value = true
  try {
    const res = await fetch(`https://airi-cors-proxy.${cfSubdomain.value}.workers.dev/health`)
    if (res.ok) {
      corsHealth.value = 'online'
    }
    else {
      corsHealth.value = 'offline'
    }
  }
  catch {
    corsHealth.value = 'offline'
  }
  finally {
    isTestingCors.value = false
  }
}

async function handleSaveToVault() {
  if (!syncStore.s3Endpoint || !syncStore.s3Bucket) {
    toast.error('Configure S3/R2 storage before saving to Edge Vault')
    return
  }
  isSavingVault.value = true
  try {
    const data = {
      s3Endpoint: syncStore.s3Endpoint,
      s3Bucket: syncStore.s3Bucket,
      s3Region: syncStore.s3Region || 'auto',
      s3AccessKeyId: syncStore.s3AccessKeyId,
      s3SecretAccessKey: syncStore.s3SecretAccessKey,
      activeProvider: 's3',
      savedAt: Date.now(),
    }
    await cloudflareStore.saveToEdgeVault(data)
    vaultStatus.value = `Credentials safely encrypted in KV (saved ${new Date().toLocaleTimeString()})`
    toast.success('Credentials stored to Edge Key Vault!')
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to save to Edge Vault')
  }
  finally {
    isSavingVault.value = false
  }
}

async function handleRestoreFromVault() {
  isFetchingVault.value = true
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
      vaultStatus.value = `Restored R2 credentials from KV (bucket: ${vault.s3Bucket})`
      toast.success('Restored R2 Cloud Sync credentials from Edge Key Vault!')
    }
    else {
      toast.info('No credential vault found in your Cloudflare KV.')
    }
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to fetch Edge Vault')
  }
  finally {
    isFetchingVault.value = false
  }
}

function handleDisconnect() {
  if (confirm('Disconnect your Cloudflare account? Your local companion data will remain completely safe.')) {
    cloudflareStore.logout()
    toast.info('Disconnected from Cloudflare')
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 font-sans">
    <!-- Hero / Account Status Header -->
    <div class="relative flex flex-col items-start justify-between gap-6 overflow-hidden border border-neutral-200/80 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur-xl md:flex-row md:items-center dark:border-neutral-800 dark:bg-neutral-900/60 sm:p-6">
      <div class="min-w-0 flex flex-1 items-start gap-4 sm:items-center">
        <div class="shadow-xs size-14 flex shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-3xl text-amber-500 sm:size-16 dark:bg-amber-500/20">
          <div class="i-solar:shield-network-bold-duotone" />
        </div>

        <div class="min-w-0 flex flex-1 flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <span
              v-if="isAuthenticated"
              class="flex items-center gap-1.5 border border-emerald-200 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 font-semibold dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-300"
            >
              <span class="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              Connected
            </span>
            <span
              v-else
              class="border border-neutral-200 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 font-semibold dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
            >
              Local-Only Mode
            </span>
          </div>

          <h2 class="truncate text-lg text-neutral-900 font-bold sm:text-xl dark:text-neutral-100">
            {{ isAuthenticated ? 'Cloudflare Edge Infrastructure' : 'Cloudflare Account (Disconnected)' }}
          </h2>

          <p class="text-xs text-neutral-500 sm:text-sm dark:text-neutral-400">
            {{ isAuthenticated ? `Connected Account ID: ${cfAccountId || 'OAuth Session'}` : 'Zero-custody personal edge workers, CORS reverse-proxy, and Key Vault.' }}
          </p>
        </div>
      </div>

      <!-- Quick Action Button -->
      <div class="flex shrink-0 items-center gap-3">
        <Button
          v-if="!isAuthenticated"
          variant="primary"
          class="flex items-center gap-1.5 font-bold shadow-md"
          @click="isConnectModalOpen = true"
        >
          <div class="i-solar:shield-keyhole-bold-duotone text-base" />
          <span>Connect Cloudflare</span>
        </Button>

        <Button
          v-else
          variant="secondary"
          class="font-bold !text-red-500 hover:!bg-red-500/10"
          @click="handleDisconnect"
        >
          Disconnect Account
        </Button>
      </div>
    </div>

    <!-- Main Configuration Grid -->
    <div v-if="isAuthenticated" class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <!-- Card 1: Workers Edge Subdomain -->
      <div class="shadow-xs flex flex-col justify-between gap-4 border border-neutral-200/80 rounded-3xl bg-white/70 p-5 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-900/60">
        <div>
          <div class="mb-2 flex items-center gap-2">
            <div class="size-8 flex items-center justify-center rounded-xl bg-purple-500/15 text-lg text-purple-600 dark:text-purple-400">
              <div class="i-solar:link-circle-bold-duotone" />
            </div>
            <h3 class="text-sm text-neutral-900 font-bold dark:text-neutral-100">
              Workers Subdomain
            </h3>
          </div>
          <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            Your unique Cloudflare Workers subdomain for routing reverse proxies and Discord character webhooks.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <div class="flex flex-1 items-center border border-neutral-300 rounded-xl bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800">
              <input
                v-model="subdomainInput"
                placeholder="subdomain"
                class="w-full bg-transparent font-mono outline-none"
              >
              <span class="shrink-0 text-neutral-400">.workers.dev</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              :disabled="isSavingSubdomain || !subdomainInput.trim()"
              class="shrink-0 font-semibold"
              @click="handleSaveSubdomain"
            >
              {{ isSavingSubdomain ? 'Saving...' : 'Update' }}
            </Button>
          </div>
        </div>
      </div>

      <!-- Card 2: Web CORS Reverse-Proxy Worker -->
      <div class="shadow-xs flex flex-col justify-between gap-4 border border-neutral-200/80 rounded-3xl bg-white/70 p-5 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-900/60">
        <div>
          <div class="mb-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="size-8 flex items-center justify-center rounded-xl bg-emerald-500/15 text-lg text-emerald-600 dark:text-emerald-400">
                <div class="i-solar:shield-check-bold-duotone" />
              </div>
              <h3 class="text-sm text-neutral-900 font-bold dark:text-neutral-100">
                Web CORS Proxy Worker
              </h3>
            </div>
            <span
              v-if="corsHealth === 'online'"
              class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 font-bold dark:bg-emerald-950/60 dark:text-emerald-300"
            >
              ONLINE
            </span>
            <span
              v-else-if="corsHealth === 'offline'"
              class="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700 font-bold dark:bg-red-950/60 dark:text-red-300"
            >
              OFFLINE
            </span>
          </div>
          <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            A serverless V8 worker (<code>airi-cors-proxy</code>) that eliminates browser CORS blocking for REST APIs on <code>stage-web</code>.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            :disabled="isDeployingCors || !cfSubdomain"
            class="flex items-center gap-1.5 font-bold"
            @click="handleDeployCors"
          >
            <div v-if="isDeployingCors" class="i-solar:restart-circle-bold-duotone animate-spin text-sm" />
            <div v-else class="i-solar:rocket-2-bold-duotone text-sm" />
            <span>{{ isDeployingCors ? 'Deploying...' : 'Deploy Worker' }}</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            :disabled="isTestingCors || !cfSubdomain"
            class="text-xs font-semibold"
            @click="testCorsHealth"
          >
            {{ isTestingCors ? 'Pinging...' : 'Ping Test' }}
          </Button>
        </div>
      </div>

      <!-- Card 3: Edge Key Vault (airi-edge-vault) -->
      <div class="shadow-xs flex flex-col justify-between gap-4 border border-neutral-200/80 rounded-3xl bg-white/70 p-5 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-900/60">
        <div>
          <div class="mb-2 flex items-center gap-2">
            <div class="size-8 flex items-center justify-center rounded-xl bg-amber-500/15 text-lg text-amber-600 dark:text-amber-400">
              <div class="i-solar:key-bold-duotone" />
            </div>
            <h3 class="text-sm text-neutral-900 font-bold dark:text-neutral-100">
              Edge Key Vault (KV)
            </h3>
          </div>
          <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            Encrypted Cloudflare KV namespace (<code>airi-edge-vault</code>) that synchronizes R2/S3 credentials so any device can restore cloud sync with 1 click.
          </p>
          <p v-if="vaultStatus" class="mt-2 text-xs text-emerald-600 font-semibold dark:text-emerald-400">
            {{ vaultStatus }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            :disabled="isSavingVault || !syncStore.s3Bucket"
            class="flex items-center gap-1.5 text-xs font-bold"
            @click="handleSaveToVault"
          >
            <div class="i-solar:lock-bold text-xs" />
            <span>Save to Vault</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            :disabled="isFetchingVault"
            class="text-xs font-semibold"
            @click="handleRestoreFromVault"
          >
            {{ isFetchingVault ? 'Fetching...' : 'Restore from Vault' }}
          </Button>
        </div>
      </div>

      <!-- Card 4: BYOS Cloud Storage Link -->
      <div class="shadow-xs flex flex-col justify-between gap-4 border border-neutral-200/80 rounded-3xl bg-white/70 p-5 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-900/60">
        <div>
          <div class="mb-2 flex items-center gap-2">
            <div class="size-8 flex items-center justify-center rounded-xl bg-primary-500/15 text-lg text-primary-600 dark:text-primary-400">
              <div class="i-solar:cloud-storage-bold-duotone" />
            </div>
            <h3 class="text-sm text-neutral-900 font-bold dark:text-neutral-100">
              Cloud Storage & Sync
            </h3>
          </div>
          <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            Configure automated multi-device synchronization using Cloudflare R2 or Amazon S3.
          </p>
          <div class="mt-2 text-xs text-neutral-600 font-mono dark:text-neutral-300">
            Bucket: <strong>{{ syncStore.s3Bucket || 'None' }}</strong> ({{ syncStore.syncEnabled ? 'Active' : 'Paused' }})
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            class="text-xs font-semibold"
            @click="router.push('/settings/modules/cloud-sync')"
          >
            Manage Cloud Sync &rarr;
          </Button>
          <Button
            size="sm"
            variant="secondary"
            class="text-xs font-semibold"
            @click="router.push('/settings/providers/cloud/s3')"
          >
            S3/R2 Keys &rarr;
          </Button>
        </div>
      </div>
    </div>

    <!-- Connect Dialog Modal -->
    <CloudflareConnectDialog v-model="isConnectModalOpen" />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.cloudflare.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.modules.cloudflare.description
  icon: i-solar:shield-network-bold-duotone
  settingsEntry: true
  order: 8.5
</route>
