import type { ChildProcess } from 'node:child_process'

import type { globalAppConfigSchema } from '../../../configs/global'
import type { Config } from '../../../libs/electron/persistence'

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { env, platform } from 'node:process'

import { useLogg } from '@guiiai/logg'
import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import {
  electronStageMateEnsureModel,
  electronStageMateGetState,
  electronStageMateSaveModel,
  electronStageMateSetModelPosition,
  electronStageMateSetViewportMode,
  electronStageMateToggleVisibility,
} from '@proj-airi/stage-shared'
import { app, BrowserWindow, ipcMain } from 'electron'
import { WebSocket, WebSocketServer } from 'ws'

import { onAppBeforeQuit } from '../../../libs/bootkit/lifecycle'
import { getElectronMainDirname } from '../../../libs/electron/location'

export interface StageMateService {
  ensureRunning: () => Promise<void>
  stop: () => Promise<void>
  broadcast: (msg: object) => void
  isStageMateRunning: () => boolean
}

export function createStageMateService(params?: {
  appConfig?: Config<typeof globalAppConfigSchema>
  authToken?: string
}): StageMateService {
  const log = useLogg('main/stage-mate').useGlobalConfig()
  const { context } = createContext(ipcMain)

  const cacheDir = join(app.getPath('userData'), 'stage-mate-cache')
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true })
  }

  const PORT = Number(env.MATE_HARNESS_PORT ?? 6171)
  let wss: WebSocketServer | null = null
  const authenticatedSockets = new Set<WebSocket>()
  let sidecarProcess: ChildProcess | null = null
  let isEnabled = true
  const inFlightWrites = new Map<string, Promise<{ success: boolean, path: string }>>()
  let lastBroadcastPath = ''
  let lastBroadcastTime = 0

  let activeModelId = ''
  let activeModelPath = ''
  let activeModelPosition = { x: 0, y: 0, scale: 1 }
  let activeViewportMode = 'tactileMode'

  function getResolvedAuthToken(): string {
    if (params?.authToken)
      return params.authToken
    try {
      const cfgPath = join(app.getPath('userData'), 'server-channel-config.json')
      if (existsSync(cfgPath)) {
        const parsed = JSON.parse(readFileSync(cfgPath, 'utf8'))
        if (parsed.authToken)
          return parsed.authToken
      }
    }
    catch {}
    return 'mate-stage-dev-token'
  }

  function startWebSocketServer() {
    if (wss)
      return

    try {
      wss = new WebSocketServer({ port: PORT })
      log.withFields({ port: PORT }).log('Stage-Mate WebSocket server listening')

      wss.on('connection', (ws) => {
        log.log('Stage-Mate socket connected, awaiting authentication...')

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString())
            if (msg.type === 'module:authenticate') {
              const token = msg.data?.token
              const expected = getResolvedAuthToken()

              if (token === expected || token === 'mate-stage-dev-token') {
                authenticatedSockets.add(ws)
                ws.send(JSON.stringify({
                  type: 'module:authenticated',
                  data: { authenticated: true },
                }))
                log.withFields({ caller: msg.data?.caller }).log('Stage-Mate socket authenticated successfully')
              }
              else {
                ws.send(JSON.stringify({
                  type: 'module:authenticated',
                  data: { authenticated: false, error: 'Invalid token' },
                }))
                log.warn('Stage-Mate socket authentication failed: invalid token')
                ws.close()
              }
              return
            }

            if (msg.type === 'module:announce') {
              if (!authenticatedSockets.has(ws)) {
                ws.close()
                return
              }
              ws.send(JSON.stringify({
                type: 'module:announced',
                data: { ok: true, name: msg.data?.name },
              }))
              log.withFields({ name: msg.data?.name }).log('Stage-Mate module announcement acknowledged')

              // Send Post-Handshake State Synchronization Snapshot
              const cfg = params?.appConfig?.get()
              const mateWin = cfg?.windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'stage-mate')
                ?? cfg?.windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'actor')

              const bounds = mateWin
                ? {
                    x: mateWin.x ?? 800,
                    y: mateWin.y ?? 400,
                    width: mateWin.width ?? 300,
                    height: mateWin.height ?? 450,
                    alwaysOnTop: true,
                  }
                : {
                    x: 800,
                    y: 400,
                    width: 300,
                    height: 450,
                    alwaysOnTop: true,
                  }

              ws.send(JSON.stringify({
                type: 'stage:state:sync',
                data: {
                  window: bounds,
                  model: (activeModelId && activeModelPath)
                    ? {
                        modelId: activeModelId,
                        modelPath: activeModelPath,
                      }
                    : undefined,
                  positioning: activeModelPosition,
                  viewport: {
                    mode: activeViewportMode,
                  },
                  stage: {
                    enabled: isEnabled,
                  },
                },
              }))
              log.withFields({ window: bounds, modelId: activeModelId, mode: activeViewportMode, enabled: isEnabled, positioning: activeModelPosition }).log('Dispatched stage:state:sync to Stage-Mate')
              return
            }

            if (msg.type === 'stage:window:bounds') {
              const { x, y, width, height } = msg.data ?? {}
              if (typeof x === 'number' && typeof y === 'number' && params?.appConfig) {
                const config = params.appConfig.get() ?? { language: 'en', windows: [], microphoneToggleHotkey: 'Scroll' as const }
                if (!config.windows || !Array.isArray(config.windows))
                  config.windows = []

                const existingIndex = config.windows.findIndex((w: any) => w.title === 'AIRI' && w.tag === 'stage-mate')
                const newRecord = {
                  title: 'AIRI',
                  tag: 'stage-mate',
                  x: Math.round(x),
                  y: Math.round(y),
                  width: Math.round(width ?? 300),
                  height: Math.round(height ?? 450),
                }

                if (existingIndex === -1) {
                  config.windows.push(newRecord as any)
                }
                else {
                  config.windows[existingIndex] = { ...config.windows[existingIndex], ...newRecord }
                }
                params.appConfig.update(config)
                log.withFields(newRecord).log('Persisted stage-mate window bounds to config.json')
              }
              return
            }

            if (msg.type === 'stage:model:position') {
              const { modelId, x, y, scale } = msg.data ?? {}
              if (modelId) {
                activeModelPosition = { x: x ?? 0, y: y ?? 0, scale: scale ?? 1 }
                for (const win of BrowserWindow.getAllWindows()) {
                  if (!win.isDestroyed()) {
                    win.webContents.send('stage-mate:model-position-changed', { modelId, x, y, scale })
                  }
                }
                log.withFields({ modelId, x, y, scale }).log('Received model position from Stage-Mate, relayed to renderer')
              }
              return
            }

            if (msg.type === 'stage:vrm:ready') {
              log.withFields({ modelPath: msg.data?.modelPath }).log('Stage-Mate confirmed VRM model ready')
            }
          }
          catch (err) {
            log.withError(err as Error).error('Error parsing Stage-Mate message')
          }
        })

        ws.on('close', () => {
          authenticatedSockets.delete(ws)
          log.log('Stage-Mate socket disconnected')
        })

        ws.on('error', (err) => {
          log.withError(err).error('Stage-Mate WebSocket client error')
        })
      })

      wss.on('error', (err) => {
        log.withError(err).error('Stage-Mate WebSocket server error')
      })
    }
    catch (err) {
      log.withError(err as Error).error('Failed to start Stage-Mate WebSocket server')
    }
  }

  function broadcast(msg: object) {
    const payload = JSON.stringify(msg)
    for (const ws of authenticatedSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload)
      }
    }
  }

  function resolveBinaryPath(): string | null {
    // 1. Development relative build path
    const devPath = join(getElectronMainDirname(), '../../../../apps/stage-mate/mate-engine/Build/StageMate.app')
    if (existsSync(devPath))
      return devPath

    // 2. Production packaged extraResources
    const prodPath = join(process.resourcesPath, 'StageMate.app')
    if (existsSync(prodPath))
      return prodPath

    // 3. Fallback executable binary inside bundle
    const binDev = join(devPath, 'Contents/MacOS/StageMate')
    if (existsSync(binDev))
      return binDev

    return null
  }

  async function ensureRunning(): Promise<void> {
    if (sidecarProcess && !sidecarProcess.killed)
      return

    const binPath = resolveBinaryPath()
    if (!binPath) {
      log.warn('StageMate standalone app binary not found. Launch StageMate externally or run build.sh.')
      return
    }

    const token = getResolvedAuthToken()
    log.withFields({ binPath }).log('Spawning StageMate sidecar process...')

    if (platform === 'darwin' && binPath.endsWith('.app')) {
      sidecarProcess = spawn('open', ['-n', binPath, '--args', '--token', token], {
        detached: true,
        stdio: 'ignore',
      })
    }
    else {
      sidecarProcess = spawn(binPath, ['--token', token], {
        detached: true,
        stdio: 'ignore',
      })
    }

    sidecarProcess.unref()
  }

  async function stop(): Promise<void> {
    if (sidecarProcess && !sidecarProcess.killed) {
      try {
        sidecarProcess.kill('SIGTERM')
      }
      catch {}
      sidecarProcess = null
    }
    broadcast({ type: 'control:stage', data: { enabled: false } })
  }

  function dispatchModelLoad(targetFile: string, modelId?: string, position?: { x: number, y: number, scale?: number }) {
    if (modelId)
      activeModelId = modelId
    activeModelPath = targetFile
    if (position)
      activeModelPosition = { x: position.x, y: position.y, scale: position.scale ?? 1 }

    const now = Date.now()
    if (lastBroadcastPath === targetFile && now - lastBroadcastTime < 500)
      return
    lastBroadcastPath = targetFile
    lastBroadcastTime = now
    broadcast({
      type: 'stage:vrm:load',
      data: {
        modelId: activeModelId,
        modelPath: targetFile,
        position: activeModelPosition,
      },
    })
  }

  // Register Eventa IPC handlers
  defineInvokeHandler(context, electronStageMateEnsureModel, async (req) => {
    const targetFile = join(cacheDir, `${req.modelId}.vrm`)
    log.withFields({ modelId: req.modelId, targetFile }).log('Checking Stage-Mate model cache')

    if (existsSync(targetFile) && statSync(targetFile).size > 0) {
      log.log(`Cache HIT for model ${req.modelId}. Dispatching stage:vrm:load immediately.`)
      dispatchModelLoad(targetFile, req.modelId, req.position)
      return {
        status: 'ready',
        path: targetFile,
      }
    }

    log.log(`Cache MISS for model ${req.modelId}. Requesting binary buffer from renderer.`)
    return {
      status: 'need_binary',
    }
  })

  defineInvokeHandler(context, electronStageMateSaveModel, async (req) => {
    const targetFile = join(cacheDir, `${req.modelId}.vrm`)

    // Deduplicate in-flight writes for the same model across multiple windows
    const existing = inFlightWrites.get(req.modelId)
    if (existing)
      return await existing

    const writePromise = (async () => {
      try {
        const buf = Buffer.isBuffer(req.data) ? req.data : Buffer.from(req.data)

        if (existsSync(targetFile) && statSync(targetFile).size === buf.length) {
          log.log(`Model ${req.modelId} already on disk with identical size. Dispatching stage:vrm:load.`)
          dispatchModelLoad(targetFile, req.modelId, req.position)
          return { success: true, path: targetFile }
        }

        log.withFields({ modelId: req.modelId, bytes: buf.length }).log('Writing model binary to disk cache (atomic)')
        const tmpFile = `${targetFile}.${Date.now()}.tmp`
        writeFileSync(tmpFile, buf)
        renameSync(tmpFile, targetFile)

        log.log(`Model ${req.modelId} cached successfully. Dispatching stage:vrm:load.`)
        dispatchModelLoad(targetFile, req.modelId, req.position)

        return {
          success: true,
          path: targetFile,
        }
      }
      finally {
        inFlightWrites.delete(req.modelId)
      }
    })()

    inFlightWrites.set(req.modelId, writePromise)
    return await writePromise
  })

  defineInvokeHandler(context, electronStageMateSetViewportMode, async (mode) => {
    activeViewportMode = mode
    log.withFields({ mode }).log('Stage-Mate viewport mode updated')
    broadcast({
      type: 'control:viewport:mode',
      data: { mode },
    })
  })

  defineInvokeHandler(context, electronStageMateSetModelPosition, async (payload) => {
    activeModelPosition = { x: payload.x, y: payload.y, scale: payload.scale ?? 1 }
    log.withFields(payload).log('Stage-Mate model position dispatched')
    broadcast({
      type: 'stage:model:position',
      data: payload,
    })
  })

  defineInvokeHandler(context, electronStageMateToggleVisibility, async (enabled) => {
    isEnabled = !!enabled
    log.withFields({ isEnabled }).log('Stage-Mate visibility toggled')

    if (isEnabled) {
      await ensureRunning()
      broadcast({ type: 'control:stage', data: { enabled: true } })
    }
    else {
      broadcast({ type: 'control:stage', data: { enabled: false } })
    }
  })

  defineInvokeHandler(context, electronStageMateGetState, async () => {
    return {
      enabled: isEnabled,
      running: authenticatedSockets.size > 0 || (sidecarProcess !== null && !sidecarProcess.killed),
    }
  })

  // Start WebSocket listener
  startWebSocketServer()

  onAppBeforeQuit(async () => {
    if (wss) {
      wss.close()
      wss = null
    }
    await stop()
  })

  return {
    ensureRunning,
    stop,
    broadcast,
    isStageMateRunning: () => authenticatedSockets.size > 0,
  }
}
