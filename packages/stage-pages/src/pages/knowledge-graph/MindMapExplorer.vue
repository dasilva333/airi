<script setup lang="ts">
import type { TimelineClaimItem, TimelineEntityItem } from './components/ChronologicalTimelineView.vue'
import type { GraphEdge, GraphNode } from './components/ConstellationCanvas.vue'

import { useEntityLedgerStore } from '@proj-airi/stage-ui/stores/entity-ledger'
import { useShortTermMemoryStore } from '@proj-airi/stage-ui/stores/memory-short-term'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'

import ChronologicalTimelineView from './components/ChronologicalTimelineView.vue'
import ConstellationCanvas from './components/ConstellationCanvas.vue'
import EntityDetailDrawer from './components/EntityDetailDrawer.vue'
import MindMapHeader from './components/MindMapHeader.vue'
import MindMapZeroState from './components/MindMapZeroState.vue'
import UniversalTimeScrubber from './components/UniversalTimeScrubber.vue'

const emit = defineEmits<{
  (e: 'ready'): void
}>()

const entityLedgerStore = useEntityLedgerStore()
const shortTermStore = useShortTermMemoryStore()
const airiCardStore = useAiriCardStore()
const { activeCardId } = storeToRefs(airiCardStore)

// View State
const viewMode = ref<'constellation' | 'timeline'>('constellation')
const selectedEntityId = ref<string | null>(null)
const selectedTurnId = ref<string | null>(null)
const isDrawerOpen = ref(false)
const searchQuery = ref('')
const selectedCategory = ref('all')

// Scrubber Timeline Bounds
const minTimestamp = ref(Date.now() - 30 * 24 * 60 * 60 * 1000)
const maxTimestamp = ref(Date.now())
const currentScrubTimestamp = ref(Date.now())

async function loadData() {
  if (!activeCardId.value)
    return

  await entityLedgerStore.loadLedger(activeCardId.value)
  await shortTermStore.load()

  calculateTimeBounds()
  emit('ready')
}

function calculateTimeBounds() {
  let earliest = Infinity
  let latest = -Infinity

  // 1. Inspect Sources
  for (const src of entityLedgerStore.sources) {
    if (src.timestamp && Number.isFinite(src.timestamp)) {
      earliest = Math.min(earliest, src.timestamp)
      latest = Math.max(latest, src.timestamp)
    }
  }

  // 2. Inspect 24h Short-Term memory blocks
  for (const block of shortTermStore.blocks) {
    const ts = block.createdAt || (block.date ? new Date(block.date).getTime() : 0)
    if (ts && Number.isFinite(ts)) {
      earliest = Math.min(earliest, ts)
      latest = Math.max(latest, ts)
    }
  }

  if (!Number.isFinite(earliest) || !Number.isFinite(latest) || earliest >= latest) {
    latest = Date.now()
    earliest = latest - 7 * 24 * 60 * 60 * 1000
  }

  minTimestamp.value = earliest
  maxTimestamp.value = latest
  currentScrubTimestamp.value = maxTimestamp.value
}

// Convert EntityLedger entities into GraphNode definitions
const graphNodes = computed<GraphNode[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const result: GraphNode[] = []

  for (const ent of entityLedgerStore.entities) {
    // Filter Category
    if (selectedCategory.value !== 'all' && ent.type !== selectedCategory.value)
      continue

    // Filter Search
    if (query && !ent.label.toLowerCase().includes(query))
      continue

    // Find earliest mention timestamp
    let earliestMention = Infinity
    for (const turnId of ent.mentions) {
      const src = entityLedgerStore.activeLedger.sources.get(turnId)
      if (src?.timestamp && Number.isFinite(src.timestamp)) {
        earliestMention = Math.min(earliestMention, src.timestamp)
      }
    }

    if (!Number.isFinite(earliestMention)) {
      earliestMention = minTimestamp.value
    }

    const mentionsCount = ent.mentions.size
    const radius = Math.max(12, Math.min(34, 10 + Math.log2(mentionsCount + 1) * 4))

    result.push({
      id: ent.entityId,
      label: ent.label,
      type: ent.type,
      mentionsCount,
      firstSeenTimestamp: earliestMention,
      radius,
      mentions: Array.from(ent.mentions),
    })
  }

  return result
})

// Convert EntityLedger claims into GraphEdge definitions
const graphEdges = computed<GraphEdge[]>(() => {
  const nodeIds = new Set(graphNodes.value.map(n => n.id))
  const labelToIdMap = new Map(graphNodes.value.map(n => [n.label.toLowerCase(), n.id]))
  const result: GraphEdge[] = []

  for (const claim of entityLedgerStore.claims) {
    const srcId = labelToIdMap.get(claim.subject.toLowerCase())
    const tgtId = labelToIdMap.get(claim.object.toLowerCase())

    if (srcId && tgtId && nodeIds.has(srcId) && nodeIds.has(tgtId)) {
      result.push({
        id: claim.claimId,
        source: srcId,
        target: tgtId,
        predicate: claim.predicate,
      })
    }
  }

  return result
})

// Timeline Data Adapters
const timelineEntities = computed<TimelineEntityItem[]>(() => {
  return graphNodes.value.map(n => ({
    id: n.id,
    label: n.label,
    type: n.type,
    firstSeenTimestamp: n.firstSeenTimestamp,
    mentionsCount: n.mentionsCount,
    mentions: n.mentions || [],
  }))
})

const timelineClaims = computed<TimelineClaimItem[]>(() => {
  return entityLedgerStore.claims.map(c => ({
    claimId: c.claimId,
    subject: c.subject,
    predicate: c.predicate,
    object: c.object,
    evidence: c.evidence,
    formattedDate: c.dateInfo?.formatted_label,
  }))
})

const activeEntitiesCount = computed(() => {
  return graphNodes.value.filter(n => n.firstSeenTimestamp <= currentScrubTimestamp.value).length
})

function handleSelectEntity(id: string, turnId?: string) {
  selectedEntityId.value = id
  selectedTurnId.value = turnId || null
  isDrawerOpen.value = true
}

async function handleRebuild() {
  if (!activeCardId.value)
    return
  await entityLedgerStore.rebuildKnowledgeGraph(activeCardId.value)
  calculateTimeBounds()
}

async function handleClear() {
  if (!activeCardId.value)
    return
  if (confirm('Are you sure you want to clear the entire Knowledge Graph for this character?')) {
    await entityLedgerStore.clearLedger(activeCardId.value)
    selectedEntityId.value = null
    selectedTurnId.value = null
    isDrawerOpen.value = false
  }
}

watch(activeCardId, () => {
  selectedEntityId.value = null
  selectedTurnId.value = null
  isDrawerOpen.value = false
  void loadData()
})

onMounted(() => {
  void loadData()
})
</script>

<template>
  <div class="relative h-full w-full flex flex-col select-none overflow-hidden bg-neutral-950 text-neutral-100">
    <!-- Header -->
    <MindMapHeader
      class="relative z-30"
      :view-mode="viewMode"
      :search-query="searchQuery"
      :selected-category="selectedCategory"
      @update:view-mode="viewMode = $event"
      @update:search-query="searchQuery = $event"
      @update:selected-category="selectedCategory = $event"
      @rebuild="handleRebuild"
      @clear="handleClear"
    />

    <!-- Main Content Area -->
    <div class="relative flex-1 overflow-hidden">
      <!-- Zero State (if empty and not priming) -->
      <MindMapZeroState
        v-if="entityLedgerStore.entities.length === 0 && !entityLedgerStore.isPriming"
        @synthesize="handleRebuild"
      />

      <!-- Keep views alive across tab toggles -->
      <template v-else>
        <KeepAlive>
          <ConstellationCanvas
            v-if="viewMode === 'constellation'"
            :nodes="graphNodes"
            :edges="graphEdges"
            :selected-entity-id="selectedEntityId"
            :current-scrub-timestamp="currentScrubTimestamp"
            @select-entity="handleSelectEntity"
          />
          <ChronologicalTimelineView
            v-else
            :entities="timelineEntities"
            :claims="timelineClaims"
            :sources="entityLedgerStore.sources"
            :selected-entity-id="selectedEntityId"
            :current-scrub-timestamp="currentScrubTimestamp"
            :min-timestamp="minTimestamp"
            :max-timestamp="maxTimestamp"
            :search-query="searchQuery"
            @select-entity="handleSelectEntity"
            @update:current-scrub-timestamp="currentScrubTimestamp = $event"
          />
        </KeepAlive>
      </template>

      <!-- Slide-Out Entity Detail Inspector Drawer -->
      <EntityDetailDrawer
        :open="isDrawerOpen"
        :entity-id="selectedEntityId"
        :highlight-turn-id="selectedTurnId"
        @update:open="isDrawerOpen = $event"
        @select-entity="handleSelectEntity"
        @deleted="selectedEntityId = null; selectedTurnId = null"
      />
    </div>

    <!-- Bottom Universal Time Scrubber -->
    <UniversalTimeScrubber
      v-if="entityLedgerStore.entities.length > 0"
      v-model="currentScrubTimestamp"
      :min-timestamp="minTimestamp"
      :max-timestamp="maxTimestamp"
      :total-entities-count="graphNodes.length"
      :active-entities-count="activeEntitiesCount"
    />
  </div>
</template>
