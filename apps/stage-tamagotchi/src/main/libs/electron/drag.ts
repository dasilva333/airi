import type { Buffer } from 'node:buffer'

import { createRequire } from 'node:module'

import { isLinux } from 'std-env'

const require = createRequire(import.meta.url)

interface ClickDragPlugin {
  startDrag: (windowHandle: Buffer | number) => void
}

let clickDragPlugin: ClickDragPlugin | null = null

if (!isLinux) {
  try {
    const mod = require('electron-click-drag-plugin')
    clickDragPlugin = mod?.default ?? mod
  }
  catch (error) {
    console.warn('[drag] Failed to load electron-click-drag-plugin:', error)
  }
}

/**
 * Native click-and-drag window repositioning for borderless/frameless windows.
 * Safe no-op on Linux where electron-click-drag-plugin is unsupported.
 */
export function startDraggingWindow(windowHandle: Buffer | number) {
  if (isLinux || !clickDragPlugin)
    return

  try {
    clickDragPlugin.startDrag(windowHandle)
  }
  catch (error) {
    console.error('[drag] Error starting window drag:', error)
  }
}
