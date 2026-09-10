import type { ChatHistoryItem } from '../../../../../../types/chat'
import type { OnboardingV3DraftState } from '../stores/useOnboardingV3Draft'

import { nanoid } from 'nanoid'

import {
  DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT,
  DEFAULT_ARTISTRY_WIDGET_INSTRUCTION,
  DEFAULT_HEARTBEATS_PROMPT,
  DEFAULT_POST_HISTORY_INSTRUCTIONS,
  DEFAULT_SMART_SILENCE_DIRECTIVE,
  DEFAULT_TEXT_JOURNAL_WIDGET_INSTRUCTION,
  DEFAULT_THINK_ALOUD_PROMPT,
  getStarterCharacter,
  STARTER_CHARACTERS,
} from '../../../../../../constants/prompts/character-defaults'
import { useChatSessionStore } from '../../../../../../stores/chat/session-store'
import { useDisplayModelsStore } from '../../../../../../stores/display-models'
import { useAiriCardStore } from '../../../../../../stores/modules/airi-card'
import { useSpeechStore } from '../../../../../../stores/modules/speech'
import { useOnboardingStore } from '../../../../../../stores/onboarding'
import { useSettingsUserProfile } from '../../../../../../stores/settings/user-profile'

export const USER_TOKEN_REGEX = /(?<!\{)\{user\}(?!\})/g

export interface ResolvedPersona {
  name: string
  nickname: string
  description: string
  personality: string
  scenario: string
  systemPrompt: string
  postHistoryInstructions: string
  greetings: string[]
  messageExample: [string, string][]
  firstGreeting: string
  importedCardRaw?: any
}

/**
 * Resolves character persona data from the onboarding draft state.
 * Handles imported cards, starter character presets, and installed cards,
 * replacing {user} and {{user}} tokens with the user's name.
 */
export function resolvePersona(draft: OnboardingV3DraftState, userName: string): ResolvedPersona {
  const imported = draft.importedCardDraft

  if (imported) {
    const rawData = (imported as any).data || imported
    const greetings = (rawData.greetings || (rawData.first_mes ? [rawData.first_mes, ...(rawData.alternate_greetings || [])] : [])) as string[]
    const firstGreeting = greetings[0]
      ? greetings[0].replace(USER_TOKEN_REGEX, userName).replace(/\{\{user\}\}/gi, userName)
      : `Hello ${userName}! Everything is calibrated and ready to go.`

    return {
      name: rawData.name || 'AI Companion',
      nickname: draft.companionName || rawData.nickname || rawData.name || 'AI Companion',
      description: rawData.description || 'Your private AI companion on stage.',
      personality: rawData.personality || 'Friendly, caring, and bright assistant.',
      scenario: rawData.scenario || '',
      systemPrompt: rawData.system_prompt || rawData.systemPrompt || '',
      postHistoryInstructions: rawData.post_history_instructions || rawData.postHistoryInstructions || DEFAULT_POST_HISTORY_INSTRUCTIONS,
      greetings,
      messageExample: (rawData.message_example || rawData.messageExample || []) as [string, string][],
      firstGreeting,
      importedCardRaw: imported,
    }
  }

  const personaCardId = draft.personaCardId || 'default'

  if (STARTER_CHARACTERS[personaCardId]) {
    const p = getStarterCharacter(personaCardId)
    const greetings = p.greetings.map(g => g.replace(USER_TOKEN_REGEX, userName))
    const firstGreeting = greetings[0] || `Hello ${userName}! Everything is calibrated and ready to go. Let's step onto the stage together!`

    return {
      name: p.name,
      nickname: draft.companionName || p.name,
      description: p.description,
      personality: p.personality,
      scenario: p.scenario.replace(USER_TOKEN_REGEX, userName),
      systemPrompt: p.systemPrompt.replace(USER_TOKEN_REGEX, userName),
      postHistoryInstructions: DEFAULT_POST_HISTORY_INSTRUCTIONS,
      greetings,
      messageExample: (p.messageExample || []).map(([uMsg, cMsg]) => [
        uMsg.replace(USER_TOKEN_REGEX, userName),
        cMsg.replace(USER_TOKEN_REGEX, userName),
      ]) as [string, string][],
      firstGreeting,
    }
  }

  const d = STARTER_CHARACTERS.default
  const greetings = d.greetings.map(g => g.replace(USER_TOKEN_REGEX, userName))
  const firstGreeting = greetings[0] || `Hello ${userName}! Everything is calibrated and ready to go. Let's step onto the stage together!`

  return {
    name: d.name,
    nickname: draft.companionName || d.name,
    description: d.description,
    personality: d.personality,
    scenario: d.scenario.replace(USER_TOKEN_REGEX, userName),
    systemPrompt: d.systemPrompt.replace(USER_TOKEN_REGEX, userName),
    postHistoryInstructions: DEFAULT_POST_HISTORY_INSTRUCTIONS,
    greetings,
    messageExample: (d.messageExample || []).map(([uMsg, cMsg]) => [
      uMsg.replace(USER_TOKEN_REGEX, userName),
      cMsg.replace(USER_TOKEN_REGEX, userName),
    ]) as [string, string][],
    firstGreeting,
  }
}

/**
 * Resolves all checkbox-driven prompt crafting directives onto the target card payload.
 *
 * Implements the Onboarding Checkbox-to-Prompt Directives Intent Matrix:
 * 1. Think Aloud Directive (<think_aloud>) -> acting.speechMannerismPrompt
 * 2. Max Tokens / Cadence -> generation.known.maxTokens + card.data.system_prompt
 * 3. Image Journal Directive -> artistry.widgetInstruction + generation.known.allowedTools
 * 4. Smart Silence Directive -> heartbeats.prompt + card.data.system_prompt
 * 5. Text Journal Directive -> textJournal.widgetInstruction + generation.known.allowedTools
 */
export function resolvePromptDirectives(draft: OnboardingV3DraftState, card: any): void {
  const isV3 = 'data' in card
  const data = isV3 ? card.data : card
  data.extensions = data.extensions || {}
  data.extensions.airi = data.extensions.airi || {}
  const airi = data.extensions.airi

  airi.generation = airi.generation || { enabled: true }
  airi.generation.known = airi.generation.known || {}
  const toolsSet = new Set<string>(airi.generation.known.allowedTools || [])

  // 1. Think Aloud Directive
  const isThinkAloudEnabled = Boolean(draft.subconsciousTier1 || (draft.subconsciousAsides && draft.pacingPreset !== 'disabled'))
  if (isThinkAloudEnabled) {
    airi.acting = airi.acting || {}
    const currentMannerism = (airi.acting.speechMannerismPrompt || '').trim()
    if (!currentMannerism.includes('think_aloud')) {
      airi.acting.speechMannerismPrompt = currentMannerism
        ? `${currentMannerism}\n\n${DEFAULT_THINK_ALOUD_PROMPT}`
        : DEFAULT_THINK_ALOUD_PROMPT
    }
  }

  // 2. Max Token / Cadence Directive
  // Note: If Deep CoT model is selected, overrideLimits is kept off by default to protect reasoning streams.
  if (draft.overrideLimits && draft.pacingPreset !== 'deep') {
    if (draft.maxTokens) {
      airi.generation.known.maxTokens = draft.maxTokens
    }
    if (draft.contextWidth) {
      airi.generation.known.contextWidth = draft.contextWidth
    }
    if (draft.customProse && draft.customProse.trim()) {
      const cadenceHeading = '## Conversational Cadence'
      if (!data.system_prompt.includes(cadenceHeading)) {
        data.system_prompt = `${data.system_prompt.trim()}\n\n${cadenceHeading}\n${draft.customProse.trim()}`
      }
    }
  }

  // 3. Image Journal Directive
  const isImageJournalEnabled = Boolean(draft.modules?.artistry && draft.artistryImageJournalToolEnabled)
  if (isImageJournalEnabled) {
    toolsSet.add('image_journal')
    airi.artistry = airi.artistry || {}
    airi.artistry.widgetInstruction = DEFAULT_ARTISTRY_WIDGET_INSTRUCTION
  }

  // 4. Context-Aware Smart Silence Directive (No-Yap Guarantee)
  const isSmartSilenceEnabled = draft.smartSilenceDirectiveEnabled !== false
  if (isSmartSilenceEnabled) {
    if (draft.modules?.sensory) {
      airi.heartbeats = airi.heartbeats || {}
      airi.heartbeats.prompt = airi.heartbeats.prompt || DEFAULT_HEARTBEATS_PROMPT
    }
    const silenceHeading = '## Interaction Directive: Smart Silence'
    if (!data.system_prompt.includes(silenceHeading) && !data.system_prompt.includes('NO_REPLY')) {
      data.system_prompt = `${data.system_prompt.trim()}\n\n${DEFAULT_SMART_SILENCE_DIRECTIVE}`
    }
  }

  // 5. Long-Term Text Journal Directive
  const isTextJournalEnabled = Boolean(draft.modules?.memory && draft.memoryLongTermJournalEnabled !== false)
  if (isTextJournalEnabled) {
    toolsSet.add('text_journal')
    airi.textJournal = airi.textJournal || {}
    airi.textJournal.widgetInstruction = DEFAULT_TEXT_JOURNAL_WIDGET_INSTRUCTION
  }

  // Extra standard tool permissions
  if (draft.modules?.tools) {
    if (draft.mcpWebSearchEnabled) {
      toolsSet.add('web_search')
      toolsSet.add('fetch_content')
    }
    if (draft.mcpFilesystemEnabled) {
      toolsSet.add('read_file')
      toolsSet.add('list_directory')
      toolsSet.add('directory_tree')
      toolsSet.add('search_files')
    }
    if (draft.toolMotionGeneratorEnabled) {
      toolsSet.add('generate_motion')
    }
  }

  airi.generation.known.allowedTools = Array.from(toolsSet)
}

/**
 * Compiles a character card payload from transient onboarding draft state.
 * Preserves upstream CCv3 character books and lorebooks if imported,
 * or builds a standard CCv3 specification.
 */
export function compileCardPayload(draft: OnboardingV3DraftState, resolvedPersona: ResolvedPersona): any {
  const activeModelId = draft.vesselDisplayModelId || 'preset-live2d-2'

  // If user imported a card, preserve its upstream assets and patch extensions.airi
  if (resolvedPersona.importedCardRaw) {
    const card = JSON.parse(JSON.stringify(resolvedPersona.importedCardRaw))
    const isV3 = 'data' in card
    const targetData = isV3 ? card.data : card

    targetData.extensions = targetData.extensions || {}
    targetData.extensions.airi = targetData.extensions.airi || {}
    const airi = targetData.extensions.airi
    airi.modules = airi.modules || {}

    airi.modules.displayModelId = activeModelId
    airi.modules.consciousness = {
      provider: draft.llmProvider || 'openai',
      model: draft.llmModel || 'gpt-4o',
    }
    airi.modules.speech = {
      provider: draft.modules?.speech ? (draft.ttsProvider || 'kokoro-local') : 'speech-noop',
      model: draft.modules?.speech ? (draft.ttsModel || 'q4') : '',
      voice_id: draft.modules?.speech ? (draft.ttsVoiceId || 'af_bella') : '',
      pitch: draft.ttsPitch ?? 1.0,
      rate: draft.ttsRate ?? 1.0,
    }

    resolvePromptDirectives(draft, card)
    return card
  }

  // Standard CCv3 Generation
  const greetings = resolvedPersona.greetings || []
  const firstGreeting = resolvedPersona.firstGreeting || greetings[0] || ''
  const alternateGreetings = greetings.slice(1)

  const cardPayload = {
    spec: 'chara_card_v3' as const,
    spec_version: '3.0' as const,
    data: {
      name: resolvedPersona.name,
      nickname: resolvedPersona.nickname,
      creator: 'AIRI',
      creator_notes: 'Created via Onboarding V3',
      character_version: '1.0.0',
      description: resolvedPersona.description,
      personality: resolvedPersona.personality,
      scenario: resolvedPersona.scenario,
      system_prompt: resolvedPersona.systemPrompt,
      post_history_instructions: resolvedPersona.postHistoryInstructions || DEFAULT_POST_HISTORY_INSTRUCTIONS,
      first_mes: firstGreeting,
      alternate_greetings: alternateGreetings,
      group_only_greetings: [],
      mes_example: (resolvedPersona.messageExample || [])
        .map(pair => pair.filter(Boolean).join('\n'))
        .filter(block => block.trim().length > 0)
        .join('\n<START>\n'),
      tags: ['onboarding-v3', draft.experienceArchetype],
      extensions: {
        airi: {
          agents: {},
          modules: {
            displayModelId: activeModelId,
            consciousness: {
              provider: draft.llmProvider || 'openai',
              model: draft.llmModel || 'gpt-4o',
            },
            speech: {
              provider: draft.modules?.speech ? (draft.ttsProvider || 'kokoro-local') : 'speech-noop',
              model: draft.modules?.speech ? (draft.ttsModel || 'q4') : '',
              voice_id: draft.modules?.speech ? (draft.ttsVoiceId || 'af_bella') : '',
              pitch: draft.ttsPitch ?? 1.0,
              rate: draft.ttsRate ?? 1.0,
            },
          },
          acting: {
            modelExpressionPrompt: draft.actingModelExpressionPrompt || DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT,
            speechExpressionPrompt: '',
            speechMannerismPrompt: '',
            pacing: {
              enabled: draft.pacingPreset !== 'disabled',
              pacingProfile: draft.pacingPreset === 'snappy' ? 'snappy' : draft.pacingPreset === 'deep' ? 'deep_cot' : 'balanced',
              dynamicAsidesEnabled: Boolean(draft.subconsciousTier2),
              semanticExtractorEnabled: Boolean(draft.subconsciousTier2),
            },
          },
          artistry: draft.modules?.artistry
            ? {
                provider: draft.artistryProvider || 'pollinations',
                model: draft.artistryModel || '',
                promptPrefix: draft.artistryVisualPrompt || '',
                autonomousEnabled: Boolean(draft.artistryDirectorEnabled),
                autonomousTarget: draft.artistryDirectorTarget || 'assistant',
              }
            : undefined,
          screenWatching: draft.modules?.sensory
            ? {
                enabled: Boolean(draft.screenWatcherEnabled),
                deliveryMode: draft.screenWatcherMode === 'voice-and-bubble' ? 'both' : draft.screenWatcherMode === 'bubble-only' ? 'bubble_only' : draft.screenWatcherMode === 'voice-only' ? 'tts_only' : 'off',
                sourceType: 'displays',
                sourceId: 'primary',
                captureIntervalMs: draft.screenWatcherInterval || 2000,
                downscalePercent: 50,
                workload: draft.screenWatcherTier === 'moondream' ? 'screen:interpret' : 'screen:ocr',
                publishToContext: true,
                interestTags: [],
                deferWhileSpeaking: true,
                maxPerHour: 12,
                hysteresisMinutes: 5,
                respectSchedule: Boolean(draft.operatingScheduleEnabled),
                pauseWhenAfk: Boolean(draft.pauseOnAfk),
                afkThresholdMinutes: draft.afkMinutes || 5,
              }
            : undefined,
          heartbeats: draft.modules?.sensory
            ? {
                enabled: Boolean(draft.heartbeatsEnabled),
                intervalMinutes: draft.heartbeatsInterval || 5,
                prompt: DEFAULT_HEARTBEATS_PROMPT,
                injectIntoPrompt: true,
                useAsLocalGate: true,
                contextOptions: {
                  windowHistory: Boolean(draft.heartbeatsContextWindowHistory),
                  systemLoad: Boolean(draft.heartbeatsContextSystemLoad),
                  usageMetrics: Boolean(draft.heartbeatsContextUsageMetrics),
                },
                schedule: {
                  start: draft.wakeUpTime || '09:00',
                  end: draft.bedTime || '22:00',
                },
                respectSchedule: Boolean(draft.operatingScheduleEnabled),
                pauseWhenAfk: Boolean(draft.pauseOnAfk),
                afkThresholdMinutes: draft.afkMinutes || 5,
                prefixCacheOptimized: true,
              }
            : undefined,
          shortTermMemory: draft.modules?.memory
            ? {
                enabled: Boolean(draft.memoryShortTermEnabled),
                windowSize: draft.memoryShortTermWindowSize || 3,
                tokenBudgetPerDay: draft.memoryShortTermTokenBudget || 1000,
              }
            : undefined,
          dreamState: draft.modules?.memory
            ? {
                enabled: Boolean(draft.memoryDreamStateEnabled),
                strictAfkGating: true,
              }
            : undefined,
          textJournal: draft.modules?.memory
            ? {
                injectJournalContext: Boolean(draft.memoryLongTermJournalEnabled),
              }
            : undefined,
          generation: {
            enabled: true,
            provider: draft.llmProvider || 'openai',
            model: draft.llmModel || 'gpt-4o',
            known: {
              allowedTools: [],
            },
          },
        },
      },
    },
  }

  resolvePromptDirectives(draft, cardPayload)
  return cardPayload
}

/**
 * Composable providing atomic companion synthesis, card addition, and stage activation.
 */
export function useStarterCardCommit() {
  const userProfileStore = useSettingsUserProfile()
  const cardStore = useAiriCardStore()
  const speechStore = useSpeechStore()
  const displayModelsStore = useDisplayModelsStore()
  const chatSessionStore = useChatSessionStore()
  const onboardingStore = useOnboardingStore()

  /**
   * Commits the complete companion setup to production stores:
   * 1. Persists user profile preferences
   * 2. Saves companion voice profile in speechStore
   * 3. Updates model emotion mappings if curated
   * 4. Adds synthesized card to cardStore
   * 5. Activates newly created card on stage
   * 6. Seeds Turn 0 system message and assistant greeting in chatSessionStore
   * 7. Marks onboarding as completed and resets draft
   */
  async function commitStarterCompanion(draft: OnboardingV3DraftState): Promise<string | null> {
    const userName = draft.userName || userProfileStore.name || 'User'
    const persona = resolvePersona(draft, userName)

    // 1. Persist User Profile
    try {
      if (draft.userName)
        userProfileStore.name = draft.userName
      if (draft.userDescription)
        userProfileStore.description = draft.userDescription
      if (draft.userPrompt)
        userProfileStore.prompt = draft.userPrompt
    }
    catch (err) {
      console.warn('[useStarterCardCommit] User profile persistence warning:', err)
    }

    // 2. Persist Voice Profile
    let charProfileId = draft.ttsVoiceId || 'af_bella'
    if (draft.modules?.speech) {
      try {
        const charName = persona.name || 'Companion'
        const charBaseProvider = draft.ttsProvider || 'kokoro-local'
        const charBaseModel = draft.ttsModel || 'q4'
        const charRawVoice = draft.ttsVoiceId || 'af_bella'
        charProfileId = `voice_profile_${charName.toLowerCase().replace(/\s+/g, '_')}`

        const charVoiceProfile = {
          id: charProfileId,
          name: `${charName}'s Voice`,
          baseProvider: charBaseProvider,
          baseModel: charBaseModel,
          baseVoice: charRawVoice,
          effects: {
            pitch: draft.ttsPitch ?? 1.0,
            rate: draft.ttsRate ?? 1.0,
            volume: 1.0,
            asmr: 0,
            radio: 0,
            robot: 0,
            reverb: 0,
            spatial: 0,
          },
          ust: {
            enabled: true,
            mode: 'mute' as const,
            customStripChars: '*_[]()<>"\'',
            stripEmojis: true,
            tildeReplacement: '',
            autoLowercaseCapsThreshold: 2,
            autoLowercaseCapsExclude: [],
            convertBracketsToTokenFormat: true,
            customReplacements: [],
          },
        }

        speechStore.saveVoiceProfile(charVoiceProfile as any)
        speechStore.activeSpeechProvider = charBaseProvider
        speechStore.activeSpeechModel = charBaseModel
        speechStore.activeSpeechVoiceId = charProfileId
      }
      catch (err) {
        console.warn('[useStarterCardCommit] Voice profile persistence warning:', err)
      }
    }

    // 3. Update Display Model Emotion Mappings
    const activeModelId = draft.vesselDisplayModelId || 'preset-live2d-2'
    if (draft.expressionMappings && Object.keys(draft.expressionMappings).length > 0 && activeModelId) {
      try {
        await displayModelsStore.updateDisplayModelMappings(activeModelId, {
          emotionMappings: draft.expressionMappings,
        })
      }
      catch (err) {
        console.warn('[useStarterCardCommit] Display model mappings update warning:', err)
      }
    }

    // 4. Compile & Persist AiriCard
    const payload = compileCardPayload(draft, persona)
    if (draft.modules?.speech && payload.data?.extensions?.airi?.modules?.speech) {
      payload.data.extensions.airi.modules.speech.voice_id = charProfileId
    }

    const createdCardId = await cardStore.addCard(payload)
    if (!createdCardId) {
      throw new Error('Card store returned null after addCard')
    }

    // 5. Activate Card on Stage
    try {
      await cardStore.activateCard(createdCardId, true)
    }
    catch (err) {
      console.warn('[useStarterCardCommit] Card stage activation warning:', err)
    }

    // 6. Commit Turn 0 to chat session store
    try {
      const sysMessage: ChatHistoryItem = {
        id: nanoid(),
        role: 'system',
        content: persona.systemPrompt || '',
        createdAt: Date.now(),
      }
      const greetingItem: ChatHistoryItem = {
        id: nanoid(),
        role: 'assistant',
        content: persona.firstGreeting,
        slices: [{ type: 'text', text: persona.firstGreeting }],
        tool_results: [],
        createdAt: Date.now(),
      }
      await chatSessionStore.createSession(createdCardId, {
        setActive: true,
        messages: [sysMessage, greetingItem],
        title: 'Initial Conversation',
      })
    }
    catch (err) {
      console.warn('[useStarterCardCommit] Failed to commit Turn 0 greeting:', err)
    }

    // 7. Mark onboarding completed
    try {
      onboardingStore.markSetupCompleted()
    }
    catch (err) {
      console.warn('[useStarterCardCommit] Failed to mark setup completed:', err)
    }

    return createdCardId
  }

  return {
    resolvePersona,
    compileCardPayload,
    commitStarterCompanion,
  }
}
