<script setup lang="ts">
import { useTheme } from '@proj-airi/ui'
import { onMounted, onUnmounted, ref, watch } from 'vue'

withDefaults(defineProps<{
  transparentBg?: boolean
}>(), {
  transparentBg: false,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationFrameId: number | null = null
const { isDark } = useTheme()

interface NoteParticle {
  x: number
  y: number
  size: number
  speedY: number
  angle: number
  swaySpeed: number
  swayOffset: number
  opacity: number
  color: string
  isBeamed: boolean
}

function drawNote(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, color: string, opacity: number, isBeamed: boolean) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(size / 20, size / 20)
  ctx.globalAlpha = opacity
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'

  if (isBeamed) {
    // Double eighth note (♫)
    ctx.beginPath()
    ctx.ellipse(-6, 6, 3.5, 2.5, -0.35, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.ellipse(6, 4, 3.5, 2.5, -0.35, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(-3, 6)
    ctx.lineTo(-3, -7)
    ctx.moveTo(9, 4)
    ctx.lineTo(9, -9)
    ctx.moveTo(-3, -7)
    ctx.lineTo(9, -9)
    ctx.lineWidth = 2.4
    ctx.stroke()
  }
  else {
    // Single eighth note (♪)
    ctx.beginPath()
    ctx.ellipse(-2, 5, 4, 2.8, -0.35, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(1.5, 5)
    ctx.lineTo(1.5, -9)
    ctx.bezierCurveTo(3, -5, 6, -3, 8, -4)
    ctx.stroke()
  }

  ctx.restore()
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas)
    return
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  function getDims() {
    const parent = canvas?.parentElement
    const w = (parent && parent.clientWidth > 0) ? parent.clientWidth : window.innerWidth
    const h = (parent && parent.clientHeight > 0) ? parent.clientHeight : window.innerHeight
    return { w, h }
  }

  let { w: width, h: height } = getDims()
  canvas.width = width
  canvas.height = height

  const handleResize = () => {
    if (!canvas)
      return
    const dims = getDims()
    width = canvas.width = dims.w
    height = canvas.height = dims.h
  }
  window.addEventListener('resize', handleResize)

  const lightColors = ['#ec4899', '#8b5cf6', '#3b82f6', '#f59e0b', '#10b981', '#06b6d4']
  const darkColors = ['#f472b6', '#a78bfa', '#60a5fa', '#fbbf24', '#34d399', '#38bdf8']

  function getColors() {
    return isDark.value ? darkColors : lightColors
  }

  const particleCount = 24
  const notes: NoteParticle[] = []

  for (let i = 0; i < particleCount; i++) {
    const colors = getColors()
    notes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 12 + 16, // 16px - 28px
      speedY: Math.random() * 0.45 + 0.25,
      angle: (Math.random() - 0.5) * 0.3,
      swaySpeed: Math.random() * 0.025 + 0.015,
      swayOffset: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.35 + 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      isBeamed: Math.random() > 0.45,
    })
  }

  watch(isDark, () => {
    const colors = getColors()
    for (const n of notes) {
      n.color = colors[Math.floor(Math.random() * colors.length)]
    }
  })

  let tick = 0
  const render = () => {
    const dims = getDims()
    if (canvas.width !== dims.w || canvas.height !== dims.h) {
      canvas.width = dims.w
      canvas.height = dims.h
      width = dims.w
      height = dims.h
    }

    ctx.clearRect(0, 0, width, height)
    tick++

    for (const n of notes) {
      n.y -= n.speedY
      n.x += Math.sin(tick * n.swaySpeed + n.swayOffset) * 0.65

      if (n.y < -30) {
        n.y = height + 25
        n.x = Math.random() * width
        const colors = getColors()
        n.color = colors[Math.floor(Math.random() * colors.length)]
      }

      drawNote(ctx, n.x, n.y, n.size, n.angle, n.color, n.opacity, n.isBeamed)
    }

    animationFrameId = requestAnimationFrame(render)
  }

  render()

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
    }
  })
})
</script>

<template>
  <div
    :class="[
      'pointer-events-none absolute inset-0 overflow-hidden transition-colors duration-300',
      transparentBg ? 'bg-transparent' : 'bg-[#f8fafc] dark:bg-[#0a0d14]',
    ]"
  >
    <div
      v-if="!transparentBg"
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(253,244,255,0.9),rgba(248,250,252,1))] transition-opacity duration-300 dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(25,12,35,0.8),rgba(10,13,20,1))]"
    />
    <canvas ref="canvasRef" class="pointer-events-none absolute inset-0 z-0 h-full w-full" />
    <div v-if="$slots.default" class="relative z-10 h-full w-full">
      <slot />
    </div>
  </div>
</template>
