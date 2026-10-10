import { describe, expect, it } from 'vitest'

import { buildReasoningOverrides, getSupportedReasoningModes } from './reasoning'

describe('buildReasoningOverrides', () => {
  it('returns nothing for default or missing mode', () => {
    expect(buildReasoningOverrides('deepseek', 'default')).toEqual({})
    expect(buildReasoningOverrides('deepseek', undefined)).toEqual({})
  })

  it('returns nothing for providers without a known reasoning control', () => {
    expect(buildReasoningOverrides('ollama', 'high')).toEqual({})
  })

  it('returns nothing for modes the provider does not support', () => {
    expect(buildReasoningOverrides('deepseek', 'high')).toEqual({})
    expect(buildReasoningOverrides('xai', 'medium')).toEqual({})
  })

  it('maps DeepSeek to the thinking toggle', () => {
    expect(buildReasoningOverrides('deepseek', 'on')).toEqual({ thinking: { type: 'enabled' } })
    expect(buildReasoningOverrides('deepseek', 'off')).toEqual({ thinking: { type: 'disabled' } })
  })

  it('resolves multi-instance provider keys to their base provider', () => {
    expect(buildReasoningOverrides('deepseek:work', 'off')).toEqual({ thinking: { type: 'disabled' } })
  })

  it('maps effort providers to reasoning_effort', () => {
    expect(buildReasoningOverrides('openai', 'low')).toEqual({ reasoning_effort: 'low' })
    expect(buildReasoningOverrides('google-generative-ai', 'off')).toEqual({ reasoning_effort: 'none' })
  })

  it('maps OpenRouter to its unified reasoning object', () => {
    expect(buildReasoningOverrides('openrouter-ai', 'high')).toEqual({ reasoning: { effort: 'high' } })
    expect(buildReasoningOverrides('openrouter-ai', 'off')).toEqual({ reasoning: { enabled: false } })
  })

  it('maps LM Studio toggles onto reasoning_effort', () => {
    expect(buildReasoningOverrides('lm-studio', 'off')).toEqual({ reasoning_effort: 'none' })
    expect(buildReasoningOverrides('lm-studio', 'on')).toEqual({ reasoning_effort: 'medium' })
    expect(buildReasoningOverrides('lm-studio', 'high')).toEqual({ reasoning_effort: 'high' })
  })

  it('maps Qwen on DashScope to enable_thinking', () => {
    expect(buildReasoningOverrides('alibaba-cloud', 'on')).toEqual({ enable_thinking: true })
  })
})

describe('getSupportedReasoningModes', () => {
  it('lists default first followed by provider modes', () => {
    expect(getSupportedReasoningModes('deepseek')).toEqual(['default', 'off', 'on'])
  })

  it('is empty for unsupported providers', () => {
    expect(getSupportedReasoningModes('ollama')).toEqual([])
  })
})
