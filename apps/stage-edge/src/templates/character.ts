/**
 * Character card system prompt assembly and BYOS sync state formatters.
 */

export interface CharacterPromptConfig {
  name: string
  personality: string
  scenario?: string
  systemPrompt?: string
}

export function buildSystemInstruction(config: CharacterPromptConfig): string {
  const parts: string[] = []

  if (config.systemPrompt) {
    parts.push(config.systemPrompt)
  }

  parts.push(`You are roleplaying as ${config.name}.`)
  parts.push(`Personality & Character Traits: ${config.personality}`)

  if (config.scenario) {
    parts.push(`Current Scenario: ${config.scenario}`)
  }

  return parts.join('\n\n')
}
