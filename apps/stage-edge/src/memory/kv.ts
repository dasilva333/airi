/**
 * Transactional Cloudflare KV memory adapter for Edge Relay.
 * Supports configurable rolling memory windows:
 * - 'fixed' (default limit e.g. 10 or 20 turns) for concise assistant turns.
 * - 'unlimited' (0 = fetch full conversation context) for deep character coherence.
 */

export interface ConversationTurn {
  turnId: string
  userId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface MemoryWindowConfig {
  mode: 'fixed' | 'unlimited'
  maxTurns?: number // e.g. 10, 20, 50 (ignored if mode === 'unlimited')
}

export class KvMemoryStore {
  private kv: KVNamespace

  constructor(kv: KVNamespace) {
    this.kv = kv
  }

  public async saveTurn(userId: string, turn: ConversationTurn): Promise<void> {
    const turnKey = `history_${userId}_turn_${turn.timestamp}_${turn.turnId}`
    await this.kv.put(turnKey, JSON.stringify(turn))
  }

  public async getRecentTurns(
    userId: string,
    config: MemoryWindowConfig = { mode: 'fixed', maxTurns: 10 },
  ): Promise<ConversationTurn[]> {
    const list = await this.kv.list({ prefix: `history_${userId}_turn_` })
    const turns: ConversationTurn[] = []

    const keysToFetch = config.mode === 'unlimited'
      ? list.keys
      : list.keys.slice(-(config.maxTurns || 10))

    for (const key of keysToFetch) {
      const raw = await this.kv.get(key.name)
      if (raw) {
        turns.push(JSON.parse(raw))
      }
    }
    return turns
  }
}
