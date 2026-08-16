import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

import { WebSocketServer } from 'ws'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.MATE_HARNESS_PORT ?? 6171)
const MODEL_PATH = path.resolve(process.env.MATE_MODEL_PATH ?? path.join(here, '..', 'test-model.vrm'))

console.log(`[harness] model path: ${MODEL_PATH}`)
console.log(`[harness] model exists: ${fs.existsSync(MODEL_PATH)}`)

const wss = new WebSocketServer({ port: PORT })
console.log(`[harness] listening on ws://localhost:${PORT}`)

wss.on('connection', (ws) => {
  console.log('[harness] client connected')

  ws.send(JSON.stringify({
    type: 'stage:vrm:load',
    data: { modelPath: MODEL_PATH },
  }))

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
