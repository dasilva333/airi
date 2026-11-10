import type { MirageObject, MirageTextItem, MirageVisionResult, VisualEventSummaryOptions } from './types.js'

/**
 * Parses raw JSON output from Cactus Mirage WASM _cactus_describe.
 */
export function parseMirageOutput(rawJson: string, latencyMs = 0): MirageVisionResult {
  const result: MirageVisionResult = {
    reasoning: '',
    ocrText: '',
    objects: [],
    textItems: [],
    latencyMs,
    rawJson,
  }

  if (!rawJson || typeof rawJson !== 'string') {
    return result
  }

  try {
    const parsed = JSON.parse(rawJson)

    if (parsed.scene) {
      result.sceneSetting = parsed.scene.setting
      result.sceneBackground = parsed.scene.background
      result.sceneStyle = parsed.scene.style
    }

    if (typeof parsed.reasoning === 'string') {
      result.reasoning = parsed.reasoning.trim()
    }

    if (Array.isArray(parsed.objects)) {
      result.objects = parsed.objects.map((obj: any): MirageObject => ({
        id: obj.id,
        name: obj.name || 'unknown',
        bbox: obj.bbox || [0, 0, 0, 0],
        score: typeof obj.score === 'number' ? obj.score : 0,
        mask: Array.isArray(obj.mask) ? obj.mask : undefined,
        position: obj.position,
        description: obj.description,
      }))
    }

    if (Array.isArray(parsed.text)) {
      result.textItems = parsed.text.map((t: any): MirageTextItem => ({
        string: t.string || '',
        bbox: t.bbox || [0, 0, 0, 0],
        score: typeof t.score === 'number' ? t.score : 0,
      }))
      result.ocrText = result.textItems
        .map(t => t.string.trim())
        .filter(Boolean)
        .join(' ')
    }
  }
  catch {
    // If rawJson was malformed, fallback gracefully
    result.reasoning = rawJson.slice(0, 300).trim()
  }

  return result
}

/**
 * Synthesizes the structured [Visual Event] block for prompt injection into the primary LLM context.
 */
export function formatVisualEventSummary(options: VisualEventSummaryOptions): string {
  const {
    windowTitle = 'Desktop',
    theme,
    sceneReasoning,
    ocrSnippet,
    tags = [],
  } = options

  const lines: string[] = ['[Visual Event]']

  const windowStr = theme ? `${windowTitle} (${theme} mode)` : windowTitle
  lines.push(`Active Window: ${windowStr}`)

  if (sceneReasoning) {
    // Strip common filler preambles
    let cleanedReasoning = sceneReasoning
      .replace(/^(lang:\s*[a-z_-]+\s*\|\s*)?/i, '')
      .replace(/^(A|The)\s+(computer\s+)?(screen|screenshot|desktop|display|image)\s+(displays?|shows?|depicts?|features?)\s+(a|an)?\s*/i, '')
      .trim()
    if (cleanedReasoning) {
      cleanedReasoning = cleanedReasoning.charAt(0).toUpperCase() + cleanedReasoning.slice(1)
      lines.push(`Scene Perception: ${cleanedReasoning}`)
    }
  }

  if (ocrSnippet) {
    lines.push(`OCR Text Snippet: "${ocrSnippet}"`)
  }

  if (tags && tags.length > 0) {
    lines.push(`Screen Content Tags: [${tags.join(', ')}]`)
  }

  return lines.join('\n')
}

/**
 * Converts a MirageVisionResult directly to a canonical [Visual Event] summary.
 */
export function mirageResultToVisualEvent(
  result: MirageVisionResult,
  windowTitle?: string,
  theme?: string,
): string {
  const objectTags = Array.from(new Set(result.objects.map(o => o.name).filter(Boolean)))
  const snippet = result.ocrText ? result.ocrText.slice(0, 140) : undefined

  return formatVisualEventSummary({
    windowTitle,
    theme,
    sceneReasoning: result.reasoning,
    ocrSnippet: snippet,
    tags: objectTags.length > 0 ? objectTags : undefined,
  })
}
