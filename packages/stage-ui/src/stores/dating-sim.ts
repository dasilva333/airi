import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useAiriCardStore } from './modules/airi-card'

export type GamePhase = 'idle' | 'conversation' | 'map' | 'action'
export type MoodState = 'low' | 'normal' | 'high' | 'max'

export interface Choice {
  id: string
  text: string
  icon?: string
  action: string
  condition?: string
  cost?: number // Time or tension cost
  positiveScoreChange?: number
  negativeScoreChange?: number
}

export const useDatingSimStore = defineStore('dating-sim', () => {
  const enabled = ref(false)
  const currentPhase = ref<GamePhase>('idle')

  // Amagami-inspired metrics
  const variables = ref<Record<string, number>>({
    Intimacy: 0,
    Tension: 50, // 0-100, affects how character reacts
    ActionPoints: 5, // For conversation topics
    TimeOfDay: 12, // 24h format
    Timer: 0, // Choice countdown
    positiveScore: 0,
    negativeScore: 0,
    turnsElapsed: 0,
  })

  const mood = computed<MoodState>(() => {
    const t = variables.value.Tension
    const i = variables.value.Intimacy
    if (i > 80 && t > 80)
      return 'max'
    if (t > 60)
      return 'high'
    if (t < 30)
      return 'low'
    return 'normal'
  })

  const settings = ref({
    intimacyGating: true,
    autoTicks: true,
    branchingChoices: true,
    lightningRounds: false,
    inlineCaption: true,
    contextDepth: useLocalStorage('airi:producer:context-depth', 6),
    gameMode: useLocalStorage<'open_ended' | 'goal_driven'>('airi:dating-sim:game-mode', 'goal_driven'),
    showChoiceWeights: useLocalStorage<boolean>('airi:dating-sim:show-choice-weights', false),
    maxScore: useLocalStorage<number>('airi:dating-sim:max-score', 15),
    maxTurns: useLocalStorage<number>('airi:dating-sim:max-turns-temp', 18),
    sceneryRoute: useLocalStorage<'background' | 'widget' | 'bg_widget' | 'inherit'>('airi:dating-sim:scenery-route', 'inherit'),
  })

  const choices = ref<Choice[]>([])
  const currentSubtitle = ref<string>('')
  const activeStoryline = ref<any | null>(null)
  const customPremise = ref<string>('')

  // --- Live2D DSL bridge (Phase 3) ---------------------------------------------
  // The Live2D model layer (`stage-ui-live2d`) runs the headless DSL VM and publishes
  // choice menus + intimacy deltas on `live2d-dsl-bridge`. This store subscribes, projects
  // them into the same `Choice[]` shape DatingSimOverlay already renders, and posts the
  // user's selection back so the VM can resume. DSL-driven choices carry a `dsl:`-prefixed
  // id so the overlay can distinguish them from LLM-generated ones without schema changes.
  const DSL_BRIDGE_CHANNEL = 'live2d-dsl-bridge'
  const dslBridge = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(DSL_BRIDGE_CHANNEL) : null
  const dslRequestId = ref<string | null>(null)

  function postDslChoiceSelected(choiceIndex: number) {
    if (!dslBridge || !dslRequestId.value)
      return
    dslBridge.postMessage({ type: 'dsl-choice-selected', requestId: dslRequestId.value, choiceIndex })
    dslRequestId.value = null
  }

  if (dslBridge) {
    dslBridge.onmessage = (event: MessageEvent) => {
      const data = event.data
      if (data?.type === 'dsl-choices') {
        // Mirror the VM's menu into the overlay. DSL menu text is pre-interpolated.
        dslRequestId.value = data.requestId
        choices.value = (data.choices || []).map((c: { index: number, text: string }) => ({
          id: `dsl:${data.requestId}:${c.index}`,
          text: c.text,
          icon: 'i-solar:chat-round-dots-bold-duotone',
          action: 'dsl_choice',
        }))
        currentSubtitle.value = data.text || ''
      }
      else if (data?.type === 'dsl-intimacy-changed') {
        // DSL `Bonus` rewards flow into the persistent intimacy the overlay/dating sim reads.
        // Apply delta against current to respect the dating-sim's clamping contract.
        if (typeof data.delta === 'number') {
          setVariable('Intimacy', Math.max(0, Math.min(100, getVariable('Intimacy') + data.delta)))
        }
      }
    }
  }

  const resolvedSceneryRoute = computed(() => {
    const route = settings.value.sceneryRoute
    if (route === 'inherit') {
      const cardStore = useAiriCardStore()
      const cardRoute = cardStore.activeCard?.extensions?.airi?.artistry?.spawnMode || 'bg_widget'
      return cardRoute === 'bg' ? 'background' : cardRoute
    }
    // If bg_widget is selected but AA is off, no new images will arrive per-turn —
    // spawning a widget on every turn would just stack duplicate cover images.
    // Fall back to background-only so we keep refreshing the stage instead.
    if (route === 'bg_widget') {
      const cardStore = useAiriCardStore()
      const aaEnabled = cardStore.activeCard?.extensions?.airi?.artistry?.autonomousEnabled ?? false
      if (!aaEnabled)
        return 'background'
    }
    return route
  })

  let addWidget: any = null
  let applySizePresetEventa: any = null
  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
    const win = window as any
    const { context } = createContext(win.electron.ipcRenderer as any)
    const widgetsAdd = defineInvokeEventa<string | undefined, any>('eventa:invoke:electron:windows:widgets:add')
    addWidget = defineInvoke(context, widgetsAdd)

    const applySizePresetContract = defineInvokeEventa<void, { target: 'actor' | 'chat', preset?: string }>('eventa:invoke:electron:windows:apply-size-preset')
    applySizePresetEventa = defineInvoke(context, applySizePresetContract)
  }

  async function spawnSceneryWidget(imageUrl: string, title: string) {
    if (!addWidget)
      return

    try {
      await addWidget({
        componentName: 'artistry',
        componentProps: {
          status: 'done',
          imageUrl,
          title,
          _skipIngestion: true,
        },
        size: 'm',
        ttlMs: 0,
      })
    }
    catch (widgetErr) {
      console.warn('Failed to spawn Dating Sim scenery widget', widgetErr)
    }
  }

  // Delta Ticking Engine
  let lastTick = 0
  let loopId: number | null = null

  function startGameLoop() {
    if (loopId)
      return
    lastTick = performance.now()
    const tick = (now: number) => {
      if (!enabled.value) {
        loopId = null
        return
      }
      const dt = (now - lastTick) / 1000
      lastTick = now

      // Process Timers (e.g. countdown for choices)
      if (settings.value.lightningRounds && settings.value.autoTicks && variables.value.Timer > 0) {
        variables.value.Timer = Math.max(0, variables.value.Timer - dt)
        if (variables.value.Timer === 0) {
          handleTimeout()
        }
      }

      loopId = requestAnimationFrame(tick)
    }
    loopId = requestAnimationFrame(tick)
  }

  function handleTimeout() {
    choices.value = []
    currentSubtitle.value = '...'
    // Fallback logic when user doesn't answer in time
  }

  const isGenerating = ref(false)

  async function generateInitialGoalDrivenChoices(customPremiseVal?: string) {
    if (isGenerating.value)
      return
    isGenerating.value = true
    customPremise.value = customPremiseVal || ''
    try {
      const { useLLM } = await import('@proj-airi/stage-ui/stores/llm')
      const { useProvidersStore } = await import('@proj-airi/stage-ui/stores/providers')
      const { useConsciousnessStore } = await import('@proj-airi/stage-ui/stores/modules/consciousness')
      const { useAiriCardStore } = await import('@proj-airi/stage-ui/stores/modules/airi-card')

      const llm = useLLM()
      const providers = useProvidersStore()
      const consciousness = useConsciousnessStore()
      const cardStore = useAiriCardStore()

      const provider = await providers.getProviderInstance(consciousness.activeProvider)

      if (!provider || !consciousness.activeModel) {
        console.error('[DatingSim] No active model or provider')
        return
      }

      const characterName = cardStore.activeCard?.name || 'Companion'
      const characterPersonality = cardStore.activeCard?.personality || ''
      const story = activeStoryline.value

      if (!story) {
        console.error('[DatingSim] No active storyline selected')
        return
      }

      const sceneName = story.title || 'the date'
      const sceneLocation = story.scene || ''
      const basePremise = story.premise || ''
      const premiseText = customPremiseVal && customPremiseVal.trim()
        ? `The user wants to customize or tweak the premise of this encounter please adjust to the text below: ${customPremiseVal}`
        : basePremise

      const systemPrompt = `You are a dialogue writing assistant and the "Gameshow Host" for a Dating Sim. 
Your job is to generate the initial setup introduction (the subtitle) and exactly 4 diverse initial options for what the USER could say to start this storyline.
The choices must be written in the user's natural, personal voice (first-person), matching their style of capitalization, punctuation, or slang if appropriate.

Companion Character: ${characterName}
Companion's Personality: ${characterPersonality}

Storyline Scenario: ${sceneName}
Location / Setting: ${sceneLocation}
Premise: ${premiseText}

Rules:
- Generate 4 varied ideas for a way to initiate this story line, it might not be perfect or make perfect sense but just do your best.
- Vary the emotional/tonal approach across the 4 options: one bold/flirty, one helpful/focused, one playful/teasing, one silent/observational.
- Keep each choice short (under 2 sentences).
- For each choice, assign its score impact based on how positive/productive or negative/risky it is in initiating this scenario. Every choice MUST have at least 1 point on either positive or negative (or both). Do not make any choice positive: 0 and negative: 0.
  * "positive": How much this choice adds to the user's positive score (typically 0 or 1, or 2 for high-risk/high-reward positive moves).
  * "negative": How much this choice adds to the user's negative score (typically 0 or 1, or 2 for risky/bad moves).
- Generate a "subtitle" that sets the starting scene or describes the companion's initial posture/look (written in third-person descriptive text or representing the companion's first words).

Your output MUST be EXACTLY in this JSON format and nothing else:
{
  "subtitle": "Starting scene introduction / companion's initial reaction text",
  "topics": [
    {
      "text": "First choice option",
      "positive": 1,
      "negative": 0
    },
    {
      "text": "Second choice option",
      "positive": 0,
      "negative": 1
    },
    {
      "text": "Third choice option",
      "positive": 1,
      "negative": 1
    },
    {
      "text": "Fourth choice option",
      "positive": 2,
      "negative": 0
    }
  ]
}`

      const userPrompt = `Generate the initial scene subtitle and the 4 starting options for the storyline: "${sceneName}".`

      const result = await llm.generate(
        consciousness.activeModel,
        provider as any,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      )

      const rawText = result.text || (result as any).reasoning || ''
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match)
        throw new Error('No JSON object found in response')
      const object = JSON.parse(match[0])

      const liveChoices = object.topics.slice(0, 4).map((t: any, i: number) => ({
        id: `t${i}`,
        text: typeof t === 'string' ? t : (t.text || ''),
        icon: 'i-solar:chat-round-dots-bold-duotone',
        action: 'llm_topic',
        positiveScoreChange: typeof t === 'object' ? (t.positive ?? 0) : 0,
        negativeScoreChange: typeof t === 'object' ? (t.negative ?? 0) : 0,
      }))

      triggerTestSyncCustom(liveChoices, object.subtitle || '')
    }
    catch (err) {
      console.error('[DatingSim] Initial Choice Generation Failed:', err)
    }
    finally {
      isGenerating.value = false
    }
  }

  async function generateLiveChoices(force = false) {
    if (isGenerating.value)
      return

    if (!force) {
      const cardStore = useAiriCardStore()
      const aaEnabled = cardStore.activeCard?.extensions?.airi?.artistry?.autonomousEnabled ?? false
      if (aaEnabled) {
        console.log('[DatingSim] Skipping generateLiveChoices: Autonomous Artistry is enabled.')
        return
      }
    }

    isGenerating.value = true
    try {
      const { useLLM } = await import('@proj-airi/stage-ui/stores/llm')
      const { useProvidersStore } = await import('@proj-airi/stage-ui/stores/providers')
      const { useConsciousnessStore } = await import('@proj-airi/stage-ui/stores/modules/consciousness')
      const { useChatSessionStore } = await import('@proj-airi/stage-ui/stores/chat/session-store')
      const { useAiriCardStore } = await import('@proj-airi/stage-ui/stores/modules/airi-card')

      const llm = useLLM()
      const providers = useProvidersStore()
      const consciousness = useConsciousnessStore()
      const chatSession = useChatSessionStore()
      const cardStore = useAiriCardStore()

      const provider = await providers.getProviderInstance(consciousness.activeProvider)

      if (!provider || !consciousness.activeModel) {
        console.error('[DatingSim] No active model or provider')
        return
      }

      const characterName = cardStore.activeCard?.name || 'Companion'
      const rawMessages = chatSession.messages || []
      const relevantMessages = rawMessages
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .slice(-settings.value.contextDepth)

      const chatHistoryText = relevantMessages
        .map((m: any) => {
          const speaker = m.role === 'user' ? 'User' : characterName
          const content = typeof m.content === 'string' ? m.content : ''
          return `${speaker}: ${content}`
        })
        .join('\n')

      const isGoalDriven = settings.value.gameMode === 'goal_driven'
      const story = activeStoryline.value

      const systemPrompt = `You are a dialogue writing assistant for a Dating Sim. 
Your job is to suggest exactly 4 things the USER could say next, written in the user's natural, personal voice, please ensure you follow their style of capitalization and punctuation and the way they say things including action brackets and asterisks to imitate the user as closely as possible.
You also MUST generate the subtitle for the scene (the character's dialogue spoken in this turn, or a narrative subtitle if they didn't speak).

The conversation so far involves the user chatting with ${characterName}.
${isGoalDriven && story
  ? `Active Scenario Context:
- Setting/Location: ${story.scene || ''}
- Story premise: ${story.premise || ''}
- Terms of Encounter: ${story.termsOfEncounter || ''}`
  : ''}

Rules:
- Each suggestion must sound like something the user would naturally say, not a formal prompt
- Keep each message under 2 sentences
- No meta-commentary, no "(OOC)" notes, no quotation marks around the message text
- Output exactly 4 options matching the requested voice style.
${isGoalDriven
  ? `- For each suggestion, assign its score impact based on how positive/productive or negative/risky it is in advancing the terms of encounter. Every suggestion MUST have at least 1 point on either positive or negative (or both). Do not make any suggestion positive: 0 and negative: 0.
  * "positive": How much this choice adds to the user's connection score (typically 0 or 1, or 2 for high-risk/high-reward positive moves).
  * "negative": How much this choice adds to the user's friction score (typically 0 or 1, or 2 for risky/bad moves).`
  : ''}

Your output MUST be EXACTLY in this JSON format:
{
  "subtitle": "Character's subtitle/dialogue text for this turn",
  "topics": [
    ${isGoalDriven
      ? `{ "text": "First choice option in user's style", "positive": 1, "negative": 0 },
    { "text": "Second choice option in user's style", "positive": 0, "negative": 1 },
    { "text": "Third choice option in user's style", "positive": 1, "negative": 1 },
    { "text": "Fourth choice option in user's style", "positive": 2, "negative": 0 }`
      : `"First choice option in user's style", "Second choice option in user's style", "Third choice option in user's style", "Fourth choice option in user's style"`}
  ]
}`

      const userPrompt = `Here is the conversation history so far:
${chatHistoryText}

Generate 4 options for what the User could say next and the subtitle.`

      const result = await llm.generate(
        consciousness.activeModel,
        provider as any,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      )

      const rawText = result.text || (result as any).reasoning || ''
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match)
        throw new Error('No JSON object found in response')
      const object = JSON.parse(match[0])

      const liveChoices = object.topics.slice(0, 4).map((t: any, i: number) => {
        const hasWeights = typeof t === 'object' && t !== null
        return {
          id: `t${i}`,
          text: hasWeights ? (t.text || '') : t,
          icon: 'i-solar:chat-round-dots-bold-duotone',
          action: 'llm_topic',
          positiveScoreChange: hasWeights ? (t.positive ?? 0) : 0,
          negativeScoreChange: hasWeights ? (t.negative ?? 0) : 0,
        }
      })

      triggerTestSyncCustom(liveChoices, object.subtitle || '')
    }
    catch (err) {
      console.error('[DatingSim] Live Generation Failed:', err)
    }
    finally {
      isGenerating.value = false
    }
  }

  async function evaluateParameters(userPrompt: string) {
    if (!enabled.value)
      return
    try {
      const { useLLM } = await import('@proj-airi/stage-ui/stores/llm')
      const { useProvidersStore } = await import('@proj-airi/stage-ui/stores/providers')
      const { useConsciousnessStore } = await import('@proj-airi/stage-ui/stores/modules/consciousness')

      const llm = useLLM()
      const providers = useProvidersStore()
      const consciousness = useConsciousnessStore()
      const provider = await providers.getProviderInstance(consciousness.activeProvider)

      if (!provider || !consciousness.activeModel)
        return

      const result = await llm.generate(
        consciousness.activeModel,
        provider as any,
        [
          { role: 'system', content: `You are a Dating Sim engine evaluating a user's prompt. The user said: "${userPrompt}". How does this affect Intimacy and Tension? (Range -20 to +20). Your output MUST be EXACTLY in this JSON format: {"intimacyChange": 2, "tensionChange": -5, "mood": "happy"}` },
          { role: 'user', content: 'Output raw JSON only. Do not include markdown backticks or any preamble/postamble.' },
        ],
      )

      const rawText = result.text || (result as any).reasoning || ''
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match)
        throw new Error('No JSON object found in response')
      const object = JSON.parse(match[0])

      if (typeof object.intimacyChange === 'number') {
        setVariable('Intimacy', Math.max(0, Math.min(100, getVariable('Intimacy') + object.intimacyChange)))
      }
      if (typeof object.tensionChange === 'number') {
        setVariable('Tension', Math.max(0, Math.min(100, getVariable('Tension') + object.tensionChange)))
      }
      if (object.mood) {
        broadcastMood(object.mood)
      }

      // Regenerate choices after parameters update
      generateLiveChoices()
    }
    catch (err) {
      console.error('[DatingSim] Parameter Evaluation Failed:', err)
      // Fallback: still regenerate choices so UI isn't stuck
      generateLiveChoices()
    }
  }

  function setVariable(name: string, value: number) {
    variables.value[name] = value
  }

  function getVariable(name: string): number {
    return variables.value[name] || 0
  }

  function evaluateCondition(condition?: string): boolean {
    if (!condition)
      return true
    const parts = condition.split(' ')
    if (parts.length < 3)
      return false
    const [varName, op, targetStr] = parts
    const currentValue = getVariable(varName)
    const target = Number.parseFloat(targetStr)

    switch (op) {
      case 'equal': return currentValue === target
      case 'greater': return currentValue > target
      case 'less': return currentValue < target
      case 'greater_eq': return currentValue >= target
      case 'less_eq': return currentValue <= target
      default: return false
    }
  }

  function executeAssignment(code: string) {
    const parts = code.split(' ')
    if (parts.length < 3)
      return
    const [varName, op, ...exprParts] = parts
    const expr = exprParts.join(' ')
    const currentValue = getVariable(varName)

    if (op === 'assign') {
      if (expr.startsWith('rand(')) {
        const match = expr.match(/rand\((\d+),(\d+)\)/)
        if (match) {
          const min = Number.parseInt(match[1], 10)
          const max = Number.parseInt(match[2], 10)
          setVariable(varName, Math.floor(Math.random() * (max - min + 1)) + min)
        }
      }
      else {
        setVariable(varName, Number.parseFloat(expr))
      }
    }
    else if (op === 'add') {
      setVariable(varName, currentValue + Number.parseFloat(expr))
    }
    else if (op === 'subtract') {
      setVariable(varName, currentValue - Number.parseFloat(expr))
    }
  }

  // 3. The Instruction Sequencer (Command Pipeline)
  function executeScript(script: string) {
    const commands = script.split(';')
    for (const rawCmd of commands) {
      const cmd = rawCmd.trim()
      if (!cmd)
        continue

      if (cmd.startsWith('start_mtn')) {
        const target = cmd.replace('start_mtn', '').trim()
        console.info(`[Dating Sim Pipeline] Triggering motion: ${target}`)
        window.dispatchEvent(new CustomEvent('dating-sim:trigger-motion', { detail: target }))
      }
      else if (cmd.startsWith('clear_exp')) {
        console.info(`[Dating Sim Pipeline] Clearing expressions.`)
        window.dispatchEvent(new CustomEvent('dating-sim:clear-exp'))
      }
      else if (cmd.startsWith('motions enable')) {
        console.info(`[Dating Sim Pipeline] Enabling idle motions.`)
        window.dispatchEvent(new CustomEvent('dating-sim:motions-enable', { detail: true }))
      }
      else if (cmd.startsWith('motions disable')) {
        console.info(`[Dating Sim Pipeline] Disabling idle motions.`)
        window.dispatchEvent(new CustomEvent('dating-sim:motions-enable', { detail: false }))
      }
      else if (cmd.startsWith('change_cos')) {
        const modelJson = cmd.replace('change_cos', '').trim()
        console.info(`[Dating Sim Pipeline] Dynamic Model Hot-Swap: ${modelJson}`)
        window.dispatchEvent(new CustomEvent('dating-sim:change-cos', { detail: modelJson }))
      }
    }
  }

  // Lifecycle
  function enable() {
    enabled.value = true
    if (applySizePresetEventa) {
      applySizePresetEventa({ target: 'actor', preset: 'dating-sim-on' }).catch(console.error)
    }
    startGameLoop()
  }

  function disable() {
    enabled.value = false
    if (applySizePresetEventa) {
      applySizePresetEventa({ target: 'actor', preset: 'dating-sim-off' }).catch(console.error)
    }
    choices.value = []
    currentSubtitle.value = ''
    activeStoryline.value = null
    variables.value = {
      Intimacy: 0,
      Tension: 50,
      ActionPoints: 5,
      TimeOfDay: 12,
      Timer: 0,
      positiveScore: 0,
      negativeScore: 0,
      turnsElapsed: 0,
    }
    if (loopId !== null) {
      cancelAnimationFrame(loopId)
      loopId = null
    }
  }

  // Cross-Window Sync for testing and runtime state propagation
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('dating-sim-sync') : null

  // Watch state changes in main window to broadcast updates automatically
  if (bc && typeof window !== 'undefined') {
    watch(
      [enabled, variables, settings, activeStoryline, customPremise, choices, currentSubtitle],
      () => {
        // Only broadcast if we are acting as the coordinator/main instance
        // (to prevent recursive loops, the receiver updates values without re-broadcasting)
        if (isBroadcasting.value) {
          bc.postMessage({
            type: 'sync',
            payload: {
              enabled: enabled.value,
              variables: JSON.parse(JSON.stringify(variables.value)),
              settings: JSON.parse(JSON.stringify(settings.value)),
              activeStoryline: JSON.parse(JSON.stringify(activeStoryline.value)),
              customPremise: customPremise.value,
              choices: JSON.parse(JSON.stringify(choices.value)),
              currentSubtitle: currentSubtitle.value,
            },
          })
        }
      },
      { deep: true },
    )
  }

  const isBroadcasting = ref(true)

  if (bc) {
    bc.onmessage = (event) => {
      if (event.data.type === 'sync') {
        isBroadcasting.value = false
        const payload = event.data.payload
        enabled.value = payload.enabled
        Object.assign(variables.value, payload.variables)
        Object.assign(settings.value, payload.settings)
        activeStoryline.value = payload.activeStoryline
        customPremise.value = payload.customPremise
        choices.value = payload.choices
        currentSubtitle.value = payload.currentSubtitle
        // If the coordinator overrode the visible menu (e.g. re-rendered with new choices
        // or cleared), the outstanding DSL selection context no longer maps to what's on
        // screen — drop the pending reply id to avoid resuming the VM against stale state.
        if (!((payload.choices || []).some((c: any) => typeof c?.id === 'string' && c.id.startsWith('dsl:'))))
          dslRequestId.value = null
        // Re-enable broadcasting after DOM tick
        setTimeout(() => {
          isBroadcasting.value = true
        }, 50)
      }
      if (event.data.type === 'test') {
        enable()
        currentPhase.value = 'conversation'
        setVariable('Intimacy', 75)
        setVariable('Tension', 80)
        setVariable('ActionPoints', 3)
        setVariable('Timer', 10)
        choices.value = event.data.choices
        currentSubtitle.value = event.data.subtitle
      }
      if (event.data.type === 'clear') {
        disable()
        choices.value = []
        currentSubtitle.value = ''
      }
      if (event.data.type === 'toggle') {
        if (event.data.enabled)
          enable()
        else disable()
      }
      if (event.data.type === 'mood') {
        applyMood(event.data.mood)
      }
    }
  }

  function syncToggle(isEnabled: boolean) {
    if (isEnabled)
      enable()
    else disable()
  }

  function toggleDatingSim() {
    if (enabled.value) {
      syncToggle(false)
    }
    else {
      syncToggle(true)
    }
  }

  function applyMood(newMood: string) {
    import('@proj-airi/stage-ui-live2d/stores/live2d').then(({ useLive2d }) => {
      const live2dStore = useLive2d()
      if (live2dStore.model) {
        const m = newMood.toLowerCase()
        const specialSauceMap: Record<string, { group: string, index: number } | string> = {
          happy: { group: 'Face#2', index: 1 },
          surprised: { group: 'Face#2', index: 2 },
          sad: { group: 'Face#2', index: 3 },
          angry: { group: 'Face#2', index: 5 },
          cool: { group: 'Face#2', index: 6 },
          shy: { group: 'Face#2', index: 7 },
          think: { group: 'Face#2', index: 8 },
          neutral: { group: 'Face#2', index: 0 },
          love: 'exp12',
          blush: 'exp01',
        }
        if (m in specialSauceMap) {
          const mapped = specialSauceMap[m]
          if (typeof mapped === 'string') {
            live2dStore.triggerEmotion(mapped)
          }
          else if (live2dStore.model?.internalModel?.motionManager) {
            live2dStore.model.internalModel.motionManager.startMotion(mapped.group, mapped.index)
          }
          else {
            live2dStore.triggerEmotion(m)
          }
        }
        else {
          live2dStore.triggerEmotion(m)
        }
      }
    })
  }

  function broadcastMood(newMood: string) {
    applyMood(newMood)
    if (bc)
      bc.postMessage({ type: 'mood', mood: newMood })
  }

  function triggerTestSync() {
    const testChoices = [
      { id: '1', text: 'Give a Present', icon: 'i-solar:gift-bold-duotone', action: 'give_gift', cost: 1 },
      { id: '2', text: 'Ask about hobbies', icon: 'i-solar:gamepad-bold-duotone', action: 'chat', cost: 1 },
      { id: '3', text: 'Stare quietly', icon: 'i-solar:eye-bold-duotone', action: 'stare', condition: 'Intimacy greater 50', cost: 2 },
      { id: '4', text: 'Hold Hands', icon: 'i-solar:hand-heart-bold-duotone', action: 'hold_hands', condition: 'Intimacy greater 70', cost: 3 },
    ]
    const testSubtitle = 'They seem to be waiting for your response...'

    // Apply locally
    enable()
    currentPhase.value = 'conversation'
    setVariable('Intimacy', 75)
    setVariable('Tension', 80)
    setVariable('ActionPoints', 3)
    setVariable('Timer', 10)
    choices.value = testChoices
    currentSubtitle.value = testSubtitle

    // Broadcast to Stage window
    if (bc)
      bc.postMessage({ type: 'test', choices: testChoices, subtitle: testSubtitle })
  }

  function triggerTestSyncCustom(customChoices: Choice[], subtitle: string) {
    enable()
    currentPhase.value = 'conversation'
    setVariable('Intimacy', 75)
    setVariable('Tension', 80)
    setVariable('ActionPoints', 3)
    setVariable('Timer', 10)
    choices.value = customChoices
    currentSubtitle.value = subtitle

    if (bc)
      bc.postMessage({ type: 'test', choices: customChoices, subtitle })
  }

  function clearTestSync() {
    disable()
    choices.value = []
    currentSubtitle.value = ''
    if (bc)
      bc.postMessage({ type: 'clear' })
  }

  if (typeof window !== 'undefined' && (window as any).electron) {
    const ipcRenderer = (window as any).electron.ipcRenderer
    if (typeof ipcRenderer.removeAllListeners === 'function') {
      try { ipcRenderer.removeAllListeners('dating-sim-toggle') }
      catch (e) {}
    }
    ipcRenderer.on('dating-sim-toggle', () => {
      toggleDatingSim()
    })
  }

  return {
    enabled,
    settings,
    currentPhase,
    variables,
    mood,
    choices,
    currentSubtitle,
    activeStoryline,
    customPremise,
    resolvedSceneryRoute,
    spawnSceneryWidget,
    setVariable,
    getVariable,
    evaluateCondition,
    executeAssignment,
    executeScript,
    enable,
    disable,
    triggerTestSync,
    triggerTestSyncCustom,
    clearTestSync,
    toggleDatingSim,
    syncToggle,
    generateLiveChoices,
    generateInitialGoalDrivenChoices,
    evaluateParameters,
    broadcastMood,
    isGenerating,
    postDslChoiceSelected,
    dslRequestId,
  }
})
