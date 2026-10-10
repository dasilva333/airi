export type ReasoningMode = 'default' | 'off' | 'on' | 'low' | 'medium' | 'high'

export const REASONING_MODE_LABELS: Record<ReasoningMode, string> = {
  default: 'Default',
  off: 'Off',
  on: 'On',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

interface ReasoningProviderSpec {
  modes: Exclude<ReasoningMode, 'default'>[]
  build: (mode: Exclude<ReasoningMode, 'default'>) => Record<string, unknown>
}

function thinkingTypeToggle(mode: Exclude<ReasoningMode, 'default'>) {
  return { thinking: { type: mode === 'off' ? 'disabled' : 'enabled' } }
}

function reasoningEffort(mode: Exclude<ReasoningMode, 'default'>) {
  return { reasoning_effort: mode === 'off' ? 'none' : mode }
}

// Each provider exposes reasoning through a different request body field.
const REASONING_PROVIDER_SPECS: Record<string, ReasoningProviderSpec> = {
  'deepseek': { modes: ['off', 'on'], build: thinkingTypeToggle },
  'zai': { modes: ['off', 'on'], build: thinkingTypeToggle },
  'alibaba-cloud': { modes: ['off', 'on'], build: mode => ({ enable_thinking: mode !== 'off' }) },
  'openai': { modes: ['low', 'medium', 'high'], build: reasoningEffort },
  'azure-openai': { modes: ['low', 'medium', 'high'], build: reasoningEffort },
  'xai': { modes: ['low', 'high'], build: reasoningEffort },
  'google-generative-ai': { modes: ['off', 'low', 'medium', 'high'], build: reasoningEffort },
  'openrouter-ai': {
    modes: ['off', 'low', 'medium', 'high'],
    build: mode => ({ reasoning: mode === 'off' ? { enabled: false } : { effort: mode } }),
  },
  // NOTICE: LM Studio >= 0.4.8 accepts `reasoning_effort`; toggle-style models treat any effort as "on".
  'lm-studio': {
    modes: ['off', 'on', 'low', 'medium', 'high'],
    build: mode => ({ reasoning_effort: mode === 'off' ? 'none' : mode === 'on' ? 'medium' : mode }),
  },
}

export function toBaseProviderId(providerKey: string): string {
  return providerKey.includes(':') ? providerKey.split(':')[0] : providerKey
}

export function getSupportedReasoningModes(providerKey: string): ReasoningMode[] {
  const spec = REASONING_PROVIDER_SPECS[toBaseProviderId(providerKey)]
  return spec ? ['default', ...spec.modes] : []
}

export function buildReasoningOverrides(providerKey: string, mode: ReasoningMode | undefined): Record<string, unknown> {
  if (!mode || mode === 'default')
    return {}

  const spec = REASONING_PROVIDER_SPECS[toBaseProviderId(providerKey)]
  if (!spec || !spec.modes.includes(mode))
    return {}

  return spec.build(mode)
}
