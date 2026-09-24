<script setup lang="ts">
import type { EntityType } from '@proj-airi/stage-ui/libs/search/entity-ledger'
import type { Simulation, SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'
import type { ZoomTransform } from 'd3-zoom'

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,

} from 'd3-force'
import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

export interface GraphNode extends SimulationNodeDatum {
  id: string
  label: string
  type: EntityType
  mentionsCount: number
  firstSeenTimestamp: number
  radius: number
  mentions?: string[]
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  predicate: string
  isSuperseded?: boolean
}

const props = defineProps<{
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedEntityId: string | null
  currentScrubTimestamp: number
}>()

const emit = defineEmits<{
  (e: 'selectEntity', entityId: string): void
}>()

const svgRef = ref<SVGSVGElement | null>(null)
const width = ref(1000)
const height = ref(700)
const currentZoom = ref<ZoomTransform>(zoomIdentity)

// Persistent cache so nodes don't bounce wildly on scrub changes
const positionCache = new Map<string, { x: number, y: number, vx?: number, vy?: number }>()

// Reactive rendered data updated on simulation tick
const renderedNodes = shallowRef<GraphNode[]>([])
const renderedEdges = shallowRef<GraphEdge[]>([])

let simulation: Simulation<GraphNode, GraphEdge> | null = null
let zoomBehavior: any = null

// Filter nodes by scrub timestamp
const timeVisibleNodes = computed(() => {
  return props.nodes.filter(n => n.firstSeenTimestamp <= props.currentScrubTimestamp)
})

const visibleNodeIds = computed(() => new Set(timeVisibleNodes.value.map(n => n.id)))

const timeVisibleEdges = computed(() => {
  return props.edges.filter((e) => {
    const srcId = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
    const tgtId = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
    return visibleNodeIds.value.has(srcId) && visibleNodeIds.value.has(tgtId)
  })
})

function nodeColor(type: EntityType): string {
  switch (type) {
    case 'person': return '#38bdf8' // sky-400
    case 'place': return '#34d399' // emerald-400
    case 'organization': return '#c084fc' // purple-400
    case 'activity': return '#fbbf24' // amber-400
    case 'concept': return '#f472b6' // pink-400
    case 'animal': return '#2dd4bf' // teal-400
    default: return '#9ca3af' // neutral-400
  }
}

function initSimulation() {
  if (!svgRef.value)
    return

  const rect = svgRef.value.getBoundingClientRect()
  if (rect.width > 0)
    width.value = rect.width
  if (rect.height > 0)
    height.value = rect.height

  if (simulation) {
    simulation.stop()
  }

  const centerX = width.value / 2
  const centerY = height.value / 2

  // Prepare simNodes using cached positions or radial seed
  const count = timeVisibleNodes.value.length
  const simNodes: GraphNode[] = timeVisibleNodes.value.map((n, idx) => {
    const cached = positionCache.get(n.id)
    if (cached) {
      return {
        ...n,
        x: cached.x,
        y: cached.y,
        vx: cached.vx,
        vy: cached.vy,
      }
    }

    // Seed in an organic spiral/cloud around center
    const angle = (idx / Math.max(1, count)) * Math.PI * 2 * 3.5 + Math.random() * 0.4
    const radiusDist = 40 + Math.sqrt((idx + 1) / Math.max(1, count)) * (Math.min(width.value, height.value) * 0.38)
    return {
      ...n,
      x: centerX + Math.cos(angle) * radiusDist,
      y: centerY + Math.sin(angle) * radiusDist,
    }
  })

  // Prepare simEdges referencing simNodes
  const nodeMap = new Map(simNodes.map(n => [n.id, n]))
  const simEdges: GraphEdge[] = []
  for (const e of timeVisibleEdges.value) {
    const srcId = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
    const tgtId = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
    const srcNode = nodeMap.get(srcId)
    const tgtNode = nodeMap.get(tgtId)
    if (srcNode && tgtNode) {
      simEdges.push({
        ...e,
        source: srcNode,
        target: tgtNode,
      })
    }
  }

  // Immediately publish initial positions
  renderedNodes.value = simNodes
  renderedEdges.value = simEdges

  simulation = forceSimulation<GraphNode>(simNodes)
    .force('link', forceLink<GraphNode, GraphEdge>(simEdges).id(d => d.id).distance(140).strength(0.35))
    .force('charge', forceManyBody().strength(-320).distanceMax(700))
    .force('collide', forceCollide<GraphNode>().radius(d => d.radius + 16).iterations(3))
    .force('center', forceCenter(centerX, centerY).strength(0.04))
    .alpha(0.6)
    .alphaDecay(0.025)

  simulation.on('tick', () => {
    for (const n of simNodes) {
      if (n.x !== undefined && n.y !== undefined) {
        positionCache.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy })
      }
    }
    renderedNodes.value = [...simNodes]
    renderedEdges.value = [...simEdges]
  })

  // Setup d3-zoom if not initialized
  if (!zoomBehavior) {
    zoomBehavior = zoom()
      .scaleExtent([0.15, 5])
      .on('zoom', (event) => {
        currentZoom.value = event.transform
      })

    select(svgRef.value).call(zoomBehavior)
  }
}

// Drag & Drop Nodes Support
let draggedNode: GraphNode | null = null

function handlePointerDown(e: PointerEvent, node: GraphNode) {
  if (e.button !== 0)
    return
  e.stopPropagation()
  draggedNode = node
  node.fx = node.x
  node.fy = node.y
  simulation?.alphaTarget(0.2).restart()
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
}

function handlePointerMove(e: PointerEvent) {
  if (!draggedNode || !svgRef.value)
    return
  const rect = svgRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  // Invert current zoom transform to get simulation coordinates
  const [simX, simY] = currentZoom.value.invert([mouseX, mouseY])
  draggedNode.fx = simX
  draggedNode.fy = simY
}

function handlePointerUp() {
  if (draggedNode) {
    draggedNode.fx = null
    draggedNode.fy = null
    draggedNode = null
    simulation?.alphaTarget(0)
  }
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
}

function handleNodeClick(node: GraphNode) {
  emit('selectEntity', node.id)
}

function zoomIn() {
  if (svgRef.value && zoomBehavior) {
    select(svgRef.value).call(zoomBehavior.scaleBy, 1.3)
  }
}

function zoomOut() {
  if (svgRef.value && zoomBehavior) {
    select(svgRef.value).call(zoomBehavior.scaleBy, 0.75)
  }
}

function resetZoom() {
  if (svgRef.value && zoomBehavior) {
    select(svgRef.value).call(zoomBehavior.transform, zoomIdentity)
  }
}

function fitView() {
  if (!svgRef.value || !renderedNodes.value.length || !zoomBehavior)
    return

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const n of renderedNodes.value) {
    if (n.x !== undefined && n.y !== undefined) {
      minX = Math.min(minX, n.x - n.radius)
      maxX = Math.max(maxX, n.x + n.radius)
      minY = Math.min(minY, n.y - n.radius)
      maxY = Math.max(maxY, n.y + n.radius)
    }
  }

  if (!Number.isFinite(minX) || minX === maxX) {
    resetZoom()
    return
  }

  const padding = 80
  const graphWidth = maxX - minX + padding * 2
  const graphHeight = maxY - minY + padding * 2

  const scale = Math.min(2.0, Math.max(0.2, Math.min(width.value / graphWidth, height.value / graphHeight)))
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  const transform = zoomIdentity
    .translate(width.value / 2 - midX * scale, height.value / 2 - midY * scale)
    .scale(scale)

  select(svgRef.value).call(zoomBehavior.transform, transform)
}

watch(
  () => [props.nodes.length, props.edges.length, props.currentScrubTimestamp],
  () => {
    initSimulation()
  },
  { deep: false },
)

onMounted(async () => {
  await nextTick()
  initSimulation()
  window.addEventListener('resize', initSimulation)
})

onUnmounted(() => {
  if (simulation) {
    simulation.stop()
  }
  window.removeEventListener('resize', initSimulation)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
})
</script>

<template>
  <div class="relative h-full w-full select-none overflow-hidden bg-neutral-950">
    <!-- Ambient Constellation Grid Background -->
    <div class="[background-image:radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none absolute inset-0 opacity-20" />

    <!-- SVG Canvas -->
    <svg
      ref="svgRef"
      class="h-full w-full cursor-grab active:cursor-grabbing"
    >
      <defs>
        <!-- Soft Neon Glow Filter -->
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <!-- Arrowhead Marker for Directed Claims -->
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="22"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="rgba(148, 163, 184, 0.45)" />
        </marker>
      </defs>

      <!-- Zoomable / Pannable Root Group -->
      <g :transform="currentZoom.toString()">
        <!-- Edges Group -->
        <g class="edges">
          <g
            v-for="edge in renderedEdges"
            :key="edge.id"
            class="transition-opacity duration-300"
          >
            <line
              :x1="typeof edge.source === 'object' ? (edge.source as GraphNode).x : 0"
              :y1="typeof edge.source === 'object' ? (edge.source as GraphNode).y : 0"
              :x2="typeof edge.target === 'object' ? (edge.target as GraphNode).x : 0"
              :y2="typeof edge.target === 'object' ? (edge.target as GraphNode).y : 0"
              :stroke="edge.isSuperseded ? '#f59e0b' : 'rgba(148, 163, 184, 0.28)'"
              :stroke-dasharray="edge.isSuperseded ? '5 4' : undefined"
              stroke-width="1.5"
              marker-end="url(#arrow)"
            />
            <!-- Predicate Label -->
            <g
              v-if="edge.predicate"
              :transform="`translate(${((typeof edge.source === 'object' ? (edge.source as GraphNode).x || 0 : 0) + (typeof edge.target === 'object' ? (edge.target as GraphNode).x || 0 : 0)) / 2}, ${((typeof edge.source === 'object' ? (edge.source as GraphNode).y || 0 : 0) + (typeof edge.target === 'object' ? (edge.target as GraphNode).y || 0 : 0)) / 2})`"
              class="cursor-pointer"
            >
              <rect
                x="-24"
                y="-9"
                width="48"
                height="14"
                rx="4"
                fill="rgba(15, 23, 42, 0.85)"
                stroke="rgba(148, 163, 184, 0.2)"
                stroke-width="0.75"
              />
              <text
                text-anchor="middle"
                dy="2"
                class="pointer-events-none select-none fill-neutral-400 text-[9px] font-medium font-mono"
              >
                {{ edge.predicate }}
              </text>
            </g>
          </g>
        </g>

        <!-- Nodes Group -->
        <g class="nodes">
          <g
            v-for="node in renderedNodes"
            :key="node.id"
            :transform="`translate(${node.x || 0}, ${node.y || 0})`"
            class="group cursor-pointer"
            @pointerdown="handlePointerDown($event, node)"
            @click="handleNodeClick(node)"
          >
            <!-- Glowing Selection / Hover Aura -->
            <circle
              :r="node.radius + 8"
              :fill="nodeColor(node.type)"
              :class="[
                'blur-xs transition-opacity duration-300',
                selectedEntityId === node.id ? 'opacity-70' : 'opacity-0 group-hover:opacity-40',
              ]"
            />

            <!-- Outer Orbit Ring for Multi-Mention Entities -->
            <circle
              v-if="node.mentionsCount > 3"
              :r="node.radius + 4"
              fill="none"
              :stroke="nodeColor(node.type)"
              stroke-opacity="0.3"
              stroke-width="1"
              stroke-dasharray="3 3"
            />

            <!-- Main Entity Circle -->
            <circle
              :r="node.radius"
              :fill="nodeColor(node.type)"
              fill-opacity="0.85"
              :stroke="selectedEntityId === node.id ? '#ffffff' : 'rgba(255, 255, 255, 0.25)'"
              :stroke-width="selectedEntityId === node.id ? 2.5 : 1"
              class="transition-transform duration-200 group-hover:scale-105"
            />

            <!-- Entity Label -->
            <text
              text-anchor="middle"
              :dy="node.radius + 14"
              class="pointer-events-none select-none fill-neutral-200 text-[11px] font-semibold tracking-wide font-sans drop-shadow-md group-hover:fill-white"
            >
              {{ node.label }}
            </text>

            <!-- Small Mention Badge inside large nodes -->
            <text
              v-if="node.radius >= 20"
              text-anchor="middle"
              dy="3.5"
              class="pointer-events-none select-none fill-neutral-950 text-[10px] font-bold font-sans"
            >
              {{ node.mentionsCount }}
            </text>
          </g>
        </g>
      </g>
    </svg>

    <!-- Floating Canvas Controls (Bottom Right) -->
    <div class="absolute bottom-5 right-5 flex flex-col gap-1.5 border border-neutral-800/80 rounded-2xl bg-neutral-900/80 p-1.5 shadow-xl backdrop-blur-md">
      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
        title="Zoom In"
        @click="zoomIn"
      >
        <div class="i-solar:magnifer-zoom-in-bold text-base" />
      </button>

      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
        title="Zoom Out"
        @click="zoomOut"
      >
        <div class="i-solar:magnifer-zoom-out-bold text-base" />
      </button>

      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
        title="Fit to View"
        @click="fitView"
      >
        <div class="i-solar:maximize-square-minimalistic-bold text-base" />
      </button>

      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
        title="Reset Zoom"
        @click="resetZoom"
      >
        <div class="i-solar:restart-square-bold text-base" />
      </button>
    </div>
  </div>
</template>
