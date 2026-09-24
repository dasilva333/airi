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

const props = defineProps<{
  entities: TimelineEntityItem[]
  claims: TimelineClaimItem[]
  sources: SourceRecord[]
  selectedEntityId: string | null
  currentScrubTimestamp: number
  minTimestamp: number
  maxTimestamp: number
}>()

const emit = defineEmits<{
  (e: 'selectEntity', entityId: string): void
  (e: 'update:currentScrubTimestamp', value: number): void
}>()

const svgRef = ref<SVGSVGElement | null>(null)

const canvasWidth = ref(1200)
const canvasHeight = ref(600)
const currentTransform = ref<ZoomTransform>(zoomIdentity)

const LANE_CATEGORIES: { type: EntityType, label: string, color: string, icon: string }[] = [
  { type: 'person', label: 'People & Characters', color: '#38bdf8', icon: 'i-solar:users-group-two-rounded-bold-duotone' },
  { type: 'place', label: 'Places & Environments', color: '#34d399', icon: 'i-solar:map-point-wave-bold-duotone' },
  { type: 'organization', label: 'Factions & Organizations', color: '#c084fc', icon: 'i-solar:buildings-2-bold-duotone' },
  { type: 'concept', label: 'Concepts & Theories', color: '#f472b6', icon: 'i-solar:atom-bold-duotone' },
  { type: 'activity', label: 'Activities & Events', color: '#fbbf24', icon: 'i-solar:calendar-date-bold-duotone' },
  { type: 'animal', label: 'Creatures & Entities', color: '#2dd4bf', icon: 'i-solar:cat-bold-duotone' },
]

// Lane metrics
const LANE_HEIGHT = 90
const HEADER_HEIGHT = 40
const LEFT_GUTTER = 180
const BASE_TIMELINE_WIDTH = 2400

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

// Calculate time to X coordinate
function timeToX(ts: number): number {
  const range = Math.max(1, props.maxTimestamp - props.minTimestamp)
  const progress = Math.min(1, Math.max(0, (ts - props.minTimestamp) / range))
  const unscaledX = LEFT_GUTTER + progress * BASE_TIMELINE_WIDTH
  return currentTransform.value.applyX(unscaledX)
}

// Flatten entities into timeline representations
interface TimelineMentionBead {
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
}

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

const entityLifelines = computed<EntityLifeline[]>(() => {
  const result: EntityLifeline[] = []

  for (const ent of props.entities) {
    if (ent.firstSeenTimestamp > props.currentScrubTimestamp)
      continue

    // Find all mentions for this entity
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

    result.push({
      entityId: ent.id,
      label: ent.label,
      type: ent.type,
      color: categoryInfo?.color || '#9ca3af',
      startX: timeToX(minTs),
      endX: timeToX(maxTs),
      y,
      mentionsCount: mentions.length,
    })
  }

  return result
})

const timelineBeads = computed<TimelineMentionBead[]>(() => {
  const beads: TimelineMentionBead[] = []

  for (const ent of props.entities) {
    if (ent.firstSeenTimestamp > props.currentScrubTimestamp)
      continue

    const categoryInfo = LANE_CATEGORIES.find(l => l.type === ent.type)
    const color = categoryInfo?.color || '#9ca3af'
    const baseY = getLaneY(ent.type)

    // Gather turns mentioning this entity
    const relevantTurns: SourceRecord[] = []
    for (const turnId of ent.mentions) {
      const src = sourceMap.value.get(turnId)
      if (src && src.timestamp <= props.currentScrubTimestamp) {
        relevantTurns.push(src)
      }
    }

    if (relevantTurns.length === 0) {
      // Create at least one bead for first encounter
      beads.push({
        id: `${ent.id}-first`,
        entityId: ent.id,
        label: ent.label,
        type: ent.type,
        timestamp: ent.firstSeenTimestamp,
        isFirstSeen: true,
        x: timeToX(ent.firstSeenTimestamp),
        y: baseY,
        radius: Math.min(22, Math.max(9, 9 + Math.log2(ent.mentionsCount + 1) * 3)),
        color,
      })
    }
    else {
      // Sort turns chronologically
      relevantTurns.sort((a, b) => a.timestamp - b.timestamp)

      relevantTurns.forEach((turn, idx) => {
        // Vertical staggering if multiple turns are close
        const offset = (idx % 3 - 1) * 16
        const isFirst = idx === 0

        beads.push({
          id: `${ent.id}-${turn.turnId}`,
          entityId: ent.id,
          label: ent.label,
          type: ent.type,
          timestamp: turn.timestamp,
          turnSnippet: turn.text,
          turnId: turn.turnId,
          isFirstSeen: isFirst,
          x: timeToX(turn.timestamp),
          y: baseY + offset,
          radius: isFirst
            ? Math.min(24, Math.max(10, 10 + Math.log2(ent.mentionsCount + 1) * 3.5))
            : Math.min(14, Math.max(6, 6 + Math.log2(ent.mentionsCount + 1) * 2)),
          color,
        })
      })
    }
  }

  return beads
})

// Date grid lines along X
const dateGridMarkers = computed(() => {
  const markers: { timestamp: number, dateLabel: string, x: number }[] = []
  const start = props.minTimestamp
  const end = props.maxTimestamp
  const dayMs = 24 * 60 * 60 * 1000

  // If spans multiple days, step per day; if single day, step per 4 hours
  const totalDays = Math.ceil((end - start) / dayMs)
  const stepMs = totalDays > 14 ? dayMs * 2 : (totalDays > 3 ? dayMs : 4 * 60 * 60 * 1000)

  let curr = Math.floor(start / stepMs) * stepMs
  while (curr <= end + stepMs) {
    if (curr >= start - stepMs / 2) {
      const d = new Date(curr)
      const dateLabel = totalDays <= 3
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' })

      markers.push({
        timestamp: curr,
        dateLabel,
        x: timeToX(curr),
      })
    }
    curr += stepMs
  }

  return markers
})

// Hover Tooltip State
const hoveredBead = ref<TimelineMentionBead | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)

function handleBeadMouseEnter(e: MouseEvent, bead: TimelineMentionBead) {
  hoveredBead.value = bead
  tooltipX.value = e.clientX + 14
  tooltipY.value = e.clientY + 14
}

function handleBeadMouseMove(e: MouseEvent) {
  tooltipX.value = e.clientX + 14
  tooltipY.value = e.clientY + 14
}

function handleBeadMouseLeave() {
  hoveredBead.value = null
}

function handleBeadClick(bead: TimelineMentionBead) {
  emit('selectEntity', bead.entityId)
}

// Playhead X position
const playheadX = computed(() => timeToX(props.currentScrubTimestamp))

// Zoom & Pan setup
let zoomHandler: any = null

function setupZoom() {
  if (!svgRef.value)
    return

  const rect = svgRef.value.getBoundingClientRect()
  if (rect.width > 0)
    canvasWidth.value = rect.width
  if (rect.height > 0)
    canvasHeight.value = rect.height

  zoomHandler = zoom()
    .scaleExtent([0.3, 10])
    .on('zoom', (event) => {
      currentTransform.value = event.transform
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
    select(svgRef.value).call(zoomHandler.transform, zoomIdentity)
  }
}

function fitToPlayhead() {
  if (!svgRef.value || !zoomHandler)
    return

  const targetX = timeToX(props.currentScrubTimestamp)
  const currentScale = currentTransform.value.k
  const targetTransform = zoomIdentity
    .translate(canvasWidth.value / 2 - targetX * currentScale, 0)
    .scale(currentScale)

  select(svgRef.value).call(zoomHandler.transform, targetTransform)
}

onMounted(async () => {
  await nextTick()
  setupZoom()
  window.addEventListener('resize', setupZoom)
})

onUnmounted(() => {
  window.removeEventListener('resize', setupZoom)
})

watch(() => [props.minTimestamp, props.maxTimestamp], () => {
  setupZoom()
})
</script>

<template>
  <div class="relative h-full w-full select-none overflow-hidden bg-neutral-950 text-neutral-100">
    <!-- Sticky Left Category Sidebar -->
    <div class="pointer-events-none absolute bottom-0 left-0 top-0 z-20 w-[180px] border-r border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md">
      <!-- Header Spacer -->
      <div class="h-[40px] flex items-center border-b border-neutral-800/60 px-3">
        <span class="text-[10px] text-neutral-500 font-bold tracking-wider uppercase">Categories</span>
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
      class="h-full w-full cursor-grab active:cursor-grabbing"
    >
      <defs>
        <!-- Soft Neon Glow Filter -->
        <filter id="timeline-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Pannable / Zoomable Content Group -->
      <g>
        <!-- 1. Background Date Columns & Header -->
        <g class="date-grid">
          <!-- Top Timeline Header Bar -->
          <rect
            :x="LEFT_GUTTER"
            y="0"
            :width="BASE_TIMELINE_WIDTH * 4"
            :height="HEADER_HEIGHT"
            fill="rgba(15, 23, 42, 0.4)"
            class="pointer-events-none"
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

        <!-- 2. Horizontal Lane Dividers -->
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
              :fill="idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent'"
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

        <!-- 3. Entity Lifeline Filaments -->
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
              stroke-width="2"
              stroke-opacity="0.35"
              stroke-dasharray="2 3"
            />
          </g>
        </g>

        <!-- 4. Entity Mention Beads / Circles -->
        <g class="beads">
          <g
            v-for="bead in timelineBeads"
            :key="bead.id"
            :transform="`translate(${bead.x}, ${bead.y})`"
            class="group cursor-pointer"
            @mouseenter="handleBeadMouseEnter($event, bead)"
            @mousemove="handleBeadMouseMove($event)"
            @mouseleave="handleBeadMouseLeave"
            @click="handleBeadClick(bead)"
          >
            <!-- Selection / Hover Pulse Aura -->
            <circle
              :r="bead.radius + 6"
              :fill="bead.color"
              :class="[
                'blur-xs transition-opacity duration-200',
                selectedEntityId === bead.entityId ? 'opacity-80' : 'opacity-0 group-hover:opacity-40',
              ]"
            />

            <!-- Main Bead Circle -->
            <circle
              :r="bead.radius"
              :fill="bead.color"
              fill-opacity="0.85"
              :stroke="selectedEntityId === bead.entityId ? '#ffffff' : 'rgba(255, 255, 255, 0.3)'"
              :stroke-width="selectedEntityId === bead.entityId ? 2.5 : (bead.isFirstSeen ? 1.5 : 1)"
              class="transition-transform duration-150 group-hover:scale-110"
            />

            <!-- First Encounter Star Icon or Inner Dot -->
            <circle
              v-if="bead.isFirstSeen"
              r="2.5"
              fill="#ffffff"
            />

            <!-- Entity Label beside primary/first bead -->
            <text
              v-if="bead.isFirstSeen"
              :x="bead.radius + 8"
              dy="3.5"
              class="pointer-events-none select-none fill-neutral-200 text-[11px] font-semibold tracking-wide font-sans drop-shadow-md group-hover:fill-white"
            >
              {{ bead.label }}
            </text>
          </g>
        </g>

        <!-- 5. Interactive Playhead Indicator -->
        <g class="playhead pointer-events-none">
          <line
            :x1="playheadX"
            :y1="0"
            :x2="playheadX"
            :y2="totalHeight"
            stroke="#06b6d4"
            stroke-width="2"
            stroke-dasharray="6 3"
            filter="url(#timeline-glow)"
          />
          <polygon
            :points="`${playheadX - 6},0 ${playheadX + 6},0 ${playheadX},10`"
            fill="#06b6d4"
          />
        </g>
      </g>
    </svg>

    <!-- Floating Quick Tooltip on Hover -->
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
        </div>

        <div
          v-if="hoveredBead.turnSnippet"
          class="line-clamp-3 mt-2 border border-neutral-800/80 rounded-lg bg-neutral-950/70 p-2 text-xs text-neutral-300 leading-relaxed italic"
        >
          "{{ hoveredBead.turnSnippet }}"
        </div>

        <div class="mt-2 flex items-center gap-1.5 text-[10px] text-neutral-400">
          <div class="i-solar:cursor-bold text-xs text-primary-400" />
          <span>Click to inspect entity & dialogue turns</span>
        </div>
      </div>
    </Transition>

    <!-- Floating Canvas Navigation Controls (Bottom Right) -->
    <div class="absolute bottom-5 right-5 z-20 flex flex-col gap-1.5 border border-neutral-800/80 rounded-2xl bg-neutral-900/80 p-1.5 shadow-xl backdrop-blur-md">
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
        @click="fitToPlayhead"
      >
        <div class="i-solar:target-bold text-base" />
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
