<script setup lang="ts">
import type { EntityType } from '@proj-airi/stage-ui/libs/search/entity-ledger'

import { useEntityLedgerStore } from '@proj-airi/stage-ui/stores/entity-ledger'
import { Button } from '@proj-airi/ui'
import { computed, ref } from 'vue'

const props = defineProps<{
  open: boolean
  entityId: string | null
  highlightTurnId?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'deleted', entityId: string): void
  (e: 'selectEntity', entityId: string): void
}>()

const entityLedgerStore = useEntityLedgerStore()

const isReclassifying = ref(false)
const reclassifyError = ref<string | null>(null)

const entity = computed(() => {
  if (!props.entityId)
    return null
  return entityLedgerStore.activeLedger.entities.get(props.entityId) || null
})

const sources = computed(() => {
  if (!props.entityId)
    return []
  return entityLedgerStore.getEntitySources(props.entityId)
})

const claims = computed(() => {
  if (!props.entityId)
    return []
  return entityLedgerStore.getEntityClaims(props.entityId)
})

const systemOneAudit = computed(() => {
  return entity.value?.attributes?.systemOne || null
})

const availableTypes: EntityType[] = [
  'person',
  'animal',
  'place',
  'organization',
  'activity',
  'concept',
  'unknown',
]

function categoryBadgeColor(type: EntityType) {
  switch (type) {
    case 'person': return 'bg-sky-500/15 text-sky-400 border-sky-500/30'
    case 'place': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    case 'organization': return 'bg-purple-500/15 text-purple-400 border-purple-500/30'
    case 'activity': return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'concept': return 'bg-pink-500/15 text-pink-400 border-pink-500/30'
    case 'animal': return 'bg-teal-500/15 text-teal-400 border-teal-500/30'
    default: return 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30'
  }
}

function close() {
  emit('update:open', false)
}

async function handleTypeSelect(newType: EntityType) {
  if (!entity.value)
    return
  await entityLedgerStore.updateEntityType(entity.value.entityId, newType)
}

async function handleReclassify() {
  if (!entity.value || isReclassifying.value)
    return

  isReclassifying.value = true
  reclassifyError.value = null

  try {
    const result = await entityLedgerStore.reclassifyEntity(entity.value.entityId)
    if (!result) {
      reclassifyError.value = 'Classification returned no decision or failed.'
    }
  }
  catch (err: any) {
    reclassifyError.value = err?.message || String(err)
  }
  finally {
    isReclassifying.value = false
  }
}

async function handleDelete() {
  if (!entity.value)
    return
  if (confirm(`Remove entity "${entity.value.label}" and its indexed references from the Knowledge Graph?`)) {
    const id = entity.value.entityId
    await entityLedgerStore.deleteEntity(id)
    emit('deleted', id)
    close()
  }
}

function formatTimestamp(ts?: number | string): string {
  if (!ts)
    return 'Unknown'
  const date = new Date(Number(ts))
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <Transition name="slide-left">
    <div
      v-if="open && entity"
      class="absolute bottom-0 right-0 top-0 z-30 w-full flex flex-col overflow-hidden border-l border-neutral-800/80 bg-neutral-900/95 text-neutral-100 shadow-2xl backdrop-blur-xl sm:w-[420px]"
    >
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 border-b border-neutral-800/80 bg-neutral-950/40 p-4">
        <div class="min-w-0 flex-1">
          <div class="mb-1 flex flex-wrap items-center gap-2">
            <span
              :class="['px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border', categoryBadgeColor(entity.type)]"
            >
              {{ entity.type }}
            </span>
            <span class="text-xs text-neutral-400">
              {{ entity.mentions.size }} dialogue {{ entity.mentions.size === 1 ? 'mention' : 'mentions' }}
            </span>
          </div>
          <h2 class="truncate text-xl text-white font-bold tracking-tight">
            {{ entity.label }}
          </h2>
          <p class="truncate text-[10px] text-neutral-500 font-mono">
            {{ entity.entityId }}
          </p>
        </div>

        <button
          type="button"
          class="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          @click="close"
        >
          <div class="i-solar:close-circle-bold-duotone text-xl" />
        </button>
      </div>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        <!-- Classification Selector -->
        <div class="space-y-2">
          <label class="block text-xs text-neutral-400 font-semibold tracking-wider uppercase">
            Classify Entity Category
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="t in availableTypes"
              :key="t"
              type="button"
              :class="[
                'px-2.5 py-1 text-xs rounded-lg font-medium transition-all capitalize',
                entity.type === t
                  ? 'bg-primary-500/25 text-primary-300 ring-1 ring-primary-500/50'
                  : 'bg-neutral-800/60 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200',
              ]"
              @click="handleTypeSelect(t)"
            >
              {{ t }}
            </button>
          </div>
        </div>

        <!-- System 1 Cognitive Audit Card -->
        <div class="border border-neutral-800/80 rounded-xl bg-neutral-950/40 p-3.5 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="i-solar:cpu-bolt-bold-duotone text-primary-400" />
              <span class="text-xs text-neutral-300 font-semibold">System 1 Cognitive Audit</span>
            </div>
            <button
              type="button"
              :disabled="isReclassifying"
              class="flex items-center gap-1 text-xs text-primary-400 transition-colors hover:text-primary-300 disabled:opacity-50"
              @click="handleReclassify"
            >
              <div :class="['i-solar:restart-bold-duotone', isReclassifying ? 'animate-spin' : '']" />
              <span>{{ isReclassifying ? 'Evaluating...' : 'Re-evaluate' }}</span>
            </button>
          </div>

          <div v-if="systemOneAudit" class="text-xs text-neutral-300 space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-neutral-500">Evaluated Model:</span>
              <span class="text-neutral-300 font-mono">{{ systemOneAudit.model || 'System 1' }}</span>
            </div>
            <div v-if="systemOneAudit.confidence !== undefined" class="flex items-center justify-between">
              <span class="text-neutral-500">Decision Confidence:</span>
              <span class="text-emerald-400 font-mono">{{ (systemOneAudit.confidence * 100).toFixed(0) }}%</span>
            </div>
          </div>
          <p v-else class="text-xs text-neutral-500 italic">
            No System 1 evaluation cached for this entity. Click Re-evaluate to run classification.
          </p>

          <p v-if="reclassifyError" class="text-xs text-rose-400">
            {{ reclassifyError }}
          </p>
        </div>

        <!-- Claims & Relations -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs text-neutral-400 font-semibold tracking-wider uppercase">
              Claims & Relations ({{ claims.length }})
            </h3>
          </div>

          <div v-if="claims.length > 0" class="space-y-2">
            <div
              v-for="claim in claims"
              :key="claim.claimId"
              class="border border-neutral-800/60 rounded-xl bg-neutral-950/30 p-3 text-xs space-y-1.5"
            >
              <div class="flex flex-wrap items-center gap-1.5 font-medium">
                <span class="cursor-pointer text-sky-300 font-semibold hover:underline">{{ claim.subject }}</span>
                <span class="rounded bg-primary-500/20 px-1.5 py-0.5 text-[10px] text-primary-300 font-mono">
                  {{ claim.predicate }}
                </span>
                <span class="cursor-pointer text-teal-300 font-semibold hover:underline">{{ claim.object }}</span>
              </div>
              <div v-if="claim.dateInfo?.formatted_label" class="flex items-center gap-1 text-[10px] text-neutral-500">
                <div class="i-solar:calendar-date-bold-duotone text-neutral-500" />
                <span>{{ claim.dateInfo.formatted_label }}</span>
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-neutral-500 italic">
            No explicit relationship claims linked yet.
          </p>
        </div>

        <!-- Dialogue Provenance Occurrences -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs text-neutral-400 font-semibold tracking-wider uppercase">
              Dialogue Provenance ({{ sources.length }})
            </h3>
          </div>

          <div v-if="sources.length > 0" class="space-y-2.5">
            <div
              v-for="src in sources"
              :key="src.turnId"
              :class="[
                'border rounded-xl p-3 space-y-1.5 transition-all',
                src.turnId === highlightTurnId
                  ? 'border-primary-500/80 bg-primary-950/30 ring-1 ring-primary-500/50 shadow-md'
                  : 'border-neutral-800/60 bg-neutral-950/30',
              ]"
            >
              <div class="flex items-center justify-between text-[10px] text-neutral-500">
                <span class="text-neutral-400 font-medium">{{ src.speaker }}</span>
                <span>{{ formatTimestamp(src.timestamp) }}</span>
              </div>
              <p class="select-text text-xs text-neutral-300 leading-relaxed font-sans">
                "{{ src.text }}"
              </p>
            </div>
          </div>
          <p v-else class="text-xs text-neutral-500 italic">
            No dialogue provenance turns recorded for this entity.
          </p>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex items-center justify-between gap-3 border-t border-neutral-800/80 bg-neutral-950/50 p-4">
        <button
          type="button"
          class="flex items-center gap-1.5 p-1.5 text-xs text-rose-400 transition-colors hover:text-rose-300"
          @click="handleDelete"
        >
          <div class="i-solar:trash-bin-trash-bold-duotone text-sm" />
          <span>Mark as Noise / Delete</span>
        </button>

        <Button
          label="Done"
          variant="secondary"
          size="sm"
          @click="close"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
