<script setup lang="ts">
import { MarkdownRenderer } from '@proj-airi/stage-ui/components'
import { useAiriCardStore, useEchoesStore, useShortTermMemoryStore } from '@proj-airi/stage-ui/stores'
import { Button, FieldInput, FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

interface CharacterOption { value: string, label: string }

const cardStore = useAiriCardStore()
const shortTermMemory = useShortTermMemoryStore()
const echoesStore = useEchoesStore()

const { cards } = storeToRefs(cardStore)
const { activeCardId, loading, rebuilding, rebuildProgress } = storeToRefs(shortTermMemory)
const { chips: allChips, loading: echoesLoading } = storeToRefs(echoesStore)

const selectedCharacter = ref('')
const windowSize = ref(3)
const tokensPerDay = ref(1000)

// --- Helper: Clean Summary Fences ---
function cleanSummary(text: string) {
  if (!text)
    return ''
  return text.replace(/^```markdown\n|```$/g, '').trim()
}

const characterOptions = computed<CharacterOption[]>(() => {
  return Array.from(cards.value.entries()).map(([id, card]) => ({
    value: id,
    label: card.nickname?.trim() ? `${card.name} (${card.nickname.trim()})` : card.name,
  }))
})

const visibleBlocks = computed(() => {
  return selectedCharacter.value
    ? shortTermMemory.getCharacterBlocks(selectedCharacter.value)
    : []
})

const selectedCharacterLabel = computed(() => {
  return characterOptions.value.find(option => option.value === selectedCharacter.value)?.label ?? 'Unknown Character'
})

function getChipsForDate(date: string) {
  return allChips.value.filter(c => c.characterId === selectedCharacter.value && c.date === date)
}

async function rebuildFromHistory() {
  if (!selectedCharacter.value)
    return

  const id = toast.loading('Rebuilding short-term memory...')
  try {
    const result = await shortTermMemory.rebuildFromHistory(selectedCharacter.value, {
      tokenBudgetPerDay: tokensPerDay.value,
    })

    toast.success(`Short-term rebuild complete. Created ${result.created}, updated ${result.updated}, skipped ${result.skipped}.`, { id })
  }
  catch (rebuildError) {
    const message = rebuildError instanceof Error ? rebuildError.message : String(rebuildError)
    toast.error(`Short-term rebuild failed: ${message}`, { id })
  }
}

async function rebuildToday() {
  if (!selectedCharacter.value)
    return

  const id = toast.loading('Rebuilding today\'s summary...')
  try {
    const success = await shortTermMemory.rebuildToday(selectedCharacter.value, {
      tokenBudgetPerDay: tokensPerDay.value,
    })

    if (success) {
      toast.success(`Short-term block for today has been successfully rebuilt.`, { id })
    }
  }
  catch (rebuildError) {
    const message = rebuildError instanceof Error ? rebuildError.message : String(rebuildError)
    toast.error(`Today's rebuild failed: ${message}`, { id })
  }
}

async function synthesizeEchoes() {
  if (!selectedCharacter.value)
    return

  const id = toast.loading('Synthesizing echo chips...')
  try {
    const newChips = await echoesStore.synthesizeForCharacter(selectedCharacter.value)
    toast.success(`Generated ${newChips.length} new echo chips.`, { id })
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    toast.error(`Echo synthesis failed: ${message}`, { id })
  }
}

onMounted(async () => {
  cardStore.initialize()
  await shortTermMemory.load()
  await echoesStore.load()

  if (!selectedCharacter.value) {
    selectedCharacter.value = activeCardId.value || characterOptions.value[0]?.value || ''
  }
})

watch(characterOptions, (options) => {
  if (!selectedCharacter.value || !options.some(option => option.value === selectedCharacter.value)) {
    selectedCharacter.value = activeCardId.value || options[0]?.value || ''
  }
}, { immediate: true })

watch(selectedCharacter, (newVal) => {
  if (newVal) {
    const card = cards.value.get(newVal)
    if (card) {
      windowSize.value = card.extensions?.airi?.shortTermMemory?.windowSize ?? 3
      tokensPerDay.value = card.extensions?.airi?.shortTermMemory?.tokenBudgetPerDay ?? 1000
    }
  }
}, { immediate: true })

watch([windowSize, tokensPerDay], ([newWindowSize, newTokensPerDay]) => {
  if (!selectedCharacter.value)
    return
  const card = cards.value.get(selectedCharacter.value)
  if (card) {
    const currentWindowSize = card.extensions?.airi?.shortTermMemory?.windowSize ?? 3
    const currentTokensPerDay = card.extensions?.airi?.shortTermMemory?.tokenBudgetPerDay ?? 1000
    if (Number(newWindowSize) !== currentWindowSize || Number(newTokensPerDay) !== currentTokensPerDay) {
      cardStore.updateCard(selectedCharacter.value, {
        extensions: {
          ...card.extensions,
          airi: {
            ...card.extensions?.airi,
            shortTermMemory: {
              windowSize: Number(newWindowSize),
              tokenBudgetPerDay: Number(newTokensPerDay),
            },
          },
        },
      } as any)
    }
  }
})
</script>

<template>
  <div class="font-urbanist flex flex-col gap-8 pb-12">
    <!-- Premium Header -->
    <header class="relative overflow-hidden border border-neutral-200 rounded-3xl bg-neutral-100/40 p-8 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="absolute h-64 w-64 bg-cyan-500/10 blur-3xl -right-24 -top-24" />
      <div class="absolute h-64 w-64 bg-blue-500/10 blur-3xl -bottom-24 -left-24" />

      <div class="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="flex flex-col gap-2">
          <div class="h-12 w-12 flex items-center justify-center rounded-2xl bg-cyan-500/20 text-3xl text-cyan-500 shadow-inner">
            <div class="i-solar:pulse-bold-duotone" />
          </div>
          <h1 class="text-4xl text-neutral-800 font-bold tracking-tight dark:text-neutral-100">
            Active Pulse
          </h1>
          <p class="max-w-2xl text-lg text-neutral-500 line-height-relaxed dark:text-neutral-400">
            Daily summary blocks derived from your history. These keep recent continuity fresh without dragging entire logs into every session.
          </p>
        </div>
      </div>

      <!-- Tripartite Header Cards -->
      <div class="grid mt-8 gap-4 md:grid-cols-3">
        <!-- 1. The Operational Window -->
        <div class="group border border-neutral-200 rounded-2xl bg-white/50 p-5 shadow-sm transition-all dark:border-neutral-700/50 hover:border-cyan-500/30 dark:bg-neutral-800/40">
          <div class="mb-3 h-8 w-8 flex items-center justify-center rounded-lg bg-cyan-500/10 text-lg text-cyan-500 transition-transform group-hover:scale-110">
            <div class="i-solar:history-bold-duotone" />
          </div>
          <h3 class="mb-1 text-sm text-neutral-700 font-bold dark:text-neutral-200">
            The Context Window
          </h3>
          <p class="mb-4 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            Automatically preloads recent continuity into the active prompt.
          </p>
          <ul class="flex flex-col gap-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-700/50">
            <li v-for="s in ['Daily Summary Blocks', 'Cross-Session Continuity', 'History Distillation']" :key="s" class="flex items-center gap-2 text-[10px] text-neutral-500 font-bold tracking-widest uppercase dark:text-neutral-400">
              <div class="i-solar:check-circle-bold-duotone text-cyan-500" />
              {{ s }}
            </li>
          </ul>
        </div>

        <!-- 2. Dream Handoff -->
        <div class="group border border-neutral-200 rounded-2xl bg-white/50 p-5 shadow-sm transition-all dark:border-neutral-700/50 hover:border-violet-500/30 dark:bg-neutral-800/40">
          <div class="mb-3 h-8 w-8 flex items-center justify-center rounded-lg bg-violet-500/10 text-lg text-violet-500 transition-transform group-hover:scale-110">
            <div class="i-solar:stars-bold-duotone" />
          </div>
          <h3 class="mb-1 text-sm text-neutral-700 font-bold dark:text-neutral-200">
            Dream Output
          </h3>
          <p class="mb-4 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            Captures flavor tags and mood highlights generated during the Dream State.
          </p>
          <ul class="flex flex-col gap-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-700/50">
            <li v-for="s in ['Integrated Chips', 'Journal Candidates', '24H Handoff Cycle']" :key="s" class="flex items-center gap-2 text-[10px] text-neutral-500 font-bold tracking-widest uppercase dark:text-neutral-400">
              <div class="i-solar:check-circle-bold-duotone text-violet-500" />
              {{ s }}
            </li>
          </ul>
        </div>

        <!-- 3. Current State -->
        <div class="group border border-neutral-200 rounded-2xl bg-white/50 p-5 shadow-sm transition-all dark:border-neutral-700/50 hover:border-emerald-500/30 dark:bg-neutral-800/40">
          <div class="mb-3 h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-lg text-emerald-500 transition-transform group-hover:scale-110">
            <div class="i-solar:shield-check-bold-duotone" />
          </div>
          <h3 class="mb-1 text-sm text-neutral-700 font-bold dark:text-neutral-200">
            Current Status
          </h3>
          <p class="mb-4 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            Rebuild from history is live. Periodic post-midnight generation is active.
          </p>
          <ul class="flex flex-col gap-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-700/50">
            <li v-for="s in ['History Rebuild Live', 'ID Bleed Protection', 'Per-Character Scope']" :key="s" class="flex items-center gap-2 text-[10px] text-neutral-500 font-bold tracking-widest uppercase dark:text-neutral-400">
              <div class="i-solar:check-circle-bold-duotone text-emerald-500" />
              {{ s }}
            </li>
          </ul>
        </div>
      </div>
    </header>

    <!-- Controls Console -->
    <section class="border border-neutral-200 rounded-[2.5rem] bg-white p-8 shadow-inner shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      <div class="grid gap-6 xl:grid-cols-[1.3fr_1fr_auto]">
        <FieldSelect
          v-model="selectedCharacter"
          label="Active Character"
          description="Context pulse is always scoped to the selected character."
          :options="characterOptions"
        />
        <FieldInput
          v-model="windowSize"
          label="Window Size"
          description="How many daily blocks are kept ready for prompt injection."
          type="number"
        />
        <FieldInput
          v-model="tokensPerDay"
          label="Token Budget Per Day"
          description="Target size hint for daily summarization."
          type="number"
        />
      </div>

      <div class="mt-8 flex flex-wrap items-center gap-4">
        <Button
          label="Rebuild From History"
          icon="i-solar:restart-bold-duotone"
          variant="secondary"
          :disabled="!selectedCharacter || rebuilding"
          @click="rebuildFromHistory"
        />
        <Button
          label="Rebuild Today"
          icon="i-solar:calendar-date-bold-duotone"
          variant="secondary"
          :disabled="!selectedCharacter || rebuilding"
          @click="rebuildToday"
        />

        <div class="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />

        <Button
          label="Synthesize Echoes"
          icon="i-solar:sparkles-bold-duotone"
          variant="secondary"
          :disabled="!selectedCharacter || echoesLoading"
          @click="synthesizeEchoes"
        />

        <div class="flex-1" />

        <div v-if="rebuilding" class="flex items-center gap-2 rounded-full bg-cyan-500/10 px-4 py-2 text-xs text-cyan-600 font-bold dark:text-cyan-400">
          <div class="i-solar:running-round-bold-duotone animate-bounce text-base" />
          {{ rebuildProgress || 'Rebuilding pulse...' }}
        </div>
        <div v-else-if="echoesLoading" class="flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-2 text-xs text-violet-600 font-bold dark:text-violet-400">
          <div class="i-solar:ghost-bold-duotone animate-pulse text-base" />
          Synthesizing interpretation...
        </div>
        <div v-else class="flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-xs text-neutral-500 font-bold dark:bg-neutral-800 dark:text-neutral-400">
          <div class="i-solar:watch-square-bold-duotone text-base" />
          Auto-generation pending cycle
        </div>
      </div>
    </section>

    <!-- The Feed: Summaries + Integrated Chips -->
    <div class="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <section class="flex flex-col gap-6">
        <div class="flex items-center justify-between px-2">
          <div>
            <h3 class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">
              Daily Summary Blocks
            </h3>
            <p class="text-sm text-neutral-500 italic dark:text-neutral-400">
              Reverse-chronological summaries for <span class="text-neutral-700 font-bold dark:text-neutral-200">{{ selectedCharacterLabel }}</span>.
            </p>
          </div>
          <div class="border border-neutral-200 rounded-full bg-white px-4 py-1.5 text-xs text-neutral-600 font-bold shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {{ visibleBlocks.length }} stored blocks
          </div>
        </div>

        <div v-if="loading" class="border-2 border-neutral-200 rounded-[2.5rem] border-dashed bg-neutral-50/50 p-12 text-center text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950/40">
          <div class="i-solar:loading-bold mx-auto mb-4 animate-spin text-4xl" />
          Distilling short-term memory...
        </div>

        <div v-else-if="visibleBlocks.length === 0" class="font-urbanist border-2 border-neutral-200 rounded-[2.5rem] border-dashed bg-neutral-50/50 p-12 text-center text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950/40">
          No memory blocks exist. Run <span class="text-neutral-600 font-bold dark:text-neutral-300">Rebuild From History</span> to begin.
        </div>

        <div v-else class="flex flex-col gap-8">
          <!-- Interleaved Feed Loop -->
          <div v-for="block in visibleBlocks" :key="block.id" class="flex flex-col gap-6">
            <!-- Daily Block Card -->
            <article class="group relative overflow-hidden border border-neutral-200 rounded-[2rem] bg-white p-6 shadow-sm transition-all dark:border-neutral-800 hover:border-cyan-500/30 dark:bg-neutral-900/60">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="rounded-xl bg-cyan-500/10 px-4 py-1.5 text-xs text-cyan-600 font-bold dark:text-cyan-400">
                    {{ block.date }}
                  </div>
                  <div :class="['rounded-xl px-4 py-1.5 text-xs font-bold shadow-inner', block.source === 'automatic' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs italic opacity-80']">
                    {{ block.source === 'automatic' ? '24H Generated' : 'Manual Rebuild' }}
                  </div>
                </div>
                <div class="text-[10px] text-neutral-400 font-bold tracking-widest uppercase">
                  ~{{ block.estimatedTokens }} tokens | {{ block.messageCount }} msgs
                </div>
              </div>

              <div class="relative overflow-hidden border border-neutral-100 rounded-2xl bg-neutral-50/50 p-5 dark:border-neutral-800 dark:bg-black/20">
                <MarkdownRenderer
                  :content="cleanSummary(block.summary)"
                  class="text-sm text-neutral-700 leading-relaxed dark:text-neutral-300"
                />
              </div>
            </article>

            <!-- CHIP CLUSTER: Injected conditionally if chips exist for this date -->
            <div v-if="getChipsForDate(block.date).length > 0" class="relative px-6">
              <div class="absolute inset-y-0 left-0 w-px from-transparent via-neutral-200 to-transparent bg-gradient-to-b dark:via-neutral-800" />
              <div class="mb-2 flex items-center gap-2 text-[10px] text-neutral-400 font-bold tracking-widest uppercase">
                <div class="i-solar:sparkles-bold-duotone text-violet-500" />
                Dream Output
              </div>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="chip in getChipsForDate(block.date)"
                  :key="chip.id"
                  :class="[
                    'flex items-center gap-2 border rounded-full px-4 py-1.5 text-xs font-bold shadow-sm transition-transform hover:scale-105',
                    chip.type === 'mood' ? 'border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-400'
                    : chip.type === 'flavor' ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-400',
                  ]"
                >
                  <div :class="[chip.type === 'mood' ? 'i-solar:ghost-bold-duotone' : chip.type === 'flavor' ? 'i-solar:magic-stick-bold-duotone' : 'i-solar:bookmark-opened-bold-duotone', 'text-base']" />
                  <div v-if="chip.relevanceScore < 0.7" class="h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" title="Low relevance" />
                  {{ chip.content }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Sidebar: Handoff Preview -->
      <section class="flex flex-col gap-6">
        <div class="sticky top-6">
          <div class="border border-neutral-200 rounded-[2.5rem] bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
            <h3 class="font-urbanist mb-4 text-xl text-neutral-800 font-bold dark:text-neutral-100">
              Dream Output & Handoff
            </h3>

            <div class="flex flex-col gap-6">
              <div class="border border-neutral-100 rounded-2xl bg-neutral-50/70 p-5 dark:border-neutral-800 dark:bg-neutral-950/40">
                <span class="mb-2 block text-[10px] text-neutral-500 font-bold tracking-widest uppercase">Context Strategy</span>
                <p class="text-sm text-neutral-700 leading-relaxed dark:text-neutral-200">
                  The latest <span class="text-cyan-500 font-bold">{{ windowSize }}</span> daily blocks are automatically compacted and injected as hidden session context.
                </p>
              </div>

              <div class="font-urbanist border border-neutral-100 rounded-2xl bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
                <span class="mb-3 block text-[10px] text-neutral-500 font-bold tracking-widest uppercase">Neurological Lifecycle</span>
                <ul class="flex flex-col gap-4">
                  <li class="flex gap-4">
                    <div class="h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
                      <div class="i-solar:transfer-horizontal-bold-duotone" />
                    </div>
                    <div class="flex flex-col">
                      <span class="text-sm text-neutral-700 font-bold dark:text-neutral-200">24H Memory Handoff</span>
                      <span class="text-xs text-neutral-500 dark:text-neutral-400">Summaries are generated daily at midnight from history logs.</span>
                    </div>
                  </li>
                  <li class="flex gap-4">
                    <div class="h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                      <div class="i-solar:ghost-bold-duotone" />
                    </div>
                    <div class="flex flex-col">
                      <span class="text-sm text-neutral-700 font-bold dark:text-neutral-200">Dream State Synthesis</span>
                      <span class="text-xs text-neutral-500 dark:text-neutral-400">Inline Chips bridge the gap between context and permanent records.</span>
                    </div>
                  </li>
                  <li class="flex gap-4">
                    <div class="h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                      <div class="i-solar:bookmark-square-bold-duotone" />
                    </div>
                    <div class="flex flex-col">
                      <span class="text-sm text-neutral-700 font-bold dark:text-neutral-200">Journal Promotion</span>
                      <span class="text-xs text-neutral-500 dark:text-neutral-400">High-worthiness artifacts are flagged for the Sentinel's Journal.</span>
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
  titleKey: settings.pages.modules.memory-short-term.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>

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
  titleKey: settings.pages.modules.memory-short-term.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
