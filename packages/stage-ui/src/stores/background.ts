import localforage from 'localforage'

import { debug } from '@proj-airi/stage-shared'
import { useBroadcastChannel } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'

import cozyTeaCornerInPastelHuesUrl from '../assets/backgrounds/cozy-tea-corner-in-pastel-hues.avif'
import cuteStreamingRoomWithPastelDecorUrl from '../assets/backgrounds/cute-streaming-room-with-pastel-decor.avif'

import { useChatSessionStore } from './chat/session-store'
import { useEventLogStore } from './event-log'
import { useAiriCardStore } from './modules/airi-card'

export interface BackgroundEntry {
  id: string
  type: 'builtin' | 'scene' | 'journal' | 'selfie'
  characterId: string | null // null for shared
  title: string
  blob: Blob
  url?: string
  prompt?: string // only for journal
  remixId?: string // only for ComfyUI journal entries
  createdAt: number
  universeId?: string
  sessionId?: string
  metadata?: any
}

const BUILTIN_BACKGROUNDS = [
  {
    id: 'builtin:cozy-tea-corner',
    url: cozyTeaCornerInPastelHuesUrl,
    title: 'Cozy tea corner in pastel hues',
  },
  {
    id: 'builtin:cute-streaming-room',
    url: cuteStreamingRoomWithPastelDecorUrl,
    title: 'Cute streaming room with pastel decor',
  },
]

export const useBackgroundStore = defineStore('background', () => {
  const STORAGE_PREFIX = 'bg-'

  const entries = ref<Map<string, BackgroundEntry>>(new Map())
  const loading = ref(true)

  // Track object URLs to prevent leaks
  const blobRefs = new Map<string, any>()
  const backgroundUrls = reactive<Record<string, string | null>>({})

  function ensureObjectUrl(id: string, blob: Blob) {
    if (backgroundUrls[id])
      return backgroundUrls[id]

    try {
      const url = URL.createObjectURL(blob)
      backgroundUrls[id] = url
      // debug(`[BackgroundStore] Created ObjectURL for ${id}`)
      return url
    }
    catch (e) {
      console.error(`[BackgroundStore] Failed to create ObjectURL for ${id}`, e)
      return null
    }
  }

  onScopeDispose(() => {
    Object.values(backgroundUrls).forEach((url) => {
      if (url)
        URL.revokeObjectURL(url)
    })
    for (const key in backgroundUrls) {
      delete backgroundUrls[key]
    }
  })

  // Helper to fetch an asset as a blob
  async function fetchAssetAsBlob(url: string): Promise<Blob> {
    const res = await fetch(url)
    return await res.blob()
  }

  async function initializeStore() {
    if (loading.value && entries.value.size > 0)
      return // Already initializing

    debug('[BackgroundStore] Initializing store...')
    loading.value = true
    try {
      const loadedEntries = new Map<string, BackgroundEntry>()

      // 1. Read existing backgrounds from IndexedDB
      const keys = await localforage.keys()
      const bgKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX) || key.startsWith('builtin:'))
      for (const key of bgKeys) {
        const val = await localforage.getItem<BackgroundEntry>(key)
        if (val) {
          const entry = { ...val, id: key }
          if (entry.blob instanceof Blob) {
            ensureObjectUrl(key, entry.blob)
          }
          loadedEntries.set(key, entry)
        }
      }

      // 2. Migration: check for legacy image-journal entries
      const legacyPrefix = 'image-journal-'
      const legacyEntriesToMigrate: BackgroundEntry[] = []
      const legacyKeysToDelete: string[] = []

      await localforage.iterate<any, void>((val, key) => {
        if (key.startsWith(legacyPrefix)) {
          legacyKeysToDelete.push(key)
          const newId = key.replace(legacyPrefix, STORAGE_PREFIX)

          if (!loadedEntries.has(newId)) {
            const migrated: BackgroundEntry = {
              id: newId,
              type: 'journal',
              characterId: val.characterId,
              title: val.title || 'Migrated Journal Image',
              blob: val.blob,
              prompt: val.prompt,
              createdAt: val.createdAt || Date.now(),
              universeId: val.universeId,
              sessionId: val.sessionId,
            }
            if (migrated.blob instanceof Blob) {
              ensureObjectUrl(newId, migrated.blob)
            }
            legacyEntriesToMigrate.push(migrated)
            loadedEntries.set(newId, migrated)
          }
        }
      })

      for (const entry of legacyEntriesToMigrate) {
        await localforage.setItem(entry.id, entry)
      }
      for (const key of legacyKeysToDelete) {
        await localforage.removeItem(key)
      }

      // 3. Seeding logic for defaults
      const hasAnyScenesOrBuiltins = Array.from(loadedEntries.values()).some((e) => {
        return e.type === 'scene' || e.type === 'builtin'
      })
      if (!hasAnyScenesOrBuiltins) {
        for (const builtin of BUILTIN_BACKGROUNDS) {
          try {
            const blob = await fetchAssetAsBlob(builtin.url)
            const entry: BackgroundEntry = {
              id: builtin.id,
              type: 'builtin',
              characterId: null,
              title: builtin.title,
              blob,
              createdAt: Date.now(),
              universeId: 'global',
            }
            ensureObjectUrl(entry.id, blob)
            await localforage.setItem(entry.id, entry)
            loadedEntries.set(entry.id, entry)
          }
          catch (e) {
            console.error('[BackgroundStore] Failed to seed builtin:', builtin.id, e)
          }
        }
      }

      entries.value = loadedEntries

      // Reconciliation: Purge ObjectURLs for entries that were deleted in other windows
      for (const id in backgroundUrls) {
        if (!loadedEntries.has(id)) {
          const url = backgroundUrls[id]
          if (url)
            URL.revokeObjectURL(url)
          delete backgroundUrls[id]
          blobRefs.delete(id)
        }
      }

      debug(`[BackgroundStore] Store initialized with ${loadedEntries.size} entries.`)
    }
    catch (error) {
      console.error('[BackgroundStore] Initialization failed:', error)
    }
    finally {
      loading.value = false
    }
  }

  // Cross-window synchronization
  const { data: syncSignal, post: broadcastSync } = useBroadcastChannel({ name: 'airi:background-sync' })

  watch(syncSignal, (val) => {
    debug(`[BackgroundStore] Received sync signal (${val}), re-initializing...`)
    initializeStore()
  })

  async function sync() {
    const timestamp = Date.now()
    debug(`[BackgroundStore] Sending sync signal: ${timestamp}`)
    broadcastSync(timestamp)
  }

  // Auto-init once
  initializeStore()

  // Find the active background URL for the current character
  const activeBackgroundUrl = computed(() => {
    const airiCardStore = useAiriCardStore()
    if (!airiCardStore.activeCard)
      return null
    const bgId = airiCardStore.activeCard.extensions?.airi?.modules?.activeBackgroundId
    if (!bgId || bgId === 'none') {
      debug('[BackgroundStore] activeBackgroundUrl: No ID or "none"')
      return null
    }

    // Normalize prefix just in case they stored 'image-journal-xyz'
    let lookupId = bgId
    if (bgId.startsWith('image-journal-')) {
      lookupId = bgId.replace('image-journal-', STORAGE_PREFIX)
    }

    // Return the reactive URL from our map if it exists
    const url = backgroundUrls[lookupId] ?? null

    // If we have the URL but not the entry in the map yet, it's likely still initializing.
    // We return the URL anyway to avoid blank backgrounds during sync.
    if (url) {
      debug(`[BackgroundStore] activeBackgroundUrl resolved for "${lookupId}" (from URL map)`)
      return url
    }

    const entry = entries.value.get(lookupId)
    if (!entry) {
      debug(`[BackgroundStore] activeBackgroundUrl: No entry or URL found for ID "${lookupId}"`)
      return null
    }

    return null // Should have been caught by backgroundUrls check above if entry is valid
  })

  // List of available backgrounds for the current character
  const availableBackgrounds = computed(() => {
    const airiCardStore = useAiriCardStore()
    return getCharacterBackgrounds.value(airiCardStore.activeCardId)
  })

  const getCharacterBackgrounds = computed(() => (characterId?: string) => {
    const chatSessionStore = useChatSessionStore()
    const airiCardStore = useAiriCardStore()
    const targetCharacterId = characterId || airiCardStore.activeCardId
    const activeSessionId = targetCharacterId
      ? (chatSessionStore.getCharacterIndex(targetCharacterId)?.activeSessionId || chatSessionStore.activeSessionId)
      : chatSessionStore.activeSessionId
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
    const currentUniverseId = activeSessionMeta?.universeId || 'global'

    const list = Array.from(entries.value.values()).filter((e) => {
      const entryUniverse = e.universeId || 'global'
      const isShared = e.type === 'scene' || e.type === 'builtin'
      const isCharMatch = characterId && e.characterId === characterId
      const isUniverseMatch = entryUniverse === currentUniverseId
      return isShared || (isCharMatch && isUniverseMatch)
    })
    return list.map(e => ({
      ...e,
      url: backgroundUrls[e.id] ?? null,
    })).sort((a, b) => b.createdAt - a.createdAt)
  })

  // The 'journal' store functionality needs to access just the journal entries for the active char
  const journalEntries = computed(() => {
    const airiCardStore = useAiriCardStore()
    return getCharacterJournalEntries.value(airiCardStore.activeCardId)
  })

  const getCharacterJournalEntries = computed(() => (characterId?: string) => {
    const chatSessionStore = useChatSessionStore()
    const airiCardStore = useAiriCardStore()
    const targetCharacterId = characterId || airiCardStore.activeCardId
    const activeSessionId = targetCharacterId
      ? (chatSessionStore.getCharacterIndex(targetCharacterId)?.activeSessionId || chatSessionStore.activeSessionId)
      : chatSessionStore.activeSessionId
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
    const currentUniverseId = activeSessionMeta?.universeId || 'global'

    return Array.from(entries.value.values()).filter((e) => {
      const entryUniverse = e.universeId || 'global'
      const isCharMatch = characterId && e.characterId === characterId
      const isUniverseMatch = entryUniverse === currentUniverseId
      return (e.type === 'journal' || e.type === 'selfie') && isCharMatch && isUniverseMatch
    }).map(e => ({
      ...e,
      url: backgroundUrls[e.id] ?? null,
    })).sort((a, b) => b.createdAt - a.createdAt)
  })

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const onBackgroundAddedHooks: Array<(entry: BackgroundEntry) => void | Promise<void>> = []

  function onBackgroundAdded(cb: (entry: BackgroundEntry) => void | Promise<void>) {
    onBackgroundAddedHooks.push(cb)
    return () => {
      const index = onBackgroundAddedHooks.indexOf(cb)
      if (index >= 0)
        onBackgroundAddedHooks.splice(index, 1)
    }
  }

  async function addBackground(
    type: 'scene' | 'journal' | 'selfie',
    blob: Blob,
    title: string,
    prompt?: string,
    characterId?: string | null,
    remixId?: string,
    universeId?: string,
    sessionId?: string,
    metadata?: any,
  ) {
    const airiCardStore = useAiriCardStore()
    const chatSessionStore = useChatSessionStore()
    const id = `${STORAGE_PREFIX}${nanoid()}`

    // Default to active card if journal and no charId provided
    const resolvedCharacterId = characterId !== undefined
      ? characterId
      : ((type === 'journal' || type === 'selfie') ? airiCardStore.activeCardId : null)

    const activeSessionId = sessionId !== undefined
      ? sessionId
      : (resolvedCharacterId
          ? (chatSessionStore.getCharacterIndex(resolvedCharacterId)?.activeSessionId || chatSessionStore.activeSessionId)
          : chatSessionStore.activeSessionId)
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)

    const resolvedUniverseId = universeId !== undefined ? universeId : (activeSessionMeta?.universeId || 'global')
    const resolvedSessionId = sessionId !== undefined ? sessionId : activeSessionId

    const entry: BackgroundEntry = {
      id,
      type,
      characterId: resolvedCharacterId,
      title: title.trim() || 'Untitled Background',
      blob,
      prompt,
      remixId,
      createdAt: Date.now(),
      universeId: resolvedUniverseId,
      sessionId: resolvedSessionId,
    }

    try {
      // Clear deletion metadata if any exists
      try {
        const { storage } = await import('../database/storage')
        await storage.removeItem(`local:sync-metadata/deleted-backgrounds/${id}`)
      }
      catch (e) {}

      await localforage.setItem(id, entry)
      ensureObjectUrl(id, blob)

      const nextEntries = new Map(entries.value)
      nextEntries.set(id, entry)
      entries.value = nextEntries

      initializeStore()
      await sync()

      // Emit hook for other stores (like Discord) to react
      const entryWithMetadata = { ...entry, metadata }
      for (const hook of onBackgroundAddedHooks) {
        void hook(entryWithMetadata)
      }

      // Emit event to Event Ledger if this is a journal entry
      if (type === 'journal') {
        try {
          const eventLogStore = useEventLogStore()
          const charName = airiCardStore.activeCard?.name || 'AIRI'
          void eventLogStore.appendEvent({
            category: 'memory',
            type: 'image_journal',
            source: charName,
            textSummary: `Generated image journal artwork: "${entry.title}"`,
            payload: {
              id: entry.id,
              title: entry.title,
              type: entry.type,
              characterId: entry.characterId,
            },
            inspectable: true,
          })
        }
        catch (e) {
          console.warn('[BackgroundStore] Failed to emit event to Event Ledger:', e)
        }
      }

      debug(`[BackgroundStore] Successfully added background: ${id} (${type})`)
      return id
    }
    catch (error) {
      console.error('[BackgroundStore] Failed to save entry:', error)
      throw error
    }
  }

  async function removeBackground(id: string) {
    try {
      await localforage.removeItem(id)

      // Save deletion to sync metadata so the sync engine can propagate it
      try {
        const { storage } = await import('../database/storage')
        await storage.setItemRaw(`local:sync-metadata/deleted-backgrounds/${id}`, Date.now())
      }
      catch (e) {
        console.error('[BackgroundStore] Failed to write deletion metadata:', e)
      }

      const nextEntries = new Map(entries.value)
      nextEntries.delete(id)
      entries.value = nextEntries

      const url = backgroundUrls[id]
      if (url)
        URL.revokeObjectURL(url)

      const blobRef = blobRefs.get(id)
      if (blobRef)
        blobRef.value = undefined
      blobRefs.delete(id)
      delete backgroundUrls[id]
      broadcastSync(Date.now())
    }
    catch (error) {
      console.error('[BackgroundStore] Failed to remove entry:', error)
      throw error
    }
  }

  return {
    entries,
    loading,
    availableBackgrounds,
    getCharacterBackgrounds,
    journalEntries,
    getCharacterJournalEntries,
    activeBackgroundUrl,
    addBackground,
    removeBackground,
    onBackgroundAdded,
    getBackgroundUrl: (id: string) => backgroundUrls[id] ?? null,
    initializeStore,
  }
})
