import type { ChatHistoryItem } from '../../types/chat'

import { echoChipsRepo } from '../../database/repos/echo-chips.repo'
import { needleClient } from '../../libs/inference/adapters/needle-client'
import { useDaydreamStore } from '../daydream'
import { useAiriCardStore } from '../modules/airi-card'

const STOPWORDS = new Set([
  'the',
  'and',
  'but',
  'for',
  'not',
  'you',
  'was',
  'this',
  'that',
  'with',
  'have',
  'your',
  'about',
  'from',
  'they',
  'what',
  'then',
  'them',
  'some',
  'there',
  'their',
  'would',
  'could',
  'should',
  'will',
  'are',
  'were',
  'been',
  'has',
  'had',
  'its',
  'into',
  'just',
  'more',
  'only',
  'other',
  'than',
  'these',
  'those',
  'upon',
  'very',
  'when',
  'where',
  'which',
  'who',
  'why',
  'how',
  'here',
  'now',
  'any',
  'each',
  'few',
  'many',
  'same',
  'such',
  'too',
  'out',
  'off',
  'our',
  'his',
  'her',
  'she',
  'him',
  'itself',
  'ours',
  'yours',
  'hers',
  'themselves',
  'am',
  'is',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'having',
  'do',
  'does',
  'did',
  'doing',
  'a',
  'an',
  'the',
  'and',
  'but',
  'if',
  'or',
  'because',
  'as',
  'until',
  'while',
  'of',
  'at',
  'by',
  'for',
  'with',
  'about',
  'against',
  'between',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'to',
  'from',
  'up',
  'down',
  'in',
  'out',
  'on',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
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
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  's',
  't',
  'can',
  'will',
  'just',
  'don',
  'should',
  'now',
  'd',
  'll',
  'm',
  'o',
  're',
  've',
  'y',
  'ain',
  'aren',
  'couldn',
  'didn',
  'doesn',
  'hadn',
  'hasn',
  'haven',
  'isn',
  'ma',
  'mightn',
  'mustn',
  'needn',
  'shan',
  'shouldn',
  'wasn',
  'weren',
  'won',
  'wouldn',
  'like',
  'just',
  'going',
  'think',
  'know',
  'want',
  'make',
  'good',
  'well',
  'much',
  'people',
  'time',
  'should',
  'still',
  'can',
  'one',
  'get',
  'got',
  'look',
  'see',
  'come',
  'take',
  'say',
  'tell',
  'give',
  'find',
  'use',
  'way',
  'day',
  'thing',
  'back',
  'also',
  'even',
  'really',
  'something',
  'anything',
  'everything',
  'someone',
  'anyone',
  'everyone',
  'somewhere',
  'anywhere',
  'everywhere',
  'little',
  'yes',
  'no',
  'yeah',
  'okay',
  'right',
  'please',
  'thanks',
  'thank',
  'sorry',
  'hello',
  'hi',
  'hey',
  'gurl',
  'kitty',
  'dude',
  'bro',
  'man',
  'guy',
  'girl',
  'boy',
  'woman',
  'men',
  'women',
  'gonna',
  'wanna',
  'gotta',
  'let',
  'us',
  'me',
  'my',
  'myself',
  'we',
  'our',
  'ours',
  'ourselves',
  'yourself',
  'yourselves',
  'himself',
  'herself',
  'itself',
  'themselves',
])

function cleanPhrase(text: string): string {
  if (!text)
    return ''
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTextTopics(text: string): { topic: string, isBiGram: boolean }[] {
  if (!text)
    return []
  const clean = text.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ')
  const words = clean
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3)

  const topics: { topic: string, isBiGram: boolean }[] = []

  // 1. Extract single words
  const validWords = words.filter(w => !STOPWORDS.has(w))
  validWords.forEach((w) => {
    topics.push({ topic: w, isBiGram: false })
  })

  // 2. Extract bi-grams (consecutive non-stopwords)
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i]
    const w2 = words[i + 1]
    if (!STOPWORDS.has(w1) && !STOPWORDS.has(w2)) {
      topics.push({ topic: `${w1} ${w2}`, isBiGram: true })
    }
  }

  return topics
}

export async function updateRecentTopics(
  characterId: string,
  sessionId: string,
  currentUserId: string,
  messages: ChatHistoryItem[],
  stmBlocks: any[],
  universeId: string,
) {
  const cardStore = useAiriCardStore()
  const card = cardStore.getCard(characterId)
  if (!card)
    return

  // Verify Toggle 4 is enabled
  if (!card.extensions?.airi?.groundingTopicsEnabled) {
    return
  }

  const topicScores: Record<string, number> = {}

  function addTopics(extracted: { topic: string, isBiGram: boolean }[], baseWeight: number, distance: number) {
    const decay = Math.max(0.1, 1.0 - distance * 0.01)
    for (const item of extracted) {
      // Bi-grams get higher weighting (1.5) than single words (0.5) to prioritize multi-word topics
      const multiplier = item.isBiGram ? 1.5 : 0.5
      const score = baseWeight * multiplier * decay
      topicScores[item.topic] = (topicScores[item.topic] || 0) + score
    }
  }

  // 0. Multi-Turn Ingestion via Needle 3 Subconscious Beat (Domain 2)
  const textMessages = (messages || []).filter(m => m.role === 'user' || m.role === 'assistant')
  if (needleClient.isReady()) {
    try {
      const turns = textMessages.slice(-10).map(m => ({
        role: m.role,
        content: typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? m.content.map(p => (typeof p === 'string' ? p : (p && typeof p === 'object' && 'text' in p ? String(p.text) : ''))).join(' ')
            : '',
      })).filter(t => t.content.trim().length > 0)

      if (turns.length > 0) {
        const beat = await needleClient.extractSubconsciousBeat(turns, 2000)
        if (beat) {
          // Feed Cadence Governor in Daydream store
          try {
            const daydreamStore = useDaydreamStore()
            daydreamStore.recordBeat(beat, characterId, universeId, sessionId)
          }
          catch (daydreamErr) {
            console.warn('[RecentTopics] Daydream store recordBeat error:', daydreamErr)
          }

          // Inject active topics from Needle 3 with high priority (2.5)
          if (Array.isArray(beat.active_topics) && beat.active_topics.length > 0) {
            for (const item of beat.active_topics) {
              if (item.topic && typeof item.weight === 'number') {
                const phrase = cleanPhrase(item.topic)
                if (phrase && !STOPWORDS.has(phrase)) {
                  topicScores[phrase] = (topicScores[phrase] || 0) + item.weight * 2.5
                }
              }
            }
          }
        }
      }
    }
    catch (needleErr) {
      console.warn('[RecentTopics] Needle 3 subconscious beat extraction failed, falling back to lexical analysis:', needleErr)
    }
  }

  // 1. Raw Chat Turns (Current session messages)
  const totalTurns = textMessages.length
  textMessages.forEach((msg, index) => {
    const distance = totalTurns - 1 - index
    let content = ''
    if (typeof msg.content === 'string') {
      content = msg.content
    }
    else if (Array.isArray(msg.content)) {
      content = msg.content.map(p => (typeof p === 'string' ? p : (p && typeof p === 'object' && 'text' in p ? String(p.text) : ''))).join(' ')
    }
    const extracted = extractTextTopics(content)
    addTopics(extracted, 1.0, distance)
  })

  // 2. Short-Term Memory Daily Summaries
  try {
    const charBlocks = (stmBlocks || []).filter(b => b.characterId === characterId && (b.universeId === universeId || !b.universeId))
    charBlocks.forEach((block, index) => {
      const distance = 20 + index * 10
      const extracted = extractTextTopics(block.summary || '')
      addTopics(extracted, 1.0, distance)
    })
  }
  catch (err) {
    console.warn('[RecentTopics] Failed to process Short-Term Memory Blocks:', err)
  }

  // 3. Echo Chips (Triple weight: 3.0, preserved as full multi-word phrases)
  try {
    const echoChips = await echoChipsRepo.getAll(currentUserId) || []
    const activeChips = echoChips.filter(c =>
      c.characterId === characterId
      && c.universeId === universeId
      && (c.sessionId === sessionId || !c.sessionId),
    )
    const sortedChips = [...activeChips].sort((a, b) => b.createdAt - a.createdAt)
    sortedChips.forEach((chip, index) => {
      const distance = index * 5
      const phrase = cleanPhrase(chip.content || '')
      if (phrase && !STOPWORDS.has(phrase)) {
        const decay = Math.max(0.1, 1.0 - distance * 0.01)
        const score = 3.0 * 1.5 * decay // base weight 3.0, phrase weight 1.5
        topicScores[phrase] = (topicScores[phrase] || 0) + score
      }
    })
  }
  catch (err) {
    console.warn('[RecentTopics] Failed to process Echo Chips:', err)
  }

  // Sort and select top 10 unique topics
  const sortedTopics = Object.entries(topicScores)
    .map(([topic, weight]) => ({ topic, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)

  // Update card extensions
  await cardStore.updateCard(characterId, {
    extensions: {
      ...card.extensions,
      airi: {
        ...card.extensions?.airi,
        recentTopics: sortedTopics,
      },
    },
  } as any)
}
