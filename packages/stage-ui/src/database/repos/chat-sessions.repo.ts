import type { ChatSessionRecord, ChatSessionsIndex } from '../../types/chat-session'

import { storage } from '../storage'

export const chatSessionsRepo = {
  // Cleanup
  async deleteSession(sessionId: string) {
    try {
      await storage.removeItem(`local:chat/sessions/${sessionId}`)
    } catch (err) {
      console.error(`[ChatSessionsRepo] Failed to delete session ${sessionId}:`, err)
      throw err
    }
  },
  async getIndex(userId: string) {
    const key = `local:chat/index/${userId}`
    try {
      return await storage.getItemRaw<ChatSessionsIndex>(key)
    } catch (err) {
      console.error(`[ChatSessionsRepo] Failed to get index for ${userId}:`, err)
      return null
    }
  },

  async getSession(sessionId: string) {
    const key = `local:chat/sessions/${sessionId}`
    try {
      return await storage.getItemRaw<ChatSessionRecord>(key)
    } catch (err) {
      console.error(`[ChatSessionsRepo] Failed to get session ${sessionId}:`, err)
      return null
    }
  },

  async saveIndex(index: ChatSessionsIndex) {
    const key = `local:chat/index/${index.userId}`
    try {
      const cleanIndex = JSON.parse(JSON.stringify(index))
      await storage.setItemRaw(key, cleanIndex)
    } catch (err) {
      console.error(`[ChatSessionsRepo] Failed to save index for ${index.userId}:`, err)
      throw err
    }
  },

  async saveSession(sessionId: string, record: ChatSessionRecord) {
    const key = `local:chat/sessions/${sessionId}`
    try {
      const cleanRecord = JSON.parse(JSON.stringify(record))
      await storage.setItemRaw(key, cleanRecord)
    } catch (err) {
      console.error(`[ChatSessionsRepo] Failed to save session ${sessionId}:`, err)
      throw err
    }
  },
}
