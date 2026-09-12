import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { providerAzureOpenAI } from './index'

describe('providerAzureOpenAI', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should have correct id and tasks', () => {
    expect(providerAzureOpenAI.id).toBe('azure-openai')
    expect(providerAzureOpenAI.tasks).toContain('chat')
  })

  it('should require validation when apiKey is provided', () => {
    expect(providerAzureOpenAI.validationRequiredWhen?.({ apiKey: 'test-key' })).toBe(true)
    expect(providerAzureOpenAI.validationRequiredWhen?.({ apiKey: '' })).toBe(false)
  })

  it('sanitizes nullable anyOf tool schemas before sending request to Azure completions endpoint', async () => {
    const provider = (await providerAzureOpenAI.createProvider({
      apiKey: 'test-api-key',
      baseUrl: 'https://test-resource.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-04-01-preview',
    })) as any

    const chatInstance = provider.chat('gpt-4o')
    if (!chatInstance.fetch) {
      throw new Error('Expected custom fetch adapter on azure-openai chat instance')
    }

    const testTools = [
      {
        type: 'function',
        function: {
          name: 'getWeather',
          description: 'Get current weather',
          parameters: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            additionalProperties: false,
            required: ['location', 'units'],
            properties: {
              location: {
                type: 'string',
                description: 'City name',
              },
              units: {
                description: 'Temperature units',
                anyOf: [
                  { type: 'string' },
                  { type: 'null' },
                ],
              },
            },
          },
        },
      },
    ]

    await chatInstance.fetch('https://test-resource.openai.azure.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: testTools,
      }),
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [sentUrl, sentOptions] = fetchMock.mock.calls[0]
    expect(sentUrl).toContain('test-resource.openai.azure.com/openai/deployments/gpt-4o/chat/completions')

    const sentBody = JSON.parse(sentOptions.body as string)
    expect(sentBody.tools).toBeDefined()
    expect(sentBody.tools).toHaveLength(1)

    const sentToolParams = sentBody.tools[0].function.parameters

    // $schema and additionalProperties stripped
    expect(sentToolParams).not.toHaveProperty('$schema')
    expect(sentToolParams).not.toHaveProperty('additionalProperties')

    // anyOf collapsed into concrete string type
    expect(sentToolParams.properties.units).not.toHaveProperty('anyOf')
    expect(sentToolParams.properties.units.type).toBe('string')
    expect(sentToolParams.properties.units.description).toBe('Temperature units')

    // Nullable key removed from required list for strict validators
    expect(sentToolParams.required).toEqual(['location'])
  })
})
