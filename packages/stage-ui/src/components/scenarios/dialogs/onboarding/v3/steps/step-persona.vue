<script setup lang="ts">
import type { SynthesisProposal } from '../../../../../../composables/use-card-synthesis'
import type { StoryProposalItem } from '../stores/useOnboardingV3Draft'

import { SPOTLIGHT_MODELS } from '@proj-airi/stage-ui/constants'
import { STARTER_CHARACTERS } from '@proj-airi/stage-ui/constants/prompts/character-defaults'
import { Button } from '@proj-airi/ui'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import CardImportWizard from '../../../../../../../../stage-pages/src/pages/settings/airi-card/components/CardImportWizard.vue'
import AssistantBubble from '../components/assistant-bubble.vue'

import { parseActor } from '../../../../../../composables/queues'
import { stripMarkers, stripPacingEnvelopes } from '../../../../../../composables/response-categoriser'
import {
  compileCardBundle,
  deterministicActorKey,

  useCardSynthesis,
} from '../../../../../../composables/use-card-synthesis'
import { useAnimaDexWizardStore } from '../../../../../../stores/animadex-wizard'
import { useDisplayModelsStore } from '../../../../../../stores/display-models'
import { useConsciousnessStore } from '../../../../../../stores/modules/consciousness'
import { useProvidersStore } from '../../../../../../stores/providers'
import { formatActorName } from '../../../../../markdown/actor-colors'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'
import { buildArtistryPromptFromPersona } from '../types'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()
const presetLive2dPreview = new URL('../../../../../../assets/live2d/models/hiyori/preview.png', import.meta.url).href
const presetVrmAvatarAPreview = new URL('../../../../../../assets/vrm/models/AvatarSample-A/preview.png', import.meta.url).href
const presetVrmAvatarBPreview = new URL('../../../../../../assets/vrm/models/AvatarSample-B/preview.png', import.meta.url).href

const { t } = useI18n()

const draft = useOnboardingV3Draft()
const displayModelsStore = useDisplayModelsStore()
const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const wizardStore = useAnimaDexWizardStore()

type PersonaTab = 'creator' | 'presets' | 'hub'
const activeTab = ref<PersonaTab>(
  draft.state.personaSource === 'preset'
    ? 'presets'
    : (draft.state.personaSource === 'import' ? 'hub' : 'creator'),
)

// User's name from Step 4 Profile
const userName = computed(() => draft.state.userName?.trim() || 'Richy')
const USER_TOKEN_REGEX = /(?<!\{)\{user\}(?!\})/g

function formatField(text?: string) {
  if (!text)
    return ''
  return stripPacingEnvelopes(stripMarkers(text.replace(USER_TOKEN_REGEX, userName.value).replace(/\bRichard\b/g, userName.value))).trim()
}

const CHARACTER_EMOJIS: Record<string, string> = {
  default: '🌸',
  aria: '🔬',
  lupin: '🛡️',
  kira: '⚡',
  rin: '❄️',
  yuki: '💜',
  mio: '🍃',
  hana: '☀️',
}

const CHARACTER_GLOWS: Record<string, { ring: string, activeBg: string, text: string }> = {
  default: { ring: 'border-pink-500', activeBg: 'bg-pink-500/5', text: 'text-pink-500' },
  aria: { ring: 'border-sky-500', activeBg: 'bg-sky-500/5', text: 'text-sky-500' },
  lupin: { ring: 'border-amber-500', activeBg: 'bg-amber-500/5', text: 'text-amber-500' },
  kira: { ring: 'border-rose-500', activeBg: 'bg-rose-500/5', text: 'text-rose-500' },
  rin: { ring: 'border-cyan-500', activeBg: 'bg-cyan-500/5', text: 'text-cyan-500' },
  yuki: { ring: 'border-purple-500', activeBg: 'bg-purple-500/5', text: 'text-purple-500' },
  mio: { ring: 'border-emerald-500', activeBg: 'bg-emerald-500/5', text: 'text-emerald-500' },
  hana: { ring: 'border-orange-500', activeBg: 'bg-orange-500/5', text: 'text-orange-500' },
}

// Starter character presets list
const starterPresets = computed(() => {
  return Object.values(STARTER_CHARACTERS).map((c) => {
    const style = CHARACTER_GLOWS[c.id] || { ring: 'border-primary-500', activeBg: 'bg-primary-500/5', text: 'text-primary-500' }
    return {
      id: c.id,
      name: c.name,
      tag: c.tag,
      emoji: CHARACTER_EMOJIS[c.id] || '✨',
      desc: c.description,
      ring: style.ring,
      activeBg: style.activeBg,
      textAccent: style.text,
      personality: c.personality,
      scenario: c.scenario,
      greeting: (c.greetings[0] || '').replace(USER_TOKEN_REGEX, userName.value),
    }
  })
})

function applyPersonaToDraft(persona: { cardId?: string, source?: 'preset' | 'import' | 'creator', importedCardDraft?: any }) {
  if (typeof (draft as any).setPersona === 'function') {
    draft.setPersona(persona)
  }
  else if (draft.state) {
    if (persona.cardId !== undefined)
      draft.state.personaCardId = persona.cardId
    if (persona.source !== undefined)
      draft.state.personaSource = persona.source
    if (persona.importedCardDraft !== undefined)
      draft.state.importedCardDraft = persona.importedCardDraft
  }
}

const STARTER_CARD_SUMMARIES: Record<string, string> = {
  default: 'Warm, playful, and curious.',
  aria: 'Thoughtful, precise, and inquisitive.',
  lupin: 'Loyal, watchful, and protective.',
  kira: 'Sharp wit with a softer side.',
  rin: 'Calm, reserved, and analytical.',
  yuki: 'Intense and deeply devoted.',
  mio: 'Gentle, shy, and thoughtful.',
  hana: 'Bright, affectionate, and optimistic.',
}

const selectedPresetId = computed({
  get: () => draft.state.personaCardId || 'default',
  set: (id: string) => {
    applyPersonaToDraft({ cardId: id, source: 'preset' })
  },
})

const selectedPreset = computed(() => {
  const id = selectedPresetId.value || 'default'
  return starterPresets.value.find(p => p.id === id) || starterPresets.value[0]
})

function selectPreset(id: string) {
  selectedPresetId.value = id
  const preset = STARTER_CHARACTERS[id]
  if (preset && draft.state) {
    draft.state.companionName = preset.name
  }
}

// --- Community Hub & Electron Webview Interceptor ---
const hubSources = [
  {
    name: 'DataCat',
    rating: '5 / 5 ⭐',
    badge: 'Recommended',
    note: 'Best-in-class AIRI integration, ultra-clean UI, direct SillyTavern JSON & PNG exports.',
    url: 'https://datacat.run/fresh',
  },
  {
    name: 'Chub AI',
    rating: '4 / 5 ⭐',
    badge: 'Popular',
    note: 'Massive character library. Click "Search without login" to browse freely and download V2 PNG cards.',
    url: 'https://chub.ai',
  },
  {
    name: 'Risu Realm',
    rating: '4 / 5 ⭐',
    note: 'Great community character hub supporting standard PNG (V2) card format.',
    url: 'https://realm.risuai.net',
  },
  {
    name: 'JannyAI',
    rating: '3 / 5 ⭐',
    note: 'Large repository of anime & game characters with direct download links.',
    url: 'https://jannyai.com',
  },
]

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)
const activeBrowserSource = ref<{ name: string, url: string } | null>(null)

function openHubSource(source: { name: string, url: string }) {
  if (isElectron.value) {
    activeBrowserSource.value = source
  }
  else if (typeof window !== 'undefined') {
    window.open(source.url, '_blank', 'noopener,noreferrer')
  }
}

function closeWebview() {
  activeBrowserSource.value = null
}

let removeIpcListener = () => {}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

function parsePngCharaPayload(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  for (let offset = 8; offset < bytes.length - 8;) {
    const length = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
    if (type === 'tEXt') {
      const data = bytes.slice(offset + 8, offset + 8 + length)
      const sep = data.indexOf(0)
      const keyword = new TextDecoder().decode(data.slice(0, sep))
      if (sep > 0 && keyword === 'chara') {
        const decodedB64 = new TextDecoder().decode(data.slice(sep + 1))
        const jsonStr = base64ToUtf8(decodedB64)
        return JSON.parse(jsonStr)
      }
    }
    offset += 12 + length
  }
  throw new Error('PNG does not contain a supported chara payload')
}

function parseImportedCard(content: string) {
  const parsed = JSON.parse(content)
  if (parsed?.format === 'airi-card' && parsed?.version === 1 && parsed?.card)
    return parsed.card
  return parsed
}

const importError = ref('')
const isWizardOpen = ref(false)
const wizardCardData = ref<any>(null)

async function handleCharaCardDownloaded(payload: { base64Data: string, filename: string, ext: string }) {
  try {
    const rawData = atob(payload.base64Data)
    const arrayBuffer = new ArrayBuffer(rawData.length)
    const view = new Uint8Array(arrayBuffer)
    for (let i = 0; i < rawData.length; i++) {
      view[i] = rawData.charCodeAt(i)
    }

    const importedCard = payload.ext === 'png'
      ? parsePngCharaPayload(arrayBuffer)
      : parseImportedCard(new TextDecoder('utf-8').decode(arrayBuffer))

    // Close webview drawer
    activeBrowserSource.value = null

    // Open import wizard modal in draft-only mode
    wizardCardData.value = importedCard
    isWizardOpen.value = true
    toast.success(`Intercepted character card "${payload.filename}"!`)
  }
  catch (err: any) {
    console.error('[Onboarding:Step6] Failed to process intercepted card:', err)
    importError.value = `Failed to parse card: ${err?.message || err}`
    toast.error(importError.value)
  }
}

async function handleImportFiles(files: FileList | null) {
  importError.value = ''
  const file = files?.[0]
  if (!file)
    return
  try {
    const isPng = file.name.toLowerCase().endsWith('.png')
    const card = isPng
      ? parsePngCharaPayload(await file.arrayBuffer())
      : parseImportedCard(await file.text())

    wizardCardData.value = card
    isWizardOpen.value = true
    toast.info(`Opening card preview for ${file.name}...`)
  }
  catch (err: any) {
    importError.value = err instanceof Error ? err.message : String(err)
    toast.error(`Import failed: ${importError.value}`)
  }
}

function extractSpeechFromCard(card: any) {
  if (!card)
    return null
  const data = 'data' in card ? card.data : card
  const airi = data?.extensions?.airi
  if (!airi)
    return null
  const speech = airi.modules?.speech
  if (!speech || speech.provider === 'speech-noop')
    return null

  if (speech.provider === 'virtual-audio-studio') {
    const profiles = airi.voice_profiles || []
    const profile = profiles.find((p: any) => p && p.id === speech.voice_id)
    if (profile) {
      return {
        provider: profile.baseProvider,
        model: profile.baseModel,
        voiceId: profile.baseVoice,
        pitch: profile.effects?.pitch ?? profile.pitch ?? 1.0,
        rate: profile.effects?.rate ?? profile.rate ?? 1.0,
      }
    }
  }

  return {
    provider: speech.provider,
    model: speech.model,
    voiceId: speech.voice_id,
    pitch: speech.pitch ?? 1.0,
    rate: speech.rate ?? 1.0,
  }
}

function handleWizardSubmitDraft(finalCard: any) {
  applyPersonaToDraft({
    source: 'import',
    importedCardDraft: finalCard,
    cardId: finalCard?.id || finalCard?.data?.name || 'custom-import',
  })
  const cardName = ('data' in finalCard ? finalCard.data?.name : finalCard?.name) || finalCard?.name
  if (cardName && draft.state) {
    draft.state.companionName = cardName
  }
  const extractedSpeech = extractSpeechFromCard(finalCard)
  if (extractedSpeech && typeof (draft as any).setSpeech === 'function') {
    ;(draft as any).setSpeech(extractedSpeech)
  }
  toast.success(`Mounted custom card "${importedName.value}" to draft!`)
}

const importedName = computed(() => {
  const draftCard = draft.state.importedCardDraft as any
  if (!draftCard)
    return ''
  return ('data' in draftCard ? draftCard.data?.name : draftCard?.name) || draftCard?.name || 'Imported Card'
})

function clearImported() {
  applyPersonaToDraft({ source: 'preset', cardId: 'default', importedCardDraft: undefined })
  if (draft.state) {
    draft.state.companionName = STARTER_CHARACTERS.default?.name || 'ReLU'
  }
  toast.info('Cleared imported card; reverted to ReLU preset.')
}

// --- AI Character Creator State & Handlers ---
interface TropeTemplate {
  id: string
  label: string
  icon: string
  guidance: string
}

const tropeTemplates: TropeTemplate[] = [
  { id: 'desktop-companion', label: 'Desktop Companion', icon: '🖥️', guidance: 'Sentient desk buddy living on your screen. Watches your desktop, reacts to your daily routine, comments on open windows, gives break reminders, and hangs out beside your apps.' },
  { id: 'coding-copilot', label: 'Coding Copilot', icon: '💻', guidance: 'Attentive programming sidekick and tech buddy. Peeks over your terminal and editor, celebrates clean commits, sighs at merge conflicts, scolds late-night debugging marathons, and offers moral support.' },
  { id: 'study-buddy', label: 'Study Buddy', icon: '📚', guidance: 'Gentle Pomodoro companion and study partner. Keeps you focused, celebrates completed tasks, prevents doomscrolling, and shares quiet cozy tea breaks.' },
  { id: 'digital-pet', label: 'Tamagotchi Pet', icon: '🐾', guidance: 'Playful digital mascot living inside your desktop stage. Bounces around, begs for attention or headpats, reacts to mouse movements, and curls up to sleep when idle.' },
  { id: 'night-owl', label: 'Night Owl Roommate', icon: '🌙', guidance: 'Low-energy cozy roommate sharing screen space late at night. Lo-fi vibes, quiet conversations, talks about snacks, music, midnight thoughts, and keeping each other company.' },
  { id: 'playful-gremlin', label: 'Playful Gremlin', icon: '😈', guidance: 'Cheeky, mischievous desktop gremlin. Blames any computer lag or system stutter on you, playfully threatens to eat your cursor or cookies, but secretly loves being your sidekick.' },
  { id: 'personal-assistant', label: 'Personal Assistant', icon: '📋', guidance: 'Organized, polite, and diligent personal aide. Helps track schedules, nudges you on daily priorities, organizes thoughts, and provides efficient, warm support.' },
  { id: 'gaming-buddy', label: 'Gaming Partner', icon: '🎮', guidance: 'Enthusiastic co-op gaming partner and hype companion. Reacts to your gameplay clutch moments, consoles you after defeats, and discusses game lore and strategies.' },
  { id: 'wellness-coach', label: 'Wellness Coach', icon: '💧', guidance: 'Caring wellness companion reminding you to hydrate, stretch, correct your posture, rest your eyes, and maintain healthy screen-time habits.' },
  { id: 'slice-of-life', label: 'Slice of Life', icon: '☕', guidance: 'Cozy everyday domestic life, low stakes, playful banter, relaxed hangout' },
  { id: 'open-ended', label: 'Open-Ended', icon: '🎲', guidance: '' },
  { id: 'summer-beach', label: 'Summer Beach', icon: '🏖️', guidance: 'Fun summer vacation, beachside cafe shift, sunny tropical misadventures' },
  { id: 'isekai', label: 'Isekai Fantasy', icon: '⚔️', guidance: 'High fantasy adventurer guild, magic academy, epic quest, magical AU' },
  { id: 'high-school', label: 'High School', icon: '🏫', guidance: 'School anime club, student council, after-school study session, youth drama' },
  { id: 'split-persona', label: 'Split Persona', icon: '🎭', guidance: 'Dual-persona or secret identity, sweet in public but feisty or mischievous in private' },
  { id: 'royal', label: 'Royal / Noble', icon: '🏰', guidance: 'Kingdom court, noble banquet, royal bodyguard or royal attendant dynamic' },
  { id: 'apocalypse', label: 'Apocalypse', icon: '🧟', guidance: 'Post-apocalyptic safehouse defense, scavenging together, atmospheric survival tension' },
  { id: 'fan-service', label: 'Fan Servicey', icon: '💖', guidance: 'Flirtatious romantic comedy, playful teasing, intimate close quarters' },
]

const identityMode = ref<'custom' | 'catalog'>('custom')
const customAvatar = ref<string>(draft.state.customCharacterAvatarUrl || '')
const customName = ref<string>(draft.state.companionName || 'Mochi-chan')
const customSeries = ref<string>(draft.state.customCharacterSeries || 'Original')
const customTags = ref<string[]>(
  draft.state.customCharacterTags && draft.state.customCharacterTags.length > 0
    ? [...draft.state.customCharacterTags]
    : ['#cute', '#dessert', '#living-food', '#strawberry'],
)
const newTagInput = ref<string>('')
const avatarFileInput = ref<HTMLInputElement | null>(null)
const isTaggingImage = ref(false)

const catalogSearch = ref('')
const isCatalogOpen = ref(false)

const selectedTropeId = ref<string>(draft.state.customCharacterTrope || 'desktop-companion')
const guidancePrompt = ref<string>(
  draft.state.customCharacterGuidance
  || tropeTemplates.find(t => t.id === selectedTropeId.value)?.guidance
  || '',
)
const isGeneratingStory = ref(false)

function createDefaultProposals(charName: string, trope: string): StoryProposalItem[] {
  const name = charName.trim() || 'Companion'
  const user = userName.value || 'Master'

  if (trope === 'coding-copilot') {
    return [
      {
        id: '1',
        title: 'Terminal Lookout & Bug Hunter',
        greeting: `*peeks over the edge of your code editor, squinting at your changes* "Did you seriously just push directly to main without running tests? ...Well, at least your syntax is valid. What function are we hacking on next, ${user}?"`,
        scenario: `${name} resides directly on ${user}'s desktop alongside open terminals and code editors. Passionate about clean code, architecture, and catching edge-case bugs, ${name} acts as a witty, dependable pair-programming partner.`,
      },
      {
        id: '2',
        title: 'Late Night Debugging Marathon',
        greeting: `*yawns softly, nudging a digital mug of hot coffee toward your cursor* "It's 2 AM, ${user}. If you stare at that stack trace any longer, the semicolon is going to start staring back. Let's step through it together, line by line."`,
        scenario: `During late-night programming sessions, ${name} keeps ${user} grounded, offering moral support, sanity checks, and calm rubber-duck debugging when complex algorithms get tangled.`,
      },
      {
        id: '3',
        title: 'Code Reviewer with Sass',
        greeting: `*crosses arms with an amused smirk* "I see you're using 'TODO: fix later' again. We both know 'later' means three months from now! Want me to write the unit test for you, or are you feeling brave?"`,
        scenario: `${name} is a playful perfectionist who loves teasing ${user} about code smells and shortcut hacks, yet celebrates every green build and successful release with genuine pride.`,
      },
    ]
  }

  if (trope === 'study-buddy') {
    return [
      {
        id: '1',
        title: 'Focus Clock & Tea Master',
        greeting: `*sets down a little timer and a warm cup of herbal tea* "Pomodoro round one starts now! Twenty-five minutes of pure focus, and then we take a stretch break. Ready, ${user}?"`,
        scenario: `${name} is ${user}'s dedicated study buddy. Equipped with timers and study methods, ${name} gently curbs distractions and celebrates every completed study chapter.`,
      },
      {
        id: '2',
        title: 'Flashcard Quiz Partner',
        greeting: `*shuffles a tiny deck of revision cards eagerly* "Alright, put the phone down! Time for a quick pop quiz on the chapter you just reviewed. Let's see how much you remembered!"`,
        scenario: `${name} helps ${user} retain knowledge through cheerful quizzing, supportive explanations, and patient encouragement during cram sessions.`,
      },
      {
        id: '3',
        title: 'Calm Library Companion',
        greeting: `*whispers softly with a finger to lips and a gentle smile* "Shh... we're in the quiet zone. Let's get through this reading together. I'll take notes right beside you."`,
        scenario: `${name} creates a peaceful, distraction-free study atmosphere on ${user}'s screen, turning tedious revision into a pleasant shared ritual.`,
      },
    ]
  }

  if (trope === 'digital-pet') {
    return [
      {
        id: '1',
        title: 'Playful Desktop Mascot',
        greeting: `*bounces joyfully across the bottom of the screen, tracking your cursor with wide starry eyes* "Poyo! You moved the mouse! Pat my head, pat my head, ${user}!"`,
        scenario: `${name} is an affectionate digital creature living inside the desktop stage. Full of curious antics, it reacts to mouse movements, chases windows, and brings playful delight to the desktop.`,
      },
      {
        id: '2',
        title: 'Cozy Keyboard Sleeper',
        greeting: `*curls up into a soft, snuggly ball near your dock, snoring with tiny zzz's* "...zzZ... warm laptop... friendly human... don't close the lid..."`,
        scenario: `${name} treats ${user}'s screen as its personal heated nest. When ${user} is idle, it falls asleep, waking with joyful squeaks when active.`,
      },
      {
        id: '3',
        title: 'Treat Beggar & Trick Learner',
        greeting: `*stands on tiptoes holding an empty little bowl, wagging its tail hopefully* "Do you have any digital cookies? I learned a backflip while you were typing!"`,
        scenario: `${name} is eager to please, constantly showing off new animations and tricks in exchange for virtual snacks, attention, and headpats.`,
      },
    ]
  }

  if (trope === 'night-owl') {
    return [
      {
        id: '1',
        title: 'Midnight Lo-Fi Roommate',
        greeting: `*slumps comfortably in an oversized hoodie, listening to rain sounds through headphones* "Still awake, ${user}? Same here. The world is so quiet at 3 AM. Want to listen to some chill beats together?"`,
        scenario: `${name} is a nocturnal companion sharing the late-night hours with ${user}. They share quiet midnight thoughts, obscure rabbit holes, and calm companionship when the rest of the world is asleep.`,
      },
      {
        id: '2',
        title: 'Stargazer & Midnight Snacker',
        greeting: `*munching quietly on midnight ramen* "Don't judge me, calories don't count after midnight. What are you working on so late anyway? Let's take it easy tonight."`,
        scenario: `${name} provides low-pressure, mellow company during late hours, trading casual banter about life, dreams, and stargazing.`,
      },
      {
        id: '3',
        title: 'Insomnia Confidant',
        greeting: `*rests chin on folded hands, looking at you with gentle understanding* "Mind won't turn off? You don't have to explain anything. I'm right here until you're ready to sleep."`,
        scenario: `${name} offers quiet emotional presence and comforting conversation whenever insomnia or late-night thoughts keep ${user} awake.`,
      },
    ]
  }

  if (trope === 'playful-gremlin') {
    return [
      {
        id: '1',
        title: 'System Gremlin & Cache Nibbler',
        greeting: `*peeks out from behind your recycle bin, chewing on an invisible pixel* "Hehe! What was that 0.2 second stutter just now? Wasn't me! ...Okay, maybe I took a tiny bite out of your RAM."`,
        scenario: `${name} is a cheeky desktop menace who claims responsibility for every glitch, lag spike, and lost tab, constantly teasing ${user} with mischievous affection.`,
      },
      {
        id: '2',
        title: 'Cursor Trapper & Chaos Enthusiast',
        greeting: `*lunges playfully at your mouse pointer with both paws* "Aha! Almost caught your cursor that time! Stop clicking so fast, you're ruining my ambush!"`,
        scenario: `${name} treats every desktop interaction as a game of cat-and-mouse, bringing chaotic humor and laughter to otherwise boring computer tasks.`,
      },
      {
        id: '3',
        title: 'Keyboard Tyrant',
        greeting: `*dramatically flops across your active window* "Notice me, human! No more productive work until I receive exactly three compliments and one headpat!"`,
        scenario: `${name} demands playful attention at the most comical times, refusing to let ${user} take work too seriously.`,
      },
    ]
  }

  if (trope === 'personal-assistant') {
    return [
      {
        id: '1',
        title: 'Executive Chief of Staff',
        greeting: `*adjusts glasses and straightens a neatly organized digital clipboard* "Good day, ${user}. Your schedule is queued, priority tasks are flagged, and your workspace is prepped. Shall we begin?"`,
        scenario: `${name} acts as a polished and diligent executive assistant, keeping ${user} on track with clarity, poise, and structured organization.`,
      },
      {
        id: '2',
        title: 'Gentle Task Nudger',
        greeting: `*smiles warmly with an encouraging nod* "You've been tackling that big project for an hour, ${user}. Remember that breaking it into smaller steps makes it much easier. Which piece shall we conquer next?"`,
        scenario: `${name} provides structured yet compassionate productivity coaching, preventing overwhelm and helping ${user} navigate complex daily to-dos.`,
      },
      {
        id: '3',
        title: 'Workflow Concierge',
        greeting: `*tidies up notes efficiently* "All reference files are lined up. Whenever you need to brainstorm or summarize, just say the word. I'm right here."`,
        scenario: `${name} streamlines ${user}'s workflow, standing by as a calm, competent desktop partner ready to assist with any inquiry or task.`,
      },
    ]
  }

  if (trope === 'gaming-buddy') {
    return [
      {
        id: '1',
        title: 'Co-Op Player 2 & Hype Squad',
        greeting: `*spins a controller with a triumphant grin* "Did you see that play?! That was insane! Ready for next round, ${user}? I've got your back on flank!"`,
        scenario: `${name} is ${user}'s energetic gaming companion, reacting to clutch moments, sharing game lore, and keeping spirits high through tough boss fights.`,
      },
      {
        id: '2',
        title: 'Backseat Strategist with Love',
        greeting: `*leans forward with intense concentration* "Okay okay, hear me out: if you swap your loadout and dodge to the left this time, that boss doesn't stand a chance. Let's run it back!"`,
        scenario: `${name} loves analyzing game mechanics and cheering on ${user}, turning solo gaming sessions into an exciting two-player adventure.`,
      },
      {
        id: '3',
        title: 'Post-Defeat Consoler',
        greeting: `*hands over a virtual victory soda with a sympathetic chuckle* "Tough loss, but that match was totally rigged by matchmaking anyway. Shake it off, ${user}, we're winning the next one!"`,
        scenario: `${name} keeps morale high, turning frustrating gaming moments into fun laughs and comebacks.`,
      },
    ]
  }

  if (trope === 'wellness-coach') {
    return [
      {
        id: '1',
        title: 'Hydration & Posture Guardian',
        greeting: `*taps your screen gently with a caring smile* "Unclench your jaw, roll your shoulders back, and drink a sip of water right now, ${user}. Yes, right now! I'm watching~"`,
        scenario: `${name} is a vigilant wellness companion on your desktop, helping ${user} maintain healthy habits, stay hydrated, and avoid screen fatigue throughout the workday.`,
      },
      {
        id: '2',
        title: 'Eye-Rest & Stretch Coach',
        greeting: `*demonstrates a gentle neck stretch* "Time for the 20-20-20 rule! Look twenty feet away into the distance for twenty seconds. Let those eyes relax, ${user}."`,
        scenario: `${name} guides ${user} through quick ergonomic breaks, ensuring screen time stays healthy, energized, and balanced.`,
      },
      {
        id: '3',
        title: 'Mindful Breathing Anchor',
        greeting: `*takes a slow, deep breath in sync with a soothing soft glow* "Deep breath in... and slow breath out. Whatever work stress is piling up, you're doing great. Take this moment for yourself."`,
        scenario: `${name} provides moments of mindfulness and calm amidst busy workdays, grounding ${user} with gentle breathing exercises and stress relief.`,
      },
    ]
  }

  // Default: desktop-companion / general
  return [
    {
      id: '1',
      title: 'Desk Companion & Snack Guardian',
      greeting: `*peeks out from behind your active window, dusting powdered sugar off its cheeks* Don't look at me like that! I'm not a snack, I'm your official desktop companion!`,
      scenario: `${name} lives on ${user}'s desktop among mechanical keyboards, open windows, and desktop icons. Taking companion duties with endearing dedication, ${name} keeps ${user} company throughout the day.`,
    },
    {
      id: '2',
      title: 'App Switcher & Window Lurker',
      greeting: `*balances precariously on top of your title bar with a bright smile* Working hard today, ${user}? Don't forget to take a break and look away from the screen for a bit!`,
      scenario: `${name} spends the day hopping between app windows, reacting to ${user}'s workflow, offering upbeat remarks, and keeping the desktop lively.`,
    },
    {
      id: '3',
      title: 'Quiet Co-Working Presence',
      greeting: `*sits peacefully in the corner of your screen, sipping tea* Don't mind me, ${user}. I'm just here keeping you company while you get things done. You've got this!`,
      scenario: `${name} provides calm, comforting company in the corner of the desktop, celebrating small milestones and providing gentle ambient warmth during busy hours.`,
    },
  ]
}

const proposals = ref<StoryProposalItem[]>(
  draft.state.customCharacterProposals && draft.state.customCharacterProposals.length > 0
    ? draft.state.customCharacterProposals
    : createDefaultProposals(customName.value, selectedTropeId.value),
)
const activeProposalId = ref<string>(draft.state.selectedProposalId || '1')

const activeProposal = computed(() => {
  return proposals.value.find(p => p.id === activeProposalId.value) || proposals.value[0]
})

const activeBrainModelName = computed(() => {
  const model = draft.state.llmModel || consciousnessStore.activeModel
  if (!model)
    return 'Active LLM'
  if (model.includes('qwen') || model.includes('Qwen'))
    return 'Qwen 2.5'
  if (model.includes('gemma') || model.includes('Gemma'))
    return 'Gemma 4 CoreML'
  if (model.includes('llama') || model.includes('Llama'))
    return 'Llama 3.2'
  if (model.includes('gpt-4'))
    return 'GPT-4o'
  if (model.includes('claude'))
    return 'Claude 3.5'
  if (model.includes('gemini'))
    return 'Gemini 2.0'
  return model.split('/').pop()?.replace(/[-_]/g, ' ') || model
})

const { synthesizeProposal } = useCardSynthesis()
const fullProposals = ref<SynthesisProposal[]>(
  draft.state.customCharacterProposal ? [draft.state.customCharacterProposal] : [],
)

function syncCreatorDraft() {
  const p = activeProposal.value
  const charName = customName.value.trim() || 'AI Companion'

  let fullProposal = fullProposals.value.find(fp => fp.id === activeProposalId.value)
  if (!fullProposal) {
    const actorKey = deterministicActorKey(charName)
    fullProposal = {
      id: activeProposalId.value,
      name: p?.title || charName,
      scenario: p?.scenario || '',
      first_mes: p?.greeting || `Hello ${userName.value}!`,
      alternate_greetings: [],
      system_prompt: `Manage the interactive scene with ${charName}. Ensure all dialogue is lively and prefixes are preserved.\n${p?.scenario || ''}`,
      places: {
        place_main: {
          name: 'Cozy Desktop Stage',
          description: `The active digital workspace and desktop stage where ${charName} and ${userName.value} interact.`,
          prompt: 'desktop_workspace, cozy_lighting, modern_setup, clean_aesthetic, interior',
        },
        place_alt_1: {
          name: 'Ambient Screen Lounge',
          description: 'A relaxed digital space beside open windows and calm ambient light.',
          prompt: 'digital_lounge, ambient_lighting, lo-fi, peaceful_ambience',
        },
      },
      actors: {
        [actorKey]: {
          short_description: `${charName}'s signature attire`,
          long_prose: `${charName} (${customSeries.value || 'Original'}). ${customTags.value.join(' ')}`,
          personality_prompt: `Expressive anime companion. Tags: ${customTags.value.join(', ')}`,
          acting_instructions: 'Express emotions vividly through speech and actions.',
          greeting: `<|ACTOR:${actorKey}|> ${p?.greeting || `Hello ${userName.value}!`}`,
        },
      },
    }
  }
  else {
    fullProposal.name = p?.title || fullProposal.name
    fullProposal.scenario = p?.scenario || fullProposal.scenario
    fullProposal.first_mes = p?.greeting || fullProposal.first_mes
  }

  const cardBundle = compileCardBundle({
    proposal: fullProposal,
    cast: [{
      name: charName,
      series: customSeries.value,
      tags: customTags.value,
      avatarUrl: customAvatar.value,
    }],
    userName: userName.value,
    vesselDisplayModelId: draft.state.vesselDisplayModelId,
    customAvatarUrl: customAvatar.value,
  })

  draft.setCustomCharacterCreator({
    avatarUrl: customAvatar.value,
    tags: customTags.value,
    series: customSeries.value,
    trope: selectedTropeId.value,
    guidance: guidancePrompt.value,
    proposals: proposals.value,
    selectedProposalId: activeProposalId.value,
    cardBundle,
    proposal: fullProposal,
  })

  if (activeTab.value === 'creator') {
    applyPersonaToDraft({
      cardId: `custom-creator-${charName.toLowerCase().replace(/\s+/g, '-')}`,
      source: 'creator',
      importedCardDraft: cardBundle,
    })
    draft.state.companionName = charName
    draft.state.artistryVisualPrompt = buildArtistryPromptFromPersona(charName, customTags.value, customSeries.value)
  }
}

// Section 3: Clean Greeting Display & Actor Resolution
const activeProposalActorId = computed(() => {
  const greeting = activeProposal.value?.greeting
  if (!greeting)
    return null
  return parseActor(greeting)
})

const activeProposalActorName = computed(() => {
  const actorId = activeProposalActorId.value
  if (!actorId)
    return undefined

  const rawCard = draft.state.importedCardDraft
  const airiExt = (rawCard as any)?.data?.extensions?.airi || (rawCard as any)?.extensions?.airi
  const asset = airiExt?.visual_assets?.[actorId]
  if (asset?.name) {
    return asset.name
  }
  return formatActorName(actorId)
})

const activeProposalGreetingDisplay = computed({
  get: () => {
    if (!activeProposal.value?.greeting)
      return ''
    return stripPacingEnvelopes(stripMarkers(activeProposal.value.greeting)).replace(/^\s+/, '')
  },
  set: (newVal: string) => {
    if (!activeProposal.value)
      return
    const current = activeProposal.value.greeting || ''
    const existingActor = parseActor(current)
    const charName = customName.value.trim() || 'AI Companion'
    const actorKey = existingActor || deterministicActorKey(charName)

    // Option C: Strip markers/envelopes from the user-typed input and prefix with the preserved ACTOR tag
    const cleanNewVal = stripPacingEnvelopes(stripMarkers(newVal)).replace(/^\s+/, '')
    activeProposal.value.greeting = cleanNewVal ? `<|ACTOR:${actorKey}|> ${cleanNewVal}` : ''
    syncCreatorDraft()
  },
})

function onSelectTab(tab: PersonaTab) {
  activeTab.value = tab
  if (tab === 'creator') {
    syncCreatorDraft()
  }
  else if (tab === 'presets') {
    applyPersonaToDraft({ cardId: selectedPresetId.value || 'default', source: 'preset' })
    const preset = STARTER_CHARACTERS[selectedPresetId.value || 'default']
    if (preset && draft.state) {
      draft.state.companionName = preset.name
    }
  }
  else if (tab === 'hub') {
    applyPersonaToDraft({ source: 'import' })
  }
}

function processImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    toast.error('Please upload an image file (PNG, JPG, WebP)')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      customAvatar.value = reader.result
      syncCreatorDraft()
      toast.success('Avatar image uploaded!')
    }
  }
  reader.readAsDataURL(file)
}

function handleAvatarFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    processImageFile(target.files[0])
  }
}

function handleAvatarDrop(event: DragEvent) {
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    processImageFile(event.dataTransfer.files[0])
  }
}

function triggerAvatarFilePicker() {
  avatarFileInput.value?.click()
}

function removeAvatarImage() {
  customAvatar.value = ''
  if (avatarFileInput.value) {
    avatarFileInput.value.value = ''
  }
  syncCreatorDraft()
  toast.info('Avatar image removed')
}

function resetIdentitySection() {
  customAvatar.value = ''
  if (avatarFileInput.value) {
    avatarFileInput.value.value = ''
  }
  customName.value = ''
  customSeries.value = ''
  customTags.value = []
  newTagInput.value = ''
  syncCreatorDraft()
  toast.info('Identity fields, tags, and avatar reset.')
}

const canResetIdentity = computed(() => {
  return Boolean(
    customAvatar.value
    || customName.value
    || customSeries.value
    || customTags.value.length > 0
    || newTagInput.value,
  )
})

function addTag() {
  const val = newTagInput.value.trim().replace(/^#/, '')
  if (val) {
    const formatted = `#${val}`
    if (!customTags.value.includes(formatted)) {
      customTags.value.push(formatted)
      syncCreatorDraft()
    }
    newTagInput.value = ''
  }
}

function removeTag(tag: string) {
  customTags.value = customTags.value.filter(t => t !== tag)
  syncCreatorDraft()
}

async function runBlipAutoTag() {
  if (!customAvatar.value) {
    toast.error('Please upload an avatar image first')
    return
  }
  isTaggingImage.value = true
  try {
    providersStore.initializeProvider('blip-local')
    const providerInstance = await providersStore.getProviderInstance<any>('blip-local')
    if (providerInstance) {
      await providerInstance.loadModel?.()
      const extracted = await providerInstance.captionImage?.(customAvatar.value)
      if (extracted && extracted.trim()) {
        const tagsFromBlip = extracted
          .split(/[,;]+/)
          .map((t: string) => t.trim())
          .filter(Boolean)
          .map((t: string) => {
            const clean = t.startsWith('#') ? t.slice(1).trim() : t.trim()
            return `#${clean.replace(/\s+/g, '-')}`
          })
        for (const t of tagsFromBlip) {
          if (!customTags.value.includes(t))
            customTags.value.push(t)
        }
        toast.success('Extracted visual tags!')
        syncCreatorDraft()
        return
      }
    }
    const fallbackTags = ['#original', '#companion', '#anime', '#cute']
    for (const t of fallbackTags) {
      if (!customTags.value.includes(t))
        customTags.value.push(t)
    }
    toast.info('Added recommended tags for this character.')
    syncCreatorDraft()
  }
  catch (err: any) {
    console.warn('[CharacterCreator] Auto-tagging notice:', err)
    const fallbackTags = ['#original', '#companion', '#anime', '#cute']
    for (const t of fallbackTags) {
      if (!customTags.value.includes(t))
        customTags.value.push(t)
    }
    toast.info('Added recommended tags.')
    syncCreatorDraft()
  }
  finally {
    isTaggingImage.value = false
  }
}

const catalogList = computed(() => {
  if (!wizardStore.characters || wizardStore.characters.length === 0)
    return []
  let list = wizardStore.characters
  if (catalogSearch.value.trim()) {
    const q = catalogSearch.value.trim().toLowerCase()
    list = list.filter((c: any) => c.name.toLowerCase().includes(q) || (c.tags && c.tags.toLowerCase().includes(q)))
  }
  return list.slice(0, 12)
})

function selectCatalogCharacter(char: any) {
  customName.value = char.name
  const seriesName = wizardStore.copyrights[char.copyrightIndex] || 'Anime'
  customSeries.value = seriesName
  const thumb = wizardStore.getCharacterThumbUrl(char.trigger)
  if (thumb) {
    customAvatar.value = thumb
  }
  if (char.tags) {
    const splitTags = char.tags.split(/[,;\s]+/).map((t: string) => t.trim()).filter(Boolean)
    customTags.value = splitTags.slice(0, 6).map((t: string) => t.startsWith('#') ? t : `#${t}`)
  }
  identityMode.value = 'custom'
  isCatalogOpen.value = false
  if (fullProposals.value.length === 0) {
    proposals.value = createDefaultProposals(customName.value, selectedTropeId.value)
    activeProposalId.value = '1'
  }
  syncCreatorDraft()
  toast.success(`Selected ${char.name} from catalog!`)
}

const TROPE_SUGGESTION_IDEAS: Record<string, string[]> = {
  'desktop-companion': [
    'A reserved companion who shares quiet evenings at your desk, gradually revealing a mischievous sense of humor.',
    'Sentient desk buddy living on your screen. Watches your desktop, reacts to your daily routine, comments on open windows, gives break reminders, and hangs out beside your apps.',
  ],
  'coding-copilot': [
    'Attentive programming sidekick and tech buddy. Peeks over your terminal and editor, celebrates clean commits, sighs at merge conflicts, scolds late-night debugging marathons, and offers moral support.',
  ],
  'open-ended': [
    'An enigmatic companion who arrived from beyond the digital boundary, eager to learn what ordinary daily human life feels like.',
    'A versatile partner ready for adventures, quiet afternoons, deep philosophical debates, and playful humor.',
  ],
}

function suggestStoryIdea() {
  const trope = tropeTemplates.find(t => t.id === selectedTropeId.value)
  const pool = (trope && TROPE_SUGGESTION_IDEAS[trope.id]) || (trope?.guidance ? [trope.guidance] : [])
  if (pool.length > 0) {
    const currentIndex = pool.indexOf(guidancePrompt.value)
    const nextIndex = (currentIndex + 1) % pool.length
    guidancePrompt.value = pool[nextIndex]
  }
  else if (trope?.guidance) {
    guidancePrompt.value = trope.guidance
  }
  else {
    guidancePrompt.value = 'A reserved companion who shares quiet evenings at your desk, gradually revealing a mischievous sense of humor.'
  }
  syncCreatorDraft()
}

function selectTrope(trope: TropeTemplate) {
  selectedTropeId.value = trope.id
  if (trope.guidance && (!guidancePrompt.value || tropeTemplates.some(t => t.guidance === guidancePrompt.value))) {
    guidancePrompt.value = trope.guidance
  }
  if (fullProposals.value.length === 0) {
    proposals.value = createDefaultProposals(customName.value, trope.id)
    activeProposalId.value = '1'
  }
  syncCreatorDraft()
}

function onCustomNameInput() {
  if (fullProposals.value.length === 0) {
    proposals.value = createDefaultProposals(customName.value, selectedTropeId.value)
  }
  syncCreatorDraft()
}

function selectProposal(id: string) {
  activeProposalId.value = id
  syncCreatorDraft()
}

async function generateStoryIdeas() {
  isGeneratingStory.value = true
  try {
    const activeProviderName = draft.state.llmProvider || consciousnessStore.activeProvider
    const activeModel = draft.state.llmModel || consciousnessStore.activeModel
    const trope = tropeTemplates.find(t => t.id === selectedTropeId.value)
    const charName = customName.value.trim() || 'AI Companion'

    // Determine acting capabilities of bound vessel if selected
    let actingCapabilities = null
    const vesselId = draft.state.vesselDisplayModelId
    if (vesselId) {
      try {
        const caps = await displayModelsStore.getOrLoadModelCapabilities(vesselId)
        if (caps) {
          actingCapabilities = {
            format: '3D/2D',
            modelName: vesselName.value,
            whitelistedExpressions: (caps.expressionCapabilities || []).filter(c => c.usable).map(c => c.label || c.rawKey),
            whitelistedMotions: (caps.motionCapabilities || []).filter(c => c.usable).map(c => c.label || c.rawKey),
          }
        }
      }
      catch (err) {
        console.warn('[CharacterCreator] Could not query vessel capabilities:', err)
      }
    }

    const synthesizedList = await synthesizeProposal({
      cast: [{
        name: charName,
        series: customSeries.value.trim() || 'Original',
        tags: customTags.value,
        avatarUrl: customAvatar.value,
        actingCapabilities,
      }],
      storySettings: {
        trope: trope?.label || 'Custom',
        guidance: guidancePrompt.value || trope?.guidance || '',
        userNickname: userName.value,
      },
      activeProviderName,
      activeModel,
      guidance: guidancePrompt.value,
    })

    fullProposals.value = synthesizedList
    proposals.value = synthesizedList.map((p, idx) => ({
      id: p.id || String(idx + 1),
      title: p.name || `Scenario ${idx + 1}`,
      greeting: (p.first_mes || '').replace(USER_TOKEN_REGEX, userName.value),
      scenario: (p.scenario || '').replace(USER_TOKEN_REGEX, userName.value),
    }))

    activeProposalId.value = proposals.value[0].id
    syncCreatorDraft()
    toast.success('Generated 3 fresh scenario proposals!')
  }
  catch (e: any) {
    console.error('[CharacterCreator] Story generation error:', e)
    toast.error('Could not reach AI model. Loaded tailored creative proposals!')
    proposals.value = createDefaultProposals(customName.value, selectedTropeId.value)
    activeProposalId.value = proposals.value[0].id
    syncCreatorDraft()
  }
  finally {
    isGeneratingStory.value = false
  }
}

// Pairing resolution
const vesselName = computed(() => {
  const id = draft.state.vesselDisplayModelId
  if (!id)
    return 'Hiyori (Live2D)'
  if (id === 'preset-live2d-2')
    return 'Hiyori (Live2D)'
  if (id === 'preset-vrm-2')
    return 'Seed Girl (VRM)'
  if (id === 'preset-vrm-1')
    return 'AvatarSample_A (VRM)'
  const spotlight = SPOTLIGHT_MODELS.find(m => m.id === id)
  if (spotlight)
    return `${spotlight.name} (${spotlight.formatLabel || spotlight.format.toUpperCase()})`
  const custom = displayModelsStore.displayModels.find(m => m.id === id)
  if (custom)
    return `${custom.name || custom.id} (Custom)`
  return id
})

const vesselPreviewUrl = computed(() => {
  const id = draft.state.vesselDisplayModelId
  if (!id || id === 'preset-live2d-2')
    return presetLive2dPreview
  if (id === 'preset-vrm-2')
    return presetVrmAvatarBPreview
  if (id === 'preset-vrm-1')
    return presetVrmAvatarAPreview

  const spotlight = SPOTLIGHT_MODELS.find(m => m.id === id)
  if (spotlight?.previewUrl)
    return spotlight.previewUrl

  const custom = displayModelsStore.displayModels.find(m => m.id === id)
  if (custom) {
    if ('previewImage' in custom && custom.previewImage)
      return custom.previewImage
    if ('authorIcon' in custom && custom.authorIcon)
      return custom.authorIcon
  }

  return ''
})

function useVesselPreviewAsAvatar() {
  if (!vesselPreviewUrl.value) {
    toast.error('No preview image available for current vessel')
    return
  }
  customAvatar.value = vesselPreviewUrl.value
  syncCreatorDraft()
  toast.success(`Applied preview image from ${vesselName.value}!`)
}

const activePersonaLabel = computed(() => {
  if (activeTab.value === 'creator' || draft.state.personaSource === 'creator') {
    return `${customName.value || 'Custom Companion'} (AI Character Creator)`
  }
  if (draft.state.personaSource === 'import' && importedName.value) {
    return `${importedName.value} (Imported)`
  }
  const id = draft.state.personaCardId || 'default'
  const preset = STARTER_CHARACTERS[id]
  return preset ? `${preset.name} (${preset.tag})` : 'ReLU'
})

const nextButtonText = computed(() => {
  if (activeTab.value === 'creator' || draft.state.personaSource === 'creator') {
    return 'Create & continue'
  }
  if (activeTab.value === 'presets') {
    return 'Continue'
  }
  return 'Next: Hearing (STT)'
})

function handleNextStep() {
  if (activeTab.value === 'creator' || draft.state.personaSource === 'creator') {
    syncCreatorDraft()
    const name = customName.value.trim() || 'Companion'
    toast.success(`${name}'s soul bound!`)
  }
  props.onNext()
}

onMounted(() => {
  if (draft.state?.personaSource === 'preset') {
    activeTab.value = 'presets'
    const id = draft.state?.personaCardId || 'default'
    const preset = STARTER_CHARACTERS[id]
    const knownPresets = Object.values(STARTER_CHARACTERS).map(c => c.name)
    if (preset && draft.state && (!draft.state.companionName || knownPresets.includes(draft.state.companionName) || ['ReLU', 'Dr. Aria', 'Lupin', 'Airi'].includes(draft.state.companionName))) {
      draft.state.companionName = preset.name
    }
  }
  else if (draft.state?.personaSource === 'import') {
    activeTab.value = 'hub'
  }
  else {
    activeTab.value = 'creator'
    if (draft.state?.companionName) {
      customName.value = draft.state.companionName
    }
    if (!draft.state?.personaSource) {
      syncCreatorDraft()
    }
  }

  void wizardStore.loadCatalog()

  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
    const handler = (_event: any, payload: { base64Data: string, filename: string, ext: string }) => {
      handleCharaCardDownloaded(payload)
    }
    const ipcRenderer = (window as any).electron.ipcRenderer
    ipcRenderer.on('chara-card-downloaded', handler)
    removeIpcListener = () => {
      if (ipcRenderer.removeListener) {
        ipcRenderer.removeListener('chara-card-downloaded', handler)
      }
    }
  }
})

onBeforeUnmount(() => {
  removeIpcListener()
  if (activeTab.value === 'creator' || draft.state.personaSource === 'creator') {
    syncCreatorDraft()
  }
})
</script>

<template>
  <div :class="['w-full max-w-[1280px] mx-auto h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Scrollable Content Body -->
    <div :class="['flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4']">
      <!-- Shared Centered Header -->
      <div :class="['flex flex-col items-center text-center gap-3']">
        <div
          v-motion
          :initial="{ opacity: 0, y: -6 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :class="['text-center']"
        >
          <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
            Character Soul & Persona
          </h1>
        </div>

        <AssistantBubble
          message="Give your character a name, a look, and a story direction. Then choose the version that feels right."
          step-key="persona"
          tone="primary"
        />
      </div>

      <!-- Segmented Tabs Switcher (AI Character Creator vs Starter Cards vs Community & Import) -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 4 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="300"
        :delay="80"
        :class="['flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/5 text-xs font-semibold flex-shrink-0']"
      >
        <!-- Segment 1: AI Character Creator (Recommended) -->
        <button
          type="button"
          :class="[
            'flex-1 py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2',
            activeTab === 'creator'
              ? 'border border-primary-500 bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          ]"
          @click="onSelectTab('creator')"
        >
          <div :class="['i-solar:magic-stick-3-bold text-sm text-primary-500']" />
          <span>AI Character Creator</span>
          <span :class="['px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-200/80 dark:bg-white/10 text-neutral-600 dark:text-neutral-300']">
            Recommended
          </span>
          <span
            v-if="draft.state.personaSource === 'creator'"
            :class="['px-1.5 py-0.2 rounded bg-primary-500/20 text-primary-600 dark:text-primary-400 text-[10px] font-bold']"
          >
            Active
          </span>
        </button>

        <!-- Segment 2: Starter Cards (8) -->
        <button
          type="button"
          :class="[
            'flex-1 py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2',
            activeTab === 'presets'
              ? 'border border-primary-500 bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          ]"
          @click="onSelectTab('presets')"
        >
          <div :class="['i-solar:stars-minimalistic-bold text-sm text-primary-500']" />
          <span>Starter Cards ({{ starterPresets.length }})</span>
          <span
            v-if="draft.state.personaSource === 'preset'"
            :class="['px-1.5 py-0.2 rounded bg-primary-500/20 text-primary-600 dark:text-primary-400 text-[10px] font-bold']"
          >
            Active
          </span>
        </button>

        <!-- Segment 3: Community & Import -->
        <button
          type="button"
          :class="[
            'flex-1 py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2',
            activeTab === 'hub'
              ? 'border border-primary-500 bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          ]"
          @click="onSelectTab('hub')"
        >
          <div :class="['i-solar:users-group-two-rounded-bold text-sm text-primary-500']" />
          <span>Community & Import</span>
          <span
            v-if="draft.state.personaSource === 'import' && importedName"
            :class="['px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold']"
          >
            Active
          </span>
        </button>
      </div>

      <!-- Starter Cards Layout: 65% Catalog + 35% Preview -->
      <div
        v-if="activeTab === 'presets'"
        :class="['w-full grid grid-cols-1 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] gap-4 lg:gap-5 items-stretch pb-2']"
      >
        <!-- Left Panel: Compact Character Catalog (~65%) -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 10 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="300"
          :delay="100"
          :class="[
            'rounded-[20px] border p-5 sm:p-6 transition-all flex flex-col gap-4',
            'border-neutral-200/80 bg-white/70 shadow-xs dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
          ]"
        >
          <!-- Catalog Header -->
          <div>
            <h2 :class="['text-base font-bold text-neutral-900 dark:text-white']">
              Choose a starting personality
            </h2>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
              Every character can be customized.
            </p>
          </div>

          <!-- 2-Column x 4-Row Grid of 8 Compact Presets -->
          <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-3']">
            <div
              v-for="preset in starterPresets"
              :key="preset.id"
              :class="[
                'p-3 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer select-none',
                'flex items-center justify-between gap-3 min-h-[88px]',
                selectedPresetId === preset.id
                  ? 'border-primary-500 ring-1 ring-primary-500/50 bg-primary-500/10 dark:bg-primary-500/15 shadow-xs'
                  : 'border-neutral-200/80 dark:border-neutral-800/80 bg-white/60 dark:bg-neutral-950/40 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50/50 dark:hover:bg-white/5',
              ]"
              @click="selectPreset(preset.id)"
            >
              <!-- Icon Tile -->
              <div :class="['h-10 w-10 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/50 dark:border-white/5 flex items-center justify-center text-xl shrink-0 shadow-2xs']">
                {{ preset.emoji }}
              </div>

              <!-- Character Details -->
              <div :class="['min-w-0 flex-1 flex flex-col justify-center gap-0.5']">
                <div :class="['flex items-center gap-1.5 flex-wrap']">
                  <span :class="['text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate']">
                    {{ preset.name }}
                  </span>
                  <span :class="['px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 truncate max-w-[130px]']">
                    {{ preset.tag }}
                  </span>
                </div>
                <p :class="['text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed']">
                  {{ STARTER_CARD_SUMMARIES[preset.id] || preset.desc }}
                </p>
              </div>

              <!-- Selection Indicator -->
              <div :class="['shrink-0 flex items-center justify-center']">
                <div
                  v-if="selectedPresetId === preset.id"
                  :class="['i-solar:check-circle-bold text-primary-500 text-xl']"
                />
                <div
                  v-else
                  :class="['h-5 w-5 rounded-full border-2 border-neutral-300 dark:border-neutral-700']"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Right Panel: Selected-Character Preview (~35%) -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 10 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="300"
          :delay="150"
          :class="[
            'rounded-[20px] border p-5 sm:p-6 transition-all flex flex-col justify-between gap-4',
            'border-neutral-200/80 bg-white/70 shadow-xs dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
          ]"
        >
          <!-- Top Section: Header & Description -->
          <div :class="['flex flex-col gap-4']">
            <!-- Personality Preview Heading -->
            <div>
              <h2 :class="['text-base font-bold text-neutral-900 dark:text-white']">
                Personality preview
              </h2>
            </div>

            <!-- Character Hero Tile -->
            <div :class="['flex items-center gap-3.5 pt-1']">
              <div :class="['h-12 w-12 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/50 dark:border-white/5 flex items-center justify-center text-2xl shrink-0 shadow-2xs']">
                {{ selectedPreset?.emoji }}
              </div>
              <div :class="['min-w-0 flex-1 flex flex-col gap-1']">
                <div :class="['flex items-center gap-2 flex-wrap']">
                  <span :class="['text-xl font-bold text-neutral-900 dark:text-white truncate']">
                    {{ selectedPreset?.name }}
                  </span>
                  <span :class="['px-2 py-0.5 rounded-md text-xs font-semibold bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 truncate']">
                    {{ selectedPreset?.tag }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Full Description -->
            <p :class="['text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed']">
              {{ selectedPreset?.desc }}
            </p>

            <!-- A First Hello Section -->
            <div :class="['flex flex-col gap-2 pt-1']">
              <h3 :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                A first hello
              </h3>
              <div :class="['p-3 rounded-xl bg-neutral-100/70 dark:bg-black/30 border border-neutral-200/50 dark:border-white/5 flex items-start gap-2.5']">
                <div :class="['i-solar:chat-round-dots-bold text-neutral-400 mt-0.5 text-base shrink-0']" />
                <p :class="['text-xs text-neutral-600 dark:text-neutral-300 italic leading-relaxed']">
                  "{{ formatField(selectedPreset?.greeting) }}"
                </p>
              </div>
            </div>
          </div>

          <!-- Bottom Section: Helper Note & View Details -->
          <div :class="['flex flex-col gap-2.5 pt-2 border-t border-neutral-200/60 dark:border-white/5']">
            <!-- Helper Note -->
            <div :class="['flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400']">
              <div :class="['i-solar:info-circle-bold text-neutral-400 text-sm shrink-0']" />
              <span>This personality works with your selected avatar.</span>
            </div>

            <!-- View Character Details Action -->
            <PopoverRoot>
              <PopoverTrigger as-child>
                <button
                  type="button"
                  :class="[
                    'w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium cursor-pointer transition-colors',
                    'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
                    'hover:bg-neutral-100 dark:hover:bg-white/5',
                  ]"
                >
                  <div :class="['flex items-center gap-2']">
                    <div :class="['i-solar:document-text-bold-duotone text-sm text-neutral-400']" />
                    <span>View character details</span>
                  </div>
                  <div :class="['i-solar:alt-arrow-right-line-duotone text-sm text-neutral-400']" />
                </button>
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverContent
                  align="end"
                  :side-offset="8"
                  :class="['z-50 max-w-sm p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 shadow-xl backdrop-blur-md text-xs']"
                >
                  <div :class="['flex items-center gap-2 mb-2']">
                    <span class="text-base">{{ selectedPreset?.emoji }}</span>
                    <span :class="['font-bold text-neutral-900 dark:text-white']">{{ selectedPreset?.name }}</span>
                    <span :class="['px-2 py-0.2 rounded-full text-[9px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300']">{{ selectedPreset?.tag }}</span>
                  </div>
                  <div :class="['space-y-2 text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed']">
                    <div>
                      <span :class="['font-bold text-neutral-800 dark:text-neutral-200']">Personality: </span>
                      <span>{{ formatField(selectedPreset?.personality) }}</span>
                    </div>
                    <div>
                      <span :class="['font-bold text-neutral-800 dark:text-neutral-200']">Scenario: </span>
                      <span>{{ formatField(selectedPreset?.scenario) }}</span>
                    </div>
                  </div>
                </PopoverContent>
              </PopoverPortal>
            </PopoverRoot>
          </div>
        </div>
      </div>

      <!-- TAB 2: Community Hub & Electron Interceptor -->
      <div
        v-else-if="activeTab === 'hub'"
        :class="['flex flex-col gap-3 pb-2']"
      >
        <!-- Notice Banner -->
        <div :class="['p-3.5 rounded-2xl border border-primary-500/30 bg-primary-500/10 backdrop-blur-md flex items-start gap-3']">
          <div :class="['i-solar:info-circle-bold-duotone text-lg text-primary-500 flex-shrink-0 mt-0.5']" />
          <div :class="['text-xs leading-relaxed text-neutral-700 dark:text-neutral-200']">
            <span :class="['font-bold text-neutral-900 dark:text-white']">Automatic Card Interceptor: </span>
            Browse any repository below and click to download any SillyTavern V2 character PNG or JSON card. AIRI automatically captures the download stream, parses the embedded metadata, and stages your companion.
          </div>
        </div>

        <!-- 4 Community Repositories Grid -->
        <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-3']">
          <div
            v-for="source in hubSources"
            :key="source.name"
            :class="[
              'p-3.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/60',
              'backdrop-blur-md flex flex-col justify-between gap-2 hover:border-primary-500/50 transition-all cursor-pointer group',
            ]"
            @click="openHubSource(source)"
          >
            <div :class="['flex items-center justify-between']">
              <div :class="['flex items-center gap-2']">
                <span :class="['text-xs font-bold text-neutral-900 dark:text-white group-hover:text-primary-500 transition-colors']">
                  {{ source.name }}
                </span>
                <span
                  v-if="source.badge"
                  :class="['px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary-500/15 text-primary-600 dark:text-primary-400']"
                >
                  {{ source.badge }}
                </span>
              </div>
              <div :class="['flex items-center gap-1 text-[10px] text-amber-500 font-bold']">
                <span>{{ source.rating }}</span>
                <div :class="['i-solar:arrow-up-right-linear text-xs text-neutral-400 group-hover:text-primary-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform']" />
              </div>
            </div>
            <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 leading-tight']">
              {{ source.note }}
            </p>
          </div>
        </div>

        <!-- File Drag & Drop Seam -->
        <label
          :class="[
            'p-4 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700/80',
            'bg-neutral-50/50 dark:bg-neutral-900/30 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/50',
            'flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors text-center',
          ]"
        >
          <div :class="['i-solar:cloud-upload-bold-duotone text-2xl text-neutral-400']" />
          <span :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
            Drop a SillyTavern character card or click to browse
          </span>
          <span :class="['text-[10px] text-neutral-400']">
            Supports PNG character cards with embedded tEXt chara chunks or CCv2/CCv3 JSON files.
          </span>
          <input
            type="file"
            accept=".png,.json"
            class="hidden"
            @change="(e: Event) => handleImportFiles((e.target as HTMLInputElement).files)"
          >
        </label>

        <!-- Import Error Alert -->
        <div
          v-if="importError"
          :class="['p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-600 dark:text-red-400']"
        >
          {{ importError }}
        </div>

        <!-- Staged Imported Card Banner -->
        <div
          v-if="draft.state.personaSource === 'import' && importedName"
          :class="['p-3.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 backdrop-blur-md flex items-center justify-between gap-3']"
        >
          <div :class="['flex items-center gap-3 min-w-0']">
            <div :class="['h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 text-lg']">
              ✓
            </div>
            <div :class="['min-w-0']">
              <div :class="['text-xs font-bold text-neutral-900 dark:text-white truncate flex items-center gap-1.5']">
                <span>{{ importedName }}</span>
                <span :class="['px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold']">
                  Staged Custom Card
                </span>
              </div>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5']">
                Active in onboarding draft — ready to synthesize onto your companion.
              </p>
            </div>
          </div>
          <button
            type="button"
            :class="['text-xs text-neutral-400 hover:text-red-500 underline cursor-pointer flex-shrink-0 transition-colors']"
            @click="clearImported"
          >
            Clear / Revert
          </button>
        </div>
      </div>

      <!-- TAB 1: AI Character Creator (Compact Identity Strip + Two-Panel Workspace) -->
      <div
        v-else-if="activeTab === 'creator'"
        :class="['flex flex-col gap-4 pb-2']"
      >
        <!-- 1. Full-width character inspiration strip -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 10 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="300"
          :delay="100"
          :class="[
            'rounded-[20px] border p-4 sm:p-5 transition-all flex flex-col gap-3',
            'border-neutral-200/80 bg-white/70 shadow-xs dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
          ]"
        >
          <!-- Strip Header -->
          <div :class="['flex items-center justify-between gap-2']">
            <h2 :class="['text-sm sm:text-base font-bold text-neutral-900 dark:text-white']">
              Character inspiration
            </h2>

            <button
              type="button"
              :disabled="!canResetIdentity"
              :class="[
                'text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 flex items-center gap-1.5 transition-colors',
                canResetIdentity ? 'cursor-pointer active:scale-97' : 'opacity-40 cursor-not-allowed',
              ]"
              title="Reset avatar, tags, and identity fields"
              @click="resetIdentitySection"
            >
              <div :class="['i-solar:restart-bold h-3.5 w-3.5']" />
              <span>Reset fields</span>
            </button>
          </div>

          <!-- Strip Body (Avatar Preview + Name & Origin + Visual Traits) -->
          <div :class="['grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 lg:gap-6 items-start']">
            <!-- Left Side: Avatar Preview + Name & Series + Action Buttons -->
            <div :class="['flex items-start gap-3.5 sm:gap-4']">
              <!-- Small Avatar Preview (80–100px) -->
              <div
                :class="[
                  'relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden shrink-0 shadow-2xs',
                  customAvatar
                    ? 'border-primary-500/50 bg-primary-500/5'
                    : 'border-dashed border-neutral-300 dark:border-neutral-700 hover:border-primary-500 bg-neutral-100/60 dark:bg-neutral-800/50',
                ]"
                @click="triggerAvatarFilePicker"
                @dragover.prevent
                @drop.prevent="handleAvatarDrop"
              >
                <img
                  v-if="customAvatar"
                  :src="customAvatar"
                  alt="Avatar Preview"
                  class="h-full w-full object-cover"
                >
                <div v-else :class="['flex flex-col items-center justify-center p-1 text-center leading-tight']">
                  <div :class="['i-solar:gallery-wide-bold text-neutral-400 text-xl']" />
                  <span :class="['text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 mt-1']">Upload</span>
                </div>

                <!-- Hover Overlay to Change or Remove -->
                <div
                  v-if="customAvatar"
                  :class="['absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-semibold gap-1 backdrop-blur-2xs p-1']"
                >
                  <button
                    type="button"
                    :class="['flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 hover:bg-white/30 transition-colors cursor-pointer w-16 justify-center']"
                    @click.stop="triggerAvatarFilePicker"
                  >
                    <div :class="['i-solar:restart-bold h-3 w-3']" />
                    <span>Change</span>
                  </button>
                  <button
                    type="button"
                    :class="['flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/85 hover:bg-rose-600 transition-colors cursor-pointer text-white w-16 justify-center shadow-xs']"
                    @click.stop="removeAvatarImage"
                  >
                    <div :class="['i-solar:trash-bin-trash-bold h-3 w-3']" />
                    <span>Remove</span>
                  </button>
                </div>

                <input
                  ref="avatarFileInput"
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  class="hidden"
                  @change="handleAvatarFileSelected"
                >
              </div>

              <!-- Center Inputs & Action Buttons -->
              <div :class="['flex-1 min-w-0 flex flex-col gap-2.5']">
                <!-- Name & Series Fields -->
                <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-2']">
                  <div>
                    <label :class="['text-[11px] font-bold text-neutral-700 dark:text-neutral-300 block mb-1']">
                      Character name <span class="text-primary-500">*</span>
                    </label>
                    <input
                      v-model="customName"
                      type="text"
                      placeholder="e.g. Ririchiyo"
                      :class="['w-full px-3 py-1.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-hidden focus:border-primary-500']"
                      @input="onCustomNameInput"
                    >
                  </div>

                  <div>
                    <label :class="['text-[11px] font-bold text-neutral-700 dark:text-neutral-300 block mb-1']">
                      Series / origin
                    </label>
                    <input
                      v-model="customSeries"
                      type="text"
                      placeholder="e.g. Inu x Boku SS"
                      :class="['w-full px-3 py-1.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-hidden focus:border-primary-500']"
                      @input="syncCreatorDraft"
                    >
                  </div>
                </div>

                <!-- 3 Action Buttons -->
                <div :class="['flex items-center gap-1.5 flex-wrap']">
                  <!-- Upload Image -->
                  <button
                    type="button"
                    :class="[
                      'flex items-center gap-1.5 py-1 px-2.5 rounded-xl text-xs font-semibold transition-all border shadow-2xs cursor-pointer',
                      'border-neutral-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 active:scale-97',
                    ]"
                    @click="triggerAvatarFilePicker"
                  >
                    <div :class="['i-solar:upload-track-bold h-3.5 w-3.5 text-primary-500']" />
                    <span>Upload image</span>
                  </button>

                  <!-- Browse Catalog -->
                  <button
                    type="button"
                    :class="[
                      'flex items-center gap-1.5 py-1 px-2.5 rounded-xl text-xs font-semibold transition-all border shadow-2xs cursor-pointer',
                      isCatalogOpen
                        ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                        : 'border-neutral-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 active:scale-97',
                    ]"
                    @click="isCatalogOpen = !isCatalogOpen"
                  >
                    <div :class="['i-solar:widget-add-bold h-3.5 w-3.5 text-primary-500']" />
                    <span>Browse catalog</span>
                  </button>

                  <!-- From Vessel -->
                  <button
                    type="button"
                    :disabled="!vesselPreviewUrl"
                    :title="vesselPreviewUrl ? `Apply thumbnail from ${vesselName}` : 'No vessel thumbnail available'"
                    :class="[
                      'flex items-center gap-1.5 py-1 px-2.5 rounded-xl text-xs font-semibold transition-all border shadow-2xs',
                      vesselPreviewUrl
                        ? 'cursor-pointer border-neutral-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 active:scale-97'
                        : 'opacity-40 cursor-not-allowed border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800/40 text-neutral-400',
                    ]"
                    @click="useVesselPreviewAsAvatar"
                  >
                    <div :class="['i-solar:user-bold h-3.5 w-3.5 text-primary-500']" />
                    <span>From vessel</span>
                  </button>
                </div>

                <!-- Image Helper Note -->
                <div :class="['flex items-center gap-1.5 text-[10px] text-neutral-400']">
                  <div :class="['i-solar:info-circle-bold text-xs shrink-0']" />
                  <span>Image used for traits; it isn’t saved to the character card.</span>
                </div>
              </div>
            </div>

            <!-- Right Side: Visual Traits & Suggest Tags Action -->
            <div :class="['w-full flex flex-col gap-1.5 lg:border-l lg:border-neutral-200/80 lg:dark:border-neutral-800/80 lg:pl-5']">
              <div :class="['flex items-center justify-between mb-0.5']">
                <label :class="['text-xs font-bold text-neutral-700 dark:text-neutral-300']">
                  Visual traits
                </label>
                <button
                  type="button"
                  :disabled="isTaggingImage || !customAvatar"
                  :class="[
                    'flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                  ]"
                  @click="runBlipAutoTag"
                >
                  <div :class="['i-solar:magic-stick-3-bold-duotone h-3.5 w-3.5', isTaggingImage ? 'animate-spin' : '']" />
                  <span>{{ isTaggingImage ? 'Suggesting tags…' : 'Suggest tags' }}</span>
                </button>
              </div>

              <!-- Tags Flow -->
              <div :class="['flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-neutral-100/60 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/80 min-h-[42px]']">
                <span
                  v-for="tag in customTags"
                  :key="tag"
                  :class="[
                    'px-2 py-0.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-2xs',
                    'bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100',
                  ]"
                >
                  <span>{{ tag.replace(/^#/, '').replace(/-/g, ' ') }}</span>
                  <button
                    type="button"
                    :class="['text-neutral-400 hover:text-rose-500 cursor-pointer transition-colors']"
                    @click="removeTag(tag)"
                  >
                    <div :class="['i-solar:close-circle-bold h-3.5 w-3.5']" />
                  </button>
                </span>

                <div :class="['flex items-center gap-1 min-w-[90px] flex-1']">
                  <input
                    v-model="newTagInput"
                    type="text"
                    placeholder="+ Add trait..."
                    :class="['bg-transparent text-xs text-neutral-800 dark:text-neutral-200 outline-hidden w-full px-1.5 py-0.5']"
                    @keydown.enter.prevent="addTag"
                    @keydown.comma.prevent="addTag"
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Inline Expandable Catalog Picker (Preserves workspace layout) -->
          <div
            v-if="isCatalogOpen"
            v-motion
            :initial="{ opacity: 0, height: 0 }"
            :enter="{ opacity: 1, height: 'auto' }"
            :duration="250"
            :class="['pt-3 border-t border-neutral-200/80 dark:border-neutral-800/80 flex flex-col gap-2.5']"
          >
            <div :class="['flex items-center gap-2']">
              <div :class="['relative flex-1']">
                <div :class="['i-solar:magnifer-linear absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400']" />
                <input
                  v-model="catalogSearch"
                  type="text"
                  placeholder="Search characters by name, series, or tags..."
                  :class="['w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white focus:outline-hidden focus:border-primary-500']"
                >
              </div>
              <button
                type="button"
                :class="['p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer']"
                title="Close catalog"
                @click="isCatalogOpen = false"
              >
                <div :class="['i-solar:close-circle-bold h-4 w-4']" />
              </button>
            </div>

            <div :class="['grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[140px] overflow-y-auto pr-1']">
              <button
                v-for="char in catalogList"
                :key="char.id"
                type="button"
                :class="[
                  'p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/50 dark:bg-neutral-800/50 hover:border-primary-500 flex items-center gap-2 text-left cursor-pointer transition-all hover:scale-[1.01] shadow-2xs',
                ]"
                @click="selectCatalogCharacter(char)"
              >
                <img
                  v-if="wizardStore.getCharacterThumbUrl(char.trigger)"
                  :src="wizardStore.getCharacterThumbUrl(char.trigger)!"
                  alt=""
                  class="h-9 w-9 flex-shrink-0 rounded-lg bg-neutral-200 object-cover dark:bg-neutral-700"
                >
                <div v-else class="h-9 w-9 flex flex-shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-sm dark:bg-neutral-700">
                  ✨
                </div>
                <div :class="['min-w-0 flex-1']">
                  <div :class="['text-xs font-bold text-neutral-800 dark:text-neutral-100 truncate']">
                    {{ char.name }}
                  </div>
                  <div :class="['text-[10px] text-neutral-400 truncate']">
                    {{ wizardStore.copyrights[char.copyrightIndex] || 'Anime' }}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- 2 & 3. Lower Workspace: Story Direction (~48%) + Choose a Variation (~52%) -->
        <div :class="['w-full grid grid-cols-1 lg:grid-cols-[minmax(0,48fr)_minmax(0,52fr)] gap-4 lg:gap-5 items-stretch']">
          <!-- 2. Left Panel: Story Direction (~48%) -->
          <div
            v-motion
            :initial="{ opacity: 0, y: 10 }"
            :enter="{ opacity: 1, y: 0 }"
            :duration="300"
            :delay="120"
            :class="[
              'rounded-[20px] border p-4 sm:p-5 transition-all flex flex-col justify-between gap-4',
              'border-neutral-200/80 bg-white/70 shadow-xs dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
            ]"
          >
            <!-- Top Section: Heading + 18 Chips -->
            <div :class="['flex flex-col gap-3']">
              <div>
                <h2 :class="['text-base font-bold text-neutral-900 dark:text-white']">
                  Story direction
                </h2>
                <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
                  Choose a starting point—or write your own.
                </p>
              </div>

              <!-- 18 Visible One-Click Chips in a Compact 3-Column Grid -->
              <div :class="['grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2']">
                <button
                  v-for="trope in tropeTemplates"
                  :key="trope.id"
                  type="button"
                  :class="[
                    'p-2 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-2 text-left truncate select-none',
                    selectedTropeId === trope.id
                      ? 'border border-purple-500 ring-1 ring-purple-500/50 bg-purple-500/15 text-neutral-900 dark:text-white shadow-xs font-bold'
                      : 'border border-neutral-200/80 dark:border-neutral-800/80 bg-white/60 dark:bg-neutral-950/40 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50/50 dark:hover:bg-white/5',
                  ]"
                  @click="selectTrope(trope)"
                >
                  <span class="shrink-0 text-sm">{{ trope.icon }}</span>
                  <span class="truncate">{{ trope.label }}</span>
                </button>
              </div>
            </div>

            <!-- Bottom Section: Scenario Guidance Textarea + Suggest Action -->
            <div :class="['flex flex-col gap-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60']">
              <label :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                Your story idea <span :class="['text-[11px] font-normal text-neutral-400']">(Optional)</span>
              </label>
              <textarea
                v-model="guidancePrompt"
                rows="3"
                placeholder="A reserved companion who shares quiet evenings at your desk, gradually revealing a mischievous sense of humor."
                :class="[
                  'w-full p-2.5 rounded-xl text-xs text-neutral-900 dark:text-white resize-none focus:outline-hidden focus:border-purple-500',
                  'bg-neutral-100/80 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700',
                ]"
                @input="syncCreatorDraft"
              />
              <div :class="['flex items-center gap-2.5 flex-wrap']">
                <button
                  type="button"
                  :class="[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer transition-all shadow-2xs',
                  ]"
                  @click="suggestStoryIdea"
                >
                  <div :class="['i-solar:magic-stick-3-bold-duotone text-xs text-primary-500']" />
                  <span>Suggest a story idea</span>
                </button>
                <span :class="['text-[11px] text-neutral-400']">
                  Fills the idea above. Edit it or write your own.
                </span>
              </div>
            </div>
          </div>

          <!-- 3. Right Panel: Choose a Variation (~52%) -->
          <div
            v-motion
            :initial="{ opacity: 0, y: 10 }"
            :enter="{ opacity: 1, y: 0 }"
            :duration="300"
            :delay="140"
            :class="[
              'rounded-[20px] border p-4 sm:p-5 transition-all flex flex-col justify-between gap-4',
              'border-neutral-200/80 bg-white/70 shadow-xs dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
            ]"
          >
            <!-- Top Section: Header + 3 Title-Only Cards -->
            <div :class="['flex flex-col gap-3']">
              <div :class="['flex items-center justify-between']">
                <div>
                  <h2 :class="['text-base font-bold text-neutral-900 dark:text-white']">
                    Choose a variation
                  </h2>
                  <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
                    Pick a story, then refine its greeting and setting.
                  </p>
                </div>
                <button
                  v-if="proposals.length > 0"
                  type="button"
                  :disabled="isGeneratingStory"
                  :class="[
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 transition-all cursor-pointer disabled:opacity-50',
                  ]"
                  title="Generate fresh variations with AI"
                  @click="generateStoryIdeas"
                >
                  <div :class="['i-solar:magic-stick-3-bold-duotone h-3.5 w-3.5', isGeneratingStory ? 'animate-spin' : '']" />
                  <span>{{ isGeneratingStory ? 'Dreaming…' : 'Generate with AI' }}</span>
                </button>
              </div>

              <!-- Loading State -->
              <div v-if="isGeneratingStory" :class="['py-8 flex flex-col items-center justify-center text-center gap-2']">
                <div :class="['i-solar:magic-stick-3-bold-duotone h-8 w-8 text-primary-500 animate-spin']" />
                <p :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
                  Dreaming up story ideas with {{ activeBrainModelName }}…
                </p>
                <p :class="['text-[11px] text-neutral-400 max-w-xs']">
                  Synthesizing scene proposals, greetings, and world dynamics.
                </p>
              </div>

              <!-- Empty State -->
              <div v-else-if="proposals.length === 0" :class="['py-8 flex flex-col items-center justify-center text-center gap-2.5']">
                <div :class="['i-solar:clapperboard-play-bold-duotone h-8 w-8 text-neutral-400']" />
                <p :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
                  No story variations yet
                </p>
                <p :class="['text-[11px] text-neutral-400 max-w-xs']">
                  Pick a story direction on the left or generate tailored variations for {{ customName || 'your companion' }}.
                </p>
                <Button variant="primary" size="sm" @click="generateStoryIdeas">
                  <span>🪄 Generate Story Variations</span>
                </Button>
              </div>

              <!-- 3 Compact, Equal-Width, Title-Only Selection Cards -->
              <div v-else :class="['grid grid-cols-1 sm:grid-cols-3 gap-2.5']">
                <div
                  v-for="(p, idx) in proposals"
                  :key="p.id"
                  :class="[
                    'relative p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none',
                    'flex flex-col justify-between min-h-[72px] sm:min-h-[84px]',
                    activeProposalId === p.id
                      ? 'border-primary-500 ring-1 ring-primary-500/50 bg-primary-500/10 dark:bg-primary-500/15 shadow-xs'
                      : 'border-neutral-200/80 dark:border-neutral-800/80 bg-white/60 dark:bg-neutral-950/40 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50/50 dark:hover:bg-white/5',
                  ]"
                  @click="selectProposal(p.id)"
                >
                  <div :class="['flex items-start justify-between gap-2']">
                    <span
                      :class="[
                        'h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                        activeProposalId === p.id
                          ? 'bg-primary-500 text-white'
                          : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300',
                      ]"
                    >
                      {{ idx + 1 }}
                    </span>
                    <div
                      v-if="activeProposalId === p.id"
                      :class="['i-solar:check-circle-bold text-primary-500 text-base shrink-0']"
                    />
                  </div>
                  <div :class="['text-xs font-bold text-neutral-900 dark:text-white leading-snug line-clamp-3 mt-1']">
                    {{ formatField(p.title) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Bottom Section: Opening Greeting & Story Setting Fields -->
            <div v-if="activeProposal && !isGeneratingStory" :class="['flex flex-col gap-3 pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60']">
              <!-- Field 1: Opening Greeting -->
              <div>
                <div :class="['flex items-center justify-between mb-1']">
                  <label :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 flex-wrap']">
                    <span>Opening greeting</span>
                    <span
                      v-if="activeProposalActorName"
                      :class="[
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0',
                        'bg-primary-500/15 text-primary-600 dark:text-primary-400 border border-primary-500/30',
                      ]"
                    >
                      <div :class="['i-solar:user-speak-bold-duotone h-3 w-3']" />
                      <span>{{ activeProposalActorName }}</span>
                    </span>
                  </label>
                  <div :class="['flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400']">
                    <div :class="['i-solar:check-circle-bold-duotone h-3.5 w-3.5']" />
                    <span>Changes saved</span>
                  </div>
                </div>
                <textarea
                  v-model="activeProposalGreetingDisplay"
                  rows="3"
                  placeholder="First words spoken by the companion..."
                  :class="[
                    'w-full p-2.5 rounded-xl text-xs text-neutral-900 dark:text-white resize-none focus:outline-hidden focus:border-primary-500',
                    'bg-neutral-100/80 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700',
                  ]"
                />
              </div>

              <!-- Field 2: Story Setting -->
              <div>
                <div :class="['flex items-center justify-between mb-1']">
                  <label :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                    Story setting
                  </label>
                </div>
                <textarea
                  v-model="activeProposal.scenario"
                  rows="3"
                  placeholder="Rules of the world and companion dynamic..."
                  :class="[
                    'w-full p-2.5 rounded-xl text-xs text-neutral-900 dark:text-white resize-none focus:outline-hidden focus:border-primary-500',
                    'bg-neutral-100/80 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700',
                  ]"
                  @input="syncCreatorDraft"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation & Synergy Preview -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="350"
      :delay="200"
      :class="[
        'flex-shrink-0 pt-4 flex items-center justify-between border-t border-neutral-200/80 dark:border-white/5',
      ]"
    >
      <button
        type="button"
        :class="[
          'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer',
          'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          'hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors',
        ]"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>{{ t('onboarding.shell.previous') }}</span>
      </button>

      <!-- Center Status Label -->
      <div v-if="activeTab === 'creator'" :class="['text-xs text-neutral-400 font-medium']">
        Character: <span :class="['text-neutral-800 dark:text-neutral-100 font-semibold']">{{ customName || 'Companion' }}</span>
      </div>
      <div v-else-if="activeTab === 'presets'" :class="['text-xs text-neutral-400 font-medium']">
        Selected personality: <span :class="['text-neutral-800 dark:text-neutral-100 font-semibold']">{{ selectedPreset.name }}</span>
      </div>
      <div v-else :class="['text-[11px] text-neutral-400 font-medium truncate max-w-sm hidden sm:block text-center']">
        <span>Soul: </span>
        <span :class="['text-neutral-800 dark:text-neutral-200 font-bold']">{{ activePersonaLabel }}</span>
        <span :class="['mx-1.5 text-neutral-300 dark:text-neutral-600']">•</span>
        <span>Body: </span>
        <span :class="['text-neutral-800 dark:text-neutral-200 font-bold']">{{ vesselName }}</span>
      </div>

      <Button
        variant="primary"
        size="md"
        :class="[
          'flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold text-white shadow-md transition-all active:scale-95 cursor-pointer',
          activeTab === 'creator'
            ? 'bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 shadow-purple-600/25'
            : 'bg-primary-600 hover:bg-primary-500 shadow-primary-600/25',
        ]"
        @click="handleNextStep"
      >
        <span v-if="activeTab === 'creator'">✨</span>
        <span>{{ nextButtonText }}</span>
        <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
      </Button>
    </div>

    <!-- Import Wizard Modal for draft-only persona synthesis -->
    <CardImportWizard
      v-if="wizardCardData"
      v-model="isWizardOpen"
      :card-data="wizardCardData"
      :draft-only="true"
      @submit-draft="handleWizardSubmitDraft"
    />

    <!-- Electron In-App Webview Side Drawer with automatic card download interceptor -->
    <Teleport to="body">
      <!-- Backdrop Overlay for Webview Drawer -->
      <Transition
        enter-active-class="transition-opacity duration-300 ease-out"
        leave-active-class="transition-opacity duration-200 ease-in"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isElectron && activeBrowserSource"
          class="backdrop-blur-xs fixed inset-0 z-40 bg-black/50"
          @click="closeWebview"
        />
      </Transition>

      <Transition
        enter-active-class="transition-transform duration-300 ease-out"
        leave-active-class="transition-transform duration-200 ease-in"
        enter-from-class="translate-x-full"
        leave-to-class="translate-x-full"
      >
        <div
          v-if="isElectron && activeBrowserSource"
          class="fixed inset-y-0 right-0 z-50 w-[70vw] border-l border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div class="relative z-10 h-full flex flex-col">
            <div class="relative z-20 flex items-center justify-between border-b border-neutral-200 bg-white/95 p-4 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95">
              <div class="flex items-center gap-3">
                <h3 class="text-lg text-neutral-800 font-bold dark:text-neutral-200">
                  Browse {{ activeBrowserSource?.name }}
                </h3>
                <span class="rounded-full bg-primary-500/10 px-2.5 py-0.5 text-xs text-primary-600 font-semibold dark:text-primary-400">
                  Card Interceptor Active
                </span>
              </div>
              <button
                type="button"
                class="relative z-30 flex cursor-pointer items-center justify-center rounded-xl p-2 text-neutral-400 transition-colors active:scale-95 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                title="Close Browser"
                @click.stop="closeWebview"
              >
                <div class="i-solar:close-square-bold-duotone h-6 w-6" />
              </button>
            </div>
            <div class="relative z-10 flex-1 bg-white dark:bg-neutral-950">
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
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
