import type { LauncherEvent, UpdaterStatus } from '@ergosphere-it/electron/main'
import type { createContext } from '@moeru/eventa/adapters/electron/main'
import type {
  AutoUpdaterState,
} from '@proj-airi/electron-eventa/electron-updater'
import type { BrowserWindow } from 'electron'

import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { updater } from '@ergosphere-it/electron/main'
import { useLogg } from '@guiiai/logg'
import { defineInvokeHandler } from '@moeru/eventa'
import { tryCatch } from '@moeru/std'
import {
  autoUpdater as autoUpdaterEventa,
  electronAutoUpdaterStateChanged,
} from '@proj-airi/electron-eventa/electron-updater'
import { app } from 'electron'
import { Semaphore } from 'es-toolkit'

import { isUnderErgosphere } from '../../libs/electron/location'
import { MockAutoUpdater } from './mock-auto-updater'

type MainContext = ReturnType<typeof createContext>['context']

export interface AutoUpdater {
  state: AutoUpdaterState
  reportHealthy: () => void
  delayHealthCheck: (seconds: number) => void
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  applyUpdate: () => Promise<void>
  quitAndInstall: () => void
  getChannel: () => string
  setChannel: (channel: string) => Promise<void>
  dismissRollback: () => Promise<void>
  subscribe: (callback: (state: AutoUpdaterState) => void) => () => void
}

/**
 * Maps Ergosphere's low-level protocol status into AIRI's reactive UI state.
 */
export function mapErgosphereStatus(status: UpdaterStatus, channel: string): AutoUpdaterState {
  switch (status.status) {
    case 'idle':
      return { status: 'idle', channel }

    case 'checking':
      return { status: 'checking', channel }

    case 'available':
      return {
        status: 'available',
        channel,
        info: {
          version: status.update.version,
          files: [],
          releaseDate: new Date(status.update.releaseId).toISOString(),
          releaseId: status.update.releaseId,
          requires: status.update.requires,
        },
      }

    case 'downloading':
      return {
        status: 'downloading',
        channel,
        progress: {
          percent: status.percent,
          bytesPerSecond: status.bytesPerSecond,
          transferred: status.downloadedBytes,
          total: status.totalBytes,
        },
        info: {
          version: status.update.version,
          files: [],
          releaseDate: new Date(status.update.releaseId).toISOString(),
          releaseId: status.update.releaseId,
          requires: status.update.requires,
        },
      }

    case 'preparing':
      return {
        status: 'downloading',
        channel,
        progress: {
          percent: status.percent,
          bytesPerSecond: 0,
          transferred: 0,
          total: 0,
        },
        info: {
          version: status.update.version,
          files: [],
          releaseDate: new Date(status.update.releaseId).toISOString(),
          releaseId: status.update.releaseId,
          requires: status.update.requires,
        },
      }

    case 'ready':
    case 'applying':
      return {
        status: 'downloaded',
        channel,
        info: {
          version: status.update.version,
          files: [],
          releaseDate: new Date(status.update.releaseId).toISOString(),
          releaseId: status.update.releaseId,
          requires: status.update.requires,
        },
      }

    case 'up-to-date':
      return {
        status: 'not-available',
        channel,
        info: {
          version: app.isReady() ? app.getVersion() : '0.0.0',
          files: [],
          releaseDate: new Date().toISOString(),
        },
      }

    case 'download-failed':
    case 'verification-failed':
    case 'error':
      return {
        status: 'error',
        channel,
        error: { message: status.error?.message ?? 'Update error encountered' },
      }

    case 'rolled-back':
      return {
        status: 'error',
        channel,
        rollback: {
          from: { releaseId: status.from.releaseId, version: status.from.version },
          to: { releaseId: status.to.releaseId, version: status.to.version },
          reason: status.reason,
        },
        error: { message: `Rolled back to ${status.to.version} (${status.reason})` },
      }

    case 'disabled':
      return { status: 'disabled', channel }

    case 'manual-install-required':
      return {
        status: 'available',
        channel,
        info: {
          version: status.update.version,
          files: [],
          releaseDate: new Date(status.update.releaseId).toISOString(),
          releaseId: status.update.releaseId,
          requires: 'install',
        },
        error: { message: 'A full application installer is required for this update.' },
      }

    default:
      return { status: 'idle', channel }
  }
}

/**
 * PR #3187: Structured telemetry logging strictly inside userData/logs/updater.log
 */
function initUpdaterLogging() {
  try {
    const logDir = join(app.getPath('userData'), 'logs')
    mkdirSync(logDir, { recursive: true })
    const logPath = join(logDir, 'updater.log')

    return updater.onEvent((event: LauncherEvent) => {
      try {
        const line = `${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`
        appendFileSync(logPath, line, 'utf8')
      }
      catch {}
    })
  }
  catch (error) {
    console.warn('[Updater] Could not initialize telemetry logging in userData/logs:', error)
    return () => {}
  }
}

export function setupAutoUpdater(): AutoUpdater {
  const log = useLogg('auto-updater').useGlobalConfig()
  const semaphore = new Semaphore(1)
  const hooks = new Set<(state: AutoUpdaterState) => void>()

  let state: AutoUpdaterState = { status: 'idle' }

  function broadcast(next: AutoUpdaterState) {
    state = next
    for (const listener of hooks) {
      try {
        listener(next)
      }
      catch (error) {
        log.withError(error).error('Failed to notify auto-updater listener')
      }
    }
  }

  // Running under the Ergosphere launcher runtime (preview / production)
  if (isUnderErgosphere()) {
    log.log('Ergosphere launcher runtime active, initializing production updater...')

    // Initialize telemetry audit logging to userData/logs/updater.log
    initUpdaterLogging()

    // Subscribe to Ergosphere runtime status changes
    updater.onStatus((rawStatus) => {
      const nextState = mapErgosphereStatus(rawStatus, updater.channel)
      broadcast(nextState)
    })

    // Read initial status
    try {
      state = mapErgosphereStatus(updater.status, updater.channel)
    }
    catch {
      state = { status: 'idle', channel: updater.channel }
    }

    return {
      get state() {
        return state
      },
      reportHealthy() {
        log.log('Reporting healthy to Ergosphere launcher watchdog...')
        try {
          updater.markBundleHealthy()
        }
        catch (error) {
          log.withError(error).warn('Failed to call markBundleHealthy on updater')
        }
      },
      delayHealthCheck(seconds: number) {
        try {
          updater.delayHealthCheck(seconds)
        }
        catch (error) {
          log.withError(error).warn('Failed to extend health check')
        }
      },
      async checkForUpdates() {
        broadcast({ ...state, status: 'checking' })
        try {
          const res = await updater.checkForUpdates()
          broadcast(mapErgosphereStatus(res, updater.channel))
        }
        catch (error) {
          log.withError(error).error('checkForUpdates failed')
          broadcast({
            ...state,
            status: 'error',
            error: { message: error instanceof Error ? error.message : String(error) },
          })
        }
      },
      async downloadUpdate() {
        if (state.status === 'downloading' || state.status === 'downloaded')
          return

        await semaphore.acquire()
        try {
          const res = await updater.downloadUpdate()
          broadcast(mapErgosphereStatus(res, updater.channel))
        }
        catch (error) {
          log.withError(error).error('downloadUpdate failed')
          broadcast({
            ...state,
            status: 'error',
            error: { message: error instanceof Error ? error.message : String(error) },
          })
        }
        finally {
          semaphore.release()
        }
      },
      async applyUpdate() {
        await semaphore.acquire()
        try {
          await updater.applyUpdate()
        }
        catch (error) {
          log.withError(error).error('applyUpdate failed')
          broadcast({
            ...state,
            status: 'error',
            error: { message: error instanceof Error ? error.message : String(error) },
          })
        }
        finally {
          semaphore.release()
        }
      },
      quitAndInstall() {
        void this.applyUpdate()
      },
      getChannel() {
        return updater.channel
      },
      async setChannel(newChannel: string) {
        log.log(`Switching update channel to: ${newChannel}`)
        updater.channel = newChannel
        broadcast({ ...state, channel: newChannel })
        void this.checkForUpdates()
      },
      async dismissRollback() {
        try {
          await updater.dismissRollback()
        }
        catch (error) {
          log.withError(error).warn('Failed to dismiss rollback')
        }
      },
      subscribe(callback) {
        hooks.add(callback)
        try {
          callback(state)
        }
        catch {}
        return () => hooks.delete(callback)
      },
    }
  }

  // Development mode fallback (or tests) without Ergosphere runtime
  log.log('Running in development or standalone mode; utilizing MockAutoUpdater...')
  const mock = new MockAutoUpdater()
  state = mock.state

  mock.on('status', (nextState: AutoUpdaterState) => {
    broadcast(nextState)
  })

  return {
    get state() {
      return state
    },
    reportHealthy() {
      log.debug('Development mode: launcher health check bypassed.')
      mock.reportHealthy()
    },
    delayHealthCheck(seconds: number) {
      mock.delayHealthCheck(seconds)
    },
    async checkForUpdates() {
      await mock.checkForUpdates()
    },
    async downloadUpdate() {
      await mock.downloadUpdate()
    },
    async applyUpdate() {
      await mock.applyUpdate()
    },
    quitAndInstall() {
      void mock.quitAndInstall()
    },
    getChannel() {
      return mock.channel
    },
    async setChannel(newChannel: string) {
      await mock.setChannel(newChannel)
    },
    async dismissRollback() {
      await mock.dismissRollback()
    },
    subscribe(callback) {
      hooks.add(callback)
      try {
        callback(state)
      }
      catch {}
      return () => hooks.delete(callback)
    },
  }
}

export function createAutoUpdaterService(params: { context: MainContext, window: BrowserWindow, service: AutoUpdater }) {
  const { context, window, service } = params
  const log = useLogg('auto-updater-service').useGlobalConfig()

  // Subscribe to state changes and forward to the Eventa context
  const unsubscribe = service.subscribe((currentState) => {
    if (window.isDestroyed())
      return

    tryCatch(() => context.emit(electronAutoUpdaterStateChanged, currentState))
  })

  const cleanups: Array<() => void> = [unsubscribe]

  cleanups.push(
    defineInvokeHandler(context, autoUpdaterEventa.getState, () => service.state),
  )

  cleanups.push(
    defineInvokeHandler(context, autoUpdaterEventa.checkForUpdates, async () => {
      await service.checkForUpdates().catch(error => log.withError(error).error('checkForUpdates() failed'))
      return service.state
    }),
  )

  cleanups.push(
    defineInvokeHandler(context, autoUpdaterEventa.downloadUpdate, async () => {
      await service.downloadUpdate()
      return service.state
    }),
  )

  cleanups.push(
    defineInvokeHandler(context, autoUpdaterEventa.quitAndInstall, () => {
      service.quitAndInstall()
    }),
  )

  cleanups.push(
    defineInvokeHandler(context, autoUpdaterEventa.applyUpdate, async () => {
      await service.applyUpdate()
    }),
  )

  cleanups.push(
    defineInvokeHandler(context, autoUpdaterEventa.getChannel, () => service.getChannel()),
  )

  cleanups.push(
    defineInvokeHandler(context, autoUpdaterEventa.setChannel, async (payload) => {
      await service.setChannel(payload.channel)
      return service.getChannel()
    }),
  )

  cleanups.push(
    defineInvokeHandler(context, autoUpdaterEventa.dismissRollback, async () => {
      await service.dismissRollback()
    }),
  )

  const cleanup = () => {
    for (const fn of cleanups)
      fn()
  }

  window.on('closed', cleanup)
  return cleanup
}
