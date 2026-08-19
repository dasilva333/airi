<script setup lang="ts">
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { useMmd } from '@proj-airi/stage-ui-mmd/stores/mmd'
import { useSpine } from '@proj-airi/stage-ui-spine'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { onClickOutside, useBroadcastChannel, useColorMode, useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, toRef, watch } from 'vue'
import { toast } from 'vue-sonner'
// Ported stores & states for Popovers

import CharacterAvatar from '../../misc/CharacterAvatar.vue'

import { useControlStripAction } from '../../../composables/use-control-strip-action'
import { CUSTOMIZER_CATALOG } from '../../../constants/control-customizer'
import { useBackgroundStore } from '../../../stores/background'
import { useDatingSimStore } from '../../../stores/dating-sim'
import { useDisplayModelsStore } from '../../../stores/display-models'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useLiveSessionStore } from '../../../stores/modules/live-session'
// ── Voice Switch Popover — state & helpers ─────────────────────────────────
import { useSpeechStore } from '../../../stores/modules/speech'
import { useProvidersStore } from '../../../stores/providers'
import { useSettings } from '../../../stores/settings'
import { useSettingsAudioDevice } from '../../../stores/settings/audio-device'
import { useSettingsControlStrip } from '../../../stores/settings/control-strip'
import { useSettingsControlsIsland } from '../../../stores/settings/controls-island'

const props = withDefaults(defineProps<{
  mode?: 'desktop' | 'mobile'
}>(), {
  mode: 'desktop',
})

const { dispatchAction } = useControlStripAction()
const settingsStore = useSettings()

console.log('[ControlStrip.vue] Setup loaded with Selfie feature support')
const colorMode = useColorMode()
const controlStripStore = useSettingsControlStrip()
const { orientation, buttons, stageEnabled, stageMateEnabled, chatOpen, captionOpen, backgroundTint, stageMode, collapsed, dockedEdge, selfieIncludeBg } = storeToRefs(controlStripStore)
const isHoveredHandle = ref(false)
const displayModelsStore = useDisplayModelsStore()
const datingSimStore = useDatingSimStore()

const autoHideMode = computed(() => dockedEdge.value !== null)

const activePopover = ref<string | null>(null)

// Auto-hide Tab hover states
const hoverExpanded = ref(false)
const hoverTimer = ref<NodeJS.Timeout | null>(null)

const isFullyExpanded = computed(() => {
  if (autoHideMode.value) {
    return !collapsed.value || hoverExpanded.value || activePopover.value !== null
  }
  return !collapsed.value
})

function onContainerMouseEnter() {
  if (autoHideMode.value && collapsed.value) {
    if (hoverTimer.value) {
      clearTimeout(hoverTimer.value)
      hoverTimer.value = null
    }
    hoverExpanded.value = true
  }
}

function onContainerMouseLeave() {
  if (autoHideMode.value && collapsed.value) {
    if (hoverTimer.value)
      clearTimeout(hoverTimer.value)
    hoverTimer.value = setTimeout(() => {
      hoverExpanded.value = false
    }, 400)
  }
}

const autoHideTabClasses = computed(() => {
  if (!autoHideMode.value || isFullyExpanded.value) {
    return ''
  }
  const edge = dockedEdge.value
  const base = 'transition-transform duration-300 ease-out'

  if (edge === 'left') {
    return `${base} rounded-r-full rounded-l-none border-l-0 -translate-x-[calc(100%-14px)]`
  }
  if (edge === 'right') {
    return `${base} rounded-l-full rounded-r-none border-r-0 translate-x-[calc(100%-14px)]`
  }
  if (edge === 'top') {
    return `${base} rounded-b-full rounded-t-none border-t-0 -translate-y-[calc(100%-14px)]`
  }
  if (edge === 'bottom') {
    return `${base} rounded-t-full rounded-b-none border-b-0 translate-y-[calc(100%-14px)]`
  }
  return ''
})

const avatarSearch = ref('')
const avatarTypeFilter = ref('all')
const currentAvatarPage = ref(1)

watch([avatarSearch, avatarTypeFilter], () => {
  currentAvatarPage.value = 1
})

const favoritesByCharacter = useLocalStorageManualReset<Record<string, string[]>>('settings/control-strip/avatar-favorites-by-char', {})

const characterFavorites = computed(() => {
  const charId = activeCardId.value || 'global'
  const ids = favoritesByCharacter.value[charId] || []
  return displayModelsStore.displayModels.filter(m => ids.includes(m.id))
})

const filteredAvatars = computed(() => {
  let list = displayModelsStore.displayModels

  // Search filter (matches name or tags partially)
  if (avatarSearch.value.trim()) {
    const query = avatarSearch.value.trim().toLowerCase()
    list = list.filter((m) => {
      const nameMatches = m.name.toLowerCase().includes(query)
      const tagMatches = m.tags && Array.isArray(m.tags) && m.tags.some(t => t.toLowerCase().includes(query))
      return nameMatches || tagMatches
    })
  }

  // Format filter
  if (avatarTypeFilter.value !== 'all') {
    const type = avatarTypeFilter.value
    list = list.filter((m) => {
      if (type === 'live2d')
        return m.format.startsWith('live2d')
      if (type === 'vrm')
        return m.format === 'vrm'
      if (type === 'spine')
        return m.format.startsWith('spine')
      if (type === 'mmd')
        return m.format === 'pmx-zip' || m.format === 'pmd' || m.format === 'pmx-directory'
      return true
    })
  }

  return list
})

const totalAvatarPages = computed(() => {
  return Math.ceil(filteredAvatars.value.length / 12) || 1
})

const paginatedAvatars = computed(() => {
  const start = (currentAvatarPage.value - 1) * 12
  return filteredAvatars.value.slice(start, start + 12)
})

function isAvatarFavorite(modelId: string) {
  const charId = activeCardId.value || 'global'
  const current = favoritesByCharacter.value[charId] || []
  return current.includes(modelId)
}

function toggleAvatarFavorite(modelId: string) {
  const charId = activeCardId.value || 'global'
  const current = favoritesByCharacter.value[charId] || []
  if (current.includes(modelId)) {
    favoritesByCharacter.value[charId] = current.filter(id => id !== modelId)
  }
  else {
    favoritesByCharacter.value[charId] = [...current, modelId]
  }
}

function selectAvatar(modelId: string) {
  settingsStore.stageModelSelected = modelId

  if (avatarApplyMode.value === 'apply' && activeCard.value && activeCardId.value) {
    const card = activeCard.value
    void cardStore.updateCard(activeCardId.value, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions?.airi,
          modules: {
            ...card.extensions?.airi?.modules,
            displayModelId: modelId,
          },
          active_state: {
            ...card.extensions?.airi?.active_state,
            displayModelId: modelId,
          },
        },
      },
    })
  }

  activePopover.value = null
}

// Filter for active buttons
const activeButtons = computed(() => {
  const isMobile = props.mode === 'mobile'
  const allCatalog = CUSTOMIZER_CATALOG.flatMap(g => g.items)
  const desktopOnlyMap = new Map(allCatalog.map(i => [i.id, !!i.desktopOnly]))

  return buttons.value.filter((btn) => {
    if (!btn.enabled)
      return false
    if (isMobile && desktopOnlyMap.get(btn.id))
      return false
    return true
  })
})

// Persistent dragging position, defaults to top-right layout bounds
const position = useLocalStorageManualReset<{ x: number, y: number }>('settings/control-strip/position', { x: 20, y: 150 })

const settingsAudioDeviceStore = useSettingsAudioDevice()
const { enabled: micEnabled } = storeToRefs(settingsAudioDeviceStore)

const liveSessionStore = useLiveSessionStore()
const { powerState } = storeToRefs(liveSessionStore)

const controlsIslandStore = useSettingsControlsIsland()
const { fadeOnHoverEnabled, alwaysOnTop } = storeToRefs(controlsIslandStore)

const cardStore = useAiriCardStore()
const { cards, activeCard, activeCardId } = storeToRefs(cardStore)

const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const { activeSpeechProvider, activeSpeechModel, activeSpeechVoiceId } = storeToRefs(speechStore)
const { outputMode: ttsOutputMode, voiceName: geminiLiveVoiceName } = storeToRefs(liveSessionStore)

// Voice Favorites stored as `provider:voiceId`
const voiceFavIds = useLocalStorage<string[]>('settings/control-strip/voice-favorites', [])

// Gemini Live Voice Choices (Google standard)
const GEMINI_LIVE_VOICES = ['Leda', 'Zephyr', 'Achernar', 'Algenib', 'Fenrir']

// Local refs for dropdowns
const selectedManualProvider = ref('')
const selectedManualModel = ref('')
const selectedManualVoiceId = ref('')
const avatarApplyMode = ref<'preview' | 'apply'>('preview')

// Initialize manual selections when popover becomes active or when stores change
watch([activeSpeechProvider, activeSpeechModel, activeSpeechVoiceId], () => {
  selectedManualProvider.value = activeSpeechProvider.value || ''
  selectedManualModel.value = activeSpeechModel.value || ''
  selectedManualVoiceId.value = activeSpeechVoiceId.value || ''
}, { immediate: true })

// If provider changes, fetch models & voices
watch(selectedManualProvider, (newProv) => {
  if (newProv && newProv !== activeSpeechProvider.value) {
    void speechStore.loadVoicesForProvider(newProv)
    void providersStore.fetchModelsForProvider(newProv)
  }
})

// Star / Unstar helper for voice favorites
function toggleVoiceFavorite(provider: string, voiceId: string) {
  const key = `${provider}:${voiceId}`
  const favs = [...voiceFavIds.value]
  const idx = favs.indexOf(key)
  if (idx !== -1) {
    favs.splice(idx, 1)
  }
  else {
    if (favs.length >= 3) {
      favs.shift() // FIFO drop
    }
    favs.push(key)
  }
  voiceFavIds.value = favs
}

// Check if a voice is favorited
function isVoiceFavorite(provider: string, voiceId: string): boolean {
  return voiceFavIds.value.includes(`${provider}:${voiceId}`)
}

// Select a voice and update stores/card
function selectVoice(provider: string, model: string, voiceId: string) {
  activeSpeechProvider.value = provider
  activeSpeechModel.value = model
  activeSpeechVoiceId.value = voiceId

  // Persist to active character card
  if (activeCard.value && activeCardId.value) {
    cardStore.updateCard(activeCardId.value, {
      extensions: {
        ...activeCard.value.extensions,
        airi: {
          ...activeCard.value.extensions.airi,
          modules: {
            ...activeCard.value.extensions.airi.modules,
            speech: {
              ...activeCard.value.extensions.airi.modules.speech,
              provider,
              model,
              voice_id: voiceId,
            },
          },
        },
      },
    } as any)
  }
}

// Layer 1: Computed global favorite voices list
const favoriteVoices = computed(() => {
  const list: Array<{ provider: string, model: string, voiceId: string, name: string }> = []
  for (const key of voiceFavIds.value) {
    const [provider, voiceId] = key.split(':')
    if (!provider || !voiceId)
      continue
    const voices = speechStore.getVoicesForProvider(provider)
    const voiceObj = voices.find(v => v.id === voiceId)
    // Find matching model ID
    const models = providersStore.getModelsForProvider(provider)
    const model = models[0]?.id || ''
    list.push({
      provider,
      model,
      voiceId,
      name: voiceObj?.name || voiceId,
    })
  }
  return list
})

// Layer 2: Scoped Concept Voices (primary) or Global Cast Fallback
const scopedCastVoices = computed(() => {
  const result: Array<{ provider: string, model: string, voiceId: string, name: string, description?: string }> = []

  // 1. Scoped card concepts
  const activeChar = activeCard.value
  if (activeChar && activeChar.extensions?.airi?.visual_assets) {
    const assets = activeChar.extensions.airi.visual_assets
    for (const [key, asset] of Object.entries(assets)) {
      const speechConfig = (asset as any).manifestation?.speech || (asset as any).speech
      if (speechConfig && speechConfig.provider && speechConfig.voice_id) {
        result.push({
          provider: speechConfig.provider,
          model: speechConfig.model || '',
          voiceId: speechConfig.voice_id,
          name: key, // Use asset key/name as initial representation
          description: asset.description || '',
        })
      }
    }
  }

  // 2. Fallback to global cast voices if no studio configurations are found in visual_assets
  if (result.length === 0) {
    const seen = new Set<string>()
    for (const [, card] of cards.value.entries()) {
      const sp = card.extensions?.airi?.modules?.speech
      if (sp && sp.provider && sp.voice_id) {
        const key = `${sp.provider}:${sp.voice_id}`
        if (!seen.has(key)) {
          seen.add(key)
          result.push({
            provider: sp.provider,
            model: sp.model || '',
            voiceId: sp.voice_id,
            name: card.name,
          })
        }
      }
    }
  }

  return result.slice(0, 6) // limit to 6 items
})

// ── Characters Popover — state & helpers ───────────────────────────────────
const characterSearch = ref('')
const characterViewMode = useLocalStorage<'list' | 'grid'>(
  'settings/control-strip/character-view-mode',
  'list',
)
// Global character favorites: max 3 IDs, FIFO pop on overflow
const charFavIds = useLocalStorage<string[]>(
  'settings/control-strip/character-favorites-global',
  [],
)

const charFavEntries = computed(() =>
  charFavIds.value
    .map(id => [id, cards.value.get(id)] as [string, typeof cards.value extends Map<string, infer V> ? V : never])
    .filter(([, card]) => !!card),
)

const sortedCharacters = computed(() => {
  const query = characterSearch.value.toLowerCase().trim()
  const entries = [...cards.value.entries()].map(([id, card], idx) => ({ id, card, idx }))
  const filtered = entries.filter(
    ({ card }) => !query || card.name.toLowerCase().includes(query),
  )
  filtered.sort((a, b) => {
    if (a.card.createdAt !== undefined && b.card.createdAt !== undefined)
      return b.card.createdAt - a.card.createdAt
    return b.idx - a.idx
  })
  return filtered.map(({ id, card }) => [id, card] as [string, typeof card])
})

function isCharFav(id: string) {
  return charFavIds.value.includes(id)
}

function toggleCharFav(id: string) {
  const favs = [...charFavIds.value]
  const idx = favs.indexOf(id)
  if (idx !== -1) {
    favs.splice(idx, 1)
  }
  else {
    if (favs.length >= 3)
      favs.shift() // FIFO: drop oldest
    favs.push(id)
  }
  charFavIds.value = favs
}

/** Stable hashed color class for initials badge */
function cardInitialColor(name: string): string {
  const palette = [
    'bg-sky-500/25 text-sky-300',
    'bg-purple-500/25 text-purple-300',
    'bg-amber-500/25 text-amber-300',
    'bg-emerald-500/25 text-emerald-300',
    'bg-rose-500/25 text-rose-300',
    'bg-indigo-500/25 text-indigo-300',
    'bg-teal-500/25 text-teal-300',
    'bg-fuchsia-500/25 text-fuchsia-300',
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return palette[Math.abs(h) % palette.length]
}

function handleEditActiveCard() {
  if (!activeCardId.value)
    return
  window.dispatchEvent(new CustomEvent('control-strip:open-settings', {
    detail: { route: `/settings/airi-card?cardId=${activeCardId.value}&edit=true` },
  }))
  activePopover.value = null
}

const modelStore = useModelStore()
const { activeExpressions } = storeToRefs(modelStore)
const vrmIdleAnimation = toRef(modelStore as any, 'vrmIdleAnimation')

const live2dStore = useLive2d()
const mmdStore = useMmd()
const spineStore = useSpine()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()

// Selfies popover state & actions
const backgroundStore = useBackgroundStore()
const selfies = computed(() => {
  if (!activeCardId.value)
    return []
  return backgroundStore.getCharacterJournalEntries(activeCardId.value)
    .filter(e => e.type === 'selfie')
})

const selfieCountdown = ref<number | null>(null)
const { post: postCapture } = useBroadcastChannel<{ characterId: string, includeBg: boolean, channelId?: string }, { characterId: string, includeBg: boolean, channelId?: string }>({ name: 'airi:stage-capture' })

function triggerSelfie() {
  if (!activeCardId.value) {
    console.warn('[ControlStrip] Cannot trigger selfie: no activeCardId')
    return
  }
  if (selfieCountdown.value !== null)
    return

  console.log('[ControlStrip] Starting selfie countdown for character:', activeCardId.value)
  selfieCountdown.value = 3
  const interval = setInterval(() => {
    if (selfieCountdown.value === null) {
      clearInterval(interval)
      return
    }
    selfieCountdown.value--
    console.log('[ControlStrip] Selfie countdown:', selfieCountdown.value)
    if (selfieCountdown.value === 0) {
      clearInterval(interval)
      selfieCountdown.value = null
      // Wait for the UI/viewfinder overlay to fully hide before triggering capture
      setTimeout(() => {
        console.log('[ControlStrip] Broadcast stage capture request for character:', activeCardId.value, 'includeBg:', selfieIncludeBg.value)
        postCapture({ characterId: activeCardId.value, includeBg: selfieIncludeBg.value })
      }, 500)
    }
  }, 1000)
}

function selectSelfieBackground(bgId: string) {
  if (activeCard.value && activeCardId.value) {
    cardStore.updateCard(activeCardId.value, {
      extensions: {
        ...activeCard.value.extensions,
        airi: {
          ...activeCard.value.extensions.airi,
          modules: {
            ...activeCard.value.extensions.airi.modules,
            activeBackgroundId: bgId,
          },
        },
      },
    } as any)
  }
}

const { post: postViewfinderState } = useBroadcastChannel<{ active: boolean, countdown: number | null }, { active: boolean, countdown: number | null }>({ name: 'airi:stage-selfie-viewfinder' })

watch([activePopover, selfieCountdown], ([popover, countdown]) => {
  postViewfinderState({
    active: popover === 'actor-selfies',
    countdown,
  })
}, { immediate: true })

const macaronTab = ref<'featured' | 'custom'>('featured')
const selectedMacaronPreset = ref('strawberry_cream')
const customShell = ref('pink')
const customWhip = ref('berry')
const customHeart = ref('pink')

const FEATURED_MACARONS = [
  { id: 'strawberry_cream', name: 'Strawberry Cream', emoji: '🍓', shell: 'pink', whip: 'berry', heart: 'pink' },
  { id: 'matcha_classic', name: 'Matcha Classic', emoji: '🍵', shell: 'green', whip: 'matcha', heart: 'green' },
  { id: 'blueberry_whip', name: 'Blueberry Whip', emoji: '🫐', shell: 'blue', whip: 'berry', heart: 'purple' },
  { id: 'mint_choco', name: 'Mint Choco', emoji: '🍫', shell: 'blue', whip: 'chocolate', heart: 'brawn' },
  { id: 'lemon_custard', name: 'Lemon Custard', emoji: '🍋', shell: 'yellow', whip: 'milk', heart: 'yellow' },
  { id: 'lavender_berry', name: 'Lavender Berry', emoji: '💜', shell: 'purple', whip: 'berry', heart: 'purple' },
  { id: 'mocha_caramel', name: 'Mocha Caramel', emoji: '☕', shell: 'brawn', whip: 'chocolate', heart: 'brawn' },
  { id: 'vanilla_strawberry', name: 'Vanilla Strawberry', emoji: '🍦', shell: 'pink', whip: 'milk', heart: 'blue' },
  { id: 'chocolate_berry', name: 'Chocolate Berry', emoji: '🍩', shell: 'pink', whip: 'chocolate', heart: 'brawn' },
] as const

const SHELL_OPTIONS = [
  { value: 'pink', label: 'Pastel Pink' },
  { value: 'green', label: 'Green Tea' },
  { value: 'blue', label: 'Ice Blue' },
  { value: 'yellow', label: 'Lemon Yellow' },
  { value: 'purple', label: 'Soft Purple' },
  { value: 'brawn', label: 'Roast Brown' },
  { value: 'orange', label: 'Peach Orange' },
]

const WHIP_OPTIONS = [
  { value: 'berry', label: 'Berry Cream' },
  { value: 'matcha', label: 'Matcha Cream' },
  { value: 'milk', label: 'Fresh Milk' },
  { value: 'chocolate', label: 'Rich Cocoa' },
  { value: 'strawberry', label: 'Strawberry Puree' },
]

const HEART_OPTIONS = [
  { value: 'pink', label: 'Pink Heart' },
  { value: 'green', label: 'Green Heart' },
  { value: 'blue', label: 'Blue Heart' },
  { value: 'yellow', label: 'Yellow Heart' },
  { value: 'purple', label: 'Purple Heart' },
  { value: 'brawn', label: 'Chocolate Heart' },
  { value: 'orange', label: 'Caramel Heart' },
]

async function applyMacaron(shell: string, whip: string, heart: string, presetId?: string) {
  if (presetId) {
    selectedMacaronPreset.value = presetId
  }
  else {
    selectedMacaronPreset.value = ''
  }
  if (isElectron.value) {
    try {
      const { useElectronEventaInvoke } = await import('@proj-airi/electron-vueuse')
      const { electronStageMateSetPropMacaron } = await import('@proj-airi/stage-shared')
      const setMacaron = useElectronEventaInvoke(electronStageMateSetPropMacaron)
      await setMacaron({ shell, whip, heart })
      toast.success(`Applied floatie style: ${shell} / ${whip}`)
    }
    catch (err) {
      console.warn('Failed to dispatch macaron materials:', err)
    }
  }
}

const hoveredButtonId = ref<string | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const wardrobeFilter = ref<'all' | 'base' | 'overlay'>('all')

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)

const activeMonitor = ref(1)
const selectedAlignment = ref('center')
const monitorCount = ref(1)

onMounted(async () => {
  void displayModelsStore.loadDisplayModelsFromIndexedDB(true)
  if (isElectron.value && (window as any).electron?.ipcRenderer) {
    try {
      monitorCount.value = await (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:windows:get-monitor-count')
    }
    catch (err) {
      console.warn('Failed to get monitor count:', err)
    }
  }
})

function applySizePreset(
  target: 'actor' | 'chat',
  preset?: string,
  alignment?: string,
) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:apply-size-preset', {
      detail: {
        target,
        preset,
        monitorIndex: monitorCount.value > 1 ? activeMonitor.value : undefined,
        alignment,
      },
    }))
  }
  if (preset) {
    activePopover.value = null
  }
}

function toggleDatingSimMode() {
  datingSimStore.toggleDatingSim()
}

function selectMonitor(target: 'actor' | 'chat', m: number) {
  activeMonitor.value = m
  applySizePreset(target, undefined, selectedAlignment.value)
}

onClickOutside(popoverRef, (event) => {
  const target = event.target as HTMLElement
  if (target && target.closest('.control-strip-btn')) {
    return
  }
  activePopover.value = null
})

const PRESETS = [
  { name: 'mini', icon: 'i-solar:minimize-square-3-linear', label: 'Mini' },
  { name: 'medium', icon: 'i-solar:maximize-square-2-linear', label: 'Medium' },
  { name: 'large', icon: 'i-solar:maximize-square-3-linear', label: 'Large' },
  { name: 'full', icon: 'i-solar:screencast-linear', label: 'Full' },
] as const

function openPresetPopover(btnId: string) {
  if (btnId === 'stage') {
    activePopover.value = 'stage-preset'
  }
  else if (btnId === 'chat') {
    activePopover.value = 'chat-preset'
  }
  else {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('control-strip:open-customizer'))
    }
  }
}

const popoverPlacement = computed(() => {
  if (props.mode === 'mobile') {
    return dockedEdge.value === 'left' ? 'right' : 'left'
  }
  if (typeof window === 'undefined')
    return 'bottom'

  const screenX = window.screenX || 0
  const screenY = window.screenY || 0
  const screenWidth = window.screen?.width || window.innerWidth
  const screenHeight = window.screen?.height || window.innerHeight

  if (orientation.value === 'vertical') {
    return screenX < screenWidth / 2 ? 'right' : 'left'
  }
  else {
    return screenY < screenHeight / 2 ? 'bottom' : 'top'
  }
})

const stripLength = computed(() => {
  if (!isFullyExpanded.value) {
    return 52
  }
  const N = activeButtons.value.length
  return N === 0 ? 52 : 52 + 44 * N
})

const containerStyle = computed(() => {
  if (props.mode === 'mobile') {
    const styles: Record<string, string> = {
      top: '50%',
      transform: 'translateY(-50%)',
    }
    if (dockedEdge.value === 'left') {
      styles.left = '0px'
    }
    else {
      styles.right = '0px'
    }
    return styles
  }
  if (isElectron.value) {
    const styles: Record<string, string> = {
      backgroundColor: backgroundTint.value || '',
      opacity: '0.85',
    }
    if (activePopover.value) {
      if (orientation.value === 'vertical') {
        const windowHeight = Math.max(500, stripLength.value)
        styles.top = `${(windowHeight - stripLength.value) / 2}px`
        if (popoverPlacement.value === 'right') {
          styles.left = '0px'
        }
        else {
          styles.left = '276px'
        }
      }
      else {
        const windowWidth = Math.max(500, stripLength.value)
        styles.left = `${(windowWidth - stripLength.value) / 2}px`
        if (popoverPlacement.value === 'bottom') {
          styles.top = '0px'
        }
        else {
          styles.top = '452px'
        }
      }
    }
    else {
      styles.left = '0px'
      styles.top = '0px'
    }
    return styles
  }
  else {
    return {
      top: `${position.value.y}px`,
      right: `${position.value.x}px`,
      backgroundColor: backgroundTint.value || '',
      opacity: '0.85',
    }
  }
})

watch(activePopover, (newVal) => {
  if (newVal === 'actor-avatars') {
    void displayModelsStore.loadDisplayModelsFromIndexedDB(true)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:popover-changed', {
      detail: {
        activePopover: newVal,
        placement: popoverPlacement.value,
      },
    }))
  }
})

const ACT_EMOTIONS = [
  { key: 'happy', emoji: '😊' },
  { key: 'sad', emoji: '😢' },
  { key: 'angry', emoji: '😠' },
  { key: 'surprised', emoji: '😲' },
  { key: 'neutral', emoji: '😐' },
  { key: 'think', emoji: '🤔' },
  { key: 'cool', emoji: '😎' },
] as const

const wardrobeItems = computed(() => {
  const outfits = activeCard.value?.extensions?.airi?.outfits || []
  return outfits.filter(item => wardrobeFilter.value === 'all' || item.type === wardrobeFilter.value)
})

function isOutfitActive(outfitId: string) {
  const outfit = activeCard.value?.extensions?.airi?.outfits?.find(o => o.id === outfitId)
  if (!outfit || !outfit.expressions)
    return false
  return Object.entries(outfit.expressions).every(([name, weight]) => {
    return Math.abs((activeExpressions.value[name] || 0) - weight) < 0.05
  })
}

const availableMotions = computed(() => {
  const list = []

  // Prepend None option
  list.push({
    key: '',
    label: 'None',
  })

  if (settingsStore.stageModelRenderer === 'vrm') {
    list.push(...customVrmAnimationsStore.animationKeys.map(key => ({
      key,
      label: customVrmAnimationsStore.animationLabelByKey[key] || key,
    })))
  }
  else if (settingsStore.stageModelRenderer === 'live2d') {
    list.push(...(live2dStore.availableMotions || []).map(motion => ({
      key: `${motion.motionName}:${motion.motionIndex}`,
      label: `${motion.motionName} (${motion.motionIndex})`,
      raw: motion,
    })))
  }
  else if (settingsStore.stageModelRenderer === 'mmd') {
    list.push(...(mmdStore.availableMotions || []).map(motion => ({
      key: motion,
      label: motion,
    })))
  }
  else if (settingsStore.stageModelRenderer === 'spine') {
    list.push(...(spineStore.availableAnimations || []).map(animation => ({
      key: animation.name,
      label: animation.name,
    })))
  }

  return list
})

function isMotionActive(motion: any) {
  if (motion.key === '') {
    if (settingsStore.stageModelRenderer === 'vrm') {
      return !vrmIdleAnimation.value
    }
    if (settingsStore.stageModelRenderer === 'live2d') {
      const modelId = activeCardId.value || 'global'
      const savedPath = localStorage.getItem(`live2d-${modelId}-selected-motion`)
      return !savedPath
    }
    if (settingsStore.stageModelRenderer === 'mmd') {
      return !mmdStore.currentMotion
    }
    if (settingsStore.stageModelRenderer === 'spine') {
      return !spineStore.currentAnimation?.name
    }
    return false
  }

  if (settingsStore.stageModelRenderer === 'vrm') {
    return vrmIdleAnimation.value === motion.key
  }
  if (settingsStore.stageModelRenderer === 'live2d') {
    return live2dStore.currentMotion?.group === motion.raw?.motionName && live2dStore.currentMotion?.index === motion.raw?.motionIndex
  }
  if (settingsStore.stageModelRenderer === 'mmd') {
    return mmdStore.currentMotion === motion.key
  }
  if (settingsStore.stageModelRenderer === 'spine') {
    return spineStore.currentAnimation?.name === motion.key
  }
  return false
}

const availableAllExpressions = computed(() => {
  if (settingsStore.stageModelRenderer === 'vrm') {
    return modelStore.availableExpressions.map(name => ({
      name,
      isActive: (modelStore.activeExpressions[name] || 0) > 0,
    }))
  }
  if (settingsStore.stageModelRenderer === 'live2d') {
    return (live2dStore.availableExpressions || []).map(exp => ({
      name: exp.name,
      isActive: (live2dStore.activeExpressions[exp.fileName] || 0) > 0,
    }))
  }
  return []
})

function playMotion(motion: any) {
  if (motion.key === '') {
    if (settingsStore.stageModelRenderer === 'vrm') {
      vrmIdleAnimation.value = ''
      if (activeCardId.value && activeCard.value) {
        const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
        const next = current.filter(key => key.includes(':'))
        cardStore.updateCard(activeCardId.value, {
          extensions: {
            ...activeCard.value.extensions,
            airi: {
              ...activeCard.value.extensions.airi,
              acting: {
                ...activeCard.value.extensions.airi.acting,
                idleAnimations: next,
              },
            },
          },
        })
      }
    }
    else if (settingsStore.stageModelRenderer === 'live2d') {
      const modelId = activeCardId.value || 'global'
      localStorage.removeItem(`live2d-${modelId}-selected-motion`)
      localStorage.removeItem(`live2d-${modelId}-selected-motion-name`)
      localStorage.removeItem(`live2d-${modelId}-selected-motion-group`)
      localStorage.removeItem(`live2d-${modelId}-selected-motion-index`)
      live2dStore.currentMotion = { group: 'Idle', index: 0 }
    }
    else if (settingsStore.stageModelRenderer === 'mmd') {
      mmdStore.currentMotion = ''
      if (activeCardId.value && activeCard.value) {
        const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
        const next = current.filter(key => !key.startsWith('mmd:'))
        cardStore.updateCard(activeCardId.value, {
          extensions: {
            ...activeCard.value.extensions,
            airi: {
              ...activeCard.value.extensions.airi,
              acting: {
                ...activeCard.value.extensions.airi.acting,
                idleAnimations: next,
              },
            },
          },
        })
      }
    }
    else if (settingsStore.stageModelRenderer === 'spine') {
      spineStore.currentAnimation = { ...spineStore.currentAnimation, name: '' }
      if (activeCardId.value && activeCard.value) {
        const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
        const next = current.filter(key => !key.startsWith('spine:'))
        cardStore.updateCard(activeCardId.value, {
          extensions: {
            ...activeCard.value.extensions,
            airi: {
              ...activeCard.value.extensions.airi,
              acting: {
                ...activeCard.value.extensions.airi.acting,
                idleAnimations: next,
              },
            },
          },
        })
      }
    }
    return
  }

  if (settingsStore.stageModelRenderer === 'vrm') {
    vrmIdleAnimation.value = motion.key
  }
  else if (settingsStore.stageModelRenderer === 'live2d') {
    live2dStore.currentMotion = {
      group: motion.raw.motionName,
      index: motion.raw.motionIndex,
    }
    const modelId = activeCardId.value || 'global'
    localStorage.setItem(`live2d-${modelId}-selected-motion`, motion.raw.displayPath)
    localStorage.setItem(`live2d-${modelId}-selected-motion-name`, motion.raw.name)
    localStorage.setItem(`live2d-${modelId}-selected-motion-group`, motion.raw.group)
    localStorage.setItem(`live2d-${modelId}-selected-motion-index`, motion.raw.index != null ? String(motion.raw.index) : '0')
  }
  else if (settingsStore.stageModelRenderer === 'mmd') {
    mmdStore.currentMotion = motion.key
  }
  else if (settingsStore.stageModelRenderer === 'spine') {
    spineStore.currentAnimation = { ...spineStore.currentAnimation, name: motion.key }
  }
}

function triggerEmotion(emotion: string) {
  if (typeof (window as any).testEmotion === 'function') {
    ;(window as any).testEmotion(emotion)
  }
}

function triggerRandomEmotion() {
  const random = ACT_EMOTIONS[Math.floor(Math.random() * ACT_EMOTIONS.length)]
  triggerEmotion(random.key)
}

function triggerExpression(name: string) {
  if (settingsStore.stageModelRenderer === 'vrm') {
    const current = modelStore.activeExpressions[name] || 0
    const next = current > 0 ? 0 : 1
    modelStore.activeExpressions = { ...modelStore.activeExpressions, [name]: next }
  }
  else if (settingsStore.stageModelRenderer === 'live2d') {
    live2dStore.triggerEmotion(name)
  }
}

function triggerWardrobeItem(id: string) {
  cardStore.applyOutfit(id)
}

function handleViewGallery() {
  if (activeCardId.value) {
    window.dispatchEvent(new CustomEvent('control-strip:open-settings', {
      detail: { route: `/settings/airi-card?cardId=${activeCardId.value}&tab=gallery` },
    }))
    activePopover.value = null
  }
}

function handleManageProfiles() {
  window.dispatchEvent(new CustomEvent('control-strip:open-settings', {
    detail: { route: '/settings/airi-card' },
  }))
  activePopover.value = null
}

const geminiDotClasses = computed(() => {
  if (powerState.value === 'busy') {
    return 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse'
  }
  if (powerState.value === 'active') {
    return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
  }
  if (powerState.value === 'connecting') {
    return 'bg-sky-400 animate-pulse'
  }
  if (powerState.value === 'ambient') {
    return 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]'
  }
  return 'bg-neutral-400/50'
})

// Dragging states
const isDragging = ref(false)
let isMouseDown = false
let startMouseX = 0
let startMouseY = 0
let startPosX = 0
let startPosY = 0
let dragDistance = 0
let isTouchEventState = false
let startTouchScreenX = 0
let startTouchScreenY = 0
let startWindowBounds: { x: number, y: number, width: number, height: number } | null = null

async function onDragStart(e: MouseEvent | TouchEvent) {
  if (props.mode === 'mobile') {
    collapsed.value = !collapsed.value
    return
  }

  if ('button' in e && e.button !== 0)
    return

  isMouseDown = true
  dragDistance = 0
  isTouchEventState = 'touches' in e

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  startMouseX = clientX
  startMouseY = clientY
  startPosX = position.value.x
  startPosY = position.value.y

  if (isTouchEventState && isElectron.value) {
    const touch = (e as TouchEvent).touches[0]
    startTouchScreenX = touch.screenX
    startTouchScreenY = touch.screenY
    try {
      startWindowBounds = await (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:window:get-bounds')
    }
    catch (err) {
      console.error('Failed to get bounds for touch drag:', err)
      startWindowBounds = null
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', onDragging)
    window.addEventListener('mouseup', onDragEnd)
    window.addEventListener('touchmove', onDragging, { passive: false })
    window.addEventListener('touchend', onDragEnd)
  }
}

async function onDragging(e: MouseEvent | TouchEvent) {
  if (!isMouseDown)
    return

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  const diffX = clientX - startMouseX
  const diffY = clientY - startMouseY
  dragDistance = Math.sqrt(diffX * diffX + diffY * diffY)

  if (dragDistance >= 4) {
    isDragging.value = true
  }

  if (isElectron.value) {
    if (isTouchEventState) {
      if (dragDistance >= 4 && startWindowBounds) {
        const touch = (e as TouchEvent).touches[0]
        const deltaX = touch.screenX - startTouchScreenX
        const deltaY = touch.screenY - startTouchScreenY
        try {
          await (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:window:set-bounds', [{
            x: Math.round(startWindowBounds.x + deltaX),
            y: Math.round(startWindowBounds.y + deltaY),
            width: startWindowBounds.width,
            height: startWindowBounds.height,
          }])
        }
        catch (err) {
          console.error('Failed to set bounds on touch drag:', err)
        }
      }
    }
    else {
      if (dragDistance >= 4) {
        cleanupDragListeners()
        isMouseDown = false
        isDragging.value = false
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('control-strip:drag-start'))
        }
      }
    }
  }
  else {
    if (isDragging.value) {
      const deltaX = startMouseX - clientX
      const deltaY = startMouseY - clientY
      position.value.x = Math.max(10, Math.min(window.innerWidth - 72, startPosX + deltaX))
      position.value.y = Math.max(10, Math.min(window.innerHeight - 300, startPosY + deltaY))
    }
  }
}

let clickTimer: NodeJS.Timeout | null = null

function handlePerpendicularClick() {
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
    toggleOrientation()
  }
  else {
    clickTimer = setTimeout(() => {
      clickTimer = null
      collapsed.value = !collapsed.value
    }, 250)
  }
}

function onDragEnd() {
  const wasDown = isMouseDown
  const wasDragging = isDragging.value
  cleanupDragListeners()
  isMouseDown = false
  isDragging.value = false
  isTouchEventState = false
  startWindowBounds = null

  if (wasDown && !wasDragging) {
    handlePerpendicularClick()
  }
}

function cleanupDragListeners() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('mousemove', onDragging)
    window.removeEventListener('mouseup', onDragEnd)
    window.removeEventListener('touchmove', onDragging)
    window.removeEventListener('touchend', onDragEnd)
  }
}

function handleAction(actionId: string) {
  console.info(`[Control Strip] Button clicked: "${actionId}".`)

  const menuButtons = ['actor-characters', 'actor-avatars', 'actor-wardrobe', 'actor-expressions', 'actor-motions', 'actor-all-emotions', 'actor-selfies', 'actor-macaron', 'gemini-voice']
  if (menuButtons.includes(actionId)) {
    if (activePopover.value === actionId) {
      activePopover.value = null
    }
    else {
      activePopover.value = actionId
    }
    return
  }

  activePopover.value = null
  dispatchAction(actionId)
}

function handleRightClick(e: MouseEvent) {
  e.preventDefault()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:open-customizer'))
  }
}

function toggleOrientation() {
  if (props.mode === 'mobile')
    return
  controlStripStore.toggleOrientation()
}

function getButtonIcon(btnId: string, defaultIcon: string): string {
  if (btnId === 'viewport-cycle-modes') {
    return 'i-solar:cursor-bold-duotone'
  }
  if (btnId === 'theme-mode') {
    return colorMode.value === 'light' ? 'i-solar:moon-linear' : 'i-solar:sun-linear'
  }
  if (btnId === 'caption-docking') {
    return settingsStore.captionDocking === 'top' ? 'i-solar:align-top-line-duotone' : 'i-solar:align-bottom-line-duotone'
  }
  if (btnId === 'caption-layout-mode') {
    return settingsStore.captionLayoutMode === 'multi' ? 'i-solar:layers-linear' : 'i-solar:window-frame-linear'
  }
  return defaultIcon
}

function getButtonIconColor(btnId: string): string {
  if (btnId === 'viewport-cycle-modes') {
    const mode = settingsStore.controlStripInteractionMode
    if (mode === 'tactile')
      return 'text-rose-500 dark:text-rose-400'
    if (mode === 'drag')
      return 'text-orange-500 dark:text-orange-400'
    if (mode === 'positioning')
      return 'text-emerald-500 dark:text-emerald-400'
    if (mode === 'orbit')
      return 'text-indigo-500 dark:text-indigo-400'
  }
  return ''
}

function getButtonTitle(btnId: string, defaultLabel: string): string {
  if (btnId === 'viewport-cycle-modes') {
    const mode = settingsStore.controlStripInteractionMode
    const modeLabels: Record<string, string> = {
      tactile: 'Tactile (Rose)',
      drag: 'Drag (Orange)',
      positioning: 'Positioning (Emerald)',
      orbit: 'Orbit (Indigo)',
    }
    return `Cycle Viewport Modes: ${modeLabels[mode] || 'Tactile'}`
  }
  if (btnId === 'chat') {
    return `Chat Toggle: ${chatOpen.value ? 'Open (Green)' : 'Closed (Red)'}`
  }
  if (btnId === 'stage') {
    if (controlStripStore.stageDisabled) {
      return 'Actor Stage: Disabled (--disable-webgl-stage)'
    }
    return `Actor Stage: ${stageEnabled.value ? 'Visible (Green)' : 'Hidden (Red)'}`
  }
  if (btnId === 'stage-mate') {
    return `Stage Mate: ${stageMateEnabled.value ? 'Active (Green)' : 'Disabled (Red)'}`
  }
  if (btnId === 'mic') {
    return `Microphone: ${micEnabled.value ? 'Active (Green)' : 'Muted (Red)'}`
  }
  if (btnId === 'caption') {
    return `Captions: ${captionOpen.value ? 'Active (Green)' : 'Disabled (Red)'}`
  }
  if (btnId === 'gemini-session') {
    const stateLabels: Record<string, string> = {
      off: 'Disconnected (Gray)',
      connecting: 'Connecting (Sky Blue)',
      active: 'Listening / Idle (Red)',
      busy: 'Transmitting / Speaking (Purple)',
      ambient: 'Witness Mode Active (Amber)',
    }
    return `Speech Session: ${stateLabels[powerState.value] || 'Disconnected (Gray)'}`
  }
  if (btnId === 'caption-docking') {
    const labels: Record<string, string> = {
      none: 'Caption Docking: NONE',
      bottom: 'Caption Docking: BOTTOM',
      top: 'Caption Docking: TOP',
      head: 'Caption Docking: HEAD',
    }
    return labels[settingsStore.captionDocking ?? 'none'] ?? 'Caption Docking: NONE'
  }
  if (btnId === 'caption-layout-mode') {
    return `Caption Layout: ${settingsStore.captionLayoutMode === 'multi' ? 'Multi-line History (Indigo)' : 'Standard Bubble (Teal)'}`
  }
  if (btnId === 'caption-sync-position') {
    return `Caption Sync Position: ${settingsStore.captionFollowStagePosition ? 'ON (Green)' : 'OFF (Red)'}`
  }
  if (btnId === 'caption-sync-visibility') {
    return `Caption Sync Visibility: ${settingsStore.captionFollowStageVisibility ? 'ON (Green)' : 'OFF (Red)'}`
  }
  if (btnId === 'head-tethered-caption') {
    return `Head-Tethered Caption: ${settingsStore.headTetheredCaptionEnabled ? 'ON (Green)' : 'OFF (Red)'}`
  }
  return defaultLabel
}

function getShortLabel(btnId: string): string {
  const map: Record<string, string> = {
    'chat': 'Chat',
    'mic': 'Mic',
    'stage': 'Stage',
    'stage-mate': 'Mate',
    'caption': 'CC',
    'gemini-session': 'Live',
    'settings': 'Set',
    'layout': 'Edit',
    'viewport-auto-hide': 'Hide',
    'always-on-top': 'Pin',
    'viewport-tactile': 'Touch',
    'viewport-drag': 'Drag',
    'viewport-positioning': 'Pos',
    'viewport-orbit': 'Orbit',
    'viewport-cycle-modes': settingsStore.controlStripInteractionMode === 'tactile'
      ? 'Tact'
      : settingsStore.controlStripInteractionMode === 'drag'
        ? 'Drag'
        : settingsStore.controlStripInteractionMode === 'positioning'
          ? 'Pos'
          : settingsStore.controlStripInteractionMode === 'orbit' ? 'Orbt' : 'Modes',
    'viewport-reset-coordinates': 'Reset',
    'actor-idle-animations': 'Anim',
    'actor-characters': 'Char',
    'actor-avatars': 'Avtr',
    'actor-wardrobe': 'Wear',
    'actor-expressions': 'Expr',
    'actor-motions': 'Move',
    'actor-all-emotions': 'Mood',
    'actor-selfies': 'Self',
    'actor-macaron': 'Snack',
    'theme-mode': 'Color',
    'caption-docking': settingsStore.captionDocking === 'none'
      ? 'None'
      : settingsStore.captionDocking === 'bottom'
        ? 'Bot'
        : settingsStore.captionDocking === 'top'
          ? 'Top'
          : settingsStore.captionDocking === 'head' ? 'Head' : 'Dock',
    'caption-layout-mode': 'Rows',
    'caption-sync-position': 'Pos↔',
    'caption-sync-visibility': 'Vis↔',
    'head-tethered-caption': 'HeadCC',
    'caption-theme-mode': 'Theme',
    'caption-opacity': 'Opac',
    'exit-app': 'Quit',
  }
  return map[btnId] || btnId.substring(0, 4)
}
</script>

<template>
  <div
    :class="[
      'absolute pointer-events-auto select-none',
      'bg-white/95 dark:bg-neutral-900/85',
      'backdrop-blur-xl border border-neutral-300/80 dark:border-neutral-800/80',
      'shadow-2xl shadow-black/10 rounded-full',
      isDragging ? 'scale-102 border-primary-500/30 shadow-primary-500/5' : '',
      orientation === 'vertical' ? 'flex flex-col items-center py-2 px-1 gap-2 w-12' : 'flex flex-row items-center px-2 py-1 gap-2 h-12',
      autoHideTabClasses,
    ]"
    :style="containerStyle"
    @contextmenu="handleRightClick"
    @mouseenter="onContainerMouseEnter"
    @mouseleave="onContainerMouseLeave"
  >
    <!-- AUTO-HIDE TAB HANDLE -->
    <div
      v-if="autoHideMode && !isFullyExpanded"
      class="h-9 w-9 flex cursor-pointer items-center justify-center text-neutral-800 dark:text-neutral-100"
      title="Click to Pin Control Strip"
      @click="collapsed = false"
    >
      <span
        :class="[
          'text-2xl transition-all duration-200',
          (dockedEdge === 'left' || dockedEdge === 'right') ? 'i-solar:double-alt-arrow-right-linear' : 'i-solar:double-alt-arrow-down-linear',
          dockedEdge === 'right' ? 'rotate-180' : '',
          dockedEdge === 'bottom' ? 'rotate-180' : '',
        ]"
      />
    </div>

    <!-- TOP/LEFT ENDCAP: Perpendicular Drag & Layout Handle -->
    <button
      v-else
      :class="[
        'relative flex items-center justify-center overflow-hidden',
        'w-9 h-9 rounded-full',
        'bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/20',
        'border border-neutral-200 dark:border-white/10',
        'text-neutral-800 dark:text-neutral-100',
        'transition-all duration-200',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
      ]"
      title="Drag to Reposition | Click to Collapse/Expand | Double Click to Toggle Layout"
      @mousedown="onDragStart"
      @touchstart="onDragStart"
      @mouseenter="isHoveredHandle = true"
      @mouseleave="isHoveredHandle = false"
      @click.stop
    >
      <!-- Icon fades out on hover -->
      <span
        :class="[
          'text-lg absolute transition-all duration-200 ease-in-out',
          collapsed ? 'i-ph:dots-six-bold scale-110' : (orientation === 'vertical' ? 'i-solar:double-alt-arrow-right-linear' : 'i-solar:double-alt-arrow-down-linear'),
          isHoveredHandle ? 'opacity-0 scale-75' : 'opacity-100 scale-100',
        ]"
      />

      <!-- Short label fades in on hover -->
      <span
        :class="[
          'text-[9px] font-extrabold uppercase tracking-wider text-center px-0.5 leading-none absolute transition-all duration-200 ease-in-out',
          isHoveredHandle ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
        ]"
      >
        {{ collapsed ? 'Show' : 'Hide' }}
      </span>
    </button>

    <!-- CORE INTERACTIVE BUTTONS -->
    <div
      v-if="isFullyExpanded"
      :class="[
        orientation === 'vertical' ? 'flex flex-col items-center gap-2' : 'flex flex-row items-center gap-2',
      ]"
    >
      <button
        v-for="btn in activeButtons"
        :key="btn.id"
        :class="[
          'relative flex items-center justify-center overflow-hidden',
          'w-9 h-9 rounded-full border border-neutral-200 dark:border-white/10',
          'bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/20 text-neutral-800 dark:text-neutral-100',
          'transition-all duration-200 hover:scale-105 cursor-pointer control-strip-btn shadow-sm',
          btn.id === 'stage' && controlStripStore.stageDisabled ? 'opacity-40 grayscale cursor-not-allowed' : '',
        ]"
        :title="getButtonTitle(btn.id, btn.label)"
        @mouseenter="hoveredButtonId = btn.id"
        @mouseleave="hoveredButtonId = null"
        @click="handleAction(btn.id)"
        @contextmenu.prevent.stop="openPresetPopover(btn.id)"
      >
        <!-- Icon fades out on hover -->
        <span
          :class="[
            getButtonIcon(btn.id, btn.icon),
            getButtonIconColor(btn.id),
            'text-lg absolute transition-all duration-200 ease-in-out',
            hoveredButtonId === btn.id ? 'opacity-0 scale-75' : 'opacity-100 scale-100',
          ]"
        />

        <!-- Short label fades in on hover -->
        <span
          :class="[
            'text-[9px] font-extrabold uppercase tracking-wider text-center px-0.5 leading-none absolute transition-all duration-200 ease-in-out',
            hoveredButtonId === btn.id ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
          ]"
        >
          {{ getShortLabel(btn.id) }}
        </span>

        <!-- Status dot badge for Stage (Actor Stage) -->
        <span
          v-if="btn.id === 'stage'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            controlStripStore.stageDisabled ? 'bg-neutral-400 dark:bg-neutral-600' : stageEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Stage Mate -->
        <span
          v-if="btn.id === 'stage-mate'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMateEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Chat (Chat Toggle) -->
        <span
          v-if="btn.id === 'chat'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            chatOpen ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Microphone (Microphone Toggle) -->
        <span
          v-if="btn.id === 'mic'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            micEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Captions (CC Toggle) -->
        <span
          v-if="btn.id === 'caption'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            captionOpen ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Gemini Session (Sparkle Toggle) -->
        <span
          v-if="btn.id === 'gemini-session'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-all duration-300',
            geminiDotClasses,
          ]"
        />

        <!-- Status dot badge for Auto-Hide toggle -->
        <span
          v-if="btn.id === 'viewport-auto-hide'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            fadeOnHoverEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Always-on-Top toggle -->
        <span
          v-if="btn.id === 'always-on-top'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            alwaysOnTop ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Tactile Mode -->
        <span
          v-if="btn.id === 'viewport-tactile'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMode === 'tactileMode' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Drag Mode -->
        <span
          v-if="btn.id === 'viewport-drag'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMode === 'dragMode' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Positioning Mode -->
        <span
          v-if="btn.id === 'viewport-positioning'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMode === 'positionMode' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Orbit Mode -->
        <span
          v-if="btn.id === 'viewport-orbit'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMode === 'orbitMode' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for caption-sync-position -->
        <span
          v-if="btn.id === 'caption-sync-position'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            settingsStore.captionFollowStagePosition ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for caption-sync-visibility -->
        <span
          v-if="btn.id === 'caption-sync-visibility'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            settingsStore.captionFollowStageVisibility ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for head-tethered-caption -->
        <span
          v-if="btn.id === 'head-tethered-caption'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            settingsStore.headTetheredCaptionEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for theme-mode -->
        <span
          v-if="btn.id === 'theme-mode'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            colorMode === 'dark' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for caption-docking -->
        <span
          v-if="btn.id === 'caption-docking'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-all duration-200',
            settingsStore.captionDocking === 'none' ? 'bg-neutral-400 shadow-[0_0_6px_rgba(163,163,163,0.5)]' : '',
            settingsStore.captionDocking === 'bottom' ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]' : '',
            settingsStore.captionDocking === 'top' ? 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]' : '',
            settingsStore.captionDocking === 'head' ? 'bg-fuchsia-400 shadow-[0_0_6px_rgba(232,121,249,0.5)]' : '',
          ]"
        />

        <!-- Status dot badge for viewport-cycle-modes -->
        <span
          v-if="btn.id === 'viewport-cycle-modes'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-all duration-200',
            settingsStore.controlStripInteractionMode === 'tactile' ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]' : '',
            settingsStore.controlStripInteractionMode === 'drag' ? 'bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]' : '',
            settingsStore.controlStripInteractionMode === 'positioning' ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : '',
            settingsStore.controlStripInteractionMode === 'orbit' ? 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]' : '',
          ]"
        />

        <!-- Status dot badge for caption-layout-mode -->
        <span
          v-if="btn.id === 'caption-layout-mode'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            settingsStore.captionLayoutMode === 'multi' ? 'bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.5)]' : 'bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.5)]',
          ]"
        />
      </button>
    </div>

    <!-- POPOVERS -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-2 scale-95"
      leave-to-class="opacity-0 translate-y-2 scale-95"
    >
      <div
        v-if="activePopover"
        ref="popoverRef"
        :class="[
          'absolute z-50 bg-neutral-100/90 dark:bg-neutral-900/95 border border-neutral-200/50 dark:border-neutral-800/80 backdrop-blur-xl rounded-2xl shadow-xl p-3 text-neutral-800 dark:text-neutral-200',
          popoverPlacement === 'bottom' ? 'top-full mt-3 left-1/2 -translate-x-1/2' : '',
          popoverPlacement === 'top' ? 'bottom-full mb-3 left-1/2 -translate-x-1/2' : '',
          popoverPlacement === 'right' ? 'left-full ml-3 top-1/2 -translate-y-1/2' : '',
          popoverPlacement === 'left' ? 'right-full mr-3 top-1/2 -translate-y-1/2' : '',
          'w-64 max-w-xs max-h-[440px] overflow-y-auto scrollbar-thin',
        ]"
        @click.stop
      >
        <!-- STAGE PRESETS POPOVER -->
        <div v-if="activePopover === 'stage-preset'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-1.5 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Stage Layout & Presets</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <!-- Dating Sim Mode Toggle Row -->
          <div class="flex items-center justify-between border border-rose-500/10 rounded-xl bg-rose-500/5 p-2 dark:border-rose-500/20 dark:bg-rose-950/10">
            <div class="flex items-center gap-2">
              <span class="i-solar:heart-bold text-base text-rose-500" :class="{ 'animate-pulse': datingSimStore.enabled }" />
              <span class="text-[11px] text-neutral-700 font-bold dark:text-neutral-300">Dating Sim Mode</span>
            </div>
            <button
              :class="[
                'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 border cursor-pointer',
                datingSimStore.enabled
                  ? 'bg-gradient-to-r from-rose-500 to-fuchsia-600 border-rose-400 text-white shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                  : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200/60 dark:border-neutral-750 text-neutral-500 hover:border-rose-400/40 hover:text-rose-400',
              ]"
              @click="toggleDatingSimMode"
            >
              {{ datingSimStore.enabled ? 'On' : 'Off' }}
            </button>
          </div>

          <!-- Monitor Selection -->
          <div v-if="monitorCount > 1" class="flex items-center justify-between gap-2 rounded-xl bg-neutral-200/30 p-1.5 dark:bg-neutral-800/30">
            <span class="px-1 text-[10px] text-neutral-500 font-bold tracking-wide uppercase">Monitor</span>
            <div class="flex gap-1">
              <button
                v-for="m in monitorCount"
                :key="m"
                :class="[
                  'w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-lg transition-all active:scale-95',
                  activeMonitor === m
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="selectMonitor('actor', m)"
              >
                {{ m }}
              </button>
            </div>
          </div>

          <!-- Size Presets horizontal compact list -->
          <div class="grid grid-cols-4 gap-1.5 py-1">
            <button
              v-for="p in PRESETS"
              :key="p.name"
              class="flex flex-col cursor-pointer items-center justify-center gap-1.5 border border-neutral-200/50 rounded-xl bg-neutral-50/50 px-1 py-2.5 text-[11px] text-neutral-700 font-semibold transition-all duration-200 active:scale-95 dark:border-neutral-800/20 hover:border-sky-400/50 dark:bg-neutral-800/40 hover:bg-sky-500/10 dark:text-neutral-300 hover:text-sky-600 dark:hover:bg-sky-500/20 dark:hover:text-sky-300"
              @click="applySizePreset('actor', p.name, selectedAlignment)"
            >
              <span :class="[p.icon, 'text-lg']" />
              <span class="text-[10px]">{{ p.label }}</span>
            </button>
          </div>

          <!-- Symmetrical Alignment Grid mockup (9-button layout) -->
          <div class="flex flex-col items-center gap-1.5 border-t border-neutral-200 pt-2 dark:border-neutral-800">
            <div class="grid grid-cols-3 mx-auto h-26 w-26 gap-1.5">
              <!-- Top-Left -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'top-left'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'top-left'); selectedAlignment = 'top-left'"
              >
                <span class="i-solar:arrow-left-up-linear text-base" />
              </button>

              <!-- Top -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'top'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'top'); selectedAlignment = 'top'"
              >
                <span class="i-solar:arrow-up-linear text-base" />
              </button>

              <!-- Top-Right -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'top-right'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'top-right'); selectedAlignment = 'top-right'"
              >
                <span class="i-solar:arrow-right-up-linear text-base" />
              </button>

              <!-- Left -->
              <button
                :class="[
                  'w-8 h-8 flex items-xl items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'left'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'left'); selectedAlignment = 'left'"
              >
                <span class="i-solar:arrow-left-linear text-base" />
              </button>

              <!-- Center -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'center'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'center'); selectedAlignment = 'center'"
              >
                <span class="i-solar:record-linear text-base" />
              </button>

              <!-- Right -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'right'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'right'); selectedAlignment = 'right'"
              >
                <span class="i-solar:arrow-right-linear text-base" />
              </button>

              <!-- Bottom-Left -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'bottom-left'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'bottom-left'); selectedAlignment = 'bottom-left'"
              >
                <span class="i-solar:arrow-left-down-linear text-base" />
              </button>

              <!-- Bottom -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'bottom'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'bottom'); selectedAlignment = 'bottom'"
              >
                <span class="i-solar:arrow-down-linear text-base" />
              </button>

              <!-- Bottom-Right -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'bottom-right'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'bottom-right'); selectedAlignment = 'bottom-right'"
              >
                <span class="i-solar:arrow-right-down-linear text-base" />
              </button>
            </div>
          </div>
        </div>

        <!-- CHAT PRESETS POPOVER -->
        <div v-if="activePopover === 'chat-preset'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-1.5 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Chat Layout</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <!-- Monitor Selection -->
          <div v-if="monitorCount > 1" class="flex items-center justify-between gap-2 rounded-xl bg-neutral-200/30 p-1.5 dark:bg-neutral-800/30">
            <span class="px-1 text-[10px] text-neutral-500 font-bold tracking-wide uppercase">Monitor</span>
            <div class="flex gap-1">
              <button
                v-for="m in monitorCount"
                :key="m"
                :class="[
                  'w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-lg transition-all active:scale-95',
                  activeMonitor === m
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="selectMonitor('chat', m)"
              >
                {{ m }}
              </button>
            </div>
          </div>

          <!-- Size Presets Stateless Action Strip -->
          <div class="mx-0.5 my-1 flex border border-neutral-200/20 rounded-xl bg-neutral-200/40 p-0.5 divide-x divide-neutral-200/50 dark:border-neutral-800/30 dark:bg-neutral-900/60 dark:divide-neutral-800/80">
            <button
              v-for="p in PRESETS"
              :key="p.name"
              class="flex-1 cursor-pointer rounded-lg py-1.5 text-center text-[10px] text-neutral-600 font-bold transition-all active:scale-95 hover:bg-white/40 dark:text-neutral-400 hover:text-sky-500 dark:hover:bg-neutral-800/40 dark:hover:text-sky-400"
              @click="applySizePreset('chat', p.name, selectedAlignment)"
            >
              {{ p.label === 'Medium' ? 'Med.' : p.label }}
            </button>
          </div>

          <!-- Symmetrical Alignment Grid mockup (9-button layout) -->
          <div class="flex flex-col items-center gap-1.5 border-t border-neutral-200 pt-2 dark:border-neutral-800">
            <div class="grid grid-cols-3 mx-auto h-26 w-26 gap-1.5">
              <!-- Top-Left -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'top-left'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'top-left'); selectedAlignment = 'top-left'"
              >
                <span class="i-solar:arrow-left-up-linear text-base" />
              </button>

              <!-- Top -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'top'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'top'); selectedAlignment = 'top'"
              >
                <span class="i-solar:arrow-up-linear text-base" />
              </button>

              <!-- Top-Right -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'top-right'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'top-right'); selectedAlignment = 'top-right'"
              >
                <span class="i-solar:arrow-right-up-linear text-base" />
              </button>

              <!-- Left -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'left'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'left'); selectedAlignment = 'left'"
              >
                <span class="i-solar:arrow-left-linear text-base" />
              </button>

              <!-- Center -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'center'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'center'); selectedAlignment = 'center'"
              >
                <span class="i-solar:record-linear text-base" />
              </button>

              <!-- Right -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'right'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'right'); selectedAlignment = 'right'"
              >
                <span class="i-solar:arrow-right-linear text-base" />
              </button>

              <!-- Bottom-Left -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'bottom-left'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'bottom-left'); selectedAlignment = 'bottom-left'"
              >
                <span class="i-solar:arrow-left-down-linear text-base" />
              </button>

              <!-- Bottom -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'bottom'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'bottom'); selectedAlignment = 'bottom'"
              >
                <span class="i-solar:arrow-down-linear text-base" />
              </button>

              <!-- Bottom-Right -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'bottom-right'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'bottom-right'); selectedAlignment = 'bottom-right'"
              >
                <span class="i-solar:arrow-right-down-linear text-base" />
              </button>
            </div>
          </div>
        </div>

        <!-- VOICE SWITCH POPOVER (gemini-voice) -->
        <div v-if="activePopover === 'gemini-voice'" class="flex flex-col gap-2.5">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Voice Switch</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <!-- CONDITION A: Gemini Live Session Voice List -->
          <div v-if="ttsOutputMode === 'gemini' && powerState !== 'off'" class="flex flex-col gap-1.5">
            <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Gemini Live Voices</span>
            <div class="max-h-56 flex flex-col gap-1 overflow-y-auto py-1 scrollbar-thin">
              <button
                v-for="voice in GEMINI_LIVE_VOICES"
                :key="voice"
                :class="[
                  'w-full cursor-pointer border rounded-xl px-2.5 py-1.5 text-left text-xs transition-all duration-200',
                  geminiLiveVoiceName === voice
                    ? 'bg-primary-500/20 border-primary-400/50 text-primary-600 dark:text-primary-300 font-semibold'
                    : 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-200/50 dark:border-neutral-800/20 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
                ]"
                @click="geminiLiveVoiceName = voice as any; activePopover = null"
              >
                <div class="flex items-center justify-between">
                  <span>{{ voice }}</span>
                  <span v-if="geminiLiveVoiceName === voice" class="i-solar:check-circle-bold text-sm text-primary-500" />
                </div>
              </button>
            </div>
          </div>

          <!-- CONDITION B: 3-Layer LLM / Native TTS View -->
          <div v-else class="flex flex-col gap-2.5">
            <!-- LAYER 1: Global Favorites -->
            <div v-if="favoriteVoices.length > 0" class="flex flex-col gap-1">
              <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Favorites</span>
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  v-for="fav in favoriteVoices"
                  :key="`${fav.provider}:${fav.voiceId}`"
                  :class="[
                    'relative h-12 flex flex-col items-center justify-center border rounded-xl text-[10px] transition-all overflow-hidden cursor-pointer select-none',
                    (activeSpeechProvider === fav.provider && activeSpeechVoiceId === fav.voiceId)
                      ? 'border-amber-400 ring-2 ring-amber-400/50 font-bold bg-amber-500/10'
                      : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-amber-500/50 bg-neutral-200/10 dark:bg-neutral-800/10',
                  ]"
                  @click="selectVoice(fav.provider, fav.model, fav.voiceId); activePopover = null"
                >
                  <div :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold uppercase mb-0.5', cardInitialColor(fav.name)]">
                    {{ fav.name[0] }}
                  </div>
                  <span class="w-full truncate px-1 text-center text-[8px] text-neutral-600 dark:text-neutral-400">{{ fav.name }}</span>
                </button>
              </div>
              <div class="my-1 border-b border-neutral-200/50 dark:border-neutral-800/50" />
            </div>

            <!-- LAYER 2: Character Scoped / Global Fallback -->
            <div v-if="scopedCastVoices.length > 0" class="flex flex-col gap-1">
              <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                {{ activeCard?.extensions?.airi?.visual_assets && Object.keys(activeCard.extensions.airi.visual_assets).length > 0 ? 'Concept Voices' : 'Cast Voices' }}
              </span>
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  v-for="v in scopedCastVoices"
                  :key="`${v.provider}:${v.voiceId}`"
                  :class="[
                    'relative h-12 flex flex-col items-center justify-center border rounded-xl text-[10px] transition-all overflow-hidden cursor-pointer select-none',
                    (activeSpeechProvider === v.provider && activeSpeechVoiceId === v.voiceId)
                      ? 'border-primary-400 ring-2 ring-primary-400/50 font-bold bg-primary-500/10'
                      : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-primary-500/50 bg-neutral-200/10 dark:bg-neutral-800/10',
                  ]"
                  :title="v.description || v.name"
                  @click="selectVoice(v.provider, v.model, v.voiceId); activePopover = null"
                >
                  <div :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold uppercase mb-0.5', cardInitialColor(v.name)]">
                    {{ v.name[0] }}
                  </div>
                  <span class="w-full truncate px-1 text-center text-[8px] text-neutral-600 dark:text-neutral-400">{{ v.name }}</span>
                </button>
              </div>
              <div class="my-1 border-b border-neutral-200/50 dark:border-neutral-800/50" />
            </div>

            <!-- LAYER 3: Dropdown Selectors -->
            <div class="flex flex-col gap-2">
              <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Search Registry</span>

              <!-- Provider Selector -->
              <div class="flex flex-col gap-0.5">
                <span class="text-[8px] text-neutral-400 font-semibold uppercase">Provider</span>
                <select
                  v-model="selectedManualProvider"
                  class="w-full border border-neutral-200/30 rounded-xl bg-neutral-200/40 px-2.5 py-1 text-[10px] text-neutral-700 dark:border-neutral-800/30 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none"
                >
                  <option
                    v-for="p in providersStore.allAudioSpeechProvidersMetadata"
                    :key="p.id"
                    :value="p.id"
                  >
                    {{ p.name }}
                  </option>
                </select>
              </div>

              <!-- Model Selector -->
              <div v-if="providersStore.getModelsForProvider(selectedManualProvider).length > 0" class="flex flex-col gap-0.5">
                <span class="text-[8px] text-neutral-400 font-semibold uppercase">Engine / Model</span>
                <select
                  v-model="selectedManualModel"
                  class="w-full border border-neutral-200/30 rounded-xl bg-neutral-200/40 px-2.5 py-1 text-[10px] text-neutral-700 dark:border-neutral-800/30 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none"
                >
                  <option
                    v-for="m in providersStore.getModelsForProvider(selectedManualProvider)"
                    :key="m.id"
                    :value="m.id"
                  >
                    {{ m.name }}
                  </option>
                </select>
              </div>

              <!-- Voice Selector -->
              <div v-if="speechStore.getVoicesForProvider(selectedManualProvider).length > 0" class="flex flex-col gap-1">
                <div class="flex flex-col gap-0.5">
                  <span class="text-[8px] text-neutral-400 font-semibold uppercase">Voice ID</span>
                  <select
                    v-model="selectedManualVoiceId"
                    class="w-full border border-neutral-200/30 rounded-xl bg-neutral-200/40 px-2.5 py-1 text-[10px] text-neutral-700 dark:border-neutral-800/30 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none"
                  >
                    <option
                      v-for="v in speechStore.getVoicesForProvider(selectedManualProvider)"
                      :key="v.id"
                      :value="v.id"
                    >
                      {{ v.name }}
                    </option>
                  </select>
                </div>

                <!-- Action row to toggle favorite / apply -->
                <div class="mt-1 flex items-center gap-1.5">
                  <button
                    class="flex-1 cursor-pointer border border-primary-500/25 rounded-xl bg-primary-500/20 py-1 text-center text-[10px] text-primary-600 font-semibold transition-all hover:bg-primary-500/30 dark:text-primary-300"
                    @click="selectVoice(selectedManualProvider, selectedManualModel, selectedManualVoiceId); activePopover = null"
                  >
                    Apply Voice
                  </button>
                  <button
                    class="h-8 w-8 flex cursor-pointer items-center justify-center border border-neutral-200/30 rounded-xl bg-neutral-200/40 text-amber-500 transition-all dark:border-neutral-800/30 dark:bg-neutral-800/40 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60"
                    title="Toggle Favorite"
                    @click="toggleVoiceFavorite(selectedManualProvider, selectedManualVoiceId)"
                  >
                    <span :class="isVoiceFavorite(selectedManualProvider, selectedManualVoiceId) ? 'i-solar:star-bold' : 'i-solar:star-linear'" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- CHARACTERS POPOVER -->
        <div v-if="activePopover === 'actor-characters'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <div class="flex items-center gap-2">
              <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Characters</span>
              <button
                class="flex cursor-pointer items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200"
                title="Toggle view mode"
                @click="characterViewMode = characterViewMode === 'list' ? 'grid' : 'list'"
              >
                <span :class="characterViewMode === 'list' ? 'i-solar:grid-bold text-xs' : 'i-solar:list-bold text-xs'" />
              </button>
            </div>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <!-- FAVORITES SECTION (GRID) -->
          <div v-if="charFavIds.length > 0" class="flex flex-col gap-1">
            <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Favorites</span>
            <div class="grid grid-cols-3 gap-1">
              <div
                v-for="[id, card] in charFavEntries"
                :key="id"
                :class="[
                  'group relative aspect-square cursor-pointer overflow-hidden border rounded-xl bg-neutral-200/10 dark:bg-neutral-800/10 hover:ring-2 hover:ring-amber-500/50 transition-all duration-200',
                  id === activeCardId ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-neutral-200/40 dark:border-neutral-800/40',
                ]"
                @click="cardStore.activateCard(id); activePopover = null"
              >
                <CharacterAvatar
                  :card-id="id"
                  :name="card.name"
                  :display-model-id="cardStore.getCardDisplayModelId(id)"
                  shape="rounded"
                  size-class="h-full w-full"
                />
                <div class="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-center text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {{ card.name }}
                </div>
                <!-- Star Corner Favorite Button -->
                <button
                  class="absolute right-0.5 top-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-black/40 text-amber-400 hover:bg-black/60"
                  @click.stop="toggleCharFav(id)"
                >
                  <span class="i-solar:star-bold text-[10px]" />
                </button>
              </div>
            </div>
            <div class="my-1 border-b border-neutral-200/50 dark:border-neutral-800/50" />
          </div>

          <!-- SEARCH INPUT -->
          <div class="relative py-1">
            <span class="i-solar:magnifer-linear absolute left-2.5 top-3 text-xs text-neutral-400" />
            <input
              v-model="characterSearch"
              type="text"
              placeholder="Search characters..."
              class="w-full border border-neutral-200/10 rounded-xl bg-neutral-200/40 py-1 pl-7 pr-2.5 text-[11px] text-neutral-700 dark:border-neutral-800/10 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            >
          </div>

          <!-- LIST VIEW -->
          <div v-if="characterViewMode === 'list'" class="max-h-48 flex flex-col gap-1 overflow-y-auto py-1 scrollbar-thin">
            <div
              v-for="[id, card] in sortedCharacters"
              :key="id"
              :class="[
                'group w-full flex items-center justify-between cursor-pointer border rounded-xl px-2.5 py-1.5 text-left text-xs transition-all duration-200',
                id === activeCardId
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-600 dark:text-amber-300 font-semibold'
                  : 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-200/50 dark:border-neutral-800/20 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
              ]"
              @click="cardStore.activateCard(id); activePopover = null"
            >
              <div class="flex items-center gap-2 truncate">
                <CharacterAvatar
                  :card-id="id"
                  :name="card.name"
                  :display-model-id="cardStore.getCardDisplayModelId(id)"
                  shape="rounded"
                  size-class="h-8 w-8"
                />
                <span class="truncate font-semibold">{{ card.name }}</span>
                <span v-if="id === activeCardId" class="scale-90 border border-amber-500/30 rounded bg-amber-500/20 px-1 py-0.5 text-[8px] text-amber-600 font-bold uppercase dark:text-amber-400">Active</span>
              </div>
              <!-- Right Star Toggle -->
              <button
                class="h-5 w-5 flex cursor-pointer items-center justify-center rounded-full text-neutral-400 transition-all hover:bg-neutral-200 dark:hover:bg-neutral-800"
                :class="[
                  isCharFav(id) ? 'text-amber-400 opacity-100' : 'opacity-0 group-hover:opacity-100',
                ]"
                @click.stop="toggleCharFav(id)"
              >
                <span :class="isCharFav(id) ? 'i-solar:star-bold text-xs' : 'i-solar:star-linear text-xs'" />
              </button>
            </div>
            <div v-if="sortedCharacters.length === 0" class="flex flex-col items-center justify-center py-6 text-center opacity-40">
              <span class="i-solar:user-bold-duotone text-xl" />
              <span class="mt-1 text-[9px]">No characters found</span>
            </div>
          </div>

          <!-- GRID VIEW (3 col) -->
          <div v-else class="max-h-48 overflow-y-auto py-1 scrollbar-thin">
            <div class="grid grid-cols-3 gap-1">
              <div
                v-for="[id, card] in sortedCharacters"
                :key="id"
                :class="[
                  'group relative aspect-square border rounded-xl overflow-hidden cursor-pointer bg-neutral-200/10 dark:bg-neutral-800/10 transition-all duration-200',
                  id === activeCardId
                    ? 'border-amber-400 ring-2 ring-amber-400/50'
                    : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-amber-500/50',
                ]"
                @click="cardStore.activateCard(id); activePopover = null"
              >
                <img
                  v-if="typeof card.metadata?.avatar === 'string'"
                  :src="card.metadata.avatar"
                  class="h-full w-full object-cover"
                >
                <div v-else :class="['h-full w-full flex items-center justify-center text-lg font-bold tracking-wide uppercase', cardInitialColor(card.name)]">
                  {{ card.name.charAt(0) }}
                </div>
                <div class="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-center text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {{ card.name }}
                </div>
                <!-- Hover Favorite Star -->
                <button
                  :class="[
                    'absolute top-0.5 right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition-opacity cursor-pointer',
                    isCharFav(id) ? 'text-amber-400 opacity-100' : 'text-white opacity-0 group-hover:opacity-100',
                  ]"
                  @click.stop="toggleCharFav(id)"
                >
                  <span :class="isCharFav(id) ? 'i-solar:star-bold text-[10px]' : 'i-solar:star-linear text-[10px]'" />
                </button>
              </div>
              <div v-if="sortedCharacters.length === 0" class="col-span-3 flex flex-col items-center justify-center py-6 text-center opacity-40">
                <span class="i-solar:user-bold-duotone text-xl" />
                <span class="mt-1 text-[9px]">No characters found</span>
              </div>
            </div>
          </div>

          <!-- FOOTER -->
          <div class="grid grid-cols-3 gap-1 border-t border-neutral-200 pt-2 dark:border-neutral-800">
            <button
              class="flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-sky-500/10 py-1.5 text-[10px] text-sky-600 font-semibold transition-colors hover:bg-sky-500/20 dark:text-sky-400"
              @click="handleViewGallery"
            >
              <span class="i-solar:gallery-linear text-xs" />
              Gallery
            </button>
            <button
              class="flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-amber-500/10 py-1.5 text-[10px] text-amber-600 font-semibold transition-colors hover:bg-amber-500/20 dark:text-amber-400"
              @click="handleEditActiveCard"
            >
              <span class="i-solar:pen-linear text-xs" />
              Edit
            </button>
            <button
              class="flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-purple-500/10 py-1.5 text-[10px] text-purple-600 font-semibold transition-colors hover:bg-purple-500/20 dark:text-purple-400"
              @click="handleManageProfiles"
            >
              <span class="i-solar:settings-outline text-xs" />
              Cards
            </button>
          </div>
        </div>

        <!-- WARDROBE POPOVER -->
        <div v-if="activePopover === 'actor-wardrobe'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Wardrobe</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <template v-if="settingsStore.stageModelRenderer === 'mmd' || settingsStore.stageModelRenderer === 'spine'">
            <div class="flex flex-col items-center justify-center py-6 text-center opacity-60">
              <span class="i-solar:shield-warning-outline animate-pulse text-2xl text-amber-500" />
              <span class="mt-2 text-xs font-medium">Not supported for {{ settingsStore.stageModelRenderer.toUpperCase() }}</span>
              <span class="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">Please use the Controls Island.</span>
            </div>
          </template>
          <template v-else>
            <!-- 3-Column Outfit Grid -->
            <div class="max-h-40 overflow-y-auto py-1 scrollbar-thin">
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="item in wardrobeItems"
                  :key="item.id"
                  :class="[
                    'relative flex flex-col items-center justify-center p-2 rounded-xl border border-solid transition-all duration-200 cursor-pointer',
                    isOutfitActive(item.id)
                      ? item.type === 'base'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-600 dark:text-amber-400'
                        : 'bg-sky-500/20 border-sky-400 text-sky-600 dark:text-sky-400 ring-2 ring-sky-400/40'
                      : 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-200/50 dark:border-neutral-800/20 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
                  ]"
                  :title="item.name"
                  @click="triggerWardrobeItem(item.id)"
                >
                  <span
                    :class="[
                      'text-xl mb-1',
                      item.type === 'base' ? 'text-amber-500' : 'text-sky-400',
                      item.icon || 'i-solar:t-shirt-outline',
                    ]"
                  />
                  <span class="w-full truncate text-center text-[9px]">{{ item.name }}</span>
                </button>

                <!-- Empty state if no outfits -->
                <div
                  v-if="wardrobeItems.length === 0"
                  class="col-span-3 flex flex-col items-center justify-center py-6 text-center opacity-40"
                >
                  <span class="i-solar:t-shirt-outline text-2xl" />
                  <span class="mt-1 text-[10px]">No outfits found</span>
                </div>
              </div>
            </div>

            <!-- Filters Row -->
            <div class="grid grid-cols-3 gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
              <button
                :class="[
                  'flex items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer',
                  wardrobeFilter === 'base'
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-400/30'
                    : 'bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="wardrobeFilter = wardrobeFilter === 'base' ? 'all' : 'base'"
              >
                Base
              </button>
              <button
                :class="[
                  'flex items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer',
                  wardrobeFilter === 'overlay'
                    ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold border border-sky-400/30'
                    : 'bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="wardrobeFilter = wardrobeFilter === 'overlay' ? 'all' : 'overlay'"
              >
                Overlay
              </button>
              <button
                :class="[
                  'flex items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer',
                  wardrobeFilter === 'all'
                    ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold border border-purple-400/30'
                    : 'bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="wardrobeFilter = 'all'"
              >
                All
              </button>
            </div>
          </template>
        </div>

        <!-- EXPRESSIONS POPOVER -->
        <div v-if="activePopover === 'actor-expressions'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Expressions</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <div class="grid grid-cols-4 justify-items-center gap-2 py-1">
            <button
              v-for="emotion in ACT_EMOTIONS"
              :key="emotion.key"
              class="h-10 w-10 flex cursor-pointer items-center justify-center border border-neutral-200/50 rounded-xl bg-neutral-50/50 text-lg transition-all dark:border-neutral-800/20 dark:bg-neutral-800/40 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
              :title="emotion.key"
              @click="triggerEmotion(emotion.key)"
            >
              {{ emotion.emoji }}
            </button>

            <!-- Random Button -->
            <button
              class="h-10 w-10 flex cursor-pointer items-center justify-center border border-amber-400/30 rounded-xl bg-amber-500/10 text-lg text-amber-500 transition-all hover:bg-amber-500/20"
              title="Random"
              @click="triggerRandomEmotion"
            >
              <span class="i-solar:shuffle-linear" />
            </button>
          </div>
        </div>

        <!-- MOTIONS POPOVER -->
        <div v-if="activePopover === 'actor-motions'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Motions</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <div class="max-h-48 flex flex-col gap-1.5 overflow-y-auto py-1 scrollbar-thin">
            <button
              v-for="motion in availableMotions"
              :key="motion.key"
              :class="[
                'w-full cursor-pointer border rounded-xl px-3 py-2 text-left text-xs transition-all duration-200',
                isMotionActive(motion)
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-600 dark:text-amber-300 font-semibold'
                  : 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-200/50 dark:border-neutral-800/20 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
              ]"
              @click="playMotion(motion)"
            >
              <div class="flex items-center justify-between">
                <span class="mr-2 truncate font-medium">{{ motion.label }}</span>
                <span
                  v-if="isMotionActive(motion)"
                  class="i-solar:check-circle-bold flex-shrink-0 text-sm text-amber-500"
                />
              </div>
            </button>

            <div
              v-if="availableMotions.length <= 1"
              class="flex flex-col items-center justify-center py-6 text-center opacity-40"
            >
              <span class="i-solar:magic-stick-3-bold-duotone text-2xl" />
              <span class="mt-1 text-[10px]">No motions available</span>
            </div>
          </div>
        </div>

        <!-- ALL EMOTIONS POPOVER -->
        <div v-if="activePopover === 'actor-all-emotions'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">All Emotions</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <template v-if="settingsStore.stageModelRenderer === 'mmd' || settingsStore.stageModelRenderer === 'spine'">
            <div class="flex flex-col items-center justify-center py-6 text-center opacity-60">
              <span class="i-solar:shield-warning-outline animate-pulse text-2xl text-amber-500" />
              <span class="mt-2 text-xs font-medium">Not supported for {{ settingsStore.stageModelRenderer.toUpperCase() }}</span>
              <span class="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">Please use the Controls Island.</span>
            </div>
          </template>
          <template v-else>
            <div class="max-h-48 flex flex-col gap-1 overflow-y-auto py-1 scrollbar-thin">
              <button
                v-for="exp in availableAllExpressions"
                :key="exp.name"
                :class="[
                  'w-full cursor-pointer border rounded-xl px-2.5 py-1.5 text-left text-xs transition-all duration-200',
                  exp.isActive
                    ? 'bg-purple-500/20 border-purple-400/50 text-purple-600 dark:text-purple-300 font-semibold'
                    : 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-200/50 dark:border-neutral-800/20 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
                ]"
                @click="triggerExpression(exp.name)"
              >
                <div class="flex items-center justify-between">
                  <span class="mr-2 truncate font-medium">{{ exp.name }}</span>
                  <span
                    v-if="exp.isActive"
                    class="i-solar:check-circle-bold flex-shrink-0 text-sm text-purple-500"
                  />
                </div>
              </button>

              <div
                v-if="availableAllExpressions.length === 0"
                class="flex flex-col items-center justify-center py-6 text-center opacity-40"
              >
                <span class="i-solar:emoji-funny-square-linear text-2xl" />
                <span class="mt-1 text-[10px]">No expressions available</span>
              </div>
            </div>
          </template>
        </div>

        <!-- AVATARS POPOVER -->
        <div v-if="activePopover === 'actor-avatars'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-1.5 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Avatars</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <!-- Segmented Toggle: Preview vs Apply -->
          <div class="flex rounded-xl bg-neutral-200/40 p-0.5 dark:bg-neutral-950/40">
            <button
              :class="[
                'flex-1 text-[10px] font-bold py-1 rounded-lg transition-all cursor-pointer text-center',
                avatarApplyMode === 'preview'
                  ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300',
              ]"
              @click="avatarApplyMode = 'preview'"
            >
              Preview
            </button>
            <button
              :class="[
                'flex-1 text-[10px] font-bold py-1 rounded-lg transition-all cursor-pointer text-center',
                avatarApplyMode === 'apply'
                  ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300',
              ]"
              @click="avatarApplyMode = 'apply'"
            >
              Apply to Char
            </button>
          </div>

          <!-- FAVORITES SECTION (GRID) -->
          <div v-if="characterFavorites.length > 0" class="flex flex-col gap-1">
            <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Favorites</span>
            <div class="grid grid-cols-3 gap-1">
              <div
                v-for="model in characterFavorites"
                :key="model.id"
                class="group relative aspect-square cursor-pointer overflow-hidden border border-neutral-200/40 rounded-xl bg-neutral-200/10 dark:border-neutral-800/40 dark:bg-neutral-800/10 hover:ring-2 hover:ring-sky-500/50"
                @click="selectAvatar(model.id)"
              >
                <img
                  v-if="model.previewImage"
                  :src="model.previewImage"
                  class="h-full w-full object-cover"
                >
                <div v-else class="h-full w-full flex items-center justify-center bg-neutral-500/10 text-neutral-400">
                  <span class="i-solar:user-bold-duotone text-lg" />
                </div>
                <div class="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-center text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {{ model.name }}
                </div>
                <!-- Star Corner Favorite Button -->
                <button
                  class="absolute right-0.5 top-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-black/40 text-amber-400 hover:bg-black/60"
                  @click.stop="toggleAvatarFavorite(model.id)"
                >
                  <span class="i-solar:star-bold text-[10px]" />
                </button>
              </div>
            </div>
            <div class="my-1.5 border-b border-neutral-200/50 dark:border-neutral-800/50" />
          </div>

          <!-- SEARCH INPUT -->
          <div class="relative">
            <span class="i-solar:magnifer-linear absolute left-2.5 top-2 text-xs text-neutral-400" />
            <input
              v-model="avatarSearch"
              type="text"
              placeholder="Search avatars..."
              class="w-full border border-neutral-200/10 rounded-xl bg-neutral-200/40 py-1 pl-7 pr-2.5 text-[11px] text-neutral-700 dark:border-neutral-800/10 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
            >
          </div>

          <!-- TYPE SELECT DROPDOWN -->
          <div class="flex items-center gap-1.5">
            <span class="truncate text-[10px] text-neutral-400 font-semibold">Format:</span>
            <select
              v-model="avatarTypeFilter"
              class="flex-1 cursor-pointer border border-neutral-200/10 rounded-xl bg-neutral-200/40 px-2 py-0.5 text-[10px] text-neutral-700 dark:border-neutral-800/10 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
            >
              <option value="all">
                All
              </option>
              <option value="live2d">
                Live2D
              </option>
              <option value="vrm">
                VRM
              </option>
              <option value="spine">
                Spine
              </option>
              <option value="mmd">
                MMD
              </option>
            </select>
          </div>

          <!-- COLLECTION GRID -->
          <div class="grid grid-cols-3 gap-1">
            <div
              v-for="model in paginatedAvatars"
              :key="model.id"
              :class="[
                'group relative aspect-square border rounded-xl overflow-hidden cursor-pointer bg-neutral-200/10 dark:bg-neutral-800/10',
                settingsStore.stageModelSelected === model.id
                  ? 'border-sky-500 ring-2 ring-sky-500/40'
                  : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-sky-500/50',
              ]"
              @click="selectAvatar(model.id)"
            >
              <img
                v-if="model.previewImage"
                :src="model.previewImage"
                class="h-full w-full object-cover"
              >
              <div v-else class="h-full w-full flex items-center justify-center bg-neutral-500/10 text-neutral-400">
                <span class="i-solar:user-bold-duotone text-lg" />
              </div>
              <div class="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-center text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                {{ model.name }}
              </div>
              <!-- Hover Favorite Star -->
              <button
                :class="[
                  'absolute top-0.5 right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition-opacity',
                  isAvatarFavorite(model.id) ? 'text-amber-400 opacity-100' : 'text-white opacity-0 group-hover:opacity-100',
                ]"
                @click.stop="toggleAvatarFavorite(model.id)"
              >
                <span :class="isAvatarFavorite(model.id) ? 'i-solar:star-bold text-[10px]' : 'i-solar:star-linear text-[10px]'" />
              </button>
            </div>

            <!-- Empty state for search -->
            <div
              v-if="filteredAvatars.length === 0"
              class="col-span-3 flex flex-col items-center justify-center py-6 text-center opacity-40"
            >
              <span class="i-solar:user-bold-duotone text-xl" />
              <span class="mt-1 text-[9px]">No models found</span>
            </div>
          </div>

          <!-- PAGINATION CONTROLS -->
          <div v-if="totalAvatarPages > 1" class="mt-1 flex items-center justify-between gap-2 border-t border-neutral-200/50 pt-1.5 dark:border-neutral-800/50">
            <button
              :disabled="currentAvatarPage <= 1"
              class="h-5 w-5 flex cursor-pointer items-center justify-center rounded-lg bg-neutral-200/40 text-neutral-600 disabled:cursor-not-allowed dark:bg-neutral-800/40 hover:bg-neutral-200 dark:text-neutral-400 disabled:opacity-30 dark:hover:bg-neutral-700"
              @click="currentAvatarPage--"
            >
              <span class="i-solar:arrow-left-linear text-xs" />
            </button>
            <span class="text-[9px] text-neutral-400 font-semibold">Page {{ currentAvatarPage }} of {{ totalAvatarPages }}</span>
            <button
              :disabled="currentAvatarPage >= totalAvatarPages"
              class="h-5 w-5 flex cursor-pointer items-center justify-center rounded-lg bg-neutral-200/40 text-neutral-600 disabled:cursor-not-allowed dark:bg-neutral-800/40 hover:bg-neutral-200 dark:text-neutral-400 disabled:opacity-30 dark:hover:bg-neutral-700"
              @click="currentAvatarPage++"
            >
              <span class="i-solar:arrow-right-linear text-xs" />
            </button>
          </div>
        </div>

        <!-- SELFIES POPOVER -->
        <div v-if="activePopover === 'actor-selfies'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-1.5 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Selfies</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <!-- Take Selfie Button & Countdown Overlay -->
          <div class="relative flex flex-col gap-1.5">
            <button
              class="w-full flex cursor-pointer items-center justify-center gap-1.5 border border-primary-500/25 rounded-xl bg-primary-500/20 py-2 text-center text-xs text-primary-600 font-semibold transition-all disabled:cursor-not-allowed hover:bg-primary-500/30 dark:text-primary-300 disabled:opacity-50"
              :disabled="selfieCountdown !== null"
              @click="triggerSelfie"
            >
              <span class="i-solar:camera-bold text-sm" />
              <span>{{ selfieCountdown !== null ? `Capturing in ${selfieCountdown}...` : 'Take Selfie' }}</span>
            </button>
            <label class="flex cursor-pointer select-none items-center justify-between rounded-lg bg-neutral-100/50 p-1.5 text-[10px] text-neutral-500 dark:bg-neutral-800/50 hover:bg-neutral-200/40 dark:text-neutral-400 dark:hover:bg-neutral-800/80">
              <span class="font-medium">Include Stage Background</span>
              <input
                v-model="selfieIncludeBg"
                type="checkbox"
                class="border-neutral-300/80 rounded text-primary-600 dark:border-neutral-700/80 dark:bg-neutral-800 focus:ring-primary-500"
              >
            </label>
          </div>

          <!-- Selfies Gallery (3-column grid) -->
          <div class="max-h-48 overflow-y-auto py-1 scrollbar-thin">
            <div v-if="selfies.length > 0" class="grid grid-cols-3 gap-1">
              <div
                v-for="selfie in selfies"
                :key="selfie.id"
                :class="[
                  'group relative aspect-square border rounded-xl overflow-hidden cursor-pointer bg-neutral-200/10 dark:bg-neutral-800/10 transition-all duration-200',
                  activeCard?.extensions?.airi?.modules?.activeBackgroundId === selfie.id
                    ? 'border-sky-500 ring-2 ring-sky-500/40'
                    : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-sky-500/50',
                ]"
                @click="selectSelfieBackground(selfie.id)"
              >
                <img
                  v-if="selfie.url"
                  :src="selfie.url"
                  class="h-full w-full object-cover"
                >
                <div v-else class="h-full w-full flex items-center justify-center bg-neutral-500/10 text-neutral-400">
                  <span class="i-solar:camera-broken text-lg" />
                </div>

                <!-- Hover Date/Time banner -->
                <div class="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-center text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {{ selfie.title }}
                </div>

                <!-- Set Background Top-Right Overlay Button -->
                <button
                  class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/45 text-white transition-all duration-150 hover:scale-105 hover:bg-black/70"
                  title="Set as stage background"
                  @click.stop="selectSelfieBackground(selfie.id)"
                >
                  <span class="i-solar:gallery-bold text-xs" />
                </button>
              </div>
            </div>
            <div v-else class="flex flex-col items-center justify-center py-8 text-center opacity-40">
              <span class="i-solar:camera-bold-duotone text-2xl" />
              <span class="mt-2 text-[10px]">No selfies captured yet.</span>
            </div>
          </div>
        </div>

        <!-- COMPANION MACARON / PROPS POPOVER -->
        <div v-if="activePopover === 'actor-macaron'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-1.5 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Floaties & Treats</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <!-- Segmented Toggle: Featured vs Custom Recipe -->
          <div class="flex rounded-xl bg-neutral-200/40 p-0.5 dark:bg-neutral-950/40">
            <button
              :class="[
                'flex-1 text-[10px] font-bold py-1 rounded-lg transition-all cursor-pointer text-center',
                macaronTab === 'featured'
                  ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300',
              ]"
              @click="macaronTab = 'featured'"
            >
              Featured Flavors
            </button>
            <button
              :class="[
                'flex-1 text-[10px] font-bold py-1 rounded-lg transition-all cursor-pointer text-center',
                macaronTab === 'custom'
                  ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300',
              ]"
              @click="macaronTab = 'custom'"
            >
              Custom Recipe
            </button>
          </div>

          <!-- TAB 1: 3x3 FEATURED PRESETS GRID -->
          <div v-if="macaronTab === 'featured'" class="grid grid-cols-3 gap-1">
            <div
              v-for="item in FEATURED_MACARONS"
              :key="item.id"
              :class="[
                'group relative aspect-square border rounded-xl overflow-hidden cursor-pointer flex flex-col items-center justify-center p-1 text-center transition-all bg-neutral-200/10 dark:bg-neutral-800/10',
                selectedMacaronPreset === item.id
                  ? 'border-sky-500 ring-2 ring-sky-500/40 bg-sky-500/10 dark:bg-sky-500/15'
                  : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-sky-500/50 hover:bg-neutral-200/20 dark:hover:bg-neutral-800/20',
              ]"
              @click="applyMacaron(item.shell, item.whip, item.heart, item.id)"
            >
              <span class="select-none text-xl leading-none">{{ item.emoji }}</span>
              <span class="mt-1 w-full truncate text-[8px] text-neutral-700 font-semibold dark:text-neutral-300">
                {{ item.name }}
              </span>
            </div>
          </div>

          <!-- TAB 2: CUSTOM RECIPE DROPDOWNS -->
          <div v-else class="flex flex-col gap-2">
            <!-- Cookie Shell Dropdown -->
            <div class="flex flex-col gap-0.5">
              <span class="text-[9px] text-neutral-400 font-semibold">Cookie Shell:</span>
              <select
                v-model="customShell"
                class="w-full cursor-pointer border border-neutral-200/10 rounded-xl bg-neutral-200/40 px-2 py-1 text-[10px] text-neutral-700 dark:border-neutral-800/10 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              >
                <option v-for="opt in SHELL_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- Whip Filling Dropdown -->
            <div class="flex flex-col gap-0.5">
              <span class="text-[9px] text-neutral-400 font-semibold">Cream Whip:</span>
              <select
                v-model="customWhip"
                class="w-full cursor-pointer border border-neutral-200/10 rounded-xl bg-neutral-200/40 px-2 py-1 text-[10px] text-neutral-700 dark:border-neutral-800/10 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              >
                <option v-for="opt in WHIP_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- Heart Candy Dropdown -->
            <div class="flex flex-col gap-0.5">
              <span class="text-[9px] text-neutral-400 font-semibold">Heart Candy:</span>
              <select
                v-model="customHeart"
                class="w-full cursor-pointer border border-neutral-200/10 rounded-xl bg-neutral-200/40 px-2 py-1 text-[10px] text-neutral-700 dark:border-neutral-800/10 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              >
                <option v-for="opt in HEART_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- Apply Button -->
            <button
              class="mt-1 w-full flex items-center justify-center gap-1.5 rounded-xl bg-sky-500/90 py-1.5 text-[10px] text-white font-bold shadow transition-all active:scale-[0.98] hover:bg-sky-500"
              @click="applyMacaron(customShell, customWhip, customHeart)"
            >
              <span class="i-solar:magic-stick-3-bold text-xs" />
              Apply Custom Float
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 2px;
}
</style>
