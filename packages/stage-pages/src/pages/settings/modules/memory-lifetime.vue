<script setup lang="ts">
import { estimateTokens } from '@proj-airi/stage-shared'
import { MarkdownRenderer } from '@proj-airi/stage-ui/components'
import { useMemoryLifetimeStore } from '@proj-airi/stage-ui/stores/memory-lifetime'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'

import LifetimeHistoryModal from './components/LifetimeHistoryModal.vue'
import LifetimeProvisioningModal from './components/LifetimeProvisioningModal.vue'

const airiCardStore = useAiriCardStore()
const { activeCardId, cards } = storeToRefs(airiCardStore)
const lifetimeStore = useMemoryLifetimeStore()
const { artifacts, isProvisioning } = storeToRefs(lifetimeStore)

// --- Local State ---
const showSourceModal = ref(false)
const showHistoryModal = ref(false)
const showLifetimeModal = ref(false)
const autoHandoff = ref(true)

const activeCharacterArtifact = computed(() => {
  if (!activeCardId.value) return null
  return artifacts.value.get(activeCardId.value) || null
})

const isProvisioned = computed(() => !!activeCharacterArtifact.value)

const activeCard = computed(() => {
  if (!activeCardId.value) return null
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

const threadStatus = computed(() => [
  { icon: 'i-solar:dna-bold-duotone', label: 'Soul Active' },
  {
    icon: 'i-solar:layers-bold-duotone',
    label: `Archive: ${activeCharacterArtifact.value?.metadata?.chunkCount || 0} Chunks`,
  },
  {
    icon: activeCharacterArtifact.value?.chunkSummaries?.length
      ? 'i-solar:database-bold-duotone'
      : 'i-solar:database-minimalistic-bold-duotone',
    label: activeCharacterArtifact.value?.chunkSummaries?.length ? 'Foundation: OK' : 'Foundation: Missing',
  },
])

async function loadData() {
  if (activeCardId.value) {
    await lifetimeStore.loadForCharacter(activeCardId.value)
  }
}

watch(activeCardId, () => loadData(), { immediate: true })
onMounted(() => loadData())
</script>

<template>
  <div class="font-urbanist relative flex flex-col gap-8 pb-12">
    <!-- Breadcrumb Nav -->
    <nav class="flex items-center gap-2 text-xs text-neutral-500 font-bold tracking-widest uppercase dark:text-neutral-400">
      <router-link to="/settings/memory" class="transition-colors hover:text-primary-500">
        Memory Hub
      </router-link>
      <div class="i-solar:alt-arrow-right-bold h-3 w-3" />
      <span class="text-neutral-400 dark:text-neutral-500">The Eternal Thread</span>
    </nav>

    <!-- Bespoke Header -->
    <header class="relative overflow-hidden border border-neutral-200 rounded-3xl bg-neutral-100/40 p-8 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="absolute h-64 w-64 bg-amber-500/10 blur-3xl -right-24 -top-24" />
      <div class="absolute h-64 w-64 bg-orange-500/10 blur-3xl -bottom-24 -left-24" />

      <div class="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="flex flex-col gap-2">
          <div class="h-16 w-16 flex items-center justify-center rounded-2xl bg-amber-500/20 text-4xl text-amber-500 shadow-inner">
            <div class="i-solar:dna-bold-duotone inline-block" />
          </div>
          <h1 class="text-4xl text-neutral-800 font-bold tracking-tight dark:text-neutral-100">
            The Eternal Thread
          </h1>
          <p class="max-w-2xl text-lg text-neutral-500 line-height-relaxed dark:text-neutral-400">
            The long-term memory of the relationship. It keeps the bond stable across resets by merging daily changes into a permanent identity.
          </p>
        </div>

        <div v-if="isProvisioned" class="flex flex-col items-end gap-2">
          <div class="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs text-emerald-700 font-bold dark:text-emerald-400">
            <div class="i-solar:check-circle-bold-duotone text-base" />
            Character Subscribed
          </div>
          <Button label="Change Character" icon="i-solar:users-group-two-rounded-bold-duotone" variant="secondary" />
        </div>
      </div>

      <!-- Thread Status Strip -->
      <div v-if="isProvisioned" class="mt-8 flex flex-wrap gap-3">
        <div
          v-for="chip in threadStatus"
          :key="chip.label"
          class="flex items-center gap-2 border border-neutral-200/50 rounded-full bg-white/50 px-4 py-2 text-xs font-bold tracking-tight uppercase shadow-sm dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-neutral-200"
        >
          <div :class="[chip.icon, 'text-amber-500 text-base']" />
          {{ chip.label }}
        </div>
      </div>
    </header>

    <!-- STATE A: Character Unprovisioned -->
    <section v-if="!isProvisioned && !isProvisioning" class="relative overflow-hidden border border-amber-500/20 rounded-[2.5rem] bg-amber-500/5 p-12 text-center dark:border-amber-500/10">
      <div class="mx-auto mb-6 h-20 w-20 flex items-center justify-center rounded-3xl bg-amber-500/10 text-5xl text-amber-500">
        <div class="i-solar:link-break-bold-duotone" />
      </div>
      <h2 class="mb-2 text-3xl text-neutral-800 font-bold dark:text-neutral-100">
        Permanent Identity Offline
      </h2>
      <p class="mx-auto mb-8 max-w-lg text-neutral-500 dark:text-neutral-400">
        Lifetime monitoring is not yet active for <span class="text-neutral-700 font-bold dark:text-neutral-200">{{ activeCard?.name || 'this character' }}</span>. Enable the Eternal Thread to start distilling daily conversations into a permanent soul blueprint.
      </p>
      <Button label="Enable Eternal Thread" variant="primary" size="lg" icon="i-solar:plug-circle-bold-duotone" @click="showLifetimeModal = true" />
    </section>

    <!-- STATE B: Character Provisioned (The Terminal) -->
    <div v-if="isProvisioned" class="flex flex-col gap-8">
      <!-- The Trinity Cards -->
      <div class="grid gap-6 lg:grid-cols-3">
        <section class="border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          <div class="mb-4 h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 text-xl text-amber-500">
            <div class="i-solar:shield-user-bold-duotone" />
          </div>
          <h3 class="mb-2 text-xl text-neutral-800 font-bold dark:text-neutral-100">
            The Core Bond
          </h3>
          <p class="mb-6 text-sm text-neutral-500 italic dark:text-neutral-400">
            Stable personality baseline protected against session-reset erasure.
          </p>
          <ul class="flex flex-col gap-3">
            <li v-for="item in ['Stable Identity Benchmark', 'Cross-Session Continuity', 'Durable Motif Tracking']" :key="item" class="flex items-center gap-3 text-sm text-neutral-700 font-medium dark:text-neutral-300">
              <div class="i-solar:check-circle-bold-duotone text-amber-500" />
              {{ item }}
            </li>
          </ul>
        </section>

        <section class="border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          <div class="mb-4 h-10 w-10 flex items-center justify-center rounded-xl bg-orange-500/10 text-xl text-orange-500">
            <div class="i-solar:history-bold-duotone" />
          </div>
          <h3 class="mb-2 text-xl text-neutral-800 font-bold dark:text-neutral-100">
            Daily Updates
          </h3>
          <p class="mb-6 text-sm text-neutral-500 italic dark:text-neutral-400">
            Piggybacks on the 24H STMM cycle to integrate meaningful session shifts.
          </p>
          <ul class="flex flex-col gap-3">
            <li v-for="item in ['Incremental Soul Rebasing', 'STMM Cycle Handoff', 'Automatic Conflict Resolution']" :key="item" class="flex items-center gap-3 text-sm text-neutral-700 font-medium dark:text-neutral-300">
              <div class="i-solar:add-circle-bold-duotone text-orange-500" />
              {{ item }}
            </li>
          </ul>
        </section>

        <section class="border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          <div class="mb-4 h-10 w-10 flex items-center justify-center rounded-xl bg-primary-500/10 text-xl text-primary-500">
            <div class="i-solar:lock-bold-duotone" />
          </div>
          <h3 class="mb-2 text-xl text-neutral-800 font-bold dark:text-neutral-100">
            Stability Guard
          </h3>
          <p class="mb-6 text-sm text-neutral-500 italic dark:text-neutral-400">
            Monitors for erratic identity drift and ensures long-term bond integrity.
          </p>
          <ul class="flex flex-col gap-3">
            <li v-for="item in ['Bond Integrity Monitoring', 'Personality Protection', 'Durable History Vault']" :key="item" class="flex items-center gap-3 text-sm text-neutral-700 font-medium dark:text-neutral-300">
              <div class="i-solar:security-safe-bold-duotone text-primary-500" />
              {{ item }}
            </li>
          </ul>
        </section>
      </div>

      <!-- HERO: The 1k Soul Blueprint -->
      <section v-if="activeCharacterArtifact" class="relative overflow-hidden border border-amber-500/20 rounded-[2.5rem] bg-amber-500/5 p-1 px-1 shadow-2xl dark:border-amber-500/10">
        <div class="rounded-[2.2rem] bg-white p-10 dark:bg-neutral-900/90">
          <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 text-xl text-amber-500">
                <div class="i-solar:dna-bold-duotone" />
              </div>
              <div>
                <h2 class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">
                  Canonical Thread
                </h2>
                <p class="text-sm text-neutral-500 italic dark:text-neutral-400">
                  This is the distilled 1k entry AIRI reloads from.
                </p>
              </div>
            </div>
          </div>

          <div class="relative overflow-hidden border border-neutral-200 rounded-2xl bg-neutral-50/50 p-6 leading-relaxed dark:border-neutral-800 dark:bg-black/20">
            <div class="absolute right-4 top-4 text-4xl text-amber-500/10">
              <div class="i-solar:quotation-mark-bold-duotone" />
            </div>
            <div class="text-lg text-neutral-700 leading-loose dark:text-neutral-200">
              <MarkdownRenderer :content="activeCharacterArtifact.distilledContent" />
            </div>
          </div>

          <div class="mt-6 flex flex-wrap items-center justify-between gap-6">
            <div class="flex items-center gap-6">
              <div class="flex flex-col">
                <span class="text-[10px] text-neutral-500 tracking-tighter uppercase">Distilled Artifact</span>
                <span class="text-sm text-neutral-800 font-bold dark:text-neutral-200">~{{ artifactTokens1k }} Tokens</span>
              </div>
              <div class="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />
              <button
                class="group flex flex-col text-left transition-colors hover:text-primary-500"
                @click="showSourceModal = true"
              >
                <span class="text-[10px] text-neutral-500 tracking-tighter uppercase group-hover:text-primary-400">Source Archive ({{ Math.round(artifactTokens7k / 1000) }}k)</span>
                <span class="text-sm text-neutral-800 font-bold underline decoration-dotted dark:text-neutral-200 group-hover:text-primary-500">
                  {{ activeCharacterArtifact.sourceManifest.rawTurnCount }} Turns Condensed
                </span>
              </button>
            </div>
            <div class="flex gap-3">
              <Button label="View Thread History" variant="secondary" icon="i-solar:history-line-duotone" @click="showHistoryModal = true" />
              <Button label="Merge Lifetime History" variant="primary" icon="i-solar:restart-bold-duotone" @click="showLifetimeModal = true" />
            </div>
          </div>
        </div>
      </section>

      <!-- Lifecycle Console -->
      <section class="border border-neutral-200 rounded-[2.5rem] bg-white p-10 shadow-xl dark:border-neutral-800 dark:bg-neutral-900/80">
        <h2 class="mb-8 text-2xl text-neutral-800 font-bold dark:text-neutral-100">
          Lifetime Controls
        </h2>
        <div class="grid gap-12 lg:grid-cols-2">
          <div class="flex flex-col justify-end">
            <div class="flex items-center gap-3 border border-neutral-200 rounded-2xl bg-neutral-50/50 px-8 py-6 dark:border-neutral-700 dark:bg-neutral-800/40">
              <input id="handoff" v-model="autoHandoff" type="checkbox" class="h-6 w-6 border-neutral-300 rounded text-amber-500">
              <label for="handoff" class="flex flex-col cursor-pointer">
                <span class="text-base text-neutral-700 font-bold dark:text-neutral-200">Daily Update Handoff</span>
                <span class="text-xs text-neutral-500 font-bold tracking-tighter uppercase">Your daily changes are merged into the thread at midnight</span>
              </label>
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

<route lang="yaml">
meta:
  layout: settings
  titleKey: The Eternal Thread
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
