export type MarkerRecognition
  = | { kind: 'none' }
    | { kind: 'malformed', matchedText: string, reason: string }
    | { kind: 'candidate', matchedText: string, toolName: string, argumentsText: string }

/**
 * Lenient JSON parser with recovery for unclosed quotes, brackets, braces,
 * and truncated trailing keys.
 */
export function tryParseLenientJson(json: string): any {
  let sanitized = json.trim()
  if (!sanitized)
    return {}

  // Handle unclosed quotes at the end of the string
  const openQuotes = (sanitized.match(/"/g) || []).length
  if (openQuotes % 2 !== 0) {
    sanitized += '"'
  }

  // Handle missing closing braces/brackets
  const openBraces = (sanitized.match(/\{/g) || []).length
  const closeBraces = (sanitized.match(/\}/g) || []).length
  for (let i = 0; i < openBraces - closeBraces; i++) {
    sanitized += '}'
  }

  const openBrackets = (sanitized.match(/\[/g) || []).length
  const closeBrackets = (sanitized.match(/\]/g) || []).length
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    sanitized += ']'
  }

  try {
    return JSON.parse(sanitized)
  }
  catch (e) {
    // If still failing, try one last desperation fix: remove the last key if it looks truncated
    try {
      const desperation = `${sanitized.replace(/,\s*"[\w-]+"[:\s]*"[^"]*$/g, '')}}`
      return JSON.parse(desperation)
    }
    catch {
      throw e
    }
  }
}

/**
 * Recognizes bridged tool call markers across multiple syntax dialects:
 * 1. `<|toolName:args|>`
 * 2. `[call_tool:toolName, args]`
 * 3. `<tool_call>toolName(args)</tool_call>`
 * 4. `<tool_call>{"name": "...", "arguments": ...}</tool_call>`
 *
 * Preserves regex precedence and handles hybrid/partial closures.
 */
export function recognizeToolMarker(input: string): MarkerRecognition {
  // Supports: <|tool:args|>, [call_tool:tool, args], and hybrid <|tool:args</tool_call>
  // Use non-greedy match and NO start-of-line anchor to allow finding markers within blocks.
  const match = input.match(/<\|([\w-]+):([^|]*?)(?:\|>|<\/tool_call>|$)/)
    || input.match(/\[call_tool:([\w-]+),\s*([^\]]*?)(?:\]|<\/tool_call>|$)/)
    || input.match(/<tool_call>([\w-]+)\((.*?)\)<\/tool_call>/s)
    || input.match(/<tool_call>(\{.*?\})<\/tool_call>/s)

  if (!match)
    return { kind: 'none' }

  const matchedText = match[0]
  const potentialJson = (match[1] || '').trim()

  // check if it's the JSON flavor: <tool_call>{"name": "...", "arguments": "..."}</tool_call>
  if (potentialJson.startsWith('{')) {
    try {
      const parsed = tryParseLenientJson(potentialJson)
      if (!parsed || typeof parsed !== 'object' || !parsed.name) {
        return {
          kind: 'malformed',
          matchedText,
          reason: 'Parsed JSON tool call tag missing required "name" property',
        }
      }
      const toolName = parsed.name
      const argumentsText = typeof parsed.arguments === 'string'
        ? parsed.arguments
        : JSON.stringify(parsed.arguments ?? {})
      return {
        kind: 'candidate',
        matchedText,
        toolName,
        argumentsText,
      }
    }
    catch (e) {
      return {
        kind: 'malformed',
        matchedText,
        reason: `Failed to parse JSON tool call tag: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
  }

  return {
    kind: 'candidate',
    matchedText,
    toolName: match[1],
    argumentsText: match[2] || '',
  }
}

/**
 * Parses raw bridge arguments string into typed key-value pairs.
 * Supports string literals (double & single quoted), numbers, booleans,
 * and nested JSON structures with truncation resilience.
 */
export function parseBridgeArguments(argumentsText: string): Record<string, unknown> {
  const args: Record<string, any> = {}

  // NOTICE: We allow unclosed quotes at the end of the string (?:'|$) to handle truncation gracefully.
  // We use a non-capturing group (?:...) for the alternatives to keep the group indexes for key/valDouble/etc consistent.
  const kvRegex = /(?:^|[, \n\t]+)\s*([\w-]+)\s*[:=]\s*(?:"([^"]*)(?:"|$)|'([^']*)(?:'|$)|(\d+(?:\.\d+)?)|(true|false)|(\{.*(?:\}|$)|\[.*(?:\]|$)))/g
  let kvMatch

  while ((kvMatch = kvRegex.exec(argumentsText)) !== null) {
    const [, key, valDouble, valSingle, valNum, valBool, valComplex] = kvMatch
    if (valDouble !== undefined) {
      args[key] = valDouble
    }
    else if (valSingle !== undefined) {
      args[key] = valSingle
    }
    else if (valNum !== undefined) {
      args[key] = Number.parseFloat(valNum)
    }
    else if (valBool !== undefined) {
      args[key] = valBool === 'true'
    }
    else if (valComplex !== undefined) {
      try {
        // Try to sanitize and parse complex JSON-like objects
        const sanitized = valComplex
          .replace(/'/g, '"')
          .trim()

        // If it looks truncated (starts with { but doesn't end with }), try to close it
        let toParse = sanitized
        if (toParse.startsWith('{') && !toParse.endsWith('}'))
          toParse += '}'
        if (toParse.startsWith('[') && !toParse.endsWith(']'))
          toParse += ']'

        args[key] = JSON.parse(toParse)
      }
      catch {
        args[key] = valComplex
      }
    }
  }

  if (Object.keys(args).length === 0) {
    try {
      let cleaned = argumentsText.trim().replace(/^\{/, '').replace(/\}$/, '').replace(/(\w+):/g, '"$1":').replace(/'/g, '"')
      if (argumentsText.trim().startsWith('{') && !cleaned.endsWith('}'))
        cleaned += '"}' // Guessing it ended inside a string
      Object.assign(args, JSON.parse(`{${cleaned}}`))
    }
    catch {}
  }

  return args
}
