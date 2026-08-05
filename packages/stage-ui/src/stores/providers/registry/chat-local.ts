import type { ProviderMetadata } from '../types'

import { createOllama } from '@xsai-ext/providers/create'
import { createPlayer2 } from '@xsai-ext/providers/special/create'

import { validateProviderBaseUrl } from '../helpers'

/**
 * Local/self-hosted chat provider metadata registry.
 *
 * Extracted from `providers.ts` during Phase 2 to shrink the orchestrator
 * below 200 lines. The two entries below are chat-category providers that do
 * not belong in the speech/transcription/local-engines registries and are
 * not yet duplicated in `libs/providers` (vllm is not a tracked def;
 * player2 is partially tracked but kept inline to avoid registry churn).
 *
 * `vllm` remains inline because its validator performs a health-check fetch
 * against `/models` on the configured baseUrl, which is a side effect
 * distinct from the generic openai-compatible health check in
 * `libs/providers/validators/run.ts` — keeping it here preserves the exact
 * historical behavior flagged for manual validation.
 */
export const chatLocalMetadata: Record<string, ProviderMetadata> = {
  vllm: {
    id: 'vllm',
    category: 'chat',
    tasks: ['text-generation'],
    nameKey: 'settings.pages.providers.provider.vllm.title',
    name: 'vLLM',
    descriptionKey: 'settings.pages.providers.provider.vllm.description',
    description: 'High-Efficiency Serving - Industry standard for high-throughput local model serving and self-hosting',
    iconColor: 'i-lobe-icons:vllm',
    createProvider: async config => createOllama((config.baseUrl as string).trim()),
    capabilities: {
      listModels: async () => {
        return [
          {
            id: 'llama-2-7b',
            name: 'Llama 2 (7B)',
            provider: 'vllm',
            description: 'Meta\'s Llama 2 7B parameter model',
            contextLength: 4096,
          },
          {
            id: 'llama-2-13b',
            name: 'Llama 2 (13B)',
            provider: 'vllm',
            description: 'Meta\'s Llama 2 13B parameter model',
            contextLength: 4096,
          },
          {
            id: 'llama-2-70b',
            name: 'Llama 2 (70B)',
            provider: 'vllm',
            description: 'Meta\'s Llama 2 70B parameter model',
            contextLength: 4096,
          },
          {
            id: 'mistral-7b',
            name: 'Mistral (7B)',
            provider: 'vllm',
            description: 'Mistral AI\'s 7B parameter model',
            contextLength: 8192,
          },
          {
            id: 'mixtral-8x7b',
            name: 'Mixtral (8x7B)',
            provider: 'vllm',
            description: 'Mistral AI\'s Mixtral 8x7B MoE model',
            contextLength: 32768,
          },
          {
            id: 'custom',
            name: 'Custom Model',
            provider: 'vllm',
            description: 'Specify a custom model name',
            contextLength: 0,
          },
        ]
      },
    },
    validators: {
      validateProviderConfig: async (config) => {
        if (!config.baseUrl) {
          return {
            errors: [new Error('Base URL is required.')],
            reason: 'Base URL is required. Default to http://localhost:8000/v1/ for vLLM.',
            valid: false,
          }
        }

        const res = validateProviderBaseUrl(config.baseUrl as string)
        if (res) {
          return res
        }

        // Check if the vLLM is reachable
        try {
          const response = await fetch(`${(config.baseUrl as string).trim()}models`, { headers: (config.headers as HeadersInit) || undefined })
          const errors = [
            !response.ok && new Error(`vLLM returned non-ok status code: ${response.statusText}`),
          ].filter((e): e is Error => e instanceof Error)

          return {
            errors,
            reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
            valid: response.ok,
          }
        }
        catch (err) {
          return {
            errors: [err as Error],
            reason: `Failed to reach vLLM, error: ${String(err)} occurred.`,
            valid: false,
          }
        }
      },
    },
  },
  player2: {
    id: 'player2',
    category: 'chat',
    tasks: ['text-generation'],
    nameKey: 'settings.pages.providers.provider.player2.title',
    name: 'Player2',
    descriptionKey: 'settings.pages.providers.provider.player2.description',
    description: 'player2.game',
    icon: 'i-lobe-icons:player2',
    requiresCredentials: false,
    defaultOptions: () => ({
      baseUrl: 'http://localhost:4315/v1/',
    }),
    createProvider: (config) => {
      return createPlayer2((config.baseUrl as string).trim())
    },
    capabilities: {
      listModels: async () => [
        {
          id: 'player2-model',
          name: 'Player2 Model',
          provider: 'player2',
        },
      ],
    },
    validators: {
      validateProviderConfig: async (config) => {
        if (!config.baseUrl) {
          return {
            errors: [new Error('Base URL is required.')],
            reason: 'Base URL is required. Default to http://localhost:4315/v1/',
            valid: false,
          }
        }

        const res = validateProviderBaseUrl(config.baseUrl as string)
        if (res) {
          return res
        }

        // Check if the local running Player 2 is reachable
        try {
          const response = await fetch(`${config.baseUrl}health`, {
            method: 'GET',
            headers: {
              'player2-game-key': 'airi',
            },
          })
          const errors = [
            !response.ok && new Error(`Player 2 returned non-ok status code: ${response.statusText}`),
          ].filter((e): e is Error => e instanceof Error)

          return {
            errors,
            reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
            valid: response.ok,
          }
        }
        catch (err) {
          return {
            errors: [err as Error],
            reason: `Failed to reach Player 2, error: ${String(err)} occurred. If you do not have Player 2 running, please start it and try again.`,
            valid: false,
          }
        }
      },
    },
  },
}
