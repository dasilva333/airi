<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationFrameId: number | null = null

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
    ctx.lineWidth = 1.5
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

  let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth)
  let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight)

  const handleResize = () => {
    if (!canvas)
      return
    width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth
    height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight
  }
  window.addEventListener('resize', handleResize)

  const colors = ['#f472b6', '#38bdf8', '#fb7185', '#2dd4bf']
  const particleCount = 22
  const particles: Particle[] = []

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 12 + 8, // 8px - 20px
      speedY: Math.random() * 0.4 + 0.2, // Slow upward drift
      swaySpeed: Math.random() * 0.02 + 0.01,
      swayOffset: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.35 + 0.12,
      filled: Math.random() > 0.45,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }

  let tick = 0
  const render = () => {
    ctx.clearRect(0, 0, width, height)
    tick++

    for (const p of particles) {
      p.y -= p.speedY
      p.x += Math.sin(tick * p.swaySpeed + p.swayOffset) * 0.4

      if (p.y < -30) {
        p.y = height + 20
        p.x = Math.random() * width
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
  <div class="relative h-full w-full overflow-hidden bg-[#0a0d14]">
    <!-- Ambient Radial Gradient -->
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(14,24,42,0.8),rgba(10,13,20,1))]" />

    <!-- Particle Canvas Layer -->
    <canvas ref="canvasRef" class="pointer-events-none absolute inset-0 z-0 h-full w-full" />

    <!-- Concentric Stage Platform -->
    <div class="pointer-events-none absolute bottom-[14%] left-1/2 z-1 -translate-x-1/2">
      <!-- Outer Glow Ring -->
      <div class="h-28 w-80 border border-teal-400/20 rounded-[50%] from-teal-500/10 to-transparent bg-gradient-to-t shadow-[0_0_30px_rgba(45,212,191,0.15)] backdrop-blur-[2px] transition-all sm:w-96" />
      <!-- Inner Ring -->
      <div class="absolute inset-x-6 inset-y-3 border border-teal-300/30 rounded-[50%] bg-teal-500/5 shadow-[inset_0_0_15px_rgba(45,212,191,0.2)]" />
      <!-- Center Core Disc -->
      <div class="absolute inset-x-14 inset-y-6 border border-teal-200/40 rounded-[50%] bg-teal-400/10 shadow-[0_0_20px_rgba(45,212,191,0.25)]" />
    </div>

    <!-- Content Slot -->
    <div class="relative z-10 h-full w-full">
      <slot />
    </div>
  </div>
</template>
