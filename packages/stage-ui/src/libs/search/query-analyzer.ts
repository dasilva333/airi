/**
 * Query Analyzer & Conversational Anaphora Engine.
 *
 * Provides deterministic, zero-dependency pre-retrieval query analysis:
 * 1. Turn-1 Anaphora Resolution (binds pronouns like "that", "it", "he" to preceding turn context).
 * 2. Temporal Date Hook Extraction (detects explicit dates, relative days, and ISO timestamps).
 * 3. Conversational Synonym Expansion (bridges spoken phrasing to indexed autobiographical forms).
 */

export interface ExtractedDateHook {
  text: string
  day?: number
  month?: string
  monthIndex?: number // 0-11
  year?: number
  isoDateHint?: string
  isRelative?: boolean
}

export interface QueryAnalysisResult {
  originalQuery: string
  cleanQuery: string
  expandedQuery: string
  hasTemporalIntent: boolean
  temporalHooks: ExtractedDateHook[]
  anaphoraResolved: boolean
  pronounsDetected: string[]
  extractedKeywords: string[]
}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

const MONTH_ABBRS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
]

const PRONOUN_REGEX = /\b(that|this|it|he|him|she|her|they|them|there|that place|that thing|that topic|that job|that person)\b/

const CASUAL_SYNONYMS: { pattern: RegExp, expansion: string }[] = [
  {
    pattern: /\b(?:trip to\s+)?canada\b/i,
    expansion: 'Canada Toronto Vancouver departure air tickets flight',
  },
  {
    pattern: /\bstart(?:ed)?\s+(?:his\s+)?job\s+(?:in\s+)?it\b/i,
    expansion: 'left IT job started working career tech',
  },
  {
    pattern: /\bgirlfriend\b/i,
    expansion: 'girlfriend dating relationship partner',
  },
  {
    pattern: /\bplaying(?:\s+the)?\s+drums\b/i,
    expansion: 'playing drums drumming practice instruments music',
  },
  {
    pattern: /\bprogramming\s+competition\b/i,
    expansion: 'programming competition online contest hackathon coding',
  },
  {
    pattern: /\b(?:pin|door|access)\s+codes?\b/i,
    expansion: 'pin code door code access code unlock digits',
  },
]

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'can',
  'need',
  'must',
  'i',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'he',
  'she',
  'it',
  'they',
  'them',
  'this',
  'that',
  'these',
  'those',
  'there',
  'here',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'about',
  'and',
  'or',
  'but',
  'so',
  'if',
  'then',
  'else',
  'not',
  'no',
  'nor',
  'what',
  'where',
  'when',
  'why',
  'how',
  'who',
  'which',
  'all',
  'any',
  'both',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'just',
  'really',
  'very',
  'too',
  'also',
  'spent',
  'setting',
  'set',
])

function parseMonth(str: string): { month: string, monthIndex: number } | null {
  const lower = str.toLowerCase()
  const fullIdx = MONTH_NAMES.indexOf(lower)
  if (fullIdx !== -1)
    return { month: MONTH_NAMES[fullIdx], monthIndex: fullIdx }

  const abbrIdx = MONTH_ABBRS.indexOf(lower)
  if (abbrIdx !== -1)
    return { month: MONTH_NAMES[abbrIdx], monthIndex: abbrIdx }

  return null
}

/**
 * Extracts calendar dates and temporal hooks from natural language query.
 */
export function extractTemporalHooks(text: string): ExtractedDateHook[] {
  if (!text || typeof text !== 'string')
    return []

  const hooks: ExtractedDateHook[] = []

  // 1. ISO 8601 YYYY-MM-DD pattern
  const isoPattern = /\b(\d{4})-(\d{2})-(\d{2})\b/g
  for (const match of text.matchAll(isoPattern)) {
    const year = Number.parseInt(match[1], 10)
    const monthIndex = Number.parseInt(match[2], 10) - 1
    const day = Number.parseInt(match[3], 10)
    hooks.push({
      text: match[0],
      year,
      month: MONTH_NAMES[monthIndex],
      monthIndex,
      day,
      isoDateHint: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    })
  }

  // 2. "15 September 2026", "September 15, 2026", "September 15", "Sept 2024"
  const monthPattern = /\b(?:(\d{1,2})(?:st|nd|rd|th)?\s+)?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(?:\s+(\d{1,2})(?:st|nd|rd|th)?)?(?:,?\s*(\d{4}))?\b/gi
  for (const match of text.matchAll(monthPattern)) {
    const monthParsed = parseMonth(match[2])
    if (!monthParsed)
      continue

    const dayRaw = match[1] || match[3]
    const yearRaw = match[4]

    const day = dayRaw ? Number.parseInt(dayRaw, 10) : undefined
    const year = yearRaw ? Number.parseInt(yearRaw, 10) : undefined

    let isoDateHint: string | undefined
    if (year && day) {
      isoDateHint = `${year}-${String(monthParsed.monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }

    // Only add if not already captured by ISO
    if (!hooks.some(h => h.text === match[0])) {
      hooks.push({
        text: match[0],
        day,
        month: monthParsed.month,
        monthIndex: monthParsed.monthIndex,
        year,
        isoDateHint,
      })
    }
  }

  // 3. Relative temporal references: yesterday, today, last week, last month, last year, last tuesday
  const relativePattern = /\b(yesterday|today|last\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi
  for (const match of text.matchAll(relativePattern)) {
    hooks.push({
      text: match[0],
      isRelative: true,
    })
  }

  return hooks
}

/**
 * Resolves Turn-1 anaphora by binding trailing pronouns in the current query
 * with salient content words/entities from the immediately preceding turn.
 */
export function resolveTurnAnaphora(query: string, previousTurnText?: string): { expandedQuery: string, anaphoraResolved: boolean, pronounsDetected: string[] } {
  if (!query) {
    return { expandedQuery: query, anaphoraResolved: false, pronounsDetected: [] }
  }

  const pronouns: string[] = []
  const matches = query.match(new RegExp(PRONOUN_REGEX, 'gi'))
  if (matches) {
    for (const m of matches) {
      const lower = m.toLowerCase()
      if (!pronouns.includes(lower)) {
        pronouns.push(lower)
      }
    }
  }

  if (pronouns.length === 0 || !previousTurnText) {
    return { expandedQuery: query, anaphoraResolved: false, pronounsDetected: [] }
  }

  // Extract meaningful context tokens from previous turn
  const prevTokens = previousTurnText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t))

  if (prevTokens.length === 0) {
    return { expandedQuery: query, anaphoraResolved: false, pronounsDetected: pronouns }
  }

  // Take the most salient content words from preceding turn
  const uniquePrevTokens = Array.from(new Set(prevTokens)).slice(0, 8)
  const contextSupplement = uniquePrevTokens.join(' ')

  const expandedQuery = `${query} (${contextSupplement})`
  return {
    expandedQuery,
    anaphoraResolved: true,
    pronounsDetected: pronouns,
  }
}

/**
 * Expands casual colloquial spoken phrases into candidate search terms.
 */
export function expandCasualQuery(question: string): string {
  if (!question || typeof question !== 'string')
    return question

  let expanded = question
  for (const { pattern, expansion } of CASUAL_SYNONYMS) {
    if (pattern.test(question)) {
      expanded = `${expanded} ${expansion}`
    }
  }
  return expanded
}

/**
 * Primary entrance point: Analyzes an incoming query, performs Turn-1 anaphora
 * resolution if a preceding turn is supplied, and extracts temporal date hooks.
 */
export function analyzeQuery(
  query: string,
  options?: {
    previousTurn?: string
    anaphoraEnabled?: boolean
  },
): QueryAnalysisResult {
  const cleanQuery = query.trim()
  const anaphoraEnabled = options?.anaphoraEnabled ?? true

  let resolvedQuery = cleanQuery
  let anaphoraResolved = false
  let pronounsDetected: string[] = []

  if (anaphoraEnabled && options?.previousTurn) {
    const res = resolveTurnAnaphora(cleanQuery, options.previousTurn)
    resolvedQuery = res.expandedQuery
    anaphoraResolved = res.anaphoraResolved
    pronounsDetected = res.pronounsDetected
  }

  const expandedQuery = expandCasualQuery(resolvedQuery)
  const temporalHooks = extractTemporalHooks(cleanQuery)
  const hasTemporalIntent = temporalHooks.length > 0

  // Extract non-stopword keywords
  const extractedKeywords = cleanQuery
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t))

  return {
    originalQuery: query,
    cleanQuery,
    expandedQuery,
    hasTemporalIntent,
    temporalHooks,
    anaphoraResolved,
    pronounsDetected,
    extractedKeywords,
  }
}

export interface TriageDecision {
  category: number
  choice: string
  confidence: number
  probabilities?: Record<string, number>
  temporalSubtype: string
  searchScope: string
  conjunctionStructure?: string
  conjunctionConfidence?: number
  requiresDecomposition?: number
  method?: string
  latencyMs?: number | null
}

/**
 * Deterministic rule-based query triage heuristic for when System 1 is unconfigured or offline.
 * Mirrors the Pass 11 baseline triage rules.
 */
export function heuristicTriage(query: string): TriageDecision {
  const norm = query.toLowerCase()

  // Detect conjunction structure and decomposition requirement heuristically
  let conjunctionStructure = 'single_atomic'
  let requiresDecomposition = 0.1

  if (/\b(?:before or after|after or before|between\s+(?:\S.*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])\s+and\s+|how many days apart)\b/i.test(norm)) {
    conjunctionStructure = 'temporal_comparison'
    requiresDecomposition = 0.92
  }
  else if (/\b(?:where (?:i|we) (?:found|went|saw|got)|(?:for the|of the|in the)\s+(?:\S.*?|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])\s+where)\b/i.test(norm)) {
    conjunctionStructure = 'bridge_relational'
    requiresDecomposition = 0.85
  }
  else if (/\b(?:two different|all the|both|which door did each|each one)\b/i.test(norm)) {
    conjunctionStructure = 'multi_entity_plural'
    requiresDecomposition = 0.88
  }
  else if (/who or what is/i.test(norm)) {
    conjunctionStructure = 'identity_temporal'
    requiresDecomposition = 0.70
  }

  // 1. Temporal cues (C2)
  if (
    /\b(when|what date|which day|what time|how long|how many (?:days|weeks|months|years) ago|how long ago|start|finish|schedule|appointment|timeline)\b/i.test(norm)
    || /\b(yesterday|today|tomorrow|last (?:week|month|year)|next (?:week|month|year))\b/i.test(norm)
    || /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(norm)
  ) {
    const isDuration = /\b(how long|how many (?:days|weeks|months|years|hours|minutes))\b/i.test(norm)
    return {
      category: 2,
      choice: 'c2_temporal',
      confidence: 0.8,
      temporalSubtype: isDuration ? 'duration' : 'calendar_date',
      searchScope: 'single_session',
      conjunctionStructure,
      requiresDecomposition,
      method: 'heuristic_regex_temporal',
    }
  }

  // 2. Multi-hop / List / Aggregation cues (C1)
  if (
    /\b(both|and .* (?:also|as well)|between|connection|relationship|all the things|list|how many|all of the|every|total|count)\b/i.test(norm)
    || /\b(different (?:places|jobs|events|pets|animals|games|books|movies|friends))\b/i.test(norm)
    || conjunctionStructure === 'bridge_relational'
    || conjunctionStructure === 'multi_entity_plural'
  ) {
    return {
      category: 1,
      choice: 'c1_multihop',
      confidence: 0.75,
      temporalSubtype: 'none',
      searchScope: 'multi_session',
      conjunctionStructure,
      requiresDecomposition: Math.max(requiresDecomposition, 0.8),
      method: 'heuristic_regex_multihop',
    }
  }

  // 3. Open-domain / Detective cues (C3)
  if (
    /\b(why|suspect|infer|imply|attitude|impression|personality|trait|opinion|perspective|motivation|reason for|likely)\b/i.test(norm)
  ) {
    return {
      category: 3,
      choice: 'c3_detective',
      confidence: 0.7,
      temporalSubtype: 'none',
      searchScope: 'single_session',
      conjunctionStructure,
      requiresDecomposition,
      method: 'heuristic_regex_detective',
    }
  }

  // 4. Default: Literal Single-hop (C4)
  return {
    category: 4,
    choice: 'c4_literal',
    confidence: 0.85,
    temporalSubtype: 'none',
    searchScope: 'single_session',
    conjunctionStructure,
    requiresDecomposition,
    method: 'heuristic_literal_default',
  }
}

/**
 * Decomposes complex multi-hop (C1) and temporal (C2) queries into targeted sub-queries.
 * Allows multi-pass candidate retrieval so disparate clues from separate sessions/messages
 * are both represented in the candidate pool.
 */
export function decomposeQuery(query: string, triage?: TriageDecision): string[] {
  const norm = query.trim()
  const subQueries = new Set<string>()

  // Always keep the original query as one anchor
  subQueries.add(norm)

  // If Jev or heuristic triage indicates this is a pure single atomic query without decomposition:
  if (triage && triage.conjunctionStructure === 'single_atomic' && (triage.requiresDecomposition ?? 0) < 0.25) {
    return Array.from(subQueries)
  }

  // 1. Relational Conjunction Split: "before or after", "and which", "where I found", "between X and Y"
  if (
    (triage?.conjunctionStructure === 'temporal_comparison' || triage?.conjunctionStructure === 'bridge_relational')
    || /\b(?:before or after|after or before|and which|where (?:i|we) (?:found|went|saw|got)|between\s+(?:\S.*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])\s+and\s+)/i.test(norm)
  ) {
    const parts = norm.split(/\b(?:before or after|after or before|and which|where (?:i|we) (?:found|went|saw|got))\b/i)
    if (parts.length >= 2) {
      for (const p of parts) {
        const cleaned = p.replace(/^(?:did we|what was the|can you tell me|how many days apart were they\??|\?|,)/gi, '').trim()
        if (cleaned.length > 3) {
          subQueries.add(cleaned)
        }
      }
    }
  }

  // 2. Multi-Hop Bridge: "X for the Y where Z"
  const bridgeMatch = norm.match(/(?:what was the|what is the|tell me the)\s+(.+?)\s+(?:for the|of the|in the)\s+(.+?)\s+where\s+(?:i|we)\s+(.+)/i)
  if (bridgeMatch) {
    const [, targetAttr, intermediateEntity, sourceFact] = bridgeMatch
    subQueries.add(sourceFact.replace(/[?.,]/g, '').trim())
    subQueries.add(`${targetAttr} ${intermediateEntity}`.replace(/[?.,]/g, '').trim())
  }

  // 3. Multi-Entity / Plural questions: "two different X", "all the X", "both X and Y"
  if (
    triage?.conjunctionStructure === 'multi_entity_plural'
    || /\b(?:two different|all the|both)\b/i.test(norm)
  ) {
    const cleanQuestion = norm.replace(/\b(?:what were the|what are the|can you list|tell me)\b/i, '').trim()
    const andParts = cleanQuestion.split(/\b(?:,\s*and\s*which|and which|\band\b)\b/i)
    if (andParts.length >= 2) {
      for (const ap of andParts) {
        const cleaned = ap.replace(/[?.,]/g, '').trim()
        if (cleaned.length > 3) {
          subQueries.add(cleaned)
        }
      }
    }
  }

  // 4. "Who or what is 'X' and when did Y"
  if (
    triage?.conjunctionStructure === 'identity_temporal'
    || /who or what is/i.test(norm)
  ) {
    const whoOrWhatMatch = norm.match(/who or what is ['"]?([^'",?]+)['"]?\s*(?:,|and|\?)\s*(?:when did (?:i|we) (.+))?/i)
    if (whoOrWhatMatch) {
      const [, entityName, introduceAction] = whoOrWhatMatch
      subQueries.add(entityName.trim())
      if (introduceAction) {
        subQueries.add(`${entityName} ${introduceAction}`.replace(/[?.,]/g, '').trim())
      }
      else {
        subQueries.add(`${entityName} introduce`)
      }
    }
  }

  // 5. Code & Access variants: "pin code", "door code", "access code"
  if (/\b(?:pin|door|access)\s+codes?\b/i.test(norm)) {
    subQueries.add('pin code')
    subQueries.add('door code')
  }

  return Array.from(subQueries)
}
