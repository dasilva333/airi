import type { Tool } from '@xsai/shared-chat'

import { describe, expect, it } from 'vitest'

import {
  buildLiveSetupMessage,
  checkToolRateLimit,
  decodePcm16Chunk,
  extractInferenceUsage,
  formatToolResponsePayload,
  GEMINI_LIVE_MODEL,
  GEMINI_LIVE_WS_BASE,
  mapAiriToolToGemini,
  MAX_TOOL_CALLS_PER_TURN,
  parseBridgeMarker,
  sanitizeTokenCount,
} from './gemini-live-seams'

function makeTool(fn: { name: string, description?: string, parameters?: any }): Tool {
  return {
    type: 'function',
    execute: async () => '',
    function: fn as any,
  }
}

describe('gemini-live-seams', () => {
  describe('constants', () => {
    it('defines expected endpoint and model identifiers', () => {
      expect(GEMINI_LIVE_MODEL).toBe('models/gemini-3.1-flash-live-preview')
      expect(GEMINI_LIVE_WS_BASE).toContain('google.ai.generativelanguage.v1alpha')
      expect(MAX_TOOL_CALLS_PER_TURN).toBe(5)
    })
  })

  describe('mapAiriToolToGemini', () => {
    it('purifies top-level $schema and additionalProperties', () => {
      const tool = makeTool({
        name: 'test_tool',
        description: 'A test tool description',
        parameters: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          additionalProperties: false,
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      })

      const mapped = mapAiriToolToGemini(tool)
      expect(mapped.name).toBe('test_tool')
      expect(mapped.description).toBe('A test tool description')

      const params = mapped.parameters as any
      expect(params.$schema).toBeUndefined()
      expect(params.additionalProperties).toBeUndefined()
      expect(params.type).toBe('object')
      expect(params.properties.query).toEqual({ type: 'string' })
      expect(params.required).toEqual(['query'])
    })

    it('cleans nested schemas within properties and items', () => {
      const tool = makeTool({
        name: 'complex_tool',
        parameters: {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
              additionalProperties: false,
              items: {
                $schema: 'https://json-schema.org/schema',
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      })

      const mapped = mapAiriToolToGemini(tool)
      const params = mapped.parameters as any
      expect(params.properties.tags.additionalProperties).toBeUndefined()
      expect(params.properties.tags.items.$schema).toBeUndefined()
      expect(params.properties.tags.items.properties.name.type).toBe('string')
    })

    it('unwraps anyOf with nullable types and removes them from required', () => {
      const tool = makeTool({
        name: 'search_tool',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: {
              description: 'Optional limit',
              anyOf: [{ type: 'integer' }, { type: 'null' }],
            },
          },
          required: ['query', 'limit'],
        },
      })

      const mapped = mapAiriToolToGemini(tool)
      const params = mapped.parameters as any
      expect(params.properties.limit.type).toBe('integer')
      expect(params.properties.limit.anyOf).toBeUndefined()
      expect(params.properties.limit.description).toBe('Optional limit')
      expect(params.required).toEqual(['query'])
    })

    it('unwraps oneOf with nullable types and preserves property description', () => {
      const tool = makeTool({
        name: 'filter_tool',
        parameters: {
          type: 'object',
          properties: {
            category: {
              description: 'Category filter',
              oneOf: [{ type: 'string' }, { type: 'null' }],
            },
          },
          required: ['category'],
        },
      })

      const mapped = mapAiriToolToGemini(tool)
      const params = mapped.parameters as any
      expect(params.properties.category.type).toBe('string')
      expect(params.properties.category.oneOf).toBeUndefined()
      expect(params.properties.category.description).toBe('Category filter')
      expect(params.required).toBeUndefined()
    })

    it('normalizes type array ["string", "null"] to string and marks optional', () => {
      const tool = makeTool({
        name: 'note_tool',
        parameters: {
          type: 'object',
          properties: {
            note: {
              type: ['string', 'null'],
            },
          },
          required: ['note'],
        },
      })

      const mapped = mapAiriToolToGemini(tool)
      const params = mapped.parameters as any
      expect(params.properties.note.type).toBe('string')
      expect(params.required).toBeUndefined()
    })

    it('normalizes explicit type "null" to "string" and marks optional', () => {
      const tool = makeTool({
        name: 'null_type_tool',
        parameters: {
          type: 'object',
          properties: {
            val: { type: 'null' },
          },
          required: ['val'],
        },
      })

      const mapped = mapAiriToolToGemini(tool)
      const params = mapped.parameters as any
      expect(params.properties.val.type).toBe('string')
      expect(params.required).toBeUndefined()
    })

    it('handles missing or non-object parameters gracefully', () => {
      const toolWithoutParams = makeTool({
        name: 'no_params_tool',
        parameters: undefined,
      })

      const mapped = mapAiriToolToGemini(toolWithoutParams)
      expect(mapped.name).toBe('no_params_tool')
      expect(mapped.description).toBe('')
      expect(mapped.parameters).toEqual({
        type: 'object',
        properties: {},
      })
    })

    it('forces top-level type to object if schema specifies non-object', () => {
      const tool = makeTool({
        name: 'raw_tool',
        parameters: {
          type: 'string' as any,
        },
      })

      const mapped = mapAiriToolToGemini(tool)
      const params = mapped.parameters as any
      expect(params.type).toBe('object')
      expect(params.properties).toEqual({})
    })
  })

  describe('sanitizeTokenCount', () => {
    it('accepts positive integer numbers', () => {
      expect(sanitizeTokenCount(42)).toBe(42)
      expect(sanitizeTokenCount(1000000)).toBe(1000000)
    })

    it('floors positive floating point numbers', () => {
      expect(sanitizeTokenCount(123.85)).toBe(123)
      expect(sanitizeTokenCount(0.999)).toBe(0)
    })

    it('coerces valid numeric strings to integers', () => {
      expect(sanitizeTokenCount('2186')).toBe(2186)
      expect(sanitizeTokenCount(' 45 ')).toBe(45)
    })

    it('guards against negative numbers and zero', () => {
      expect(sanitizeTokenCount(-5)).toBe(0)
      expect(sanitizeTokenCount(-0.01)).toBe(0)
      expect(sanitizeTokenCount(0)).toBe(0)
    })

    it('guards against non-numeric types, NaN, null, and undefined', () => {
      expect(sanitizeTokenCount(Number.NaN)).toBe(0)
      expect(sanitizeTokenCount(null)).toBe(0)
      expect(sanitizeTokenCount(undefined)).toBe(0)
      expect(sanitizeTokenCount('abc')).toBe(0)
      expect(sanitizeTokenCount('')).toBe(0)
      expect(sanitizeTokenCount(true)).toBe(1)
      expect(sanitizeTokenCount(false)).toBe(0)
      expect(sanitizeTokenCount({})).toBe(0)
    })
  })

  describe('extractInferenceUsage', () => {
    it('returns null for null or undefined input', () => {
      expect(extractInferenceUsage(null)).toBeNull()
      expect(extractInferenceUsage(undefined)).toBeNull()
    })

    it('extracts from primitive numeric usage', () => {
      const result = extractInferenceUsage(150)
      expect(result).not.toBeNull()
      expect(result?.total).toBe(150)
      expect(result?.prompt).toBe(0)
      expect(result?.completion).toBe(0)
      expect(result?.recordedAt).toBeGreaterThan(0)
    })

    it('extracts standard snake_case tokens', () => {
      const result = extractInferenceUsage({
        prompt_tokens: 120,
        completion_tokens: 45,
        total_tokens: 165,
      })
      expect(result).toEqual({
        prompt: 120,
        completion: 45,
        total: 165,
        recordedAt: expect.any(Number),
      })
    })

    it('extracts camelCase tokens', () => {
      const result = extractInferenceUsage({
        promptTokens: 80,
        completionTokens: 20,
        totalTokens: 100,
      })
      expect(result).toEqual({
        prompt: 80,
        completion: 20,
        total: 100,
        recordedAt: expect.any(Number),
      })
    })

    it('extracts Google Bidi specific TokenCount fields', () => {
      const result = extractInferenceUsage({
        promptTokenCount: 200,
        candidatesTokenCount: 50,
        totalTokenCount: 250,
      })
      expect(result).toEqual({
        prompt: 200,
        completion: 50,
        total: 250,
        recordedAt: expect.any(Number),
      })
    })

    it('falls back to prompt + completion when total is zero or omitted', () => {
      const result = extractInferenceUsage({
        input_tokens: 60,
        output_tokens: 40,
        total_tokens: 0,
      })
      expect(result).toEqual({
        prompt: 60,
        completion: 40,
        total: 100,
        recordedAt: expect.any(Number),
      })
    })

    it('returns null when all extracted tokens sum to 0', () => {
      const result = extractInferenceUsage({
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      })
      expect(result).toBeNull()
    })
  })

  describe('buildLiveSetupMessage', () => {
    it('enforces mandatory AUDIO response modality', () => {
      const msg = buildLiveSetupMessage() as any
      expect(msg.setup.generationConfig.responseModalities).toEqual(['AUDIO'])
    })

    it('configures default Puck voice and fallback system prompt', () => {
      const msg = buildLiveSetupMessage() as any
      expect(msg.setup.model).toBe(GEMINI_LIVE_MODEL)
      expect(msg.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Puck')
      expect(msg.setup.systemInstruction.parts[0].text).toBe('You are an AI assistant.')
      expect(msg.setup.historyConfig.initialHistoryInClientContent).toBe(true)
      expect(msg.setup.tools).toBeUndefined()
    })

    it('applies custom voice name, custom model, and custom system prompt', () => {
      const msg = buildLiveSetupMessage({
        model: 'models/gemini-2.0-flash-exp',
        voiceName: 'Aoede',
        systemPrompt: 'You are Airi, a helpful anime assistant.',
      }) as any

      expect(msg.setup.model).toBe('models/gemini-2.0-flash-exp')
      expect(msg.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Aoede')
      expect(msg.setup.systemInstruction.parts[0].text).toBe('You are Airi, a helpful anime assistant.')
    })

    it('maps tools to functionDeclarations array', () => {
      const tool = makeTool({
        name: 'get_weather',
        description: 'Get current weather',
        parameters: {
          type: 'object',
          properties: { city: { type: 'string' } },
        },
      })

      const msg = buildLiveSetupMessage({ resolvedTools: [tool] }) as any
      expect(msg.setup.tools).toHaveLength(1)
      expect(msg.setup.tools[0].functionDeclarations).toHaveLength(1)
      expect(msg.setup.tools[0].functionDeclarations[0].name).toBe('get_weather')
    })

    it('injects google_search tool only when grounding is enabled', () => {
      const msgWithout = buildLiveSetupMessage({ isGroundingEnabled: false }) as any
      expect(msgWithout.setup.tools).toBeUndefined()

      const msgWith = buildLiveSetupMessage({ isGroundingEnabled: true }) as any
      expect(msgWith.setup.tools).toHaveLength(1)
      expect(msgWith.setup.tools[0]).toEqual({ google_search: {} })
    })

    it('combines functionDeclarations and google_search when both are present', () => {
      const tool = makeTool({
        name: 'calc',
        parameters: { type: 'object', properties: {} },
      })

      const msg = buildLiveSetupMessage({
        resolvedTools: [tool],
        isGroundingEnabled: true,
      }) as any

      expect(msg.setup.tools).toHaveLength(2)
      expect(msg.setup.tools[0].functionDeclarations).toBeDefined()
      expect(msg.setup.tools[1]).toEqual({ google_search: {} })
    })
  })

  describe('parseBridgeMarker', () => {
    it('returns null for non-string or empty inputs', () => {
      expect(parseBridgeMarker('')).toBeNull()
      expect(parseBridgeMarker(null as any)).toBeNull()
      expect(parseBridgeMarker(undefined as any)).toBeNull()
      expect(parseBridgeMarker('Hello world, no markers here')).toBeNull()
    })

    it('parses JSON dialect with direct object preservation (no stringify regex mangling)', () => {
      const marker = '<tool_call>{"name": "search", "arguments": {"query": "anime news: latest", "limit": 10}}</tool_call>'
      const parsed = parseBridgeMarker(marker)

      expect(parsed).not.toBeNull()
      expect(parsed?.toolName).toBe('search')
      expect(parsed?.args).toEqual({
        query: 'anime news: latest',
        limit: 10,
      })
    })

    it('parses JSON dialect with nested objects without colon mangling', () => {
      const marker = '<tool_call>{"name": "store_memory", "arguments": {"metadata": {"uri": "https://example.com/item:1"}, "tags": ["a", "b"]}}</tool_call>'
      const parsed = parseBridgeMarker(marker)

      expect(parsed).not.toBeNull()
      expect(parsed?.toolName).toBe('store_memory')
      expect(parsed?.args).toEqual({
        metadata: { uri: 'https://example.com/item:1' },
        tags: ['a', 'b'],
      })
    })

    it('parses bracket pseudo-token dialect <|tool:key="value"|>', () => {
      const marker = '<|set_volume:level=75 muted=false target="speaker"|>'
      const parsed = parseBridgeMarker(marker)

      expect(parsed).not.toBeNull()
      expect(parsed?.toolName).toBe('set_volume')
      expect(parsed?.args).toEqual({
        level: 75,
        muted: false,
        target: 'speaker',
      })
    })

    it('parses [call_tool:name, key="val"] bracket dialect', () => {
      const marker = '[call_tool:weather, location="Tokyo", celsius=true]'
      const parsed = parseBridgeMarker(marker)

      expect(parsed).not.toBeNull()
      expect(parsed?.toolName).toBe('weather')
      expect(parsed?.args).toEqual({
        location: 'Tokyo',
        celsius: true,
      })
    })

    it('parses function syntax <tool_call>name(key="val")</tool_call>', () => {
      const marker = '<tool_call>translate(text="konnichiwa", target="en")</tool_call>'
      const parsed = parseBridgeMarker(marker)

      expect(parsed).not.toBeNull()
      expect(parsed?.toolName).toBe('translate')
      expect(parsed?.args).toEqual({
        text: 'konnichiwa',
        target: 'en',
      })
    })

    it('falls back to query parameter for single string bracket marker', () => {
      const marker = '<|search:genshin impact update 5.4|>'
      const parsed = parseBridgeMarker(marker)

      expect(parsed).not.toBeNull()
      expect(parsed?.toolName).toBe('search')
      expect(parsed?.args).toEqual({
        query: 'genshin impact update 5.4',
      })
    })

    it('returns null for malformed JSON tool call', () => {
      const marker = '<tool_call>{invalid json</tool_call>'
      expect(parseBridgeMarker(marker)).toBeNull()
    })
  })

  describe('formatToolResponsePayload', () => {
    it('formats string result as { output: str }', () => {
      const payload = formatToolResponsePayload('call-1', 'get_weather', 'Sunny, 22°C')
      expect(payload).toEqual({
        toolResponse: {
          functionResponses: [{
            id: 'call-1',
            name: 'get_weather',
            response: { output: 'Sunny, 22°C' },
          }],
        },
      })
    })

    it('formats object result directly without wrapping in output', () => {
      const payload = formatToolResponsePayload('call-2', 'calc', { result: 42, unit: 'px' })
      expect(payload).toEqual({
        toolResponse: {
          functionResponses: [{
            id: 'call-2',
            name: 'calc',
            response: { result: 42, unit: 'px' },
          }],
        },
      })
    })

    it('formats Error instance as { error: message }', () => {
      const payload = formatToolResponsePayload('call-3', 'fail_tool', new Error('Permission denied'))
      expect(payload).toEqual({
        toolResponse: {
          functionResponses: [{
            id: 'call-3',
            name: 'fail_tool',
            response: { error: 'Permission denied' },
          }],
        },
      })
    })

    it('formats primitive numbers and booleans', () => {
      const payload = formatToolResponsePayload('call-4', 'num_tool', 12345)
      expect(payload).toEqual({
        toolResponse: {
          functionResponses: [{
            id: 'call-4',
            name: 'num_tool',
            response: { output: '12345' },
          }],
        },
      })
    })
  })

  describe('checkToolRateLimit', () => {
    it('allows tool execution when counter is below maximum limit', () => {
      const result = checkToolRateLimit(0, 5)
      expect(result.allowed).toBe(true)
      expect(result.rateLimitPayload).toBeUndefined()

      const result4 = checkToolRateLimit(4, 5)
      expect(result4.allowed).toBe(true)
      expect(result4.rateLimitPayload).toBeUndefined()
    })

    it('blocks tool execution when counter reaches limit and returns error response payload', () => {
      const result = checkToolRateLimit(5, 5, { callId: 'call-limit', name: 'search' })
      expect(result.allowed).toBe(false)
      expect(result.rateLimitPayload).toBeDefined()

      const fnResp = (result.rateLimitPayload as any).toolResponse.functionResponses[0]
      expect(fnResp.id).toBe('call-limit')
      expect(fnResp.name).toBe('search')
      expect(fnResp.response.error).toContain('Tool call limit reached (5 per turn)')
    })

    it('blocks tool execution when counter exceeds limit without callInfo', () => {
      const result = checkToolRateLimit(6, 5)
      expect(result.allowed).toBe(false)
      expect(result.rateLimitPayload).toBeUndefined()
    })
  })

  describe('decodePcm16Chunk', () => {
    it('returns empty Float32Array for empty input', () => {
      const decoded = decodePcm16Chunk('')
      expect(decoded.length).toBe(0)
      expect(decoded).toBeInstanceOf(Float32Array)
    })

    it('decodes 16-bit little-endian PCM to normalized float values', () => {
      const pcmBytes = new Uint8Array([0x00, 0x00, 0x00, 0x40])
      const base64 = Buffer.from(pcmBytes).toString('base64')

      const decoded = decodePcm16Chunk(base64)
      expect(decoded.length).toBe(2)
      expect(decoded[0]).toBe(0)
      expect(decoded[1]).toBeCloseTo(0.5, 3)
    })

    it('correctly maps full positive and negative amplitude extremes', () => {
      const pcmBytes = new Uint8Array([0x00, 0x80, 0xFF, 0x7F])
      const base64 = Buffer.from(pcmBytes).toString('base64')

      const decoded = decodePcm16Chunk(base64)
      expect(decoded.length).toBe(2)
      expect(decoded[0]).toBe(-1.0)
      expect(decoded[1]).toBeCloseTo(0.999969, 4)
    })
  })
})
