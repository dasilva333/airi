import type { WebSocket } from 'ws'

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

import { fileURLToPath } from 'node:url'

import { WebSocketServer } from 'ws'

const here = path.dirname(fileURLToPath(import.meta.url))

// 1. Source .env if present
const localEnvPath = path.join(here, '..', '.env')
if (fs.existsSync(localEnvPath)) {
  const envContent = fs.readFileSync(localEnvPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim()
      if (!process.env[key])
        process.env[key] = val
    }
  }
}

// 2. Source from AIRI stage-tamagotchi server-channel-config.json if not set
if (!process.env.AIRI_AUTH_TOKEN) {
  try {
    const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? ''
    const appDataCandidate = path.join(homeDir, 'Library/Application Support/@proj-airi/stage-tamagotchi/server-channel-config.json')
    if (fs.existsSync(appDataCandidate)) {
      const cfg = JSON.parse(fs.readFileSync(appDataCandidate, 'utf8'))
      if (cfg.authToken)
        process.env.AIRI_AUTH_TOKEN = cfg.authToken
    }
  }
  catch {}
}

const PORT = Number(process.env.MATE_HARNESS_PORT ?? 6171)
const AUTH_TOKEN = process.env.AIRI_AUTH_TOKEN ?? process.env.MATE_AUTH_TOKEN ?? 'mate-stage-dev-token'

// Model discovery
const defaultModel = path.resolve(process.env.MATE_MODEL_PATH ?? path.join(here, '..', 'test-model.vrm'))
const extraModel = process.env.MATE_MODEL_PATH_2 ? path.resolve(process.env.MATE_MODEL_PATH_2) : null

// Find all .vrm files in parent directory
const parentDir = path.join(here, '..')
const discoveredVrms = fs.existsSync(parentDir)
  ? fs.readdirSync(parentDir)
      .filter(f => f.toLowerCase().endsWith('.vrm'))
      .map(f => path.join(parentDir, f))
  : []

const rawCandidates = [defaultModel, extraModel, ...discoveredVrms].filter((p): p is string => typeof p === 'string' && p.length > 0)
const modelPaths = Array.from(new Set(rawCandidates.filter(p => fs.existsSync(p))))
if (modelPaths.length === 0) {
  modelPaths.push(defaultModel)
}

const IDLE_ANIMATIONS = (process.env.MATE_IDLE_ANIMATIONS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

// Macaron Presets
export const MACARON_PRESETS = [
  { id: 'strawberry_cream', name: 'Strawberry Cream (Default)', shell: 'pink', whip: 'berry', heart: 'pink' },
  { id: 'vanilla_strawberry', name: 'Vanilla Strawberry', shell: 'pink', whip: 'milk', heart: 'blue' },
  { id: 'chocolate_berry', name: 'Chocolate Berry', shell: 'pink', whip: 'chocolate', heart: 'brawn' },
  { id: 'mint_fresh', name: 'Mint Fresh', shell: 'blue', whip: 'milk', heart: 'blue' },
  { id: 'blueberry_whip', name: 'Blueberry Whip', shell: 'blue', whip: 'berry', heart: 'purple' },
  { id: 'mint_choco', name: 'Mint Choco', shell: 'blue', whip: 'chocolate', heart: 'brawn' },
  { id: 'matcha_classic', name: 'Matcha Classic', shell: 'green', whip: 'matcha', heart: 'green' },
  { id: 'matcha_milk', name: 'Matcha Milk', shell: 'green', whip: 'milk', heart: 'yellow' },
  { id: 'matcha_chocolate', name: 'Matcha Chocolate', shell: 'green', whip: 'chocolate', heart: 'brawn' },
  { id: 'lemon_custard', name: 'Lemon Custard', shell: 'yellow', whip: 'milk', heart: 'yellow' },
  { id: 'lavender_berry', name: 'Lavender Berry', shell: 'purple', whip: 'berry', heart: 'purple' },
  { id: 'mocha_caramel', name: 'Mocha Caramel', shell: 'brawn', whip: 'chocolate', heart: 'brawn' },
] as const

// State
let activeModelIndex = 0
let activeMacaronIndex = 0
let clientCount = 0
let authenticatedCount = 0
let peerIdentity: string | null = null
let lastEvent = 'Harness started, waiting for sidecar connection...'
let alwaysOnTop = false
let stageVisible = true
let activeSizePreset = 'med.'
let activeViewMode = 'Drag'
let lipSyncInterval: NodeJS.Timeout | null = null
let lipSyncRemaining = 0

// ANSI formatting helpers
const c = {
  reset: '\x1B[0m',
  bold: '\x1B[1m',
  dim: '\x1B[2m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  cyan: '\x1B[36m',
  magenta: '\x1B[35m',
  red: '\x1B[31m',
  blue: '\x1B[34m',
  white: '\x1B[37m',
}

const clients = new Set<WebSocket>()
const authenticatedClients = new Set<WebSocket>()

const wss = new WebSocketServer({ port: PORT })

function broadcast(msg: object) {
  const json = JSON.stringify(msg)
  for (const client of authenticatedClients) {
    if (client.readyState === client.OPEN) {
      client.send(json)
    }
  }
}

function sendLoad(ws: WebSocket, modelPath: string) {
  ws.send(JSON.stringify({
    type: 'stage:vrm:load',
    data: { modelPath },
  }))
}

function logEvent(msg: string) {
  const now = new Date().toTimeString().split(' ')[0]
  lastEvent = `[${now}] ${msg}`
  if (!process.stdout.isTTY) {
    console.log(`[harness ${now}] ${msg}`)
  }
  else {
    render()
  }
}

let activeExpression = 'Neutral'

function render() {
  if (!process.stdout.isTTY)
    return

  const statusDot = authenticatedCount > 0
    ? `${c.green}● AUTHENTICATED (${authenticatedCount})${c.reset}`
    : clientCount > 0
      ? `${c.yellow}○ CONNECTING / AUTH...${c.reset}`
      : `${c.red}○ WAITING FOR SIDECAR${c.reset}`
  const curModel = modelPaths[activeModelIndex] ? path.basename(modelPaths[activeModelIndex]) : '(none)'
  const modelExists = fs.existsSync(modelPaths[activeModelIndex] ?? '')
  const modelStatus = modelExists ? `${c.cyan}${curModel}${c.reset} ${c.dim}[${activeModelIndex + 1}/${modelPaths.length}]${c.reset}` : `${c.red}${curModel} (missing)${c.reset}`
  const aotStatus = alwaysOnTop ? `${c.green}ON${c.reset}` : `${c.dim}OFF${c.reset}`
  const visStatus = stageVisible ? `${c.green}VISIBLE${c.reset}` : `${c.dim}HIDDEN${c.reset}`
  const lipStatus = lipSyncRemaining > 0
    ? `${c.magenta}🗣️ Playing (${(lipSyncRemaining / 10).toFixed(1)}s)${c.reset}`
    : `${c.dim}Idle${c.reset}`
  const exprStatus = activeExpression !== 'Neutral'
    ? `${c.red}${c.bold}😡 ${activeExpression} (Active)${c.reset}`
    : `${c.dim}Neutral${c.reset}`
  const peerStatus = peerIdentity ? `${c.green}${peerIdentity}${c.reset}` : `${c.dim}(unauthenticated)${c.reset}`

  const lines = [
    '\x1B[2J\x1B[H',
    `${c.bold}${c.cyan}╭────────────────────────────────────────────────────────────────────────╮${c.reset}`,
    `${c.bold}${c.cyan}│  AIRI MATE-ENGINE SIDECAR HARNESS (Interactive Control Center)         │${c.reset}`,
    `${c.bold}${c.cyan}╰────────────────────────────────────────────────────────────────────────╯${c.reset}`,
    '',
    `  ${c.bold}Sidecar Link:${c.reset}     ${statusDot}`,
    `  ${c.bold}Peer Identity:${c.reset}    ${peerStatus}`,
    `  ${c.bold}Auth Token:${c.reset}       ${c.dim}${AUTH_TOKEN}${c.reset}`,
    `  ${c.bold}WebSocket URL:${c.reset}    ${c.blue}ws://localhost:${PORT}${c.reset}`,
    `  ${c.bold}Active Model:${c.reset}     ${modelStatus}`,
    `  ${c.bold}Size Preset:${c.reset}      ${c.yellow}${activeSizePreset}${c.reset}`,
    `  ${c.bold}Always-on-Top:${c.reset}    ${aotStatus}`,
    `  ${c.bold}Stage State:${c.reset}      ${visStatus}`,
    `  ${c.bold}View Mode:${c.reset}        ${c.cyan}${activeViewMode}${c.reset}`,
    `  ${c.bold}Expression:${c.reset}       ${exprStatus}`,
    `  ${c.bold}Macaron Flavor:${c.reset}   ${c.magenta}${MACARON_PRESETS[activeMacaronIndex].name}${c.reset} ${c.dim}[${activeMacaronIndex + 1}/${MACARON_PRESETS.length}]${c.reset}`,
    `  ${c.bold}Lip-Sync Telemetry:${c.reset} ${lipStatus}`,
    '',
    `${c.dim}──────────────────────────────────────────────────────────────────────────${c.reset}`,
    `  ${c.bold}Interactive Hotkeys (Customizer-Aligned):${c.reset}`,
    `  ${c.yellow}[1]${c.reset} Mini (220×315)     ${c.yellow}[2]${c.reset} Med. (450×600)    ${c.yellow}[3]${c.reset} Large (800×1000)   ${c.yellow}[4]${c.reset} Full (Workarea)`,
    `  ${c.cyan}[T]${c.reset} Toggle Always-Top  ${c.cyan}[H]${c.reset} Toggle Stage Vis. ${c.cyan}[M]${c.reset} Swap Model (${modelPaths.length})`,
    `  ${c.green}[D]${c.reset} Viewport Drag      ${c.green}[O]${c.reset} Viewport Orbit    ${c.green}[S]${c.reset} Viewport Spin      ${c.green}[C]${c.reset} Cycle Modes`,
    `  ${c.red}[E]${c.reset} Trigger "Angry"    ${c.magenta}[L]${c.reset} Lip-Sync Wave     ${c.magenta}[P]${c.reset} Cycle Macaron (${MACARON_PRESETS.length})`,
    `  ${c.blue}[R]${c.reset} Reset Coordinates ${c.red}[Q]${c.reset} Quit Harness`,
    `${c.dim}──────────────────────────────────────────────────────────────────────────${c.reset}`,
    `  ${c.bold}Last Event:${c.reset} ${c.dim}${lastEvent}${c.reset}`,
    '',
  ]

  process.stdout.write(lines.join('\n'))
}

// Lip-Sync Simulation Runner
function triggerLipSyncSimulation() {
  if (lipSyncInterval) {
    clearInterval(lipSyncInterval)
    lipSyncInterval = null
  }

  lipSyncRemaining = 30 // 3.0 seconds (at 100ms intervals)
  logEvent('Started simulated speech lip-sync waveform')

  let tick = 0
  lipSyncInterval = setInterval(() => {
    tick++
    lipSyncRemaining--

    // Generates a speech-like RMS waveform envelope
    const rawRms = Math.abs(Math.sin(tick * 0.4) * Math.sin(tick * 0.15) + (Math.random() * 0.2 - 0.1))
    const rms = Math.max(0, Math.min(1, rawRms))

    broadcast({
      type: 'stage:vrm:lip-sync',
      data: { rms },
    })

    if (lipSyncRemaining <= 0) {
      if (lipSyncInterval)
        clearInterval(lipSyncInterval)
      lipSyncInterval = null
      broadcast({ type: 'stage:vrm:lip-sync', data: { rms: 0 } })
      logEvent('Completed speech lip-sync simulation')
    }
    else {
      render()
    }
  }, 100)
}

function triggerExpression(name: string, durationMs = 2500) {
  activeExpression = name
  broadcast({
    type: 'stage:vrm:expression',
    data: { name, weight: 1.0, durationMs },
  })
  logEvent(`Sent stage:vrm:expression → ${name} (1.0 for ${(durationMs / 1000).toFixed(1)}s)`)
  render()

  setTimeout(() => {
    if (activeExpression === name) {
      activeExpression = 'Neutral'
      render()
    }
  }, durationMs)
}

function handleKeypress(key: string) {
  const k = key.toLowerCase()

  switch (k) {
    case 'e':
    case 'a':
      triggerExpression('Angry', 2500)
      break
    case '1':
      activeSizePreset = 'mini (220×315)'
      broadcast({ type: 'stage:size-preset', data: { preset: 'mini' } })
      logEvent('Sent stage:size-preset → mini')
      break

    case '2':
      activeSizePreset = 'med. (450×600)'
      broadcast({ type: 'stage:size-preset', data: { preset: 'med.' } })
      logEvent('Sent stage:size-preset → med.')
      break

    case '3':
      activeSizePreset = 'large (800×1000)'
      broadcast({ type: 'stage:size-preset', data: { preset: 'large' } })
      logEvent('Sent stage:size-preset → large')
      break

    case '4':
      activeSizePreset = 'full (workarea)'
      broadcast({ type: 'stage:size-preset', data: { preset: 'full' } })
      logEvent('Sent stage:size-preset → full')
      break

    case 't':
      alwaysOnTop = !alwaysOnTop
      broadcast({ type: 'control:always-on-top', data: { enabled: alwaysOnTop } })
      logEvent(`Sent control:always-on-top → ${alwaysOnTop}`)
      break

    case 'h':
      stageVisible = !stageVisible
      broadcast({ type: 'control:stage', data: { enabled: stageVisible } })
      logEvent(`Sent control:stage → ${stageVisible}`)
      break

    case 'd':
      activeViewMode = 'Drag (Pan)'
      broadcast({ type: 'control:viewport-drag' })
      logEvent('Sent control:viewport-drag')
      break

    case 'o':
      activeViewMode = 'Camera Orbit'
      broadcast({ type: 'control:viewport-orbit' })
      logEvent('Sent control:viewport-orbit')
      break

    case 's':
      activeViewMode = 'Model Spin'
      broadcast({ type: 'control:viewport-tactile' })
      logEvent('Sent control:viewport-tactile (spin)')
      break

    case 'c':
      broadcast({ type: 'control:viewport-cycle-modes' })
      logEvent('Sent control:viewport-cycle-modes')
      break

    case 'r':
      broadcast({ type: 'control:viewport-reset-coordinates' })
      logEvent('Sent control:viewport-reset-coordinates')
      break

    case 'm':
      if (modelPaths.length > 0) {
        activeModelIndex = (activeModelIndex + 1) % modelPaths.length
        const target = modelPaths[activeModelIndex]
        broadcast({ type: 'stage:vrm:load', data: { modelPath: target } })
        logEvent(`Sent stage:vrm:load → ${path.basename(target)}`)
      }
      break

    case 'l':
      triggerLipSyncSimulation()
      break

    case 'p': {
      activeMacaronIndex = (activeMacaronIndex + 1) % MACARON_PRESETS.length
      const p = MACARON_PRESETS[activeMacaronIndex]
      broadcast({
        type: 'stage:prop:macaron',
        data: {
          materials: {
            shell: p.shell,
            whip: p.whip,
            heart: p.heart,
          },
        },
      })
      logEvent(`Sent stage:prop:macaron → ${p.name} (${p.shell}/${p.whip}/${p.heart})`)
      break
    }

    case 'q':
      cleanupAndExit()
      break
  }
}

wss.on('connection', (ws) => {
  clients.add(ws)
  clientCount = clients.size
  logEvent('Client socket connected, awaiting authentication...')

  const pingTimer = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', data: { t: Date.now() } }))
    }
  }, 2000)

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())

      // 1. Handshake Step 1: Authentication
      if (msg.type === 'module:authenticate') {
        const token = msg.data?.token
        const caller = msg.data?.caller ?? 'stage-mate'
        const purpose = msg.data?.purpose ?? 'Native VRM Stage Renderer'

        if (token === AUTH_TOKEN) {
          authenticatedClients.add(ws)
          authenticatedCount = authenticatedClients.size
          peerIdentity = `${caller}`
          ws.send(JSON.stringify({
            type: 'module:authenticated',
            data: { authenticated: true },
          }))
          logEvent(`Auth SUCCESS: ${caller} (${purpose})`)
        }
        else {
          ws.send(JSON.stringify({
            type: 'module:authenticated',
            data: { authenticated: false, error: 'Invalid token' },
          }))
          logEvent(`Auth REJECTED: invalid token from ${caller}`)
          ws.close()
        }
        render()
        return
      }

      // 2. Handshake Step 2: Announcement
      if (msg.type === 'module:announce') {
        if (!authenticatedClients.has(ws)) {
          ws.close()
          return
        }

        peerIdentity = msg.data?.name ?? 'proj-airi:stage-mate'
        ws.send(JSON.stringify({
          type: 'module:announced',
          data: { ok: true, name: peerIdentity },
        }))
        logEvent(`Announced: ${peerIdentity}`)

        // Send initial state to newly authenticated peer
        if (modelPaths.length > 0 && modelPaths[activeModelIndex]) {
          sendLoad(ws, modelPaths[activeModelIndex])
        }

        if (IDLE_ANIMATIONS.length > 0) {
          ws.send(JSON.stringify({
            type: 'stage:vrm:idle',
            data: { idleAnimations: IDLE_ANIMATIONS },
          }))
        }
        render()
        return
      }

      // Block unauthenticated messages from non-handshake events
      if (!authenticatedClients.has(ws)) {
        logEvent(`Blocked unauthenticated message: ${msg.type}`)
        return
      }

      if (msg.type === 'stage:vrm:ready') {
        logEvent(`Sidecar ready with: ${path.basename(msg.data?.modelPath ?? '')}`)
      }
      else {
        logEvent(`rx: ${data.toString()}`)
      }
    }
    catch {
      logEvent(`rx: ${data.toString()}`)
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
    authenticatedClients.delete(ws)
    clientCount = clients.size
    authenticatedCount = authenticatedClients.size
    if (authenticatedCount === 0)
      peerIdentity = null
    clearInterval(pingTimer)
    logEvent('Sidecar client disconnected')
    render()
  })

  ws.on('error', (err) => {
    logEvent(`WS error: ${err.message}`)
  })
})

function cleanupAndExit() {
  if (lipSyncInterval)
    clearInterval(lipSyncInterval)
  process.stdout.write('\n\x1B[0m[harness] shutting down\n')
  wss.close()
  process.exit(0)
}

process.on('SIGINT', cleanupAndExit)
process.on('SIGTERM', cleanupAndExit)

// Initialize TTY raw mode for live keypresses
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
      cleanupAndExit()
    }
    handleKeypress(key.name ?? str ?? '')
  })
}

// Initial render
render()
setInterval(render, 1000)
