<script setup lang="ts">
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { storeToRefs } from 'pinia'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{
  (e: 'ready'): void
}>()

const airiCardStore = useAiriCardStore()
const { activeCard } = storeToRefs(airiCardStore)

// --- Game Engine State (2048 Retro Canvas) ---
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isCanvasFocused = ref(false)
const score = ref(0)
const bestScore = ref(0)
const isGameOver = ref(false)
const isGameWon = ref(false)
const isPaused = ref(false)
const isMuted = ref(false)

// Grid: 4x4 array of numbers (0 = empty)
let board: number[][] = [
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
]

// WebAudio Sound Synthesis (Zero external audio assets)
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
    audioCtx = new AudioCtxClass()
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

function playBeep(freq = 440, durationMs = 80, type: OscillatorType = 'sine') {
  if (isMuted.value)
    return
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + durationMs / 1000)
  }
  catch {
    // Audio context may be restricted before user gesture
  }
}

// Retro Color Palette
const TILE_COLORS: Record<number, { bg: string, text: string }> = {
  0: { bg: '#1c1c24', text: 'transparent' },
  2: { bg: '#2b2d42', text: '#edf2f4' },
  4: { bg: '#3a3d5c', text: '#edf2f4' },
  8: { bg: '#e07a5f', text: '#ffffff' },
  16: { bg: '#d65a31', text: '#ffffff' },
  32: { bg: '#e63946', text: '#ffffff' },
  64: { bg: '#ff0054', text: '#ffffff' },
  128: { bg: '#f4a261', text: '#ffffff' },
  256: { bg: '#e76f51', text: '#ffffff' },
  512: { bg: '#9b5de5', text: '#ffffff' },
  1024: { bg: '#00bbf9', text: '#ffffff' },
  2048: { bg: '#00f5d4', text: '#111111' },
}

function spawnRandomTile() {
  const emptyCoords: [number, number][] = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === 0)
        emptyCoords.push([r, c])
    }
  }
  if (emptyCoords.length === 0)
    return
  const [r, c] = emptyCoords[Math.floor(Math.random() * emptyCoords.length)]
  board[r][c] = Math.random() < 0.9 ? 2 : 4
}

function initGame() {
  board = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]
  score.value = 0
  isGameOver.value = false
  isGameWon.value = false
  isPaused.value = false
  spawnRandomTile()
  spawnRandomTile()
  drawBoard()
  playBeep(520, 100, 'triangle')
}

function checkGameOver(): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === 0)
        return false
      if (r < 3 && board[r][c] === board[r + 1][c])
        return false
      if (c < 3 && board[r][c] === board[r][c + 1])
        return false
    }
  }
  return true
}

function slide(row: number[]): { newRow: number[], gainedScore: number, merged: boolean } {
  const filtered = row.filter(val => val !== 0)
  let gainedScore = 0
  let merged = false

  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] === filtered[i + 1]) {
      filtered[i] *= 2
      gainedScore += filtered[i]
      filtered.splice(i + 1, 1)
      merged = true
    }
  }
  while (filtered.length < 4) {
    filtered.push(0)
  }
  return { newRow: filtered, gainedScore, merged }
}

function move(direction: 'left' | 'right' | 'up' | 'down') {
  if (isGameOver.value || isPaused.value)
    return

  let moved = false
  let turnScore = 0
  let hadMerge = false

  if (direction === 'left') {
    for (let r = 0; r < 4; r++) {
      const { newRow, gainedScore, merged } = slide(board[r])
      if (board[r].join(',') !== newRow.join(','))
        moved = true
      board[r] = newRow
      turnScore += gainedScore
      if (merged)
        hadMerge = true
    }
  }
  else if (direction === 'right') {
    for (let r = 0; r < 4; r++) {
      const reversed = [...board[r]].reverse()
      const { newRow, gainedScore, merged } = slide(reversed)
      newRow.reverse()
      if (board[r].join(',') !== newRow.join(','))
        moved = true
      board[r] = newRow
      turnScore += gainedScore
      if (merged)
        hadMerge = true
    }
  }
  else if (direction === 'up') {
    for (let c = 0; c < 4; c++) {
      const col = [board[0][c], board[1][c], board[2][c], board[3][c]]
      const { newRow, gainedScore, merged } = slide(col)
      for (let r = 0; r < 4; r++) {
        if (board[r][c] !== newRow[r])
          moved = true
        board[r][c] = newRow[r]
      }
      turnScore += gainedScore
      if (merged)
        hadMerge = true
    }
  }
  else if (direction === 'down') {
    for (let c = 0; c < 4; c++) {
      const col = [board[3][c], board[2][c], board[1][c], board[0][c]]
      const { newRow, gainedScore, merged } = slide(col)
      for (let r = 0; r < 4; r++) {
        if (board[3 - r][c] !== newRow[r])
          moved = true
        board[3 - r][c] = newRow[r]
      }
      turnScore += gainedScore
      if (merged)
        hadMerge = true
    }
  }

  if (moved) {
    score.value += turnScore
    if (score.value > bestScore.value)
      bestScore.value = score.value

    if (hadMerge)
      playBeep(660, 100, 'square')
    else
      playBeep(320, 60, 'sine')

    spawnRandomTile()
    drawBoard()

    // Trigger proactive avatar reaction on high-score or merge
    if (turnScore >= 64) {
      triggerReactiveReaction(`Nice combo! +${turnScore} points!`, 'smug')
    }

    if (checkGameOver()) {
      isGameOver.value = true
      playBeep(180, 400, 'sawtooth')
      triggerReactiveReaction('Oh no, no more valid moves! Game Over!', 'panicked')
      drawBoard()
    }
  }
}

function drawBoard() {
  const canvas = canvasRef.value
  if (!canvas)
    return
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  const size = canvas.width
  const padding = 12
  const tileSize = (size - padding * 5) / 4

  // Background
  ctx.fillStyle = '#121218'
  ctx.fillRect(0, 0, size, size)

  // Draw Tiles
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = board[r][c]
      const x = padding + c * (tileSize + padding)
      const y = padding + r * (tileSize + padding)
      const color = TILE_COLORS[val] || { bg: '#ff007f', text: '#ffffff' }

      // Round rectangle tile
      ctx.fillStyle = color.bg
      drawRoundedRect(ctx, x, y, tileSize, tileSize, 8)
      ctx.fill()

      // Value text
      if (val > 0) {
        ctx.fillStyle = color.text
        ctx.font = `bold ${val >= 1024 ? tileSize * 0.32 : tileSize * 0.42}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(val.toString(), x + tileSize / 2, y + tileSize / 2 + 2)
      }
    }
  }

  // CRT Scanlines overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
  for (let y = 0; y < size; y += 4) {
    ctx.fillRect(0, y, size, 2)
  }

  // Game over overlay
  if (isGameOver.value) {
    ctx.fillStyle = 'rgba(10, 10, 15, 0.85)'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#ff4d6d'
    ctx.font = 'bold 36px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('GAME OVER', size / 2, size / 2 - 20)
    ctx.font = '14px monospace'
    ctx.fillStyle = '#edf2f4'
    ctx.fillText('Press [R] or click Reset to play again', size / 2, size / 2 + 24)
  }
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// Keyboard Input Trapping
function handleCanvasKeyDown(e: KeyboardEvent) {
  if (!isCanvasFocused.value)
    return

  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyP']
  if (keys.includes(e.code)) {
    e.preventDefault()
  }

  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      move('left')
      break
    case 'ArrowRight':
    case 'KeyD':
      move('right')
      break
    case 'ArrowUp':
    case 'KeyW':
      move('up')
      break
    case 'ArrowDown':
    case 'KeyS':
      move('down')
      break
    case 'KeyR':
      initGame()
      break
    case 'KeyP':
      isPaused.value = !isPaused.value
      break
  }
}

function focusCanvas() {
  isCanvasFocused.value = true
  canvasRef.value?.focus()
}

// --- Backseat Chat & Banter Stream ---
interface BackseatMessage {
  id: string
  sender: 'character' | 'user'
  authorName: string
  text: string
  timestamp: string
  emotion?: 'neutral' | 'smug' | 'panicked' | 'cheering' | 'thinking'
  isAdvice?: boolean
}

const chatTranscript = ref<BackseatMessage[]>([
  {
    id: 'msg-1',
    sender: 'character',
    authorName: activeCard.value?.name || 'AIRI',
    text: 'Welcome to the Arcade Room! Pick your moves carefully, or let me know if you want my strategic input!',
    timestamp: 'Just now',
    emotion: 'smug',
  },
])

const userInputText = ref('')
const transcriptContainerRef = ref<HTMLDivElement | null>(null)

function scrollToBottom() {
  void nextTick(() => {
    if (transcriptContainerRef.value) {
      transcriptContainerRef.value.scrollTop = transcriptContainerRef.value.scrollHeight
    }
  })
}

function triggerReactiveReaction(text: string, emotion: BackseatMessage['emotion'] = 'neutral') {
  chatTranscript.value.push({
    id: `react-${Date.now()}`,
    sender: 'character',
    authorName: activeCard.value?.name || 'AIRI',
    text,
    timestamp: 'Just now',
    emotion,
  })
  scrollToBottom()
}

function handleSendAdvice(presetText?: string) {
  const content = presetText || userInputText.value.trim()
  if (!content)
    return

  // Add User Backseat Advice
  chatTranscript.value.push({
    id: `user-${Date.now()}`,
    sender: 'user',
    authorName: 'You',
    text: content,
    timestamp: 'Just now',
    isAdvice: true,
  })
  userInputText.value = ''
  scrollToBottom()

  // Simulate Character Reacting to Backseat Advice
  setTimeout(() => {
    const replies = [
      { text: 'Got it! Sliding into that corner!', emotion: 'cheering' },
      { text: 'Wait, are you sure about that move?!', emotion: 'panicked' },
      { text: 'Hmph, I had that completely under control anyway.', emotion: 'smug' },
      { text: 'Good eye! That opened up a whole new space.', emotion: 'cheering' },
    ] as const
    const pick = replies[Math.floor(Math.random() * replies.length)]
    triggerReactiveReaction(pick.text, pick.emotion)
  }, 750)
}

onMounted(() => {
  initGame()
  emit('ready')
})

onUnmounted(() => {
  if (audioCtx) {
    void audioCtx.close()
  }
})
</script>

<template>
  <div class="h-full w-full flex overflow-hidden bg-neutral-100/60 dark:bg-neutral-950/40">
    <!-- 1. LEFT PANE: Retro Game Viewport (65% width) -->
    <div class="relative h-full flex flex-1 flex-col overflow-hidden border-r border-neutral-200/50 p-4 dark:border-neutral-800/50">
      <!-- Game Top Toolbar -->
      <div class="mb-3 flex items-center justify-between border border-neutral-200/40 rounded-xl bg-white/70 px-4 py-2.5 shadow-sm backdrop-blur-md dark:border-neutral-800/40 dark:bg-neutral-900/60">
        <!-- Title & Preset -->
        <div class="flex items-center gap-3">
          <div class="i-solar:gamepad-bold-duotone text-xl text-primary-500" />
          <div>
            <h3 class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
              2048 Retro Canvas
            </h3>
            <span class="text-[10px] text-neutral-500 font-medium">Zero-Dependency Web Engine</span>
          </div>
        </div>

        <!-- Score & Best -->
        <div class="flex items-center gap-3">
          <div class="flex flex-col items-center rounded-lg bg-neutral-100 px-3 py-1 dark:bg-neutral-800">
            <span class="text-[9px] text-neutral-400 font-bold tracking-wider uppercase">Score</span>
            <span class="text-xs text-neutral-900 font-bold dark:text-neutral-100">{{ score }}</span>
          </div>
          <div class="flex flex-col items-center rounded-lg bg-neutral-100 px-3 py-1 dark:bg-neutral-800">
            <span class="text-[9px] text-neutral-400 font-bold tracking-wider uppercase">Best</span>
            <span class="text-xs text-amber-500 font-bold">{{ bestScore }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1.5">
          <button
            class="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            title="Mute / Unmute"
            @click="isMuted = !isMuted"
          >
            <div :class="isMuted ? 'i-solar:volume-cross-bold' : 'i-solar:volume-loud-bold'" class="text-base" />
          </button>
          <button
            class="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            title="Restart Game"
            @click="initGame"
          >
            <div class="i-solar:restart-bold text-base" />
          </button>
          <div class="ml-2 flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-500 font-bold">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span>Interactive Spectator</span>
          </div>
        </div>
      </div>

      <!-- Main Canvas Container with Aspect-Ratio Lock & Retro Bezel -->
      <div class="relative flex flex-1 items-center justify-center overflow-hidden">
        <div
          class="relative cursor-pointer border-4 rounded-2xl p-2 shadow-2xl transition-all duration-300"
          :class="isCanvasFocused
            ? 'border-primary-500/80 shadow-primary-500/20 ring-4 ring-primary-500/10'
            : 'border-neutral-800/80 hover:border-neutral-700'"
          @click="focusCanvas"
        >
          <!-- Retro Bezel Badge -->
          <div class="absolute left-4 top-4 z-10 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[9px] text-neutral-400 tracking-widest font-mono uppercase backdrop-blur-sm">
            <span>CRT 60FPS</span>
          </div>

          <!-- HTML5 Canvas -->
          <canvas
            ref="canvasRef"
            tabindex="0"
            width="420"
            height="420"
            class="block rounded-xl outline-none"
            @keydown="handleCanvasKeyDown"
            @focus="isCanvasFocused = true"
            @blur="isCanvasFocused = false"
          />

          <!-- Unfocused Click Overlay -->
          <div
            v-if="!isCanvasFocused"
            class="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/40 backdrop-blur-[2px] transition-all"
          >
            <div class="i-solar:keyboard-bold mb-2 animate-bounce text-3xl text-white/90" />
            <span class="rounded-full bg-neutral-900/80 px-3.5 py-1.5 text-xs text-white font-bold tracking-wide shadow-lg">
              Click to Control Canvas
            </span>
            <span class="mt-1 text-[10px] text-white/60 font-medium">Use Arrow Keys or WASD</span>
          </div>
        </div>
      </div>

      <!-- Bottom Status & Controls Guide -->
      <div class="mt-3 flex items-center justify-between px-2 text-[11px] text-neutral-500 dark:text-neutral-400">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1">
            <kbd class="border border-neutral-300 rounded bg-neutral-200/50 px-1.5 py-0.5 text-[10px] font-mono dark:border-neutral-700 dark:bg-neutral-800">Arrows / WASD</kbd>
            Move
          </span>
          <span class="flex items-center gap-1">
            <kbd class="border border-neutral-300 rounded bg-neutral-200/50 px-1.5 py-0.5 text-[10px] font-mono dark:border-neutral-700 dark:bg-neutral-800">R</kbd>
            Restart
          </span>
          <span class="flex items-center gap-1">
            <kbd class="border border-neutral-300 rounded bg-neutral-200/50 px-1.5 py-0.5 text-[10px] font-mono dark:border-neutral-700 dark:bg-neutral-800">P</kbd>
            Pause
          </span>
        </div>
        <div class="text-[10px] text-neutral-400">
          Phase 1 Prototype &bull; Phase 2: JS-DOS Doom &amp; Civ
        </div>
      </div>
    </div>

    <!-- 2. RIGHT PANE: Backseat Chat Stream (35% width, w-88 to w-96) -->
    <div class="w-88 flex flex-col bg-white/40 backdrop-blur-md dark:bg-neutral-950/20">
      <!-- Backseat Header -->
      <div class="flex items-center justify-between border-b border-neutral-200/40 p-3.5 dark:border-neutral-800/40">
        <div class="flex items-center gap-2.5">
          <div class="h-7 w-7 flex items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
            <div class="i-solar:chat-line-bold-duotone text-base" />
          </div>
          <div>
            <h4 class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
              {{ activeCard?.name || 'Airi' }}'s Live Reactions
            </h4>
            <span class="text-[10px] text-emerald-500 font-semibold">● Spectating Game</span>
          </div>
        </div>
      </div>

      <!-- Transcript Feed -->
      <div
        ref="transcriptContainerRef"
        class="flex-1 overflow-y-auto p-4 space-y-3"
      >
        <template v-for="msg in chatTranscript" :key="msg.id">
          <!-- Character Dialogue Bubble -->
          <div v-if="msg.sender === 'character'" class="flex flex-col items-start gap-1">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] text-neutral-400 font-bold">{{ msg.authorName }}</span>
              <span
                v-if="msg.emotion && msg.emotion !== 'neutral'"
                class="rounded-full px-1.5 py-0.2 text-[8px] font-bold tracking-wider uppercase"
                :class="msg.emotion === 'smug'
                  ? 'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300'
                  : msg.emotion === 'panicked'
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'"
              >
                {{ msg.emotion }}
              </span>
            </div>
            <div class="max-w-[90%] rounded-2xl rounded-tl-none bg-white p-3 text-xs text-neutral-800 leading-relaxed shadow-sm dark:bg-neutral-800/80 dark:text-neutral-200">
              {{ msg.text }}
            </div>
          </div>

          <!-- User Backseat Tip Bubble -->
          <div v-else class="flex flex-col items-end gap-1">
            <span class="text-[10px] text-neutral-400 font-bold">You (Backseat Tip)</span>
            <div class="max-w-[90%] rounded-2xl rounded-tr-none bg-primary-500 p-3 text-xs text-white leading-relaxed shadow-sm">
              {{ msg.text }}
            </div>
          </div>
        </template>
      </div>

      <!-- Quick Backseat Advice Chips -->
      <div class="border-t border-neutral-200/30 px-3 py-2 dark:border-neutral-800/30">
        <div class="mb-1 text-[9px] text-neutral-400 font-bold tracking-wider uppercase">
          Quick Backseat Calls
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="tip in ['Watch the corner!', 'Swipe Left!', 'Merge down!', 'Nice move!']"
            :key="tip"
            class="rounded-lg bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-primary-50 dark:text-neutral-300 hover:text-primary-600 dark:hover:bg-primary-950/30 dark:hover:text-primary-400"
            @click="handleSendAdvice(tip)"
          >
            {{ tip }}
          </button>
        </div>
      </div>

      <!-- Minimal Backseat Composer -->
      <div class="border-t border-neutral-200/40 p-3 dark:border-neutral-800/40">
        <form
          class="flex items-center gap-2 rounded-xl bg-white/80 p-1.5 shadow-sm ring-1 ring-neutral-200/60 dark:bg-neutral-900/80 dark:ring-neutral-800/60"
          @submit.prevent="handleSendAdvice()"
        >
          <input
            v-model="userInputText"
            type="text"
            placeholder="Give backseat advice..."
            class="flex-1 bg-transparent px-2 text-xs text-neutral-800 outline-none dark:text-neutral-200 placeholder:text-neutral-400"
            @keydown.stop
          >
          <button
            type="submit"
            :disabled="!userInputText.trim()"
            class="h-7 w-7 flex items-center justify-center rounded-lg bg-primary-500 text-white transition-opacity disabled:opacity-40"
          >
            <div class="i-solar:plain-bold text-xs" />
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
