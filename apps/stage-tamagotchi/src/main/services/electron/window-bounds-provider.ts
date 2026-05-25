import type { ExecFileException } from 'node:child_process'
import { execFile } from 'node:child_process'
import type { TargetWindowBounds } from '@proj-airi/electron-eventa'

import { isMacOS, isWindows } from 'std-env'

type BoundsCallback = (bounds: TargetWindowBounds | null) => void

/**
 * Extract native window handle from desktopCapturer source ID.
 * Format: "window:HWND:0" on Windows, "window:CGWindowID:0" on macOS
 */
function extractNativeId(sourceId: string): string | null {
  const match = sourceId.match(/^window:(\d+):\d+$/)
  return match ? match[1] : null
}

function createWindowsPoller(nativeId: string, callback: BoundsCallback): { stop: () => void } {
  let stopped = false
  let timer: NodeJS.Timeout | null = null

  // Native FFI Hook for Windows User32 via Koffi
  let win32: any = null
  try {
    const koffi = require('koffi')
    const user32 = koffi.load('user32.dll')

    koffi.struct('RECT', {
      bottom: 'int32',
      left: 'int32',
      right: 'int32',
      top: 'int32',
    })

    win32 = {
      GetWindowRect: user32.func('GetWindowRect', 'bool', ['void *', 'RECT *']),
      IsWindow: user32.func('IsWindow', 'bool', ['void *']),
    }
  } catch (err) {
    console.error('[WindowBounds] Failed to load Koffi for native bounds:', err)
  }

  function poll() {
    if (stopped) return

    if (!win32) {
      callback(null)
      timer = setTimeout(poll, 1000)
      return
    }

    try {
      const hwnd = BigInt(nativeId)

      if (win32.IsWindow(hwnd)) {
        const rect: any = {}
        if (win32.GetWindowRect(hwnd, rect)) {
          callback({
            height: rect.bottom - rect.top,
            width: rect.right - rect.left,
            x: rect.left,
            y: rect.top,
          })
        } else {
          callback(null)
        }
      } else {
        callback(null)
      }
    } catch {
      callback(null)
    }

    timer = setTimeout(poll, 200)
  }

  poll()

  return {
    stop: () => {
      stopped = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}

function createMacOSPoller(nativeId: string, callback: BoundsCallback): { stop: () => void } {
  let stopped = false
  let timer: NodeJS.Timeout | null = null

  // Use osascript (AppleScript via JXA) to get window bounds by CGWindowID
  // CGWindowListCopyWindowInfo gives us bounds for a specific window ID
  const script = `
const app = Application.currentApplication();
app.includeStandardAdditions = true;
const ref = $.CGWindowListCopyWindowInfo($.kCGWindowListOptionIncludingWindow, ${nativeId});
const count = $.CFArrayGetCount(ref);
if (count > 0) {
  const dict = $.CFArrayGetValueAtIndex(ref, 0);
  const boundsDict = ObjC.unwrap($.CFDictionaryGetValue(dict, $("kCGWindowBounds")));
  const x = ObjC.unwrap(boundsDict.$["X"]);
  const y = ObjC.unwrap(boundsDict.$["Y"]);
  const w = ObjC.unwrap(boundsDict.$["Width"]);
  const h = ObjC.unwrap(boundsDict.$["Height"]);
  x + "," + y + "," + w + "," + h;
} else {
  "GONE";
}
`.trim()

  function poll() {
    if (stopped) return

    execFile(
      'osascript',
      ['-l', 'JavaScript', '-e', script],
      { timeout: 3000 },
      (err: ExecFileException | null, stdout: string) => {
        if (stopped) return

        if (err) {
          callback(null)
          timer = setTimeout(poll, 500)
          return
        }

        const line = stdout.trim()
        if (line === 'GONE') {
          callback(null)
          timer = setTimeout(poll, 500)
          return
        }

        const parts = line.split(',').map(Number)
        if (parts.length === 4 && parts.every((n: number) => Number.isFinite(n))) {
          callback({ height: parts[3], width: parts[2], x: parts[0], y: parts[1] })
        } else {
          callback(null)
        }

        timer = setTimeout(poll, 200)
      },
    )
  }

  poll()

  return {
    stop: () => {
      stopped = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}

/**
 * Creates a platform-specific poller that retrieves the bounds of an external
 * window identified by a desktopCapturer source ID.
 *
 * Calls `callback` with the window bounds or `null` if the window is gone.
 */
export function createWindowBoundsPoller(sourceId: string, callback: BoundsCallback): { stop: () => void } | null {
  const nativeId = extractNativeId(sourceId)
  if (!nativeId) return null

  if (isWindows) {
    return createWindowsPoller(nativeId, callback)
  }

  if (isMacOS) {
    return createMacOSPoller(nativeId, callback)
  }

  // Linux: not yet implemented — xdotool / xprop could be used
  return null
}
