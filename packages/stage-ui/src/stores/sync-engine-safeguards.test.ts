import assert from 'node:assert/strict'

import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { storage, storageState } from '../database/storage'
import { S3StorageClient, useSyncEngineStore } from './sync-engine'
import { extractAllowedSessionIds, shouldSkipMergeableKey } from './sync-engine-merge'

describe('sync-engine-safeguards', () => {
  describe('extractAllowedSessionIds', () => {
    const sampleChatIndex = {
      userId: 'user-1',
      characters: {
        sylvia: {
          activeSessionId: 'sylvia_session_active',
          sessions: {
            sylvia_session_1: { sessionId: 'sylvia_session_1', characterId: 'sylvia' },
            sylvia_session_2: { sessionId: 'sylvia_session_2', characterId: 'sylvia' },
          },
        },
        kiana: {
          activeSessionId: 'kiana_session_active',
          sessions: {
            kiana_session_1: { sessionId: 'kiana_session_1', characterId: 'kiana' },
          },
        },
        bronya: {
          activeSessionId: 'bronya_session_active',
          sessions: {
            bronya_session_1: { sessionId: 'bronya_session_1', characterId: 'bronya' },
          },
        },
      },
    }

    it('extracts session IDs exclusively for checked characters', () => {
      const checkedIds = ['chat-sylvia', 'metadata']
      const allowed = extractAllowedSessionIds([sampleChatIndex], checkedIds)

      assert.equal(allowed.has('sylvia_session_1'), true)
      assert.equal(allowed.has('sylvia_session_2'), true)
      assert.equal(allowed.has('sylvia_session_active'), true)

      // Kiana and Bronya were not checked
      assert.equal(allowed.has('kiana_session_1'), false)
      assert.equal(allowed.has('kiana_session_active'), false)
      assert.equal(allowed.has('bronya_session_1'), false)
      assert.equal(allowed.has('bronya_session_active'), false)
    })

    it('allows all sessions when root "chats" is checked', () => {
      const checkedIds = ['chats']
      const allowed = extractAllowedSessionIds([sampleChatIndex], checkedIds)

      assert.equal(allowed.has('sylvia_session_1'), true)
      assert.equal(allowed.has('kiana_session_1'), true)
      assert.equal(allowed.has('bronya_session_1'), true)
    })

    it('returns empty set when no characters are checked', () => {
      const checkedIds = ['metadata', 'models']
      const allowed = extractAllowedSessionIds([sampleChatIndex], checkedIds)

      assert.equal(allowed.size, 0)
    })

    it('handles null, undefined, or empty indices gracefully', () => {
      assert.equal(extractAllowedSessionIds([], ['chat-sylvia']).size, 0)
      assert.equal(extractAllowedSessionIds([null, undefined], ['chat-sylvia']).size, 0)
    })
  })

  describe('shouldSkipMergeableKey', () => {
    it('skips download when local is at least as new as remote and outbox is clean', () => {
      const skip = shouldSkipMergeableKey(2000, 1000, false)
      assert.equal(skip, true)
    })

    it('skips download when local timestamp equals remote mtime and outbox is clean', () => {
      const skip = shouldSkipMergeableKey(1000, 1000, false)
      assert.equal(skip, true)
    })

    it('does NOT skip download when remote is newer than local', () => {
      const skip = shouldSkipMergeableKey(1000, 2000, false)
      assert.equal(skip, false)
    })

    it('does NOT skip download when local has pending mutations in outbox', () => {
      const skip = shouldSkipMergeableKey(2000, 1000, true)
      assert.equal(skip, false)
    })

    it('does NOT skip download when localTime is undefined and ETags do not match', () => {
      const skip = shouldSkipMergeableKey(undefined, 1000, false)
      assert.equal(skip, false)
    })

    it('skips download when ETags match even if localTime is missing', () => {
      const skip = shouldSkipMergeableKey(undefined, 1000, false, 'etag123', 'etag123')
      assert.equal(skip, true)
    })
  })

  describe('s3StorageClient.listFiles XML parsing and ETag extraction', () => {
    it('parses S3/R2 XML response, extracts ETags (stripping quotes), and normalizes mtime/size', async () => {
      const s3Client = new S3StorageClient(
        'https://mock-account.r2.cloudflarestorage.com',
        'airi-sync',
        'auto',
        'mock-key',
        'mock-secret',
      )

      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>airi-sync</Name>
  <Prefix></Prefix>
  <Contents>
    <Key>db/airi-cards.json</Key>
    <LastModified>2026-09-09T22:30:00.000Z</LastModified>
    <ETag>&quot;d41d8cd98f00b204e9800998ecf8427e&quot;</ETag>
    <Size>12345</Size>
  </Contents>
  <Contents>
    <Key>db/chat/sessions/session-1.json</Key>
    <LastModified>2026-09-09T22:35:00.000Z</LastModified>
    <ETag>"plain-etag-abc123"</ETag>
    <Size>678</Size>
  </Contents>
  <Contents>
    <Key>db/empty.json</Key>
    <LastModified>2026-09-09T22:00:00.000Z</LastModified>
    <Size>0</Size>
  </Contents>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`

      ;(s3Client as any).client = {
        fetch: vi.fn(async () => {
          return new Response(mockXml, {
            status: 200,
            headers: { 'Content-Type': 'application/xml' },
          })
        }),
      }

      const result = await s3Client.listFiles()
      expect(result.success).toBe(true)
      expect(result.files).toBeDefined()
      expect(result.files?.length).toBe(3)

      const cardsFile = result.files?.find(f => f.relPath === 'db/airi-cards.json')
      expect(cardsFile).toBeDefined()
      expect(cardsFile?.etag).toBe('d41d8cd98f00b204e9800998ecf8427e')
      expect(cardsFile?.size).toBe(12345)
      expect(cardsFile?.mtime).toBe(new Date('2026-09-09T22:30:00.000Z').getTime())

      const sessionFile = result.files?.find(f => f.relPath === 'db/chat/sessions/session-1.json')
      expect(sessionFile).toBeDefined()
      expect(sessionFile?.etag).toBe('plain-etag-abc123')
      expect(sessionFile?.size).toBe(678)

      const emptyFile = result.files?.find(f => f.relPath === 'db/empty.json')
      expect(emptyFile).toBeDefined()
      expect(emptyFile?.etag).toBeUndefined()
      expect(emptyFile?.size).toBe(0)
    })
  })

  describe('reconcile zero-read request bounds (integration)', () => {
    let pinia: ReturnType<typeof createTestingPinia>
    let readCalls: string[] = []

    beforeEach(async () => {
      pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
      setActivePinia(pinia)
      storageState.isImportingRemoteData = false
      readCalls = []

      // Clean local storage
      const keys = await storage.getKeys()
      for (const k of keys) {
        await storage.removeItem(k)
      }

      localStorage.clear()
      localStorage.setItem('settings/sync/enabled', 'true')
    })

    afterEach(async () => {
      localStorage.clear()
      delete (window as any).electron
      const keys = await storage.getKeys()
      for (const k of keys) {
        await storage.removeItem(k)
      }
    })

    it('strictly avoids readFile for unselected sessions, size-matched files, and up-to-date mergeables', async () => {
      // Configure selective sync in localStorage so useLocalStorageManualReset initializes properly
      localStorage.setItem('settings/sync/selective-enabled', 'true')
      localStorage.setItem('settings/sync/selective-checked-ids', JSON.stringify(['chat-sylvia']))

      const syncStore = useSyncEngineStore(pinia)
      syncStore.activeProvider = 'local-fs'
      syncStore.selectiveSyncEnabled = true
      syncStore.selectiveCheckedIds = ['chat-sylvia']

      // Seed local storage with isImportingRemoteData = true so seeding does not generate artificial outbox entries
      storageState.isImportingRemoteData = true
      const sampleChatIndex = {
        userId: 'user-1',
        characters: {
          sylvia: {
            activeSessionId: 'sylvia-1',
            sessions: {
              'sylvia-1': { sessionId: 'sylvia-1', characterId: 'sylvia' },
            },
          },
          bronya: {
            activeSessionId: 'bronya-1',
            sessions: {
              'bronya-1': { sessionId: 'bronya-1', characterId: 'bronya' },
              'bronya-2': { sessionId: 'bronya-2', characterId: 'bronya' },
            },
          },
        },
      }
      await storage.setItem('local:chat/index/default', sampleChatIndex)
      await storage.setItemRaw('local:sync-metadata/timestamps/chat/index/default', 1000)
      await storage.setItemRaw('local:sync-metadata/etags/chat/index/default', 'idx-etag')

      // Seed a local size-matched setting
      await storage.setItem('local:settings/appearance', { theme: 'dark' })
      const appearanceRaw = await storage.getItemRaw('local:settings/appearance')
      const appearanceSerialized = typeof appearanceRaw === 'string' ? appearanceRaw : JSON.stringify(appearanceRaw, null, 2)
      const appearanceSize = new TextEncoder().encode(appearanceSerialized).byteLength

      // Seed up-to-date cards with matching etag and newer local timestamp
      await storage.setItem('local:airi-cards', [{ id: 'card-1' }])
      await storage.setItemRaw('local:sync-metadata/timestamps/airi-cards', 2500)
      await storage.setItemRaw('local:sync-metadata/etags/airi-cards', 'cards-etag-matching')
      storageState.isImportingRemoteData = false

      // Configure mock remote files in the simulated backup share
      const remoteFiles = [
        { relPath: 'db/chat/index/default.json', mtime: 1000, size: 500, etag: 'idx-etag' },
        // Sylvia session (selected, newer remote -> SHOULD be downloaded)
        { relPath: 'db/chat/sessions/sylvia-1.json', mtime: 2000, size: 800 },
        // Bronya sessions (unselected -> MUST NOT be downloaded)
        { relPath: 'db/chat/sessions/bronya-1.json', mtime: 2000, size: 800 },
        { relPath: 'db/chat/sessions/bronya-2.json', mtime: 2000, size: 800 },
        // Bronya director session (unselected -> MUST NOT be downloaded)
        { relPath: 'db/director/sessions/bronya-1.json', mtime: 2000, size: 800 },
        // Size matched setting (size match short-circuit -> MUST NOT be downloaded)
        { relPath: 'db/settings/appearance.json', mtime: 2000, size: appearanceSize },
        // Up-to-date cards (etag matches & local is newer -> MUST NOT be downloaded)
        { relPath: 'db/airi-cards.json', mtime: 2000, size: 9999, etag: 'cards-etag-matching' },
      ]

      ;(window as any).electron = {
        ipcRenderer: {
          invoke: vi.fn(async (channel: string, payload: any) => {
            if (channel === 'byos-fs:validate-path')
              return { success: true }
            if (channel === 'byos-fs:list-files')
              return { success: true, files: remoteFiles }
            if (channel === 'byos-fs:read-file') {
              readCalls.push(payload.relPath)
              return { success: true, content: JSON.stringify({ id: 'sylvia-session-data' }) }
            }
            if (channel === 'byos-fs:write-file')
              return { success: true, mtime: Date.now() }
            return { success: true }
          }),
        },
      }

      const success = await syncStore.reconcile({ skipBinaryAssets: true })
      expect(success).toBe(true)

      // 1. Sylvia's session WAS downloaded because it is selected
      expect(readCalls).toContain('db/chat/sessions/sylvia-1.json')

      // 2. Bronya's unselected sessions were NEVER read
      expect(readCalls).not.toContain('db/chat/sessions/bronya-1.json')
      expect(readCalls).not.toContain('db/chat/sessions/bronya-2.json')
      expect(readCalls).not.toContain('db/director/sessions/bronya-1.json')

      // 3. Size-matched file was NEVER read to "compare"
      expect(readCalls).not.toContain('db/settings/appearance.json')

      // 4. Mergeable airi-cards was NEVER read because ETag matched and local was newer
      expect(readCalls).not.toContain('db/airi-cards.json')

      // 5. Total reads across the entire remote store was strictly bounded to 1 (only sylvia-1)
      expect(readCalls.length).toBe(1)
    })
  })

  describe('outbox selective sync boundary', () => {
    let pinia: ReturnType<typeof createTestingPinia>
    let writeCalls: string[] = []

    beforeEach(async () => {
      pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
      setActivePinia(pinia)
      storageState.isImportingRemoteData = false
      writeCalls = []

      const keys = await storage.getKeys()
      for (const k of keys) {
        await storage.removeItem(k)
      }
      localStorage.clear()
      localStorage.setItem('settings/sync/enabled', 'true')
    })

    afterEach(async () => {
      localStorage.clear()
      delete (window as any).electron
      const keys = await storage.getKeys()
      for (const k of keys) {
        await storage.removeItem(k)
      }
    })

    it('does not upload outbox mutations for unselected characters', async () => {
      localStorage.setItem('settings/sync/selective-enabled', 'true')
      localStorage.setItem('settings/sync/selective-checked-ids', JSON.stringify(['chat-sylvia']))

      const syncStore = useSyncEngineStore(pinia)
      syncStore.activeProvider = 'local-fs'
      syncStore.selectiveSyncEnabled = true
      syncStore.selectiveCheckedIds = ['chat-sylvia']

      // Setup chat index
      const sampleChatIndex = {
        userId: 'user-1',
        characters: {
          sylvia: { sessions: { 'sylvia-1': { characterId: 'sylvia' } } },
          bronya: { sessions: { 'bronya-1': { characterId: 'bronya' } } },
        },
      }
      await storage.setItem('local:chat/index/default', sampleChatIndex)

      // Populate local session data
      await storage.setItemRaw('local:chat/sessions/sylvia-1', { id: 'sylvia-1', meta: { characterId: 'sylvia' } })
      await storage.setItemRaw('local:chat/sessions/bronya-1', { id: 'bronya-1', meta: { characterId: 'bronya' } })

      // Put both in outbox queue
      await storage.setItemRaw('outbox:queue/chat/sessions/sylvia-1', {
        key: 'local:chat/sessions/sylvia-1',
        action: 'upsert',
        timestamp: Date.now(),
      })
      await storage.setItemRaw('outbox:queue/chat/sessions/bronya-1', {
        key: 'local:chat/sessions/bronya-1',
        action: 'upsert',
        timestamp: Date.now(),
      })

      ;(window as any).electron = {
        ipcRenderer: {
          invoke: vi.fn(async (channel: string, payload: any) => {
            if (channel === 'byos-fs:validate-path')
              return { success: true }
            if (channel === 'byos-fs:write-file') {
              writeCalls.push(payload.relPath)
              return { success: true, mtime: Date.now() }
            }
            return { success: true }
          }),
        },
      }

      const success = await syncStore.processOutbox()
      expect(success).toBe(true)

      // Sylvia's session WAS uploaded to remote
      expect(writeCalls).toContain('db/chat/sessions/sylvia-1.json')
      // Bronya's unselected session was NEVER uploaded to remote
      expect(writeCalls).not.toContain('db/chat/sessions/bronya-1.json')

      // Sylvia's outbox item was drained upon upload
      expect(await storage.getItemRaw('outbox:queue/chat/sessions/sylvia-1')).toBeNull()
      // Bronya's outbox item was skipped without writing to remote
      expect(await storage.getItemRaw('outbox:queue/chat/sessions/bronya-1')).toBeNull()
    })
  })

  describe('reconcile in-flight concurrency lock', () => {
    let pinia: ReturnType<typeof createTestingPinia>

    beforeEach(async () => {
      pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
      setActivePinia(pinia)
      storageState.isImportingRemoteData = false
      localStorage.clear()
      localStorage.setItem('settings/sync/enabled', 'true')
    })

    afterEach(async () => {
      localStorage.clear()
      delete (window as any).electron
    })

    it('deduplicates concurrent reconcile calls into a single execution', async () => {
      const syncStore = useSyncEngineStore(pinia)
      syncStore.activeProvider = 'local-fs'

      let listFilesCallCount = 0

      ;(window as any).electron = {
        ipcRenderer: {
          invoke: vi.fn(async (channel: string) => {
            if (channel === 'byos-fs:validate-path')
              return { success: true }
            if (channel === 'byos-fs:list-files') {
              listFilesCallCount++
              // Simulate network delay to ensure both reconcile calls overlap
              await new Promise(r => setTimeout(r, 20))
              return { success: true, files: [] }
            }
            return { success: true }
          }),
        },
      }

      // Fire two reconcile calls simultaneously
      const [res1, res2] = await Promise.all([
        syncStore.reconcile({ skipBinaryAssets: true }),
        syncStore.reconcile({ skipBinaryAssets: true }),
      ])

      expect(res1).toBe(true)
      expect(res2).toBe(true)
      // listFiles should have been called only ONCE due to inFlightReconcile promise sharing
      expect(listFilesCallCount).toBe(1)
    })
  })
})
