import type { InferOutput } from 'valibot'

import {
  array,
  boolean,

  integer,
  intersect,
  literal,
  looseObject,
  maxLength,
  maxValue,
  minLength,
  minValue,
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
  pauseWhenAfk: optional(boolean()),
  afkThresholdMinutes: optional(number()),
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
  injectDreamContext: optional(boolean()),
  dreamIntrusionPrompt: optional(string()),
  pendingDreamChips: optional(array(string())),
  pendingDreamTimestamp: optional(number()),
})

const AiriTextJournalSchema = object({
  widgetInstruction: optional(string()),
  injectJournalContext: optional(boolean()),
  journalIntrusionPrompt: optional(string()),
  pendingJournalMoment: optional(object({
    entryText: string(),
    timestamp: number(),
  })),
})

const AiriShortTermMemorySchema = object({
  enabled: optional(boolean()),
  windowSize: number(),
  tokenBudgetPerDay: number(),
})

const AiriScreenWatchingSchema = object({
  enabled: boolean(),
  deliveryMode: optional(union([literal('both'), literal('bubble_only'), literal('tts_only'), literal('off')])),
  sourceType: optional(union([literal('displays'), literal('applications'), literal('auto_focused')])),
  sourceId: optional(string()),
  captureIntervalMs: optional(number()),
  downscalePercent: optional(number()),
  workload: optional(union([literal('attention-guard'), literal('screen:interpret'), literal('screen:ocr')])),
  publishToContext: optional(boolean()),
  interestTags: optional(array(string())),
  deferWhileSpeaking: optional(boolean()),
  maxPerHour: optional(number()),
  hysteresisMinutes: optional(number()),
  respectSchedule: optional(boolean()),
  pauseWhenAfk: optional(boolean()),
  afkThresholdMinutes: optional(number()),
})

const AiriOutfitSchema = object({
  id: string(),
  name: string(),
  icon: optional(string()),
  tag: optional(string()),
  meshes: optional(array(string())),
  type: optional(union([literal('base'), literal('overlay')])),
  expressions: optional(record(string(), number())),
  defaultEnabled: optional(boolean()),
})

export const AiriThinkingFillerSchema = object({
  text: pipe(string(), minLength(1), maxLength(160)),
  category: union([
    literal('generic'),
    literal('analytical'),
    literal('memory'),
    literal('emotional'),
    literal('uncertain'),
  ]),
  enabled: boolean(),
})

export const AiriPacingSchema = object({
  enabled: boolean(),
  armMinMs: optional(pipe(number(), integer(), minValue(500), maxValue(5000))),
  armMaxMs: optional(pipe(number(), integer(), minValue(500), maxValue(10000))),
  maxFillerDurationMs: optional(pipe(number(), integer(), minValue(400), maxValue(4000))),
  reasoningWindowMs: optional(pipe(number(), integer(), minValue(0), maxValue(2000))),
  categoryThreshold: optional(pipe(number(), minValue(1), maxValue(10))),
  kFast: optional(pipe(number(), minValue(0), maxValue(2))),
  maxFillersPerTurn: optional(pipe(number(), integer(), minValue(1), maxValue(8))),
  pacingIntervalMs: optional(pipe(number(), integer(), minValue(5000), maxValue(45000))),
  fillers: optional(array(AiriThinkingFillerSchema)),
  dynamicAsidesEnabled: optional(boolean()),
  dynamicAfterMs: optional(pipe(number(), integer(), minValue(5000), maxValue(60000))),
  candidateTtlMs: optional(pipe(number(), integer(), minValue(1000), maxValue(45000))),
  maxSynthesisBudgetMs: optional(pipe(number(), integer(), minValue(100), maxValue(2000))),
  experimentalOrganicPivots: optional(boolean()),
  visualTyping: optional(object({
    enabled: boolean(),
    minIntervalMs: optional(pipe(number(), integer(), minValue(0), maxValue(1000))),
    maxIntervalMs: optional(pipe(number(), integer(), minValue(0), maxValue(2000))),
    experimentalDraftRetype: optional(boolean()),
  })),
})

export type AiriThinkingFiller = InferOutput<typeof AiriThinkingFillerSchema>
export type AiriPacing = InferOutput<typeof AiriPacingSchema>

const AiriExtensionSchema = looseObject({
  modules: optional(AiriModulesSchema),
  heartbeats: optional(AiriHeartbeatSchema),
  dreamState: optional(AiriDreamStateSchema),
  shortTermMemory: optional(AiriShortTermMemorySchema),
  screenWatching: optional(AiriScreenWatchingSchema),
  textJournal: optional(AiriTextJournalSchema),
  groundingEnabled: optional(boolean()),
  groundingMemoryEnabled: optional(boolean()),
  groundingTopicsEnabled: optional(boolean()),
  groundingDirectorScratchpadEnabled: optional(boolean()),
  salienceGateEnabled: optional(boolean()),
  recentTopics: optional(array(looseObject({
    topic: string(),
    weight: number(),
  }))),
  generation: optional(looseObject({
    enabled: boolean(),
    provider: optional(string()),
    model: optional(string()),
    known: optional(looseObject({
      maxTokens: optional(number()),
      temperature: optional(number()),
      topP: optional(number()),
      reasoningFallback: optional(boolean()),
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
    pacing: optional(AiriPacingSchema),
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
    autonomousModelMode: optional(union([literal('inherit'), literal('custom')])),
    autonomousProvider: optional(string()),
    autonomousModel: optional(string()),
    autonomousMonitorEnabled: optional(boolean()),
    autonomousMonitorDiscordEnabled: optional(boolean()),
    injectArtistryContext: optional(boolean()),
    artistryIntrusionPrompt: optional(string()),
    pendingArtistryMoment: optional(object({
      prompt: string(),
      timestamp: number(),
    })),
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
  voice_profiles: optional(array(record(string(), unknown()))),
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
export type AiriCard = InferOutput<typeof AiriCardSchema>
