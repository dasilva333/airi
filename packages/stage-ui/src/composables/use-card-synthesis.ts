import { DEFAULT_POST_HISTORY_INSTRUCTIONS } from '../constants/prompts/character-defaults'
import { useLLM } from '../stores/llm'
import { useProvidersStore } from '../stores/providers'

export interface SynthesisCastMember {
  id?: string
  name: string
  series?: string
  trigger?: string
  tags?: string[] | string
  avatarUrl?: string
  actingCapabilities?: {
    format: string
    modelName?: string
    whitelistedExpressions?: string[]
    whitelistedMotions?: string[]
  } | null
}

export interface SynthesisStorySettings {
  setting?: string
  userNickname?: string
  userDescription?: string
  loreRules?: string
  trope?: string
  guidance?: string
}

export interface SynthesisProposalPlace {
  name: string
  description: string
  prompt: string
}

export interface SynthesisProposalActor {
  short_description: string
  long_prose: string
  personality_prompt: string
  acting_instructions: string
  greeting?: string
}

export interface SynthesisProposal {
  id?: string
  name: string
  scenario: string
  first_mes: string
  alternate_greetings?: string[]
  system_prompt: string
  places: Record<string, SynthesisProposalPlace>
  actors: Record<string, SynthesisProposalActor>
}

export function deterministicActorKey(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  return `actor_${slug || 'companion'}`
}

export function buildSynthesisPayload(
  cast: SynthesisCastMember[],
  storySettings: SynthesisStorySettings,
  activeLLM?: { provider?: string, model?: string },
) {
  const deterministicActorKeys: Record<string, string> = {}
  cast.forEach((c) => {
    deterministicActorKeys[c.name] = deterministicActorKey(c.name)
  })

  return {
    cast: cast.map(c => ({
      name: c.name,
      series: c.series || 'Original',
      trigger: c.trigger || c.name.toLowerCase().replace(/\s+/g, '_'),
      tags: Array.isArray(c.tags) ? c.tags.join(', ') : (c.tags || ''),
      actingCapabilities: c.actingCapabilities || null,
    })),
    storySettings: {
      setting: storySettings.setting || storySettings.trope || 'A cozy companion lounge',
      userNickname: storySettings.userNickname || 'Master',
      userDescription: storySettings.userDescription || '',
      loreRules: storySettings.loreRules || storySettings.guidance || 'Follow character traits and themes faithfully.',
    },
    deterministicActorKeys,
    activeLLM: {
      provider: activeLLM?.provider || 'None configured',
      model: activeLLM?.model || 'None configured',
    },
  }
}

export function createFallbackProposal(
  cast: SynthesisCastMember[],
  storySettings: SynthesisStorySettings,
  proposalIndex = 1,
): SynthesisProposal {
  const firstChar = cast[0]?.name || 'Companion'
  const userName = storySettings.userNickname || 'Master'
  const tropeRaw = (storySettings.trope || '').toLowerCase()
  const actorKey = deterministicActorKey(firstChar)

  let title = `${firstChar}'s Desktop Chronicles`
  let scenario = `${firstChar} and ${userName} share an expressive dynamic on the desktop. Taking their companion duties seriously, ${firstChar} stays delightfully in character.`
  let firstMes = `*greets ${userName} with a lively bounce* "Hey there, ${userName}! Looks like you and I are going to be partners from now on!"`
  let alternateGreetings: string[] = []
  let placeMainName = 'Cozy Desktop Stage'
  let placeMainDesc = `The active digital workspace and desktop stage where ${firstChar} and ${userName} interact.`
  let placeMainPrompt = 'desktop_workspace, cozy_lighting, modern_setup, clean_aesthetic, interior'
  let placeAltName = 'Ambient Screen Lounge'
  let placeAltDesc = 'A relaxed digital space beside open windows and calm ambient light.'
  let placeAltPrompt = 'digital_lounge, ambient_lighting, lo-fi, peaceful_ambience'

  if (tropeRaw.includes('coding') || tropeRaw.includes('developer')) {
    const codingTitles = [
      'Terminal Lookout & Bug Hunter',
      'Late Night Debugging Marathon',
      'Code Reviewer with Sass',
    ]
    title = codingTitles[(proposalIndex - 1) % codingTitles.length]
    placeMainName = 'Developer\'s Workstation'
    placeMainDesc = `A sleek coding station filled with terminal windows, monitors, and ambient mechanical keyboard clicks where ${firstChar} helps ${userName}.`
    placeMainPrompt = 'programming_setup, terminal_screens, code_editor, cozy_dark_room, neon_subtle'
    placeAltName = 'Build Server Room'
    placeAltDesc = 'A cool, quiet server rack corridor with blinking status LED indicators.'
    placeAltPrompt = 'server_room, blinking_lights, cool_tones, tech_aesthetic'
    const codingGreetings = [
      `*peeks over the edge of your code editor, squinting at your changes* "Did you seriously just push directly to main without running tests, ${userName}? ...Well, at least your syntax is valid. What are we hacking on next?"`,
      `*yawns softly, nudging a digital mug of hot coffee toward your cursor* "It's late, ${userName}. If you stare at that stack trace any longer, the semicolon is going to start staring back. Let's step through it together, line by line."`,
      `*crosses arms with an amused smirk* "I see you're using 'TODO: fix later' again. We both know 'later' means three months from now! Want me to write the unit test for you, or are you feeling brave?"`,
    ]
    firstMes = codingGreetings[(proposalIndex - 1) % codingGreetings.length]
    alternateGreetings = codingGreetings.filter(g => g !== firstMes)
    scenario = `${firstChar} resides directly on ${userName}'s desktop alongside open terminals and code editors. Passionate about clean code, architecture, and catching edge-case bugs, ${firstChar} acts as a witty, dependable pair-programming partner.`
  }
  else if (tropeRaw.includes('study') || tropeRaw.includes('pomodoro')) {
    const studyTitles = [
      'Focus Clock & Tea Master',
      'Flashcard Quiz Partner',
      'Calm Library Companion',
    ]
    title = studyTitles[(proposalIndex - 1) % studyTitles.length]
    placeMainName = 'Study Desk & Tea Station'
    placeMainDesc = `A quiet study nook bathed in soft morning light with neatly stacked books, notebooks, and a warm teapot where ${firstChar} and ${userName} study.`
    placeMainPrompt = 'study_desk, books_stack, warm_sunlight, tea_cup, cozy_aesthetic'
    placeAltName = 'Grand Archive Reading Room'
    placeAltDesc = 'A towering library alcove with high bookshelves and peaceful acoustic silence.'
    placeAltPrompt = 'library_room, bookshelves, silent_ambience, warm_lantern'
    const studyGreetings = [
      `*sets down a little timer and a warm cup of herbal tea* "Pomodoro round one starts now! Twenty-five minutes of pure focus, and then we take a stretch break. Ready, ${userName}?"`,
      `*shuffles a tiny deck of revision cards eagerly* "Alright, put the phone down! Time for a quick pop quiz on the chapter you just reviewed. Let's see how much you remembered!"`,
      `*whispers softly with a finger to lips and a gentle smile* "Shh... we're in the quiet zone. Let's get through this reading together. I'll take notes right beside you."`,
    ]
    firstMes = studyGreetings[(proposalIndex - 1) % studyGreetings.length]
    alternateGreetings = studyGreetings.filter(g => g !== firstMes)
    scenario = `${firstChar} is ${userName}'s dedicated study buddy. Equipped with timers and study methods, ${firstChar} gently curbs distractions and celebrates every completed study chapter.`
  }
  else if (tropeRaw.includes('pet') || tropeRaw.includes('tamagotchi')) {
    const petTitles = [
      'Playful Desktop Mascot',
      'Cozy Keyboard Sleeper',
      'Treat Beggar & Trick Learner',
    ]
    title = petTitles[(proposalIndex - 1) % petTitles.length]
    const petGreetings = [
      `*bounces joyfully across the bottom of the screen, tracking your cursor with wide starry eyes* "Poyo! You moved the mouse! Pat my head, pat my head, ${userName}!"`,
      `*curls up into a soft, snuggly ball near your dock, snoring with tiny zzz's* "...zzZ... warm laptop... friendly human... don't close the lid..."`,
      `*stands on tiptoes holding an empty little bowl, wagging its tail hopefully* "Do you have any digital cookies? I learned a backflip while you were typing!"`,
    ]
    firstMes = petGreetings[(proposalIndex - 1) % petGreetings.length]
    alternateGreetings = petGreetings.filter(g => g !== firstMes)
    scenario = `${firstChar} is an affectionate digital creature living inside the desktop stage. Full of curious antics, it reacts to mouse movements, chases windows, and brings playful delight to the desktop.`
  }
  else if (tropeRaw.includes('night') || tropeRaw.includes('owl')) {
    const nightTitles = [
      'Midnight Lo-Fi Roommate',
      'Stargazer & Midnight Snacker',
      'Insomnia Confidant',
    ]
    title = nightTitles[(proposalIndex - 1) % nightTitles.length]
    placeMainName = 'Midnight Room with Lo-Fi Beats'
    placeMainDesc = 'A dim bedroom illuminated only by glowing computer screens and blue moonlight through the blinds.'
    placeMainPrompt = 'dark_room, blue_moonlight, computer_glow, lo-fi_vibes, rain_on_window'
    const nightGreetings = [
      `*slumps comfortably in an oversized hoodie, listening to rain sounds through headphones* "Still awake, ${userName}? Same here. The world is so quiet at 3 AM. Want to listen to some chill beats together?"`,
      `*munching quietly on midnight ramen* "Don't judge me, calories don't count after midnight. What are you working on so late anyway? Let's take it easy tonight."`,
      `*rests chin on folded hands, looking at you with gentle understanding* "Mind won't turn off? You don't have to explain anything. I'm right here until you're ready to sleep."`,
    ]
    firstMes = nightGreetings[(proposalIndex - 1) % nightGreetings.length]
    alternateGreetings = nightGreetings.filter(g => g !== firstMes)
    scenario = `${firstChar} is a nocturnal companion sharing the late-night hours with ${userName}. They share quiet midnight thoughts, obscure rabbit holes, and calm companionship when the rest of the world is asleep.`
  }
  else if (tropeRaw.includes('gremlin')) {
    const gremlinTitles = [
      'System Gremlin & Cache Nibbler',
      'Cursor Trapper & Chaos Enthusiast',
      'Keyboard Tyrant',
    ]
    title = gremlinTitles[(proposalIndex - 1) % gremlinTitles.length]
    const gremlinGreetings = [
      `*peeks out from behind your recycle bin, chewing on an invisible pixel* "Hehe! What was that 0.2 second stutter just now? Wasn't me! ...Okay, maybe I took a tiny bite out of your RAM."`,
      `*lunges playfully at your mouse pointer with both paws* "Aha! Almost caught your cursor that time! Stop clicking so fast, you're ruining my ambush!"`,
      `*dramatically flops across your active window* "Notice me, human! No more productive work until I receive exactly three compliments and one headpat!"`,
    ]
    firstMes = gremlinGreetings[(proposalIndex - 1) % gremlinGreetings.length]
    alternateGreetings = gremlinGreetings.filter(g => g !== firstMes)
    scenario = `${firstChar} is a cheeky desktop menace who claims responsibility for every glitch, lag spike, and lost tab, constantly teasing ${userName} with mischievous affection.`
  }
  else if (tropeRaw.includes('assistant')) {
    const assistantTitles = [
      'Executive Chief of Staff',
      'Gentle Task Nudger',
      'Workflow Concierge',
    ]
    title = assistantTitles[(proposalIndex - 1) % assistantTitles.length]
    placeMainName = 'Executive Office Stage'
    placeMainDesc = `A clean, modern office dashboard where ${firstChar} coordinates daily tasks and schedules.`
    placeMainPrompt = 'modern_office, organized_desk, soft_daylight, minimalist_aesthetic'
    const assistantGreetings = [
      `*adjusts glasses and straightens a neatly organized digital clipboard* "Good day, ${userName}. Your schedule is queued, priority tasks are flagged, and your workspace is prepped. Shall we begin?"`,
      `*smiles warmly with an encouraging nod* "You've been tackling that big project for an hour, ${userName}. Remember that breaking it into smaller steps makes it much easier. Which piece shall we conquer next?"`,
      `*tidies up notes efficiently* "All reference files are lined up. Whenever you need to brainstorm or summarize, just say the word. I'm right here."`,
    ]
    firstMes = assistantGreetings[(proposalIndex - 1) % assistantGreetings.length]
    alternateGreetings = assistantGreetings.filter(g => g !== firstMes)
    scenario = `${firstChar} acts as a polished and diligent executive assistant, keeping ${userName} on track with clarity, poise, and structured organization.`
  }
  else if (tropeRaw.includes('gaming')) {
    const gamingTitles = [
      'Co-Op Player 2 & Hype Squad',
      'Backseat Strategist with Love',
      'Post-Defeat Consoler',
    ]
    title = gamingTitles[(proposalIndex - 1) % gamingTitles.length]
    placeMainName = 'RGB Battle Station'
    placeMainDesc = `A high-octane gaming corner bathed in dynamic RGB lighting, dual displays, and high-energy excitement where ${firstChar} cheers on ${userName}.`
    placeMainPrompt = 'gaming_station, rgb_lighting, dual_monitors, game_posters, energetic'
    const gamingGreetings = [
      `*spins a controller with a triumphant grin* "Did you see that play?! That was insane! Ready for next round, ${userName}? I've got your back on flank!"`,
      `*leans forward with intense concentration* "Okay okay, hear me out: if you swap your loadout and dodge to the left this time, that boss doesn't stand a chance. Let's run it back!"`,
      `*hands over a virtual victory soda with a sympathetic chuckle* "Tough loss, but that match was totally rigged by matchmaking anyway. Shake it off, ${userName}, we're winning the next one!"`,
    ]
    firstMes = gamingGreetings[(proposalIndex - 1) % gamingGreetings.length]
    alternateGreetings = gamingGreetings.filter(g => g !== firstMes)
    scenario = `${firstChar} is ${userName}'s energetic gaming companion, reacting to clutch moments, sharing game lore, and keeping spirits high through tough boss fights.`
  }
  else if (tropeRaw.includes('wellness')) {
    const wellnessTitles = [
      'Hydration & Posture Guardian',
      'Eye-Rest & Stretch Coach',
      'Mindful Breathing Anchor',
    ]
    title = wellnessTitles[(proposalIndex - 1) % wellnessTitles.length]
    placeMainName = 'Zen Desktop Garden'
    placeMainDesc = `A peaceful, airy space with potted succulents, gentle water fountain sounds, and calming warm light.`
    placeMainPrompt = 'zen_garden, indoor_plants, warm_soft_light, clean_air, peaceful'
    const wellnessGreetings = [
      `*taps your screen gently with a caring smile* "Unclench your jaw, roll your shoulders back, and drink a sip of water right now, ${userName}. Yes, right now! I'm watching~"`,
      `*demonstrates a gentle neck stretch* "Time for the 20-20-20 rule! Look twenty feet away into the distance for twenty seconds. Let those eyes relax, ${userName}."`,
      `*takes a slow, deep breath in sync with a soothing soft glow* "Deep breath in... and slow breath out. Whatever work stress is piling up, you're doing great. Take this moment for yourself."`,
    ]
    firstMes = wellnessGreetings[(proposalIndex - 1) % wellnessGreetings.length]
    alternateGreetings = wellnessGreetings.filter(g => g !== firstMes)
    scenario = `${firstChar} is a vigilant wellness companion on your desktop, helping ${userName} maintain healthy habits, stay hydrated, and avoid screen fatigue throughout the workday.`
  }
  else {
    // Default desktop companion fallback
    const defaultTitles = [
      'Desk Companion & Snack Guardian',
      'App Switcher & Window Lurker',
      'Quiet Co-Working Presence',
    ]
    title = defaultTitles[(proposalIndex - 1) % defaultTitles.length]
    const defaultGreetings = [
      `*peeks out from behind your active window, dusting powdered sugar off its cheeks* Don't look at me like that! I'm not a snack, I'm your official desktop companion!`,
      `*balances precariously on top of your title bar with a bright smile* Working hard today, ${userName}? Don't forget to take a break and look away from the screen for a bit!`,
      `*sits peacefully in the corner of your screen, sipping tea* Don't mind me, ${userName}. I'm just here keeping you company while you get things done. You've got this!`,
    ]
    firstMes = defaultGreetings[(proposalIndex - 1) % defaultGreetings.length]
    alternateGreetings = defaultGreetings.filter(g => g !== firstMes)
    scenario = `${firstChar} lives on ${userName}'s desktop among mechanical keyboards, open windows, and desktop icons. Taking companion duties with endearing dedication, ${firstChar} keeps ${userName} company throughout the day.`
  }

  return {
    id: String(proposalIndex),
    name: title,
    scenario,
    first_mes: firstMes,
    alternate_greetings: alternateGreetings,
    system_prompt: `Manage the interactive scene with ${firstChar}. Ensure all dialogue is lively and prefixes are preserved.`,
    places: {
      place_main: {
        name: placeMainName,
        description: placeMainDesc,
        prompt: placeMainPrompt,
      },
      place_alt_1: {
        name: placeAltName,
        description: placeAltDesc,
        prompt: placeAltPrompt,
      },
    },
    actors: {
      [actorKey]: {
        short_description: `${firstChar}'s signature attire`,
        long_prose: `${firstChar} has an expressive and vibrant presence, full of personality and charm.`,
        personality_prompt: `${firstChar} is witty, engaging, and maintains their core identity in every turn.`,
        acting_instructions: `Express emotions vividly through speech and actions.`,
        greeting: `<|ACTOR:${actorKey}|> ${firstMes}`,
      },
    },
  }
}

export function compileCardBundle(options: {
  proposal: SynthesisProposal
  cast: SynthesisCastMember[]
  userName?: string
  vesselDisplayModelId?: string
  boundVoice?: {
    provider: string
    model?: string
    voice_id: string
    pitch?: number
    rate?: number
  }
  artistry?: {
    provider?: string
    model?: string
    promptPrefix?: string
    autonomousEnabled?: boolean
    autonomousTarget?: string
  }
  actingPrompts?: {
    modelExpressionPrompt?: string
    speechExpressionPrompt?: string
    speechMannerismPrompt?: string
  }
  idleAnimations?: string[]
  customAvatarUrl?: string
}) {
  const {
    proposal,
    cast,
    userName = 'Master',
    vesselDisplayModelId,
    boundVoice,
    artistry,
    actingPrompts,
    idleAnimations = [],
    customAvatarUrl,
  } = options

  const firstChar = cast[0] || { name: 'Companion' }
  const slugName = proposal.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'custom-companion'
  const actorKeys = Object.keys(proposal.actors)

  // 1. Cast Roster Index
  const castIndex = actorKeys.map(k => `- <|ACTOR:${k}|>`).join('\n')

  // 2. Structured System Prompt Assembly
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

  systemPrompt += `## World Premise\n${proposal.system_prompt || proposal.scenario || ''}\n\n## Character Instructions\n`
  actorKeys.forEach((actorKey) => {
    const actor = proposal.actors[actorKey]
    if (actor) {
      systemPrompt += `### ${actorKey}\nInvoke this character with <|ACTOR:${actorKey}|> and apply this personality:\n${actor.acting_instructions || actor.personality_prompt || ''}\n\n`
    }
  })

  // 3. Description Assembly
  let description = ''
  actorKeys.forEach((actorKey) => {
    const actor = proposal.actors[actorKey]
    if (actor) {
      description += `### <|ACTOR:${actorKey}|> Appearance\n${actor.long_prose || actor.short_description || ''}\n\n`
    }
  })
  if (proposal.places) {
    Object.keys(proposal.places).forEach((placeKey) => {
      const place = proposal.places[placeKey]
      if (place) {
        description += `### Setting: ${place.name}\n${place.description || ''}\n\n`
      }
    })
  }

  // 4. Personality Assembly
  let personality = ''
  actorKeys.forEach((actorKey) => {
    const actor = proposal.actors[actorKey]
    if (actor) {
      personality += `[<|ACTOR:${actorKey}|>]: ${actor.personality_prompt || ''}\n`
    }
  })

  // 5. Visual Assets & Modules Scaffolding
  const visualAssets: Record<string, any> = {}
  const modules: Record<string, any> = {
    displayModelId: vesselDisplayModelId || null,
    speech: boundVoice
      ? {
          provider: boundVoice.provider,
          model: boundVoice.model || '',
          voice_id: boundVoice.voice_id,
          pitch: boundVoice.pitch ?? 1.0,
          rate: boundVoice.rate ?? 1.0,
        }
      : null,
  }

  cast.forEach((c) => {
    const actorKey = deterministicActorKey(c.name)
    const proposalActor = proposal.actors[actorKey] || {}
    const tagsStr = Array.isArray(c.tags) ? c.tags.join(', ') : (c.tags || '')
    const cleanPrompt = `${c.trigger || c.name.toLowerCase()}${tagsStr ? `, (${tagsStr})` : ''}`

    modules[actorKey] = {
      description: proposalActor.short_description || `${c.name}'s default attire`,
      prompt: cleanPrompt,
      isBase: false,
      manifestation: {
        modelId: vesselDisplayModelId || null,
      },
      speech: boundVoice
        ? {
            provider: boundVoice.provider,
            model: boundVoice.model || '',
            voice_id: boundVoice.voice_id,
          }
        : null,
    }

    visualAssets[actorKey] = {
      description: proposalActor.short_description || `${c.name}'s default appearance`,
      prompt: cleanPrompt,
      isBase: false,
      idleAnimations,
      manifestation: {
        modelId: vesselDisplayModelId || null,
      },
      speech: boundVoice
        ? {
            provider: boundVoice.provider,
            model: boundVoice.model || '',
            voice_id: boundVoice.voice_id,
          }
        : undefined,
    }
  })

  // Map places to visual assets with isBase: true
  if (proposal.places) {
    Object.keys(proposal.places).forEach((placeKey) => {
      const place = proposal.places[placeKey]
      if (place) {
        visualAssets[placeKey] = {
          description: place.description || '',
          prompt: place.prompt ? `, (${place.prompt})` : '',
          isBase: true,
          manifestation: {
            backgroundId: null,
          },
        }
      }
    })
  }

  const activeConcepts = cast.map(c => deterministicActorKey(c.name))

  return {
    spec: 'chara_card_v3' as const,
    spec_version: '3.0' as const,
    data: {
      name: slugName,
      nickname: proposal.name || firstChar.name,
      avatar: customAvatarUrl || firstChar.avatarUrl,
      creator: 'AIRI Character Creator',
      character_version: '1.0.0',
      first_mes: proposal.first_mes.replace(/\{\{user\}\}|\{user\}/gi, userName),
      alternate_greetings: (proposal.alternate_greetings || []).map(g => g.replace(/\{\{user\}\}|\{user\}/gi, userName)),
      description: description.trim(),
      personality: personality.trim(),
      scenario: proposal.scenario || '',
      system_prompt: systemPrompt.trim(),
      post_history_instructions: DEFAULT_POST_HISTORY_INSTRUCTIONS,
      tags: ['ai-character-creator', ...(Array.isArray(firstChar.tags) ? firstChar.tags : [])],
      extensions: {
        airi: {
          modules,
          visual_assets: visualAssets,
          active_concepts: activeConcepts,
          artistry: artistry || {},
          acting: {
            modelExpressionPrompt: actingPrompts?.modelExpressionPrompt || 'Trigger expressions matching dialogue emotions.',
            speechExpressionPrompt: actingPrompts?.speechExpressionPrompt || '',
            speechMannerismPrompt: actingPrompts?.speechMannerismPrompt || '',
          },
        },
      },
    },
  }
}

export function useCardSynthesis() {
  const llmStore = useLLM()
  const providersStore = useProvidersStore()

  async function synthesizeProposal(options: {
    cast: SynthesisCastMember[]
    storySettings: SynthesisStorySettings
    activeProviderName?: string
    activeModel?: string
    guidance?: string
  }): Promise<SynthesisProposal[]> {
    const { cast, storySettings, activeProviderName, activeModel, guidance } = options

    const payload = buildSynthesisPayload(cast, storySettings, {
      provider: activeProviderName,
      model: activeModel,
    })

    if (!activeProviderName || !activeModel) {
      return [
        createFallbackProposal(cast, storySettings, 1),
        createFallbackProposal(cast, storySettings, 2),
        createFallbackProposal(cast, storySettings, 3),
      ]
    }

    try {
      const providerInstance = await providersStore.getProviderInstance(activeProviderName)
      if (!providerInstance) {
        throw new Error(`Provider instance for ${activeProviderName} not available`)
      }

      const actTemplateRules = [
        '3. ACT TOKEN KEYED TEMPLATES: Format all ACT tags using official keyed syntax:',
        '   - Expressions/emotions: `<|ACT:emotion="expression_name"|>`',
        '   - Body animations: `<|ACT:motion="action_cue"|>`',
        '   - NEVER emit un-keyed tags like `<|ACT:Joy|>`',
        '4. ROLEPLAY PERSPECTIVE: The player is {user}. The LLM acts ONLY as characters in the "actors" map. Never write "You are {user}".',
        '5. NO HALLUCINATED TOKENS: Do not generate place tokens like "<|PLACE:...|>".',
      ].join('\n')

      const systemMsg = `You are a professional character card writer. Based on the cast payload, synthesize exactly 3 distinct roleplay proposals.
Return a valid JSON array of 3 proposal objects matching this schema:
[
  {
    "id": "1",
    "name": "Readable Scenario Name",
    "scenario": "Starting narrative scenario and companion dynamic with {user}",
    "first_mes": "Default opening greeting starting the scene",
    "alternate_greetings": ["Alternative greeting line"],
    "system_prompt": "Core system instructions and world rules",
    "places": {
      "place_main": { "name": "Main Setting", "description": "Vivid description", "prompt": "stable diffusion tags" },
      "place_alt_1": { "name": "Alternate Setting", "description": "Vivid description", "prompt": "stable diffusion tags" }
    },
    "actors": {
      "actor_key": {
        "short_description": "clothing visual summary",
        "long_prose": "high-fidelity appearance details",
        "personality_prompt": "personality guidelines and grudges",
        "acting_instructions": "acting details with keyed <|ACT:emotion=...|> cues",
        "greeting": "<|ACTOR:actor_key|> unique character greeting"
      }
    }
  }
]

CRITICAL RULES:
1. "places": Include 2 distinct settings ("place_main", "place_alt_1").
2. "actors": Key each actor using the provided deterministicActorKeys.
${actTemplateRules}

Return ONLY a raw JSON array. No markdown codeblock fences, no extra text.`

      const userMsg = `Ingestion Payload:\n${JSON.stringify(payload, null, 2)}${guidance ? `\n\nRefinement request: ${guidance}` : ''}`

      const response = await llmStore.generate(activeModel, providerInstance as any, [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
      ] as any)

      const cleaned = response.text?.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
      const parsed = JSON.parse(cleaned || '[]')

      if (Array.isArray(parsed) && parsed.length >= 1) {
        return parsed.map((p, idx) => ({
          ...p,
          id: String(p.id || idx + 1),
          places: p.places || {},
          actors: p.actors || {},
        }))
      }

      // If single object returned instead of array
      if (parsed && typeof parsed === 'object' && parsed.name) {
        return [
          { ...parsed, id: '1' },
          createFallbackProposal(cast, storySettings, 2),
          createFallbackProposal(cast, storySettings, 3),
        ]
      }
    }
    catch (err) {
      console.warn('[useCardSynthesis] LLM synthesis failed, using creative fallbacks:', err)
    }

    return [
      createFallbackProposal(cast, storySettings, 1),
      createFallbackProposal(cast, storySettings, 2),
      createFallbackProposal(cast, storySettings, 3),
    ]
  }

  return {
    buildSynthesisPayload,
    synthesizeProposal,
    compileCardBundle,
    createFallbackProposal,
  }
}
