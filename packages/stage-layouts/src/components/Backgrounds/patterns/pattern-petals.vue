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

interface Petal {
  x: number
  y: number
  size: number
  speedY: number
  speedX: number
  angle: number
  rotationSpeed: number
  swaySpeed: number
  swayOffset: number
  opacity: number
  color: string
}

function drawPetal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, color: string, opacity: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(size / 20, size / 20)
  ctx.beginPath()
  // Teardrop cherry blossom petal with soft curvature
  ctx.moveTo(0, -12)
  ctx.bezierCurveTo(8, -10, 14, 0, 8, 12)
  ctx.bezierCurveTo(4, 18, -4, 18, -8, 12)
  ctx.bezierCurveTo(-14, 0, -8, -10, 0, -12)
  ctx.closePath()

  ctx.globalAlpha = opacity
  ctx.fillStyle = color
  ctx.fill()
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

  const lightColors = ['#fbcfe8', '#f472b6', '#fda4af', '#fecdd3', '#fb7185', '#ffe4e6']
  const darkColors = ['#f472b6', '#fb7185', '#fda4af', '#f9a8d4', '#f43f5e', '#ec4899']

  function getColors() {
    return isDark.value ? darkColors : lightColors
  }

  const particleCount = 26
  const petals: Petal[] = []

  for (let i = 0; i < particleCount; i++) {
    const colors = getColors()
    petals.push({
      x: Math.random() * (width + 100) - 50,
      y: Math.random() * height,
      size: Math.random() * 12 + 12, // 12px - 24px
      speedY: Math.random() * 0.7 + 0.5, // Downward drift
      speedX: Math.random() * 0.4 + 0.3, // Gentle drift to the right
      angle: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.03,
      swaySpeed: Math.random() * 0.02 + 0.01,
      swayOffset: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.35 + 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }

  watch(isDark, () => {
    const colors = getColors()
    for (const p of petals) {
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

    for (const p of petals) {
      p.y += p.speedY
      p.x += p.speedX + Math.sin(tick * p.swaySpeed + p.swayOffset) * 0.8
      p.angle += p.rotationSpeed

      // Respawn at top if fallen past screen bottom
      if (p.y > height + 30 || p.x > width + 50) {
        p.y = -30
        p.x = Math.random() * (width + 80) - 40
        const colors = getColors()
        p.color = colors[Math.floor(Math.random() * colors.length)]
      }

      drawPetal(ctx, p.x, p.y, p.size, p.angle, p.color, p.opacity)
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
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(253,242,248,0.9),rgba(248,250,252,1))] transition-opacity duration-300 dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(31,14,28,0.8),rgba(10,13,20,1))]"
    />
    <canvas ref="canvasRef" class="pointer-events-none absolute inset-0 z-0 h-full w-full" />
    <div v-if="$slots.default" class="relative z-10 h-full w-full">
      <slot />
    </div>
  </div>
</template>
