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

interface Particle {
  x: number
  y: number
  size: number
  speedY: number
  swaySpeed: number
  swayOffset: number
  opacity: number
  filled: boolean
  color: string
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, filled: boolean, color: string, opacity: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 20, size / 20)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(-10, -10, -20, 5, 0, 18)
  ctx.bezierCurveTo(20, 5, 10, -10, 0, 0)
  ctx.closePath()

  ctx.globalAlpha = opacity
  if (filled) {
    ctx.fillStyle = color
    ctx.fill()
  }
  else {
    ctx.strokeStyle = color
    ctx.lineWidth = 2
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

  const lightColors = ['#f43f5e', '#fb7185', '#ec4899', '#38bdf8', '#818cf8', '#f59e0b', '#10b981']
  const darkColors = ['#f472b6', '#38bdf8', '#fb7185', '#2dd4bf', '#a78bfa', '#fbbf24']

  function getColors() {
    return isDark.value ? darkColors : lightColors
  }

  const particleCount = 28
  const particles: Particle[] = []

  for (let i = 0; i < particleCount; i++) {
    const colors = getColors()
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 16 + 14,
      speedY: Math.random() * 0.5 + 0.3,
      swaySpeed: Math.random() * 0.02 + 0.01,
      swayOffset: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.4 + 0.5,
      filled: Math.random() > 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }

  watch(isDark, () => {
    const colors = getColors()
    for (const p of particles) {
      p.color = colors[Math.floor(Math.random() * colors.length)]
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

    for (const p of particles) {
      p.y -= p.speedY
      p.x += Math.sin(tick * p.swaySpeed + p.swayOffset) * 0.6

      if (p.y < -40) {
        p.y = height + 20
        p.x = Math.random() * width
        const colors = getColors()
        p.color = colors[Math.floor(Math.random() * colors.length)]
      }

      drawHeart(ctx, p.x, p.y, p.size, p.filled, p.color, p.opacity)
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
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(241,245,249,0.9),rgba(248,250,252,1))] transition-opacity duration-300 dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(14,24,42,0.8),rgba(10,13,20,1))]"
    />
    <canvas ref="canvasRef" class="pointer-events-none absolute inset-0 z-0 h-full w-full" />
    <div v-if="$slots.default" class="relative z-10 h-full w-full">
      <slot />
    </div>
  </div>
</template>
