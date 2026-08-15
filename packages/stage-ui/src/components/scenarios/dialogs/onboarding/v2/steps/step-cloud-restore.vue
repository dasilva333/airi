<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import SelectiveSyncPanel from '../../../../providers/selective-sync-panel.vue'

import { useSyncEngineStore } from '../../../../../../stores/sync-engine'
import { onboardingV2GateKey } from '../gate'

const syncStore = useSyncEngineStore()
const gate = inject(onboardingV2GateKey)

const isSyncing = ref(false)

async function handleSyncSelected(_checkedIds: string[]) {
  isSyncing.value = true
  try {
    toast.info('Starting companion restoration from Cloudflare R2...')
    await syncStore.triggerSync()
    toast.success('Successfully restored companion data!')
    gate?.requestNext?.()
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to restore companion from cloud')
  }
  finally {
    isSyncing.value = false
  }
}

onMounted(() => {
  gate?.setGate('cloud-restore', {
    canProceed: true,
    hint: 'Review remote assets and click Next to restore',
    skipLabel: 'Skip Restore',
  })
})

onBeforeUnmount(() => {
  gate?.clearGate('cloud-restore')
})
</script>

<template>
  <div class="h-full flex flex-col gap-3 font-sans">
    <div
      v-motion
      :initial="{ opacity: 0, y: -10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      class="text-center"
    >
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Companion Cloud Restore
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Select which character models, backgrounds, and memory archives to pull locally to this device.
      </p>
    </div>

    <!-- Selective Sync Embed -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      <SelectiveSyncPanel
        action-label="Restore Selected"
        @sync="handleSyncSelected"
      />
    </div>
  </div>
</template>
