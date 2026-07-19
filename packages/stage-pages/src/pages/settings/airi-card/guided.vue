<script setup lang="ts">
import { ModelSelectorDialog } from '@proj-airi/stage-ui/components/scenarios/dialogs/model-selector'
import { useAnimaDexWizardStore } from '@proj-airi/stage-ui/stores/animadex-wizard'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useLLM } from '@proj-airi/stage-ui/stores/llm'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettingsUserProfile } from '@proj-airi/stage-ui/stores/settings/user-profile'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import AutoVoiceConfigModal from './components/AutoVoiceConfigModal.vue'
import VoiceCreatorModal from './components/VoiceCreatorModal.vue'

const router = useRouter()
const wizardStore = useAnimaDexWizardStore()
const airiCardStore = useAiriCardStore()
const llmStore = useLLM()
const consciousnessStore = useConsciousnessStore()
const providersStore = useProvidersStore()
const displayModelsStore = useDisplayModelsStore()
const speechStore = useSpeechStore()
const userProfileStore = useSettingsUserProfile()

const {
  catalogLoaded,
  selectedCharacters,
  currentStep,
  storyPrompt,
  isGenerating,
  selectedGender,
  selectedChips,
  searchQuery,
  suggestions,
  filteredCharacters,
  boundModels,
  boundVoices,
  copyrights,
  showOnlyModels,
} = storeToRefs(wizardStore)

// Local UI state
const isSearchFocused = ref(false)
const displayLimit = ref(60) // Paginate/limit grid size for performance

// Model & Voice Selector state
const activeBindingCharacterId = ref<string | null>(null)
const modelSelectorOpen = ref(false)
const voiceCreatorOpen = ref(false)
const voiceTargetCharacterId = ref<string | null>(null)
const characterIdleAnimations = ref<Record<string, string[]>>({})
const autoVoiceModalOpen = ref(false)

// AI Story Idea Suggester state
interface StoryIdea {
  title: string
  location: string
  nickname: string
  lore: string
}
const storyIdeas = ref<StoryIdea[]>([])
const activeSuggestionIndex = ref<number | null>(null)
const copiedIdx = ref<number | null>(null)
const isSuggestingIdeas = ref(false)
const suggestionGuidance = ref('')
const showSuggestions = ref(false)

// Step 4 Preview State
const synthesisPayload = ref<any>(null)
const showDeveloperPayload = ref(false)
const synthesisProposal = ref<any>(null)
const refinementGuidance = ref('')
const userDescriptionInput = ref('')
const userImagePromptInput = ref('')
const includeSelfConcept = ref(false)

function writeBackVoiceBinding(characterId: string, voice: { baseProvider: string, baseModel: string, baseVoice: string }) {
  const char = selectedCharacters.value.find(c => c.id === characterId)
  if (char) {
    try {
      const map = getBindingsMap()
      if (!map[char.trigger]) {
        map[char.trigger] = { trigger: char.trigger }
      }
      map[char.trigger].voice = voice || undefined
      map[char.trigger].voiceProfileId = voice?.baseVoice || undefined
      localStorage.setItem('settings/airi-card/character-bindings', JSON.stringify(map))

      // Remove from blacklist if manually bound
      const blacklistRaw = localStorage.getItem('settings/airi-card/character-bindings-blacklist')
      if (blacklistRaw) {
        const blacklist = JSON.parse(blacklistRaw).filter((t: string) => t !== char.trigger)
        localStorage.setItem('settings/airi-card/character-bindings-blacklist', JSON.stringify(blacklist))
      }
    }
    catch (e) {
      console.error('Failed to write back voice-binding:', e)
    }
  }
}

function handleApplyAutoVoices(payload: Record<string, { baseProvider: string, baseModel: string, baseVoice: string, idleAnimations?: string[] }>) {
  for (const [charId, voice] of Object.entries(payload)) {
    wizardStore.bindVoiceToCharacter(charId, voice)
    writeBackVoiceBinding(charId, voice)
    if (voice.idleAnimations) {
      characterIdleAnimations.value[charId] = [...voice.idleAnimations]
    }
  }
}

const activeBindingCharacterModel = computed(() => {
  if (!activeBindingCharacterId.value)
    return undefined
  const boundId = boundModels.value[activeBindingCharacterId.value]
  if (!boundId)
    return undefined
  return displayModelsStore.displayModels.find(m => m.id === boundId)
})

onMounted(async () => {
  await wizardStore.loadCatalog()
  if (!storyPrompt.value.nickname && userProfileStore.name) {
    storyPrompt.value.nickname = userProfileStore.name
  }
  userDescriptionInput.value = userProfileStore.description || ''
  userImagePromptInput.value = userProfileStore.prompt || ''
})

// Reset scroll pagination when search or chips change
watch([searchQuery, selectedChips, selectedGender], () => {
  displayLimit.value = 60
})

// Infinite scroll helper
function loadMore() {
  displayLimit.value += 60
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement
  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
    loadMore()
  }
}

// Autocomplete actions
function selectSuggestion(item: any) {
  if (item.type === 'character') {
    // Add character directly to basket
    const char = wizardStore.characters.find(c => c.name === item.label)
    if (char) {
      wizardStore.addCharacterToBasket(char)
      toast.success(`Added ${char.name} to cast`)
    }
  }
  else {
    // Add filter chip
    wizardStore.addChip(item.type, item.label)
  }
  searchQuery.value = ''
  isSearchFocused.value = false
}

// Add raw text tag on Enter
function handleSearchEnter() {
  const query = searchQuery.value.trim()
  if (query) {
    wizardStore.addChip('tag', query)
    searchQuery.value = ''
    isSearchFocused.value = false
  }
}

// Thumbnail resolver
function getThumbUrl(trigger: string) {
  return wizardStore.getCharacterThumbUrl(trigger) || ''
}

// Model Preview & Unbind Helpers
const showModelPreviews = ref<Record<string, boolean>>({})

function getBindingsMap() {
  try {
    const raw = localStorage.getItem('settings/airi-card/character-bindings')
    return raw ? JSON.parse(raw) : {}
  }
  catch {
    return {}
  }
}

function hasBoundModel(trigger: string) {
  const map = getBindingsMap()
  return !!(map[trigger] && map[trigger].displayModelId)
}

function getModelPreviewUrl(trigger: string) {
  const map = getBindingsMap()
  const modelId = map[trigger]?.displayModelId
  if (!modelId)
    return null
  const model = displayModelsStore.displayModels.find(m => m.id === modelId)
  return model?.previewImage || null
}

function unbindModel(trigger: string) {
  try {
    const map = getBindingsMap()
    if (map[trigger]) {
      delete map[trigger]
      localStorage.setItem('settings/airi-card/character-bindings', JSON.stringify(map))

      // Save unbind to blacklist so auto-linker does not re-add this false positive
      try {
        const blacklistRaw = localStorage.getItem('settings/airi-card/character-bindings-blacklist')
        const blacklist = blacklistRaw ? JSON.parse(blacklistRaw) : []
        if (!blacklist.includes(trigger)) {
          blacklist.push(trigger)
          localStorage.setItem('settings/airi-card/character-bindings-blacklist', JSON.stringify(blacklist))
        }
      }
      catch (e) {
        console.error('Failed to update blacklist:', e)
      }

      toast.success('Model association removed.')
      // Force trigger reactivity update on wizardStore's filteredCharacters computed
      showOnlyModels.value = !showOnlyModels.value
      showOnlyModels.value = !showOnlyModels.value
    }
  }
  catch (e: any) {
    toast.error(`Failed to unbind model: ${e.message}`)
  }
}

// Computed count of characters that have model bindings on disk
const boundCharactersCount = computed(() => {
  const map = getBindingsMap()
  const boundTriggers = new Set(Object.keys(map).filter(k => map[k].displayModelId))
  return wizardStore.characters.filter(char => boundTriggers.has(char.trigger)).length
})

function getActorThumbUrl(actorKey: string) {
  const slug = actorKey.replace('actor_', '')
  const char = selectedCharacters.value.find((c) => {
    const cSlug = c.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
    return cSlug === slug
  })
  return char ? getThumbUrl(char.trigger) : ''
}

// Navigation helpers
function handleBack() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
  else {
    wizardStore.resetWizard()
    router.replace('/settings/airi-card')
  }
}

function prefillRosterBindings() {
  const map = getBindingsMap()
  selectedCharacters.value.forEach((c) => {
    const binding = map[c.trigger]
    if (binding) {
      if (binding.displayModelId) {
        wizardStore.bindModelToCharacter(c.id, binding.displayModelId)
      }
      if (binding.voice) {
        wizardStore.bindVoiceToCharacter(c.id, binding.voice)
      }
      else if (binding.voiceProfileId) {
        const isVirtual = binding.voiceProfileId.startsWith('voice_profile_')
        wizardStore.bindVoiceToCharacter(c.id, {
          baseProvider: isVirtual ? 'virtual-audio-studio' : 'kokoro-local',
          baseModel: isVirtual ? 'virtual' : '',
          baseVoice: binding.voiceProfileId,
        })
      }
    }
  })
}

function handleNext() {
  if (currentStep.value === 1 && selectedCharacters.value.length > 0) {
    prefillRosterBindings()
    currentStep.value = 2
  }
  else if (currentStep.value === 2) {
    currentStep.value = 3
  }
}

function openModelSelector(characterId: string) {
  activeBindingCharacterId.value = characterId
  modelSelectorOpen.value = true
}

function handlePickModel(model: any) {
  if (activeBindingCharacterId.value) {
    const charId = activeBindingCharacterId.value
    const modelId = model?.id || ''
    wizardStore.bindModelToCharacter(charId, modelId)

    // Write back to persistent character bindings map in local storage
    const char = selectedCharacters.value.find(c => c.id === charId)
    if (char) {
      try {
        const map = getBindingsMap()
        if (!map[char.trigger]) {
          map[char.trigger] = { trigger: char.trigger }
        }
        map[char.trigger].displayModelId = modelId || undefined
        localStorage.setItem('settings/airi-card/character-bindings', JSON.stringify(map))

        // Remove from blacklist if manually bound
        const blacklistRaw = localStorage.getItem('settings/airi-card/character-bindings-blacklist')
        if (blacklistRaw) {
          const blacklist = JSON.parse(blacklistRaw).filter((t: string) => t !== char.trigger)
          localStorage.setItem('settings/airi-card/character-bindings-blacklist', JSON.stringify(blacklist))
        }
      }
      catch (e) {
        console.error('Failed to write back character model binding:', e)
      }
    }
  }
}

function getBoundModel(characterId: string) {
  const modelId = boundModels.value[characterId]
  if (!modelId)
    return undefined
  return displayModelsStore.displayModels.find(m => m.id === modelId)
}

// AI Story Idea Suggester
async function fetchStoryIdeas(guidance = '') {
  isSuggestingIdeas.value = true
  showSuggestions.value = true
  storyIdeas.value = []
  activeSuggestionIndex.value = null
  try {
    const activeModel = consciousnessStore.activeModel
    const activeProviderName = consciousnessStore.activeProvider
    if (!activeModel || !activeProviderName) {
      throw new Error('No active LLM configured.')
    }
    const providerInstance = await providersStore.getProviderInstance(activeProviderName)
    if (!providerInstance) {
      throw new Error('Failed to retrieve provider instance.')
    }
    const castInfo = selectedCharacters.value.map((c) => {
      const series = wizardStore.copyrights[c.copyrightIndex] || 'Unknown'
      return `- ${c.name} (${series})`
    }).join('\n')
    const systemMsg = `You are a creative roleplay scenario designer for an anime companion platform.
Based on the provided character cast, generate exactly 3 distinct and creative story scenario ideas.

Follow these rules for generating the scenarios:
1. UNIFIED WORLD: All selected characters must live in the same unified world, location, or timeline together. Do not split them into separate settings per character.
2. DUPLICATE/OUTFIT VARIATIONS: If the cast contains different versions or outfits of the same base character:
   - Mix up the approach across the 3 options.
   - For one option, treat them as a clone paradox, parallel-timeline variants, or twins who can talk to each other.
   - For another option, treat them as a single character who changes their outfits, roles, or personas contextually in the story.
3. STORY ROLEPLAY STRUCTURE: Make the lore rules describe a fun dynamic based on the characters' archetypes, series canon, or contrasting personalities, and explain the user's role (nickname) in relation to them.

Return ONLY a raw JSON array (no markdown, no wrapping text). Each element must match:
{ 
  "title": "short catchy scenario title", 
  "location": "vivid 2-sentence setting description", 
  "nickname": "what the characters call the user in '{Name} the {Role|Profession|Title}' format (e.g. 'Yoshi the Sensei', 'Tommy the Conductor', 'Rick the Engineer')", 
  "lore": "rich 2-3 sentence behavioral or world rules" 
}`
    const userMsg = `Cast:\n${castInfo}${guidance ? `\n\nUser guidance: ${guidance}` : ''}`
    const response = await llmStore.generate(activeModel, providerInstance as any, [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userMsg },
    ] as any)
    const cleaned = response.text?.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
    storyIdeas.value = JSON.parse(cleaned || '[]')
  }
  catch (e) {
    console.error('[Story Suggester] Error:', e)
    toast.error('Could not generate story ideas. Check your LLM provider.')
  }
  finally {
    isSuggestingIdeas.value = false
  }
}

function applySuggestion(idx: number) {
  activeSuggestionIndex.value = idx
  const idea = storyIdeas.value[idx]
  if (!idea)
    return
  storyPrompt.value.setting = idea.location
  storyPrompt.value.nickname = idea.nickname
  storyPrompt.value.lore = idea.lore
}

async function copyIdeaToClipboard(idx: number) {
  const idea = storyIdeas.value[idx]
  if (!idea)
    return
  const text = `Nickname: ${idea.nickname}\nLocation: ${idea.location}\nLore: ${idea.lore}`
  await navigator.clipboard.writeText(text)
  copiedIdx.value = idx
  setTimeout(() => {
    if (copiedIdx.value === idx)
      copiedIdx.value = null
  }, 1500)
}

// Card Synthesis Pipeline
// Card Synthesis Pipeline
async function handleGenerate(guidance = '') {
  isGenerating.value = true
  currentStep.value = 4

  try {
    // Build cast metadata asynchronously to query model capabilities
    const cast = await Promise.all(selectedCharacters.value.map(async (c) => {
      const series = wizardStore.copyrights[c.copyrightIndex] || 'Unknown Series'

      // Determine acting capabilities if a model is bound
      let actingCapabilities = null
      const boundModel = getBoundModel(c.id)
      if (boundModel) {
        const caps = await displayModelsStore.getOrLoadModelCapabilities(boundModel.id)

        let formatName = 'VRM'
        const fmt = boundModel.format.toLowerCase()
        if (fmt.includes('live2d'))
          formatName = 'Live2D'
        else if (fmt.includes('spine'))
          formatName = 'Spine'
        else if (fmt.includes('pmx') || fmt === 'pmd')
          formatName = 'MMD'

        actingCapabilities = {
          format: formatName,
          modelName: boundModel.name,
          whitelistedExpressions: caps.expressions,
          whitelistedMotions: caps.motions,
        }
      }

      return {
        name: c.name,
        series,
        trigger: c.trigger,
        tags: c.tags,
        actingCapabilities,
      }
    }))

    // Generate deterministic actor keys (slugged from names)
    const deterministicActorKeys: Record<string, string> = {}
    selectedCharacters.value.forEach((c) => {
      const slug = c.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
      deterministicActorKeys[c.name] = `actor_${slug}`
    })

    // Construct the payload that would be sent to the LLM
    const payload = {
      cast,
      storySettings: {
        setting: storyPrompt.value.setting || 'A cozy matching lounge',
        userNickname: storyPrompt.value.nickname || 'Companion',
        userDescription: userDescriptionInput.value,
        loreRules: storyPrompt.value.lore || 'Follow canon personalities and themes',
      },
      deterministicActorKeys,
      activeLLM: {
        model: consciousnessStore.activeModel || 'None configured',
        provider: consciousnessStore.activeProvider || 'None configured',
      },
    }

    synthesisPayload.value = payload
    console.log('[AnimaDexWizard] Compiled LLM Ingestion Payload:', JSON.stringify(payload, null, 2))

    // Call LLM for Synthesis
    const activeModel = consciousnessStore.activeModel
    const activeProviderName = consciousnessStore.activeProvider
    if (!activeModel || !activeProviderName) {
      throw new Error('No active LLM configured.')
    }
    const providerInstance = await providersStore.getProviderInstance(activeProviderName)
    if (!providerInstance) {
      throw new Error('Failed to retrieve provider instance.')
    }

    const systemMsg = `You are a professional character card writer. Based on the cast payload, synthesize a single cohesive roleplay card.
Generate a structured JSON matching this schema:
{
  "name": "readable world name",
  "scenario": "starting narrative scenario",
  "first_mes": "the default first greeting message",
  "alternate_greetings": ["additional greetings"],
  "system_prompt": "core system instructions prefixing all interactions",
  "places": {
    "place_main": { "name": "Main Setting Name", "description": "vivid description", "prompt": "stable diffusion tags" },
    "place_alt_1": { "name": "Alternate Setting 1", "description": "vivid description", "prompt": "stable diffusion tags" },
    "place_alt_2": { "name": "Alternate Setting 2 (Optional)", "description": "vivid description", "prompt": "stable diffusion tags" }
  },
  "actors": {
    "actor_key": {
      "short_description": "clothing visual summary",
      "long_prose": "high-fidelity appearance details",
      "personality_prompt": "personality guidelines",
      "acting_instructions": "acting details",
      "greeting": "unique in-character starting greeting"
    }
  }
}

CRITICAL RULES:
1. "places": You MUST generate exactly 2 or 3 distinct settings/locations where the roleplay can transition, mapping "place_main" (the starting area) and 1 or 2 alternative settings (e.g. "place_alt_1", "place_alt_2").
2. "greetings": Each actor's "greeting" MUST be a completely unique, starting message written from only that specific character's perspective. It must start with their ACTOR token (e.g. "<|ACTOR:actor_key|>") and should utilize some of their whitelisted expressions if provided (e.g. "<|ACT:emotion:"happy"|>"). DO NOT copy the same narrative or dialogue block across multiple characters.
3. ROLEPLAY PERSPECTIVE: The user (named in storySettings.userNickname, e.g. "Yoshi the Sensei") is the player. The LLM acts ONLY as the characters in the "actors" map. Under NO circumstances should the generated "system_prompt" write "You are [UserNickname]". Instead, write: "The user is [UserNickname]. You must act as the characters interacting with them."
4. NO HALLUCINATED TOKENS: Do NOT generate or instruct the user to use place tokens like "<|PLACE:...|>". The only supported tokens in the system prompt are character actor tokens ("<|ACTOR:...|>") and whitelisted expression tags ("<|ACT:...|>"). Changing settings or locations must be described naturally through plain dialogue/narration, not through tokens.

Return ONLY a raw JSON block.`

    const userMsg = `Ingestion Payload:\n${JSON.stringify(payload, null, 2)}${guidance ? `\n\nRefinement request: ${guidance}` : ''}`
    const response = await llmStore.generate(activeModel, providerInstance as any, [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userMsg },
    ] as any)

    const cleaned = response.text?.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
    synthesisProposal.value = JSON.parse(cleaned || '{}')
    toast.success('World synthesized successfully!')
  }
  catch (error: any) {
    console.error('[AnimaDexWizard] Synthesis error:', error)
    toast.error(`Synthesis failed: ${error.message}. Compiling mock placeholder proposal.`)

    // Fallback to high-fidelity mock proposal matching selected characters so the UI is always usable
    const firstChar = selectedCharacters.value[0]?.name || 'World'
    synthesisProposal.value = {
      name: `${firstChar} Cafe Crossroad`,
      scenario: `The characters are lounging in a cozy crossroads cafe. You just arrived as their guest.`,
      first_mes: `*${firstChar} looks up as you enter* "Oh! Welcome! Grab a seat and make yourself comfortable!"`,
      alternate_greetings: [],
      system_prompt: `Manage the multi-actor scene. Prefix dialogue with appropriate actor tokens.`,
      places: {
        place_main: {
          name: 'Cozy Cafe crossroads',
          description: 'A cozy warm lit cafe sitting at the crossroads of various timelines.',
          prompt: 'cozy_cafe, warm_lighting, wooden_tables',
        },
      },
      actors: selectedCharacters.value.reduce((acc: any, c) => {
        const slug = c.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
        acc[`actor_${slug}`] = {
          short_description: `${c.name}'s default outfit`,
          long_prose: `${c.name} looks active and friendly, wearing their baseline attire.`,
          personality_prompt: `${c.name} is warm, conversational, and follows their canon traits.`,
          acting_instructions: `Trigger expressions naturally when their mood shifts.`,
        }
        return acc
      }, {}),
    }
  }
  finally {
    isGenerating.value = false
  }
}

// Builds and saves the card to the store. Does NOT close the wizard.
async function doCreateCard(): Promise<boolean> {
  const proposal = synthesisProposal.value
  if (!proposal)
    return false

  try {
    const cardId = `guided-${Date.now()}`
    const slugName = proposal.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')

    // Inherit artistry from the currently active card so the user's preferred
    // image gen settings (provider, model, promptPrefix, spawnMode, etc.) carry forward
    // Use JSON serialize-deserialize to safely deep-clone and strip Vue reactive proxy trees
    const inheritedArtistry = airiCardStore.activeCard?.extensions?.airi?.artistry
      ? JSON.parse(JSON.stringify(airiCardStore.activeCard.extensions.airi.artistry))
      : {}

    // Assemble system prompt
    // Build a cast index at the top so the LLM always knows all ACTOR token keys
    const actorKeys = Object.keys(proposal.actors)
    const castIndex = actorKeys.map(k => `- <|ACTOR:${k}|>`).join('\n')

    let systemPrompt = `# System Prompt: ${proposal.name}\n\n`
    systemPrompt += `## Cast Roster\n`
    systemPrompt += `The following characters are active. You must act as all of them. Always prefix their dialogue blocks with their exact ACTOR token.\n`
    systemPrompt += `${castIndex}\n\n`

    systemPrompt += `## Strict Response Format\n`
    systemPrompt += `You must format your responses using paragraphs prefixed by the active character's ACTOR token. Do NOT use bold markdown names (like **Name**:) or normal text names. Always format like this:\n`
    if (actorKeys.length > 0) {
      const exampleKey = actorKeys[0]
      systemPrompt += `<|ACTOR:${exampleKey}|> *describes actions or expressions* "Dialogue speech goes here."\n`
      if (actorKeys.length > 1) {
        const exampleKey2 = actorKeys[1]
        systemPrompt += `<|ACTOR:${exampleKey2}|> *describes actions or expressions* "Dialogue speech goes here."\n`
      }
    }
    systemPrompt += `\n`

    systemPrompt += `## World Premise\n${proposal.system_prompt || ''}\n\n## Character Instructions\n`

    actorKeys.forEach((actorKey) => {
      const actor = proposal.actors[actorKey]
      systemPrompt += `### ${actorKey}\nInvoke this character with <|ACTOR:${actorKey}|> and apply this personality:\n${actor.acting_instructions || ''}\n\n`
    })

    // Assemble description
    let description = ''
    Object.keys(proposal.actors).forEach((actorKey) => {
      const actor = proposal.actors[actorKey]
      description += `### <|ACTOR:${actorKey}|> Appearance\n${actor.long_prose || ''}\n\n`
    })
    Object.keys(proposal.places).forEach((placeKey) => {
      const place = proposal.places[placeKey]
      description += `### Setting: ${place.name}\n${place.description || ''}\n\n`
    })

    // Assemble personality
    let personality = ''
    Object.keys(proposal.actors).forEach((actorKey) => {
      const actor = proposal.actors[actorKey]
      personality += `[<|ACTOR:${actorKey}|>]: ${actor.personality_prompt || ''}\n`
    })

    // Compile Visual Assets Wardrobes & Modules
    const visualAssets: Record<string, any> = {}
    const modules: Record<string, any> = {
      consciousness: {
        provider: consciousnessStore.activeProvider,
        model: consciousnessStore.activeModel,
      },
      active_expressions: {},
    }

    // Bind primary visual model/speech configurations to first character as default active
    const firstChar = selectedCharacters.value[0]
    if (firstChar) {
      const firstBoundModel = getBoundModel(firstChar.id)
      if (firstBoundModel) {
        modules.displayModelId = firstBoundModel.id
      }
      const boundVoice = boundVoices.value[firstChar.id]
      if (boundVoice) {
        modules.speech = {
          provider: boundVoice.baseProvider,
          model: boundVoice.baseModel || (providersStore.getProviderConfig(boundVoice.baseProvider)?.model as string) || '',
          voice_id: boundVoice.baseVoice,
        }
      }
    }

    // Map each actor asset
    selectedCharacters.value.forEach((c) => {
      const slug = c.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
      const actorKey = `actor_${slug}`
      const proposalActor = proposal.actors[actorKey] || {}

      const boundModel = getBoundModel(c.id)
      const boundVoice = boundVoices.value[c.id]

      const cleanPrompt = `${c.trigger}${c.tags ? `, (${c.tags})` : ''}`

      // Setup modules[actorKey]
      modules[actorKey] = {
        description: proposalActor.short_description || `${c.name}'s default wardrobe`,
        prompt: cleanPrompt,
        isBase: false,
        manifestation: {
          modelId: boundModel?.id || null,
        },
        speech: boundVoice
          ? {
              provider: boundVoice.baseProvider,
              model: boundVoice.baseModel || (providersStore.getProviderConfig(boundVoice.baseProvider)?.model as string) || '',
              voice_id: boundVoice.baseVoice,
            }
          : null,
      }

      // Setup visual_assets[actorKey]
      visualAssets[actorKey] = {
        description: proposalActor.short_description || `${c.name}'s default appearance`,
        prompt: cleanPrompt,
        isBase: false,
        idleAnimations: characterIdleAnimations.value[c.id] || [],
        manifestation: {
          modelId: boundModel?.id || null,
        },
        speech: boundVoice
          ? {
              provider: boundVoice.baseProvider,
              model: boundVoice.baseModel || (providersStore.getProviderConfig(boundVoice.baseProvider)?.model as string) || '',
              voice_id: boundVoice.baseVoice,
            }
          : undefined,
      }
    })

    if (includeSelfConcept.value) {
      visualAssets.concept_user = {
        description: userDescriptionInput.value.trim() || `The user character, ${storyPrompt.value.nickname}`,
        prompt: userImagePromptInput.value.trim() ? `, (${userImagePromptInput.value.trim()})` : '',
        isBase: false,
        manifestation: {
          modelId: null,
        },
      }
    }

    // Map each place asset
    Object.keys(proposal.places).forEach((placeKey) => {
      const place = proposal.places[placeKey]
      const cleanPrompt = place.prompt ? `, (${place.prompt})` : ''
      visualAssets[placeKey] = {
        description: place.description || '',
        prompt: cleanPrompt,
        isBase: true,
        manifestation: {
          backgroundId: null,
        },
      }
    })

    // Setup active concepts at startup
    const activeConcepts = selectedCharacters.value.map((c) => {
      const slug = c.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
      return `actor_${slug}`
    })

    if (includeSelfConcept.value) {
      activeConcepts.push('concept_user')
    }

    // Build the final V3 Compliant Card Structure
    const newCard: any = {
      id: cardId,
      name: slugName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: {
        name: slugName,
        nickname: proposal.name,
        character_version: '1.0.0',
        first_mes: proposal.first_mes,
        alternate_greetings: proposal.alternate_greetings || [],
        description: description.trim(),
        personality: personality.trim(),
        scenario: proposal.scenario || '',
        system_prompt: systemPrompt.trim(),
        post_history_instructions: '',
        tags: ['guided-synthesis', 'multi-character'],
        extensions: {
          airi: {
            modules,
            visual_assets: visualAssets,
            active_concepts: activeConcepts,
            // Inherit all artistry settings from active card (provider, model, promptPrefix,
            // spawnMode, autonomousEnabled, thresholds, etc.) so users never have to re-configure
            artistry: {
              ...inheritedArtistry,
              // Wizard-generated cards start with no prompt prefix override
              promptPrefix: inheritedArtistry.promptPrefix ?? '',
            },
            acting: {
              modelExpressionPrompt: 'Trigger expressions matching dialogue emotions.',
              speechExpressionPrompt: '',
              speechMannerismPrompt: '',
            },
          },
        },
      },
    }

    const newCardId = await airiCardStore.addCard(newCard)
    await airiCardStore.activateCard(newCardId)
    toast.success('Card created and set active!')
    return true
  }
  catch (e: any) {
    console.error('[AnimaDexWizard] Error creating card:', e)
    toast.error(`Failed to create card: ${e.message}`)
    return false
  }
}

// Closes the wizard without creating a card.
function doConfirm() {
  wizardStore.resetWizard()
  router.replace('/settings/airi-card')
}

// Creates the card AND closes the wizard.
async function confirmCreateCard() {
  const ok = await doCreateCard()
  if (ok)
    doConfirm()
}
</script>

<template>
  <div class="h-screen flex flex-col select-none bg-white text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-neutral-200/80 bg-neutral-50/50 px-6 py-4 backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-900/40">
      <div class="flex items-center gap-3">
        <Button
          variant="ghost"
          class="border border-neutral-200 rounded-xl p-2 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
          @click="handleBack"
        >
          <div i-solar:arrow-left-outline class="text-lg" />
        </Button>
        <div class="flex items-center gap-2">
          <div i-solar:magic-stick-3-line-duotone class="text-base text-primary-500" />
          <h2 class="text-sm text-neutral-800 font-bold leading-none dark:text-neutral-100">
            AnimaDex Wizard
          </h2>
        </div>
      </div>

      <!-- Step Indicator -->
      <div class="mr-4 flex items-center gap-2 text-xs font-semibold">
        <span :class="[currentStep >= 1 ? 'text-primary-500' : 'text-neutral-400 dark:text-neutral-600']">1. Cast Selection</span>
        <div i-solar:alt-arrow-right-line-duotone class="text-neutral-300 dark:text-neutral-700" />
        <span :class="[currentStep >= 2 ? 'text-primary-500' : 'text-neutral-400 dark:text-neutral-600']">2. Roster Settings</span>
        <div i-solar:alt-arrow-right-line-duotone class="text-neutral-300 dark:text-neutral-700" />
        <span :class="[currentStep >= 3 ? 'text-primary-500' : 'text-neutral-400 dark:text-neutral-600']">3. Story Prompts</span>
        <div i-solar:alt-arrow-right-line-duotone class="text-neutral-300 dark:text-neutral-700" />
        <span :class="[currentStep >= 4 ? 'text-primary-500' : 'text-neutral-400 dark:text-neutral-600']">4. LLM Synthesis</span>
      </div>
    </header>

    <!-- Content loading state -->
    <div v-if="!catalogLoaded" class="flex flex-1 flex-col items-center justify-center gap-3">
      <div class="h-8 w-8 animate-spin border-2 border-primary-500 border-t-transparent rounded-full" />
      <span class="text-sm text-neutral-500">Loading catalog database...</span>
    </div>

    <!-- main workspace -->
    <main v-else class="relative flex flex-1 flex-col overflow-hidden">
      <!-- STEP 1: CAST SELECTION -->
      <div v-if="currentStep === 1" class="flex flex-1 flex-col overflow-hidden">
        <!-- Search & Filter Bar -->
        <div class="z-20 flex flex-col gap-4 border-b border-neutral-200/80 bg-white p-6 dark:border-neutral-900/60 dark:bg-neutral-950">
          <div class="relative mx-auto max-w-2xl w-full">
            <div class="relative flex items-center border border-neutral-200 rounded-xl bg-neutral-50/70 px-4 transition-all duration-300 dark:border-neutral-800 focus-within:border-primary-500 dark:bg-neutral-900/40">
              <div i-solar:magnifer-linear class="mr-3 text-lg text-neutral-400 dark:text-neutral-500" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search characters by name, series, or tags (e.g. 'blonde hair')..."
                class="flex-1 border-none bg-transparent py-3 text-sm text-neutral-800 outline-none dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500"
                @focus="isSearchFocused = true"
                @keydown.enter="handleSearchEnter"
              >
              <button
                v-if="searchQuery"
                class="p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                @click="searchQuery = ''"
              >
                <div i-solar:close-circle-bold class="text-base" />
              </button>
            </div>

            <!-- Autocomplete suggestions dropdown -->
            <transition name="fade">
              <div
                v-if="isSearchFocused && suggestions.length > 0"
                class="absolute left-0 right-0 z-30 mt-2 max-h-[300px] overflow-y-auto border border-neutral-200 rounded-xl bg-white/95 shadow-2xl backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95"
              >
                <div
                  v-for="(item, idx) in suggestions"
                  :key="idx"
                  class="flex cursor-pointer items-center justify-between border-b border-neutral-100 px-4 py-2.5 transition-colors dark:border-neutral-800/30 last:border-none hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                  @mousedown="selectSuggestion(item)"
                >
                  <div class="flex items-center gap-2">
                    <span v-if="item.type === 'tag'" class="text-xs text-neutral-400 dark:text-neutral-500">🏷️ Tag:</span>
                    <span v-else-if="item.type === 'copyright'" class="text-xs text-neutral-400 dark:text-neutral-500">🎬 Series:</span>
                    <span v-else-if="item.type === 'character'" class="text-xs text-neutral-400 dark:text-neutral-500">👤 Character:</span>
                    <span class="text-sm text-neutral-700 font-medium dark:text-neutral-200">{{ item.label }}</span>
                  </div>
                  <span v-if="item.extra" class="text-xs text-neutral-400 font-normal italic dark:text-neutral-500">
                    {{ item.extra }}
                  </span>
                </div>
              </div>
            </transition>
          </div>

          <!-- Active Chip Filters -->
          <div v-if="selectedChips.length > 0" class="mx-auto max-w-2xl w-full flex flex-wrap items-center gap-2">
            <span class="mr-1 text-xs text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Active filters:</span>
            <div
              v-for="(chip, index) in selectedChips"
              :key="index"
              class="flex items-center gap-1 border border-primary-500/30 rounded-lg bg-primary-500/5 px-2.5 py-1 text-xs text-primary-500 font-medium dark:text-primary-400"
            >
              <span class="text-[10px] capitalize opacity-70">{{ chip.type }}:</span>
              <span>{{ chip.value }}</span>
              <button class="ml-1 hover:text-primary-700 dark:hover:text-white" @click="wizardStore.removeChip(index)">
                <div i-solar:close-circle-bold class="text-xs" />
              </button>
            </div>
          </div>

          <!-- Root Gender Selector Row -->
          <div class="mt-1 flex items-center justify-center gap-2.5">
            <span class="mr-2 text-xs text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Gender:</span>
            <Button
              v-for="g in ['All', 'Female', 'Male', 'Ambiguous', 'Non-Human']"
              :key="g"
              :variant="selectedGender === (g === 'All' ? null : g) ? 'primary' : 'secondary'"
              class="h-[30px] border border-neutral-200 rounded-lg px-3.5 text-xs dark:border-neutral-800"
              @click="wizardStore.setGender(g === 'All' ? null : g)"
            >
              {{ g }}
            </Button>
            <span class="mx-2 text-neutral-200 dark:text-neutral-800">|</span>
            <Button
              :variant="showOnlyModels ? 'primary' : 'secondary'"
              class="h-[30px] flex items-center gap-1 border border-neutral-200 rounded-lg px-3.5 text-xs dark:border-neutral-800"
              @click="showOnlyModels = !showOnlyModels"
            >
              <span>🎭 Has Model ({{ boundCharactersCount }})</span>
            </Button>
          </div>
        </div>

        <!-- Scrollable Character Grid -->
        <div class="flex-1 overflow-y-auto p-6" @scroll="handleScroll">
          <div v-if="filteredCharacters.length === 0" class="h-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500">
            <div i-solar:sad-ellipse-line-duotone class="mb-2 text-5xl text-neutral-300 dark:text-neutral-700" />
            <span class="text-sm">No matching characters found in catalog.</span>
          </div>

          <div v-else class="grid grid-cols-2 gap-5 lg:grid-cols-5 md:grid-cols-4 sm:grid-cols-3 xl:grid-cols-6">
            <div
              v-for="char in filteredCharacters.slice(0, displayLimit)"
              :key="char.id"
              class="group relative flex flex-col overflow-hidden border border-neutral-200 rounded-2xl bg-neutral-50/50 transition-all duration-300 dark:border-neutral-900 hover:border-neutral-300 dark:bg-neutral-900/20 dark:hover:border-neutral-800"
            >
              <!-- Card Portrait Image -->
              <div class="relative aspect-[3/4] overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                <img
                  :src="showModelPreviews[char.id] ? (getModelPreviewUrl(char.trigger) || getThumbUrl(char.trigger)) : getThumbUrl(char.trigger)"
                  alt=""
                  loading="lazy"
                  class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                >

                <!-- Selection Status Badge -->
                <div
                  v-if="selectedCharacters.some(c => c.id === char.id)"
                  class="absolute right-2 top-2 rounded-full bg-primary-500 p-1 text-white shadow-lg"
                >
                  <div i-solar:check-circle-bold class="text-sm" />
                </div>

                <!-- Hover action overlay -->
                <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                  <div class="w-full flex flex-col items-center gap-1.5 px-3">
                    <!-- Primary Add/Remove Button -->
                    <Button
                      v-if="!selectedCharacters.some(c => c.id === char.id)"
                      variant="primary"
                      class="h-[32px] w-full flex items-center justify-center gap-1 border border-primary-500/20 rounded-lg text-[10px] font-bold !text-neutral-100 active:!text-white hover:!text-white"
                      @click="wizardStore.addCharacterToBasket(char)"
                    >
                      <div i-solar:add-square-line-duotone class="text-sm" />
                      Add to World
                    </Button>
                    <Button
                      v-else
                      variant="danger"
                      class="h-[32px] w-full flex items-center justify-center gap-1 border border-red-500/20 rounded-lg text-[10px] font-bold !text-neutral-100 active:!text-white hover:!text-white"
                      @click="wizardStore.removeCharacterFromBasket(char.id)"
                    >
                      <div i-solar:trash-bin-trash-outline class="text-sm" />
                      Remove
                    </Button>
                    <!-- Secondary Model Actions (Visible if a model is bound - stacked vertically to prevent horizontal overflow) -->
                    <div v-if="hasBoundModel(char.trigger)" class="mt-1 w-full flex flex-col gap-1">
                      <Button
                        variant="secondary"
                        class="h-[26px] w-full flex items-center justify-center gap-1 border border-neutral-200 rounded-lg text-[9px] font-semibold dark:border-neutral-800 !text-neutral-200 active:!text-white hover:!text-white"
                        :class="[showModelPreviews[char.id] ? 'bg-primary-500/20 border-primary-500/40 !text-primary-400' : '']"
                        @click="showModelPreviews[char.id] = !showModelPreviews[char.id]"
                      >
                        <div i-solar:eye-bold-duotone class="text-[10px]" />
                        Preview Toggle
                      </Button>
                      <Button
                        variant="danger"
                        class="h-[26px] w-full flex items-center justify-center gap-1 border border-red-900/30 rounded-lg bg-red-950/20 text-[9px] text-red-400 font-semibold hover:bg-red-900/40"
                        @click="unbindModel(char.trigger)"
                      >
                        <div i-solar:broken-link-outline class="text-[10px]" />
                        Unbind Model
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Name Details -->
              <div class="flex flex-1 flex-col justify-between bg-neutral-50/50 p-3.5 dark:bg-neutral-950">
                <h4 class="line-clamp-1 text-xs text-neutral-800 font-bold transition-colors dark:text-neutral-200 group-hover:text-primary-500 dark:group-hover:text-primary-400">
                  {{ char.name }}
                </h4>
                <p class="line-clamp-1 mt-0.5 text-[10px] text-neutral-400 italic dark:text-neutral-500">
                  {{ wizardStore.copyrights[char.copyrightIndex] || 'Original' }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Persistent World Dock (Hotbar) -->
        <transition name="slide-up">
          <div
            v-if="selectedCharacters.length > 0"
            class="sticky bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-neutral-800 bg-neutral-950/90 px-6 py-4 backdrop-blur-lg"
          >
            <div class="flex items-center gap-4">
              <div class="flex flex-col">
                <span class="text-xs text-neutral-400 font-bold tracking-wider uppercase">World Cast</span>
                <span class="text-[10px] text-neutral-500">{{ selectedCharacters.length }} characters selected</span>
              </div>

              <!-- Cast avatars -->
              <div class="max-w-[50vw] flex items-center gap-2 overflow-x-auto py-1">
                <div
                  v-for="char in selectedCharacters"
                  :key="char.id"
                  class="group relative h-10 w-10 flex-shrink-0 cursor-pointer overflow-hidden border border-neutral-800 rounded-full transition-colors hover:border-red-500"
                  :title="`Remove ${char.name}`"
                  @click="wizardStore.removeCharacterFromBasket(char.id)"
                >
                  <img :src="getThumbUrl(char.trigger)" alt="" class="h-full w-full object-cover">
                  <div class="absolute inset-0 flex items-center justify-center bg-red-600/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <div i-solar:trash-bin-trash-bold class="text-xs text-white" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Next Action -->
            <Button
              variant="primary"
              class="h-[40px] flex items-center gap-1.5 border border-primary-500/20 rounded-xl px-5 text-xs font-bold shadow-lg shadow-primary-500/10"
              @click="handleNext"
            >
              Next: Align Roster
              <div i-solar:alt-arrow-right-bold class="text-base" />
            </Button>
          </div>
        </transition>
      </div>

      <!-- STEP 2: ROSTER SETTINGS (MODEL & VOICE BINDING) -->
      <div v-else-if="currentStep === 2" class="flex flex-1 flex-col items-center overflow-y-auto bg-neutral-950 p-6">
        <div class="max-w-4xl w-full border border-neutral-900 rounded-2xl bg-neutral-900/20 p-8 shadow-xl">
          <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h3 class="flex items-center gap-2 text-lg text-neutral-200 font-bold">
              <div i-solar:user-circle-bold-duotone class="text-primary-500" />
              Actor Alignment (Visual & Audio Settings)
            </h3>

            <Button
              v-if="selectedCharacters.length > 0"
              variant="secondary"
              class="h-8 flex items-center gap-1.5 border border-primary-500/30 rounded-xl bg-primary-500/10 px-3 text-xs text-primary-400 font-bold hover:bg-primary-500/20"
              @click="autoVoiceModalOpen = true"
            >
              <div i-solar:magic-stick-3-bold-duotone class="text-sm" />
              Auto-Assign Voices & Motions
            </Button>
          </div>

          <!-- Contextual hint strip -->
          <div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 border border-neutral-800/50 rounded-xl bg-neutral-900/60 px-4 py-2.5">
            <div class="flex items-center gap-1.5">
              <div i-solar:gallery-bold class="shrink-0 text-xs text-neutral-500" />
              <span class="text-xs text-neutral-500">Tap the avatar to bind a 3D model</span>
            </div>
            <span class="text-xs text-neutral-700">·</span>
            <div class="flex items-center gap-1.5">
              <div i-solar:user-speak-linear class="shrink-0 text-xs text-neutral-500" />
              <span class="text-xs text-neutral-500">Tap the voice button to set a TTS voice</span>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <!-- Row per character -->
            <div
              v-for="char in selectedCharacters"
              :key="char.id"
              class="flex flex-col gap-3 border border-neutral-200 rounded-2xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40"
            >
              <!-- Identity Row: Character thumb + name -->
              <div class="flex items-center gap-3">
                <div class="h-11 w-11 shrink-0 overflow-hidden border border-neutral-200 rounded-full bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
                  <img :src="getThumbUrl(char.trigger)" alt="" class="h-full w-full object-cover">
                </div>
                <div class="min-w-0 flex flex-col">
                  <span class="truncate text-sm text-neutral-800 font-bold dark:text-neutral-100">{{ char.name }}</span>
                  <span class="truncate text-xs text-neutral-400 italic dark:text-neutral-500">
                    {{ copyrights[char.copyrightIndex] || 'Original' }}
                  </span>
                </div>
              </div>

              <!-- Bindings Section -->
              <div class="flex flex-col gap-1">
                <!-- Micro-labels row -->
                <div class="flex items-center gap-3">
                  <div class="w-11 shrink-0 text-center text-[9px] text-primary-600 font-black tracking-wider uppercase dark:text-primary-400">
                    Bind
                  </div>
                  <div class="flex-1 text-[9px] text-primary-600 font-black tracking-wider uppercase dark:text-primary-400">
                    Set Voice
                  </div>
                  <div class="w-[38px] shrink-0" />
                </div>

                <!-- Controls row -->
                <div class="flex items-center gap-3">
                  <!-- Avatar circle -->
                  <div
                    class="relative shrink-0 cursor-pointer transition-transform hover:scale-105"
                    title="Select Model / Avatar"
                    @click="openModelSelector(char.id)"
                  >
                    <div class="h-11 w-11 flex items-center justify-center overflow-hidden border border-neutral-200 rounded-full bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
                      <img
                        v-if="getBoundModel(char.id)?.previewImage"
                        :src="getBoundModel(char.id)?.previewImage"
                        class="h-full w-full object-cover"
                      >
                      <div v-else class="i-solar:gallery-bold text-lg text-neutral-400 dark:text-neutral-600" />
                    </div>
                    <span
                      v-if="getBoundModel(char.id)"
                      class="absolute left-1/2 rounded bg-primary-500 px-1 text-[7px] text-neutral-950 font-black tracking-wide uppercase shadow-md -bottom-1 -translate-x-1/2"
                    >
                      {{ getBoundModel(char.id)?.format.toLowerCase().includes('live2d') ? 'L2D' : 'VRM' }}
                    </span>
                  </div>

                  <!-- Voice display pill -->
                  <div class="min-w-0 flex flex-1 items-center gap-2 border border-neutral-200 rounded-xl bg-neutral-50/70 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950/40">
                    <div i-solar:music-bold class="shrink-0 text-sm text-neutral-400 dark:text-neutral-600" />
                    <span class="truncate text-xs text-neutral-700 dark:text-neutral-300">
                      {{ boundVoices[char.id] ? (boundVoices[char.id].baseProvider === 'virtual-audio-studio' ? (speechStore.savedVoiceProfiles.find(p => p.id === boundVoices[char.id].baseVoice)?.name || 'Default Voice') : boundVoices[char.id].baseVoice) : 'Inherit Default' }}
                    </span>
                  </div>

                  <!-- Voice button -->
                  <Button
                    type="button"
                    variant="ghost"
                    class="h-[38px] w-[38px] shrink-0 border border-neutral-200 rounded-xl p-0 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/40"
                    title="Configure Voice"
                    @click="voiceCreatorOpen = true; voiceTargetCharacterId = char.id"
                  >
                    <div i-solar:user-speak-linear class="text-sm text-neutral-400" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Actions -->
          <div class="mt-8 flex items-center justify-between border-t border-neutral-200 pt-6 dark:border-neutral-800/60">
            <Button
              variant="secondary"
              class="h-[38px] flex items-center gap-1.5 border border-neutral-200 rounded-xl px-4 text-xs font-bold dark:border-neutral-800"
              @click="currentStep = 1"
            >
              <div i-solar:alt-arrow-left-bold class="text-base" />
              Back
            </Button>

            <Button
              variant="primary"
              class="h-[38px] flex items-center gap-1.5 border border-primary-500/20 rounded-xl px-5 text-xs font-bold shadow-lg shadow-primary-500/10"
              @click="handleNext"
            >
              Next: Configure Story
              <div i-solar:alt-arrow-right-bold class="text-base" />
            </Button>
          </div>
        </div>
      </div>

      <!-- STEP 3: CONTEXT & STORY PROMPTS -->
      <div v-else-if="currentStep === 3" class="flex flex-1 flex-col items-center overflow-y-auto bg-white p-6 dark:bg-neutral-950">
        <div class="max-w-xl w-full border border-neutral-200 rounded-2xl bg-neutral-50/30 p-8 shadow-xl dark:border-neutral-900 dark:bg-neutral-900/20">
          <h3 class="mb-6 flex items-center gap-2 text-lg text-neutral-800 font-bold dark:text-neutral-200">
            <div i-solar:clipboard-text-line-duotone class="text-primary-500" />
            Outline Your Story Settings
          </h3>

          <div class="flex flex-col gap-5">
            <!-- AI Suggest Strip -->
            <div class="flex items-center justify-between border border-primary-200 rounded-xl bg-primary-50/30 px-4 py-2.5 dark:border-primary-500/20 dark:bg-primary-500/5">
              <div class="flex items-center gap-2">
                <div i-solar:stars-bold-duotone class="shrink-0 text-sm text-primary-500 dark:text-primary-400" />
                <span class="text-xs text-primary-800 font-semibold dark:text-primary-300">Suggest story ideas from your cast</span>
              </div>
              <button
                class="h-[28px] flex items-center gap-1.5 border border-primary-200 rounded-lg bg-primary-500/10 px-3 text-[10px] text-primary-600 font-bold tracking-wide transition-all dark:border-primary-500/40 hover:bg-primary-500/20 dark:text-primary-300 disabled:opacity-50"
                :disabled="isSuggestingIdeas"
                @click="fetchStoryIdeas()"
              >
                <div
                  :class="isSuggestingIdeas ? 'i-solar:refresh-bold animate-spin' : 'i-solar:magic-stick-3-bold'"
                  class="text-xs"
                />
                {{ isSuggestingIdeas ? 'Thinking...' : 'Suggest' }}
              </button>
            </div>

            <!-- Suggestion Panel -->
            <div v-if="showSuggestions" class="flex flex-col gap-2">
              <!-- Skeleton loading -->
              <template v-if="isSuggestingIdeas">
                <div
                  v-for="i in 3"
                  :key="i"
                  class="h-[52px] animate-pulse border border-neutral-200 rounded-xl bg-neutral-100/50 dark:border-neutral-800 dark:bg-neutral-800/40"
                />
              </template>

              <!-- Loaded suggestions -->
              <template v-else-if="storyIdeas.length > 0">
                <button
                  v-for="(idea, idx) in storyIdeas"
                  :key="idx"
                  :class="[
                    'w-full text-left border rounded-xl px-4 py-3 transition-all cursor-pointer',
                    activeSuggestionIndex === idx
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/8'
                      : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 hover:bg-neutral-100 dark:hover:bg-neutral-800/60',
                  ]"
                  @click="applySuggestion(idx)"
                >
                  <!-- Title row with clipboard button -->
                  <div class="flex items-start justify-between gap-2">
                    <div class="text-xs text-neutral-800 font-bold leading-snug dark:text-neutral-100">
                      {{ idea.title }}
                    </div>
                    <button
                      class="shrink-0 rounded-md p-0.5 text-neutral-500 transition-colors dark:text-neutral-600 hover:text-neutral-700 focus:outline-none dark:hover:text-neutral-300"
                      :title="copiedIdx === idx ? 'Copied!' : 'Copy to clipboard'"
                      @click.stop="copyIdeaToClipboard(idx)"
                    >
                      <div
                        :class="copiedIdx === idx ? 'i-solar:check-circle-bold text-primary-400' : 'i-solar:clipboard-text-bold'"
                        class="text-[13px]"
                      />
                    </button>
                  </div>
                  <!-- Inactive: nickname · location, truncated -->
                  <div v-if="activeSuggestionIndex !== idx" class="mt-0.5 truncate text-[10px] text-neutral-500 dark:text-neutral-400">
                    <span class="italic">{{ idea.nickname }}</span> · {{ idea.location }}
                  </div>
                  <!-- Active: nickname · location (no truncate) + lore below -->
                  <template v-else>
                    <div class="text-neutral-550 mt-0.5 text-[10px] dark:text-neutral-400">
                      <span class="italic">{{ idea.nickname }}</span> · {{ idea.location }}
                    </div>
                    <div class="mt-1 text-[10px] text-neutral-600 leading-relaxed dark:text-neutral-400">
                      {{ idea.lore }}
                    </div>
                  </template>
                </button>
              </template>

              <!-- Guidance + Refine row -->
              <div v-if="!isSuggestingIdeas && storyIdeas.length > 0" class="flex items-center gap-2 pt-1">
                <input
                  v-model="suggestionGuidance"
                  type="text"
                  placeholder="Add guidance to refine ideas (e.g. I'm a girl, call me Betsie, slice-of-life AU)"
                  class="bg-neutral-55/50 flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 outline-none transition-all dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900/60 dark:text-neutral-300 placeholder-neutral-400 dark:placeholder-neutral-600"
                >
                <button
                  class="text-neutral-655 h-[34px] flex shrink-0 items-center gap-1 border border-neutral-200 rounded-xl bg-neutral-50 px-3 text-[10px] font-bold transition-all dark:border-neutral-800 dark:bg-neutral-900/60 hover:bg-neutral-100 dark:text-neutral-400 disabled:opacity-50 dark:hover:bg-neutral-800/60"
                  :disabled="isSuggestingIdeas"
                  @click="fetchStoryIdeas(suggestionGuidance)"
                >
                  <div i-solar:refresh-bold class="text-xs" />
                  Refine
                </button>
              </div>
            </div>

            <!-- User Nickname -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">What should the characters call you?</label>
              <input
                v-model="storyPrompt.nickname"
                type="text"
                placeholder="Leave blank for the AI to choose a name (e.g., 'Master', 'Detective', 'Stranger')."
                class="w-full border border-neutral-200 rounded-xl bg-neutral-50/50 px-4 py-2.5 text-sm text-neutral-800 outline-none transition-all dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900/60 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600"
              >
            </div>

            <!-- Your looks -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Your looks</label>
              <textarea
                v-model="userDescriptionInput"
                placeholder="Describe your appearance, attire, or gender representation."
                class="h-[60px] w-full resize-none border border-neutral-200 rounded-xl bg-neutral-50/50 px-4 py-2.5 text-sm text-neutral-800 outline-none transition-all dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900/60 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600"
              />
            </div>

            <!-- Your image prompt looks -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Your Image Prompt Looks</label>
              <textarea
                v-model="userImagePromptInput"
                placeholder="Detailed stable diffusion style prompt tags for your appearance (e.g. '1guy, brown hair, henley shirt, suspenders')."
                class="h-[60px] w-full resize-none border border-neutral-200 rounded-xl bg-neutral-50/50 px-4 py-2.5 text-sm text-neutral-800 outline-none transition-all dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900/60 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600"
              />
            </div>

            <!-- Include self concept checkbox -->
            <div class="flex items-start gap-2.5 border border-neutral-200 rounded-xl bg-neutral-50/50 p-3.5 dark:border-neutral-800/40 dark:bg-neutral-900/40">
              <input
                id="includeSelfConcept"
                v-model="includeSelfConcept"
                type="checkbox"
                class="mt-0.5 h-4 w-4 cursor-pointer accent-primary-500"
              >
              <div class="flex flex-col gap-0.5">
                <label for="includeSelfConcept" class="cursor-pointer text-xs text-neutral-800 font-bold dark:text-neutral-200">
                  Include Myself As Concept
                </label>
                <span class="text-[10px] text-neutral-500 leading-normal dark:text-neutral-400">
                  Enable this if your roleplay includes your own character in scenes. This creates a dedicated background concept for you (<code class="rounded bg-neutral-200 px-1 text-[9px] font-mono dark:bg-neutral-800">actor_[name]</code>) with your visual description, ensuring the AI Director can render you with a consistent look across generated images.
                </span>
              </div>
            </div>

            <!-- Setting / Location -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Where does this take place?</label>
              <textarea
                v-model="storyPrompt.setting"
                placeholder="Leave blank to let the AI suggest a fitting location (e.g., 'A rainy cafe in Tokyo', 'A fantasy medieval tavern')."
                class="h-[60px] w-full resize-none border border-neutral-200 rounded-xl bg-neutral-50/50 px-4 py-2.5 text-sm text-neutral-800 outline-none transition-all dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900/60 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600"
              />
            </div>

            <!-- Lore / Rule overrides -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Lore & Behavior Rules</label>
              <textarea
                v-model="storyPrompt.lore"
                placeholder="Describe custom personality overrides or AU rules (e.g., 'Make them tsundere', 'Set in a school AU', 'Characters are rival musicians')."
                class="h-[80px] w-full resize-none border border-neutral-200 rounded-xl bg-neutral-50/50 px-4 py-2.5 text-sm text-neutral-800 outline-none transition-all dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900/60 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600"
              />
            </div>
          </div>

          <!-- Active LLM Warning/Indicator -->
          <div class="mt-5 flex items-start gap-2 border border-neutral-200 rounded-xl bg-neutral-50/50 p-3.5 dark:border-neutral-800/40 dark:bg-neutral-900/30">
            <div i-solar:info-circle-bold class="mt-0.5 shrink-0 text-sm text-neutral-400 dark:text-neutral-500" />
            <p class="text-[10px] text-neutral-700 leading-relaxed dark:text-neutral-400">
              <span class="dark:text-neutral-350 text-neutral-800 font-bold">Note:</span> This request will be processed by <span class="text-primary-600 font-semibold dark:text-primary-400">{{ consciousnessStore.activeProvider || 'None' }}</span> / <span class="text-primary-600 font-semibold dark:text-primary-400">{{ consciousnessStore.activeModel || 'None' }}</span>. Please ensure this is a high-quality model as the next step is somewhat complex and requires high reasoning to generate properly.
            </p>
          </div>

          <!-- Bottom Actions -->
          <div class="mt-8 flex items-center justify-between border-t border-neutral-200 pt-6 dark:border-neutral-800/60">
            <Button
              variant="secondary"
              class="h-[38px] flex items-center gap-1.5 border border-neutral-200 rounded-xl px-4 text-xs font-bold dark:border-neutral-800"
              @click="currentStep = 2"
            >
              <div i-solar:alt-arrow-left-bold class="text-base" />
              Back
            </Button>

            <Button
              variant="primary"
              class="h-[38px] flex items-center gap-1.5 border border-primary-500/20 rounded-xl px-5 text-xs font-bold shadow-lg shadow-primary-500/10"
              @click="handleGenerate"
            >
              Generate Roleplay World
              <div i-solar:magic-stick-3-bold class="text-base" />
            </Button>
          </div>
        </div>
      </div>

      <!-- STEP 4: LLM INGESTION PAYLOAD PREVIEW & DASHBOARD -->
      <div v-else-if="currentStep === 4" class="flex flex-1 flex-col overflow-hidden bg-white p-6 dark:bg-neutral-950">
        <div class="mx-auto max-w-4xl w-full flex flex-1 flex-col overflow-hidden border border-neutral-200 rounded-2xl bg-neutral-50/30 p-6 shadow-xl dark:border-neutral-900 dark:bg-neutral-900/20">
          <div class="mb-4 flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800/60">
            <div>
              <h3 class="text-md flex items-center gap-2 text-neutral-800 font-bold dark:text-neutral-200">
                <div i-solar:magic-stick-3-bold-duotone class="text-primary-500" />
                Step 4: Roleplay World Proposal
              </h3>
              <p class="dark:text-neutral-505 mt-0.5 text-[10px] text-neutral-400">
                Review the synthesized world details, request refinements, or confirm card generation.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Button
                variant="secondary"
                class="h-[32px] flex items-center gap-1 border border-neutral-200 rounded-lg px-3 text-xs font-bold dark:border-neutral-800"
                @click="currentStep = 3"
              >
                <div i-solar:alt-arrow-left-bold class="text-sm" />
                Edit Settings
              </Button>
              <Button
                variant="secondary"
                class="h-[32px] flex items-center gap-1 border border-neutral-200 rounded-lg px-3 text-xs font-bold dark:border-neutral-800"
                @click="showDeveloperPayload = !showDeveloperPayload"
              >
                <div i-solar:code-bold class="text-sm" />
                {{ showDeveloperPayload ? 'Hide Payload' : 'Show Payload' }}
              </Button>
            </div>
          </div>

          <!-- Loading View -->
          <div v-if="isGenerating" class="flex flex-1 flex-col items-center justify-center gap-4">
            <div class="relative flex items-center justify-center">
              <div class="h-16 w-16 animate-spin border-4 border-primary-500/10 border-t-primary-500 rounded-full" />
              <div i-solar:magic-stick-3-bold class="absolute animate-pulse text-2xl text-primary-500" />
            </div>
            <div class="text-center">
              <h4 class="text-sm text-neutral-700 font-bold dark:text-neutral-300">
                Synthesizing Roleplay World...
              </h4>
              <p class="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                Our LLM is orchestrating the prompt mappings, dialog presets, and outfits.
              </p>
            </div>
          </div>

          <!-- Developer Payload View -->
          <div v-else-if="showDeveloperPayload" class="min-h-0 flex flex-1 flex-col gap-3">
            <span class="text-neutral-550 text-xs font-bold tracking-wide uppercase dark:text-neutral-400">Raw Ingestion Payload (Sent to LLM)</span>
            <textarea
              readonly
              class="flex-1 select-text resize-none border border-neutral-200 rounded-xl bg-neutral-50 p-4 text-xs text-neutral-800 font-mono outline-none dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-300"
              :value="JSON.stringify(synthesisPayload, null, 2)"
            />
          </div>

          <!-- Synthesis Proposal Dashboard View -->
          <div v-else-if="synthesisProposal" class="min-h-0 flex flex-1 flex-col gap-6 overflow-y-auto pr-1">
            <!-- World Header -->
            <div class="flex flex-col gap-3 border border-neutral-200 bg-neutral-50/50 p-5 dark:border-neutral-800/80 dark:bg-neutral-900/40">
              <div class="flex items-center gap-3">
                <div class="dark:bg-neutral-955 text-primary-505 h-12 w-12 flex items-center justify-center overflow-hidden border border-neutral-200 rounded-2xl bg-neutral-100 text-xl font-bold dark:border-neutral-800">
                  🏰
                </div>
                <div class="flex flex-col">
                  <span class="text-lg text-neutral-800 font-bold dark:text-neutral-100">{{ synthesisProposal.name }}</span>
                  <span class="text-xs text-neutral-400 dark:text-neutral-500">Synthesized Character Card Spec V3 Draft</span>
                </div>
              </div>
              <div class="border-t border-neutral-200 pt-3 dark:border-neutral-800/60">
                <span class="dark:text-neutral-550 mb-1 block text-[10px] text-neutral-400 font-black tracking-wider uppercase">Premise & Scenario</span>
                <p class="bg-neutral-55/50 border-l-2 border-primary-500 rounded-r py-1.5 pl-3 text-xs text-neutral-700 leading-relaxed italic dark:bg-neutral-950/40 dark:text-neutral-300">
                  "{{ synthesisProposal.scenario }}"
                </p>
              </div>
            </div>

            <!-- Cast List -->
            <div class="flex flex-col gap-3">
              <span class="text-xs text-neutral-500 font-bold tracking-wide uppercase dark:text-neutral-400">Synthesized Cast & Outfits</span>
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div
                  v-for="(actor, key) in synthesisProposal.actors"
                  :key="key"
                  class="flex flex-col gap-3 border border-neutral-200 rounded-2xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-2.5">
                      <div class="h-9 w-9 overflow-hidden border border-neutral-200 rounded-full bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950">
                        <!-- Match trig to character thumb -->
                        <img :src="getActorThumbUrl(String(key))" alt="" class="h-full w-full object-cover">
                      </div>
                      <div class="flex flex-col">
                        <span class="text-xs text-neutral-800 font-bold capitalize dark:text-neutral-200">{{ String(key).replace('actor_', '').replace(/_/g, ' ') }}</span>
                        <span class="text-[9px] text-neutral-400 dark:text-neutral-500">Outfit: {{ actor.short_description }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="border border-neutral-200 rounded-lg bg-neutral-50 p-2.5 text-[10px] text-neutral-600 dark:border-neutral-800/40 dark:bg-neutral-950/30 dark:text-neutral-400">
                    <span class="dark:text-neutral-505 mb-1 block text-[8px] text-neutral-400 font-bold uppercase">Default Greeting</span>
                    <p class="leading-normal italic">
                      {{ actor.greeting || synthesisProposal.first_mes }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Locations / Places -->
            <div class="flex flex-col gap-3">
              <span class="text-neutral-550 text-xs font-bold tracking-wide uppercase dark:text-neutral-400">Locations & Backgrounds</span>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div
                  v-for="(place, key) in synthesisProposal.places"
                  :key="key"
                  class="dark:border-neutral-850 flex flex-col gap-2 border border-neutral-200 rounded-xl bg-neutral-50/50 p-3.5 dark:bg-neutral-900/10"
                >
                  <div class="flex items-center gap-2">
                    <div i-solar:map-arrow-up-bold class="text-sm text-primary-500" />
                    <span class="text-xs text-neutral-800 font-bold dark:text-neutral-300">{{ place.name }}</span>
                  </div>
                  <p class="text-[10px] text-neutral-500 leading-relaxed dark:text-neutral-500">
                    {{ place.description }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Refinement Prompt Loop -->
            <div class="mt-auto flex flex-col gap-3 border-t border-neutral-200 pt-5 dark:border-neutral-800/60">
              <div class="flex flex-col gap-1.5">
                <label class="text-[10px] text-neutral-500 font-bold tracking-wide uppercase dark:text-neutral-400">Request Story Corrections (Optional)</label>
                <div class="flex gap-2">
                  <textarea
                    v-model="refinementGuidance"
                    placeholder="Provide correction feedback (e.g. 'Make Gura more snarky', 'Add a beach place', 'Make Chii quieter')."
                    class="dark:bg-neutral-95/60 text-neutral-850 h-[48px] flex-1 resize-none border border-neutral-200 rounded-xl bg-neutral-50 px-3 py-2 text-xs outline-none dark:border-neutral-800 focus:border-primary-500 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600"
                  />
                  <Button
                    variant="secondary"
                    class="dark:border-neutral-855 h-[48px] flex items-center justify-center gap-1 border border-neutral-200 rounded-xl px-4 text-xs font-bold"
                    @click="handleGenerate(refinementGuidance)"
                  >
                    <div i-solar:refresh-bold class="text-sm" />
                    Regenerate
                  </Button>
                </div>
              </div>

              <!-- Main Submission -->
              <div class="mt-2 flex items-center justify-between gap-3">
                <!-- Confirm: just close the wizard, no card created -->
                <Button
                  variant="secondary"
                  class="h-[38px] flex items-center gap-1.5 border border-neutral-200 rounded-xl px-4 text-xs font-bold dark:border-neutral-700"
                  @click="doConfirm"
                >
                  <div i-solar:close-circle-outline class="text-base" />
                  Confirm
                </Button>

                <div class="flex items-center gap-2">
                  <!-- Create: save card, stay on page to keep iterating -->
                  <Button
                    variant="secondary"
                    class="h-[38px] flex items-center gap-1.5 border border-neutral-200 rounded-xl px-4 text-xs font-bold dark:border-neutral-700 hover:border-primary-500/40"
                    @click="doCreateCard"
                  >
                    <div i-solar:card-send-outline class="text-base" />
                    Create
                  </Button>

                  <!-- Confirm & Create: save card then close -->
                  <Button
                    variant="primary"
                    class="h-[38px] flex items-center gap-1.5 border border-primary-500/20 rounded-xl px-5 text-xs font-bold shadow-lg shadow-primary-500/15"
                    @click="confirmCreateCard"
                  >
                    Confirm & Create
                    <div i-solar:check-circle-bold class="text-base" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dialog Components -->
      <ModelSelectorDialog
        v-model:show="modelSelectorOpen"
        :selected-model="activeBindingCharacterModel"
        @pick="handlePickModel"
      />

      <!-- Quick Audio Studio Creator Modal Overlay -->
      <VoiceCreatorModal
        v-model="voiceCreatorOpen"
        :character-name="voiceTargetCharacterId ? selectedCharacters.find(c => c.id === voiceTargetCharacterId)?.name : undefined"
        :character-gender="voiceTargetCharacterId ? (wizardStore.facets.gender[Number(selectedCharacters.find(c => c.id === voiceTargetCharacterId)?.traits[0] || 0)] || undefined) : undefined"
        @save="(payload) => {
          if (voiceTargetCharacterId) {
            wizardStore.bindVoiceToCharacter(voiceTargetCharacterId, payload)
            writeBackVoiceBinding(voiceTargetCharacterId, payload)
          }
        }"
      />

      <AutoVoiceConfigModal
        v-model="autoVoiceModalOpen"
        :selected-characters="selectedCharacters"
        :copyrights="wizardStore.copyrights"
        :genders="wizardStore.facets.gender"
        :bound-models="boundModels"
        @apply="handleApplyAutoVoices"
      />
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
