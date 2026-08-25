<script setup lang="ts">
import {
  clampRadialMenuPosition,
  computeParallaxTilt,
  computePolarLayout,
  describeAnnularSector,
  getHoveredSliceIndex,
} from '@proj-airi/stage-shared'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useControlStripAction } from '../../composables/use-control-strip-action'
import { useSettingsControlStrip } from '../../stores/settings/control-strip'

export interface HeadPoseData {
  screenX: number
  screenY: number
  yaw: number
  pitch: number
  roll: number
  modelHeightPx: number
}

interface RadialWedgeDef {
  id: 'size' | 'align' | 'mode' | 'layers' | 'hide' | 'monitor'
  icon: string
  label: string
  color: string
}

interface ModeSliceDef {
  id: 'tactileMode' | 'orbitMode' | 'dragMode' | 'positionMode'
  label: string
  sub: string
  icon: string
  action: 'viewport-tactile' | 'viewport-orbit' | 'viewport-drag' | 'viewport-positioning'
  active: boolean
}

interface SizePresetDef {
  id: 'mini' | 'medium' | 'large' | 'full'
  label: string
  sub: string
  icon: string
}

interface AlignSliceDef {
  id: string
  icon: string
  label: string
}

const props = withDefaults(defineProps<{
  open?: boolean
  sceneRef?: { getHeadPose?: () => HeadPoseData | null | undefined } | null
  live2dSceneRef?: any
  stageModelRenderer?: string
  showBackground?: boolean
  showModel?: boolean
  monitorCount?: number
  activeMonitor?: number
}>(), {
  open: false,
  stageModelRenderer: 'vrm',
  showBackground: true,
  showModel: true,
  monitorCount: 1,
  activeMonitor: 1,
})

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'update:showBackground', val: boolean): void
  (e: 'update:showModel', val: boolean): void
  (e: 'apply-preset', preset: 'mini' | 'medium' | 'large' | 'full'): void
  (e: 'apply-alignment', alignment: string): void
  (e: 'hide-stage'): void
  (e: 'select-monitor', monitorId: number): void
}>()

const isOpen = ref(false)
const subMenuMode = ref<'none' | 'size' | 'align' | 'mode' | 'layers' | 'monitor'>('none')
const hoveredIndex = ref<number | null>(null)
const mouseRelX = ref(0)
const mouseRelY = ref(0)

const menuCenter = ref<{ x: number, y: number }>({ x: 150, y: 150 })
const containerBounds = ref<{ width: number, height: number }>({ width: 450, height: 600 })
const stageOverlayRef = ref<HTMLDivElement | null>(null)

const controlStripStore = useSettingsControlStrip()
const { dispatchAction } = useControlStripAction()

// ── Definitions for Root and Sub-Radial Wheels ────────────────────────────────

// 1. Root Menu: 6 Core Slices (or 5 when single display)
const MAIN_WEDGES: RadialWedgeDef[] = [
  { id: 'size', icon: 'i-solar:maximize-square-2-linear', label: 'Size', color: '#38BDF8' }, // Sky Blue
  { id: 'align', icon: 'i-ph:corners-out', label: 'Snap', color: '#A855F7' }, // Purple
  { id: 'mode', icon: 'i-ph:hand-pointing', label: 'Mode', color: '#10B981' }, // Emerald
  { id: 'layers', icon: 'i-ph:stack', label: 'Layers', color: '#EC4899' }, // Pink
  { id: 'hide', icon: 'i-ph:eye-slash', label: 'Hide', color: '#EF4444' }, // Red
  { id: 'monitor', icon: 'i-ph:desktop', label: 'Monitor', color: '#F59E0B' }, // Amber (multi-display only)
]

const activeMainWedges = computed(() => {
  if (props.monitorCount > 1)
    return MAIN_WEDGES
  // When single monitor, do not show monitor slice (redundant)
  return MAIN_WEDGES.filter(w => w.id !== 'monitor')
})

// 2. Mode Presets: 4 Radial Slices (90° each)
const MODE_SLICES = computed<ModeSliceDef[]>(() => [
  { id: 'tactileMode', label: 'Tactile', sub: 'Interact', icon: 'i-ph:sparkle', action: 'viewport-tactile', active: controlStripStore.stageMode === 'tactileMode' }, // 0° (Top)
  { id: 'orbitMode', label: 'Orbit', sub: '3D Rotate', icon: 'i-ph:arrows-clockwise', action: 'viewport-orbit', active: controlStripStore.stageMode === 'orbitMode' }, // 90° (Right)
  { id: 'dragMode', label: 'Pan', sub: 'Offset', icon: 'i-ph:hand-palm', action: 'viewport-drag', active: controlStripStore.stageMode === 'dragMode' }, // 180° (Bottom)
  { id: 'positionMode', label: 'Move', sub: 'Window Drag', icon: 'i-ph:app-window', action: 'viewport-positioning', active: controlStripStore.stageMode === 'positionMode' }, // 270° (Left)
])

// 3. Size Presets: 4 Radial Slices (90° each)
const SIZE_PRESETS: SizePresetDef[] = [
  { id: 'mini', label: 'Mini', sub: '220×315', icon: 'i-solar:minimize-square-3-linear' }, // 0° (Top)
  { id: 'medium', label: 'Med', sub: '450×600', icon: 'i-solar:maximize-square-2-linear' }, // 90° (Right)
  { id: 'large', label: 'Large', sub: '800×1000', icon: 'i-solar:maximize-square-3-linear' }, // 180° (Bottom)
  { id: 'full', label: 'Full', sub: 'Workarea', icon: 'i-solar:screencast-linear' }, // 270° (Left)
]

// 4. Snap / Alignment: 8 Directional Radial Slices (45° each)
const ALIGN_SLICES: AlignSliceDef[] = [
  { id: 'top', icon: 'i-ph:arrow-up', label: 'Top' }, // 0°
  { id: 'top-right', icon: 'i-ph:arrow-up-right', label: 'Top-Right' }, // 45°
  { id: 'right', icon: 'i-ph:arrow-right', label: 'Right' }, // 90°
  { id: 'bottom-right', icon: 'i-ph:arrow-down-right', label: 'Bottom-Right' }, // 135°
  { id: 'bottom', icon: 'i-ph:arrow-down', label: 'Bottom' }, // 180°
  { id: 'bottom-left', icon: 'i-ph:arrow-down-left', label: 'Bottom-Left' }, // 225°
  { id: 'left', icon: 'i-ph:arrow-left', label: 'Left' }, // 270°
  { id: 'top-left', icon: 'i-ph:arrow-up-left', label: 'Top-Left' }, // 315°
]

// 5. Layer Visibility: 2 Radial Slices (180° each)
const LAYER_SLICES = computed(() => [
  {
    id: 'model',
    icon: props.showModel ? 'i-ph:user' : 'i-ph:user-slash',
    label: 'Model',
    status: props.showModel ? 'On' : 'Off',
    active: props.showModel,
  }, // Right Half (90°)
  {
    id: 'background',
    icon: props.showBackground ? 'i-ph:image' : 'i-ph:image-slash',
    label: 'Wallpaper',
    status: props.showBackground ? 'On' : 'Off',
    active: props.showBackground,
  }, // Left Half (270°)
])

// 6. Monitor Presets: N Slices (360° / count)
const MONITOR_SLICES = computed(() => {
  const count = Math.max(1, props.monitorCount)
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    label: `Monitor ${i + 1}`,
    active: props.activeMonitor === i + 1,
  }))
})

// ── Radii & Layout Math ───────────────────────────────────────────────────────
const INNER_RADIUS = 44
const OUTER_RADIUS = 138
// Midpoint of donut band: (44 + 138) / 2 = 91px (optical vertical center of slice)
const SLICE_MID_RADIUS = 91

// Dynamic scale calculation based on viewport dimensions (e.g. Mini mode 220px)
const menuScale = computed(() => {
  const minDim = Math.min(containerBounds.value.width, containerBounds.value.height)
  const baseOuterDiameter = (OUTER_RADIUS * 2) + 20 // 296px
  if (minDim < baseOuterDiameter) {
    return Math.max(0.62, (minDim - 16) / baseOuterDiameter)
  }
  return 1
})

const currentSliceCount = computed(() => {
  if (subMenuMode.value === 'size')
    return SIZE_PRESETS.length
  if (subMenuMode.value === 'align')
    return ALIGN_SLICES.length
  if (subMenuMode.value === 'mode')
    return MODE_SLICES.value.length
  if (subMenuMode.value === 'layers')
    return LAYER_SLICES.value.length
  if (subMenuMode.value === 'monitor')
    return MONITOR_SLICES.value.length
  return activeMainWedges.value.length
})

const currentPolarLayouts = computed(() => {
  if (subMenuMode.value === 'layers') {
    // 2 Halves: Right at 90°, Left at 270°
    return computePolarLayout(2, SLICE_MID_RADIUS, 90)
  }
  return computePolarLayout(currentSliceCount.value, SLICE_MID_RADIUS)
})

// Parallax 3D Tilt computation
const parallaxTilt = computed(() => {
  return computeParallaxTilt(mouseRelX.value, mouseRelY.value, OUTER_RADIUS, 12)
})

const menuTransformStyle = computed(() => {
  const { x, y } = menuCenter.value
  const { rotateX, rotateY } = parallaxTilt.value
  const scale = menuScale.value
  return {
    transform: `perspective(600px) translate3d(${x}px, ${y}px, 0) scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
  }
})

// ── Audio Feedback Synthesizer ───────────────────────────────────────────────
let audioCtx: AudioContext | null = null

function playTone(freq: number, durationSec: number, type: OscillatorType = 'sine', gainVal = 0.08) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx)
      return
    if (!audioCtx)
      audioCtx = new AudioCtx()
    if (audioCtx.state === 'suspended')
      audioCtx.resume()

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime)
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationSec)

    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + durationSec)
  }
  catch {
    // Audio is best-effort
  }
}

function playOpenSound() {
  playTone(420, 0.12, 'triangle', 0.09)
  setTimeout(() => playTone(640, 0.15, 'sine', 0.07), 40)
}

function playHoverSound() {
  playTone(520, 0.05, 'sine', 0.035)
}

function playActionSound() {
  playTone(780, 0.1, 'triangle', 0.1)
}

// ── Head Tracking Loop ────────────────────────────────────────────────────────
let rafId: number | null = null

function updateHeadAnchor() {
  if (!isOpen.value)
    return

  const container = stageOverlayRef.value
  if (container) {
    containerBounds.value = {
      width: container.clientWidth || 450,
      height: container.clientHeight || 600,
    }
  }

  const headPose = props.sceneRef?.getHeadPose?.()
  const scale = menuScale.value || 1
  const effectiveOuterRadius = OUTER_RADIUS * scale
  if (headPose && Number.isFinite(headPose.screenX) && Number.isFinite(headPose.screenY)) {
    // Offset below the head (at upper torso/chest)
    const verticalOffset = Math.max(60 * scale, Math.min(160 * scale, (headPose.modelHeightPx || 450) * 0.22))
    const clamped = clampRadialMenuPosition(
      headPose.screenX,
      headPose.screenY,
      containerBounds.value.width,
      containerBounds.value.height,
      effectiveOuterRadius,
      8,
      verticalOffset,
    )
    menuCenter.value = clamped
  }
  else {
    // Fallback: center in container
    menuCenter.value = {
      x: containerBounds.value.width / 2,
      y: containerBounds.value.height / 2,
    }
  }

  rafId = requestAnimationFrame(updateHeadAnchor)
}

function startTracking() {
  if (rafId)
    return
  rafId = requestAnimationFrame(updateHeadAnchor)
}

function stopTracking() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

// ── Open / Close Watchers ─────────────────────────────────────────────────────
watch(() => props.open, (val) => {
  if (val !== isOpen.value) {
    isOpen.value = val
    if (val) {
      subMenuMode.value = 'none'
      hoveredIndex.value = null
      playOpenSound()
      startTracking()
    }
    else {
      stopTracking()
    }
  }
}, { immediate: true })

watch(isOpen, (val) => {
  emit('update:open', val)
  if (!val)
    stopTracking()
})

function closeMenu() {
  isOpen.value = false
  subMenuMode.value = 'none'
  hoveredIndex.value = null
}

// ── Pointer Tracking & Hover Handling ─────────────────────────────────────────
function onPointerMove(e: PointerEvent) {
  if (!isOpen.value)
    return

  const scale = menuScale.value || 1
  const relX = (e.clientX - menuCenter.value.x) / scale
  const relY = (e.clientY - menuCenter.value.y) / scale
  mouseRelX.value = relX
  mouseRelY.value = relY

  const idx = getHoveredSliceIndex(relX, relY, currentSliceCount.value, INNER_RADIUS, OUTER_RADIUS)
  if (idx !== hoveredIndex.value) {
    hoveredIndex.value = idx
    if (idx !== null)
      playHoverSound()
  }
}

function handleCenterHubClick() {
  if (subMenuMode.value !== 'none') {
    // In Align mode, clicking center snaps to Center!
    if (subMenuMode.value === 'align') {
      selectAlignment('center')
      return
    }
    // Return to root radial wheel
    subMenuMode.value = 'none'
    hoveredIndex.value = null
    playHoverSound()
  }
  else {
    closeMenu()
  }
}

function onWheelClick() {
  if (hoveredIndex.value !== null) {
    onSliceClick(hoveredIndex.value)
  }
}

// ── Action Dispatcher per Mode ────────────────────────────────────────────────
function onSliceClick(idx: number) {
  playActionSound()

  if (subMenuMode.value === 'none') {
    const wedge = activeMainWedges.value[idx]
    if (!wedge)
      return
    if (wedge.id === 'size') {
      subMenuMode.value = 'size'
      hoveredIndex.value = null
    }
    else if (wedge.id === 'align') {
      subMenuMode.value = 'align'
      hoveredIndex.value = null
    }
    else if (wedge.id === 'mode') {
      subMenuMode.value = 'mode'
      hoveredIndex.value = null
    }
    else if (wedge.id === 'layers') {
      subMenuMode.value = 'layers'
      hoveredIndex.value = null
    }
    else if (wedge.id === 'hide') {
      emit('hide-stage')
      closeMenu()
    }
    else if (wedge.id === 'monitor') {
      if (props.monitorCount > 1) {
        subMenuMode.value = 'monitor'
        hoveredIndex.value = null
      }
      else {
        emit('select-monitor', 1)
        closeMenu()
      }
    }
  }
  else if (subMenuMode.value === 'size') {
    const preset = SIZE_PRESETS[idx]
    if (preset) {
      emit('apply-preset', preset.id)
      closeMenu()
    }
  }
  else if (subMenuMode.value === 'align') {
    const dir = ALIGN_SLICES[idx]
    if (dir) {
      emit('apply-alignment', dir.id)
      closeMenu()
    }
  }
  else if (subMenuMode.value === 'mode') {
    const slice = MODE_SLICES.value[idx]
    if (slice) {
      void dispatchAction(slice.action)
      closeMenu()
    }
  }
  else if (subMenuMode.value === 'layers') {
    if (idx === 0) {
      emit('update:showModel', !props.showModel)
    }
    else if (idx === 1) {
      emit('update:showBackground', !props.showBackground)
    }
  }
  else if (subMenuMode.value === 'monitor') {
    emit('select-monitor', idx + 1)
    closeMenu()
  }
}

function selectAlignment(alignment: string) {
  playActionSound()
  emit('apply-alignment', alignment)
  closeMenu()
}

// Keyboard shortcuts (Escape closes menu, or goes back if in sub-menu)
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    e.stopPropagation()
    if (subMenuMode.value !== 'none') {
      subMenuMode.value = 'none'
      hoveredIndex.value = null
    }
    else {
      closeMenu()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  stopTracking()
  window.removeEventListener('keydown', onKeyDown)
})

// Path generator for SVG sectors
function getSectorPath(startAngle: number, endAngle: number, innerR = INNER_RADIUS + 2, outerR = OUTER_RADIUS - 2) {
  return describeAnnularSector(0, 0, innerR, outerR, startAngle, endAngle)
}
</script>

<template>
  <div
    v-if="isOpen"
    ref="stageOverlayRef"
    class="pointer-events-auto absolute inset-0 z-50 select-none overflow-hidden"
    @pointermove="onPointerMove"
    @pointerdown.self="closeMenu"
    @contextmenu.prevent="closeMenu"
  >
    <!-- 3D Parallax Wheel Host Container -->
    <div
      class="radial-menu-root absolute left-0 top-0 origin-center transition-transform duration-75 ease-out"
      :style="menuTransformStyle"
    >
      <!-- Centered Transform Pivot (-150px offset) -->
      <div class="relative h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2">
        <!-- SVG Background Ring & Wedges -->
        <svg
          class="absolute inset-0 h-full w-full drop-shadow-2xl filter"
          viewBox="-150 -150 300 300"
          @click="onWheelClick"
        >
          <!-- Outer Shadow Glow Disk -->
          <circle
            cx="0"
            cy="0"
            :r="OUTER_RADIUS"
            class="fill-slate-950/80 stroke-white/10 dark:fill-zinc-950/90 dark:stroke-white/10"
            stroke-width="1.5"
          />

          <!-- ── Dynamic Radial Slices ────────────────────────────────────── -->
          <g>
            <path
              v-for="layout in currentPolarLayouts"
              :key="layout.index"
              :d="getSectorPath(layout.startAngleDeg + 0.8, layout.endAngleDeg - 0.8)"
              :class="[
                'cursor-pointer transition-all duration-150',
                hoveredIndex === layout.index
                  ? 'fill-white/20 stroke-white/40'
                  : 'fill-white/5 stroke-white/5 hover:fill-white/15',
              ]"
              stroke-width="1.2"
              @click.stop="onSliceClick(layout.index)"
            />

            <!-- Magnetic Cursor Highlight Arc -->
            <path
              v-if="hoveredIndex !== null && currentPolarLayouts[hoveredIndex]"
              :d="getSectorPath(currentPolarLayouts[hoveredIndex].startAngleDeg + 0.8, currentPolarLayouts[hoveredIndex].endAngleDeg - 0.8)"
              class="cursor-pointer fill-sky-400/30 stroke-sky-300 transition-all duration-100"
              stroke-width="2"
              @click.stop="onSliceClick(hoveredIndex)"
            />
          </g>

          <!-- Inner Boundary Cutout Ring -->
          <circle
            cx="0"
            cy="0"
            :r="INNER_RADIUS"
            class="fill-slate-900/90 stroke-white/15 dark:fill-zinc-900/95"
            stroke-width="1.5"
          />
        </svg>

        <!-- ── LEVEL 1: ROOT RADIAL WHEEL (Clean Floating Wedges) ───────── -->
        <template v-if="subMenuMode === 'none'">
          <div
            v-for="(btn, idx) in activeMainWedges"
            :key="btn.id"
            :class="[
              'pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'flex flex-col items-center justify-center select-none',
              'transition-all duration-150',
              hoveredIndex === idx
                ? 'scale-115 text-white drop-shadow-[0_2px_10px_rgba(56,189,248,0.7)]'
                : 'text-neutral-300 opacity-80',
            ]"
            :style="{
              transform: `translate(calc(-50% + ${currentPolarLayouts[idx]?.x || 0}px), calc(-50% + ${currentPolarLayouts[idx]?.y || 0}px)) scale(${hoveredIndex === idx ? 1.15 : 1})`,
            }"
          >
            <div :class="[btn.icon, 'text-2xl']" />
            <span class="mt-1 text-[10px] font-bold tracking-wider uppercase drop-shadow-md">{{ btn.label }}</span>
          </div>
        </template>

        <!-- ── LEVEL 2: SIZE PRESETS RADIAL WHEEL (4 Slices) ──────────────── -->
        <template v-else-if="subMenuMode === 'size'">
          <div
            v-for="(p, idx) in SIZE_PRESETS"
            :key="p.id"
            :class="[
              'pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'flex flex-col items-center justify-center select-none',
              'transition-all duration-150',
              hoveredIndex === idx
                ? 'scale-115 text-white drop-shadow-[0_2px_10px_rgba(56,189,248,0.7)]'
                : 'text-neutral-300 opacity-80',
            ]"
            :style="{
              transform: `translate(calc(-50% + ${currentPolarLayouts[idx]?.x || 0}px), calc(-50% + ${currentPolarLayouts[idx]?.y || 0}px)) scale(${hoveredIndex === idx ? 1.15 : 1})`,
            }"
          >
            <div :class="[p.icon, 'text-2xl']" />
            <span class="mt-0.5 text-[11px] font-bold">{{ p.label }}</span>
            <span class="text-[8px] text-neutral-400 font-mono">{{ p.sub }}</span>
          </div>
        </template>

        <!-- ── LEVEL 2: SNAP / ALIGNMENT RADIAL WHEEL (8 Slices) ──────────── -->
        <template v-else-if="subMenuMode === 'align'">
          <div
            v-for="(dir, idx) in ALIGN_SLICES"
            :key="dir.id"
            :class="[
              'pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'flex flex-col items-center justify-center select-none',
              'transition-all duration-150',
              hoveredIndex === idx
                ? 'scale-120 text-white drop-shadow-[0_2px_10px_rgba(168,85,247,0.7)]'
                : 'text-neutral-300 opacity-80',
            ]"
            :style="{
              transform: `translate(calc(-50% + ${currentPolarLayouts[idx]?.x || 0}px), calc(-50% + ${currentPolarLayouts[idx]?.y || 0}px)) scale(${hoveredIndex === idx ? 1.2 : 1})`,
            }"
          >
            <div :class="[dir.icon, 'text-2xl']" />
          </div>
        </template>

        <!-- ── LEVEL 2: MODE SELECTION RADIAL WHEEL (4 Slices) ────────────── -->
        <template v-else-if="subMenuMode === 'mode'">
          <div
            v-for="(m, idx) in MODE_SLICES"
            :key="m.id"
            :class="[
              'pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'flex flex-col items-center justify-center select-none',
              'transition-all duration-150',
              hoveredIndex === idx
                ? 'scale-115 text-white drop-shadow-[0_2px_10px_rgba(16,185,129,0.7)]'
                : 'text-neutral-300 opacity-80',
            ]"
            :style="{
              transform: `translate(calc(-50% + ${currentPolarLayouts[idx]?.x || 0}px), calc(-50% + ${currentPolarLayouts[idx]?.y || 0}px)) scale(${hoveredIndex === idx ? 1.15 : 1})`,
            }"
          >
            <div :class="[m.icon, 'text-2xl']" />
            <span class="mt-0.5 text-[11px] font-bold">{{ m.label }}</span>
            <span class="text-[8px] font-mono" :class="m.active ? 'text-emerald-400 font-bold' : 'text-neutral-400'">{{ m.sub }}</span>
            <div v-if="m.active" class="mt-0.5 size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
          </div>
        </template>

        <!-- ── LEVEL 2: LAYERS RADIAL WHEEL (2 Half-Slices) ───────────────── -->
        <template v-else-if="subMenuMode === 'layers'">
          <div
            v-for="(layer, idx) in LAYER_SLICES"
            :key="layer.id"
            :class="[
              'pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'flex flex-col items-center justify-center select-none',
              'transition-all duration-150',
              hoveredIndex === idx
                ? 'scale-115 text-white drop-shadow-[0_2px_10px_rgba(236,72,153,0.7)]'
                : 'text-neutral-300 opacity-80',
            ]"
            :style="{
              transform: `translate(calc(-50% + ${currentPolarLayouts[idx]?.x || 0}px), calc(-50% + ${currentPolarLayouts[idx]?.y || 0}px)) scale(${hoveredIndex === idx ? 1.15 : 1})`,
            }"
          >
            <div :class="[layer.icon, 'text-2xl']" />
            <span class="mt-0.5 text-[10px] font-bold uppercase">{{ layer.label }}</span>
            <span
              :class="[
                'text-[8px] font-mono px-1.5 py-0.2 rounded-full mt-0.5',
                layer.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30',
              ]"
            >
              {{ layer.status }}
            </span>
          </div>
        </template>

        <!-- ── LEVEL 2: MONITOR RADIAL WHEEL (N Slices) ───────────────────── -->
        <template v-else-if="subMenuMode === 'monitor'">
          <div
            v-for="(m, idx) in MONITOR_SLICES"
            :key="m.id"
            :class="[
              'pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'flex flex-col items-center justify-center select-none',
              'transition-all duration-150',
              hoveredIndex === idx
                ? 'scale-115 text-white drop-shadow-[0_2px_10px_rgba(245,158,11,0.7)]'
                : 'text-neutral-300 opacity-80',
            ]"
            :style="{
              transform: `translate(calc(-50% + ${currentPolarLayouts[idx]?.x || 0}px), calc(-50% + ${currentPolarLayouts[idx]?.y || 0}px)) scale(${hoveredIndex === idx ? 1.15 : 1})`,
            }"
          >
            <div class="i-ph:desktop text-2xl" />
            <span class="mt-0.5 text-[10px] font-bold">{{ m.label }}</span>
            <span v-if="m.active" class="text-[7px] text-amber-400 font-bold uppercase">Active</span>
          </div>
        </template>

        <!-- Center Hub (Cancel / Back / Center Action) -->
        <button
          class="center-hub absolute left-1/2 top-1/2 size-12 flex cursor-pointer items-center justify-center border border-white/20 rounded-full bg-slate-900/90 text-neutral-400 shadow-xl backdrop-blur-xl transition-all duration-150 -translate-x-1/2 -translate-y-1/2 active:scale-90 hover:scale-105 hover:border-white/40 hover:bg-slate-800 hover:text-white"
          :title="subMenuMode === 'none' ? 'Close Radial Menu' : subMenuMode === 'align' ? 'Center Snap / Back' : 'Back to Main Wheel'"
          @click="handleCenterHubClick"
        >
          <div
            :class="[
              subMenuMode === 'none'
                ? 'i-solar:close-circle-bold text-xl'
                : subMenuMode === 'align'
                  ? 'i-ph:circle text-xl text-purple-400'
                  : 'i-solar:arrow-left-linear text-lg text-sky-400',
            ]"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.radial-menu-root {
  transform-style: preserve-3d;
  will-change: transform;
}
</style>
