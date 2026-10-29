import type { AutoUpdaterProgress, AutoUpdaterState } from '@proj-airi/electron-eventa/electron-updater'

import { EventEmitter } from 'node:events'

import { app } from 'electron'

export class MockAutoUpdater extends EventEmitter {
  autoDownload = false
  channel = 'canary'
  healthy = false
  state: AutoUpdaterState = { status: 'idle', channel: 'canary' }

  reportHealthy() {
    this.healthy = true
    this.emit('healthy')
  }

  delayHealthCheck(seconds: number) {
    this.emit('health-delayed', seconds)
  }

  async checkForUpdates(): Promise<void> {
    this.state = { status: 'checking', channel: this.channel }
    this.emit('status', this.state)

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800))

    const releaseId = Date.now()
    this.state = {
      status: 'available',
      channel: this.channel,
      info: {
        version: '0.9.99-mock',
        files: [],
        releaseDate: new Date(releaseId).toISOString(),
        releaseId,
        requires: 'reload',
        releaseNotes: '## Mock Update\n\n- Ergosphere OTA mock simulation\n- Fast reload-in-place verification',
      },
    }
    this.emit('status', this.state)
  }

  async downloadUpdate(): Promise<void> {
    const total = 50 * 1024 * 1024 // 50MB
    let transferred = 0
    const speed = 10 * 1024 * 1024 // 10MB/s

    const interval = setInterval(() => {
      transferred += speed / 5
      if (transferred > total)
        transferred = total

      const percent = (transferred / total) * 100
      const progress: AutoUpdaterProgress = {
        total,
        transferred,
        percent,
        bytesPerSecond: speed,
      }

      this.state = {
        status: 'downloading',
        channel: this.channel,
        progress,
        info: this.state.info,
      }
      this.emit('status', this.state)

      if (transferred >= total) {
        clearInterval(interval)
        this.state = {
          status: 'downloaded',
          channel: this.channel,
          info: this.state.info,
        }
        this.emit('status', this.state)
      }
    }, 100)
  }

  async applyUpdate(): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('[MockAutoUpdater] applyUpdate called. Simulating update application...')
    if (this.state.info?.requires === 'restart') {
      app.quit()
    }
    else {
      this.state = { status: 'idle', channel: this.channel }
      this.emit('status', this.state)
    }
  }

  async quitAndInstall(): Promise<void> {
    return this.applyUpdate()
  }

  async setChannel(newChannel: string): Promise<void> {
    this.channel = newChannel
    this.state = { ...this.state, channel: newChannel }
    this.emit('status', this.state)
  }

  async dismissRollback(): Promise<void> {
    this.state = { status: 'idle', channel: this.channel }
    this.emit('status', this.state)
  }
}
