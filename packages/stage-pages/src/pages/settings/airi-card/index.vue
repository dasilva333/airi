<script setup lang="ts">
import type { Card, ccv3 } from '@proj-airi/ccc'
import type { AiriCard } from '@proj-airi/stage-ui/stores/modules/airi-card'

import { loadLive2DModelPreview } from '@proj-airi/stage-ui-live2d/utils/live2d-preview'
import { useModelStore } from '@proj-airi/stage-ui-three'
import { loadVrmModelPreview } from '@proj-airi/stage-ui-three/utils/vrm-preview'
import { Alert } from '@proj-airi/stage-ui/components'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores/background'
import { DisplayModelFormat, useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { useSettingsStageModel } from '@proj-airi/stage-ui/stores/settings/stage-model'
import { AiriCardSchema } from '@proj-airi/stage-ui/types'
import { Button, InputFile } from '@proj-airi/ui'
import { Select } from '@proj-airi/ui/components/form'
import { storeToRefs } from 'pinia'
import { safeParse } from 'valibot'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import cardExportFrameUrl from './card-export-frame.png?url'
import CardCreationDialog from './components/CardCreationDialog.vue'
import CardDetailDialog from './components/CardDetailDialog.vue'
import CardImportWizard from './components/CardImportWizard.vue'
import CardListItem from './components/CardListItem.vue'
import CreateModeSelectorDialog from './components/CreateModeSelectorDialog.vue'
import DeleteCardDialog from './components/DeleteCardDialog.vue'

const { t } = useI18n()
const cardStore = useAiriCardStore()
const displayModelsStore = useDisplayModelsStore()
const { addCard, removeCard } = cardStore
const { cards, activeCardId } = storeToRefs(cardStore)
const modelStore = useModelStore()
const stageModelStore = useSettingsStageModel()
const backgroundStore = useBackgroundStore()
const speechStore = useSpeechStore()
const { activeExpressions } = storeToRefs(modelStore)
const { stageModelSelected } = storeToRefs(stageModelStore)

const route = useRoute()
const router = useRouter()

// Currently selected card ID (different from active card ID)
const selectedCardId = ref<string>('')
// Currently editing card ID
const editingCardId = ref<string>('')
// Dialog state
const isCardDialogOpen = ref(false)
const isCardCreationDialogOpen = ref(false)
const isCreateModePromptOpen = ref(false)

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
})

onUnmounted(() => {
  removeIpcListener()
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
})

// Initial tab for the detail dialog
const initialTab = ref<string | undefined>(undefined)

// Watch for deep-linking query parameters
watch(
  () => route.query,
  (query) => {
    const cardId = query.cardId as string
    const tab = query.tab as string
    const edit = query.edit as string

    if (cardId && cards.value.has(cardId)) {
      if (edit === 'true') {
        editingCardId.value = cardId
        isCardCreationDialogOpen.value = true
      }
      else {
        selectedCardId.value = cardId
        initialTab.value = tab || undefined
        isCardDialogOpen.value = true
      }

      // Clear query params after handling
      router.replace({ query: {} })
    }
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
    name: 'DataCat',
    description: 'A popular database and scraping tool used to search, browse, and export character definitions as SillyTavern JSON.',
    url: 'https://datacat.run/fresh',
  },
] as const

// Card list data structure
interface CardItem {
  id: string
  name: string
  description?: string
  deprecated?: boolean
  customizable?: boolean
  createdAt?: number
  updatedAt?: number
  index: number
}

type ImportedCardPayload = Card | ccv3.CharacterCardV3
const CARD_EXPORT_FRAME = {
  width: 925,
  height: 1436,
  innerX: 65,
  innerY: 79,
  innerWidth: 831,
  innerHeight: 1295,
} as const

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
  // If it's already an AIRI card, we still want to ensure universal fields like messageExample are valid arrays
  if (card.format === 'airi-card' || card.systemPrompt !== undefined) {
    normalized = {
      ...card,
      version: card.version || '1.0.0',
      // If messageExample is a string (stale AIRI or raw ST), normalize it to AIRI format[][]
      messageExample: typeof card.messageExample === 'string'
        ? parseStMessageExamples(card.messageExample)
        : card.messageExample,
    }
  }
  else {
    normalized = {
      name: data.name || 'Imported Card',
      version: data.character_version || '1.0.0',
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
    description: card.description || '',
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    index,
  }))
})

// Filtered cards based on search query
const filteredCards = computed<CardItem[]>(() => {
  if (!searchQuery.value)
    return cardsArray.value

  const query = searchQuery.value.toLowerCase()
  return cardsArray.value.filter(item =>
    item.name.toLowerCase().includes(query)
    || (item.description && item.description.toLowerCase().includes(query)),
  )
})

// Sorted filtered cards based on sort option
const sortedFilteredCards = computed<CardItem[]>(() => {
  // Create a new array to avoid mutating the source
  const sorted = [...filteredCards.value]

  if (sortOption.value === 'nameAsc') {
    sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }
  else if (sortOption.value === 'nameDesc') {
    sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''))
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
  // Verify card exists before opening dialog
  if (!cards.value.has(cardId)) {
    console.error(`Card with id ${cardId} not found`)
    return
  }
  selectedCardId.value = cardId
  isCardDialogOpen.value = true
}

function handleEditCard(cardId: string) {
  // Verify card exists before opening edit dialog
  if (!cards.value.has(cardId)) {
    console.error(`Card with id ${cardId} not found`)
    return
  }
  isCardDialogOpen.value = false
  editingCardId.value = cardId
  isCardCreationDialogOpen.value = true
}

function handleOpenStudio(cardId: string) {
  if (!cards.value.has(cardId)) {
    console.error(`Card with id ${cardId} not found`)
    return
  }
  isCardCreationDialogOpen.value = false
  selectedCardId.value = cardId
  initialTab.value = 'studio'
  isCardDialogOpen.value = true
}

function handleCardCreationDialog() {
  isCreateModePromptOpen.value = true
}

function handleWizardMode() {
  const onboardingStore = useOnboardingStore()
  onboardingStore.resetSetupState()
  onboardingStore.forceShowSetup()
  router.push('/')
}

function handleGuidedMode() {
  router.push('/settings/airi-card/guided')
}

function handleAdvancedMode() {
  editingCardId.value = '' // Clear editing state for new card creation
  isCardCreationDialogOpen.value = true
}

async function exportCard(cardId: string) {
  const card = await getCardWithExportedBackground(cardId)
  if (!card) {
    console.error(`Card with id ${cardId} not found`)
    return
  }

  const payload = {
    format: 'airi-card',
    version: 1,
    card,
  }

  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const safeName = (card.name || 'airi-card')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  anchor.href = url
  anchor.download = `${safeName || 'airi-card'}.json`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function buildCharaCardV2(card: AiriCard) {
  const exportedExtensions = {
    ...card.extensions,
    airi: {
      ...card.extensions?.airi,
      sillytavernCompatibilityProbe: {
        exportedBy: 'Project AIRI',
        probe: 'extensions-airi-ok',
        version: 1,
      },
    },
  }

  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: card.name || '',
      description: card.description || '',
      personality: card.personality || '',
      scenario: card.scenario || '',
      first_mes: card.greetings?.[0] || '',
      mes_example: Array.isArray(card.messageExample)
        ? card.messageExample
            .map(example => Array.isArray(example) ? example.join('\n') : String(example))
            .join('\n<START>\n')
        : '',
      creator_notes: card.notes || '',
      system_prompt: card.systemPrompt || '',
      post_history_instructions: card.postHistoryInstructions || '',
      alternate_greetings: card.greetings?.slice(1) || [],
      tags: card.tags || [],
      creator: card.creator || '',
      character_version: card.version || '',
      extensions: exportedExtensions,
      x_airi_probe: 'top-level-data-ok',
    },
  }
}

async function getCardWithExportedBackground(cardId: string): Promise<AiriCard | undefined> {
  const originalCard = cardStore.getCard(cardId)
  if (!originalCard)
    return undefined

  // Clone to avoid modifying the reactive store card directly
  const card = JSON.parse(JSON.stringify(originalCard)) as AiriCard

  // Collect and append voice profiles referencing virtual-audio-studio
  const voiceIds = new Set<string>()
  const speechConfig = card.extensions?.airi?.modules?.speech
  if (speechConfig && speechConfig.provider === 'virtual-audio-studio' && speechConfig.voice_id) {
    voiceIds.add(speechConfig.voice_id)
  }
  const assets = card.extensions?.airi?.visual_assets
  if (assets) {
    for (const key of Object.keys(assets)) {
      const concept = assets[key] as any
      if (concept.speech && concept.speech.provider === 'virtual-audio-studio' && concept.speech.voice_id) {
        voiceIds.add(concept.speech.voice_id)
      }
    }
  }

  const profiles: any[] = []
  for (const id of voiceIds) {
    const profile = speechStore.savedVoiceProfiles.find(p => p.id === id)
    if (profile) {
      profiles.push(JSON.parse(JSON.stringify(profile)))
    }
  }

  if (profiles.length > 0) {
    if (!card.extensions.airi) {
      card.extensions.airi = {} as any
    }
    card.extensions.airi.voice_profiles = profiles
  }

  const activeBackgroundId = card.extensions?.airi?.modules?.activeBackgroundId

  if (!activeBackgroundId || activeBackgroundId === 'none')
    return card

  const exportBackground = backgroundStore.entries.get(activeBackgroundId)

  if (!exportBackground)
    return card

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      resolve({
        ...card,
        extensions: {
          ...card.extensions,
          airi: {
            ...card.extensions?.airi,
            modules: {
              ...card.extensions?.airi?.modules,
              activeBackgroundId,
              // Export these for backwards compatibility with chara_card_v2 format standards
              preferredBackgroundId: activeBackgroundId,
              preferredBackgroundName: exportBackground.title || exportBackground.id,
              preferredBackgroundDataUrl: e.target?.result as string,
            },
          },
        },
      } as any)
    }
    reader.onerror = () => resolve(card)
    reader.readAsDataURL(exportBackground.blob)
  })
}

function utf8ToBase64(input: string) {
  return btoa(unescape(encodeURIComponent(input)))
}

function createCrc32Table() {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
}

const crc32Table = createCrc32Table()

function crc32(data: Uint8Array) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i += 1) {
    crc = crc32Table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function concatUint8Arrays(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function uint32ToBytes(value: number) {
  return new Uint8Array([
    (value >>> 24) & 0xFF,
    (value >>> 16) & 0xFF,
    (value >>> 8) & 0xFF,
    value & 0xFF,
  ])
}

function createPngTextChunk(keyword: string, text: string) {
  const typeBytes = new TextEncoder().encode('tEXt')
  const dataBytes = new TextEncoder().encode(`${keyword}\0${text}`)
  const crcBytes = uint32ToBytes(crc32(concatUint8Arrays([typeBytes, dataBytes])))

  return concatUint8Arrays([
    uint32ToBytes(dataBytes.length),
    typeBytes,
    dataBytes,
    crcBytes,
  ])
}

function injectPngTextChunk(pngBytes: Uint8Array, keyword: string, text: string) {
  const iendOffset = pngBytes.lastIndexOf(73) // 'I'
  if (iendOffset < 12)
    throw new Error('Invalid PNG payload')

  let insertOffset = -1
  for (let offset = 8; offset < pngBytes.length - 8;) {
    const length = (
      (pngBytes[offset] << 24)
      | (pngBytes[offset + 1] << 16)
      | (pngBytes[offset + 2] << 8)
      | pngBytes[offset + 3]
    ) >>> 0
    const type = String.fromCharCode(
      pngBytes[offset + 4],
      pngBytes[offset + 5],
      pngBytes[offset + 6],
      pngBytes[offset + 7],
    )
    if (type === 'IEND') {
      insertOffset = offset
      break
    }
    offset += 12 + length
  }

  if (insertOffset === -1)
    throw new Error('PNG is missing IEND chunk')

  const chunk = createPngTextChunk(keyword, text)
  return concatUint8Arrays([
    pngBytes.slice(0, insertOffset),
    chunk,
    pngBytes.slice(insertOffset),
  ])
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    image.src = src
  })
}

async function composeCardExportPng(previewImage: string) {
  const [preview, frame] = await Promise.all([
    loadImageElement(previewImage),
    loadImageElement(cardExportFrameUrl),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = CARD_EXPORT_FRAME.width
  canvas.height = CARD_EXPORT_FRAME.height

  const context = canvas.getContext('2d')
  if (!context)
    throw new Error('Failed to create export canvas')

  // Fit the preview to the portrait window width, anchor to the top, and crop any bottom overflow.
  const scale = CARD_EXPORT_FRAME.innerWidth / preview.naturalWidth
  const drawWidth = CARD_EXPORT_FRAME.innerWidth
  const drawHeight = preview.naturalHeight * scale

  context.save()
  context.beginPath()
  context.rect(
    CARD_EXPORT_FRAME.innerX,
    CARD_EXPORT_FRAME.innerY,
    CARD_EXPORT_FRAME.innerWidth,
    CARD_EXPORT_FRAME.innerHeight,
  )
  context.clip()
  context.drawImage(
    preview,
    CARD_EXPORT_FRAME.innerX,
    CARD_EXPORT_FRAME.innerY,
    drawWidth,
    drawHeight,
  )
  context.restore()

  context.drawImage(frame, 0, 0, CARD_EXPORT_FRAME.width, CARD_EXPORT_FRAME.height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value)
        resolve(value)
      else
        reject(new Error('Failed to encode composed PNG'))
    }, 'image/png')
  })

  return new Uint8Array(await blob.arrayBuffer())
}

async function exportCardPng(cardId: string) {
  const card = await getCardWithExportedBackground(cardId)
  if (!card) {
    console.error(`Card with id ${cardId} not found`)
    return
  }

  const displayModelId = cardStore.getCardDisplayModelId(cardId)
  await displayModelsStore.loadDisplayModelsFromIndexedDB()
  const previewModel = displayModelId ? await displayModelsStore.getDisplayModel(displayModelId) : null
  if (!previewModel)
    return

  let previewImage = previewModel.previewImage

  // If this model is currently active on stage, take a "Live Snapshot" to reflect outfits/expressions
  // We use stageModelSelected from useSettingsStageModel to check for active model
  if (displayModelId === stageModelSelected.value) {
    try {
      const modelInput = previewModel.type === 'file' ? previewModel.file : (previewModel as any).url

      if (previewModel.format === DisplayModelFormat.VRM) {
        const liveSnapshot = await loadVrmModelPreview(modelInput, activeExpressions.value)
        if (liveSnapshot)
          previewImage = liveSnapshot
      }
      else if (previewModel.format === DisplayModelFormat.Live2dZip) {
        const liveSnapshot = await loadLive2DModelPreview(modelInput, activeExpressions.value)
        if (liveSnapshot)
          previewImage = liveSnapshot
      }
    }
    catch (err) {
      console.warn('Failed to take live snapshot for card export, falling back to stale preview:', err)
    }
  }

  if (!previewImage) {
    console.error('No preview image available for card PNG export')
    return
  }

  const pngBytes = await composeCardExportPng(previewImage)
  const metadata = utf8ToBase64(JSON.stringify(buildCharaCardV2(card)))
  const encodedPng = injectPngTextChunk(pngBytes, 'chara', metadata)

  const blob = new Blob([encodedPng], { type: 'image/png' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const safeName = (card.name || 'airi-card')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  anchor.href = url
  anchor.download = `${safeName || 'airi-card'}.png`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

// Card activation
async function activateCard(id: string) {
  try {
    await cardStore.activateCard(id)
    const artistryStore = useArtistryStore()
    artistryStore.resetState()
  }
  catch (err) {
    console.error('[index.vue] Failed to activate card:', err)
  }
}

// Clear editing state when creation/edit dialog closes
watch(isCardCreationDialogOpen, (isOpen) => {
  if (!isOpen) {
    editingCardId.value = ''
  }
})

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
    <Transition name="fade-slide">
      <div v-if="isUploadZoneOpen" class="w-full">
        <InputFile v-model="inputFiles" accept="*.json,*.png" class="w-full">
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
    </Transition>

    <!-- Responsive card layout (2 columns for portrait, 4 columns for landscape) -->
    <div
      class="mt-4"
      :class="{ 'grid grid-cols-2 md:grid-cols-4 gap-4': cards.size > 0 }"
    >
      <!-- Card Items -->
      <template v-if="cards.size > 0">
        <CardListItem
          v-for="item in sortedFilteredCards"
          :id="item.id"
          :key="item.id"
          :name="item.name"
          :description="item.description"
          :is-active="item.id === activeCardId"
          :is-selected="item.id === selectedCardId && isCardDialogOpen"
          :version="getVersionNumber(item.id)"
          :consciousness-model="getModuleShortName(item.id, 'consciousness')"
          :voice-model="getModuleShortName(item.id, 'voice')"
          :display-model-id="getDisplayModelId(item.id)"
          @select="handleSelectCard(item.id)"
          @activate="activateCard(item.id)"
          @delete="confirmDelete(item.id)"
          @edit="handleEditCard(item.id)"
          @export-json="exportCard(item.id)"
          @export-png="exportCardPng(item.id)"
        />
      </template>

      <!-- No cards message -->
      <div
        v-if="cards.size === 0"
        class="col-span-full rounded-xl p-8 text-center"
        border="~ neutral-200/50 dark:neutral-700/30"
        bg="neutral-50/50 dark:neutral-900/50"
      >
        <div i-solar:card-search-broken mx-auto mb-3 text-6xl text-neutral-400 />
        <p>{{ t('settings.pages.card.no_cards') }}</p>
      </div>

      <!-- No search results -->
      <Alert v-if="searchQuery && sortedFilteredCards.length === 0" type="warning" class="col-span-full">
        <template #title>
          {{ t('settings.pages.card.no_results') }}
        </template>
        <template #content>
          {{ t('settings.pages.card.try_different_search') }}
        </template>
      </Alert>
    </div>
  </div>

  <!-- Delete confirmation dialog -->
  <DeleteCardDialog
    v-model="showDeleteConfirm"
    :card-name="cardToDelete ? cardStore.getCard(cardToDelete)?.name : ''"
    @confirm="handleDeleteConfirm"
    @cancel="cardToDelete = null"
  />

  <!-- Card detail dialog -->
  <CardDetailDialog
    v-model="isCardDialogOpen"
    :card-id="selectedCardId"
    :initial-tab="initialTab"
    @edit="handleEditCard"
  />

  <!-- Card creation/edit dialog -->
  <CardCreationDialog
    v-model="isCardCreationDialogOpen"
    :card-id="editingCardId"
    @studio="handleOpenStudio"
  />

  <!-- Mode Selector Dialog -->
  <CreateModeSelectorDialog
    v-model="isCreateModePromptOpen"
    @wizard="handleWizardMode"
    @guided="handleGuidedMode"
    @advanced="handleAdvancedMode"
  />

  <!-- Card import wizard dialog -->
  <CardImportWizard
    v-model="isImportWizardOpen"
    :card-data="importedCardData"
    @imported="handleSelectCard"
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
  <Transition name="fade-slide">
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
  </Transition>
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

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease-in-out;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
