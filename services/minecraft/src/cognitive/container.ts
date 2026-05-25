import type { Logg } from '@guiiai/logg'
import { useLogg } from '@guiiai/logg'
import { asClass, asFunction, createContainer, InjectionMode } from 'awilix'
import { config } from '../composables/config'
import { TaskExecutor } from './action/task-executor'
import { Brain } from './conscious/brain'
import { LLMAgent } from './conscious/llm-agent'
import type { EventBus } from './event-bus'
import { createEventBus } from './event-bus'
import { PerceptionPipeline } from './perception/pipeline'
import type { RuleEngine } from './perception/rules'
import { createRuleEngine } from './perception/rules'
import { ReflexManager } from './reflex/reflex-manager'

export interface ContainerServices {
  logger: Logg
  eventBus: EventBus
  ruleEngine: RuleEngine
  llmAgent: LLMAgent
  perceptionPipeline: PerceptionPipeline
  taskExecutor: TaskExecutor
  brain: Brain
  reflexManager: ReflexManager
}

export function createAgentContainer() {
  const container = createContainer<ContainerServices>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  })

  // Register services
  container.register({
    brain: asClass(Brain)
      .singleton()
      .inject((c) => ({
        eventBus: c.resolve('eventBus'),
        llmAgent: c.resolve('llmAgent'),
        logger: c.resolve('logger'),
        reflexManager: c.resolve('reflexManager'),
        taskExecutor: c.resolve('taskExecutor'),
      })),

    // Register EventBus (cognitive event core)
    eventBus: asFunction(({ logger }) =>
      createEventBus({
        onSubscriberError: ({ event, pattern, error }) => {
          logger
            .withFields({
              eventId: event.id,
              eventType: event.type,
              parentId: event.parentId,
              pattern,
              traceId: event.traceId,
            })
            .errorWithError('EventBus subscriber failed', error)
        },
      }),
    ).singleton(),

    // Register LLM Agent (xsai-based)
    llmAgent: asFunction(
      () =>
        new LLMAgent({
          apiKey: config.openai.apiKey,
          baseURL: config.openai.baseUrl,
          model: config.openai.model,
        }),
    ).singleton(),
    // Create independent logger for each agent
    logger: asFunction(() => useLogg('agent').useGlobalConfig()).singleton(),

    perceptionPipeline: asClass(PerceptionPipeline).singleton(),

    // Reflex Manager (Reactive Layer)
    reflexManager: asFunction(
      ({ eventBus, taskExecutor, logger }) =>
        new ReflexManager({
          eventBus,
          logger,
          taskExecutor,
        }),
    ).singleton(),

    // Register RuleEngine (YAML rules processing)
    ruleEngine: asFunction(({ eventBus }) => {
      const engine = createRuleEngine({
        config: {
          rulesDir: new URL('./perception/rules', import.meta.url).pathname,
          slotMs: 20,
        },
        eventBus,
        logger: useLogg('ruleEngine').useGlobalConfig(),
      })
      engine.init()
      return engine
    }).singleton(),

    // TaskExecutor with logger injection only
    taskExecutor: asFunction(({ logger }) => new TaskExecutor({ logger })).singleton(),
  })

  return container
}
