export interface ThinkingPreset {
  label: string
  description: string
  value: Record<string, unknown>
}

export const THINKING_PRESETS: ThinkingPreset[] = [
  {
    label: 'thinking.type:disabled',
    description: 'Disables thinking mode via Anthropic / Claude style thinking block',
    value: {
      thinking: {
        type: 'disabled',
      },
    },
  },
  {
    label: 'variants.thinking.off',
    description: 'Disables thinking mode via OpenRouter / custom provider variants block',
    value: {
      variants: {
        thinking: { reasoningEffort: 'high' },
        fast: { reasoningEffort: 'low' },
        off: { disabled: true },
      },
    },
  },
  {
    label: 'reasoningEffort',
    description: 'Sets reasoning effort to low for OpenAI o-series / compatible models',
    value: {
      reasoningEffort: 'low',
    },
  },
]

export function isThinkingPresetActive(currentJsonStr: string | undefined, presetValue: Record<string, unknown>): boolean {
  if (!currentJsonStr)
    return false
  try {
    const trimmed = currentJsonStr.trim()
    if (!trimmed)
      return false
    const existing = JSON.parse(trimmed)
    if (typeof existing !== 'object' || existing === null || Array.isArray(existing))
      return false
    return Object.keys(presetValue).every((key) => {
      return JSON.stringify(existing[key]) === JSON.stringify(presetValue[key])
    })
  }
  catch {
    return false
  }
}

export function toggleThinkingPreset(currentJsonStr: string | undefined, presetValue: Record<string, unknown>): string {
  try {
    const trimmed = (currentJsonStr || '').trim()
    if (!trimmed || trimmed === '{}') {
      return JSON.stringify(presetValue, null, 2)
    }
    const existing = JSON.parse(trimmed)
    if (typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
      if (isThinkingPresetActive(currentJsonStr, presetValue)) {
        const updated = { ...existing }
        for (const key of Object.keys(presetValue)) {
          delete updated[key]
        }
        return Object.keys(updated).length === 0 ? '{}' : JSON.stringify(updated, null, 2)
      }
      else {
        return JSON.stringify({ ...existing, ...presetValue }, null, 2)
      }
    }
    return JSON.stringify(presetValue, null, 2)
  }
  catch {
    return JSON.stringify(presetValue, null, 2)
  }
}
