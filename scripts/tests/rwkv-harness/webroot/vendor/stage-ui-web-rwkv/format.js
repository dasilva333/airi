function cleanTurn(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim()
}
function messageText(content) {
  if (typeof content === 'string')
    return content
  if (Array.isArray(content))
    return content.map(part => typeof part?.text === 'string' ? part.text : '').join('')
  return ''
}
function buildRwkvPrompt(messages, options) {
  const parts = []
  for (const message of messages) {
    const text = cleanTurn(messageText(message.content))
    if (message.role === 'system') {
      if (text)
        parts.push(`System: ${text}`)
    }
    else if (message.role === 'assistant') {
      parts.push(`Assistant: ${text}`)
    }
    else {
      if (text)
        parts.push(`User: ${text}`)
    }
  }
  if (options?.enableG1Prefill !== false) {
    parts.push('Assistant: <think></think')
  }
  else {
    parts.push('Assistant:')
  }
  return parts.join('\n\n')
}
function createThinkPrefixStripper() {
  let flushed = false
  let buffer = ''
  return (chunk) => {
    if (flushed)
      return chunk
    buffer += chunk
    const prefixLen = buffer.match(/^\s*>?\s*/)?.[0].length ?? 0
    if (prefixLen >= buffer.length)
      return ''
    flushed = true
    const rest = buffer.slice(prefixLen)
    buffer = ''
    return rest
  }
}
function openAIChatChunk(id, created, model, delta, finishReason) {
  const chunk = {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  }
  return `data: ${JSON.stringify(chunk)}

`
}
const SSE_DONE = 'data: [DONE]\n\n'
function openAIChatCompletion(id, created, model, content, promptTokens, completionTokens) {
  return JSON.stringify({
    id,
    object: 'chat.completion',
    created,
    model,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  })
}
export {
  buildRwkvPrompt,
  createThinkPrefixStripper,
  openAIChatChunk,
  openAIChatCompletion,
  SSE_DONE,
}
