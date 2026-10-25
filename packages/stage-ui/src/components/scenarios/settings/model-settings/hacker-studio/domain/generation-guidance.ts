/**
 * Generation guidance is appended to the provider request only. It must never
 * rewrite the user's saved prompt or accumulate on every generation.
 */

export const UV_GUIDANCE = 'Preserve the UV layout, seams, and transparent areas.'

export function withUvGuidance(prompt: string): string {
  const trimmed = prompt.trim()
  if (!trimmed)
    return trimmed
  if (/(uv\s*layout|seams|transparent\s*areas)/i.test(trimmed))
    return trimmed
  return `${trimmed}\n\n${UV_GUIDANCE}`
}
