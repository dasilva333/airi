import type {
  Nan0ActionAuthority,
  Nan0ActionIntentRecord,
  Nan0CapabilityDefinition,
  Nan0DecisionRecord,
} from '../types'

export class Nan0CapabilityRegistry {
  private readonly definitions = new Map<string, Nan0CapabilityDefinition>()

  constructor(definitions: readonly Nan0CapabilityDefinition[] = []) {
    for (const definition of definitions) {
      if (this.definitions.has(definition.capabilityId))
        throw new Error(`Duplicate Nan0 capability ${definition.capabilityId}.`)
      this.definitions.set(definition.capabilityId, definition)
    }
  }

  availableCapabilityIds(): string[] {
    return [...this.definitions.values()]
      .filter(definition => definition.availability === 'available')
      .map(definition => definition.capabilityId)
      .sort()
  }

  validate(capabilityId: string, parameters: unknown, executionMode?: string): Nan0CapabilityDefinition | null {
    const definition = this.definitions.get(capabilityId)
    if (!definition || definition.availability !== 'available')
      return null
    if (executionMode && !definition.supportedExecutionModes.includes(executionMode as never))
      return null
    return definition.acceptedParameters(parameters) ? definition : null
  }

  authorityFor(
    action: Readonly<Nan0ActionIntentRecord>,
    decision: Readonly<Nan0DecisionRecord>,
  ): Nan0ActionAuthority | null {
    if (action.status !== 'authorized' && action.status !== 'active')
      return null
    if (!decision.allowed || (decision.finalDecision !== 'ACT' && decision.finalDecision !== 'SPEAK'))
      return null
    if (action.decisionId !== decision.decisionId
      || action.thoughtId !== decision.thoughtId
      || action.turnId !== decision.turnId) {
      return null
    }
    const definition = this.validate(action.capabilityId, action.parameters, action.executionMode)
    if (!definition)
      return null
    if (decision.finalDecision === 'ACT' && !definition.requiresAct)
      return null
    if (decision.finalDecision === 'SPEAK' && (definition.requiresAct || !definition.canRunDuringSpeak))
      return null
    return {
      schemaVersion: 1,
      actionIntentId: action.actionIntentId,
      decisionId: action.decisionId,
      thoughtId: action.thoughtId,
      turnId: action.turnId,
      capabilityId: action.capabilityId,
      executionMode: action.executionMode,
      lifecyclePolicyId: action.timeoutPolicy.policyId,
      parameters: structuredClone(action.parameters),
      authorizedToolNames: [...definition.toolNames],
    }
  }
}
