<script setup lang="ts">
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const isOpen = ref(false)
const popoverRef = ref<HTMLElement>()

onClickOutside(popoverRef, () => {
  if (isOpen.value) {
    isOpen.value = false
  }
})

// --- Context Injections ---
const isGroundingEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.groundingEnabled ?? false
})

const isGroundingMemoryEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.groundingMemoryEnabled ?? false
})

const isGroundingTopicsEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.groundingTopicsEnabled ?? false
})

const isGroundingDirectorScratchpadEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.groundingDirectorScratchpadEnabled ?? false
})

const isSalienceGateEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.salienceGateEnabled ?? false
})

// --- Intrusions ---
const isDreamStateEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.dreamState?.enabled ?? false
})

const isDreamIntrusionEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.dreamState?.injectDreamContext ?? false
})

const hasTextJournal = computed(() => {
  return !!activeCard.value?.extensions?.airi?.textJournal
})

const isJournalIntrusionEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.textJournal?.injectJournalContext ?? false
})

const hasImageJournal = computed(() => {
  return !!activeCard.value?.extensions?.airi?.artistry
})

const isArtistryIntrusionEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.artistry?.injectArtistryContext ?? false
})

// --- Modes ---
const isAutonomousArtistryEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.artistry?.autonomousEnabled ?? false
})

const currentSpawnMode = computed(() => {
  return activeCard.value?.extensions?.airi?.artistry?.spawnMode ?? 'bg'
})

const isHeartbeatsEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.heartbeats?.enabled ?? false
})

// --- Handlers ---
function handleToggleGrounding() {
  if (activeCardId.value) {
    airiCardStore.toggleGrounding(activeCardId.value)
  }
}

function handleToggleGroundingMemory() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isGroundingMemoryEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        groundingMemoryEnabled: !current,
      },
    },
  } as any)
}

function handleToggleGroundingTopics() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isGroundingTopicsEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        groundingTopicsEnabled: !current,
      },
    },
  } as any)
}

function handleToggleGroundingDirectorScratchpad() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isGroundingDirectorScratchpadEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        groundingDirectorScratchpadEnabled: !current,
      },
    },
  } as any)
}

function handleToggleSalienceGate() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isSalienceGateEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        salienceGateEnabled: !current,
      },
    },
  } as any)
}

function handleToggleDreamIntrusion() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isDreamIntrusionEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        dreamState: {
          ...activeCard.value.extensions?.airi?.dreamState,
          injectDreamContext: !current,
        },
      },
    },
  } as any)
}

function handleToggleJournalIntrusion() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isJournalIntrusionEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        textJournal: {
          ...activeCard.value.extensions?.airi?.textJournal,
          injectJournalContext: !current,
        },
      },
    },
  } as any)
}

function handleToggleArtistryIntrusion() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isArtistryIntrusionEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        artistry: {
          ...activeCard.value.extensions?.airi?.artistry,
          injectArtistryContext: !current,
        },
      },
    },
  } as any)
}

async function handleToggleArtistry() {
  if (activeCardId.value) {
    await airiCardStore.setAutonomousArtistry(activeCardId.value, !isAutonomousArtistryEnabled.value)
  }
}

function handleSetSpawnMode(mode: 'bg' | 'widget' | 'inline') {
  if (!activeCardId.value || !activeCard.value)
    return
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        artistry: {
          ...activeCard.value.extensions?.airi?.artistry,
          spawnMode: mode,
        },
      },
    },
  } as any)
}

function handleToggleHeartbeats() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isHeartbeatsEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        heartbeats: {
          ...activeCard.value.extensions?.airi?.heartbeats,
          enabled: !current,
        },
      },
    },
  } as any)
}
</script>

<template>
  <div ref="popoverRef" class="relative">
    <!-- Trigger Button -->
    <button
      :class="[
        'size-8.5 flex items-center justify-center border rounded-full text-neutral-700 shadow-sm backdrop-blur-md transition-all active:scale-95 cursor-pointer',
        'border-neutral-200/30 bg-white/10 dark:border-neutral-700/40 dark:bg-neutral-800/60 dark:text-neutral-200',
        isOpen ? 'ring-2 ring-primary-500/30' : '',
      ]"
      type="button"
      title="Runtime Controls & Context Injections"
      @click.stop="isOpen = !isOpen"
    >
      <div class="i-solar:bolt-bold-duotone size-4.5 text-amber-500/90 dark:text-amber-400" />
    </button>

    <!-- Popover Panel -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="-translate-y-1 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="-translate-y-1 opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 top-full z-[9999] mt-2 max-h-[85dvh] max-w-[calc(100vw-24px)] w-72 flex flex-col origin-top-right overflow-y-auto border border-neutral-200/60 rounded-2xl bg-white/95 p-3 shadow-2xl backdrop-blur-2xl scrollbar-none dark:border-neutral-800/80 dark:bg-neutral-950/95"
      >
        <!-- Header -->
        <div class="mb-2 flex items-center justify-between border-b border-neutral-200/40 pb-2 dark:border-neutral-800/40">
          <div class="flex items-center gap-1.5 text-xs text-neutral-800 font-bold tracking-wider font-sans uppercase dark:text-neutral-200">
            <div class="i-solar:tuning-square-2-bold-duotone text-primary-500" />
            <span>Context Injections</span>
          </div>
          <span class="rounded-md bg-primary-500/10 px-1.5 py-0.5 text-[9px] text-primary-600 font-semibold font-sans dark:text-primary-400">
            Runtime
          </span>
        </div>

        <!-- Section: Context Injections -->
        <div class="flex flex-col gap-1">
          <label class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">
            Injections
          </label>

          <!-- Toggle: System Sensors -->
          <div
            class="flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80"
            @click="handleToggleGrounding"
          >
            <div class="flex items-center gap-2">
              <div
                class="size-6 flex items-center justify-center rounded-lg"
                :class="isGroundingEnabled ? 'bg-amber-500/10 text-amber-500' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'"
              >
                <div class="i-solar:cpu-bolt-bold-duotone size-3.5" />
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">System Sensors</span>
                <span class="text-[9px] text-neutral-400">Inject real-time OS telemetry</span>
              </div>
            </div>
            <div
              :class="[
                'h-4 w-7 rounded-full transition-colors relative shrink-0',
                isGroundingEnabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700',
              ]"
            >
              <div
                :class="[
                  'size-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
                  isGroundingEnabled ? 'translate-x-3' : '',
                ]"
              />
            </div>
          </div>

          <!-- Toggle: Universe Memory (RAG) -->
          <div
            class="flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80"
            @click="handleToggleGroundingMemory"
          >
            <div class="flex items-center gap-2">
              <div
                class="size-6 flex items-center justify-center rounded-lg"
                :class="isGroundingMemoryEnabled ? 'bg-amber-500/10 text-amber-500' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'"
              >
                <div class="i-solar:database-bold-duotone size-3.5" />
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Universe Memory (RAG)</span>
                <span class="text-[9px] text-neutral-400">Semantic long-term memory lookup</span>
              </div>
            </div>
            <div
              :class="[
                'h-4 w-7 rounded-full transition-colors relative shrink-0',
                isGroundingMemoryEnabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700',
              ]"
            >
              <div
                :class="[
                  'size-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
                  isGroundingMemoryEnabled ? 'translate-x-3' : '',
                ]"
              />
            </div>
          </div>

          <!-- Toggle: Recent Topics -->
          <div
            class="flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80"
            @click="handleToggleGroundingTopics"
          >
            <div class="flex items-center gap-2">
              <div
                class="size-6 flex items-center justify-center rounded-lg"
                :class="isGroundingTopicsEnabled ? 'bg-amber-500/10 text-amber-500' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'"
              >
                <div class="i-solar:hashtag-bold-duotone size-3.5" />
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Recent Topics</span>
                <span class="text-[9px] text-neutral-400">Inject active trending context</span>
              </div>
            </div>
            <div
              :class="[
                'h-4 w-7 rounded-full transition-colors relative shrink-0',
                isGroundingTopicsEnabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700',
              ]"
            >
              <div
                :class="[
                  'size-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
                  isGroundingTopicsEnabled ? 'translate-x-3' : '',
                ]"
              />
            </div>
          </div>

          <!-- Toggle: Visual Scene State -->
          <div
            class="flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80"
            @click="handleToggleGroundingDirectorScratchpad"
          >
            <div class="flex items-center gap-2">
              <div
                class="size-6 flex items-center justify-center rounded-lg"
                :class="isGroundingDirectorScratchpadEnabled ? 'bg-amber-500/10 text-amber-500' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'"
              >
                <div class="i-solar:gallery-bold-duotone size-3.5" />
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Visual Scene State</span>
                <span class="text-[9px] text-neutral-400">Attach Director's latest scratchpad</span>
              </div>
            </div>
            <div
              :class="[
                'h-4 w-7 rounded-full transition-colors relative shrink-0',
                isGroundingDirectorScratchpadEnabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700',
              ]"
            >
              <div
                :class="[
                  'size-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
                  isGroundingDirectorScratchpadEnabled ? 'translate-x-3' : '',
                ]"
              />
            </div>
          </div>

          <!-- Toggle: Salience Gating (RWKV) -->
          <div
            class="flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80"
            @click="handleToggleSalienceGate"
          >
            <div class="flex items-center gap-2">
              <div
                class="size-6 flex items-center justify-center rounded-lg"
                :class="isSalienceGateEnabled ? 'bg-amber-500/10 text-amber-500' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'"
              >
                <div class="i-solar:pulse-bold-duotone size-3.5" />
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Salience Gating (RWKV)</span>
                <span class="text-[9px] text-neutral-400">Flag high-intensity turns for grounding</span>
              </div>
            </div>
            <div
              :class="[
                'h-4 w-7 rounded-full transition-colors relative shrink-0',
                isSalienceGateEnabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700',
              ]"
            >
              <div
                :class="[
                  'size-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
                  isSalienceGateEnabled ? 'translate-x-3' : '',
                ]"
              />
            </div>
          </div>

          <!-- Divider -->
          <div class="my-1 border-t border-neutral-200/40 dark:border-neutral-800/40" />

          <!-- Toggle: Dream Intrusion -->
          <div
            class="flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80"
            :class="[!isDreamStateEnabled ? 'opacity-50 pointer-events-none' : '']"
            @click="handleToggleDreamIntrusion"
          >
            <div class="flex items-center gap-2">
              <div
                class="size-6 flex items-center justify-center rounded-lg"
                :class="isDreamIntrusionEnabled && isDreamStateEnabled ? 'bg-indigo-500/10 text-indigo-500' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'"
              >
                <div class="i-solar:sleeping-bold-duotone size-3.5" />
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Dream Intrusion</span>
                <span class="text-[9px] text-neutral-400">
                  Inject offline consolidated dreams
                  <span v-if="!isDreamStateEnabled" class="text-red-500 font-semibold dark:text-red-400">(Requires Dream State)</span>
                </span>
              </div>
            </div>
            <div
              :class="[
                'h-4 w-7 rounded-full transition-colors relative shrink-0',
                isDreamIntrusionEnabled && isDreamStateEnabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700',
              ]"
            >
              <div
                :class="[
                  'size-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
                  isDreamIntrusionEnabled && isDreamStateEnabled ? 'translate-x-3' : '',
                ]"
              />
            </div>
          </div>

          <!-- Toggle: Journal Intrusion -->
          <div
            v-if="hasTextJournal"
            class="flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80"
            @click="handleToggleJournalIntrusion"
          >
            <div class="flex items-center gap-2">
              <div
                class="size-6 flex items-center justify-center rounded-lg"
                :class="isJournalIntrusionEnabled ? 'bg-cyan-500/10 text-cyan-500' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'"
              >
                <div class="i-solar:notebook-bold-duotone size-3.5" />
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Journal Intrusion</span>
                <span class="text-[9px] text-neutral-400">Reference latest journal entry</span>
              </div>
            </div>
            <div
              :class="[
                'h-4 w-7 rounded-full transition-colors relative shrink-0',
                isJournalIntrusionEnabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700',
              ]"
            >
              <div
                :class="[
                  'size-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
                  isJournalIntrusionEnabled ? 'translate-x-3' : '',
                ]"
              />
            </div>
          </div>

          <!-- Toggle: Artistry Intrusion -->
          <div
            v-if="hasImageJournal"
            class="flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80"
            @click="handleToggleArtistryIntrusion"
          >
            <div class="flex items-center gap-2">
              <div
                class="size-6 flex items-center justify-center rounded-lg"
                :class="isArtistryIntrusionEnabled ? 'bg-pink-500/10 text-pink-500' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'"
              >
                <div class="i-solar:gallery-bold-duotone size-3.5" />
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Artistry Intrusion</span>
                <span class="text-[9px] text-neutral-400">Reference latest image creations</span>
              </div>
            </div>
            <div
              :class="[
                'h-4 w-7 rounded-full transition-colors relative shrink-0',
                isArtistryIntrusionEnabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700',
              ]"
            >
              <div
                :class="[
                  'size-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
                  isArtistryIntrusionEnabled ? 'translate-x-3' : '',
                ]"
              />
            </div>
          </div>

          <!-- Divider -->
          <div class="my-1 border-t border-neutral-200/40 dark:border-neutral-800/40" />

          <!-- Section: Modes -->
          <label class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">
            Modes & Output
          </label>

          <!-- Toggle: Image Director -->
          <div
            class="flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80"
            @click="handleToggleArtistry"
          >
            <div class="flex items-center gap-2">
              <div
                class="size-6 flex items-center justify-center rounded-lg"
                :class="isAutonomousArtistryEnabled ? 'bg-purple-500/10 text-purple-500' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'"
              >
                <div class="i-solar:gallery-wide-bold-duotone size-3.5" />
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Image Director</span>
                <span class="text-[9px] text-neutral-400">Generates a new image for every turn</span>
              </div>
            </div>
            <div
              :class="[
                'h-4 w-7 rounded-full transition-colors relative shrink-0',
                isAutonomousArtistryEnabled ? 'bg-purple-500' : 'bg-neutral-300 dark:bg-neutral-700',
              ]"
            >
              <div
                :class="[
                  'size-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
                  isAutonomousArtistryEnabled ? 'translate-x-3' : '',
                ]"
              />
            </div>
          </div>

          <!-- Image Spawn Mode Selector -->
          <div class="flex flex-col gap-1 px-1 py-1">
            <span class="text-[9px] text-neutral-400 font-semibold uppercase">Image Spawn Mode</span>
            <div class="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100/80 p-1 dark:bg-neutral-900/80">
              <button
                v-for="mode in (['bg', 'widget', 'inline'] as const)"
                :key="mode"
                :class="[
                  'py-1 text-center text-[10px] font-semibold rounded-lg transition-all capitalize cursor-pointer',
                  currentSpawnMode === mode
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100 font-bold'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
                ]"
                @click="handleSetSpawnMode(mode)"
              >
                {{ mode === 'bg' ? 'Background' : mode }}
              </button>
            </div>
          </div>

          <!-- Toggle: Heartbeats -->
          <div
            class="flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80"
            @click="handleToggleHeartbeats"
          >
            <div class="flex items-center gap-2">
              <div
                class="size-6 flex items-center justify-center rounded-lg"
                :class="isHeartbeatsEnabled ? 'bg-rose-500/10 text-rose-500' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'"
              >
                <div class="i-solar:heart-bold-duotone size-3.5" />
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Heartbeats</span>
                <span class="text-[9px] text-neutral-400">Activates character periodically</span>
              </div>
            </div>
            <div
              :class="[
                'h-4 w-7 rounded-full transition-colors relative shrink-0',
                isHeartbeatsEnabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700',
              ]"
            >
              <div
                :class="[
                  'size-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
                  isHeartbeatsEnabled ? 'translate-x-3' : '',
                ]"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
