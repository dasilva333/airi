import type { ScreenCaptureOptions } from '@proj-airi/stage-shared'

import { defineInvokeHandler } from '@moeru/eventa'
import { visionCaptureScreen, visionCheckPermission, visionGetPrimaryDisplaySize, visionRequestPermission } from '@proj-airi/stage-shared'
import { desktopCapturer, screen } from 'electron'

import * as ScreenCapture from '@proj-airi/electron-screen-capture/main'

const {
  checkMacOSScreenCapturePermission,
  requestMacOSScreenCapturePermission,
} = ScreenCapture as any

/**
 * Resolves the `desktopCapturer` thumbnail size for a capture request.
 *
 * NOTICE: the legacy hardcoded 1280x720 base shrank full-desktop glyphs to
 * ~3-5px on Retina displays, which destroyed tesseract OCR accuracy in the
 * Attention Ecology Guard. The default is now the source's original
 * resolution (`thumbnailSize` {0, 0}); downscaling is explicitly opt-in and
 * relative to the primary display's native size.
 */
function resolveThumbnailSize(options?: ScreenCaptureOptions): { width: number, height: number } {
  if (!options?.native && options?.width && options?.height) {
    return {
      width: Math.max(1, Math.round(options.width)),
      height: Math.max(1, Math.round(options.height)),
    }
  }

  try {
    const display = screen.getPrimaryDisplay()
    const scaleFactor = display.scaleFactor || 1
    const physicalWidth = Math.round(display.size.width * scaleFactor)
    const physicalHeight = Math.round(display.size.height * scaleFactor)

    if (!options?.native) {
      const percent = options?.downscalePercent
      if (percent != null && percent > 0 && percent < 100) {
        return {
          width: Math.max(1, Math.round(physicalWidth * percent / 100)),
          height: Math.max(1, Math.round(physicalHeight * percent / 100)),
        }
      }
    }

    return { width: physicalWidth, height: physicalHeight }
  }
  catch {
    return { width: 1920, height: 1080 }
  }
}

/**
 * Screen capture service that provides high-level screen/window capture
 * functionality via Eventa/IPC.
 */
export function createVisionService(params: { context: any }) {
  // Global permission checks (available to all windows)
  defineInvokeHandler(params.context, visionCheckPermission, async () => {
    try {
      return checkMacOSScreenCapturePermission()
    }
    catch {
      return 'granted' // Fallback for non-macOS
    }
  })

  defineInvokeHandler(params.context, visionRequestPermission, async () => {
    try {
      requestMacOSScreenCapturePermission()
    }
    catch {
      // Ignore on non-macOS
    }
  })

  defineInvokeHandler(params.context, visionGetPrimaryDisplaySize, async () => {
    try {
      const display = screen.getPrimaryDisplay()
      return {
        width: display.size.width,
        height: display.size.height,
        scaleFactor: display.scaleFactor,
      }
    }
    catch {
      return null
    }
  })

  defineInvokeHandler(params.context, visionCaptureScreen, async (options) => {
    console.log('[Vision Service] visionCaptureScreen requested:', JSON.stringify(options))
    try {
      const types: ('screen' | 'window')[] = options?.type === 'window' ? ['window'] : ['screen']
      const thumbnailSize = resolveThumbnailSize(options)
      console.log(`[Vision Service] Requesting thumbnailSize: ${thumbnailSize.width}×${thumbnailSize.height} (${options?.native ? 'native' : 'scaled'})`)
      const sources = await desktopCapturer.getSources({
        types,
        thumbnailSize,
      })

      if (!sources || sources.length === 0) {
        console.warn('[Vision Service] No capture sources found via desktopCapturer.')
        return null
      }

      console.log(`[Vision Service] desktopCapturer found ${sources.length} sources.`)

      // Attempt to find a valid source with a thumbnail
      let selectedSource = options?.sourceId
        ? sources.find(s => s.id === options.sourceId)
        : sources[0]

      // Fallback: If sources[0] is problematic, find any source that mentions "Screen" or has a valid-looking ID
      if (!selectedSource && sources.length > 0) {
        selectedSource = sources.find(s => s.name.toLowerCase().includes('screen') || s.id.startsWith('screen:')) || sources[0]
      }

      if (!selectedSource) {
        console.warn('[Vision Service] Failed to select a valid capture source.')
        return null
      }

      console.log(`[Vision Service] Capturing from: "${selectedSource.name}" (ID: ${selectedSource.id})`)

      const dataUrl = selectedSource.thumbnail.toDataURL()

      // If the dataUrl is too short, it's likely a transparent or failed capture
      if (dataUrl.length < 1000) {
        console.warn('[Vision Service] Captured thumbnail data is suspiciously small or empty.')
      }

      return {
        dataUrl,
        timestamp: Date.now(),
      }
    }
    catch (err) {
      console.error('[Vision Service] Capture failed in Main process:', err)
      return null
    }
  })
}
