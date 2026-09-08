import { describe, expect, it } from 'vitest'

import { parseBridgeArguments, recognizeToolMarker, tryParseLenientJson } from './tool-bridge'

describe('tool-bridge pure computational seams', () => {
  describe('tryParseLenientJson', () => {
    it('parses valid JSON directly', () => {
      const input = '{"name": "test", "count": 42, "flag": true}'
      expect(tryParseLenientJson(input)).toEqual({
        name: 'test',
        count: 42,
        flag: true,
      })
    })

    it('returns empty object for empty or whitespace strings', () => {
      expect(tryParseLenientJson('')).toEqual({})
      expect(tryParseLenientJson('   \n\t  ')).toEqual({})
    })

    it('recovers from unclosed quotes and braces at end of stream', () => {
      const input = '{"name": "weather_lookup", "city": "Tokyo'
      const result = tryParseLenientJson(input)
      expect(result).toHaveProperty('city', 'Tokyo')
      expect(result).toHaveProperty('name', 'weather_lookup')
    })

    it('balances unclosed braces and brackets when closing array of objects', () => {
      const input = '[{"id": 1}, {"id": 2'
      const result = tryParseLenientJson(input)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ id: 1 })
      expect(result[1]).toEqual({ id: 2 })
    })

    it('recovers from truncated trailing key using desperation cleanup', () => {
      const input = '{"valid": 123, "partial_key": "unfinished'
      const result = tryParseLenientJson(input)
      expect(result).toBeDefined()
    })
  })

  describe('recognizeToolMarker', () => {
    it('recognizes standard <|tool:args|> marker', () => {
      const input = 'Here is the search: <|web_search:query="Vue 3 release"|> and more text.'
      const match = recognizeToolMarker(input)
      expect(match.kind).toBe('candidate')
      if (match.kind === 'candidate') {
        expect(match.toolName).toBe('web_search')
        expect(match.argumentsText).toBe('query="Vue 3 release"')
        expect(match.matchedText).toBe('<|web_search:query="Vue 3 release"|>')
      }
    })

    it('recognizes hybrid <|tool:args</tool_call> marker', () => {
      const input = '<|calculator:expr="2 + 2"</tool_call>'
      const match = recognizeToolMarker(input)
      expect(match.kind).toBe('candidate')
      if (match.kind === 'candidate') {
        expect(match.toolName).toBe('calculator')
        expect(match.argumentsText).toBe('expr="2 + 2"')
        expect(match.matchedText).toBe('<|calculator:expr="2 + 2"</tool_call>')
      }
    })

    it('recognizes command-style [call_tool:tool, args] marker', () => {
      const input = 'Let me call that for you: [call_tool:fetch_weather, location="London"]'
      const match = recognizeToolMarker(input)
      expect(match.kind).toBe('candidate')
      if (match.kind === 'candidate') {
        expect(match.toolName).toBe('fetch_weather')
        expect(match.argumentsText).toBe('location="London"')
        expect(match.matchedText).toBe('[call_tool:fetch_weather, location="London"]')
      }
    })

    it('recognizes function-style <tool_call>tool(args)</tool_call> marker', () => {
      const input = '<tool_call>get_time(timezone="EST")</tool_call>'
      const match = recognizeToolMarker(input)
      expect(match.kind).toBe('candidate')
      if (match.kind === 'candidate') {
        expect(match.toolName).toBe('get_time')
        expect(match.argumentsText).toBe('timezone="EST"')
        expect(match.matchedText).toBe('<tool_call>get_time(timezone="EST")</tool_call>')
      }
    })

    it('recognizes JSON-style <tool_call>{"name": ..., "arguments": ...}</tool_call> marker', () => {
      const input = '<tool_call>{"name": "query_db", "arguments": {"sql": "SELECT 1"}}</tool_call>'
      const match = recognizeToolMarker(input)
      expect(match.kind).toBe('candidate')
      if (match.kind === 'candidate') {
        expect(match.toolName).toBe('query_db')
        expect(JSON.parse(match.argumentsText)).toEqual({ sql: 'SELECT 1' })
      }
    })

    it('returns malformed when JSON-style marker has invalid JSON syntax', () => {
      const input = '<tool_call>{"name": unquoted_broken}</tool_call>'
      const match = recognizeToolMarker(input)
      expect(match.kind).toBe('malformed')
      if (match.kind === 'malformed') {
        expect(match.matchedText).toBe('<tool_call>{"name": unquoted_broken}</tool_call>')
        expect(match.reason).toBeDefined()
      }
    })

    it('returns none when no tool marker patterns match', () => {
      expect(recognizeToolMarker('Just an ordinary conversational response.').kind).toBe('none')
      expect(recognizeToolMarker('Random brackets [like this] and {curly ones} without keywords').kind).toBe('none')
    })

    it('syntactically captures <|ACT:...|> tags as candidate for runtime resolution', () => {
      const match = recognizeToolMarker('<|ACT:smile|>')
      expect(match.kind).toBe('candidate')
      if (match.kind === 'candidate') {
        expect(match.toolName).toBe('ACT')
        expect(match.argumentsText).toBe('smile')
        expect(match.matchedText).toBe('<|ACT:smile|>')
      }
    })
  })

  describe('parseBridgeArguments', () => {
    it('parses key-value pairs with double and single quotes', () => {
      const args = parseBridgeArguments('name="Alice", nickname=\'Ally\'')
      expect(args).toEqual({
        name: 'Alice',
        nickname: 'Ally',
      })
    })

    it('parses numeric and boolean arguments', () => {
      const args = parseBridgeArguments('count=5, price=19.99, available=true, archived=false')
      expect(args).toEqual({
        count: 5,
        price: 19.99,
        available: true,
        archived: false,
      })
    })

    it('parses nested JSON object arguments', () => {
      const args = parseBridgeArguments('filter={"category": "books", "inStock": true}')
      expect(args).toEqual({
        filter: {
          category: 'books',
          inStock: true,
        },
      })
    })

    it('handles unclosed quote truncation gracefully', () => {
      const args = parseBridgeArguments('query="how to parse json in type')
      expect(args).toHaveProperty('query', 'how to parse json in type')
    })

    it('falls back to JSON object parser for object-literal formatted arguments', () => {
      const args = parseBridgeArguments('{ query: "test query", limit: 10 }')
      expect(args).toEqual({
        query: 'test query',
        limit: 10,
      })
    })

    it('returns empty object when arguments cannot be parsed or are empty', () => {
      expect(parseBridgeArguments('')).toEqual({})
      expect(parseBridgeArguments('   ')).toEqual({})
    })
  })
})
