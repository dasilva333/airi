import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

import { WebSocketServer } from 'ws'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.MATE_HARNESS_PORT ?? 6171)
const MODEL_PATH = path.resolve(process.env.MATE_MODEL_PATH ?? path.join(here, '..', 'test-model.vrm'))
const MODEL_PATH_2 = process.env.MATE_MODEL_PATH_2
  ? path.resolve(process.env.MATE_MODEL_PATH_2)
  : null
const SWAP_MS = Number(process.env.MATE_MODEL_SWAP_MS ?? 30_000)
const IDLE_ANIMATIONS = (process.env.MATE_IDLE_ANIMATIONS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const modelPaths = [MODEL_PATH, MODEL_PATH_2].filter((p): p is string => Boolean(p))

console.log(`[harness] model paths: ${modelPaths.join(' | ')}`)
console.log(`[harness] model exists: ${modelPaths.map(p => `${path.basename(p)}=${fs.existsSync(p)}`).join(', ')}`)
console.log(`[harness] swap interval: ${SWAP_MS}ms`)
console.log(`[harness] idle animations: ${IDLE_ANIMATIONS.length > 0 ? IDLE_ANIMATIONS.join(', ') : '(none)'}`)

const wss = new WebSocketServer({ port: PORT })
console.log(`[harness] listening on ws://localhost:${PORT}`)

function sendLoad(ws: { send: (data: string) => void }, modelPath: string) {
  ws.send(JSON.stringify({
    type: 'stage:vrm:load',
    data: { modelPath },
  }))
}

wss.on('connection', (ws) => {
  console.log('[harness] client connected')

  let index = 0
  sendLoad(ws, modelPaths[index])

  // Ping-pong between models on the swap interval (only when 2+ models configured).
  let swapTimer: ReturnType<typeof setInterval> | null = null
  if (modelPaths.length > 1) {
    swapTimer = setInterval(() => {
      if (ws.readyState !== ws.OPEN)
        return
      index = (index + 1) % modelPaths.length
      console.log(`[harness] swap → ${path.basename(modelPaths[index])}`)
      sendLoad(ws, modelPaths[index])
    }, SWAP_MS)
  }

  if (IDLE_ANIMATIONS.length > 0) {
    ws.send(JSON.stringify({
      type: 'stage:vrm:idle',
      data: { idleAnimations: IDLE_ANIMATIONS },
    }))
  }

  const ping = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', data: { t: Date.now() } }))
    }
  }, 2000)

  ws.on('message', (data) => {
    console.log('[harness] rx:', data.toString())
  })

  ws.on('close', () => {
    console.log('[harness] client disconnected')
    clearInterval(ping)
    if (swapTimer)
      clearInterval(swapTimer)
  })

  ws.on('error', (err) => {
    console.error('[harness] ws error:', err.message)
  })
})

process.on('SIGINT', () => {
  console.log('\n[harness] shutting down')
  wss.close()
  process.exit(0)
})
