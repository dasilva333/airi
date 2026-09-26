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
    if (activeProvider.value === 'laya-local') {
      return [
        {
          id: 'tozp/laya-onnx',
          name: 'Laya INT8 (424 MB, Recommended)',
          description: 'On-device ModernBERT quantized INT8 sequence classifier',
        },
        {
          id: 'tozp/laya-onnx-fp16',
          name: 'Laya FP16 (843 MB, Desktop GPU)',
          description: 'On-device ModernBERT FP16 precision sequence classifier',
        },
      ]
    }
    return []
  })

  async function execute(
    state: string | object,
    questions: Record<string, any>,
    modelOverride?: string,
  ): Promise<System1Response> {
    isExecuting.value = true
    lastError.value = null
    const t0 = performance.now()

    try {
      const providerId = activeProvider.value || 'openrouter-ai'
      const instance = await providersStore.getProviderInstance(providerId) as unknown as System1Provider

      if (!instance || typeof instance.systemOne !== 'function') {
        throw new Error(`Provider ${providerId} does not implement the systemOne interface.`)
      }

      const model = modelOverride || activeModel.value || 'typesafe/jev-1.13'
      const res = await instance.systemOne(state, questions, model)
      lastLatencyMs.value = Math.round(performance.now() - t0)
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

  async function runTriage(query: string) {
    const res = await execute(`Query to classify: ${query}`, JEV_TRIAGE_SCHEMA)
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

  async function runRerank(query: string, candidates: CandidateItem[]) {
    const pool = candidates.slice(0, 10)
    if (pool.length === 0)
      return { rankedCandidates: [], latencyMs: 0 }

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

    const res = await execute(`Question to answer: ${query}`, questions)
    const answers = res.answers || {}

    const ranked: RankedCandidateItem[] = pool.map((cand, idx) => {
      const ans = answers[`cand_${idx}`] || {}
      const rawScore = typeof ans.score === 'number' ? ans.score : 1.0 // 0..3 scale
      const normJevScore = Math.max(0, Math.min(1, rawScore / 3.0))
      const originalScore = cand.score ?? 0.5
      const finalScore = (normJevScore * 0.7) + (originalScore * 0.3)

      return {
        ...cand,
        originalScore,
        jevScore: rawScore,
        normJevScore,
        finalScore,
      }
    })

    ranked.sort((a, b) => b.finalScore - a.finalScore)

    return {
      rankedCandidates: ranked,
      latencyMs: lastLatencyMs.value,
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

  function resetState() {
    activeProvider.reset()
    activeModel.reset()
    lastError.value = null
    lastLatencyMs.value = null
  }

  return {
    activeProvider,
    activeModel,
    isExecuting,
    lastLatencyMs,
    lastError,
    configured,
    availableModels,
    execute,
    runTriage,
    runRerank,
    runAffect,
    classifyEntities,
    evaluateReasoningSalience,
    resetState,
  }
})
