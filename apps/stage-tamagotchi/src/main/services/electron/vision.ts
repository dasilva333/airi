import { defineInvokeHandler } from '@moeru/eventa'
import * as ScreenCapture from '@proj-airi/electron-screen-capture/main'
import { visionCaptureScreen, visionCheckPermission, visionRequestPermission } from '@proj-airi/stage-shared'
import { desktopCapturer } from 'electron'

const { checkMacOSScreenCapturePermission, requestMacOSScreenCapturePermission } = ScreenCapture as any

/**
 * Screen capture service that provides high-level screen/window capture
 * functionality via Eventa/IPC.
 */
export function createVisionService(params: { context: any }) {
  // Global permission checks (available to all windows)
  defineInvokeHandler(params.context, visionCheckPermission, async () => {
    try {
      return checkMacOSScreenCapturePermission()
    } catch {
      return 'granted' // Fallback for non-macOS
    }
  })

  defineInvokeHandler(params.context, visionRequestPermission, async () => {
    try {
      requestMacOSScreenCapturePermission()
    } catch {
      // Ignore on non-macOS
    }
  })

  defineInvokeHandler(params.context, visionCaptureScreen, async (options) => {
    console.log('[Vision Service] visionCaptureScreen requested:', JSON.stringify(options))
    try {
      const types: ('screen' | 'window')[] = options?.type === 'window' ? ['window'] : ['screen']
      const sources = await desktopCapturer.getSources({
        thumbnailSize: {
          height: options?.height || 720,
          width: options?.width || 1280,
        },
        types,
      })

      if (!sources || sources.length === 0) {
        console.warn('[Vision Service] No capture sources found via desktopCapturer.')
        return null
      }

      console.log(`[Vision Service] desktopCapturer found ${sources.length} sources.`)

      // Attempt to find a valid source with a thumbnail
      let selectedSource = options?.sourceId ? sources.find((s) => s.id === options.sourceId) : sources[0]

      // Fallback: If sources[0] is problematic, find any source that mentions "Screen" or has a valid-looking ID
      if (!selectedSource && sources.length > 0) {
        selectedSource =
          sources.find((s) => s.name.toLowerCase().includes('screen') || s.id.startsWith('screen:')) || sources[0]
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
    } catch (err) {
      console.error('[Vision Service] Capture failed in Main process:', err)
      return null
    }
  })
}
