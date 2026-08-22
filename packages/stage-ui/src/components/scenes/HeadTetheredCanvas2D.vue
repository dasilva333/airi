<script setup lang="ts">
import type { AnalyzedSentenceEffects } from '@proj-airi/stage-shared/utils/caption-sentiment'

import {
  drawCanvas6PointStar,
  drawCanvasAuxiliaryShapes,
  drawCanvasBubbleBody,
  drawCanvasHeart,
  drawCanvasInteriorMask,
  drawCanvasRaindrop,
} from '@proj-airi/stage-shared/utils/caption-canvas2d'
import { poseToCaptionTransform } from '@proj-airi/stage-shared/utils/caption-perspective'
import { analyzeCaptionSentence, subChunkText } from '@proj-airi/stage-shared/utils/caption-sentiment'
import { useBroadcastChannel } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useSettings } from '../../stores/settings'

interface CaptionSegment {
  text: string
  color?: string
  actorId?: string
  isActive?: boolean
}

export interface HeadPoseData {
  screenX: number
  screenY: number
  yaw: number
  pitch: number
  roll: number
  modelHeightPx: number
}

const props = defineProps<{
  /**
   * 3D VRM scene component instance (from `RendererStage.vue`).
   * Provides `getHeadPose()` method to resolve projected screen-space head coordinates.
   */
  vrmSceneRef?: {
    getHeadPose?: () => HeadPoseData | null
  } | null
  /** Default fallback text */
  text?: string
}>()

const settingsStore = useSettings()
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Sentence Sync state: default to initial text, persist last active state once updated
const defaultText = props.text ?? 'Hello there! ✨ Floating with AIRI! 💖🌸'
const currentCaptionText = ref(defaultText)
const currentCaptionColor = ref<string | undefined>(undefined)

let pacerTimer: ReturnType<typeof setTimeout> | null = null

function clearPacerTimer() {
  if (pacerTimer) {
    clearTimeout(pacerTimer)
    pacerTimer = null
  }
}

// ── Sentence Sync & Micro-Pacer BroadcastChannel ──────────────────────────────
const { data: captionBroadcast } = useBroadcastChannel<any, any>({
  name: 'airi-caption-overlay',
})

watch(captionBroadcast, (msg) => {
  if (!msg || msg.type !== 'caption-assistant')
    return

  const segments = (msg.segments || []) as CaptionSegment[]
  const activeSegment = segments.find(s => s.isActive)

  if (activeSegment && activeSegment.text && activeSegment.text.trim()) {
    clearPacerTimer()
    const fullText = activeSegment.text.trim()
    const color = activeSegment.color
    const subChunks = subChunkText(fullText, 75)

    if (subChunks.length <= 1) {
      currentCaptionText.value = fullText
      currentCaptionColor.value = color
    }
    else {
      let chunkIdx = 0
      const advanceChunk = () => {
        if (chunkIdx >= subChunks.length)
          return
        currentCaptionText.value = subChunks[chunkIdx]
        currentCaptionColor.value = color
        chunkIdx++

        if (chunkIdx < subChunks.length) {
          const charCount = subChunks[chunkIdx - 1].length
          const delayMs = Math.min(2600, Math.max(1200, charCount * 45))
          pacerTimer = setTimeout(advanceChunk, delayMs)
        }
      }
      advanceChunk()
    }
  }
})

// Dynamic Sentiment Analysis
const analyzedEffects = ref<AnalyzedSentenceEffects>({
  bodyStyle: 'standard-rounded',
  tailStyle: 'pointer',
  ambient: null,
  accent: null,
  motion: null,
  rim: null,
})

watch(currentCaptionText, (newText) => {
  analyzedEffects.value = analyzeCaptionSentence(newText)
}, { immediate: true })

// ── Particle & Animation State ────────────────────────────────────────────────
interface AmbientParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  maxAlpha: number
  phase: number
  scale?: number
}

const particles: AmbientParticle[] = []
let lastAmbientType: string | null = null

function initParticles(type: string | null, width: number, height: number) {
  particles.length = 0
  lastAmbientType = type
  if (!type)
    return

  const count = type === 'rain' ? 14 : type === 'hearts' ? 8 : type === 'stars' ? 7 : 6
  for (let i = 0; i < count; i++) {
    particles.push({
      x: (Math.random() - 0.5) * (width * 0.75),
      y: (Math.random() - 0.5) * (height * 0.6) - height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: type === 'rain' ? 45 + Math.random() * 30 : -15 - Math.random() * 20,
      size: type === 'rain' ? 5 + Math.random() * 3 : 6 + Math.random() * 4,
      alpha: 0.2 + Math.random() * 0.6,
      maxAlpha: 0.6 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    })
  }
}

// ── Canvas Render Loop ────────────────────────────────────────────────────────
let rafId: number | null = null
let lastTimeMs = performance.now()

function renderFrame(nowMs: number) {
  const canvas = canvasRef.value
  if (!canvas || !settingsStore.headTetheredCaptionEnabled) {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    return
  }

  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  const dt = Math.min(0.1, (nowMs - lastTimeMs) / 1000)
  lastTimeMs = nowMs

  // Resize canvas to match display size with DPR scaling
  const dpr = window.devicePixelRatio || 1
  const displayW = canvas.clientWidth
  const displayH = canvas.clientHeight

  if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
    canvas.width = displayW * dpr
    canvas.height = displayH * dpr
  }

  ctx.save()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, displayW, displayH)

  // Query head pose from VRM scene ref
  const headPose = props.vrmSceneRef?.getHeadPose?.()
  if (!headPose) {
    ctx.restore()
    rafId = requestAnimationFrame(renderFrame)
    return
  }

  // Calculate bubble dimensions
  const modelHeight = headPose.modelHeightPx || displayH * 0.45
  const bubbleWidth = Math.min(displayW * 0.65, Math.max(140, modelHeight * 0.38))
  const bubbleHeight = Math.max(46, bubbleWidth * 0.32)

  // Ensure particle system matches current ambient effect
  const currentAmbient = analyzedEffects.value.ambient
  if (currentAmbient !== lastAmbientType) {
    initParticles(currentAmbient, bubbleWidth, bubbleHeight)
  }

  // Pose transform math
  const poseTransform = poseToCaptionTransform(
    { yaw: headPose.yaw, pitch: headPose.pitch, roll: headPose.roll },
    { x: headPose.screenX, y: headPose.screenY },
    {
      strength: 100,
      offsetX: 0,
      offsetY: -15,
      perspectiveScale: 1,
    },
  )

  // Channel 3: Motion container offset & scale
  let motionOffsetX = 0
  let motionOffsetY = 0
  let motionScaleX = 1
  let motionScaleY = 1

  const motionType = analyzedEffects.value.motion
  if (motionType === 'wobble') {
    motionOffsetX = Math.sin(nowMs * 0.015) * 4
  }
  else if (motionType === 'bounce') {
    const bouncePhase = (nowMs % 600) / 600
    motionOffsetY = -Math.sin(bouncePhase * Math.PI) * 7
  }
  else if (motionType === 'shake') {
    motionOffsetX = (Math.random() - 0.5) * 5
  }
  else if (motionType === 'breath') {
    const breathFactor = 1 + 0.035 * Math.sin(nowMs * 0.003)
    motionScaleX = breathFactor
    motionScaleY = breathFactor
  }
  else if (motionType === 'stretch') {
    motionScaleX = 1.08
    motionScaleY = 0.94
  }

  // Dynamic Theme Colors
  const isGratitude = currentCaptionText.value.toLowerCase().includes('thank')
  let themeColorHex = currentCaptionColor.value || '#F472B6'

  if (isGratitude) {
    const cycle = Math.sin(nowMs / 1400)
    const hue = 290 + 50 * cycle
    themeColorHex = `hsl(${hue}, 85%, 68%)`
  }

  // Apply matrix transform to canvas
  ctx.save()
  ctx.translate(poseTransform.x + motionOffsetX, poseTransform.y + motionOffsetY)
  ctx.rotate(poseTransform.rotation)
  ctx.transform(1, poseTransform.skewY, poseTransform.skewX, 1, 0, 0)
  ctx.scale(poseTransform.scaleX * motionScaleX, poseTransform.scaleY * motionScaleY)

  // 1. Draw Visible Bubble Body & Tail
  const wagPhase = (nowMs / 1000) * 8.5
  drawCanvasBubbleBody(ctx, {
    width: bubbleWidth,
    height: bubbleHeight,
    bodyStyle: analyzedEffects.value.bodyStyle,
    tailStyle: analyzedEffects.value.tailStyle,
    wagPhase,
    color: themeColorHex,
  })

  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
  ctx.fill()
  ctx.strokeStyle = themeColorHex
  ctx.lineWidth = 2.5
  ctx.stroke()

  // 2. Interior Clipping Mask for Ambient Effects
  ctx.save()
  drawCanvasInteriorMask(ctx, {
    width: bubbleWidth,
    height: bubbleHeight,
    bodyStyle: analyzedEffects.value.bodyStyle,
    tailStyle: analyzedEffects.value.tailStyle,
    color: themeColorHex,
  })
  ctx.clip()

  // Channel 1: Ambient Effects
  if (currentAmbient === 'blush') {
    const grad = ctx.createRadialGradient(0, -bubbleHeight / 2, 0, 0, -bubbleHeight / 2, bubbleWidth * 0.5)
    grad.addColorStop(0, 'rgba(255, 105, 180, 0.35)')
    grad.addColorStop(1, 'rgba(255, 182, 193, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(-bubbleWidth / 2, -bubbleHeight, bubbleWidth, bubbleHeight)
  }
  else if (currentAmbient === 'vignette') {
    const grad = ctx.createRadialGradient(0, -bubbleHeight / 2, bubbleHeight * 0.2, 0, -bubbleHeight / 2, bubbleWidth * 0.55)
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)')
    grad.addColorStop(1, 'rgba(75, 0, 130, 0.45)')
    ctx.fillStyle = grad
    ctx.fillRect(-bubbleWidth / 2, -bubbleHeight, bubbleWidth, bubbleHeight)
  }
  else if (currentAmbient === 'scanline') {
    const scanY = ((nowMs * 0.06) % bubbleHeight) - bubbleHeight
    ctx.fillStyle = 'rgba(6, 182, 212, 0.18)'
    ctx.fillRect(-bubbleWidth / 2, scanY, bubbleWidth, 4)
  }
  else if (currentAmbient === 'sunbeam') {
    const grad = ctx.createLinearGradient(-bubbleWidth / 2, -bubbleHeight, bubbleWidth / 2, 0)
    grad.addColorStop(0, 'rgba(251, 191, 36, 0.25)')
    grad.addColorStop(1, 'rgba(245, 158, 11, 0.05)')
    ctx.fillStyle = grad
    ctx.fillRect(-bubbleWidth / 2, -bubbleHeight, bubbleWidth, bubbleHeight)
  }
  else if (currentAmbient === 'hearts') {
    for (const p of particles) {
      p.y += p.vy * dt
      p.x += Math.sin(nowMs * 0.004 + p.phase) * 6 * dt
      if (p.y < -bubbleHeight - 10) {
        p.y = 5
        p.x = (Math.random() - 0.5) * (bubbleWidth * 0.7)
      }
      drawCanvasHeart(ctx, p.x, p.y, p.size, themeColorHex, p.alpha)
    }
  }
  else if (currentAmbient === 'rain') {
    for (const p of particles) {
      p.y += p.vy * dt
      if (p.y > 5) {
        p.y = -bubbleHeight - 5
        p.x = (Math.random() - 0.5) * (bubbleWidth * 0.8)
      }
      drawCanvasRaindrop(ctx, p.x, p.y, p.size, '#60A5FA', p.alpha)
    }
  }
  else if (currentAmbient === 'stars') {
    for (const p of particles) {
      p.phase += dt * 2
      const pulseAlpha = 0.3 + 0.5 * Math.abs(Math.sin(p.phase))
      drawCanvas6PointStar(ctx, p.x, p.y, p.size, '#F59E0B', pulseAlpha)
    }
  }
  else if (currentAmbient === 'fireflies') {
    for (const p of particles) {
      p.phase += dt * 2.5
      const wanderX = p.x + Math.sin(nowMs * 0.002 + p.phase) * 8
      const wanderY = p.y + Math.cos(nowMs * 0.002 + p.phase) * 4
      const alpha = 0.2 + 0.6 * Math.abs(Math.sin(p.phase))
      ctx.beginPath()
      ctx.arc(wanderX, wanderY, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(167, 243, 208, ${alpha})`
      ctx.fill()
    }
  }
  ctx.restore() // Restore after clip

  // Channel 4: Rim Decorators
  const rimType = analyzedEffects.value.rim
  if (rimType === 'flower-bloom') {
    // Blooming flower along the right corner
    const bloomSize = 8
    const bx = bubbleWidth * 0.42
    const by = -bubbleHeight * 0.85
    ctx.save()
    ctx.translate(bx, by)
    ctx.rotate(nowMs * 0.001)
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5
      ctx.beginPath()
      ctx.ellipse(Math.cos(angle) * bloomSize, Math.sin(angle) * bloomSize, bloomSize * 0.6, bloomSize * 0.3, angle, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(244, 114, 182, 0.85)'
      ctx.fill()
    }
    ctx.restore()
  }
  else if (rimType === 'frost-rim') {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)'
    ctx.lineWidth = 1.2
    drawCanvasBubbleBody(ctx, {
      width: bubbleWidth + 4,
      height: bubbleHeight + 4,
      bodyStyle: analyzedEffects.value.bodyStyle,
      tailStyle: 'none',
      color: '#38BDF8',
    })
    ctx.stroke()
  }

  // Channel 2: Accent Decorators
  const accentType = analyzedEffects.value.accent
  if (accentType === 'anger-mark') {
    // 💢 Red anger cross at top-left
    const ax = -bubbleWidth * 0.42
    const ay = -bubbleHeight * 0.88
    ctx.save()
    ctx.translate(ax, ay)
    ctx.strokeStyle = '#EF4444'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.arc(-4, -4, 4, 0, Math.PI / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(4, -4, 4, Math.PI / 2, Math.PI)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(4, 4, 4, Math.PI, (3 * Math.PI) / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(-4, 4, 4, (3 * Math.PI) / 2, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  else if (accentType === 'flash-burst') {
    // 4-point impact starburst at top-right
    const fx = bubbleWidth * 0.45
    const fy = -bubbleHeight * 0.88
    ctx.save()
    ctx.translate(fx, fy)
    ctx.fillStyle = '#F59E0B'
    ctx.beginPath()
    ctx.moveTo(0, -9)
    ctx.quadraticCurveTo(0, 0, 9, 0)
    ctx.quadraticCurveTo(0, 0, 0, 9)
    ctx.quadraticCurveTo(0, 0, -9, 0)
    ctx.quadraticCurveTo(0, 0, 0, -9)
    ctx.fill()
    ctx.restore()
  }
  else if (accentType === 'sweat-drop') {
    drawCanvasRaindrop(ctx, bubbleWidth * 0.42, -bubbleHeight * 0.85, 6, '#38BDF8', 0.9)
  }

  // 3. Auxiliary Shapes (e.g. thought dots)
  drawCanvasAuxiliaryShapes(ctx, {
    width: bubbleWidth,
    height: bubbleHeight,
    bodyStyle: analyzedEffects.value.bodyStyle,
    tailStyle: analyzedEffects.value.tailStyle,
    color: themeColorHex,
  })

  // 4. Render High-Contrast Comic Text
  const text = currentCaptionText.value
  const fontSize = Math.max(12, Math.min(16, Math.round(bubbleHeight * 0.28)))
  ctx.font = `600 ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#1F2937' // High contrast slate-800

  // Multi-line wrapping
  const maxTextW = bubbleWidth * 0.82
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(testLine).width > maxTextW && currentLine) {
      lines.push(currentLine)
      currentLine = word
    }
    else {
      currentLine = testLine
    }
  }
  if (currentLine)
    lines.push(currentLine)

  const lineHeight = fontSize * 1.25
  const totalTextH = lines.length * lineHeight
  const startY = -bubbleHeight / 2 - totalTextH / 2 + lineHeight / 2

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, startY + i * lineHeight)
  }

  ctx.restore() // Restore matrix transform
  ctx.restore() // Restore DPR scale

  rafId = requestAnimationFrame(renderFrame)
}

function startTicker() {
  if (rafId)
    return
  lastTimeMs = performance.now()
  rafId = requestAnimationFrame(renderFrame)
}

function stopTicker() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  const canvas = canvasRef.value
  if (canvas) {
    const ctx = canvas.getContext('2d')
    if (ctx)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}

// ── Watchers & Lifecycle ──────────────────────────────────────────────────────
watch(
  () => settingsStore.headTetheredCaptionEnabled,
  (enabled) => {
    if (enabled) {
      startTicker()
    }
    else {
      stopTicker()
      clearPacerTimer()
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (settingsStore.headTetheredCaptionEnabled) {
    startTicker()
  }
})

onBeforeUnmount(() => {
  stopTicker()
  clearPacerTimer()
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="pointer-events-none absolute inset-0 z-10 h-full w-full"
  />
</template>
