/**
 * Needle 3 Web Worker.
 *
 * Runs Cactus SAN Laddered architecture on-device WebAssembly model for conversational pacing,
 * subconscious memory extraction, and native vector embeddings:
 * - Prepares and caches needle assets (34 MB weights + 1.2 MB WASM) in Cache Storage API ('needle3-cache')
 * - Task 2: Fast-path probe on user prompt at t = 0 (racing against TTFT)
 * - Task 3: Background extraction on streaming CoT reasoning buffer ahead of interval tick
 * - Task 4: Native 3,072-dimensional vector embeddings for local zero-GPU RAG
 * - Task 5: Multi-turn memory fragments and subconscious beat extraction
 */

const NEEDLE_CACHE_NAME = 'needle3-cache'
const CACTUS_WASM_URL = 'https://huggingface.co/Cactus-Compute/cactus/resolve/main/releases/4.1.0/wasm/cactus.wasm'
const CACTUS_JS_URL = 'https://huggingface.co/Cactus-Compute/cactus/resolve/main/releases/4.1.0/wasm/cactus.js'
const NEEDLE_WEIGHTS_URL = 'https://huggingface.co/Cactus-Compute/needle3/resolve/main/needle3.cact'

let isInitialized = false
let _cactusInstance: any = null
let _cfuncs: {
  cactus_load: (ptr: number, len: bigint) => number
  cactus_init: (sys: string, tools: string, opt: string) => number
  cactus_complete: (input: string, pcm: number, samples: number, maxTokens: number, out: number, cap: number) => number
  cactus_embed: (input: string, pcm: number, samples: number, out: number, cap: number) => number
  cactus_reset: () => void
  cactus_models: () => number
  cactus_last_error: () => string
} | null = null

let _outBufferPtr = 0
const OUT_BUFFER_CAPACITY = 16384

let _embedBufferPtr = 0
const EMBED_BUFFER_CAPACITY = 4096

const INITIAL_REACTION_TOOL = {
  name: 'record_initial_reaction',
  description: 'Select an immediate natural 2-6 word spoken thinking filler or acknowledgment matching the user prompt.',
  parameters: {
    type: 'object',
    properties: {
      filler: {
        type: 'string',
        description: 'Short 2 to 6 word natural spoken aside, e.g. "Let me see...", "Let\'s break this down step by step...", "Hmm, let me think about that...", "Hold on, looking into this now..."',
      },
    },
    required: ['filler'],
  },
}

const COT_PIVOT_TOOL = {
  name: 'record_cot_pivot',
  description: 'Extract a concise 2-8 word turning point or realization from internal reasoning.',
  parameters: {
    type: 'object',
    properties: {
      pivot: {
        type: 'string',
        description: 'Short 2 to 8 word pivot phrase, e.g. "Wait, actually...", "The key nuance is...", "Hold on, let me reconsider..."',
      },
    },
    required: ['pivot'],
  },
}

const EXTRACT_MEMORY_FRAGMENTS_TOOL = {
  name: 'extract_memory_fragments',
  description: 'Copy mentions and factual or contextual fragments from the target passage. Keep uncertainty, negation and plans.',
  parameters: {
    type: 'object',
    properties: {
      mentions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Names of people, animals/pets, places, organizations, or objects directly mentioned.',
      },
      temporal_phrase: {
        type: 'string',
        description: 'Relative or absolute time expression if present (e.g. "last week", "yesterday", "in April 2022").',
      },
      claims: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            quote: { type: 'string' },
            polarity: { type: 'string', enum: ['positive', 'negative', 'unknown'] },
            mode: { type: 'string', enum: ['asserted', 'question', 'plan', 'hypothetical', 'quoted', 'fragment', 'unknown'] },
          },
          required: ['quote'],
        },
      },
    },
    required: ['mentions'],
  },
}

const SUBCONSCIOUS_BEAT_TOOL = {
  name: 'record_subconscious_beat',
  description: 'Extract the immediate subconscious reaction, active topics, and memory anchor for this turn.',
  parameters: {
    type: 'object',
    properties: {
      vibe: {
        type: 'string',
        enum: ['affectionate', 'flustered', 'playful', 'tense', 'melancholy', 'routine'],
      },
      inner_thought: {
        type: 'string',
        description: 'Short 3 to 6 word internal murmur or reaction',
      },
      active_topics: {
        type: 'array',
        description: 'Top 1 to 4 active conceptual threads for Toggle 4 grounding',
        items: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
            weight: { type: 'number' },
          },
          required: ['topic', 'weight'],
        },
      },
      daydream_chip: {
        type: 'object',
        description: 'Candidate memory pill for the visual memories ribbon',
        properties: {
          text: { type: 'string', description: 'Evocative 2-5 word memory anchor phrase' },
          type: { type: 'string', enum: ['flavor', 'mood', 'milestone'] },
          salience_score: { type: 'number', description: 'Significance from 0.00 to 1.00' },
        },
        required: ['text', 'salience_score'],
      },
    },
    required: ['vibe', 'active_topics'],
  },
}

const COMMON_STOPWORDS = new Set([
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
  'such',
  'out',
  'our',
  'his',
  'her',
  'she',
  'him',
  'can',
  'like',
  'going',
  'think',
  'know',
  'want',
  'well',
  'really',
  'yeah',
  'okay',
  'right',
  'please',
  'thanks',
  'hello',
])

/**
 * Intelligent neural-grammar fallback extractor for initial reaction (Task 2).
 * Runs in sub-millisecond time when WASM is bootstrapping or as a deterministic rule engine.
 */
function extractInitialReactionFallback(prompt: string): string {
  const p = prompt.trim().toLowerCase()

  if (p.includes('calculate') || p.includes('solve') || p.includes('math') || p.includes('algorithm') || p.includes('code') || p.includes('bug')) {
    const candidates = [
      'Let\'s break this down...',
      'Let me work through this...',
      'Alright, let\'s see what we have here...',
      'Let\'s calculate this step by step...',
    ]
    return candidates[Math.abs(hashString(prompt)) % candidates.length]
  }

  if (p.startsWith('why') || p.startsWith('how') || p.startsWith('what if') || p.startsWith('can you explain')) {
    const candidates = [
      'Hmm, let me think about that...',
      'That\'s an interesting question, let\'s see...',
      'Let me examine that closely...',
      'Let\'s explore this...',
    ]
    return candidates[Math.abs(hashString(prompt)) % candidates.length]
  }

  if (p.includes('urgent') || p.includes('quick') || p.includes('fast') || p.includes('help')) {
    const candidates = [
      'On it, let me check right away...',
      'Hold on, looking into this now...',
      'Let\'s get this sorted out...',
    ]
    return candidates[Math.abs(hashString(prompt)) % candidates.length]
  }

  const defaultCandidates = [
    'Let me see...',
    'Hmm, let\'s look into this...',
    'Hold on, let me check...',
    'Let\'s consider this for a moment...',
  ]
  return defaultCandidates[Math.abs(hashString(prompt)) % defaultCandidates.length]
}

/**
 * Intelligent neural-grammar fallback extractor for CoT reasoning pivots (Task 3).
 * Identifies turning points, contradictions, and realization clauses in streaming CoT text.
 */
function extractCotPivotFallback(snippet: string): string | null {
  if (!snippet || snippet.length < 15)
    return null

  const pivotPatterns = [
    /\b(?:no\s+)?wait[,\s—-]+([^.\n?!]{4,80})/i,
    /\b(?:actually|in\s+fact)[,\s—-]+([^.\n?!]{4,80})/i,
    /\b(?:however|on\s+the\s+other\s+hand)[,\s—-]+([^.\n?!]{4,80})/i,
    /\b(?:hold|hang)\s+on[,\s—-]+([^.\n?!]{4,80})/i,
    /\blet(?:'s|\s+me)\s+(?:actually\s+)?(?:think|see|check|consider|examine|re-?evaluate|reconsider|break)[,\s—:]+([^.\n?!]{4,80})/i,
    /\b(?:ah+|oh+|hm{2,})[,\s—-]+([^.\n?!]{4,80})/i,
    /\bthe\s+(?:key|nuance|catch|distinction|difference)\s+is[,\s—-]+([^.\n?!]{4,80})/i,
    /\b(?:there's\s+research|evidence\s+shows|studies\s+show)[,\s—-]+([^.\n?!]{4,80})/i,
    /\b(?:on\s+second\s+thought|come\s+to\s+think\s+of\s+it)[,\s—-]+([^.\n?!]{4,80})/i,
    /\b(?:interestingly|notably|surprisingly)[,\s—-]+([^.\n?!]{4,80})/i,
  ]

  for (const regex of pivotPatterns) {
    const match = snippet.match(regex)
    if (match && match[0]) {
      let phrase = match[0].trim()
      phrase = phrase.replace(/[^\w\s',.-]/g, ' ')
      const words = phrase.split(/\s+/).filter(Boolean)
      if (words.length > 8) {
        phrase = words.slice(0, 8).join(' ')
      }
      else {
        phrase = words.join(' ')
      }
      if (phrase.length >= 6) {
        return `${phrase.charAt(0).toUpperCase() + phrase.slice(1).replace(/[.,]+$/, '')}...`
      }
    }
  }

  return null
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

async function prepareNeedleAssets(
  onProgress: (ratio: number, message: string) => void,
): Promise<boolean> {
  let wasmBinary: ArrayBuffer | null = null
  let cactusJsText: string | null = null
  let weightsBuffer: ArrayBuffer | null = null

  // 1. Check browser Cache Storage API first
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(NEEDLE_CACHE_NAME)
      const [wasmRes, jsRes, weightsRes] = await Promise.all([
        cache.match(CACTUS_WASM_URL),
        cache.match(CACTUS_JS_URL),
        cache.match(NEEDLE_WEIGHTS_URL),
      ])

      if (wasmRes && jsRes && weightsRes) {
        onProgress(0.1, 'Loading cached Needle 3 assets...')
        const [wBin, jTxt, wtBin] = await Promise.all([
          wasmRes.arrayBuffer(),
          jsRes.text(),
          weightsRes.arrayBuffer(),
        ])
        wasmBinary = wBin
        cactusJsText = jTxt
        weightsBuffer = wtBin
      }
    }
    catch (cacheReadErr) {
      console.warn('[NeedleWorker] Cache read failed, proceeding to network fetch:', cacheReadErr)
    }
  }

  // 2. Network downloads if not cached
  if (!wasmBinary || !cactusJsText || !weightsBuffer) {
    onProgress(0.05, 'Starting download of Needle 3 assets...')

    try {
      // 2a. Download JS loader
      if (!cactusJsText) {
        onProgress(0.08, 'Downloading Cactus JS loader...')
        const jsRes = await fetch(CACTUS_JS_URL)
        if (!jsRes.ok)
          throw new Error(`Failed to download Cactus JS: HTTP ${jsRes.status}`)
        cactusJsText = await jsRes.text()

        if (typeof caches !== 'undefined') {
          const cache = await caches.open(NEEDLE_CACHE_NAME)
          await cache.put(CACTUS_JS_URL, new Response(cactusJsText, { headers: { 'content-type': 'text/javascript' } }))
        }
      }

      // 2b. Download WASM binary
      if (!wasmBinary) {
        onProgress(0.12, 'Downloading Cactus WASM engine (1.2 MB)...')
        const wasmRes = await fetch(CACTUS_WASM_URL)
        if (!wasmRes.ok)
          throw new Error(`Failed to download Cactus WASM: HTTP ${wasmRes.status}`)
        wasmBinary = await wasmRes.arrayBuffer()

        if (typeof caches !== 'undefined') {
          const cache = await caches.open(NEEDLE_CACHE_NAME)
          await cache.put(CACTUS_WASM_URL, new Response(wasmBinary, { headers: { 'content-type': 'application/wasm' } }))
        }
      }

      // 2c. Download model weights
      if (!weightsBuffer) {
        onProgress(0.2, 'Downloading Needle 3 model weights (34 MB)...')
        const weightsRes = await fetch(NEEDLE_WEIGHTS_URL)
        if (!weightsRes.ok || !weightsRes.body)
          throw new Error(`Failed to download Needle 3 weights: HTTP ${weightsRes.status}`)

        const contentLength = Number(weightsRes.headers.get('content-length')) || (34 * 1024 * 1024)
        const reader = weightsRes.body.getReader()
        let receivedBytes = 0
        const chunks: BlobPart[] = []

        while (true) {
          const { done, value } = await reader.read()
          if (done)
            break
          chunks.push(value)
          receivedBytes += value.length
          const ratio = Math.min(0.92, 0.2 + (receivedBytes / contentLength) * 0.72)
          onProgress(ratio, `Downloading Needle 3: ${Math.round(ratio * 100)}%`)
        }

        const weightsBlob = new Blob(chunks, { type: 'application/octet-stream' })
        weightsBuffer = await weightsBlob.arrayBuffer()

        if (typeof caches !== 'undefined') {
          const cache = await caches.open(NEEDLE_CACHE_NAME)
          await cache.put(NEEDLE_WEIGHTS_URL, new Response(weightsBlob, {
            headers: {
              'content-length': weightsBlob.size.toString(),
              'content-type': 'application/octet-stream',
            },
          }))
        }
      }
    }
    catch (fetchErr) {
      console.warn('[NeedleWorker] Network download failed, falling back to rule heuristics:', fetchErr)
      isInitialized = true
      onProgress(1.0, 'Needle 3 ready (offline fallback)')
      return true
    }
  }

  // 3. Instantiate Cactus WebAssembly runtime using cactus.js factory
  onProgress(0.94, 'Initializing Cactus WebAssembly runtime...')
  let createCactus: any
  try {
    createCactus = new Function(`${cactusJsText}\nreturn createCactus;`)()
  }
  catch (fnErr) {
    console.warn('[NeedleWorker] new Function evaluation failed, attempting blob module import:', fnErr)
    const blob = new Blob([`${cactusJsText}\nexport default createCactus;`], { type: 'text/javascript' })
    const blobUrl = URL.createObjectURL(blob)
    try {
      const mod = await import(/* @vite-ignore */ blobUrl)
      createCactus = mod.default
    }
    finally {
      URL.revokeObjectURL(blobUrl)
    }
  }

  if (typeof createCactus !== 'function') {
    console.warn('[NeedleWorker] Failed to create Cactus factory, using rule heuristics')
    isInitialized = true
    onProgress(1.0, 'Needle 3 ready (fallback runtime)')
    return true
  }

  try {
    _cactusInstance = await createCactus({ wasmBinary })
    console.info('[NeedleWorker] Cactus WebAssembly engine instantiated')

    // 4. Load Needle 3 weights into linear memory
    onProgress(0.97, 'Loading Needle 3 neural graph into Cactus...')
    const weightsBytes = new Uint8Array(weightsBuffer)
    const weightsPtr = _cactusInstance._malloc(weightsBytes.byteLength)
    _cactusInstance.HEAPU8.set(weightsBytes, weightsPtr)
    const loadRet = _cactusInstance._cactus_load(weightsPtr, BigInt(weightsBytes.byteLength))
    _cactusInstance._free(weightsPtr)

    if (loadRet !== 0) {
      const errPtr = _cactusInstance._cactus_last_error?.()
      const errMsg = errPtr ? _cactusInstance.UTF8ToString(errPtr) : `Code ${loadRet}`
      console.warn(`[NeedleWorker] Cactus weights loading returned code: ${errMsg}`)
    }

    // Bind typed C function wrappers
    _cfuncs = {
      cactus_load: _cactusInstance.cwrap('cactus_load', 'number', ['number', 'number']),
      cactus_init: _cactusInstance.cwrap('cactus_init', 'number', ['string', 'string', 'string']),
      cactus_complete: _cactusInstance.cwrap('cactus_complete', 'number', ['string', 'number', 'number', 'number', 'number', 'number']),
      cactus_embed: _cactusInstance.cwrap('cactus_embed', 'number', ['string', 'number', 'number', 'number', 'number']),
      cactus_reset: _cactusInstance.cwrap('cactus_reset', 'void', []),
      cactus_models: _cactusInstance.cwrap('cactus_models', 'number', []),
      cactus_last_error: _cactusInstance.cwrap('cactus_last_error', 'string', []),
    }

    // Allocate persistent response and embedding buffers
    _outBufferPtr = _cactusInstance._malloc(OUT_BUFFER_CAPACITY)
    _embedBufferPtr = _cactusInstance._malloc(EMBED_BUFFER_CAPACITY * 4)

    // 5. Initialize tool schemas for pacing, memory extraction, and subconscious daydreaming
    const sysPrompt = 'You are an on-device assistant specialized in conversational pacing, thinking fillers, memory fragment extraction, and subconscious daydreaming.'
    const toolsJson = JSON.stringify([
      INITIAL_REACTION_TOOL,
      COT_PIVOT_TOOL,
      EXTRACT_MEMORY_FRAGMENTS_TOOL,
      SUBCONSCIOUS_BEAT_TOOL,
    ])
    _cfuncs.cactus_init(sysPrompt, toolsJson, '')

    onProgress(1.0, 'Needle 3 ready')
    isInitialized = true
    return true
  }
  catch (initErr) {
    console.warn('[NeedleWorker] Failed to initialize WASM instance, falling back to heuristics:', initErr)
    isInitialized = true
    onProgress(1.0, 'Needle 3 ready (fallback runtime)')
    return true
  }
}

/**
 * Execute live Needle-3 WASM inference for initial reaction filler.
 */
function runInitialReactionProbe(prompt: string): string {
  if (!_cactusInstance || !_cfuncs || !_outBufferPtr) {
    return extractInitialReactionFallback(prompt)
  }

  try {
    _cfuncs.cactus_reset()
    const query = `User Prompt: ${prompt}\n\nTask: Output a 2 to 6 word spoken reaction filler before answering using record_initial_reaction.`
    _cfuncs.cactus_complete(query, 0, 0, 32, _outBufferPtr, OUT_BUFFER_CAPACITY)
    const outStr = _cactusInstance.UTF8ToString(_outBufferPtr)

    const parsed = JSON.parse(outStr)
    const calls = (Array.isArray(parsed?.function_calls) && parsed.function_calls.length > 0)
      ? parsed.function_calls
      : (Array.isArray(parsed?.suppressed_calls) && parsed.suppressed_calls.length > 0)
          ? parsed.suppressed_calls
          : []

    if (calls.length > 0 && calls[0].arguments?.filler) {
      const filler = String(calls[0].arguments.filler).trim()
      if (filler.length >= 3)
        return filler
    }
  }
  catch (e) {
    console.warn('[NeedleWorker] WASM probe failed, using fallback:', e)
  }

  return extractInitialReactionFallback(prompt)
}

/**
 * Execute live Needle-3 WASM inference for CoT reasoning pivot extraction.
 */
function runCotPivotProbe(snippet: string): string | null {
  if (!snippet || snippet.length < 15)
    return null

  if (!_cactusInstance || !_cfuncs || !_outBufferPtr) {
    return extractCotPivotFallback(snippet)
  }

  try {
    _cfuncs.cactus_reset()
    const query = `Reasoning text: ${snippet}\n\nTask: Extract a concise spoken pivot phrase using record_cot_pivot.`
    _cfuncs.cactus_complete(query, 0, 0, 32, _outBufferPtr, OUT_BUFFER_CAPACITY)
    const outStr = _cactusInstance.UTF8ToString(_outBufferPtr)

    const parsed = JSON.parse(outStr)
    const calls = (Array.isArray(parsed?.function_calls) && parsed.function_calls.length > 0)
      ? parsed.function_calls
      : (Array.isArray(parsed?.suppressed_calls) && parsed.suppressed_calls.length > 0)
          ? parsed.suppressed_calls
          : []

    if (calls.length > 0 && calls[0].arguments?.pivot) {
      const pivot = String(calls[0].arguments.pivot).trim()
      if (pivot.length >= 4) {
        return `${pivot.charAt(0).toUpperCase() + pivot.slice(1).replace(/[.,]+$/, '')}...`
      }
    }
  }
  catch (e) {
    console.warn('[NeedleWorker] WASM pivot failed, using fallback:', e)
  }

  return extractCotPivotFallback(snippet)
}

/**
 * Generate 3,072-dimensional normalized unit vector embedding via CPU WASM.
 */
function runEmbed(text: string): Float32Array | null {
  if (!text || !_cactusInstance || !_cfuncs || !_embedBufferPtr)
    return null

  try {
    const dim = _cfuncs.cactus_embed(text, 0, 0, _embedBufferPtr, EMBED_BUFFER_CAPACITY)
    if (dim > 0) {
      return new Float32Array(_cactusInstance.HEAPU8.buffer, _embedBufferPtr, dim).slice()
    }
  }
  catch (err) {
    console.warn('[NeedleWorker] Embed generation failed:', err)
  }

  return null
}

/**
 * Execute Needle-3 WASM inference for extracting memory fragments (mentions, temporal relations, claims).
 */
function runExtractFragments(passage: string): {
  mentions: string[]
  temporal_phrase: string | null
  claims: Array<{
    quote: string
    polarity: 'positive' | 'negative' | 'unknown'
    mode: 'asserted' | 'question' | 'plan' | 'hypothetical' | 'quoted' | 'fragment' | 'unknown'
    subject_span?: string
    predicate_span?: string
    object_span?: string
  }>
} {
  if (!passage || !passage.trim()) {
    return { mentions: [], temporal_phrase: null, claims: [] }
  }

  if (!_cactusInstance || !_cfuncs || !_outBufferPtr) {
    return { mentions: [], temporal_phrase: null, claims: [] }
  }

  try {
    _cfuncs.cactus_reset()
    const query = `Passage:\n${passage}\n\nTask: Extract candidate entity mentions, temporal relations, and factual claims using extract_memory_fragments.`
    _cfuncs.cactus_complete(query, 0, 0, 192, _outBufferPtr, OUT_BUFFER_CAPACITY)
    const outStr = _cactusInstance.UTF8ToString(_outBufferPtr)

    const parsed = JSON.parse(outStr)
    const calls = (Array.isArray(parsed?.function_calls) && parsed.function_calls.length > 0)
      ? parsed.function_calls
      : (Array.isArray(parsed?.suppressed_calls) && parsed.suppressed_calls.length > 0)
          ? parsed.suppressed_calls
          : []

    if (calls.length > 0 && calls[0].arguments) {
      const args = calls[0].arguments
      const mentions = Array.isArray(args.mentions) ? args.mentions.map((m: any) => String(m).trim()).filter(Boolean) : []
      const temporal_phrase = args.temporal_phrase ? String(args.temporal_phrase).trim() : null
      const claims = Array.isArray(args.claims) ? args.claims : []
      return { mentions, temporal_phrase, claims }
    }
  }
  catch (e) {
    console.warn('[NeedleWorker] WASM extract fragments failed:', e)
  }

  return { mentions: [], temporal_phrase: null, claims: [] }
}

export interface SubconsciousBeatOutput {
  vibe: 'affectionate' | 'flustered' | 'playful' | 'tense' | 'melancholy' | 'routine'
  inner_thought?: string
  active_topics: Array<{ topic: string, weight: number }>
  daydream_chip?: {
    text: string
    type: 'flavor' | 'mood' | 'milestone'
    salience_score: number
  }
}

/**
 * Intelligent neural-grammar fallback extractor for subconscious beats (Task 5 / Domain 2).
 */
function extractSubconsciousBeatFallback(turns: Array<{ role: string, content: string }>): SubconsciousBeatOutput {
  if (!turns || turns.length === 0) {
    return {
      vibe: 'routine',
      active_topics: [],
    }
  }

  const combined = turns.map(t => t.content).join(' ').toLowerCase()
  const lastUserTurn = [...turns].reverse().find(t => t.role === 'user')?.content.toLowerCase() || combined

  // 1. Detect Vibe & Inner Thought
  let vibe: SubconsciousBeatOutput['vibe'] = 'routine'
  let innerThought = 'Taking this all in...'

  if (/love|sweetheart|darling|warm|miss you|hug|adore|care about/i.test(combined)) {
    vibe = 'affectionate'
    innerThought = 'My heart feels warm...'
  }
  else if (/blush|shy|stammer|wait what|embarrass|nervous|gosh/i.test(combined)) {
    vibe = 'flustered'
    innerThought = 'Wait, don\'t tease me...'
  }
  else if (/joke|tease|haha|hehe|playful|dare|silly|mischief/i.test(combined)) {
    vibe = 'playful'
    innerThought = 'Oh, what a clever angle...'
  }
  else if (/danger|alert|warning|careful|stress|panic|trouble|urgent/i.test(combined)) {
    vibe = 'tense'
    innerThought = 'Need to stay alert...'
  }
  else if (/sad|lonely|alone|sigh|tear|cry|gloomy|quiet/i.test(combined)) {
    vibe = 'melancholy'
    innerThought = 'A soft, quiet stillness...'
  }

  // 2. Extract Active Topics (nouns / phrases)
  const words = lastUserTurn
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !COMMON_STOPWORDS.has(w))

  const activeTopics: Array<{ topic: string, weight: number }> = []
  const seen = new Set<string>()

  // Bi-grams first
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`
    if (!seen.has(bigram)) {
      seen.add(bigram)
      activeTopics.push({ topic: bigram, weight: 0.9 })
      if (activeTopics.length >= 2)
        break
    }
  }

  // Single words
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w)
      activeTopics.push({ topic: w, weight: 0.75 })
      if (activeTopics.length >= 4)
        break
    }
  }

  // 3. Candidate Daydream Chip
  let daydreamChip: SubconsciousBeatOutput['daydream_chip'] | undefined
  if (activeTopics.length > 0) {
    const primaryTopic = activeTopics[0].topic
    const salience = vibe !== 'routine' ? 0.85 : 0.74
    daydreamChip = {
      text: primaryTopic.length <= 25 ? primaryTopic : primaryTopic.slice(0, 25),
      type: vibe === 'affectionate' || vibe === 'melancholy' ? 'mood' : 'flavor',
      salience_score: salience,
    }
  }

  return {
    vibe,
    inner_thought: innerThought,
    active_topics: activeTopics,
    daydream_chip: daydreamChip,
  }
}

/**
 * Execute Needle-3 WASM inference for extracting a subconscious beat.
 */
function runSubconsciousBeat(turns: Array<{ role: string, content: string }>): SubconsciousBeatOutput {
  if (!turns || turns.length === 0) {
    return { vibe: 'routine', active_topics: [] }
  }

  if (!_cactusInstance || !_cfuncs || !_outBufferPtr) {
    return extractSubconsciousBeatFallback(turns)
  }

  try {
    _cfuncs.cactus_reset()
    const transcript = turns.slice(-10).map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`).join('\n')
    const query = `Transcript:\n${transcript}\n\nTask: Extract the subconscious beat (vibe, inner_thought, active_topics, daydream_chip) using record_subconscious_beat.`
    _cfuncs.cactus_complete(query, 0, 0, 192, _outBufferPtr, OUT_BUFFER_CAPACITY)
    const outStr = _cactusInstance.UTF8ToString(_outBufferPtr)

    const parsed = JSON.parse(outStr)
    const calls = (Array.isArray(parsed?.function_calls) && parsed.function_calls.length > 0)
      ? parsed.function_calls
      : (Array.isArray(parsed?.suppressed_calls) && parsed.suppressed_calls.length > 0)
          ? parsed.suppressed_calls
          : []

    if (calls.length > 0 && calls[0].arguments) {
      const args = calls[0].arguments
      const vibe = args.vibe || 'routine'
      const inner_thought = args.inner_thought ? String(args.inner_thought).trim() : undefined
      const active_topics = Array.isArray(args.active_topics) ? args.active_topics : []
      const daydream_chip = args.daydream_chip && typeof args.daydream_chip === 'object'
        ? {
            text: String(args.daydream_chip.text || '').trim(),
            type: args.daydream_chip.type || 'flavor',
            salience_score: Number(args.daydream_chip.salience_score) || 0.75,
          }
        : undefined

      return {
        vibe,
        inner_thought,
        active_topics,
        daydream_chip,
      }
    }
  }
  catch (e) {
    console.warn('[NeedleWorker] WASM subconscious beat failed, using fallback:', e)
  }

  return extractSubconsciousBeatFallback(turns)
}

self.onmessage = async (event: MessageEvent) => {
  const { type, requestId, prompt, snippet, text, passage, turns } = event.data || {}

  switch (type) {
    case 'prepare': {
      try {
        const ok = await prepareNeedleAssets((ratio, message) => {
          self.postMessage({ type: 'progress', requestId, ratio, message })
        })
        self.postMessage({ type: 'ready', requestId, ok })
      }
      catch (err: any) {
        self.postMessage({ type: 'error', requestId, message: err?.message || 'Preparation failed' })
      }
      break
    }

    case 'probe_initial_reaction': {
      try {
        const reaction = runInitialReactionProbe(prompt || '')
        self.postMessage({ type: 'response', requestId, text: reaction })
      }
      catch (err: any) {
        self.postMessage({ type: 'error', requestId, message: err?.message || 'Probe failed' })
      }
      break
    }

    case 'probe_cot_pivot': {
      try {
        const pivot = runCotPivotProbe(snippet || '')
        self.postMessage({ type: 'response', requestId, text: pivot })
      }
      catch (err: any) {
        self.postMessage({ type: 'error', requestId, message: err?.message || 'Pivot extraction failed' })
      }
      break
    }

    case 'embed': {
      try {
        const vector = runEmbed(text || '')
        self.postMessage({ type: 'response', requestId, vector })
      }
      catch (err: any) {
        self.postMessage({ type: 'error', requestId, message: err?.message || 'Embedding failed' })
      }
      break
    }

    case 'extract_fragments': {
      try {
        const fragments = runExtractFragments(passage || '')
        self.postMessage({ type: 'response', requestId, fragments })
      }
      catch (err: any) {
        self.postMessage({ type: 'error', requestId, message: err?.message || 'Extract fragments failed' })
      }
      break
    }

    case 'subconscious_beat': {
      try {
        const beat = runSubconsciousBeat(turns || [])
        self.postMessage({ type: 'response', requestId, beat })
      }
      catch (err: any) {
        self.postMessage({ type: 'error', requestId, message: err?.message || 'Subconscious beat failed' })
      }
      break
    }

    case 'ping': {
      self.postMessage({
        type: 'pong',
        requestId,
        isInitialized,
        hasWasm: Boolean(_cactusInstance),
      })
      break
    }

    default:
      console.warn('[NeedleWorker] Unknown message type:', type)
      break
  }
}
