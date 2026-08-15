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
const selectedPath = ref<'new' | 'returning'>('new')

const cloudflareStore = useCloudflareStore()
const syncStore = useSyncEngineStore()
const { cfOAuthTokens, cfAccountId, isAuthenticating, isAuthenticated } = storeToRefs(cloudflareStore)

async function handleCloudflareAuthClick() {
  selectedPath.value = 'returning'
  if (!isAuthenticated.value) {
    try {
      await cloudflareStore.authenticateWithCloudflare()
      toast.success('Successfully connected to Cloudflare!')

      // Check Edge Vault for saved S3/R2 credentials
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
    catch (err: any) {
      toast.error(err?.message || 'Cloudflare authentication failed')
    }
  }
}

function handleSignOutClick(e: Event) {
  e.stopPropagation()
  cloudflareStore.logout()
  toast.info('Disconnected from Cloudflare')
}

watch(selectedPath, (path) => {
  props.onSelectPath?.(path)
}, { immediate: true })
</script>

<template>
  <div class="h-full flex flex-col gap-5 font-sans">
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
    <div class="flex flex-1 flex-col justify-center overflow-y-auto px-1">
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
          class="relative min-h-[150px] flex flex-col cursor-pointer justify-between overflow-hidden border-2 rounded-2xl p-5 transition-all duration-300 ease-out"
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
          class="relative min-h-[150px] flex flex-col cursor-pointer justify-between overflow-hidden border-2 rounded-2xl p-5 transition-all duration-300 ease-out"
          :class="[
            selectedPath === 'returning'
              ? isAuthenticated
                ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500 dark:border-emerald-400 shadow-lg shadow-emerald-500/5'
                : 'bg-gradient-to-br from-primary-500/10 to-indigo-500/10 border-primary-500 dark:border-primary-400 shadow-lg shadow-primary-500/5'
              : 'bg-white/40 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800/80 hover:border-primary-500/50 dark:hover:border-primary-400/50 backdrop-blur-md',
          ]"
          @click="handleCloudflareAuthClick"
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
                  Authenticated via PKCE
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
                <span class="text-neutral-400">Token:</span> {{ cfOAuthTokens?.accessToken ? `${cfOAuthTokens.accessToken.slice(0, 10)}••••••••${cfOAuthTokens.accessToken.slice(-6)}` : 'API Token Active' }}
              </div>
            </div>

            <!-- Loading indicator while PKCE flow is active -->
            <div v-if="isAuthenticating" class="mt-2.5 flex items-center gap-2 text-xs text-primary-600 font-medium dark:text-primary-400">
              <div class="i-solar:refresh-line-duotone h-3.5 w-3.5 animate-spin" />
              <span>Waiting for Cloudflare authorization in browser...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
