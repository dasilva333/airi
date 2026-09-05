import type { PacingPolicyConfig, ThinkingCategory } from '../../types/pacing'

export type SpecificThinkingCategory = Exclude<ThinkingCategory, 'generic'>

export const DEFAULT_CATEGORY_LEXICON: Record<SpecificThinkingCategory, string[]> = {
  analytical: [
    'calculate',
    'calculation',
    'compute',
    'computing',
    'analyze',
    'analysis',
    'logic',
    'logical',
    'math',
    'mathematical',
    'reason',
    'reasoning',
    'deduce',
    'deduction',
    'step',
    'evaluate',
    'evaluation',
    'formula',
    'code',
    'algorithm',
    'system',
    'solve',
    'solution',
    'estimate',
    'optimize',
  ],
  memory: [
    'recall',
    'recalling',
    'remember',
    'remembering',
    'history',
    'past',
    'earlier',
    'previous',
    'yesterday',
    'before',
    'memory',
    'memories',
    'context',
    'remind',
    'forget',
    'recollect',
  ],
  emotional: [
    'feel',
    'feeling',
    'happy',
    'sad',
    'angry',
    'excited',
    'tender',
    'heart',
    'warmth',
    'empathy',
    'sympathetic',
    'affection',
    'worried',
    'grief',
    'joy',
    'fond',
    'anxious',
    'care',
  ],
  uncertain: [
    'maybe',
    'perhaps',
    'unsure',
    'wonder',
    'wondering',
    'hesitate',
    'doubt',
    'confused',
    'confusion',
    'guess',
    'guessing',
    'unclear',
    'possibly',
    'dilemma',
    'ponder',
  ],
}

export const NEGATION_TOKENS = new Set([
  'not',
  'no',
  'never',
  'neither',
  'nor',
  'dont',
  'don\'t',
  'doesnt',
  'doesn\'t',
  'didnt',
  'didn\'t',
  'wont',
  'won\'t',
  'wouldnt',
  'wouldn\'t',
  'cant',
  'can\'t',
  'couldnt',
  'couldn\'t',
  'shouldnt',
  'shouldn\'t',
  'hardly',
  'scarcely',
])

export interface CategoryClassifierOptions {
  categoryThreshold?: number
  maxReasoningChars?: number
  customLexicon?: Partial<Record<SpecificThinkingCategory, string[]>>
}

export interface CategoryScoreDetail {
  positive: number
  negated: number
  net: number
}

export interface ClassificationResult {
  category: ThinkingCategory
  confidence: number
  scores: Record<SpecificThinkingCategory, CategoryScoreDetail>
  matchedTokens: string[]
}

export class BoundedCategoryClassifier {
  private readonly threshold: number
  private readonly maxChars: number
  private readonly lexicon: Record<SpecificThinkingCategory, Set<string>>
  private buffer = ''

  constructor(options?: CategoryClassifierOptions | PacingPolicyConfig) {
    this.threshold = options && 'categoryThreshold' in options && options.categoryThreshold !== undefined
      ? Math.max(1, options.categoryThreshold)
      : 1
    this.maxChars = options && 'maxReasoningChars' in options && options.maxReasoningChars !== undefined
      ? options.maxReasoningChars
      : 1024

    const customLex = options && 'customLexicon' in options ? options.customLexicon : undefined

    this.lexicon = {
      analytical: new Set([...DEFAULT_CATEGORY_LEXICON.analytical, ...(customLex?.analytical || [])]),
      memory: new Set([...DEFAULT_CATEGORY_LEXICON.memory, ...(customLex?.memory || [])]),
      emotional: new Set([...DEFAULT_CATEGORY_LEXICON.emotional, ...(customLex?.emotional || [])]),
      uncertain: new Set([...DEFAULT_CATEGORY_LEXICON.uncertain, ...(customLex?.uncertain || [])]),
    }
  }

  /**
   * Consumes an incremental reasoning chunk and returns the current classification result.
   * Trailing non-delimiter characters are held in a pending buffer to ensure chunk-split safety.
   */
  public consume(chunk: string): ClassificationResult {
    if (!chunk)
      return this.evaluate(false)

    this.buffer += chunk
    if (this.buffer.length > this.maxChars) {
      this.buffer = this.buffer.slice(-this.maxChars)
    }

    return this.evaluate(false)
  }

  /**
   * Evaluates all text in the buffer including any trailing partial token (e.g. at window deadline).
   */
  public flush(): ClassificationResult {
    return this.evaluate(true)
  }

  /**
   * Resets the classifier internal buffer.
   */
  public reset(): void {
    this.buffer = ''
  }

  /**
   * Evaluates the buffer and produces the current classification result.
   * @param includeTrailing Whether to include the trailing token when there is no trailing delimiter.
   */
  private evaluate(includeTrailing: boolean): ClassificationResult {
    const scores: Record<SpecificThinkingCategory, CategoryScoreDetail> = {
      analytical: { positive: 0, negated: 0, net: 0 },
      memory: { positive: 0, negated: 0, net: 0 },
      emotional: { positive: 0, negated: 0, net: 0 },
      uncertain: { positive: 0, negated: 0, net: 0 },
    }

    if (!this.buffer.trim()) {
      return {
        category: 'generic',
        confidence: 0,
        scores,
        matchedTokens: [],
      }
    }

    let textToEvaluate = this.buffer

    // If not including trailing token, hold characters after the last delimiter
    if (!includeTrailing) {
      // Find the last delimiter (whitespace or punctuation)
      const lastDelimiterMatch = this.buffer.match(/[\s\p{P}][^\s\p{P}]*$/u)
      if (lastDelimiterMatch && lastDelimiterMatch.index !== undefined) {
        textToEvaluate = this.buffer.slice(0, lastDelimiterMatch.index + 1)
      }
      else {
        // No delimiter found yet; text might be a partial token mid-stream
        return {
          category: 'generic',
          confidence: 0,
          scores,
          matchedTokens: [],
        }
      }
    }

    // Tokenize unicode-aware words, preserving internal apostrophes (e.g. "don't")
    const tokens = (textToEvaluate.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu) || [])

    const matchedTokens: string[] = []
    let lastNegationIndex = -100

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]

      if (NEGATION_TOKENS.has(token)) {
        lastNegationIndex = i
        continue
      }

      const isNegated = (i - lastNegationIndex) <= 3

      for (const [cat, words] of Object.entries(this.lexicon) as [SpecificThinkingCategory, Set<string>][]) {
        if (words.has(token)) {
          matchedTokens.push(token)
          if (isNegated) {
            scores[cat].negated++
          }
          else {
            scores[cat].positive++
          }
        }
      }
    }

    // Calculate net scores
    let bestCategory: ThinkingCategory = 'generic'
    let highestNet = 0
    let totalEvidence = 0

    const categories: SpecificThinkingCategory[] = ['analytical', 'memory', 'emotional', 'uncertain']

    for (const cat of categories) {
      const net = scores[cat].positive - scores[cat].negated
      scores[cat].net = net
      totalEvidence += scores[cat].positive + scores[cat].negated

      if (net >= this.threshold && net > highestNet) {
        highestNet = net
        bestCategory = cat
      }
    }

    const confidence = bestCategory !== 'generic' && totalEvidence > 0
      ? Math.min(1, Math.max(0, highestNet / totalEvidence))
      : 0

    return {
      category: bestCategory,
      confidence,
      scores,
      matchedTokens,
    }
  }
}
