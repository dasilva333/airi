import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { storage } from '../../database/storage'
import { useAuthStore } from '../auth'
import { useAiriCardStore } from '../modules/airi-card'
import { useSettingsGeneral } from '../settings'
import { useChatSessionStore } from './session-store'

const mockSyncPost = vi.fn().mockResolvedValue({ ok: true })

vi.mock('../../composables/api', () => ({
  client: {
    api: {
      chats: {
        sync: {
          $post: (args: any) => mockSyncPost(args),
        },
      },
    },
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@proj-airi/stage-ui-live2d', () => ({
  useLive2d: () => ({
    activeExpressions: null,
  }),
}))

vi.mock('@proj-airi/stage-ui-three', () => ({
  useModelStore: () => ({
    activeExpressions: null,
  }),
}))

vi.mock('@proj-airi/stage-ui-spine', () => ({
  useSpine: () => ({}),
}))

// ROOT CAUSE:
//
// In previous alpha builds, syncSessionToRemote had a defensive guard:
//   if (cachedRecord.meta.characterId && cachedRecord.meta.characterId !== 'default')
// Because the starter companion was previously seeded under id 'default', this check
// silently stripped the companion member from the remote sync payload.
//
// FIXED BY:
// Eradicating the 'default' check completely. Any valid characterId (including 'relu')
// is preserved in the sync members payload sent to client.api.chats.sync.$post.

describe('useChatSessionStore - Remote Sync & Companion Member Invariants', () => {
  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())
    mockSyncPost.mockClear()

    const keys = await storage.getKeys()
    for (const key of keys) {
      await storage.removeItem(key)
    }

    const settingsStore = useSettingsGeneral()
    settingsStore.remoteSyncEnabled = true

    const authStore = useAuthStore()
    authStore.user = { id: 'test-user-42', name: 'Test User' } as any
    authStore.session = { id: 'session-token-123' } as any

    const cardStore = useAiriCardStore()
    cardStore.activeCardId = 'relu'
  })

  it('includes companion member in remote sync payload for relu character sessions', async () => {
    const sessionStore = useChatSessionStore()

    // Create session explicitly for 'relu'
    await sessionStore.createSession('relu', {
      title: 'Testing ReLU Session Sync',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello ReLU!',
          createdAt: Date.now(),
        },
      ],
    })

    // Allow queue microtasks to settle
    await vi.waitFor(() => {
      expect(mockSyncPost).toHaveBeenCalled()
    }, { timeout: 2000 })

    const lastCall = mockSyncPost.mock.calls[0][0]
    expect(lastCall).toBeDefined()
    expect(lastCall.json).toBeDefined()

    const members = lastCall.json.members
    expect(members).toBeDefined()

    // Invariant: User member is present
    const userMember = members.find((m: any) => m.type === 'user')
    expect(userMember).toBeDefined()
    expect(userMember?.userId).toBe('test-user-42')

    // Invariant: Character member for 'relu' MUST NOT be stripped
    const characterMember = members.find((m: any) => m.type === 'character')
    expect(characterMember).toBeDefined()
    expect(characterMember?.characterId).toBe('relu')
  })

  it('defaults to relu when creating sessions through ensureActiveSessionForCharacter', async () => {
    const sessionStore = useChatSessionStore()
    await sessionStore.ensureActiveSessionForCharacter()

    expect(sessionStore.activeSessionId).toBeDefined()
    expect(sessionStore.activeSessionId).not.toBe('')

    const activeMeta = sessionStore.getSessionMeta(sessionStore.activeSessionId)
    expect(activeMeta).toBeDefined()
    expect(activeMeta?.characterId).toBe('relu')
  })
})
