import { describe, expect, it } from 'vitest'

import {
  boxResizeGray,
  computeAHash,
  computeDeltaBBox,
  hammingDistance,
  normalizedHammingDistance,
  STAGE0_HAMMING_MIN,
  toGray,
} from './hash'
import {
  formatVisualEventSummary,
  mirageResultToVisualEvent,
  parseMirageOutput,
} from './mirage'
import {
  AttentionPromotionLimiter,
  DEFAULT_ERROR_PATTERNS,
  evaluateSalience,
  extractRelevantSnippet,
  matchInterestTags,
  matchPatterns,
} from './policy'
import {
  calculateCosineDistance,
  calculateCosineSimilarity,
  centroidOf,
  normalizeVector,
  updateCentroid,
} from './vector'

describe('attention Ecology — Hash & Pixel Math', () => {
  it('converts RGB to Rec. 601 grayscale', () => {
    // 2x1 RGB: white (255, 255, 255) and black (0, 0, 0)
    const rgb = new Uint8Array([255, 255, 255, 0, 0, 0])
    const gray = toGray(rgb, 2, 1, 3)
    expect(gray.length).toBe(2)
    expect(gray[0]).toBe(255)
    expect(gray[1]).toBe(0)
  })

  it('boxResizeGray downsamples a 4x4 image to 2x2', () => {
    // 4x4 with 4 quadrants: 100, 200, 50, 150
    const src = new Uint8Array([
      100,
      100,
      200,
      200,
      100,
      100,
      200,
      200,
      50,
      50,
      150,
      150,
      50,
      50,
      150,
      150,
    ])
    const dst = boxResizeGray(src, 4, 4, 2, 2)
    expect(dst[0]).toBe(100)
    expect(dst[1]).toBe(200)
    expect(dst[2]).toBe(50)
    expect(dst[3]).toBe(150)
  })

  it('computes 1024-bit aHash and detects distance', () => {
    const gridA = new Uint8Array(1024).fill(100)
    gridA[0] = 200 // 1 pixel above mean

    const hashA = computeAHash(gridA)
    expect(hashA.bits.length).toBe(1024)
    expect(hashA.hex.length).toBe(256) // 1024 bits / 4 bits per hex = 256 chars

    const gridB = new Uint8Array(1024).fill(100)
    gridB[0] = 200
    gridB[1] = 200 // 2 pixels above mean

    const hashB = computeAHash(gridB)
    const dist = hammingDistance(hashA.bits, hashB.bits)
    expect(dist).toBeGreaterThanOrEqual(1)
    expect(normalizedHammingDistance(hashA.bits, hashB.bits)).toBe(dist / 1024)
    expect(STAGE0_HAMMING_MIN).toBeGreaterThan(0)
  })

  it('computes bounding box of changes between two gray buffers', () => {
    const width = 100
    const height = 100
    const prev = new Uint8Array(width * height).fill(50)
    const curr = new Uint8Array(width * height).fill(50)

    // Modify a small block at (30, 40) of size (20, 20) with diff >= 24
    for (let y = 40; y < 60; y++) {
      for (let x = 30; x < 50; x++) {
        curr[y * width + x] = 200
      }
    }

    const bbox = computeDeltaBBox(prev, curr, width, height)
    expect(bbox).not.toBeNull()
    expect(bbox!.left).toBeLessThanOrEqual(30)
    expect(bbox!.top).toBeLessThanOrEqual(40)
    expect(bbox!.width).toBeGreaterThanOrEqual(20)
    expect(bbox!.height).toBeGreaterThanOrEqual(20)
  })
})

describe('attention Ecology — Vector & Centroid Math', () => {
  it('calculates cosine similarity and distance accurately', () => {
    const v1 = new Float32Array([1, 0, 0])
    const v2 = new Float32Array([1, 0, 0])
    const v3 = new Float32Array([0, 1, 0])

    expect(calculateCosineSimilarity(v1, v2)).toBeCloseTo(1.0)
    expect(calculateCosineDistance(v1, v2)).toBeCloseTo(0.0)

    expect(calculateCosineSimilarity(v1, v3)).toBeCloseTo(0.0)
    expect(calculateCosineDistance(v1, v3)).toBeCloseTo(1.0)

    const norm = normalizeVector(new Float32Array([3, 4]))
    expect(norm[0]).toBeCloseTo(0.6)
    expect(norm[1]).toBeCloseTo(0.8)

    const centroid = centroidOf([v1, v2])
    expect(centroid).not.toBeNull()
    expect(centroid![0]).toBeCloseTo(1.0)
  })

  it('updates centroid with rolling blend', () => {
    const v1 = new Float32Array([1, 0])
    const v2 = new Float32Array([0, 1])
    const centroid = updateCentroid(v1, v2, 0.5)

    // Blend is [0.5, 0.5], normalized is [1/sqrt(2), 1/sqrt(2)]
    const expected = 1 / Math.SQRT2
    expect(centroid[0]).toBeCloseTo(expected)
    expect(centroid[1]).toBeCloseTo(expected)
  })
})

describe('attention Ecology — Policy & Gating', () => {
  it('matches system error patterns and extracts relevant snippet', () => {
    const text = 'TypeError: Cannot read property of undefined\n  at main.ts:42\nCommand failed with exit code 1'
    const matches = matchPatterns(text, DEFAULT_ERROR_PATTERNS)
    expect(matches.length).toBeGreaterThanOrEqual(2)

    const snippet = extractRelevantSnippet(text, matches)
    expect(snippet).toContain('TypeError')
  })

  it('matches user interest tags case-insensitively', () => {
    const text = 'Opened AIRI companion settings and inspected stage_mate logs'
    const tags = ['airi', 'Stage-Mate', 'terminal']
    const matched = matchInterestTags(text, tags)
    expect(matched).toContain('airi')
    expect(matched).toContain('Stage-Mate')
    expect(matched).not.toContain('terminal')
  })

  it('evaluates salience decisions: PROMOTE on error cascade', () => {
    const evalResult = evaluateSalience({
      frameId: 'frame-1',
      novelty: 0.05,
      ocrText: 'Fatal: command not found\nSyntaxError: unexpected token',
      interestKeywords: [],
    })
    expect(evalResult.decision).toBe('PROMOTE')
    expect(evalResult.packet).toBeDefined()
    expect(evalResult.packet?.caption).toBe('terminal_error')
  })

  it('evaluates salience decisions: NOTE on single minor error', () => {
    const evalResult = evaluateSalience({
      frameId: 'frame-2',
      novelty: 0.01,
      ocrText: 'Minor warning: deprecation notice',
      errorPatterns: ['warning'],
      interestKeywords: [],
      thresholds: { ocrErrorPatternsMin: 2 },
    })
    expect(evalResult.decision).toBe('NOTE')
  })

  it('enforces rate limits in AttentionPromotionLimiter', () => {
    const limiter = new AttentionPromotionLimiter(2, 1000)
    const t0 = 100000

    expect(limiter.isPromotionAllowed(t0)).toBe(true)
    limiter.recordPromotion(t0)

    // Under hysteresis cooldown (500ms < 1000ms)
    expect(limiter.isPromotionAllowed(t0 + 500)).toBe(false)

    // Past cooldown (1100ms >= 1000ms) -> second promotion allowed
    expect(limiter.isPromotionAllowed(t0 + 1100)).toBe(true)
    limiter.recordPromotion(t0 + 1100)

    // Reached max 2 per hour
    expect(limiter.isPromotionAllowed(t0 + 2500)).toBe(false)
  })
})

describe('attention Ecology — Mirage Parsing & Visual Event Formatting', () => {
  it('parses Cactus Mirage JSON correctly', () => {
    const rawJson = JSON.stringify({
      scene: { setting: 'computer desktop', style: 'screenshot' },
      reasoning: 'lang: en | computer screen, software window | terminal window is open displaying shell output',
      objects: [
        { id: 1, name: 'terminal window', bbox: [10, 10, 800, 600], score: 0.95 },
      ],
      text: [
        { string: 'pnpm test:attention', bbox: [20, 30, 200, 50], score: 0.88 },
        { string: 'All tests passed', bbox: [20, 60, 250, 80], score: 0.92 },
      ],
    })

    const parsed = parseMirageOutput(rawJson, 120)
    expect(parsed.latencyMs).toBe(120)
    expect(parsed.sceneSetting).toBe('computer desktop')
    expect(parsed.reasoning).toContain('terminal window is open')
    expect(parsed.objects.length).toBe(1)
    expect(parsed.objects[0].name).toBe('terminal window')
    expect(parsed.ocrText).toBe('pnpm test:attention All tests passed')

    const event = mirageResultToVisualEvent(parsed, 'iTerm', 'dark')
    expect(event).toContain('Active Window: iTerm (dark mode)')
    expect(event).toContain('Screen Content Tags: [terminal window]')
  })

  it('formats Visual Event summary accurately for prompt injection', () => {
    const summary = formatVisualEventSummary({
      windowTitle: 'Terminal',
      theme: 'dark',
      sceneReasoning: 'A computer screen displays code editor open with TypeScript errors',
      ocrSnippet: 'TypeError: undefined is not a function',
      tags: ['terminal', 'code_editor'],
    })

    expect(summary).toContain('[Visual Event]')
    expect(summary).toContain('Active Window: Terminal (dark mode)')
    expect(summary).toContain('Scene Perception: Code editor open with TypeScript errors')
    expect(summary).toContain('OCR Text Snippet: "TypeError: undefined is not a function"')
    expect(summary).toContain('Screen Content Tags: [terminal, code_editor]')
  })
})
