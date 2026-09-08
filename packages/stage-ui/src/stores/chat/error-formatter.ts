export interface ChatErrorContext {
  model?: string
  provider?: string
}

export interface FormattedChatError {
  markdown: string
  message: string
  technicalDetail: string
  isAuthError: boolean
}

/**
 * Pure helper for inspecting thrown error shapes and compiling
 * user-facing Markdown error presentation cards.
 *
 * Zero Pinia/Vue dependencies. All UI mutation, persistence,
 * and lifecycle hooks remain in chat.ts.
 */
export function formatChatError(
  error: unknown,
  context: ChatErrorContext = {},
): FormattedChatError {
  let errorMessage = 'An unknown error occurred.'
  let technicalDetail = ''

  if (error && typeof error === 'object') {
    const errObj = error as Record<string, any>
    errorMessage = errObj.message || 'An object error occurred.'

    // Handle XSAIError or similar with response/data info
    try {
      const detail = errObj.response || errObj.data || errObj.body || (errObj.cause as any)?.response
      if (detail) {
        technicalDetail = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)
      }

      // Best effort: if message itself contains JSON (common in 429s), extract it
      if (errorMessage.includes('{') && errorMessage.includes('}')) {
        const potentialJson = errorMessage.substring(errorMessage.indexOf('{'), errorMessage.lastIndexOf('}') + 1)
        try {
          const parsed = JSON.parse(potentialJson)
          technicalDetail = JSON.stringify(parsed, null, 2)
          // Strip the JSON from the main message for cleaner display
          errorMessage = errorMessage.replace(potentialJson, '').trim()
        }
        catch {}
      }
    }
    catch {}
  }
  else {
    errorMessage = String(error)
  }

  const activeModelName = context.model || 'Default'
  const activeProviderName = context.provider || 'Default'
  const isAuthError = errorMessage.includes('401')
    || errorMessage.includes('403')
    || errorMessage.toLowerCase().includes('unauthorized')
    || errorMessage.toLowerCase().includes('api key')

  let fullErrorDisplay = `⚠️ **Chat Generation Failed**\n\n`
  fullErrorDisplay += `**Configured Model**: \`${activeModelName}\` *(Provider: \`${activeProviderName}\`)*\n\n`
  fullErrorDisplay += `**Error**: ${errorMessage}\n\n`
  fullErrorDisplay += `💡 **Suggested Fix**:\n`
  fullErrorDisplay += `👉 Click the **Brain Picker** (🧠 icon) in the top-right corner of this window to double-check or switch the model configured for this character.`
  if (isAuthError) {
    fullErrorDisplay += `\n*If switching models doesn't help, verify your API key in **Settings > Providers**.*`
  }
  if (technicalDetail) {
    fullErrorDisplay += `\n\n<details>\n<summary>🔍 Technical Details</summary>\n\n\`\`\`json\n${technicalDetail}\n\`\`\`\n</details>`
  }

  return {
    markdown: fullErrorDisplay,
    message: errorMessage,
    technicalDetail,
    isAuthError,
  }
}
