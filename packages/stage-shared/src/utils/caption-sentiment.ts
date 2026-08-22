/**
 * Shared sentiment, structural pattern, and trigger analyzer for head-tethered captions.
 *
 * Evaluates dialogue text and structural cues (without requiring explicit <|ACT:emotion|> tags)
 * to output normalized visual effect assignments across 4 orthogonal channels:
 * 1. ambient (Background atmosphere & particle flows)
 * 2. accent (One-shot pops & icon stickers)
 * 3. motion (Physics-driven container transforms)
 * 4. rim/tail (Vector border morphs & tail limb poses)
 */

export type BubbleBodyStyle
  = | 'standard-rounded'
    | 'jagged-starburst'
    | 'scalloped-cloud'

export type BubbleTailStyle
  = | 'pointer'
    | 'wagging'
    | 'heart-curl'
    | 'jagged-pointer'
    | 'droop'
    | 'thought-dots'
    | 'none'

export interface CaptionEffectCue {
  id: string
  channel: 'ambient' | 'accent' | 'motion' | 'rim'
  effect: string
  durationMs: number
  intensity: number // 0.0 .. 1.0
  priority: number // Higher priority pre-empts lower priority in same channel
}

export interface AnalyzedSentenceEffects {
  bodyStyle: BubbleBodyStyle
  tailStyle: BubbleTailStyle
  ambient: 'hearts' | 'rain' | 'scanline' | 'fireflies' | 'blush' | 'vignette' | 'sunbeam' | 'confetti' | 'stars' | null
  accent: 'sweat-drop' | 'flash-burst' | 'lightbulb' | 'anger-mark' | 'checkmark' | 'question-mark' | 'star-sparkles' | null
  motion: 'wobble' | 'bounce' | 'shake' | 'breath' | 'stretch' | null
  rim: 'flower-bloom' | 'frost-rim' | 'heartbeat-pulse' | null
}

/**
 * 5-tier sentiment & structural trigger analyzer for subtitle sentences.
 */
export function analyzeCaptionSentence(text: string): AnalyzedSentenceEffects {
  const res: AnalyzedSentenceEffects = {
    bodyStyle: 'standard-rounded',
    tailStyle: 'pointer',
    ambient: null,
    accent: null,
    motion: null,
    rim: null,
  }

  if (!text || !text.trim())
    return res

  // Strip code blocks, URLs, and quoted text before sentiment scanning
  let cleanText = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/"[^"]*"/g, '')
    .trim()

  if (!cleanText)
    return res

  // Negation Filtering: Suppress emotion matches in negated spans
  const negatedSpans: string[] = []
  cleanText = cleanText.replace(/\b(?:not|no|don't|never)\s+\w+/gi, (match) => {
    negatedSpans.push(match.toLowerCase())
    return ' '
  })

  // 1. Bracket Tokens (Highest explicit trigger)
  const bracketMatch = text.match(/\[([\w-]+)\]/)
  if (bracketMatch) {
    const token = bracketMatch[1].toLowerCase()
    if (['flustered', 'blush', 'shy'].includes(token)) {
      res.ambient = 'blush'
      res.accent = 'sweat-drop'
      res.motion = 'wobble'
      res.tailStyle = 'heart-curl'
    }
    else if (['angry', 'tsundere', 'hmph', 'grr'].includes(token)) {
      res.bodyStyle = 'jagged-starburst'
      res.tailStyle = 'jagged-pointer'
      res.accent = 'anger-mark'
      res.motion = 'shake'
    }
    else if (['thinking', 'wonder', 'hmm'].includes(token)) {
      res.bodyStyle = 'scalloped-cloud'
      res.tailStyle = 'thought-dots'
      res.accent = 'question-mark'
    }
    else if (['gasp', 'surprised', 'shock'].includes(token)) {
      res.accent = 'flash-burst'
      res.motion = 'bounce'
    }
    else if (['sad', 'cry', 'pout', 'sigh'].includes(token)) {
      res.ambient = 'rain'
      res.tailStyle = 'droop'
    }
    else if (['yandere', 'obsessive'].includes(token)) {
      res.ambient = 'vignette'
      res.rim = 'heartbeat-pulse'
    }
    else if (['sleepy', 'tired', 'yawn'].includes(token)) {
      res.ambient = 'fireflies'
      res.motion = 'breath'
    }
  }

  // 2. Keyword / Phrase Matches (Evaluated with respect to Tier 1 bracket token precedence)
  const lower = cleanText.toLowerCase()

  if (/\b(love|cute|darling|sweetheart|like you)\b/i.test(lower)) {
    if (!res.ambient)
      res.ambient = 'hearts'
    if (res.tailStyle === 'pointer')
      res.tailStyle = 'heart-curl'
  }
  else if (/\b(thanks|thank you|pretty|beautiful|amazing|star|sparkle)\b/i.test(lower)) {
    if (!res.rim)
      res.rim = 'flower-bloom'
    if (!res.ambient)
      res.ambient = 'stars'
  }
  else if (/\b(sorry|miss you|cry|lonely|sniff|alone)\b/i.test(lower)) {
    if (!res.ambient)
      res.ambient = 'rain'
    if (res.tailStyle === 'pointer')
      res.tailStyle = 'droop'
  }
  else if (/\b(angry|hmph|grr|annoyed|shut up)\b/i.test(lower)) {
    if (res.bodyStyle === 'standard-rounded')
      res.bodyStyle = 'jagged-starburst'
    if (res.tailStyle === 'pointer')
      res.tailStyle = 'jagged-pointer'
    if (!res.accent)
      res.accent = 'anger-mark'
    if (!res.motion)
      res.motion = 'shake'
  }
  else if (/\b(mine|jealous|belong to me|forever)\b/i.test(lower)) {
    if (!res.ambient)
      res.ambient = 'vignette'
    if (!res.rim)
      res.rim = 'heartbeat-pulse'
  }
  else if (/\b(scared|eek|creepy|cold)\b/i.test(lower)) {
    if (!res.ambient)
      res.ambient = 'fireflies'
    if (!res.motion)
      res.motion = 'wobble'
    if (!res.rim)
      res.rim = 'frost-rim'
  }
  else if (/\b(meow|nya|purr)\b/i.test(lower)) {
    if (res.tailStyle === 'pointer')
      res.tailStyle = 'wagging'
  }
  else if (/\b(code|system|analyze|data|diagnostic)\b/i.test(lower)) {
    if (!res.ambient)
      res.ambient = 'scanline'
  }
  else if (/\b(cozy|warm|relax|goodnight|sleepy|yawn)\b/i.test(lower)) {
    if (!res.ambient)
      res.ambient = 'sunbeam'
    if (!res.motion)
      res.motion = 'breath'
  }

  // 3. Structural Triggers (Fallback for unmatched sentences)
  // Stutters (e.g. u-um, w-wait, I-I, b-dummy)
  if (/\b[a-z]-[a-z]{1,4}\b/i.test(cleanText)) {
    if (!res.ambient)
      res.ambient = 'blush'
    if (!res.accent)
      res.accent = 'sweat-drop'
    if (!res.motion)
      res.motion = 'wobble'
  }

  // Ellipses (...)
  if (/\.{3}|…/.test(cleanText)) {
    if (!res.ambient)
      res.ambient = 'fireflies'
    if (!res.motion)
      res.motion = 'breath'
  }

  // Punctuation Spikes (!! or !?)
  if (/!{2,}|\?{2,}|!\?|\?!/.test(cleanText)) {
    if (!res.accent)
      res.accent = 'flash-burst'
    if (!res.motion)
      res.motion = 'bounce'
  }

  // Parenthetical Asides (inner monologue)
  if (/\([^)]+\)/.test(cleanText)) {
    res.bodyStyle = 'scalloped-cloud'
    res.tailStyle = 'thought-dots'
  }

  // ALL CAPS
  if (/^[A-Z0-9\s!?,.'"-]{5,}$/.test(cleanText) && cleanText !== cleanText.toLowerCase()) {
    res.bodyStyle = 'jagged-starburst'
    res.tailStyle = 'jagged-pointer'
    if (!res.motion)
      res.motion = 'shake'
  }

  // Elongated Words (soooo, cuteeee)
  if (/([a-z])\1{3,}/i.test(cleanText)) {
    if (!res.motion)
      res.motion = 'stretch'
  }

  return res
}

/**
 * Sub-chunks a long active segment into bite-sized sub-phrases (max ~75-80 chars)
 * at clause/punctuation boundaries (~, ,, ., !, ?, ;, —, :) so the bubble stays compact.
 */
export function subChunkText(fullText: string, maxChars = 80): string[] {
  const trimmed = fullText.trim()
  if (!trimmed)
    return []
  if (trimmed.length <= maxChars)
    return [trimmed]

  // Primary clause splitters: keep the trailing punctuation with the preceding phrase
  const rawClauses = trimmed.split(/(?<=[.,!?;—~:])\s+/)
  const subChunks: string[] = []
  let currentChunk = ''

  for (const clause of rawClauses) {
    if ((currentChunk + (currentChunk ? ' ' : '') + clause).length <= maxChars) {
      currentChunk = currentChunk ? `${currentChunk} ${clause}` : clause
    }
    else {
      if (currentChunk) {
        subChunks.push(currentChunk)
        currentChunk = ''
      }

      // If a single clause exceeds maxChars, split on space boundaries
      if (clause.length > maxChars) {
        const words = clause.split(/\s+/)
        for (const word of words) {
          if ((currentChunk + (currentChunk ? ' ' : '') + word).length <= maxChars) {
            currentChunk = currentChunk ? `${currentChunk} ${word}` : word
          }
          else {
            if (currentChunk)
              subChunks.push(currentChunk)
            currentChunk = word
          }
        }
      }
      else {
        currentChunk = clause
      }
    }
  }

  if (currentChunk) {
    subChunks.push(currentChunk)
  }

  return subChunks.length > 0 ? subChunks : [trimmed]
}
