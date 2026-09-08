import { stripMarkers } from '../../composables/response-categoriser'

export interface DiscordOutboundResult {
  content: string
  isError: boolean
}

export interface DiscordOutboundInput {
  rawContent?: string
  content?: string
  slices?: any[]
  error?: any
}

/**
 * Pure helper for converting internal model outputs, tool slices, and errors
 * into Discord-formatted Markdown replies.
 */
export function formatDiscordOutboundReply(
  output: DiscordOutboundInput,
  outputText?: string,
): DiscordOutboundResult | null {
  if (output.error) {
    const errorMsg = typeof output.error === 'string'
      ? output.error
      : (output.error.message || 'Unknown Error')
    return {
      content: `⚠️ **AIRI encountered a technical problem.**\n*(Error: ${errorMsg})*`,
      isError: true,
    }
  }

  const ttsText = output.rawContent || outputText || output.content
  if (!ttsText) {
    return null
  }

  let rawText = typeof ttsText === 'string' ? ttsText : String(ttsText)

  // Convert ACTOR tokens to bold bracketed format (e.g. <|ACTOR:actor_oshino_shinobu|> -> **[oshino_shinobu]**:)
  // Notice: \s* consumes trailing whitespace after the token so we don't end up with double spaces.
  rawText = rawText.replace(/<\|ACTOR:([^|>]+)(?:\|>|>)\s*/gi, (_, captured) => {
    let cleanName = captured.trim()
    if (cleanName.toLowerCase().startsWith('actor_')) {
      cleanName = cleanName.substring(6)
    }
    else if (cleanName.toLowerCase().startsWith('actress_')) {
      cleanName = cleanName.substring(8)
    }
    return `**[${cleanName}]**: `
  })

  let cleanedText = stripMarkers(rawText).trim()

  const currentToolSlices = output.slices?.filter((s: any) => s.type === 'tool-call') || []
  if (currentToolSlices.length > 0) {
    const formattedCalls = currentToolSlices.map((slice: any) => {
      const name = slice.toolCall?.toolName || slice.toolCall?.function?.name || 'unknown'
      const rawArgs = slice.toolCall?.args || slice.toolCall?.function?.arguments

      let parsedArgs: any = null
      if (rawArgs) {
        try {
          parsedArgs = JSON.parse(rawArgs)
        }
        catch {}
      }

      if (name === 'text_journal') {
        const action = parsedArgs?.action
        if (action === 'create') {
          const title = parsedArgs?.title || 'Untitled Entry'
          const content = parsedArgs?.content || ''
          return `\n\n### New Journal Entry: ${title}\n> ${content}`
        }
        if (action === 'search') {
          const query = parsedArgs?.query || ''
          const limit = parsedArgs?.limit || 3
          return `\n\n🔍 Searching Journal: "${query}" (limit: ${limit})`
        }
      }
      else if (name === 'image_journal') {
        const action = parsedArgs?.action
        if (action === 'create') {
          const prompt = parsedArgs?.prompt || ''
          const titleStr = parsedArgs?.title ? ` (title: "${parsedArgs.title}")` : ''
          const modeStr = parsedArgs?.mode ? ` (mode: "${parsedArgs.mode}")` : ''
          return `\n\n🎨 Generating Image: "${prompt}"${titleStr}${modeStr}`
        }
        if (action === 'apply' || action === 'set_as_background') {
          const query = parsedArgs?.query || ''
          return `\n\n🖼️ Applying Background: "${query}"`
        }
      }

      // Fallback to raw JSON style
      let argsStr = ''
      if (rawArgs) {
        try {
          argsStr = JSON.stringify(parsedArgs || JSON.parse(rawArgs))
        }
        catch {
          argsStr = rawArgs
        }
      }
      return `\n🔧 \`${name}\` | \`${argsStr}\``
    }).join('')
    cleanedText += formattedCalls
  }

  if (!cleanedText.trim()) {
    return null
  }

  return {
    content: cleanedText,
    isError: false,
  }
}

/**
 * Pure helper for formatting inbound Discord messages before ingestion into the chat orchestrator.
 */
export function formatDiscordInboundMessage(displayName: string, content: string): string {
  return `${displayName} says:\n${content}`
}

/**
 * Pure helper for rolling up partial text when a user interrupts an active turn in steer mode.
 */
export function formatDiscordSteerInterruption(
  partialText: string | unknown,
  displayName: string,
  content: string,
): string {
  const textStr = typeof partialText === 'string'
    ? partialText
    : Array.isArray(partialText)
      ? partialText.map((part: any) => part?.text || '').join('')
      : ''

  if (textStr) {
    return `You were saying: "${textStr}", but then ${displayName} interrupted with:\n${content}`
  }
  return formatDiscordInboundMessage(displayName, content)
}
