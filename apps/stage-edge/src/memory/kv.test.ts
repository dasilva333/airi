import type { ConversationTurn } from './kv'

import { describe, expect, it } from 'vitest'

import { KvMemoryStore } from './kv'

function createMockKv(): { kv: any, storage: Map<string, string> } {
  const storage = new Map<string, string>()

  const kv = {
    async put(key: string, value: string): Promise<void> {
      storage.set(key, value)
    },
    async get(key: string): Promise<string | null> {
      return storage.get(key) || null
    },
    async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
      const prefix = options?.prefix || ''
      const keys = Array.from(storage.keys())
        .filter(k => k.startsWith(prefix))
        .sort() // lexicographical ordering matching turn timestamp prefix
        .map(name => ({ name }))
      return { keys }
    },
  }

  return { kv, storage }
}

describe('apps/stage-edge kv memory store', () => {
  it('saves turn with formatted key structure', async () => {
    const { kv, storage } = createMockKv()
    const store = new KvMemoryStore(kv)

    const turn: ConversationTurn = {
      turnId: 'turn_001',
      userId: 'user_alice',
      role: 'user',
      content: 'Hello AIRI!',
      timestamp: 1725800100,
    }

    await store.saveTurn('user_alice', turn)

    const expectedKey = 'history_user_alice_turn_1725800100_turn_001'
    expect(storage.has(expectedKey)).toBe(true)
    const stored = JSON.parse(storage.get(expectedKey)!)
    expect(stored).toEqual(turn)
  })

  it('truncates turns to fixed window size in default fixed mode', async () => {
    const { kv } = createMockKv()
    const store = new KvMemoryStore(kv)

    // Populate 15 sequential turns
    for (let i = 1; i <= 15; i++) {
      const turn: ConversationTurn = {
        turnId: `turn_${i.toString().padStart(3, '0')}`,
        userId: 'user_bob',
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: 1725800000 + i * 10,
      }
      await store.saveTurn('user_bob', turn)
    }

    // Default fixed mode (maxTurns = 10)
    const recentDefault = await store.getRecentTurns('user_bob')
    expect(recentDefault.length).toBe(10)
    expect(recentDefault[0].content).toBe('Message 6')
    expect(recentDefault[9].content).toBe('Message 15')

    // Custom maxTurns = 5
    const recentFive = await store.getRecentTurns('user_bob', { mode: 'fixed', maxTurns: 5 })
    expect(recentFive.length).toBe(5)
    expect(recentFive[0].content).toBe('Message 11')
    expect(recentFive[4].content).toBe('Message 15')
  })

  it('retrieves all turns without truncation in unlimited mode', async () => {
    const { kv } = createMockKv()
    const store = new KvMemoryStore(kv)

    // Populate 18 turns
    for (let i = 1; i <= 18; i++) {
      const turn: ConversationTurn = {
        turnId: `turn_${i.toString().padStart(3, '0')}`,
        userId: 'user_charlie',
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: 1725800000 + i * 10,
      }
      await store.saveTurn('user_charlie', turn)
    }

    const allTurns = await store.getRecentTurns('user_charlie', { mode: 'unlimited' })
    expect(allTurns.length).toBe(18)
    expect(allTurns[0].content).toBe('Message 1')
    expect(allTurns[17].content).toBe('Message 18')
  })

  it('returns empty array when user has no stored turns', async () => {
    const { kv } = createMockKv()
    const store = new KvMemoryStore(kv)

    const turns = await store.getRecentTurns('unknown_user')
    expect(turns).toEqual([])
  })
})
