import { defineInvokeEventa } from '@moeru/eventa'

export interface ScreenCaptureOptions {
  width?: number
  height?: number
  type?: 'screen' | 'window'
  sourceId?: string
  /** Capture at the source's original (native) resolution. Overrides width/height. */
  native?: boolean
  /** Percent (1-99) of the primary display's native size. Ignored when `native` or explicit dimensions are set. */
  downscalePercent?: number
}

export interface ScreenCaptureResult {
  dataUrl: string
  timestamp: number
}

export interface PrimaryDisplaySize {
  width: number
  height: number
  scaleFactor: number
}

export const visionCaptureScreen = defineInvokeEventa<ScreenCaptureResult | null, ScreenCaptureOptions | undefined>('eventa:invoke:electron:vision:capture-screen')

export const visionGetPrimaryDisplaySize = defineInvokeEventa<PrimaryDisplaySize | null, never>('eventa:invoke:electron:vision:get-primary-display-size')

export const visionCheckPermission = defineInvokeEventa<'granted' | 'denied' | 'restricted' | 'unknown', never>('eventa:invoke:electron:vision:check-permission')
export const visionRequestPermission = defineInvokeEventa<void, never>('eventa:invoke:electron:vision:request-permission')
