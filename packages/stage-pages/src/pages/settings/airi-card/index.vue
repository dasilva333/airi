<script setup lang="ts">
import type { Card, ccv3 } from '@proj-airi/ccc'
import type { AiriCard } from '@proj-airi/stage-ui/stores/modules/airi-card'

import { normalizeSearchText } from '@proj-airi/stage-shared'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { useSyncEngineStore } from '@proj-airi/stage-ui/stores/sync-engine'
import { AiriCardSchema } from '@proj-airi/stage-ui/types'
import { Alert, Button, InputFile } from '@proj-airi/ui'
import { Select } from '@proj-airi/ui/components/form'
import { storeToRefs } from 'pinia'
import { safeParse } from 'valibot'
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import CardListItem from './components/CardListItem.vue'

const CardDetailDialog = defineAsyncComponent(() => import('./components/CardDetailDialog.vue'))
const CardExportDialog = defineAsyncComponent(() => import('./components/CardExportDialog.vue'))
const CardImportWizard = defineAsyncComponent(() => import('./components/CardImportWizard.vue'))
const CreateModeSelectorDialog = defineAsyncComponent(() => import('./components/CreateModeSelectorDialog.vue'))
const DeleteCardDialog = defineAsyncComponent(() => import('./components/DeleteCardDialog.vue'))
const SyncCardDialog = defineAsyncComponent(() => import('./components/SyncCardDialog.vue'))

const { t } = useI18n()
const cardStore = useAiriCardStore()
const syncEngineStore = useSyncEngineStore()
const speechStore = useSpeechStore()
const { addCard, removeCard } = cardStore
const { cards, activeCardId, cardsLoading } = storeToRefs(cardStore)
const { selectiveSyncEnabled } = storeToRefs(syncEngineStore)

const route = useRoute()
const router = useRouter()

// Card sync filter & tracking (defaults to 'synced' if selective sync is enabled, else 'all')
const cardSyncFilter = ref<'all' | 'synced'>(selectiveSyncEnabled.value ? 'synced' : 'all')
watch(selectiveSyncEnabled, (enabled) => {
  cardSyncFilter.value = enabled ? 'synced' : 'all'
})
const syncingCardIds = ref<Set<string>>(new Set())

// Sync and activate confirmation
const showSyncConfirm = ref(false)
const cardToSyncAndActivate = ref<string | null>(null)

// Currently selected card ID (different from active card ID)
const selectedCardId = ref<string>('')
// Dialog state
const isCardDialogOpen = ref(false)
const isCreateModePromptOpen = ref(false)
const isExportDialogOpen = ref(false)
const exportTargetCard = ref<AiriCard | null>(null)
const exportTargetCardId = ref<string>('')

async function handleOpenExport(cardId: string) {
  const { useCardExport } = await import('./composables/use-card-export')
  const { getCardWithExportedBackground } = useCardExport()
  const card = await getCardWithExportedBackground(cardId)
  if (!card)
    return
  exportTargetCardId.value = cardId
  exportTargetCard.value = card
  isExportDialogOpen.value = true
}

function getCardSyncStatus(cardId: string): 'synced' | 'cloud-only' | 'partial' | 'syncing' {
  if (syncingCardIds.value.has(cardId)) {
    return 'syncing'
  }
  const displayModelId = getDisplayModelId(cardId)
  return syncEngineStore.getCardSyncStatus(cardId, displayModelId)
}

async function handleCardSync(cardId: string) {
  const card = cardStore.getCard(cardId)
  const cardName = card?.name || 'Character'
  const displayModelId = getDisplayModelId(cardId)

  syncingCardIds.value.add(cardId)
  try {
    const success = await syncEngineStore.syncCard(cardId, displayModelId)
    if (success) {
      toast.success(`Assets for "${cardName}" synced successfully!`)
    }
  }
  catch (e: any) {
    console.error(`Failed to sync card ${cardId}:`, e)
    toast.error(`Sync failed: ${e.message || String(e)}`)
  }
  finally {
    syncingCardIds.value.delete(cardId)
  }
}

async function handleCardActivate(id: string) {
  const status = getCardSyncStatus(id)
  if (status === 'cloud-only' || status === 'partial') {
    cardToSyncAndActivate.value = id
    showSyncConfirm.value = true
    return
  }
  await performActivate(id)
}

async function handleConfirmSyncAndActivate() {
  if (!cardToSyncAndActivate.value)
    return
  const id = cardToSyncAndActivate.value
  showSyncConfirm.value = false
  await handleCardSync(id)
  await performActivate(id)
  cardToSyncAndActivate.value = null
}

async function performActivate(id: string) {
  try {
    await cardStore.activateCard(id)
    const artistryStore = useArtistryStore()
    artistryStore.resetState()
  }
  catch (err) {
    console.error('[index.vue] Failed to activate card:', err)
  }
}

// Card browser drawer & wizard states
const activeBrowserSource = ref<any>(null)
const isImportWizardOpen = ref(false)
const importedCardData = ref<any>(null)

// Check if running in Electron
const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)

let removeIpcListener = () => {}

async function handleCharaCardDownloaded(payload: { base64Data: string, filename: string, ext: string }) {
  try {
    const rawData = atob(payload.base64Data)
    const arrayBuffer = new ArrayBuffer(rawData.length)
    const view = new Uint8Array(arrayBuffer)
    for (let i = 0; i < rawData.length; i++) {
      view[i] = rawData.charCodeAt(i)
    }

    let importedCard: ImportedCardPayload

    if (payload.ext === 'png') {
      importedCard = parsePngCharaPayload(arrayBuffer)
    }
    else {
      const decoder = new TextDecoder('utf-8')
      const text = decoder.decode(arrayBuffer)
      importedCard = parseImportedCard(text)
    }

    const normalized = addCardPreviewNormalize(importedCard)
    importedCardData.value = normalized

    // Close webview drawer
    activeBrowserSource.value = null

    // Open import wizard modal
    isImportWizardOpen.value = true
  }
  catch (err) {
    console.error('[Settings:Cards] Failed to process intercepted card:', err)
    toast.error('Failed to parse intercepted card file')
  }
}

onMounted(() => {
  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
    const handler = (_event: any, payload: { base64Data: string, filename: string, ext: string }) => {
      handleCharaCardDownloaded(payload)
    }
    (window as any).electron.ipcRenderer.on('chara-card-downloaded', handler)
    removeIpcListener = () => {
      (window as any).electron?.ipcRenderer.removeListener('chara-card-downloaded', handler)
    }
  }

  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)

  // Fast mount: schedule progressive card rendering after the initial frame
  startProgressiveCardRendering()
})

onUnmounted(() => {
  stopProgressiveCardRendering()
  toast.dismiss('character-config-opening')
  removeIpcListener()
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
})

// Initial tab for the detail dialog
const initialTab = ref<string | undefined>(undefined)

// Process opening intent from either store state or route query parameters
async function processOpenIntent() {
  if (cardsLoading.value)
    return

  // 1. Check store-driven pending modal intents (eliminates route-query race conditions)
  if (cardStore.pendingEditCardId) {
    const targetId = cardStore.pendingEditCardId
    cardStore.pendingEditCardId = null
    void router.push({ path: '/settings/airi-card/edit', query: { id: targetId } })
    return
  }

  if (cardStore.pendingViewCardId) {
    const { cardId: targetId } = cardStore.pendingViewCardId
    cardStore.pendingViewCardId = null

    if (!cards.value.has(targetId) && typeof cardStore.initialize === 'function') {
      await cardStore.initialize()
    }

    void router.push(`/settings/airi-card/${encodeURIComponent(targetId)}`)
    return
  }

  // 2. Fallback to deep-linking route query parameters
  const cardId = route.query.cardId as string
  const edit = route.query.edit as string

  if (!cardId)
    return

  if (!cards.value.has(cardId) && typeof cardStore.initialize === 'function') {
    await cardStore.initialize()
  }

  if (cards.value.has(cardId)) {
    if (edit === 'true') {
      void router.replace({ path: '/settings/airi-card/edit', query: { id: cardId } })
    }
    else {
      void router.replace({ path: `/settings/airi-card/${encodeURIComponent(cardId)}` })
    }
  }
}

watch(
  [
    () => cardStore.pendingEditCardId,
    () => cardStore.pendingViewCardId,
    () => route.query,
    () => cards.value.size,
    () => cardsLoading.value,
  ],
  () => {
    void processOpenIntent()
  },
  { immediate: true },
)

// Search query
const searchQuery = ref('')
const isSearchExpanded = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)

watch(isSearchExpanded, (expanded) => {
  if (expanded) {
    setTimeout(() => {
      searchInputRef.value?.focus()
    }, 50)
  }
})

// Sort option
const sortOption = ref('recent')

const inputFiles = ref<File[]>([])

// Upload/Import panel & page drag states
const isUploadZoneOpen = ref(false)
const isWindowDragging = ref(false)

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isWindowDragging.value = true
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  if (e.relatedTarget === null) {
    isWindowDragging.value = false
  }
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  isWindowDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.json')) {
      inputFiles.value = [file]
    }
  }
}

const cardSourceLinks = [
  {
    name: 'JannyAI',
    description: 'Character discovery and card sharing with SillyTavern-friendly exports in the ecosystem.',
    url: 'https://jannyai.com',
  },
  {
    name: 'JanitorAI',
    description: 'Popular character platform. Look for exports or mirrors that provide SillyTavern / chara_card_v2 PNG or JSON.',
    url: 'https://janitorai.com',
  },
  {
    name: 'Chub AI',
    description: 'Large character-sharing ecosystem commonly used with third-party roleplay UIs.',
    url: 'https://chub.ai',
  },
  {
    name: 'Risu Realm',
    description: 'Community character hub tied to the Risu ecosystem, useful for portable card-style prompts.',
    url: 'https://realm.risuai.net',
  },
  {
    name: 'Character Tavern',
    description: 'Clean and intuitive character library featuring 19K+ community cards, easy navigation, and direct SillyTavern card exports.',
    url: 'https://character-tavern.com',
  },
  {
    name: 'DataCat',
    description: 'A popular database and scraping tool used to search, browse, and export character definitions as SillyTavern JSON.',
    url: 'https://datacat.run/fresh',
  },
] as const

// Card list data structure
interface CardItem {
  id: string
  name: string
  nickname?: string
  description?: string
  deprecated?: boolean
  customizable?: boolean
  createdAt?: number
  updatedAt?: number
  index: number
}

type ImportedCardPayload = Card | ccv3.CharacterCardV3

function base64ToUtf8(input: string) {
  return decodeURIComponent(escape(atob(input)))
}

function parsePngCharaPayload(buffer: ArrayBuffer): ImportedCardPayload {
  const bytes = new Uint8Array(buffer)

  for (let offset = 8; offset < bytes.length - 8;) {
    const length = (
      (bytes[offset] << 24)
      | (bytes[offset + 1] << 16)
      | (bytes[offset + 2] << 8)
      | bytes[offset + 3]
    ) >>> 0

    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    )

    if (type === 'tEXt') {
      const dataStart = offset + 8
      const dataEnd = dataStart + length
      const data = bytes.slice(dataStart, dataEnd)
      const separator = data.indexOf(0)

      if (separator > 0) {
        const keyword = new TextDecoder().decode(data.slice(0, separator))
        if (keyword === 'chara') {
          const text = new TextDecoder().decode(data.slice(separator + 1))
          const decoded = JSON.parse(base64ToUtf8(text)) as any
          return decoded as ImportedCardPayload
        }
      }
    }

    offset += 12 + length
  }

  throw new Error('PNG does not contain a supported chara payload')
}

function getImportedCardName(card: ImportedCardPayload): string {
  if ('data' in card)
    return card.data?.name || 'Imported Card'

  return card.name || 'Imported Card'
}

function withImportedCardName(card: ImportedCardPayload, name: string): ImportedCardPayload {
  if ('data' in card) {
    return {
      ...card,
      data: {
        ...card.data,
        name,
      },
    }
  }

  return {
    ...card,
    name,
  }
}

function getUniqueImportedCardName(baseName: string): string {
  const existingNames = new Set(
    Array.from(cards.value.values()).map(card => (card.name || '').trim().toLowerCase()).filter(Boolean),
  )

  const trimmedBase = baseName.trim() || 'Imported Card'
  if (!existingNames.has(trimmedBase.toLowerCase()))
    return trimmedBase

  let counter = 2
  while (existingNames.has(`${trimmedBase} (${counter})`.toLowerCase()))
    counter += 1

  return `${trimmedBase} (${counter})`
}

function parseImportedCard(content: string): ImportedCardPayload {
  const parsed = JSON.parse(content) as any

  if (parsed?.format === 'airi-card' && parsed?.version === 1 && parsed?.card) {
    return parsed.card as Card
  }

  return parsed as ImportedCardPayload
}

watch(inputFiles, async (newFiles) => {
  const file = newFiles[0]
  if (!file)
    return

  try {
    if (file.name.toLowerCase().endsWith('.zip')) {
      try {
        const { useDataMaintenance } = await import('@proj-airi/stage-ui/composables/use-data-maintenance')
        const { importCardZipPackage } = useDataMaintenance()
        const result = await importCardZipPackage(file)
        selectedCardId.value = result.cardId
        isCardDialogOpen.value = true

        const bits = [`${result.flavor === 'v1' ? 'Upstream' : 'Extended'} package imported`]
        if (result.importedModelIds.length > 0)
          bits.push('display model')
        if (result.importedBackgroundId)
          bits.push('background')
        if (result.importedVoiceCount > 0)
          bits.push(`${result.importedVoiceCount} voice(s)`)
        if (result.importedSessionCount > 0)
          bits.push(`${result.importedSessionCount} session(s)`)
        toast.success(`Card imported successfully (${bits.join(', ')})`)
        if (result.warnings.length > 0) {
          toast.warning('Some package assets were skipped', {
            description: result.warnings.join('; '),
          })
        }
      }
      catch (error) {
        console.error('[AiriCard] Error importing ZIP package:', error)
        toast.error('Error importing ZIP package', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
      return
    }

    let importedCard: ImportedCardPayload

    if (file.name.toLowerCase().endsWith('.png')) {
      importedCard = parsePngCharaPayload(await file.arrayBuffer())
    }
    else {
      const content = await file.text()
      try {
        importedCard = parseImportedCard(content)
      }
      catch (e) {
        toast.error('Failed to parse card JSON: Malformed file')
        return
      }
    }

    const normalizedForValidation = addCardPreviewNormalize(importedCard)

    // Validate the normalized AIRI card shape
    const validation = safeParse(AiriCardSchema, normalizedForValidation)
    if (!validation.success) {
      const errorMsg = validation.issues.map((i) => {
        const pathStr = i.path?.map(p => p.key).filter(k => k !== undefined && k !== null).join('.') || 'root'
        return `${pathStr}: ${i.message}`
      }).join(', ')
      toast.error('Card validation failed', {
        description: errorMsg,
      })
      console.error('[AiriCard] Validation errors:', validation.issues)
      return
    }

    const uniqueName = getUniqueImportedCardName(getImportedCardName(normalizedForValidation))
    const renamedCard = withImportedCardName(normalizedForValidation, uniqueName)

    // Import embedded virtual voice profiles into speech store
    const embeddedProfiles = normalizedForValidation.extensions?.airi?.voice_profiles
    if (Array.isArray(embeddedProfiles)) {
      for (const profile of embeddedProfiles) {
        if (profile && profile.id) {
          const exists = speechStore.savedVoiceProfiles.some((p: any) => p.id === profile.id)
          if (!exists) {
            console.log(`[index.vue] Importing virtual voice profile: ${profile.name} (${profile.id})`)
            speechStore.saveVoiceProfile(profile)
          }
          else {
            console.warn(`[index.vue] Skipping voice profile import for existing ID: ${profile.id}`)
          }
        }
      }
    }

    // Add card and select it
    selectedCardId.value = await addCard(renamedCard)
    isCardDialogOpen.value = true
    toast.success('Card imported successfully')
  }
  catch (error) {
    console.error('[AiriCard] Error processing card file:', error)
    toast.error('Error processing card file', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

function parseStMessageExamples(exampleStr: string): string[][] {
  if (!exampleStr || typeof exampleStr !== 'string')
    return []

  // ST standard uses <START> (often case-insensitive) as a separator for example chat logs
  // We split by <START> and filter out empty blocks
  const blocks = exampleStr
    .split(/<START>/i)
    .map(block => block.trim())
    .filter(Boolean)

  return blocks.map((block) => {
    // Each block is a transcript. We split by lines and filter empty lines.
    // We also ensure lines start with {{user}}: or {{char}}: as per AIRI requirements
    return block
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((line) => {
        // Basic normalization for common ST variants
        let normalized = line
        if (normalized.toLowerCase().startsWith('user:')) {
          normalized = `{{user}}:${normalized.slice(5)}`
        }
        else if (normalized.toLowerCase().startsWith('char:')) {
          normalized = `{{char}}:${normalized.slice(5)}`
        }
        // Ensure space after colon if missing for AIRI schema compliance
        // Schema regex: /^\{\{(?:user|char)\}\}: /
        if (/^\{\{(?:user|char)\}\}:\S/.test(normalized)) {
          normalized = normalized.replace(/^(\{\{(?:user|char)\}\}:)/, '$1 ')
        }

        return normalized
      })
      // Filter to only kept lines that match AIRI's MessageExampleItemSchema
      .filter(line => /^\{\{(?:user|char)\}\}: /.test(line))
  }).filter(block => block.length > 0)
}

function removeNullValues(obj: any): any {
  if (obj === null) {
    return undefined
  }
  if (Array.isArray(obj)) {
    return obj.map(removeNullValues)
  }
  if (obj !== null && typeof obj === 'object') {
    const clean: any = {}
    for (const key of Object.keys(obj)) {
      const val = removeNullValues(obj[key])
      if (val !== undefined) {
        clean[key] = val
      }
    }
    return clean
  }
  return obj
}

function addCardPreviewNormalize(card: any) {
  // Detect ST V2 (data wrapper) vs V1 (root fields)
  const data = card.data || card

  let normalized: any
  const normalizedVersion = (v: unknown): string => {
    if (typeof v === 'string' && v.trim())
      return v.trim()
    if (typeof v === 'number' && !Number.isNaN(v))
      return String(v)
    return '1.0.0'
  }
  // If it's already an AIRI card, we still want to ensure universal fields like messageExample are valid arrays
  if (card.format === 'airi-card' || card.systemPrompt !== undefined) {
    normalized = {
      ...card,
      version: normalizedVersion(card.version),
      // If messageExample is a string (stale AIRI or raw ST), normalize it to AIRI format[][]
      messageExample: typeof card.messageExample === 'string'
        ? parseStMessageExamples(card.messageExample)
        : card.messageExample,
    }
  }
  else {
    normalized = {
      name: data.name || 'Imported Card',
      version: normalizedVersion(data.character_version),
      description: data.description ?? '',
      notes: data.creator_notes ?? '',
      personality: data.personality ?? '',
      scenario: data.scenario ?? '',
      systemPrompt: data.system_prompt ?? '',
      postHistoryInstructions: data.post_history_instructions ?? '',
      greetings: [
        data.first_mes,
        ...(data.alternate_greetings ?? []),
      ].filter(Boolean),
      messageExample: parseStMessageExamples(data.mes_example || ''),
      extensions: {
        airi: data.extensions?.airi,
        ...data.extensions,
      },
    }
  }

  return removeNullValues(normalized)
}

// Transform cards Map to array for display
const cardsArray = computed<CardItem[]>(() => {
  return Array.from(cards.value.entries()).map(([id, card], index) => ({
    id,
    name: card.name || '',
    nickname: card.nickname || (card as any).data?.nickname || '',
    description: card.description || (card as any).data?.description || '',
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    index,
  }))
})

// Filtered cards based on search query and sync status
const filteredCards = computed<CardItem[]>(() => {
  let list = cardsArray.value

  if (selectiveSyncEnabled.value && cardSyncFilter.value === 'synced') {
    list = list.filter(item => getCardSyncStatus(item.id) === 'synced')
  }

  if (!searchQuery.value)
    return list

  const query = normalizeSearchText(searchQuery.value)
  return list.filter(item =>
    normalizeSearchText(item.name).includes(query)
    || normalizeSearchText(item.nickname).includes(query)
    || normalizeSearchText(item.id).includes(query)
    || (item.description && normalizeSearchText(item.description).includes(query)),
  )
})

// Sorted filtered cards based on sort option
const sortedFilteredCards = computed<CardItem[]>(() => {
  // Create a new array to avoid mutating the source
  const sorted = [...filteredCards.value]

  if (sortOption.value === 'nameAsc') {
    sorted.sort((a, b) => ((a.nickname || a.name) || '').localeCompare((b.nickname || b.name) || ''))
  }
  else if (sortOption.value === 'nameDesc') {
    sorted.sort((a, b) => ((b.nickname || b.name) || '').localeCompare((a.nickname || a.name) || ''))
  }
  else if (sortOption.value === 'recent') {
    sorted.sort((a, b) => {
      if (a.createdAt !== undefined && b.createdAt !== undefined)
        return b.createdAt - a.createdAt
      return b.index - a.index
    })
  }

  // Always bring the active card to the front
  if (activeCardId.value) {
    sorted.sort((a, b) => {
      const aIsActive = a.id === activeCardId.value
      const bIsActive = b.id === activeCardId.value
      if (aIsActive && !bIsActive)
        return -1
      if (!aIsActive && bIsActive)
        return 1
      return 0
    })
  }

  return sorted
})

// Progressive rendering: initial frame renders a fast viewport-friendly batch (8 cards)
// so the route transition finishes immediately, then increments until all cards are mounted.
const INITIAL_RENDER_COUNT = 8
const BATCH_INCREMENT = 8
const renderedCardLimit = ref(INITIAL_RENDER_COUNT)
let progressiveTimer: any = null

function startProgressiveCardRendering() {
  renderedCardLimit.value = INITIAL_RENDER_COUNT
  const step = () => {
    if (renderedCardLimit.value < sortedFilteredCards.value.length) {
      renderedCardLimit.value = Math.min(
        renderedCardLimit.value + BATCH_INCREMENT,
        sortedFilteredCards.value.length,
      )
      if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
        progressiveTimer = requestAnimationFrame(step)
      }
      else {
        progressiveTimer = setTimeout(step, 50)
      }
    }
    else {
      progressiveTimer = null
    }
  }

  if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
    progressiveTimer = requestAnimationFrame(step)
  }
  else {
    progressiveTimer = setTimeout(step, 50)
  }
}

function stopProgressiveCardRendering() {
  if (progressiveTimer !== null) {
    if (typeof window !== 'undefined' && 'cancelAnimationFrame' in window) {
      cancelAnimationFrame(progressiveTimer)
    }
    else {
      clearTimeout(progressiveTimer)
    }
    progressiveTimer = null
  }
}

// Watch filtered cards changes (e.g. search filter typing) to reset or top-up visible limits
watch(
  () => sortedFilteredCards.value.length,
  (len) => {
    if (len <= INITIAL_RENDER_COUNT) {
      renderedCardLimit.value = len
    }
    else if (renderedCardLimit.value < len && !progressiveTimer) {
      startProgressiveCardRendering()
    }
  },
)

const visibleCards = computed<CardItem[]>(() => {
  return sortedFilteredCards.value.slice(0, renderedCardLimit.value)
})

// Delete confirmation
const showDeleteConfirm = ref(false)
const cardToDelete = ref<string | null>(null)

function handleDeleteConfirm() {
  if (cardToDelete.value) {
    removeCard(cardToDelete.value)
    cardToDelete.value = null
    showDeleteConfirm.value = false
  }
}

// Card deletion confirmation
function confirmDelete(id: string) {
  cardToDelete.value = id
  showDeleteConfirm.value = true
}

function handleSelectCard(cardId: string) {
  // Verify card exists before navigating to detail route
  if (!cards.value.has(cardId)) {
    console.error(`Card with id ${cardId} not found`)
    return
  }
  router.push(`/settings/airi-card/${encodeURIComponent(cardId)}`)
}

function handleEditCard(cardId: string) {
  // Verify card exists before opening edit route
  if (!cards.value.has(cardId)) {
    console.error(`Card with id ${cardId} not found`)
    return
  }
  isCardDialogOpen.value = false
  router.push({ path: '/settings/airi-card/edit', query: { id: cardId } })
}

function handleCardCreationDialog() {
  isCreateModePromptOpen.value = true
}

function handleWizardMode() {
  const onboardingStore = useOnboardingStore()
  onboardingStore.resetSetupState()
  onboardingStore.forceShowSetup()
}

function handleGuidedMode() {
  router.push('/settings/airi-card/guided')
}

function handleFoundryMode() {
  isCreateModePromptOpen.value = false
  router.push('/settings/airi-card/foundry')
}

function handleAdvancedMode() {
  isCreateModePromptOpen.value = false
  router.push('/settings/airi-card/edit')
}

// Card version number
function getVersionNumber(id: string) {
  const card = cards.value.get(id)
  return card?.version || '1.0.0'
}

// Card module short name
function getModuleShortName(id: string, module: 'consciousness' | 'voice') {
  const card = cards.value.get(id)
  if (!card || !card.extensions?.airi?.modules)
    return 'default'

  const airiExt = card.extensions.airi.modules

  if (module === 'consciousness') {
    return airiExt.consciousness?.model ? airiExt.consciousness.model.split('-').pop() || 'default' : 'default'
  }
  else if (module === 'voice') {
    return airiExt.speech?.voice_id || 'default'
  }

  return 'default'
}

// Get display model ID for flip preview.
function getDisplayModelId(id: string) {
  return cardStore.getCardDisplayModelId(id)
}
</script>

<template>
  <div rounded-xl p-4 flex="~ col gap-4">
    <!-- Compact actions toolbar -->
    <div flex="~ row" items-center justify-between gap-2 class="relative min-h-[38px] w-full">
      <!-- Left actions / Expandable Search & Sort -->
      <div flex="~ row" min-w-0 flex-1 items-center gap-2>
        <!-- Search Toggle & Input -->
        <div class="relative flex items-center" :class="isSearchExpanded || searchQuery ? 'flex-1' : ''">
          <Button
            v-if="!isSearchExpanded && !searchQuery"
            variant="ghost"
            icon="i-solar:magnifer-line-duotone"
            class="h-[38px] w-[38px] border border-neutral-200 rounded-xl bg-white/60 dark:border-neutral-800 dark:bg-neutral-900/30 !p-0"
            @click="isSearchExpanded = true"
          />
          <div v-else class="relative w-full flex items-center">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div i-solar:magnifer-line-duotone class="text-sm text-neutral-500 dark:text-neutral-400" />
            </div>
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="search"
              class="h-[38px] w-full rounded-xl p-2 pl-9 pr-7 text-xs outline-none"
              border="focus:primary-100 dark:focus:primary-400/50 2 solid neutral-200 dark:neutral-800"
              transition="all duration-200 ease-in-out"
              bg="white dark:neutral-900"
              :placeholder="t('settings.pages.card.search')"
              @blur="searchQuery === '' ? isSearchExpanded = false : null"
            >
            <button
              v-if="isSearchExpanded || searchQuery"
              class="absolute right-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              @click="searchQuery = ''; isSearchExpanded = false"
            >
              <div i-solar:close-square-bold-duotone />
            </button>
          </div>
        </div>

        <!-- Sort dropdown (compact) -->
        <div class="relative h-[38px] flex items-center gap-1.5">
          <div i-solar:sort-vertical-line-duotone class="ml-1 text-lg text-neutral-500 dark:text-neutral-400" />
          <Select
            v-model="sortOption"
            :options="[
              { value: 'nameAsc', label: t('settings.pages.card.name_asc') },
              { value: 'nameDesc', label: t('settings.pages.card.name_desc') },
              { value: 'recent', label: t('settings.pages.card.recent') },
            ]"
            placeholder="Sort"
            class="h-[32px] min-w-[100px] text-xs !border-transparent !bg-transparent hover:!bg-neutral-100 dark:hover:!bg-neutral-800/50"
          />
        </div>

        <!-- Selective Sync Filter Toggle (Only visible when Selective Sync is active) -->
        <div
          v-if="selectiveSyncEnabled"
          class="h-[36px] flex items-center border border-neutral-200/80 rounded-xl bg-white/70 p-0.5 dark:border-neutral-800/80 dark:bg-neutral-900/40"
        >
          <button
            type="button"
            :class="[
              'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all',
              cardSyncFilter === 'all'
                ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
            ]"
            @click="cardSyncFilter = 'all'"
          >
            All
          </button>
          <button
            type="button"
            :class="[
              'px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all',
              cardSyncFilter === 'synced'
                ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
            ]"
            title="Show only synced cards"
            @click="cardSyncFilter = 'synced'"
          >
            <div class="i-solar:bolt-bold text-[11px] text-emerald-500" />
            <span>Synced</span>
          </button>
        </div>
      </div>

      <!-- Right actions (Import / Create) -->
      <div flex="~ row" items-center gap-2 class="flex-shrink-0">
        <!-- Import Button (Toggles Drawer) -->
        <Button
          :variant="isUploadZoneOpen ? 'secondary' : 'ghost'"
          class="h-[38px] flex items-center gap-1.5 border border-neutral-200 rounded-xl bg-white/60 px-3 dark:border-neutral-800 hover:border-primary-300 dark:bg-neutral-900/30 dark:hover:border-primary-700"
          @click="isUploadZoneOpen = !isUploadZoneOpen"
        >
          <div i-solar:upload-square-line-duotone class="text-base text-neutral-400 dark:text-neutral-500" />
          <span class="text-xs text-neutral-600 font-medium dark:text-neutral-300">Import</span>
        </Button>

        <!-- Create Button -->
        <Button
          variant="primary"
          class="h-[38px] flex items-center gap-1.5 border border-primary-500/20 rounded-xl bg-primary-500/10 px-3.5 text-primary-600 dark:border-primary-500/30 hover:bg-primary-500/20 dark:text-primary-400"
          @click="handleCardCreationDialog"
        >
          <div i-solar:add-square-line-duotone class="text-base text-primary-500" />
          <span class="text-xs font-medium">Create</span>
        </Button>
      </div>
    </div>

    <!-- Toggleable Upload Area -->
    <div v-if="isUploadZoneOpen" class="w-full">
      <InputFile v-model="inputFiles" accept="*.json,*.png,*.zip" class="w-full">
        <template #default="{ isDragging }">
          <div
            :class="[
              'relative flex flex-col cursor-pointer items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all duration-300 h-[80px] w-full',
              isDragging
                ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10 text-primary-500'
                : 'border-neutral-200 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/10 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-white/60 dark:hover:bg-neutral-900/20',
            ]"
          >
            <div i-solar:upload-square-line-duotone class="mb-1 text-xl text-neutral-400 dark:text-neutral-500" />
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              {{ isDragging ? t('settings.pages.card.drop_here') : 'Click or drag card files here' }}
            </p>
          </div>
        </template>
      </InputFile>
    </div>

    <!-- Responsive card layout (2 columns for portrait, 4 columns for landscape) -->
    <div
      class="grid grid-cols-2 mt-4 gap-4 md:grid-cols-4"
    >
      <!-- Shimmer Skeleton Loading State -->
      <template v-if="cardsLoading">
        <div
          v-for="i in 4"
          :key="i"
          class="relative h-[280px] flex flex-col animate-pulse overflow-hidden border-2 border-neutral-100 rounded-xl bg-neutral-200/40 dark:border-neutral-800/25 dark:bg-neutral-800/40"
        >
          <div class="aspect-square w-full bg-neutral-300/40 dark:bg-neutral-700/40" />
          <div class="flex flex-1 flex-col justify-between p-3">
            <div class="h-4 w-3/4 rounded bg-neutral-300/50 dark:bg-neutral-700/50" />
            <div class="flex items-center justify-between">
              <div class="h-3 w-1/4 rounded bg-neutral-300/40 dark:bg-neutral-700/40" />
              <div class="h-3 w-1/3 rounded bg-neutral-300/40 dark:bg-neutral-700/40" />
            </div>
          </div>
        </div>
      </template>

      <!-- Card Items -->
      <template v-else-if="cards.size > 0">
        <CardListItem
          v-for="item in visibleCards"
          :id="item.id"
          :key="item.id"
          :name="item.name"
          :nickname="item.nickname"
          :description="item.description"
          :is-active="item.id === activeCardId"
          :is-selected="item.id === selectedCardId && isCardDialogOpen"
          :version="getVersionNumber(item.id)"
          :consciousness-model="getModuleShortName(item.id, 'consciousness')"
          :voice-model="getModuleShortName(item.id, 'voice')"
          :display-model-id="getDisplayModelId(item.id)"
          :sync-status="getCardSyncStatus(item.id)"
          @select="handleSelectCard(item.id)"
          @activate="handleCardActivate(item.id)"
          @sync="handleCardSync(item.id)"
          @delete="confirmDelete(item.id)"
          @edit="handleEditCard(item.id)"
          @export="handleOpenExport(item.id)"
        />

        <!-- Progressive shimmer placeholders while remaining cards mount -->
        <template v-if="renderedCardLimit < sortedFilteredCards.length">
          <div
            v-for="i in Math.min(4, sortedFilteredCards.length - renderedCardLimit)"
            :key="`progressive-skeleton-${i}`"
            class="relative h-[280px] flex flex-col animate-pulse overflow-hidden border-2 border-neutral-100 rounded-xl bg-neutral-200/40 dark:border-neutral-800/25 dark:bg-neutral-800/40"
          >
            <div class="aspect-square w-full bg-neutral-300/40 dark:bg-neutral-700/40" />
            <div class="flex flex-1 flex-col justify-between p-3">
              <div class="h-4 w-3/4 rounded bg-neutral-300/50 dark:bg-neutral-700/50" />
              <div class="flex items-center justify-between">
                <div class="h-3 w-1/4 rounded bg-neutral-300/40 dark:bg-neutral-700/40" />
                <div class="h-3 w-1/3 rounded bg-neutral-300/40 dark:bg-neutral-700/40" />
              </div>
            </div>
          </div>
        </template>
      </template>

      <!-- No cards message -->
      <div
        v-else
        class="col-span-full rounded-xl p-8 text-center"
        border="~ neutral-200/50 dark:neutral-700/30"
        bg="neutral-50/50 dark:neutral-900/50"
      >
        <div i-solar:card-search-broken mx-auto mb-3 text-6xl text-neutral-400 />
        <p>{{ t('settings.pages.card.no_cards') }}</p>
      </div>

      <!-- No search results -->
      <Alert v-if="!cardsLoading && searchQuery && sortedFilteredCards.length === 0" type="warning" class="col-span-full">
        <template #title>
          {{ t('settings.pages.card.no_results') }}
        </template>
        <template #content>
          {{ t('settings.pages.card.try_different_search') }}
        </template>
      </Alert>
    </div>
  </div>

  <!-- Sync and activate confirmation dialog -->
  <SyncCardDialog
    v-if="showSyncConfirm"
    v-model="showSyncConfirm"
    :card-name="cardToSyncAndActivate ? cardStore.getCard(cardToSyncAndActivate)?.name : ''"
    @confirm="handleConfirmSyncAndActivate"
    @cancel="cardToSyncAndActivate = null"
  />

  <!-- Delete confirmation dialog -->
  <DeleteCardDialog
    v-if="showDeleteConfirm"
    v-model="showDeleteConfirm"
    :card-name="cardToDelete ? cardStore.getCard(cardToDelete)?.name : ''"
    @confirm="handleDeleteConfirm"
    @cancel="cardToDelete = null"
  />

  <!-- Card detail dialog -->
  <CardDetailDialog
    v-if="isCardDialogOpen"
    v-model="isCardDialogOpen"
    :card-id="selectedCardId"
    :initial-tab="initialTab"
    @edit="handleEditCard"
  />

  <!-- Mode Selector Dialog -->
  <CreateModeSelectorDialog
    v-if="isCreateModePromptOpen"
    v-model="isCreateModePromptOpen"
    @wizard="handleWizardMode"
    @guided="handleGuidedMode"
    @foundry="handleFoundryMode"
    @advanced="handleAdvancedMode"
  />

  <!-- Card import wizard dialog -->
  <CardImportWizard
    v-if="isImportWizardOpen"
    v-model="isImportWizardOpen"
    :card-data="importedCardData"
    @imported="handleSelectCard"
  />

  <!-- Card export dialog (mock preview) -->
  <CardExportDialog
    v-if="isExportDialogOpen"
    v-model="isExportDialogOpen"
    :card-id="exportTargetCardId"
    :card="exportTargetCard"
  />

  <!-- Card browser slide-over webview drawer (Only renders if running in Electron) -->
  <div
    v-if="isElectron"
    :class="[
      'fixed inset-y-0 right-0 z-50 w-[70vw] border-l border-neutral-200 bg-white/95 shadow-2xl transition-transform duration-500 ease-in-out backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95',
      activeBrowserSource ? 'translate-x-0' : 'translate-x-full',
    ]"
  >
    <div class="h-full flex flex-col">
      <div class="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
        <div class="flex items-center gap-3">
          <h3 class="text-lg text-neutral-800 font-bold dark:text-neutral-200">
            Browse {{ activeBrowserSource?.name }}
          </h3>
          <span class="rounded bg-primary-500/10 px-2 py-0.5 text-xs text-primary-500 font-medium">
            Electron Webview
          </span>
        </div>
        <Button
          variant="ghost"
          icon="i-solar:close-square-bold-duotone"
          label="Close"
          @click="activeBrowserSource = null"
        />
      </div>
      <div class="flex-1 bg-white dark:bg-neutral-950">
        <component
          is="webview"
          v-if="activeBrowserSource"
          :src="activeBrowserSource.url"
          class="h-full w-full"
          allowpopups
        />
      </div>
    </div>
  </div>

  <!-- Background decoration -->
  <div
    v-motion
    text="neutral-200/50 dark:neutral-600/20" pointer-events-none
    fixed top="[calc(100dvh-15rem)]" bottom-0 right--5 z--1
    :initial="{ scale: 0.9, opacity: 0, x: 20 }"
    :enter="{ scale: 1, opacity: 1, x: 0 }"
    :duration="500"
    size-60
    flex items-center justify-center
  >
    <div text="60" i-solar:emoji-funny-square-bold-duotone />
  </div>

  <div
    :class="[
      'mt-8 rounded-2xl border border-primary-500/10 bg-primary-500/5 p-5',
      'flex flex-col gap-4',
    ]"
  >
    <div :class="['flex items-start gap-3']">
      <div :class="['i-solar:compass-bold-duotone text-2xl text-primary-500']" />
      <div :class="['flex flex-col gap-1']">
        <div :class="['text-lg font-bold']">
          Find More Cards
        </div>
        <div :class="['max-w-3xl text-sm opacity-80']">
          AIRI can import standard SillyTavern-style character cards, including `chara_card_v2` PNG exports. Imported cards are a strong starting point, but they usually will not fill in AIRI-specific fields automatically.
        </div>
        <div :class="['max-w-3xl text-sm opacity-70']">
          After import, review and customize AIRI-only settings, especially the <strong>Acting</strong> tab, so expressions, speech tags, and motion cues actually line up with your current VRM or Live2D model.
        </div>
      </div>
    </div>

    <div :class="['grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4']">
      <component
        :is="isElectron ? 'button' : 'a'"
        v-for="source in cardSourceLinks"
        :key="source.name"
        :href="isElectron ? undefined : source.url"
        :target="isElectron ? undefined : '_blank'"
        :rel="isElectron ? undefined : 'noopener noreferrer'"
        :class="[
          'group rounded-xl border border-transparent bg-white/70 p-4 text-left transition-all dark:bg-neutral-900/60',
          'hover:border-primary-500/40 hover:shadow-md',
          'flex flex-col gap-2 w-full',
        ]"
        @click="isElectron ? (activeBrowserSource = source) : null"
      >
        <div :class="['flex items-center justify-between gap-2']">
          <div :class="['font-bold group-hover:text-primary-500 transition-colors']">
            {{ source.name }}
          </div>
          <div :class="['i-solar:share-circle-bold-duotone text-primary-500 opacity-70']" />
        </div>
        <div :class="['text-sm opacity-75']">
          {{ source.description }}
        </div>
      </component>
    </div>

    <div :class="['text-xs opacity-60']">
      Prefer exports explicitly labeled for SillyTavern, `chara_card_v2`, or ST PNG / JSON compatibility. Not every character site exports in a portable format.
    </div>
  </div>

  <!-- Full screen Drag and Drop Overlay -->
  <div
    v-if="isWindowDragging"
    class="pointer-events-none fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 text-white backdrop-blur-md"
  >
    <div class="max-w-sm flex flex-col items-center gap-4 border-2 border-primary-500 rounded-2xl border-dashed bg-neutral-900/80 p-8 text-center">
      <div i-solar:upload-square-line-duotone class="animate-bounce text-6xl text-primary-500" />
      <h3 class="text-xl font-bold">
        Import Character Card
      </h3>
      <p class="text-sm opacity-80">
        Drop your .png (Chara Card V2) or .json files anywhere to import them into AIRI
      </p>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.card.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.card.description
  icon: i-solar:emoji-funny-square-bold-duotone
  settingsEntry: true
  order: 1
  stageTransition:
    name: slide
</route>
