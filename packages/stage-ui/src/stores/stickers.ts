import { useLocalStorage } from '@vueuse/core'
import localforage from 'localforage'
import { nanoid } from 'nanoid'
import * as Pinia from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { useAiriCardStore } from './modules/airi-card'

export interface StickerMetadata {
  id: string
  label: string
  addedAt: number
  originalName: string
  mimeType: string
  characterId?: string
}

export interface StickerPlacement {
  instanceId: string
  stickerId: string
  x: number
  y: number
  rotation: number
  scale: number
  createdAt: number
  expiresAt?: number
}

export const useStickersStore = Pinia.defineStore('stickers', () => {
  // Persisted metadata list
  const libraryMetadata = useLocalStorage<StickerMetadata[]>('stickers/library-v2', [])

  /**
   * The library subset belonging to the currently active character
   */
  const currentLibrary = computed(() => {
    const airiCardStore = useAiriCardStore()
    return libraryMetadata.value.filter((s) => s.characterId === airiCardStore.activeCardId)
  })

  // Reactive state for active instances on screen
  const activePlacements = ref<StickerPlacement[]>([])

  // UI toggle for spawning standalone widgets (for Desktop support)
  const standaloneMode = useLocalStorage<boolean>('stickers/standalone-mode', false)

  // Cache for object URLs to avoid recreating them constantly
  const objectUrlCache = new Map<string, string>()

  // Pruning interval for expired stickers
  if (typeof window !== 'undefined') {
    setInterval(() => {
      const now = Date.now()
      activePlacements.value = activePlacements.value.filter((p) => !p.expiresAt || p.expiresAt > now)
    }, 1000)
  }

  /**
   * Get target sticker image as as Object URL
   */
  async function getStickerUrl(id: string): Promise<string | undefined> {
    if (objectUrlCache.has(id)) {
      return objectUrlCache.get(id)
    }

    try {
      const blob = await localforage.getItem<Blob>(`sticker-data-${id}`)
      if (blob) {
        const url = URL.createObjectURL(blob)
        objectUrlCache.set(id, url)
        return url
      }
    } catch (err) {
      console.error(`[StickersStore] Failed to fetch sticker ${id}:`, err)
    }
    return undefined
  }

  /**
   * Upload and register a new sticker
   */
  async function addSticker(file: File, label?: string, characterId?: string) {
    const airiCardStore = useAiriCardStore()
    const id = nanoid()
    const metadata: StickerMetadata = {
      addedAt: Date.now(),
      characterId: characterId || airiCardStore.activeCardId,
      id,
      label: label || file.name.replace(/\.[^/.]+$/, ''), // remove extension
      mimeType: file.type,
      originalName: file.name,
    }

    try {
      // Store blob in IndexedDB
      await localforage.setItem(`sticker-data-${id}`, file)

      // Update metadata list
      libraryMetadata.value.push(metadata)

      return id
    } catch (err) {
      console.error('[StickersStore] Failed to save sticker:', err)
      throw err
    }
  }

  /**
   * Remote a sticker from the library
   */
  async function deleteSticker(id: string) {
    try {
      await localforage.removeItem(`sticker-data-${id}`)

      // Revoke and clear cache
      if (objectUrlCache.has(id)) {
        URL.revokeObjectURL(objectUrlCache.get(id)!)
        objectUrlCache.delete(id)
      }

      // Update metadata
      libraryMetadata.value = libraryMetadata.value.filter((m) => m.id !== id)

      // Clean up active placements
      activePlacements.value = activePlacements.value.filter((p) => p.stickerId !== id)
    } catch (err) {
      console.error(`[StickersStore] Failed to delete sticker ${id}:`, err)
    }
  }

  /**
   * Spawn a sticker instance at coordinates (or center)
   */
  function spawnSticker(idOrLabel: string, options: { x?: number; y?: number; duration?: number } = {}) {
    const sticker = currentLibrary.value.find((m) => m.id === idOrLabel || m.label === idOrLabel)
    if (!sticker) {
      const errorMsg = `Sticker label "${idOrLabel}" not found in your library. Available labels: ${currentLibrary.value.map((s) => s.label).join(', ')}`
      console.warn(`[StickersStore] ${errorMsg}`)
      return errorMsg
    }

    // "randomly creeked by like 3 to 8 degrees"
    const direction = Math.random() > 0.5 ? 1 : -1
    const rotation = (3 + Math.random() * 5) * direction

    // Wild positioning: use window dimensions or default to safe center if size unknown.
    // We target 10% to 90% of the viewport to ensure they are at least partially visible.
    const width = typeof window !== 'undefined' ? window.innerWidth : 1000
    const height = typeof window !== 'undefined' ? window.innerHeight : 1000

    const finalX = options.x !== undefined ? options.x : width * (0.1 + Math.random() * 0.8)
    const finalY = options.y !== undefined ? options.y : height * (0.1 + Math.random() * 0.8)

    const createdAt = Date.now()
    const placement: StickerPlacement = {
      createdAt,
      expiresAt: options.duration ? createdAt + options.duration * 1000 : undefined,
      instanceId: nanoid(),
      rotation,
      scale: 1,
      stickerId: sticker.id,
      x: finalX,
      y: finalY,
    }

    activePlacements.value.push(placement)
    return placement
  }

  /**
   * Remove a specific placement instance
   */
  function removePlacement(instanceId: string) {
    activePlacements.value = activePlacements.value.filter((p) => p.instanceId !== instanceId)
  }

  /**
   * Update placement position
   */
  function updatePlacement(instanceId: string, updates: Partial<StickerPlacement>) {
    const p = activePlacements.value.find((i) => i.instanceId === instanceId)
    if (p) {
      Object.assign(p, updates)
    }
  }

  /**
   * Clear all active stickers from the screen
   */
  function clearPlacements() {
    activePlacements.value = []
  }

  /**
   * Delete every sticker in the current character's library
   */
  async function clearLibrary() {
    const toRemove = [...currentLibrary.value].map((s) => s.id)
    for (const id of toRemove) {
      await deleteSticker(id)
    }
  }

  // --- Internals ---

  // Automatic cleanup of expired stickers
  let cleanupInterval: ReturnType<typeof setInterval> | undefined

  onMounted(() => {
    cleanupInterval = setInterval(() => {
      const now = Date.now()
      const initialCount = activePlacements.value.length
      activePlacements.value = activePlacements.value.filter((p) => !p.expiresAt || p.expiresAt > now)

      if (import.meta.env.DEV && activePlacements.value.length !== initialCount) {
        console.log(`[StickersStore] Purged ${initialCount - activePlacements.value.length} expired stickers.`)
      }
    }, 2000) // Check every 2 seconds for snappy removal
  })

  onUnmounted(() => {
    if (cleanupInterval) clearInterval(cleanupInterval)
  })

  return {
    activePlacements,
    addSticker,
    clearLibrary,
    clearPlacements,
    currentLibrary,
    deleteSticker,
    getStickerUrl,
    libraryMetadata,
    removePlacement,
    spawnSticker,
    standaloneMode,
    updatePlacement,
  }
})
