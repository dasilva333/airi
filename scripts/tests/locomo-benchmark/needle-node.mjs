/**
 * Direct Node.js WASM Runner for Needle 3 (Cactus SAN, Laddered Architecture).
 * Runs completely on CPU / WASM using cached weights (~34 MB) in ~/.cache/needle3.
 *
 * Capabilities:
 * - 8,192-token context window (replaces legacy 256-token limit)
 * - Schema-constrained JSON memory fragment extraction (claims, mentions, temporal)
 * - Native 3,072-dimensional normalized vector embeddings (`embed()`)
 * - Generative SLM completion for answer head fallback
 */

import fs from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'

import { createRequire } from 'node:module'

import { EXTRACT_MEMORY_FRAGMENTS_TOOL, validateExtractionSpans } from './needle-schema.mjs'

const require = createRequire(import.meta.url)

const ASSET_URLS = {
  wasm: 'https://huggingface.co/Cactus-Compute/cactus/resolve/main/releases/4.1.0/wasm/cactus.wasm',
  js: 'https://huggingface.co/Cactus-Compute/cactus/resolve/main/releases/4.1.0/wasm/cactus.js',
  cact: 'https://huggingface.co/Cactus-Compute/needle3/resolve/main/needle3.cact',
}

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    function get(currentUrl) {
      https.get(currentUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download ${currentUrl}: HTTP ${res.statusCode}`))
          return
        }
        const fileStream = fs.createWriteStream(destPath)
        res.pipe(fileStream)
        fileStream.on('finish', () => {
          fileStream.close(resolve)
        })
        fileStream.on('error', reject)
      }).on('error', reject)
    }
    get(url)
  })
}

async function ensureAssets(cacheDir) {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }

  const wasmPath = path.join(cacheDir, 'cactus.wasm')
  const cactPath = path.join(cacheDir, 'needle3.cact')
  const jsPath = path.join(cacheDir, 'cactus.js')

  if (!fs.existsSync(wasmPath)) {
    console.log('[NeedleNode] Downloading Cactus WASM engine...')
    await downloadFile(ASSET_URLS.wasm, wasmPath)
  }

  if (!fs.existsSync(jsPath)) {
    console.log('[NeedleNode] Downloading Cactus JS loader...')
    await downloadFile(ASSET_URLS.js, jsPath)
  }

  if (!fs.existsSync(cactPath)) {
    console.log('[NeedleNode] Downloading Needle-3 model weights (34 MB)...')
    await downloadFile(ASSET_URLS.cact, cactPath)
  }

  return { wasmPath, cactPath, jsPath }
}

export class NeedleNode {
  constructor(moduleInstance, cfuncs, cacheDir) {
    this.Module = moduleInstance
    this.cfuncs = cfuncs
    this.cacheDir = cacheDir
    this.isInitialized = false
    this.outCap = 16384
    this.outPtr = this.Module._malloc(this.outCap)

    // Embedding buffer: 4096 floats * 4 bytes = 16384 bytes
    this.embedCap = 4096
    this.embedPtr = this.Module._malloc(this.embedCap * 4)
  }

  static async load(opts = {}) {
    const cacheDir = opts.cacheDir || path.join(os.homedir(), '.cache', 'needle3')
    const { wasmPath, cactPath, jsPath } = await ensureAssets(cacheDir)

    const createCactus = require(jsPath)
    const wasmBinary = fs.readFileSync(wasmPath)
    const cactBinary = fs.readFileSync(cactPath)

    const Module = await createCactus({
      wasmBinary,
      locateFile: f => path.join(cacheDir, f),
    })

    const cactus_load = Module.cwrap('cactus_load', 'number', ['number', 'number'])
    const cactus_init = Module.cwrap('cactus_init', 'number', ['string', 'string', 'string'])
    const cactus_complete = Module.cwrap('cactus_complete', 'number', ['string', 'number', 'number', 'number', 'number', 'number'])
    const cactus_embed = Module.cwrap('cactus_embed', 'number', ['string', 'number', 'number', 'number', 'number'])
    const cactus_reset = Module.cwrap('cactus_reset', 'void', [])
    const cactus_models = Module.cwrap('cactus_models', 'number', [])
    const cactus_last_error = Module.cwrap('cactus_last_error', 'string', [])

    // Allocate cact buffer in WASM linear memory
    const cactPtr = Module._malloc(cactBinary.length)
    Module.HEAPU8.set(cactBinary, cactPtr)
    const loadRet = Module._cactus_load(cactPtr, BigInt(cactBinary.length))
    Module._free(cactPtr)

    if (loadRet !== 0) {
      const err = cactus_last_error()
      console.warn(`[NeedleNode] cactus_load warning (code ${loadRet}): ${err}`)
    }

    const instance = new NeedleNode(Module, {
      cactus_load,
      cactus_init,
      cactus_complete,
      cactus_embed,
      cactus_reset,
      cactus_models,
      cactus_last_error,
    }, cacheDir)

    instance.initExtractionTool()
    return instance
  }

  initExtractionTool() {
    const sysPrompt = 'You are an information extraction assistant. Extract mentions, temporal phrases, and factual claims using extract_memory_fragments.'
    const toolsJson = JSON.stringify([EXTRACT_MEMORY_FRAGMENTS_TOOL])
    this.cfuncs.cactus_init(sysPrompt, toolsJson, '')
    this.isInitialized = true
  }

  /**
   * Extract mentions, temporal phrases, and claims from a dialogue passage using Needle-3 WASM.
   * With Needle-3, `passage` can be multi-turn context up to 8,192 tokens.
   *
   * @param {string} passage - Full conversation context (e.g. multi-turn history or session)
   * @param {string} targetText - The specific target turn text for strict span verification
   * @returns {{ mentions: string[], temporal_phrase: string|null, claims: any[], confidence: number, rawOutput?: any }}
   */
  extractFragments(passage, targetText = passage) {
    if (!this.isInitialized) {
      this.initExtractionTool()
    }

    this.cfuncs.cactus_reset()

    const prompt = `Dialogue Context:\n${passage}\n\nTask: Extract mentions, temporal phrases, and claims from the target passage using extract_memory_fragments.`
    const compRet = this.cfuncs.cactus_complete(prompt, 0, 0, 192, this.outPtr, this.outCap)
    const outStr = this.Module.UTF8ToString(this.outPtr)

    let parsed = null
    try {
      parsed = JSON.parse(outStr)
    }
    catch {
      // Fallback extraction if JSON parse fails
      return this.fallbackExtract(targetText)
    }

    const calls = (Array.isArray(parsed?.function_calls) && parsed.function_calls.length > 0)
      ? parsed.function_calls
      : (Array.isArray(parsed?.suppressed_calls) && parsed.suppressed_calls.length > 0)
          ? parsed.suppressed_calls
          : []

    if (calls.length > 0) {
      const call = calls[0]
      const args = call.arguments || {}
      const validated = validateExtractionSpans(targetText, args)
      return {
        ...validated,
        confidence: parsed.confidence ?? 0.5,
        rawOutput: parsed,
      }
    }

    // If no tool was called or output was empty, use heuristic extraction
    return this.fallbackExtract(targetText)
  }

  /**
   * Generate a normalized dense vector embedding for input text.
   * Returns a 3,072-dimensional Float32Array unit vector.
   *
   * @param {string} text - Input text to embed
   * @returns {Float32Array|null}
   */
  embed(text) {
    if (!text || typeof text !== 'string')
      return null

    const dim = this.cfuncs.cactus_embed(text, 0, 0, this.embedPtr, this.embedCap)
    if (dim > 0) {
      // Slice out a clean Float32Array copy disconnected from WASM linear memory
      return new Float32Array(this.Module.HEAPU8.buffer, this.embedPtr, dim).slice()
    }

    const err = this.cfuncs.cactus_last_error()
    if (err) {
      console.warn('[NeedleNode] cactus_embed failed:', err)
    }
    return null
  }

  /**
   * Complete a general query using Needle-3 as an SLM answer head.
   *
   * @param {string} prompt
   * @param {number} maxTokens
   * @returns {string}
   */
  complete(prompt, maxTokens = 64) {
    this.cfuncs.cactus_reset()
    this.cfuncs.cactus_complete(prompt, 0, 0, maxTokens, this.outPtr, this.outCap)
    const outStr = this.Module.UTF8ToString(this.outPtr)
    try {
      const parsed = JSON.parse(outStr)
      if (parsed.reasoning)
        return parsed.reasoning
      if (parsed.text)
        return parsed.text
      return outStr
    }
    catch {
      return outStr
    }
  }

  /**
   * Heuristic fallback extractor for dialogue turns.
   */
  fallbackExtract(text) {
    const mentions = []
    const claims = []
    let temporal_phrase = null

    // Temporal patterns
    const timeMatch = text.match(/\b(last week|yesterday|three days ago|a few weeks ago|in April 2022|today|first week of April|last month)\b/i)
    if (timeMatch) {
      temporal_phrase = timeMatch[0]
    }

    // Capitalized entity names
    const words = text.split(/\s+/)
    for (const w of words) {
      const clean = w.replace(/^\W+|\W+$/g, '')
      if (clean.length > 2 && /^[A-Z][a-z]+$/.test(clean)) {
        if (!['Hey', 'The', 'And', 'Yes', 'What', 'When', 'Where', 'How', 'Did', 'Does', 'Any'].includes(clean)) {
          if (!mentions.includes(clean))
            mentions.push(clean)
        }
      }
    }

    // Check for pets / animals
    const animalMatch = text.match(/\b(pup|puppy|dog|dogs|cat|kitten)\b/i)
    if (animalMatch && !mentions.includes(animalMatch[0])) {
      mentions.push(animalMatch[0])
    }

    return {
      mentions,
      temporal_phrase,
      claims,
      confidence: 0.5,
    }
  }

  close() {
    if (this.outPtr) {
      this.Module._free(this.outPtr)
      this.outPtr = 0
    }
    if (this.embedPtr) {
      this.Module._free(this.embedPtr)
      this.embedPtr = 0
    }
  }
}
