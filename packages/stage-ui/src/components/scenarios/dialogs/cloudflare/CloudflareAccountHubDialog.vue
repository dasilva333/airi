<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import SelectiveSyncPanel from '../../providers/selective-sync-panel.vue'

import { useCloudflareStore } from '../../../../stores/modules/cloudflare'
import { useSyncEngineStore } from '../../../../stores/sync-engine'

const emit = defineEmits<{
  (e: 'open-connect'): void
}>()
const showDialog = defineModel<boolean>({ default: false })
const router = useRouter()
const cloudflareStore = useCloudflareStore()
const syncStore = useSyncEngineStore()

const {
  cfAccountId,
  cfSubdomain,
} = storeToRefs(cloudflareStore)

const {
  syncEnabled,
  selectiveSyncEnabled,
  selectiveCheckedIds,
  isSyncing,
  lastSyncTime,
  s3Bucket,
} = storeToRefs(syncStore)

const isTestingCors = ref(false)
const corsStatus = ref<'idle' | 'online' | 'offline'>('idle')
const isSelectiveModalOpen = ref(false)

const formattedLastSync = computed(() => {
  if (!lastSyncTime.value)
    return 'Never'
  const date = new Date(lastSyncTime.value)
  const diffSec = Math.floor((Date.now() - lastSyncTime.value) / 1000)
  if (diffSec < 60)
    return 'Just now'
  if (diffSec < 3600)
    return `${Math.floor(diffSec / 60)}m ago`
  return date.toLocaleDateString()
})

async function handleSyncNow() {
  try {
    toast.info('Initiating Cloudflare R2 cloud sync...')
    await syncStore.triggerSync()
    toast.success('Sync complete!')
  }
  catch (err: any) {
    toast.error(err?.message || 'Sync failed')
  }
}

async function testCorsProxy() {
  if (!cfSubdomain.value) {
    toast.error('Subdomain not configured')
    return
  }

  isTestingCors.value = true
  corsStatus.value = 'idle'
  try {
    const url = `https://airi-cors-proxy.${cfSubdomain.value}.workers.dev/health`
    const res = await fetch(url)
    if (res.ok) {
      corsStatus.value = 'online'
      toast.success('CORS Proxy is online!')
    }
    else {
      corsStatus.value = 'offline'
      toast.error(`CORS Proxy returned status ${res.status}`)
    }
  }
  catch {
    corsStatus.value = 'offline'
    toast.error('Could not reach CORS Proxy worker')
  }
  finally {
    isTestingCors.value = false
  }
}

function handleDisconnect() {
  if (confirm('Are you sure you want to disconnect your Cloudflare account? Your local data will remain safe.')) {
    cloudflareStore.logout()
    toast.info('Cloudflare account disconnected')
    showDialog.value = false
  }
}

function navigateTo(path: string) {
  showDialog.value = false
  router.push(path)
}

async function onSaveSelectiveSync(checkedIds: string[]) {
  selectiveCheckedIds.value = checkedIds
  selectiveSyncEnabled.value = true
  isSelectiveModalOpen.value = false
  toast.success('Updated selective sync filters')
  await syncStore.triggerSync()
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
              <div class="i-solar:shield-network-bold-duotone" />
            </div>
            <div>
              <DialogTitle class="flex items-center gap-2 text-lg text-neutral-900 font-bold sm:text-xl dark:text-neutral-100">
                <span>Cloudflare & Edge Hub</span>
                <span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">
                  CONNECTED
                </span>
              </DialogTitle>
              <DialogDescription class="text-xs text-neutral-500 dark:text-neutral-400">
                Zero-Custody personal edge infrastructure & cloud sync.
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

        <!-- Main Body -->
        <div class="flex flex-1 flex-col gap-4 overflow-y-auto pr-1 font-sans scrollbar-none">
          <!-- Account Identity Card -->
          <div class="flex flex-col items-start justify-between gap-3 border border-neutral-200/70 rounded-2xl bg-neutral-50/70 p-4 sm:flex-row sm:items-center dark:border-neutral-800/70 dark:bg-neutral-800/50">
            <div class="min-w-0 flex flex-col gap-1">
              <span class="text-[11px] text-neutral-400 font-semibold tracking-wider uppercase">Account ID</span>
              <span class="truncate text-xs text-neutral-800 font-bold font-mono dark:text-neutral-200" :title="cfAccountId">
                {{ cfAccountId ? `${cfAccountId.slice(0, 16)}...` : 'Connected via OAuth' }}
              </span>
              <div v-if="cfSubdomain" class="flex items-center gap-1 text-xs text-primary-600 font-mono dark:text-primary-400">
                <div class="i-solar:link-circle-bold text-xs" />
                <span>{{ cfSubdomain }}.workers.dev</span>
              </div>
            </div>

            <Button
              size="sm"
              variant="secondary"
              class="shrink-0 font-bold !text-red-500 hover:!bg-red-500/10"
              @click="handleDisconnect"
            >
              Disconnect
            </Button>
          </div>

          <!-- Cloud Sync (R2 / S3) Status Card -->
          <div class="flex flex-col gap-3 border border-neutral-200/70 rounded-2xl bg-neutral-50/70 p-4 dark:border-neutral-800/70 dark:bg-neutral-800/50">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="size-8 flex items-center justify-center rounded-xl bg-primary-500/15 text-lg text-primary-600 dark:text-primary-400">
                  <div class="i-solar:cloud-storage-bold-duotone" />
                </div>
                <div>
                  <h4 class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
                    BYOS Cloud Sync (R2 / S3)
                  </h4>
                  <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Multi-device persistence & asset backup
                  </p>
                </div>
              </div>

              <!-- Status Badge -->
              <span
                v-if="syncEnabled && !selectiveSyncEnabled"
                class="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400"
              >
                <span class="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Full Sync
              </span>
              <span
                v-else-if="syncEnabled && selectiveSyncEnabled"
                class="flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] text-cyan-600 font-bold dark:text-cyan-400"
              >
                <span class="size-1.5 rounded-full bg-cyan-500" />
                Selective ({{ selectiveCheckedIds.length }})
              </span>
              <span
                v-else
                class="rounded-full bg-neutral-200 px-2.5 py-0.5 text-[10px] text-neutral-500 font-semibold dark:bg-neutral-700 dark:text-neutral-400"
              >
                Paused
              </span>
            </div>

            <!-- Sync Info -->
            <div class="grid grid-cols-2 gap-2 border border-neutral-200/50 rounded-xl bg-white/60 p-2.5 text-xs dark:border-neutral-800/50 dark:bg-neutral-900/60">
              <div>
                <span class="block text-[10px] text-neutral-400">Bucket</span>
                <span class="block truncate text-neutral-700 font-medium font-mono dark:text-neutral-300">
                  {{ s3Bucket || 'Not configured' }}
                </span>
              </div>
              <div>
                <span class="block text-[10px] text-neutral-400">Last Synced</span>
                <span class="block text-neutral-700 font-medium dark:text-neutral-300">
                  {{ formattedLastSync }}
                </span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="primary"
                :disabled="isSyncing || !s3Bucket"
                class="shadow-xs flex items-center gap-1.5 font-bold"
                @click="handleSyncNow"
              >
                <div v-if="isSyncing" class="i-solar:restart-circle-bold-duotone animate-spin text-sm" />
                <div v-else class="i-solar:restart-bold text-sm" />
                <span>{{ isSyncing ? 'Syncing...' : 'Sync Now' }}</span>
              </Button>

              <Button
                size="sm"
                variant="secondary"
                class="text-xs font-semibold"
                @click="isSelectiveModalOpen = true"
              >
                <div class="i-solar:filter-bold-duotone mr-1 text-xs" />
                <span>Selective Filters</span>
              </Button>

              <Button
                size="sm"
                variant="secondary"
                class="ml-auto text-xs font-semibold"
                @click="navigateTo('/settings/modules/cloud-sync')"
              >
                Sync Settings &rarr;
              </Button>
            </div>
          </div>

          <!-- Edge Microservices Card -->
          <div class="flex flex-col gap-3 border border-neutral-200/70 rounded-2xl bg-neutral-50/70 p-4 dark:border-neutral-800/70 dark:bg-neutral-800/50">
            <h4 class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
              Edge Services Status
            </h4>

            <div class="flex flex-col gap-2">
              <!-- CORS Reverse Proxy -->
              <div class="flex items-center justify-between border border-neutral-200/50 rounded-xl bg-white/60 p-2.5 text-xs dark:border-neutral-800/50 dark:bg-neutral-900/60">
                <div class="min-w-0 flex items-center gap-2">
                  <div class="size-6 flex shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-sm text-emerald-600 dark:text-emerald-400">
                    <div class="i-solar:shield-check-bold" />
                  </div>
                  <div class="truncate">
                    <span class="block text-neutral-800 font-semibold dark:text-neutral-200">Web CORS Proxy</span>
                    <span class="block truncate text-[10px] text-neutral-400 font-mono">airi-cors-proxy.{{ cfSubdomain || '...' }}.workers.dev</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  :disabled="isTestingCors"
                  class="h-7 shrink-0 px-2.5 text-[11px] font-semibold"
                  @click="testCorsProxy"
                >
                  {{ isTestingCors ? 'Testing...' : 'Ping Test' }}
                </Button>
              </div>

              <!-- Edge Key Vault -->
              <div class="flex items-center justify-between border border-neutral-200/50 rounded-xl bg-white/60 p-2.5 text-xs dark:border-neutral-800/50 dark:bg-neutral-900/60">
                <div class="flex items-center gap-2">
                  <div class="size-6 flex shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-sm text-amber-600 dark:text-amber-400">
                    <div class="i-solar:key-bold" />
                  </div>
                  <div>
                    <span class="block text-neutral-800 font-semibold dark:text-neutral-200">Edge Key Vault</span>
                    <span class="block text-[10px] text-neutral-400">KV Namespace: airi-edge-vault</span>
                  </div>
                </div>

                <span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600 font-bold dark:text-emerald-400">
                  Protected
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="mt-4 flex items-center justify-between border-t border-neutral-200/60 pt-3 dark:border-neutral-800/60">
          <Button
            size="sm"
            variant="secondary"
            class="text-xs font-semibold"
            @click="navigateTo('/settings/modules/cloudflare')"
          >
            Full Cloudflare Settings &rarr;
          </Button>

          <Button
            variant="primary"
            size="sm"
            class="font-bold"
            @click="showDialog = false"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <!-- Selective Sync Modal Wrapper -->
  <DialogRoot :open="isSelectiveModalOpen" @update:open="val => isSelectiveModalOpen = val">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm" />
      <DialogContent class="fixed left-1/2 top-1/2 z-[10000] max-h-[85dvh] max-w-2xl w-[92dvw] flex flex-col transform overflow-hidden border border-neutral-200 rounded-3xl bg-white p-6 shadow-2xl outline-none backdrop-blur-xl -translate-x-1/2 -translate-y-1/2 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="mb-4 flex items-center justify-between">
          <DialogTitle class="text-lg text-neutral-900 font-bold dark:text-neutral-100">
            Configure Selective Sync Filters
          </DialogTitle>
          <button
            class="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            @click="isSelectiveModalOpen = false"
          >
            <div class="i-solar:close-circle-bold-duotone text-2xl" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto pr-1 scrollbar-none">
          <SelectiveSyncPanel
            :show-actions="true"
            action-label="Save Filters & Sync"
            @cancel="isSelectiveModalOpen = false"
            @sync="onSaveSelectiveSync"
          />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
