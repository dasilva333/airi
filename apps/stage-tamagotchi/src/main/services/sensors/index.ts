import type { createContext } from '@moeru/eventa/adapters/electron/main'
import type { ActiveWindowEntry, WindowInfo } from '@proj-airi/stage-shared'

import { Buffer } from 'node:buffer'
import { createRequire } from 'node:module'
import { loadavg } from 'node:os'
import { platform, stdout } from 'node:process'

import { useLogg } from '@guiiai/logg'
import { defineInvokeHandler } from '@moeru/eventa'
import {
  sensorsGetActiveWindow,
  sensorsGetActiveWindowHistory,
  sensorsGetIdleTime,
  sensorsGetLocalTime,
  sensorsGetSystemLoad,
  sensorsGetVolumeLevel,
  sensorsSetTrackingEnabled,
} from '@proj-airi/stage-shared'
import { powerMonitor } from 'electron'

const require = createRequire(import.meta.url)
let activeWindow: any = null
let loudness: any = null
let si: any = null

try {
  activeWindow = require('active-win')
  if (activeWindow && typeof activeWindow.activeWindow === 'function') {
    activeWindow = activeWindow.activeWindow
  }
}
catch (err) {
  console.warn('[Sensors] Failed to load active-win native module. Will use fallbacks.', err)
}

try {
  loudness = require('loudness')
}
catch (err) {
  console.warn('[Sensors] Failed to load loudness module.', err)
}

try {
  si = require('systeminformation')
}
catch (err) {
  console.warn('[Sensors] Failed to load systeminformation module.', err)
}

const log = useLogg('main/sensors').useGlobalConfig()

export async function createSensorsService(params: { context: ReturnType<typeof createContext>['context'] }) {
  const { context } = params
  const activeWindowHistory: ActiveWindowEntry[] = []

  let lastActiveWinErrorTime = 0
  const ERROR_LOG_INTERVAL = 60000 // Only log once per minute

  // Initialize Win32 FFI bridge via Koffi once at startup
  let win32Bridge: any = null
  if (platform === 'win32') {
    try {
      const koffi: any = require('koffi')
      const user32 = koffi.load('user32.dll')
      const kernel32 = koffi.load('kernel32.dll')

      win32Bridge = {
        GetForegroundWindow: user32.func('GetForegroundWindow', 'void *', []),
        GetWindowTextW: user32.func('GetWindowTextW', 'int', ['void *', 'char16_t *', 'int']),
        GetWindowThreadProcessId: user32.func('GetWindowThreadProcessId', 'uint32', ['void *', 'uint32 *']),
        OpenProcess: kernel32.func('OpenProcess', 'void *', ['uint32', 'bool', 'uint32']),
        QueryFullProcessImageNameW: kernel32.func('QueryFullProcessImageNameW', 'bool', ['void *', 'uint32', 'char16_t *', 'uint32 *']),
        CloseHandle: kernel32.func('CloseHandle', 'bool', ['void *']),
      }
      log.debug('Win32 FFI bridge initialized via Koffi.')
    }
    catch (err) {
      log.withError(err).warn('Failed to initialize Koffi Win32 bridge. Native fallbacks will be unavailable.')
    }
  }

  async function getActiveWindowInfo(): Promise<WindowInfo | null> {
    try {
      if (typeof activeWindow !== 'function')
        throw new Error('active-win is not loaded')
      const result = await activeWindow()
      if (result) {
        return {
          title: result.title || 'Unknown',
          processName: result.owner.name || 'Unknown',
        }
      }
    }
    catch {
      const now = Date.now()
      if (now - lastActiveWinErrorTime > ERROR_LOG_INTERVAL) {
        // eslint-disable-next-line no-console
        console.log('[getActiveWindowInfo] active-win failed or missing, using Koffi fallback.')
        lastActiveWinErrorTime = now
      }

      // High-performance Koffi fallback for Windows
      if (win32Bridge) {
        try {
          const { GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId, OpenProcess, QueryFullProcessImageNameW, CloseHandle } = win32Bridge
          const hwnd = GetForegroundWindow()

          if (!hwnd) {
            stdout.write('[getActiveWindowInfo] No foreground window found.\n')
            return null
          }

          // Get Title
          const titleBuffer = Buffer.alloc(1024)
          const titleLen = GetWindowTextW(hwnd, titleBuffer, 512)
          const title = titleBuffer.toString('utf16le', 0, titleLen * 2).replace(/\0/g, '').trim() || 'Untitled'
          stdout.write(`[getActiveWindowInfo] detected title: ${title}\n`)

          // Get Process Name
          let processName = 'Unknown'
          const pidBuffer = [0]
          GetWindowThreadProcessId(hwnd, pidBuffer)
          const pid = pidBuffer[0]

          const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
          const PROCESS_QUERY_INFORMATION = 0x0400
          const PROCESS_VM_READ = 0x0010

          let hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
          if (!hProcess) {
            // Fallback for some processes that require full query rights
            hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid)
          }

          if (hProcess) {
            const pathBuffer = Buffer.alloc(1024)
            const sizeBuffer = [512]
            if (QueryFullProcessImageNameW(hProcess, 0, pathBuffer, sizeBuffer)) {
              const fullPath = pathBuffer.toString('utf16le', 0, sizeBuffer[0] * 2).replace(/\0/g, '').trim()
              processName = fullPath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') || 'Unknown'
            }
            CloseHandle(hProcess)
          }
          // Only log if we finally found something or if it's still unknown after fallback
          if (processName !== 'Unknown') {
            stdout.write(`[getActiveWindowInfo] detected processName: ${processName}\n`)
          }

          return {
            title,
            processName,
          }
        }
        catch (nativeErr) {
          stdout.write(`[getActiveWindowInfo] Koffi fallback execution failed: ${String(nativeErr)}\n`)
        }
      }
    }

    return null
  }

  const MAX_HISTORY = 50
  let pollInterval: NodeJS.Timeout | null = null
  let systemLoadInterval: NodeJS.Timeout | null = null
  let cachedSystemLoad = { cpu: [0, 0, 0] as [number, number, number], gpuAvg: 0 }

  async function updateSystemLoadCache() {
    let cpuLoads: [number, number, number] = [0, 0, 0]
    let gpuLoad = 0

    try {
      if (!si)
        throw new Error('systeminformation is not loaded')
      const load = await si.currentLoad()
      const val = load.currentLoad / 100
      cpuLoads = [val, val, val]
    }
    catch (err) {
      log.withError(err).warn('Failed to get CPU load via systeminformation')
      cpuLoads = loadavg() as [number, number, number]
    }

    try {
      if (!si)
        throw new Error('systeminformation is not loaded')
      const graphics = await si.graphics()
      gpuLoad = Math.max(0, ...graphics.controllers.map((c: any) => (c.utilizationGpu || 0) as number))
    }
    catch (err) {
      log.withError(err).warn('Failed to get GPU load via systeminformation')
    }

    cachedSystemLoad = {
      cpu: cpuLoads,
      gpuAvg: gpuLoad,
    }
  }

  function startTracking() {
    if (pollInterval)
      return

    log.debug('Starting active window tracking background loop.')
    pollInterval = setInterval(async () => {
      const current = await getActiveWindowInfo()
      if (!current)
        return

      const now = Date.now()
      const lastEntry = activeWindowHistory.at(-1)
      if (lastEntry && lastEntry.window.title === current.title && lastEntry.window.processName === current.processName) {
        lastEntry.endTime = now
        lastEntry.durationMs = lastEntry.endTime - lastEntry.startTime
      }
      else {
        activeWindowHistory.push({
          window: current,
          startTime: now,
          endTime: now,
          durationMs: 0,
        })

        if (activeWindowHistory.length > MAX_HISTORY)
          activeWindowHistory.shift()
      }
    }, 10000)

    // Background update system load cache every 30 seconds
    void updateSystemLoadCache()
    systemLoadInterval = setInterval(async () => {
      await updateSystemLoadCache()
    }, 30000)
  }

  function stopTracking() {
    if (pollInterval) {
      log.debug('Stopping active window tracking background loop.')
      clearInterval(pollInterval)
      pollInterval = null
    }
    if (systemLoadInterval) {
      log.debug('Stopping system load background polling.')
      clearInterval(systemLoadInterval)
      systemLoadInterval = null
    }
  }

  defineInvokeHandler(
    context,
    sensorsSetTrackingEnabled,
    async (payload) => {
      if (payload.enabled)
        startTracking()
      else
        stopTracking()
    },
  )

  defineInvokeHandler(
    context,
    sensorsGetIdleTime,
    async () => {
      return powerMonitor.getSystemIdleTime() * 1000
    },
  )

  defineInvokeHandler(
    context,
    sensorsGetActiveWindow,
    async () => {
      return getActiveWindowInfo()
    },
  )

  defineInvokeHandler(
    context,
    sensorsGetActiveWindowHistory,
    async () => {
      return activeWindowHistory
    },
  )

  async function getVolumeLevel(): Promise<number> {
    try {
      if (!loudness)
        return 0
      const vol = await loudness.getVolume()
      const muted = await loudness.getMuted()
      if (muted)
        return 0
      return vol
    }
    catch (err) {
      log.withError(err).warn('Failed to get system volume via loudness')
    }

    return 0
  }

  defineInvokeHandler(
    context,
    sensorsGetVolumeLevel,
    async () => {
      return getVolumeLevel()
    },
  )

  defineInvokeHandler(
    context,
    sensorsGetSystemLoad,
    async () => {
      // If we have background tracking active, return the cached value immediately
      if (systemLoadInterval) {
        return cachedSystemLoad
      }
      // Otherwise, do a quick sync update using native loadavg
      const cpuLoads = loadavg() as [number, number, number]
      // Dispatch a background update to refresh the cache without blocking the IPC call
      void updateSystemLoadCache()
      return {
        cpu: cachedSystemLoad.cpu[0] > 0 ? cachedSystemLoad.cpu : cpuLoads,
        gpuAvg: cachedSystemLoad.gpuAvg,
      }
    },
  )

  defineInvokeHandler(
    context,
    sensorsGetLocalTime,
    async () => {
      return new Date().toLocaleString()
    },
  )

  return {
    context,
    stop: () => stopTracking(),
  }
}
