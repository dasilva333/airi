import type { BrowserWindow } from 'electron'

import type { MicToggleHotkey } from '../../../shared/eventa'

import koffi from 'koffi'

import { globalShortcut, ipcMain } from 'electron'

let currentHotkey: MicToggleHotkey = 'Scroll'
let currentWindow: BrowserWindow | null = null
let lockKeyPollingInterval: NodeJS.Timeout | null = null
let lastLockKeyState: boolean | null = null

let getMacCapsLockState: (() => boolean) | null = null
let getWinLockKeyState: ((vk: number) => boolean) | null = null

const WIN_LOCK_KEYS: Record<MicToggleHotkey, number> = {
  Caps: 0x14, // VK_CAPITAL
  Scroll: 0x91, // VK_SCROLL
  Num: 0x90, // VK_NUMLOCK
}

function initMacCapsLockChecker(): boolean {
  if (getMacCapsLockState)
    return true
  try {
    const cg = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
    const CGEventSourceFlagsState = cg.func('uint64_t CGEventSourceFlagsState(int stateID)')
    const kCGEventSourceStateCombinedSessionState = 1
    const kCGEventFlagMaskAlphaShift = 0x00010000n

    getMacCapsLockState = () => {
      try {
        const flags = BigInt(CGEventSourceFlagsState(kCGEventSourceStateCombinedSessionState))
        return (flags & kCGEventFlagMaskAlphaShift) !== 0n
      }
      catch {
        return false
      }
    }
    return true
  }
  catch (err) {
    console.error(`[Mic Toggle] Failed to load CoreGraphics via koffi: ${err}`)
    return false
  }
}

function initWinLockKeyChecker(): boolean {
  if (getWinLockKeyState)
    return true
  try {
    const user32 = koffi.load('user32.dll')
    const GetKeyState = user32.func('short GetKeyState(int nVirtKey)')

    getWinLockKeyState = (vk: number) => {
      try {
        // Low-order bit indicates toggle status (1 = toggled ON, 0 = untoggled OFF)
        return (GetKeyState(vk) & 1) !== 0
      }
      catch {
        return false
      }
    }
    return true
  }
  catch (err) {
    console.error(`[Mic Toggle] Failed to load user32.dll via koffi: ${err}`)
    return false
  }
}

/**
 * Stop any existing monitoring and unregister shortcuts
 */
export function cleanupMicToggleShortcut() {
  globalShortcut.unregisterAll()
  if (lockKeyPollingInterval) {
    clearInterval(lockKeyPollingInterval)
    lockKeyPollingInterval = null
  }
  lastLockKeyState = null
  ipcMain.removeAllListeners('mic-state-changed')
}

/**
 * Setup global microphone toggle shortcut using Electron globalShortcut or native lock key state polling
 */
export function setupMicToggleShortcut(mainWindow: BrowserWindow, hotkey: MicToggleHotkey = 'Scroll') {
  currentWindow = mainWindow
  currentHotkey = hotkey

  cleanupMicToggleShortcut()

  const keyMap = {
    Scroll: { electron: 'ScrollLock', send: 'SCROLLLOCK' },
    Caps: { electron: 'CapsLock', send: 'CAPSLOCK' },
    Num: { electron: 'NumLock', send: 'NUMLOCK' },
  }

  const { electron: electronKey } = keyMap[currentHotkey]

  console.log(`[Mic Toggle] Setting up shortcut with hotkey: ${currentHotkey}`)

  const registerShortcut = () => {
    // 1. macOS Caps Lock polling fallback (avoids unreliable globalShortcut on Darwin)
    if (process.platform === 'darwin' && currentHotkey === 'Caps') {
      console.log(`[Mic Toggle] Using in-process CoreGraphics polling for Caps Lock on macOS.`)

      if (!initMacCapsLockChecker() || !getMacCapsLockState) {
        console.error(`[Mic Toggle] CRITICAL: Could not initialize CoreGraphics Caps Lock checker.`)
        return
      }

      lastLockKeyState = getMacCapsLockState()

      lockKeyPollingInterval = setInterval(() => {
        if (!getMacCapsLockState)
          return

        const currentState = getMacCapsLockState()

        if (lastLockKeyState !== null && currentState !== lastLockKeyState) {
          console.log(`[@proj-airi/stage-tamagotchi] [MicToggle] Caps Lock state changed: ${lastLockKeyState} -> ${currentState}`)

          if (currentWindow && !currentWindow.isDestroyed()) {
            const timestamp = Date.now()
            console.log(`[@proj-airi/stage-tamagotchi] [MicToggle] Emitting toggle-mic-from-shortcut at ${timestamp}`)
            currentWindow.webContents.send('toggle-mic-from-shortcut', { timestamp })
          }
          else {
            console.warn(`[Mic Toggle] No active window to send toggle event to.`)
          }
        }
        lastLockKeyState = currentState
      }, 100)
      return
    }

    // 2. Windows Lock Keys (Caps, Scroll, Num) polling to avoid swallowing keys with RegisterHotKey
    if (process.platform === 'win32' && WIN_LOCK_KEYS[currentHotkey] !== undefined) {
      const vk = WIN_LOCK_KEYS[currentHotkey]
      console.log(`[Mic Toggle] Using in-process Win32 GetKeyState polling for ${currentHotkey} (VK: 0x${vk.toString(16)}).`)

      if (!initWinLockKeyChecker() || !getWinLockKeyState) {
        console.error(`[Mic Toggle] CRITICAL: Could not initialize Win32 GetKeyState checker.`)
        return
      }

      lastLockKeyState = getWinLockKeyState(vk)

      lockKeyPollingInterval = setInterval(() => {
        if (!getWinLockKeyState)
          return

        const currentState = getWinLockKeyState(vk)

        if (lastLockKeyState !== null && currentState !== lastLockKeyState) {
          console.log(`[@proj-airi/stage-tamagotchi] [MicToggle] Windows ${currentHotkey} state changed: ${lastLockKeyState} -> ${currentState}`)

          if (currentWindow && !currentWindow.isDestroyed()) {
            const timestamp = Date.now()
            console.log(`[@proj-airi/stage-tamagotchi] [MicToggle] Emitting toggle-mic-from-shortcut at ${timestamp}`)
            currentWindow.webContents.send('toggle-mic-from-shortcut', { timestamp })
          }
          else {
            console.warn(`[Mic Toggle] No active window to send toggle event to.`)
          }
        }
        lastLockKeyState = currentState
      }, 100)
      return
    }

    // 3. Standard globalShortcut for other keys/platforms
    try {
      const isRegistered = globalShortcut.register(electronKey, () => {
        console.log(`[Mic Toggle] Hotkey ${electronKey} pressed`)
        if (currentWindow && !currentWindow.isDestroyed()) {
          currentWindow.webContents.send('toggle-mic-from-shortcut', { timestamp: Date.now() })
        }
      })

      if (!isRegistered) {
        console.warn(`[Mic Toggle] Failed to register global shortcut for ${electronKey}`)
      }
    }
    catch (err) {
      console.error(`[Mic Toggle] Error registering global shortcut: ${err}`)
    }
  }

  // NOTICE: In Electron 40.x, registering global shortcuts synchronously during
  // service initialization may trigger V8 "unreachable code" fatal errors
  // depending on the underlying OS event loop state. Deferring to next tick.
  setTimeout(() => {
    registerShortcut()
  }, 100)
}
