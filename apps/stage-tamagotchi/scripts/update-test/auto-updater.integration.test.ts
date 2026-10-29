import type { TestServerInstance } from './start-server'

import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { UpdateClient } from '@ergosphere-it/client'
import { createNodeFileSystem } from '@ergosphere-it/client/node'
import { trustedKeyFromPublicKey } from '@ergosphere-it/protocol'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createMockRelease } from './generate-manifest'
import { startTestServer } from './start-server'

describe('over-The-Air Auto Updater Integration Matrix', () => {
  const testStoreDir = join('/tmp', 'airi-test-store-matrix')
  const testClientDir = join('/tmp', 'airi-test-client-matrix')
  let server: TestServerInstance
  let trustedKey: any

  beforeAll(async () => {
    rmSync(testStoreDir, { force: true, recursive: true })
    rmSync(testClientDir, { force: true, recursive: true })
    mkdirSync(testStoreDir, { recursive: true })
    mkdirSync(testClientDir, { recursive: true })

    const pubKey = readFileSync(
      join(import.meta.dirname, '../../../../.cache/keys/updater.key.pub'),
      'utf8',
    ).trim()
    trustedKey = await trustedKeyFromPublicKey(pubKey)

    server = await startTestServer({ storeDir: testStoreDir })
  })

  afterAll(async () => {
    await server.close()
    rmSync(testStoreDir, { force: true, recursive: true })
    rmSync(testClientDir, { force: true, recursive: true })
  })

  function createTestClient(channel: string) {
    return new UpdateClient({
      channel,
      dataDir: join(testClientDir, channel),
      feedUrl: server.url,
      fs: createNodeFileSystem(),
      host: 'airi',
      installerBundle: {
        components: [],
        dir: '/tmp',
        releaseId: 100,
        version: '0.9.42-stable.1',
      },
      nativeVersion: 1,
      product: 'airi',
      trustedKeys: [trustedKey],
    })
  }

  it('matrix Case 1: Clean OTA update discovery, signature verification, and staging', async () => {
    // Generate valid release on canary channel
    await createMockRelease({
      channel: 'canary',
      releaseId: 200,
      requires: 'reload',
      storeDir: testStoreDir,
      version: '0.9.43-canary.1',
    })

    const client = createTestClient('canary')
    const check = await client.check()

    expect(check.status).toBe('available')
    if (check.status === 'available') {
      expect(check.manifest.version).toBe('0.9.43-canary.1')
      expect(check.manifest.releaseId).toBe(200)

      const stageResult = await client.stage(check)
      expect(stageResult.status).toBe('staged')
      if (stageResult.status === 'staged') {
        expect(stageResult.releaseId).toBe(200)
        expect(stageResult.downloadedBytes).toBeGreaterThan(0)
      }
    }
  })

  it('matrix Case 2: Channel segregation - Stable client ignores Canary releases', async () => {
    // Publish baseline release on stable matching installed release 100
    await createMockRelease({
      channel: 'stable',
      releaseId: 100,
      storeDir: testStoreDir,
      version: '0.9.42-stable.1',
    })

    // Canary release 200 exists from Case 1, but stable client sees only stable.json
    const stableClient = createTestClient('stable')
    const checkStable = await stableClient.check()
    expect(checkStable.status).toBe('up-to-date')

    // Now publish newer release 250 to stable
    await createMockRelease({
      channel: 'stable',
      releaseId: 250,
      requires: 'restart',
      storeDir: testStoreDir,
      version: '0.9.43-stable.1',
    })

    const checkStableAfter = await stableClient.check()
    expect(checkStableAfter.status).toBe('available')
    if (checkStableAfter.status === 'available') {
      expect(checkStableAfter.manifest.version).toBe('0.9.43-stable.1')
      expect(checkStableAfter.manifest.releaseId).toBe(250)
    }
  })

  it('matrix Case 3: Tampered signature rejection', async () => {
    const corruptStoreDir = join('/tmp', 'airi-corrupt-store')
    rmSync(corruptStoreDir, { force: true, recursive: true })
    mkdirSync(corruptStoreDir, { recursive: true })

    const corruptServer = await startTestServer({ storeDir: corruptStoreDir })

    try {
      // Generate release with intentionally corrupted signature
      await createMockRelease({
        channel: 'dev',
        corruptSignature: true,
        releaseId: 300,
        storeDir: corruptStoreDir,
        version: '0.9.44-dev.1',
      })

      const client = new UpdateClient({
        channel: 'dev',
        dataDir: join(testClientDir, 'corrupt-test'),
        feedUrl: corruptServer.url,
        fs: createNodeFileSystem(),
        host: 'airi',
        installerBundle: {
          components: [],
          dir: '/tmp',
          releaseId: 100,
          version: '0.9.42-stable.1',
        },
        nativeVersion: 1,
        product: 'airi',
        trustedKeys: [trustedKey],
      })

      // The Ergosphere protocol returns verification-failed with an invalid-signature error
      const check = await client.check()
      expect(check.status).toBe('verification-failed')
      if (check.status === 'verification-failed') {
        expect(check.error.code).toBe('invalid-signature')
      }
    }
    finally {
      await corruptServer.close()
      rmSync(corruptStoreDir, { force: true, recursive: true })
    }
  })

  it('matrix Case 4: Rollback logic and state persistence', async () => {
    const client = createTestClient('canary')

    // Simulate crash watchdog rollback of release 200
    await client.update((state) => {
      state.blocked.push(200)
      state.rolledBack = {
        from: { fromInstaller: false, releaseId: 200, version: '0.9.43-canary.1' },
        reason: 'crashed-at-launch',
        to: { fromInstaller: true, releaseId: 100, version: '0.9.42-stable.1' },
      }
    })

    const stateAfterRollback = await client.state()
    expect(stateAfterRollback.blocked).toContain(200)
    expect(stateAfterRollback.rolledBack).toBeDefined()
    expect(stateAfterRollback.rolledBack?.from.releaseId).toBe(200)
    expect(stateAfterRollback.rolledBack?.reason).toBe('crashed-at-launch')

    // Verify dismissRollback clears the banner
    await client.dismissRollback()
    const stateDismissed = await client.state()
    expect(stateDismissed.rolledBack).toBeUndefined()
  })
})
