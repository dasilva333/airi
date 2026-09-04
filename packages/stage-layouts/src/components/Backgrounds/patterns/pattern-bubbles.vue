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

interface Bubble {
  x: number
  y: number
  size: number
  speedY: number
  wobbleSpeed: number
  wobbleOffset: number
  opacity: number
  color: string
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, opacity: number) {
  ctx.save()
  ctx.translate(x, y)

  // Outer bubble border
  ctx.globalAlpha = opacity
  ctx.beginPath()
  ctx.arc(0, 0, size, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Soft translucent tint
  ctx.globalAlpha = opacity * 0.18
  ctx.fillStyle = color
  ctx.fill()

  // Primary highlight specular glint (top left)
  ctx.globalAlpha = opacity * 0.85
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(-size * 0.32, -size * 0.32, size * 0.22, 0, Math.PI * 2)
  ctx.fill()

  // Secondary subtle glint (bottom right)
  ctx.globalAlpha = opacity * 0.45
  ctx.beginPath()
  ctx.arc(size * 0.28, size * 0.28, size * 0.1, 0, Math.PI * 2)
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

  const lightColors = ['#38bdf8', '#818cf8', '#2dd4bf', '#f472b6', '#c084fc', '#67e8f9']
  const darkColors = ['#38bdf8', '#818cf8', '#2dd4bf', '#f472b6', '#a78bfa', '#67e8f9']

  function getColors() {
    return isDark.value ? darkColors : lightColors
  }

  const particleCount = 22
  const bubbles: Bubble[] = []

  for (let i = 0; i < particleCount; i++) {
    const colors = getColors()
    bubbles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 16 + 14, // 14px - 30px
      speedY: Math.random() * 0.45 + 0.3,
      wobbleSpeed: Math.random() * 0.025 + 0.015,
      wobbleOffset: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.3 + 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }

  watch(isDark, () => {
    const colors = getColors()
    for (const b of bubbles) {
      b.color = colors[Math.floor(Math.random() * colors.length)]
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

    for (const b of bubbles) {
      b.y -= b.speedY
      b.x += Math.sin(tick * b.wobbleSpeed + b.wobbleOffset) * 0.7

      if (b.y < -40) {
        b.y = height + 30
        b.x = Math.random() * width
        const colors = getColors()
        {
          b.color = colors[Math.floor(Math.random() * colors.length)]
        }
      }

      drawBubble(ctx, b.x, b.y, b.size, b.color, b.opacity)
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
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(240,249,255,0.9),rgba(248,250,252,1))] transition-opacity duration-300 dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(12,25,38,0.8),rgba(10,13,20,1))]"
    />
    <canvas ref="canvasRef" class="pointer-events-none absolute inset-0 z-0 h-full w-full" />
    <div v-if="$slots.default" class="relative z-10 h-full w-full">
      <slot />
    </div>
  </div>
</template>
