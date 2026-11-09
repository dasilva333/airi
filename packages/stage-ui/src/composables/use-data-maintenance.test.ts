import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDataMaintenance } from './use-data-maintenance'

const {
  mockChatSessionsRepo,
  mockEchoChipsRepo,
  mockLifetimeMemoryRepo,
  mockAiriCardStore,
  mockChatIndex,
  mockSTMMBlocks,
  mockLTMMEntries,
  mockStorage,
  mockBackgroundStore,
} = vi.hoisted(() => {
  return {
    mockChatSessionsRepo: {
      getSession: vi.fn(),
      saveSession: vi.fn(),
      deleteSession: vi.fn(),
    },
    mockEchoChipsRepo: {
      getAll: vi.fn(),
      saveAll: vi.fn(),
    },
    mockLifetimeMemoryRepo: {
      getByCharacter: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    },
    mockAiriCardStore: {
      cards: new Map<string, any>(),
      resetState: vi.fn(),
    },
    mockChatIndex: {
      userId: 'local',
      characters: {} as Record<string, any>,
    },
    mockSTMMBlocks: { value: [] as any[] },
    mockLTMMEntries: { value: [] as any[] },
    mockStorage: {
      getKeys: vi.fn(async (): Promise<string[]> => []),
      getItemRaw: vi.fn(),
      setItemRaw: vi.fn(),
      removeItem: vi.fn(),
    },
    mockBackgroundStore: {
      entries: new Map(),
      addBackground: vi.fn(async () => 'bg-mock-entry-id'),
    },
  }
})

vi.mock('../database/storage', () => ({
  storage: mockStorage,
  storageState: { isImportingRemoteData: false },
}))

vi.mock('../database/repos/chat-sessions.repo', () => ({
  chatSessionsRepo: mockChatSessionsRepo,
}))

vi.mock('../database/repos/echo-chips.repo', () => ({
  echoChipsRepo: mockEchoChipsRepo,
}))

vi.mock('../database/repos/lifetime-memory.repo', () => ({
  lifetimeMemoryRepo: mockLifetimeMemoryRepo,
}))

vi.mock('../stores/modules/airi-card', () => ({
  useAiriCardStore: () => mockAiriCardStore,
}))

vi.mock('../stores/modules/artistry', () => ({
  useArtistryStore: () => ({
    resetState: vi.fn(),
  }),
}))

vi.mock('../stores/chat/session-store', () => ({
  useChatSessionStore: () => ({
    ready: true,
    initialize: vi.fn(),
    index: mockChatIndex,
    resetAllSessions: vi.fn(),
    exportSessions: vi.fn(async () => ({
      format: 'chat-sessions-index:v1',
      index: mockChatIndex,
      sessions: {},
    })),
    importSessions: vi.fn(),
    sessionMessages: {},
    sessionMetas: {},
    sessionGenerations: {},
    persistIndex: vi.fn(),
  }),
}))

vi.mock('../stores/memory-short-term', () => ({
  useShortTermMemoryStore: () => ({
    load: vi.fn(async () => {}),
    blocks: mockSTMMBlocks.value,
    persist: vi.fn(async (blocks: any[]) => {
      mockSTMMBlocks.value = blocks
    }),
  }),
}))

vi.mock('../stores/memory-text-journal', () => ({
  useTextJournalStore: () => ({
    load: vi.fn(async () => {}),
    entries: mockLTMMEntries.value,
    persist: vi.fn(async (entries: any[]) => {
      mockLTMMEntries.value = entries
    }),
  }),
}))

vi.mock('../stores/background', () => ({
  useBackgroundStore: () => mockBackgroundStore,
}))

vi.mock('../stores/chat', () => ({
  useChatOrchestratorStore: () => ({
    cancelPendingSends: vi.fn(),
  }),
}))

vi.mock('../stores/display-models', () => ({
  useDisplayModelsStore: () => ({
    resetDisplayModels: vi.fn(),
  }),
}))

vi.mock('../stores/mcp', () => ({
  useMcpStore: () => ({
    resetState: vi.fn(),
  }),
}))

vi.mock('../stores/modules/consciousness', () => ({
  useConsciousnessStore: () => ({
    resetState: vi.fn(),
  }),
}))

vi.mock('../stores/modules/discord', () => ({
  useDiscordStore: () => ({
    resetState: vi.fn(),
  }),
}))

vi.mock('../stores/modules/gaming-factorio', () => ({
  useFactorioStore: () => ({
    resetState: vi.fn(),
  }),
}))

vi.mock('../stores/modules/hearing', () => ({
  useHearingStore: () => ({
    resetState: vi.fn(),
  }),
}))

vi.mock('../stores/modules/speech', () => ({
  useSpeechStore: () => ({
    resetState: vi.fn(),
  }),
}))

vi.mock('../stores/modules/twitter', () => ({
  useTwitterStore: () => ({
    resetState: vi.fn(),
  }),
}))

vi.mock('../stores/onboarding', () => ({
  useOnboardingStore: () => ({
    resetSetupState: vi.fn(),
  }),
}))

vi.mock('../stores/providers', () => ({
  useProvidersStore: () => ({
    resetProviderSettings: vi.fn(),
  }),
}))

vi.mock('../stores/settings', () => ({
  useSettings: () => ({
    stageModelSelected: 'preset-live2d-1',
    updateStageModel: vi.fn(),
    resetState: vi.fn(),
  }),
  useSettingsAudioDevice: () => ({
    resetState: vi.fn(),
  }),
}))

vi.mock('@proj-airi/stage-ui-live2d', () => ({
  useLive2d: () => ({
    resetState: vi.fn(),
  }),
}))

describe('useDataMaintenance characterization tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAiriCardStore.cards = new Map()
    mockSTMMBlocks.value = []
    mockLTMMEntries.value = []
    mockChatIndex.userId = 'local'
    mockChatIndex.characters = {}
  })

  describe('characters Export & Import', () => {
    it('exports characters in airi-characters:v1 format', async () => {
      mockAiriCardStore.cards.set('card-1', { name: 'Airi', nickname: 'Airi-Chan' })
      const { exportAllCharacters } = useDataMaintenance()

      const blob = await exportAllCharacters()
      const text = await blob.text()
      const json = JSON.parse(text)

      expect(json.format).toBe('airi-characters:v1')
      expect(Array.isArray(json.cards)).toBe(true)
      expect(json.cards.length).toBe(1)
      expect(json.cards[0][0]).toBe('card-1')
      expect(json.cards[0][1].name).toBe('Airi')
    })

    it('imports characters and skips already existing IDs to prevent overwrites', async () => {
      mockAiriCardStore.cards.set('existing-card', { name: 'Original' })
      const { importAllCharacters } = useDataMaintenance()

      await importAllCharacters({
        format: 'airi-characters:v1',
        cards: [
          ['existing-card', { name: 'Should Not Overwrite' }],
          ['new-card', { name: 'New Companion' }],
        ],
      })

      expect(mockAiriCardStore.cards.get('existing-card').name).toBe('Original')
      expect(mockAiriCardStore.cards.get('new-card').name).toBe('New Companion')
    })
  })

  describe('memory Export & Import', () => {
    it('exports short term and text journal memory blocks', async () => {
      mockSTMMBlocks.value = [{ id: 'stmm-1', summary: 'Day 1 recap' }]
      mockLTMMEntries.value = [{ id: 'ltmm-1', content: 'Journal note' }]
      const { exportMemory } = useDataMaintenance()

      const blob = await exportMemory()
      const text = await blob.text()
      const json = JSON.parse(text)

      expect(json.format).toBe('airi-memory:v1')
      expect(json.shortTermBlocks).toHaveLength(1)
      expect(json.journalEntries).toHaveLength(1)
    })

    it('imports memory without duplicating existing block IDs', async () => {
      mockSTMMBlocks.value = [{ id: 'stmm-1', summary: 'Day 1' }]
      mockLTMMEntries.value = [{ id: 'ltmm-1', content: 'Note 1' }]
      const { importMemory } = useDataMaintenance()

      await importMemory({
        format: 'airi-memory:v1',
        shortTermBlocks: [
          { id: 'stmm-1', summary: 'Duplicate' },
          { id: 'stmm-2', summary: 'Day 2' },
        ],
        journalEntries: [
          { id: 'ltmm-1', content: 'Duplicate note' },
          { id: 'ltmm-2', content: 'Note 2' },
        ],
      })

      expect(mockSTMMBlocks.value).toHaveLength(2)
      expect(mockSTMMBlocks.value.map(b => b.id)).toEqual(['stmm-1', 'stmm-2'])
      expect(mockLTMMEntries.value).toHaveLength(2)
      expect(mockLTMMEntries.value.map(e => e.id)).toEqual(['ltmm-1', 'ltmm-2'])
    })
  })

  describe('orphan Detection (getOrphanedGroups)', () => {
    it('identifies character IDs in the session index that do not exist in cards store', async () => {
      mockAiriCardStore.cards.set('default', { name: 'ReLU' })

      mockChatIndex.characters = {
        'default': {
          activeSessionId: 'sess-default',
          sessions: {
            'sess-default': { messageCount: 10, updatedAt: 1000 },
          },
        },
        'orphan-yuriel': {
          activeSessionId: 'sess-yuriel-active',
          sessions: {
            'sess-yuriel-1': { messageCount: 20, updatedAt: 2000 },
            'sess-yuriel-active': { messageCount: 43, updatedAt: 3000 },
          },
        },
      }

      mockChatSessionsRepo.getSession.mockImplementation(async (sid: string) => {
        if (sid === 'sess-yuriel-active') {
          return {
            messages: [{ content: 'Hello Sorako, remember me?' }],
          }
        }
        return null
      })

      const { getOrphanedGroups } = useDataMaintenance()
      const orphans = await getOrphanedGroups()

      expect(orphans).toHaveLength(1)
      expect(orphans[0].characterId).toBe('orphan-yuriel')
      expect(orphans[0].messageCount).toBe(63)
      expect(orphans[0].lastActive).toBe(3000)
      expect(orphans[0].preview).toBe('Hello Sorako, remember me?')
    })
  })

  describe('orphan Restoration (restoreOrphanedGroups)', () => {
    it('restores orphan as a new companion card when targetId is "new"', async () => {
      mockChatIndex.characters = {
        'orphan-yuriel': {
          activeSessionId: 'sess-empty',
          sessions: {
            'sess-empty': { messageCount: 0, updatedAt: 1000 },
            'sess-populated': { messageCount: 63, updatedAt: 2000 },
          },
        },
      }

      const { restoreOrphanedGroups } = useDataMaintenance()
      await restoreOrphanedGroups({ 'orphan-yuriel': 'new' })

      expect(mockAiriCardStore.cards.has('orphan-yuriel')).toBe(true)
      expect(mockAiriCardStore.cards.get('orphan-yuriel').name).toBe('orphan-yuriel')
      expect(mockChatIndex.characters['orphan-yuriel'].activeSessionId).toBe('sess-populated')
    })

    it('merges orphan sessions into existing companion and migrates multi-pillar memory records', async () => {
      mockAiriCardStore.cards.set('default', { name: 'ReLU' })

      mockChatIndex.characters = {
        'default': {
          activeSessionId: 'sess-default-blank',
          sessions: {
            'sess-default-blank': { messageCount: 0, updatedAt: 500 },
          },
        },
        'orphan-yuriel': {
          activeSessionId: 'sess-yuriel-main',
          sessions: {
            'sess-yuriel-main': { messageCount: 63, updatedAt: 2000 },
          },
        },
      }

      mockSTMMBlocks.value = [
        { id: 'stmm-yuriel', characterId: 'orphan-yuriel', summary: 'Yuriel summary' },
      ]
      mockLTMMEntries.value = [
        { id: 'ltmm-yuriel', characterId: 'orphan-yuriel', content: 'Yuriel memory' },
      ]
      mockLifetimeMemoryRepo.getByCharacter.mockResolvedValue({
        id: 'lifetime-yuriel',
        characterId: 'orphan-yuriel',
      })
      mockEchoChipsRepo.getAll.mockResolvedValue([
        { id: 'chip-1', characterId: 'orphan-yuriel', content: 'sweet smile' },
      ])

      const { restoreOrphanedGroups } = useDataMaintenance()
      await restoreOrphanedGroups({ 'orphan-yuriel': 'default' })

      expect(mockChatIndex.characters['orphan-yuriel']).toBeUndefined()

      const targetChar = mockChatIndex.characters.default
      expect(targetChar.sessions['sess-yuriel-main']).toBeDefined()
      expect(targetChar.sessions['sess-yuriel-main'].characterId).toBe('default')
      expect(targetChar.activeSessionId).toBe('sess-yuriel-main')

      expect(mockSTMMBlocks.value[0].characterId).toBe('default')
      expect(mockLTMMEntries.value[0].characterId).toBe('default')
      expect(mockLifetimeMemoryRepo.save).toHaveBeenCalledWith('default', 'global', expect.objectContaining({ characterId: 'default' }))
      expect(mockLifetimeMemoryRepo.delete).toHaveBeenCalledWith('orphan-yuriel', 'global')
      expect(mockEchoChipsRepo.saveAll).toHaveBeenCalledWith('local', expect.arrayContaining([
        expect.objectContaining({ characterId: 'default' }),
      ]))
    })
  })

  describe('data Vault Archive & Commit', () => {
    it('exports selected domains as a zip archive and commits extracted data', async () => {
      mockAiriCardStore.cards.set('card-test', { name: 'Test Companion' })
      mockSTMMBlocks.value = [{ id: 'stmm-test', summary: 'Recap' }]

      const { exportDataVaultArchive, commitVaultImport } = useDataMaintenance()

      const zipBlob = await exportDataVaultArchive({
        characters: true,
        memory: true,
      })

      expect(zipBlob).toBeInstanceOf(Blob)
      expect(zipBlob.size).toBeGreaterThan(0)

      // Test committing extracted vault payload
      const mockPayload: any = {
        manifest: { domains: ['characters'] },
        characters: [
          ['new-vault-card', { name: 'From Vault' }],
        ],
      }

      await commitVaultImport(mockPayload)
      expect(mockAiriCardStore.cards.has('new-vault-card')).toBe(true)
      expect(mockAiriCardStore.cards.get('new-vault-card').name).toBe('From Vault')
    })
  })

  describe('orphan Nuking (nukeOrphanedGroups)', () => {
    it('deletes sessions from repository and removes character from index and memory stores', async () => {
      mockChatIndex.characters = {
        'orphan-junk': {
          sessions: {
            'sess-junk-1': { messageCount: 5 },
            'sess-junk-2': { messageCount: 1 },
          },
        },
      }

      mockSTMMBlocks.value = [
        { id: 'stmm-junk', characterId: 'orphan-junk', content: 'Orphan STMM' },
        { id: 'stmm-keep', characterId: 'valid-char', content: 'Keep this' },
      ]
      mockLTMMEntries.value = [
        { id: 'ltmm-junk', characterId: 'orphan-junk', text: 'Orphan LTMM' },
        { id: 'ltmm-keep', characterId: 'valid-char', text: 'Keep this' },
      ]

      const { nukeOrphanedGroups } = useDataMaintenance()
      await nukeOrphanedGroups(['orphan-junk'])

      expect(mockChatSessionsRepo.deleteSession).toHaveBeenCalledWith('sess-junk-1')
      expect(mockChatSessionsRepo.deleteSession).toHaveBeenCalledWith('sess-junk-2')
      expect(mockChatIndex.characters['orphan-junk']).toBeUndefined()

      expect(mockSTMMBlocks.value).toEqual([
        { id: 'stmm-keep', characterId: 'valid-char', content: 'Keep this' },
      ])
      expect(mockLTMMEntries.value).toEqual([
        { id: 'ltmm-keep', characterId: 'valid-char', text: 'Keep this' },
      ])
      expect(mockLifetimeMemoryRepo.delete).toHaveBeenCalledWith('orphan-junk', 'global')
    })
  })

  describe('chat session media scrubbing (scrubAndResolveSessionMedia)', () => {
    it('calculates total byte size across all chat sessions', async () => {
      mockStorage.getKeys.mockResolvedValueOnce(['local:chat/sessions/s1', 'local:chat/sessions/s2'])
      mockChatSessionsRepo.getSession.mockImplementation(async (id: string) => {
        if (id === 's1')
          return { meta: { sessionId: 's1' }, messages: [{ role: 'user', content: 'hello' }] }
        if (id === 's2')
          return { meta: { sessionId: 's2' }, messages: [{ role: 'user', content: 'world' }] }
        return null
      })

      const { calculateChatSessionsByteSize } = useDataMaintenance()
      const totalBytes = await calculateChatSessionsByteSize()
      expect(totalBytes).toBeGreaterThan(0)
    })

    it('extracts leaked tool_results image base64, adds to backgroundStore, and leaves metadata only', async () => {
      const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const sessionWithLeakedToolResult = {
        meta: {
          sessionId: 'sess-media-1',
          characterId: 'char-1',
          universeId: 'u-1',
        },
        messages: [
          {
            role: 'assistant',
            content: 'Here is your painting!',
            tool_results: [
              {
                id: 'call-1',
                result: JSON.stringify({
                  imageUrl: sampleBase64,
                  prompt: 'a tranquil lake at dawn',
                  title: 'Dawn Lake',
                }),
              },
            ],
          },
        ],
      }

      mockStorage.getKeys.mockResolvedValueOnce(['local:chat/sessions/sess-media-1'])
      mockChatSessionsRepo.getSession.mockResolvedValueOnce(sessionWithLeakedToolResult)

      const { scrubAndResolveSessionMedia } = useDataMaintenance()
      const report = await scrubAndResolveSessionMedia()

      expect(report.sessionsScanned).toBe(1)
      expect(report.imagesExtracted).toBe(1)
      expect(report.bytesSaved).toBeGreaterThan(0)
      expect(mockBackgroundStore.addBackground).toHaveBeenCalledWith(
        'journal',
        expect.any(Blob),
        'Dawn Lake',
        'a tranquil lake at dawn',
        'char-1',
        undefined,
        'u-1',
        'sess-media-1',
      )

      expect(mockChatSessionsRepo.saveSession).toHaveBeenCalledTimes(1)
      const savedRecord = mockChatSessionsRepo.saveSession.mock.calls[0][1]
      const savedResult = JSON.parse(savedRecord.messages[0].tool_results[0].result)
      expect(savedResult.imageUrl).toBeUndefined()
      expect(savedResult.entryId).toBe('bg-mock-entry-id')
      expect(savedResult.scrubbed).toBe(true)
    })

    it('extracts inline data:image base64 from content and rawContent and replaces with local:background:<entryId>', async () => {
      const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const sessionWithInlineContent = {
        meta: {
          sessionId: 'sess-media-2',
          characterId: 'char-2',
        },
        messages: [
          {
            role: 'user',
            content: `Look at this photo: ![](${sampleBase64})`,
            rawContent: `Raw prompt with ${sampleBase64}`,
          },
        ],
      }

      mockStorage.getKeys.mockResolvedValueOnce(['local:chat/sessions/sess-media-2'])
      mockChatSessionsRepo.getSession.mockResolvedValueOnce(sessionWithInlineContent)

      const { scrubAndResolveSessionMedia } = useDataMaintenance()
      const report = await scrubAndResolveSessionMedia()

      expect(report.sessionsScanned).toBe(1)
      expect(report.imagesExtracted).toBe(2)
      expect(report.bytesSaved).toBeGreaterThan(0)

      const savedRecord = mockChatSessionsRepo.saveSession.mock.calls[0][1]
      expect(savedRecord.messages[0].content).toBe('Look at this photo: ![](local:background:bg-mock-entry-id)')
      expect(savedRecord.messages[0].rawContent).toBe('Raw prompt with local:background:bg-mock-entry-id')
    })
  })
})
