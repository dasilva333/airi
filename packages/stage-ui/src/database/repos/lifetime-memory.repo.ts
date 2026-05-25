import type { LifetimeMemoryArtifact } from '../../types/lifetime-memory'

import { storage } from '../storage'

export const lifetimeMemoryRepo = {
  async delete(characterId: string) {
    const key = `local:memory/lifetime/${characterId}`
    await storage.removeItem(key)
  },
  async getByCharacter(characterId: string) {
    const key = `local:memory/lifetime/${characterId}`
    return await storage.getItemRaw<LifetimeMemoryArtifact>(key)
  },

  async save(characterId: string, artifact: LifetimeMemoryArtifact) {
    const key = `local:memory/lifetime/${characterId}`
    // Deep clone to strip any Vue/Pinia proxies that cause DataCloneError in IndexedDB
    const cleanArtifact = JSON.parse(JSON.stringify(artifact))
    await storage.setItemRaw(key, cleanArtifact)
  },
}
