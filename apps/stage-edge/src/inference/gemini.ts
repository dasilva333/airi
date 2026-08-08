/**
 * Gemini 2.0 Flash Edge Adapter using OpenAI-compatible endpoint.
 * Uses the same base URL as AIRI's internal provider system:
 * https://generativelanguage.googleapis.com/v1beta/openai/
 */

export interface GeminiGenerateOptions {
  prompt: string
  systemInstruction?: string
  model?: string
  apiKey: string
}

export async function generateGeminiReply(options: GeminiGenerateOptions): Promise<string> {
  let model = options.model || 'gemini-3.5-flash-lite'
  if (model.startsWith('models/')) {
    model = model.replace(/^models\//, '')
  }
  const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'

  const messages: { role: string, content: string }[] = []

  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction })
  }

  messages.push({ role: 'user', content: options.prompt })

  const payload = {
    model,
    messages,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API call failed -> HTTP ${response.status} | URL: ${url} | model: ${model} | ${errText}`)
  }

  const json: any = await response.json()
  return json.choices?.[0]?.message?.content || '(No response generated)'
}
