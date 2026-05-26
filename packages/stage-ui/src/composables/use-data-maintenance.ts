import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { useBackgroundStore } from '../stores/background'
import { useChatOrchestratorStore } from '../stores/chat'
import { useChatSessionStore } from '../stores/chat/session-store'
import { useDisplayModelsStore } from '../stores/display-models'
import { useMcpStore } from '../stores/mcp'
import { useShortTermMemoryStore } from '../stores/memory-short-term'
import { useTextJournalStore } from '../stores/memory-text-journal'
import { useAiriCardStore } from '../stores/modules/airi-card'
import { useConsciousnessStore } from '../stores/modules/consciousness'
import { useDiscordStore } from '../stores/modules/discord'
import { useFactorioStore } from '../stores/modules/gaming-factorio'
import { useMinecraftStore } from '../stores/modules/gaming-minecraft'
import { useHearingStore } from '../stores/modules/hearing'
import { useSpeechStore } from '../stores/modules/speech'
import { useTwitterStore } from '../stores/modules/twitter'
import { useOnboardingStore } from '../stores/onboarding'
import { useProvidersStore } from '../stores/providers'
import { useSettings, useSettingsAudioDevice } from '../stores/settings'
import type { ChatSessionsExport } from '../types/chat-session'

export function useDataMaintenance() {
  const chatStore = useChatSessionStore()
  const chatOrchestrator = useChatOrchestratorStore()
  const displayModelsStore = useDisplayModelsStore()
  const providersStore = useProvidersStore()
  const settingsStore = useSettings()
  const audioSettingsStore = useSettingsAudioDevice()
  const live2dStore = useLive2d()
  const hearingStore = useHearingStore()
  const speechStore = useSpeechStore()
  const consciousnessStore = useConsciousnessStore()
  const twitterStore = useTwitterStore()
  const discordStore = useDiscordStore()
  const factorioStore = useFactorioStore()
  const minecraftStore = useMinecraftStore()
  const mcpStore = useMcpStore()
  const onboardingStore = useOnboardingStore()
  const airiCardStore = useAiriCardStore()
  const shortTermMemoryStore = useShortTermMemoryStore()
  const textJournalStore = useTextJournalStore()
  const backgroundStore = useBackgroundStore()

  async function deleteAllModels() {
    await displayModelsStore.resetDisplayModels()
    settingsStore.stageModelSelected = 'preset-live2d-1'
    await settingsStore.updateStageModel()
  }

  async function resetProvidersSettings() {
    await providersStore.resetProviderSettings()
  }

  function resetModulesSettings() {
    hearingStore.resetState()
    speechStore.resetState()
    consciousnessStore.resetState()
    twitterStore.resetState()
    discordStore.resetState()
    factorioStore.resetState()
    minecraftStore.resetState()
  }

  function deleteAllChatSessions() {
    chatOrchestrator.cancelPendingSends()
    chatStore.resetAllSessions()
  }

  async function exportChatSessions() {
    const data = await chatStore.exportSessions()
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  }

  function isChatSessionsPayload(payload: unknown): payload is ChatSessionsExport {
    if (!payload || typeof payload !== 'object') return false
    return (payload as { format?: string }).format === 'chat-sessions-index:v1'
  }

  async function importChatSessions(payload: Record<string, unknown>) {
    if (!isChatSessionsPayload(payload)) throw new Error('Invalid chat session export format')
    await chatStore.importSessions(payload)
  }

  // --- Characters ---

  async function exportAllCharacters() {
    const cards = Array.from(airiCardStore.cards.entries())
    const data = {
      cards,
      format: 'airi-characters:v1',
      timestamp: Date.now(),
    }
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  }

  async function importAllCharacters(payload: any) {
    if (payload.format !== 'airi-characters:v1' || !Array.isArray(payload.cards))
      throw new Error('Invalid characters export format')

    for (const [id, card] of payload.cards) {
      // Simple merge: skip if already exists to prevent overwriting user-modified cards
      if (!airiCardStore.cards.has(id)) {
        airiCardStore.cards.set(id, card)
      }
    }
    // Trigger persistence if the store has a persist method or just relies on reactivity
    // useLocalStorageManualReset should handle the save if we are mutating the map reference properly
    // or if we call a save method if it exists. Based on airi-card.ts, it's reactive.
  }

  // --- Memory ---

  async function exportMemory() {
    await Promise.all([shortTermMemoryStore.load(), textJournalStore.load()])
    const data = {
      format: 'airi-memory:v1',
      journalEntries: textJournalStore.entries,
      shortTermBlocks: shortTermMemoryStore.blocks,
      timestamp: Date.now(),
    }
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  }

  async function importMemory(payload: any) {
    if (payload.format !== 'airi-memory:v1') throw new Error('Invalid memory export format')

    if (Array.isArray(payload.shortTermBlocks)) {
      await shortTermMemoryStore.load()
      const existingIds = new Set(shortTermMemoryStore.blocks.map((b) => b.id))
      const newBlocks = payload.shortTermBlocks.filter((b: any) => !existingIds.has(b.id))
      if (newBlocks.length > 0) {
        const merged = [...shortTermMemoryStore.blocks, ...newBlocks]
        await shortTermMemoryStore.persist(merged)
      }
    }

    if (Array.isArray(payload.journalEntries)) {
      await textJournalStore.load()
      const existingIds = new Set(textJournalStore.entries.map((e) => e.id))
      const newEntries = payload.journalEntries.filter((e: any) => !existingIds.has(e.id))
      if (newEntries.length > 0) {
        const merged = [...textJournalStore.entries, ...newEntries]
        await textJournalStore.persist(merged)
      }
    }
  }

  // --- Backgrounds ---

  async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  async function base64ToBlob(base64: string): Promise<Blob> {
    const res = await fetch(base64)
    return await res.blob()
  }

  async function exportBackgrounds() {
    const entries = Array.from(backgroundStore.entries.entries())
    const serializedEntries = await Promise.all(
      entries.map(async ([id, entry]) => {
        return {
          base64: await blobToBase64(entry.blob),
          id,
          metadata: { ...entry, blob: undefined },
        }
      }),
    )

    const data = {
      entries: serializedEntries,
      format: 'airi-backgrounds:v1',
      timestamp: Date.now(),
    }
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  }

  async function importBackgrounds(payload: any) {
    if (payload.format !== 'airi-backgrounds:v1' || !Array.isArray(payload.entries))
      throw new Error('Invalid backgrounds export format')

    for (const item of payload.entries) {
      if (!backgroundStore.entries.has(item.id)) {
        const blob = await base64ToBlob(item.base64)
        await backgroundStore.addBackground(
          item.metadata.type,
          blob,
          item.metadata.title,
          item.metadata.prompt,
          item.metadata.characterId,
          item.metadata.remixId,
        )
      }
    }
  }

  async function resetSettingsState() {
    await settingsStore.resetState()
    audioSettingsStore.resetState()
    live2dStore.resetState()
    mcpStore.resetState()
    onboardingStore.resetSetupState()
    airiCardStore.resetState()
  }

  async function deleteAllData() {
    await deleteAllModels()
    await resetProvidersSettings()
    resetModulesSettings()
    deleteAllChatSessions()
    await resetSettingsState()
  }

  async function resetDesktopApplicationState() {
    if (!isStageTamagotchi()) return

    await resetSettingsState()
    resetModulesSettings()
  }

  return {
    deleteAllChatSessions,
    deleteAllData,
    deleteAllModels,
    exportAllCharacters,
    exportBackgrounds,
    exportChatSessions,
    exportMemory,
    importAllCharacters,
    importBackgrounds,
    importChatSessions,
    importMemory,
    resetDesktopApplicationState,
    resetModulesSettings,
    resetProvidersSettings,
  }
}
