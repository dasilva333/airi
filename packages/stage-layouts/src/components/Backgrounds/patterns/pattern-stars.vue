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

interface StarParticle {
  x: number
  y: number
  baseSize: number
  speedY: number
  angle: number
  rotationSpeed: number
  twinkleSpeed: number
  twinkleOffset: number
  color: string
  isSparkle: boolean
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, color: string, opacity: number, isSparkle: boolean) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.globalAlpha = Math.max(0.1, Math.min(1, opacity))
  ctx.fillStyle = color

  if (isSparkle) {
    const s = size / 2
    const inner = s * 0.2
    ctx.beginPath()
    ctx.moveTo(0, -s)
    ctx.quadraticCurveTo(0, 0, s, 0)
    ctx.quadraticCurveTo(0, 0, 0, s)
    ctx.quadraticCurveTo(0, 0, -s, 0)
    ctx.quadraticCurveTo(0, 0, 0, -s)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(0, 0, Math.max(1, inner * 0.7), 0, Math.PI * 2)
    ctx.fill()
  }
  else {
    ctx.beginPath()
    ctx.arc(0, 0, Math.max(1.5, size * 0.22), 0, Math.PI * 2)
    ctx.fill()
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

  const lightColors = ['#f59e0b', '#fbbf24', '#fde047', '#38bdf8', '#818cf8', '#ec4899', '#34d399']
  const darkColors = ['#fde047', '#facc15', '#38bdf8', '#c084fc', '#67e8f9', '#ffffff', '#fb7185']

  function getColors() {
    return isDark.value ? darkColors : lightColors
  }

  const particleCount = 32
  const stars: StarParticle[] = []

  for (let i = 0; i < particleCount; i++) {
    const colors = getColors()
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      baseSize: Math.random() * 16 + 12,
      speedY: Math.random() * 0.35 + 0.15, // Gentle upward float
      angle: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.015,
      twinkleSpeed: Math.random() * 0.04 + 0.02,
      twinkleOffset: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      isSparkle: Math.random() > 0.35,
    })
  }

  watch(isDark, () => {
    const colors = getColors()
    for (const s of stars) {
      s.color = colors[Math.floor(Math.random() * colors.length)]
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

    for (const s of stars) {
      s.y -= s.speedY
      s.angle += s.rotationSpeed

      // Twinkle calculation
      const pulse = Math.sin(tick * s.twinkleSpeed + s.twinkleOffset)
      const currentOpacity = 0.5 + pulse * 0.4
      const currentSize = s.baseSize * (0.85 + pulse * 0.25)

      if (s.y < -30) {
        s.y = height + 20
        s.x = Math.random() * width
        const colors = getColors()
        s.color = colors[Math.floor(Math.random() * colors.length)]
      }

      drawStar(ctx, s.x, s.y, currentSize, s.angle, s.color, currentOpacity, s.isSparkle)
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
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(254,252,232,0.9),rgba(248,250,252,1))] transition-opacity duration-300 dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(20,18,36,0.8),rgba(10,13,20,1))]"
    />
    <canvas ref="canvasRef" class="pointer-events-none absolute inset-0 z-0 h-full w-full" />
    <div v-if="$slots.default" class="relative z-10 h-full w-full">
      <slot />
    </div>
  </div>
</template>
