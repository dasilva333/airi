<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useCloudflareStore } from '../../../../stores/modules/cloudflare'
import { useSyncEngineStore } from '../../../../stores/sync-engine'

interface Props {
  onNext?: () => void
  onPrevious?: () => void
  onSelectPath?: (path: 'new' | 'returning') => void
}

const props = defineProps<Props>()
const cloudflareStore = useCloudflareStore()
const syncStore = useSyncEngineStore()
const { cfOAuthTokens, cfAccountId, cfApiToken, isAuthenticating, isAuthenticated } = storeToRefs(cloudflareStore)

const selectedPath = ref<'new' | 'returning'>(isAuthenticated.value ? 'returning' : 'new')

// Auth method tabs ('token' is default for maximum cross-platform reliability)
const authMethod = ref<'token' | 'oauth'>('token')
const tokenInput = ref('')
const isValidatingToken = ref(false)
const manualCodeInput = ref('')
const isExchangingCode = ref(false)
const showPassword = ref(false)

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
      console.warn('[StepStartChoice] Failed to restore from Edge Vault:', e)
    }
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
    toast.success('Successfully connected Cloudflare API Token!')
    tokenInput.value = ''
    await restoreVaultCredentials()
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to verify Cloudflare API token')
  }
  finally {
    isValidatingToken.value = false
  }
}

async function handleStartOAuth() {
  try {
    await cloudflareStore.authenticateWithCloudflare()
    toast.success('Successfully connected to Cloudflare!')
    await restoreVaultCredentials()
  }
  catch (err: any) {
    toast.error(err?.message || 'Cloudflare authentication failed')
  }
}

async function handleManualCodeSubmit() {
  const clean = manualCodeInput.value.trim()
  if (!clean) {
    toast.error('Please paste the authorization code or callback URL')
    return
  }
  isExchangingCode.value = true
  try {
    await cloudflareStore.handleManualCallbackInput(clean)
    toast.success('Successfully connected via authorization code!')
    manualCodeInput.value = ''
    await restoreVaultCredentials()
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to exchange authorization code')
  }
  finally {
    isExchangingCode.value = false
  }
}

function handleCardClick() {
  selectedPath.value = 'returning'
  if (isAuthenticated.value) {
    void restoreVaultCredentials()
  }
}

function handleSignOutClick(e: Event) {
  e.stopPropagation()
  cloudflareStore.logout()
  selectedPath.value = 'new'
  toast.info('Disconnected from Cloudflare')
}

watch(isAuthenticated, (authed) => {
  if (authed) {
    selectedPath.value = 'returning'
    void restoreVaultCredentials()
  }
}, { immediate: true })

watch(selectedPath, (path) => {
  props.onSelectPath?.(path)
}, { immediate: true })
</script>

<template>
  <div class="h-full flex flex-col gap-4 font-sans">
    <div
      v-motion
      :initial="{ opacity: 0, y: -10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      class="text-center"
    >
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Choose Your Path
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Choose how you want to configure your companion.
      </p>
    </div>

    <!-- Choice Selection Cards -->
    <div class="flex flex-1 flex-col justify-start overflow-y-auto px-1">
      <div
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="500"
        :delay="100"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <!-- New User Option -->
        <div
          class="relative flex flex-col cursor-pointer justify-between overflow-hidden border-2 rounded-2xl p-4 transition-all duration-300 ease-out"
          :class="[
            selectedPath === 'new'
              ? 'bg-gradient-to-br from-primary-500/10 to-indigo-500/10 border-primary-500 dark:border-primary-400 shadow-lg shadow-primary-500/5'
              : 'bg-white/40 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800/80 hover:border-primary-500/50 dark:hover:border-primary-400/50 backdrop-blur-md',
          ]"
          @click="selectedPath = 'new'"
        >
          <div>
            <div class="mb-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div
                  class="rounded-xl p-2.5"
                  :class="[
                    selectedPath === 'new'
                      ? 'bg-primary-500 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300',
                  ]"
                >
                  <div class="i-solar:stars-line-duotone h-5 w-5" />
                </div>
                <span class="rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] text-primary-600 font-bold dark:text-primary-400">
                  LOCAL-FIRST
                </span>
              </div>
              <div
                class="h-5 w-5 flex items-center justify-center border-2 rounded-full transition-colors"
                :class="selectedPath === 'new' ? 'border-primary-500 dark:border-primary-400' : 'border-neutral-300 dark:border-neutral-600'"
              >
                <div v-if="selectedPath === 'new'" class="h-2.5 w-2.5 rounded-full bg-primary-500 dark:bg-primary-400" />
              </div>
            </div>
            <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
              Local Companion (Offline)
            </h3>
            <p class="mt-1.5 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              100% private, on-device setup for brain, voice, avatar, and persona. No account required.
            </p>
          </div>
        </div>

        <!-- Cloudflare Connected Option -->
        <div
          class="relative flex flex-col justify-between overflow-hidden border-2 rounded-2xl p-4 transition-all duration-300 ease-out"
          :class="[
            selectedPath === 'returning'
              ? isAuthenticated
                ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500 dark:border-emerald-400 shadow-lg shadow-emerald-500/5'
                : 'bg-gradient-to-br from-primary-500/10 to-indigo-500/10 border-primary-500 dark:border-primary-400 shadow-lg shadow-primary-500/5'
              : 'bg-white/40 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800/80 hover:border-primary-500/50 dark:hover:border-primary-400/50 backdrop-blur-md cursor-pointer',
          ]"
          @click="handleCardClick"
        >
          <div>
            <div class="mb-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div
                  class="rounded-xl p-2.5 transition-colors"
                  :class="[
                    isAuthenticated
                      ? 'bg-emerald-500 text-white'
                      : selectedPath === 'returning'
                        ? 'bg-primary-500 text-white'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300',
                  ]"
                >
                  <div class="i-solar:cloud-storage-line-duotone h-5 w-5" />
                </div>
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  :class="isAuthenticated ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-primary-500/15 text-primary-600 dark:text-primary-400'"
                >
                  {{ isAuthenticated ? 'CONNECTED' : 'ZERO-TRUST' }}
                </span>
              </div>
              <div
                class="h-5 w-5 flex items-center justify-center border-2 rounded-full transition-colors"
                :class="selectedPath === 'returning' ? (isAuthenticated ? 'border-emerald-500 dark:border-emerald-400' : 'border-primary-500 dark:border-primary-400') : 'border-neutral-300 dark:border-neutral-600'"
              >
                <div
                  v-if="selectedPath === 'returning'"
                  class="h-2.5 w-2.5 rounded-full"
                  :class="isAuthenticated ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-primary-500 dark:bg-primary-400'"
                />
              </div>
            </div>
            <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
              Sign In with Cloudflare
            </h3>
            <p v-if="!isAuthenticated" class="mt-1.5 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              Sync existing companions across devices, or connect a fresh account for automated edge relays and private zero-trust backups.
            </p>

            <!-- Authenticated Proof / Token Display -->
            <div v-else class="mt-2.5 border border-emerald-500/20 rounded-xl bg-emerald-500/10 p-2.5 text-xs dark:bg-emerald-500/5">
              <div class="flex items-center justify-between text-emerald-700 font-semibold dark:text-emerald-300">
                <span class="flex items-center gap-1.5">
                  <div class="i-solar:check-circle-bold-duotone h-4 w-4" />
                  {{ cfOAuthTokens?.accessToken ? 'Authenticated via PKCE' : 'Authenticated via API Token' }}
                </span>
                <button
                  class="text-[10px] text-neutral-500 underline dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  @click="handleSignOutClick"
                >
                  Disconnect
                </button>
              </div>
              <div class="mt-1 truncate text-[10px] text-neutral-600 font-mono dark:text-neutral-300">
                <span class="text-neutral-400">Account:</span> {{ cfAccountId || cfOAuthTokens?.accountId || 'Default Account' }}
              </div>
              <div class="mt-0.5 truncate text-[10px] text-neutral-500 font-mono dark:text-neutral-400">
                <span class="text-neutral-400">Token:</span> {{ cfOAuthTokens?.accessToken ? `${cfOAuthTokens.accessToken.slice(0, 8)}••••••••${cfOAuthTokens.accessToken.slice(-6)}` : (cfApiToken ? `${cfApiToken.slice(0, 8)}••••••••${cfApiToken.slice(-6)}` : 'Active') }}
              </div>
            </div>

            <!-- Authentication Form (When Returning Path is Selected but Unauthenticated) -->
            <div v-if="selectedPath === 'returning' && !isAuthenticated" class="mt-3 border-t border-neutral-200/60 pt-3 dark:border-neutral-800/80">
              <!-- Method Selector Tabs -->
              <div class="mb-3 flex rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
                <button
                  class="flex-1 rounded-md py-1 text-center text-[11px] font-medium transition-all"
                  :class="authMethod === 'token' ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'"
                  @click.stop="authMethod = 'token'"
                >
                  API Token (Direct)
                </button>
                <button
                  class="flex-1 rounded-md py-1 text-center text-[11px] font-medium transition-all"
                  :class="authMethod === 'oauth' ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'"
                  @click.stop="authMethod = 'oauth'"
                >
                  Browser OAuth
                </button>
              </div>

              <!-- Tab 1: API Token -->
              <div v-if="authMethod === 'token'" class="flex flex-col gap-2" @click.stop>
                <div class="relative flex items-center border border-neutral-300 rounded-xl bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-800/90">
                  <input
                    v-model="tokenInput"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="Workers, KV, & R2 API Token"
                    class="w-full bg-transparent pr-7 text-xs text-neutral-800 font-mono outline-none dark:text-neutral-100 placeholder:text-neutral-400"
                    @keyup.enter="handleConnectApiToken"
                  >
                  <button
                    type="button"
                    class="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    @click="showPassword = !showPassword"
                  >
                    <div :class="showPassword ? 'i-solar:eye-closed-linear' : 'i-solar:eye-linear'" class="h-3.5 w-3.5" />
                  </button>
                </div>

                <div class="flex items-center justify-between gap-2">
                  <a
                    href="https://dash.cloudflare.com/profile/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[10px] text-primary-600 underline dark:text-primary-400 hover:text-primary-700"
                  >
                    Create Cloudflare Token ↗
                  </a>
                  <button
                    class="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs text-white font-medium shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed hover:bg-primary-600 disabled:opacity-50"
                    :disabled="isValidatingToken || !tokenInput.trim()"
                    @click="handleConnectApiToken"
                  >
                    <div v-if="isValidatingToken" class="i-solar:refresh-line-duotone h-3.5 w-3.5 animate-spin" />
                    <span>{{ isValidatingToken ? 'Connecting...' : 'Connect' }}</span>
                  </button>
                </div>
              </div>

              <!-- Tab 2: Browser OAuth PKCE -->
              <div v-else class="flex flex-col gap-2.5" @click.stop>
                <button
                  class="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-500 py-2 text-xs text-white font-medium shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed hover:bg-primary-600 disabled:opacity-50"
                  :disabled="isAuthenticating"
                  @click="handleStartOAuth"
                >
                  <div v-if="isAuthenticating" class="i-solar:refresh-line-duotone h-3.5 w-3.5 animate-spin" />
                  <div v-else class="i-solar:login-2-linear h-3.5 w-3.5" />
                  <span>{{ isAuthenticating ? 'Waiting for Browser Authorization...' : 'Authorize in Browser' }}</span>
                </button>

                <!-- Mobile / Redirect Fallback Box -->
                <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/80 p-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-800/50">
                  <div class="text-[10px] text-neutral-500 leading-tight dark:text-neutral-400">
                    If browser redirect shows <strong class="text-neutral-700 dark:text-neutral-200">localhost refused to connect</strong>, copy the browser URL or code and paste here:
                  </div>
                  <div class="mt-2 flex items-center gap-1.5">
                    <input
                      v-model="manualCodeInput"
                      type="text"
                      placeholder="http://localhost:8976/oauth/callback?code=..."
                      class="flex-1 border border-neutral-300 rounded-lg bg-white px-2 py-1 text-[11px] text-neutral-800 font-mono outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
                      @keyup.enter="handleManualCodeSubmit"
                    >
                    <button
                      class="rounded-lg bg-neutral-800 px-2.5 py-1 text-[11px] text-white font-medium shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed dark:bg-neutral-700 hover:bg-neutral-700 disabled:opacity-50 dark:hover:bg-neutral-600"
                      :disabled="isExchangingCode || !manualCodeInput.trim()"
                      @click="handleManualCodeSubmit"
                    >
                      <div v-if="isExchangingCode" class="i-solar:refresh-line-duotone h-3 w-3 animate-spin" />
                      <span v-else>Submit</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
