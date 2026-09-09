<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useCloudflareStore } from '../../../../../../stores/modules/cloudflare'
import { useSyncEngineStore } from '../../../../../../stores/sync-engine'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const draftStore = useOnboardingV3Draft()
const cloudflareStore = useCloudflareStore()
const syncStore = useSyncEngineStore()
const { cfOAuthTokens, cfAccountId, isAuthenticating, isAuthenticated } = storeToRefs(cloudflareStore)

const authMethod = ref<'auto' | 'token'>('auto')
const tokenInput = ref('')
const isValidatingToken = ref(false)

const selectedPath = computed<'local' | 'cloud'>({
  get: () => draftStore.state.architecture || 'local',
  set: (val) => {
    draftStore.setArchitecture(val)
  },
})

// Auto-switch to cloud if user is already authenticated
watch(isAuthenticated, (authed) => {
  if (authed && selectedPath.value !== 'cloud') {
    selectedPath.value = 'cloud'
  }
}, { immediate: true })

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
  toast.info('Disconnected from Cloudflare')
}

function chooseLocal() {
  selectedPath.value = 'local'
}

function chooseCloud() {
  selectedPath.value = 'cloud'
  if (isAuthenticated.value) {
    void restoreVaultCredentials()
  }
}
</script>

<template>
  <div :class="['w-full max-w-4xl mx-auto flex flex-col gap-4 py-2 select-none']">
    <!-- Header Section -->
    <div :class="['flex flex-col items-center text-center gap-3']">
      <!-- Title & Subtitle -->
      <div
        v-motion
        :initial="{ opacity: 0, y: -6 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="350"
        :class="['text-center']"
      >
        <div :class="['inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-400 text-xs font-semibold mb-1']">
          <div :class="['i-solar:server-square-bold-duotone h-3.5 w-3.5']" />
          <span>Step 3 of 16 · Architecture Choice</span>
        </div>
        <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
          Choose Your Setup Path
        </h1>
        <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
          Select how AIRI runs and synchronizes companions, memories, and state.
        </p>
      </div>

      <!-- Compact Companion Speech Bubble -->
      <div
        v-motion
        :initial="{ opacity: 0, scale: 0.98 }"
        :enter="{ opacity: 1, scale: 1 }"
        :duration="350"
        :delay="100"
        :class="['max-w-xl w-full flex items-start gap-3 text-left']"
      >
        <div
          :class="[
            'h-8 w-8 flex flex-shrink-0 items-center justify-center border border-primary-500/30 rounded-full',
            'bg-gradient-to-br from-primary-500/20 to-indigo-500/20 shadow-xs mt-0.5',
          ]"
        >
          <div :class="['i-solar:emoji-funny-circle-bold-duotone h-5 w-5 text-primary-400']" />
        </div>
        <div
          :class="[
            'relative flex-1 border border-primary-500/20 rounded-xl rounded-tl-xs px-4 py-2',
            'text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed backdrop-blur-md',
            'bg-primary-500/5 dark:bg-primary-950/20 shadow-sm',
          ]"
        >
          "Whether you keep everything 100% offline on your device or enable encrypted Cloudflare Zero-Trust relays across devices, you remain in complete control."
        </div>
      </div>
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
          'relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 border-2 transition-all duration-200 cursor-pointer min-h-[340px]',
          selectedPath === 'local'
            ? 'border-primary-500 bg-gradient-to-b from-primary-500/10 to-indigo-500/5 dark:from-primary-950/40 dark:to-indigo-950/20 shadow-lg shadow-primary-500/10 ring-1 ring-primary-500/30'
            : 'border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700 backdrop-blur-md',
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
                100% Offline
              </span>
            </div>

            <!-- Radio Indicator -->
            <div
              :class="[
                'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors',
                selectedPath === 'local' ? 'border-primary-500' : 'border-neutral-300 dark:border-neutral-600',
              ]"
            >
              <div v-if="selectedPath === 'local'" :class="['h-2.5 w-2.5 rounded-full bg-primary-500 shadow-xs']" />
            </div>
          </div>

          <!-- Title & Description -->
          <div>
            <h2 :class="['text-base font-bold text-neutral-900 dark:text-white']">
              Local Companion (Air-Gapped)
            </h2>
            <p :class="['text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 leading-relaxed']">
              Run local WebGPU neural models and store conversations and long-term memory exclusively in IndexedDB. Zero telemetry, zero external servers.
            </p>
          </div>

          <!-- Feature Bullets -->
          <div :class="['space-y-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/80 text-xs']">
            <div :class="['flex items-center gap-2 text-neutral-700 dark:text-neutral-300']">
              <div :class="['i-solar:check-circle-bold text-sm text-primary-500 shrink-0']" />
              <span>IndexedDB Local Vault (zero cloud accounts)</span>
            </div>
            <div :class="['flex items-center gap-2 text-neutral-700 dark:text-neutral-300']">
              <div :class="['i-solar:check-circle-bold text-sm text-primary-500 shrink-0']" />
              <span>100% Private, on-device neural execution</span>
            </div>
            <div :class="['flex items-center gap-2 text-neutral-700 dark:text-neutral-300']">
              <div :class="['i-solar:check-circle-bold text-sm text-primary-500 shrink-0']" />
              <span>Zero telemetry, trackers, or data collection</span>
            </div>
          </div>
        </div>

        <!-- Bottom Action CTA -->
        <div :class="['pt-4 mt-4 border-t border-neutral-100 dark:border-neutral-800/80']">
          <div
            :class="[
              'w-full py-2.5 rounded-xl text-xs font-semibold text-center transition-all flex items-center justify-center gap-2',
              selectedPath === 'local'
                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700',
            ]"
          >
            <span>{{ selectedPath === 'local' ? '✓ Selected Local Architecture' : 'Select Local Setup →' }}</span>
          </div>
        </div>
      </div>

      <!-- Option 2: Cloud Relay (Cloudflare Zero-Trust) -->
      <div
        :class="[
          'relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 border-2 transition-all duration-200 cursor-pointer min-h-[340px]',
          selectedPath === 'cloud'
            ? isAuthenticated
              ? 'border-emerald-500 bg-gradient-to-b from-emerald-500/10 to-teal-500/5 dark:from-emerald-950/40 dark:to-teal-950/20 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
              : 'border-primary-500 bg-gradient-to-b from-primary-500/10 to-indigo-500/5 dark:from-primary-950/40 dark:to-indigo-950/20 shadow-lg shadow-primary-500/10 ring-1 ring-primary-500/30'
            : 'border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700 backdrop-blur-md',
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
                {{ isAuthenticated ? 'Connected' : 'Zero-Trust Relay' }}
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
              Cloud Relay (Cloudflare Zero-Trust)
            </h2>
            <p :class="['text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 leading-relaxed']">
              Private Cloudflare Edge KV sync and multi-device companion restore. Encrypts and backs up companions, memories, and cards across devices.
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
                Disconnect
              </button>
            </div>
            <div :class="['truncate text-[10px] text-neutral-600 dark:text-neutral-300 font-mono']">
              <span :class="['text-neutral-400']">Account:</span> {{ cfAccountId || cfOAuthTokens?.accountId || 'Default Account' }}
            </div>
            <div :class="['truncate text-[10px] text-neutral-500 dark:text-neutral-400 font-mono']">
              <span :class="['text-neutral-400']">Edge Vault:</span> Ready & encrypted
            </div>
          </div>

          <!-- Unauthenticated Sign-in Module -->
          <div
            v-else-if="selectedPath === 'cloud'"
            :class="['pt-2 border-t border-neutral-100 dark:border-neutral-800/80 space-y-2.5']"
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
                1-Click Sign-In
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
                API Token
              </button>
            </div>

            <!-- 1-Click Auto OAuth -->
            <div v-if="authMethod === 'auto'" :class="['space-y-1.5']">
              <button
                type="button"
                :disabled="isAuthenticating"
                :class="[
                  'w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer',
                ]"
                @click="handleStartOAuth"
              >
                <div v-if="isAuthenticating" :class="['i-solar:refresh-line-duotone h-4 w-4 animate-spin']" />
                <div v-else :class="['i-solar:login-2-linear h-4 w-4']" />
                <span>{{ isAuthenticating ? 'Waiting for Browser Authorization...' : 'Sign In with Cloudflare' }}</span>
              </button>
              <p :class="['text-[10px] text-neutral-400 text-center leading-tight']">
                Opens your default browser for PKCE authorization & Edge Vault pairing.
              </p>
            </div>

            <!-- API Token Direct Input -->
            <div v-else :class="['space-y-2']">
              <div :class="['flex items-center gap-2']">
                <input
                  v-model="tokenInput"
                  type="password"
                  placeholder="Paste Cloudflare API Token..."
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
                  Connect
                </button>
              </div>
              <p :class="['text-[10px] text-neutral-400 leading-tight']">
                Requires Workers KV and R2 read/write permissions.
              </p>
            </div>
          </div>

          <!-- Feature Bullets (When not showing auth form or unselected) -->
          <div v-else :class="['space-y-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/80 text-xs']">
            <div :class="['flex items-center gap-2 text-neutral-700 dark:text-neutral-300']">
              <div :class="['i-solar:check-circle-bold text-sm text-primary-500 shrink-0']" />
              <span>Encrypted Edge Key Vault sync across devices</span>
            </div>
            <div :class="['flex items-center gap-2 text-neutral-700 dark:text-neutral-300']">
              <div :class="['i-solar:check-circle-bold text-sm text-primary-500 shrink-0']" />
              <span>Multi-device companion backup & restore</span>
            </div>
            <div :class="['flex items-center gap-2 text-neutral-700 dark:text-neutral-300']">
              <div :class="['i-solar:check-circle-bold text-sm text-primary-500 shrink-0']" />
              <span>Private zero-trust Cloudflare edge infrastructure</span>
            </div>
          </div>
        </div>

        <!-- Bottom Action CTA -->
        <div :class="['pt-4 mt-4 border-t border-neutral-100 dark:border-neutral-800/80']">
          <div
            :class="[
              'w-full py-2.5 rounded-xl text-xs font-semibold text-center transition-all flex items-center justify-center gap-2',
              selectedPath === 'cloud'
                ? isAuthenticated
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'bg-primary-600 text-white shadow-md shadow-primary-600/25'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700',
            ]"
          >
            <span>{{ selectedPath === 'cloud' ? (isAuthenticated ? '✓ Cloudflare Connected' : '✓ Selected Cloud Relay') : 'Configure Cloudflare →' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Action Bar -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="350"
      :delay="250"
      :class="['flex items-center justify-between pt-3 border-t border-neutral-200/80 dark:border-white/5']"
    >
      <button
        type="button"
        :class="['flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>Back to Appearance</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium']">
        Path: <span :class="['text-neutral-700 dark:text-neutral-200 font-semibold']">{{ selectedPath === 'local' ? 'Local Companion (Offline)' : 'Cloud Relay (Cloudflare)' }}</span>
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
        <span>Next: Experience Archetypes</span>
        <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
      </Button>
    </div>
  </div>
</template>
