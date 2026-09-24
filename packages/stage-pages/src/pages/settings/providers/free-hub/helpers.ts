/**
 * Resolves the AIRI internal provider ID for a Free AI Catalog platform and modality.
 *
 * NOTE: 'ollama' is explicitly mapped to 'openai-compatible' so remote Ollama Cloud / API
 * endpoints can receive custom base URLs and API keys without conflicting with the
 * local zero-auth Ollama provider.
 */
export function resolveProviderId(platform: string, modality?: string): string {
  const p = platform.toLowerCase()
  if (modality === 'transcription') {
    switch (p) {
      case 'deepgram':
        return 'deepgram-transcription'
      case 'xai':
        return 'xai-audio-transcription'
      case 'openai':
        return 'openai-audio-transcription'
      default:
        return 'openai-compatible-audio-transcription'
    }
  }

  switch (p) {
    case 'cloudflare':
      return 'cloudflare-workers-ai'
    case 'github':
      return 'github-models'
    case 'lmstudio':
      return 'lm-studio'
    case 'groq':
    case 'openrouter':
    case 'deepseek':
    case 'together':
    case 'mistral':
    case 'cerebras':
    case 'siliconflow':
    case 'cohere':
    case 'hyperbolic':
    case 'fireworks':
    case 'ai21':
      return p
    default:
      return 'openai-compatible'
  }
}
