import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'

import catalogUrl from '../assets/animadex-catalog.json?url'

import { useCustomCharactersStore } from './custom-characters'

export interface CharacterItem {
  id: string
  copyrightIndex: number
  name: string
  trigger: string
  tags: string
  traits: [number, number, number, number] // [genderIdx, hairLengthIdx, eyeColorIdx, hairColorIdx]
  copyrightName?: string
  isCustom?: boolean
}

export interface FilterChip {
  type: 'tag' | 'copyright' | 'hair_length' | 'eye_color' | 'hair_color'
  value: string
}

export const useAnimaDexWizardStore = defineStore('animadex-wizard', () => {
  const customCharactersStore = useCustomCharactersStore()
  const catalogLoaded = ref(false)
  const copyrights = ref<string[]>([])
  const facets = ref<Record<string, string[]>>({
    gender: [],
    hair_length: [],
    eye_color: [],
    hair_color: [],
  })
  const characters = ref<CharacterItem[]>([])

  // Wizard state
  const selectedCharacters = ref<CharacterItem[]>([])
  const currentStep = ref(1)
  const storyPrompt = reactive({
    setting: '',
    nickname: '',
    lore: '',
  })
  const isGenerating = ref(false)

  // Bindings state (characterId -> displayModelId/voiceId)
  const boundModels = ref<Record<string, string>>({})
  const boundVoices = ref<Record<string, { baseProvider: string, baseModel: string, baseVoice: string }>>({})

  // Filters
  const selectedGender = ref<string | null>(null)
  const selectedChips = ref<FilterChip[]>([])
  const searchQuery = ref('')

  // Load the catalog JSON
  async function loadCatalog() {
    if (catalogLoaded.value)
      return
    try {
      const response = await fetch(catalogUrl)
      const data = await response.json()
      copyrights.value = data.copyrights
      facets.value = data.facets

      // Map arrays to our CharacterItem format
      characters.value = data.characters.map((c: any) => ({
        id: c[0],
        copyrightIndex: c[1],
        name: c[2],
        trigger: c[3],
        tags: c[4],
        traits: c[5],
      }))
      catalogLoaded.value = true
    }
    catch (error) {
      console.error('[AnimaDexWizardStore] Failed to load catalog data', error)
    }
  }

  // Filter actions
  function addChip(type: FilterChip['type'], value: string) {
    if (!selectedChips.value.some(c => c.type === type && c.value.toLowerCase() === value.toLowerCase())) {
      selectedChips.value.push({ type, value })
    }
  }

  const showOnlyModels = ref(false)

  function removeChip(index: number) {
    selectedChips.value.splice(index, 1)
  }

  function setGender(gender: string | null) {
    selectedGender.value = gender
  }

  // Basket actions
  function addCharacterToBasket(char: CharacterItem) {
    if (!selectedCharacters.value.some(c => c.id === char.id)) {
      selectedCharacters.value.push(char)
    }
  }

  function removeCharacterFromBasket(charId: string) {
    selectedCharacters.value = selectedCharacters.value.filter(c => c.id !== charId)
    // Clean up bindings for removed character
    delete boundModels.value[charId]
    delete boundVoices.value[charId]
  }

  // Bind actions
  function bindModelToCharacter(characterId: string, modelId: string) {
    boundModels.value[characterId] = modelId
  }

  function bindVoiceToCharacter(characterId: string, voice: { baseProvider: string, baseModel: string, baseVoice: string }) {
    boundVoices.value[characterId] = voice as any
  }

  function clearBasket() {
    selectedCharacters.value = []
    boundModels.value = {}
    boundVoices.value = {}
  }

  function resetWizard() {
    selectedCharacters.value = []
    boundModels.value = {}
    boundVoices.value = {}
    currentStep.value = 1
    storyPrompt.setting = ''
    storyPrompt.nickname = ''
    storyPrompt.lore = ''
    isGenerating.value = false
    selectedGender.value = null
    selectedChips.value = []
    searchQuery.value = ''
    showOnlyModels.value = false
  }

  // Autocomplete suggestions generator
  const suggestions = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    if (!query)
      return []

    const list: Array<{ type: 'tag' | 'copyright' | 'hair_length' | 'eye_color' | 'hair_color' | 'character', label: string, extra?: string }> = []

    // 1. Tag option (Option B Action item at top)
    list.push({ type: 'tag', label: query })

    // 2. Facet suggestions:
    for (const length of facets.value.hair_length || []) {
      if (length.toLowerCase().includes(query))
        list.push({ type: 'hair_length', label: length })
    }
    for (const color of facets.value.eye_color || []) {
      if (color.toLowerCase().includes(query))
        list.push({ type: 'eye_color', label: `${color} eyes` })
    }
    for (const color of facets.value.hair_color || []) {
      if (color.toLowerCase().includes(query))
        list.push({ type: 'hair_color', label: `${color} hair` })
    }

    // 3. Copyright matches
    const allCps = Array.from(new Set([...(copyrights.value || []), ...customCharactersStore.customEntries.map(c => c.copyright).filter(Boolean)]))
    for (const copyright of allCps) {
      if (copyright.toLowerCase().includes(query)) {
        list.push({ type: 'copyright', label: copyright })
        if (list.length >= 8)
          break
      }
    }

    // 4. Character name matches (up to 5 to avoid overcrowding)
    let charCount = 0
    const allCharsForSuggestions = [...customCharactersStore.asCharacterItems, ...characters.value]
    for (const char of allCharsForSuggestions) {
      if (char.name.toLowerCase().includes(query)) {
        list.push({
          type: 'character',
          label: char.name,
          extra: char.copyrightName || copyrights.value[char.copyrightIndex] || '',
        })
        charCount++
        if (charCount >= 5)
          break
      }
    }

    return list.slice(0, 15)
  })

  // Computed matching characters for the grid
  const filteredCharacters = computed(() => {
    const allChars = [
      ...customCharactersStore.asCharacterItems,
      ...characters.value,
    ]

    return allChars.filter((char) => {
      const charCopyright = char.copyrightName || copyrights.value[char.copyrightIndex] || ''

      // 1. Gender Filter
      if (selectedGender.value && !char.isCustom) {
        const genderIdx = facets.value.gender.indexOf(selectedGender.value)
        if (genderIdx !== -1 && char.traits[0] !== genderIdx)
          return false
      }

      // 2. Chip / Filter Tag matching
      for (const chip of selectedChips.value) {
        if (chip.type === 'copyright') {
          if (charCopyright.toLowerCase() !== chip.value.toLowerCase())
            return false
        }
        else if (chip.type === 'hair_length' && !char.isCustom) {
          const lengthIdx = facets.value.hair_length.indexOf(chip.value)
          if (lengthIdx !== -1 && char.traits[1] !== lengthIdx)
            return false
        }
        else if (chip.type === 'eye_color' && !char.isCustom) {
          const colorName = chip.value.replace(/\s+eyes$/i, '')
          const colorIdx = facets.value.eye_color.indexOf(colorName)
          if (colorIdx !== -1 && char.traits[2] !== colorIdx)
            return false
        }
        else if (chip.type === 'hair_color' && !char.isCustom) {
          const colorName = chip.value.replace(/\s+hair$/i, '')
          const colorIdx = facets.value.hair_color.indexOf(colorName)
          if (colorIdx !== -1 && char.traits[3] !== colorIdx)
            return false
        }
        else if (chip.type === 'tag') {
          const query = chip.value.toLowerCase()
          const matched = char.name.toLowerCase().includes(query)
            || char.trigger.toLowerCase().includes(query)
            || char.tags.toLowerCase().includes(query)
            || charCopyright.toLowerCase().includes(query)
          if (!matched)
            return false
        }
      }

      // 3. Active uncommitted search query fallback
      if (searchQuery.value.trim()) {
        const query = searchQuery.value.trim().toLowerCase()
        const matched = char.name.toLowerCase().includes(query)
          || char.trigger.toLowerCase().includes(query)
          || char.tags.toLowerCase().includes(query)
          || charCopyright.toLowerCase().includes(query)
        if (!matched)
          return false
      }

      // 4. Model Binding Filter (Only show characters with associated model files)
      if (showOnlyModels.value) {
        const bindingsRaw = localStorage.getItem('settings/airi-card/character-bindings')
        if (bindingsRaw) {
          try {
            const bindings = JSON.parse(bindingsRaw)
            const binding = bindings[char.trigger]
            if (!binding || !binding.displayModelId)
              return false
          }
          catch (e) {
            return false
          }
        }
        else {
          return false
        }
      }

      return true
    })
  })

  function findCatalogCharacter(promptOrText: string | undefined): any | undefined {
    if (!promptOrText)
      return undefined
    const textLower = promptOrText.trim().toLowerCase()
    const allChars = [...customCharactersStore.asCharacterItems, ...characters.value]
    return allChars.find((c) => {
      const triggerLower = c.trigger.toLowerCase()
      return textLower === triggerLower || textLower.startsWith(`${triggerLower},`) || textLower.startsWith(`${triggerLower} `)
    })
  }

  function getCharacterThumbUrl(canonicalTrigger: string | undefined): string | null {
    if (!canonicalTrigger || canonicalTrigger.startsWith('custom:'))
      return null

    // Replace invalid filename characters
    let clean = canonicalTrigger.replace(/[/\\:*?"<>|]/g, '_')
    if (clean.endsWith('.')) {
      clean = clean.slice(0, -1)
    }

    return `https://blobs.animadex.net/Outputs/thumbs/${encodeURIComponent(clean)}.webp`
  }

  return {
    catalogLoaded,
    copyrights,
    facets,
    characters,
    selectedCharacters,
    currentStep,
    storyPrompt,
    isGenerating,
    selectedGender,
    selectedChips,
    searchQuery,
    boundModels,
    boundVoices,
    showOnlyModels,
    loadCatalog,
    addChip,
    removeChip,
    setGender,
    addCharacterToBasket,
    removeCharacterFromBasket,
    bindModelToCharacter,
    bindVoiceToCharacter,
    clearBasket,
    resetWizard,
    suggestions,
    filteredCharacters,
    findCatalogCharacter,
    getCharacterThumbUrl,
  }
})
