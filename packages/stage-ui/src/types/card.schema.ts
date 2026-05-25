import {
  array,
  boolean,
  intersect,
  literal,
  looseObject,
  number,
  object,
  optional,
  pipe,
  record,
  regex,
  string,
  union,
  unknown,
} from 'valibot'

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
  consciousness: optional(
    object({
      model: string(),
      moduleConfigs: optional(record(string(), unknown())),
      provider: string(),
    }),
  ),
  displayModelId: optional(string()),
  live2d: optional(
    object({
      activeExpressions: optional(record(string(), number())),
      file: optional(string()),
      modelParameters: optional(record(string(), number())),
      source: optional(union([literal('file'), literal('url')])),
      url: optional(string()),
    }),
  ),
  preferredBackgroundDataUrl: optional(string()),
  preferredBackgroundId: optional(string()),
  preferredBackgroundName: optional(string()),
  speech: optional(
    object({
      language: optional(string()),
      model: string(),
      pitch: optional(number()),
      provider: string(),
      rate: optional(number()),
      ssml: optional(boolean()),
      voice_id: string(),
    }),
  ),
  vrm: optional(
    object({
      file: optional(string()),
      source: optional(union([literal('file'), literal('url')])),
      url: optional(string()),
    }),
  ),
})

const AiriHeartbeatSchema = object({
  contextOptions: optional(
    object({
      systemLoad: boolean(),
      usageMetrics: boolean(),
      windowHistory: boolean(),
    }),
  ),
  enabled: boolean(),
  injectIntoPrompt: boolean(),
  intervalMinutes: number(),
  prompt: string(),
  schedule: object({
    end: string(),
    start: string(),
  }),
  useAsLocalGate: boolean(),
})

const AiriDreamStateSchema = object({
  afkThresholdMinutes: number(),
  dailyRunCount: optional(number()),
  dailyRunDate: optional(string()),
  enabled: boolean(),
  journalingThreshold: union([literal('minimal'), literal('balanced'), literal('lush')]),
  lastProcessedAt: optional(number()),
  maxSessionsPerDay: number(),
  minConversationTurns: number(),
  sessionTimeoutMinutes: number(),
  strictAfkGating: boolean(),
})

const AiriShortTermMemorySchema = object({
  tokenBudgetPerDay: number(),
  windowSize: number(),
})

const AiriOutfitSchema = object({
  expressions: record(string(), number()),
  icon: string(),
  id: string(),
  name: string(),
  type: union([literal('base'), literal('overlay')]),
})

const AiriExtensionSchema = looseObject({
  acting: optional(
    looseObject({
      idleAnimations: optional(array(string())),
      modelExpressionPrompt: string(),
      speechExpressionPrompt: string(),
      speechMannerismPrompt: string(),
    }),
  ),
  active_concepts: optional(array(string())),
  active_state: optional(
    looseObject({
      active_expressions: optional(record(string(), number())),
      activeBackgroundId: optional(string()),
      displayModelId: optional(string()),
    }),
  ),
  agents: optional(
    record(
      string(),
      looseObject({
        enabled: optional(boolean()),
        prompt: string(),
      }),
    ),
  ),
  artistry: optional(
    looseObject({
      autonomousEnabled: optional(boolean()),
      autonomousHistoryDepth: optional(number()),
      autonomousMonitorEnabled: optional(boolean()),
      autonomousThreshold: optional(number()),
      model: optional(string()),
      options: optional(record(string(), unknown())),
      promptPrefix: optional(string()),
      provider: optional(string()),
      widgetInstruction: optional(string()),
    }),
  ),
  dreamState: optional(AiriDreamStateSchema),
  eternal_record: optional(
    looseObject({
      lore_bits: optional(array(string())),
      relational_milestones: optional(array(string())),
    }),
  ),
  generation: optional(
    looseObject({
      advanced: optional(record(string(), unknown())),
      enabled: boolean(),
      importedPresetMeta: optional(
        looseObject({
          importedAt: optional(string()),
          originalKeys: optional(array(string())),
          source: optional(string()),
        }),
      ),
      known: optional(
        looseObject({
          maxTokens: optional(number()),
          temperature: optional(number()),
          topP: optional(number()),
        }),
      ),
      model: optional(string()),
      provider: optional(string()),
    }),
  ),
  groundingEnabled: optional(boolean()),
  heartbeats: optional(AiriHeartbeatSchema),
  imageJournal: optional(
    looseObject({
      selfie: optional(boolean()),
    }),
  ),
  modules: optional(AiriModulesSchema),
  outfits: optional(array(AiriOutfitSchema)),
  proactivity_metrics: optional(
    looseObject({
      chatCount: number(),
      sttCount: number(),
      totalTurns: number(),
      ttsCount: number(),
    }),
  ),
  shortTermMemory: optional(AiriShortTermMemorySchema),
  visual_assets: optional(
    record(
      string(),
      looseObject({
        artistry: optional(
          looseObject({
            model: optional(string()),
            options: optional(record(string(), unknown())),
            provider: optional(string()),
          }),
        ),
        description: string(),
        isBase: optional(boolean()),
        manifestation: optional(
          looseObject({
            modelId: optional(string()),
            mood: optional(string()),
          }),
        ),
        prompt: optional(string()),
      }),
    ),
  ),
})

/**
 * Main AIRI Card Schema (V1)
 */
export const AiriCardSchema = looseObject({
  description: optional(string()),
  extensions: optional(
    intersect([
      record(string(), unknown()),
      looseObject({
        airi: optional(AiriExtensionSchema),
      }),
    ]),
  ),
  greetings: optional(array(string())),
  messageExample: optional(MessageExampleSchema),
  name: string('Card name is required'),
  nickname: optional(string()),
  notes: optional(string()),
  personality: optional(string()),
  postHistoryInstructions: optional(string()),
  scenario: optional(string()),
  systemPrompt: optional(string()),
  version: string('Version is required'),
})
// Exporting for use in the main schema later if needed
export { AiriExtensionSchema }
