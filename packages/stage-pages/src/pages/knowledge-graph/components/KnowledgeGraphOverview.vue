<script setup lang="ts">
import type { EntityType } from '@proj-airi/stage-ui/libs/search/entity-ledger'

import { useEntityLedgerStore } from '@proj-airi/stage-ui/stores/entity-ledger'
import { useTextJournalStore } from '@proj-airi/stage-ui/stores/memory-text-journal'
import { Button, Progress } from '@proj-airi/ui'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    characterId?: string
    showWorkspaceButton?: boolean
    showActions?: boolean
  }>(),
  {
    characterId: '',
    showWorkspaceButton: false,
    showActions: true,
  },
)

const emit = defineEmits<{
  (e: 'selectEntity', entityId: string): void
  (e: 'rebuild'): void
  (e: 'clear'): void
  (e: 'rebuildVector'): void
}>()

const router = useRouter()
const entityLedgerStore = useEntityLedgerStore()
const textJournalStore = useTextJournalStore()

const graphSubTab = ref<'entities' | 'claims' | 'sources'>('entities')
const entityTypeFilter = ref<EntityType | 'all'>('all')
const entitySearchTerm = ref('')
const claimSearchTerm = ref('')

function formatTimestamp(timestamp?: number | null) {
  if (!timestamp)
    return ''
  return new Date(timestamp).toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function navigateToWorkspaceMindMap() {
  localStorage.setItem('airi:chat:left-panel-active', 'knowledge-graph')
  router.push('/chat')
}

const filteredEntities = computed(() => {
  return entityLedgerStore.activeLedger.queryEntities(
    entityTypeFilter.value === 'all' ? undefined : entityTypeFilter.value,
    entitySearchTerm.value,
  )
})

const filteredClaims = computed(() => {
  const q = claimSearchTerm.value.trim().toLowerCase()
  if (!q)
    return entityLedgerStore.claims
  return entityLedgerStore.claims.filter(c =>
    c.subject.toLowerCase().includes(q)
    || c.predicate.toLowerCase().includes(q)
    || c.object.toLowerCase().includes(q),
  )
})

// --- Vector search index telemetry -------------------------------------------
// Counts come from the last persisted snapshot header, so this reflects what a
// restart would hydrate — not an optimistic in-memory estimate.
const vectorStats = computed(() => textJournalStore.vectorIndexStats)

const vectorPassActive = computed(() => {
  if (textJournalStore.isRebuildingVectorIndex)
    return true
  const phase = textJournalStore.backgroundIndexProgress?.phase
  return phase === 'hot-set' || phase === 'backfill' || phase === 'delta' || phase === 'checkpoint'
})

const vectorPassPercent = computed(() => {
  if (textJournalStore.isRebuildingVectorIndex)
    return textJournalStore.vectorIndexProgress?.percent ?? 0
  return textJournalStore.backgroundIndexProgress?.percent ?? 0
})

const vectorPassLabel = computed(() => {
  if (textJournalStore.isRebuildingVectorIndex)
    return textJournalStore.vectorIndexProgress?.message || 'Rebuilding vector search index...'
  return textJournalStore.backgroundIndexProgress?.message || ''
})

type VectorIndexTone = 'ready' | 'indexing' | 'stale' | 'partial' | 'empty'

const vectorIndexState = computed<{ label: string, tone: VectorIndexTone }>(() => {
  if (vectorPassActive.value)
    return { label: 'Indexing', tone: 'indexing' }
  if (vectorStats.value.stale)
    return { label: 'Stale', tone: 'stale' }
  if (vectorStats.value.documents === 0)
    return { label: 'Empty', tone: 'empty' }
  if (vectorStats.value.vectors < vectorStats.value.documents)
    return { label: 'Partial', tone: 'partial' }
  return { label: 'Ready', tone: 'ready' }
})

const vectorCoverageLabel = computed(() => {
  const at = vectorStats.value.coverageAt
  if (!at)
    return 'Not covered'
  return new Date(at).toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' })
})

// Which execution provider actually loaded the embedder. `wasm` is the fp32
// CPU fallback — same model, same vectors, far heavier.
const embedderRuntime = computed(() => textJournalStore.embedderRuntime)

const embedderLabel = computed(() => {
  const embedder = embedderRuntime.value
  if (!embedder)
    return 'Embedder idle'
  const model = embedder.modelId.includes('embeddinggemma')
    ? 'EmbeddingGemma 2'
    : embedder.modelId.split('/').pop() || embedder.modelId
  const device = embedder.device === 'webgpu' ? 'WebGPU' : 'CPU'
  return `${model} · ${device} ${embedder.dtype}`
})

onMounted(() => {
  // The store may already be loaded (chat window); probe again so the chip
  // reflects a model that was loaded by earlier chat turns.
  void textJournalStore.refreshEmbedderRuntime()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Graph Telemetry & Rebuild Controls Card -->
    <section class="border border-neutral-200 rounded-[2.5rem] bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <!-- Total Entities -->
            <div class="border border-neutral-100 rounded-2xl bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
              <span class="block text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Entities</span>
              <span class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">{{ entityLedgerStore.stats.entitiesCount }}</span>
            </div>
            <!-- Claims / Triples -->
            <div class="border border-neutral-100 rounded-2xl bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
              <span class="block text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Claims (S,P,O)</span>
              <span class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">{{ entityLedgerStore.stats.claimsCount }}</span>
            </div>
            <!-- Sources -->
            <div class="border border-neutral-100 rounded-2xl bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
              <span class="block text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Sources</span>
              <span class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">{{ entityLedgerStore.stats.sourcesCount }}</span>
            </div>
            <!-- Mentions -->
            <div class="border border-neutral-100 rounded-2xl bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
              <span class="block text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Mentions</span>
              <span class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">{{ entityLedgerStore.stats.mentionsCount }}</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div v-if="showActions" class="flex flex-wrap items-center gap-3">
            <Button
              v-if="showWorkspaceButton"
              label="Open in Workspace"
              icon="i-solar:square-top-down-bold-duotone"
              variant="secondary"
              @click="navigateToWorkspaceMindMap"
            />
            <Button
              :label="textJournalStore.isRebuildingVectorIndex ? 'Rebuilding Index...' : 'Rebuild Vector Search Index'"
              icon="i-solar:database-bold-duotone"
              variant="secondary"
              :disabled="entityLedgerStore.isPriming || textJournalStore.isRebuildingVectorIndex"
              @click="emit('rebuildVector')"
            />
            <Button
              v-if="textJournalStore.isRebuildingVectorIndex"
              label="Cancel"
              icon="i-solar:close-circle-bold-duotone"
              variant="secondary"
              @click="textJournalStore.cancelRebuildVectorIndex()"
            />
            <Button
              label="Rebuild Knowledge Graph"
              icon="i-solar:bolt-bold-duotone"
              variant="primary"
              :disabled="entityLedgerStore.isPriming"
              @click="emit('rebuild')"
            />
            <Button
              label="Clear Graph"
              icon="i-solar:trash-bin-trash-bold-duotone"
              variant="secondary"
              :disabled="entityLedgerStore.isPriming"
              @click="emit('clear')"
            />
          </div>
        </div>

        <!-- Vector Search Index Telemetry -->
        <div class="flex flex-col gap-3 border border-neutral-100 rounded-2xl bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-950/30">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <div class="i-solar:database-bold-duotone text-base text-emerald-500" />
              <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Vector Search Index</span>
              <span
                class="border rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                :class="[
                  vectorIndexState.tone === 'ready'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                    : vectorIndexState.tone === 'indexing'
                      ? 'border-primary-500/30 bg-primary-500/10 text-primary-600 dark:text-primary-300'
                      : vectorIndexState.tone === 'stale'
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300'
                        : vectorIndexState.tone === 'partial'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                          : 'border-neutral-300/60 bg-neutral-500/10 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400',
                ]"
              >
                {{ vectorIndexState.label }}
              </span>
              <span
                class="border rounded-full px-2 py-0.5 text-[10px] font-mono"
                :class="[
                  embedderRuntime
                    ? embedderRuntime.device === 'wasm'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                      : 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300'
                    : 'border-neutral-300/60 bg-neutral-500/10 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400',
                ]"
                :title="embedderRuntime?.modelId ?? 'The embedding model loads on first use.'"
              >
                {{ embedderLabel }}
              </span>
            </div>
            <span v-if="vectorStats.indexedAt" class="text-[10px] text-neutral-400 font-mono">
              Snapshot {{ formatTimestamp(vectorStats.indexedAt) }}
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div>
              <span class="block text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Documents</span>
              <span class="text-lg text-neutral-800 font-bold dark:text-neutral-100">{{ vectorStats.documents.toLocaleString() }}</span>
            </div>
            <div>
              <span class="block text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Embedded Vectors</span>
              <span class="text-lg text-neutral-800 font-bold dark:text-neutral-100">{{ vectorStats.vectors.toLocaleString() }}</span>
            </div>
            <div>
              <span class="block text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Coverage Through</span>
              <span class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">{{ vectorCoverageLabel }}</span>
            </div>
          </div>

          <!-- Explicit rebuilds render their own banner below; this bar covers
               the resumable background pass so the two never double up. -->
          <div v-if="vectorPassActive && !textJournalStore.isRebuildingVectorIndex" class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
              <span>{{ vectorPassLabel }}</span>
              <span class="font-bold">{{ vectorPassPercent }}%</span>
            </div>
            <Progress :progress="vectorPassPercent" />
          </div>

          <span v-if="vectorStats.stale" class="text-[10px] text-rose-600 dark:text-rose-300">
            Snapshot geometry is incompatible with the active embedding model; run Rebuild Vector Search Index.
          </span>
          <span v-else-if="embedderRuntime?.device === 'wasm'" class="text-[10px] text-amber-600 dark:text-amber-300">
            WebGPU is unavailable or failed to initialise, so embeddings run on the CPU in fp32. This is the heavy path — expect pegged cores while indexing and slower retrieval.
          </span>
          <span v-else-if="!vectorPassActive && vectorStats.documents > vectorStats.vectors" class="text-[10px] text-amber-600 dark:text-amber-300">
            {{ (vectorStats.documents - vectorStats.vectors).toLocaleString() }} document(s) still have no embedding; the background pass fills them oldest-first.
          </span>
        </div>

        <!-- Universe & Ingestion Breakdown Sub-banner -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span class="flex items-center gap-1.5">
              <span class="i-solar:planet-bold-duotone text-primary-500" />
              <span>Universe: <strong>{{ entityLedgerStore.telemetry.universeId }}</strong></span>
            </span>
            <span>•</span>
            <span>Sessions: <strong>{{ entityLedgerStore.telemetry.sessionsDiscovered }}</strong> <span v-if="entityLedgerStore.telemetry.canonicalSessionTitle !== 'None'" class="text-neutral-400">({{ entityLedgerStore.telemetry.canonicalSessionTurns }} canonical turns)</span></span>
            <span>•</span>
            <span>Raw Dialogue Turns: <strong>{{ entityLedgerStore.telemetry.deduplicatedTurnsIngested }}</strong> <span v-if="entityLedgerStore.telemetry.duplicatedForkTurnsSkipped > 0" class="text-neutral-400">({{ entityLedgerStore.telemetry.duplicatedForkTurnsSkipped }} fork duplicates skipped)</span></span>
            <span>•</span>
            <span>Journals: <strong>{{ entityLedgerStore.telemetry.journalEntriesIngested }}</strong></span>
          </div>
          <div v-if="entityLedgerStore.lastPrimedAt" class="text-[10px] text-neutral-400 font-mono">
            Last Primed: {{ formatTimestamp(entityLedgerStore.lastPrimedAt) }}
          </div>
        </div>

        <!-- Empty Ingestion Warning Banner if nothing found -->
        <div
          v-if="!entityLedgerStore.isPriming && entityLedgerStore.stats.entitiesCount === 0 && entityLedgerStore.telemetry.availableCharacterKeys.length > 0"
          class="flex items-start gap-3 border border-amber-500/20 rounded-2xl bg-amber-500/5 p-4 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
        >
          <div class="i-solar:info-circle-bold-duotone mt-0.5 flex-shrink-0 text-base text-amber-500" />
          <div class="flex flex-col gap-1">
            <span class="font-bold">No records found for character "{{ characterId }}" in universe "{{ entityLedgerStore.telemetry.universeId }}".</span>
            <span>Available characters in local database: <code class="font-bold font-mono">{{ entityLedgerStore.telemetry.availableCharacterKeys.join(', ') }}</code>.</span>
          </div>
        </div>

        <!-- Progress Bar during Priming -->
        <div v-if="entityLedgerStore.isPriming" class="flex flex-col gap-2 rounded-2xl bg-primary-500/5 p-4 dark:bg-primary-500/10">
          <div class="flex items-center justify-between text-xs text-primary-700 dark:text-primary-300">
            <span class="flex items-center gap-2">
              <div class="i-solar:loading-bold animate-spin" />
              {{ entityLedgerStore.primingStatusText }}
            </span>
            <span class="font-bold">{{ Math.round(entityLedgerStore.primingProgress * 100) }}%</span>
          </div>
          <Progress :progress="entityLedgerStore.primingProgress * 100" />
        </div>

        <!-- Progress Bar during Vector Index Rebuilding -->
        <div v-if="textJournalStore.isRebuildingVectorIndex" class="flex flex-col gap-2 rounded-2xl bg-emerald-500/5 p-4 dark:bg-emerald-500/10">
          <div class="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
            <span class="flex items-center gap-2">
              <div class="i-solar:loading-bold animate-spin" />
              {{ textJournalStore.vectorIndexProgress?.message || 'Rebuilding vector search index...' }}
            </span>
            <span class="font-bold">{{ textJournalStore.vectorIndexProgress?.percent ?? 0 }}%</span>
          </div>
          <Progress :progress="textJournalStore.vectorIndexProgress?.percent ?? 0" />
        </div>
      </div>
    </section>

    <!-- Graph Explorer Tabs -->
    <section class="flex flex-col gap-4">
      <!-- Sub-Tabs Navigation -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
        <div class="flex items-center gap-2">
          <button
            type="button"
            :class="[
              'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              graphSubTab === 'entities'
                ? 'bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
            ]"
            @click="graphSubTab = 'entities'"
          >
            Entities ({{ filteredEntities.length }})
          </button>
          <button
            type="button"
            :class="[
              'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              graphSubTab === 'claims'
                ? 'bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
            ]"
            @click="graphSubTab = 'claims'"
          >
            Claims & Relations ({{ filteredClaims.length }})
          </button>
          <button
            type="button"
            :class="[
              'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              graphSubTab === 'sources'
                ? 'bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
            ]"
            @click="graphSubTab = 'sources'"
          >
            Dialogue Sources ({{ entityLedgerStore.sources.length }})
          </button>
        </div>

        <!-- Quick Filters based on active sub-tab -->
        <div v-if="graphSubTab === 'entities'" class="flex flex-wrap items-center gap-2">
          <input
            v-model="entitySearchTerm"
            type="text"
            placeholder="Search entities..."
            class="border border-neutral-200 rounded-xl bg-white px-3 py-1.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
          <div class="flex items-center gap-1 overflow-x-auto py-1 text-[11px]">
            <button
              v-for="t in (['all', 'person', 'animal', 'place', 'organization', 'activity', 'concept', 'unknown'] as const)"
              :key="t"
              type="button"
              :class="[
                'px-2.5 py-1 rounded-md capitalize transition-all whitespace-nowrap cursor-pointer',
                entityTypeFilter === t
                  ? 'bg-primary-500/10 text-primary-600 font-bold dark:text-primary-400'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300',
              ]"
              @click="entityTypeFilter = t"
            >
              {{ t }}
            </button>
          </div>
        </div>

        <div v-else-if="graphSubTab === 'claims'" class="flex items-center gap-2">
          <input
            v-model="claimSearchTerm"
            type="text"
            placeholder="Filter claims by S, P, O..."
            class="w-64 border border-neutral-200 rounded-xl bg-white px-3 py-1.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
        </div>
      </div>

      <!-- Sub-Tab Content: Entities -->
      <div v-if="graphSubTab === 'entities'">
        <div v-if="filteredEntities.length === 0" class="border-2 border-neutral-200 rounded-[2rem] border-dashed p-10 text-center text-neutral-400 dark:border-neutral-800">
          No entities found. Click <strong>"Rebuild Knowledge Graph"</strong> above to extract entities from conversation and journal history.
        </div>
        <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="ent in filteredEntities"
            :key="ent.entityId"
            class="group cursor-pointer border border-neutral-200 rounded-2xl bg-white p-4 shadow-sm transition-all dark:border-neutral-800 hover:border-primary-500/50 dark:bg-neutral-900/60 hover:shadow-md"
            @click="emit('selectEntity', ent.entityId)"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-sm text-neutral-800 font-bold transition-colors dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                {{ ent.label }}
              </span>
              <span
                class="rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                :class="[
                  ent.type === 'person' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                  : ent.type === 'animal' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : ent.type === 'place' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : ent.type === 'organization' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : ent.type === 'activity' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : ent.type === 'concept' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
                ]"
              >
                {{ ent.type }}
              </span>
            </div>
            <div v-if="Object.keys(ent.attributes).filter(k => k !== 'systemOne').length > 0" class="mt-3 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-2 dark:border-neutral-800">
              <span
                v-for="(val, key) in ent.attributes"
                v-show="key !== 'systemOne'"
                :key="key"
                class="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {{ key }}: <strong>{{ typeof val === 'object' ? JSON.stringify(val) : val }}</strong>
              </span>
            </div>
            <div class="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
              <span>Mentions: {{ ent.mentions.size }}</span>
              <span class="flex items-center gap-1 text-primary-500 font-semibold opacity-0 transition-opacity group-hover:opacity-100">
                <span>Inspect</span>
                <div class="i-solar:eye-bold-duotone text-xs" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sub-Tab Content: Claims -->
      <div v-else-if="graphSubTab === 'claims'">
        <div v-if="filteredClaims.length === 0" class="border-2 border-neutral-200 rounded-[2rem] border-dashed p-10 text-center text-neutral-400 dark:border-neutral-800">
          No claims recorded yet. Click <strong>"Rebuild Knowledge Graph"</strong> to extract relational triples.
        </div>
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="claim in filteredClaims"
            :key="claim.claimId"
            class="flex flex-wrap items-center justify-between gap-3 border border-neutral-200 rounded-2xl bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60"
          >
            <div class="flex items-center gap-2">
              <span class="rounded-lg bg-sky-500/10 px-2.5 py-1 text-xs text-sky-600 font-bold dark:text-sky-400">
                {{ claim.subject }}
              </span>
              <span class="text-xs text-neutral-400 font-mono">➔</span>
              <span class="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-600 font-bold dark:text-emerald-400">
                {{ claim.predicate }}
              </span>
              <span class="text-xs text-neutral-400 font-mono">➔</span>
              <span class="rounded-lg bg-purple-500/10 px-2.5 py-1 text-xs text-purple-600 font-bold dark:text-purple-400">
                {{ claim.object }}
              </span>
            </div>

            <div class="flex items-center gap-2 text-xs">
              <span v-if="claim.dateInfo?.formatted_label" class="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400">
                {{ claim.dateInfo.formatted_label }}
              </span>
              <span class="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 font-mono dark:bg-neutral-800 dark:text-neutral-400">
                Evidence: {{ claim.evidence.join(', ') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sub-Tab Content: Sources -->
      <div v-else-if="graphSubTab === 'sources'">
        <div v-if="entityLedgerStore.sources.length === 0" class="border-2 border-neutral-200 rounded-[2rem] border-dashed p-10 text-center text-neutral-400 dark:border-neutral-800">
          No dialogue sources indexed. Click <strong>"Rebuild Knowledge Graph"</strong> above.
        </div>
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="src in entityLedgerStore.sources"
            :key="src.turnId"
            class="border border-neutral-200 rounded-2xl bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60"
          >
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="text-neutral-700 font-bold dark:text-neutral-200">{{ src.speaker }}</span>
              <span class="text-[10px] text-neutral-400 font-mono">{{ formatTimestamp(src.timestamp) }}</span>
            </div>
            <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
              {{ src.text }}
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
