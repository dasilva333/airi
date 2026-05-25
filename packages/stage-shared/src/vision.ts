import { defineInvokeEventa } from '@moeru/eventa'

export interface ScreenCaptureOptions {
  width?: number
  height?: number
  type?: 'screen' | 'window'
  sourceId?: string
}

export interface ScreenCaptureResult {
  dataUrl: string
  timestamp: number
}

export const visionCaptureScreen = defineInvokeEventa<ScreenCaptureResult | null, ScreenCaptureOptions | undefined>(
  'eventa:invoke:electron:vision:capture-screen',
)

export const visionCheckPermission = defineInvokeEventa<'granted' | 'denied' | 'restricted' | 'unknown', never>(
  'eventa:invoke:electron:vision:check-permission',
)
export const visionRequestPermission = defineInvokeEventa<void, never>(
  'eventa:invoke:electron:vision:request-permission',
)
