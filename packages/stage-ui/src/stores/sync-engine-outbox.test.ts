import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { storage, storageState } from '../database/storage'
import { useSyncEngineStore } from './sync-engine'

describe('byos sync engine outbox ledger', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(async () => {
    pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)
    storageState.isImportingRemoteData = false

    // Clear all storage keys before each test
    const keys = await storage.getKeys()
    for (const key of keys) {
      await storage.removeItem(key)
    }

    // Default sync enabled in localStorage
    localStorage.setItem('settings/sync/enabled', 'true')
  })

  afterEach(async () => {
    localStorage.clear()
    delete (window as any).electron
    const keys = await storage.getKeys()
    for (const key of keys) {
      await storage.removeItem(key)
    }
  })

  it('enqueues outbox items when local repository writes occur with sync enabled', async () => {
    const testKey = 'local:chat/sessions/test-session-1'
    const testData = { id: 'test-session-1', title: 'Conversation Alpha' }

    await storage.setItem(testKey, testData)

    // Check outbox item
    const outboxItem = await storage.getItemRaw<{ key: string, action: string, timestamp: number }>('outbox:queue/chat/sessions/test-session-1')
    expect(outboxItem).toBeDefined()
    expect(outboxItem?.key).toBe(testKey)
    expect(outboxItem?.action).toBe('upsert')
    expect(outboxItem?.timestamp).toBeGreaterThan(0)

    // Check local modification timestamp metadata
    const timestamp = await storage.getItemRaw<number>('local:sync-metadata/timestamps/chat/sessions/test-session-1')
    expect(timestamp).toBe(outboxItem?.timestamp)
  })

  it('does not enqueue outbox items when sync is disabled in settings', async () => {
    localStorage.setItem('settings/sync/enabled', 'false')

    await storage.setItem('local:chat/sessions/disabled-sync', { id: 'disabled-sync' })

    const outboxItem = await storage.getItemRaw('outbox:queue/chat/sessions/disabled-sync')
    expect(outboxItem).toBeNull()
  })

  it('ignores metadata and non-local keys during interception', async () => {
    await storage.setItem('local:sync-metadata/test', { meta: true })
    await storage.setItem('external:config', { value: 123 })

    const outboxMeta = await storage.getItemRaw('outbox:queue/sync-metadata/test')
    const outboxExt = await storage.getItemRaw('outbox:queue/external:config')

    expect(outboxMeta).toBeNull()
    expect(outboxExt).toBeNull()
  })

  it('compacts rapid successive writes into a single outbox item with the latest timestamp', async () => {
    const cardKey = 'local:airi-cards'

    // Perform 3 rapid writes
    await storage.setItem(cardKey, [{ id: 'card-1', name: 'Draft 1' }])
    const firstItem = await storage.getItemRaw<{ timestamp: number }>('outbox:queue/airi-cards')

    // Small delay to ensure timestamp difference
    await new Promise(r => setTimeout(r, 5))
    await storage.setItem(cardKey, [{ id: 'card-1', name: 'Draft 2' }])

    await new Promise(r => setTimeout(r, 5))
    await storage.setItem(cardKey, [{ id: 'card-1', name: 'Draft Final' }])
    const finalItem = await storage.getItemRaw<{ key: string, action: string, timestamp: number }>('outbox:queue/airi-cards')

    // Verify exactly one item exists in the queue for this key
    const allOutboxKeys = (await storage.getKeys('outbox')).filter(k => k.includes('airi-cards'))
    expect(allOutboxKeys.length).toBe(1)

    // Timestamp must have advanced to the latest write
    expect(finalItem?.timestamp).toBeGreaterThan(firstItem!.timestamp)
    expect(finalItem?.action).toBe('upsert')
  })

  it('enqueues deletion action in outbox when an item is removed', async () => {
    const sessionKey = 'local:chat/sessions/to-delete'
    await storage.setItem(sessionKey, { id: 'to-delete' })

    // Now delete it
    await storage.removeItem(sessionKey)

    const outboxItem = await storage.getItemRaw<{ key: string, action: string }>('outbox:queue/chat/sessions/to-delete')
    expect(outboxItem).toBeDefined()
    expect(outboxItem?.action).toBe('delete')

    // Timestamp metadata should be wiped
    const metaTimestamp = await storage.getItemRaw('local:sync-metadata/timestamps/chat/sessions/to-delete')
    expect(metaTimestamp).toBeNull()
  })

  it('drains outbox items upon successful remote write during processOutbox', async () => {
    const syncStore = useSyncEngineStore(pinia)
    syncStore.activeProvider = 'local-fs'

    // Populate local item & outbox item
    const sessionKey = 'local:chat/sessions/success-test'
    await storage.setItem(sessionKey, { id: 'success-test', title: 'Synchronized' })

    expect(await storage.getItemRaw('outbox:queue/chat/sessions/success-test')).toBeDefined()

    // Mock Electron IPC bridge
    const invokeSpy = vi.fn(async (channel: string) => {
      if (channel === 'byos-fs:validate-path')
        return { success: true }
      if (channel === 'byos-fs:write-file')
        return { success: true, mtime: Date.now() }
      if (channel === 'byos-fs:read-file')
        return { success: true, content: '{}' }
      if (channel === 'byos-fs:delete-file')
        return { success: true }
      return { success: true }
    })
    ;(window as any).electron = { ipcRenderer: { invoke: invokeSpy } }

    const success = await syncStore.processOutbox()
    expect(success).toBe(true)

    // Outbox item should now be drained
    const remainingOutbox = await storage.getItemRaw('outbox:queue/chat/sessions/success-test')
    expect(remainingOutbox).toBeNull()

    // IPC should have been invoked to write the file
    expect(invokeSpy).toHaveBeenCalledWith('byos-fs:write-file', expect.anything())
  })

  it('preserves outbox items for retry when remote client fails (500 / network error)', async () => {
    const syncStore = useSyncEngineStore(pinia)
    syncStore.activeProvider = 'local-fs'

    const sessionKey = 'local:chat/sessions/retry-test'
    await storage.setItem(sessionKey, { id: 'retry-test', title: 'Must Not Be Lost' })

    // Mock failing Electron IPC bridge
    const invokeSpy = vi.fn(async (channel: string) => {
      if (channel === 'byos-fs:validate-path')
        return { success: true }
      return { success: false, error: 'HTTP 500 Internal Server Error / EIO' }
    })
    ;(window as any).electron = { ipcRenderer: { invoke: invokeSpy } }

    const success = await syncStore.processOutbox()
    expect(success).toBe(false)

    // Outbox item MUST STILL EXIST to guarantee zero data loss
    const remainingOutbox = await storage.getItemRaw('outbox:queue/chat/sessions/retry-test')
    expect(remainingOutbox).toBeDefined()
  })
})
