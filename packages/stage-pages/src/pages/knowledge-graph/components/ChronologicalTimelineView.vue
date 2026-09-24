<script setup lang="ts">
import type { EntityType, SourceRecord } from '@proj-airi/stage-ui/libs/search/entity-ledger'
import type { ZoomTransform } from 'd3-zoom'

import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

export interface TimelineEntityItem {
  id: string
  label: string
  type: EntityType
  firstSeenTimestamp: number
  mentionsCount: number
  mentions: string[]
}

export interface TimelineClaimItem {
  claimId: string
  subject: string
  predicate: string
  object: string
  evidence: string[]
  formattedDate?: string
}

export interface TimelineEpisode {
  id: string
  label: string
  startTime: number
  endTime: number
  turnsCount: number
  turnIds: string[]
  entitiesCount: number
}

const props = withDefaults(
  defineProps<{
    entities: TimelineEntityItem[]
    claims: TimelineClaimItem[]
    sources: SourceRecord[]
    selectedEntityId: string | null
    currentScrubTimestamp: number
    minTimestamp: number
    maxTimestamp: number
    searchQuery?: string
  }>(),
  {
    searchQuery: '',
  },
)

const emit = defineEmits<{
  (e: 'selectEntity', entityId: string, turnId?: string): void
  (e: 'update:currentScrubTimestamp', value: number): void
}>()

const svgRef = ref<SVGSVGElement | null>(null)

const canvasWidth = ref(1200)
const currentTransform = ref<ZoomTransform>(zoomIdentity)
const isFollowScrubber = ref(true)

// Explicit 7-category taxonomy including Unknown
const LANE_CATEGORIES: { type: EntityType, label: string, color: string, icon: string }[] = [
  { type: 'person', label: 'People & Characters', color: '#38bdf8', icon: 'i-solar:users-group-two-rounded-bold-duotone' },
  { type: 'place', label: 'Places & Environments', color: '#34d399', icon: 'i-solar:map-point-wave-bold-duotone' },
  { type: 'organization', label: 'Factions & Organizations', color: '#c084fc', icon: 'i-solar:buildings-2-bold-duotone' },
  { type: 'concept', label: 'Concepts & Theories', color: '#f472b6', icon: 'i-solar:atom-bold-duotone' },
  { type: 'activity', label: 'Activities & Events', color: '#fbbf24', icon: 'i-solar:calendar-date-bold-duotone' },
  { type: 'animal', label: 'Creatures & Animals', color: '#2dd4bf', icon: 'i-solar:cat-bold-duotone' },
  { type: 'unknown', label: 'Other & Unclassified', color: '#9ca3af', icon: 'i-solar:question-circle-bold-duotone' },
]

// Lane metrics
const LANE_HEIGHT = 88
const HEADER_HEIGHT = 44
const LEFT_GUTTER = 180
const BASE_TIMELINE_WIDTH = 2800

const totalHeight = computed(() => HEADER_HEIGHT + LANE_CATEGORIES.length * LANE_HEIGHT + 40)

function getLaneY(type: EntityType): number {
  const idx = LANE_CATEGORIES.findIndex(l => l.type === type)
  const laneIndex = idx !== -1 ? idx : LANE_CATEGORIES.length - 1
  return HEADER_HEIGHT + laneIndex * LANE_HEIGHT + LANE_HEIGHT / 2
}

// Map of sources by turnId
const sourceMap = computed(() => {
  const map = new Map<string, SourceRecord>()
  for (const s of props.sources) {
    map.set(s.turnId, s)
  }
  return map
})

// Canonical Base Time coordinate u(t)
function timeToBaseX(ts: number): number {
  const range = Math.max(1, props.maxTimestamp - props.minTimestamp)
  const progress = Math.min(1, Math.max(0, (ts - props.minTimestamp) / range))
  return LEFT_GUTTER + progress * BASE_TIMELINE_WIDTH
}

// Projected Screen coordinate: screenX = k * u(t) + tx
function timeToScreenX(ts: number): number {
  return currentTransform.value.applyX(timeToBaseX(ts))
}

// 1. Session / Episode LOD Aggregation (Proposal 1)
const episodes = computed<TimelineEpisode[]>(() => {
  if (props.sources.length === 0)
    return []

  // Sort sources by timestamp
  const sorted = [...props.sources].sort((a, b) => a.timestamp - b.timestamp)
  const result: TimelineEpisode[] = []
  let currentTurns: SourceRecord[] = []

  const GAP_THRESHOLD_MS = 45 * 60 * 1000 // 45 minutes gap defines a new episode

  for (let i = 0; i < sorted.length; i++) {
    const src = sorted[i]
    if (currentTurns.length === 0) {
      currentTurns.push(src)
      continue
    }

    const prev = currentTurns[currentTurns.length - 1]
    const gap = src.timestamp - prev.timestamp
    const sessionMismatch = src.session && prev.session && src.session !== prev.session

    if (gap > GAP_THRESHOLD_MS || sessionMismatch) {
      // Finalize current episode
      const start = currentTurns[0].timestamp
      const end = currentTurns[currentTurns.length - 1].timestamp
      const turnIds = currentTurns.map(t => t.turnId)

      // Find all distinct entities mentioned in this episode
      const entityIds = new Set<string>()
      for (const ent of props.entities) {
        if (ent.mentions.some(m => turnIds.includes(m))) {
          entityIds.add(ent.id)
        }
      }

      const d = new Date(start)
      const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

      result.push({
        id: `ep-${result.length + 1}`,
        label: dateLabel,
        startTime: start,
        endTime: Math.max(end, start + 10 * 60 * 1000),
        turnsCount: currentTurns.length,
        turnIds,
        entitiesCount: entityIds.size,
      })

      currentTurns = [src]
    }
    else {
      currentTurns.push(src)
    }
  }

  if (currentTurns.length > 0) {
    const start = currentTurns[0].timestamp
    const end = currentTurns[currentTurns.length - 1].timestamp
    const turnIds = currentTurns.map(t => t.turnId)
    const entityIds = new Set<string>()
    for (const ent of props.entities) {
      if (ent.mentions.some(m => turnIds.includes(m))) {
        entityIds.add(ent.id)
      }
    }
    const d = new Date(start)
    const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

    result.push({
      id: `ep-${result.length + 1}`,
      label: dateLabel,
      startTime: start,
      endTime: Math.max(end, start + 10 * 60 * 1000),
      turnsCount: currentTurns.length,
      turnIds,
      entitiesCount: entityIds.size,
    })
  }

  return result
})

// 2. Mention Beads & Deterministic Vertical Packing (Proposal 2)
export interface TimelineMentionBead {
  id: string
  entityId: string
  label: string
  type: EntityType
  timestamp: number
  turnSnippet?: string
  turnId?: string
  isFirstSeen: boolean
  x: number
  y: number
  radius: number
  color: string
  showLabel: boolean
}

export interface OverflowCluster {
  id: string
  x: number
  y: number
  timestamp: number
  type: EntityType
  count: number
  entities: Array<{ id: string, label: string, color: string }>
}

// Focused lifeline: ONLY draw for selected or hovered entity
interface EntityLifeline {
  entityId: string
  label: string
  type: EntityType
  color: string
  startX: number
  endX: number
  y: number
  mentionsCount: number
}

// Hover Tooltip State
const hoveredBead = ref<TimelineMentionBead | null>(null)
const hoveredCluster = ref<OverflowCluster | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)

const focusedEntityId = computed(() => {
  return props.selectedEntityId || hoveredBead.value?.entityId || null
})

const entityLifelines = computed<EntityLifeline[]>(() => {
  if (!focusedEntityId.value)
    return []

  const ent = props.entities.find(e => e.id === focusedEntityId.value)
  if (!ent || ent.firstSeenTimestamp > props.currentScrubTimestamp)
    return []

  const mentions: number[] = []
  for (const turnId of ent.mentions) {
    const src = sourceMap.value.get(turnId)
    if (src && src.timestamp <= props.currentScrubTimestamp) {
      mentions.push(src.timestamp)
    }
  }
  if (mentions.length === 0) {
    mentions.push(ent.firstSeenTimestamp)
  }

  const minTs = Math.min(...mentions)
  const maxTs = Math.max(...mentions)
  const y = getLaneY(ent.type)
  const categoryInfo = LANE_CATEGORIES.find(l => l.type === ent.type)

  return [{
    entityId: ent.id,
    label: ent.label,
    type: ent.type,
    color: categoryInfo?.color || '#9ca3af',
    startX: timeToScreenX(minTs),
    endX: timeToScreenX(maxTs),
    y,
    mentionsCount: mentions.length,
  }]
})

// Deterministic vertical packing and screen-space label culling
const packedTimeline = computed(() => {
  const visibleBeads: TimelineMentionBead[] = []
  const overflowClusters: OverflowCluster[] = []

  // Sub-row offsets from lane center (max 5 rows)
  const SUB_ROW_OFFSETS = [0, -18, 18, -32, 32]
  const MIN_HORIZONTAL_SPACING = 22 // pixels minimum separation in same row

  // Process lane by lane
  for (const lane of LANE_CATEGORIES) {
    const laneY = getLaneY(lane.type)
    const laneBeads: Array<{
      id: string
      entityId: string
      label: string
      type: EntityType
      timestamp: number
      turnSnippet?: string
      turnId?: string
      isFirstSeen: boolean
      screenX: number
      radius: number
      color: string
      mentionsCount: number
    }> = []

    // 1. Gather all mentions in this lane
    for (const ent of props.entities) {
      if (ent.type !== lane.type)
        continue
      if (ent.firstSeenTimestamp > props.currentScrubTimestamp)
        continue

      const relevantTurns: SourceRecord[] = []
      for (const turnId of ent.mentions) {
        const src = sourceMap.value.get(turnId)
        if (src && src.timestamp <= props.currentScrubTimestamp) {
          relevantTurns.push(src)
        }
      }

      if (relevantTurns.length === 0) {
        laneBeads.push({
          id: `${ent.id}-first`,
          entityId: ent.id,
          label: ent.label,
          type: ent.type,
          timestamp: ent.firstSeenTimestamp,
          isFirstSeen: true,
          screenX: timeToScreenX(ent.firstSeenTimestamp),
          radius: 6,
          color: lane.color,
          mentionsCount: ent.mentionsCount,
        })
      }
      else {
        relevantTurns.sort((a, b) => a.timestamp - b.timestamp)
        relevantTurns.forEach((turn, idx) => {
          const isFirst = idx === 0
          laneBeads.push({
            id: `${ent.id}-${turn.turnId}`,
            entityId: ent.id,
            label: ent.label,
            type: ent.type,
            timestamp: turn.timestamp,
            turnSnippet: turn.text,
            turnId: turn.turnId,
            isFirstSeen: isFirst,
            screenX: timeToScreenX(turn.timestamp),
            radius: isFirst ? 6 : 4,
            color: lane.color,
            mentionsCount: ent.mentionsCount,
          })
        })
      }
    }

    // 2. Sort marks chronologically by screenX with deterministic entityId tie-breaker
    laneBeads.sort((a, b) => {
      const dx = a.screenX - b.screenX
      if (Math.abs(dx) > 0.001)
        return dx
      return a.entityId.localeCompare(b.entityId)
    })

    // 3. Deterministic vertical packing
    const lastPlacedX = new Array(SUB_ROW_OFFSETS.length).fill(-Infinity)
    const pendingOverflowMap = new Map<number, Array<{ id: string, label: string, color: string }>>()

    for (const b of laneBeads) {
      let placedRowIndex = -1

      for (let r = 0; r < SUB_ROW_OFFSETS.length; r++) {
        if (b.screenX - lastPlacedX[r] >= MIN_HORIZONTAL_SPACING) {
          placedRowIndex = r
          break
        }
      }

      if (placedRowIndex !== -1) {
        lastPlacedX[placedRowIndex] = b.screenX
        visibleBeads.push({
          id: b.id,
          entityId: b.entityId,
          label: b.label,
          type: b.type,
          timestamp: b.timestamp,
          turnSnippet: b.turnSnippet,
          turnId: b.turnId,
          isFirstSeen: b.isFirstSeen,
          x: b.screenX,
          y: laneY + SUB_ROW_OFFSETS[placedRowIndex],
          radius: b.radius,
          color: b.color,
          showLabel: false, // populated by label culling pass below
        })
      }
      else {
        // Collect into overflow cluster at this screen coordinate bucket
        const bucketX = Math.round(b.screenX / 16) * 16
        if (!pendingOverflowMap.has(bucketX)) {
          pendingOverflowMap.set(bucketX, [])
        }
        pendingOverflowMap.get(bucketX)!.push({
          id: b.entityId,
          label: b.label,
          color: b.color,
        })
      }
    }

    // Emit overflow clusters
    for (const [bucketX, clusterEntities] of pendingOverflowMap.entries()) {
      overflowClusters.push({
        id: `overflow-${lane.type}-${bucketX}`,
        x: bucketX,
        y: laneY,
        timestamp: props.minTimestamp,
        type: lane.type,
        count: clusterEntities.length,
        entities: clusterEntities,
      })
    }
  }

  // 3. Screen-Space Label Culling (Proposal 3)
  // Priority: 1. Selected, 2. Search match, 3. First-seen with high mention count
  const labelCandidates = [...visibleBeads].map((bead) => {
    let priority = 10
    const query = props.searchQuery?.trim().toLowerCase()

    if (props.selectedEntityId === bead.entityId) {
      priority = 100
    }
    else if (query && bead.label.toLowerCase().includes(query)) {
      priority = 85
    }
    else if (bead.isFirstSeen) {
      const ent = props.entities.find(e => e.id === bead.entityId)
      priority = 40 + Math.min(40, (ent?.mentionsCount || 1) * 3)
    }

    return { bead, priority }
  })

  // Sort descending by priority
  labelCandidates.sort((a, b) => b.priority - a.priority)

  // Greedy 2D bounding-box collision detection
  interface BoundingBox {
    x1: number
    y1: number
    x2: number
    y2: number
  }

  const occupiedBoxes: BoundingBox[] = []

  for (const { bead } of labelCandidates) {
    // Only consider first-seen, selected, or search-matched beads for permanent text labels
    const isSearchMatch = props.searchQuery && bead.label.toLowerCase().includes(props.searchQuery.toLowerCase())
    if (!bead.isFirstSeen && props.selectedEntityId !== bead.entityId && !isSearchMatch) {
      continue
    }

    const estimatedWidth = Math.min(140, bead.label.length * 6.5 + 12)
    const box: BoundingBox = {
      x1: bead.x + bead.radius + 4,
      y1: bead.y - 8,
      x2: bead.x + bead.radius + 4 + estimatedWidth,
      y2: bead.y + 8,
    }

    // Check collision with already accepted boxes
    let hasCollision = false
    for (const occ of occupiedBoxes) {
      if (box.x1 < occ.x2 && box.x2 > occ.x1 && box.y1 < occ.y2 && box.y2 > occ.y1) {
        hasCollision = true
        break
      }
    }

    if (!hasCollision) {
      occupiedBoxes.push(box)
      bead.showLabel = true
    }
  }

  return { beads: visibleBeads, overflowClusters }
})

// Date grid lines along X
const dateGridMarkers = computed(() => {
  const markers: { timestamp: number, dateLabel: string, x: number }[] = []
  const start = props.minTimestamp
  const end = props.maxTimestamp
  if (start >= end)
    return []

  const totalMs = end - start
  const dayMs = 24 * 60 * 60 * 1000
  const totalDays = Math.ceil(totalMs / dayMs)

  // Dynamic day step so date labels never collide (min 80px spacing)
  const currentZoomedWidth = BASE_TIMELINE_WIDTH * currentTransform.value.k
  const pxPerDay = currentZoomedWidth / Math.max(1, totalDays)

  let stepDays = 1
  if (pxPerDay < 40)
    stepDays = 7
  else if (pxPerDay < 70)
    stepDays = 3
  else if (pxPerDay < 110)
    stepDays = 2
  else
    stepDays = 1

  const stepMs = totalDays <= 1 ? (4 * 60 * 60 * 1000) : stepDays * dayMs

  let curr = start
  while (curr <= end) {
    const d = new Date(curr)
    const dateLabel = totalDays <= 1
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' })

    markers.push({
      timestamp: curr,
      dateLabel,
      x: timeToScreenX(curr),
    })
    curr += stepMs
  }

  return markers
})

function handleBeadMouseEnter(e: MouseEvent, bead: TimelineMentionBead) {
  hoveredBead.value = bead
  hoveredCluster.value = null
  updateTooltipPosition(e)
}

function handleClusterMouseEnter(e: MouseEvent, cluster: OverflowCluster) {
  hoveredCluster.value = cluster
  hoveredBead.value = null
  updateTooltipPosition(e)
}

function updateTooltipPosition(e: MouseEvent) {
  const clampedX = Math.min(window.innerWidth - 340, Math.max(190, e.clientX + 14))
  const clampedY = Math.min(window.innerHeight - 200, Math.max(60, e.clientY + 14))
  tooltipX.value = clampedX
  tooltipY.value = clampedY
}

function handlePointerLeave() {
  hoveredBead.value = null
  hoveredCluster.value = null
}

function handleBeadClick(bead: TimelineMentionBead) {
  emit('selectEntity', bead.entityId, bead.turnId)
}

function handleClusterSelect(entityId: string) {
  emit('selectEntity', entityId)
  hoveredCluster.value = null
}

// Playhead X position
const playheadX = computed(() => timeToScreenX(props.currentScrubTimestamp))

// Zoom & Pan setup
const MAX_ZOOM = 4.0 // Closest zoom level available
const MIN_ZOOM = 0.25
let zoomHandler: any = null

function setupZoom() {
  if (!svgRef.value)
    return

  const rect = svgRef.value.getBoundingClientRect()
  if (rect.width > 0)
    canvasWidth.value = rect.width

  zoomHandler = zoom()
    .scaleExtent([MIN_ZOOM, MAX_ZOOM])
    .on('zoom', (event) => {
      currentTransform.value = event.transform
      // Suspend camera follow if the zoom/pan was triggered manually by user mouse or touch
      if (event.sourceEvent) {
        isFollowScrubber.value = false
      }
    })

  select(svgRef.value).call(zoomHandler)
}

function zoomIn() {
  if (svgRef.value && zoomHandler) {
    select(svgRef.value).call(zoomHandler.scaleBy, 1.35)
  }
}

function zoomOut() {
  if (svgRef.value && zoomHandler) {
    select(svgRef.value).call(zoomHandler.scaleBy, 0.75)
  }
}

function resetZoom() {
  if (svgRef.value && zoomHandler) {
    fitToPlayhead(MAX_ZOOM)
  }
}

// Non-double-scaled camera centering (Proposal 5 & Bug Fix 4)
function fitToPlayhead(scale?: number) {
  if (!svgRef.value || !zoomHandler)
    return

  const currentScale = scale ?? currentTransform.value.k
  const centerScreenX = LEFT_GUTTER + (canvasWidth.value - LEFT_GUTTER) / 2
  const baseTargetX = timeToBaseX(props.currentScrubTimestamp)

  // Target translation equation: k * baseTargetX + tx = centerScreenX => tx = centerScreenX - k * baseTargetX
  const targetTx = centerScreenX - currentScale * baseTargetX
  const targetTransform = zoomIdentity.translate(targetTx, 0).scale(currentScale)

  select(svgRef.value).call(zoomHandler.transform, targetTransform)
}

function toggleFollowScrubber() {
  isFollowScrubber.value = !isFollowScrubber.value
  if (isFollowScrubber.value) {
    fitToPlayhead()
  }
}

function frameEpisode(ep: TimelineEpisode) {
  if (!svgRef.value || !zoomHandler)
    return

  isFollowScrubber.value = false
  const midTime = (ep.startTime + ep.endTime) / 2
  const baseMidX = timeToBaseX(midTime)
  const centerScreenX = LEFT_GUTTER + (canvasWidth.value - LEFT_GUTTER) / 2

  // Frame with nice readable scale (1.5x)
  const targetScale = 1.5
  const targetTx = centerScreenX - targetScale * baseMidX
  const targetTransform = zoomIdentity.translate(targetTx, 0).scale(targetScale)

  select(svgRef.value).call(zoomHandler.transform, targetTransform)
}

function screenXToTime(screenX: number): number {
  if (!svgRef.value)
    return props.currentScrubTimestamp
  const rect = svgRef.value.getBoundingClientRect()
  const localX = screenX - rect.left
  const unscaledX = currentTransform.value.invertX(localX)
  const range = Math.max(1, props.maxTimestamp - props.minTimestamp)
  const progress = Math.max(0, Math.min(1, (unscaledX - LEFT_GUTTER) / BASE_TIMELINE_WIDTH))
  return props.minTimestamp + progress * range
}

let isDraggingScrubber = false

function handleHeaderPointerDown(e: PointerEvent) {
  if (e.button !== 0)
    return
  e.stopPropagation()
  isDraggingScrubber = true
  const newTs = screenXToTime(e.clientX)
  emit('update:currentScrubTimestamp', newTs)

  function onMove(ev: PointerEvent) {
    if (!isDraggingScrubber)
      return
    const ts = screenXToTime(ev.clientX)
    emit('update:currentScrubTimestamp', ts)
  }

  function onUp() {
    isDraggingScrubber = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function fitInitialView() {
  if (!svgRef.value || !zoomHandler)
    return
  // Set default view to the closest zoom level available centered on the playhead
  fitToPlayhead(MAX_ZOOM)
}

// Camera follow watcher: updates per animation frame during scrubbing/playback
let followRafId: number | null = null
watch(
  () => props.currentScrubTimestamp,
  () => {
    if (isFollowScrubber.value) {
      const currentX = timeToScreenX(props.currentScrubTimestamp)
      const minVisibleX = LEFT_GUTTER + 20
      const maxVisibleX = canvasWidth.value - 40

      // Only pan camera if playhead reaches edges of visible view
      if (currentX < minVisibleX || currentX > maxVisibleX) {
        if (followRafId)
          cancelAnimationFrame(followRafId)
        followRafId = requestAnimationFrame(() => {
          fitToPlayhead()
        })
      }
    }
  },
)

onMounted(async () => {
  await nextTick()
  setupZoom()
  fitInitialView()
  window.addEventListener('resize', setupZoom)
})

onUnmounted(() => {
  if (followRafId)
    cancelAnimationFrame(followRafId)
  window.removeEventListener('resize', setupZoom)
})

watch(() => [props.minTimestamp, props.maxTimestamp], () => {
  setupZoom()
  fitInitialView()
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative h-full w-full select-none overflow-x-hidden overflow-y-auto bg-neutral-950 text-neutral-100"
  >
    <!-- Sticky Left Category Sidebar -->
    <div
      class="pointer-events-none absolute bottom-0 left-0 top-0 z-20 w-[180px] border-r border-neutral-800/80 bg-neutral-950/85 backdrop-blur-md"
      :style="{ minHeight: `${totalHeight}px` }"
    >
      <!-- Header Spacer -->
      <div class="h-[44px] flex items-center border-b border-neutral-800/60 px-3">
        <span class="text-[10px] text-neutral-500 font-bold tracking-wider uppercase">Lanes / Domains</span>
      </div>

      <!-- Category Badges -->
      <div
        v-for="lane in LANE_CATEGORIES"
        :key="lane.type"
        class="flex flex-col justify-center border-b border-neutral-800/40 px-3"
        :style="{ height: `${LANE_HEIGHT}px` }"
      >
        <div class="flex items-center gap-2">
          <div
            class="h-6 w-6 flex items-center justify-center rounded-lg text-sm"
            :style="{ backgroundColor: `${lane.color}20`, color: lane.color }"
          >
            <div :class="lane.icon" />
          </div>
          <span class="truncate text-xs text-neutral-300 font-semibold">{{ lane.label }}</span>
        </div>
      </div>
    </div>

    <!-- Main SVG Timeline Canvas -->
    <svg
      ref="svgRef"
      class="w-full cursor-grab active:cursor-grabbing"
      :style="{ height: `${totalHeight}px`, minHeight: `${totalHeight}px` }"
    >
      <defs>
        <!-- Soft Neon Glow Filter -->
        <filter id="timeline-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Pannable Content Group -->
      <g>
        <!-- 1. Background Date Columns & Header -->
        <g class="date-grid">
          <!-- Top Timeline Header Bar (Interactive Scrubbing Ruler) -->
          <rect
            :x="LEFT_GUTTER"
            y="0"
            :width="BASE_TIMELINE_WIDTH * 4"
            :height="HEADER_HEIGHT"
            fill="rgba(15, 23, 42, 0.45)"
            class="cursor-ew-resize"
            @pointerdown="handleHeaderPointerDown"
          />

          <!-- Vertical Grid Lines & Date Labels -->
          <g
            v-for="marker in dateGridMarkers"
            :key="marker.timestamp"
            class="pointer-events-none"
          >
            <line
              :x1="marker.x"
              :y1="0"
              :x2="marker.x"
              :y2="totalHeight"
              stroke="rgba(255, 255, 255, 0.05)"
              stroke-width="1"
              stroke-dasharray="4 4"
            />
            <text
              :x="marker.x"
              :y="HEADER_HEIGHT - 12"
              text-anchor="middle"
              class="fill-neutral-500 text-[10px] font-medium font-mono"
            >
              {{ marker.dateLabel }}
            </text>
          </g>
        </g>

        <!-- 2. Episode / Session LOD Aggregates (Proposal 1) -->
        <g class="episodes">
          <g
            v-for="ep in episodes"
            :key="ep.id"
            class="group cursor-pointer"
            @click="frameEpisode(ep)"
          >
            <!-- Episode Bar pill in Header -->
            <rect
              :x="timeToScreenX(ep.startTime)"
              y="6"
              :width="Math.max(28, timeToScreenX(ep.endTime) - timeToScreenX(ep.startTime))"
              height="20"
              rx="10"
              fill="rgba(56, 189, 248, 0.12)"
              stroke="rgba(56, 189, 248, 0.3)"
              stroke-width="1"
              class="transition-colors group-hover:fill-sky-500/25 group-hover:stroke-sky-400"
            />
            <text
              v-if="timeToScreenX(ep.endTime) - timeToScreenX(ep.startTime) > 70"
              :x="(timeToScreenX(ep.startTime) + timeToScreenX(ep.endTime)) / 2"
              y="20"
              text-anchor="middle"
              class="pointer-events-none fill-sky-300 text-[9px] font-semibold tracking-tight font-mono"
            >
              {{ ep.label }} · {{ ep.entitiesCount }}e · {{ ep.turnsCount }}t
            </text>
          </g>
        </g>

        <!-- 3. Horizontal Lane Dividers -->
        <g class="lanes pointer-events-none">
          <g
            v-for="(lane, idx) in LANE_CATEGORIES"
            :key="lane.type"
          >
            <!-- Lane Track Background Band -->
            <rect
              :x="LEFT_GUTTER"
              :y="HEADER_HEIGHT + idx * LANE_HEIGHT"
              :width="BASE_TIMELINE_WIDTH * 4"
              :height="LANE_HEIGHT"
              :fill="idx % 2 === 0 ? 'rgba(255, 255, 255, 0.012)' : 'transparent'"
            />
            <!-- Lane Divider Line -->
            <line
              :x1="LEFT_GUTTER"
              :y1="HEADER_HEIGHT + idx * LANE_HEIGHT"
              :x2="LEFT_GUTTER + BASE_TIMELINE_WIDTH * 4"
              :y2="HEADER_HEIGHT + idx * LANE_HEIGHT"
              stroke="rgba(255, 255, 255, 0.06)"
              stroke-width="1"
            />
          </g>
        </g>

        <!-- 4. Focused Entity Lifeline Filaments (Proposal 1 & 2 - only for selected/hovered) -->
        <g class="lifelines pointer-events-none">
          <g
            v-for="line in entityLifelines"
            :key="line.entityId"
          >
            <line
              v-if="line.endX > line.startX"
              :x1="line.startX"
              :y1="line.y"
              :x2="line.endX"
              :y2="line.y"
              :stroke="line.color"
              stroke-width="2.5"
              stroke-opacity="0.8"
              stroke-dasharray="3 3"
              filter="url(#timeline-glow)"
            />
          </g>
        </g>

        <!-- 5. Entity Mention Micro-Beads (Proposal 2 & 3) -->
        <g class="beads">
          <g
            v-for="bead in packedTimeline.beads"
            :key="bead.id"
            :transform="`translate(${bead.x}, ${bead.y})`"
            class="group cursor-pointer"
            @mouseenter="handleBeadMouseEnter($event, bead)"
            @mousemove="updateTooltipPosition"
            @mouseleave="handlePointerLeave"
            @click="handleBeadClick(bead)"
          >
            <!-- Large Invisible Hit-Target (Proposal 2: 14px radius) -->
            <circle
              r="14"
              fill="transparent"
            />

            <!-- Selection / Hover Pulse Aura -->
            <circle
              :r="bead.radius + 6"
              :fill="bead.color"
              :class="[
                'blur-xs transition-opacity duration-200 pointer-events-none',
                selectedEntityId === bead.entityId ? 'opacity-90' : 'opacity-0 group-hover:opacity-50',
              ]"
            />

            <!-- Main Micro-Bead Dot -->
            <circle
              :r="bead.radius"
              :fill="bead.color"
              fill-opacity="0.9"
              :stroke="selectedEntityId === bead.entityId ? '#ffffff' : 'rgba(255, 255, 255, 0.4)'"
              :stroke-width="selectedEntityId === bead.entityId ? 2 : (bead.isFirstSeen ? 1.5 : 0.75)"
              class="transition-transform duration-150 group-hover:scale-125"
            />

            <!-- First Encounter Inner Spark Dot -->
            <circle
              v-if="bead.isFirstSeen"
              r="1.8"
              fill="#ffffff"
              class="pointer-events-none"
            />

            <!-- Culled Screen-Space Entity Label (Proposal 3) -->
            <text
              v-if="bead.showLabel"
              :x="bead.radius + 6"
              dy="4"
              class="pointer-events-none select-none fill-neutral-100 text-[13px] font-bold tracking-tight font-sans drop-shadow-md group-hover:fill-white"
            >
              {{ bead.label }}
            </text>
          </g>

          <!-- 6. Overflow Indicator Badges (+N) -->
          <g
            v-for="cluster in packedTimeline.overflowClusters"
            :key="cluster.id"
            :transform="`translate(${cluster.x}, ${cluster.y})`"
            class="group cursor-pointer"
            @mouseenter="handleClusterMouseEnter($event, cluster)"
            @mousemove="updateTooltipPosition"
            @mouseleave="handlePointerLeave"
          >
            <!-- Overflow Capsule Pill -->
            <rect
              x="-14"
              y="-10"
              width="28"
              height="20"
              rx="10"
              fill="rgba(30, 41, 59, 0.85)"
              stroke="rgba(148, 163, 184, 0.4)"
              stroke-width="1"
              class="transition-all duration-200 group-hover:fill-neutral-800 group-hover:stroke-sky-400"
            />
            <text
              text-anchor="middle"
              dy="3.5"
              class="pointer-events-none select-none fill-sky-300 text-[10px] font-bold font-mono"
            >
              +{{ cluster.count }}
            </text>
          </g>
        </g>

        <!-- 7. Interactive Playhead Indicator & Drag Handle -->
        <g
          class="playhead cursor-ew-resize"
          @pointerdown="handleHeaderPointerDown"
        >
          <!-- Wide hit-box for dragging playhead -->
          <rect
            :x="playheadX - 16"
            y="0"
            width="32"
            :height="HEADER_HEIGHT"
            fill="transparent"
          />
          <line
            :x1="playheadX"
            :y1="0"
            :x2="playheadX"
            :y2="totalHeight"
            stroke="#06b6d4"
            stroke-width="2"
            stroke-dasharray="6 3"
            filter="url(#timeline-glow)"
            class="pointer-events-none"
          />
          <polygon
            :points="`${playheadX - 8},0 ${playheadX + 8},0 ${playheadX},14`"
            fill="#06b6d4"
            class="drop-shadow-md transition-transform hover:scale-125"
          />
        </g>
      </g>
    </svg>

    <!-- Floating Bead Tooltip on Hover (Clamped to viewport) -->
    <Transition name="fade">
      <div
        v-if="hoveredBead"
        class="pointer-events-none fixed z-50 max-w-sm border border-neutral-700/80 rounded-2xl bg-neutral-900/95 p-3.5 shadow-2xl backdrop-blur-md"
        :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
      >
        <div class="flex items-center justify-between gap-3 text-xs">
          <span
            class="rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
            :style="{ backgroundColor: `${hoveredBead.color}25`, color: hoveredBead.color }"
          >
            {{ hoveredBead.type }}
          </span>
          <span class="text-[10px] text-neutral-400 font-mono">
            {{ new Date(hoveredBead.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
          </span>
        </div>

        <div class="mt-1.5 text-sm text-neutral-100 font-bold">
          {{ hoveredBead.label }}
          <span v-if="hoveredBead.isFirstSeen" class="ml-1.5 rounded bg-primary-500/20 px-1.5 py-0.5 text-[9px] text-primary-300 font-normal">
            First Encounter
          </span>
        </div>

        <div
          v-if="hoveredBead.turnSnippet"
          class="line-clamp-3 mt-2 border border-neutral-800/80 rounded-lg bg-neutral-950/70 p-2 text-xs text-neutral-300 leading-relaxed italic"
        >
          "{{ hoveredBead.turnSnippet }}"
        </div>

        <div class="mt-2 flex items-center gap-1.5 text-[10px] text-neutral-400">
          <div class="i-solar:cursor-bold text-xs text-primary-400" />
          <span>Click to open entity & dialogue turns</span>
        </div>
      </div>
    </Transition>

    <!-- Floating Cluster Popover on Hover -->
    <Transition name="fade">
      <div
        v-if="hoveredCluster"
        class="pointer-events-auto fixed z-50 max-w-xs border border-neutral-700/80 rounded-2xl bg-neutral-900/95 p-3 shadow-2xl backdrop-blur-md"
        :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
        @mouseleave="handlePointerLeave"
      >
        <div class="flex items-center justify-between border-b border-neutral-800/80 pb-1.5 text-xs">
          <span class="text-[11px] text-neutral-300 font-bold">
            {{ hoveredCluster.count }} Coincident Entities
          </span>
          <span class="text-[10px] text-neutral-500 uppercase">Lane Stack</span>
        </div>
        <div class="mt-2 max-h-48 flex flex-col gap-1 overflow-y-auto pr-1">
          <button
            v-for="ent in hoveredCluster.entities"
            :key="ent.id"
            type="button"
            class="flex items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition hover:bg-neutral-800"
            @click="handleClusterSelect(ent.id)"
          >
            <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: ent.color }" />
            <span class="truncate text-neutral-200 font-medium">{{ ent.label }}</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Floating Canvas Navigation Controls (Bottom Right) -->
    <div class="fixed bottom-14 right-5 z-30 flex flex-col gap-1.5 border border-neutral-800/80 rounded-2xl bg-neutral-900/85 p-1.5 shadow-xl backdrop-blur-md">
      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
        title="Zoom In Time"
        @click="zoomIn"
      >
        <div class="i-solar:magnifer-zoom-in-bold text-base" />
      </button>

      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
        title="Zoom Out Time"
        @click="zoomOut"
      >
        <div class="i-solar:magnifer-zoom-out-bold text-base" />
      </button>

      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
        title="Focus Scrubber Time"
        @click="fitToPlayhead()"
      >
        <div class="i-solar:target-bold text-base" />
      </button>

      <!-- Follow Scrubber Toggle (Proposal 5) -->
      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded-xl transition"
        :class="[
          isFollowScrubber
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
            : 'text-neutral-400 hover:bg-neutral-800 hover:text-white',
        ]"
        :title="isFollowScrubber ? 'Follow Scrubber Active (Click to Pause)' : 'Resume Following Scrubber'"
        @click="toggleFollowScrubber"
      >
        <div class="i-solar:radar-bold text-base" />
      </button>

      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
        title="Reset Timeline Zoom"
        @click="resetZoom"
      >
        <div class="i-solar:restart-square-bold text-base" />
      </button>
    </div>
  </div>
</template>
