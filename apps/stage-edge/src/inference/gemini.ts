/**
 * Gemini 2.0 Flash Edge Adapter for multimodal inference and memory summarization.
 */

export interface GeminiGenerateOptions {
  prompt: string
  systemInstruction?: string
  model?: string
  apiKey: string
}

export async function generateGeminiReply(options: GeminiGenerateOptions): Promise<string> {
  const model = options.model || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`

  const payload = {
    contents: [
      {
        parts: [{ text: options.prompt }],
      },
    ],
    systemInstruction: options.systemInstruction
      ? { parts: [{ text: options.systemInstruction }] }
      : undefined,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Gemini API call failed -> HTTP ${response.status}`)
  }

  const json: any = await response.json()
  const candidate = json.candidates?.[0]
  return candidate?.content?.parts?.[0]?.text || '(No response generated)'
}
