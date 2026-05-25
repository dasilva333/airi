import { createModelProvider, merge } from '@xsai-ext/providers/utils'
import { AwsClient } from 'aws4fetch'
import { z } from 'zod'
import type { ModelInfo } from '../../types'

import { defineProvider } from '../registry'

const amazonBedrockConfigSchema = z.object({
  accessKeyId: z.string('AWS Access Key ID').min(1),
  region: z
    .string('AWS Region')
    .regex(/^[a-z]{2,3}-[a-z]+-\d+$/, 'Must be a valid AWS region (e.g. us-east-1, ap-southeast-1)')
    .optional()
    .default('us-east-1'),
  secretAccessKey: z.string('AWS Secret Access Key').min(1),
  sessionToken: z.string('AWS Session Token (optional)').optional(),
})

type AmazonBedrockConfig = z.infer<typeof amazonBedrockConfigSchema>

// Helper: merge consecutive messages with the same role (Converse API requires alternating)
function mergeConsecutiveRoles(messages: Array<{ role: string; content: any[] }>) {
  const merged: Array<{ role: string; content: any[] }> = []
  for (const msg of messages) {
    const last = merged[merged.length - 1]
    if (last && last.role === msg.role) {
      last.content.push(...msg.content)
    } else {
      merged.push({ content: [...msg.content], role: msg.role })
    }
  }
  return merged
}

// Helper: convert OpenAI message content to Converse content blocks
function toConverseContent(content: any): Array<{ text: string }> {
  if (typeof content === 'string') {
    return [{ text: content }]
  }
  if (Array.isArray(content)) {
    return content.filter((c: any) => c.type === 'text' && c.text).map((c: any) => ({ text: c.text }))
  }
  return [{ text: String(content) }]
}

// Fallback static model list when API is unavailable
function fallbackModels(): ModelInfo[] {
  return [
    {
      description: 'Amazon Nova highly capable multimodal model',
      id: 'us.amazon.nova-pro-v1:0',
      name: 'Amazon Nova Pro',
      provider: 'amazon-bedrock',
    },
    {
      description: 'Amazon Nova very low cost multimodal model',
      id: 'us.amazon.nova-lite-v1:0',
      name: 'Amazon Nova Lite',
      provider: 'amazon-bedrock',
    },
    {
      description: 'Amazon Nova text only model, lowest cost',
      id: 'us.amazon.nova-micro-v1:0',
      name: 'Amazon Nova Micro',
      provider: 'amazon-bedrock',
    },
    {
      description: 'Intelligent, fast Claude 3.5 model on Amazon Bedrock',
      id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
      name: 'Claude Sonnet 3.5 v2',
      provider: 'amazon-bedrock',
    },
    {
      description: 'Hybrid reasoning model on Amazon Bedrock',
      id: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
      name: 'Claude Sonnet 3.7',
      provider: 'amazon-bedrock',
    },
  ]
}

function createBedrockConverseProvider(config: {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  region: string
}) {
  if (!config.accessKeyId || !config.secretAccessKey) {
    return {
      chat: (_model: string) => ({
        apiKey: 'bedrock-sigv4',
        baseURL: '',
        fetch: async () => new Response(JSON.stringify({ error: 'Missing credentials' }), { status: 401 }),
        model: '',
      }),
    }
  }

  const aws = new AwsClient({
    accessKeyId: config.accessKeyId,
    region: config.region,
    secretAccessKey: config.secretAccessKey,
    service: 'bedrock',
    sessionToken: config.sessionToken,
  })

  const baseURL = `https://bedrock-runtime.${config.region}.amazonaws.com/v1/`

  return {
    chat: (model: string) => ({
      apiKey: 'bedrock-sigv4',
      baseURL,
      fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
        // Parse incoming OpenAI format request
        const body = JSON.parse((init?.body as string) || '{}') as any
        const messages: any[] = body.messages || []
        const modelId: string = body.model || model

        // Separate system messages
        const systemMessages = messages.filter((m) => m.role === 'system')
        const chatMessages = messages.filter((m) => m.role !== 'system')

        // Convert to Converse messages format
        const converseMessages = mergeConsecutiveRoles(
          chatMessages.map((m) => ({
            content: toConverseContent(m.content),
            role: m.role as 'user' | 'assistant',
          })),
        )

        // Build system prompt
        const system =
          systemMessages.length > 0
            ? systemMessages.map((m) => ({
                text:
                  typeof m.content === 'string'
                    ? m.content
                    : Array.isArray(m.content)
                      ? m.content.map((c: any) => c.text || '').join('')
                      : String(m.content),
              }))
            : undefined

        // Build Converse request body
        const converseBody: any = {
          inferenceConfig: {
            maxTokens: body.max_tokens || 4096,
            ...(body.temperature !== undefined && { temperature: body.temperature }),
          },
          messages: converseMessages,
        }
        if (system) converseBody.system = system

        // Call Converse API (non-streaming for simplicity/reliability)
        const converseUrl = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`

        const signedRequest = await aws.sign(converseUrl, {
          body: JSON.stringify(converseBody),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        })

        const response = await fetch(signedRequest)

        if (!response.ok) {
          // Return error as-is for debugging
          return response
        }

        const data = (await response.json()) as any
        // Filter to text-only blocks (Claude 3.7+ may include thinking/reasoning blocks)
        const contentBlocks: any[] = data?.output?.message?.content || []
        const text = contentBlocks
          .filter((c: any) => c.type === 'text' || (!c.type && c.text))
          .map((c: any) => c.text || '')
          .join('')
        const stopReason = data?.stopReason || 'end_turn'

        // Convert to OpenAI SSE stream format
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            // Role delta
            const roleChunk = {
              choices: [{ delta: { role: 'assistant' }, finish_reason: null, index: 0 }],
              id: `chatcmpl-bedrock-${Date.now()}`,
              object: 'chat.completion.chunk',
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(roleChunk)}\n\n`))

            // Content delta
            if (text) {
              const contentChunk = {
                choices: [{ delta: { content: text }, finish_reason: null, index: 0 }],
                id: `chatcmpl-bedrock-${Date.now()}`,
                object: 'chat.completion.chunk',
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentChunk)}\n\n`))
            }

            // Final chunk with stop reason
            const stopChunk = {
              choices: [{ delta: {}, finish_reason: stopReason === 'end_turn' ? 'stop' : stopReason, index: 0 }],
              id: `chatcmpl-bedrock-${Date.now()}`,
              object: 'chat.completion.chunk',
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(stopChunk)}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })

        return new Response(stream, {
          headers: {
            'cache-control': 'no-cache',
            'content-type': 'text/event-stream',
          },
        })
      },
      model,
    }),
  }
}

export const providerAmazonBedrock = defineProvider<AmazonBedrockConfig>({
  business: () => ({
    deployment: 'cloud',
    pricing: 'paid',
  }),

  createProvider(config) {
    const region = config.region
    const baseURL = `https://bedrock-runtime.${region}.amazonaws.com/v1/`
    const chatProvider = createBedrockConverseProvider({
      accessKeyId: config.accessKeyId,
      region,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken,
    })
    return merge(chatProvider, createModelProvider({ apiKey: 'bedrock-sigv4', baseURL }))
  },

  createProviderConfig: ({ t }) =>
    amazonBedrockConfigSchema.extend({
      accessKeyId: amazonBedrockConfigSchema.shape.accessKeyId.meta({
        descriptionLocalized: t('settings.pages.providers.provider.amazon-bedrock.config.access-key-id.description'),
        labelLocalized: t('settings.pages.providers.provider.amazon-bedrock.config.access-key-id.label'),
        placeholderLocalized: 'AKIAIOSFODNN7EXAMPLE',
      }),
      region: amazonBedrockConfigSchema.shape.region.meta({
        descriptionLocalized: t('settings.pages.providers.provider.amazon-bedrock.config.region.description'),
        labelLocalized: t('settings.pages.providers.provider.amazon-bedrock.config.region.label'),
        placeholderLocalized: 'us-east-1',
      }),
      secretAccessKey: amazonBedrockConfigSchema.shape.secretAccessKey.meta({
        descriptionLocalized: t(
          'settings.pages.providers.provider.amazon-bedrock.config.secret-access-key.description',
        ),
        labelLocalized: t('settings.pages.providers.provider.amazon-bedrock.config.secret-access-key.label'),
        placeholderLocalized: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        type: 'password',
      }),
      sessionToken: amazonBedrockConfigSchema.shape.sessionToken.meta({
        descriptionLocalized: t('settings.pages.providers.provider.amazon-bedrock.config.session-token.description'),
        labelLocalized: t('settings.pages.providers.provider.amazon-bedrock.config.session-token.label'),
        placeholderLocalized: '',
        type: 'password',
      }),
    }),
  description: 'AWS Ecosystem - Access Titan, Claude, and Llama on AWS',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.amazon-bedrock.description'),

  extraMethods: {
    listModels: async (config, _provider) => {
      const region = config.region

      if (!config.accessKeyId || !config.secretAccessKey) {
        return fallbackModels()
      }

      const aws = new AwsClient({
        accessKeyId: config.accessKeyId,
        region,
        secretAccessKey: config.secretAccessKey,
        service: 'bedrock',
        sessionToken: config.sessionToken,
      })

      const base = `https://bedrock.${region}.amazonaws.com`

      try {
        // 1. Fetch foundation models for each target provider in parallel
        const targetProviders = ['Amazon', 'Anthropic', 'Moonshot', 'Minimax', 'DeepSeek']
        const foundationResults = await Promise.all(
          targetProviders.map(async (provider) => {
            const url = `${base}/foundation-models?byInferenceType=ON_DEMAND&byOutputModality=TEXT&byProvider=${encodeURIComponent(provider)}`
            const res = await fetch(await aws.sign(url, { method: 'GET' }))
            if (!res.ok) return { modelSummaries: [] as any[] }
            return res.json() as Promise<{ modelSummaries: any[] }>
          }),
        )
        const allFoundationModels = foundationResults.flatMap((r) => r.modelSummaries || [])

        // 2. Fetch system-defined inference profiles (cross-region, global/us prefixed)
        const profilesRes = await fetch(
          await aws.sign(`${base}/inference-profiles?type=SYSTEM_DEFINED&maxResults=1000`, { method: 'GET' }),
        )
        const profilesData = profilesRes.ok
          ? ((await profilesRes.json()) as { inferenceProfileSummaries: any[] })
          : { inferenceProfileSummaries: [] }

        // 3. Build lookup map: baseModelId → { global?: profileId, us?: profileId }
        const profileMap = new Map<string, { global?: string; us?: string }>()
        for (const p of profilesData.inferenceProfileSummaries || []) {
          const id: string = p.inferenceProfileId
          if (!id) continue
          const dotIdx = id.indexOf('.')
          if (dotIdx === -1) continue
          const prefix = id.slice(0, dotIdx) // 'us' or 'global'
          const baseId = id.slice(dotIdx + 1) // 'amazon.nova-pro-v1:0'

          if (!profileMap.has(baseId)) profileMap.set(baseId, {})
          const entry = profileMap.get(baseId)!
          if (prefix === 'global') entry.global = id
          else if (prefix === 'us') entry.us = id
        }

        // 4. For each foundation model, pick best profile ID:
        //    global. > us. > original modelId
        const foundationModelIds = new Set(allFoundationModels.map((m) => m.modelId))
        const results: ModelInfo[] = allFoundationModels.map((m) => {
          const entry = profileMap.get(m.modelId)
          const bestId = entry?.global ?? entry?.us ?? m.modelId

          return {
            description: `${m.providerName} · ${m.modelName}`,
            id: bestId,
            name: m.modelName,
            provider: 'amazon-bedrock',
          } satisfies ModelInfo
        })

        // 5. Also include inference profiles for models NOT in the foundation list
        //    (e.g., newer models like Claude Sonnet 4.6, Nova 2 Lite only in profiles)
        const targetPrefixes = ['amazon.', 'anthropic.', 'moonshot.', 'minimax.', 'deepseek.']
        const seenBaseIds = new Set(foundationModelIds)

        for (const p of profilesData.inferenceProfileSummaries || []) {
          const id: string = p.inferenceProfileId
          if (!id) continue
          const dotIdx = id.indexOf('.')
          if (dotIdx === -1) continue
          const prefix = id.slice(0, dotIdx) // 'us' or 'global'
          const baseId = id.slice(dotIdx + 1) // e.g. 'anthropic.claude-sonnet-4-6:0'

          // Only include if: it's a global/us profile, base model not already covered, and matches target providers
          if (prefix !== 'global' && prefix !== 'us') continue
          if (seenBaseIds.has(baseId)) continue
          if (!targetPrefixes.some((pfx) => baseId.startsWith(pfx))) continue

          // Prefer global over us — skip us if global version exists
          const existing = profileMap.get(baseId)
          if (prefix === 'us' && existing?.global) continue

          seenBaseIds.add(baseId)

          // Use the profile's name if available, else derive from ID
          const name = p.inferenceProfileName || baseId
          const providerName = baseId.split('.')[0]
          results.push({
            description: `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} · ${name}`,
            id,
            name,
            provider: 'amazon-bedrock',
          } satisfies ModelInfo)
        }

        return results.length > 0 ? results : fallbackModels()
      } catch {
        return fallbackModels()
      }
    },
  },
  icon: 'i-lobe-icons:aws',
  iconColor: 'i-lobe-icons:aws-color',
  id: 'amazon-bedrock',
  name: 'Amazon Bedrock',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.amazon-bedrock.title'),
  order: 18,
  tasks: ['chat'],

  validationRequiredWhen(config) {
    return !!config.accessKeyId?.trim() && !!config.secretAccessKey?.trim()
  },

  validators: {
    validateConfig: [
      ({ t }) => ({
        id: 'amazon-bedrock:check-config',
        name: t(
          'settings.pages.providers.provider.amazon-bedrock.validators.check-config',
          'Configuration Requirements',
        ),
        validator: async (config: Record<string, any>) => {
          if (!config.accessKeyId?.trim()) {
            return {
              errors: [],
              reason: 'AWS Access Key ID is required.',
              reasonKey:
                'settings.pages.providers.provider.amazon-bedrock.validators.check-config.access-key-id-required',
              valid: false,
            }
          }
          if (!config.secretAccessKey?.trim()) {
            return {
              errors: [],
              reason: 'AWS Secret Access Key is required.',
              reasonKey:
                'settings.pages.providers.provider.amazon-bedrock.validators.check-config.secret-access-key-required',
              valid: false,
            }
          }
          return {
            errors: [],
            reason: '',
            reasonKey: '',
            valid: true,
          }
        },
      }),
    ],
    validateProvider: [
      ({ t }) => ({
        id: 'amazon-bedrock:check-credentials',
        name: t('settings.pages.providers.provider.amazon-bedrock.validators.check-credentials'),
        validator: async (config: Record<string, any>) => {
          const region = config.region || 'us-east-1'
          const aws = new AwsClient({
            accessKeyId: config.accessKeyId,
            region,
            secretAccessKey: config.secretAccessKey,
            service: 'bedrock',
            sessionToken: config.sessionToken,
          })
          try {
            const res = await fetch(
              await aws.sign(
                `https://bedrock.${region}.amazonaws.com/foundation-models?byInferenceType=ON_DEMAND&byOutputModality=TEXT&byProvider=Amazon&maxResults=1`,
                { method: 'GET' },
              ),
            )
            if (res.status === 403 || res.status === 401) {
              return {
                errors: [{ error: new Error('Forbidden') }],
                reason: 'Invalid AWS credentials or insufficient permissions for Amazon Bedrock.',
                reasonKey:
                  'settings.pages.providers.provider.amazon-bedrock.validators.check-credentials.invalid-credentials',
                valid: false,
              }
            }
            return {
              errors: [],
              reason: '',
              reasonKey: '',
              valid: true,
            }
          } catch (error) {
            return {
              errors: [{ error }],
              reason: 'Failed to connect to Amazon Bedrock. Check your region and network.',
              reasonKey: 'settings.pages.providers.provider.amazon-bedrock.validators.check-credentials.network-error',
              valid: false,
            }
          }
        },
      }),
    ],
  },
})
