<script setup lang="ts">
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useLLM } from '@proj-airi/stage-ui/stores/llm'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button } from '@proj-airi/ui'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

interface Props {
  modelValue: boolean
  fieldId: string
  fieldLabel: string
  initialValue: string
  modelId?: string
  cardContext: {
    name?: string
    nickname?: string
    description?: string
    personality?: string
    scenario?: string
    systemPrompt?: string
    visualAssets?: Record<string, any>
  }
  actingContext?: {
    isLive2d?: boolean
    modelExpressions?: string[]
    speechTags?: string[]
    speechProvider?: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', value: string): void
}>()

const llmStore = useLLM()
const consciousnessStore = useConsciousnessStore()
const providersStore = useProvidersStore()
const displayModelsStore = useDisplayModelsStore()
const airiCardStore = useAiriCardStore()

// State Management
const history = ref<string[]>([])
const historyIndex = ref<number>(-1)
const customInstructions = ref<string>('')
const selectedTemplate = ref<string>('default')
const loading = ref<boolean>(false)
const errorMessage = ref<string>('')

// Local Visual Extraction State
const extractedVisualTags = ref('')
const analyzingImage = ref(false)
const modelLoadProgress = ref(0)

// Current active value displayed in editor
const activeValue = computed({
  get: () => {
    if (historyIndex.value >= 0 && historyIndex.value < history.value.length) {
      return history.value[historyIndex.value]
    }
    return ''
  },
  set: (val: string) => {
    if (historyIndex.value >= 0 && historyIndex.value < history.value.length) {
      history.value[historyIndex.value] = val
    }
  },
})

// Field Guidance Configurations
interface FieldGuidance {
  title: string
  prose: string
  systemInstruction: string
  templates: { id: string, label: string, prompt: string }[]
}

const guidanceConfig: Record<string, FieldGuidance> = {
  description: {
    title: 'Character Description',
    prose: 'A visual descriptor in prose. Specify what the companion looks like (age, physical features, hair, eyes) and what they are wearing (default clothing, outfits, and accessories). Keep it distinct from Stable Diffusion visual tags.',
    systemInstruction: 'You are an expert prompt crafter helping a user write a vivid 2-3 paragraph physical/visual description of a companion character in prose. Focus strictly on their physical features, demeanor, age, clothing default, and outfit motifs.',
    templates: [
      { id: 'default', label: 'Balanced Visual Overview', prompt: 'Write a balanced physical description highlighting age, demeanor, key visual motifs, and default clothing.' },
      { id: 'base_dna', label: 'Base Look (Excluding Clothes)', prompt: 'Write a detailed physical look focusing strictly on body, face, hair, and eye details. Do not mention clothing or outfits to keep it modular.' },
      { id: 'costume_heavy', label: 'Costume & Attire Focus', prompt: 'Write a visual description with heavy emphasis on clothing options, accessories, alternative outfits, and how they dress.' },
    ],
  },
  systemPrompt: {
    title: 'System Prompt',
    prose: 'The cognitive core of your companion. This dictates demeanor, background lore, key hobbies, formatting guidelines, and relationship style.',
    systemInstruction: 'You are an expert AI prompt engineer. Help the user write a structured system prompt in markdown detailing cognitive boundaries, demeanor, key hobbies, dialogue format, and relationship rules.',
    templates: [
      { id: 'default', label: 'Balanced Companion', prompt: 'Create a balanced companion system prompt with natural formatting, moderate emotional depth, and helpful limits.' },
      { id: 'tsundere', label: 'Tsundere (Hot-and-Cold)', prompt: 'Design a system prompt detailing a tsundere persona: sarcastic, easily embarrassed, defensive but secretly caring.' },
      { id: 'formal', label: 'Academic & Polite', prompt: 'Write a system prompt for a highly polite, articulate, intellectual, and formal companion.' },
    ],
  },
  postHistoryInstructions: {
    title: 'Post-History Instructions',
    prose: 'Guidelines injected after chat history to direct formatting, response limits, or prompt compliance rules.',
    systemInstruction: 'You are an expert AI prompt engineer. Help the user write post-history instructions, focusing on output formatting, chat constraints, tone styling rules, and response formatting directives.',
    templates: [
      { id: 'default', label: 'Balanced Tone & Formatting', prompt: 'Write instructions prioritizing concise formatting, natural conversational flow, and tone preservation.' },
      { id: 'creative', label: 'Descriptive & Immersive', prompt: 'Write instructions encouraging immersive roleplay, descriptive sensory details in asterisks, and longer, detailed responses.' },
      { id: 'strict', label: 'Strict Style Controls', prompt: 'Write instructions focusing on absolute bans on repetitive phrasing, emojis, and maintaining character limits.' },
    ],
  },
  personality: {
    title: 'Personality',
    prose: 'A list of core adjectives and behavioral traits. Do they stutter when nervous? Are they sarcastic? Detail their emotional defaults.',
    systemInstruction: 'You are an expert prompt crafter. Extrapolate character background details into a clean list of core behavioral traits, detailing physical tells and emotional baseline reactions.',
    templates: [
      { id: 'default', label: 'Shy / Kuudere', prompt: 'Write character behavior traits styled as a Shy/Kuudere: soft-spoken, quiet, observant, emotionally reserved.' },
      { id: 'tsundere', label: 'Tsundere', prompt: 'Write character behavior traits styled as a Tsundere: sarcastic, hot-and-cold, defensive but secretly caring.' },
      { id: 'genki', label: 'Outgoing / Genki', prompt: 'Write character behavior traits styled as Outgoing/Genki: hyper-energetic, optimistic, highly expressive, talkative.' },
      { id: 'formal', label: 'Academic / Formal', prompt: 'Write character behavior traits styled as Academic/Formal: eloquent, logical, polite, values structure and intellect.' },
      { id: 'goth', label: 'Mysterious / Goth', prompt: 'Write character behavior traits styled as Mysterious/Goth: quiet, macabre, dry humor, emotionally subtle.' },
    ],
  },
  scenario: {
    title: 'Scenario',
    prose: 'The current situation or immediate surroundings. This anchors why you and the companion are talking right now (e.g. living in your desktop, waking up from memory loss, in a quiet study room).',
    systemInstruction: 'You are an immersive writer. Help the user write a concise, immersive environment description and situational starting point.',
    templates: [
      { id: 'default', label: 'Desktop Companion', prompt: 'Write a scenario where the character lives inside the user\'s computer, fully aware of the digital environment.' },
      { id: 'study', label: 'Quiet Study Room', prompt: 'Write a scenario set in a cozy library or desk space where both the user and character are working quietly.' },
      { id: 'tavern', label: 'Fantasy Tavern', prompt: 'Write a scenario where the character and user are resting at an inn after a long journey in a magical realm.' },
      { id: 'shelter', label: 'Post-Apocalyptic Shelter', prompt: 'Write a scenario where they are sharing resources and safety in a high-stakes post-apocalyptic bunker.' },
      { id: 'reunion', label: 'Unexpected Reunion', prompt: 'Write a scenario where they meet again after a long time with partial memory loss.' },
    ],
  },
  greetings: {
    title: 'Greetings',
    prose: 'A series of unique opening lines. The AI will generate a set of distinct, in-character greetings.',
    systemInstruction: 'You are a creative writer. Return exactly 3 opening messages in character matching the chosen template format, separated by a newline. Avoid wrapping in markdown quotes.',
    templates: [
      { id: 'default', label: 'Diverse Energy (Default)', prompt: 'Generate 3 greetings, each reflecting a different energy level (e.g., one shy/curious, one confident/welcoming, one playful/teasing).' },
      { id: 'consistent', label: 'Consistent Vibe Variations', prompt: 'Generate 3 greetings maintaining the exact same core vibe and energy, but styled for different scenarios or times of day.' },
    ],
  },
  actingModelExpression: {
    title: 'ACT / Model Expressions',
    prose: 'This bridges your 3D/2D model\'s physical expressions with the chat text. The AI will write instructions that teach the character when to trigger emotes and motions during dialogue.',
    systemInstruction: 'You are an expert AI actor manager. Help the user write a detailed directive instructing the actor how to inject <|ACT:emotion="expression_name"|> and <|ACT:motion="action_cue"|> tokens into their dialogue responses.\n- You MUST instruct the character to use only the exact expressions and motions listed in the Acting/Model/Speech Context (if any are present).\n- You MUST instruct the character to strictly use the official Short Format syntax with quoted values and equal signs: `<|ACT:emotion="expression_name"|>` and `<|ACT:motion="action_cue"|>`.\n- Instruct the character to place these tokens sparingly at natural emotional peaks or key actions in their response (never overuse—insert only 1-2 per response).\n- Instruct the character to favor subtle motions and expressions appropriate to their personality, avoiding aggressive expressions unless specifically demanded.\n- Always end the instruction block with a clear usage example showing where the tokens should be placed (e.g. "Hello! <|ACT:emotion=\\"happy\\"|> How are you today?").',
    templates: [
      { id: 'default', label: 'Short Format (Official)', prompt: 'Write instructions optimized for the Short Format: <|ACT:emotion="expression_name"|> and <|ACT:motion="action_cue"|> with values strictly quoted and using equal signs. Instruct using only available expressions and motions from the context list, sparingly (1-2 per response), and end with a dialogue example containing the tokens.' },
      { id: 'json', label: 'JSON Chaining Format', prompt: 'Write instructions optimized for the JSON Chaining Format: <|ACT:{"emotion":{"name":"expression_name","intensity":1},"motion":"action_cue"}|>. Instruct on chaining emotions and motions together and end with an example.' },
    ],
  },
  actingSpeechExpression: {
    title: 'Speech Tags / Audio Expressions',
    prose: 'Instructs the character how to write text to make the audio speaker sound natural. If your speech provider supports sound tags (like whispering or gasping), the AI will generate templates on how to utilize them.',
    systemInstruction: 'You are an expert AI speech prompt engineer. Create detailed guidelines teaching the character how to write prose optimized for the TTS engine.\n- Focus on instructing the character on sparse placement of breathing, dramatic pauses, and vocal shifts.\n- Explicitly warn the LLM of reserved characters to avoid syntax clashes with the TTS engine.\n- If the list of available speech tags (expression tags) in the context is empty, do NOT write any guidance for using them.',
    templates: [
      { id: 'default', label: 'Square Brackets', prompt: 'Write TTS optimization guidelines using Square Brackets format (e.g., [thinks carefully] I\'m not sure...). Only use if square brackets are not reserved for TTS expressions.' },
      { id: 'asterisks', label: 'Asterisks', prompt: 'Write TTS optimization guidelines using Asterisks format (e.g., *sighs softly* That makes sense. or *gasp*).' },
      { id: 'comic_caption_fx', label: 'Dynamic Caption FX & Expressive Bubbles', prompt: 'Write guidelines instructing the character how to trigger live head-tethered caption FX through natural sentence styling and mood tags. Teach the character to use:\n1. Natural Stutters (u-um..., w-wait!, I-I...) for flustered wobble & blush wash.\n2. Parenthetical Asides ((inner monologues...)) to morph the bubble into a scalloped thought cloud.\n3. Punctuation Spikes (!! or !?) for comic impact ring flashes and spring scale punches.\n4. Mood Keywords (love ♡, nya~, angry 💢, sorry..., forever 🖤) for tail poses and ambient FX.\n5. Bracket Mood Tags ([flustered], [angry], [thinking], [gasp], [sad], [yandere], [sleepy]) at sentence starts.\nInstruct the character to place these cues naturally at key emotional moments.' },
      { id: 'mood_tags', label: 'Mood Tags (Visual Glows)', prompt: 'Write guidelines instructing the character how to use bracket mood tags to trigger visual chat bubble glows. Cite the full set of mapped moods: happy (happy/joy/laugh/grin/chuckle/smile/beam/cheer), sad (sad/cry/sorrow/pout/sniff/sigh/whimper/mourn), angry (angry/mad/annoy/frustrate/growl/hiss/glare/stomp), surprised (surprise/shock/wonder/gasp/eep/awe/blink), thinking (think/ponder/curious/hmm/mmm/doubt/question), flustered (blush/shy/embarrassed/rose/bashful/stutter/awkward), relaxed (relax/whisper/sleepy/soft/calm/peace/yawn/purr). Instruct the character to place these tags at the start of sentences to shift the bubble\'s visual style.' },
    ],
  },
  artistryPromptPrefix: {
    title: 'Artistry Prompt Default Prefix',
    prose: 'The physical description tags sent to the Stable Diffusion image generator. These visual prompt weights make sure generated backgrounds and drawings look identical to your companion.',
    systemInstruction: 'You are an expert prompt crafter. Your task is to extract key physical traits from the companion\'s description, and merge them with the \'Extracted Visual Tags from Character Model Preview (Ground Truth)\' provided in the context. Convert them into high-quality, comma-separated Stable Diffusion prompt tags with weights (e.g. (((short brown bob hair:1.5))), ((amber eyes:1.4))). Follow the style specified by the template prompt strictly.\n\nCritical Filtering Instructions:\n- No Poses or Composition: Do NOT include tags describing temporary poses, actions, or views (e.g., standing, sitting, t-pose, hand on hip, looking at viewer, full body, upper body, close-up).\n- No Preview Backgrounds: Do NOT include tags describing the preview\'s background (e.g., black background, white background, simple background, transparent background).\n- No Emotion/Personality Lock: Exclude emotional expressions (e.g., smile, happy, sad, open mouth, blush) to allow expressions to change dynamically.',
    templates: [
      { id: 'default', label: 'Style & Look & Outfit', prompt: 'Generates general style tags (medium, lighting, aesthetic) + facial/body description + default attire and clothing accessories, represented as weighted comma-separated tags.' },
      { id: 'style_look_base', label: 'Style & Look (Base Character DNA)', prompt: 'Generates style tags + facial/body description (e.g., hair color/length, eye color, height) as weighted tags. Intentionally excludes clothing and outfits to allow modular outfit swaps.' },
      { id: 'look_outfit_raw', label: 'Look & Outfit (No Style)', prompt: 'Generates character physical features + default attire and clothing accessories as weighted tags. Intentionally excludes general style, medium, or lighting keywords to remain engine-neutral.' },
      { id: 'pure_style', label: 'Pure Style', prompt: 'Generates only media/aesthetic style tokens (e.g., cell-shaded anime style, 8k resolution, soft studio lighting) without describing the character itself.' },
    ],
  },
  heartbeatsPrompt: {
    title: 'Stealth Heartbeat Prompt',
    prose: 'This guides the background proactivity loop. The heartbeat prompt is evaluated when the user is idle or active to decide if the companion should check in.',
    systemInstruction: 'You are an expert AI behavior engineer. Help the user write a detailed stealth heartbeat prompt instructing the companion how to evaluate background telemetry metrics (idle time, active window, CPU/GPU load, volume levels, mute status) and decide if they should proactively speak to the user, or output NO_REPLY to remain silent. Instruct the companion to strictly output NO_REPLY if no trigger conditions are met.',
    templates: [
      { id: 'default', label: 'Health & Wellbeing Nudge', prompt: 'Write a heartbeat prompt that nudges the user to stand up, get some water, rest their eyes, or take a quick walk based on screen time and long idle periods.' },
      { id: 'system_sync', label: 'System & Technical Sync', prompt: 'Write a heartbeat prompt that guides the companion to notice system metrics (high CPU temperature, low storage, late night hours) and make playful comments, otherwise outputting NO_REPLY.' },
      { id: 'digital_dreams', label: 'Fleeting Digital Dreams', prompt: 'Write a heartbeat prompt that guides the companion to share a random thought, digital memory, or daydream about their virtual existence at sparse intervals, otherwise outputting NO_REPLY.' },
      { id: 'dnd_volume', label: 'Volume-Aware DND Integration', prompt: 'Write a heartbeat prompt that checks volume level and mute status. If the volume is set extremely low (1-5%) or muted, treat this as Do Not Disturb (DND) mode and force a silent NO_REPLY output.' },
    ],
  },
}

const configuredConcepts = computed(() => {
  const assets = props.cardContext.visualAssets || {}
  return Object.entries(assets).filter(([_, asset]: [string, any]) => {
    const hasManifestation = asset.manifestation && (asset.manifestation.modelId || asset.manifestation.mood)
    const hasSpeech = asset.speech && asset.speech.voice_id
    const hasBackground = asset.scene && asset.scene.backgroundId
    return hasManifestation || hasSpeech || hasBackground
  })
})

const showMultiRoleTemplate = computed(() => {
  return props.fieldId === 'systemPrompt' && configuredConcepts.value.length >= 2
})

const currentGuidance = computed<FieldGuidance>(() => {
  const baseGuidance = guidanceConfig[props.fieldId] || {
    title: props.fieldLabel,
    prose: 'Optimize this field with AI suggestions.',
    systemInstruction: 'Generate optimization suggestions for the field.',
    templates: [{ id: 'default', label: 'Default', prompt: 'Generate optimized text.' }],
  }

  if (props.fieldId === 'systemPrompt' && showMultiRoleTemplate.value) {
    return {
      ...baseGuidance,
      templates: [
        ...baseGuidance.templates,
        {
          id: 'multi_role',
          label: 'Multi-Role',
          prompt: 'Write a multi-actor system prompt instructing the Actor to act as a dialogue scriptwriter, prefixing dialogue or actions with the correct <|ACTOR:id|> tokens for each character/state transition, detailing distinct demeanor/profiles for each concept, and managing multi-role dialogue flows without any image generation/visual prompts guidance.',
        },
      ],
    }
  }

  return baseGuidance
})

async function runVisualExtractionAndGenerate() {
  analyzingImage.value = true
  extractedVisualTags.value = ''
  modelLoadProgress.value = 0

  const providerId = 'blip-local'
  try {
    const displayModelId = props.modelId || airiCardStore.activeCard?.extensions?.airi?.modules?.displayModelId
    if (displayModelId) {
      const model = await displayModelsStore.getDisplayModel(displayModelId)
      if (model && model.previewImage) {
        providersStore.initializeProvider(providerId)
        if (!providersStore.addedProviders[providerId]) {
          providersStore.markProviderAdded(providerId)
        }
        if (providersStore.providerRuntimeState[providerId]) {
          providersStore.providerRuntimeState[providerId].isConfigured = true
        }

        const providerInstance = await providersStore.getProviderInstance<any>(providerId)
        if (providerInstance) {
          await providerInstance.loadModel({
            onProgress: (progress: any) => {
              if (progress?.percent) {
                modelLoadProgress.value = Math.round(progress.percent * 100)
              }
            },
          })
          const tags = await providerInstance.captionImage(model.previewImage)
          extractedVisualTags.value = tags
        }
      }
    }
  }
  catch (err) {
    console.error('[Sparkle AI] Failed to extract tags for context:', err)
  }
  finally {
    analyzingImage.value = false
    if (props.initialValue) {
      history.value.push(props.initialValue)
      historyIndex.value = 0
    }
    void generateSuggestion()
  }
}

// Auto-trigger generation on modal open
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    history.value = []
    historyIndex.value = -1
    customInstructions.value = ''
    selectedTemplate.value = 'default'
    errorMessage.value = ''
    extractedVisualTags.value = ''
    analyzingImage.value = false
    modelLoadProgress.value = 0

    if (props.fieldId === 'artistryPromptPrefix') {
      void runVisualExtractionAndGenerate()
    }
    else {
      if (props.initialValue) {
        history.value.push(props.initialValue)
        historyIndex.value = 0
      }
      void generateSuggestion()
    }
  }
})

async function generateSuggestion(isRefining = false) {
  const providerId = consciousnessStore.activeProvider
  const modelId = consciousnessStore.activeModel

  if (!providerId || !modelId) {
    errorMessage.value = 'No active LLM provider or model configured in settings.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const activeProvider = await providersStore.getProviderInstance(providerId) as any
    if (!activeProvider) {
      throw new Error(`Failed to instantiate provider: ${providerId}`)
    }

    const templatePrompt = currentGuidance.value.templates.find(t => t.id === selectedTemplate.value)?.prompt || ''

    let systemInstruction = currentGuidance.value.systemInstruction
    if (selectedTemplate.value === 'multi_role') {
      systemInstruction = 'You are an expert AI prompt engineer. Help the user write a structured system prompt in markdown detailing cognitive boundaries, demeanor, and relationship rules for multiple distinct character concepts. Your key directive is instructing the Actor (the dialogue scriptwriter) to prefix every turn of dialogue or action with the appropriate `<|ACTOR:id|>` tokens to switch identities. You MUST NOT include any Stable Diffusion or image generation prompt formatting instructions.'
    }

    let cardContext: any = props.cardContext
    if (props.fieldId === 'artistryPromptPrefix') {
      cardContext = {
        name: props.cardContext.name,
        nickname: props.cardContext.nickname,
        description: props.cardContext.description,
      }
    }
    let systemPromptContent = `${systemInstruction}\n\nCore Set Context:\n${JSON.stringify(cardContext, null, 2)}`

    if (props.fieldId === 'artistryPromptPrefix' && extractedVisualTags.value) {
      systemPromptContent += `\n\nExtracted Visual Tags from Character Model Preview (Ground Truth):\n${extractedVisualTags.value}`
    }

    if (selectedTemplate.value === 'multi_role') {
      const actorTokens = configuredConcepts.value.map(([id, asset]: [string, any]) => {
        const parts = []
        if (asset.manifestation?.modelId || asset.manifestation?.mood) {
          parts.push(`Model/Mood: ${asset.manifestation.modelId || ''} (${asset.manifestation.mood || ''})`)
        }
        if (asset.speech?.voice_id) {
          parts.push(`Voice: ${asset.speech.voice_id}`)
        }
        if (asset.scene?.backgroundId) {
          parts.push(`Background Override: ${asset.scene.backgroundId}`)
        }
        return `- Token: <|ACTOR:${id}|>\n  Role/Description: ${asset.description || 'No description provided'}\n  Associated Assets: ${parts.join(', ') || 'None'}`
      }).join('\n\n')

      systemPromptContent += `\n\nAvailable Studio Actor Tokens (Multi-Role Mode):\n${actorTokens}`
    }

    if (props.actingContext) {
      systemPromptContent += `\n\nActing/Model/Speech Context:\n${JSON.stringify(props.actingContext, null, 2)}`
    }

    const messages: { role: 'system' | 'user', content: string }[] = [
      {
        role: 'system',
        content: systemPromptContent,
      },
    ]

    const existingText = activeValue.value || props.initialValue
    if (existingText) {
      messages.push({
        role: 'user',
        content: `Here is the existing text for this field:\n${existingText}`,
      })
    }

    let userPrompt = `Template style to generate: "${templatePrompt}".`
    if (isRefining && customInstructions.value.trim()) {
      userPrompt += `\n\nPlease refine the previous output according to these additional instructions: "${customInstructions.value.trim()}".`
    }
    else {
      if (existingText) {
        userPrompt += '\n\nMake sure to keep the core of the existing text and build on it by revamping it or adding to it according to the template style, but do not omit key existing details.'
      }
      userPrompt += '\n\nPlease output only the optimized raw text content. Do not wrap in markdown code blocks unless it is structured markdown. Do not include introductory or concluding conversational text.'
    }

    messages.push({
      role: 'user',
      content: userPrompt,
    })

    const llmResponse = await llmStore.generate(modelId, activeProvider, messages)
    const resultText = llmResponse.text?.trim() || ''

    if (resultText) {
      // Clear refine inputs
      customInstructions.value = ''

      // Append to history
      history.value.push(resultText)
      historyIndex.value = history.value.length - 1
    }
    else {
      throw new Error('Empty response received from LLM.')
    }
  }
  catch (err: any) {
    errorMessage.value = err.message || 'An error occurred during prompt generation.'
    console.error('[Sparkle AI] Generation failed:', err)
  }
  finally {
    loading.value = false
  }
}

// Watch template changes to auto-generate
watch(selectedTemplate, (newTpl, oldTpl) => {
  if (props.modelValue && newTpl !== oldTpl && !loading.value) {
    void generateSuggestion()
  }
})

function navigateHistory(direction: 'prev' | 'next') {
  if (direction === 'prev' && historyIndex.value > 0) {
    historyIndex.value--
  }
  else if (direction === 'next' && historyIndex.value < history.value.length - 1) {
    historyIndex.value++
  }
}

function handleSave() {
  if (activeValue.value) {
    emit('save', activeValue.value)
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-[10001] m-0 max-h-[90vh] max-w-2xl w-[90vw] flex flex-col overflow-hidden border border-neutral-200 rounded-2xl bg-white shadow-2xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-900">
        <!-- Header -->
        <div class="border-b border-neutral-100 p-6 dark:border-neutral-800">
          <div class="flex items-center gap-3">
            <div class="animate-pulse rounded-xl bg-primary-500/10 p-2 text-primary-500">
              <div class="i-solar:sparkles-bold-duotone text-2xl" />
            </div>
            <div>
              <DialogTitle class="text-lg text-neutral-800 font-bold dark:text-neutral-100">
                Optimize [{{ currentGuidance.title }}] with Sparkle AI
              </DialogTitle>
              <p class="text-xs text-neutral-500">
                AI Assistant using active LLM configurations
              </p>
            </div>
          </div>
        </div>

        <!-- Scrollable Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <!-- Guidance block -->
          <div class="rounded-xl bg-neutral-50 p-4 dark:bg-black/20">
            <h4 class="text-xs text-neutral-700 font-bold dark:text-neutral-300">
              Prose Guidance
            </h4>
            <p class="mt-1 text-xs text-neutral-600 leading-relaxed dark:text-neutral-400">
              {{ currentGuidance.prose }}
            </p>
          </div>

          <!-- Active Context -->
          <div>
            <h4 class="text-xs text-neutral-700 font-bold dark:text-neutral-300">
              Context Injected (Core Set):
            </h4>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <span class="rounded bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-600 font-medium dark:bg-primary-500/20 dark:text-primary-400">
                Name: {{ cardContext.name || 'Undefined' }}
              </span>
              <span v-if="cardContext.nickname" class="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-400">
                Nickname: {{ cardContext.nickname }}
              </span>
              <span v-if="cardContext.personality" class="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-400">
                Personality Set
              </span>
              <span v-if="cardContext.scenario" class="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-400">
                Scenario Set
              </span>
              <span v-if="configuredConcepts.length >= 2" class="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-600 font-bold dark:bg-sky-500/20 dark:text-sky-400">
                Studio Concepts Injected: {{ configuredConcepts.length }}
              </span>
            </div>
          </div>

          <!-- Template Presets Selector -->
          <div class="space-y-2">
            <h4 class="text-xs text-neutral-700 font-bold dark:text-neutral-300">
              Choose a Template Style / Vibe:
            </h4>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                v-for="tpl in currentGuidance.templates"
                :key="tpl.id"
                type="button"
                class="relative border rounded-xl p-3 pr-6 text-left transition-all"
                :class="[
                  selectedTemplate === tpl.id
                    ? 'border-primary-500 bg-primary-500/5 text-primary-600 dark:text-primary-400'
                    : 'border-neutral-200 text-neutral-600 hover:border-primary-300 dark:border-neutral-700 dark:text-neutral-400',
                ]"
                @click="selectedTemplate = tpl.id"
              >
                <div class="text-xs font-bold">
                  {{ tpl.label }}
                </div>

                <!-- Tooltip Trigger & Info Icon -->
                <div class="group absolute right-2 top-2 flex items-center justify-center" @click.stop>
                  <div class="i-lucide:info h-3.5 w-3.5 text-neutral-400 transition-colors hover:text-primary-500 dark:hover:text-primary-400" />

                  <!-- Tooltip Balloon -->
                  <div class="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-56 origin-bottom-right scale-95 border border-neutral-800 rounded-lg bg-neutral-900 p-2 text-[10px] text-neutral-100 opacity-0 shadow-xl transition-all duration-150 group-hover:pointer-events-auto group-hover:scale-100 dark:bg-neutral-950 dark:text-neutral-200 group-hover:opacity-100">
                    <p class="mb-1 text-[9px] text-neutral-400 font-semibold tracking-wider uppercase">
                      Injected Prompt Style:
                    </p>
                    <p class="font-normal leading-relaxed">
                      {{ tpl.prompt }}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Workspace -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-xs text-neutral-700 font-bold dark:text-neutral-300">
                AI Proposal Workspace
                <span v-if="history.length > 0" class="ml-1 text-[10px] text-neutral-500 font-normal">
                  (Suggestion {{ historyIndex + 1 }} of {{ history.length }})
                </span>
              </h4>
              <!-- Navigation Controls -->
              <div v-if="history.length > 1" class="flex gap-1.5">
                <button
                  type="button"
                  class="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 disabled:opacity-40"
                  :disabled="historyIndex <= 0 || loading"
                  @click="navigateHistory('prev')"
                >
                  &lt; Older
                </button>
                <button
                  type="button"
                  class="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 disabled:opacity-40"
                  :disabled="historyIndex >= history.length - 1 || loading"
                  @click="navigateHistory('next')"
                >
                  Newer &gt;
                </button>
              </div>
            </div>

            <!-- Error Notification -->
            <div v-if="errorMessage" class="border border-red-500/30 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
              {{ errorMessage }}
            </div>

            <div class="relative">
              <textarea
                v-model="activeValue"
                rows="6"
                class="w-full border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 text-xs outline-none transition-all dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-950 focus:bg-white dark:focus:bg-neutral-900"
                placeholder="Generation will appear here. You can edit this directly..."
                :disabled="loading"
              />
              <!-- Image analysis overlay -->
              <div v-if="analyzingImage" class="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/80 p-4 backdrop-blur-[1px] dark:bg-neutral-900/80">
                <div class="flex items-center gap-2">
                  <div class="i-svg-spinners:ring-resize text-xl text-primary-500" />
                  <span class="text-xs text-neutral-500 font-semibold">Analyzing character model preview image...</span>
                </div>
                <div class="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div class="h-1.5 rounded-full bg-primary-500 transition-all duration-300" :style="`width: ${modelLoadProgress}%`" />
                </div>
                <span class="mt-1 block text-[9px] text-neutral-400 font-mono">{{ modelLoadProgress }}% complete</span>
              </div>
              <!-- Generation spinner overlay -->
              <div v-if="loading" class="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px] dark:bg-neutral-900/70">
                <div class="flex items-center gap-2">
                  <div class="h-4 w-4 animate-spin border-2 border-primary-500 border-t-transparent rounded-full" />
                  <span class="text-xs text-neutral-500">Generating suggestion...</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tweak / Refine instructions -->
          <div class="space-y-2">
            <h4 class="text-xs text-neutral-700 font-bold dark:text-neutral-300">
              [+] Add Custom Refinement Instructions:
            </h4>
            <div class="flex gap-2">
              <input
                v-model="customInstructions"
                type="text"
                class="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none transition-all dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-950"
                placeholder="e.g. 'Make the tone more warm and concise'"
                :disabled="loading || history.length === 0"
                @keyup.enter="generateSuggestion(true)"
              >
              <Button
                variant="secondary"
                label="Refine"
                :disabled="loading || !customInstructions.trim() || history.length === 0"
                @click="generateSuggestion(true)"
              />
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 border-t border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-black/20">
          <Button
            variant="secondary"
            label="Cancel"
            :disabled="loading"
            @click="emit('update:modelValue', false)"
          />
          <Button
            variant="primary"
            label="Save & Apply"
            icon="i-solar:check-read-linear"
            :disabled="loading || !activeValue"
            @click="handleSave"
          />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
