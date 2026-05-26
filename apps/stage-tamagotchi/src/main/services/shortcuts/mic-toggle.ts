import { execFile } from 'node:child_process'
import { chmodSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { BrowserWindow } from 'electron'
import { app, globalShortcut, ipcMain } from 'electron'
import type { MicToggleHotkey } from '../../../shared/eventa'

let currentHotkey: MicToggleHotkey = 'Scroll'
let currentWindow: BrowserWindow | null = null
let macCapsLockPollingInterval: NodeJS.Timeout | null = null
let lastMacCapsLockState: boolean | null = null

/**
 * Stop any existing monitoring and unregister shortcuts
 */
export function cleanupMicToggleShortcut() {
  globalShortcut.unregisterAll()
  if (macCapsLockPollingInterval) {
    clearInterval(macCapsLockPollingInterval)
    macCapsLockPollingInterval = null
  }
  lastMacCapsLockState = null
  ipcMain.removeAllListeners('mic-state-changed')
}

/**
 * Setup global microphone toggle shortcut using Electron globalShortcut
 */
export function setupMicToggleShortcut(stageWindow: BrowserWindow, hotkey: MicToggleHotkey = 'Scroll') {
  currentWindow = stageWindow
  currentHotkey = hotkey

  cleanupMicToggleShortcut()

  const keyMap = {
    Caps: { electron: 'CapsLock', send: 'CAPSLOCK' },
    Num: { electron: 'NumLock', send: 'NUMLOCK' },
    Scroll: { electron: 'ScrollLock', send: 'SCROLLLOCK' },
  }

  const { electron: electronKey } = keyMap[currentHotkey]

  console.log(`[Mic Toggle] Setting up shortcut with hotkey: ${currentHotkey}`)

  // 1. Initial State Check (Windows only fallback for LED sync)
  // We don't poll anymore. We just react to the global shortcut.
  // The globalShortcut consumes the event, so the LED won't toggle by itself.
  // We will manually toggle it to keep the OS/User in sync.

  const registerShortcut = () => {
    if (process.platform === 'darwin' && currentHotkey === 'Caps') {
      const helperPath = join(app.getAppPath(), 'src/main/services/shortcuts/macos-capslock-check')
      console.log(`[Mic Toggle] Using macOS polling fallback for Caps Lock.`)
      console.log(`[Mic Toggle] Expected helper path: ${helperPath}`)

      // Verify helper existence
      if (!existsSync(helperPath)) {
        console.error(`[Mic Toggle] CRITICAL: Native helper not found at ${helperPath}`)
      } else {
        try {
          chmodSync(helperPath, '755')
          console.log(`[Mic Toggle] Native helper found and ready.`)
        } catch (e) {
          console.error(`[Mic Toggle] Failed to chmod helper: ${e}`)
        }
      }

      macCapsLockPollingInterval = setInterval(() => {
        // Heartbeat logging every 30 seconds
        if (Date.now() % 30000 < 200) {
          console.log('[@proj-airi/stage-tamagotchi] [MicToggle] macOS Caps Lock poller heartbeat...')
        }

        execFile(helperPath, (error, stdout) => {
          if (error) {
            console.error(`[@proj-airi/stage-tamagotchi] [MicToggle] Poller error: ${error.message}`)
            return
          }

          const stdoutTrimmed = stdout.trim()
          const currentState = stdoutTrimmed === '1'

          if (lastMacCapsLockState !== null && currentState !== lastMacCapsLockState) {
            console.log(
              `[@proj-airi/stage-tamagotchi] [MicToggle] Caps Lock state changed: ${lastMacCapsLockState} -> ${currentState}`,
            )

            if (currentWindow) {
              const timestamp = Date.now()
              console.log(`[@proj-airi/stage-tamagotchi] [MicToggle] Emitting toggle-mic-from-shortcut at ${timestamp}`)
              currentWindow.webContents.send('toggle-mic-from-shortcut', { timestamp })
            } else {
              console.warn(`[Mic Toggle] No active window to send toggle event to.`)
            }
          }
          lastMacCapsLockState = currentState
        })
      }, 200) // Poll every 200ms
      return
    }

    // 2. Standard globalShortcut for other keys/platforms
    try {
      const isRegistered = globalShortcut.register(electronKey, () => {
        console.log(`[Mic Toggle] Hotkey ${electronKey} pressed`)
        if (currentWindow) {
          currentWindow.webContents.send('toggle-mic-from-shortcut', { timestamp: Date.now() })
        }
      })

      if (!isRegistered) {
        console.warn(`[Mic Toggle] Failed to register global shortcut for ${electronKey}`)
      }
    } catch (err) {
      console.error(`[Mic Toggle] Error registering global shortcut: ${err}`)
    }
  }

  // NOTICE: In Electron 40.x, registering global shortcuts synchronously during
  // service initialization may trigger V8 "unreachable code" fatal errors
  // depending on the underlying OS event loop state. Deferring to next tick.
  setTimeout(() => {
    registerShortcut()
  }, 100)

  // 2. Listen to renderer state changes to sync the LED
  // NOTICE: Disabled backend Scroll Lock state syncing as requested by user.
  // It causes unwanted flickering and OS overlays.
  /*
  ipcMain.on('mic-state-changed', (_event, _micEnabled: boolean) => {
    // On Windows, try to sync the LED if possible.
    // Since globalShortcut consumes the keypress, the LED state is controlled by US.
    // We send a toggle if the target state doesn't match our 'presumed' LED state.
    // NOTE: This uses WScript.Shell which is safer than Add-Type.
    if (process.platform === 'win32') {
      console.log(`[Mic Toggle] Syncing LED for ${electronKey}`)
      // Temporarily unregister to avoid infinite loop from simulated keypress
      globalShortcut.unregister(electronKey)

      const syncScript = `$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys('{${sendKey}}')`
      spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', syncScript], { windowsHide: true })

      // Re-register after a small delay to ensure the OS has processed the simulated key
      setTimeout(() => {
        registerShortcut()
      }, 500)
    }
  })
  */
}
