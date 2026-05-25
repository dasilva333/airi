import type { DirectorNote } from '../../types/director'

import { storage } from '../storage'

export const directorNotesRepo = {
  async deleteNotes(sessionId: string) {
    const key = `local:director/sessions/${sessionId}`
    await storage.removeItem(key)
  },
  async getNotes(sessionId: string): Promise<DirectorNote[]> {
    const key = `local:director/sessions/${sessionId}`
    const data = await storage.getItemRaw<DirectorNote[]>(key)
    return data || []
  },

  async saveNotes(sessionId: string, notes: DirectorNote[]) {
    const key = `local:director/sessions/${sessionId}`
    const cleanRecord = JSON.parse(JSON.stringify(notes))
    await storage.setItemRaw(key, cleanRecord)
  },
}
