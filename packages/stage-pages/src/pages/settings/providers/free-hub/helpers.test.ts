import { describe, expect, it } from 'vitest'

import { resolveProviderId } from './helpers'

describe('free AI Hub provider resolution', () => {
  // ROOT CAUSE / BUG REPORT:
  // Free AI Catalog models on Ollama were previously mapped to provider 'ollama'.
  // However, provider 'ollama' is strictly tuned as a local zero-auth server (empty API key).
  // Ollama models requiring credentials must resolve to 'openai-compatible' to accept custom baseUrl and apiKey.
  it('maps platform "ollama" to "openai-compatible" for chat models', () => {
    expect(resolveProviderId('ollama')).toBe('openai-compatible')
    expect(resolveProviderId('Ollama')).toBe('openai-compatible')
    expect(resolveProviderId('OLLAMA')).toBe('openai-compatible')
  })

  it('resolves dedicated native cloud providers correctly', () => {
    expect(resolveProviderId('cloudflare')).toBe('cloudflare-workers-ai')
    expect(resolveProviderId('github')).toBe('github-models')
    expect(resolveProviderId('lmstudio')).toBe('lm-studio')
    expect(resolveProviderId('groq')).toBe('groq')
    expect(resolveProviderId('openrouter')).toBe('openrouter')
    expect(resolveProviderId('deepseek')).toBe('deepseek')
    expect(resolveProviderId('together')).toBe('together')
    expect(resolveProviderId('mistral')).toBe('mistral')
    expect(resolveProviderId('cerebras')).toBe('cerebras')
    expect(resolveProviderId('siliconflow')).toBe('siliconflow')
    expect(resolveProviderId('cohere')).toBe('cohere')
    expect(resolveProviderId('hyperbolic')).toBe('hyperbolic')
    expect(resolveProviderId('fireworks')).toBe('fireworks')
    expect(resolveProviderId('ai21')).toBe('ai21')
  })

  it('falls back to "openai-compatible" for unknown or generic providers', () => {
    expect(resolveProviderId('unknown-platform')).toBe('openai-compatible')
    expect(resolveProviderId('custom-endpoint')).toBe('openai-compatible')
  })

  it('maps transcription platforms to dedicated transcription providers', () => {
    expect(resolveProviderId('deepgram', 'transcription')).toBe('deepgram-transcription')
    expect(resolveProviderId('xai', 'transcription')).toBe('xai-audio-transcription')
    expect(resolveProviderId('openai', 'transcription')).toBe('openai-audio-transcription')
    expect(resolveProviderId('other', 'transcription')).toBe('openai-compatible-audio-transcription')
  })
})
