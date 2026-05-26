import { generateText } from '@xsai/generate-text'
import type { CommonRequestOptions } from '@xsai/shared'
import type { Message } from '@xsai/shared-chat'
import { message } from '@xsai/utils-chat'

import * as v from 'valibot'

export interface StructuredOutputOptions<T> extends Partial<CommonRequestOptions> {
  messages: Message[]
  model: string
  apiKey?: string
  baseURL?: string
  schema: v.BaseSchema<any, T, any>
  schemaName?: string
  maxAttempts?: number
  /**
   * Optional hook to normalize/remap the parsed JSON before final validation.
   * Useful for handling provider-specific alias drift (e.g. 'text' -> 'pill').
   */
  normalize?: (obj: any) => any
}

/**
 * Strips markdown code fences (backticks) from LLM responses.
 */
export function stripMarkdown(content: string): string {
  return content.replace(/^```[a-z]*\n|```$/gi, '').trim()
}

/**
 * Generates a structured object from an LLM with automatic repair and normalization.
 */
export async function generateObject<T>(options: StructuredOutputOptions<T>, attempt = 1): Promise<T> {
  const { messages, model, apiKey, baseURL, schema, maxAttempts = 3, normalize, ...llmOptions } = options

  // Append schema instructions on the first attempt if not present
  if (attempt === 1) {
    const schemaDesc = JSON.stringify(schema, null, 2)
    messages.push(
      message.user(`Your response MUST be a valid JSON object matching this schema:
${schemaDesc}

Output raw JSON only. Do not include markdown backticks or any preamble/postamble.`),
    )
  }

  const response = await generateText({
    apiKey: apiKey || '',
    baseURL: baseURL as `${string}/`,
    messages,
    model,
    ...llmOptions,
  })

  const rawText = response.text || (response as any).reasoning || (response as any).reasoning_content || ''
  const cleanText = stripMarkdown(rawText)

  let parsed: any
  try {
    parsed = JSON.parse(cleanText)
  } catch (parseError) {
    console.error('[StructuredOutput] JSON parse failed. Raw response:', rawText)
    if (attempt >= maxAttempts) {
      console.error(`[StructuredOutput] Failed to parse JSON after ${attempt} attempts.`, { rawText })
      throw parseError
    }

    console.warn(`[StructuredOutput] JSON parse failed (attempt ${attempt}). Repairing...`, parseError)
    messages.push(
      message.user(`Your previous response was not valid JSON. 
Error: ${String(parseError)}

Please provide the corrected JSON object matching the schema. Output raw JSON only.`),
    )

    return generateObject(options, attempt + 1)
  }

  // Local Normalization (Alias remapping)
  if (normalize) {
    parsed = normalize(parsed)
  }

  // Validation
  const result = v.safeParse(schema, parsed)
  if (!result.success) {
    if (attempt >= maxAttempts) {
      console.error(`[StructuredOutput] Schema validation failed after ${attempt} attempts.`, {
        errors: result.issues,
        parsed,
      })
      throw new Error(`Schema validation failed: ${result.issues.map((i) => i.message).join(', ')}`)
    }

    console.warn(`[StructuredOutput] Schema validation failed (attempt ${attempt}). Repairing...`, result.issues)
    messages.push(
      message.user(`Your JSON was valid, but did not match the required schema.
Issues: ${JSON.stringify(result.issues, null, 2)}

Please provide the corrected JSON object matching the schema.`),
    )

    return generateObject(options, attempt + 1)
  }

  return result.output
}
