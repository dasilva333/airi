/**
 * Rules module exports
 */

export type {
  DetectorDecision,
  DetectorDecisionSnapshot,
  RuleEngineConfig,
} from './engine'
// Engine
export { createRuleEngine, RuleEngine } from './engine'

// Loader
export {
  loadRuleFile,
  loadRulesFromDirectory,
  parseRule,
  parseRuleFromString,
} from './loader'

// Matcher (pure functions)
export {
  buildEventType,
  getNestedValue,
  matchCondition,
  matchEventType,
  matchWhere,
  renderMetadata,
  renderTemplate,
} from './matcher'

// Detector (pure functions)
export {
  advanceSlots,
  calculateSlotDelta,
  calculateWindowSlots,
  createDetectorState,
  DEFAULT_SLOT_MS,
  incrementCount,
  parseWindowDuration,
  processEvent,
  resetAfterFire,
} from './temporal-detector'

// Types
export type {
  DetectorState,
  DetectorsState,
  ParsedRule,
  Rule,
  RuleMatchResult,
  SignalConfig,
  TypeScriptRule,
  WhereClause,
  WhereCondition,
  YamlRule,
} from './types'
export { isTypeScriptRule } from './types'
