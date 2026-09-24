<script setup lang="ts">
import type { EntityType } from '@proj-airi/stage-ui/libs/search/entity-ledger'

import { MarkdownRenderer } from '@proj-airi/stage-ui/components'
import { useAiriCardStore, useEntityLedgerStore, useTextJournalStore } from '@proj-airi/stage-ui/stores'
import { Button, FieldInput, FieldSelect, Progress } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import EntityDetailModal from './components/EntityDetailModal.vue'

interface CharacterOption { value: string, label: string }

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const router = useRouter()
const cardStore = useAiriCardStore()
const textJournalStore = useTextJournalStore()
const entityLedgerStore = useEntityLedgerStore()

function navigateToWorkspaceMindMap() {
  localStorage.setItem('airi:chat:left-panel-active', 'knowledge-graph')
  router.push('/chat')
}

const { cards, activeCardId } = storeToRefs(cardStore)
const { entries, loading, lastSearchTriage, lastSearchMode } = storeToRefs(textJournalStore)

const activeTab = ref<'records' | 'graph'>('records')
const graphSubTab = ref<'entities' | 'claims' | 'sources'>('entities')
const entityTypeFilter = ref<EntityType | 'all'>('all')
const entitySearchTerm = ref('')
const claimSearchTerm = ref('')

const selectedEntityId = ref<string | null>(null)
const isEntityDetailOpen = ref(false)

function openEntityDetail(idOrLabel: string) {
  let targetId = idOrLabel
  const entByLabel = entityLedgerStore.activeLedger.byAlias.get(idOrLabel.toLowerCase())
  if (entByLabel && entByLabel.size > 0) {
    targetId = Array.from(entByLabel)[0]
  }
  selectedEntityId.value = targetId
  isEntityDetailOpen.value = true
}

const selectedCharacter = ref('all')
const searchTerm = ref('')
const isSearching = ref(false)
const semanticResults = ref<(any & { kind?: string })[]>([])

const characterOptions = computed<CharacterOption[]>(() => {
  const options = Array.from(cards.value.entries()).map(([id, card]) => ({
    value: id,
    label: card.nickname?.trim() ? `${card.name} (${card.nickname.trim()})` : card.name,
  }))

  return [
    { value: 'all', label: 'All Characters' },
    ...options,
  ]
})

const activeCharacterCard = computed(() => {
  if (!selectedCharacter.value || selectedCharacter.value === 'all')
    return activeCardId.value ? cardStore.getCard(activeCardId.value) : null
  return cardStore.getCard(selectedCharacter.value)
})

const cognitionConfig = computed(() => {
  const card = activeCharacterCard.value
  const airiExt = card?.extensions?.airi as any
  return airiExt?.cognition || airiExt?.modules?.cognition || null
})

const rerankerProviderLabel = computed(() => {
  const prov = cognitionConfig.value?.searchEngine?.rerankerProvider
  if (!prov || prov === 'none')
    return 'None (BM25 + BGE Baseline)'
  if (prov === 'laya-local' || prov === 'laya')
    return 'Local Laya ONNX (On-Device)'
  if (prov === 'typesafe-ai' || prov === 'typesafe_jev')
    return 'TypeSafe Jev API'
  if (prov === 'openrouter-ai' || prov === 'openrouter')
    return 'OpenRouter Jev Decisions'
  return prov
})

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

async function handleRebuildGraph() {
  if (!selectedCharacter.value)
    return
  await entityLedgerStore.rebuildKnowledgeGraph(selectedCharacter.value)
  toast.success('Knowledge Graph rebuild complete.')
}

async function handleClearGraph() {
  if (!selectedCharacter.value)
    return
  await entityLedgerStore.clearLedger(selectedCharacter.value)
  toast.info('Knowledge Graph cleared.')
}

// Legacy keyword filter as a fallback
const keywordFilteredEntries = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()

  return entries.value.filter((entry) => {
    const matchesCharacter = selectedCharacter.value === 'all' || entry.characterId === selectedCharacter.value
    const matchesTerm = !term
      || entry.title.toLowerCase().includes(term)
      || entry.content.toLowerCase().includes(term)
      || entry.characterName.toLowerCase().includes(term)

    return matchesCharacter && matchesTerm
  })
})

const visibleEntries = computed(() => {
  const term = searchTerm.value.trim()
  if (!term)
    return keywordFilteredEntries.value

  // If we have semantic results, use them (already character-filtered in the search logic or post-filtered)
  if (semanticResults.value.length > 0) {
    return semanticResults.value.filter(res =>
      selectedCharacter.value === 'all' || res.characterId === selectedCharacter.value,
    )
  }

  // Fallback to keyword search if semantic came up empty
  return keywordFilteredEntries.value
})

let searchTimeout: any = null
watch(searchTerm, (term) => {
  if (searchTimeout)
    clearTimeout(searchTimeout)

  const trimmed = term.trim()
  if (!trimmed) {
    semanticResults.value = []
    return
  }

  searchTimeout = setTimeout(async () => {
    isSearching.value = true
    try {
      const results = await textJournalStore.searchEntries({
        query: trimmed,
        limit: 20,
      })
      semanticResults.value = results
    }
    catch (err) {
      console.error('LTMM: Semantic search failed, falling back to keywords:', err)
      semanticResults.value = []
    }
    finally {
      isSearching.value = false
    }
  }, 300)
})

async function seedEntry() {
  try {
    const entry = await textJournalStore.seedActiveCharacterEntry()
    toast.success(`Seeded journal entry for ${entry.characterName}.`)
    if (selectedCharacter.value === 'all' && activeCardId.value)
      selectedCharacter.value = activeCardId.value
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast.error(`Failed to seed journal entry: ${message}`)
  }
}

async function handleDeleteEntry(id: string) {
  try {
    await textJournalStore.deleteEntry(id)
    toast.success('Journal entry deleted.')
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    toast.error(`Failed to delete entry: ${message}`)
  }
}

watch(selectedCharacter, async (charId) => {
  if (charId) {
    await entityLedgerStore.loadLedger(charId)
  }
}, { immediate: true })

onMounted(async () => {
  cardStore.initialize()
  await textJournalStore.load()

  if (activeCardId.value && selectedCharacter.value === 'all')
    selectedCharacter.value = activeCardId.value
})

watch(characterOptions, (options) => {
  if (!options.some(option => option.value === selectedCharacter.value))
    selectedCharacter.value = activeCardId.value || 'all'
}, { immediate: true })
</script>

<template>
  <div class="font-urbanist relative flex flex-col gap-8 pb-12">
    <!-- Premium Header -->
    <header class="relative overflow-hidden border border-neutral-200 rounded-3xl bg-neutral-100/40 p-8 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="absolute h-64 w-64 bg-emerald-500/10 blur-3xl -right-24 -top-24" />
      <div class="absolute h-64 w-64 bg-teal-500/10 blur-3xl -bottom-24 -left-24" />

      <div class="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="flex flex-col gap-2">
          <div class="h-12 w-12 flex items-center justify-center rounded-2xl bg-emerald-500/20 text-3xl text-emerald-500 shadow-inner">
            <div class="i-solar:notebook-bookmark-bold-duotone" />
          </div>
          <h1 class="text-4xl text-neutral-800 font-bold tracking-tight dark:text-neutral-100">
            The Sentinel's Journal
          </h1>
          <p class="max-w-2xl text-lg text-neutral-500 line-height-relaxed dark:text-neutral-400">
            Durable episodic records. These are sacred narrative memories stored forever, accessible only when high-fidelity recall is required.
          </p>
        </div>
      </div>

      <!-- Tripartite Header Cards -->
      <div class="grid mt-8 gap-4 md:grid-cols-3">
        <!-- 1. The Sacred Vault -->
        <div class="group border border-neutral-200 rounded-2xl bg-white/50 p-5 shadow-sm transition-all dark:border-neutral-700/50 hover:border-emerald-500/30 dark:bg-neutral-800/40">
          <div class="mb-3 h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-lg text-emerald-500 transition-transform group-hover:scale-110">
            <div class="i-solar:safe-square-bold-duotone" />
          </div>
          <h3 class="mb-1 text-sm text-neutral-700 font-bold dark:text-neutral-200">
            The Sacred Vault
          </h3>
          <p class="mb-4 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            Durable local archive intentionally separate from session context.
          </p>
          <ul class="flex flex-col gap-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-700/50">
            <li v-for="s in ['IndexedDB Powered', 'Durable Local Storage', 'Permanent Anchors']" :key="s" class="flex items-center gap-2 text-[10px] text-neutral-500 font-bold tracking-widest uppercase dark:text-neutral-400">
              <div class="i-solar:check-circle-bold-duotone text-emerald-500" />
              {{ s }}
            </li>
          </ul>
        </div>

        <!-- 2. Record Integrity -->
        <div class="group border border-neutral-200 rounded-2xl bg-white/50 p-5 shadow-sm transition-all dark:border-neutral-700/50 hover:border-teal-500/30 dark:bg-neutral-800/40">
          <div class="mb-3 h-8 w-8 flex items-center justify-center rounded-lg bg-teal-500/10 text-lg text-teal-500 transition-transform group-hover:scale-110">
            <div class="i-solar:verified-check-bold-duotone" />
          </div>
          <h3 class="mb-1 text-sm text-neutral-700 font-bold dark:text-neutral-200">
            Record Integrity
          </h3>
          <p class="mb-4 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            Append-only architecture ensures records remain uncorrupted over time.
          </p>
          <ul class="flex flex-col gap-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-700/50">
            <li v-for="s in ['Zero Erasure Logic', 'Immutable History', 'Narrative Stability']" :key="s" class="flex items-center gap-2 text-[10px] text-neutral-500 font-bold tracking-widest uppercase dark:text-neutral-400">
              <div class="i-solar:check-circle-bold-duotone text-teal-500" />
              {{ s }}
            </li>
          </ul>
        </div>

        <!-- 3. Retrieval Engine -->
        <div class="group border border-neutral-200 rounded-2xl bg-white/50 p-5 shadow-sm transition-all dark:border-neutral-700/50 hover:border-primary-500/30 dark:bg-neutral-800/40">
          <div class="mb-3 h-8 w-8 flex items-center justify-center rounded-lg bg-primary-500/10 text-lg text-primary-500 transition-transform group-hover:scale-110">
            <div class="i-solar:magnifer-bold-duotone" />
          </div>
          <h3 class="mb-1 text-sm text-neutral-700 font-bold dark:text-neutral-200">
            Relational Recall
          </h3>
          <p class="mb-4 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            Powers deep relational grounding through hybrid keyword & semantic recall.
          </p>
          <ul class="flex flex-col gap-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-700/50">
            <li v-for="s in ['Character Scoped', 'Pattern Discovery', 'Durable Grounding']" :key="s" class="flex items-center gap-2 text-[10px] text-neutral-500 font-bold tracking-widest uppercase dark:text-neutral-400">
              <div class="i-solar:check-circle-bold-duotone text-primary-500" />
              {{ s }}
            </li>
          </ul>
        </div>
      </div>
    </header>

    <!-- Controls Console -->
    <section class="border border-neutral-200 rounded-[2.5rem] bg-white p-8 shadow-inner shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      <div class="grid gap-6 xl:grid-cols-[1fr_1.3fr_auto]">
        <FieldSelect
          v-model="selectedCharacter"
          label="Character Filter"
          description="Default retrieval stays scoped to the selected character."
          :options="characterOptions"
        />
        <FieldInput
          v-model="searchTerm"
          label="Search Archive"
          description="High-fidelity semantic retrieval across all memory layers (Raw, STMM, LTMM)."
          placeholder="Filter memories..."
        />
        <div class="flex items-end">
          <Button
            label="Seed Record"
            icon="i-solar:pen-new-square-bold-duotone"
            variant="secondary"
            @click="seedEntry"
          />
        </div>
      </div>
    </section>

    <!-- Segment Switcher -->
    <div class="flex items-center gap-2 border border-neutral-200/80 rounded-2xl bg-neutral-100/60 p-1.5 dark:border-neutral-800 dark:bg-neutral-900/60">
      <button
        type="button"
        :class="[
          'flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all duration-150',
          activeTab === 'records'
            ? 'bg-white text-emerald-600 shadow-sm border border-neutral-200/80 dark:bg-neutral-800 dark:text-emerald-400 dark:border-neutral-700'
            : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50',
        ]"
        @click="activeTab = 'records'"
      >
        <span class="i-solar:notebook-bookmark-bold-duotone text-base" />
        <span>The Sacred Records</span>
        <span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">
          {{ visibleEntries.length }}
        </span>
      </button>

      <button
        type="button"
        :class="[
          'flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all duration-150',
          activeTab === 'graph'
            ? 'bg-white text-primary-600 shadow-sm border border-neutral-200/80 dark:bg-neutral-800 dark:text-primary-400 dark:border-neutral-700'
            : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50',
        ]"
        @click="activeTab = 'graph'"
      >
        <span class="i-solar:diagram-up-bold-duotone text-base" />
        <span>Knowledge Graph</span>
        <span class="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-600 font-bold dark:text-primary-400">
          {{ entityLedgerStore.stats.entitiesCount }} Ent / {{ entityLedgerStore.stats.claimsCount }} Claims
        </span>
      </button>
    </div>

    <!-- The Sacred Records Feed -->
    <div v-if="activeTab === 'records'" class="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <section class="flex flex-col gap-6">
        <div class="flex items-center justify-between px-2">
          <div>
            <h3 class="font-urbanist text-2xl text-neutral-800 font-bold dark:text-neutral-100">
              The Sacred Records
            </h3>
            <p class="text-sm text-neutral-500 italic dark:text-neutral-400">
              Episodic memories for <span class="text-neutral-700 font-bold dark:text-neutral-200">{{ selectedCharacter === 'all' ? 'All Characters' : characterOptions.find(o => o.value === selectedCharacter)?.label }}</span>.
            </p>
          </div>
          <div class="border border-neutral-200 rounded-full bg-white px-4 py-1.5 text-xs text-neutral-600 font-bold shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {{ visibleEntries.length }} records stored
          </div>
        </div>

        <!-- Cognitive Strategy & Triage Banner -->
        <div
          v-if="searchTerm.trim() && (lastSearchTriage || isSearching)"
          class="flex flex-wrap items-center justify-between gap-3 border rounded-2xl px-5 py-3 text-xs transition-all"
          :class="[
            lastSearchMode === 'pass11'
              ? 'border-primary-500/30 bg-primary-500/5 text-primary-700 dark:text-primary-300'
              : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
          ]"
        >
          <div class="flex items-center gap-2.5">
            <div
              class="text-base"
              :class="[
                isSearching
                  ? 'i-solar:loading-bold animate-spin'
                  : (lastSearchMode === 'pass11' ? 'i-solar:cpu-bolt-bold-duotone text-primary-500' : 'i-solar:database-bold-duotone text-emerald-500'),
              ]"
            />
            <span class="font-bold tracking-wider uppercase">
              {{
                isSearching
                  ? 'Analyzing Query & Traversing Graph...'
                  : (lastSearchMode === 'pass11'
                    ? `Pass 11: ${lastSearchTriage?.choice?.toUpperCase().replace('_', ' ') || 'COGNITIVE TRIAGE'}`
                    : 'Baseline Floor: Hybrid RRF + Graph')
              }}
            </span>
            <span v-if="!isSearching && lastSearchTriage?.confidence" class="rounded-md bg-white/70 px-2 py-0.5 text-[10px] font-bold dark:bg-black/40">
              {{ Math.round(lastSearchTriage.confidence * 100) }}% confidence
            </span>
            <span v-if="!isSearching && lastSearchTriage?.searchScope === 'multi_session'" class="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-600 font-bold dark:text-indigo-400">
              Multi-Session Scope
            </span>
            <span v-if="!isSearching && lastSearchTriage?.temporalSubtype && lastSearchTriage.temporalSubtype !== 'none'" class="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400">
              {{ lastSearchTriage.temporalSubtype }}
            </span>
          </div>

          <div v-if="!isSearching && lastSearchTriage?.latencyMs" class="text-[10px] text-neutral-400 font-medium">
            Triage latency: {{ lastSearchTriage.latencyMs }}ms
          </div>
        </div>

        <div v-if="loading || isSearching" class="border-2 border-neutral-200 rounded-[2.5rem] border-dashed bg-neutral-50/50 p-12 text-center text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950/40">
          <div class="i-solar:loading-bold mx-auto mb-4 animate-spin text-4xl" />
          {{ isSearching ? 'Probing memory layers...' : 'Opening the vault...' }}
        </div>

        <div v-else-if="visibleEntries.length === 0" class="font-urbanist border-2 border-neutral-200 rounded-[2.5rem] border-dashed bg-neutral-50/50 p-12 text-center text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950/40">
          The records are silent. Use the <span class="text-emerald-600 font-bold dark:text-emerald-400">txt_journal</span> tool in chat to create a durable memory.
        </div>

        <div v-else class="flex flex-col gap-6">
          <template v-for="entry in visibleEntries" :key="entry.id">
            <!-- Knowledge Graph Relational Triple Card -->
            <article
              v-if="(entry as any).kind === 'kg_claim'"
              class="group relative overflow-hidden border border-primary-500/30 rounded-[2rem] bg-white p-7 shadow-sm transition-all dark:border-primary-500/20 hover:border-primary-500/60 dark:bg-neutral-900/60 hover:shadow-md"
            >
              <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2.5">
                  <div class="flex items-center gap-1.5 rounded-xl bg-primary-500/10 px-3.5 py-1 text-xs text-primary-600 font-bold dark:text-primary-400">
                    <div class="i-solar:diagram-up-bold-duotone text-sm" />
                    <span>Knowledge Graph Claim</span>
                  </div>
                  <span v-if="(entry as any).score" class="rounded-lg bg-neutral-100 px-2.5 py-0.5 text-[10px] text-neutral-600 font-bold dark:bg-neutral-800 dark:text-neutral-300">
                    Match Score: {{ Math.round((entry as any).score * 100) }}%
                  </span>
                </div>
                <div class="text-[10px] text-neutral-400 font-bold tracking-widest uppercase">
                  {{ formatTimestamp(entry.createdAt) }}
                </div>
              </div>

              <!-- Relational Triple Visual -->
              <div class="flex flex-wrap items-center gap-2.5 border border-neutral-100 rounded-2xl bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-black/20">
                <span class="rounded-lg bg-sky-500/10 px-3 py-1 text-xs text-sky-600 font-bold dark:text-sky-400">
                  {{ (entry as any).subject }}
                </span>
                <span class="text-xs text-neutral-400 font-mono">➔</span>
                <span class="rounded-lg bg-emerald-500/10 px-3 py-1 text-xs text-emerald-600 font-bold dark:text-emerald-400">
                  {{ (entry as any).predicate }}
                </span>
                <span class="text-xs text-neutral-400 font-mono">➔</span>
                <span class="rounded-lg bg-purple-500/10 px-3 py-1 text-xs text-purple-600 font-bold dark:text-purple-400">
                  {{ (entry as any).object }}
                </span>
                <span v-if="(entry as any).dateInfo?.formatted_label" class="ml-auto rounded-md bg-amber-500/10 px-2.5 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400">
                  {{ (entry as any).dateInfo.formatted_label }}
                </span>
              </div>

              <!-- Footer Action -->
              <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-2 dark:border-neutral-800/80">
                <span class="text-[11px] text-neutral-400">
                  Claim ID: <code class="text-[10px] font-mono">{{ (entry as any).claimId }}</code>
                </span>
                <button
                  type="button"
                  class="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-primary-600 font-bold transition-all hover:bg-primary-50 dark:text-primary-400 hover:text-primary-700 dark:hover:bg-primary-950/30"
                  @click="openEntityDetail((entry as any).subject)"
                >
                  <div class="i-solar:eye-bold-duotone text-sm" />
                  <span>Inspect Entity</span>
                </button>
              </div>
            </article>

            <!-- Standard Record Card -->
            <article
              v-else
              class="group relative overflow-hidden border border-neutral-200 rounded-[2rem] bg-white p-8 shadow-sm transition-all dark:border-neutral-800 hover:border-emerald-500/30 dark:bg-neutral-900/60"
            >
              <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap items-center gap-3">
                  <div class="rounded-xl bg-emerald-500/10 px-4 py-1.5 text-xs text-emerald-600 font-bold shadow-inner dark:text-emerald-400">
                    {{ entry.characterName }}
                  </div>
                  <div
                    :class="[
                      'rounded-xl px-4 py-1.5 text-xs font-bold uppercase tracking-widest',
                      (entry as any).kind === 'raw_turn'
                        ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                        : (entry as any).kind === 'stmm_block'
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                          : entry.source === 'tool'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : entry.source === 'seed'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
                    ]"
                  >
                    Source: {{ (entry as any).kind === 'raw_turn' ? 'Chat' : (entry as any).kind === 'stmm_block' ? 'Recap' : 'Journal' }}
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-[10px] text-neutral-400 font-bold tracking-widest uppercase">
                    {{ formatTimestamp(entry.createdAt) }}
                  </div>
                  <button
                    v-if="!(entry as any).kind || (entry as any).kind === 'ltmm_entry'"
                    class="rounded-lg p-1 text-neutral-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                    title="Delete journal record"
                    @click="handleDeleteEntry(entry.id)"
                  >
                    <div class="i-solar:trash-bin-trash-bold-duotone text-sm" />
                  </button>
                </div>
              </div>

              <div class="flex flex-col gap-4">
                <h4 class="text-xl text-neutral-800 font-bold leading-tight dark:text-neutral-100">
                  {{ entry.title }}
                </h4>
                <div class="relative overflow-hidden border border-neutral-100 rounded-2xl bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-black/20">
                  <MarkdownRenderer
                    :content="entry.content"
                    class="text-sm text-neutral-700 leading-relaxed dark:text-neutral-300"
                  />
                </div>
              </div>
            </article>
          </template>
        </div>
      </section>

      <!-- Sidebar: Archival Maintenance -->
      <section class="flex flex-col gap-6">
        <div class="sticky top-6">
          <div class="border border-neutral-200 rounded-[2.5rem] bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
            <h3 class="font-urbanist mb-4 text-xl text-neutral-800 font-bold dark:text-neutral-100">
              Episodic Governance
            </h3>

            <div class="flex flex-col gap-6">
              <div class="border border-neutral-100 rounded-2xl bg-neutral-50/70 p-5 dark:border-neutral-800 dark:bg-neutral-950/40">
                <span class="mb-2 block text-[10px] text-neutral-500 font-bold tracking-widest uppercase">Archive Purpose</span>
                <p class="text-sm text-neutral-700 leading-relaxed dark:text-neutral-200">
                  Episodic records are for durable lookup and high-fidelity recall, maintaining relationship integrity over long horizons.
                </p>
              </div>

              <div class="font-urbanist border border-neutral-100 rounded-2xl bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
                <span class="mb-3 block text-[10px] text-neutral-500 font-bold tracking-widest uppercase">Operational Rules</span>
                <ul class="flex flex-col gap-4">
                  <li class="flex gap-4">
                    <div class="h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                      <div class="i-solar:document-bold-duotone" />
                    </div>
                    <div class="flex flex-col">
                      <span class="font-urbanist text-sm text-neutral-700 font-bold dark:text-neutral-200">Manual Ingestion</span>
                      <span class="text-xs text-neutral-500 dark:text-neutral-400">Created explicitly by the character via the "txt_journal" tool.</span>
                    </div>
                  </li>
                  <li class="flex gap-4">
                    <div class="h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-500">
                      <div class="i-solar:database-bold-duotone" />
                    </div>
                    <div class="flex flex-col">
                      <span class="font-urbanist text-sm text-neutral-700 font-bold dark:text-neutral-200">Local Persistence</span>
                      <span class="text-xs text-neutral-500 dark:text-neutral-400">Stored forever in the secure character-scoped vault.</span>
                    </div>
                  </li>
                  <li class="flex gap-4">
                    <div class="h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
                      <div class="i-solar:shield-network-bold-duotone" />
                    </div>
                    <div class="flex flex-col">
                      <span class="font-urbanist text-sm text-neutral-700 font-bold dark:text-neutral-200">Identity Anchors</span>
                      <span class="text-xs text-neutral-500 dark:text-neutral-400">Prevents personality drift during high-complexity dialogues.</span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- The Knowledge Graph Dashboard -->
    <div v-else-if="activeTab === 'graph'" class="flex flex-col gap-6">
      <!-- 1. Character Cognition Bridge Banner -->
      <div class="border border-neutral-200/80 rounded-[2rem] from-primary-500/5 via-primary-500/10 to-teal-500/5 bg-gradient-to-r p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="flex items-center gap-4">
            <div class="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary-500/10 text-2xl text-primary-500 shadow-inner">
              <div class="i-solar:cpu-bolt-bold-duotone" />
            </div>
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">
                  Character Cognition Configuration
                </span>
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                  :class="cognitionConfig?.searchEngine?.universeRagEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'"
                >
                  {{ cognitionConfig?.searchEngine?.universeRagEnabled ? 'Universe RAG++ Active' : 'RAG Standby' }}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300">
                <span><strong>Reranker:</strong> {{ rerankerProviderLabel }}</span>
                <span>•</span>
                <span><strong>Threshold:</strong> {{ cognitionConfig?.searchEngine?.relevanceThreshold ?? 0.65 }}</span>
                <span>•</span>
                <span><strong>Reasoning:</strong> {{ cognitionConfig?.searchEngine?.reasoningModel ?? 'inherit' }}</span>
              </div>
            </div>
          </div>
          <RouterLink
            :to="{ path: '/settings/airi-card', query: { tab: 'cognition' } }"
            class="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs text-primary-600 font-semibold shadow-sm transition-all dark:bg-neutral-800 hover:bg-neutral-50 dark:text-primary-400 dark:hover:bg-neutral-700"
          >
            <span class="i-solar:settings-bold-duotone text-sm" />
            <span>Configure in Character Card</span>
            <span class="i-solar:arrow-right-line-duotone text-xs" />
          </RouterLink>
        </div>
      </div>

      <!-- 2. Graph Telemetry & Rebuild Controls -->
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
            <div class="flex items-center gap-3">
              <Button
                label="Open in Workspace"
                icon="i-solar:square-top-down-bold-duotone"
                variant="secondary"
                @click="navigateToWorkspaceMindMap"
              />
              <Button
                label="Rebuild Knowledge Graph"
                icon="i-solar:bolt-bold-duotone"
                variant="primary"
                :disabled="entityLedgerStore.isPriming"
                @click="handleRebuildGraph"
              />
              <Button
                label="Clear Graph"
                icon="i-solar:trash-bin-trash-bold-duotone"
                variant="secondary"
                :disabled="entityLedgerStore.isPriming"
                @click="handleClearGraph"
              />
            </div>
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
              <span class="font-bold">No records found for character "{{ selectedCharacter }}" in universe "{{ entityLedgerStore.telemetry.universeId }}".</span>
              <span>Available characters in local database: <code class="font-bold font-mono">{{ entityLedgerStore.telemetry.availableCharacterKeys.join(', ') }}</code>. Try selecting one from the character filter above.</span>
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
        </div>
      </section>

      <!-- 3. Graph Explorer Tabs -->
      <section class="flex flex-col gap-4">
        <!-- Sub-Tabs Navigation -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
          <div class="flex items-center gap-2">
            <button
              type="button"
              :class="[
                'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all',
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
                'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all',
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
                'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all',
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
          <div v-if="graphSubTab === 'entities'" class="flex items-center gap-2">
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
                  'px-2.5 py-1 rounded-md capitalize transition-all whitespace-nowrap',
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
              @click="openEntityDetail(ent.entityId)"
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

    <!-- Entity Detail Inspector Modal -->
    <EntityDetailModal
      v-model:open="isEntityDetailOpen"
      :entity-id="selectedEntityId"
      @deleted="selectedEntityId = null"
    />
  </div>
</template>

<style scoped>
.font-urbanist {
  font-family: 'Urbanist', sans-serif;
  -webkit-font-smoothing: antialiased;
}

:deep(.text-sm h1) {
  font-size: 1.8em !important;
  line-height: 1.2;
  margin-bottom: 0.5em;
}
</style>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.memory-long-term.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
