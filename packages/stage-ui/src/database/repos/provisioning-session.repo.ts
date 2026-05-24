import { storage } from '../storage'

export interface ProvisioningSession {
  characterId: string
  phase: 'idle' | 'aggregating' | 'chunking' | 'synthesizing' | 'distill_pass_1' | 'distill_pass_2' | 'success'
  chunkSummaries: any[]
  baseArchive?: Record<string, any>
  baseContent?: string
  distillPass1Pack?: Record<string, any>
  sourceDocCount: number
  totalChunks: number
  completedChunks: number
  updatedAt: number
  targetTokens?: number
  contextLimitTokens?: number
}

export const provisioningSessionRepo = {
  async get(characterId: string) {
    const key = `local:memory/provisioning-session/${characterId}`
    return await storage.getItemRaw<ProvisioningSession>(key)
  },

  async save(session: ProvisioningSession) {
    const key = `local:memory/provisioning-session/${session.characterId}`
    // Deep clone to strip any Vue/Pinia proxies that cause DataCloneError in IndexedDB
    const cleanSession = JSON.parse(JSON.stringify(session))
    await storage.setItemRaw(key, cleanSession)
  },

  async delete(characterId: string) {
    const key = `local:memory/provisioning-session/${characterId}`
    await storage.removeItem(key)
  },
}
