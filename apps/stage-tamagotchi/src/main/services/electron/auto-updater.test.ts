import type { UpdaterStatus } from '@ergosphere-it/electron/main'

import { describe, expect, it, vi } from 'vitest'

import { mapErgosphereStatus, setupAutoUpdater } from './auto-updater'

vi.mock('electron', () => {
  const mockApp = {
    isReady: () => true,
    getVersion: () => '0.9.42-test',
    getPath: (name: string) => `/tmp/test-${name}`,
    quit: vi.fn(),
  }
  class MockBrowserWindow {}
  return {
    default: {
      app: mockApp,
      BrowserWindow: MockBrowserWindow,
    },
    app: mockApp,
    BrowserWindow: MockBrowserWindow,
  }
})

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true },
}))

describe('auto-updater service', () => {
  describe('mapErgosphereStatus', () => {
    it('maps idle status', () => {
      const status: UpdaterStatus = { status: 'idle' }
      const mapped = mapErgosphereStatus(status, 'canary')
      expect(mapped).toEqual({ status: 'idle', channel: 'canary' })
    })

    it('maps checking status', () => {
      const status: UpdaterStatus = { status: 'checking' }
      const mapped = mapErgosphereStatus(status, 'stable')
      expect(mapped).toEqual({ status: 'checking', channel: 'stable' })
    })

    it('maps available update with requirements', () => {
      const releaseId = 1761320000000
      const status: UpdaterStatus = {
        status: 'available',
        update: {
          fromInstaller: false,
          releaseId,
          version: '0.9.43-canary.1',
          requires: 'reload',
        },
      }
      const mapped = mapErgosphereStatus(status, 'canary')
      expect(mapped.status).toBe('available')
      expect(mapped.channel).toBe('canary')
      expect(mapped.info?.version).toBe('0.9.43-canary.1')
      expect(mapped.info?.requires).toBe('reload')
      expect(mapped.info?.releaseId).toBe(releaseId)
    })

    it('maps downloading update with progress', () => {
      const status: UpdaterStatus = {
        status: 'downloading',
        bytesPerSecond: 1048576,
        downloadedBytes: 5242880,
        totalBytes: 10485760,
        percent: 50,
        update: {
          fromInstaller: false,
          releaseId: 1761320000000,
          version: '0.9.43-canary.1',
          requires: 'restart',
        },
      }
      const mapped = mapErgosphereStatus(status, 'canary')
      expect(mapped.status).toBe('downloading')
      expect(mapped.progress?.percent).toBe(50)
      expect(mapped.progress?.bytesPerSecond).toBe(1048576)
      expect(mapped.progress?.transferred).toBe(5242880)
      expect(mapped.progress?.total).toBe(10485760)
    })

    it('maps ready status to downloaded', () => {
      const status: UpdaterStatus = {
        status: 'ready',
        update: {
          fromInstaller: false,
          releaseId: 1761320000000,
          version: '0.9.43-canary.1',
          requires: 'reload',
        },
      }
      const mapped = mapErgosphereStatus(status, 'dev')
      expect(mapped.status).toBe('downloaded')
      expect(mapped.info?.version).toBe('0.9.43-canary.1')
    })

    it('maps rollback reason with details', () => {
      const status: UpdaterStatus = {
        status: 'rolled-back',
        from: { releaseId: 2, version: '0.9.43-canary.2', fromInstaller: false },
        to: { releaseId: 1, version: '0.9.43-canary.1', fromInstaller: true },
        reason: 'crashed-at-launch',
      }
      const mapped = mapErgosphereStatus(status, 'canary')
      expect(mapped.status).toBe('error')
      expect(mapped.rollback?.reason).toBe('crashed-at-launch')
      expect(mapped.rollback?.from.version).toBe('0.9.43-canary.2')
      expect(mapped.rollback?.to.version).toBe('0.9.43-canary.1')
      expect(mapped.error?.message).toContain('Rolled back to 0.9.43-canary.1')
    })
  })

  describe('setupAutoUpdater in fallback dev mode', () => {
    it('initializes and permits health reporting without crashing', () => {
      const service = setupAutoUpdater()
      expect(service.state.status).toBe('idle')
      expect(service.getChannel()).toBe('canary')

      // Disarming the watchdog should be safe and non-crashing in dev mode
      expect(() => service.reportHealthy()).not.toThrow()
    })

    it('supports channel switching in fallback mode', async () => {
      const service = setupAutoUpdater()
      await service.setChannel('stable')
      expect(service.getChannel()).toBe('stable')
    })
  })
})
