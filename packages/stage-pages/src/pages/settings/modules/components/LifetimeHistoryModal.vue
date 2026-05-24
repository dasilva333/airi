<script setup lang="ts">
import { useMemoryLifetimeStore } from '@proj-airi/stage-ui/stores/memory-lifetime'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

const props = defineProps<{
  open: boolean
  characterId: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const lifetimeStore = useMemoryLifetimeStore()
const { artifacts, isProvisioning, progress } = storeToRefs(lifetimeStore)

const artifact = computed(() => artifacts.value.get(props.characterId))
const chunks = computed(() => artifact.value?.chunkSummaries || [])

const selectedChunkIndex = ref(0)

function getChunkPreview(chunk: any) {
  if (typeof chunk === 'string')
    return chunk.slice(0, 50)
  if (typeof chunk === 'object' && chunk !== null) {
    // Try standard categories first
    const fact = (chunk.durable_facts || chunk.facts || chunk.relationship_core || [])[0]
    if (fact)
      return fact

    // Fallback to first available property
    const keys = Object.keys(chunk)
    if (keys.length > 0) {
      const firstVal = chunk[keys[0]]
      return Array.isArray(firstVal) ? (firstVal[0] || 'Empty category') : String(firstVal).slice(0, 50)
    }
  }
  return 'Relational foundation'
}

function close() {
  emit('update:open', false)
}

async function handleResynthesize() {
  if (confirm('This will skip the history collection phase and re-run the synthesis and distillation based on these chunks. Proceed?')) {
    await lifetimeStore.reprovisionFromChunks(props.characterId, 2, artifact.value?.metadata?.targetTokens) // Default 2s interval
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
    <div class="relative h-[85vh] max-w-6xl w-full flex flex-col overflow-hidden border border-neutral-200 rounded-[2.5rem] bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
      <!-- Aura Glow -->
      <div class="absolute h-96 w-96 bg-amber-500/5 blur-3xl -right-24 -top-24" />

      <header class="relative z-10 flex items-center justify-between border-b border-neutral-100 p-8 dark:border-neutral-800">
        <div class="flex items-center gap-4">
          <div class="h-12 w-12 flex items-center justify-center rounded-2xl bg-amber-500/10 text-2xl text-amber-500">
            <div class="i-solar:history-bold-duotone" />
          </div>
          <div>
            <h3 class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">
              Chunk Foundation History
            </h3>
            <p class="text-sm text-neutral-500 italic dark:text-neutral-400">
              The {{ chunks.length }} architectural blocks used to synthesize the Eternal Thread.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <Button
            v-if="!isProvisioning"
            label="Re-synthesize Soul Blueprint"
            variant="primary"
            icon="i-solar:magic-stick-bold-duotone"
            @click="handleResynthesize"
          />
          <div v-else class="flex flex-col items-end gap-1">
            <span class="animate-pulse text-xs text-amber-500 font-bold uppercase">{{ progress.phase }}...</span>
            <div class="h-1.5 w-48 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                class="h-full bg-amber-500 transition-all duration-300"
                :style="{ width: `${(progress.completedCalls / progress.totalCalls) * 100}%` }"
              />
            </div>
          </div>
          <Button icon="i-solar:close-circle-bold-duotone" variant="secondary-muted" @click="close" />
        </div>
      </header>

      <div class="relative z-10 flex flex-1 overflow-hidden">
        <!-- Sidebar Navigation -->
        <aside class="w-72 overflow-y-auto border-r border-neutral-100 p-4 dark:border-neutral-800">
          <div class="flex flex-col gap-2">
            <button
              v-for="(chunk, idx) in chunks"
              :key="idx"
              :class="[
                'flex items-center gap-3 p-4 rounded-2xl text-left transition-all',
                selectedChunkIndex === idx
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900 border border-transparent',
              ]"
              @click="selectedChunkIndex = idx"
            >
              <div :class="['h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs', selectedChunkIndex === idx ? 'bg-amber-500 text-white' : 'bg-neutral-100 dark:bg-neutral-800']">
                {{ String(idx + 1).padStart(2, '0') }}
              </div>
              <div class="flex flex-col overflow-hidden">
                <span class="truncate text-xs font-bold tracking-tight uppercase">Chunk {{ idx + 1 }}</span>
                <span class="truncate text-[10px] opacity-70">{{ getChunkPreview(chunk) }}</span>
              </div>
            </button>
          </div>
        </aside>

        <!-- Content Area -->
        <main class="flex-1 overflow-y-auto bg-neutral-50/30 p-12 dark:bg-black/10">
          <div v-if="chunks.length === 0" class="h-full flex flex-col items-center justify-center text-center">
            <div class="mb-6 h-24 w-24 flex items-center justify-center rounded-full bg-red-500/10 text-5xl text-red-500">
              <div class="i-solar:database-line-duotone" />
            </div>
            <h4 class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">
              Foundation Data Missing
            </h4>
            <p class="mt-2 max-w-md text-neutral-500 dark:text-neutral-400">
              The aggregate stats confirm chunks were processed, but the architectural metadata was not captured in the final artifact save.
            </p>
            <div class="mt-8 border border-red-500/20 rounded-2xl bg-red-500/5 p-6 text-left text-xs text-red-600 font-mono dark:text-red-400">
              // NOTICE: Protocol Drift Detected<br>
              // The session snapshots from this multi-hour run were likely purged before the final artifact Commit.<br>
              // Manual Re-synthesis foundation is UNRECOVERABLE for this version.
            </div>
          </div>

          <div v-else-if="chunks[selectedChunkIndex]" class="max-w-3xl flex flex-col gap-10">
            <!-- Header -->
            <div class="flex flex-col gap-2 border-l-4 border-amber-500 pl-6">
              <h4 class="text-3xl text-neutral-800 font-bold dark:text-neutral-100">
                Foundational Fact Set #{{ selectedChunkIndex + 1 }}
              </h4>
              <p class="text-neutral-500 italic dark:text-neutral-400">
                Extracted from compressed sources during Phase 2.
              </p>
            </div>

            <!-- Resilient Categories Loop -->
            <div class="grid gap-8">
              <template v-if="typeof chunks[selectedChunkIndex] === 'object' && chunks[selectedChunkIndex] !== null">
                <section v-for="(items, key) in chunks[selectedChunkIndex]" :key="key" class="flex flex-col gap-3">
                  <div class="flex items-center gap-2">
                    <div class="h-2 w-2 rounded-full bg-amber-500" />
                    <span class="text-xs text-neutral-400 font-bold tracking-widest uppercase">{{ String(key).replace(/_/g, ' ') }}</span>
                  </div>
                  <div class="grid gap-3">
                    <template v-if="Array.isArray(items)">
                      <div
                        v-for="(item, i) in items"
                        :key="i"
                        class="border border-neutral-100 rounded-2xl bg-white p-4 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                      >
                        {{ item }}
                      </div>
                    </template>
                    <template v-else>
                      <div class="border border-neutral-100 rounded-2xl bg-white p-4 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                        {{ items }}
                      </div>
                    </template>
                  </div>
                </section>
              </template>
              <template v-else>
                <div class="border border-neutral-100 rounded-3xl bg-white p-8 text-sm text-neutral-600 leading-relaxed font-mono shadow-inner dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                  {{ chunks[selectedChunkIndex] }}
                </div>
              </template>
            </div>
          </div>
        </main>
      </div>

      <footer class="border-t border-neutral-100 p-6 text-center text-[10px] text-neutral-500 tracking-widest font-mono uppercase dark:border-neutral-800">
        [[ CACHED_ARCHITECTURAL_DATA_RESTRICTED_ACCESS ]]
      </footer>
    </div>
  </div>
</template>
