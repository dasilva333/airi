import { array, boolean, intersect, literal, looseObject, number, object, optional, pipe, record, regex, string, union, unknown } from 'valibot'

/**
 * Message Example Item Schema
 * Validates strings starting with {{user}}: or {{char}}:
 */
export const MessageExampleItemSchema = pipe(
  string('Message example line must be a string'),
  regex(/^\{\{(?:user|char)\}\}: /, 'Message example line must start with "{{user}}:" or "{{char}}:"'),
)

/**
 * Message Example Schema (Array of Message Arrays)
 */
export const MessageExampleSchema = array(
  array(MessageExampleItemSchema, 'Each example turn must be an array of messages'),
  'Message Example must be an array of example turns',
)

/**
 * AIRI Extension Schema parts
 */
const AiriModulesSchema = object({
  consciousness: optional(object({
    provider: string(),
    model: string(),
    moduleConfigs: optional(record(string(), unknown())),
  })),
  speech: optional(object({
    provider: string(),
    model: string(),
    voice_id: string(),
    pitch: optional(number()),
    rate: optional(number()),
    ssml: optional(boolean()),
    language: optional(string()),
  })),
  displayModelId: optional(string()),
  vrm: optional(object({
    source: optional(union([literal('file'), literal('url')])),
    file: optional(string()),
    url: optional(string()),
  })),
  live2d: optional(object({
    source: optional(union([literal('file'), literal('url')])),
    file: optional(string()),
    url: optional(string()),
    activeExpressions: optional(record(string(), number())),
    modelParameters: optional(record(string(), number())),
  })),
  preferredBackgroundId: optional(string()),
  preferredBackgroundName: optional(string()),
  preferredBackgroundDataUrl: optional(string()),
})

const AiriHeartbeatSchema = object({
  enabled: boolean(),
  intervalMinutes: number(),
  prompt: string(),
  injectIntoPrompt: boolean(),
  useAsLocalGate: boolean(),
  contextOptions: optional(object({
    windowHistory: boolean(),
    systemLoad: boolean(),
    usageMetrics: boolean(),
  })),
  schedule: object({
    start: string(),
    end: string(),
  }),
})

const AiriDreamStateSchema = object({
  enabled: boolean(),
  strictAfkGating: boolean(),
  journalingThreshold: union([literal('minimal'), literal('balanced'), literal('lush')]),
  maxSessionsPerDay: number(),
  sessionTimeoutMinutes: number(),
  afkThresholdMinutes: number(),
  minConversationTurns: number(),
  lastProcessedAt: optional(number()),
  dailyRunDate: optional(string()),
  dailyRunCount: optional(number()),
})

const AiriShortTermMemorySchema = object({
  windowSize: number(),
  tokenBudgetPerDay: number(),
})

const AiriOutfitSchema = object({
  id: string(),
  name: string(),
  icon: string(),
  type: union([literal('base'), literal('overlay')]),
  expressions: record(string(), number()),
})

const AiriExtensionSchema = looseObject({
  modules: optional(AiriModulesSchema),
  heartbeats: optional(AiriHeartbeatSchema),
  dreamState: optional(AiriDreamStateSchema),
  shortTermMemory: optional(AiriShortTermMemorySchema),
  groundingEnabled: optional(boolean()),
  generation: optional(looseObject({
    enabled: boolean(),
    provider: optional(string()),
    model: optional(string()),
    known: optional(looseObject({
      maxTokens: optional(number()),
      temperature: optional(number()),
      topP: optional(number()),
    })),
    advanced: optional(record(string(), unknown())),
    importedPresetMeta: optional(looseObject({
      source: optional(string()),
      originalKeys: optional(array(string())),
      importedAt: optional(string()),
    })),
  })),
  acting: optional(looseObject({
    modelExpressionPrompt: string(),
    speechExpressionPrompt: string(),
    speechMannerismPrompt: string(),
    idleAnimations: optional(array(string())),
  })),
  outfits: optional(array(AiriOutfitSchema)),
  artistry: optional(looseObject({
    provider: optional(string()),
    model: optional(string()),
    promptPrefix: optional(string()),
    widgetInstruction: optional(string()),
    options: optional(record(string(), unknown())),
    autonomousEnabled: optional(boolean()),
    autonomousThreshold: optional(number()),
    autonomousHistoryDepth: optional(number()),
    autonomousMonitorEnabled: optional(boolean()),
  })),
  agents: optional(record(string(), looseObject({
    prompt: string(),
    enabled: optional(boolean()),
  }))),
  imageJournal: optional(looseObject({
    selfie: optional(boolean()),
  })),
  visual_assets: optional(record(string(), looseObject({
    description: string(),
    prompt: optional(string()),
    isBase: optional(boolean()),
    artistry: optional(looseObject({
      provider: optional(string()),
      model: optional(string()),
      options: optional(record(string(), unknown())),
    })),
    manifestation: optional(looseObject({
      modelId: optional(string()),
      mood: optional(string()),
    })),
  }))),
  active_concepts: optional(array(string())),
  eternal_record: optional(looseObject({
    relational_milestones: optional(array(string())),
    lore_bits: optional(array(string())),
  })),
  proactivity_metrics: optional(looseObject({
    ttsCount: number(),
    sttCount: number(),
    chatCount: number(),
    totalTurns: number(),
  })),
  active_state: optional(looseObject({
    displayModelId: optional(string()),
    activeBackgroundId: optional(string()),
    active_expressions: optional(record(string(), number())),
  })),
})

/**
 * Main AIRI Card Schema (V1)
 */
export const AiriCardSchema = looseObject({
  name: string('Card name is required'),
  nickname: optional(string()),
  version: string('Version is required'),
  description: optional(string()),
  notes: optional(string()),
  personality: optional(string()),
  scenario: optional(string()),
  systemPrompt: optional(string()),
  postHistoryInstructions: optional(string()),
  greetings: optional(array(string())),
  messageExample: optional(MessageExampleSchema),
  extensions: optional(intersect([
    record(string(), unknown()),
    looseObject({
      airi: optional(AiriExtensionSchema),
    }),
  ])),
})
// Exporting for use in the main schema later if needed
export { AiriExtensionSchema }
