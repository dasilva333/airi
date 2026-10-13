import { defineInvokeEventa } from '@moeru/eventa'

export interface ScreenCaptureOptions {
  width?: number
  height?: number
  type?: 'screen' | 'window'
  sourceId?: string
  /** Case-insensitive part of a window title. Used with `type: 'window'` when no `sourceId` is given. */
  windowTitle?: string
  /** Capture at the source's original (native) resolution. Overrides width/height. */
  native?: boolean
  /** Percent (1-99) of the primary display's native size. Ignored when `native` or explicit dimensions are set. */
  downscalePercent?: number
}

export interface ScreenCaptureResult {
  dataUrl: string
  timestamp: number
}

export interface VisionWindowSource {
  id: string
  name: string
}

export interface VisionDisplaySource {
  /** desktopCapturer source id (`screen:...`), usable as `ScreenCaptureOptions.sourceId`. */
  id: string
  /** 1-based position, ordered left to right, then top to bottom. */
  index: number
  name: string
  primary: boolean
  /** Physical pixel size; absent when the source cannot be matched to an Electron display. */
  width?: number
  height?: number
}

export interface PrimaryDisplaySize {
  width: number
  height: number
  scaleFactor: number
}

export const visionCaptureScreen = defineInvokeEventa<ScreenCaptureResult | null, ScreenCaptureOptions | undefined>('eventa:invoke:electron:vision:capture-screen')

export const visionListWindows = defineInvokeEventa<VisionWindowSource[], never>('eventa:invoke:electron:vision:list-windows')

export const visionListDisplays = defineInvokeEventa<VisionDisplaySource[], never>('eventa:invoke:electron:vision:list-displays')

export const visionGetPrimaryDisplaySize = defineInvokeEventa<PrimaryDisplaySize | null, never>('eventa:invoke:electron:vision:get-primary-display-size')

export const visionCheckPermission = defineInvokeEventa<'granted' | 'denied' | 'restricted' | 'unknown', never>('eventa:invoke:electron:vision:check-permission')
export const visionRequestPermission = defineInvokeEventa<void, never>('eventa:invoke:electron:vision:request-permission')
