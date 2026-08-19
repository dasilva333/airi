<script setup lang="ts">
import { estimateTokens } from '@proj-airi/stage-shared'
import { MarkdownRenderer } from '@proj-airi/stage-ui/components'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useMemoryLifetimeStore } from '@proj-airi/stage-ui/stores/memory-lifetime'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'

import LifetimeHistoryModal from '../../../../../../packages/stage-pages/src/pages/settings/modules/components/LifetimeHistoryModal.vue'
import LifetimeProvisioningModal from '../../../../../../packages/stage-pages/src/pages/settings/modules/components/LifetimeProvisioningModal.vue'

const airiCardStore = useAiriCardStore()
const { activeCardId, cards } = storeToRefs(airiCardStore)
const lifetimeStore = useMemoryLifetimeStore()
const { artifacts, isProvisioning } = storeToRefs(lifetimeStore)
const chatSessionStore = useChatSessionStore()

// --- Local State ---
const showSourceModal = ref(false)
const showHistoryModal = ref(false)
const showLifetimeModal = ref(false)
const autoHandoff = ref(true)
const isSyncing = ref(false)
const lastSyncResult = ref<'idle' | 'updating' | 'up-to-date' | 'bootstrapped' | 'error'>('idle')
const lastSyncError = ref<string | null>(null)

const activeCharacterArtifact = computed(() => {
  if (!activeCardId.value)
    return null
  return artifacts.value.get(activeCardId.value) || null
})

const isProvisioned = computed(() => !!activeCharacterArtifact.value)

const activeCard = computed(() => {
  if (!activeCardId.value)
    return null
  return cards.value.get(activeCardId.value) || null
})

const artifactTokens1k = computed(() => {
  const content = activeCharacterArtifact.value?.distilledContent
  return content ? estimateTokens(content) : 0
})

const artifactTokens7k = computed(() => {
  const content = activeCharacterArtifact.value?.baseContent
  return content ? estimateTokens(content) : 0
})

const activeUniverseId = computed(() => {
  if (!activeCardId.value)
    return 'global'
  const activeSessionId = chatSessionStore.getCharacterIndex(activeCardId.value)?.activeSessionId || chatSessionStore.activeSessionId
  const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
  return activeSessionMeta?.universeId || 'global'
})

const updateHistory = computed(() => {
  const history = activeCharacterArtifact.value?.metadata?.updateHistory
  return Array.isArray(history) ? [...history].reverse() : []
})

async function syncLifetimeThread() {
  if (!activeCardId.value || isSyncing.value)
    return

  isSyncing.value = true
  lastSyncError.value = null
  lastSyncResult.value = 'updating'

  const beforeWatermark = activeCharacterArtifact.value?.metadata?.lastConsumedDay
  try {
    await lifetimeStore.applyIncrementalUpdate(activeCardId.value, activeUniverseId.value)
    await loadData()
    const afterWatermark = activeCharacterArtifact.value?.metadata?.lastConsumedDay

    if (lifetimeStore.error) {
      lastSyncResult.value = 'error'
      lastSyncError.value = lifetimeStore.error
    }
    else if (afterWatermark === beforeWatermark) {
      lastSyncResult.value = 'up-to-date'
    }
    else if (!beforeWatermark && afterWatermark) {
      lastSyncResult.value = 'bootstrapped'
    }
    else {
      lastSyncResult.value = 'updating'
    }
  }
  catch (error) {
    lastSyncResult.value = 'error'
    lastSyncError.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isSyncing.value = false
  }
}

const threadStatus = computed(() => {
  const metadata = activeCharacterArtifact.value?.metadata
  return [
    { label: 'Soul Active', icon: 'i-solar:dna-bold-duotone' },
    { label: `Archive: ${metadata?.chunkCount || 0} Chunks`, icon: 'i-solar:layers-bold-duotone' },
    {
      label: metadata?.lastConsumedDay ? `Thread Sealed Up To: ${metadata.lastConsumedDay}` : 'Thread Not Yet Sealed',
      icon: metadata?.lastConsumedDay ? 'i-solar:calendar-bold-duotone' : 'i-solar:calendar-minimalistic-bold-duotone',
    },
    {
      label: activeCharacterArtifact.value?.chunkSummaries?.length ? 'Foundation: OK' : 'Foundation: Missing',
      icon: activeCharacterArtifact.value?.chunkSummaries?.length ? 'i-solar:database-bold-duotone' : 'i-solar:database-minimalistic-bold-duotone',
    },
  ]
})

async function loadData() {
  if (activeCardId.value) {
    await lifetimeStore.loadForCharacter(activeCardId.value)
  }
}

watch(activeCardId, () => loadData(), { immediate: true })
onMounted(() => loadData())
</script>

<template>
  <div class="h-full w-full overflow-y-auto bg-white p-6 font-urbanist dark:bg-neutral-900/10">
    <!-- Header -->
    <header class="relative mb-6 overflow-hidden border border-neutral-200 rounded-3xl bg-neutral-100/40 p-8 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="absolute h-64 w-64 bg-amber-500/10 blur-3xl -right-24 -top-24" />
      <div class="absolute h-64 w-64 bg-orange-500/10 blur-3xl -bottom-24 -left-24" />

      <div class="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="flex flex-col gap-2">
          <div class="h-16 w-16 flex items-center justify-center rounded-2xl bg-amber-500/20 text-4xl text-amber-500 shadow-inner">
            <div class="i-solar:dna-bold-duotone inline-block" />
          </div>
          <h1 class="text-3xl text-neutral-800 font-bold tracking-tight dark:text-neutral-100">
            The Eternal Thread
          </h1>
          <p class="max-w-2xl text-xs text-neutral-500 leading-normal dark:text-neutral-400">
            The long-term memory thread of the relationship. It keeps the bond stable across resets by merging daily changes into a permanent soul blueprint.
          </p>
        </div>

        <div v-if="isProvisioned" class="flex flex-col items-end gap-2">
          <div class="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs text-emerald-700 font-bold dark:text-emerald-400">
            <div class="i-solar:check-circle-bold-duotone text-base" />
            Active
          </div>
        </div>
      </div>

      <!-- Thread Status Strip -->
      <div v-if="isProvisioned" class="mt-8 flex flex-wrap gap-3">
        <div
          v-for="chip in threadStatus"
          :key="chip.label"
          class="flex items-center gap-2 border border-neutral-200/50 rounded-full bg-white/50 px-4 py-2 text-[10px] font-bold tracking-tight uppercase shadow-sm dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-neutral-200"
        >
          <div :class="[chip.icon, 'text-amber-500 text-base']" />
          {{ chip.label }}
        </div>
      </div>
    </header>

    <!-- STATE A: Character Unprovisioned -->
    <section v-if="!isProvisioned && !isProvisioning" class="relative mb-6 overflow-hidden border border-amber-500/20 rounded-[2.5rem] bg-amber-500/5 p-12 text-center dark:border-amber-500/10">
      <div class="mx-auto mb-6 h-20 w-20 flex items-center justify-center rounded-3xl bg-amber-500/10 text-5xl text-amber-500">
        <div class="i-solar:link-break-bold-duotone" />
      </div>
      <h2 class="mb-2 text-2xl text-neutral-800 font-bold dark:text-neutral-100">
        Permanent Identity Offline
      </h2>
      <p class="mx-auto mb-8 max-w-lg text-xs text-neutral-500 leading-normal dark:text-neutral-400">
        Lifetime monitoring is not yet active for <span class="text-neutral-700 font-bold dark:text-neutral-200">{{ activeCard?.name || 'this character' }}</span>. Enable the Eternal Thread to start distilling daily conversations into a permanent soul blueprint.
      </p>
      <Button label="Enable Eternal Thread" variant="primary" size="lg" icon="i-solar:plug-circle-bold-duotone" @click="showLifetimeModal = true" />
    </section>

    <!-- STATE B: Character Provisioned -->
    <div v-if="isProvisioned" class="flex flex-col gap-6">
      <!-- The Trinity Cards -->
      <div class="grid gap-6 lg:grid-cols-3">
        <section class="border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          <div class="mb-4 h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 text-xl text-amber-500">
            <div class="i-solar:shield-user-bold-duotone" />
          </div>
          <h3 class="mb-2 text-sm text-neutral-800 font-bold dark:text-neutral-100">
            The Core Bond
          </h3>
          <p class="mb-4 text-[11px] text-neutral-500 italic dark:text-neutral-400">
            Stable personality baseline protected against session-reset erasure.
          </p>
          <ul class="flex flex-col gap-2">
            <li v-for="item in ['Stable Identity Benchmark', 'Cross-Session Continuity', 'Durable Motif Tracking']" :key="item" class="flex items-center gap-2.5 text-xs text-neutral-700 font-medium dark:text-neutral-300">
              <div class="i-solar:check-circle-bold-duotone text-amber-500" />
              {{ item }}
            </li>
          </ul>
        </section>

        <section class="border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          <div class="mb-4 h-10 w-10 flex items-center justify-center rounded-xl bg-orange-500/10 text-xl text-orange-500">
            <div class="i-solar:history-bold-duotone" />
          </div>
          <h3 class="mb-2 text-sm text-neutral-800 font-bold dark:text-neutral-100">
            Daily Updates
          </h3>
          <p class="mb-4 text-[11px] text-neutral-500 italic dark:text-neutral-400">
            Piggybacks on the 24H STMM cycle to integrate meaningful session shifts.
          </p>
          <ul class="flex flex-col gap-2">
            <li v-for="item in ['Incremental Soul Rebasing', 'STMM Cycle Handoff', 'Automatic Conflict Resolution']" :key="item" class="flex items-center gap-2.5 text-xs text-neutral-700 font-medium dark:text-neutral-300">
              <div class="i-solar:add-circle-bold-duotone text-orange-500" />
              {{ item }}
            </li>
          </ul>
        </section>

        <section class="border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          <div class="mb-4 h-10 w-10 flex items-center justify-center rounded-xl bg-primary-500/10 text-xl text-primary-500">
            <div class="i-solar:lock-bold-duotone" />
          </div>
          <h3 class="mb-2 text-sm text-neutral-800 font-bold dark:text-neutral-100">
            Stability Guard
          </h3>
          <p class="mb-4 text-[11px] text-neutral-500 italic dark:text-neutral-400">
            Monitors for erratic identity drift and ensures long-term bond integrity.
          </p>
          <ul class="flex flex-col gap-2">
            <li v-for="item in ['Bond Integrity Monitoring', 'Personality Protection', 'Durable History Vault']" :key="item" class="flex items-center gap-2.5 text-xs text-neutral-700 font-medium dark:text-neutral-300">
              <div class="i-solar:security-safe-bold-duotone text-primary-500" />
              {{ item }}
            </li>
          </ul>
        </section>
      </div>

      <!-- HERO: The Distilled Blueprint -->
      <section v-if="activeCharacterArtifact" class="relative overflow-hidden border border-amber-500/20 rounded-[2.5rem] bg-amber-500/5 p-1 shadow-md dark:border-amber-500/10">
        <div class="rounded-[2.2rem] bg-white p-6 dark:bg-neutral-900/90">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 text-xl text-amber-500">
                <div class="i-solar:dna-bold-duotone" />
              </div>
              <div>
                <h2 class="text-lg text-neutral-800 font-bold dark:text-neutral-100">
                  Canonical Thread
                </h2>
                <p class="text-xs text-neutral-500 italic dark:text-neutral-400">
                  This is the distilled 1k entry AIRI reloads from.
                </p>
              </div>
            </div>
          </div>

          <div class="relative overflow-hidden border border-neutral-200 rounded-2xl bg-neutral-50/50 p-6 leading-relaxed dark:border-neutral-800 dark:bg-black/20">
            <div class="absolute right-4 top-4 text-4xl text-amber-500/10">
              <div class="i-solar:quotation-mark-bold-duotone" />
            </div>
            <div class="text-sm text-neutral-700 leading-loose dark:text-neutral-200">
              <MarkdownRenderer :content="activeCharacterArtifact.distilledContent" />
            </div>
          </div>

          <div class="mt-6 flex flex-wrap items-center justify-between gap-6">
            <div class="flex items-center gap-6">
              <div class="flex flex-col">
                <span class="text-[9px] text-neutral-500 tracking-wider uppercase">Distilled Artifact</span>
                <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">~{{ artifactTokens1k }} Tokens</span>
              </div>
              <div class="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />
              <button
                class="group flex flex-col text-left transition-colors hover:text-primary-500"
                @click="showSourceModal = true"
              >
                <span class="text-[9px] text-neutral-500 tracking-wider uppercase group-hover:text-primary-400">Source Archive ({{ Math.round(artifactTokens7k / 1000) }}k)</span>
                <span class="text-xs text-neutral-800 font-bold underline decoration-dotted dark:text-neutral-200 group-hover:text-primary-500">
                  {{ activeCharacterArtifact.sourceManifest.rawTurnCount }} Turns Condensed
                </span>
              </button>
            </div>
            <div class="flex gap-3">
              <Button label="View Thread History" variant="secondary" icon="i-solar:history-line-duotone" @click="showHistoryModal = true" />
              <Button :label="isSyncing ? 'Merging New Days...' : 'Sync Thread Now'" variant="secondary" icon="i-solar:refresh-bold-duotone" :disabled="isSyncing" @click="syncLifetimeThread" />
              <Button label="Merge Lifetime History" variant="primary" icon="i-solar:restart-bold-duotone" @click="showLifetimeModal = true" />
            </div>
            <div v-if="lastSyncResult !== 'idle'" class="mt-3 flex flex-wrap items-center gap-2">
              <span
                v-if="lastSyncResult === 'updating'"
                class="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] text-amber-700 font-bold dark:text-amber-400"
              >
                <div class="i-solar:dna-bold-duotone" />
                New days merged — thread version {{ activeCharacterArtifact?.version }}
              </span>
              <span
                v-else-if="lastSyncResult === 'up-to-date'"
                class="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] text-emerald-700 font-bold dark:text-emerald-400"
              >
                <div class="i-solar:check-circle-bold-duotone" />
                Thread fully up to date
              </span>
              <span
                v-else-if="lastSyncResult === 'bootstrapped'"
                class="flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-[10px] text-sky-700 font-bold dark:text-sky-400"
              >
                <div class="i-solar:info-circle-bold-duotone" />
                Legacy thread sealed — incremental tracking starts from yesterday
              </span>
              <span
                v-else-if="lastSyncResult === 'error'"
                class="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-[10px] text-red-700 font-bold dark:text-red-400"
              >
                <div class="i-solar:danger-triangle-bold-duotone" />
                Sync failed: {{ lastSyncError || lifetimeStore.error || 'Unknown error' }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Lifecycle Console -->
      <section class="border border-neutral-200 rounded-[2.5rem] bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80">
        <h2 class="mb-4 text-base text-neutral-800 font-bold dark:text-neutral-100">
          Lifetime Controls
        </h2>
        <div class="grid gap-12 lg:grid-cols-2">
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3 border border-neutral-200 rounded-2xl bg-neutral-50/50 px-6 py-4 dark:border-neutral-700 dark:bg-neutral-800/40">
              <input id="handoff" v-model="autoHandoff" type="checkbox" class="h-5 w-5 border-neutral-300 rounded text-amber-500">
              <label for="handoff" class="flex flex-col cursor-pointer">
                <span class="text-sm text-neutral-700 font-bold dark:text-neutral-200">Daily Update Handoff</span>
                <span class="mt-0.5 text-[10px] text-neutral-500 font-bold tracking-wider uppercase">New days merge into the thread automatically when AIRI starts</span>
              </label>
            </div>

            <div class="flex flex-col gap-3 border border-neutral-200 rounded-2xl bg-neutral-50/50 px-6 py-4 dark:border-neutral-700 dark:bg-neutral-800/40">
              <div class="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                <div class="i-solar:calendar-bold-duotone text-lg text-amber-500" />
                <span class="text-xs font-bold tracking-tight uppercase">Thread Maintenance</span>
              </div>
              <div class="flex flex-wrap gap-x-8 gap-y-3">
                <div class="flex flex-col">
                  <span class="text-[9px] text-neutral-500 tracking-wider uppercase">Sealed Up To</span>
                  <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">{{ activeCharacterArtifact?.metadata?.lastConsumedDay || 'Not sealed yet' }}</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-[9px] text-neutral-500 tracking-wider uppercase">Thread Version</span>
                  <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">v{{ activeCharacterArtifact?.version || 1 }}</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-[9px] text-neutral-500 tracking-wider uppercase">Last Pass</span>
                  <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">{{ activeCharacterArtifact?.metadata?.lastUpdateType || 'init' }}</span>
                </div>
              </div>
              <p class="text-[10px] text-neutral-500 italic dark:text-neutral-400">
                Routine days leave the thread untouched. Only durable relationship shifts bump the version.
              </p>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
              <div class="i-solar:history-bold-duotone text-lg text-orange-500" />
              <span class="text-xs font-bold tracking-tight uppercase">Maintenance Ledger</span>
            </div>
            <div v-if="updateHistory.length === 0" class="border border-neutral-200 rounded-2xl border-dashed px-6 py-8 text-center text-[11px] text-neutral-500 italic dark:border-neutral-700 dark:text-neutral-400">
              No incremental merges recorded yet.
            </div>
            <div v-else class="max-h-56 flex flex-col gap-2 overflow-y-auto pr-1">
              <div
                v-for="entry in updateHistory"
                :key="`${entry.day}-${entry.updatedAt}`"
                class="flex items-start gap-3 border border-neutral-200 rounded-2xl bg-neutral-50/50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800/40"
              >
                <div :class="entry.changed ? 'i-solar:restart-bold-duotone text-orange-500' : 'i-solar:check-circle-bold-duotone text-emerald-500'" class="mt-0.5 text-base" />
                <div class="min-w-0 flex flex-col gap-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">{{ entry.day }}</span>
                    <span
                      :class="entry.changed
                        ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'"
                      class="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase"
                    >
                      {{ entry.changed ? 'Thread Updated' : 'No Durable Change' }}
                    </span>
                  </div>
                  <p v-if="entry.notes?.length" class="truncate text-[10px] text-neutral-500 dark:text-neutral-400">
                    {{ entry.notes[0] }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- STAGING MODAL: Source Data (7k) Explorer -->
    <div v-if="showSourceModal && activeCharacterArtifact" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div class="shadow-3xl max-w-6xl w-full border border-neutral-200 rounded-[2.5rem] bg-white p-10 dark:border-neutral-800 dark:bg-neutral-900">
        <header class="mb-8 flex items-center justify-between">
          <h3 class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">
            Canonical Thread: Source Explorer
          </h3>
          <Button icon="i-solar:close-circle-bold-duotone" variant="secondary-muted" @click="showSourceModal = false" />
        </header>

        <div class="grid gap-8 md:grid-cols-2">
          <!-- 7k Source (Undistilled) -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-neutral-500 font-bold tracking-widest uppercase">Undistilled Source ({{ artifactTokens7k }} tokens)</span>
            </div>
            <div class="max-h-[500px] flex-1 overflow-y-auto border border-neutral-200 rounded-2xl bg-neutral-50 p-6 text-[13px] text-neutral-600 dark:border-neutral-800 dark:bg-black/20 dark:text-neutral-400">
              <MarkdownRenderer :content="activeCharacterArtifact.baseContent" />
            </div>
          </div>

          <!-- 1k Canonical (Distilled) -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-amber-600 font-bold tracking-widest uppercase">Distilled Essence ({{ artifactTokens1k }} tokens)</span>
            </div>
            <div class="max-h-[500px] flex-1 overflow-y-auto border border-amber-500/20 rounded-2xl bg-amber-500/5 p-6 text-[13px] text-neutral-800 dark:border-amber-500/10 dark:bg-amber-500/5 dark:text-neutral-200">
              <MarkdownRenderer :content="activeCharacterArtifact.distilledContent" />
            </div>
          </div>
        </div>

        <footer class="mt-8 border-t border-neutral-100 pt-8 text-center dark:border-neutral-800">
          <p class="mx-auto max-w-xl text-xs text-neutral-500 italic dark:text-neutral-400">
            The canonical thread is distilled from the source archive by deduping motifs and summarizing erratic session shifts into a stable identity baseline.
          </p>
        </footer>
      </div>
    </div>

    <!-- Lifetime Provisioning Modal -->
    <LifetimeProvisioningModal
      v-if="activeCardId"
      v-model:open="showLifetimeModal"
      :character-id="activeCardId"
    />

    <!-- Lifetime History Modal -->
    <LifetimeHistoryModal
      v-if="activeCardId"
      v-model:open="showHistoryModal"
      :character-id="activeCardId"
    />
  </div>
</template>

<style scoped>
.font-urbanist {
  font-family: 'Urbanist', sans-serif;
  -webkit-font-smoothing: antialiased;
}
</style>
