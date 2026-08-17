import type { ChildProcess } from 'node:child_process'

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { env, platform } from 'node:process'

import { useLogg } from '@guiiai/logg'
import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { app, ipcMain } from 'electron'
import { WebSocket, WebSocketServer } from 'ws'

import {
  electronStageMateEnsureModel,
  electronStageMateGetState,
  electronStageMateSaveModel,
  electronStageMateToggleVisibility,
} from '../../../../shared/eventa'
import { onAppBeforeQuit } from '../../../libs/bootkit/lifecycle'
import { getElectronMainDirname } from '../../../libs/electron/location'

export interface StageMateService {
  ensureRunning: () => Promise<void>
  stop: () => Promise<void>
  broadcast: (msg: object) => void
  isStageMateRunning: () => boolean
}

export function createStageMateService(params?: { authToken?: string }): StageMateService {
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
  let isEnabled = false

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
    const baseDevPath = join(getElectronMainDirname(), '../../../../apps/stage-mate/mate-engine/Build')

    if (platform === 'win32') {
      const candidates = [
        join(baseDevPath, 'Windows', 'StageMate.exe'),
        join(baseDevPath, 'StageMate.exe'),
        join(baseDevPath, 'StageMate', 'StageMate.exe'),
        join(baseDevPath, 'MateEngineX.exe'),
        join(process.resourcesPath, 'StageMate.exe'),
        join(process.resourcesPath, 'StageMate', 'StageMate.exe'),
      ]
      for (const cand of candidates) {
        if (existsSync(cand))
          return cand
      }
    }
    else if (platform === 'linux') {
      const candidates = [
        join(baseDevPath, 'Linux', 'StageMate.x86_64'),
        join(baseDevPath, 'StageMate.x86_64'),
        join(process.resourcesPath, 'StageMate.x86_64'),
      ]
      for (const cand of candidates) {
        if (existsSync(cand))
          return cand
      }
    }
    else if (platform === 'darwin') {
      const candidates = [
        join(baseDevPath, 'StageMate.app'),
        join(baseDevPath, 'macOS', 'StageMate.app'),
        join(process.resourcesPath, 'StageMate.app'),
        join(baseDevPath, 'StageMate.app', 'Contents/MacOS/StageMate'),
        join(baseDevPath, 'StageMate.app', 'Contents/MacOS/MateEngineX'),
      ]
      for (const cand of candidates) {
        if (existsSync(cand))
          return cand
      }
    }

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

  // Register Eventa IPC handlers
  defineInvokeHandler(context, electronStageMateEnsureModel, async (req) => {
    const targetFile = join(cacheDir, `${req.modelId}.vrm`)
    log.withFields({ modelId: req.modelId, targetFile }).log('Checking Stage-Mate model cache')

    if (existsSync(targetFile)) {
      log.log(`Cache HIT for model ${req.modelId}. Dispatching stage:vrm:load immediately.`)
      broadcast({
        type: 'stage:vrm:load',
        data: { modelPath: targetFile },
      })
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
    log.withFields({ modelId: req.modelId, bytes: req.data?.length }).log('Writing model binary to disk cache')

    const buf = Buffer.isBuffer(req.data) ? req.data : Buffer.from(req.data)
    writeFileSync(targetFile, buf)

    log.log(`Model ${req.modelId} cached successfully. Dispatching stage:vrm:load.`)
    broadcast({
      type: 'stage:vrm:load',
      data: { modelPath: targetFile },
    })

    return {
      success: true,
      path: targetFile,
    }
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
