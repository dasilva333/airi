<script setup lang="ts">
import { MarkdownRenderer } from '@proj-airi/stage-ui/components'
import { useAiriCardStore, useTextJournalStore } from '@proj-airi/stage-ui/stores'
import { Button, FieldInput, FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

interface CharacterOption {
  value: string
  label: string
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const cardStore = useAiriCardStore()
const textJournalStore = useTextJournalStore()

const { cards, activeCardId } = storeToRefs(cardStore)
const { entries, loading } = storeToRefs(textJournalStore)

const selectedCharacter = ref('all')
const searchTerm = ref('')
const isSearching = ref(false)
const semanticResults = ref<(any & { kind?: string })[]>([])

const characterOptions = computed<CharacterOption[]>(() => {
  const options = Array.from(cards.value.entries()).map(([id, card]) => ({
    label: card.nickname?.trim() ? `${card.name} (${card.nickname.trim()})` : card.name,
    value: id,
  }))

  return [{ label: 'All Characters', value: 'all' }, ...options]
})

// Legacy keyword filter as a fallback
const keywordFilteredEntries = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()

  return entries.value.filter((entry) => {
    const matchesCharacter = selectedCharacter.value === 'all' || entry.characterId === selectedCharacter.value
    const matchesTerm =
      !term ||
      entry.title.toLowerCase().includes(term) ||
      entry.content.toLowerCase().includes(term) ||
      entry.characterName.toLowerCase().includes(term)

    return matchesCharacter && matchesTerm
  })
})

const visibleEntries = computed(() => {
  const term = searchTerm.value.trim()
  if (!term) return keywordFilteredEntries.value

  // If we have semantic results, use them (already character-filtered in the search logic or post-filtered)
  if (semanticResults.value.length > 0) {
    return semanticResults.value.filter(
      (res) => selectedCharacter.value === 'all' || res.characterId === selectedCharacter.value,
    )
  }

  // Fallback to keyword search if semantic came up empty
  return keywordFilteredEntries.value
})

let searchTimeout: any = null
watch(searchTerm, (term) => {
  if (searchTimeout) clearTimeout(searchTimeout)

  const trimmed = term.trim()
  if (!trimmed) {
    semanticResults.value = []
    return
  }

  searchTimeout = setTimeout(async () => {
    isSearching.value = true
    try {
      const results = await textJournalStore.searchEntries({
        limit: 20,
        query: trimmed,
      })
      semanticResults.value = results
    } catch (err) {
      console.error('LTMM: Semantic search failed, falling back to keywords:', err)
      semanticResults.value = []
    } finally {
      isSearching.value = false
    }
  }, 300)
})

async function seedEntry() {
  try {
    const entry = await textJournalStore.seedActiveCharacterEntry()
    toast.success(`Seeded journal entry for ${entry.characterName}.`)
    if (selectedCharacter.value === 'all' && activeCardId.value) selectedCharacter.value = activeCardId.value
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast.error(`Failed to seed journal entry: ${message}`)
  }
}

onMounted(async () => {
  cardStore.initialize()
  await textJournalStore.load()

  if (activeCardId.value && selectedCharacter.value === 'all') selectedCharacter.value = activeCardId.value
})

watch(
  characterOptions,
  (options) => {
    if (!options.some((option) => option.value === selectedCharacter.value))
      selectedCharacter.value = activeCardId.value || 'all'
  },
  { immediate: true },
)
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

    <!-- The Sacred Records Feed -->
    <div class="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
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

        <div v-if="loading || isSearching" class="border-2 border-neutral-200 rounded-[2.5rem] border-dashed bg-neutral-50/50 p-12 text-center text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950/40">
          <div class="i-solar:loading-bold mx-auto mb-4 animate-spin text-4xl" />
          {{ isSearching ? 'Probing memory layers...' : 'Opening the vault...' }}
        </div>

        <div v-else-if="visibleEntries.length === 0" class="font-urbanist border-2 border-neutral-200 rounded-[2.5rem] border-dashed bg-neutral-50/50 p-12 text-center text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950/40">
          The records are silent. Use the <span class="text-emerald-600 font-bold dark:text-emerald-400">txt_journal</span> tool in chat to create a durable memory.
        </div>

        <div v-else class="flex flex-col gap-6">
          <article
            v-for="entry in visibleEntries"
            :key="entry.id"
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
              <div class="text-[10px] text-neutral-400 font-bold tracking-widest uppercase">
                {{ formatTimestamp(entry.createdAt) }}
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
