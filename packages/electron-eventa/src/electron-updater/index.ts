import type { UpdateInfo } from 'builder-util-runtime'

import { defineEventa, defineInvokeEventa } from '@moeru/eventa'

export type AutoUpdaterStatus
  = | 'idle'
    | 'disabled'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'

export interface AutoUpdaterProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export interface AutoUpdaterError {
  message: string
}

export interface AutoUpdaterRollback {
  from: { releaseId: number, version: string }
  to: { releaseId: number, version: string }
  reason: string
}

export interface AutoUpdaterState {
  status: AutoUpdaterStatus
  info?: Partial<Omit<UpdateInfo, 'path' | 'sha512'>> & {
    version?: string
    releaseDate?: string
    releaseId?: number
    channel?: string
    requires?: 'install' | 'reload' | 'restart'
  }
  channel?: string
  progress?: AutoUpdaterProgress
  error?: AutoUpdaterError
  rollback?: AutoUpdaterRollback
}

export const electronAutoUpdaterStateChanged = defineEventa<AutoUpdaterState>('eventa:event:electron:auto-updater:state-changed')

export const autoUpdater = {
  getState: defineInvokeEventa<AutoUpdaterState>('eventa:invoke:electron:auto-updater:get-state'),
  checkForUpdates: defineInvokeEventa<AutoUpdaterState>('eventa:invoke:electron:auto-updater:check-for-updates'),
  downloadUpdate: defineInvokeEventa<AutoUpdaterState>('eventa:invoke:electron:auto-updater:download-update'),
  quitAndInstall: defineInvokeEventa<void>('eventa:invoke:electron:auto-updater:quit-and-install'),
  getChannel: defineInvokeEventa<string>('eventa:invoke:electron:auto-updater:get-channel'),
  setChannel: defineInvokeEventa<string, { channel: string }>('eventa:invoke:electron:auto-updater:set-channel'),
  applyUpdate: defineInvokeEventa<void>('eventa:invoke:electron:auto-updater:apply-update'),
  dismissRollback: defineInvokeEventa<void>('eventa:invoke:electron:auto-updater:dismiss-rollback'),
}
