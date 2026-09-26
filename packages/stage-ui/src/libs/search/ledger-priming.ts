import type { EntityLedger, EntityType } from './entity-ledger'

import { normalizeCanonicalEntityLabel } from './entity-ledger'

export const CONVERSATIONAL_STOPWORDS = new Set([
  // Pronouns, Demonstratives, Quantifiers
  'they',
  'them',
  'their',
  'theirs',
  'themselves',
  'this',
  'that',
  'these',
  'those',
  'what',
  'which',
  'who',
  'whom',
  'whose',
  'where',
  'when',
  'why',
  'how',
  'someone',
  'somebody',
  'something',
  'anyone',
  'anybody',
  'anything',
  'everyone',
  'everybody',
  'everything',
  'nobody',
  'nothing',
  'some',
  'many',
  'more',
  'most',
  'such',
  'other',
  'another',
  'each',
  'every',
  'both',
  'either',
  'neither',

  // Modals, Auxiliaries, Common Verbs
  'could',
  'would',
  'should',
  'might',
  'must',
  'have',
  'having',
  'been',
  'will',
  'shall',
  'were',
  'does',
  'doing',
  'being',
  'make',
  'making',
  'bring',
  'bringing',

  // Common Conversational Adverbs, Connectives & Starters
  'maybe',
  'perhaps',
  'actually',
  'obviously',
  'definitely',
  'probably',
  'now',
  'then',
  'here',
  'there',
  'before',
  'after',
  'today',
  'tonight',
  'tomorrow',
  'yesterday',
  'again',
  'always',
  'never',
  'sometimes',
  'usually',
  'often',
  'also',
  'very',
  'much',
  'well',
  'just',
  'only',
  'still',
  'even',
  'already',
  'almost',
  'enough',
  'really',
  'anyway',
  'anyways',
  'meanwhile',
  'instead',
  'however',
  'because',
  'since',
  'though',
  'although',

  // Interjections, Onomatopoeia & Conversational Fillers
  'hey',
  'hello',
  'yeah',
  'yep',
  'nope',
  'okay',
  'ok',
  'whoa',
  'wow',
  'kyaa',
  'kyaaa',
  'eeeeep',
  'eeep',
  'wahhh',
  'wahh',
  'ahhh',
  'ahhhh',
  'haha',
  'hahaha',
  'ehehe',
  'oops',
  'phew',
  'gosh',
  'damn',
  'wait',
  'look',
  'listen',
  'please',
  'thanks',
  'thank',
  'sorry',
  'bye',
  'goodnight',
  'goodbye',
])

export function isConversationalArtifactOrNoise(token: string): boolean {
  const norm = token.trim().toLowerCase()
  if (!norm || norm.length <= 2)
    return true
  if (CONVERSATIONAL_STOPWORDS.has(norm))
    return true
  // Single repeated character vocalizations (e.g. "ahhhhh", "eeeeep", "wahhh")
  if (/^([a-z])\1{2,}$/i.test(norm))
    return true
  // Common anime vocalization patterns (e.g. "kyaa+", "ee+p+", "wa+h+", "ah+h*")
  if (/^(?:ah+|eh+|oh+|ha+|e{2,}p+|wa+h+|kya+h*)$/i.test(norm))
    return true
  return false
}

export interface DialogueTurn {
  id: string
  speaker: string
  text: string
  timestamp: number
  sessionDate?: string
}

export interface ExtractedFragments {
  mentions: string[]
  temporal_phrase: string | null
  claims: Array<{
    quote: string
    subject_span?: string
    predicate_span?: string
    object_span?: string
    time_span?: string
    polarity: string
    mode: string
  }>
}

export interface CandidateMentionProposal {
  mention: string
  context: string
}

/**
 * Validates that extracted mentions, temporal phrases, and claims exist as exact substrings in source text.
 * Strictly mirrors the Pass 11 host span validator (scripts/tests/locomo-benchmark/needle-schema.mjs).
 */
export function validateExtractionSpans(targetText: string, extraction: ExtractedFragments): ExtractedFragments {
  const normTarget = targetText.toLowerCase()

  // Validate mentions
  const validMentions: string[] = []
  for (const m of extraction.mentions || []) {
    if (typeof m === 'string' && m.trim().length > 1) {
      const trimmed = m.trim()
      if (normTarget.includes(trimmed.toLowerCase())) {
        validMentions.push(trimmed)
      }
    }
  }

  // Validate temporal phrase
  let validTemporal: string | null = null
  if (typeof extraction.temporal_phrase === 'string') {
    const tp = extraction.temporal_phrase.trim()
    if (tp.length > 0 && normTarget.includes(tp.toLowerCase())) {
      validTemporal = tp
    }
  }

  // Validate claims
  const validClaims: ExtractedFragments['claims'] = []
  for (const c of extraction.claims || []) {
    if (!c || typeof c !== 'object')
      continue
    const quote = typeof c.quote === 'string' ? c.quote.trim() : ''
    if (quote.length > 0 && normTarget.includes(quote.toLowerCase())) {
      const validClaim = {
        quote,
        polarity: ['positive', 'negative', 'unknown'].includes(c.polarity) ? c.polarity : 'positive',
        mode: ['asserted', 'question', 'plan', 'hypothetical', 'quoted', 'fragment', 'unknown'].includes(c.mode)
          ? c.mode
          : 'asserted',
      } as ExtractedFragments['claims'][number]

      if (c.subject_span && normTarget.includes(c.subject_span.trim().toLowerCase())) {
        validClaim.subject_span = c.subject_span.trim()
      }
      if (c.predicate_span && normTarget.includes(c.predicate_span.trim().toLowerCase())) {
        validClaim.predicate_span = c.predicate_span.trim()
      }
      if (c.object_span && normTarget.includes(c.object_span.trim().toLowerCase())) {
        validClaim.object_span = c.object_span.trim()
      }
      if (c.time_span && normTarget.includes(c.time_span.trim().toLowerCase())) {
        validClaim.time_span = c.time_span.trim()
      }
      validClaims.push(validClaim)
    }
  }

  return {
    mentions: validMentions,
    temporal_phrase: validTemporal,
    claims: validClaims,
  }
}

/**
 * Extracts candidate entity spans from raw text without hardcoded word dictionaries.
 * Identifies proper nouns, acronyms, compound names, and entities signaled by contextual syntactic frames.
 */
export function extractFragmentsFromText(text: string): ExtractedFragments {
  const mentions: string[] = []
  const claims: ExtractedFragments['claims'] = []
  let temporal_phrase: string | null = null

  // 1. Semantic / Relative Temporal Expressions
  const timeMatch = text.match(/\b(last week|yesterday|three days ago|a few weeks ago|in April 2022|today|first week of April|last month|tomorrow|the day after)\b/i)
  if (timeMatch) {
    temporal_phrase = timeMatch[0]
  }

  // 2. Syntactic Framing Patterns (e.g. "named Pen-Pen", "pet penguin", "playing CS:GO")
  // Extracts entity nouns dynamically without hardcoding species or titles
  const frameMatches = text.matchAll(/\b(?:named|called|pet|a pet|my pet|playing|play|studying|study|visited|visit)\s+([\w-]+)/gi)
  for (const fm of frameMatches) {
    if (fm[1]) {
      const cleanSpan = fm[1].replace(/^[^\w']+|[^\w']+$/g, '').trim()
      if (cleanSpan.length > 2 && !isConversationalArtifactOrNoise(cleanSpan) && !mentions.includes(cleanSpan)) {
        mentions.push(cleanSpan)
      }
    }
  }

  // 3. Multi-word or Hyphenated Proper Nouns (e.g. "Pen-Pen", "Tokyo-3", "The Witcher 3")
  const compoundMatches = text.matchAll(/\b([A-Z][a-zA-Z0-9]+(?:[- ][A-Z0-9][a-zA-Z0-9]+)+)\b/g)
  for (const cm of compoundMatches) {
    if (cm[1] && !isConversationalArtifactOrNoise(cm[1]) && !mentions.includes(cm[1])) {
      mentions.push(cm[1])
    }
  }

  // 4. All-Caps Acronyms (e.g. "NERV", "WILLE", "SEELE", "NASA", "CS:GO")
  const acronymMatches = text.matchAll(/\b([A-Z]{2,6}(?::[A-Z]{2,4})?)\b/g)
  for (const am of acronymMatches) {
    if (am[1] && am[1] !== 'OK' && !mentions.includes(am[1])) {
      mentions.push(am[1])
    }
  }

  // 5. Word Token Inspection (Preserves Contractions, Filters Out Hash IDs)
  // Identifies mid-sentence and capitalized candidate proper nouns
  const sentences = text.split(/(?<=[.?!])\s+/)
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/)
    for (let i = 0; i < words.length; i++) {
      const w = words[i]
      const clean = w.replace(/^[^\w']+|[^\w']+$/g, '')

      // Reject internal random IDs / hashes
      if (/^[\w-]{16,}$/.test(clean))
        continue

      // Reject single letters or contraction remnants
      if (clean.length <= 2 || /^[a-z]{1,2}$/i.test(clean))
        continue

      // Reject conversational stopwords, function words, and onomatopoeia
      if (isConversationalArtifactOrNoise(clean))
        continue

      // Capitalized candidate
      if (/^[A-Z][\w-]*$/.test(clean)) {
        // If it occurs mid-sentence (i > 0), it's almost certainly a proper noun or named concept!
        if (i > 0) {
          if (!mentions.includes(clean)) {
            mentions.push(clean)
          }
        }
        else {
          // If at the start of sentence, include if clean is longer than 3 chars for System 1 triage
          if (clean.length > 3 && !mentions.includes(clean)) {
            mentions.push(clean)
          }
        }
      }
    }
  }

  return validateExtractionSpans(text, {
    mentions,
    temporal_phrase,
    claims,
  })
}

/**
 * Collects deduplicated candidate entity spans across all dialogue turns and journals.
 * Emits each unique candidate with its surrounding context for zero-shot System 1 evaluation.
 */
export function collectUniqueCandidateMentions(
  turns: Array<{ text: string, speaker: string }>,
  journals?: Array<{ content?: string, title?: string }>,
): CandidateMentionProposal[] {
  const seen = new Set<string>()
  const proposals: CandidateMentionProposal[] = []

  // Collect from turns
  for (const turn of turns) {
    const text = turn.text.trim()
    if (!text)
      continue

    const fragments = extractFragmentsFromText(text)
    for (const m of fragments.mentions) {
      if (isConversationalArtifactOrNoise(m))
        continue

      const resolution = normalizeCanonicalEntityLabel(m)
      const canonicalKey = resolution.normalizedKey || m.toLowerCase()
      if (isConversationalArtifactOrNoise(canonicalKey))
        continue

      if (!seen.has(canonicalKey)) {
        seen.add(canonicalKey)
        proposals.push({
          mention: resolution.canonical || m,
          context: text.length > 180 ? `${text.slice(0, 180)}...` : text,
        })
      }
    }
  }

  // Collect from journals if available
  if (journals) {
    for (const j of journals) {
      const text = `${j.title || ''} ${j.content || ''}`.trim()
      if (!text)
        continue
      const fragments = extractFragmentsFromText(text)
      for (const m of fragments.mentions) {
        if (isConversationalArtifactOrNoise(m))
          continue

        const resolution = normalizeCanonicalEntityLabel(m)
        const canonicalKey = resolution.normalizedKey || m.toLowerCase()
        if (isConversationalArtifactOrNoise(canonicalKey))
          continue

        if (!seen.has(canonicalKey)) {
          seen.add(canonicalKey)
          proposals.push({
            mention: resolution.canonical || m,
            context: text.length > 180 ? `${text.slice(0, 180)}...` : text,
          })
        }
      }
    }
  }

  return proposals
}

/**
 * Ingest turn knowledge into EntityLedger using System 1 classification.
 * If a classificationMap is provided, System 1 choices are strictly obeyed:
 * - 'conversational_artifact' is discarded.
 * - 'person' | 'animal' | 'place' | 'organization' | 'activity' | 'concept' are typed accordingly.
 * - Unknown tokens never pollute 'concept'.
 */
export function extractTurnKnowledge(
  _passage: string,
  turn: DialogueTurn,
  ledger: EntityLedger,
  classificationMap?: Map<string, any>,
): void {
  const text = turn.text.trim()
  if (!text)
    return

  // 1. Record Source
  ledger.addSource({
    turnId: turn.id,
    text: turn.text,
    speaker: turn.speaker,
    timestamp: turn.timestamp,
    sessionDate: turn.sessionDate,
  })

  // 2. Register Speaker as a Person entity
  if (turn.speaker && turn.speaker !== 'Unknown' && !/^[\w-]{16,}$/.test(turn.speaker)) {
    const speakerEnt = ledger.getOrCreateEntity(turn.speaker, 'person')
    ledger.addMention({ span: turn.speaker, turnId: turn.id, entityId: speakerEnt.entityId })
  }

  // 3. Extract Fragments
  const extraction = extractFragmentsFromText(text)

  // 4. Bind Entities strictly via System 1 Classification
  for (const m of extraction.mentions) {
    if (isConversationalArtifactOrNoise(m))
      continue

    const resolution = normalizeCanonicalEntityLabel(m)
    const canonicalKey = resolution.normalizedKey || m.toLowerCase()
    if (isConversationalArtifactOrNoise(canonicalKey))
      continue

    const audit = classificationMap?.get(m)
      || classificationMap?.get(m.toLowerCase())
      || classificationMap?.get(resolution.canonical)
      || classificationMap?.get(canonicalKey)

    const classified = typeof audit === 'object' && audit !== null && 'choice' in audit ? audit.choice : audit

    // If System 1 classified this as conversational noise or syntax, drop it completely!
    if (classified === 'conversational_artifact')
      continue

    let type: EntityType = 'unknown'

    if (classified && classified !== 'unknown') {
      type = classified
    }
    else if (m === turn.speaker || canonicalKey === (turn.speaker || '').toLowerCase() || canonicalKey === 'user') {
      type = 'person'
    }
    else {
      // Unclassified tokens remain unknown; NEVER dump into 'concept'!
      type = 'unknown'
    }

    const attributes: Record<string, any> = {}
    if (typeof audit === 'object' && audit !== null) {
      attributes.systemOne = audit
    }

    const ent = ledger.getOrCreateEntity(m, type, attributes)
    ent.mentions.add(turn.id)
    ledger.addMention({ span: m, turnId: turn.id, entityId: ent.entityId })
  }

  // 5. Ingest Extracted Claims
  for (const c of extraction.claims) {
    ledger.addClaim({
      subject: c.subject_span || turn.speaker,
      predicate: c.predicate_span || 'stated',
      object: c.object_span || c.quote,
      qualifiers: {
        quote: c.quote,
        polarity: c.polarity,
        mode: c.mode,
        time_span: c.time_span,
      },
      evidence: [turn.id],
    })
  }
}
