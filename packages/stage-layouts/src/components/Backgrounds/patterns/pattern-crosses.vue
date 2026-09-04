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

interface CrossParticle {
  x: number
  y: number
  size: number
  speedY: number
  angle: number
  rotationSpeed: number
  swaySpeed: number
  swayOffset: number
  opacity: number
  color: string
}

function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, color: string, opacity: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'

  const arm = size / 2
  ctx.beginPath()
  ctx.moveTo(0, -arm)
  ctx.lineTo(0, arm)
  ctx.moveTo(-arm, 0)
  ctx.lineTo(arm, 0)
  ctx.stroke()

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

  const lightColors = ['#0284c7', '#6366f1', '#0d9488', '#8b5cf6', '#64748b']
  const darkColors = ['#38bdf8', '#818cf8', '#2dd4bf', '#a78bfa', '#94a3b8']

  function getColors() {
    return isDark.value ? darkColors : lightColors
  }

  const particleCount = 28
  const crosses: CrossParticle[] = []

  for (let i = 0; i < particleCount; i++) {
    const colors = getColors()
    crosses.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 12 + 10, // 10px - 22px
      speedY: Math.random() * 0.4 + 0.2,
      angle: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02,
      swaySpeed: Math.random() * 0.02 + 0.01,
      swayOffset: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.35 + 0.45,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }

  watch(isDark, () => {
    const colors = getColors()
    for (const c of crosses) {
      c.color = colors[Math.floor(Math.random() * colors.length)]
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

    for (const c of crosses) {
      c.y -= c.speedY
      c.x += Math.sin(tick * c.swaySpeed + c.swayOffset) * 0.5
      c.angle += c.rotationSpeed

      if (c.y < -30) {
        c.y = height + 20
        c.x = Math.random() * width
        const colors = getColors()
        c.color = colors[Math.floor(Math.random() * colors.length)]
      }

      drawCross(ctx, c.x, c.y, c.size, c.angle, c.color, c.opacity)
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
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(240,249,255,0.9),rgba(248,250,252,1))] transition-opacity duration-300 dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(10,20,32,0.8),rgba(10,13,20,1))]"
    />
    <canvas ref="canvasRef" class="pointer-events-none absolute inset-0 z-0 h-full w-full" />
    <div v-if="$slots.default" class="relative z-10 h-full w-full">
      <slot />
    </div>
  </div>
</template>
