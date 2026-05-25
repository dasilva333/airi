/* eslint-disable style/indent-binary-ops */
/* eslint-disable style/operator-linebreak */

import { createTestingPinia } from '@pinia/testing'
import type { WebSocketEventOf } from '@proj-airi/server-sdk'
import { tool } from '@xsai/tool'
import { nanoid } from 'nanoid'
import type { Store, StoreDefinition } from 'pinia'
import { setActivePinia } from 'pinia'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UnwrapRef } from 'vue'
import type z from 'zod'
import type { StreamEvent } from '../../llm'
import { useLLM } from '../../llm'
import type { AiriCard } from '../../modules'
import { useAiriCardStore, useConsciousnessStore } from '../../modules'
import { useProvidersStore } from '../../providers'
import { useCharacterStore } from '..'
import { sparkCommandSchema, useCharacterOrchestratorStore } from '.'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

function mockedStore<TStoreDef extends () => unknown>(
  useStore: TStoreDef,
): TStoreDef extends StoreDefinition<infer Id, infer State, infer Getters, infer Actions>
  ? Store<
      Id,
      State,
      Record<string, never>,
      {
        [K in keyof Actions]: Actions[K] extends (...args: any[]) => any
          ? // 👇 depends on your testing framework
            Mock<Actions[K]>
          : Actions[K]
      }
    > & {
      [K in keyof Getters]: UnwrapRef<Getters[K]>
    }
  : ReturnType<TStoreDef> {
  return useStore() as any
}

function getObjectSchema(schema?: Record<string, any>) {
  if (!schema) return undefined

  if (schema.type === 'object') return schema

  const candidates = [...(schema.anyOf ?? []), ...(schema.oneOf ?? [])]
  return candidates.find((candidate: Record<string, any>) => candidate?.type === 'object')
}

function getArraySchema(schema?: Record<string, any>) {
  if (!schema) return undefined

  if (schema.type === 'array') return schema

  const candidates = [...(schema.anyOf ?? []), ...(schema.oneOf ?? [])]
  return candidates.find((candidate: Record<string, any>) => candidate?.type === 'array')
}

describe('sparkCommandSchema', () => {
  it('emits strict objects in the json schema', async () => {
    const sparkTool = await tool({
      description: 'test',
      execute: async () => undefined,
      name: 'builtIn_sparkCommand',
      parameters: sparkCommandSchema,
    })

    const schema = sparkTool.function.parameters as Record<string, any>
    const commandsSchema = getArraySchema(schema.properties?.commands)
    const commandItemSchema = getObjectSchema(commandsSchema?.items)
    const guidanceSchema = getObjectSchema(commandItemSchema?.properties?.guidance)
    const personaSchema = getArraySchema(guidanceSchema?.properties?.persona)
    const personaItemSchema = getObjectSchema(personaSchema?.items)
    const optionsSchema = getArraySchema(guidanceSchema?.properties?.options)
    const optionsItemSchema = getObjectSchema(optionsSchema?.items)

    expect(schema.additionalProperties).toBe(false)
    expect(commandItemSchema?.additionalProperties).toBe(false)
    expect(guidanceSchema?.additionalProperties).toBe(false)
    expect(personaItemSchema?.additionalProperties).toBe(false)
    expect(optionsItemSchema?.additionalProperties).toBe(false)
  })
})

describe('store character-orchestrator', () => {
  beforeEach(() => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)

    const mockGetProviderInstance = vi.fn()
    mockedStore(useProvidersStore).getProviderInstance = mockGetProviderInstance
    mockedStore(useProvidersStore).getProviderInstance.mockResolvedValue({ chat: (_model: string) => ({}) as any })

    const consciousnessStore = useConsciousnessStore(pinia)
    consciousnessStore.activeProvider = 'mock-provider'
    consciousnessStore.activeModel = 'mock-model'

    const airiCardStore = useAiriCardStore(pinia)
    // @ts-expect-error - testing purpose
    airiCardStore.systemPrompt = 'You are a brave adventurer in Minecraft.'
    // @ts-expect-error - testing purpose
    airiCardStore.activeCard = {
      extensions: {
        airi: {
          agents: {},
          modules: {
            consciousness: {
              model: 'mock-model',
              provider: 'mock-provider',
            },
            speech: {
              model: 'mock-speech-model',
              provider: 'mock-speech-provider',
              voice_id: 'alloy',
            },
          },
        },
      },
      name: 'Hero',
      version: '1.0',
    } satisfies AiriCard
  })

  it('handles immediate spark:notify with reaction and commands', async () => {
    const mockStream = vi.fn()
    mockedStore(useLLM).stream = mockStream
    mockedStore(useLLM).stream.mockImplementation(
      async (_model: string, _provider: unknown, _messages: unknown, options: any) => {
        if (options?.tools?.length) {
          await options.tools[1].execute({
            commands: [
              {
                ack: 'ok',
                destinations: ['minecraft'],
                guidance: null,
                intent: 'action',
                interrupt: 'false',
                priority: 'critical',
              },
            ],
          } satisfies z.infer<typeof sparkCommandSchema>)
        }

        await options?.onStreamEvent?.({ text: 'Ahhh, got hit by zombie!', type: 'text-delta' } satisfies StreamEvent)
        await options?.onStreamEvent?.({ type: 'finish' } satisfies StreamEvent)
      },
    )

    const mockOnSparkNotifyReactionStreamEvent = vi.fn()
    mockedStore(useCharacterStore).onSparkNotifyReactionStreamEvent = mockOnSparkNotifyReactionStreamEvent
    const mockOnSparkNotifyReactionStreamEnd = vi.fn()
    mockedStore(useCharacterStore).onSparkNotifyReactionStreamEnd = mockOnSparkNotifyReactionStreamEnd

    const store = useCharacterOrchestratorStore()
    const event: WebSocketEventOf<'spark:notify'> = {
      data: {
        destinations: ['character'],
        eventId: nanoid(),
        headline: 'Hit by zombie',
        id: nanoid(),
        kind: 'alarm',
        urgency: 'immediate',
      },
      source: 'minecraft',
      type: 'spark:notify',
    }

    const result = await store.handleSparkNotify(event)

    expect(result?.commands).toHaveLength(1)
    expect(result?.commands?.[0].destinations).toEqual([event.source])
    expect(result?.commands?.[0].parentEventId).toBe(event.data.id)
    expect(result?.commands?.[0].intent).toBe('action')
    expect(result?.commands?.[0].priority).toBe('critical')

    expect(mockStream).toBeCalledTimes(1)
    expect(mockStream.mock.calls).toHaveLength(1)
    expect(mockStream.mock.calls[0][0]).toEqual('mock-model')
    expect(mockStream.mock.calls[0][1]).not.toBeNull()
    expect(mockStream.mock.calls[0][2]).toHaveLength(2)
    expect(mockStream.mock.calls[0][3]).toHaveProperty('tools')

    expect(mockOnSparkNotifyReactionStreamEvent).toBeCalledWith(event.data.id, 'Ahhh, got hit by zombie!')
    expect(mockOnSparkNotifyReactionStreamEnd).toBeCalledTimes(1)
  })
})
