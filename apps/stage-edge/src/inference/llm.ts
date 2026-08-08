/**
 * Provider-agnostic LLM Edge Adapter using OpenAI-compatible chat/completions endpoint.
 * Requires an explicit base URL — no provider-specific fallbacks.
 */

export interface LlmGenerateOptions {
  prompt: string
  systemInstruction?: string
  model?: string
  apiKey: string
  baseUrl?: string
}

export async function generateLlmReply(options: LlmGenerateOptions): Promise<string> {
  let model = options.model || 'gemini-3.5-flash-lite'
  if (model.startsWith('models/')) {
    model = model.replace(/^models\//, '')
  }

  // Determine target API endpoint — baseUrl is required
  let url = options.baseUrl
  if (url) {
    url = url.replace(/\/+$/, '')
    if (!url.endsWith('/chat/completions')) {
      url = `${url}/chat/completions`
    }
  }
  else {
    throw new Error('LLM base URL not configured — cannot route inference request')
  }

  const messages: { role: string, content: string }[] = []

  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction })
  }

  messages.push({ role: 'user', content: options.prompt })

  const payload = {
    model,
    messages,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${options.apiKey}`,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`LLM API call failed -> HTTP ${response.status} | URL: ${url} | model: ${model} | ${errText}`)
  }

  const json: any = await response.json()
  const rawContent: string = json.choices?.[0]?.message?.content || ''
  const cleanedContent = rawContent.replace(/<\|ACT:.*?\|>/g, '').trim()
  return cleanedContent || '(No response generated)'
}
