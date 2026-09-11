<script setup lang="ts">
import type { SynthesisProposal } from '../../../../../../composables/use-card-synthesis'
import type { StoryProposalItem } from '../stores/useOnboardingV3Draft'

import { SPOTLIGHT_MODELS } from '@proj-airi/stage-ui/constants'
import { STARTER_CHARACTERS } from '@proj-airi/stage-ui/constants/prompts/character-defaults'
import { Button } from '@proj-airi/ui'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import CardImportWizard from '../../../../../../../../stage-pages/src/pages/settings/airi-card/components/CardImportWizard.vue'

import {
  compileCardBundle,
  deterministicActorKey,

  useCardSynthesis,
} from '../../../../../../composables/use-card-synthesis'
import { useAnimaDexWizardStore } from '../../../../../../stores/animadex-wizard'
import { useDisplayModelsStore } from '../../../../../../stores/display-models'
import { useConsciousnessStore } from '../../../../../../stores/modules/consciousness'
import { useProvidersStore } from '../../../../../../stores/providers'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const draft = useOnboardingV3Draft()
const displayModelsStore = useDisplayModelsStore()
const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const wizardStore = useAnimaDexWizardStore()

type PersonaTab = 'presets' | 'hub' | 'creator'
const activeTab = ref<PersonaTab>(
  draft.state.personaSource === 'creator'
    ? 'creator'
    : (draft.state.personaSource === 'import' ? 'hub' : 'presets'),
)

// User's name from Step 4 Profile
const userName = computed(() => draft.state.userName?.trim() || 'Richard')
const USER_TOKEN_REGEX = /(?<!\{)\{user\}(?!\})/g

function formatField(text?: string) {
  if (!text)
    return ''
  return text.replace(USER_TOKEN_REGEX, userName.value).replace(/\bRichard\b/g, userName.value)
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

const selectedPresetId = computed({
  get: () => draft.state.personaSource === 'preset' ? (draft.state.personaCardId || 'default') : '',
  set: (id: string) => {
    applyPersonaToDraft({ cardId: id, source: 'preset' })
  },
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
  }
}

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
          .split(/[,;\s]+/)
          .filter(Boolean)
          .map((t: string) => t.startsWith('#') ? t : `#${t}`)
        for (const t of tagsFromBlip) {
          if (!customTags.value.includes(t))
            customTags.value.push(t)
        }
        toast.success('Extracted visual tags via BLIP!')
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
  if (fullProposals.value.length === 0) {
    proposals.value = createDefaultProposals(customName.value, selectedTropeId.value)
    activeProposalId.value = '1'
  }
  syncCreatorDraft()
  toast.success(`Selected ${char.name} from catalog!`)
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
            whitelistedExpressions: caps.expressions || [],
            whitelistedMotions: caps.motions || [],
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
    const name = customName.value.trim() || 'Companion'
    return `Lock In ${name} & Continue to Hearing`
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
  if (draft.state?.personaSource === 'creator') {
    activeTab.value = 'creator'
    if (draft.state.companionName) {
      customName.value = draft.state.companionName
    }
  }
  else if (draft.state?.personaSource !== 'import') {
    const id = draft.state?.personaCardId || 'default'
    const preset = STARTER_CHARACTERS[id]
    const knownPresets = Object.values(STARTER_CHARACTERS).map(c => c.name)
    if (preset && draft.state && (!draft.state.companionName || knownPresets.includes(draft.state.companionName) || ['ReLU', 'Dr. Aria', 'Lupin', 'Airi'].includes(draft.state.companionName))) {
      draft.state.companionName = preset.name
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
})
</script>

<template>
  <div :class="['h-full w-full max-w-5xl mx-auto flex flex-col justify-between gap-3 select-none animate-fadeIn']">
    <!-- Header -->
    <div
      v-motion
      :initial="{ opacity: 0, y: -6 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="300"
      :class="['flex-shrink-0']"
    >
      <div :class="['flex items-center justify-between text-xs text-neutral-400 mb-0.5']">
        <span :class="['text-primary-500 font-semibold']">Step 7 of 16</span>
        <span :class="['font-medium tracking-wide uppercase']">Personality Core</span>
      </div>
      <div :class="['flex items-center justify-between']">
        <div>
          <h2 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
            Soul & Persona
          </h2>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
            Pure personality — bodies come first, and any soul pairs with any form.
          </p>
        </div>
        <div :class="['flex items-center gap-2']">
          <span :class="['px-3 py-1 rounded-full text-xs font-medium border border-neutral-200/80 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 text-neutral-600 dark:text-neutral-300 backdrop-blur-md']">
            🎭 {{ starterPresets.length }} Anime Tropes
          </span>
        </div>
      </div>
    </div>

    <!-- Segmented Tabs Switcher (Starter Cards vs Community Hub vs AI Character Creator) -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 4 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="300"
      :delay="80"
      :class="['flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/5 text-xs font-semibold flex-shrink-0']"
    >
      <button
        type="button"
        :class="[
          'flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2',
          activeTab === 'presets'
            ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white'
            : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
        ]"
        @click="onSelectTab('presets')"
      >
        <span class="text-sm">✨</span>
        <span>Starter Cards ({{ starterPresets.length }})</span>
      </button>

      <button
        type="button"
        :class="[
          'flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2',
          activeTab === 'hub'
            ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white'
            : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
        ]"
        @click="onSelectTab('hub')"
      >
        <span class="text-sm">🪐</span>
        <span>Community Hub & SillyTavern Cards</span>
        <span
          v-if="draft.state.personaSource === 'import' && importedName"
          :class="['px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold']"
        >
          Active
        </span>
      </button>

      <button
        type="button"
        :class="[
          'flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2',
          activeTab === 'creator'
            ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white'
            : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
        ]"
        @click="onSelectTab('creator')"
      >
        <span class="text-sm">🪄</span>
        <span>AI Character Creator</span>
        <span
          v-if="draft.state.personaSource === 'creator'"
          :class="['px-1.5 py-0.2 rounded bg-primary-500/20 text-primary-600 dark:text-primary-400 text-[10px] font-bold']"
        >
          Active
        </span>
      </button>
    </div>

    <!-- Main Content Area -->
    <div :class="['flex-1 min-h-0 overflow-y-auto pr-1']">
      <!-- TAB 1: Starter Cards Grid (8 anime tropes) -->
      <div
        v-if="activeTab === 'presets'"
        :class="['grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2']"
      >
        <div
          v-for="preset in starterPresets"
          :key="preset.id"
          :class="[
            'p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer text-left flex flex-col justify-between gap-2.5',
            'backdrop-blur-md relative overflow-hidden',
            selectedPresetId === preset.id
              ? [preset.ring, preset.activeBg, 'shadow-md border-2']
              : 'border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700',
          ]"
          @click="selectPreset(preset.id)"
        >
          <!-- Top Row: Avatar Badge + Name + Trope + Radio -->
          <div :class="['flex items-start justify-between gap-2']">
            <div :class="['flex items-center gap-2.5 min-w-0']">
              <div :class="['h-9 w-9 rounded-xl flex items-center justify-center text-lg bg-neutral-100 dark:bg-neutral-800 shadow-2xs flex-shrink-0']">
                {{ preset.emoji }}
              </div>
              <div :class="['min-w-0 flex-1']">
                <div :class="['flex items-center gap-1.5 flex-wrap']">
                  <span :class="['text-xs font-bold text-neutral-900 dark:text-white truncate']">
                    {{ preset.name }}
                  </span>
                  <span :class="['px-2 py-0.2 rounded-full text-[9px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300']">
                    {{ preset.tag }}
                  </span>
                </div>
                <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1']">
                  {{ preset.desc }}
                </p>
              </div>
            </div>

            <!-- Radio Indicator + Lore Popover -->
            <div :class="['flex items-center gap-1 flex-shrink-0']">
              <PopoverRoot>
                <PopoverTrigger as-child>
                  <button
                    type="button"
                    :class="['h-6 w-6 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors cursor-pointer']"
                    title="View Lore & Scenario"
                    @click.stop
                  >
                    <div :class="['i-solar:info-circle-bold-duotone h-4 w-4']" />
                  </button>
                </PopoverTrigger>
                <PopoverPortal>
                  <PopoverContent
                    align="end"
                    :side-offset="6"
                    :class="['z-50 max-w-sm p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 shadow-xl backdrop-blur-md text-xs']"
                  >
                    <div :class="['flex items-center gap-2 mb-2']">
                      <span class="text-base">{{ preset.emoji }}</span>
                      <span :class="['font-bold text-neutral-900 dark:text-white']">{{ preset.name }}</span>
                      <span :class="['px-2 py-0.2 rounded-full text-[9px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300']">{{ preset.tag }}</span>
                    </div>
                    <div :class="['space-y-2 text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed']">
                      <div>
                        <span :class="['font-bold text-neutral-800 dark:text-neutral-200']">Personality: </span>
                        <span>{{ formatField(preset.personality) }}</span>
                      </div>
                      <div>
                        <span :class="['font-bold text-neutral-800 dark:text-neutral-200']">Scenario: </span>
                        <span>{{ formatField(preset.scenario) }}</span>
                      </div>
                    </div>
                  </PopoverContent>
                </PopoverPortal>
              </PopoverRoot>

              <div
                :class="[
                  'h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center transition-all',
                  selectedPresetId === preset.id
                    ? [preset.ring, 'bg-white dark:bg-neutral-900']
                    : 'border-neutral-300 dark:border-neutral-700',
                ]"
              >
                <div
                  v-if="selectedPresetId === preset.id"
                  :class="['h-2 w-2 rounded-full bg-current', preset.textAccent]"
                />
              </div>
            </div>
          </div>

          <!-- Bottom: Live Sample First Greeting -->
          <div :class="['p-2 px-2.5 rounded-xl bg-neutral-100/60 dark:bg-black/30 border border-neutral-200/50 dark:border-white/5 flex items-start gap-1.5']">
            <span :class="['text-xs text-neutral-400 mt-0.5 flex-shrink-0']">💬</span>
            <span :class="['text-[11px] text-neutral-600 dark:text-neutral-300 italic line-clamp-2']">
              "{{ formatField(preset.greeting) }}"
            </span>
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

      <!-- TAB 3: AI Character Creator -->
      <div
        v-else-if="activeTab === 'creator'"
        :class="['flex flex-col gap-3 pb-2']"
      >
        <!-- Section 1: Identity & Avatar Source -->
        <div :class="['p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/80 backdrop-blur-md flex flex-col gap-3']">
          <div :class="['flex items-center justify-between flex-wrap gap-2']">
            <div :class="['flex items-center gap-2']">
              <div :class="['h-6 w-6 rounded-lg bg-primary-500/10 text-primary-500 flex items-center justify-center text-xs font-bold']">
                1
              </div>
              <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-100 uppercase tracking-wider']">
                Identity & Avatar Source
              </span>
            </div>

            <!-- Mode Pill Toggle -->
            <div :class="['flex items-center p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium']">
              <button
                type="button"
                :class="[
                  'px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5',
                  identityMode === 'custom'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
                ]"
                @click="identityMode = 'custom'"
              >
                <div :class="['i-solar:upload-track-bold-duotone h-3.5 w-3.5']" />
                <span>Upload Custom Image</span>
              </button>
              <button
                type="button"
                :class="[
                  'px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5',
                  identityMode === 'catalog'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
                ]"
                @click="identityMode = 'catalog'"
              >
                <div :class="['i-solar:book-bookmark-bold-duotone h-3.5 w-3.5']" />
                <span>Browse Catalog (Anime)</span>
              </button>
            </div>
          </div>

          <!-- Mode A: Custom Image Upload & Metadata -->
          <div v-if="identityMode === 'custom'" :class="['flex flex-col sm:flex-row items-start gap-4 pt-1']">
            <!-- Avatar Dropzone / Preview -->
            <div
              :class="[
                'relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-2 border-dashed flex-shrink-0 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden',
                customAvatar
                  ? 'border-primary-500/50 bg-primary-500/5'
                  : 'border-neutral-300 dark:border-neutral-700 hover:border-primary-500 bg-neutral-50 dark:bg-neutral-800/50',
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
              <div v-else :class="['flex flex-col items-center justify-center p-2 text-center text-neutral-400 dark:text-neutral-500']">
                <div :class="['i-solar:cloud-upload-bold-duotone h-8 w-8 mb-1 text-primary-500/70']" />
                <span :class="['text-[11px] font-semibold text-neutral-600 dark:text-neutral-300']">Upload Photo</span>
                <span :class="['text-[9px] text-neutral-400']">PNG, JPG, WebP</span>
              </div>

              <!-- Hover Overlay to Change -->
              <div
                v-if="customAvatar"
                :class="['absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-semibold gap-1 backdrop-blur-2xs']"
              >
                <div :class="['i-solar:restart-bold-duotone h-5 w-5']" />
                <span>Change</span>
              </div>

              <input
                ref="avatarFileInput"
                type="file"
                accept="image/png, image/jpeg, image/webp, image/gif"
                class="hidden"
                @change="handleAvatarFileSelected"
              >
            </div>

            <!-- Identity Metadata (Name, Series, Tags) -->
            <div :class="['flex-1 w-full flex flex-col gap-2.5']">
              <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-2.5']">
                <div>
                  <label :class="['text-[11px] font-bold text-neutral-700 dark:text-neutral-300 block mb-1']">
                    Character Name <span class="text-primary-500">*</span>
                  </label>
                  <input
                    v-model="customName"
                    type="text"
                    placeholder="e.g. Mochi-chan"
                    :class="['w-full px-3 py-1.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-hidden focus:border-primary-500']"
                    @input="onCustomNameInput"
                  >
                </div>

                <div>
                  <label :class="['text-[11px] font-bold text-neutral-700 dark:text-neutral-300 block mb-1']">
                    Franchise / Series
                  </label>
                  <input
                    v-model="customSeries"
                    type="text"
                    placeholder="e.g. Original / Hololive / Fate"
                    :class="['w-full px-3 py-1.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-hidden focus:border-primary-500']"
                    @input="syncCreatorDraft"
                  >
                </div>
              </div>

              <!-- Tags / Traits + Auto-Tagger -->
              <div>
                <div :class="['flex items-center justify-between mb-1']">
                  <label :class="['text-[11px] font-bold text-neutral-700 dark:text-neutral-300']">
                    Visual Traits & Tags
                  </label>
                  <button
                    type="button"
                    :disabled="isTaggingImage || !customAvatar"
                    :class="[
                      'flex items-center gap-1 text-[10px] font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                    ]"
                    @click="runBlipAutoTag"
                  >
                    <div :class="['i-solar:magic-stick-3-bold-duotone h-3 w-3', isTaggingImage ? 'animate-spin' : '']" />
                    <span>{{ isTaggingImage ? 'Tagging Image…' : 'Auto-Tag Image (BLIP)' }}</span>
                  </button>
                </div>

                <!-- Tag Chips Flow -->
                <div :class="['flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-neutral-100/50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-800 min-h-[36px]']">
                  <span
                    v-for="tag in customTags"
                    :key="tag"
                    :class="['px-2 py-0.5 rounded-md bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-[10px] font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-1 shadow-2xs']"
                  >
                    <span>{{ tag }}</span>
                    <button
                      type="button"
                      :class="['hover:text-red-500 cursor-pointer']"
                      @click="removeTag(tag)"
                    >
                      <div :class="['i-solar:close-circle-bold h-3 w-3']" />
                    </button>
                  </span>

                  <input
                    v-model="newTagInput"
                    type="text"
                    placeholder="+ Add tag..."
                    :class="['bg-transparent text-[11px] text-neutral-800 dark:text-neutral-200 outline-hidden min-w-[80px] flex-1 px-1']"
                    @keydown.enter.prevent="addTag"
                    @keydown.comma.prevent="addTag"
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Mode B: Catalog Carousel -->
          <div v-else :class="['flex flex-col gap-2.5 pt-1']">
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
              <span :class="['text-[11px] text-neutral-400 flex-shrink-0']">
                Pick any character to populate metadata
              </span>
            </div>

            <!-- 1-row by 4-column compact grid -->
            <div :class="['grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[160px] overflow-y-auto pr-1']">
              <button
                v-for="char in catalogList"
                :key="char.id"
                type="button"
                :class="[
                  'p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/50 dark:bg-neutral-800/50 hover:border-primary-500 flex items-center gap-2 text-left cursor-pointer transition-all hover:scale-[1.02] shadow-2xs',
                ]"
                @click="selectCatalogCharacter(char)"
              >
                <img
                  v-if="wizardStore.getCharacterThumbUrl(char.trigger)"
                  :src="wizardStore.getCharacterThumbUrl(char.trigger)!"
                  alt=""
                  class="h-10 w-10 flex-shrink-0 rounded-lg bg-neutral-200 object-cover dark:bg-neutral-700"
                >
                <div v-else class="h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-sm dark:bg-neutral-700">
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

        <!-- Section 2: Outline Your Story Settings -->
        <div :class="['p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/80 backdrop-blur-md flex flex-col gap-3']">
          <div :class="['flex items-center justify-between flex-wrap gap-2']">
            <div :class="['flex items-center gap-2']">
              <div :class="['h-6 w-6 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center text-xs font-bold']">
                2
              </div>
              <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-100 uppercase tracking-wider']">
                Outline Your Story Settings
              </span>
            </div>

            <!-- LLM Consciousness Brain Status -->
            <div :class="['flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300']">
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span>Brain: {{ activeBrainModelName }}</span>
            </div>
          </div>

          <!-- Trope Pills Flow -->
          <div>
            <label :class="['text-[11px] font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5']">
              Story Premise & Trope
            </label>
            <div :class="['flex flex-wrap gap-1.5']">
              <button
                v-for="trope in tropeTemplates"
                :key="trope.id"
                type="button"
                :class="[
                  'px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5',
                  selectedTropeId === trope.id
                    ? 'bg-purple-600 text-white shadow-xs shadow-purple-600/25'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700',
                ]"
                @click="selectTrope(trope)"
              >
                <span>{{ trope.icon }}</span>
                <span>{{ trope.label }}</span>
              </button>
            </div>
          </div>

          <!-- Custom Scenario Guidance Prompt -->
          <div>
            <label :class="['text-[11px] font-bold text-neutral-700 dark:text-neutral-300 block mb-1']">
              Scenario Guidance & Custom Twists (Optional)
            </label>
            <textarea
              v-model="guidancePrompt"
              rows="2"
              placeholder="e.g. A sentient strawberry mochi with an attitude problem living on a programmer's desk..."
              :class="['w-full p-2.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white resize-none focus:outline-hidden focus:border-purple-500']"
              @input="syncCreatorDraft"
            />
          </div>

          <!-- Generate Action CTA -->
          <div :class="['flex items-center justify-end']">
            <Button
              variant="primary"
              size="md"
              :disabled="isGeneratingStory"
              :class="[
                'flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-purple-600/25 transition-all cursor-pointer',
              ]"
              @click="generateStoryIdeas"
            >
              <div :class="['i-solar:magic-stick-3-bold-duotone h-4 w-4', isGeneratingStory ? 'animate-spin' : '']" />
              <span>{{ isGeneratingStory ? 'Dreaming Up Story Ideas…' : '🪄 Generate Story Ideas' }}</span>
            </Button>
          </div>
        </div>

        <!-- Section 3: Unified Proposal Editor -->
        <div :class="['p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/80 backdrop-blur-md flex flex-col gap-3']">
          <div :class="['flex items-center justify-between flex-wrap gap-2']">
            <div :class="['flex items-center gap-2']">
              <div :class="['h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs font-bold']">
                3
              </div>
              <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-100 uppercase tracking-wider']">
                Story Proposal & Live Persona Card
              </span>
            </div>

            <span :class="['px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1']">
              <div :class="['i-solar:check-circle-bold-duotone h-3.5 w-3.5']" />
              <span>In-Place Editable & Auto-Saved</span>
            </span>
          </div>

          <!-- 3 Proposal Tabs -->
          <div :class="['flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-white/5 text-xs font-semibold']">
            <button
              v-for="p in proposals"
              :key="p.id"
              type="button"
              :class="[
                'flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer truncate text-left flex items-center gap-1.5',
                activeProposalId === p.id
                  ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white font-bold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
              ]"
              @click="selectProposal(p.id)"
            >
              <span :class="['h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0', activeProposalId === p.id ? 'bg-primary-500 text-white' : 'bg-neutral-200 dark:bg-neutral-600 text-neutral-600 dark:text-neutral-300']">
                {{ p.id }}
              </span>
              <span class="truncate">{{ p.title }}</span>
            </button>
          </div>

          <!-- In-Place Editable Active Proposal Fields -->
          <div v-if="activeProposal" :class="['flex flex-col gap-3 pt-1']">
            <div>
              <div :class="['flex items-center justify-between mb-1']">
                <label :class="['text-[11px] font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5']">
                  <div :class="['i-solar:chat-round-dots-bold-duotone h-3.5 w-3.5 text-primary-500']" />
                  <span>Opening Greeting (Turn 0 Speech)</span>
                </label>
                <span :class="['text-[10px] text-neutral-400 italic']">Spoken immediately upon stage launch</span>
              </div>
              <textarea
                v-model="activeProposal.greeting"
                rows="2"
                placeholder="First words spoken by the companion..."
                :class="['w-full p-2.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white resize-none focus:outline-hidden focus:border-primary-500']"
                @input="syncCreatorDraft"
              />
            </div>

            <div>
              <div :class="['flex items-center justify-between mb-1']">
                <label :class="['text-[11px] font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5']">
                  <div :class="['i-solar:book-bookmark-bold-duotone h-3.5 w-3.5 text-purple-500']" />
                  <span>Scenario Lore & World Setting</span>
                </label>
                <span :class="['text-[10px] text-neutral-400 italic']">Living environment and dynamic</span>
              </div>
              <textarea
                v-model="activeProposal.scenario"
                rows="3"
                placeholder="Rules of the world and companion dynamic..."
                :class="['w-full p-2.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white resize-none focus:outline-hidden focus:border-purple-500']"
                @input="syncCreatorDraft"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation & Synergy Preview -->
    <div
      :class="[
        'h-14 border-t border-neutral-200/80 dark:border-neutral-800/80',
        'flex items-center justify-between flex-shrink-0 pt-2',
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
        <span>Back to Consciousness</span>
      </button>

      <!-- Synergy Preview Pill -->
      <div :class="['text-[11px] text-neutral-400 font-medium truncate max-w-sm hidden sm:block text-center']">
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

    <!-- Backdrop Overlay for Webview Drawer -->
    <div
      v-if="isElectron && activeBrowserSource"
      class="backdrop-blur-xs fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
      @click="closeWebview"
    />

    <!-- Electron In-App Webview Side Drawer with automatic card download interceptor -->
    <div
      v-if="isElectron"
      :class="[
        'fixed inset-y-0 right-0 z-50 w-[70vw] border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-500 ease-in-out dark:border-neutral-800 dark:bg-neutral-900',
        activeBrowserSource ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none',
      ]"
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
