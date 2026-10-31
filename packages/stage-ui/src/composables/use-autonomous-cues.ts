import type { Card } from '@proj-airi/ccc'
import type { MaybeRefOrGetter } from 'vue'

import type { ModelCapabilityItem } from '../libs/character/model-capabilities'
import type { CharacterCueAllowlist } from '../types/card.schema'

import { ref, toValue } from 'vue'

import { useSystemOneStore } from '../stores/modules/system-one'

export const ACT_TOKEN_PATTERN = /<\|ACT:(?:emotion|motion|vfx|actor)=[^>|]+(?:\|>|>)/i

export interface AutonomousCueMeta {
  token: string
  rawKey: string
  sentence: string
  confidence: number
  intensity?: number
  latencyMs: number
  budgetMs: number
  provenance: 'autonomous_system_one'
}

export type AutonomousCueRunStatus
  = | 'fired'
    | 'none'
    | 'skipped-prefixed'
    | 'skipped-noise'
    | 'unmapped'
    | 'budget-dropped'
    | 'disabled'
    | 'unconfigured'
    | 'error'

export interface AutonomousCueRunRecord {
  sentence: string
  token: string
  rawKey: string | null
  confidence: number
  intensity?: number
  latencyMs: number
  budgetMs: number
  status: AutonomousCueRunStatus
  error?: string
}

export interface AutonomousCueContext {
  activeCard?: MaybeRefOrGetter<Card | null | undefined>
  activeModelId?: MaybeRefOrGetter<string | null | undefined>
  currentActorId?: MaybeRefOrGetter<string | null | undefined>
  autoMode?: MaybeRefOrGetter<boolean | undefined>
  enforceBudget?: MaybeRefOrGetter<boolean | undefined>
  expressionCapabilities?: MaybeRefOrGetter<ModelCapabilityItem[] | undefined>
  motionCapabilities?: MaybeRefOrGetter<ModelCapabilityItem[] | undefined>
  resolveActorModel?: (actorId?: string | null) => {
    modelId: string | null
    expressionCapabilities: ModelCapabilityItem[]
    motionCapabilities: ModelCapabilityItem[]
  }
  actuateEmotion?: (rawKey: string, meta: AutonomousCueMeta) => void
  actuateMotion?: (rawKey: string, meta: AutonomousCueMeta) => void
}

/**
 * Checks if a sentence stride already carries an explicit ACT marker.
 */
export function containsExplicitActToken(text: string): boolean {
  return ACT_TOKEN_PATTERN.test(text)
}

/**
 * Detects whether a sentence stride contains meaningful speech text worthy of System 1 evaluation.
 * Filters out isolated punctuation (e.g. "~", "...", "!"), single short interjections, and noise fragments.
 */
export function isClassifiableSentence(text: string): boolean {
  const clean = normalizeSentenceText(text).trim()
  if (!clean) {
    return false
  }

  // Must contain at least one letter or digit
  if (!/[\p{L}\p{N}]/u.test(clean)) {
    return false
  }

  // CJK scripts do not use spaces between words; 3+ CJK characters convey full phrases
  const hasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(clean)
  if (hasCjk) {
    const cjkChars = clean.replace(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, '')
    return cjkChars.length >= 3
  }

  // For Latin / non-CJK scripts, require at least 7 characters total AND at least 2 alphanumeric words
  if (clean.length < 7) {
    return false
  }

  const words = clean.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w))
  return words.length >= 2
}

/**
 * Normalizes sentence stride text for lookup and clean classification.
 */
export function normalizeSentenceText(text: string): string {
  return text.replace(ACT_TOKEN_PATTERN, '').trim()
}

/**
 * Normalizes sentence or audio stride text for fuzzy cross-matching between
 * System 1 decisions and spoken audio playback events. Strips ACT tokens, punctuation,
 * collapses whitespace, and lowercases Unicode letters/numbers.
 */
export function normalizeStrideText(text: string): string {
  return text.replace(ACT_TOKEN_PATTERN, '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Calculates theoretical spoken duration budget (90% of duration at target WPM).
 * Used to avoid firing late cues after speech has ended.
 */
export function calculateWpmBudgetMs(sentence: string, wpm = 150): number {
  const words = sentence.trim().split(/\s+/).filter(Boolean).length
  if (words === 0) {
    return 1000
  }
  return Math.max(500, Math.round((words / wpm) * 60_000 * 0.9))
}

/**
 * Slices streaming text deltas into complete sentences on [.?!] boundaries,
 * preserving incomplete fragments in an internal buffer.
 */
export function createSentenceStrideBuffer() {
  let buffer = ''
  const sentenceRegex = /[^.?!]+[.?!]+["']?/g

  function feed(delta: string): string[] {
    buffer += delta
    const complete: string[] = []
    let match: RegExpExecArray | null
    let lastEnd = 0

    // Reset lastIndex for stateful global regex
    sentenceRegex.lastIndex = 0
    while ((match = sentenceRegex.exec(buffer)) !== null) {
      const sentence = match[0].trim()
      if (sentence) {
        complete.push(sentence)
      }
      lastEnd = sentenceRegex.lastIndex
    }

    buffer = buffer.slice(lastEnd)
    return complete
  }

  function flush(): string[] {
    const remaining = buffer.trim()
    buffer = ''
    if (remaining.length > 0 && isClassifiableSentence(remaining)) {
      return [remaining]
    }
    return []
  }

  function getPendingBuffer(): string {
    return buffer
  }

  function reset() {
    buffer = ''
  }

  return {
    feed,
    flush,
    getPendingBuffer,
    reset,
  }
}

/**
 * Splits a full block of text into individual sentence strides.
 */
export function splitSentences(text: string): string[] {
  const buffer = createSentenceStrideBuffer()
  const sentences = buffer.feed(text)
  const remainder = buffer.flush()
  return [...sentences, ...remainder]
}

/**
 * Resolves an authored or decided cue token to a physical rig rawKey.
 * Checks cueAllowlist first, then falls back to model capabilities by label or rawKey.
 */
export function resolveCueToken(
  token: string,
  options: {
    allowlist?: CharacterCueAllowlist
    capabilities?: ModelCapabilityItem[]
    rigExpressions?: string[]
  } = {},
): { rawKey: string, label?: string } | null {
  if (!token || token.toLowerCase() === 'none') {
    return null
  }

  const { allowlist, capabilities = [], rigExpressions = [] } = options

  // 1. Allowlist Emotions lookup
  if (allowlist?.emotions?.[token]) {
    const hit = allowlist.emotions[token]
    if (rigExpressions.length > 0) {
      const rigHit = rigExpressions.find(r => r === hit.rawKey || r.toLowerCase() === hit.rawKey.toLowerCase())
      if (rigHit) {
        return { rawKey: rigHit, label: hit.label }
      }
    }
    return { rawKey: hit.rawKey, label: hit.label }
  }

  // 2. Allowlist Motions lookup
  if (allowlist?.motions?.[token]) {
    const hit = allowlist.motions[token]
    if (rigExpressions.length > 0) {
      const rigHit = rigExpressions.find(r => r === hit.rawKey || r.toLowerCase() === hit.rawKey.toLowerCase())
      if (rigHit) {
        return { rawKey: rigHit, label: hit.label }
      }
    }
    return { rawKey: hit.rawKey, label: hit.label }
  }

  // 3. Rig expressions direct match
  if (rigExpressions.length > 0) {
    const hit = rigExpressions.find(r => r === token || r.toLowerCase() === token.toLowerCase())
    if (hit) {
      return { rawKey: hit, label: hit }
    }
  }

  // 3. Model capabilities fallback: match by label
  for (const cap of capabilities) {
    if (cap.usable !== false && cap.label && cap.label.toLowerCase() === token.toLowerCase()) {
      return { rawKey: cap.rawKey, label: cap.label }
    }
  }

  // 4. Model capabilities fallback: match by rawKey
  for (const cap of capabilities) {
    if (cap.usable !== false && cap.rawKey.toLowerCase() === token.toLowerCase()) {
      return { rawKey: cap.rawKey, label: cap.label }
    }
  }

  // 5. Model capabilities fallback: match by stemmed label or rawKey
  const stemTarget = stemCueName(token).toLowerCase()
  for (const cap of capabilities) {
    if (cap.usable !== false) {
      const stemLabel = cap.label ? stemCueName(cap.label).toLowerCase() : null
      const stemRawKey = cap.rawKey ? stemCueName(cap.rawKey).toLowerCase() : null
      if (stemLabel === stemTarget || stemRawKey === stemTarget) {
        return { rawKey: cap.rawKey, label: cap.label }
      }
    }
  }

  return null
}

/**
 * Stems a motion or emotion cue name by stripping trailing numbers or numbered variant suffixes
 * (e.g. "Happy 1" -> "Happy", "Angry_2" -> "Angry", "Tickle Idle 1" -> "Tickle Idle").
 * Preserves compound words, spaces, skins, and bracketed descriptors (e.g. "Basic Civvies [Normal]").
 */
export function stemCueName(name: string): string {
  if (!name || typeof name !== 'string') {
    return ''
  }
  const stripped = name.replace(/[\s_]+\d+$/, '').trim()
  return stripped.length > 0 ? stripped : name
}

export interface AllowedEmotionOptionsResult {
  options: string[]
  isFallback: boolean
  variantMap: Map<string, string[]>
}

/**
 * Extracts candidate emotion option names from the character's allowlist or model capabilities.
 * Groups numbered motion/emotion variants under their base name to eliminate classifier noise
 * and prevent candidate list overflow, returning a variantMap for playback entropy.
 */
export function resolveAllowedEmotionOptions(
  allowlist?: CharacterCueAllowlist,
  capabilities?: ModelCapabilityItem[],
  motionCapabilities?: ModelCapabilityItem[],
  options: { autoMode?: boolean } = {},
): AllowedEmotionOptionsResult {
  const { autoMode = false } = options

  const usableExprs = (capabilities || []).filter(c => c.usable !== false)
  const usableMotions = (motionCapabilities || []).filter(c => c.usable !== false)
  const modelExprKeys = usableExprs.map(c => c.label || c.rawKey)
  const modelMotionKeys = usableMotions.map(c => c.label || c.rawKey)

  const variantMap = new Map<string, string[]>()
  variantMap.set('none', ['none'])

  function groupKeys(keys: string[]) {
    for (const key of keys) {
      if (!key)
        continue
      const base = stemCueName(key)
      if (!variantMap.has(base)) {
        variantMap.set(base, [])
      }
      const list = variantMap.get(base)!
      if (!list.includes(key)) {
        list.push(key)
      }
    }
  }

  // Auto Mode ON: Populate both emotions and motions dynamically from the active model (falling back to allowlist if model has no stored caps)
  if (autoMode) {
    const exprKeys = usableExprs.length > 0
      ? modelExprKeys
      : (allowlist?.emotions ? Object.keys(allowlist.emotions) : [])
    const motionKeys = usableMotions.length > 0
      ? modelMotionKeys
      : (allowlist?.motions ? Object.keys(allowlist.motions) : [])

    const allCaps = [...exprKeys, ...motionKeys]
    if (allCaps.length > 0) {
      groupKeys(allCaps)
      const uniqueBases = Array.from(variantMap.keys()).filter(k => k !== 'none')
      return {
        options: ['none', ...uniqueBases],
        isFallback: false,
        variantMap,
      }
    }
    return {
      options: ['none'],
      isFallback: false,
      variantMap,
    }
  }

  // Auto Mode OFF (Manual Mode): Respect cueAllowlist config for emotions, leave motions blank/empty
  if (allowlist?.emotions && Object.keys(allowlist.emotions).length > 0) {
    const emotionKeys = Object.keys(allowlist.emotions)
    groupKeys(emotionKeys)
    const uniqueBases = Array.from(variantMap.keys()).filter(k => k !== 'none')
    return {
      options: ['none', ...uniqueBases],
      isFallback: false,
      variantMap,
    }
  }

  // If cueAllowlist has no emotions and auto mode is off, do not inject fallbacks
  return {
    options: ['none'],
    isFallback: false,
    variantMap,
  }
}

/**
 * Scans a prompt document for occurrences of known candidate tokens.
 * Matches are guarded by delimiter fences (whitespace, quotes, backticks, brackets, punctuation)
 * to prevent substring false-positives (e.g. "shy" inside "fishy", "cat" inside "scattered").
 * Returns an array of matched token strings, or an empty array if none are found.
 */
export function extractTokensFromPrompt(promptText: string, candidateTokens: string[]): string[] {
  if (!promptText || !candidateTokens || candidateTokens.length === 0) {
    return []
  }

  const matched: string[] = []
  const fenceLeft = `(?:^|[\\s\`'"(\\[{<=:;,*\\-~/])`
  const fenceRight = `(?=$|[\\s\`'")\\]}>,:;*\\-~!?./]|\\b)`

  for (const candidate of candidateTokens) {
    if (!candidate || typeof candidate !== 'string')
      continue
    const trimmed = candidate.trim()
    if (!trimmed)
      continue

    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`${fenceLeft}${escaped}${fenceRight}`, 'i')
    if (regex.test(promptText)) {
      matched.push(trimmed)
    }
  }

  return Array.from(new Set(matched))
}

/**
 * Maximum character budget for persona context passed to System 1.
 * Keeps prompt token footprint under ~200 tokens to ensure sub-second WebGPU inference.
 */
export const MAX_PERSONA_CONTEXT_CHARS = 800

/**
 * Builds persona context string from the active character card, truncated to maxChars.
 */
export function buildPersonaContext(
  card?: Card | null,
  actorId?: string | null,
  maxChars = MAX_PERSONA_CONTEXT_CHARS,
): { name: string, block: string } {
  let name = (card as any)?.nickname || card?.name || 'Character'
  if (actorId && typeof actorId === 'string') {
    const rawName = actorId.replace(/^actor_/, '').split('_')[0]
    if (rawName) {
      name = rawName.charAt(0).toUpperCase() + rawName.slice(1)
    }
  }

  const personality = (card as any)?.personality || ''
  const description = (card as any)?.description || ''
  const directives = (card as any)?.extensions?.airi?.acting?.modelExpressionPrompt || ''

  const rawBlock = [
    directives ? `Acting directives: ${directives}` : '',
    personality ? `Personality: ${personality}` : '',
    description ? `Description: ${description}` : '',
  ].filter(Boolean).join('\n')

  const block = rawBlock.length > maxChars
    ? `${rawBlock.slice(0, maxChars)}...`
    : rawBlock

  return { name, block }
}

/**
 * Composable providing the autonomous sentence-stride cue evaluation and actuation pipeline.
 */
export function useAutonomousCues(context: AutonomousCueContext = {}) {
  const systemOneStore = useSystemOneStore()

  const strideBuffer = createSentenceStrideBuffer()
  const activeRuns = ref<AutonomousCueRunRecord[]>([])
  const isEvaluating = ref(false)
  let explicitActPending = false

  function markExplicitActSeen() {
    explicitActPending = true
  }

  /**
   * Evaluates a single sentence stride through System 1.
   */
  async function evaluateSentenceStride(
    rawSentence: string,
    options: { force?: boolean, enforceBudget?: boolean } = {},
  ): Promise<AutonomousCueRunRecord> {
    const cleanSentence = normalizeSentenceText(rawSentence)
    const budgetMs = calculateWpmBudgetMs(cleanSentence)

    // Check pre-prefixed: skip if already contains explicit ACT tag or one was seen on the stream
    const hasExplicit = containsExplicitActToken(rawSentence) || explicitActPending
    explicitActPending = false

    if (hasExplicit) {
      const record: AutonomousCueRunRecord = {
        sentence: cleanSentence,
        token: '',
        rawKey: null,
        confidence: 0,
        latencyMs: 0,
        budgetMs,
        status: 'skipped-prefixed',
      }
      activeRuns.value.push(record)
      return record
    }

    // Check noise filter: skip if sentence is not classifiable speech text
    if (!isClassifiableSentence(cleanSentence)) {
      const record: AutonomousCueRunRecord = {
        sentence: cleanSentence,
        token: '',
        rawKey: null,
        confidence: 0,
        latencyMs: 0,
        budgetMs,
        status: 'skipped-noise',
      }
      activeRuns.value.push(record)
      return record
    }

    const card = toValue(context.activeCard)
    const actingConfig = (card as any)?.extensions?.airi?.acting
    const autoCuesEnabled = actingConfig?.autoCuesEnabled ?? false

    // Gate on autoCuesEnabled (unless force option is passed)
    if (!autoCuesEnabled && !options.force) {
      const record: AutonomousCueRunRecord = {
        sentence: cleanSentence,
        token: '',
        rawKey: null,
        confidence: 0,
        latencyMs: 0,
        budgetMs,
        status: 'disabled',
      }
      activeRuns.value.push(record)
      return record
    }

    // Gate on systemOneStore.configured
    if (!systemOneStore.configured) {
      const record: AutonomousCueRunRecord = {
        sentence: cleanSentence,
        token: '',
        rawKey: null,
        confidence: 0,
        latencyMs: 0,
        budgetMs,
        status: 'unconfigured',
      }
      activeRuns.value.push(record)
      return record
    }

    const actorId = toValue(context.currentActorId) || null

    let modelId = toValue(context.activeModelId)
    let caps = toValue(context.expressionCapabilities) || []
    let motionCaps = toValue(context.motionCapabilities) || []

    if (context.resolveActorModel) {
      const resolved = context.resolveActorModel(actorId)
      if (resolved.modelId) {
        modelId = resolved.modelId
        caps = resolved.expressionCapabilities
        motionCaps = resolved.motionCapabilities
      }
    }

    const allowlist: CharacterCueAllowlist | undefined = actingConfig?.cueAllowlist || actingConfig?.compiledWhitelist
    const autoMode = Boolean(
      toValue(context.autoMode)
      ?? actingConfig?.autoMode
      ?? actingConfig?.autoCueMotions
      ?? true,
    )

    const { options: emotionOptions, variantMap } = resolveAllowedEmotionOptions(
      allowlist,
      caps,
      motionCaps,
      { autoMode },
    )

    const { name, block } = buildPersonaContext(card, actorId)
    const state = `Line for ${name}:\n${block}\nLine: "${cleanSentence}"`

    console.log('[AutonomousCues] Evaluating stride:', {
      actorId,
      modelId,
      autoMode,
      sentence: cleanSentence,
      systemPrompt: block,
      state,
      expressions: caps.filter(c => c.usable !== false).map(c => c.label || c.rawKey),
      motions: autoMode ? motionCaps.filter(c => c.usable !== false).map(c => c.label || c.rawKey) : [],
      options: emotionOptions,
    })

    // Skip API request if there are no cues available (only 'none')
    if (emotionOptions.length <= 1) {
      const record: AutonomousCueRunRecord = {
        sentence: cleanSentence,
        token: 'none',
        rawKey: null,
        confidence: 0,
        latencyMs: 0,
        budgetMs,
        status: 'none',
      }
      activeRuns.value.push(record)
      return record
    }

    const questions: Record<string, any> = {
      emotion: {
        type: 'choice',
        instructions: `Select the avatar emotion cue from ${name}'s allowed cues that best matches this line. Select none if no cue fits.`,
        criteria: Object.fromEntries(
          emotionOptions.map(opt => [opt, opt === 'none' ? 'No cue fits this line.' : `Emotion cue: ${opt}.`]),
        ),
      },
      intensity: {
        type: 'score',
        instructions: 'Score the emotional intensity of this line from 0.3 (subtle, understated) to 1.0 (peak, theatrical).',
        criteria: [
          'Subtle, understated delivery.',
          'Mild feeling — a hint of warmth, tension, or playfulness.',
          'Strong feeling — clearly audible emotion driving the line.',
          'Exaggerated, theatrical peak — maximum emotional charge.',
        ],
        min: 0.3,
        max: 1.0,
      },
    }

    isEvaluating.value = true
    const t0 = performance.now()

    try {
      const res = await systemOneStore.execute(state, questions)
      const latencyMs = Math.round(performance.now() - t0)

      const answer = (res.answers as any)?.emotion || {}
      const token = answer.choice || 'none'
      const confidence = typeof answer.confidence === 'number' ? answer.confidence : 0

      // Extract emotional intensity score (0.3 to 1.0)
      const rawIntensity = (res.answers as any)?.intensity?.score ?? (res.answers as any)?.intensity
      let intensity: number | undefined
      if (typeof rawIntensity === 'number' && !Number.isNaN(rawIntensity)) {
        intensity = Math.round(Math.min(1.0, Math.max(0.3, rawIntensity)) * 100) / 100
      }

      function finishRun(record: AutonomousCueRunRecord): AutonomousCueRunRecord {
        console.log('[AutonomousCues] Classifier result:', {
          actorId,
          modelId,
          token: record.token,
          rawKey: record.rawKey,
          status: record.status,
          intensity: record.intensity,
          confidence: record.confidence,
          latencyMs: record.latencyMs,
          budgetMs: record.budgetMs,
          sentence: record.sentence,
        })
        activeRuns.value.push(record)
        return record
      }

      // Budget check: only drop if explicitly requested by caller (e.g. strict synchronous test/timeout).
      // During live chat streaming, timing is owned by the playback queue (heldAutonomousCues in ControlStripHost).
      const enforceBudget = options.enforceBudget ?? toValue(context.enforceBudget) ?? false
      if (enforceBudget && latencyMs > budgetMs) {
        return finishRun({
          sentence: cleanSentence,
          token,
          rawKey: null,
          confidence,
          intensity,
          latencyMs,
          budgetMs,
          status: 'budget-dropped',
        })
      }

      // If System 1 picked 'none', no actuation
      if (token === 'none') {
        return finishRun({
          sentence: cleanSentence,
          token: 'none',
          rawKey: null,
          confidence,
          intensity,
          latencyMs,
          budgetMs,
          status: 'none',
        })
      }

      // Resolve base token to specific variant from variant pool (entropy without classifier confusion)
      let selectedVariant = token
      const variants = variantMap.get(token)
      if (variants && variants.length > 0) {
        const randIdx = Math.floor(Math.random() * variants.length)
        selectedVariant = variants[randIdx]
      }

      // Resolve token to physical rig rawKey
      const resolved = resolveCueToken(selectedVariant, {
        allowlist,
        capabilities: [...caps, ...motionCaps],
      })

      if (!resolved?.rawKey) {
        return finishRun({
          sentence: cleanSentence,
          token: selectedVariant,
          rawKey: null,
          confidence,
          intensity,
          latencyMs,
          budgetMs,
          status: 'unmapped',
        })
      }

      // Trigger actuation (evaporates: in-memory callback only, never persisted)
      const meta: AutonomousCueMeta = {
        token: selectedVariant,
        rawKey: resolved.rawKey,
        sentence: cleanSentence,
        confidence,
        intensity,
        latencyMs,
        budgetMs,
        provenance: 'autonomous_system_one',
      }

      context.actuateEmotion?.(resolved.rawKey, meta)

      return finishRun({
        sentence: cleanSentence,
        token: selectedVariant,
        rawKey: resolved.rawKey,
        confidence,
        intensity,
        latencyMs,
        budgetMs,
        status: 'fired',
      })
    }
    catch (err: any) {
      const latencyMs = Math.round(performance.now() - t0)
      const errorRecord: AutonomousCueRunRecord = {
        sentence: cleanSentence,
        token: '',
        rawKey: null,
        confidence: 0,
        latencyMs,
        budgetMs,
        status: 'error',
        error: err?.message || String(err),
      }
      console.log('[AutonomousCues] Classifier result:', {
        actorId,
        modelId,
        token: '',
        rawKey: null,
        status: 'error',
        error: errorRecord.error,
        latencyMs,
        budgetMs,
        sentence: cleanSentence,
      })
      activeRuns.value.push(errorRecord)
      return errorRecord
    }
    finally {
      isEvaluating.value = false
    }
  }

  /**
   * Ingests a streaming text delta, evaluates completed sentences, and yields results.
   */
  async function feedDelta(delta: string): Promise<AutonomousCueRunRecord[]> {
    const sentences = strideBuffer.feed(delta)
    const records: AutonomousCueRunRecord[] = []
    for (const sentence of sentences) {
      records.push(await evaluateSentenceStride(sentence))
    }
    return records
  }

  /**
   * Flushes any remaining incomplete sentence fragment at stream completion.
   */
  async function flush(): Promise<AutonomousCueRunRecord[]> {
    const sentences = strideBuffer.flush()
    const records: AutonomousCueRunRecord[] = []
    for (const sentence of sentences) {
      records.push(await evaluateSentenceStride(sentence))
    }
    return records
  }

  function reset() {
    strideBuffer.reset()
    activeRuns.value = []
    isEvaluating.value = false
    explicitActPending = false
  }

  return {
    strideBuffer,
    activeRuns,
    isEvaluating,
    feedDelta,
    flush,
    reset,
    markExplicitActSeen,
    evaluateSentenceStride,
  }
}
