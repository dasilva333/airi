import type { CharacterItem } from './animadex-wizard'

import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export interface CustomCharacterEntry {
  id: string
  copyright: string
  name: string
  trigger: string
  tags: string
  createdAt: number
}

export const useCustomCharactersStore = defineStore('custom-characters', () => {
  const customEntries = useLocalStorage<CustomCharacterEntry[]>('airi:animadex:custom-characters', [])

  function addCustomCharacter(entry: Omit<CustomCharacterEntry, 'id' | 'createdAt'>): CustomCharacterEntry {
    const id = `custom:${Date.now()}:${Math.random().toString(36).substring(2, 7)}`
    const newEntry: CustomCharacterEntry = {
      ...entry,
      id,
      createdAt: Date.now(),
    }
    customEntries.value.push(newEntry)
    return newEntry
  }

  function updateCustomCharacter(id: string, updates: Partial<Omit<CustomCharacterEntry, 'id' | 'createdAt'>>) {
    const index = customEntries.value.findIndex(c => c.id === id)
    if (index !== -1) {
      customEntries.value[index] = {
        ...customEntries.value[index],
        ...updates,
      }
    }
  }

  function deleteCustomCharacter(id: string) {
    customEntries.value = customEntries.value.filter(c => c.id !== id)
  }

  function cloneCustomCharacter(id: string): CustomCharacterEntry | null {
    const existing = customEntries.value.find(c => c.id === id)
    if (!existing)
      return null

    return addCustomCharacter({
      copyright: existing.copyright,
      name: `${existing.name} (Copy)`,
      trigger: existing.trigger,
      tags: existing.tags,
    })
  }

  // Adapter to convert custom entries to CharacterItem format
  const asCharacterItems = computed<CharacterItem[]>(() => {
    return customEntries.value.map(c => ({
      id: c.id,
      copyrightIndex: -1, // Sentinel for custom
      copyrightName: c.copyright,
      name: c.name,
      trigger: c.trigger,
      tags: c.tags,
      traits: [0, 0, 0, 0], // Default traits
      isCustom: true,
    } as any))
  })

  return {
    customEntries,
    addCustomCharacter,
    updateCustomCharacter,
    deleteCustomCharacter,
    cloneCustomCharacter,
    asCharacterItems,
  }
})
