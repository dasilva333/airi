<script setup lang="ts">
import { LifetimeProvisioningModal } from '@proj-airi/stage-ui/components'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useMemoryLifetimeStore } from '@proj-airi/stage-ui/stores/memory-lifetime'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  characterId?: string
}>()

const airiCardStore = useAiriCardStore()
const memoryLifetimeStore = useMemoryLifetimeStore()
const chatSessionStore = useChatSessionStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const effectiveCardId = computed(() => {
  const rawCandidateId = props.characterId
    || chatSessionStore.sessionMetas[chatSessionStore.activeSessionId]?.characterId
    || activeCardId.value
  // NOTICE: Guard against legacy 'default' ghost ID — always resolve to a card
  // that actually exists in the store so reads and writes target the same card.
  return airiCardStore.resolveCardId(rawCandidateId)
})

const targetCard = computed(() => {
  return (effectiveCardId.value ? airiCardStore.cards.get(effectiveCardId.value) : undefined) || activeCard.value
})

const showLifetimeModal = ref(false)

// NOTICE: mirrors LifetimeMemoryView.vue so the chat drawer resolves the same
// per-universe artifact as the settings UI instead of always reading 'global'.
const activeUniverseId = computed(() => {
  if (!effectiveCardId.value)
    return 'global'
  const activeSessionId = chatSessionStore.getCharacterIndex(effectiveCardId.value)?.activeSessionId || chatSessionStore.activeSessionId
  const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
  return activeSessionMeta?.universeId || 'global'
})

const hasLifetimeArtifact = computed(() => {
  if (!effectiveCardId.value)
    return false
  return Boolean(memoryLifetimeStore.getArtifact(effectiveCardId.value, activeUniverseId.value)?.distilledContent?.trim())
})

const activeAiriExt = computed(() => {
  const card = targetCard.value as any
  if (!card)
    return undefined
  const rawDataExt = ('data' in card ? card.data?.extensions?.airi : undefined)
  const rootExt = card.extensions?.airi
  return rawDataExt && rootExt ? { ...rawDataExt, ...rootExt } : (rootExt || rawDataExt)
})

const isLifetimeMemoryEnabled = computed(() => {
  if (!targetCard.value || !hasLifetimeArtifact.value)
    return false
  return activeAiriExt.value?.lifetimeMemory?.enabled ?? true
})

function handleToggleLifetimeMemory() {
  if (!effectiveCardId.value)
    return
  if (!hasLifetimeArtifact.value) {
    showLifetimeModal.value = true
    return
  }
  airiCardStore.toggleLifetimeMemory(effectiveCardId.value)
}

function handleOpenLifetimeSettings(e: MouseEvent) {
  e.stopPropagation()
  showLifetimeModal.value = true
}

watch([effectiveCardId, activeUniverseId], ([id, universeId]) => {
  if (id) {
    void memoryLifetimeStore.loadForCharacter(id, universeId)
  }
}, { immediate: true })

// --- CONTEXT INJECTIONS ---
const isGroundingEnabled = computed(() => {
  return activeAiriExt.value?.groundingEnabled ?? false
})

function handleToggleGrounding() {
  if (effectiveCardId.value) {
    airiCardStore.toggleGrounding(effectiveCardId.value)
  }
}

const isShortTermMemoryEnabled = computed(() => {
  if (!targetCard.value)
    return true
  return activeAiriExt.value?.shortTermMemory?.enabled ?? true
})

function handleToggleShortTermMemory() {
  if (effectiveCardId.value)
    airiCardStore.toggleShortTermMemory(effectiveCardId.value)
}

const isGroundingMemoryEnabled = computed(() => {
  return activeAiriExt.value?.groundingMemoryEnabled
    ?? (activeAiriExt.value as any)?.cognition?.searchEngine?.universeRagEnabled
    ?? false
})

function handleToggleGroundingMemory() {
  if (effectiveCardId.value) {
    airiCardStore.toggleGroundingMemory(effectiveCardId.value)
  }
}

const isGroundingDirectorScratchpadEnabled = computed(() => {
  return activeAiriExt.value?.groundingDirectorScratchpadEnabled ?? false
})

function handleToggleGroundingDirectorScratchpad() {
  if (effectiveCardId.value) {
    airiCardStore.toggleGroundingDirectorScratchpad(effectiveCardId.value)
  }
}

const isDreamStateEnabled = computed(() => {
  return activeAiriExt.value?.dreamState?.enabled ?? false
})

const isDreamIntrusionEnabled = computed(() => {
  return activeAiriExt.value?.dreamState?.injectDreamContext ?? false
})

function handleToggleDreamIntrusion() {
  if (!effectiveCardId.value || !targetCard.value || !isDreamStateEnabled.value)
    return
  const current = isDreamIntrusionEnabled.value
  airiCardStore.updateCard(effectiveCardId.value, {
    extensions: {
      ...targetCard.value.extensions,
      airi: {
        ...targetCard.value.extensions?.airi,
        dreamState: {
          ...targetCard.value.extensions?.airi?.dreamState,
          injectDreamContext: !current,
        },
      },
    },
  } as any)
}

const allowedTools = computed<string[]>(() => {
  return activeAiriExt.value?.generation?.known?.allowedTools ?? ['text_journal', 'image_journal']
})

function isToolActive(toolName: string): boolean {
  if (toolName === 'bash') {
    return allowedTools.value.includes('bash') || (activeAiriExt.value?.sandbox?.enabled ?? false)
  }
  return allowedTools.value.includes(toolName)
}

const hasTextJournal = computed(() => {
  return isToolActive('text_journal')
})

const isJournalIntrusionEnabled = computed(() => {
  return activeAiriExt.value?.textJournal?.injectJournalContext ?? false
})

function handleToggleJournalIntrusion() {
  if (!effectiveCardId.value || !targetCard.value)
    return
  const current = isJournalIntrusionEnabled.value
  airiCardStore.updateCard(effectiveCardId.value, {
    extensions: {
      ...targetCard.value.extensions,
      airi: {
        ...targetCard.value.extensions?.airi,
        textJournal: {
          ...targetCard.value.extensions?.airi?.textJournal,
          injectJournalContext: !current,
        },
      },
    },
  } as any)
}

const hasImageJournal = computed(() => {
  return isToolActive('image_journal')
})

const isArtistryIntrusionEnabled = computed(() => {
  return activeAiriExt.value?.artistry?.injectArtistryContext ?? false
})

function handleToggleArtistryIntrusion() {
  if (!effectiveCardId.value || !targetCard.value)
    return
  const current = isArtistryIntrusionEnabled.value
  airiCardStore.updateCard(effectiveCardId.value, {
    extensions: {
      ...targetCard.value.extensions,
      airi: {
        ...targetCard.value.extensions?.airi,
        artistry: {
          ...targetCard.value.extensions?.airi?.artistry,
          injectArtistryContext: !current,
        },
      },
    },
  } as any)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- Header Banner -->
    <div class="mb-1 flex items-center gap-3 px-1 py-1">
      <div class="size-10 flex shrink-0 items-center justify-center border border-amber-500/20 rounded-xl bg-amber-500/15 text-amber-500 dark:bg-amber-500/20">
        <div class="i-solar:database-bold-duotone size-6" />
      </div>
      <div class="flex flex-col">
        <span class="text-xs text-neutral-800 font-bold dark:text-neutral-100">Context Injections</span>
        <span class="text-[10px] text-neutral-400 dark:text-neutral-500">Sensors, memory and reflections</span>
      </div>
    </div>

    <!-- 1. System Sensors -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleGrounding"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isGroundingEnabled
            ? 'text-amber-500 i-solar:cpu-bolt-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:cpu-bolt-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">System Sensors</span>
          <span class="text-[9px] text-neutral-400">Inject real-time OS telemetry</span>
        </div>
      </div>
      <div
        :class="isGroundingEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isGroundingEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 2. Recent Memory -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleShortTermMemory"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isShortTermMemoryEnabled
            ? 'text-amber-500 i-solar:calendar-date-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:calendar-date-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Recent Memory</span>
          <span class="text-[9px] text-neutral-400">Include daily summaries from the rolling window</span>
        </div>
      </div>
      <div
        :class="isShortTermMemoryEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isShortTermMemoryEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 2.5. Eternal Thread (Lifetime Artifact) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleLifetimeMemory"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isLifetimeMemoryEnabled
            ? 'text-amber-500 i-solar:infinity-bold-duotone'
            : 'text-amber-500/70 dark:text-amber-400/70 i-solar:infinity-linear'"
        />
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Eternal Thread</span>
            <button
              v-if="hasLifetimeArtifact"
              type="button"
              class="p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              title="Manage Eternal Thread"
              @click="handleOpenLifetimeSettings"
            >
              <div class="i-solar:settings-minimalistic-linear text-[11px]" />
            </button>
          </div>
          <span class="text-[9px] text-neutral-400">
            Inject lifetime summary to improve coherence
          </span>
        </div>
      </div>
      <div
        :class="isLifetimeMemoryEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isLifetimeMemoryEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 3. Universe Memory (RAG) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleGroundingMemory"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isGroundingMemoryEnabled
            ? 'text-amber-500 i-solar:database-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:database-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Universe Memory (RAG)</span>
          <span class="text-[9px] text-neutral-400">Semantic long-term memory lookup</span>
        </div>
      </div>
      <div
        :class="isGroundingMemoryEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isGroundingMemoryEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 3. Visual Scene State -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleGroundingDirectorScratchpad"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isGroundingDirectorScratchpadEnabled
            ? 'text-amber-500 i-solar:gallery-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:gallery-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Visual Scene State</span>
          <span class="text-[9px] text-neutral-400">Attach Director's latest scratchpad</span>
        </div>
      </div>
      <div
        :class="isGroundingDirectorScratchpadEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isGroundingDirectorScratchpadEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- Divider -->
    <div class="mx-1 my-1 border-t border-neutral-200/30 dark:border-neutral-800/40" />

    <!-- 4. Dream Intrusion -->
    <div
      class="w-full flex items-center justify-between rounded-xl px-2.5 py-2 transition"
      :class="[
        !isDreamStateEnabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/60',
      ]"
      @click="handleToggleDreamIntrusion"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isDreamIntrusionEnabled && isDreamStateEnabled
            ? 'text-indigo-500 i-solar:sleeping-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:sleeping-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Dream Reflection</span>
          <span class="text-[9px] text-neutral-400">
            Inject offline consolidated dreams
            <span v-if="!isDreamStateEnabled" class="text-amber-500 font-semibold dark:text-amber-400"> (Requires Dreams)</span>
          </span>
        </div>
      </div>
      <div
        :class="isDreamIntrusionEnabled && isDreamStateEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isDreamIntrusionEnabled && isDreamStateEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 5. Journal Intrusion -->
    <div
      class="w-full flex items-center justify-between rounded-xl px-2.5 py-2 transition"
      :class="[
        !hasTextJournal
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/60',
      ]"
      @click="hasTextJournal && handleToggleJournalIntrusion()"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isJournalIntrusionEnabled && hasTextJournal
            ? 'text-cyan-500 i-solar:notebook-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:notebook-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Journal Reflection</span>
          <span class="text-[9px] text-neutral-400">
            Reference latest journal entry
            <span v-if="!hasTextJournal" class="text-amber-500 font-semibold dark:text-amber-400"> (Requires Memory Tool)</span>
          </span>
        </div>
      </div>
      <div
        :class="isJournalIntrusionEnabled && hasTextJournal ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isJournalIntrusionEnabled && hasTextJournal ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 6. Artistry Intrusion -->
    <div
      class="w-full flex items-center justify-between rounded-xl px-2.5 py-2 transition"
      :class="[
        !hasImageJournal
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/60',
      ]"
      @click="hasImageJournal && handleToggleArtistryIntrusion()"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isArtistryIntrusionEnabled && hasImageJournal
            ? 'text-pink-500 i-solar:gallery-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:gallery-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Artistry Reflection</span>
          <span class="text-[9px] text-neutral-400">
            Reference latest image creations
            <span v-if="!hasImageJournal" class="text-amber-500 font-semibold dark:text-amber-400"> (Requires Image Journal)</span>
          </span>
        </div>
      </div>
      <div
        :class="isArtistryIntrusionEnabled && hasImageJournal ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isArtistryIntrusionEnabled && hasImageJournal ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- Lifetime Provisioning Modal -->
    <LifetimeProvisioningModal
      v-if="effectiveCardId"
      v-model:open="showLifetimeModal"
      :character-id="effectiveCardId"
      :universe-id="activeUniverseId"
    />
  </div>
</template>
