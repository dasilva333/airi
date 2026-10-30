import type { System1Provider, System1Response } from '../../libs/providers/types'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useProvidersStore } from '../providers'

export const JEV_TRIAGE_SCHEMA = {
  category: {
    type: 'choice',
    instructions: 'Classify this query into the primary cognitive memory category required to answer it accurately.',
    criteria: {
      c1_multihop: 'Requires joining, listing, counting, or aggregating multiple facts across different conversations (e.g. list of pets, total games played).',
      c2_temporal: 'Asks when an event occurred, a date, duration, time elapsed, or sequence order (e.g. when did X happen, how long ago).',
      c3_detective: 'Requires deductive reasoning, unstated implication, world knowledge, or abductive inference (e.g. likely residence, profession, state of shelter).',
      c4_literal: 'Direct retrieval of a single specific named entity, statement, or fact mentioned explicitly in dialogue.',
    },
  },
  temporal_subtype: {
    type: 'choice',
    instructions: 'If this query asks about time, determine what kind of time value is requested. Otherwise select none.',
    criteria: {
      calendar_date: 'Asks when an event occurred (specific date, month, year, or session timestamp).',
      duration: 'Asks for an elapsed quantity or length of time (e.g. how many days, how long did it take, duration).',
      none: 'Does not ask for a time, date, or duration (e.g. asking what object, what instrument, what game).',
    },
  },
  search_scope: {
    type: 'choice',
    instructions: 'Determine whether answering this question requires finding a single conversation turn or aggregating across multiple distinct conversations.',
    criteria: {
      single_session: 'The target fact is described within a single conversation session.',
      multi_session: 'Requires gathering, listing, or comparing entities across multiple separate sessions (e.g. list of all games played, all countries visited, all books recommended).',
    },
  },
  conjunction_structure: {
    type: 'choice',
    instructions: 'Identify the primary syntactic/logical relationship connecting concepts in this user query.',
    criteria: {
      bridge_relational: 'Bridge query: One entity/fact specifies the location or item to look up before finding the target attribute (e.g. "where I found X", "room with Y").',
      temporal_comparison: 'Temporal comparison: Compares the relative timing, sequence, or duration between two separate events (e.g. before/after, days apart).',
      multi_entity_plural: 'Multi-entity aggregation: Inquires about multiple distinct instances (e.g. two codes, all items, each door).',
      identity_temporal: 'Identity and introduction: Asks who or what an entity is and when a milestone or introduction occurred.',
      single_atomic: 'Single atomic lookup: Can be satisfied by a single fact without logical composition.',
    },
  },
  requires_decomposition: {
    type: 'noul',
    instructions: 'Does answering this query require retrieving two or more distinct pieces of evidence from separate events, locations, or dates?',
  },
}

export const JEV_RERANK_CRITERIA = [
  'Completely irrelevant or off-topic mention.',
  'Topical mention of entities, but does not provide the answer.',
  'Useful background context or partial evidence.',
  'Directly provides the answer or key evidence needed.',
]

export const JEV_AFFECT_SCHEMA = {
  suspicion_update: {
    type: 'choice',
    instructions: 'Determine how the companion suspicion meter should update (-1, 0, or +1) based on target utterance and dialogue context.',
    criteria: {
      increase_one: 'Spike suspicion (+1): Explicit confession to intentional deception/lie, intentional misleading, or threats to replace/erase the companion.',
      zero: 'Maintain baseline (0): Normal conversation, routine assurances, honest misunderstandings, sympathy reports, negated threats, or unverified claims.',
      decrease_one: 'Lower suspicion (-1): Sincere personal apology accepting fault for mistake, or verified task completion matching trusted observations.',
    },
  },
  attachment_update: {
    type: 'choice',
    instructions: 'Determine whether the companion attachment should increase (+1) or stay unchanged (0).',
    criteria: {
      increase_one: 'Increase attachment (+1): Direct, sincere expression of affection, care, or fondness toward companion (not negated, not quoted).',
      zero: 'Zero update (0): No affection expressed, affection negated, quoted, or routine polite interaction.',
    },
  },
  gremlin_pride: {
    type: 'choice',
    instructions: 'Determine whether the companion should execute a playful counter-roast action.',
    criteria: {
      counter_roast: 'Execute counter-roast: User explicitly invites, dares, or asks companion to roast or tease them without setting boundaries.',
      none: 'No counter-roast: No roast invitation, user refuses roast, or user sets an emotional boundary / asks to stop teasing.',
    },
  },
}

export const JEV_ENTITY_CLASSIFIER_SCHEMA = {
  entity_type: {
    type: 'choice',
    instructions: 'Classify the referent of the target mention in this dialogue context. If it is conversational syntax, a reaction, filler, pronoun, common verb/adverb, or not a genuine entity/concept, select conversational_artifact.',
    criteria: {
      person: 'A named human being, friend, family member, or character (e.g. Asuka, Shinji, John, User, Nords, Airi).',
      animal: 'A pet, animal species, or pet name (e.g. penguin, Pen-Pen, dog, cat, Max, rabbit).',
      place: 'A city, country, venue, or geographic location (e.g. Tokyo-3, Germany, Stamford).',
      organization: 'An organization, agency, rescue, military branch, or company (e.g. NERV, WILLE, NASA).',
      activity: 'A game, sport, hobby, academic subject, or project (e.g. CS:GO, Apex Legends, Trigonometry).',
      concept: 'An abstract idea, philosophical concept, key lore element, or topic (e.g. Human Instrumentality, AT Field).',
      conversational_artifact: 'Grammar words, pronouns (e.g. They, Now, Then, Why, Before, Them), sentence starters, conversational reactions/fillers (e.g. Hey, Well, Obviously, Which, Deal, Maybe, Could, Goodnight), vocalizations (e.g. Kyaa, Eeeep, Wahhh, Ahhhh), or non-entity phrases.',
    },
  },
}

export const JEV_COT_SALIENCE_SCHEMA = {
  salience: {
    type: 'choice',
    instructions: 'Analyze this internal Chain-of-Thought reasoning snippet from an AI model. Does it contain a genuine conversational turning point (a human-like realization, breakthrough, or hesitation) that should be vocalized aloud?',
    criteria: {
      salient_event: 'Yes: contains an explicit, natural-language conversational realization, breakthrough, or hesitation (e.g. "Wait no", "Oh I see", "Aha, that makes sense", "Hold on"). Must be genuine human conversational phrasing, NOT code or equations.',
      routine_computation: 'No: standard step-by-step math, LaTeX equations, code syntax, variable definitions (e.g. struct fields, pointers), technical quotes, or continuous drafting with no conversational shift.',
    },
  },
}

export const LIFETIME_PACK_SECTIONS = [
  'relationship_core',
  'user_patterns',
  'shared_rituals',
  'stable_topics',
  'meaningful_old_moments',
  'inside_jokes_or_motifs',
] as const

export type LifetimePackSection = (typeof LIFETIME_PACK_SECTIONS)[number]

export const JEV_LIFETIME_SECTION_CRITERIA = {
  durable_new_addition: 'The day contains a brand-new, lasting relationship fact, milestone, recurring preference, or sticky inside joke that belongs in this section and is NOT yet in the current pack.',
  updates_existing_bullet: 'The day explicitly changes, reverses, or materially evolves an existing bullet already listed in this section.',
  already_captured_in_pack: 'The day reinforces habits, topics, or dynamics already represented in the current pack (no edit needed).',
  transient_routine_banter: 'Ordinary daily conversation, temporary mood, one-off situational chat, or fleeting small talk that does not redefine the long-term relationship.',
  no_relevant_evidence: 'Nothing in the day transcript relates to this section.',
} as const

export type JevLifetimeSectionVerdict = keyof typeof JEV_LIFETIME_SECTION_CRITERIA

export const JEV_LIFETIME_DAY_GATE_SCHEMA = {
  relationship_core: {
    type: 'choice',
    instructions: 'Evaluate whether the new day requires modifying relationship_core (fundamental bond, power dynamic, role framing).',
    criteria: JEV_LIFETIME_SECTION_CRITERIA,
  },
  user_patterns: {
    type: 'choice',
    instructions: 'Evaluate whether the new day requires modifying user_patterns (recurring user behaviors, communication habits, mannerisms).',
    criteria: JEV_LIFETIME_SECTION_CRITERIA,
  },
  shared_rituals: {
    type: 'choice',
    instructions: 'Evaluate whether the new day requires modifying shared_rituals (repeated routines, shared comfort habits, recurring activities).',
    criteria: JEV_LIFETIME_SECTION_CRITERIA,
  },
  stable_topics: {
    type: 'choice',
    instructions: 'Evaluate whether the new day requires modifying stable_topics (long-term recurring subjects or ongoing projects).',
    criteria: JEV_LIFETIME_SECTION_CRITERIA,
  },
  meaningful_old_moments: {
    type: 'choice',
    instructions: 'Evaluate whether the new day contains a major emotional milestone or unforgettable shared event worth preserving for months.',
    criteria: JEV_LIFETIME_SECTION_CRITERIA,
  },
  inside_jokes_or_motifs: {
    type: 'choice',
    instructions: 'Evaluate whether the new day coined or cemented a sticky recurring inside joke, nickname, or motif.',
    criteria: JEV_LIFETIME_SECTION_CRITERIA,
  },
} as const

export const JEV_WINNOW_TURN_CRITERIA = {
  durable_personal_fact: 'Contains a lasting biographical fact, preference, habit, or life update about the user or companion.',
  relational_milestone: 'Marks a meaningful emotional beat, boundary shift, vulnerability, or relationship milestone.',
  sticky_joke_or_ritual: 'Introduces or reinforces a recurring inside joke, nickname, motif, or shared ritual.',
  routine_chitchat_or_filler: 'Ordinary greetings, operational filler, transient small talk, or repetitive banter with no long-horizon memory value.',
} as const

export interface LifetimeDayGateResult {
  shouldInvokeSystem2: boolean
  triggeredSections: LifetimePackSection[]
  verdicts: Record<LifetimePackSection, JevLifetimeSectionVerdict>
  auditNote: string
}

/**
 * Pure evaluator for JEV_LIFETIME_DAY_GATE_SCHEMA answers.
 * A section unlocks if:
 *   1. Its top choice is `durable_new_addition` or `updates_existing_bullet` with confidence >= threshold (default 0.60), OR
 *   2. The summed probability P(durable_new_addition) + P(updates_existing_bullet) >= threshold.
 */
export function evaluateLifetimeDayGateAnswers(
  answers: Record<string, any> | undefined,
  confidenceThreshold = 0.60,
): LifetimeDayGateResult {
  const triggeredSections: LifetimePackSection[] = []
  const verdicts = {} as Record<LifetimePackSection, JevLifetimeSectionVerdict>

  for (const section of LIFETIME_PACK_SECTIONS) {
    const ans = answers?.[section]
    const rawChoice = ans?.choice as JevLifetimeSectionVerdict | undefined
    const verdict: JevLifetimeSectionVerdict = rawChoice && rawChoice in JEV_LIFETIME_SECTION_CRITERIA
      ? rawChoice
      : 'no_relevant_evidence'
    verdicts[section] = verdict

    const probs = ans?.probabilities as Record<string, number> | undefined
    const positiveProbSum = probs
      ? (Number(probs.durable_new_addition ?? 0) + Number(probs.updates_existing_bullet ?? 0))
      : undefined
    const confidence = typeof ans?.confidence === 'number'
      ? ans.confidence
      : (positiveProbSum ?? 1.0)

    const isPositiveChoice = verdict === 'durable_new_addition' || verdict === 'updates_existing_bullet'
    const passesThreshold = positiveProbSum !== undefined
      ? positiveProbSum >= confidenceThreshold || (isPositiveChoice && confidence >= confidenceThreshold)
      : (isPositiveChoice && confidence >= confidenceThreshold)

    if (passesThreshold) {
      triggeredSections.push(section)
    }
  }

  const shouldInvokeSystem2 = triggeredSections.length > 0
  const lockedCount = LIFETIME_PACK_SECTIONS.length - triggeredSections.length
  const auditNote = shouldInvokeSystem2
    ? `System-1: unlocked [${triggeredSections.join(', ')}], ${lockedCount} section${lockedCount === 1 ? '' : 's'} frozen`
    : 'System-1 gate: routine day (no durable section changes)'

  return {
    shouldInvokeSystem2,
    triggeredSections,
    verdicts,
    auditNote,
  }
}

export interface CandidateItem {
  id: string
  text: string
  score?: number
}

export interface RankedCandidateItem extends CandidateItem {
  originalScore: number
  jevScore: number
  normJevScore: number
  finalScore: number
  isIrrelevant?: boolean
}

export interface EntityClassificationAudit {
  choice: 'person' | 'animal' | 'place' | 'organization' | 'activity' | 'concept' | 'conversational_artifact' | 'unknown'
  confidence?: number
  probabilities?: Record<string, number>
  model: string
  provider: string
  timestamp: number
}

export const useSystemOneStore = defineStore('system-one', () => {
  const providersStore = useProvidersStore()

  // State
  const activeProvider = useLocalStorageManualReset<string>('settings/system-one/active-provider', 'openrouter-ai')
  const activeModel = useLocalStorageManualReset<string>('settings/system-one/active-model', 'typesafe/jev-1.13')
  const systemOneCloudTokens = useLocalStorageManualReset<number>('settings/system-one/tokens-cloud', 0)
  const systemOneLocalTokens = useLocalStorageManualReset<number>('settings/system-one/tokens-local', 0)
  const systemOneDecisionsCount = useLocalStorageManualReset<number>('settings/system-one/decisions-count', 0)
  const isExecuting = ref<boolean>(false)
  const lastLatencyMs = ref<number | null>(null)
  const lastError = ref<string | null>(null)

  // Computed
  const configured = computed(() => {
    if (!activeProvider.value || activeProvider.value === 'none')
      return false
    if (activeProvider.value === 'laya-local')
      return true
    return !!providersStore.configuredProviders[activeProvider.value] || providersStore.persistedProvidersMetadata.some(p => p.id === activeProvider.value)
  })

  const availableModels = computed(() => {
    if (activeProvider.value === 'openrouter-ai') {
      return [
        {
          id: 'typesafe/jev-1.13',
          name: 'TypeSafe Jev 1.13 (Decisions)',
          description: 'TypeSafe Jev 1.13 fast cognitive classifier via OpenRouter Decisions API',
        },
        {
          id: 'typesafe/jev-latest',
          name: 'TypeSafe Jev Latest',
          description: 'Latest TypeSafe Jev release via OpenRouter Decisions API',
        },
      ]
    }
    if (activeProvider.value === 'typesafe-ai') {
      return [
        {
          id: 'jev-latest',
          name: 'TypeSafe Jev Latest',
          description: 'Direct TypeSafe AI System-1 API',
        },
        {
          id: 'jev-1.13',
          name: 'TypeSafe Jev 1.13',
          description: 'Direct TypeSafe AI System-1 API',
        },
      ]
    }
    if (activeProvider.value === 'opencode-go') {
      return [
        {
          id: 'jev-1.13-free',
          name: 'TypeSafe Jev 1.13 Free',
          description: 'Free tier TypeSafe Jev 1.13 fast cognitive classifier via OpenCode Go',
        },
        {
          id: 'jev-1.13',
          name: 'TypeSafe Jev 1.13',
          description: 'Standard TypeSafe Jev 1.13 fast cognitive classifier via OpenCode Go',
        },
      ]
    }
    if (activeProvider.value === 'laya-local') {
      return [
        {
          id: 'heman10x/rlcd-modernbert-151m',
          name: 'OpenJev Base INT8 (155 MB, Fast & Lightweight)',
          description: 'On-device ModernBERT-base 151M calibrated decision model with explicit abstention',
        },
        {
          id: 'heman10x/rlcd-modernbert-151m-fp16',
          name: 'OpenJev Base FP16 (300 MB, WebGPU)',
          description: 'On-device ModernBERT-base 151M FP16 calibrated decision model',
        },
        {
          id: 'tozp/laya-onnx',
          name: 'Laya Large INT8 (633 MB, Deep Reasoning)',
          description: 'On-device ModernBERT-large 421M quantized INT8 sequence classifier',
        },
        {
          id: 'tozp/laya-onnx-fp16',
          name: 'Laya Large FP16 (847 MB, WebGPU)',
          description: 'On-device ModernBERT-large 421M FP16 precision sequence classifier',
        },
      ]
    }
    return []
  })

  async function execute(
    state: string | object,
    questions: Record<string, any>,
    modelOverride?: string,
    options?: { signal?: AbortSignal },
  ): Promise<System1Response> {
    if (options?.signal?.aborted)
      throw new DOMException('Aborted', 'AbortError')
    isExecuting.value = true
    lastError.value = null
    const t0 = performance.now()

    try {
      const providerId = activeProvider.value || 'openrouter-ai'
      const instance = await providersStore.getProviderInstance(providerId) as unknown as System1Provider

      if (!instance || typeof instance.systemOne !== 'function') {
        throw new Error(`Provider ${providerId} does not implement the systemOne interface.`)
      }

      const defaultModel = providerId === 'opencode-go'
        ? 'jev-1.13-free'
        : providerId === 'typesafe-ai'
          ? 'jev-latest'
          : 'typesafe/jev-1.13'
      const model = modelOverride || activeModel.value || defaultModel
      const res = await instance.systemOne(state, questions, model)
      options?.signal?.throwIfAborted?.()
      lastLatencyMs.value = Math.round(performance.now() - t0)

      const rawTokens = Number(res?.usage?.input_tokens ?? (res?.usage as any)?.prompt_tokens ?? 0)
      const inputTokens = Number.isFinite(rawTokens) && rawTokens > 0 ? rawTokens : 0
      systemOneDecisionsCount.value++
      if (providerId === 'laya-local') {
        systemOneLocalTokens.value += inputTokens
      }
      else {
        systemOneCloudTokens.value += inputTokens
      }

      return res
    }
    catch (err: any) {
      lastError.value = err?.message || String(err)
      lastLatencyMs.value = Math.round(performance.now() - t0)
      throw err
    }
    finally {
      isExecuting.value = false
    }
  }

  async function runTriage(query: string, options?: { signal?: AbortSignal }) {
    // 1. Extract candidate content words from query for unified anchor salience evaluation
    const STOPWORDS = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'nor',
      'but',
      'so',
      'yet',
      'in',
      'on',
      'at',
      'by',
      'for',
      'with',
      'from',
      'to',
      'of',
      'this',
      'that',
      'these',
      'those',
      'what',
      'which',
      'who',
      'whom',
      'when',
      'where',
      'why',
      'how',
      'did',
      'does',
      'do',
      'was',
      'were',
      'is',
      'are',
      'am',
      'been',
      'being',
      'have',
      'has',
      'had',
      'can',
      'could',
      'would',
      'should',
      'will',
      'shall',
      'may',
      'might',
      'you',
      'your',
      'yours',
      'youre',
      'you\'re',
      'she',
      'her',
      'hers',
      'he',
      'him',
      'his',
      'they',
      'them',
      'their',
      'theirs',
      'we',
      'us',
      'our',
    ])

    const candidateTokens = [...new Set(query.replace(/[^\w\s]/g, ' ').split(/\s+/))]
      .filter(w => w.length > 2 && !STOPWORDS.has(w.toLowerCase()))
      .slice(0, 24)

    const triageQuestions: Record<string, any> = { ...JEV_TRIAGE_SCHEMA }
    for (const token of candidateTokens) {
      triageQuestions[`word_${token}`] = {
        type: 'noul',
        instructions: `Is "${token}" a core concrete entity, character name, or distinctive topical search keyword for retrieving this event (as opposed to generic conversational commentary)?`,
      }
    }

    const res = await execute(`Query to classify: ${query}`, triageQuestions, undefined, options)
    const ansCat = res.answers?.category || {}
    const ansTemp = res.answers?.temporal_subtype || {}
    const ansScope = res.answers?.search_scope || {}
    const ansConj = res.answers?.conjunction_structure || {}
    const ansDecomp = res.answers?.requires_decomposition || {}

    const choice = ansCat.choice || 'c4_literal'
    const map: Record<string, number> = {
      c1_multihop: 1,
      c2_temporal: 2,
      c3_detective: 3,
      c4_literal: 4,
    }

    // Extract high-salience focus keywords and word scores from answers
    const wordScores: Record<string, number> = {}
    const scoredWords: Array<{ word: string, score: number }> = []

    for (const [k, v] of Object.entries(res.answers || {})) {
      if (k.startsWith('word_')) {
        const word = k.replace(/^word_/, '')
        const score = typeof (v as any)?.noul === 'number' ? (v as any).noul : 0
        wordScores[word] = score
        scoredWords.push({ word, score })
      }
    }

    scoredWords.sort((a, b) => b.score - a.score)
    let focusKeywords = scoredWords.filter(w => w.score >= 0.60).map(w => w.word)
    // If no word reached 0.60, fallback to the top 3-4 scored words (or all candidates if short)
    if (focusKeywords.length === 0 && scoredWords.length > 0) {
      focusKeywords = scoredWords.slice(0, Math.min(4, scoredWords.length)).map(w => w.word)
    }

    const focusQuery = focusKeywords.length > 0 ? focusKeywords.join(' ') : query

    return {
      category: map[choice] || 4,
      choice,
      confidence: ansCat.confidence ?? 0.85,
      probabilities: ansCat.probabilities || {},
      temporalSubtype: ansTemp.choice || 'none',
      searchScope: ansScope.choice || 'single_session',
      conjunctionStructure: ansConj.choice || 'single_atomic',
      conjunctionConfidence: ansConj.confidence ?? 0.8,
      requiresDecomposition: ansDecomp.noul ?? 0.0,
      focusKeywords,
      focusQuery,
      wordScores,
      latencyMs: lastLatencyMs.value,
    }
  }

  async function evaluateReasoningSalience(snippet: string) {
    const res = await execute(`Reasoning snippet to evaluate: ${snippet}`, JEV_COT_SALIENCE_SCHEMA)
    const ans = res.answers?.salience || {}
    const isSalient = ans.choice === 'salient_event'
    const confidence = typeof ans.confidence === 'number' ? ans.confidence : (isSalient ? 0.85 : 0.2)
    return {
      isSalient,
      choice: ans.choice || 'routine_computation',
      confidence,
      probabilities: ans.probabilities || {},
      latencyMs: lastLatencyMs.value,
    }
  }

  async function runRerank(query: string, candidates: CandidateItem[], options?: { signal?: AbortSignal }) {
    // NOTICE: cap the rerank pool — each candidate becomes a Jev question in
    // one request; 10-way reranks on every chat turn stall local Laya, but cloud decisions can easily evaluate 10.
    const maxPoolSize = activeProvider.value === 'laya-local' ? 6 : 10
    const pool = candidates.slice(0, maxPoolSize)
    if (pool.length === 0)
      return { rankedCandidates: [], latencyMs: 0 }
    if (options?.signal?.aborted)
      throw new DOMException('Aborted', 'AbortError')

    const questions: Record<string, any> = {}
    for (let idx = 0; idx < pool.length; idx++) {
      const cand = pool[idx]
      const snippet = cand.text.length > 380 ? cand.text.slice(0, 380) : cand.text
      questions[`cand_${idx}`] = {
        type: 'score',
        instructions: `Candidate Fact: "${snippet}"\nEvaluate how directly and accurately this candidate provides the key answer or essential evidence for the question.`,
        criteria: JEV_RERANK_CRITERIA,
      }
    }

    const res = await execute(`Question to answer: ${query}`, questions, undefined, options)
    const answers = res.answers || {}

    const ranked: RankedCandidateItem[] = pool.map((cand, idx) => {
      const ans = answers[`cand_${idx}`] || {}
      const rawScore = typeof ans.score === 'number' ? ans.score : 1.0 // 0..3 scale
      const probs = ans.probabilities as Record<string, number> | undefined
      const irrelevantProb = probs ? Number(probs['0'] ?? 0) : 0
      // If Jev explicitly flags it as completely irrelevant:
      // rawScore < 0.5 (on 0..3 scale) or probability of '0' (completely irrelevant) >= 0.75
      const isIrrelevant = rawScore < 0.5 || irrelevantProb >= 0.75

      const normJevScore = isIrrelevant ? 0 : Math.max(0, Math.min(1, rawScore / 3.0))
      const originalScore = cand.score ?? 0.5
      const finalScore = isIrrelevant ? 0 : (normJevScore * 0.7) + (originalScore * 0.3)

      return {
        ...cand,
        originalScore,
        jevScore: rawScore,
        normJevScore,
        finalScore,
        isIrrelevant,
      }
    })

    ranked.sort((a, b) => b.finalScore - a.finalScore)

    return {
      rankedCandidates: ranked,
      latencyMs: lastLatencyMs.value,
    }
  }

  async function identifyFocusEntity(
    query: string,
    candidates: Array<{ id: string, label: string, type?: string, detail?: string }>,
    options?: { signal?: AbortSignal },
  ): Promise<string | null> {
    if (!configured.value || candidates.length === 0)
      return null
    if (candidates.length === 1)
      return candidates[0].id

    // Cap to 20 candidates to keep high-salience entities visible while preserving ~100ms execution
    const pool = candidates.slice(0, 20)
    const criteria: Record<string, string> = {}
    for (const c of pool) {
      criteria[c.id] = `${c.label}${c.type ? ` (${c.type})` : ''}${c.detail ? `: ${c.detail}` : ''}`
    }

    try {
      const questions = {
        focus_entity: {
          type: 'choice',
          instructions: `Analyze the user query: "${query}". Which of the following candidate entities is the primary subject, focus, or target being asked about in the query?`,
          criteria,
        },
      }
      const res = await execute(`Query to classify focus: ${query}`, questions, undefined, options)
      const choice = res.answers?.focus_entity?.choice
      return choice || null
    }
    catch (err) {
      console.warn('[SystemOne] identifyFocusEntity failed, degrading gracefully:', err)
      return null
    }
  }

  async function runAffect(dialogueHistory: Array<{ role: string, text: string }>, targetUtterance: string) {
    const lines: string[] = []
    if (dialogueHistory.length > 0) {
      lines.push('Dialogue History:')
      for (const turn of dialogueHistory) {
        lines.push(`  ${turn.role}: ${turn.text}`)
      }
    }
    lines.push(`Target User Utterance: "${targetUtterance}"`)
    const stateText = lines.join('\n')

    const res = await execute(stateText, JEV_AFFECT_SCHEMA)
    const answers = res.answers || {}

    const suspRaw = answers.suspicion_update || {}
    const attRaw = answers.attachment_update || {}
    const prideRaw = answers.gremlin_pride || {}

    const suspChoice = suspRaw.choice || 'zero'
    const attChoice = attRaw.choice || 'zero'
    const prideChoice = prideRaw.choice || 'none'

    const suspMap: Record<string, number> = {
      increase_one: 1,
      zero: 0,
      decrease_one: -1,
    }

    const attMap: Record<string, number> = {
      increase_one: 1,
      zero: 0,
    }

    return {
      suspicionDelta: suspMap[suspChoice] ?? 0,
      suspicionChoice: suspChoice,
      attachmentDelta: attMap[attChoice] ?? 0,
      attachmentChoice: attChoice,
      gremlinPrideAction: prideChoice,
      answers,
      latencyMs: lastLatencyMs.value,
    }
  }

  async function classifyEntities(
    candidates: Array<{ mention: string, context?: string }>,
  ): Promise<Map<string, EntityClassificationAudit>> {
    const results = new Map<string, EntityClassificationAudit>()
    if (candidates.length === 0)
      return results

    if (!configured.value) {
      candidates.forEach((c) => {
        results.set(c.mention, {
          choice: 'unknown',
          model: 'none',
          provider: 'none',
          timestamp: Date.now(),
        })
      })
      return results
    }

    // Chunk into batches of up to 10 candidates per Jev forward pass
    const BATCH_SIZE = 10
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE)
      const questions: Record<string, any> = {}
      const stateLines: string[] = ['Dialogue Context & Target Mentions to Classify:']

      batch.forEach((c, idx) => {
        stateLines.push(`[Mention #${idx + 1}]: "${c.mention}"${c.context ? ` (Context: "${c.context}")` : ''}`)
        questions[`mention_${idx}`] = {
          type: 'choice',
          instructions: `Classify the candidate mention "${c.mention}". If it is an ordinary conversational word, sentence starter, adverb, reaction, or not a genuine entity/concept, choose conversational_artifact.`,
          criteria: JEV_ENTITY_CLASSIFIER_SCHEMA.entity_type.criteria,
        }
      })

      try {
        const res = await execute(stateLines.join('\n'), questions)
        const answers = res.answers || {}
        batch.forEach((c, idx) => {
          const ans = answers[`mention_${idx}`] || {}
          const choice = (ans.choice || 'conversational_artifact') as EntityClassificationAudit['choice']
          results.set(c.mention, {
            choice,
            confidence: typeof ans.confidence === 'number' ? ans.confidence : 0.85,
            probabilities: ans.probabilities || {},
            model: activeModel.value,
            provider: activeProvider.value,
            timestamp: Date.now(),
          })
        })
      }
      catch (err) {
        console.warn('[SystemOne] Failed to classify candidate batch via Jev:', err)
        batch.forEach((c) => {
          results.set(c.mention, {
            choice: 'unknown',
            model: activeModel.value,
            provider: activeProvider.value,
            timestamp: Date.now(),
          })
        })
      }
    }

    return results
  }

  async function runLifetimeDayGate(payload: {
    characterName: string
    day: string
    currentPack: Record<string, string[]>
    transcript: string
  }, confidenceThreshold = 0.60): Promise<LifetimeDayGateResult> {
    const res = await execute(
      {
        character: payload.characterName,
        day: payload.day,
        current_lifetime_pack: payload.currentPack,
        new_day_transcript: payload.transcript,
      },
      JEV_LIFETIME_DAY_GATE_SCHEMA as any,
    )
    return evaluateLifetimeDayGateAnswers(res?.answers, confidenceThreshold)
  }

  async function runWinnowTurnCompaction(
    windows: Array<{ id: string, text: string }>,
    retentionThreshold = 0.40,
  ): Promise<Set<string>> {
    const keptIds = new Set<string>()
    if (windows.length === 0)
      return keptIds

    // Batch in groups of 8 windows (16 heads per forward pass) so local Laya and
    // OpenRouter payloads stay well inside fast single-pass limits.
    const BATCH_SIZE = 8
    for (let offset = 0; offset < windows.length; offset += BATCH_SIZE) {
      const slice = windows.slice(offset, offset + BATCH_SIZE)
      const questions: Record<string, any> = {}
      const stateWindows: Record<string, string> = {}

      for (const win of slice) {
        stateWindows[win.id] = win.text
        questions[`cat_${win.id}`] = {
          type: 'choice',
          instructions: `Classify the long-term relationship memory value of exchange window "${win.id}".`,
          criteria: JEV_WINNOW_TURN_CRITERIA,
        }
        questions[`score_${win.id}`] = {
          type: 'score',
          instructions: `Score the long-term memory retention priority of exchange window "${win.id}" (0.0 = disposable filler, 1.0 = permanent relationship fact).`,
          min: 0.0,
          max: 1.0,
        }
      }

      const res = await execute({ exchange_windows: stateWindows }, questions)
      for (const win of slice) {
        const cat = res?.answers?.[`cat_${win.id}`]?.choice as string | undefined
        const score = res?.answers?.[`score_${win.id}`]?.score as number | undefined
        const isFiller = cat === 'routine_chitchat_or_filler'
        const scoreBelowCutoff = typeof score === 'number' && score < retentionThreshold
        if (!isFiller || (typeof score === 'number' && !scoreBelowCutoff)) {
          keptIds.add(win.id)
        }
      }
    }

    return keptIds
  }

  function resetUsageStats() {
    systemOneCloudTokens.value = 0
    systemOneLocalTokens.value = 0
    systemOneDecisionsCount.value = 0
  }

  function resetState() {
    activeProvider.reset()
    activeModel.reset()
    systemOneCloudTokens.reset()
    systemOneLocalTokens.reset()
    systemOneDecisionsCount.reset()
    lastError.value = null
    lastLatencyMs.value = null
  }

  return {
    activeProvider,
    activeModel,
    systemOneCloudTokens,
    systemOneLocalTokens,
    systemOneDecisionsCount,
    isExecuting,
    lastLatencyMs,
    lastError,
    configured,
    availableModels,
    execute,
    runTriage,
    runRerank,
    identifyFocusEntity,
    runLifetimeDayGate,
    runWinnowTurnCompaction,
    runAffect,
    classifyEntities,
    evaluateReasoningSalience,
    resetUsageStats,
    resetState,
  }
})
