<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import CloudflareAccountHubDialog from '../scenarios/dialogs/cloudflare/CloudflareAccountHubDialog.vue'
import CloudflareConnectDialog from '../scenarios/dialogs/cloudflare/CloudflareConnectDialog.vue'

import { useCloudflareStore } from '../../stores/modules/cloudflare'
import { useSyncEngineStore } from '../../stores/sync-engine'

defineProps<{
  shrink0?: boolean
}>()

const { t } = useI18n()
const cloudflareStore = useCloudflareStore()
const syncStore = useSyncEngineStore()

const { isAuthenticated, isAuthenticating } = storeToRefs(cloudflareStore)
const { syncEnabled, selectiveSyncEnabled, isSyncing } = storeToRefs(syncStore)

const isConnectOpen = ref(false)
const isHubOpen = ref(false)

// 5 Distinct States
const state = computed<'syncing' | 'full-sync' | 'selective-sync' | 'edge-only' | 'disconnected'>(() => {
  if (isSyncing.value || isAuthenticating.value) {
    return 'syncing'
  }
  if (!isAuthenticated.value) {
    return 'disconnected'
  }
  if (syncEnabled.value && !selectiveSyncEnabled.value) {
    return 'full-sync'
  }
  if (syncEnabled.value && selectiveSyncEnabled.value) {
    return 'selective-sync'
  }
  return 'edge-only'
})

const tooltipText = computed(() => {
  switch (state.value) {
    case 'syncing':
      return t('settings.cloudflare.status.syncing', 'Syncing with Cloudflare...')
    case 'full-sync':
      return t('settings.cloudflare.status.full_sync', 'Cloudflare: Full Sync Active')
    case 'selective-sync':
      return t('settings.cloudflare.status.selective_sync', 'Cloudflare: Selective Sync Active')
    case 'edge-only':
      return t('settings.cloudflare.status.edge_only', 'Cloudflare: Connected (Cloud Sync Inactive)')
    case 'disconnected':
    default:
      return t('settings.cloudflare.status.disconnected', 'Cloudflare: Disconnected (Local-only mode)')
  }
})

function handleClick() {
  if (isAuthenticated.value) {
    isHubOpen.value = true
  }
  else {
    isConnectOpen.value = true
  }
}
</script>

<template>
  <div class="relative inline-flex items-center">
    <button
      type="button"
      :class="[
        'relative size-8 flex shrink-0 items-center justify-center rounded-lg border transition-all active:scale-90',
        state === 'full-sync'
          ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
          : state === 'selective-sync'
            ? 'border-cyan-300 dark:border-cyan-800/80 bg-cyan-50/80 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/50'
            : state === 'edge-only'
              ? 'border-blue-300 dark:border-blue-800/80 bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
              : state === 'syncing'
                ? 'border-primary-300 dark:border-primary-800/80 bg-primary-50/80 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400'
                : 'border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-800/80 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/60',
      ]"
      :title="tooltipText"
      @click="handleClick"
    >
      <!-- Icon based on state -->
      <div v-if="state === 'syncing'" class="i-solar:restart-circle-bold-duotone size-4.5 animate-spin" />
      <div v-else-if="state === 'full-sync'" class="i-solar:cloud-check-bold-duotone size-4.5" />
      <div v-else-if="state === 'selective-sync'" class="i-solar:cloud-storage-bold-duotone size-4.5" />
      <div v-else-if="state === 'edge-only'" class="i-solar:user-check-rounded-bold-duotone size-4.5" />
      <div v-else class="i-solar:user-circle-linear size-4.5" />

      <!-- Active Indicator Dot (bottom right) -->
      <span
        v-if="state !== 'syncing'"
        :class="[
          'absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-white dark:border-neutral-900 ring-1 ring-white/50 dark:ring-black/50',
          state === 'full-sync'
            ? 'bg-emerald-500'
            : state === 'selective-sync'
              ? 'bg-cyan-500'
              : state === 'edge-only'
                ? 'bg-blue-500'
                : 'bg-neutral-400/60 dark:bg-neutral-500',
        ]"
      />
    </button>

    <!-- Dialogs -->
    <CloudflareConnectDialog
      v-model="isConnectOpen"
      @connected="isHubOpen = true"
    />
    <CloudflareAccountHubDialog
      v-model="isHubOpen"
      @open-connect="isConnectOpen = true"
    />
  </div>
</template>
