<script setup lang="ts">
import { useEntityLedgerStore } from '@proj-airi/stage-ui/stores/entity-ledger'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

const emit = defineEmits<{
  (e: 'synthesize'): void
}>()

const entityLedgerStore = useEntityLedgerStore()
const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const showPermissionModal = ref(false)

const characterName = computed(() => activeCard.value?.name || 'Character')
const cognitionConfig = computed(() => {
  const airiExt = activeCard.value?.extensions?.airi as Record<string, any> | undefined
  return airiExt?.modules?.cognition ?? airiExt?.cognition
})
const isGroundingActive = computed(() => Boolean(cognitionConfig.value?.searchEngine?.universeRagEnabled ?? true))

function handleSynthesizeClick() {
  if (!isGroundingActive.value) {
    showPermissionModal.value = true
  }
  else {
    emit('synthesize')
  }
}

async function handleConfirmEnableAndSynthesize() {
  showPermissionModal.value = false
  if (activeCardId.value) {
    await airiCardStore.toggleGrounding(activeCardId.value)
    if (!cognitionConfig.value?.searchEngine?.universeRagEnabled) {
      // Ensure memory grounding is also enabled
      await airiCardStore.toggleGroundingMemory(activeCardId.value)
    }
  }
  emit('synthesize')
}
</script>

<template>
  <div class="relative h-full flex flex-col items-center justify-center overflow-hidden bg-neutral-950/20 p-8 text-center">
    <!-- Ambient Pulsing Constellation Watermark -->
    <div class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
      <div class="relative h-96 w-96">
        <div class="animate-spin-slow absolute inset-0 border border-primary-500/30 rounded-full border-dashed" />
        <div class="absolute inset-8 border border-neutral-700/40 rounded-full" />
        <div class="animate-spin-reverse absolute inset-20 border border-teal-500/30 rounded-full border-dashed" />
        <div class="absolute left-1/2 top-1/2 h-48 w-48 animate-pulse rounded-full bg-primary-500/10 blur-2xl -translate-x-1/2 -translate-y-1/2" />
      </div>
    </div>

    <!-- Center Content Card -->
    <div class="relative z-10 max-w-md flex flex-col items-center gap-5">
      <div class="h-20 w-20 flex items-center justify-center rounded-3xl bg-primary-500/10 text-4xl text-primary-400 shadow-inner ring-1 ring-primary-500/20">
        <div class="i-solar:share-circle-bold-duotone animate-pulse" />
      </div>

      <div class="space-y-2">
        <h2 class="text-xl text-neutral-800 font-bold dark:text-neutral-100">
          {{ characterName }}'s Mind Map is Unprimed
        </h2>
        <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
          The Knowledge Graph hasn't been synthesized for this character yet. Once primed, dialogue turns and journal entries will blossom into an interactive constellation of concepts, relationships, and memories.
        </p>
      </div>

      <!-- Telemetry Preview -->
      <div class="backdrop-blur-xs w-full flex items-center justify-around border border-neutral-200/80 rounded-2xl bg-white/60 p-3.5 text-xs text-neutral-600 dark:border-neutral-800/80 dark:bg-neutral-900/60 dark:text-neutral-300">
        <div class="flex flex-col items-center">
          <span class="text-[10px] text-neutral-400 font-bold uppercase">Available Turns</span>
          <span class="text-base text-primary-500 font-bold font-mono">
            {{ entityLedgerStore.telemetry.deduplicatedTurnsIngested || 'Ready' }}
          </span>
        </div>
        <div class="h-6 w-px bg-neutral-200 dark:bg-neutral-800" />
        <div class="flex flex-col items-center">
          <span class="text-[10px] text-neutral-400 font-bold uppercase">Sacred Journals</span>
          <span class="text-base text-teal-500 font-bold font-mono">
            {{ entityLedgerStore.telemetry.journalEntriesIngested || '0' }}
          </span>
        </div>
        <div class="h-6 w-px bg-neutral-200 dark:bg-neutral-800" />
        <div class="flex flex-col items-center">
          <span class="text-[10px] text-neutral-400 font-bold uppercase">RAG Status</span>
          <span
            class="text-xs font-semibold"
            :class="isGroundingActive ? 'text-emerald-500' : 'text-amber-500'"
          >
            {{ isGroundingActive ? 'Active' : 'Standby' }}
          </span>
        </div>
      </div>

      <!-- Primary Action -->
      <Button
        label="Synthesize Knowledge Graph"
        icon="i-solar:bolt-bold-duotone"
        variant="primary"
        size="lg"
        :disabled="entityLedgerStore.isPriming"
        @click="handleSynthesizeClick"
      />
    </div>

    <!-- Self-Healing Permission Guard Modal -->
    <Transition name="fade">
      <div
        v-if="showPermissionModal"
        class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      >
        <div class="max-w-md w-full border border-neutral-200 rounded-3xl bg-white p-6 text-left shadow-2xl space-y-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 flex items-center justify-center rounded-2xl bg-amber-500/10 text-xl text-amber-500">
              <div class="i-solar:shield-check-bold-duotone" />
            </div>
            <div>
              <h3 class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
                Enable In-Flight Grounding?
              </h3>
              <p class="text-xs text-neutral-500">
                Cognition activation required
              </p>
            </div>
          </div>

          <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
            To build and maintain <strong>{{ characterName }}'s</strong> Mind Map and ground ongoing conversational turns with these memories, we need to activate <strong>Universe RAG++ Grounding</strong> on this character card.
          </p>

          <div class="border border-neutral-200/60 rounded-2xl bg-neutral-100 p-3 text-xs space-y-2 dark:border-neutral-800/60 dark:bg-neutral-950/60">
            <div class="flex items-center gap-2 text-emerald-500">
              <div class="i-solar:check-circle-bold" />
              <span>Enable In-Flight Memory Grounding (Universe RAG++)</span>
            </div>
            <div class="flex items-center gap-2 text-emerald-500">
              <div class="i-solar:check-circle-bold" />
              <span>Extract entity mentions & claim relationships</span>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <Button
              label="Cancel"
              variant="secondary"
              size="sm"
              @click="showPermissionModal = false"
            />
            <Button
              label="Enable & Synthesize"
              icon="i-solar:bolt-bold-duotone"
              variant="primary"
              size="sm"
              @click="handleConfirmEnableAndSynthesize"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes spin-reverse {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

.animate-spin-slow {
  animation: spin-slow 40s linear infinite;
}
.animate-spin-reverse {
  animation: spin-reverse 35s linear infinite;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
